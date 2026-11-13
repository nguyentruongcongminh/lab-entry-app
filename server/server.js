'use strict';
/*
 * LabEntry — Máy chủ LAN (v87). KHÔNG cần cài thêm gói nào: chỉ cần Node.js (hoặc node.exe đi kèm).
 *
 *   node server/server.js            (PORT mặc định 8787)
 *
 * Việc của máy chủ:
 *   1) Phát chính ứng dụng LabEntry cho mọi máy trong mạng LAN (mở http://<IP máy chủ>:8787).
 *   2) Giữ MỘT bản dữ liệu mẫu chung và đồng bộ cho các máy (PC, điện thoại Android).
 * Dữ liệu chỉ nằm trong thư mục data/ cạnh máy chủ — không gửi ra Internet, không gọi dịch vụ ngoài.
 *
 * An toàn mạng: chỉ nhận kết nối từ địa chỉ mạng nội bộ (192.168.x.x, 10.x.x.x, 172.16-31.x.x, localhost);
 * chặn web lạ gọi vào (kiểm tra Origin/Host, bắt buộc header X-LabEntry).
 */
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('../sync-core.js');

const MAX_BODY = 40 * 1024 * 1024;
const MAX_WAIT_S = 25;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8',
};
const STATIC_OK = /^[A-Za-z0-9._-]+\.(html|js|css|png|svg|ico|webmanifest)$/;
const DEFAULT_ORIGINS = ['https://nguyentruongcongminh.github.io', 'capacitor://localhost', 'ionic://localhost'];

function isPrivateAddress(addr) {
  if (!addr) return false;
  let a = String(addr);
  if (a.startsWith('::ffff:')) a = a.slice(7);
  if (a === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(a) || /^fe[89ab][0-9a-f]:/i.test(a)) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (!m) return false;
  const [o1, o2] = [Number(m[1]), Number(m[2])];
  return o1 === 10 || o1 === 127 || (o1 === 192 && o2 === 168) || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 169 && o2 === 254);
}

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((n) => (nets[n] || []).forEach((i) => {
    if (i.family === 'IPv4' && !i.internal && isPrivateAddress(i.address)) out.push(i.address);
  }));
  return out;
}

function createLabServer(opts) {
  const o = Object.assign({ port: 8787, host: '0.0.0.0', dataDir: path.join(__dirname, 'data'), appDir: null, allowAny: false, origins: [], quiet: false, now: null }, opts || {});
  const nowIso = () => (o.now ? o.now() : new Date().toISOString());
  const log = (...a) => { if (!o.quiet) console.log(...a); };
  fs.mkdirSync(o.dataDir, { recursive: true });
  const stateFile = path.join(o.dataDir, 'state.json');
  const backupDir = path.join(o.dataDir, 'backup');

  /* ---------- Nạp / ghi dữ liệu (ghi nguyên tử: file tạm -> đổi tên) ---------- */
  function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  function loadState() {
    for (const f of [stateFile, stateFile + '.bak']) {
      if (!fs.existsSync(f)) continue;
      try {
        const s = readJson(f);
        if (s && s.v === 1 && s.records) { if (f !== stateFile) log('! state.json hỏng — đã nạp từ state.json.bak'); return s; }
      } catch (e) { log('! Không đọc được ' + path.basename(f) + ': ' + e.message); }
    }
    if (fs.existsSync(stateFile)) {
      /* Có file dữ liệu nhưng không đọc được: KHÔNG được khởi tạo rỗng rồi ghi đè */
      throw new Error('Dữ liệu ' + stateFile + ' bị hỏng và không có bản .bak dùng được. Hãy dùng file trong data/backup/.');
    }
    return Core.newState();
  }
  let state = loadState();
  let lastDailyBackup = '';
  function persist() {
    const tmp = stateFile + '.tmp';
    const text = JSON.stringify(state);
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (fs.existsSync(stateFile)) { try { fs.copyFileSync(stateFile, stateFile + '.bak'); } catch (e) { /* bỏ qua */ } }
    fs.renameSync(tmp, stateFile);
    const day = nowIso().slice(0, 10);
    if (day !== lastDailyBackup) {
      lastDailyBackup = day;
      try {
        fs.mkdirSync(backupDir, { recursive: true });
        fs.copyFileSync(stateFile, path.join(backupDir, 'state-' + day + '.json'));
        const files = fs.readdirSync(backupDir).filter((f) => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
        files.slice(0, Math.max(0, files.length - 60)).forEach((f) => { try { fs.unlinkSync(path.join(backupDir, f)); } catch (e) { /* bỏ qua */ } });
      } catch (e) { log('! Không ghi được bản sao lưu ngày: ' + e.message); }
    }
  }
  /* Giữ ra một bản lưu ngay khi khởi động */
  if (fs.existsSync(stateFile)) { try { persist(); } catch (e) { /* bỏ qua */ } }

  /* ---------- Long-poll: máy khách treo yêu cầu cho tới khi có thay đổi ---------- */
  const waiters = new Set();
  function notify() {
    [...waiters].forEach((w) => {
      if (state.seq > w.since) { clearTimeout(w.timer); waiters.delete(w); w.fire(); }
    });
  }

  /* ---------- Kiểm soát truy cập ---------- */
  const extraOrigins = DEFAULT_ORIGINS.concat(o.origins || [], (process.env.LAB_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean));
  function originAllowed(origin, host) {
    if (!origin) return true;
    let u;
    try { u = new URL(origin); } catch (e) { return false; }
    if (u.host === host) return true;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]') return true;
    return extraOrigins.indexOf(origin) >= 0;
  }
  function hostAllowed(host) {
    const h = String(host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h === 'localhost' || h === '::1' || /\.local$/i.test(h) || !h.includes('.')) return true;
    return (process.env.LAB_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean).indexOf(h) >= 0;
  }

  function send(res, code, body, headers) {
    const h = Object.assign({ 'Cache-Control': 'no-store' }, headers || {});
    if (typeof body === 'object' && !Buffer.isBuffer(body)) { h['Content-Type'] = 'application/json; charset=utf-8'; body = JSON.stringify(body); }
    res.writeHead(code, h);
    res.end(body);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(Object.assign(new Error('too-large'), { code: 413 })); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch (e) { reject(Object.assign(new Error('bad-json'), { code: 400 })); }
      });
      req.on('error', reject);
    });
  }

  function resolveAppDir() {
    if (o.appDir) return o.appDir;
    const bundled = path.join(__dirname, 'app');
    if (fs.existsSync(path.join(bundled, 'index.html'))) return bundled;
    return path.join(__dirname, '..');
  }
  const appDir = resolveAppDir();

  function serveStatic(req, res, pathname) {
    let name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!STATIC_OK.test(name)) return send(res, 404, 'Không tìm thấy');
    const file = path.join(appDir, name);
    if (!file.startsWith(path.resolve(appDir)) || !fs.existsSync(file)) return send(res, 404, 'Không tìm thấy');
    const ext = path.extname(name).toLowerCase();
    send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  }

  function statusPage() {
    const live = Object.keys(state.records).filter((k) => !state.records[k].deleted).length;
    const openC = state.conflicts.filter((c) => c.status === 'open').length;
    const ips = lanAddresses();
    const urls = ips.length ? ips.map((ip) => 'http://' + ip + ':' + o.port + '/') : ['(chưa thấy địa chỉ mạng LAN — kiểm tra Wi-Fi/dây mạng)'];
    return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LabEntry — Máy chủ LAN</title>' +
      '<style>body{font:16px system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#16202a}h1{font-size:22px}code,.url{background:#eef3f8;padding:2px 8px;border-radius:6px}' +
      '.url{display:block;margin:6px 0;font-size:20px;font-weight:600}.card{border:1px solid #cfd9e3;border-radius:10px;padding:12px 16px;margin:14px 0}</style>' +
      '<h1>🧪 LabEntry — Máy chủ LAN đang chạy</h1>' +
      '<div class="card"><b>Mở ứng dụng trên các máy khác (cùng Wi-Fi / mạng LAN):</b>' + urls.map((u) => '<span class="url">' + u + '</span>').join('') +
      '<div>Trên chính máy này có thể dùng <code>http://localhost:' + o.port + '/</code></div></div>' +
      '<div class="card">Mẫu đang lưu: <b>' + live + '</b> · Xung đột chờ xử lý: <b>' + openC + '</b> · Dữ liệu chung số: <b>' + state.seq + '</b></div>' +
      '<div class="card"><a href="/api/backup?X=1" id="dl">Tải bản sao lưu toàn bộ dữ liệu (JSON)</a><div style="margin-top:8px;color:#566">Máy chủ tự sao lưu mỗi ngày vào thư mục <code>data/backup</code>.</div></div>' +
      '<script>document.getElementById("dl").addEventListener("click",function(e){e.preventDefault();fetch("/api/backup",{headers:{"X-LabEntry":"1"}}).then(function(r){return r.blob()}).then(function(b){var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="labentry-server-backup.json";a.click();});});</script>';
  }

  async function handleApi(req, res, url) {
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/hello') {
      return send(res, 200, { app: 'LabEntry-LAN', proto: 1, serverId: state.serverId, seq: state.seq, time: nowIso(), records: Object.keys(state.records).length });
    }
    if (req.method === 'GET' && p === '/api/sync') {
      const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
      const wait = Math.min(MAX_WAIT_S, Math.max(0, parseInt(url.searchParams.get('wait') || '0', 10) || 0));
      const respond = () => send(res, 200, Core.changesSince(state, since));
      if (state.seq > since || wait === 0) return respond();
      const w = { since, fire: respond, timer: null };
      w.timer = setTimeout(() => { waiters.delete(w); respond(); }, wait * 1000);
      waiters.add(w);
      req.on('close', () => { clearTimeout(w.timer); waiters.delete(w); });
      return undefined;
    }
    if (req.method === 'POST' && p === '/api/push') {
      const body = await readBody(req);
      const ops = Array.isArray(body.ops) ? body.ops.slice(0, 500) : [];
      ops.forEach((op) => { if (op && typeof op === 'object') { op.deviceId = String(body.deviceId || '').slice(0, 60); op.operator = String(body.operator || '').slice(0, 100); } });
      const results = Core.applyBatch(state, ops, nowIso());
      persist(); /* ghi xuống đĩa TRƯỚC khi trả lời máy khách */
      send(res, 200, { serverId: state.serverId, seq: state.seq, results });
      notify();
      return undefined;
    }
    if (req.method === 'POST' && p === '/api/conflicts/resolve') {
      const body = await readBody(req);
      const r = Core.resolveConflict(state, String(body.id || ''), body.choice, String(body.by || '').slice(0, 100), nowIso());
      if (r.ok) persist();
      send(res, r.ok ? 200 : 409, Object.assign({ seq: state.seq }, r));
      if (r.ok) notify();
      return undefined;
    }
    if (req.method === 'POST' && p === '/api/import') {
      const body = await readBody(req);
      const list = Array.isArray(body) ? body : (body && Array.isArray(body.records) ? body.records : null);
      if (!list) return send(res, 400, { error: 'file không chứa danh sách bản ghi' });
      const stats = Core.importRecords(state, list, { batchId: Date.now().toString(36), device: 'import' }, nowIso());
      persist();
      send(res, 200, Object.assign({ seq: state.seq }, stats));
      notify();
      return undefined;
    }
    if (req.method === 'GET' && p === '/api/backup') {
      return send(res, 200, JSON.stringify({ app: 'LabEntry', kind: 'labentry-server-backup', exportedAt: nowIso(), state }), { 'Content-Type': 'application/json; charset=utf-8' });
    }
    return send(res, 404, { error: 'không có API này' });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const remote = req.socket.remoteAddress;
      if (!o.allowAny && !isPrivateAddress(remote)) return send(res, 403, 'Chỉ nhận kết nối từ mạng nội bộ');
      if (!hostAllowed(req.headers.host)) return send(res, 421, 'Địa chỉ truy cập không hợp lệ');
      const url = new URL(req.url, 'http://x');
      const origin = req.headers.origin;
      const isApi = url.pathname.startsWith('/api/');
      if (origin) {
        if (!originAllowed(origin, req.headers.host)) return send(res, 403, 'Nguồn không được phép');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-LabEntry');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Max-Age', '600');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      if (isApi) {
        if (req.headers['x-labentry'] !== '1') return send(res, 403, { error: 'thiếu header X-LabEntry' });
        return await handleApi(req, res, url);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Không hỗ trợ');
      if (url.pathname === '/server') return send(res, 200, statusPage(), { 'Content-Type': 'text/html; charset=utf-8' });
      return serveStatic(req, res, url.pathname);
    } catch (e) {
      if (!res.headersSent) send(res, e && e.code === 413 ? 413 : (e && e.code === 400 ? 400 : 500), { error: e && e.message ? e.message : 'lỗi máy chủ' });
      else res.end();
    }
  });
  server.keepAliveTimeout = 65000;

  return {
    server,
    get state() { return state; },
    persist,
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(o.port, o.host, () => resolve(server.address().port));
      });
    },
    close() {
      return new Promise((resolve) => {
        waiters.forEach((w) => { clearTimeout(w.timer); w.fire(); });
        waiters.clear();
        try { if (server.closeAllConnections) server.closeAllConnections(); } catch (e) { /* bỏ qua */ }
        server.close(() => resolve());
      });
    },
  };
}

module.exports = { createLabServer, isPrivateAddress, lanAddresses };

if (require.main === module) {
  const port = parseInt(process.env.PORT || process.argv[2] || '8787', 10) || 8787;
  let lab;
  try {
    lab = createLabServer({ port, dataDir: process.env.LAB_DATA || path.join(__dirname, 'data'), allowAny: process.env.LAB_ALLOW_ANY === '1' });
  } catch (e) {
    console.error('LỖI: ' + e.message);
    process.exit(1);
  }
  lab.listen().then(() => {
    console.log('');
    console.log('==============================================');
    console.log(' LabEntry — MÁY CHỦ LAN đang chạy (v87)');
    console.log('==============================================');
    console.log(' Mở LabEntry trên các máy khác trong cùng mạng:');
    const ips = lanAddresses();
    if (ips.length) ips.forEach((ip) => console.log('    http://' + ip + ':' + port + '/'));
    else console.log('    (chưa thấy địa chỉ LAN — kiểm tra Wi-Fi / dây mạng)');
    console.log(' Trên máy này:  http://localhost:' + port + '/');
    console.log(' Trang trạng thái: http://localhost:' + port + '/server');
    console.log(' Dữ liệu lưu tại: ' + (process.env.LAB_DATA || path.join(__dirname, 'data')));
    console.log(' ĐỪNG ĐÓNG cửa sổ này khi còn đang làm việc.');
    console.log('');
  }).catch((e) => {
    console.error(e.code === 'EADDRINUSE' ? 'LỖI: cổng ' + port + ' đang bị chương trình khác dùng (có thể máy chủ LabEntry đã chạy sẵn).' : 'LỖI: ' + e.message);
    process.exit(1);
  });
  const stop = () => { try { lab.persist(); } catch (e) { /* bỏ qua */ } process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

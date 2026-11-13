'use strict';
/*
 * package-server.js — Đóng gói MÁY CHỦ LAN thành một thư mục giải nén-là-chạy:
 *   node tools/package-server.js [--out dist] [--node-exe <đường dẫn node.exe Windows>] [--zip]
 *
 * Kết quả: <out>/LabEntry-LAN/
 *   Chay-may-chu.bat · Mo-tuong-lua.bat · Tu-khoi-dong-cung-Windows.bat · HUONG-DAN.txt
 *   server/server.js (+ data/ tạo khi chạy) · sync-core.js · các file web của app · node/node.exe (nếu có --node-exe)
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const outDir = path.resolve(root, arg('--out') || 'dist');
const pkg = path.join(outDir, 'LabEntry-LAN');

const WEB_FILES = [
  'index.html', 'app.js', 'config.js', 'store.js', 'sync-core.js', 'sync.js', 'mascot.js', 'styles.css', 'print.css',
  'sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
];

function copy(rel, destRel) {
  const from = path.join(root, rel);
  const to = path.join(pkg, destRel || rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(pkg, { recursive: true, force: true });
fs.mkdirSync(pkg, { recursive: true });
WEB_FILES.forEach((f) => copy(f));
copy(path.join('server', 'server.js'), path.join('server', 'server.js'));
['Chay-may-chu.bat', 'Mo-tuong-lua.bat', 'Tu-khoi-dong-cung-Windows.bat'].forEach((f) => copy(path.join('server', f), f));
copy(path.join('server', 'HUONG-DAN.txt'), 'HUONG-DAN.txt');

const nodeExe = arg('--node-exe');
if (nodeExe) {
  if (!fs.existsSync(nodeExe)) { console.error('Không thấy ' + nodeExe); process.exit(1); }
  fs.mkdirSync(path.join(pkg, 'node'), { recursive: true });
  fs.copyFileSync(nodeExe, path.join(pkg, 'node', 'node.exe'));
}

/* .bat cần CRLF để cmd.exe đọc chắc chắn đúng */
fs.readdirSync(pkg).filter((f) => /\.(bat|txt)$/i.test(f)).forEach((f) => {
  const p = path.join(pkg, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'));
});

console.log('Đã đóng gói máy chủ LAN: ' + pkg + (nodeExe ? ' (kèm node.exe)' : ' (KHÔNG kèm node.exe — máy chủ cần cài Node.js)'));
if (process.argv.includes('--zip') && process.platform === 'win32') {
  const zip = path.join(outDir, 'LabEntry-LAN-Server.zip');
  fs.rmSync(zip, { force: true });
  const r = spawnSync('powershell', ['-NoProfile', '-Command', 'Compress-Archive -Path "' + pkg + '" -DestinationPath "' + zip + '"'], { stdio: 'inherit' });
  console.log(r.status === 0 ? 'Đã nén: ' + zip : 'Nén zip lỗi (có thể tự nén thư mục LabEntry-LAN).');
}

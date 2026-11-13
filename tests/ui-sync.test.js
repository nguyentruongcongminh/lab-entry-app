'use strict';
/* Test GIAO DIỆN đồng bộ LAN: trang LabEntry thật (jsdom) do chính máy chủ LAN phát qua http, hai "máy" mở song song.
   Chạy: node tests/ui-sync.test.js */
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const Core = require('../sync-core.js');
const { createLabServer } = require('../server/server.js');

let passed = 0;
const failures = [];
let chain = Promise.resolve();
function test(name, fn) {
  chain = chain.then(async () => {
    try { await fn(); passed += 1; console.log('PASS  ' + name); }
    catch (e) { failures.push(name); console.error('FAIL  ' + name + ': ' + (e && e.stack ? e.stack : e)); }
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond, what, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) { try { if (await cond()) return; } catch (e) { /* thử lại */ } await sleep(30); }
  throw new Error('quá hạn chờ: ' + what);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'labentry-uisync-'));

async function openPage(url, seed) {
  const alerts = [];
  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = globalThis.fetch.bind(globalThis);
      w.AbortController = globalThis.AbortController; /* fetch của Node chỉ nhận AbortSignal của Node, không nhận của jsdom */
      w.confirm = () => true;
      w.alert = (m) => { alerts.push(String(m)); };
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.scrollTo = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      Object.keys(seed || {}).forEach((k) => w.localStorage.setItem(k, seed[k]));
    },
  });
  const w = dom.window;
  await waitFor(() => w.document.readyState === 'complete' && w.eval('typeof labSync') !== 'undefined' && w.eval('labSync') !== null, 'trang nạp xong');
  return { dom, w, d: w.document, alerts, ev: (code) => w.eval(code), close: () => { try { w.labSyncStop && w.labSyncStop(); w.eval('labSync && labSync.disconnect()'); } catch (e) { /* bỏ qua */ } w.close(); } };
}

const STAFF = JSON.stringify([{ name: 'Lan', salt: '', pinHash: null, sig: '' }, { name: 'Mai', salt: '', pinHash: null, sig: '' }]);
const seed = (name) => ({ 'labentry.staff.v1': STAFF, 'labentry.operator.v1': name });

(async () => {
  const srv = createLabServer({ port: 0, host: '127.0.0.1', dataDir: tmp, quiet: true, appDir: path.join(__dirname, '..') });
  const port = await srv.listen();
  const url = 'http://127.0.0.1:' + port + '/';
  const text = (p, sel) => p.d.querySelector(sel).textContent;

  test('mở app bằng địa chỉ do máy chủ phát: TỰ nối, không cần cài đặt; thanh trạng thái hiện "Dùng chung dữ liệu"', async () => {
    const A = await openPage(url, seed('Lan'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online', 'A online');
    await waitFor(() => !A.d.getElementById('sync-bar').classList.contains('hidden') && A.d.getElementById('sync-bar').classList.contains('online'), 'thanh trạng thái hiện xanh');
    assert.ok(text(A, '#sync-bar-text').includes('Dùng chung dữ liệu'));
    assert.ok(text(A, '#sync-bar-text').includes('đã khớp'));
    A.close();
  });

  test('KTV tiếp nhận mẫu bằng form ở máy A -> máy B thấy ngay trong danh sách; B nhập kết quả + phát hành -> A thấy "Đã phát hành"', async () => {
    const A = await openPage(url, seed('Lan'));
    const B = await openPage(url, seed('Mai'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online' && B.ev('labSync.getStatus().mode') === 'online', 'cả hai online');
    A.d.getElementById('fab-add').click();
    A.d.getElementById('input-testid').value = 'UI-001';
    A.d.getElementById('select-type').value = 'cao-tim-nam';
    A.d.getElementById('select-type').dispatchEvent(new A.w.Event('change'));
    A.d.getElementById('btn-save').click();
    await waitFor(() => B.ev("store.getAll().some(r => r.testId === 'UI-001')"), 'B có mẫu UI-001', 5000);
    assert.strictEqual(B.ev("store.getAll().find(r => r.testId === 'UI-001').receiver"), 'Lan', 'đóng dấu KTV nhận của máy A sang máy B');
    /* B nhập kết quả (đúng như KTV dùng form) rồi phát hành */
    const uid = B.ev("store.getAll().find(r => r.testId === 'UI-001').uid");
    B.ev("openForm('" + uid + "')");
    const inp = B.d.querySelector('[data-field="ketQua"]');
    inp.value = 'Âm tính';
    inp.dispatchEvent(new B.w.Event('input'));
    B.d.getElementById('btn-save').click();
    await waitFor(() => A.ev("store.getAll().find(r => r.testId === 'UI-001').results.ketQua") === 'Âm tính', 'A thấy kết quả B nhập');
    assert.strictEqual(A.ev("store.getAll().find(r => r.testId === 'UI-001').performer"), 'Mai');
    B.ev("releaseFromSummary.call(null)"); /* không có summaryUid -> không làm gì */
    B.ev("openSummary('" + uid + "')");
    B.d.getElementById('btn-summary-release').click();
    await waitFor(() => A.ev("store.getAll().find(r => r.testId === 'UI-001').releaseAt") !== null, 'A thấy mẫu đã phát hành');
    assert.strictEqual(A.ev("store.statusOf(store.getAll().find(r => r.testId === 'UI-001'))"), 'released');
    assert.strictEqual(A.ev("store.getAll().find(r => r.testId === 'UI-001').releaser"), 'Mai');
    A.close(); B.close();
  });

  test('mẫu ĐÃ PHÁT HÀNH được bảo vệ ngay trên giao diện: nút xóa/sửa/phục hồi-thay-toàn-bộ đều bị chặn kèm lời giải thích', async () => {
    const A = await openPage(url, seed('Lan'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online', 'A online');
    await waitFor(() => A.ev("store.getAll().some(r => r.testId === 'UI-001' && r.releaseAt)"), 'A có mẫu đã phát hành');
    const uid = A.ev("store.getAll().find(r => r.testId === 'UI-001').uid");
    const before = A.ev("JSON.stringify(store.getByUid('" + uid + "'))");
    A.ev("toast = (m) => { window.__lastToast = m; }");
    A.ev("selectedUids.add('" + uid + "')");
    /* xóa từng mẫu qua nút trong danh sách */
    A.ev("handleListClick({ target: { closest: (s) => s === '[data-action]' ? { dataset: { action: 'delete', uid: '" + uid + "' } } : null } })");
    assert.ok(String(A.w.__lastToast).includes('đã phát hành') && String(A.w.__lastToast).includes('bảo vệ'), 'báo mẫu được bảo vệ');
    /* sửa qua form */
    A.ev("openForm('" + uid + "')");
    assert.ok(String(A.w.__lastToast).includes('đã phát hành'), 'không mở form sửa mẫu đã phát hành');
    assert.ok(A.d.getElementById('view-form').classList.contains('hidden'));
    /* xóa hàng loạt */
    A.ev("document.getElementById('btn-delete-selected').click()");
    /* phục hồi thay toàn bộ bị chặn */
    const ok = A.ev("importBackupText(store.exportBackup(), 'replace')");
    assert.strictEqual(ok, false);
    assert.ok(A.alerts.some((m) => m.includes('KHÔNG dùng được') && m.includes('Gộp dữ liệu')), 'giải thích bằng lời dễ hiểu');
    assert.strictEqual(A.ev("JSON.stringify(store.getByUid('" + uid + "'))"), before, 'mẫu không hề bị đổi');
    A.close();
  });

  test('mất kết nối: thanh trạng thái chuyển cam, KTV vẫn tiếp nhận mẫu; máy chủ bật lại -> tự khớp, thanh xanh lại', async () => {
    const A = await openPage(url, seed('Lan'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online', 'A online');
    await srv.close();
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'offline', 'A nhận ra mất kết nối', 40000);
    await waitFor(() => A.d.getElementById('sync-bar').classList.contains('offline'), 'thanh cam');
    assert.ok(text(A, '#sync-bar-text').includes('Mất mạng'));
    const res = A.ev("store.add({ testId: 'UI-OFF', typeId: 'cao-tim-nam', results: { ketQua: 'Âm tính' }, receiver: 'Lan' }).ok");
    assert.strictEqual(res, true, 'KTV vẫn tiếp nhận được khi mất kết nối');
    await waitFor(() => text(A, '#sync-bar-text').includes('1 thay đổi chờ gửi') || text(A, '#sync-bar-text').includes('thay đổi chờ gửi'), 'báo có thay đổi chờ gửi');
    const srv2 = createLabServer({ port, host: '127.0.0.1', dataDir: tmp, quiet: true, appDir: path.join(__dirname, '..') });
    await srv2.listen();
    srv.__replacement = srv2;
    await waitFor(() => Object.values(srv2.state.records).some((r) => r.testId === 'UI-OFF'), 'mẫu làm lúc offline lên được máy chủ', 40000);
    await waitFor(() => A.d.getElementById('sync-bar').classList.contains('online'), 'thanh xanh lại', 20000);
    assert.ok(text(A, '#sync-bar-text').includes('đã khớp'));
    A.close();
  });

  test('xung đột hiện bằng lời dễ hiểu; KTV bấm chọn "dùng bản của …" -> áp dụng cho mọi máy; xung đột biến mất', async () => {
    const srv2 = srv.__replacement;
    const A = await openPage(url, seed('Lan'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online', 'A online');
    A.ev("store.add({ testId: 'UI-CF', typeId: 'cao-tim-nam', results: {}, receiver: 'Lan' })");
    await waitFor(() => Object.values(srv2.state.records).some((r) => r.testId === 'UI-CF'), 'UI-CF lên máy chủ');
    const rec = Object.values(srv2.state.records).find((r) => r.testId === 'UI-CF');
    /* hai KTV cùng nhập một ô: đưa vào máy chủ hai op cùng base để tạo xung đột thật */
    const base0 = rec.rv; /* chụp trước: rec là đối tượng sống, rv đổi sau op đầu */
    Core.applyOp(srv2.state, { opId: 'x1', kind: 'update', uid: rec.uid, base: base0, set: { 'results.ketQua': 'Âm tính' }, deviceId: 'dB', operator: 'Mai' });
    Core.applyOp(srv2.state, { opId: 'x2', kind: 'update', uid: rec.uid, base: base0, set: { 'results.ketQua': 'Dương tính' }, deviceId: 'dC', operator: 'Hoa' });
    srv2.persist();
    A.ev('labSync.kick()');
    await sleep(100);
    A.d.getElementById('btn-sync').click();
    try { await waitFor(() => A.d.querySelectorAll('#sync-conflicts .sync-conflict').length === 1, 'hiện 1 xung đột (cần đợi nhịp kéo kế tiếp)', 25000); }
    catch (e) { throw new Error(e.message + ' | status=' + JSON.stringify(A.ev('labSync.getStatus()')) + ' | conflicts=' + A.ev('JSON.stringify(labSync.getConflicts())') + ' | srvConf=' + JSON.stringify(srv2.state.conflicts) + ' | html=' + A.d.getElementById('sync-conflicts').innerHTML.slice(0, 300)); }
    const card = text(A, '#sync-conflicts');
    assert.ok(card.includes('UI-CF'), 'nêu rõ mẫu nào');
    assert.ok(card.includes('KTV Hoa') && card.includes('Dương tính') && card.includes('Âm tính'), 'nêu ai nhập gì, đang lưu gì');
    assert.ok(card.includes('Giữ bản đang lưu') && card.includes('Dùng bản của Hoa'));
    assert.ok(A.d.getElementById('sync-bar').classList.contains('alert'), 'thanh trạng thái đỏ báo có xung đột');
    A.d.querySelector('[data-sync-resolve][data-choice="apply-mine"]').click();
    await waitFor(() => srv2.state.records[rec.uid].results.ketQua === 'Dương tính', 'máy chủ áp dụng bản đã chọn');
    await waitFor(() => A.ev("store.getAll().find(r => r.testId === 'UI-CF').results.ketQua") === 'Dương tính', 'A nhận bản đã chọn');
    await waitFor(() => A.d.querySelectorAll('#sync-conflicts .sync-conflict').length === 0, 'xung đột đã xử lý biến mất');
    A.close();
  });

  test('CẢ HAI MÁY ĐANG ONLINE, form của A mở từ trước: B lưu ô kết quả, A (đã thấy giá trị của B) rồi lưu ô đó với giá trị khác -> KHÔNG ghi đè im lặng', async () => {
    const srv2 = srv.__replacement;
    const A = await openPage(url, seed('Lan'));
    const B = await openPage(url, seed('Mai'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online' && B.ev('labSync.getStatus().mode') === 'online', 'cả hai online');
    A.ev("store.add({ testId: 'UI-RACE', typeId: 'cao-tim-nam', results: {}, receiver: 'Lan' })");
    await waitFor(() => B.ev("store.getAll().some(r => r.testId === 'UI-RACE')"), 'B thấy UI-RACE');
    const uid = A.ev("store.getAll().find(r => r.testId === 'UI-RACE').uid");
    A.ev("openForm('" + uid + "')");
    B.ev("openForm('" + uid + "')");
    const fb = B.d.querySelector('[data-field="ketQua"]');
    fb.value = 'Âm tính'; fb.dispatchEvent(new B.w.Event('input'));
    B.d.getElementById('btn-save').click();
    await waitFor(() => A.ev("store.getByUid('" + uid + "').results.ketQua") === 'Âm tính', 'A đã nhận giá trị của B (form của A vẫn mở)');
    assert.ok(!A.d.getElementById('view-form').classList.contains('hidden'), 'form của A vẫn đang mở');
    const fa = A.d.querySelector('[data-field="ketQua"]');
    fa.value = 'Dương tính'; fa.dispatchEvent(new A.w.Event('input'));
    A.d.getElementById('btn-save').click();
    await waitFor(() => srv2.state.conflicts.some((c) => c.status === 'open' && c.testId === 'UI-RACE'), 'máy chủ ghi nhận xung đột', 8000);
    await sleep(400);
    assert.strictEqual(srv2.state.records[uid].results.ketQua, 'Âm tính', 'giá trị đã lưu của B KHÔNG bị ghi đè');
    await waitFor(() => A.ev("store.getByUid('" + uid + "').results.ketQua") === 'Âm tính', 'A được đưa về bản chung');
    const cs = srv2.state.conflicts.filter((c) => c.status === 'open' && c.testId === 'UI-RACE');
    assert.strictEqual(cs.length, 1, 'đúng một xung đột');
    assert.strictEqual(cs[0].kind, 'field');
    const p = cs[0].paths.find((x) => x.path === 'results.ketQua');
    assert.ok(p && p.mine === 'Dương tính' && p.theirs === 'Âm tính', 'ghi rõ cả hai giá trị: ' + JSON.stringify(cs[0].paths));
    A.close(); B.close();
  });

  test('NHẬP THEO LÔ khi máy khác vừa nhập kết quả một mẫu trong lô đang mở: lưu lô KHÔNG xóa kết quả đó; nhập trùng ô vừa có -> xung đột', async () => {
    const srv2 = srv.__replacement;
    const A = await openPage(url, seed('Lan'));
    const B = await openPage(url, seed('Mai'));
    await waitFor(() => A.ev('labSync.getStatus().mode') === 'online' && B.ev('labSync.getStatus().mode') === 'online', 'cả hai online');
    ['LOT-1', 'LOT-2', 'LOT-3'].forEach((id) => A.ev("store.add({ testId: '" + id + "', typeId: 'sp', results: {}, receiver: 'Lan' })"));
    await waitFor(() => B.ev("store.getAll().filter(r => r.testId.indexOf('LOT-') === 0).length") === 3, 'B thấy 3 mẫu');
    const uidOf = (P, id) => P.ev("store.getAll().find(r => r.testId === '" + id + "').uid");
    const u1 = uidOf(A, 'LOT-1'), u2 = uidOf(A, 'LOT-2'), u3 = uidOf(A, 'LOT-3');
    A.ev("openBatch(); loadBatchType('sp'); renderBatch();");
    assert.ok(A.ev("batchState.uids.includes('" + u1 + "') && batchState.uids.includes('" + u3 + "')"), 'lô của A có LOT-1, LOT-3');
    /* B nhập kết quả cho LOT-1 và LOT-3 trong lúc lô của A đang mở */
    B.ev("store.update('" + u1 + "', { results: { hongCau: '(++)' } })");
    B.ev("store.update('" + u3 + "', { results: { hongCau: '(+)' } })");
    await waitFor(() => A.ev("store.getByUid('" + u1 + "').results.hongCau") === '(++)' && A.ev("store.getByUid('" + u3 + "').results.hongCau") === '(+)', 'A đã nhận kết quả của B');
    /* A nhập LOT-2 (mẫu khác) và nhập ĐÈ lên ô của LOT-3; không đụng LOT-1 */
    A.ev("batchState.work['" + u2 + "'].hongCau = '(+++)'");
    A.ev("batchState.work['" + u3 + "'].hongCau = '(+++)'");
    A.ev("saveBatch()");
    await waitFor(() => srv2.state.records[u2] && srv2.state.records[u2].results.hongCau === '(+++)', 'LOT-2 của A lên máy chủ');
    await sleep(500);
    assert.strictEqual(srv2.state.records[u1].results.hongCau, '(++)', 'kết quả B nhập cho LOT-1 KHÔNG bị xóa bởi lô của A');
    assert.strictEqual(srv2.state.records[u3].results.hongCau, '(+)', 'LOT-3: giá trị của B được giữ, không bị đè im lặng');
    assert.ok(srv2.state.conflicts.some((c) => c.status === 'open' && c.testId === 'LOT-3' && c.paths.some((p) => p.path === 'results.hongCau' && p.mine === '(+++)' && p.theirs === '(+)')), 'LOT-3 báo xung đột đủ hai giá trị');
    assert.ok(!srv2.state.conflicts.some((c) => c.testId === 'LOT-1'), 'LOT-1 không sinh xung đột (A không đụng tới)');
    A.close(); B.close();
  });

   test('PIN trên trang http (không có crypto.subtle): băm SHA-256 đúng chuẩn, kiểm tra PIN đúng/sai đúng, và PIN cũ kiểu SHA-256 từ máy khác vẫn dùng được', async () => {
    const A = await openPage(url, seed('Lan'));
    assert.strictEqual(A.ev("typeof crypto.subtle"), 'undefined', 'đúng môi trường không an toàn: không có crypto.subtle');
    const h = await A.ev("hashPin('abc123', 'salt1')");
    assert.strictEqual(h, crypto.createHash('sha256').update('salt1:abc123', 'utf8').digest('hex'), 'khớp SHA-256 chuẩn');
    A.ev("staffList.push({ name: 'Hoa', salt: 'salt1', pinHash: '" + h + "', sig: '' })");
    assert.strictEqual(await A.ev("verifyStaffPin('Hoa', 'abc123')"), true);
    assert.strictEqual(await A.ev("verifyStaffPin('Hoa', 'abc124')"), false);
    /* PIN băm kiểu dự phòng CŨ (v86, 16 hex) lưu trước đây vẫn kiểm tra được */
    const legacy = A.ev("legacyFallbackHash('s9:zzz999')");
    A.ev("staffList.push({ name: 'Cu', salt: 's9', pinHash: '" + legacy + "', sig: '' })");
    assert.strictEqual(await A.ev("verifyStaffPin('Cu', 'zzz999')"), true);
    A.close();
  });

  await chain;
  await (srv.__replacement ? srv.__replacement.close() : Promise.resolve());
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ }
  console.log('\nTỔNG: ' + passed + ' test giao diện đồng bộ đạt, ' + failures.length + ' lỗi.');
  if (failures.length) { console.error('Lỗi: ' + failures.join(' | ')); process.exit(1); }
  process.exit(0);
})();

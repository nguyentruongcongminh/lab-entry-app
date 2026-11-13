'use strict';
/* Test đầu-cuối đồng bộ LAN: máy chủ thật (cổng ngẫu nhiên) + nhiều máy khách dùng store.js/sync.js thật.
   Chạy: node tests/sync-e2e.test.js */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const LabStore = require('../store.js');
const LabSync = require('../sync.js');
const { getTestType, getTestTypes } = require('../config.js');
const { createLabServer, isPrivateAddress } = require('../server/server.js');

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
  const end = Date.now() + (ms || 6000);
  while (Date.now() < end) { if (await cond()) return; await sleep(25); }
  throw new Error('quá hạn chờ: ' + what);
}

const tmpRoots = [];
function tmpDir() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'labentry-test-')); tmpRoots.push(d); return d; }

async function startServer(dataDir) {
  const srv = createLabServer({ port: 0, host: '127.0.0.1', dataDir: dataDir || tmpDir(), quiet: true, appDir: path.join(__dirname, '..') });
  const port = await srv.listen();
  return { srv, url: 'http://127.0.0.1:' + port, port };
}

/* Máy khách giả: store thật + sync thật + mạng bật/tắt được */
function makeClient(name, url, seed, extra) {
  const storage = LabStore.memoryStorage();
  if (seed && seed.records) storage.setItem('labentry.records.v1', JSON.stringify(seed.records));
  const net = { up: true, dropNextPushResponse: false, notices: [], adoptAnswer: true };
  const bridge = { fn: null };
  const store = LabStore.createStore(storage, getTestType, { onChange: (e) => bridge.fn && bridge.fn(e) });
  const staff = (seed && seed.staff) ? seed.staff.slice() : [];
  const audit = [];
  let types = getTestTypes().slice();
  const fetchWrap = async (u, init) => {
    if (!net.up) throw new TypeError('fetch failed');
    const res = await ((extra && extra.fetch) || fetch)(u, init);
    if (!net.up) throw new TypeError('fetch failed (mất mạng khi đang chờ phản hồi)');
    if (net.dropNextPushResponse && String(u).endsWith('/api/push')) { net.dropNextPushResponse = false; await res.text(); throw new TypeError('fetch failed (mất mạng sau khi máy chủ đã xử lý)'); }
    return res;
  };
  const sync = LabSync.create({
    store, storage, fetch: fetchWrap, waitSec: (extra && extra.waitSec) || 1, backoffMaxMs: 80, sleep: (ms) => sleep(Math.min(ms, 40)),
    hooks: {
      getTypes: () => types, applyRemoteTypes: (l) => { types = l; },
      getStaff: () => staff, applyRemoteStaff: (items) => items.forEach((it) => {
        const i = staff.findIndex((s) => s.name.toLowerCase() === it.key);
        if (it.deleted) { if (i >= 0) staff.splice(i, 1); } else if (i >= 0) staff[i] = it.entry; else staff.push(it.entry);
      }),
      getAudit: () => audit, mergeAudit: (list) => list.forEach((e) => { if (!audit.some((a) => a.id === e.id)) audit.push(e); }),
      getOperator: () => name, onNotice: (m) => net.notices.push(m), confirmAdopt: async () => net.adoptAnswer,
    },
  });
  bridge.fn = sync.onStoreChange;
  const c = { name, store, sync, storage, net, staff, audit, url, get types() { return types; } };
  c.add = (testId, extra) => store.add(Object.assign({ testId, typeId: 'sp', results: {}, receiver: name }, extra || {}));
  c.live = () => store.getAll();
  c.find = (testId) => store.getAll().find((r) => r.testId === testId);
  return c;
}
async function connect(c) { const r = await c.sync.connect(c.url); assert.ok(r.ok, JSON.stringify(r)); return r; }
async function settle(srv, clients, ms) {
  await waitFor(() => clients.every((c) => c.sync.getQueue().length === 0 && c.sync.getState().since === srv.state.seq), 'hội tụ (hàng đợi rỗng + đã kéo hết)', ms || 8000);
}
const R = (v) => ({ ketQua: v });
const typed = (id) => ({ testId: id, typeId: 'cao-tim-nam', results: {}, receiver: 'x' });

(async () => {
  test('tiếp nhận ở máy A -> máy B, C thấy gần như ngay (không cần bấm gì)', async () => {
    const { srv, url } = await startServer();
    const [A, B, C] = ['A', 'B', 'C'].map((n) => makeClient(n, url));
    for (const c of [A, B, C]) await connect(c);
    const t0 = Date.now();
    A.add('S001');
    await waitFor(() => B.find('S001') && C.find('S001'), 'B,C thấy S001', 3000);
    assert.ok(Date.now() - t0 < 3000);
    assert.strictEqual(B.find('S001').receiver, 'A');
    for (const c of [A, B, C]) c.sync.disconnect();
    await srv.close();
  });

  test('B nhập kết quả, C phát hành: trạng thái mẫu thống nhất ở cả 3 máy', async () => {
    const { srv, url } = await startServer();
    const [A, B, C] = ['A', 'B', 'C'].map((n) => makeClient(n, url));
    for (const c of [A, B, C]) await connect(c);
    A.add('S002', { typeId: 'cao-tim-nam' });
    await waitFor(() => B.find('S002') && C.find('S002'), 'đã tới B, C');
    const b = B.store.update(B.find('S002').uid, { results: R('Âm tính'), performer: 'B' });
    assert.ok(b.ok, JSON.stringify(b));
    await waitFor(() => C.find('S002').results.ketQua === 'Âm tính', 'C thấy kết quả của B');
    assert.strictEqual(C.store.statusOf(C.find('S002')), 'pending-release');
    C.store.update(C.find('S002').uid, { releaseAt: new Date().toISOString(), releaser: 'C' });
    await settle(srv, [A, B, C]);
    for (const c of [A, B, C]) {
      const r = c.find('S002');
      assert.strictEqual(c.store.statusOf(r), 'released', 'máy ' + c.name);
      assert.strictEqual(r.releaser, 'C');
      assert.strictEqual(r.performer, 'B');
      assert.strictEqual(r.results.ketQua, 'Âm tính');
      assert.strictEqual(r.receiver, 'A');
    }
    for (const c of [A, B, C]) c.sync.disconnect();
    await srv.close();
  });

  test('mất mạng ở B: B vẫn làm việc; có mạng lại tự khớp, không mất dữ liệu, không bản ghi trùng', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.add('S010', { typeId: 'cao-tim-nam' });
    await waitFor(() => B.find('S010'), 'B thấy S010');
    B.net.up = false;
    await sleep(120);
    /* B ngoại tuyến: nhập kết quả mẫu có sẵn + tiếp nhận 2 mẫu mới */
    assert.ok(B.store.update(B.find('S010').uid, { results: R('Âm tính') }).ok);
    B.add('S011', { typeId: 'cao-tim-nam' });
    B.add('S012', { typeId: 'cao-tim-nam', results: R('Dương tính') });
    A.add('S013', { typeId: 'cao-tim-nam' });
    await sleep(250);
    assert.ok(!A.find('S011'), 'A chưa thấy mẫu của B khi B còn mất mạng');
    assert.ok(!B.find('S013'), 'B chưa thấy mẫu của A');
    assert.ok(B.sync.getStatus().pending >= 3);
    assert.strictEqual(B.find('S012').results.ketQua, 'Dương tính', 'KTV vẫn thấy dữ liệu vừa nhập');
    B.net.up = true;
    B.sync.kick();
    await settle(srv, [A, B], 10000);
    for (const c of [A, B]) {
      assert.deepStrictEqual(c.live().map((r) => r.testId).sort(), ['S010', 'S011', 'S012', 'S013'], 'máy ' + c.name);
    }
    assert.strictEqual(A.find('S010').results.ketQua, 'Âm tính');
    assert.strictEqual(A.find('S012').results.ketQua, 'Dương tính');
    assert.strictEqual(Object.keys(srv.state.records).length, 4);
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('mất mạng NGAY SAU khi máy chủ đã xử lý (mất phản hồi): gửi lại không tạo bản ghi trùng, không áp dụng hai lần', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.net.dropNextPushResponse = true;
    A.add('S020', { typeId: 'cao-tim-nam' });
    await waitFor(() => B.find('S020'), 'B nhận được dù A không thấy phản hồi', 5000);
    await settle(srv, [A, B], 10000);
    assert.strictEqual(A.live().filter((r) => r.testId === 'S020').length, 1);
    assert.strictEqual(B.live().filter((r) => r.testId === 'S020').length, 1);
    assert.strictEqual(Object.keys(srv.state.records).length, 1);
    const rv0 = srv.state.records[A.find('S020').uid].rv;
    A.net.dropNextPushResponse = true;
    A.store.update(A.find('S020').uid, { results: R('Âm tính') });
    await settle(srv, [A, B], 10000);
    assert.strictEqual(srv.state.records[A.find('S020').uid].rv, rv0 + 1, 'cập nhật chỉ áp dụng MỘT lần dù gửi lại');
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('xung đột MỚI tới mọi máy ngay (không phải chờ hết nhịp long-poll): máy B bị từ chối sửa mẫu đã phát hành -> máy A (đang treo long-poll 15 giây) thấy xung đột trong vài giây', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url, null, { waitSec: 15 }));
    for (const c of [A, B]) await connect(c);
    A.add('S200', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    await waitFor(() => B.find('S200'), 'B thấy S200');
    A.store.update(A.find('S200').uid, { releaseAt: new Date().toISOString(), releaser: 'A' });
    await settle(srv, [A, B], 8000);
    await sleep(300); /* cả hai đã quay lại treo long-poll mới */
    const t0 = Date.now();
    B.store.update(B.find('S200').uid, { results: R('Dương tính') });
    await waitFor(() => A.sync.getConflicts().length === 1, 'A thấy xung đột', 6000);
    assert.ok(Date.now() - t0 < 4000, 'xung đột tới A sau ' + (Date.now() - t0) + ' ms — phải gần như tức thì');
    assert.strictEqual(A.find('S200').results.ketQua, 'Âm tính');
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('hai máy ngoại tuyến cùng tiếp nhận một mã: sau khi nối lại chỉ còn MỘT bản ghi ở mọi máy', async () => {
    const { srv, url } = await startServer();
    const [A, B, C] = ['A', 'B', 'C'].map((n) => makeClient(n, url));
    for (const c of [A, B, C]) await connect(c);
    A.net.up = false; B.net.up = false;
    await sleep(100);
    A.add('X900', { typeId: 'cao-tim-nam' });
    B.add('X900', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    A.net.up = true; A.sync.kick();
    await sleep(150);
    B.net.up = true; B.sync.kick();
    await settle(srv, [A, B, C], 10000);
    for (const c of [A, B, C]) {
      const list = c.live().filter((r) => r.testId === 'X900');
      assert.strictEqual(list.length, 1, 'máy ' + c.name + ' có ' + list.length + ' bản');
      assert.strictEqual(list[0].results.ketQua, 'Âm tính', 'kết quả của máy B không bị mất');
    }
    assert.ok(B.net.notices.some((m) => m.includes('X900') && m.includes('tiếp nhận trước')), 'KTV máy B được báo bằng lời dễ hiểu');
    for (const c of [A, B, C]) c.sync.disconnect();
    await srv.close();
  });

  test('MẪU ĐÃ PHÁT HÀNH được bảo vệ: máy cũ ngoại tuyến sửa/xóa -> bị từ chối, kết quả phát hành không đổi, KTV được báo', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.add('S030', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    await waitFor(() => B.find('S030'), 'B thấy S030');
    B.net.up = false;
    await sleep(100);
    A.store.update(A.find('S030').uid, { releaseAt: new Date().toISOString(), releaser: 'A' });
    await waitFor(() => srv.state.records[A.find('S030').uid].releaseAt, 'đã phát hành trên máy chủ');
    /* B (chưa biết đã phát hành) sửa kết quả rồi cũng thử xóa mẫu khác nhau */
    B.store.update(B.find('S030').uid, { results: R('Dương tính') });
    B.net.up = true; B.sync.kick();
    await settle(srv, [A, B], 10000);
    assert.strictEqual(srv.state.records[A.find('S030').uid].results.ketQua, 'Âm tính');
    assert.strictEqual(B.find('S030').results.ketQua, 'Âm tính', 'B được kéo về đúng kết quả đã phát hành');
    assert.strictEqual(B.store.statusOf(B.find('S030')), 'released');
    assert.ok(B.net.notices.some((m) => m.includes('đã được phát hành')), 'KTV B được báo');
    assert.ok(srv.state.conflicts.some((c) => c.kind === 'edit-on-released' && c.paths.some((p) => p.path === 'results.ketQua' && p.mine === 'Dương tính')), 'giá trị của B vẫn lưu trong hộp xung đột (không mất): ' + JSON.stringify(srv.state.conflicts) + ' Q=' + JSON.stringify(B.sync.getQueue()));
    /* xóa từ máy B (đã biết trạng thái) cũng bị chặn */
    B.store.remove(B.find('S030').uid);
    await settle(srv, [A, B], 10000);
    assert.ok(A.find('S030') && B.find('S030'), 'mẫu đã phát hành vẫn còn ở cả hai máy');
    assert.ok(srv.state.records[A.find('S030').uid] && !srv.state.records[A.find('S030').uid].deleted);
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('hai KTV sửa CÙNG một ô: không ghi đè im lặng — giữ bản đến trước, bản kia vào mục Xung đột, KTV chọn được', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.add('S040', { typeId: 'cao-tim-nam' });
    await waitFor(() => B.find('S040'), 'B thấy S040');
    A.net.up = false; B.net.up = false;
    await sleep(100);
    A.store.update(A.find('S040').uid, { results: R('Âm tính') });
    B.store.update(B.find('S040').uid, { results: R('Dương tính') });
    A.net.up = true; A.sync.kick();
    await waitFor(() => srv.state.records[A.find('S040').uid].results.ketQua === 'Âm tính', 'A lên trước');
    B.net.up = true; B.sync.kick();
    await settle(srv, [A, B], 10000);
    assert.strictEqual(srv.state.records[A.find('S040').uid].results.ketQua, 'Âm tính');
    assert.strictEqual(B.find('S040').results.ketQua, 'Âm tính', 'B được đưa về bản chung');
    await waitFor(() => A.sync.getConflicts().length === 1 && B.sync.getConflicts().length === 1, 'cả hai máy đều thấy xung đột đang mở');
    const c = B.sync.getConflicts()[0];
    assert.strictEqual(c.paths[0].mine, 'Dương tính');
    assert.strictEqual(c.paths[0].theirs, 'Âm tính');
    await B.sync.resolveConflict(c.id, 'apply-mine');
    await settle(srv, [A, B], 10000);
    assert.strictEqual(A.find('S040').results.ketQua, 'Dương tính', 'KTV chọn dùng giá trị của mình -> áp dụng cho mọi máy');
    assert.strictEqual(A.sync.getConflicts().length, 0);
    for (const x of [A, B]) x.sync.disconnect();
    await srv.close();
  });

  test('sửa khác ô ở hai máy ngoại tuyến: tự gộp đủ cả hai, không xung đột', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.add('S050', { typeId: 'sp' });
    await waitFor(() => B.find('S050'), 'B thấy S050');
    A.net.up = false; B.net.up = false;
    await sleep(100);
    A.store.update(A.find('S050').uid, { results: { hongCau: '(+)' } });
    B.store.update(B.find('S050').uid, { results: { bachCau: '(++)' }, urgent: true });
    A.net.up = true; B.net.up = true; A.sync.kick(); B.sync.kick();
    await settle(srv, [A, B], 10000);
    for (const c of [A, B]) {
      const r = c.find('S050');
      assert.strictEqual(r.results.hongCau, '(+)', 'máy ' + c.name);
      assert.strictEqual(r.results.bachCau, '(++)', 'máy ' + c.name);
      assert.strictEqual(r.urgent, true);
      assert.strictEqual(c.sync.getConflicts().length, 0);
    }
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('phát hành khi máy khác vừa đổi kết quả (KTV chưa thấy): từ chối phát hành, mẫu vẫn Chờ phát hành', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.add('S060', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    await waitFor(() => B.find('S060'), 'B thấy S060');
    A.net.up = false; B.net.up = false;
    await sleep(100);
    A.store.update(A.find('S060').uid, { results: R('Dương tính') }); /* A sửa kết quả */
    B.store.update(B.find('S060').uid, { releaseAt: new Date().toISOString(), releaser: 'B' }); /* B phát hành bản cũ */
    A.net.up = true; A.sync.kick();
    await waitFor(() => srv.state.records[A.find('S060').uid].results.ketQua === 'Dương tính', 'A lên trước');
    B.net.up = true; B.sync.kick();
    await settle(srv, [A, B], 10000);
    const sr = srv.state.records[A.find('S060').uid];
    assert.strictEqual(sr.releaseAt, null, 'không phát hành kết quả mà người phát hành chưa thấy');
    assert.strictEqual(B.store.statusOf(B.find('S060')), 'pending-release');
    assert.strictEqual(B.find('S060').results.ketQua, 'Dương tính');
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('chuyển dữ liệu cũ: mỗi máy đã có sẵn dữ liệu cục bộ -> nối vào máy chủ không mất gì, không trùng; bản trùng khác nội dung vào xung đột', async () => {
    const { srv, url } = await startServer();
    const mkr = (uid, testId, results) => ({ uid, testId, typeId: 'cao-tim-nam', results, note: '', releaseAt: null, receiver: '', performer: '', releaser: '', urgent: false, createdAt: '2026-11-01T01:00:00.000Z', updatedAt: '2026-11-01T01:00:00.000Z' });
    const A = makeClient('A', url, { records: [mkr('a1', 'M1', R('Âm tính')), mkr('a2', 'M2', {}), mkr('a3', 'M3', R('Âm tính'))], staff: [{ name: 'Lan', salt: 's1', pinHash: 'h-lan', sig: '' }] });
    const B = makeClient('B', url, { records: [mkr('b1', 'M1', R('Âm tính')), mkr('b2', 'M3', R('Dương tính')), mkr('b3', 'M4', R('Âm tính'))], staff: [{ name: 'Mai', salt: 's2', pinHash: 'h-mai', sig: '' }] });
    await connect(A);
    await settle(srv, [A], 10000); /* A nạp xong trước, B nối sau -> thứ tự xác định */
    await connect(B);
    await settle(srv, [A, B], 10000);
    const keys = (c) => c.live().map((r) => r.testId).sort().join(',');
    assert.strictEqual(keys(A), 'M1,M2,M3,M4');
    assert.strictEqual(keys(B), 'M1,M2,M3,M4');
    assert.strictEqual(A.find('M1').results.ketQua, 'Âm tính');
    assert.strictEqual(Object.keys(srv.state.records).length, 4, 'M1 giống nhau gộp thành một, không nhân đôi');
    assert.strictEqual(A.find('M3').results.ketQua, 'Âm tính', 'bản đến trước được giữ');
    const conf = srv.state.conflicts.filter((c) => c.status === 'open' && c.kind === 'duplicate-intake' && !c.info);
    assert.strictEqual(conf.length, 1, 'M3 khác kết quả -> 1 xung đột để KTV chọn, không bỏ qua im lặng');
    assert.strictEqual(conf[0].incoming.results.ketQua, 'Dương tính');
    assert.deepStrictEqual(A.staff.map((s) => s.name).sort(), ['Lan', 'Mai'], 'danh sách KTV của hai máy được hợp');
    assert.deepStrictEqual(B.staff.map((s) => s.name).sort(), ['Lan', 'Mai']);
    assert.strictEqual(B.staff.find((s) => s.name === 'Lan').pinHash, 'h-lan', 'PIN băm đi theo KTV sang máy khác');
    assert.ok(A.storage.getItem('labentry.presync.backup.v1'), 'có bản lưu dự phòng dữ liệu cục bộ trước khi nối');
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('máy chủ khởi động lại: dữ liệu còn nguyên, máy khách tự nối lại và tiếp tục', async () => {
    const dir = tmpDir();
    let s = await startServer(dir);
    const A = makeClient('A', s.url);
    await connect(A);
    A.add('S070', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    await settle(s.srv, [A]);
    const before = JSON.stringify(Object.keys(s.srv.state.records));
    await s.srv.close();
    A.add('S071', { typeId: 'cao-tim-nam' }); /* làm việc khi máy chủ đang tắt */
    await sleep(150);
    assert.ok(A.sync.getStatus().pending >= 1);
    const s2 = createLabServer({ port: s.port, host: '127.0.0.1', dataDir: dir, quiet: true, appDir: path.join(__dirname, '..') });
    await s2.listen();
    assert.strictEqual(JSON.stringify(Object.keys(s2.state.records)), before, 'dữ liệu đọc lại từ đĩa');
    A.sync.kick();
    await waitFor(() => Object.keys(s2.state.records).length === 2, 'S071 lên máy chủ sau khi nó bật lại', 10000);
    assert.strictEqual(s2.state.serverId, s.srv.state.serverId);
    A.sync.disconnect();
    await s2.close();
  });

  test('máy chủ bị mất dữ liệu / thay máy chủ mới: mọi máy tự nạp lại dữ liệu của mình, không mất, không trùng', async () => {
    let s = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, s.url));
    await connect(A); await connect(B);
    A.add('S080', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    B.add('S081', { typeId: 'cao-tim-nam' });
    await settle(s.srv, [A, B]);
    await s.srv.close();
    const s2 = createLabServer({ port: s.port, host: '127.0.0.1', dataDir: tmpDir(), quiet: true, appDir: path.join(__dirname, '..') });
    await s2.listen();
    await waitFor(() => Object.keys(s2.state.records).length === 2, 'dữ liệu của A, B được nạp lại lên máy chủ mới', 12000);
    await settle(s2, [A, B], 12000);
    for (const c of [A, B]) assert.deepStrictEqual(c.live().map((r) => r.testId).sort(), ['S080', 'S081']);
    for (const c of [A, B]) c.sync.disconnect();
    await s2.close();
  });

  test('xóa mẫu chưa phát hành đồng bộ sang máy khác; máy cũ ngoại tuyến sửa mẫu đã bị xóa -> không làm sống lại, giá trị giữ ở xung đột', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.add('S090', { typeId: 'cao-tim-nam' });
    await waitFor(() => B.find('S090'), 'B thấy');
    B.net.up = false;
    await sleep(100);
    const uid90 = A.find('S090').uid;
    A.store.remove(uid90);
    await waitFor(() => srv.state.records[uid90] && srv.state.records[uid90].deleted, 'đã xóa trên máy chủ');
    B.store.update(uid90, { results: R('Âm tính') });
    B.net.up = true; B.sync.kick();
    await settle(srv, [A, B], 10000);
    assert.ok(!A.find('S090') && !B.find('S090'), 'bản ghi đã xóa không sống lại');
    assert.ok(srv.state.conflicts.some((c) => c.kind === 'edit-on-deleted' && c.paths.some((p) => p.path === 'results.ketQua' && p.mine === 'Âm tính')), JSON.stringify(srv.state.conflicts) + ' Q=' + JSON.stringify(B.sync.getQueue()) + ' ops=' + JSON.stringify(srv.state.ops));
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('nhiều máy thao tác dồn dập cùng lúc: dữ liệu hội tụ giống hệt nhau, không trùng, không mất', async () => {
    const { srv, url } = await startServer();
    const cs = ['A', 'B', 'C', 'D'].map((n) => makeClient(n, url));
    for (const c of cs) await connect(c);
    for (let i = 0; i < 12; i++) cs.forEach((c, k) => c.add('P' + k + '-' + i, { typeId: 'cao-tim-nam', results: i % 2 ? R('Âm tính') : {} }));
    await settle(srv, cs, 15000);
    const sig = (c) => c.live().map((r) => r.testId + ':' + (r.results.ketQua || '')).sort().join('|');
    assert.strictEqual(cs[0].live().length, 48);
    cs.forEach((c) => assert.strictEqual(sig(c), sig(cs[0]), 'máy ' + c.name + ' khác máy A'));
    assert.strictEqual(Object.keys(srv.state.records).length, 48);
    for (const c of cs) c.sync.disconnect();
    await srv.close();
  });

  test('KTV (tên + PIN băm) và danh mục xét nghiệm được chia sẻ giữa các máy', async () => {
    const { srv, url } = await startServer();
    const [A, B] = ['A', 'B'].map((n) => makeClient(n, url));
    for (const c of [A, B]) await connect(c);
    A.staff.push({ name: 'Hoa', salt: 'ss', pinHash: 'hash-hoa', sig: '' });
    A.sync.notifyStaff(A.staff);
    await waitFor(() => B.staff.some((s) => s.name === 'Hoa' && s.pinHash === 'hash-hoa'), 'KTV mới sang máy B');
    A.staff.length = 0;
    A.sync.notifyStaff(A.staff);
    await waitFor(() => B.staff.length === 0, 'xóa KTV cũng đồng bộ');
    for (const c of [A, B]) c.sync.disconnect();
    await srv.close();
  });

  test('bảo mật máy chủ: chặn thiếu header, Origin lạ, Host lạ, đường dẫn thoát thư mục; chỉ nhận địa chỉ nội bộ', async () => {
    const { srv, port } = await startServer();
    const req = (p, headers) => new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: headers || {} }, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ code: res.statusCode, body: b, headers: res.headers })); });
      r.on('error', reject); r.end();
    });
    assert.strictEqual((await req('/api/hello')).code, 403, 'thiếu X-LabEntry');
    assert.strictEqual((await req('/api/hello', { 'X-LabEntry': '1' })).code, 200);
    assert.strictEqual((await req('/api/hello', { 'X-LabEntry': '1', Origin: 'http://evil.example.com' })).code, 403, 'web lạ không gọi được');
    assert.strictEqual((await req('/api/hello', { 'X-LabEntry': '1', Origin: 'https://nguyentruongcongminh.github.io' })).code, 200);
    assert.strictEqual((await req('/api/hello', { 'X-LabEntry': '1', Host: 'evil.example.com' })).code, 421, 'chống DNS rebinding');
    assert.strictEqual((await req('/')).code, 200);
    assert.ok((await req('/')).body.includes('sync.js'));
    assert.strictEqual((await req('/server/server.js')).code, 404);
    assert.strictEqual((await req('/..%2Fserver%2Fserver.js')).code, 404);
    assert.strictEqual((await req('/data/state.json')).code, 404);
    assert.strictEqual((await req('/package.json')).code, 404);
    assert.strictEqual((await req('/server')).code, 200);
    assert.ok(isPrivateAddress('192.168.1.5') && isPrivateAddress('10.1.2.3') && isPrivateAddress('172.20.0.1') && isPrivateAddress('127.0.0.1') && isPrivateAddress('::ffff:192.168.0.9'));
    assert.ok(!isPrivateAddress('8.8.8.8') && !isPrivateAddress('172.32.0.1') && !isPrivateAddress('203.113.1.1') && !isPrivateAddress(''));
    await srv.close();
  });

  test('đường APK Android (app ở origin https GitHub Pages, máy chủ ở http LAN): preflight CORS + Private-Network đúng luật trình duyệt; máy khách đồng bộ được qua "trình duyệt giả lập CORS" cùng PC', async () => {
    const { srv, url, port } = await startServer();
    const APP_ORIGIN = 'https://nguyentruongcongminh.github.io'; /* origin của app trong vỏ APK (capacitor server.url) */
    const raw = (method, p, headers) => new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port, path: p, method, headers: headers || {} }, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ code: res.statusCode, body: b, h: res.headers })); });
      r.on('error', reject); r.end();
    });
    /* 1) Preflight đúng như WebView/Chromium gửi (header tùy biến X-LabEntry + Content-Type JSON + mạng riêng) */
    const pre = await raw('OPTIONS', '/api/push', {
      Origin: APP_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-labentry', 'Access-Control-Request-Private-Network': 'true',
    });
    assert.strictEqual(pre.code, 204);
    assert.strictEqual(pre.h['access-control-allow-origin'], APP_ORIGIN);
    assert.ok(/x-labentry/i.test(pre.h['access-control-allow-headers']) && /content-type/i.test(pre.h['access-control-allow-headers']));
    assert.ok(/POST/.test(pre.h['access-control-allow-methods']) && /GET/.test(pre.h['access-control-allow-methods']));
    assert.strictEqual(pre.h['access-control-allow-private-network'], 'true');
    const get = await raw('GET', '/api/hello', { Origin: APP_ORIGIN, 'X-LabEntry': '1' });
    assert.strictEqual(get.code, 200);
    assert.strictEqual(get.h['access-control-allow-origin'], APP_ORIGIN, 'phản hồi thật cũng phải cho phép origin của app');
    assert.strictEqual((await raw('OPTIONS', '/api/push', { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' })).code, 403, 'origin lạ bị chặn ngay ở preflight');
    /* 2) Máy khách "điện thoại" gọi máy chủ qua fetch tuân thủ CORS (preflight → kiểm tra ACAO) với Origin của app APK */
    const corsFetch = async (u, init) => {
      const target = new URL(u);
      const hdrs = Object.assign({}, init && init.headers);
      const needsPre = Object.keys(hdrs).some((k) => !['accept', 'accept-language', 'content-language'].includes(k.toLowerCase())) && true;
      if (needsPre) {
        const p = await raw('OPTIONS', target.pathname + target.search, {
          Origin: APP_ORIGIN, 'Access-Control-Request-Method': (init && init.method) || 'GET',
          'Access-Control-Request-Headers': Object.keys(hdrs).map((k) => k.toLowerCase()).sort().join(','), 'Access-Control-Request-Private-Network': 'true',
        });
        const allowH = String(p.h['access-control-allow-headers'] || '').toLowerCase();
        if (p.code !== 204 || p.h['access-control-allow-origin'] !== APP_ORIGIN || p.h['access-control-allow-private-network'] !== 'true' ||
          !Object.keys(hdrs).every((k) => allowH.includes(k.toLowerCase()))) throw new TypeError('CORS: preflight bị trình duyệt từ chối');
      }
      const res = await fetch(u, Object.assign({}, init, { headers: Object.assign({ Origin: APP_ORIGIN }, hdrs) }));
      if (res.headers.get('access-control-allow-origin') !== APP_ORIGIN) throw new TypeError('CORS: thiếu Access-Control-Allow-Origin');
      return res;
    };
    const phone = makeClient('Dien-thoai', url, null, { fetch: corsFetch });
    const pc = makeClient('PC', url);
    await connect(pc);
    const r = await phone.sync.connect(url);
    assert.ok(r.ok, JSON.stringify(r));
    const ph = phone.add('AND-1', { typeId: 'cao-tim-nam', results: R('Âm tính') });
    assert.ok(ph.ok);
    await waitFor(() => pc.find('AND-1'), 'PC thấy mẫu do điện thoại (origin APK) tiếp nhận', 6000);
    pc.store.update(pc.find('AND-1').uid, { releaseAt: new Date().toISOString(), releaser: 'PC' });
    await waitFor(() => { const x = phone.find('AND-1'); return x && x.releaseAt; }, 'điện thoại thấy PC đã phát hành', 6000);
    phone.store.update(phone.find('AND-1').uid, { results: R('Dương tính') }); /* điện thoại sửa mẫu đã phát hành: bị chặn */
    await settle(srv, [phone, pc], 8000);
    assert.strictEqual(pc.find('AND-1').results.ketQua, 'Âm tính', 'kết quả đã phát hành không đổi');
    assert.strictEqual(phone.find('AND-1').results.ketQua, 'Âm tính', 'điện thoại được đưa về bản đã phát hành');
    phone.sync.disconnect(); pc.sync.disconnect();
    await srv.close();
  });

  test('dữ liệu ghi nguyên tử: file state.json luôn đọc được, có bản .bak và sao lưu ngày', async () => {
    const dir = tmpDir();
    const { srv, url } = await startServer(dir);
    const A = makeClient('A', url);
    await connect(A);
    A.add('S100', { typeId: 'cao-tim-nam' });
    A.add('S101', { typeId: 'cao-tim-nam' });
    await settle(srv, [A]);
    A.add('S102', { typeId: 'cao-tim-nam' });
    await settle(srv, [A]);
    const st = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
    assert.strictEqual(Object.keys(st.records).length, 3);
    assert.ok(fs.existsSync(path.join(dir, 'state.json.bak')));
    assert.ok(fs.readdirSync(path.join(dir, 'backup')).some((f) => /^state-\d{4}-\d{2}-\d{2}\.json$/.test(f)));
    assert.ok(!fs.existsSync(path.join(dir, 'state.json.tmp')));
    A.sync.disconnect();
    await srv.close();
    /* file hỏng + có .bak: nạp từ .bak, KHÔNG khởi tạo rỗng */
    fs.writeFileSync(path.join(dir, 'state.json'), '{hỏng');
    const s2 = createLabServer({ port: 0, host: '127.0.0.1', dataDir: dir, quiet: true });
    assert.ok(Object.keys(s2.state.records).length >= 2, 'nạp lại được từ .bak');
    /* hỏng cả hai: báo lỗi, không ghi đè */
    fs.writeFileSync(path.join(dir, 'state.json.bak'), 'xx');
    fs.writeFileSync(path.join(dir, 'state.json'), 'xx');
    assert.throws(() => createLabServer({ port: 0, host: '127.0.0.1', dataDir: dir, quiet: true }), /bị hỏng/);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'), 'xx');
  });

  await chain;
  tmpRoots.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ } });
  console.log('\nTỔNG: ' + passed + ' test đồng bộ đầu-cuối đạt, ' + failures.length + ' lỗi.');
  if (failures.length) { console.error('Lỗi: ' + failures.join(' | ')); process.exit(1); }
  process.exit(0);
})();

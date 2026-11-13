'use strict';
/* Test lõi đồng bộ (sync-core.js): gộp, xung đột, bảo vệ mẫu đã phát hành, chống trùng, chống gửi lại.
   Chạy: node tests/sync-core.test.js */
const assert = require('node:assert');
const Core = require('../sync-core.js');

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; console.log('PASS  ' + name); }
  catch (e) { failures.push(name); console.error('FAIL  ' + name + ': ' + (e && e.stack ? e.stack : e)); }
}

let n = 0;
const T = (m) => '2026-11-13T08:' + String(m).padStart(2, '0') + ':00.000Z';
const op = (o) => Object.assign({ opId: 'op' + (++n), deviceId: 'dev' }, o);
const mk = (uid, testId, extra) => Object.assign({ uid, testId, typeId: 'sp', results: {}, createdAt: T(1), updatedAt: T(1) }, extra || {});
function fresh() { return Core.newState('srv'); }
function create(s, rec) { return Core.applyOp(s, op({ kind: 'create', rec }), T(2)); }
function upd(s, uid, base, set, extra) { return Core.applyOp(s, op(Object.assign({ kind: 'update', uid, base, set }, extra || {})), T(3)); }
const rec = (s, uid) => s.records[uid];

test('tạo mới: gán rv=1, đăng ký chỉ mục, bản ghi trả về không lộ `changed`', () => {
  const s = fresh();
  const r = create(s, mk('u1', 'A1'));
  assert.strictEqual(r.status, 'applied');
  assert.strictEqual(r.rec.rv, 1);
  assert.strictEqual(r.rec.changed, undefined);
  assert.strictEqual(s.seq, 1);
});

test('gửi lại cùng opId (mất mạng giữa chừng): KHÔNG áp dụng lần nữa, trả kết quả cũ', () => {
  const s = fresh();
  const o = op({ kind: 'create', rec: mk('u1', 'A1') });
  const a = Core.applyOp(s, o, T(2));
  const b = Core.applyOp(s, o, T(2));
  assert.strictEqual(a.status, 'applied');
  assert.strictEqual(b.replay, true);
  assert.strictEqual(Object.keys(s.records).length, 1);
  assert.strictEqual(s.seq, 1);
  const u = op({ kind: 'update', uid: 'u1', base: 1, set: { 'results.hongCau': '(+)' } });
  Core.applyOp(s, u, T(3)); Core.applyOp(s, u, T(3)); Core.applyOp(s, u, T(3));
  assert.strictEqual(rec(s, 'u1').rv, 2, 'cập nhật gửi 3 lần chỉ tăng rv một lần');
});

test('hai máy sửa KHÁC trường: tự gộp, không mất dữ liệu', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  const b = upd(s, 'u1', 1, { 'results.hongCau': '(++)' });
  const c = upd(s, 'u1', 1, { 'results.bachCau': '(+)' });
  assert.strictEqual(b.status, 'applied');
  assert.strictEqual(c.status, 'applied', 'máy C dựa trên bản cũ nhưng sửa trường khác -> vẫn nhận');
  assert.strictEqual(rec(s, 'u1').results.hongCau, '(++)');
  assert.strictEqual(rec(s, 'u1').results.bachCau, '(+)');
  assert.strictEqual(s.conflicts.length, 0);
});

test('hai máy sửa CÙNG trường: giữ bản đã có, bản của máy sau vào hộp xung đột (không ghi đè im lặng)', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  const r = upd(s, 'u1', 1, { 'results.ketQua': 'Dương tính' }, { operator: 'Lan' });
  assert.strictEqual(r.status, 'conflict');
  assert.strictEqual(rec(s, 'u1').results.ketQua, 'Âm tính');
  assert.strictEqual(s.conflicts.length, 1);
  const c = s.conflicts[0];
  assert.strictEqual(c.kind, 'field');
  assert.strictEqual(c.status, 'open');
  assert.deepStrictEqual(c.paths.map((p) => [p.path, p.mine, p.theirs]), [['results.ketQua', 'Dương tính', 'Âm tính']]);
  assert.strictEqual(c.operator, 'Lan');
});

test('sửa cùng giá trị ở hai máy: không coi là xung đột', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  const r = upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  assert.strictEqual(r.status, 'merged');
  assert.strictEqual(s.conflicts.length, 0);
});

test('sửa một phần xung đột: trường không đụng nhau vẫn được lưu, trường đụng nhau vào hộp xung đột', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.hongCau': '(+)' });
  const r = upd(s, 'u1', 1, { 'results.hongCau': '(+++)', 'results.bachCau': '(++)' });
  assert.strictEqual(r.status, 'partial');
  assert.strictEqual(rec(s, 'u1').results.hongCau, '(+)');
  assert.strictEqual(rec(s, 'u1').results.bachCau, '(++)');
  assert.strictEqual(s.conflicts[0].paths.length, 1);
});

test('MẪU ĐÃ PHÁT HÀNH: sửa kết quả từ máy khác bị từ chối, kết quả phát hành không đổi', () => {
  const s = fresh();
  create(s, mk('u1', 'A1', { results: { ketQua: 'Âm tính' } }));
  const rel = upd(s, 'u1', 1, { releaseAt: T(10), releaser: 'Mai' });
  assert.strictEqual(rel.status, 'applied');
  const snap = JSON.stringify(Core.publicRecord(rec(s, 'u1')));
  const r = upd(s, 'u1', 1, { 'results.ketQua': 'Dương tính' });
  assert.strictEqual(r.status, 'rejected');
  assert.strictEqual(r.reason, 'released');
  assert.strictEqual(JSON.stringify(Core.publicRecord(rec(s, 'u1'))), snap);
  assert.strictEqual(s.conflicts[0].kind, 'edit-on-released');
});

test('MẪU ĐÃ PHÁT HÀNH: xóa từ máy khác bị từ chối', () => {
  const s = fresh();
  create(s, mk('u1', 'A1', { results: { ketQua: 'Âm tính' } }));
  upd(s, 'u1', 1, { releaseAt: T(10), releaser: 'Mai' });
  const r = Core.applyOp(s, op({ kind: 'delete', uid: 'u1', base: 2 }), T(11));
  assert.strictEqual(r.status, 'rejected');
  assert.strictEqual(r.reason, 'released');
  assert.ok(!rec(s, 'u1').deleted);
  assert.strictEqual(s.conflicts[0].kind, 'delete-released');
});

test('phát hành lần hai ở máy khác: coi như đã xong, giữ nguyên người + giờ phát hành đầu tiên', () => {
  const s = fresh();
  create(s, mk('u1', 'A1', { results: { ketQua: 'Âm tính' } }));
  upd(s, 'u1', 1, { releaseAt: T(10), releaser: 'Mai' });
  const r = upd(s, 'u1', 1, { releaseAt: T(12), releaser: 'Hoa' });
  assert.strictEqual(r.status, 'merged');
  assert.strictEqual(rec(s, 'u1').releaser, 'Mai');
  assert.strictEqual(rec(s, 'u1').releaseAt, T(10));
  assert.strictEqual(s.conflicts.length, 0);
});

test('hủy phát hành có chủ đích (đúng phiên bản đã xem) được phép; dựa trên phiên bản cũ thì bị từ chối', () => {
  const s = fresh();
  create(s, mk('u1', 'A1', { results: { ketQua: 'Âm tính' } }));
  upd(s, 'u1', 1, { releaseAt: T(10), releaser: 'Mai' });
  const stale = upd(s, 'u1', 1, { releaseAt: null, releaser: '' });
  assert.strictEqual(stale.status, 'rejected', 'máy chưa thấy trạng thái đã phát hành không được hủy phát hành');
  assert.ok(rec(s, 'u1').releaseAt);
  const ok = upd(s, 'u1', 2, { releaseAt: null, releaser: '' });
  assert.strictEqual(ok.status, 'applied');
  assert.strictEqual(rec(s, 'u1').releaseAt, null);
});

test('phát hành khi người khác đã đổi KẾT QUẢ sau lúc KTV xem: từ chối phát hành (không phát hành bản chưa xem)', () => {
  const s = fresh();
  create(s, mk('u1', 'A1', { results: { ketQua: 'Âm tính' } }));
  upd(s, 'u1', 1, { 'results.ketQua': 'Dương tính' }); /* máy B đổi kết quả (rv=2) */
  const r = upd(s, 'u1', 1, { releaseAt: T(10), releaser: 'Mai' }); /* máy C phát hành theo bản rv=1 */
  assert.strictEqual(r.status, 'conflict');
  assert.strictEqual(rec(s, 'u1').releaseAt, null);
  assert.strictEqual(s.conflicts[0].paths[0].reason, 'content-changed');
});

test('xóa để lại bia mộ: máy cũ sửa bản ghi đã xóa -> từ chối, giữ dữ liệu của máy đó trong hộp xung đột', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  const d = Core.applyOp(s, op({ kind: 'delete', uid: 'u1', base: 1 }), T(5));
  assert.strictEqual(d.status, 'applied');
  const r = upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  assert.strictEqual(r.status, 'rejected');
  assert.strictEqual(r.reason, 'deleted');
  assert.strictEqual(s.conflicts[0].kind, 'edit-on-deleted');
  assert.strictEqual(s.conflicts[0].paths[0].mine, 'Âm tính');
});

test('xóa dựa trên phiên bản cũ (bản ghi đã bị người khác sửa): từ chối xóa', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  const r = Core.applyOp(s, op({ kind: 'delete', uid: 'u1', base: 1 }), T(5));
  assert.strictEqual(r.status, 'rejected');
  assert.ok(!rec(s, 'u1').deleted);
});

test('hai máy ngoại tuyến cùng tiếp nhận một mã: chỉ còn MỘT bản ghi, máy thứ hai nhận báo trùng', () => {
  const s = fresh();
  const a = create(s, mk('uA', 'X9', { receiver: 'Lan' }));
  const b = create(s, mk('uB', 'X9', { receiver: 'Mai' }));
  assert.strictEqual(a.status, 'applied');
  assert.strictEqual(b.replaces, 'uB');
  assert.strictEqual(b.uid, 'uA');
  assert.strictEqual(Object.values(s.records).filter((r) => !r.deleted).length, 1);
  assert.strictEqual(s.conflicts[0].kind, 'duplicate-intake');
  assert.strictEqual(s.conflicts[0].info, true, 'chỉ khác người nhận -> mục thông tin, không phải xung đột dữ liệu');
});

test('trùng mã nhưng bản đến sau có thêm kết quả: kết quả được điền vào bản ghi (không mất)', () => {
  const s = fresh();
  create(s, mk('uA', 'X9'));
  const b = create(s, mk('uB', 'X9', { results: { hongCau: '(+)' } }));
  assert.strictEqual(b.uid, 'uA');
  assert.strictEqual(rec(s, 'uA').results.hongCau, '(+)');
});

test('trùng mã, cả hai có kết quả KHÁC nhau: giữ bản đầu, bản sau vào hộp xung đột', () => {
  const s = fresh();
  create(s, mk('uA', 'X9', { results: { hongCau: '(+)' } }));
  const b = create(s, mk('uB', 'X9', { results: { hongCau: '(+++)' } }));
  assert.strictEqual(b.status, 'conflict');
  assert.strictEqual(rec(s, 'uA').results.hongCau, '(+)');
  const c = s.conflicts[0];
  assert.strictEqual(c.info, false);
  assert.strictEqual(c.incoming.results.hongCau, '(+++)');
});

test('bản trùng đã phát hành ở máy kia KHÔNG tự phát hành bản ghi chung', () => {
  const s = fresh();
  create(s, mk('uA', 'X9'));
  const b = create(s, mk('uB', 'X9', { results: { hongCau: '(+)' }, releaseAt: T(9), releaser: 'Mai' }));
  assert.strictEqual(rec(s, 'uA').releaseAt, null);
  assert.strictEqual(rec(s, 'uA').results.hongCau, '(+)');
  assert.strictEqual(b.status, 'conflict');
});

test('nội dung giống hệt (nạp sao lưu hai máy cùng có): gộp im lặng, không xung đột', () => {
  const s = fresh();
  create(s, mk('uA', 'X9', { results: { hongCau: '(+)' } }));
  const b = create(s, mk('uB', 'X9', { results: { hongCau: '(+)' }, createdAt: T(5) }));
  assert.strictEqual(b.status, 'merged');
  assert.strictEqual(b.replaces, 'uB');
  assert.strictEqual(s.conflicts.length, 0);
});

test('cùng ID nhưng KHÁC loại xét nghiệm: là hai bản ghi riêng', () => {
  const s = fresh();
  create(s, mk('uA', 'X9', { typeId: 'sp' }));
  const b = create(s, mk('uB', 'X9', { typeId: 'mau-an' }));
  assert.strictEqual(b.status, 'applied');
});

test('đổi ID thành mã đã có: bị chặn, không tạo trùng', () => {
  const s = fresh();
  create(s, mk('uA', 'X1'));
  create(s, mk('uB', 'X2'));
  const r = upd(s, 'uB', 1, { testId: 'X1' });
  assert.strictEqual(r.status, 'conflict');
  assert.strictEqual(rec(s, 'uB').testId, 'X2');
});

test('xóa xong tạo lại cùng mã được (bia mộ không chặn mã)', () => {
  const s = fresh();
  create(s, mk('uA', 'X1'));
  Core.applyOp(s, op({ kind: 'delete', uid: 'uA', base: 1 }), T(5));
  const b = create(s, mk('uB', 'X1'));
  assert.strictEqual(b.status, 'applied');
});

test('KTV chọn "dùng giá trị của tôi" cho xung đột: áp dụng nếu mẫu chưa phát hành, chặn nếu đã phát hành', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  upd(s, 'u1', 1, { 'results.ketQua': 'Dương tính' });
  const id = s.conflicts[0].id;
  const r = Core.resolveConflict(s, id, 'apply-mine', 'Lan', T(20));
  assert.ok(r.ok);
  assert.strictEqual(rec(s, 'u1').results.ketQua, 'Dương tính');
  assert.strictEqual(s.conflicts[0].status, 'resolved');
  /* conflict thứ hai trên mẫu đã phát hành */
  create(s, mk('u2', 'A2'));
  upd(s, 'u2', 1, { 'results.ketQua': 'Âm tính' });
  upd(s, 'u2', 1, { 'results.ketQua': 'Dương tính' });
  const id2 = s.conflicts[1].id;
  upd(s, 'u2', 2, { releaseAt: T(30), releaser: 'Mai' });
  const r2 = Core.resolveConflict(s, id2, 'apply-mine', 'Lan', T(31));
  assert.ok(!r2.ok);
  assert.strictEqual(r2.reason, 'released');
  assert.strictEqual(s.conflicts[1].status, 'open');
  assert.strictEqual(rec(s, 'u2').results.ketQua, 'Âm tính');
});

test('"giữ bản của máy chủ" chỉ đóng xung đột, không đổi dữ liệu', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  upd(s, 'u1', 1, { 'results.ketQua': 'Dương tính' });
  const r = Core.resolveConflict(s, s.conflicts[0].id, 'keep-server', 'Lan', T(20));
  assert.ok(r.ok);
  assert.strictEqual(rec(s, 'u1').results.ketQua, 'Âm tính');
  assert.strictEqual(s.conflicts[0].status, 'resolved');
});

test('khôi phục bản ghi đã bị xóa từ xung đột "sửa bản ghi đã xóa"', () => {
  const s = fresh();
  create(s, mk('u1', 'A1', { results: { ketQua: 'Âm tính' } }));
  Core.applyOp(s, op({ kind: 'delete', uid: 'u1', base: 1 }), T(5));
  upd(s, 'u1', 1, { note: 'đã kiểm tra lại' });
  const r = Core.resolveConflict(s, s.conflicts[0].id, 'apply-mine', 'Lan', T(20));
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(!rec(s, 'u1').deleted);
  assert.strictEqual(rec(s, 'u1').note, 'đã kiểm tra lại');
  assert.strictEqual(rec(s, 'u1').results.ketQua, 'Âm tính');
  assert.strictEqual(Core.changesSince(s, 0).records.filter((x) => x.uid === 'u1' && !x.deleted).length, 1);
});

test('changesSince: chỉ trả phần mới hơn mốc, kèm bia mộ, xung đột đang mở', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  create(s, mk('u2', 'A2'));
  const mark = s.seq;
  upd(s, 'u1', 1, { 'results.ketQua': 'Âm tính' });
  Core.applyOp(s, op({ kind: 'delete', uid: 'u2', base: 1 }), T(5));
  const ch = Core.changesSince(s, mark);
  assert.deepStrictEqual(ch.records.map((r) => [r.uid, !!r.deleted]), [['u1', false], ['u2', true]]);
  assert.strictEqual(Core.changesSince(s, s.seq).records.length, 0);
  assert.strictEqual(Core.changesSince(s, 0).records.length, 2);
});

test('danh mục xét nghiệm: ghi theo phiên bản; máy dựa trên bản cũ bị từ chối + giữ trong hộp xung đột', () => {
  const s = fresh();
  const L1 = [{ id: 'sp', name: 'SP', fields: [] }];
  const L2 = [{ id: 'sp', name: 'SP', fields: [] }, { id: 'x', name: 'X', fields: [] }];
  const a = Core.applyOp(s, op({ kind: 'types', base: 0, list: L1 }), T(2));
  assert.strictEqual(a.status, 'applied');
  const b = Core.applyOp(s, op({ kind: 'types', base: 1, list: L2 }), T(3));
  assert.strictEqual(b.status, 'applied');
  const c = Core.applyOp(s, op({ kind: 'types', base: 1, list: [{ id: 'y', name: 'Y', fields: [] }] }), T(4));
  assert.strictEqual(c.status, 'rejected');
  assert.strictEqual(s.types.list.length, 2);
  assert.strictEqual(s.conflicts[0].kind, 'types-conflict');
});

test('KTV (đồng bộ theo tên, bản mới hơn thắng, bản cũ không ghi đè); xóa KTV để lại dấu xóa', () => {
  const s = fresh();
  const e = (pin) => ({ name: 'Lan', salt: 's', pinHash: pin, sig: '' });
  Core.applyOp(s, op({ kind: 'staff', name: 'Lan', entry: e('h1'), ts: 100 }), T(1));
  const stale = Core.applyOp(s, op({ kind: 'staff', name: 'Lan', entry: e('hOLD'), ts: 50 }), T(2));
  assert.strictEqual(stale.status, 'merged');
  assert.strictEqual(s.staff.lan.entry.pinHash, 'h1');
  Core.applyOp(s, op({ kind: 'staff', name: 'lan', entry: e('h2'), ts: 200 }), T(3));
  assert.strictEqual(s.staff.lan.entry.pinHash, 'h2');
  Core.applyOp(s, op({ kind: 'staff', name: 'Lan', entry: null, ts: 300 }), T(4));
  assert.ok(s.staff.lan.deleted);
});

test('nhật ký thao tác: gộp theo mã dòng, không trùng', () => {
  const s = fresh();
  const entries = [{ id: 'a1', at: T(1), action: 'receive' }, { id: 'a2', at: T(2), action: 'save' }];
  Core.applyOp(s, op({ kind: 'audit', entries }), T(3));
  Core.applyOp(s, op({ kind: 'audit', entries: [entries[1], { id: 'a3', at: T(3), action: 'release' }] }), T(3));
  assert.deepStrictEqual(s.audit.map((x) => x.id), ['a1', 'a2', 'a3']);
});

test('nạp sao lưu cũ lên máy chủ: bản ghi giống nhau gộp, bản ghi KHÁC nội dung vào hộp xung đột (không bỏ qua im lặng)', () => {
  const s = fresh();
  create(s, mk('uA', 'X1', { results: { hongCau: '(+)' } }));
  const stats = Core.importRecords(s, [
    mk('i1', 'X1', { results: { hongCau: '(+)' } }), /* giống hệt */
    mk('i2', 'X1', { typeId: 'mau-an' }), /* khác loại -> bản ghi mới */
    mk('i3', 'X3'), /* mới */
    { uid: 'bad' }, /* hỏng */
  ], { batchId: 'b1' }, T(9));
  assert.deepStrictEqual(stats, { added: 2, same: 1, conflicts: 0, invalid: 1 });
  const stats2 = Core.importRecords(s, [mk('i9', 'X1', { results: { hongCau: '(+++)' } })], { batchId: 'b2' }, T(9));
  assert.strictEqual(stats2.conflicts, 1);
  assert.strictEqual(rec(s, 'uA').results.hongCau, '(+)');
});

test('dữ liệu rác từ máy khách bị làm sạch: trường lạ, kiểu sai không lọt vào bản ghi', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  const r = upd(s, 'u1', 1, { uid: 'hack', createdAt: 'x', rv: 99, '__proto__': 'x', 'results.a b': 'x', urgent: 'yes', note: 'ok' });
  assert.strictEqual(r.status, 'applied');
  assert.strictEqual(rec(s, 'u1').uid, 'u1');
  assert.strictEqual(rec(s, 'u1').rv, 2);
  assert.strictEqual(rec(s, 'u1').note, 'ok');
  assert.strictEqual(rec(s, 'u1').urgent, false);
  assert.ok(!('a b' in rec(s, 'u1').results));
});

test('diffRecords/applySet: chỉ ra đúng trường đổi, kể cả khóa kết quả thêm/bớt', () => {
  const a = mk('u1', 'A1', { results: { x: '1', y: '2' } });
  const b = mk('u1', 'A1', { results: { x: '1', y: '3', z: '4' }, note: 'n' });
  const d = Core.diffRecords(a, b);
  assert.deepStrictEqual(d, { note: 'n', 'results.y': '3', 'results.z': '4' });
  const c = Core.applySet(JSON.parse(JSON.stringify(a)), d);
  assert.deepStrictEqual(c.results, { x: '1', y: '3', z: '4' });
});

test('dấu vết tự động (giờ lưu kết quả, KTV thực hiện, hẹn giờ, KHẨN): hai máy cùng ghi không sinh xung đột; giờ muộn hơn thắng', () => {
  const s = fresh();
  create(s, mk('u1', 'A1'));
  upd(s, 'u1', 1, { 'results.hongCau': '(+)', resultAt: T(10), performer: 'Lan' });
  const r = upd(s, 'u1', 1, { 'results.bachCau': '(++)', resultAt: T(5), performer: 'Mai', urgent: true });
  assert.strictEqual(r.status, 'applied');
  assert.strictEqual(s.conflicts.length, 0);
  assert.strictEqual(rec(s, 'u1').resultAt, T(10), 'giữ giờ muộn hơn');
  assert.strictEqual(rec(s, 'u1').performer, 'Mai');
  assert.strictEqual(rec(s, 'u1').urgent, true);
});

console.log('\nTỔNG: ' + passed + ' test lõi đồng bộ đạt, ' + failures.length + ' lỗi.');
if (failures.length) { console.error('Lỗi: ' + failures.join(' | ')); process.exit(1); }

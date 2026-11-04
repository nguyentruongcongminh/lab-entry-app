'use strict';
/* Test logic nghiệp vụ (config + store) bằng Node:  node tests/logic.test.js */
const assert = require('node:assert');
const { LAB_CONFIG, getTestType } = require('../config.js');
const LabStore = require('../store.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS  ' + name);
}

const D = (s) => new Date(s);

/* ---------- Cấu hình 6 loại xét nghiệm ---------- */
test('config có đúng 6 loại xét nghiệm, id không trùng', () => {
  assert.strictEqual(LAB_CONFIG.testTypes.length, 6);
  const ids = LAB_CONFIG.testTypes.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, 6);
  ['Cạo tìm nấm', 'Soi nhuộm mực tàu DNT', 'Soi tinh thể dịch', 'Soi tươi huyết trắng', 'Máu ẩn', 'SP']
    .forEach((n) => assert.ok(LAB_CONFIG.testTypes.some((t) => t.name === n), n));
});

test('Soi tươi huyết trắng có đủ 9 trường đúng dạng', () => {
  const t = getTestType('soi-tuoi-huyet-trang');
  assert.strictEqual(t.fields.length, 9);
  const byKey = Object.fromEntries(t.fields.map((f) => [f.key, f]));
  assert.deepStrictEqual(byKey.nam.levels, ['(+)', '(++)', '(+++)']);
  assert.deepStrictEqual(byKey.tapTrung.levels, ['(+)', '(++)', '(+++)']);
  assert.deepStrictEqual(byKey.trichomonas.levels, ['(+)', '(++)', '(+++)']);
  assert.deepStrictEqual(byKey.hongCau.levels, ['(+)', '(++)', '(+++)']);
  assert.deepStrictEqual(byKey.clueCell.levels, ['(+)']);
  assert.deepStrictEqual(byKey.lactobacilli.levels, ['(+)', '(++)']);
  assert.strictEqual(byKey.bachCau.type, 'text');
  assert.strictEqual(byKey.teBao.type, 'text');
  assert.strictEqual(byKey.khac.type, 'text');
});

test('SP có 4 trường: 2 chips 3 mức + Ký sinh trùng + Khác', () => {
  const t = getTestType('sp');
  assert.strictEqual(t.fields.length, 4);
  const byKey = Object.fromEntries(t.fields.map((f) => [f.key, f]));
  assert.deepStrictEqual(byKey.hongCau.levels, ['(+)', '(++)', '(+++)']);
  assert.deepStrictEqual(byKey.bachCau.levels, ['(+)', '(++)', '(+++)']);
  assert.strictEqual(byKey.kySinhTrung.type, 'text');
  assert.strictEqual(byKey.khac.type, 'text');
});

test('3 loại đơn + Máu ẩn: mỗi loại 1 trường Kết quả dạng text', () => {
  ['cao-tim-nam', 'soi-muc-tau-dnt', 'soi-tinh-the-dich', 'mau-an'].forEach((id) => {
    const t = getTestType(id);
    assert.strictEqual(t.fields.length, 1, id);
    assert.strictEqual(t.fields[0].key, 'ketQua');
    assert.strictEqual(t.fields[0].type, 'text');
  });
});

/* ---------- Kiểm tra hợp lệ ---------- */
test('thiếu ID Xét Nghiệm -> không cho lưu', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: '   ', typeId: 'sp', results: {} });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length >= 1);
  assert.strictEqual(s.getAll().length, 0);
});

test('loại xét nghiệm không tồn tại -> không cho lưu', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: '2611041000', typeId: 'khong-co', results: {} });
  assert.strictEqual(r.ok, false);
});

/* ---------- Thêm + lưu trữ bền ---------- */
test('thêm kết quả và đọc lại từ storage (mô phỏng tải lại trang)', () => {
  const storage = LabStore.memoryStorage();
  const s1 = LabStore.createStore(storage, getTestType);
  const r = s1.add({ testId: '2611041225', typeId: 'soi-tuoi-huyet-trang', results: { nam: '(++)' } }, D('2026-11-04T07:52:00'));
  assert.strictEqual(r.ok, true);
  const s2 = LabStore.createStore(storage, getTestType);
  assert.strictEqual(s2.getAll().length, 1);
  assert.strictEqual(s2.getAll()[0].testId, '2611041225');
  assert.strictEqual(s2.getAll()[0].results.nam, '(++)');
});

/* ---------- Trạng thái (đặc tả F5) ---------- */
test('chưa nhập trường kết quả nào -> Chưa kết quả (ghi chú không tính)', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: 'A1', typeId: 'sp', results: { hongCau: '', kySinhTrung: '  ' }, note: 'có ghi chú' });
  assert.strictEqual(s.statusOf(r.record), 'no-result');
});

test('có kết quả, chưa phát hành -> Chờ phát hành', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: 'A2', typeId: 'sp', results: { hongCau: '(+)' } });
  assert.strictEqual(s.statusOf(r.record), 'pending-release');
});

test('có kết quả + ngày giờ phát hành -> Đã phát hành', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: 'A3', typeId: 'cao-tim-nam', results: { ketQua: 'Âm tính' }, releaseAt: '2026-11-04T09:00:00.000Z' });
  assert.strictEqual(s.statusOf(r.record), 'released');
});

/* ---------- Sửa / Xóa ---------- */
test('sửa kết quả làm đổi trạng thái; điền phát hành thì rời nhóm chờ', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: 'A4', typeId: 'mau-an', results: {} });
  assert.strictEqual(s.statusOf(r.record), 'no-result');
  const u1 = s.update(r.record.uid, { results: { ketQua: 'Dương tính' } });
  assert.strictEqual(u1.ok, true);
  assert.strictEqual(s.statusOf(u1.record), 'pending-release');
  const u2 = s.update(r.record.uid, { releaseAt: '2026-11-04T10:00:00.000Z' });
  assert.strictEqual(s.statusOf(u2.record), 'released');
  const bad = s.update('uid-khong-ton-tai', { results: {} });
  assert.strictEqual(bad.ok, false);
});

test('sửa mà xóa trắng ID -> bị chặn; xóa bản ghi hoạt động đúng', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r = s.add({ testId: 'A5', typeId: 'sp', results: { bachCau: '(+)' } });
  const bad = s.update(r.record.uid, { testId: ' ' });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(s.remove('khong-co'), false);
  assert.strictEqual(s.remove(r.record.uid), true);
  assert.strictEqual(s.getAll().length, 0);
});

/* ---------- Lọc / tìm kiếm ---------- */
test('lọc theo ID (một phần, không phân biệt hoa thường), loại, trạng thái, ngày', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  s.add({ testId: '2611041225', typeId: 'soi-tuoi-huyet-trang', results: { nam: '(+)' } }, D('2026-11-04T07:52:00'));
  s.add({ testId: '2611041050', typeId: 'soi-tuoi-huyet-trang', results: {} }, D('2026-11-04T07:55:00'));
  s.add({ testId: '2611041238', typeId: 'sp', results: { hongCau: '(+++)' }, releaseAt: '2026-11-04T08:30:00.000Z' }, D('2026-11-04T07:58:00'));
  s.add({ testId: '2611039999', typeId: 'sp', results: { khac: 'x' } }, D('2026-11-03T15:00:00'));

  assert.strictEqual(s.filter(null, { query: '41225' }).length, 1);
  assert.strictEqual(s.filter(null, { query: '261104' }).length, 3);
  assert.strictEqual(s.filter(null, { typeId: 'sp' }).length, 2);
  assert.strictEqual(s.filter(null, { status: 'no-result' }).length, 1);
  assert.strictEqual(s.filter(null, { status: 'pending-release' }).length, 2);
  assert.strictEqual(s.filter(null, { status: 'released' }).length, 1);
  assert.strictEqual(s.filter(null, { from: '2026-11-04', to: '2026-11-04' }).length, 3);
  assert.strictEqual(s.filter(null, { from: '2026-11-03', to: '2026-11-03' }).length, 1);
  assert.strictEqual(s.filter(null, { typeId: 'sp', from: '2026-11-04', to: '2026-11-04' }).length, 1);
});

/* ---------- Chặn trùng ID + loại XN ---------- */
test('cùng ID + cùng loại XN -> báo Đã tồn tại, không cho nhập', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const r1 = s.add({ testId: '2611041225', typeId: 'sp', results: { hongCau: '(+)' } });
  assert.strictEqual(r1.ok, true);
  const r2 = s.add({ testId: '2611041225', typeId: 'sp', results: { hongCau: '(++)' } });
  assert.strictEqual(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes('Đã tồn tại')));
  assert.strictEqual(s.getAll().length, 1);
  assert.ok(s.findDuplicate({ testId: '2611041225', typeId: 'sp' }));
  assert.strictEqual(s.findDuplicate({ testId: '2611041225', typeId: 'mau-an' }), null);
});

test('cùng ID nhưng khác loại XN -> vẫn nhập được; khác ID cùng loại -> được', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  assert.strictEqual(s.add({ testId: 'X1', typeId: 'sp', results: {} }).ok, true);
  assert.strictEqual(s.add({ testId: 'X1', typeId: 'mau-an', results: {} }).ok, true);
  assert.strictEqual(s.add({ testId: 'X2', typeId: 'sp', results: {} }).ok, true);
  assert.strictEqual(s.getAll().length, 3);
});

test('sửa: đổi sang ID+loại đã có của bản ghi khác -> bị chặn; sửa chính bản ghi đó -> được', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const a = s.add({ testId: 'Y1', typeId: 'sp', results: {} }).record;
  const b = s.add({ testId: 'Y2', typeId: 'mau-an', results: {} }).record;
  const clash = s.update(b.uid, { testId: 'Y1', typeId: 'sp' });
  assert.strictEqual(clash.ok, false);
  const self = s.update(a.uid, { results: { hongCau: '(+++)' } });
  assert.strictEqual(self.ok, true);
  assert.strictEqual(s.statusOf(self.record), 'pending-release');
});

test('timerEndsAt (đồng hồ bấm giờ): lưu khi thêm, giữ nguyên khi sửa trường khác, xóa khi đặt null', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const ends = new Date(Date.now() + 20 * 60000).toISOString();
  const a = s.add({ testId: 'T1', typeId: 'mau-an', results: {}, timerEndsAt: ends });
  assert.ok(a.ok);
  assert.strictEqual(a.record.timerEndsAt, ends);
  const u = s.update(a.record.uid, { note: 'ghi chú' });
  assert.ok(u.ok);
  assert.strictEqual(u.record.timerEndsAt, ends, 'sửa trường khác không được làm mất đồng hồ');
  const c = s.update(a.record.uid, { timerEndsAt: null });
  assert.ok(c.ok);
  assert.strictEqual(c.record.timerEndsAt, null);
});

/* ---------- Thống kê thời gian trả kết quả (F10) ---------- */
test('tatStats: chỉ tính mẫu đã phát hành, cho trung bình/min/max đúng; rỗng thì count 0', () => {
  const t0 = '2026-11-04T08:00:00.000Z';
  const plus = (iso, min) => new Date(new Date(iso).getTime() + min * 60000).toISOString();
  const stats = LabStore.tatStats([
    { createdAt: t0, releaseAt: plus(t0, 30) },
    { createdAt: t0, releaseAt: plus(t0, 90) },
    { createdAt: t0, releaseAt: null },
    { createdAt: t0, releaseAt: plus(t0, -5) },
  ]);
  assert.strictEqual(stats.count, 2);
  assert.strictEqual(stats.avgMinutes, 60);
  assert.strictEqual(stats.minMinutes, 30);
  assert.strictEqual(stats.maxMinutes, 90);
  assert.deepStrictEqual(LabStore.tatStats([]), { count: 0, avgMinutes: null, minMinutes: null, maxMinutes: null });
});

/* ---------- Sao lưu / phục hồi (F8) ---------- */
test('sao lưu: xuất JSON rồi phục hồi vào kho trống cho lại đúng dữ liệu (kể cả hẹn giờ + phát hành)', () => {
  const s1 = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const ends = new Date(Date.now() + 20 * 60000).toISOString();
  s1.add({ testId: 'BK1', typeId: 'mau-an', results: {}, timerEndsAt: ends });
  s1.add({ testId: 'BK2', typeId: 'sp', results: { hongCau: '(+)' }, releaseAt: '2026-11-04T09:00:00.000Z' });
  const text = s1.exportBackup(D('2026-11-04T10:00:00+07:00'));
  const meta = JSON.parse(text);
  assert.strictEqual(meta.app, 'LabEntry');
  assert.strictEqual(meta.records.length, 2);
  const s2 = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  const res = s2.importBackup(text);
  assert.strictEqual(res.count, 2);
  const all = s2.getAll();
  const bk1 = all.find((r) => r.testId === 'BK1');
  const bk2 = all.find((r) => r.testId === 'BK2');
  assert.strictEqual(bk1.timerEndsAt, ends, 'hẹn giờ phải còn nguyên sau phục hồi');
  assert.strictEqual(bk2.results.hongCau, '(+)');
  assert.strictEqual(s2.statusOf(bk2), 'released');
});

test('phục hồi THAY TOÀN BỘ dữ liệu hiện tại, không trộn với dữ liệu cũ', () => {
  const sA = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  sA.add({ testId: 'A-ONLY', typeId: 'sp', results: {} });
  const backup = sA.exportBackup();
  const sB = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  sB.add({ testId: 'B-OLD', typeId: 'sp', results: {} });
  sB.importBackup(backup);
  assert.deepStrictEqual(sB.getAll().map((r) => r.testId), ['A-ONLY'], 'dữ liệu cũ B-OLD phải bị thay hẳn');
});

test('file sao lưu hỏng/không hợp lệ bị từ chối và dữ liệu hiện tại không đổi', () => {
  const s = LabStore.createStore(LabStore.memoryStorage(), getTestType);
  s.add({ testId: 'KEEP', typeId: 'sp', results: {} });
  assert.throws(() => s.importBackup('{khong phai json'), /JSON/);
  assert.throws(() => s.importBackup(JSON.stringify({ records: [{ testId: 'X', typeId: 'loai-la' }] })), /loại xét nghiệm không hợp lệ/);
  assert.throws(() => s.importBackup(JSON.stringify({ records: [
    { testId: 'DUP', typeId: 'sp', results: {} },
    { testId: 'DUP', typeId: 'sp', results: {} },
  ] })), /trùng ID/);
  assert.throws(() => s.importBackup(JSON.stringify({ foo: 1 })), /danh sách bản ghi/);
  assert.deepStrictEqual(s.getAll().map((r) => r.testId), ['KEEP'], 'phục hồi thất bại không được đụng vào dữ liệu hiện tại');
});

console.log('\nTỔNG: ' + passed + ' test logic đạt, 0 lỗi.');

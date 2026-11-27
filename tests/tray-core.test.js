'use strict';
/* Test logic khay lưu mẫu F33 (tray-core) bằng Node:  node tests/tray-core.test.js */
const assert = require('node:assert');
const T = require('../tray-core.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS  ' + name);
}

const D = (s) => new Date(s);
const mk = (label, rows, cols, codes) => {
  const r = T.createTray({ label, rows, cols, createdBy: 'An' }, D('2026-11-27T08:00:00+07:00'), codes || []);
  assert.ok(r.ok, JSON.stringify(r));
  return r.tray;
};

/* ---------- Mã khay ---------- */
test('mã khay đúng dạng KH + yymmdd + -NN và tăng dần không trùng', () => {
  const c1 = T.makeTrayCode(D('2026-11-27T09:00:00+07:00'), []);
  assert.strictEqual(c1, 'KH261127-01');
  const c2 = T.makeTrayCode(D('2026-11-27T10:00:00+07:00'), [c1]);
  assert.strictEqual(c2, 'KH261127-02');
  const c3 = T.makeTrayCode(D('2026-11-27T10:00:00+07:00'), [c1, c2, 'KH261127-04']);
  assert.strictEqual(c3, 'KH261127-03'); /* lấy số trống đầu tiên */
  assert.ok(T.isTrayCode(c1));
  assert.ok(!T.isTrayCode('2611274734'));
  assert.ok(!T.isTrayCode('KH261127')); /* thiếu hậu tố */
});

/* ---------- Tạo khay ---------- */
test('tạo khay mặc định 4 hàng x 10 cột = 40 vị trí rỗng', () => {
  const tray = mk('NT');
  assert.strictEqual(tray.rows, 4);
  assert.strictEqual(tray.cols, 10);
  assert.strictEqual(tray.positions.length, 40);
  assert.ok(tray.positions.every((p) => p === null));
  assert.strictEqual(tray.label, 'NT');
  assert.strictEqual(T.countFilled(tray), 0);
  assert.strictEqual(T.capacity(tray), 40);
});

test('tạo khay từ chối kích thước sai', () => {
  assert.strictEqual(T.createTray({ rows: 0, cols: 10 }).ok, false);
  assert.strictEqual(T.createTray({ rows: 4, cols: 21 }).ok, false);
  assert.strictEqual(T.createTray({ rows: 2.5, cols: 10 }).ok, false);
  assert.strictEqual(T.createTray({ rows: 20, cols: 20 }).ok, true); /* 400 = đúng trần */
  assert.strictEqual(T.createTray({ rows: 20, cols: 20, label: 'x' }).tray.positions.length, 400);
});

test('nhãn khay được cắt khoảng trắng + giới hạn độ dài', () => {
  const tray = mk('  mẫu KSK+  ');
  assert.strictEqual(tray.label, 'mẫu KSK+');
  const long = mk('a'.repeat(200));
  assert.strictEqual(long.label.length, 80);
});

/* ---------- Vị trí ---------- */
test('posLabel/indexOfPos khớp nhau: ô chạy theo hàng', () => {
  const tray = mk('', 4, 10);
  assert.strictEqual(T.posLabel(tray, 0), 'H1-C1');
  assert.strictEqual(T.posLabel(tray, 9), 'H1-C10');
  assert.strictEqual(T.posLabel(tray, 10), 'H2-C1');
  assert.strictEqual(T.posLabel(tray, 39), 'H4-C10');
  assert.strictEqual(T.indexOfPos(tray, 2, 1), 10);
  assert.strictEqual(T.indexOfPos(tray, 4, 10), 39);
  assert.strictEqual(T.indexOfPos(tray, 5, 1), -1);
  assert.strictEqual(T.indexOfPos(tray, 1, 11), -1);
});

/* ---------- Cắm / rút / trùng / đầy ---------- */
test('cắm mẫu vào ô trống đầu tiên theo thứ tự, rút ra thì ô được dùng lại', () => {
  const trays = [mk('NT')];
  const code = trays[0].code;
  let r = T.placeSample(trays, code, '2611270001', { by: 'An' }, D('2026-11-27T09:00:00+07:00'));
  assert.deepStrictEqual(r, { ok: true, index: 0 });
  r = T.placeSample(trays, code, '2611270002', {}, D('2026-11-27T09:01:00+07:00'));
  assert.deepStrictEqual(r, { ok: true, index: 1 });
  assert.strictEqual(T.countFilled(trays[0]), 2);
  const removed = T.removeSample(trays, code, 0);
  assert.strictEqual(removed.sampleId, '2611270001');
  r = T.placeSample(trays, code, '2611270003', {}, D('2026-11-27T09:02:00+07:00'));
  assert.strictEqual(r.index, 0); /* ô vừa rút được dùng lại trước */
  assert.strictEqual(T.removeSample(trays, code, 5), null); /* ô trống */
  assert.strictEqual(T.removeSample(trays, 'KH000000-99', 0), null); /* sai mã khay */
});

test('trùng ID bị chặn ở MỌI khay, không phân biệt hoa thường', () => {
  const a = mk('NT');
  const b = mk('KSK');
  const trays = [a, b];
  T.placeSample(trays, a.code, 'B24-0008458', {}, D('2026-11-27T09:00:00+07:00'));
  const r = T.placeSample(trays, b.code, 'b24-0008458', {}, D('2026-11-27T09:05:00+07:00'));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'duplicate');
  assert.strictEqual(r.at.code, a.code);
  assert.strictEqual(r.at.index, 0);
  assert.strictEqual(T.countFilled(b), 0);
});

test('khay đầy thì báo full; ID rỗng và sai mã khay bị chặn', () => {
  const tray = mk('', 1, 2);
  const trays = [tray];
  T.placeSample(trays, tray.code, 'A1');
  T.placeSample(trays, tray.code, 'A2');
  assert.strictEqual(T.placeSample(trays, tray.code, 'A3').reason, 'full');
  assert.strictEqual(T.placeSample(trays, tray.code, '   ').reason, 'empty-id');
  assert.strictEqual(T.placeSample(trays, 'KH991231-01', 'A9').reason, 'no-tray');
  assert.ok(T.isFull(tray));
});

test('tìm mẫu ra đúng khay + vị trí; tìm gần-trùng 1 ký tự cho OCR', () => {
  const a = mk('NT');
  const b = mk('HT');
  const trays = [a, b];
  T.placeSample(trays, b.code, '2611264734');
  T.placeSample(trays, b.code, '2611269999');
  const hit = T.findSample(trays, '2611264734');
  assert.strictEqual(hit.tray.code, b.code);
  assert.strictEqual(hit.index, 0);
  assert.strictEqual(T.posLabel(hit.tray, hit.index), 'H1-C1');
  assert.strictEqual(T.findSample(trays, 'KHONGCO'), null);
  /* OCR đọc nhầm 1 số: 2611264734 -> 2511264734 */
  assert.strictEqual(T.findNearPlaced(trays, '2511264734'), '2611264734');
  assert.strictEqual(T.findNearPlaced(trays, '2611264734'), null); /* trùng hẳn thì không tính */
  assert.strictEqual(T.findNearPlaced(trays, '9999999999'), null);
});

test('hoàn tác: lastPlacedIndex là mẫu cắm gần nhất theo thời gian', () => {
  const tray = mk('');
  const trays = [tray];
  T.placeSample(trays, tray.code, 'S1', {}, D('2026-11-27T09:00:00+07:00'));
  T.placeSample(trays, tray.code, 'S2', {}, D('2026-11-27T09:10:00+07:00'));
  T.removeSample(trays, tray.code, 0);
  T.placeSample(trays, tray.code, 'S3', {}, D('2026-11-27T09:20:00+07:00')); /* vào lại ô 0 nhưng mới nhất */
  assert.strictEqual(T.lastPlacedIndex(tray), 0);
  assert.strictEqual(tray.positions[0].sampleId, 'S3');
});

/* ---------- Hủy mẫu / xóa khay ---------- */
test('hủy mẫu: khay rỗng lại, ghi lịch sử, dùng tiếp được', () => {
  const tray = mk('NT');
  const trays = [tray];
  T.placeSample(trays, tray.code, 'S1');
  T.placeSample(trays, tray.code, 'S2');
  const r = T.disposeTray(trays, tray.code, D('2026-12-05T08:00:00+07:00'), 'Bình');
  assert.deepStrictEqual(r, { ok: true, count: 2 });
  assert.strictEqual(T.countFilled(tray), 0);
  assert.strictEqual(tray.disposed.length, 1);
  assert.strictEqual(tray.disposed[0].count, 2);
  assert.strictEqual(tray.disposed[0].by, 'Bình');
  assert.strictEqual(T.findSample(trays, 'S1'), null); /* mẫu đã hủy không tìm ra nữa */
  assert.strictEqual(T.disposeTray(trays, tray.code).reason, 'empty');
  const again = T.placeSample(trays, tray.code, 'S9');
  assert.strictEqual(again.index, 0); /* khay dùng lại từ ô đầu */
});

test('xóa khay chỉ khi rỗng', () => {
  const tray = mk('');
  const trays = [tray];
  T.placeSample(trays, tray.code, 'S1');
  assert.strictEqual(T.deleteTray(trays, tray.code).reason, 'not-empty');
  T.removeSample(trays, tray.code, 0);
  assert.strictEqual(T.deleteTray(trays, tray.code).ok, true);
  assert.strictEqual(trays.length, 0);
});

/* ---------- Làm sạch dữ liệu ngoài ---------- */
test('sanitizeTrays bỏ khay hỏng, khử trùng mã, cắt vị trí thừa', () => {
  const good = mk('NT', 2, 3, []);
  good.positions[0] = { sampleId: ' S1 ', typeName: 'SP', at: '2026-11-27T02:00:00.000Z', by: 'An' };
  good.positions.push({ sampleId: 'THUA' }); /* vượt quá 6 ô -> bị cắt */
  const out = T.sanitizeTrays([good, { code: '' }, { code: 'KH1', rows: 0, cols: 3 }, good, null, 'x']);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].positions.length, 6);
  assert.strictEqual(out[0].positions[0].sampleId, 'S1');
  assert.strictEqual(T.sanitizeTrays(null).length, 0);
  assert.strictEqual(T.sanitizeTrays('khong-phai-mang').length, 0);
});

/* ---------- Code39 ---------- */
test('bảng Code39: mọi ký tự có đúng 9 phần tử và đúng 3 phần tử rộng', () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';
  chars.split('').forEach((ch) => {
    const pat = T.code39Pattern(ch);
    assert.ok(pat, 'thiếu ký tự ' + ch);
    assert.strictEqual(pat.length, 9, ch);
    assert.strictEqual(pat.split('').filter((c) => c === '1').length, 3, ch);
  });
  assert.strictEqual(T.code39Pattern('*'), '010010100'); /* ký tự bắt đầu/kết thúc chuẩn */
  assert.strictEqual(T.code39Pattern('A'), '100001001');
  assert.strictEqual(T.code39Pattern('0'), '000110100');
});

test('code39Segments: mã khay mã hóa được, tổng độ rộng đúng công thức', () => {
  const code = 'KH261127-01';
  assert.ok(T.isCode39Encodable(code));
  const segs = T.code39Segments(code);
  const chars = code.length + 2; /* + '*' hai đầu */
  assert.strictEqual(segs.length, chars * 9 + (chars - 1)); /* 9 phần tử/ký tự + khoảng cách giữa ký tự */
  /* mỗi ký tự: 3 rộng (5) + 6 hẹp (2) = 27 đơn vị; cộng khoảng cách 2 đơn vị giữa ký tự */
  const total = segs.reduce((s, x) => s + x.width, 0);
  assert.strictEqual(total, chars * 27 + (chars - 1) * 2);
  assert.strictEqual(segs[0].bar, true); /* bắt đầu bằng thanh */
  assert.strictEqual(T.code39Segments('mã@lạ'), null);
  assert.strictEqual(T.isCode39Encodable(''), false);
});

console.log('\n' + passed + ' tests tray-core PASS');

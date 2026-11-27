'use strict';
/*
 * tray-core.js — F33 (v120): logic THUẦN của tính năng Lưu/Tìm mẫu theo khay.
 * Chạy cả trên trình duyệt (window.LabTrayCore) và trong Node (module.exports)
 * để test tự động — cùng khuôn với store.js / sync-core.js.
 *
 * Bối cảnh nghiệp vụ (Minh chốt 2026-11-27): mẫu sau xét nghiệm được cắm vào
 * khay vật lý theo thứ tự, mỗi lần cắm thì bắn ID mẫu. Khay có hình dạng
 * hàng × cột (mặc định 4 hàng × 10 cột = 40 mẫu), có nhãn tự đặt (NT,
 * mẫu soi HT, mẫu KSK+…) và một mã khay duy nhất in thành barcode dán lên
 * khay. Tìm mẫu = tra ID -> ra khay + vị trí ô. Dữ liệu khay lưu TỪNG MÁY
 * (khóa labentry.trays.v1 ở app.js) + đi theo file sao lưu; CHƯA đồng bộ LAN.
 *
 * Khay (tray):
 *   {
 *     code: string,          // mã khay duy nhất, vd 'KH261127-01' — nội dung barcode in trên tem
 *     label: string,         // nhãn tự do của KTV ('' = chưa đặt, hiển thị bằng mã)
 *     rows: number, cols: number,
 *     createdAt: string,     // ISO
 *     createdBy: string,     // KTV tạo khay
 *     positions: Array<null | { sampleId, typeName, at, by }>,  // dài rows*cols, chạy theo hàng (H1-C1..H1-Cn, H2-C1..)
 *     disposed: Array<{ at, by, count }>,  // các lần hủy mẫu trong khay (khay rỗng lại, dùng tiếp)
 *   }
 */
const LabTrayCore = (() => {
  const MAX_DIM = 20;          // tối đa 20 hàng / 20 cột
  const MAX_CAPACITY = 400;    // tối đa 400 vị trí một khay
  const MAX_LABEL = 80;
  const DISPOSED_CAP = 50;     // giữ tối đa 50 lần hủy gần nhất mỗi khay

  function normalizeId(id) {
    return typeof id === 'string' ? id.trim() : '';
  }

  /* So khớp ID mẫu: bỏ khoảng trắng thừa + không phân biệt hoa thường
     (mã quét qua normalizeScanCode đã viết hoa; mã gõ tay có thể lẫn lộn) */
  function sameId(a, b) {
    const x = normalizeId(a);
    const y = normalizeId(b);
    return x !== '' && y !== '' && x.toUpperCase() === y.toUpperCase();
  }

  /* ---------- Mã khay ---------- */

  function isTrayCode(code) {
    return typeof code === 'string' && /^KH\d{6}-\d{2,}$/.test(code.trim().toUpperCase());
  }

  /* Mã khay: KH + yymmdd + '-' + số thứ tự 2 chữ số trong ngày, không trùng
     với bất kỳ mã nào đã có (kể cả khay đã tạo từ lâu — mã in trên tem vật lý
     phải duy nhất tuyệt đối). */
  function makeTrayCode(now, existingCodes) {
    const t = now || new Date();
    const p = (n) => String(n).padStart(2, '0');
    const base = 'KH' + String(t.getFullYear()).slice(2) + p(t.getMonth() + 1) + p(t.getDate()) + '-';
    const used = new Set((existingCodes || []).map((c) => String(c || '').toUpperCase()));
    for (let i = 1; i <= 999; i++) {
      const code = base + p(i);
      if (!used.has(code)) return code;
    }
    return base + String(Date.now() % 100000);
  }

  /* ---------- Tạo + kiểm tra khay ---------- */

  function createTray(input, now, existingCodes) {
    const t = now || new Date();
    const inp = input || {};
    const errors = [];
    const rows = inp.rows === undefined ? 4 : Number(inp.rows);
    const cols = inp.cols === undefined ? 10 : Number(inp.cols);
    if (!Number.isInteger(rows) || rows < 1 || rows > MAX_DIM) errors.push('Số hàng phải là số nguyên từ 1 đến ' + MAX_DIM);
    if (!Number.isInteger(cols) || cols < 1 || cols > MAX_DIM) errors.push('Số cột phải là số nguyên từ 1 đến ' + MAX_DIM);
    if (!errors.length && rows * cols > MAX_CAPACITY) errors.push('Khay tối đa ' + MAX_CAPACITY + ' vị trí');
    if (errors.length) return { ok: false, errors };
    const label = typeof inp.label === 'string' ? inp.label.trim().slice(0, MAX_LABEL) : '';
    return {
      ok: true,
      tray: {
        code: makeTrayCode(t, existingCodes),
        label,
        rows,
        cols,
        createdAt: t.toISOString(),
        createdBy: typeof inp.createdBy === 'string' ? inp.createdBy : '',
        positions: new Array(rows * cols).fill(null),
        disposed: [],
      },
    };
  }

  function sanitizePosition(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const sampleId = normalizeId(raw.sampleId);
    if (!sampleId) return null;
    return {
      sampleId,
      typeName: typeof raw.typeName === 'string' ? raw.typeName : '',
      at: (typeof raw.at === 'string' && !isNaN(Date.parse(raw.at))) ? raw.at : null,
      by: typeof raw.by === 'string' ? raw.by : '',
    };
  }

  /* Làm sạch 1 khay từ nguồn ngoài (file sao lưu / localStorage hỏng dở).
     Trả về null nếu khay không dùng được (thiếu mã, sai kích thước). */
  function sanitizeTray(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const code = typeof raw.code === 'string' ? raw.code.trim() : '';
    if (!code) return null;
    const rows = Number(raw.rows);
    const cols = Number(raw.cols);
    if (!Number.isInteger(rows) || rows < 1 || rows > MAX_DIM) return null;
    if (!Number.isInteger(cols) || cols < 1 || cols > MAX_DIM) return null;
    if (rows * cols > MAX_CAPACITY) return null;
    const cap = rows * cols;
    const positions = new Array(cap).fill(null);
    if (Array.isArray(raw.positions)) {
      for (let i = 0; i < Math.min(cap, raw.positions.length); i++) {
        positions[i] = sanitizePosition(raw.positions[i]);
      }
    }
    const disposed = [];
    if (Array.isArray(raw.disposed)) {
      raw.disposed.forEach((d) => {
        if (d && typeof d === 'object' && typeof d.at === 'string' && !isNaN(Date.parse(d.at))) {
          disposed.push({ at: d.at, by: typeof d.by === 'string' ? d.by : '', count: Number.isInteger(d.count) ? d.count : 0 });
        }
      });
    }
    return {
      code,
      label: typeof raw.label === 'string' ? raw.label.slice(0, MAX_LABEL) : '',
      rows,
      cols,
      createdAt: (typeof raw.createdAt === 'string' && !isNaN(Date.parse(raw.createdAt))) ? raw.createdAt : new Date().toISOString(),
      createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
      positions,
      disposed: disposed.slice(-DISPOSED_CAP),
    };
  }

  function sanitizeTrays(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach((raw) => {
      const tray = sanitizeTray(raw);
      if (!tray) return;
      const key = tray.code.toUpperCase();
      if (seen.has(key)) return; /* mã trùng: giữ khay đầu tiên */
      seen.add(key);
      out.push(tray);
    });
    return out;
  }

  /* ---------- Vị trí ---------- */

  function capacity(tray) { return tray.rows * tray.cols; }

  function countFilled(tray) {
    return tray.positions.reduce((n, p) => n + (p ? 1 : 0), 0);
  }

  function isFull(tray) { return countFilled(tray) >= capacity(tray); }

  /* Vị trí (hàng, cột) 1-based của ô thứ index (0-based, chạy theo hàng) */
  function posOf(tray, index) {
    return { row: Math.floor(index / tray.cols) + 1, col: (index % tray.cols) + 1 };
  }

  function posLabel(tray, index) {
    const p = posOf(tray, index);
    return 'H' + p.row + '-C' + p.col;
  }

  function indexOfPos(tray, row, col) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return -1;
    if (row < 1 || row > tray.rows || col < 1 || col > tray.cols) return -1;
    return (row - 1) * tray.cols + (col - 1);
  }

  function nextEmptyIndex(tray) {
    for (let i = 0; i < tray.positions.length; i++) {
      if (!tray.positions[i]) return i;
    }
    return -1;
  }

  /* Ô cắm gần nhất theo thời gian (để hoàn tác) — không có mốc giờ thì lấy
     ô có chỉ số lớn nhất đang có mẫu */
  function lastPlacedIndex(tray) {
    let best = -1;
    let bestAt = '';
    for (let i = 0; i < tray.positions.length; i++) {
      const p = tray.positions[i];
      if (!p) continue;
      const at = p.at || '';
      if (best < 0 || at >= bestAt) { best = i; bestAt = at; }
    }
    return best;
  }

  /* ---------- Tra cứu ---------- */

  function getTray(trays, code) {
    const c = normalizeId(code).toUpperCase();
    return (trays || []).find((t) => t.code.toUpperCase() === c) || null;
  }

  function findInTray(tray, sampleId) {
    for (let i = 0; i < tray.positions.length; i++) {
      const p = tray.positions[i];
      if (p && sameId(p.sampleId, sampleId)) return i;
    }
    return -1;
  }

  /* Tìm mẫu trong MỌI khay -> { tray, index, entry } hoặc null */
  function findSample(trays, sampleId) {
    if (!normalizeId(sampleId)) return null;
    for (const tray of trays || []) {
      const idx = findInTray(tray, sampleId);
      if (idx >= 0) return { tray, index: idx, entry: tray.positions[idx] };
    }
    return null;
  }

  /* Mẫu chỉ khác ĐÚNG 1 ký tự so với một ID ĐÃ CẮM (cùng độ dài) — dấu hiệu
     OCR đọc nhầm 1 chữ số, cùng bài học v119 ở khâu tiếp nhận. Trả về ID
     đã cắm gần trùng đầu tiên tìm thấy, hoặc null. */
  function findNearPlaced(trays, sampleId) {
    const id = normalizeId(sampleId).toUpperCase();
    if (!id) return null;
    for (const tray of trays || []) {
      for (const p of tray.positions) {
        if (!p) continue;
        const other = p.sampleId.toUpperCase();
        if (other.length !== id.length || other === id) continue;
        let diff = 0;
        for (let i = 0; i < id.length; i++) {
          if (other[i] !== id[i]) { diff += 1; if (diff > 1) break; }
        }
        if (diff === 1) return p.sampleId;
      }
    }
    return null;
  }

  /* ---------- Thao tác (ghi trực tiếp vào mảng trays, app tự lưu sau) ---------- */

  /* Cắm 1 mẫu vào ô trống đầu tiên của khay.
     Trả về { ok:true, index } hoặc { ok:false, reason, at? }:
       'no-tray'   — không có khay mã này
       'empty-id'  — ID rỗng
       'duplicate' — ID đã cắm ở đâu đó (at = { code, index } chỗ đang chứa)
       'full'      — khay đã đầy */
  function placeSample(trays, code, sampleId, meta, now) {
    const tray = getTray(trays, code);
    if (!tray) return { ok: false, reason: 'no-tray' };
    const id = normalizeId(sampleId);
    if (!id) return { ok: false, reason: 'empty-id' };
    const dup = findSample(trays, id);
    if (dup) return { ok: false, reason: 'duplicate', at: { code: dup.tray.code, index: dup.index } };
    const idx = nextEmptyIndex(tray);
    if (idx < 0) return { ok: false, reason: 'full' };
    const m = meta || {};
    tray.positions[idx] = {
      sampleId: id,
      typeName: typeof m.typeName === 'string' ? m.typeName : '',
      at: (now || new Date()).toISOString(),
      by: typeof m.by === 'string' ? m.by : '',
    };
    return { ok: true, index: idx };
  }

  /* Rút 1 mẫu khỏi ô — trả về entry đã rút hoặc null */
  function removeSample(trays, code, index) {
    const tray = getTray(trays, code);
    if (!tray) return null;
    if (!Number.isInteger(index) || index < 0 || index >= tray.positions.length) return null;
    const entry = tray.positions[index];
    if (!entry) return null;
    tray.positions[index] = null;
    return entry;
  }

  /* Hủy toàn bộ mẫu trong khay (đến hạn lưu): khay rỗng lại dùng tiếp,
     ghi 1 dòng vào tray.disposed. Trả về số mẫu đã hủy (0 nếu khay rỗng /
     không có khay -> ok:false). */
  function disposeTray(trays, code, now, by) {
    const tray = getTray(trays, code);
    if (!tray) return { ok: false, reason: 'no-tray', count: 0 };
    const count = countFilled(tray);
    if (count === 0) return { ok: false, reason: 'empty', count: 0 };
    tray.positions = tray.positions.map(() => null);
    tray.disposed.push({ at: (now || new Date()).toISOString(), by: typeof by === 'string' ? by : '', count });
    if (tray.disposed.length > DISPOSED_CAP) tray.disposed = tray.disposed.slice(-DISPOSED_CAP);
    return { ok: true, count };
  }

  /* Xóa hẳn 1 khay rỗng (chỉ khi không còn mẫu nào) */
  function deleteTray(trays, code) {
    const idx = (trays || []).findIndex((t) => t.code.toUpperCase() === normalizeId(code).toUpperCase());
    if (idx < 0) return { ok: false, reason: 'no-tray' };
    if (countFilled(trays[idx]) > 0) return { ok: false, reason: 'not-empty' };
    trays.splice(idx, 1);
    return { ok: true };
  }

  /* ---------- Barcode Code39 cho tem khay ----------
     Mã khay chỉ gồm chữ hoa, số và '-' — nằm trọn trong bộ ký tự Code39.
     Mỗi ký tự = 9 phần tử (thanh/khoảng xen kẽ, bắt đầu và kết thúc bằng
     thanh), đúng 3 phần tử rộng. Bảng mẫu chuẩn Code39 (0 = hẹp, 1 = rộng). */
  const CODE39 = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001',
    '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100',
    'A': '100001001', 'B': '001001001', 'C': '101001000', 'D': '000011001', 'E': '100011000',
    'F': '001011000', 'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011', 'O': '100010010',
    'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110',
    'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000',
    'Z': '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
  };

  function code39Pattern(ch) {
    return CODE39[ch] || null;
  }

  function isCode39Encodable(text) {
    return typeof text === 'string' && text.length > 0 &&
      text.split('').every((ch) => Object.prototype.hasOwnProperty.call(CODE39, ch));
  }

  /* Chuỗi module vẽ barcode (đơn vị hẹp = 2, rộng = 5, khoảng cách giữa 2 ký
     tự = 1 khoảng hẹp): trả về mảng các đoạn { bar:boolean, width:number }
     cho toàn bộ '*TEXT*' gồm cả ký tự bắt đầu/kết thúc. null nếu có ký tự
     không mã hóa được. */
  function code39Segments(text) {
    const s = String(text || '').toUpperCase();
    if (!isCode39Encodable(s)) return null;
    const full = '*' + s + '*';
    const out = [];
    full.split('').forEach((ch, ci) => {
      if (ci > 0) out.push({ bar: false, width: 2 }); /* khoảng cách giữa ký tự = 1 phần tử khoảng hẹp (2 đơn vị) */
      const pat = CODE39[ch];
      for (let i = 0; i < 9; i++) {
        out.push({ bar: i % 2 === 0, width: pat[i] === '1' ? 5 : 2 });
      }
    });
    return out;
  }

  return {
    MAX_DIM, MAX_CAPACITY,
    normalizeId, sameId, isTrayCode, makeTrayCode,
    createTray, sanitizeTray, sanitizeTrays,
    capacity, countFilled, isFull, posOf, posLabel, indexOfPos,
    nextEmptyIndex, lastPlacedIndex,
    getTray, findInTray, findSample, findNearPlaced,
    placeSample, removeSample, disposeTray, deleteTray,
    code39Pattern, isCode39Encodable, code39Segments,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LabTrayCore;
}

'use strict';
/*
 * store.js — Lưu trữ + logic nghiệp vụ của app LabEntry.
 * Chạy được cả trên trình duyệt (window.LabStore) và trong Node (module.exports)
 * để test tự động. Dữ liệu lưu bằng localStorage; khi test thì truyền bộ nhớ giả.
 *
 * Bản ghi (record):
 *   {
 *     uid: string,              // khóa nội bộ duy nhất
 *     testId: string,           // ID Xét Nghiệm do kỹ thuật viên nhập/quét
 *     typeId: string,           // id loại xét nghiệm (xem config.js)
 *     results: { fieldKey: string },  // giá trị từng trường; '' = chưa nhập/không chọn
 *     note: string,             // ghi chú chung
 *     releaseAt: string|null,   // ISO datetime phát hành; null = chưa phát hành
 *     receiver: string,         // KTV nhận mẫu (v27) — tên chụp tại lúc tạo bản ghi, '' = không ghi
 *     performer: string,        // KTV thực hiện (v27) — tên người trực lúc lưu kết quả gần nhất
 *     releaser: string,         // KTV phát hành (v27) — tên người trực lúc phát hành
 *     urgent: boolean,          // mẫu khẩn STAT (F24, v43) — ưu tiên xử lý/báo động trước
 *     createdAt: string,        // ISO datetime nhập
 *     updatedAt: string,        // ISO datetime sửa cuối
 *   }
 */
const LabStore = (() => {
  const STORAGE_KEY = 'labentry.records.v1';

  function memoryStorage() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }

  function defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') {
        const probe = '__labentry_probe__';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return localStorage;
      }
    } catch (e) { /* localStorage bị chặn -> dùng bộ nhớ tạm */ }
    return memoryStorage();
  }

  let uidCounter = 0;
  function makeUid(now) {
    uidCounter += 1;
    return 'r' + now.getTime().toString(36) + uidCounter.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  /*
   * opts.onChange(evt) — v87 (đồng bộ LAN): được gọi SAU KHI đã lưu cục bộ, với
   *   { kind: 'create'|'update'|'delete', uid, before, after } (before/after là bản ghi trước/sau, hoặc null).
   * Thay đổi do máy chủ gửi về (applyRemote/removeLocal) KHÔNG phát sự kiện này.
   */
  function createStore(storage, getTestTypeFn, opts) {
    const store = storage || defaultStorage();
    const onChange = opts && typeof opts.onChange === 'function' ? opts.onChange : null;
    let records = load();

    function emit(kind, uid, before, after) {
      if (!onChange) return;
      try { onChange({ kind, uid, before: before || null, after: after || null }); } catch (e) { /* lỗi bên đồng bộ không được làm hỏng thao tác của KTV */ }
    }

    function load() {
      try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function persist() {
      store.setItem(STORAGE_KEY, JSON.stringify(records));
    }

    /* Trùng = đã có bản ghi KHÁC cùng ID Xét Nghiệm + cùng loại xét nghiệm */
    function findDuplicate(rec, excludeUid) {
      if (!rec || typeof rec.testId !== 'string') return null;
      const id = rec.testId.trim();
      if (!id) return null;
      return records.find((r) => r.uid !== excludeUid && r.testId.trim() === id && r.typeId === rec.typeId) || null;
    }

    function validate(rec, excludeUid) {
      const errors = [];
      if (!rec || typeof rec.testId !== 'string' || rec.testId.trim() === '') {
        errors.push('Thiếu ID Xét Nghiệm');
      }
      if (!rec || !getTestTypeFn(rec.typeId)) {
        errors.push('Loại xét nghiệm không hợp lệ');
      }
      if (errors.length === 0 && findDuplicate(rec, excludeUid)) {
        const type = getTestTypeFn(rec.typeId);
        errors.push('Đã tồn tại: ID ' + rec.testId.trim() + ' đã có kết quả loại "' + (type ? type.name : rec.typeId) + '". Không nhập trùng được.');
      }
      return errors;
    }

    function add(input, now) {
      const t = now || new Date();
      const rec = {
        uid: makeUid(t),
        testId: (input.testId || '').trim(),
        typeId: input.typeId,
        results: Object.assign({}, input.results || {}),
        note: input.note || '',
        releaseAt: input.releaseAt || null,
        receiver: typeof input.receiver === 'string' ? input.receiver : '',
        performer: typeof input.performer === 'string' ? input.performer : '',
        releaser: typeof input.releaser === 'string' ? input.releaser : '',
        urgent: input.urgent === true, /* mẫu khẩn STAT (F24): ưu tiên xử lý */
        deferReason: typeof input.deferReason === 'string' ? input.deferReason : '', /* F37: '' = không hẹn lại; 'hut-mau' | 'khong-dat' | 'khac' */
        deferNote: typeof input.deferNote === 'string' ? input.deferNote : '',
        deferAt: input.deferAt || null,
        /* F38: ngày giờ lưu kết quả (= giờ thực hiện XN trên sổ theo dõi);
           tạo mới đã có kết quả thì đóng dấu ngay */
        resultAt: input.resultAt || (hasResult({ typeId: input.typeId, results: input.results || {} }) ? t.toISOString() : null),
        timerEndsAt: input.timerEndsAt || null,
        createdAt: t.toISOString(),
        updatedAt: t.toISOString(),
      };
      const errors = validate(rec);
      if (errors.length) return { ok: false, errors };
      records.push(rec);
      persist();
      emit('create', rec.uid, null, rec);
      return { ok: true, record: rec };
    }

    function update(uid, input, now) {
      const t = now || new Date();
      const idx = records.findIndex((r) => r.uid === uid);
      if (idx < 0) return { ok: false, errors: ['Không tìm thấy kết quả'] };
      const rec = Object.assign({}, records[idx], {
        testId: (input.testId !== undefined ? input.testId : records[idx].testId || '').trim(),
        typeId: input.typeId !== undefined ? input.typeId : records[idx].typeId,
        results: input.results !== undefined ? Object.assign({}, input.results) : records[idx].results,
        note: input.note !== undefined ? input.note : records[idx].note,
        releaseAt: input.releaseAt !== undefined ? input.releaseAt : records[idx].releaseAt,
        receiver: input.receiver !== undefined ? input.receiver : (records[idx].receiver || ''),
        performer: input.performer !== undefined ? input.performer : (records[idx].performer || ''),
        releaser: input.releaser !== undefined ? input.releaser : (records[idx].releaser || ''),
        urgent: input.urgent !== undefined ? !!input.urgent : !!records[idx].urgent,
        /* F37: dấu hẹn lại — không truyền thì giữ nguyên, truyền thì thay */
        deferReason: input.deferReason !== undefined ? input.deferReason : (records[idx].deferReason || ''),
        deferNote: input.deferNote !== undefined ? input.deferNote : (records[idx].deferNote || ''),
        deferAt: input.deferAt !== undefined ? input.deferAt : (records[idx].deferAt || null),
        /* F38: mỗi lần lưu CÓ kết quả -> cập nhật giờ lưu kết quả; lưu mà
           xóa hết kết quả -> xóa dấu giờ; không đụng kết quả -> giữ nguyên */
        resultAt: input.resultAt !== undefined ? input.resultAt
          : (input.results !== undefined
            ? (hasResult({ typeId: input.typeId !== undefined ? input.typeId : records[idx].typeId, results: input.results }) ? t.toISOString() : null)
            : (records[idx].resultAt || null)),
        timerEndsAt: input.timerEndsAt !== undefined ? input.timerEndsAt : (records[idx].timerEndsAt || null),
        updatedAt: t.toISOString(),
      });
      const errors = validate(rec, uid);
      if (errors.length) return { ok: false, errors };
      const prevRec = records[idx];
      records[idx] = rec;
      persist();
      emit('update', uid, prevRec, rec);
      return { ok: true, record: rec };
    }

    function remove(uid) {
      const prevRec = records.find((r) => r.uid === uid) || null;
      const before = records.length;
      records = records.filter((r) => r.uid !== uid);
      if (records.length !== before) { persist(); emit('delete', uid, prevRec, null); }
      return records.length !== before;
    }

    /* ---------- Đồng bộ LAN (v87): ghi thay đổi từ máy chủ, KHÔNG kiểm tra trùng, KHÔNG phát sự kiện ---------- */
    function applyRemote(list) {
      let changed = 0;
      (list || []).forEach((r) => {
        if (!r || typeof r.uid !== 'string') return;
        const idx = records.findIndex((x) => x.uid === r.uid);
        if (r.deleted) { if (idx >= 0) { records.splice(idx, 1); changed += 1; } return; }
        const copy = Object.assign({}, r, { results: Object.assign({}, r.results || {}) });
        delete copy.deleted;
        if (idx >= 0) records[idx] = copy; else records.push(copy);
        changed += 1;
      });
      if (changed) persist();
      return changed;
    }
    function removeLocal(uid) {
      const before = records.length;
      records = records.filter((r) => r.uid !== uid);
      if (records.length !== before) persist();
      return records.length !== before;
    }
    /* Quên dấu phiên bản máy chủ (khi nối sang máy chủ mới): mọi bản ghi coi như chưa từng đồng bộ */
    function clearSyncMeta() {
      records.forEach((r) => { delete r.rv; delete r.seq; });
      persist();
    }

    function getAll() {
      return records.slice();
    }

    /* ---------- Sao lưu / phục hồi (F8) ----------
       Sao lưu = 1 file JSON chứa toàn bộ bản ghi. Phục hồi = THAY TOÀN BỘ
       dữ liệu hiện tại bằng dữ liệu trong file (sau khi đã kiểm tra hợp lệ). */

    function exportBackup(now) {
      const t = now || new Date();
      return JSON.stringify({
        app: 'LabEntry',
        kind: 'labentry-backup',
        version: 1,
        exportedAt: t.toISOString(),
        records: records.map((r) => Object.assign({}, r, { results: Object.assign({}, r.results || {}) })),
      }, null, 2);
    }

    /* Đọc + kiểm tra file sao lưu. Ném Error (tiếng Việt) nếu file không dùng được. */
    function parseBackup(text) {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('file không phải định dạng JSON hợp lệ'); }
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.records) ? data.records : null);
      if (!list) throw new Error('file không chứa danh sách bản ghi');
      const okDate = (v) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null);
      const seenUids = new Set();
      const seenKeys = new Set();
      const out = list.map((raw, i) => {
        if (!raw || typeof raw !== 'object') throw new Error('bản ghi thứ ' + (i + 1) + ' không hợp lệ');
        const testId = typeof raw.testId === 'string' ? raw.testId.trim() : '';
        if (!testId) throw new Error('bản ghi thứ ' + (i + 1) + ' thiếu ID Xét Nghiệm');
        if (!getTestTypeFn(raw.typeId)) throw new Error('bản ghi ' + testId + ' có loại xét nghiệm không hợp lệ');
        const dupKey = testId + '|' + raw.typeId;
        if (seenKeys.has(dupKey)) throw new Error('file có 2 bản ghi trùng ID ' + testId + ' cùng loại xét nghiệm');
        seenKeys.add(dupKey);
        let uid = (typeof raw.uid === 'string' && raw.uid && !seenUids.has(raw.uid)) ? raw.uid : makeUid(new Date());
        seenUids.add(uid);
        const results = {};
        if (raw.results && typeof raw.results === 'object') {
          Object.keys(raw.results).forEach((k) => { if (typeof raw.results[k] === 'string') results[k] = raw.results[k]; });
        }
        const createdAt = okDate(raw.createdAt) || new Date().toISOString();
        return {
          uid,
          testId,
          typeId: raw.typeId,
          results,
          note: typeof raw.note === 'string' ? raw.note : '',
          receiver: typeof raw.receiver === 'string' ? raw.receiver : '',
          performer: typeof raw.performer === 'string' ? raw.performer : '',
          releaser: typeof raw.releaser === 'string' ? raw.releaser : '',
          urgent: raw.urgent === true,
          /* F37: dấu hẹn lại đi theo file sao lưu; lý do lạ -> coi như không hẹn */
          deferReason: ['hut-mau', 'khong-dat', 'khac'].indexOf(raw.deferReason) >= 0 ? raw.deferReason : '',
          deferNote: typeof raw.deferNote === 'string' ? raw.deferNote : '',
          deferAt: okDate(raw.deferAt),
          resultAt: okDate(raw.resultAt),
          releaseAt: okDate(raw.releaseAt),
          timerEndsAt: okDate(raw.timerEndsAt),
          createdAt,
          updatedAt: okDate(raw.updatedAt) || createdAt,
        };
      });
      return { records: out, exportedAt: data && typeof data.exportedAt === 'string' ? data.exportedAt : null };
    }

    /* Lưu ý (v87): khi đang đồng bộ LAN, app KHÔNG cho dùng importBackup (thay toàn bộ = sẽ xóa dữ liệu chung);
       chỉ cho gộp qua máy chủ. importBackup vẫn dùng bình thường ở chế độ một máy. */
    function importBackup(text) {
      const parsed = parseBackup(text);
      records = parsed.records;
      persist();
      return { count: records.length };
    }

    /*
     * Gộp dữ liệu từ file sao lưu vào dữ liệu hiện tại (khác importBackup là thay toàn bộ):
     * bản ghi trong file mà máy này CHƯA có (theo cặp ID + loại) thì thêm vào;
     * bản ghi trùng ID + loại thì bỏ qua, giữ nguyên bản ghi đang có trên máy.
     * Trả về { added, skipped }.
     */
    function mergeBackup(text) {
      const parsed = parseBackup(text);
      let added = 0;
      let skipped = 0;
      parsed.records.forEach((rec) => {
        if (findDuplicate(rec)) { skipped += 1; return; }
        const copy = Object.assign({}, rec, { results: Object.assign({}, rec.results || {}) });
        if (records.some((r) => r.uid === copy.uid)) copy.uid = makeUid(new Date());
        records.push(copy);
        added += 1;
        emit('create', copy.uid, null, copy);
      });
      if (added > 0) persist();
      return { added, skipped };
    }

    function getByUid(uid) {
      return records.find((r) => r.uid === uid) || null;
    }

    /* Có ít nhất một trường kết quả được nhập/chọn? (ghi chú không tính) */
    function hasResult(rec) {
      const type = getTestTypeFn(rec.typeId);
      if (!type) return false;
      return type.fields.some((f) => {
        const v = rec.results ? rec.results[f.key] : undefined;
        return typeof v === 'string' && v.trim() !== '';
      });
    }

    /* Trạng thái suy ra theo đặc tả F5 */
    function statusOf(rec) {
      if (!hasResult(rec)) return 'no-result';
      if (!rec.releaseAt) return 'pending-release';
      return 'released';
    }

    /*
     * Lọc danh sách:
     *   query  : khớp một phần ID Xét Nghiệm (không phân biệt hoa thường)
     *   typeId : đúng loại
     *   status : 'no-result' | 'pending-release' | 'released'
     *   from/to: 'yyyy-mm-dd' — so theo ngày nhập (createdAt, giờ địa phương)
     */
    function filter(list, criteria) {
      const c = criteria || {};
      const q = (c.query || '').trim().toLowerCase();
      return (list || records).filter((rec) => {
        if (q && rec.testId.toLowerCase().indexOf(q) < 0) return false;
        if (c.typeId && rec.typeId !== c.typeId) return false;
        if (c.status && statusOf(rec) !== c.status) return false;
        if (c.from || c.to) {
          const day = localDayKey(new Date(rec.createdAt));
          if (c.from && day < c.from) return false;
          if (c.to && day > c.to) return false;
        }
        return true;
      });
    }

    return { add, update, remove, getAll, getByUid, validate, findDuplicate, hasResult, statusOf, filter, exportBackup, parseBackup, importBackup, mergeBackup, applyRemote, removeLocal, clearSyncMeta, STORAGE_KEY };
  }

  function localDayKey(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /*
   * Thống kê thời gian trả kết quả (turnaround time) trên một danh sách bản ghi:
   * chỉ tính các bản ghi ĐÃ phát hành (releaseAt >= createdAt, cả hai hợp lệ).
   * Trả về { count, avgMinutes, minMinutes, maxMinutes } — count = 0 thì các giá trị phút là null.
   */
  function tatStats(list) {
    const minutes = (list || [])
      .filter((r) => r && r.releaseAt && r.createdAt)
      .map((r) => (new Date(r.releaseAt).getTime() - new Date(r.createdAt).getTime()) / 60000)
      .filter((m) => isFinite(m) && m >= 0);
    if (!minutes.length) return { count: 0, avgMinutes: null, minMinutes: null, maxMinutes: null };
    const sum = minutes.reduce((a, b) => a + b, 0);
    return {
      count: minutes.length,
      avgMinutes: sum / minutes.length,
      minMinutes: Math.min.apply(null, minutes),
      maxMinutes: Math.max.apply(null, minutes),
    };
  }

  /*
   * SHA-256 thuần JS (v87). Dùng khi trình duyệt không có crypto.subtle — xảy ra trên trang mở
   * bằng http://<IP máy chủ LAN> (không phải ngữ cảnh an toàn). Kết quả GIỐNG HỆT crypto.subtle,
   * nên băm PIN tạo ở máy này kiểm tra được ở máy khác và ngược lại.
   */
  const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const bin = unescape(encodeURIComponent(str));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function sha256Hex(text) {
    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const msg = utf8Bytes(String(text));
    const len = msg.length;
    const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(msg);
    padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296));
    dv.setUint32(padded.length - 4, (len * 8) >>> 0);
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
        const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = [(h[0] + a) >>> 0, (h[1] + b) >>> 0, (h[2] + c) >>> 0, (h[3] + d) >>> 0, (h[4] + e) >>> 0, (h[5] + f) >>> 0, (h[6] + g) >>> 0, (h[7] + hh) >>> 0];
    }
    return h.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  return { createStore, memoryStorage, localDayKey, tatStats, sha256Hex };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LabStore;
}

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

  function createStore(storage, getTestTypeFn) {
    const store = storage || defaultStorage();
    let records = load();

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

    function validate(rec) {
      const errors = [];
      if (!rec || typeof rec.testId !== 'string' || rec.testId.trim() === '') {
        errors.push('Thiếu ID Xét Nghiệm');
      }
      if (!rec || !getTestTypeFn(rec.typeId)) {
        errors.push('Loại xét nghiệm không hợp lệ');
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
        createdAt: t.toISOString(),
        updatedAt: t.toISOString(),
      };
      const errors = validate(rec);
      if (errors.length) return { ok: false, errors };
      records.push(rec);
      persist();
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
        updatedAt: t.toISOString(),
      });
      const errors = validate(rec);
      if (errors.length) return { ok: false, errors };
      records[idx] = rec;
      persist();
      return { ok: true, record: rec };
    }

    function remove(uid) {
      const before = records.length;
      records = records.filter((r) => r.uid !== uid);
      if (records.length !== before) persist();
      return records.length !== before;
    }

    function getAll() {
      return records.slice();
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

    return { add, update, remove, getAll, getByUid, validate, hasResult, statusOf, filter, STORAGE_KEY };
  }

  function localDayKey(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  return { createStore, memoryStorage, localDayKey };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LabStore;
}

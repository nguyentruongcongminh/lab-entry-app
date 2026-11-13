'use strict';
/*
 * sync-core.js — Lõi đồng bộ LabEntry qua mạng LAN (v87). Thuần logic, KHÔNG I/O:
 * chạy trong Node (máy chủ LAN + test) và trong trình duyệt (window.LabSyncCore, dùng
 * hàm diff/flatten của phía máy khách).
 *
 * Mô hình: máy chủ LAN giữ bản dữ liệu chung; mỗi máy là bản sao làm việc được cả khi
 * mất mạng. Mỗi thao tác của máy khách là một "op" (có opId duy nhất, nên gửi lại
 * nhiều lần vẫn chỉ áp dụng MỘT lần). Máy chủ gán cho mỗi bản ghi số phiên bản `rv`
 * và nhớ trường nào đổi ở phiên bản nào (`changed`), nhờ đó:
 *   - hai máy sửa KHÁC trường  -> tự gộp, không mất gì;
 *   - hai máy sửa CÙNG trường  -> giữ bản đang có trên máy chủ, bản của máy kia
 *                                 vào "hộp xung đột" để KTV chọn (không ghi đè im lặng);
 *   - mẫu ĐÃ PHÁT HÀNH         -> bất biến: chỉ cho "hủy phát hành" có chủ đích
 *                                 (đúng phiên bản đã xem); sửa/xóa bị từ chối;
 *   - phát hành khi kết quả đã bị người khác đổi sau lúc xem -> từ chối;
 *   - trùng (ID + loại XN) khi hai máy cùng tiếp nhận -> chỉ giữ MỘT bản ghi;
 *   - xóa để lại "bia mộ" (deleted) nên máy cũ không làm sống lại bản ghi đã xóa.
 */
const LabSyncCore = (() => {
  const RECORD_FIELDS = [
    'testId', 'typeId', 'note', 'releaseAt', 'receiver', 'performer', 'releaser', 'urgent',
    'deferReason', 'deferNote', 'deferAt', 'resultAt', 'timerEndsAt',
  ];
  const DATE_FIELDS = ['releaseAt', 'deferAt', 'resultAt', 'timerEndsAt'];
  const BOOL_FIELDS = ['urgent'];
  const DEFAULTS = {
    testId: '', typeId: '', note: '', releaseAt: null, receiver: '', performer: '', releaser: '', urgent: false,
    deferReason: '', deferNote: '', deferAt: null, resultAt: null, timerEndsAt: null,
  };
  /* Trường dấu vết/tự động: hai máy cùng ghi thì bản ghi sau thắng (không đáng làm phiền KTV bằng xung đột):
     giờ lưu kết quả (lấy mốc muộn hơn), KTV thực hiện (= người lưu gần nhất), đồng hồ hẹn giờ, cờ KHẨN. */
  const LWW_PATHS = ['resultAt', 'performer', 'timerEndsAt', 'urgent'];
  /* Đường dẫn "nội dung" — đổi các trường này sau khi KTV đã xem thì không được phát hành bằng bản xem cũ */
  const isContentPath = (p) => p === 'testId' || p === 'typeId' || p === 'note' || p.indexOf('results.') === 0;
  const RESULT_PATH = /^results\.[A-Za-z0-9_\-]{1,64}$/;
  const OPS_KEEP = 30000;
  const AUDIT_KEEP = 20000;
  const CONFLICT_KEEP = 2000;

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const okDate = (v) => (typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)) ? v : null);

  /* ---------- Bản ghi phẳng: { 'testId': ..., 'results.ketQua': ... } ---------- */
  function flatten(rec) {
    const out = {};
    RECORD_FIELDS.forEach((f) => {
      const v = rec ? rec[f] : undefined;
      out[f] = v === undefined ? DEFAULTS[f] : v;
    });
    if (rec && isObj(rec.results)) {
      Object.keys(rec.results).forEach((k) => { out['results.' + k] = typeof rec.results[k] === 'string' ? rec.results[k] : ''; });
    }
    return out;
  }
  const same = (a, b) => a === b || (a == null && b == null);
  const valOf = (flat, p) => {
    if (p in flat) return flat[p];
    return p.indexOf('results.') === 0 ? '' : DEFAULTS[p];
  };

  /* Các trường khác nhau giữa hai bản ghi -> { path: giáTrịMới } */
  function diffRecords(oldRec, newRec) {
    const a = flatten(oldRec || {});
    const b = flatten(newRec || {});
    const set = {};
    Object.keys(Object.assign({}, a, b)).forEach((p) => {
      if (!same(valOf(a, p), valOf(b, p))) set[p] = valOf(b, p);
    });
    return set;
  }

  function applySet(rec, set) {
    Object.keys(set).forEach((p) => {
      if (p.indexOf('results.') === 0) {
        if (!isObj(rec.results)) rec.results = {};
        rec.results[p.slice(8)] = set[p];
      } else {
        rec[p] = set[p];
      }
    });
    return rec;
  }

  function contentEqual(a, b) {
    const fa = flatten(a);
    const fb = flatten(b);
    return Object.keys(Object.assign({}, fa, fb)).every((p) => same(valOf(fa, p), valOf(fb, p)));
  }

  const isReleased = (rec) => !!(rec && rec.releaseAt);
  const recKey = (rec) => String(rec.testId || '').trim() + '|' + rec.typeId;

  /* ---------- Làm sạch dữ liệu đến từ máy khách ---------- */
  function sanitizeRecord(raw, nowIso) {
    if (!isObj(raw)) return null;
    const uid = typeof raw.uid === 'string' && raw.uid.length > 0 && raw.uid.length <= 80 ? raw.uid : null;
    const testId = typeof raw.testId === 'string' ? raw.testId.trim().slice(0, 200) : '';
    const typeId = typeof raw.typeId === 'string' ? raw.typeId.slice(0, 80) : '';
    if (!uid || !testId || !typeId) return null;
    const results = {};
    if (isObj(raw.results)) {
      Object.keys(raw.results).forEach((k) => {
        if (RESULT_PATH.test('results.' + k) && typeof raw.results[k] === 'string') results[k] = raw.results[k].slice(0, 2000);
      });
    }
    const createdAt = okDate(raw.createdAt) || nowIso;
    const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
    return {
      uid, testId, typeId, results,
      note: str(raw.note, 5000),
      receiver: str(raw.receiver, 100), performer: str(raw.performer, 100), releaser: str(raw.releaser, 100),
      urgent: raw.urgent === true,
      deferReason: ['hut-mau', 'khong-dat', 'khac'].indexOf(raw.deferReason) >= 0 ? raw.deferReason : '',
      deferNote: str(raw.deferNote, 2000),
      deferAt: okDate(raw.deferAt), resultAt: okDate(raw.resultAt), releaseAt: okDate(raw.releaseAt), timerEndsAt: okDate(raw.timerEndsAt),
      createdAt,
      updatedAt: okDate(raw.updatedAt) || createdAt,
    };
  }

  function sanitizeSet(raw) {
    const set = {};
    if (!isObj(raw)) return set;
    Object.keys(raw).forEach((p) => {
      const v = raw[p];
      if (RESULT_PATH.test(p)) { if (typeof v === 'string') set[p] = v.slice(0, 2000); return; }
      if (RECORD_FIELDS.indexOf(p) < 0) return;
      if (DATE_FIELDS.indexOf(p) >= 0) { if (v === null) set[p] = null; else if (okDate(v)) set[p] = v; return; }
      if (BOOL_FIELDS.indexOf(p) >= 0) { if (typeof v === 'boolean') set[p] = v; return; }
      if (p === 'deferReason') { if (['', 'hut-mau', 'khong-dat', 'khac'].indexOf(v) >= 0) set[p] = v; return; }
      if (p === 'testId') { if (typeof v === 'string' && v.trim()) set[p] = v.trim().slice(0, 200); return; }
      if (p === 'typeId') { if (typeof v === 'string' && v) set[p] = v.slice(0, 80); return; }
      if (typeof v === 'string') set[p] = v.slice(0, p === 'note' || p === 'deferNote' ? 5000 : 100);
    });
    return set;
  }

  /* ---------- Trạng thái máy chủ ---------- */
  function newState(serverId) {
    return {
      v: 1, serverId: serverId || ('s' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36)),
      seq: 0, records: {}, types: { rv: 0, seq: 0, list: null }, staff: {}, audit: [],
      ops: {}, opsOrder: [], conflicts: [], conflictSeq: 0,
    };
  }

  /* Chỉ mục (ID + loại) -> uid của bản ghi còn sống. Không lưu xuống đĩa; dựng lại khi cần. */
  function ensureIndex(state) {
    if (state._index) return state._index;
    const idx = new Map();
    Object.keys(state.records).forEach((uid) => {
      const r = state.records[uid];
      if (!r.deleted) idx.set(recKey(r), uid);
    });
    Object.defineProperty(state, '_index', { value: idx, enumerable: false, writable: true, configurable: true });
    return idx;
  }
  function liveByKey(state, key, exceptUid) {
    const uid = ensureIndex(state).get(key);
    if (!uid || uid === exceptUid) return null;
    const r = state.records[uid];
    return r && !r.deleted ? r : null;
  }

  function publicRecord(rec) {
    if (rec.deleted) return { uid: rec.uid, deleted: true, rv: rec.rv, seq: rec.seq, testId: rec.testId, typeId: rec.typeId };
    const out = clone(rec);
    delete out.changed;
    return out;
  }

  function addConflict(state, c, now) {
    state.conflictSeq += 1;
    /* Tăng mốc seq: xung đột mới phải đánh thức long-poll của MỌI máy ngay, không đợi tới nhịp kế */
    state.seq += 1;
    const item = Object.assign({ id: 'c' + state.conflictSeq, at: now, status: 'open', seq: state.seq }, c);
    state.conflicts.push(item);
    if (state.conflicts.length > CONFLICT_KEEP) {
      /* chỉ bỏ các xung đột ĐÃ xử lý cũ nhất; không bao giờ bỏ xung đột đang mở */
      const i = state.conflicts.findIndex((x) => x.status !== 'open');
      if (i >= 0) state.conflicts.splice(i, 1);
    }
    return item.id;
  }

  /* ---------- Áp dụng op ---------- */
  function bump(state, rec, paths, now) {
    state.seq += 1;
    rec.rv += 1;
    rec.seq = state.seq;
    paths.forEach((p) => { rec.changed[p] = rec.rv; });
    rec.updatedAt = now;
  }

  function applyCreate(state, op, now) {
    const inc = sanitizeRecord(op.rec, now);
    if (!inc) return { status: 'rejected', reason: 'invalid' };
    const existing = state.records[inc.uid];
    if (existing) {
      if (existing.deleted) return { status: 'rejected', reason: 'deleted', uid: inc.uid };
      return { status: 'merged', uid: inc.uid, rec: publicRecord(existing) };
    }
    const dupe = liveByKey(state, recKey(inc));
    if (dupe) {
      if (contentEqual(dupe, inc)) return { status: 'merged', uid: dupe.uid, replaces: inc.uid, rec: publicRecord(dupe), reason: 'same-content' };
      const f = flatten(dupe);
      const fi = flatten(inc);
      const fill = {};
      const clash = [];
      Object.keys(fi).forEach((p) => {
        const mine = fi[p];
        const theirs = valOf(f, p);
        const emptyMine = mine === '' || mine === null || mine === false || mine === undefined;
        if (emptyMine || same(mine, theirs)) return;
        const emptyTheirs = theirs === '' || theirs === null || theirs === false || theirs === undefined;
        /* Không bao giờ tự "phát hành" mẫu hộ một bản trùng: phát hành phải do KTV thấy đủ nội dung rồi tự bấm */
        const isRelease = p === 'releaseAt' || p === 'releaser';
        if (emptyTheirs && !isReleased(dupe) && !isRelease) fill[p] = mine;
        else clash.push({ path: p, mine, theirs });
      });
      if (Object.keys(fill).length) { applySet(dupe, fill); bump(state, dupe, Object.keys(fill), now); }
      const meaningful = clash.filter((c) => c.path !== 'receiver' && c.path !== 'urgent');
      const ids = [];
      /* Luôn lập một mục báo cho KTV: "mẫu này đã được máy khác tiếp nhận" (kể cả khi chỉ khác người nhận) */
      ids.push(addConflict(state, {
        kind: 'duplicate-intake', uid: dupe.uid, testId: dupe.testId, typeId: dupe.typeId,
        device: op.deviceId || '', operator: op.operator || '', baseRv: dupe.rv,
        paths: clash, info: meaningful.length === 0, incoming: inc,
      }, now));
      return { status: meaningful.length ? 'conflict' : 'merged', uid: dupe.uid, replaces: inc.uid, rec: publicRecord(dupe), reason: 'duplicate', conflictIds: ids };
    }
    state.seq += 1;
    const rec = Object.assign({}, inc, { rv: 1, seq: state.seq, changed: {} });
    Object.keys(flatten(rec)).forEach((p) => { rec.changed[p] = 1; });
    state.records[rec.uid] = rec;
    ensureIndex(state).set(recKey(rec), rec.uid);
    return { status: 'applied', uid: rec.uid, rec: publicRecord(rec) };
  }

  function applyUpdate(state, op, now) {
    const rec = state.records[op.uid];
    const set = sanitizeSet(op.set);
    const paths = Object.keys(set);
    if (!paths.length) return { status: 'merged', uid: op.uid, rec: rec && !rec.deleted ? publicRecord(rec) : undefined };
    if (!rec || rec.deleted) {
      const id = addConflict(state, {
        kind: 'edit-on-deleted', uid: op.uid, testId: rec ? rec.testId : '', typeId: rec ? rec.typeId : '',
        device: op.deviceId || '', operator: op.operator || '', baseRv: rec ? rec.rv : 0,
        paths: paths.map((p) => ({ path: p, mine: set[p], theirs: null })), snapshot: rec ? snapshotOf(rec) : null,
      }, now);
      return { status: 'rejected', reason: 'deleted', uid: op.uid, conflictIds: [id], rec: rec ? publicRecord(rec) : { uid: op.uid, deleted: true } };
    }
    /* base = -1: "gộp mù" (sửa viết lại trên bản ghi mà máy chưa từng thấy bản của máy chủ):
       trường nào máy chủ đang TRỐNG thì điền, trường nào máy chủ đã có giá trị khác thì thành xung đột. */
    const blind = op.base === -1;
    const base = Number.isInteger(op.base) ? op.base : 0;
    const flat = flatten(rec);

    if (isReleased(rec)) {
      const unrelease = set.releaseAt === null && paths.every((p) => p === 'releaseAt' || p === 'releaser');
      if (unrelease) {
        if (base !== rec.rv) {
          const id = addConflict(state, {
            kind: 'unrelease-stale', uid: rec.uid, testId: rec.testId, typeId: rec.typeId, device: op.deviceId || '', operator: op.operator || '',
            baseRv: rec.rv, paths: paths.map((p) => ({ path: p, mine: set[p], theirs: valOf(flat, p) })),
          }, now);
          return { status: 'rejected', reason: 'released-changed', uid: rec.uid, conflictIds: [id], rec: publicRecord(rec) };
        }
        applySet(rec, set);
        bump(state, rec, paths, now);
        return { status: 'applied', uid: rec.uid, rec: publicRecord(rec), unreleased: true };
      }
      /* bấm "Phát hành" lần hai ở máy khác: coi như đã xong, KHÔNG đổi người/giờ phát hành đầu tiên */
      const releaseOnly = set.releaseAt && paths.every((p) => ['releaseAt', 'releaser', 'deferReason', 'deferNote', 'deferAt'].indexOf(p) >= 0);
      if (releaseOnly) return { status: 'merged', reason: 'already-released', uid: rec.uid, rec: publicRecord(rec) };
      const id = addConflict(state, {
        kind: 'edit-on-released', uid: rec.uid, testId: rec.testId, typeId: rec.typeId, device: op.deviceId || '', operator: op.operator || '',
        baseRv: rec.rv, paths: paths.map((p) => ({ path: p, mine: set[p], theirs: valOf(flat, p) })),
      }, now);
      return { status: 'rejected', reason: 'released', uid: rec.uid, conflictIds: [id], rec: publicRecord(rec) };
    }

    const apply = {};
    const clash = [];
    paths.forEach((p) => {
      const cur = valOf(flat, p);
      if (same(cur, set[p])) return;
      if (LWW_PATHS.indexOf(p) >= 0) {
        if (p === 'resultAt' && cur && set[p] && set[p] < cur) return; /* giữ mốc giờ muộn hơn */
        apply[p] = set[p];
        return;
      }
      const changedAt = rec.changed[p] || 0;
      const curEmpty = cur === '' || cur === null || cur === false || cur === undefined;
      if (blind ? !curEmpty : changedAt > base) clash.push({ path: p, mine: set[p], theirs: cur });
      else apply[p] = set[p];
    });
    /* Phát hành chỉ hợp lệ nếu người phát hành đã thấy đúng nội dung hiện tại */
    if (apply.releaseAt) {
      const stale = blind || Object.keys(rec.changed).some((p) => isContentPath(p) && rec.changed[p] > base);
      if (stale) {
        delete apply.releaseAt; delete apply.releaser;
        clash.push({ path: 'releaseAt', mine: set.releaseAt, theirs: null, reason: 'content-changed' });
      }
    }
    /* Đổi ID/loại XN không được tạo bản ghi trùng */
    if (apply.testId !== undefined || apply.typeId !== undefined) {
      const key = String(apply.testId !== undefined ? apply.testId : rec.testId).trim() + '|' + (apply.typeId !== undefined ? apply.typeId : rec.typeId);
      if (liveByKey(state, key, rec.uid)) {
        ['testId', 'typeId'].forEach((p) => { if (p in apply) { clash.push({ path: p, mine: apply[p], theirs: valOf(flat, p), reason: 'duplicate-key' }); delete apply[p]; } });
      }
    }
    const applied = Object.keys(apply);
    if (applied.length) {
      const oldKey = recKey(rec);
      applySet(rec, apply);
      bump(state, rec, applied, now);
      const idx = ensureIndex(state);
      if (recKey(rec) !== oldKey) { idx.delete(oldKey); idx.set(recKey(rec), rec.uid); }
    }
    const out = { uid: rec.uid, rec: publicRecord(rec) };
    if (clash.length) {
      out.conflictIds = [addConflict(state, {
        kind: 'field', uid: rec.uid, testId: rec.testId, typeId: rec.typeId, device: op.deviceId || '', operator: op.operator || '',
        baseRv: rec.rv, paths: clash,
      }, now)];
      out.status = applied.length ? 'partial' : 'conflict';
    } else {
      out.status = applied.length ? 'applied' : 'merged';
    }
    return out;
  }

  function snapshotOf(rec) {
    const s = publicRecord(rec);
    return s.deleted ? { uid: rec.uid, testId: rec.testId, typeId: rec.typeId, results: rec.results, note: rec.note } : s;
  }

  function applyDelete(state, op, now) {
    const rec = state.records[op.uid];
    if (!rec || rec.deleted) return { status: 'merged', uid: op.uid, rec: rec ? publicRecord(rec) : { uid: op.uid, deleted: true } };
    const base = Number.isInteger(op.base) ? op.base : 0;
    if (isReleased(rec) || base !== rec.rv) {
      const reason = isReleased(rec) ? 'released' : 'changed';
      const id = addConflict(state, {
        kind: isReleased(rec) ? 'delete-released' : 'delete-stale', uid: rec.uid, testId: rec.testId, typeId: rec.typeId,
        device: op.deviceId || '', operator: op.operator || '', baseRv: rec.rv, paths: [],
      }, now);
      return { status: 'rejected', reason, uid: rec.uid, conflictIds: [id], rec: publicRecord(rec) };
    }
    ensureIndex(state).delete(recKey(rec));
    rec.deleted = true;
    rec.deletedAt = now;
    bump(state, rec, [], now);
    return { status: 'applied', uid: rec.uid, rec: publicRecord(rec) };
  }

  function normalizeStaff(x) {
    if (!isObj(x) || typeof x.name !== 'string' || !x.name.trim()) return null;
    return {
      name: x.name.trim().slice(0, 100),
      salt: typeof x.salt === 'string' ? x.salt.slice(0, 100) : '',
      pinHash: typeof x.pinHash === 'string' && x.pinHash ? x.pinHash.slice(0, 200) : null,
      sig: (typeof x.sig === 'string' && x.sig.indexOf('data:image/') === 0 && x.sig.length <= 300000) ? x.sig : '',
    };
  }

  function applyStaff(state, op, now) {
    const entry = op.entry === null ? null : normalizeStaff(op.entry);
    const name = typeof op.name === 'string' ? op.name.trim() : '';
    if (!name || (op.entry !== null && !entry)) return { status: 'rejected', reason: 'invalid' };
    const key = name.toLowerCase();
    const ts = Number.isFinite(op.ts) ? op.ts : 0;
    const cur = state.staff[key];
    /* ts = 0: dữ liệu KTV cũ có sẵn trên máy lúc mới nối vào máy chủ — không bao giờ ghi đè KTV đã có trên máy chủ */
    if (cur && (cur.ts > ts || ts === 0)) return { status: 'merged', reason: 'stale', staff: staffPublic(key, cur) };
    if (cur && cur.ts === ts && JSON.stringify(cur.entry) === JSON.stringify(entry)) return { status: 'merged', staff: staffPublic(key, cur) };
    state.seq += 1;
    state.staff[key] = { entry, ts, deleted: entry === null, seq: state.seq };
    return { status: 'applied', staff: staffPublic(key, state.staff[key]) };
  }
  const staffPublic = (key, s) => ({ key, entry: s.entry, ts: s.ts, deleted: !!s.deleted, seq: s.seq });

  function validTypes(list) {
    return Array.isArray(list) && list.length > 0 && list.length <= 500 && list.every((t) =>
      isObj(t) && typeof t.id === 'string' && t.id && typeof t.name === 'string' && Array.isArray(t.fields));
  }

  function applyTypes(state, op, now) {
    if (!validTypes(op.list)) return { status: 'rejected', reason: 'invalid' };
    /* merge: lần nối đầu của một máy — hợp danh mục của máy với danh mục chung (loại nào chưa có thì thêm, loại đã có giữ nguyên) */
    if (op.merge) {
      if (!state.types.list) {
        state.seq += 1;
        state.types = { rv: state.types.rv + 1, seq: state.seq, list: clone(op.list) };
        return { status: 'applied', types: { rv: state.types.rv, list: state.types.list } };
      }
      const have = new Set(state.types.list.map((t) => t.id));
      const extra = op.list.filter((t) => !have.has(t.id));
      if (!extra.length) return { status: 'merged', types: { rv: state.types.rv, list: state.types.list } };
      state.seq += 1;
      state.types = { rv: state.types.rv + 1, seq: state.seq, list: state.types.list.concat(clone(extra)) };
      return { status: 'applied', types: { rv: state.types.rv, list: state.types.list } };
    }
    const base = Number.isInteger(op.base) ? op.base : 0;
    if (base !== state.types.rv) {
      if (state.types.list && JSON.stringify(state.types.list) === JSON.stringify(op.list)) return { status: 'merged', types: { rv: state.types.rv, list: state.types.list } };
      const id = addConflict(state, {
        kind: 'types-conflict', uid: '', testId: '', typeId: '', device: op.deviceId || '', operator: op.operator || '',
        baseRv: state.types.rv, paths: [], mineList: clone(op.list),
      }, now);
      return { status: 'rejected', reason: 'types-changed', conflictIds: [id], types: { rv: state.types.rv, list: state.types.list } };
    }
    state.seq += 1;
    state.types = { rv: state.types.rv + 1, seq: state.seq, list: clone(op.list) };
    return { status: 'applied', types: { rv: state.types.rv, list: state.types.list } };
  }

  function applyAudit(state, op) {
    const have = new Set(state.audit.map((e) => e.id));
    let added = 0;
    (Array.isArray(op.entries) ? op.entries : []).slice(0, 500).forEach((e) => {
      if (!isObj(e) || typeof e.id !== 'string' || !e.id || have.has(e.id)) return;
      if (typeof e.at !== 'string' || isNaN(Date.parse(e.at)) || typeof e.action !== 'string' || !e.action) return;
      have.add(e.id);
      if (!added) state.seq += 1;
      added += 1;
      state.audit.push({
        id: e.id, at: e.at, action: e.action.slice(0, 40),
        actor: typeof e.actor === 'string' ? e.actor.slice(0, 100) : '',
        testId: typeof e.testId === 'string' ? e.testId.slice(0, 200) : '',
        typeId: typeof e.typeId === 'string' ? e.typeId.slice(0, 80) : '',
        detail: typeof e.detail === 'string' ? e.detail.slice(0, 2000) : '',
        sseq: state.seq,
      });
    });
    if (state.audit.length > AUDIT_KEEP) state.audit.splice(0, state.audit.length - AUDIT_KEEP);
    return { status: added ? 'applied' : 'merged' };
  }

  function applyOp(state, op, now) {
    now = now || new Date().toISOString();
    if (!isObj(op) || typeof op.opId !== 'string' || !op.opId) return { status: 'rejected', reason: 'invalid' };
    const prev = state.ops[op.opId];
    if (prev) {
      /* Gửi lại op đã xử lý (mất mạng giữa chừng): trả đúng kết quả cũ, KHÔNG áp dụng lần nữa */
      const r = Object.assign({ opId: op.opId, replay: true }, prev);
      const live = r.uid ? state.records[r.uid] : null;
      if (live) r.rec = publicRecord(live);
      return r;
    }
    if ((op.kind === 'update' || op.kind === 'delete') && (typeof op.uid !== 'string' || !op.uid)) return { opId: op.opId, status: 'rejected', reason: 'invalid' };
    let res;
    if (op.kind === 'create') res = applyCreate(state, op, now);
    else if (op.kind === 'update') res = applyUpdate(state, op, now);
    else if (op.kind === 'delete') res = applyDelete(state, op, now);
    else if (op.kind === 'staff') res = applyStaff(state, op, now);
    else if (op.kind === 'types') res = applyTypes(state, op, now);
    else if (op.kind === 'audit') res = applyAudit(state, op, now);
    else res = { status: 'rejected', reason: 'unknown-kind' };
    res.opId = op.opId;
    if (res.types) res.typesRv = res.types.rv;
    const keep = { status: res.status };
    ['uid', 'reason', 'replaces', 'conflictIds', 'unreleased'].forEach((k) => { if (res[k] !== undefined) keep[k] = res[k]; });
    /* rv sau khi áp dụng op này: máy khách dùng làm mốc cho thao tác kế tiếp của chính nó */
    if (res.rec && Number.isInteger(res.rec.rv)) { keep.rv = res.rec.rv; res.rv = res.rec.rv; }
    state.ops[op.opId] = keep;
    state.opsOrder.push(op.opId);
    while (state.opsOrder.length > OPS_KEEP) delete state.ops[state.opsOrder.shift()];
    return res;
  }

  function applyBatch(state, ops, now) {
    return (Array.isArray(ops) ? ops : []).map((op) => applyOp(state, op, now));
  }

  /* ---------- Bản thay đổi gửi cho máy khách ---------- */
  function changesSince(state, since) {
    since = Number.isInteger(since) && since >= 0 ? since : 0;
    const out = {
      serverId: state.serverId, seq: state.seq, records: [], types: null, staff: [], audit: [],
      conflicts: state.conflicts.filter((c) => c.status === 'open').map(publicConflict),
    };
    Object.keys(state.records).forEach((uid) => {
      const r = state.records[uid];
      if (r.seq > since) out.records.push(publicRecord(r));
    });
    out.records.sort((a, b) => a.seq - b.seq);
    if (state.types.seq > since && state.types.list) out.types = { rv: state.types.rv, list: state.types.list };
    Object.keys(state.staff).forEach((k) => { if (state.staff[k].seq > since) out.staff.push(staffPublic(k, state.staff[k])); });
    state.audit.forEach((e) => { if (e.sseq > since) out.audit.push(e); });
    out.typesRv = state.types.rv;
    return out;
  }
  function publicConflict(c) {
    const o = clone(c);
    return o;
  }

  /* ---------- Xử lý xung đột do KTV chọn ---------- */
  function resolveConflict(state, id, choice, by, now) {
    now = now || new Date().toISOString();
    const c = state.conflicts.find((x) => x.id === id);
    if (!c) return { ok: false, reason: 'not-found' };
    if (c.status !== 'open') return { ok: true, already: true, conflict: publicConflict(c) };
    let applied = null;
    if (choice === 'apply-mine') {
      if (c.kind === 'field' || c.kind === 'duplicate-intake') {
        const rec = state.records[c.uid];
        if (!rec || rec.deleted) return { ok: false, reason: 'deleted' };
        if (isReleased(rec)) return { ok: false, reason: 'released' };
        const set = {};
        c.paths.forEach((p) => { if (p.path !== 'releaseAt' || p.reason !== 'content-changed') set[p.path] = p.mine; });
        const res = applyOp(state, { opId: 'resolve-' + id + '-' + state.seq, kind: 'update', uid: c.uid, base: rec.rv, set, deviceId: 'resolve', operator: by || '' }, now);
        applied = res;
        if (res.status === 'rejected' || res.status === 'conflict') return { ok: false, reason: res.reason || 'conflict', result: res };
      } else if (c.kind === 'edit-on-deleted') {
        const rec = state.records[c.uid];
        const snap = c.snapshot || (rec ? snapshotOf(rec) : null);
        if (!snap) return { ok: false, reason: 'no-snapshot' };
        const base = Object.assign({}, snap, { uid: c.uid });
        c.paths.forEach((p) => { applySet(base, { [p.path]: p.mine }); });
        const key = recKey(base);
        if (liveByKey(state, key, c.uid)) return { ok: false, reason: 'duplicate-key' };
        const cur = state.records[c.uid];
        if (cur && cur.deleted) {
          cur.deleted = false;
          delete cur.deletedAt;
          Object.assign(cur, sanitizeRecord(Object.assign({}, cur, base, { uid: c.uid }), now) || {});
          bump(state, cur, Object.keys(flatten(cur)), now);
          ensureIndex(state).set(recKey(cur), cur.uid);
          applied = { status: 'applied', rec: publicRecord(cur) };
        } else {
          applied = applyOp(state, { opId: 'resolve-' + id + '-' + state.seq, kind: 'create', rec: base, deviceId: 'resolve', operator: by || '' }, now);
        }
      } else if (c.kind === 'types-conflict' && validTypes(c.mineList)) {
        applied = applyOp(state, { opId: 'resolve-' + id + '-' + state.seq, kind: 'types', base: state.types.rv, list: c.mineList, deviceId: 'resolve', operator: by || '' }, now);
      } else {
        return { ok: false, reason: 'not-applicable' };
      }
    }
    c.status = 'resolved';
    c.resolvedAt = now;
    c.resolvedBy = by || '';
    c.choice = choice === 'apply-mine' ? 'apply-mine' : 'keep-server';
    state.seq += 1;
    c.seq = state.seq;
    return { ok: true, conflict: publicConflict(c), result: applied };
  }

  /* ---------- Nạp dữ liệu cũ (sao lưu của từng máy) lên máy chủ ----------
     Bản ghi trùng (ID + loại) mà NỘI DUNG KHÁC không bị bỏ qua im lặng: đi vào hộp xung đột. */
  function importRecords(state, records, meta, now) {
    now = now || new Date().toISOString();
    const stats = { added: 0, same: 0, conflicts: 0, invalid: 0 };
    (Array.isArray(records) ? records : []).forEach((raw, i) => {
      const inc = sanitizeRecord(raw, now);
      if (!inc) { stats.invalid += 1; return; }
      const opId = 'imp-' + (meta && meta.batchId ? meta.batchId : now) + '-' + i;
      const res = applyOp(state, { opId, kind: 'create', rec: inc, deviceId: (meta && meta.device) || 'import', operator: (meta && meta.operator) || '' }, now);
      if (res.status === 'applied') stats.added += 1;
      else if (res.status === 'merged' && !(res.conflictIds && res.conflictIds.length)) stats.same += 1;
      else stats.conflicts += 1;
    });
    return stats;
  }

  return {
    RECORD_FIELDS, flatten, diffRecords, applySet, contentEqual, isReleased, recKey, isContentPath,
    sanitizeRecord, sanitizeSet, normalizeStaff, validTypes,
    newState, ensureIndex, publicRecord, applyOp, applyBatch, changesSince, resolveConflict, importRecords,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LabSyncCore;
}

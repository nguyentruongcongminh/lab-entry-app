'use strict';
/*
 * sync.js — Máy khách đồng bộ LAN của LabEntry (v87).
 *
 * Nguyên tắc: máy nào cũng là bản làm việc ĐẦY ĐỦ (localStorage như trước). Mỗi thao tác
 * của KTV được ghi lại thành một "op" trong hàng đợi (lưu bền, sống qua tắt máy / mất mạng),
 * rồi gửi lên máy chủ LAN khi có mạng. Máy chủ trả lời từng op; thay đổi của máy khác về
 * qua kênh "long-poll" (treo yêu cầu tới khi có thay đổi) nên gần như tức thời.
 *
 *   - Mất mạng: hàng đợi cứ dài ra, KTV làm việc bình thường; có mạng lại thì tự gửi.
 *   - Gửi lại op (rớt mạng giữa chừng) an toàn: opId duy nhất, máy chủ chỉ áp dụng một lần.
 *   - Op sau của cùng một mẫu "nối đuôi" op trước (after) để không tự xung đột với chính mình.
 *   - Bị từ chối / xung đột: bản của máy chủ được giữ, giá trị của KTV nằm ở hộp xung đột.
 */
const LabSync = (() => {
  const Core = (typeof LabSyncCore !== 'undefined') ? LabSyncCore : require('./sync-core.js');
  const KEY_STATE = 'labentry.sync.v1';
  const KEY_QUEUE = 'labentry.syncq.v1';
  const KEY_PRESYNC = 'labentry.presync.backup.v1';
  const DEFAULT_PORT = 8787;
  const BATCH_MAX = 150;

  const clone = (x) => JSON.parse(JSON.stringify(x));

  function memStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }

  /* "192.168.1.10" -> "http://192.168.1.10:8787"; giữ nguyên nếu đã có http(s):// và cổng */
  function normalizeUrl(input) {
    let u = String(input || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?/i.exec(u);
    if (!m) return '';
    const proto = m[1].toLowerCase();
    const port = m[3] || (proto === 'http' ? String(DEFAULT_PORT) : '');
    return proto + '://' + m[2] + (port ? ':' + port : '');
  }
  function create(opts) {
    const o = Object.assign({ waitSec: 20, backoffMaxMs: 15000 }, opts || {});
    const store = o.store;
    const storage = o.storage || memStorage();
    const hooks = Object.assign({
      getTypes: () => [], applyRemoteTypes: () => {}, getStaff: () => [], applyRemoteStaff: () => {},
      getAudit: () => [], mergeAudit: () => {}, getOperator: () => '', onDataChanged: () => {}, onStatus: () => {},
      onNotice: () => {}, confirmAdopt: async () => true,
    }, o.hooks || {});
    const fetchFn = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    const sleepFn = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    const nowMs = o.now || (() => Date.now());

    const loadJson = (k, dflt) => { try { const raw = storage.getItem(k); return raw ? JSON.parse(raw) : dflt; } catch (e) { return dflt; } };
    const randId = (n) => {
      let s = '';
      try {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) { const a = new Uint32Array(2); crypto.getRandomValues(a); s = a[0].toString(36) + a[1].toString(36); }
      } catch (e) { s = ''; }
      return (s || Math.floor(Math.random() * 1e15).toString(36)).slice(0, n || 8);
    };

    let st = Object.assign({
      enabled: false, paused: false, url: '', deviceId: 'd' + randId(10), serverId: '', since: 0, typesRv: 0, staffSnap: {}, lastOkAt: null,
    }, loadJson(KEY_STATE, {}));
    let queue = loadJson(KEY_QUEUE, []);
    if (!Array.isArray(queue)) queue = [];
    let conflicts = [];
    let status = 'off'; /* off | connecting | online | offline | paused */
    let lastError = '';
    let opCounter = 0;
    let running = false;
    let loopToken = 0;
    let flushing = false;
    let flushAgain = false;
    let flushTimer = null;
    let kick = null;
    let notices = [];

    function saveState() { try { storage.setItem(KEY_STATE, JSON.stringify(st)); } catch (e) { /* đầy bộ nhớ */ } }
    function saveQueue() { try { storage.setItem(KEY_QUEUE, JSON.stringify(queue)); } catch (e) { /* đầy bộ nhớ */ } }
    function newOpId() { opCounter += 1; return 'o' + st.deviceId.slice(-6) + nowMs().toString(36) + opCounter.toString(36) + randId(4); }

    function getStatus() {
      return {
        mode: status, enabled: st.enabled, paused: st.paused, url: st.url, deviceId: st.deviceId, pending: queue.length,
        conflicts: conflicts.length, lastOkAt: st.lastOkAt, error: lastError, serverId: st.serverId,
      };
    }
    function emit() { try { hooks.onStatus(getStatus()); } catch (e) { /* bỏ qua */ } }
    function setStatus(s, err) { status = s; lastError = err || ''; emit(); }
    function notice(msg) { notices.push(msg); try { hooks.onNotice(msg); } catch (e) { /* bỏ qua */ } }

    /* ---------- Gọi máy chủ ---------- */
    async function call(method, path, body, timeoutMs, baseUrl) {
      if (!fetchFn) throw new Error('Trình duyệt không hỗ trợ fetch');
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 10000) : null;
      try {
        const res = await fetchFn((baseUrl || st.url) + path, {
          method,
          headers: Object.assign({ 'X-LabEntry': '1' }, body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: ctrl ? ctrl.signal : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(data && data.error ? data.error : 'HTTP ' + res.status), { status: res.status, data });
        return data;
      } finally { if (timer) clearTimeout(timer); }
    }

    /* ---------- Hàng đợi op ---------- */
    const isRecKind = (k) => k === 'create' || k === 'update' || k === 'delete';
    const lastFor = (uid) => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].uid === uid && isRecKind(queue[i].kind)) return queue[i]; return null; };

    function enqueueCreate(rec) {
      queue.push({ opId: newOpId(), kind: 'create', uid: rec.uid, base: 0, after: null, rec: clone(rec), sent: false });
    }
    /* hint = phiên bản bản ghi mà KTV đã THẤY lúc bắt đầu sửa (form mở từ trước). Mốc của op luôn là phiên bản CŨ NHẤT
       KTV có thể đã thấy: nếu trong lúc form mở máy khác đã sửa cùng ô thì máy chủ phát hiện xung đột thay vì ghi đè. */
    function enqueueUpdate(uid, set, rvNow, hint) {
      const last = lastFor(uid);
      const hasHint = Number.isInteger(hint);
      if (last && !last.sent && last.kind === 'update') {
        Object.assign(last.set, set);
        if (hasHint) { if (Number.isInteger(last.base)) last.base = Math.min(last.base, hint); else last.hint = Number.isInteger(last.hint) ? Math.min(last.hint, hint) : hint; }
        return;
      }
      if (last && !last.sent && last.kind === 'create') return; /* bản ghi gửi lúc đẩy: lấy trạng thái mới nhất */
      if (last) queue.push({ opId: newOpId(), kind: 'update', uid, base: null, after: last.opId, hint: hasHint ? hint : undefined, set: clone(set), sent: false });
      else queue.push({ opId: newOpId(), kind: 'update', uid, base: Number.isInteger(rvNow) ? rvNow : 0, after: null, set: clone(set), sent: false });
    }
    const baseHints = new Map();
    function setBaseHint(uid, rv) { if (Number.isInteger(rv)) baseHints.set(uid, rv); }
    function clearBaseHint(uid) { baseHints.delete(uid); }
    function enqueueDelete(uid, rvNow) {
      const hadUnsentCreate = queue.some((q) => q.uid === uid && q.kind === 'create' && !q.sent);
      queue = queue.filter((q) => !(q.uid === uid && isRecKind(q.kind) && !q.sent));
      const last = lastFor(uid);
      if (hadUnsentCreate && !last) return; /* chưa từng lên máy chủ: không cần gửi gì */
      queue.push({ opId: newOpId(), kind: 'delete', uid, base: last ? null : (Number.isInteger(rvNow) ? rvNow : 0), after: last ? last.opId : null, sent: false });
    }

    /* Cầu nối: kho dữ liệu báo mọi thay đổi của KTV ở đây */
    function onStoreChange(evt) {
      if (!st.enabled) return;
      if (evt.kind === 'create') enqueueCreate(evt.after);
      else if (evt.kind === 'update') {
        const set = Core.diffRecords(evt.before, evt.after);
        const hint = baseHints.get(evt.uid);
        baseHints.delete(evt.uid);
        let rvNow = evt.before && evt.before.rv;
        if (Number.isInteger(hint)) rvNow = Number.isInteger(rvNow) ? Math.min(hint, rvNow) : hint;
        if (Object.keys(set).length) enqueueUpdate(evt.uid, set, rvNow, Number.isInteger(hint) ? hint : null);
      } else if (evt.kind === 'delete') enqueueDelete(evt.uid, evt.before && evt.before.rv);
      saveQueue();
      emit();
      scheduleFlush();
    }

    function notifyTypes() {
      if (!st.enabled) return;
      const pend = queue.find((q) => q.kind === 'types' && !q.sent);
      if (!pend) {
        const last = queue.filter((q) => q.kind === 'types').pop();
        queue.push({ opId: newOpId(), kind: 'types', base: last ? null : st.typesRv, after: last ? last.opId : null, sent: false });
      }
      saveQueue(); emit(); scheduleFlush();
    }

    function notifyStaff(list) {
      if (!st.enabled) return;
      const cur = {};
      (list || []).forEach((e) => { if (e && e.name) cur[e.name.toLowerCase()] = e; });
      Object.keys(cur).forEach((key) => {
        const json = JSON.stringify(cur[key]);
        if (st.staffSnap[key] === json) return;
        st.staffSnap[key] = json;
        queue = queue.filter((q) => !(q.kind === 'staff' && q.key === key && !q.sent));
        queue.push({ opId: newOpId(), kind: 'staff', key, name: cur[key].name, entry: clone(cur[key]), ts: nowMs(), sent: false });
      });
      Object.keys(st.staffSnap).forEach((key) => {
        if (cur[key]) return;
        delete st.staffSnap[key];
        queue = queue.filter((q) => !(q.kind === 'staff' && q.key === key && !q.sent));
        queue.push({ opId: newOpId(), kind: 'staff', key, name: key, entry: null, ts: nowMs(), sent: false });
      });
      saveState(); saveQueue(); emit(); scheduleFlush();
    }

    function notifyAudit(entry) {
      if (!st.enabled || !entry) return;
      const pend = queue.find((q) => q.kind === 'audit' && !q.sent && q.entries.length < 200);
      if (pend) pend.entries.push(clone(entry));
      else queue.push({ opId: newOpId(), kind: 'audit', entries: [clone(entry)], sent: false });
      saveQueue(); scheduleFlush();
    }

    /* ---------- Hòa giải bản ghi từ máy chủ với thao tác đang chờ gửi ---------- */
    function reconcile(uid, serverRec) {
      if (!serverRec) return false;
      if (serverRec.deleted) { return store.removeLocal(uid); }
      const pend = queue.filter((q) => q.uid === uid && isRecKind(q.kind));
      if (pend.some((q) => q.kind === 'delete')) return false; /* KTV đã xóa ở máy này, chờ máy chủ xử lý */
      const view = clone(serverRec);
      pend.forEach((q) => { if (q.kind === 'update') Core.applySet(view, q.set); });
      store.applyRemote([view]);
      return true;
    }

    function localRecordFresh(uid, fallback) {
      const r = store.getByUid(uid);
      const src = r ? clone(r) : fallback;
      if (!src) return null;
      delete src.rv; delete src.seq;
      return src;
    }

    /* ---------- Đẩy hàng đợi lên máy chủ ---------- */
    function pickBatch() {
      const picked = [];
      const seenUid = new Set();
      const seenKey = new Set();
      for (let i = 0; i < queue.length && picked.length < BATCH_MAX; i++) {
        const q = queue[i];
        if (isRecKind(q.kind)) {
          if (seenUid.has(q.uid)) continue;
          seenUid.add(q.uid);
          if (q.base === null && q.after && !queue.some((x) => x.opId === q.after)) { q.after = null; q.base = -1; } /* op trước đã mất: gộp mù cho an toàn */
          if (q.base === null) continue; /* còn chờ op trước ghi nhận */
        } else if (q.kind === 'types') {
          if (seenKey.has('types')) continue;
          seenKey.add('types');
          if (q.base === null) continue;
        } else if (q.kind === 'staff') {
          if (seenKey.has('s:' + q.key)) continue;
          seenKey.add('s:' + q.key);
        }
        picked.push(q);
      }
      return picked;
    }

    function toWire(q) {
      if (q.kind === 'create') return { opId: q.opId, kind: 'create', rec: localRecordFresh(q.uid, q.rec) };
      if (q.kind === 'update') return { opId: q.opId, kind: 'update', uid: q.uid, base: q.base, set: q.set };
      if (q.kind === 'delete') return { opId: q.opId, kind: 'delete', uid: q.uid, base: q.base };
      if (q.kind === 'types') return { opId: q.opId, kind: 'types', base: q.base, merge: !!q.merge, list: hooks.getTypes() };
      if (q.kind === 'staff') return { opId: q.opId, kind: 'staff', name: q.name, entry: q.entry, ts: q.ts };
      if (q.kind === 'audit') return { opId: q.opId, kind: 'audit', entries: q.entries };
      return { opId: q.opId, kind: q.kind };
    }

    function handleResults(batch, results) {
      const byId = {};
      (results || []).forEach((r) => { if (r && r.opId) byId[r.opId] = r; });
      let problems = 0;
      let dirty = false;
      batch.forEach((q) => {
        const res = byId[q.opId];
        if (!res) return; /* máy chủ chưa xử lý: để lại, gửi lại lần sau */
        queue = queue.filter((x) => x.opId !== q.opId);
        const rv = Number.isInteger(res.rv) ? res.rv : (res.rec && Number.isInteger(res.rec.rv) ? res.rec.rv : null);
        queue.forEach((x) => {
          if (x.after !== q.opId) return;
          x.after = null;
          if (q.kind === 'types') x.base = Number.isInteger(res.typesRv) ? res.typesRv : st.typesRv;
          else {
            x.base = rv !== null ? rv : 0;
            if (Number.isInteger(x.hint)) x.base = Math.min(x.base, x.hint); /* KTV sửa trên bản cũ hơn bản vừa ghi nhận */
          }
          delete x.hint;
        });
        const bad = res.status === 'rejected' || res.status === 'conflict' || res.status === 'partial';
        if (isRecKind(q.kind)) {
          if (res.replaces && res.uid && res.replaces !== res.uid) {
            /* hai máy cùng tiếp nhận một mã: bản của máy này nhập vào bản đã có trên máy chủ */
            queue.forEach((x) => { if (x.uid === res.replaces && x.kind === 'update') { x.uid = res.uid; x.base = -1; x.after = null; } });
            queue = queue.filter((x) => !(x.uid === res.replaces && isRecKind(x.kind)));
            store.removeLocal(res.replaces);
            dirty = true;
            if (res.reason === 'duplicate' || res.reason === 'same-content') {
              notice('Mẫu ' + ((res.rec && res.rec.testId) || '') + ' đã được máy khác tiếp nhận trước — đã nhập chung vào một bản ghi.');
            }
          }
          if (res.rec) { reconcile(res.rec.uid || q.uid, res.rec); dirty = true; }
          if (bad) {
            problems += 1;
            if (q.kind === 'delete' && res.reason === 'released') notice('Không xóa được: mẫu đã phát hành. Hãy hủy phát hành trước nếu thật sự cần.');
            else if (res.reason === 'released') notice('Không lưu được thay đổi: mẫu đã được phát hành ở máy khác — kết quả đã phát hành được giữ nguyên.');
            else if (res.reason === 'deleted') notice('Mẫu này đã bị xóa ở máy khác — thay đổi của bạn được giữ trong mục Xung đột.');
          }
        } else if (q.kind === 'types') {
          if (res.types && res.types.list) {
            st.typesRv = res.types.rv;
            if (!queue.some((x) => x.kind === 'types')) { hooks.applyRemoteTypes(res.types.list); dirty = true; }
          }
          if (bad) { problems += 1; notice('Danh mục xét nghiệm đã được máy khác sửa trước — danh mục chung được giữ, bản của bạn nằm ở mục Xung đột.'); }
        }
      });
      if (problems) notice('Có ' + problems + ' thay đổi chưa được áp dụng do xung đột — mở mục Đồng bộ để xem và chọn.');
      saveQueue();
      saveState();
      if (dirty) hooks.onDataChanged();
    }

    function scheduleFlush() {
      if (flushTimer || !running) return;
      flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 120);
    }

    async function flush() {
      if (!st.enabled || st.paused || !running) return;
      if (flushing) { flushAgain = true; return; }
      flushing = true;
      try {
        for (let guard = 0; guard < 500; guard++) {
          const batch = pickBatch();
          if (!batch.length) break;
          batch.forEach((q) => { q.sent = true; });
          saveQueue();
          const wire = batch.map(toWire).filter((w) => !(w.kind === 'create' && !w.rec));
          const resp = await call('POST', '/api/push', { deviceId: st.deviceId, operator: hooks.getOperator(), ops: wire }, 30000);
          if (resp.serverId && st.serverId && resp.serverId !== st.serverId) throw Object.assign(new Error('server-changed'), { serverChanged: true });
          handleResults(batch, resp.results);
          st.lastOkAt = new Date(nowMs()).toISOString();
          setStatus('online');
          if (batch.every((q) => queue.some((x) => x.opId === q.opId))) break; /* máy chủ không xử lý op nào: tránh vòng lặp vô hạn */
        }
      } catch (e) {
        if (e && e.serverChanged) await onServerChanged();
        else setStatus('offline', e && e.message);
      } finally {
        flushing = false;
        if (flushAgain) { flushAgain = false; scheduleFlush(); }
      }
    }

    /* ---------- Kéo thay đổi từ máy chủ ---------- */
    function applyPull(resp) {
      let dirty = false;
      (resp.records || []).forEach((r) => { if (reconcile(r.uid, r)) dirty = true; });
      if (resp.types && resp.types.list) {
        const pendTypes = queue.some((q) => q.kind === 'types');
        if (!pendTypes && resp.types.rv !== st.typesRv) { hooks.applyRemoteTypes(resp.types.list); st.typesRv = resp.types.rv; dirty = true; }
      }
      if (typeof resp.typesRv === 'number' && !queue.some((q) => q.kind === 'types') && !resp.types && st.typesRv < resp.typesRv) st.typesRv = resp.typesRv;
      if (resp.staff && resp.staff.length) {
        const items = resp.staff.filter((s) => !queue.some((q) => q.kind === 'staff' && q.key === s.key && q.ts >= s.ts));
        items.forEach((s) => { if (s.deleted) delete st.staffSnap[s.key]; else st.staffSnap[s.key] = JSON.stringify(s.entry); });
        if (items.length) { hooks.applyRemoteStaff(items); dirty = true; }
      }
      if (resp.audit && resp.audit.length) hooks.mergeAudit(resp.audit);
      conflicts = resp.conflicts || [];
      st.since = resp.seq;
      saveState();
      if (dirty) hooks.onDataChanged();
      emit();
    }

    async function onServerChanged() {
      /* Máy chủ đã đổi (hoặc bị đặt lại): coi như máy chủ mới — gửi lại toàn bộ dữ liệu của máy này */
      const info = await call('GET', '/api/hello', undefined, 5000).catch(() => null);
      if (!info) { setStatus('offline', 'mất kết nối máy chủ'); return; }
      const ok = await hooks.confirmAdopt({ localRecords: store.getAll().length, serverRecords: info.records, reason: 'server-changed' });
      if (!ok) { st.paused = true; saveState(); setStatus('paused'); return; }
      adopt(info.serverId);
    }

    /* Nạp toàn bộ dữ liệu của máy này lên máy chủ (lần nối đầu tiên / sang máy chủ mới) */
    function adopt(serverId) {
      try { storage.setItem(KEY_PRESYNC, JSON.stringify({ at: new Date(nowMs()).toISOString(), serverId, records: store.getAll(), staff: hooks.getStaff(), types: hooks.getTypes() })); } catch (e) { /* quá lớn: bỏ qua */ }
      st.serverId = serverId;
      st.since = 0;
      st.typesRv = 0;
      st.staffSnap = {};
      store.clearSyncMeta();
      queue = [];
      store.getAll().forEach((r) => enqueueCreate(r));
      queue.push({ opId: newOpId(), kind: 'types', base: 0, merge: true, after: null, sent: false });
      hooks.getStaff().forEach((s) => {
        st.staffSnap[s.name.toLowerCase()] = JSON.stringify(s);
        queue.push({ opId: newOpId(), kind: 'staff', key: s.name.toLowerCase(), name: s.name, entry: clone(s), ts: 0, sent: false });
      });
      const audit = hooks.getAudit();
      for (let i = 0; i < audit.length; i += 200) queue.push({ opId: newOpId(), kind: 'audit', entries: clone(audit.slice(i, i + 200)), sent: false });
      saveState(); saveQueue();
    }

    async function pullLoop(token) {
      let fails = 0;
      while (running && token === loopToken) {
        try {
          const resp = await call('GET', '/api/sync?since=' + st.since + '&wait=' + o.waitSec, undefined, (o.waitSec + 12) * 1000);
          if (!running || token !== loopToken) return;
          if (st.serverId && resp.serverId && resp.serverId !== st.serverId) { await onServerChanged(); fails = 0; continue; }
          applyPull(resp);
          fails = 0;
          st.lastOkAt = new Date(nowMs()).toISOString();
          if (status !== 'online') setStatus('online');
          if (queue.length) scheduleFlush();
        } catch (e) {
          if (!running || token !== loopToken) return;
          setStatus('offline', e && e.message);
          const wait = Math.min(o.backoffMaxMs, 1000 * Math.pow(2, Math.min(fails, 5)));
          fails += 1;
          await new Promise((resolve) => { kick = resolve; sleepFn(wait).then(resolve); });
          kick = null;
        }
      }
    }

    function startLoops() {
      if (running) return;
      running = true;
      loopToken += 1;
      setStatus('connecting');
      pullLoop(loopToken);
      scheduleFlush();
    }
    function stopLoops() { running = false; loopToken += 1; if (kick) kick(); if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; } }

    /* ---------- Điều khiển từ giao diện ---------- */
    async function probe(url, timeoutMs) {
      const info = await call('GET', '/api/hello', undefined, timeoutMs || 4000, url);
      if (!info || info.app !== 'LabEntry-LAN') throw new Error('Địa chỉ này không phải máy chủ LabEntry');
      return info;
    }

    async function connect(urlInput) {
      const url = normalizeUrl(urlInput);
      if (!url) return { ok: false, error: 'Địa chỉ máy chủ chưa đúng. Ví dụ: 192.168.1.10' };
      let info;
      try { info = await probe(url); }
      catch (e) { return { ok: false, error: 'Không nối được tới ' + url + (e && e.message ? ' (' + e.message + ')' : '') }; }
      const changed = !!st.serverId && st.serverId !== info.serverId;
      const fresh = !st.serverId || changed;
      if (fresh) {
        const n = store.getAll().length;
        const ok = await hooks.confirmAdopt({ localRecords: n, serverRecords: info.records, reason: changed ? 'server-changed' : 'first' });
        if (!ok) return { ok: false, error: 'Đã hủy — chưa nối máy chủ' };
      }
      stopLoops();
      st.url = url;
      st.enabled = true;
      st.paused = false;
      if (fresh) adopt(info.serverId); else { saveState(); }
      startLoops();
      return { ok: true, info };
    }

    function disconnect() { st.paused = true; saveState(); stopLoops(); setStatus('paused'); }
    async function resume() { if (!st.enabled) return { ok: false }; st.paused = false; saveState(); startLoops(); return { ok: true }; }
    /* Quên máy chủ: dữ liệu cục bộ giữ nguyên, bỏ hàng đợi (các thay đổi chưa gửi KHÔNG còn được gửi) */
    function forget() {
      stopLoops();
      st = Object.assign({}, st, { enabled: false, paused: false, url: '', serverId: '', since: 0, typesRv: 0, staffSnap: {}, lastOkAt: null });
      queue = []; conflicts = [];
      saveState(); saveQueue(); setStatus('off');
    }

    function init() {
      if (st.enabled && !st.paused && st.url) startLoops(); else if (st.enabled) setStatus('paused'); else setStatus('off');
    }

    async function resolveConflict(id, choice) {
      const r = await call('POST', '/api/conflicts/resolve', { id, choice, by: hooks.getOperator() }, 15000);
      conflicts = conflicts.filter((c) => c.id !== id);
      emit();
      if (kick) kick();
      return r;
    }

    async function importRecords(records) {
      const r = await call('POST', '/api/import', { records }, 120000);
      return r;
    }

    async function syncNow() {
      if (kick) kick();
      await flush();
    }

    /* Tìm máy chủ trong mạng LAN: thử các địa chỉ hay gặp (đầu vào do giao diện cung cấp) */
    async function discover(candidates, onProgress) {
      const list = candidates.slice();
      let found = null;
      let done = 0;
      const worker = async () => {
        while (list.length && !found) {
          const url = list.shift();
          try { const info = await probe(url, 900); if (!found) found = { url, info }; } catch (e) { /* thử địa chỉ khác */ }
          done += 1;
          if (onProgress) onProgress(done);
        }
      };
      await Promise.all(Array.from({ length: 40 }, worker));
      return found;
    }

    return {
      onStoreChange, setBaseHint, clearBaseHint, notifyTypes, notifyStaff, notifyAudit, init, connect, disconnect, resume, forget, syncNow, resolveConflict, importRecords, discover, probe,
      getStatus, getConflicts: () => conflicts.slice(), getQueue: () => queue.slice(), getState: () => clone(st), normalizeUrl,
      kick: () => { if (kick) kick(); scheduleFlush(); }, _flush: flush, _call: call,
    };
  }

  return { create, normalizeUrl };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LabSync;
}

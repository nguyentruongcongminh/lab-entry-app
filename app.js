'use strict';
/* app.js — Điều khiển giao diện LabEntry. Logic nghiệp vụ nằm ở store.js, khai báo loại XN ở config.js */

const store = LabStore.createStore(null, getTestType);

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* dd/mm/yyyy hh:mm — dùng cho danh sách */
function fmtList(iso) {
  const d = new Date(iso);
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
/* hh:mm:ss dd/mm/yyyy — giống ô "Ngày Giờ" trong form mẫu */
function fmtFull(iso) {
  const d = new Date(iso);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + ' ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}
/* yyyy-mm-dd (giá trị ô chọn ngày) -> dd/mm/yyyy để in ra giấy; đổi thuần chuỗi
   nên không lệch ngày theo múi giờ */
function fmtDayInput(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : (v || '...');
}
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function todayKey() { return LabStore.localDayKey(new Date()); }

const STATUS_LABEL = { 'no-result': 'Chưa kết quả', 'pending-release': 'Chờ phát hành', 'released': 'Đã phát hành' };

let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ================= Điều hướng ================= */
let mainView = 'today';
function switchView(name) {
  ['today', 'manage', 'export', 'form', 'types', 'typeform', 'printcfg'].forEach((v) => $('view-' + v).classList.toggle('hidden', v !== name));
  const subView = name === 'form' || name === 'types' || name === 'typeform' || name === 'printcfg';
  $('bottom-nav').style.display = subView ? 'none' : 'flex';
  /* Nút + hiện ở tab Hôm nay và tab Quản lý; ẩn ở tab Lọc & Xuất và các màn hình phụ */
  $('fab-add').classList.toggle('hidden', subView || name === 'export');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'today' || name === 'manage' || name === 'export') mainView = name;
  if (name === 'today') renderToday();
  if (name === 'manage') renderManage();
  if (name === 'export') applyExport();
  if (name === 'types') renderTypes();
  window.scrollTo(0, 0);
}

/* ================= Danh sách dùng chung ================= */
/* Đếm ngược dạng "19:59" (phút:giây) cho đồng hồ bấm giờ */
function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/* Thời gian đã chờ, dạng gọn: "45 phút", "1 giờ 05 phút", "3 giờ" */
function fmtWait(iso) {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins + ' phút';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + ' giờ' + (m > 0 ? ' ' + (m < 10 ? '0' : '') + m + ' phút' : '');
}

function recordItemHTML(rec, opts) {
  const o = opts || {};
  const type = getTestType(rec.typeId);
  const status = store.statusOf(rec);
  /* Mẫu đang chờ mà quá ngưỡng (mặc định 60 phút) -> cảnh báo để không sót mẫu */
  const isOverdue = (status === 'no-result' || status === 'pending-release') &&
    (Date.now() - new Date(rec.createdAt).getTime() > (LAB_CONFIG.overdueMinutes || 60) * 60000);
  const waitLine = isOverdue ? '<div class="record-wait">Đã chờ ' + esc(fmtWait(rec.createdAt)) + '</div>' : '';
  const checkbox = o.selectable
    ? '<input type="checkbox" data-select="' + rec.uid + '"' + (selectedUids.has(rec.uid) ? ' checked' : '') + '>'
    : '';
  const releaseBtn = (!o.readonly && status === 'pending-release')
    ? '<button class="icon-btn release-btn" data-action="release" data-uid="' + rec.uid + '" title="Phát hành kết quả" aria-label="Phát hành kết quả">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z"/></svg></button>'
    : '';
  /* Nút Bấm giờ — chỉ ở mẫu CHƯA có kết quả, thuộc loại test nhanh có waitMinutes (vd Máu ẩn 20 phút).
     Mỗi mẫu một đồng hồ riêng, mốc kết thúc lưu ngay trên bản ghi (timerEndsAt). */
  let timerBtn = '';
  if (!o.readonly && status === 'no-result' && type && type.waitMinutes) {
    const endsMs = rec.timerEndsAt ? new Date(rec.timerEndsAt).getTime() : 0;
    const remainMs = endsMs - Date.now();
    if (!rec.timerEndsAt) {
      timerBtn = '<button class="timer-btn" data-action="timer" data-uid="' + rec.uid + '" title="Bấm giờ chờ kết quả" aria-label="Bấm giờ">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3.5h5"/></svg>Bấm giờ</button>';
    } else if (remainMs > 0) {
      timerBtn = '<button class="timer-btn running" data-action="timer" data-uid="' + rec.uid + '" title="Đang đếm — bấm để hủy bấm giờ" aria-label="Đang bấm giờ">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3.5h5"/></svg><span data-countdown data-ends="' + endsMs + '" data-uid="' + rec.uid + '">' + fmtCountdown(remainMs) + '</span></button>';
    } else {
      timerBtn = '<button class="timer-btn due" data-action="timer" data-uid="' + rec.uid + '" title="Đã tới giờ — bấm để nhập kết quả ngay" aria-label="Tới giờ nhập kết quả">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3.5h5"/></svg>Nhập KQ ngay</button>';
    }
  }
  /* Nút Xem lớn — chỉ hiện khi bản ghi ĐÃ CÓ kết quả */
  const viewBtn = store.hasResult(rec)
    ? '<button class="view-btn" data-action="view" data-uid="' + rec.uid + '" title="Xem tóm tắt kết quả" aria-label="Xem tóm tắt kết quả">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Xem</button>'
    : '';
  const editDeleteBtns = o.readonly ? '' :
      '<button class="icon-btn" data-action="delete" data-uid="' + rec.uid + '" title="Xóa" aria-label="Xóa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>' +
      '<button class="icon-btn" data-action="edit" data-uid="' + rec.uid + '" title="Sửa" aria-label="Sửa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></svg></button>';
  const actions = (!viewBtn && !timerBtn && o.readonly) ? '' :
    '<div class="record-actions">' + viewBtn + timerBtn + releaseBtn + editDeleteBtns + '</div>';
  const timerDue = status === 'no-result' && !!rec.timerEndsAt && new Date(rec.timerEndsAt).getTime() <= Date.now();
  return '<li class="record-item' + (isOverdue ? ' overdue' : '') + (timerDue ? ' timer-due' : '') + '">' + checkbox +
    '<div class="record-main"><div class="record-id">' + esc(rec.testId) + '</div>' +
    '<div class="record-type">' + esc(type ? type.name : rec.typeId) + '</div>' + waitLine + '</div>' +
    '<div class="record-side"><span class="record-time">' + esc(fmtList(rec.createdAt)) + '</span>' +
    '<span class="status-tag ' + status + '">' + STATUS_LABEL[status] + '</span>' + actions + '</div></li>';
}

function fillList(ulEl, emptyEl, recs, opts) {
  ulEl.innerHTML = recs.map((r) => recordItemHTML(r, opts)).join('');
  emptyEl.classList.toggle('hidden', recs.length > 0);
}

function handleListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (btn) {
    const uid = btn.dataset.uid;
    if (btn.dataset.action === 'view') openSummary(uid);
    if (btn.dataset.action === 'timer') toggleTimer(uid);
    if (btn.dataset.action === 'release') {
      const rec = store.getByUid(uid);
      /* Phát hành ngay khi bấm — không hỏi xác nhận lại (theo yêu cầu của Minh) */
      if (rec && store.statusOf(rec) === 'pending-release') {
        const res = store.update(uid, { releaseAt: new Date().toISOString(), releaser: currentOperator });
        if (res.ok) { toast('Đã phát hành kết quả ' + rec.testId); refreshCurrent(); }
        else toast(res.errors.join('. '));
      }
    }
    if (btn.dataset.action === 'edit') openForm(uid);
    if (btn.dataset.action === 'delete') {
      const rec = store.getByUid(uid);
      if (rec && confirm('Xóa kết quả ' + rec.testId + ' (' + (getTestType(rec.typeId) || {}).name + ')?')) {
        store.remove(uid);
        selectedUids.delete(uid);
        toast('Đã xóa');
        refreshCurrent();
      }
    }
    return;
  }
  const cb = e.target.closest('[data-select]');
  if (cb) {
    if (cb.checked) selectedUids.add(cb.dataset.select); else selectedUids.delete(cb.dataset.select);
    updateSelectBar();
  }
}

/* ================= Xem tóm tắt kết quả =================
 * Bảng tóm tắt chữ to, gọn, dễ đọc — để nhìn và chép kết quả vào máy ở lab. */
function fieldDisplayValue(rec, f) {
  const v = (rec.results && rec.results[f.key]) || '';
  if (f.type === 'chips') return v === '' ? 'Âm tính' : v;
  return v === '' ? '—' : v;
}

let summaryUid = null;

function openSummary(uid) {
  const rec = store.getByUid(uid);
  if (!rec) return;
  summaryUid = uid;
  const type = getTestType(rec.typeId);
  const status = store.statusOf(rec);
  /* Trang xem có luôn nút Phát hành khi kết quả đang Chờ phát hành */
  $('btn-summary-release').classList.toggle('hidden', status !== 'pending-release');
  $('sum-id').textContent = rec.testId;
  $('sum-type').textContent = type ? type.name : rec.typeId;
  const tag = $('sum-status');
  tag.textContent = STATUS_LABEL[status];
  tag.className = 'status-tag ' + status;
  $('sum-fields').innerHTML = (type ? type.fields : []).map((f) =>
    '<div class="summary-row"><span class="s-label">' + esc(f.label) + '</span>' +
    '<span class="s-value">' + esc(fieldDisplayValue(rec, f)) + '</span></div>').join('');
  const noteEl = $('sum-note');
  if (rec.note && rec.note.trim() !== '') {
    noteEl.textContent = 'Ghi chú: ' + rec.note;
    noteEl.classList.remove('hidden');
  } else {
    noteEl.classList.add('hidden');
  }
  $('sum-created').textContent = fmtFull(rec.createdAt);
  $('sum-release').textContent = rec.releaseAt ? fmtFull(rec.releaseAt) : 'Chưa phát hành';
  /* Dấu KTV (v27): chỉ hiện khối khi có ít nhất một dấu */
  const hasStaff = !!(rec.receiver || rec.performer || rec.releaser);
  $('sum-staff').classList.toggle('hidden', !hasStaff);
  if (hasStaff) {
    $('sum-receiver').textContent = rec.receiver || '—';
    $('sum-performer').textContent = rec.performer || '—';
    $('sum-releaser').textContent = rec.releaser || '—';
  }
  $('btn-summary-unrelease').classList.toggle('hidden', status !== 'released');
  $('summary-modal').classList.remove('hidden');
}

function closeSummary() {
  $('summary-modal').classList.add('hidden');
}

/* Phát hành ngay từ trang xem tóm tắt — không hỏi lại, và phát hành xong
   TỰ THOÁT trang xem về danh sách (yêu cầu của Minh, v26) — không bắt người
   dùng bấm thêm nút Đóng */
function releaseFromSummary() {
  if (!summaryUid) return;
  const rec = store.getByUid(summaryUid);
  if (!rec || store.statusOf(rec) !== 'pending-release') return;
  const res = store.update(rec.uid, { releaseAt: new Date().toISOString(), releaser: currentOperator });
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  toast('Đã phát hành kết quả ' + rec.testId);
  closeSummary();
  refreshCurrent();
}

/* Hủy phát hành từ trang xem — có hỏi xác nhận 1 lần (v27): xóa giờ phát hành
   và dấu KTV phát hành, bản ghi quay về Chờ phát hành */
function unreleaseFromSummary() {
  if (!summaryUid) return;
  const rec = store.getByUid(summaryUid);
  if (!rec || store.statusOf(rec) !== 'released') return;
  if (!confirm('Hủy phát hành kết quả ' + rec.testId + '? Mẫu sẽ quay về trạng thái Chờ phát hành.')) return;
  const res = store.update(rec.uid, { releaseAt: null, releaser: '' });
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  toast('Đã hủy phát hành kết quả ' + rec.testId);
  closeSummary();
  refreshCurrent();
}

/* ================= Bấm giờ chờ kết quả (test nhanh) =================
 * Mỗi bản ghi một đồng hồ riêng: timerEndsAt lưu ngay trên bản ghi.
 * - Chưa bấm: bấm nút -> bắt đầu đếm (waitMinutes của loại XN, vd Máu ẩn = 20 phút)
 * - Đang đếm: bấm nút -> hủy bấm giờ
 * - Tới giờ: dòng mẫu sáng đỏ + nút thành "Nhập KQ ngay" -> bấm mở thẳng form nhập
 */
const dueAlerted = new Set();

function beepDue() {
  beep(1560, 130);
  setTimeout(() => beep(1560, 130), 240);
  setTimeout(() => beep(1560, 220), 480);
  if (navigator.vibrate) navigator.vibrate([220, 110, 220]);
}

function toggleTimer(uid) {
  const rec = store.getByUid(uid);
  if (!rec || store.statusOf(rec) !== 'no-result') return;
  const type = getTestType(rec.typeId);
  if (!type || !type.waitMinutes) return;
  const endsMs = rec.timerEndsAt ? new Date(rec.timerEndsAt).getTime() : 0;
  if (rec.timerEndsAt && endsMs > Date.now()) {
    store.update(uid, { timerEndsAt: null });
    dueAlerted.delete(uid);
    toast('Đã hủy bấm giờ cho ' + rec.testId);
    refreshCurrent();
    return;
  }
  if (rec.timerEndsAt && endsMs <= Date.now()) {
    openForm(uid);
    return;
  }
  const ends = new Date(Date.now() + type.waitMinutes * 60000).toISOString();
  const res = store.update(uid, { timerEndsAt: ends });
  if (res.ok) {
    beepOk();
    toast('Đã bấm giờ ' + type.waitMinutes + ' phút cho ' + rec.testId + ' (' + type.name + ')');
    refreshCurrent();
  } else {
    toast(res.errors.join('. '));
  }
}

/* Chạy mỗi giây: cập nhật số đếm ngược tại chỗ; mẫu nào vừa tới giờ thì báo đặc biệt một lần.
   Mốc kết thúc luôn đọc từ dữ liệu gốc (store), không đọc từ thuộc tính đã render. */
function timerTick() {
  const now = Date.now();
  let crossed = false;
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const rec = store.getByUid(el.dataset.uid);
    if (!rec || !rec.timerEndsAt) return;
    const remain = new Date(rec.timerEndsAt).getTime() - now;
    if (remain > 0) {
      el.textContent = fmtCountdown(remain);
    } else if (!dueAlerted.has(rec.uid)) {
      dueAlerted.add(rec.uid);
      crossed = true;
      beepDue();
      toast('Tới giờ nhập kết quả: ' + rec.testId + ' (' + (getTestType(rec.typeId) || {}).name + ')');
    }
  });
  if (crossed) refreshCurrent();
}

function refreshCurrent() {
  if (!$('view-today').classList.contains('hidden')) renderToday();
  if (!$('view-manage').classList.contains('hidden')) renderManage();
  if (!$('view-export').classList.contains('hidden')) applyExport();
}

/* ================= Tab Kết quả hôm nay ================= */
let selectMode = false;
const selectedUids = new Set();

function renderToday() {
  const q = $('input-search').value.trim();
  let recs = store.filter(null, { from: todayKey(), to: todayKey() });
  if (q) recs = store.filter(recs, { query: q });
  /* Xếp theo giờ nhập tăng dần: nhập trước ở trên, mới nhất nằm cuối cùng */
  recs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  fillList($('list-today'), $('empty-today'), recs, { selectable: selectMode });
  updateSelectBar();
}

function updateSelectBar() {
  $('select-bar').classList.toggle('hidden', !selectMode);
  $('selected-count').textContent = 'Đã chọn ' + selectedUids.size;
}

function setSelectMode(on) {
  selectMode = on;
  if (!on) selectedUids.clear();
  renderToday();
}

/* ================= Tab Quản lý ================= */
/* Thanh thống kê ở đầu tab Quản lý: nhận/phát hành tính theo hôm nay, tồn chờ tính tổng */
function renderStats(all) {
  const dayKey = (iso) => { if (!iso) return ''; const d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
  const today = dayKey(new Date().toISOString());
  let received = 0, released = 0, noresult = 0, pending = 0;
  all.forEach((r) => {
    const st = store.statusOf(r);
    if (st === 'no-result') noresult += 1;
    if (st === 'pending-release') pending += 1;
    if (dayKey(r.createdAt) === today) received += 1;
    if (r.releaseAt && dayKey(r.releaseAt) === today) released += 1;
  });
  $('stat-received').textContent = received;
  $('stat-noresult').textContent = noresult;
  $('stat-pending').textContent = pending;
  $('stat-released').textContent = released;
}

/* Tab Quản lý chỉ hiện MỘT khung tại một thời điểm (v23): mặc định là khung
   Chưa kết quả (việc cần thao tác trước); khung Chờ phát hành ẩn, mở bằng nút chuyển. */
let managePanel = 'noresult';

function setManagePanel(panel) {
  managePanel = panel === 'pending' ? 'pending' : 'noresult';
  renderManage();
}

function renderManage() {
  const all = store.getAll();
  renderStats(all);
  /* Chờ phát hành: mới nhất lên đầu */
  const pending = all.filter((r) => store.statusOf(r) === 'pending-release')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  /* Chưa kết quả (chờ nhập KQ): xếp theo giờ nhận mẫu — nhận trước lên đầu, nhận sau xuống cuối */
  const noresult = all.filter((r) => store.statusOf(r) === 'no-result')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  fillList($('list-pending'), $('empty-pending'), pending, {});
  fillList($('list-noresult'), $('empty-noresult'), noresult, {});
  /* Áp dụng khung đang chọn + cập nhật số đếm trên 2 nút chuyển */
  $('group-noresult').classList.toggle('hidden', managePanel !== 'noresult');
  $('group-pending').classList.toggle('hidden', managePanel !== 'pending');
  $('btn-panel-noresult').classList.toggle('active', managePanel === 'noresult');
  $('btn-panel-pending').classList.toggle('active', managePanel === 'pending');
  $('count-noresult').textContent = noresult.length;
  $('count-pending').textContent = pending.length;
}

/* ================= Tab Lọc & Xuất PDF ================= */
function resultSummary(rec) {
  const type = getTestType(rec.typeId);
  if (!type) return '';
  return type.fields.map((f) => {
    const v = (rec.results && rec.results[f.key]) || '';
    const shown = f.type === 'chips' ? (v === '' ? 'Âm tính' : v) : (v === '' ? '—' : v);
    return esc(f.label) + ': ' + esc(shown);
  }).join('<br>');
}

function currentExportCriteria() {
  return {
    from: $('f-from').value || '',
    to: $('f-to').value || '',
    typeId: $('f-type').value || '',
    status: $('f-status').value || '',
    query: $('f-query').value || '',
  };
}

const STATUS_LABELS = { 'no-result': 'Chưa kết quả', 'pending-release': 'Chờ phát hành', 'released': 'Đã phát hành' };

/* 75 -> "1 giờ 15 phút"; 40 -> "40 phút" */
function fmtDur(minutes) {
  const m = Math.round(minutes);
  if (m < 60) return m + ' phút';
  return Math.floor(m / 60) + ' giờ ' + (m % 60) + ' phút';
}

function applyExport() {
  const c = currentExportCriteria();
  const recs = store.filter(null, c).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  fillList($('list-export'), $('empty-export'), recs, { readonly: true });
  $('export-count').textContent = 'Có ' + recs.length + ' kết quả';
  const tat = LabStore.tatStats(recs);
  $('export-stats').textContent = !recs.length ? '' :
    (tat.count === 0
      ? 'Chưa có mẫu nào đã phát hành trong danh sách này nên chưa tính được thời gian trả kết quả.'
      : 'Đã phát hành ' + tat.count + '/' + recs.length + ' mẫu · Thời gian trả kết quả: trung bình ' + fmtDur(tat.avgMinutes) +
        ' · nhanh nhất ' + fmtDur(tat.minMinutes) + ' · lâu nhất ' + fmtDur(tat.maxMinutes));
  /* Vùng in: dựng theo cấu hình bản in của người dùng (v27) */
  const rangeText = (c.from || c.to) ? '(' + (c.from ? fmtDayInput(c.from) : '...') + ' đến ' + (c.to ? fmtDayInput(c.to) : '...') + ')' : '';
  const tatText = (tat.count > 0)
    ? 'Đã phát hành ' + tat.count + '/' + recs.length + ' mẫu · Thời gian trả kết quả: trung bình ' + fmtDur(tat.avgMinutes) +
      ' · nhanh nhất ' + fmtDur(tat.minMinutes) + ' · lâu nhất ' + fmtDur(tat.maxMinutes)
    : '';
  $('print-area').innerHTML = renderSheet(printSettings, recs, { rangeText, tatText });
  updatePrintPageStyle();
  return recs;
}

/* ================= Xuất CSV + thống kê TAT (F10) ================= */
/* CSV ngăn cách bằng ";" + BOM UTF-8 để mở đúng tiếng Việt trong Excel trên Windows.
   Nội dung xuất = đúng danh sách đang lọc ở tab Lọc & Xuất. */
function buildCsv(recs) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [['STT', 'ID Xét Nghiệm', 'Loại xét nghiệm', 'Kết quả', 'Ghi chú', 'Giờ nhận', 'Giờ phát hành', 'Trạng thái', 'Thời gian trả kết quả (phút)'].join(';')];
  (recs || []).forEach((rec, i) => {
    const type = getTestType(rec.typeId);
    const tatMin = rec.releaseAt ? Math.round((new Date(rec.releaseAt) - new Date(rec.createdAt)) / 60000) : '';
    lines.push([
      i + 1,
      rec.testId,
      type ? type.name : rec.typeId,
      resultSummary(rec),
      rec.note || '',
      fmtFull(rec.createdAt),
      rec.releaseAt ? fmtFull(rec.releaseAt) : '',
      STATUS_LABELS[store.statusOf(rec)] || '',
      tatMin,
    ].map(cell).join(';'));
  });
  return '\uFEFF' + lines.join('\r\n');
}

function exportCsv() {
  const recs = applyExport();
  if (!recs.length) { toast('Không có kết quả nào để xuất'); return; }
  downloadTextFile(stampName('labentry-ket-qua', '.csv'), buildCsv(recs), 'text/csv;charset=utf-8');
  toast('Đã xuất CSV: ' + recs.length + ' kết quả');
}

/* ================= Sao lưu / phục hồi (F8) ================= */
function stampName(prefix, ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return prefix + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + ext;
}

/* Tải một nội dung text xuống thành file (dùng chung cho sao lưu + CSV) */
function downloadTextFile(name, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  } catch (e) { /* môi trường không hỗ trợ tải file (vd môi trường test) */ }
}

function exportBackupFile() {
  const obj = JSON.parse(store.exportBackup());
  if (typesCustom) obj.types = getTestTypes(); /* kèm danh mục tự tạo để sang máy khác phục hồi đủ loại */
  try {
    obj.printLayout = JSON.parse(JSON.stringify(printSettings)); /* bố cục bản in đi kèm file (đợt 2) */
    obj.printPresets = JSON.parse(JSON.stringify(printPresets)); /* thư viện mẫu bố cục (v30) */
    obj.staff = staffList.slice(); /* danh sách KTV (v30) */
    obj.operator = currentOperator; /* KTV trực đang chọn (v30) */
  } catch (e) { /* bỏ qua nếu lỗi sao chép */ }
  const count = store.getAll().length;
  downloadTextFile(stampName('labentry-sao-luu', '.json'), JSON.stringify(obj, null, 2), 'application/json');
  toast('Đã xuất file sao lưu: ' + count + ' bản ghi');
}

/* Nạp dữ liệu từ nội dung file sao lưu (đồng bộ, tách riêng để test được).
   mode = 'replace' (mặc định): thay toàn bộ dữ liệu bằng dữ liệu trong file.
   mode = 'merge': chỉ thêm các mẫu máy này chưa có (trùng ID + loại thì bỏ qua),
                   dữ liệu hiện tại giữ nguyên.
   Trả về true nếu đã nạp.
   File từ v19 có thể kèm "types" (danh mục tự tạo): chế độ thay -> áp dụng nguyên
   danh mục của file; chế độ gộp -> hợp nhất (chỉ thêm loại mà máy này chưa có). */
function importBackupText(text, mode) {
  const merge = mode === 'merge';
  let fileTypes = null;
  let fileLayout = null;
  let fileStaff = null;
  let filePresets = null;
  try {
    const raw = JSON.parse(text);
    if (raw && Array.isArray(raw.types)) fileTypes = raw.types;
    if (raw && raw.printLayout && typeof raw.printLayout === 'object') fileLayout = raw.printLayout;
    if (raw && Array.isArray(raw.staff)) fileStaff = sanitizeStaffList(raw.staff);
    if (raw && Array.isArray(raw.printPresets)) filePresets = raw.printPresets.filter((p) => p && typeof p.name === 'string' && p.name.trim() && p.settings && typeof p.settings === 'object');
  } catch (e) { /* JSON hỏng: parseBackup bên dưới sẽ báo lỗi cụ thể */ }
  if (fileTypes) {
    const errs = validateTypeDefs(fileTypes);
    if (errs.length) { alert('Danh mục xét nghiệm trong file sao lưu không hợp lệ: ' + errs[0]); return false; }
  }
  const prevTypes = getTestTypes();
  const prevCustom = typesCustom;
  const restoreTypes = () => { setTestTypes(prevCustom ? prevTypes : null); typesCustom = prevCustom; };
  let appliedTypes = null;
  if (fileTypes) {
    appliedTypes = merge
      ? prevTypes.concat(fileTypes.filter((t) => !prevTypes.some((x) => x.id === t.id)))
      : fileTypes;
    setTestTypes(appliedTypes); /* áp tạm để kiểm tra bản ghi theo đúng danh mục liên quan */
  }
  let parsed;
  try {
    parsed = store.parseBackup(text);
  } catch (e) {
    restoreTypes();
    alert('Không đọc được file sao lưu: ' + e.message);
    return false;
  }
  const when = parsed.exportedAt ? fmtFull(parsed.exportedAt) : 'không rõ thời gian';
  const typeNote = fileTypes
    ? (merge ? '\nFile có kèm danh mục xét nghiệm — các loại máy này chưa có sẽ được thêm vào danh mục.' : '\nFile có kèm danh mục xét nghiệm riêng — danh mục trên máy này cũng sẽ được thay bằng danh mục trong file.')
    : '';
  const layoutNote = (!merge && fileLayout)
    ? '\nFile có kèm bố cục bản in — bố cục bản in trên máy này cũng sẽ được thay bằng bố cục trong file.'
    : '';
  const packNote = (fileStaff || filePresets)
    ? (merge
      ? '\nFile có kèm danh sách KTV và mẫu bố cục — chỉ thêm những tên/mẫu máy này chưa có. KTV trực của máy được giữ nguyên.'
      : '\nFile có kèm danh sách KTV và các mẫu bố cục — máy này sẽ dùng theo file. Riêng KTV trực sẽ đặt lại thành \'chưa chọn\' — phục hồi xong hãy chọn lại người trực.')
    : '';
  const ask = merge
    ? 'File sao lưu có ' + parsed.records.length + ' bản ghi (xuất lúc ' + when + ').' + typeNote + layoutNote + packNote + '\n\nGỘP sẽ thêm các mẫu máy này CHƯA có; mẫu trùng ID + loại sẽ bị bỏ qua. Dữ liệu hiện tại được giữ nguyên. Tiếp tục?'
    : 'File sao lưu có ' + parsed.records.length + ' bản ghi (xuất lúc ' + when + ').' + typeNote + layoutNote + packNote + '\n\nPhục hồi sẽ THAY TOÀN BỘ dữ liệu hiện tại trên máy này. Tiếp tục?';
  if (!confirm(ask)) {
    restoreTypes();
    return false;
  }
  if (merge) {
    const res = store.mergeBackup(text);
    if (fileStaff) {
      const before = staffList.length;
      fileStaff.forEach((n) => { if (!staffList.some((x) => x.name.toLowerCase() === n.name.toLowerCase())) staffList.push(n); });
      if (staffList.length !== before) { persistStaff(); renderOperatorControls(); }
    }
    if (filePresets) {
      let addedP = 0;
      filePresets.forEach((p) => {
        if (!printPresets.some((x) => x.name === p.name)) { printPresets.push({ name: p.name, settings: normalizePrintSettings(p.settings) }); addedP += 1; }
      });
      if (addedP > 0) savePresets();
    }
    if (fileTypes) persistTypes();
    refreshTypeSelects();
    refreshCurrent();
    toast('Đã gộp dữ liệu: thêm ' + res.added + ' mẫu mới, bỏ qua ' + res.skipped + ' mẫu trùng');
  } else {
    const res = store.importBackup(text);
    if (fileLayout) {
      /* Bố cục bản in trong file (đợt 2): phục hồi thì áp dụng luôn;
         gộp dữ liệu thì không đụng tới bố cục của máy này */
      printSettings = normalizePrintSettings(fileLayout);
      savePrintSettings();
      updatePrintPageStyle();
    }
    if (fileStaff) { staffList = fileStaff; persistStaff(); }
    /* Theo yêu cầu của Minh (v34): phục hồi KHÔNG nhận KTV trực từ file — luôn
       đặt lại thành "chưa chọn" để người dùng máy này tự chọn lại ca trực (qua PIN).
       Ngược lại, GỘP dữ liệu thì giữ nguyên KTV trực đang chọn của máy. */
    currentOperator = '';
    persistOperator();
    renderOperatorControls();
    if (filePresets) {
      printPresets = filePresets.map((p) => ({ name: p.name, settings: normalizePrintSettings(p.settings) }));
      savePresets();
    }
    if (fileTypes) persistTypes();
    refreshTypeSelects();
    refreshCurrent();
    toast('Đã phục hồi ' + res.count + ' bản ghi từ file sao lưu');
  }
  return true;
}

let pendingImportMode = 'replace';

async function handleBackupFile(file) {
  if (!file) return false;
  let text;
  try { text = await file.text(); } catch (e) { alert('Không đọc được file đã chọn.'); return false; }
  return importBackupText(text, pendingImportMode);
}

/* ================= Quản lý danh mục xét nghiệm (F9) =================
   Danh mục tự tạo lưu ở localStorage (khóa labentry.types.v1), nạp lúc khởi động.
   Chưa có danh mục tự tạo -> dùng 6 loại mặc định trong config.js. */
const TYPES_KEY = 'labentry.types.v1';
const LEVELS_PRESETS = { '1': ['(+)'], '2': ['(+)', '(++)'], '3': ['(+)', '(++)', '(+++)'] };
let typesCustom = false;

/* Kiểm tra một danh mục: trả về mảng lỗi (rỗng = hợp lệ) */
function validateTypeDefs(list) {
  const errors = [];
  if (!Array.isArray(list) || !list.length) { errors.push('Danh mục phải có ít nhất 1 loại xét nghiệm'); return errors; }
  const seenIds = new Set();
  list.forEach((t, ti) => {
    const where = 'Loại thứ ' + (ti + 1) + (t && t.name ? ' (' + t.name + ')' : '');
    if (!t || typeof t.id !== 'string' || !t.id.trim()) { errors.push(where + ': thiếu mã loại'); return; }
    if (seenIds.has(t.id)) errors.push(where + ': mã loại bị trùng');
    seenIds.add(t.id);
    if (typeof t.name !== 'string' || !t.name.trim()) errors.push(where + ': thiếu tên loại');
    if (t.waitMinutes !== undefined && (!isFinite(t.waitMinutes) || t.waitMinutes < 1)) errors.push(where + ': số phút bấm giờ không hợp lệ');
    if (!Array.isArray(t.fields) || !t.fields.length) { errors.push(where + ': phải có ít nhất 1 trường kết quả'); return; }
    const seenKeys = new Set();
    const fieldMap = {};
    t.fields.forEach((f, fi) => {
      const fw = where + ', trường thứ ' + (fi + 1);
      if (!f || typeof f.key !== 'string' || !f.key.trim()) { errors.push(fw + ': thiếu khóa trường'); return; }
      if (seenKeys.has(f.key)) errors.push(fw + ': khóa trường bị trùng');
      seenKeys.add(f.key);
      fieldMap[f.key] = f;
      if (typeof f.label !== 'string' || !f.label.trim()) errors.push(fw + ': thiếu nhãn trường');
      if (f.type !== 'text' && f.type !== 'chips') errors.push(fw + ': dạng trường phải là text hoặc chips');
      if (f.type === 'chips' && (!Array.isArray(f.levels) || !f.levels.length || f.levels.some((lv) => typeof lv !== 'string' || !lv))) {
        errors.push(fw + ': trường dạng nút chọn phải có ít nhất 1 mức');
      }
    });
    /* Nút nhập kết quả nhanh (v25): không bắt buộc phải có; nếu có thì phải hợp lệ */
    if (t.quick !== undefined) {
      if (!Array.isArray(t.quick)) {
        errors.push(where + ': mục nhập nhanh phải là một danh sách');
      } else {
        if (t.quick.length > 8) errors.push(where + ': mỗi loại tối đa 8 nút nhập nhanh');
        t.quick.forEach((q, qi) => {
          const qw = where + ', nút nhập nhanh thứ ' + (qi + 1);
          if (!q || typeof q.label !== 'string' || !q.label.trim()) { errors.push(qw + ': thiếu tên nút'); return; }
          if (!q.values || typeof q.values !== 'object' || Array.isArray(q.values)) { errors.push(qw + ': thiếu bộ giá trị kết quả'); return; }
          Object.keys(q.values).forEach((k) => {
            const fd = fieldMap[k];
            if (!fd) { errors.push(qw + ': giá trị gắn cho trường không tồn tại (' + k + ')'); return; }
            const v = q.values[k];
            if (typeof v !== 'string') { errors.push(qw + ': giá trị của trường ' + fd.label + ' phải là dạng chữ'); return; }
            if (fd.type === 'chips' && v !== '' && !(fd.levels || []).includes(v)) {
              errors.push(qw + ': mức của trường ' + fd.label + ' không nằm trong các mức cho phép của trường');
            }
          });
        });
      }
    }
  });
  return errors;
}

function loadSavedTypes() {
  try {
    const raw = localStorage.getItem(TYPES_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!validateTypeDefs(list).length) {
      setTestTypes(list);
      typesCustom = true;
    }
  } catch (e) { /* danh mục lưu hỏng -> dùng mặc định */ }
}

function persistTypes() {
  try { localStorage.setItem(TYPES_KEY, JSON.stringify(getTestTypes())); } catch (e) { /* bỏ qua */ }
  typesCustom = true;
}

/* Dựng lại 3 ô chọn loại (form nhập, bộ lọc, máy quét) theo danh mục hiện hành, giữ lựa chọn cũ nếu còn */
function refreshTypeSelects() {
  [['select-type', false], ['f-type', true], ['scanner-type-select', false]].forEach(([id, includeAll]) => {
    const el = $(id);
    if (!el) return;
    const prev = el.value;
    buildTypeOptions(el, includeAll);
    if ([...el.options].some((o) => o.value === prev)) el.value = prev;
  });
}

function openTypes() { switchView('types'); }

function renderTypes() {
  const ul = $('types-list');
  const all = store.getAll();
  ul.innerHTML = '';
  getTestTypes().forEach((t) => {
    const used = all.filter((r) => r.typeId === t.id).length;
    const li = document.createElement('li');
    li.innerHTML =
      '<div class="type-info"><div class="type-name">' + esc(t.name) + '</div>' +
      '<div class="type-meta">' + t.fields.length + ' trường kết quả' +
      (t.quick && t.quick.length ? ' · ⚡ ' + t.quick.length + ' nút nhập nhanh' : '') +
      (t.waitMinutes ? ' · ⏱ bấm giờ ' + t.waitMinutes + ' phút' : '') +
      (used ? ' · đang có ' + used + ' bản ghi' : '') + '</div></div>' +
      '<div class="type-actions">' +
      '<button type="button" class="mini-btn" data-tedit="' + esc(t.id) + '">Sửa</button>' +
      '<button type="button" class="mini-btn danger" data-tdel="' + esc(t.id) + '">Xóa</button></div>';
    ul.appendChild(li);
  });
  $('empty-types').classList.toggle('hidden', getTestTypes().length > 0);
}

function deleteType(typeId) {
  const t = getTestType(typeId);
  if (!t) return;
  const used = store.getAll().filter((r) => r.typeId === typeId).length;
  if (used > 0) {
    alert('Không xóa được: đang có ' + used + ' bản ghi thuộc loại "' + t.name + '". Muốn xóa loại này, trước hết phải xóa/đổi các bản ghi đó.');
    return;
  }
  if (getTestTypes().length <= 1) { alert('Phải giữ lại ít nhất 1 loại xét nghiệm.'); return; }
  if (!confirm('Xóa loại xét nghiệm "' + t.name + '" khỏi danh mục?')) return;
  setTestTypes(getTestTypes().filter((x) => x.id !== typeId));
  persistTypes();
  refreshTypeSelects();
  renderTypes();
  toast('Đã xóa loại ' + t.name);
}

function resetTypes() {
  const defaults = LAB_CONFIG.testTypes;
  const orphans = store.getAll().filter((r) => !defaults.some((t) => t.id === r.typeId)).length;
  if (orphans > 0) {
    alert('Chưa khôi phục mặc định được: đang có ' + orphans + ' bản ghi thuộc các loại tự thêm. Hãy xóa các bản ghi đó trước.');
    return;
  }
  if (!confirm('Khôi phục danh mục về 6 loại mặc định ban đầu? Các loại tự thêm (chưa có bản ghi) sẽ bị xóa.')) return;
  try { localStorage.removeItem(TYPES_KEY); } catch (e) { /* bỏ qua */ }
  setTestTypes(null);
  typesCustom = false;
  refreshTypeSelects();
  renderTypes();
  toast('Đã khôi phục 6 loại mặc định');
}

/* ---- Form thêm/sửa một loại ---- */
let typeFormState = null;

function slugWords(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}
function uniqueKey(base, used) {
  let k = base || 'truong';
  let n = 2;
  while (used.has(k)) { k = (base || 'truong') + (n++); }
  used.add(k);
  return k;
}

function openTypeForm(typeId) {
  const src = typeId ? getTestType(typeId) : null;
  typeFormState = src
    ? { id: src.id, fields: src.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, levels: (f.levels || LEVELS_PRESETS['3']).slice() })),
        quick: (src.quick || []).map((q) => ({ label: q.label, values: Object.assign({}, q.values) })) }
    : { id: null, fields: [{ key: '', label: '', type: 'text', levels: LEVELS_PRESETS['3'].slice() }], quick: [] };
  ensureTypeFormKeys();
  $('tf-title').textContent = src ? 'Sửa loại xét nghiệm' : 'Thêm loại xét nghiệm';
  $('tf-name').value = src ? src.name : '';
  $('tf-wait').value = src && src.waitMinutes ? src.waitMinutes : '';
  $('tf-error').classList.add('hidden');
  renderTypeFieldRows();
  renderTypeQuickRows();
  switchView('typeform');
}

/* Mọi trường trong form sửa loại phải có khóa ngay từ đầu (v25): các nút nhập
   nhanh gắn giá trị theo khóa trường, nên không thể chờ tới lúc lưu mới sinh khóa.
   Trường mới chưa có nhãn thì nhận khóa tạm "truong..." và được sinh lại theo
   nhãn ngay khi người dùng gõ nhãn (xem maybeRegenFieldKey). */
function ensureTypeFormKeys() {
  const used = new Set(typeFormState.fields.map((f) => f.key).filter(Boolean));
  typeFormState.fields.forEach((f) => {
    if (f.key) return;
    const words = slugWords((f.label || '').trim());
    const camel = words.length ? words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('') : '';
    f.key = uniqueKey(camel, used);
  });
}

function maybeRegenFieldKey(i) {
  const f = typeFormState.fields[i];
  if (!f.key || !/^truong\d*$/.test(f.key)) return;
  const words = slugWords((f.label || '').trim());
  if (!words.length) return;
  const camel = words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const used = new Set(typeFormState.fields.map((x, xi) => (xi === i ? null : x.key)).filter(Boolean));
  const nk = uniqueKey(camel, used);
  if (nk === f.key) return;
  const old = f.key;
  f.key = nk;
  typeFormState.quick.forEach((q) => {
    if (Object.prototype.hasOwnProperty.call(q.values, old)) { q.values[nk] = q.values[old]; delete q.values[old]; }
  });
}

/* Thẻ sửa từng nút nhập nhanh: tên nút + một ô giá trị cho mỗi trường kết quả */
function renderTypeQuickRows() {
  const wrap = $('tf-quicks');
  if (!wrap || !typeFormState) return;
  wrap.innerHTML = '';
  typeFormState.quick.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'tf-quick';
    let html = '<div class="tf-quick-head">' +
      '<input type="text" class="tq-label" placeholder="Tên nút, vd: Âm tính" value="' + esc(q.label) + '">' +
      '<button type="button" class="mini-btn danger tq-del" title="Xóa nút nhập nhanh">✕</button></div>';
    typeFormState.fields.forEach((f) => {
      const v = q.values[f.key] || '';
      html += '<div class="tq-row"><span class="tq-flabel">' + esc(f.label || '(chưa đặt tên trường)') + '</span>';
      if (f.type === 'chips') {
        html += '<select class="tq-val" data-qfield="' + esc(f.key) + '">' +
          '<option value=""' + (v === '' ? ' selected' : '') + '>— Âm tính (bỏ trống)</option>' +
          (f.levels || []).map((lv) => '<option value="' + esc(lv) + '"' + (v === lv ? ' selected' : '') + '>' + esc(lv) + '</option>').join('') +
          '</select>';
      } else {
        html += '<input type="text" class="tq-val" data-qfield="' + esc(f.key) + '" value="' + esc(v) + '" placeholder="Để trống = không ghi" autocomplete="off">';
      }
      html += '</div>';
    });
    card.innerHTML = html;
    card.querySelector('.tq-label').addEventListener('input', (e) => { typeFormState.quick[qi].label = e.target.value; });
    card.querySelectorAll('.tq-val').forEach((inp) => {
      inp.addEventListener('input', () => { typeFormState.quick[qi].values[inp.dataset.qfield] = inp.value; });
      inp.addEventListener('change', () => { typeFormState.quick[qi].values[inp.dataset.qfield] = inp.value; });
    });
    card.querySelector('.tq-del').addEventListener('click', () => {
      typeFormState.quick.splice(qi, 1);
      renderTypeQuickRows();
    });
    wrap.appendChild(card);
  });
}

function renderTypeFieldRows() {
  const wrap = $('tf-fields');
  wrap.innerHTML = '';
  typeFormState.fields.forEach((f, i) => {
    const preset = f.type === 'chips' ? String(Math.min(3, Math.max(1, (f.levels || []).length))) : '3';
    const row = document.createElement('div');
    row.className = 'tf-field';
    row.innerHTML =
      '<input type="text" class="tf-flabel" placeholder="Nhãn trường, vd: Kết quả" value="' + esc(f.label) + '">' +
      '<select class="tf-fkind">' +
      '<option value="text"' + (f.type === 'text' ? ' selected' : '') + '>Ô nhập chữ</option>' +
      '<option value="chips"' + (f.type === 'chips' ? ' selected' : '') + '>Nút chọn mức (+)</option></select>' +
      '<select class="tf-flevels"' + (f.type === 'chips' ? '' : ' disabled') + '>' +
      '<option value="1"' + (preset === '1' ? ' selected' : '') + '>1 mức: (+)</option>' +
      '<option value="2"' + (preset === '2' ? ' selected' : '') + '>2 mức: (+), (++)</option>' +
      '<option value="3"' + (preset === '3' ? ' selected' : '') + '>3 mức: (+), (++), (+++)</option></select>' +
      '<button type="button" class="mini-btn danger tf-fdel" title="Xóa trường">✕</button>';
    const labelInp = row.querySelector('.tf-flabel');
    const kindSel = row.querySelector('.tf-fkind');
    const levelsSel = row.querySelector('.tf-flevels');
    labelInp.addEventListener('input', () => {
      typeFormState.fields[i].label = labelInp.value;
      maybeRegenFieldKey(i);
    });
    labelInp.addEventListener('change', () => renderTypeQuickRows());
    kindSel.addEventListener('change', () => {
      typeFormState.fields[i].type = kindSel.value;
      levelsSel.disabled = kindSel.value !== 'chips';
      renderTypeQuickRows();
    });
    levelsSel.addEventListener('change', () => {
      typeFormState.fields[i].levels = LEVELS_PRESETS[levelsSel.value].slice();
      renderTypeQuickRows();
    });
    row.querySelector('.tf-fdel').addEventListener('click', () => {
      if (typeFormState.fields.length <= 1) { toast('Mỗi loại cần ít nhất 1 trường kết quả'); return; }
      const removedKey = typeFormState.fields[i].key;
      typeFormState.fields.splice(i, 1);
      typeFormState.quick.forEach((q) => { delete q.values[removedKey]; });
      renderTypeFieldRows();
      renderTypeQuickRows();
    });
    wrap.appendChild(row);
  });
}

function showTypeError(msg) {
  const el = $('tf-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function saveTypeForm() {
  const name = $('tf-name').value.trim();
  if (!name) { showTypeError('Chưa nhập tên loại xét nghiệm'); return; }
  const waitRaw = $('tf-wait').value.trim();
  let waitMinutes = null;
  if (waitRaw !== '') {
    waitMinutes = parseInt(waitRaw, 10);
    if (!isFinite(waitMinutes) || waitMinutes < 1) { showTypeError('Số phút bấm giờ phải là số nguyên từ 1 trở lên, hoặc để trống'); return; }
  }
  const labels = typeFormState.fields.map((f) => (f.label || '').trim());
  if (labels.some((l) => !l)) { showTypeError('Còn trường chưa có nhãn — hãy đặt tên cho mọi trường kết quả'); return; }
  const lower = labels.map((l) => l.toLowerCase());
  if (new Set(lower).size !== lower.length) { showTypeError('Các trường đang trùng nhãn — mỗi trường cần một nhãn riêng'); return; }
  const usedKeys = new Set();
  const fields = typeFormState.fields.map((f, i) => {
    const words = slugWords(labels[i]);
    const camel = words.length ? words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('') : '';
    const out = { key: f.key || uniqueKey(camel, usedKeys), label: labels[i], type: f.type };
    if (f.key) usedKeys.add(f.key);
    if (f.type === 'chips') out.levels = (f.levels && f.levels.length ? f.levels : LEVELS_PRESETS['3']).slice();
    return out;
  });
  let id = typeFormState.id;
  if (!id) {
    const usedIds = new Set(getTestTypes().map((t) => t.id));
    const base = slugWords(name).join('-') || 'loai-' + Date.now().toString(36);
    id = base;
    let n = 2;
    while (usedIds.has(id)) { id = base + '-' + (n++); }
  }
  /* Nút nhập nhanh: tên nút bắt buộc; giá trị chỉ giữ cho các trường còn tồn tại */
  const fieldKeys = new Set(fields.map((f) => f.key));
  const quick = [];
  for (let qi = 0; qi < typeFormState.quick.length; qi++) {
    const q = typeFormState.quick[qi];
    const qlabel = (q.label || '').trim();
    if (!qlabel) { showTypeError('Nút nhập nhanh thứ ' + (qi + 1) + ' chưa có tên — hãy đặt tên hoặc xóa nút đó'); return; }
    const values = {};
    Object.keys(q.values || {}).forEach((k) => { if (fieldKeys.has(k)) values[k] = q.values[k]; });
    quick.push({ label: qlabel, values });
  }
  const def = { id, name, fields };
  if (waitMinutes) def.waitMinutes = waitMinutes;
  if (quick.length) def.quick = quick;
  const newList = typeFormState.id
    ? getTestTypes().map((t) => (t.id === typeFormState.id ? def : t))
    : getTestTypes().concat([def]);
  const errors = validateTypeDefs(newList);
  if (errors.length) { showTypeError(errors[0]); return; }
  setTestTypes(newList);
  persistTypes();
  refreshTypeSelects();
  switchView('types');
  toast(typeFormState.id ? 'Đã sửa loại xét nghiệm' : 'Đã thêm loại xét nghiệm: ' + name);
}

/* ================= Nhập bằng giọng nói (F11) =================
   Dùng Web Speech API (Chrome hỗ trợ tiếng Việt, cần có mạng cho
   dịch vụ nhận giọng của Google). Chỉ gắn cho các ô NHẬP CHỮ (trường kết quả
   dạng text + ô ghi chú) — trường dạng nút chip thì chọn tay chính xác hơn.
   Trình duyệt không hỗ trợ -> không hiện nút mic, tính năng tự ẩn. */
let voiceRec = null;

function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function startVoiceInput(inputEl, btnEl) {
  if (!voiceSupported()) {
    toast('Trình duyệt này không hỗ trợ nhập giọng nói — hãy dùng Chrome');
    return false;
  }
  if (voiceRec) { /* đang nghe -> bấm lần nữa để dừng */
    try { voiceRec.stop(); } catch (e) { /* bỏ qua */ }
    voiceRec = null;
    if (btnEl) btnEl.classList.remove('listening');
    return true;
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Ctor();
  rec.lang = 'vi-VN';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  voiceRec = rec;
  if (btnEl) btnEl.classList.add('listening');
  rec.onresult = (e) => {
    const said = e.results && e.results[0] && e.results[0][0] ? (e.results[0][0].transcript || '').trim() : '';
    if (said && inputEl) {
      inputEl.value = inputEl.value && inputEl.value.trim() ? inputEl.value.trim() + ' ' + said : said;
      inputEl.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
  };
  rec.onerror = () => { toast('Không nghe rõ — thử nói lại'); };
  rec.onend = () => { voiceRec = null; if (btnEl) btnEl.classList.remove('listening'); };
  try { rec.start(); } catch (e) {
    voiceRec = null;
    if (btnEl) btnEl.classList.remove('listening');
    return false;
  }
  return true;
}

function makeMicBtn(inputEl) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mic-btn';
  b.title = 'Nhập bằng giọng nói';
  b.setAttribute('aria-label', 'Nhập bằng giọng nói');
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  b.addEventListener('click', () => startVoiceInput(inputEl, b));
  return b;
}

/* Bọc một ô input trong hàng flex kèm nút mic (chỉ khi trình duyệt hỗ trợ) */
function wrapWithMic(inputEl) {
  if (!inputEl || !inputEl.parentNode || !voiceSupported()) return;
  const w = document.createElement('div');
  w.className = 'mic-wrap';
  inputEl.parentNode.insertBefore(w, inputEl);
  w.appendChild(inputEl);
  w.appendChild(makeMicBtn(inputEl));
}

/* ================= Form nhập / sửa ================= */
let formState = { uid: null, typeId: null, results: {}, createdAt: null };

function buildTypeOptions(selectEl, includeAll) {
  selectEl.innerHTML = (includeAll ? '<option value="">Tất cả</option>' : '') +
    getTestTypes().map((t) => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join('');
}

function openForm(uid) {
  const rec = uid ? store.getByUid(uid) : null;
  formState = {
    uid: rec ? rec.uid : null,
    typeId: rec ? rec.typeId : getTestTypes()[0].id,
    results: rec ? Object.assign({}, rec.results) : {},
    createdAt: rec ? rec.createdAt : new Date().toISOString(),
  };
  $('input-testid').value = rec ? rec.testId : '';
  $('select-type').value = formState.typeId;
  $('input-note').value = rec ? rec.note : '';
  $('input-release').value = rec ? toLocalInput(rec.releaseAt) : '';
  $('created-display').textContent = fmtFull(formState.createdAt);
  /* Khối KTV (v27): mẫu mới -> KTV nhận điền sẵn người đang trực; mẫu cũ -> dấu đã lưu */
  fillStaffSelect($('input-receiver'), rec ? (rec.receiver || '') : currentOperator);
  fillStaffSelect($('input-performer'), rec ? (rec.performer || '') : '');
  fillStaffSelect($('input-releaser'), rec ? (rec.releaser || '') : '');
  ['input-receiver', 'input-performer', 'input-releaser'].forEach((id) => { $(id).dataset.prev = $(id).value; });
  hideFormError();
  renderFields();
  switchView('form');
}

/* Bấm một nút nhập nhanh: điền CẢ bộ kết quả theo mẫu đã định cho loại XN
   (trường không có trong mẫu = để trống). Chỉ điền vào form — không tự lưu,
   người dùng vẫn xem lại và bấm Lưu như thường. */
function applyQuickTemplate(qi) {
  const type = getTestType(formState.typeId);
  const q = type && type.quick ? type.quick[qi] : null;
  if (!q) return;
  type.fields.forEach((f) => {
    formState.results[f.key] = Object.prototype.hasOwnProperty.call(q.values, f.key) ? q.values[f.key] : '';
  });
  renderFields();
  noteResultEdited();
  const btn = $('fields-container').querySelector('[data-quick="' + qi + '"]');
  if (btn) btn.classList.add('flash');
}

function renderFields() {
  const type = getTestType(formState.typeId);
  const wrap = $('fields-container');
  /* Hàng nút nhập nhanh (v25): nhỏ gọn, nằm trên cùng của khu vực trường kết
     quả; loại nào không định nghĩa nút thì không hiện gì cả */
  const quickHtml = type.quick && type.quick.length
    ? '<div class="quick-row"><span class="quick-caption">⚡ Nhập nhanh:</span>' +
      type.quick.map((q, qi) => '<button type="button" class="quick-btn" data-quick="' + qi + '">' + esc(q.label) + '</button>').join('') +
      '</div>'
    : '';
  wrap.innerHTML = quickHtml + type.fields.map((f) => {
    const label = esc(type.name) + ': ' + esc(f.label);
    if (f.type === 'text') {
      return '<div class="form-row"><label class="form-label">' + label + '</label>' +
        '<input type="text" data-field="' + f.key + '" value="' + esc(formState.results[f.key] || '') + '" autocomplete="off"></div>';
    }
    const chips = f.levels.map((lv) =>
      '<button type="button" class="chip' + (formState.results[f.key] === lv ? ' selected' : '') + '" data-chip="' + f.key + '" data-value="' + esc(lv) + '">' + esc(lv) + '</button>').join('');
    return '<div class="form-row"><span class="form-label">' + label + '</span><div class="chips">' + chips + '</div></div>';
  }).join('');

  wrap.querySelectorAll('[data-field]').forEach((inp) => {
    inp.addEventListener('input', () => { formState.results[inp.dataset.field] = inp.value; noteResultEdited(); });
    wrapWithMic(inp); /* ô nhập chữ có thêm nút micro khi trình duyệt hỗ trợ giọng nói */
  });
  wrap.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.chip;
      formState.results[key] = formState.results[key] === btn.dataset.value ? '' : btn.dataset.value;
      wrap.querySelectorAll('[data-chip="' + key + '"]').forEach((b) =>
        b.classList.toggle('selected', formState.results[key] === b.dataset.value));
      noteResultEdited();
    });
  });
  wrap.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => applyQuickTemplate(Number(btn.dataset.quick)));
  });
}

function showFormError(msg) {
  const el = $('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideFormError() { $('form-error').classList.add('hidden'); }

function saveForm() {
  const releaseVal = $('input-release').value;
  const payload = {
    testId: $('input-testid').value,
    typeId: formState.typeId,
    results: formState.results,
    note: $('input-note').value,
    releaseAt: releaseVal ? new Date(releaseVal).toISOString() : null,
  };
  /* Đã có kết quả thì đồng hồ bấm giờ của mẫu tự xóa */
  const hasRes = store.hasResult({ typeId: payload.typeId, results: payload.results });
  if (hasRes) payload.timerEndsAt = null;
  /* Dấu KTV (v27): lấy từ 3 ô chọn trong form; ô thực hiện/phát hành để trống
     thì tự lấy tên KTV trực; không có kết quả -> không có người thực hiện;
     không có giờ phát hành -> không có người phát hành */
  payload.receiver = $('input-receiver').value;
  payload.performer = hasRes ? ($('input-performer').value || currentOperator) : '';
  payload.releaser = payload.releaseAt ? ($('input-releaser').value || currentOperator) : '';
  const wasAdd = !formState.uid;
  const res = formState.uid ? store.update(formState.uid, payload) : store.add(payload, new Date(formState.createdAt));
  if (!res.ok) {
    showFormError(res.errors.join('. '));
    return;
  }
  /* Nhận mẫu mới (thêm mới, không phải sửa) trong lúc đang ở tab Quản lý:
     quay về Quản lý thì mở khung Chưa kết quả để thấy ngay mẫu vừa nhận (v25) */
  if (wasAdd && mainView === 'manage') managePanel = 'noresult';
  toast('Đã lưu kết quả');
  /* Quay về đúng tab đang dùng trước khi mở form (vd Quản lý) — không nhảy về tab đầu */
  switchView(mainView);
}

/* ================= Quét mã =================
 * Hai chế độ:
 * - 'single' (mở từ form SỬA một bản ghi): nhận 1 mã -> điền vào ô ID -> tự đóng.
 * - 'continuous' (tiếp nhận mẫu): quét LIÊN TỤC — mỗi mã tạo ngay 1 bản ghi
 *   "Chưa kết quả" theo loại XN đã chọn. Loại XN được KHÓA sau mã nhận thành
 *   công đầu tiên của phiên và giữ nguyên tới khi người dùng bấm "Dừng quét".
 */
let scanStream = null;
let scanTimer = null;
let scannerState = null;

/* ---- Tiếng bíp khi bắn mã (WebAudio, không cần file âm thanh) ---- */
let audioCtx = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* thiết bị không hỗ trợ: bỏ qua */ }
}
function beep(freq, ms) {
  try {
    if (!audioCtx) unlockAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.05);
  } catch (e) { /* bỏ qua nếu không phát được tiếng */ }
}
function beepOk() { beep(1320, 90); }   /* nhận thành công: bíp cao, ngắn */
function beepErr() { beep(240, 200); }  /* quét trùng/lỗi: bíp trầm, dài hơn */

function setScanMsg(text, kind) {
  const msg = $('scanner-msg');
  msg.textContent = text;
  msg.className = 'scanner-msg' + (kind ? ' ' + kind : '');
}

function updateScanCount() {
  const n = scannerState ? scannerState.count : 0;
  $('scanner-count').textContent = 'Đã nhận trong phiên: ' + n;
  $('scanner-empty').classList.toggle('hidden', n > 0);
}

function openScanner(source) {
  const single = source === 'form' && !!formState.uid;
  scannerState = { source, single, count: 0, lastCode: '', lastAt: 0 };
  const typeSel = $('scanner-type-select');
  typeSel.disabled = false;
  typeSel.value = source === 'form' ? formState.typeId : (typeSel.value || getTestTypes()[0].id);
  $('scanner-list').innerHTML = '';
  $('scanner-input').value = '';
  $('scan-frame').classList.remove('hidden');
  $('scanner-title').textContent = single ? 'Quét mã mẫu' : 'Tiếp nhận mẫu';
  $('scanner-subtitle').textContent = single ? 'Nhận 1 mã để điền vào ô ID của mẫu đang sửa' : 'Quét mã liên tục — mỗi mã là một mẫu được nhận';
  $('scanner-session').classList.toggle('hidden', single);
  /* Chế độ quét liên tục: chỉ quét bằng camera, không hiện ô nhập tay + nút Nhận mẫu.
     Ô nhập tay chỉ còn ở chế độ 1 mã (mở từ form sửa) làm đường dự phòng. */
  $('scanner-manual').classList.toggle('hidden', !single);
  updateScanCount();
  $('scanner-modal').classList.remove('hidden');
  unlockAudio();
  setScanMsg(single ? 'Nhận 1 mã để điền vào ô ID...' : 'Đang mở camera — quét liên tục, bấm "Dừng quét" khi xong...');
  startCamera();
}

/* Nhận 1 mã (từ camera hoặc nhập tay). Trả về true nếu mã được xử lý nhận.
   Loại XN KHÔNG bị khóa trong phiên: mỗi mẫu nhận theo loại đang chọn tại thời điểm bắn mã đó,
   người dùng đổi loại lúc nào cũng được (theo yêu cầu của Minh, v17). */
function acceptScanCode(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code || !scannerState) return false;

  if (scannerState.single) {
    $('input-testid').value = code;
    beepOk();
    toast('Đã quét mã: ' + code);
    closeScanner();
    return true;
  }

  const typeId = $('scanner-type-select').value;
  const type = getTestType(typeId);
  if (store.findDuplicate({ testId: code, typeId })) {
    setScanMsg('Đã tồn tại: ' + code + ' (' + (type ? type.name : typeId) + ') — bỏ qua, quét mã tiếp theo', 'err');
    beepErr();
    if (navigator.vibrate) navigator.vibrate(120);
    return false;
  }
  const res = store.add({ testId: code, typeId, results: {}, receiver: currentOperator });
  if (!res.ok) {
    setScanMsg(res.errors.join('. '), 'err');
    beepErr();
    return false;
  }
  scannerState.count += 1;
  /* Mẫu mới nhận là việc ở khung Chưa kết quả: nếu đang đứng ở tab Quản lý
     (dù đang xem khung Chờ phát hành) thì tự chuyển khung về Chưa kết quả (v25) */
  if (mainView === 'manage') managePanel = 'noresult';
  updateScanCount();
  const li = document.createElement('li');
  li.innerHTML = '<span>' + esc(code) + '</span><span class="scan-type">' + esc(type ? type.name : typeId) + '</span><span class="scan-time">' + esc(fmtFull(res.record.createdAt)) + '</span>';
  const list = $('scanner-list');
  list.insertBefore(li, list.firstChild);
  setScanMsg('Đã nhận mẫu: ' + code + ' — quét mã tiếp theo, hoặc bấm "Dừng quét"', 'ok');
  beepOk();
  if (navigator.vibrate) navigator.vibrate(60);
  refreshCurrent();
  return true;
}

async function startCamera() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('scan-frame').classList.add('hidden');
    if (scannerState && scannerState.single) {
      setScanMsg('Thiết bị/trình duyệt này không hỗ trợ quét bằng camera — nhập ID mẫu vào ô dưới rồi bấm "Nhận mẫu".', 'err');
    } else {
      setScanMsg('Thiết bị/trình duyệt này không hỗ trợ quét bằng camera. Hãy mở app bằng Chrome trên điện thoại để bắn mã liên tục.', 'err');
    }
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (!scannerState) { stream.getTracks().forEach((t) => t.stop()); return; }
    scanStream = stream;
    const video = $('scanner-video');
    video.srcObject = scanStream;
    await video.play();
    if (!scannerState) return;
    setScanMsg(scannerState.single ? 'Đưa mã vào khung hình...' : 'Đang quét liên tục — đưa từng mã vào khung hình, bấm "Dừng quét" khi xong...');
    const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
    scanTimer = setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length && codes[0].rawValue && scannerState) {
          const code = String(codes[0].rawValue);
          const now = Date.now();
          /* Chống nhận lặp cùng 1 mã đang đứng trước camera: bỏ qua nếu trùng mã trước trong 3 giây */
          if (code === scannerState.lastCode && now - scannerState.lastAt < 3000) return;
          scannerState.lastCode = code;
          scannerState.lastAt = now;
          acceptScanCode(code);
        }
      } catch (e) { /* bỏ qua khung hình lỗi */ }
    }, 400);
  } catch (e) {
    $('scan-frame').classList.add('hidden');
    if (scannerState && scannerState.single) {
      setScanMsg('Không mở được camera (' + e.name + '). Nhập ID mẫu vào ô dưới rồi bấm "Nhận mẫu".', 'err');
    } else {
      setScanMsg('Không mở được camera (' + e.name + '). Hãy kiểm tra quyền camera của trình duyệt rồi mở lại màn hình quét.', 'err');
    }
  }
}

/* ---- Máy quét mã vạch cầm tay (F13) ----
   Máy quét USB/Bluetooth hoạt động như bàn phím: gõ mã rất nhanh (<60ms/ký tự)
   rồi kết thúc bằng Enter. Khi màn hình quét đang mở, chuỗi gõ nhanh + Enter
   được nhận thành mã như camera bắn. Người gõ tay chậm sẽ không khớp mẫu này. */
let wedgeBuf = '';
let wedgeLastAt = 0;

function wedgeKey(key, nowMs) {
  if (!scannerState) return false;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  if (key === 'Enter') {
    const code = wedgeBuf;
    const fresh = now - wedgeLastAt <= 500;
    wedgeBuf = '';
    if (code.length >= 3 && fresh) { acceptScanCode(code); return true; }
    return false;
  }
  if (!key || key.length !== 1) { if (key !== 'Shift') wedgeBuf = ''; return false; }
  if (now - wedgeLastAt > 60) wedgeBuf = '';
  wedgeBuf += key;
  wedgeLastAt = now;
  return false;
}

function initWedgeListener() {
  document.addEventListener('keydown', (e) => {
    if (!scannerState) return;
    const t = e.target;
    if (t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (t && t.tagName === 'INPUT' && t.id !== 'scanner-input') return;
    if (e.key === 'Enter' && wedgeKey(e.key, Date.now())) { e.preventDefault(); return; }
    wedgeKey(e.key, Date.now());
  });
}

function closeScanner() {
  const added = scannerState ? scannerState.count : 0;
  const fromFormNew = !!scannerState && scannerState.source === 'form' && !scannerState.single;
  $('scanner-modal').classList.add('hidden');
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  scannerState = null;
  if (added > 0) {
    toast('Đã nhận ' + added + ' mẫu trong phiên quét');
    /* Tiếp nhận từ nút + (form thêm mới): bắn nhận xong tự chuyển sang tab Quản lý
       để xử lý tiếp hàng chờ — không giữ ở tab Kết quả hôm nay (yêu cầu của Minh).
       Vừa nhận mẫu mới nên Quản lý mở ở khung Chưa kết quả (v25). */
    if (fromFormNew) { managePanel = 'noresult'; switchView('manage'); } else refreshCurrent();
  }
}

/* ================= Danh sách KTV + KTV trực (v27) =================
   App không có tài khoản: nhiều KTV dùng chung máy theo ca. Một "KTV trực"
   (người đang thao tác) được chọn 1 lần, nhớ giữa các phiên; mọi thao tác
   nhận mẫu / lưu kết quả / phát hành đều đóng dấu tên người đó lên bản ghi. */
const STAFF_KEY = 'labentry.staff.v1';
const OPERATOR_KEY = 'labentry.operator.v1';
let staffList = [];
let currentOperator = '';

function normalizeStaffEntry(x) {
  if (typeof x === 'string' && x.trim()) return { name: x.trim(), salt: '', pinHash: null };
  if (x && typeof x.name === 'string' && x.name.trim()) {
    return {
      name: x.name.trim(),
      salt: typeof x.salt === 'string' ? x.salt : '',
      pinHash: typeof x.pinHash === 'string' && x.pinHash ? x.pinHash : null,
    };
  }
  return null;
}

function loadStaff() {
  try {
    const list = JSON.parse(localStorage.getItem(STAFF_KEY) || '[]');
    staffList = (Array.isArray(list) ? list : []).map(normalizeStaffEntry).filter(Boolean);
  } catch (e) { staffList = []; }
  try { currentOperator = localStorage.getItem(OPERATOR_KEY) || ''; } catch (e) { currentOperator = ''; }
}
function persistStaff() { try { localStorage.setItem(STAFF_KEY, JSON.stringify(staffList)); } catch (e) { /* bỏ qua */ } }
function persistOperator() { try { localStorage.setItem(OPERATOR_KEY, currentOperator); } catch (e) { /* bỏ qua */ } }

function staffNames() { return staffList.map((x) => x.name); }
function findStaff(name) { return staffList.find((x) => x.name === name) || null; }

function staffOptionsHTML(extraValues) {
  const names = staffNames();
  (extraValues || []).forEach((n) => { if (n && !names.includes(n)) names.push(n); });
  return '<option value="">(chưa chọn)</option>' +
    names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
}

function renderOperatorControls() {
  ['operator-select', 'scanner-operator-select'].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.innerHTML = staffOptionsHTML([currentOperator]);
    el.value = currentOperator;
  });
}

function setOperator(name) {
  currentOperator = name || '';
  persistOperator();
  renderOperatorControls();
}

/* Điền một ô chọn KTV trong form nhập: danh sách + giá trị hiện tại + người trực */
function fillStaffSelect(el, value) {
  if (!el) return;
  el.innerHTML = staffOptionsHTML([value, currentOperator]);
  el.value = value || '';
}

/* Sửa nội dung kết quả trong form -> KTV thực hiện tự chuyển sang người trực
   đang sửa (đúng yêu cầu của Minh); người dùng vẫn đổi tay lại trong form được */
function noteResultEdited() {
  const sel = $('input-performer');
  if (sel && currentOperator) sel.value = currentOperator;
}

function sanitizeStaffList(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((x) => {
    const e = normalizeStaffEntry(x);
    if (e && !out.some((y) => y.name.toLowerCase() === e.name.toLowerCase())) out.push(e);
  });
  return out;
}

/* ---------- Mã PIN của KTV (v32) ----------
   PIN dài đúng 6 ký tự (chữ/số/ký hiệu). App KHÔNG lưu PIN gốc ở bất cứ đâu —
   chỉ lưu băm SHA-256 kèm muối riêng từng KTV (không có khóa giải mã, không
   đọc ngược được). File sao lưu vì thế chỉ mang theo băm: mở file ra cũng
   không thấy PIN, mà mang sang máy khác vẫn gõ PIN cũ để dùng tiếp. */
function newSalt() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return a[0].toString(36) + a[1].toString(36);
}

async function hashPin(pin, salt) {
  const text = (salt || '') + ':' + pin;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* rơi xuống hàm băm dự phòng bên dưới */ }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

async function verifyStaffPin(name, pin) {
  const st = findStaff(name);
  if (!st || !st.pinHash) return false;
  return (await hashPin(pin, st.salt)) === st.pinHash;
}

let pinSession = null; /* { mode: 'verify' | 'set', name, resolve } */

function pinPrompt(mode, name) {
  return new Promise((resolve) => {
    pinSession = { mode, name, resolve };
    $('pin-title').textContent = mode === 'set' ? 'Tạo mã PIN' : 'Nhập mã PIN';
    $('pin-desc').textContent = mode === 'set'
      ? 'Tạo PIN 6 ký tự cho KTV ' + name + '. Từ nay, đổi sang tên này làm KTV trực phải nhập đúng PIN này.'
      : 'Nhập PIN 6 ký tự của KTV ' + name + ' để tiếp tục.';
    $('pin-input').value = '';
    $('pin-input2').value = '';
    $('pin-input2').classList.toggle('hidden', mode !== 'set');
    $('pin-error').classList.add('hidden');
    $('pin-modal').classList.remove('hidden');
    setTimeout(() => { try { $('pin-input').focus(); } catch (e) { /* bỏ qua */ } }, 60);
  });
}

function closePinModal(value) {
  if (!pinSession) return;
  const resolve = pinSession.resolve;
  pinSession = null;
  $('pin-modal').classList.add('hidden');
  resolve(value);
}

async function submitPinModal() {
  if (!pinSession) return;
  const { mode, name } = pinSession;
  const err = (m) => { const e = $('pin-error'); e.textContent = m; e.classList.remove('hidden'); };
  const pin = $('pin-input').value;
  if (mode === 'set') {
    if (pin.length !== 6) { err('PIN phải đúng 6 ký tự (chữ, số hoặc ký hiệu đều được)'); return; }
    if (pin !== $('pin-input2').value) { err('Hai lần nhập PIN chưa khớp nhau'); return; }
    const salt = newSalt();
    const pinHash = await hashPin(pin, salt);
    const st = findStaff(name);
    if (st) { st.salt = salt; st.pinHash = pinHash; }
    else staffList.push({ name, salt, pinHash });
    persistStaff();
    renderStaffList();
    closePinModal(true);
  } else {
    if (await verifyStaffPin(name, pin)) closePinModal(true);
    else { err('PIN chưa đúng — mời nhập lại'); $('pin-input').value = ''; }
  }
}

function promptPinVerify(name) { return pinPrompt('verify', name); }
function promptPinSet(name) { return pinPrompt('set', name); }

/* Đổi KTV trực: phải nhập đúng PIN của người được chọn (chưa có PIN thì tạo luôn).
   Bỏ chọn (về "chưa chọn") thì không hỏi PIN. */
async function requestOperatorChange(name) {
  if (!name) { setOperator(''); return; }
  if (name === currentOperator) { renderOperatorControls(); return; }
  const st = findStaff(name);
  if (st && st.pinHash) {
    if (!(await promptPinVerify(name))) {
      renderOperatorControls();
      toast('Chưa đổi KTV trực — chưa nhập đúng PIN của ' + name);
      return;
    }
  } else if (st) {
    if (!(await promptPinSet(name))) { renderOperatorControls(); return; }
    toast('Đã tạo PIN cho KTV ' + name);
  }
  setOperator(name);
}

async function changeStaffPin(name) {
  const st = findStaff(name);
  if (!st) return;
  if (st.pinHash && !(await promptPinVerify(name))) return;
  if (await promptPinSet(name)) toast('Đã cập nhật PIN cho KTV ' + name);
  renderStaffList();
}

function renderStaffList() {
  const ul = $('staff-list');
  ul.innerHTML = '';
  staffList.forEach((st) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="staff-name">' + esc(st.name) + '</span>' +
      (st.name === currentOperator ? '<span class="staff-current">đang trực</span>' : '') +
      '<span class="staff-pin-state">' + (st.pinHash ? '🔒 có PIN' : 'chưa có PIN') + '</span>' +
      '<button type="button" class="mini-btn" data-staff-pin="' + esc(st.name) + '">' + (st.pinHash ? 'Đổi PIN' : 'Đặt PIN') + '</button>' +
      '<button type="button" class="mini-btn danger" data-staff-del="' + esc(st.name) + '">Xóa</button>';
    ul.appendChild(li);
  });
  $('staff-empty').classList.toggle('hidden', staffList.length > 0);
}

function openStaffDialog() { renderStaffList(); $('staff-modal').classList.remove('hidden'); }
function closeStaffDialog() { $('staff-modal').classList.add('hidden'); }

async function addStaffFromDialog() {
  const inp = $('input-staff-name');
  const name = inp.value.trim();
  if (!name) { toast('Chưa nhập họ tên KTV'); return; }
  if (staffList.some((n) => n.name.toLowerCase() === name.toLowerCase())) { toast('Đã có KTV này trong danh sách'); return; }
  const pin = $('input-staff-pin').value;
  if (pin.length !== 6) { toast('PIN phải đúng 6 ký tự'); return; }
  if (pin !== $('input-staff-pin2').value) { toast('Hai lần nhập PIN chưa khớp nhau'); return; }
  const salt = newSalt();
  const pinHash = await hashPin(pin, salt);
  staffList.push({ name, salt, pinHash });
  persistStaff();
  inp.value = '';
  $('input-staff-pin').value = '';
  $('input-staff-pin2').value = '';
  renderStaffList();
  renderOperatorControls();
  toast('Đã thêm KTV: ' + name);
}

function deleteStaff(name) {
  staffList = staffList.filter((n) => n.name !== name);
  persistStaff();
  if (currentOperator === name) setOperator('');
  renderStaffList();
  renderOperatorControls();
}

/* ================= Tùy chỉnh bản in PDF (v27, đợt 1) =================
   Cấu hình lưu ở localStorage (labentry.print.v1). Chưa có cấu hình ->
   dùng mặc định = đúng bố cục bản in trước đây. renderSheet() dựng HTML
   của tờ kết quả, dùng chung cho vùng in thật và khung xem trước. */
const PRINT_KEY = 'labentry.print.v1';
const PRINT_COLUMNS = [
  { id: 'stt', label: 'STT' },
  { id: 'testId', label: 'ID Xét Nghiệm' },
  { id: 'type', label: 'Loại xét nghiệm' },
  { id: 'results', label: 'Kết quả' },
  { id: 'note', label: 'Ghi chú' },
  { id: 'created', label: 'Ngày giờ nhập' },
  { id: 'released', label: 'Ngày giờ phát hành' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'wait', label: 'Thời gian chờ' },
  { id: 'receiver', label: 'KTV nhận' },
  { id: 'performer', label: 'KTV thực hiện' },
  { id: 'releaser', label: 'KTV phát hành' },
];
const PRINT_DEFAULT_VISIBLE = ['stt', 'testId', 'type', 'results', 'note', 'created', 'released'];
let printSettings = null;

function defaultPrintSettings() {
  return {
    logo: '', logoPos: 'left', logoSize: 'm',
    org: '', dept: '', address: '', phone: '', email: '',
    headerLayout: 'side', divider: true,
    title: 'Danh sách kết quả xét nghiệm', subtitle: true,
    columns: PRINT_COLUMNS.map((c) => ({
      id: c.id, label: c.label,
      visible: PRINT_DEFAULT_VISIBLE.includes(c.id),
      width: 0, align: c.id === 'stt' ? 'center' : 'left',
    })),
    pageSize: 'A4', orient: 'portrait', margin: 'normal',
    font: 'arial', fontSize: '12.5', density: 'normal', borders: 'full',
    footnote: '', printDate: false, tat: false,
    resultsMode: 'grouped', groupBy: 'none', zebra: false, headerColor: '#e8e8e8',
    sigs: [
      { on: false, title: 'Người lập bảng', name: '' },
      { on: false, title: 'Trưởng khoa', name: '' },
      { on: false, title: '', name: '' },
    ],
  };
}

function normalizePrintSettings(saved) {
  const def = defaultPrintSettings();
  if (!saved || typeof saved !== 'object') return def;
  const merged = Object.assign({}, def, saved);
  const savedCols = Array.isArray(saved.columns) ? saved.columns : [];
  merged.columns = PRINT_COLUMNS.map((reg) => {
    const sc = savedCols.find((c) => c && c.id === reg.id);
    const dc = def.columns.find((c) => c.id === reg.id);
    return sc ? {
      id: reg.id,
      label: typeof sc.label === 'string' && sc.label ? sc.label : reg.label,
      visible: !!sc.visible,
      width: isFinite(sc.width) ? Math.max(0, Math.min(60, Number(sc.width))) : 0,
      align: ['left', 'center', 'right'].includes(sc.align) ? sc.align : dc.align,
    } : dc;
  });
  if (!Array.isArray(merged.sigs) || merged.sigs.length !== 3) merged.sigs = def.sigs;
  if (!['grouped', 'split'].includes(merged.resultsMode)) merged.resultsMode = 'grouped';
  if (!['none', 'day', 'type'].includes(merged.groupBy)) merged.groupBy = 'none';
  if (!/^#[0-9a-fA-F]{6}$/.test(merged.headerColor || '')) merged.headerColor = '#e8e8e8';
  merged.zebra = !!merged.zebra;
  return merged;
}

function loadPrintSettings() {
  try {
    const raw = localStorage.getItem(PRINT_KEY);
    printSettings = normalizePrintSettings(raw ? JSON.parse(raw) : null);
  } catch (e) { printSettings = defaultPrintSettings(); }
  return printSettings;
}

function savePrintSettings() {
  try { localStorage.setItem(PRINT_KEY, JSON.stringify(printSettings)); } catch (e) { /* logo quá lớn có thể làm đầy bộ nhớ */ }
}

function printCellValue(colId, rec, idx) {
  const type = getTestType(rec.typeId);
  switch (colId) {
    case 'stt': return String(idx + 1);
    case 'testId': return esc(rec.testId);
    case 'type': return esc(type ? type.name : rec.typeId);
    case 'results': return resultSummary(rec);
    case 'note': return esc(rec.note || '');
    case 'created': return esc(fmtList(rec.createdAt));
    case 'released': return esc(rec.releaseAt ? fmtList(rec.releaseAt) : '—');
    case 'status': return esc(STATUS_LABEL[store.statusOf(rec)]);
    case 'wait': {
      if (!rec.releaseAt) return '—';
      const mins = Math.round((new Date(rec.releaseAt) - new Date(rec.createdAt)) / 60000);
      return esc(isFinite(mins) && mins >= 0 ? fmtDur(mins) : '—');
    }
    case 'receiver': return esc(rec.receiver || '—');
    case 'performer': return esc(rec.performer || '—');
    case 'releaser': return esc(rec.releaser || '—');
    default: return '';
  }
}

/* Dựng HTML tờ kết quả theo cấu hình. opts: { rangeText, tatText } */
function splitFieldColumns(s, recs) {
  /* Chế độ tách cột: gộp các trường kết quả của mọi loại XN có trong danh sách
     thành các cột riêng, khử trùng theo NHÃN trường (vd 4 loại cùng có trường
     "Kết quả" thì chung 1 cột). Thứ tự theo lần xuất hiện đầu tiên. */
  const seen = new Set();
  const cols = [];
  recs.forEach((rec) => {
    const type = getTestType(rec.typeId);
    if (!type) return;
    type.fields.forEach((f) => {
      if (seen.has(f.label)) return;
      seen.add(f.label);
      cols.push({ id: 'field', label: f.label, align: 'left', width: 0, fieldLabel: f.label });
    });
  });
  return cols;
}

function fieldCellValue(rec, fieldLabel) {
  const type = getTestType(rec.typeId);
  if (!type) return '';
  const f = type.fields.find((x) => x.label === fieldLabel);
  if (!f) return '';
  const v = (rec.results && rec.results[f.key]) || '';
  return esc(f.type === 'chips' ? (v === '' ? 'Âm tính' : v) : (v === '' ? '—' : v));
}

function sheetGroupKey(s, rec) {
  if (s.groupBy === 'day') {
    const k = LabStore.localDayKey(new Date(rec.createdAt));
    const p = k.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  if (s.groupBy === 'type') {
    const t = getTestType(rec.typeId);
    return t ? t.name : rec.typeId;
  }
  return '';
}

function groupRecords(s, recs) {
  /* Gom mọi bản ghi cùng khóa nhóm về MỘT cụm (giữ nguyên thứ tự trong cụm,
     cụm xếp theo lần xuất hiện đầu tiên). Thiếu bước này, các mẫu cùng loại
     nằm xen kẽ trong danh sách sẽ bị tách thành nhiều nhóm trùng tên. */
  if (s.groupBy === 'none') return recs;
  const order = [];
  const buckets = new Map();
  recs.forEach((rec) => {
    const k = sheetGroupKey(s, rec);
    if (!buckets.has(k)) { buckets.set(k, []); order.push(k); }
    buckets.get(k).push(rec);
  });
  return order.reduce((acc, k) => acc.concat(buckets.get(k)), []);
}

function renderSheet(s, recs, opts) {
  const o = opts || {};
  const logoHtml = s.logo
    ? '<img class="sh-logo sz-' + s.logoSize + '" src="' + s.logo + '" alt="">'
    : '';
  const contact = [s.address, s.phone, s.email].filter((x) => x && x.trim()).map(esc).join(' · ');
  const infoHtml =
    (s.org && s.org.trim() ? '<div class="sh-org">' + esc(s.org) + '</div>' : '') +
    (s.dept && s.dept.trim() ? '<div class="sh-dept">' + esc(s.dept) + '</div>' : '') +
    (contact ? '<div class="sh-contact">' + contact + '</div>' : '');
  let headerHtml = '';
  if (logoHtml || infoHtml) {
    if (s.headerLayout === 'center' || s.logoPos === 'center') {
      headerHtml = '<div class="sh-header center">' + logoHtml + '<div class="sh-info">' + infoHtml + '</div></div>';
    } else if (s.logoPos === 'right') {
      headerHtml = '<div class="sh-header side"><div class="sh-info">' + infoHtml + '</div>' + logoHtml + '</div>';
    } else {
      headerHtml = '<div class="sh-header side">' + logoHtml + '<div class="sh-info">' + infoHtml + '</div></div>';
    }
    if (s.divider) headerHtml += '<hr class="sh-divider">';
  }
  /* Cột hiệu dụng: cột Kết quả có thể nở thành nhiều cột trường (chế độ tách) */
  const orderedRecs = groupRecords(s, recs);
  let cols = [];
  s.columns.filter((c) => c.visible).forEach((c) => {
    if (c.id === 'results' && s.resultsMode === 'split') cols = cols.concat(splitFieldColumns(s, orderedRecs));
    else cols.push(c);
  });
  const thead = '<tr>' + cols.map((c) =>
    '<th style="text-align:' + c.align + (c.width > 0 ? ';width:' + c.width + '%' : '') + '">' + esc(c.label) + '</th>').join('') + '</tr>';
  let lastGroup = null;
  let dataIdx = 0;
  const tbody = orderedRecs.map((rec, i) => {
    let groupRow = '';
    if (s.groupBy !== 'none') {
      const gk = sheetGroupKey(s, rec);
      if (gk !== lastGroup) {
        lastGroup = gk;
        groupRow = '<tr class="sh-group"><td colspan="' + cols.length + '">' + esc(gk) + '</td></tr>';
      }
    }
    const alt = s.zebra && dataIdx % 2 === 1 ? ' class="alt"' : '';
    dataIdx += 1;
    return groupRow + '<tr' + alt + '>' + cols.map((c) =>
      '<td style="text-align:' + c.align + '">' + (c.id === 'field' ? fieldCellValue(rec, c.fieldLabel) : printCellValue(c.id, rec, i)) + '</td>').join('') + '</tr>';
  }).join('');
  const sigs = (s.sigs || []).filter((g) => g && g.on);
  const sigHtml = sigs.length
    ? '<div class="sh-sigs">' + sigs.map((g) =>
      '<div class="sh-sig"><div class="sh-sig-title">' + esc(g.title || '') + '</div>' +
      '<div class="sh-sig-note">(Ký, ghi rõ họ tên)</div><div class="sh-sig-space"></div>' +
      '<div class="sh-sig-name">' + esc(g.name || '') + '</div></div>').join('') + '</div>'
    : '';
  const footHtml = (s.footnote && s.footnote.trim()) || s.printDate
    ? '<div class="sh-foot"><span>' + esc(s.footnote || '') + '</span>' +
      (s.printDate ? '<span class="sh-printdate">In lúc: ' + esc(fmtFull(new Date().toISOString())) + '</span>' : '') + '</div>'
    : '';
  const dark = s.headerColor === '#1e88e5';
  return '<div class="sheet f-' + s.font + ' b-' + s.borders + ' d-' + s.density + (s.zebra ? ' zebra' : '') + (dark ? ' hc-dark' : '') +
    '" style="--sh-size:' + s.fontSize + 'px;--sh-head:' + s.headerColor + '">' +
    headerHtml +
    '<h1 class="sh-title">' + esc(s.title || 'Danh sách kết quả xét nghiệm') + '</h1>' +
    (s.subtitle && o.rangeText ? '<div class="sh-subtitle">' + esc(o.rangeText) + '</div>' : '') +
    (s.tat && o.tatText ? '<div class="sh-tat">' + esc(o.tatText) + '</div>' : '') +
    '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody><tfoot><tr class="sh-close"><td colspan="' + cols.length + '"></td></tr></tfoot></table>' +
    sigHtml + footHtml + '</div>';
}

/* ---------- Mẫu bố cục (presets, đợt 2) ---------- */
const PRESETS_KEY = 'labentry.print.presets.v1';
let printPresets = [];

function loadPresets() {
  try {
    const list = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    printPresets = Array.isArray(list) ? list.filter((p) => p && typeof p.name === 'string' && p.settings) : [];
  } catch (e) { printPresets = []; }
}
function savePresets() { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(printPresets)); } catch (e) { /* bỏ qua */ } }

function renderPresetOptions() {
  const el = $('pcfg-preset');
  if (!el) return;
  const cur = el.value;
  el.innerHTML = printPresets.length
    ? printPresets.map((p) => '<option value="' + esc(p.name) + '">' + esc(p.name) + '</option>').join('')
    : '<option value="">(chưa có mẫu nào)</option>';
  if (printPresets.some((p) => p.name === cur)) el.value = cur;
}

function savePresetFromUI() {
  const name = (prompt('Đặt tên cho mẫu bố cục này:') || '').trim();
  if (!name) return;
  const copy = JSON.parse(JSON.stringify(printSettings));
  const idx = printPresets.findIndex((p) => p.name === name);
  if (idx >= 0) {
    if (!confirm('Đã có mẫu tên "' + name + '". Ghi đè bằng bố cục hiện tại?')) return;
    printPresets[idx].settings = copy;
  } else {
    printPresets.push({ name, settings: copy });
  }
  savePresets();
  renderPresetOptions();
  $('pcfg-preset').value = name;
  toast('Đã lưu mẫu bố cục: ' + name);
}

function applyPresetFromUI() {
  const name = $('pcfg-preset').value;
  const p = printPresets.find((x) => x.name === name);
  if (!p) { toast('Chưa có mẫu nào để dùng — hãy lưu mẫu hiện tại trước'); return; }
  printSettings = normalizePrintSettings(JSON.parse(JSON.stringify(p.settings)));
  savePrintSettings();
  fillPrintCfgControls();
  renderPrintPreview();
  updatePrintPageStyle();
  toast('Đã áp dụng mẫu bố cục: ' + name);
}

function deletePresetFromUI() {
  const name = $('pcfg-preset').value;
  const idx = printPresets.findIndex((x) => x.name === name);
  if (idx < 0) return;
  if (!confirm('Xóa mẫu bố cục "' + name + '"?')) return;
  printPresets.splice(idx, 1);
  savePresets();
  renderPresetOptions();
  toast('Đã xóa mẫu bố cục: ' + name);
}

function updatePrintPageStyle() {
  const el = $('print-page-style');
  if (!el || !printSettings) return;
  const mm = printSettings.margin === 'narrow' ? 10 : printSettings.margin === 'wide' ? 20 : 15;
  el.textContent = '@page { size: ' + printSettings.pageSize + ' ' + printSettings.orient + '; margin: ' + mm + 'mm; }';
}

/* Dữ liệu mẫu cho khung xem trước của trang tùy chỉnh */
function sampleSheetRecords() {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  return [
    { uid: 'pv1', testId: '2611050001', typeId: 'soi-tuoi-huyet-trang',
      results: { nam: '(+)', tapTrung: '', trichomonas: '', bachCau: '5-10/HPF', teBao: '', hongCau: '', clueCell: '', lactobacilli: '(++)', khac: '' },
      note: '', releaseAt: iso(20 * 60000), receiver: 'Trần Văn An', performer: 'Lê Thị Bình', releaser: 'Phạm Văn Cường',
      timerEndsAt: null, createdAt: iso(65 * 60000), updatedAt: iso(20 * 60000) },
    { uid: 'pv2', testId: '2611050002', typeId: 'mau-an',
      results: { ketQua: 'Âm tính' }, note: '', releaseAt: null,
      receiver: 'Trần Văn An', performer: 'Lê Thị Bình', releaser: '',
      timerEndsAt: null, createdAt: iso(30 * 60000), updatedAt: iso(28 * 60000) },
    { uid: 'pv3', testId: '2611050003', typeId: 'cao-tim-nam',
      results: {}, note: 'Mẫu hơi mờ', releaseAt: null,
      receiver: 'Trần Văn An', performer: '', releaser: '',
      timerEndsAt: null, createdAt: iso(10 * 60000), updatedAt: iso(10 * 60000) },
  ];
}

function renderPrintPreview() {
  $('pcfg-preview').innerHTML = renderSheet(printSettings, sampleSheetRecords(), {
    rangeText: '(01/11/2026 đến 05/11/2026)',
    tatText: 'Đã phát hành 1/3 mẫu · Thời gian trả kết quả: trung bình 45 phút · nhanh nhất 45 phút · lâu nhất 45 phút',
  });
}

function fillPrintCfgControls() {
  const s = printSettings;
  $('pcfg-logo-thumb').src = s.logo || '';
  $('pcfg-logo-thumb').classList.toggle('hidden', !s.logo);
  $('btn-pcfg-logo-remove').classList.toggle('hidden', !s.logo);
  $('pcfg-logo-pos').value = s.logoPos;
  $('pcfg-logo-size').value = s.logoSize;
  $('pcfg-org').value = s.org; $('pcfg-dept').value = s.dept;
  $('pcfg-address').value = s.address; $('pcfg-phone').value = s.phone; $('pcfg-email').value = s.email;
  $('pcfg-header-layout').value = s.headerLayout;
  $('pcfg-divider').checked = !!s.divider;
  $('pcfg-title').value = s.title;
  $('pcfg-subtitle').checked = !!s.subtitle;
  $('pcfg-pagesize').value = s.pageSize;
  $('pcfg-orient').value = s.orient;
  $('pcfg-margin').value = s.margin;
  $('pcfg-font').value = s.font;
  $('pcfg-fontsize').value = String(s.fontSize);
  $('pcfg-density').value = s.density;
  $('pcfg-borders').value = s.borders;
  $('pcfg-footnote').value = s.footnote;
  $('pcfg-printdate').checked = !!s.printDate;
  $('pcfg-tat').checked = !!s.tat;
  $('pcfg-resultsmode').value = s.resultsMode;
  $('pcfg-groupby').value = s.groupBy;
  $('pcfg-zebra').checked = !!s.zebra;
  $('pcfg-headercolor').value = s.headerColor;
  renderPresetOptions();
  s.sigs.forEach((g, i) => {
    $('pcfg-sig' + (i + 1) + '-on').checked = !!g.on;
    $('pcfg-sig' + (i + 1) + '-title').value = g.title || '';
    $('pcfg-sig' + (i + 1) + '-name').value = g.name || '';
  });
  renderPrintCfgColumns();
}

function renderPrintCfgColumns() {
  const wrap = $('pcfg-columns');
  wrap.innerHTML = '';
  printSettings.columns.forEach((col, i) => {
    const row = document.createElement('div');
    row.className = 'pcfg-col';
    row.innerHTML =
      '<label class="check"><input type="checkbox" class="pc-visible"' + (col.visible ? ' checked' : '') + '></label>' +
      '<input type="text" class="pc-label" value="' + esc(col.label) + '" aria-label="Tên cột">' +
      '<input type="number" class="pc-width" min="0" max="60" step="1" value="' + (col.width || 0) + '" title="Độ rộng % (0 = tự động)" aria-label="Độ rộng %"><span class="pc-unit">%</span>' +
      '<select class="pc-align" aria-label="Căn lề"><option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option></select>' +
      '<span class="pc-moves">' +
      '<button type="button" class="mini-btn pc-up" title="Lên">↑</button>' +
      '<button type="button" class="mini-btn pc-down" title="Xuống">↓</button></span>';
    row.querySelector('.pc-align').value = col.align;
    const upd = () => { savePrintSettings(); renderPrintPreview(); updatePrintPageStyle(); };
    row.querySelector('.pc-visible').addEventListener('change', (e) => { col.visible = e.target.checked; upd(); });
    row.querySelector('.pc-label').addEventListener('input', (e) => { col.label = e.target.value; upd(); });
    row.querySelector('.pc-width').addEventListener('input', (e) => { col.width = Math.max(0, Math.min(60, Number(e.target.value) || 0)); upd(); });
    row.querySelector('.pc-align').addEventListener('change', (e) => { col.align = e.target.value; upd(); });
    row.querySelector('.pc-up').addEventListener('click', () => {
      if (i === 0) return;
      const t = printSettings.columns[i - 1]; printSettings.columns[i - 1] = col; printSettings.columns[i] = t;
      savePrintSettings(); renderPrintCfgColumns(); renderPrintPreview();
    });
    row.querySelector('.pc-down').addEventListener('click', () => {
      if (i === printSettings.columns.length - 1) return;
      const t = printSettings.columns[i + 1]; printSettings.columns[i + 1] = col; printSettings.columns[i] = t;
      savePrintSettings(); renderPrintCfgColumns(); renderPrintPreview();
    });
    wrap.appendChild(row);
  });
}

function openPrintCfg() {
  fillPrintCfgControls();
  renderPrintPreview();
  switchView('printcfg');
}

/* Nén ảnh logo về tối đa 360px rồi lưu dạng data URL (PNG; quá lớn thì JPEG) */
function handleLogoFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const max = 360;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.width * scale));
    cv.height = Math.max(1, Math.round(img.height * scale));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    let data = cv.toDataURL('image/png');
    if (data.length > 340000) data = cv.toDataURL('image/jpeg', 0.85);
    printSettings.logo = data;
    savePrintSettings();
    fillPrintCfgControls();
    renderPrintPreview();
    toast('Đã đặt logo cho bản in');
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Không đọc được ảnh đã chọn'); };
  img.src = url;
}

function bindPrintCfg() {
  const upd = () => { savePrintSettings(); renderPrintPreview(); updatePrintPageStyle(); };
  const txt = (id, key) => $(id).addEventListener('input', () => { printSettings[key] = $(id).value; upd(); });
  const sel = (id, key) => $(id).addEventListener('change', () => { printSettings[key] = $(id).value; upd(); });
  const chk = (id, key) => $(id).addEventListener('change', () => { printSettings[key] = $(id).checked; upd(); });
  sel('pcfg-logo-pos', 'logoPos'); sel('pcfg-logo-size', 'logoSize');
  txt('pcfg-org', 'org'); txt('pcfg-dept', 'dept'); txt('pcfg-address', 'address');
  txt('pcfg-phone', 'phone'); txt('pcfg-email', 'email'); txt('pcfg-title', 'title');
  sel('pcfg-header-layout', 'headerLayout'); chk('pcfg-divider', 'divider'); chk('pcfg-subtitle', 'subtitle');
  sel('pcfg-pagesize', 'pageSize'); sel('pcfg-orient', 'orient'); sel('pcfg-margin', 'margin');
  sel('pcfg-font', 'font'); sel('pcfg-fontsize', 'fontSize'); sel('pcfg-density', 'density'); sel('pcfg-borders', 'borders');
  txt('pcfg-footnote', 'footnote'); chk('pcfg-printdate', 'printDate'); chk('pcfg-tat', 'tat');
  sel('pcfg-resultsmode', 'resultsMode'); sel('pcfg-groupby', 'groupBy');
  chk('pcfg-zebra', 'zebra'); sel('pcfg-headercolor', 'headerColor');
  $('btn-preset-save').addEventListener('click', savePresetFromUI);
  $('btn-preset-apply').addEventListener('click', applyPresetFromUI);
  $('btn-preset-del').addEventListener('click', deletePresetFromUI);
  printSettings.sigs.forEach((g, i) => {
    $('pcfg-sig' + (i + 1) + '-on').addEventListener('change', (e) => { g.on = e.target.checked; upd(); });
    $('pcfg-sig' + (i + 1) + '-title').addEventListener('input', (e) => { g.title = e.target.value; upd(); });
    $('pcfg-sig' + (i + 1) + '-name').addEventListener('input', (e) => { g.name = e.target.value; upd(); });
  });
  $('btn-pcfg-logo').addEventListener('click', () => $('pcfg-logo-file').click());
  $('pcfg-logo-file').addEventListener('change', (e) => { handleLogoFile(e.target.files && e.target.files[0]); e.target.value = ''; });
  $('btn-pcfg-logo-remove').addEventListener('click', () => {
    printSettings.logo = '';
    savePrintSettings(); fillPrintCfgControls(); renderPrintPreview();
  });
  $('btn-pcfg-reset').addEventListener('click', () => {
    if (!confirm('Khôi phục bố cục bản in về mặc định ban đầu? Mọi tùy chỉnh (logo, cột, chữ ký...) sẽ bị xóa.')) return;
    printSettings = defaultPrintSettings();
    savePrintSettings(); fillPrintCfgControls(); renderPrintPreview(); updatePrintPageStyle();
    toast('Đã khôi phục bố cục bản in mặc định');
  });
  $('btn-pcfg-print').addEventListener('click', () => { applyExport(); window.print(); });
  $('btn-pcfg-back').addEventListener('click', () => switchView('export'));
  $('btn-printcfg').addEventListener('click', openPrintCfg);
}

/* ================= Khởi tạo ================= */
function init() {
  loadSavedTypes(); /* nạp danh mục tự tạo (nếu có) TRƯỚC khi dựng các ô chọn loại */
  loadStaff(); /* danh sách KTV + KTV trực đã lưu */
  loadPrintSettings(); /* cấu hình bản in (mặc định nếu chưa tùy chỉnh) */
  loadPresets(); /* các mẫu bố cục đã lưu */
  renderOperatorControls();
  bindPrintCfg();
  initWedgeListener(); /* nhận mã từ máy quét cầm tay khi màn hình quét đang mở */
  wrapWithMic($('input-note')); /* ô ghi chú cũng nhập giọng nói được */
  buildTypeOptions($('select-type'), false);
  buildTypeOptions($('f-type'), true);
  buildTypeOptions($('scanner-type-select'), false);
  $('f-from').value = todayKey();
  $('f-to').value = todayKey();

  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view)));

  $('fab-add').addEventListener('click', () => openForm(null));
  $('btn-filter-nav').addEventListener('click', () => switchView('export'));
  $('btn-refresh').addEventListener('click', () => { renderToday(); toast('Đã làm mới'); });
  $('btn-refresh-manage').addEventListener('click', () => { renderManage(); toast('Đã làm mới'); });
  $('btn-search-manage').addEventListener('click', () => {
    switchView('today');
    $('search-bar').classList.remove('hidden');
    $('input-search').focus();
  });

  $('btn-search').addEventListener('click', () => {
    $('search-bar').classList.toggle('hidden');
    if (!$('search-bar').classList.contains('hidden')) $('input-search').focus();
  });
  $('btn-search-close').addEventListener('click', () => {
    $('search-bar').classList.add('hidden');
    $('input-search').value = '';
    renderToday();
  });
  $('input-search').addEventListener('input', renderToday);

  $('btn-select').addEventListener('click', () => setSelectMode(!selectMode));
  $('btn-cancel-select').addEventListener('click', () => setSelectMode(false));
  $('btn-delete-selected').addEventListener('click', () => {
    if (!selectedUids.size) { toast('Chưa chọn kết quả nào'); return; }
    if (!confirm('Xóa ' + selectedUids.size + ' kết quả đã chọn?')) return;
    selectedUids.forEach((uid) => store.remove(uid));
    selectedUids.clear();
    setSelectMode(false);
    toast('Đã xóa');
  });

  ['list-today', 'list-pending', 'list-noresult', 'list-export'].forEach((id) => $(id).addEventListener('click', handleListClick));
  $('btn-summary-close').addEventListener('click', closeSummary);
  $('btn-summary-unrelease').addEventListener('click', unreleaseFromSummary);
  $('operator-select').addEventListener('change', () => requestOperatorChange($('operator-select').value));
  $('scanner-operator-select').addEventListener('change', () => requestOperatorChange($('scanner-operator-select').value));
  $('btn-staff-manage').addEventListener('click', openStaffDialog);
  $('btn-staff-close').addEventListener('click', closeStaffDialog);
  $('btn-staff-add').addEventListener('click', addStaffFromDialog);
  $('input-staff-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStaffFromDialog(); } });
  $('staff-list').addEventListener('click', (e) => {
    const pb = e.target.closest('[data-staff-pin]');
    if (pb) { changeStaffPin(pb.dataset.staffPin); return; }
    const b = e.target.closest('[data-staff-del]');
    if (b) deleteStaff(b.dataset.staffDel);
  });
  $('btn-pin-ok').addEventListener('click', submitPinModal);
  $('btn-pin-cancel').addEventListener('click', () => closePinModal(false));
  ['pin-input', 'pin-input2'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitPinModal(); } }));
  /* 3 ô chọn KTV trong form: đổi sang tên người KHÁC người trực mà người đó có PIN
     thì phải nhập đúng PIN của họ (chặn sửa tay dấu tên người khác) */
  ['input-receiver', 'input-performer', 'input-releaser'].forEach((id) => {
    $(id).addEventListener('change', async (ev) => {
      const el = ev.target;
      const name = el.value;
      const prev = el.dataset.prev || '';
      if (name && name !== currentOperator) {
        const st = findStaff(name);
        if (st && st.pinHash && !(await promptPinVerify(name))) {
          el.value = prev;
          toast('Chưa đổi — chưa nhập đúng PIN của ' + name);
          return;
        }
      }
      el.dataset.prev = el.value;
    });
  });
  $('btn-summary-release').addEventListener('click', releaseFromSummary);
  $('summary-modal').addEventListener('click', (e) => { if (e.target === $('summary-modal')) closeSummary(); });

  $('btn-apply-filter').addEventListener('click', applyExport);
  $('btn-print').addEventListener('click', () => { applyExport(); window.print(); });
  $('btn-export-csv').addEventListener('click', exportCsv);
  $('btn-panel-noresult').addEventListener('click', () => setManagePanel('noresult'));
  $('btn-panel-pending').addEventListener('click', () => setManagePanel('pending'));
  $('btn-types').addEventListener('click', openTypes);
  $('btn-types-back').addEventListener('click', () => switchView(mainView));
  $('btn-type-add').addEventListener('click', () => openTypeForm(null));
  $('btn-types-reset').addEventListener('click', resetTypes);
  $('types-list').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-tedit]');
    if (ed) { openTypeForm(ed.dataset.tedit); return; }
    const del = e.target.closest('[data-tdel]');
    if (del) deleteType(del.dataset.tdel);
  });
  $('btn-tf-back').addEventListener('click', () => switchView('types'));
  $('btn-tf-cancel').addEventListener('click', () => switchView('types'));
  $('btn-tf-save').addEventListener('click', saveTypeForm);
  $('btn-tf-add-field').addEventListener('click', () => {
    typeFormState.fields.push({ key: '', label: '', type: 'text', levels: LEVELS_PRESETS['3'].slice() });
    ensureTypeFormKeys();
    renderTypeFieldRows();
    renderTypeQuickRows();
  });
  $('btn-tf-add-quick').addEventListener('click', () => {
    if (typeFormState.quick.length >= 8) { toast('Mỗi loại tối đa 8 nút nhập nhanh'); return; }
    typeFormState.quick.push({ label: '', values: {} });
    renderTypeQuickRows();
    const labels = $('tf-quicks').querySelectorAll('.tq-label');
    if (labels.length) labels[labels.length - 1].focus();
  });

  $('btn-backup-export').addEventListener('click', exportBackupFile);
  $('btn-backup-import').addEventListener('click', () => { pendingImportMode = 'replace'; $('backup-file').click(); });
  $('btn-backup-merge').addEventListener('click', () => { pendingImportMode = 'merge'; $('backup-file').click(); });
  $('backup-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    await handleBackupFile(file);
  });
  window.addEventListener('beforeprint', applyExport);

  $('btn-back').addEventListener('click', () => switchView(mainView));
  $('btn-cancel').addEventListener('click', () => switchView(mainView));
  $('btn-save').addEventListener('click', saveForm);
  $('select-type').addEventListener('change', () => {
    formState.typeId = $('select-type').value;
    formState.results = {};
    renderFields();
  });
  $('btn-scan').addEventListener('click', () => openScanner('form'));
  $('btn-scan-today').addEventListener('click', () => openScanner('today'));
  $('btn-scanner-close').addEventListener('click', closeScanner);
  $('btn-scanner-add').addEventListener('click', () => {
    acceptScanCode($('scanner-input').value);
    $('scanner-input').value = '';
    $('scanner-input').focus();
  });
  $('scanner-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('btn-scanner-add').click(); }
  });

  switchView('today');

  /* Mỗi giây cập nhật đồng hồ bấm giờ của các test nhanh */
  setInterval(timerTick, 1000);

  /* Mỗi phút tự làm mới danh sách (khi đang rảnh) để mẫu vừa quá ngưỡng chờ
     tự chuyển sang trạng thái cảnh báo mà không cần tải lại trang */
  setInterval(() => {
    const idle = $('view-form').classList.contains('hidden') &&
      $('scanner-modal').classList.contains('hidden') &&
      $('summary-modal').classList.contains('hidden') && !selectMode;
    if (idle && (mainView === 'today' || mainView === 'manage')) refreshCurrent();
  }, 60000);
}

/* ---------- PWA: đăng ký Service Worker ----------
 * Chỉ đăng ký khi chạy qua https (hoặc localhost) — mở từ file:// thì bỏ qua.
 * Khi có bản mới: SW mới kích hoạt ngay (skipWaiting trong sw.js); nếu trang
 * đang rảnh (không mở form/quét/xem) thì tự tải lại đúng một lần để dùng bản
 * mới ngay trong lần mở này; đang bận thì bản mới áp dụng ở lần mở kế tiếp. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    const idle = $('view-form').classList.contains('hidden') &&
      $('scanner-modal').classList.contains('hidden') &&
      $('summary-modal').classList.contains('hidden');
    if (!idle) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js')
    .then((reg) => { reg.update(); })
    .catch(() => {});
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', registerServiceWorker);

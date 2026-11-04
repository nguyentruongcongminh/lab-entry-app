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
  ['today', 'manage', 'export', 'form', 'types', 'typeform'].forEach((v) => $('view-' + v).classList.toggle('hidden', v !== name));
  const subView = name === 'form' || name === 'types' || name === 'typeform';
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
        const res = store.update(uid, { releaseAt: new Date().toISOString() });
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
  $('summary-modal').classList.remove('hidden');
}

function closeSummary() {
  $('summary-modal').classList.add('hidden');
}

/* Phát hành ngay từ trang xem tóm tắt — không hỏi lại, cập nhật luôn trang xem */
function releaseFromSummary() {
  if (!summaryUid) return;
  const rec = store.getByUid(summaryUid);
  if (!rec || store.statusOf(rec) !== 'pending-release') return;
  const res = store.update(rec.uid, { releaseAt: new Date().toISOString() });
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  toast('Đã phát hành kết quả ' + rec.testId);
  refreshCurrent();
  openSummary(rec.uid);
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
  $('print-title').textContent = 'Danh sách kết quả xét nghiệm' +
    (c.from || c.to ? ' (' + (c.from || '...') + ' đến ' + (c.to || '...') + ')' : '');
  $('print-table-body').innerHTML = recs.map((rec, i) => {
    const type = getTestType(rec.typeId);
    return '<tr><td>' + (i + 1) + '</td><td>' + esc(rec.testId) + '</td><td>' + esc(type ? type.name : rec.typeId) + '</td>' +
      '<td>' + resultSummary(rec) + '</td><td>' + esc(rec.note || '') + '</td>' +
      '<td>' + esc(fmtList(rec.createdAt)) + '</td><td>' + esc(rec.releaseAt ? fmtList(rec.releaseAt) : '—') + '</td></tr>';
  }).join('');
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
  try {
    const raw = JSON.parse(text);
    if (raw && Array.isArray(raw.types)) fileTypes = raw.types;
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
  const ask = merge
    ? 'File sao lưu có ' + parsed.records.length + ' bản ghi (xuất lúc ' + when + ').' + typeNote + '\n\nGỘP sẽ thêm các mẫu máy này CHƯA có; mẫu trùng ID + loại sẽ bị bỏ qua. Dữ liệu hiện tại được giữ nguyên. Tiếp tục?'
    : 'File sao lưu có ' + parsed.records.length + ' bản ghi (xuất lúc ' + when + ').' + typeNote + '\n\nPhục hồi sẽ THAY TOÀN BỘ dữ liệu hiện tại trên máy này. Tiếp tục?';
  if (!confirm(ask)) {
    restoreTypes();
    return false;
  }
  if (merge) {
    const res = store.mergeBackup(text);
    if (fileTypes) persistTypes();
    refreshTypeSelects();
    refreshCurrent();
    toast('Đã gộp dữ liệu: thêm ' + res.added + ' mẫu mới, bỏ qua ' + res.skipped + ' mẫu trùng');
  } else {
    const res = store.importBackup(text);
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
    t.fields.forEach((f, fi) => {
      const fw = where + ', trường thứ ' + (fi + 1);
      if (!f || typeof f.key !== 'string' || !f.key.trim()) { errors.push(fw + ': thiếu khóa trường'); return; }
      if (seenKeys.has(f.key)) errors.push(fw + ': khóa trường bị trùng');
      seenKeys.add(f.key);
      if (typeof f.label !== 'string' || !f.label.trim()) errors.push(fw + ': thiếu nhãn trường');
      if (f.type !== 'text' && f.type !== 'chips') errors.push(fw + ': dạng trường phải là text hoặc chips');
      if (f.type === 'chips' && (!Array.isArray(f.levels) || !f.levels.length || f.levels.some((lv) => typeof lv !== 'string' || !lv))) {
        errors.push(fw + ': trường dạng nút chọn phải có ít nhất 1 mức');
      }
    });
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
    ? { id: src.id, fields: src.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, levels: (f.levels || LEVELS_PRESETS['3']).slice() })) }
    : { id: null, fields: [{ key: '', label: '', type: 'text', levels: LEVELS_PRESETS['3'].slice() }] };
  $('tf-title').textContent = src ? 'Sửa loại xét nghiệm' : 'Thêm loại xét nghiệm';
  $('tf-name').value = src ? src.name : '';
  $('tf-wait').value = src && src.waitMinutes ? src.waitMinutes : '';
  $('tf-error').classList.add('hidden');
  renderTypeFieldRows();
  switchView('typeform');
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
    labelInp.addEventListener('input', () => { typeFormState.fields[i].label = labelInp.value; });
    kindSel.addEventListener('change', () => {
      typeFormState.fields[i].type = kindSel.value;
      levelsSel.disabled = kindSel.value !== 'chips';
    });
    levelsSel.addEventListener('change', () => { typeFormState.fields[i].levels = LEVELS_PRESETS[levelsSel.value].slice(); });
    row.querySelector('.tf-fdel').addEventListener('click', () => {
      if (typeFormState.fields.length <= 1) { toast('Mỗi loại cần ít nhất 1 trường kết quả'); return; }
      typeFormState.fields.splice(i, 1);
      renderTypeFieldRows();
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
  const def = { id, name, fields };
  if (waitMinutes) def.waitMinutes = waitMinutes;
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
   Dùng Web Speech API (Chrome trên Android hỗ trợ tiếng Việt, cần có mạng cho
   dịch vụ nhận giọng của Google). Chỉ gắn cho các ô NHẬP CHỮ (trường kết quả
   dạng text + ô ghi chú) — trường dạng nút chip thì chọn tay chính xác hơn.
   Trình duyệt không hỗ trợ -> không hiện nút mic, tính năng tự ẩn. */
let voiceRec = null;

function voiceSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function startVoiceInput(inputEl, btnEl) {
  if (!voiceSupported()) {
    toast('Trình duyệt này không hỗ trợ nhập giọng nói — hãy dùng Chrome trên Android');
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
  hideFormError();
  renderFields();
  switchView('form');
}

function renderFields() {
  const type = getTestType(formState.typeId);
  const wrap = $('fields-container');
  wrap.innerHTML = type.fields.map((f) => {
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
    inp.addEventListener('input', () => { formState.results[inp.dataset.field] = inp.value; });
    wrapWithMic(inp); /* ô nhập chữ có thêm nút micro khi trình duyệt hỗ trợ giọng nói */
  });
  wrap.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.chip;
      formState.results[key] = formState.results[key] === btn.dataset.value ? '' : btn.dataset.value;
      wrap.querySelectorAll('[data-chip="' + key + '"]').forEach((b) =>
        b.classList.toggle('selected', formState.results[key] === b.dataset.value));
    });
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
  if (store.hasResult({ typeId: payload.typeId, results: payload.results })) payload.timerEndsAt = null;
  const res = formState.uid ? store.update(formState.uid, payload) : store.add(payload, new Date(formState.createdAt));
  if (!res.ok) {
    showFormError(res.errors.join('. '));
    return;
  }
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
  const res = store.add({ testId: code, typeId, results: {} });
  if (!res.ok) {
    setScanMsg(res.errors.join('. '), 'err');
    beepErr();
    return false;
  }
  scannerState.count += 1;
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
       để xử lý tiếp hàng chờ — không giữ ở tab Kết quả hôm nay (yêu cầu của Minh) */
    if (fromFormNew) switchView('manage'); else refreshCurrent();
  }
}

/* ================= Khởi tạo ================= */
function init() {
  loadSavedTypes(); /* nạp danh mục tự tạo (nếu có) TRƯỚC khi dựng các ô chọn loại */
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
    renderTypeFieldRows();
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

document.addEventListener('DOMContentLoaded', init);

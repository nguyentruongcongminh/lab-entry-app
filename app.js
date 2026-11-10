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

/* ================= Mẫu hẹn lại / ngoại lệ (F37, v73) =================
 * Theo yêu cầu của Minh (2026-11-10): mẫu thiếu hụt, mẫu không đạt phải lấy
 * lại, hoặc hẹn lại hôm sau vì lý do riêng KHÔNG tính là "chưa kết quả" hay
 * "chưa phát hành": chúng rời khỏi mọi hàng chờ (danh sách Hôm nay, panel
 * Quản lý, nhập theo lô, bàn giao ca chính, báo động hẹn giờ, linh vật nhắc
 * việc) và nằm ở trang riêng "Mẫu hẹn lại" để xử lý/bàn giao riêng. Linh vật
 * chỉ báo cáo nhóm này 1 lần vào đầu ngày. Phát hành mẫu = tự bỏ hẹn lại. */
const DEFER_REASONS = { 'hut-mau': 'Hụt mẫu', 'khong-dat': 'Mẫu không đạt', 'khac': 'Lý do khác' };
function isDeferred(rec) { return !!(rec && rec.deferReason); }
function deferReasonLabel(rec) { return DEFER_REASONS[rec.deferReason] || ''; }
function deferTagHTML(rec) {
  if (!isDeferred(rec)) return '';
  return '<span class="defer-tag">⏸ Hẹn lại · ' + esc(deferReasonLabel(rec)) + '</span>';
}
function deferredRecords() {
  return store.getAll().filter(isDeferred)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); /* thứ tự tiếp nhận (v50) */
}

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
  ['today', 'manage', 'export', 'display', 'form', 'types', 'typeform', 'printcfg', 'audit', 'handover', 'batch', 'deferred'].forEach((v) => $('view-' + v).classList.toggle('hidden', v !== name));
  const subView = name === 'form' || name === 'types' || name === 'typeform' || name === 'printcfg' || name === 'audit' || name === 'handover' || name === 'batch' || name === 'deferred';
  $('bottom-nav').style.display = subView ? 'none' : 'flex';
  /* Nút + hiện ở tab Hôm nay và tab Quản lý; ẩn ở tab Lọc & Xuất và các màn hình phụ */
  $('fab-add').classList.toggle('hidden', subView || name === 'export' || name === 'display');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'today' || name === 'manage' || name === 'export' || name === 'display') mainView = name;
  if (name === 'today') renderToday();
  if (name === 'manage') renderManage();
  if (name === 'export') applyExport();
  if (name === 'types') renderTypes();
  if (name === 'audit') renderAuditLog();
  if (name === 'handover') renderHandover();
  if (name === 'batch') renderBatch();
  if (name === 'deferred') renderDeferred();
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
  /* Mẫu đang chờ mà quá ngưỡng (mặc định 60 phút) -> cảnh báo để không sót mẫu.
     Mẫu hẹn lại (F37) không tô quá hạn: nó đã có lịch xử lý riêng. */
  const isOverdue = !isDeferred(rec) && (status === 'no-result' || status === 'pending-release') &&
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
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 3.5h5"/></svg><span data-countdown data-ends="' + endsMs + '" data-uid="' + rec.uid + '">' + fmtCountdown(remainMs) + '</span></button>' +
        /* Nút tùy chọn nhắc qua Lịch (F25): tải file .ics có chuông báo đúng lúc tới giờ.
           Chỉ hiện trên điện thoại/máy tính bảng (v45): trên PC cửa sổ app luôn mở trên
           màn hình làm việc, bộ đếm trong app chạy bình thường nên không cần nhắc qua Lịch. */
        (calRemindAvailable() ? '<button class="timer-btn cal-btn" data-action="calremind" data-uid="' + rec.uid + '" title="Tạo lời nhắc trong Lịch điện thoại — chuông báo đúng lúc tới giờ, kể cả khi app đã đóng" aria-label="Nhắc qua Lịch">🔔 Lịch</button>' : '');
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
  /* Nút Hẹn lại ngay trên dòng mẫu (v74 — Minh không tìm thấy khi nó chỉ nằm
     trong trang Xem, mà mẫu chưa có kết quả thì không có nút Xem): hiện cho
     mọi mẫu chưa phát hành ở danh sách thao tác, mở thẳng hộp thoại lý do. */
  const deferBtn = (!o.readonly && status !== 'released' && !isDeferred(rec))
    ? '<button class="icon-btn defer-btn" data-action="defer" data-uid="' + rec.uid + '" title="Hẹn lại mẫu này (hụt mẫu / không đạt / lý do khác)" aria-label="Hẹn lại mẫu này">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></svg></button>'
    : '';
  const editDeleteBtns = o.readonly ? '' :
      '<button class="icon-btn" data-action="delete" data-uid="' + rec.uid + '" title="Xóa" aria-label="Xóa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>' +
      '<button class="icon-btn" data-action="edit" data-uid="' + rec.uid + '" title="Sửa" aria-label="Sửa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></svg></button>';
  const actions = (!viewBtn && !timerBtn && o.readonly) ? '' :
    '<div class="record-actions">' + viewBtn + timerBtn + releaseBtn + deferBtn + editDeleteBtns + '</div>';
  const timerDue = status === 'no-result' && !!rec.timerEndsAt && new Date(rec.timerEndsAt).getTime() <= Date.now();
  return '<li class="record-item' + (isOverdue ? ' overdue' : '') + (timerDue ? ' timer-due' : '') + (rec.urgent ? ' urgent' : '') + (isDeferred(rec) ? ' deferred' : '') + '">' + checkbox +
    '<div class="record-main"><div class="record-id">' + esc(rec.testId) + (rec.urgent ? '<span class="urgent-tag">KHẨN</span>' : '') + deferTagHTML(rec) + '</div>' +
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
    if (btn.dataset.action === 'calremind') downloadCalendarReminder(uid);
    if (btn.dataset.action === 'defer') openDeferModal(uid);
    if (btn.dataset.action === 'release') {
      const rec = store.getByUid(uid);
      /* Phát hành ngay khi bấm — không hỏi xác nhận lại (theo yêu cầu của Minh) */
      if (rec && store.statusOf(rec) === 'pending-release') {
        if (!requireOperator('phát hành kết quả')) return;
        const res = store.update(uid, { releaseAt: new Date().toISOString(), releaser: currentOperator, deferReason: '', deferNote: '', deferAt: null }); /* F37: phát hành = tự bỏ hẹn lại */
        if (res.ok) { audit('release', '', res.record); toast('Đã phát hành kết quả ' + rec.testId); refreshCurrent(); }
        else toast(res.errors.join('. '));
      }
    }
    if (btn.dataset.action === 'edit') openForm(uid);
    if (btn.dataset.action === 'delete') {
      const rec = store.getByUid(uid);
      if (rec && confirm('Xóa kết quả ' + rec.testId + ' (' + (getTestType(rec.typeId) || {}).name + ')?')) {
        if (!requireOperator('xóa kết quả')) return;
        audit('delete', deleteDetailOf(rec), rec);
        store.remove(uid);
        selectedUids.delete(uid);
        toast('Đã xóa');
        refreshCurrent();
        syncNativeAlarms();
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
  $('sum-urgent').classList.toggle('hidden', !rec.urgent); /* nhãn KHẨN ở trang Xem (F24) */
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
  /* F37: khối hẹn lại trong trang Xem — hiện lý do/ghi chú nếu đang hẹn,
     nút Hẹn lại chỉ có khi mẫu chưa phát hành */
  const dEl = $('sum-defer');
  if (isDeferred(rec)) {
    dEl.innerHTML = '⏸ <b>Hẹn lại</b> · Lý do: <b>' + esc(deferReasonLabel(rec)) + '</b>' +
      (rec.deferNote ? ' · ' + esc(rec.deferNote) : '') +
      (rec.deferAt ? '<br>Hẹn lúc: ' + esc(fmtFull(rec.deferAt)) : '');
    dEl.classList.remove('hidden');
  } else {
    dEl.classList.add('hidden');
  }
  const dBtn = $('btn-summary-defer');
  dBtn.classList.toggle('hidden', status === 'released');
  dBtn.textContent = isDeferred(rec) ? '⏸ Sửa / bỏ hẹn lại' : '⏸ Hẹn lại mẫu này';
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
  if (!requireOperator('phát hành kết quả')) return;
  const res = store.update(rec.uid, { releaseAt: new Date().toISOString(), releaser: currentOperator, deferReason: '', deferNote: '', deferAt: null }); /* F37: phát hành = tự bỏ hẹn lại */
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  audit('release', '', res.record);
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
  if (!requireOperator('hủy phát hành kết quả')) return;
  const res = store.update(rec.uid, { releaseAt: null, releaser: '' });
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  audit('unrelease', '', res.record);
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
/* Một đợt kêu báo tới giờ (F23): hai tông xen kẽ, âm lượng lớn (0.6), rung 3 nhịp */
function beepDue() {
  [[1560, 0], [2093, 200], [1560, 400], [2093, 600], [1560, 800], [2093, 1000]]
    .forEach(([f, at]) => setTimeout(() => beep(f, 150, 0.6), at));
  if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
}

/* ---- Báo động mẫu tới giờ (F23, v42) ----
 * Mẫu "tới giờ" = chưa có kết quả + timerEndsAt đã qua; trạng thái suy ra từ
 * DỮ LIỆU GỐC mỗi giây (không phụ thuộc mẫu có đang hiển thị hay không — bản
 * trước chỉ quét các số đếm đang render nên ở tab khác là im lặng).
 * - Đợt kêu đầu ngay khi tới giờ; sau đó lặp mỗi 15 giây, chỉ trong 15 phút
 *   đầu quá giờ. Banner đỏ + huy hiệu trên icon app giữ tới khi mẫu được xử lý.
 * - Mẫu đang mở trong form nhập thì không kêu (đang xử lý chính nó).
 * - Thông báo hệ thống: xin quyền một lần khi bắt đầu bấm giờ; mỗi mẫu bắn
 *   một thông báo nằm nguyên (requireInteraction) khi vừa tới giờ, bấm vào
 *   mở thẳng form của mẫu. Khi app bị thu nhỏ, nhịp kiểm tra do trình duyệt
 *   quyết định nên thông báo có thể chậm — không web app nào đảm bảo tuyệt đối. */
const notifiedDue = new Set();
const spokenDue = new Set(); /* (uid|timerEndsAt) đã đọc to rồi (F24) */
let prevDueIds = new Set();
let lastBurstAt = 0;
let wakeLock = null;
let lastWakeCheckAt = 0;
let lastNagCheckAt = 0;

function dueTimerRecords() {
  const now = Date.now();
  return store.getAll()
    .filter((r) => !isDeferred(r) && store.statusOf(r) === 'no-result' && r.timerEndsAt && new Date(r.timerEndsAt).getTime() <= now)
    .sort((a, b) => (a.timerEndsAt < b.timerEndsAt ? -1 : 1));
}

function dueBannerRecords(due) {
  const formOpen = !$('view-form').classList.contains('hidden');
  /* Thứ tự tiếp nhận (v50, theo yêu cầu của Minh): mẫu nhận trước hiện trước
     trong banner — mẫu khẩn KHÔNG còn nhảy lên đầu, chỉ giữ nhãn KHẨN trong nội dung */
  return due.filter((r) => !(formOpen && formState && formState.uid === r.uid))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function updateAlarmBanner(due) {
  const banner = $('alarm-banner');
  const shown = dueBannerRecords(due);
  if (!banner) return shown;
  if (!shown.length) { banner.classList.add('hidden'); banner.innerHTML = ''; return shown; }
  banner.innerHTML = '⏰ Tới giờ nhập kết quả: <b>' + esc(shown.slice(0, 3).map((r) => r.testId).join(', ')) + '</b>' +
    (shown.length > 3 ? ' và ' + (shown.length - 3) + ' mẫu nữa' : '') + ' — bấm để nhập ngay';
  banner.classList.remove('hidden');
  return shown;
}

function updateAppBadge(n) {
  try {
    if (!navigator.setAppBadge) return;
    if (n > 0) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch (e) { /* bỏ qua */ }
}

function maybeRequestNotifyPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      const p = Notification.requestPermission();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) { /* bỏ qua */ }
}

function showDueNotification(rec) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification('Tới giờ nhập kết quả — LabEntry', {
      body: rec.testId + ' (' + ((getTestType(rec.typeId) || {}).name || rec.typeId) + '). Bấm để nhập kết quả.',
      tag: 'labentry-due-' + rec.uid,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      icon: 'icon-192.png',
    });
    n.onclick = () => { try { window.focus(); } catch (e) { /* bỏ qua */ } openForm(rec.uid); n.close(); };
  } catch (e) { /* bỏ qua */ }
}

/* Giữ màn hình sáng trong lúc có mẫu đang đếm ngược (nhả khi hết mẫu chờ) */
async function manageWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;
    const now = Date.now();
    const anyRunning = store.getAll().some((r) => store.statusOf(r) === 'no-result' && r.timerEndsAt && new Date(r.timerEndsAt).getTime() > now);
    if (anyRunning && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!anyRunning && wakeLock) {
      const wl = wakeLock;
      wakeLock = null;
      await wl.release();
    }
  } catch (e) { wakeLock = null; }
}

function toggleTimer(uid) {
  const rec = store.getByUid(uid);
  if (!rec || store.statusOf(rec) !== 'no-result') return;
  const type = getTestType(rec.typeId);
  if (!type || !type.waitMinutes) return;
  const endsMs = rec.timerEndsAt ? new Date(rec.timerEndsAt).getTime() : 0;
  if (rec.timerEndsAt && endsMs > Date.now()) {
    store.update(uid, { timerEndsAt: null });
    toast('Đã hủy bấm giờ cho ' + rec.testId);
    refreshCurrent();
    syncNativeAlarms();
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
    maybeRequestNotifyPermission(); /* xin quyền thông báo hệ thống ngay lần bấm giờ đầu (F23) */
    manageWakeLock();
    toast('Đã bấm giờ ' + type.waitMinutes + ' phút cho ' + rec.testId + ' (' + type.name + ')');
    refreshCurrent();
    syncNativeAlarms();
  } else {
    toast(res.errors.join('. '));
  }
}

/* ================= Báo thức native trong vỏ APK (F26, v46) =================
 * Khi LabEntry chạy trong vỏ Android (repo này, thư mục android-shell/), vỏ
 * gắn thêm window.LabAlarmNative vào WebView: cầu nối tới AlarmManager của hệ
 * điều hành. syncNativeAlarms() tính lại toàn bộ mẫu đang đếm giờ (chưa có
 * kết quả + timerEndsAt ở tương lai) và gửi sang native để ĐẶT/HỦY báo thức
 * hệ thống khớp đúng danh sách — nhờ vậy tới giờ điện thoại kêu cả khi app
 * đã đóng, điều mà nền web không làm được (F23/F25). Native trả "NO_EXACT"
 * khi Android chưa cấp quyền báo thức chính xác (Android 14+ cấp tay): lần
 * đầu gặp, app hỏi mở đúng trang Cài đặt để bật. Trên trình duyệt thường
 * không có cầu nối này — hàm thoát ngay, hành vi y hệt v45. Mọi thay đổi làm
 * lệch danh sách (bấm giờ, hủy giờ, lưu form, xóa mẫu, khởi động, quay lại
 * app) đều gọi lại hàm này. Trong vỏ iOS (v47), cùng danh sách được gửi qua
 * window.webkit.messageHandlers.labAlarm sang LabAlarmCenter (Swift), nơi
 * UNUserNotificationCenter phụ trách bắn thông báo đúng giờ. */
let nativeAlarmWarned = false;
function syncNativeAlarms() {
  try {
    const bridge = window.LabAlarmNative;
    /* Bổ sung v47 — đường iOS: vỏ iOS gắn WKScriptMessageHandler "labAlarm"
       (window.webkit.messageHandlers.labAlarm); gửi cùng danh sách, một chiều. */
    const iosHandler = (!bridge && window.webkit && window.webkit.messageHandlers)
      ? window.webkit.messageHandlers.labAlarm : null;
    if (!bridge && !iosHandler) return;
    const now = Date.now();
    const want = store.getAll()
      .filter((r) => !isDeferred(r) && store.statusOf(r) === 'no-result' && r.timerEndsAt && new Date(r.timerEndsAt).getTime() > now)
      .map((r) => {
        const t = getTestType(r.typeId);
        return { id: r.uid, at: new Date(r.timerEndsAt).getTime(), label: r.testId + ' — ' + (t ? t.name : r.typeId) };
      });
    if (iosHandler) {
      iosHandler.postMessage(JSON.stringify(want));
      return;
    }
    const res = bridge.syncAll(JSON.stringify(want));
    if (res === 'NO_EXACT' && !nativeAlarmWarned) {
      nativeAlarmWarned = true;
      if (window.confirm('Android chưa cấp quyền báo thức chính xác cho LabEntry — báo giờ có thể trễ vài phút. Mở Cài đặt để bật ngay bây giờ?')) {
        bridge.openExactAlarmSettings();
      } else {
        toast('Chưa có quyền báo thức chính xác — báo giờ có thể trễ vài phút.');
      }
    }
  } catch (e) { /* cầu nối native lỗi: bỏ qua lặng lẽ, báo động trong app vẫn chạy */ }
}

/* ================= Nhắc qua Lịch điện thoại (F25, v44) =================
 * Bối cảnh: báo động trong app không chạy được khi app bị thu nhỏ/đóng (giới
 * hạn nền web đã xác nhận trên máy thật của Minh, 2026-11-06). Đường chắc
 * chắn còn lại trong nền web: một sự kiện Lịch có chuông báo — app Lịch của
 * điện thoại dùng báo thức hệ thống nên kêu đúng giờ bất kể LabEntry ra sao.
 * Nút "🔔 Lịch" (tùy chọn, hiện cạnh nút đếm ngược khi mẫu đang được bấm giờ)
 * tải một file .ics chuẩn iCalendar: sự kiện bắt đầu đúng timerEndsAt, dài
 * 5 phút, kèm VALARM DISPLAY tại thời điểm bắt đầu. Người dùng mở file và
 * thêm vào Lịch (Samsung Calendar / Google Calendar / Lịch Apple đều đọc
 * được .ics). UID chứa uid bản ghi + mốc hẹn giờ nên thêm lại cùng một nhắc
 * thì lịch cập nhật cùng một sự kiện thay vì nhân đôi. */
/* Nhắc qua Lịch chỉ có ý nghĩa trên điện thoại/máy tính bảng — nơi app bị thu
 * nhỏ/đóng và bộ đếm trong app bị hệ điều hành đóng băng (F23/F25). Trên PC
 * (Windows/macOS/Linux để bàn) cửa sổ app luôn hiện trên màn hình làm việc,
 * báo động trong app chạy bình thường nên nút này không hiện (v45, theo lưu ý
 * của Minh 2026-11-06). Nhận diện qua user agent di động. */
function calRemindAvailable() {
  try { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''); } catch (e) { return false; }
}

function icsUtc(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}

function icsEscape(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function buildCalendarIcs(rec) {
  const type = getTestType(rec.typeId);
  const start = rec.timerEndsAt;
  const end = new Date(new Date(start).getTime() + 5 * 60000).toISOString();
  const title = 'LabEntry — tới giờ nhập kết quả: ' + rec.testId;
  const desc = 'Mẫu ' + rec.testId + ' (' + (type ? type.name : rec.typeId) + ') đã tới giờ nhập kết quả. Nhận mẫu lúc ' + fmtList(rec.createdAt) + '.';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LabEntry//Timer Reminder//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + rec.uid + '-' + new Date(start).getTime() + '@labentry',
    'DTSTAMP:' + icsUtc(new Date().toISOString()),
    'DTSTART:' + icsUtc(start),
    'DTEND:' + icsUtc(end),
    'SUMMARY:' + icsEscape(title),
    'DESCRIPTION:' + icsEscape(desc),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT0M',
    'DESCRIPTION:' + icsEscape(title),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadCalendarReminder(uid) {
  const rec = store.getByUid(uid);
  if (!rec || !rec.timerEndsAt) return;
  if (new Date(rec.timerEndsAt).getTime() <= Date.now()) {
    toast('Mẫu đã tới giờ rồi — không cần nhắc lịch nữa');
    return;
  }
  const safeId = rec.testId.replace(/[^\w-]+/g, '_');
  const fileName = 'labentry-nhac-' + safeId + '.ics';
  if (downloadTextFile(fileName, buildCalendarIcs(rec), 'text/calendar;charset=utf-8') === 'fail') {
    toast('Không tạo được file nhắc lịch trên thiết bị này');
    return;
  }
  /* Hướng dẫn cài lịch hiện bằng HỘP THOẠI CỐ ĐỊNH, không dùng toast nữa
     (v45, theo phản hồi của Minh): toast tắt sau vài giây, người dùng chưa
     kịp đọc để làm theo. Hộp thoại ở nguyên cho tới khi người dùng bấm Đóng. */
  $('cal-guide-id').textContent = rec.testId;
  $('cal-guide-time').textContent = fmtList(rec.timerEndsAt);
  $('cal-guide-file').textContent = fileName;
  $('cal-guide-modal').classList.remove('hidden');
}

/* Chạy mỗi giây: cập nhật số đếm ngược đang hiển thị + phát hiện mẫu tới giờ
   từ dữ liệu gốc (F23) để báo động lặp, banner, thông báo và huy hiệu */
function timerTick() {
  const now = Date.now();
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const rec = store.getByUid(el.dataset.uid);
    if (!rec || !rec.timerEndsAt) return;
    const remain = new Date(rec.timerEndsAt).getTime() - now;
    if (remain > 0) el.textContent = fmtCountdown(remain);
  });
  const due = dueTimerRecords();
  const newly = due.filter((r) => !prevDueIds.has(r.uid));
  prevDueIds = new Set(due.map((r) => r.uid));
  const shown = updateAlarmBanner(due);
  updateAppBadge(due.length);
  newly.forEach((rec) => {
    const key = rec.uid + '|' + rec.timerEndsAt;
    if (!notifiedDue.has(key)) { notifiedDue.add(key); showDueNotification(rec); }
    toast('Tới giờ nhập kết quả: ' + rec.testId + ' (' + ((getTestType(rec.typeId) || {}).name || rec.typeId) + ')');
  });
  const withinBurstWindow = shown.some((r) => now - new Date(r.timerEndsAt).getTime() <= 15 * 60000);
  if (shown.length && withinBurstWindow && (newly.some((r) => shown.includes(r)) || now - lastBurstAt >= 15000)) {
    beepDue();
    lastBurstAt = now;
  }
  speakDue(newly.filter((r) => shown.includes(r))); /* đọc to mã mẫu vừa tới giờ (F24, khi bật) */
  if (newly.length) refreshCurrent();
  if (now - lastWakeCheckAt >= 5000) { lastWakeCheckAt = now; manageWakeLock(); }
  checkAutoLock(now); /* tự khóa người trực khi không thao tác (F24) */
  if (now - lastNagCheckAt >= 30000) { lastNagCheckAt = now; renderBackupNag(); }
  try { updateMascot(); } catch (e) { /* F31: lỗi linh vật không bao giờ được làm hỏng nhịp báo động */ }
}

function refreshCurrent() {
  if (!$('view-today').classList.contains('hidden')) renderToday();
  if (!$('view-manage').classList.contains('hidden')) renderManage();
  if (!$('view-export').classList.contains('hidden')) applyExport();
  if (!$('view-deferred').classList.contains('hidden')) renderDeferred(); /* F37: bỏ hẹn ngay tại trang riêng thì danh sách cập nhật tại chỗ */
}

/* ================= Tab Kết quả hôm nay ================= */
let selectMode = false;
const selectedUids = new Set();

function renderToday() {
  const q = $('input-search').value.trim();
  let recs = store.filter(null, { from: todayKey(), to: todayKey() });
  recs = recs.filter((r) => !isDeferred(r)); /* F37: mẫu hẹn lại nằm ở trang riêng */
  if (q) recs = store.filter(recs, { query: q });
  /* Thứ tự tiếp nhận (v50): giờ nhập tăng dần — nhập trước ở trên, mới nhất nằm
     cuối cùng; mẫu khẩn giữ nhãn/nền đỏ nhưng không nhảy lên đầu (trước v50 khẩn lên đầu theo F24) */
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
    if (!isDeferred(r) && st === 'no-result') noresult += 1; /* F37: hẹn lại không tính vào hàng chờ */
    if (!isDeferred(r) && st === 'pending-release') pending += 1;
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
  /* Cả hai khung Quản lý theo thứ tự tiếp nhận (v50): giờ nhận tăng dần — nhận
     trước lên đầu, nhận sau xuống cuối; mẫu khẩn không còn nhảy lên đầu (F24 cũ) */
  const pending = all.filter((r) => !isDeferred(r) && store.statusOf(r) === 'pending-release')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const noresult = all.filter((r) => !isDeferred(r) && store.statusOf(r) === 'no-result')
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
  $('count-deferred').textContent = deferredRecords().length; /* F37 */
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
  const recs = store.filter(null, c).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); /* thứ tự tiếp nhận (v50) */
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
  drawSheetBarcodes($('print-area')); /* mã vạch khối tài liệu (F21) */
  printAreaKind = 'results'; /* #print-area đang giữ tờ kết quả (F30) */
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
  const delivered = downloadTextFile(stampName('labentry-ket-qua', '.csv'), buildCsv(recs), 'text/csv;charset=utf-8');
  const done = (how) => toast(how === 'fail' ? 'Không xuất được file CSV trên thiết bị này' : 'Đã xuất CSV: ' + recs.length + ' kết quả');
  if (delivered && typeof delivered.then === 'function') delivered.then(done);
  else done(delivered);
}

/* ================= Sao lưu / phục hồi (F8) ================= */
function stampName(prefix, ext) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return prefix + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + ext;
}

/* Đưa một nội dung text thành file cho người dùng (sao lưu + CSV + nhắc lịch).
   Ba kênh theo thứ tự (F28, v52):
   1) Cầu nối file native trong vỏ app (window.LabFileNative.saveFile) — ghi
      thẳng vào thư mục Tải xuống của máy, trả 'OK'/'ERR'.
   2) Web Share kèm file (navigator.canShare) — người dùng tự chọn nơi lưu/gửi.
   3) Tải xuống kiểu trình duyệt (blob + <a download>) — chạy tốt trên trình
      duyệt thường, nhưng WebView của vỏ app NUỐT LẶNG thao tác này (không ghi
      file, không báo lỗi) nên khi đang ở trong vỏ app mà hai kênh trên không
      có thì phải trả 'fail' thay vì giả vờ thành công.
   Trả về 'native' | 'share' | 'download' | 'fail' (kênh share trả Promise).
   Bối cảnh: tới v51, exportBackupFile báo "Đã xuất file sao lưu" vô điều kiện
   nên trong bản APK file không hề tồn tại mà người dùng tưởng đã sao lưu —
   lỗi do Minh phát hiện trên máy thật 2026-11-08 (161 bản ghi). */
function downloadTextFile(name, text, mime) {
  const type = mime || 'text/plain;charset=utf-8';
  try {
    if (window.LabFileNative && typeof window.LabFileNative.saveFile === 'function') {
      return window.LabFileNative.saveFile(name, text) === 'OK' ? 'native' : 'fail';
    }
  } catch (e) { /* cầu nối lỗi -> thử kênh khác */ }
  try {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).then(() => 'share', () => 'fail');
    }
  } catch (e) { /* không chia sẻ được file -> thử tải thường */ }
  const inShell = !!(window.Capacitor || window.LabAlarmNative ||
    (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.labAlarm));
  try {
    const blob = new Blob([text], { type });
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
  return inShell ? 'fail' : 'download';
}

/* #print-area đang giữ tờ nào: 'results' (kết quả) hay 'handover' (bàn giao).
   Theo dõi tường minh để sự kiện in của hệ thống không ghi đè nhầm tờ (F30). */
let printAreaKind = 'results';
let lastPrintViaNative = false; /* lần in gần nhất có đi qua cầu nối native không */

/* In tờ hiện tại (bản kết quả / tờ bàn giao / xem trước bố cục). Trong vỏ
   app, window.print() của WebView là hàm rỗng — không có hộp thoại in nào
   hiện ra (Minh phát hiện trên APK 2026-11-08: sao lưu đã sửa ở F28 nhưng
   in/xuất PDF vẫn không chạy). Khi có cầu nối native thì gọi
   LabFileNative.print() -> PrintManager của Android (hộp thoại in hệ thống,
   có cả "Lưu thành PDF"); ngoài vỏ app giữ nguyên window.print(). (F29) */
function printSheet() {
  try {
    if (window.LabFileNative && typeof window.LabFileNative.print === 'function') {
      lastPrintViaNative = true;
      window.LabFileNative.print();
      return;
    }
  } catch (e) { /* cầu nối lỗi -> thử in thường */ }
  lastPrintViaNative = false;
  if (typeof window.print === 'function') window.print();
}

function exportBackupFile() {
  const obj = JSON.parse(store.exportBackup());
  if (typesCustom) obj.types = getTestTypes(); /* kèm danh mục tự tạo để sang máy khác phục hồi đủ loại */
  try {
    obj.printLayout = JSON.parse(JSON.stringify(printSettings)); /* bố cục bản in đi kèm file (đợt 2) */
    obj.printPresets = JSON.parse(JSON.stringify(printPresets)); /* thư viện mẫu bố cục (v30) */
    obj.staff = staffList.slice(); /* danh sách KTV (v30) */
    obj.operator = currentOperator; /* KTV trực đang chọn (v30) */
    obj.auditLog = JSON.parse(JSON.stringify(auditLog)); /* nhật ký thao tác (F22) */
  } catch (e) { /* bỏ qua nếu lỗi sao chép */ }
  const count = store.getAll().length;
  const delivered = downloadTextFile(stampName('labentry-sao-luu', '.json'), JSON.stringify(obj, null, 2), 'application/json');
  /* Chỉ ghi nhận sao lưu + báo thành công khi file THẬT SỰ được giao (F28):
     trước đây báo thành công vô điều kiện kể cả khi vỏ app nuốt mất file */
  const markDone = (how) => {
    if (how === 'fail') {
      toast('Không xuất được file sao lưu trên thiết bị này — dữ liệu vẫn còn nguyên trong app');
      return;
    }
    /* Ghi nhớ lần sao lưu gần nhất để tắt thanh nhắc + hiện ở thẻ sao lưu (F24) */
    appMeta.lastBackupAt = new Date().toISOString();
    saveMeta();
    renderBackupNag();
    toast('Đã xuất file sao lưu: ' + count + ' bản ghi');
  };
  if (delivered && typeof delivered.then === 'function') delivered.then(markDone);
  else markDone(delivered);
  return obj;
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
  let fileAudit = null;
  try {
    const raw = JSON.parse(text);
    if (raw && Array.isArray(raw.types)) fileTypes = raw.types;
    if (raw && raw.printLayout && typeof raw.printLayout === 'object') fileLayout = raw.printLayout;
    if (raw && Array.isArray(raw.staff)) fileStaff = sanitizeStaffList(raw.staff);
    if (raw && Array.isArray(raw.printPresets)) filePresets = raw.printPresets.filter((p) => p && typeof p.name === 'string' && p.name.trim() && p.settings && typeof p.settings === 'object');
    if (raw && Array.isArray(raw.auditLog)) fileAudit = sanitizeAuditLog(raw.auditLog);
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
  const auditNote = fileAudit
    ? (merge
      ? '\nFile có kèm nhật ký thao tác — các dòng nhật ký trong file sẽ được hợp nhất vào nhật ký của máy này.'
      : '\nFile có kèm nhật ký thao tác — nhật ký trên máy này sẽ được thay bằng nhật ký trong file.')
    : '';
  const ask = merge
    ? 'File sao lưu có ' + parsed.records.length + ' bản ghi (xuất lúc ' + when + ').' + typeNote + layoutNote + packNote + auditNote + '\n\nGỘP sẽ thêm các mẫu máy này CHƯA có; mẫu trùng ID + loại sẽ bị bỏ qua. Dữ liệu hiện tại được giữ nguyên. Tiếp tục?'
    : 'File sao lưu có ' + parsed.records.length + ' bản ghi (xuất lúc ' + when + ').' + typeNote + layoutNote + packNote + auditNote + '\n\nPhục hồi sẽ THAY TOÀN BỘ dữ liệu hiện tại trên máy này. Tiếp tục?';
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
    if (fileAudit) {
      const have = new Set(auditLog.map((e) => e.id));
      fileAudit.forEach((e) => { if (!have.has(e.id)) auditLog.push(e); });
      auditLog.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      if (auditLog.length > AUDIT_CAP) auditLog = auditLog.slice(auditLog.length - AUDIT_CAP);
      saveAuditLog();
    }
    audit('merge', 'Gộp dữ liệu từ file sao lưu: thêm ' + res.added + ' mẫu mới, bỏ qua ' + res.skipped + ' mẫu trùng', null);
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
    /* Nhật ký (F22): phục hồi thì nhật ký của máy = nhật ký trong file (file cũ
       không có thì bắt đầu trống), rồi ghi dòng phục hồi vào chính nhật ký mới */
    auditLog = fileAudit || [];
    saveAuditLog();
    audit('restore', 'Phục hồi toàn bộ từ file sao lưu: ' + res.count + ' bản ghi (file xuất lúc ' + when + ')', null);
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
  $('input-urgent').checked = !!(rec && rec.urgent);
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

/* Liệt kê thay đổi giữa bản ghi cũ và nội dung form sắp lưu (cho nhật ký F22):
   ID, loại XN, từng trường kết quả, ghi chú và 3 dấu KTV — giá trị trống ghi "(trống)" */
function diffRecordChanges(oldRec, payload) {
  const parts = [];
  const type = getTestType(payload.typeId);
  const oldType = getTestType(oldRec.typeId);
  if (oldRec.testId !== payload.testId) parts.push('ID: ' + oldRec.testId + ' → ' + payload.testId);
  if (oldRec.typeId !== payload.typeId) {
    parts.push('Loại XN: ' + (oldType ? oldType.name : oldRec.typeId) + ' → ' + (type ? type.name : payload.typeId));
  }
  const keys = new Set(Object.keys(oldRec.results || {}).concat(Object.keys(payload.results || {})));
  keys.forEach((k) => {
    const ov = (oldRec.results || {})[k] || '';
    const nv = (payload.results || {})[k] || '';
    if (ov !== nv) {
      const f = (type && type.fields.find((x) => x.key === k)) || (oldType && oldType.fields.find((x) => x.key === k));
      parts.push((f ? f.label : k) + ': ' + (ov || '(trống)') + ' → ' + (nv || '(trống)'));
    }
  });
  if ((oldRec.note || '') !== (payload.note || '')) {
    parts.push('Ghi chú: ' + (oldRec.note || '(trống)') + ' → ' + (payload.note || '(trống)'));
  }
  if (!!oldRec.urgent !== !!payload.urgent) {
    parts.push('Mẫu khẩn: ' + (oldRec.urgent ? 'Có' : 'Không') + ' → ' + (payload.urgent ? 'Có' : 'Không'));
  }
  [['receiver', 'KTV nhận'], ['performer', 'KTV thực hiện'], ['releaser', 'KTV phát hành']].forEach(([k, label]) => {
    const ov = oldRec[k] || '';
    const nv = payload[k] || '';
    if (ov !== nv) parts.push(label + ': ' + (ov || '(trống)') + ' → ' + (nv || '(trống)'));
  });
  return parts;
}

function saveForm() {
  if (!currentOperator) {
    showFormError('Chưa chọn KTV trực — hãy chọn người trực (thanh KTV trực ở tab Hôm nay) trước khi lưu.');
    return;
  }
  const releaseVal = $('input-release').value;
  const payload = {
    testId: $('input-testid').value,
    typeId: formState.typeId,
    results: formState.results,
    note: $('input-note').value,
    urgent: $('input-urgent').checked,
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
  const oldRec = wasAdd ? null : store.getByUid(formState.uid);
  const oldReleaseAt = oldRec ? oldRec.releaseAt : null;
  const res = formState.uid ? store.update(formState.uid, payload) : store.add(payload, new Date(formState.createdAt));
  if (!res.ok) {
    showFormError(res.errors.join('. '));
    return;
  }
  /* Nhật ký (F22): thêm mới = nhận mẫu; sửa = dòng thay đổi chi tiết (nếu có);
     đổi trạng thái phát hành qua form ghi thành sự kiện riêng */
  if (wasAdd) {
    audit('receive', 'Thêm mẫu bằng form nhập', res.record);
  } else if (oldRec) {
    const parts = diffRecordChanges(oldRec, payload);
    if (parts.length) audit('save', parts.join('; '), res.record);
    if (!oldReleaseAt && payload.releaseAt) audit('release', 'Đặt giờ phát hành qua form nhập', res.record);
    if (oldReleaseAt && !payload.releaseAt) audit('unrelease', 'Xóa giờ phát hành qua form nhập', res.record);
  }
  toast('Đã lưu kết quả');
  if (wasAdd) {
    /* Nhận mẫu MỚI (F25, theo yêu cầu của Minh 2026-11-06): dù form được mở từ
       tab Hôm nay hay tab Quản lý, lưu xong là chuyển sang tab Quản lý, khung
       Chưa kết quả — nơi xử lý hàng chờ tiếp theo (mở rộng quy tắc v25, trước
       đây chỉ áp dụng khi đang ở sẵn tab Quản lý). renderToday() chạy trước để
       danh sách Hôm nay vẫn tươi khi người dùng quay lại tab đó. */
    managePanel = 'noresult';
    renderToday();
    switchView('manage');
  } else {
    /* Sửa mẫu cũ: quay về đúng tab đang dùng trước khi mở form — không nhảy tab */
    switchView(mainView);
  }
  syncNativeAlarms(); /* F26: khớp báo thức native sau khi lưu (nhập kết quả = hủy báo) */
}

/* ================= Nhập kết quả theo lô (F27, v49) =================
 * Màn hình nhập kết quả cho NHIỀU mẫu cùng loại một lúc — chỉ gồm các mẫu
 * "chưa có kết quả" của loại đã chọn, xếp ĐÚNG thứ tự tiếp nhận (nhận trước
 * nhập trước — yêu cầu của Minh 2026-11-07; không đẩy mẫu khẩn lên đầu).
 * Hai hình dạng theo bề rộng màn hình: >= 900px (PC/máy tính bảng) = bảng
 * lưới đầy đủ (mỗi hàng một mẫu, mỗi cột một chỉ mục, điền nhanh cả cột);
 * < 900px (điện thoại) = thẻ từng mẫu + thanh chọn mẫu + nút "Lưu & mẫu
 * tiếp theo". Lưu theo đúng ngữ nghĩa của form nhập đơn (saveForm): mẫu có
 * kết quả thì xóa bấm giờ, đóng dấu KTV thực hiện = người trực, ghi nhật ký
 * 'save' với chi tiết thay đổi. Mọi đường thoát khỏi màn hình lô (nút ‹,
 * nút Lưu, nút "mẫu tiếp theo") đều LƯU các thay đổi trước; riêng nút
 * "Để sau" ở dạng bảng là bỏ thay đổi (có hỏi xác nhận). */
let batchState = null;

function batchPending(typeId) {
  return store.getAll()
    .filter((r) => r.typeId === typeId && !isDeferred(r) && store.statusOf(r) === 'no-result')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
function batchTypesWithPending() {
  return getTestTypes()
    .map((t) => ({ type: t, n: batchPending(t.id).length }))
    .filter((x) => x.n > 0);
}
function openBatch() {
  if (!requireOperator('nhập kết quả theo lô')) return;
  const withPending = batchTypesWithPending();
  const typeId = withPending.length
    ? withPending.slice().sort((a, b) => b.n - a.n)[0].type.id
    : (getTestTypes()[0] ? getTestTypes()[0].id : null);
  batchState = { typeId, uids: [], work: {}, cur: 0, mode: null };
  if (typeId) loadBatchType(typeId);
  switchView('batch');
}
function loadBatchType(typeId) {
  batchState.typeId = typeId;
  const recs = batchPending(typeId);
  batchState.uids = recs.map((r) => r.uid);
  batchState.work = {};
  recs.forEach((r) => { batchState.work[r.uid] = Object.assign({}, r.results || {}); });
  batchState.cur = 0;
  batchShownCur = -1; /* mở lô / đổi loại: lần vẽ thẻ đầu tiên luôn cuộn lên đầu */
}
/* v65 (Minh góp ý): ở dạng thẻ, mỗi khi CHUYỂN sang mẫu khác (Lưu & mẫu
   tiếp theo, Trước, bấm viên ID) thì tự cuộn trang lên đầu và đưa viên ID
   đang nhập ra giữa dải ID — người dùng thấy ngay mẫu mới từ đầu thẻ.
   Bấm chip/nhập nhanh trong cùng một mẫu KHÔNG cuộn (đang nhập dở). */
let batchShownCur = -1;
function batchScrollToCurrent() {
  try { window.scrollTo(0, 0); } catch (e) { /* môi trường không cuộn được: bỏ qua */ }
  const strip = $('batch-strip');
  const pill = strip && strip.querySelector('.bpill.cur');
  if (strip && pill) {
    strip.scrollLeft = Math.max(0, pill.offsetLeft - Math.max(0, (strip.clientWidth - pill.offsetWidth) / 2));
  }
}
function batchIsGrid() { return window.innerWidth >= 900; }
function batchEntered(uid) {
  return store.hasResult({ typeId: batchState.typeId, results: batchState.work[uid] });
}
function batchDirty(uid) {
  const rec = store.getByUid(uid);
  if (!rec) return false;
  const type = getTestType(batchState.typeId);
  return type.fields.some((f) => (batchState.work[uid][f.key] || '') !== ((rec.results || {})[f.key] || ''));
}
function batchDirtyCount() { return batchState.uids.filter(batchDirty).length; }
function saveBatch() {
  let saved = 0;
  batchState.uids.slice().forEach((uid) => {
    if (!batchDirty(uid)) return;
    const oldRec = store.getByUid(uid);
    if (!oldRec) return;
    const work = batchState.work[uid];
    const payload = { results: Object.assign({}, work) };
    if (store.hasResult({ typeId: batchState.typeId, results: work })) {
      payload.timerEndsAt = null;
      payload.performer = currentOperator;
    }
    const res = store.update(uid, payload);
    if (res.ok) {
      saved++;
      const parts = diffRecordChanges(oldRec, Object.assign({}, oldRec, payload));
      if (parts.length) audit('save', parts.join('; '), res.record);
    }
  });
  if (saved) {
    syncNativeAlarms();
    toast('Đã lưu kết quả ' + saved + ' mẫu');
  }
  return saved;
}
function batchTimeOf(iso) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function renderBatch() {
  if (!batchState) return;
  batchState.mode = batchIsGrid() ? 'grid' : 'card';
  const sel = $('batch-type');
  const opts = batchTypesWithPending();
  if (batchState.typeId && !opts.some((x) => x.type.id === batchState.typeId)) {
    const t = getTestType(batchState.typeId);
    if (t) opts.push({ type: t, n: 0 });
  }
  sel.innerHTML = opts.map((x) =>
    '<option value="' + x.type.id + '"' + (x.type.id === batchState.typeId ? ' selected' : '') + '>' +
    esc(x.type.name) + ' (' + x.n + ' mẫu chờ)</option>').join('');
  const type = getTestType(batchState.typeId);
  $('batch-count').textContent = batchState.uids.length + ' mẫu chờ';
  const empty = batchState.uids.length === 0 || !type;
  $('batch-empty').classList.toggle('hidden', !empty);
  const grid = batchIsGrid();
  $('batch-grid-wrap').classList.toggle('hidden', empty || !grid);
  $('batch-grid-actions').classList.toggle('hidden', empty || !grid);
  $('batch-card-wrap').classList.toggle('hidden', empty || grid);
  if (empty) return;
  if (grid) renderBatchGrid(type); else renderBatchCard(type);
  refreshBatchCounts();
  if (!grid && batchState.cur !== batchShownCur) batchScrollToCurrent();
  batchShownCur = batchState.cur;
}

function refreshBatchCounts() {
  if (!batchState) return;
  const dirty = batchDirtyCount();
  const saveBtn = $('btn-batch-save');
  if (saveBtn) saveBtn.textContent = 'Lưu kết quả' + (dirty ? ' (' + dirty + ' mẫu)' : '');
}

function renderBatchGrid(type) {
  const wrap = $('batch-grid-wrap');
  const head = '<tr><th class="bcol-id">Mẫu</th>' + type.fields.map((f) => {
    const colBtn = f.type === 'chips'
      ? '<button type="button" class="bcol-clear" data-bcol="' + f.key + '" title="Đặt cả cột thành Âm tính (bỏ chọn)">Âm tính cả cột</button>'
      : '';
    return '<th>' + esc(f.label) + colBtn + '</th>';
  }).join('') + '<th></th></tr>';
  const rows = batchState.uids.map((uid) => {
    const rec = store.getByUid(uid);
    const w = batchState.work[uid];
    const cells = type.fields.map((f) => {
      if (f.type === 'text') {
        return '<td><input type="text" class="btext" data-btext="' + uid + '|' + f.key + '" value="' +
          esc(w[f.key] || '') + '" autocomplete="off"></td>';
      }
      const segs = f.levels.map((lv) =>
        '<button type="button" class="bseg' + (w[f.key] === lv ? ' on' : '') + '" data-bchip="' +
        uid + '|' + f.key + '|' + esc(lv) + '">' + esc(lv) + '</button>').join('');
      return '<td><div class="bsegs">' + segs + '</div></td>';
    }).join('');
    return '<tr' + (rec.urgent ? ' class="brow-urgent"' : '') + '>' +
      '<td class="bcol-id"><span class="bid">' + esc(rec.testId) + '</span>' +
      (rec.urgent ? ' <span class="urgent-tag">KHẨN</span>' : '') +
      '<div class="bmeta">nhận ' + batchTimeOf(rec.createdAt) + '</div></td>' +
      cells + '<td class="bstatus" id="bstatus-' + uid + '"></td></tr>';
  }).join('');
  wrap.innerHTML = '<div class="btable-scroll"><table class="btable"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  wrap.querySelectorAll('[data-bchip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [uid, key, val] = btn.dataset.bchip.split('|');
      batchState.work[uid][key] = batchState.work[uid][key] === val ? '' : val;
      renderBatch();
    });
  });
  wrap.querySelectorAll('[data-btext]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const [uid, key] = inp.dataset.btext.split('|');
      batchState.work[uid][key] = inp.value;
      updateBatchRowStatus(uid);
      refreshBatchCounts();
    });
  });
  wrap.querySelectorAll('[data-bcol]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.bcol;
      batchState.uids.forEach((uid) => { batchState.work[uid][key] = ''; });
      renderBatch();
    });
  });
  batchState.uids.forEach(updateBatchRowStatus);
}
function updateBatchRowStatus(uid) {
  const el = $('bstatus-' + uid);
  if (!el || !batchState) return;
  if (batchEntered(uid)) { el.textContent = '✓ Đã nhập'; el.className = 'bstatus ok'; }
  else if (batchDirty(uid)) { el.textContent = 'Đang nhập'; el.className = 'bstatus mid'; }
  else { el.textContent = 'Chưa nhập'; el.className = 'bstatus'; }
}

function renderBatchCard(type) {
  const strip = $('batch-strip');
  strip.innerHTML = batchState.uids.map((uid, i) => {
    const rec = store.getByUid(uid);
    return '<button type="button" class="bpill' + (i === batchState.cur ? ' cur' : '') +
      (batchEntered(uid) ? ' done' : '') + '" data-bpill="' + i + '">' + esc(rec.testId) +
      (batchEntered(uid) ? ' ✓' : '') + (rec.urgent ? ' · KHẨN' : '') + '</button>';
  }).join('');
  strip.querySelectorAll('[data-bpill]').forEach((btn) => {
    btn.addEventListener('click', () => { batchState.cur = Number(btn.dataset.bpill); renderBatch(); });
  });
  const uid = batchState.uids[batchState.cur];
  const rec = store.getByUid(uid);
  const w = batchState.work[uid];
  const quickHtml = type.quick && type.quick.length
    ? '<div class="quick-row"><span class="quick-caption">⚡ Nhập nhanh:</span>' +
      type.quick.map((q, qi) => '<button type="button" class="quick-btn" data-bquick="' + qi + '">' + esc(q.label) + '</button>').join('') + '</div>'
    : '';
  const fieldsHtml = type.fields.map((f) => {
    const label = esc(type.name) + ': ' + esc(f.label);
    if (f.type === 'text') {
      return '<div class="form-row"><label class="form-label">' + label + '</label>' +
        '<input type="text" data-bfield="' + f.key + '" value="' + esc(w[f.key] || '') + '" autocomplete="off"></div>';
    }
    const chips = f.levels.map((lv) =>
      '<button type="button" class="chip' + (w[f.key] === lv ? ' selected' : '') + '" data-bchipf="' +
      f.key + '|' + esc(lv) + '">' + esc(lv) + '</button>').join('');
    return '<div class="form-row"><span class="form-label">' + label + '</span><div class="chips">' + chips + '</div></div>';
  }).join('');
  $('batch-card').innerHTML =
    '<div class="bcard-head"><span class="bcard-id">' + esc(rec.testId) + '</span>' +
    (rec.urgent ? ' <span class="urgent-tag">KHẨN</span>' : '') +
    '<span class="bcard-meta">' + esc(type.name) + ' · nhận ' + batchTimeOf(rec.createdAt) + '</span></div>' +
    quickHtml + fieldsHtml;
  const card = $('batch-card');
  card.querySelectorAll('[data-bfield]').forEach((inp) => {
    inp.addEventListener('input', () => { batchState.work[uid][inp.dataset.bfield] = inp.value; refreshBatchCardMeta(); });
    wrapWithMic(inp);
  });
  card.querySelectorAll('[data-bchipf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [key, val] = btn.dataset.bchipf.split('|');
      batchState.work[uid][key] = batchState.work[uid][key] === val ? '' : val;
      renderBatch();
    });
  });
  card.querySelectorAll('[data-bquick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = type.quick[Number(btn.dataset.bquick)];
      type.fields.forEach((f) => { batchState.work[uid][f.key] = q.values[f.key] || ''; });
      renderBatch();
    });
  });
  refreshBatchCardMeta();
}
function refreshBatchCardMeta() {
  if (!batchState) return;
  const entered = batchState.uids.filter(batchEntered).length;
  $('batch-prog').innerHTML = 'đã nhập<br><b>' + entered + ' / ' + batchState.uids.length + '</b>';
  $('btn-batch-prev').disabled = batchState.cur <= 0;
  $('btn-batch-next').textContent = batchState.cur >= batchState.uids.length - 1
    ? 'Lưu & xong ✓' : 'Lưu & mẫu tiếp theo →';
  const strip = $('batch-strip');
  strip.querySelectorAll('[data-bpill]').forEach((btn, i) => {
    btn.classList.toggle('done', batchEntered(batchState.uids[i]));
  });
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
function beep(freq, ms, vol) {
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
    gain.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.01);
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
  /* Chế độ 'find' (F24): quét 1 mã để TÌM mẫu đã có — mở từ tab Quản lý */
  const find = source === 'find';
  const single = find || (source === 'form' && !!formState.uid);
  scannerState = { source, single, find, count: 0, lastCode: '', lastAt: 0 };
  const typeSel = $('scanner-type-select');
  typeSel.disabled = false;
  typeSel.value = source === 'form' ? formState.typeId : (typeSel.value || getTestTypes()[0].id);
  $('scanner-list').innerHTML = '';
  $('scanner-input').value = '';
  $('scan-frame').classList.remove('hidden');
  $('scanner-title').textContent = find ? 'Quét tìm mẫu' : (single ? 'Quét mã mẫu' : 'Tiếp nhận mẫu');
  $('scanner-subtitle').textContent = find ? 'Quét 1 mã — app tìm và mở ngay mẫu đó' : (single ? 'Nhận 1 mã để điền vào ô ID của mẫu đang sửa' : 'Quét mã liên tục — mỗi mã là một mẫu được nhận');
  /* Tìm mẫu thì loại XN + KTV nhận không liên quan — ẩn hai hàng chọn cho gọn */
  document.querySelectorAll('.scanner-type-row').forEach((el) => el.classList.toggle('hidden', find));
  $('scanner-session').classList.toggle('hidden', single);
  /* Chế độ quét liên tục: chỉ quét bằng camera, không hiện ô nhập tay + nút Nhận mẫu.
     Ô nhập tay chỉ còn ở chế độ 1 mã (mở từ form sửa / quét tìm) làm đường dự phòng. */
  $('scanner-manual').classList.toggle('hidden', !single);
  updateScanCount();
  $('scanner-modal').classList.remove('hidden');
  unlockAudio();
  setScanMsg(find ? 'Đưa mã vào khung hình để tìm mẫu...' : (single ? 'Nhận 1 mã để điền vào ô ID...' : 'Đang mở camera — quét liên tục, bấm "Dừng quét" khi xong...'));
  startCamera();
}

/* Quét tìm mẫu (F24): khớp ĐÚNG mã (không phân biệt khoảng trắng thừa ở hai đầu).
   Thấy nhiều mẫu cùng ID (khác loại XN) thì mở mẫu mới nhất và báo số lượng. */
function findAndOpenRecord(code) {
  const matches = store.getAll().filter((r) => r.testId.trim() === code);
  if (!matches.length) {
    setScanMsg('Không tìm thấy mẫu ' + code + ' — quét lại hoặc kiểm tra mã', 'err');
    beepErr();
    if (navigator.vibrate) navigator.vibrate(120);
    return false;
  }
  matches.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const rec = matches[0];
  beepOk();
  noteActivity();
  closeScanner();
  if (matches.length > 1) toast('Có ' + matches.length + ' mẫu cùng ID ' + code + ' — mở mẫu mới nhất');
  if (store.hasResult(rec)) openSummary(rec.uid); else openForm(rec.uid);
  return true;
}

/* Nhận 1 mã (từ camera hoặc nhập tay). Trả về true nếu mã được xử lý nhận.
   Loại XN KHÔNG bị khóa trong phiên: mỗi mẫu nhận theo loại đang chọn tại thời điểm bắn mã đó,
   người dùng đổi loại lúc nào cũng được (theo yêu cầu của Minh, v17). */
function acceptScanCode(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code || !scannerState) return false;

  if (scannerState.find) return findAndOpenRecord(code);

  if (scannerState.single) {
    $('input-testid').value = code;
    beepOk();
    toast('Đã quét mã: ' + code);
    closeScanner();
    return true;
  }

  if (!currentOperator) {
    setScanMsg('Chưa chọn KTV trực — hãy chọn người trực trước khi nhận mẫu', 'err');
    beepErr();
    if (navigator.vibrate) navigator.vibrate(120);
    return false;
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
  audit('receive', 'Quét nhận mẫu', res.record);
  noteActivity(); /* quét bằng camera không sinh sự kiện người dùng — vẫn tính là đang thao tác (cho tự khóa F24) */
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

/* F35 (v71): chụp ảnh đọc mã — cho lúc mã xấu, quét trực tiếp mãi không ra.
   Ảnh chỉ được xử lý trong bộ nhớ rồi bỏ ngay: không lưu vào máy, không đính
   vào bản ghi, không gửi đi đâu. Đọc được mã thì đi đúng đường acceptScanCode
   như quét trực tiếp (tiếp nhận / tìm mẫu / điền form đều dùng chung). */
async function scanPhotoFile(file) {
  if (!file || !scannerState) return;
  if (!('BarcodeDetector' in window) || typeof createImageBitmap !== 'function') {
    setScanMsg('Trình duyệt này không đọc được mã từ ảnh — hãy mở app bằng Chrome trên điện thoại hoặc bản APK để chụp ảnh đọc mã.', 'err');
    beepErr();
    return;
  }
  setScanMsg('Đang đọc mã trong ảnh...');
  try {
    const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
    const bmp = await createImageBitmap(file);
    let codes = await detector.detect(bmp).catch(() => []);
    if ((!codes || !codes.length) && bmp.width > 800 && bmp.height > 800) {
      /* Chưa ra: thử lại trên vùng giữa ảnh (mã thường nằm ở đó, ít nhiễu hơn) */
      const cw = Math.floor(bmp.width * 0.62);
      const ch = Math.floor(bmp.height * 0.62);
      const cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = ch;
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.drawImage(bmp, Math.floor((bmp.width - cw) / 2), Math.floor((bmp.height - ch) / 2), cw, ch, 0, 0, cw, ch);
        const crop = await createImageBitmap(cv).catch(() => null);
        if (crop) {
          codes = await detector.detect(crop).catch(() => []);
          if (crop.close) crop.close();
        }
      }
    }
    if (bmp.close) bmp.close();
    const code = codes && codes.length && codes[0].rawValue ? String(codes[0].rawValue).trim() : '';
    if (!code) {
      setScanMsg('Chưa đọc được mã trong ảnh — chụp gần hơn, rõ nét, đủ sáng rồi thử lại.', 'err');
      beepErr();
      if (navigator.vibrate) navigator.vibrate(120);
      return;
    }
    acceptScanCode(code);
  } catch (e) {
    setScanMsg('Không xử lý được ảnh này — thử chụp lại.', 'err');
  }
}

async function startCamera() {
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('scan-frame').classList.add('hidden');
    if (scannerState && scannerState.find) {
      setScanMsg('Thiết bị/trình duyệt này không hỗ trợ quét bằng camera — nhập ID mẫu vào ô dưới rồi bấm "Nhận mẫu" để tìm.', 'err');
    } else if (scannerState && scannerState.single) {
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
  $('scanner-modal').classList.add('hidden');
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  scannerState = null;
  if (added > 0) {
    toast('Đã nhận ' + added + ' mẫu trong phiên quét');
    /* Nhận mẫu mới xong (F25, theo yêu cầu của Minh 2026-11-06): chuyển sang
       tab Quản lý, khung Chưa kết quả để xử lý tiếp hàng chờ — bất kể phiên
       quét được mở từ tab Hôm nay hay từ nút + (trước đây quét từ tab Hôm nay
       thì ở lại tab Hôm nay). */
    managePanel = 'noresult';
    renderToday();
    switchView('manage');
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
  if (typeof x === 'string' && x.trim()) return { name: x.trim(), salt: '', pinHash: null, sig: '' };
  if (x && typeof x.name === 'string' && x.name.trim()) {
    return {
      name: x.name.trim(),
      salt: typeof x.salt === 'string' ? x.salt : '',
      pinHash: typeof x.pinHash === 'string' && x.pinHash ? x.pinHash : null,
      /* Ảnh chữ ký (F34): data URL PNG đã thu nhỏ; file cũ không có -> '' */
      sig: (typeof x.sig === 'string' && x.sig.indexOf('data:image/') === 0 && x.sig.length <= 300000) ? x.sig : '',
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
  if (!name) {
    const prev = currentOperator;
    setOperator('');
    if (prev) audit('operator', 'Đổi người trực: ' + prev + ' → (chưa chọn)', null);
    return;
  }
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
  const prevOp = currentOperator;
  setOperator(name);
  audit('operator', 'Đổi người trực: ' + (prevOp || '(chưa chọn)') + ' → ' + name, null);
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
      '<span class="staff-pin-state">' + (st.sig ? '✍️ đã ký' : 'chưa ký') + '</span>' +
      '<button type="button" class="mini-btn" data-staff-sig="' + esc(st.name) + '">Chữ ký</button>' +
      '<button type="button" class="mini-btn" data-staff-pin="' + esc(st.name) + '">' + (st.pinHash ? 'Đổi PIN' : 'Đặt PIN') + '</button>' +
      '<button type="button" class="mini-btn danger" data-staff-del="' + esc(st.name) + '">Xóa</button>';
    ul.appendChild(li);
  });
  $('staff-empty').classList.toggle('hidden', staffList.length > 0);
}

function openStaffDialog() { renderStaffList(); $('staff-modal').classList.remove('hidden'); }
function closeStaffDialog() { $('staff-modal').classList.add('hidden'); }

/* ================= Chữ ký KTV (F34, v67) =================
 * Mỗi KTV lưu một ảnh chữ ký (data URL PNG đã cắt gọn + thu nhỏ, nằm
 * trong hồ sơ KTV ở labentry.staff.v1 nên đi theo sao lưu như PIN băm).
 * Vẽ trực tiếp trên khung vẽ hoặc tải ảnh; khi in, ô ký nào gắn với KTV
 * này (ở cấu hình bản in) sẽ hiện ảnh chữ ký trong khoảng ký tên. */
let sigTarget = '';
let sigDrawn = false;
let sigStroke = null;
function sigStaff() { return staffList.find((x) => x.name === sigTarget) || null; }
function clearSigPad() {
  const c = $('sig-pad');
  const g = c && c.getContext ? c.getContext('2d') : null;
  if (g) g.clearRect(0, 0, c.width, c.height);
  sigDrawn = false;
  sigStroke = null;
}
function sigDrawImage(img) {
  const c = $('sig-pad');
  const g = c && c.getContext ? c.getContext('2d') : null;
  if (!g) return;
  g.clearRect(0, 0, c.width, c.height);
  const sc = Math.min(c.width / img.width, c.height / img.height);
  const w = img.width * sc;
  const h = img.height * sc;
  g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
  sigDrawn = true;
}
function openSigDialog(name) {
  sigTarget = name;
  const st = staffList.find((x) => x.name === name);
  $('sig-title').textContent = 'Chữ ký của ' + name;
  $('btn-sig-remove').classList.toggle('hidden', !(st && st.sig));
  clearSigPad();
  $('sig-modal').classList.remove('hidden');
  if (st && st.sig) {
    const img = new Image();
    img.onload = () => sigDrawImage(img);
    img.src = st.sig;
  }
}
function closeSigDialog() { $('sig-modal').classList.add('hidden'); sigTarget = ''; sigStroke = null; }
function sigPadPos(e) {
  const c = $('sig-pad');
  const r = c.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
}
function initSigPad() {
  const pad = $('sig-pad');
  if (!pad) return;
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    sigStroke = sigPadPos(e);
    const g = pad.getContext('2d');
    g.fillStyle = '#1a237e';
    g.beginPath();
    g.arc(sigStroke.x, sigStroke.y, 1.7, 0, 7);
    g.fill();
    sigDrawn = true;
  });
  pad.addEventListener('pointermove', (e) => {
    if (!sigStroke) return;
    const p = sigPadPos(e);
    const g = pad.getContext('2d');
    g.strokeStyle = '#1a237e';
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(sigStroke.x, sigStroke.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    sigStroke = p;
  });
  ['pointerup', 'pointercancel'].forEach((ev) => pad.addEventListener(ev, () => { sigStroke = null; }));
}
function sigPadExport() {
  const c = $('sig-pad');
  const g = c.getContext('2d');
  let data;
  try { data = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return ''; }
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return '';
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(c.width - 1, maxX + pad);
  maxY = Math.min(c.height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement('canvas');
  const scale = Math.min(1, 360 / w);
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  out.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}
function saveSigFromDialog() {
  const st = sigStaff();
  if (!st) { closeSigDialog(); return; }
  const url = sigDrawn ? sigPadExport() : '';
  if (!url) { toast('Chưa có chữ ký — hãy vẽ trong khung hoặc tải ảnh lên trước'); return; }
  st.sig = url;
  persistStaff();
  audit('staff-sig', 'Cập nhật chữ ký cho KTV ' + st.name, null);
  closeSigDialog();
  renderStaffList();
  if (typeof fillPrintCfgControls === 'function') fillPrintCfgControls();
  toast('Đã lưu chữ ký cho ' + st.name);
}
function removeSigFromDialog() {
  const st = sigStaff();
  if (!st) { closeSigDialog(); return; }
  st.sig = '';
  persistStaff();
  audit('staff-sig', 'Xóa chữ ký của KTV ' + st.name, null);
  closeSigDialog();
  renderStaffList();
  if (typeof fillPrintCfgControls === 'function') fillPrintCfgControls();
  toast('Đã xóa chữ ký của ' + st.name);
}
function sigFileToPad(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { sigDrawImage(img); URL.revokeObjectURL(url); };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Không đọc được file ảnh này'); };
  img.src = url;
}

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
  audit('staff-add', 'Thêm KTV: ' + name, null); /* chỉ ghi sự kiện tạo — PIN không ghi log (F22) */
}

function deleteStaff(name) {
  const wasOperator = currentOperator === name;
  staffList = staffList.filter((n) => n.name !== name);
  persistStaff();
  if (wasOperator) setOperator('');
  renderStaffList();
  renderOperatorControls();
  audit('staff-del', 'Xóa KTV: ' + name + (wasOperator ? ' (đang là người trực — đã bỏ chọn trực)' : ''), null);
}

/* ================= Nhật ký kiểm toán + cổng KTV trực (F22, v41) =================
   Từ v41: chưa chọn KTV trực thì KHÔNG nhận mẫu, KHÔNG lưu form kết quả,
   KHÔNG phát hành/hủy phát hành, KHÔNG xóa kết quả (requireOperator).
   Mọi thao tác quan trọng được ghi vào nhật ký (khóa labentry.audit.v1, giữ
   tối đa AUDIT_CAP dòng gần nhất). Nhật ký đi kèm file sao lưu: phục hồi thì
   thay bằng nhật ký trong file, gộp thì hợp nhất theo mã dòng.
   MÃ PIN KHÔNG BAO GIỜ ĐƯỢC GHI LOG: nhập PIN đúng/sai, đặt/đổi PIN đều
   không tạo dòng nào; thêm KTV chỉ ghi sự kiện tạo, không ghi PIN. */
const AUDIT_KEY = 'labentry.audit.v1';
const AUDIT_CAP = 2000;
const AUDIT_LABELS = {
  receive: 'Nhận mẫu', save: 'Nhập/sửa kết quả', release: 'Phát hành', unrelease: 'Hủy phát hành',
  delete: 'Xóa mẫu', 'staff-add': 'Thêm KTV', 'staff-del': 'Xóa KTV', 'staff-sig': 'Chữ ký KTV', operator: 'Đổi người trực',
  defer: 'Hẹn lại mẫu', undefer: 'Bỏ hẹn lại',
  restore: 'Phục hồi dữ liệu', merge: 'Gộp dữ liệu',
};
let auditLog = [];

function sanitizeAuditLog(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach((e) => {
    if (!e || typeof e !== 'object') return;
    if (typeof e.id !== 'string' || !e.id) return;
    if (typeof e.at !== 'string' || isNaN(Date.parse(e.at))) return;
    if (typeof e.action !== 'string' || !e.action) return;
    out.push({
      id: e.id, at: e.at, action: e.action,
      actor: typeof e.actor === 'string' ? e.actor : '',
      testId: typeof e.testId === 'string' ? e.testId : '',
      typeId: typeof e.typeId === 'string' ? e.typeId : '',
      detail: typeof e.detail === 'string' ? e.detail : '',
    });
  });
  return out.slice(-AUDIT_CAP);
}

function loadAuditLog() {
  try { auditLog = sanitizeAuditLog(JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]')); }
  catch (e) { auditLog = []; }
}

function saveAuditLog() {
  try { localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLog)); } catch (e) { /* đầy bộ nhớ: bỏ qua */ }
}

function audit(action, detail, rec) {
  auditLog.push({
    id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36),
    at: new Date().toISOString(),
    actor: currentOperator || '',
    action,
    testId: rec ? (rec.testId || '') : '',
    typeId: rec ? (rec.typeId || '') : '',
    detail: detail || '',
  });
  if (auditLog.length > AUDIT_CAP) auditLog = auditLog.slice(auditLog.length - AUDIT_CAP);
  saveAuditLog();
}

/* Cổng thao tác: chưa có KTV trực thì chặn + báo rõ, trả về false */
function requireOperator(what) {
  if (currentOperator) return true;
  toast('Chưa chọn KTV trực — không thể ' + what + '. Hãy chọn người trực trước.');
  return false;
}

/* Tóm tắt nội dung một bản ghi sắp bị xóa (giá trị THẬT, không dùng quy ước
   hiển thị "Âm tính" của resultSummary để nhật ký không sai lệch) */
function deleteDetailOf(rec) {
  const type = getTestType(rec.typeId);
  const res = type
    ? type.fields.map((f) => f.label + ': ' + (((rec.results || {})[f.key]) || '(trống)')).join('; ')
    : '';
  return 'Trạng thái khi xóa: ' + (STATUS_LABELS[store.statusOf(rec)] || '') + (res ? ' · Kết quả: ' + res : '');
}

function renderAuditLog() {
  const fEl = $('audit-filter');
  const qEl = $('audit-search');
  if (!fEl || !qEl) return;
  const f = fEl.value;
  const q = qEl.value.trim().toLowerCase();
  const rows = auditLog.filter((e) =>
    (!f || e.action === f) &&
    (!q || (e.testId || '').toLowerCase().includes(q) || (e.actor || '').toLowerCase().includes(q) || (e.detail || '').toLowerCase().includes(q))
  ).slice().reverse();
  const MAX = 300;
  $('audit-count').textContent = 'Có ' + rows.length + ' dòng khớp' +
    (rows.length > MAX ? ' — hiện ' + MAX + ' dòng gần nhất' : '') +
    ' · Toàn bộ nhật ký: ' + auditLog.length + '/' + AUDIT_CAP + ' dòng';
  $('audit-list').innerHTML = rows.slice(0, MAX).map((e) =>
    '<div class="audit-row">' +
    '<div class="audit-head"><span class="audit-time">' + esc(fmtFull(e.at)) + '</span>' +
    '<span class="audit-action">' + esc(AUDIT_LABELS[e.action] || e.action) + '</span>' +
    (e.testId ? '<span class="audit-id">' + esc(e.testId) + '</span>' : '') + '</div>' +
    '<div class="audit-meta">Người trực: ' + (e.actor ? '<b>' + esc(e.actor) + '</b>' : '(chưa chọn)') +
    (e.typeId ? ' · ' + esc((getTestType(e.typeId) || {}).name || e.typeId) : '') + '</div>' +
    (e.detail ? '<div class="audit-detail">' + esc(e.detail) + '</div>' : '') +
    '</div>').join('');
  $('audit-empty').classList.toggle('hidden', rows.length > 0);
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

/* ================= Gói cải tiến ca trực (F24, v43) =================
 * Sáu tính năng theo yêu cầu của Minh (2026-11-06):
 * 1) Nhắc sao lưu: nhớ lần xuất file sao lưu gần nhất (khóa labentry.meta.v1);
 *    chưa từng sao lưu hoặc đã quá 3 ngày mà máy đang có dữ liệu thì hiện
 *    thanh nhắc vàng trên đầu app — "Sao lưu ngay" xuất luôn file, "Để mai
 *    nhắc lại" ẩn tới hết hôm nay. Thẻ sao lưu ở tab Xuất hiện lần sao lưu gần nhất.
 * 3) Bàn giao ca: trang riêng gom TOÀN BỘ mẫu chưa xong (chưa kết quả + chờ
 *    phát hành, kể cả tồn từ ngày trước), kèm ô nội dung dạng chữ để sao chép
 *    gửi ca sau và nút in danh sách bàn giao.
 * 4) Mẫu khẩn (STAT): cờ `urgent` trên bản ghi — nhãn KHẨN + nền/viền đỏ ở
 *    danh sách, dấu 🔴 ở cột ID trên bản in; đổi cờ được ghi vào nhật ký như
 *    một thay đổi của form. (Từ v50: khẩn KHÔNG còn xếp đầu danh sách/banner —
 *    mọi danh sách theo thứ tự tiếp nhận, cờ chỉ còn tác dụng hiển thị.)
 * 5) Tự khóa KTV trực: sau N phút không thao tác (chọn ở thanh KTV trực:
 *    Tắt/5/10/15/30, mặc định 10) app tự bỏ chọn người trực và ghi nhật ký
 *    'operator'. Đang mở hộp thoại (quét/xem/PIN/KTV) thì không khóa giữa chừng;
 *    quét camera thành công cũng tính là đang thao tác.
 * 6) Đọc to mã mẫu khi tới giờ: công tắc ở thanh KTV trực (mặc định tắt);
 *    mẫu vừa tới giờ được đọc bằng giọng nói của thiết bị (vi-VN), mỗi đợt
 *    hẹn giờ chỉ đọc một lần. Thiết bị không có giọng tiếng Việt thì đọc
 *    bằng giọng mặc định — vẫn nghe được mã mẫu.
 * 7) Quét tìm mẫu: nút quét ở tab Quản lý mở màn hình quét ở chế độ tìm —
 *    khớp đúng mã thì đóng quét và mở ngay mẫu (có kết quả thì mở trang Xem,
 *    chưa có thì mở form nhập); không thấy thì báo ngay tại màn hình quét.
 * (Mục 2 trong danh sách đề xuất ban đầu — hoãn báo động — Minh không chọn.) */
const META_KEY = 'labentry.meta.v1';
let appMeta = { lastBackupAt: null, autoLockMin: 10, speakDue: false, backupNagUntil: '', deferDay: '' };

function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    if (m && typeof m === 'object') {
      if (typeof m.lastBackupAt === 'string' && !isNaN(Date.parse(m.lastBackupAt))) appMeta.lastBackupAt = m.lastBackupAt;
      if ([0, 5, 10, 15, 30].indexOf(m.autoLockMin) >= 0) appMeta.autoLockMin = m.autoLockMin;
      appMeta.speakDue = m.speakDue === true;
      if (typeof m.backupNagUntil === 'string') appMeta.backupNagUntil = m.backupNagUntil;
      if (typeof m.deferDay === 'string') appMeta.deferDay = m.deferDay; /* F37: ngày linh vật đã báo cáo mẫu hẹn lại */
    }
  } catch (e) { /* cấu hình hỏng -> dùng mặc định */ }
}

function saveMeta() {
  try { localStorage.setItem(META_KEY, JSON.stringify(appMeta)); } catch (e) { /* bỏ qua */ }
}

/* ---- 1) Nhắc sao lưu ---- */
function backupNagMessage() {
  if (!store.getAll().length) return '';
  if (appMeta.backupNagUntil && appMeta.backupNagUntil >= todayKey()) return '';
  if (!appMeta.lastBackupAt) return 'Chưa từng sao lưu dữ liệu trên máy này';
  const days = Math.floor((Date.now() - new Date(appMeta.lastBackupAt).getTime()) / 86400000);
  return days >= 3 ? 'Đã ' + days + ' ngày chưa sao lưu dữ liệu' : '';
}

let lastNagRendered = null;
function renderBackupNag() {
  const msg = backupNagMessage();
  renderBackupLast();
  if (msg === lastNagRendered) return;
  lastNagRendered = msg;
  const b = $('backup-banner');
  if (!b) return;
  if (!msg) { b.classList.add('hidden'); return; }
  $('backup-banner-text').textContent = '⚠ ' + msg + ' — dữ liệu chỉ lưu trên máy này, mất là không khôi phục được.';
  b.classList.remove('hidden');
}

function renderBackupLast() {
  const el = $('backup-last');
  if (!el) return;
  el.textContent = appMeta.lastBackupAt
    ? 'Sao lưu gần nhất trên máy này: ' + fmtFull(appMeta.lastBackupAt)
    : 'Máy này chưa từng xuất file sao lưu.';
}

/* ---- 5) Tự khóa KTV trực ---- */
let lastActivityAt = Date.now();
function noteActivity() { lastActivityAt = Date.now(); }

function anyModalOpen() {
  return !!document.querySelector('.modal:not(.hidden)');
}

function checkAutoLock(now) {
  if (!currentOperator || !appMeta.autoLockMin) return;
  if (scannerState || anyModalOpen()) return; /* đang quét/xem/nhập PIN thì không khóa giữa chừng */
  if (now - lastActivityAt < appMeta.autoLockMin * 60000) return;
  const name = currentOperator;
  audit('operator', 'Tự khóa người trực sau ' + appMeta.autoLockMin + ' phút không thao tác (' + name + ')', null);
  setOperator('');
  toast('Đã tự khóa KTV trực do không thao tác — hãy chọn lại người trực để tiếp tục');
}

/* ---- 6) Đọc to mã mẫu khi tới giờ ---- */
function speakDue(recs) {
  try {
    if (!appMeta.speakDue || !recs.length) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') return;
    const fresh = recs.filter((r) => !spokenDue.has(r.uid + '|' + r.timerEndsAt));
    if (!fresh.length) return;
    fresh.forEach((r) => spokenDue.add(r.uid + '|' + r.timerEndsAt));
    const text = fresh.length === 1
      ? 'Mẫu ' + fresh[0].testId + ' tới giờ nhập kết quả'
      : 'Có ' + fresh.length + ' mẫu tới giờ nhập kết quả: ' + fresh.map((r) => r.testId).join(', ');
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'vi-VN';
    window.speechSynthesis.speak(u);
  } catch (e) { /* thiết bị không đọc được: bỏ qua */ }
}

/* ---- 3) Bàn giao ca ---- */
function handoverRecords() {
  const all = store.getAll();
  /* Thứ tự tiếp nhận (v50): nhận trước lên đầu cả hai nhóm; khẩn không nhảy đầu */
  const byIntake = (a, b) => (a.createdAt < b.createdAt ? -1 : 1);
  return {
    /* F37: mẫu hẹn lại bàn giao ở trang riêng, không lẫn vào bàn giao ca chính */
    noresult: all.filter((r) => !isDeferred(r) && store.statusOf(r) === 'no-result').sort(byIntake),
    pending: all.filter((r) => !isDeferred(r) && store.statusOf(r) === 'pending-release').sort(byIntake),
  };
}

function handoverLine(r) {
  const type = getTestType(r.typeId);
  return (r.urgent ? '🔴 KHẨN · ' : '') + r.testId + ' — ' + (type ? type.name : r.typeId) +
    ' — nhận ' + fmtList(r.createdAt) + ' — đã chờ ' + fmtWait(r.createdAt) +
    (r.receiver ? ' — KTV nhận: ' + r.receiver : '');
}

function buildHandoverText() {
  const h = handoverRecords();
  const lines = [
    'BÀN GIAO CA — LabEntry',
    'Lập lúc: ' + fmtFull(new Date().toISOString()),
    'KTV trực: ' + (currentOperator || '(chưa chọn)'),
    'Tổng số mẫu chưa xong: ' + (h.noresult.length + h.pending.length),
    '',
    'CHƯA KẾT QUẢ (' + h.noresult.length + '):',
  ];
  h.noresult.forEach((r, i) => lines.push((i + 1) + '. ' + handoverLine(r)));
  if (!h.noresult.length) lines.push('(không có)');
  lines.push('', 'CHỜ PHÁT HÀNH (' + h.pending.length + '):');
  h.pending.forEach((r, i) => lines.push((i + 1) + '. ' + handoverLine(r)));
  if (!h.pending.length) lines.push('(không có)');
  return lines.join('\n');
}

function renderHandover() {
  const h = handoverRecords();
  $('handover-counts').textContent = 'Chưa kết quả: ' + h.noresult.length + ' · Chờ phát hành: ' + h.pending.length + ' · Tổng bàn giao: ' + (h.noresult.length + h.pending.length);
  const rowHtml = (r) => {
    const status = store.statusOf(r);
    return '<li class="record-item' + (r.urgent ? ' urgent' : '') + '"><div class="record-main">' +
      '<div class="record-id">' + esc(r.testId) + (r.urgent ? '<span class="urgent-tag">KHẨN</span>' : '') + '</div>' +
      '<div class="record-type">' + esc((getTestType(r.typeId) || {}).name || r.typeId) + '</div></div>' +
      '<div class="record-side"><span class="record-time">' + esc(fmtList(r.createdAt)) + '</span>' +
      '<span class="status-tag ' + status + '">' + STATUS_LABEL[status] + '</span>' +
      '<span class="record-time">Đã chờ ' + esc(fmtWait(r.createdAt)) + '</span></div></li>';
  };
  $('handover-list-noresult').innerHTML = h.noresult.map(rowHtml).join('');
  $('handover-list-pending').innerHTML = h.pending.map(rowHtml).join('');
  $('handover-empty-noresult').classList.toggle('hidden', h.noresult.length > 0);
  $('handover-empty-pending').classList.toggle('hidden', h.pending.length > 0);
  $('handover-text').value = buildHandoverText();
}

async function copyHandover() {
  const text = $('handover-text').value;
  try {
    await navigator.clipboard.writeText(text);
    toast('Đã sao chép danh sách bàn giao');
    return;
  } catch (e) { /* clipboard không sẵn (ngữ cảnh không an toàn): dùng đường dự phòng */ }
  $('handover-text').select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
  toast(ok ? 'Đã sao chép danh sách bàn giao' : 'Hãy bôi đen nội dung và sao chép thủ công');
}

function printHandover() {
  const h = handoverRecords();
  const rows = h.noresult.concat(h.pending).map((r, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + esc(r.testId) + (r.urgent ? ' (KHẨN)' : '') + '</td><td>' +
    esc((getTestType(r.typeId) || {}).name || r.typeId) + '</td><td>' + STATUS_LABEL[store.statusOf(r)] + '</td><td>' +
    esc(fmtList(r.createdAt)) + '</td><td>' + esc(fmtWait(r.createdAt)) + '</td></tr>').join('');
  const pa = $('print-area');
  pa.innerHTML = '<div class="ho-sheet"><h1>DANH SÁCH BÀN GIAO CA</h1>' +
    '<p>Lập lúc: ' + esc(fmtFull(new Date().toISOString())) + ' · KTV trực: ' + esc(currentOperator || '(chưa chọn)') +
    ' · Tổng số mẫu chưa xong: ' + (h.noresult.length + h.pending.length) + '</p>' +
    '<table><thead><tr><th>STT</th><th>ID Xét Nghiệm</th><th>Loại xét nghiệm</th><th>Trạng thái</th><th>Nhận lúc</th><th>Đã chờ</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
  /* Đánh dấu #print-area đang giữ tờ bàn giao và GIỮ NGUYÊN như vậy cho tới
     lần dựng tờ kế tiếp (F30): adapter in của Android dựng trang in bất đồng
     bộ, có thể nhiều lượt (mở hộp thoại, đổi khổ giấy...) — cơ chế cũ khôi
     phục nội dung cũ theo afterprint + cờ hẹn giờ 3 giây khiến một lượt dựng
     muộn đọc phải tờ kết quả -> in bàn giao ra danh sách kết quả (Minh gặp
     trên APK 2026-11-08). Giờ beforeprint chỉ dựng lại tờ kết quả khi
     printAreaKind đang là 'results'; trên trình duyệt, afterprint dựng lại
     tờ kết quả sau khi in bàn giao xong (xem listener ở phần khởi tạo). */
  printAreaKind = 'handover';
  printSheet();
}

/* ================= Hẹn lại mẫu: hộp thoại + trang riêng (F37) ================= */
let deferUid = null;
function openDeferModal(uid) {
  const rec = store.getByUid(uid);
  if (!rec) return;
  if (!requireOperator('đánh dấu hẹn lại')) return;
  deferUid = uid;
  $('defer-title').textContent = 'Hẹn lại mẫu ' + rec.testId;
  const cur = rec.deferReason || 'hut-mau';
  document.querySelectorAll('input[name="defer-reason"]').forEach((el) => { el.checked = el.value === cur; });
  $('defer-note').value = rec.deferNote || '';
  $('btn-defer-clear').classList.toggle('hidden', !isDeferred(rec));
  closeSummary();
  $('defer-modal').classList.remove('hidden');
}
function closeDeferModal() { $('defer-modal').classList.add('hidden'); deferUid = null; }
function saveDefer() {
  if (!deferUid) return;
  const rec = store.getByUid(deferUid);
  if (!rec) { closeDeferModal(); return; }
  const sel = document.querySelector('input[name="defer-reason"]:checked');
  const reason = sel ? sel.value : 'hut-mau';
  const note = $('defer-note').value.trim();
  /* Hẹn lại thì tắt luôn đồng hồ đếm ngược: mẫu không còn "tới giờ nhập
     kết quả" nữa, chuông native trên điện thoại cũng được gỡ (sync bên dưới) */
  const res = store.update(deferUid, { deferReason: reason, deferNote: note, deferAt: new Date().toISOString(), timerEndsAt: null });
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  audit('defer', DEFER_REASONS[reason] + (note ? ' — ' + note : ''), res.record);
  syncNativeAlarms();
  closeDeferModal();
  toast('Đã hẹn lại mẫu ' + rec.testId + ' — ' + DEFER_REASONS[reason]);
  refreshCurrent();
  updateMascot();
}
function clearDefer(uid) {
  const rec = store.getByUid(uid);
  if (!rec) return;
  if (!requireOperator('bỏ hẹn lại')) return;
  const res = store.update(uid, { deferReason: '', deferNote: '', deferAt: null });
  if (!res.ok) { toast(res.errors.join('. ')); return; }
  audit('undefer', '', res.record);
  closeDeferModal();
  toast('Đã bỏ hẹn lại mẫu ' + rec.testId + ' — mẫu quay lại danh sách chờ');
  refreshCurrent();
  updateMascot();
}

let deferredFilter = 'all'; /* 'today' | 'past' | 'all' */
const deferredSel = new Set();
function deferredFiltered() {
  const all = deferredRecords();
  const tk = todayKey();
  if (deferredFilter === 'today') return all.filter((r) => LabStore.localDayKey(new Date(r.createdAt)) === tk);
  if (deferredFilter === 'past') return all.filter((r) => LabStore.localDayKey(new Date(r.createdAt)) < tk);
  return all;
}
function deferredHandoverSet() {
  const list = deferredFiltered();
  const picked = list.filter((r) => deferredSel.has(r.uid));
  return picked.length ? picked : list;
}
function deferredLine(r) {
  const type = getTestType(r.typeId);
  return r.testId + ' — ' + (type ? type.name : r.typeId) +
    ' — Lý do: ' + deferReasonLabel(r) + (r.deferNote ? ' (' + r.deferNote + ')' : '') +
    ' — Nhận: ' + fmtList(r.createdAt) +
    ' — Trạng thái gốc: ' + STATUS_LABEL[store.statusOf(r)];
}
function buildDeferredText(recs) {
  const lines = [
    'BÀN GIAO MẪU HẸN LẠI — LabEntry',
    'Lập lúc: ' + fmtFull(new Date().toISOString()),
    'KTV trực: ' + (currentOperator || '(chưa chọn)'),
    'Số mẫu bàn giao: ' + recs.length,
    '',
  ];
  recs.forEach((r, i) => lines.push((i + 1) + '. ' + deferredLine(r)));
  if (!recs.length) lines.push('(không có mẫu nào)');
  return lines.join('\n');
}
function renderDeferred() {
  const all = deferredRecords();
  const alive = new Set(all.map((r) => r.uid));
  Array.from(deferredSel).forEach((u) => { if (!alive.has(u)) deferredSel.delete(u); });
  const list = deferredFiltered();
  $('deferred-counts').textContent = 'Đang hẹn lại: ' + all.length + ' mẫu · Đang hiển thị: ' + list.length + ' mẫu';
  document.querySelectorAll('[data-defer-filter]').forEach((b) => b.classList.toggle('active', b.dataset.deferFilter === deferredFilter));
  $('deferred-list').innerHTML = list.map((r) => {
    const type = getTestType(r.typeId);
    const status = store.statusOf(r);
    return '<li class="record-item deferred">' +
      '<input type="checkbox" data-defsel="' + r.uid + '"' + (deferredSel.has(r.uid) ? ' checked' : '') + '>' +
      '<div class="record-main"><div class="record-id">' + esc(r.testId) + deferTagHTML(r) + '</div>' +
      '<div class="record-type">' + esc(type ? type.name : r.typeId) + (r.deferNote ? ' · ' + esc(r.deferNote) : '') + '</div></div>' +
      '<div class="record-side"><span class="record-time">Nhận ' + esc(fmtList(r.createdAt)) + '</span>' +
      '<span class="status-tag ' + status + '">' + STATUS_LABEL[status] + '</span>' +
      '<div class="record-actions">' +
      '<button class="view-btn" data-daction="view" data-uid="' + r.uid + '">Xem</button>' +
      '<button class="view-btn" data-daction="edit" data-uid="' + r.uid + '">Nhập KQ</button>' +
      '<button class="view-btn" data-daction="undefer" data-uid="' + r.uid + '">Bỏ hẹn</button>' +
      '</div></div></li>';
  }).join('');
  $('deferred-empty').classList.toggle('hidden', list.length > 0);
  $('deferred-text').value = buildDeferredText(deferredHandoverSet());
}
async function copyDeferred() {
  const text = $('deferred-text').value;
  try {
    await navigator.clipboard.writeText(text);
    toast('Đã sao chép danh sách bàn giao mẫu hẹn lại');
    return;
  } catch (e) { /* clipboard không sẵn: dùng đường dự phòng */ }
  $('deferred-text').select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
  toast(ok ? 'Đã sao chép danh sách bàn giao mẫu hẹn lại' : 'Hãy bôi đen nội dung và sao chép thủ công');
}
function printDeferredHandover() {
  const recs = deferredHandoverSet();
  if (!recs.length) { toast('Chưa có mẫu hẹn lại nào để in'); return; }
  const rows = recs.map((r, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + esc(r.testId) + '</td><td>' +
    esc((getTestType(r.typeId) || {}).name || r.typeId) + '</td><td>' +
    esc(deferReasonLabel(r) + (r.deferNote ? ' — ' + r.deferNote : '')) + '</td><td>' +
    STATUS_LABEL[store.statusOf(r)] + '</td><td>' + esc(fmtList(r.createdAt)) + '</td></tr>').join('');
  const pa = $('print-area');
  pa.innerHTML = '<div class="ho-sheet"><h1>DANH SÁCH BÀN GIAO MẪU HẸN LẠI</h1>' +
    '<p>Lập lúc: ' + esc(fmtFull(new Date().toISOString())) + ' · KTV trực: ' + esc(currentOperator || '(chưa chọn)') +
    ' · Số mẫu: ' + recs.length + '</p>' +
    '<table><thead><tr><th>STT</th><th>ID Xét Nghiệm</th><th>Loại xét nghiệm</th><th>Lý do hẹn lại</th><th>Trạng thái gốc</th><th>Nhận lúc</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
  printAreaKind = 'handover'; /* giữ nguyên cơ chế F30 của tờ bàn giao ca */
  printSheet();
}

function defaultPrintSettings() {
  return {
    logo: '', logoPos: 'auto', logoSize: 'm',
    org: '', dept: '', address: '', phone: '', email: '',
    headerLayout: 'side', divider: true,
    rightZone: 'none', docBoxStyle: 'box', docBarcode: false, docBarcodeSize: 'm',
    docRows: [
      { on: true, label: 'Mã tài liệu', value: '' },
      { on: true, label: 'Lần ban hành', value: '' },
      { on: true, label: 'Ngày hiệu lực', value: '' },
      { on: false, label: '', value: '' },
      { on: false, label: '', value: '' },
    ],
    logo2: '', logo2Size: 'm',
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
      { on: false, title: 'Người lập bảng', name: '', staff: '', align: 'center' },
      { on: false, title: 'Trưởng khoa', name: '', staff: '', align: 'center' },
      { on: false, title: '', name: '', staff: '', align: 'center' },
    ],
    sigsAlign: 'center', /* legacy v68: chỉ còn dùng để di trú sang align từng ô */
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
  if (!['left', 'center', 'right'].includes(merged.sigsAlign)) merged.sigsAlign = 'center';
  /* Vị trí riêng của ô (v69); file v68 chỉ có sigsAlign toàn cục -> di trú sang
     align của từng ô, trừ khi ô đã có align riêng được lưu từ v69 trở đi */
  const sigsWereSaved = !!(saved && Array.isArray(saved.sigs) && saved.sigs.length === 3);
  const migAlign = ['left', 'right'].includes(merged.sigsAlign) ? merged.sigsAlign : null;
  merged.sigs = merged.sigs.map((g, i) => ({
    on: !!(g && g.on),
    title: g && typeof g.title === 'string' ? g.title : (def.sigs[i] ? def.sigs[i].title : ''),
    name: g && typeof g.name === 'string' ? g.name : '',
    staff: g && typeof g.staff === 'string' ? g.staff : '',
    align: (g && ['left', 'center', 'right'].includes(g.align) && (sigsWereSaved || !migAlign))
      ? g.align
      : (migAlign || (g && ['left', 'center', 'right'].includes(g.align) ? g.align : 'center')),
  }));
  if (!['left', 'center', 'right', 'auto'].includes(merged.logoPos)) merged.logoPos = 'auto';
  if (!['side', 'center', 'grid3'].includes(merged.headerLayout)) merged.headerLayout = 'side';
  if (!['none', 'doc', 'image'].includes(merged.rightZone)) merged.rightZone = 'none';
  if (!['box', 'plain'].includes(merged.docBoxStyle)) merged.docBoxStyle = 'box';
  merged.docBarcode = !!merged.docBarcode;
  if (!['s', 'm'].includes(merged.docBarcodeSize)) merged.docBarcodeSize = 'm';
  if (typeof merged.logo2 !== 'string') merged.logo2 = '';
  if (!['s', 'm', 'l'].includes(merged.logo2Size)) merged.logo2Size = 'm';
  const savedRows = Array.isArray(merged.docRows) ? merged.docRows : [];
  merged.docRows = def.docRows.map((dr, i) => {
    const sr = savedRows[i];
    return sr && typeof sr === 'object'
      ? { on: !!sr.on, label: typeof sr.label === 'string' ? sr.label : dr.label, value: typeof sr.value === 'string' ? sr.value : '' }
      : dr;
  });
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
    case 'testId': return esc((rec.urgent ? '🔴 ' : '') + rec.testId); /* mẫu khẩn có dấu đỏ trên bản in (F24) */
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

/* ---------- Mã vạch Code128 (F21): bộ mã hóa viết tại chỗ, không thư viện ngoài ----------
   Bảng độ rộng vạch chuẩn Code128 (giá trị 0–106; giá trị 106 là mã dừng, 7 số). */
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

/* Chuỗi bit '1' = vạch đen của mã Code128-B cho text (ký tự ngoài ASCII 32–126,
   kể cả tiếng Việt có dấu, được bỏ dấu/loại trước khi mã hóa). '' nếu không còn gì để mã hóa. */
function code128Pattern(text) {
  const clean = String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .split('').filter((c) => { const n = c.charCodeAt(0); return n >= 32 && n <= 126; }).join('');
  if (!clean) return '';
  const values = [104];
  for (const c of clean) values.push(c.charCodeAt(0) - 32);
  let sum = 104;
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103, 106);
  let bits = '';
  values.forEach((v) => {
    let bar = true;
    for (const ch of CODE128_PATTERNS[v]) { bits += (bar ? '1' : '0').repeat(Number(ch)); bar = !bar; }
  });
  const quiet = '0'.repeat(10);
  return quiet + bits + quiet;
}

/* Nội dung mã vạch của khối tài liệu: dòng đang bật có nhãn chứa chữ "Mã" và có nội dung
   (mặc định là Mã tài liệu); không có thì lấy dòng đang bật đầu tiên có nội dung. */
function barcodePayloadOf(s) {
  const rows = Array.isArray(s.docRows) ? s.docRows : [];
  const usable = rows.filter((r) => r && r.on && String(r.value || '').trim());
  if (!usable.length) return '';
  const ma = usable.find((r) => /mã/i.test(String(r.label || '')));
  return String((ma || usable[0]).value).trim();
}

/* Vẽ mọi canvas.sh-barcode trong một vùng (xem trước / vùng in) sau khi dựng HTML */
function drawSheetBarcodes(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('canvas.sh-barcode').forEach((cv) => {
    const bits = code128Pattern(cv.getAttribute('data-text') || '');
    if (!bits) return;
    const small = cv.classList.contains('sz-s');
    const scale = small ? 2 : 3;
    cv.width = bits.length * scale;
    cv.height = small ? 52 : 76;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#000000';
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') ctx.fillRect(i * scale, 0, scale, cv.height);
    }
  });
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
  /* Vùng góc phải (F21): khối thông tin tài liệu / ảnh thứ hai / trống */
  let rightHtml = '';
  if (s.rightZone === 'doc') {
    const rows = (Array.isArray(s.docRows) ? s.docRows : [])
      .filter((r) => r && r.on && (String(r.label || '').trim() || String(r.value || '').trim()));
    let inner = rows.map((r) =>
      '<div class="sh-doc-row">' +
      (String(r.label || '').trim() ? '<span class="sh-doc-label">' + esc(r.label.trim()) + ':</span> ' : '') +
      '<span class="sh-doc-value">' + esc(r.value || '') + '</span></div>').join('');
    if (s.docBarcode) {
      const payload = barcodePayloadOf(s);
      if (payload) {
        inner += '<canvas class="sh-barcode sz-' + s.docBarcodeSize + '" data-text="' + esc(payload) + '"></canvas>' +
          '<div class="sh-barcode-cap">' + esc(payload) + '</div>';
      }
    }
    if (inner) rightHtml = '<div class="sh-docbox' + (s.docBoxStyle === 'plain' ? ' plain' : '') + '">' + inner + '</div>';
  } else if (s.rightZone === 'image' && s.logo2) {
    rightHtml = '<img class="sh-logo sz-' + s.logo2Size + '" src="' + s.logo2 + '" alt="">';
  }
  /* Vị trí logo hiệu dụng: 'auto' = theo kiểu đầu trang (center → ở giữa, còn lại → bên trái) */
  const effLogoPos = s.logoPos === 'auto' ? (s.headerLayout === 'center' ? 'center' : 'left') : s.logoPos;
  let headerHtml = '';
  if (logoHtml || infoHtml || rightHtml) {
    if (s.headerLayout === 'grid3') {
      headerHtml = '<div class="sh-header grid3"><div class="sh-cell sh-left">' + logoHtml + '</div>' +
        '<div class="sh-cell sh-mid"><div class="sh-info">' + infoHtml + '</div></div>' +
        '<div class="sh-cell sh-right">' + rightHtml + '</div></div>';
    } else if (s.headerLayout === 'center' || effLogoPos === 'center') {
      headerHtml = '<div class="sh-header center">' + logoHtml + '<div class="sh-info">' + infoHtml + '</div>' + rightHtml + '</div>';
    } else if (effLogoPos === 'right') {
      headerHtml = '<div class="sh-header side"><div class="sh-info">' + infoHtml + '</div>' + rightHtml + logoHtml + '</div>';
    } else {
      headerHtml = '<div class="sh-header side">' + logoHtml + '<div class="sh-info">' + infoHtml + '</div>' + rightHtml + '</div>';
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
  const sigBlockHtml = (g) => {
    /* F34: ô ký gắn với một KTV có ảnh chữ ký -> in ảnh vào khoảng ký */
    const st = g.staff ? staffList.find((x) => x.name === g.staff) : null;
    const img = st && st.sig ? '<img class="sh-sig-img" src="' + st.sig + '" alt="">' : '';
    return '<div class="sh-sig"><div class="sh-sig-title">' + esc(g.title || '') + '</div>' +
      '<div class="sh-sig-note">(Ký, ghi rõ họ tên)</div><div class="sh-sig-space">' + img + '</div>' +
      '<div class="sh-sig-name">' + esc(g.name || '') + '</div></div>';
  };
  /* v70: xếp các ô vào 3 vùng Trái/Giữa/Phải. Vùng giữa luôn hiện diện (kể cả
     khi rỗng) với lề tự động hai bên, nên ô Trái luôn sát trái và ô Phải luôn
     sát phải bất kể thứ tự khai báo. (v69 dùng lề tự động cho từng ô: khi ô
     Phải đứng trước ô Trái, hai lề chia nhau khoảng trống và cả cụm bị kéo
     vào giữa trang — lỗi Minh gặp 2026-11-09.) Nội dung trong ô (chức danh,
     ghi chú, chữ ký, họ tên) luôn canh giữa theo ô. */
  const sigHtml = sigs.length
    ? '<div class="sh-sigs">' + ['left', 'center', 'right'].map((z) =>
      '<div class="sh-sig-group g-' + z + '">' +
      sigs.filter((g) => (['left', 'center', 'right'].includes(g.align) ? g.align : 'center') === z).map(sigBlockHtml).join('') +
      '</div>').join('') + '</div>'
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
  drawSheetBarcodes($('pcfg-preview')); /* mã vạch khối tài liệu (F21) */
}

/* Hiện/ẩn khối chỉnh sửa của vùng góc phải theo chế độ đang chọn (F21) */
function syncRightZoneBlocks() {
  const v = printSettings.rightZone;
  $('pcfg-doc-block').classList.toggle('hidden', v !== 'doc');
  $('pcfg-logo2-block').classList.toggle('hidden', v !== 'image');
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
  $('pcfg-right-zone').value = s.rightZone;
  $('pcfg-docbox-style').value = s.docBoxStyle;
  $('pcfg-doc-barcode').checked = !!s.docBarcode;
  $('pcfg-doc-barcode-size').value = s.docBarcodeSize;
  s.docRows.forEach((r, i) => {
    $('pcfg-doc' + (i + 1) + '-on').checked = !!r.on;
    $('pcfg-doc' + (i + 1) + '-label').value = r.label || '';
    $('pcfg-doc' + (i + 1) + '-value').value = r.value || '';
  });
  $('pcfg-logo2-thumb').src = s.logo2 || '';
  $('pcfg-logo2-thumb').classList.toggle('hidden', !s.logo2);
  $('btn-pcfg-logo2-remove').classList.toggle('hidden', !s.logo2);
  $('pcfg-logo2-size').value = s.logo2Size;
  syncRightZoneBlocks();
  renderPresetOptions();
  s.sigs.forEach((g, i) => {
    $('pcfg-sig' + (i + 1) + '-on').checked = !!g.on;
    $('pcfg-sig' + (i + 1) + '-title').value = g.title || '';
    $('pcfg-sig' + (i + 1) + '-name').value = g.name || '';
    const staffSel = $('pcfg-sig' + (i + 1) + '-staff');
    if (staffSel) {
      staffSel.innerHTML = '<option value="">— Không gắn ảnh chữ ký —</option>' +
        staffList.map((st) => '<option value="' + esc(st.name) + '"' + (st.sig ? '' : ' data-nosig="1"') + '>' + esc(st.name) + (st.sig ? ' ✍️' : ' (chưa có chữ ký)') + '</option>').join('');
      staffSel.value = g.staff && staffList.some((st) => st.name === g.staff) ? g.staff : '';
    }
    const alignSel = $('pcfg-sig' + (i + 1) + '-align');
    if (alignSel) alignSel.value = ['left', 'center', 'right'].includes(g.align) ? g.align : 'center';
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

/* Nén ảnh (logo / ảnh thứ hai) về tối đa 360px rồi lưu dạng data URL (PNG; quá lớn thì JPEG) */
function handleImageFile(file, key, doneMsg) {
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
    printSettings[key] = data;
    savePrintSettings();
    fillPrintCfgControls();
    renderPrintPreview();
    toast(doneMsg);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Không đọc được ảnh đã chọn'); };
  img.src = url;
}
function handleLogoFile(file) { handleImageFile(file, 'logo', 'Đã đặt logo cho bản in'); }
function handleLogo2File(file) { handleImageFile(file, 'logo2', 'Đã đặt ảnh thứ hai cho bản in'); }

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
    const staffSel = $('pcfg-sig' + (i + 1) + '-staff');
    if (staffSel) staffSel.addEventListener('change', (e) => {
      g.staff = e.target.value;
      if (g.staff) { g.name = g.staff; $('pcfg-sig' + (i + 1) + '-name').value = g.name; }
      upd();
    });
    const alignSel = $('pcfg-sig' + (i + 1) + '-align');
    if (alignSel) alignSel.addEventListener('change', (e) => { g.align = e.target.value; upd(); });
  });
  $('btn-pcfg-logo').addEventListener('click', () => $('pcfg-logo-file').click());
  $('pcfg-logo-file').addEventListener('change', (e) => { handleLogoFile(e.target.files && e.target.files[0]); e.target.value = ''; });
  $('btn-pcfg-logo-remove').addEventListener('click', () => {
    printSettings.logo = '';
    savePrintSettings(); fillPrintCfgControls(); renderPrintPreview();
  });
  /* Vùng góc phải (F21): chế độ vùng, khối tài liệu, mã vạch, ảnh thứ hai */
  $('pcfg-right-zone').addEventListener('change', () => {
    printSettings.rightZone = $('pcfg-right-zone').value;
    syncRightZoneBlocks(); upd();
  });
  sel('pcfg-docbox-style', 'docBoxStyle'); chk('pcfg-doc-barcode', 'docBarcode'); sel('pcfg-doc-barcode-size', 'docBarcodeSize');
  for (let di = 0; di < 5; di++) {
    const dn = di + 1;
    $('pcfg-doc' + dn + '-on').addEventListener('change', (e) => { printSettings.docRows[di].on = e.target.checked; upd(); });
    $('pcfg-doc' + dn + '-label').addEventListener('input', (e) => { printSettings.docRows[di].label = e.target.value; upd(); });
    $('pcfg-doc' + dn + '-value').addEventListener('input', (e) => { printSettings.docRows[di].value = e.target.value; upd(); });
  }
  sel('pcfg-logo2-size', 'logo2Size');
  $('btn-pcfg-logo2').addEventListener('click', () => $('pcfg-logo2-file').click());
  $('pcfg-logo2-file').addEventListener('change', (e) => { handleLogo2File(e.target.files && e.target.files[0]); e.target.value = ''; });
  $('btn-pcfg-logo2-remove').addEventListener('click', () => {
    printSettings.logo2 = '';
    savePrintSettings(); fillPrintCfgControls(); renderPrintPreview();
  });
  $('btn-pcfg-reset').addEventListener('click', () => {
    if (!confirm('Khôi phục bố cục bản in về mặc định ban đầu? Mọi tùy chỉnh (logo, cột, chữ ký...) sẽ bị xóa.')) return;
    printSettings = defaultPrintSettings();
    savePrintSettings(); fillPrintCfgControls(); renderPrintPreview(); updatePrintPageStyle();
    toast('Đã khôi phục bố cục bản in mặc định');
  });
  $('btn-pcfg-print').addEventListener('click', () => { applyExport(); printSheet(); });
  $('btn-pcfg-back').addEventListener('click', () => switchView('export'));
  $('btn-printcfg').addEventListener('click', openPrintCfg);
}

/* ================= Khởi tạo ================= */
/* ================= F31: Linh vật đồng ca =================
   Bé kính hiển vi nổi ở góc phải dưới 3 tab chính, nhắc theo tình hình ca.
   Thuần trang trí: chỉ ĐỌC store.getAll(), không sửa dữ liệu; trạng thái
   tính lại mỗi giây ở cuối timerTick() (bọc try/catch) và khi đổi cài đặt.
   Cài đặt lưu ở khóa riêng labentry.mascot.v1, KHÔNG vào file sao lưu:
   { on: bool, custom: dataURL|null } — ảnh riêng chỉ nằm trên máy này. */
const MASCOT_KEY = 'labentry.mascot.v1';
const MASCOT_IMG_FOR = { calm: 'calm', waiting: 'waiting', hurried: 'hurried', overdue: 'hurried', overload: 'worried', unreleased: 'worried', deferred: 'waiting' };
let mascotSettings = loadMascotSettings();
let mascotSig = '';
/* Vòng đời bong bóng (Minh góp ý 2026-11-08): mỗi tình huống mới hiện khung
   thoại 5 giây rồi tự tắt cho đỡ choáng màn hình; tình huống còn đó thì sau
   60 giây hiện lại 5 giây. Bấm vào linh vật: đang hiện thì tắt ngay, đang
   tắt thì hiện 5 giây. */
const MASCOT_BUBBLE_MS = 5000;
const MASCOT_RESHOW_MS = 180000;
let mascotBubbleKey = '';
let mascotBubbleUntil = 0;
let mascotNextShowAt = 0;

function loadMascotSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(MASCOT_KEY) || 'null');
    if (v && typeof v === 'object') return { on: v.on !== false, custom: typeof v.custom === 'string' && v.custom ? v.custom : null };
  } catch (e) { /* cài đặt hỏng -> mặc định */ }
  return { on: true, custom: null };
}

function saveMascotSettings() {
  try { localStorage.setItem(MASCOT_KEY, JSON.stringify(mascotSettings)); return true; }
  catch (e) { return false; }
}

function mascotRemainText(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m < 60) return 'còn ' + m + ' phút';
  const h = Math.floor(m / 60); const r = m % 60;
  return 'còn ' + h + ' giờ' + (r ? ' ' + r + ' phút' : '');
}

/* Trạng thái suy ra từ các mẫu CHƯA CÓ KẾT QUẢ — thứ tự ưu tiên:
   quá giờ > sắp tới giờ (≤5') > quá tải (≥3 mẫu chờ >15') > đang chờ > ca êm */
function computeMascotState(now) {
  /* F37: mẫu hẹn lại KHÔNG nằm trong bất kỳ nhóm nhắc việc nào */
  const recs = store.getAll().filter((r) => !isDeferred(r) && store.statusOf(r) === 'no-result');
  const timed = recs.filter((r) => r.timerEndsAt)
    .map((r) => ({ r, at: new Date(r.timerEndsAt).getTime() }))
    .sort((a, b) => a.at - b.at);
  const overdue = timed.filter((t) => t.at <= now);
  if (overdue.length) {
    return { state: 'overdue', key: 'overdue|' + overdue.map((t) => t.r.uid).join(','), badge: String(overdue.length), text: 'Có mẫu quá giờ chưa nhập kết quả: ' + overdue.map((t) => t.r.testId).join(', ') + ' 😟' };
  }
  const next = timed[0];
  if (next && next.at - now <= 5 * 60000) {
    const t = getTestType(next.r.typeId);
    return { state: 'hurried', key: 'hurried|' + next.r.uid, badge: '!', text: '⏰ ' + next.r.testId + ' · ' + ((t && t.name) || next.r.typeId) + ' · ' + mascotRemainText(next.at - now) + ' tới giờ!' };
  }
  /* F36 (v72, theo yêu cầu của Minh): mẫu ĐÃ có kết quả nhưng quá 60 phút
     kể từ lúc nhận mẫu vẫn chưa phát hành -> linh vật nhắc riêng, thắng
     trạng thái quá tải (việc tồn ở khâu phát hành gấp hơn tồn ở khâu nhập). */
  const unrel = store.getAll().filter((r) => !isDeferred(r) && store.statusOf(r) === 'pending-release' && now - new Date(r.createdAt).getTime() > 60 * 60000)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (unrel.length) {
    const ids = unrel.map((r) => r.testId);
    const shown = ids.slice(0, 6).join(', ') + (ids.length > 6 ? '… +' + (ids.length - 6) + ' mẫu nữa' : '');
    return { state: 'unreleased', key: 'unreleased|' + unrel.map((r) => r.uid).join(','), badge: String(unrel.length), text: 'Có mẫu quá 60 phút chưa phát hành: ' + shown + ' 📋' };
  }
  const stale = recs.filter((r) => now - new Date(r.createdAt).getTime() > 15 * 60000)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (stale.length >= 3) {
    return { state: 'overload', key: 'overload|' + stale.map((r) => r.uid).join(','), badge: String(stale.length), text: stale.map((r) => r.testId).join(', ') + ' chờ quá 15 phút chưa nhập kết quả 🥵' };
  }
  if (next) {
    return { state: 'waiting', key: 'waiting|' + next.r.uid, badge: '', text: 'Đang chờ ' + next.r.testId + ' tới giờ… ' + mascotRemainText(next.at - now) + ' ⏳' };
  }
  if (recs.length) {
    return { state: 'waiting', key: 'waiting|n' + recs.length, badge: '', text: 'Còn ' + recs.length + ' mẫu chưa có kết quả — cố lên! 💪' };
  }
  /* F37 (v73, theo yêu cầu của Minh): khi ca đã êm, linh vật báo cáo mẫu
     hẹn lại tồn đọng — kèm ID, lý do và ngày tiếp nhận. Việc "chỉ báo 1 lần
     vào đầu ngày, không lặp lại" nằm ở cơ chế bong bóng trong updateMascot
     (cờ appMeta.deferDay), trạng thái này tự nó vẫn đúng cả ngày. */
  const defs = deferredRecords();
  if (defs.length) {
    const items = defs.slice(0, 4).map((r) => r.testId + ' · ' + deferReasonLabel(r).toLowerCase() + ' · nhận ' + fmtList(r.createdAt).slice(0, 10));
    const more = defs.length > 4 ? '… +' + (defs.length - 4) + ' mẫu nữa' : '';
    return { state: 'deferred', key: 'deferred|' + todayKey() + '|' + defs.map((r) => r.uid).join(','), badge: String(defs.length), text: 'Có mẫu xét nghiệm hẹn lại: ' + items.join('; ') + more + ' ⏸' };
  }
  return { state: 'calm', key: 'calm', badge: '', text: 'Hết mẫu rồi!' };
}

function mascotVisibleHere() {
  if (!mascotSettings.on) return false;
  const mainShown = ['today', 'manage', 'export', 'display'].some((v) => !$('view-' + v).classList.contains('hidden'));
  if (!mainShown) return false;
  if (document.querySelector('.modal:not(.hidden)')) return false;
  return true;
}

function updateMascot() {
  const box = $('mascot');
  if (!box) return;
  if (!mascotVisibleHere()) { box.classList.add('hidden'); mascotSig = ''; return; }
  const now = Date.now();
  const s = computeMascotState(now);
  const stateKey = s.state + '|' + s.text;
  /* v65 (Minh góp ý "đừng lặp lại cùng một câu thường xuyên, giãn ra"):
     khóa bong bóng theo TÌNH HUỐNG (loại + mẫu liên quan), không theo
     nguyên văn câu nói — số phút đếm ngược thay đổi mỗi phút không còn
     tính là tình huống mới để bật lại bong bóng; đồng thời khoảng lặng
     giữa hai lần hiện cùng một câu nới từ 60 giây lên 3 phút (hằng số
     MASCOT_RESHOW_MS). Nội dung hiển thị vẫn cập nhật theo stateKey. */
  const bubbleKey = s.key || stateKey;
  /* F37: báo cáo mẫu hẹn lại chỉ bật bong bóng 1 lần vào đầu ngày (lời của
     Minh: "chỉ báo vào đầu mỗi ngày nếu có") — cờ appMeta.deferDay nhớ ngày
     đã báo; sau lần đầu, trạng thái vẫn giữ nhưng bong bóng không tự bật lại
     trong ngày, kể cả khi danh sách hẹn lại thay đổi. Qua ngày mới, khóa
     bong bóng đổi theo ngày trong key nên báo cáo bật lại bình thường. */
  const isDefReport = s.state === 'deferred';
  if (bubbleKey !== mascotBubbleKey) {
    mascotBubbleKey = bubbleKey;
    if (isDefReport && appMeta.deferDay === todayKey()) {
      mascotBubbleUntil = now;
      mascotNextShowAt = Number.MAX_SAFE_INTEGER;
    } else {
      if (isDefReport) { appMeta.deferDay = todayKey(); saveMeta(); }
      mascotBubbleUntil = now + MASCOT_BUBBLE_MS;
      mascotNextShowAt = mascotBubbleUntil + MASCOT_RESHOW_MS;
    }
  } else if (now >= mascotNextShowAt) {
    if (isDefReport) {
      mascotNextShowAt = Number.MAX_SAFE_INTEGER;
    } else {
      mascotBubbleUntil = now + MASCOT_BUBBLE_MS;
      mascotNextShowAt = mascotBubbleUntil + MASCOT_RESHOW_MS;
    }
  }
  const bubbleShown = now < mascotBubbleUntil;
  const sig = stateKey + '|' + (mascotSettings.custom ? 'custom' : 'def') + '|' + (bubbleShown ? 'b1' : 'b0');
  box.classList.remove('hidden');
  if (sig === mascotSig) return;
  mascotSig = sig;
  box.dataset.state = s.state;
  const img = $('mascot-img');
  const src = mascotSettings.custom
    || (window.LABENTRY_MASCOTS && window.LABENTRY_MASCOTS[MASCOT_IMG_FOR[s.state]])
    || (window.LABENTRY_MASCOTS && window.LABENTRY_MASCOTS.calm) || '';
  if (src && img.getAttribute('src') !== src) img.src = src;
  const badge = $('mascot-badge');
  badge.textContent = s.badge;
  badge.classList.toggle('hidden', !s.badge);
  const bubble = $('mascot-bubble');
  bubble.textContent = s.text;
  bubble.classList.toggle('hidden', !bubbleShown);
}

/* Thu nhỏ ảnh người dùng chọn thành data URL (giữ nền trong suốt bằng PNG) */
function mascotDownscale(file, cb) {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    try {
      const scale = Math.min(1, 288 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * scale));
      c.height = Math.max(1, Math.round(im.height * scale));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/png'));
    } catch (e) { URL.revokeObjectURL(url); cb(null); }
  };
  im.onerror = () => { URL.revokeObjectURL(url); cb(null); };
  im.src = url;
}

function initMascot() {
  const img = $('mascot-img');
  if (!img) return;
  img.addEventListener('click', () => {
    const now = Date.now();
    if (now < mascotBubbleUntil) {
      mascotBubbleUntil = now;
      mascotNextShowAt = now + MASCOT_RESHOW_MS;
    } else {
      mascotBubbleUntil = now + MASCOT_BUBBLE_MS;
      mascotNextShowAt = mascotBubbleUntil + MASCOT_RESHOW_MS;
    }
    mascotSig = '';
    updateMascot();
  });
  const sel = $('mascot-enabled');
  if (sel) {
    sel.value = mascotSettings.on ? 'on' : 'off';
    sel.addEventListener('change', () => {
      mascotSettings.on = sel.value === 'on';
      saveMascotSettings();
      mascotSig = '';
      updateMascot();
    });
  }
  const file = $('mascot-file');
  if ($('btn-mascot-img') && file) $('btn-mascot-img').addEventListener('click', () => file.click());
  if (file) file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    mascotDownscale(f, (dataUrl) => {
      if (!dataUrl) { toast('Không đọc được ảnh này'); return; }
      const prev = mascotSettings.custom;
      mascotSettings.custom = dataUrl;
      if (!saveMascotSettings()) {
        mascotSettings.custom = prev;
        toast('Ảnh quá nặng, bộ nhớ máy không còn chỗ — chọn ảnh nhỏ hơn');
        return;
      }
      mascotSig = '';
      updateMascot();
      toast('Đã đổi ảnh linh vật (chỉ trên máy này)');
    });
  });
  if ($('btn-mascot-reset')) $('btn-mascot-reset').addEventListener('click', () => {
    mascotSettings.custom = null;
    saveMascotSettings();
    mascotSig = '';
    updateMascot();
    toast('Đã về ảnh linh vật mặc định');
  });
  updateMascot();
}

/* ================= F32: Chủ đề lễ hội (ý tưởng 14) =================
 * Đổi màu giao diện + dải lời chúc theo mùa lễ — thuần trang trí, KHÔNG
 * đụng dữ liệu, hẹn giờ, báo động, in ấn, sao lưu. Tự động theo ngày:
 * Tết (âm lịch 23/12 → 5/1), Trung Thu (âm lịch 13–17/8), Giáng Sinh
 * (dương lịch 20–26/12); chọn tay ở tab Quản lý. Lưu ở khóa riêng
 * labentry.theme.v1 (chỉ máy này, không vào file sao lưu). */
const THEME_KEY = 'labentry.theme.v1';
const THEME_KEYS = ['tet', 'thaythuoc', 'phunuqt', 'gioto', 'giaiphong', 'laodong', 'trungthu', 'phunuvn', 'nhagiao', 'qdnd', 'xmas'];
const THEME_GREETINGS = {
  tet: '🧧 Chúc Mừng Năm Mới — chúc ca trực an khang, thịnh vượng!',
  thaythuoc: '🩺 Chúc mừng Ngày Thầy thuốc Việt Nam 27/2!',
  phunuqt: '🌸 Chúc mừng Quốc tế Phụ nữ 8/3 — chúc một nửa thế giới luôn rạng rỡ!',
  gioto: '🏯 Giỗ Tổ Hùng Vương — nhớ ơn các Vua Hùng đã có công dựng nước!',
  giaiphong: '🎉 Chào mừng Ngày Giải phóng miền Nam, thống nhất đất nước 30/4!',
  laodong: '🛠️ Chúc mừng Quốc tế Lao động 1/5!',
  trungthu: '🏮 Tết Trung Thu — chúc ca trực đoàn viên, vui vẻ!',
  phunuvn: '🌺 Chúc mừng Ngày Phụ nữ Việt Nam 20/10!',
  nhagiao: '💐 Chúc mừng Ngày Nhà giáo Việt Nam 20/11 — tri ân thầy cô!',
  qdnd: '⭐ Chúc mừng Ngày thành lập Quân đội Nhân dân Việt Nam 22/12!',
  xmas: '🎄 Giáng Sinh an lành — chúc ca trực ấm áp!',
};
/* Trang trí riêng cho từng event (v61, yêu cầu của Minh — event nào cũng
 * phải có): hai đầu dải chúc (l/r), biểu tượng ở góc dưới trái (bl) và
 * hiệu ứng rơi (fall: 'petal' hoa đào/hồng, 'snow' tuyết; null = không rơi). */
const THEME_DECOR = {
  tet:       { l: '🌸', r: '🏮', bl: '🧧', fall: 'petal' },
  thaythuoc: { l: '🏥', r: '💊', bl: '🩺', fall: null },
  phunuqt:   { l: '🌸', r: '🌹', bl: '🌷', fall: 'petal' },
  gioto:     { l: '🌾', r: '🕯️', bl: '🏯', fall: null },
  giaiphong: { l: '⭐', r: '🎉', bl: '🇻🇳', fall: null },
  laodong:   { l: '⚙️', r: '🌾', bl: '🔧', fall: null },
  trungthu:  { l: '🏮', r: '🌕', bl: '🐇', fall: null },
  phunuvn:   { l: '🪷', r: '🦋', bl: '🌺', fall: null },
  nhagiao:   { l: '📚', r: '✏️', bl: '💐', fall: null },
  qdnd:      { l: '🎖️', r: '🕊️', bl: '⭐', fall: null },
  xmas:      { l: '🎄', r: '🔔', bl: '⛄', fall: 'snow' },
};
const DECOR_FALLS = {
  petal: { ch: '🌸', n: 9, size: [13, 19], dur: [9, 15] },
  snow: { ch: '❄', n: 12, size: [11, 17], dur: [7, 12] },
};
function loadThemeSettings() {
  try {
    const o = JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
    if (o && typeof o === 'object') {
      return { mode: (['auto', 'off'].includes(o.mode) || THEME_KEYS.includes(o.mode)) ? o.mode : 'auto' };
    }
  } catch (e) { /* bỏ qua */ }
  return { mode: 'auto' };
}
let themeSettings = loadThemeSettings();
function saveThemeSettings() {
  try { localStorage.setItem(THEME_KEY, JSON.stringify(themeSettings)); } catch (e) { /* bỏ qua */ }
}

/* --- Lịch âm Việt Nam: thuật toán Hồ Ngọc Đức, múi giờ 7 --- */
function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}
function newMoonDay(k) {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  const C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
    - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr)
    - 0.0004 * Math.sin(3 * dr * Mpr) - 0.0051 * Math.sin((M + Mpr) * dr)
    - 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr)
    - 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr)
    + 0.0010 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((2 * Mpr + M) * dr);
  let deltaT;
  if (T < -11) deltaT = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  else deltaT = -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(jd1 + C1 - deltaT + 0.5 + 7 / 24);
}
function sunLongitudeSector(jdn) {
  const T = (jdn - 2451545.5 - 7 / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
  return Math.floor((L / Math.PI) * 6);
}
function getLunarMonth11(yy) {
  const k = Math.floor((jdFromDate(31, 12, yy) - 2415021) / 29.530588853);
  let nm = newMoonDay(k);
  if (sunLongitudeSector(nm) >= 9) nm = newMoonDay(k - 1);
  return nm;
}
function leapMonthOffset(a11) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = sunLongitudeSector(newMoonDay(k + i));
  do { last = arc; i++; arc = sunLongitudeSector(newMoonDay(k + i)); } while (arc !== last && i < 14);
  return i - 1;
}
function convertSolar2Lunar(dd, mm, yy) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = getLunarMonth11(yy);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) { lunarYear = yy; a11 = getLunarMonth11(yy - 1); }
  else { lunarYear = yy + 1; b11 = getLunarMonth11(yy + 1); }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    if (diff >= leapOff) {
      lunarMonth = diff + 10;
      if (diff === leapOff) lunarLeap = 1;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}
function themeForDate(date) {
  if (themeSettings.mode === 'off') return '';
  if (themeSettings.mode !== 'auto') return themeSettings.mode;
  const d = date.getDate();
  const m = date.getMonth() + 1;
  /* Ngày lễ dương lịch (đúng ngày) — kiểm tra trước các khoảng nhiều ngày
     để 22/12 (Quân đội) không bị khoảng Giáng Sinh 20–26/12 nuốt mất */
  if (m === 2 && d === 27) return 'thaythuoc';
  if (m === 3 && d === 8) return 'phunuqt';
  if (m === 4 && d === 30) return 'giaiphong';
  if (m === 5 && d === 1) return 'laodong';
  if (m === 10 && d === 20) return 'phunuvn';
  if (m === 11 && d === 20) return 'nhagiao';
  if (m === 12 && d === 22) return 'qdnd';
  if (m === 12 && d >= 20 && d <= 26) return 'xmas';
  const lu = convertSolar2Lunar(d, m, date.getFullYear());
  const ld = lu[0];
  const lm = lu[1];
  if ((lm === 12 && ld >= 23) || (lm === 1 && ld <= 5)) return 'tet';
  if (lm === 8 && ld >= 13 && ld <= 17) return 'trungthu';
  if (lm === 3 && ld === 10) return 'gioto';
  return '';
}
let decorThemeShown = '__none__';
function renderThemeDecor(t) {
  const layer = $('theme-decor');
  if (!layer) return;
  if (t === decorThemeShown) return;
  decorThemeShown = t;
  if (!t || !THEME_DECOR[t]) { layer.classList.add('hidden'); layer.innerHTML = ''; return; }
  const d = THEME_DECOR[t];
  let html = '<span class="decor-bl">' + d.bl + '</span>';
  if (d.fall && DECOR_FALLS[d.fall]) {
    const f = DECOR_FALLS[d.fall];
    for (let i = 0; i < f.n; i++) {
      const left = Math.round(((i + 0.5) * 100) / f.n + ((i * 37) % 7) - 3);
      const size = f.size[0] + ((i * 7) % (f.size[1] - f.size[0] + 1));
      const dur = f.dur[0] + ((i * 13) % (f.dur[1] - f.dur[0] + 1));
      const delay = -((i * 29) % 12);
      html += '<span class="decor-fall" style="left:' + left + '%;font-size:' + size + 'px;animation-duration:' + dur + 's;animation-delay:' + delay + 's">' + f.ch + '</span>';
    }
  }
  layer.innerHTML = html;
  layer.classList.remove('hidden');
}
/* Nhạc đệm dịp lễ (v64): Tết, Giáng Sinh, Trung Thu có giai điệu riêng
 * (~10 giây) phát khi dải lời chúc hiện. Giai điệu soạn bằng WebAudio
 * (nốt nhạc -> sóng âm) nên không cần file nhạc, chạy offline được.
 * Trình duyệt chặn tiếng trước lần chạm đầu tiên vào app: khi đó nhạc
 * ở trạng thái chờ và phát ngay ở lần chạm kế tiếp nếu lời chúc còn
 * hiện. Bấm ✕ tắt lời chúc, hoặc chuyển sang chủ đề không có nhạc,
 * thì nhạc dừng. */
const THEME_MUSIC = {
  /* Ngũ cung (C D E G A) tươi vui — giai điệu chúc Tết */
  tet: { bpm: 120, notes: [[72, 1], [76, 1], [79, 1], [81, 1], [79, 1], [76, 1], [74, 1], [76, 2], [74, 1], [72, 1], [74, 1], [76, 1], [79, 2], [76, 1], [74, 1], [72, 2]] },
  /* Jingle Bells (nhạc truyền thống Giáng Sinh) */
  xmas: { bpm: 112, notes: [[64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4]] },
  /* Ngũ cung êm dịu — giai điệu Trung Thu */
  trungthu: { bpm: 96, notes: [[72, 1], [76, 1], [79, 1], [76, 1], [74, 1], [72, 1], [69, 1], [72, 2], [74, 1], [76, 1], [74, 1], [69, 1], [67, 3]] },
};
const themeMusicState = { playing: false, theme: '', playedFor: '', pending: '' };
let themeCtx = null;
let themeMaster = null;
let themeStopTimer = null;
function themeMusicSeconds(t) {
  const spec = THEME_MUSIC[t];
  if (!spec) return 0;
  return (spec.notes.reduce((a, n) => a + n[1], 0) * 60) / spec.bpm;
}
function stopThemeMusic(fadeSec) {
  if (themeStopTimer) { clearTimeout(themeStopTimer); themeStopTimer = null; }
  const m = themeMaster;
  const ctx = themeCtx;
  themeMaster = null;
  themeMusicState.playing = false;
  themeMusicState.theme = '';
  if (m && ctx) {
    try {
      const now = ctx.currentTime;
      const f = fadeSec || 0.15;
      m.gain.cancelScheduledValues(now);
      m.gain.setValueAtTime(m.gain.value, now);
      m.gain.linearRampToValueAtTime(0.0001, now + f);
      setTimeout(() => { try { m.disconnect(); } catch (e) { /* bỏ qua */ } }, (f + 0.1) * 1000);
    } catch (e) { /* bỏ qua */ }
  }
}
function playThemeMusic(t) {
  const spec = THEME_MUSIC[t];
  if (!spec) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  stopThemeMusic();
  try {
    if (!themeCtx || themeCtx.state === 'closed') themeCtx = new AC();
    if (themeCtx.state === 'suspended') {
      themeMusicState.pending = t;
      themeCtx.resume().catch(() => {});
      if (themeCtx.state !== 'running') return; /* chờ lần chạm đầu tiên */
    }
    themeMusicState.pending = '';
    themeMaster = themeCtx.createGain();
    themeMaster.gain.value = 0.14;
    themeMaster.connect(themeCtx.destination);
    const spb = 60 / spec.bpm;
    let at = themeCtx.currentTime + 0.06;
    spec.notes.forEach((pair) => {
      const midi = pair[0];
      const dur = pair[1] * spb;
      if (midi > 0) {
        const fr = 440 * Math.pow(2, (midi - 69) / 12);
        const g = themeCtx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.55, at + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.12, dur * 0.92));
        const o1 = themeCtx.createOscillator();
        o1.type = 'triangle';
        o1.frequency.value = fr;
        o1.connect(g);
        const o2 = themeCtx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = fr;
        const g2 = themeCtx.createGain();
        g2.gain.value = 0.35;
        o2.connect(g2);
        g2.connect(g);
        g.connect(themeMaster);
        o1.start(at);
        o2.start(at);
        o1.stop(at + dur);
        o2.stop(at + dur);
      }
      at += dur;
    });
    themeMusicState.playing = true;
    themeMusicState.theme = t;
    themeStopTimer = setTimeout(() => stopThemeMusic(0.5), themeMusicSeconds(t) * 1000 + 60);
  } catch (e) { /* thiết bị không phát được tiếng: bỏ qua, không làm hỏng app */ }
}

/* Tắt lời chúc chỉ là TẠM THỜI (v63, đúng ý Minh chốt 2026-11-08): bấm ✕
 * ẩn lời chúc của chủ đề đang xem; hễ rời sang chủ đề khác rồi quay lại —
 * hoặc mở lại app — là lời chúc hiện tiếp, không tắt hẳn. */
let bannerDismissedTheme = '';
let lastThemeApplied = null;
function applyTheme() {
  const t = themeForDate(new Date());
  if (lastThemeApplied !== null && t !== lastThemeApplied) bannerDismissedTheme = '';
  lastThemeApplied = t;
  THEME_KEYS.forEach((k) => document.body.classList.toggle('theme-' + k, t === k));
  renderThemeDecor(t);
  const banner = $('theme-banner');
  if (!banner) return;
  const show = !!t && bannerDismissedTheme !== t;
  banner.classList.toggle('hidden', !show);
  if (show) {
    $('theme-banner-text').textContent = THEME_GREETINGS[t];
    const d = THEME_DECOR[t] || { l: '', r: '' };
    $('theme-banner-decor-l').textContent = d.l;
    $('theme-banner-decor-r').textContent = d.r;
  }
  /* Nhạc đệm (v64): phát một lần cho mỗi lần lời chúc hiện */
  const musicKey = show && THEME_MUSIC[t] ? t : '';
  if (musicKey) {
    if (themeMusicState.playedFor !== musicKey) {
      themeMusicState.playedFor = musicKey;
      playThemeMusic(musicKey);
    }
  } else {
    themeMusicState.playedFor = '';
    themeMusicState.pending = '';
    if (themeMusicState.playing) stopThemeMusic();
  }
}
function initTheme() {
  const sel = $('theme-mode');
  if (sel) {
    sel.value = themeSettings.mode;
    sel.addEventListener('change', () => {
      themeSettings.mode = sel.value;
      saveThemeSettings();
      applyTheme();
    });
  }
  const close = $('theme-banner-close');
  if (close) close.addEventListener('click', () => {
    bannerDismissedTheme = themeForDate(new Date());
    applyTheme();
  });
  /* Nếu nhạc đang chờ vì trình duyệt chặn autoplay, phát ở lần chạm đầu tiên */
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => {
    const p = themeMusicState.pending;
    if (p && themeMusicState.playedFor === p && themeForDate(new Date()) === p) playThemeMusic(p);
  }, { passive: true }));
  applyTheme();
}

function init() {
  loadSavedTypes(); /* nạp danh mục tự tạo (nếu có) TRƯỚC khi dựng các ô chọn loại */
  loadStaff(); /* danh sách KTV + KTV trực đã lưu */
  loadAuditLog(); /* nhật ký kiểm toán (F22) */
  loadMeta(); /* cấu hình ca trực: lần sao lưu gần nhất, tự khóa, đọc to (F24) */
  loadPrintSettings(); /* cấu hình bản in (mặc định nếu chưa tùy chỉnh) */
  loadPresets(); /* các mẫu bố cục đã lưu */
  renderOperatorControls();
  bindPrintCfg();
  initWedgeListener(); /* nhận mã từ máy quét cầm tay khi màn hình quét đang mở */
  initMascot(); /* linh vật đồng ca (F31) */
  initTheme(); /* chủ đề lễ hội (F32) */
  initKeyboardFix(); /* chống bàn phím che ô nhập (v66) */
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
    if (!requireOperator('xóa kết quả')) return;
    if (!confirm('Xóa ' + selectedUids.size + ' kết quả đã chọn?')) return;
    const snaps = [...selectedUids].map((uid) => store.getByUid(uid)).filter(Boolean);
    selectedUids.forEach((uid) => store.remove(uid));
    snaps.forEach((rec) => audit('delete', 'Xóa hàng loạt · ' + deleteDetailOf(rec), rec));
    selectedUids.clear();
    setSelectMode(false);
    toast('Đã xóa');
    syncNativeAlarms();
  });

  ['list-today', 'list-pending', 'list-noresult', 'list-export'].forEach((id) => $(id).addEventListener('click', handleListClick));
  $('btn-summary-close').addEventListener('click', closeSummary);
  $('btn-cal-guide-close').addEventListener('click', () => $('cal-guide-modal').classList.add('hidden'));
  $('btn-summary-unrelease').addEventListener('click', unreleaseFromSummary);
  $('alarm-banner').addEventListener('click', () => {
    const shown = dueBannerRecords(dueTimerRecords());
    if (shown.length) openForm(shown[0].uid);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { timerTick(); manageWakeLock(); }
  });
  $('btn-audit').addEventListener('click', () => switchView('audit'));
  $('btn-audit-back').addEventListener('click', () => switchView('manage'));
  /* F24: bàn giao ca + quét tìm mẫu + nhắc sao lưu + tự khóa + đọc to */
  $('btn-handover').addEventListener('click', () => switchView('handover'));
  $('btn-handover-back').addEventListener('click', () => switchView('manage'));
  $('btn-handover-copy').addEventListener('click', copyHandover);
  $('btn-handover-print').addEventListener('click', printHandover);
  /* F27: nhập kết quả theo lô */
  $('btn-batch').addEventListener('click', openBatch);
  /* F37: trang Mẫu hẹn lại + hộp thoại hẹn lại */
  $('btn-deferred').addEventListener('click', () => switchView('deferred'));
  $('btn-deferred-back').addEventListener('click', () => switchView('manage'));
  document.querySelectorAll('[data-defer-filter]').forEach((b) => b.addEventListener('click', () => {
    deferredFilter = b.dataset.deferFilter;
    renderDeferred();
  }));
  $('deferred-list').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-defsel]');
    if (!cb) return;
    if (cb.checked) deferredSel.add(cb.dataset.defsel); else deferredSel.delete(cb.dataset.defsel);
    $('deferred-text').value = buildDeferredText(deferredHandoverSet());
  });
  $('deferred-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-daction]');
    if (!btn) return;
    const uid = btn.dataset.uid;
    if (btn.dataset.daction === 'view') openSummary(uid);
    if (btn.dataset.daction === 'edit') openForm(uid);
    if (btn.dataset.daction === 'undefer') clearDefer(uid);
  });
  $('btn-def-copy').addEventListener('click', copyDeferred);
  $('btn-def-print').addEventListener('click', printDeferredHandover);
  $('btn-defer-save').addEventListener('click', saveDefer);
  $('btn-defer-close').addEventListener('click', closeDeferModal);
  $('btn-defer-clear').addEventListener('click', () => { if (deferUid) clearDefer(deferUid); });
  $('btn-batch-back').addEventListener('click', () => {
    if (batchState) saveBatch();
    batchState = null;
    switchView('manage');
  });
  $('batch-type').addEventListener('change', () => {
    if (!batchState) return;
    if (batchDirtyCount()) saveBatch();
    loadBatchType($('batch-type').value);
    renderBatch();
  });
  $('btn-batch-save').addEventListener('click', () => {
    if (!batchState) return;
    saveBatch();
    loadBatchType(batchState.typeId);
    renderBatch();
  });
  $('btn-batch-discard').addEventListener('click', () => {
    if (batchState && batchDirtyCount() && !window.confirm('Bỏ các thay đổi chưa lưu trong lô này?')) return;
    batchState = null;
    switchView('manage');
  });
  $('btn-batch-prev').addEventListener('click', () => {
    if (!batchState || batchState.cur <= 0) return;
    batchState.cur--;
    renderBatch();
  });
  $('btn-batch-next').addEventListener('click', () => {
    if (!batchState) return;
    const wasLast = batchState.cur >= batchState.uids.length - 1;
    const nextUid = wasLast ? null : batchState.uids[batchState.cur + 1];
    saveBatch();
    if (wasLast) { batchState = null; switchView('manage'); return; }
    const typeId = batchState.typeId;
    loadBatchType(typeId);
    const idx = batchState.uids.indexOf(nextUid);
    batchState.cur = idx >= 0 ? idx : 0;
    if (!batchState.uids.length) { batchState = null; switchView('manage'); return; }
    renderBatch();
  });
  window.addEventListener('resize', () => {
    if (!batchState || $('view-batch').classList.contains('hidden')) return;
    const mode = batchIsGrid() ? 'grid' : 'card';
    if (mode !== batchState.mode) renderBatch();
  });
  $('btn-scan-find').addEventListener('click', () => openScanner('find'));
  $('btn-backup-now').addEventListener('click', exportBackupFile);
  $('btn-backup-later').addEventListener('click', () => {
    appMeta.backupNagUntil = todayKey(); /* ẩn tới hết hôm nay, mai nhắc lại */
    saveMeta();
    renderBackupNag();
  });
  $('autolock-select').value = String(appMeta.autoLockMin);
  $('autolock-select').addEventListener('change', () => {
    appMeta.autoLockMin = Number($('autolock-select').value) || 0;
    saveMeta();
    noteActivity(); /* tính lại mốc không thao tác từ lúc đổi cài đặt */
    toast(appMeta.autoLockMin ? 'Tự khóa KTV trực sau ' + appMeta.autoLockMin + ' phút không thao tác' : 'Đã tắt tự khóa KTV trực');
  });
  $('chk-speak-due').checked = appMeta.speakDue;
  $('chk-speak-due').addEventListener('change', () => {
    appMeta.speakDue = $('chk-speak-due').checked;
    saveMeta();
    toast(appMeta.speakDue ? 'Đã bật đọc to mã mẫu khi tới giờ' : 'Đã tắt đọc to mã mẫu khi tới giờ');
  });
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, noteActivity, { passive: true }));
  renderBackupNag();
  $('audit-filter').addEventListener('change', renderAuditLog);
  $('audit-search').addEventListener('input', renderAuditLog);
  $('operator-select').addEventListener('change', () => requestOperatorChange($('operator-select').value));
  $('scanner-operator-select').addEventListener('change', () => requestOperatorChange($('scanner-operator-select').value));
  $('btn-staff-manage').addEventListener('click', openStaffDialog);
  $('btn-staff-close').addEventListener('click', closeStaffDialog);
  $('btn-staff-add').addEventListener('click', addStaffFromDialog);
  $('input-staff-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStaffFromDialog(); } });
  $('staff-list').addEventListener('click', (e) => {
    const sg = e.target.closest('[data-staff-sig]');
    if (sg) { openSigDialog(sg.dataset.staffSig); return; }
    const pb = e.target.closest('[data-staff-pin]');
    if (pb) { changeStaffPin(pb.dataset.staffPin); return; }
    const b = e.target.closest('[data-staff-del]');
    if (b) deleteStaff(b.dataset.staffDel);
  });
  initSigPad();
  $('btn-sig-cancel').addEventListener('click', closeSigDialog);
  $('btn-sig-save').addEventListener('click', saveSigFromDialog);
  $('btn-sig-remove').addEventListener('click', removeSigFromDialog);
  $('btn-sig-clear').addEventListener('click', clearSigPad);
  $('btn-sig-upload').addEventListener('click', () => $('sig-file').click());
  $('sig-file').addEventListener('change', (e) => { sigFileToPad(e.target.files && e.target.files[0]); e.target.value = ''; });
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
  $('btn-summary-defer').addEventListener('click', () => { if (summaryUid) openDeferModal(summaryUid); });
  $('summary-modal').addEventListener('click', (e) => { if (e.target === $('summary-modal')) closeSummary(); });

  $('btn-apply-filter').addEventListener('click', applyExport);
  $('btn-print').addEventListener('click', () => { applyExport(); printSheet(); });
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
  window.addEventListener('beforeprint', () => { if (printAreaKind !== 'handover') applyExport(); });
  /* Trên trình duyệt: in bàn giao xong thì dựng lại tờ kết quả vào #print-area
     như hành vi cũ. Trong vỏ app KHÔNG làm vậy — adapter in dựng trang bất
     đồng bộ, afterprint có thể bắn giữa chừng và ghi đè tờ bàn giao (F30). */
  window.addEventListener('afterprint', () => {
    if (!lastPrintViaNative && printAreaKind === 'handover') applyExport();
  });

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
  /* F35: chụp ảnh đọc mã — chọn/chụp xong là xử lý ngay; xóa trắng ô chọn file
     liền tay, ảnh không được lưu ở bất cứ đâu trong app */
  $('btn-scan-photo').addEventListener('click', () => {
    const inp = $('scan-photo-input');
    inp.value = '';
    inp.click();
  });
  $('scan-photo-input').addEventListener('change', () => {
    const inp = $('scan-photo-input');
    const f = inp.files && inp.files[0];
    inp.value = '';
    if (f) scanPhotoFile(f);
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

  /* F26 (v46): đồng bộ báo thức native lúc khởi động + thử lại vài nhịp đầu
     (cầu nối của vỏ APK có thể gắn xong sau khi trang bắt đầu tải) + mỗi khi
     quay lại app. Trên trình duyệt thường các lần gọi này tự thoát ngay. */
  syncNativeAlarms();
  setTimeout(syncNativeAlarms, 1500);
  setTimeout(syncNativeAlarms, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNativeAlarms(); });
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

/* Chống bàn phím che ô nhập (v66, Minh góp ý 2026-11-09 — áp dụng cho
 * form nhập thường + nhập theo lô, cả dạng thẻ và dạng bảng):
 * 1) Chạm vào ô chữ trên thiết bị cảm ứng -> chờ ~350ms cho bàn phím mở
 *    rồi tự cuộn ô vào giữa vùng còn thấy được, khỏi kéo tay.
 * 2) visualViewport: bàn phím mở làm vùng hiển thị co > 150px -> gắn cờ
 *    kb-open, CSS ẩn linh vật/thanh điều hướng dưới/nút nổi và thu gọn
 *    thanh điều hướng lô cho thoáng (quy tắc ở styles.css).
 * 3) Meta viewport interactive-widget=resizes-content (index.html) để
 *    Chrome/WebView co vùng hiển thị đúng phần trên bàn phím.
 * PC (chuột + màn hình lớn) giữ nguyên hành vi, không tự cuộn. */
function kbFixApplies() {
  if (window.innerWidth < 900) return true;
  try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); }
  catch (e) { return false; }
}
function initKeyboardFix() {
  if (window.visualViewport) {
    const onVv = () => {
      const kb = kbFixApplies() && (window.innerHeight - window.visualViewport.height > 150);
      document.body.classList.toggle('kb-open', !!kb);
    };
    window.visualViewport.addEventListener('resize', onVv);
    onVv();
  }
  document.addEventListener('focusin', (e) => {
    if (!kbFixApplies()) return;
    const el = e.target;
    if (!el || !el.matches || !el.matches('input, textarea')) return;
    if (el.type && ['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color', 'hidden'].includes(el.type)) return;
    setTimeout(() => {
      if (document.activeElement !== el) return;
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      catch (err) { try { el.scrollIntoView(); } catch (e2) { /* bỏ qua */ } }
    }, 350);
  });
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', registerServiceWorker);

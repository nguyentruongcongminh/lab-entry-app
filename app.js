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
  ['today', 'manage', 'export', 'form'].forEach((v) => $('view-' + v).classList.toggle('hidden', v !== name));
  $('bottom-nav').style.display = name === 'form' ? 'none' : 'flex';
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name !== 'form') mainView = name;
  if (name === 'today') renderToday();
  if (name === 'manage') renderManage();
  if (name === 'export') applyExport();
  window.scrollTo(0, 0);
}

/* ================= Danh sách dùng chung ================= */
function recordItemHTML(rec, opts) {
  const o = opts || {};
  const type = getTestType(rec.typeId);
  const status = store.statusOf(rec);
  const checkbox = o.selectable
    ? '<input type="checkbox" data-select="' + rec.uid + '"' + (selectedUids.has(rec.uid) ? ' checked' : '') + '>'
    : '';
  const releaseBtn = (!o.readonly && status === 'pending-release')
    ? '<button class="icon-btn release-btn" data-action="release" data-uid="' + rec.uid + '" title="Phát hành kết quả" aria-label="Phát hành kết quả">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z"/></svg></button>'
    : '';
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
  const actions = (!viewBtn && o.readonly) ? '' :
    '<div class="record-actions">' + viewBtn + releaseBtn + editDeleteBtns + '</div>';
  return '<li class="record-item">' + checkbox +
    '<div class="record-main"><div class="record-id">' + esc(rec.testId) + '</div>' +
    '<div class="record-type">' + esc(type ? type.name : rec.typeId) + '</div></div>' +
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

function openSummary(uid) {
  const rec = store.getByUid(uid);
  if (!rec) return;
  const type = getTestType(rec.typeId);
  const status = store.statusOf(rec);
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
function renderManage() {
  const all = store.getAll();
  /* Chờ phát hành: mới nhất lên đầu */
  const pending = all.filter((r) => store.statusOf(r) === 'pending-release')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  /* Chưa kết quả (chờ nhập KQ): xếp theo giờ nhận mẫu — nhận trước lên đầu, nhận sau xuống cuối */
  const noresult = all.filter((r) => store.statusOf(r) === 'no-result')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  fillList($('list-pending'), $('empty-pending'), pending, {});
  fillList($('list-noresult'), $('empty-noresult'), noresult, {});
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

function applyExport() {
  const c = currentExportCriteria();
  const recs = store.filter(null, c).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  fillList($('list-export'), $('empty-export'), recs, { readonly: true });
  $('export-count').textContent = 'Có ' + recs.length + ' kết quả';
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

/* ================= Form nhập / sửa ================= */
let formState = { uid: null, typeId: null, results: {}, createdAt: null };

function buildTypeOptions(selectEl, includeAll) {
  selectEl.innerHTML = (includeAll ? '<option value="">Tất cả</option>' : '') +
    LAB_CONFIG.testTypes.map((t) => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join('');
}

function openForm(uid) {
  const rec = uid ? store.getByUid(uid) : null;
  formState = {
    uid: rec ? rec.uid : null,
    typeId: rec ? rec.typeId : LAB_CONFIG.testTypes[0].id,
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
  const res = formState.uid ? store.update(formState.uid, payload) : store.add(payload, new Date(formState.createdAt));
  if (!res.ok) {
    showFormError(res.errors.join('. '));
    return;
  }
  toast('Đã lưu kết quả');
  switchView('today');
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
  scannerState = { source, single, count: 0, lastCode: '', lastAt: 0, locked: false };
  const typeSel = $('scanner-type-select');
  typeSel.disabled = false;
  typeSel.value = source === 'form' ? formState.typeId : (typeSel.value || LAB_CONFIG.testTypes[0].id);
  $('scanner-list').innerHTML = '';
  $('scanner-input').value = '';
  $('scanner-lock-note').classList.add('hidden');
  $('scan-frame').classList.remove('hidden');
  $('scanner-title').textContent = single ? 'Quét mã mẫu' : 'Tiếp nhận mẫu';
  $('scanner-subtitle').textContent = single ? 'Nhận 1 mã để điền vào ô ID của mẫu đang sửa' : 'Quét mã liên tục — mỗi mã là một mẫu được nhận';
  $('scanner-session').classList.toggle('hidden', single);
  /* Chế độ quét liên tục: chỉ quét bằng camera, không hiện ô nhập tay + nút Nhận mẫu.
     Ô nhập tay chỉ còn ở chế độ 1 mã (mở từ form sửa) làm đường dự phòng. */
  $('scanner-manual').classList.toggle('hidden', !single);
  updateScanCount();
  $('scanner-modal').classList.remove('hidden');
  setScanMsg(single ? 'Nhận 1 mã để điền vào ô ID...' : 'Đang mở camera — quét liên tục, bấm "Dừng quét" khi xong...');
  startCamera();
}

function lockScannerType() {
  if (scannerState && !scannerState.locked) {
    scannerState.locked = true;
    $('scanner-type-select').disabled = true;
    $('scanner-lock-note').classList.remove('hidden');
  }
}

/* Nhận 1 mã (từ camera hoặc nhập tay). Trả về true nếu mã được xử lý nhận. */
function acceptScanCode(rawCode) {
  const code = String(rawCode || '').trim();
  if (!code || !scannerState) return false;

  if (scannerState.single) {
    $('input-testid').value = code;
    toast('Đã quét mã: ' + code);
    closeScanner();
    return true;
  }

  const typeId = $('scanner-type-select').value;
  const type = getTestType(typeId);
  if (store.findDuplicate({ testId: code, typeId })) {
    setScanMsg('Đã tồn tại: ' + code + ' (' + (type ? type.name : typeId) + ') — bỏ qua, quét mã tiếp theo', 'err');
    if (navigator.vibrate) navigator.vibrate(120);
    return false;
  }
  const res = store.add({ testId: code, typeId, results: {} });
  if (!res.ok) {
    setScanMsg(res.errors.join('. '), 'err');
    return false;
  }
  lockScannerType();
  scannerState.count += 1;
  updateScanCount();
  const li = document.createElement('li');
  li.innerHTML = '<span>' + esc(code) + '</span><span class="scan-time">' + esc(fmtFull(res.record.createdAt)) + '</span>';
  const list = $('scanner-list');
  list.insertBefore(li, list.firstChild);
  setScanMsg('Đã nhận mẫu: ' + code + ' — quét mã tiếp theo, hoặc bấm "Dừng quét"', 'ok');
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

function closeScanner() {
  const added = scannerState ? scannerState.count : 0;
  const fromFormNew = !!scannerState && scannerState.source === 'form' && !scannerState.single;
  $('scanner-modal').classList.add('hidden');
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  scannerState = null;
  if (added > 0) {
    toast('Đã nhận ' + added + ' mẫu trong phiên quét');
    /* Đã tiếp nhận trực tiếp từ form thêm mới -> về danh sách để xem mẫu vừa nhận */
    if (fromFormNew) switchView('today'); else refreshCurrent();
  }
}

/* ================= Khởi tạo ================= */
function init() {
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
  $('summary-modal').addEventListener('click', (e) => { if (e.target === $('summary-modal')) closeSummary(); });

  $('btn-apply-filter').addEventListener('click', applyExport);
  $('btn-print').addEventListener('click', () => { applyExport(); window.print(); });
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
}

document.addEventListener('DOMContentLoaded', init);

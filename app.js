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
  const actions = o.readonly ? '' :
    '<div class="record-actions">' +
      '<button class="icon-btn" data-action="delete" data-uid="' + rec.uid + '" title="Xóa" aria-label="Xóa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>' +
      '<button class="icon-btn" data-action="edit" data-uid="' + rec.uid + '" title="Sửa" aria-label="Sửa">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></svg></button>' +
    '</div>';
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
  recs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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

/* ================= Quét mã ================= */
let scanStream = null;
let scanTimer = null;

async function openScanner() {
  $('scanner-modal').classList.remove('hidden');
  const msg = $('scanner-msg');
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'Thiết bị/trình duyệt này không hỗ trợ quét mã. Vui lòng nhập ID bằng tay.';
    return;
  }
  try {
    msg.textContent = 'Đang mở camera...';
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = $('scanner-video');
    video.srcObject = scanStream;
    await video.play();
    msg.textContent = 'Đưa mã QR/barcode của mẫu vào khung hình...';
    const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
    scanTimer = setInterval(async () => {
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length && codes[0].rawValue) {
          $('input-testid').value = codes[0].rawValue;
          closeScanner();
          toast('Đã quét mã: ' + codes[0].rawValue);
        }
      } catch (e) { /* bỏ qua khung hình lỗi */ }
    }, 400);
  } catch (e) {
    msg.textContent = 'Không mở được camera (' + e.name + '). Vui lòng nhập ID bằng tay.';
  }
}

function closeScanner() {
  $('scanner-modal').classList.add('hidden');
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
}

/* ================= Khởi tạo ================= */
function init() {
  buildTypeOptions($('select-type'), false);
  buildTypeOptions($('f-type'), true);
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

  ['list-today', 'list-pending', 'list-noresult'].forEach((id) => $(id).addEventListener('click', handleListClick));

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
  $('btn-scan').addEventListener('click', openScanner);
  $('btn-scanner-close').addEventListener('click', closeScanner);

  switchView('today');
}

document.addEventListener('DOMContentLoaded', init);

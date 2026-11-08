'use strict';
/* Test giao diện thật bằng jsdom: nạp index.html + 3 file JS, thao tác như người dùng.
   Chạy: node tests/ui.test.js  (cần jsdom: npm install --prefix tests jsdom) */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

let passed = 0;
const failures = [];
/* Runner nối tiếp (rà soát v41): mỗi test phải CHẠY XONG (kể cả phần bất đồng bộ)
   mới tới test tiếp theo, và lỗi được ghi nhận thay vì nuốt mất. Trước đây test()
   gọi fn() mà không chờ nên mọi khẳng định nằm sau điểm await đầu tiên của các
   test async (đặc biệt là các luồng PIN) chưa từng thực sự chạy. */
let chain = Promise.resolve();
function test(name, fn) {
  chain = chain.then(async () => {
    try {
      await fn();
      passed += 1;
      console.log('PASS  ' + name);
    } catch (e) {
      failures.push(name);
      console.error('FAIL  ' + name + ': ' + (e && e.message ? e.message : e));
    }
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const htmlPath = path.join(__dirname, '..', 'lab-entry-single.html');
  /* jsdom coi file:// là origin mờ nên localStorage gốc bị chặn (SecurityError) —
     thay bằng bản nhớ tạm trong bộ nhớ để app chạy đúng như trên trình duyệt thật,
     đồng thời gieo sẵn dữ liệu qua beforeParse */
  const shimStorage = (w, seed) => {
    const data = new Map(Object.entries(seed || {}));
    Object.defineProperty(w, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => { data.set(k, String(v)); },
        removeItem: (k) => { data.delete(k); },
        clear: () => data.clear(),
        key: (i) => ([...data.keys()][i] ?? null),
        get length() { return data.size; },
      },
    });
  };
  /* Bỏ hậu tố ?v=N ở địa chỉ file khi nạp vào jsdom (bản thật trên web giữ nguyên để chống cache cũ) */
  const htmlText = fs.readFileSync(htmlPath, 'utf8').replace(/\?v=\d+/g, '');
  const dom = new JSDOM(htmlText, {
    url: 'file://' + htmlPath,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    /* v41 (F22): cổng KTV trực áp dụng toàn cục — gieo sẵn một KTV đang trực
       trước khi app chạy, để các test thao tác dữ liệu không bị chặn */
    beforeParse(w) {
      shimStorage(w, {
        'labentry.staff.v1': JSON.stringify([{ name: 'KTV Kiểm Tra', salt: 'test', pinHash: 'testhash' }]),
        'labentry.operator.v1': 'KTV Kiểm Tra',
      });
    },
  });
  const { window } = dom;
  const { document } = window;
  /* Chờ app khởi tạo xong thật rồi mới test: các file JS ngoài nạp bất đồng bộ,
     chờ tới khi dropdown loại XN có options (dấu hiệu init đã chạy). */
  for (let i = 0; i < 60 && document.getElementById('select-type').options.length === 0; i++) await sleep(50);
  assert.ok(document.getElementById('select-type').options.length > 0, 'app phải khởi tạo xong trước khi test');
  window.confirm = () => true;
  window.scrollTo = () => {};

  /* Phiên riêng cho test F22: gieo sẵn KTV + người trực qua beforeParse và chờ
     app khởi tạo xong ở cấp IIFE, để thân test chạy hoàn toàn đồng bộ (không qua
     hộp thoại PIN bất đồng bộ) */
  const dom2 = new JSDOM(htmlText, {
    url: 'file://' + htmlPath,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(w) {
      shimStorage(w, {
        'labentry.staff.v1': JSON.stringify([{ name: 'KTV Nhật Ký', salt: 's', pinHash: 'h' }]),
        'labentry.operator.v1': 'KTV Nhật Ký',
      });
    },
  });
  const w2 = dom2.window;
  const d2 = w2.document;
  for (let i = 0; i < 60 && d2.getElementById('select-type').options.length === 0; i++) await sleep(50);
  w2.confirm = () => true;
  w2.scrollTo = () => {};
  const $2 = (id) => d2.getElementById(id);
  const setInput2 = (el, v) => { el.value = v; el.dispatchEvent(new w2.Event('input', { bubbles: true })); };
  const visible2 = (el) => !el.classList.contains('hidden');

  /* Phiên riêng cho test F24 (v43): KTV + người trực gieo sẵn như dom2, trạng thái
     sạch hoàn toàn để kiểm chứng nhắc sao lưu / khẩn / bàn giao / tự khóa / đọc to / quét tìm */
  const dom3 = new JSDOM(htmlText, {
    url: 'file://' + htmlPath,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(w) {
      shimStorage(w, {
        'labentry.staff.v1': JSON.stringify([{ name: 'KTV V43', salt: 's', pinHash: 'h' }]),
        'labentry.operator.v1': 'KTV V43',
      });
    },
  });
  const w3 = dom3.window;
  /* jsdom 30 không còn cho đặt userAgent qua tùy chọn khởi tạo — ghi đè trực tiếp
     để phiên này đóng vai điện thoại Android (từ v45 nút nhắc Lịch chỉ hiện trên di động) */
  try {
    Object.defineProperty(w3.navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (Linux; Android 14; SM-S948B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.0.0',
    });
  } catch (e) { /* không ghi đè được thì test F25 sẽ bắt lỗi ở assert cổng thiết bị */ }
  const d3 = w3.document;
  for (let i = 0; i < 60 && d3.getElementById('select-type').options.length === 0; i++) await sleep(50);
  w3.confirm = () => true;
  w3.scrollTo = () => {};
  const $3 = (id) => d3.getElementById(id);
  const setInput3 = (el, v) => { el.value = v; el.dispatchEvent(new w3.Event('input', { bubbles: true })); };
  const setSelect3 = (el, v) => { el.value = v; el.dispatchEvent(new w3.Event('change', { bubbles: true })); };
  const visible3 = (el) => !el.classList.contains('hidden');
  const $ = (id) => document.getElementById(id);
  const visible = (el) => !el.classList.contains('hidden');
  const setInput = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const setSelect = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('change', { bubbles: true })); };
  /* Điền PIN vào hộp thoại của app và chờ đóng (định nghĩa TRONG khối này để dùng
     đúng $/setInput cục bộ — bản ở đầu file trước đây tham chiếu ngoài phạm vi
     nên mọi lời gọi đều văng ReferenceError và phần test sau đó không chạy) */
  const nhapPinVao = async (pin) => {
    for (let i = 0; i < 60 && $('pin-modal').classList.contains('hidden'); i++) await sleep(20);
    assert.ok(!$('pin-modal').classList.contains('hidden'), 'phải hiện hộp thoại nhập PIN');
    setInput($('pin-input'), pin);
    $('btn-pin-ok').click();
    for (let i = 0; i < 60 && !$('pin-modal').classList.contains('hidden'); i++) await sleep(20);
    assert.ok($('pin-modal').classList.contains('hidden'), 'nhập đúng PIN thì hộp thoại phải đóng');
  };

  test('trang nạp xong: tab Hôm nay hiện, danh sách rỗng báo "Không có kết quả"', () => {
    assert.ok(visible($('view-today')));
    assert.ok(visible($('empty-today')));
    assert.strictEqual($('list-today').children.length, 0);
    assert.strictEqual(window.eval('LAB_CONFIG.testTypes.length'), 6);
  });

  test('mở form thêm mới: form hiện, thanh điều hướng ẩn, loại mặc định có 1 trường text', () => {
    $('fab-add').click();
    assert.ok(visible($('view-form')));
    assert.strictEqual($('bottom-nav').style.display, 'none');
    assert.strictEqual($('fields-container').querySelectorAll('[data-field]').length, 1);
    assert.ok($('created-display').textContent.length >= 19);
  });

  test('lưu khi thiếu ID -> báo lỗi, không rời form (tiêu chí 2)', () => {
    $('btn-save').click();
    assert.ok(visible($('form-error')));
    assert.ok(visible($('view-form')));
  });

  test('nhập Cạo tìm nấm đầy đủ -> lưu, hiện ở danh sách hôm nay, trạng thái Chờ phát hành (tiêu chí 4)', () => {
    setInput($('input-testid'), '2611041225');
    setInput($('fields-container').querySelector('[data-field="ketQua"]'), 'Soi thấy sợi nấm');
    $('btn-save').click();
    /* F25 (v45): thêm mẫu MỚI xong tự chuyển sang tab Quản lý — về tab Hôm nay mới kiểm danh sách */
    assert.ok(visible($('view-manage')), 'thêm mẫu mới xong phải tự chuyển sang tab Quản lý (F25)');
    document.querySelector('[data-view="today"]').click();
    const items = $('list-today').children;
    assert.strictEqual(items.length, 1);
    assert.ok(items[0].textContent.includes('2611041225'));
    assert.ok(items[0].textContent.includes('Cạo tìm nấm'));
    assert.ok(items[0].textContent.includes('Chờ phát hành'));
  });

  test('đổi loại XN -> bộ trường đổi đúng; chip (+)/(++)/(+++) chọn/đổi/bỏ chọn được (tiêu chí 1, 3)', () => {
    $('fab-add').click();
    setSelect($('select-type'), 'soi-tuoi-huyet-trang');
    assert.strictEqual($('fields-container').querySelectorAll('.form-row').length, 9);
    const chip = (val) => $('fields-container').querySelector('[data-chip="nam"][data-value="' + val + '"]');
    chip('(++)').click();
    assert.ok(chip('(++)').classList.contains('selected'));
    chip('(++)').click(); // bấm lại -> bỏ chọn
    assert.ok(!chip('(++)').classList.contains('selected'));
    chip('(++)').click();
    chip('(+)').click(); // đổi mức
    assert.ok(chip('(+)').classList.contains('selected'));
    assert.ok(!chip('(++)').classList.contains('selected'));
    setInput($('input-testid'), '2611041050');
    setInput($('fields-container').querySelector('[data-field="bachCau"]'), '5-10/HPF');
    $('btn-save').click();
    assert.strictEqual($('list-today').children.length, 2);
  });

  test('tạo SP không nhập kết quả -> trạng thái Chưa kết quả, nằm ở tab Quản lý nhóm Chưa kết quả (tiêu chí 6)', () => {
    $('fab-add').click();
    setSelect($('select-type'), 'sp');
    setInput($('input-testid'), '2611041238');
    $('btn-save').click();
    const items = $('list-today').children;
    assert.strictEqual(items.length, 3);
    assert.ok([...items].some((li) => li.textContent.includes('2611041238') && li.textContent.includes('Chưa kết quả')));
    document.querySelector('[data-view="manage"]').click();
    assert.ok([...$('list-noresult').children].some((li) => li.textContent.includes('2611041238')));
    assert.strictEqual($('list-pending').children.length, 2);
  });

  test('sửa kết quả + điền ngày giờ phát hành -> Đã phát hành, rời nhóm Chờ phát hành (tiêu chí 5, 6)', () => {
    document.querySelector('[data-view="today"]').click();
    const li = [...$('list-today').children].find((x) => x.textContent.includes('2611041225'));
    li.querySelector('[data-action="edit"]').click();
    assert.ok(visible($('view-form')));
    assert.strictEqual($('input-testid').value, '2611041225');
    $('input-release').value = '2026-11-04T09:30';
    $('btn-save').click();
    const li2 = [...$('list-today').children].find((x) => x.textContent.includes('2611041225'));
    assert.ok(li2.textContent.includes('Đã phát hành'));
    document.querySelector('[data-view="manage"]').click();
    assert.strictEqual($('list-pending').children.length, 1);
  });

  test('tìm kiếm theo ID lọc đúng danh sách (tiêu chí 7)', () => {
    document.querySelector('[data-view="today"]').click();
    $('btn-search').click();
    setInput($('input-search'), '41050');
    assert.strictEqual($('list-today').children.length, 1);
    assert.ok($('list-today').children[0].textContent.includes('2611041050'));
    $('btn-search-close').click();
    assert.strictEqual($('list-today').children.length, 3);
    $('btn-refresh').click();
    assert.strictEqual($('list-today').children.length, 3);
  });

  test('chế độ chọn nhiều: tick chọn, đếm đúng, xóa đã chọn (tiêu chí 5)', () => {
    $('btn-select').click();
    const cb = $('list-today').querySelector('[data-select]');
    assert.ok(cb, 'có checkbox khi bật chọn nhiều');
    cb.click();
    assert.ok($('selected-count').textContent.includes('1'));
    $('btn-delete-selected').click();
    assert.strictEqual($('list-today').children.length, 2);
    assert.ok($('select-bar').classList.contains('hidden'));
  });

  test('xóa từng dòng bằng nút thùng rác (tiêu chí 5)', () => {
    // (Bản ghi SP 2611041238 đã bị xóa ở test chọn nhiều phía trên — danh sách xếp mới nhất lên đầu.)
    const li = [...$('list-today').children].find((x) => x.textContent.includes('2611041050'));
    li.querySelector('[data-action="delete"]').click();
    assert.strictEqual($('list-today').children.length, 1);
  });

  test('tab Lọc & Xuất PDF: lọc theo trạng thái + bảng in khớp số dòng (tiêu chí 8)', () => {
    // Sau các test xóa phía trên, hôm nay còn 1 bản ghi: SP 2611041238 (Chưa kết quả).
    // (Danh sách hôm nay xếp cũ -> mới nên chọn nhiều đã xóa bản ghi cũ nhất 2611041225.)
    document.querySelector('[data-view="export"]').click();
    assert.strictEqual($('list-export').children.length, 1); // còn 1 bản ghi hôm nay, mặc định lọc hôm nay
    assert.strictEqual($('print-area').querySelectorAll('tbody tr').length, 1);
    setSelect($('f-status'), 'released');
    $('btn-apply-filter').click();
    assert.strictEqual($('list-export').children.length, 0);
    assert.ok(visible($('empty-export')));
    assert.strictEqual($('print-area').querySelector('tbody').innerHTML, '');
    setSelect($('f-status'), 'no-result');
    $('btn-apply-filter').click();
    assert.strictEqual($('list-export').children.length, 1);
    assert.ok($('export-count').textContent.includes('1'));
  });

  test('bảng in: trường chip không chọn hiện "Âm tính" (tiêu chí 8)', () => {
    setSelect($('f-status'), 'no-result');
    setSelect($('f-type'), '');
    $('btn-apply-filter').click();
    const html = $('print-area').querySelector('tbody').innerHTML;
    assert.ok(html.includes('2611041238'));
    assert.ok(html.includes('Hồng cầu: Âm tính'));
    assert.ok(html.includes('Bạch cầu: Âm tính'));
  });

  test('bảng in Soi tươi huyết trắng: trường chip bỏ trống hiện "Âm tính", trường đã chọn hiện đúng mức', () => {
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    setSelect($('select-type'), 'soi-tuoi-huyet-trang');
    setInput($('input-testid'), '2611041999');
    $('fields-container').querySelector('[data-chip="trichomonas"][data-value="(+)"]').click();
    $('btn-save').click();
    document.querySelector('[data-view="export"]').click();
    setSelect($('f-type'), 'soi-tuoi-huyet-trang');
    setSelect($('f-status'), '');
    $('btn-apply-filter').click();
    const html = $('print-area').querySelector('tbody').innerHTML;
    assert.ok(html.includes('Nấm: Âm tính'), 'Nấm bỏ trống -> Âm tính');
    assert.ok(html.includes('Clue cell: Âm tính'), 'Clue cell bỏ trống -> Âm tính');
    assert.ok(html.includes('Trichomonas: (+)'), 'Trichomonas hiện đúng mức đã chọn');
  });

  test('nút quét mã: trình duyệt không hỗ trợ -> báo rõ, không treo app', async () => {
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    $('btn-scan').click();
    await sleep(30);
    assert.ok(visible($('scanner-modal')));
    assert.ok($('scanner-msg').textContent.includes('không hỗ trợ'));
    $('btn-scanner-close').click();
    assert.ok(!visible($('scanner-modal')));
    $('btn-cancel').click();
    assert.ok(visible($('view-today')));
  });

  test('nhập trùng ID + loại XN qua form -> báo Đã tồn tại, không thêm bản ghi', () => {
    document.querySelector('[data-view="today"]').click();
    const before = $('list-today').children.length;
    $('fab-add').click();
    setSelect($('select-type'), 'soi-tuoi-huyet-trang'); // ID 2611041999 đã có loại này (thêm ở test bảng in)
    setInput($('input-testid'), '2611041999');
    $('btn-save').click();
    assert.ok(visible($('view-form')), 'vẫn ở form, không cho lưu');
    assert.ok($('form-error').textContent.includes('Đã tồn tại'));
    $('btn-cancel').click();
    assert.strictEqual($('list-today').children.length, before);
  });

  test('nhóm Chưa kết quả xếp theo giờ nhận: nhập trước lên đầu, nhập sau xuống cuối', async () => {
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    setSelect($('select-type'), 'sp');
    setInput($('input-testid'), '2611042001');
    $('btn-save').click();
    await sleep(40); // lệch thời điểm tạo để thứ tự giờ rõ ràng
    $('fab-add').click();
    setSelect($('select-type'), 'sp');
    setInput($('input-testid'), '2611042002');
    $('btn-save').click();
    document.querySelector('[data-view="manage"]').click();
    const rows = [...$('list-noresult').children];
    assert.strictEqual(rows.length, 3); // SP 2611041238 (tạo sớm hơn) + 2001 + 2002
    assert.ok(rows[0].textContent.includes('2611041238'), 'ID nhận sớm nhất ở đầu danh sách');
    const i1 = rows.findIndex((r) => r.textContent.includes('2611042001'));
    const i2 = rows.findIndex((r) => r.textContent.includes('2611042002'));
    assert.ok(i1 >= 0 && i2 > i1, 'ID nhập trước nằm trên ID nhập sau');
  });

  test('bấm trực tiếp vào dòng/ID không mở sửa — chỉ nút bút mới mở được form sửa', () => {
    document.querySelector('[data-view="today"]').click();
    const li = [...$('list-today').children].find((x) => x.textContent.includes('2611041999'));
    li.querySelector('.record-id').click();
    assert.ok(!visible($('view-form')), 'bấm vào ID không được mở form');
    li.querySelector('.record-main').click();
    assert.ok(!visible($('view-form')), 'bấm vào dòng không được mở form');
    li.querySelector('[data-action="edit"]').click();
    assert.ok(visible($('view-form')), 'nút bút mở form sửa');
    assert.strictEqual($('input-testid').value, '2611041999');
    $('btn-cancel').click();
    assert.ok(visible($('view-today')));
  });

  test('nút Xem lớn: chỉ hiện khi đã có kết quả; tóm tắt hiện đúng nội dung, chữ to dễ chép', () => {
    document.querySelector('[data-view="today"]').click();
    const li = [...$('list-today').children].find((x) => x.textContent.includes('2611041999'));
    const viewBtn = li.querySelector('[data-action="view"]');
    assert.ok(viewBtn && viewBtn.classList.contains('view-btn'), 'bản ghi có kết quả có nút Xem lớn');
    viewBtn.click();
    assert.ok(visible($('summary-modal')));
    assert.strictEqual($('sum-id').textContent, '2611041999');
    assert.ok($('sum-type').textContent.includes('Soi tươi huyết trắng'));
    const fields = $('sum-fields').textContent;
    assert.ok(fields.includes('Trichomonas') && fields.includes('(+)'), 'hiện đúng mức đã chọn');
    assert.ok(fields.includes('Nấm') && fields.includes('Âm tính'), 'trường bỏ trống hiện Âm tính');
    assert.ok($('sum-release').textContent.includes('Chưa phát hành'));
    assert.ok(visible($('btn-summary-release')), 'đang chờ phát hành: trang Xem có luôn nút Phát hành');
    $('btn-summary-close').click();
    assert.ok(!visible($('summary-modal')));
    document.querySelector('[data-view="manage"]').click();
    const noRes = [...$('list-noresult').children].find((x) => x.textContent.includes('2611042001'));
    assert.strictEqual(noRes.querySelector('[data-action="view"]'), null, 'chưa có kết quả thì không có nút Xem');
    document.querySelector('[data-view="today"]').click();
  });

  test('Phát hành: từ trang Xem và từ nút trên dòng — đều ngay lập tức, KHÔNG hỏi lại', () => {
    let confirmCalls = 0;
    window.confirm = () => { confirmCalls += 1; return true; };
    /* (a) Phát hành ngay trong trang Xem tóm tắt */
    document.querySelector('[data-view="today"]').click();
    const li = [...$('list-today').children].find((x) => x.textContent.includes('2611041999'));
    assert.ok(li.querySelector('[data-action="release"]'), 'bản ghi chờ phát hành có nút phát hành trên dòng');
    li.querySelector('[data-action="view"]').click();
    assert.ok(visible($('summary-modal')));
    assert.ok(visible($('btn-summary-release')), 'trang Xem có nút Phát hành khi đang chờ phát hành');
    $('btn-summary-release').click();
    assert.strictEqual(confirmCalls, 0, 'phát hành từ trang Xem không hỏi lại');
    assert.ok(!visible($('summary-modal')), 'phát hành xong trang Xem phải TỰ THOÁT về danh sách — không cần bấm Đóng (v26)');
    const li2 = [...$('list-today').children].find((x) => x.textContent.includes('2611041999'));
    assert.ok(li2.textContent.includes('Đã phát hành'));
    assert.strictEqual(li2.querySelector('[data-action="release"]'), null, 'đã phát hành thì mất nút trên dòng');
    document.querySelector('[data-view="manage"]').click();
    assert.strictEqual($('list-pending').children.length, 0, 'rời nhóm Chờ phát hành');
    const noRes = [...$('list-noresult').children].find((x) => x.textContent.includes('2611042001'));
    assert.strictEqual(noRes.querySelector('[data-action="release"]'), null, 'chưa có kết quả thì không có nút phát hành');
    /* (b) Phát hành từ nút trên dòng cho một bản ghi mới */
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    setSelect($('select-type'), 'sp');
    setInput($('input-testid'), '2611042600');
    setInput($('fields-container').querySelector('[data-field="kySinhTrung"]'), 'Không thấy');
    $('btn-save').click();
    /* F25: thêm mới xong đang ở tab Quản lý — phát hành từ nút trên dòng của nhóm Chờ phát hành */
    const liB = [...$('list-pending').children].find((x) => x.textContent.includes('2611042600'));
    const relBtn = liB.querySelector('[data-action="release"]');
    assert.ok(relBtn, 'bản ghi mới chờ phát hành có nút phát hành');
    relBtn.click();
    assert.strictEqual(confirmCalls, 0, 'phát hành từ nút trên dòng cũng không hỏi lại');
    assert.ok(![...$('list-pending').children].some((x) => x.textContent.includes('2611042600')), 'phát hành xong phải rời nhóm Chờ phát hành');
    document.querySelector('[data-view="today"]').click();
    const liB2 = [...$('list-today').children].find((x) => x.textContent.includes('2611042600'));
    assert.ok(liB2.textContent.includes('Đã phát hành'));
  });

  test('quét liên tục từ tab Hôm nay: chỉ quét camera (không còn ô nhập tay), KHÔNG khóa loại — đổi loại giữa phiên được, trùng thì bỏ qua', () => {
    document.querySelector('[data-view="today"]').click();
    const before = $('list-today').children.length;
    $('btn-scan-today').click();
    assert.ok(visible($('scanner-modal')));
    assert.ok($('scanner-manual').classList.contains('hidden'), 'chế độ liên tục không hiện ô nhập tay + nút Nhận mẫu');
    assert.strictEqual(window.getComputedStyle($('scanner-manual')).display, 'none', 'ô nhập tay phải thật sự không hiển thị khi tính cả CSS');
    assert.ok(!$('scanner-type-select').disabled, 'chưa quét mã nào: loại còn đổi được');
    setSelect($('scanner-type-select'), 'sp');
    assert.strictEqual(typeof window.acceptScanCode, 'function');
    const scan = (code) => window.acceptScanCode(code); // đúng hàm vòng lặp camera gọi khi phát hiện mã
    scan('2611043001');
    assert.ok($('scanner-count').textContent.includes('1'));
    assert.strictEqual($('scanner-list').children.length, 1);
    assert.ok(!$('scanner-type-select').disabled, 'sau mã đầu tiên: loại vẫn KHÔNG bị khóa, đổi được giữa phiên');
    scan('2611043001'); // trùng ID + loại
    assert.ok($('scanner-msg').textContent.includes('Đã tồn tại'));
    assert.ok($('scanner-count').textContent.includes('1'), 'trùng không tính thêm');
    /* Đổi loại giữa phiên rồi bắn tiếp: mẫu mới phải mang loại vừa đổi */
    setSelect($('scanner-type-select'), 'mau-an');
    scan('2611043004');
    assert.ok($('scanner-count').textContent.includes('2'));
    assert.ok($('scanner-list').children[0].textContent.includes('Máu ẩn'), 'dòng mẫu trong phiên hiện đúng loại vừa đổi');
    setSelect($('scanner-type-select'), 'sp');
    scan('2611043002');
    assert.ok($('scanner-count').textContent.includes('3'));
    $('btn-scanner-close').click(); // người dùng chủ động dừng
    assert.ok(!visible($('scanner-modal')));
    assert.strictEqual($('list-today').children.length, before + 3);
    const rows = [...$('list-today').children];
    const i1 = rows.findIndex((r) => r.textContent.includes('2611043001'));
    const i4 = rows.findIndex((r) => r.textContent.includes('2611043004'));
    const i2 = rows.findIndex((r) => r.textContent.includes('2611043002'));
    assert.ok(i1 >= 0 && i4 > i1 && i2 > i4, 'mẫu nhận trước nằm trên mẫu nhận sau');
    assert.ok(rows[i1].textContent.includes('Chưa kết quả'));
    assert.ok(rows[i4].textContent.includes('Máu ẩn'), 'mẫu bắn sau khi đổi loại mang loại Máu ẩn');
    assert.ok(rows[i1].textContent.includes('SP'), 'mẫu bắn trước vẫn giữ loại SP');
  });

  test('máy quét cầm tay: chuỗi gõ nhanh + Enter trong màn hình quét được nhận như camera; gõ chậm thì không nhận', () => {
    document.querySelector('[data-view="today"]').click();
    $('btn-scan-today').click();
    assert.ok(visible($('scanner-modal')));
    setSelect($('scanner-type-select'), 'sp');
    assert.strictEqual(typeof window.wedgeKey, 'function');
    let t = 1000;
    'WEDGE001'.split('').forEach((ch) => { window.wedgeKey(ch, t); t += 10; });
    assert.strictEqual(window.wedgeKey('Enter', t + 10), true, 'gõ nhanh kiểu máy quét + Enter phải được nhận là một mã');
    assert.ok($('scanner-count').textContent.includes('1'));
    assert.ok($('scanner-list').textContent.includes('WEDGE001'));
    let t2 = 5000;
    'SLOW0001'.split('').forEach((ch) => { window.wedgeKey(ch, t2); t2 += 300; });
    assert.strictEqual(window.wedgeKey('Enter', t2 + 10), false, 'gõ chậm kiểu người gõ tay không được tính là mã quét');
    assert.ok($('scanner-count').textContent.includes('1'), 'phiên vẫn chỉ có 1 mẫu');
    $('btn-scanner-close').click();
    assert.ok([...$('list-today').children].some((x) => x.textContent.includes('WEDGE001')), 'mẫu từ máy quét cầm tay phải vào danh sách Hôm nay');
  });

  test('quét từ form SỬA: chế độ 1 mã — điền vào ô ID, tự đóng, không tạo bản ghi mới', () => {
    const before = $('list-today').children.length;
    const li = [...$('list-today').children].find((x) => x.textContent.includes('2611043001'));
    li.querySelector('[data-action="edit"]').click();
    assert.ok(visible($('view-form')));
    $('btn-scan').click();
    assert.ok(visible($('scanner-modal')));
    assert.ok(!$('scanner-manual').classList.contains('hidden'), 'chế độ 1 mã vẫn còn ô nhập tay dự phòng');
    assert.notStrictEqual(window.getComputedStyle($('scanner-manual')).display, 'none');
    $('scanner-input').value = '8888';
    $('btn-scanner-add').click();
    assert.ok(!visible($('scanner-modal')), 'nhận 1 mã xong tự đóng');
    assert.strictEqual($('input-testid').value, '8888');
    $('btn-cancel').click();
    assert.strictEqual($('list-today').children.length, before, 'không tạo thêm bản ghi');
  });

  test('lưu kết quả khi đang ở tab Quản lý: giữ nguyên tab Quản lý, không nhảy về tab đầu', () => {
    document.querySelector('[data-view="manage"]').click();
    const li = [...$('list-noresult').children].find((x) => x.textContent.includes('2611043001'));
    li.querySelector('[data-action="edit"]').click();
    assert.ok(visible($('view-form')));
    setInput($('fields-container').querySelector('[data-field="kySinhTrung"]'), 'Không thấy KST');
    $('btn-save').click();
    assert.ok(visible($('view-manage')), 'sau khi lưu vẫn ở tab Quản lý');
    assert.ok(!visible($('view-today')), 'không bị nhảy về tab Hôm nay');
    const pend = [...$('list-pending').children].find((x) => x.textContent.includes('2611043001'));
    assert.ok(pend, 'mẫu vừa nhập kết quả đã sang nhóm Chờ phát hành của tab Quản lý');
  });

  test('nhận mẫu từ nút + rồi bắn mã xong: tự chuyển sang tab Quản lý, không ở lại tab Hôm nay', () => {
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    assert.ok(visible($('view-form')));
    $('btn-scan').click();
    assert.ok(visible($('scanner-modal')));
    setSelect($('scanner-type-select'), 'sp');
    window.acceptScanCode('2611043003'); // đúng hàm vòng lặp camera gọi
    assert.ok($('scanner-count').textContent.includes('1'));
    $('btn-scanner-close').click(); // Dừng quét
    assert.ok(visible($('view-manage')), 'sau khi bắn nhận xong phải ở tab Quản lý');
    assert.ok(!visible($('view-today')), 'không giữ ở tab Kết quả hôm nay');
    const row = [...$('list-noresult').children].find((x) => x.textContent.includes('2611043003'));
    assert.ok(row, 'mẫu vừa nhận nằm trong nhóm Chưa kết quả của tab Quản lý');
  });

  test('tab Quản lý cũng có nút + thêm mới như tab Hôm nay; tab Lọc và form thì không', () => {
    document.querySelector('[data-view="manage"]').click();
    assert.ok(!($('fab-add').classList.contains('hidden')), 'ở Quản lý: nút + hiện');
    assert.notStrictEqual(window.getComputedStyle($('fab-add')).display, 'none');
    $('fab-add').click();
    assert.ok(visible($('view-form')), 'bấm + ở Quản lý mở được form thêm mới');
    assert.ok($('fab-add').classList.contains('hidden'), 'trong form: nút + ẩn');
    $('btn-cancel').click();
    assert.ok(visible($('view-manage')), 'hủy form quay lại Quản lý');
    document.querySelector('[data-view="export"]').click();
    assert.ok($('fab-add').classList.contains('hidden'), 'ở tab Lọc & Xuất: nút + ẩn');
    document.querySelector('[data-view="today"]').click();
    assert.ok(!($('fab-add').classList.contains('hidden')), 'ở Hôm nay: nút + hiện');
    assert.strictEqual(window.getComputedStyle($('fab-add')).width, '48px', 'nút + đã thu nhỏ còn 48px');
    assert.strictEqual(window.getComputedStyle($('list-today')).paddingBottom, '148px', 'cuối danh sách có khoảng trống để dòng cuối không bị nút + che');
  });

  test('thống kê tab Quản lý khớp danh sách; mẫu chờ quá 60 phút bị tô đỏ; tiếng bíp an toàn khi máy không có âm thanh', () => {
    assert.strictEqual(typeof window.beepOk, 'function');
    window.beepOk(); window.beepErr(); // jsdom không có AudioContext: không được văng lỗi
    document.querySelector('[data-view="manage"]').click();
    assert.strictEqual(Number($('stat-noresult').textContent), $('list-noresult').children.length, 'số Chưa kết quả khớp danh sách');
    assert.strictEqual(Number($('stat-pending').textContent), $('list-pending').children.length, 'số Chờ phát hành khớp danh sách');
    assert.ok(Number($('stat-received').textContent) >= $('list-today').children.length);
    /* Tạo một mẫu đã nhận cách đây 90 phút mà chưa có kết quả */
    const added = window.eval("store.add({ testId: '261104OLD1', typeId: 'sp', results: {} }, new Date(Date.now() - 90 * 60000))");
    assert.ok(added && added.ok);
    document.querySelector('[data-view="today"]').click();
    document.querySelector('[data-view="manage"]').click();
    const oldRow = [...$('list-noresult').children].find((x) => x.textContent.includes('261104OLD1'));
    assert.ok(oldRow.classList.contains('overdue'), 'mẫu chờ 90 phút phải bị tô đỏ cảnh báo');
    assert.ok(oldRow.textContent.includes('Đã chờ'), 'hiện rõ thời gian đã chờ');
    const freshRow = [...$('list-noresult').children].find((x) => x.textContent.includes('2611043003'));
    assert.ok(freshRow && !freshRow.classList.contains('overdue'), 'mẫu mới nhận không bị cảnh báo');
    assert.strictEqual(Number($('stat-noresult').textContent), $('list-noresult').children.length, 'thống kê cập nhật khớp sau khi thêm mẫu cũ');
  });

  test('tab Quản lý: nhóm Chưa kết quả nằm TRÊN, Chờ phát hành nằm DƯỚI (v21); khoảng trống chống che nút + dời sang danh sách cuối mới', () => {
    document.querySelector('[data-view="manage"]').click();
    const titles = [...document.querySelectorAll('#view-manage .group-title')].map((h) => h.textContent.trim());
    assert.deepStrictEqual(titles, ['Chưa kết quả', 'Chờ phát hành'], 'thứ tự nhóm phải là Chưa kết quả trước, Chờ phát hành sau');
    assert.strictEqual(window.getComputedStyle($('list-pending')).paddingBottom, '148px', 'danh sách cuối (Chờ phát hành) phải có khoảng trống để dòng cuối không bị nút + che');
    assert.strictEqual(window.getComputedStyle($('list-noresult')).paddingBottom, '148px', 'từ v23 mỗi khung hiện riêng một mình nên danh sách Chưa kết quả cũng cần khoảng trống này khi nó là khung đang hiện');
  });

  test('tab Quản lý: mặc định chỉ hiện khung Chưa kết quả; bấm nút chuyển mới hiện khung Chờ phát hành, số đếm trên nút khớp danh sách (v23)', () => {
    document.querySelector('[data-view="manage"]').click();
    assert.ok(!$('group-noresult').classList.contains('hidden'), 'mặc định hiện khung Chưa kết quả');
    assert.ok($('group-pending').classList.contains('hidden'), 'mặc định ẩn khung Chờ phát hành');
    assert.ok($('btn-panel-noresult').classList.contains('active'), 'nút Chưa kết quả ở trạng thái đang chọn');
    assert.strictEqual(Number($('count-noresult').textContent), $('list-noresult').children.length, 'số đếm nút Chưa kết quả khớp danh sách');
    assert.strictEqual(Number($('count-pending').textContent), $('list-pending').children.length, 'số đếm nút Chờ phát hành khớp danh sách');
    $('btn-panel-pending').click();
    assert.ok($('group-noresult').classList.contains('hidden'), 'sau khi chuyển: ẩn Chưa kết quả');
    assert.ok(!$('group-pending').classList.contains('hidden'), 'sau khi chuyển: hiện Chờ phát hành');
    assert.ok($('btn-panel-pending').classList.contains('active'));
    $('btn-panel-noresult').click();
    assert.ok(!$('group-noresult').classList.contains('hidden'), 'chuyển ngược lại được');
    assert.ok($('group-pending').classList.contains('hidden'));
  });

  test('PWA: trang khai manifest + theme-color; manifest hợp lệ, có icon 192/512/maskable; sw.js đúng phiên bản v64 và precache đúng URL ?v=64 (v24)', () => {
    const link = document.querySelector('link[rel="manifest"]');
    assert.ok(link, 'phải có thẻ link manifest');
    assert.strictEqual(link.getAttribute('href'), 'manifest.webmanifest');
    const theme = document.querySelector('meta[name="theme-color"]');
    assert.ok(theme && theme.getAttribute('content') === '#1e88e5', 'phải có theme-color #1e88e5');
    assert.ok(document.querySelector('link[rel="apple-touch-icon"]'), 'phải có apple-touch-icon cho iOS');
    const root = path.join(__dirname, '..');
    const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
    assert.strictEqual(man.short_name, 'LabEntry');
    assert.strictEqual(man.display, 'standalone');
    assert.strictEqual(man.theme_color, '#1e88e5');
    const sizes = man.icons.map((i) => i.sizes);
    assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'manifest phải có icon 192 và 512');
    assert.ok(man.icons.some((i) => i.purpose === 'maskable'), 'manifest phải có icon maskable');
    for (const ic of man.icons) assert.ok(fs.existsSync(path.join(root, ic.src)), 'thiếu file icon ' + ic.src);
    assert.ok(fs.existsSync(path.join(root, 'apple-touch-icon.png')), 'thiếu apple-touch-icon.png');
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(sw.includes("const VERSION = 'v64'"), 'sw.js phải gắn VERSION v64');
    for (const a of ['styles.css?v=64', 'print.css?v=64', 'config.js?v=64', 'store.js?v=64', 'mascot.js?v=64', 'app.js?v=64', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
      assert.ok(sw.includes(a), 'sw.js phải precache ' + a);
    }
    assert.ok(sw.includes('skipWaiting') && sw.includes('clients.claim'), 'sw.js phải kích hoạt bản mới ngay');
    /* v48: .mic-wrap phải có flex:1 + min-width:0 — thiếu thì nhãn trường kết quả bị
       ép còn bề rộng một từ trong form nhập (lỗi bố cục vỏ APK, jsdom không tự thấy) */
    const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    const micRule = css.match(/\.mic-wrap\s*\{[^}]*\}/);
    assert.ok(micRule && micRule[0].includes('flex: 1') && micRule[0].includes('min-width: 0'),
      'styles.css: .mic-wrap phải khai flex: 1 và min-width: 0 (v48)');
  });

  test('nút nhập kết quả nhanh: loại có mẫu thì hiện hàng nút gọn, bấm là điền cả bộ kết quả nhưng KHÔNG tự lưu; loại chưa có mẫu thì không hiện hàng nút (v25)', () => {
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    /* Loại mặc định Cạo tìm nấm có sẵn nút "Âm tính" từ config */
    const qbtns = $('fields-container').querySelectorAll('[data-quick]');
    assert.ok(qbtns.length >= 1, 'loại Cạo tìm nấm phải có nút nhập nhanh mặc định');
    assert.strictEqual(qbtns[0].textContent, 'Âm tính');
    qbtns[0].click();
    assert.strictEqual($('fields-container').querySelector('[data-field="ketQua"]').value, 'Âm tính', 'bấm nút là điền ngay vào trường kết quả');
    assert.ok(visible($('view-form')), 'điền xong vẫn ở form nhập — không tự lưu');
    /* Soi tươi huyết trắng chưa có mẫu mặc định -> không hiện hàng nút */
    setSelect($('select-type'), 'soi-tuoi-huyet-trang');
    assert.strictEqual($('fields-container').querySelectorAll('[data-quick]').length, 0, 'loại chưa định nghĩa nút thì không hiện hàng nhập nhanh');
    /* SP: mẫu Âm tính điền Ký sinh trùng = "Âm tính" và bỏ chọn mọi chip đang chọn */
    setSelect($('select-type'), 'sp');
    $('fields-container').querySelector('[data-chip="hongCau"][data-value="(++)"]').click();
    assert.ok($('fields-container').querySelector('[data-chip="hongCau"][data-value="(++)"]').classList.contains('selected'));
    $('fields-container').querySelector('[data-quick="0"]').click();
    assert.strictEqual($('fields-container').querySelector('[data-field="kySinhTrung"]').value, 'Âm tính');
    assert.ok(!$('fields-container').querySelector('[data-chip="hongCau"]').classList.contains('selected'), 'chip phải bị bỏ chọn theo mẫu');
    $('btn-cancel').click();
  });

  test('quản lý loại: tự thêm nút nhập nhanh cho một loại (chọn mức chip trong thẻ sửa) rồi dùng được ngay trong form nhập (v25)', () => {
    document.querySelector('[data-view="manage"]').click();
    $('btn-types').click();
    const li = [...$('types-list').children].find((x) => x.querySelector('.type-name').textContent === 'Soi tươi huyết trắng');
    assert.ok(li);
    li.querySelector('[data-tedit]').click();
    assert.ok(visible($('view-typeform')));
    $('btn-tf-add-quick').click();
    const card = $('tf-quicks').querySelector('.tf-quick');
    assert.ok(card, 'phải thêm được thẻ nút nhập nhanh');
    setInput(card.querySelector('.tq-label'), 'Nấm nhẹ');
    const chipSel = card.querySelector('select.tq-val[data-qfield="nam"]');
    assert.ok(chipSel, 'trường dạng chip phải có ô chọn mức trong thẻ nút');
    setSelect(chipSel, '(+)');
    $('btn-tf-save').click();
    assert.ok(visible($('view-types')), 'lưu xong quay về danh sách loại');
    const li2 = [...$('types-list').children].find((x) => x.querySelector('.type-name').textContent === 'Soi tươi huyết trắng');
    assert.ok(li2.textContent.includes('nút nhập nhanh'), 'danh sách loại phải hiện số nút nhập nhanh của loại');
    $('btn-types-back').click();
    $('fab-add').click();
    setSelect($('select-type'), 'soi-tuoi-huyet-trang');
    const qb = $('fields-container').querySelector('[data-quick="0"]');
    assert.ok(qb && qb.textContent === 'Nấm nhẹ', 'nút vừa tạo phải hiện trong form nhập của đúng loại đó');
    qb.click();
    assert.ok($('fields-container').querySelector('[data-chip="nam"][data-value="(+)"]').classList.contains('selected'), 'bấm nút phải chọn chip Nấm ở mức (+)');
    $('btn-cancel').click();
  });

  test('tab Quản lý: đang xem khung Chờ phát hành mà quét nhận mẫu mới thì tự chuyển sang khung Chưa kết quả, mẫu mới hiện ngay (v25)', () => {
    document.querySelector('[data-view="manage"]').click();
    $('btn-panel-pending').click();
    assert.ok(!$('group-pending').classList.contains('hidden'), 'đang ở khung Chờ phát hành');
    assert.ok($('group-noresult').classList.contains('hidden'));
    $('fab-add').click();
    $('btn-scan').click();
    assert.ok(visible($('scanner-modal')), 'mở được màn hình quét từ form thêm mới');
    setSelect($('scanner-type-select'), 'cao-tim-nam');
    assert.strictEqual(window.acceptScanCode('V25-SCAN-1'), true, 'nhận mã mới phải thành công');
    $('btn-scanner-close').click();
    assert.ok(visible($('view-manage')), 'dừng quét xong quay về tab Quản lý');
    assert.ok(!$('group-noresult').classList.contains('hidden'), 'khung Chưa kết quả phải tự hiện sau khi nhận mẫu mới');
    assert.ok($('group-pending').classList.contains('hidden'), 'khung Chờ phát hành phải ẩn đi');
    assert.ok([...$('list-noresult').children].some((x) => x.textContent.includes('V25-SCAN-1')), 'mẫu vừa quét phải nằm trong danh sách Chưa kết quả');
  });

  test('bấm giờ Máu ẩn: mỗi ID một đồng hồ riêng — bắt đầu, hủy, tới giờ báo đỏ và mở thẳng form nhập', () => {
    document.querySelector('[data-view="manage"]').click();
    const addMauAn = (id) => {
      $('fab-add').click();
      setSelect($('select-type'), 'mau-an');
      setInput($('input-testid'), id);
      $('btn-save').click(); // không điền kết quả -> Chưa kết quả; lưu xong ở lại Quản lý
      assert.ok(visible($('view-manage')));
    };
    addMauAn('2611042700');
    addMauAn('2611042701');
    const findRow = (id) => [...$('list-noresult').children].find((x) => x.textContent.includes(id));
    /* Loại không có waitMinutes (SP) thì không có nút bấm giờ */
    assert.strictEqual(findRow('2611043003').querySelector('[data-action="timer"]'), null);
    const rowA = findRow('2611042700');
    const btnA = rowA.querySelector('[data-action="timer"]');
    assert.ok(btnA && btnA.textContent.includes('Bấm giờ'));
    const uidA = btnA.dataset.uid;
    btnA.click(); // bắt đầu đếm cho 2700
    const running = findRow('2611042700').querySelector('[data-action="timer"]');
    assert.ok(running.classList.contains('running'), 'đang đếm: nút chuyển trạng thái running');
    assert.ok(/^\d+:\d{2}$/.test(running.querySelector('[data-countdown]').textContent), 'hiện đếm ngược dạng phút:giây');
    /* 2701 vẫn chưa bấm — đồng hồ độc lập từng ID */
    assert.ok(findRow('2611042701').querySelector('[data-action="timer"]').textContent.includes('Bấm giờ'));
    findRow('2611042700').querySelector('[data-action="timer"]').click(); // hủy
    assert.ok(findRow('2611042700').querySelector('[data-action="timer"]').textContent.includes('Bấm giờ'), 'bấm lần nữa là hủy bấm giờ');
    /* Bấm lại rồi ép tới giờ, gọi timerTick để kiểm tra đường báo tới hạn */
    findRow('2611042700').querySelector('[data-action="timer"]').click();
    window.eval("store.update('" + uidA + "', { timerEndsAt: new Date(Date.now() - 5000).toISOString() })");
    window.timerTick();
    const dueRow = findRow('2611042700');
    assert.ok(dueRow.classList.contains('timer-due'), 'tới giờ: dòng mẫu sáng đỏ cảnh báo');
    const dueBtn = dueRow.querySelector('[data-action="timer"]');
    assert.ok(dueBtn.classList.contains('due') && dueBtn.textContent.includes('Nhập KQ ngay'));
    dueBtn.click(); // mở thẳng form nhập kết quả của chính mẫu đó
    assert.ok(visible($('view-form')));
    assert.strictEqual($('input-testid').value, '2611042700');
    setInput($('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    $('btn-save').click();
    assert.ok(visible($('view-manage')));
    const pend = [...$('list-pending').children].find((x) => x.textContent.includes('2611042700'));
    assert.ok(pend, 'nhập kết quả xong mẫu sang nhóm Chờ phát hành');
  });

  test('danh mục tự tạo: thêm loại xét nghiệm mới ngay trong app rồi nhập kết quả cho loại đó được luôn', () => {
    window.alert = () => {};
    document.querySelector('[data-view="manage"]').click();
    $('btn-types').click();
    assert.ok(visible($('view-types')));
    assert.strictEqual($('types-list').children.length, 6, 'ban đầu là 6 loại mặc định');
    $('btn-type-add').click();
    assert.ok(visible($('view-typeform')));
    const stackRow = $('btn-tf-add-field').closest('.form-row');
    assert.strictEqual(window.getComputedStyle(stackRow).flexDirection, 'column', 'hàng "Các trường kết quả" phải xếp dọc — xếp ngang chung với nhãn là nguyên nhân tràn màn hình (v20)');
    assert.strictEqual(window.getComputedStyle($('btn-tf-add-field')).borderStyle, 'dashed', 'nút thêm trường dùng nét đứt kiểu nút thêm chuẩn');
    assert.strictEqual(window.getComputedStyle($('tf-wait')).flexGrow, '1', 'ô số phút bấm giờ phải dùng cùng kiểu flex với các ô nhập khác');
    setInput($('tf-name'), 'Soi phân tìm KST');
    setInput($('tf-fields').querySelector('.tf-flabel'), 'Kết quả');
    $('btn-tf-save').click();
    assert.ok(visible($('view-types')), 'lưu xong quay về danh sách loại');
    assert.strictEqual($('types-list').children.length, 7);
    assert.ok($('types-list').textContent.includes('Soi phân tìm KST'));
    $('btn-types-back').click();
    $('fab-add').click();
    const opt = [...$('select-type').options].find((o) => o.textContent === 'Soi phân tìm KST');
    assert.ok(opt, 'loại mới phải có trong ô chọn loại của form nhập');
    setSelect($('select-type'), opt.value);
    setInput($('input-testid'), 'F1-0001');
    const resInput = $('fields-container').querySelector('[data-field]');
    assert.ok(resInput, 'loại mới có ô nhập kết quả');
    setInput(resInput, 'Âm tính');
    $('btn-save').click();
    assert.ok([...$('list-pending').children].some((x) => x.textContent.includes('F1-0001')), 'bản ghi thuộc loại tự thêm phải lưu và hiện ở Chờ phát hành');
  });

  test('danh mục tự tạo: không xóa được loại đang có bản ghi; chưa khôi phục mặc định khi còn bản ghi thuộc loại tự thêm', () => {
    document.querySelector('[data-view="manage"]').click();
    $('btn-types').click();
    const before = $('types-list').children.length;
    const spLi = [...$('types-list').children].find((li) => li.querySelector('.type-name').textContent === 'SP');
    assert.ok(spLi);
    spLi.querySelector('[data-tdel]').click(); // SP đang có nhiều bản ghi -> alert chặn
    assert.strictEqual($('types-list').children.length, before, 'loại đang có bản ghi không được bị xóa');
    $('btn-types-reset').click(); // còn F1-0001 thuộc loại tự thêm -> alert chặn
    assert.ok([...$('types-list').children].some((li) => li.querySelector('.type-name').textContent === 'Soi phân tìm KST'), 'loại tự thêm vẫn còn sau khi khôi phục mặc định bị chặn');
    assert.strictEqual(window.validateTypeDefs(window.getTestTypes()).length, 0, 'danh mục hiện hành phải hợp lệ');
    assert.ok(window.validateTypeDefs([]).length > 0, 'danh mục rỗng phải bị coi là không hợp lệ');
  });

  test('nhập giọng nói: trình duyệt không hỗ trợ thì tính năng tự ẩn + báo rõ, không văng lỗi (đường hỗ trợ cần Chrome thật)', () => {
    assert.strictEqual(typeof window.startVoiceInput, 'function');
    assert.strictEqual(window.voiceSupported(), false, 'môi trường test không có SpeechRecognition');
    document.querySelector('[data-view="today"]').click();
    $('fab-add').click();
    assert.ok(visible($('view-form')));
    assert.strictEqual(document.querySelectorAll('.mic-btn').length, 0, 'không hỗ trợ giọng nói thì không hiện nút micro nào');
    assert.strictEqual(window.startVoiceInput($('input-note'), null), false, 'gọi nhập giọng nói khi không hỗ trợ phải trả về false thay vì văng lỗi');
    $('btn-cancel').click();
  });

  test('xuất CSV + thống kê TAT: tab Lọc & Xuất hiện dòng thời gian trả kết quả; buildCsv có BOM, tách cột bằng ";", tính đúng số phút', () => {
    document.querySelector('[data-view="export"]').click();
    assert.ok($('btn-export-csv'), 'có nút Xuất CSV');
    $('btn-apply-filter').click();
    assert.ok($('export-stats').textContent.includes('Đã phát hành'), 'có dòng thống kê phát hành: ' + $('export-stats').textContent);
    assert.ok($('export-stats').textContent.includes('Thời gian trả kết quả'), 'có thống kê thời gian trả kết quả');
    assert.strictEqual(typeof window.buildCsv, 'function');
    const t0 = new Date();
    const csv = window.buildCsv([{
      testId: 'CSV-1', typeId: 'sp', results: { hongCau: '(+)' }, note: 'ghi;chu',
      createdAt: t0.toISOString(), releaseAt: new Date(t0.getTime() + 30 * 60000).toISOString(),
    }]);
    assert.strictEqual(csv.charCodeAt(0), 0xFEFF, 'CSV bắt đầu bằng BOM để Excel đọc đúng tiếng Việt');
    assert.ok(csv.includes('CSV-1'));
    assert.ok(csv.includes('Đã phát hành'));
    assert.ok(csv.includes(';30'), 'cột thời gian trả kết quả = 30 phút');
    assert.ok(csv.includes('"ghi;chu"'), 'ô chứa dấu ; phải được bọc ngoặc kép');
    $('btn-export-csv').click(); // không được văng lỗi trong môi trường test
  });

  test('gộp dữ liệu từ file: thêm mẫu chưa có, gộp lại file cũ không tạo bản sao trùng', () => {
    assert.ok($('btn-backup-merge'), 'có nút Gộp dữ liệu từ file');
    const nowIso = new Date().toISOString();
    const fileJson = JSON.stringify({
      app: 'LabEntry', version: 1, exportedAt: nowIso,
      records: [{ uid: 'mg-1', testId: 'MERGE-0001', typeId: 'sp', results: {}, note: '', releaseAt: null, timerEndsAt: null, createdAt: nowIso, updatedAt: nowIso }],
    });
    const oldConfirm = window.confirm;
    window.confirm = () => true;
    const okMerge = window.importBackupText(fileJson, 'merge');
    window.confirm = oldConfirm;
    assert.strictEqual(okMerge, true);
    document.querySelector('[data-view="today"]').click();
    assert.ok([...$('list-today').children].some((x) => x.textContent.includes('MERGE-0001')), 'mẫu mới trong file phải được gộp vào danh sách');
    const countAfterFirst = $('list-today').children.length;
    window.confirm = () => true;
    window.importBackupText(fileJson, 'merge');
    window.confirm = oldConfirm;
    document.querySelector('[data-view="today"]').click();
    assert.strictEqual($('list-today').children.length, countAfterFirst, 'gộp lại cùng một file không được tạo bản sao trùng');
  });

  test('KTV (v27): chọn KTV trực -> quét nhận đóng dấu người nhận; lưu kết quả đóng dấu người thực hiện; sửa kết quả thì người thực hiện đổi sang người trực đang sửa; phát hành đóng dấu người phát hành; hủy phát hành xóa dấu', async () => {
    /* Dựng danh sách KTV qua hộp thoại quản lý */
    document.querySelector('[data-view="today"]').click();
    $('btn-staff-manage').click();
    assert.ok(visible($('staff-modal')));
    setInput($('input-staff-name'), 'Nguyễn Văn A');
    setInput($('input-staff-pin'), '111111');
    setInput($('input-staff-pin2'), '111111');
    $('btn-staff-add').click();
    await sleep(80);
    setInput($('input-staff-name'), 'Lê Thị Bình');
    setInput($('input-staff-pin'), '222222');
    setInput($('input-staff-pin2'), '222222');
    $('btn-staff-add').click();
    await sleep(80);
    assert.strictEqual($('staff-list').children.length, 3); /* 2 người của test này + KTV Kiểm Tra dựng sẵn từ v41 */
    $('btn-staff-close').click();
    /* A trực: quét nhận một mẫu */
    setSelect($('operator-select'), 'Nguyễn Văn A');
    await nhapPinVao('111111');
    assert.strictEqual($('scanner-operator-select').value, 'Nguyễn Văn A', 'ô KTV ở màn quét phải đồng bộ với KTV trực');
    $('btn-scan-today').click();
    setSelect($('scanner-type-select'), 'cao-tim-nam');
    assert.strictEqual(window.acceptScanCode('V27-0001'), true);
    $('btn-scanner-close').click();
    const row = [...$('list-today').children].find((x) => x.textContent.includes('V27-0001'));
    assert.ok(row);
    /* Mẫu chưa có kết quả thì chưa có nút Xem — kiểm dấu người nhận qua form sửa */
    row.querySelector('[data-action="edit"]').click();
    assert.strictEqual($('input-receiver').value, 'Nguyễn Văn A', 'quét nhận phải đóng dấu KTV nhận = người trực lúc quét');
    /* Đổi sang B trực, nhập kết quả rồi lưu: người thực hiện = B */
    $('btn-cancel').click();
    setSelect($('operator-select'), 'Lê Thị Bình');
    await nhapPinVao('222222');
    row.querySelector('[data-action="edit"]').click();
    setInput($('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    assert.strictEqual($('input-performer').value, 'Lê Thị Bình', 'vừa sửa kết quả thì ô người thực hiện tự chuyển sang người trực');
    $('btn-save').click();
    /* F25: sau khi nhận mẫu, app ở tab Quản lý; sửa xong vẫn ở Quản lý — mẫu đã có kết quả nằm ở nhóm Chờ phát hành */
    const row2 = [...$('list-pending').children].find((x) => x.textContent.includes('V27-0001'));
    row2.querySelector('[data-action="view"]').click();
    assert.ok(visible($('summary-modal')));
    assert.ok(visible($('sum-staff')), 'trang Xem phải hiện khối KTV khi đã có dấu');
    assert.strictEqual($('sum-receiver').textContent, 'Nguyễn Văn A');
    assert.strictEqual($('sum-performer').textContent, 'Lê Thị Bình');
    /* B phát hành ngay trong Xem -> tự thoát (v26) + đóng dấu người phát hành = B */
    $('btn-summary-release').click();
    assert.ok(!visible($('summary-modal')), 'phát hành xong Xem tự thoát');
    document.querySelector('[data-view="today"]').click(); /* về Hôm nay để danh sách được dựng lại rồi mới mở Xem kiểm dấu */
    const row3 = [...$('list-today').children].find((x) => x.textContent.includes('V27-0001'));
    row3.querySelector('[data-action="view"]').click();
    assert.strictEqual($('sum-releaser').textContent, 'Lê Thị Bình', 'phát hành phải đóng dấu KTV phát hành = người trực lúc phát hành');
    assert.ok(visible($('btn-summary-unrelease')), 'đã phát hành thì Xem có nút Hủy phát hành');
    /* Hủy phát hành: quay về Chờ phát hành, dấu phát hành bị xóa */
    $('btn-summary-unrelease').click();
    assert.ok(!visible($('summary-modal')), 'hủy phát hành xong Xem tự thoát');
    document.querySelector('[data-view="manage"]').click();
    $('btn-panel-pending').click();
    assert.ok([...$('list-pending').children].some((x) => x.textContent.includes('V27-0001')), 'hủy phát hành xong mẫu quay về nhóm Chờ phát hành');
    /* A trực lại, sửa kết quả -> người thực hiện đổi sang A (yêu cầu của Minh) */
    document.querySelector('[data-view="today"]').click();
    setSelect($('operator-select'), 'Nguyễn Văn A');
    await nhapPinVao('111111');
    const row4 = [...$('list-today').children].find((x) => x.textContent.includes('V27-0001'));
    row4.querySelector('[data-action="edit"]').click();
    setInput($('fields-container').querySelector('[data-field="ketQua"]'), 'Có sợi nấm');
    $('btn-save').click();
    const row5 = [...$('list-today').children].find((x) => x.textContent.includes('V27-0001'));
    row5.querySelector('[data-action="view"]').click();
    assert.strictEqual($('sum-performer').textContent, 'Nguyễn Văn A', 'sửa kết quả thì KTV thực hiện phải đổi sang người trực đang sửa');
    assert.strictEqual($('sum-releaser').textContent, '—', 'dấu phát hành đã bị xóa khi hủy phát hành');
    $('btn-summary-close').click();
  });

  test('PIN của KTV (v32): đổi KTV trực phải nhập đúng PIN — sai thì báo lỗi và hủy thì không đổi; đúng mới đổi; file sao lưu không chứa PIN dạng gốc, chỉ có băm', async () => {
    document.querySelector('[data-view="today"]').click();
    assert.strictEqual($('operator-select').value, 'Nguyễn Văn A');
    /* Sai PIN: hộp thoại báo lỗi và còn mở; hủy thì KTV trực giữ nguyên */
    setSelect($('operator-select'), 'Lê Thị Bình');
    for (let i = 0; i < 60 && $('pin-modal').classList.contains('hidden'); i++) await sleep(20);
    assert.ok(!$('pin-modal').classList.contains('hidden'), 'đổi KTV trực phải hiện hộp thoại PIN');
    setInput($('pin-input'), '999999');
    $('btn-pin-ok').click();
    await sleep(100);
    assert.ok(!$('pin-modal').classList.contains('hidden'), 'sai PIN thì hộp thoại còn mở để nhập lại');
    assert.ok(visible($('pin-error')), 'sai PIN phải hiện thông báo lỗi');
    $('btn-pin-cancel').click();
    await sleep(60);
    assert.strictEqual($('operator-select').value, 'Nguyễn Văn A', 'hủy nhập PIN thì KTV trực giữ nguyên');
    /* Đúng PIN: đổi được, ô ở màn quét đồng bộ */
    setSelect($('operator-select'), 'Lê Thị Bình');
    await nhapPinVao('222222');
    assert.strictEqual($('operator-select').value, 'Lê Thị Bình');
    assert.strictEqual($('scanner-operator-select').value, 'Lê Thị Bình', 'đổi trực có PIN xong, ô ở màn quét phải đồng bộ');
    /* File sao lưu: PIN chỉ ở dạng băm, không lộ dạng gốc */
    document.querySelector('[data-view="export"]').click();
    let captured = null;
    const origDl = window.downloadTextFile;
    window.downloadTextFile = (name, text) => { captured = text; };
    $('btn-backup-export').click();
    window.downloadTextFile = origDl;
    assert.ok(captured && !captured.includes('222222') && !captured.includes('111111'), 'file sao lưu TUYỆT ĐỐI không chứa PIN dạng gốc');
    const parsedFile = JSON.parse(captured);
    const binh = parsedFile.staff.find((x) => (typeof x === 'string' ? x : x.name) === 'Lê Thị Bình');
    assert.ok(binh && typeof binh.pinHash === 'string' && binh.pinHash.length >= 16, 'danh sách KTV trong file phải mang băm PIN thay cho PIN gốc');
    /* Đổi về A để các test sau giữ nguyên trạng thái */
    document.querySelector('[data-view="today"]').click();
    setSelect($('operator-select'), 'Nguyễn Văn A');
    await nhapPinVao('111111');
    assert.strictEqual($('operator-select').value, 'Nguyễn Văn A');
  });

  test('tùy chỉnh bản in (v27): mặc định đúng 7 cột cũ; bật cột KTV thì xem trước và vùng in thật đều có; ghi tên đơn vị hiện ở đầu trang; khôi phục mặc định đưa mọi thứ về cũ', () => {
    document.querySelector('[data-view="export"]').click();
    const defHeads = [...$('print-area').querySelectorAll('thead th')].map((th) => th.textContent);
    assert.deepStrictEqual(defHeads, ['STT', 'ID Xét Nghiệm', 'Loại xét nghiệm', 'Kết quả', 'Ghi chú', 'Ngày giờ nhập', 'Ngày giờ phát hành'], 'bố cục mặc định phải y như bản in trước đây');
    $('btn-printcfg').click();
    assert.ok(visible($('view-printcfg')));
    assert.ok($('pcfg-preview').textContent.includes('2611050001'), 'xem trước phải có dữ liệu mẫu');
    assert.ok(!$('pcfg-preview').textContent.includes('KTV nhận'), 'cột KTV mặc định tắt nên chưa hiện');
    /* Bật 3 cột KTV (hàng theo thứ tự registry: receiver/performer/releaser ở cuối) */
    const colRows = $('pcfg-columns').children;
    assert.strictEqual(colRows.length, 12, 'phải có đủ 12 cột để tùy chỉnh');
    colRows[9].querySelector('.pc-visible').click();
    colRows[10].querySelector('.pc-visible').click();
    colRows[11].querySelector('.pc-visible').click();
    assert.ok($('pcfg-preview').textContent.includes('KTV nhận'), 'xem trước phải hiện cột KTV sau khi bật');
    assert.ok($('pcfg-preview').textContent.includes('Trần Văn An'), 'xem trước phải hiện tên KTV mẫu ở cột KTV');
    setInput($('pcfg-org'), 'TRUNG TÂM XÉT NGHIỆM MẪU');
    assert.ok($('pcfg-preview').textContent.includes('TRUNG TÂM XÉT NGHIỆM MẪU'), 'tên đơn vị phải hiện ở đầu trang xem trước');
    $('btn-pcfg-back').click();
    assert.ok(visible($('view-export')));
    const heads2 = [...$('print-area').querySelectorAll('thead th')].map((th) => th.textContent);
    assert.ok(heads2.includes('KTV nhận') && heads2.includes('KTV thực hiện') && heads2.includes('KTV phát hành'), 'vùng in thật phải có 3 cột KTV sau khi bật');
    assert.ok($('print-area').textContent.includes('TRUNG TÂM XÉT NGHIỆM MẪU'), 'vùng in thật phải có đầu trang đơn vị');
    /* Khôi phục mặc định */
    $('btn-printcfg').click();
    $('btn-pcfg-reset').click();
    assert.strictEqual($('pcfg-org').value, '', 'khôi phục mặc định phải xóa tên đơn vị');
    assert.ok(!$('pcfg-preview').textContent.includes('KTV nhận'), 'khôi phục mặc định phải tắt lại cột KTV');
    $('btn-pcfg-back').click();
  });

  test('ngắt trang bản in (v38): bảng có tfoot đóng khung với colspan bằng số cột; CSS khai thead/tfoot lặp và chống cắt đôi dòng', () => {
    document.querySelector('[data-view="export"]').click();
    const thCount = $('print-area').querySelectorAll('thead th').length;
    const footTd = $('print-area').querySelector('tfoot .sh-close td');
    assert.ok(footTd, 'bảng in phải có dòng tfoot đóng khung (.sh-close)');
    assert.strictEqual(Number(footTd.getAttribute('colspan')), thCount, 'colspan của dòng đóng phải bằng số cột đang in');
    const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
    assert.ok(css.includes('table-footer-group'), 'CSS phải khai tfoot lặp cuối mỗi trang');
    assert.ok(css.includes('table-header-group'), 'CSS phải khai thead lặp đầu mỗi trang');
    assert.ok(css.includes('break-inside: avoid'), 'CSS phải chống cắt đôi một dòng mẫu qua hai trang');
  });

  test('phụ đề khoảng ngày trên bản in (v39): ngày lọc yyyy-mm-dd phải in ra dd/mm/yyyy kiểu Việt Nam', () => {
    document.querySelector('[data-view="export"]').click();
    setInput($('f-from'), '2026-11-05');
    setInput($('f-to'), '2026-11-05');
    $('btn-apply-filter').click(); /* app chỉ áp lọc khi bấm nút (trước đây test đậu nhờ ngày chạy trùng ngày kỳ vọng) */
    const sub = $('print-area').querySelector('.sh-subtitle');
    assert.ok(sub, 'bản in phải có phụ đề khoảng ngày khi đã đặt lọc ngày');
    assert.strictEqual(sub.textContent, '(05/11/2026 đến 05/11/2026)');
  });

  test('bản in đợt 2 (v28): tách mỗi trường thành cột riêng + phân nhóm theo loại + sọc xen kẽ + màu nền tiêu đề đậm', () => {
    document.querySelector('[data-view="export"]').click();
    $('btn-printcfg').click();
    /* Tách cột: nhãn trường của Soi tươi và SP thành cột riêng trong xem trước */
    setSelect($('pcfg-resultsmode'), 'split');
    const heads = [...$('pcfg-preview').querySelectorAll('thead th')].map((th) => th.textContent);
    assert.ok(heads.includes('Trichomonas'), 'chế độ tách cột phải có cột Trichomonas');
    assert.ok(heads.includes('Nấm'), 'chế độ tách cột phải có cột Nấm của Soi tươi');
    assert.strictEqual(heads.filter((h) => h === 'Kết quả').length, 1, 'nhiều loại cùng có trường "Kết quả" thì gộp chung 1 cột');
    assert.ok($('pcfg-preview').textContent.includes('(+)'), 'ô Trichomonas của mẫu soi tươi hiện mức đã chọn');
    /* Phân nhóm theo loại: 3 mẫu thuộc 3 loại -> 3 dòng nhóm */
    setSelect($('pcfg-groupby'), 'type');
    const groups = $('pcfg-preview').querySelectorAll('.sh-group');
    assert.strictEqual(groups.length, 3, 'phải có 3 dòng phân nhóm theo loại');
    assert.ok([...groups].some((g) => g.textContent.includes('Soi tươi huyết trắng')));
    /* Sọc xen kẽ + màu tiêu đề */
    $('pcfg-zebra').click();
    let sheet = $('pcfg-preview').querySelector('.sheet');
    assert.ok(sheet.classList.contains('zebra'), 'bật sọc thì tờ có lớp zebra');
    assert.ok($('pcfg-preview').querySelectorAll('tbody tr.alt').length >= 1, 'phải có dòng được tô sọc');
    setSelect($('pcfg-headercolor'), '#1e88e5');
    sheet = $('pcfg-preview').querySelector('.sheet');
    assert.ok(sheet.classList.contains('hc-dark'), 'màu xanh đậm thì hàng tiêu đề chữ trắng');
    assert.ok(sheet.getAttribute('style').includes('--sh-head:#1e88e5'), 'biến màu tiêu đề phải mang màu đã chọn');
    /* Dọn về mặc định cho các test sau */
    $('btn-pcfg-reset').click();
    sheet = $('pcfg-preview').querySelector('.sheet');
    assert.ok(!sheet.classList.contains('zebra'), 'khôi phục mặc định phải tắt sọc');
    $('btn-pcfg-back').click();
  });

  test('mẫu bố cục + sao lưu kèm bố cục (v28): lưu mẫu rồi áp dụng lại được; file sao lưu mang theo bố cục, phục hồi là áp dụng', () => {
    window.prompt = () => 'Mẫu T28';
    document.querySelector('[data-view="export"]').click();
    $('btn-printcfg').click();
    setInput($('pcfg-title'), 'BANG KQ T28');
    $('btn-preset-save').click();
    assert.ok([...$('pcfg-preset').options].some((o) => o.value === 'Mẫu T28'), 'mẫu vừa lưu phải có trong danh sách mẫu');
    /* Đổi cấu hình đi chỗ khác rồi áp dụng mẫu -> quay lại đúng cấu hình đã lưu */
    $('btn-pcfg-reset').click();
    assert.strictEqual($('pcfg-title').value, 'Danh sách kết quả xét nghiệm', 'reset đưa tiêu đề về mặc định');
    setSelect($('pcfg-preset'), 'Mẫu T28');
    $('btn-preset-apply').click();
    assert.strictEqual($('pcfg-title').value, 'BANG KQ T28', 'áp dụng mẫu phải khôi phục tiêu đề đã lưu');
    /* Sao lưu: file JSON phải kèm printLayout; phục hồi file đó áp dụng luôn bố cục */
    $('btn-pcfg-back').click();
    let captured = null;
    const origDl = window.downloadTextFile;
    window.downloadTextFile = (name, text) => { captured = text; };
    $('btn-backup-export').click();
    window.downloadTextFile = origDl;
    assert.ok(captured, 'phải bắt được nội dung file sao lưu');
    const parsedFile = JSON.parse(captured);
    assert.ok(parsedFile.printLayout && parsedFile.printLayout.title === 'BANG KQ T28', 'file sao lưu phải kèm bố cục bản in');
    $('btn-printcfg').click();
    $('btn-pcfg-reset').click();
    assert.strictEqual($('pcfg-title').value, 'Danh sách kết quả xét nghiệm');
    $('btn-pcfg-back').click();
    const okImp = window.importBackupText(captured);
    assert.strictEqual(okImp, true, 'phục hồi file vừa sao lưu phải thành công');
    document.querySelector('[data-view="export"]').click();
    assert.ok($('print-area').textContent.includes('BANG KQ T28'), 'sau phục hồi, vùng in thật phải dùng bố cục trong file');
    /* Dọn bố cục về mặc định cho các test sau */
    $('btn-printcfg').click();
    $('btn-pcfg-reset').click();
    $('btn-pcfg-back').click();
  });

  test('phân nhóm theo loại (v29): mẫu cùng loại nằm xen kẽ trong danh sách vẫn gom về đúng một nhóm', () => {
    const settings = window.normalizePrintSettings(null);
    settings.groupBy = 'type';
    const now = Date.now();
    const iso = (m) => new Date(now - m * 60000).toISOString();
    const base = { note: '', releaseAt: null, receiver: '', performer: '', releaser: '', timerEndsAt: null };
    const recs = [
      Object.assign({}, base, { uid: 'g1', testId: 'G-A1', typeId: 'cao-tim-nam', results: { ketQua: 'Âm tính' }, createdAt: iso(30), updatedAt: iso(30) }),
      Object.assign({}, base, { uid: 'g2', testId: 'G-B1', typeId: 'mau-an', results: { ketQua: 'Âm tính' }, createdAt: iso(20), updatedAt: iso(20) }),
      Object.assign({}, base, { uid: 'g3', testId: 'G-A2', typeId: 'cao-tim-nam', results: {}, createdAt: iso(10), updatedAt: iso(10) }),
    ];
    const div = document.createElement('div');
    div.innerHTML = window.renderSheet(settings, recs, {});
    const groups = div.querySelectorAll('.sh-group');
    assert.strictEqual(groups.length, 2, '2 loại xen kẽ nhau phải cho đúng 2 dòng nhóm, không tách trùng');
    const dataRows = [...div.querySelectorAll('tbody tr')].filter((tr) => !tr.classList.contains('sh-group'));
    assert.deepStrictEqual(dataRows.map((tr) => tr.children[1].textContent), ['G-A1', 'G-A2', 'G-B1'], 'hai mẫu Cạo tìm nấm phải nằm cạnh nhau trong cùng một nhóm');
  });

  test('sao lưu trọn gói (v30): file kèm danh sách KTV + KTV trực + mẫu bố cục; phục hồi dùng theo file; gộp chỉ thêm phần chưa có và không đổi KTV trực', async () => {
    document.querySelector('[data-view="today"]').click();
    setSelect($('operator-select'), 'Nguyễn Văn A');
    await nhapPinVao('111111'); /* đổi trực phải qua PIN thì KTV trực mới thật sự là A (trước đây thiếu bước này mà không lộ vì test chưa từng chạy hết) */
    /* Chụp file sao lưu hiện tại (đã có 2 KTV + mẫu "Mẫu T28" từ các test trước) */
    document.querySelector('[data-view="export"]').click();
    let captured = null;
    const origDl = window.downloadTextFile;
    window.downloadTextFile = (name, text) => { captured = text; };
    $('btn-backup-export').click();
    window.downloadTextFile = origDl;
    const parsedFile = JSON.parse(captured);
    assert.ok(Array.isArray(parsedFile.staff) && parsedFile.staff.some((x) => (typeof x === 'string' ? x : x.name) === 'Lê Thị Bình'), 'file phải kèm danh sách KTV');
    assert.strictEqual(parsedFile.operator, 'Nguyễn Văn A', 'file phải kèm KTV trực đang chọn');
    assert.ok(Array.isArray(parsedFile.printPresets) && parsedFile.printPresets.some((p) => p.name === 'Mẫu T28'), 'file phải kèm thư viện mẫu bố cục');
    /* Làm lệch trạng thái máy: xóa 1 KTV, bỏ KTV trực, xóa 1 mẫu bố cục */
    const mutate = () => {
      document.querySelector('[data-view="today"]').click();
      $('btn-staff-manage').click();
      const del = $('staff-list').querySelector('[data-staff-del="Lê Thị Bình"]');
      if (del) del.click();
      $('btn-staff-close').click();
      document.querySelector('[data-view="export"]').click();
      $('btn-printcfg').click();
      if ([...$('pcfg-preset').options].some((o) => o.value === 'Mẫu T28')) {
        setSelect($('pcfg-preset'), 'Mẫu T28');
        $('btn-preset-del').click();
      }
      $('btn-pcfg-back').click();
    };
    mutate();
    document.querySelector('[data-view="today"]').click();
    $('btn-staff-manage').click();
    assert.strictEqual($('staff-list').children.length, 2, 'sau khi xóa Bình chỉ còn A và KTV Kiểm Tra (v41)');
    $('btn-staff-close').click();
    /* PHỤC HỒI: danh sách KTV + KTV trực + mẫu quay lại đúng theo file */
    assert.strictEqual(window.importBackupText(captured), true);
    assert.strictEqual($('operator-select').value, '', 'phục hồi phải đặt KTV trực về "chưa chọn" — không nhận KTV trực từ file (v34)');
    $('btn-staff-manage').click();
    assert.strictEqual($('staff-list').children.length, 3, 'phục hồi phải khôi phục đủ KTV trong file (A, Bình và KTV Kiểm Tra gieo sẵn từ v41)');
    $('btn-staff-close').click();
    document.querySelector('[data-view="export"]').click();
    $('btn-printcfg').click();
    assert.ok([...$('pcfg-preset').options].some((o) => o.value === 'Mẫu T28'), 'phục hồi phải khôi phục mẫu bố cục');
    $('btn-pcfg-back').click();
    /* GỘP: thêm lại phần thiếu nhưng KHÔNG đổi KTV trực của máy */
    mutate();
    document.querySelector('[data-view="today"]').click();
    setSelect($('operator-select'), '');
    assert.strictEqual(window.importBackupText(captured, 'merge'), true);
    assert.strictEqual($('operator-select').value, '', 'gộp dữ liệu không được đổi KTV trực của máy');
    $('btn-staff-manage').click();
    assert.strictEqual($('staff-list').children.length, 3, 'gộp phải thêm lại KTV còn thiếu (A, Bình và KTV Kiểm Tra gieo sẵn từ v41)');
    $('btn-staff-close').click();
    document.querySelector('[data-view="export"]').click();
    $('btn-printcfg').click();
    assert.ok([...$('pcfg-preset').options].some((o) => o.value === 'Mẫu T28'), 'gộp phải thêm lại mẫu bố cục còn thiếu');
    $('btn-pcfg-back').click();
    document.querySelector('[data-view="today"]').click();
    setSelect($('operator-select'), 'Nguyễn Văn A');
    await nhapPinVao('111111');
  });

  test('sao lưu kèm danh mục: file sao lưu có "types" thì phục hồi áp dụng cả danh mục của file (chạy trước test sao lưu cuối)', () => {
    const extra = { id: 'xn-file', name: 'XN Từ File', fields: [{ key: 'ketQua', label: 'Kết quả', type: 'text' }] };
    const types = window.getTestTypes().concat([extra]);
    const nowIso = new Date().toISOString();
    const fileJson = JSON.stringify({
      app: 'LabEntry', version: 1, exportedAt: nowIso, types,
      records: [{ uid: 'ft-1', testId: 'FILE-0001', typeId: 'xn-file', results: { ketQua: 'Dương tính' }, note: '', releaseAt: null, timerEndsAt: null, createdAt: nowIso, updatedAt: nowIso }],
    });
    const oldConfirm = window.confirm;
    window.confirm = () => true;
    const okImp = window.importBackupText(fileJson);
    window.confirm = oldConfirm;
    assert.strictEqual(okImp, true);
    assert.ok(window.getTestType('xn-file'), 'loại trong file sao lưu phải được áp dụng trên máy này');
    document.querySelector('[data-view="today"]').click();
    assert.ok([...$('list-today').children].some((x) => x.textContent.includes('FILE-0001')), 'bản ghi thuộc loại trong file phải hiện lên được');
  });

  test('sao lưu & phục hồi: có đủ nút ở tab Lọc & Xuất; nhập file hợp lệ thay dữ liệu và hiện lên danh sách; file hỏng bị từ chối (test này chạy cuối vì nó thay toàn bộ dữ liệu)', () => {
    document.querySelector('[data-view="export"]').click();
    assert.ok($('btn-backup-export'), 'có nút Tải file sao lưu');
    assert.ok($('btn-backup-import'), 'có nút Phục hồi từ file');
    assert.ok($('backup-file'), 'có ô chọn file sao lưu');
    assert.strictEqual(typeof window.importBackupText, 'function');
    const backupJson = JSON.stringify({
      app: 'LabEntry', kind: 'labentry-backup', version: 1, exportedAt: new Date().toISOString(),
      records: [{ uid: 'bk-uid-1', testId: 'BK-0001', typeId: 'sp', results: { hongCau: '(+)' }, note: '', releaseAt: null, timerEndsAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    });
    const oldConfirm = window.confirm;
    window.confirm = () => true;
    const okImport = window.importBackupText(backupJson);
    window.confirm = oldConfirm;
    assert.strictEqual(okImport, true, 'nhập file hợp lệ + đồng ý ghi đè -> phục hồi thành công');
    document.querySelector('[data-view="today"]').click();
    const todayRow = (id) => [...$('list-today').children].find((x) => x.textContent.includes(id));
    assert.ok(todayRow('BK-0001'), 'bản ghi vừa phục hồi phải hiện ở danh sách Hôm nay');
    assert.strictEqual(window.importBackupText('{khong phai json'), false, 'file hỏng phải bị từ chối');
    assert.ok(todayRow('BK-0001'), 'phục hồi hỏng không làm mất dữ liệu vừa phục hồi');
  });

  test('đầu trang 3 vùng + khối tài liệu + mã vạch Code128 (v40 F21)', () => {
    document.querySelector('[data-view="export"]').click();
    $('btn-printcfg').click();
    setSelect($('pcfg-header-layout'), 'grid3');
    setSelect($('pcfg-right-zone'), 'doc');
    assert.ok(!$('pcfg-doc-block').classList.contains('hidden'), 'chọn khối tài liệu thì khối chỉnh sửa phải hiện');
    assert.ok($('pcfg-logo2-block').classList.contains('hidden'), 'khối ảnh thứ hai phải ẩn khi đang chọn khối tài liệu');
    setInput($('pcfg-doc1-value'), 'BM.04/QTXN');
    setInput($('pcfg-doc2-value'), '02');
    $('pcfg-doc-barcode').click();
    let head = $('pcfg-preview').querySelector('.sh-header');
    assert.ok(head && head.classList.contains('grid3'), 'xem trước phải dùng bố cục grid3');
    const box = $('pcfg-preview').querySelector('.sh-docbox');
    assert.ok(box, 'phải có khối tài liệu ở góc phải');
    assert.ok(box.textContent.includes('Mã tài liệu') && box.textContent.includes('BM.04/QTXN'), 'khối phải hiện mã tài liệu đã nhập');
    assert.ok(box.textContent.includes('Lần ban hành') && box.textContent.includes('02'), 'khối phải hiện lần ban hành đã nhập');
    const cv = box.querySelector('canvas.sh-barcode');
    assert.ok(cv, 'phải có canvas mã vạch dưới khối');
    assert.strictEqual(cv.getAttribute('data-text'), 'BM.04/QTXN', 'mã vạch phải mã hóa đúng mã tài liệu');
    /* Bộ mã hóa Code128: 1 ký tự = start(11) + dữ liệu(11) + kiểm tra(11) + dừng(13) + 2 vùng lặng(20) = 66 module */
    assert.strictEqual(window.code128Pattern('A').length, 66);
    assert.ok(window.code128Pattern('BM.04/QTXN').length > 66);
    assert.strictEqual(window.code128Pattern(''), '');
    /* Kiểu căn giữa + vị trí logo "theo bố cục": header phải là center */
    setSelect($('pcfg-header-layout'), 'center');
    setSelect($('pcfg-logo-pos'), 'auto');
    head = $('pcfg-preview').querySelector('.sh-header');
    assert.ok(head.classList.contains('center'), 'kiểu căn giữa thì header phải mang lớp center');
    /* Chuẩn hóa cấu hình hỏng */
    const bad = window.normalizePrintSettings({ docRows: 'x', rightZone: 'zzz', headerLayout: 'grid3', logoPos: 'auto' });
    assert.strictEqual(bad.docRows.length, 5, 'docRows hỏng phải khôi phục đủ 5 dòng mặc định');
    assert.strictEqual(bad.rightZone, 'none');
    assert.strictEqual(bad.headerLayout, 'grid3');
    assert.strictEqual(bad.docRows[0].label, 'Mã tài liệu');
    /* Dọn về mặc định cho các test sau */
    setSelect($('pcfg-header-layout'), 'side');
    setSelect($('pcfg-right-zone'), 'none');
    setInput($('pcfg-doc1-value'), '');
    setInput($('pcfg-doc2-value'), '');
    if ($('pcfg-doc-barcode').checked) $('pcfg-doc-barcode').click();
  });


  test('báo động mẫu tới giờ: banner hiện kể cả ở tab khác, bấm banner mở form, nhập kết quả thì tắt (v42 F23)', () => {
    /* Tạo một mẫu rồi đặt hẹn giờ đã quá hạn ngay (qua store, như dữ liệu thật) */
    $2('fab-add').click();
    setInput2($2('input-testid'), 'TIMER-001');
    $2('btn-save').click();
    const uid = w2.eval("store.getAll().find((r) => r.testId === 'TIMER-001').uid");
    assert.ok(uid, 'phải tạo được mẫu TIMER-001');
    w2.eval("store.update('" + uid + "', { timerEndsAt: new Date(Date.now() - 60000).toISOString() })");
    /* Đang ở tab Lọc & Xuất (mẫu không hề hiển thị) mà vẫn phải báo — đúng lỗi bản cũ */
    d2.querySelector('[data-view="export"]').click();
    w2.eval('timerTick()');
    assert.ok(visible2($2('alarm-banner')), 'mẫu tới giờ phải hiện banner kể cả khi đang ở tab khác');
    assert.ok($2('alarm-banner').textContent.includes('TIMER-001'), 'banner phải ghi rõ ID mẫu tới giờ');
    /* Bấm banner -> mở form của mẫu; mẫu đang được xử lý thì banner ẩn */
    $2('alarm-banner').click();
    assert.ok(visible2($2('view-form')), 'bấm banner phải mở form nhập của mẫu tới giờ');
    w2.eval('timerTick()');
    assert.ok(!visible2($2('alarm-banner')), 'mẫu đang mở trong form thì banner phải ẩn');
    /* Nhập kết quả -> hẹn giờ tự xóa -> banner tắt hẳn */
    setInput2($2('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    $2('btn-save').click();
    w2.eval('timerTick()');
    assert.ok(!visible2($2('alarm-banner')), 'nhập kết quả xong banner phải tắt');
    d2.querySelector('[data-view="today"]').click();
  });

  test('cổng KTV trực + nhật ký kiểm toán + log mang theo sao lưu (v41 F22)', () => {
    const auditNow = () => JSON.parse(w2.localStorage.getItem('labentry.audit.v1') || '[]');
    const recsNow = () => JSON.parse(w2.localStorage.getItem('labentry.records.v1') || '[]');
    const rowOf = (id) => [...$2('list-today').children].find((x) => x.textContent.includes(id));
    assert.strictEqual($2('operator-select').value, 'KTV Nhật Ký', 'phiên riêng phải có sẵn người trực');
    /* Nhận mẫu bằng form + sửa kết quả + phát hành khi đang trực: đều vào log */
    $2('fab-add').click();
    setInput2($2('input-testid'), 'AUDIT-001');
    setInput2($2('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    $2('btn-save').click();
    assert.ok(rowOf('AUDIT-001'), 'đang trực thì thêm mẫu phải được');
    rowOf('AUDIT-001').querySelector('[data-action="edit"]').click();
    setInput2($2('fields-container').querySelector('[data-field="ketQua"]'), 'Dương tính');
    $2('btn-save').click();
    rowOf('AUDIT-001').querySelector('[data-action="release"]').click();
    let entries = auditNow().filter((e) => e.testId === 'AUDIT-001');
    assert.deepStrictEqual(entries.map((e) => e.action), ['receive', 'save', 'release'], 'log phải có đủ nhận mẫu -> sửa kết quả -> phát hành');
    assert.ok(entries.every((e) => e.actor === 'KTV Nhật Ký'), 'mọi dòng log phải ghi người trực lúc thao tác');
    assert.ok(entries[1].detail.includes('Kết quả: Âm tính → Dương tính'), 'dòng sửa kết quả phải ghi chi tiết cũ → mới, nhận: ' + entries[1].detail);
    /* Quét nhận mẫu khi đang trực */
    w2.eval("scannerState = { source: 'camera', single: false, count: 0, lastCode: '', lastAt: 0 }");
    $2('scanner-type-select').value = 'cao-tim-nam';
    assert.strictEqual(w2.acceptScanCode('AUDIT-SCAN'), true, 'đang trực thì quét nhận mẫu phải được');
    const scanEntry = auditNow().find((e) => e.testId === 'AUDIT-SCAN');
    assert.ok(scanEntry && scanEntry.action === 'receive' && scanEntry.actor === 'KTV Nhật Ký', 'quét nhận mẫu phải vào log');
    /* Xóa mẫu khi đang trực: vào log kèm nội dung đã xóa */
    $2('fab-add').click();
    setInput2($2('input-testid'), 'AUDIT-DEL');
    setInput2($2('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    $2('btn-save').click();
    rowOf('AUDIT-DEL').querySelector('[data-action="delete"]').click();
    assert.ok(!recsNow().some((r) => r.testId === 'AUDIT-DEL'), 'đang trực thì xóa phải được');
    const delEntry = auditNow().find((e) => e.testId === 'AUDIT-DEL' && e.action === 'delete');
    assert.ok(delEntry && delEntry.detail.includes('Kết quả: Âm tính'), 'dòng xóa phải kèm nội dung kết quả đã xóa');
    /* Mẫu thứ hai để dành kiểm tra cổng lúc không có người trực */
    $2('fab-add').click();
    setInput2($2('input-testid'), 'AUDIT-002');
    setInput2($2('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    $2('btn-save').click();
    assert.ok(rowOf('AUDIT-002'));
    /* Trang xem nhật ký */
    d2.querySelector('[data-view="manage"]').click();
    $2('btn-audit').click();
    assert.ok(visible2($2('view-audit')), 'nút Nhật ký phải mở được trang nhật ký');
    assert.ok($2('audit-list').textContent.includes('AUDIT-001') && $2('audit-list').textContent.includes('Phát hành'));
    $2('btn-audit-back').click();
    /* Sao lưu: file xuất phải kèm auditLog */
    const obj = w2.exportBackupFile();
    assert.ok(Array.isArray(obj.auditLog) && obj.auditLog.some((e) => e.testId === 'AUDIT-001'), 'file sao lưu xuất ra phải mang theo nhật ký');
    /* Phục hồi: log bị thay bằng log trong file + thêm dòng restore; KTV trực đặt lại chưa chọn */
    const fake1 = { id: 'fake-1', at: new Date().toISOString(), action: 'receive', actor: 'Người Cũ', testId: 'FAKE-001', typeId: '', detail: 'dòng giả trong file' };
    assert.strictEqual(w2.importBackupText(JSON.stringify(Object.assign({}, obj, { auditLog: [fake1] })), 'replace'), true);
    entries = auditNow();
    assert.ok(entries.some((e) => e.id === 'fake-1'), 'phục hồi phải lấy nhật ký trong file');
    assert.ok(!entries.some((e) => e.testId === 'AUDIT-001'), 'phục hồi phải thay hẳn nhật ký cũ');
    assert.ok(entries.some((e) => e.action === 'restore'), 'phục hồi phải tự ghi dòng restore');
    assert.strictEqual($2('operator-select').value, '', 'phục hồi xong KTV trực phải về chưa chọn');
    /* Gộp: hợp nhất theo id, gộp lại không trùng */
    const fake2 = { id: 'fake-2', at: new Date().toISOString(), action: 'delete', actor: 'Người Cũ', testId: 'FAKE-002', typeId: '', detail: 'dòng giả 2' };
    const mergeJson = JSON.stringify({ app: 'LabEntry', kind: 'labentry-backup', version: 1, exportedAt: new Date().toISOString(), records: [], auditLog: [fake2] });
    assert.strictEqual(w2.importBackupText(mergeJson, 'merge'), true);
    assert.strictEqual(w2.importBackupText(mergeJson, 'merge'), true);
    entries = auditNow();
    assert.strictEqual(entries.filter((e) => e.id === 'fake-2').length, 1, 'gộp hai lần cùng một file không được trùng dòng log');
    assert.ok(entries.some((e) => e.id === 'fake-1') && entries.some((e) => e.action === 'merge'), 'gộp phải giữ log cũ và ghi dòng merge');
    /* CỔNG: đang không có người trực — lưu form, phát hành, xóa, quét đều bị chặn và không ghi log */
    const logLenBefore = auditNow().length;
    d2.querySelector('[data-view="today"]').click();
    const row1 = rowOf('AUDIT-001');
    assert.ok(row1, 'mẫu AUDIT-001 phải còn sau phục hồi');
    row1.querySelector('[data-action="edit"]').click();
    $2('btn-save').click();
    assert.ok(visible2($2('view-form')), 'chưa có người trực: lưu form phải bị chặn, không rời form');
    assert.ok($2('form-error').textContent.includes('Chưa chọn KTV trực'), 'phải báo rõ lý do chưa chọn KTV trực');
    d2.querySelector('[data-view="today"]').click();
    const row2 = rowOf('AUDIT-002');
    row2.querySelector('[data-action="release"]').click();
    assert.strictEqual(recsNow().find((r) => r.testId === 'AUDIT-002').releaseAt, null, 'chưa có người trực: phát hành phải bị chặn');
    row2.querySelector('[data-action="delete"]').click();
    assert.ok(recsNow().some((r) => r.testId === 'AUDIT-002'), 'chưa có người trực: xóa phải bị chặn');
    assert.strictEqual(w2.acceptScanCode('AUDIT-003'), false, 'chưa có người trực: quét nhận mẫu phải bị chặn');
    assert.ok(!recsNow().some((r) => r.testId === 'AUDIT-003'), 'mẫu bị chặn không được tạo');
    assert.strictEqual(auditNow().length, logLenBefore, 'thao tác bị chặn không được ghi log');
    w2.close();
  });

  test('gói ca trực F24: nhắc sao lưu, mẫu khẩn, bàn giao ca, tự khóa, đọc to, quét tìm (v43)', () => {
    const recs3 = () => JSON.parse(w3.localStorage.getItem('labentry.records.v1') || '[]');
    const rowOf3 = (id) => [...$3('list-today').children].find((x) => x.textContent.includes(id));
    assert.strictEqual($3('operator-select').value, 'KTV V43', 'phiên F24 phải có sẵn người trực');

    /* --- 1) Nhắc sao lưu: chưa có dữ liệu thì không nhắc; có dữ liệu + chưa từng sao lưu thì nhắc --- */
    w3.eval('renderBackupNag()');
    assert.ok(!visible3($3('backup-banner')), 'chưa có bản ghi nào thì không hiện thanh nhắc sao lưu');
    $3('fab-add').click();
    setInput3($3('input-testid'), 'V43-BK1');
    $3('btn-save').click();
    w3.eval('renderBackupNag()');
    assert.ok(visible3($3('backup-banner')), 'có dữ liệu mà chưa từng sao lưu thì phải nhắc');
    assert.ok($3('backup-banner-text').textContent.includes('Chưa từng sao lưu'));
    assert.ok($3('backup-last').textContent.includes('chưa từng xuất file sao lưu'), 'thẻ sao lưu phải báo chưa từng sao lưu');
    /* Xuất sao lưu -> tắt nhắc + ghi lần sao lưu gần nhất */
    w3.eval('exportBackupFile()');
    assert.ok(!visible3($3('backup-banner')), 'vừa sao lưu xong thì thanh nhắc phải tắt');
    assert.ok($3('backup-last').textContent.includes('Sao lưu gần nhất'), 'thẻ sao lưu phải hiện lần sao lưu gần nhất');
    const meta1 = JSON.parse(w3.localStorage.getItem('labentry.meta.v1'));
    assert.ok(meta1 && typeof meta1.lastBackupAt === 'string', 'meta phải lưu lastBackupAt sau khi xuất sao lưu');
    /* Giả lập đã 4 ngày chưa sao lưu -> nhắc lại; bấm "Để mai nhắc lại" -> ẩn trong hôm nay */
    w3.eval("appMeta.lastBackupAt = new Date(Date.now() - 4 * 86400000).toISOString(); saveMeta(); renderBackupNag();");
    assert.ok(visible3($3('backup-banner')), 'quá 3 ngày chưa sao lưu thì phải nhắc lại');
    assert.ok($3('backup-banner-text').textContent.includes('4 ngày'));
    $3('btn-backup-later').click();
    assert.ok(!visible3($3('backup-banner')), 'bấm "Để mai nhắc lại" thì ẩn trong hôm nay');
    w3.eval("appMeta.backupNagUntil = ''; appMeta.lastBackupAt = new Date().toISOString(); saveMeta(); lastNagRendered = null; renderBackupNag();");
    assert.ok(!visible3($3('backup-banner')), 'mới sao lưu hôm nay thì không nhắc');

    /* --- 4) Mẫu khẩn: lưu cờ qua form, nhãn KHẨN; thứ tự theo tiếp nhận (v50: khẩn không nhảy đầu) --- */
    $3('fab-add').click();
    setInput3($3('input-testid'), 'V43-THUONG');
    $3('btn-save').click();
    $3('fab-add').click();
    setInput3($3('input-testid'), 'V43-KHAN');
    $3('input-urgent').click();
    setInput3($3('fields-container').querySelector('[data-field="ketQua"]'), 'Âm tính');
    $3('btn-save').click();
    assert.strictEqual(recs3().find((r) => r.testId === 'V43-KHAN').urgent, true, 'ô tích khẩn trong form phải lưu cờ urgent');
    assert.strictEqual(recs3().find((r) => r.testId === 'V43-THUONG').urgent, false);
    const idsToday = [...$3('list-today').children].map((x) => x.textContent);
    const iThuong = idsToday.findIndex((t) => t.includes('V43-THUONG'));
    const iKhan = idsToday.findIndex((t) => t.includes('V43-KHAN'));
    assert.ok(iThuong >= 0 && iKhan > iThuong, 'v50: danh sách Hôm nay theo thứ tự tiếp nhận — mẫu khẩn nhận sau phải xếp sau mẫu thường nhận trước, không nhảy lên đầu');
    assert.ok(idsToday[iKhan].includes('KHẨN'), 'dòng mẫu khẩn phải có nhãn KHẨN');
    assert.ok(rowOf3('V43-KHAN').className.includes('urgent'), 'dòng mẫu khẩn phải có lớp urgent (viền/nền đỏ)');
    /* Trang Xem hiện nhãn KHẨN */
    rowOf3('V43-KHAN').querySelector('[data-action="view"]').click();
    assert.ok(visible3($3('summary-modal')));
    assert.ok(!$3('sum-urgent').classList.contains('hidden'), 'trang Xem phải hiện nhãn KHẨN cho mẫu khẩn');
    $3('btn-summary-close').click();
    /* Bỏ khẩn qua form -> nhật ký ghi nhận thay đổi cờ */
    rowOf3('V43-KHAN').querySelector('[data-action="edit"]').click();
    assert.strictEqual($3('input-urgent').checked, true, 'mở form sửa phải tích sẵn ô khẩn theo dữ liệu');
    $3('input-urgent').click();
    $3('btn-save').click();
    assert.strictEqual(recs3().find((r) => r.testId === 'V43-KHAN').urgent, false, 'bỏ tích trong form phải tắt cờ khẩn');
    const audit3 = () => JSON.parse(w3.localStorage.getItem('labentry.audit.v1') || '[]');
    assert.ok(audit3().some((e) => e.testId === 'V43-KHAN' && e.action === 'save' && e.detail.includes('Mẫu khẩn: Có → Không')), 'đổi cờ khẩn phải vào nhật ký');
    /* Bật lại khẩn để các bước sau (bàn giao) kiểm chứng nhãn + nhóm */
    w3.eval("store.update(store.getAll().find((r) => r.testId === 'V43-KHAN').uid, { urgent: true })");
    w3.eval('renderToday()');

    /* --- 3) Bàn giao ca: gồm cả mẫu tồn từ hôm qua, khẩn đầu nhóm, nội dung chữ đầy đủ --- */
    w3.eval("store.add({ testId: 'V43-TON', typeId: 'cao-tim-nam', results: {} }, new Date(Date.now() - 26 * 3600000))");
    d3.querySelector('[data-view="manage"]').click();
    $3('btn-handover').click();
    assert.ok(visible3($3('view-handover')), 'nút Bàn giao ca phải mở trang bàn giao');
    assert.ok($3('handover-counts').textContent.includes('Tổng bàn giao: 4'), 'bàn giao phải đếm đủ 4 mẫu chưa xong, nhận: ' + $3('handover-counts').textContent);
    const nrIds = [...$3('handover-list-noresult').children].map((x) => x.textContent);
    assert.strictEqual(nrIds.length, 3, 'nhóm Chưa kết quả phải có 3 mẫu (BK1, THUONG, TON)');
    assert.ok(nrIds[0].includes('V43-KHAN') === false && nrIds.every((t) => !t.includes('V43-KHAN')), 'mẫu đã có kết quả không nằm ở nhóm Chưa kết quả');
    const pendIds = [...$3('handover-list-pending').children].map((x) => x.textContent);
    assert.strictEqual(pendIds.length, 1, 'nhóm Chờ phát hành phải có 1 mẫu');
    assert.ok(pendIds[0].includes('V43-KHAN') && pendIds[0].includes('KHẨN'), 'mẫu khẩn phải ở nhóm Chờ phát hành kèm nhãn KHẨN');
    const htext = $3('handover-text').value;
    ['V43-BK1', 'V43-THUONG', 'V43-TON', 'V43-KHAN', 'BÀN GIAO CA', 'CHƯA KẾT QUẢ (3)', 'CHỜ PHÁT HÀNH (1)', '🔴 KHẨN'].forEach((s) =>
      assert.ok(htext.includes(s), 'nội dung bàn giao dạng chữ phải chứa: ' + s));
    $3('btn-handover-print').click(); /* không được văng lỗi dù jsdom không in thật */
    $3('btn-handover-back').click();
    assert.ok(visible3($3('view-manage')), 'quay lại từ bàn giao phải về tab Quản lý');

    /* --- 5) Tự khóa KTV trực: quá hạn không thao tác thì khóa + ghi log; đang mở hộp thoại thì không khóa --- */
    d3.querySelector('[data-view="today"]').click();
    w3.eval('appMeta.autoLockMin = 1; saveMeta(); lastActivityAt = Date.now() - 2 * 60000; timerTick();');
    assert.strictEqual($3('operator-select').value, '', 'quá 1 phút không thao tác (ngưỡng đặt 1 phút) thì KTV trực phải bị tự khóa');
    assert.ok(audit3().some((e) => e.action === 'operator' && e.detail.includes('Tự khóa người trực')), 'tự khóa phải ghi nhật ký operator');
    w3.eval("setOperator('KTV V43'); openSummary(store.getAll().find((r) => r.testId === 'V43-KHAN').uid); lastActivityAt = Date.now() - 2 * 60000; timerTick();");
    assert.strictEqual($3('operator-select').value, 'KTV V43', 'đang mở hộp thoại Xem thì không được tự khóa giữa chừng');
    w3.eval('closeSummary(); appMeta.autoLockMin = 10; saveMeta(); lastActivityAt = Date.now();');

    /* --- 6) Đọc to mã mẫu khi tới giờ --- */
    const spoken = [];
    Object.defineProperty(w3, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak(u) { spoken.push(u.text); } },
    });
    w3.SpeechSynthesisUtterance = function (t) { this.text = t; };
    $3('chk-speak-due').click();
    assert.strictEqual(JSON.parse(w3.localStorage.getItem('labentry.meta.v1')).speakDue, true, 'bật công tắc đọc to phải lưu vào meta');
    const docUid = w3.eval("store.add({ testId: 'V43-DOC', typeId: 'mau-an', results: {} }).record.uid");
    w3.eval("store.update('" + docUid + "', { timerEndsAt: new Date(Date.now() - 30000).toISOString() })");
    w3.eval('timerTick()');
    assert.ok(spoken.some((t) => t.includes('V43-DOC')), 'mẫu tới giờ phải được đọc to mã, đã đọc: ' + JSON.stringify(spoken));
    const spokenCount = spoken.length;
    w3.eval('timerTick()');
    assert.strictEqual(spoken.length, spokenCount, 'cùng một đợt hẹn giờ chỉ đọc một lần');

    /* --- 7) Quét tìm mẫu: thấy thì mở đúng mẫu, không thấy thì báo lỗi và giữ quét mở --- */
    $3('btn-scan-find').click();
    assert.ok(visible3($3('scanner-modal')), 'nút quét ở Quản lý phải mở màn hình quét');
    assert.ok($3('scanner-title').textContent.includes('Quét tìm mẫu'));
    assert.strictEqual(w3.acceptScanCode('V43-THUONG'), true, 'quét đúng ID đang có phải nhận');
    assert.ok(!visible3($3('scanner-modal')), 'tìm thấy mẫu thì màn hình quét phải đóng');
    assert.ok(visible3($3('view-form')), 'mẫu chưa có kết quả: quét tìm phải mở form nhập');
    assert.strictEqual($3('input-testid').value, 'V43-THUONG', 'form mở ra phải đúng mẫu vừa quét');
    d3.querySelector('[data-view="manage"]').click();
    $3('btn-scan-find').click();
    assert.strictEqual(w3.acceptScanCode('V43-KHAN'), true);
    assert.ok(visible3($3('summary-modal')), 'mẫu đã có kết quả: quét tìm phải mở trang Xem');
    $3('btn-summary-close').click();
    $3('btn-scan-find').click();
    assert.strictEqual(w3.acceptScanCode('KHONG-CO-123'), false, 'quét ID không có phải bị từ chối');
    assert.ok(visible3($3('scanner-modal')), 'không tìm thấy thì màn hình quét phải còn mở để quét lại');
    assert.ok($3('scanner-msg').textContent.includes('Không tìm thấy mẫu'), 'phải báo rõ không tìm thấy');
    $3('btn-scanner-close').click();
    /* dom3 được đóng ở cuối test F25 (v45) ngay bên dưới */
  });

  test('nhắc qua Lịch + nhận mẫu mới tự chuyển tab Quản lý (v45 F25)', () => {
    /* Trạng thái thừa hưởng từ test F24: người trực KTV V43 đang chọn */
    d3.querySelector('[data-view="today"]').click();
    /* Thêm mẫu Máu ẩn qua form từ tab Hôm nay -> lưu xong rơi vào Quản lý, khung Chưa kết quả */
    $3('fab-add').click();
    setSelect3($3('select-type'), 'mau-an');
    setInput3($3('input-testid'), 'V44-LICH');
    $3('btn-save').click();
    assert.ok(visible3($3('view-manage')), 'thêm mẫu mới từ tab Hôm nay: lưu xong phải ở tab Quản lý');
    assert.ok(visible3($3('group-noresult')), 'phải mở khung Chưa kết quả');
    const rowOfM = () => [...$3('list-noresult').children].find((x) => x.textContent.includes('V44-LICH'));
    assert.ok(rowOfM(), 'mẫu mới phải nằm trong nhóm Chưa kết quả');
    /* Chưa bấm giờ -> không có nút nhắc Lịch; bấm giờ -> nút xuất hiện */
    assert.ok(!rowOfM().querySelector('[data-action="calremind"]'), 'chưa bấm giờ thì không có nút nhắc Lịch');
    rowOfM().querySelector('[data-action="timer"]').click();
    const calBtn = rowOfM().querySelector('[data-action="calremind"]');
    assert.ok(calBtn, 'đang đếm ngược thì phải có nút 🔔 Lịch');
    /* Nội dung .ics: DTSTART đúng mốc hẹn giờ theo UTC, có VALARM tại giờ, UID theo uid bản ghi */
    const rec = JSON.parse(w3.localStorage.getItem('labentry.records.v1')).find((r) => r.testId === 'V44-LICH');
    assert.ok(rec.timerEndsAt, 'mẫu phải đang có hẹn giờ');
    const ics = w3.eval("buildCalendarIcs(store.getAll().find((r) => r.testId === 'V44-LICH'))");
    const expectStart = w3.eval("icsUtc('" + rec.timerEndsAt + "')");
    assert.ok(ics.includes('DTSTART:' + expectStart), 'DTSTART phải đúng timerEndsAt theo UTC, nhận: ' + expectStart);
    assert.ok(ics.includes('BEGIN:VALARM') && ics.includes('TRIGGER:-PT0M'), '.ics phải có chuông báo đúng thời điểm tới giờ');
    assert.ok(ics.includes('SUMMARY:') && ics.includes('V44-LICH'), '.ics phải ghi rõ ID mẫu');
    assert.ok(ics.includes('UID:' + rec.uid + '-'), 'UID phải bắt đầu bằng uid của bản ghi');
    calBtn.click(); /* bấm tải file: môi trường test nuốt phần tải, chỉ cần không văng lỗi */
    /* v45: sau khi tải, hướng dẫn cài lịch hiện bằng hộp thoại CỐ ĐỊNH (không phải toast tự tắt) */
    assert.ok(visible3($3('cal-guide-modal')), 'bấm nút Lịch xong phải hiện hộp thoại hướng dẫn và giữ nguyên');
    assert.strictEqual($3('cal-guide-id').textContent, 'V44-LICH', 'hộp thoại phải ghi đúng ID mẫu');
    assert.ok($3('cal-guide-file').textContent.includes('labentry-nhac-V44-LICH.ics'), 'hộp thoại phải ghi tên file cần mở');
    $3('btn-cal-guide-close').click();
    assert.ok(!visible3($3('cal-guide-modal')), 'chỉ đóng khi người dùng bấm nút Đóng');
    /* v45: cổng thiết bị — di động thì có nhắc Lịch, PC (UA để bàn của phiên chính) thì không */
    assert.strictEqual(w3.eval('calRemindAvailable()'), true, 'UA Android phải được tính là di động');
    assert.strictEqual(window.eval('calRemindAvailable()'), false, 'UA để bàn (PC) thì tính năng nhắc Lịch phải tắt');
    /* Hủy bấm giờ -> nút Lịch biến mất */
    rowOfM().querySelector('[data-action="timer"]').click();
    assert.ok(!rowOfM().querySelector('[data-action="calremind"]'), 'hủy bấm giờ thì nút nhắc Lịch phải mất');
    /* Quét nhận mẫu từ tab Hôm nay -> đóng phiên là ở Quản lý (trước F25: ở lại tab Hôm nay) */
    d3.querySelector('[data-view="today"]').click();
    $3('btn-scan-today').click();
    assert.ok(visible3($3('scanner-modal')));
    $3('scanner-type-select').value = 'cao-tim-nam';
    assert.strictEqual(w3.acceptScanCode('V44-QUET'), true);
    $3('btn-scanner-close').click();
    assert.ok(visible3($3('view-manage')), 'quét nhận mẫu từ tab Hôm nay: đóng phiên phải ở tab Quản lý');
    assert.ok(visible3($3('group-noresult')), 'khung Chưa kết quả phải đang mở');
    assert.ok([...$3('list-noresult').children].some((x) => x.textContent.includes('V44-QUET')), 'mẫu quét phải nằm trong nhóm Chưa kết quả');
    w3.close();
  });

  test('báo thức native trong vỏ app: đồng bộ đúng danh sách đang đếm giờ — Android (v46 F26) + iOS (v47)', async () => {
    /* Phiên riêng dom4: gieo KTV + người trực; cầu nối LabAlarmNative là stub ghi lại lời gọi */
    const dom4 = new JSDOM(htmlText, {
      url: 'file://' + htmlPath,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        shimStorage(w, {
          'labentry.staff.v1': JSON.stringify([{ name: 'KTV V46', salt: 's', pinHash: 'h' }]),
          'labentry.operator.v1': 'KTV V46',
        });
      },
    });
    const w4 = dom4.window;
    const d4 = w4.document;
    const $4 = (id) => d4.getElementById(id);
    await new Promise((res) => w4.addEventListener('load', res));
    /* Chưa có cầu nối (như trên trình duyệt): gọi đồng bộ không được văng lỗi */
    w4.eval('syncNativeAlarms()');
    const calls = [];
    let confirmCount = 0;
    w4.confirm = () => { confirmCount++; return false; };
    w4.LabAlarmNative = {
      syncAll(json) { calls.push(json); return w4.__alarmMode || 'OK'; },
      openExactAlarmSettings() { calls.push('OPEN_SETTINGS'); },
    };
    const uid = w4.eval("store.add({ testId: 'V46-APK', typeId: 'mau-an', results: {}, receiver: 'KTV V46' }).record.uid");
    w4.eval('toggleTimer("' + uid + '")');
    assert.ok(calls.length >= 1, 'bấm giờ phải gọi sang cầu nối native');
    let payload = JSON.parse(calls[calls.length - 1]);
    assert.strictEqual(payload.length, 1, 'phải có đúng 1 mẫu đang đếm giờ');
    assert.strictEqual(payload[0].id, uid, 'báo thức phải gắn đúng uid bản ghi');
    assert.ok(payload[0].at > Date.now() && payload[0].at <= Date.now() + 21 * 60000, 'mốc báo phải là timerEndsAt trong tương lai');
    assert.ok(payload[0].label.includes('V46-APK') && payload[0].label.includes('Máu ẩn'), 'nhãn báo thức phải có ID mẫu + tên xét nghiệm');
    /* Hủy bấm giờ -> danh sách gửi sang native rỗng */
    w4.eval('toggleTimer("' + uid + '")');
    payload = JSON.parse(calls[calls.length - 1]);
    assert.strictEqual(payload.length, 0, 'hủy bấm giờ thì native không còn báo thức nào');
    /* Bấm giờ lại rồi nhập kết quả qua form -> mẫu có kết quả không còn trong danh sách báo */
    w4.eval('toggleTimer("' + uid + '")');
    payload = JSON.parse(calls[calls.length - 1]);
    assert.strictEqual(payload.length, 1);
    w4.eval('openForm("' + uid + '")');
    w4.eval('formState.results = { ketQua: "Âm tính" }');
    $4('btn-save').click();
    payload = JSON.parse(calls[calls.length - 1]);
    assert.strictEqual(payload.length, 0, 'nhập kết quả xong thì báo thức native phải được hủy');
    /* NO_EXACT: hỏi mở Cài đặt đúng 1 lần trong phiên */
    const uid2 = w4.eval("store.add({ testId: 'V46-EXACT', typeId: 'mau-an', results: {}, receiver: 'KTV V46' }).record.uid");
    w4.__alarmMode = 'NO_EXACT';
    w4.eval('toggleTimer("' + uid2 + '")');
    assert.strictEqual(confirmCount, 1, 'thiếu quyền báo chính xác: phải hỏi người dùng 1 lần');
    w4.eval('syncNativeAlarms()');
    assert.strictEqual(confirmCount, 1, 'đã hỏi rồi thì không hỏi lại trong cùng phiên');
    /* v47 — đường iOS: gỡ cầu nối Android, gắn webkit.messageHandlers.labAlarm (stub ghi lời gọi).
       Danh sách gửi sang iOS phải giống hệt danh sách của Android, qua postMessage một chiều. */
    const androidCallsBefore = calls.length;
    w4.eval('window.LabAlarmNative = undefined');
    const iosCalls = [];
    w4.webkit = { messageHandlers: { labAlarm: { postMessage(json) { iosCalls.push(json); } } } };
    const uid3 = w4.eval("store.add({ testId: 'V47-IOS', typeId: 'mau-an', results: {}, receiver: 'KTV V46' }).record.uid");
    w4.eval('toggleTimer("' + uid3 + '")');
    assert.strictEqual(calls.length, androidCallsBefore, 'đường iOS không được gọi cầu nối Android');
    assert.ok(iosCalls.length >= 1, 'bấm giờ trong vỏ iOS phải postMessage sang native');
    let iosPayload = JSON.parse(iosCalls[iosCalls.length - 1]);
    const mine = iosPayload.filter((p) => p.id === uid3);
    assert.strictEqual(mine.length, 1, 'danh sách iOS phải chứa mẫu vừa bấm giờ');
    assert.ok(mine[0].at > Date.now() && mine[0].label.includes('V47-IOS') && mine[0].label.includes('Máu ẩn'),
      'phần tử iOS phải có mốc giờ tương lai + nhãn ID — tên xét nghiệm');
    /* Hủy bấm giờ -> phần tử biến mất khỏi danh sách iOS */
    w4.eval('toggleTimer("' + uid3 + '")');
    iosPayload = JSON.parse(iosCalls[iosCalls.length - 1]);
    assert.ok(!iosPayload.some((p) => p.id === uid3), 'hủy bấm giờ thì iOS phải hủy thông báo tương ứng');
    w4.close();
  });

  test('nhập kết quả theo lô: đúng thứ tự nhận mẫu; bảng (PC) + thẻ (điện thoại) cùng lưu đúng (v49 F27)', async () => {
    /* Phiên riêng dom5: gieo KTV + người trực */
    const dom5 = new JSDOM(htmlText, {
      url: 'file://' + htmlPath,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        shimStorage(w, {
          'labentry.staff.v1': JSON.stringify([{ name: 'KTV Lô', salt: 's', pinHash: 'h' }]),
          'labentry.operator.v1': 'KTV Lô',
        });
      },
    });
    const w5 = dom5.window;
    const d5 = w5.document;
    const $5 = (id) => d5.getElementById(id);
    await new Promise((res) => w5.addEventListener('load', res));
    const now = Date.now();
    /* Thêm ngược thứ tự nhận: XN-L01 thêm trước nhưng giờ nhận SAU XN-L02.
       Lô phải xếp theo giờ nhận (nhận trước nhập trước), không theo thứ tự thêm. */
    const u1 = w5.eval("store.add({ testId: 'XN-L01', typeId: 'mau-an', results: {} }, new Date(" + (now - 10 * 60000) + ")).record.uid");
    const u2 = w5.eval("store.add({ testId: 'XN-L02', typeId: 'mau-an', results: {} }, new Date(" + (now - 20 * 60000) + ")).record.uid");
    w5.eval("store.add({ testId: 'XN-L03', typeId: 'mau-an', results: {} }, new Date(" + (now - 5 * 60000) + "))");
    const u4 = w5.eval("store.add({ testId: 'XN-L04', typeId: 'soi-tuoi-huyet-trang', results: {}, urgent: true }, new Date(" + (now - 8 * 60000) + ")).record.uid");
    w5.eval("store.add({ testId: 'XN-L00', typeId: 'mau-an', results: { ketQua: 'Âm tính' } }, new Date(" + (now - 30 * 60000) + "))");
    /* Mở lô: mặc định loại Máu ẩn (3 mẫu chờ > 1 của Soi tươi) */
    w5.eval('openBatch()');
    assert.ok(!$5('view-batch').classList.contains('hidden'), 'màn hình lô phải hiện');
    assert.strictEqual(w5.eval('batchState.typeId'), 'mau-an', 'mặc định phải chọn loại nhiều mẫu chờ nhất');
    assert.deepStrictEqual([...d5.querySelectorAll('#batch-grid-wrap .bid')].map((e) => e.textContent),
      ['XN-L02', 'XN-L01', 'XN-L03'],
      'thứ tự lô phải theo giờ nhận (kèm mẫu đã có kết quả XN-L00 không được xuất hiện)');
    /* Dạng bảng: gõ kết quả cho XN-L02 rồi lưu */
    const inp = d5.querySelector('[data-btext="' + u2 + '|ketQua"]');
    inp.value = 'Âm tính';
    inp.dispatchEvent(new w5.Event('input', { bubbles: true }));
    $5('btn-batch-save').click();
    assert.strictEqual(w5.eval('store.statusOf(store.getByUid("' + u2 + '"))'), 'pending-release',
      'lưu lô xong mẫu phải chuyển chờ phát hành');
    assert.strictEqual(w5.eval('store.getByUid("' + u2 + '").performer'), 'KTV Lô',
      'lưu lô phải đóng dấu KTV thực hiện = người trực');
    assert.ok(w5.eval('auditLog.some((e) => e.action === "save" && e.testId === "XN-L02")'),
      'lưu lô phải ghi nhật ký save cho mẫu');
    assert.deepStrictEqual([...d5.querySelectorAll('#batch-grid-wrap .bid')].map((e) => e.textContent),
      ['XN-L01', 'XN-L03'], 'mẫu đã lưu phải rời khỏi lô');
    /* Đổi sang Soi tươi: chọn chips một ô, ô khác chọn rồi xóa bằng "Âm tính cả cột" */
    $5('batch-type').value = 'soi-tuoi-huyet-trang';
    $5('batch-type').dispatchEvent(new w5.Event('change', { bubbles: true }));
    d5.querySelector('[data-bchip="' + u4 + '|nam|(++)"]').click();
    d5.querySelector('[data-bchip="' + u4 + '|trichomonas|(+)"]').click();
    d5.querySelector('[data-bcol="trichomonas"]').click();
    $5('btn-batch-save').click();
    const rec4 = w5.eval('store.getByUid("' + u4 + '")');
    assert.strictEqual(rec4.results.nam, '(++)', 'ô chips đã chọn phải được lưu');
    assert.ok(!rec4.results.trichomonas, '"Âm tính cả cột" phải xóa giá trị của cột');
    assert.strictEqual(w5.eval('store.statusOf(store.getByUid("' + u4 + '"))'), 'pending-release');
    /* Dạng thẻ ở bề rộng điện thoại: quay lại Máu ẩn, ép bề rộng 400px */
    $5('batch-type').value = 'mau-an';
    $5('batch-type').dispatchEvent(new w5.Event('change', { bubbles: true }));
    Object.defineProperty(w5, 'innerWidth', { value: 400, configurable: true });
    w5.eval('renderBatch()');
    assert.ok(!$5('batch-card-wrap').classList.contains('hidden'), 'màn hình hẹp phải hiện dạng thẻ');
    assert.ok($5('batch-grid-wrap').classList.contains('hidden'), 'màn hình hẹp không hiện dạng bảng');
    assert.deepStrictEqual([...d5.querySelectorAll('[data-bpill]')].map((e) => e.textContent.replace(' · KHẨN', '')),
      ['XN-L01', 'XN-L03'], 'thanh chọn mẫu phải giữ đúng thứ tự nhận');
    assert.ok($5('batch-card').textContent.includes('XN-L01'), 'thẻ phải mở ở mẫu đầu lô');
    const cardInp = d5.querySelector('#batch-card [data-bfield="ketQua"]');
    cardInp.value = 'Dương tính';
    cardInp.dispatchEvent(new w5.Event('input', { bubbles: true }));
    $5('btn-batch-next').click();
    assert.strictEqual(w5.eval('store.statusOf(store.getByUid("' + u1 + '"))'), 'pending-release',
      'nút "mẫu tiếp theo" phải lưu mẫu vừa nhập');
    assert.ok($5('batch-card').textContent.includes('XN-L03'), 'sau khi lưu phải chuyển sang mẫu tiếp theo trong lô');
    $5('btn-batch-next').click(); /* mẫu cuối: lưu & xong -> về Quản lý */
    assert.ok(!$5('view-manage').classList.contains('hidden'), 'hết lô phải quay về tab Quản lý');
    w5.close();
  });

  test('xuất file trong vỏ app: đi qua cầu nối file, chỉ ghi nhận sao lưu khi ghi được (v52 F28)', async () => {
    /* Phiên riêng dom6: gieo KTV + người trực */
    const dom6 = new JSDOM(htmlText, {
      url: 'file://' + htmlPath,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        shimStorage(w, {
          'labentry.staff.v1': JSON.stringify([{ name: 'KTV File', salt: 's', pinHash: 'h' }]),
          'labentry.operator.v1': 'KTV File',
        });
      },
    });
    const w6 = dom6.window;
    await new Promise((res) => w6.addEventListener('load', res));
    w6.eval("store.add({ testId: 'XN-F28', typeId: 'mau-an', results: {} })");
    const saved = [];
    w6.LabFileNative = { saveFile(name, text) { saved.push([name, text]); return 'OK'; } };
    w6.eval('exportBackupFile()');
    assert.strictEqual(saved.length, 1, 'trong vỏ app, xuất sao lưu phải đi qua cầu nối file native');
    assert.ok(/^labentry-sao-luu-.*\.json$/.test(saved[0][0]), 'tên file sao lưu phải đúng mẫu labentry-sao-luu-*.json');
    assert.strictEqual(JSON.parse(saved[0][1]).records.length, 1, 'nội dung file phải chứa đúng bản ghi đã gieo');
    assert.ok(w6.eval('appMeta.lastBackupAt'), 'ghi được file thì mới ghi nhận lần sao lưu gần nhất');
    /* Cầu nối báo lỗi -> không ghi nhận sao lưu (không còn "thành công giả" như tới v51) */
    w6.eval("appMeta.lastBackupAt = ''; saveMeta();");
    w6.LabFileNative = { saveFile() { return 'ERR'; } };
    w6.eval('exportBackupFile()');
    assert.strictEqual(w6.eval('appMeta.lastBackupAt'), '', 'ghi file thất bại thì không được ghi nhận đã sao lưu');
    /* Không cầu nối + không ở trong vỏ app -> kênh tải thường của trình duyệt */
    delete w6.LabFileNative;
    assert.strictEqual(w6.eval("downloadTextFile('a.txt', 'x')"), 'download');
    w6.close();
  });

  test('in trong vỏ app: Xuất PDF và in bàn giao gọi cầu nối in native (v53 F29)', async () => {
    const dom7 = new JSDOM(htmlText, {
      url: 'file://' + htmlPath,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        shimStorage(w, {
          'labentry.staff.v1': JSON.stringify([{ name: 'KTV In', salt: 's', pinHash: 'h' }]),
          'labentry.operator.v1': 'KTV In',
        });
      },
    });
    const w7 = dom7.window;
    const d7 = w7.document;
    const $7 = (id) => d7.getElementById(id);
    await new Promise((res) => w7.addEventListener('load', res));
    w7.eval("store.add({ testId: 'XN-F29', typeId: 'mau-an', results: { ketQua: 'Âm tính' } })");
    let prints = 0;
    w7.LabFileNative = { saveFile() { return 'OK'; }, print() { prints++; } };
    $7('btn-print').click();
    assert.strictEqual(prints, 1, 'trong vỏ app, nút Xuất PDF phải gọi in native chứ window.print() của WebView là hàm rỗng');
    assert.ok(d7.getElementById('print-area').innerHTML.includes('XN-F29'), 'trước khi in, tờ kết quả phải đã dựng vào #print-area');
    w7.eval('printHandover()');
    assert.strictEqual(prints, 2, 'in tờ bàn giao cũng phải đi qua cầu nối in');
    delete w7.LabFileNative; /* ngoài vỏ app: rơi về window.print thường, không lỗi */
    $7('btn-print').click();
    w7.close();
  });

  test('in bàn giao trong vỏ app: sự kiện in bất đồng bộ không ghi đè tờ bàn giao bằng tờ kết quả (v54 F30)', async () => {
    const dom8 = new JSDOM(htmlText, {
      url: 'file://' + htmlPath,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        shimStorage(w, {
          'labentry.staff.v1': JSON.stringify([{ name: 'KTV Giao', salt: 's', pinHash: 'h' }]),
          'labentry.operator.v1': 'KTV Giao',
        });
      },
    });
    const w8 = dom8.window;
    const d8 = w8.document;
    await new Promise((res) => w8.addEventListener('load', res));
    w8.eval("store.add({ testId: 'XN-F30', typeId: 'mau-an', results: {} })"); /* chưa có kết quả -> nằm trong tờ bàn giao */
    let prints = 0;
    w8.LabFileNative = { saveFile() { return 'OK'; }, print() { prints++; } };
    w8.eval('applyExport()'); /* tờ kết quả vào #print-area trước, như lúc đang ở tab Lọc & Xuất */
    assert.ok(d8.getElementById('print-area').innerHTML.includes('Danh sách kết quả xét nghiệm'), 'điều kiện đầu: #print-area là tờ kết quả');
    w8.eval('printHandover()');
    assert.strictEqual(prints, 1, 'in bàn giao phải gọi cầu nối in');
    const hoHtml = () => d8.getElementById('print-area').innerHTML;
    assert.ok(hoHtml().includes('DANH SÁCH BÀN GIAO CA'), 'sau khi bấm in bàn giao, #print-area phải là tờ bàn giao');
    /* Adapter in của Android bắn beforeprint/afterprint bất đồng bộ và có thể
       nhiều lượt — không lượt nào được phép đổi nội dung tờ đang in */
    w8.dispatchEvent(new w8.Event('beforeprint'));
    assert.ok(hoHtml().includes('DANH SÁCH BÀN GIAO CA'), 'beforeprint không được ghi đè tờ bàn giao bằng tờ kết quả');
    w8.dispatchEvent(new w8.Event('afterprint'));
    assert.ok(hoHtml().includes('DANH SÁCH BÀN GIAO CA'), 'afterprint trong vỏ app không được khôi phục tờ kết quả (lỗi Minh gặp 2026-11-08)');
    assert.ok(!hoHtml().includes('Danh sách kết quả xét nghiệm'), '#print-area không được chứa tờ kết quả khi đang in bàn giao');
    /* In kết quả ngay sau đó vẫn ra đúng tờ kết quả */
    d8.getElementById('btn-print').click();
    assert.strictEqual(prints, 2);
    assert.ok(hoHtml().includes('Danh sách kết quả xét nghiệm'), 'in kết quả sau in bàn giao phải ra tờ kết quả');
    w8.close();
  });

  test('linh vật đồng ca: trạng thái theo ca (êm/chờ/vội/quá giờ/quá tải), cài đặt + ảnh riêng chỉ máy này (v55 F31, bong bóng 5 giây v56)', async () => {
    const dom9 = new JSDOM(htmlText, {
      url: 'file://' + htmlPath,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(w) {
        shimStorage(w, {
          'labentry.staff.v1': JSON.stringify([{ name: 'KTV Vật', salt: 's', pinHash: 'h' }]),
          'labentry.operator.v1': 'KTV Vật',
        });
      },
    });
    const w9 = dom9.window;
    const d9 = w9.document;
    await new Promise((res) => w9.addEventListener('load', res));
    const box = d9.getElementById('mascot'), img = d9.getElementById('mascot-img'),
      bubble = d9.getElementById('mascot-bubble'), badge = d9.getElementById('mascot-badge');
    const state = () => w9.eval('computeMascotState(Date.now()).state');
    const upd = () => w9.eval('updateMascot()');

    /* Ca êm: không còn mẫu chưa kết quả */
    upd();
    assert.ok(!box.classList.contains('hidden'), 'linh vật hiện ở tab chính');
    assert.strictEqual(box.dataset.state, 'calm');
    assert.ok(bubble.textContent.includes('Ca êm quá'), 'bong bóng ca êm');
    assert.strictEqual(box.parentElement, d9.body, 'linh vật là con trực tiếp của body nên print.css tự loại khỏi bản in');
    assert.ok(w9.eval("typeof LABENTRY_MASCOTS === 'object' && LABENTRY_MASCOTS.calm.indexOf('data:image/webp') === 0"), 'ảnh mặc định nhúng sẵn trong mascot.js');
    assert.ok((img.getAttribute('src') || '').indexOf('data:image/webp') === 0, 'đang hiển thị ảnh mặc định');

    /* Đang chờ: mẫu hẹn giờ còn 12 phút */
    const uid = w9.eval("store.add({ testId: 'XN-VAT1', typeId: 'mau-an', results: {} }).record.uid");
    w9.eval("store.update('" + uid + "', { timerEndsAt: new Date(Date.now() + 12 * 60000).toISOString() })");
    upd();
    assert.strictEqual(state(), 'waiting');
    assert.ok(bubble.textContent.includes('XN-VAT1') && bubble.textContent.includes('còn 12 phút'), 'waiting: nêu ID + thời gian còn. Thực tế: ' + bubble.textContent);

    /* Vội: còn ~3,5 phút -> bong bóng gồm ID + loại XN + còn 4 phút, huy hiệu ! */
    w9.eval("store.update('" + uid + "', { timerEndsAt: new Date(Date.now() + 3.5 * 60000).toISOString() })");
    upd();
    assert.strictEqual(state(), 'hurried');
    assert.ok(bubble.textContent.includes('XN-VAT1') && bubble.textContent.includes('Máu ẩn') && bubble.textContent.includes('còn 4 phút'), 'hurried: ID + loại + còn 4 phút. Thực tế: ' + bubble.textContent);
    assert.strictEqual(badge.textContent, '!');

    /* Quá giờ */
    w9.eval("store.update('" + uid + "', { timerEndsAt: new Date(Date.now() - 60000).toISOString() })");
    upd();
    assert.strictEqual(state(), 'overdue');
    assert.strictEqual(badge.textContent, '1');

    /* Quá tải cần >=3 mẫu chờ >15 phút; quá giờ vẫn thắng quá tải */
    w9.eval("store.add({ testId: 'XN-VAT2', typeId: 'sp', results: {} }, new Date(Date.now() - 20 * 60000))");
    w9.eval("store.add({ testId: 'XN-VAT3', typeId: 'sp', results: {} }, new Date(Date.now() - 25 * 60000))");
    w9.eval("store.add({ testId: 'XN-VAT4', typeId: 'sp', results: {} }, new Date(Date.now() - 30 * 60000))");
    upd();
    assert.strictEqual(state(), 'overdue', 'quá giờ thắng quá tải');
    w9.eval("store.update('" + uid + "', { results: { ketQua: 'Âm tính' } })");
    upd();
    assert.strictEqual(state(), 'overload');
    assert.ok(bubble.textContent.includes('XN-VAT2') && bubble.textContent.includes('quá 15 phút'), 'overload: liệt kê ID + quá 15 phút. Thực tế: ' + bubble.textContent);
    assert.strictEqual(badge.textContent, '3');

    /* Bấm vào linh vật ẩn/hiện bong bóng */
    img.click();
    assert.ok(bubble.classList.contains('hidden'), 'bấm linh vật thì ẩn bong bóng');
    img.click();
    assert.ok(!bubble.classList.contains('hidden'), 'bấm lần nữa thì hiện lại');

    /* Bong bóng tự tắt sau 5 giây (chỉ tắt khung thoại, linh vật vẫn ở lại),
       tình huống còn đó thì sau 60 giây hiện lại (v56, góp ý của Minh) */
    w9.eval('mascotBubbleUntil = Date.now() - 1; updateMascot();');
    assert.ok(bubble.classList.contains('hidden'), 'quá 5 giây thì bong bóng tự tắt');
    assert.ok(!box.classList.contains('hidden'), 'linh vật vẫn hiện sau khi bong bóng tắt');
    w9.eval('mascotNextShowAt = Date.now() - 1; updateMascot();');
    assert.ok(!bubble.classList.contains('hidden'), 'đến hẹn hiện lại thì bong bóng hiện lại');

    /* Cài đặt tắt -> ẩn hẳn và lưu ở khóa riêng */
    const sel = d9.getElementById('mascot-enabled');
    sel.value = 'off';
    sel.dispatchEvent(new w9.Event('change'));
    upd();
    assert.ok(box.classList.contains('hidden'), 'tắt trong cài đặt thì linh vật ẩn');
    assert.strictEqual(JSON.parse(w9.localStorage.getItem('labentry.mascot.v1')).on, false, 'cài đặt lưu ở labentry.mascot.v1');
    sel.value = 'on';
    sel.dispatchEvent(new w9.Event('change'));
    upd();
    assert.ok(!box.classList.contains('hidden'), 'bật lại thì hiện');

    /* Ảnh riêng: dùng cho mọi trạng thái, chỉ lưu trên máy; nút mặc định khôi phục */
    w9.eval("mascotSettings.custom = 'data:image/png;base64,AAAA'; saveMascotSettings(); mascotSig = ''; updateMascot();");
    assert.strictEqual(img.getAttribute('src'), 'data:image/png;base64,AAAA', 'ảnh riêng được dùng');
    assert.ok(JSON.parse(w9.localStorage.getItem('labentry.mascot.v1')).custom.indexOf('data:image/png') === 0, 'ảnh riêng lưu ở khóa riêng trên máy');
    d9.getElementById('btn-mascot-reset').click();
    assert.ok((img.getAttribute('src') || '').indexOf('data:image/webp') === 0, 'bấm Ảnh mặc định thì về ảnh gốc');

    /* Cài đặt linh vật KHÔNG đi theo file sao lưu */
    const backupJson = JSON.stringify(w9.eval('store.exportBackup()'));
    assert.ok(!backupJson.includes('labentry.mascot') && !backupJson.includes('base64,AAAA'), 'file sao lưu không mang cài đặt/ảnh linh vật');
    w9.close();
  });

  test('F32 (v58, nới rộng v60–v64): chủ đề lễ hội — lịch âm đúng ngày lễ thật, tự động + chọn tay, thẻ cài đặt gọn', async () => {
    const dom10 = new JSDOM(htmlText, { url: 'file://' + htmlPath, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
      beforeParse(w) { shimStorage(w, { 'labentry.staff.v1': JSON.stringify([{ name: 'KTV Lễ', salt: 's10', pinHash: 'h10' }]), 'labentry.operator.v1': 'KTV Lễ' }); } });
    const w10 = dom10.window;
    await new Promise((res) => { if (w10.document.readyState === 'complete') res(); else w10.addEventListener('load', res); });
    await new Promise((r) => setTimeout(r, 300));
    const d10 = w10.document;

    /* Lịch âm khớp các ngày lễ có thật */
    assert.strictEqual(JSON.stringify(w10.eval('convertSolar2Lunar(17, 2, 2026)').slice(0, 3)), '[1,1,2026]', '17/02/2026 = mùng 1 Tết');
    assert.strictEqual(JSON.stringify(w10.eval('convertSolar2Lunar(25, 9, 2026)').slice(0, 3)), '[15,8,2026]', '25/09/2026 = rằm Trung Thu');
    assert.strictEqual(JSON.stringify(w10.eval('convertSolar2Lunar(6, 2, 2027)').slice(0, 3)), '[1,1,2027]', '06/02/2027 = mùng 1 Tết 2027');

    /* Tự động theo ngày */
    assert.strictEqual(w10.eval("themeSettings.mode = 'auto'; themeForDate(new Date(2026, 1, 17))"), 'tet', 'mùng 1 Tết -> chủ đề tet');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 8, 25))'), 'trungthu', 'rằm tháng 8 -> trungthu');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 11, 24))'), 'xmas', '24/12 -> xmas');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 10, 8))'), '', 'ngày thường không có chủ đề');

    /* v60: thêm 8 ngày lễ — dương lịch đúng ngày, Giỗ Tổ theo âm lịch,
       22/12 Quân đội thắng khoảng Giáng Sinh */
    assert.strictEqual(w10.eval('themeForDate(new Date(2027, 1, 27))'), 'thaythuoc', '27/2 -> Thầy thuốc VN');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 2, 8))'), 'phunuqt', '8/3 -> Quốc tế Phụ nữ');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 3, 26))'), 'gioto', '26/4/2026 = 10/3 âm -> Giỗ Tổ');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 3, 30))'), 'giaiphong', '30/4 -> Giải phóng');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 4, 1))'), 'laodong', '1/5 -> Quốc tế Lao động');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 9, 20))'), 'phunuvn', '20/10 -> Phụ nữ VN');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 10, 20))'), 'nhagiao', '20/11 -> Nhà giáo VN');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 11, 22))'), 'qdnd', '22/12 -> Quân đội (không phải Giáng Sinh)');
    assert.strictEqual(w10.eval('themeForDate(new Date(2026, 11, 24))'), 'xmas', '24/12 vẫn là Giáng Sinh');

    /* Chọn tay ghi đè; áp dụng lên body + dải lời chúc */
    const sel = d10.getElementById('theme-mode');
    assert.ok(sel && sel.options.length === 13, 'ô chọn chủ đề có 13 mức (tự động + 11 lễ + tắt)');
    sel.value = 'tet';
    sel.dispatchEvent(new w10.Event('change'));
    assert.ok(d10.body.classList.contains('theme-tet'), 'chọn Tết thì body mang theme-tet');
    const banner = d10.getElementById('theme-banner');
    assert.ok(!banner.classList.contains('hidden'), 'dải lời chúc hiện khi có chủ đề');
    assert.ok(d10.getElementById('theme-banner-text').textContent.includes('Chúc Mừng Năm Mới'), 'lời chúc Tết đúng');
    assert.strictEqual(JSON.parse(w10.localStorage.getItem('labentry.theme.v1')).mode, 'tet', 'lựa chọn lưu ở labentry.theme.v1');

    /* Nút ✕ chỉ ẩn tạm thời khi còn ở chủ đề đó */
    d10.getElementById('theme-banner-close').click();
    assert.ok(banner.classList.contains('hidden'), 'bấm ✕ thì ẩn dải chúc');
    sel.dispatchEvent(new w10.Event('change'));
    assert.ok(banner.classList.contains('hidden'), 'còn ở nguyên chủ đề Tết thì vẫn ẩn');

    /* Tắt hẳn: gỡ class + ẩn dải */
    sel.value = 'off';
    sel.dispatchEvent(new w10.Event('change'));
    assert.ok(!d10.body.classList.contains('theme-tet'), 'chọn Tắt thì gỡ chủ đề');
    assert.ok(banner.classList.contains('hidden'), 'tắt thì ẩn dải chúc');

    /* v61–v63: tắt lời chúc là tạm thời — rời sang chủ đề khác rồi quay lại
       là hiện tiếp (Minh chốt: "quay lại cần hiện thông báo tiếp, không tắt") */
    sel.value = 'xmas';
    sel.dispatchEvent(new w10.Event('change'));
    assert.ok(!banner.classList.contains('hidden'), 'đã tắt chúc Tết, chọn Giáng Sinh thì chúc Giáng Sinh vẫn hiện');
    assert.ok(d10.getElementById('theme-banner-text').textContent.includes('Giáng Sinh'), 'lời chúc là của chủ đề mới chọn');
    const decor = d10.getElementById('theme-decor');
    assert.ok(!decor.classList.contains('hidden') && decor.textContent.includes('❄') && decor.textContent.includes('⛄'), 'Giáng Sinh có tuyết rơi + người tuyết ở góc');
    assert.strictEqual(d10.getElementById('theme-banner-decor-l').textContent, '🎄', 'đầu trái dải chúc có cây thông');
    d10.getElementById('theme-banner-close').click();
    assert.ok(banner.classList.contains('hidden'), 'tắt chúc Giáng Sinh thì ẩn');

    sel.value = 'tet';
    sel.dispatchEvent(new w10.Event('change'));
    assert.ok(!banner.classList.contains('hidden'), 'quay lại Tết là lời chúc hiện tiếp, không tắt hẳn (kể cả khi đã từng tắt)');
    assert.ok(decor.textContent.includes('🌸') && decor.textContent.includes('🧧'), 'trang trí Tết vẫn có hoa đào rơi + bao lì xì ở góc');
    /* v64a: vật rơi rải đều toàn chiều ngang (trước đây công thức cũ dồn
       hết về phía phải, bên trái trống — Minh chỉ ra 2026-11-08) */
    const lefts = [...d10.querySelectorAll('#theme-decor .decor-fall')].map((el) => parseFloat(el.style.left));
    assert.ok(lefts.length >= 9, 'Tết có 9 hoa đào rơi');
    assert.ok(Math.min(...lefts) <= 12, 'có hoa rơi ở sát mép trái');
    assert.ok(Math.max(...lefts) >= 85, 'có hoa rơi ở phía phải');
    assert.ok(lefts.filter((x) => x < 34).length >= 2, 'một phần ba trái màn hình có ít nhất 2 hoa');

    /* v64b: nhạc đệm chỉ cho Tết / Giáng Sinh / Trung Thu, dài 6–11 giây,
       phát/dừng an toàn cả khi máy không có WebAudio (jsdom) */
    assert.strictEqual(JSON.stringify(w10.eval('Object.keys(THEME_MUSIC).sort()')), JSON.stringify(['tet', 'trungthu', 'xmas']), 'đúng 3 chủ đề có nhạc');
    for (const k of ['tet', 'xmas', 'trungthu']) {
      const sec = w10.eval(`themeMusicSeconds('${k}')`);
      assert.ok(sec >= 6 && sec <= 11, `nhạc ${k} dài ~10 giây (thực tế ${sec.toFixed(1)}s)`);
      assert.ok(w10.eval(`THEME_MUSIC.${k}.notes.every((n) => n[1] > 0 && (n[0] === 0 || (n[0] >= 55 && n[0] <= 88)))`), `nốt nhạc ${k} hợp lệ`);
    }
    w10.eval("playThemeMusic('tet'); stopThemeMusic();");
    assert.strictEqual(w10.eval('themeMusicState.playing'), false, 'không có WebAudio thì không phát, không lỗi');

    sel.value = 'trungthu';
    sel.dispatchEvent(new w10.Event('change'));
    assert.ok(!banner.classList.contains('hidden'), 'Trung Thu lời chúc hiện bình thường');

    /* Thẻ cài đặt linh vật đã gọn: tiêu đề + ô chọn cùng hàng, ghi chú ngắn */
    assert.ok(d10.querySelector('.mascot-set-head select#mascot-enabled'), 'ô chọn linh vật nằm cùng hàng tiêu đề (thẻ gọn v58)');
    assert.ok(!d10.querySelector('.mascot-settings').textContent.includes('không vào file sao lưu'), 'ghi chú dài cũ đã bỏ');

    /* Cài đặt chủ đề KHÔNG đi theo file sao lưu */
    const bk = JSON.stringify(w10.eval('store.exportBackup()'));
    assert.ok(!bk.includes('labentry.theme'), 'file sao lưu không mang cài đặt chủ đề');

    /* v59: hai thẻ tùy chỉnh nằm ở tab riêng Giao diện, cạnh Quản lý */
    const navBtns = [...d10.querySelectorAll('.nav-btn')];
    assert.deepStrictEqual(navBtns.map((b) => b.dataset.view), ['today', 'manage', 'display', 'export'], 'thanh dưới có 4 tab, Giao diện ngay sau Quản lý');
    const viewDisplay = d10.getElementById('view-display');
    assert.ok(viewDisplay.querySelector('#mascot-enabled') && viewDisplay.querySelector('#theme-mode'), 'tab Giao diện chứa cả hai thẻ tùy chỉnh');
    assert.ok(!d10.getElementById('view-manage').querySelector('#mascot-enabled'), 'tab Quản lý không còn thẻ linh vật');
    navBtns.find((b) => b.dataset.view === 'display').click();
    assert.ok(!viewDisplay.classList.contains('hidden') && d10.getElementById('view-manage').classList.contains('hidden'), 'bấm tab Giao diện thì mở đúng trang');
    assert.ok(d10.getElementById('fab-add').classList.contains('hidden'), 'nút + ẩn ở tab Giao diện');
    assert.strictEqual(w10.eval('mascotVisibleHere()'), true, 'linh vật vẫn hiện ở tab Giao diện để xem trước khi tùy chỉnh');
    w10.close();
  });

  await chain;
  if (failures.length) {
    console.error('\nCÁC TEST LỖI (' + failures.length + '): ' + failures.join(' | '));
    process.exit(1);
  }
  console.log('\nTỔNG: ' + passed + ' test giao diện đạt, 0 lỗi.');
  window.close();
  process.exit(0);
})().catch((e) => {
  console.error('UI TEST FAILED:', e);
  process.exit(1);
});

'use strict';
/* Test giao diện thật bằng jsdom: nạp index.html + 3 file JS, thao tác như người dùng.
   Chạy: node tests/ui.test.js  (cần jsdom: npm install --prefix tests jsdom) */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS  ' + name);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const htmlPath = path.join(__dirname, '..', 'lab-entry-single.html');
  /* Bỏ hậu tố ?v=N ở địa chỉ file khi nạp vào jsdom (bản thật trên web giữ nguyên để chống cache cũ) */
  const htmlText = fs.readFileSync(htmlPath, 'utf8').replace(/\?v=\d+/g, '');
  const dom = new JSDOM(htmlText, {
    url: 'file://' + htmlPath,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { document } = window;
  /* Chờ app khởi tạo xong thật rồi mới test: các file JS ngoài nạp bất đồng bộ,
     chờ tới khi dropdown loại XN có options (dấu hiệu init đã chạy). */
  for (let i = 0; i < 60 && document.getElementById('select-type').options.length === 0; i++) await sleep(50);
  assert.ok(document.getElementById('select-type').options.length > 0, 'app phải khởi tạo xong trước khi test');
  window.confirm = () => true;
  window.scrollTo = () => {};
  const $ = (id) => document.getElementById(id);
  const visible = (el) => !el.classList.contains('hidden');
  const setInput = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const setSelect = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('change', { bubbles: true })); };

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
    assert.ok(visible($('view-today')));
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
    assert.strictEqual($('print-table-body').children.length, 1);
    setSelect($('f-status'), 'released');
    $('btn-apply-filter').click();
    assert.strictEqual($('list-export').children.length, 0);
    assert.ok(visible($('empty-export')));
    assert.strictEqual($('print-table-body').innerHTML, '');
    setSelect($('f-status'), 'no-result');
    $('btn-apply-filter').click();
    assert.strictEqual($('list-export').children.length, 1);
    assert.ok($('export-count').textContent.includes('1'));
  });

  test('bảng in: trường chip không chọn hiện "Âm tính" (tiêu chí 8)', () => {
    setSelect($('f-status'), 'no-result');
    setSelect($('f-type'), '');
    $('btn-apply-filter').click();
    const html = $('print-table-body').innerHTML;
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
    const html = $('print-table-body').innerHTML;
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
    assert.ok($('sum-status').textContent.includes('Đã phát hành'), 'trang Xem cập nhật trạng thái ngay');
    assert.ok(!$('sum-release').textContent.includes('Chưa phát hành'), 'trang Xem hiện giờ phát hành');
    assert.ok(!visible($('btn-summary-release')), 'đã phát hành thì trang Xem ẩn nút Phát hành');
    $('btn-summary-close').click();
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
    const liB = [...$('list-today').children].find((x) => x.textContent.includes('2611042600'));
    const relBtn = liB.querySelector('[data-action="release"]');
    assert.ok(relBtn, 'bản ghi mới chờ phát hành có nút phát hành');
    relBtn.click();
    assert.strictEqual(confirmCalls, 0, 'phát hành từ nút trên dòng cũng không hỏi lại');
    const liB2 = [...$('list-today').children].find((x) => x.textContent.includes('2611042600'));
    assert.ok(liB2.textContent.includes('Đã phát hành'));
  });

  test('quét liên tục từ tab Hôm nay: chỉ quét camera (không còn ô nhập tay), khóa loại sau mã đầu, trùng thì bỏ qua', () => {
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
    assert.ok($('scanner-type-select').disabled, 'sau mã đầu tiên: loại bị khóa, giữ nguyên cả phiên');
    scan('2611043001'); // trùng ID + loại
    assert.ok($('scanner-msg').textContent.includes('Đã tồn tại'));
    assert.ok($('scanner-count').textContent.includes('1'), 'trùng không tính thêm');
    scan('2611043002');
    assert.ok($('scanner-count').textContent.includes('2'));
    $('btn-scanner-close').click(); // người dùng chủ động dừng
    assert.ok(!visible($('scanner-modal')));
    assert.strictEqual($('list-today').children.length, before + 2);
    const rows = [...$('list-today').children];
    const i1 = rows.findIndex((r) => r.textContent.includes('2611043001'));
    const i2 = rows.findIndex((r) => r.textContent.includes('2611043002'));
    assert.ok(i1 >= 0 && i2 > i1, 'mẫu nhận trước nằm trên mẫu nhận sau');
    assert.ok(rows[i1].textContent.includes('Chưa kết quả'));
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
  });

  console.log('\nTỔNG: ' + passed + ' test giao diện đạt, 0 lỗi.');
  window.close();
  process.exit(0);
})().catch((e) => {
  console.error('UI TEST FAILED:', e);
  process.exit(1);
});

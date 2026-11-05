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
  const htmlPath = path.join(__dirname, '..', 'index.html');
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
    const liB = [...$('list-today').children].find((x) => x.textContent.includes('2611042600'));
    const relBtn = liB.querySelector('[data-action="release"]');
    assert.ok(relBtn, 'bản ghi mới chờ phát hành có nút phát hành');
    relBtn.click();
    assert.strictEqual(confirmCalls, 0, 'phát hành từ nút trên dòng cũng không hỏi lại');
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

  test('PWA: trang khai manifest + theme-color; manifest hợp lệ, có icon 192/512/maskable; sw.js đúng phiên bản v26 và precache đúng URL ?v=26 (v24)', () => {
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
    assert.ok(sw.includes("const VERSION = 'v26'"), 'sw.js phải gắn VERSION v26');
    for (const a of ['styles.css?v=26', 'print.css?v=26', 'config.js?v=26', 'store.js?v=26', 'app.js?v=26', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
      assert.ok(sw.includes(a), 'sw.js phải precache ' + a);
    }
    assert.ok(sw.includes('skipWaiting') && sw.includes('clients.claim'), 'sw.js phải kích hoạt bản mới ngay');
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

  console.log('\nTỔNG: ' + passed + ' test giao diện đạt, 0 lỗi.');
  window.close();
  process.exit(0);
})().catch((e) => {
  console.error('UI TEST FAILED:', e);
  process.exit(1);
});

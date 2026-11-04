# LabEntry — App nhập kết quả xét nghiệm soi

App web HTML5/CSS/JavaScript thuần (không framework, không cần server, không cần internet) mô phỏng đúng chức năng trong ảnh mẫu: nhập kết quả xét nghiệm theo từng loại, quản lý trạng thái phát hành, lọc và xuất PDF.

## Cách chạy

- Cách 1: mở thẳng file `index.html` bằng trình duyệt (điện thoại hoặc máy tính).
- Cách 2: chép cả thư mục lên hosting tĩnh bất kỳ (GitHub Pages, Netlify, máy chủ nội bộ...) rồi mở đường dẫn.

Dữ liệu lưu trong **localStorage của trình duyệt trên chính thiết bị đang dùng** — không gửi đi đâu, không có máy chủ. Đổi thiết bị/trình duyệt là dữ liệu không đi theo; xóa dữ liệu trình duyệt sẽ mất kết quả đã nhập.

## Cách dùng

- **Kết quả hôm nay**: danh sách kết quả nhập trong ngày, xếp theo giờ nhập — **nhập trước ở trên, mới nhất ở cuối danh sách**. Nút **+** thêm mới; icon bút = sửa, thùng rác = xóa (có hỏi xác nhận); kính lúp = tìm theo ID; icon ô vuông có dấu tick = chọn nhiều để xóa hàng loạt; icon vòng xoáy = làm mới; icon lọc (góc trái) = sang tab Lọc & Xuất PDF. **Muốn sửa phải bấm nút cây bút — bấm vào dòng hay vào ID không mở sửa.**
- **Nút Phát hành**: kết quả đang *Chờ phát hành* có thêm nút icon gửi màu xanh trên dòng — bấm nút này (app hỏi xác nhận) là phát hành ngay với ngày giờ phát hành là thời điểm hiện tại, không cần mở form sửa để điền tay. Kết quả *Chưa kết quả* hoặc đã phát hành thì không có nút này.
- **Tiếp nhận mẫu bằng quét mã liên tục**: bấm **nút quét mã** trên thanh công cụ của tab Kết quả hôm nay (hoặc nút quét trong form thêm mới) → chọn **Loại xét nghiệm** một lần → camera quét **liên tục**, mỗi mã quét được là một mẫu được nhận ngay (vào nhóm *Chưa kết quả*, ghi giờ nhận tới giây). Sau mã đầu tiên, loại xét nghiệm **bị khóa giữ nguyên cả phiên** — muốn đổi loại thì bấm **Dừng quét** rồi mở phiên mới. Mã trùng ID + loại sẽ bị báo "Đã tồn tại" và bỏ qua, phiên vẫn quét tiếp. Chỉ khi bấm **Dừng quét** vòng quét mới dừng. Máy không hỗ trợ camera thì **nhập ID vào ô trong màn hình quét rồi bấm "Nhận mẫu"** (hoặc Enter) — vẫn nhận liên tục như quét. Riêng khi mở quét từ **form sửa** một kết quả, app nhận đúng 1 mã để điền vào ô ID rồi tự đóng.
- **Form nhập**: nhập **ID Xét Nghiệm** (bắt buộc) hoặc bấm icon mã để quét QR/barcode bằng camera (chỉ khi trình duyệt hỗ trợ, xem Giới hạn). Chọn **Loại Xét Nghiệm** thì bộ trường kết quả đổi theo. Trường dạng nút (+), (++), (+++): bấm để chọn mức, bấm lại chính nút đó để bỏ chọn. **Ngày Giờ** tự điền thời điểm nhập. Điền **Ngày giờ phát hành** khi phát hành kết quả. Bấm **Lưu**.
- **Chống nhập trùng**: nếu đã có kết quả khác **cùng ID + cùng loại xét nghiệm**, app báo **"Đã tồn tại"** và không cho lưu (cùng ID nhưng loại khác thì vẫn nhập được).
- **Quản lý**: tự chia 2 nhóm — *Chờ phát hành* (đã có kết quả, chưa điền ngày giờ phát hành; mới nhất lên đầu) và *Chưa kết quả* (chưa nhập trường kết quả nào; xếp theo giờ nhận mẫu — **nhận trước lên đầu, nhận sau xuống cuối** — để làm theo thứ tự mẫu tới). Sửa bằng nút cây bút trên dòng; phát hành bằng nút Phát hành trên dòng.
- **Lọc & Xuất kết quả PDF**: chọn khoảng ngày, loại xét nghiệm, trạng thái, hoặc một phần ID → **Lọc** để xem → **Xuất PDF** mở hộp thoại in của trình duyệt, chọn "Save as PDF / Lưu dưới dạng PDF". Trong bản in, trường dạng nút (+)/(++)/(+++) nào không chọn sẽ hiện **Âm tính**.

## 6 loại xét nghiệm (khai báo trong `config.js`)

| Loại | Trường kết quả |
|---|---|
| Cạo tìm nấm | Kết quả (tự do) |
| Soi nhuộm mực tàu DNT | Kết quả (tự do) |
| Soi tinh thể dịch | Kết quả (tự do) |
| Soi tươi huyết trắng | Nấm, Tạp trùng, Trichomonas, Hồng cầu: nút 3 mức · Bạch cầu, Tế bào, Khác: tự do · Clue cell: nút (+) · Lactobaccilli: nút (+), (++) |
| Máu ẩn | Kết quả (tự do) |
| SP | Hồng cầu, Bạch cầu: nút 3 mức · Ký sinh trùng, Khác: tự do |

Muốn thêm/bớt loại xét nghiệm hay trường: chỉ sửa `config.js` (có hướng dẫn trong file), không cần đụng code còn lại.

## Cấu trúc file

- `index.html` — khung giao diện 3 tab + form + vùng in.
- `styles.css` — giao diện mobile giống mẫu. · `print.css` — định dạng bản in/PDF.
- `config.js` — khai báo loại xét nghiệm và bộ trường.
- `store.js` — lưu trữ localStorage + logic nghiệp vụ (kiểm tra ID bắt buộc, suy ra trạng thái, lọc).
- `app.js` — điều khiển giao diện.
- `SPEC.md` — đặc tả + kiến trúc đã được duyệt.
- `tests/` — bộ test tự động.

## Kết quả kiểm thử (chạy thật ngày 2026-11-04)

- `node tests/logic.test.js` — **16/16 đạt**: cấu hình đủ 6 loại/đúng bộ trường; chặn lưu khi thiếu ID hoặc sai loại; 3 trạng thái đúng đặc tả; sửa/xóa; lọc theo ID/loại/trạng thái/ngày; lưu–đọc lại qua storage (mô phỏng tải lại trang); chặn trùng ID + loại XN (kể cả khi sửa sang ID/loại của bản ghi khác).
- `node tests/ui.test.js` và `node tests/ui-single.test.js` — **20/20 đạt** cho cả bản nhiều file lẫn bản 1 file (nạp trang thật vào jsdom, thao tác như người dùng): thêm đủ loại, đổi loại đổi bộ trường, chip chọn/đổi/bỏ chọn, chặn lưu thiếu ID, chặn nhập trùng qua form, thứ tự nhóm Chưa kết quả theo giờ nhận, sửa + phát hành đổi trạng thái, nút Phát hành trên dòng (chỉ ở bản ghi chờ phát hành), bấm vào dòng/ID không mở sửa — chỉ nút bút mới mở, phân nhóm Quản lý, tìm kiếm, chọn nhiều + xóa, xóa từng dòng, lọc & bảng in PDF (kể cả "Âm tính" cho trường chip bỏ trống), quét liên tục tiếp nhận mẫu qua đường nhập tay dự phòng (khóa loại sau mã đầu, trùng bỏ qua, dừng theo yêu cầu), chế độ quét 1 mã từ form sửa.
- Kiểm tra chéo: toàn bộ 53 id phần tử mà `app.js` tham chiếu đều tồn tại trong `index.html`; `node --check` sạch cho cả 3 file JS.

Chạy lại test: `node tests/logic.test.js` (không cần cài gì thêm) và `cd tests && npm install && node ui.test.js` (cần jsdom).

## Giới hạn thật (chưa làm / phụ thuộc thiết bị)

- **Quét mã**: dùng `BarcodeDetector` của trình duyệt (có trên Chrome Android). Trình duyệt không hỗ trợ thì app báo rõ và nhập tay bình thường — không treo.
- **Lưu trữ 1 thiết bị**: chưa có đồng bộ nhiều máy/máy chủ (đúng mặc định đã duyệt). Cần dùng chung nhiều máy thì phải làm thêm backend.
- **Giao diện**: đã kiểm bằng test DOM tự động theo đúng cấu trúc ảnh mẫu; chưa đối chiếu pixel trên điện thoại thật — nên mở thử trên máy của khoa để xem cỡ chữ/bố cục có vừa mắt không.
- Nhãn "Lactobaccilli" giữ nguyên chính tả như trong ảnh mẫu.

# ĐẶC TẢ + KIẾN TRÚC — App nhập kết quả xét nghiệm soi (LabEntry)

Nguồn yêu cầu: 9 ảnh chụp màn hình app mẫu do Minh gửi 2026-11-04.
Trạng thái: Minh ĐÃ DUYỆT ngày 2026-11-04 ("Duyệt, bắt đầu code") — đã code xong, test thật 27/27 đạt, đã đóng gói giao (xem README.md).

---

## 1. Mục đích

App web HTML5/CSS/JavaScript (mobile-first, giao diện giống ảnh mẫu) để kỹ thuật viên:

- Nhập kết quả các xét nghiệm soi/ký sinh theo từng loại xét nghiệm.
- Quản lý kết quả trong ngày: sửa, xóa, tìm kiếm.
- Theo dõi trạng thái: chưa có kết quả / chờ phát hành / đã phát hành.
- Lọc và xuất kết quả ra PDF.

## 2. Chức năng trích từ ảnh mẫu

### F1 — Tab "Kết quả hôm nay" (màn hình chính)

- Danh sách kết quả đã nhập trong ngày, mỗi dòng: **ID Xét nghiệm** (đậm), **Loại xét nghiệm**, **thời gian nhập** (dd/mm/yyyy hh:mm).
- Sắp xếp theo **giờ nhập tăng dần**: nhập trước ở trên, **kết quả mới nhất nằm cuối danh sách** (bổ sung theo yêu cầu của Minh, 2026-11-04).
- Thao tác từng dòng: **Xóa** (icon thùng rác), **Sửa** (icon bút).
- Thanh công cụ trên: menu/lọc, **tìm kiếm**, **chọn nhiều**, **làm mới**.
- Nút **"+"** (FAB góc phải dưới) mở form thêm mới.
- Thanh điều hướng dưới 3 tab: **Kết quả hôm nay** | **Quản lý** | **Lọc & Xuất kết quả PDF**.

### F2 — Form nhập/sửa kết quả (khung chung)

- **ID Xét Nghiệm \*** (bắt buộc) — ô nhập kèm nút quét mã QR/barcode.
- **Loại Xét Nghiệm** — dropdown; đổi loại thì bộ trường kết quả bên dưới thay đổi theo.
- Các trường kết quả riêng theo loại (mục 3).
- **Ghi chú chung** — text tự do.
- **Ngày giờ phát hành** — chọn ngày giờ (để trống = chưa phát hành).
- **Ngày Giờ** — thời điểm nhập, app tự điền sẵn.
- Nút **Hủy** (không lưu) / **Lưu** (lưu kết quả).

### F2b — Chặn nhập trùng (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Nếu đã tồn tại một kết quả khác có **cùng ID Xét Nghiệm + cùng loại xét nghiệm** thì hệ thống báo **"Đã tồn tại"** và **không cho lưu**. Cùng ID nhưng khác loại (hoặc khác ID cùng loại) thì vẫn nhập bình thường.
- Áp dụng cả khi sửa: đổi một kết quả sang ID + loại của kết quả khác cũng bị chặn; sửa nội dung của chính kết quả đó thì không bị coi là trùng.

### F3 — Tab "Quản lý"

Hai nhóm danh sách:

- **Chờ phát hành**: đã có kết quả nhưng chưa có ngày giờ phát hành. Sắp xếp: mới nhất lên đầu.
- **Chưa kết quả**: đã tạo ID nhưng chưa nhập trường kết quả nào. Sắp xếp theo **giờ nhận mẫu** (thời điểm nhập ID vào app, chính xác tới giây): **nhận trước lên đầu, nhận sau xuống cuối** — để xử lý theo thứ tự mẫu tới.

Nhóm rỗng hiển thị "Không có kết quả" (đúng như ảnh mẫu).

### F3b — Nút Phát hành + cách mở sửa (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Mỗi kết quả ở trạng thái **Chờ phát hành** có thêm **nút Phát hành** (icon gửi, màu xanh) ngay trên dòng: bấm → ghi **Ngày giờ phát hành = thời điểm hiện tại** ngay lập tức — **không hỏi xác nhận lại** (bỏ hộp confirm theo yêu cầu của Minh) — kết quả chuyển sang Đã phát hành và rời nhóm Chờ phát hành. Kết quả chưa có nội dung (Chưa kết quả) hoặc đã phát hành thì không hiện nút này.
- **Muốn sửa phải bấm nút cây bút** trên dòng. Bấm trực tiếp vào dòng hoặc vào ID **không** mở form sửa.

### F3d — Nút Xem lớn + bảng tóm tắt kết quả (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Kết quả **đã có nội dung** (Chờ phát hành hoặc Đã phát hành) có thêm **nút "Xem" lớn, nền xanh, cạnh ID** — nổi bật hơn các nút icon còn lại. Kết quả Chưa kết quả thì không có nút này.
- Bấm Xem mở **bảng tóm tắt** thiết kế gọn, chữ to, dễ đọc để nhìn và chép kết quả vào máy ở lab: ID (chữ rất lớn), loại XN, thẻ trạng thái, mỗi trường kết quả một dòng (nhãn bên trái, **giá trị chữ to đậm** bên phải; trường mức độ bỏ trống hiện "Âm tính", trường chữ bỏ trống hiện "—"), ghi chú nếu có, giờ nhận mẫu và giờ phát hành. Đóng bằng nút "Đóng" hoặc bấm ra ngoài bảng.

### F3c — Quét mã liên tục để tiếp nhận mẫu (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Mở quét từ **nút quét trên tab Kết quả hôm nay** (tiếp nhận mẫu) hoặc từ **nút quét trong form**.
- **Quét liên tục**: camera giữ mở và nhận mã nối tiếp nhau; mỗi mã hợp lệ tạo **ngay một bản ghi "Chưa kết quả"** với thời điểm nhận là hiện tại (phục vụ xếp thứ tự chờ nhập kết quả theo giờ nhận). Vòng quét **chỉ dừng khi người dùng bấm "Dừng quét"**.
- **Danh mục (loại xét nghiệm) giữ nguyên cả phiên**: chọn loại trước khi quét; sau khi nhận thành công mã đầu tiên, ô chọn loại bị **khóa** — muốn đổi loại phải dừng phiên và mở phiên mới.
- Mã **trùng ID + loại** trong lúc quét: báo "Đã tồn tại — bỏ qua", không tạo thêm, phiên vẫn tiếp tục.
- Có **ô nhập tay dự phòng** (nhập ID + bấm "Nhận mẫu", hoặc phím Enter) hoạt động y hệt quét camera khi thiết bị không hỗ trợ camera/quét — vẫn liên tục.
- **Giao diện màn hình quét (bản v7)**: màn hình chuyên dụng **nền tối** kiểu ứng dụng quét mã chuyên nghiệp — tiêu đề phiên + chấm trạng thái "đang quét" nhấp nháy, **khung ngắm camera có 4 góc định vị và vạch quét chạy**, dòng trạng thái dạng băng màu (xanh khi nhận thành công, đỏ khi trùng/lỗi), khi loại bị khóa hiện **dòng chú thích khóa** kèm icon, danh sách mẫu đã nhận trong phiên nằm trong một thẻ riêng có dấu ✓ và giờ nhận, nút **Dừng quét màu đỏ** lớn ở cuối. Máy không hỗ trợ camera thì khung camera ẩn đi, chỉ còn ô nhập tay.
- **Bố cục chống tràn (bản v8)**: màn hình quét cố định toàn màn hình theo cột dọc — phần đầu, khung camera (giới hạn chiều cao 32% màn hình), băng trạng thái và ô nhập tay cố định; **chỉ danh sách mẫu của phiên cuộn** ở khoảng giữa; **nút Dừng quét luôn ghim ở đáy màn hình**, không bao giờ bị đẩy ra ngoài khung (bản v7 bị tràn, không thấy nút dừng trên điện thoại).
- Ngoại lệ: mở quét từ **form sửa** một bản ghi thì là chế độ 1 mã — nhận mã xong điền vào ô ID của form và tự đóng, không tạo bản ghi mới.

### F4 — Tab "Lọc & Xuất kết quả PDF"

- Lọc theo: khoảng ngày, loại xét nghiệm, trạng thái, ID.
- Xuất danh sách sau lọc ra PDF (bản in để lưu/ký).

### F5 — Quy tắc trạng thái (suy ra từ ảnh mẫu, chờ Minh xác nhận)

| Điều kiện | Trạng thái |
|---|---|
| Chưa nhập trường kết quả nào | Chưa kết quả |
| Đã có kết quả, chưa có ngày giờ phát hành | Chờ phát hành |
| Đã có kết quả và ngày giờ phát hành | Đã phát hành |

## 3. Sáu loại xét nghiệm và bộ trường kết quả (theo ảnh)

Trường dạng **chip** = nút chọn một trong các mức (+), (++), (+++); bấm lại để bỏ chọn.
Trường dạng **text** = ô nhập tự do.

| # | Loại xét nghiệm | Trường kết quả |
|---|---|---|
| 1 | Cạo tìm nấm | Kết quả (text) |
| 2 | Soi nhuộm mực tàu DNT | Kết quả (text) |
| 3 | Soi tinh thể dịch | Kết quả (text) |
| 4 | Soi tươi huyết trắng | Nấm (chip 3 mức) · Tạp trùng (chip 3 mức) · Trichomonas (chip 3 mức) · Bạch cầu (text) · Tế bào (text) · Hồng cầu (chip 3 mức) · Clue cell (chip 1 mức: (+)) · Lactobaccilli (chip 2 mức: (+), (++)) · Khác (text) |
| 5 | Máu ẩn | Kết quả (text) |
| 6 | SP (soi phân) | Hồng cầu (chip 3 mức) · Bạch cầu (chip 3 mức) · Ký sinh trùng (text) · Khác (text) |

Mọi loại đều có thêm: Ghi chú chung, Ngày giờ phát hành, Ngày Giờ (tự điền).

## 4. Tiêu chí nghiệm thu (test trước khi giao — phải chạy thật, có bằng chứng)

1. Thêm mới đủ 6 loại XN; đổi dropdown thì bộ trường đổi đúng theo bảng mục 3.
2. Thiếu ID → không cho lưu, báo lỗi rõ.
3. Chip (+)/(++)/(+++): chọn 1 mức, đổi mức, bấm lại để bỏ chọn — hoạt động đúng.
4. Lưu xong hiện đúng trong "Kết quả hôm nay" với ID, loại, giờ nhập.
5. Sửa một kết quả → nội dung cập nhật đúng; Xóa → mất khỏi danh sách (có hỏi xác nhận trước khi xóa).
6. Phân loại trạng thái đúng bảng F5: bản ghi rỗng kết quả vào "Chưa kết quả"; có kết quả chưa phát hành vào "Chờ phát hành"; điền ngày giờ phát hành thì rời nhóm chờ.
7. Tìm kiếm theo ID ra đúng kết quả; làm mới tải lại danh sách.
8. Lọc theo ngày/loại/trạng thái đúng; xuất PDF mở được bản in đúng nội dung đã lọc.
9. Tải lại trang (F5) → dữ liệu vẫn còn (lưu trữ trình duyệt).
10. Giao diện hiển thị đúng trên khung điện thoại (chiều dọc, giống ảnh mẫu).
11. Nhập trùng ID + loại XN → báo "Đã tồn tại", không thêm bản ghi; cùng ID khác loại vẫn nhập được; sửa sang ID + loại của bản ghi khác cũng bị chặn.
12. Nhóm "Chưa kết quả" xếp theo giờ nhập tăng dần: bản ghi nhập trước nằm trên, nhập sau nằm dưới.
13. Tab "Kết quả hôm nay" cũng xếp tăng dần theo giờ nhập: mới nhất nằm cuối danh sách.
14. Nút Phát hành chỉ hiện ở bản ghi Chờ phát hành; bấm là bản ghi thành Đã phát hành ngay với ngày giờ phát hành là hiện tại (**không hiện hộp hỏi xác nhận**) và rời nhóm chờ; bản ghi Chưa kết quả/Đã phát hành không có nút này.
17. Nút Xem lớn chỉ hiện ở bản ghi đã có kết quả; bấm mở bảng tóm tắt đúng ID, loại XN, trạng thái, từng giá trị kết quả (mức độ bỏ trống = "Âm tính"), ghi chú, giờ nhận/phát hành; đóng được bằng nút Đóng.
15. Bấm vào dòng/ID không mở form sửa; chỉ nút cây bút mới mở được.
16. Quét liên tục: nhận nhiều mã trong một phiên, mỗi mã tạo 1 bản ghi Chưa kết quả; loại XN khóa sau mã đầu tiên; trùng ID + loại bị bỏ qua kèm cảnh báo; chỉ dừng khi bấm "Dừng quét"; nhập tay dự phòng hoạt động tương đương; mở từ form sửa thì nhận 1 mã điền vào ô ID rồi tự đóng.

## 5. Kiến trúc đề xuất

- **Công nghệ**: HTML5 + CSS + JavaScript thuần (không framework, không cần server, không cần internet) — mở file `index.html` là chạy, hoặc đặt lên hosting tĩnh.
- **Cấu trúc file**:
  - `index.html` — khung 3 tab + form.
  - `styles.css` — giao diện mobile giống mẫu (nền trắng/xám nhạt, nút xanh dương, bottom nav).
  - `config.js` — khai báo 6 loại XN và bộ trường (thêm/bớt loại chỉ sửa file này).
  - `store.js` — lưu/đọc dữ liệu bằng localStorage, suy ra trạng thái.
  - `app.js` — điều khiển giao diện: danh sách, form động, tìm kiếm, lọc, quản lý.
  - `print.css` — định dạng bản in/PDF.
- **Mô hình dữ liệu** (mỗi bản ghi): `{ maID, loaiXN, ketQua: {tênTrường: giá trị}, ghiChu, ngayGioPhatHanh (null nếu chưa), ngayGioNhap, thoiDiemSuaCuoi }`. Trạng thái suy ra theo F5, không lưu cứng.
- **Xuất PDF**: dùng cửa sổ in của trình duyệt (Save as PDF) với `print.css` — không cần thư viện ngoài, chạy offline.
- **Bảo mật/dữ liệu**: dữ liệu chỉ nằm trên máy người dùng (localStorage); không gửi đi đâu. Có nút xuất/nhập file JSON để sao lưu (đề xuất thêm).
- **Test**: bộ test tự động cho logic (kiểm tra bắt buộc ID, suy ra trạng thái, lọc) chạy bằng Node + kiểm tra giao diện bằng trình duyệt headless (mở trang, chụp màn hình, thao tác thử) — kết quả test ghi vào README khi giao.

## 6. Câu hỏi mở — mặc định đề xuất, Minh chốt khi duyệt

1. **Lưu trữ**: mặc định lưu trên 1 máy (localStorage). Nếu cần nhiều máy dùng chung/đồng bộ server thì phải thêm backend — ngoài phạm vi bản này.
2. **Chip không chọn** (vd Nấm không bấm mức nào): mặc định hiểu là "âm tính/không ghi nhận"; khi in PDF hiển thị "Âm tính". Nếu khoa có quy ước khác, báo lại.
3. **Nút quét QR/barcode** ở ô ID: mặc định làm quét bằng camera điện thoại nếu trình duyệt hỗ trợ, nhập tay vẫn là chính. Nếu chỉ cần trang trí giống mẫu thì bỏ qua chức năng quét.
4. **Danh sách loại XN**: giữ đúng 6 loại như ảnh; thêm loại khác (nhuộm Gram, soi tươi dịch...) thì liệt kê thêm khi duyệt.
5. **PDF**: mặc định xuất bảng tổng hợp các kết quả đã lọc; nếu cần mỗi bệnh nhân một phiếu riêng thì làm thêm mẫu phiếu.

# LabEntry

**Ứng dụng quản lý kết quả xét nghiệm thủ công cho phòng xét nghiệm** — tiếp nhận mẫu bằng quét mã vạch, nhập và phát hành kết quả, đóng dấu kỹ thuật viên có mã PIN bảo vệ, và in bảng kết quả tùy biến hoàn toàn. Chạy ngay trên điện thoại, không cần máy chủ, dữ liệu lưu tại máy.

**Manual lab test results manager for small laboratories** — barcode sample intake, result entry and release, PIN-protected technician stamps, and fully customizable printable result sheets. Runs right on a phone, no server needed, data stays on the device.

🔗 **Dùng thử / Live demo:** https://nguyentruongcongminh.github.io/lab-entry-app/

![Màn hình chính](screenshots/01-trang-chinh.png)

| | |
|---|---|
| ![Form nhập kết quả](screenshots/02-form-nhap.png) | ![Xem tóm tắt kết quả](screenshots/03-xem-ket-qua.png) |
| *Form nhập kết quả với các trường theo từng loại xét nghiệm · Result entry form with per-test fields* | *Màn hình "Xem" chữ lớn để chép kết quả vào máy xét nghiệm · Large-print summary view for transcribing results* |
| ![Quản lý mẫu chờ](screenshots/04-quan-ly.png) | ![Quét mã vạch](screenshots/05-man-quet.png) |
| *Quản lý: thống kê, mẫu chờ quá 60 phút tô đỏ · Manage: stats bar, overdue samples highlighted* | *Quét tiếp nhận liên tục bằng camera · Continuous barcode intake scanning* |
| ![Tùy chỉnh bản in](screenshots/06-tuy-chinh-in.png) | ![Tờ kết quả in](screenshots/07-to-ket-qua-in.png) |
| *Tùy chỉnh bố cục bản in, xem trước trực tiếp · Print layout studio with live preview* | *Tờ kết quả in ra · The printed result sheet* |
| ![Loại xét nghiệm](screenshots/08-loai-xet-nghiem.png) | |
| *Danh mục loại xét nghiệm tự sửa được · User-editable test catalogue* | |

![Giao diện trên máy tính](screenshots/09-ban-pc.png)
*Trên máy tính: khung rộng, trang tùy chỉnh in hiện đủ mọi cột của tờ kết quả · On desktop: wide layout, the print studio shows the full result sheet*

## Tính năng chính / Key features

- **Tiếp nhận mẫu bằng mã vạch** — quét liên tục bằng camera điện thoại, hỗ trợ máy quét mã vạch cầm tay (kiểu bàn phím), hoặc nhập tay. Chặn trùng mã + trùng loại xét nghiệm. · *Barcode intake — continuous camera scanning, handheld wedge scanners, or manual entry. Duplicate sample + test-type combinations are blocked.*
- **Theo dõi 3 trạng thái rõ ràng** — Chưa kết quả / Chờ phát hành / Đã phát hành; danh sách mẫu chờ quá 60 phút tự tô đỏ kèm thời gian chờ; mẫu xét nghiệm nhanh có đồng hồ đếm ngược từng mẫu và báo chuông khi đến giờ đọc kết quả. Phát hành ngay không cần bấm xác nhận, và có thể **hủy phát hành** để sửa lại khi cần. · *Three clear statuses, overdue highlighting after 60 minutes, and per-sample countdown timers with an audible alert for rapid tests. Release is instant with no confirmation dialog, and a release can be undone when a correction is needed.*
- **Nhập kết quả nhanh** — trường nhập thay đổi theo từng loại xét nghiệm, nút nhập nhanh tự định nghĩa (một chạm điền sẵn bộ kết quả thường gặp), nhập bằng giọng nói tiếng Việt. · *Fast result entry — dynamic per-test fields, user-defined one-tap quick-result buttons, Vietnamese voice input.*
- **Đóng dấu kỹ thuật viên có mã PIN** — mỗi mẫu tự ghi tên KTV nhận / thực hiện / phát hành theo người đang trực. Đổi người trực **phải nhập đúng mã PIN 6 ký tự** của người đó; PIN chỉ được lưu dạng **băm SHA-256 kèm muối** nên kể cả trong file sao lưu cũng không ai đọc được PIN gốc, mang sang máy khác vẫn dùng PIN cũ bình thường. · *Technician stamps with PIN protection — every sample records who received / performed / released it. Switching the on-duty technician requires that person's 6-character PIN; PINs are stored only as salted SHA-256 hashes, so backups never expose them while still working on other devices.*
- **Bản in tùy biến sâu** — logo, đầu trang cơ quan, 12 cột bật/tắt–đổi tên–kéo thứ tự, tách cột Kết quả thành từng cột riêng theo trường, nhóm theo ngày/loại, mẫu bố cục lưu sẵn, chữ ký, khổ A4/A5 ngang/dọc. Xuất thêm CSV kèm thống kê thời gian trả kết quả (TAT). · *Deeply customizable printouts — logo, letterhead, 12 toggleable/renamable/reorderable columns, split result columns, grouping, saved presets, signature blocks, A4/A5 portrait/landscape. CSV export with turnaround-time stats.*
- **Sao lưu trọn gói & gộp dữ liệu** — một file sao lưu mang theo mẫu, danh mục, danh sách KTV (kèm băm PIN), bố cục in và thư viện mẫu in; phục hồi nguyên trạng hoặc **gộp** thêm phần chưa có khi chuyển dữ liệu giữa các máy. Khi **phục hồi**, KTV trực tự đặt về "chưa chọn" để người dùng máy tự chọn lại ca trực (nhập PIN); khi **gộp**, máy giữ nguyên người đang trực. · *Full-package backup & merge — one backup file carries samples, catalogue, staff list (with PIN hashes), print layout and presets; restore wholesale or merge only what's missing when moving data between devices. Restoring resets the on-duty technician to none so the shift is picked again (with PIN); merging keeps the device's current operator.*
- **Cài đặt như ứng dụng, chạy không cần mạng, dùng tốt cả trên máy tính** — thêm vào màn hình chính điện thoại và dùng offline; trên máy tính ứng dụng tự mở khung rộng (trang tùy chỉnh bản in hiện đủ mọi cột, dễ đọc). Danh mục loại xét nghiệm tự thêm/sửa được ngay trong ứng dụng. · *Installable (PWA), offline-capable, and desktop-friendly — on a computer the layout widens automatically (the print studio shows the full sheet, every column readable). The test catalogue is editable in-app.*

## Bắt đầu nhanh / Quick start

1. Mở [trang demo](https://nguyentruongcongminh.github.io/lab-entry-app/) bằng **Chrome trên Android** (cần Chrome để quét mã bằng camera và nhập giọng nói). · *Open the demo in Chrome on Android (required for camera scanning and voice input).*
2. Ở mục **KTV trực**, bấm **Quản lý** để thêm kỹ thuật viên kèm mã PIN của từng người, rồi chọn người đang trực. · *Add technicians with their PINs, then pick who is on duty.*
3. Bấm **+** hoặc **Quét mã** để tiếp nhận mẫu; nhập kết quả, bấm **Phát hành** khi xong. · *Receive samples, enter results, release when done.*
4. Sang tab **Lọc & Xuất PDF** để in bảng kết quả và **sao lưu dữ liệu thường xuyên**. · *Print result sheets and back up regularly from the export tab.*

## Dữ liệu & riêng tư / Data & privacy

Toàn bộ dữ liệu nằm trong bộ nhớ của trình duyệt **trên chính thiết bị đang dùng** — không có máy chủ, không gửi đi đâu, mỗi thiết bị một bộ dữ liệu riêng. Hãy sao lưu định kỳ (tab Lọc & Xuất PDF) và giữ file sao lưu ở nơi an toàn. · *All data lives in the browser storage of the device itself — no server, nothing is sent anywhere, each device keeps its own dataset. Back up regularly and keep backup files safe.*

## Hạn chế cần biết / Known limitations

- Chưa đồng bộ tự động giữa nhiều máy — chuyển dữ liệu bằng file sao lưu/gộp thủ công. · *No automatic multi-device sync yet — transfer data with backup/merge files.*
- Quét mã bằng camera và nhập giọng nói cần Chrome trên Android. · *Camera scanning and voice input require Chrome on Android.*
- Màu nền đầu bảng khi in cần bật tùy chọn "Đồ họa nền / Background graphics" trong hộp thoại in của Chrome. · *Print header colours need "Background graphics" enabled in Chrome's print dialog.*
- Giao diện hiện bằng tiếng Việt. · *The interface is currently Vietnamese.*

## Dùng thử ngay / Try it now

👉 **[Mở bản live demo / Open the live app](https://nguyentruongcongminh.github.io/lab-entry-app/)** — chạy ngay trên trình duyệt điện thoại hoặc máy tính, không cần cài đặt hay đăng ký. / *Runs right in your phone or desktop browser — no install, no sign-up.*

## Giấy phép / License

[MIT](LICENSE) © 2026 Truong Cong-Minh Nguyen

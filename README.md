# LabEntry

**Ứng dụng quản lý kết quả xét nghiệm thủ công cho phòng xét nghiệm** — tiếp nhận mẫu bằng quét mã vạch, nhập và phát hành kết quả, đóng dấu kỹ thuật viên có mã PIN bảo vệ, và in bảng kết quả tùy biến hoàn toàn. Chạy ngay trên điện thoại, không cần máy chủ, dữ liệu lưu tại máy.

**Manual lab test results manager for small laboratories** — barcode sample intake, result entry and release, PIN-protected technician stamps, and fully customizable printable result sheets. Runs right on a phone, no server needed, data stays on the device.

🔗 **Dùng thử / Live demo:** https://nguyentruongcongminh.github.io/lab-entry-app/

📥 **Tải ứng dụng / Download the app:**

- 🤖 **Android (APK):** [**Tải LabEntry cho Android (v1.0.0-trial3)**](https://github.com/nguyentruongcongminh/lab-entry-app/releases/download/android-v1.0.0-trial3/LabEntry-trial3.apk) — bản chạy trực tiếp trên điện thoại Android (6.0 trở lên, ~3,3 MB): ruột ứng dụng luôn là bản mới nhất như bản web, thêm **báo thức hệ thống kêu + rung đúng giờ nhập kết quả ngay cả khi app đã đóng**, và quét mã vạch bằng camera ngay trong app. Cài đặt: mở file APK, cho phép cài ứng dụng từ tệp/trình duyệt khi máy hỏi. · *Native Android app: always-current web core, plus OS-level due-time alarms that ring and vibrate even when the app is fully closed, and in-app barcode scanning.*
- 🍎 **iOS:** đang thử nghiệm — link tải sẽ cập nhật sau. · *iOS: in testing — download link coming soon.*
- 🌐 **Bản web / Web version:** dùng ngay tại link demo ở trên, không cần cài đặt. · *Runs instantly in the browser via the demo link above.*

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
| ![Báo động tới giờ nhập kết quả](screenshots/10-bao-dong-toi-gio.png) | ![Nút nhắc qua Lịch](screenshots/11-nut-nhac-lich.png) |
| *Banner đỏ báo mẫu tới giờ nhập kết quả, mẫu KHẨN xếp đầu · Red banner for samples due for result entry, STAT sample first* | *Nút 🔔 Lịch cạnh đồng hồ đếm ngược, chỉ trên điện thoại · 🔔 Calendar button next to the countdown, mobile only* |
| ![Hướng dẫn cài nhắc lịch](screenshots/12-huong-dan-cai-lich.png) | ![Bàn giao ca](screenshots/13-ban-giao-ca.png) |
| *Hộp thoại hướng dẫn cài nhắc Lịch, không tự tắt · Persistent calendar-reminder setup guide* | *Bàn giao ca: mọi mẫu chưa xong, kể cả tồn từ ngày trước · Shift handover: every unfinished sample, including previous days' leftovers* |
| ![Nhật ký thao tác](screenshots/14-nhat-ky-thao-tac.png) | |
| *Nhật ký thao tác: ai làm gì, lúc nào · Audit log: who did what, when* | |

![Giao diện trên máy tính](screenshots/09-ban-pc.png)
*Trên máy tính: khung rộng, trang tùy chỉnh in hiện đủ mọi cột của tờ kết quả · On desktop: wide layout, the print studio shows the full result sheet*

## Tính năng chính / Key features

- **Tiếp nhận mẫu bằng mã vạch** — quét liên tục bằng camera điện thoại, hỗ trợ máy quét mã vạch cầm tay (kiểu bàn phím), hoặc nhập tay. Chặn trùng mã + trùng loại xét nghiệm. · *Barcode intake — continuous camera scanning, handheld wedge scanners, or manual entry. Duplicate sample + test-type combinations are blocked.*
- **Theo dõi 3 trạng thái rõ ràng** — Chưa kết quả / Chờ phát hành / Đã phát hành; danh sách mẫu chờ quá 60 phút tự tô đỏ kèm thời gian chờ; các xét nghiệm hẹn giờ có đồng hồ đếm ngược từng mẫu và báo chuông khi tới giờ nhập kết quả — báo động lặp lại mỗi 15 giây trong 15 phút đầu quá giờ, kèm banner đỏ cố định, thông báo hệ thống và giữ màn hình sáng trong lúc đếm. Phát hành ngay không cần bấm xác nhận, và có thể **hủy phát hành** để sửa lại khi cần. · *Three clear statuses, overdue highlighting after 60 minutes, and per-sample countdown timers for timed tests with a repeating audible alert when the result-entry time comes, a persistent red banner, system notifications and a screen wake lock while counting. Release is instant with no confirmation dialog, and a release can be undone when a correction is needed.*
- **Nhập kết quả nhanh** — trường nhập thay đổi theo từng loại xét nghiệm, nút nhập nhanh tự định nghĩa (một chạm điền sẵn bộ kết quả thường gặp), nhập bằng giọng nói tiếng Việt. · *Fast result entry — dynamic per-test fields, user-defined one-tap quick-result buttons, Vietnamese voice input.*
- **Đóng dấu kỹ thuật viên có mã PIN** — mỗi mẫu tự ghi tên KTV nhận / thực hiện / phát hành theo người đang trực. Đổi người trực **phải nhập đúng mã PIN 6 ký tự** của người đó; PIN chỉ được lưu dạng **băm SHA-256 kèm muối** nên kể cả trong file sao lưu cũng không ai đọc được PIN gốc, mang sang máy khác vẫn dùng PIN cũ bình thường. · *Technician stamps with PIN protection — every sample records who received / performed / released it. Switching the on-duty technician requires that person's 6-character PIN; PINs are stored only as salted SHA-256 hashes, so backups never expose them while still working on other devices.*
- **Cổng người trực & nhật ký thao tác** — chưa chọn KTV trực thì không thể tiếp nhận, lưu, phát hành hay xóa mẫu, tránh thao tác không rõ người làm. Mọi thao tác quan trọng đều được ghi nhật ký: nhận mẫu, sửa kết quả (kèm giá trị cũ → mới), phát hành/hủy phát hành, xóa mẫu, đổi người trực, sao lưu/phục hồi; nhật ký đi theo file sao lưu và xem được ngay trong ứng dụng — riêng mã PIN không bao giờ được ghi vào nhật ký. · *On-duty gate & audit log — with no technician on duty, intake, saving, releasing and deleting are blocked. Key actions are logged (sample receipt, result edits with old → new values, release/un-release, deletions, operator changes, backup/restore); the log travels with the backup file and is viewable in-app — PINs are never logged.*
- **Hỗ trợ ca trực** — nhắc sao lưu khi đã quá 3 ngày chưa sao lưu; trang **Bàn giao ca** liệt kê toàn bộ mẫu chưa xong (kể cả tồn từ ngày trước) để in hoặc sao chép; gắn cờ **KHẨN** cho mẫu ưu tiên (luôn xếp đầu danh sách và banner báo động); tự khóa người trực sau vài phút không thao tác; tùy chọn **đọc to** mã mẫu khi tới giờ; và **quét mã để tìm mẫu** ngay trong tab Quản lý. · *Shift-work support — a backup reminder after 3 days without one, a handover page listing every unfinished sample (including previous days' leftovers) to print or copy, a STAT urgent flag that sorts first in lists and the alarm banner, operator auto-lock after inactivity, optional spoken due-sample alerts, and scan-to-find in the Manage tab.*
- **Nhắc tới giờ qua Lịch điện thoại (chỉ trên điện thoại)** — cạnh đồng hồ đang đếm có nút **🔔 Lịch**: bấm để tải một file lịch (.ics), thêm vào Lịch của máy là chuông sẽ kêu đúng giờ phải nhập kết quả **kể cả khi ứng dụng đã đóng hay thu nhỏ**, kèm hộp thoại hướng dẫn từng bước không tự tắt. Trên máy tính nút này không hiện — không cần, vì cửa sổ ứng dụng luôn mở. Nhận mẫu mới xong, ứng dụng tự chuyển sang tab Quản lý — khung Chưa kết quả để xử lý tiếp hàng chờ. · *Phone-calendar due reminders (mobile only) — a 🔔 button next to a running countdown downloads a calendar file (.ics); add it to the phone's Calendar and it rings exactly at the due time even with the app closed or minimised, with a persistent step-by-step setup guide. The button is hidden on desktop, where it isn't needed. After new samples are received, the app automatically switches to the Manage tab's no-result panel.*
- **Bản in tùy biến sâu** — logo, đầu trang cơ quan, 12 cột bật/tắt–đổi tên–kéo thứ tự, tách cột Kết quả thành từng cột riêng theo trường, nhóm theo ngày/loại, mẫu bố cục lưu sẵn, chữ ký, khổ A4/A5 ngang/dọc. Đầu trang 3 vùng: khối đơn vị ở giữa, vùng bên phải là khối kiểm soát tài liệu (mã tài liệu, lần ban hành, ngày hiệu lực...) kèm **mã vạch Code128** của mã tài liệu, hoặc một ảnh thứ hai (logo/con dấu). Xuất thêm CSV kèm thống kê thời gian trả kết quả (TAT). · *Deeply customizable printouts — logo, letterhead, 12 toggleable/renamable/reorderable columns, split result columns, grouping, saved presets, signature blocks, A4/A5 portrait/landscape. Three-zone header: a centred organisation block, and a right zone holding a document-control box (document code, revision, effective date...) with a **Code128 barcode** of the document code, or a second image (logo/stamp). CSV export with turnaround-time stats.*
- **Sao lưu trọn gói & gộp dữ liệu** — một file sao lưu mang theo mẫu, danh mục, danh sách KTV (kèm băm PIN), bố cục in và thư viện mẫu in; phục hồi nguyên trạng hoặc **gộp** thêm phần chưa có khi chuyển dữ liệu giữa các máy. Khi **phục hồi**, KTV trực tự đặt về "chưa chọn" để người dùng máy tự chọn lại ca trực (nhập PIN); khi **gộp**, máy giữ nguyên người đang trực. · *Full-package backup & merge — one backup file carries samples, catalogue, staff list (with PIN hashes), print layout and presets; restore wholesale or merge only what's missing when moving data between devices. Restoring resets the on-duty technician to none so the shift is picked again (with PIN); merging keeps the device's current operator.*
- **Cài đặt như ứng dụng, chạy không cần mạng, dùng tốt cả trên máy tính** — thêm vào màn hình chính điện thoại và dùng offline; trên máy tính ứng dụng tự mở khung rộng (trang tùy chỉnh bản in hiện đủ mọi cột, dễ đọc). Danh mục loại xét nghiệm tự thêm/sửa được ngay trong ứng dụng. · *Installable (PWA), offline-capable, and desktop-friendly — on a computer the layout widens automatically (the print studio shows the full sheet, every column readable). The test catalogue is editable in-app.*

## Cập nhật gần đây / Recent updates

- **Android (APK) v1.0.0-trial3** — **Có bản Android chính thức** (xem mục Tải ứng dụng ở đầu trang): báo thức tới giờ do hệ điều hành phụ trách — kêu + rung ngay cả khi app đã đóng hẳn, quét mã vạch bằng camera trong app. · *Official Android app: OS-level due-time alarms (ring + vibrate even when fully closed) and in-app camera scanning.*
- **v50** — Mọi danh sách mẫu xếp theo **thứ tự tiếp nhận** (nhận trước ở trên): tab Hôm nay, hai khung Quản lý, tab Lọc & Xuất, trang bàn giao ca và banner mẫu tới giờ. Mẫu KHẨN giữ nhãn đỏ + nền đỏ nhưng không còn nhảy lên đầu. · *All sample lists now follow intake order; STAT samples keep their red tag/highlight but no longer jump to the top.*
- **v49** — **Nhập kết quả theo lô**: nhập một lúc nhiều mẫu chưa có kết quả của cùng một loại, theo đúng thứ tự tiếp nhận (nhận trước nhập trước). Trên máy tính hiện dạng bảng lưới (chạm ô để chọn mức, nút "Âm tính cả cột"); trên điện thoại hiện dạng thẻ từng mẫu với nút "Lưu & mẫu tiếp theo". Mở từ tab Quản lý → "🧮 Nhập kết quả theo lô". · *Batch result entry for pending samples of one test type, in exact intake order: full grid on desktop, one-sample card flow with next-sample navigation on phones.*
- **v48** — Sửa lỗi bố cục form nhập kết quả: tên chỉ mục ở các ô nhập chữ bị ép hẹp khi có nút nhập giọng nói. · *Fixed squeezed field labels in the result-entry form when the voice-input button is present.*
- **v47** — Thêm đường đồng bộ báo thức cho bản iOS (đang thử nghiệm). · *Added the alarm-sync path for the iOS build (in testing).*
- **v46** — Móc đồng bộ báo thức native: khi chạy trong app Android, danh sách mẫu đang đếm giờ được gửi sang hệ điều hành đặt báo thức. · *Native alarm sync hook used by the Android app.*
- **v45** — Hướng dẫn cài nhắc Lịch chuyển từ thông báo thoáng qua sang hộp thoại cố định, đọc thong thả; nút nhắc Lịch chỉ hiện trên điện thoại, ẩn trên máy tính. · *Calendar-setup guide is now a persistent dialog instead of a fleeting toast; the calendar button is mobile-only.*
- **v44** — Nhắc tới giờ qua Lịch điện thoại (file .ics có chuông báo đúng giờ); nhận mẫu mới tự chuyển sang tab Quản lý, khung Chưa kết quả. · *Phone-calendar due reminders (.ics with an alarm); auto-switch to the Manage tab after sample intake.*
- **v43** — Gói ca trực: nhắc sao lưu, trang bàn giao ca, cờ KHẨN, tự khóa người trực, đọc to mẫu tới giờ, quét tìm mẫu. · *Shift package: backup reminder, handover page, STAT flag, operator auto-lock, spoken due alerts, scan-to-find.*
- **v42** — Báo động tới giờ nhập kết quả cho các xét nghiệm hẹn giờ: lặp lại mỗi 15 giây trong 15 phút đầu, banner đỏ cố định, thông báo hệ thống, giữ màn hình sáng khi đang đếm. · *Due-time alerts for timed tests: repeating alerts, persistent red banner, system notifications, wake lock.*
- **v41** — Cổng người trực (chưa chọn KTV thì khóa thao tác) và nhật ký thao tác đi theo file sao lưu. · *On-duty operator gate and a built-in audit log that travels with backups.*
- **v40** — Đầu trang in 3 vùng, khối kiểm soát tài liệu kèm mã vạch Code128. · *Three-zone print header with document-control box and Code128 barcode.*

## Bắt đầu nhanh / Quick start

1. Mở ứng dụng bằng **Chrome** (cần Chrome để quét mã bằng camera và nhập giọng nói). · *Open the app in Chrome (required for camera scanning and voice input).*
2. Ở mục **KTV trực**, bấm **Quản lý** để thêm kỹ thuật viên kèm mã PIN của từng người, rồi chọn người đang trực. · *Add technicians with their PINs, then pick who is on duty.*
3. Bấm **+** hoặc **Quét mã** để tiếp nhận mẫu; nhập kết quả, bấm **Phát hành** khi xong. · *Receive samples, enter results, release when done.*
4. Sang tab **Lọc & Xuất PDF** để in bảng kết quả và **sao lưu dữ liệu thường xuyên**. · *Print result sheets and back up regularly from the export tab.*

## Cài đặt & dùng không cần mạng / Install & offline use

- **Cài như một ứng dụng thật** — mở ứng dụng bằng Chrome, bấm menu **⋮** rồi chọn **"Cài ứng dụng"** (hoặc "Thêm vào màn hình chính"): biểu tượng LabEntry xuất hiện ngay trên màn hình chính, mở lên chạy toàn màn hình như ứng dụng thường. Trên máy tính, bấm biểu tượng cài đặt ở cuối thanh địa chỉ của Chrome. · *Install it like a real app — open it in Chrome, tap the ⋮ menu and choose "Install app" (or "Add to Home screen"): the LabEntry icon lands on the home screen and opens full-screen like a regular app. On a computer, use the install icon at the end of Chrome's address bar.*
- **Chạy hoàn toàn không cần mạng** — sau lần mở đầu tiên, ứng dụng tự lưu sẵn trên thiết bị: mất mạng vẫn tiếp nhận mẫu, nhập và phát hành kết quả, in bảng kết quả bình thường; khi có mạng lại, ứng dụng tự cập nhật lên bản mới nhất. · *Fully offline after the first visit — the app stores itself on the device, so sample intake, result entry, release and printing all keep working with no connection; updates arrive automatically once you are back online.*

## Dữ liệu & riêng tư / Data & privacy

Toàn bộ dữ liệu nằm trong bộ nhớ của trình duyệt **trên chính thiết bị đang dùng** — không có máy chủ, không gửi đi đâu, mỗi thiết bị một bộ dữ liệu riêng. Hãy sao lưu định kỳ (tab Lọc & Xuất PDF) và giữ file sao lưu ở nơi an toàn. · *All data lives in the browser storage of the device itself — no server, nothing is sent anywhere, each device keeps its own dataset. Back up regularly and keep backup files safe.*

## Giấy phép / License

[MIT](LICENSE) © 2026 Truong Cong-Minh Nguyen

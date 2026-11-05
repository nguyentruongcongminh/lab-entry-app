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

Hai nhóm danh sách — hiển thị dạng **một khung tại một thời điểm** (v23 theo yêu cầu của Minh; trước đó v21 cả hai nhóm xếp chồng, Chưa kết quả trên): mặc định mở tab là khung **Chưa kết quả**; phía trên danh sách có **2 nút chuyển khung kèm số đếm** ("Chưa kết quả (n)" / "Chờ phát hành (m)"), bấm nút mới chuyển sang khung Chờ phát hành. Thứ tự ưu tiên thao tác giữ nguyên: nhập kết quả trước, phát hành sau.

- **Chưa kết quả**: đã tạo ID nhưng chưa nhập trường kết quả nào. Sắp xếp theo **giờ nhận mẫu** (thời điểm nhập ID vào app, chính xác tới giây): **nhận trước lên đầu, nhận sau xuống cuối** — để xử lý theo thứ tự mẫu tới.
- **Chờ phát hành**: đã có kết quả nhưng chưa có ngày giờ phát hành. Sắp xếp: mới nhất lên đầu.

Nhóm rỗng hiển thị "Không có kết quả" (đúng như ảnh mẫu).

### F3b — Nút Phát hành + cách mở sửa (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Mỗi kết quả ở trạng thái **Chờ phát hành** có thêm **nút Phát hành** (icon gửi, màu xanh) ngay trên dòng: bấm → ghi **Ngày giờ phát hành = thời điểm hiện tại** ngay lập tức — **không hỏi xác nhận lại** (bỏ hộp confirm theo yêu cầu của Minh) — kết quả chuyển sang Đã phát hành và rời nhóm Chờ phát hành. Kết quả chưa có nội dung (Chưa kết quả) hoặc đã phát hành thì không hiện nút này.
- **Muốn sửa phải bấm nút cây bút** trên dòng. Bấm trực tiếp vào dòng hoặc vào ID **không** mở form sửa.
- **Nút + có ở cả tab Quản lý** Nút + đã thu nhỏ còn **48px** và cuối danh sách Hôm nay/Chưa kết quả có chừa khoảng trống cuộn 148px để dòng cuối không bị nút + che mất các nút chức năng (v16, theo phản ánh của Minh). (bổ sung theo yêu cầu của Minh, 2026-11-04): nút + là nút dùng chung, hiện ở tab Kết quả hôm nay và tab Quản lý; ẩn ở tab Lọc & Xuất PDF và khi đang mở form.
- **Lưu xong giữ nguyên tab đang dùng**: bấm Lưu (hoặc Hủy) ở form thì quay về đúng tab trước khi mở form (đang ở Quản lý thì ở lại Quản lý) — không tự chuyển về tab "Kết quả hôm nay" (bổ sung theo yêu cầu của Minh, 2026-11-04).

### F3d — Nút Xem lớn + bảng tóm tắt kết quả (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Kết quả **đã có nội dung** (Chờ phát hành hoặc Đã phát hành) có thêm **nút "Xem" lớn, nền xanh, cạnh ID** — nổi bật hơn các nút icon còn lại. Kết quả Chưa kết quả thì không có nút này.
- Bấm Xem mở **bảng tóm tắt** thiết kế gọn, chữ to, dễ đọc để nhìn và chép kết quả vào máy ở lab: ID (chữ rất lớn), loại XN, thẻ trạng thái, mỗi trường kết quả một dòng (nhãn bên trái, **giá trị chữ to đậm** bên phải; trường mức độ bỏ trống hiện "Âm tính", trường chữ bỏ trống hiện "—"), ghi chú nếu có, giờ nhận mẫu và giờ phát hành. Đóng bằng nút "Đóng" hoặc bấm ra ngoài bảng. **Trong trang xem có luôn nút "Phát hành kết quả"** khi kết quả đang Chờ phát hành — bấm là phát hành ngay (không hỏi lại) và **trang xem tự thoát về danh sách** (từ v26, theo yêu cầu của Minh — không bắt người dùng bấm thêm nút Đóng).

### F3c — Quét mã liên tục để tiếp nhận mẫu (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Mở quét từ **nút quét trên tab Kết quả hôm nay** (tiếp nhận mẫu) hoặc từ **nút quét trong form**.
- **Quét liên tục**: camera giữ mở và nhận mã nối tiếp nhau; mỗi mã hợp lệ tạo **ngay một bản ghi "Chưa kết quả"** với thời điểm nhận là hiện tại (phục vụ xếp thứ tự chờ nhập kết quả theo giờ nhận). Vòng quét **chỉ dừng khi người dùng bấm "Dừng quét"**.
- **Danh mục (loại xét nghiệm) KHÔNG khóa trong phiên** (v17 — Minh đổi ý so với quy tắc khóa ở bản đầu): đổi loại lúc nào cũng được ngay giữa phiên; mỗi mẫu nhận theo loại đang chọn tại thời điểm bắn mã đó. Danh sách mẫu của phiên hiện kèm tên loại của từng mẫu để khỏi nhầm.
- Mã **trùng ID + loại** trong lúc quét: báo "Đã tồn tại — bỏ qua", không tạo thêm, phiên vẫn tiếp tục.
- **Kết thúc phiên nhận từ nút +**: khi mở quét từ **form thêm mới** (nút +) và phiên có nhận được mẫu, bấm "Dừng quét" xong app **tự chuyển sang tab Quản lý** để xử lý hàng chờ — không giữ ở tab Kết quả hôm nay (theo yêu cầu của Minh, 2026-11-04). Mở quét từ nút quét của tab Hôm nay thì ở lại tab Hôm nay.
- **Chỉ quét bằng camera** (bản v9, theo yêu cầu của Minh): màn hình quét liên tục **không còn ô nhập tay + nút "Nhận mẫu"** — gọn và tập trung vào bắn mã. Ô nhập tay chỉ còn ở chế độ quét 1 mã từ form sửa. Máy/trình duyệt không hỗ trợ quét camera thì màn hình báo rõ và hướng dẫn mở bằng Chrome trên điện thoại.
- **Giao diện màn hình quét (bản v7)**: màn hình chuyên dụng **nền tối** kiểu ứng dụng quét mã chuyên nghiệp — tiêu đề phiên + chấm trạng thái "đang quét" nhấp nháy, **khung ngắm camera có 4 góc định vị và vạch quét chạy**, dòng trạng thái dạng băng màu (xanh khi nhận thành công, đỏ khi trùng/lỗi), khi loại bị khóa hiện **dòng chú thích khóa** kèm icon, danh sách mẫu đã nhận trong phiên nằm trong một thẻ riêng có dấu ✓ và giờ nhận, nút **Dừng quét màu đỏ** lớn ở cuối. Máy không hỗ trợ camera thì khung camera ẩn đi, chỉ còn ô nhập tay.
- **Bố cục chống tràn (bản v8)**: màn hình quét cố định toàn màn hình theo cột dọc — phần đầu, khung camera (giới hạn chiều cao 32% màn hình), băng trạng thái và ô nhập tay cố định; **chỉ danh sách mẫu của phiên cuộn** ở khoảng giữa; **nút Dừng quét luôn ghim ở đáy màn hình**, không bao giờ bị đẩy ra ngoài khung (bản v7 bị tràn, không thấy nút dừng trên điện thoại).
- Ngoại lệ: mở quét từ **form sửa** một bản ghi thì là chế độ 1 mã — nhận mã xong điền vào ô ID của form và tự đóng, không tạo bản ghi mới.

### F6 — Thống kê ngày, cảnh báo chờ lâu, tiếng bíp khi quét (bổ sung theo lựa chọn của Minh, 2026-11-04)

- **Thanh thống kê đầu tab Quản lý**: 4 ô — *Nhận hôm nay*, *Chưa kết quả* (tổng đang tồn), *Chờ phát hành* (tổng đang tồn), *Phát hành hôm nay*. Cập nhật mỗi lần mở/refresh tab.
- **Cảnh báo chờ lâu**: mẫu ở trạng thái Chưa kết quả hoặc Chờ phát hành mà đã chờ quá **60 phút** (cấu hình `overdueMinutes` trong config.js) kể từ giờ nhận sẽ bị **tô đỏ** kèm dòng "Đã chờ X giờ Y phút" trong cả tab Hôm nay và Quản lý. App tự làm mới danh sách mỗi phút (khi đang không thao tác) để mẫu vừa quá ngưỡng tự chuyển đỏ.
- **Tiếng bíp khi bắn mã** (WebAudio, không cần file nhạc): nhận thành công = 1 bíp cao ngắn (1320 Hz, 90 ms); quét trùng/lỗi = 1 bíp trầm dài hơn (240 Hz, 200 ms); kèm rung như trước. Máy không hỗ trợ âm thanh thì bỏ qua êm, không lỗi.

### F7 — Bấm giờ chờ kết quả cho test nhanh (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Loại XN khai báo `waitMinutes` trong config.js (hiện tại **Máu ẩn = 20 phút**; test nhanh khác chỉ cần thêm `waitMinutes` vào khai báo loại đó) thì các mẫu **chưa có kết quả** của loại đó có thêm **nút "Bấm giờ"** trên dòng.
- **Mỗi ID một đồng hồ riêng**: mốc kết thúc (`timerEndsAt`) lưu ngay trên bản ghi của mẫu đó — chạy song song bao nhiêu mẫu cũng được, tải lại trang không mất giờ đã bấm.
- Đang đếm: nút hiện **đếm ngược phút:giây** cập nhật mỗi giây; bấm vào nút đang đếm = **hủy bấm giờ**.
- **Tới giờ**: chuông báo riêng (3 tiếng bíp + rung dài + thông báo hiện tên ID), dòng mẫu **sáng đỏ nhấp nháy**, nút đổi thành **"Nhập KQ ngay"** — bấm mở thẳng form nhập kết quả của mẫu đó.
- Nhập kết quả cho mẫu xong thì đồng hồ của mẫu tự xóa.

### F8 — Sao lưu & phục hồi dữ liệu cục bộ (bổ sung theo yêu cầu của Minh, 2026-11-04)

- Ở cuối tab "Lọc & Xuất": khối **"Sao lưu & phục hồi dữ liệu"** với 2 nút — **Tải file sao lưu** và **Phục hồi từ file…**
- File sao lưu là JSON (`labentry-sao-luu-YYYYMMDD-HHmm.json`) chứa toàn bộ bản ghi kèm mốc thời gian xuất; giữ nguyên mọi trường (kết quả, giờ phát hành, hẹn giờ bấm giờ…).
- **Phục hồi = thay toàn bộ** dữ liệu hiện tại trên máy bằng dữ liệu trong file, sau hộp xác nhận nêu rõ số bản ghi + thời gian xuất của file. File phải qua kiểm tra hợp lệ (JSON đúng cấu trúc, mọi bản ghi có ID + loại XN hợp lệ, không trùng ID + loại trong nội bộ file); file hỏng/không hợp lệ bị từ chối và **không đụng vào dữ liệu hiện tại**.
- Mục đích: tự bảo vệ khi mất dữ liệu/xóa nhầm cache, đổi máy hoặc cài lại trình duyệt (trước đây Minh đã bỏ qua gợi ý này ở v14, nay chủ động yêu cầu thêm).

### F9 — Tự quản lý danh mục xét nghiệm trong app (bổ sung theo yêu cầu của Minh, 2026-11-04 — tính năng 1 trong gói giới thiệu)

- Nút ⚙ ở tab Quản lý mở màn hình **Loại xét nghiệm**: liệt kê danh mục đang dùng (số trường, phút bấm giờ, số bản ghi đang có), với **Sửa / Xóa** từng loại, nút **Thêm loại xét nghiệm** và **Khôi phục 6 loại mặc định**.
- Form loại: tên loại, số phút bấm giờ (để trống = không bấm giờ), danh sách trường kết quả — mỗi trường gồm nhãn + dạng (**Ô nhập chữ** hoặc **Nút chọn mức (+)** với 1/2/3 mức). Sửa loại giữ nguyên mã loại và khóa các trường cũ nên bản ghi đã nhập không bị ảnh hưởng.
- Ràng buộc an toàn: **không xóa được loại đang có bản ghi**; luôn giữ ít nhất 1 loại; khôi phục mặc định bị chặn khi còn bản ghi thuộc loại tự thêm.
- Bố cục form loại (v20, sửa theo phản ánh tràn màn hình của Minh): hàng "Các trường kết quả" xếp **dọc** (nhãn / thẻ từng trường / nút thêm trường nét đứt) thay vì chen ngang một hàng flex với nhãn; mỗi thẻ trường gồm nhãn ở dòng riêng, dưới là ô chọn dạng trường + ô chọn số mức + nút xóa; ô số phút bấm giờ dùng chung kiểu với các ô nhập khác; thanh Lưu/Hủy có đệm và form chừa đáy 96px không bị thanh cố định che.
- Danh mục tự tạo lưu ở localStorage (`labentry.types.v1`) của từng máy; chưa có thì dùng 6 loại mặc định trong config.js. File sao lưu (F8) từ bản này **kèm theo danh mục tự tạo**; phục hồi ở máy khác sẽ áp dụng cả danh mục trong file.

### F10 — Xuất CSV + thống kê thời gian trả kết quả (bổ sung theo yêu cầu của Minh, 2026-11-04 — tính năng 4)

- Tab Lọc & Xuất có thêm nút **Xuất CSV**: xuất đúng danh sách đang lọc ra file CSV (ngăn cách ";", BOM UTF-8 để Excel trên Windows đọc đúng tiếng Việt; cột cuối là thời gian trả kết quả tính bằng phút).
- Dưới dòng đếm kết quả có dòng **thống kê TAT**: số mẫu đã phát hành / tổng số, thời gian trả kết quả (phát hành − nhận mẫu) trung bình / nhanh nhất / lâu nhất, tính bằng `LabStore.tatStats` trên đúng danh sách đang lọc.

### F11 — Nhập kết quả bằng giọng nói tiếng Việt (bổ sung theo yêu cầu của Minh, 2026-11-04 — tính năng 5)

- Các ô **nhập chữ** trong form (trường kết quả dạng text + ô Ghi chú chung) có thêm **nút micro tròn** khi trình duyệt hỗ trợ Web Speech API (Chrome trên Android): bấm để nói tiếng Việt, app điền chữ vào ô (nói tiếp thì nối thêm vào cuối); bấm lần nữa để dừng; đang nghe nút chuyển đỏ nhấp nháy.
- Trường dạng nút chip không gắn micro (chọn tay chính xác hơn). Trình duyệt không hỗ trợ -> không hiện nút micro, app chạy bình thường.
- Giới hạn thật: nhận giọng dùng dịch vụ của Google nên **cần có mạng**; độ chính xác tùy phát âm/môi trường — người dùng phải kiểm tra lại nội dung trước khi lưu. Môi trường test tự động (jsdom) không có SpeechRecognition nên chỉ kiểm chứng được đường "không hỗ trợ"; đường nhận giọng thật cần thử trên Chrome Android.

### F12 — Gộp dữ liệu từ file sao lưu (bổ sung theo yêu cầu của Minh, 2026-11-04 — tính năng 2 trong danh sách giới thiệu đợt 2)

- Khối sao lưu ở tab Lọc & Xuất có thêm nút **Gộp dữ liệu từ file…** bên cạnh nút Phục hồi (thay toàn bộ).
- Gộp = chỉ thêm các bản ghi trong file mà máy này **chưa có** (theo cặp ID + loại xét nghiệm); bản ghi trùng bị bỏ qua và **giữ nguyên bản ghi đang có trên máy** (không bị file đè). Kết quả gộp được báo rõ: thêm bao nhiêu mẫu mới, bỏ qua bao nhiêu mẫu trùng.
- Danh mục kèm file khi gộp được **hợp nhất**: chỉ thêm các loại máy này chưa có (theo mã loại), không thay danh mục hiện tại. File vẫn phải qua cùng kiểm tra hợp lệ như phục hồi; file hỏng bị từ chối, dữ liệu không đổi.
- Mục đích: nhiều máy/điện thoại cùng nhận mẫu, cuối ngày dồn dữ liệu về một máy bằng file sao lưu mà không mất dữ liệu của nhau.

### F13 — Hỗ trợ máy quét mã vạch cầm tay (bổ sung theo yêu cầu của Minh, 2026-11-04 — tính năng 5 trong danh sách giới thiệu đợt 2)

- Máy quét USB/Bluetooth (dạng giả lập bàn phím) dùng được ngay trong màn hình quét, song song với camera: app nhận diện **chuỗi ký tự gõ rất nhanh (<60ms/ký tự, tối thiểu 3 ký tự) kết thúc bằng Enter** và xử lý như một mã camera vừa bắn (`wedgeKey` trong app.js, chỉ hoạt động khi màn hình quét đang mở).
- Người gõ tay chậm vào ô nhập tay không bị nhận nhầm thành mã quét; khi đang thao tác với ô chọn loại (select) app cũng không can thiệp.
- Giới hạn thật: máy quét phải ở chế độ gửi Enter (CR) sau mã — chế độ mặc định của hầu hết máy quét; test tự động kiểm chứng bằng chuỗi phím mô phỏng theo đúng ngưỡng thời gian, phần cứng máy quét thật cần thử tại khoa.

### F14 — Cài đặt như ứng dụng (PWA) (bổ sung theo yêu cầu của Minh, 2026-11-04 — tính năng 2 trong gói giới thiệu)

- App đáp ứng chuẩn PWA: `manifest.webmanifest` (tên LabEntry, hiển thị standalone, theme #1e88e5, icon 192/512 + maskable) + `sw.js` (service worker) + apple-touch-icon cho iOS. Người dùng mở địa chỉ HTTPS → trình duyệt cho **Cài đặt ứng dụng** lên màn hình chính, mở toàn màn hình như app thật, và **chạy offline hoàn toàn** sau lần mở đầu (mọi file chương trình được cache; dữ liệu vẫn là localStorage riêng của từng máy, không nằm trong cache này).
- Cập nhật: số phiên bản trong `sw.js` (`VERSION`) và danh sách precache `?v=N` **phải khớp số bản phát hành** — đây là bước bắt buộc trong quy trình ra bản. SW mới kích hoạt ngay (skipWaiting + clients.claim), cache của bản cũ bị xóa; phía trang (app.js `registerServiceWorker`) nghe `controllerchange` và tự tải lại đúng một lần **chỉ khi đang rảnh** (không mở form/quét/xem) — đang thao tác dở thì bản mới áp dụng ở lần mở kế tiếp. Điều hướng mở app là network-first nên có mạng là nhận bản mới nhất.
- Chia sẻ cho người khác = gửi địa chỉ HTTPS; mỗi người tự cài trên máy mình và bắt đầu với dữ liệu trống của riêng họ. Bản 1 file (`lab-entry-single.html`) không phải PWA (không cài đặt được, chỉ mở xem/dùng trong trình duyệt).
- Giới hạn thật: cài đặt PWA cần HTTPS (bản GitHub Pages đạt); quét QR bằng camera vẫn cần BarcodeDetector (Chrome Android) và nhập giọng nói vẫn cần Chrome — PWA không thay đổi các giới hạn nền tảng đó; jsdom không chạy được service worker nên test tự động chỉ kiểm chứng khai báo manifest/icon/phiên bản SW và app vẫn chạy bình thường khi trình duyệt không có service worker — hành vi cài đặt/offline thật cần thử trên điện thoại.

### F15 — Nút nhập kết quả nhanh theo loại xét nghiệm (bổ sung theo yêu cầu của Minh, 2026-11-05)

- Mỗi loại xét nghiệm có thể định nghĩa tối đa **8 nút nhập nhanh** (trường `quick` trong định nghĩa loại: `[{label, values}]`, `values` gắn giá trị cho từng khóa trường; trường chips nhận `''` = bỏ chọn/âm tính hoặc một mức trong `levels`, trường text nhận chuỗi). Khai báo này đi cùng danh mục: sửa trong app qua trình quản lý loại (F9), nằm trong file sao lưu/gộp như phần còn lại của danh mục, và được `validateTypeDefs` kiểm tra (tên nút bắt buộc, khóa phải tồn tại, mức chip phải hợp lệ).
- Trong **form nhập kết quả**, các nút của loại đang chọn hiện thành **một hàng nút nhỏ gọn** (dạng viên, tự xuống dòng) ngay trên khu vực trường kết quả; loại không có nút thì không hiện gì. Bấm một nút = **điền cả bộ kết quả** theo mẫu (trường không khai trong mẫu = để trống) — **không tự lưu**, người dùng xem lại/sửa tiếp rồi bấm Lưu như thường.
- Trong **trình sửa loại**, mỗi nút là một thẻ: ô tên nút + một ô giá trị cho từng trường kết quả hiện có của loại (ô chữ cho trường text, ô chọn mức có thêm lựa chọn "Âm tính (bỏ trống)" cho trường chips) + nút xóa. Thêm/xóa trường hoặc đổi dạng trường thì các thẻ tự dựng lại theo bộ trường mới.
- Mặc định ban đầu: các loại Cạo tìm nấm, Soi nhuộm mực tàu DNT, Soi tinh thể dịch, Máu ẩn và SP có sẵn nút **"Âm tính"**; Soi tươi huyết trắng không cài sẵn (các trường đếm của nó không có mẫu âm tính chung) — người dùng tự thêm theo thói quen của khoa.

### F16 — Tự chuyển khung Chưa kết quả khi nhận mẫu mới ở tab Quản lý (bổ sung theo yêu cầu của Minh, 2026-11-05)

- Tab Quản lý đang hiện khung **Chờ phát hành** (xem F3/v23) mà có **mẫu mới được nhận** thì khung tự chuyển về **Chưa kết quả** để mẫu mới hiện ngay: áp dụng cho cả ba đường nhận mẫu — quét liên tục (mỗi mã nhận thành công trong phiên, kể cả khi phiên quét mở từ tab khác rồi quay về Quản lý), và lưu form ở chế độ **thêm mới** khi đang đứng ở tab Quản lý.
- Chỉ áp dụng khi *thêm mới thành công*; sửa bản ghi cũ hoặc quét trùng (bị bỏ qua) không làm chuyển khung.

### F17 — Đóng dấu KTV theo thao tác + Hủy phát hành (bổ sung theo yêu cầu của Minh, 2026-11-05)

- Bản ghi có 3 trường dấu tên: `receiver` (KTV nhận), `performer` (KTV thực hiện), `releaser` (KTV phát hành) — chuỗi tên chụp tại thời điểm thao tác, `''` = chưa ghi. File sao lưu cũ không có các trường này vẫn phục hồi bình thường (dấu mặc định rỗng); dấu đi theo bản ghi khi sao lưu/gộp.
- **Danh sách KTV** (localStorage `labentry.staff.v1`): quản lý trong hộp thoại mở từ thanh "KTV trực" ở tab Kết quả hôm nay (thêm/xóa tên). **KTV trực** (localStorage `labentry.operator.v1`) là người đang thao tác: chọn một lần, nhớ giữa các phiên, đổi 1 chạm; ô chọn có ở tab Hôm nay và trong màn hình quét (đồng bộ hai nơi).
- **Quy tắc đóng dấu:** tạo bản ghi (quét liên tục/thêm tay) → `receiver` = KTV trực; **mỗi lần lưu mà bản ghi có kết quả** → `performer` = KTV trực lúc lưu (đang sửa kết quả trong form thì ô KTV thực hiện tự chuyển sang người trực; xóa hết kết quả → xóa dấu thực hiện); đặt giờ phát hành (nút trên dòng / nút trong Xem / lưu form) → `releaser` = KTV trực lúc phát hành. Form nhập có khối "Kỹ thuật viên" gồm 3 ô chọn để **sửa tay** từng dấu (nhập hộ/sửa sai). Chưa chọn KTV trực thì không chặn thao tác nào — dấu để trống, in ra "—".
- **Hủy phát hành:** nút "Hủy phát hành" trong trang Xem (hiện khi đã phát hành), **hỏi xác nhận 1 lần**; hủy xong xóa giờ phát hành + dấu `releaser`, bản ghi quay về Chờ phát hành, trang Xem tự thoát. Phát hành xong trang Xem cũng tự thoát (F3, từ v26). Trang Xem hiện khối KTV khi bản ghi có ít nhất một dấu.

### F18 — Tùy chỉnh bố cục bản in PDF, đợt 1 (theo thiết kế PRINT-LAYOUT-DESIGN.md đã được Minh duyệt, 2026-11-05)

- Cấu hình lưu ở localStorage `labentry.print.v1`; chưa có cấu hình thì dùng **mặc định = đúng bố cục bản in cũ** (7 cột, Arial 12.5, không đầu trang/chữ ký). `renderSheet(settings, records)` dựng toàn bộ tờ kết quả (dùng cho cả vùng in thật và xem trước).
- **Đầu trang:** logo (tải ảnh, tự nén ≤360px thành data URL; vị trí trái/giữa/phải; cỡ nhỏ/vừa/lớn), tên đơn vị, khoa/phòng, địa chỉ, điện thoại, email (dòng nào trống thì không in), kiểu xếp logo-một-bên/căn giữa, đường kẻ dưới đầu trang, tiêu đề bản in tùy ý, phụ đề khoảng ngày.
- **Cột:** 12 cột khả dụng (STT, ID, Loại, Kết quả gộp, Ghi chú, Giờ nhập, Giờ phát hành, Trạng thái, Thời gian chờ, KTV nhận/thực hiện/phát hành) — mỗi cột bật/tắt, đổi tên, đổi thứ tự (↑↓), độ rộng % (0 = tự động), căn lề. Ba cột KTV mặc định **tắt**.
- **Kiểu dáng:** khổ A4/A5, hướng dọc/ngang (sinh `@page` động), lề hẹp/vừa/rộng, font Times/Arial, cỡ chữ, mật độ dòng, kẻ bảng đầy đủ/ngang/không.
- **Chân trang & chữ ký:** dòng ghi chú tự do, ngày giờ in, dòng thống kê TAT vào bản in (bật/tắt), tối đa 3 ô chữ ký (bật/tắt, chức danh, họ tên).
- **Trang chỉnh** (nút "🎨 Tùy chỉnh bản in" ở tab Xuất): xem trước trực tiếp bằng dữ liệu mẫu, thay đổi áp dụng + lưu ngay, nút In thử (in với dữ liệu đang lọc), nút Khôi phục mặc định.
- **Đợt 2 (đã làm ở v28):** (a) *Tách cột kết quả theo trường* — cấu hình `resultsMode: 'grouped' | 'split'`; chế độ split nở cột Kết quả thành một cột cho mỗi NHÃN trường, khử trùng theo nhãn trên mọi loại có trong danh sách in (loại không có trường đó thì ô trống; chip trống hiện "Âm tính", text trống hiện "—" như chế độ gộp). (b) *Mẫu bố cục (presets)* — lưu nhiều bộ cấu hình có tên ở localStorage `labentry.print.presets.v1` (lưu/ghi đè có hỏi/dùng/xóa có hỏi), thanh mẫu nằm ngay dưới khung xem trước của trang tùy chỉnh. (c) *Bố cục đi kèm file sao lưu* — file sao lưu luôn kèm khóa `printLayout`; phục hồi (thay toàn bộ) thì áp dụng luôn bố cục trong file (hộp thoại xác nhận có ghi rõ), gộp dữ liệu thì không đụng tới bố cục; file cũ không có khóa này phục hồi bình thường. (d) *Phân nhóm* — `groupBy: 'none' | 'day' | 'type'` chèn dòng tiêu đề nhóm (ngày nhận dd/mm/yyyy hoặc tên loại XN) vào bảng; STT vẫn đánh liên tục toàn danh sách. (e) *Sọc xen kẽ + màu hàng tiêu đề* — `zebra` tô nền nhạt các dòng dữ liệu lẻ (đánh dấu bằng lớp `alt` khi dựng bảng, không dùng nth-child vì có dòng nhóm xen giữa); `headerColor` chọn trong 5 màu (xám/xanh nhạt/vàng nhạt/xanh lá nhạt/xám đậm chữ trắng) qua biến CSS `--sh-head`; in màu cần bật "Đồ họa nền" trong hộp thoại in.
- Sửa lỗi v28: ô nhập tên KTV trong hộp thoại danh sách bị một quy tắc CSS cũ (`.modal-box .primary-btn { width: 100% }`, vốn dành cho nút Phát hành ở trang Xem) bóp về rộng 0px trong hàng flex nên người dùng không thấy chỗ nhập; đã ghi đè cho hàng thêm KTV (và hàng nhập tay ở màn quét, cùng bệnh) + đưa hàng nhập lên đầu hộp thoại.

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
16. Quét liên tục: nhận nhiều mã trong một phiên, mỗi mã tạo 1 bản ghi Chưa kết quả; loại XN đổi được giữa phiên và mỗi mẫu mang loại tại thời điểm bắn; trùng ID + loại bị bỏ qua kèm cảnh báo; chỉ dừng khi bấm "Dừng quét"; màn hình liên tục không có ô nhập tay/nút Nhận mẫu (chỉ quét camera); mở từ form sửa thì nhận 1 mã điền vào ô ID rồi tự đóng (ở chế độ này còn ô nhập tay dự phòng).

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

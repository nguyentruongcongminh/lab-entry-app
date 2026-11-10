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
- **Chờ phát hành**: đã có kết quả nhưng chưa có ngày giờ phát hành. Sắp xếp theo **giờ nhận mẫu**: nhận trước lên đầu, nhận sau xuống cuối (từ v50; trước đây mới nhất lên đầu).

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

- Các ô **nhập chữ** trong form (trường kết quả dạng text + ô Ghi chú chung) có thêm **nút micro tròn** khi trình duyệt hỗ trợ Web Speech API (Chrome): bấm để nói tiếng Việt, app điền chữ vào ô (nói tiếp thì nối thêm vào cuối); bấm lần nữa để dừng; đang nghe nút chuyển đỏ nhấp nháy.
- Trường dạng nút chip không gắn micro (chọn tay chính xác hơn). Trình duyệt không hỗ trợ -> không hiện nút micro, app chạy bình thường.
- Giới hạn thật: nhận giọng dùng dịch vụ của Google nên **cần có mạng**; độ chính xác tùy phát âm/môi trường — người dùng phải kiểm tra lại nội dung trước khi lưu. Môi trường test tự động (jsdom) không có SpeechRecognition nên chỉ kiểm chứng được đường "không hỗ trợ"; đường nhận giọng thật cần thử trên Chrome ở máy thật.

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
- Giới hạn thật: cài đặt PWA cần HTTPS (bản GitHub Pages đạt); quét QR bằng camera vẫn cần BarcodeDetector (Chrome) và nhập giọng nói vẫn cần Chrome — PWA không thay đổi các giới hạn nền tảng đó; jsdom không chạy được service worker nên test tự động chỉ kiểm chứng khai báo manifest/icon/phiên bản SW và app vẫn chạy bình thường khi trình duyệt không có service worker — hành vi cài đặt/offline thật cần thử trên điện thoại.

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

### F17b — Mã PIN của KTV (bổ sung theo yêu cầu của Minh, 2026-11-05)

- Mỗi KTV có một **mã PIN đúng 6 ký tự** (chữ/số/ký hiệu), đặt ngay khi thêm KTV trong hộp thoại danh sách (nhập 2 lần khớp nhau); nút Đặt PIN/Đổi PIN trong danh sách (đổi PIN phải nhập đúng PIN hiện tại trước). Bản ghi KTV trong `labentry.staff.v1` đổi sang dạng đối tượng `{ name, salt, pinHash }` — dữ liệu cũ dạng mảng chuỗi được tự di trú (pinHash = null, lần đầu chọn làm KTV trực sẽ được mời tạo PIN).
- **Cổng PIN:** đổi KTV trực (ở tab Hôm nay hoặc trong màn hình quét) sang tên có PIN thì phải nhập đúng PIN của người đó (sai thì báo lỗi và hỏi lại, Hủy thì giữ nguyên người trực; bỏ chọn về "chưa chọn" không hỏi). Trong form nhập, đổi tay một ô KTV sang người khác người trực mà người đó có PIN cũng phải nhập đúng PIN của họ. KTV chưa có PIN: khi được chọn làm trực lần đầu, app mời tạo PIN luôn.
- **Bảo mật PIN:** app **không bao giờ lưu PIN gốc** — chỉ lưu băm **SHA-256 kèm muối riêng** từng KTV (không có khóa giải mã, không đọc ngược được; trình duyệt thiếu WebCrypto thì dùng hàm băm dự phòng kèm muối). Vì vậy file sao lưu mang theo `staff` ở dạng băm: mở file ra không thấy PIN của ai, phục hồi/gộp sang máy khác thì băm đi theo và người dùng vẫn gõ PIN cũ để đổi trực bình thường (đây là cách "giải mã" đúng nghĩa cho nhu cầu kiểm tra PIN: chỉ cần kiểm tra khớp, không cần khôi phục gốc). Gộp dữ liệu hợp nhất danh sách theo tên như cũ.
- Giới hạn đã nêu rõ với Minh: PIN là lớp ngăn "chọn tên người khác tiện tay" trên máy dùng chung, không phải bảo mật cấp tài khoản — ai có quyền đào sâu dữ liệu trên máy vẫn có thể xóa KTV tạo lại; xóa KTV và việc chọn tên chưa có PIN vẫn không bị khóa PIN.

### F31 — Linh vật đồng ca "Bé kính hiển vi" (v55, 2026-11-08; ý tưởng số 13 trong IDEAS-BACKLOG, Minh duyệt hình + hành vi ngày 2026-11-08)

- Linh vật nhỏ (ảnh hiển thị 64px — v57 thu nhỏ từ 96px theo góp ý của Minh vì bản 96px choáng danh sách kết quả bên dưới; bong bóng cũng gọn lại: max-width 205px, chữ 12.5px) nổi ở góc phải dưới, **trên nút +**, chỉ hiện ở 3 tab chính (Hôm nay / Quản lý / Lọc & Xuất) và tự ẩn khi có hộp thoại/màn hình quét mở; là phần tử con trực tiếp của `body` nên `print.css` tự loại khỏi bản in. Thuần trang trí — **không đụng** dữ liệu, hẹn giờ, báo động, in ấn, sao lưu: trạng thái được tính lại mỗi giây ở cuối `timerTick()` trong `try/catch` riêng, chỉ đọc `store.getAll()`.
- **Trạng thái theo tình hình ca** (ưu tiên từ trên xuống; chỉ xét mẫu *Chưa kết quả*):
  1. `overdue` — có mẫu hẹn giờ **đã quá giờ**: bong bóng "Có mẫu quá giờ chưa nhập kết quả: {ID, …}", huy hiệu đỏ = số mẫu quá giờ, ảnh mặt lo (dùng chung ảnh `hurried`), nhịp rung nhanh.
  2. `hurried` — mẫu hẹn giờ gần nhất **còn ≤5 phút** (quy tắc của Minh): bong bóng gồm **ID + loại xét nghiệm + thời gian còn lại**, vd "⏰ XN-2612 · Máu ẩn · còn 4 phút tới giờ!", ảnh ôm đồng hồ bấm giờ, huy hiệu "!".
  3. `overload` — **từ 3 mẫu trở lên** (Minh chốt) chưa có kết quả mà đã chờ **quá 15 phút từ lúc nhận**: bong bóng liệt kê các ID "{ID, …} chờ quá 15 phút chưa nhập kết quả", ảnh ôm chồng giấy, huy hiệu = số mẫu.
  4. `waiting` — còn mẫu đang đếm giờ (>5 phút): "Đang chờ {ID} tới giờ… còn X phút ⏳" (mẫu gần nhất); hoặc còn mẫu chưa kết quả nhưng không hẹn giờ: câu động viên kèm số mẫu. Ảnh ôm đồng hồ cát.
  5. `calm` — không còn mẫu chưa kết quả: "Ca êm quá — không còn mẫu nào tồn! 🎉", ảnh hai tay giơ cao.
- **Ảnh mặc định** là nhân vật gốc "Bé kính hiển vi" do AI vẽ cho dự án (4 biểu cảm: vui / chờ / vội / lo), nhúng dạng data URI WebP trong `mascot.js` (`window.LABENTRY_MASCOTS`) để chạy offline và đóng gói 1 file — tổng ~94 KB.
- **Ảnh riêng từng máy (chống rủi ro bản quyền)**: ở tab "Giao diện" có khối "Linh vật đồng ca" (v58 thiết kế lại gọn theo góp ý của Minh; v59 chuyển từ tab Quản lý sang tab riêng "Giao diện" cạnh tab Quản lý theo yêu cầu của Minh — tiêu đề và ô chọn cùng một hàng, nút rút gọn nhãn, ghi chú còn 2 dòng): bật/tắt, nút đổi ảnh (chọn ảnh từ máy, tự thu nhỏ ≤288px, lưu data URL vào khóa riêng `labentry.mascot.v1`) và nút về ảnh mặc định. Ảnh riêng **chỉ nằm trên máy đó**: không vào file sao lưu, không vào mã nguồn/bản công khai — bản phát hành công khai không chứa nhân vật có bản quyền của bên thứ ba (Minh dùng ảnh Mimikyu của anh qua đường này trên máy cá nhân). Khi dùng ảnh riêng, mọi trạng thái dùng chung một ảnh, trạng thái thể hiện bằng bong bóng + huy hiệu.
- **Vòng đời bong bóng (v56, góp ý của Minh 2026-11-08 — khung thoại hiện hoài gây choáng không gian):** mỗi tình huống mới hiện bong bóng **5 giây rồi tự tắt** (linh vật vẫn ở lại); tình huống còn đó thì **sau 60 giây hiện lại 5 giây** (v56). **Nới nhịp ở v65 (Minh: "không lặp đi lặp lại cùng 1 câu thường xuyên nữa, giãn ra lâu chút"):** khoảng lặng giữa hai lần hiện cùng một tình huống tăng lên **3 phút** (`MASCOT_RESHOW_MS = 180000`), và khóa bong bóng tính theo **tình huống** (`key` = loại trạng thái + uid các mẫu liên quan) chứ không theo nguyên văn câu nói — số phút đếm ngược đổi mỗi phút không còn bật lại bong bóng (nội dung hiển thị vẫn được cập nhật khi bong bóng hiện). Bấm vào linh vật: đang hiện thì tắt ngay (lùi lần hiện lại +3 phút), đang tắt thì hiện 5 giây. Cài đặt (bật/tắt + ảnh riêng) lưu ở `labentry.mascot.v1`, không nằm trong sao lưu (đúng tính chất "chỉ máy này").
- Tôn trọng `prefers-reduced-motion`: tắt mọi chuyển động của linh vật.

### F25 — Nhắc qua Lịch + nhận mẫu mới tự chuyển tab Quản lý (v44, 2026-11-06)

- Theo yêu cầu của Minh (2026-11-06), sau khi máy thật của anh xác nhận báo động trong app không kêu khi app bị thu nhỏ dù đã chỉnh pin không giới hạn + thông báo + không ngủ (đúng giới hạn nền web của F23).
- **Nhắc qua Lịch (tùy chọn):** khi một mẫu đang được bấm giờ (đồng hồ đang chạy), cạnh nút đếm ngược hiện thêm nút **"🔔 Lịch"** (`data-action="calremind"`). Bấm nút tải file **.ics** (`buildCalendarIcs()`): sự kiện bắt đầu đúng `timerEndsAt` (giờ UTC chuẩn iCalendar), dài 5 phút, kèm `VALARM` dạng DISPLAY với `TRIGGER:-PT0M`; tiêu đề/mô tả ghi ID mẫu + loại XN + giờ nhận. `UID` = uid bản ghi + mốc hẹn giờ (mili giây) nên thêm lại cùng một nhắc thì app Lịch cập nhật cùng một sự kiện thay vì nhân đôi. Người dùng mở file để thêm vào Lịch của điện thoại (Samsung Calendar/Google Calendar/Lịch Apple đều đọc được .ics); chuông do app Lịch phụ trách bằng báo thức hệ thống — kêu đúng giờ kể cả khi LabEntry đã đóng. Mẫu đã tới giờ rồi thì nút không hiện (và `downloadCalendarReminder()` cũng từ chối kèm toast). Đây là thao tác **tùy chọn theo từng mẫu**, app không tự tạo nhắc cho mọi mẫu.
- **Nhận mẫu mới -> tự chuyển tab Quản lý:** mở rộng quy tắc cũ (trước đây chỉ phiên quét mở từ nút + và form thêm khi đang ở sẵn tab Quản lý mới chuyển). Từ v44: **mọi** đường nhận mẫu mới thành công đều kết thúc ở tab Quản lý, khung "Chưa kết quả": (a) lưu form ở chế độ **thêm mới** (`saveForm` với `wasAdd`) — dù form mở từ tab Hôm nay hay Quản lý; (b) đóng phiên quét liên tục có nhận >= 1 mẫu (`closeScanner`) — dù phiên mở từ nút quét của tab Hôm nay hay từ nút +. Sửa mẫu cũ vẫn quay về tab đang dùng như trước; quét tìm mẫu (F24) không đổi (mở thẳng mẫu tìm thấy). Cả hai đường đều gọi `renderToday()` trước khi chuyển để danh sách Hôm nay không bị cũ khi quay lại.
- Kiểm chứng: test jsdom (nút Lịch chỉ hiện khi đồng hồ đang chạy; nội dung .ics đúng mốc giờ UTC + có VALARM + UID ổn định; bấm nút không lỗi; thêm mẫu qua form từ tab Hôm nay -> ở tab Quản lý khung Chưa kết quả và mẫu hiện trong nhóm; quét từ tab Hôm nay nhận mẫu -> đóng phiên là ở tab Quản lý; sửa mẫu cũ vẫn về tab cũ) chạy kèm **toàn bộ hồi quy** của các bản trước trên cả hai bố cục, và Chromium thật (tải .ics và đọc lại nội dung file, hai luồng chuyển tab, ảnh chụp nút 🔔 Lịch cạnh đồng hồ đếm ngược).
- **Bổ sung v45 (cùng ngày, từ phản hồi máy thật của Minh):** (1) thông báo hướng dẫn sau khi tải .ics trước đây là toast tự tắt sau vài giây — người dùng không kịp đọc để làm theo. Nay thay bằng **hộp thoại hướng dẫn cố định** (`#cal-guide-modal`): ghi ID mẫu + giờ chuông + tên file, 3 bước mở file và thêm vào Lịch; hộp thoại chỉ đóng khi người dùng bấm "Đã hiểu, đóng". (2) **Trên PC không dùng tính năng này:** nút "🔔 Lịch" chỉ hiện khi user agent là thiết bị di động (`calRemindAvailable()`: Android/iPhone/iPad/iPod/Mobile) — trên máy tính để bàn cửa sổ app luôn mở trên màn hình làm việc, bộ đếm trong app chạy bình thường nên nhắc qua Lịch là thừa. Kiểm chứng: jsdom (phiên di động có nút + hộp thoại hiện đúng và giữ nguyên; phiên UA để bàn `calRemindAvailable()` = false) kèm toàn bộ hồi quy hai bố cục, và Chromium thật với UA để bàn (không có nút) và UA Android (có nút, hộp thoại còn nguyên sau vài giây, đóng bằng nút).

### F26 — Đồng bộ báo thức native khi chạy trong vỏ APK Android (v46, 2026-11-07)

- Bối cảnh: Minh duyệt làm bản APK thử (2026-11-07) — vỏ Android (Capacitor, thư mục `android-shell/` trong repo này) mở đúng bản web live này và gắn thêm một cầu nối native `window.LabAlarmNative` vào WebView, nối tới AlarmManager của Android. Nhờ đó báo thức mẫu hẹn giờ do **hệ điều hành** phụ trách — kêu đúng giờ kể cả khi app đã đóng hẳn — thay vì phụ thuộc bộ đếm trong trang như F23 (đã xác nhận không kêu khi app bị thu nhỏ trên máy thật).
- Phía web chỉ thêm hàm `syncNativeAlarms()`: tính lại tập mẫu cần báo (trạng thái chưa kết quả + `timerEndsAt` ở tương lai) rồi gửi toàn bộ danh sách `[{id, at, label}]` sang native; native tự đặt/hủy để khớp đúng danh sách (hợp đồng này do native giữ registry riêng). Hàm được gọi sau: bấm giờ, hủy giờ, lưu form (nhập kết quả làm mẫu rời tập cần báo), xóa mẫu (đơn + hàng loạt), khởi động app (cộng 2 lần thử lại ở giây 1,5 và 4 phòng cầu nối gắn trễ) và mỗi khi app quay lại nền trước (`visibilitychange`).
- Native trả `"NO_EXACT"` khi Android chưa cấp quyền báo thức chính xác (Android 14+ phải cấp tay): lần đầu trong phiên, app hỏi bằng `confirm` có mở đúng trang Cài đặt quyền hay không; từ chối thì chỉ toast nhắc, không hỏi lại trong phiên.
- Trên trình duyệt thường không tồn tại `window.LabAlarmNative` — hàm thoát ngay, **không thay đổi hành vi nào so với v45**; nút nhắc qua Lịch (F25) vẫn giữ nguyên làm đường dự phòng và cho người dùng bản web.
- Kiểm chứng phía web: test jsdom (stub cầu nối: bấm giờ gửi đúng 1 báo thức với uid/mốc giờ/nhãn; hủy giờ gửi danh sách rỗng; nhập kết quả qua form hủy báo; NO_EXACT chỉ hỏi 1 lần/phiên; không có cầu nối không lỗi) kèm toàn bộ hồi quy hai bố cục, và Chromium thật có chích stub cầu nối. Phần native (báo thức kêu khi app đóng) kiểm chứng trên điện thoại thật của Minh theo kịch bản bàn giao của bản APK thử.
- **Bổ sung v47 (2026-11-07, cho vỏ iOS):** Minh duyệt bản iOS thử (đường cài AltStore miễn phí). Cùng hàm `syncNativeAlarms()` gửi danh sách sang iOS khi phát hiện `window.webkit.messageHandlers.labAlarm` (và không có cầu nối Android): `postMessage(JSON.stringify(want))` một chiều, không chờ trả lời. Phía iOS là `LabAlarmCenter` (Swift, trong `android-shell/ios/`): registry ở UserDefaults, đặt/hủy thông báo cục bộ `UNUserNotificationCenter` khớp đúng danh sách (định danh `labentry-<uid>`, `UNCalendarNotificationTrigger` đúng mốc giờ, mức ưu tiên time-sensitive trên iOS 15+, banner hiện cả khi app đang mở nhờ delegate willPresent); quyền thông báo được xin ở lần đồng bộ đầu tiên có mẫu đang đếm. Cầu nối được gắn bởi `BridgeViewController` (storyboard) trong `capacitorDidLoad()`; `Info.plist` có `NSCameraUsageDescription`. **Giới hạn đã công bố:** WKWebView không có BarcodeDetector — trong vỏ iOS, camera mở xem trực tiếp được nhưng app không tự nhận diện mã vạch; gõ tay và máy quét Bluetooth vẫn dùng bình thường (thư viện giải mã bằng JS là hạng mục riêng nếu Minh yêu cầu sau). Hành vi phía Android và trình duyệt không đổi; test F26 được mở rộng thêm pha iOS (stub webkit: postMessage nhận đúng danh sách, hủy giờ làm mẫu biến mất, không gọi cầu nối Android).

### Sửa lỗi v48 — Nhãn trường kết quả bị ép hẹp trong form nhập (2026-11-07)

- Phản ánh của Minh trên bản APK: tên chỉ mục ở các trường nhập chữ (vd "Soi tươi huyết trắng: Bạch cầu") bị xuống hàng từng từ, hàng giãn cao khó nhìn; bản PWA trên Edge không bị. Nguyên nhân: các ô nhập chữ được bọc trong `.mic-wrap` (thêm nút micro) chỉ khi môi trường hỗ trợ nhập giọng nói — WebView Chromium trong vỏ APK có, Edge của Minh không — mà `.mic-wrap` (con flex của `.form-row`) thiếu `flex: 1; min-width: 0`, nên kích thước tối thiểu tự động của ô nhập ép `.form-label` (34%) co lại. Đã tái hiện bằng Chromium thật ở bề rộng điện thoại (nhãn hàng chữ 88px so với 129px của hàng chips) và đo lại sau sửa (129px, đồng đều).
- Sửa đúng một quy tắc CSS: `.mic-wrap { flex: 1; min-width: 0; }` (+ test hồi quy đọc styles.css). Sửa ở bản web nên **cả hai vỏ APK/iOS tự nhận khi mở lại app, không cần cài lại APK**. Kiểm chứng: toàn bộ test jsdom hai bố cục + ảnh chụp form sau sửa trên Chromium.

### F30 — In bàn giao trong vỏ app ra nhầm tờ kết quả: bỏ cơ chế khôi phục theo sự kiện in (v54, 2026-11-08)

- Lỗi do Minh phát hiện trên máy thật (2026-11-08, sau khi F29 chạy: in kết quả ra PDF tốt): **In bàn giao** trong APK lại in ra **danh sách kết quả xét nghiệm** thay vì danh sách bàn giao. Nguyên nhân: `printHandover()` cũ thay nội dung `#print-area` bằng tờ bàn giao rồi khôi phục nội dung cũ theo sự kiện `afterprint`, cộng cờ chặn `handoverPrinting` tự gỡ sau 3 giây. Trên trình duyệt, `window.print()` chụp trang một lần đồng bộ nên không lộ; adapter in của Android (PrintManager) dựng trang **bất đồng bộ, nhiều lượt** (mở hộp thoại, đổi tuỳ chọn in...) — một lượt dựng muộn, sau khi `afterprint` đã khôi phục tờ kết quả hoặc cờ 3 giây đã hết, sẽ đọc phải tờ kết quả.
- **Cách sửa (chỉ phía web — APK trial5 không cần cài lại):** `#print-area` được theo dõi tường minh bằng `printAreaKind` ('results' do applyExport đặt, 'handover' do printHandover đặt) và tờ bàn giao được **giữ nguyên cho tới lần dựng tờ kế tiếp**, không khôi phục theo sự kiện nữa: (1) listener `beforeprint` toàn cục chỉ dựng lại tờ kết quả khi `printAreaKind !== 'handover'`; (2) bỏ hẳn snapshot/khôi phục/cờ hẹn giờ trong printHandover; (3) trên trình duyệt, một listener `afterprint` dựng lại tờ kết quả sau khi in bàn giao xong (giữ hành vi cũ) — nhưng bị chặn khi lần in vừa rồi đi qua cầu nối native (`lastPrintViaNative`, do printSheet ghi lại) nên trong vỏ app không còn đường nào ghi đè tờ đang in. Ba điểm in vẫn luôn dựng đúng tờ trước khi in (applyExport/printHandover) nên việc giữ tờ cũ trong #print-area là vô hình và vô hại.
- Kiểm chứng: test jsdom F30 mô phỏng đúng chuỗi sự kiện của adapter Android (applyExport → printHandover → beforeprint → afterprint) và khẳng định #print-area vẫn là tờ bàn giao, sau đó in kết quả vẫn ra tờ kết quả; toàn bộ hồi quy hai bố cục; Chromium kiểm tra cùng chuỗi sự kiện trên bản thật.

### F29 — In / xuất PDF trong vỏ app qua PrintManager (v53 + APK trial5, 2026-11-08)

- Lỗi do Minh phát hiện trên máy thật (2026-11-08, ngay sau khi xác nhận F28 sao lưu đã chạy): trong bản APK, nút **Xuất PDF** và các nút in đều bấm không hiện gì. Nguyên nhân cùng họ với F28: tính năng in của LabEntry dựa vào `window.print()` của trình duyệt, còn trong WebView của vỏ Capacitor `window.print()` là hàm rỗng (không hộp thoại in, không báo lỗi) và sự kiện `beforeprint` cũng không bao giờ bắn. Trên trình duyệt (Edge/PWA) mọi thứ vẫn chạy bình thường.
- **Phía web:** thêm `printSheet()` — khi có cầu nối `window.LabFileNative.print` thì gọi cầu nối; ngoài vỏ app giữ nguyên `window.print()`. Cả 3 điểm in đều chuyển qua `printSheet()`: nút Xuất PDF ở tab Lọc & Xuất, nút in ở trang Tùy chỉnh bản in, và `printHandover()` (tờ bàn giao). Nội dung in vẫn được dựng vào `#print-area` ngay trong thao tác bấm (applyExport/printHandover) như cũ nên adapter in bắt được đúng tờ; CSS `@media print` giữ nguyên vai trò chỉ hiện tờ in.
- **Phía Android (trial5):** `LabFileBridge` (giữ Activity thay vì application context) thêm `@JavascriptInterface print()`: chạy trên UI thread, lấy WebView từ Bridge, gọi `PrintManager.print("LabEntry", webView.createPrintDocumentAdapter("LabEntry"), ...)` — hộp thoại in hệ thống của Android, có cả tuỳ chọn "Lưu thành PDF" lẫn máy in thật. versionCode 5 / versionName 1.0.0-trial5, cài đè trial4, dữ liệu giữ nguyên.
- Lưu ý kỹ thuật: trong vỏ app sự kiện `afterprint` không bắn, nên tờ bàn giao ở `#print-area` không được khôi phục ngay như trên trình duyệt — vô hình trên màn hình (khu vực chỉ dành cho in) và lần in kết quả kế tiếp luôn dựng lại tờ từ đầu bằng applyExport, không ảnh hưởng kết quả in.
- Kiểm chứng: test jsdom F29 (Xuất PDF + in bàn giao đều gọi cầu nối in; tờ kết quả có trong #print-area trước khi in; bỏ cầu nối thì rơi về window.print không lỗi) kèm toàn bộ hồi quy hai bố cục; hành vi hộp thoại in thật do Minh kiểm chứng trên máy (Xuất PDF → chọn "Lưu thành PDF" → có file PDF).

### F28 — Xuất file trong vỏ app qua cầu nối file native (v52 + APK trial4, 2026-11-08)

- Lỗi do Minh phát hiện trên máy thật (2026-11-08): trong bản APK, bấm xuất sao lưu thì app báo "Đã xuất file sao lưu: 161 bản ghi" nhưng **không có file nào trên máy**. Nguyên nhân: `downloadTextFile()` (dùng chung cho sao lưu JSON, xuất CSV và file nhắc Lịch .ics) tải bằng blob + `<a download>` — trình duyệt thường xử lý được, nhưng WebView của vỏ Capacitor **nuốt lặng** thao tác này (không ghi file, không báo lỗi), trong khi `exportBackupFile()` vẫn ghi nhận `lastBackupAt` và báo thành công vô điều kiện. Dữ liệu trong app không hề mất — chỉ có bước xuất file là không thành.
- **Phía web:** `downloadTextFile()` đổi thành định tuyến 3 kênh và trả kết quả giao file: (1) cầu nối file native `window.LabFileNative.saveFile(name, text)` khi ở trong vỏ app — ghi thẳng vào thư mục Tải xuống; (2) Web Share kèm file (`navigator.canShare({files})`) — người dùng tự chọn nơi lưu/gửi (đường này cũng cứu được các vỏ cũ chưa có cầu nối); (3) tải blob kiểu cũ cho trình duyệt thường — nhưng nếu đang ở trong vỏ app (phát hiện qua `window.Capacitor`/cầu nối báo thức) mà hai kênh trên đều không có thì trả **'fail'** thay vì giả vờ thành công. Người gọi chỉ báo thành công/ghi nhận sao lưu khi kết quả khác 'fail': `exportBackupFile()` (toast + `lastBackupAt` dời vào bước xác nhận), `exportCsv()`, và `downloadCalendarReminder()` (kênh 'fail' đồng bộ thì báo lỗi, không mở hộp thoại hướng dẫn).
- **Phía Android (trial4):** thêm `LabFileBridge.java` — `@JavascriptInterface saveFile(name, content)`: Android 10+ ghi qua MediaStore vào thư mục Tải xuống công cộng (không cần quyền), Android cũ hơn ghi trực tiếp vào thư mục Tải xuống (khai báo `WRITE_EXTERNAL_STORAGE` với `maxSdkVersion 28`); `MainActivity` đăng ký thêm JavascriptInterface tên `LabFileNative` cạnh `LabAlarmNative`. versionCode 4 / versionName 1.0.0-trial4 — cài đè lên trial3, dữ liệu giữ nguyên (cùng chữ ký).
- Kiểm chứng: test jsdom F28 (cầu nối nhận đúng tên/nội dung file sao lưu; cầu nối báo ERR thì không ghi nhận sao lưu; ngoài vỏ app vẫn về kênh tải thường) kèm toàn bộ hồi quy hai bố cục; APK build bằng CI như các bản trial trước, ký bằng keystore cũ, kiểm chứng gói trước khi giao; phần ghi file thật trên máy do Minh kiểm chứng (xuất sao lưu → mở thư mục Tải xuống thấy file `labentry-sao-luu-*.json`).

### F27 — Nhập kết quả theo lô (v49, 2026-11-07)

- Ý tưởng số 1 trong danh sách nâng cấp đã lưu (IDEAS-BACKLOG.md), Minh duyệt làm 2026-11-07 kèm hai chỉ đạo: trên điện thoại dùng dạng thẻ từng mẫu (không ép bảng), trên PC dùng dạng bảng; và thứ tự nhập **đúng thứ tự tiếp nhận — mẫu nhận (bắn mã) trước thì nhập trước**, không đẩy mẫu khẩn lên đầu (nhãn KHẨN vẫn hiện).
- Màn hình riêng `view-batch` (nút "🧮 Nhập theo lô" ở tab Quản lý, cạnh nút Bàn giao ca). Cần có KTV trực mới mở được (`requireOperator`, cùng cổng F22). Chỉ gồm các mẫu **chưa có kết quả** của loại đã chọn; bộ chọn loại chỉ liệt kê các loại đang có mẫu chờ (kèm số đếm), mặc định chọn loại nhiều mẫu chờ nhất. Thứ tự trong lô: `createdAt` tăng dần (sort ổn định — mẫu bắn cùng mốc giờ giữ nguyên thứ tự quét).
- **Dạng bảng (màn hình >= 900px):** mỗi hàng một mẫu, mỗi cột một chỉ mục của loại. Ô chips = các nút mức chạm để chọn/bỏ chọn; ô chữ = ô nhập tại chỗ. Đầu cột chips có nút "Âm tính cả cột" (bỏ chọn cả cột cho mọi hàng — khi in, ô chips trống vẫn theo quy ước hiện "Âm tính"). Cột cuối mỗi hàng hiện trạng thái (Chưa nhập / Đang nhập / ✓ Đã nhập). Nút "Lưu kết quả (N mẫu)" lưu các hàng có thay đổi rồi làm mới danh sách; "Để sau (không lưu)" bỏ thay đổi (hỏi xác nhận khi có thay đổi).
- **Dạng thẻ (màn hình < 900px):** thanh chọn mẫu ở trên (chạm để nhảy mẫu, ✓ = mẫu đã có nội dung, mẫu đang chọn tô xanh), thẻ mẫu đang nhập dùng đúng bố cục form đơn (nhãn "Loại: Chỉ mục", hàng ⚡ nhập nhanh của loại nếu có, ô chữ có nút micro như form), thanh điều hướng dính đáy: "← Trước", tiến độ "đã nhập X / N", nút "Lưu & mẫu tiếp theo →" (ở mẫu cuối đổi thành "Lưu & xong ✓" — lưu rồi về tab Quản lý). Đổi bề rộng màn hình giữa chừng (xoay máy/mở rộng cửa sổ) thì màn hình lô tự dựng lại theo dạng phù hợp, giữ nguyên nội dung đang nhập dở.
- **Tự cuộn khi chuyển mẫu ở dạng thẻ (v65, Minh góp ý 2026-11-09):** mỗi khi mẫu đang nhập thay đổi (Lưu & mẫu tiếp theo, ← Trước, bấm viên ID, mở lô/đổi loại) thì trang tự cuộn lên đầu và viên ID đang nhập được đưa ra giữa dải ID (`batchScrollToCurrent`, theo dõi qua `batchShownCur`); thao tác trong cùng một mẫu (bấm chip, nhập nhanh) không cuộn để khỏi làm phiền người đang nhập.
- **Ngữ nghĩa lưu — dùng chung với form đơn:** trạng thái làm việc của lô giữ trong bộ nhớ (`batchState.work`), chưa chạm dữ liệu thật cho tới khi lưu. `saveBatch()` chỉ ghi các mẫu có thay đổi so với bản ghi gốc (`store.update` với `results` mới; mẫu thành có kết quả thì `timerEndsAt = null` và đóng dấu `performer` = KTV trực hiện tại), ghi nhật ký `save` với chi tiết thay đổi qua `diffRecordChanges` và gọi `syncNativeAlarms()` — y hệt đường lưu của `saveForm` ở chế độ sửa. Mọi đường thoát (nút ‹ quay lại, đổi loại xét nghiệm, nút Lưu, nút "mẫu tiếp theo") đều lưu trước; ngoại lệ duy nhất là "Để sau (không lưu)" ở dạng bảng.
- Kiểm chứng: test jsdom (thứ tự lô theo giờ nhận dù thứ tự thêm ngược; dạng bảng: gõ ô chữ + lưu -> mẫu chuyển "chờ phát hành", đóng dấu người thực hiện, có dòng nhật ký; chọn chips theo cột + "Âm tính cả cột"; dạng thẻ ở bề rộng 400px: thanh chọn mẫu đúng thứ tự, nút tiếp theo lưu và chuyển mẫu) kèm toàn bộ hồi quy hai bố cục, và Chromium thật chụp hai dạng (bảng 1280px, thẻ 411px).

### Điều chỉnh v50 — Mọi danh sách theo thứ tự tiếp nhận (2026-11-07)

- Theo yêu cầu của Minh (2026-11-07, mở rộng quy tắc của F27 ra cả app): **mọi danh sách mẫu đều xếp theo thứ tự tiếp nhận** (`createdAt` tăng dần — nhận trước ở trên), và **mẫu khẩn KHÔNG còn nhảy lên đầu** ở bất kỳ danh sách nào; cờ KHẨN giữ nguyên hiển thị (nhãn đỏ + nền/viền đỏ ở danh sách, nhãn ở trang Xem, tiền tố "🔴 " trong nội dung bàn giao và cột ID bản in).
- Thay thế đúng quy tắc sắp xếp cũ của F24 ("khẩn lên đầu") tại 5 chỗ: danh sách tab Hôm nay (`renderToday`), hai khung Quản lý — Chờ phát hành trước đây còn xếp mới nhất lên đầu, nay cũng cũ → mới (`renderManage`), danh sách tab Lọc & Xuất (`applyExport`, trước đây mới nhất lên đầu — thứ tự dòng xuất CSV vì thế cũng thành cũ → mới), trang Bàn giao ca (`handoverRecords`, cả hai nhóm), và banner mẫu tới giờ (`dueBannerRecords` — trước đây khẩn trước rồi tới hạn trước; nay theo giờ nhận, nên bấm banner sẽ mở mẫu tới giờ được nhận sớm nhất).
- Không đổi: thứ tự xử lý báo động trong `dueTimerRecords()` (theo mốc tới hạn — cơ chế báo thức, không phải danh sách hiển thị), quét tìm mẫu khi trùng nhiều kết quả vẫn lấy mẫu mới nhất (F24), nhật ký thao tác giữ thứ tự thời gian của nó.
- Kiểm chứng: test F24 được cập nhật sang quy tắc mới (mẫu khẩn nhận sau xếp sau mẫu thường nhận trước trong danh sách Hôm nay, nhãn/nền đỏ còn nguyên) kèm toàn bộ hồi quy hai bố cục, và Chromium thật kiểm tra thứ tự hiển thị ở tab Hôm nay.
- **Bổ sung v51 (2026-11-07):** rà soát chữ hiển thị sau v50 — hai dòng chữ cũ còn nói KHẨN được ưu tiên đã sửa cho khớp quy tắc mới: nhãn ô tích trong form nhập ("🔴 Mẫu khẩn (STAT) — chỉ gắn nhãn đỏ, không đổi thứ tự xử lý") và câu giới thiệu trang Bàn giao ca ("Mẫu khẩn (STAT) chỉ gắn nhãn đỏ để dễ thấy; danh sách xếp theo thứ tự tiếp nhận"). Không đổi hành vi nào.

### F24 — Gói cải tiến ca trực (v43, 2026-11-06)

- Theo đề xuất của trợ lý và lựa chọn của Minh (2026-11-06): làm các mục 1, 3, 4, 5, 6, 7 trong danh sách 7 ý tưởng; mục 2 (hoãn báo động + sắp xếp theo giờ tới hạn) **không** được chọn — không làm. Cấu hình chung của gói nằm ở localStorage `labentry.meta.v1` (`{ lastBackupAt, autoLockMin, speakDue, backupNagUntil }`), nạp qua `loadMeta()` với kiểm tra kiểu chặt (giá trị hỏng -> mặc định).
- **1) Nhắc sao lưu:** `exportBackupFile()` ghi `lastBackupAt` mỗi lần xuất file. Thanh nhắc vàng (`#backup-banner`, tĩnh trên đầu trang, không cố định như banner đỏ) hiện khi: máy đang có bản ghi + chưa từng sao lưu, hoặc đã >= 3 ngày chưa sao lưu; nút "Sao lưu ngay" gọi thẳng xuất file, nút "Để mai nhắc lại" đặt `backupNagUntil` = ngày hôm nay (ẩn tới hết ngày). Kiểm tra lại mỗi 30 giây trong `timerTick` qua `renderBackupNag()` (chỉ chạm DOM khi thông điệp thay đổi). Thẻ sao lưu ở tab Xuất hiện dòng "Sao lưu gần nhất trên máy này: ..." (`#backup-last`).
- **3) Bàn giao ca:** trang riêng `view-handover` (nút "🤝 Bàn giao ca" ở tab Quản lý): gom **toàn bộ** mẫu chưa xong trên máy (trạng thái chưa kết quả + chờ phát hành, **kể cả tồn từ ngày trước**), mẫu khẩn lên đầu mỗi nhóm **(đã thay bởi v50: cả hai nhóm xếp theo thứ tự tiếp nhận, khẩn không nhảy đầu)**; hiện số đếm tổng; ô `#handover-text` chứa nội dung dạng chữ dựng bởi `buildHandoverText()` (tiêu đề, giờ lập, KTV trực, hai nhóm đánh số, mỗi dòng: ID — loại — nhận lúc — đã chờ — KTV nhận, khẩn có tiền tố "🔴 KHẨN ·"); nút sao chép (clipboard API, dự phòng select + execCommand) và nút in: dựng tờ `.ho-sheet` tạm vào `#print-area`, cờ `handoverPrinting` chặn `beforeprint` toàn cục ghi đè, khôi phục nội dung cũ ở `afterprint` (+ dự phòng 3 giây cho cờ).
- **4) Mẫu khẩn (STAT):** trường `urgent` (boolean) trên bản ghi — `store.add/update/parseBackup` đều mang theo (file cũ không có -> false), đi theo sao lưu/gộp. Form nhập có ô tích "🔴 Mẫu khẩn (STAT)"; đổi cờ được ghi vào nhật ký qua `diffRecordChanges` ("Mẫu khẩn: Không -> Có"). Hiển thị: nhãn "KHẨN" đỏ + nền/viền đỏ (`.record-item.urgent`) ở mọi danh sách, nhãn ở trang Xem (`#sum-urgent`), dấu "🔴 " trước ID ở cột ID của bản in. Thứ tự: khẩn lên đầu danh sách Hôm nay, cả hai khung Quản lý và danh sách bàn giao; `dueBannerRecords()` xếp khẩn lên đầu nên banner báo động đọc/mở mẫu khẩn trước. **(Đã thay bởi v50 — xem mục "Điều chỉnh v50" ngay dưới F27: mọi danh sách chuyển sang thứ tự tiếp nhận, khẩn không còn nhảy lên đầu.)**
- **5) Tự khóa KTV trực:** ô chọn ở thanh KTV trực (`#autolock-select`: Tắt/5/10/15/30 phút, **mặc định 10**). `lastActivityAt` cập nhật qua sự kiện pointerdown/keydown/touchstart trên document + `noteActivity()` khi quét camera nhận mẫu thành công và khi quét tìm thấy mẫu. `checkAutoLock()` chạy mỗi tick: có người trực + hết thời gian chờ + **không** đang mở hộp thoại nào (quét/xem/PIN/KTV — kiểm qua `.modal:not(.hidden)` và `scannerState`) thì ghi nhật ký `operator` ("Tự khóa người trực sau N phút không thao tác (tên)") **trước** khi bỏ chọn (để actor của dòng log là người bị khóa), rồi `setOperator('')` + toast. Sau khóa, mọi thao tác bị cổng F22 chặn như thường cho tới khi chọn lại người trực (qua PIN).
- **6) Đọc to mã mẫu khi tới giờ:** công tắc `#chk-speak-due` ở thanh KTV trực, **mặc định tắt**, lưu trong meta. `speakDue()` được gọi trong `timerTick` với các mẫu vừa tới giờ và đang thuộc diện báo (cùng tập `shown` của banner — mẫu đang mở trong form không bị đọc); mỗi cặp (uid, timerEndsAt) chỉ đọc một lần (`spokenDue`). Nhiều mẫu cùng lúc: đọc một câu gộp "Có N mẫu tới giờ nhập kết quả: ...". Dùng `speechSynthesis` với `lang = 'vi-VN'`; thiết bị không hỗ trợ/không có giọng Việt thì bỏ qua lặng hoặc đọc bằng giọng mặc định — không có gì đảm bảo ngoài thiết bị thật.
- **7) Quét tìm mẫu:** nút quét ở thanh công cụ tab Quản lý (`#btn-scan-find`) mở màn hình quét với `scannerState.find = true` (điều kiện `single` mở rộng: `find || (form && sửa)`): tiêu đề "Quét tìm mẫu", ẩn hai hàng chọn loại XN/KTV nhận và danh sách phiên, hiện ô nhập tay dự phòng. `acceptScanCode` rẽ sang `findAndOpenRecord(code)`: khớp **đúng** ID (sau trim) trong toàn bộ dữ liệu — không thấy: báo lỗi ngay tại màn hình quét, giữ quét mở để quét lại; thấy nhiều mẫu cùng ID (khác loại): mở mẫu mới nhất + toast số lượng; thấy một: có kết quả -> mở trang Xem, chưa có -> mở form nhập. Máy quét cầm tay (wedge) dùng chung đường này vì cùng qua `acceptScanCode`.
- Kiểm chứng: test logic (urgent qua add/update/xuất-nhập sao lưu), test jsdom trên phiên riêng dom3 (nhắc sao lưu hiện/tắt sau khi xuất/quá hạn 4 ngày/hẹn mai; cờ khẩn lưu + nhãn + xếp đầu; bàn giao đủ mẫu tồn hôm qua + khẩn đầu + nội dung chữ; tự khóa sau khi quá hạn không thao tác và không khóa khi đang mở hộp thoại; đọc to đúng mã mẫu nhờ speechSynthesis giả lập; quét tìm mở đúng mẫu/không thấy báo lỗi), và Chromium thật (ảnh chụp thanh nhắc, trang bàn giao, dòng mẫu khẩn; in bàn giao ra PDF).

### F23 — Báo động mẫu tới giờ rõ ràng hơn (v42, 2026-11-06)

- Bối cảnh (Minh hỏi 2026-11-06): bản trước tới giờ chỉ kêu 3 bíp ngắn + rung 1 nhịp + toast, **đúng một lần**; và `timerTick` cũ chỉ quét các số đếm đang render trên màn hình (`[data-countdown]`) nên mẫu tới giờ lúc người dùng đang ở tab khác thì im lặng hẳn. Khi app bị thu nhỏ/tắt màn hình, trình duyệt Android bóp nhịp setInterval, chặn rung khi trang ẩn — không web app nào đảm bảo tuyệt đối; F23 làm tới mức tối đa trong giới hạn nền web.
- **Quét theo dữ liệu gốc:** `timerTick` (mỗi giây) suy ra danh sách mẫu tới giờ từ store (`dueTimerRecords()`: chưa có kết quả + `timerEndsAt` đã qua, xếp theo giờ hẹn tăng dần) — báo đúng ở mọi tab/trang của app.
- **Báo lặp lại:** đợt kêu đầu ngay khi tới giờ, sau đó lặp mỗi **15 giây**, chỉ trong **15 phút đầu** quá giờ (tránh kêu vô hạn). Tiếng kêu đổi sang hai tông xen kẽ (1560/2093 Hz ×6, âm lượng 0.6 qua tham số `vol` mới của `beep()`) + rung 3 nhịp [300,120,300,120,300]. Mẫu đang mở trong form nhập thì không kêu (loại khỏi danh sách báo qua `dueBannerRecords()`).
- **Banner báo động:** thanh đỏ nhấp nháy cố định trên đầu app (`#alarm-banner`, z-index 40) ghi ID các mẫu tới giờ (tối đa 3 + "và N mẫu nữa"), giữ tới khi mẫu được xử lý (nhập kết quả sẽ tự xóa hẹn qua saveForm như cũ / hủy bấm giờ / xóa mẫu); bấm banner mở form của mẫu tới giờ sớm nhất.
- **Thông báo hệ thống:** xin quyền (`Notification.requestPermission`) một lần ngay khi bắt đầu bấm giờ; mỗi mẫu bắn **một** thông báo khi vừa tới giờ — `requireInteraction: true`, rung riêng, tag theo uid, bấm vào mở form của mẫu đó (`showDueNotification`). Mỗi cặp (uid, timerEndsAt) chỉ bắn một lần (`notifiedDue`).
- **Giữ màn hình sáng (Wake Lock):** khi còn mẫu đang đếm ngược và trang đang hiện, giữ màn hình sáng (`manageWakeLock`, kiểm tra lại mỗi 5 giây + khi trang hiện lại); hết mẫu chờ thì tự nhả. Mọi lỗi/không hỗ trợ đều nuốt lặng.
- **Huy hiệu icon (App Badge):** số mẫu đang tới giờ đặt lên icon app khi đã cài PWA (`setAppBadge`/`clearAppBadge`), cập nhật mỗi tick.
- **Bù khi quay lại app:** sự kiện `visibilitychange` chạy ngay một tick + xin lại wake lock, nên mẫu tới giờ trong lúc app ẩn được báo ngay khi mở lại.
- Kiểm chứng: test jsdom (mẫu hẹn giờ quá hạn khi đang ở tab Lọc & Xuất vẫn hiện banner — đúng lỗi bản cũ; bấm banner mở form và banner ẩn; nhập kết quả xong banner tắt) và Chromium thật (banner hiện + bấm được, ảnh chụp; Notification/WakeLock trong headless chỉ kiểm tra không lỗi, quyền thông báo và giữ màn hình cần thử trên điện thoại thật của Minh).

### F22 — Cổng KTV trực + nhật ký kiểm toán mang theo sao lưu (v41, 2026-11-06)

- Theo yêu cầu của Minh (2026-11-06), **thay thế** quy tắc cũ của F17 ("chưa chọn KTV trực thì không chặn thao tác nào"): từ v41, **chưa chọn KTV trực thì bị chặn** — (1) nhận mẫu: quét liên tục (camera/máy quét cầm tay qua `acceptScanCode`) và lưu form ở chế độ thêm mới; (2) lưu form nhập kết quả nói chung (thêm + sửa, gồm cả đặt/xóa giờ phát hành và sửa dấu KTV qua form); (3) phát hành (nút trên dòng + nút trong trang Xem); (4) hủy phát hành; (5) xóa kết quả (từng mẫu + xóa hàng loạt ở Quản lý). Cổng kiểm tra tại thời điểm thao tác qua `requireOperator()` (riêng màn hình quét báo qua dòng trạng thái quét). **Không chặn:** xem/in/xuất, bấm giờ, thêm/xóa KTV, chọn người trực, phục hồi/gộp dữ liệu — nếu chặn cả thêm KTV/chọn trực thì máy mới sẽ khóa cứng.
- **Nhật ký kiểm toán** (localStorage `labentry.audit.v1`): dòng `{id, at (ISO), actor (KTV trực lúc thao tác), action, testId, typeId, detail}`; giữ tối đa **2.000 dòng gần nhất** (quá thì rơi dòng cũ nhất). Các `action`: `receive` (quét/form), `save` (sửa qua form — chỉ ghi khi thật có thay đổi, `detail` liệt kê từng thay đổi "cũ → mới": ID, loại XN, từng trường kết quả, ghi chú, 3 dấu KTV; dùng giá trị thật, không dùng quy ước hiển thị "Âm tính"), `release`/`unrelease` (kể cả đặt/xóa giờ phát hành qua form — ghi thành sự kiện riêng), `delete` (kèm trạng thái + toàn bộ kết quả tại lúc xóa; xóa hàng loạt ghi mỗi mẫu một dòng), `staff-add`, `staff-del` (xóa đúng người đang trực thì ghi chú đã bỏ chọn trực), `operator` (đổi/bỏ chọn người trực, chi tiết "cũ → mới"), `restore`, `merge`.
- **PIN không bao giờ vào log (theo đúng yêu cầu của Minh):** nhập PIN đúng/sai khi đổi trực, đặt PIN lần đầu, đổi PIN KTV — không sự kiện nào được ghi; `staff-add` chỉ ghi sự kiện tạo KTV, không ghi PIN.
- **Mang theo sao lưu:** file xuất có thêm khóa `auditLog` (cạnh `staff`/`printLayout` như v30). Phục hồi (replace): nhật ký máy = nhật ký trong file (file cũ không có → trống), sau đó ghi dòng `restore` vào nhật ký mới (actor trống vì phục hồi luôn đặt lại KTV trực = chưa chọn, theo v34). Gộp (merge): hợp nhất theo `id` dòng, sắp xếp theo thời gian, cắt lại ở 2.000 dòng, rồi ghi dòng `merge` kèm số mẫu thêm/bỏ qua. Hộp thoại xác nhận nhập file có ghi rõ việc thay/hợp nhất nhật ký khi file có kèm.
- **Xem nhật ký:** nút "📋 Nhật ký thao tác" ở tab Quản lý mở trang riêng (`view-audit`): lọc theo loại thao tác, tìm theo ID mẫu/người trực/nội dung, mới nhất lên đầu, hiện tối đa 300 dòng khớp mỗi lần. Trong app **không có chức năng xóa log**.
- Kiểm chứng: test jsdom (bootstrap một KTV trực cho cả phiên test vì cổng áp dụng toàn cục; cổng chặn khi bỏ chọn trực: lưu form/phát hành/xóa đều không lọt; log đủ sự kiện + chi tiết thay đổi trường; sao lưu mang log: xuất có `auditLog`, phục hồi thay log + thêm dòng restore, gộp hợp nhất không trùng) và Chromium thật (chặn khi chưa trực, vào trực bằng PIN rồi thao tác, chụp trang nhật ký).

### F21 — Đầu trang 3 vùng + khối thông tin tài liệu + mã vạch (v40, 2026-11-06)

- Theo yêu cầu của Minh (kèm ảnh chụp khung xem trước, 2026-11-06): đầu trang bản in mở rộng theo mẫu biểu mẫu kiểm soát của bệnh viện. Mọi cấu hình mới nằm trong cùng khóa `labentry.print.v1` (đi theo preset và file sao lưu như F18); cấu hình cũ mở lên vẫn chạy nhờ chuẩn hóa bổ sung mặc định trong `normalizePrintSettings()`.
- **Vị trí logo `auto` ("Theo kiểu đầu trang"):** kiểu đầu trang `center` → logo căn giữa trên khối chữ; `side`/`grid3` → logo bên trái. Vẫn giữ chọn tay trái/giữa/phải như trước. Mặc định của cấu hình mới là `auto` (hành vi trùng mặc định cũ ở kiểu `side`).
- **Kiểu đầu trang `grid3` (3 vùng):** lưới 3 cột `1fr auto 1fr` — logo trái, khối đơn vị/khoa/liên hệ ở giữa **căn giữa theo trang** (không bị hai vùng bên đẩy lệch), vùng phải riêng. Ở `grid3` logo cố định bên trái; ở `center` vùng phải xếp dưới khối chữ và căn giữa; ở `side` vùng phải nằm sau khối chữ (logo chọn bên phải thì vùng phải lùi vào trong).
- **Vùng góc phải (`rightZone`):** `none` (mặc định) | `doc` khối thông tin tài liệu | `image` ảnh thứ hai — logo phụ/con dấu (tải ảnh nén ≤360px như logo chính, cỡ S/M/L, khóa `logo2`/`logo2Size`).
- **Khối tài liệu (`docRows`, đúng 5 dòng):** mỗi dòng bật/tắt + nhãn + nội dung tự sửa; 3 dòng đầu cài sẵn nhãn "Mã tài liệu / Lần ban hành / Ngày hiệu lực" (đều bật sẵn, nội dung trống), 2 dòng sau tự do (mặc định tắt). Chỉ in dòng đang bật và có nhãn hoặc nội dung. Kiểu khối (`docBoxStyle`): `box` đóng khung viền + kẻ ngăn dòng kiểu biểu mẫu, hoặc `plain` chỉ chữ.
- **Mã vạch Code128 (`docBarcode`, cỡ `docBarcodeSize` s/m):** bộ mã hóa Code128-B viết trong app (bảng độ rộng vạch chuẩn, không thư viện ngoài, chạy offline), vẽ bằng canvas sau khi dựng tờ (cả vùng in thật lẫn xem trước), kèm dòng chú thích nội dung dưới mã. Nội dung (`barcodePayloadOf`): dòng đang bật có nhãn chứa chữ "Mã" và có nội dung (mặc định là Mã tài liệu); không có thì dòng đang bật đầu tiên có nội dung; cả hai đều trống thì không in mã. Ký tự ngoài ASCII 32–126 (tiếng Việt có dấu) được bỏ dấu/loại khi mã hóa, dòng chú thích in nội dung gốc đã chọn.
- Kiểm chứng: test jsdom (bố cục grid3, khối tài liệu + canvas mã vạch trong xem trước, độ dài pattern Code128, chuẩn hóa cấu hình hỏng) và Chromium thật (ảnh chụp tờ xem trước 3 vùng, in PDF, **quét ngược mã vạch đã in bằng BarcodeDetector phải ra đúng chuỗi gốc**).

### F19 — Giao diện máy tính (v35, 2026-11-05)

Trước v35, trên màn hình lớn app chỉ là một cột 560px kiểu điện thoại đặt giữa màn hình (dùng được nhưng phí không gian, tờ xem trước bản in bị co và cắt cột). Từ v35 (chỉ CSS, qua biến `--app-max` + media query ≥1024px; giao diện mobile/tablet không đổi): khung ứng dụng rộng **1180px** (thanh điều hướng dưới và nút + bám theo khung), hộp thoại rộng hơn (modal 500px, Xem 680px), hàng mẫu thoáng hơn, form nhập canh giữa tối đa 860px, và trang **Tùy chỉnh bản in**: tờ xem trước hiện bề rộng lớn đủ mọi cột, các hàng cài đặt xếp **2 cột** (riêng trình sửa cột in chiếm trọn hàng). Đã kiểm chứng bằng ảnh chụp Chromium thật ở 1280px trước/sau (khung, studio in, tính dính của thanh công cụ); một phương án studio 2 cột trái–phải từng thử đã bị loại vì xung đột với thanh công cụ sticky và CSS co giãn của tờ xem trước.

### F20 — Ngắt trang khi in (v38, 2026-11-05)

- Bảng kết quả dài qua nhiều trang từng bị "đứt" ở cuối trang: không có dòng kẻ đóng dưới đáy trang và một dòng mẫu cao có thể bị cắt đôi qua hai trang (Minh báo 2026-11-05 kèm ảnh chụp bản in 5 trang).
- Cách xử lý trong `renderSheet()` + CSS tờ kết quả: (1) `thead` khai `display: table-header-group` — hàng tiêu đề cột lặp lại ở đầu mỗi trang; (2) bảng có thêm `tfoot` một dòng trống (`.sh-close`, cao 0) khai `display: table-footer-group` — lặp ở cuối mỗi trang, ô đóng kẻ `border-top` cùng kiểu kẻ hiện hành (`b-full`/`b-rows` kẻ 1px #444; `b-none` thì không kẻ) nên trang nào bảng cũng "đóng khung" ở đáy, kể cả trang cuối; (3) `tbody tr { break-inside: avoid }` — một dòng mẫu không bị cắt đôi qua hai trang; (4) dòng tiêu đề nhóm `.sh-group { break-after: avoid }` — không đứng trơ ở cuối trang.
- Kiểm chứng: jsdom chỉ khẳng định được cấu trúc (có `tfoot`, `colspan` bằng số cột) và CSS có khai báo; hành vi ngắt trang thật kiểm bằng Chromium headless in PDF nhiều trang và soi từng trang (đã làm khi phát hành v38).

### F18 — Tùy chỉnh bố cục bản in PDF, đợt 1 (theo thiết kế PRINT-LAYOUT-DESIGN.md đã được Minh duyệt, 2026-11-05)

- Cấu hình lưu ở localStorage `labentry.print.v1`; chưa có cấu hình thì dùng **mặc định = đúng bố cục bản in cũ** (7 cột, Arial 12.5, không đầu trang/chữ ký). `renderSheet(settings, records)` dựng toàn bộ tờ kết quả (dùng cho cả vùng in thật và xem trước).
- **Đầu trang:** logo (tải ảnh, tự nén ≤360px thành data URL; vị trí trái/giữa/phải; cỡ nhỏ/vừa/lớn), tên đơn vị, khoa/phòng, địa chỉ, điện thoại, email (dòng nào trống thì không in), kiểu xếp logo-một-bên/căn giữa, đường kẻ dưới đầu trang, tiêu đề bản in tùy ý, phụ đề khoảng ngày.
- **Cột:** 12 cột khả dụng (STT, ID, Loại, Kết quả gộp, Ghi chú, Giờ nhập, Giờ phát hành, Trạng thái, Thời gian chờ, KTV nhận/thực hiện/phát hành) — mỗi cột bật/tắt, đổi tên, đổi thứ tự (↑↓), độ rộng % (0 = tự động), căn lề. Ba cột KTV mặc định **tắt**.
- **Kiểu dáng:** khổ A4/A5, hướng dọc/ngang (sinh `@page` động), lề hẹp/vừa/rộng, font Times/Arial, cỡ chữ, mật độ dòng, kẻ bảng đầy đủ/ngang/không.
- **Chân trang & chữ ký:** dòng ghi chú tự do, ngày giờ in, dòng thống kê TAT vào bản in (bật/tắt), tối đa 3 ô chữ ký (bật/tắt, chức danh, họ tên).
- **Trang chỉnh** (nút "🎨 Tùy chỉnh bản in" ở tab Xuất): xem trước trực tiếp bằng dữ liệu mẫu, thay đổi áp dụng + lưu ngay, nút In thử (in với dữ liệu đang lọc), nút Khôi phục mặc định.
- **Đợt 2 (đã làm ở v28):** (a) *Tách cột kết quả theo trường* — cấu hình `resultsMode: 'grouped' | 'split'`; chế độ split nở cột Kết quả thành một cột cho mỗi NHÃN trường, khử trùng theo nhãn trên mọi loại có trong danh sách in (loại không có trường đó thì ô trống; chip trống hiện "Âm tính", text trống hiện "—" như chế độ gộp). (b) *Mẫu bố cục (presets)* — lưu nhiều bộ cấu hình có tên ở localStorage `labentry.print.presets.v1` (lưu/ghi đè có hỏi/dùng/xóa có hỏi), thanh mẫu nằm ngay dưới khung xem trước của trang tùy chỉnh. (c) *Bố cục đi kèm file sao lưu* — file sao lưu luôn kèm khóa `printLayout`; phục hồi (thay toàn bộ) thì áp dụng luôn bố cục trong file (hộp thoại xác nhận có ghi rõ), gộp dữ liệu thì không đụng tới bố cục; file cũ không có khóa này phục hồi bình thường. (d) *Phân nhóm* — `groupBy: 'none' | 'day' | 'type'` chèn dòng tiêu đề nhóm (ngày nhận dd/mm/yyyy hoặc tên loại XN) vào bảng; trước khi dựng bảng, `groupRecords()` gom ổn định mọi bản ghi cùng khóa về một cụm duy nhất (nhóm xếp theo lần xuất hiện đầu tiên, trong nhóm giữ nguyên thứ tự danh sách) — sửa ở v29 sau khi Minh phát hiện cùng một loại XN bị tách thành 2 nhóm vì mẫu nằm xen kẽ trong danh sách; STT vẫn đánh liên tục toàn danh sách. (e) *Sọc xen kẽ + màu hàng tiêu đề* — `zebra` tô nền nhạt các dòng dữ liệu lẻ (đánh dấu bằng lớp `alt` khi dựng bảng, không dùng nth-child vì có dòng nhóm xen giữa); `headerColor` chọn trong 5 màu (xám/xanh nhạt/vàng nhạt/xanh lá nhạt/xám đậm chữ trắng) qua biến CSS `--sh-head`; in màu cần bật "Đồ họa nền" trong hộp thoại in.
- **Sao lưu trọn gói (v30):** file sao lưu kèm thêm khóa `printPresets` (thư viện mẫu bố cục), `staff` (danh sách KTV, đã làm sạch: bỏ trùng không phân biệt hoa thường) và `operator` (KTV trực). Phục hồi (thay toàn bộ): danh sách KTV + thư viện mẫu dùng theo file. **Điều chỉnh v34 (theo yêu cầu của Minh): phục hồi KHÔNG nhận KTV trực từ file — sau phục hồi KTV trực luôn về "chưa chọn" để người dùng máy tự chọn lại ca trực (qua mã PIN); khóa `operator` vẫn được ghi trong file để tương thích nhưng bị bỏ qua khi phục hồi. Gộp dữ liệu: giữ nguyên KTV trực đang chọn của máy (như cũ).** Gộp dữ liệu: chỉ THÊM tên KTV và mẫu bố cục mà máy chưa có (theo tên, không ghi đè), và **không đổi KTV trực** của máy. Hộp thoại xác nhận nhập file ghi rõ các phần kèm theo này. File cũ không có các khóa trên vẫn nhập bình thường.
- Sửa lỗi v31: lớp thông báo (toast) có z-index cao hơn hộp thoại và không có `pointer-events: none` nên trong ~2,6 giây hiện thông báo, vùng thông báo **chặn cú chạm** vào nút bấm bên dưới (phát hiện khi test trình duyệt thật: toast đè đúng nút Hủy phát hành trong trang Xem sau khi vừa phát hành mẫu khác). Đã thêm `pointer-events: none` cho `.toast` — thông báo chỉ để xem, không bao giờ chặn thao tác.
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


## F32 — Chủ đề lễ hội theo mùa (v58, ý tưởng 14)

- **Phạm vi:** thuần trang trí — đổi biến màu chủ đạo (`--blue`, `--blue-dark`) + một dải lời chúc mỏng ở trên cùng; KHÔNG đổi bố cục, KHÔNG đụng dữ liệu/hẹn giờ/báo động/in ấn/sao lưu. Dải chúc là con trực tiếp của `body` nên `print.css` tự ẩn khi in; bấm ✕ ẩn dải chúc cho ngày hôm đó.
- **Mười một chủ đề** (3 đầu ở v58, thêm 8 ở v60 theo yêu cầu của Minh): 🧧 **Tết** (đỏ/vàng), 🏮 **Trung Thu** (xanh đêm/vàng), 🎄 **Giáng Sinh** (xanh lá; riêng nút + chuyển đỏ), 🩺 **Thầy thuốc VN** (xanh ngọc y tế), 🌸 **Quốc tế Phụ nữ** (hồng), 🏯 **Giỗ Tổ Hùng Vương** (nâu đồng/vàng), 🎉 **Giải phóng 30/4** (đỏ/vàng), 🛠️ **Quốc tế Lao động** (cam đỏ), 🌺 **Phụ nữ VN** (tím), 💐 **Nhà giáo VN** (tím trầm), ⭐ **Quân đội Nhân dân** (xanh lính). Lời chúc tương ứng hiện trên dải.
- **Tự động theo ngày (chế độ mặc định):** Tết = âm lịch 23/12 → 5/1; Trung Thu = âm lịch 13–17/8; Giáng Sinh = dương lịch 20–26/12; Giỗ Tổ = âm lịch đúng 10/3; các ngày lễ dương lịch đúng ngày: Thầy thuốc 27/2, Quốc tế Phụ nữ 8/3, Giải phóng 30/4, Quốc tế Lao động 1/5, Phụ nữ VN 20/10, Nhà giáo 20/11, Quân đội 22/12 (kiểm tra trước khoảng Giáng Sinh để 22/12 không bị nuốt). Lịch âm Việt Nam tính ngay trong app bằng thuật toán Hồ Ngọc Đức (múi giờ 7) — hàm `convertSolar2Lunar` có test khóa với ngày lễ thật (17/02/2026 = 1/1; 25/09/2026 = 15/8; 06/02/2027 = 1/1).
- **Chọn tay:** ô chọn ở thẻ "Chủ đề lễ hội" (tab "Giao diện" từ v59; trước đó ở tab Quản lý): Tự động / 11 chủ đề / Tắt.
- **Trang trí riêng từng event (v61, yêu cầu của Minh — event nào cũng phải có):** mỗi chủ đề có bộ trang trí riêng (`THEME_DECOR`): biểu tượng ở hai đầu dải chúc + một biểu tượng lớn ở góc dưới trái (🧧 Tết, 🐇 Trung Thu, ⛄ Giáng Sinh, 🩺 Thầy thuốc…) + hiệu ứng rơi cho Tết/8-3 (🌸 hoa đào) và Giáng Sinh (❄ tuyết). Lớp trang trí `#theme-decor` là con của `body` (in ấn tự ẩn), `pointer-events: none`, tôn trọng `prefers-reduced-motion`.
- **Vật rơi rải đều toàn màn hình (v64, sửa lỗi Minh chỉ ra "hoa rơi chệch bên phải, bên trái không có"):** vị trí ngang của vật rơi tính theo ô đều nhau trên 100% chiều ngang cộng xê dịch nhỏ xác định — công thức cũ `3 + ((i*89) % 94)` dồn mọi vật vào vùng ≥32% nên 1/3 trái màn hình trống trơn.
- **Nhạc đệm dịp lễ ~10 giây (v64):** Tết, Giáng Sinh và Trung Thu có giai điệu riêng phát **một lần mỗi lần dải lời chúc hiện** (Tết/Trung Thu: ngũ cung soạn cho app; Giáng Sinh: Jingle Bells truyền thống), dài 8,5–9,5 giây rồi nhỏ dần tự tắt. Giai điệu soạn bằng WebAudio (`THEME_MUSIC`, nốt MIDI + nhịp) nên không cần file nhạc, chạy offline; âm lượng master 0,14. Trình duyệt chặn autoplay trước lần chạm đầu tiên → nhạc ở trạng thái chờ (`themeMusicState.pending`) và phát ngay ở lần chạm kế tiếp nếu lời chúc còn hiện; bấm ✕ tắt lời chúc hoặc chuyển sang chủ đề không có nhạc thì nhạc dừng. Thiết bị không có WebAudio thì bỏ qua an toàn.
- **Tắt lời chúc chỉ là TẠM THỜI (v63, Minh chốt 2026-11-08 "quay lại cần hiện thông báo tiếp, không tắt"):** bấm ✕ ẩn lời chúc của chủ đề đang xem, chỉ trong phiên và chỉ khi còn ở chủ đề đó (`bannerDismissedTheme` trong bộ nhớ, không lưu xuống máy); rời sang chủ đề khác rồi quay lại — hoặc mở lại app — là lời chúc hiện tiếp. (Hai bản thử trước đều sai ý anh: v61 nhớ một chủ đề theo ngày nên quay lại không hiện; v62 nhớ danh sách cả ngày — cũng không đúng ý "quay lại hiện tiếp".) Lưu ở `localStorage` khóa `labentry.theme.v1` (chỉ máy này, KHÔNG vào file sao lưu — cùng quy ước với cài đặt linh vật).


## Điều chỉnh v59 — Tab "Giao diện" riêng (2026-11-08, yêu cầu của Minh)

- Hai thẻ tùy chỉnh (Linh vật đồng ca + Chủ đề lễ hội) chuyển từ tab Quản lý sang **tab chính mới "Giao diện"** (`view-display`), nằm cạnh tab Quản lý ở thanh điều hướng dưới (thứ tự: Kết quả hôm nay · Quản lý · **Giao diện** · Lọc & Xuất kết quả PDF).
- Tab Giao diện là tab chính (thanh điều hướng dưới vẫn hiện), nút **+ ẩn** ở tab này (như tab Lọc & Xuất). Linh vật vẫn hiện ở tab Giao diện để xem trước khi tùy chỉnh (`mascotVisibleHere` thêm `display`). Không thay đổi khóa lưu trữ hay hành vi nào khác.

## F34 — Chữ ký của từng KTV trên bản in (v67, 2026-11-09, Minh chọn từ danh sách ý tưởng "pro")

- Mỗi KTV lưu **một ảnh chữ ký** trong hồ sơ của mình (trường `sig` trong `labentry.staff.v1`, data URL PNG) — đi theo file sao lưu/gộp như mã băm PIN. Đặt/thay qua nút **Chữ ký** ở danh sách KTV (Quản lý → Danh sách KTV): hộp thoại có **khung vẽ** (vẽ bằng ngón tay/chuột, mực xanh đậm), **Tải ảnh chữ ký** có sẵn, **Xóa bản vẽ**, **Xóa chữ ký đã lưu**. Khi lưu, ảnh được **cắt gọn viền trong suốt + thu nhỏ bề ngang ≤ 360px**. Đặt/xóa chữ ký ghi nhật ký thao tác (`staff-sig`), nội dung ảnh không ghi log.
- Ở **Cấu hình bản in**, mỗi ô ký (3 ô) có thêm ô chọn **Ảnh chữ ký của KTV**: chọn một KTV thì họ tên của ô ký tự điền theo tên KTV đó; khi in, nếu KTV được gắn **có** ảnh chữ ký, ảnh hiện trong khoảng ký tên (giới hạn cao 56px, rộng 170px, căn giữa). KTV chưa có chữ ký hoặc ô không gắn KTV → khoảng ký để trống như trước để ký tay.
- Hồ sơ KTV cũ và bố cục bản in cũ (chưa có trường `sig`/`staff`) được normalize về giá trị rỗng — không mất dữ liệu, không đổi hành vi cũ.
- Vị trí khối chữ ký: v68 thêm `sigsAlign` toàn cục (Trái/Giữa/Phải); **v69 thay bằng vị trí RIÊNG cho từng ô** (`align` trong từng ô ký: Trái/Giữa/Phải, mặc định Giữa) — ví dụ ô Trưởng khoa canh trái trong khi ô KTV canh phải; bố cục v68 được di trú tự động (`sigsAlign` cũ → align của mọi ô). **v70 sửa cách xếp**: các ô được gom vào 3 vùng Trái/Giữa/Phải (vùng giữa luôn hiện diện với lề tự động hai bên) nên vị trí đúng bất kể thứ tự khai báo — v69 dùng lề tự động từng ô, khi ô Phải đứng trước ô Trái thì cả cụm bị kéo vào giữa trang. Nội dung trong ô (chức danh, dòng '(Ký, ghi rõ họ tên)', ảnh chữ ký, họ tên) luôn canh giữa theo ô.

## F33 — Chống bàn phím che ô nhập (v66, 2026-11-09, Minh góp ý)

- Vấn đề: ở form nhập thường và nhập theo lô, khi bấm vào ô chữ trên Android, bàn phím bật lên che ô đang nhập; có trường hợp phải kéo màn hình lên mới thấy rõ để nhập.
- Cách xử lý (3 lớp, toàn bộ phía web — APK dùng chung lõi web nên hưởng theo, không cần cài lại):
  1. **Tự cuộn theo ô đang nhập** (`initKeyboardFix` trong app.js): sự kiện `focusin` trên mọi `input`/`textarea` (trừ checkbox/radio/nút/file…) — chỉ trên thiết bị cảm ứng hoặc màn hình < 900px — chờ 350ms cho bàn phím mở rồi `scrollIntoView({block: 'center'})`; ô nhập có `scroll-margin` 76/96px trong CSS. PC giữ nguyên hành vi (không tự cuộn).
  2. **Khai báo vùng hiển thị**: meta viewport thêm `interactive-widget=resizes-content` để Chrome/WebView (Chromium ≥108) co vùng hiển thị đúng phần phía trên bàn phím thay vì để bàn phím đè lên trang; trình duyệt không hỗ trợ thì bỏ qua êm.
  3. **Dọn chỗ khi bàn phím mở**: `visualViewport` phát hiện vùng hiển thị co > 150px → gắn cờ `body.kb-open` → CSS ẩn linh vật (`#mascot`), thanh điều hướng dưới (`#bottom-nav`) và nút nổi (`.fab`), thu gọn `.batch-navbar`; bàn phím đóng thì mọi thứ trở lại.
- Phạm vi: mọi ô nhập trong app (form đơn, lô thẻ, lô bảng, các cửa sổ tùy chỉnh) vì cơ chế gắn ở cấp document.
- Kiểm chứng: jsdom (meta viewport; focus vào ô ở dạng thẻ kích hoạt tự cuộn) + Chromium thật giả lập điện thoại (focus ô cuối thẻ → ô được cuộn vào vùng giữa màn hình) và giả lập PC (focus không tự cuộn). Hành vi bàn phím thật (Samsung Keyboard/Gboard, chiều cao từng máy) cần Minh thử trên máy thật; nếu còn khuất sẽ chỉnh thêm độ trễ/đệm.

## F35 — Chụp ảnh đọc mã trong màn hình quét + khối ký không tách trang (v71)

- Trong modal quét có nút **📷 Chụp ảnh đọc mã** (kèm ô file ẩn `accept="image/*" capture="environment"`): dùng khi mã in xấu, quét trực tiếp không ra. Ảnh được giải mã bằng chính bộ `BarcodeDetector` của máy trên ảnh tĩnh (thử toàn ảnh, chưa ra thì thử vùng giữa ảnh), đọc được mã thì đi đúng đường `acceptScanCode` như quét trực tiếp (tiếp nhận liên tục / quét 1 mã / quét tìm đều dùng được).
- **Ảnh không bao giờ được lưu**: chỉ xử lý trong bộ nhớ rồi bỏ, ô chọn file được xóa trắng ngay khi chọn xong; không ghi localStorage, không đính vào bản ghi, không tải lên đâu. Trình duyệt không có BarcodeDetector (vd Safari/iOS) thì báo rõ là không đọc được mã từ ảnh.
- In ấn: khối chữ ký cuối phiếu (`.sh-sigs`) có `break-inside: avoid` trong print.css — không đủ chỗ ở cuối trang thì cả khối ngắt sang trang mới, không để chức danh ở một trang còn chữ ký/họ tên ở trang sau.

## F36 — Linh vật báo mẫu quá 60 phút chưa phát hành + lời thoại ca êm mới (v72)

- Theo yêu cầu của Minh (2026-11-10): thêm trạng thái linh vật **unreleased** — mẫu **đã có kết quả** (trạng thái chờ phát hành) mà **quá 60 phút tính từ lúc nhận mẫu** vẫn chưa phát hành thì linh vật nhắc riêng: bong bóng "Có mẫu quá 60 phút chưa phát hành: {ID…}" (liệt kê tối đa 6 ID, nhiều hơn thì ghi "+N mẫu nữa"), huy hiệu = số mẫu, ảnh dùng mặt lo lắng (worried, chung với quá tải), chuyển động lắc nhẹ như quá tải.
- Thứ tự ưu tiên đầy đủ của `computeMascotState`: **quá giờ hẹn (overdue) > sắp tới giờ (hurried) > chưa phát hành quá 60 phút (unreleased) > quá tải (overload) > đang chờ (waiting) > ca êm (calm)**. Mẫu chưa có kết quả KHÔNG tính vào unreleased (chưa có gì để phát hành; nhóm đó thuộc overdue/overload).
- Lời thoại ca êm đổi từ "Ca êm quá — không còn mẫu nào tồn! 🎉" thành **"Hết mẫu rồi!"** (nguyên văn Minh yêu cầu).

## F37 — Mẫu hẹn lại / ngoại lệ: thiếu hụt, không đạt, hẹn hôm sau (v73)

- Theo yêu cầu của Minh (2026-11-10): thực tế có nhóm mẫu **thiếu hụt** (không đủ mẫu), **mẫu không đạt phải lấy lại**, hoặc **hẹn lại hôm sau vì một lý do riêng**. Các mẫu này **KHÔNG tính là "chưa có kết quả" hay "chưa phát hành"** — chúng rời khỏi mọi hàng chờ và được xử lý riêng.
- **Dữ liệu**: bản ghi thêm `deferReason` ('' = không hẹn; 'hut-mau' = Hụt mẫu; 'khong-dat' = Mẫu không đạt; 'khac' = Lý do khác), `deferNote` (ghi chú tự do), `deferAt` (giờ đánh dấu). Ba trường đi theo file sao lưu (parseBackup có kiểm tra lý do hợp lệ); nhật ký thao tác ghi hành động 'defer'/'undefer' kèm lý do. Đánh dấu hẹn lại cần có KTV đang trực (cùng cổng requireOperator như nhập kết quả).
- **Đánh dấu**: ở trang Xem của mẫu có nút **⏸ Hẹn lại mẫu này** mở hộp thoại chọn 1 trong 3 lý do + ghi chú; mẫu đang hẹn thì trang Xem hiện khối lý do và nút đổi thành "Sửa / bỏ hẹn lại". Khi hẹn lại, đồng hồ đếm ngược của mẫu bị tắt và báo thức native (APK/iOS) được đồng bộ gỡ. **Phát hành mẫu = tự động bỏ hẹn lại**. Bỏ hẹn lại: từ hộp thoại hoặc nút "Bỏ hẹn" ở trang riêng — mẫu quay lại danh sách chờ với trạng thái gốc.
- **Loại khỏi hàng chờ**: danh sách Hôm nay, hai panel Quản lý + số đếm thống kê chờ, nhập theo lô, bàn giao ca chính, tô đỏ quá hạn, báo động hẹn giờ (cả chuông web lẫn native), và mọi trạng thái nhắc việc của linh vật. Danh sách Lọc & Xuất/in phiếu giữ nguyên (hồ sơ chính thức; mẫu hẹn lại hiện kèm nhãn ⏸).
- **Trang riêng "Mẫu hẹn lại"** (nút trong tab Quản lý, kèm số đếm): lọc **Hôm nay / Các ngày trước / Tất cả**; mỗi dòng có ID, nhãn lý do, loại XN, giờ nhận, trạng thái gốc và các nút Xem / Nhập KQ / Bỏ hẹn. **Bàn giao riêng**: tích chọn một số mẫu hoặc để trống = bàn giao tất cả mẫu đang hiển thị; có ô nội dung để sao chép và nút in tờ "DANH SÁCH BÀN GIAO MẪU HẸN LẠI" (kèm cột lý do).
- **Linh vật**: thêm trạng thái **deferred** (ưu tiên thấp nhất, chỉ hiện khi ca đã êm): bong bóng "Có mẫu xét nghiệm hẹn lại: {ID · lý do · nhận dd/mm/yyyy; …}" tối đa 4 mẫu + "+N mẫu nữa", huy hiệu = số mẫu, ảnh chờ (waiting). Bong bóng chỉ bật **1 lần vào đầu mỗi ngày** (cờ `deferDay` trong labentry.meta.v1): sau lần đầu, trạng thái vẫn giữ nhưng bong bóng không tự bật lại trong ngày dù danh sách thay đổi; qua ngày mới báo lại nếu vẫn còn mẫu hẹn.
- Điều chỉnh v74 (theo góp ý của Minh trên máy thật, tối 10/11/2026): (1) bốn nút chức năng của tab Quản lý (Nhật ký thao tác / Bàn giao ca / Nhập kết quả theo lô / Mẫu hẹn lại) xếp **lưới 2 cột** gọn thay vì 4 hàng dọc chiếm chỗ; (2) đoạn giới thiệu ở trang Mẫu hẹn lại **rút còn một câu ngắn**; (3) thêm **nút ⏸ Hẹn lại ngay trên dòng mẫu** ở danh sách Hôm nay và Quản lý — bản v73 nút chỉ nằm trong trang Xem, mà mẫu chưa có kết quả không có nút Xem nên không tìm thấy đường vào; nút trên dòng mở thẳng hộp thoại chọn lý do.
- Điều chỉnh v75 (Minh chốt tối 10/11/2026): sau khi linh vật báo cáo mẫu hẹn lại xong 1 lần duy nhất đầu ngày (đủ 5 giây bong bóng), linh vật **quay về tư thế bình thường "Hết mẫu rồi!" và không còn huy hiệu đỏ đếm số mẫu** trên đầu; mở app lại trong cùng ngày cũng hiện ngay tư thế bình thường. (Bản v73 giữ trạng thái deferred + huy hiệu cả ngày — bị loại bỏ.)

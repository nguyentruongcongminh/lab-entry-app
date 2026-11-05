# LabEntry — App nhập kết quả xét nghiệm soi

App web HTML5/CSS/JavaScript thuần (không framework, không cần server; mọi tính năng chính chạy không cần internet — riêng nhập bằng giọng nói cần có mạng) mô phỏng đúng chức năng trong ảnh mẫu: nhập kết quả xét nghiệm theo từng loại, quản lý trạng thái phát hành, lọc và xuất PDF.

## Cách chạy

- Cách 1: mở thẳng file `index.html` bằng trình duyệt (điện thoại hoặc máy tính).
- Cách 2: chép cả thư mục lên hosting tĩnh bất kỳ (GitHub Pages, Netlify, máy chủ nội bộ...) rồi mở đường dẫn.
- **Cài như app trên điện thoại (PWA)**: bản đang chạy tại https://nguyentruongcongminh.github.io/lab-entry-app/ — mở địa chỉ này bằng Chrome/Samsung Internet trên điện thoại → chọn **Cài đặt ứng dụng / Thêm vào màn hình chính** → LabEntry xuất hiện như một app thật (icon riêng, mở toàn màn hình, mất mạng vẫn dùng được). Chia sẻ cho người khác = gửi địa chỉ này; mỗi người tự cài và có dữ liệu riêng trên máy mình. Khi có bản mới, app **tự cập nhật ở lần mở tiếp theo** (cần có mạng lúc mở), không phải cài lại và không mất dữ liệu đã nhập.

Dữ liệu lưu trong **localStorage của trình duyệt trên chính thiết bị đang dùng** — không gửi đi đâu, không có máy chủ. Đổi thiết bị/trình duyệt là dữ liệu không đi theo; xóa dữ liệu trình duyệt sẽ mất kết quả đã nhập.

## Cách dùng

- **Kết quả hôm nay**: danh sách kết quả nhập trong ngày, xếp theo giờ nhập — **nhập trước ở trên, mới nhất ở cuối danh sách**. Nút **+** thêm mới; icon bút = sửa, thùng rác = xóa (có hỏi xác nhận); kính lúp = tìm theo ID; icon ô vuông có dấu tick = chọn nhiều để xóa hàng loạt; icon vòng xoáy = làm mới; icon lọc (góc trái) = sang tab Lọc & Xuất PDF. **Muốn sửa phải bấm nút cây bút — bấm vào dòng hay vào ID không mở sửa.**
- **Nút Phát hành**: kết quả đang *Chờ phát hành* có thêm nút icon gửi màu xanh trên dòng — bấm nút này là phát hành **ngay lập tức, không hỏi lại**, với ngày giờ phát hành là thời điểm hiện tại, không cần mở form sửa để điền tay. Kết quả *Chưa kết quả* hoặc đã phát hành thì không có nút này.
- **Bấm giờ test nhanh (Máu ẩn 20 phút)**: mẫu Máu ẩn chưa có kết quả có nút **Bấm giờ** — mỗi mẫu một đồng hồ riêng, hiện đếm ngược ngay trên dòng; bấm lại để hủy. **Tới giờ** app kêu 3 tiếng bíp + rung + tô đỏ nhấp nháy dòng mẫu, nút biến thành **"Nhập KQ ngay"** bấm là mở thẳng form nhập kết quả. Muốn đặt bấm giờ cho loại khác: mở **Quản lý loại xét nghiệm** (nút ⚙ ở tab Quản lý) và điền số phút vào loại đó — không cần sửa code.
- **Tự quản lý danh mục xét nghiệm**: nút **⚙ ở tab Quản lý** mở danh mục — tự **thêm loại xét nghiệm mới**, sửa tên/trường kết quả (ô nhập chữ hoặc nút chọn mức (+)/(++)/(+++)), đặt số phút bấm giờ cho test nhanh; tất cả làm ngay trong app, không cần sửa code. Loại đang có bản ghi thì không xóa được; có nút khôi phục 6 loại mặc định. Danh mục tự tạo lưu trên máy và **đi kèm trong file sao lưu** để chuyển sang máy khác.
- **Nút nhập kết quả nhanh**: mỗi loại xét nghiệm tự định nghĩa được các nút nhập nhanh (trong trình sửa loại ở mục ⚙) — vào form nhập kết quả, bấm một nút là app **điền sẵn cả bộ kết quả** theo mẫu (ví dụ nút "Âm tính"), vẫn sửa tay tiếp được trước khi Lưu. Các loại mặc định đã có sẵn nút **Âm tính** (trừ Soi tươi huyết trắng); mỗi loại tối đa 8 nút, hàng nút nhỏ gọn ngay trên các trường kết quả.
- **Đóng dấu KTV theo thao tác**: chọn một **KTV trực** (người đang thao tác — chọn 1 lần ở tab Kết quả hôm nay hoặc ngay trong màn hình quét, app nhớ luôn) thì app tự ghi tên người đó lên từng mẫu: **KTV nhận** khi mẫu được nhận, **KTV thực hiện** mỗi lần lưu kết quả (ai sửa kết quả thì tên đổi sang người đó), **KTV phát hành** khi phát hành. Danh sách KTV thêm/xóa ngay trong app; trong form nhập có 3 ô chọn để sửa tay khi nhập hộ. Trang Xem hiện các dấu này và có nút **Hủy phát hành** (hỏi 1 lần) đưa mẫu về Chờ phát hành.
- **Tùy chỉnh bố cục bản in PDF**: nút **🎨 Tùy chỉnh bản in** ở tab Lọc & Xuất mở trang chỉnh có **xem trước trực tiếp**: tải **logo** lên, ghi tên đơn vị/khoa/địa chỉ/điện thoại, chọn **cột nào in** (bật/tắt, đổi tên, thứ tự, độ rộng — có cả 3 cột KTV nhận/thực hiện/phát hành), khổ giấy A4/A5 dọc/ngang, phông và cỡ chữ, thêm **khối chữ ký** (tối đa 3 ô) và ghi chú chân trang. Chưa tùy chỉnh gì thì bản in giữ nguyên bố cục cũ.
- **Tùy chỉnh bản in — đợt 2**: **tách cột kết quả theo từng trường** (mỗi trường một cột riêng, hợp khi in một loại XN/khổ ngang); **lưu mẫu bố cục** có tên để đổi qua lại nhanh (vd "Phiếu ngày A4" / "Báo cáo ngang"); **bố cục đi kèm file sao lưu** — phục hồi ở máy khác là có luôn bố cục + logo; **phân nhóm khi in** theo ngày nhận hoặc theo loại xét nghiệm; **hàng sọc xen kẽ** và **chọn màu nền hàng tiêu đề**.
- **Tự chuyển khung khi nhận mẫu mới**: đang ở tab Quản lý xem khung *Chờ phát hành* mà có mẫu mới được nhận (quét hoặc thêm tay) thì app **tự nhảy sang khung *Chưa kết quả*** để thấy mẫu mới ngay, khỏi bấm chuyển.
- **Gộp dữ liệu nhiều máy**: khối Sao lưu có thêm nút **Gộp dữ liệu từ file…** — chỉ thêm các mẫu máy này chưa có từ file sao lưu của máy khác (trùng ID + loại thì bỏ qua, dữ liệu đang có giữ nguyên), kèm báo cáo thêm/bỏ qua bao nhiêu mẫu. Nhiều điện thoại cùng nhận mẫu rồi dồn về một máy được, không cần server.
- **Máy quét mã vạch cầm tay**: ngoài camera, màn hình quét còn nhận mã từ **máy quét USB/Bluetooth** (loại giả lập bàn phím, bắn mã kết thúc bằng Enter) — cắm máy quét vào là bắn như thường, tiện cho khoa có sẵn máy quét để bàn.
- **Xuất CSV + thời gian trả kết quả**: ngoài PDF, tab Lọc & Xuất còn xuất **CSV** (mở bằng Excel) cho đúng danh sách đang lọc, kèm cột số phút trả kết quả từng mẫu; ngay trên tab có dòng thống kê **thời gian trả kết quả trung bình / nhanh nhất / lâu nhất** của danh sách đang lọc — tiện làm báo cáo.
- **Nhập kết quả bằng giọng nói**: các ô nhập chữ trong form (kết quả dạng chữ + ghi chú) có **nút micro** — bấm rồi nói tiếng Việt, app tự điền chữ vào ô (cần Chrome trên Android và có mạng; nhớ kiểm tra lại chữ trước khi lưu). Trường dạng nút (+) thì vẫn chọn tay.
- **Thống kê ngày & cảnh báo chờ lâu (tab Quản lý)**: đầu tab có 4 ô số liệu — *Nhận hôm nay*, *Chưa kết quả*, *Chờ phát hành*, *Phát hành hôm nay*. Mẫu đang chờ mà quá **60 phút** chưa xử lý sẽ bị **tô đỏ** kèm dòng "Đã chờ …" để không sót mẫu (danh sách tự làm mới mỗi phút).
- **Tiếng bíp khi bắn mã**: nhận thành công bíp cao ngắn, quét trùng bíp trầm — nghe là biết, khỏi nhìn màn hình.
- **Nút Xem tóm tắt kết quả**: kết quả **đã có kết quả** có thêm **nút "Xem" lớn nền xanh cạnh ID** — bấm vào mở bảng tóm tắt chữ to, gọn, dễ nhìn (ID thật lớn, từng chỉ số một dòng với giá trị in đậm, ghi chú và giờ nhận/phát hành), thiết kế để nhìn và **chép kết quả vào máy ở lab**. Trường mức độ bỏ trống hiện "Âm tính" như khi in PDF. Kết quả *Chưa kết quả* không có nút này.
- **Tiếp nhận mẫu bằng quét mã liên tục**: bấm **nút quét mã** trên thanh công cụ của tab Kết quả hôm nay (hoặc nút quét trong form thêm mới) → chọn **Loại xét nghiệm** một lần → camera quét **liên tục**, mỗi mã quét được là một mẫu được nhận ngay (vào nhóm *Chưa kết quả*, ghi giờ nhận tới giây). Màn hình quét là giao diện chuyên dụng nền tối: khung ngắm có góc định vị và vạch quét, băng trạng thái đổi màu khi nhận/trùng, danh sách mẫu của phiên có dấu ✓ kèm giờ nhận, nút **Dừng quét** đỏ rõ ràng. Loại xét nghiệm **không bị khóa**: đổi loại bất cứ lúc nào ngay giữa phiên cũng được — mỗi mẫu nhận theo loại đang chọn lúc bắn mã đó, và danh sách mẫu của phiên có ghi tên loại của từng mẫu. Mã trùng ID + loại sẽ bị báo "Đã tồn tại" và bỏ qua, phiên vẫn quét tiếp. Chỉ khi bấm **Dừng quét** vòng quét mới dừng. Nếu phiên quét mở từ **form thêm mới (nút +)** và có nhận được mẫu, dừng quét xong app **tự chuyển sang tab Quản lý** để xử lý tiếp hàng chờ kết quả. Màn hình quét liên tục **chỉ bắn mã bằng camera** (không có ô nhập tay) — hãy mở app bằng Chrome trên điện thoại để quét. Riêng khi mở quét từ **form sửa** một kết quả, app nhận đúng 1 mã để điền vào ô ID rồi tự đóng (ở đó vẫn còn ô nhập tay dự phòng khi máy không quét được).
- **Form nhập**: nhập **ID Xét Nghiệm** (bắt buộc) hoặc bấm icon mã để quét QR/barcode bằng camera (chỉ khi trình duyệt hỗ trợ, xem Giới hạn). Chọn **Loại Xét Nghiệm** thì bộ trường kết quả đổi theo. Trường dạng nút (+), (++), (+++): bấm để chọn mức, bấm lại chính nút đó để bỏ chọn. **Ngày Giờ** tự điền thời điểm nhập. Điền **Ngày giờ phát hành** khi phát hành kết quả. Bấm **Lưu**.
- **Chống nhập trùng**: nếu đã có kết quả khác **cùng ID + cùng loại xét nghiệm**, app báo **"Đã tồn tại"** và không cho lưu (cùng ID nhưng loại khác thì vẫn nhập được).
- **Quản lý**: có 2 khung nhưng **chỉ hiện một khung tại một thời điểm** — mặc định là *Chưa kết quả* (chưa nhập trường kết quả nào; xếp theo giờ nhận mẫu — **nhận trước lên đầu, nhận sau xuống cuối** — để làm theo thứ tự mẫu tới); bấm nút chuyển **Chờ phát hành** (có hiện số lượng trên nút) mới xem khung đã có kết quả chưa phát hành (mới nhất lên đầu). Sửa bằng nút cây bút trên dòng; phát hành bằng nút Phát hành trên dòng.
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

## Sao lưu & phục hồi dữ liệu

Dữ liệu nằm trong localStorage của trình duyệt trên từng máy — mất cache/đổi máy là mất dữ liệu. Ở cuối tab **Lọc & Xuất PDF** có khối **Sao lưu & phục hồi dữ liệu**:

- **Tải file sao lưu**: tải về 1 file JSON (`labentry-sao-luu-*.json`) chứa toàn bộ dữ liệu. Hãy giữ file ở nơi an toàn (Drive, Zalo tự gửi cho mình…) và sao lưu định kỳ, ví dụ cuối mỗi ngày.
- **Phục hồi từ file…**: chọn file sao lưu đã tải — app kiểm tra file hợp lệ, hỏi xác nhận (nêu số bản ghi + thời gian xuất) rồi **thay toàn bộ** dữ liệu hiện tại bằng dữ liệu trong file. File hỏng/không đúng định dạng sẽ bị từ chối, dữ liệu hiện tại không đổi.
- File sao lưu cũng dùng để **chuyển dữ liệu sang máy/điện thoại khác**: tải file ở máy cũ, mở app ở máy mới rồi phục hồi từ file đó.

## Cấu trúc file

- `index.html` — khung giao diện 3 tab + form + vùng in.
- `styles.css` — giao diện mobile giống mẫu. · `print.css` — định dạng bản in/PDF.
- `config.js` — khai báo loại xét nghiệm và bộ trường.
- `store.js` — lưu trữ localStorage + logic nghiệp vụ (kiểm tra ID bắt buộc, suy ra trạng thái, lọc).
- `app.js` — điều khiển giao diện.
- `SPEC.md` — đặc tả + kiến trúc đã được duyệt.
- `tests/` — bộ test tự động.

## Kết quả kiểm thử (chạy thật ngày 2026-11-04)

- `node tests/logic.test.js` — **24/24 đạt**: cấu hình đủ 6 loại/đúng bộ trường; chặn lưu khi thiếu ID hoặc sai loại; 3 trạng thái đúng đặc tả; sửa/xóa; lọc theo ID/loại/trạng thái/ngày; lưu–đọc lại qua storage (mô phỏng tải lại trang); chặn trùng ID + loại XN (kể cả khi sửa sang ID/loại của bản ghi khác); hẹn giờ bấm giờ; sao lưu/phục hồi (xuất–nhập cho lại đúng dữ liệu, phục hồi thay toàn bộ, file hỏng bị từ chối và giữ nguyên dữ liệu); thống kê thời gian trả kết quả (TAT); gộp dữ liệu (chỉ thêm mẫu chưa có, trùng bỏ qua, giữ nguyên dữ liệu máy).
- `node tests/ui.test.js` và `node tests/ui-single.test.js` — **44/44 đạt** cho cả bản nhiều file lẫn bản 1 file (nạp trang thật vào jsdom, thao tác như người dùng): thêm đủ loại, đổi loại đổi bộ trường, chip chọn/đổi/bỏ chọn, chặn lưu thiếu ID, chặn nhập trùng qua form, thứ tự nhóm Chưa kết quả theo giờ nhận, sửa + phát hành đổi trạng thái, nút Xem lớn + bảng tóm tắt kết quả (chỉ ở bản ghi đã có kết quả, giá trị đúng, chip trống = "Âm tính"), nút Phát hành trên dòng phát hành ngay không hỏi lại (chỉ ở bản ghi chờ phát hành), bấm vào dòng/ID không mở sửa — chỉ nút bút mới mở, phân nhóm Quản lý, tìm kiếm, chọn nhiều + xóa, xóa từng dòng, lọc & bảng in PDF (kể cả "Âm tính" cho trường chip bỏ trống), quét liên tục tiếp nhận mẫu bằng camera — mô phỏng đúng hàm nhận mã của vòng quét (không còn ô nhập tay ở chế độ liên tục, đổi loại được giữa phiên (không khóa), trùng bỏ qua, dừng theo yêu cầu), chế độ quét 1 mã từ form sửa, phát hành ngay trong trang Xem tóm tắt, lưu form giữ nguyên tab đang dùng (không nhảy về tab đầu). sao lưu & phục hồi qua giao diện (nhập file hợp lệ thay dữ liệu và hiện lên danh sách, file hỏng bị từ chối); tự quản lý danh mục (thêm loại mới rồi nhập kết quả cho loại đó ngay, chặn xóa loại đang có bản ghi, chặn khôi phục mặc định khi còn bản ghi loại tự thêm); sao lưu kèm danh mục trong file; xuất CSV + dòng thống kê TAT; nhập giọng nói tự ẩn khi trình duyệt không hỗ trợ; gộp dữ liệu từ file qua giao diện (thêm mẫu mới, gộp lại không trùng); máy quét cầm tay mô phỏng (gõ nhanh + Enter được nhận, gõ chậm thì không); khai báo PWA (có link manifest + theme-color, manifest hợp lệ với icon 192/512/maskable và đủ file icon trên đĩa, service worker gắn đúng số phiên bản và precache đúng các URL theo phiên bản).
- Kiểm tra chéo: toàn bộ 53 id phần tử mà `app.js` tham chiếu đều tồn tại trong `index.html`; `node --check` sạch cho cả 3 file JS.

Chạy lại test: `node tests/logic.test.js` (không cần cài gì thêm) và `cd tests && npm install && node ui.test.js` (cần jsdom).

## Giới hạn thật (chưa làm / phụ thuộc thiết bị)

- **Quét mã**: dùng `BarcodeDetector` của trình duyệt (có trên Chrome Android). Trình duyệt không hỗ trợ thì app báo rõ trên màn hình quét — không treo.
- **Lưu trữ 1 thiết bị**: chưa có đồng bộ nhiều máy/máy chủ (đúng mặc định đã duyệt). Cần dùng chung nhiều máy thì phải làm thêm backend.
- **Giao diện**: đã kiểm bằng test DOM tự động theo đúng cấu trúc ảnh mẫu; chưa đối chiếu pixel trên điện thoại thật — nên mở thử trên máy của khoa để xem cỡ chữ/bố cục có vừa mắt không.
- Nhãn "Lactobaccilli" giữ nguyên chính tả như trong ảnh mẫu.

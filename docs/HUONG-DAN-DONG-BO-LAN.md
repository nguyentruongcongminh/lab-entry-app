# LabEntry v87 — Dùng chung dữ liệu qua mạng LAN

Tài liệu cho người phụ trách kỹ thuật (cài đặt, cách hoạt động, giới hạn). KTV chỉ cần đọc
`server/HUONG-DAN.txt` (đi kèm gói máy chủ).

## 1. Tổng quan

```
   PC (Chrome)          Điện thoại (Chrome / app Android)         PC khác
        \                        |                                  /
         \_______  Wi-Fi / mạng LAN  ______________________________/
                           |
                Máy chủ LabEntry (1 máy Windows trong phòng)
                server/server.js  ·  dữ liệu: server/data/state.json (+ backup mỗi ngày)
```

- **Một nguồn dữ liệu duy nhất** (máy chủ) + mỗi máy là một **bản làm việc đầy đủ** (như trước v87: `localStorage`).
- Máy chủ **không cần Internet**, không gọi dịch vụ ngoài; chỉ nhận kết nối từ địa chỉ mạng nội bộ
  (192.168.x.x, 10.x.x.x, 172.16–31.x.x, localhost), kiểm tra `Host`/`Origin`, bắt buộc header `X-LabEntry`.
- Gần như tức thời: máy khách treo một yêu cầu "long-poll" (`/api/sync?wait=20`); máy chủ trả lời ngay khi có thay đổi.

## 2. Cài đặt (xem `server/HUONG-DAN.txt`)

Gói giải nén-là-chạy: `node tools/package-server.js --node-exe <node.exe Windows> --zip` (hoặc workflow
`build-lan-server.yml`) tạo `LabEntry-LAN/` gồm `Chay-may-chu.bat`, `Mo-tuong-lua.bat`,
`Tu-khoi-dong-cung-Windows.bat`, `server/`, các file web và (tuỳ chọn) `node/node.exe`. Máy chủ chỉ cần Windows
10/11; không cài thêm gì khi gói có `node.exe`.

Chạy tay (dev/Linux/macOS): `node server/server.js` (biến môi trường: `PORT`, `LAB_DATA`, `LAB_ORIGINS`, `LAB_HOSTS`).

## 3. Cách nối từng loại máy

| Thiết bị | Cách nối | Quét camera |
|---|---|---|
| PC / laptop (Chrome, Edge) | mở `http://<IP máy chủ>:8787/` — **tự nối** | không (dùng máy quét cầm tay / gõ tay). Máy chủ mở `http://localhost:8787/` thì quét camera được |
| Điện thoại, trình duyệt Chrome | mở `http://<IP máy chủ>:8787/` — tự nối | không (trang `http` không phải ngữ cảnh an toàn) |
| App Android LabEntry (APK ≥ build có `allowMixedContent`) | Quản lý → 🔗 Đồng bộ LAN → nhập IP → Kết nối (1 lần) | **có** |

Vì sao: trình duyệt chỉ cho camera, Service Worker, `crypto.subtle` trên trang https hoặc localhost. Trang mở từ
IP LAN qua http thiếu các thứ đó. App đã xử lý phần quan trọng: PIN dùng SHA-256 thuần JS (kết quả **giống hệt**
`crypto.subtle` nên PIN dùng được giữa mọi máy), thông báo/khóa màn hình/clipboard đều có đường dự phòng.

> **Đã kiểm chứng trên Android thật (giả lập LDPlayer 9, Chrome Android, 2026-11-13):** mở `http://192.168.1.36:8787/` trên Chrome Android
> (trang http không an toàn, không có `crypto.subtle`) → tự nối; KTV tạo ở PC sang điện thoại; PIN băm SHA-256 ở PC được điện thoại
> kiểm đúng (PIN sai bị từ chối); điện thoại tiếp nhận mẫu → PC thấy; PC nhập kết quả + phát hành → điện thoại thấy "Đã phát hành";
> điện thoại chặn xóa mẫu đã phát hành; PC cố sửa/xóa mẫu đã phát hành bị máy chủ từ chối, điện thoại hiện thông báo xung đột bằng lời
> dễ hiểu; tắt máy chủ → thanh cam "Mất mạng", điện thoại vẫn nhập mẫu + kết quả; bật lại → tự khớp, PC thấy đúng một bản, không trùng.
> Đường **vỏ APK** (trang https GitHub Pages gọi máy chủ http) chỉ được kiểm ở mức hợp đồng CORS/preflight/Private-Network
> (`tests/sync-e2e.test.js`, test "đường APK Android") — **chưa chạy APK thật**: cần build lại APK (CI `build-apk.yml`) để có
> `allowMixedContent` + `usesCleartextTraffic`; Android/WebView mới có thể thêm yêu cầu quyền "mạng cục bộ". Nếu APK không nối được:
> dùng Chrome mở địa chỉ máy chủ (không quét camera được) và báo lại.

## 4. Luật đồng bộ (đã có test tự động)

Mỗi thao tác của KTV = một *op* có `opId` duy nhất, xếp hàng bền trong máy, gửi khi có mạng.

| Tình huống | Kết quả |
|---|---|
| Gửi lại op (rớt mạng sau khi máy chủ đã xử lý) | chỉ áp dụng **một lần** (dedupe theo `opId`, ghi cùng lượt với dữ liệu) |
| Hai máy sửa **khác ô** | tự gộp cả hai |
| Hai máy sửa **cùng ô** | giữ bản đến trước; bản kia vào **Xung đột** (KTV chọn "giữ" hoặc "dùng của X") |
| Giờ lưu kết quả, KTV thực hiện, hẹn giờ, cờ KHẨN | bản sau thắng (dấu vết tự động, không làm phiền KTV) |
| Hai máy cùng tiếp nhận một mã (+ cùng loại XN) | còn **một** bản ghi; giống hệt → gộp im lặng; khác nội dung → Xung đột |
| Mẫu **đã phát hành** | bất biến: sửa/xóa từ máy khác bị từ chối (giá trị bị từ chối vẫn lưu ở Xung đột); "Hủy phát hành" chỉ được khi máy đã thấy đúng phiên bản hiện tại |
| Phát hành khi kết quả vừa bị máy khác đổi (KTV chưa thấy) | từ chối phát hành, mẫu vẫn "Chờ phát hành" |
| Máy cũ sửa mẫu đã bị xóa | không làm sống lại; thay đổi giữ ở Xung đột, KTV có thể **Khôi phục** |
| Xóa dựa trên bản cũ (mẫu đã bị sửa) | từ chối xóa |
| Danh mục xét nghiệm | ghi theo phiên bản; máy dựa trên bản cũ → Xung đột; lần nối đầu thì **hợp** theo mã loại |
| Danh sách KTV (tên, PIN băm, chữ ký) | đồng bộ theo tên, bản mới hơn thắng; dữ liệu KTV cũ có sẵn trên máy (`ts=0`) không ghi đè KTV đã có trên máy chủ |
| Nhật ký thao tác | hợp theo mã dòng, dùng chung toàn phòng |

Ở phía giao diện: form nhập mở lâu / lô nhập mở lâu chỉ ghi các ô KTV **thực sự sửa** lên bản mới nhất, và mốc phiên bản là bản KTV **đã thấy lúc bắt đầu sửa** — nên nếu máy khác vừa sửa đúng ô đó (kể cả khi cả hai máy đều đang online) thì thành Xung đột, không bị ghi đè;
mẫu đã phát hành không mở được form sửa và không xóa được (khi đang dùng chung); "Phục hồi thay toàn bộ" bị khóa.

## 5. Chuyển dữ liệu cũ (không phải nhập lại)

- Máy mở app **ở đúng địa chỉ/origin đã dùng trước đây** (ví dụ app Android, hoặc bản web đã cài): dữ liệu local còn
  nguyên → lần nối đầu tiên app hỏi rồi **gửi toàn bộ** mẫu/KTV/danh mục/nhật ký lên máy chủ; có bản lưu dự phòng
  `labentry.presync.backup.v1` trong máy trước khi gửi.
- Máy dùng bản web ở **origin khác** (ví dụ cũ ở `github.io`, nay mở bằng `http://<IP>:8787` — `localStorage` tách theo
  origin nên máy trống): ở trang cũ **Tải file sao lưu**; ở trang mới **Gộp dữ liệu từ file…**. Mẫu trùng khác nội dung
  vào Xung đột — không bị bỏ qua im lặng. Máy chủ cũng nhận `POST /api/import` (cùng luật).
- Hai máy cùng có một mẫu giống hệt → gộp; khác nhau → Xung đột để KTV chọn.

## 6. An toàn dữ liệu & khôi phục

- Ghi `state.json` nguyên tử (file tạm → fsync → đổi tên), giữ `state.json.bak`, sao lưu ngày vào `backup/` (60 ngày).
  File hỏng + không có `.bak` → máy chủ **dừng báo lỗi, không khởi tạo rỗng để ghi đè**.
- Máy chủ mất dữ liệu / thay máy chủ mới: các máy tự **nạp lại dữ liệu của mình** lên máy chủ mới (không mất, không trùng).
- Mất mạng: hàng đợi lưu bền (`labentry.syncq.v1`) — tắt app/máy vẫn còn; có mạng lại tự gửi.

## 7. Giới hạn cần biết

- Máy chủ là một điểm tập trung: tắt máy chủ thì các máy vẫn làm việc riêng nhưng chưa thấy nhau (hết giới hạn khi máy chủ bật lại).
- Giờ trên mẫu lấy theo đồng hồ từng máy; nên để các máy tự cập nhật giờ.
- Địa chỉ máy chủ đổi (DHCP): đặt IP cố định trên router; app tự cập nhật khi mở bằng địa chỉ mới của đúng máy chủ đó; có nút 🔍 Tìm máy chủ.
- Trang `https` (GitHub Pages) mở trong **trình duyệt** không gọi được máy chủ `http` LAN (chặn nội dung hỗn hợp) — dùng địa chỉ máy chủ hoặc app Android.
- Mở lại trình duyệt **khi đang mất mạng** trên địa chỉ `http://IP:8787`: trang không được cache (không có Service Worker trên http).
  Tab đang mở thì vẫn chạy bình thường. App Android và `http://localhost:8787` (máy chủ) có cache.

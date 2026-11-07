# LabEntry — vỏ Android (bản thử)

Vỏ app Android cho [LabEntry](https://nguyentruongcongminh.github.io/lab-entry-app/):
một WebView (Capacitor) mở đúng bản web đang chạy, cộng một cầu nối native duy nhất —
**báo thức hệ thống chính xác cho các xét nghiệm hẹn giờ** (`LabAlarmBridge` +
`LabAlarmReceiver`), để điện thoại kêu đúng giờ nhập kết quả kể cả khi app đã đóng.

- Mã app: `vn.labentry.app` · Tên hiển thị: LabEntry
- Ruột web vẫn là repo [lab-entry-app](https://github.com/nguyentruongcongminh/lab-entry-app)
  (bản v46 trở đi tự đồng bộ báo thức native khi chạy trong vỏ; trên trình duyệt thường không đổi gì).

## Build

Build chạy trên GitHub Actions (`.github/workflows/build-apk.yml`): mỗi lần đẩy lên `main`
sẽ tạo một Release `apk-trial-N` chứa APK **chưa ký**.

Ký số được làm riêng ngoài CI bằng keystore cá nhân (không nằm trong repo):
`zipalign` rồi `apksigner sign` bằng keystore LabEntry, kiểm tra bằng `apksigner verify`.

## Cấu trúc

- `android/` — dự án Android (Capacitor): `app/src/main/java/vn/labentry/app/` chứa
  `MainActivity`, `LabAlarmBridge` (JavascriptInterface `window.LabAlarmNative`),
  `LabAlarmReceiver` (thông báo khi tới giờ + khôi phục báo thức sau khi máy khởi động lại).
- `tools/gen_icons.py` — sinh icon/splash PNG từ `tools/icon-512.png.b64` trong CI.
- `capacitor.config.json` — trỏ WebView tới bản web live.

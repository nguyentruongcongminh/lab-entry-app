/* LabEntry — Service Worker (PWA)
 * Phiên bản cache gắn với số bản phát hành của app: MỖI lần tăng bản (vN)
 * phải tăng VERSION ở đây cho khớp — cache cũ sẽ bị xóa khi bản mới kích hoạt.
 * Chiến lược:
 * - Điều hướng (mở app): network-first — có mạng là nhận trang mới nhất,
 *   mất mạng thì dùng bản đã cache (app chạy offline hoàn toàn).
 * - Tài nguyên tĩnh (css/js/icon): cache-first theo đúng URL ?v=N; URL mới
 *   (bản mới) chưa có trong cache thì tải mạng rồi lưu lại.
 * - Bản mới: skipWaiting + clients.claim để kích hoạt ngay; phía trang web
 *   (app.js) nghe sự kiện controllerchange và tự tải lại một lần khi rảnh,
 *   nên người dùng mở app là gặp bản mới nhất, dữ liệu localStorage không
 *   bị đụng tới (cache này chỉ chứa file chương trình).
 */
const VERSION = 'v49';
const CACHE = 'labentry-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './styles.css?v=49',
  './print.css?v=49',
  './config.js?v=49',
  './store.js?v=49',
  './app.js?v=49',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('labentry-') && k !== CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req));
    })
  );
});

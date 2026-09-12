const CACHE_NAME = 'sehati-cache-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Saat pertama diinstal, simpan file inti aplikasi ke cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Jika sebagian gagal (misal offline saat install pertama), lanjut tanpa error fatal
      });
    })
  );
});

// Bersihkan cache versi lama saat service worker baru aktif
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategi: coba ambil dari jaringan dulu, simpan salinan ke cache,
// kalau gagal (offline) ambil dari cache sebagai cadangan.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Keamanan: hanya proses request GET yang aman untuk di-cache
  if (req.method !== 'GET') return;

  // Keamanan: jangan pernah cache respons yang gagal/dialihkan mencurigakan,
  // dan lewati skema non-http (mis. chrome-extension://) yang tidak didukung Cache API
  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Hanya simpan respons yang benar-benar berhasil (200 OK)
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});

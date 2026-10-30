/**
 * WebApp_weather/sw.js
 * 淡水潮汐氣象 PWA 專屬 Service Worker
 * 實作離線 App Shell 快取與 Stale-While-Revalidate 策略
 */

const CACHE_NAME = 'tamsui-tide-pwa-v9';

// 預先快取的 App Shell 核心靜態資源清單
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './api.js',
  './tide.js',
  './manifest.json',
  './icon.svg'
];

// 安裝事件：快取 App Shell 資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 啟動事件：清除過期舊版本快取並立刻接管
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截網路請求：智慧分流快取策略
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理 GET 請求
  if (req.method !== 'GET') return;

  // 1. 外部請求（CWA 氣象署 API、外部 CDN 等）：完全放行由瀏覽器原生 Fetch 處理
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. 本機同源 App Shell 資源：採用 Network-First 策略 (確保始終載入最新代碼，離線才回退快取)
  event.respondWith(
    fetch(req)
      .then((netResp) => {
        if (netResp && netResp.status === 200) {
          const respClone = netResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
        }
        return netResp;
      })
      .catch(() => {
        return caches.match(req).then((cached) => cached || caches.match('./index.html'));
      })
  );
});

// Installation support only. No Cache Storage and no API interception.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NACS 충전지도</title><body style="font-family:system-ui;padding:24px"><h2>인터넷 연결을 확인해 주세요</h2><p>연결되면 다시 열어주세요.</p><button onclick="location.reload()">다시 시도</button></body></html>',
    {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}}
  )));
});

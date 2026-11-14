const APP_URL = new URL(self.registration.scope);
const INDEX_URL = new URL('index.html', APP_URL).href;
const CACHE_PREFIX = `iroha:${APP_URL.href}:`;
const CACHE = `${CACHE_PREFIX}v2`;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(INDEX_URL, { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the app');
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map(match => new URL(match[1], APP_URL))
      .filter(url => url.origin === APP_URL.origin && url.pathname.startsWith(APP_URL.pathname))
      .map(url => url.href);
    const urls = ['./', './icon.svg', './manifest.webmanifest', ...assets].map(path => new URL(path, APP_URL).href);
    await cache.put(INDEX_URL, new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    await cache.addAll([...new Set(urls)]);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== APP_URL.origin || !url.pathname.startsWith(APP_URL.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(event.request))
      || (event.request.mode === 'navigate' ? await cache.match(INDEX_URL) : undefined)
      || Response.error();
  }));
});

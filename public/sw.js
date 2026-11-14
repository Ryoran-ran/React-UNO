const CACHE = 'iroha-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('./index.html', { cache: 'reload' });
    if (!response.ok) throw new Error('Could not cache the app');
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(url => !url.startsWith('http'));
    await cache.put('./index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    await cache.addAll([...new Set(['./', './icon.svg', './manifest.webmanifest', ...assets])]);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => { for (const key of await caches.keys()) if (key.startsWith('iroha-') && key !== CACHE) await caches.delete(key); await self.clients.claim(); })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : undefined) || Response.error()));
});

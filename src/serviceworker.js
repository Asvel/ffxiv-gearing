/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => {
  self.skipWaiting();
});

addEventListener('activate', event => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const matches = /^(.*\/[^\/]+\.)\w{10}(\.\w+)$/.exec(req.url);
    if (matches === null) {
      const res = await event.preloadResponse;
      if (res !== undefined) return res;
      return fetch(req);
    }

    let res = await caches.match(req);
    if (res !== undefined) return res;

    res = await fetch(req);
    if (res === undefined || res.status !== 200 || res.type !== 'basic') return res;

    caches.open('ffxiv-gearing-v1').then(async cache => {
      const keys = await cache.keys();
      await cache.put(req, res);
      const oldVersion = keys.find(k => k.url.length === req.url.length &&
        k.url.startsWith(matches[1]) && k.url.endsWith(matches[2]));
      if (oldVersion !== undefined) {
        await cache.delete(oldVersion);
      }
    });

    return res.clone();
  })());
});

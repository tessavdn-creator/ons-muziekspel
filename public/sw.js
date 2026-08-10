const CACHE = 'timepop-v4-admin-play-split'
const scoped = path => new URL(path, self.registration.scope).toString()
const APP = ['./', './index.html', './manifest.webmanifest', './icon.svg'].map(scoped)
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(APP)).then(() => self.skipWaiting()),
))
self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => Promise.all(clients.map(client => client.navigate(client.url)))),
))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone()
    caches.open(CACHE).then(cache => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then(match => match || caches.match(scoped('./index.html')))))
})

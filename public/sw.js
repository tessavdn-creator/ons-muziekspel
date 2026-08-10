const CACHE = 'muziekspel-v1'
const scoped = path => new URL(path, self.registration.scope).toString()
const APP = ['./', './index.html', './manifest.webmanifest', './icon.svg'].map(scoped)
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP))))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))))
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone()
    caches.open(CACHE).then(cache => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then(match => match || caches.match(scoped('./index.html')))))
})

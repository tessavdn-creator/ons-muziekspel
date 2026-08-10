// One-time cleanup worker: older releases cached the app too aggressively.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys()
  await Promise.all(keys.map(key => caches.delete(key)))
  await self.clients.claim()
  const clients = await self.clients.matchAll({ type: 'window' })
  await self.registration.unregister()
  await Promise.all(clients.map(client => client.navigate(client.url)))
})()))

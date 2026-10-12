/* Service Worker der Arbeitsschutz-App: damit Browser sie als App installieren.
   Bewusst KEIN Cache – wie beim Kundenportal immer der aktuelle Stand. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){
  var r = e.request;
  if(r.method !== 'GET') return;
  var u = new URL(r.url);
  if(u.origin !== self.location.origin) return;
  if(r.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(u.pathname)){
    e.respondWith(fetch(r, { cache: 'no-store' }).catch(function(){ return fetch(r); }));
  }
});

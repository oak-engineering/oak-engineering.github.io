/* Service Worker des Kundenportals: damit Browser die Seite als App installieren.
   Bewusst KEIN Cache – Dokumente und Unterweisungen sollen immer den aktuellen Stand zeigen.
   Seiten, Skripte und Stile des Portals holt die App immer frisch vom Server (Stand 16.09.2026):
   sonst zeigte die installierte App nach einem Update bis zu 10 Minuten den alten Stand. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){
  var r = e.request;
  if(r.method !== 'GET') return;
  var u = new URL(r.url);
  if(u.origin !== self.location.origin) return;                       // Supabase & Co. unveraendert
  if(r.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(u.pathname)){
    e.respondWith(fetch(r, { cache: 'no-store' }).catch(function(){ return fetch(r); }));
  }
});

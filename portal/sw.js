/* Service Worker des Kundenportals: nur damit Browser die Seite als App installieren.
   Bewusst KEIN Cache – Dokumente und Unterweisungen sollen immer den aktuellen Stand zeigen. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){ /* durchreichen */ });

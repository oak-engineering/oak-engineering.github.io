/* OAK Kundenportal — Seite laeuft als Tab im Portal-Programm (App, Nikolai 17.09.2026).
   Dann: kein „← Übersicht"-Knopf (der Tab wird oben geschlossen), und Links auf weitere Portal-Seiten
   oeffnen einen weiteren Tab statt eines neuen Programmfensters. Im normalen Browser passiert nichts. */
(function(){
  var oben = null;
  try{ if(window.top !== window.self && typeof window.top.portalDokOeffnen === "function") oben = window.top; }catch(e){ oben = null; }
  if(!oben) return;
  document.documentElement.classList.add("im-tab");
  var s = document.createElement("style");
  s.textContent = '.im-tab a.btn[href="index.html"]{display:none!important}';
  (document.head || document.documentElement).appendChild(s);
  document.addEventListener("click", function(ev){
    var a = ev.target.closest && ev.target.closest("a[href]"); if(!a) return;
    var u; try{ u = new URL(a.href, location.href); }catch(e){ return; }
    if(u.origin !== location.origin) return;
    if(/\/portal\/(index\.html)?$/.test(u.pathname)){ ev.preventDefault(); oben.portalDokSchliessenAktiv(); return; }
    if(a.target !== "_blank" || !/\/portal\/(viewer|maschine|qr)\.html$/.test(u.pathname)) return;
    ev.preventDefault();
    var p = u.searchParams;
    oben.portalDokOeffnen(u.pathname.split("/").pop() + u.search, p.get("t") || p.get("m") || (a.textContent || "").trim());
  }, true);
})();

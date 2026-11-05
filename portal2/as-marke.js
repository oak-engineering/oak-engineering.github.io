/* OAK EHS-Cockpit – Kundenmarke ohne Aufblitzen. Wird im <head> VOR as.css geladen und setzt sofort die zuletzt
   gesehene Marke aus dem Gerätespeicher (gleicher Schlüssel wie das Kundenportal: portal/marke.js „oak_portal_marke“).
   Nach dem Login bestätigt asMarkeAnwenden (as-app.js) die Marke aus der Datenbank und schreibt sie zurück.
   --gruen ist in V2 die Ampelfarbe und wird hier nie gesetzt. Keine globalen Namen (IIFE). */
"use strict";
(function(){
  try{
    const m = JSON.parse(localStorage.getItem("oak_portal_marke") || "null");
    if(!m || typeof m !== "object") return;
    const farbe = v => typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null;
    if(!farbe(m.farbe)) return;
    const st = document.documentElement.style;
    [["--blau", m.farbe], ["--blau-tief", m.farbe_tief], ["--blau-hell", m.farbe_hell], ["--blau2", m.akzent], ["--bg", m.hintergrund]]
      .forEach(([k, v]) => { if(farbe(v)) st.setProperty(k, v); });
    const meta = () => { const t = document.querySelector('meta[name="theme-color"]'); if(t) t.setAttribute("content", m.farbe); };
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", meta, { once: true }); else meta();
  }catch(e){ /* ohne Marke weiter – OAK-Grün */ }
})();

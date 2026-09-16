/* OAK Kundenportal – Marke je Kunde fuer die Nebenseiten (Dokument-Ansicht, Maschinenseite).
   Liest portal_kunde.marke (Farben + Logo) und setzt sie als Inline-Variablen auf :root,
   genau wie app.js es auf der Hauptseite tut. Ohne Marke bleibt alles OAK-gruen. */
"use strict";
window.OAK_MARKE = {
  aktuell: null,
  /* <style>-Block fuer eingebettete Dokumente (Shells laufen in einer eigenen Origin, erben die :root-Variablen nicht) */
  styleBlock(){
    const m = this.aktuell || {}; if(!m.farbe) return "";
    return '<style id="marke-kunde">:root{--gruen:' + m.farbe + ';--dunkel:' + (m.farbe_tief || m.farbe) + ';--hell:' + (m.farbe_hell || m.farbe) + ';--akzent:' + (m.akzent || '#eef2f8') + ';--primary:' + m.farbe + '}</style>';
  },
  setzen(m, name){
    m = m || {}; this.aktuell = m;
    const st = document.documentElement.style;
    const setz = (k, v) => { if(v) st.setProperty(k, v); else st.removeProperty(k); };
    setz("--gruen", m.farbe);          setz("--oak", m.farbe);
    setz("--dunkel", m.farbe_tief);    setz("--oak-deep", m.farbe_tief);
    setz("--hellgruen", m.farbe_hell); setz("--oak-light", m.farbe_hell); setz("--oak-mid", m.farbe_hell);
    setz("--akzent", m.akzent);        setz("--oak-pale", m.akzent);
    setz("--oak-ghost", m.hintergrund);
    const img = document.getElementById("kundeLogo");
    if(img){ if(m.logo){ img.src = m.logo; img.alt = name || ""; img.hidden = false; } else { img.hidden = true; img.removeAttribute("src"); } }
    document.body.classList.toggle("marke-kunde", !!m.farbe);
    const meta = document.querySelector('meta[name="theme-color"]'); if(meta) meta.setAttribute("content", m.farbe || "#2D6A4F");
  },
  async anwenden(slug){
    if(!slug || typeof apiGet !== "function") return;
    try{
      const r = await apiGet("/rest/v1/portal_kunde?select=slug,name,marke&slug=eq." + encodeURIComponent(slug), false) || [];
      if(r[0]) this.setzen(r[0].marke, r[0].name);
    }catch(e){ /* ohne Marke weiter */ }
  }
};

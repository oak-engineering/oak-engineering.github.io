/* OAK Kundenportal – Marke je Kunde (Farben + Logo aus portal_kunde.marke), EINE Stelle fuer alle Seiten.
   Wird im <head> geladen: die zuletzt gesehene Marke liegt im Browser (localStorage) und wird sofort
   gesetzt, bevor etwas gezeichnet wird – kein gruenes Aufblitzen mehr beim Start (Nikolai, 16.09.2026).
   Danach bestaetigt die Seite die Marke aus der Datenbank (setzen) und legt sie wieder ab.
   Ohne Marke bleibt alles OAK-gruen. */
"use strict";
window.OAK_MARKE = {
  aktuell: null,
  SCHLUESSEL: "oak_portal_marke",
  /* <style>-Block fuer eingebettete Dokumente (Shells laufen in einer eigenen Origin, erben die :root-Variablen nicht) */
  styleBlock(){
    const m = this.aktuell || {}; if(!m.farbe) return "";
    return '<style id="marke-kunde">:root{--gruen:' + m.farbe + ';--dunkel:' + (m.farbe_tief || m.farbe) + ';--hell:' + (m.farbe_hell || m.farbe) + ';--akzent:' + (m.akzent || '#eef2f8') + ';--primary:' + m.farbe + '}</style>';
  },
  farben(m){
    const st = document.documentElement.style;
    const setz = (k, v) => { if(v) st.setProperty(k, v); else st.removeProperty(k); };
    setz("--gruen", m.farbe);          setz("--oak", m.farbe);
    setz("--dunkel", m.farbe_tief);    setz("--oak-deep", m.farbe_tief);
    setz("--hellgruen", m.farbe_hell); setz("--oak-light", m.farbe_hell); setz("--oak-mid", m.farbe_hell);
    setz("--akzent", m.akzent);        setz("--oak-pale", m.akzent);
    setz("--oak-ghost", m.hintergrund);
    document.documentElement.classList.toggle("marke-kunde", !!m.farbe);
    const meta = document.querySelector('meta[name="theme-color"]'); if(meta) meta.setAttribute("content", m.farbe || "#2D6A4F");
  },
  logo(){
    const m = this.aktuell || {};
    document.querySelectorAll("#kundeLogo, img[data-kundenlogo]").forEach(img => {
      if(m.logo){ img.src = m.logo; img.alt = m.name || ""; img.hidden = false; } else { img.hidden = true; img.removeAttribute("src"); }
    });
  },
  /* Nur saubere Werte durchlassen: Farben als #hex, Logo als Pfad unter marken/ oder https-Adresse.
     Die Werte landen in CSS und im <style>-Block der Dokumentansicht – nichts anderes darf dort hinein. */
  pruefen(m){
    const farbe = v => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v)) ? v : undefined;
    const logo = v => (typeof v === "string" && /^(marken\/[\w.-]+|https:\/\/[\w.\/%-]+)$/.test(v)) ? v : undefined;
    return { farbe: farbe(m.farbe), farbe_tief: farbe(m.farbe_tief), farbe_hell: farbe(m.farbe_hell), akzent: farbe(m.akzent),
             hintergrund: farbe(m.hintergrund), logo: logo(m.logo), name: typeof m.name === "string" ? m.name.slice(0, 120) : undefined };
  },
  setzen(m, name){
    m = Object.assign({}, m || {}); if(name) m.name = name;
    m = this.pruefen(m);
    this.aktuell = m;
    this.farben(m);
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => this.logo(), { once: true }); else this.logo();
    try{ if(m.farbe) localStorage.setItem(this.SCHLUESSEL, JSON.stringify(m)); else localStorage.removeItem(this.SCHLUESSEL); }catch(e){}
  },
  ausCache(){
    try{
      const roh = JSON.parse(localStorage.getItem(this.SCHLUESSEL) || "null");
      const m = roh ? this.pruefen(roh) : null;
      if(m && m.farbe){ this.aktuell = m; this.farben(m);
        if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => this.logo(), { once: true }); else this.logo(); }
    }catch(e){}
  },
  async anwenden(slug){
    if(!slug || typeof apiGet !== "function") return;
    try{
      const r = await apiGet("/rest/v1/portal_kunde?select=slug,name,marke&slug=eq." + encodeURIComponent(slug), false) || [];
      if(r[0]) this.setzen(r[0].marke, r[0].name);
    }catch(e){ /* ohne Marke weiter */ }
  }
};
OAK_MARKE.ausCache();

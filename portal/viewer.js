/* OAK Kundenportal — Viewer. Lädt nach Login die Template-Shell + die doc-data (privater
   Storage, RLS) und rendert das Dokument in einem iframe (srcdoc). Nutzt auth.js. */
"use strict";
const TYPEN = { bda:"Gefährdungsbeurteilung (GBU)", ba:"Betriebsanweisung",
  maengelliste:"Mängelliste", protokoll:"Begehungsprotokoll" };

function param(n){ return new URLSearchParams(location.search).get(n) || ""; }
function fehler(msg){ document.getElementById("ladehinweis").textContent = msg; }

function injiziere(shellHtml, docdataText){
  // Ersetzt den Inhalt von <script id="doc-data" ...>…</script> durch die echten Kundendaten.
  return shellHtml.replace(/(<script id="doc-data"[^>]*>)[\s\S]*?(<\/script>)/,
    (m, a, b) => a + docdataText + b);
}

document.addEventListener("DOMContentLoaded", async () => {
  const t = await token();
  if(!t){ location.replace("index.html"); return; }

  const typ = param("typ"), p = param("p"), maschine = param("m");
  if(!TYPEN[typ] || !p){ fehler("Ungültiger Dokument-Link."); return; }
  document.getElementById("vTyp").textContent = TYPEN[typ];
  document.getElementById("vTitel").textContent = (maschine || "Dokument") + (param("mid") ? " · " + param("mid") : "");
  document.title = "OAK Portal — " + TYPEN[typ] + " " + maschine;

  try{
    const [shell, docdata] = await Promise.all([
      fetch("shells/" + typ + ".html").then(r => { if(!r.ok) throw new Error("Vorlage fehlt"); return r.text(); }),
      apiGet(storagePfad(p), true),
    ]);
    const html = injiziere(shell, docdata);
    const frame = document.getElementById("rahmen");
    frame.srcdoc = html;
    frame.classList.remove("hidden");
    document.getElementById("ladehinweis").classList.add("hidden");
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    fehler("Dokument konnte nicht geladen werden: " + e.message);
  }
});

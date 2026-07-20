/* OAK Kundenportal — Viewer. Rendert nach Login je Format: GBU/BA/Mängel/Protokoll (Template-Shell +
   doc-data aus Storage), freies HTML (srcdoc) oder PDF (Blob). Nutzt auth.js. */
"use strict";
const SHELL_TYPEN = { bda:"Gefährdungsbeurteilung (GBU)", ba:"Betriebsanweisung",
  maengelliste:"Mängelliste", protokoll:"Begehungsprotokoll" };
const FMT_LABEL = { html:"Dokument", pdf:"PDF" };

function param(n){ return new URLSearchParams(location.search).get(n) || ""; }
function fehler(msg){ const l=document.getElementById("ladehinweis"); l.classList.remove("hidden"); l.textContent = msg; }

function injiziere(shellHtml, docdataText){
  return shellHtml.replace(/(<script id="doc-data"[^>]*>)[\s\S]*?(<\/script>)/, (m,a,b)=> a + docdataText + b);
}

document.addEventListener("DOMContentLoaded", async () => {
  const t = await token();
  if(!t){ location.replace("index.html"); return; }

  const typ = param("typ"), p = param("p");
  const titel = param("t") || (param("m") + (param("mid") ? " · " + param("mid") : ""));
  const istShell = !!SHELL_TYPEN[typ];
  const label = SHELL_TYPEN[typ] || FMT_LABEL[typ] || "Dokument";
  document.getElementById("vTyp").textContent = label;
  document.getElementById("vTitel").textContent = titel || "Dokument";
  document.title = "OAK Portal — " + label + (titel ? " " + titel : "");

  if(!typ || (istShell ? !p : (typ!=="html" && typ!=="pdf")) || !p){ fehler("Ungültiger Dokument-Link."); return; }
  const frame = document.getElementById("rahmen");

  try{
    if(istShell){
      const [shell, docdata] = await Promise.all([
        fetch("shells/" + typ + ".html").then(r => { if(!r.ok) throw new Error("Vorlage fehlt"); return r.text(); }),
        apiGet(storagePfad(p), true),
      ]);
      frame.srcdoc = injiziere(shell, docdata);
    } else if(typ==="html"){
      frame.srcdoc = await apiGet(storagePfad(p), true);
    } else if(typ==="pdf"){
      const blob = await (await apiFetch(storagePfad(p))).blob();
      frame.removeAttribute("srcdoc");
      frame.src = URL.createObjectURL(blob.type ? blob : new Blob([blob], {type:"application/pdf"}));
    }
    frame.classList.remove("hidden");
    document.getElementById("ladehinweis").classList.add("hidden");
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    fehler("Dokument konnte nicht geladen werden: " + e.message);
  }
});

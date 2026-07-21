/* OAK Kundenportal — Viewer. Rendert nach Login je Format: GBU/BA/Mängel/Protokoll (Template-Shell +
   doc-data aus Storage), freies HTML (srcdoc) oder PDF (Blob). Nutzt auth.js. */
"use strict";
const SHELL_TYPEN = { bda:"Gefährdungsbeurteilung (GBU)", ba:"Betriebsanweisung",
  maengelliste:"Mängelliste", protokoll:"Begehungsprotokoll" };
const FMT_LABEL = { html:"Dokument", pdf:"PDF" };

function param(n){ return new URLSearchParams(location.search).get(n) || ""; }
function fehler(msg){ const l=document.getElementById("ladehinweis"); l.classList.remove("hidden"); l.textContent = msg; }

function injiziere(shellHtml, docdataText){
  // "</" -> "<\/": verhindert, dass Inhalte den Script-Block vorzeitig schliessen (XSS-Haertung);
  // JSON.parse liest \/ wieder als / — Inhalt bleibt identisch.
  const safe = docdataText.replace(/<\//g, "<\\/");
  return shellHtml.replace(/(<script id="doc-data"[^>]*>)[\s\S]*?(<\/script>)/, (m,a,b)=> a + safe + b);
}

/* Foto-Lightbox: Klick auf ein Foto im Dokument -> Vollbild (Fotos sind sonst zu klein zum
   Erkennen). Wird in GBU/Mängelliste/Protokoll injiziert — NICHT in die BA (dort sind die
   Piktogramme klick-interaktiv) und nicht in freie HTML-Dokumente (eigene Lightbox/Interaktion). */
const LIGHTBOX =
  '<style>.oaklb{position:fixed;inset:0;background:rgba(10,22,16,.94);z-index:2147483000;'
  + 'display:flex;align-items:center;justify-content:center;cursor:zoom-out}'
  + '.oaklb img{max-width:96vw;max-height:96vh;border-radius:6px;box-shadow:0 12px 48px rgba(0,0,0,.55)}'
  + '.oaklb .oaklb-x{position:fixed;top:12px;right:18px;font:700 30px/1 sans-serif;color:#fff;cursor:pointer}</style>'
  + '<scr'+'ipt>document.addEventListener("click",function(e){'
  + 'var t=e.target;if(!(t&&t.tagName==="IMG"))return;'
  + 'if(t.closest(".oaklb"))return;'
  + 'if(t.closest(".kopf,.oak-marke,.marke,header"))return;'   // Logos nicht zoomen
  + 'var r=t.getBoundingClientRect();if(r.width<80||r.height<60)return;'
  + 'if(t.naturalWidth<300)return;'                             // Piktogramme/Icons ignorieren
  + 'var o=document.createElement("div");o.className="oaklb";'
  + 'var i=document.createElement("img");i.src=t.src;i.alt=t.alt||"";'
  + 'var x=document.createElement("div");x.className="oaklb-x";x.textContent="\\u2715";'
  + 'o.appendChild(i);o.appendChild(x);'
  + 'o.addEventListener("click",function(){o.remove();});'
  + 'document.addEventListener("keydown",function esc(ev){if(ev.key==="Escape"){o.remove();document.removeEventListener("keydown",esc);}});'
  + 'document.body.appendChild(o);e.stopPropagation();},true);</scr'+'ipt>';
const LIGHTBOX_TYPEN = { bda:1, maengelliste:1, protokoll:1 };
function mitLightbox(html, typ){
  if(!LIGHTBOX_TYPEN[typ]) return html;
  return html.includes("</body>") ? html.replace("</body>", LIGHTBOX + "</body>") : html + LIGHTBOX;
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
  // Sandbox: Dokumente laufen in einer eigenen (opaken) Origin — kein Zugriff auf die
  // Portal-Session/localStorage der Seite. PDF ohne Sandbox (Browser-PDF-Viewer braucht das).
  if(typ !== "pdf") frame.setAttribute("sandbox", "allow-scripts allow-modals");

  try{
    if(istShell){
      const [shell, docdata] = await Promise.all([
        fetch("shells/" + typ + ".html").then(r => { if(!r.ok) throw new Error("Vorlage fehlt"); return r.text(); }),
        apiGet(storagePfad(p), true),
      ]);
      frame.srcdoc = mitLightbox(injiziere(shell, docdata), typ);
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

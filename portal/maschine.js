/* OAK Kundenportal — Maschinenseite (Ziel des QR-Codes an der Anlage). Login-geschützt (auth.js).
   Zeigt eine Anlage mit GBU/BA/Mängelliste/Protokoll + QR. RLS liefert nur den eigenen Mandanten. */
"use strict";
function q(n){ return new URLSearchParams(location.search).get(n) || ""; }
/* Risikobereiche wie in der GBU. Die Farbe zeigt die Handlungsdringlichkeit,
   damit sich die Anlagen sortieren lassen - "akut" bleibt der Stilllegung vorbehalten. */
const BAND_LABEL = {akut:"AKUTE GEFAHR (Stilllegung)", gefahr:"Gefahrbereich",
                    besorgnis:"Besorgnisbereich", akzeptanz:"Akzeptanzbereich"};
function ampelKlasse(st){
  if(!st || !st.gesamt) return "grau";
  if((st.offen||0)===0) return "gruen";
  const b = st.band==="hoch" ? "gefahr" : (st.band==="mittel" ? "besorgnis"
          : (st.band==="gering" ? "akzeptanz" : st.band));   // Altbestand mituebersetzen
  if(b==="akut") return "akut";
  if(b==="gefahr") return "rot";
  if(b==="besorgnis") return "orange";
  return "gruen";
}
function ampelTitel(st){
  if(!st || !st.gesamt) return "kein Status";
  const b = st.band==="hoch" ? "gefahr" : (st.band==="mittel" ? "besorgnis"
          : (st.band==="gering" ? "akzeptanz" : st.band));
  return (BAND_LABEL[b]||b||"") + " · Risiko " + (st.maxRisiko||"?")
       + (st.maengelGefahr ? " · " + st.maengelGefahr + " Mangel/Maengel" : "");
}
/* Update-Waechter: meldet neu veroeffentlichte Dokumente, statt still Veraltetes anzuzeigen.
   Bewusst KEIN Auto-Reload - der Nutzer entscheidet, sonst reisst es ihm die Arbeit weg. */
const UPDATE_INTERVALL = 60000;
let katalogSignatur = null, updateTimer = null;

async function katalogSignaturLesen(){
  const r = await apiGet("/rest/v1/portal_dokumente?select=stand&order=stand.desc", false);
  if(!Array.isArray(r)) return null;
  return r.length + "|" + ((r[0] && r[0].stand) || "");   // Anzahl + neuester Stand
}
function updateBannerZeigen(){
  if(document.getElementById("updateBanner")) return;
  const d = document.createElement("div");
  d.id = "updateBanner"; d.className = "update-banner";
  d.innerHTML = '<span>Es gibt aktualisierte Dokumente.</span>'
    + '<button class="btn" id="updateJetzt" type="button">Jetzt aktualisieren</button>'
    + '<button class="btn sek" id="updateSpaeter" type="button">Später</button>';
  document.body.appendChild(d);
  document.getElementById("updateJetzt").addEventListener("click", ()=>{
    if(window.__oakUngespeichert &&
       !confirm("Es gibt ungespeicherte Änderungen. Trotzdem neu laden?")) return;
    location.reload();
  });
  document.getElementById("updateSpaeter").addEventListener("click", ()=>{ d.remove(); });
}
async function updatePruefen(){
  try{
    const sig = await katalogSignaturLesen();
    if(sig && katalogSignatur && sig !== katalogSignatur) updateBannerZeigen();
  }catch(e){ /* ein fehlgeschlagener Poll darf die Ansicht nie stoeren */ }
}
async function updateWaechterStarten(){
  try{ katalogSignatur = await katalogSignaturLesen(); }catch(e){ return; }
  clearInterval(updateTimer);
  updateTimer = setInterval(updatePruefen, UPDATE_INTERVALL);
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) updatePruefen(); });
}

function viewerUrl(typ, path, titel, extra){
  return "viewer.html?typ=" + encodeURIComponent(typ) + "&p=" + encodeURIComponent(path||"")
    + "&t=" + encodeURIComponent(titel||"") + (extra||"");
}
function docBtn(row, typ, label, cls){
  if(!(row.typen||[]).includes(typ)) return "";
  const u = viewerUrl(typ, row.storage_path, (row.maschine||"") + " · " + label,
    "&m=" + encodeURIComponent(row.maschine||"") + "&mid=" + encodeURIComponent(row.maschinen_id||""));
  return `<a class="doc-btn ${cls||""}" href="${u}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const t = await token();
  if(!t){ location.replace("index.html"); return; }          // ohne Login -> Anmeldung
  const slug = q("k"), mid = q("mid");
  const el = document.getElementById("inhalt");
  try{
    const rows = await apiGet("/rest/v1/portal_dokumente?select=*&kategorie=eq.anlagen&kunde_slug=eq."
      + encodeURIComponent(slug) + "&maschinen_id=eq." + encodeURIComponent(mid), false);
    const r = rows && rows[0];
    if(!r){ el.innerHTML = `<div class="leer">Maschine nicht gefunden oder kein Zugriff.</div>`; return; }
    document.getElementById("mTitel").textContent = r.maschine || mid;
    document.getElementById("mSub").textContent = (r.maschinentyp || "") + (r.maschinen_id ? " · " + r.maschinen_id : "");
    el.innerHTML =
      `<div class="m-kopf"><span class="ampel ${ampelKlasse(r.status)}" title="${esc(ampelTitel(r.status))}"></span>
        <div><div class="m-name">${esc(r.maschine||mid)}</div>
        <div class="m-typ">${esc(r.maschinentyp||"")}${r.maschinen_id ? " · " + esc(r.maschinen_id) : ""}</div></div></div>
      <div class="m-docs">
        ${docBtn(r,"bda","Gefährdungsbeurteilung (GBU)","gbu")}
        ${docBtn(r,"ba","Betriebsanweisung (BA)")}
        ${docBtn(r,"maengelliste","Mängelliste")}
        ${docBtn(r,"protokoll","Protokoll")}
      </div>
      ${r.qr_svg ? `<div class="m-qr">${r.qr_svg}<div class="m-qr-cap">QR-Code zu dieser Seite</div>
        <a class="doc-open" href="qr.html?k=${encodeURIComponent(slug)}&mid=${encodeURIComponent(mid)}" target="_blank" rel="noopener">QR drucken</a></div>` : ""}`;
    updateWaechterStarten();
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    el.innerHTML = `<div class="leer">Fehler: ${esc(e.message)}</div>`;
  }
});

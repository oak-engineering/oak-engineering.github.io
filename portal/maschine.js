/* OAK Kundenportal — Maschinenseite (Ziel des QR-Codes an der Anlage). Login-geschützt (auth.js).
   Zeigt eine Anlage mit GBU/BA/Mängelliste/Protokoll + QR. RLS liefert nur den eigenen Mandanten. */
"use strict";
function q(n){ return new URLSearchParams(location.search).get(n) || ""; }
function ampelKlasse(st){
  if(!st || !st.gesamt) return "grau";
  if((st.offen||0)===0) return "gruen";
  if(st.band==="hoch") return "rot";
  return "orange";
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
      `<div class="m-kopf"><span class="ampel ${ampelKlasse(r.status)}" title="${esc((r.status&&r.status.band)||"—")}"></span>
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
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    el.innerHTML = `<div class="leer">Fehler: ${esc(e.message)}</div>`;
  }
});

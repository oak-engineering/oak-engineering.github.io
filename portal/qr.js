/* OAK Kundenportal — QR-Aushang (Druckansicht) je Anlage. Login-geschützt (auth.js).
   Lädt den serverseitig erzeugten QR-SVG (RLS, eigener Mandant) und stellt ihn druckfertig dar. */
"use strict";
function q(n){ return new URLSearchParams(location.search).get(n) || ""; }

document.addEventListener("DOMContentLoaded", async () => {
  const t = await token();
  if(!t){ location.replace("index.html"); return; }
  const slug = q("k"), mid = q("mid");
  try{
    const rows = await apiGet("/rest/v1/portal_dokumente?select=maschine,maschinen_id,maschinentyp,qr_svg,kunde"
      + "&kategorie=eq.anlagen&kunde_slug=eq." + encodeURIComponent(slug) + "&maschinen_id=eq." + encodeURIComponent(mid), false);
    const r = rows && rows[0];
    if(!r || !r.qr_svg){ document.getElementById("blatt").innerHTML = `<div class="leer">Kein QR-Code gefunden.</div>`; return; }
    document.getElementById("qrbox").innerHTML = r.qr_svg;   // server-generiertes SVG (segno), vertrauenswürdig
    document.getElementById("mkunde").textContent = r.kunde || "";
    document.getElementById("mname").textContent = r.maschine || mid;
    document.getElementById("mmeta").textContent = (r.maschinentyp || "") + (r.maschinen_id ? " · " + r.maschinen_id : "");
    document.title = "QR-Aushang — " + (r.maschine || mid);
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    document.getElementById("blatt").innerHTML = `<div class="leer">Fehler: ${esc(e.message)}</div>`;
  }
});

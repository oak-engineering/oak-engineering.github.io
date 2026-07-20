/* OAK Kundenportal — Login + generischer Dokument-Hub (Kategorien). Nutzt auth.js (vorher geladen). */
"use strict";
const $ = s => document.querySelector(s);
function zurLogin(){ $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }
function zurApp(){ $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

const KATS = [
  ["anlagen", "Anlagen &amp; Maschinen"],
  ["begehungen", "Begehungen"],
  ["gefahrstoffe", "Gefahrstoffe"],
  ["unterweisungen", "Unterweisungen"],
  ["sonstige", "Weitere Unterlagen"],
];
const KAT_LABEL = Object.fromEntries(KATS);

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
function machDoc(row, typ, label, extra){
  if(!(row.typen||[]).includes(typ)) return "";
  const u = viewerUrl(typ, row.storage_path, (row.maschine||"") + " · " + label,
    "&m=" + encodeURIComponent(row.maschine||"") + "&mid=" + encodeURIComponent(row.maschinen_id||""));
  return `<a class="${extra||""}" href="${u}" target="_blank" rel="noopener">${label}</a>`;
}

let ALLE = [];
function anlagen(){ return ALLE.filter(r => r.kategorie==="anlagen"); }

function renderAnlagen(){
  const tb = $("#anlagen-liste"); if(!tb) return;
  const q = ($("#suche")?.value||"").toLowerCase().trim();
  const tf = $("#typFilter")?.value||"";
  const rows = anlagen().filter(r => (!tf || r.maschinentyp===tf) &&
    (!q || (r.maschine||"").toLowerCase().includes(q) || (r.maschinen_id||"").toLowerCase().includes(q)));
  tb.innerHTML = rows.length ? rows.map(r => `<tr>
      <td><span class="ampel ${ampelKlasse(r.status)}" title="${esc((r.status&&r.status.band)||"—")}"></span></td>
      <td>${esc(r.maschine)}</td><td>${esc(r.maschinentyp||"–")}</td><td>${esc(r.maschinen_id)}</td>
      <td class="docs">${machDoc(r,"bda","GBU","gbu")}${machDoc(r,"ba","BA")}${machDoc(r,"maengelliste","Mängel")}${machDoc(r,"protokoll","Protokoll")}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="leer">keine Anlagen</td></tr>`;
  const z=$("#anlagenZaehler"); if(z) z.textContent = rows.length + " von " + anlagen().length + " Anlagen";
}

function docZeile(r){
  const oeffnen = (r.doc_typ==="link" && r.url)
    ? `<a class="doc-open" href="${esc(r.url)}" target="_blank" rel="noopener">Öffnen ↗</a>`
    : `<a class="doc-open" href="${viewerUrl(r.doc_typ, r.storage_path, r.titel)}" target="_blank" rel="noopener">Öffnen</a>`;
  const fmt = {html:"Dokument", pdf:"PDF", link:"Extern"}[r.doc_typ] || "Dokument";
  return `<tr><td>${esc(r.titel||"Dokument")}</td><td class="tspalte">${fmt}</td>`
    + `<td class="tspalte">${r.stand?esc(r.stand):"—"}</td><td class="doc-td">${oeffnen}</td></tr>`;
}

function renderSektionen(){
  const wrap = $("#sektionen"); wrap.innerHTML = "";
  for(const [kat, label] of KATS){
    const rows = ALLE.filter(r => r.kategorie===kat);
    if(!rows.length) continue;
    const sec = document.createElement("section"); sec.className = "sektion";
    if(kat==="anlagen"){
      const typen = [...new Set(anlagen().map(r=>r.maschinentyp).filter(Boolean))].sort();
      sec.innerHTML = `<div class="sek-kopf"><h2>${label}</h2><span class="zaehler" id="anlagenZaehler"></span></div>
        <div class="toolbar">
          <input type="search" id="suche" placeholder="Maschine suchen …">
          <select id="typFilter"><option value="">Alle Maschinentypen</option>${typen.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
        </div>
        <table><thead><tr><th style="width:52px">Status</th><th>Maschine</th><th>Maschinentyp</th><th style="width:70px">Nr.</th><th style="width:270px">Dokumente</th></tr></thead>
        <tbody id="anlagen-liste"></tbody></table>`;
    } else {
      sec.innerHTML = `<div class="sek-kopf"><h2>${label}</h2><span class="zaehler">${rows.length} ${rows.length===1?"Dokument":"Dokumente"}</span></div>
        <table><thead><tr><th>Dokument</th><th style="width:130px">Art</th><th style="width:120px">Stand</th><th style="width:120px"></th></tr></thead>
        <tbody>${rows.map(docZeile).join("")}</tbody></table>`;
    }
    wrap.appendChild(sec);
  }
  if(!wrap.children.length) wrap.innerHTML = `<div class="leer">Für Sie sind derzeit keine Unterlagen hinterlegt.</div>`;
  const s=$("#suche"); if(s){ s.addEventListener("input", renderAnlagen); $("#typFilter").addEventListener("change", renderAnlagen); }
  renderAnlagen();
}

async function ladePortal(){
  const s = getSession();
  $("#userMail").textContent = (s && s.user && s.user.email) || "";
  try{
    const rows = await apiGet("/rest/v1/portal_dokumente?select=*&order=kategorie.asc,sortierung.asc,maschine.asc,titel.asc", false);
    ALLE = rows || [];
    if(ALLE.length) $("#kundeName").textContent = ALLE[0].kunde || "";
    renderSektionen();
  }catch(e){
    if(e.message==="AUTH"){ zurLogin(); return; }
    $("#sektionen").innerHTML = `<div class="leer">Fehler: ${esc(e.message)}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#loginForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn=$("#loginBtn"); btn.disabled=true; $("#loginFehler").textContent="";
    try{ await login($("#email").value.trim(), $("#pass").value); $("#pass").value="";
      zurApp(); await ladePortal(); }
    catch(e){ $("#loginFehler").textContent = /Invalid login|invalid_grant/i.test(e.message) ? "E-Mail oder Passwort falsch." : e.message; }
    finally{ btn.disabled=false; }
  });
  $("#logoutBtn").addEventListener("click", ()=>{ clearSession(); ALLE=[]; zurLogin(); });

  const t = await token();
  if(t){ zurApp(); await ladePortal(); } else { zurLogin(); }
});

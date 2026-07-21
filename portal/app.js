/* OAK Kundenportal — Login + generischer Dokument-Hub (Kategorien). Nutzt auth.js (vorher geladen). */
"use strict";
const $ = s => document.querySelector(s);
function zurLogin(){ $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }
function zurApp(){ $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

const KATS = [
  ["anlagen", "Anlagen &amp; Maschinen"],
  ["begehungen", "Begehungen"],
  ["gefahrstoffe", "Gefahrstoffe"],
  ["umwelt", "Umwelt &amp; Immissionsschutz"],
  ["unterweisungen", "Unterweisungen"],
  ["sonstige", "Weitere Unterlagen"],
];
const KAT_LABEL = Object.fromEntries(KATS);

/* Oberkategorien (Header-Tabs): fassen die feinen `kategorie`-Werte zu Domänen zusammen.
   Innerhalb einer Multi-kat-Domäne werden die Kategorien als Zwischenüberschriften gezeigt. */
const DOMAENEN = [
  { key: "arbeitssicherheit", label: "Arbeitssicherheit", kats: ["anlagen", "begehungen", "unterweisungen"] },
  { key: "gefahrstoffe",      label: "Gefahrstoffe",       kats: ["gefahrstoffe"] },
  { key: "umwelt",            label: "Umwelt &amp; Immissionsschutz", kats: ["umwelt"] },
  { key: "weitere",           label: "Weitere Unterlagen", kats: ["sonstige"] },
];

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

let ALLE = [], ADMIN = false, AKTIV = null;
/* Admin sieht alle Mandanten -> AKTIV filtert auf den gewaehlten Kunden.
   Normale Kunden: AKTIV bleibt null, RLS liefert ohnehin nur den eigenen Mandanten. */
function sichtbar(){ return AKTIV ? ALLE.filter(r => r.kunde_slug===AKTIV) : ALLE; }
function anlagen(){ return sichtbar().filter(r => r.kategorie==="anlagen"); }

function setKundeName(){
  const r = AKTIV ? ALLE.find(x => x.kunde_slug===AKTIV) : ALLE[0];
  $("#kundeName").textContent = (r && r.kunde) || "";
}
function renderAdminBar(){
  const bar = $("#adminBar");
  if(!ADMIN){ bar.classList.add("hidden"); bar.innerHTML = ""; return; }  // keine Admin-Reste nach Rollenwechsel
  const kunden = [...new Map(ALLE.map(r => [r.kunde_slug, r.kunde || r.kunde_slug])).entries()]
    .sort((a,b) => String(a[1]).localeCompare(String(b[1])));
  bar.classList.remove("hidden");
  bar.innerHTML = `<span class="admin-tag">Admin</span> <label for="kundeWahl">Kundenportal:</label>
    <select id="kundeWahl">${kunden.map(([slug,name]) =>
      `<option value="${esc(slug)}"${slug===AKTIV?" selected":""}>${esc(name)}</option>`).join("")}</select>
    <span class="admin-hint">Sie sehen die Ansicht dieses Kunden.</span>`;
  $("#kundeWahl").addEventListener("change", e => { AKTIV = e.target.value; AKTIVE_DOM = null; setKundeName(); renderTabs(); renderSektionen(); });
}

function renderAnlagen(){
  const tb = $("#anlagen-liste"); if(!tb) return;
  const q = ($("#suche")?.value||"").toLowerCase().trim();
  const tf = $("#typFilter")?.value||"";
  const rows = anlagen().filter(r => (!tf || r.maschinentyp===tf) &&
    (!q || (r.maschine||"").toLowerCase().includes(q) || (r.maschinen_id||"").toLowerCase().includes(q)));
  tb.innerHTML = rows.length ? rows.map(r => `<tr>
      <td><span class="ampel ${ampelKlasse(r.status)}" title="${esc((r.status&&r.status.band)||"—")}"></span></td>
      <td>${esc(r.maschine)}</td><td>${esc(r.maschinentyp||"–")}</td>
      <td class="docs">${machDoc(r,"bda","GBU","gbu")}${machDoc(r,"ba","BA")}${machDoc(r,"maengelliste","Mängel")}${machDoc(r,"protokoll","Protokoll")}</td>
    </tr>`).join("") : `<tr><td colspan="4" class="leer">keine Anlagen</td></tr>`;
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

let AKTIVE_DOM = null;
function katRows(kat){ return sichtbar().filter(r => r.kategorie===kat); }
/* Sichtbare Domänen: Kunde nur mit Inhalt, Admin alle. */
function verfuegbareDomaenen(){ return DOMAENEN.filter(d => ADMIN || d.kats.some(k => katRows(k).length)); }
function domCount(d){ return d.kats.reduce((n,k)=> n + katRows(k).length, 0); }

/* Eine feine Kategorie als Sektion rendern. zeigeHeading=false: ohne Zwischenüberschrift
   (Single-kat-Domänen; der Tab benennt sie bereits). */
function renderSektion(wrap, kat, label, zeigeHeading){
  const rows = katRows(kat);
  if(!rows.length){
    if(!ADMIN) return;                          // Kunden sehen leere Kategorien nicht
    const leer = document.createElement("section"); leer.className = "sektion";
    leer.innerHTML = `<div class="sek-kopf"><h2>${label}</h2>`
      + `<span class="zaehler" style="color:#9a7b1a;background:#fff4e0;border-radius:6px;padding:2px 8px">nur für Admin sichtbar</span></div>`
      + `<div class="leer" style="padding:14px 4px">Noch keine Unterlagen. Hier erscheinen die von dir hochgeladenen `
      + `<b>${label}</b>-Dokumente (Upload via <code>portal_publish.py</code> bzw. <code>portal_extra.json</code>, Kategorie <code>${esc(kat)}</code>).</div>`;
    wrap.appendChild(leer); return;
  }
  const sec = document.createElement("section"); sec.className = "sektion";
  if(kat==="anlagen"){
    const typen = [...new Set(anlagen().map(r=>r.maschinentyp).filter(Boolean))].sort();
    sec.innerHTML = `<div class="sek-kopf"><h2>${label}</h2><span class="zaehler" id="anlagenZaehler"></span></div>
      <div class="toolbar">
        <input type="search" id="suche" placeholder="Maschine suchen …">
        <select id="typFilter"><option value="">Alle Maschinentypen</option>${typen.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
      </div>
      <table><thead><tr><th style="width:52px">Status</th><th>Maschine</th><th>Maschinentyp</th><th style="width:270px">Dokumente</th></tr></thead>
      <tbody id="anlagen-liste"></tbody></table>`;
  } else {
    const kopf = zeigeHeading
      ? `<div class="sek-kopf"><h2>${label}</h2><span class="zaehler">${rows.length} ${rows.length===1?"Dokument":"Dokumente"}</span></div>`
      : "";
    sec.innerHTML = kopf
      + `<table><thead><tr><th>Dokument</th><th style="width:130px">Art</th><th style="width:120px">Stand</th><th style="width:120px"></th></tr></thead>
      <tbody>${rows.map(docZeile).join("")}</tbody></table>`;
  }
  wrap.appendChild(sec);
}

/* Header-Tabs (Oberkategorien) */
function renderTabs(){
  const nav = $("#katTabs"); if(!nav) return;
  const doms = verfuegbareDomaenen();
  if(!doms.length){ nav.classList.add("hidden"); nav.innerHTML = ""; return; }
  if(!AKTIVE_DOM || !doms.some(d => d.key===AKTIVE_DOM)) AKTIVE_DOM = doms[0].key;
  nav.classList.remove("hidden");
  nav.innerHTML = doms.map(d => {
    const n = domCount(d);
    return `<button type="button" class="kat-tab${d.key===AKTIVE_DOM?" aktiv":""}" data-dom="${esc(d.key)}"`
      + ` role="tab" aria-selected="${d.key===AKTIVE_DOM}">${d.label}${n?` <span class="tab-n">${n}</span>`:""}</button>`;
  }).join("");
  nav.querySelectorAll(".kat-tab").forEach(b => b.addEventListener("click", () => {
    AKTIVE_DOM = b.dataset.dom; renderTabs(); renderSektionen();
  }));
}

function renderSektionen(){
  const wrap = $("#sektionen"); wrap.innerHTML = "";
  const doms = verfuegbareDomaenen();
  if(!doms.length){ wrap.innerHTML = `<div class="leer">Für Sie sind derzeit keine Unterlagen hinterlegt.</div>`; return; }
  const dom = doms.find(d => d.key===AKTIVE_DOM) || doms[0];
  const einzel = dom.kats.length===1;           // keine redundante Zwischenüberschrift bei Single-kat-Domäne
  for(const kat of dom.kats) renderSektion(wrap, kat, KAT_LABEL[kat], !einzel);
  const s=$("#suche"); if(s){ s.addEventListener("input", renderAnlagen); $("#typFilter").addEventListener("change", renderAnlagen); }
  renderAnlagen();
}

async function ladePortal(){
  const s = getSession();
  $("#userMail").textContent = (s && s.user && s.user.email) || "";
  try{
    let me = [];
    if(s && s.user && s.user.id)
      me = await apiGet("/rest/v1/portal_mitglied?select=rolle,kunde,kunde_slug&user_id=eq."
        + encodeURIComponent(s.user.id), false);
    ADMIN = !!(me && me[0] && me[0].rolle === "admin");

    const rows = await apiGet("/rest/v1/portal_dokumente?select=*&order=kategorie.asc,sortierung.asc,maschine.asc,titel.asc", false);
    ALLE = rows || [];
    AKTIV = ADMIN ? ([...new Set(ALLE.map(r => r.kunde_slug))][0] || null) : null;
    AKTIVE_DOM = null;
    setKundeName();
    renderAdminBar();
    renderTabs();
    renderSektionen();
  }catch(e){
    if(e.message==="AUTH"){ zurLogin(); return; }
    const nav=$("#katTabs"); if(nav){ nav.classList.add("hidden"); nav.innerHTML=""; }
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

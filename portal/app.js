/* OAK Kundenportal — Login + generischer Dokument-Hub (Kategorien). Nutzt auth.js (vorher geladen). */
"use strict";
const $ = s => document.querySelector(s);
function zurLogin(){ $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }
function zurApp(){ $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

/* Zwei-Ebenen-Navigation: Domänen-Tabs (oben) → Sub-Reiter (feine `kategorie`-Werte).
   Der Sub `anlagen` ist speziell (Maschinen-Tabelle mit Ampel/Suche/Doc-Buttons), alle
   anderen sind einfache Dokumentlisten. `unterweisungen` gibt es je Domäne getrennt. */
const DOMAENEN = [
  { key: "arbeitssicherheit", label: "Arbeitssicherheit", subs: [
      { kat: "hallenplan",    label: "Hallenplan" },
      { kat: "anlagen",       label: "Anlagen &amp; Maschinensicherheit" },
      { kat: "allg-gbu",      label: "Allgemeine GBU" },
      { kat: "gefahrstoffe",  label: "Gefahrstoffe" },
      { kat: "begehungen",    label: "Begehungen" },
      { kat: "unterweisungen", label: "Unterweisungen" },
  ]},
  { key: "umwelt", label: "Umwelt", subs: [
      { kat: "umwelt-immissionsschutz", label: "Immissionsschutz" },
      { kat: "umwelt-gewaesserschutz",  label: "Gewässerschutz" },
      { kat: "umwelt-awsv",             label: "AwSV" },
      { kat: "umwelt-unterweisungen",   label: "Unterweisungen" },
  ]},
  /* Vorfälle sind KEINE Dokumente: eigene Tabelle (portal_vorfaelle), eigene Darstellung
     in vorfaelle.js. Sie stehen bewusst als eigene Domäne neben Arbeitssicherheit und Umwelt,
     weil eine Meldung beides betreffen kann (z. B. Ölaustritt). */
  { key: "vorfaelle", label: "Vorfälle", subs: [
      { kat: "vorfaelle", label: "Unfälle &amp; Beinahe-Unfälle" },
  ]},
  { key: "weitere", label: "Weitere Unterlagen", subs: [
      { kat: "sonstige", label: "Weitere Unterlagen" },
  ]},
];
// Label je feiner Kategorie (für Sektions-Überschriften/Fallback).
const KAT_LABEL = Object.fromEntries(DOMAENEN.flatMap(d => d.subs.map(s => [s.kat, s.label])));

/* Risikobereiche wie in der GBU. Die Farbe zeigt die Handlungsdringlichkeit,
   damit sich die Anlagen sortieren lassen - "akut" bleibt der Stilllegung vorbehalten. */
/* Altbestand mituebersetzen: vor dem Umstieg standen in der Spalte teils die
   Bandnamen (hoch/mittel/gering), teils die CSS-Klassen (r/g/gn). Unbekanntes
   wird bewusst NICHT gruen - lieber zu streng als ein verharmlostes Risiko. */
const BAND_ALT = {hoch:"gefahr", mittel:"besorgnis", gering:"akzeptanz",
                  r:"gefahr", g:"besorgnis", gn:"akzeptanz"};
const BAND_LABEL = {akut:"AKUTE GEFAHR (Stilllegung)", gefahr:"Gefahrbereich",
                    besorgnis:"Besorgnisbereich", akzeptanz:"Akzeptanzbereich"};
function ampelKlasse(st){
  if(!st || !st.gesamt) return "grau";
  if((st.offen||0)===0) return "gruen";
  const b = BAND_ALT[st.band] || st.band;
  if(b==="akut") return "akut";
  if(b==="gefahr") return "rot";
  if(b==="besorgnis") return "orange";
  if(b==="akzeptanz") return "gruen";
  return "orange";            // unbekanntes Band: sichtbar lassen, nicht gruen faerben
}
function ampelTitel(st){
  if(!st || !st.gesamt) return "kein Status";
  const b = BAND_ALT[st.band] || st.band;
  return (BAND_LABEL[b]||b||"") + " · Risiko " + (st.maxRisiko||"?")
       + (st.maengelGefahr ? " · " + st.maengelGefahr + " Mangel/Maengel" : "");
}
/* Status -> Filtergruppe (fuer den Status-Filter der Anlagen-Uebersicht). */
function statusGruppe(st){
  const k = ampelKlasse(st);
  if(k==="rot"||k==="akut") return "gefahr";
  if(k==="orange") return "besorgnis";
  if(k==="gruen") return "akzeptanz";
  return "ohne";
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
/* URL der Maschinenseite (Ziel des QR-Codes) und QR-Druck-Button je Anlage. */
function maschineUrl(slug, mid){ return "maschine.html?k=" + encodeURIComponent(slug||"") + "&mid=" + encodeURIComponent(mid||""); }
function qrLink(row){
  if(!row.maschinen_id) return "";
  return `<a class="qr-btn" href="qr.html?k=${encodeURIComponent(row.kunde_slug||"")}&mid=${encodeURIComponent(row.maschinen_id)}"`
    + ` target="_blank" rel="noopener" title="QR-Code zur Maschinenseite (drucken)">QR</a>`;
}

/* Update-Waechter: meldet neu veroeffentlichte Dokumente, statt still Veraltetes anzuzeigen.
   Bewusst KEIN Auto-Reload - der Nutzer entscheidet, sonst reisst es ihm die Arbeit weg. */
const UPDATE_INTERVALL = 60000;
let katalogSignatur = null, updateTimer = null;

async function katalogSignaturLesen(){
  // updated_at (Default now()) aendert sich bei jedem Publish - der Katalog wird
  // neu eingefuegt. "stand" taugt nicht: es ist das Dokumentdatum und oft NULL.
  const r = await apiGet("/rest/v1/portal_dokumente?select=updated_at&order=updated_at.desc", false);
  if(!Array.isArray(r)) return null;
  return r.length + "|" + ((r[0] && r[0].updated_at) || "");
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

let ALLE = [], ADMIN = false, AKTIV = null;
/* Admin sieht alle Mandanten -> AKTIV filtert auf den gewaehlten Kunden.
   Normale Kunden: AKTIV bleibt null, RLS liefert ohnehin nur den eigenen Mandanten. */
function sichtbar(){ return AKTIV ? ALLE.filter(r => r.kunde_slug===AKTIV) : ALLE; }
/* Anlagen UND allgemeine GBU laufen ueber dieselbe Tabelle. Grund (Nikolai 06.08.2026):
   Eine allgemeine GBU ist derselbe Dokumentensatz wie bei einer Maschine (GBU · BA · Mängel ·
   Protokoll) und braucht denselben Freigabe-Haken. Vorher fiel `allg-gbu` in die einfache
   Dokumentliste - dort gab es weder Doc-Buttons noch Freigabe, und jeder Dokumenttyp stand
   als eigene Zeile. */
const TABELLEN_KATEGORIEN = ["anlagen", "allg-gbu"];
/* Die Tabelle zeigt immer NUR die gerade geoeffnete Kategorie - sonst staenden die allgemeinen
   GBU zusaetzlich unter "Anlagen". */
function tabellenKat(){ return TABELLEN_KATEGORIEN.includes(AKTIVE_SUB) ? AKTIVE_SUB : "anlagen"; }
function anlagen(){ return sichtbar().filter(r => r.kategorie === tabellenKat()); }

/* SiFa-Freigabe + „neu"-Badge (Statusanzeigen der Anlagen-Uebersicht). FREIGABE aus der Tabelle
   portal_freigabe (ueberlebt den Katalog-Neuaufbau), keyed kunde_slug|maschinen_id. */
let FREIGABE = {}, ADMIN_NAME = "";
function fgKey(r){ return (r.kunde_slug||"") + "|" + (r.maschinen_id||""); }
function statusBadge(r, neuestesDatum){
  const fg = FREIGABE[fgKey(r)];
  if(fg){
    const dt = (fg.freigegeben_am||"").slice(0,10).split("-").reverse().join(".");
    return `<span style="display:inline-block;margin-left:7px;padding:1px 7px;border-radius:10px;font-size:11px;`
      + `font-weight:600;background:#d8f3dc;color:#1b4332;border:1px solid #52b788" `
      + `title="Freigegeben durch die Sicherheitsfachkraft${fg.freigegeben_von?' ('+esc(fg.freigegeben_von)+')':''}">✓ freigegeben · ${dt}</span>`;
  }
  if(r.stand && r.stand===neuestesDatum){
    return `<span style="display:inline-block;margin-left:7px;padding:1px 7px;border-radius:10px;font-size:11px;`
      + `font-weight:700;background:#2d6a4f;color:#fff" title="Neu aus der letzten Begehung">neu</span>`;
  }
  return "";
}

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
  $("#kundeWahl").addEventListener("change", e => { AKTIV = e.target.value; AKTIVE_DOM = null; AKTIVE_SUB = null; setKundeName(); renderTabs(); renderSubTabs(); renderSektionen(); });
}

/* Klick-Sortierung: Standard nach Priorität (rote oben). Klick auf einen Spaltenkopf setzt/dreht die
   Sortierung (wie in Excel), Pfeil zeigt Richtung. */
let ANL_SORT = { key:"status", dir:"asc" };
function cmpAnlagen(a,b){
  const s = ANL_SORT.dir==="desc" ? -1 : 1, key = ANL_SORT.key;
  if(key==="status"){
    const PRIO = {akut:0, rot:1, orange:2, gruen:3, grau:4};
    const pa=(PRIO[ampelKlasse(a.status)]==null?9:PRIO[ampelKlasse(a.status)]);
    const pb=(PRIO[ampelKlasse(b.status)]==null?9:PRIO[ampelKlasse(b.status)]);
    if(pa!==pb) return (pa-pb)*s;
    return (((b.status&&b.status.maxRisiko)||0) - ((a.status&&a.status.maxRisiko)||0))*s;
  }
  if(key==="stand") return String(a.stand||"").localeCompare(String(b.stand||""))*s;
  const va = key==="maschinentyp" ? (a.maschinentyp||"") : (a.maschine||"");
  const vb = key==="maschinentyp" ? (b.maschinentyp||"") : (b.maschine||"");
  return va.localeCompare(vb,"de",{numeric:true})*s;
}
function thSort(key,label,width){
  const aktiv = ANL_SORT.key===key;
  const pfeil = aktiv ? (ANL_SORT.dir==="desc" ? " ▼" : " ▲") : " ↕";
  return `<th class="th-sort${aktiv?" aktiv":""}" data-sort="${key}"`
    + ` style="cursor:pointer;user-select:none${width?";width:"+width:""}" title="Sortieren (klicken)">`
    + `${label}<span class="sort-pfeil" style="opacity:.55;font-size:11px">${pfeil}</span></th>`;
}
function renderAnlagen(){
  const tab = $("#anlagen-tabelle"); if(!tab) return;
  const q = ($("#suche")?.value||"").toLowerCase().trim();
  const tf = $("#typFilter")?.value||"";
  const df = $("#datumFilter")?.value||"";
  const sf = $("#statusFilter")?.value||"";
  const neuestesDatum = anlagen().map(r=>r.stand).filter(Boolean).sort().slice(-1)[0] || "";
  const rows = anlagen().filter(r => (!tf || r.maschinentyp===tf) && (!df || r.stand===df)
    && (!sf || statusGruppe(r.status)===sf)
    && (!q || (r.maschine||"").toLowerCase().includes(q) || (r.maschinen_id||"").toLowerCase().includes(q)))
    .slice().sort(cmpAnlagen);
  const istAllg = tabellenKat()==="allg-gbu";
  const kopf = `<thead><tr>${thSort("status","Status","78px")}${thSort("maschine", istAllg?"Thema":"Maschine")}`
    + `${thSort("maschinentyp", istAllg?"Art":"Maschinentyp")}${thSort("stand","Begehung","112px")}`
    + `<th style="width:330px">Dokumente</th>`
    + (ADMIN ? `<th style="width:78px;text-align:center" title="Freigabe durch die Sicherheitsfachkraft (Dokumente final geprüft & gültig)">Freigabe</th>` : "")
    + `</tr></thead>`;
  const koerper = `<tbody>${rows.length ? rows.map(r => {
      const fgCell = ADMIN ? `<td class="fg-zelle"><input type="checkbox" class="fg-check" `
        + `data-mid="${esc(r.maschinen_id||"")}" data-slug="${esc(r.kunde_slug||"")}"${FREIGABE[fgKey(r)]?" checked":""} `
        + `title="Freigabe durch die Sicherheitsfachkraft"></td>` : "";
      return `<tr>
      <td><span class="ampel ${ampelKlasse(r.status)}" title="${esc(ampelTitel(r.status))}"></span></td>
      <td>${esc(r.maschine)}${statusBadge(r, neuestesDatum)}</td><td>${esc(r.maschinentyp||"–")}</td><td>${esc(r.stand||"–")}</td>
      <td class="docs">${machDoc(r,"bda","GBU","gbu")}${machDoc(r,"ba","BA")}${machDoc(r,"maengelliste","Mängel")}${machDoc(r,"protokoll","Protokoll")}${qrLink(r)}</td>${fgCell}
    </tr>`; }).join("") : `<tr><td colspan="${ADMIN?6:5}" class="leer">keine Anlagen</td></tr>`}</tbody>`;
  tab.innerHTML = kopf + koerper;
  const z=$("#anlagenZaehler"); if(z) z.textContent = rows.length + " von " + anlagen().length + (istAllg ? " GBU" : " Anlagen");
}

function docZeile(r){
  const oeffnen = (r.doc_typ==="link" && r.url)
    ? `<a class="doc-open" href="${esc(r.url)}" target="_blank" rel="noopener">Öffnen</a>`
    : `<a class="doc-open" href="${viewerUrl(r.doc_typ, r.storage_path, r.titel)}" target="_blank" rel="noopener">Öffnen</a>`;
  const fmt = {html:"Dokument", pdf:"PDF", link:"Online", bda:"GBU", ba:"BA", maengelliste:"Mängelliste", protokoll:"Protokoll"}[r.doc_typ] || "Dokument";
  return `<tr><td>${esc(r.titel||"Dokument")}</td><td class="tspalte">${fmt}</td>`
    + `<td class="tspalte">${r.stand?esc(r.stand):"—"}</td><td class="doc-td">${oeffnen}</td></tr>`;
}

let AKTIVE_DOM = null, AKTIVE_SUB = null;
function katRows(kat){
  if(kat === "vorfaelle") return vSichtbar();      // Zähler/Tab-Logik: Meldungen statt Dokumente
  return sichtbar().filter(r => r.kategorie===kat);
}
/* ALLE Bereiche sind für jeden sichtbar (auch ohne Inhalt) – zeigt das volle OAK-Leistungsspektrum. */
function verfuegbareDomaenen(){ return DOMAENEN; }
function domCount(d){ return d.subs.reduce((n,s)=> n + katRows(s.kat).length, 0); }
function verfuegbareSubs(dom){ return dom ? dom.subs : []; }
function domHatInhalt(d){ return d.subs.some(s => katRows(s.kat).length); }

/* Eine feine Kategorie als Sektion rendern. zeigeHeading=false: ohne Zwischenüberschrift
   (der Sub-Reiter benennt sie schon). Anlagen zeigen ihren Kopf immer (Suche/Zähler). */
function renderSektion(wrap, kat, label, zeigeHeading){
  if(kat === "vorfaelle"){ renderVorfaelle(wrap); return; }   // eigene Datenquelle, s. vorfaelle.js
  const rows = katRows(kat);
  if(!rows.length){
    const leer = document.createElement("section"); leer.className = "sektion";
    leer.innerHTML = `<div class="sek-kopf"><h2>${label}</h2></div>`
      + `<div class="leer">Für diesen Bereich sind derzeit keine Unterlagen hinterlegt.<br>`
      + `<span style="font-style:normal">OAK engineering unterstützt Sie hier auf Wunsch gern.</span></div>`
      + (ADMIN ? `<div class="leer" style="padding:0 4px 12px;font-size:12px;color:#9a7b1a">Admin: Upload via `
          + `<code>portal_publish.py</code> bzw. <code>portal_extra.json</code>, Kategorie <code>${esc(kat)}</code>.</div>` : "");
    wrap.appendChild(leer); return;
  }
  const sec = document.createElement("section"); sec.className = "sektion";
  if(TABELLEN_KATEGORIEN.includes(kat)){
    const typen = [...new Set(anlagen().map(r=>r.maschinentyp).filter(Boolean))].sort();
    const daten = [...new Set(anlagen().map(r=>r.stand).filter(Boolean))].sort().reverse();
    sec.innerHTML = `<div class="sek-kopf"><h2>${label}</h2><span class="zaehler" id="anlagenZaehler"></span></div>
      <div class="toolbar">
        <input type="search" id="suche" placeholder="${kat==="allg-gbu"?"Thema suchen …":"Maschine suchen …"}">
        <select id="typFilter"${typen.length?"":" hidden"}><option value="">Alle Maschinentypen</option>${typen.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
        <select id="datumFilter"><option value="">Alle Begehungen</option>${daten.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join("")}</select>
        <select id="statusFilter"><option value="">Alle Status</option><option value="gefahr">Gefahr</option><option value="besorgnis">Besorgnis</option><option value="akzeptanz">Akzeptanz</option><option value="ohne">ohne Status</option></select>
      </div>
      <div class="tabelle-wrap"><table id="anlagen-tabelle"></table></div>`;
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

/* Ebene 1: Domänen-Tabs */
function renderTabs(){
  const nav = $("#katTabs"); if(!nav) return;
  const doms = verfuegbareDomaenen();
  if(!doms.length){ nav.classList.add("hidden"); nav.innerHTML = ""; return; }
  // Standard-Tab: erste Domäne MIT Inhalt (Kunde landet auf Dokumenten, nicht auf leerem Bereich).
  if(!AKTIVE_DOM || !doms.some(d => d.key===AKTIVE_DOM)) AKTIVE_DOM = (doms.find(domHatInhalt) || doms[0]).key;
  nav.classList.remove("hidden");
  nav.innerHTML = doms.map(d => {
    const n = domCount(d);
    return `<button type="button" class="kat-tab${d.key===AKTIVE_DOM?" aktiv":""}" data-dom="${esc(d.key)}"`
      + ` role="tab" aria-selected="${d.key===AKTIVE_DOM}">${d.label}${n?` <span class="tab-n">${n}</span>`:""}</button>`;
  }).join("");
  nav.querySelectorAll(".kat-tab").forEach(b => b.addEventListener("click", () => {
    AKTIVE_DOM = b.dataset.dom; AKTIVE_SUB = null; renderTabs(); renderSubTabs(); renderSektionen();
  }));
}

/* Ebene 2: Sub-Reiter der aktiven Domäne (verborgen, wenn nur ein Sub sichtbar) */
function renderSubTabs(){
  const nav = $("#subTabs"); if(!nav) return;
  const dom = verfuegbareDomaenen().find(d => d.key===AKTIVE_DOM);
  const subs = verfuegbareSubs(dom);
  if(subs.length <= 1){ nav.classList.add("hidden"); nav.innerHTML = ""; AKTIVE_SUB = subs[0] ? subs[0].kat : null; return; }
  // Standard-Sub: erster Sub-Reiter MIT Inhalt, sonst der erste.
  if(!AKTIVE_SUB || !subs.some(s => s.kat===AKTIVE_SUB)) AKTIVE_SUB = (subs.find(s => katRows(s.kat).length) || subs[0]).kat;
  nav.classList.remove("hidden");
  nav.innerHTML = subs.map(s => {
    const n = katRows(s.kat).length;
    return `<button type="button" class="sub-tab${s.kat===AKTIVE_SUB?" aktiv":""}" data-sub="${esc(s.kat)}"`
      + ` role="tab" aria-selected="${s.kat===AKTIVE_SUB}">${s.label}${n?` <span class="tab-n">${n}</span>`:""}</button>`;
  }).join("");
  nav.querySelectorAll(".sub-tab").forEach(b => b.addEventListener("click", () => {
    AKTIVE_SUB = b.dataset.sub; renderSubTabs(); renderSektionen();
  }));
}

function renderSektionen(){
  const wrap = $("#sektionen"); wrap.innerHTML = "";
  const doms = verfuegbareDomaenen();
  if(!doms.length){ wrap.innerHTML = `<div class="leer">Für Sie sind derzeit keine Unterlagen hinterlegt.</div>`; return; }
  const dom = doms.find(d => d.key===AKTIVE_DOM) || doms[0];
  const subs = verfuegbareSubs(dom);
  if(!subs.length){ wrap.innerHTML = `<div class="leer">In dieser Kategorie sind keine Unterlagen hinterlegt.</div>`; return; }
  const sub = subs.find(s => s.kat===AKTIVE_SUB) || subs[0];
  // Bei ausgeblendeter Sub-Leiste (nur ein Sub) die Zwischenüberschrift zeigen, sonst benennt der Reiter.
  renderSektion(wrap, sub.kat, KAT_LABEL[sub.kat], subs.length <= 1);
  const s=$("#suche"); if(s){ s.addEventListener("input", renderAnlagen);
    ["#typFilter","#datumFilter","#statusFilter"].forEach(id=>{ const el=$(id); if(el) el.addEventListener("change", renderAnlagen); });
    const tab=$("#anlagen-tabelle"); if(tab){
      tab.addEventListener("click", ev=>{
        const th=ev.target.closest(".th-sort"); if(!th) return;
        const k=th.dataset.sort;
        if(ANL_SORT.key===k) ANL_SORT.dir=(ANL_SORT.dir==="asc"?"desc":"asc");
        else { ANL_SORT.key=k; ANL_SORT.dir=(k==="stand"?"desc":"asc"); }   // Datum: neueste zuerst
        renderAnlagen();
      });
      tab.addEventListener("change", async ev=>{     // SiFa-Freigabe (nur Admin) togglen
        const cb=ev.target.closest(".fg-check"); if(!cb) return;
        const mid=cb.dataset.mid, slug=cb.dataset.slug, key=slug+"|"+mid, jetzt=new Date().toISOString();
        cb.disabled=true;
        try{
          if(cb.checked){
            await apiSend("POST","/rest/v1/portal_freigabe?on_conflict=kunde_slug,maschinen_id",
              [{kunde_slug:slug, maschinen_id:mid, freigegeben:true, freigegeben_am:jetzt, freigegeben_von:ADMIN_NAME, updated_at:jetzt}],
              "resolution=merge-duplicates,return=minimal");
            FREIGABE[key]={freigegeben_am:jetzt, freigegeben_von:ADMIN_NAME};
          } else {
            await apiSend("DELETE","/rest/v1/portal_freigabe?kunde_slug=eq."+encodeURIComponent(slug)+"&maschinen_id=eq."+encodeURIComponent(mid), null, "return=minimal");
            delete FREIGABE[key];
          }
          renderAnlagen();
        }catch(e){ cb.checked=!cb.checked; cb.disabled=false; alert("Freigabe konnte nicht gespeichert werden: "+((e&&e.message)||e)); }
      });
    } }
  renderAnlagen();
}

async function ladePortal(){
  const s = getSession();
  $("#userMail").textContent = (s && s.user && s.user.email) || "";
  try{
    let me = [];
    if(s && s.user && s.user.id)
      me = await apiGet("/rest/v1/portal_mitglied?select=rolle,kunde,kunde_slug,name&user_id=eq."
        + encodeURIComponent(s.user.id), false);
    ADMIN = !!(me && me[0] && me[0].rolle === "admin");
    ADMIN_NAME = (me && me[0] && me[0].name) || (s && s.user && s.user.email) || "OAK engineering";

    const rows = await apiGet("/rest/v1/portal_dokumente?select=*&order=kategorie.asc,sortierung.asc,maschine.asc,titel.asc", false);
    ALLE = rows || [];
    try{
      const fgr = await apiGet("/rest/v1/portal_freigabe?select=kunde_slug,maschinen_id,freigegeben_am,freigegeben_von&freigegeben=eq.true", false);
      FREIGABE = {}; (fgr||[]).forEach(x=> FREIGABE[(x.kunde_slug||"")+"|"+(x.maschinen_id||"")]=x);
    }catch(e){ FREIGABE = {}; }
    await ladeVorfaelle();
    AKTIV = ADMIN ? ([...new Set(ALLE.map(r => r.kunde_slug))][0] || null) : null;
    AKTIVE_DOM = null; AKTIVE_SUB = null;
    setKundeName();
    renderAdminBar();
    renderTabs();
    renderSubTabs();
    renderSektionen();
    updateWaechterStarten();
  }catch(e){
    if(e.message==="AUTH"){ zurLogin(); return; }
    for(const id of ["#katTabs","#subTabs"]){ const nav=$(id); if(nav){ nav.classList.add("hidden"); nav.innerHTML=""; } }
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

  // Passwort aendern
  const pwDlg=$("#pwDlg"), pwMsg=$("#pwMsg");
  $("#pwBtn").addEventListener("click", ()=>{
    $("#pw1").value=""; $("#pw2").value=""; pwMsg.textContent=""; pwMsg.className="pw-msg";
    pwDlg.showModal();
  });
  $("#pwCancel").addEventListener("click", ()=> pwDlg.close());
  $("#pwForm").addEventListener("submit", async (ev)=>{
    ev.preventDefault();   // ohne das schloss das Dialog-Formular bei Enter still, ohne zu speichern ("nichts passiert")
    const a=$("#pw1").value, b=$("#pw2").value;
    pwMsg.className="pw-msg";
    if(a.length<8){ pwMsg.textContent="Mindestens 8 Zeichen."; pwMsg.classList.add("fehler"); return; }
    if(a!==b){ pwMsg.textContent="Die Eingaben stimmen nicht überein."; pwMsg.classList.add("fehler"); return; }
    pwMsg.textContent="Wird gespeichert …";
    try{
      await passwortAendern(a);
      pwMsg.textContent="Passwort geändert – gilt ab sofort."; pwMsg.classList.add("ok");
      setTimeout(()=>pwDlg.close(), 1400);
    }catch(err){
      pwMsg.textContent = (err && err.message==="AUTH") ? "Sitzung abgelaufen – bitte neu anmelden."
                                                        : ("Fehlgeschlagen: " + (err && err.message || err));
      pwMsg.classList.add("fehler");
    }
  });

  const t = await token();
  if(t){ zurApp(); await ladePortal(); } else { zurLogin(); }
});

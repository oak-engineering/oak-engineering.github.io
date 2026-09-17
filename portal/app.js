/* OAK Kundenportal — Login + generischer Dokument-Hub (Kategorien). Nutzt auth.js (vorher geladen). */
"use strict";
const $ = s => document.querySelector(s);
/* App (installiert, display-mode standalone) oder Browser – gesetzt im <head> von index.html */
const IST_APP = document.documentElement.classList.contains("ist-app");
function zurLogin(){ document.documentElement.classList.remove("hat-sitzung"); $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }
function zurApp(){ $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

/* Zwei-Ebenen-Navigation: Domänen-Tabs (oben) → Sub-Reiter (feine `kategorie`-Werte).
   Der Sub `anlagen` ist speziell (Maschinen-Tabelle mit Ampel/Suche/Doc-Buttons), alle
   anderen sind einfache Dokumentlisten. `unterweisungen` gibt es je Domäne getrennt. */
/* Cockpit und Vorfälle sind KEINE Dokumentlisten: Cockpit rechnet Kennzahlen (cockpit.js),
   Vorfälle kommen aus portal_vorfaelle (vorfaelle.js). Vorfälle stehen in BEIDEN Fachdomänen –
   gefiltert nach Zuordnung, weil eine Meldung Arbeitssicherheit oder Umwelt betreffen kann. */
const DOMAENEN = [
  { key: "arbeitssicherheit", label: "Arbeitssicherheit", subs: [
      { kat: "ck-arbeitssicherheit", label: "Überblick" },
      { kat: "hallenplan",    label: "Hallenplan" },
      { kat: "anlagen",       label: "Anlagen &amp; Maschinensicherheit" },
      { kat: "ba-sammel",     label: "Betriebsanweisungen" },
      { kat: "maengel",       label: "Mängel" },
      { kat: "allg-gbu",      label: "Allgemeine GBU" },
      { kat: "gefahrstoffe",  label: "Gefahrstoffe" },
      { kat: "begehungen",    label: "Begehungen" },
      { kat: "vom-betrieb",   label: "Interne Unterlagen" },
      { kat: "unterweisungen", label: "Unterweisungen" },
      { kat: "vf-arbeitssicherheit", label: "Vorfälle" },
      { kat: "logbuch",       label: "Logbuch" },
  ]},
  { key: "umwelt", label: "Umwelt", subs: [
      { kat: "ck-umwelt", label: "Überblick" },
      { kat: "umwelt-immissionsschutz", label: "Immissionsschutz" },
      { kat: "umwelt-gewaesserschutz",  label: "Gewässerschutz" },
      { kat: "umwelt-awsv",             label: "AwSV" },
      { kat: "vf-umwelt",               label: "Umweltvorfälle" },
      { kat: "umwelt-unterweisungen",   label: "Unterweisungen" },
  ]},
  { key: "energie", label: "Energie", subs: [
      { kat: "ck-energie",         label: "Überblick" },
      { kat: "energie-aspekte",    label: "Energieaspekte" },
      { kat: "energie-verbrauch",  label: "Verbrauch &amp; Messstellen" },
      { kat: "energie-massnahmen", label: "Effizienzmaßnahmen" },
  ]},
];
/* „Weitere Unterlagen" ist gestrichen (Nikolai, 14.08.2026). Damit trotzdem nie ein Dokument
   unsichtbar wird, blendet verfuegbareDomaenen() den Reiter automatisch wieder ein, sobald es
   Dokumente in einer Kategorie ohne Reiter gibt. Bewusst eingebettete Kategorien zaehlen nicht
   mit: der Aushang wird direkt in der Vorfall-Sektion verlinkt. */
const EINGEBETTET = ["vorfall-aushang"];
const REST_DOMAENE = { key: "weitere", label: "Weitere Unterlagen",
                       subs: [{ kat: "sonstige", label: "Weitere Unterlagen" }] };
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
/* EIN Hinweis unten mittig – fuer neue Dokumente UND neue Programmversion (Nikolai 16.09.: nicht zusaetzlich ein Knopf oben rechts) */
function updateBannerZeigen(text){
  const alt = document.getElementById("updateBanner");
  if(alt){ if(text && alt.dataset.text !== text) alt.querySelector("span").textContent = "Es gibt Neuerungen im Portal."; return; }
  const d = document.createElement("div");
  d.id = "updateBanner"; d.className = "update-banner"; d.dataset.text = text || "";
  d.innerHTML = '<span>' + esc(text || "Es gibt aktualisierte Dokumente.") + '</span>'
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

let ALLE = [], ADMIN = false, AKTIV = null, MITGLIED = null;
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

/* ---- Startseite = Cockpit der App (Nikolai, 16.09.2026) ------------------------------------
   Oben die vier Dinge, die ein Schichtfuehrer TUT. Darunter „Auf einen Blick" je Bereich
   (Arbeitssicherheit · Umwelt · Energie, Umschalter) – jede Karte fuehrt auf ihre Liste.
   Es gibt keine zweite Uebersicht daneben (renderCockpit in cockpit.js liefert die Karten). */
let MELDE_TOK = [];
let START_BEREICH = (() => { try{ return localStorage.getItem("oak_portal_bereich") || "arbeitssicherheit"; }catch(e){ return "arbeitssicherheit"; } })();
const BEREICHE_APP = [["arbeitssicherheit", "Arbeitssicherheit"], ["umwelt", "Umwelt"], ["energie", "Energie"]];
/* Bereich-Umschalter im Kopf (App): gilt fuer Start, Unterlagen und Vorfaelle – nicht je Seite einzeln (Nikolai 16.09.) */
function renderBereichWahl(){
  const el = $("#bereichWahl"); if(!el) return;
  el.innerHTML = BEREICHE_APP.map(([k, l]) => `<button type="button" role="tab" class="bw-knopf${k === START_BEREICH ? " aktiv" : ""}" data-bereich="${k}" aria-selected="${k === START_BEREICH}">${l}</button>`).join("");
  el.querySelectorAll("[data-bereich]").forEach(b => b.addEventListener("click", () => {
    START_BEREICH = b.dataset.bereich;
    try{ localStorage.setItem("oak_portal_bereich", START_BEREICH); }catch(e){}
    if(AKTIVE_DOM === "mehr" && (AKTIVE_SUB === "vorfaelle" || AKTIVE_SUB === "vf-umwelt")) AKTIVE_SUB = START_BEREICH === "umwelt" ? "vf-umwelt" : "vorfaelle";
    if(AKTIVE_DOM === "unterlagen") AKTIVE_SUB = null;
    renderSektionen(); hashSetzen(true);
  }));
}
async function meldeTokenLaden(){
  try{ MELDE_TOK = await apiGet("/rest/v1/portal_melde_token?select=token,kunde_slug,kunde&aktiv=is.true", false) || []; }catch(e){ MELDE_TOK = []; }
}
const START_SVG = {
  terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M8 10l2 2 4-4"/></svg>',
  warnung:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v5M12 17v.5"/></svg>',
  begehung: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 11l2 2 4.5-4.5M8.5 16.5h7"/></svg>',
  brief:    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
};
START_SVG.dokument = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 12h5M9.5 15.5h5"/></svg>';
START_SVG.liste = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>';
START_SVG.ba = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="18" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="M12 10.5v4.5M12 17.8v.2"/></svg>';
START_SVG.mangel = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.1-.4-.4-2.1z"/><path d="M19 15v4M17 17h4"/></svg>';
START_SVG.blitz ='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>';
/* Kacheln je Bereich – jede fuehrt INNERHALB des Portals weiter (Seitenleiste bleibt stehen) */
const START_AKTIONEN = {
  arbeitssicherheit: [
    ["#mehr/terminal", "Unterweisung starten", "Terminal für die Beschäftigten", "terminal"],
    ["#mehr/melden", "Vorfall melden", "Unfall oder Beinahe-Unfall", "warnung"],
    ["#maengel?neu=1", "Mangel erfassen", "An Maschine oder Halle, mit Foto", "mangel"],
    ["#mehr/pruefen", "Maschine prüfen", "Checkliste direkt an der Maschine", "begehung"],
    ["#unterlagen/ba-sammel", "Betriebsanweisungen", "Sammel-BA je Maschinentyp", "ba"],
    ["#mehr/anfragen", "Frage an OAK engineering", "Formular mit Foto, Antwort per Mail", "brief"] ],
  umwelt: [
    ["#mehr/melden?art=umwelt", "Umweltvorfall melden", "Austritt, Leckage, falsch entsorgt", "warnung"],
    ["#mehr/vf-umwelt", "Umweltvorfälle", "Gemeldete Vorfälle und ihr Stand", "liste"],
    ["#unterlagen", "Umwelt-Unterlagen", "Immissionsschutz, Gewässerschutz, AwSV", "dokument"],
    ["#mehr/anfragen", "Frage an OAK engineering", "Formular mit Foto, Antwort per Mail", "brief"] ],
  energie: [
    ["#unterlagen/energie-massnahmen", "Effizienzmaßnahmen", "Befunde aus den Begehungen", "blitz"],
    ["#unterlagen/energie-verbrauch", "Verbrauch & Messstellen", "Zähler und Messkonzept", "dokument"],
    ["#unterlagen/energie-aspekte", "Energieaspekte", "Antriebe, Druckluft, Temperierung", "dokument"],
    ["#mehr/anfragen", "Frage an OAK engineering", "Formular mit Foto, Antwort per Mail", "brief"] ]
};
function renderStart(wrap){
  document.body.classList.add("auf-start");
  const kachel = k => `<a class="start-kachel" href="${k[0]}"><span class="sk-kopf"><span class="sk-titel">${esc(k[1])}</span>${START_SVG[k[3]] || ""}</span><span class="sk-sub">${esc(k[2])}</span></a>`;
  const sec = document.createElement("section"); sec.className = "sektion start-seite";
  const bereiche = [["arbeitssicherheit", "Arbeitssicherheit"], ["umwelt", "Umwelt"], ["energie", "Energie"]];
  sec.innerHTML = `<div class="start-blick-kopf"><h2>Auf einen Blick · ${esc((BEREICHE_APP.find(b => b[0] === START_BEREICH) || [])[1] || "")}</h2></div>
    <div id="startBlick"></div>
    <div class="start-raster">${(START_AKTIONEN[START_BEREICH] || START_AKTIONEN.arbeitssicherheit).map(kachel).join("")}</div>`;
  wrap.appendChild(sec);
  renderCockpit(sec.querySelector("#startBlick"), START_BEREICH);
}

/* Terminal, Meldeformular und Maschinen-Checkliste laufen im Portal (Rahmen), damit die Seitenleiste bleibt. */
/* ---- Unterweisungs-Terminal im Vollbild, gesperrt (Nikolai 16.09.2026) -----------------------
   Ab „Unterweisung starten" bedienen Mitarbeiter das Geraet. Das Terminal liegt ueber dem ganzen Fenster
   (und im Vollbild), Seitenleiste, Zurueck und Neuladen fuehren nicht ins Portal. Beenden mit Rueckfrage
   (nicht gespeicherte Fortschritte gehen verloren). */
const TERM_SPERRE = "oak_terminal_gesperrt";
function terminalVollbild(){
  const tok = (typeof uwGeraeteToken === "function" ? uwGeraeteToken() : "");
  if(!tok){ alert("Für diesen Betrieb ist noch kein Terminal eingerichtet – bitte bei OAK engineering melden."); return; }
  let o = document.getElementById("terminalSperre");
  if(!o){
    o = document.createElement("div"); o.id = "terminalSperre"; o.className = "terminal-sperre";
    o.innerHTML = `<iframe title="Unterweisungs-Terminal" allow="fullscreen; camera; microphone"></iframe>
      <div class="ts-leiste"><button type="button" class="ts-vollbild" hidden>Vollbild</button><button type="button" class="ts-ende">Terminal beenden</button></div>`;
    document.body.appendChild(o);
    o.querySelector("iframe").src = "kiosk.html#t=" + encodeURIComponent(tok);
    o.querySelector(".ts-ende").addEventListener("click", terminalBeendenFragen);
    o.querySelector(".ts-vollbild").addEventListener("click", () => terminalVollbildAn(o));
  }
  document.documentElement.classList.add("terminal-aktiv");
  try{ sessionStorage.setItem(TERM_SPERRE, "1"); }catch(e){}
  terminalVollbildAn(o);
}
function terminalVollbildAn(el){
  try{ const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : null; if(r && r.catch) r.catch(() => terminalVollbildKnopf()); }catch(e){ terminalVollbildKnopf(); }
}
function terminalVollbildKnopf(){
  const b = document.querySelector("#terminalSperre .ts-vollbild"); if(b) b.hidden = !!document.fullscreenElement;
}
document.addEventListener("fullscreenchange", terminalVollbildKnopf);
function terminalBeendenFragen(){
  const o = document.getElementById("terminalSperre"); if(!o) return;
  let dlg = document.getElementById("tsDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "tsDlg"; dlg.className = "pw-dlg"; o.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog">
      <h3>Terminal wirklich beenden?</h3>
      <p class="pw-hint">Nicht gespeicherte Fortschritte gehen verloren. Eine angefangene Unterweisung muss dann neu begonnen werden.</p>
      <div class="pw-akt"><button type="button" class="btn sek" id="tsAbbr">Nein, weiter</button><button type="submit" class="btn">Ja, beenden</button></div>
    </form>`;
  dlg.querySelector("#tsAbbr").addEventListener("click", () => dlg.close());
  dlg.querySelector("form").addEventListener("submit", ev => { ev.preventDefault(); dlg.close(); terminalSchliessen(); });
  dlg.showModal();
}
function terminalSchliessen(){
  const o = document.getElementById("terminalSperre"); if(o) o.remove();
  document.documentElement.classList.remove("terminal-aktiv");
  try{ sessionStorage.removeItem(TERM_SPERRE); }catch(e){}
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}
/* Jeder Link auf das Terminal oeffnet es gesperrt im Vollbild (direkt im Klick, sonst verweigert der Browser das Vollbild) */
document.addEventListener("click", ev => {
  const a = ev.target.closest && ev.target.closest('a[href="#mehr/terminal"]');
  if(!a) return;
  ev.preventDefault(); ev.stopPropagation(); terminalVollbild();
}, true);

/* Vorfälle: oben der Knopf zum Melden (Nikolai 16.09.) – öffnet das Meldeformular im Portal */
function vorfallMeldenKnopf(wrap, bereich){
  const sec = document.createElement("section"); sec.className = "sektion uw-hero vf-melden-hero";
  sec.innerHTML = `<a class="uw-start" href="#mehr/melden${bereich === "umwelt" ? "?art=umwelt" : ""}">${bereich === "umwelt" ? "Umweltvorfall melden" : "Vorfall melden"}</a>
    <p class="uw-erkl uw-hero-text">Unfall, Beinahe-Unfall, unsicherer Zustand oder Umweltvorfall – mit Foto. Die Meldung geht an OAK engineering.</p>`;
  wrap.appendChild(sec);
}
function renderEinbettung(wrap, was){
  if(was === "terminal"){   // Adresse direkt aufgerufen: Terminal gesperrt oeffnen, dahinter die Unterweisungsseite
    terminalVollbild();
    const n = navNormal("mehr", "unterweisungen"); AKTIVE_DOM = n[0]; AKTIVE_SUB = n[1]; hashSetzen(true); renderSektionen(); return;
  }
  const tok = (typeof uwGeraeteToken === "function" ? uwGeraeteToken() : "");
  const mt  = (MELDE_TOK.find(x => x.kunde_slug === AKTIV) || {}).token || "";
  const kunde = (ALLE.find(x => x.kunde_slug === AKTIV) || {}).kunde || "";
  const art = HASH_Q && HASH_Q.get("art"); HASH_Q = null;
  const url = was === "terminal" ? (tok ? "kiosk.html#t=" + encodeURIComponent(tok) : "")
            : was === "melden"   ? (mt ? "melden.html?t=" + encodeURIComponent(mt) + "&eingebettet=1" + (art ? "&art=" + encodeURIComponent(art) : "") : "")
            : "pruefen.html?eingebettet=1&k=" + encodeURIComponent(AKTIV || "");   // eigene Checkliste (T 008-2), nicht der OAK-Begehungsbogen
  const sec = document.createElement("section"); sec.className = "sektion einbettung-sektion";
  if(!url){ sec.innerHTML = `<div class="ck-fuss">Für diesen Betrieb ist noch kein Zugang eingerichtet – bitte bei OAK engineering melden.</div>`; wrap.appendChild(sec); return; }
  sec.innerHTML = `<iframe class="einbettung" title="${esc(MEHR_LABEL[was] || "")}" allow="fullscreen; camera; microphone; geolocation"></iframe>
    <div class="einbettung-fuss"><a href="${url}" target="_blank" rel="noopener">In eigenem Fenster öffnen</a></div>`;
  sec.querySelector("iframe").src = url;
  wrap.appendChild(sec);
}

function setKundeName(){
  const r = AKTIV ? ALLE.find(x => x.kunde_slug===AKTIV) : ALLE[0];
  const kn = $("#kundeName"); if(kn) kn.textContent = (r && r.kunde) || "";
  markeAnwenden();
}

/* ---- Marke je Kunde (portal_kunde.marke) – gesetzt wird zentral in marke.js (auch Zwischenspeicher) ---- */
let MARKEN = [];
async function markeLaden(){
  try{ MARKEN = await apiGet("/rest/v1/portal_kunde?select=slug,name,marke", false) || []; }catch(e){ MARKEN = []; }
}
function markeAnwenden(){
  const k = MARKEN.find(x => x.slug === AKTIV);
  if(window.OAK_MARKE) OAK_MARKE.setzen((k && k.marke) || {}, (k && k.name) || "");
}
function renderAdminBar(){
  const bar = $("#adminBar");
  if(!ADMIN){ bar.classList.add("hidden"); bar.innerHTML = ""; return; }  // keine Admin-Reste nach Rollenwechsel
  const kunden = [...new Map(ALLE.map(r => [r.kunde_slug, r.kunde || r.kunde_slug])).entries()]
    .sort((a,b) => String(a[1]).localeCompare(String(b[1])));
  bar.classList.remove("hidden");
  bar.innerHTML = `<span class="admin-tag">Admin</span>
    <select id="kundeWahl" aria-label="Kunde wählen">${kunden.map(([slug,name]) =>
      `<option value="${esc(slug)}"${slug===AKTIV?" selected":""}>${esc(name)}</option>`).join("")}</select>`;
  $("#kundeWahl").addEventListener("change", e => { AKTIV = e.target.value; setKundeName(); portalGehe("start"); });
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
      <td>${esc(r.maschine)}${statusBadge(r, neuestesDatum)}</td><td>${esc(String(r.maschinentyp||"–").replace(/\s*\(mit [^)]*\)/i, ""))}</td><td>${esc(r.stand||"–")}</td>
      <td class="docs">${machDoc(r,"bda","GBU","gbu")}${machDoc(r,"ba","BA")}${machDoc(r,"maengelliste","Mängel")}${machDoc(r,"protokoll","Protokoll")}${qrLink(r)}</td>${fgCell}
    </tr>`; }).join("") : `<tr><td colspan="${ADMIN?6:5}" class="leer">keine Anlagen</td></tr>`}</tbody>`;
  tab.innerHTML = kopf + koerper;
  const z=$("#anlagenZaehler"); if(z) z.textContent = rows.length + " von " + anlagen().length + (istAllg ? " GBU" : " Anlagen");
}

function docZeile(r){
  const oeffnen = (r.doc_typ==="link" && r.url)
    ? `<a class="doc-open" href="${esc(r.url)}" target="_blank" rel="noopener">Öffnen</a>`
    : `<a class="doc-open" href="${viewerUrl(r.doc_typ, r.storage_path, r.titel)}" target="_blank" rel="noopener">Öffnen</a>`;
  const fmt = {html:"Dokument", pdf:"PDF", link:"Online", bda:"GBU", ba:"BA", maengelliste:"Mängelliste", protokoll:"Protokoll", bild:"Foto", datei:"Datei"}[r.doc_typ] || "Dokument";
  return `<tr><td>${esc(r.titel||"Dokument")}</td><td class="tspalte">${fmt}</td>`
    + `<td class="tspalte">${r.stand?esc(r.stand):"—"}</td><td class="doc-td">${oeffnen}</td></tr>`;
}

let AKTIVE_DOM = null, AKTIVE_SUB = null;
let PORTAL_BEREIT = false;
/* ---- Seiten der App (16.09.2026) ------------------------------------------------------------
   EINE Navigation fuer alle Rollen, auch Admin (keine Reiterleisten mehr):
     start · maengel · unterlagen[/kategorie] · mehr/<unterseite>
   Die Seite steht in der Adresse – Browser-„Zurueck" bleibt im Portal. Alte Adressen
   (#arbeitssicherheit/anlagen, Cockpit-Links …) werden umgeschrieben und funktionieren weiter. */
const MEHR_LABEL = { unterweisungen: "Unterweisungen", vorfaelle: "Gemeldete Vorfälle", "vf-umwelt": "Umweltvorfälle",
                     anfragen: "Frage an OAK engineering", "uw-katalog": "Modulkatalog", personen: "Mitarbeiter verwalten",
                     kapitel: "Unterweisungs-Inhalte", "uw-ueberblick": "Unterweisungen – Überblick",
                     terminal: "Unterweisung starten", melden: "Vorfall melden", pruefen: "Maschine prüfen", logbuch: "Logbuch" };
const UNTERLAGEN = [
  { bereich: "Arbeitssicherheit", kats: [
      ["anlagen", "Maschinen & Anlagen", "Gefährdungsbeurteilung, Betriebsanweisung und Mängelliste je Maschine"],
      ["ba-sammel", "Betriebsanweisungen", "Sammel-BA je Maschinentyp"],
      ["hallenplan", "Hallenplan", "Alle Maschinen mit ihrem Risiko"],
      ["allg-gbu", "Allgemeine Gefährdungsbeurteilungen", "Tätigkeiten und Themen ohne feste Maschine"],
      ["gefahrstoffe", "Gefahrstoffe", "Verzeichnis und Betriebsanweisungen"],
      ["begehungen", "Begehungsprotokolle", "Was bei den Begehungen festgestellt wurde"],
      ["vom-betrieb", "Interne Unterlagen", "Unterlagen hochladen und ansehen"] ]},
  { bereich: "Umwelt", kats: [
      ["umwelt-immissionsschutz", "Immissionsschutz", ""], ["umwelt-gewaesserschutz", "Gewässerschutz", ""],
      ["umwelt-awsv", "AwSV", ""], ["umwelt-unterweisungen", "Unterweisungen Umwelt", ""] ]},
  { bereich: "Energie", kats: [
      ["energie-aspekte", "Energieaspekte", ""], ["energie-verbrauch", "Verbrauch & Messstellen", ""],
      ["energie-massnahmen", "Effizienzmaßnahmen", ""] ]}
];
const UL_LABEL = Object.fromEntries(UNTERLAGEN.flatMap(b => b.kats.map(k => [k[0], k[1]])).concat([["sonstige", "Weitere Unterlagen"]]));
/* Browser-Ansicht (gewohnt): Reiter je Bereich. Adressen der App werden auf Reiter umgeschrieben. */
function navKlassisch(dom, sub){
  const domVon = kat => (DOMAENEN.find(d => d.subs.some(s => s.kat === kat)) || {}).key;
  if(DOMAENEN.some(d => d.key === dom) || dom === "weitere") return [dom, sub || null];
  if(!dom || dom === "start") return [START_BEREICH || "arbeitssicherheit", null];
  if(dom === "maengel") return ["arbeitssicherheit", "maengel"];
  if(dom === "unterlagen"){
    if(!sub) return ["arbeitssicherheit", "anlagen"];
    if(sub === "sonstige") return ["weitere", "sonstige"];
    const d = domVon(sub); return d ? [d, sub] : ["arbeitssicherheit", null];
  }
  if(dom === "mehr"){
    if(sub === "unterweisungen") return ["arbeitssicherheit", "unterweisungen"];
    if(sub === "vorfaelle") return ["arbeitssicherheit", "vf-arbeitssicherheit"];
    if(sub === "vf-umwelt") return ["umwelt", "vf-umwelt"];
    if(sub === "upload") return ["arbeitssicherheit", "vom-betrieb"];
    if(sub === "logbuch") return ["arbeitssicherheit", "logbuch"];
    return sub ? ["mehr", sub] : ["arbeitssicherheit", null];
  }
  return ["arbeitssicherheit", null];
}
function navNormal(dom, sub){
  if(!IST_APP) return navKlassisch(dom, sub);
  if(!dom) return ["start", null];
  if(dom === "mehr" && sub === "upload") return ["unterlagen", "vom-betrieb"];
  if(["start", "maengel", "unterlagen", "mehr"].includes(dom)) return (dom === "mehr" && !sub) ? ["start", null] : [dom, sub || null];
  if(dom === "weitere") return ["unterlagen", "sonstige"];
  if(!DOMAENEN.some(d => d.key === dom)) return ["start", null];
  if(!sub || sub.indexOf("ck-") === 0){ START_BEREICH = dom; return ["start", null]; }
  if(sub === "maengel") return ["maengel", null];
  if(sub === "unterweisungen") return ["mehr", "unterweisungen"];
  if(sub === "vf-arbeitssicherheit") return ["mehr", "vorfaelle"];
  if(sub === "vf-umwelt") return ["mehr", "vf-umwelt"];
  if(sub === "logbuch") return ["mehr", "logbuch"];
  return ["unterlagen", sub];
}
function hashSetzen(ersetzen){
  const h = "#" + (AKTIVE_DOM || "start") + (AKTIVE_SUB ? "/" + AKTIVE_SUB : "");
  if(location.hash === h) return;
  try{ if(ersetzen) history.replaceState(null, "", h); else history.pushState(null, "", h); }catch(e){}
}
let HASH_Q = null;   // Parameter hinter der Seite, z. B. #unterlagen/anlagen?status=gefahr (Cockpit-Karte)
function hashLesen(){
  const roh = location.hash.replace(/^#/, "");
  const [pfad, q] = roh.split("?");
  const t = pfad.split("/");
  if(!t[0]) return false;
  const n = navNormal(decodeURIComponent(t[0]), t[1] ? decodeURIComponent(t[1]) : null);
  AKTIVE_DOM = n[0]; AKTIVE_SUB = n[1];
  HASH_Q = q ? new URLSearchParams(q) : null;
  return true;
}
/* Oeffentliche Portal-API fuer die Leiste unten (site.js) */
window.portalGehe = function(dom, sub){
  const n = navNormal(dom, sub); AKTIVE_DOM = n[0]; AKTIVE_SUB = n[1];
  renderSektionen(); hashSetzen(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
};
window.portalKontext = function(){
  return { admin: !!ADMIN, fachkraft: !!window.__oakFachkraft, aktiv: AKTIV, seite: AKTIVE_DOM, unterseite: AKTIVE_SUB,
           meldeToken: ((typeof MELDE_TOK !== "undefined" ? MELDE_TOK : []).find(x => x.kunde_slug === AKTIV) || {}).token || "" };
};
window.addEventListener("popstate", () => {
  if(document.documentElement.classList.contains("terminal-aktiv")){ try{ history.pushState(null, "", location.href); }catch(e){} return; }   // Terminal gesperrt: kein Zurueck
  if(!PORTAL_BEREIT) return;
  if(!hashLesen()){ AKTIVE_DOM = "start"; AKTIVE_SUB = null; }
  renderSektionen(); hashSetzen(true); window.scrollTo(0, 0);
});
function katRows(kat){
  if(kat.indexOf("ck-") === 0) return [];                        // Cockpit hat keinen Zähler
  if(kat.indexOf("uw-") === 0) return [];                        // Überblick/Katalog rechnen selbst
  if(kat === "maengel") return [];                               // eigene Tabelle
  if(kat === "logbuch") return [];
  if(kat === "vf-arbeitssicherheit") return vBereich("arbeitssicherheit");
  if(kat === "vf-umwelt") return vBereich("umwelt");
  if(kat === "energie-massnahmen") return eSichtbar();           // Register statt Dokumentliste
  if(kat === "hallenplan") return sichtbar().filter(r => r.kategorie === kat && r.doc_typ !== "svg");   // Vektordatei nur fuers Begehungstool
  if(kat === "sonstige"){                                        // Auffangbecken: alles ohne Reiter
    const bekannt = new Set(DOMAENEN.flatMap(d => d.subs.map(s => s.kat)).concat(EINGEBETTET));
    return sichtbar().filter(r => r.kategorie && !bekannt.has(r.kategorie));
  }
  return sichtbar().filter(r => r.kategorie===kat);
}
/* ALLE Fachbereiche sind für jeden sichtbar (auch ohne Inhalt) – zeigt das volle OAK-Leistungsspektrum.
   Dazu kommt „Weitere Unterlagen" NUR, wenn sonst etwas unsichtbar bliebe (s. REST_DOMAENE). */
function verfuegbareDomaenen(){
  const bekannt = new Set(DOMAENEN.flatMap(d => d.subs.map(s => s.kat)).concat(EINGEBETTET));
  const uebrig = sichtbar().some(r => r.kategorie && !bekannt.has(r.kategorie));
  return uebrig ? DOMAENEN.concat([REST_DOMAENE]) : DOMAENEN;
}
function domCount(d){ return d.subs.reduce((n,s)=> n + katRows(s.kat).length, 0); }
function verfuegbareSubs(dom){ return dom ? dom.subs : []; }
function domHatInhalt(d){ return d.subs.some(s => katRows(s.kat).length); }

/* Eine feine Kategorie als Sektion rendern. zeigeHeading=false: ohne Zwischenüberschrift
   (der Sub-Reiter benennt sie schon). Anlagen zeigen ihren Kopf immer (Suche/Zähler). */
function renderSektion(wrap, kat, label, zeigeHeading){
  if(kat.indexOf("ck-") === 0){
    /* Browser-Ansicht: im Ueberblick oben dieselben Knoepfe wie in der App (Unterweisung starten, Vorfall melden …) */
    if(!IST_APP){ const k = document.createElement("section"); k.className = "sektion start-seite";
      k.innerHTML = `<div class="start-raster">${(START_AKTIONEN[kat.slice(3)] || START_AKTIONEN.arbeitssicherheit).map(x =>
        `<a class="start-kachel" href="${x[0]}"><span class="sk-kopf"><span class="sk-titel">${esc(x[1])}</span>${START_SVG[x[3]] || ""}</span><span class="sk-sub">${esc(x[2])}</span></a>`).join("")}</div>`;
      wrap.appendChild(k); }
    renderCockpit(wrap, kat.slice(3)); return;
  }
  if(kat === "vf-arbeitssicherheit"){ vorfallMeldenKnopf(wrap, "arbeitssicherheit"); renderVorfaelle(wrap, "arbeitssicherheit"); return; }
  if(kat === "vf-umwelt"){ vorfallMeldenKnopf(wrap, "umwelt"); renderVorfaelle(wrap, "umwelt"); return; }               // vorfaelle.js
  if(kat === "energie-massnahmen"){ renderEnergie(wrap); return; }                  // energie.js
  /* Unterweisungen: erst die Nachweise aus dem Terminal (unterweisungen.js), darunter wie
     gehabt die hinterlegten Unterlagen - beides gehoert zum selben Reiter. */
  if(kat === "uw-ueberblick"){ renderUwUeberblick(wrap); return; }   // unterweisungen-start.js
  if(kat === "uw-katalog"){ renderUwKatalog(wrap); return; }
  if(kat === "personen"){ renderPersonen(wrap); return; }
  if(kat === "kapitel"){ renderKapitel(wrap); return; }
  if(kat === "unterweisungen"){ renderUnterweisungen(wrap); return; }   // unterweisungen.js: eine Seite, drei Abschnitte
  if(kat === "anfragen"){ renderAnfragen(wrap); return; }             // anfragen.js: Frage an OAK (Formular)
  if(kat === "maengel"){ renderMaengel(wrap); return; }               // maengel.js: To-Do-Liste
  if(kat === "logbuch"){ renderLogbuch(wrap); return; }               // logbuch.js: wer hat was geaendert
  if(kat === "upload" || kat === "vom-betrieb"){ renderUpload(wrap); return; }   // upload.js: hochladen + Liste
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

/* Beide Reiterleisten laufen einzeilig; wird der Platz knapp, laesst sich schieben.
   Der Scrollbalken ist ausgeblendet (er machte die Zeile unruhig) – ohne Hinweis merkt
   aber niemand, dass rechts noch Reiter stehen. Darum blendet die Kante dann weich aus. */
function reiterUeberlauf(nav){
  if(!nav) return;
  nav.classList.toggle("mehr", nav.scrollWidth > nav.clientWidth + 1);
}
function reiterUeberlaufPruefen(){
  reiterUeberlauf($("#katTabs")); reiterUeberlauf($("#subTabs"));
}
window.addEventListener("resize", reiterUeberlaufPruefen);

/* Reiter: nur in der Browser-Ansicht. In der App (und auf den Unterseiten „mehr/…") ausgeblendet. */
function renderTabs(){
  const nav = $("#katTabs"); if(!nav) return;
  if(IST_APP || AKTIVE_DOM === "mehr"){ nav.classList.add("hidden"); nav.innerHTML = ""; return; }
  const doms = verfuegbareDomaenen();
  if(!doms.length){ nav.classList.add("hidden"); nav.innerHTML = ""; return; }
  if(!AKTIVE_DOM || !doms.some(d => d.key === AKTIVE_DOM)) AKTIVE_DOM = (doms.find(domHatInhalt) || doms[0]).key;
  nav.classList.remove("hidden");
  nav.innerHTML = doms.map(d => {
    const n = domCount(d);
    return `<button type="button" class="kat-tab${d.key===AKTIVE_DOM?" aktiv":""}" data-dom="${esc(d.key)}"`
      + ` role="tab" aria-selected="${d.key===AKTIVE_DOM}">${d.label}${n?` <span class="tab-n">${n}</span>`:""}</button>`;
  }).join("");
  nav.querySelectorAll(".kat-tab").forEach(b => b.addEventListener("click", () => {
    AKTIVE_DOM = b.dataset.dom; AKTIVE_SUB = null; renderSektionen(); hashSetzen(false);
  }));
  reiterUeberlauf(nav);
}
function renderSubTabs(){
  const nav = $("#subTabs"); if(!nav) return;
  if(IST_APP || AKTIVE_DOM === "mehr"){ nav.classList.add("hidden"); nav.innerHTML = ""; return; }
  const dom = verfuegbareDomaenen().find(d => d.key === AKTIVE_DOM);
  const subs = verfuegbareSubs(dom);
  if(subs.length <= 1){ nav.classList.add("hidden"); nav.innerHTML = ""; AKTIVE_SUB = subs[0] ? subs[0].kat : null; return; }
  if(!AKTIVE_SUB || !subs.some(s => s.kat === AKTIVE_SUB))
    AKTIVE_SUB = (subs.find(s => s.kat.indexOf("ck-") === 0) || subs.find(s => katRows(s.kat).length) || subs[0]).kat;
  nav.classList.remove("hidden");
  nav.innerHTML = subs.map(s => {
    const n = katRows(s.kat).length;
    return `<button type="button" class="sub-tab${s.kat===AKTIVE_SUB?" aktiv":""}" data-sub="${esc(s.kat)}"`
      + ` role="tab" aria-selected="${s.kat===AKTIVE_SUB}">${s.label}${n?` <span class="tab-n">${n}</span>`:""}</button>`;
  }).join("");
  nav.querySelectorAll(".sub-tab").forEach(b => b.addEventListener("click", () => {
    const direkt = direktDokument(b.dataset.sub);
    if(direkt){ window.open(viewerUrl(direkt.doc_typ, direkt.storage_path, direkt.titel), "_blank", "noopener"); return; }
    AKTIVE_SUB = b.dataset.sub; renderSektionen(); hashSetzen(false);
  }));
  reiterUeberlauf(nav);
}

/* Kopf jeder Unterseite: „‹ Zurueck" + Titel. Unterlagen-Listen gehen zurueck auf Unterlagen, alles andere auf Start. */
function seitenKopf(wrap){
  let titel = "", ziel = ["start", null], zLabel = IST_APP ? "Start" : "Überblick";
  if(AKTIVE_DOM === "unterlagen" && AKTIVE_SUB){ titel = UL_LABEL[AKTIVE_SUB] || AKTIVE_SUB; ziel = ["unterlagen", null]; zLabel = "Unterlagen"; }
  else if(AKTIVE_DOM === "unterlagen"){ titel = "Unterlagen"; }
  else if(AKTIVE_DOM === "maengel"){ titel = "Mängel"; }
  else if(AKTIVE_DOM === "mehr"){ titel = MEHR_LABEL[AKTIVE_SUB] || ""; }
  const k = document.createElement("div"); k.className = "seiten-kopf";
  k.innerHTML = `<button type="button" class="zurueck">‹ ${esc(zLabel)}</button><h1>${esc(titel)}</h1>`;
  k.querySelector(".zurueck").addEventListener("click", () => portalGehe(ziel[0], ziel[1]));
  wrap.appendChild(k);
}

/* Hallenplan: ein Dokument – Klick oeffnet es direkt statt einer Liste mit einer Zeile (Nikolai 16.09.) */
function direktDokument(kat){
  if(kat !== "hallenplan") return null;
  const r = katRows(kat); return r.length === 1 ? r[0] : null;
}
/* Unterlagen: eine Seite mit den Gruppen je Bereich – nur was es gibt, „Vom Betrieb" immer (Hochladen). */
function renderUnterlagen(wrap){
  const anzahl = kat => kat === "energie-massnahmen" ? ((typeof eSichtbar === "function") ? eSichtbar().length : 0) : katRows(kat).length;
  const sec = document.createElement("section"); sec.className = "sektion ul-seite";
  const rest = katRows("sonstige").length;
  const gewaehlt = (BEREICHE_APP.find(b => b[0] === START_BEREICH) || [])[1];
  const intern = ["vom-betrieb", "Interne Unterlagen", "Unterlagen hochladen und ansehen"];
  sec.innerHTML = UNTERLAGEN.filter(b => !IST_APP || b.bereich === gewaehlt).map(b => {
    const kats = b.kats.filter(k => k[0] !== "vom-betrieb" && anzahl(k[0])).concat([intern]);
    return `<h2 class="ul-bereich">${esc(b.bereich)}</h2>` + (kats.length
      ? `<div class="ul-raster">${kats.map(k => { const n = anzahl(k[0]); const direkt = direktDokument(k[0]);
          return `<a class="ul-karte" href="${direkt ? viewerUrl(direkt.doc_typ, direkt.storage_path, direkt.titel) + `" target="_blank" rel="noopener` : "#unterlagen/" + k[0]}"><span class="ul-titel">${esc(k[1])}</span>`
            + `${k[2] ? `<span class="ul-sub">${esc(k[2])}</span>` : ""}<span class="ul-n">${k[0] === "vom-betrieb" ? (n ? n + " · hochladen" : "hochladen") : n}</span></a>`; }).join("")}</div>`
      : `<div class="ul-leer">Noch keine Unterlagen – der Bereich wird mit OAK engineering aufgebaut.</div>`);
  }).join("") + (rest ? `<h2 class="ul-bereich">Weitere</h2><div class="ul-raster"><a class="ul-karte" href="#unterlagen/sonstige"><span class="ul-titel">Weitere Unterlagen</span><span class="ul-n">${rest}</span></a></div>` : "");
  wrap.appendChild(sec);
}

/* ---- Seitenleiste (Nikolai 16.09.: „staendig verfuegbare Seitenleiste ist deutlich intuitiver") ----
   Am PC fest links, am Handy faehrt dieselbe Leiste ueber „Mehr" (Leiste unten) herein. Eine Liste, zwei Groessen. */
const NAV_SVG = {
  start: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
  maengel: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="m7.5 12.5 3 3 6-7"/>',
  unterlagen: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 12h5M9.5 15.5h5"/>',
  unterweisungen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  vorfaelle: '<path d="M12 3.5 2.8 20h18.4L12 3.5z"/><path d="M12 10v4.2M12 17.4h.01"/>',
  anfragen: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m21 7-9 6-9-6"/>',
  werkzeug: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  schloss: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  logbuch: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6M9 11h6"/>',
  klapp: '<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>',
  tuer: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>'
};
function uwFaelligZahl(){
  try{
    const pers = uwPersonen(), rows = uwSichtbar();
    return pers.filter(p => { const n = uwLetzterNachweis(p.name); return !n || uwStatus(n).klasse !== "gut"; }).length
         + uwJeMitarbeiter(rows).filter(n => !pers.some(p => uwNorm(p.name) === uwNorm(n.mitarbeiter_name)) && uwStatus(n).klasse !== "gut").length;
  }catch(e){ return 0; }
}
function renderSeitenleiste(){
  const el = $("#seitenleiste"); if(!el) return;
  const uw = uwFaelligZahl();
  const aktiv = (dom, sub) => dom === "unterlagen" ? AKTIVE_DOM === "unterlagen"
    : dom === "mehr" ? (AKTIVE_DOM === "mehr" && (AKTIVE_SUB === sub || (sub === "vorfaelle" && AKTIVE_SUB === "vf-umwelt")))
    : AKTIVE_DOM === dom;
  const e = (dom, sub, ico, text, badge) => `<button type="button" class="sl-eintrag${aktiv(dom, sub) ? " aktiv" : ""}" data-nav="${dom}${sub ? "/" + sub : ""}" title="${text}">`
    + `<svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVG[ico]}</svg><span>${text}</span>${badge ? `<b class="sl-badge">${badge}</b>` : ""}</button>`;
  const erweitert = (ADMIN || window.__oakFachkraft) ? `<div class="sl-kopf">Erweiterte Funktionen</div>
      ${e("mehr", "uw-katalog", "werkzeug", "Modulkatalog")}${e("mehr", "personen", "werkzeug", "Mitarbeiter verwalten")}${e("mehr", "kapitel", "werkzeug", "Unterweisungs-Inhalte")}` : "";
  el.innerHTML = `<div class="sl-liste">
      <button type="button" class="sl-eintrag sl-klapp" id="slKlapp" title="Seitenleiste ein- oder ausklappen"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVG.klapp}</svg><span>Einklappen</span></button>
      ${e("start", null, "start", "Start")}
      ${e("maengel", null, "maengel", "Mängel")}
      ${e("unterlagen", null, "unterlagen", "Unterlagen")}
      ${e("mehr", "unterweisungen", "unterweisungen", "Unterweisungen", uw)}
      ${START_BEREICH === "umwelt" ? e("mehr", "vf-umwelt", "vorfaelle", "Umweltvorfälle") : e("mehr", "vorfaelle", "vorfaelle", "Vorfälle")}
      ${e("mehr", "anfragen", "anfragen", "Frage an OAK")}
      ${e("mehr", "logbuch", "logbuch", "Logbuch")}
      ${erweitert}
    </div>
    <div class="sl-fuss">
      ${/^Schichtf/i.test(window.__oakName || "") ? "" : `<button type="button" class="sl-eintrag" data-aktion-id="pwBtn"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVG.schloss}</svg><span>Passwort ändern</span></button>`}
      <button type="button" class="sl-eintrag" data-aktion-id="logoutBtn"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVG.tuer}</svg><span>Abmelden</span></button>
    </div>`;
  el.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => {
    document.body.classList.remove("menue-auf"); const t = b.dataset.nav.split("/"); portalGehe(t[0], t[1] || null); }));
  el.querySelector("#slKlapp").addEventListener("click", () => {
    const schmal = document.body.classList.toggle("sl-schmal");
    try{ localStorage.setItem("oak_portal_sl_schmal", schmal ? "1" : ""); }catch(e){}
  });
  el.querySelectorAll("[data-aktion-id]").forEach(b => b.addEventListener("click", () => {
    document.body.classList.remove("menue-auf"); const z = document.getElementById(b.dataset.aktionId); if(z) z.click(); }));
}
window.portalMenue = function(){ document.body.classList.toggle("menue-auf"); };

function renderSektionen(){
  const wrap = $("#sektionen"); wrap.innerHTML = "";
  document.body.classList.remove("auf-start"); document.body.classList.remove("auf-mehr");
  if(!IST_APP){ renderKlassisch(wrap); return; }
  if(!AKTIVE_DOM || AKTIVE_DOM === "start" || (AKTIVE_DOM === "mehr" && !AKTIVE_SUB)){ AKTIVE_DOM = "start"; AKTIVE_SUB = null; }
  document.body.dataset.seite = AKTIVE_DOM; document.body.dataset.unterseite = AKTIVE_SUB || "";
  renderSeitenleiste(); renderBereichWahl();
  if(AKTIVE_DOM === "start"){ renderStart(wrap); return; }
  seitenKopf(wrap);
  if(AKTIVE_DOM === "maengel"){ renderMaengel(wrap); return; }
  if(AKTIVE_DOM === "mehr"){
    if(AKTIVE_SUB === "vorfaelle"){ vorfallMeldenKnopf(wrap, "arbeitssicherheit"); renderVorfaelle(wrap, "arbeitssicherheit"); return; }
    if(AKTIVE_SUB === "vf-umwelt"){ vorfallMeldenKnopf(wrap, "umwelt"); renderVorfaelle(wrap, "umwelt"); return; }
    if(["terminal", "melden", "pruefen"].includes(AKTIVE_SUB)){ renderEinbettung(wrap, AKTIVE_SUB); return; }
    renderSektion(wrap, AKTIVE_SUB, MEHR_LABEL[AKTIVE_SUB] || "", false); return;
  }
  if(!AKTIVE_SUB){ renderUnterlagen(wrap); return; }
  if(AKTIVE_SUB === "vom-betrieb"){ renderUpload(wrap); return; }
  renderSektion(wrap, AKTIVE_SUB, UL_LABEL[AKTIVE_SUB] || KAT_LABEL[AKTIVE_SUB] || "", false);
  anlagenVerdrahten();
}
/* Browser-Ansicht: Reiter oben, darunter der gewaehlte Unterbereich (wie vor dem 16.09.2026). */
function renderKlassisch(wrap){
  const n = navNormal(AKTIVE_DOM, AKTIVE_SUB); AKTIVE_DOM = n[0]; AKTIVE_SUB = n[1];
  document.body.dataset.seite = AKTIVE_DOM; document.body.dataset.unterseite = AKTIVE_SUB || "";
  renderTabs(); renderSubTabs();
  if(AKTIVE_DOM === "mehr"){
    seitenKopf(wrap);
    if(["terminal", "melden", "pruefen"].includes(AKTIVE_SUB)){ renderEinbettung(wrap, AKTIVE_SUB); return; }
    renderSektion(wrap, AKTIVE_SUB, MEHR_LABEL[AKTIVE_SUB] || "", false); return;
  }
  const doms = verfuegbareDomaenen();
  const dom = doms.find(d => d.key === AKTIVE_DOM) || doms[0];
  const subs = verfuegbareSubs(dom);
  if(!subs.length){ wrap.innerHTML = `<div class="leer">In diesem Bereich sind keine Unterlagen hinterlegt.</div>`; return; }
  const sub = subs.find(s => s.kat === AKTIVE_SUB) || subs[0];
  renderSektion(wrap, sub.kat, KAT_LABEL[sub.kat], subs.length <= 1);
  anlagenVerdrahten();
}
function anlagenVerdrahten(){
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
  /* Filter aus der Adresse (Cockpit-Kachel „Anlagen im Gefahrbereich" → Liste bereits gefiltert) */
  if(HASH_Q && HASH_Q.get("status")){ const sf = $("#statusFilter"); if(sf) sf.value = HASH_Q.get("status"); HASH_Q = null; }
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
    /* Dritte Rolle: die Fachkraft (SiFa/Sibe) des Betriebs darf entscheiden – heute die
       Freigabe der Unterweisungs-Bausteine. Die Geschaeftsfuehrung ('kunde') liest mit.
       Die Rechte haengen serverseitig an portal_ist_fachkraft(); das Flag hier steuert nur,
       welche Knoepfe erscheinen. */
    window.__oakFachkraft = !!(me && me[0] && me[0].rolle === "fachkraft");
    window.__oakName = ADMIN_NAME;
    document.body.classList.toggle("app-modus", IST_APP);   // App: Seitenleiste/Leiste unten; Browser: Reiter
    MITGLIED = (me && me[0]) || null;

    /* Welle 2 – alles parallel, ohne Ballast (qr_svg ist 1 MB und wird hier nie gebraucht) */
    const SPALTEN = "id,kunde,kunde_slug,maschine,maschinen_id,maschinentyp,storage_path,typen,status,updated_at,kategorie,titel,doc_typ,stand,url,sortierung";
    const [rows] = await Promise.all([
      apiGet("/rest/v1/portal_dokumente?select=" + SPALTEN + "&order=kategorie.asc,sortierung.asc,maschine.asc,titel.asc", false),
      ladeVorfaelle(), ladeNachweiseStart(), markeLaden(), meldeTokenLaden()
    ]);
    ALLE = rows || [];
    /* AKTIV ist der Mandant, in dem gearbeitet wird. Fuer Admins der im Umschalter
       gewaehlte Kunde, fuer alle anderen der eigene - sonst schickt das Portal beim
       Anlegen kunde_slug: null und die Zeile wird von RLS abgewiesen. */
    AKTIV = ADMIN ? ([...new Set(ALLE.map(r => r.kunde_slug))][0] || null)
                  : (MITGLIED && MITGLIED.kunde_slug) || null;
    AKTIVE_DOM = null; AKTIVE_SUB = null;
    if(!hashLesen()) AKTIVE_DOM = "start";   // ohne Adresse: die Startseite mit den vier Knoepfen
    setKundeName();
    renderAdminBar();
    renderTabs();
    renderSubTabs();
    renderSektionen();                        // Startseite steht – der Rest kommt im Hintergrund
    hashSetzen(true); PORTAL_BEREIT = true;
    try{ if(sessionStorage.getItem(TERM_SPERRE) === "1") terminalVollbild(); }catch(e){}   // nach Neuladen bleibt das Terminal gesperrt
    /* Welle 3 – im Hintergrund: Freigaben, Energie, Unterweisungs-Details; danach einmal nachzeichnen */
    Promise.all([
      apiGet("/rest/v1/portal_freigabe?select=kunde_slug,maschinen_id,freigegeben_am,freigegeben_von&freigegeben=eq.true", false)
        .then(fgr => { FREIGABE = {}; (fgr||[]).forEach(x=> FREIGABE[(x.kunde_slug||"")+"|"+(x.maschinen_id||"")]=x); }).catch(() => { FREIGABE = {}; }),
      ladeEnergie().catch(() => {}), ladeNachweiseRest().catch(() => {}), ladeUwStart().catch(() => {}), ladeMaengel().catch(() => {})
    ]).then(() => { renderSektionen(); updateWaechterStarten(); });
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
  $("#markeStart").addEventListener("click", ev => { ev.preventDefault(); if(PORTAL_BEREIT) portalGehe("start"); });
  try{ if(localStorage.getItem("oak_portal_sl_schmal") === "1") document.body.classList.add("sl-schmal"); }catch(e){}
  /* Handy: Seitenleiste schliesst bei Tipp daneben */
  document.addEventListener("click", ev => {
    if(document.body.classList.contains("menue-auf") && !ev.target.closest("#seitenleiste") && !ev.target.closest(".tab-i"))
      document.body.classList.remove("menue-auf");
  });

  /* Kiosk-Betrieb (?kiosk=1, gesetzt vom Unterweisungs-Terminal): Das Geraet steht offen in
     der Halle - eine angemeldete Sitzung darf dort nicht stehenbleiben, im Portal liegen
     Gefaehrdungsbeurteilungen, Maengellisten und Nachweise. Nach kurzer Untaetigkeit wird
     darum von selbst abgemeldet. Die Kennung wird gemerkt, damit sie einen Seitenwechsel
     ueberlebt; am Buero-PC (ohne den Parameter) aendert sich nichts. */
  const KIOSK_KEY = "oak_portal_kiosk", KIOSK_MINUTEN = 5;
  try{
    if(new URLSearchParams(location.search).get("kiosk") === "1") sessionStorage.setItem(KIOSK_KEY, "1");
  }catch(e){}
  let kioskIstKiosk = false;
  try{ kioskIstKiosk = sessionStorage.getItem(KIOSK_KEY) === "1"; }catch(e){}
  if(kioskIstKiosk){
    let uhr = null;
    const abmelden = ()=>{ clearSession(); ALLE=[]; zurLogin(); };
    const neuStellen = ()=>{ clearTimeout(uhr); uhr = setTimeout(abmelden, KIOSK_MINUTEN*60000); };
    ["click","keydown","pointerdown","wheel","touchstart"].forEach(ev =>
      document.addEventListener(ev, neuStellen, { passive:true }));
    neuStellen();
  }

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

/* ---- Neue Version live? (16.09.2026) --------------------------------------------------------
   Ein offenes Portal-Fenster (vor allem die installierte App) laeuft sonst mit dem alten Programmstand
   weiter. Alle 30 Sekunden und beim Zurueckkehren ins Fenster wird verglichen, ob index.html eine neuere
   Fassung meldet (der Deploy setzt portal.css?v=<Zeitstempel>). Dann erscheint oben im Kopf der Knopf
   „Aktualisieren" – nichts laedt ungefragt neu, eine halb ausgefuellte Eingabe geht nicht verloren. */
(function(){
  const stil = document.querySelector('link[href*="portal.css"]');
  const meins = stil ? stil.getAttribute("href") : "";
  let gezeigt = false;
  function knopfZeigen(){
    if(gezeigt) return; gezeigt = true;
    updateBannerZeigen("Eine neue Version des Portals ist online.");
  }
  async function versionPruefen(){
    if(!meins || gezeigt) return;
    try{
      const t = await (await fetch("index.html?stand=" + Date.now(), { cache: "no-store" })).text();
      const m = t.match(/href="(portal\.css\?v=[^"]+)"/);
      if(m && m[1] !== meins) knopfZeigen();
    }catch(e){ /* offline – spaeter erneut */ }
  }
  setInterval(versionPruefen, 30000);
  document.addEventListener("visibilitychange", () => { if(!document.hidden) versionPruefen(); });
  window.addEventListener("focus", versionPruefen);
})();

/* ---- Dokumente als Tab im laufenden Programm (Nikolai 17.09.2026) ----------------------------
   In der installierten App oeffnete jeder Dokument-Link (target=_blank) ein zweites Programmfenster.
   Jetzt: Tab-Leiste ueber dem Portal, jeder Tab mit ✕ zum Schliessen, „‹ Portal" fuehrt zurueck.
   Seiten im Tab (viewer/maschine/qr) laden tab.js: kein „← Übersicht"-Knopf, ihre Links werden weitere Tabs. */
const DOK_TABS = []; let DOK_AKTIV = null;
window.portalDokOeffnen = function(url, titel){
  let el = document.getElementById("dokTabs");
  if(!el){
    el = document.createElement("div"); el.id = "dokTabs"; el.className = "dok-tabs";
    el.innerHTML = '<div class="dok-leiste" role="tablist"></div><div class="dok-inhalt"></div>';
    document.body.appendChild(el);
  }
  let tab = DOK_TABS.find(x => x.url === url);
  if(!tab){
    tab = { id: "dok" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), url, titel: (titel || "Dokument").trim() || "Dokument" };
    const f = document.createElement("iframe"); f.src = url; f.title = tab.titel;
    el.querySelector(".dok-inhalt").appendChild(f); tab.frame = f; DOK_TABS.push(tab);
  }
  DOK_AKTIV = tab.id; dokTabsZeichnen();
};
window.portalDokSchliessenAktiv = function(){ if(DOK_AKTIV) dokTabSchliessen(DOK_AKTIV); };
function dokTabSchliessen(id){
  const i = DOK_TABS.findIndex(x => x.id === id); if(i < 0) return;
  DOK_TABS[i].frame.remove(); DOK_TABS.splice(i, 1);
  if(DOK_AKTIV === id) DOK_AKTIV = null;
  dokTabsZeichnen();
}
function dokTabsZeichnen(){
  const el = document.getElementById("dokTabs"); if(!el) return;
  const offen = !!DOK_AKTIV && DOK_TABS.length > 0;
  el.classList.toggle("offen", offen);
  document.documentElement.classList.toggle("dok-tab-offen", offen);
  el.querySelector(".dok-leiste").innerHTML = '<button type="button" class="dok-reiter dok-portal" data-dok="">‹ Zurück zum Portal</button>'
    + DOK_TABS.map(x => `<div class="dok-reiter${x.id === DOK_AKTIV ? " aktiv" : ""}" data-dok="${x.id}" role="tab" title="${esc(x.titel)}"><span>${esc(x.titel)}</span>`
      + `<button type="button" class="dok-zu" data-zu="${x.id}" aria-label="Tab schließen">✕</button></div>`).join("")
    + (offen ? '<button type="button" class="dok-schliessen" data-zu-aktiv>Schließen</button>' : "");
  DOK_TABS.forEach(x => { x.frame.hidden = x.id !== DOK_AKTIV; });
  el.querySelectorAll("[data-dok]").forEach(b => b.addEventListener("click", () => { DOK_AKTIV = b.dataset.dok || null; dokTabsZeichnen(); }));
  el.querySelectorAll("[data-zu]").forEach(b => b.addEventListener("click", ev => { ev.stopPropagation(); dokTabSchliessen(b.dataset.zu); }));
  const zu = el.querySelector("[data-zu-aktiv]"); if(zu) zu.addEventListener("click", () => dokTabSchliessen(DOK_AKTIV));
  /* Zurueck im Portal, aber noch Dokumente offen: dieselben Tabs unten als Leiste – anklicken wechselt, ✕ schliesst */
  let dock = document.getElementById("dokDock");
  if(!offen && DOK_TABS.length){
    if(!dock){ dock = document.createElement("div"); dock.id = "dokDock"; dock.className = "dok-dock"; document.body.appendChild(dock); }
    dock.innerHTML = '<span class="dok-dock-titel">Offene Dokumente</span>' + DOK_TABS.map(x => `<div class="dok-reiter" data-dok="${x.id}" title="${esc(x.titel)}"><span>${esc(x.titel)}</span>`
      + `<button type="button" class="dok-zu" data-zu="${x.id}" aria-label="Schließen">✕</button></div>`).join("");
    dock.querySelectorAll("[data-dok]").forEach(b => b.addEventListener("click", () => { DOK_AKTIV = b.dataset.dok; dokTabsZeichnen(); }));
    dock.querySelectorAll("[data-zu]").forEach(b => b.addEventListener("click", ev => { ev.stopPropagation(); dokTabSchliessen(b.dataset.zu); }));
  } else if(dock) dock.remove();
}
if(IST_APP) document.addEventListener("click", ev => {
  const a = ev.target.closest && ev.target.closest('a[target="_blank"]'); if(!a) return;
  let u; try{ u = new URL(a.href, location.href); }catch(e){ return; }
  if(u.origin !== location.origin || !/\/portal\/(viewer|maschine|qr)\.html$/.test(u.pathname)) return;
  ev.preventDefault(); ev.stopPropagation();
  const p = u.searchParams;
  window.portalDokOeffnen(u.pathname.split("/").pop() + u.search, p.get("t") || p.get("m") || a.textContent);
}, true);

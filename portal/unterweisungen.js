/* OAK Kundenportal — Sektion „Unterweisungen": Nachweise aus dem Unterweisungs-Terminal.
   Die Nachweise kommen ohne Login vom Terminal (Funktion unterweisung_nachweis, Geräte-Token);
   gelesen wird je Kunde über RLS. Der Arbeitgeber ist Verantwortlicher, OAK verarbeitet im Auftrag.

   Bewusst OHNE Punktestand: gespeichert sind Name, Rolle, Datum, Module und bestanden ja/nein
   (Datenminimierung). § 12 ArbSchG verlangt den Nachweis der Unterweisung – keine
   Leistungsauswertung. Deshalb zeigt diese Sektion auch keine Prozentwerte an. */
"use strict";

let NACHWEISE = [];
let BAUSTEINE = [];
let UW_P = [], UW_R = [];        // Beschäftigte und Gruppen des Betriebs (Abschnitt „Wer ist fällig")
let UW_MELDUNG = "";            // Bestätigung nach einer Aktion, einmal angezeigt
let UW_TOK = [];                // Gerätecodes des Betriebs (Knopf „Terminal starten")
/* Jährliche Wiederholung: DGUV Vorschrift 1 § 4 – „mindestens einmal jährlich". Wir warnen
   ab 11 Monaten, damit die Wiederholung planbar ist und nicht erst am Stichtag auffällt. */
const UW_FAELLIG_TAGE = 365, UW_WARNUNG_TAGE = 335;

/* Spalten einzeln statt select=*: sonst holt der Browser die Unterschrift (Bild als Base64)
   und den User-Agent mit, obwohl beides hier nie gezeigt wird. Was nicht gebraucht wird,
   soll auch nicht über die Leitung gehen. */
const UW_SPALTEN = "id,kunde_slug,mitarbeiter_name,funktion,bereich,module,unterweisung," +
                   "bestanden,bestaetigung,config_version,created_at";

/* Pflichtteil fuer die Startseite (Nachweise, Beschaeftigte, Geraetecode) – der Rest kommt im Hintergrund. */
async function ladeNachweiseStart(){
  try{
    NACHWEISE = await apiGet("/rest/v1/unterweisungsnachweise?select=" + UW_SPALTEN +
                             "&order=created_at.desc", false) || [];
  }catch(e){ NACHWEISE = []; }
  try{ UW_P = await apiGet("/rest/v1/uw_person?select=id,name,status,kunde_slug,uw_person_rolle(rolle_id)&order=name.asc", false) || []; }catch(e){ UW_P = []; }
  try{ UW_TOK = await apiGet("/rest/v1/portal_terminal_token?select=token,kunde_slug,bezeichnung&aktiv=is.true", false) || []; }catch(e){ UW_TOK = []; }
}
async function ladeNachweiseRest(){
  try{
    BAUSTEINE = await apiGet("/rest/v1/portal_uw_baustein?select=*&order=sortierung.asc,gueltig_ab.desc",
                             false) || [];
  }catch(e){ BAUSTEINE = []; }
  try{ UW_R = await apiGet("/rest/v1/uw_rolle?select=id,name,typ,status,kunde_slug&order=name.asc", false) || []; }catch(e){ UW_R = []; }
  await ladeFolien();
}
async function ladeNachweise(){ await ladeNachweiseStart(); await ladeNachweiseRest(); }

/* Darf freigeben: OAK-Admin oder die Fachkraft des Betriebs. Die Geschäftsführung liest mit,
   entscheidet aber nicht über Unterweisungsinhalte. */
function uwDarfFreigeben(){ return !!(typeof ADMIN !== "undefined" && ADMIN) || !!window.__oakFachkraft; }
function uwSichtbar(){ return AKTIV ? NACHWEISE.filter(n => n.kunde_slug === AKTIV) : NACHWEISE; }
function uwDatum(s){
  if(!s) return "—";
  const t = String(s).slice(0, 10).split("-");
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : s;
}
function uwTageSeit(s){
  if(!s) return null;
  return Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
}
/* Je Person der JÜNGSTE Nachweis – das ist der Stand, auf den es ankommt. */
function uwJeMitarbeiter(rows){
  const map = new Map();
  rows.forEach(n => {
    const k = (n.mitarbeiter_name || "").trim().toLowerCase();
    if(!k) return;
    const alt = map.get(k);
    if(!alt || new Date(n.created_at) > new Date(alt.created_at)) map.set(k, n);
  });
  return [...map.values()].sort((a, b) => (a.mitarbeiter_name || "").localeCompare(b.mitarbeiter_name || "", "de"));
}
function uwStatus(n){
  const t = uwTageSeit(n.created_at);
  if(t === null) return { klasse: "grau", text: "—" };
  if(t >= UW_FAELLIG_TAGE) return { klasse: "kritisch", text: "überfällig" };
  if(t >= UW_WARNUNG_TAGE) return { klasse: "warnung", text: "fällig in " + (UW_FAELLIG_TAGE - t) + " Tagen" };
  return { klasse: "gut", text: "gültig" };
}
/* Modul-Kuerzel aus dem Terminal (grund, spritzguss …) -> lesbarer Titel fuer Nachweis und Excel */
function uwModulTitel(k){
  const bu = (typeof UW_BUCHUNG !== "undefined" ? UW_BUCHUNG : []).find(x => x.kiosk_modul === k || x.thema === k);
  const m = (typeof UW_MODULE !== "undefined" ? UW_MODULE : []).find(x => x.thema === (bu ? bu.thema : k));
  return (m && m.titel) || ({ grund: "Allgemeine Grundunterweisung", spritzguss: "Sicher an der Spritzgießmaschine", leitern: "Leitern & Tritte",
    flurfoerder: "Flurförderzeuge", kran: "Hallenkran und Anschlagen", bildschirm: "Gesund am Bildschirm", extern: "Sicher auf dem WIBO-Gelände" })[k] || k;
}
function uwModule(n){
  const m = Array.isArray(n.module) ? n.module : (n.unterweisung ? String(n.unterweisung).split(/,\s*/) : []);
  return m.filter(Boolean).map(uwModulTitel);
}
function uwCsv(rows){
  const kopf = ["Datum", "Name", "Rolle", "Bereich", "Module", "bestanden", "bestätigt", "Fassung"];
  const zeilen = rows.map(n => [
    uwDatum(n.created_at), n.mitarbeiter_name || "", n.funktion || "", n.bereich || "",
    uwModule(n).join(" | "), n.bestanden ? "ja" : "nein", n.bestaetigung ? "ja" : "nein",
    n.config_version || "",
  ]);
  return [kopf, ...zeilen].map(z => z.map(w => `"${String(w).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
function uwExport(){
  const rows = uwSichtbar();
  if(!rows.length) return;
  const blob = new Blob(["﻿" + uwCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Unterweisungsnachweise_" + (AKTIV || "alle") + "_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---- Bausteine: was seit der letzten Unterweisung dazugekommen ist -------------------
   Ein gemeldeter Vorfall und eine neue Betriebsanweisung sind genau der Stoff, der in die
   nächste Unterweisung gehört – bisher musste man ihn von Hand übertragen. Das Portal legt
   ihn jetzt als Vorschlag an; erst nach Freigabe zeigt ihn das Terminal.
   Bewusst mit Freigabe: die Unterweisung dokumentiert eine Pflicht des Unternehmers
   (§ 12 ArbSchG) – ungeprüfter Text darf dort nicht vor die Beschäftigten. */
function uwBausteineSichtbar(){
  return AKTIV ? BAUSTEINE.filter(b => b.kunde_slug === AKTIV) : BAUSTEINE;
}
const UW_ART_LABEL = { vorfall: "Vorfall", dokument: "Dokument", text: "Hinweis" };

async function uwBausteinSetzen(id, status){
  try{
    await apiSend("PATCH", "/rest/v1/portal_uw_baustein?id=eq." + encodeURIComponent(id), {
      status: status,
      freigegeben_am: status === "freigegeben" ? new Date().toISOString() : null,
      freigegeben_von: status === "freigegeben" ? (window.__oakName || "Portal") : null,
    });
    const b = BAUSTEINE.find(x => x.id === id);
    if(b) b.status = status;
    renderSektionen();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
}

async function uwAbgleichen(btn){
  if(btn){ btn.disabled = true; btn.textContent = "suche …"; }
  try{
    const n = await apiSend("POST", "/rest/v1/rpc/uw_bausteine_abgleich", {});
    await ladeNachweise();
    renderSektionen();
    if(!n) alert("Nichts Neues – es liegen keine unberücksichtigten Vorfälle oder Betriebsanweisungen vor.");
  }catch(e){
    alert("Abgleich nicht möglich: " + (e.message || e));
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = "Nach Neuem suchen"; }
  }
}

function renderBausteine(sec){
  const alle = uwBausteineSichtbar();
  const offen = alle.filter(b => b.status === "vorgeschlagen");
  const frei  = alle.filter(b => b.status === "freigegeben");
  const darf  = uwDarfFreigeben();
  if(!alle.length && !darf) return "";

  const zeile = b => {
    const knopf = darf
      ? (b.status === "vorgeschlagen"
          ? `<button class="btn-klein" data-frei="${esc(b.id)}">freigeben</button>
             <button class="btn-klein" data-verw="${esc(b.id)}">verwerfen</button>`
          : `<button class="btn-klein" data-verw="${esc(b.id)}">zurückziehen</button>`)
      : "";
    return `<tr>
      <td><span class="uw-badge uw-${b.status === "freigegeben" ? "gut" : "warnung"}">${
            esc(b.status === "freigegeben" ? "am Terminal" : "Vorschlag")}</span></td>
      <td><b>${esc(b.titel)}</b><div class="ck-hinweis">${esc(UW_ART_LABEL[b.art] || b.art)} · ab ${esc(uwDatum(b.gueltig_ab))}</div></td>
      <td class="uw-mod">${esc((b.text || "").slice(0, 180))}</td>
      <td>${knopf}</td>
    </tr>`;
  };

  const inhalt = alle.length
    ? `<table class="uw-tab"><thead><tr><th>Stand</th><th>Thema</th><th>Inhalt</th><th></th></tr></thead>
         <tbody>${offen.concat(frei).map(zeile).join("")}</tbody></table>`
    : `<div class="ck-fuss">Noch nichts vorgemerkt. „Nach Neuem suchen" prüft die gemeldeten
         Vorfälle und die Betriebsanweisungen der letzten zwölf Monate.</div>`;

  return `<div class="uw-block">
    <div class="sek-kopf"><h2>Was ist neu</h2>
      ${darf ? '<button class="btn-klein" id="uwSuchen">Nach Neuem suchen</button>' : ""}</div>
    ${inhalt}
    <div class="ck-fuss">Freigegebene Punkte erscheinen am Terminal <b>vor</b> den Modulen und
      werden im Nachweis mitgeführt. Bis zur Freigabe sieht sie niemand außer Ihnen –
      der Inhalt einer Unterweisung bleibt Sache des Unternehmers (§ 12 ArbSchG).</div>
  </div>`;
}

/* ======================= Seite „Unterweisungen" (Arbeitssicherheit) =======================
   Eine Seite, drei Abschnitte, je Abschnitt eine klare Handlung – für Leute, die das Portal
   zum ersten Mal sehen:
   1. Unterweisungen: die Module zum Öffnen (Version 1.0 = bewährte Module, 2.0 = neue).
   2. Wer ist fällig: die Beschäftigten mit Stand – hier legt der Schichtführer Mitarbeiter an.
   3. Nachweise: was am Terminal abgeschlossen wurde, als Tabelle zum Herunterladen.
   Der Stand je Person wird über den Namen ermittelt (so, wie er am Terminal eingetippt wurde). */
function uwPersonen(){ return (AKTIV ? UW_P.filter(p => p.kunde_slug === AKTIV) : UW_P).filter(p => p.status !== "archiviert"); }
function uwGruppen(){ return (AKTIV ? UW_R.filter(r => r.kunde_slug === AKTIV) : UW_R).filter(r => r.status !== "archiviert" && r.typ !== "besucher"); }
function uwNorm(s){ return String(s || "").toLowerCase().replace(/\s+/g, " ").trim().split(" ").sort().join(" "); }
function uwLetzterNachweis(name){
  const k = uwNorm(name); let best = null;
  uwSichtbar().forEach(n => { if(uwNorm(n.mitarbeiter_name) === k && (!best || new Date(n.created_at) > new Date(best.created_at))) best = n; });
  return best;
}
function uwGruppenName(p){
  return (p.uw_person_rolle || []).map(x => (UW_R.find(r => r.id === x.rolle_id) || {}).name).filter(Boolean).join(", ");
}
/* Ampel-Rang fuer die Sortierung. Heisst bewusst NICHT UW_RANG: den Namen belegt bereits
   unterweisungen-start.js (Faelligkeits-Rang). Zwei gleichnamige Top-Level-Konstanten sind im
   Browser ein SyntaxError - am 16.09.2026 lief deshalb die Startdatei nicht mehr
   ("ladeUwStart is not defined"), das ganze Portal blieb bei "laedt ...". */
const UW_AMPEL_RANG = { kritisch: 0, warnung: 1, grau: 2, gut: 3 };

function uwDokTabelle(rows){
  if(!rows.length) return `<div class="ck-fuss">Noch keine Unterweisungen hinterlegt.</div>`;
  return `<table><thead><tr><th>Unterweisung</th><th style="width:130px">Art</th><th style="width:120px">Stand</th><th style="width:120px"></th></tr></thead>
    <tbody>${rows.map(docZeile).join("")}</tbody></table>`;
}

function renderUnterweisungen(wrap){
  const rows = uwSichtbar();
  const meld = UW_MELDUNG ? `<div class="uw-meld">${esc(UW_MELDUNG)}</div>` : "";
  UW_MELDUNG = "";
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);

  /* 1. Der eine Knopf, den der Anwender braucht */
  const tok = (UW_TOK.find(x => x.kunde_slug === AKTIV) || UW_TOK[0] || {}).token || "";
  const sekStart = document.createElement("section"); sekStart.className = "sektion uw-hero";
  sekStart.innerHTML = `${meld}
    ${tok ? `<a class="uw-start" href="#mehr/terminal">Unterweisungs-Terminal starten</a>`
          : `<div class="uw-start uw-start-aus">Terminal noch nicht eingerichtet – Gerätecode bei OAK engineering anfordern.</div>`}
    <p class="uw-erkl uw-hero-text">Am Terminal: Name eingeben, Rolle wählen, Module durchgehen, unterschreiben.
      Der Nachweis landet automatisch hier im Portal.</p>`;
  wrap.appendChild(sekStart);

  /* 2. Wer ist fällig – EINE Liste (Nikolai 16.09.: nicht doppelt unter „Nachweise"): je Person Stand und
        der letzte Nachweis als PDF mit Unterschrift. Alle Nachweise stehen im Excel-Export. */
  const pers = uwPersonen();
  const zusatz = uwJeMitarbeiter(rows).filter(n => !pers.some(p => uwNorm(p.name) === uwNorm(n.mitarbeiter_name)));
  const pdfKnopf = n => (n && n.id) ? `<button class="btn-klein" data-uwpdf="${esc(n.id)}">Nachweis (PDF)</button>` : "";
  const zeilen = pers.map(p => {
    const n = uwLetzterNachweis(p.name);
    const st = n ? uwStatus(n) : { klasse: "kritisch", text: "noch keine Unterweisung" };
    return { rang: (UW_AMPEL_RANG[st.klasse] ?? 2), html: `<tr data-name="${esc(p.name.toLowerCase())}" data-gruppe="${esc(uwGruppenName(p) || "")}" data-stand="${n ? st.klasse : "kritisch"}">
      <td><b>${esc(p.name)}</b></td><td>${esc(uwGruppenName(p) || "—")}</td>
      <td>${n ? uwDatum(n.created_at) : "—"}</td>
      <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
      <td class="uw-knoepfe">${pdfKnopf(n)}<button class="btn-klein" data-pedit="${esc(p.id)}">ändern</button></td></tr>` };
  }).concat(zusatz.map(n => {
    const st = uwStatus(n);
    return { rang: (UW_AMPEL_RANG[st.klasse] ?? 2), html: `<tr data-name="${esc((n.mitarbeiter_name || "").toLowerCase())}" data-gruppe="${esc(n.funktion || "")}" data-stand="${st.klasse}">
      <td><b>${esc(n.mitarbeiter_name)}</b></td>
      <td>${esc(n.funktion || "—")}</td><td>${uwDatum(n.created_at)}</td>
      <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
      <td class="uw-knoepfe">${pdfKnopf(n)}</td></tr>` };
  })).sort((a, b) => a.rang - b.rang);
  const faellig = zeilen.filter(z => z.rang <= 1).length;
  const sekPers = document.createElement("section"); sekPers.className = "sektion";
  sekPers.innerHTML = `
    <div class="sek-kopf"><h2>Wer ist fällig</h2>
      <span class="zaehler">${zeilen.length ? (faellig ? faellig + " fällig" : "alle aktuell") : ""}</span>
      <span class="uw-kopf-knoepfe">${rows.length ? '<button class="btn sek" id="uwCsvAlle">Excel-Export</button>' : ""}
        <button class="btn sek" id="uwPersNeu">Mitarbeiter anlegen</button></span></div>
    <div id="uwPersForm"></div>
    ${zeilen.length ? `<div class="mg-filter uw-filter">
        <input type="search" class="uw-suche" id="uwfName" placeholder="Name suchen" autocomplete="off">
        <select class="uw-fassung" id="uwfGruppe"><option value="">Alle Gruppen</option>${[...new Set(pers.map(p => uwGruppenName(p)).concat(zusatz.map(n => n.funktion)).filter(Boolean).flatMap(g => g.split(", ")))].sort().map(g => `<option>${esc(g)}</option>`).join("")}</select>
        <select class="uw-fassung" id="uwfStand"><option value="">Alle</option><option value="faellig">fällig oder überfällig</option><option value="gut">gültig</option></select>
        <span class="uw-leise" id="uwfZahl"></span></div>` : ""}
    ${zeilen.length ? `<div class="tabelle-wrap"><table class="uw-tab" id="uwListe">
      <thead><tr><th>Name</th><th>Gruppe</th><th>zuletzt unterwiesen</th><th>Stand</th><th></th></tr></thead>
      <tbody>${zeilen.map(z => z.html).join("")}</tbody></table></div>`
    : `<div class="ck-fuss">Noch niemand eingetragen. <b>„Mitarbeiter anlegen"</b> – oder die Beschäftigten tragen sich am
        Terminal selbst ein und erscheinen dann hier.</div>`}`;
  wrap.appendChild(sekPers);
  sekPers.querySelector("#uwPersNeu").addEventListener("click", () => uwPersonForm(null));
  sekPers.querySelectorAll("[data-pedit]").forEach(b => b.addEventListener("click", () => uwPersonForm(UW_P.find(p => p.id === b.dataset.pedit))));
  sekPers.querySelectorAll("[data-uwpdf]").forEach(b => b.addEventListener("click", () => uwNachweisPdf(b.dataset.uwpdf)));
  const btnAlle = sekPers.querySelector("#uwCsvAlle"); if(btnAlle) btnAlle.addEventListener("click", uwExport);
  /* Filter: Name, Gruppe, Stand – direkt in der Liste, ohne Neuladen */
  const filtern = () => {
    const q = (sekPers.querySelector("#uwfName") || {}).value || "", g = (sekPers.querySelector("#uwfGruppe") || {}).value || "", s = (sekPers.querySelector("#uwfStand") || {}).value || "";
    let n = 0;
    sekPers.querySelectorAll("#uwListe tbody tr").forEach(tr => {
      const ok = (!q || tr.dataset.name.includes(q.toLowerCase().trim())) && (!g || (", " + tr.dataset.gruppe + ",").includes(", " + g + ","))
        && (!s || (s === "gut" ? tr.dataset.stand === "gut" : tr.dataset.stand !== "gut"));
      tr.hidden = !ok; if(ok) n++;
    });
    const z = sekPers.querySelector("#uwfZahl"); if(z) z.textContent = n + " von " + zeilen.length;
  };
  ["#uwfName", "#uwfGruppe", "#uwfStand"].forEach(id => { const el = sekPers.querySelector(id); if(el) el.addEventListener(id === "#uwfName" ? "input" : "change", filtern); });
  filtern();

  /* 3. Versionsarchiv (eingeklappt, nur Admin/Fachkraft): je Thema Version 1.0 und 2.0 + Auswahl fürs Terminal */
  const docs = (typeof katRows === "function") ? katRows("unterweisungen") : [];
  const base = r => String(r.storage_path || "").split("/").pop();
  const buchungen = (typeof UW_BUCHUNG !== "undefined" ? UW_BUCHUNG : []).filter(x => x.kunde_slug === AKTIV && x.aktiv);
  const modulTitel = th => ((typeof UW_MODULE !== "undefined" && UW_MODULE.find(m => m.thema === th)) || {}).titel || th;
  const reihe = th => ((typeof UW_MODULE !== "undefined" && UW_MODULE.find(m => m.thema === th)) || {}).reihenfolge || 99;
  const benutzt = new Set();
  const oeffnen = (d, titel) => { if(!d) return '<span class="uw-leise">—</span>'; benutzt.add(d);
    return `<a class="btn-klein" href="${viewerUrl(d.doc_typ, d.storage_path, d.titel)}" target="_blank" rel="noopener">Öffnen</a>`
      + (istAdmin ? ` <button type="button" class="btn-klein" data-uwtext="${esc(d.storage_path)}" data-titel="${esc(titel)}">Text ändern</button>` : ""); };
  const archivZeilen = buchungen.slice().sort((x, y) => reihe(x.thema) - reihe(y.thema)).map(bu => {
    const d1 = bu.datei_v1 ? docs.find(r => base(r) === bu.datei_v1) : null;
    const d2 = docs.find(r => base(r) === bu.thema + ".html");
    const f = bu.fassung === 2 ? 2 : 1;
    const wahl = istAdmin
      ? `<div class="uw-pills" data-thema="${esc(bu.thema)}">
           <button type="button" class="uw-pill${f === 1 ? " aktiv" : ""}" data-f="1"${d1 ? "" : " disabled"}>1.0</button>
           <button type="button" class="uw-pill${f === 2 ? " aktiv" : ""}" data-f="2"${d2 ? "" : " disabled"}>2.0</button></div>`
      : `<span class="uw-badge uw-gut">Version ${f}.0</span>`;
    return `<tr><td><b>${esc(modulTitel(bu.thema))}</b></td><td>${oeffnen(d1, modulTitel(bu.thema) + " · Version 1.0")}</td><td>${oeffnen(d2, modulTitel(bu.thema) + " · Version 2.0")}</td><td>${wahl}</td></tr>`;
  }).join("");
  const weitere = docs.filter(d => !benutzt.has(d));
  if(!(istAdmin || window.__oakFachkraft)) return;   // Erweiterte Funktionen nur fuer Admin/Fachkraft
  const sekMehr = document.createElement("section"); sekMehr.className = "sektion uw-mehr-sektion";
  sekMehr.innerHTML = `<details class="uw-mehr">
    <summary>Erweiterte Funktionen <span class="uw-leise">Versionsarchiv · Fassung je Modul</span></summary>
    <div class="uw-mehr-inhalt">
      <div class="sek-kopf"><h3 class="uw-h3">Versionsarchiv</h3>
        <span class="uw-leise">${istAdmin ? "Auswahl = läuft am Terminal, sofort wirksam" : "hervorgehoben = läuft am Terminal"}</span></div>
      <div class="tabelle-wrap"><table class="uw-tab uw-archiv">
        <thead><tr><th>Thema</th><th>Version 1.0</th><th>Version 2.0</th><th>Am Terminal</th></tr></thead>
        <tbody>${archivZeilen || '<tr><td colspan="4" class="uw-leise">Noch keine Module freigeschaltet.</td></tr>'}</tbody></table></div>
      ${weitere.length ? `<div class="uw-leise" style="margin:10px 0 4px">Weitere Unterlagen</div>${uwDokTabelle(weitere)}` : ""}
    </div></details>`;
  wrap.appendChild(sekMehr);
  sekMehr.querySelectorAll("[data-uwtext]").forEach(b => b.addEventListener("click", () => uwTextDialog(b.dataset.uwtext, b.dataset.titel)));
  sekMehr.querySelectorAll(".uw-pills .uw-pill").forEach(p => p.addEventListener("click", async () => {
    const th = p.closest(".uw-pills").dataset.thema, f = parseInt(p.dataset.f, 10);
    const bu = buchungen.find(x => x.thema === th); if(!bu || (bu.fassung === 2 ? 2 : 1) === f) return;
    try{
      await apiSend("PATCH", "/rest/v1/uw_buchung?kunde_slug=eq." + encodeURIComponent(AKTIV) + "&thema=eq." + encodeURIComponent(th), { fassung: f }, "return=minimal");
      bu.fassung = f;
      UW_MELDUNG = modulTitel(th) + " läuft am Terminal jetzt in Version " + f + ".0.";
      renderSektionen();
      const d = document.querySelector(".uw-mehr"); if(d) d.open = true;
    }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
  }));
}

/* ---- Nachweis als PDF (Nikolai 16.09.2026) -------------------------------------------------
   Druckansicht im Layout des Betriebs mit Unterschrift aus dem Terminal; „Als PDF speichern" im Druckdialog.
   Die Unterschrift wird erst hier geladen (nicht mit der Liste – Datensparsamkeit, Ladezeit). */
async function uwNachweisPdf(id){
  const n = uwSichtbar().find(x => x.id === id); if(!n) return;
  const w = window.open("", "_blank");
  if(!w){ alert("Bitte Pop-up-Fenster für das Kundenportal erlauben."); return; }
  w.document.write('<p style="font-family:sans-serif;padding:20px">Nachweis wird geladen …</p>');
  let voll = {};
  try{ const r = await apiGet("/rest/v1/unterweisungsnachweise?select=unterschrift,nachfrage,praxis_von,praxis_am&id=eq." + encodeURIComponent(id), false); voll = (r && r[0]) || {}; }catch(e){}
  const m = (window.OAK_MARKE && OAK_MARKE.aktuell) || {};
  const farbe = /^#[0-9a-fA-F]{3,8}$/.test(m.farbe || "") ? m.farbe : "#2D6A4F";
  const logo = m.logo ? new URL(m.logo, location.href).href : new URL("../assets/oak-logo.png", location.href).href;
  const kunde = ((typeof ALLE !== "undefined" ? ALLE : []).find(x => x.kunde_slug === n.kunde_slug) || {}).kunde || n.kunde_slug || "";
  const sig = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(voll.unterschrift || "") ? voll.unterschrift : "";
  const d = new Date(n.created_at);
  const wann = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  const module = uwModule(n);
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Unterweisungsnachweis ${esc(n.mitarbeiter_name || "")} ${esc(uwDatum(n.created_at))}</title>
<style>
@page{size:A4;margin:18mm 16mm}
body{font-family:"Segoe UI",Arial,sans-serif;color:#1d2939;margin:0;font-size:12.5pt}
.kopf{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${farbe};padding-bottom:10px;margin-bottom:18px}
.kopf img{height:56px;max-width:220px;object-fit:contain}
h1{font-size:20pt;margin:0;color:${farbe}}
.unter{font-size:10pt;color:#667085;margin-top:2px}
table{width:100%;border-collapse:collapse;margin:0 0 16px}
td{border:1px solid #d0d5dd;padding:8px 10px;vertical-align:top}
td.k{width:34%;background:#f5f7fa;font-weight:600}
ul{margin:0;padding-left:18px}
.ok{color:#1e7b34;font-weight:700}.nein{color:#b42318;font-weight:700}
.sig{margin-top:26px;width:60%}
.sig img{max-width:100%;height:110px;object-fit:contain;display:block}
.sig .linie{border-top:1px solid #1d2939;padding-top:4px;font-size:10pt;color:#344054}
.fuss{margin-top:28px;font-size:9pt;color:#667085;line-height:1.5}
</style></head><body onload="setTimeout(function(){window.print()},400)">
<div class="kopf"><div><h1>Nachweis über die Unterweisung</h1><div class="unter">${esc(kunde)}</div></div><img src="${esc(logo)}" alt=""></div>
<table>
<tr><td class="k">Name</td><td>${esc(n.mitarbeiter_name || "—")}</td></tr>
<tr><td class="k">Rolle / Tätigkeit</td><td>${esc(n.funktion || "—")}</td></tr>
${n.bereich ? `<tr><td class="k">Bereich</td><td>${esc(n.bereich)}</td></tr>` : ""}
<tr><td class="k">Datum und Uhrzeit</td><td>${esc(wann)}</td></tr>
<tr><td class="k">Unterweisungsinhalte</td><td>${module.length ? "<ul>" + module.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "—"}</td></tr>
<tr><td class="k">Verständnisfragen</td><td>${n.bestanden ? '<span class="ok">bestanden</span>' : '<span class="nein">nicht bestanden</span>'}</td></tr>
<tr><td class="k">Bestätigung</td><td>${n.bestaetigung ? "Die unterwiesene Person hat bestätigt, die Inhalte verstanden zu haben und sie zu beachten." : "nicht bestätigt"}</td></tr>
${voll.nachfrage ? `<tr><td class="k">Rückfrage</td><td>${esc(voll.nachfrage)}</td></tr>` : ""}
${voll.praxis_von ? `<tr><td class="k">Praktische Unterweisung</td><td>${esc(voll.praxis_von)}${voll.praxis_am ? " am " + esc(uwDatum(voll.praxis_am)) : ""}</td></tr>` : ""}
</table>
<div class="sig">${sig ? `<img src="${sig}" alt="Unterschrift">` : '<div style="height:110px"></div>'}<div class="linie">Unterschrift der unterwiesenen Person${sig ? " (elektronisch am Terminal geleistet)" : ""}</div></div>
<div class="fuss">Rechtsgrundlage: § 12 Arbeitsschutzgesetz, § 4 DGUV Vorschrift 1 (Unterweisung vor Aufnahme der Tätigkeit und mindestens einmal jährlich).<br>
Erfasst am Unterweisungs-Terminal, gespeichert im Kundenportal von OAK engineering${n.config_version ? " · Fassung " + esc(n.config_version) : ""} · Druck am ${esc(new Date().toLocaleDateString("de-DE"))}.</div>
</body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}

/* ---- Text in einem Modul ändern (nur Admin, Nikolai 16.09.2026) ------------------------------
   Suchen und Ersetzen im Modul (Datei im Kundenportal). Vor dem Speichern wird die bisherige Fassung unter
   <betrieb>/unterweisungen/_versionen/ gesichert. Das Terminal zeigt die Änderung beim nächsten Modulstart.
   Hinweis: Die lokale Vorlage im Kundenordner ändert sich dadurch nicht. */
function uwTextVarianten(s){
  const ent = { "ä":"&auml;", "ö":"&ouml;", "ü":"&uuml;", "Ä":"&Auml;", "Ö":"&Ouml;", "Ü":"&Uuml;", "ß":"&szlig;" };
  const html = s.replace(/[äöüÄÖÜß]/g, c => ent[c]);
  const uni = s.replace(/[^\x00-\x7f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return [[s, x => x], [html, x => x.replace(/[äöüÄÖÜß]/g, c => ent[c])], [uni, x => x.replace(/[^\x00-\x7f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))]];
}
async function uwTextDialog(pfad, titel){
  if(!(typeof ADMIN !== "undefined" && ADMIN)) return;
  let dlg = document.getElementById("uwTextDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "uwTextDlg"; dlg.className = "pw-dlg mg-dlg mg-edit"; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog">
      <h3>Text ändern</h3>
      <p class="pw-hint"><b>${esc(titel || "")}</b></p>
      <label>Suchen<input type="text" id="uwtSuche" placeholder="Wort oder Satz genau wie in der Folie" autocomplete="off"></label>
      <div class="uwt-treffer" id="uwtTreffer"><span class="uw-leise">Modul wird geladen …</span></div>
      <label>Ersetzen durch<textarea id="uwtNeu" rows="3"></textarea></label>
      <p class="pw-hint">Jede Stelle mit genau diesem Text wird ersetzt. Die bisherige Fassung wird vorher gesichert.</p>
      <p class="pw-msg" id="uwtMsg"></p>
      <div class="pw-akt"><button type="button" class="btn sek" id="uwtZu">Schließen</button><button type="submit" class="btn">Ersetzen und speichern</button></div>
    </form>`;
  dlg.showModal();
  const $t = s => dlg.querySelector(s), msg = $t("#uwtMsg"), treffer = $t("#uwtTreffer");
  $t("#uwtZu").addEventListener("click", () => dlg.close());
  let html = "";
  try{ html = await apiGet(storagePfad(pfad), true); treffer.innerHTML = '<span class="uw-leise">Suchbegriff eingeben.</span>'; }
  catch(e){ treffer.textContent = "Modul konnte nicht geladen werden: " + (e.message || e); return; }
  let wahl = null;
  const suchen = () => {
    const q = $t("#uwtSuche").value; wahl = null; treffer.textContent = "";
    if(q.length < 3){ treffer.innerHTML = '<span class="uw-leise">Mindestens 3 Zeichen.</span>'; return; }
    for(const [v, kod] of uwTextVarianten(q)){
      const anzahl = html.split(v).length - 1;
      if(anzahl){ wahl = { v, kod, anzahl };
        const kopf = document.createElement("div"); kopf.className = "uw-leise"; kopf.textContent = anzahl + (anzahl === 1 ? " Stelle gefunden" : " Stellen gefunden") + " (DE und ggf. weitere Stellen im Modul):";
        treffer.appendChild(kopf);
        let pos = -1;
        for(let i = 0; i < Math.min(anzahl, 4); i++){
          pos = html.indexOf(v, pos + 1);
          const z = document.createElement("div"); z.className = "uwt-stelle";
          const vor = html.slice(Math.max(0, pos - 70), pos).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
          const nach = html.slice(pos + v.length, pos + v.length + 70).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
          const b = document.createElement("b"); b.textContent = q;
          z.append("… " + vor, b, nach + " …"); treffer.appendChild(z);
        }
        return;
      }
    }
    treffer.innerHTML = '<span class="uw-leise">Nicht gefunden – bitte den Text genau so eingeben, wie er in der Folie steht (kürzeren Ausschnitt versuchen).</span>';
  };
  $t("#uwtSuche").addEventListener("input", suchen);
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); msg.className = "pw-msg";
    const neuText = $t("#uwtNeu").value;
    if(!wahl){ msg.textContent = "Erst einen Text suchen, der im Modul vorkommt."; msg.classList.add("fehler"); return; }
    if(!neuText.trim()){ msg.textContent = "Bitte den neuen Text eintragen."; msg.classList.add("fehler"); return; }
    if(!confirm(wahl.anzahl + " Stelle(n) ersetzen und speichern?")) return;
    msg.textContent = "Wird gespeichert …";
    try{
      const t = await token(), jetzt = Date.now();
      const teile = pfad.split("/"); const datei = teile.pop();
      const sicherung = teile.join("/") + "/_versionen/" + datei.replace(/\.html$/i, "") + "-" + jetzt + ".html";
      const hoch = async (ziel, inhalt) => {
        const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + ziel.split("/").map(encodeURIComponent).join("/"), { method: "POST",
          headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "text/html;charset=utf-8", "x-upsert": "true" }, body: inhalt });
        if(!r.ok) throw new Error("Speichern fehlgeschlagen (" + r.status + ")");
      };
      await hoch(sicherung, html);
      const neuHtml = html.split(wahl.v).join(wahl.kod(neuText));
      await hoch(pfad, neuHtml);
      html = neuHtml;
      msg.textContent = wahl.anzahl + " Stelle(n) geändert und gespeichert. Am Terminal ab dem nächsten Modulstart sichtbar."; msg.classList.add("ok");
      $t("#uwtSuche").value = ""; $t("#uwtNeu").value = ""; wahl = null; treffer.textContent = "";
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
}

/* Formular „Mitarbeiter anlegen / ändern": Name + Gruppe, sonst nichts. Speichern schreibt
   uw_person (+ uw_person_rolle); jedes angemeldete Konto des Betriebs darf das – die
   Datenbank grenzt auf den eigenen Betrieb ein (RLS). */
function uwPersonForm(p, vorName, vorGruppe){
  const box = document.getElementById("uwPersForm"); if(!box) return;
  const gruppen = uwGruppen();
  const gewaehlt = new Set(p ? (p.uw_person_rolle || []).map(x => x.rolle_id) : []);
  if(!p && vorGruppe){ const g = gruppen.find(x => x.name === vorGruppe); if(g) gewaehlt.add(g.id); }
  box.innerHTML = `<div class="uw-form">
    <h3 class="uw-h3" style="margin-top:0">${p ? "Mitarbeiter ändern" : "Mitarbeiter anlegen"}</h3>
    <label class="uw-lab" for="uwPName">Vor- und Nachname</label>
    <input type="text" id="uwPName" value="${esc(p ? p.name : (vorName || ""))}" placeholder="z. B. Max Müller" autocomplete="off">
    <div class="uw-lab">Gruppe (mehrere möglich)</div>
    <div class="uw-chips">${gruppen.map(g => `<label class="uw-chip"><input type="checkbox" value="${esc(g.id)}"${gewaehlt.has(g.id) ? " checked" : ""}> ${esc(g.name)}</label>`).join("") || '<span class="uw-leise">Noch keine Gruppen angelegt.</span>'}</div>
    ${p ? `<label class="uw-chip uw-chip-aus"><input type="checkbox" id="uwPAus"> ausgeschieden (nicht mehr anzeigen)</label>` : ""}
    <div class="uw-form-knoepfe">
      <button class="btn sek" id="uwPSpeichern">${p ? "Speichern" : "Anlegen"}</button>
      <button class="btn-klein" id="uwPAbbruch">Abbrechen</button>
      <span class="uw-leise" id="uwPMeld"></span>
    </div></div>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("uwPName").focus();
  document.getElementById("uwPAbbruch").addEventListener("click", () => { box.innerHTML = ""; });
  document.getElementById("uwPSpeichern").addEventListener("click", () => uwPersonSpeichern(p));
}

async function uwPersonSpeichern(p){
  const meld = document.getElementById("uwPMeld");
  const name = document.getElementById("uwPName").value.trim().replace(/\s+/g, " ");
  if(name.length < 3){ meld.textContent = "Bitte den vollständigen Namen eintragen."; return; }
  const rollen = [...document.querySelectorAll("#uwPersForm .uw-chips input:checked")].map(x => x.value);
  const aus = document.getElementById("uwPAus");
  const status = (aus && aus.checked) ? "archiviert" : "aktiv";
  if(!p && !rollen.length && uwGruppen().length){ meld.textContent = "Bitte mindestens eine Gruppe wählen."; return; }
  meld.textContent = "Speichere …";
  try{
    let id = p ? p.id : null;
    if(p){
      await apiSend("PATCH", "/rest/v1/uw_person?id=eq." + encodeURIComponent(p.id),
        { name, status, geaendert_am: new Date().toISOString() }, "return=minimal");
    }else{
      const neu = await apiSend("POST", "/rest/v1/uw_person",
        { kunde_slug: AKTIV, name, status: "aktiv", sprache: "de" }, "return=representation");
      id = Array.isArray(neu) ? neu[0].id : neu.id;
    }
    await apiSend("DELETE", "/rest/v1/uw_person_rolle?person_id=eq." + encodeURIComponent(id), null, "return=minimal");
    if(rollen.length) await apiSend("POST", "/rest/v1/uw_person_rolle",
      rollen.map(r => ({ person_id: id, rolle_id: r })), "return=minimal");
    UW_MELDUNG = p ? (status === "archiviert" ? name + " wird nicht mehr angezeigt." : name + " ist gespeichert.")
                   : name + " ist angelegt.";
    await ladeNachweise();
    renderSektionen();
  }catch(e){
    meld.textContent = "Konnte nicht gespeichert werden: " + (e && e.message ? e.message : e);
  }
}

/* ---- Foliensätze: Unterweisungen als hochgeladene Präsentation ----------------------
   Der einfachste Weg, den es gibt: in PowerPoint bauen, als PDF speichern, hier hochladen,
   Rollen ankreuzen, freigeben. Kein Editor, keine Datei auf den USB-Stick.
   Das Terminal kann PDF längst abspielen; es holt die Datei über seinen Geräte-Token. */
let FOLIEN = [];

async function ladeFolien(){
  try{
    FOLIEN = await apiGet("/rest/v1/portal_uw_folien?select=*&order=sortierung.asc,titel.asc",
                          false) || [];
  }catch(e){ FOLIEN = []; }
}
function folienSichtbar(){ return AKTIV ? FOLIEN.filter(f => f.kunde_slug === AKTIV) : FOLIEN; }

/* Hochladen: PDF wird angezeigt, PPTX nur verwahrt. Serverseitig zu konvertieren hieße
   LibreOffice auf einem Server – für einen Schritt, den PowerPoint mit „Speichern unter"
   selbst besser kann. Darum sagt das Portal das offen, statt die Datei stumm abzulehnen. */
async function folienHochladen(datei, titel, rollen){
  const slug = AKTIV || (getSession() && window.__oakSlug) || AKTIV;
  if(!slug){ alert("Kein Betrieb gewählt."); return; }
  const endung = (datei.name.split(".").pop() || "").toLowerCase();
  if(["pdf", "pptx", "ppt"].indexOf(endung) < 0){
    alert("Bitte eine PDF- oder PowerPoint-Datei wählen."); return;
  }
  const rein = datei.name.replace(/[^A-Za-z0-9._-]+/g, "-");
  const pfad = slug + "/unterweisungen/" + rein;

  const t = await token();
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, {
    method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "x-upsert": "true" },
    body: datei,
  });
  if(!r.ok){ alert("Hochladen fehlgeschlagen: " + r.status); return; }

  const istPdf = endung === "pdf";
  const key = rein.replace(/\.[^.]+$/, "").toLowerCase();
  await apiSend("POST", "/rest/v1/portal_uw_folien", {
    kunde_slug: slug, kunde: (folienSichtbar()[0] || {}).kunde || null,
    modul_key: key, titel: titel || rein.replace(/\.[^.]+$/, ""),
    datei_pfad: istPdf ? pfad : null,
    original_pfad: istPdf ? null : pfad,
    rollen: rollen || [], status: "entwurf",
  }, "resolution=merge-duplicates");

  await ladeFolien();
  renderSektionen();
  if(!istPdf){
    alert("Die Präsentation ist gespeichert.\n\nFür die Anzeige am Terminal wird noch eine "
        + "PDF-Fassung gebraucht: in PowerPoint „Speichern unter → PDF“ und diese Datei "
        + "hier ebenfalls hochladen.");
  }
}

async function folienStatus(id, status){
  try{
    await apiSend("PATCH", "/rest/v1/portal_uw_folien?id=eq." + encodeURIComponent(id), {
      status: status,
      freigegeben_am: status === "freigegeben" ? new Date().toISOString() : null,
      freigegeben_von: status === "freigegeben" ? (window.__oakName || "Portal") : null,
      updated_at: new Date().toISOString(),
    });
    await ladeFolien();
    renderSektionen();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
}

async function folienRollen(id, rollen){
  try{
    await apiSend("PATCH", "/rest/v1/portal_uw_folien?id=eq." + encodeURIComponent(id),
                  { rollen: rollen, updated_at: new Date().toISOString() });
    await ladeFolien();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
}

/* Verständnisfrage anlegen – im selben Schema, das die bestehenden Module nutzen:
   after = nach welcher Folie sie erscheint, answer = Index der richtigen Antwort. */
async function frageAnlegen(f){
  const nachFolie = prompt("Nach welcher Folie soll die Frage erscheinen?\n"
                         + "(Zahl; bei " + (f.seiten || "?") + " Folien insgesamt)", "1");
  if(nachFolie === null) return;
  const text = prompt("Frage:");
  if(!text) return;
  const a1 = prompt("Richtige Antwort:");
  if(!a1) return;
  const a2 = prompt("Falsche Antwort 1:");
  const a3 = prompt("Falsche Antwort 2:");
  const optionen = [{ de: a1 }];
  if(a2) optionen.push({ de: a2 });
  if(a3) optionen.push({ de: a3 });
  const fragen = (f.fragen || []).concat([{
    after: parseInt(nachFolie, 10) || 1, type: "mc",
    q: { de: text }, options: optionen, answer: 0,
    ok: { de: "Richtig." }, bad: { de: "Nicht ganz – richtig ist: " + a1 },
  }]);
  try{
    await apiSend("PATCH", "/rest/v1/portal_uw_folien?id=eq." + encodeURIComponent(f.id),
                  { fragen: fragen, updated_at: new Date().toISOString() });
    await ladeFolien();
    renderSektionen();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
}

function renderFolien(){
  const rows = folienSichtbar();
  const darf = uwDarfFreigeben();
  if(!rows.length && !darf) return "";

  const rollenNamen = ["Maschinenbediener", "Schichtführer", "Instandhaltung",
                       "Lager/Logistik", "Büro/Verwaltung"];

  const zeile = f => {
    const bereit = !!f.datei_pfad;
    const badge = !bereit ? '<span class="uw-badge uw-warnung">PDF fehlt</span>'
                : f.status === "freigegeben" ? '<span class="uw-badge uw-gut">am Terminal</span>'
                : '<span class="uw-badge uw-warnung">Entwurf</span>';
    const knoepfe = !darf ? "" : (
      (bereit && f.status !== "freigegeben"
        ? `<button class="btn-klein" data-fgeb="${esc(f.id)}">freigeben</button>` : "") +
      (f.status === "freigegeben"
        ? `<button class="btn-klein" data-fzur="${esc(f.id)}">zurückziehen</button>` : "") +
      `<button class="btn-klein" data-ffrage="${esc(f.id)}">Frage +</button>`);
    const rollen = (f.rollen || []).length ? esc((f.rollen || []).join(", ")) : "—";
    return `<tr>
      <td>${badge}</td>
      <td><b>${esc(f.titel)}</b><div class="ck-hinweis">${f.seiten ? f.seiten + " Folien · " : ""}${
            (f.fragen || []).length} Frage(n)</div></td>
      <td class="uw-mod">${rollen}</td>
      <td>${knoepfe}</td>
    </tr>`;
  };

  const liste = rows.length
    ? `<table class="uw-tab"><thead><tr><th>Stand</th><th>Foliensatz</th><th>für Rollen</th><th></th></tr></thead>
         <tbody>${rows.map(zeile).join("")}</tbody></table>`
    : `<div class="ck-fuss">Noch keine Foliensätze. Präsentation in PowerPoint bauen,
         als <b>PDF</b> speichern und hier hochladen.</div>`;

  const hochladen = darf ? `<div class="fol-upload">
      <input type="file" id="folDatei" accept=".pdf,.pptx,.ppt">
      <input type="text" id="folTitel" placeholder="Titel (z. B. Gefahrstoffe 2026)">
      <select id="folRolle"><option value="">für alle Rollen</option>
        ${rollenNamen.map(r => `<option>${esc(r)}</option>`).join("")}</select>
      <button class="btn-klein" id="folGo">Hochladen</button>
    </div>` : "";

  return `<div class="uw-block">
    <div class="sek-kopf"><h2>Foliensätze</h2></div>
    ${liste}${hochladen}
    <div class="ck-fuss">In PowerPoint bauen, als <b>PDF</b> speichern, hochladen, Rollen
      zuordnen, freigeben – das Terminal holt sich den Foliensatz von selbst und zeigt ihn
      seitenweise. Verständnisfragen lassen sich je Folie ergänzen. Eine hochgeladene
      <b>.pptx</b> wird verwahrt, angezeigt wird aber die PDF-Fassung.</div>
  </div>`;
}

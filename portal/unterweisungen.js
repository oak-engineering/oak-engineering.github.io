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
const UW_SPALTEN = "kunde_slug,mitarbeiter_name,funktion,bereich,module,unterweisung," +
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
function uwModule(n){
  const m = Array.isArray(n.module) ? n.module : (n.unterweisung ? String(n.unterweisung).split(/,\s*/) : []);
  return m.filter(Boolean);
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
    ${tok ? `<a class="uw-start" href="kiosk.html#t=${encodeURIComponent(tok)}" target="_blank" rel="noopener">Unterweisungs-Terminal starten</a>`
          : `<div class="uw-start uw-start-aus">Terminal noch nicht eingerichtet – Gerätecode bei OAK engineering anfordern.</div>`}
    <p class="uw-erkl uw-hero-text">Am Terminal: Name eingeben, Rolle wählen, Module durchgehen, unterschreiben.
      Der Nachweis landet automatisch hier im Portal.</p>`;
  wrap.appendChild(sekStart);

  /* 2. Wer ist fällig */
  const pers = uwPersonen();
  const zusatz = uwJeMitarbeiter(rows).filter(n => !pers.some(p => uwNorm(p.name) === uwNorm(n.mitarbeiter_name)));
  const zeilen = pers.map(p => {
    const n = uwLetzterNachweis(p.name);
    const st = n ? uwStatus(n) : { klasse: "kritisch", text: "noch keine Unterweisung" };
    return { rang: (UW_AMPEL_RANG[st.klasse] ?? 2), html: `<tr>
      <td><b>${esc(p.name)}</b></td><td>${esc(uwGruppenName(p) || "—")}</td>
      <td>${n ? uwDatum(n.created_at) : "—"}</td>
      <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
      <td><button class="btn-klein" data-pedit="${esc(p.id)}">ändern</button></td></tr>` };
  }).concat(zusatz.map(n => {
    const st = uwStatus(n);
    return { rang: (UW_AMPEL_RANG[st.klasse] ?? 2), html: `<tr>
      <td><b>${esc(n.mitarbeiter_name)}</b> <span class="uw-leise">am Terminal eingetragen</span></td>
      <td>${esc(n.funktion || "—")}</td><td>${uwDatum(n.created_at)}</td>
      <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
      <td><button class="btn-klein" data-pneu="${esc(n.mitarbeiter_name)}" data-pfunk="${esc(n.funktion || "")}">als Mitarbeiter übernehmen</button></td></tr>` };
  })).sort((a, b) => a.rang - b.rang);
  const faellig = zeilen.filter(z => z.rang <= 1).length;
  const sekPers = document.createElement("section"); sekPers.className = "sektion";
  sekPers.innerHTML = `
    <div class="sek-kopf"><h2>Wer ist fällig</h2>
      <span class="zaehler">${zeilen.length ? (faellig ? faellig + " fällig" : "alle aktuell") : ""}</span>
      <button class="btn sek" id="uwPersNeu">Mitarbeiter anlegen</button></div>
    <div id="uwPersForm"></div>
    ${zeilen.length ? `<div class="tabelle-wrap"><table class="uw-tab">
      <thead><tr><th>Name</th><th>Gruppe</th><th>zuletzt unterwiesen</th><th>Stand</th><th></th></tr></thead>
      <tbody>${zeilen.map(z => z.html).join("")}</tbody></table></div>`
    : `<div class="ck-fuss">Noch niemand eingetragen. <b>„Mitarbeiter anlegen"</b> – oder die Beschäftigten tragen sich am
        Terminal selbst ein und erscheinen dann hier.</div>`}`;
  wrap.appendChild(sekPers);
  sekPers.querySelector("#uwPersNeu").addEventListener("click", () => uwPersonForm(null));
  sekPers.querySelectorAll("[data-pedit]").forEach(b => b.addEventListener("click", () => uwPersonForm(UW_P.find(p => p.id === b.dataset.pedit))));
  sekPers.querySelectorAll("[data-pneu]").forEach(b => b.addEventListener("click", () => uwPersonForm(null, b.dataset.pneu, b.dataset.pfunk)));

  /* 3. Versionsarchiv (eingeklappt): je Thema Version 1.0 und 2.0 zum Öffnen + Auswahl, was am Terminal läuft.
        Eine Zeile je Thema, kein Scrollen. Darunter die Nachweise, kurz gehalten (Excel hat alles). */
  const docs = (typeof katRows === "function") ? katRows("unterweisungen") : [];
  const base = r => String(r.storage_path || "").split("/").pop();
  const buchungen = (typeof UW_BUCHUNG !== "undefined" ? UW_BUCHUNG : []).filter(x => x.kunde_slug === AKTIV && x.aktiv);
  const modulTitel = th => ((typeof UW_MODULE !== "undefined" && UW_MODULE.find(m => m.thema === th)) || {}).titel || th;
  const reihe = th => ((typeof UW_MODULE !== "undefined" && UW_MODULE.find(m => m.thema === th)) || {}).reihenfolge || 99;
  const benutzt = new Set();
  const oeffnen = d => { if(!d) return '<span class="uw-leise">—</span>'; benutzt.add(d);
    return `<a class="btn-klein" href="${viewerUrl(d.doc_typ, d.storage_path, d.titel)}" target="_blank" rel="noopener">Öffnen</a>`; };
  const archivZeilen = buchungen.slice().sort((x, y) => reihe(x.thema) - reihe(y.thema)).map(bu => {
    const d1 = bu.datei_v1 ? docs.find(r => base(r) === bu.datei_v1) : null;
    const d2 = docs.find(r => base(r) === bu.thema + ".html");
    const f = bu.fassung === 2 ? 2 : 1;
    const wahl = istAdmin
      ? `<div class="uw-pills" data-thema="${esc(bu.thema)}">
           <button type="button" class="uw-pill${f === 1 ? " aktiv" : ""}" data-f="1"${d1 ? "" : " disabled"}>1.0</button>
           <button type="button" class="uw-pill${f === 2 ? " aktiv" : ""}" data-f="2"${d2 ? "" : " disabled"}>2.0</button></div>`
      : `<span class="uw-badge uw-gut">Version ${f}.0</span>`;
    return `<tr><td><b>${esc(modulTitel(bu.thema))}</b></td><td>${oeffnen(d1)}</td><td>${oeffnen(d2)}</td><td>${wahl}</td></tr>`;
  }).join("");
  const weitere = docs.filter(d => !benutzt.has(d));
  const nachweisKurz = rows.length ? `<div class="tabelle-wrap"><table class="uw-tab uw-kompakt">
      <thead><tr><th>Datum</th><th>Name</th><th>Gruppe</th><th>Ergebnis</th></tr></thead>
      <tbody>${rows.slice(0, 8).map(n => `<tr>
        <td>${uwDatum(n.created_at)}</td><td><b>${esc(n.mitarbeiter_name || "—")}</b></td><td>${esc(n.funktion || "—")}</td>
        <td>${n.bestanden ? '<span class="uw-badge uw-gut">bestanden</span>' : '<span class="uw-badge uw-kritisch">nicht bestanden</span>'}</td>
      </tr>`).join("")}</tbody></table></div>${rows.length > 8 ? `<div class="uw-leise" style="margin-top:6px">Die letzten 8 von ${rows.length}. Alle stehen in der Excel-Tabelle.</div>` : ""}`
    : `<div class="uw-leise">Noch keine Nachweise.</div>`;
  /* Nachweise sieht jeder (kurz, Excel hat alles) */
  const sekNach = document.createElement("section"); sekNach.className = "sektion";
  sekNach.innerHTML = `<div class="sek-kopf"><h3 class="uw-h3" style="margin:0">Nachweise</h3><span class="zaehler">${rows.length}</span>
      ${rows.length ? '<button class="btn sek" id="uwCsvAlle">Alle als Excel-Tabelle</button>' : ""}</div>${nachweisKurz}`;
  wrap.appendChild(sekNach);
  const btnAlle = sekNach.querySelector("#uwCsvAlle"); if(btnAlle) btnAlle.addEventListener("click", uwExport);
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
  const btn = sekMehr.querySelector("#uwCsv");
  if(btn) btn.addEventListener("click", uwExport);
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

/* OAK Kundenportal — Sektion „Unterweisungen": Nachweise aus dem Unterweisungs-Terminal.
   Die Nachweise kommen ohne Login vom Terminal (Funktion unterweisung_nachweis, Geräte-Token);
   gelesen wird je Kunde über RLS. Der Arbeitgeber ist Verantwortlicher, OAK verarbeitet im Auftrag.

   Bewusst OHNE Punktestand: gespeichert sind Name, Rolle, Datum, Module und bestanden ja/nein
   (Datenminimierung). § 12 ArbSchG verlangt den Nachweis der Unterweisung – keine
   Leistungsauswertung. Deshalb zeigt diese Sektion auch keine Prozentwerte an. */
"use strict";

let NACHWEISE = [];
let BAUSTEINE = [];
/* Jährliche Wiederholung: DGUV Vorschrift 1 § 4 – „mindestens einmal jährlich". Wir warnen
   ab 11 Monaten, damit die Wiederholung planbar ist und nicht erst am Stichtag auffällt. */
const UW_FAELLIG_TAGE = 365, UW_WARNUNG_TAGE = 335;

/* Spalten einzeln statt select=*: sonst holt der Browser die Unterschrift (Bild als Base64)
   und den User-Agent mit, obwohl beides hier nie gezeigt wird. Was nicht gebraucht wird,
   soll auch nicht über die Leitung gehen. */
const UW_SPALTEN = "kunde_slug,mitarbeiter_name,funktion,bereich,module,unterweisung," +
                   "bestanden,bestaetigung,config_version,created_at";

async function ladeNachweise(){
  try{
    NACHWEISE = await apiGet("/rest/v1/unterweisungsnachweise?select=" + UW_SPALTEN +
                             "&order=created_at.desc", false) || [];
  }catch(e){ NACHWEISE = []; }
  try{
    BAUSTEINE = await apiGet("/rest/v1/portal_uw_baustein?select=*&order=sortierung.asc,gueltig_ab.desc",
                             false) || [];
  }catch(e){ BAUSTEINE = []; }
}

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

function renderUnterweisungen(wrap){
  const rows = uwSichtbar();
  const sec = document.createElement("section");
  sec.className = "sektion";

  const jePerson = uwJeMitarbeiter(rows);
  const faellig = jePerson.filter(n => uwStatus(n).klasse !== "gut");

  const kacheln = `<div class="ck-reihe">
    ${ckTile(jePerson.length, "unterwiesene Personen", rows.length + " Nachweise insgesamt")}
    ${ckTile(faellig.length, "fällig oder überfällig", "jährliche Wiederholung (DGUV V1 § 4)",
             faellig.length ? "warnung" : "gut")}
    ${ckTile(rows.filter(n => !n.bestanden).length, "nicht bestanden", "Wiederholung nötig",
             rows.filter(n => !n.bestanden).length ? "kritisch" : "gut")}
  </div>`;

  const liste = jePerson.length ? `<table class="uw-tab">
      <thead><tr><th>Person</th><th>Rolle</th><th>zuletzt</th><th>Module</th><th>Stand</th></tr></thead>
      <tbody>${jePerson.map(n => {
        const st = uwStatus(n);
        return `<tr>
          <td><b>${esc(n.mitarbeiter_name || "—")}</b>${n.bestanden ? "" : ' <span class="uw-warn">nicht bestanden</span>'}</td>
          <td>${esc(n.funktion || "—")}</td>
          <td>${uwDatum(n.created_at)}</td>
          <td class="uw-mod">${esc(uwModule(n).join(", ") || "—")}</td>
          <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
        </tr>`; }).join("")}</tbody></table>`
    : `<div class="ck-fuss">Noch keine Nachweise. Sobald am Terminal eine Unterweisung
        abgeschlossen wird, erscheint sie hier – auch wenn das Gerät zwischendurch offline war.</div>`;

  sec.innerHTML = `${renderBausteine(sec)}
    <div class="sek-kopf"><h2>Unterweisungen</h2>
      ${rows.length ? '<button class="btn-klein" id="uwCsv">Als CSV exportieren</button>' : ""}</div>
    ${kacheln}${liste}
    <div class="ck-fuss">Nachweis nach <b>§ 12 ArbSchG</b>; Wiederholung mindestens jährlich
      (<b>DGUV Vorschrift 1 § 4</b>). Gespeichert werden Name, Rolle, Datum, Module und bestanden
      ja/nein – <b>kein Punktestand</b>. Verantwortlich ist der Arbeitgeber; OAK engineering
      verarbeitet die Daten im Auftrag.</div>`;
  wrap.appendChild(sec);
  const btn = sec.querySelector("#uwCsv");
  if(btn) btn.addEventListener("click", uwExport);
  const such = sec.querySelector("#uwSuchen");
  if(such) such.addEventListener("click", () => uwAbgleichen(such));
  sec.querySelectorAll("[data-frei]").forEach(b =>
    b.addEventListener("click", () => uwBausteinSetzen(b.dataset.frei, "freigegeben")));
  sec.querySelectorAll("[data-verw]").forEach(b =>
    b.addEventListener("click", () => uwBausteinSetzen(b.dataset.verw, "verworfen")));
}

/* OAK Kundenportal — Sektion „Unterweisungen": Nachweise aus dem Unterweisungs-Terminal.
   Die Nachweise kommen ohne Login vom Terminal (Funktion unterweisung_nachweis, Geräte-Token);
   gelesen wird je Kunde über RLS. Der Arbeitgeber ist Verantwortlicher, OAK verarbeitet im Auftrag.

   Bewusst OHNE Punktestand: gespeichert sind Name, Rolle, Datum, Module und bestanden ja/nein
   (Datenminimierung). § 12 ArbSchG verlangt den Nachweis der Unterweisung – keine
   Leistungsauswertung. Deshalb zeigt diese Sektion auch keine Prozentwerte an. */
"use strict";

let NACHWEISE = [];
/* Jährliche Wiederholung: DGUV Vorschrift 1 § 4 – „mindestens einmal jährlich". Wir warnen
   ab 11 Monaten, damit die Wiederholung planbar ist und nicht erst am Stichtag auffällt. */
const UW_FAELLIG_TAGE = 365, UW_WARNUNG_TAGE = 335;

async function ladeNachweise(){
  try{
    NACHWEISE = await apiGet("/rest/v1/unterweisungsnachweise?select=*&order=created_at.desc", false) || [];
  }catch(e){ NACHWEISE = []; }
}
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

  sec.innerHTML = `<div class="sek-kopf"><h2>Unterweisungen</h2>
      ${rows.length ? '<button class="btn-klein" id="uwCsv">Als CSV exportieren</button>' : ""}</div>
    ${kacheln}${liste}
    <div class="ck-fuss">Nachweis nach <b>§ 12 ArbSchG</b>; Wiederholung mindestens jährlich
      (<b>DGUV Vorschrift 1 § 4</b>). Gespeichert werden Name, Rolle, Datum, Module und bestanden
      ja/nein – <b>kein Punktestand</b>. Verantwortlich ist der Arbeitgeber; OAK engineering
      verarbeitet die Daten im Auftrag.</div>`;
  wrap.appendChild(sec);
  const btn = sec.querySelector("#uwCsv");
  if(btn) btn.addEventListener("click", uwExport);
}

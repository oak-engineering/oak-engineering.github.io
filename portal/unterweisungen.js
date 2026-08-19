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
  await ladeFolien();
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

  sec.innerHTML = `${renderFolien()}${renderBausteine(sec)}
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

  sec.querySelectorAll("[data-fgeb]").forEach(b =>
    b.addEventListener("click", () => folienStatus(b.dataset.fgeb, "freigegeben")));
  sec.querySelectorAll("[data-fzur]").forEach(b =>
    b.addEventListener("click", () => folienStatus(b.dataset.fzur, "zurueckgezogen")));
  sec.querySelectorAll("[data-ffrage]").forEach(b =>
    b.addEventListener("click", () => {
      const f = FOLIEN.find(x => x.id === b.dataset.ffrage);
      if(f) frageAnlegen(f);
    }));
  const fgo = sec.querySelector("#folGo");
  if(fgo) fgo.addEventListener("click", () => {
    const d = sec.querySelector("#folDatei").files[0];
    if(!d){ alert("Bitte eine Datei wählen."); return; }
    const r = sec.querySelector("#folRolle").value;
    fgo.disabled = true; fgo.textContent = "lädt …";
    folienHochladen(d, sec.querySelector("#folTitel").value.trim(), r ? [r] : [])
      .finally(() => { fgo.disabled = false; fgo.textContent = "Hochladen"; });
  });
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

/* OAK EHS-Cockpit — Nachweise der Beschäftigten (Nikolai 17.09.2026: „Nachweise (Staplerführerscheine, Kranführerscheine etc.),
   betriebsärztliche Untersuchungen").
   Zwei Reiter:
     1. Qualifikationen  – portal_nachweis: Stapler, Kran, Ersthelfer … mit Ablaufdatum, schriftlicher Beauftragung und Datei.
     2. Vorsorge         – portal_vorsorge: Vorsorgekartei nach § 3 Abs. 4 ArbMedVV – dass, wann und aus welchem Anlass Vorsorge
                           stattgefunden hat, plus nächster Termin laut Vorsorgebescheinigung. Bewusst OHNE Freitext und Datei:
                           Befunde und Diagnosen gehören nicht zum Arbeitgeber.
   Abläufe erscheinen im Kalender und als Aufgabe auf der Startseite. */
"use strict";

let NW_ROWS = [], VS_ROWS = [], NW_GELADEN_FUER = null, NW_REITER = "qualifikation";
let NW_FILTER = { suche: "", art: "", stand: "" };
const NW_ART = { stapler: "Staplerschein", kran: "Kranschein", anschlaeger: "Anschläger", hubarbeitsbuehne: "Hubarbeitsbühne",
                 ersthelfer: "Ersthelfer", brandschutzhelfer: "Brandschutzhelfer", sicherheitsbeauftragter: "Sicherheitsbeauftragter",
                 elektro: "Elektrofachkraft / EuP", sonstiges: "Sonstiger Nachweis" };
/* Hinweis je Art – nur belegte Fundstellen */
const NW_HINWEIS = {
  stapler: "Ausbildung und schriftliche Beauftragung (DGUV Vorschrift 68), jährliche Unterweisung.",
  kran: "Befähigung und Beauftragung (DGUV Vorschrift 52 § 29, DGUV Grundsatz 309-003).",
  anschlaeger: "Gleiche Voraussetzungen wie Kranführer (DGUV Grundsatz 309-003).",
  ersthelfer: "Fortbildung in der Regel alle 2 Jahre (DGUV Vorschrift 1 § 26) – „gültig bis“ wird vorgeschlagen."
};
const NW_BEAUFTRAGUNG = ["stapler", "kran", "anschlaeger", "hubarbeitsbuehne"];
const VS_ART = { pflicht: "Pflichtvorsorge", angebot: "Angebotsvorsorge", wunsch: "Wunschvorsorge" };
/* Anlässe nach Anhang ArbMedVV (Auswahl für die Kunststoffverarbeitung) – Freitext bleibt möglich */
const VS_ANLAESSE = [
  ["Lärm ab 85 dB(A)", "pflicht"], ["Lärm über 80 dB(A)", "angebot"],
  ["Atemschutzgeräte Gruppe 2 oder 3", "pflicht"], ["Atemschutzgeräte Gruppe 1", "angebot"],
  ["Feuchtarbeit ab 4 Stunden täglich", "pflicht"], ["Feuchtarbeit über 2 Stunden täglich", "angebot"],
  ["Tätigkeiten mit Lösemitteln (z. B. Toluol, Xylol, Ethanol, 2-Butanon)", "angebot"],
  ["Haut- oder atemwegssensibilisierende Stoffe", "angebot"], ["Hand-Arm- oder Ganzkörper-Vibrationen", "angebot"],
  ["Lastenhandhabung, repetitive Tätigkeiten, Zwangshaltungen", "angebot"], ["Extreme Hitzebelastung", "pflicht"],
  ["Tätigkeiten an Bildschirmgeräten", "angebot"]
];

async function nwLaden(erzwingen){
  if(!erzwingen && NW_GELADEN_FUER === AKTIV) return;
  const slug = AKTIV ? "&kunde_slug=eq." + encodeURIComponent(AKTIV) : "";
  const [a, b] = await Promise.all([
    apiGet("/rest/v1/portal_nachweis?select=*&archiviert=is.false" + slug + "&order=person_name.asc", false).catch(() => []),
    apiGet("/rest/v1/portal_vorsorge?select=*" + slug + "&order=person_name.asc", false).catch(() => [])]);
  NW_ROWS = a || []; VS_ROWS = b || []; NW_GELADEN_FUER = AKTIV;
}
function nwArtLabel(a){ return NW_ART[a] || "Nachweis"; }
function nwNorm(s){ return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
/* ein jüngerer Nachweis derselben Person und Art ersetzt den älteren (kein Ablauf-Alarm mehr) */
function nwErsetzt(n){
  return NW_ROWS.some(x => x.id !== n.id && !x.archiviert && x.art === n.art && nwNorm(x.person_name) === nwNorm(n.person_name)
    && (x.art !== "sonstiges" || nwNorm(x.bezeichnung) === nwNorm(n.bezeichnung))
    && String(x.gueltig_bis || "9999") > String(n.gueltig_bis || "9999"));
}
function vsErsetzt(v){
  return VS_ROWS.some(x => x.id !== v.id && nwNorm(x.anlass) === nwNorm(v.anlass) && nwNorm(x.person_name) === nwNorm(v.person_name)
    && String(x.datum || "") > String(v.datum || ""));
}
function nwStand(datum, ersetzt){
  if(ersetzt) return { klasse: "grau", text: "ersetzt" };
  if(!datum) return { klasse: "gut", text: "ohne Ablauf" };
  const t = ehsTage(datum);
  if(t < 0) return { klasse: "kritisch", text: "abgelaufen" };
  if(t <= 60) return { klasse: "warnung", text: "läuft ab in " + t + " Tagen" };
  return { klasse: "gut", text: "gültig" };
}

async function renderNachweise(wrap){
  const sec = document.createElement("section"); sec.className = "sektion nw-seite";
  sec.innerHTML = `<div class="ck-fuss">wird geladen …</div>`;
  wrap.appendChild(sec);
  await nwLaden(true);
  if(typeof HASH_Q !== "undefined" && HASH_Q && HASH_Q.get("reiter")){ NW_REITER = HASH_Q.get("reiter") === "vorsorge" ? "vorsorge" : "qualifikation"; HASH_Q = null; }
  const zeichnen = () => {
    sec.innerHTML = `<div class="nw-kopf"><div class="uw-pills">
        <button type="button" class="uw-pill${NW_REITER === "qualifikation" ? " aktiv" : ""}" data-reiter="qualifikation">Qualifikationen</button>
        <button type="button" class="uw-pill${NW_REITER === "vorsorge" ? " aktiv" : ""}" data-reiter="vorsorge">Betriebsärztliche Vorsorge</button></div>
        <button type="button" class="btn" id="nwNeu">${NW_REITER === "vorsorge" ? "Vorsorge eintragen" : "Nachweis eintragen"}</button></div>
      <div id="nwInhalt"></div>`;
    sec.querySelectorAll("[data-reiter]").forEach(b => b.addEventListener("click", () => { NW_REITER = b.dataset.reiter; NW_FILTER = { suche: "", art: "", stand: "" }; zeichnen(); }));
    const neu = async () => { await nwLaden(true); zeichnen(); };
    sec.querySelector("#nwNeu").addEventListener("click", () => NW_REITER === "vorsorge" ? vsDialog(null, neu) : nwDialog(null, neu));
    if(NW_REITER === "vorsorge") vsListe(sec.querySelector("#nwInhalt"), neu); else nwListe(sec.querySelector("#nwInhalt"), neu);
  };
  zeichnen();
}

function nwListe(box, neu){
  const rang = { kritisch: 0, warnung: 1, gut: 2, grau: 3 };
  const zeilen = NW_ROWS.map(n => ({ n, st: nwStand(n.gueltig_bis, nwErsetzt(n)) }))
    .sort((a, b) => (rang[a.st.klasse] - rang[b.st.klasse]) || a.n.person_name.localeCompare(b.n.person_name, "de"));
  const arten = [...new Set(NW_ROWS.map(n => n.art))];
  box.innerHTML = `<div class="mg-filter"><input type="search" class="uw-suche" id="nwSuche" placeholder="Name suchen" autocomplete="off" value="${esc(NW_FILTER.suche)}">
      <select class="uw-fassung" id="nwArt"><option value="">Alle Nachweise</option>${arten.map(a => `<option value="${a}"${a === NW_FILTER.art ? " selected" : ""}>${esc(nwArtLabel(a))}</option>`).join("")}</select>
      <select class="uw-fassung" id="nwStand"><option value="">Alle</option><option value="faellig"${NW_FILTER.stand === "faellig" ? " selected" : ""}>abgelaufen oder läuft ab</option></select>
      <span class="uw-leise" id="nwZahl"></span></div>
    ${zeilen.length ? `<div class="tabelle-wrap"><table class="uw-tab" id="nwTab"><thead><tr><th>Name</th><th>Nachweis</th><th>ausgestellt</th><th>gültig bis</th><th>Stand</th><th></th></tr></thead>
      <tbody>${zeilen.map(({ n, st }) => `<tr data-name="${esc(nwNorm(n.person_name))}" data-art="${esc(n.art)}" data-stand="${st.klasse}">
        <td><b>${esc(n.person_name)}</b></td>
        <td>${esc(nwArtLabel(n.art))}${n.bezeichnung ? `<div class="uw-leise">${esc(n.bezeichnung)}</div>` : ""}${NW_BEAUFTRAGUNG.includes(n.art) ? `<div class="uw-leise">${n.beauftragt ? "schriftlich beauftragt" : "<span class=\"nw-fehlt\">Beauftragung fehlt</span>"}</div>` : ""}</td>
        <td>${esc(ehsDatum(n.ausgestellt_am)) || "—"}</td><td>${esc(ehsDatum(n.gueltig_bis)) || "—"}</td>
        <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
        <td class="uw-knoepfe">${n.datei_pfad ? `<button type="button" class="btn-klein" data-datei="${esc(n.datei_pfad)}">Datei</button>` : ""}<button type="button" class="btn-klein" data-nw="${esc(n.id)}">ändern</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="leer">Noch keine Nachweise eingetragen. Staplerscheine, Kranscheine, Ersthelfer … mit <b>„Nachweis eintragen"</b> erfassen – Abläufe erscheinen dann im Kalender und auf der Startseite.</div>`}`;
  const filtern = () => {
    NW_FILTER = { suche: box.querySelector("#nwSuche").value, art: box.querySelector("#nwArt").value, stand: box.querySelector("#nwStand").value };
    let z = 0; const q = nwNorm(NW_FILTER.suche);
    box.querySelectorAll("#nwTab tbody tr").forEach(tr => { const ok = (!q || tr.dataset.name.includes(q)) && (!NW_FILTER.art || tr.dataset.art === NW_FILTER.art)
      && (!NW_FILTER.stand || tr.dataset.stand === "kritisch" || tr.dataset.stand === "warnung"); tr.hidden = !ok; if(ok) z++; });
    box.querySelector("#nwZahl").textContent = zeilen.length ? z + " von " + zeilen.length : "";
  };
  box.querySelector("#nwSuche").addEventListener("input", filtern);
  box.querySelector("#nwArt").addEventListener("change", filtern);
  box.querySelector("#nwStand").addEventListener("change", filtern);
  filtern();
  box.querySelectorAll("[data-nw]").forEach(b => b.addEventListener("click", () => nwDialog(NW_ROWS.find(n => n.id === b.dataset.nw), neu)));
  box.querySelectorAll("[data-datei]").forEach(b => b.addEventListener("click", async () => {
    const u = await ehsSigniert(b.dataset.datei); if(u) window.open(u, "_blank", "noopener"); else alert("Datei konnte nicht geöffnet werden."); }));
}

function nwDialog(n, danach, vorName){
  const dlg = ehsDialog("nwDlg");
  const w = (f, s) => n ? (n[f] == null ? "" : n[f]) : (s == null ? "" : s);
  dlg.innerHTML = `<form method="dialog">
      <h3>${n ? "Nachweis ändern" : "Nachweis eintragen"}</h3>
      <label>Name der/des Beschäftigten<input type="text" id="nwPerson" list="nwPersonen" maxlength="120" value="${esc(w("person_name", vorName))}" autocomplete="off"></label>
      <datalist id="nwPersonen">${ehsPersonenListe().map(p => `<option value="${esc(p)}">`).join("")}</datalist>
      <label>Art<select id="nwArtWahl">${Object.keys(NW_ART).map(a => `<option value="${a}"${a === w("art", "stapler") ? " selected" : ""}>${NW_ART[a]}</option>`).join("")}</select></label>
      <p class="pw-hint" id="nwHinweis"></p>
      <label>Bezeichnung (z. B. Frontstapler, Flurbedienter Kran)<input type="text" id="nwBez" maxlength="200" value="${esc(w("bezeichnung"))}"></label>
      <div class="ehs-zwei"><label>Ausgestellt am<input type="date" id="nwAus" value="${esc(w("ausgestellt_am"))}"></label>
        <label>Gültig bis (leer = ohne Ablauf)<input type="date" id="nwBis" value="${esc(w("gueltig_bis"))}"></label></div>
      <label class="ehs-check" id="nwBeaufWrap"><input type="checkbox" id="nwBeauf"${n && n.beauftragt ? " checked" : ""}> schriftliche Beauftragung liegt vor</label>
      <label>Ausgestellt von (Schulungsstelle)<input type="text" id="nwAussteller" maxlength="200" value="${esc(w("aussteller"))}"></label>
      <label>Nachweis als PDF oder Foto ${n && n.datei_pfad ? "(vorhanden – neue Datei ersetzt sie)" : "(optional)"}<input type="file" id="nwDatei" accept=".pdf,image/jpeg,image/png,image/webp"></label>
      <label>Notiz<textarea id="nwNotiz" rows="2" maxlength="2000">${esc(w("notiz"))}</textarea></label>
      ${ehsNameFeld("nwWer", "Eingetragen von")}
      <p class="pw-msg" id="nwMsg"></p>
      <div class="pw-akt">${n ? `<button type="button" class="btn-klein kal-weg" id="nwWeg">Entfernen</button>` : ""}<button type="button" class="btn sek" id="nwAbbruch">Abbrechen</button><button type="submit" class="btn">Speichern</button></div>
    </form>`;
  const art = dlg.querySelector("#nwArtWahl"), hinweis = dlg.querySelector("#nwHinweis"), aus = dlg.querySelector("#nwAus"), bis = dlg.querySelector("#nwBis");
  const artGeaendert = () => { hinweis.textContent = NW_HINWEIS[art.value] || ""; dlg.querySelector("#nwBeaufWrap").hidden = !NW_BEAUFTRAGUNG.includes(art.value); };
  art.addEventListener("change", artGeaendert); artGeaendert();
  aus.addEventListener("change", () => { if(art.value === "ersthelfer" && aus.value && !bis.value) bis.value = ehsPlusMonate(aus.value, 24); });
  const msg = dlg.querySelector("#nwMsg");
  dlg.querySelector("#nwAbbruch").addEventListener("click", () => dlg.close());
  const weg = dlg.querySelector("#nwWeg");
  if(weg) weg.addEventListener("click", async () => {
    const wer = ehsNameLesen(dlg, "nwWer"); if(!wer){ msg.textContent = "Bitte Ihren Namen eintragen."; msg.className = "pw-msg fehler"; return; }
    if(!confirm("Nachweis entfernen? Er bleibt im Logbuch nachvollziehbar.")) return;
    try{ await apiSend("PATCH", "/rest/v1/portal_nachweis?id=eq." + encodeURIComponent(n.id), { archiviert: true, geaendert_von: wer, geaendert_am: new Date().toISOString() }, "return=minimal");
      dlg.close(); if(danach) danach(); }
    catch(e){ msg.textContent = "Konnte nicht entfernt werden: " + (e.message || e); msg.className = "pw-msg fehler"; }
  });
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); msg.className = "pw-msg";
    const person = dlg.querySelector("#nwPerson").value.trim().replace(/\s+/g, " ");
    if(person.length < 3){ msg.textContent = "Bitte den vollständigen Namen eintragen."; msg.classList.add("fehler"); return; }
    if(bis.value && aus.value && bis.value < aus.value){ msg.textContent = "„Gültig bis“ liegt vor dem Ausstellungsdatum."; msg.classList.add("fehler"); return; }
    const wer = ehsNameLesen(dlg, "nwWer"); if(!wer){ msg.textContent = "Bitte Ihren Namen eintragen."; msg.classList.add("fehler"); return; }
    const datei = dlg.querySelector("#nwDatei").files[0];
    try{
      ehsDateiOk(datei);
      msg.textContent = "Wird gespeichert …";
      let pfad = n ? n.datei_pfad : null;
      if(datei) pfad = await ehsHochladen(datei, AKTIV + "/nachweise/" + Date.now() + "-" + ehsDateiName(datei));
      const daten = { person_name: person, art: art.value, bezeichnung: dlg.querySelector("#nwBez").value.trim() || null,
        ausgestellt_am: aus.value || null, gueltig_bis: bis.value || null, beauftragt: NW_BEAUFTRAGUNG.includes(art.value) && dlg.querySelector("#nwBeauf").checked,
        aussteller: dlg.querySelector("#nwAussteller").value.trim() || null, datei_pfad: pfad, notiz: dlg.querySelector("#nwNotiz").value.trim() || null,
        geaendert_von: wer, geaendert_am: new Date().toISOString() };
      if(n) await apiSend("PATCH", "/rest/v1/portal_nachweis?id=eq." + encodeURIComponent(n.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_nachweis", Object.assign({ kunde_slug: AKTIV, erfasst_von: wer }, daten), "return=minimal");
      dlg.close(); if(danach) danach();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.className = "pw-msg fehler"; }
  });
  dlg.showModal();
}

function vsListe(box, neu){
  const rang = { kritisch: 0, warnung: 1, gut: 2, grau: 3 };
  const zeilen = VS_ROWS.map(v => ({ v, st: vsErsetzt(v) ? { klasse: "grau", text: "ersetzt" } : (v.naechste ? nwStand(v.naechste) : { klasse: "gut", text: "kein Folgetermin" }) }))
    .map(z => (z.st.text === "abgelaufen" ? Object.assign(z, { st: { klasse: "kritisch", text: "überfällig" } }) : z.st.text.indexOf("läuft ab") === 0 ? Object.assign(z, { st: { klasse: "warnung", text: "fällig in " + ehsTage(z.v.naechste) + " Tagen" } }) : z))
    .sort((a, b) => (rang[a.st.klasse] - rang[b.st.klasse]) || a.v.person_name.localeCompare(b.v.person_name, "de"));
  box.innerHTML = `<div class="nw-datenschutz"><b>Vorsorgekartei nach § 3 Abs. 4 ArbMedVV</b> – nur Anlass, Datum und nächster Termin laut Vorsorgebescheinigung.
      Keine Befunde, Diagnosen oder ärztlichen Unterlagen eintragen. Nach dem Ausscheiden löschen; die Person erhält vorher eine Kopie ihrer Angaben.</div>
    <div class="mg-filter"><input type="search" class="uw-suche" id="vsSuche" placeholder="Name suchen" autocomplete="off"><span class="uw-leise" id="vsZahl"></span></div>
    ${zeilen.length ? `<div class="tabelle-wrap"><table class="uw-tab" id="vsTab"><thead><tr><th>Name</th><th>Anlass</th><th>letzte Vorsorge</th><th>nächste</th><th>Stand</th><th></th></tr></thead>
      <tbody>${zeilen.map(({ v, st }) => `<tr data-name="${esc(nwNorm(v.person_name))}"><td><b>${esc(v.person_name)}</b></td>
        <td>${esc(v.anlass)}<div class="uw-leise">${esc(VS_ART[v.art] || "")}</div></td>
        <td>${esc(ehsDatum(v.datum)) || "—"}</td><td>${esc(ehsDatum(v.naechste)) || "—"}</td>
        <td><span class="uw-badge uw-${st.klasse}">${esc(st.text)}</span></td>
        <td class="uw-knoepfe"><button type="button" class="btn-klein" data-kopie="${esc(v.person_name)}">Kopie</button><button type="button" class="btn-klein" data-vs="${esc(v.id)}">ändern</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="leer">Noch keine Vorsorge eingetragen. Nach jedem Termin beim Betriebsarzt Anlass, Datum und den nächsten Termin aus der Vorsorgebescheinigung übernehmen.</div>`}`;
  const s = box.querySelector("#vsSuche");
  const filtern = () => { const q = nwNorm(s.value); let z = 0; box.querySelectorAll("#vsTab tbody tr").forEach(tr => { const ok = !q || tr.dataset.name.includes(q); tr.hidden = !ok; if(ok) z++; });
    box.querySelector("#vsZahl").textContent = zeilen.length ? z + " von " + zeilen.length : ""; };
  s.addEventListener("input", filtern); filtern();
  box.querySelectorAll("[data-vs]").forEach(b => b.addEventListener("click", () => vsDialog(VS_ROWS.find(v => v.id === b.dataset.vs), neu)));
  box.querySelectorAll("[data-kopie]").forEach(b => b.addEventListener("click", () => vsKopie(b.dataset.kopie)));
}
/* Kopie der Angaben für die Person (§ 3 Abs. 4 Satz 4 ArbMedVV) */
function vsKopie(name){
  const eigene = VS_ROWS.filter(v => nwNorm(v.person_name) === nwNorm(name)).sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  const betrieb = ((typeof MARKEN !== "undefined" ? MARKEN : []).find(k => k.slug === AKTIV) || {}).name || "";
  ehsDrucken("Vorsorgekartei – " + name, `<h1>Arbeitsmedizinische Vorsorge – Auszug aus der Vorsorgekartei</h1>
    <p class="leise">${esc(betrieb)} · erstellt am ${esc(ehsDatum(ehsHeute()))} · § 3 Abs. 4 ArbMedVV</p>
    <p><b>Beschäftigte/r:</b> ${esc(name)}</p>
    <table><thead><tr><th>Anlass</th><th>Art</th><th>Vorsorge am</th><th>nächste Vorsorge</th></tr></thead>
      <tbody>${eigene.map(v => `<tr><td>${esc(v.anlass)}</td><td>${esc(VS_ART[v.art] || "")}</td><td>${esc(ehsDatum(v.datum)) || "—"}</td><td>${esc(ehsDatum(v.naechste)) || "—"}</td></tr>`).join("")}</tbody></table>
    <p class="leise">Die Kartei enthält nur Angaben, dass, wann und aus welchem Anlass arbeitsmedizinische Vorsorge stattgefunden hat – keine Befunde.</p>`);
}

function vsDialog(v, danach, vorName){
  const dlg = ehsDialog("vsDlg");
  const w = f => v ? (v[f] == null ? "" : v[f]) : "";
  dlg.innerHTML = `<form method="dialog">
      <h3>${v ? "Vorsorge ändern" : "Vorsorge eintragen"}</h3>
      <p class="pw-hint">Nur Anlass und Termine – keine Befunde oder Diagnosen.</p>
      <label>Name der/des Beschäftigten<input type="text" id="vsPerson" list="vsPersonen" maxlength="120" value="${esc(w("person_name") || vorName || "")}" autocomplete="off"></label>
      <datalist id="vsPersonen">${ehsPersonenListe().map(p => `<option value="${esc(p)}">`).join("")}</datalist>
      <label>Anlass<input type="text" id="vsAnlass" list="vsAnlaesse" maxlength="200" value="${esc(w("anlass"))}" placeholder="z. B. Lärm ab 85 dB(A)" autocomplete="off"></label>
      <datalist id="vsAnlaesse">${VS_ANLAESSE.map(a => `<option value="${esc(a[0])}">`).join("")}</datalist>
      <label>Art<select id="vsArt">${Object.keys(VS_ART).map(a => `<option value="${a}"${a === (w("art") || "pflicht") ? " selected" : ""}>${VS_ART[a]}</option>`).join("")}</select></label>
      <div class="ehs-zwei"><label>Vorsorge am<input type="date" id="vsDatum" value="${esc(w("datum"))}" max="${ehsHeute()}"></label>
        <label>Nächste Vorsorge (laut Bescheinigung)<input type="date" id="vsNaechste" value="${esc(w("naechste"))}"></label></div>
      ${ehsNameFeld("vsWer", "Eingetragen von")}
      <p class="pw-msg" id="vsMsg"></p>
      <div class="pw-akt">${v ? `<button type="button" class="btn-klein kal-weg" id="vsWeg">Löschen</button>` : ""}<button type="button" class="btn sek" id="vsAbbruch">Abbrechen</button><button type="submit" class="btn">Speichern</button></div>
    </form>`;
  const anlass = dlg.querySelector("#vsAnlass");
  anlass.addEventListener("change", () => { const a = VS_ANLAESSE.find(x => x[0] === anlass.value); if(a) dlg.querySelector("#vsArt").value = a[1]; });
  const msg = dlg.querySelector("#vsMsg");
  dlg.querySelector("#vsAbbruch").addEventListener("click", () => dlg.close());
  const weg = dlg.querySelector("#vsWeg");
  if(weg) weg.addEventListener("click", async () => {
    if(!confirm("Eintrag endgültig löschen? (z. B. weil die Beschäftigung beendet ist – vorher „Kopie“ drucken und aushändigen)")) return;
    try{ await apiSend("DELETE", "/rest/v1/portal_vorsorge?id=eq." + encodeURIComponent(v.id), null, "return=minimal"); dlg.close(); if(danach) danach(); }
    catch(e){ msg.textContent = "Konnte nicht gelöscht werden: " + (e.message || e); msg.className = "pw-msg fehler"; }
  });
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); msg.className = "pw-msg";
    const person = dlg.querySelector("#vsPerson").value.trim().replace(/\s+/g, " ");
    if(person.length < 3){ msg.textContent = "Bitte den vollständigen Namen eintragen."; msg.classList.add("fehler"); return; }
    if(anlass.value.trim().length < 2){ msg.textContent = "Bitte den Anlass eintragen."; msg.classList.add("fehler"); return; }
    const d = dlg.querySelector("#vsDatum").value, nx = dlg.querySelector("#vsNaechste").value;
    if(!d && !nx){ msg.textContent = "Bitte Datum der Vorsorge oder den nächsten Termin eintragen."; msg.classList.add("fehler"); return; }
    const wer = ehsNameLesen(dlg, "vsWer"); if(!wer){ msg.textContent = "Bitte Ihren Namen eintragen."; msg.classList.add("fehler"); return; }
    const daten = { person_name: person, anlass: anlass.value.trim(), art: dlg.querySelector("#vsArt").value, datum: d || null, naechste: nx || null,
                    geaendert_von: wer, geaendert_am: new Date().toISOString() };
    try{
      if(v) await apiSend("PATCH", "/rest/v1/portal_vorsorge?id=eq." + encodeURIComponent(v.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_vorsorge", Object.assign({ kunde_slug: AKTIV, erfasst_von: wer }, daten), "return=minimal");
      dlg.close(); if(danach) danach();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
  dlg.showModal();
}

/* OAK Arbeitsschutz-App – Nachweise & Vorsorge, Energie-Effizienzmaßnahmen, Stand der Pflichten + Wochenbericht.
   Portierung aus dem Kundenportal (V1: nachweise.js, energie.js, cockpit.js „Stand der Pflichten", logbuch.js „Wochenbericht").
   Gleiche Tabellen und Ablage wie V1: portal_nachweis (Datei in kundendokumente/<slug>/nachweise/…), portal_vorsorge,
   portal_energiemassnahmen, portal_logbuch, portal_dokumente, unterweisungsnachweise, portal_belegschaft, uw_person, portal_termin.
   portal_nachweis ist zugleich die Quelle der V2-Sicht „Beauftragte" (AS_QUELLEN.as_beauftragter) – nach jedem Speichern
   wird darum neu geladen (asLaden + asZeige).
   Vorsorgekartei nach § 3 Abs. 4 ArbMedVV: bewusst OHNE Befunde, Diagnosen, Freitext oder Datei (Art. 9 DSGVO).
   Alle globalen Namen mit asNw/AS_NW-Präfix (ein gemeinsamer Scope aller V2-Skripte). */
"use strict";

const AS_NW = { nw: [], vs: [], uwPers: [], uwNw: null, beleg: null, fehler: "", filter: { suche: "", art: "", stand: "" }, vsSuche: "", woche: 0, energie: [] };
const AS_NW_ART = { stapler: "Staplerschein", kran: "Kranschein", anschlaeger: "Anschläger", hubarbeitsbuehne: "Hubarbeitsbühne",
  ersthelfer: "Ersthelfer", brandschutzhelfer: "Brandschutzhelfer", sicherheitsbeauftragter: "Sicherheitsbeauftragter",
  elektro: "Elektrofachkraft / EuP", befaehigt: "Befähigte Person (Prüfungen)", sonstiges: "Sonstiger Nachweis" };
/* Hinweis je Art – nur belegte Fundstellen (wie V1) */
const AS_NW_HINWEIS = {
  stapler: "Ausbildung und schriftliche Beauftragung (DGUV Vorschrift 68), jährliche Unterweisung.",
  kran: "Befähigung und Beauftragung (DGUV Vorschrift 52 § 29, DGUV Grundsatz 309-003).",
  anschlaeger: "Gleiche Voraussetzungen wie Kranführer (DGUV Grundsatz 309-003).",
  ersthelfer: "Fortbildung in der Regel alle 2 Jahre (DGUV Vorschrift 1 § 26) – „gültig bis“ wird vorgeschlagen."
};
const AS_NW_BEAUFTRAGUNG = ["stapler", "kran", "anschlaeger", "hubarbeitsbuehne"];
const AS_NW_VS_ART = { pflicht: "Pflichtvorsorge", angebot: "Angebotsvorsorge", wunsch: "Wunschvorsorge" };
/* Anlässe nach Anhang ArbMedVV (Auswahl für die Kunststoffverarbeitung) – Freitext bleibt möglich */
const AS_NW_ANLAESSE = [
  ["Lärm ab 85 dB(A)", "pflicht"], ["Lärm über 80 dB(A)", "angebot"],
  ["Atemschutzgeräte Gruppe 2 oder 3", "pflicht"], ["Atemschutzgeräte Gruppe 1", "angebot"],
  ["Feuchtarbeit ab 4 Stunden täglich", "pflicht"], ["Feuchtarbeit über 2 Stunden täglich", "angebot"],
  ["Tätigkeiten mit Lösemitteln (z. B. Toluol, Xylol, Ethanol, 2-Butanon)", "angebot"],
  ["Haut- oder atemwegssensibilisierende Stoffe", "angebot"], ["Hand-Arm- oder Ganzkörper-Vibrationen", "angebot"],
  ["Lastenhandhabung, repetitive Tätigkeiten, Zwangshaltungen", "angebot"], ["Extreme Hitzebelastung", "pflicht"],
  ["Tätigkeiten an Bildschirmgeräten", "angebot"]
];
const AS_NW_FARBE = { kritisch: "rot", warnung: "gelb", gut: "gruen", grau: "grau" };
const AS_NW_E_STATUS = { offen: "offen", geplant: "geplant", umgesetzt: "umgesetzt" };
const AS_NW_E_FARBE = { offen: "gelb", geplant: "blau", umgesetzt: "gruen" };
const AS_NW_LB_BEREICH = { maengel: "Mängel", unterlagen: "Unterlagen", unterweisungen: "Unterweisungen", vorfaelle: "Vorfälle",
  anfragen: "Fragen zur Arbeitssicherheit", pruefung: "Maschine prüfen", einstellungen: "Einstellungen",
  kalender: "Kalender", nachweise: "Nachweise", vorsorge: "Vorsorge", aufgaben: "Aufgaben", gefahrstoffe: "Gefahrstoffe" };
const AS_NW_LOG_TAB = { as_massnahme: "Maßnahme", as_arbeitssystem: "BdA", as_mitzeichnung: "Mitzeichnung", as_orgcheck: "Organisations-Check", as_asa: "ASA",
  as_ziel: "Ziel", as_meldung: "Meldung", as_beauftragter: "Beauftragte", as_einheit: "Struktur", as_organisation: "Organisation", as_psyche: "Psyche",
  as_thema: "Thema", as_kultur: "Kultur", as_prozess: "Prozess", as_gefaehrdung: "Gefährdung", as_taetigkeit: "Tätigkeit", as_einsatz: "Einsatzzeit" };

/* ---------------- Hilfen ---------------- */
function asNwSlug(){ return "&kunde_slug=eq." + encodeURIComponent(AS.kunde || ""); }
function asNwNorm(s){ return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
function asNwIso(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
/* Tage bis zum Datum (negativ = vorbei) */
function asNwTage(s){
  if(!s) return null;
  const t = String(s).slice(0, 10).split("-").map(Number); if(t.length !== 3) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  return Math.round((new Date(t[0], t[1] - 1, t[2]) - heute) / 86400000);
}
function asNwPlusMonate(iso, m){ const t = String(iso).slice(0, 10).split("-").map(Number); return asNwIso(new Date(t[0], t[1] - 1 + m, t[2])); }
function asNwArtLabel(a){ return AS_NW_ART[a] || "Nachweis"; }
/* ein jüngerer Nachweis derselben Person und Art ersetzt den älteren (kein Ablauf-Alarm mehr) */
function asNwErsetzt(n){
  return AS_NW.nw.some(x => x.id !== n.id && !x.archiviert && x.art === n.art && asNwNorm(x.person_name) === asNwNorm(n.person_name)
    && (x.art !== "sonstiges" || asNwNorm(x.bezeichnung) === asNwNorm(n.bezeichnung))
    && String(x.gueltig_bis || "9999") > String(n.gueltig_bis || "9999"));
}
function asNwVsErsetzt(v){
  return AS_NW.vs.some(x => x.id !== v.id && asNwNorm(x.anlass) === asNwNorm(v.anlass) && asNwNorm(x.person_name) === asNwNorm(v.person_name)
    && String(x.datum || "") > String(v.datum || ""));
}
function asNwStand(datum, ersetzt){
  if(ersetzt) return { klasse: "grau", text: "ersetzt" };
  if(!datum) return { klasse: "gut", text: "ohne Ablauf" };
  const t = asNwTage(datum);
  if(t < 0) return { klasse: "kritisch", text: "abgelaufen" };
  if(t <= 60) return { klasse: "warnung", text: "läuft ab in " + t + " Tagen" };
  return { klasse: "gut", text: "gültig" };
}
function asNwVsStand(v){
  if(asNwVsErsetzt(v)) return { klasse: "grau", text: "ersetzt" };
  if(!v.naechste) return { klasse: "gut", text: "kein Folgetermin" };
  const t = asNwTage(v.naechste);
  if(t < 0) return { klasse: "kritisch", text: "überfällig" };
  if(t <= 60) return { klasse: "warnung", text: "fällig in " + t + " Tagen" };
  return { klasse: "gut", text: "gültig" };
}
function asNwDateiOk(datei){
  if(!datei) return true;
  if(datei.size > 15 * 1024 * 1024) throw new Error("Die Datei ist größer als 15 MB.");
  if(!/\.(pdf|jpe?g|png|webp)$/i.test(datei.name)) throw new Error("Bitte ein PDF oder Foto (JPG, PNG) wählen.");
  return true;
}
function asNwDateiName(datei){ return datei.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-"); }
async function asNwHochladen(datei, pfad){
  const t = await token(); if(!t) throw new Error("Bitte neu anmelden.");
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad.split("/").map(encodeURIComponent).join("/"), { method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": datei.type || "application/octet-stream", "x-upsert": "true" }, body: datei });
  if(!r.ok) throw new Error("Datei konnte nicht hochgeladen werden (" + r.status + ")");
  return pfad;
}
/* Druckt eine kleine HTML-Seite über einen unsichtbaren Rahmen (wie V1 ehsDrucken) */
function asNwDrucken(titel, inhalt){
  let f = document.getElementById("asNwDruckRahmen"); if(f) f.remove();
  f = document.createElement("iframe"); f.id = "asNwDruckRahmen"; f.title = "Druck";
  f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
  f.onload = () => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} };
  f.srcdoc = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title><style>
    body{font:12pt/1.45 "Jost","Segoe UI",Arial,sans-serif;color:#1b1b1b;margin:18mm}
    h1{font-size:18pt;margin:0 0 4pt} h2{font-size:13pt;margin:16pt 0 6pt;border-bottom:1px solid #999;padding-bottom:2pt} h3{font-size:11.5pt;margin:10pt 0 3pt}
    table{width:100%;border-collapse:collapse;margin:6pt 0} th,td{border:1px solid #bbb;padding:4pt 6pt;text-align:left;vertical-align:top;font-size:10.5pt}
    th{background:#eef2ef} ul{margin:4pt 0 8pt;padding-left:16pt} li{margin:2pt 0} .leise,.hinweis{color:#555;font-size:10pt}
    @page{size:A4;margin:0}</style></head><body>${inhalt}</body></html>`;
  document.body.appendChild(f);
}
function asNwBetrieb(){ return (AS.org && AS.org.name) || (AS.kundeV1 && AS.kundeV1.name) || ""; }

/* ---------------- Daten ---------------- */
async function asNwLaden(){
  const k = asNwSlug(); AS_NW.fehler = "";
  const [a, b, p] = await Promise.all([
    apiGet("/rest/v1/portal_nachweis?select=*&or=(archiviert.is.null,archiviert.is.false)" + k + "&order=person_name.asc").catch(e => { AS_NW.fehler = e.message || String(e); return []; }),
    apiGet("/rest/v1/portal_vorsorge?select=*" + k + "&order=person_name.asc").catch(e => { AS_NW.fehler = e.message || String(e); return []; }),
    apiGet("/rest/v1/uw_person?select=id,name,status" + k + "&order=name.asc").catch(() => [])]);
  AS_NW.nw = a || []; AS_NW.vs = b || []; AS_NW.uwPers = (p || []).filter(x => x.status !== "archiviert");
}
/* Unterweisungen wie V1 (uwFaelligZahl / uwBelegZahlen): jüngster Nachweis je Name, gültig 12 Monate */
async function asNwUwLaden(){
  const k = asNwSlug();
  const [nw, beleg] = await Promise.all([
    apiGet("/rest/v1/unterweisungsnachweise?select=id,kunde_slug,mitarbeiter_name,bereich,created_at" + k + "&order=created_at.desc").catch(() => null),
    apiGet("/rest/v1/portal_belegschaft?select=*" + k).catch(() => [])]);
  AS_NW.uwNw = nw; AS_NW.beleg = (beleg || [])[0] || null;
}
/* Person aus der Belegschaft zum eingetragenen Namen (Stufe 4: Nachweise und Vorsorge hängen an der Person,
   damit „Person scheidet aus“ Beauftragungen beendet und Vorsorge-Erinnerungen stoppt) */
function asNwPersonId(name){ const n = asNwNorm(name); const p = AS_NW.uwPers.find(x => asNwNorm(x.name) === n); return p ? p.id : null; }
function asNwPersonen(){
  const namen = new Set();
  AS_NW.uwPers.forEach(p => namen.add(p.name));
  AS_NW.nw.forEach(n => namen.add(n.person_name));
  AS_NW.vs.forEach(v => namen.add(v.person_name));
  asT("as_beauftragter").forEach(b => namen.add(b.person));
  return [...namen].filter(Boolean).sort((a, b) => a.localeCompare(b, "de"));
}
function asNwUwJeName(rows){
  const map = new Map();
  (rows || []).forEach(n => { const k = (n.mitarbeiter_name || "").trim().toLowerCase(); if(!k) return;
    const alt = map.get(k); if(!alt || new Date(n.created_at) > new Date(alt.created_at)) map.set(k, n); });
  return [...map.values()];
}
function asNwUwKlasse(n){
  const t = n && n.created_at ? Math.floor((Date.now() - new Date(n.created_at).getTime()) / 864e5) : null;
  if(t === null) return "grau";
  return t >= 365 ? "kritisch" : t >= 335 ? "warnung" : "gut";
}
function asNwUwZahlen(){
  if(!AS_NW.uwNw) return null;
  const rows = AS_NW.uwNw, b = AS_NW.beleg;
  let beleg = null, faellig;
  if(b){
    const gueltig = asNwUwJeName(rows).filter(n => asNwUwKlasse(n) !== "kritisch");
    const leihOk = gueltig.filter(n => /leih|zeitarb/i.test(n.bereich || "")).length, stammOk = gueltig.length - leihOk;
    beleg = { stamm: b.stamm || 0, stammOk: Math.min(stammOk, b.stamm || 0) };
    faellig = Math.max(0, (b.stamm || 0) - stammOk) + Math.max(0, (b.leih || 0) - leihOk);
  } else {
    const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim().split(" ").sort().join(" ");
    const letzter = name => { let best = null; rows.forEach(n => { if(norm(n.mitarbeiter_name) === norm(name) && (!best || new Date(n.created_at) > new Date(best.created_at))) best = n; }); return best; };
    const pers = AS_NW.uwPers;
    faellig = pers.filter(p => { const n = letzter(p.name); return !n || asNwUwKlasse(n) !== "gut"; }).length
      + asNwUwJeName(rows).filter(n => !pers.some(p => norm(p.name) === norm(n.mitarbeiter_name)) && asNwUwKlasse(n) !== "gut").length;
  }
  return { faellig, beleg };
}

/* ======================= Nachweise & Vorsorge ======================= */
AS_SEITEN.nachweise = { titel: "Nachweise & Vorsorge", icon: "◈", sort: 2.5, async render(main){
  const r = asReiter("nachweise", [["qualifikation", "Qualifikationen"], ["vorsorge", "Betriebsärztliche Vorsorge"]], "qualifikation");
  main.innerHTML = `<h1 class="seite">Nachweise &amp; Vorsorge</h1>
    <p class="unter">Staplerscheine, Kranscheine, Ersthelfer … mit Ablauf und Beauftragung – und die Vorsorgekartei nach ArbMedVV.</p>
    ${r.html}<div id="asNwInhalt"><div class="karte"><div class="leer">wird geladen …</div></div></div>`;
  await asNwLaden();
  const box = document.getElementById("asNwInhalt");
  if(!box || AS.seite !== "nachweise") return;
  if(r.akt === "vorsorge") asNwVsListe(box); else asNwListe(box);
}};

function asNwListe(box){
  const rang = { kritisch: 0, warnung: 1, gut: 2, grau: 3 };
  const zeilen = AS_NW.nw.map(n => ({ n, st: asNwStand(n.gueltig_bis, asNwErsetzt(n)) }))
    .sort((a, b) => (rang[a.st.klasse] - rang[b.st.klasse]) || String(a.n.person_name).localeCompare(String(b.n.person_name), "de"));
  const arten = [...new Set(AS_NW.nw.map(n => n.art))];
  const F = AS_NW.filter;
  box.innerHTML = `${AS_NW.fehler ? `<div class="karte"><div class="leer">Nachweise konnten nicht vollständig geladen werden: ${esc(AS_NW.fehler)}</div></div>` : ""}
    <div class="karte"><h2>Qualifikationen <span class="nodruck"><button class="btn sek klein" id="asNwDruck">Drucken</button> <button class="btn klein" id="asNwNeu">Nachweis eintragen</button></span></h2>
      <div class="filterleiste nodruck">
        <input type="search" id="asNwSuche" placeholder="Name suchen" autocomplete="off" value="${esc(F.suche)}">
        <select id="asNwArtF" aria-label="Nachweis"><option value="">Nachweis: alle</option>${arten.map(a => `<option value="${esc(a)}"${a === F.art ? " selected" : ""}>Nachweis: ${esc(asNwArtLabel(a))}</option>`).join("")}</select>
        <select id="asNwStandF" aria-label="Stand"><option value="">Stand: alle</option><option value="faellig"${F.stand === "faellig" ? " selected" : ""}>Stand: abgelaufen oder läuft ab</option></select>
        <span class="fl-zahl" id="asNwZahl"></span></div>
      ${zeilen.length ? `<div class="tabwrap"><table class="tab" id="asNwTab"><thead><tr><th>Name</th><th>Nachweis</th><th>ausgestellt</th><th>gültig bis</th><th>Stand</th><th></th></tr></thead>
        <tbody>${zeilen.map(({ n, st }) => `<tr data-name="${esc(asNwNorm(n.person_name))}" data-art="${esc(n.art)}" data-stand="${st.klasse}">
          <td><b>${esc(n.person_name)}</b>${n.as_einheit_id ? `<div class="hinweis">${esc(asEinheitName(n.as_einheit_id))}</div>` : ""}</td>
          <td>${esc(asNwArtLabel(n.art))}${n.bezeichnung ? `<div class="hinweis">${esc(n.bezeichnung)}</div>` : ""}${AS_NW_BEAUFTRAGUNG.includes(n.art) ? `<div class="hinweis">${n.beauftragt ? "schriftlich beauftragt" : `<b style="color:var(--rot)">Beauftragung fehlt</b>`}</div>` : ""}</td>
          <td>${n.ausgestellt_am ? asDat(n.ausgestellt_am) : "–"}</td><td>${n.gueltig_bis ? asDat(n.gueltig_bis) : "–"}</td>
          <td>${asChip(st.text, AS_NW_FARBE[st.klasse])}</td>
          <td class="nodruck" style="white-space:nowrap">${n.datei_pfad ? `<button class="btn sek klein" data-datei="${esc(n.datei_pfad)}" data-titel="${esc(asNwArtLabel(n.art) + " · " + n.person_name)}">Datei</button> ` : ""}<button class="btn sek klein" data-nw="${esc(n.id)}">ändern</button></td></tr>`).join("")}</tbody></table></div>`
        : `<div class="leer">Noch keine Nachweise eingetragen. Staplerscheine, Kranscheine, Ersthelfer … mit <b>„Nachweis eintragen“</b> erfassen – Abläufe erscheinen dann im Kalender und auf der Startseite.</div>`}
      <p class="hinweis">Gleiche Einträge wie unter Organisation → Beauftragte und im Kundenportal. Ein jüngerer Nachweis derselben Person und Art ersetzt den älteren.</p></div>`;
  const filtern = () => {
    const s = box.querySelector("#asNwSuche"), a = box.querySelector("#asNwArtF"), st = box.querySelector("#asNwStandF");
    AS_NW.filter = { suche: s.value, art: a.value, stand: st.value };
    const q = asNwNorm(s.value); let z = 0;
    box.querySelectorAll("#asNwTab tbody tr").forEach(tr => { const ok = (!q || tr.dataset.name.includes(q)) && (!a.value || tr.dataset.art === a.value)
      && (!st.value || tr.dataset.stand === "kritisch" || tr.dataset.stand === "warnung"); tr.hidden = !ok; if(ok) z++; });
    box.querySelector("#asNwZahl").textContent = zeilen.length ? z + " von " + zeilen.length : "";
  };
  box.querySelector("#asNwSuche").oninput = filtern;
  box.querySelector("#asNwArtF").onchange = filtern;
  box.querySelector("#asNwStandF").onchange = filtern;
  filtern();
  box.querySelector("#asNwNeu").onclick = () => asNwDialog(null);
  box.querySelector("#asNwDruck").onclick = () => {
    const f = AS_NW.filter, q = asNwNorm(f.suche);
    const sicht = zeilen.filter(({ n, st }) => (!q || asNwNorm(n.person_name).includes(q)) && (!f.art || n.art === f.art)
      && (!f.stand || st.klasse === "kritisch" || st.klasse === "warnung"));
    asNwDrucken("Qualifikationsnachweise", `<h1>Qualifikationsnachweise der Beschäftigten</h1>
      <p class="leise">${esc(asNwBetrieb())} · Stand ${esc(asDat(asHeute()))}</p>
      <table><thead><tr><th>Name</th><th>Nachweis</th><th>ausgestellt</th><th>gültig bis</th><th>Beauftragung</th><th>Stand</th></tr></thead>
      <tbody>${sicht.map(({ n, st }) => `<tr><td>${esc(n.person_name)}</td><td>${esc(asNwArtLabel(n.art))}${n.bezeichnung ? "<br><span class=\"leise\">" + esc(n.bezeichnung) + "</span>" : ""}</td>
        <td>${n.ausgestellt_am ? esc(asDat(n.ausgestellt_am)) : "–"}</td><td>${n.gueltig_bis ? esc(asDat(n.gueltig_bis)) : "–"}</td>
        <td>${AS_NW_BEAUFTRAGUNG.includes(n.art) ? (n.beauftragt ? "schriftlich beauftragt" : "fehlt") : "–"}</td><td>${esc(st.text)}</td></tr>`).join("")}</tbody></table>`);
  };
  box.querySelectorAll("[data-nw]").forEach(b => b.onclick = () => asNwDialog(AS_NW.nw.find(n => n.id === b.dataset.nw)));
  box.querySelectorAll("[data-datei]").forEach(b => b.onclick = async () => {
    const u = await asSigniert(b.dataset.datei);
    if(u) asDokOeffnen(u, b.dataset.titel); else asMeldung("Datei konnte nicht geöffnet werden.");
  });
}

function asNwDialog(n){
  const w = f => n && n[f] != null ? n[f] : "";
  const einheiten = [["", "– Betrieb gesamt –"]].concat(asT("as_einheit").map(e => [e.id, e.name]));
  const kn = [];
  if(n) kn.push({ t: "Entfernen", klasse: "gefahr", fn: async d => {
    const wer = String(asWerte(d).wer || "").replace(/\s+/g, " ");
    if(wer.length < 3){ asMeldung("Bitte Ihren Namen eintragen."); return false; }
    if(!confirm("Nachweis entfernen? Er bleibt im Logbuch nachvollziehbar.")) return false;
    await apiSend("PATCH", "/rest/v1/portal_nachweis?id=eq." + encodeURIComponent(n.id), { archiviert: true, geaendert_von: wer, geaendert_am: new Date().toISOString() }, "return=minimal");
    await asLaden(); asZeige(); asMeldung("Nachweis entfernt.");
  } });
  kn.push({ t: "Speichern", fn: async d => {
    const x = asWerte(d);
    const person = String(x.person_name || "").replace(/\s+/g, " ");
    if(person.length < 3){ asMeldung("Bitte den vollständigen Namen eintragen."); return false; }
    if(x.gueltig_bis && x.ausgestellt_am && x.gueltig_bis < x.ausgestellt_am){ asMeldung("„Gültig bis“ liegt vor dem Ausstellungsdatum."); return false; }
    const wer = String(x.wer || "").replace(/\s+/g, " ");
    if(wer.length < 3){ asMeldung("Bitte Ihren Namen eintragen."); return false; }
    const datei = (d.querySelector("#asNwDatei").files || [])[0];
    asNwDateiOk(datei);
    asMeldung("Wird gespeichert …");
    let pfad = n ? n.datei_pfad : null;
    if(datei) pfad = await asNwHochladen(datei, AS.kunde + "/nachweise/" + Date.now() + "-" + asNwDateiName(datei));
    const daten = { person_name: person, person_id: asNwPersonId(person), art: x.art, bezeichnung: x.bezeichnung || null,
      ausgestellt_am: x.ausgestellt_am || null, gueltig_bis: x.gueltig_bis || null,
      beauftragt: AS_NW_BEAUFTRAGUNG.includes(x.art) ? !!x.beauftragt : !!(n && n.beauftragt),
      aussteller: x.aussteller || null, datei_pfad: pfad, notiz: x.notiz || null, as_einheit_id: x.as_einheit_id || null,
      geaendert_von: wer, geaendert_am: new Date().toISOString() };
    if(n) await apiSend("PATCH", "/rest/v1/portal_nachweis?id=eq." + encodeURIComponent(n.id), daten, "return=minimal");
    else await apiSend("POST", "/rest/v1/portal_nachweis", Object.assign({ kunde_slug: AS.kunde, erfasst_von: wer, archiviert: false }, daten), "return=minimal");
    await asLaden(); asZeige(); asMeldung("Nachweis gespeichert.");
  } });
  const d = asDialog({ titel: n ? "Nachweis ändern" : "Nachweis eintragen", knoepfe: kn, inhalt: `<div class="form">
      <label class="voll">Name der/des Beschäftigten<input type="text" data-f="person_name" list="asNwPersonen" maxlength="120" value="${esc(w("person_name"))}" autocomplete="off"></label>
      <datalist id="asNwPersonen">${asNwPersonen().map(p => `<option value="${esc(p)}">`).join("")}</datalist>
      ${asAuswahl("Art", "art", w("art") || "stapler", Object.entries(AS_NW_ART))}
      ${asBereichWahl("Bereich", "as_einheit_id", n ? (w("as_einheit_id") || "") : null, "", "– betriebsweit –")}
      <p class="hinweis voll" id="asNwHinweis"></p>
      <label class="voll">Bezeichnung (z. B. Frontstapler, Flurbedienter Kran)<input type="text" data-f="bezeichnung" maxlength="200" value="${esc(w("bezeichnung"))}"></label>
      ${asFeld("Ausgestellt am", "ausgestellt_am", w("ausgestellt_am"), "date")}
      ${asFeld("Gültig bis (leer = ohne Ablauf)", "gueltig_bis", w("gueltig_bis"), "date")}
      <label class="voll" id="asNwBeaufWrap" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" data-f="beauftragt"${n && n.beauftragt ? " checked" : ""}> schriftliche Beauftragung liegt vor</label>
      <label class="voll">Ausgestellt von (Schulungsstelle)<input type="text" data-f="aussteller" maxlength="200" value="${esc(w("aussteller"))}"></label>
      <label class="voll">Nachweis als PDF oder Foto ${n && n.datei_pfad ? "(vorhanden – neue Datei ersetzt sie)" : "(optional)"}<input type="file" id="asNwDatei" accept=".pdf,image/jpeg,image/png,image/webp"></label>
      <label class="voll">Notiz<textarea data-f="notiz" maxlength="2000">${esc(w("notiz"))}</textarea></label>
      ${asFeld("Eingetragen von", "wer", AS.ich, "text", "voll")}</div>` });
  const art = d.querySelector('[data-f="art"]'), aus = d.querySelector('[data-f="ausgestellt_am"]'), bis = d.querySelector('[data-f="gueltig_bis"]');
  const artGeaendert = () => { d.querySelector("#asNwHinweis").textContent = AS_NW_HINWEIS[art.value] || "";
    d.querySelector("#asNwBeaufWrap").style.display = AS_NW_BEAUFTRAGUNG.includes(art.value) ? "flex" : "none"; };
  art.onchange = artGeaendert; artGeaendert();
  aus.onchange = () => { if(art.value === "ersthelfer" && aus.value && !bis.value) bis.value = asNwPlusMonate(aus.value, 24); };
}

function asNwVsListe(box){
  const rang = { kritisch: 0, warnung: 1, gut: 2, grau: 3 };
  const zeilen = AS_NW.vs.filter(v => !v.abgeschlossen_am).map(v => ({ v, st: asNwVsStand(v) }))
    .sort((a, b) => (rang[a.st.klasse] - rang[b.st.klasse]) || String(a.v.person_name).localeCompare(String(b.v.person_name), "de"));
  box.innerHTML = `${AS_NW.fehler ? `<div class="karte"><div class="leer">Vorsorge konnte nicht vollständig geladen werden: ${esc(AS_NW.fehler)}</div></div>` : ""}
    <div class="karte"><h2>Betriebsärztliche Vorsorge <button class="btn klein nodruck" id="asNwVsNeu">Vorsorge eintragen</button></h2>
      <p class="hinweis" style="background:var(--gelb2);padding:8px 10px;border-radius:8px"><b>Vorsorgekartei nach § 3 Abs. 4 ArbMedVV</b> – nur Anlass, Datum und nächster Termin laut Vorsorgebescheinigung.
        Keine Befunde, Diagnosen oder ärztlichen Unterlagen eintragen. Nach dem Ausscheiden löschen; die Person erhält vorher eine Kopie ihrer Angaben.</p>
      <div class="filterleiste nodruck"><input type="search" id="asNwVsSuche" placeholder="Name suchen" autocomplete="off" value="${esc(AS_NW.vsSuche)}"><span class="hinweis" id="asNwVsZahl"></span></div>
      ${zeilen.length ? `<div class="tabwrap"><table class="tab" id="asNwVsTab"><thead><tr><th>Name</th><th>Anlass</th><th>letzte Vorsorge</th><th>nächste</th><th>Stand</th><th></th></tr></thead>
        <tbody>${zeilen.map(({ v, st }) => `<tr data-name="${esc(asNwNorm(v.person_name))}"><td><b>${esc(v.person_name)}</b></td>
          <td>${esc(v.anlass)}<div class="hinweis">${esc(AS_NW_VS_ART[v.art] || "")}</div></td>
          <td>${v.datum ? asDat(v.datum) : "–"}</td><td>${v.naechste ? asDat(v.naechste) : "–"}</td>
          <td>${asChip(st.text, AS_NW_FARBE[st.klasse])}</td>
          <td class="nodruck" style="white-space:nowrap"><button class="btn sek klein" data-kopie="${esc(v.person_name)}">Kopie</button> <button class="btn sek klein" data-vs="${esc(v.id)}">ändern</button></td></tr>`).join("")}</tbody></table></div>`
        : `<div class="leer">Noch keine Vorsorge eingetragen. Nach jedem Termin beim Betriebsarzt Anlass, Datum und den nächsten Termin aus der Vorsorgebescheinigung übernehmen.</div>`}</div>`;
  const s = box.querySelector("#asNwVsSuche");
  const filtern = () => { AS_NW.vsSuche = s.value; const q = asNwNorm(s.value); let z = 0;
    box.querySelectorAll("#asNwVsTab tbody tr").forEach(tr => { const ok = !q || tr.dataset.name.includes(q); tr.hidden = !ok; if(ok) z++; });
    box.querySelector("#asNwVsZahl").textContent = zeilen.length ? z + " von " + zeilen.length : ""; };
  s.oninput = filtern; filtern();
  box.querySelector("#asNwVsNeu").onclick = () => asNwVsDialog(null);
  box.querySelectorAll("[data-vs]").forEach(b => b.onclick = () => asNwVsDialog(AS_NW.vs.find(v => v.id === b.dataset.vs)));
  box.querySelectorAll("[data-kopie]").forEach(b => b.onclick = () => asNwVsKopie(b.dataset.kopie));
}
/* Kopie der Angaben für die Person (§ 3 Abs. 4 Satz 4 ArbMedVV) */
function asNwVsKopie(name){
  const eigene = AS_NW.vs.filter(v => asNwNorm(v.person_name) === asNwNorm(name)).sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  asNwDrucken("Vorsorgekartei – " + name, `<h1>Arbeitsmedizinische Vorsorge – Auszug aus der Vorsorgekartei</h1>
    <p class="leise">${esc(asNwBetrieb())} · erstellt am ${esc(asDat(asHeute()))} · § 3 Abs. 4 ArbMedVV</p>
    <p><b>Beschäftigte/r:</b> ${esc(name)}</p>
    <table><thead><tr><th>Anlass</th><th>Art</th><th>Vorsorge am</th><th>nächste Vorsorge</th></tr></thead>
      <tbody>${eigene.map(v => `<tr><td>${esc(v.anlass)}</td><td>${esc(AS_NW_VS_ART[v.art] || "")}</td><td>${v.datum ? esc(asDat(v.datum)) : "–"}</td><td>${v.naechste ? esc(asDat(v.naechste)) : "–"}</td></tr>`).join("")}</tbody></table>
    <p class="leise">Die Kartei enthält nur Angaben, dass, wann und aus welchem Anlass arbeitsmedizinische Vorsorge stattgefunden hat – keine Befunde.</p>`);
}
function asNwVsDialog(v){
  const w = f => v && v[f] != null ? v[f] : "";
  const kn = [];
  if(v) kn.push({ t: "Löschen", klasse: "gefahr", fn: async () => {
    if(!confirm("Eintrag endgültig löschen? (z. B. weil die Beschäftigung beendet ist – vorher „Kopie“ drucken und aushändigen)")) return false;
    await apiSend("DELETE", "/rest/v1/portal_vorsorge?id=eq." + encodeURIComponent(v.id), null, "return=minimal");
    asZeige(); asMeldung("Eintrag gelöscht.");
  } });
  kn.push({ t: "Speichern", fn: async d => {
    const x = asWerte(d);
    const person = String(x.person_name || "").replace(/\s+/g, " ");
    if(person.length < 3){ asMeldung("Bitte den vollständigen Namen eintragen."); return false; }
    if(String(x.anlass || "").length < 2){ asMeldung("Bitte den Anlass eintragen."); return false; }
    if(!x.datum && !x.naechste){ asMeldung("Bitte Datum der Vorsorge oder den nächsten Termin eintragen."); return false; }
    if(x.datum && x.datum > asNwIso(new Date())){ asMeldung("Das Datum der Vorsorge liegt in der Zukunft – dafür „Nächste Vorsorge“ nutzen."); return false; }
    const wer = String(x.wer || "").replace(/\s+/g, " ");
    if(wer.length < 3){ asMeldung("Bitte Ihren Namen eintragen."); return false; }
    /* Nur diese Felder – keine Befunde, kein Freitext, keine Datei (Art. 9 DSGVO) */
    const daten = { person_name: person, person_id: asNwPersonId(person), anlass: x.anlass, art: AS_NW_VS_ART[x.art] ? x.art : "pflicht", datum: x.datum || null, naechste: x.naechste || null,
      geaendert_von: wer, geaendert_am: new Date().toISOString() };
    if(v) await apiSend("PATCH", "/rest/v1/portal_vorsorge?id=eq." + encodeURIComponent(v.id), daten, "return=minimal");
    else await apiSend("POST", "/rest/v1/portal_vorsorge", Object.assign({ kunde_slug: AS.kunde, erfasst_von: wer }, daten), "return=minimal");
    asZeige(); asMeldung("Vorsorge gespeichert.");
  } });
  const d = asDialog({ titel: v ? "Vorsorge ändern" : "Vorsorge eintragen", knoepfe: kn, inhalt: `<p class="hinweis">Nur Anlass und Termine – keine Befunde oder Diagnosen.</p><div class="form">
      <label class="voll">Name der/des Beschäftigten<input type="text" data-f="person_name" list="asNwVsPersonen" maxlength="120" value="${esc(w("person_name"))}" autocomplete="off"></label>
      <datalist id="asNwVsPersonen">${asNwPersonen().map(p => `<option value="${esc(p)}">`).join("")}</datalist>
      <label class="voll">Anlass<input type="text" data-f="anlass" list="asNwAnlaesse" maxlength="200" value="${esc(w("anlass"))}" placeholder="z. B. Lärm ab 85 dB(A)" autocomplete="off"></label>
      <datalist id="asNwAnlaesse">${AS_NW_ANLAESSE.map(a => `<option value="${esc(a[0])}">`).join("")}</datalist>
      ${asAuswahl("Art", "art", w("art") || "pflicht", Object.entries(AS_NW_VS_ART), "voll")}
      <label>Vorsorge am<input type="date" data-f="datum" value="${esc(w("datum"))}" max="${asNwIso(new Date())}"></label>
      ${asFeld("Nächste Vorsorge (laut Bescheinigung)", "naechste", w("naechste"), "date")}
      ${asFeld("Eingetragen von", "wer", AS.ich, "text", "voll")}</div>` });
  const anlass = d.querySelector('[data-f="anlass"]');
  anlass.onchange = () => { const a = AS_NW_ANLAESSE.find(x => x[0] === anlass.value); if(a) d.querySelector('[data-f="art"]').value = a[1]; };
}

/* ======================= Energie – Effizienzmaßnahmen ======================= */
AS_SEITEN.energie = { titel: "Energie", icon: "↯", sort: 8.5, async render(main){
  main.innerHTML = `<h1 class="seite">Effizienzmaßnahmen</h1><p class="unter">Energiebefunde aus den Begehungen und die daraus abgeleiteten Maßnahmen.</p><div class="karte"><div class="leer">wird geladen …</div></div>`;
  let fehler = "";
  try{ AS_NW.energie = await apiGet("/rest/v1/portal_energiemassnahmen?select=*" + asNwSlug() + "&order=status.asc,festgestellt_am.desc") || []; }
  catch(e){ AS_NW.energie = []; fehler = e.message || String(e); }
  if(AS.seite !== "energie") return;
  const rows = AS_NW.energie, nach = s => rows.filter(m => m.status === s).length, offen = nach("offen");
  main.innerHTML = `<h1 class="seite">Effizienzmaßnahmen</h1>
    <p class="unter">Energiebefunde aus den Begehungen und die daraus abgeleiteten Maßnahmen.
      Sie stehen bewusst getrennt von der Mängelliste Arbeitsschutz: <b>keine Sicherheitsrelevanz, aber ein Kostenthema</b> – und der Einstieg in ein Energiemanagement nach ISO 50001.</p>
    ${fehler ? `<div class="karte"><div class="leer">Maßnahmen konnten nicht geladen werden: ${esc(fehler)}</div></div>` : ""}
    <div class="kacheln">
      <div class="kachel k-${offen ? "gelb" : "gruen"}"><div class="lbl">offene Maßnahmen</div><div class="zahl">${offen}</div><div class="hinweis">${rows.length} Befunde insgesamt</div></div>
      <div class="kachel"><div class="lbl">geplant</div><div class="zahl">${nach("geplant")}</div><div class="hinweis">Umsetzung terminiert</div></div>
      <div class="kachel k-${nach("umgesetzt") ? "gruen" : "grau"}"><div class="lbl">umgesetzt</div><div class="zahl">${nach("umgesetzt")}</div><div class="hinweis">abgeschlossen</div></div></div>
    <div class="karte"><h2>Effizienzmaßnahmen <span class="hinweis">${rows.length} ${rows.length === 1 ? "Eintrag" : "Einträge"}${offen ? " · " + offen + " offen" : ""}</span>
      ${AS.admin ? `<button class="btn adm klein" id="asNwENeu">+ Maßnahme erfassen</button>` : ""}</h2>
      ${rows.length ? rows.map(asNwEKarte).join("") : `<div class="leer">Noch keine Energiebefunde erfasst.</div>`}</div>`;
  const neu = document.getElementById("asNwENeu"); if(neu) neu.onclick = asNwEDialog;
  if(!AS.admin) return;
  main.querySelectorAll("[data-estatus]").forEach(s => s.onchange = async () => {
    s.disabled = true;
    try{ await asNwESpeichern(s.dataset.estatus, { status: s.value }); const m = rows.find(x => x.id === s.dataset.estatus); if(m) m.status = s.value; asMeldung("Status gespeichert."); }
    catch(e){ asMeldung("Status konnte nicht gespeichert werden: " + (e.message || e)); }
    finally{ s.disabled = false; }
  });
  main.querySelectorAll("[data-enotiz]").forEach(t => t.onchange = async () => {
    t.disabled = true;
    try{ await asNwESpeichern(t.dataset.enotiz, { notiz: t.value }); const m = rows.find(x => x.id === t.dataset.enotiz); if(m) m.notiz = t.value; asMeldung("Notiz gespeichert."); }
    catch(e){ asMeldung("Notiz konnte nicht gespeichert werden: " + (e.message || e)); }
    finally{ t.disabled = false; }
  });
}};
function asNwEKarte(m){
  const farbe = AS_NW_E_FARBE[m.status] || "gelb";
  const status = AS.admin
    ? `<select data-estatus="${esc(m.id)}">${Object.entries(AS_NW_E_STATUS).map(([k, l]) => `<option value="${k}"${m.status === k ? " selected" : ""}>${l}</option>`).join("")}</select>`
    : asChip(AS_NW_E_STATUS[m.status] || m.status || "offen", farbe);
  const zeilen = [
    ["Ort / Anlage", esc(m.ort || "–")],
    ["Festgestellt", (m.festgestellt_am ? asDat(m.festgestellt_am) : "–") + (m.quelle ? " · " + esc(m.quelle) : "")],
    ["Maßnahme", esc(m.massnahme || "–")],
    ["Einsparung", m.einsparung ? esc(m.einsparung) : "<i>nicht beziffert – Messung ausstehend</i>"]];
  const notiz = AS.admin
    ? `<label class="hinweis" style="display:flex;flex-direction:column;gap:4px;margin-top:8px">Bearbeitungsstand<textarea data-enotiz="${esc(m.id)}" rows="2" placeholder="Was ist veranlasst?">${esc(m.notiz || "")}</textarea></label>`
    : (m.notiz ? `<p class="hinweis" style="margin-top:6px"><b>Bearbeitung:</b> ${esc(m.notiz)}</p>` : "");
  return `<details style="border-top:1px solid var(--linie);padding:10px 4px">
    <summary style="cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap">${asPunkt(farbe)}<span class="hinweis">${m.festgestellt_am ? asDat(m.festgestellt_am) : "–"}</span>
      <b style="flex:1">${esc(m.titel)}</b>${asChip(AS_NW_E_STATUS[m.status] || m.status || "offen", farbe)}</summary>
    <div style="margin-top:8px">${AS.admin ? `<div class="form"><label>Status${status}</label></div>` : ""}
      <p>${esc(m.beschreibung || "").replace(/\n/g, "<br>")}</p>
      <table class="tab">${zeilen.map(([k, v]) => `<tr><th style="width:140px">${k}</th><td>${v}</td></tr>`).join("")}</table>
      ${notiz}<p class="hinweis">Erfasst ${m.angelegt_am ? asDat(m.angelegt_am) : "–"}</p></div></details>`;
}
async function asNwESpeichern(id, felder){
  felder.updated_at = new Date().toISOString();
  await apiSend("PATCH", "/rest/v1/portal_energiemassnahmen?id=eq." + encodeURIComponent(id), felder, "return=minimal");
}
function asNwEDialog(){
  asDialog({ titel: "Energiemaßnahme erfassen", inhalt: `<div class="form">
      <label class="voll">Befund (Kurztitel)<input type="text" data-f="titel" placeholder="z. B. Druckluftleckage an der Kupplung"></label>
      ${asFeld("Beschreibung", "beschreibung", "", "textarea", "voll")}
      <label>Ort / Anlage<input type="text" data-f="ort" placeholder="z. B. D150/3 oder betriebsweit"></label>
      ${asFeld("Festgestellt am", "festgestellt_am", asHeute(), "date")}
      ${asFeld("Maßnahme", "massnahme", "", "textarea", "voll")}
      <label class="voll">Einsparung<input type="text" data-f="einsparung" placeholder="leer lassen, solange nicht gemessen"></label></div>`,
    knoepfe: [{ t: "Speichern", fn: async d => {
      const w = asWerte(d);
      if(String(w.titel || "").length < 3){ asMeldung("Bitte einen Kurztitel angeben."); return false; }
      await apiSend("POST", "/rest/v1/portal_energiemassnahmen", [{ kunde_slug: AS.kunde, kunde: asNwBetrieb(), titel: w.titel,
        beschreibung: w.beschreibung || null, ort: w.ort || null, festgestellt_am: w.festgestellt_am || null,
        massnahme: w.massnahme || null, einsparung: w.einsparung || null, status: "offen", quelle: "im Portal erfasst" }], "return=minimal");
      asZeige(); asMeldung("Maßnahme gespeichert.");
    } }] });
}

/* ======================= Stand der Pflichten + Wochenbericht ======================= */
AS_SEITEN.pflichten = { titel: "Stand der Pflichten", icon: "◐", sort: 1.5, async render(main){
  const r = asReiter("pflichten", [["pflichten", "Pflichten"], ["wochenbericht", "Wochenbericht"]], "pflichten");
  main.innerHTML = `<h1 class="seite">Stand der Pflichten</h1><p class="unter">Was bei einer Prüfung durch Behörde oder Berufsgenossenschaft zuerst gefragt wird.</p>
    ${r.html}<div id="asNwPfInhalt"><div class="karte"><div class="leer">wird geladen …</div></div></div>`;
  const box = document.getElementById("asNwPfInhalt");
  try{
    if(r.akt === "wochenbericht") await asNwWoche(box);
    else await asNwPflichten(box);
  }catch(e){ if(document.body.contains(box)) box.innerHTML = `<div class="karte"><div class="leer">Konnte nicht geladen werden: ${esc(e.message || e)}</div></div>`; }
}};

/* Pflichtpunkte wie V1 (cockpit.js ckPflichtPunkte): jeder Punkt aus vorhandenen Daten, nichts geschätzt.
   Nicht bewertbar = offen, mit ehrlichem Untertext. */
async function asNwPflichten(box){
  await Promise.all([asBetriebLaden(true).catch(() => null), asNwLaden(), asNwUwLaden()]);
  if(AS.seite !== "pflichten" || !document.body.contains(box)) return;
  const docs = (AS_B.docs || []), kat = k => docs.filter(d => d.kategorie === k);
  const jung = (datum, tage) => { if(!datum) return false; const t = new Date(String(datum).slice(0, 10)); return !isNaN(t) && (Date.now() - t.getTime()) / 864e5 <= tage; };
  const juengst = l => l.filter(Boolean).sort().slice(-1)[0] || "";
  /* Erfasste Anlagen: beurteilt = BdA hinterlegt oder Mängelstatus aus der Beurteilung vorhanden */
  const anl = kat("anlagen"), ohne = anl.filter(d => !((d.typen || []).includes("bda") || (d.status && d.status.gesamt))).length;
  const mg = asT("as_massnahme").filter(m => m._v1 && m._mg).map(m => m._mg).filter(m => m.status !== "erledigt");
  const mgGefahr = mg.filter(m => (m.bewertung_manuell || m.band) === "gefahr").length;
  const vOffen = asT("as_meldung").filter(m => m._v1 && m.status !== "erledigt").length;
  const letzteBeg = juengst(kat("begehungen").map(d => d.stand));
  /* Organisations-Check: Kundenportal-Dokument (org-check) oder abgeschlossener Reifegrad-Check in dieser App */
  const v2Voll = asLetzterCheck("voll"), v2Kurz = asLetzterCheck("kurz");
  const orgCheck = juengst(kat("org-check").filter(d => d.doc_typ !== "erstaufnahme").map(d => d.stand).concat(v2Voll ? [v2Voll.datum] : []));
  const orgErst = juengst(kat("org-check").filter(d => d.doc_typ === "erstaufnahme").map(d => d.stand).concat(v2Kurz ? [v2Kurz.datum] : []));
  const uw = asNwUwZahlen();
  const baN = kat("ba-sammel").length, gsN = kat("gefahrstoffe").length;
  const V1 = "../portal/#";
  const punkte = [
    { label: "Erfasste Anlagen beurteilt", tun: "Fehlende Anlagen beurteilen lassen", ok: anl.length > 0 && ohne === 0,
      sub: anl.length ? `${anl.length - ohne} von ${anl.length} erfassten Anlagen beurteilt` : "noch keine Anlage erfasst", ziel: "anlagen" },
    { label: "Keine offenen Mängel im Gefahrbereich", tun: "Mängel im Gefahrbereich abarbeiten", ok: mgGefahr === 0, schwer: mgGefahr > 0,
      sub: mgGefahr ? `${mgGefahr} im Gefahrbereich · ${mg.length} offen insgesamt` : `${mg.length} offene Mängel, keiner im Gefahrbereich`, ziel: "maengel" },
    { label: "Begehung in den letzten 12 Monaten", tun: "Begehungstermin vereinbaren", ok: jung(letzteBeg, 365),
      sub: letzteBeg ? `zuletzt ${asDat(letzteBeg)}` : "noch keine Begehung dokumentiert", ziel: "unterlagen" },
    { label: "Organisations-Check im letzten Jahr", tun: "Jährlichen Organisations-Check durchführen", ok: jung(orgCheck, 365),
      sub: orgCheck ? `zuletzt ${asDat(orgCheck)}` : orgErst ? `Erstaufnahme ${asDat(orgErst)} liegt vor – jährlicher Check fällig` : "noch nicht durchgeführt – fällig", ziel: "check" },
    { label: "Unterweisungen vollständig", tun: "Unterweisungen nachholen",
      ok: !!uw && uw.faellig === 0 && (!uw.beleg || uw.beleg.stammOk === uw.beleg.stamm),
      sub: !uw ? "Unterweisungsnachweise konnten nicht geladen werden"
        : uw.beleg ? `${uw.beleg.stammOk} von ${uw.beleg.stamm} Stammkräften unterwiesen` : (uw.faellig ? `${uw.faellig} fällig` : "keine fällig"),
      ziel: "unterweisungen" },
    { label: "Vorfälle aufgearbeitet", tun: "Offene Vorfälle abschließen", ok: vOffen === 0,
      sub: vOffen ? (vOffen === 1 ? "1 Vorfall noch offen" : `${vOffen} Vorfälle noch offen`) : "keine offenen Vorfälle", ziel: "steuerung/meldungen" },
    { label: "Betriebsanweisungen vorhanden", tun: "Betriebsanweisungen erstellen lassen", ok: baN > 0,
      sub: baN ? `${baN} Betriebsanweisungen hinterlegt` : "noch keine hinterlegt", ziel: "unterlagen" },
    { label: "Gefahrstoffkataster hinterlegt", tun: "Gefahrstoffkataster aufbauen", ok: gsN > 0,
      sub: gsN ? `${gsN} Dokumente im Kataster` : "noch keine Unterlagen", ziel: AS_SEITEN.gefahrstoffe ? "gefahrstoffe" : "unterlagen" },
  ];
  const erfuellt = punkte.filter(p => p.ok).length, anteil = asProz(erfuellt, punkte.length);
  const link = (p, innen, attr) => p.extern ? `<a href="${esc(p.ziel)}" target="_blank" rel="noopener" ${attr}>${innen}</a>` : `<a href="#${esc(p.ziel)}" ${attr}>${innen}</a>`;
  const offen = punkte.filter(p => !p.ok).sort((a, b) => (b.schwer ? 1 : 0) - (a.schwer ? 1 : 0)).slice(0, 3);
  box.innerHTML = `<div class="karte"><h2>Stand der Pflichten <button class="btn sek klein nodruck" onclick="window.print()">Drucken</button></h2>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <div class="grosszahl">${erfuellt}<span class="hinweis"> von ${punkte.length}</span></div>
        <div style="flex:1;min-width:200px"><p class="hinweis">Was bei einer Prüfung durch Behörde oder Berufsgenossenschaft zuerst gefragt wird.</p>
          <div class="balken" role="img" aria-label="${anteil} Prozent erfüllt" style="margin-top:6px"><span style="width:${anteil}%;background:${erfuellt === punkte.length ? "var(--gruen)" : "var(--blau)"}"></span></div></div></div>
      ${punkte.map(p => link(p, `<span>${asChip(p.ok ? "erfüllt" : "offen", p.ok ? "gruen" : p.schwer ? "rot" : "gelb")}</span>
        <div><b>${esc(p.label)}</b><div class="hinweis">${esc(p.sub)}</div></div>`, `class="krit" style="text-decoration:none;color:inherit"`)).join("")}</div>
    <div class="karte jetzt">${offen.length ? `<h2>Das ist jetzt dran</h2>${offen.map(p => link(p, `<b>${esc(p.tun || p.label)}</b><small>${esc(p.sub)}</small>`, p.schwer ? "" : `class="s2"`)).join("")}`
      : `<div class="leer">Aktuell ist nichts überfällig.</div>`}</div>
    <p class="hinweis">Die Punkte werden aus den Unterlagen dieses Portals abgeleitet. Anlagen zählen nur, soweit sie hier erfasst sind – der vollständige Maschinenpark des
      Betriebs ist im Portal nicht hinterlegt. Die Liste ersetzt keine behördliche Prüfung.</p>`;
}

/* ---- Wochenbericht wie V1 (logbuch.js): Was lief (Logbuch der Woche) · Was steht an (Termine der Folgewoche) · Drucken ---- */
function asNwMontag(versatz){ const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * versatz); return d; }
function asNwKw(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahr = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - jahr) / 86400000 + 1) / 7);
}
function asNwTag(d){ return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }); }
function asNwKurzTag(iso){ return new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }); }

/* Termine wie der V1-Kalender (kalEintraege): Termine, Nachweis-Abläufe, Vorsorge, Unterweisung wiederholen */
function asNwTermine(termine){
  const liste = [];
  (termine || []).filter(t => !t.erledigt_am && t.faellig_am).forEach(t => liste.push({ datum: t.faellig_am, titel: t.titel,
    sub: [t.objekt, t.zustaendig ? "zuständig: " + t.zustaendig : ""].filter(Boolean).join(" · ") }));
  AS_NW.nw.filter(n => !n.archiviert && n.gueltig_bis && !asNwErsetzt(n)).forEach(n => liste.push({ datum: n.gueltig_bis,
    titel: asNwArtLabel(n.art) + " läuft ab: " + n.person_name, sub: n.bezeichnung || "" }));
  AS_NW.vs.filter(v => v.naechste && !asNwVsErsetzt(v)).forEach(v => liste.push({ datum: v.naechste, titel: "Vorsorge fällig: " + v.person_name, sub: AS_NW_VS_ART[v.art] || "" }));
  asNwUwJeName(AS_NW.uwNw || []).forEach(n => { const d = String(n.created_at || "").slice(0, 10); if(!d) return;
    liste.push({ datum: asNwPlusMonate(d, 12), titel: "Unterweisung wiederholen: " + n.mitarbeiter_name, sub: "zuletzt unterwiesen " + asDat(d) }); });
  return liste.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
}

async function asNwWoche(box){
  const von = asNwMontag(AS_NW.woche), bis = new Date(von); bis.setDate(bis.getDate() + 7);
  const k = asNwSlug(), zeit = "&am=gte." + encodeURIComponent(von.toISOString()) + "&am=lt." + encodeURIComponent(bis.toISOString());
  let fehler = "";
  const [l1, l2, termine] = await Promise.all([
    apiGet("/rest/v1/portal_logbuch?select=am,wer,bereich,aktion,objekt,details" + k + zeit + "&order=am.desc&limit=1000").catch(e => { fehler = e.message || String(e); return []; }),
    apiGet("/rest/v1/as_log?select=am,wer,tabelle,aktion,objekt" + k + zeit + "&order=am.desc&limit=1000").catch(() => []),
    apiGet("/rest/v1/portal_termin?select=*&archiviert=is.false" + k + "&order=faellig_am.asc&limit=2000").catch(() => []),
    asNwLaden(), asNwUwLaden()]);
  if(AS.seite !== "pflichten" || !document.body.contains(box)) return;
  const log = l1 || [];
  const nach = (bereich, re) => log.filter(e => e.bereich === bereich && (!re || re.test(e.aktion || "")));
  const posten = (e, mitDetails) => `<li><span class="hinweis">${esc(new Date(e.am).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }))}</span>
      ${esc(e.objekt || e.aktion)}${e.wer ? ` <span class="hinweis">· ${esc(e.wer)}</span>` : ""}${mitDetails && e.details ? `<br><span class="hinweis">${esc(e.details)}</span>` : ""}</li>`;
  const liste = (titel, eintraege, mitDetails, max) => { max = max || 8; return eintraege.length
    ? `<h3>${esc(titel)} <span class="hinweis">${eintraege.length}</span></h3><ul class="kurzliste">${eintraege.slice(0, max).map(e => posten(e, mitDetails)).join("")}</ul>${eintraege.length > max ? `<div class="hinweis">und ${eintraege.length - max} weitere – siehe Logbuch</div>` : ""}` : ""; };
  const app = (l2 || []).map(x => ({ am: x.am, wer: x.wer, objekt: (AS_NW_LOG_TAB[x.tabelle] || x.tabelle || "App") + " · " + (x.aktion || "") + (x.objekt ? ": " + x.objekt : "") }));
  const bloecke = [
    liste("Mängel gemeldet", nach("maengel", /erfasst/), true),
    liste("Mängel erledigt", nach("maengel", /erledigt/), true),
    liste("Mängel von OAK engineering neu bewertet", nach("maengel", /bearbeitet|Bewertung/), false, 5),
    liste("Vorfälle", nach("vorfaelle"), true),
    liste("Maschinen geprüft", nach("pruefung"), true),
    liste("Unterweisungen", nach("unterweisungen"), false),
    liste("Termine erledigt", nach("kalender", /erledigt/), true),
    liste("Termine angelegt oder geändert", nach("kalender", /angelegt|geändert|entfernt/), false, 5),
    liste("Nachweise", nach("nachweise"), true, 6),
    liste("Vorsorge eingetragen", nach("vorsorge"), false, 6),
    liste("Aufgaben quittiert", nach("aufgaben"), true, 6),
    liste("Neue Unterlagen", nach("unterlagen", /neu/), false),
    liste("Aktualisierte Unterlagen", nach("unterlagen", /aktualisiert/), false, 5),
    liste("Gefahrstoffe", nach("gefahrstoffe"), true, 5),
    liste("Fragen zur Arbeitssicherheit", nach("anfragen"), false),
    liste("Einstellungen", nach("einstellungen"), false, 5),
    liste("Arbeitsschutz-App", app, false, 10),
  ].filter(Boolean);
  const abV = new Date(bis), abB = new Date(bis); abB.setDate(abB.getDate() + 7);
  const eintraege = asNwTermine(termine);
  const naechste = eintraege.filter(e => String(e.datum) >= asNwIso(abV) && String(e.datum) < asNwIso(abB));
  const ueberfaellig = AS_NW.woche === 0 ? eintraege.filter(e => asNwTage(e.datum) < 0) : [];
  const aPosten = e => `<li><span class="hinweis">${esc(asNwKurzTag(e.datum))}</span> ${esc(e.titel)}${e.sub ? `<br><span class="hinweis">${esc(e.sub)}</span>` : ""}</li>`;
  const ausblick = (ueberfaellig.length ? `<h3 class="rot">Bereits überfällig <span class="hinweis">${ueberfaellig.length}</span></h3><ul class="kurzliste">${ueberfaellig.slice(0, 10).map(aPosten).join("")}</ul>${ueberfaellig.length > 10 ? `<div class="hinweis">und ${ueberfaellig.length - 10} weitere</div>` : ""}` : "")
    + (naechste.length ? `<h3>Termine KW ${asNwKw(abV)} <span class="hinweis">${naechste.length}</span></h3><ul class="kurzliste">${naechste.map(aPosten).join("")}</ul>` : "");
  const zeitraum = asNwTag(von) + "–" + asNwTag(new Date(bis.getTime() - 86400000));
  const wochen = [0, 1, 2, 3].map(v => `<button class="btn ${v === AS_NW.woche ? "" : "sek"} klein" data-woche="${v}">${v === 0 ? "Diese Woche" : "KW " + asNwKw(asNwMontag(v))}</button>`).join(" ");
  const inhalt = `<h2>Was ${AS_NW.woche === 0 ? "diese Woche" : "in KW " + asNwKw(von)} lief</h2>
      ${bloecke.length ? bloecke.join("") : `<div class="leer">In dieser Woche gab es keine Änderungen.</div>`}
      <h2>Was in KW ${asNwKw(abV)} ansteht</h2>
      ${ausblick || `<div class="leer">Keine Termine im Kalender.</div>`}`;
  box.innerHTML = `<div class="karte"><h2>Wochenbericht KW ${asNwKw(von)} · ${zeitraum}
      <span class="nodruck" style="display:flex;gap:6px;flex-wrap:wrap">${wochen} <button class="btn sek klein" id="asNwWDruck">Drucken</button></span></h2>
      ${fehler ? `<div class="leer">Logbuch konnte nicht geladen werden: ${esc(fehler)}</div>` : ""}
      <div id="asNwWInhalt">${inhalt}</div>
      <p class="hinweis">Das Logbuch schreibt die Datenbank selbst mit. Einträge lassen sich nicht ändern oder löschen.</p></div>`;
  box.querySelectorAll("[data-woche]").forEach(b => b.onclick = async () => { AS_NW.woche = parseInt(b.dataset.woche, 10) || 0;
    box.innerHTML = `<div class="karte"><div class="leer">wird geladen …</div></div>`;
    try{ await asNwWoche(box); }catch(e){ box.innerHTML = `<div class="karte"><div class="leer">Konnte nicht geladen werden: ${esc(e.message || e)}</div></div>`; } });
  box.querySelector("#asNwWDruck").onclick = () => asNwDrucken("Wochenbericht KW " + asNwKw(von),
    `<h1>Wochenbericht KW ${asNwKw(von)}</h1><p class="leise">${esc(asNwBetrieb())} · ${zeitraum} · OAK Arbeitsschutz-App</p>` + inhalt);
}

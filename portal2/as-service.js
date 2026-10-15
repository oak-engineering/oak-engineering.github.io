/* OAK Arbeitsschutz-App – Service-Seiten wie im Kundenportal (V1): Kalender & To-dos, Frage an OAK (Forum),
   Aktuelles (rechtliche Neuerungen + Versionshinweise), Datenschutz (Stand AVV).
   Gleiche Tabellen wie V1, nichts Neues: portal_termin (+ RPC termin_erledigen), portal_aufgabe_quittung,
   portal_anfrage, portal_anfrage_beitrag (Anhang im Storage <slug>/anfragen/, Mail-Hinweis über Edge Function
   anfrage-mail), portal_rechtsinfo, portal_kunde.avv_abgeschlossen_am. Gelesen: portal_nachweis, portal_vorsorge,
   v_uw_faelligkeit, portal_vorfaelle, Maßnahmen/Mängel aus AS.db.
   Quittungs-Schlüssel wie in V1 (aufgaben.js), damit eine Quittung in beiden Apps gilt.
   Globale Namen nur mit asSv/AS_SV-Präfix (gemeinsamer Scope aller as-*.js). */
"use strict";

const AS_SV = { kunde: null, termine: [], nachweise: [], vorsorge: [], uw: [], vorfaelle: [], quitt: [], anfragen: [], beitraege: [],
  recht: null, kundeV1: null, ansicht: "monat", monat: null, filter: "", fFilter: "", fOffen: null, fMeldung: "", fSuche: "", versionen: null };
const AS_SV_ART = { pruefung: "Prüfung", wartung: "Wartung", schulung: "Schulung", vorsorge: "Vorsorge", begehung: "Begehung", frist: "Frist", sonstiges: "Sonstiges",
  nachweis: "Nachweis läuft ab", unterweisung: "Unterweisung", massnahme: "Maßnahme", ziel: "Ziel" };
const AS_SV_INTERVALLE = [[0, "einmalig"], [1, "monatlich"], [3, "alle 3 Monate"], [6, "alle 6 Monate"], [12, "jährlich"], [24, "alle 2 Jahre"],
  [36, "alle 3 Jahre"], [48, "alle 4 Jahre"], [60, "alle 5 Jahre"]];
/* [Titel, Art, Intervall in Monaten (0 = selbst festlegen), Grundlage] – wie V1 kalender.js */
const AS_SV_VORLAGEN = [
  ["Prüfung Flurförderzeuge (Stapler)", "pruefung", 12, "DGUV Vorschrift 68 § 37 – mindestens jährlich durch Sachkundigen"],
  ["Prüfung Krane", "pruefung", 12, "DGUV Vorschrift 52 § 26 – mindestens jährlich durch Sachkundigen"],
  ["Prüfung ortsveränderliche elektrische Betriebsmittel", "pruefung", 12, "DGUV Vorschrift 3, Durchführungsanweisung – Richtwert 6 Monate, bei Fehlerquote unter 2 % in Betriebsstätten 1 Jahr"],
  ["Prüfung ortsfeste elektrische Anlagen und Betriebsmittel", "pruefung", 48, "DGUV Vorschrift 3, Durchführungsanweisung – Richtwert 4 Jahre"],
  ["Prüfung Leitern und Tritte", "pruefung", 12, "DGUV Information 208-016 – mindestens jährliche Prüfung empfohlen, Frist nach Gefährdungsbeurteilung"],
  ["Regalinspektion", "pruefung", 12, "TRBS 1201 / DGUV Regel 115-401 Tab. 13 – bewährte Frist einmal jährlich"],
  ["Prüfung kraftbetätigte Tore und Türen", "pruefung", 12, "ASR A1.7 – wiederkehrende sachkundige Prüfung, in der Regel jährlich"],
  ["Prüfung Feuerlöscher", "pruefung", 24, "ASR A2.2 – Prüfung durch Sachkundige mindestens alle 2 Jahre"],
  ["Wiederkehrende Prüfung Spritzgießmaschine", "pruefung", 0, "§ 14 BetrSichV – Frist aus der Gefährdungsbeurteilung festlegen (DGUV Information 113-606)"],
  ["Jährliche Unterweisung", "schulung", 12, "§ 12 ArbSchG, DGUV Vorschrift 1 § 4 – mindestens einmal jährlich"],
  ["Fortbildung Ersthelfer", "schulung", 24, "DGUV Vorschrift 1 § 26 – Fortbildung in der Regel alle 2 Jahre"],
  ["Sitzung Arbeitsschutzausschuss (ASA)", "sonstiges", 3, "§ 11 ASiG – mindestens einmal vierteljährlich"],
  ["Überprüfung Erste-Hilfe-Material", "wartung", 12, ""],
];
const AS_SV_NW_ART = { stapler: "Staplerschein", kran: "Kranschein", anschlaeger: "Anschläger", hubarbeitsbuehne: "Hubarbeitsbühne",
  ersthelfer: "Ersthelfer", brandschutzhelfer: "Brandschutzhelfer", sicherheitsbeauftragter: "Sicherheitsbeauftragter",
  elektro: "Elektrofachkraft / EuP", sonstiges: "Sonstiger Nachweis" };
const AS_SV_NW_BEAUFTRAGUNG = ["stapler", "kran", "anschlaeger", "hubarbeitsbuehne"];
const AS_SV_VS_ART = { pflicht: "Pflichtvorsorge", angebot: "Angebotsvorsorge", wunsch: "Wunschvorsorge" };
const AS_SV_RECHT_STATUS = { gilt: "gilt seit", kommt: "gilt ab", vorhaben: "geplant" };
const AS_SV_NAME_KEY = "oak_mein_name";   // derselbe Schlüssel wie im Kundenportal

/* ---------------- Hilfen ---------------- */
function asSvTage(s){
  if(!s) return null;
  const t = String(s).slice(0, 10).split("-").map(Number); if(t.length !== 3 || t.some(isNaN)) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  return Math.round((new Date(t[0], t[1] - 1, t[2]) - heute) / 86400000);
}
function asSvPlusMonate(iso, m){
  const t = String(iso).slice(0, 10).split("-").map(Number); const d = new Date(t[0], t[1] - 1 + m, t[2]);
  return asSvIso(d);
}
function asSvIso(d){ return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function asSvHeute(){ return asSvIso(new Date()); }
function asSvFristText(tage){
  if(tage == null) return "";
  if(tage < -1) return "seit " + (-tage) + " Tagen überfällig";
  if(tage === -1) return "seit gestern überfällig";
  if(tage === 0) return "heute fällig";
  if(tage === 1) return "morgen fällig";
  return "in " + tage + " Tagen";
}
function asSvFarbe(tage, vorlauf){ if(tage == null) return "grau"; if(tage < 0) return "rot"; if(tage <= (vorlauf || 30)) return "gelb"; return "gruen"; }
function asSvDatZeit(s){
  if(!s) return "";
  const d = new Date(s); if(isNaN(d)) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " · "
    + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function asSvKw(d){ const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const tag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - tag);
  return t.getUTCFullYear() + "-" + Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7); }
function asSvIntervallText(m){ return (AS_SV_INTERVALLE.find(i => i[0] === m) || [0, "alle " + m + " Monate"])[1]; }
function asSvNorm(s){ return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
function asSvFehler(e){ return String((e && e.message) || e || "unbekannter Fehler"); }

/* Name bei gemeinsamem Zugang (Schichtführer-PC) abfragen – wie V1 ehsNameFeld */
function asSvGemeinsam(){ return /^Schichtf/i.test(AS.ich || "") || !(AS.ich || "").trim(); }
function asSvVorname(){
  if(!asSvGemeinsam()) return AS.ich || "";
  try{ return localStorage.getItem(AS_SV_NAME_KEY) || ""; }catch(e){ return ""; }
}
function asSvNameFeld(label){
  return `<label class="voll">${esc(label || "Ihr Name")}<input type="text" data-f="wer" autocomplete="name" placeholder="Vor- und Nachname" value="${esc(asSvVorname())}"></label>`;
}
function asSvNameLesen(w){
  const v = String((w && w.wer) || "").trim().replace(/\s+/g, " ");
  if(v.length < 3) return null;
  if(asSvGemeinsam()){ try{ localStorage.setItem(AS_SV_NAME_KEY, v); }catch(e){} }
  return v;
}

/* Dateien (wie V1 ehs-helfer.js) */
function asSvDateiOk(datei){
  if(!datei) return true;
  if(datei.size > 15 * 1024 * 1024) throw new Error("Die Datei ist größer als 15 MB.");
  if(!/\.(pdf|jpe?g|png|webp)$/i.test(datei.name)) throw new Error("Bitte ein PDF oder Foto (JPG, PNG) wählen.");
  return true;
}
function asSvDateiName(datei){ return datei.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-"); }
async function asSvHochladen(datei, pfad){
  const t = await token();
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad.split("/").map(encodeURIComponent).join("/"), { method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": datei.type || "application/octet-stream", "x-upsert": "true" }, body: datei });
  if(!r.ok) throw new Error("Datei konnte nicht hochgeladen werden (" + r.status + ")");
  return pfad;
}
async function asSvSigniert(pfad){
  try{ const r = await apiSend("POST", "/storage/v1/object/sign/" + CFG.bucket + "/" + pfad, { expiresIn: 600 });
    return r && r.signedURL ? CFG.url + "/storage/v1" + r.signedURL : null; }catch(e){ return null; }
}
/* Mail ist nur ein Hinweis mit Link – der Eintrag steht im Portal (wie V1 anfrMail) */
async function asSvMail(body){
  try{
    const t = await token(); if(!t) return;
    await fetch(CFG.url + "/functions/v1/anfrage-mail", { method: "POST",
      headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(typeof body === "string" ? { anfrage_id: body } : body) });
  }catch(e){}
}

function asSvCss(){
  if(document.getElementById("asSvCss")) return;
  const s = document.createElement("style"); s.id = "asSvCss";
  s.textContent = `.sv-leiste{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.sv-leiste select,.sv-leiste input{width:auto;max-width:260px}
.sv-pill{background:#fff;color:var(--blau);border:1px solid var(--linie);border-radius:16px;padding:4px 12px;font-size:13px;cursor:pointer}
.sv-pill.an{background:var(--blau);color:#fff;border-color:var(--blau)}
.sv-ul{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.sv-uldok{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--linie);border-radius:8px;padding:4px 10px;font:inherit;font-size:13px;color:var(--blau);cursor:pointer;max-width:100%;text-align:left}
.sv-uldok:hover{border-color:var(--blau)}.sv-uldok svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8}
.sv-uldok em{font-style:normal;font-size:11px;font-weight:600;background:var(--gelb2);color:#8a6200;border-radius:6px;padding:1px 6px}
.sv-ulbox{border:1px solid var(--linie);border-radius:10px;padding:10px 12px;background:#fafcfe}
.sv-ulkopf{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px}
.sv-ulbox input[type=search]{width:100%;margin-bottom:6px}
.sv-ulwahl{max-height:230px;overflow:auto;border-top:1px solid var(--linie);padding-top:4px}
.sv-ulgr small{display:block;font-weight:600;color:var(--blau);margin:8px 0 2px;text-transform:uppercase;letter-spacing:.03em;font-size:11px}
.sv-ulwahl label{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;font-weight:400;padding:3px 2px;margin:0}
.sv-ulwahl label input{width:auto;margin:0}.sv-ulwahl label span:first-of-type{flex:1}
@media(max-width:640px){#svInhalt .zeilen .z{grid-template-columns:1fr}#svInhalt .zeilen .z>div:last-child{text-align:left!important}.sv-uldok{font-size:12px}}
.sv-raster{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.sv-wt{font-size:12px;color:var(--grau);text-align:center;font-weight:600;padding:2px 0}
.sv-tag{background:#fff;border:1px solid var(--linie);border-radius:8px;min-height:86px;padding:4px;font-size:12px;overflow:hidden}
.sv-tag.fremd{opacity:.45}.sv-tag.heute{border:2px solid var(--blau)}
.sv-nr{font-weight:600;color:var(--grau)}
.sv-e{display:block;width:100%;text-align:left;border:0;border-left:3px solid #c5ced8;border-radius:4px;padding:2px 4px;margin-top:2px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;background:#eef1f5;color:var(--text)}
.sv-e.rot{border-left-color:var(--rot);background:var(--rot2)}.sv-e.gelb{border-left-color:var(--gelb);background:var(--gelb2)}.sv-e.gruen{border-left-color:var(--gruen);background:var(--gruen2)}
.sv-mkopf{display:flex;align-items:center;gap:8px;margin-bottom:8px}.sv-mkopf h2{margin:0;flex:1;font-size:16px;color:var(--blau)}
.sv-auf{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 4px 10px 10px;border-top:1px solid var(--linie);border-left:4px solid var(--linie)}
.sv-auf.rot{border-left-color:var(--rot)}.sv-auf.gelb{border-left-color:var(--gelb)}.sv-auf.blau{border-left-color:var(--blau)}
.sv-auf small{display:block;color:var(--grau);font-size:12px;margin-top:2px}
.sv-akt{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:6px}
.sv-beitrag{border-left:3px solid var(--linie);padding:6px 10px;margin:8px 0;background:#fafbfd;border-radius:0 8px 8px 0}
.sv-beitrag.oak{border-left-color:var(--blau);background:var(--blau2)}
.sv-text{white-space:pre-wrap;font-size:14px;margin-top:4px;overflow-wrap:anywhere}
.sv-thema{border-top:1px solid var(--linie);padding:10px 4px}
.sv-thema>.sv-zeile{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;cursor:pointer}
.sv-thema small{display:block;color:var(--grau);font-size:12px;margin-top:2px}
.sv-recht{border-top:1px solid var(--linie);padding:12px 0}.sv-recht h3{margin:6px 0 4px;font-size:15px}.sv-recht p{margin:4px 0;font-size:14px}
.sv-ds h2{font-size:15px}.sv-ds p,.sv-ds li{font-size:14px;line-height:1.5}
@media(max-width:600px){.sv-tag{min-height:58px;padding:2px}.sv-e{font-size:10px;padding:1px 2px}.sv-auf{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}

/* ---------------- Daten ---------------- */
async function asSvLaden(){
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const hole = p => apiGet(p).then(r => Array.isArray(r) ? r : []).catch(() => []);
  const [termine, nachweise, vorsorge, uw, vorfaelle, quitt, anfragen, beitraege, uwNw, einarb] = await Promise.all([
    hole("/rest/v1/portal_termin?select=*&archiviert=is.false" + k + "&order=faellig_am.asc&limit=2000"),
    hole("/rest/v1/portal_nachweis?select=*&archiviert=is.false" + k + "&order=person_name.asc"),
    hole("/rest/v1/portal_vorsorge?select=*" + k + "&order=person_name.asc"),
    hole("/rest/v1/v_uw_faelligkeit?select=*" + k),
    hole("/rest/v1/portal_vorfaelle?select=id,kunde_slug,art,domaene,ereignis_am,ort,status,sofortmassnahme,langzeitmassnahme,ausgewertet_am" + k),
    hole("/rest/v1/portal_aufgabe_quittung?select=*" + k + "&order=quittiert_am.desc&limit=1000"),
    hole("/rest/v1/portal_anfrage?select=*" + k + "&order=letzte_aktivitaet.desc.nullslast,created_at.desc&limit=300"),
    hole("/rest/v1/portal_anfrage_beitrag?select=*" + k + "&order=created_at.asc&limit=3000"),
    // für „praktische Einarbeitung bestätigen“ (wie V1: Terminal-Nachweise der letzten 60 Tage ohne Bestätigung)
    hole("/rest/v1/unterweisungsnachweise?select=id,mitarbeiter_name,funktion,created_at" + k + "&order=created_at.desc&limit=2000"),
    hole("/rest/v1/portal_einarbeitung?select=person_name,am&archiviert=is.false" + k)]);
  Object.assign(AS_SV, { kunde: AS.kunde, termine, nachweise, vorsorge, uw, vorfaelle, quitt, anfragen, beitraege, uwNw, einarb });
  await asSvPaLaden();
}
async function asSvQuittLaden(){
  AS_SV.quitt = await apiGet("/rest/v1/portal_aufgabe_quittung?select=*&kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&order=quittiert_am.desc&limit=1000")
    .catch(() => AS_SV.quitt) || [];
}
async function asSvAnfragenLaden(){
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const [a, b] = await Promise.all([
    apiGet("/rest/v1/portal_anfrage?select=*" + k + "&order=letzte_aktivitaet.desc.nullslast,created_at.desc&limit=300").catch(() => []),
    apiGet("/rest/v1/portal_anfrage_beitrag?select=*" + k + "&order=created_at.asc&limit=3000").catch(() => [])]);
  AS_SV.anfragen = a || []; AS_SV.beitraege = b || [];
}
/* ein jüngerer Nachweis derselben Person und Art ersetzt den älteren (wie V1 nwErsetzt/vsErsetzt) */
function asSvNwErsetzt(n){
  return AS_SV.nachweise.some(x => x.id !== n.id && !x.archiviert && x.art === n.art && asSvNorm(x.person_name) === asSvNorm(n.person_name)
    && (x.art !== "sonstiges" || asSvNorm(x.bezeichnung) === asSvNorm(n.bezeichnung))
    && String(x.gueltig_bis || "9999") > String(n.gueltig_bis || "9999"));
}
function asSvVsErsetzt(v){
  return AS_SV.vorsorge.some(x => x.id !== v.id && asSvNorm(x.anlass) === asSvNorm(v.anlass) && asSvNorm(x.person_name) === asSvNorm(v.person_name)
    && String(x.datum || "") > String(v.datum || ""));
}
function asSvNwLabel(a){ return AS_SV_NW_ART[a] || "Nachweis"; }
/* Unterweisung: je Person die früheste Fälligkeit aus v_uw_faelligkeit */
function asSvUwJePerson(){
  const m = {};
  AS_SV.uw.filter(f => f.faellig_am).forEach(f => {
    const p = m[f.person_id] = m[f.person_id] || { person_id: f.person_id, name: f.name, faellig_am: f.faellig_am, zuletzt_am: f.zuletzt_am, faellig: 0, themen: 0 };
    p.themen++; if(f.status === "ueberfaellig" || f.status === "erstunterweisung") p.faellig++;
    if(String(f.faellig_am) < String(p.faellig_am)) p.faellig_am = f.faellig_am;
    if(f.zuletzt_am && (!p.zuletzt_am || String(f.zuletzt_am) > String(p.zuletzt_am))) p.zuletzt_am = f.zuletzt_am;
  });
  return Object.values(m);
}
function asSvMaengelRoh(){ return asT("as_massnahme").filter(m => m._v1 && m._mg).map(m => m._mg); }

/* Ziel eines abgeleiteten Eintrags öffnen: "v1:<seite>" = Kundenportal-Seite, sonst V2-Hash */
function asSvZiel(ziel){
  if(!ziel) return;
  if(ziel.indexOf("v1:") === 0){ asDokOeffnen(ziel.slice(3), "Kundenportal"); return; }
  asGehe(ziel);
}

/* ---------------- Unterlagen zum Termin ----------------
   portal_termin.unterlagen = IDs aus portal_dokumente (gleiche Ablage wie V1). Ein Termin verweist auf die Dokumente,
   die dafür gebraucht werden (z. B. ASA → Präsentation, Freigabe → Entwürfe). Funktioniert ohne OAK: der Betrieb wählt
   die Unterlagen im Termin-Dialog selbst aus. */
function asSvDok(id){ return ((typeof AS_B !== "undefined" && AS_B.docs) || []).find(d => d.id === id) || null; }
function asSvDokTitel(d){ return d.titel || (d.maschine ? d.maschine + " – Unterlagen der Anlage" : "Dokument"); }
function asSvDokUrl(d){
  if(d.url) return d.url;
  if((d.kategorie === "anlagen" || d.kategorie === "allg-gbu") && (d.typen || []).length){
    const t = AS_DOKTYPEN.find(x => (d.typen || []).includes(x[0])) || AS_DOKTYPEN[0]; return asAnlageDokUrl(d, t[0], t[1]); }
  return asViewerUrl(d.doc_typ || "pdf", d.storage_path, asSvDokTitel(d));
}
function asSvEntwurf(d){ return /^\s*entwurf/i.test(d.titel || ""); }
function asSvTerminDoks(t){ return ((t && t.unterlagen) || []).map(asSvDok).filter(Boolean); }
function asSvUnterlagenHtml(t){
  const l = asSvTerminDoks(t); if(!l.length) return "";
  return `<div class="sv-ul">${l.map(d => `<button type="button" class="sv-uldok${asSvEntwurf(d) ? " entwurf" : ""}" data-svdok="${esc(d.id)}" title="öffnen">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>${esc(asSvDokTitel(d).replace(/^\s*ENTWURF( zur Freigabe)?\s*[–-]\s*/i, ""))}${asSvEntwurf(d) ? "<em>Entwurf</em>" : ""}</button>`).join("")}</div>`;
}
function asSvUnterlagenBinden(box, dlg){
  box.querySelectorAll("[data-svdok]").forEach(b => b.onclick = ev => { ev.stopPropagation(); const d = asSvDok(b.dataset.svdok); if(!d) return;
    if(dlg && dlg.open) dlg.close(); asDokOeffnen(asSvDokUrl(d), asSvDokTitel(d)); });
}
function asSvUnterlagenWahl(gewaehlt){
  const KAT = (typeof AS_UL_KAT !== "undefined" ? AS_UL_KAT : []).concat([["anlagen", "Anlagen"], ["sonstige", "Weitere Unterlagen"]]);
  const katName = k => (KAT.find(x => x[0] === k) || [k, "Weitere Unterlagen"])[1];
  const gruppen = {};
  ((typeof AS_B !== "undefined" && AS_B.docs) || []).forEach(d => { const k = katName(d.kategorie); (gruppen[k] = gruppen[k] || []).push(d); });
  const zahl = gewaehlt.length;
  return `<div class="voll sv-ulbox"><div class="sv-ulkopf"><b>Erforderliche Unterlagen</b><span class="hinweis" id="svUlZahl">${zahl ? zahl + " ausgewählt" : "keine ausgewählt"}</span></div>
    <input type="search" id="svUlSuche" placeholder="Unterlage suchen (Titel, Anlage, Bereich) …">
    <div class="sv-ulwahl">${Object.entries(gruppen).map(([k, l]) => `<div class="sv-ulgr"><small>${esc(k)}</small>${l.map(d =>
      `<label data-such="${esc((asSvDokTitel(d) + " " + k + " " + (d.maschinen_id || "")).toLowerCase())}"><input type="checkbox" data-ul="${esc(d.id)}"${gewaehlt.includes(d.id) ? " checked" : ""}>
        <span>${esc(asSvDokTitel(d))}</span>${asSvEntwurf(d) ? '<span class="chip c-gelb">Entwurf</span>' : ""}</label>`).join("")}</div>`).join("")
      || '<div class="hinweis">Noch keine Dokumente in der Ablage.</div>'}</div>
    <p class="hinweis">Die Unterlagen erscheinen beim Termin im Kalender und lassen sich dort direkt öffnen.</p></div>`;
}
function asSvUnterlagenWahlBinden(dl){
  const such = dl.querySelector("#svUlSuche"); if(!such) return;
  const zaehlen = () => { const n = dl.querySelectorAll("[data-ul]:checked").length; dl.querySelector("#svUlZahl").textContent = n ? n + " ausgewählt" : "keine ausgewählt"; };
  such.oninput = () => { const q = such.value.trim().toLowerCase();
    dl.querySelectorAll(".sv-ulwahl label").forEach(l => l.style.display = !q || l.dataset.such.includes(q) || l.querySelector("input").checked ? "" : "none");
    dl.querySelectorAll(".sv-ulgr").forEach(g => g.style.display = [...g.querySelectorAll("label")].some(l => l.style.display !== "none") ? "" : "none"); };
  dl.querySelectorAll("[data-ul]").forEach(c => c.onchange = zaehlen);
}
/* Termin naht, eine verknüpfte Unterlage ist noch Entwurf */
function asSvEntwurfOffen(t){ const tage = asSvTage(t.faellig_am); return tage != null && tage <= 14 && asSvTerminDoks(t).some(asSvEntwurf); }

/* ---------------- Kalender-Einträge ---------------- */
function asSvEintraege(){
  const l = [];
  AS_SV.termine.filter(t => !t.erledigt_am && !t.archiviert).forEach(t => l.push({
    quelle: "termin", id: t.id, datum: t.faellig_am, art: t.art, titel: t.titel,
    sub: [t.objekt, t.zustaendig ? "zuständig: " + t.zustaendig : "", t.intervall_monate ? asSvIntervallText(t.intervall_monate) : ""].filter(Boolean).join(" · "),
    ziel: null, roh: t }));
  AS_SV.nachweise.filter(n => !n.archiviert && n.gueltig_bis && !asSvNwErsetzt(n)).forEach(n => l.push({
    quelle: "nachweis", id: n.id, datum: n.gueltig_bis, art: "nachweis", titel: asSvNwLabel(n.art) + " läuft ab: " + (n.person_name || ""),
    sub: n.bezeichnung || "", ziel: "nachweise", roh: n }));
  AS_SV.vorsorge.filter(v => v.naechste && !asSvVsErsetzt(v)).forEach(v => l.push({
    quelle: "vorsorge", id: v.id, datum: v.naechste, art: "vorsorge", titel: "Vorsorge fällig: " + (v.person_name || ""),
    sub: AS_SV_VS_ART[v.art] || v.anlass || "", ziel: "nachweise/vorsorge", roh: v }));
  asSvUwJePerson().forEach(p => l.push({
    quelle: "unterweisung", id: p.person_id, datum: String(p.faellig_am).slice(0, 10), art: "unterweisung",
    titel: (p.zuletzt_am ? "Unterweisung wiederholen: " : "Erstunterweisung: ") + (p.name || ""),
    sub: p.zuletzt_am ? "zuletzt unterwiesen " + asDat(p.zuletzt_am) : "noch kein Nachweis", ziel: "vorort/terminal", roh: p }));
  asT("as_massnahme").filter(m => m.status === "offen" && m.termin).forEach(m => l.push({
    quelle: "massnahme", id: m.id, datum: String(m.termin).slice(0, 10), art: "massnahme", titel: (m._v1 ? "Mangel beheben: " : "Maßnahme fällig: ") + (m.text || ""),
    sub: [m.anlage, m.verantwortlich ? "verantwortlich: " + m.verantwortlich : ""].filter(Boolean).join(" · "), ziel: m._v1 ? "maengel" : "massnahmen", roh: m }));
  asT("as_ziel").filter(z => z.status === "aktiv" && z.termin).forEach(z => l.push({
    quelle: "ziel", id: z.id, datum: String(z.termin).slice(0, 10), art: "ziel", titel: "Ziel erreichen: " + (z.titel || ""),
    sub: z.verantwortlich ? "verantwortlich: " + z.verantwortlich : "", ziel: "steuerung/ziele", roh: z }));
  if(typeof asPfKalender === "function") asPfKalender().forEach(e => l.push(e));
  asSvPaKalender().forEach(e => l.push(e));
  return l.filter(e => asSvTage(e.datum) != null).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
}

/* ---------------- To-dos ---------------- */
function asSvQuittiert(s){ return AS_SV.quitt.some(q => q.schluessel === s); }
/* { schluessel, stufe (kritisch|warnung|info), titel, sub, frist, aktionen:[[text, fn]], quittierbar, quittText } */
function asSvAufgaben(){
  const l = [], admin = AS.admin, heute = asSvHeute();
  /* 1. Termine (≤ 14 Tage oder überfällig) */
  AS_SV.termine.filter(t => !t.erledigt_am && !t.archiviert).forEach(t => {
    const tage = asSvTage(t.faellig_am); if(tage == null || tage > 14) return;
    l.push({ schluessel: "termin:" + t.id, stufe: tage < 0 ? "kritisch" : "warnung", titel: t.titel + (t.objekt ? " · " + t.objekt : ""),
      sub: (AS_SV_ART[t.art] || "Termin") + " · fällig " + asDat(t.faellig_am) + (t.zustaendig ? " · zuständig: " + t.zustaendig : ""), frist: tage,
      aktionen: [["Erledigt", () => asSvErledigenDialog(t)]], unterlagen: t });
    if(asSvEntwurfOffen(t)) asSvTerminDoks(t).filter(asSvEntwurf).forEach(d => l.push({ schluessel: "entwurf:" + t.id + ":" + d.id, stufe: "warnung", quittierbar: true,
      titel: "Unterlage noch Entwurf: " + asSvDokTitel(d).replace(/^\s*ENTWURF( zur Freigabe)?\s*[–-]\s*/i, ""), sub: "gebraucht für „" + t.titel + "“ am " + asDat(t.faellig_am) + " – Freigabe einholen", frist: tage,
      aktionen: [["Unterlage öffnen", () => asDokOeffnen(asSvDokUrl(d), asSvDokTitel(d))], ["Termin", () => asSvErledigenDialog(t, true)]] }));
  });
  /* 2. Nachweise */
  AS_SV.nachweise.filter(n => !n.archiviert).forEach(n => {
    if(n.gueltig_bis && !asSvNwErsetzt(n)){
      const tage = asSvTage(n.gueltig_bis);
      if(tage != null && tage <= 60){ const st = tage < 0 ? "abgelaufen" : "bald";
        l.push({ schluessel: "nachweis:" + n.id + ":" + st, stufe: tage < 0 ? "kritisch" : "warnung", quittierbar: true,
          titel: asSvNwLabel(n.art) + " von " + (n.person_name || "") + (tage < 0 ? " ist abgelaufen" : " läuft ab"),
          sub: "gültig bis " + asDat(n.gueltig_bis) + (n.bezeichnung ? " · " + n.bezeichnung : ""), frist: tage,
          aktionen: [["Neuen Nachweis eintragen", () => asGehe("nachweise")]] }); }
    }
    if(AS_SV_NW_BEAUFTRAGUNG.includes(n.art) && !n.beauftragt && !asSvNwErsetzt(n))
      l.push({ schluessel: "beauftragung:" + n.id, stufe: "warnung", quittierbar: true, titel: "Schriftliche Beauftragung fehlt: " + (n.person_name || ""),
        sub: asSvNwLabel(n.art) + " vorhanden, Beauftragung nicht vermerkt", aktionen: [["Nachweis öffnen", () => asGehe("nachweise")]] });
  });
  /* 3. Vorsorge */
  AS_SV.vorsorge.filter(v => v.naechste && !asSvVsErsetzt(v)).forEach(v => {
    const tage = asSvTage(v.naechste); if(tage == null || tage > 60) return; const st = tage < 0 ? "ueberfaellig" : "bald";
    l.push({ schluessel: "vorsorge:" + v.id + ":" + st, stufe: tage < 0 ? "kritisch" : "warnung", quittierbar: true,
      titel: "Arbeitsmedizinische Vorsorge " + (tage < 0 ? "überfällig" : "fällig") + ": " + (v.person_name || ""),
      sub: (v.anlass || "") + " · fällig " + asDat(v.naechste), frist: tage,
      aktionen: [["Termin beim Betriebsarzt eintragen", () => asSvZiel("nachweise/vorsorge")]] });
  });
  /* 4. Unterweisungen (v_uw_faelligkeit) – Schlüssel je Kalenderwoche wie V1 */
  const uwP = asSvUwJePerson().filter(p => p.faellig > 0);
  if(uwP.length) l.push({ schluessel: "unterweisung:" + asSvKw(new Date()), stufe: "warnung", quittierbar: true,
    titel: uwP.length + (uwP.length === 1 ? " Beschäftigte/r ohne gültige Unterweisung" : " Beschäftigte ohne gültige Unterweisung"),
    sub: "am Terminal nachholen · " + uwP.slice(0, 5).map(p => p.name).join(", ") + (uwP.length > 5 ? " …" : ""),
    aktionen: [["Terminal starten", () => asGehe("vorort/terminal")]] });
  /* 5. praktische Einarbeitung: jüngster Terminal-Nachweis je Person der letzten 60 Tage ohne Bestätigung (Schlüssel wie V1) */
  { const norm = s => String(s || "").trim().toLowerCase(), juengst = new Map();
    (AS_SV.uwNw || []).forEach(n => { const kk = norm(n.mitarbeiter_name); if(kk && !juengst.has(kk)) juengst.set(kk, n); });
    const bestaetigt = new Set((AS_SV.einarb || []).map(e => norm(e.person_name)));
    juengst.forEach((nw, kk) => {
      if(bestaetigt.has(kk) || (Date.now() - new Date(nw.created_at).getTime()) > 60 * 864e5) return;
      l.push({ schluessel: "einarbeitung:" + nw.id, stufe: "info", quittierbar: true, titel: "Praktische Einarbeitung bestätigen: " + nw.mitarbeiter_name,
        sub: "am Terminal unterwiesen am " + asDat(nw.created_at) + (nw.funktion ? " · " + nw.funktion : ""),
        aktionen: [["Einarbeitung bestätigen", () => typeof asUwEinarbDialog === "function" ? asUwEinarbDialog(nw.mitarbeiter_name, nw.funktion) : asGehe("unterweisungen")]] });
    }); }
  /* 6. Vorfälle ohne Auswertung */
  AS_SV.vorfaelle.filter(v => v.status !== "neu" && v.status !== "erledigt" && v.domaene !== "umwelt"
    && !(v.ausgewertet_am || v.sofortmassnahme || v.langzeitmassnahme)).forEach(v => l.push({
      schluessel: "vorfall:" + v.id, stufe: "warnung",
      titel: "Vorfall auswerten: " + ({ unfall: "Unfall", beinahe: "Beinahe-Unfall", mangel: "Mangel" }[v.art] || "Vorfall") + (v.ort ? " · " + v.ort : ""),
      sub: "gemeldet für " + asDat(v.ereignis_am) + " · Ausfalltage, Sofort- und Langzeitmaßnahme eintragen",
      aktionen: [["Auswerten", () => asGehe("steuerung/meldungen")]] }));
  /* 8. Forum */
  AS_SV.anfragen.forEach(a => {
    const zuOeffnen = () => { AS_SV.fOffen = a.id; asGehe("fragen"); };
    if(admin && a.status !== "beantwortet")
      l.push({ schluessel: "frage:" + a.id, stufe: "warnung", titel: "Frage beantworten: " + (a.betreff || ""),
        sub: (a.von_name || "") + " · " + asSvDatZeit(a.letzte_aktivitaet || a.created_at), aktionen: [["Antworten", zuOeffnen]] });
    else if(!admin && a.status === "beantwortet" && a.letzte_aktivitaet && asSvTage(String(a.letzte_aktivitaet).slice(0, 10)) >= -14)
      l.push({ schluessel: "antwort:" + a.id + ":" + String(a.letzte_aktivitaet).slice(0, 19), stufe: "info", quittierbar: true, quittText: "Gelesen",
        titel: "Neue Antwort: " + (a.betreff || ""), sub: "Frage an OAK · " + asSvDatZeit(a.letzte_aktivitaet), aktionen: [["Lesen", zuOeffnen]] });
  });
  /* 9. Nur OAK: Mängel übernehmen / bewerten (wie V1) */
  if(admin){
    const mg = asSvMaengelRoh();
    const ueb = mg.filter(m => m.status === "erledigt" && !m.uebernommen_am).length;
    const bew = mg.filter(m => /^BM-/.test(m.schluessel || "") && m.status !== "erledigt" && !m.bewertung_manuell).length;
    if(ueb) l.push({ schluessel: "oak-uebernehmen", stufe: "info", titel: ueb + " erledigte Mängel in GBU, BA und Mängelliste übernehmen", sub: "nur für OAK sichtbar", aktionen: [["ansehen", () => asGehe("maengel")]] });
    if(bew) l.push({ schluessel: "oak-bewerten", stufe: "info", titel: bew + " vom Betrieb gemeldete Mängel bewerten", sub: "nur für OAK sichtbar", aktionen: [["ansehen", () => asGehe("maengel")]] });
  }
  /* 10. V2: überfällige Maßnahmen und Mängel (Termin vorbei, Status offen) */
  const ueberf = asT("as_massnahme").filter(m => m.status === "offen" && m.termin && String(m.termin).slice(0, 10) < heute)
    .sort((a, b) => String(a.termin).localeCompare(String(b.termin)));
  ueberf.slice(0, 12).forEach(m => l.push({ schluessel: "v2-massnahme:" + m.id, stufe: "kritisch",
    titel: (m._v1 ? "Mangel überfällig: " : "Maßnahme überfällig: ") + (m.text || ""),
    sub: [m.anlage, m.verantwortlich ? "verantwortlich: " + m.verantwortlich : "Verantwortlich offen", "Termin " + asDat(m.termin)].filter(Boolean).join(" · "),
    frist: asSvTage(m.termin), aktionen: [["Öffnen", () => asGehe(m._v1 ? "maengel" : "massnahmen")]] }));
  if(ueberf.length > 12) l.push({ schluessel: "v2-massnahmen-rest", stufe: "kritisch", titel: "Weitere " + (ueberf.length - 12) + " überfällige Maßnahmen",
    sub: "Maßnahmen und Mängel mit abgelaufenem Termin", aktionen: [["Maßnahmen", () => asGehe("massnahmen")]] });
  /* 11. V2: ASA – § 11 ASiG mindestens vierteljährlich (Betriebe mit mehr als 20 Beschäftigten) */
  try{
    const kopf = typeof asBeschaeftigte === "function" ? asBeschaeftigte().kopf : 0;
    const letzte = asT("as_asa").filter(a => a.datum).sort((a, b) => String(b.datum).localeCompare(String(a.datum)))[0];
    const seit3 = new Date(); seit3.setMonth(seit3.getMonth() - 3);
    if(!(kopf > 0 && kopf <= 20) && !asT("as_asa").some(a => a.datum && String(a.datum).slice(0, 10) >= asSvIso(seit3)))
      l.push({ schluessel: "v2-asa:" + asSvKw(new Date()), stufe: "warnung", quittierbar: true, titel: "Sitzung des Arbeitsschutzausschusses (ASA) fällig",
        sub: "§ 11 ASiG – mindestens einmal vierteljährlich · " + (letzte ? "letzte Sitzung " + asDat(letzte.datum) : "noch keine Sitzung erfasst"),
        aktionen: [["ASA planen", () => asGehe("steuerung/asa")]] });
  }catch(e){}
  /* 12. V2: Ziele mit abgelaufenem Termin */
  asT("as_ziel").filter(z => z.status === "aktiv" && z.termin && String(z.termin).slice(0, 10) < heute).forEach(z => l.push({
    schluessel: "v2-ziel:" + z.id, stufe: "warnung", quittierbar: true, titel: "Zieltermin abgelaufen: " + (z.titel || ""),
    sub: "bis " + asDat(z.termin) + (z.verantwortlich ? " · verantwortlich: " + z.verantwortlich : "") + " – Ergebnis bewerten oder Ziel anpassen",
    frist: asSvTage(z.termin), aktionen: [["Ziel öffnen", () => asGehe("steuerung/ziele")]] }));
  /* 13. Unterlagen zur Überprüfung (Trigger in der DB, portal_pruefauftrag) + Regelfristen der Beurteilungen */
  asSvPaAufgaben().forEach(a => l.push(a));
  const rang = { kritisch: 0, warnung: 1, info: 2 };
  return l.filter(a => !(a.quittierbar && asSvQuittiert(a.schluessel)))
    .sort((a, b) => (rang[a.stufe] - rang[b.stufe]) || ((a.frist ?? 999) - (b.frist ?? 999)));
}

/* ---------------- Unterlagen überprüfen (Plan intern/portal-eigenstaendig.md, Schritt 1) ----------------
   Prüfaufträge legt die Datenbank selbst an (pruefauftrag_2026-10-14.sql): Maßnahme erledigt, neues SDB/H-Sätze,
   Anlagen-Unterlagen aktualisiert → neu unterweisen. Erledigt werden sie automatisch (neuer Stand/Freigabe) oder hier
   von der Fachkraft des Betriebs. Dazu die Regelfristen (naechste_pruefung) der Beurteilungen. */
const AS_SV_PA = {
  anlage_unterlagen: ["Unterlagen der Anlage prüfen", "anlagen"],
  bda_system: ["Beurteilung nachbewerten", "bda"],
  gs_gbu: ["Gefahrstoff-Beurteilung prüfen", "gefahrstoffe"],
  gs_ba: ["Gefahrstoff-Betriebsanweisung prüfen", "gefahrstoffe"],
  unterweisung: ["Beschäftigte neu unterweisen", "unterweisungen"] };
async function asSvPaLaden(){
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const hole = p => apiGet(p).then(r => Array.isArray(r) ? r : []).catch(() => []);
  const [pa, gbu, po] = await Promise.all([
    hole("/rest/v1/portal_pruefauftrag?select=*&erledigt_am=is.null" + k + "&order=faellig_am.asc"),
    hole("/rest/v1/portal_gefahrstoff_gbu?select=id,taetigkeit,gefahrstoff_id,naechste_pruefung,status&status=eq.freigegeben&naechste_pruefung=not.is.null" + k),
    hole("/rest/v1/as_pruefobjekt?select=id,art,bezeichnung,ort,naechste_am,aktiv,einheit_id&naechste_am=not.is.null" + k)]);
  AS_SV.pa = pa; AS_SV.gbuFrist = gbu; AS_SV.pruefFrist = po.filter(o => o.aktiv !== false);
}
function asSvPaText(a){ return (a.anlaesse || []).map(x => x.text).filter(Boolean); }
function asSvPaAufgaben(){
  const l = [], fk = !!(AS.fachkraft || AS.admin);
  (AS_SV.pa || []).forEach(a => { const [t, ziel] = AS_SV_PA[a.objekt_typ] || ["Unterlage prüfen", "unterlagen"], txt = asSvPaText(a);
    const akt = [["Öffnen", () => asGehe(ziel)]];
    if(fk){
      akt.push(["Geprüft – unverändert", () => asSvPaErledigen(a, "unveraendert")]);
      akt.push([a.objekt_typ === "unterweisung" ? "Unterwiesen" : "Aktualisiert", () => asSvPaErledigen(a, "aktualisiert")]);
    }
    l.push({ schluessel: "pa:" + a.id, stufe: asSvTage(a.faellig_am) < 0 ? "kritisch" : "warnung", titel: t + ": " + (a.objekt_titel || a.objekt_id),
      sub: txt.slice(0, 2).join(" · ") + (txt.length > 2 ? " · und " + (txt.length - 2) + " weitere" : "") + (fk ? "" : " – erledigt die Fachkraft"),
      frist: asSvTage(a.faellig_am), aktionen: akt }); });
  const bald = d => { const t = asSvTage(d); return t != null && t <= 30; };
  asT("as_arbeitssystem").filter(s => s.naechste_pruefung && bald(s.naechste_pruefung)).forEach(s => l.push({
    schluessel: "bda-frist:" + s.id + ":" + s.naechste_pruefung, stufe: asSvTage(s.naechste_pruefung) < 0 ? "kritisch" : "warnung",
    titel: "Beurteilung regelmäßig überprüfen: " + (s.name || ""), sub: "nächste Überprüfung " + asDat(s.naechste_pruefung) + " – prüfen und neu freigeben",
    frist: asSvTage(s.naechste_pruefung), aktionen: [["Öffnen", () => asGehe("bda")]] }));
  (AS_SV.gbuFrist || []).filter(g => bald(g.naechste_pruefung)).forEach(g => l.push({
    schluessel: "gbu-frist:" + g.id + ":" + g.naechste_pruefung, stufe: asSvTage(g.naechste_pruefung) < 0 ? "kritisch" : "warnung",
    titel: "Gefahrstoff-Beurteilung regelmäßig überprüfen: " + (g.taetigkeit || ""), sub: "nächste Überprüfung " + asDat(g.naechste_pruefung),
    frist: asSvTage(g.naechste_pruefung), aktionen: [["Öffnen", () => asGehe("gefahrstoffe")]] }));
  /* Prüfkataster: fällige und überfällige Prüfungen (Durchlauf 15.10.2026: standen nur im Kalender) */
  (AS_SV.pruefFrist || []).filter(o => bald(o.naechste_am)).forEach(o => l.push({
    schluessel: "pruef-frist:" + o.id + ":" + o.naechste_am, stufe: asSvTage(o.naechste_am) < 0 ? "kritisch" : "warnung",
    titel: "Prüfung fällig: " + (o.bezeichnung || (typeof asPfArt === "function" ? asPfArt(o.art).titel : o.art)), sub: [o.ort, "fällig " + asDat(o.naechste_am)].filter(Boolean).join(" · "),
    frist: asSvTage(o.naechste_am), aktionen: [["Öffnen", () => asGehe("pruefungen")]] }));
  return l;
}
function asSvPaKalender(){
  const l = [];
  (AS_SV.pa || []).forEach(a => l.push({ quelle: "pruefauftrag", id: a.id, datum: a.faellig_am, art: "pruefung",
    titel: ((AS_SV_PA[a.objekt_typ] || ["Unterlage prüfen"])[0]) + ": " + (a.objekt_titel || ""), sub: asSvPaText(a)[0] || "",
    ziel: (AS_SV_PA[a.objekt_typ] || [0, "unterlagen"])[1], roh: a }));
  asT("as_arbeitssystem").filter(s => s.naechste_pruefung).forEach(s => l.push({ quelle: "bda-frist", id: s.id, datum: s.naechste_pruefung,
    art: "pruefung", titel: "Beurteilung überprüfen: " + (s.name || ""), sub: "Regelfrist nach Freigabe", ziel: "bda", roh: s }));
  (AS_SV.gbuFrist || []).forEach(g => l.push({ quelle: "gbu-frist", id: g.id, datum: g.naechste_pruefung, art: "pruefung",
    titel: "Gefahrstoff-Beurteilung überprüfen: " + (g.taetigkeit || ""), sub: "Regelfrist nach Freigabe", ziel: "gefahrstoffe", roh: g }));
  return l;
}
function asSvPaErledigen(a, ergebnis){
  const t = (AS_SV_PA[a.objekt_typ] || ["Unterlage prüfen"])[0];
  asDialog({ titel: ergebnis === "unveraendert" ? "Geprüft – keine Änderung nötig" : (a.objekt_typ === "unterweisung" ? "Unterweisung durchgeführt" : "Unterlage aktualisiert"),
    inhalt: `<p><b>${esc(t)}: ${esc(a.objekt_titel || "")}</b></p>
      <ul class="hinweis">${asSvPaText(a).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="form"><label class="voll">Notiz (optional)<textarea data-f="notiz" maxlength="1000" placeholder="${ergebnis === "unveraendert" ? "z. B. Maßnahme ändert die Bewertung nicht" : "z. B. BA um neue Schutzhaube ergänzt"}"></textarea></label></div>
      <p class="hinweis">${a.objekt_typ === "anlage_unterlagen" && ergebnis === "aktualisiert" ? "Danach entsteht automatisch die Aufgabe, die Beschäftigten an dieser Anlage neu zu unterweisen. " : ""}Name und Zeit stehen im Logbuch.</p>`,
    knoepfe: [{ t: "Bestätigen", fn: async d => {
      const w = asWerte(d);
      try{ await apiSend("POST", "/rest/v1/rpc/portal_pruefauftrag_erledigen", { p_id: a.id, p_ergebnis: ergebnis, p_notiz: w.notiz || null }); }
      catch(e){ asMeldung("Konnte nicht gespeichert werden: " + asSvFehler(e)); return false; }
      await asSvPaLaden(); asMeldung("Erledigt"); asZeige();
    } }, { t: "Abbrechen", klasse: "sek", fn: () => true }] });
}

/* ======================= Kalender & To-dos ======================= */
AS_SEITEN.kalender = { titel: "Kalender & To-dos", icon: "◫", sort: 7.2, async render(main){
  asSvCss();
  const r = asReiter("kalender", [["todos", "To-dos"], ["kalender", "Kalender"], ["erinnerungen", "E-Mail-Erinnerungen"]], "todos");
  main.innerHTML = `<h1 class="seite">Kalender & To-dos</h1><p class="unter">Prüfungen, Fristen und Aufgaben – entstehen aus den Daten, erledigt wird am Ort der Aufgabe.</p>${r.html}<div id="svInhalt"><div class="leer">wird geladen …</div></div>`;
  try{ await Promise.all([asSvLaden(), typeof asBetriebLaden === "function" ? asBetriebLaden().catch(() => null) : null]); }
  catch(e){ const b = document.getElementById("svInhalt"); if(b) b.innerHTML = `<div class="leer">Konnte nicht geladen werden: ${esc(asSvFehler(e))}</div>`; return; }
  const box = document.getElementById("svInhalt"); if(!box) return;
  if(r.akt === "kalender") asSvKalender(box); else if(r.akt === "erinnerungen") asSvErinnerungen(box); else asSvTodos(box);
}};

function asSvTodos(box){
  const liste = asSvAufgaben();
  const kuerzlich = AS_SV.quitt.filter(q => { const t = asSvTage(String(q.quittiert_am || "").slice(0, 10)); return t != null && t >= -7; });
  const farbe = { kritisch: "rot", warnung: "gelb", info: "blau" };
  box.innerHTML = `<div class="karte"><h2>${liste.length ? liste.length + (liste.length === 1 ? " offene Aufgabe" : " offene Aufgaben") : "Keine offenen Aufgaben"}</h2>
      <p class="hinweis">Aufgaben entstehen aus Kalender, Nachweisen, Vorsorge, Unterweisungen, Vorfällen, Maßnahmen, ASA, Zielen, dem Forum
        und aus Änderungen, nach denen Unterlagen überprüft werden müssen.
        Erledigen Sie sie direkt hier – Hinweise ohne eigene Handlung quittieren Sie.</p>
      ${liste.length ? liste.map((a, i) => `<div class="sv-auf ${farbe[a.stufe]}">
          <div><b>${esc(a.titel)}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ""}${a.unterlagen ? asSvUnterlagenHtml(a.unterlagen) : ""}</div>
          <div>${a.frist != null ? asChip(asSvFristText(a.frist), a.frist < 0 ? "rot" : "gelb") : ""}
            <div class="sv-akt">${a.aktionen.map((x, j) => `<button class="btn ${j === 0 ? "sek " : ""}klein" data-auf="${i}" data-akt="${j}">${esc(x[0])}</button>`).join("")}
              ${a.quittierbar ? `<button class="btn sek klein" data-quitt="${i}" title="Zur Kenntnis genommen – verschwindet aus der Liste, bleibt im Logbuch">${esc(a.quittText || "Quittieren")}</button>` : ""}</div></div>
        </div>`).join("") : `<div class="leer">Alles erledigt – keine offenen Aufgaben.</div>`}</div>
    ${kuerzlich.length ? `<div class="karte"><h2>Zuletzt quittiert <span class="hinweis">${kuerzlich.length}</span></h2><div class="zeilen">${kuerzlich.map(q =>
      `<div class="z" style="cursor:default"><div><b>${esc(q.titel || q.schluessel)}</b><small>${esc(q.quittiert_von || "")} · ${esc(asSvDatZeit(q.quittiert_am))}${q.notiz ? " – " + esc(q.notiz) : ""}</small></div></div>`).join("")}</div></div>` : ""}`;
  box.querySelectorAll("[data-auf]").forEach(b => b.onclick = () => { try{ liste[+b.dataset.auf].aktionen[+b.dataset.akt][1](); }catch(e){ asMeldung("Fehler: " + asSvFehler(e)); } });
  box.querySelectorAll("[data-quitt]").forEach(b => b.onclick = () => asSvQuittierenDialog(liste[+b.dataset.quitt]));
  asSvUnterlagenBinden(box);
}

function asSvQuittierenDialog(a){
  asDialog({ titel: a.quittText === "Gelesen" ? "Als gelesen quittieren" : "Aufgabe quittieren",
    inhalt: `<p><b>${esc(a.titel)}</b>${a.sub ? "<br><span class=\"hinweis\">" + esc(a.sub) + "</span>" : ""}</p>
      <div class="form">${asSvNameFeld("Wer quittiert?")}
        <label class="voll">Notiz (optional)<textarea data-f="notiz" maxlength="1000" placeholder="z. B. Termin beim Schulungsanbieter angefragt"></textarea></label></div>
      <p class="hinweis">Die Aufgabe verschwindet aus der Liste. Name, Uhrzeit und Notiz stehen im Logbuch.</p>`,
    knoepfe: [{ t: a.quittText || "Quittieren", fn: async d => {
      const w = asWerte(d), wer = asSvNameLesen(w); if(!wer){ asMeldung("Bitte Ihren Namen eintragen."); return false; }
      try{
        await apiSend("POST", "/rest/v1/portal_aufgabe_quittung", { kunde_slug: AS.kunde, schluessel: a.schluessel, titel: String(a.titel).slice(0, 300),
          quittiert_von: wer, notiz: w.notiz || null }, "return=minimal");
      }catch(e){ if(!/409|duplicate|23505/.test(asSvFehler(e))){ asMeldung("Konnte nicht gespeichert werden: " + asSvFehler(e)); return false; } }
      await asSvQuittLaden(); asMeldung("Quittiert"); asZeige();
    } }, { t: "Abbrechen", klasse: "sek", fn: () => true }] });
}

function asSvKalender(box){
  const filterOpt = [["", "Alle Termine"], ["pruefung", "Prüfungen & Wartung"], ["schulung", "Schulungen"], ["nachweis", "Nachweise"], ["vorsorge", "Vorsorge"],
    ["unterweisung", "Unterweisungen"], ["massnahme", "Maßnahmen & Mängel"], ["ziel", "Ziele"], ["frist", "Fristen"], ["sonstiges", "Sonstiges"]];
  const f = AS_SV.filter;
  const alle = asSvEintraege().filter(e => !f || e.art === f || (f === "pruefung" && e.art === "wartung"));
  box.innerHTML = `<div class="sv-leiste">
      <button class="btn" id="svNeu">Termin anlegen</button>
      <button class="btn sek" id="svVorlage">Aus Vorlage (UVV-Prüfungen …)</button>
      <span style="flex:1"></span>
      <select id="svFilter" class="fl-pill" aria-label="Art">${filterOpt.map(o => `<option value="${o[0]}"${o[0] === f ? " selected" : ""}>${o[1]}</option>`).join("")}</select>
      <button class="sv-pill${AS_SV.ansicht === "monat" ? " an" : ""}" data-ansicht="monat">Monat</button><button class="sv-pill${AS_SV.ansicht === "liste" ? " an" : ""}" data-ansicht="liste">Liste</button>
    </div><div id="svKal"></div>`;
  const inhalt = box.querySelector("#svKal");
  if(AS_SV.ansicht === "monat") asSvMonat(inhalt, alle, box); else asSvListe(inhalt, alle);
  box.querySelector("#svNeu").onclick = () => asSvTerminDialog(null, null);
  box.querySelector("#svVorlage").onclick = () => asSvVorlagenDialog();
  box.querySelector("#svFilter").onchange = ev => { AS_SV.filter = ev.target.value; asSvKalender(box); };
  box.querySelectorAll("[data-ansicht]").forEach(b => b.onclick = () => { AS_SV.ansicht = b.dataset.ansicht; asSvKalender(box); });
}
function asSvEintragOeffnen(e){
  if(!e) return;
  if(e.quelle === "termin") asSvErledigenDialog(e.roh, true); else asSvZiel(e.ziel);
}
function asSvZeile(e, i){
  const tage = asSvTage(e.datum), farbe = asSvFarbe(tage, 30);
  return `<div class="z" data-e="${i}"><div><b>${asPunkt(farbe)}${esc(asDat(e.datum))} · ${esc(e.titel)}</b>
      <small>${esc(AS_SV_ART[e.art] || e.art || "")}${e.sub ? " · " + esc(e.sub) : ""}${e.quelle === "termin" ? "" : " · ansehen"}</small>${e.quelle === "termin" ? asSvUnterlagenHtml(e.roh) : ""}</div>
    <div style="text-align:right">${asChip(asSvFristText(tage), farbe === "gruen" ? "grau" : farbe)}${e.quelle === "termin" && asSvEntwurfOffen(e.roh) ? "<br>" + asChip("Entwurf – Freigabe offen", "gelb") : ""}</div></div>`;
}
function asSvListe(box, alle){
  const ueber = alle.filter(e => asSvTage(e.datum) < 0), bald = alle.filter(e => { const t = asSvTage(e.datum); return t >= 0 && t <= 30; }),
    spaeter = alle.filter(e => asSvTage(e.datum) > 30);
  const gruppe = (titel, l, zu) => l.length ? `<details class="karte"${zu ? "" : " open"}><summary style="cursor:pointer"><b style="color:var(--blau)">${titel}</b> <span class="hinweis">${l.length}</span></summary>
      <div class="zeilen">${l.map(e => asSvZeile(e, alle.indexOf(e))).join("")}</div></details>` : "";
  const erledigt = AS_SV.termine.filter(t => t.erledigt_am && asSvTage(t.erledigt_am) > -366)
    .sort((a, b) => String(b.erledigt_am).localeCompare(String(a.erledigt_am)));
  box.innerHTML = (alle.length ? gruppe("Überfällig", ueber) + gruppe("Nächste 30 Tage", bald) + gruppe("Später", spaeter, spaeter.length > 12)
      : `<div class="karte"><div class="leer">Noch keine Termine. Legen Sie Prüftermine an – am schnellsten über <b>„Aus Vorlage“</b>.</div></div>`)
    + (erledigt.length ? `<details class="karte"><summary style="cursor:pointer"><b style="color:var(--blau)">Erledigt</b> <span class="hinweis">letzte 12 Monate · ${erledigt.length}</span></summary>
        <div class="zeilen">${erledigt.map(t => `<div class="z" style="cursor:default"><div><b>${esc(asDat(t.erledigt_am))} · ${esc(t.titel)}${t.objekt ? " · " + esc(t.objekt) : ""}</b>
          <small>erledigt von ${esc(t.erledigt_von || "")}${t.erledigt_notiz ? " – " + esc(t.erledigt_notiz) : ""} · war fällig ${esc(asDat(t.faellig_am))}</small></div>
          <div>${asChip("erledigt", "gruen")}${AS.admin ? ` <button class="btn adm klein" data-zurueck="${esc(t.id)}">rückgängig</button>` : ""}</div></div>`).join("")}</div></details>` : "");
  box.querySelectorAll("[data-e]").forEach(z => z.onclick = () => asSvEintragOeffnen(alle[+z.dataset.e]));
  asSvUnterlagenBinden(box);
  box.querySelectorAll("[data-zurueck]").forEach(b => b.onclick = async ev => {
    ev.stopPropagation();
    const t = AS_SV.termine.find(x => x.id === b.dataset.zurueck); if(!t || !confirm("Erledigung zurücknehmen? Ein automatisch angelegter Folgetermin wird entfernt.")) return;
    try{
      if(t.nachfolger_id){ const n = AS_SV.termine.find(x => x.id === t.nachfolger_id); if(n && !n.erledigt_am) await apiSend("DELETE", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(n.id), null, "return=minimal"); }
      await apiSend("PATCH", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(t.id), { erledigt_am: null, erledigt_von: null, erledigt_notiz: null, nachfolger_id: null,
        geaendert_von: "OAK engineering", geaendert_am: new Date().toISOString() }, "return=minimal");
      asMeldung("Erledigung zurückgenommen"); asZeige();
    }catch(e){ asMeldung("Konnte nicht zurückgenommen werden: " + asSvFehler(e)); }
  });
}
function asSvMonat(box, alle, aussen){
  if(!AS_SV.monat){ const h = new Date(); AS_SV.monat = new Date(h.getFullYear(), h.getMonth(), 1); }
  const jahr = AS_SV.monat.getFullYear(), mon = AS_SV.monat.getMonth();
  const start = new Date(jahr, mon, 1 - ((new Date(jahr, mon, 1).getDay() + 6) % 7));
  const heute = asSvHeute();
  let zellen = "";
  for(let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate() + i); const k = asSvIso(d);
    const tag = alle.filter(e => String(e.datum).slice(0, 10) === k);
    zellen += `<div class="sv-tag${d.getMonth() !== mon ? " fremd" : ""}${k === heute ? " heute" : ""}"><span class="sv-nr">${d.getDate()}</span>
      ${tag.slice(0, 3).map(e => { const n = e.quelle === "termin" ? asSvTerminDoks(e.roh).length : 0;
        return `<button class="sv-e ${asSvFarbe(asSvTage(e.datum), 30)}" data-e="${alle.indexOf(e)}" title="${esc(e.titel)}${n ? " · " + n + (n === 1 ? " Unterlage" : " Unterlagen") : ""}">${esc(e.titel)}${n ? " ·" + n + "▤" : ""}</button>`; }).join("")}
      ${tag.length > 3 ? `<span class="hinweis">+${tag.length - 3} weitere</span>` : ""}</div>`;
  }
  const ueber = alle.filter(e => asSvTage(e.datum) < 0);
  box.innerHTML = (ueber.length ? `<div class="karte" style="border-left:4px solid var(--rot);cursor:pointer" id="svUeber"><b>${ueber.length} ${ueber.length === 1 ? "Termin ist" : "Termine sind"} überfällig</b> <span class="hinweis">– in der Liste ansehen</span></div>` : "")
    + `<div class="karte"><div class="sv-mkopf"><button class="btn sek klein" id="svZurueck" aria-label="Vormonat">‹</button>
      <h2>${esc(AS_SV.monat.toLocaleDateString("de-DE", { month: "long", year: "numeric" }))}</h2>
      <button class="btn sek klein" id="svVor" aria-label="Nächster Monat">›</button><button class="btn sek klein" id="svHeute">Heute</button></div>
    <div class="sv-raster">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(t => `<div class="sv-wt">${t}</div>`).join("")}${zellen}</div></div>`;
  const ub = box.querySelector("#svUeber"); if(ub) ub.onclick = () => { AS_SV.ansicht = "liste"; asSvKalender(aussen); };
  box.querySelector("#svZurueck").onclick = () => { AS_SV.monat = new Date(jahr, mon - 1, 1); asSvKalender(aussen); };
  box.querySelector("#svVor").onclick = () => { AS_SV.monat = new Date(jahr, mon + 1, 1); asSvKalender(aussen); };
  box.querySelector("#svHeute").onclick = () => { AS_SV.monat = null; asSvKalender(aussen); };
  box.querySelectorAll("[data-e]").forEach(b => b.onclick = () => asSvEintragOeffnen(alle[+b.dataset.e]));
}

function asSvMaschinenNamen(){
  try{ if(typeof asAnlagen === "function") return asAnlagen().map(d => d.maschine || d.titel).filter(Boolean); }catch(e){}
  return [];
}
function asSvTerminDialog(t, vorlage){
  const v = vorlage || [];
  const wert = (feld, std) => t ? (t[feld] == null ? "" : t[feld]) : (std == null ? "" : std);
  const intervall = t ? (t.intervall_monate || 0) : (v[2] != null ? v[2] : 12);
  const ivOpt = AS_SV_INTERVALLE.slice(); if(intervall && !ivOpt.some(i => i[0] === intervall)) ivOpt.push([intervall, "alle " + intervall + " Monate"]);
  const kn = [{ t: "Speichern", fn: async d => {
    const w = asWerte(d);
    if(!w.titel || w.titel.length < 2){ asMeldung("Bitte eintragen, was ansteht."); return false; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(w.faellig_am || "")){ asMeldung("Bitte das Fälligkeitsdatum eintragen."); return false; }
    const wer = asSvNameLesen(w); if(!wer){ asMeldung("Bitte Ihren Namen eintragen."); return false; }
    const daten = { titel: w.titel.slice(0, 200), art: w.art || "pruefung", faellig_am: w.faellig_am, intervall_monate: parseInt(w.intervall_monate, 10) || null,
      objekt: w.objekt || null, zustaendig: w.zustaendig || null, grundlage: w.grundlage || null, notiz: w.notiz || null,
      unterlagen: [...d.querySelectorAll("[data-ul]:checked")].map(x => x.dataset.ul),
      geaendert_von: wer, geaendert_am: new Date().toISOString() };
    try{
      if(t) await apiSend("PATCH", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(t.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_termin", Object.assign({ kunde_slug: AS.kunde, erstellt_von: wer }, daten), "return=minimal");
    }catch(e){ asMeldung("Konnte nicht gespeichert werden: " + asSvFehler(e)); return false; }
    asMeldung("Termin gespeichert"); asZeige();
  } }];
  if(t) kn.push({ t: "Entfernen", klasse: "gefahr", fn: async d => {
    const wer = asSvNameLesen(asWerte(d)); if(!wer){ asMeldung("Bitte Ihren Namen eintragen."); return false; }
    if(!confirm("Termin „" + t.titel + "“ entfernen?")) return false;
    try{ await apiSend("PATCH", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(t.id), { archiviert: true, geaendert_von: wer, geaendert_am: new Date().toISOString() }, "return=minimal"); }
    catch(e){ asMeldung("Konnte nicht entfernt werden: " + asSvFehler(e)); return false; }
    asMeldung("Termin entfernt"); asZeige();
  } });
  kn.push({ t: "Abbrechen", klasse: "sek", fn: () => true });
  const masch = asSvMaschinenNamen();
  asDialog({ titel: t ? "Termin ändern" : "Termin anlegen", breit: true, inhalt: `<div class="form">
      <label class="voll">Was?<input type="text" data-f="titel" maxlength="200" value="${esc(wert("titel", v[0]))}" placeholder="z. B. UVV-Prüfung Stapler"></label>
      ${asAuswahl("Art", "art", wert("art", v[1] || "pruefung"), ["pruefung", "wartung", "schulung", "vorsorge", "begehung", "frist", "sonstiges"].map(a => [a, AS_SV_ART[a]]))}
      ${asFeld("Fällig am", "faellig_am", wert("faellig_am", ""), "date")}
      ${asAuswahl("Wiederholung", "intervall_monate", intervall, ivOpt, "voll")}
      ${vorlage && !v[2] ? `<p class="hinweis voll">Frist bitte aus der Gefährdungsbeurteilung übernehmen.</p>` : ""}
      <label class="voll">Gerät, Maschine oder Bereich<input type="text" data-f="objekt" list="svObjekte" maxlength="200" value="${esc(wert("objekt", ""))}" placeholder="z. B. Stapler 3, Halle 14"></label>
      <datalist id="svObjekte">${masch.map(m => `<option value="${esc(m)}">`).join("")}</datalist>
      <label class="voll">Zuständig<input type="text" data-f="zustaendig" maxlength="120" value="${esc(wert("zustaendig", ""))}" placeholder="z. B. Instandhaltung, Fa. Muster (Prüfer)"></label>
      <label class="voll">Grundlage<input type="text" data-f="grundlage" maxlength="300" value="${esc(wert("grundlage", v[3]))}"></label>
      <label class="voll">Notiz<textarea data-f="notiz" maxlength="2000">${esc(wert("notiz", ""))}</textarea></label>
      ${asSvUnterlagenWahl(t ? (t.unterlagen || []) : [])}
      ${asSvNameFeld()}</div>`, knoepfe: kn });
  asSvUnterlagenWahlBinden(document.getElementById("dlg"));
}
function asSvErledigenDialog(t, mitAendern){
  if(!t) return;
  const heute = asSvHeute();
  const kn = [{ t: "Erledigt", fn: async d => {
    const w = asWerte(d), wer = asSvNameLesen(w); if(!wer){ asMeldung("Bitte eintragen, wer den Termin erledigt hat."); return false; }
    const dt = w.datum || "";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dt) || dt > heute){ asMeldung("Bitte ein Datum bis heute eintragen."); return false; }
    try{ await apiSend("POST", "/rest/v1/rpc/termin_erledigen", { p_id: t.id, p_datum: dt, p_wer: wer, p_notiz: w.notiz || null }); }
    catch(e){ asMeldung("Konnte nicht gespeichert werden: " + asSvFehler(e)); return false; }
    asMeldung(t.intervall_monate ? "Erledigt – Folgetermin angelegt" : "Erledigt"); asZeige();
  } }];
  if(mitAendern) kn.push({ t: "ändern", klasse: "sek", fn: () => { asSvTerminDialog(t, null); return false; } });
  kn.push({ t: "Abbrechen", klasse: "sek", fn: () => true });
  const d = asDialog({ titel: "Termin erledigt", inhalt: `<p><b>${esc(t.titel)}</b>${t.objekt ? " · " + esc(t.objekt) : ""}<br>
      <span class="hinweis">fällig ${esc(asDat(t.faellig_am))}${t.grundlage ? "<br>" + esc(t.grundlage) : ""}</span></p>
    ${asSvTerminDoks(t).length ? `<div class="sv-ulbox" style="margin-bottom:10px"><div class="sv-ulkopf"><b>Erforderliche Unterlagen</b>${asSvEntwurfOffen(t) ? asChip("Entwurf – Freigabe offen", "gelb") : ""}</div>${asSvUnterlagenHtml(t)}</div>` : ""}
    <div class="form">${asSvNameFeld("Wer hat es erledigt?")}
      <label>Erledigt am<input type="date" data-f="datum" value="${heute}" max="${heute}"></label>
      <label class="voll">Bemerkung (z. B. Prüfer, Ergebnis, Plakette)<textarea data-f="notiz" maxlength="2000"></textarea></label></div>
    <p class="hinweis" id="svNaechst"></p>`, knoepfe: kn });
  const naechst = () => { const el = d.querySelector('[data-f="datum"]'), ziel = d.querySelector("#svNaechst"); if(!el || !ziel) return;
    ziel.textContent = t.intervall_monate && /^\d{4}-\d{2}-\d{2}$/.test(el.value) ? "Der nächste Termin wird automatisch für den " + asDat(asSvPlusMonate(el.value, t.intervall_monate)) + " angelegt." : ""; };
  const el = d.querySelector('[data-f="datum"]'); if(el) el.onchange = naechst; naechst();
  asSvUnterlagenBinden(d, d);
}
function asSvVorlagenDialog(){
  const d = asDialog({ titel: "Termin aus Vorlage", breit: true, inhalt: `<p class="hinweis">Übliche Prüfungen und Fristen mit Fundstelle. Die verbindliche Frist legt der Betrieb in seiner Gefährdungsbeurteilung fest.</p>
    <div class="zeilen">${AS_SV_VORLAGEN.map((v, i) => `<div class="z" data-v="${i}"><div><b>${esc(v[0])}</b>
      <small>${v[2] ? esc(asSvIntervallText(v[2])) : "Frist selbst festlegen"}${v[3] ? " · " + esc(v[3]) : ""}</small></div><span class="hinweis">wählen ›</span></div>`).join("")}</div>`,
    knoepfe: [{ t: "Schließen", klasse: "sek", fn: () => true }] });
  d.querySelectorAll("[data-v]").forEach(z => z.onclick = () => asSvTerminDialog(null, AS_SV_VORLAGEN[+z.dataset.v]));
}

/* ======================= Frage an OAK (Forum) ======================= */
AS_SEITEN.fragen = { titel: "Frage an OAK", icon: "?", sort: 7.4, async render(main){
  asSvCss();
  main.innerHTML = `<h1 class="seite">Frage an OAK</h1><p class="unter">Fragen zur Arbeitssicherheit – wie in einem Forum.</p><div id="svInhalt"><div class="leer">wird geladen …</div></div>`;
  try{ await Promise.all([asSvAnfragenLaden(), typeof asBetriebLaden === "function" ? asBetriebLaden().catch(() => null) : null]); }
  catch(e){ const b = document.getElementById("svInhalt"); if(b) b.innerHTML = `<div class="leer">Konnte nicht geladen werden: ${esc(asSvFehler(e))}</div>`; return; }
  const r = AS.reiter.fragen; if(r && AS_SV.anfragen.some(a => a.id === r)){ AS_SV.fOffen = r; AS.reiter.fragen = null; }
  const box = document.getElementById("svInhalt"); if(box) asSvForum(box);
}};
function asSvMaschinen(){
  try{ if(typeof asAnlagen === "function") return asAnlagen().map(d => ({ id: d.maschinen_id, name: d.maschine || d.titel })).filter(x => x.id); }catch(e){}
  return [];
}
function asSvMaschinenName(mid){ const m = asSvMaschinen().find(x => x.id === mid); return m ? m.name : "Maschine"; }
function asSvBeitraege(id){ return AS_SV.beitraege.filter(b => b.anfrage_id === id); }

function asSvForum(box){
  const themen = AS_SV.anfragen, admin = AS.admin;
  const meld = AS_SV.fMeldung; AS_SV.fMeldung = "";
  const offen = themen.filter(a => a.status !== "beantwortet").length;
  const q = AS_SV.fSuche.toLowerCase().trim(), fl = AS_SV.fFilter;
  const sicht = themen.filter(a => {
    const st = a.status === "beantwortet" ? "beantwortet" : "offen";
    if(fl && st !== fl) return false;
    if(!q) return true;
    return [a.betreff, a.text, a.von_name, ...asSvBeitraege(a.id).map(b => b.text)].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const karte = a => {
    const bt = asSvBeitraege(a.id), auf = AS_SV.fOffen === a.id, beantw = a.status === "beantwortet";
    return `<div class="sv-thema" data-id="${esc(a.id)}">
      <div class="sv-zeile" data-auf="${esc(a.id)}"><div><b>${esc(a.betreff)}</b>
        <small>${esc(a.von_name || "")} · ${esc(asSvDatZeit(a.created_at))}${a.maschinen_id ? " · " + esc(asSvMaschinenName(a.maschinen_id)) : ""}${a.dokument_titel ? " · zum Dokument" : ""}</small></div>
        <div>${asChip(bt.length + (bt.length === 1 ? " Antwort" : " Antworten"), "grau")} ${asChip(beantw ? "beantwortet" : "offen", beantw ? "gruen" : "gelb")}</div></div>
      ${auf ? asSvDetail(a, bt) : ""}</div>`;
  };
  box.innerHTML = `${meld ? `<div class="karte" style="border-left:4px solid var(--gruen)">${esc(meld)}</div>` : ""}
    <div class="karte"><h2>Fragen zur Arbeitssicherheit <button class="btn klein" id="svFrageNeu">Neue Frage stellen</button></h2>
      <p class="hinweis">Fragen stellen, Antworten lesen – wie in einem Forum. Alle im Betrieb sehen die Beiträge; ${admin ? "du antwortest direkt hier." : "OAK engineering antwortet direkt hier."}</p>
      <div class="sv-leiste"><input type="search" id="svSuche" placeholder="In Fragen und Antworten suchen" autocomplete="off" value="${esc(AS_SV.fSuche)}">
        ${[["", "Alle"], ["offen", "Offen" + (offen ? " (" + offen + ")" : "")], ["beantwortet", "Beantwortet"]].map(p => `<button class="sv-pill${fl === p[0] ? " an" : ""}" data-filter="${p[0]}">${esc(p[1])}</button>`).join("")}
        <span class="hinweis">${themen.length ? sicht.length + (sicht.length === 1 ? " Thema" : " Themen") : ""}</span></div>
      ${themen.length ? (sicht.map(karte).join("") || `<div class="leer">Keine Treffer.</div>`) : `<div class="leer">Noch keine Fragen. Stellen Sie die erste – ein Foto oder eine Datei können Sie anhängen.</div>`}</div>`;
  box.querySelector("#svFrageNeu").onclick = () => asSvFrageDialog(box);
  const su = box.querySelector("#svSuche");
  su.onchange = () => { AS_SV.fSuche = su.value; asSvForum(box); };
  su.onkeydown = ev => { if(ev.key === "Enter"){ AS_SV.fSuche = su.value; asSvForum(box); } };
  box.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { AS_SV.fFilter = b.dataset.filter; asSvForum(box); });
  box.querySelectorAll("[data-auf]").forEach(z => z.onclick = () => { const id = z.dataset.auf; AS_SV.fOffen = AS_SV.fOffen === id ? null : id; asSvForum(box); });
  box.querySelectorAll("[data-anhang]").forEach(a => a.onclick = async ev => {
    ev.preventDefault(); const u = await asSvSigniert(a.dataset.anhang);
    if(u) window.open(u, "_blank", "noopener"); else asMeldung("Anhang konnte nicht geöffnet werden.");
  });
  box.querySelectorAll("[data-dok]").forEach(b => b.onclick = ev => { ev.preventDefault(); asDokOeffnen(b.dataset.dok, b.dataset.titel || "Dokument"); });
  const form = box.querySelector(".sv-antwort"); if(form) asSvAntwortVerdrahten(form, box);
  const auf = box.querySelector(`.sv-thema[data-id="${CSS.escape(AS_SV.fOffen || "")}"]`); if(auf && AS_SV.fOffen) auf.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function asSvDetail(a, bt){
  const beitrag = (von, istOak, zeit, text, anhang) => `<div class="sv-beitrag${istOak ? " oak" : ""}">
      <div><b>${esc(von || (istOak ? "OAK engineering" : ""))}</b> <span class="hinweis">${esc(asSvDatZeit(zeit))}</span></div>
      ${text ? `<div class="sv-text">${esc(text)}</div>` : ""}
      ${anhang ? `<a class="btn sek klein" href="#" data-anhang="${esc(anhang)}" style="display:inline-block;margin-top:6px;text-decoration:none">Anhang öffnen</a>` : ""}</div>`;
  const dok = a.dokument_link && /^(viewer|maschine)\.html\?/.test(a.dokument_link)
    ? `<p><button class="btn sek klein" data-dok="${esc(a.dokument_link)}" data-titel="${esc(a.dokument_titel || "Dokument")}">Zum Dokument${a.dokument_titel ? ": " + esc(a.dokument_titel) : ""}</button></p>` : "";
  return `<div style="margin-top:8px">
      ${beitrag(a.von_name, false, a.created_at, a.text, a.anhang_pfad)}${dok}
      ${bt.map(b => beitrag(b.von_name, b.von_admin, b.created_at, b.text, b.anhang_pfad)).join("")}
      <form class="sv-antwort form" data-id="${esc(a.id)}">
        ${asSvGemeinsam() && !AS.admin ? `<label class="voll">Ihr Name<input type="text" data-f="wer" autocomplete="name" value="${esc(asSvVorname())}" placeholder="Vor- und Nachname"></label>` : ""}
        <label class="voll">Antwort<textarea data-f="text" rows="3" placeholder="Antwort schreiben …"></textarea></label>
        <label>Foto oder Datei (optional)<input type="file" accept="image/*,.pdf"></label>
        <div class="voll sv-leiste" style="margin:0"><button type="submit" class="btn sek">Antworten</button><span class="hinweis" data-meld></span></div>
      </form></div>`;
}
function asSvAntwortVerdrahten(form, box){
  form.onsubmit = async ev => {
    ev.preventDefault();
    const meld = form.querySelector("[data-meld]"), w = asWerte(form), datei = form.querySelector('input[type="file"]').files[0];
    const a = AS_SV.anfragen.find(x => x.id === form.dataset.id); const slug = (a && a.kunde_slug) || AS.kunde;
    let name = AS.ich || "";
    if(form.querySelector('[data-f="wer"]')){ name = asSvNameLesen(w); if(!name){ meld.textContent = "Bitte Ihren Namen eintragen."; return; } }
    if(!w.text){ meld.textContent = "Bitte eine Antwort schreiben."; return; }
    meld.textContent = "Wird gesendet …";
    try{
      asSvDateiOk(datei);
      const pfad = datei ? await asSvHochladen(datei, slug + "/anfragen/" + Date.now() + "-" + asSvDateiName(datei)) : null;
      const neuB = await apiSend("POST", "/rest/v1/portal_anfrage_beitrag", { anfrage_id: form.dataset.id, kunde_slug: slug, von_name: name, text: w.text, anhang_pfad: pfad }, "return=representation");
      const id = Array.isArray(neuB) ? (neuB[0] || {}).id : (neuB && neuB.id);
      if(id) asSvMail({ beitrag_id: id });
      await asSvAnfragenLaden(); asSvForum(box);
    }catch(e){ meld.textContent = "Konnte nicht gesendet werden: " + asSvFehler(e); }
  };
}
function asSvFrageDialog(box){
  const masch = asSvMaschinen();
  asDialog({ titel: "Neue Frage stellen", breit: true, inhalt: `<div class="form">
      ${asSvGemeinsam() && !AS.admin ? asSvNameFeld() : ""}
      <label class="voll">Worum geht es?<input type="text" data-f="betreff" maxlength="200" placeholder="z. B. Schutztür an der D100 schließt nicht richtig" autocomplete="off"></label>
      <label class="voll">Ihre Frage oder Beschreibung<textarea data-f="text" rows="4"></textarea></label>
      ${masch.length ? asAuswahl("Maschine (optional)", "maschinen_id", "", [["", "– keine bestimmte Maschine –"]].concat(masch.map(m => [m.id, m.name || m.id]))) : ""}
      <label>Foto oder Datei (optional)<input type="file" id="svFrageDatei" accept="image/*,.pdf"></label></div>
      <p class="hinweis">OAK engineering wird per E-Mail benachrichtigt (nur ein Hinweis mit Link, kein Inhalt). Die Antwort erscheint hier.</p>`,
    knoepfe: [{ t: "Frage veröffentlichen", fn: async d => {
      const w = asWerte(d), datei = (d.querySelector("#svFrageDatei").files || [])[0];
      let name = AS.ich || ((getSession() || {}).user || {}).email || "";
      if(d.querySelector('[data-f="wer"]')){ name = asSvNameLesen(w); if(!name){ asMeldung("Bitte Ihren Namen eintragen."); return false; } }
      if(!w.betreff || w.betreff.length < 3){ asMeldung("Bitte kurz sagen, worum es geht."); return false; }
      if(!w.text && !datei){ asMeldung("Bitte eine Frage schreiben oder ein Foto anhängen."); return false; }
      const s = getSession();
      try{
        asSvDateiOk(datei);
        const pfad = datei ? await asSvHochladen(datei, AS.kunde + "/anfragen/" + Date.now() + "-" + asSvDateiName(datei)) : null;
        const neuA = await apiSend("POST", "/rest/v1/portal_anfrage", {
          kunde_slug: AS.kunde, von_user_id: s && s.user ? s.user.id : null, von_name: name,
          von_email: s && s.user ? s.user.email : null, betreff: w.betreff, text: w.text || "", maschinen_id: w.maschinen_id || null, anhang_pfad: pfad,
          letzte_aktivitaet: new Date().toISOString() }, "return=representation");
        const id = Array.isArray(neuA) ? (neuA[0] || {}).id : (neuA && neuA.id);
        if(id){ asSvMail(id); AS_SV.fOffen = id; }
      }catch(e){ asMeldung("Konnte nicht gesendet werden: " + asSvFehler(e)); return false; }
      AS_SV.fMeldung = "Ihre Frage ist veröffentlicht. OAK engineering ist benachrichtigt – die Antwort erscheint hier.";
      await asSvAnfragenLaden(); asSvForum(box);
    } }, { t: "Abbrechen", klasse: "sek", fn: () => true }] });
}

/* ======================= Aktuelles ======================= */
AS_SEITEN.aktuelles = { titel: "Aktuelles", icon: "◇", sort: 7.6, async render(main){
  asSvCss();
  const r = asReiter("aktuelles", [["recht", "Rechtliche Neuerungen"], ["versionen", "Versionshinweise"]], "recht");
  main.innerHTML = `<h1 class="seite">Aktuelles</h1><p class="unter">Rechtliche Neuerungen zur Kenntnisnahme und was im Programm neu ist.</p>${r.html}<div id="svInhalt"><div class="leer">wird geladen …</div></div>`;
  const box = () => document.getElementById("svInhalt");
  if(r.akt === "versionen"){ await asSvVersionen(); if(box()) asSvVersionenZeigen(box()); return; }
  if(!AS_SV.recht) AS_SV.recht = await apiGet("/rest/v1/portal_rechtsinfo?select=*&order=sortierung.asc,erfasst_am.desc").catch(() => null);
  if(AS_SV.rqKunde !== AS.kunde){ AS_SV.rq = await apiGet("/rest/v1/portal_rechtsinfo_quittung?select=*&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => []) || []; AS_SV.rqKunde = AS.kunde; }
  if(!box()) return;
  if(!Array.isArray(AS_SV.recht)){ AS_SV.recht = null; box().innerHTML = `<div class="karte"><div class="leer">Rechtliche Neuerungen konnten nicht geladen werden.</div></div>`; return; }
  asSvRechtZeigen(box());
}};
const AS_RI_THEMEN = [["anlagen", "Anlagen & Maschinen"], ["bda", "Gefährdungsbeurteilung"], ["gefahrstoffe", "Gefahrstoffe"], ["unterweisung", "Unterweisung"],
  ["organisation", "Organisation & Beauftragte"], ["pruefungen", "Prüfungen"], ["umwelt", "Umwelt"]];
function asSvRechtZeigen(el){
  const recht = AS_SV.recht.filter(x => AS.admin || (x.sichtbar !== false && (!x.kunde_slug || x.kunde_slug === AS.kunde)));
  const neu = x => new Date(x.erfasst_am) >= new Date(Date.now() - 14 * 86400000);
  const reihenfolge = { gilt: 1, kommt: 0, vorhaben: 2 };
  const sortiert = recht.slice().sort((a, b) => (neu(b) - neu(a)) || ((reihenfolge[a.status] ?? 3) - (reihenfolge[b.status] ?? 3)) || ((a.sortierung || 0) - (b.sortierung || 0)));
  const stand = recht.reduce((m, x) => (x.geaendert_am && x.geaendert_am > m) ? x.geaendert_am : m, "");
  const farbe = { gilt: "gruen", kommt: "gelb", vorhaben: "grau" };
  const quitt = id => (AS_SV.rq || []).find(q => q.rechtsinfo_id === id);
  const darf = !!(AS.gf || AS.fachkraft);
  const offen = recht.filter(x => x.sichtbar !== false && x.status !== "vorhaben" && !quitt(x.id)).length;
  const thema = t => (AS_RI_THEMEN.find(z => z[0] === t) || [t, t])[1];
  el.innerHTML = `<div class="karte"><h2>Rechtliche Neuerungen ${AS.admin ? `<button class="btn adm klein" id="riNeu">+ Eintrag</button>` : ""}</h2>
    ${stand ? `<p class="hinweis">Stand ${esc(asDat(stand))} · gepflegt von OAK engineering${darf && offen ? ` · <b>${offen} noch nicht zur Kenntnis genommen</b>` : ""}</p>` : ""}
    ${darf ? `<p class="hinweis">Mit „Zur Kenntnis nehmen“ halten Sie fest, dass Sie die Neuerung geprüft haben. Betrifft sie Ihren Betrieb, wählen Sie die Unterlagen aus – dafür entstehen Prüfaufträge.</p>` : ""}
    ${sortiert.length ? sortiert.map(x => { const q = quitt(x.id);
      return `<div class="sv-recht"${x.sichtbar === false ? ' style="opacity:.5"' : ""}>
        <div>${asChip((AS_SV_RECHT_STATUS[x.status] || x.status || "") + (x.datum ? " " + asDat(x.datum) : ""), farbe[x.status] || "grau")}
          ${neu(x) ? asChip("neu", "blau") : ""}${x.bereich === "umwelt" ? " " + asChip("Umwelt", "grau") : ""}
          ${(x.betrifft || []).map(t => " " + asChip(thema(t), "grau")).join("")}${x.sichtbar === false ? " " + asChip("ausgeblendet", "grau") : ""}
          ${AS.admin && x.kunde_slug ? " " + asChip("nur " + x.kunde_slug, "gelb") : ""}</div>
        <h3>${esc(x.titel)}</h3>
        <p>${esc(x.kurz)}</p>
        ${x.fuer_betrieb ? `<p><b>Was heißt das für uns?</b> ${esc(x.fuer_betrieb)}</p>` : ""}
        ${x.quelle ? `<div class="hinweis">${esc(x.quelle)}</div>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">
          ${q ? asChip("zur Kenntnis genommen " + asDat(String(q.quittiert_am).slice(0, 10)) + (q.quittiert_von ? " · " + q.quittiert_von : "") + (q.betrifft_uns ? " · betrifft uns (" + q.pruefauftraege + " Prüfaufträge)" : ""), q.betrifft_uns ? "gelb" : "gruen") : ""}
          ${darf && x.sichtbar !== false ? `<button class="btn ${q ? "sek" : ""} klein" data-riq="${esc(x.id)}">${q ? "Erneut bewerten" : "Zur Kenntnis nehmen"}</button>` : ""}
          ${AS.admin ? `<button class="btn adm klein" data-rie="${esc(x.id)}">Bearbeiten</button>` : ""}</div></div>`; }).join("") : `<div class="leer">Keine Einträge.</div>`}</div>`;
  el.querySelectorAll("[data-riq]").forEach(b => b.onclick = () => asSvRechtQuittieren(AS_SV.recht.find(x => x.id === b.dataset.riq), el));
  el.querySelectorAll("[data-rie]").forEach(b => b.onclick = () => asSvRechtBearbeiten(AS_SV.recht.find(x => x.id === b.dataset.rie), el));
  const nb = el.querySelector("#riNeu"); if(nb) nb.onclick = () => asSvRechtBearbeiten(null, el);
}
/* Kenntnisnahme durch GF/Fachkraft; „betrifft uns“ -> Prüfaufträge für die gewählten Unterlagen (RPC portal_rechtsinfo_quittieren) */
async function asSvRechtQuittieren(x, el){
  if(!x) return;
  await asBetriebLaden();
  const th = new Set(x.betrifft || []), alle = !th.size;
  const gruppen = [];
  if(alle || th.has("anlagen") || th.has("bda") || th.has("pruefungen"))
    gruppen.push(["Anlagen (Unterlagen der Anlage)", asAnlagen().map(d => ({ typ: "anlage_unterlagen", id: d.maschinen_id, titel: d.maschine || d.titel || d.maschinen_id }))]);
  if(alle || th.has("bda") || th.has("organisation"))
    gruppen.push(["Arbeitssysteme (Beurteilung)", asT("as_arbeitssystem").map(s => ({ typ: "bda_system", id: s.id, titel: s.name }))]);
  if(alle || th.has("gefahrstoffe")){
    const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
    const [gb, gs] = await Promise.all([apiGet("/rest/v1/portal_gefahrstoff_gbu?select=id,gefahrstoff_id,taetigkeit" + k).catch(() => []),
      apiGet("/rest/v1/portal_gefahrstoff?select=id,bezeichnung" + k).catch(() => [])]);
    const nm = Object.fromEntries((gs || []).map(g => [g.id, g.bezeichnung]));
    gruppen.push(["Gefahrstoff-Beurteilungen", (gb || []).map(g => ({ typ: "gs_gbu", id: g.id, titel: (nm[g.gefahrstoff_id] || "Gefahrstoff") + " – " + (g.taetigkeit || "") }))]);
  }
  const liste = gruppen.flatMap(g => g[1]).filter(o => o.id);
  let n = 0;
  const html = gruppen.filter(g => g[1].length).map(([t, os]) => `<div style="margin-top:10px"><b>${esc(t)}</b>
      <label style="font-size:13px;margin-left:8px"><input type="checkbox" data-alle="${esc(t)}"> alle</label>
      <div style="max-height:180px;overflow:auto;border:1px solid var(--linie);border-radius:8px;padding:6px 10px;margin-top:4px">
      ${os.filter(o => o.id).map(o => `<label style="display:flex;gap:8px;align-items:center;font-size:13.5px;padding:2px 0"><input type="checkbox" data-o="${n++}" data-g="${esc(t)}"> ${esc(o.titel)}</label>`).join("")}</div></div>`).join("");
  const dlg = asDialog({ titel: "Zur Kenntnis nehmen", breit: true, inhalt: `<p><b>${esc(x.titel)}</b></p>
      <div class="form"><label class="voll" style="flex-direction:row;gap:8px;align-items:center"><input type="radio" name="riB" value="nein" checked> Betrifft uns nicht bzw. ist bereits umgesetzt</label>
        <label class="voll" style="flex-direction:row;gap:8px;align-items:center"><input type="radio" name="riB" value="ja"> Betrifft uns – diese Unterlagen prüfen:</label></div>
      <div id="riObj" style="display:none">${html || `<p class="hinweis">Keine passenden Unterlagen gefunden.</p>`}</div>
      <div class="form" style="margin-top:10px">${asFeld("Notiz (optional, z. B. was zu tun ist)", "notiz", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => {
      const ja = d.querySelector('input[name="riB"]:checked').value === "ja";
      const obj = ja ? [...d.querySelectorAll("[data-o]:checked")].map(c => { const o = liste[+c.dataset.o]; return { typ: o.typ, id: String(o.id) }; }) : [];
      if(ja && !obj.length && !confirm("Keine Unterlage gewählt – trotzdem als „betrifft uns“ speichern?")) return false;
      let anz;
      try{ anz = await apiSend("POST", "/rest/v1/rpc/portal_rechtsinfo_quittieren", { p_id: x.id, p_slug: AS.kunde, p_betrifft: ja, p_notiz: asWerte(d).notiz || "", p_objekte: obj }); }
      catch(e){ asMeldung(e.message || String(e)); return false; }
      AS_SV.rqKunde = null; if(typeof AS_SV.pa !== "undefined") AS_SV.pa = null;
      asMeldung(ja ? (anz || 0) + " Prüfaufträge angelegt – sie stehen unter Kalender & To-dos" : "Zur Kenntnis genommen");
      AS_SEITEN.aktuelles.render(document.getElementById("haupt"));
    } }] });
  dlg.querySelectorAll('input[name="riB"]').forEach(r => r.onchange = () => { dlg.querySelector("#riObj").style.display = dlg.querySelector('input[name="riB"]:checked').value === "ja" ? "" : "none"; });
  dlg.querySelectorAll("[data-alle]").forEach(c => c.onchange = () => dlg.querySelectorAll(`[data-g="${CSS.escape(c.dataset.alle)}"]`).forEach(o => o.checked = c.checked));
}
/* Admin-Maske: Rechtsneuerung anlegen/bearbeiten. Einträge aus dem Rechts-Radar (schluessel ohne „maske-“) pflegt
   tools/rechtsinfo_sync.py – dort sind hier nur Themen, Sichtbarkeit und Betrieb änderbar, der Rest kommt aus dem Radar. */
function asSvRechtBearbeiten(x, el){
  const radar = !!(x && x.schluessel && !String(x.schluessel).startsWith("maske-"));
  const w0 = x || { status: "kommt", titel: "", kurz: "", fuer_betrieb: "", quelle: "", datum: "", bereich: "", betrifft: [], sichtbar: true, kunde_slug: null, sortierung: 0 };
  const th = new Set(w0.betrifft || []);
  const dis = radar ? " disabled" : "";
  asDialog({ titel: x ? "Rechtsneuerung bearbeiten" : "Neue Rechtsneuerung", breit: true, inhalt: `
    ${radar ? `<p class="hinweis">Dieser Eintrag kommt aus dem Rechts-Radar (Datei <code>rechts-radar.md</code>). Texte dort ändern – hier nur Themen, Betrieb und Sichtbarkeit.</p>` : ""}
    <div class="form">
      <label class="voll">Titel<input data-f="titel" value="${esc(w0.titel || "")}"${dis}></label>
      ${asAuswahl("Status", "status", w0.status, [["gilt", "gilt seit"], ["kommt", "gilt ab"], ["vorhaben", "geplant (Vorhaben)"]])}
      <label>Datum<input type="date" data-f="datum" value="${esc(w0.datum || "")}"${dis}></label>
      <label class="voll">Kurzbeschreibung<textarea data-f="kurz"${dis}>${esc(w0.kurz || "")}</textarea></label>
      <label class="voll">Was heißt das für den Betrieb?<textarea data-f="fuer_betrieb"${dis}>${esc(w0.fuer_betrieb || "")}</textarea></label>
      <label class="voll">Quelle (Fundstelle, Link)<input data-f="quelle" value="${esc(w0.quelle || "")}"${dis}></label>
      ${asAuswahl("Bereich", "bereich", w0.bereich || "", [["", "Arbeitsschutz"], ["umwelt", "Umwelt"]])}
      ${asAuswahl("Für", "kunde_slug", w0.kunde_slug || "", [["", "alle Betriebe"]].concat(AS.kunden.map(k => [k.kunde_slug, k.name])))}
      ${asFeld("sichtbar", "sichtbar", w0.sichtbar !== false, "checkbox")}
    </div>
    <p style="margin:10px 0 4px"><b>Betrifft (für die Auswahl der Unterlagen beim Betrieb)</b></p>
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px">${AS_RI_THEMEN.map(([k, t]) => `<label style="font-size:13.5px"><input type="checkbox" data-th="${k}" ${th.has(k) ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => {
      const w = asWerte(d), betrifft = [...d.querySelectorAll("[data-th]:checked")].map(c => c.dataset.th);
      const zeile = radar ? { betrifft, sichtbar: !!w.sichtbar, kunde_slug: w.kunde_slug || null }
        : { titel: w.titel, status: w.status, datum: w.datum || null, kurz: w.kurz || "", fuer_betrieb: w.fuer_betrieb || null, quelle: w.quelle || null,
            bereich: w.bereich || null, kunde_slug: w.kunde_slug || null, sichtbar: !!w.sichtbar, betrifft, geaendert_am: new Date().toISOString() };
      if(radar) zeile.status = undefined;
      if(!radar && (!w.titel || !w.kurz)){ asMeldung("Titel und Kurzbeschreibung angeben"); return false; }
      if(radar) delete zeile.status;
      try{
        if(x) await apiSend("PATCH", "/rest/v1/portal_rechtsinfo?id=eq." + encodeURIComponent(x.id), zeile, "return=minimal");
        else await apiSend("POST", "/rest/v1/portal_rechtsinfo", Object.assign(zeile, { schluessel: "maske-" + Date.now().toString(36), erfasst_am: new Date().toISOString() }), "return=minimal");
      }catch(e){ asMeldung(e.message || String(e)); return false; }
      AS_SV.recht = null; asMeldung("Gespeichert"); AS_SEITEN.aktuelles.render(document.getElementById("haupt"));
    } }] });
}
/* Versionshinweise: eine Quelle – die Liste des Kundenportals (../portal/versionen.js) wird bei Bedarf nachgeladen */
function asSvVersionen(){
  if(typeof EHS_VERSIONEN !== "undefined") return Promise.resolve(true);
  if(AS_SV.versionen) return AS_SV.versionen;
  AS_SV.versionen = new Promise(ok => {
    const s = document.createElement("script"); s.src = "../portal/versionen.js";
    s.onload = () => ok(true); s.onerror = () => { AS_SV.versionen = null; ok(false); };
    document.head.appendChild(s);
  });
  return AS_SV.versionen;
}
function asSvVersionenZeigen(box){
  const liste = typeof EHS_VERSIONEN !== "undefined" && Array.isArray(EHS_VERSIONEN) ? EHS_VERSIONEN : null;
  if(!liste){ box.innerHTML = `<div class="karte"><div class="leer">Versionshinweise konnten nicht geladen werden.</div></div>`; return; }
  box.innerHTML = liste.map((v, i) => `<div class="karte"><h2>Version ${esc(v.version)} <span>${i === 0 ? asChip("aktuell", "blau") + " " : ""}<span class="hinweis">${esc(asDat(v.datum))}</span></span></h2>
      ${v.titel ? `<p><b>${esc(v.titel)}</b></p>` : ""}
      ${(v.gruppen || []).map(g => `<div class="frage"><div class="ft">${esc(g[0])}</div><ul style="margin:6px 0 0;padding-left:20px;font-size:14px">${(g[1] || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}</div>`).join("")
    + `<p class="hinweis">Versionshinweise des OAK EHS-Cockpits (Kundenportal) – die Arbeitsschutz-App nutzt dieselben Daten.</p>`;
}

/* ======================= Datenschutz ======================= */
AS_SEITEN.datenschutz = { titel: "Datenschutz", icon: "§", sort: 9.5, async render(main){
  asSvCss();
  main.innerHTML = `<h1 class="seite">Datenschutz</h1><p class="unter">Datenschutzhinweise und Stand der Auftragsverarbeitung.</p><div id="svInhalt"><div class="leer">wird geladen …</div></div>`;
  const k = ((await apiGet("/rest/v1/portal_kunde?select=*&slug=eq." + encodeURIComponent(AS.kunde)).catch(() => [])) || [])[0] || AS.kundeV1 || {};
  AS_SV.kundeV1 = k;
  const box = document.getElementById("svInhalt"); if(!box) return;
  asSvDatenschutz(box, k);
}};
function asSvAvvText(k){
  if(k && k.avv_abgeschlossen_am) return "Auftragsverarbeitungsvertrag abgeschlossen am " + asDat(k.avv_abgeschlossen_am);
  return "Auftragsverarbeitungsvertrag in Vorbereitung";
}
function asSvDatenschutz(box, k){
  const betrieb = k.name || (AS.org && AS.org.name) || "der Betrieb";
  box.innerHTML = `<div class="karte" style="border-left:5px solid var(--${k.avv_abgeschlossen_am ? "gruen" : "gelb"})"><h2><span>${esc(asSvAvvText(k))}</span>
      ${AS.admin ? `<button class="btn adm klein" id="svAvv">AVV-Datum eintragen</button>` : ""}</h2></div>
    <div class="karte sv-ds">
    <h2>Wer ist verantwortlich?</h2>
    <p><b>Verantwortlich</b> für die Verarbeitung ist <b>${esc(betrieb)}</b> als Arbeitgeber. Fragen zu Ihren Daten richten Sie bitte zuerst an den Betrieb${k.datenschutz_kontakt ? ` (Datenschutz: ${esc(k.datenschutz_kontakt)})` : ""}.</p>
    <p><b>Auftragsverarbeiter</b> ist Nikolai Krawielitzki – OAK engineering, Gögginger Straße 137, 86199 Augsburg, info@oak-engineering.de.
      OAK engineering betreibt das EHS-Cockpit und diese Arbeitsschutz-App im Auftrag des Betriebs und verarbeitet die Daten nur nach dessen Weisung (Art. 28 DSGVO).</p>

    <h2>Wofür werden Daten verarbeitet?</h2>
    <p>Für die Organisation von Arbeitsschutz, Umweltschutz und Energie im Betrieb: Gefährdungsbeurteilungen, Betriebsanweisungen, Mängel,
      Unterweisungsnachweise, Meldungen von Vorfällen, Prüfungen von Maschinen,
      Prüf- und Fristentermine, Qualifikationsnachweise und die Vorsorgekartei. Rechtsgrundlage ist die Erfüllung der Arbeitgeberpflichten
      (Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit dem Arbeitsschutzgesetz, u. a. §§ 5, 6 und 12 ArbSchG).</p>
    <p><b>Keine Leistungs- oder Verhaltenskontrolle:</b> Unterweisungen werden ohne Punktestand gespeichert, das Logbuch dient nur der
      Nachvollziehbarkeit von Änderungen.</p>

    <h2>Welche Daten?</h2>
    <ul>
      <li><b>Zugang:</b> Name und E-Mail-Adresse der angemeldeten Nutzer.</li>
      <li><b>Unterweisungen:</b> Name, Tätigkeit, Arbeitgeber (Stamm/Leiharbeit), Datum, Module, bestanden ja/nein und die Unterschrift als Nachweis.</li>
      <li><b>Mängel und Maschinenprüfungen:</b> Beschreibung, Fotos von Anlagen und Befunden, Name und Datum bei Erfassung oder Erledigung.</li>
      <li><b>Vorfälle:</b> Beschreibung, Ort, Zeitpunkt, optional Foto. Der Name ist freiwillig – ohne Namen bleibt die Meldung anonym.</li>
      <li><b>Praktische Einarbeitung:</b> Name, Tätigkeit, Datum und wer die Einarbeitung bestätigt hat.</li>
      <li><b>Qualifikationsnachweise:</b> Name, Art des Nachweises (z. B. Staplerschein, Ersthelfer), Ausstellungs- und Ablaufdatum, Beauftragung, optional eine Kopie des Nachweises.</li>
      <li><b>Arbeitsmedizinische Vorsorge:</b> nur dass, wann und aus welchem Anlass Vorsorge stattgefunden hat und der nächste Termin (Vorsorgekartei nach § 3 Abs. 4 ArbMedVV) – keine Befunde oder Diagnosen. Die Angaben werden nach dem Ende der Beschäftigung gelöscht; die Person erhält vorher eine Kopie.</li>
      <li><b>Kalender und Aufgaben:</b> Termine sowie Name und Zeitpunkt, wenn ein Termin erledigt oder eine Aufgabe quittiert wird.</li>
      <li><b>Fragen zur Arbeitssicherheit:</b> Fragen und Antworten mit Namen – sichtbar für alle Nutzer des Betriebs.</li>
      <li><b>Arbeitsschutzorganisation (Arbeitsschutz-App):</b> Beauftragte und Zuständigkeiten, Organisationsstruktur, Maßnahmen mit Verantwortlichen, Sitzungen des Arbeitsschutzausschusses, Ziele und Meldungen – jeweils mit Namen der Beteiligten.</li>
      <li><b>Logbuch:</b> wer wann was im EHS-Cockpit geändert hat.</li>
    </ul>

    <h2>Wer verarbeitet die Daten technisch?</h2>
    <div class="tabwrap"><table class="tab">
      <thead><tr><th>Dienst</th><th>Aufgabe</th><th>Ort</th></tr></thead>
      <tbody>
        <tr><td>Supabase</td><td>Datenbank und Dateien des EHS-Cockpits</td><td>Rechenzentrum Frankfurt (EU)</td></tr>
        <tr><td>Resend</td><td>Versand von Benachrichtigungen per E-Mail</td><td>EU</td></tr>
        <tr><td>GitHub Pages</td><td>Auslieferung der Programmoberfläche – verarbeitet technische Zugriffsdaten (z. B. IP-Adresse), keine Inhalte des Cockpits</td><td>USA · EU-Standardvertragsklauseln / Data Privacy Framework</td></tr>
        <tr><td>Anthropic</td><td>KI-gestützte Auswertung von Begehungsnotizen und Fotos, wenn OAK engineering die Unterlagen erstellt – kein Training mit Kundendaten</td><td>USA · EU-Standardvertragsklauseln</td></tr>
      </tbody></table></div>

    <h2>Wie lange?</h2>
    <p>Für die Dauer der Betreuung durch OAK engineering. Unterweisungsnachweise und Unterlagen bleiben erhalten, solange sie als Nachweis gebraucht
      werden. Die genauen Löschfristen werden im Auftragsverarbeitungsvertrag festgelegt; nach Ende der Betreuung werden die Daten an den Betrieb
      übergeben oder gelöscht.</p>

    <h2>Sicherheit</h2>
    <p>Verschlüsselte Übertragung (HTTPS), Anmeldung mit persönlichem Zugang, Zugriff nur auf den eigenen Betrieb (auf Datenbankebene getrennt),
      Beschäftigte am Terminal ohne eigenen Login, Logbuch aller Änderungen.</p>

    <h2>Ihre Rechte</h2>
    <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Widerspruch (Art. 15–21 DSGVO). Wenden Sie sich
      dazu an den Betrieb oder an OAK engineering. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren – in Bayern beim
      Bayerischen Landesamt für Datenschutzaufsicht (BayLDA).</p>
    <p class="hinweis">Stand 17.09.2026, ergänzt 12.10.2026 um die Arbeitsschutz-App · wird mit dem Auftragsverarbeitungsvertrag abgestimmt.</p>
    </div>`;
  const b = box.querySelector("#svAvv");
  if(b) b.onclick = () => asDialog({ titel: "AVV-Datum eintragen", inhalt: `<div class="form">
      ${asFeld("Datum des unterschriebenen Auftragsverarbeitungsvertrags", "avv", k.avv_abgeschlossen_am ? String(k.avv_abgeschlossen_am).slice(0, 10) : "", "date", "voll")}</div>
      <p class="hinweis">Leer lassen = „in Vorbereitung“. Das Datum gilt für Kundenportal und Arbeitsschutz-App (portal_kunde).</p>`,
    knoepfe: [{ t: "Speichern", fn: async d => {
      const w = asWerte(d), iso = w.avv || null;
      if(iso && !/^\d{4}-\d{2}-\d{2}$/.test(iso)){ asMeldung("Bitte ein gültiges Datum eintragen."); return false; }
      try{ await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(AS.kunde), { avv_abgeschlossen_am: iso }, "return=minimal"); }
      catch(e){ asMeldung("Konnte nicht gespeichert werden: " + asSvFehler(e)); return false; }
      AS.kundeV1 = Object.assign({}, AS.kundeV1 || {}, { avv_abgeschlossen_am: iso });
      asMeldung("AVV-Datum gespeichert"); asZeige();
    } }, { t: "Abbrechen", klasse: "sek", fn: () => true }] });
}

/* ---------------- E-Mail-Erinnerungen (Plan intern/portal-eigenstaendig.md, Schritt 3) ----------------
   Der Betrieb legt Empfänger und Rhythmus selbst fest (portal_erinnerung_abo). Der Server (pg_cron → Edge Function
   frist-erinnerung) schickt dann die fälligen Fristen und Aufgaben – ohne Personennamen, mit Abmeldelink. */
const AS_SV_RHYTHMUS = [["woechentlich", "wöchentlich (Übersicht)"], ["taeglich", "täglich, nur wenn etwas Neues fällig wird"], ["monatlich", "monatlich am 1."], ["aus", "pausiert"]];
const AS_SV_WTAG = [[1, "Montag"], [2, "Dienstag"], [3, "Mittwoch"], [4, "Donnerstag"], [5, "Freitag"]];
const AS_SV_ABO_SPALTEN = "id,kunde_slug,email,name,rhythmus,wochentag,letzte_mail,angelegt_von,angelegt_am";   // token bleibt auf dem Server
async function asSvErinnerungen(box){
  const pflege = !!(AS.fachkraft || AS.gf || AS.admin);
  let abos = [];
  try{ abos = await apiGet("/rest/v1/portal_erinnerung_abo?select=" + AS_SV_ABO_SPALTEN + "&kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&order=angelegt_am.asc") || []; }
  catch(e){ box.innerHTML = `<div class="leer">Konnte nicht geladen werden: ${esc(asSvFehler(e))}</div>`; return; }
  const rh = Object.fromEntries(AS_SV_RHYTHMUS), wt = Object.fromEntries(AS_SV_WTAG);
  box.innerHTML = `<div class="karte"><h2>E-Mail-Erinnerungen ${pflege ? `<button class="btn klein" id="svAboNeu">+ Empfänger</button>` : ""}</h2>
      <p class="hinweis">Wer soll an Fristen und Aufgaben erinnert werden? Die Mail fasst zusammen, was überfällig oder demnächst fällig ist
        (Termine, Prüfungen, Nachweise, Vorsorge, Unterweisungen, Maßnahmen, Sicherheitsdatenblätter, zu prüfende Unterlagen) –
        <b>ohne Namen aus Vorsorge, Unterweisung und Qualifikationen</b> (Titel von Terminen und Maßnahmen erscheinen so, wie sie eingetragen sind).
        Einzelheiten stehen nur hier im Cockpit. Jede Mail enthält einen Link zum Abbestellen.</p>
      ${abos.length ? `<div class="zeilen">${abos.map((a, i) => `<div class="z" style="cursor:default"><div><b>${esc(a.name || a.email)}</b>
          <small>${esc(a.email)} · ${esc(rh[a.rhythmus] || a.rhythmus)}${a.rhythmus === "woechentlich" ? " · " + esc(wt[a.wochentag] || "") : ""}
          · ${a.letzte_mail ? "zuletzt " + esc(asSvDatZeit(a.letzte_mail)) : "noch keine Mail"}</small></div>
          ${pflege ? `<div class="sv-akt"><button class="btn sek klein" data-probe="${i}">Probe senden</button><button class="btn sek klein" data-abo="${i}">Ändern</button></div>` : ""}</div>`).join("")}</div>`
        : `<div class="leer">Noch keine Empfänger eingetragen.${pflege ? "" : " Einrichten kann das die Fachkraft für Arbeitssicherheit oder die Geschäftsführung."}</div>`}</div>`;
  const neu = box.querySelector("#svAboNeu"); if(neu) neu.onclick = () => asSvAboDialog(null);
  box.querySelectorAll("[data-abo]").forEach(b => b.onclick = () => asSvAboDialog(abos[+b.dataset.abo]));
  box.querySelectorAll("[data-probe]").forEach(b => b.onclick = async () => {
    const a = abos[+b.dataset.probe]; b.disabled = true;
    try{
      const t = await token();
      const r = await fetch(CFG.url + "/functions/v1/frist-erinnerung", { method: "POST",
        headers: { "Content-Type": "application/json", apikey: CFG.anon, Authorization: "Bearer " + t }, body: JSON.stringify({ test: a.id }) });
      const j = await r.json().catch(() => ({}));
      asMeldung(j.ok ? "Probe-Mail an " + a.email + " verschickt" : "Probe fehlgeschlagen: " + (j.error || r.status));
    }catch(e){ asMeldung("Probe fehlgeschlagen: " + asSvFehler(e)); }
    b.disabled = false;
  });
}
function asSvAboDialog(a){
  asDialog({ titel: a ? "Erinnerung ändern" : "Empfänger für Erinnerungen", inhalt: `<div class="form">
      ${asFeld("E-Mail-Adresse", "email", a ? a.email : "", "email", "voll")}
      ${asFeld("Name / Funktion (optional)", "name", a ? a.name : "", "text", "voll")}
      ${asAuswahl("Wie oft?", "rhythmus", a ? a.rhythmus : "woechentlich", AS_SV_RHYTHMUS)}
      ${asAuswahl("Wochentag (bei wöchentlich)", "wochentag", a ? a.wochentag : 1, AS_SV_WTAG)}</div>
      <p class="hinweis">Versand morgens gegen 7 Uhr. „Täglich“ meldet sich nur, wenn seit der letzten Mail etwas Neues fällig wurde.</p>`,
    knoepfe: [
      ...(a ? [{ t: "Entfernen", klasse: "sek", fn: async () => { if(!confirm("Empfänger entfernen?")) return false;
        await apiSend("DELETE", "/rest/v1/portal_erinnerung_abo?id=eq." + encodeURIComponent(a.id), null, "return=minimal"); asZeige(); } }] : []),
      { t: "Speichern", fn: async d => {
        const w = asWerte(d);
        if(!w.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.email)){ asMeldung("Bitte eine gültige E-Mail-Adresse eintragen."); return false; }
        const daten = { email: w.email.toLowerCase(), name: w.name || null, rhythmus: w.rhythmus || "woechentlich", wochentag: +(w.wochentag || 1) };
        try{
          if(a) await apiSend("PATCH", "/rest/v1/portal_erinnerung_abo?id=eq." + encodeURIComponent(a.id), daten, "return=minimal");
          else await apiSend("POST", "/rest/v1/portal_erinnerung_abo", Object.assign({ kunde_slug: AS.kunde, angelegt_von: AS.ich || null }, daten), "return=minimal");
        }catch(e){ asMeldung(/23505|duplicate/.test(asSvFehler(e)) ? "Diese Adresse ist schon eingetragen." : "Konnte nicht gespeichert werden: " + asSvFehler(e)); return false; }
        asZeige();
      } }] });
}

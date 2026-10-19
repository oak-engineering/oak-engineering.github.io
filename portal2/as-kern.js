/* OAK Arbeitsschutz-App – Kern: Anmeldung, Daten, Navigation, Dialoge, Berechnungen.
   Fachlich nach references/prozesse/ (OAK-Vorgehen + Kundenprozesse). Nutzt auth.js des Kundenportals
   (gleiche Sitzung, gleiche Datenbank, nur Tabellen as_*). Globale Namen immer mit as/AS-Praefix. */
"use strict";

const AS = { kunde: null, kunden: [], org: null, admin: false, fachkraft: false, ich: "", uid: null,
  db: {}, seite: "cockpit", reiter: {} };
const AS_TABELLEN = ["as_einheit", "as_beauftragter", "as_einsatz", "as_orgcheck", "as_arbeitssystem", "as_taetigkeit",
  "as_gefaehrdung", "as_massnahme", "as_mitzeichnung", "as_asa", "as_ziel", "as_psyche", "as_meldung", "as_thema",
  "as_kultur", "as_prozess", "as_pruefobjekt", "as_pruefung", "as_notfall", "as_fremdfirma", "as_erlaubnisschein"];
const AS_SEITEN = {};            // von den Modulen befuellt: { titel, icon, sort, render(main) }
const AS_KUNDENPROZESSE = AS_PROZESSE.prozesse;

/* ---------------- Hilfen ---------------- */
function asHeute(){ return new Date().toISOString().slice(0, 10); }
function asDat(d){ return d ? String(d).slice(0, 10).split("-").reverse().join(".") : "–"; }
function asTageSeit(d){ return d ? Math.floor((Date.now() - new Date(String(d).slice(0, 10)).getTime()) / 864e5) : Infinity; }
function asRisiko(w, s){ return (+w || 0) * (+s || 0); }
function asBand(r){ return r >= 9 ? "rot" : r >= 4 ? "gelb" : r > 0 ? "gruen" : "grau"; }
function asBandText(b){ return { rot: "hoch", gelb: "mittel", gruen: "gering", grau: "nicht bewertet" }[b]; }
function asChip(text, farbe){ return `<span class="chip c-${farbe}">${esc(text)}</span>`; }
function asPunkt(farbe){ return `<span class="punkt p-${farbe}"></span>`; }
function asProz(a, b){ return b ? Math.round(a / b * 100) : 0; }
function asT(t){ return AS.db[t] || []; }
function asNach(t, id){ return asT(t).find(r => r.id === id); }
function asMeldung(text){ const m = document.getElementById("meldung"); m.textContent = text; m.hidden = false;
  clearTimeout(asMeldung.t); asMeldung.t = setTimeout(() => m.hidden = true, 3200); }
function asOrgDaten(){
  const d = Object.assign({}, (AS.org && AS.org.daten) || {});
  // AVV-Datum führt das Kundenportal (portal_kunde.avv_abgeschlossen_am) – eine Quelle für beide Apps
  if(AS.kundeV1 && AS.kundeV1.avv_abgeschlossen_am) d.avv_am = String(AS.kundeV1.avv_abgeschlossen_am).slice(0, 10);
  return d;
}

/* ---------------- Daten ---------------- */
async function asKundenLaden(){
  AS.kunden = await apiGet("/rest/v1/as_organisation?select=kunde_slug,name&order=name.asc").catch(() => []);
}
/* ---------------- Eine Datenquelle mit dem Kundenportal (V1) ----------------
   Maengel, Vorfaelle, Beauftragte und Einheiten liegen in den V1-Tabellen. V2 liest und schreibt sie dort,
   in der Form der V2-Tabelle (zuV2/zuV1). "ganz" = die V2-Tabelle besteht nur aus V1-Daten;
   sonst werden V1-Zeilen mit eigenen V2-Zeilen zusammengefuehrt (z. B. Massnahmen aus dem Org-Check). */
const AS_FUNK_V1 = { sicherheitsbeauftragter: "sibe", elektro: "efk", sonstiges: "sonstige", anschlaeger: "kran", hubarbeitsbuehne: "sonstige" };
const AS_FUNK_V2 = { sibe: "sicherheitsbeauftragter", efk: "elektro", sonstige: "sonstiges" };
function asAuswahlFelder(w, felder){ const o = {}; felder.forEach(f => { if(f in w) o[f] = w[f] === "" ? null : w[f]; }); return o; }
function asMgStatus(mg){ return mg.wirksam_am ? "wirksam" : mg.status === "erledigt" ? "erledigt" : "offen"; }
const AS_QUELLEN = {
  as_einheit: { v1: "uw_einheit", filter: "&status=eq.aktiv", ganz: true,
    zuV2: r => Object.assign({}, r, { _v1: true }),
    zuV1: w => asAuswahlFelder(w, ["name", "art", "kst_nr", "parent_id", "leitung", "beschaeftigte", "schichten", "verwaltung", "sort"]),
    neu: w => Object.assign({ status: "aktiv" }, asAuswahlFelder(w, ["name", "art", "kst_nr", "parent_id", "leitung", "beschaeftigte", "schichten", "verwaltung", "sort"])) },
  as_beauftragter: { v1: "portal_nachweis", filter: "&or=(archiviert.is.null,archiviert.is.false)", ganz: true,
    zuV2: r => ({ id: r.id, kunde_slug: r.kunde_slug, funktion: AS_FUNK_V1[r.art] || r.art, person: r.person_name, einheit_id: r.as_einheit_id,
      schicht: r.schicht, bestellt_am: r.bestellt_am, schulung_am: r.ausgestellt_am, gueltig_bis: r.gueltig_bis, vertretung: r.vertretung,
      notiz: r.notiz, _v1: true, _art: r.art }),
    zuV1: (w, alt) => { const o = {};
      if("funktion" in w) o.art = alt && (AS_FUNK_V1[alt._art] || alt._art) === w.funktion ? alt._art : (AS_FUNK_V2[w.funktion] || w.funktion);
      if("person" in w){ o.person_name = w.person;
        const p = (AS.personen || []).find(x => String(x.name || "").trim().toLowerCase() === String(w.person || "").trim().toLowerCase()); o.person_id = p ? p.id : null; }
      if("einheit_id" in w) o.as_einheit_id = w.einheit_id || null;
      if("schulung_am" in w) o.ausgestellt_am = w.schulung_am || null;
      Object.assign(o, asAuswahlFelder(w, ["schicht", "bestellt_am", "gueltig_bis", "vertretung", "notiz"]));
      if("bestellt_am" in w) o.beauftragt = !!w.bestellt_am; o.geaendert_von = AS.ich; return o; },
    neu: w => Object.assign({ archiviert: false, erfasst_von: AS.ich }, AS_QUELLEN.as_beauftragter.zuV1(w, null)) },
  as_massnahme: { v1: "portal_maengel", filter: "&or=(ausgeblendet.is.null,ausgeblendet.is.false)", ganz: false,
    // nur Massnahmen zu einer Gefaehrdung (BdA) sind Maengel; Org-Check, Kultur, ASA … bleiben V2-eigen
    neuV1: w => !!w.gefaehrdung_id,
    zuV2: mg => ({ id: mg.id, kunde_slug: mg.kunde_slug, gefaehrdung_id: mg.as_gefaehrdung_id, quelle: "bda", quelle_id: null,
      stop: mg.stop || "T", text: mg.massnahme || mg.label, befund: mg.massnahme ? mg.label : "", umsetzung: "anlage",
      anlage: ((mg.maschinen_id || "") + " " + (mg.maschine || "")).trim(), gruppe: null, verantwortlich: mg.verantwortlich,
      termin: mg.termin, status: asMgStatus(mg), erledigt_am: (mg.erledigt_am || "").slice(0, 10) || null, erledigt_von: mg.erledigt_von,
      erledigt_notiz: mg.notiz, wirksam_am: mg.wirksam_am, wirksam_von: mg.wirksam_von, angelegt_am: mg.updated_at,
      foto_pfad: mg.foto_pfad, nachweis_pfad: mg.nachweis_pfad, maschinen_id: mg.maschinen_id, unterwiesen_am: mg.unterwiesen_am, folge_art: mg.folge_art,
      einheit_id: mg.einheit_id, _v1: true, _mg: mg }),
    zuV1: (w, alt) => { const o = asAuswahlFelder(w, ["stop", "verantwortlich", "termin", "erledigt_von", "folge_art"]);
      if("text" in w && w.text !== alt.text) o.massnahme = w.text;
      if("gefaehrdung_id" in w) o.as_gefaehrdung_id = w.gefaehrdung_id || null;
      if("erledigt_notiz" in w) o.notiz = w.erledigt_notiz;
      if("erledigt_am" in w) o.erledigt_am = w.erledigt_am || null;
      if(w.status === "wirksam"){ o.status = "erledigt"; o.wirksam_am = asHeute(); o.wirksam_von = AS.ich; }
      else if(w.status === "erledigt"){ o.status = "erledigt"; if(alt.status === "wirksam"){ o.wirksam_am = null; o.wirksam_von = null; }
        if(!o.erledigt_am && !alt.erledigt_am) o.erledigt_am = new Date().toISOString(); }
      else if(w.status === "offen"){ o.status = "offen"; o.erledigt_am = null; }
      return o; },
    neu: w => { const g = asNach("as_gefaehrdung", w.gefaehrdung_id), s = g && asNach("as_arbeitssystem", g.arbeitssystem_id);
      const anl = String(w.anlage || "").split(" ")[0] || (s && asListe(s.anlagen)[0]) || "";
      const band = asBand(g ? asRisiko(g.w_v, g.s_v) : 0);
      const dok = (typeof AS_B !== "undefined" && AS_B.docs || []).find(d => d.maschinen_id === anl && (d.kategorie === "anlagen" || d.kategorie === "allg-gbu"));
      return { maschinen_id: anl, maschine: dok ? (dok.maschine || dok.titel) : (s ? s.name.replace(/\s*\([^)]*\)\s*$/, "") : anl),
        schluessel: "V2-" + Math.random().toString(36).slice(2, 10), label: w.text, massnahme: w.text, thema: "sonstiges",
        schwere: { rot: "s", gelb: "g", gruen: "a" }[band] || "g", band: { rot: "gefahr", gelb: "besorgnis", gruen: "akzeptanz" }[band] || "besorgnis",
        status: "offen", as_gefaehrdung_id: w.gefaehrdung_id, stop: w.stop || "T", verantwortlich: w.verantwortlich || null, folge_art: w.folge_art || null,
        termin: w.termin || null, gemeldet_von: AS.ich, gemeldet_am: asHeute(), kunde: AS.org ? AS.org.name : null }; } },
  as_meldung: { v1: "portal_vorfaelle", filter: "&domaene=neq.umwelt", ganz: false,
    // Verbesserungsvorschlaege kennt V1 nicht – sie bleiben V2-eigen
    neuV1: w => w.art !== "vorschlag",
    zuV2: v => ({ id: v.id, kunde_slug: v.kunde_slug, art: { unfall: "unfall", beinahe: "beinahe" }[v.art] || "zustand",
      datum: v.ereignis_am || String(v.angelegt_am || "").slice(0, 10), beschreibung: v.beschreibung || "", ort: v.ort,
      einheit_id: v.as_einheit_id, status: { bearbeitung: "in_arbeit", erledigt: "erledigt" }[v.status] || "neu",
      rueckmeldung: v.rueckmeldung, rueckmeldung_am: v.rueckmeldung_am, verletzte: v.verletzte, _v1: true }),
    zuV1: w => { const o = {};
      if("art" in w) o.art = { unfall: "unfall", beinahe: "beinahe" }[w.art] || "unsicher";
      if("datum" in w) o.ereignis_am = w.datum || null; if("beschreibung" in w) o.beschreibung = w.beschreibung;
      if("einheit_id" in w) o.as_einheit_id = w.einheit_id || null;
      if("status" in w) o.status = { in_arbeit: "bearbeitung", erledigt: "erledigt" }[w.status] || "offen";
      if("rueckmeldung" in w){ o.rueckmeldung = w.rueckmeldung || null; o.rueckmeldung_am = w.rueckmeldung ? (w.rueckmeldung_am || asHeute()) : null; }
      return o; },
    neu: w => Object.assign({ domaene: "arbeitssicherheit", quelle: "portal2", kunde: AS.org ? AS.org.name : null }, AS_QUELLEN.as_meldung.zuV1(w)) },
};

async function asLaden(){
  if(!AS.kunde){ AS.db = {}; AS.org = null; return; }
  if(typeof asBereichVorbereiten === "function") await asBereichVorbereiten();   // Bereichsfilter (as-bereich.js)
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const eigen = AS_TABELLEN.filter(t => !(AS_QUELLEN[t] && AS_QUELLEN[t].ganz)), quellen = Object.entries(AS_QUELLEN);
  const [org, ...rest] = await Promise.all([
    apiGet("/rest/v1/as_organisation?select=*" + k),
    ...eigen.map(t => apiGet("/rest/v1/" + t + "?select=*" + k).catch(() => [])),
    ...quellen.map(([, q]) => apiGet("/rest/v1/" + q.v1 + "?select=*" + k + q.filter).catch(() => []))]);
  AS.org = (org && org[0]) || null;
  AS.personen = ((await apiGet("/rest/v1/uw_person?select=id,name,status&status=eq.aktiv" + k).catch(() => [])) || []);   // Belegschaft (Stufe 4)
  AS.kundeV1 = ((await apiGet("/rest/v1/portal_kunde?select=slug,name,avv_abgeschlossen_am,marke&slug=eq." + encodeURIComponent(AS.kunde)).catch(() => [])) || [])[0] || null;
  AS.db = {};
  eigen.forEach((t, i) => AS.db[t] = rest[i] || []);
  quellen.forEach(([t, q], i) => { const v1 = (rest[eigen.length + i] || []).map(q.zuV2); AS.db[t] = q.ganz ? v1 : (AS.db[t] || []).concat(v1); });
  ["as_einheit", "as_taetigkeit", "as_gefaehrdung", "as_arbeitssystem"].forEach(t => AS.db[t].sort((a, b) => (a.sort || 0) - (b.sort || 0)));
  if(typeof asBereichNachLaden === "function") asBereichNachLaden();
  if(typeof asMarkeAnwenden === "function") asMarkeAnwenden();
  if(typeof asNameSetzen === "function") asNameSetzen();
}
async function asV1Speichern(t, q, row, alt){
  let erg;
  if(alt) erg = await apiSend("PATCH", "/rest/v1/" + q.v1 + "?id=eq." + encodeURIComponent(alt.id), q.zuV1(row, alt), "return=representation");
  else erg = await apiSend("POST", "/rest/v1/" + q.v1, Object.assign({ kunde_slug: AS.kunde }, q.neu(row)), "return=representation");
  const neu = erg && erg[0] && q.zuV2(erg[0]); if(!neu) return null;
  const liste = AS.db[t] = AS.db[t] || [];
  const i = liste.findIndex(r => r.id === neu.id); if(i >= 0) liste[i] = neu; else liste.push(neu);
  return neu;
}
async function asSpeichern(t, row){
  const q = AS_QUELLEN[t];
  if(q){ const alt = row.id ? asNach(t, row.id) : null;
    // Neue Vorfaelle darf in V1 nur OAK anlegen (der Betrieb meldet ueber den QR-Melder) – sonst bleibt die Meldung V2-eigen
    const v1Neu = !row.id && (q.ganz || q.neuV1(row)) && !(t === "as_meldung" && !AS.admin);
    if((alt && alt._v1) || v1Neu) return asV1Speichern(t, q, row, alt); }
  const daten = Object.assign({}, row); delete daten.id;
  let erg;
  if(row.id){
    erg = await apiSend("PATCH", "/rest/v1/" + t + "?id=eq." + encodeURIComponent(row.id), daten, "return=representation");
  } else {
    daten.kunde_slug = AS.kunde;
    erg = await apiSend("POST", "/rest/v1/" + t, daten, "return=representation");
  }
  const neu = erg && erg[0]; if(!neu) return null;
  const liste = AS.db[t] = AS.db[t] || [];
  const i = liste.findIndex(r => r.id === neu.id); if(i >= 0) liste[i] = neu; else liste.push(neu);
  return neu;
}
async function asLoeschen(t, id){
  const alt = asNach(t, id), q = AS_QUELLEN[t];
  await apiSend("DELETE", "/rest/v1/" + (alt && alt._v1 && q ? q.v1 : t) + "?id=eq." + encodeURIComponent(id), null, "return=minimal");
  AS.db[t] = asT(t).filter(r => r.id !== id);
}
async function asOrgSpeichern(teil){
  if("avv_am" in teil && AS.admin){
    await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(AS.kunde), { avv_abgeschlossen_am: teil.avv_am || null }, "return=minimal");
    AS.kundeV1 = Object.assign({}, AS.kundeV1 || {}, { avv_abgeschlossen_am: teil.avv_am || null });
  }
  const daten = Object.assign({}, asOrgDaten(), teil);
  const erg = await apiSend("PATCH", "/rest/v1/as_organisation?kunde_slug=eq." + encodeURIComponent(AS.kunde),
    { daten, geaendert_am: new Date().toISOString() }, "return=representation");
  if(erg && erg[0]) AS.org = erg[0];
}
async function asProzessSetzen(pid, freigabe){
  const row = { kunde_slug: AS.kunde, prozess_id: pid, freigegeben_am: freigabe ? asHeute() : null, freigegeben_von: freigabe ? AS.ich : null };
  const erg = await apiSend("POST", "/rest/v1/as_prozess?on_conflict=kunde_slug,prozess_id", row, "resolution=merge-duplicates,return=representation");
  AS.db.as_prozess = asT("as_prozess").filter(r => r.prozess_id !== pid).concat(erg || []);
}

/* ---------------- Dialog ---------------- */
function asDialog({ titel, inhalt, breit, knoepfe }){
  const d = document.getElementById("dlg");
  d.className = "dlg" + (breit ? " breit" : "");
  d.innerHTML = `<div class="dlg-kopf"><h3>${esc(titel)}</h3><button class="zu" data-zu>✕</button></div>
    <div class="dlg-inhalt">${inhalt}</div>
    ${knoepfe && knoepfe.length ? `<div class="dlg-fuss">${knoepfe.map((k, i) => `<button class="btn ${k.klasse || ""}" data-k="${i}">${esc(k.t)}</button>`).join("")}</div>` : ""}`;
  d.querySelector("[data-zu]").onclick = () => d.close();
  (knoepfe || []).forEach((k, i) => d.querySelector(`[data-k="${i}"]`).onclick = async () => {
    try{ const r = await k.fn(d); if(r !== false) d.close(); }
    catch(e){ asMeldung("Fehler: " + (e.message || e)); }
  });
  if(!d.open) d.showModal();
  return d;
}
function asWerte(el){
  const w = {};
  el.querySelectorAll("[data-f]").forEach(f => {
    const k = f.dataset.f;
    if(f.type === "checkbox") w[k] = f.checked;
    else if(f.type === "number") w[k] = f.value === "" ? null : +f.value;
    else w[k] = f.value.trim() === "" ? null : f.value.trim();
  });
  return w;
}
function asFeld(label, f, wert, typ, extra){
  typ = typ || "text";
  if(typ === "textarea") return `<label class="${extra || ""}">${label}<textarea data-f="${f}">${esc(wert || "")}</textarea></label>`;
  if(typ === "checkbox") return `<label class="${extra || ""}" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" data-f="${f}" ${wert ? "checked" : ""}> ${label}</label>`;
  return `<label class="${extra || ""}">${label}<input type="${typ}" data-f="${f}" value="${esc(wert == null ? "" : wert)}"></label>`;
}
/* Filterleiste (OAK-UI-Regeln 3): Pill-Auswahl mit Bezeichnung im Text, z. B. „Status: offen“ */
function asFilterWahl(attr, wert, optionen, bez){
  return `<select ${attr} aria-label="${esc(bez)}">${optionen.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(wert) === String(v) ? "selected" : ""}>${esc(bez + ": " + t)}</option>`; }).join("")}</select>`;
}
function asAuswahl(label, f, wert, optionen, extra){
  return `<label class="${extra || ""}">${label}<select data-f="${f}">${optionen.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(wert) === String(v) ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`;
}

/* ---------------- Organisation / Einheiten ---------------- */
function asEinheitName(id){ const e = asNach("as_einheit", id); return e ? e.name : "–"; }
function asKinder(pid){ return asT("as_einheit").filter(e => (e.parent_id || null) === (pid || null)); }
/* Beschäftigtenzahl – EINE Quelle: die Bereiche der Organisation (Summe der Einheiten). Die Angabe Vollzeit/Teilzeit
   in den Grunddaten liefert nur die Gewichtung nach DGUV V2; weicht ihre Summe ab, meldet das Cockpit eine Aufgabe.
   Ohne Bereiche mit Zahlen gilt die Angabe der Grunddaten. */
function asBeschaeftigte(){
  const d = asOrgDaten();
  const vz = +d.ma_vz || 0, t20 = +d.ma_tz20 || 0, t30 = +d.ma_tz30 || 0, angabe = vz + t20 + t30;
  const bereiche = asT("as_einheit").reduce((n, e) => n + (+e.beschaeftigte || 0), 0);
  const kopf = bereiche || angabe, faktor = angabe ? (vz + 0.5 * t20 + 0.75 * t30) / angabe : 1;
  return { gewichtet: Math.round(kopf * faktor * 10) / 10, kopf, bereiche, angabe,
    abweichung: !!(bereiche && angabe && bereiche !== angabe), personen: (AS.personen || []).length };
}

/* Beauftragte: Soll je Einheit und Schicht aus den Regeln (DGUV V1 § 26, ASR A2.2), SiBe betriebsweit als Richtwert */
function asBeauftragteSoll(){
  const heute = asHeute();
  const gueltig = b => !b.gueltig_bis || b.gueltig_bis >= heute;
  const zeilen = [];
  asT("as_einheit").filter(e => (+e.beschaeftigte || 0) > 0).forEach(e => {
    const schichten = Math.max(1, +e.schichten || 1);
    const n = Math.ceil(e.beschaeftigte / schichten);
    for(let s = 1; s <= schichten; s++){
      const ist = f => asT("as_beauftragter").filter(b => b.funktion === f && b.einheit_id === e.id && gueltig(b)
        && (!b.schicht || +b.schicht === s || schichten === 1)).length;
      const eh = n < 2 ? 0 : n <= 20 ? 1 : Math.ceil(n * (e.verwaltung ? 0.05 : 0.10));
      const bsh = Math.max(1, Math.ceil(n * 0.05));
      zeilen.push({ funktion: "ersthelfer", einheit: e.name, einheit_id: e.id, schicht: schichten > 1 ? s : null, soll: eh, ist: ist("ersthelfer"), n });
      zeilen.push({ funktion: "brandschutzhelfer", einheit: e.name, einheit_id: e.id, schicht: schichten > 1 ? s : null, soll: bsh, ist: ist("brandschutzhelfer"), n });
    }
  });
  const ges = asBeschaeftigte().kopf;
  /* Sicherheitsbeauftragte – § 22 Abs. 1 SGB VII n. F. (seit 29.05.2026): Pflicht ab 50 Beschäftigten; 21–49 nur bei besonderer
     Gefährdung (Feld sibe_besondere_gefaehrdung) oder auf Anordnung des UV-Trägers; unter 250 ohne besondere Gefährdung genügt einer.
     Anzahl legt der Unternehmer fest (DGUV Regel 100-001 Nr. 4.2.1) – OAK-Empfehlung 1 je angefangene 50 Beschäftigte (Nikolai 14.10.2026).
     soll = Empfehlung, pflicht = gesetzliches Minimum (für Stufe 1 / Badge). */
  const bes = !!asOrgDaten().sibe_besondere_gefaehrdung;
  if(ges >= 50 || (ges > 20 && bes)){
    const pflicht = ges >= 250 || bes ? Math.max(1, Math.ceil(ges / 50)) : 1;
    zeilen.push({ funktion: "sibe", einheit: "Betrieb gesamt", schicht: null, soll: Math.max(1, Math.ceil(ges / 50)), pflicht, richtwert: true,
      ist: asT("as_beauftragter").filter(b => b.funktion === "sibe" && gueltig(b)).length, n: ges });
  }
  return zeilen;
}
function asAbgelaufen(){
  const heute = asHeute();
  return asT("as_beauftragter").filter(b => b.gueltig_bis && b.gueltig_bis < heute);
}

/* Einsatzzeiten nach DGUV V2 Anlage 2 (> 10 Beschaeftigte) */
function asEinsatz(jahr){
  jahr = jahr || new Date().getFullYear();
  const d = asOrgDaten(), ma = asBeschaeftigte().gewichtet;
  const gr = AS_KAT.betreuungsgruppen[d.betreuungsgruppe] || null;
  const grund = gr ? ma * gr.stunden : 0;
  const anteil = Math.min(80, Math.max(20, +d.anteil_sifa || 50));
  const sifaGrund = gr ? Math.max(grund * anteil / 100, 0.2 * ma) : 0;
  const baGrund = gr ? Math.max(grund - sifaGrund, 0.2 * ma) : 0;
  const spez = d.spezifisch || {};
  const spezSifa = Object.values(spez).reduce((n, x) => n + (+x.sifa || 0), 0);
  const spezBa = Object.values(spez).reduce((n, x) => n + (+x.ba || 0), 0);
  const imJahr = asT("as_einsatz").filter(x => String(x.datum).startsWith(String(jahr)));
  const ist = r => imJahr.filter(x => x.rolle === r).reduce((n, x) => n + (+x.stunden || 0), 0);
  return { jahr, ma, gruppe: d.betreuungsgruppe, grund, anteil, sifaGrund, baGrund, spezSifa, spezBa,
    sollSifa: sifaGrund + spezSifa, sollBa: baGrund + spezBa, istSifa: ist("sifa"), istBa: ist("ba") };
}

/* ---------------- BdA ---------------- */
function asMassnahmenZu(gid){ return asT("as_massnahme").filter(m => m.gefaehrdung_id === gid); }
/* Risiko heute: Restrisiko erst, wenn alle Massnahmen der Gefaehrdung wirksam sind */
function asGefRisiko(g){
  const m = asMassnahmenZu(g.id);
  const fertig = m.length && m.every(x => x.status === "wirksam");
  return fertig ? asRisiko(g.w_n, g.s_n) : asRisiko(g.w_v, g.s_v);
}
function asSystemRisiko(sid){
  return asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === sid && g.art !== "ressource").reduce((m, g) => Math.max(m, asGefRisiko(g)), 0);
}

/* ---------------- Organisations-Check ---------------- */
function asCheckFragen(art){ return AS_CHECK.kernelemente.map(k => ({ ...k, fragen: k.fragen.filter(q => art === "voll" || q.kurz) })); }
function asCheckGrad(a){ if(!a) return "offen"; if(a.nr) return "nrel"; if(a.r == null || a.p == null) return "offen";
  if(a.r === 2 && a.p === 2) return "umfassend"; if(a.r === 0 && a.p === 0) return "keine"; return "teilweise"; }
function asCheckReifegrad(check){
  const out = {};
  asCheckFragen(check.art).forEach(k => {
    const g = k.fragen.map(q => asCheckGrad((check.antworten || {})[q.id])).filter(x => x !== "nrel");
    const ov = (check.reifegrad || {})[k.id];
    if(ov){ out[k.id] = ov; return; }
    if(!g.length){ out[k.id] = null; return; }
    const um = g.filter(x => x === "umfassend").length, mind = g.filter(x => x === "umfassend" || x === "teilweise").length;
    out[k.id] = um / g.length >= 0.9 ? 3 : mind / g.length >= 2 / 3 ? 2 : 1;
  });
  return out;
}
/* Interne Kennungen (P12, K3.6, 1b-1) nie anzeigen – Klartext statt Kürzel (Nikolai 19.10.2026) */
const AS_KE_KURZ = { K1: "Aufbauorganisation", K2: "Prozesse und Abläufe", K3: "Führung", K4: "Beteiligung", K5: "Beurteilung der Arbeitsbedingungen", K6: "Unterstützung", K7: "Verbesserung (KVP)" };
function asKlartext(t){
  return String(t == null ? "" : t)
    .replace(/Prozess(?:beschreibung)?\s+(P\d{2})/g, (m, id) => { const p = (typeof AS_KUNDENPROZESSE !== "undefined" ? AS_KUNDENPROZESSE : []).find(x => x.id === id); return p ? "Prozess „" + p.titel + "“" : "Prozessbeschreibung"; })
    .replace(/\((P\d{2}(?:,\s*P\d{2})*)\)/g, (m, ids) => "(" + ids.split(/,\s*/).map(id => ((typeof AS_KUNDENPROZESSE !== "undefined" ? AS_KUNDENPROZESSE : []).find(x => x.id === id) || {}).titel || "Prozess").join(", ") + ")")
    .replace(/(Reifegrad(?:instrument)?|Organisations-Check)\s+K(\d)(?:\.(\d+))?/g, (m, w, k, f) => w + " – " + (AS_KE_KURZ["K" + k] || "Kernelement " + k) + (f ? ", Frage " + f : ""))
    .replace(/K([1-7])(?:\.(\d+))?/g, (m, k, f) => AS_KE_KURZ["K" + k] + (f ? " (Frage " + f + ")" : ""));
}
function asLetzterCheck(art){
  return asT("as_orgcheck").filter(c => c.abgeschlossen && (!art || c.art === art)).sort((a, b) => b.datum.localeCompare(a.datum))[0] || null;
}

/* ---------------- Kennzahlen (eine Quelle fuer Cockpit, Ziele, Bericht) ---------------- */
function asKennzahlen(){
  const heute = asHeute(), m = asT("as_massnahme");
  const rotGef = new Set(asT("as_gefaehrdung").filter(g => asBand(asRisiko(g.w_v, g.s_v)) === "rot").map(g => g.id));
  const soll = asBeauftragteSoll();
  const sys = asT("as_arbeitssystem").filter(s => !s.stillgelegt_am);   // ruhende Beurteilungen (Anlage stillgelegt) zählen nicht
  const mz = asT("as_mitzeichnung");
  const meld = asT("as_meldung");
  const e = asEinsatz();
  const chk = asLetzterCheck();
  const rg = chk ? Object.values(asCheckReifegrad(chk)).filter(Boolean) : [];
  const kp = AS_KUNDENPROZESSE.length;
  return {
    massnahmen_wirksam: asProz(m.filter(x => x.status === "wirksam").length, m.length),
    massnahmen_rot_offen: m.filter(x => rotGef.has(x.gefaehrdung_id) && x.status !== "wirksam").length,
    massnahmen_ueberfaellig: m.filter(x => x.status === "offen" && x.termin && x.termin < heute).length,
    beauftragte_erfuellt: soll.length ? asProz(soll.filter(z => z.ist >= z.soll).length, soll.length) : 0,
    beauftragte_abgelaufen: asAbgelaufen().length,
    bda_freigegeben: asProz(sys.filter(s => s.freigabe_am).length, sys.length),
    psyche_beurteilt: asProz(sys.filter(s => asT("as_psyche").some(p => p.arbeitssystem_id === s.id)).length, sys.length),
    asa_jahr: asT("as_asa").filter(a => a.abgeschlossen && String(a.datum).startsWith(String(new Date().getFullYear()))).length,
    mitzeichnung_quote: asProz(mz.filter(x => x.status === "entschieden").length, mz.length),
    einsatz_sifa: e.sollSifa ? asProz(e.istSifa, e.sollSifa) : 0,
    einsatz_ba: e.sollBa ? asProz(e.istBa, e.sollBa) : 0,
    meldungen_beinahe: meld.filter(x => x.art === "beinahe" && asTageSeit(x.datum) <= 365).length,
    rueckmeldung_quote: asProz(meld.filter(x => x.rueckmeldung).length, meld.length),
    reifegrad_mittel: rg.length ? Math.round(rg.reduce((a, b) => a + b, 0) / rg.length * 10) / 10 : 0,
    prozesse_freigegeben: asProz(asT("as_prozess").filter(p => p.freigegeben_am).length, kp),
    organisation_nachweise: asProz(AS_NACHWEISE.filter(n => asOrgDaten()[n[0]]).length, AS_NACHWEISE.length),
    pruefungen_ueberfaellig: typeof asPfKennzahlen === "function" ? asPfKennzahlen().ueberfaellig : 0,
    pruefungen_aktuell: typeof asPfKennzahlen === "function" ? asPfKennzahlen().aktuell : 0,
    kultur_rot: (() => { const k = asKurzCheckLetzter(); return k ? Object.values(k.antworten.felder || {}).filter(v => v === "rot").length : 0; })(),
  };
}

/* ---------------- Aufbaupfad (OAK-Vorgehen Schritte 5–7, Ziele je Stufe) ---------------- */
function asPfad(){
  const d = asOrgDaten(), sys = asT("as_arbeitssystem").filter(s => !s.stillgelegt_am), soll = asBeauftragteSoll();
  const rotOhne = asT("as_massnahme").filter(m => { const g = asNach("as_gefaehrdung", m.gefaehrdung_id);
    return g && asBand(asRisiko(g.w_v, g.s_v)) === "rot" && m.status === "offen" && (!m.verantwortlich || !m.termin); }).length;
  const helfer = soll.filter(z => z.funktion !== "sibe");
  const kp = AS_KUNDENPROZESSE.filter(p => p.stufe <= 2);
  const frei = new Set(asT("as_prozess").filter(p => p.freigegeben_am).map(p => p.prozess_id));
  const k = (t, ok, ziel, info) => ({ t, ok: !!ok, ziel, info: info || "" });
  return [
    { nr: 1, titel: "Fundament", text: "haftungs- und lebensrelevant", krit: [
      k("Erstaufnahme der Organisation durchgeführt", asLetzterCheck(), "check"),
      k("Willenserklärung der Geschäftsführung", d.willenserklaerung_am, "organisation", d.willenserklaerung_am ? asDat(d.willenserklaerung_am) : ""),
      k("Pflichten schriftlich übertragen", d.pflichten_am, "organisation", d.pflichten_am ? asDat(d.pflichten_am) : ""),
      k("Sifa bestellt", d.sifa_bestellt_am, "organisation", d.sifa_name || ""),
      k("Betriebsarzt bestellt", d.ba_bestellt_am, "organisation", d.ba_name || ""),
      k("Einsatzzeiten nach DGUV V2 vereinbart", d.einsatz_vereinbart_am, "organisation/einsatz"),
      k("Auftragsverarbeitung (AVV) abgeschlossen", d.avv_am, "organisation"),
      k("Ersthelfer und Brandschutzhelfer je Schicht ausreichend", helfer.length && helfer.every(z => z.ist >= z.soll), "organisation/beauftragte",
        helfer.length ? helfer.filter(z => z.ist >= z.soll).length + " von " + helfer.length + " erfüllt" : "Struktur mit Beschäftigten fehlt"),
      k("Prüfkataster für gefährliche Arbeitsmittel", d.pruefkataster_am, "organisation"),
      k("BdA der gefährlichsten Arbeitssysteme freigegeben", sys.some(s => s.freigabe_am), "bda"),
      k("Maßnahmen zu hohen Risiken mit Verantwortlichem und Termin", rotOhne === 0, "massnahmen", rotOhne ? rotOhne + " ohne Verantwortlichen/Termin" : ""),
      k("Grundunterweisung nachgewiesen", d.grundunterweisung_am, "organisation"),
    ]},
    { nr: 2, titel: "System", text: "alle Pflichten vollständig", krit: [
      k("BdA für alle Arbeitssysteme freigegeben", sys.length && sys.every(s => s.freigabe_am), "bda", sys.filter(s => s.freigabe_am).length + " von " + sys.length),
      k("Psychische Belastung für alle Arbeitssysteme beurteilt", sys.length && sys.every(s => asT("as_psyche").some(p => p.arbeitssystem_id === s.id)), "bda"),
      k("Betriebsanweisungen für alle Arbeitssysteme", sys.length && sys.every(s => s.ba_vorhanden), "bda"),
      k("Gefahrstoffverzeichnis mit aktuellen SDB", asTageSeit(d.gefahrstoffe_am) <= 365, "organisation"),
      k("Arbeitsmedizinische Vorsorge organisiert", d.vorsorge_am, "organisation"),
      k("ASA im letzten Quartal", asT("as_asa").some(a => a.abgeschlossen && asTageSeit(a.datum) <= 100), "steuerung/asa"),
      k("Beauftragte vollständig (inkl. Sicherheitsbeauftragte)", soll.length && soll.every(z => z.ist >= z.soll), "organisation/beauftragte"),
      k("Mitzeichnung der Sifa eingeführt", asT("as_mitzeichnung").length || d.mitzeichnung_am, "mitzeichnung"),
      k("Prozessbeschreibungen (Stufe 1–2) freigegeben", kp.every(p => frei.has(p.id)), "prozesse", kp.filter(p => frei.has(p.id)).length + " von " + kp.length),
    ]},
    { nr: 3, titel: "Steuerung", text: "Ziele, Kennzahlen, Bericht", krit: [
      k("Reifegrad-Check (Vollfassung) in den letzten 12 Monaten", (() => { const c = asLetzterCheck("voll"); return c && asTageSeit(c.datum) <= 365; })(), "check"),
      k("SMART-Ziele vereinbart und freigegeben", asT("as_ziel").some(z => z.status === "aktiv" && z.freigegeben_am), "steuerung/ziele"),
      k("Einsatzzeiten werden erfasst", asT("as_einsatz").some(x => asTageSeit(x.datum) <= 120), "organisation/einsatz"),
      k("Jahresbericht der Sifa erstellt", asTageSeit(d.jahresbericht_am) <= 400, "bericht"),
    ]},
    { nr: 4, titel: "Kultur", text: "Beteiligung und Haltung", krit: [
      k("Thema des Monats läuft", asT("as_thema").some(t => asTageSeit(t.monat) <= 62), "steuerung/thema"),
      k("Melder bekommen Rückmeldung (≥ 80 %)", asT("as_meldung").length && asKennzahlen().rueckmeldung_quote >= 80, "steuerung/meldungen"),
      k("Sicherheitskultur eingestuft (12 Monate)", asT("as_kultur").some(x => asTageSeit(x.datum) <= 365), "steuerung/kultur"),
    ]},
  ];
}

/* Linien-Icons je Seite (Zeichen aus dem Kundenportal, ergänzt um die App-Seiten) – keine Emoji/Schriftzeichen */
const AS_ICON = {
  start: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
  cockpit: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M7 13h1M16 13h1M12 8v1"/>',
  pflichten: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="m7.5 12.5 3 3 6-7"/>',
  organisation: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  nachweise: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2a3.4 3.4 0 0 1 6.4 0M14.5 10h4M14.5 13.5h3"/>',
  check: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2"/><path d="m8.5 13 2.5 2.5 4.5-5"/>',
  bda: '<path d="M12 3.5 2.8 20h18.4L12 3.5z"/><path d="M12 10v4.2M12 17.4h.01"/>',
  anlagen: '<path d="M3 21V10.5l5.5 3.5V10.5l5.5 3.5V7l7 4v10z"/><path d="M7 17.5h2M11.5 17.5h2M16 17.5h2"/>',
  maengel: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/>',
  gefahrstoffe: '<path d="M9 3h6M10 3v6.5L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"/><path d="M7.2 14.5h9.6"/>',
  hallenplan: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h7v10M14 4v6h7M14 14h7"/>',
  vorfaelle: '<path d="M12 3.5 2.8 20h18.4L12 3.5z"/><path d="M12 10v4.2M12 17.4h.01"/>',
  vorort: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  massnahmen: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
  unterweisungen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  mitzeichnung: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  steuerung: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  kalender: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h3v3H8z"/>',
  fragen: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m21 7-9 6-9-6"/>',
  aktuelles: '<path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2z"/><path d="M19 9h1.5V18a1.5 1.5 0 0 1-3 0"/><path d="M7.5 9h8M7.5 12.5h8M7.5 16h5"/>',
  prozesse: '<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="9" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h6M6 9v3.5h6V15M18 9v3.5h-6"/>',
  unterlagen: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 12h5M9.5 15.5h5"/>',
  energie: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  bericht: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7.5h6M9 11h6"/>',
  leitfaden: '<path d="M12 3 20 6.5v5c0 4.6-3.2 8.3-8 9.5-4.8-1.2-8-4.9-8-9.5v-5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  datenschutz: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
};
function asIcon(k, s){ return AS_ICON[k] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${AS_ICON[k]}</svg>` : `<i>${s.icon || ""}</i>`; }

/* ---------------- Navigation ---------------- */
function asGehe(ziel){ location.hash = "#" + ziel; }
function asHashLesen(){
  const std = AS.fachkraft || !AS_SEITEN.start ? "cockpit" : "start";   // Betrieb (Schichtführer) startet mit der Startseite
  const h = decodeURIComponent(location.hash.replace(/^#/, "")) || std;
  const [s, r] = h.split("/");
  AS.seite = AS_SEITEN[s] && (AS.fachkraft || AS.gf || !AS_SEITEN[s].nurFachkraft) ? s : std;
  if(r) AS.reiter[AS.seite] = r;
}
/* Seitenleiste in Gruppen (Nikolai 14.10.2026: „zu lang, gliedern wie in V1“). Offen ist die Gruppe der aktiven Seite
   plus die, die man selbst aufgeklappt hat (gemerkt im Gerät). Seiten ohne Gruppe landen unter „Service“. */
const AS_NAV_GRUPPEN = [
  ["ueberblick", "Überblick", ["start", "cockpit", "leitfaden", "pflichten"]],
  ["organisation", "Organisation", ["organisation", "check", "nachweise", "notfall", "prozesse"]],
  ["gefaehrdungen", "Gefährdungen", ["bda", "massnahmen", "mitzeichnung", "gefahrstoffe"]],
  ["anlagen", "Anlagen & Betrieb", ["anlagen", "pruefungen", "maengel", "hallenplan", "vorort"]],
  ["personal", "Personal", ["unterweisungen", "fremdfirmen", "vorfaelle"]],
  ["steuerung", "Steuerung", ["steuerung", "kalender", "bericht", "energie"]],
  ["service", "Service", ["fragen", "aktuelles", "unterlagen", "leistungen", "datenschutz"]],
];
function asNavOffen(){ try{ return JSON.parse(localStorage.getItem("as_nav_offen") || "[]"); }catch(e){ return []; } }
function asNav(){
  const sicht = k => AS_SEITEN[k] && !AS_SEITEN[k].versteckt && (AS.fachkraft || AS.gf || !AS_SEITEN[k].nurFachkraft);
  const zugeteilt = new Set(AS_NAV_GRUPPEN.flatMap(g => g[2]));
  const rest = Object.keys(AS_SEITEN).filter(k => !zugeteilt.has(k)).sort((a, b) => AS_SEITEN[a].sort - AS_SEITEN[b].sort);
  const gruppen = AS_NAV_GRUPPEN.map(([id, titel, seiten]) => [id, titel, (id === "service" ? seiten.concat(rest) : seiten).filter(sicht)]).filter(g => g[2].length);
  const offen = new Set(asNavOffen());
  const link = k => `<a href="#${k}" class="${AS.seite === k ? "an" : ""}">${asIcon(k, AS_SEITEN[k])}${esc(AS_SEITEN[k].titel)}</a>`;
  const html = gruppen.map(([id, titel, seiten]) => {
    const aktiv = seiten.includes(AS.seite), auf = aktiv || offen.has(id) || gruppen.length === 1;
    return `<div class="nav-gruppe${auf ? " auf" : ""}${aktiv ? " aktiv" : ""}" data-g="${id}">
      <button type="button" class="nav-kopf" aria-expanded="${auf}"><span>${esc(titel)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
      <div class="nav-links">${seiten.map(link).join("")}</div></div>`;
  }).join("");
  ["nav", "blatt"].forEach(id => {
    const el = document.getElementById(id); el.innerHTML = html;
    el.querySelectorAll(".nav-kopf").forEach(b => b.onclick = () => {
      const g = b.parentElement, auf = !g.classList.contains("auf"), o = new Set(asNavOffen());
      g.classList.toggle("auf", auf); b.setAttribute("aria-expanded", auf);
      auf ? o.add(g.dataset.g) : o.delete(g.dataset.g);
      try{ localStorage.setItem("as_nav_offen", JSON.stringify([...o])); }catch(e){}
    });
  });
  document.getElementById("menueTitel").textContent = (AS_SEITEN[AS.seite] || {}).titel || "Bereiche";
}
function asKundeWahl(){
  const el = document.getElementById("kundeWahl");
  const opt = AS.kunden.map(k => `<option value="${esc(k.kunde_slug)}" ${k.kunde_slug === AS.kunde ? "selected" : ""}>${esc(k.name)}</option>`).join("");
  el.innerHTML = (AS.kunden.length ? `<select id="kundeSel">${opt}</select>` : `<span>Noch kein Kunde</span>`)
    + (AS.admin ? ` <button class="btn adm klein" id="kundeNeu">+ Kunde</button>` : "");
  const sel = document.getElementById("kundeSel");
  if(sel) sel.onchange = async () => { AS.kunde = sel.value; try{ localStorage.setItem("as_kunde", AS.kunde); }catch(e){} await asLaden(); asZeige(); };
  const neu = document.getElementById("kundeNeu"); if(neu) neu.onclick = asKundeAnlegen;
}
function asKundeAnlegen(){
  asDialog({ titel: "Neuen Kunden anlegen", inhalt: `<div class="form">
      ${asFeld("Firmenname", "name", "", "text", "voll")}
      ${asFeld("Kurzname (klein, ohne Leerzeichen, z. B. musterbetrieb)", "slug", "", "text", "voll")}</div>
      <p class="hinweis">Der Kunde wird nur in dieser App angelegt. Bestehende Kunden im Kundenportal bleiben unberührt.</p>`,
    knoepfe: [{ t: "Anlegen", fn: async d => {
      const w = asWerte(d); const slug = (w.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if(!w.name || !slug){ asMeldung("Name und Kurzname angeben."); return false; }
      if(AS.kunden.some(k => k.kunde_slug === slug)){ asMeldung("Kurzname schon vergeben."); return false; }
      const vorhanden = await apiGet("/rest/v1/portal_kunde?select=slug&slug=eq." + encodeURIComponent(slug)).catch(() => []);
      if(!vorhanden.length) await apiSend("POST", "/rest/v1/portal_kunde", { slug, name: w.name }, "return=minimal");
      await apiSend("POST", "/rest/v1/as_organisation", { kunde_slug: slug, name: w.name, daten: {} }, "return=minimal");
      await asKundenLaden(); AS.kunde = slug; try{ localStorage.setItem("as_kunde", slug); }catch(e){}
      await asLaden(); asZeige(); asGehe("organisation"); asMeldung("Kunde angelegt – als Nächstes die Erstaufnahme.");
    }}]});
}
function asZeige(){
  asHashLesen(); asNav(); asKundeWahl();
  const main = document.getElementById("haupt");
  if(!AS.kunde){ main.innerHTML = `<h1 class="seite">Willkommen</h1><p class="unter">${AS.admin ? "Lege oben mit „+ Kunde“ den ersten Kunden an." : "Für Ihren Betrieb ist die App noch nicht eingerichtet."}</p>`; return; }
  const s = AS_SEITEN[AS.seite];
  main.innerHTML = ""; s.render(main);
  document.getElementById("blattHg").classList.remove("zeig");
  window.scrollTo(0, 0);
}
function asReiter(seite, liste, standard){
  const akt = AS.reiter[seite] && liste.some(l => l[0] === AS.reiter[seite]) ? AS.reiter[seite] : standard;
  return { akt, html: `<div class="reiter nodruck">${liste.map(([k, t]) => `<button class="${k === akt ? "an" : ""}" onclick="asGehe('${seite}/${k}')">${esc(t)}</button>`).join("")}</div>` };
}

/* ---------------- Start ---------------- */
async function asStart(){
  const s = getSession();
  document.getElementById("loginForm").onsubmit = async ev => {
    ev.preventDefault(); const f = document.getElementById("loginFehler"); f.textContent = "";
    try{ await login(document.getElementById("loginMail").value.trim(), document.getElementById("loginPw").value); location.reload(); }
    catch(e){ f.textContent = "Anmeldung fehlgeschlagen: " + e.message; }
  };
  if(!s || !(await token())){ document.getElementById("loginView").hidden = false; return; }
  try{
    AS.uid = (getSession().user || {}).id;
    const me = await apiGet("/rest/v1/portal_mitglied?select=name,rolle,rollen,kunde_slug&user_id=eq." + encodeURIComponent(AS.uid));
    const m = me && me[0]; if(!m) throw new Error("Kein Portal-Zugang für dieses Konto.");
    AS.admin = m.rolle === "admin"; AS.fachkraft = AS.admin || m.rolle === "fachkraft"; AS.ich = m.name || "";
    AS.gf = AS.admin || !!(m.rollen && m.rollen.gf);   // Geschäftsführung: gibt Beurteilungen frei (DB prüft portal_ist_gf)
    await asKundenLaden();
    /* ?kunde=<slug> in der Adresse öffnet direkt diesen Kunden (Link aus dem Terminal) */
    let gew = new URLSearchParams(location.search).get("kunde");
    if(!gew){ try{ gew = localStorage.getItem("as_kunde"); }catch(e){} }
    else { try{ localStorage.setItem("as_kunde", gew); }catch(e){} }
    AS.kunde = AS.kunden.some(k => k.kunde_slug === gew) ? gew : (AS.kunden[0] || {}).kunde_slug || null;
    await asLaden();
  }catch(e){
    if(String(e.message) === "AUTH"){ document.getElementById("loginView").hidden = false; return; }
    document.body.innerHTML = `<p style="padding:20px">Fehler beim Laden: ${esc(e.message)}</p>`; return;
  }
  document.getElementById("appView").hidden = false;
  document.getElementById("ichName").textContent = AS.ich + (AS.admin ? " · OAK" : "");
  document.getElementById("abmelden").onclick = () => { clearSession(); location.reload(); };
  document.getElementById("menueKnopf").onclick = () => document.getElementById("blattHg").classList.add("zeig");
  document.getElementById("blattHg").onclick = e => { if(e.target.id === "blattHg") e.target.classList.remove("zeig"); };
  window.addEventListener("hashchange", asZeige);
  asZeige();
}

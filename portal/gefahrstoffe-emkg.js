/* Gefahrstoffkataster – Gefährdungsbeurteilung nach EMKG je Tätigkeit (Nikolai 13.10.2026)
   Je Stoff beliebig viele Tätigkeiten; jede speichert die Tätigkeitsangaben (eingaben), einen Schnappschuss der
   Stoffdaten aus dem SDB (stoffdaten) und das Ergebnis von EMKG.bewerten() je Modul in portal_gefahrstoff_gbu.
   Dieselben Fragen wie der Papierbogen (tools/emkg_erhebungsbogen.py) – Papier und Portal bleiben austauschbar.
   Rechenlogik: emkg-kern.js (window.EMKG), Regeln: references/gefahrstoffe/emkg-regelwerk.md.
   Wer/wann setzt der Server (Trigger portal_gefahrstoff_gbu_geaendert), nie der Client. */

let GSE_ROWS = [], GSE_FUER = null, GSE_PA = [];

const GSE_MODULE = [["einatmen", "Einatmen"], ["haut", "Haut"], ["augen", "Augen"], ["brand", "Brand und Explosion"], ["lagern", "Lagern"]];
const GSE_STUFE = { 0: "entfällt", 1: "Stufe 1 – Grundmaßnahmen", 2: "Stufe 2 – erweiterte Maßnahmen", 3: "Stufe 3 – geschlossenes System / besondere Maßnahmen", 4: "Stufe 4 – Beratung erforderlich" };
const GSE_ART = {
  "": "keine der genannten (allgemein)", reinigen: "Reinigen (Lappen, Pinsel, Sprühflasche)", streichen_rollen_tauchen: "Streichen, Rollen, Tauchen",
  spritzlackieren: "Spritzlackieren", mischen: "Mischen, Anrühren", wiegen: "Abwiegen", abfuellen_loesemittel: "Abfüllen von Lösemitteln",
  abfuellen_entzuendbar: "Abfüllen entzündbarer Flüssigkeiten", fass_entleeren_pumpe: "Fass entleeren (Pumpe)", fass_entleeren_zapfhahn: "Fass entleeren (Zapfhahn)",
  faesser_befuellen: "Fässer befüllen", trocknen: "Trocknen", filterwechsel: "Filterwechsel", saecke_entleeren: "Säcke entleeren", saecke_befuellen: "Säcke befüllen",
  kessel_beschicken: "Kessel beschicken", foerderband: "Förderband", pulverbeschichten: "Pulverbeschichten", pulverflaschen_befuellen: "Pulverflaschen befüllen",
  pellets_herstellen: "Pellets herstellen", ibc_befuellen: "IBC befüllen", ibc_entleeren: "IBC entleeren", umpumpen: "Umpumpen", glovebox: "Glovebox", tankfahrzeug: "Tankfahrzeug"
};

async function gseLaden(erzwingen){
  if(!erzwingen && GSE_FUER === AKTIV) return GSE_ROWS;
  const k = AKTIV ? "&kunde_slug=eq." + encodeURIComponent(AKTIV) : "";
  try{ GSE_ROWS = await apiGet("/rest/v1/portal_gefahrstoff_gbu?select=*" + k + "&order=erstellt_am.asc", false) || []; }
  catch(e){ GSE_ROWS = []; }
  /* offene Überprüfungen (neues SDB / geänderte H-Sätze → Trigger in der DB) */
  try{ GSE_PA = await apiGet("/rest/v1/portal_pruefauftrag?select=id,objekt_typ,objekt_id,anlaesse,faellig_am&erledigt_am=is.null&objekt_typ=in.(gs_gbu,gs_ba)" + k, false) || []; }
  catch(e){ GSE_PA = []; }
  GSE_FUER = AKTIV;
  return GSE_ROWS;
}
function gseFuer(g){ return GSE_ROWS.filter(r => r.gefahrstoff_id === g.id && r.status !== "ueberholt"); }
function gsePa(typ, id){ return GSE_PA.find(p => p.objekt_typ === typ && p.objekt_id === String(id)) || null; }
/* Überprüfung fällig für den Stoff (eine seiner Beurteilungen oder seine BA) */
function gsePruefen(g){ return !!gsePa("gs_ba", g.id) || gseFuer(g).some(x => gsePa("gs_gbu", x.id)); }
function gsePaHinweis(p){ return p ? `<span class="gse-st gse-st-pruefen" title="${esc((p.anlaesse || []).map(a => a.text).join(" · "))}">prüfen bis ${esc(ehsDatum(p.faellig_am))}</span>` : ""; }
/* Stand der GBU je Stoff fuer die Liste: frei = mind. eine freigegebene Taetigkeit, entwurf = nur Entwuerfe */
function gseStand(g){ const r = gseFuer(g); return r.some(x => x.status === "freigegeben") ? "frei" : (r.length ? "entwurf" : ""); }

/* sdb_daten ({feld:{wert,abschnitt,…}}) → Stoffobjekt fuer EMKG.bewerten. Spraydosen sind fluessig + versprueht. */
function gseStoff(g){
  const d = g.sdb_daten || {}, w = k => d[k] && d[k].wert != null ? d[k].wert : undefined;
  let agg = w("aggregat"); if(agg === "aerosol") agg = "fluessig";
  if(!agg && (g.h_saetze || []).some(h => h === "H222" || h === "H223" || h === "H229")) agg = "fluessig";
  const s = { h_saetze: g.h_saetze || [], aggregat: agg, siedepunkt_c: w("siedepunkt_c"), dampfdruck_hpa: w("dampfdruck_hpa"),
    flammpunkt_c: w("flammpunkt_c"), lagerklasse: w("lagerklasse"), ist_gemisch: w("ist_gemisch") };
  const agw = w("agw_bestandteile");
  if(s.ist_gemisch === false && Array.isArray(agw) && agw.length === 1) s.agw = { wert: agw[0].wert, einheit: agw[0].einheit };
  Object.keys(s).forEach(k => s[k] === undefined && delete s[k]);
  return s;
}
function gseIstSpray(g){ const d = g.sdb_daten || {}; return (d.aggregat && d.aggregat.wert === "aerosol") || (g.h_saetze || []).some(h => h === "H222" || h === "H229"); }

/* Block im Stoff-Dialog: erfasste Taetigkeiten + Knopf */
function gseBlock(g, pflege){
  const r = gseFuer(g);
  const zeile = x => { const e = x.ergebnis && x.ergebnis.module || {};
    return `<div class="gse-tz"><button type="button" class="gse-tz-k" data-gbu="${esc(x.id)}"><b>${esc(x.taetigkeit)}</b>${x.arbeitsbereich ? ` · ${esc(x.arbeitsbereich)}` : ""}
      <span class="gse-st gse-st-${x.status === "freigegeben" ? "frei" : "entwurf"}">${x.status === "freigegeben" ? "freigegeben" + (x.freigegeben_von ? " – " + esc(x.freigegeben_von) : "") : "Entwurf"}</span>${gsePaHinweis(gsePa("gs_gbu", x.id))}</button>
      <div class="gse-chips">${GSE_MODULE.map(([k, t]) => gseChip(t, e[k])).join("")}</div></div>`; };
  return `<div class="gse-block">${r.length ? r.map(zeile).join("") : `<span class="gs-luecke">Noch keine Tätigkeit nach EMKG erfasst</span>`}
    ${pflege ? `<div><button type="button" class="btn-klein" id="gseNeu">Tätigkeit erfassen (EMKG)</button></div>` : ""}</div>`;
}
function gseChip(titel, m){
  const roh = m ? m.stufe : null, s = Number.isInteger(roh) && roh >= 0 && roh <= 4 ? roh : null, k = s === null ? "offen" : "s" + s;
  return `<span class="gse-chip gse-${k}" title="${esc(titel + ": " + (s === null || s === undefined ? "nicht berechenbar – Angaben fehlen" : GSE_STUFE[s]))}">${esc(titel)} ${s === null || s === undefined ? "?" : s === 0 ? "–" : s}</span>`;
}
function gseBlockVerdrahten(dlg, g, neu){
  const nb = dlg.querySelector("#gseNeu"); if(nb) nb.addEventListener("click", () => { dlg.close(); gseDialog(g, null, neu); });
  dlg.querySelectorAll("[data-gbu]").forEach(b => b.addEventListener("click", () => { dlg.close(); gseDialog(g, GSE_ROWS.find(x => x.id === b.dataset.gbu), neu); }));
}

function gseDialog(g, gbu, danach){
  const dlg = ehsDialog("gseDlg", "gs-edit gse-dlg");
  const e = (gbu && gbu.eingaben) || {}, spray = gseIstSpray(g), pflege = gsDarfPflegen();
  const sd = g.sdb_daten || {}, roh = k => sd[k] && sd[k].wert != null ? sd[k].wert : "";
  const ja = (v, std) => (v === undefined ? std : v) ? " checked" : "";
  const radio = (name, wert, akt, text) => `<label class="ehs-check"><input type="radio" name="${name}" value="${wert}"${akt === wert ? " checked" : ""}> ${text}</label>`;
  const haut = e.hautkontakt_ausgeschlossen ? "aus" : (e.wirkflaeche || "");
  const bereiche = [...new Set(GS_ROWS.flatMap(x => x.bereiche || []))].sort((a, b) => a.localeCompare(b, "de"));
  const mg = e.menge || {};
  dlg.innerHTML = `<form method="dialog">
    <h3>Gefährdungsbeurteilung nach EMKG</h3>
    ${gbu && gsePa("gs_gbu", gbu.id) ? `<div class="ul-hinweis"><b>Überprüfung fällig:</b> ${esc((gsePa("gs_gbu", gbu.id).anlaesse || []).map(a => a.text).join(" · "))} – Angaben prüfen und neu freigeben.</div>` : ""}
    <p class="pw-hint"><b>${esc(g.bezeichnung)}</b>${g.hersteller ? " · " + esc(g.hersteller) : ""} · ${esc((g.h_saetze || []).join(" ") || "keine H-Sätze")}
      – je Tätigkeit eine Beurteilung. Die Maßnahmen ergeben sich aus den Angaben und werden laufend unten angezeigt.</p>
    <fieldset class="gs-feld"><legend>Tätigkeit</legend>
      <label>Was wird gemacht?<input type="text" id="gseT" maxlength="200" value="${esc(gbu ? gbu.taetigkeit : "")}" placeholder="z. B. Werkzeug reinigen mit Lappen"></label>
      <div class="ehs-zwei"><label>Bereich<input type="text" id="gseB" list="gseBListe" maxlength="120" value="${esc(gbu ? gbu.arbeitsbereich || "" : (g.bereiche || [])[0] || "")}"></label>
        <label>Art der Tätigkeit<select id="gseArt">${Object.entries(GSE_ART).map(([k, t]) => `<option value="${k}"${(e.taetigkeitsart || "") === k ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
      <datalist id="gseBListe">${bereiche.map(b => `<option value="${esc(b)}">`).join("")}</datalist></fieldset>
    <fieldset class="gs-feld"><legend>Menge und Dauer</legend>
      <div class="ehs-zwei"><label>Menge je Tätigkeit bzw. Schicht <span class="uw-leise">(nicht der Vorrat)</span>
          <span class="gse-menge"><input type="number" id="gseMw" min="0" step="any" value="${esc(mg.wert != null ? mg.wert : "")}">
          <select id="gseMe">${["ml", "l", "m³", "g", "kg", "t"].map(x => `<option${(mg.einheit || (spray ? "ml" : "l")) === x ? " selected" : ""}>${x}</option>`).join("")}</select></span></label>
        <label>Dauer pro Tag in Minuten <span class="uw-leise">(alle Zeiten zusammen)</span><input type="number" id="gseD" min="0" step="1" value="${esc(e.dauer_min_tag != null ? e.dauer_min_tag : "")}"></label></div>
      <label class="ehs-check"><input type="checkbox" id="gseGross"${ja(e.grossflaechig, false)}> großflächig (Streichen, Reinigen von Flächen) – dann Menge pro Arbeitstag</label>
      <label class="ehs-check"><input type="checkbox" id="gseSpr"${ja(e.versprueht, spray)}> wird versprüht (Spraydose, Sprühflasche, Spritzpistole)</label>
      <label>Verarbeitungstemperatur in °C<input type="number" id="gseTemp" step="1" value="${esc(e.verarbeitungstemp_c != null ? e.verarbeitungstemp_c : 20)}"></label></fieldset>
    <fieldset class="gs-feld"><legend>Hautkontakt <span class="uw-leise">(so, als würden keine Handschuhe getragen)</span></legend>
      ${radio("gseH", "aus", haut, "technisch ausgeschlossen (geschlossenes System)")}${radio("gseH", "klein", haut, "Spritzer, kleinflächig")}${radio("gseH", "gross", haut, "großflächig (z. B. ganze Hand)")}
      <div class="gse-reihe">Dauer: ${radio("gseHd", "kurz", e.wirkdauer || "", "unter 15 min/Tag")}${radio("gseHd", "lang", e.wirkdauer || "", "über 15 min/Tag")}</div>
      <div class="gse-reihe">Betroffen: ${[["haende", "Hände/Arme"], ["gesicht", "Gesicht/Augen"], ["rumpf", "Rumpf"], ["fuesse", "Füße/Beine"]].map(([k, t]) => `<label class="ehs-check"><input type="checkbox" class="gseK" value="${k}"${(e.koerperstellen || ["haende"]).includes(k) ? " checked" : ""}> ${t}</label>`).join("")}</div>
      <label class="ehs-check"><input type="checkbox" id="gseFeucht"${ja(e.feuchtarbeit, false)}> Feuchtarbeit (über 2 h/Tag nass oder über 15× Händewaschen)</label></fieldset>
    <fieldset class="gs-feld"><legend>Arbeitsplatz</legend>
      <label>Lüftung<select id="gseL">${[["normal", "normale Raumlüftung"], ["absaugung", "Absaugung am Arbeitsplatz vorhanden"], ["gering", "schlecht belüftet"], ["keine", "keine Lüftung"]].map(([k, t]) => `<option value="${k}"${(e.raumlueftung || "normal") === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="ehs-check"><input type="checkbox" id="gseEng"${ja(e.enge_raeume, false)}> Arbeiten in Behältern, Tanks, Gruben, engen Räumen</label>
      <label class="ehs-check"><input type="checkbox" id="gseFeuer"${ja(e.feuerarbeiten_dauerhaft, false)}> ständige Feuerarbeiten in der Nähe (fester Schweißplatz)</label>
      <label class="ehs-check"><input type="checkbox" id="gseMess"${ja(e.mit_messung, false)}> Arbeitsplatzmessung zeigt Einhaltung des Grenzwerts</label>
      <label>Lagermenge dieses Stoffs am Lagerort in kg bzw. l <span class="uw-leise">(für das Modul Lagern)</span><input type="number" id="gseLag" min="0" step="any" value="${esc(e.lagermenge_kg != null ? e.lagermenge_kg : "")}"></label></fieldset>
    <details class="gs-feld gse-sdb"${!roh("aggregat") || (!roh("siedepunkt_c") && !roh("dampfdruck_hpa") && !spray) ? " open" : ""}><summary>Stoffdaten aus dem Sicherheitsdatenblatt (Abschnitt 9)</summary>
      <div class="ehs-zwei"><label>Aggregatzustand<select id="gseAgg">${[["", "–"], ["fluessig", "flüssig"], ["aerosol", "Spraydose (Aerosol)"], ["fest", "fest"], ["gas", "Gas"]].map(([k, t]) => `<option value="${k}"${String(roh("aggregat")) === k ? " selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Siedebeginn °C<input type="number" id="gseSdp" step="any" value="${esc(roh("siedepunkt_c"))}"></label></div>
      <div class="ehs-zwei"><label>Dampfdruck hPa (20 °C)<input type="number" id="gseDd" step="any" value="${esc(roh("dampfdruck_hpa"))}"></label>
        <label>Flammpunkt °C<input type="number" id="gseFp" step="any" value="${esc(roh("flammpunkt_c"))}"></label></div>
      <p class="uw-leise">Aus dem SDB ausgelesen, Abschnitt 9.1. Geänderte Werte werden beim Stoff gespeichert und gelten für alle Tätigkeiten.</p></details>
    <div id="gseErg" class="gse-erg"></div>
    <p class="pw-msg" id="gseMsg"></p>
    <div class="pw-akt">${gbu && typeof ADMIN !== "undefined" && ADMIN ? `<button type="button" class="btn sek" id="gseLoe">Löschen</button>` : ""}
      <button type="button" class="btn sek" id="gseAbb">Schließen</button>
      ${gbu ? `<button type="button" class="btn sek" id="gseDruck">Drucken</button>` : ""}
      ${pflege ? `<button type="submit" class="btn sek" value="entwurf">Als Entwurf speichern</button>${(typeof ADMIN !== "undefined" && ADMIN) || window.__oakGf
        ? `<button type="submit" class="btn" value="freigegeben">Speichern und freigeben</button>` : `<button type="submit" class="btn" value="vorlegen">Der GF zur Freigabe vorlegen</button>`}` : ""}</div>
  </form>`;
  const q = s => dlg.querySelector(s), zahl = s => { const v = q(s).value; return v === "" ? undefined : Number(v); };
  const stoffNeu = () => {
    const d = Object.assign({}, g.sdb_daten || {}), setz = (k, v) => {
      const alt = d[k] && d[k].wert != null ? d[k].wert : "";
      if(String(alt) === String(v === undefined ? "" : v)) return;
      d[k] = { wert: v === "" || v === undefined ? null : v, abschnitt: "9.1", sicher: true, quelle: "Portal", geaendert_am: ehsHeute() };
    };
    setz("aggregat", q("#gseAgg").value); setz("siedepunkt_c", zahl("#gseSdp")); setz("dampfdruck_hpa", zahl("#gseDd")); setz("flammpunkt_c", zahl("#gseFp"));
    return d;
  };
  const eingaben = () => {
    const h = (dlg.querySelector('input[name="gseH"]:checked') || {}).value || "", hd = (dlg.querySelector('input[name="gseHd"]:checked') || {}).value;
    const t = { menge: zahl("#gseMw") !== undefined ? { wert: zahl("#gseMw"), einheit: q("#gseMe").value } : undefined,
      dauer_min_tag: zahl("#gseD"), grossflaechig: q("#gseGross").checked, versprueht: q("#gseSpr").checked,
      verarbeitungstemp_c: zahl("#gseTemp") === undefined ? 20 : zahl("#gseTemp"),
      hautkontakt_ausgeschlossen: h === "aus", wirkflaeche: h === "klein" || h === "gross" ? h : undefined, wirkdauer: hd,
      koerperstellen: [...dlg.querySelectorAll(".gseK:checked")].map(x => x.value), feuchtarbeit: q("#gseFeucht").checked,
      raumlueftung: q("#gseL").value, enge_raeume: q("#gseEng").checked, feuerarbeiten_dauerhaft: q("#gseFeuer").checked,
      mit_messung: q("#gseMess").checked, lagermenge_kg: zahl("#gseLag"), taetigkeitsart: q("#gseArt").value || undefined };
    Object.keys(t).forEach(k => t[k] === undefined && delete t[k]);
    return t;
  };
  const rechnen = () => {
    const box = q("#gseErg");
    if(typeof EMKG === "undefined"){ box.innerHTML = `<div class="ul-hinweis">Rechenkern nicht geladen.</div>`; return null; }
    let r; try{ r = EMKG.bewerten(gseStoff(Object.assign({}, g, { sdb_daten: stoffNeu() })), eingaben()); }
    catch(err){ box.innerHTML = `<div class="ul-hinweis">Bewertung nicht möglich: ${esc(err.message || err)}</div>`; return null; }
    box.innerHTML = gseErgebnisHtml(r);
    return r;
  };
  dlg.querySelectorAll("input,select").forEach(el => el.addEventListener(el.type === "number" || el.type === "text" ? "input" : "change", rechnen));
  rechnen();
  q("#gseAbb").addEventListener("click", () => dlg.close());
  const dr = q("#gseDruck");
  if(dr) dr.addEventListener("click", () => { const r = rechnen(); if(r) gseDrucken(g, gbu, eingaben(), r); });
  const loe = q("#gseLoe");
  if(loe) loe.addEventListener("click", async () => {
    if(!confirm("Diese Tätigkeit samt Beurteilung löschen?")) return;
    try{ await apiSend("DELETE", "/rest/v1/portal_gefahrstoff_gbu?id=eq." + encodeURIComponent(gbu.id), null, "return=minimal"); GSE_FUER = null; dlg.close(); if(danach) danach(); }
    catch(err){ q("#gseMsg").textContent = "Konnte nicht gelöscht werden: " + (err.message || err); q("#gseMsg").className = "pw-msg fehler"; }
  });
  q("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const msg = q("#gseMsg"), art = ev.submitter && ev.submitter.value, status = art === "freigegeben" ? "freigegeben" : "entwurf";
    const taet = q("#gseT").value.trim();
    if(taet.length < 3){ msg.textContent = "Bitte die Tätigkeit beschreiben."; msg.className = "pw-msg fehler"; return; }
    const r = rechnen(); if(!r){ msg.textContent = "Bewertung nicht möglich – Angaben prüfen."; msg.className = "pw-msg fehler"; return; }
    if(status === "freigegeben" && r.fehlend.length && !confirm("Es fehlen noch Angaben (" + r.fehlend.length + "). Trotzdem freigeben?")) return;
    try{
      msg.className = "pw-msg"; msg.textContent = "Wird gespeichert …";
      const sdNeu = stoffNeu();
      if(JSON.stringify(sdNeu) !== JSON.stringify(g.sdb_daten || {})){
        await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), { sdb_daten: sdNeu, geaendert_von: window.__oakName || "", geaendert_am: new Date().toISOString() }, "return=minimal");
        g.sdb_daten = sdNeu;
      }
      const daten = { taetigkeit: taet, arbeitsbereich: q("#gseB").value.trim() || null, eingaben: eingaben(),
        stoffdaten: Object.assign(gseStoff(g), { _sdb: { pfad: g.sdb_pfad || null, ausgabe: g.sdb_ausgabe || null } }),
        ergebnis: r, kern_version: r.version, status, vorgelegt_am: art === "vorlegen" ? new Date().toISOString() : null, geaendert_am: new Date().toISOString() };
      if(gbu) await apiSend("PATCH", "/rest/v1/portal_gefahrstoff_gbu?id=eq." + encodeURIComponent(gbu.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_gefahrstoff_gbu", Object.assign({ kunde_slug: g.kunde_slug || AKTIV, gefahrstoff_id: g.id }, daten), "return=minimal");
      GSE_FUER = null; dlg.close(); if(danach) danach();
    }catch(err){ msg.textContent = "Konnte nicht gespeichert werden: " + (err.message || err); msg.className = "pw-msg fehler"; }
  });
  dlg.showModal();
}

const GSE_FEHLT = { "taetigkeit.menge": "Menge je Tätigkeit", "taetigkeit.wirkflaeche": "Hautkontakt (Fläche)", "taetigkeit.wirkdauer": "Dauer des Hautkontakts",
  "taetigkeit.lagermenge_kg": "Lagermenge", "stoff.aggregat": "Aggregatzustand", "stoff.siedepunkt_c": "Siedebeginn oder Dampfdruck", "stoff.h_saetze": "H-Sätze" };
function gseErgebnisHtml(r){
  const mod = ([k, t]) => { const m = r.module[k] || {}, s = m.stufe;
    const slf = (m.schutzleitfaeden || []).map(x => `<li><b>${esc(x.nr)}</b> ${esc(x.titel)}</li>`).join("");
    const fehl = (m.fehlend || []).map(f => GSE_FEHLT[f] || GSE_FEHLT[f.split(":")[0]] || f);
    return `<div class="gse-mod"><div class="gse-mod-k">${gseChip(t, m)}<span>${s === null || s === undefined ? "nicht berechenbar" : esc(GSE_STUFE[s])}${m.gruppe ? ` · Gruppe ${esc(m.gruppe)}` : ""}</span></div>
      ${fehl.length ? `<div class="uw-leise">Fehlt: ${esc([...new Set(fehl)].join(", "))}</div>` : ""}
      ${slf ? `<details><summary>Schutzleitfäden (${(m.schutzleitfaeden || []).length})</summary><ul class="gse-slf">${slf}</ul></details>` : ""}
      ${(m.massnahmenHinweise || []).length ? `<ul class="gse-hw">${m.massnahmenHinweise.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}</div>`; };
  return `<h4 class="ul-h4">Ergebnis</h4>${GSE_MODULE.map(mod).join("")}
    ${r.mutterschutz ? `<div class="ul-hinweis">Mutterschutz beachten: ${esc(r.mutterschutzSaetze.join(", "))}</div>` : ""}
    ${(r.hinweise || []).length ? `<details><summary>Hinweise (${r.hinweise.length})</summary><ul class="gse-hw">${r.hinweise.map(h => `<li>${esc(h)}</li>`).join("")}</ul></details>` : ""}
    <p class="uw-leise">Berechnet mit EMKG-Kern ${esc(r.version)} nach BAuA-Leitfaden 2.2, Leitfaden Brand und Explosion 2020 und H-/EUH-Zuordnung 06/2026.</p>`;
}

/* Druckfassung der Beurteilung (eine Tätigkeit) – Kopf, Angaben, Ergebnis je Modul, Freigabe */
function gseDrucken(g, gbu, e, r){
  const z = (k, v) => v === undefined || v === null || v === "" ? "" : `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const mg = e.menge ? e.menge.wert + " " + e.menge.einheit + (e.grossflaechig ? " pro Arbeitstag (großflächig)" : " je Tätigkeit") : "";
  const haut = e.hautkontakt_ausgeschlossen ? "technisch ausgeschlossen" : ({ klein: "Spritzer, kleinflächig", gross: "großflächig" }[e.wirkflaeche] || "");
  ehsDrucken("Gefährdungsbeurteilung – " + g.bezeichnung, `
    <h1>Gefährdungsbeurteilung Gefahrstoffe (EMKG)</h1>
    <p class="leise">§ 6 GefStoffV · Einfaches Maßnahmenkonzept Gefahrstoffe der BAuA</p>
    <h2>Stoff und Tätigkeit</h2><table>
      ${z("Gefahrstoff", g.bezeichnung)}${z("Hersteller", g.hersteller)}${z("Signalwort", g.signalwort)}${z("H-/EUH-Sätze", (g.h_saetze || []).join(" "))}
      ${z("Sicherheitsdatenblatt", g.sdb_ausgabe ? "Stand " + ehsDatum(g.sdb_ausgabe) : "")}
      ${z("Tätigkeit", gbu.taetigkeit)}${z("Bereich", gbu.arbeitsbereich)}${z("Art der Tätigkeit", GSE_ART[e.taetigkeitsart || ""])}</table>
    <h2>Angaben zur Tätigkeit</h2><table>
      ${z("Menge", mg)}${z("Dauer pro Tag", e.dauer_min_tag != null ? e.dauer_min_tag + " min" : "")}${z("Versprüht", e.versprueht ? "ja" : "nein")}
      ${z("Temperatur", e.verarbeitungstemp_c != null ? e.verarbeitungstemp_c + " °C" : "")}${z("Hautkontakt", haut)}
      ${z("Dauer Hautkontakt", { kurz: "unter 15 min/Tag", lang: "über 15 min/Tag" }[e.wirkdauer])}
      ${z("Lüftung", { normal: "normale Raumlüftung", absaugung: "Absaugung am Arbeitsplatz", gering: "schlecht belüftet", keine: "keine Lüftung" }[e.raumlueftung])}
      ${z("Enge Räume", e.enge_raeume ? "ja" : "")}${z("Lagermenge", e.lagermenge_kg != null ? e.lagermenge_kg + " kg bzw. l" : "")}</table>
    ${gseErgebnisHtml(r).replace(/<details>/g, "<div>").replace(/<\/details>/g, "</div>").replace(/<summary>/g, "<h3>").replace(/<\/summary>/g, "</h3>")}
    <h2>Freigabe</h2><table>
      ${z("Status", gbu.status === "freigegeben" ? "freigegeben" : "Entwurf")}${z("Freigegeben von", gbu.freigegeben_von)}
      ${z("Freigegeben am", gbu.freigegeben_am ? ehsDatum(gbu.freigegeben_am) : "")}${z("Nächste Überprüfung", gbu.naechste_pruefung ? ehsDatum(gbu.naechste_pruefung) : "")}
      ${z("Erstellt von", gbu.erstellt_von)}</table>`);
}

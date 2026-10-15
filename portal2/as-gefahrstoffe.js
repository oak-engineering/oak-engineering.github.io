/* Gefahrstoffkataster im Cockpit (Plan intern/plan-eine-welt.md, Schritt 6; 15.10.2026) – ersetzt die eingebettete V1-Seite.
   Daten wie bisher: portal_gefahrstoff (Verzeichnis nach § 6 Abs. 12 GefStoffV), portal_gefahrstoff_gbu (EMKG je Tätigkeit),
   portal_pruefauftrag (gs_gbu / gs_ba), Dokumente der Kategorie „gefahrstoffe“ (Sammel-BA, Hautschutzpläne).
   V1 (portal/gefahrstoffe.js) liest dieselben Tabellen weiter. Bereich = einheit_ids (Organisationsstruktur).
   Rechenkern: ../portal/emkg-kern.js (window.EMKG); BA: Viewer gs:/gsg: (gs-ba-bauen.js).
   Freigabe der Beurteilung nur durch die GF (Trigger portal_gefahrstoff_gbu_geaendert), Fachkraft legt vor. */
"use strict";

const AS_GS = { f: { q: "", bereich: "", verw: "", signal: "", stand: "" }, rows: [], gbu: [], pa: [], docs: [], oeffnen: null };
const AS_GS_VERW = { aktiv: "in Verwendung", offen: "Verwendung klären", inaktiv: "nicht mehr verwendet" };
const AS_GS_SDB_JAHRE = 2;   // betriebliche Prüfregel (references/gefahrstoffe/gefahrstoffe.md), keine gesetzliche Frist
const AS_GS_H = {
  H220: "Extrem entzündbares Gas.", H222: "Extrem entzündbares Aerosol.", H223: "Entzündbares Aerosol.",
  H224: "Flüssigkeit und Dampf extrem entzündbar.", H225: "Flüssigkeit und Dampf leicht entzündbar.", H226: "Flüssigkeit und Dampf entzündbar.",
  H228: "Entzündbarer Feststoff.", H229: "Behälter steht unter Druck: Kann bei Erwärmung bersten.", H280: "Enthält Gas unter Druck; kann bei Erwärmung explodieren.",
  H290: "Kann gegenüber Metallen korrosiv sein.", H301: "Giftig bei Verschlucken.", H302: "Gesundheitsschädlich bei Verschlucken.",
  H304: "Kann bei Verschlucken und Eindringen in die Atemwege tödlich sein.", H311: "Giftig bei Hautkontakt.", H312: "Gesundheitsschädlich bei Hautkontakt.",
  H314: "Verursacht schwere Verätzungen der Haut und schwere Augenschäden.", H315: "Verursacht Hautreizungen.", H317: "Kann allergische Hautreaktionen verursachen.",
  H318: "Verursacht schwere Augenschäden.", H319: "Verursacht schwere Augenreizung.", H331: "Giftig bei Einatmen.", H332: "Gesundheitsschädlich bei Einatmen.",
  H334: "Kann bei Einatmen Allergie, asthmaartige Symptome oder Atembeschwerden verursachen.", H335: "Kann die Atemwege reizen.",
  H336: "Kann Schläfrigkeit und Benommenheit verursachen.", H340: "Kann genetische Defekte verursachen.", H341: "Kann vermutlich genetische Defekte verursachen.",
  H350: "Kann Krebs erzeugen.", H351: "Kann vermutlich Krebs erzeugen.", H360: "Kann die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen.",
  H361: "Kann vermutlich die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen.", H370: "Schädigt die Organe.", H371: "Kann die Organe schädigen.",
  H372: "Schädigt die Organe bei längerer oder wiederholter Exposition.", H373: "Kann die Organe schädigen bei längerer oder wiederholter Exposition.",
  H400: "Sehr giftig für Wasserorganismen.", H410: "Sehr giftig für Wasserorganismen mit langfristiger Wirkung.",
  H411: "Giftig für Wasserorganismen, mit langfristiger Wirkung.", H412: "Schädlich für Wasserorganismen, mit langfristiger Wirkung.",
  H413: "Kann für Wasserorganismen schädlich sein, mit langfristiger Wirkung." };
/* GHS-Piktogramme aus H-Sätzen (CLP Anhang I, Vorrang nach Art. 26) – gleiche Regeln wie V1 und gs-ba-bauen.js */
const AS_GS_GHS = {
  GHS01: ["H200", "H201", "H202", "H203", "H204", "H240", "H241"],
  GHS02: ["H220", "H221", "H222", "H223", "H224", "H225", "H226", "H228", "H241", "H242", "H250", "H251", "H252", "H260", "H261"],
  GHS03: ["H270", "H271", "H272"], GHS04: ["H280", "H281"], GHS05: ["H290", "H314", "H318"],
  GHS06: ["H300", "H301", "H310", "H311", "H330", "H331"],
  GHS07: ["H302", "H312", "H315", "H317", "H319", "H332", "H335", "H336", "H420"],
  GHS08: ["H304", "H334", "H340", "H341", "H350", "H351", "H360", "H361", "H370", "H371", "H372", "H373"],
  GHS09: ["H400", "H410", "H411"] };
const AS_GS_GHS_NAME = { GHS01: "Explodierende Bombe", GHS02: "Flamme", GHS03: "Flamme über einem Kreis", GHS04: "Gasflasche", GHS05: "Ätzwirkung",
  GHS06: "Totenkopf", GHS07: "Ausrufezeichen", GHS08: "Gesundheitsgefahr", GHS09: "Umwelt" };
const AS_GS_MODULE = [["einatmen", "Einatmen"], ["haut", "Haut"], ["augen", "Augen"], ["brand", "Brand und Explosion"], ["lagern", "Lagern"]];
const AS_GS_STUFE = { 0: "entfällt", 1: "Stufe 1 – Grundmaßnahmen", 2: "Stufe 2 – erweiterte Maßnahmen", 3: "Stufe 3 – geschlossenes System / besondere Maßnahmen", 4: "Stufe 4 – Beratung erforderlich" };
const AS_GS_ART = { "": "keine der genannten (allgemein)", reinigen: "Reinigen (Lappen, Pinsel, Sprühflasche)", streichen_rollen_tauchen: "Streichen, Rollen, Tauchen",
  spritzlackieren: "Spritzlackieren", mischen: "Mischen, Anrühren", wiegen: "Abwiegen", abfuellen_loesemittel: "Abfüllen von Lösemitteln",
  abfuellen_entzuendbar: "Abfüllen entzündbarer Flüssigkeiten", fass_entleeren_pumpe: "Fass entleeren (Pumpe)", fass_entleeren_zapfhahn: "Fass entleeren (Zapfhahn)",
  faesser_befuellen: "Fässer befüllen", trocknen: "Trocknen", filterwechsel: "Filterwechsel", saecke_entleeren: "Säcke entleeren", saecke_befuellen: "Säcke befüllen",
  kessel_beschicken: "Kessel beschicken", foerderband: "Förderband", pulverbeschichten: "Pulverbeschichten", pulverflaschen_befuellen: "Pulverflaschen befüllen",
  pellets_herstellen: "Pellets herstellen", ibc_befuellen: "IBC befüllen", ibc_entleeren: "IBC entleeren", umpumpen: "Umpumpen", glovebox: "Glovebox", tankfahrzeug: "Tankfahrzeug" };
const AS_GS_FEHLT = { "taetigkeit.menge": "Menge je Tätigkeit", "taetigkeit.wirkflaeche": "Hautkontakt (Fläche)", "taetigkeit.wirkdauer": "Dauer des Hautkontakts",
  "taetigkeit.lagermenge_kg": "Lagermenge", "stoff.aggregat": "Aggregatzustand", "stoff.siedepunkt_c": "Siedebeginn oder Dampfdruck", "stoff.h_saetze": "H-Sätze" };

/* ---------------- Daten ---------------- */
async function asGsLaden(){
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde), hole = p => apiGet(p + k).then(r => Array.isArray(r) ? r : []).catch(() => []);
  const [rows, gbu, pa, docs] = await Promise.all([
    hole("/rest/v1/portal_gefahrstoff?select=*&order=bezeichnung.asc"),
    hole("/rest/v1/portal_gefahrstoff_gbu?select=*&order=erstellt_am.asc"),
    hole("/rest/v1/portal_pruefauftrag?select=id,objekt_typ,objekt_id,anlaesse,faellig_am&erledigt_am=is.null&objekt_typ=in.(gs_gbu,gs_ba)"),
    hole("/rest/v1/portal_dokumente?select=id,titel,storage_path,doc_typ,kategorie&kategorie=eq.gefahrstoffe&order=titel.asc")]);
  Object.assign(AS_GS, { rows, gbu, pa, docs });
}
function asGsVerw(g){ return Object.prototype.hasOwnProperty.call(AS_GS_VERW, g.verwendung_status) ? g.verwendung_status : (g.aktiv === false ? "inaktiv" : "aktiv"); }
function asGsGbus(g){ return AS_GS.gbu.filter(r => r.gefahrstoff_id === g.id && r.status !== "ueberholt"); }
function asGsGbuFrei(g){ return asGsGbus(g).some(r => r.status === "freigegeben"); }
function asGsGbuDa(g){ return !!g.gbu_pfad || asGsGbuFrei(g); }
/* BA gilt als vorhanden: hochgeladene BA, Gruppen-BA oder die aus der freigegebenen Beurteilung erzeugte BA (Durchlauf 15.10.2026) */
function asGsBaDa(g){ return !!g.ba_pfad || !!g.ba_gruppe || asGsGbuFrei(g); }
function asGsPa(typ, id){ return AS_GS.pa.find(p => p.objekt_typ === typ && p.objekt_id === String(id)) || null; }
function asGsPruefen(g){ return !!asGsPa("gs_ba", g.id) || asGsGbus(g).some(x => asGsPa("gs_gbu", x.id)); }
function asGsSdb(g){
  if(!g.sdb_pfad) return { farbe: "rot", kurz: "SDB fehlt", text: "Sicherheitsdatenblatt fehlt – beim Lieferanten anfordern." };
  const bezug = [g.sdb_ausgabe, g.sdb_geprueft_am].filter(Boolean).sort().pop();
  if(!bezug) return { farbe: "gelb", kurz: "SDB-Datum unbekannt", text: "Überarbeitungsdatum des Sicherheitsdatenblatts unbekannt – Fassung prüfen." };
  const grenze = new Date(); grenze.setFullYear(grenze.getFullYear() - AS_GS_SDB_JAHRE);
  const alt = String(bezug) < grenze.toISOString().slice(0, 10);
  const stand = (g.sdb_ausgabe ? "Fassung " + asDat(g.sdb_ausgabe) : "Fassung ohne Datum") + (g.sdb_geprueft_am ? " · geprüft " + asDat(g.sdb_geprueft_am) + (g.sdb_geprueft_von ? " (" + g.sdb_geprueft_von + ")" : "") : "");
  if(alt && g.sdb_angefordert_am) return { farbe: "gelb", kurz: "SDB angefordert", angefordert: true, text: "Aktuelle Fassung am " + asDat(g.sdb_angefordert_am) + " angefordert – vorliegend: " + stand + "." };
  return alt ? { farbe: "gelb", kurz: "SDB veraltet", text: "Sicherheitsdatenblatt älter als " + AS_GS_SDB_JAHRE + " Jahre (" + stand + ") – aktuelle Fassung anfordern." }
    : { farbe: "gruen", kurz: "SDB " + asDat(g.sdb_ausgabe || bezug), text: stand };
}
function asGsPiktos(hs){
  const h = new Set((hs || []).map(x => String(x).toUpperCase().slice(0, 4)));
  const p = Object.keys(AS_GS_GHS).filter(k => k !== "GHS07" && AS_GS_GHS[k].some(x => h.has(x)));
  let g07 = AS_GS_GHS.GHS07.filter(x => h.has(x));
  if(p.includes("GHS06")) g07 = [];
  if(p.includes("GHS05")) g07 = g07.filter(x => x !== "H315" && x !== "H319");
  if(h.has("H334")) g07 = g07.filter(x => !["H315", "H317", "H319"].includes(x));
  if(g07.length) p.push("GHS07");
  return p.sort();
}
function asGsPiktoHtml(hs, gross){
  return asGsPiktos(hs).map(k => `<img class="${gross ? "gs-pikto-g" : "gs-pikto"}" src="../portal/ghs/ghs${k.slice(3)}.png" alt="${esc(k + " " + AS_GS_GHS_NAME[k])}" title="${esc(k + " – " + AS_GS_GHS_NAME[k])}" loading="lazy">`).join("");
}
function asGsBereiche(g){
  const n = (g.einheit_ids || []).map(asBereichName1).filter(Boolean);
  return n.length ? n : (g.bereiche || []);
}
function asGsPflege(){ return !!(AS.fachkraft || AS.gf || AS.admin); }
async function asGsHochladen(datei, ordner){
  const pfad = AS.kunde + "/gefahrstoffe/" + ordner + "/" + Date.now() + "-" + datei.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-");
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad.split("/").map(encodeURIComponent).join("/"), { method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + (await token()), "Content-Type": datei.type || "application/pdf", "x-upsert": "true" }, body: datei });
  if(!r.ok) throw new Error("Datei konnte nicht hochgeladen werden (" + r.status + ")");
  return pfad;
}
function asGsBaUrl(g){
  return g.ba_gruppe
    ? "viewer.html?typ=ba&p=" + encodeURIComponent("gsg:" + AS.kunde + ":" + g.ba_gruppe) + "&mid=" + encodeURIComponent("GSG-" + g.ba_gruppe) + "&t=" + encodeURIComponent(g.ba_gruppe)
    : "viewer.html?typ=ba&p=" + encodeURIComponent("gs:" + AS.kunde + ":" + g.id) + "&mid=" + encodeURIComponent("GS-" + g.id) + "&t=" + encodeURIComponent(g.bezeichnung);
}

function asGsStil(){
  if(document.getElementById("gsStil")) return;
  const s = document.createElement("style"); s.id = "gsStil";
  s.textContent = `.gs-pikto{width:26px;height:26px}.gs-piktos{display:flex;gap:2px;flex-wrap:wrap;justify-content:flex-end;max-width:120px}
.gs-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.gs-gross{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 10px}
.gs-gross figure{margin:0;text-align:center;font-size:11px;color:var(--grau)}.gs-pikto-g{width:64px;height:64px;display:block;margin:0 auto 2px}
.gs-tz{border:1px solid var(--linie);border-radius:10px;padding:8px 10px;margin:6px 0;cursor:pointer}.gs-tz:hover{background:#fafcfe}
.gs-mod{display:inline-block;font-size:12px;font-weight:600;border-radius:12px;padding:2px 8px;margin:2px 3px 0 0;background:#eef1f5;color:#4a5663}
.gs-m1{background:var(--gruen2);color:#1d6b3f}.gs-m2{background:var(--gelb2);color:#8a6200}.gs-m3,.gs-m4{background:var(--rot2);color:#a32f2f}
.gs-erg{border-top:1px solid var(--linie);margin-top:8px;padding-top:6px}.gs-erg ul{margin:4px 0 6px 18px;padding:0;font-size:13px}
.gs-hl{margin:4px 0 0 18px;padding:0;font-size:13px}.gs-abschnitt{margin:14px 0 4px;font-weight:600;color:var(--blau)}
.gs-zeile{display:flex;flex-wrap:wrap;gap:6px;align-items:center}`;
  document.head.appendChild(s);
}

/* ---------------- Liste ---------------- */
async function asGsKataster(box){
  asGsStil();
  box.innerHTML = `<div class="karte"><div class="leer">wird geladen …</div></div>`;
  await asGsLaden();
  asGsListe(box);
  if(AS_GS.oeffnen){ const g = AS_GS.rows.find(x => x.id === AS_GS.oeffnen); AS_GS.oeffnen = null; if(g) asGsStoff(g, box); }
}
function asGsListe(box){
  const f = AS_GS.f, pflege = asGsPflege();
  const genutzt = AS_GS.rows.filter(g => asGsVerw(g) !== "inaktiv");
  const ids = new Set(AS_GS.rows.flatMap(g => g.einheit_ids || []));
  const bereiche = asBereichListe().filter(([e]) => ids.has(e.id));
  const sdbProblem = genutzt.filter(g => asGsSdb(g).farbe !== "gruen" && !asGsSdb(g).angefordert).length;
  const q = f.q.toLowerCase().trim();
  const passt = g => {
    const v = asGsVerw(g);
    if(f.verw === "alle" ? false : f.verw ? v !== f.verw : v === "inaktiv") return false;
    if(f.bereich && !(g.einheit_ids || []).includes(f.bereich)) return false;
    if(f.signal && (f.signal === "ohne" ? !!g.signalwort : g.signalwort !== f.signal)) return false;
    if(f.stand === "sdb" && asGsSdb(g).farbe === "gruen") return false;
    if(f.stand === "gbu" && asGsGbuDa(g)) return false;
    if(f.stand === "ba" && asGsBaDa(g)) return false;
    if(f.stand === "pruefen" && !asGsPruefen(g)) return false;
    if(f.stand === "vorgelegt" && !asGsGbus(g).some(x => x.vorgelegt_am && x.status !== "freigegeben")) return false;
    if(q && ![g.bezeichnung, g.hersteller, g.artikelnummer, g.verwendung, (g.h_saetze || []).join(" "), asGsBereiche(g).join(" ")].join(" ").toLowerCase().includes(q)) return false;
    return true;
  };
  const sicht = AS_GS.rows.filter(passt);
  const zeile = g => {
    const s = asGsSdb(g), v = asGsVerw(g), gb = asGsGbus(g), vorgelegt = gb.some(x => x.vorgelegt_am && x.status !== "freigegeben");
    const chips = [g.signalwort ? asChip(g.signalwort, g.signalwort === "Gefahr" ? "rot" : "gelb") : "",
      v !== "aktiv" ? asChip(AS_GS_VERW[v], v === "offen" ? "gelb" : "grau") : "", asChip(s.kurz, s.farbe),
      asGsGbuFrei(g) ? asChip("GBU freigegeben", "gruen") : vorgelegt ? asChip("GBU zur Freigabe", "gelb") : gb.length ? asChip("GBU Entwurf", "gelb") : g.gbu_pfad ? asChip("GBU (PDF)", "gruen") : asChip("GBU fehlt", "rot"),
      asGsBaDa(g) ? asChip(g.ba_gruppe ? "Gruppen-BA" : "BA", "gruen") : asChip("BA fehlt", "rot"),
      asGsPruefen(g) ? asChip("Überprüfung fällig", "gelb") : ""].join("");
    return `<div class="z" data-gs="${esc(g.id)}"><div><b>${esc(g.bezeichnung)}</b>
      <small>${esc([g.hersteller, asGsBereiche(g).join(", "), g.verwendung].filter(Boolean).join(" · "))}</small><div class="gs-chips">${chips}</div></div>
      <div class="gs-piktos">${asGsPiktoHtml(g.h_saetze)}</div></div>`;
  };
  const sammel = AS_GS.docs.length;
  box.innerHTML = `<div class="karte"><h2>Gefahrstoffverzeichnis <span class="hinweis">${genutzt.length} Stoffe in Verwendung${sdbProblem ? ` · ${sdbProblem} SDB prüfen` : ""}</span>
      <span>${sammel ? `<button class="btn sek klein" id="gsDoks">Unterlagen (${sammel})</button>` : ""}<button class="btn sek klein" id="gsDruck">Verzeichnis drucken</button>
      <button class="btn sek klein" id="gsCsv">CSV</button>${pflege ? `<button class="btn klein" id="gsNeu">+ Stoff</button>` : ""}</span></h2>
    <div class="filterleiste nodruck">
      <input type="search" id="gsQ" placeholder="Suchen (Name, Hersteller, H-Satz …)" value="${esc(f.q)}">
      ${bereiche.length ? asFilterWahl('id="gsBer"', f.bereich, [["", "alle"]].concat(bereiche.map(([e, t]) => [e.id, " ".repeat(t) + e.name])), "Bereich") : ""}
      ${asFilterWahl('id="gsVerw"', f.verw, [["", "in Verwendung + klären"], ["aktiv", "in Verwendung"], ["offen", "klären"], ["inaktiv", "nicht mehr verwendet"], ["alle", "alle Stoffe"]], "Verwendung")}
      ${asFilterWahl('id="gsSig"', f.signal, [["", "alle"], ["Gefahr", "Gefahr"], ["Achtung", "Achtung"], ["ohne", "ohne Signalwort"]], "Einstufung")}
      ${asFilterWahl('id="gsStand"', f.stand, [["", "alle"], ["sdb", "SDB veraltet oder fehlt"], ["gbu", "GBU fehlt"], ["ba", "BA fehlt"], ["vorgelegt", "GBU zur Freigabe"], ["pruefen", "Überprüfung fällig"]], "Unterlagen")}
      <span class="fl-zahl">${sicht.length} ${sicht.length === 1 ? "Stoff" : "Stoffe"}</span></div>
    <div class="zeilen">${sicht.map(zeile).join("") || `<div class="leer">${AS_GS.rows.length ? "Keine Stoffe zum Filter." : "Noch kein Gefahrstoffverzeichnis hinterlegt."}</div>`}</div>
    <p class="hinweis">Verzeichnis nach § 6 Abs. 12 GefStoffV. Piktogramme aus den H-Sätzen abgeleitet – verbindlich sind Etikett und Sicherheitsdatenblatt (Abschnitt 2.2).</p></div>`;
  const neu = () => asGsListe(box);
  const qi = box.querySelector("#gsQ");
  qi.oninput = () => { f.q = qi.value; clearTimeout(AS_GS.t); AS_GS.t = setTimeout(() => { neu(); const n = document.getElementById("gsQ"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 300); };
  [["#gsBer", "bereich"], ["#gsVerw", "verw"], ["#gsSig", "signal"], ["#gsStand", "stand"]].forEach(([id, k]) => { const el = box.querySelector(id); if(el) el.onchange = () => { f[k] = el.value; neu(); }; });
  box.querySelector("#gsDruck").onclick = () => asGsVerzeichnisDrucken(sicht);
  box.querySelector("#gsCsv").onclick = () => asGsCsv(sicht);
  const dk = box.querySelector("#gsDoks"); if(dk) dk.onclick = () => asGsDokumente();
  const nb = box.querySelector("#gsNeu"); if(nb) nb.onclick = () => asGsBearbeiten(null, box);
  box.querySelectorAll("[data-gs]").forEach(z => z.onclick = () => asGsStoff(AS_GS.rows.find(g => g.id === z.dataset.gs), box));
}
async function asGsNeuLaden(box, offen){
  await asGsLaden(); asGsListe(box);
  if(offen){ const g = AS_GS.rows.find(x => x.id === offen); if(g) asGsStoff(g, box); }
}

function asGsDokumente(){
  asDialog({ titel: "Unterlagen Gefahrstoffe", inhalt: `<p class="hinweis">Sammel-Betriebsanweisungen, Hautschutzpläne und weitere Unterlagen. Je Stoff entsteht die Betriebsanweisung aus der freigegebenen Beurteilung – sie steht beim Stoff.</p>
    <div class="zeilen">${AS_GS.docs.map(d => `<div class="z" data-dok="${esc(d.id)}"><div><b>${esc(String(d.titel || "").replace(/^Betriebsanweisung\s*–\s*/, ""))}</b></div><span class="hinweis">öffnen ›</span></div>`).join("")}</div>` });
  document.querySelectorAll("#dlg [data-dok]").forEach(z => z.onclick = () => { const d = AS_GS.docs.find(x => x.id === z.dataset.dok);
    document.getElementById("dlg").close(); asDokOeffnen(asViewerUrl(d.doc_typ || "pdf", d.storage_path, d.titel), d.titel); });
}

/* ---------------- Stoff ansehen ---------------- */
function asGsModChip(t, m){
  const s = m && Number.isInteger(m.stufe) ? m.stufe : null;
  return `<span class="gs-mod ${s ? "gs-m" + s : ""}" title="${esc(t + ": " + (s === null ? "nicht berechenbar – Angaben fehlen" : AS_GS_STUFE[s]))}">${esc(t)} ${s === null ? "?" : s === 0 ? "–" : s}</span>`;
}
function asGsGbuStatus(x){
  if(x.status === "freigegeben") return asChip("freigegeben" + (x.freigegeben_von ? " – " + x.freigegeben_von : "") + (x.freigegeben_am ? " " + asDat(x.freigegeben_am) : ""), "gruen");
  return x.vorgelegt_am ? asChip("der GF vorgelegt " + asDat(x.vorgelegt_am), "gelb") : asChip("Entwurf", "gelb");
}
function asGsStoff(g, box){
  if(!g) return;
  const s = asGsSdb(g), pflege = asGsPflege(), gb = asGsGbus(g), v = asGsVerw(g);
  const paBa = asGsPa("gs_ba", g.id);
  const fld = (l, x) => x ? `<div><span class="hinweis">${esc(l)}</span><div>${esc(x)}</div></div>` : "";
  const gruppe = g.ba_gruppe ? AS_GS.rows.filter(x => x.ba_gruppe === g.ba_gruppe && asGsVerw(x) !== "inaktiv").length : 0;
  const kn = [];
  if(pflege) kn.push({ t: "Stammdaten ändern", klasse: "sek", fn: () => { asGsBearbeiten(g, box); return false; } });
  kn.push({ t: "Schließen", fn: () => {} });
  asDialog({ titel: g.bezeichnung, breit: true, knoepfe: kn, inhalt: `
    <p class="hinweis">${esc([g.hersteller, g.artikelnummer ? "Art.-Nr. " + g.artikelnummer : ""].filter(Boolean).join(" · "))}</p>
    ${asGsPiktos(g.h_saetze).length ? `<div class="gs-gross">${asGsPiktos(g.h_saetze).map(k => `<figure><img class="gs-pikto-g" src="../portal/ghs/ghs${k.slice(3)}.png" alt="${esc(k)}">${esc(AS_GS_GHS_NAME[k])}</figure>`).join("")}</div>` : ""}
    <div class="gs-zeile">${g.signalwort ? asChip("Signalwort: " + g.signalwort, g.signalwort === "Gefahr" ? "rot" : "gelb") : ""}${asChip(AS_GS_VERW[v], v === "aktiv" ? "gruen" : v === "offen" ? "gelb" : "grau")}</div>
    ${v === "offen" && g.hinweis ? `<p class="hinweis">${esc(g.hinweis)}</p>` : ""}
    <div class="form">${fld("Bereiche", asGsBereiche(g).join(", "))}${fld("Verwendung", g.verwendung)}${fld("Gebinde", g.gebinde)}${fld("Menge", g.menge)}${fld("Lagerort", g.lagerort)}${v !== "offen" ? fld("Hinweis", g.hinweis) : ""}</div>

    <div class="gs-abschnitt">Sicherheitsdatenblatt</div>
    <div class="gs-zeile">${asChip(s.kurz, s.farbe)}<span class="hinweis">${esc(s.text)}</span></div>
    <div class="gs-zeile" style="margin-top:6px">${g.sdb_pfad ? `<button class="btn sek klein" id="gsSdbAuf">Öffnen</button>` : ""}
      ${pflege && g.sdb_pfad && s.farbe !== "gruen" ? `<button class="btn sek klein" id="gsSdbOk">Beim Lieferanten nachgefragt – aktuell</button>` : ""}
      ${pflege && s.farbe !== "gruen" && !g.sdb_angefordert_am ? `<button class="btn sek klein" id="gsSdbAnf">Als angefordert vermerken</button>` : ""}
      ${pflege ? `<button class="btn sek klein" id="gsSdbNeu">Neue Fassung hochladen</button>` : ""}</div>

    <div class="gs-abschnitt">Gefährdungsbeurteilung (EMKG je Tätigkeit)</div>
    ${gb.map(x => { const e = (x.ergebnis && x.ergebnis.module) || {}, p = asGsPa("gs_gbu", x.id);
      return `<div class="gs-tz" data-gbu="${esc(x.id)}"><div class="gs-zeile"><b>${esc(x.taetigkeit)}</b>${x.arbeitsbereich ? `<span class="hinweis">${esc(x.arbeitsbereich)}</span>` : ""}${asGsGbuStatus(x)}
        ${p ? asChip("prüfen bis " + asDat(p.faellig_am), "gelb") : ""}</div><div>${AS_GS_MODULE.map(([k, t]) => asGsModChip(t, e[k])).join("")}</div></div>`; }).join("")
      || `<p class="hinweis">Noch keine Tätigkeit nach EMKG beurteilt.</p>`}
    ${g.gbu_pfad ? `<button class="btn sek klein" id="gsGbuPdf">Gefährdungsbeurteilung (PDF)</button>` : ""}
    ${pflege ? `<button class="btn klein" id="gsTzNeu">+ Tätigkeit beurteilen (EMKG)</button>` : ""}

    <div class="gs-abschnitt">Betriebsanweisung</div>
    ${paBa ? `<p class="hinweis">Überprüfung fällig bis ${asDat(paBa.faellig_am)}: ${esc((paBa.anlaesse || []).map(a => a.text).join(" · "))}</p>` : ""}
    <div class="gs-zeile">${g.ba_pfad ? `<button class="btn sek klein" id="gsBaPdf">Betriebsanweisung (PDF)</button>` : ""}
      ${!g.ba_pfad ? `<button class="btn sek klein" id="gsBaAuf">${g.ba_gruppe ? "Gruppen-BA: " + esc(g.ba_gruppe) + " (" + gruppe + " Stoffe)" : asGsGbuFrei(g) ? "Betriebsanweisung (aus der Beurteilung)" : "Betriebsanweisung – Entwurf"}</button>` : ""}
      ${!asGsGbuFrei(g) && !g.ba_pfad && !g.ba_gruppe ? `<span class="hinweis">Entwurf, bis eine Beurteilung freigegeben ist.</span>` : ""}</div>

    <div class="gs-abschnitt">Schutzhandschuh</div>
    <div class="gs-zeile"><span>${esc({ passt: "geeignet zugeordnet", spritzschutz: "nur Spritzschutz", fehlt: "passender Handschuh fehlt", nicht_noetig: "kein Schutzhandschuh nötig" }[g.handschuh_status] || "noch nicht zugeordnet")}</span>
      <button class="btn sek klein" id="gsHs">Handschuhplan</button></div>
    ${g.handschuh_sdb ? `<p class="hinweis">SDB 8.2: ${esc(g.handschuh_sdb)}</p>` : ""}

    ${(g.h_saetze || []).length ? `<div class="gs-abschnitt">Gefahrenhinweise</div><ul class="gs-hl">${g.h_saetze.map(h => `<li><b>${esc(h)}</b> ${esc(AS_GS_H[h] || "")}</li>`).join("")}</ul>` : ""}` });
  const d = document.getElementById("dlg"), q = sel => d.querySelector(sel);
  const auf = (sel, fn) => { const el = q(sel); if(el) el.onclick = fn; };
  auf("#gsSdbAuf", () => { d.close(); asDokOeffnen(asViewerUrl("pdf", g.sdb_pfad, "Sicherheitsdatenblatt · " + g.bezeichnung), "Sicherheitsdatenblatt · " + g.bezeichnung); });
  auf("#gsGbuPdf", () => { d.close(); asDokOeffnen(asViewerUrl("pdf", g.gbu_pfad, "Gefährdungsbeurteilung · " + g.bezeichnung), "Gefährdungsbeurteilung · " + g.bezeichnung); });
  auf("#gsBaPdf", () => { d.close(); asDokOeffnen(asViewerUrl("pdf", g.ba_pfad, "Betriebsanweisung · " + g.bezeichnung), "Betriebsanweisung · " + g.bezeichnung); });
  auf("#gsBaAuf", () => { d.close(); asDokOeffnen(asGsBaUrl(g), "Betriebsanweisung · " + (g.ba_gruppe || g.bezeichnung)); });
  auf("#gsHs", () => { d.close(); asGehe("gefahrstoffe/handschuhe"); });
  auf("#gsTzNeu", () => asGsEmkg(g, null, box));
  auf("#gsSdbNeu", () => asGsBearbeiten(g, box, true));
  auf("#gsSdbOk", async () => {
    if(!confirm("Beim Lieferanten nachgefragt – es gibt keine neuere Fassung?")) return;
    await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), { sdb_geprueft_am: asHeute(), sdb_geprueft_von: AS.ich, quelle: "portal",
      geaendert_von: AS.ich, geaendert_am: new Date().toISOString() }, "return=minimal");
    asMeldung("Vermerkt"); asGsNeuLaden(box, g.id); });
  auf("#gsSdbAnf", async () => {
    const bei = prompt("Bei wem angefordert? (Lieferant, Ansprechpartner)", g.hersteller || ""); if(bei === null) return;
    await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), { sdb_angefordert_am: asHeute(), sdb_angefordert_bei: bei.trim() || null,
      geaendert_von: AS.ich, geaendert_am: new Date().toISOString() }, "return=minimal");
    asMeldung("Anforderung vermerkt"); asGsNeuLaden(box, g.id); });
  d.querySelectorAll("[data-gbu]").forEach(el => el.onclick = () => asGsEmkg(g, AS_GS.gbu.find(x => x.id === el.dataset.gbu), box));
}

/* ---------------- Stammdaten ---------------- */
function asGsBearbeiten(g, box, sdbFokus){
  const neu = !g; g = g || { verwendung_status: "aktiv", einheit_ids: asBereichStandard() ? [asBereichStandard()] : [] };
  const bereiche = asBereichListe();
  const gruppen = [...new Set(AS_GS.rows.map(x => x.ba_gruppe).filter(Boolean))].sort();
  asDialog({ titel: neu ? "Gefahrstoff aufnehmen" : "Gefahrstoff ändern", breit: true, inhalt: `<div class="form">
    ${asFeld("Bezeichnung (Handelsname)", "bezeichnung", g.bezeichnung, "text", "voll")}
    ${asFeld("Hersteller / Lieferant", "hersteller", g.hersteller)}${asFeld("Artikelnummer", "artikelnummer", g.artikelnummer)}
    ${asAuswahl("Signalwort", "signalwort", g.signalwort || "", [["", "–"], ["Gefahr", "Gefahr"], ["Achtung", "Achtung"]])}
    ${asFeld("H-/EUH-Sätze (mit Leerzeichen getrennt)", "h_text", (g.h_saetze || []).join(" "))}
    <div class="voll"><b>Bereiche, in denen der Stoff verwendet wird</b><div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">
      ${bereiche.map(([e, t]) => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-gsb="${esc(e.id)}" ${(g.einheit_ids || []).includes(e.id) ? "checked" : ""}> ${esc(" ".repeat(t) + e.name)}</label>`).join("")
        || `<span class="hinweis">Noch keine Bereiche angelegt (Organisation → Struktur).</span>`}</div></div>
    ${asFeld("Verwendung (wofür)", "verwendung", g.verwendung, "text", "voll")}
    ${asFeld("Gebinde (z. B. 500 ml Spraydose)", "gebinde", g.gebinde)}${asFeld("Menge pro Jahr", "menge", g.menge)}
    ${asFeld("Lagerort", "lagerort", g.lagerort)}
    ${asAuswahl("Verwendung", "verwendung_status", asGsVerw(g), Object.entries(AS_GS_VERW))}
    <div class="voll" id="gsSdbFeld"><b>Sicherheitsdatenblatt</b>${g.sdb_pfad ? ` <span class="hinweis">vorhanden – eine neue Datei ersetzt es</span>` : ""}
      <label style="margin-top:4px">PDF<input type="file" id="gsSdbDatei" accept=".pdf"></label></div>
    ${asFeld("Überarbeitungsdatum des SDB (Seite 1)", "sdb_ausgabe", g.sdb_ausgabe, "date")}
    <label>BA-Gruppe (gleiche Gruppe = gemeinsame BA, leer = eigene)<input type="text" data-f="ba_gruppe" list="gsGruppen" value="${esc(g.ba_gruppe || "")}"></label>
    <datalist id="gsGruppen">${gruppen.map(x => `<option value="${esc(x)}">`).join("")}</datalist>
    ${asFeld("Hinweis", "hinweis", g.hinweis, "text", "voll")}
    <details class="voll"><summary>Vorhandene Dokumente als PDF hochladen (statt aus dem Cockpit)</summary>
      <label>Gefährdungsbeurteilung (PDF)${g.gbu_pfad ? " – vorhanden" : ""}<input type="file" id="gsGbuDatei" accept=".pdf"></label>
      <label>Betriebsanweisung (PDF)${g.ba_pfad ? " – vorhanden" : ""}<input type="file" id="gsBaDatei" accept=".pdf"></label></details></div>`,
    knoepfe: [{ t: "Speichern", fn: async dl => {
      const w = asWerte(dl);
      if(!w.bezeichnung || w.bezeichnung.length < 2){ asMeldung("Bitte die Bezeichnung eintragen"); return false; }
      const ein = [...dl.querySelectorAll("[data-gsb]:checked")].map(x => x.dataset.gsb);
      if(AS.bereich.fest && !ein.length){ asMeldung("Bitte mindestens einen Ihrer Bereiche wählen"); return false; }
      const datei = id => (dl.querySelector(id).files || [])[0];
      const sdb = datei("#gsSdbDatei"), gbu = datei("#gsGbuDatei"), ba = datei("#gsBaDatei");
      if([sdb, gbu, ba].some(x => x && !/\.pdf$/i.test(x.name))){ asMeldung("Bitte nur PDF-Dateien wählen"); return false; }
      if(sdb && !w.sdb_ausgabe){ asMeldung("Bitte das Überarbeitungsdatum des neuen SDB eintragen"); return false; }
      /* EUH zuerst erkennen – sonst wird aus „EUH066“ ein „H066“; Kleinbuchstaben (H360Df) bleiben */
      const h = [...new Set(String(w.h_text || "").match(/EUH\d{3}A?|H\d{3}[A-Za-z]{0,2}/gi) || [])].map(x => /^euh/i.test(x) ? x.toUpperCase() : "H" + x.slice(1)).sort();
      delete w.h_text;
      const daten = Object.assign(w, { h_saetze: h, einheit_ids: ein, aktiv: w.verwendung_status !== "inaktiv", quelle: "portal", geaendert_von: AS.ich, geaendert_am: new Date().toISOString() });
      if(sdb){ asMeldung("SDB wird hochgeladen …"); daten.sdb_pfad = await asGsHochladen(sdb, "sdb");
        Object.assign(daten, { sdb_geprueft_am: null, sdb_geprueft_von: null, sdb_angefordert_am: null, sdb_angefordert_bei: null }); }
      if(gbu) daten.gbu_pfad = await asGsHochladen(gbu, "gbu");
      if(ba) daten.ba_pfad = await asGsHochladen(ba, "ba-stoff");
      if(neu){
        const r = await apiSend("POST", "/rest/v1/portal_gefahrstoff", Object.assign({ kunde_slug: AS.kunde }, daten), "return=representation");
        await asGsLaden(); asGsListe(box);
        const n = r && r[0] && AS_GS.rows.find(x => x.id === r[0].id);
        asMeldung("Aufgenommen – jetzt die erste Tätigkeit beurteilen");
        if(n){ asGsEmkg(n, null, box); return false; }
        return;
      }
      await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), daten, "return=minimal");
      asMeldung("Gespeichert"); await asGsNeuLaden(box, g.id); return false;
    } }] });
  if(sdbFokus){ const f = document.getElementById("gsSdbFeld"); if(f) f.scrollIntoView({ block: "center" }); }
}

/* ---------------- EMKG je Tätigkeit ---------------- */
/* sdb_daten ({feld:{wert,abschnitt,…}}) → Stoffobjekt für EMKG.bewerten; Spraydosen = flüssig + versprüht (wie V1) */
function asGsStoffEmkg(g){
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
function asGsSpray(g){ const d = g.sdb_daten || {}; return (d.aggregat && d.aggregat.wert === "aerosol") || (g.h_saetze || []).some(h => h === "H222" || h === "H229"); }
function asGsErgebnisHtml(r){
  const mod = ([k, t]) => { const m = r.module[k] || {}, s = m.stufe;
    const fehl = [...new Set((m.fehlend || []).map(f => AS_GS_FEHLT[f] || AS_GS_FEHLT[f.split(":")[0]] || f))];
    return `<div style="margin:6px 0">${asGsModChip(t, m)} <span>${s === null || s === undefined ? "nicht berechenbar" : esc(AS_GS_STUFE[s])}${m.gruppe ? " · Gruppe " + esc(m.gruppe) : ""}</span>
      ${fehl.length ? `<div class="hinweis">Fehlt: ${esc(fehl.join(", "))}</div>` : ""}
      ${(m.schutzleitfaeden || []).length ? `<details><summary class="hinweis">Schutzleitfäden (${m.schutzleitfaeden.length})</summary><ul>${m.schutzleitfaeden.map(x => `<li><b>${esc(x.nr)}</b> ${esc(x.titel)}</li>`).join("")}</ul></details>` : ""}
      ${(m.massnahmenHinweise || []).length ? `<ul>${m.massnahmenHinweise.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}</div>`; };
  return `<b>Ergebnis</b>${AS_GS_MODULE.map(mod).join("")}
    ${r.mutterschutz ? `<p class="hinweis"><b>Mutterschutz beachten:</b> ${esc((r.mutterschutzSaetze || []).join(", "))}</p>` : ""}
    ${(r.hinweise || []).length ? `<details><summary class="hinweis">Hinweise (${r.hinweise.length})</summary><ul>${r.hinweise.map(h => `<li>${esc(h)}</li>`).join("")}</ul></details>` : ""}
    <p class="hinweis">Berechnet mit EMKG-Kern ${esc(r.version)} nach BAuA-Leitfaden 2.2, Leitfaden Brand und Explosion 2020.</p>`;
}
function asGsEmkg(g, gbu, box){
  if(typeof EMKG === "undefined"){ asMeldung("Rechenkern EMKG nicht geladen"); return; }
  const e = (gbu && gbu.eingaben) || {}, spray = asGsSpray(g), pflege = asGsPflege();
  const sd = g.sdb_daten || {}, roh = k => sd[k] && sd[k].wert != null ? sd[k].wert : "";
  const ja = (v, std) => (v === undefined ? std : v) ? " checked" : "";
  const radio = (name, wert, akt, text) => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="radio" name="${name}" value="${wert}"${akt === wert ? " checked" : ""}> ${text}</label>`;
  const box2 = (id, text, an) => `<label class="voll" style="flex-direction:row;gap:8px;align-items:center"><input type="checkbox" id="${id}"${an}> ${text}</label>`;
  const opt = (liste, akt) => liste.map(([k, t]) => `<option value="${esc(k)}"${String(akt) === String(k) ? " selected" : ""}>${esc(t)}</option>`).join("");
  const haut = e.hautkontakt_ausgeschlossen ? "aus" : (e.wirkflaeche || ""), mg = e.menge || {};
  const pa = gbu && asGsPa("gs_gbu", gbu.id);
  const bereichStd = gbu ? gbu.arbeitsbereich || "" : asGsBereiche(g)[0] || "";
  const reihe = inhalt => `<div class="voll" style="display:flex;flex-wrap:wrap;gap:4px 14px">${inhalt}</div>`;
  const kn = [];
  if(gbu && AS.admin) kn.push({ t: "Löschen", klasse: "gefahr", fn: async () => {
    if(!confirm("Diese Tätigkeit samt Beurteilung löschen?")) return false;
    await apiSend("DELETE", "/rest/v1/portal_gefahrstoff_gbu?id=eq." + encodeURIComponent(gbu.id), null, "return=minimal");
    await asGsNeuLaden(box, g.id); return false; } });
  if(gbu) kn.push({ t: "Drucken", klasse: "sek", fn: () => { const r = rechnen(); if(r) asGsGbuDrucken(g, gbu, eingaben(), r); return false; } });
  if(pflege){
    kn.push({ t: "Als Entwurf speichern", klasse: "sek", fn: () => speichern("entwurf") });
    if(AS.gf) kn.push({ t: "Speichern und freigeben", fn: () => speichern("freigegeben") });
    else kn.push({ t: "Der GF zur Freigabe vorlegen", fn: () => speichern("vorlegen") });
  }
  asDialog({ titel: "Beurteilung nach EMKG: " + g.bezeichnung, breit: true, knoepfe: kn, inhalt: `
    ${pa ? `<p class="hinweis"><b>Überprüfung fällig:</b> ${esc((pa.anlaesse || []).map(a => a.text).join(" · "))} – Angaben prüfen und neu freigeben.</p>` : ""}
    ${gbu ? `<div class="gs-zeile">${asGsGbuStatus(gbu)}</div>` : ""}
    <p class="hinweis">${esc((g.h_saetze || []).join(" ") || "keine H-Sätze")} – je Tätigkeit eine Beurteilung. Die Maßnahmen ergeben sich aus den Angaben und stehen laufend unten.</p>
    <div class="form">
      <label class="voll">Was wird gemacht?<input type="text" id="eT" maxlength="200" value="${esc(gbu ? gbu.taetigkeit : "")}" placeholder="z. B. Werkzeug reinigen mit Lappen"></label>
      <label>Bereich<input type="text" id="eB" list="eBListe" maxlength="120" value="${esc(bereichStd)}"></label>
      <datalist id="eBListe">${asBereichListe().map(([x]) => `<option value="${esc(x.name)}">`).join("")}</datalist>
      <label>Art der Tätigkeit<select id="eArt">${opt(Object.entries(AS_GS_ART), e.taetigkeitsart || "")}</select></label>
      <label>Menge je Tätigkeit bzw. Schicht (nicht der Vorrat)<input type="number" id="eMw" min="0" step="any" value="${esc(mg.wert != null ? mg.wert : "")}"></label>
      <label>Einheit<select id="eMe">${opt(["ml", "l", "m³", "g", "kg", "t"].map(x => [x, x]), mg.einheit || (spray ? "ml" : "l"))}</select></label>
      <label>Dauer pro Tag in Minuten (alle Zeiten zusammen)<input type="number" id="eD" min="0" step="1" value="${esc(e.dauer_min_tag != null ? e.dauer_min_tag : "")}"></label>
      <label>Verarbeitungstemperatur in °C<input type="number" id="eTemp" step="1" value="${esc(e.verarbeitungstemp_c != null ? e.verarbeitungstemp_c : 20)}"></label>
      ${box2("eGross", "großflächig (Streichen, Reinigen von Flächen) – dann Menge pro Arbeitstag", ja(e.grossflaechig, false))}
      ${box2("eSpr", "wird versprüht (Spraydose, Sprühflasche, Spritzpistole)", ja(e.versprueht, spray))}
      <div class="voll"><b>Hautkontakt</b> <span class="hinweis">(so, als würden keine Handschuhe getragen)</span></div>
      ${reihe(radio("eH", "aus", haut, "technisch ausgeschlossen") + radio("eH", "klein", haut, "Spritzer, kleinflächig") + radio("eH", "gross", haut, "großflächig (ganze Hand)"))}
      ${reihe("Dauer: " + radio("eHd", "kurz", e.wirkdauer || "", "unter 15 min/Tag") + radio("eHd", "lang", e.wirkdauer || "", "über 15 min/Tag"))}
      ${reihe("Betroffen: " + [["haende", "Hände/Arme"], ["gesicht", "Gesicht/Augen"], ["rumpf", "Rumpf"], ["fuesse", "Füße/Beine"]].map(([k, t]) =>
        `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" class="eK" value="${k}"${(e.koerperstellen || ["haende"]).includes(k) ? " checked" : ""}> ${t}</label>`).join(""))}
      ${box2("eFeucht", "Feuchtarbeit (über 2 h/Tag nass oder über 15× Händewaschen)", ja(e.feuchtarbeit, false))}
      <label>Lüftung<select id="eL">${opt([["normal", "normale Raumlüftung"], ["absaugung", "Absaugung am Arbeitsplatz vorhanden"], ["gering", "schlecht belüftet"], ["keine", "keine Lüftung"]], e.raumlueftung || "normal")}</select></label>
      <label>Lagermenge am Lagerort in kg bzw. l (Modul Lagern)<input type="number" id="eLag" min="0" step="any" value="${esc(e.lagermenge_kg != null ? e.lagermenge_kg : "")}"></label>
      ${box2("eEng", "Arbeiten in Behältern, Tanks, Gruben, engen Räumen", ja(e.enge_raeume, false))}
      ${box2("eFeuer", "ständige Feuerarbeiten in der Nähe (fester Schweißplatz)", ja(e.feuerarbeiten_dauerhaft, false))}
      ${box2("eMess", "Arbeitsplatzmessung zeigt Einhaltung des Grenzwerts", ja(e.mit_messung, false))}
      <details class="voll"${!roh("aggregat") || (!roh("siedepunkt_c") && !roh("dampfdruck_hpa") && !spray) ? " open" : ""}><summary>Stoffdaten aus dem Sicherheitsdatenblatt (Abschnitt 9.1)</summary>
        <div class="form"><label>Aggregatzustand<select id="eAgg">${opt([["", "–"], ["fluessig", "flüssig"], ["aerosol", "Spraydose (Aerosol)"], ["fest", "fest"], ["gas", "Gas"]], roh("aggregat"))}</select></label>
        <label>Siedebeginn °C<input type="number" id="eSdp" step="any" value="${esc(roh("siedepunkt_c"))}"></label>
        <label>Dampfdruck hPa (20 °C)<input type="number" id="eDd" step="any" value="${esc(roh("dampfdruck_hpa"))}"></label>
        <label>Flammpunkt °C<input type="number" id="eFp" step="any" value="${esc(roh("flammpunkt_c"))}"></label></div>
        <p class="hinweis">Geänderte Werte werden beim Stoff gespeichert und gelten für alle Tätigkeiten.</p></details>
    </div><div id="eErg" class="gs-erg"></div>` });
  const d = document.getElementById("dlg"), q = s => d.querySelector(s), zahl = s => { const v = q(s).value; return v === "" ? undefined : Number(v); };
  const stoffNeu = () => {
    const sdn = Object.assign({}, g.sdb_daten || {}), setz = (k, v) => {
      const alt = sdn[k] && sdn[k].wert != null ? sdn[k].wert : "";
      if(String(alt) === String(v === undefined ? "" : v)) return;
      sdn[k] = { wert: v === "" || v === undefined ? null : v, abschnitt: "9.1", sicher: true, quelle: "Cockpit", geaendert_am: asHeute() };
    };
    setz("aggregat", q("#eAgg").value); setz("siedepunkt_c", zahl("#eSdp")); setz("dampfdruck_hpa", zahl("#eDd")); setz("flammpunkt_c", zahl("#eFp"));
    return sdn;
  };
  const eingaben = () => {
    const h = (d.querySelector('input[name="eH"]:checked') || {}).value || "", hd = (d.querySelector('input[name="eHd"]:checked') || {}).value;
    const t = { menge: zahl("#eMw") !== undefined ? { wert: zahl("#eMw"), einheit: q("#eMe").value } : undefined,
      dauer_min_tag: zahl("#eD"), grossflaechig: q("#eGross").checked, versprueht: q("#eSpr").checked,
      verarbeitungstemp_c: zahl("#eTemp") === undefined ? 20 : zahl("#eTemp"),
      hautkontakt_ausgeschlossen: h === "aus", wirkflaeche: h === "klein" || h === "gross" ? h : undefined, wirkdauer: hd,
      koerperstellen: [...d.querySelectorAll(".eK:checked")].map(x => x.value), feuchtarbeit: q("#eFeucht").checked,
      raumlueftung: q("#eL").value, enge_raeume: q("#eEng").checked, feuerarbeiten_dauerhaft: q("#eFeuer").checked,
      mit_messung: q("#eMess").checked, lagermenge_kg: zahl("#eLag"), taetigkeitsart: q("#eArt").value || undefined };
    Object.keys(t).forEach(k => t[k] === undefined && delete t[k]);
    return t;
  };
  function rechnen(){
    const erg = q("#eErg"); if(!erg) return null;
    let r; try{ r = EMKG.bewerten(asGsStoffEmkg(Object.assign({}, g, { sdb_daten: stoffNeu() })), eingaben()); }
    catch(err){ erg.innerHTML = `<p class="hinweis">Bewertung nicht möglich: ${esc(err.message || err)}</p>`; return null; }
    erg.innerHTML = asGsErgebnisHtml(r); return r;
  }
  async function speichern(art){
    const taet = q("#eT").value.trim();
    if(taet.length < 3){ asMeldung("Bitte die Tätigkeit beschreiben"); return false; }
    const r = rechnen(); if(!r){ asMeldung("Bewertung nicht möglich – Angaben prüfen"); return false; }
    if(art !== "entwurf" && r.fehlend.length && !confirm("Es fehlen noch Angaben (" + r.fehlend.length + "). Trotzdem " + (art === "freigegeben" ? "freigeben" : "vorlegen") + "?")) return false;
    const sdn = stoffNeu();
    if(JSON.stringify(sdn) !== JSON.stringify(g.sdb_daten || {})){
      await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), { sdb_daten: sdn, geaendert_von: AS.ich, geaendert_am: new Date().toISOString() }, "return=minimal");
      g.sdb_daten = sdn;
    }
    const daten = { taetigkeit: taet, arbeitsbereich: q("#eB").value.trim() || null, eingaben: eingaben(),
      stoffdaten: Object.assign(asGsStoffEmkg(g), { _sdb: { pfad: g.sdb_pfad || null, ausgabe: g.sdb_ausgabe || null } }),
      ergebnis: r, kern_version: r.version, status: art === "freigegeben" ? "freigegeben" : "entwurf",
      vorgelegt_am: art === "vorlegen" ? new Date().toISOString() : null };
    if(gbu) await apiSend("PATCH", "/rest/v1/portal_gefahrstoff_gbu?id=eq." + encodeURIComponent(gbu.id), daten, "return=minimal");
    else await apiSend("POST", "/rest/v1/portal_gefahrstoff_gbu", Object.assign({ kunde_slug: AS.kunde, gefahrstoff_id: g.id }, daten), "return=minimal");
    asMeldung(art === "freigegeben" ? "Freigegeben – Unterweisung ist als Aufgabe angelegt" : art === "vorlegen" ? "Der Geschäftsführung zur Freigabe vorgelegt – sie sieht es in ihren Aufgaben" : "Als Entwurf gespeichert");
    await asGsNeuLaden(box, g.id); return false;
  }
  d.querySelectorAll(".dlg-inhalt input, .dlg-inhalt select").forEach(el => el.addEventListener(el.type === "number" || el.type === "text" ? "input" : "change", rechnen));
  rechnen();
}

/* ---------------- Druck / Export ---------------- */
function asGsDruckSeite(titel, inhalt){
  let f = document.getElementById("gsDruckRahmen");
  if(f) f.remove();
  f = document.createElement("iframe"); f.id = "gsDruckRahmen"; f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(f);
  const doc = f.contentDocument;
  doc.open(); doc.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title><style>
    @page{size:A4 landscape;margin:12mm}body{font-family:Jost,'Segoe UI',Arial,sans-serif;font-size:10.5px;color:#1a1a1a}
    h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;margin:0 0 2px}h2{font-size:14px;margin:14px 0 4px}h3{font-size:12px;margin:8px 0 2px}
    .leise{color:#667085}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cfd6de;padding:4px 5px;text-align:left;vertical-align:top}
    th{background:#eef1f5}tr{break-inside:avoid}img{width:18px;height:18px}ul{margin:2px 0 2px 16px;padding:0}
    .gs-mod{display:inline-block;border:1px solid #cfd6de;border-radius:10px;padding:0 6px;margin-right:3px}</style></head><body>${inhalt}</body></html>`);
  doc.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); }, 400);
}
function asGsVerzeichnisDrucken(liste){
  const kunde = (AS.kundeV1 && (AS.kundeV1.name || AS.kundeV1.firma)) || AS.kunde;
  const abs = location.href.replace(/portal2\/.*$/, "portal/ghs/");
  asGsDruckSeite("Gefahrstoffverzeichnis", `<h1>Gefahrstoffverzeichnis</h1>
    <p class="leise">${esc(kunde)} · Stand ${asDat(asHeute())} · nach § 6 Abs. 12 GefStoffV${AS_GS.f.bereich ? " · Bereich " + esc(asBereichName1(AS_GS.f.bereich)) : ""} · ${liste.length} Stoffe</p>
    <table><thead><tr><th>Nr.</th><th>Bezeichnung / Hersteller</th><th>Einstufung</th><th>H-/EUH-Sätze</th><th>Arbeitsbereiche</th><th>Verwendung</th><th>Menge / Gebinde</th><th>Lagerort</th><th>Sicherheitsdatenblatt</th><th>GBU</th><th>BA</th></tr></thead>
    <tbody>${liste.map((g, i) => `<tr><td>${i + 1}</td><td><b>${esc(g.bezeichnung)}</b><br>${esc(g.hersteller || "")}${asGsVerw(g) !== "aktiv" ? `<br><i>${esc(AS_GS_VERW[asGsVerw(g)])}</i>` : ""}</td>
      <td>${asGsPiktos(g.h_saetze).map(k => `<img src="${abs}ghs${k.slice(3)}.png" alt="${k}">`).join("")}<br>${esc(g.signalwort || "")}</td>
      <td>${esc((g.h_saetze || []).join(" "))}</td><td>${esc(asGsBereiche(g).join(", "))}</td><td>${esc(g.verwendung || "")}</td>
      <td>${esc([g.menge, g.gebinde].filter(Boolean).join(" · "))}</td><td>${esc(g.lagerort || "")}</td><td>${esc(asGsSdb(g).kurz)}</td>
      <td>${asGsGbuFrei(g) || g.gbu_pfad ? "ja" : "fehlt"}</td><td>${asGsBaDa(g) ? (g.ba_gruppe ? "Gruppe " + esc(g.ba_gruppe) : "ja") : "fehlt"}</td></tr>`).join("")}</tbody></table>
    <p class="leise">Die Sicherheitsdatenblätter sind im EHS-Cockpit hinterlegt und dort jederzeit zugänglich. Piktogramme aus den H-Sätzen abgeleitet – verbindlich sind Etikett und SDB Abschnitt 2.2.</p>`);
}
function asGsCsv(liste){
  const z = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const kopf = ["Bezeichnung", "Hersteller", "Artikelnummer", "Signalwort", "H-Saetze", "Bereiche", "Verwendung", "Menge", "Gebinde", "Lagerort", "SDB-Fassung", "SDB-Stand", "GBU", "BA", "Status"];
  const zeilen = liste.map(g => [g.bezeichnung, g.hersteller, g.artikelnummer, g.signalwort, (g.h_saetze || []).join(" "), asGsBereiche(g).join(", "), g.verwendung, g.menge, g.gebinde,
    g.lagerort, g.sdb_ausgabe, asGsSdb(g).kurz, asGsGbuDa(g) ? "ja" : "fehlt", asGsBaDa(g) ? "ja" : "fehlt", AS_GS_VERW[asGsVerw(g)]].map(z).join(";"));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + [kopf.map(z).join(";")].concat(zeilen).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = "gefahrstoffverzeichnis-" + AS.kunde + "-" + asHeute() + ".csv"; a.click();
}
function asGsGbuDrucken(g, gbu, e, r){
  const z = (k, v) => v === undefined || v === null || v === "" ? "" : `<tr><th style="width:30%">${esc(k)}</th><td>${esc(v)}</td></tr>`;
  const mg = e.menge ? e.menge.wert + " " + e.menge.einheit + (e.grossflaechig ? " pro Arbeitstag (großflächig)" : " je Tätigkeit") : "";
  const haut = e.hautkontakt_ausgeschlossen ? "technisch ausgeschlossen" : ({ klein: "Spritzer, kleinflächig", gross: "großflächig" }[e.wirkflaeche] || "");
  asGsDruckSeite("Gefährdungsbeurteilung – " + g.bezeichnung, `<h1>Gefährdungsbeurteilung Gefahrstoffe (EMKG)</h1>
    <p class="leise">§ 6 GefStoffV · Einfaches Maßnahmenkonzept Gefahrstoffe der BAuA</p>
    <h2>Stoff und Tätigkeit</h2><table>${z("Gefahrstoff", g.bezeichnung)}${z("Hersteller", g.hersteller)}${z("Signalwort", g.signalwort)}${z("H-/EUH-Sätze", (g.h_saetze || []).join(" "))}
      ${z("Sicherheitsdatenblatt", g.sdb_ausgabe ? "Stand " + asDat(g.sdb_ausgabe) : "")}${z("Tätigkeit", gbu.taetigkeit)}${z("Bereich", gbu.arbeitsbereich)}${z("Art der Tätigkeit", AS_GS_ART[e.taetigkeitsart || ""])}</table>
    <h2>Angaben zur Tätigkeit</h2><table>${z("Menge", mg)}${z("Dauer pro Tag", e.dauer_min_tag != null ? e.dauer_min_tag + " min" : "")}${z("Versprüht", e.versprueht ? "ja" : "nein")}
      ${z("Temperatur", e.verarbeitungstemp_c != null ? e.verarbeitungstemp_c + " °C" : "")}${z("Hautkontakt", haut)}${z("Dauer Hautkontakt", { kurz: "unter 15 min/Tag", lang: "über 15 min/Tag" }[e.wirkdauer])}
      ${z("Lüftung", { normal: "normale Raumlüftung", absaugung: "Absaugung am Arbeitsplatz", gering: "schlecht belüftet", keine: "keine Lüftung" }[e.raumlueftung])}
      ${z("Enge Räume", e.enge_raeume ? "ja" : "")}${z("Lagermenge", e.lagermenge_kg != null ? e.lagermenge_kg + " kg bzw. l" : "")}</table>
    <h2>Ergebnis je Modul</h2>${asGsErgebnisHtml(r).replace(/<details>/g, "<div>").replace(/<\/details>/g, "</div>").replace(/<summary[^>]*>/g, "<h3>").replace(/<\/summary>/g, "</h3>")}
    <h2>Freigabe</h2><table>${z("Status", gbu.status === "freigegeben" ? "freigegeben" : "Entwurf")}${z("Freigegeben von", gbu.freigegeben_von)}
      ${z("Freigegeben am", gbu.freigegeben_am ? asDat(gbu.freigegeben_am) : "")}${z("Nächste Überprüfung", gbu.naechste_pruefung ? asDat(gbu.naechste_pruefung) : "")}${z("Erstellt von", gbu.erstellt_von)}</table>`);
}

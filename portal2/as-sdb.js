/* OAK EHS-Cockpit – Sicherheitsdatenblatt auslesen (im Browser, ohne KI und ohne Server).
   Wird ein SDB (PDF) im Gefahrstoff-Dialog gewählt, liest pdf.js den Text und diese Regeln lesen AB, was dasteht
   (Regel: nichts erschließen) – gleiche Muster wie tools/sdb_emkg_auslesen.py:
     Abschnitt 1  Handelsname, Hersteller          Abschnitt 2  Signalwort, H-/EUH-Sätze
     Abschnitt 3  Stoff oder Gemisch               Abschnitt 7/15 Lagerklasse (nur wenn genannt)
     Abschnitt 8  AGW (TRGS 900), Handschuh 8.2     Abschnitt 9  Aggregat, Siedebeginn, Dampfdruck, Flammpunkt, Dichte
   Seite 1: Überarbeitungsdatum. Jedes EMKG-Feld trägt Abschnitt + Originaltext + `sicher`; Unsicheres fragt der
   EMKG-Dialog ab. Leere Formularfelder werden vorbelegt, Vorhandenes bleibt. Globale Namen: asSdb. */
"use strict";

async function asSdbPdfJs(){
  if(window.pdfjsLib) return true;
  await new Promise((ok, fehl) => { const s = document.createElement("script"); s.src = "../portal/libs/pdfjs/pdf.min.js"; s.onload = ok; s.onerror = fehl; document.head.appendChild(s); }).catch(() => {});
  if(!window.pdfjsLib) return false;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "../portal/libs/pdfjs/pdf.worker.min.js";
  return true;
}
/* Text je Seite mit Zeilenumbrüchen (Zeile = gleiche y-Lage) */
async function asSdbText(datei){
  if(!(await asSdbPdfJs())) throw new Error("PDF-Leser nicht geladen");
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await datei.arrayBuffer()) }).promise, seiten = [];
  for(let i = 1; i <= pdf.numPages; i++){
    const inh = await (await pdf.getPage(i)).getTextContent(); let y = null, z = "";
    inh.items.forEach(it => { const yy = Math.round(it.transform[5]);
      if(y !== null && Math.abs(yy - y) > 2) z += "\n"; else if(z && !z.endsWith(" ") && it.str && !it.str.startsWith(" ")) z += " ";
      z += it.str; if(it.hasEOL) z += "\n"; y = yy; });
    seiten.push(z);
  }
  return seiten;
}
const AS_SDB_ZAHL = "([<>≤≥]?\\s*-?\\d+(?:[.,]\\d+)?)";
function asSdbZahl(s){ s = s.replace(/\s/g, "").replace(",", "."); const v = /^[<>≤≥]/.test(s) ? s[0] : ""; return [v, parseFloat(s.replace(/^[<>≤≥]/, ""))]; }
function asSdbAbschnitte(text){
  let marken = [...text.matchAll(/^\s*(?:ABSCHNITT|Abschnitt|SECTION)\s*(\d{1,2})\s*[:.]/gim)].map(m => [m.index, +m[1]]);
  if(marken.length < 5) marken = [...text.matchAll(/^\s*(\d{1,2})\.?\s+(?:Bezeichnung|Mögliche|Zusammensetzung|Erste|Maßnahmen|Handhabung|Begrenzung|Physikalische|Stabilität|Toxikologische|Umweltbezogene|Hinweise|Angaben|Rechtsvorschriften|Sonstige)/gm)].map(m => [m.index, +m[1]]);
  const t = {};
  marken.forEach(([pos, nr], i) => { if(!(nr in t)) t[nr] = text.slice(pos, i + 1 < marken.length ? marken[i + 1][0] : text.length); });
  return t;
}
const AS_SDB_GRENZE = /(Aggregatzustand|Form\s*:|Farbe|Geruch|\bpH\b|Schmelz|Gefrier|Siede|Flammpunkt|Verdampfung|Entz[üu]ndbar|Explosionsgrenze|Untere|Obere|Dampfdruck|Dampfdichte|Dichte|L[öo]slichkeit|Verteilungskoeffizient|Z[üu]ndtemperatur|Selbstentz|Zersetzung|Viskosit|Explosive Eigensch|Oxidierende|Sonstige|9\.2|Lagerklasse|LGK|Zusammenlagerung|7\.3|Abbrand|Aussehen|Methode)/i;
function asSdbNach(label, block, fenster){
  const m = new RegExp(label, "i").exec(block); if(!m) return [null, null];
  let st = block.slice(m.index + m[0].length, m.index + m[0].length + (fenster || 160));
  const g = AS_SDB_GRENZE.exec(st); if(g && g.index > 0) st = st.slice(0, g.index);
  return [st, block.slice(m.index, m.index + m[0].length + st.length)];
}
function asSdbFeld(wert, abschnitt, roh, sicher, mehr){ return Object.assign({ wert, abschnitt, roh: String(roh || "").replace(/\s+/g, " ").trim().slice(0, 200), sicher: sicher !== false }, mehr || {}); }

function asSdbAuswerten(seiten){
  const text = seiten.join("\n"), t = asSdbAbschnitte(text), erg = { daten: {}, formular: {} };
  const s1 = t[1] || "", s2 = t[2] || "", s3 = t[3] || "", s7 = t[7] || "", s8 = t[8] || "", s9 = t[9] || "", d = erg.daten, f = erg.formular;
  const zeileNach = (re, block) => { const m = re.exec(block); if(!m) return null; const r = block.slice(m.index + m[0].length).split("\n").map(x => x.trim()).find(x => x.length > 1); return r ? r.replace(/^[:\-–\s]+/, "").slice(0, 120) : null; };
  /* Abschnitt 1 */
  const name = zeileNach(/(?:Handelsname|Produktname|Produktbezeichnung|Bezeichnung des (?:Stoffes|Gemisches)|Produktidentifikator)\s*:?/i, s1);
  if(name && !/^1\.\d/.test(name)) f.bezeichnung = name;
  const herst = zeileNach(/(?:Hersteller|Lieferant|Firma|Unternehmen)(?:\s*\/\s*Lieferant)?\s*:?/i, (s1.split(/1\.3/)[1] || s1));
  if(herst && !/^1\.\d|Einzelheiten|Telefon/i.test(herst)) f.hersteller = herst;
  /* Abschnitt 2: Signalwort und H-Sätze (nur aus 2, nicht aus den Bestandteilen in 3) */
  const sw = /Signalwort\s*:?\s*(Gefahr|Achtung|Danger|Warning)/i.exec(s2);
  if(sw) f.signalwort = /gefahr|danger/i.test(sw[1]) ? "Gefahr" : "Achtung";
  const h = [...new Set((s2.match(/EUH\s?\d{3}A?|\bH\s?\d{3}[A-Za-z]{0,2}\b/g) || []).map(x => x.replace(/\s/g, "")).map(x => /^euh/i.test(x) ? x.toUpperCase() : "H" + x.slice(1)))].sort();
  if(h.length) f.h_saetze = h;
  /* Seite 1: Überarbeitungsdatum */
  const kopf = (seiten[0] || "").slice(0, 5000).toLowerCase(), DAT = "(\\d{1,2}\\s?[./-]\\s?\\d{1,2}\\s?[./-]\\s?\\d{2,4}|\\d{4}-\\d{2}-\\d{2})";
  for(const l of ["[üu]berarbeitet\\s*am", "[üu]berarbeitungsdatum", "datum\\s+der\\s+[üu]berarbeitung", "bearbeitungsdatum", "revisionsdatum", "[üu]berarbeitung", "ausgabedatum", "erstelldatum", "erstellungsdatum", "erstellt\\s*am", "g[üu]ltig\\s*ab", "druckdatum"]){
    const m = new RegExp("(?:" + l + ")[^0-9\\n]{0,30}\\n?[^0-9\\n]{0,20}?" + DAT).exec(kopf); if(!m) continue;
    let iso = null; if(/^\d{4}-/.test(m[1])) iso = m[1];
    else { const a = m[1].match(/\d+/g); let j = +a[2]; if(j < 100) j += 2000; const x = new Date(Date.UTC(j, +a[1] - 1, +a[0])); if(x.getUTCDate() === +a[0]) iso = x.toISOString().slice(0, 10); }
    if(iso){ f.sdb_ausgabe = iso; break; }
  }
  /* Abschnitt 3: Stoff oder Gemisch */
  const k3 = s3.slice(0, 400).toLowerCase();
  if(/gemisch/.test(k3) && !/stoff/.test(k3.replace(/stoffe?s? oder|stoffs beziehungsweise/g, "").slice(0, 60))) d.ist_gemisch = asSdbFeld(true, "3", s3.slice(0, 120));
  else if(/3\.2\.?\s*Gemische/.test(s3) && !/3\.1\.?\s*Stoffe\s*\n\s*\S/.test(s3)) d.ist_gemisch = asSdbFeld(true, "3.2", "3.2 Gemische");
  else if(/3\.1\.?\s*Stoffe?/.test(s3) && !/3\.2\.?\s*Gemische?\s*\n/.test(s3)) d.ist_gemisch = asSdbFeld(false, "3.1", "3.1 Stoffe", false);
  else d.ist_gemisch = asSdbFeld(null, "3", s3.slice(0, 120), false);
  /* Abschnitt 9 */
  let st = null, roh = null;
  for(const l of ["(?:Aggregatzustand|Physikalischer Zustand|Zustandsform)\\s*:?", "(?<![A-Za-zä])Form\\s*:", "Aussehen\\s*:?"]){
    [st, roh] = asSdbNach(l, s9, 60); if(st && /[A-Za-zäöü]{4,}/.test(st)) break; }
  if(st){ const w = st.toLowerCase();
    const agg = /gasf|\bgas\b/.test(w) ? "gas" : w.includes("aerosol") ? "aerosol" : /fl[üu]ssig|liquid|pastös|pastos|viskos/.test(w) ? "fluessig" : /\bfest|pulver|granulat|solid/.test(w) ? "fest" : null;
    d.aggregat = asSdbFeld(agg, "9.1", roh, ["gas", "fluessig", "fest"].includes(agg));
    if(agg === "aerosol") d.aggregat.hinweis = "Aerosol/Spraydose – EMKG-Zuordnung (flüssig/gas) bei der Bewertung festlegen"; }
  [st, roh] = asSdbNach("Siede(?:beginn|punkt|temperatur|bereich)[^:\\n]{0,40}:?", s9, 120);
  if(st){ const z = [...st.matchAll(new RegExp(AS_SDB_ZAHL + "\\s*°\\s*C", "g"))].map(m => asSdbZahl(m[1]));
    if(z.length){ const [v, x] = z.reduce((a, b) => b[1] < a[1] ? b : a); d.siedepunkt_c = asSdbFeld(x, "9.1", roh, v === "" && z.length === 1, v ? { vorzeichen: v } : null); }
    else if(/n\.?\s?b\.?|nicht bestimmt|keine daten|nicht anwendbar|n\.?\s?a\.?/i.test(st)) d.siedepunkt_c = asSdbFeld(null, "9.1", roh, false); }
  const dd = [];
  for(const m of s9.matchAll(/Dampfdruck(?!.{0,3}dichte)[^\n:]{0,40}:?/gi)){
    let s = s9.slice(m.index + m[0].length, m.index + m[0].length + 120); const g = AS_SDB_GRENZE.exec(s); if(g && g.index > 0) s = s.slice(0, g.index);
    const temp = /(\d+)\s*°\s*C/.exec(s9.slice(m.index, m.index + m[0].length + 120));
    for(const z of s.matchAll(new RegExp(AS_SDB_ZAHL + "\\s*(hPa|mbar|kPa|Pa|bar)\\b", "g"))){
      const [v, x] = asSdbZahl(z[1]); dd.push([x * { hPa: 1, mbar: 1, kPa: 10, Pa: 0.01, bar: 1000 }[z[2]], v, temp ? temp[1] : null, s9.slice(m.index, m.index + m[0].length + 120)]); } }
  if(dd.length){ const b20 = dd.filter(w => w[2] === null || w[2] === "20"), l = b20.length ? b20 : dd, [x, v, temp, r] = l.reduce((a, b) => b[0] > a[0] ? b : a);
    d.dampfdruck_hpa = asSdbFeld(Math.round(x * 1e4) / 1e4, "9.1", r, dd.length === 1 && (temp === null || temp === "20"), Object.assign({ temperatur_c: temp ? +temp : null }, v ? { vorzeichen: v } : {})); }
  [st, roh] = asSdbNach("Flammpunkt\\s*:?", s9, 100);
  if(st){ const z = new RegExp(AS_SDB_ZAHL + "\\s*°\\s*C").exec(st);
    if(z){ const [v, x] = asSdbZahl(z[1]); d.flammpunkt_c = asSdbFeld(x, "9.1", roh, v === "", v ? { vorzeichen: v } : null); }
    else if(/nicht anwendbar|n\.?\s?a\.?|n\.?\s?b\.?|nicht bestimmt/i.test(st)) d.flammpunkt_c = asSdbFeld(null, "9.1", roh, false); }
  [st, roh] = asSdbNach("(?<!Dampf)(?<!relative )Dichte(?! des Dampfes)[^:\\n]{0,30}:?", s9, 80);
  if(st){ const z = new RegExp(AS_SDB_ZAHL + "\\s*(g/cm|g/ml|kg/l|kg/m)", "i").exec(st);
    if(z){ let [v, x] = asSdbZahl(z[1]); if(/^kg\/m/i.test(z[2])) x /= 1000; d.dichte_g_cm3 = asSdbFeld(x, "9.1", roh, v === ""); } }
  /* Abschnitt 7/15: Lagerklasse nur, wenn ausdrücklich genannt */
  const q7 = (s7 + "\n" + (t[15] || "")).replace(/TRGS\s*510|VCI|\(Deutschland\)/g, " ");
  const lk = /(?:Lagerklasse|LGK)[^\d]{0,40}?\b(1[0-3]|[1-9](?:\.\d)?\s?[A-B]?)\b/i.exec(q7);
  if(lk) d.lagerklasse = asSdbFeld(lk[1].replace(/\s/g, ""), "7/15", lk[0]);
  /* Abschnitt 8: AGW nach TRGS 900 */
  const agw = [];
  for(const m of s8.matchAll(new RegExp("TRGS\\s*900[^\\n]{0,60}?(?:Langzeit|AGW)[^\\n]{0,40}?" + AS_SDB_ZAHL + "\\s*(mg/m3|mg/m³|ppm|ml/m3|ml/m³)", "gi"))){
    const [, x] = asSdbZahl(m[1]), einheit = /^(ppm|ml)/i.test(m[2]) ? "ppm" : "mg/m3", cas = s8.slice(Math.max(0, m.index - 300), m.index).match(/\b\d{2,7}-\d{2}-\d\b/g);
    agw.push({ wert: x, einheit, cas: cas ? cas[cas.length - 1] : null, roh: m[0].replace(/\s+/g, " ") }); }
  if(agw.length) d.agw_bestandteile = asSdbFeld(agw, "8.1", agw.map(a => a.roh).join("; "), true, { anzahl: agw.length });
  /* Abschnitt 8.2: Handschuh (Material, Dicke, Durchbruchzeit) – Originaltext, gekürzt */
  const hm = /(Handschutz|Schutzhandschuhe|Handschuhe?)[^\n]{0,3}/i.exec(s8);
  if(hm){ const hs = s8.slice(hm.index, hm.index + 420).replace(/\s+/g, " ");
    const mat = (hs.match(/Nitril\w*|Butyl\w*|Fluorkautschuk|FKM|Viton|Neopren\w*|Chloropren\w*|PVC|Polyvinylchlorid|Naturkautschuk|Latex|Polyethylen|PE-Laminat/gi) || []).filter((x, i, a) => a.indexOf(x) === i);
    const dicke = /(\d+(?:[.,]\d+)?)\s*mm/i.exec(hs), zeit = /(?:Durchbruch\w*|Tragedauer)[^0-9]{0,30}(>?\s*\d+\s*(?:min|h))/i.exec(hs);
    if(mat.length || dicke || zeit) f.handschuh_sdb = [mat.length ? mat.join("/") : "", dicke ? "Dicke " + dicke[1] + " mm" : "", zeit ? "Durchbruchzeit " + zeit[1].replace(/\s/g, " ") : ""].filter(Boolean).join(" · ");
  }
  erg.daten._quelle = { ausgelesen_am: asHeute(), ausgelesen_von: "Cockpit (SDB-Leser)" };
  return erg;
}

/* Im Gefahrstoff-Dialog: Datei gewählt → auslesen, leere Felder vorbelegen, Ergebnis anzeigen. Gibt eine Funktion zurück,
   die beim Speichern die sdb_daten liefert (null = nichts gelesen). */
function asSdbAnbinden(dl, g){
  const inp = dl.querySelector("#gsSdbDatei"); if(!inp) return () => null;
  let gelesen = null;
  const box = document.createElement("div"); box.className = "hinweis"; box.style.marginTop = "6px"; inp.closest("label").after(box);
  inp.onchange = async () => {
    const f = (inp.files || [])[0]; gelesen = null; box.textContent = ""; if(!f) return;
    box.textContent = "Sicherheitsdatenblatt wird gelesen …";
    try{
      const e = asSdbAuswerten(await asSdbText(f)); gelesen = e;
      const setz = (feld, wert) => { const el = dl.querySelector(`[data-f="${feld}"]`); if(el && wert && !String(el.value || "").trim()){ el.value = wert; return true; } return false; };
      const neu = [];
      if(setz("bezeichnung", e.formular.bezeichnung)) neu.push("Bezeichnung");
      if(setz("hersteller", e.formular.hersteller)) neu.push("Hersteller");
      if(setz("signalwort", e.formular.signalwort)) neu.push("Signalwort");
      if(e.formular.h_saetze && setz("h_text", e.formular.h_saetze.join(" "))) neu.push(e.formular.h_saetze.length + " H-Sätze");
      if(setz("sdb_ausgabe", e.formular.sdb_ausgabe)) neu.push("Überarbeitungsdatum");
      const d = e.daten, w = k => d[k] && d[k].wert != null ? d[k].wert : null;
      const emkg = [w("aggregat") && "Aggregat " + w("aggregat"), w("siedepunkt_c") != null && "Siedebeginn " + w("siedepunkt_c") + " °C",
        w("dampfdruck_hpa") != null && "Dampfdruck " + w("dampfdruck_hpa") + " hPa", w("flammpunkt_c") != null && "Flammpunkt " + w("flammpunkt_c") + " °C",
        w("lagerklasse") && "LGK " + w("lagerklasse")].filter(Boolean);
      const unsicher = ["ist_gemisch", "aggregat", "siedepunkt_c", "dampfdruck_hpa", "flammpunkt_c"].filter(k => !d[k] || !d[k].sicher).length;
      box.innerHTML = `<b>Aus dem SDB gelesen – bitte prüfen:</b> ${esc(neu.join(", ") || "Formularfelder waren schon ausgefüllt")}
        ${emkg.length ? "<br>EMKG-Daten: " + esc(emkg.join(" · ")) : ""}${e.formular.handschuh_sdb ? "<br>Handschuh (8.2): " + esc(e.formular.handschuh_sdb) : ""}
        ${unsicher ? `<br>${unsicher} Angabe(n) nicht eindeutig – fragt die Beurteilung (EMKG) ab.` : ""}`;
    }catch(err){ box.textContent = "Das SDB ließ sich nicht automatisch lesen (" + (err.message || err) + ") – Angaben bitte von Hand eintragen."; }
  };
  return () => gelesen && { sdb_daten: Object.assign({}, (g && g.sdb_daten) || {}, gelesen.daten),
    handschuh_sdb: g && g.handschuh_sdb ? undefined : gelesen.formular.handschuh_sdb };
}

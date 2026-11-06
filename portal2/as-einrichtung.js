/* OAK EHS-Cockpit – Einrichtungs-Assistent für neue Betriebe (Stufe 14, Plan staged-inventing-blum „Reihenfolge“ 2 + C, 06.11.2026).
   Ersetzt die Handarbeit von tools/demo_betrieb.py und das alte „+ Kunde“: OAK richtet einen Betrieb in wenigen Minuten vollständig ein,
   danach arbeitet der Betrieb allein. Acht Schritte + Abschluss, je ein Bildschirm (kein Scrollen der Seite, Listen scrollen in sich),
   Fortschritt oben, Zurück/Weiter, jederzeit speicherbar und später fortsetzbar (portal_kunde.einrichtung, SQL stufe14_einrichtung).
   Wiederverwendet: asSpeichern (Bereiche), asUwPersonDialog (Person), asAnlageAnlegen (as-betrieb.js), asPsaVorlageAnwenden (as-psa.js),
   uw_buchung/uw_modul_zuweisung wie im Modulkatalog, terminal_geraet_anlegen/portal_melde_token_erneuern/asGeraetLink/asAushangVorfall
   (as-organisation.js), portal_erinnerung_abo, Edge Function zugang-anlegen (asZgAufruf). Nur OAK (Kunde anlegen = OAK-Recht).
   Globale Namen mit asEin/AS_EIN-Präfix. */
"use strict";

AS_ICON.einrichtung = '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>';

const AS_EIN_SCHRITTE = [["stamm", "Stammdaten"], ["bereiche", "Bereiche"], ["rollen", "Rollen"], ["personen", "Personen"], ["anlagen", "Anlagen"],
  ["unterweisung", "Unterweisung"], ["terminal", "Terminal & Melden"], ["zugaenge", "Zugänge"], ["abschluss", "Startklar"]];
/* Kurztitel für die Fortschrittsleiste (einzeilig bei 1400 px), voller Titel im Tooltip und in der Kartenüberschrift */
const AS_EIN_KURZ = { stamm: "Stamm", unterweisung: "Schulung", terminal: "Terminal" };
const AS_EIN_BRANCHEN = [["kunststoff-spritzguss", "Kunststoff-Spritzguss"], ["metall", "Metallbearbeitung"], ["logistik", "Lager & Logistik"],
  ["buero", "Büro & Verwaltung"], ["sonstige", "Sonstige"]];
const AS_EIN_BG = ["BGHM", "BG RCI", "BG ETEM", "BG BAU", "BGN", "BGHW", "BG Verkehr", "BGW", "VBG", "andere"];
/* Vorschläge je Branche: Bereiche, Rollen (Name, Typ) und Unterweisungsmodule (uw_modul.thema) */
const AS_EIN_VORSCHLAG = {
  "kunststoff-spritzguss": { bereiche: ["Produktion", "Werkzeugbau", "Instandhaltung", "Lager", "Versand", "Verwaltung"],
    rollen: [["Maschinenbediener", "eigen"], ["Einrichter", "eigen"], ["Werkzeugmacher", "eigen"], ["Instandhalter", "eigen"],
      ["Lager und Staplerfahrer", "eigen"], ["Büro und Verwaltung", "eigen"], ["Leiharbeit Produktion", "leiharbeit"]],
    module: ["grundunterweisung", "maschinenbedienung-spritzguss", "leitern-tritte", "flurfoerderzeuge", "gefahrstoffe", "laerm", "brandschutz", "erste-hilfe", "bildschirmarbeit"] },
  metall: { bereiche: ["Fertigung", "Montage", "Instandhaltung", "Lager", "Verwaltung"],
    rollen: [["Maschinenbediener", "eigen"], ["Monteur", "eigen"], ["Instandhalter", "eigen"], ["Lager und Staplerfahrer", "eigen"], ["Büro und Verwaltung", "eigen"]],
    module: ["grundunterweisung", "leitern-tritte", "flurfoerderzeuge", "gefahrstoffe", "laerm", "brandschutz", "erste-hilfe", "bildschirmarbeit"] },
  logistik: { bereiche: ["Wareneingang", "Lager", "Kommissionierung", "Versand", "Verwaltung"],
    rollen: [["Lager und Staplerfahrer", "eigen"], ["Kommissionierer", "eigen"], ["Büro und Verwaltung", "eigen"], ["Leiharbeit Lager", "leiharbeit"]],
    module: ["grundunterweisung", "flurfoerderzeuge", "leitern-tritte", "brandschutz", "erste-hilfe", "bildschirmarbeit"] },
  buero: { bereiche: ["Verwaltung", "Vertrieb"], rollen: [["Büro und Verwaltung", "eigen"]], module: ["grundunterweisung", "bildschirmarbeit", "brandschutz", "erste-hilfe"] },
  sonstige: { bereiche: ["Betrieb", "Verwaltung"], rollen: [["Beschäftigte", "eigen"], ["Büro und Verwaltung", "eigen"]], module: ["grundunterweisung", "brandschutz", "erste-hilfe"] },
};
/* Modul → Rollen (Namensmuster) für den Zuordnungsvorschlag; Grundunterweisung, Brandschutz und Erste Hilfe für alle */
const AS_EIN_MODUL_ROLLE = { grundunterweisung: /./, brandschutz: /./, "erste-hilfe": /./,
  "maschinenbedienung-spritzguss": /bedien|einricht|produktion|spritz|maschin/i, "leitern-tritte": /einricht|instand|werkzeug|lager|monteur|kommission/i,
  flurfoerderzeuge: /lager|stapler|versand|logistik|kommission/i, gefahrstoffe: /einricht|instand|werkzeug|reinig/i,
  laerm: /bedien|einricht|produktion|werkzeug|instand|maschin|monteur/i, bildschirmarbeit: /büro|buero|verwaltung|kaufm|vertrieb/i, hallenkran: /kran|einricht|instand/i };
const AS_EIN_ARTEN = ["Spritzgießmaschine", "Roboterzelle", "Granulatförderer", "Trockner", "Fräsmaschine", "Drehmaschine", "Ständerbohrmaschine",
  "Bandsäge", "Schleifmaschine", "Presse", "Kompressor", "Gabelstapler", "Hallenkran", "Regalanlage"];
const AS_EIN_SPRACHEN = { de: "Deutsch", en: "Englisch", tr: "Türkisch", pl: "Polnisch", ro: "Rumänisch", ru: "Russisch", uk: "Ukrainisch",
  ar: "Arabisch", it: "Italienisch", hr: "Kroatisch", bg: "Bulgarisch" };
/* OAK-Vorlagebetrieb für Beurteilungen (BdA) je Maschinentyp – Testbetrieb, keine Kundendaten; Rückstände von Testläufen fallen raus */
const AS_EIN_VORLAGE_BETRIEB = "durchlauf";
const AS_EIN_JUNK = /\d{6}|\bNT\d+\b|ABN-|Nachtest|Kopie|\bLeer\b|\bEW\b/i;

const AS_EIN = { neu: false, d: null, zg: null, zgSlug: null, zugang: [], vorlagen: null, laeuft: false };

/* ---------------- Start ---------------- */
function asEinrichtungStarten(){
  if(!asDarf("oak")) return;
  AS_EIN.neu = true; AS_EIN.d = null; AS_EIN.zugang = [];
  if(typeof asKopfMenue === "function") asKopfMenue(false);
  if(location.hash === "#einrichtung/1") asZeige(); else asGehe("einrichtung/1");
}
async function asEinLaden(){
  const s = AS.kunde, k = "&kunde_slug=eq." + encodeURIComponent(s), hole = p => apiGet(p).then(r => r || []).catch(() => []);
  const [pk, rollen, pers, anl, buch, zuw, module, tt, mt, abo] = await Promise.all([
    hole("/rest/v1/portal_kunde?select=slug,name,rechte,einrichtung,marke,avv_abgeschlossen_am&slug=eq." + encodeURIComponent(s)),
    hole("/rest/v1/uw_rolle?select=*" + k + "&order=name.asc"),
    hole("/rest/v1/uw_person?select=*,uw_person_einheit(einheit_id),uw_person_rolle(rolle_id)" + k + "&order=name.asc"),
    hole("/rest/v1/portal_dokumente?select=maschinen_id,maschine,maschinentyp,storage_path,kunde_slug&kategorie=eq.anlagen" + k + "&order=maschinen_id.asc"),
    hole("/rest/v1/uw_buchung?select=*" + k),
    hole("/rest/v1/uw_modul_zuweisung?select=*" + k),
    hole("/rest/v1/uw_modul?select=thema,titel,untertitel,reihenfolge,ebene,aktiv&aktiv=is.true&order=reihenfolge.asc"),
    hole("/rest/v1/portal_terminal_token?select=token,bezeichnung,aktiv,gesperrt,angelegt_am" + k + "&order=angelegt_am.asc"),
    hole("/rest/v1/portal_melde_token?select=token,aktiv" + k + "&aktiv=is.true"),
    hole("/rest/v1/portal_erinnerung_abo?select=id,email,name,rhythmus" + k + "&order=angelegt_am.asc")]);
  AS_EIN.d = { slug: s, k: pk[0] || null, rollen, pers, anl, buch, zuw, module: module.filter(m => m.ebene !== "inhalt"), tt, mt, abo };
  if(AS_EIN.zgSlug !== s){ AS_EIN.zg = null; AS_EIN.zgSlug = s; AS_EIN.zugang = AS_EIN.zugang.filter(z => z.slug === s); }
  return AS_EIN.d;
}
async function asEinZugaenge(neu){
  if(AS_EIN.zg && !neu && AS_EIN.zgSlug === AS.kunde) return AS_EIN.zg;
  try{ const r = await asZgAufruf({ aktion: "liste" }); AS_EIN.zg = r.zugaenge || []; }
  catch(e){ AS_EIN.zg = null; }
  AS_EIN.zgSlug = AS.kunde;
  return AS_EIN.zg;
}
async function asEinSpeichern(teil){
  const d = AS_EIN.d; if(!d || !d.k) return;
  const e = Object.assign({}, d.k.einrichtung || {}, teil);
  if(teil.erledigt) e.erledigt = Object.assign({}, (d.k.einrichtung || {}).erledigt || {}, teil.erledigt);
  await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(d.slug), { einrichtung: e }, "return=minimal");
  d.k.einrichtung = e;
}
async function asEinRechte(teil){
  const d = AS_EIN.d, r = Object.assign({}, d.k.rechte || {}, teil);
  await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(d.slug), { rechte: r }, "return=minimal");
  d.k.rechte = r;
  if(typeof AS_TP === "object"){ AS_TP.slug = null; AS_TP.rechte = null; }
}
function asEinBranche(){ return asOrgDaten().branche || "sonstige"; }
function asEinVorschlag(){ return AS_EIN_VORSCHLAG[asEinBranche()] || AS_EIN_VORSCHLAG.sonstige; }
function asEinNorm(s){ return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function asEinRollenAktiv(){ return (AS_EIN.d.rollen || []).filter(r => r.status !== "archiviert"); }
function asEinPersAktiv(){ return (AS_EIN.d.pers || []).filter(p => p.status === "aktiv"); }
function asEinGebucht(th){ return (AS_EIN.d.buch || []).some(b => b.thema === th && b.aktiv !== false); }
function asEinGeraete(){ return (AS_EIN.d.tt || []).filter(t => !t.gesperrt && t.aktiv !== false && !/geteilt|handy/i.test(t.bezeichnung || "")); }

/* ---------------- Status je Schritt (aus den Daten, nicht behauptet) ---------------- */
function asEinStatus(){
  const d = AS_EIN.d, od = asOrgDaten(), st = {};
  if(!d || !d.k) return { stamm: { ok: false, text: "noch nicht angelegt" } };
  const rollen = asEinRollenAktiv(), pers = asEinPersAktiv(), ohneRolle = pers.filter(p => !(p.uw_person_rolle || []).length).length;
  const einh = asT("as_einheit");
  st.stamm = { ok: !!(d.k.name && od.branche), text: od.branche ? (AS_EIN_BRANCHEN.find(b => b[0] === od.branche) || [, od.branche])[1] : "Branche fehlt" };
  st.bereiche = { ok: einh.length > 0, text: einh.length + (einh.length === 1 ? " Bereich" : " Bereiche") };
  st.rollen = { ok: rollen.length > 0, text: rollen.length + (rollen.length === 1 ? " Rolle" : " Rollen") };
  st.personen = { ok: pers.length > 0 && !ohneRolle, text: pers.length + (pers.length === 1 ? " Person" : " Personen") + (ohneRolle ? " · " + ohneRolle + " ohne Rolle" : "") };
  st.anlagen = { ok: d.anl.length > 0, text: d.anl.length + (d.anl.length === 1 ? " Anlage" : " Anlagen") };
  const gebucht = d.module.filter(m => asEinGebucht(m.thema)).map(m => m.thema);
  const zuw = (d.zuw || []).filter(z => z.aktiv !== false && gebucht.includes(z.thema));
  const rolleOhne = rollen.filter(r => r.typ !== "besucher" && !zuw.some(z => z.rolle_id === r.id)).length;
  const cockpit = ((d.k.rechte || {}).unterweisung || {}).quelle === "cockpit";
  st.unterweisung = { ok: gebucht.length > 0 && !rolleOhne && rollen.length > 0 && cockpit,
    text: gebucht.length + " Module" + (rolleOhne ? " · " + rolleOhne + " Rollen ohne Inhalt" : "") + (cockpit ? "" : " · Terminal nicht aus dem Cockpit") };
  const ger = asEinGeraete().length, abo = (d.abo || []).filter(a => a.rhythmus !== "aus").length;
  st.terminal = { ok: ger > 0 && d.mt.length > 0 && abo > 0, text: [ger ? ger + " Terminal" : "kein Terminal", d.mt.length ? "Melde-Code" : "kein Melde-Code", abo ? abo + " Empfänger" : "kein Empfänger"].join(" · ") };
  const zg = AS_EIN.zg;
  if(zg){ const gf = zg.some(z => z.gf && !z.gesperrt), fk = zg.some(z => z.rolle === "fachkraft" && !z.gf && !z.gesperrt);
    st.zugaenge = { ok: gf && fk, text: (gf ? "Geschäftsführung" : "GF fehlt") + " · " + (fk ? "Fachkraft" : "Fachkraft fehlt") }; }
  else { const e = ((d.k.einrichtung || {}).erledigt || {}).zugaenge; st.zugaenge = { ok: !!e, text: e ? "angelegt" : "offen" }; }
  st.abschluss = { ok: AS_EIN_SCHRITTE.slice(0, 8).every(([k]) => st[k] && st[k].ok), text: (d.k.einrichtung || {}).abgeschlossen_am ? "abgeschlossen " + asDat(d.k.einrichtung.abgeschlossen_am) : "" };
  return st;
}

/* ---------------- Seite ---------------- */
AS_SEITEN.einrichtung = { titel: "Einrichtung", icon: "einrichtung", sort: 9.4, get versteckt(){ return !asDarf("oak"); }, async render(main){
  if(!asDarf("oak")){ main.innerHTML = `<h1 class="seite">Einrichtung</h1><div class="leer">Nur für OAK.</div>`; return; }
  main.innerHTML = `<h1 class="seite">Betrieb einrichten</h1><p class="unter">wird geladen …</p>`;
  if(!AS_EIN.neu) await asEinLaden(); else AS_EIN.d = null;
  if(!AS_EIN.neu && AS_EIN.d.k && !AS.reiter.einrichtung) AS.reiter.einrichtung = String((AS_EIN.d.k.einrichtung || {}).schritt || 1);
  let nr = Math.min(9, Math.max(1, parseInt(AS.reiter.einrichtung, 10) || 1));
  if(AS_EIN.neu) nr = 1;
  const [schl, titel] = AS_EIN_SCHRITTE[nr - 1];
  if(["zugaenge", "abschluss"].includes(schl) || (nr > 1 && !AS_EIN.zg)) await asEinZugaenge(schl === "zugaenge");
  /* Bereichsauswahl (as-bereich.js) und Beurteilungen frisch, wenn Anlagen angelegt oder geprüft werden */
  if(!AS_EIN.neu && ["anlagen", "abschluss"].includes(schl)) await asLaden().catch(() => {});
  const st = AS_EIN.neu ? {} : asEinStatus(), name = AS_EIN.neu ? "Neuer Betrieb" : (AS_EIN.d.k ? AS_EIN.d.k.name : AS.kunde);
  const fertig = !AS_EIN.neu && AS_EIN.d.k && (AS_EIN.d.k.einrichtung || {}).abgeschlossen_am;
  main.innerHTML = `<h1 class="seite">Betrieb einrichten</h1>
    <p class="unter">${esc(name)} · Schritt ${nr} von 9${fertig ? " · Einrichtung abgeschlossen am " + esc(asDat(AS_EIN.d.k.einrichtung.abgeschlossen_am)) : ""}</p>
    <div class="ein-wrap" id="einWrap">
      <div class="ein-schritte nodruck">${AS_EIN_SCHRITTE.map(([k, t], i) => `<button type="button" class="ein-s${i + 1 === nr ? " an" : ""}${st[k] && st[k].ok ? " ok" : ""}"
          data-ein="${i + 1}" title="${esc(t + (st[k] ? " – " + st[k].text : ""))}"${AS_EIN.neu && i > 0 ? " disabled" : ""}><b>${st[k] && st[k].ok ? "✓" : i + 1}</b><span>${esc(AS_EIN_KURZ[k] || t)}</span></button>`).join("")}</div>
      <div class="karte ein-karte"><h2>${nr} · ${esc(titel)} <span>${st[schl] ? asChip(st[schl].ok ? "erledigt" : "offen", st[schl].ok ? "gruen" : "grau") : asChip("neu", "grau")}</span></h2>
        <div class="ein-inhalt" id="einInhalt"></div></div>
      <div class="ein-fuss nodruck">
        <button type="button" class="btn sek" id="einZurueck"${nr === 1 ? " disabled" : ""}>Zurück</button>
        <span class="ein-fuss-mitte hinweis" id="einHinweis">${st[schl] ? esc(st[schl].text) : "Firmenname, Kurzname und Branche genügen für den Start."}</span>
        <button type="button" class="btn sek" id="einSpaeter"${AS_EIN.neu ? " disabled" : ""}><span class="ein-lang">Später fortsetzen</span><span class="ein-kurz">Später</span></button>
        <button type="button" class="btn" id="einWeiter">${nr === 9 ? "Abschließen" : AS_EIN.neu ? "Anlegen und weiter" : "Weiter"}</button></div>
    </div>`;
  const box = document.getElementById("einInhalt");
  const zeichner = { stamm: asEinStamm, bereiche: asEinBereiche, rollen: asEinRollen, personen: asEinPersonen, anlagen: asEinAnlagen,
    unterweisung: asEinUnterweisung, terminal: asEinTerminal, zugaenge: asEinZugangSchritt, abschluss: asEinAbschluss }[schl];
  zeichner(box);
  main.querySelectorAll("[data-ein]").forEach(b => b.onclick = () => asEinGehe(+b.dataset.ein));
  main.querySelector("#einZurueck").onclick = () => asEinGehe(nr - 1);
  main.querySelector("#einSpaeter").onclick = async () => { await asEinSpeichern({ schritt: nr }).catch(() => {});
    asMeldung("Gespeichert – die Einrichtung lässt sich unter „Einrichtung“ fortsetzen."); asGehe("cockpit"); };
  main.querySelector("#einWeiter").onclick = async ev => {
    const b = ev.currentTarget; if(AS_EIN.laeuft) return; b.disabled = true; AS_EIN.laeuft = true;
    try{
      if(schl === "stamm" && !(await asEinStammSpeichern(box))) return;
      if(schl === "abschluss"){ await asEinAbschliessen(); return; }
      await asEinLaden(); const s2 = asEinStatus();
      await asEinSpeichern({ schritt: nr + 1, erledigt: s2[schl] && s2[schl].ok ? { [schl]: asHeute() } : {} });
      asEinGehe(nr + 1);
    }catch(e){ asMeldung("Nicht gespeichert: " + (e.message || e)); }
    finally{ AS_EIN.laeuft = false; b.disabled = false; }
  };
  asEinHoehe(); setTimeout(asEinHoehe, 400); setTimeout(asEinHoehe, 1500);   // Hinweisband/Kundenlogo können nach dem Zeichnen noch Höhe ändern
}};
function asEinGehe(nr){ nr = Math.min(9, Math.max(1, nr)); AS.reiter.einrichtung = String(nr);
  if(location.hash === "#einrichtung/" + nr) asZeige(); else asGehe("einrichtung/" + nr); }
/* Ein Bildschirm: Höhe des Assistenten = sichtbare Höhe ab seiner Oberkante (abzüglich Rand unten bzw. Handy-Fußleiste) */
function asEinHoehe(){
  const w = document.getElementById("einWrap"), main = document.getElementById("haupt"); if(!w || !main) return;
  const unten = parseFloat(getComputedStyle(main).paddingBottom) || 0;
  const h = window.innerHeight - (w.getBoundingClientRect().top + window.scrollY) - unten;
  w.style.height = Math.max(380, Math.floor(h)) + "px";
  const ueber = document.documentElement.scrollHeight - window.innerHeight;   // Rundung, Ränder: Rest abziehen, die Seite selbst scrollt nie
  if(ueber > 0 && h - ueber >= 380) w.style.height = Math.floor(h - ueber) + "px";
  if(!asEinHoehe.an){ asEinHoehe.an = true; window.addEventListener("resize", () => { clearTimeout(asEinHoehe.t); asEinHoehe.t = setTimeout(asEinHoehe, 120); }); }
}

/* ---------------- 1 Stammdaten ---------------- */
function asEinSlug(name){
  return String(name || "").toLowerCase().replace(/[äöüß]/g, c => ({ "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" }[c]))
    .replace(/\b(gmbh|mbh|ag|kg|co|ug|ohg|gbr|e\.?\s?k|se|haftungsbeschränkt)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 2).join("-").slice(0, 24);
}
function asEinStamm(box){
  const neu = AS_EIN.neu, d = neu ? {} : asOrgDaten(), k = neu ? {} : (AS_EIN.d.k || {});
  box.innerHTML = `<div class="form">
      ${asFeld("Firmenname", "name", k.name || "", "text", "voll")}
      <label>Kurzname (Adresse im Cockpit, klein, ohne Leerzeichen)<input type="text" data-f="slug" value="${esc(neu ? "" : AS.kunde)}"${neu ? "" : " readonly"}></label>
      ${asAuswahl("Branche (mit Branchenbaustein)", "branche", d.branche || "kunststoff-spritzguss", AS_EIN_BRANCHEN)}
      ${asFeld("Straße und Hausnummer", "strasse", d.anschrift_strasse || "")}
      ${asFeld("PLZ und Ort", "ort", d.anschrift_ort || "")}
      ${asFeld("Beschäftigte (Köpfe)", "ma", d.ma_vz || "", "number")}
      ${asAuswahl("Berufsgenossenschaft", "bg", d.bg || "BGHM", AS_EIN_BG)}
    </div>
    <div class="ein-marke"><span class="hinweis">Logo und Farben des Betriebs (optional) – ${neu ? "nach dem Anlegen möglich." : "erscheinen in Kopfzeile, Aushängen und Dokumenten."}</span>
      <button type="button" class="btn sek klein" id="einMarke"${neu ? " disabled" : ""}>Logo und Farben</button></div>
    <p class="hinweis">Die Branche bestimmt die Vorschläge der nächsten Schritte (Bereiche, Rollen, Unterweisungsmodule, PSA-Vorlage). Spritzguss nutzt den
      Branchenbaustein nach DGUV Information 113-606.</p>`;
  const nf = box.querySelector('[data-f="name"]'), sf = box.querySelector('[data-f="slug"]');
  if(neu){ sf.dataset.auto = "1"; nf.oninput = () => { if(sf.dataset.auto) sf.value = asEinSlug(nf.value); }; sf.oninput = () => { sf.dataset.auto = ""; }; }
  const mk = box.querySelector("#einMarke"); if(mk) mk.onclick = () => typeof asMarkeDialog === "function" && asMarkeDialog();
}
async function asEinStammSpeichern(box){
  const w = asWerte(box), slug = String(w.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  if(!w.name || w.name.length < 3){ asMeldung("Bitte den Firmennamen eintragen."); return false; }
  if(!/^[a-z0-9][a-z0-9-]{2,30}$/.test(slug)){ asMeldung("Kurzname: 3–31 Zeichen, nur a–z, 0–9 und Bindestrich."); return false; }
  const daten = { branche: w.branche, bg: w.bg, anschrift_strasse: w.strasse || "", anschrift_ort: w.ort || "", ma_vz: w.ma == null ? null : +w.ma };
  if(AS_EIN.neu){
    const da = await apiGet("/rest/v1/portal_kunde?select=slug&slug=eq." + encodeURIComponent(slug)).catch(() => []);
    const da2 = await apiGet("/rest/v1/as_organisation?select=kunde_slug&kunde_slug=eq." + encodeURIComponent(slug)).catch(() => []);
    if((da && da.length) || (da2 && da2.length)){ asMeldung("Diesen Kurznamen gibt es schon – bitte einen anderen wählen."); return false; }
    await apiSend("POST", "/rest/v1/portal_kunde", { slug, name: w.name,
      rechte: { unterweisung: { quelle: "cockpit" }, dokumente_aus_db: true, vorfall_freigabe: "betrieb" },
      einrichtung: { schritt: 2, gestartet_am: asHeute(), gestartet_von: AS.ich || "OAK", erledigt: { stamm: asHeute() } } }, "return=minimal");
    await apiSend("POST", "/rest/v1/as_organisation", { kunde_slug: slug, name: w.name, daten }, "return=minimal");
    AS_EIN.neu = false;
    await asKundenLaden(); AS.kunde = slug; try{ localStorage.setItem("as_kunde", slug); }catch(e){}
    await asLaden(); asKundeWahl();
    asMeldung(w.name + " angelegt.");
  } else {
    await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(AS.kunde), { name: w.name }, "return=minimal");
    await apiSend("PATCH", "/rest/v1/as_organisation?kunde_slug=eq." + encodeURIComponent(AS.kunde), { name: w.name }, "return=minimal");
    await asOrgSpeichern(daten); AS.org.name = w.name;
  }
  return true;
}

/* ---------------- 2 Bereiche ---------------- */
function asEinBereiche(box){
  const einh = asT("as_einheit"), da = new Set(einh.map(e => asEinNorm(e.name)));
  box.innerHTML = `<div class="ein-zwei">
    <div class="ein-spalte"><h3>Bereiche des Betriebs (${einh.length})</h3>
      <div class="zeilen">${einh.map(e => `<div class="z" data-eid="${esc(e.id)}"><div><b>${esc(e.name)}</b><small>${esc(e.art || "bereich")}${e.beschaeftigte ? " · " + e.beschaeftigte + " Beschäftigte" : ""}${e.schichten > 1 ? " · " + e.schichten + " Schichten" : ""}</small></div></div>`).join("")
        || `<div class="leer">Noch keine Bereiche – rechts aus den Vorschlägen wählen oder eintragen.</div>`}</div></div>
    <div class="ein-spalte"><h3>Vorschläge der Branche</h3>
      <div class="ein-chips">${asEinVorschlag().bereiche.map(n => `<button type="button" class="ein-chip${da.has(asEinNorm(n)) ? " da" : ""}" data-vb="${esc(n)}"${da.has(asEinNorm(n)) ? " disabled" : ""}>${da.has(asEinNorm(n)) ? "✓ " : "+ "}${esc(n)}</button>`).join("")}</div>
      <h3>Eigener Bereich</h3>
      <div class="form" id="einBForm">${asFeld("Name", "name", "", "text", "voll")}${asFeld("Beschäftigte", "beschaeftigte", "", "number")}${asFeld("Schichten", "schichten", 1, "number")}</div>
      <p><button type="button" class="btn klein" id="einBNeu">Bereich hinzufügen</button></p>
      <p class="hinweis">Bereiche sind Abteilungen oder Kostenstellen. Beschäftigte und Schichten je Bereich bestimmen das Soll an Ersthelfern und Brandschutzhelfern. Bereich antippen = ändern.</p></div></div>`;
  const neu = async (name, besch, schicht) => {
    if(!name) return;
    if(asT("as_einheit").some(e => asEinNorm(e.name) === asEinNorm(name))){ asMeldung("Diesen Bereich gibt es schon."); return; }
    await asSpeichern("as_einheit", { name, art: "bereich", beschaeftigte: +besch || 0, schichten: +schicht || 1, sort: asT("as_einheit").length + 1 });
    asZeige();
  };
  box.querySelectorAll("[data-vb]").forEach(b => b.onclick = () => neu(b.dataset.vb).catch(e => asMeldung("Nicht gespeichert: " + (e.message || e))));
  box.querySelector("#einBNeu").onclick = () => { const w = asWerte(box.querySelector("#einBForm"));
    neu(w.name, w.beschaeftigte, w.schichten).catch(e => asMeldung("Nicht gespeichert: " + (e.message || e))); };
  box.querySelectorAll("[data-eid]").forEach(z => z.onclick = () => { const e = asNach("as_einheit", z.dataset.eid); if(!e) return;
    asDialog({ titel: e.name, inhalt: `<div class="form">${asFeld("Name", "name", e.name, "text", "voll")}
        ${asAuswahl("Art", "art", e.art || "bereich", [["standort", "Standort"], ["bereich", "Bereich"], ["abteilung", "Abteilung"], ["kostenstelle", "Kostenstelle"]])}
        ${asFeld("Kostenstelle", "kst_nr", e.kst_nr)}${asFeld("Beschäftigte", "beschaeftigte", e.beschaeftigte, "number")}${asFeld("Schichten", "schichten", e.schichten || 1, "number")}
        ${asFeld("Leitung", "leitung", e.leitung)}</div>`,
      knoepfe: [{ t: "Speichern", fn: async dl => { const w = asWerte(dl); if(!w.name){ asMeldung("Bitte einen Namen eintragen."); return false; }
        w.beschaeftigte = +w.beschaeftigte || 0; w.schichten = +w.schichten || 1;
        await asSpeichern("as_einheit", Object.assign({ id: e.id }, w)); asZeige(); } }] }); });
}

/* ---------------- 3 Rollen ---------------- */
function asEinRollen(box){
  const rollen = asEinRollenAktiv(), da = new Set(rollen.map(r => asEinNorm(r.name)));
  const TYP = typeof AS_UW_TYP === "object" ? AS_UW_TYP : { eigen: "eigenes Personal", leiharbeit: "Leiharbeit", fremdfirma: "Fremdfirma", besucher: "Besucher" };
  box.innerHTML = `<div class="ein-zwei">
    <div class="ein-spalte"><h3>Rollen des Betriebs (${rollen.length})</h3>
      <div class="zeilen">${rollen.map(r => `<div class="z" data-rid="${esc(r.id)}"><div><b>${esc(r.name)}</b><small>${esc(TYP[r.typ] || r.typ || "")}</small></div></div>`).join("")
        || `<div class="leer">Noch keine Rollen – rechts aus den Vorschlägen wählen oder eintragen.</div>`}</div></div>
    <div class="ein-spalte"><h3>Vorschläge der Branche</h3>
      <div class="ein-chips">${asEinVorschlag().rollen.map(([n, t]) => `<button type="button" class="ein-chip${da.has(asEinNorm(n)) ? " da" : ""}" data-vr="${esc(n)}" data-typ="${esc(t)}"${da.has(asEinNorm(n)) ? " disabled" : ""}>${da.has(asEinNorm(n)) ? "✓ " : "+ "}${esc(n)}</button>`).join("")}</div>
      <h3>Eigene Rolle</h3>
      <div class="form" id="einRForm">${asFeld("Name", "name", "", "text")}${asAuswahl("Typ", "typ", "eigen", Object.entries(TYP))}</div>
      <p><button type="button" class="btn klein" id="einRNeu">Rolle hinzufügen</button></p>
      <p class="hinweis">Rollen beschreiben Tätigkeiten. Über die Rolle bekommt jede Person genau die Unterweisungen, die sie braucht. Rolle antippen = ändern oder archivieren.</p></div></div>`;
  const neu = async (name, typ) => {
    if(!name) return;
    if(asEinRollenAktiv().some(r => asEinNorm(r.name) === asEinNorm(name))){ asMeldung("Diese Rolle gibt es schon."); return; }
    await apiSend("POST", "/rest/v1/uw_rolle", { kunde_slug: AS.kunde, name, typ: typ || "eigen" }, "return=minimal");
    asZeige();
  };
  const fehler = e => asMeldung("Nicht gespeichert: " + (e.message || e));
  box.querySelectorAll("[data-vr]").forEach(b => b.onclick = () => neu(b.dataset.vr, b.dataset.typ).catch(fehler));
  box.querySelector("#einRNeu").onclick = () => { const w = asWerte(box.querySelector("#einRForm")); neu(w.name, w.typ).catch(fehler); };
  box.querySelectorAll("[data-rid]").forEach(z => z.onclick = () => { const r = rollen.find(x => x.id === z.dataset.rid); if(!r) return;
    asDialog({ titel: r.name, inhalt: `<div class="form">${asFeld("Name", "name", r.name, "text", "voll")}${asAuswahl("Typ", "typ", r.typ || "eigen", Object.entries(TYP))}</div>
        <p class="hinweis">Personen und Zuordnungen behalten die Verknüpfung. Archivieren nimmt die Rolle aus allen Auswahllisten.</p>`,
      knoepfe: [{ t: "Archivieren", klasse: "sek", fn: async () => { await apiSend("PATCH", "/rest/v1/uw_rolle?id=eq." + encodeURIComponent(r.id), { status: "archiviert" }, "return=minimal"); asZeige(); } },
        { t: "Speichern", fn: async dl => { const w = asWerte(dl); if(!w.name){ asMeldung("Bitte einen Namen eintragen."); return false; }
          await apiSend("PATCH", "/rest/v1/uw_rolle?id=eq." + encodeURIComponent(r.id), { name: w.name, typ: w.typ }, "return=minimal"); asZeige(); } }] }); });
}

/* ---------------- 4 Personen (einzeln oder Import per Einfügen) ---------------- */
function asEinPersonen(box){
  const d = AS_EIN.d, pers = asEinPersAktiv(), einh = asT("as_einheit"), rollen = asEinRollenAktiv();
  const nm = (liste, ids) => ids.map(id => (liste.find(x => x.id === id) || {}).name).filter(Boolean).join(", ");
  box.innerHTML = `<div class="ein-zwei">
    <div class="ein-spalte"><h3>Beschäftigte (${pers.length})</h3>
      ${pers.length ? `<div class="tabwrap"><table class="tab"><tr><th>Name</th><th>Bereich</th><th>Rolle</th><th>Sprache</th></tr>
        ${pers.map(p => `<tr class="bda-klick" data-pid="${esc(p.id)}"><td><b>${esc(p.name)}</b></td><td>${esc(nm(einh, (p.uw_person_einheit || []).map(x => x.einheit_id)) || "–")}</td>
          <td>${(p.uw_person_rolle || []).length ? esc(nm(d.rollen, p.uw_person_rolle.map(x => x.rolle_id))) : asChip("ohne Rolle", "gelb")}</td><td>${esc(p.sprache || "de")}</td></tr>`).join("")}</table></div>`
        : `<div class="leer">Noch keine Beschäftigten – einzeln anlegen oder rechts aus Excel einfügen.</div>`}</div>
    <div class="ein-spalte"><h3>Aus Excel oder CSV einfügen</h3>
      <p class="hinweis">Spalten <b>Name · Bereich · Rolle · Sprache · Eintritt</b> (mit oder ohne Überschrift). In Excel markieren, kopieren und hier einfügen.</p>
      <textarea id="einPText" rows="6" placeholder="Name&#9;Bereich&#9;Rolle&#9;Sprache&#9;Eintritt&#10;Erika Muster&#9;Produktion&#9;Maschinenbediener&#9;de&#9;01.03.2024"></textarea>
      <label class="ein-check"><input type="checkbox" id="einPAnlegen" checked> fehlende Bereiche und Rollen mit anlegen</label>
      <p class="ein-knoepfe"><button type="button" class="btn sek klein" id="einPVor">Vorschau</button>
        <button type="button" class="btn klein" id="einPImp" disabled>Übernehmen</button>
        <button type="button" class="btn sek klein" id="einPNeu">Person einzeln anlegen</button></p>
      <div id="einPVorschau"></div></div></div>`;
  box.querySelector("#einPNeu").onclick = async () => { if(typeof asUwLaden === "function"){ await asUwLaden(true); asUwPersonDialog(null); } };
  box.querySelectorAll("[data-pid]").forEach(tr => tr.onclick = async () => { await asUwLaden(true);
    const p = AS_UW.d.pers.find(x => x.id === tr.dataset.pid); if(p) asUwPersonDialog(p); });
  let plan = null;
  box.querySelector("#einPVor").onclick = () => {
    plan = asEinPersonenPlan(box.querySelector("#einPText").value, box.querySelector("#einPAnlegen").checked);
    box.querySelector("#einPVorschau").innerHTML = asEinVorschauHtml(plan, ["Name", "Bereich", "Rolle", "Sprache", "Eintritt"],
      z => [z.name, z.bereich, z.rolle, z.sprache, z.eintritt ? asDat(z.eintritt) : ""]);
    box.querySelector("#einPImp").disabled = !plan.zeilen.some(z => !z.fehler);
    box.querySelector("#einPImp").textContent = "Übernehmen (" + plan.zeilen.filter(z => !z.fehler).length + ")";
  };
  box.querySelector("#einPImp").onclick = async ev => { if(!plan) return; ev.currentTarget.disabled = true;
    try{ const n = await asEinPersonenImport(plan); asMeldung(n + (n === 1 ? " Person" : " Personen") + " übernommen."); asZeige(); }
    catch(e){ asMeldung("Import fehlgeschlagen: " + (e.message || e)); if(window.OAK_FEHLER) window.OAK_FEHLER("einrichtung", "Personen-Import: " + (e.message || e), { kunde: AS.kunde }); ev.currentTarget.disabled = false; }
  };
}
/* Tabelle aus der Zwischenablage: Tab (Excel), Semikolon oder Komma; Überschrift wird erkannt */
function asEinTabelle(text, spalten){
  const zeilen = String(text || "").replace(/\r/g, "").split("\n").filter(z => z.trim());
  if(!zeilen.length) return [];
  const sep = zeilen[0].includes("\t") ? "\t" : zeilen[0].includes(";") ? ";" : ",";
  const teile = zeilen.map(z => z.split(sep).map(x => x.trim().replace(/^"(.*)"$/, "$1")));
  const kopf = teile[0].map(asEinNorm);
  let idx = spalten.map(s => kopf.findIndex(h => s.muster.test(h)));
  const mitKopf = idx.filter(i => i >= 0).length >= 1 && idx[0] >= 0;
  if(!mitKopf) idx = spalten.map((s, i) => i);
  return teile.slice(mitKopf ? 1 : 0).map(t => { const o = {}; spalten.forEach((s, i) => { o[s.k] = idx[i] >= 0 ? (t[idx[i]] || "") : ""; }); return o; });
}
function asEinDatum(s){
  s = String(s || "").trim(); if(!s) return { ok: true, wert: null };
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if(m){ const j = m[3].length === 2 ? "20" + m[3] : m[3]; const iso = j + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    return isNaN(Date.parse(iso)) ? { ok: false } : { ok: true, wert: iso }; }
  m = s.match(/^\d{4}-\d{2}-\d{2}$/);
  return m && !isNaN(Date.parse(s)) ? { ok: true, wert: s } : { ok: false };
}
function asEinSprache(s){
  const n = asEinNorm(s); if(!n) return "de";
  if(AS_EIN_SPRACHEN[n]) return n;
  const e = Object.entries(AS_EIN_SPRACHEN).find(([, t]) => asEinNorm(t) === n || asEinNorm(t).startsWith(n));
  return e ? e[0] : null;
}
function asEinPersonenPlan(text, anlegen){
  const roh = asEinTabelle(text, [{ k: "name", muster: /^(name|mitarbeiter|person|beschäftigte?r?)/ }, { k: "bereich", muster: /^(bereich|abteilung|kostenstelle|kst)/ },
    { k: "rolle", muster: /^(rolle|tätigkeit|taetigkeit|funktion)/ }, { k: "sprache", muster: /^sprach/ }, { k: "eintritt", muster: /^(eintritt|beginn)/ }]);
  const einh = asT("as_einheit"), rollen = asEinRollenAktiv(), vorh = new Set(asEinPersAktiv().map(p => asEinNorm(p.name))), gesehen = new Set();
  const neuB = new Set(), neuR = new Set();
  const zeilen = roh.map(z => {
    const f = [], h = [];
    if(!z.name || z.name.length < 3) f.push("Name fehlt");
    else if(vorh.has(asEinNorm(z.name))) f.push("gibt es schon");
    else if(gesehen.has(asEinNorm(z.name))) f.push("doppelt im Import");
    gesehen.add(asEinNorm(z.name));
    const e = z.bereich ? einh.find(x => asEinNorm(x.name) === asEinNorm(z.bereich)) : null;
    if(z.bereich && !e){ if(anlegen){ h.push("Bereich wird angelegt"); neuB.add(z.bereich.trim()); } else f.push("Bereich unbekannt"); }
    const r = z.rolle ? rollen.find(x => asEinNorm(x.name) === asEinNorm(z.rolle)) : null;
    if(z.rolle && !r){ if(anlegen){ h.push("Rolle wird angelegt"); neuR.add(z.rolle.trim()); } else f.push("Rolle unbekannt"); }
    if(!z.rolle) h.push("ohne Rolle");
    const sp = asEinSprache(z.sprache); if(!sp) f.push("Sprache unbekannt");
    const dt = asEinDatum(z.eintritt); if(!dt.ok) f.push("Eintritt kein Datum");
    return Object.assign({}, z, { sprache: sp || z.sprache, eintritt: dt.wert, fehler: f.join(", "), hinweis: h.join(", ") });
  });
  return { zeilen, neuB: [...neuB], neuR: [...neuR] };
}
function asEinVorschauHtml(plan, kopf, zellen){
  if(!plan.zeilen.length) return `<div class="leer">Nichts erkannt – bitte die Tabelle einfügen.</div>`;
  const ok = plan.zeilen.filter(z => !z.fehler).length;
  return `<p class="hinweis"><b>${ok} von ${plan.zeilen.length}</b> Zeilen übernehmbar${plan.zeilen.length - ok ? " · Zeilen mit Fehler werden nicht übernommen" : ""}.</p>
    <div class="tabwrap"><table class="tab"><tr>${kopf.map(k => `<th>${esc(k)}</th>`).join("")}<th>Prüfung</th></tr>
    ${plan.zeilen.map(z => `<tr>${zellen(z).map(x => `<td>${esc(x || "–")}</td>`).join("")}<td>${z.fehler ? asChip(z.fehler, "rot") : asChip(z.hinweis || "in Ordnung", z.hinweis ? "gelb" : "gruen")}</td></tr>`).join("")}</table></div>`;
}
async function asEinPersonenImport(plan){
  const zeilen = plan.zeilen.filter(z => !z.fehler); if(!zeilen.length) return 0;
  for(const n of plan.neuB) if(!asT("as_einheit").some(e => asEinNorm(e.name) === asEinNorm(n)))
    await asSpeichern("as_einheit", { name: n, art: "bereich", beschaeftigte: 0, schichten: 1, sort: asT("as_einheit").length + 1 });
  if(plan.neuR.length){ const da = asEinRollenAktiv().map(r => asEinNorm(r.name));
    const neu = plan.neuR.filter(n => !da.includes(asEinNorm(n)));
    if(neu.length) await apiSend("POST", "/rest/v1/uw_rolle", neu.map(n => ({ kunde_slug: AS.kunde, name: n, typ: /leih/i.test(n) ? "leiharbeit" : "eigen" })), "return=minimal"); }
  await asEinLaden();
  const einh = asT("as_einheit"), rollen = asEinRollenAktiv();
  const erg = await apiSend("POST", "/rest/v1/uw_person", zeilen.map(z => ({ kunde_slug: AS.kunde, name: z.name.trim(), sprache: z.sprache || "de",
    eintritt: z.eintritt, status: "aktiv" })), "return=representation") || [];
  const pe = [], pr = [];
  erg.forEach(p => { const z = zeilen.find(x => asEinNorm(x.name) === asEinNorm(p.name)); if(!z) return;
    const e = z.bereich && einh.find(x => asEinNorm(x.name) === asEinNorm(z.bereich)); if(e) pe.push({ person_id: p.id, einheit_id: e.id });
    const r = z.rolle && rollen.find(x => asEinNorm(x.name) === asEinNorm(z.rolle)); if(r) pr.push({ person_id: p.id, rolle_id: r.id }); });
  if(pe.length) await apiSend("POST", "/rest/v1/uw_person_einheit", pe, "return=minimal");
  if(pr.length) await apiSend("POST", "/rest/v1/uw_person_rolle", pr, "return=minimal");
  return erg.length;
}

/* ---------------- 5 Anlagen (einzeln oder Import; BdA- und PSA-Vorlage) ---------------- */
async function asEinVorlagen(){
  if(AS_EIN.vorlagen && AS_EIN.vorlagen.kunde === AS.kunde) return AS_EIN.vorlagen.liste;
  const hole = p => apiGet(p).then(r => r || []).catch(() => []);
  const vb = AS_EIN_VORLAGE_BETRIEB, kv = "&kunde_slug=eq." + encodeURIComponent(vb);
  const [docs, sys, gef] = await Promise.all([
    hole("/rest/v1/portal_dokumente?select=maschinen_id,maschine,maschinentyp,storage_path,kunde_slug&kategorie=eq.anlagen" + kv),
    hole("/rest/v1/as_arbeitssystem?select=id,quelle_id,stillgelegt_am&art=eq.anlage" + kv),
    hole("/rest/v1/as_gefaehrdung?select=arbeitssystem_id" + kv)]);
  const n = {}; gef.forEach(g => { n[g.arbeitssystem_id] = (n[g.arbeitssystem_id] || 0) + 1; });
  const fremd = docs.map(d => { const s = sys.find(x => x.quelle_id === d.maschinen_id && !x.stillgelegt_am); return Object.assign({}, d, { gef: s ? n[s.id] || 0 : 0 }); })
    .filter(d => d.gef >= 3 && d.maschinentyp && d.storage_path && !AS_EIN_JUNK.test(d.maschine || ""))
    .map(d => Object.assign(d, { label: d.maschinentyp + " – OAK-Vorlage (" + d.gef + " Gefährdungen)", oak: true }));
  const eigen = (AS_EIN.d.anl || []).filter(d => d.storage_path).map(d => Object.assign({}, d, { label: (d.maschinentyp ? d.maschinentyp + ": " : "") + d.maschine + " (eigene Anlage)" }));
  AS_EIN.vorlagen = { kunde: AS.kunde, liste: eigen.concat(fremd) };
  return AS_EIN.vorlagen.liste;
}
function asEinVorlageFuer(art, liste){
  const a = asEinNorm(art); if(!a) return null;
  return liste.find(v => !v.oak && asEinNorm(v.maschinentyp) === a) || liste.find(v => v.oak && asEinNorm(v.maschinentyp) === a)
    || liste.find(v => asEinNorm(v.maschinentyp).startsWith(a.slice(0, 8))) || null;
}
async function asEinAnlagen(box){
  const d = AS_EIN.d, liste = await asEinVorlagen(), psaAn = asEinBranche() === "kunststoff-spritzguss";
  const einhName = id => (asNach("as_einheit", id) || {}).name || "";
  const sysVon = mid => asT("as_arbeitssystem").find(s => asListe(s.anlagen).includes(mid));
  box.innerHTML = `<div class="ein-zwei">
    <div class="ein-spalte"><h3>Anlagen (${d.anl.length})</h3>
      <div class="zeilen">${d.anl.map(a => { const s = sysVon(a.maschinen_id), n = s ? asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id).length : 0;
          return `<div class="z" style="cursor:default"><div><b>${esc(a.maschine)}</b><small>${esc(a.maschinentyp || "ohne Maschinenart")}${s && s.einheit_id ? " · " + esc(einhName(s.einheit_id)) : ""} · ${n} Gefährdungen</small></div>${asChip(n ? "Beurteilung angelegt" : "Beurteilung leer", n ? "gruen" : "gelb")}</div>`; }).join("")
        || `<div class="leer">Noch keine Anlagen – rechts einzeln anlegen oder aus Excel einfügen.</div>`}</div></div>
    <div class="ein-spalte"><h3>Anlage anlegen</h3>
      <div class="form" id="einAForm">${asFeld("Bezeichnung (z. B. D250/3)", "name", "")}
        <label>Maschinenart<input type="text" data-f="art" list="einArten" value="${psaAn ? "Spritzgießmaschine" : ""}"></label>
        ${asFeld("Hersteller", "hersteller", "")}${asFeld("Baujahr", "baujahr", "")}
        ${asBereichWahl("Bereich", "einheit_id", "", "", "– noch keinem Bereich –")}
        ${asAuswahl("Beurteilung (BdA)", "vorlage", "auto", [["auto", "passend zur Maschinenart"], ["", "leer beginnen"]].concat(liste.map((v, i) => [String(i), v.label])))}
        <label class="ein-check voll"><input type="checkbox" data-f="psa"${psaAn ? " checked" : ""}> PSA-Matrix aus der Branchenvorlage übernehmen (Spritzgießmaschinen, DGUV Information 113-606)</label></div>
      <datalist id="einArten">${AS_EIN_ARTEN.map(a => `<option value="${esc(a)}">`).join("")}</datalist>
      <p class="ein-knoepfe"><button type="button" class="btn klein" id="einANeu">Anlage anlegen</button></p>
      <h3>Mehrere aus Excel einfügen</h3>
      <p class="hinweis">Spalten <b>Bezeichnung · Maschinenart · Bereich · Hersteller · Baujahr</b>. Beurteilung und PSA wie oben gewählt.</p>
      <textarea id="einAText" rows="4"></textarea>
      <p class="ein-knoepfe"><button type="button" class="btn sek klein" id="einAVor">Vorschau</button><button type="button" class="btn klein" id="einAImp" disabled>Übernehmen</button></p>
      <div id="einAVorschau"></div></div></div>`;
  const form = box.querySelector("#einAForm");
  const vorlageVon = (w, art) => w.vorlage === "auto" ? asEinVorlageFuer(art, liste) : w.vorlage === "" || w.vorlage == null ? null : liste[+w.vorlage] || null;
  const anlegen = async (w, vorlage, psa) => {
    const erg = await asAnlageAnlegen({ name: w.name, art: w.art || "", hersteller: w.hersteller || "", typ: "", baujahr: w.baujahr || "", seriennr: "", einheit_id: w.einheit_id || null, bereich: "" }, vorlage);
    if(psa && erg.sys && /spritzg/i.test(w.art || "") && typeof asPsaVorlageAnwenden === "function")
      await asPsaVorlageAnwenden(erg.sys, "kunststoff-spritzguss").catch(e => asMeldung("PSA-Vorlage nicht übernommen: " + (e.message || e)));
    return erg;
  };
  box.querySelector("#einANeu").onclick = async ev => { const w = asWerte(form), b = ev.currentTarget;
    if(!w.name){ asMeldung("Bitte die Bezeichnung eintragen."); return; }
    if(d.anl.some(a => asEinNorm(a.maschine) === asEinNorm(w.name))){ asMeldung("Diese Anlage gibt es schon."); return; }
    b.disabled = true; asMeldung("Anlage wird angelegt …");
    try{ const erg = await anlegen(w, vorlageVon(w, w.art), w.psa); asMeldung("Anlage " + w.name + " (" + erg.mid + ") angelegt."); AS_EIN.vorlagen = null; asZeige(); }
    catch(e){ asMeldung(e.message || String(e)); b.disabled = false; }
  };
  let plan = null;
  box.querySelector("#einAVor").onclick = () => {
    const roh = asEinTabelle(box.querySelector("#einAText").value, [{ k: "name", muster: /^(bezeichnung|anlage|maschine|name)/ },
      { k: "art", muster: /^(maschinenart|art|typ)/ }, { k: "bereich", muster: /^(bereich|abteilung|halle)/ }, { k: "hersteller", muster: /^herst/ }, { k: "baujahr", muster: /^bau/ }]);
    const einh = asT("as_einheit"), gesehen = new Set(d.anl.map(a => asEinNorm(a.maschine)));
    plan = { zeilen: roh.map(z => { const f = [];
      if(!z.name) f.push("Bezeichnung fehlt"); else if(gesehen.has(asEinNorm(z.name))) f.push("gibt es schon");
      gesehen.add(asEinNorm(z.name));
      const e = z.bereich ? einh.find(x => asEinNorm(x.name) === asEinNorm(z.bereich)) : null;
      if(z.bereich && !e) f.push("Bereich unbekannt");
      if(z.baujahr && !/^\d{4}$/.test(z.baujahr)) f.push("Baujahr vierstellig");
      const v = asEinVorlageFuer(z.art, liste);
      return Object.assign({}, z, { einheit_id: e ? e.id : null, fehler: f.join(", "), hinweis: v ? "Vorlage: " + v.label : "Beurteilung leer" }); }) };
    box.querySelector("#einAVorschau").innerHTML = asEinVorschauHtml(plan, ["Bezeichnung", "Maschinenart", "Bereich", "Baujahr"], z => [z.name, z.art, z.bereich, z.baujahr]);
    const ok = plan.zeilen.filter(z => !z.fehler).length, b = box.querySelector("#einAImp");
    b.disabled = !ok; b.textContent = "Übernehmen (" + ok + ")";
  };
  box.querySelector("#einAImp").onclick = async ev => { if(!plan) return; const w = asWerte(form), b = ev.currentTarget; b.disabled = true;
    const zeilen = plan.zeilen.filter(z => !z.fehler); let n = 0;
    for(const z of zeilen){
      asMeldung("Anlage " + (n + 1) + " von " + zeilen.length + " wird angelegt …");
      try{ await anlegen(Object.assign({}, z, { vorlage: w.vorlage }), vorlageVon(w, z.art), w.psa); n++; }
      catch(e){ asMeldung(z.name + ": " + (e.message || e)); break; }
    }
    AS_EIN.vorlagen = null; asMeldung(n + " von " + zeilen.length + " Anlagen angelegt."); asZeige();
  };
}

/* ---------------- 6 Unterweisung (Buchen nur OAK, Zuordnung Rolle → Modul, Terminal aus dem Cockpit) ---------------- */
function asEinUnterweisung(box){
  const d = AS_EIN.d, rollen = asEinRollenAktiv().filter(r => r.typ !== "besucher"), cockpit = ((d.k.rechte || {}).unterweisung || {}).quelle === "cockpit";
  const zugeordnet = (th, rid) => (d.zuw || []).some(z => z.thema === th && z.rolle_id === rid && z.aktiv !== false);
  const vorschlag = asEinVorschlag().module;
  const module = d.module.slice().sort((a, b) => (vorschlag.includes(b.thema) - vorschlag.includes(a.thema)) || (a.reihenfolge || 0) - (b.reihenfolge || 0));
  box.innerHTML = `<div class="ein-leiste">
      <button type="button" class="btn klein" id="einUVor">Vorschlag der Branche übernehmen</button>
      <label class="fl-schalter"><input type="checkbox" id="einUQuelle"${cockpit ? " checked" : ""}> Terminal nutzt die Zuordnung aus dem Cockpit</label>
      <span class="hinweis">Häkchen = für den Betrieb gebucht (nur OAK) · Rolle antippen = Modul gilt für diese Rolle</span></div>
    <div class="zeilen ein-module">${module.map(m => { const gb = asEinGebucht(m.thema);
      return `<div class="z ein-modul${gb ? "" : " aus"}"><label class="ein-modul-titel" title="${esc(m.titel + (m.untertitel ? " – " + m.untertitel : ""))}"><input type="checkbox" data-buch="${esc(m.thema)}"${gb ? " checked" : ""}> <b>${esc(m.titel)}</b>${vorschlag.includes(m.thema) ? ` <span class="hinweis">empfohlen</span>` : ""}</label>
        <div class="ein-chips">${gb ? rollen.map(r => `<button type="button" class="ein-chip${zugeordnet(m.thema, r.id) ? " an" : ""}" data-zw="${esc(m.thema)}" data-rolle="${esc(r.id)}" title="${esc(r.name)}">${esc(r.name)}</button>`).join("") || `<span class="hinweis">Noch keine Rollen</span>` : `<span class="hinweis">nicht gebucht</span>`}</div></div>`; }).join("")
      || `<div class="leer">Keine Module im Katalog.</div>`}</div>`;
  const neu = async () => { await asEinLaden(); asZeige(); };
  const fehler = e => asMeldung("Nicht gespeichert: " + (e.message || e));
  box.querySelectorAll("[data-buch]").forEach(cb => cb.onchange = async () => { cb.disabled = true;
    try{
      if(cb.checked) await apiSend("POST", "/rest/v1/uw_buchung?on_conflict=kunde_slug,thema", { kunde_slug: AS.kunde, thema: cb.dataset.buch, aktiv: true }, "resolution=merge-duplicates,return=minimal");
      else await apiSend("DELETE", "/rest/v1/uw_buchung?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&thema=eq." + encodeURIComponent(cb.dataset.buch), null, "return=minimal");
      await neu();
    }catch(e){ fehler(e); cb.disabled = false; } });
  box.querySelectorAll("[data-zw]").forEach(b => b.onclick = async () => { b.disabled = true;
    const th = b.dataset.zw, rid = b.dataset.rolle;
    try{
      if(!b.classList.contains("an")) await apiSend("POST", "/rest/v1/uw_modul_zuweisung", { kunde_slug: AS.kunde, thema: th, rolle_id: rid, aktiv: true, geaendert_von: AS.ich || "OAK" }, "resolution=merge-duplicates,return=minimal");
      else await apiSend("DELETE", "/rest/v1/uw_modul_zuweisung?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&thema=eq." + encodeURIComponent(th) + "&rolle_id=eq." + encodeURIComponent(rid), null, "return=minimal");
      await neu();
    }catch(e){ fehler(e); b.disabled = false; } });
  box.querySelector("#einUQuelle").onchange = async ev => {
    try{ await asEinRechte({ unterweisung: Object.assign({}, (d.k.rechte || {}).unterweisung || {}, { quelle: ev.target.checked ? "cockpit" : "konfiguration" }) }); await neu(); }
    catch(e){ fehler(e); } };
  box.querySelector("#einUVor").onclick = async ev => { ev.currentTarget.disabled = true;
    try{ const n = await asEinUwVorschlag(); asMeldung(n.buchung + " Module gebucht, " + n.zuweisung + " Zuordnungen Rolle → Modul übernommen."); await neu(); }
    catch(e){ fehler(e); ev.currentTarget.disabled = false; } };
}
async function asEinUwVorschlag(){
  const d = AS_EIN.d, vorschlag = asEinVorschlag().module.filter(th => d.module.some(m => m.thema === th));
  const fehlt = vorschlag.filter(th => !asEinGebucht(th));
  if(fehlt.length) await apiSend("POST", "/rest/v1/uw_buchung?on_conflict=kunde_slug,thema", fehlt.map(thema => ({ kunde_slug: AS.kunde, thema, aktiv: true })), "resolution=merge-duplicates,return=minimal");
  const rollen = asEinRollenAktiv().filter(r => r.typ !== "besucher"), zuw = [];
  vorschlag.forEach(th => { const re = AS_EIN_MODUL_ROLLE[th]; if(!re) return;
    rollen.filter(r => re.test(r.name) && !(d.zuw || []).some(z => z.thema === th && z.rolle_id === r.id)).forEach(r => zuw.push({ kunde_slug: AS.kunde, thema: th, rolle_id: r.id, aktiv: true, geaendert_von: AS.ich || "OAK" })); });
  if(zuw.length) await apiSend("POST", "/rest/v1/uw_modul_zuweisung", zuw, "resolution=merge-duplicates,return=minimal");
  if(((d.k.rechte || {}).unterweisung || {}).quelle !== "cockpit") await asEinRechte({ unterweisung: Object.assign({}, (d.k.rechte || {}).unterweisung || {}, { quelle: "cockpit" }) });
  await apiSend("POST", "/rest/v1/rpc/uw_inhalt_vorschlag_anwenden", { p_slug: AS.kunde }).catch(() => 0);   // neuer Katalog (Inhalte), sobald gebucht
  return { buchung: fehlt.length, zuweisung: zuw.length };
}

/* ---------------- 7 Terminal & Melden ---------------- */
function asEinTerminal(box){
  const d = AS_EIN.d, ger = asEinGeraete(), melde = (d.mt[0] || {}).token || "", abo = (d.abo || []);
  box.innerHTML = `<div class="ein-zwei ein-drei">
    <div class="ein-spalte"><h3>Unterweisungs-Terminal</h3>
      <div class="zeilen">${ger.map(t => `<div class="z" data-tok="${esc(t.token)}"><div><b>${esc(t.bezeichnung || "Terminal")}</b><small>eingerichtet ${esc(asDat(String(t.angelegt_am || "").slice(0, 10)))} · antippen für Link und QR</small></div></div>`).join("")
        || `<div class="leer">Noch kein Gerät.</div>`}</div>
      <div class="form" id="einTForm">${asFeld("Bezeichnung des Geräts", "bez", ger.length ? "" : "Tablet Pausenraum", "text", "voll")}</div>
      <p class="ein-knoepfe"><button type="button" class="btn klein" id="einTNeu">Gerät einrichten</button></p>
      <p class="hinweis">Jedes feste Gerät bekommt einen eigenen Link. Geht es verloren, wird nur dieses gesperrt.</p></div>
    <div class="ein-spalte"><h3>Vorfall melden (QR, ohne Login)</h3>
      ${melde ? `<p>Melde-Code <b class="code">${esc(melde)}</b></p>` : `<div class="leer">Noch kein Melde-Code.</div>`}
      <p class="ein-knoepfe">${melde ? `<button type="button" class="btn klein" id="einMAushang">Aushang drucken</button>` : `<button type="button" class="btn klein" id="einMNeu">Melde-Code erzeugen</button>`}</p>
      <p class="hinweis">Beschäftigte melden Unfälle, Beinahe-Unfälle und unsichere Zustände über den QR-Code am Aushang.</p></div>
    <div class="ein-spalte"><h3>Erinnerung an Fristen</h3>
      <div class="zeilen">${abo.map(a => `<div class="z" style="cursor:default"><div><b>${esc(a.name || a.email)}</b><small>${esc(a.email)} · ${esc({ taeglich: "täglich", woechentlich: "wöchentlich", monatlich: "monatlich", aus: "aus" }[a.rhythmus] || a.rhythmus)}</small></div></div>`).join("")
        || `<div class="leer">Noch kein Empfänger.</div>`}</div>
      <div class="form" id="einEForm">${asFeld("Name", "name", "")}${asFeld("E-Mail", "email", "", "email")}</div>
      <p class="ein-knoepfe"><button type="button" class="btn klein" id="einENeu">Empfänger hinzufügen</button></p>
      <p class="hinweis">Wöchentliche Sammelmail (montags) mit fälligen Prüfungen, Unterweisungen und Maßnahmen.</p></div></div>`;
  const fehler = e => asMeldung("Nicht gespeichert: " + (e.message || e));
  box.querySelectorAll("[data-tok]").forEach(z => z.onclick = () => asGeraetLink(z.dataset.tok, (ger.find(t => t.token === z.dataset.tok) || {}).bezeichnung));
  box.querySelector("#einTNeu").onclick = async () => { const w = asWerte(box.querySelector("#einTForm"));
    try{ const tok = await apiSend("POST", "/rest/v1/rpc/terminal_geraet_anlegen", { p_slug: AS.kunde, p_bezeichnung: w.bez || "" });
      await asEinLaden(); asZeige(); setTimeout(() => asGeraetLink(tok, w.bez), 0); }
    catch(e){ fehler(e); } };
  const mn = box.querySelector("#einMNeu"); if(mn) mn.onclick = async () => {
    try{ await apiSend("POST", "/rest/v1/rpc/portal_melde_token_erneuern", { p_slug: AS.kunde }); if(typeof AS_VF === "object") AS_VF.kunde = null; await asEinLaden(); asZeige(); }
    catch(e){ fehler(e); } };
  const ma = box.querySelector("#einMAushang"); if(ma) ma.onclick = () => asAushangVorfall(melde);
  box.querySelector("#einENeu").onclick = async () => { const w = asWerte(box.querySelector("#einEForm"));
    if(!w.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.email)){ asMeldung("Bitte eine gültige E-Mail-Adresse eintragen."); return; }
    try{ await apiSend("POST", "/rest/v1/portal_erinnerung_abo", { kunde_slug: AS.kunde, email: w.email, name: w.name || null, rhythmus: "woechentlich", wochentag: 1,
        angelegt_von: (AS.ich || "OAK") + " (Einrichtung)" }, "return=minimal");
      await asEinLaden(); asZeige(); }
    catch(e){ fehler(e); } };
}

/* ---------------- 8 Zugänge (Geschäftsführung + Fachkraft) + Testphase ---------------- */
function asEinZugangSchritt(box){
  const d = AS_EIN.d, zg = AS_EIN.zg, test = !!(d.k.rechte || {}).testphase;
  const hat = { gf: (zg || []).filter(z => z.gf), fachkraft: (zg || []).filter(z => z.rolle === "fachkraft" && !z.gf) };
  const karte = (art, titel, text) => { const neu = AS_EIN.zugang.find(z => z.art === art);
    return `<div class="ein-spalte"><h3>${esc(titel)}</h3>
      <div class="zeilen">${hat[art].map(z => `<div class="z" style="cursor:default"><div><b>${esc(z.name || z.email)}</b><small>${esc(z.email)}</small></div>${asChip(z.gesperrt ? "gesperrt" : "angelegt", z.gesperrt ? "grau" : "gruen")}</div>`).join("")
        || `<div class="leer">Noch kein Zugang.</div>`}</div>
      ${neu ? `<div class="ein-zugang" data-art="${art}"><p><b>Zugangsdaten – jetzt weitergeben, sie werden nicht gespeichert</b></p>
          <p>Anmeldung: www.oak-engineering.de/portal2/<br>E-Mail: <b>${esc(neu.email)}</b><br>Passwort: <b class="code">${esc(neu.pw)}</b></p>
          <p><button type="button" class="btn sek klein" data-kopie="${art}">Zugangsdaten kopieren</button></p></div>`
        : `<div class="form" data-zform="${art}">${asFeld("Name", "name", "", "text", "voll")}${asFeld("E-Mail-Adresse (Anmeldename)", "email", "", "email", "voll")}
          ${asFeld("Erstes Passwort", "pw", asZgPasswort(), "text", "voll")}</div>
          <p class="ein-knoepfe"><button type="button" class="btn klein" data-zneu="${art}">Zugang anlegen</button></p>`}
      <p class="hinweis">${esc(text)}</p></div>`; };
  box.innerHTML = (zg ? "" : `<p class="hinweis">Die Zugänge konnten nicht geladen werden – bitte neu laden.</p>`) + `<div class="ein-zwei ein-drei">
    ${karte("gf", "Geschäftsführung", "Gibt Beurteilungen frei und verwaltet alle Zugänge des Betriebs.")}
    ${karte("fachkraft", "Fachkraft des Betriebs", "Pflegt alles im Betrieb (Anlagen, Personen, Unterweisung), legt zur Freigabe vor.")}
    <div class="ein-spalte"><h3>Testphase</h3>
      <label class="ein-check"><input type="checkbox" id="einTest"${test ? " checked" : ""}> Testbetrieb (Hinweisband „nur Testdaten“, Feedback an OAK)</label>
      <p class="hinweis">Nur für Demo- und Testbetriebe einschalten. Echte Betriebe arbeiten ohne Hinweisband.</p>
      <p class="hinweis">Weitere Zugänge (Meister, Schichtführer, Bereiche) legt der Betrieb später selbst an: Organisation → Zugänge &amp; Geräte.</p></div></div>`;
  box.querySelectorAll("[data-zneu]").forEach(b => b.onclick = async () => { const art = b.dataset.zneu, w = asWerte(box.querySelector(`[data-zform="${art}"]`));
    if(!w.name || !w.email){ asMeldung("Bitte Name und E-Mail-Adresse eintragen."); return; }
    if(!w.pw || w.pw.length < 10){ asMeldung("Das Passwort braucht mindestens 10 Zeichen."); return; }
    b.disabled = true;
    try{ await asZgAufruf({ aktion: "anlegen", name: w.name, email: w.email, passwort: w.pw, rolle: art === "gf" ? "kunde" : "fachkraft", gf: art === "gf", kunde: AS_EIN.d.k.name }); }
    catch(e){ asMeldung(e.message || String(e)); b.disabled = false; return; }
    AS_EIN.zugang = AS_EIN.zugang.filter(z => z.art !== art).concat([{ art, slug: AS.kunde, email: w.email, pw: w.pw }]);
    await asEinZugaenge(true); asZeige(); asMeldung("Zugang angelegt – Zugangsdaten jetzt weitergeben."); });
  box.querySelectorAll("[data-kopie]").forEach(b => b.onclick = async () => { const z = AS_EIN.zugang.find(x => x.art === b.dataset.kopie); if(!z) return;
    const text = "EHS-Cockpit " + AS_EIN.d.k.name + "\nAnmeldung: https://www.oak-engineering.de/portal2/\nE-Mail: " + z.email + "\nPasswort: " + z.pw;
    try{ await navigator.clipboard.writeText(text); asMeldung("Zugangsdaten kopiert."); }catch(e){ asMeldung("Kopieren nicht möglich – bitte abschreiben."); } });
  box.querySelector("#einTest").onchange = async ev => { try{ await asEinRechte({ testphase: ev.target.checked }); asZeige(); if(typeof asTpRechte === "function") asTpRechte().then(() => typeof asTpBand === "function" && asTpBand()); }
    catch(e){ asMeldung("Nicht gespeichert: " + (e.message || e)); } };
}

/* ---------------- 9 Abschluss: Prüfliste „Betrieb startklar“ ---------------- */
function asEinPruefliste(){
  const d = AS_EIN.d, st = asEinStatus(), k = d.k || {}, sys = asT("as_arbeitssystem").filter(s => !s.stillgelegt_am);
  const marke = k.marke && (k.marke.logo || k.marke.farbe);
  return [
    { s: 1, t: "Stammdaten und Branche", ok: st.stamm.ok, info: st.stamm.text, pflicht: true },
    { s: 2, t: "Bereiche der Organisation", ok: st.bereiche.ok, info: st.bereiche.text, pflicht: true },
    { s: 3, t: "Rollen", ok: st.rollen.ok, info: st.rollen.text, pflicht: true },
    { s: 4, t: "Beschäftigte mit Rolle", ok: st.personen.ok, info: st.personen.text, pflicht: true },
    { s: 5, t: "Anlagen", ok: st.anlagen.ok, info: st.anlagen.text, pflicht: true },
    { s: 6, t: "Unterweisung zugeordnet", ok: st.unterweisung.ok, info: st.unterweisung.text, pflicht: true },
    { s: 7, t: "Terminal und Melden", ok: st.terminal.ok, info: st.terminal.text, pflicht: true },
    { s: 8, t: "Zugänge GF und Fachkraft", ok: st.zugaenge.ok, info: st.zugaenge.text, pflicht: true },
    { s: 1, t: "Logo und Farben", ok: !!marke, info: marke ? "festgelegt" : "OAK-Standard", pflicht: false },
    { s: 0, t: "AVV abgeschlossen", ok: !!k.avv_abgeschlossen_am, info: k.avv_abgeschlossen_am ? asDat(k.avv_abgeschlossen_am) : "vor echten Personendaten", pflicht: false },
    { s: 5, t: "Prüfkataster angelegt", ok: asT("as_pruefobjekt").some(x => x.aktiv !== false), info: asT("as_pruefobjekt").filter(x => x.aktiv !== false).length + " Prüfobjekte (vor erster Verwendung)", pflicht: false },
    { s: 0, t: "Beurteilungen freigegeben", ok: sys.length > 0 && sys.every(x => x.freigabe_am), info: sys.filter(x => x.freigabe_am).length + " von " + sys.length + " · Aufgabe der GF", pflicht: false },
  ];
}
function asEinAbschluss(box){
  const l = asEinPruefliste(), offen = l.filter(x => x.pflicht && !x.ok), fertig = (AS_EIN.d.k.einrichtung || {}).abgeschlossen_am;
  box.innerHTML = `<div class="ein-start ${offen.length ? "offen" : "ok"}"><b>${offen.length ? "Noch nicht startklar" : "Betrieb startklar"}</b>
      <span>${offen.length ? offen.length + (offen.length === 1 ? " Punkt fehlt" : " Punkte fehlen") + " – antippen führt zum Schritt." : fertig ? "Einrichtung abgeschlossen am " + esc(asDat(fertig)) + "." : "Alles eingerichtet. „Abschließen“ übergibt den Betrieb."}</span></div>
    <div class="zeilen ein-pruef">${l.map((x, i) => `<div class="z" data-pr="${i}" title="${esc(x.t + " – " + x.info)}"><div><b>${asPunkt(x.ok ? "gruen" : x.pflicht ? "rot" : "gelb")}${esc(x.t)}</b><small>${esc(x.info)}</small></div>
      ${asChip(x.ok ? "erledigt" : x.pflicht ? "fehlt" : "offen", x.ok ? "gruen" : x.pflicht ? "rot" : "gelb")}</div>`).join("")}</div>`;
  box.querySelectorAll("[data-pr]").forEach(z => z.onclick = () => { const x = l[+z.dataset.pr];
    if(x.s) asEinGehe(x.s); else if(/AVV/.test(x.t)) asGehe("organisation/grund"); else asGehe("bda"); });
}
async function asEinAbschliessen(){
  await asEinLaden(); await asEinZugaenge(true);
  const offen = asEinPruefliste().filter(x => x.pflicht && !x.ok);
  if(offen.length){ asMeldung("Noch nicht startklar: " + offen.map(x => x.t).join(", ")); asZeige(); return; }
  await asEinSpeichern({ schritt: 9, abgeschlossen_am: asHeute(), abgeschlossen_von: AS.ich || "OAK", erledigt: { abschluss: asHeute() } });
  asMeldung(AS_EIN.d.k.name + " ist startklar.");
  asZeige();
}

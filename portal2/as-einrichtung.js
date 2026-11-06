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

const AS_EIN_SCHRITTE = [["stamm", "Stammdaten"], ["profil", "Betriebsprofil"], ["bereiche", "Bereiche"], ["rollen", "Rollen"], ["personen", "Personen"], ["anlagen", "Anlagen"],
  ["unterweisung", "Unterweisung"], ["terminal", "Terminal & Melden"], ["zugaenge", "Zugänge"], ["abschluss", "Startklar"]];
const AS_EIN_N = AS_EIN_SCHRITTE.length;
function asEinNr(k){ return AS_EIN_SCHRITTE.findIndex(s => s[0] === k) + 1; }
/* Kurztitel für die Fortschrittsleiste (einzeilig bei 1400 px), voller Titel im Tooltip und in der Kartenüberschrift */
const AS_EIN_KURZ = { stamm: "Stamm", profil: "Profil", unterweisung: "Schulung", terminal: "Terminal" };
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
  laerm: /bedien|einricht|produktion|werkzeug|instand|maschin|monteur/i, bildschirmarbeit: /büro|buero|verwaltung|kaufm|vertrieb/i, hallenkran: /kran|einricht|instand/i,
  "externe-besucher": /fremd|besuch|extern/i };
const AS_EIN_ARTEN = ["Spritzgießmaschine", "Roboterzelle", "Granulatförderer", "Trockner", "Fräsmaschine", "Drehmaschine", "Ständerbohrmaschine",
  "Bandsäge", "Schleifmaschine", "Presse", "Kompressor", "Gabelstapler", "Hallenkran", "Regalanlage"];
const AS_EIN_SPRACHEN = { de: "Deutsch", en: "Englisch", tr: "Türkisch", pl: "Polnisch", ro: "Rumänisch", ru: "Russisch", uk: "Ukrainisch",
  ar: "Arabisch", it: "Italienisch", hr: "Kroatisch", bg: "Bulgarisch" };
/* OAK-Vorlagebetrieb für Beurteilungen (BdA) je Maschinentyp – Testbetrieb, keine Kundendaten; Rückstände von Testläufen fallen raus */
const AS_EIN_VORLAGE_BETRIEB = "durchlauf";
const AS_EIN_JUNK = /\d{6}|\bNT\d+\b|ABN-|Nachtest|Kopie|\bLeer\b|\bEW\b/i;

const AS_EIN = { neu: false, d: null, zg: null, zgSlug: null, zugang: [], vorlagen: null, laeuft: false, pTeil: 0, p: null, imp: {} };

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
/* Vorschlag der Branche, angepasst an das Betriebsprofil: Module zu Tätigkeiten, die es laut Profil nicht gibt, fallen weg;
   Module aus übernommenen Profil-Empfehlungen kommen dazu (Zuordnung zu Rollen dann in Schritt „Unterweisung“). */
function asEinVorschlag(){
  const v = AS_EIN_VORSCHLAG[asEinBranche()] || AS_EIN_VORSCHLAG.sonstige, p = asEinProfilDaten();
  if(!p || !Array.isArray(p.taetig)) return v;
  const hat = k => p.taetig.includes(k), laerm = p.laerm === "80" || p.laerm === "85" || p.laerm === "unbekannt";
  const weg = { flurfoerderzeuge: !hat("stapler"), gefahrstoffe: !hat("gefahrstoffe"), laerm: !laerm, bildschirmarbeit: !hat("buero"),
    hallenkran: !hat("krane"), "leitern-tritte": !hat("leitern"), "maschinenbedienung-spritzguss": !hat("maschinen") };
  const dazu = asEinEmpfehlungen(p).filter(e => (p.uebernommen || {})[e.id]).flatMap(e => e.aktionen.filter(a => a.typ === "modul").map(a => a.thema));
  return Object.assign({}, v, { module: [...new Set(v.module.filter(m => !weg[m]).concat(dazu))] });
}
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
  const pr = ((d.k.einrichtung || {}).profil) || null, nUeb = pr ? Object.keys(pr.uebernommen || {}).length : 0;
  st.profil = { ok: !!(pr && pr.beantwortet_am), text: pr && pr.beantwortet_am ? "beantwortet · " + nUeb + (nUeb === 1 ? " Empfehlung" : " Empfehlungen") + " übernommen" : "Fragen noch offen" };
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
  st.abschluss = { ok: AS_EIN_SCHRITTE.slice(0, -1).every(([k]) => st[k] && st[k].ok), text: (d.k.einrichtung || {}).abgeschlossen_am ? "abgeschlossen " + asDat(d.k.einrichtung.abgeschlossen_am) : "" };
  return st;
}

/* ---------------- Seite ---------------- */
AS_SEITEN.einrichtung = { titel: "Einrichtung", icon: "einrichtung", sort: 9.4, get versteckt(){ return !asDarf("oak"); }, async render(main){
  if(!asDarf("oak")){ main.innerHTML = `<h1 class="seite">Einrichtung</h1><div class="leer">Nur für OAK.</div>`; return; }
  main.innerHTML = `<h1 class="seite">Betrieb einrichten</h1><p class="unter">wird geladen …</p>`;
  if(!AS_EIN.neu) await asEinLaden(); else AS_EIN.d = null;
  if(!AS_EIN.neu && AS_EIN.d.k && !AS.reiter.einrichtung) AS.reiter.einrichtung = String((AS_EIN.d.k.einrichtung || {}).schritt || 1);
  let nr = Math.min(AS_EIN_N, Math.max(1, parseInt(AS.reiter.einrichtung, 10) || 1));
  if(AS_EIN.neu) nr = 1;
  const [schl, titel] = AS_EIN_SCHRITTE[nr - 1];
  if(["zugaenge", "abschluss"].includes(schl) || (nr > 1 && !AS_EIN.zg)) await asEinZugaenge(schl === "zugaenge");
  /* Bereichsauswahl (as-bereich.js) und Beurteilungen frisch, wenn Anlagen angelegt oder geprüft werden */
  if(!AS_EIN.neu && ["anlagen", "abschluss"].includes(schl)) await asLaden().catch(() => {});
  const st = AS_EIN.neu ? {} : asEinStatus(), name = AS_EIN.neu ? "Neuer Betrieb" : (AS_EIN.d.k ? AS_EIN.d.k.name : AS.kunde);
  const fertig = !AS_EIN.neu && AS_EIN.d.k && (AS_EIN.d.k.einrichtung || {}).abgeschlossen_am;
  main.innerHTML = `<h1 class="seite">Betrieb einrichten</h1>
    <p class="unter">${esc(name)} · Schritt ${nr} von ${AS_EIN_N}${fertig ? " · Einrichtung abgeschlossen am " + esc(asDat(AS_EIN.d.k.einrichtung.abgeschlossen_am)) : ""}</p>
    <div class="ein-wrap" id="einWrap">
      <div class="ein-schritte nodruck">${AS_EIN_SCHRITTE.map(([k, t], i) => `<button type="button" class="ein-s${i + 1 === nr ? " an" : ""}${st[k] && st[k].ok ? " ok" : ""}"
          data-ein="${i + 1}" title="${esc(t + (st[k] ? " – " + st[k].text : ""))}"${AS_EIN.neu && i > 0 ? " disabled" : ""}><b>${st[k] && st[k].ok ? "✓" : i + 1}</b><span>${esc(AS_EIN_KURZ[k] || t)}</span></button>`).join("")}</div>
      <div class="karte ein-karte"><h2>${nr} · ${esc(titel)} <span>${st[schl] ? asChip(st[schl].ok ? "erledigt" : "offen", st[schl].ok ? "gruen" : "grau") : asChip("neu", "grau")}</span></h2>
        <div class="ein-inhalt" id="einInhalt"></div></div>
      <div class="ein-fuss nodruck">
        <button type="button" class="btn sek" id="einZurueck"${nr === 1 ? " disabled" : ""}>Zurück</button>
        <span class="ein-fuss-mitte hinweis" id="einHinweis">${st[schl] ? esc(st[schl].text) : "Firmenname, Kurzname und Branche genügen für den Start."}</span>
        <button type="button" class="btn sek" id="einSpaeter"${AS_EIN.neu ? " disabled" : ""}><span class="ein-lang">Später fortsetzen</span><span class="ein-kurz">Später</span></button>
        <button type="button" class="btn" id="einWeiter">${nr === AS_EIN_N ? "Abschließen" : AS_EIN.neu ? "Anlegen und weiter" : "Weiter"}</button></div>
    </div>`;
  const box = document.getElementById("einInhalt");
  const zeichner = { stamm: asEinStamm, profil: asEinProfil, bereiche: asEinBereiche, rollen: asEinRollen, personen: asEinPersonen, anlagen: asEinAnlagen,
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
      if(schl === "profil" && !(await asEinProfilWeiter(box))) return;
      if(schl === "abschluss"){ await asEinAbschliessen(); return; }
      await asEinLaden(); const s2 = asEinStatus();
      await asEinSpeichern({ schritt: nr + 1, erledigt: s2[schl] && s2[schl].ok ? { [schl]: asHeute() } : {} });
      asEinGehe(nr + 1);
    }catch(e){ asMeldung("Nicht gespeichert: " + (e.message || e)); }
    finally{ AS_EIN.laeuft = false; b.disabled = false; }
  };
  asEinHoehe(); setTimeout(asEinHoehe, 400); setTimeout(asEinHoehe, 1500);   // Hinweisband/Kundenlogo können nach dem Zeichnen noch Höhe ändern
}};
function asEinGehe(nr){ nr = Math.min(AS_EIN_N, Math.max(1, nr)); AS.reiter.einrichtung = String(nr);
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

/* ---------------- 2 Betriebsprofil (Fragebogen → Empfehlungen mit Rechtsgrundlage) ----------------
   Antworten in portal_kunde.einrichtung.profil (RPC portal_einrichtung_profil, SQL stufe15) – auch in Organisation › Grunddaten änderbar.
   Empfehlungen nur, wo die Pflicht im Rechtskataster (references/rechtskataster/) belegt ist; hängt sie von der Gefährdungsbeurteilung
   oder der Zählweise ab, heißt sie „prüfen“. Nichts wird ohne Häkchen übernommen. */
const AS_EIN_FRAGEN = [
  { titel: "Betrieb", fragen: [
    { k: "ma", t: "Beschäftigte gesamt (Köpfe, mit Azubis)", typ: "zahl" },
    { k: "azubi", t: "davon Auszubildende", typ: "zahl" },
    { k: "leih", t: "zusätzlich Leiharbeit (Köpfe)", typ: "zahl" },
    { k: "schicht", t: "Schichtbetrieb", typ: "eins", opt: [["eine", "eine Schicht"], ["zwei", "zwei Schichten"], ["drei", "drei Schichten"], ["konti", "rund um die Uhr"]] },
    { k: "br", t: "Betriebsrat", typ: "eins", opt: [["ja", "ja"], ["nein", "nein"]] },
    { k: "standorte", t: "Standorte", typ: "eins", opt: [["1", "einer"], ["2", "zwei"], ["3", "drei und mehr"]] },
    { k: "hallen", t: "Hallen / Gebäude", typ: "eins", opt: [["1", "eine"], ["2", "zwei"], ["3", "drei"], ["4", "vier und mehr"]] }] },
  { titel: "Tätigkeiten", fragen: [
    { k: "taetig", t: "Was gibt es im Betrieb? (mehrere möglich)", typ: "mehr", opt: [["maschinen", "Maschinen"], ["gefahrstoffe", "Gefahrstoffe"],
      ["stapler", "Stapler / Flurförderzeuge"], ["krane", "Krane"], ["leitern", "Leitern und Tritte"], ["buero", "Büro / Bildschirm"],
      ["fremdfirmen", "Fremdfirmen"], ["besucher", "Besucher"]] },
    { k: "laerm", t: "Lärm am Arbeitsplatz", typ: "eins", opt: [["nein", "unter 80 dB(A)"], ["80", "über 80 dB(A)"], ["85", "ab 85 dB(A)"], ["unbekannt", "weiß nicht"]] }] },
  { titel: "Betreuung", fragen: [
    { k: "betreuung", t: "Betreuungsmodell", typ: "eins", opt: [["regel", "Regelbetreuung"], ["unternehmer", "Unternehmermodell"], ["unklar", "weiß nicht"]] },
    { k: "sifa", t: "Fachkraft für Arbeitssicherheit", typ: "eins", opt: [["extern", "extern bestellt"], ["intern", "eigene bestellt"], ["keine", "keine bestellt"]] },
    { k: "ba", t: "Betriebsarzt", typ: "eins", opt: [["ja", "bestellt"], ["nein", "nicht bestellt"]] },
    { k: "unterlagen", t: "Vorhandene Unterlagen (mehrere möglich)", typ: "mehr", opt: [["bda", "Gefährdungsbeurteilungen"], ["ba", "Betriebsanweisungen"],
      ["pruefkataster", "Prüfkataster"], ["uw_nachweise", "Unterweisungsnachweise"]] }] },
  { titel: "Empfehlungen", fragen: [] }];
const AS_EIN_SCHICHT = { eine: "Einschichtbetrieb", zwei: "Zweischichtbetrieb", drei: "Dreischichtbetrieb", konti: "Vollkontinuierlich (rund um die Uhr)" };

function asEinProfilDaten(){
  if(AS_EIN.p && AS_EIN.p.slug === AS.kunde) return AS_EIN.p.d;
  return AS_EIN.d && AS_EIN.d.k && AS_EIN.d.slug === AS.kunde ? (AS_EIN.d.k.einrichtung || {}).profil || null : null;
}
/* Termin-Vorschlag: in etwa vier Wochen, Dienstag (nie Freitag/Wochenende) */
function asEinTerminVorschlag(tage){
  const x = new Date(); x.setDate(x.getDate() + (tage || 28));
  while(x.getDay() !== 2) x.setDate(x.getDate() + 1);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
/* Empfehlungen aus dem Profil. stufe: pflicht (Rechtspflicht greift laut Angabe) · pruefen (hängt von GBU/Zählweise ab) · hinweis (ohne Übernahme).
   aktionen: modul (uw_buchung), termin (portal_termin mit Rechtsgrundlage), vorgabe (merkt sich der Assistent, z. B. Gehörschutz je Anlage), rolle (uw_rolle). */
function asEinEmpfehlungen(p, org){
  p = p || {}; org = org || asOrgDaten();
  const l = [], ma = +p.ma || 0, leih = +p.leih || 0, t = Array.isArray(p.taetig) ? p.taetig : [], hat = k => t.includes(k);
  const neu = (id, stufe, titel, grund, aktionen) => l.push({ id, stufe, titel, grund, aktionen: aktionen || [] });
  const termin = (titel, grundlage, tage, art) => ({ typ: "termin", titel, grundlage, datum: asEinTerminVorschlag(tage), art: art || "frist" });
  const modul = th => ({ typ: "modul", thema: th });
  neu("grundunterweisung", "pflicht", "Grundunterweisung für alle buchen", "§ 12 ArbSchG: Unterweisung bei Einstellung und regelmäßig", [modul("grundunterweisung")]);
  if(ma > 20) neu("asa", "pflicht", "Arbeitsschutzausschuss bilden, erste Sitzung planen",
    "§ 11 ASiG: mehr als 20 Beschäftigte, mindestens vierteljährlich" + (p.br === "ja" ? ", mit zwei Betriebsratsmitgliedern" : "") + " · Teilzeit zählt anteilig",
    [termin("Sitzung Arbeitsschutzausschuss (ASA)", "§ 11 ASiG", 28, "sonstiges")]);
  else if(ma + leih > 20) neu("asa", "pruefen", "Arbeitsschutzausschuss prüfen", "§ 11 ASiG ab mehr als 20 Beschäftigten – mit Leiharbeit knapp darüber, Zählweise prüfen",
    [termin("Prüfen: Arbeitsschutzausschuss nötig? (Beschäftigtenzahl)", "§ 11 ASiG", 28)]);
  if(ma >= 50) neu("sibe", "pflicht", "Sicherheitsbeauftragte bestellen", "§ 22 Abs. 1 SGB VII: ab regelmäßig 50 Beschäftigten" + (p.br === "ja" ? ", unter Beteiligung des Betriebsrats" : ""),
    [termin("Sicherheitsbeauftragte bestellen", "§ 22 Abs. 1 SGB VII", 28)]);
  else if(ma > 20) neu("sibe", "pruefen", "Sicherheitsbeauftragten prüfen", "§ 22 Abs. 1 S. 3 SGB VII: 21–49 Beschäftigte – Pflicht bei besonderer Gefährdung laut Gefährdungsbeurteilung",
    [termin("Prüfen: Sicherheitsbeauftragter nötig? (besondere Gefährdung laut GBU)", "§ 22 Abs. 1 S. 3 SGB VII", 28)]);
  if(p.sifa === "keine") neu("sifa", "pflicht", "Fachkraft für Arbeitssicherheit schriftlich bestellen", "§ 5 ASiG", [termin("Fachkraft für Arbeitssicherheit schriftlich bestellen", "§ 5 ASiG", 28)]);
  if(p.ba === "nein") neu("ba", "pflicht", "Betriebsarzt schriftlich bestellen", "§ 2 ASiG", [termin("Betriebsarzt schriftlich bestellen", "§ 2 ASiG", 28)]);
  if(p.betreuung === "unternehmer" && ma > 50){
    if(org.bg === "BGHM") neu("betreuung", "pflicht", "Unternehmermodell passt nicht – Betreuung neu vereinbaren", "DGUV Vorschrift 2 (BGHM), Anlage 3: alternative Betreuung nur bis 50 Beschäftigte",
      [termin("Betreuung nach DGUV Vorschrift 2 neu vereinbaren (über 50 Beschäftigte)", "DGUV Vorschrift 2 Anlage 3", 28)]);
    else neu("betreuung", "pruefen", "Grenze des Unternehmermodells prüfen", "DGUV Vorschrift 2 des eigenen Unfallversicherungsträgers (Fassungen weichen ab)",
      [termin("Prüfen: Unternehmermodell bei über 50 Beschäftigten zulässig?", "DGUV Vorschrift 2", 28)]);
  }
  if(p.betreuung === "unklar") neu("betreuung", "pruefen", "Betreuungsmodell klären", "DGUV Vorschrift 2: Regelbetreuung oder alternative Betreuung",
    [termin("Betreuungsmodell nach DGUV Vorschrift 2 klären", "DGUV Vorschrift 2", 28)]);
  if(p.laerm === "85"){
    neu("laerm", "pflicht", "Unterweisung Lärm buchen", "§ 11 LärmVibrationsArbSchV", [modul("laerm")]);
    neu("gehoerschutz", "pflicht", "Gehörschutz-Pflicht in der PSA-Matrix der Anlagen", "§ 8 Abs. 3 LärmVibrationsArbSchV: ab 85 dB(A) tragen", [{ typ: "vorgabe", k: "gehoerschutz" }]);
    neu("laerm_vorsorge", "pflicht", "Pflichtvorsorge Lärm organisieren", "ArbMedVV Anhang Teil 3: Pflichtvorsorge ab 85 dB(A)", [termin("Pflichtvorsorge Lärm organisieren (ab 85 dB(A))", "ArbMedVV Anhang Teil 3", 28)]);
    neu("laerm_bereich", "pflicht", "Lärmbereiche kennzeichnen", "§ 7 Abs. 4 LärmVibrationsArbSchV", [termin("Lärmbereiche kennzeichnen und abgrenzen", "§ 7 Abs. 4 LärmVibrationsArbSchV", 28)]);
  } else if(p.laerm === "80"){
    neu("laerm", "pflicht", "Unterweisung Lärm buchen", "§ 11 LärmVibrationsArbSchV: ab den unteren Auslösewerten", [modul("laerm")]);
    neu("laerm_vorsorge", "pflicht", "Gehörschutz bereitstellen, Angebotsvorsorge anbieten", "§ 8 Abs. 1 LärmVibrationsArbSchV · ArbMedVV Anhang Teil 3",
      [termin("Gehörschutz bereitstellen und Angebotsvorsorge Lärm anbieten", "§ 8 Abs. 1 LärmVibrationsArbSchV · ArbMedVV Anhang Teil 3", 28)]);
  } else if(p.laerm === "unbekannt") neu("laerm", "pruefen", "Lärmexposition ermitteln", "§ 3 LärmVibrationsArbSchV: Gefährdungsbeurteilung Lärm",
    [termin("Lärmexposition ermitteln (Messung oder Herstellerangaben)", "§ 3 LärmVibrationsArbSchV", 28)]);
  if(hat("gefahrstoffe")){
    neu("gefahrstoffe", "pflicht", "Unterweisung Gefahrstoffe buchen", "§ 14 GefStoffV", [modul("gefahrstoffe")]);
    neu("gs_verzeichnis", "pflicht", "Gefahrstoffverzeichnis anlegen", "§ 6 Abs. 12 GefStoffV", [termin("Gefahrstoffverzeichnis anlegen (mit Sicherheitsdatenblättern)", "§ 6 Abs. 12 GefStoffV", 28)]);
    neu("handschuhplan", "pflicht", "Handschuhplan je Gefahrstoff festlegen", "§ 2 PSA-BV: geeignete Schutzhandschuhe auswählen und bereitstellen",
      [termin("Handschuhplan je Gefahrstoff festlegen", "§ 2 PSA-BV", 42)]);
  }
  if(hat("stapler")) neu("stapler", "pflicht", "Unterweisung Flurförderzeuge buchen, Fahraufträge erteilen", "DGUV Vorschrift 68 § 7: nur unterwiesene Personen, Auftrag schriftlich",
    [modul("flurfoerderzeuge"), termin("Fahraufträge für Flurförderzeuge schriftlich erteilen", "DGUV Vorschrift 68 § 7", 28)]);
  if(hat("krane")) neu("krane", "pflicht", "Unterweisung Hallenkran buchen", "DGUV Vorschrift 52 § 29: Kranführer geeignet, unterwiesen, beauftragt", [modul("hallenkran")]);
  if(hat("leitern")) neu("leitern", "pflicht", "Unterweisung Leitern und Tritte buchen", "§ 12 BetrSichV · TRBS 2121-2", [modul("leitern-tritte")]);
  if(hat("buero")){
    neu("bildschirm", "pflicht", "Unterweisung Bildschirmarbeit buchen", "ArbStättV Anhang Nr. 6 (Bildschirmarbeitsplätze)", [modul("bildschirmarbeit")]);
    neu("bildschirm_vorsorge", "pflicht", "Angebotsvorsorge Bildschirmarbeit anbieten", "ArbMedVV Anhang Teil 4 Abs. 2 Nr. 1",
      [termin("Angebotsvorsorge Bildschirmarbeit anbieten (Augen, Sehvermögen)", "ArbMedVV Anhang Teil 4", 42)]);
  }
  if(hat("maschinen") && asEinBrancheVon(org) === "kunststoff-spritzguss") neu("maschinen", "pflicht", "Unterweisung Spritzgießmaschine buchen", "§ 12 BetrSichV · DGUV Information 113-606",
    [modul("maschinenbedienung-spritzguss")]);
  else if(hat("maschinen")) neu("maschinen", "hinweis", "Anlagen mit Beurteilung anlegen (Schritt Anlagen)", "§ 3 BetrSichV: Gefährdungsbeurteilung je Arbeitsmittel");
  if(hat("fremdfirmen")) neu("fremdfirmen", "pflicht", "Fremdfirmen unterweisen lassen (Terminal)", "§ 8 Abs. 2 ArbSchG: angemessene Anweisungen für Fremdfirmen",
    [modul("externe-besucher"), { typ: "rolle", name: "Fremdfirma", rtyp: "fremdfirma" }]);
  if(hat("besucher")) neu("besucher", "hinweis", "Rolle Besucher anlegen (Sicherheitshinweise am Terminal)", "Organisationsvorschlag – keine eigene Rechtspflicht",
    [{ typ: "rolle", name: "Besucher", rtyp: "besucher" }]);
  const ul = Array.isArray(p.unterlagen) ? p.unterlagen : [];
  if(hat("maschinen") && !ul.includes("pruefkataster")) neu("pruefkataster", "hinweis", "Prüfkataster entsteht mit den Anlagen", "§ 14 BetrSichV: Prüfung vor erster Verwendung und wiederkehrend");
  if(ul.length) neu("unterlagen", "hinweis", "Vorhandene Unterlagen unter Unterlagen ablegen", "Bisherige Beurteilungen und Nachweise bleiben als Nachweis erhalten");
  return l;
}
function asEinBrancheVon(org){ return (org || {}).branche || "sonstige"; }

function asEinFrageHtml(f, p){
  const w = p[f.k];
  if(f.typ === "zahl") return `<div class="ein-frage"><span title="${esc(f.t)}">${esc(f.t)}</span><input type="number" min="0" step="1" data-pf="${f.k}" value="${w == null ? "" : esc(w)}"></div>`;
  const an = v => f.typ === "mehr" ? (Array.isArray(w) && w.includes(v)) : w === v;
  return `<div class="ein-frage${f.typ === "mehr" ? " mehr" : ""}"><span title="${esc(f.t)}">${esc(f.t)}</span><div class="ein-chips" data-pk="${f.k}" data-typ="${f.typ}">${f.opt.map(([v, t]) =>
    `<button type="button" class="ein-chip${an(v) ? " an" : ""}" data-pv="${esc(v)}" title="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>`;
}
function asEinFragenBinden(root){
  root.querySelectorAll("[data-pk]").forEach(g => g.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => {
    if(g.dataset.typ === "eins"){ const war = b.classList.contains("an"); g.querySelectorAll(".an").forEach(x => x.classList.remove("an")); if(!war) b.classList.add("an"); }
    else b.classList.toggle("an"); }));
}
function asEinFragenLesen(root, p){
  root.querySelectorAll("[data-pf]").forEach(i => { p[i.dataset.pf] = i.value === "" ? null : Math.max(0, Math.round(+i.value)); });
  root.querySelectorAll("[data-pk]").forEach(g => { const v = [...g.querySelectorAll(".an")].map(b => b.dataset.pv);
    p[g.dataset.pk] = g.dataset.typ === "mehr" ? v : (v[0] || null); });
  return p;
}
async function asEinProfilSchreiben(slug, p){
  p.geaendert_am = new Date().toISOString(); p.geaendert_von = AS.ich || null;
  const r = await apiSend("POST", "/rest/v1/rpc/portal_einrichtung_profil", { p_slug: slug, p_profil: p });
  if(AS_EIN.d && AS_EIN.d.k && AS_EIN.d.slug === slug) AS_EIN.d.k.einrichtung = Object.assign({}, AS_EIN.d.k.einrichtung || {}, { profil: r || p });
  /* Schichtmodell und Beschäftigtenzahl in die Grunddaten, wenn dort noch leer */
  if(slug === AS.kunde && AS.org){ const od = asOrgDaten(), teil = {};
    if(p.schicht && !od.schichtmodell) teil.schichtmodell = AS_EIN_SCHICHT[p.schicht];
    if(p.br === "nein" && !od.br) teil.br = "kein Betriebsrat";
    if(Object.keys(teil).length) await asOrgSpeichern(teil).catch(() => {}); }
  return r || p;
}
function asEinProfil(box){
  const d = AS_EIN.d, od = asOrgDaten();
  if(!AS_EIN.p || AS_EIN.p.slug !== d.slug){
    const p = JSON.parse(JSON.stringify((d.k.einrichtung || {}).profil || {}));
    if(p.ma == null && od.ma_vz != null) p.ma = od.ma_vz;
    AS_EIN.p = { slug: d.slug, d: p }; AS_EIN.pTeil = 0;
  }
  const teil = Math.min(3, Math.max(0, AS_EIN.pTeil || 0)), p = AS_EIN.p.d;
  box.innerHTML = `<div class="ein-teile nodruck">${AS_EIN_FRAGEN.map((f, i) => `<button type="button" class="ein-chip${i === teil ? " an" : ""}" data-pt="${i}">${i + 1} · ${esc(f.titel)}</button>`).join("")}</div>
    <div id="einPrInhalt">${teil < 3 ? `<div class="ein-fragen">${AS_EIN_FRAGEN[teil].fragen.map(f => asEinFrageHtml(f, p)).join("")}</div>
      <p class="hinweis">${["Beschäftigte zählen für Arbeitsschutzausschuss und Sicherheitsbeauftragte. Die Antworten bleiben unter Organisation › Grunddaten änderbar.",
        "Die Tätigkeiten bestimmen die vorgeschlagenen Unterweisungen und Aufgaben. Nur was es im Betrieb wirklich gibt.",
        "Fehlende Bestellungen werden als Aufgabe mit Rechtsgrundlage vorgeschlagen."][teil]}</p>` : asEinEmpfHtml(p)}</div>`;
  asEinFragenBinden(box);
  box.querySelectorAll("[data-pt]").forEach(b => b.onclick = async () => { asEinFragenLesen(box, p);
    if(+b.dataset.pt === 3) await asEinProfilSchreiben(d.slug, Object.assign(p, { beantwortet_am: p.beantwortet_am || asHeute() })).catch(e => asMeldung("Nicht gespeichert: " + (e.message || e)));
    AS_EIN.pTeil = +b.dataset.pt; asZeige(); });
  if(teil === 3) asEinEmpfBinden(box, d.slug, p, () => asZeige());
  const h = document.getElementById("einHinweis"); if(h) h.textContent = teil < 3 ? "Teil " + (teil + 1) + " von 4 – „Weiter“ speichert die Antworten." : (asEinStatus().profil || {}).text || "";
}
/* „Weiter“ im Profil: erst durch die vier Teile, dann zum nächsten Schritt */
async function asEinProfilWeiter(box){
  const p = AS_EIN.p.d; asEinFragenLesen(box, p);
  if((AS_EIN.pTeil || 0) < 3){
    if(AS_EIN.pTeil === 2 || p.beantwortet_am) p.beantwortet_am = p.beantwortet_am || asHeute();
    await asEinProfilSchreiben(AS_EIN.d.slug, p);
    AS_EIN.pTeil = (AS_EIN.pTeil || 0) + 1; asZeige(); return false;
  }
  p.beantwortet_am = p.beantwortet_am || asHeute();
  await asEinProfilSchreiben(AS_EIN.d.slug, p);
  AS_EIN.pTeil = 0;
  return true;
}
function asEinEmpfHtml(p, ohneLeiste){
  const l = asEinEmpfehlungen(p), ueb = p.uebernommen || {}, oak = asDarf("oak");
  const stufe = { pflicht: ["Pflicht", "gelb"], pruefen: ["prüfen", "grau"], hinweis: ["Hinweis", "grau"] };
  const nurModul = e => e.aktionen.length && e.aktionen.every(a => a.typ === "modul");
  const zeile = e => { const u = ueb[e.id], kann = e.aktionen.length && !(nurModul(e) && !oak);
    const ziel = e.aktionen.filter(a => a.typ === "termin").map(a => "Aufgabe bis " + asDat(a.datum)).concat(e.aktionen.filter(a => a.typ === "modul").map(() => "Unterweisung"))[0] || "";
    return `<label class="z ein-empf-z" title="${esc(e.titel + " – " + e.grund)}">${kann ? `<input type="checkbox" data-em="${esc(e.id)}"${u || e.stufe !== "hinweis" ? " checked" : ""}${u ? " disabled" : ""}>` : `<span></span>`}
      <div><b>${esc(e.titel)}</b><small>${asEinGrundHtml(e.grund)}${ziel ? `<span class="ein-erkl"> · ${esc(ziel)}</span>` : ""}</small></div>
      ${u ? asChip("übernommen " + asDat(u), "gruen") : !kann && e.aktionen.length ? asChip("Freischaltung durch OAK", "grau") : asChip(stufe[e.stufe][0], stufe[e.stufe][1])}</label>`; };
  return `${ohneLeiste ? "" : `<div class="ein-leiste"><button type="button" class="btn klein" id="einPrUeb">Ausgewählte übernehmen</button>
      <span class="hinweis">Pflicht = laut Angaben belegt (Rechtskataster) · prüfen = hängt von Gefährdungsbeurteilung oder Zählweise ab</span></div>`}
    <div class="zeilen ein-empf">${l.map(zeile).join("") || `<div class="leer">Keine Empfehlungen – bitte die Fragen beantworten.</div>`}</div>`;
}
/* Rechtsgrundlage kurz (immer sichtbar) · Erläuterung (am Handy ausgeblendet, voller Text im Tooltip der Zeile) */
function asEinGrundHtml(g){
  const i = String(g || "").indexOf(": ");
  return i > 0 ? `<span>${esc(g.slice(0, i))}</span><span class="ein-erkl">: ${esc(g.slice(i + 2))}</span>` : esc(g);
}
function asEinEmpfBinden(root, slug, p, danach){
  const b = root.querySelector("#einPrUeb"); if(!b) return;
  b.onclick = async () => { b.disabled = true;
    const ids = [...root.querySelectorAll("[data-em]:checked:not([disabled])")].map(x => x.dataset.em);
    try{ const n = await asEinEmpfUebernehmen(slug, p, ids); asMeldung(n.text); danach && danach(); }
    catch(e){ asMeldung("Nicht übernommen: " + (e.message || e)); if(window.OAK_FEHLER) window.OAK_FEHLER("einrichtung", "Profil-Empfehlungen: " + (e.message || e), { kunde: slug, ids }); b.disabled = false; } };
}
async function asEinEmpfUebernehmen(slug, p, ids){
  const l = asEinEmpfehlungen(p).filter(e => ids.includes(e.id)), k = "&kunde_slug=eq." + encodeURIComponent(slug), oak = asDarf("oak"), heute = asHeute();
  if(!l.length) return { text: "Nichts ausgewählt." };
  const z = { modul: 0, termin: 0, rolle: 0, vorgabe: 0 };
  const module = [...new Set(l.flatMap(e => e.aktionen.filter(a => a.typ === "modul").map(a => a.thema)))];
  if(module.length && oak){
    const katalog = ((await apiGet("/rest/v1/uw_modul?select=thema&aktiv=is.true").catch(() => [])) || []).map(m => m.thema);
    const rows = module.filter(th => katalog.includes(th)).map(thema => ({ kunde_slug: slug, thema, aktiv: true }));
    if(rows.length){ await apiSend("POST", "/rest/v1/uw_buchung?on_conflict=kunde_slug,thema", rows, "resolution=merge-duplicates,return=minimal"); z.modul = rows.length; }
  }
  const termine = l.flatMap(e => e.aktionen.filter(a => a.typ === "termin"));
  if(termine.length){
    const da = new Set(((await apiGet("/rest/v1/portal_termin?select=titel&archiviert=is.false&erledigt_am=is.null" + k).catch(() => [])) || []).map(t => asEinNorm(t.titel)));
    const rows = termine.filter(a => !da.has(asEinNorm(a.titel))).map(a => ({ kunde_slug: slug, titel: a.titel, art: a.art, faellig_am: a.datum, grundlage: a.grundlage,
      notiz: "Aus dem Betriebsprofil (Einrichtung)", erstellt_von: AS.ich || null }));
    if(rows.length){ await apiSend("POST", "/rest/v1/portal_termin", rows, "return=minimal"); z.termin = rows.length; }
  }
  const rollen = l.flatMap(e => e.aktionen.filter(a => a.typ === "rolle"));
  if(rollen.length){
    const da = new Set(((await apiGet("/rest/v1/uw_rolle?select=name&status=neq.archiviert" + k).catch(() => [])) || []).map(r => asEinNorm(r.name)));
    const rows = rollen.filter(a => !da.has(asEinNorm(a.name))).map(a => ({ kunde_slug: slug, name: a.name, typ: a.rtyp }));
    if(rows.length){ await apiSend("POST", "/rest/v1/uw_rolle?on_conflict=kunde_slug,name", rows, "resolution=ignore-duplicates,return=minimal"); z.rolle = rows.length; }
  }
  p.vorgaben = Object.assign({}, p.vorgaben || {});
  l.forEach(e => e.aktionen.filter(a => a.typ === "vorgabe").forEach(a => { p.vorgaben[a.k] = true; z.vorgabe++; }));
  p.uebernommen = Object.assign({}, p.uebernommen || {});
  l.forEach(e => { if(oak || !e.aktionen.every(a => a.typ === "modul")) p.uebernommen[e.id] = heute; });
  p.beantwortet_am = p.beantwortet_am || heute;
  await asEinProfilSchreiben(slug, p);
  if(AS_EIN.d && AS_EIN.d.slug === slug) await asEinLaden().catch(() => {});
  return { text: [z.modul ? z.modul + " Unterweisungen gebucht" : "", z.termin ? z.termin + " Aufgaben mit Termin" : "", z.rolle ? z.rolle + " Rollen" : "",
    z.vorgabe ? "Gehörschutz-Vorgabe für die Anlagen" : ""].filter(Boolean).join(", ") + " übernommen." };
}
/* Organisation › Grunddaten: Betriebsprofil ansehen und ändern (auch Betrieb), Empfehlungen übernehmen */
async function asEinProfilDialog(){
  const k = ((await apiGet("/rest/v1/portal_kunde?select=slug,einrichtung&slug=eq." + encodeURIComponent(AS.kunde)).catch(() => [])) || [])[0];
  const p = JSON.parse(JSON.stringify(((k || {}).einrichtung || {}).profil || {})), edit = asDarf("pflegen");
  if(p.ma == null && asOrgDaten().ma_vz != null) p.ma = asOrgDaten().ma_vz;
  const dlg = asDialog({ titel: "Betriebsprofil", breit: true, inhalt: `<div class="ein-fragen dlg-fragen">${AS_EIN_FRAGEN.slice(0, 3).flatMap(t => t.fragen).map(f => asEinFrageHtml(f, p)).join("")}</div>
      <h3>Empfehlungen</h3><div id="einPrDlgEmpf">${asEinEmpfHtml(p)}</div>
      <p class="hinweis">${p.geaendert_am ? "Zuletzt geändert " + esc(asDat(p.geaendert_am)) + (p.geaendert_von ? " von " + esc(p.geaendert_von) : "") + ". " : ""}Nur Pflichten mit Rechtsgrundlage aus dem Rechtskataster.</p>`,
    knoepfe: edit ? [{ t: "Speichern", fn: async dl => { asEinFragenLesen(dl.querySelector(".dlg-fragen"), p); p.beantwortet_am = p.beantwortet_am || asHeute();
      await asEinProfilSchreiben(AS.kunde, p); asMeldung("Betriebsprofil gespeichert."); asZeige(); } }] : [] });
  const box = dlg.querySelector(".dlg-fragen");
  if(!edit){ box.querySelectorAll("input,button").forEach(x => x.disabled = true); dlg.querySelectorAll("[data-em],#einPrUeb").forEach(x => x.disabled = true); return; }
  asEinFragenBinden(box);
  const neu = () => setTimeout(() => { asEinFragenLesen(box, p); const e = dlg.querySelector("#einPrDlgEmpf");
    e.innerHTML = asEinEmpfHtml(p); asEinEmpfBinden(e, AS.kunde, p, () => asEinProfilDialog()); }, 0);
  box.addEventListener("click", neu); box.addEventListener("change", neu);
  asEinEmpfBinden(dlg.querySelector("#einPrDlgEmpf"), AS.kunde, p, () => asEinProfilDialog());
}
function asEinProfilKurz(p){
  if(!p || !p.beantwortet_am) return "noch nicht beantwortet";
  const t = (p.taetig || []).map(x => ((AS_EIN_FRAGEN[1].fragen[0].opt.find(o => o[0] === x) || [])[1] || x).replace(/ \/.*$/, "")).join(", ");
  return [p.ma != null ? p.ma + " Beschäftigte" : "", AS_EIN_SCHICHT[p.schicht] || "", t].filter(Boolean).join(" · ") || "beantwortet";
}

/* ---------------- 3 Bereiche ---------------- */
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

/* ---------------- 5 Personen (einzeln, Datei-Upload .xlsx/.xls/.csv oder Einfügen) ---------------- */
/* Excel-Leser SheetJS – feste Version von cdnjs, erst beim Öffnen von Personen/Anlagen geladen. Die Datei wird nur im Browser gelesen,
   nichts wird hochgeladen; gespeichert werden erst die übernommenen Zeilen (Datenschutz). */
const AS_EIN_XLSX = { url: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  sri: "sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==" };
function asEinXlsx(){
  if(window.XLSX && window.XLSX.read) return Promise.resolve(window.XLSX);
  if(!asEinXlsx.p) asEinXlsx.p = new Promise((ok, nein) => { const s = document.createElement("script");
    s.src = AS_EIN_XLSX.url; s.integrity = AS_EIN_XLSX.sri; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
    s.onload = () => window.XLSX ? ok(window.XLSX) : nein(new Error("Excel-Leser nicht geladen"));
    s.onerror = () => { asEinXlsx.p = null; nein(new Error("Excel-Leser nicht erreichbar – bitte CSV verwenden oder die Tabelle einfügen")); };
    document.head.appendChild(s); });
  return asEinXlsx.p;
}
/* Import-Arten: Zielfelder, Erkennung typischer Überschriften (erste passende Regel je Spalte; Feld "" = Spalte ignorieren), Vorlage */
const AS_EIN_IMP = {
  personen: { felder: [["name", "Name"], ["vorname", "Vorname"], ["nachname", "Nachname"], ["bereich", "Bereich"], ["rolle", "Rolle"], ["sprache", "Sprache"], ["eintritt", "Eintritt"]],
    erkennen: [["", /personal.?n|(^|\W)(nr|nummer|id)\.?$|geburt|mail|telefon|handy/], ["vorname", /^vor.?name|^rufname/], ["nachname", /nach.?name|familien.?name|^zuname/],
      ["name", /^(name|mitarbeiter|person|beschäftigt|beschaeftigt|vollständiger name|ma$)/], ["bereich", /^(bereich|abteilung|kostenstelle|kst|team|halle|organisationseinheit)/],
      ["rolle", /^(rolle|tätigkeit|taetigkeit|funktion|beruf|stelle|position|job)/], ["sprache", /sprach/], ["eintritt", /^(eintritt|beginn|start|einstell|beschäftigt seit)/]],
    reihe: ["name", "bereich", "rolle", "sprache", "eintritt"], pflicht: ["name", "vorname", "nachname"],
    vorlage: [["Name", "Bereich", "Rolle", "Sprache", "Eintritt"], ["Erika Muster", "Produktion", "Maschinenbediener", "de", "01.03.2024"]], datei: "Vorlage_Beschaeftigte.xlsx" },
  anlagen: { felder: [["name", "Bezeichnung"], ["art", "Maschinenart"], ["typ", "Typ / Modell"], ["hersteller", "Hersteller"], ["baujahr", "Baujahr"], ["bereich", "Bereich / Halle"], ["inventar", "Inventarnummer"]],
    erkennen: [["inventar", /inventar|anlagen.?n(r|umm)|geräte.?nr|^nr\.?$/], ["art", /maschinenart|anlagenart|^art$|maschinentyp|kategorie|gattung/], ["typ", /^typ|modell|typenbez/],
      ["name", /^(bezeichnung|anlage|maschine|name|benennung)/], ["hersteller", /^herst|fabrikat|marke/], ["baujahr", /^bau/], ["bereich", /^(bereich|abteilung|halle|standort|ort|kostenstelle)/]],
    reihe: ["name", "art", "bereich", "hersteller", "baujahr"], pflicht: ["name"],
    vorlage: [["Bezeichnung", "Maschinenart", "Hersteller", "Baujahr", "Bereich", "Inventarnummer"], ["D250/3", "Spritzgießmaschine", "Arburg", "2019", "Produktion", "INV-0815"]],
    datei: "Vorlage_Anlagen.xlsx" } };

/* Text (Einfügen aus Excel, CSV) → Zeilen: Tab, Semikolon oder Komma */
function asEinZeilen(text){
  const z = String(text || "").replace(/^﻿/, "").replace(/\r/g, "").split("\n").filter(x => x.trim());
  if(!z.length) return [];
  const sep = z[0].includes("\t") ? "\t" : z[0].includes(";") ? ";" : ",";
  return z.map(x => x.split(sep).map(c => c.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"')));
}
/* Datei → Zeilen (Array von Arrays, Texte). Excel-Datumswerte werden zu JJJJ-MM-TT. */
async function asEinDateiLesen(datei){
  const buf = await datei.arrayBuffer();
  if(/\.csv$|\.txt$/i.test(datei.name)){
    let t; try{ t = new TextDecoder("utf-8", { fatal: true }).decode(buf); }catch(e){ t = new TextDecoder("windows-1252").decode(buf); }
    return asEinZeilen(t);
  }
  const X = await asEinXlsx();
  const wb = X.read(buf, { type: "array", cellDates: false, cellNF: true }), ws = wb.Sheets[wb.SheetNames[0]];
  if(!ws || !ws["!ref"]) return [];
  const r = X.utils.decode_range(ws["!ref"]), zeilen = [];
  for(let y = r.s.r; y <= Math.min(r.e.r, r.s.r + 5000); y++){
    const z = [];
    for(let x = r.s.c; x <= Math.min(r.e.c, r.s.c + 40); x++){
      const c = ws[X.utils.encode_cell({ r: y, c: x })];
      let v = "";
      if(c && c.v != null){
        if(c.t === "n" && c.z && X.SSF.is_date(c.z)){ const d = X.SSF.parse_date_code(c.v); v = d ? d.y + "-" + String(d.m).padStart(2, "0") + "-" + String(d.d).padStart(2, "0") : String(c.v); }
        else if(c.t === "d" && c.v instanceof Date) v = c.v.toISOString().slice(0, 10);
        else v = String(c.w != null && c.t !== "n" ? c.w : c.v).trim();
      }
      z.push(v);
    }
    if(z.some(Boolean)) zeilen.push(z);
  }
  return zeilen;
}
/* Spalten automatisch zuordnen: Überschrift erkannt → Feld; sonst Spaltenreihenfolge der Vorlage */
function asEinZuordnen(art, zeilen){
  const cfg = AS_EIN_IMP[art], kopf = (zeilen[0] || []).map(asEinNorm), map = kopf.map(() => ""), belegt = new Set();
  kopf.forEach((h, i) => { if(!h) return; const r = cfg.erkennen.find(([f, re]) => re.test(h) && (f === "" || !belegt.has(f)));
    if(r && r[0]){ map[i] = r[0]; belegt.add(r[0]); } });
  if(art === "anlagen" && !belegt.has("art") && belegt.has("typ")) map[map.indexOf("typ")] = "art";
  const mitKopf = cfg.pflicht.some(f => map.includes(f));
  if(!mitKopf) return { kopf: null, map: (zeilen[0] || []).map((x, i) => cfg.reihe[i] || "") };
  return { kopf: zeilen[0], map };
}
function asEinImpObjekte(art, imp){
  const daten = imp.kopf ? imp.zeilen.slice(1) : imp.zeilen;
  return daten.map(z => { const o = {};
    imp.map.forEach((f, i) => { if(!f) return; const v = String(z[i] == null ? "" : z[i]).trim(); if(v) o[f] = o[f] ? o[f] + " " + v : v; });
    if(art === "personen" && !o.name) o.name = [o.vorname, o.nachname].filter(Boolean).join(" ");
    return o; }).filter(o => Object.values(o).some(Boolean));
}
function asEinZuordHtml(art, imp){
  const cfg = AS_EIN_IMP[art], n = (imp.kopf ? imp.zeilen.length - 1 : imp.zeilen.length);
  const spalten = (imp.kopf || imp.zeilen[0] || []).map((h, i) => imp.kopf ? (h || "Spalte " + (i + 1)) : "Spalte " + (i + 1) + (h ? " („" + h + "“)" : ""));
  return `<p class="hinweis"><b>${esc(imp.quelle)}</b> · ${n} ${n === 1 ? "Zeile" : "Zeilen"} · Spalten zuordnen (erkannt aus der Überschrift, änderbar):</p>
    <div class="ein-zuord">${spalten.map((h, i) => `<label title="${esc(h)}"><span>${esc(h)}</span><select data-zsp="${i}"><option value="">– nicht übernehmen –</option>
      ${cfg.felder.map(([f, t]) => `<option value="${f}"${imp.map[i] === f ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`).join("")}</div>`;
}
/* Ein Import-Baustein für Personen und Anlagen: Datei wählen oder einfügen → Zuordnung → Vorschau mit Fehlern/Dubletten → Übernehmen */
function asEinImportBinden(box, art, pre, planVon, vorschauVon, importieren){
  const el = s => box.querySelector("#" + pre + s);
  asEinXlsx().catch(() => {});   // im Hintergrund vorladen
  const zeigen = () => { const imp = AS_EIN.imp[art]; if(!imp || !imp.zeilen.length){ el("Zuord").innerHTML = ""; el("Vorschau").innerHTML = `<div class="leer">Nichts erkannt – bitte Datei wählen oder die Tabelle einfügen.</div>`; return; }
    el("Zuord").innerHTML = asEinZuordHtml(art, imp);
    el("Zuord").querySelectorAll("[data-zsp]").forEach(s => s.onchange = () => { imp.map[+s.dataset.zsp] = s.value; zeigen(); });
    const plan = planVon(asEinImpObjekte(art, imp), el("Anlegen") ? el("Anlegen").checked : false);
    imp.plan = plan; el("Vorschau").innerHTML = vorschauVon(plan);
    const ok = plan.zeilen.filter(z => !z.fehler).length, b = el("Imp");
    b.disabled = !ok; b.textContent = "Übernehmen (" + ok + ")"; };
  const laden = (zeilen, quelle) => { const z = asEinZuordnen(art, zeilen); AS_EIN.imp[art] = { zeilen, kopf: z.kopf, map: z.map, quelle, slug: AS.kunde }; zeigen(); };
  el("Datei").onchange = async ev => { const f = ev.target.files && ev.target.files[0]; if(!f) return;
    if(f.size > 10 * 1024 * 1024){ asMeldung("Die Datei ist größer als 10 MB."); ev.target.value = ""; return; }
    el("Vorschau").innerHTML = `<p class="hinweis">Datei wird gelesen …</p>`;
    try{ laden(await asEinDateiLesen(f), "Datei " + f.name); }
    catch(e){ el("Vorschau").innerHTML = ""; asMeldung("Datei nicht lesbar: " + (e.message || e)); }
    ev.target.value = ""; };
  el("Vor").onclick = () => { const t = el("Text").value;
    if(t.trim()) laden(asEinZeilen(t), "Eingefügte Tabelle"); else if(AS_EIN.imp[art] && AS_EIN.imp[art].slug === AS.kunde) zeigen(); else laden([], ""); };
  if(el("Anlegen")) el("Anlegen").onchange = () => { if(AS_EIN.imp[art]) zeigen(); };
  el("Vorlage").onclick = async () => { try{ const X = await asEinXlsx(), cfg = AS_EIN_IMP[art], wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(cfg.vorlage);
      ws["!cols"] = cfg.vorlage[0].map(() => ({ wch: 22 })); X.utils.book_append_sheet(wb, ws, art === "personen" ? "Beschäftigte" : "Anlagen"); X.writeFile(wb, cfg.datei); }
    catch(e){ asMeldung(e.message || String(e)); } };
  el("Imp").onclick = async ev => { const imp = AS_EIN.imp[art]; if(!imp || !imp.plan) return; const b = ev.currentTarget; b.disabled = true;
    try{ await importieren(imp.plan); AS_EIN.imp[art] = null; asZeige(); }
    catch(e){ asMeldung("Import fehlgeschlagen: " + (e.message || e)); if(window.OAK_FEHLER) window.OAK_FEHLER("einrichtung", art + "-Import: " + (e.message || e), { kunde: AS.kunde }); b.disabled = false; } };
  if(AS_EIN.imp[art] && AS_EIN.imp[art].slug === AS.kunde) zeigen();
}
function asEinImportHtml(art, pre, platz, mitAnlegen){
  return `<p class="hinweis">Excel (.xlsx, .xls) oder CSV hochladen – oder in Excel markieren, kopieren und unten einfügen. Die Datei bleibt im Browser, gespeichert werden nur die übernommenen Zeilen.</p>
    <p class="ein-knoepfe"><label class="btn sek klein ein-datei">Datei wählen<input type="file" id="${pre}Datei" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
      <button type="button" class="btn sek klein" id="${pre}Vorlage">Vorlage herunterladen</button></p>
    <textarea id="${pre}Text" rows="3" placeholder="${platz}"></textarea>
    ${mitAnlegen ? `<label class="ein-check"><input type="checkbox" id="${pre}Anlegen" checked> ${mitAnlegen}</label>` : ""}
    <p class="ein-knoepfe"><button type="button" class="btn sek klein" id="${pre}Vor">Vorschau</button><button type="button" class="btn klein" id="${pre}Imp" disabled>Übernehmen</button></p>
    <div id="${pre}Zuord"></div><div id="${pre}Vorschau"></div>`;
}

function asEinPersonen(box){
  const d = AS_EIN.d, pers = asEinPersAktiv(), einh = asT("as_einheit");
  const nm = (liste, ids) => ids.map(id => (liste.find(x => x.id === id) || {}).name).filter(Boolean).join(", ");
  box.innerHTML = `<div class="ein-zwei">
    <div class="ein-spalte"><h3>Beschäftigte (${pers.length}) <button type="button" class="btn sek klein" id="einPNeu">+ Person</button></h3>
      ${pers.length ? `<div class="tabwrap"><table class="tab"><tr><th>Name</th><th>Bereich</th><th>Rolle</th><th>Sprache</th></tr>
        ${pers.map(p => `<tr class="bda-klick" data-pid="${esc(p.id)}"><td><b>${esc(p.name)}</b></td><td>${esc(nm(einh, (p.uw_person_einheit || []).map(x => x.einheit_id)) || "–")}</td>
          <td>${(p.uw_person_rolle || []).length ? esc(nm(d.rollen, p.uw_person_rolle.map(x => x.rolle_id))) : asChip("ohne Rolle", "gelb")}</td><td>${esc(p.sprache || "de")}</td></tr>`).join("")}</table></div>`
        : `<div class="leer">Noch keine Beschäftigten – einzeln anlegen oder rechts eine Liste hochladen.</div>`}</div>
    <div class="ein-spalte"><h3>Liste hochladen oder einfügen</h3>
      ${asEinImportHtml("personen", "einP", "Name&#9;Bereich&#9;Rolle&#9;Sprache&#9;Eintritt&#10;Erika Muster&#9;Produktion&#9;Maschinenbediener&#9;de&#9;01.03.2024", "fehlende Bereiche und Rollen mit anlegen")}</div></div>`;
  box.querySelector("#einPNeu").onclick = async () => { if(typeof asUwLaden === "function"){ await asUwLaden(true); asUwPersonDialog(null); } };
  box.querySelectorAll("[data-pid]").forEach(tr => tr.onclick = async () => { await asUwLaden(true);
    const p = AS_UW.d.pers.find(x => x.id === tr.dataset.pid); if(p) asUwPersonDialog(p); });
  asEinImportBinden(box, "personen", "einP", (objs, anlegen) => asEinPersonenPlan(objs, anlegen),
    plan => asEinVorschauHtml(plan, ["Name", "Bereich", "Rolle", "Sprache", "Eintritt"], z => [z.name, z.bereich, z.rolle, z.sprache, z.eintritt ? asDat(z.eintritt) : ""]),
    async plan => { const n = await asEinPersonenImport(plan); asMeldung(n + (n === 1 ? " Person" : " Personen") + " übernommen."); });
}
/* Tabelle aus der Zwischenablage (für ältere Aufrufer): Spaltenregeln je Feld */
function asEinTabelle(text, spalten){
  const teile = asEinZeilen(text); if(!teile.length) return [];
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
function asEinPersonenPlan(roh, anlegen){
  if(typeof roh === "string") roh = asEinImpObjekte("personen", (z => Object.assign({ zeilen: z }, asEinZuordnen("personen", z)))(asEinZeilen(roh)));
  const einh = asT("as_einheit"), rollen = asEinRollenAktiv(), vorh = new Set(asEinPersAktiv().map(p => asEinNorm(p.name))), gesehen = new Set();
  const neuB = new Set(), neuR = new Set();
  const zeilen = roh.map(z => {
    const f = [], h = [];
    if(!z.name || z.name.length < 3) f.push("Name fehlt");
    else if(vorh.has(asEinNorm(z.name))) f.push("gibt es schon");
    else if(gesehen.has(asEinNorm(z.name))) f.push("doppelt im Import");
    gesehen.add(asEinNorm(z.name));
    const e = z.bereich ? einh.find(x => asEinNorm(x.name) === asEinNorm(z.bereich)) : null;
    if(z.bereich && !e){ if(anlegen) h.push("Bereich wird angelegt"); else f.push("Bereich unbekannt"); }
    const r = z.rolle ? rollen.find(x => asEinNorm(x.name) === asEinNorm(z.rolle)) : null;
    if(z.rolle && !r){ if(anlegen) h.push("Rolle wird angelegt"); else f.push("Rolle unbekannt"); }
    if(!z.rolle) h.push("ohne Rolle");
    const sp = asEinSprache(z.sprache); if(!sp) f.push("Sprache unbekannt");
    const dt = asEinDatum(z.eintritt); if(!dt.ok) f.push("Eintritt kein Datum");
    if(!f.length && anlegen){ if(z.bereich && !e) neuB.add(z.bereich.trim()); if(z.rolle && !r) neuR.add(z.rolle.trim()); }
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
  const gehoerAn = !!((asEinProfilDaten() || {}).vorgaben || {}).gehoerschutz;
  const einhName = id => (asNach("as_einheit", id) || {}).name || "";
  const sysVon = mid => asT("as_arbeitssystem").find(s => asListe(s.anlagen).includes(mid));
  box.innerHTML = `<div class="ein-zwei">
    <div class="ein-spalte"><h3>Anlagen (${d.anl.length})</h3>
      <div class="zeilen">${d.anl.map(a => { const s = sysVon(a.maschinen_id), n = s ? asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id).length : 0;
          return `<div class="z" style="cursor:default"><div><b>${esc(a.maschine)}</b><small>${esc(a.maschinentyp || "ohne Maschinenart")}${s && s.einheit_id ? " · " + esc(einhName(s.einheit_id)) : ""} · ${n} Gefährdungen</small></div>${asChip(n ? "Beurteilung angelegt" : "Beurteilung leer", n ? "gruen" : "gelb")}</div>`; }).join("")
        || `<div class="leer">Noch keine Anlagen – rechts einzeln anlegen oder eine Liste hochladen.</div>`}</div></div>
    <div class="ein-spalte"><h3>Anlage anlegen</h3>
      <div class="form" id="einAForm">${asFeld("Bezeichnung (z. B. D250/3)", "name", "")}
        <label>Maschinenart<input type="text" data-f="art" list="einArten" value="${psaAn ? "Spritzgießmaschine" : ""}"></label>
        ${asFeld("Hersteller", "hersteller", "")}${asFeld("Baujahr", "baujahr", "")}
        ${asBereichWahl("Bereich", "einheit_id", "", "", "– noch keinem Bereich –")}
        ${asAuswahl("Beurteilung (BdA)", "vorlage", "auto", [["auto", "passend zur Maschinenart"], ["", "leer beginnen"]].concat(liste.map((v, i) => [String(i), v.label])))}
        <label class="ein-check voll"><input type="checkbox" data-f="psa"${psaAn ? " checked" : ""}> PSA-Matrix aus der Branchenvorlage übernehmen (Spritzgießmaschinen, DGUV Information 113-606)</label>
        <label class="ein-check voll" title="Betriebsprofil: Lärm ab 85 dB(A) – § 8 Abs. 3 LärmVibrationsArbSchV"><input type="checkbox" data-f="gehoer"${gehoerAn ? " checked" : ""}> Gehörschutz-Pflicht an dieser Anlage (Lärm ab 85 dB(A), § 8 Abs. 3 LärmVibrationsArbSchV)</label></div>
      <datalist id="einArten">${AS_EIN_ARTEN.map(a => `<option value="${esc(a)}">`).join("")}</datalist>
      <p class="ein-knoepfe"><button type="button" class="btn klein" id="einANeu">Anlage anlegen</button></p>
      <h3>Mehrere als Liste</h3>
      ${asEinImportHtml("anlagen", "einA", "Bezeichnung;Maschinenart;Hersteller;Baujahr;Bereich;Inventarnummer", "fehlende Bereiche mit anlegen")}
      <p class="hinweis">Beurteilung, PSA und Gehörschutz wie oben gewählt.</p></div></div>`;
  const form = box.querySelector("#einAForm");
  const vorlageVon = (w, art) => w.vorlage === "auto" ? asEinVorlageFuer(art, liste) : w.vorlage === "" || w.vorlage == null ? null : liste[+w.vorlage] || null;
  const anlegen = async (w, vorlage, psa, gehoer) => {
    const erg = await asAnlageAnlegen({ name: w.name, art: w.art || "", hersteller: w.hersteller || "", typ: w.typ || "", baujahr: w.baujahr || "", seriennr: "", einheit_id: w.einheit_id || null, bereich: "" }, vorlage);
    if(psa && erg.sys && /spritzg/i.test(w.art || "") && typeof asPsaVorlageAnwenden === "function")
      await asPsaVorlageAnwenden(erg.sys, "kunststoff-spritzguss").catch(e => asMeldung("PSA-Vorlage nicht übernommen: " + (e.message || e)));
    if(gehoer && erg.sys) await asEinGehoerschutz(erg.sys).catch(e => asMeldung("Gehörschutz nicht eingetragen: " + (e.message || e)));
    if(w.inventar) await apiSend("PATCH", "/rest/v1/as_pruefobjekt?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&maschinen_id=eq." + encodeURIComponent(erg.mid),
      { inventar_nr: String(w.inventar).slice(0, 80) }, "return=minimal").catch(() => {});
    return erg;
  };
  box.querySelector("#einANeu").onclick = async ev => { const w = asWerte(form), b = ev.currentTarget;
    if(!w.name){ asMeldung("Bitte die Bezeichnung eintragen."); return; }
    if(d.anl.some(a => asEinNorm(a.maschine) === asEinNorm(w.name))){ asMeldung("Diese Anlage gibt es schon."); return; }
    b.disabled = true; asMeldung("Anlage wird angelegt …");
    try{ const erg = await anlegen(w, vorlageVon(w, w.art), w.psa, w.gehoer); asMeldung("Anlage " + w.name + " (" + erg.mid + ") angelegt."); AS_EIN.vorlagen = null; asZeige(); }
    catch(e){ asMeldung(e.message || String(e)); b.disabled = false; }
  };
  asEinImportBinden(box, "anlagen", "einA", (objs, bereicheAnlegen) => asEinAnlagenPlan(objs, liste, bereicheAnlegen),
    plan => asEinVorschauHtml(plan, ["Bezeichnung", "Maschinenart", "Hersteller", "Baujahr", "Bereich", "Inventar-Nr."], z => [z.name, z.art, z.hersteller, z.baujahr, z.bereich, z.inventar]),
    async plan => { const w = asWerte(form), zeilen = plan.zeilen.filter(z => !z.fehler); let n = 0;
      for(const name of plan.neuB) if(!asT("as_einheit").some(e => asEinNorm(e.name) === asEinNorm(name)))
        await asSpeichern("as_einheit", { name, art: "bereich", beschaeftigte: 0, schichten: 1, sort: asT("as_einheit").length + 1 });
      for(const z of zeilen){
        asMeldung("Anlage " + (n + 1) + " von " + zeilen.length + " wird angelegt …");
        const e = z.bereich ? asT("as_einheit").find(x => asEinNorm(x.name) === asEinNorm(z.bereich)) : null;
        try{ await anlegen(Object.assign({}, z, { einheit_id: e ? e.id : null }), vorlageVon(w, z.art), w.psa, w.gehoer); n++; }
        catch(ex){ asMeldung(z.name + ": " + (ex.message || ex)); break; }
      }
      AS_EIN.vorlagen = null; asMeldung(n + " von " + zeilen.length + " Anlagen angelegt."); });
}
function asEinAnlagenPlan(roh, liste, bereicheAnlegen){
  const einh = asT("as_einheit"), vorh = new Set((AS_EIN.d.anl || []).map(a => asEinNorm(a.maschine))), gesehen = new Set(), neuB = new Set();
  const zeilen = roh.map(z => { const f = [], h = [];
    if(!z.name) f.push("Bezeichnung fehlt"); else if(vorh.has(asEinNorm(z.name))) f.push("gibt es schon"); else if(gesehen.has(asEinNorm(z.name))) f.push("doppelt im Import");
    if(z.name) gesehen.add(asEinNorm(z.name));
    const e = z.bereich ? einh.find(x => asEinNorm(x.name) === asEinNorm(z.bereich)) : null;
    if(z.bereich && !e){ if(bereicheAnlegen) h.push("Bereich wird angelegt"); else f.push("Bereich unbekannt"); }
    if(z.baujahr){ const bj = String(z.baujahr).match(/^(\d{4})(-\d\d-\d\d)?$/); if(!bj) f.push("Baujahr vierstellig"); else z.baujahr = bj[1]; }
    const v = asEinVorlageFuer(z.art, liste);
    h.push(v ? "Vorlage: " + v.label : "Beurteilung leer");
    if(!f.length && z.bereich && !e && bereicheAnlegen) neuB.add(z.bereich.trim());
    return Object.assign({}, z, { fehler: f.join(", "), hinweis: h.join(" · ") }); });
  return { zeilen, neuB: [...neuB] };
}
/* Gehörschutz-Pflicht (Profil: Lärm ab 85 dB(A)) an einer Anlage: steht er schon in der PSA-Matrix (Spritzguss-Vorlage), bleibt alles;
   sonst eine Tätigkeit „Arbeiten im Lärmbereich“ mit Gehörschutz als Pflicht – daraus folgt der Vorsorgehinweis (as-service.js, ArbMedVV). */
async function asEinGehoerschutz(sys){
  const t = await apiGet("/rest/v1/as_taetigkeit?select=id,name&arbeitssystem_id=eq." + encodeURIComponent(sys.id)).catch(() => []) || [];
  if(t.length){ const z = await apiGet("/rest/v1/as_psa_zuordnung?select=id&psa_art=eq.gehoerschutz&taetigkeit_id=in.(" + t.map(x => x.id).join(",") + ")").catch(() => []) || [];
    if(z.length) return false; }
  let ta = t.find(x => /lärm/i.test(x.name));
  if(!ta) ta = ((await apiSend("POST", "/rest/v1/as_taetigkeit", { kunde_slug: AS.kunde, arbeitssystem_id: sys.id, name: "Arbeiten im Lärmbereich", rollen: [], sort: 99 }, "return=representation")) || [])[0];
  if(!ta) return false;
  await apiSend("POST", "/rest/v1/as_psa_zuordnung?on_conflict=taetigkeit_id,psa_art", { kunde_slug: AS.kunde, taetigkeit_id: ta.id, psa_art: "gehoerschutz", pflicht: true,
    bedingung: "Tragepflicht ab 85 dB(A)", quelle: "einrichtung" }, "resolution=ignore-duplicates,return=minimal");
  return true;
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
  const pr = (k.einrichtung || {}).profil || null, el = pr ? asEinEmpfehlungen(pr).filter(e => e.aktionen.length) : [];
  const empf = { ueb: el.filter(e => (pr.uebernommen || {})[e.id]).length, offen: el.filter(e => !(pr.uebernommen || {})[e.id] && e.stufe === "pflicht").length };
  return [
    { s: asEinNr("stamm"), t: "Stammdaten und Branche", ok: st.stamm.ok, info: st.stamm.text, pflicht: true },
    { s: asEinNr("profil"), t: "Betriebsprofil beantwortet", ok: st.profil.ok, info: st.profil.text, pflicht: true },
    { s: asEinNr("bereiche"), t: "Bereiche der Organisation", ok: st.bereiche.ok, info: st.bereiche.text, pflicht: true },
    { s: asEinNr("rollen"), t: "Rollen", ok: st.rollen.ok, info: st.rollen.text, pflicht: true },
    { s: asEinNr("personen"), t: "Beschäftigte mit Rolle", ok: st.personen.ok, info: st.personen.text, pflicht: true },
    { s: asEinNr("anlagen"), t: "Anlagen", ok: st.anlagen.ok, info: st.anlagen.text, pflicht: true },
    { s: asEinNr("unterweisung"), t: "Unterweisung zugeordnet", ok: st.unterweisung.ok, info: st.unterweisung.text, pflicht: true },
    { s: asEinNr("terminal"), t: "Terminal und Melden", ok: st.terminal.ok, info: st.terminal.text, pflicht: true },
    { s: asEinNr("zugaenge"), t: "Zugänge GF und Fachkraft", ok: st.zugaenge.ok, info: st.zugaenge.text, pflicht: true },
    { s: asEinNr("stamm"), t: "Logo und Farben", ok: !!marke, info: marke ? "festgelegt" : "OAK-Standard", pflicht: false },
    { s: asEinNr("profil"), t: "Empfehlungen aus dem Profil", ok: empf.offen === 0, info: empf.ueb + " übernommen · " + empf.offen + " offen", pflicht: false },
    { s: 0, t: "AVV abgeschlossen", ok: !!k.avv_abgeschlossen_am, info: k.avv_abgeschlossen_am ? asDat(k.avv_abgeschlossen_am) : "vor echten Personendaten", pflicht: false },
    { s: asEinNr("anlagen"), t: "Prüfkataster angelegt", ok: asT("as_pruefobjekt").some(x => x.aktiv !== false), info: asT("as_pruefobjekt").filter(x => x.aktiv !== false).length + " Prüfobjekte (vor erster Verwendung)", pflicht: false },
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
  await asEinSpeichern({ schritt: AS_EIN_N, abgeschlossen_am: asHeute(), abgeschlossen_von: AS.ich || "OAK", erledigt: { abschluss: asHeute() } });
  asMeldung(AS_EIN.d.k.name + " ist startklar.");
  asZeige();
}

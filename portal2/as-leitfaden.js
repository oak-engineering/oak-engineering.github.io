/* OAK Arbeitsschutz-App – Leitfaden „Ihr Weg“ + Stufen-Badges (Plan Schritt 8, Modell intern/portal-stufenmodell.md, 14.10.2026).
   Alles wird automatisch aus den Cockpit-Daten berechnet – ohne OAK, ohne KI. Badge Stufe n = alle Kriterien der Stufen 1…n
   erfüllt (Startbedingungen eingeschlossen). Es erlischt automatisch, wenn ein Kriterium nicht mehr erfüllt ist:
   gelb = Vorwarnung, orange = Karenz 14 Tage (Produktregel), rote Pflichten (●) ohne Karenz.
   Kriterien ohne eigene Maske laufen über die Selbstauskunft (as_selbstauskunft: Datum, Person, Nachweisdatei, Verfall).
   Präfix asLf – alle Portal-Skripte teilen einen Scope (tools/portal_check.py). */
"use strict";

const AS_LF = { kunde: null, d: null, laeuft: null };
const AS_LF_STUFEN = [
  { nr: 1, name: "Fundament", text: "Alle gesetzlichen Grundpflichten umgesetzt" },
  { nr: 2, name: "System", text: "Arbeitsschutz als geregelter Ablauf mit Wirksamkeitskontrolle" },
  { nr: 3, name: "Steuerung", text: "Mit Zielen, Kennzahlen und jährlicher Bewertung gesteuert" },
  { nr: 4, name: "Kultur", text: "Von Führung und Beschäftigten gemeinsam getragen" }];
const AS_LF_ETAPPEN = { S: "Startbedingungen", "1a": "Verantwortung & Betreuung", "1b": "Notfall & Erste Hilfe", "1c": "Gefährdungen & Maßnahmen",
  "1d": "Arbeitsmittel & Gefahrstoffe", "1e": "Unterweisung, Vorsorge & besondere Personengruppen", "2": "System", "3": "Steuerung", "4": "Kultur" };

/* ---------- Daten (zusätzlich zu AS.db) ---------- */
async function asLfLaden(neu){
  if(!neu && AS_LF.kunde === AS.kunde && AS_LF.d) return AS_LF.d;
  if(AS_LF.laeuft && AS_LF.kunde === AS.kunde) return AS_LF.laeuft;
  AS_LF.kunde = AS.kunde;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde), hole = p => apiGet(p).catch(() => []);
  AS_LF.laeuft = (async () => {
    if(typeof asBetriebLaden === "function") await asBetriebLaden().catch(() => {});
    const [vorsorge, gs, gsgbu, uw, pa, sa, ri, rq, melde, vorf, beleg, badge] = await Promise.all([
      hole("/rest/v1/portal_vorsorge?select=art,naechste,datum" + k),
      hole("/rest/v1/portal_gefahrstoff?select=id,bezeichnung,aktiv,verwendung_status,h_saetze,sdb_pfad,sdb_ausgabe,sdb_geprueft_am,ba_pfad,ba_gruppe,menge,bereiche" + k),
      hole("/rest/v1/portal_gefahrstoff_gbu?select=gefahrstoff_id,status,naechste_pruefung" + k),
      hole("/rest/v1/v_uw_faelligkeit?select=status,faellig_am" + k),
      hole("/rest/v1/portal_pruefauftrag?select=objekt_titel,faellig_am&erledigt_am=is.null" + k),
      hole("/rest/v1/as_selbstauskunft?select=*&order=datum.desc" + k),
      hole("/rest/v1/portal_rechtsinfo?select=id,status,erfasst_am,sichtbar,kunde_slug"),
      hole("/rest/v1/portal_rechtsinfo_quittung?select=rechtsinfo_id,quittiert_am" + k),
      hole("/rest/v1/portal_melde_token?select=aktiv&aktiv=is.true" + k),
      hole("/rest/v1/portal_vorfaelle?select=id,art,domaene,ereignis_am,ausfalltage,unfallanzeige_am,ausgewertet_am,ursache,status,angelegt_am,anlage" + k),
      hole("/rest/v1/portal_belegschaft?select=stamm,leih" + k),
      hole("/rest/v1/as_badge?select=*" + k)]);
    AS_LF.d = { vorsorge, gs, gsgbu, uw, pa, sa, ri, rq, melde, vorf, beleg: (beleg || [])[0] || null, badge };
    AS_LF.laeuft = null;
    return AS_LF.d;
  })();
  return AS_LF.laeuft;
}

/* ---------- Hilfen ---------- */
function asLfPlus(datum, tage){ if(!datum) return null; const x = new Date(String(datum).slice(0, 10)); x.setDate(x.getDate() + tage); return x.toISOString().slice(0, 10); }
function asLfMon(datum, m){ if(!datum) return null; const x = new Date(String(datum).slice(0, 10)); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); }
/* Frist auswerten: faellig = Datum, bis zu dem das Kriterium erfüllt ist */
function asLfFrist(faellig, vorlauf, rot, info){
  if(!faellig) return { s: "offen", info: info || "kein Nachweis" };
  const t = -asTageSeit(faellig);           // Tage bis Fälligkeit (negativ = überfällig)
  if(t > vorlauf) return { s: "ok", info: info || "gültig bis " + asDat(faellig) };
  if(t >= 0) return { s: "warn", info: "fällig " + asDat(faellig), faellig };
  if(!rot && t >= -14) return { s: "karenz", info: "seit " + asDat(faellig) + " überfällig – Badge gefährdet", faellig };
  return { s: "offen", info: "überfällig seit " + asDat(faellig), faellig };
}
const asLfOk = (b, info, offenInfo) => b ? { s: "ok", info: info || "" } : { s: "offen", info: offenInfo || "" };
function asLfSa(d, id){ return (d.sa || []).filter(x => x.kriterium === id).sort((a, b) => String(b.datum).localeCompare(String(a.datum)))[0] || null; }
function asLfSaPruef(d, krit){
  const x = asLfSa(d, krit.id);
  if(!x) return { s: "offen", info: "Selbstauskunft fehlt", sa: krit.sa };
  if(x.nicht_zutreffend) return { s: "na", info: "trifft nicht zu (" + asDat(x.datum) + (x.notiz ? ": " + x.notiz : "") + ")", sa: krit.sa };
  return Object.assign(asLfFrist(asLfMon(x.datum, krit.sa), 30, !!krit.rot, "bestätigt " + asDat(x.datum) + (x.person ? " · " + x.person : "") + " · gültig bis " + asDat(asLfMon(x.datum, krit.sa))), { sa: krit.sa });
}
function asLfGsAktiv(d){ return (d.gs || []).filter(g => g.aktiv !== false && g.verwendung_status !== "inaktiv"); }
function asLfQuartal(dt){ const x = new Date(dt); return x.getFullYear() * 4 + Math.floor(x.getMonth() / 3); }

/* ---------- Kriterien ---------- */
function asLfKriterien(){
  const K = (id, stufe, etappe, titel, o) => Object.assign({ id, stufe, etappe, titel, warum: "", recht: "", ziel: "leitfaden", rot: false }, o);
  const d0 = () => asOrgDaten(), heute = asHeute();
  const sollZeilen = f => asBeauftragteSoll().filter(z => z.funktion === f);
  return [
    /* Startbedingungen */
    K("S-1", 1, "S", "Auftragsverarbeitung (AVV) abgeschlossen", { warum: "Personendaten dürfen erst danach erfasst werden.", recht: "Art. 28 DSGVO", ziel: "organisation",
      pruef: () => asLfOk(d0().avv_am || (AS.kundeV1 && AS.kundeV1.avv_abgeschlossen_am), "", "Datum der AVV fehlt") }),
    K("S-2", 1, "S", "Beschäftigte und Struktur mit Schichten erfasst", { warum: "Alle Schwellenwerte (ASA, SiBe, Ersthelfer) hängen daran.", recht: "§ 11 ASiG · § 26 DGUV V1", ziel: "organisation/struktur",
      pruef: () => { const ma = asBeschaeftigte().kopf, e = asT("as_einheit").filter(x => +x.beschaeftigte > 0);
        return asLfOk(ma > 0 && e.length && e.every(x => +x.schichten >= 1), ma + " Beschäftigte · " + e.length + " Einheiten", ma ? "Einheiten mit Beschäftigten und Schichten anlegen" : "Beschäftigtenzahl fehlt"); } }),
    K("S-3", 1, "S", "Erstaufnahme der Organisation durchgeführt", { warum: "Ausgangslage für alles Weitere.", recht: "BGHM-Reifegradinstrument", ziel: "check",
      pruef: () => { const c = asLetzterCheck(); return asLfOk(c, c ? "vom " + asDat(c.datum) : "", "Organisations-Check durchführen"); } }),

    /* 1a Verantwortung & Betreuung */
    K("1a-1", 1, "1a", "Pflichten schriftlich an die Führungskräfte übertragen", { warum: "Nur eine unterschriebene Übertragung verlagert Verantwortung wirksam.", recht: "§ 13 ArbSchG · § 13 DGUV V1", sa: 24 }),
    K("1a-2", 1, "1a", "Fachkraft für Arbeitssicherheit bestellt", { warum: "Gesetzliche Beratungspflicht.", recht: "§ 5 ASiG · DGUV V2", ziel: "organisation",
      pruef: () => asLfOk(d0().sifa_bestellt_am && d0().sifa_name, d0().sifa_name, "Bestelldatum und Name eintragen") }),
    K("1a-3", 1, "1a", "Betriebsarzt bestellt", { warum: "Beratung und Voraussetzung für die Vorsorge.", recht: "§ 2 ASiG · DGUV V2", ziel: "organisation",
      pruef: () => asLfOk(d0().ba_bestellt_am && d0().ba_name, d0().ba_name, "Bestelldatum und Name eintragen") }),
    K("1a-4", 1, "1a", "Betreuungsumfang nach DGUV V2 vereinbart", { warum: "Umfang und Aufteilung müssen ermittelt und vereinbart sein.", recht: "§ 2 DGUV V2 mit Anlage 1/2", ziel: "organisation/einsatz",
      pruef: () => asLfOk(d0().einsatz_vereinbart_am && (asBeschaeftigte().gewichtet <= 20 || d0().betreuungsgruppe), d0().einsatz_vereinbart_am ? "vereinbart " + asDat(d0().einsatz_vereinbart_am) : "", "Vereinbarung und Betreuungsgruppe eintragen") }),
    K("1a-5", 1, "1a", "Sifa und Betriebsarzt berichten regelmäßig", { warum: "Der Unternehmer muss die Berichte einfordern.", recht: "§ 5 DGUV V2", ziel: "bericht",
      pruef: () => asLfFrist(asLfPlus(d0().jahresbericht_am, 365), 30, false) }),
    K("1a-6", 1, "1a", "Begehung durch Sifa/Betriebsarzt in den letzten 12 Monaten", { warum: "Regelmäßige Begehung ist gesetzliche Aufgabe (Intervall 12 Monate: OAK-Festlegung).", recht: "§§ 3, 6, 10 ASiG", ziel: "unterlagen", sa: 12,
      pruef: () => { const b = (AS_B.docs || []).filter(x => x.kategorie === "begehungen" && x.stand).map(x => x.stand).sort().pop();
        return b ? asLfFrist(asLfPlus(b, 365), 30, false) : asLfSaPruef(AS_LF.d, { id: "1a-6", sa: 12 }); } }),
    K("1a-7", 1, "1a", "Arbeitsschutzausschuss tagt jedes Quartal", { warum: "Gesetzliches Gremium ab mehr als 20 Beschäftigten.", recht: "§ 11 ASiG", ziel: "steuerung/asa",
      gilt: () => asBeschaeftigte().gewichtet > 20,
      pruef: () => { const q = asT("as_asa").filter(a => a.abgeschlossen && a.datum).map(a => asLfQuartal(a.datum)), jetzt = asLfQuartal(new Date());
        if(q.includes(jetzt)) return { s: "ok", info: "Sitzung im laufenden Quartal" };
        const ende = new Date(); ende.setMonth(Math.floor(ende.getMonth() / 3) * 3 + 3, 0);
        const qEnde = ende.toISOString().slice(0, 10), vorQ = q.includes(jetzt - 1);
        if(!vorQ){ const beginn = new Date(); beginn.setMonth(Math.floor(beginn.getMonth() / 3) * 3, 1);
          return asLfFrist(asLfPlus(beginn.toISOString().slice(0, 10), -1), 0, false, "im Vorquartal keine Sitzung"); }
        return asLfFrist(qEnde, 14, false, "Sitzung im laufenden Quartal bis " + asDat(qEnde)); } }),
    K("1a-8", 1, "1a", "Sicherheitsbeauftragte bestellt", { warum: "Pflicht ab 50 Beschäftigten, bei 21–49 bei besonderer Gefährdung; Empfehlung OAK 1 je 50.", recht: "§ 22 Abs. 1 SGB VII (seit 29.05.2026)", ziel: "organisation/beauftragte",
      gilt: () => sollZeilen("sibe").length > 0,
      pruef: () => { const z = sollZeilen("sibe")[0]; return asLfOk(z.ist >= (z.pflicht || 1), z.ist + " bestellt · Pflicht " + (z.pflicht || 1) + " · Empfehlung " + z.soll, z.ist + " von mindestens " + (z.pflicht || 1) + " bestellt"); } }),
    K("1a-9", 1, "1a", "Fremdfirmen: Vorgaben, Koordinator, Einweisung geregelt", { warum: "Mehrere Arbeitgeber an einem Ort müssen sich abstimmen.", recht: "§ 8 ArbSchG · §§ 5, 6 DGUV V1", sa: 24, nz: "Es werden keine Fremdfirmen eingesetzt" }),
    K("1a-10", 1, "1a", "Vorschriften, Aushänge und Regeln zugänglich", { warum: "Beschäftigte müssen die geltenden Vorschriften einsehen können.", recht: "§ 12 DGUV V1 · § 16 ArbZG · § 26 MuSchG · § 47 JArbSchG", sa: 24 }),
    K("1a-11", 1, "1a", "Anordnungen von Behörde/BG fristgerecht umgesetzt", { warum: "Nach Fristablauf muss die Umsetzung gemeldet sein.", recht: "§ 10 Abs. 2 DGUV V1 · § 22 Abs. 3 ArbSchG", ziel: "massnahmen", rot: true,
      pruef: () => { const ue = asT("as_massnahme").filter(m => m.quelle === "behoerde" && m.status === "offen" && m.termin && m.termin < heute).length;
        return asLfOk(!ue, "keine überfälligen Anordnungen", ue + " Anordnung(en) überfällig"); } }),

    /* 1b Notfall & Erste Hilfe */
    K("1b-1", 1, "1b", "Ersthelfer je Schicht in ausreichender Zahl", { warum: "Hilfe in den ersten Minuten.", recht: "§ 26 DGUV V1", ziel: "organisation/beauftragte", rot: true,
      pruef: () => { const z = sollZeilen("ersthelfer"); return z.length ? asLfOk(z.every(x => x.ist >= x.soll), z.length + " Einheiten/Schichten erfüllt", z.filter(x => x.ist < x.soll).length + " Lücke(n)") : { s: "offen", info: "Struktur mit Schichten fehlt" }; } }),
    K("1b-2", 1, "1b", "Brandschutzhelfer in ausreichender Zahl", { warum: "Bekämpfung von Entstehungsbränden.", recht: "ASR A2.2 Nr. 7.3 · § 10 ArbSchG", ziel: "organisation/beauftragte", rot: true,
      pruef: () => { const z = sollZeilen("brandschutzhelfer"); return z.length ? asLfOk(z.every(x => x.ist >= x.soll), "erfüllt", z.filter(x => x.ist < x.soll).length + " Lücke(n)") : { s: "offen", info: "Struktur mit Schichten fehlt" }; } }),
    K("1b-3", 1, "1b", "Notfallorganisation geplant (Alarmplan, Brandschutzordnung)", { warum: "Notfallmaßnahmen müssen vorab geplant sein.", recht: "§ 10 ArbSchG · §§ 21, 22 DGUV V1 · ASR A2.2", sa: 24 }),
    K("1b-4", 1, "1b", "Flucht- und Rettungsplan aktuell, Evakuierung geübt", { warum: "Sicheres Verlassen im Ereignisfall.", recht: "§ 4 Abs. 4 ArbStättV · ASR A2.3 Nr. 10, 11", sa: 24, nz: "Nach ASR A2.3 Nr. 10 nicht erforderlich" }),
    K("1b-5", 1, "1b", "Erste-Hilfe-Material und Aushang Erste Hilfe vorhanden", { warum: "Erste Hilfe muss in jeder Schicht erreichbar sein.", recht: "§§ 24, 25 DGUV V1 · ASR A4.3", sa: 12,
      hinweis: () => { const n = asBeschaeftigte().kopf; return "Soll nach ASR A4.3 (Herstellung): " + (n <= 20 ? "1 kleiner" : n <= 100 ? "1 großer" : (2 + Math.max(0, Math.ceil((n - 200) / 100))) + " große") + " Verbandkasten, höchstens 100 m Weg"; } }),
    K("1b-6", 1, "1b", "Feuerlöscher und Sicherheitseinrichtungen geprüft", { warum: "Müssen im Ernstfall funktionieren.", recht: "§ 4 Abs. 3 ArbStättV · ASR A2.2 Nr. 7.4.2", ziel: "pruefungen", rot: true,
      pruef: () => { const o = asPfObjekte().filter(x => x.art === "feuerloescher");
        if(!o.length) return { s: "offen", info: "Feuerlöscher im Prüfkataster erfassen" };
        const naechst = o.map(x => x.naechste_am).filter(Boolean).sort()[0], nok = o.some(x => x.letzte_ergebnis === "nicht_ok");
        return nok ? { s: "offen", info: "Prüfergebnis „nicht in Ordnung“" } : asLfFrist(naechst, 30, true, o.length + " Feuerlöscher fristgerecht"); } }),
    K("1b-7", 1, "1b", "Erste-Hilfe-Leistungen werden dokumentiert", { warum: "Nachweis für spätere Ansprüche gegenüber der BG.", recht: "§ 24 Abs. 6 DGUV V1", ziel: "vorfaelle",
      pruef: () => asLfOk((AS_LF.d.melde || []).length, "Melde-Code aktiv (Vorfälle mit Erste Hilfe)", "Melde-Code einrichten (Organisation → Zugänge & Geräte)") }),
    K("1b-8", 1, "1b", "Unfallanzeige bei mehr als 3 Tagen Arbeitsunfähigkeit binnen 3 Tagen", { warum: "Gesetzliche Anzeigepflicht.", recht: "§ 193 SGB VII", ziel: "leitfaden",
      pruef: () => { const f = (AS_LF.d.vorf || []).filter(v => v.art === "unfall" && +v.ausfalltage > 3 && !v.unfallanzeige_am);
        if(!f.length) return { s: "ok", info: "alle anzeigepflichtigen Unfälle angezeigt" };
        const alt = f.map(v => asLfPlus(v.ereignis_am || String(v.angelegt_am).slice(0, 10), 3)).sort()[0];
        return Object.assign(asLfFrist(alt, 0, true, f.length + " Unfallanzeige(n) offen"), { unfall: f }); } }),

    /* 1c Gefährdungen & Maßnahmen */
    K("1c-1", 1, "1c", "Beurteilung für alle Arbeitssysteme und Anlagen freigegeben", { warum: "Kernpflicht, alles andere leitet sich daraus ab.", recht: "§§ 5, 6 ArbSchG · § 3 BetrSichV · § 3 ArbStättV", ziel: "bda",
      pruef: () => { const s = asT("as_arbeitssystem"), frei = s.filter(x => x.freigabe_am).length;
        const anl = (AS_B.docs || []).filter(x => x.kategorie === "anlagen"), ohne = anl.filter(x => !(x.status && x.status.gesamt) && !(x.typen || []).includes("bda")).length;
        return asLfOk(s.length && frei === s.length && !ohne, frei + " von " + s.length + " Arbeitssystemen · " + (anl.length - ohne) + " von " + anl.length + " Anlagen beurteilt",
          (s.length ? frei + " von " + s.length + " Arbeitssystemen freigegeben" : "noch keine Arbeitssysteme") + (ohne ? " · " + ohne + " Anlagen ohne Beurteilung" : "")); } }),
    K("1c-2", 1, "1c", "Beurteilungen aktuell (keine Regelfrist überschritten)", { warum: "Regelmäßig und bei Änderungen zu überprüfen.", recht: "§ 3 Abs. 7 BetrSichV · § 3 Abs. 2 DGUV V1", ziel: "kalender",
      pruef: () => { const f = asT("as_arbeitssystem").map(x => x.naechste_pruefung).concat((AS_LF.d.pa || []).map(p => p.faellig_am)).filter(Boolean).sort()[0];
        return f ? asLfFrist(f, 30, false, "nächste Überprüfung " + asDat(f)) : { s: "ok", info: "keine Überprüfung fällig" }; } }),
    K("1c-3", 1, "1c", "Psychische Belastung für alle Arbeitssysteme beurteilt", { warum: "Ausdrücklicher Bestandteil der Beurteilung.", recht: "§ 5 Abs. 3 Nr. 6 ArbSchG", ziel: "bda",
      pruef: () => { const s = asT("as_arbeitssystem"), b = s.filter(x => asT("as_psyche").some(p => p.arbeitssystem_id === x.id)).length;
        return asLfOk(s.length && b === s.length, b + " von " + s.length, b + " von " + s.length + " beurteilt"); } }),
    K("1c-4", 1, "1c", "Mutterschutz: Beurteilung für jede Tätigkeit, alle informiert", { warum: "Pflicht für jede Tätigkeit, auch ohne Schwangerschaft.", recht: "§§ 10, 14 MuSchG", sa: 24 }),
    K("1c-5", 1, "1c", "Hohe Risiken: Maßnahmen mit Verantwortlichem und Termin, nichts überfällig", { warum: "Hohe Risiken dulden keinen Aufschub.", recht: "§§ 3, 4 ArbSchG", ziel: "massnahmen", rot: true,
      pruef: () => { const rot = asT("as_massnahme").filter(m => { const g = asNach("as_gefaehrdung", m.gefaehrdung_id); return m.status === "offen" && ((g && asBand(asRisiko(g.w_v, g.s_v)) === "rot") || (m._mg && asMgBand(m._mg) === "gefahr")); });
        const ohne = rot.filter(m => !m.verantwortlich || !m.termin).length, ue = rot.filter(m => m.termin && m.termin < heute).length;
        if(ohne || ue) return { s: "offen", info: [ohne && ohne + " ohne Verantwortlichen/Termin", ue && ue + " überfällig"].filter(Boolean).join(" · ") };
        const f = rot.map(m => m.termin).filter(Boolean).sort()[0];
        return f ? asLfFrist(f, 14, true, rot.length + " offen, alle terminiert") : { s: "ok", info: "keine offenen hohen Risiken" }; } }),
    K("1c-6", 1, "1c", "Maßnahmen auf Wirksamkeit geprüft", { warum: "Wirksamkeitskontrolle ist Pflicht (90 Tage: OAK-Festlegung).", recht: "§ 3 Abs. 1 S. 2, § 6 ArbSchG", ziel: "massnahmen",
      pruef: () => { const f = asT("as_massnahme").filter(m => m.status === "erledigt" && m.erledigt_am && !m.wirksam_am).map(m => asLfPlus(m.erledigt_am, 90)).sort()[0];
        return f ? asLfFrist(f, 14, false, "Wirksamkeit prüfen bis " + asDat(f)) : { s: "ok", info: "alle erledigten Maßnahmen bewertet" }; } }),
    K("1c-7", 1, "1c", "Explosionsschutzdokument (wenn explosionsfähige Atmosphäre möglich)", { warum: "Besondere Dokumentationspflicht.", recht: "§ 6 Abs. 9 GefStoffV · TRGS 720–722", sa: 36, nz: "Keine explosionsfähige Atmosphäre möglich (laut Beurteilung)" }),

    /* 1d Arbeitsmittel & Gefahrstoffe */
    K("1d-1", 1, "1d", "Prüfkataster vollständig (Prüfart, Frist, Prüfer)", { warum: "Art, Umfang und Fristen der Prüfungen sind festzulegen.", recht: "§§ 3 Abs. 6, 14 BetrSichV · DGUV V3", ziel: "pruefungen",
      pruef: () => { const o = asPfObjekte(), anl = (AS_B.docs || []).filter(x => x.kategorie === "anlagen" && x.maschinen_id);
        const ohneO = anl.filter(a => !o.some(x => x.maschinen_id === a.maschinen_id)).length, unv = o.filter(x => !x.intervall_monate || !x.pruefer).length;
        const el = o.some(x => x.art === "elektro_mobil") && o.some(x => x.art === "elektro_fest");
        return asLfOk(o.length && !ohneO && !unv && el, o.length + " Prüfobjekte", [!o.length && "noch keine Prüfobjekte", ohneO && ohneO + " Anlagen ohne Prüfobjekt", unv && unv + " ohne Frist/Prüfer", !el && "Elektroprüfung (ortsveränderlich + ortsfest) fehlt"].filter(Boolean).join(" · ")); } }),
    K("1d-2", 1, "1d", "Keine Prüfung überfällig", { warum: "Prüfpflichtige Arbeitsmittel nur mit gültiger Prüfung verwenden.", recht: "§§ 4, 14 BetrSichV · § 5 DGUV V3", ziel: "pruefungen", rot: true,
      pruef: () => { const o = asPfObjekte(); if(!o.length) return { s: "offen", info: "Prüfkataster anlegen" };
        if(o.some(x => x.letzte_ergebnis === "nicht_ok")) return { s: "offen", info: o.filter(x => x.letzte_ergebnis === "nicht_ok").length + " „nicht in Ordnung“" };
        const f = o.map(x => x.naechste_am).filter(Boolean).sort()[0]; return f ? asLfFrist(f, 30, true, "nächste Prüfung " + asDat(f)) : { s: "offen", info: "Prüftermine fehlen" }; } }),
    K("1d-3", 1, "1d", "Betriebsanweisungen für alle Arbeitssysteme", { warum: "Schriftliche BA vor erster Verwendung.", recht: "§ 12 Abs. 2 BetrSichV", ziel: "bda",
      pruef: () => { const s = asT("as_arbeitssystem"), b = s.filter(x => x.ba_vorhanden).length; return asLfOk(s.length && b === s.length, b + " von " + s.length, b + " von " + s.length + " mit BA"); } }),
    K("1d-4", 1, "1d", "Stapler/Krane: schriftliche Beauftragung mit Befähigung", { warum: "Nur beauftragte, befähigte Personen.", recht: "§ 12 Abs. 3 BetrSichV · DGUV V68 § 7 · DGUV V52 § 29", ziel: "nachweise",
      gilt: () => asPfObjekte().some(x => x.art === "stapler" || x.art === "kran"),
      pruef: () => { const arten = ["stapler", "kran"].filter(a => asPfObjekte().some(x => x.art === a));
        const fehlt = arten.filter(a => !asT("as_beauftragter").some(b => b.funktion === a && (!b.gueltig_bis || b.gueltig_bis >= heute)));
        return asLfOk(!fehlt.length, arten.join(", ") + ": beauftragt", "keine gültige Beauftragung: " + fehlt.join(", ")); } }),
    K("1d-5", 1, "1d", "PSA bereitgestellt und unterwiesen", { warum: "Wo PSA Maßnahme ist, muss sie gestellt und erklärt sein.", recht: "PSA-BV · § 4 Nr. 5 ArbSchG", ziel: "massnahmen",
      gilt: () => asT("as_massnahme").some(m => m.stop === "P"),
      pruef: () => { const o = asT("as_massnahme").filter(m => m.stop === "P" && m.status === "offen").length; return asLfOk(!o, "PSA-Maßnahmen umgesetzt", o + " PSA-Maßnahme(n) offen"); } }),
    K("1d-6", 1, "1d", "Gefahrstoffverzeichnis vollständig, Sicherheitsdatenblätter aktuell", { warum: "Pflichtangaben und Verweis auf das SDB (2 Jahre: OAK-Festlegung).", recht: "§ 6 Abs. 12 GefStoffV · Art. 31 REACH", ziel: "gefahrstoffe",
      gilt: () => asLfGsAktiv(AS_LF.d).length > 0,
      pruef: () => { const g = asLfGsAktiv(AS_LF.d), unv = g.filter(x => !x.sdb_pfad || !(x.h_saetze && x.h_saetze.length)).length;
        const sdb = g.map(x => [x.sdb_ausgabe, x.sdb_geprueft_am].filter(Boolean).sort().pop()).map(x => asLfMon(x, 24));
        if(unv) return { s: "offen", info: unv + " Stoffe ohne SDB oder H-Sätze" };
        return sdb.some(x => !x) ? { s: "offen", info: "SDB-Datum fehlt" } : asLfFrist(sdb.sort()[0], 30, false, g.length + " Stoffe, SDB aktuell"); } }),
    K("1d-7", 1, "1d", "Gefährdungsbeurteilung je Gefahrstoff freigegeben", { warum: "Tätigkeit erst nach Beurteilung und Schutzmaßnahmen.", recht: "§§ 6, 7 GefStoffV · TRGS 400", ziel: "gefahrstoffe", rot: true,
      gilt: () => asLfGsAktiv(AS_LF.d).length > 0,
      pruef: () => { const g = asLfGsAktiv(AS_LF.d), gb = AS_LF.d.gsgbu || [];
        const ohne = g.filter(x => !gb.some(b => b.gefahrstoff_id === x.id && b.status === "freigegeben")).length;
        if(ohne) return { s: "offen", info: ohne + " Stoffe ohne freigegebene Beurteilung" };
        const f = gb.filter(b => b.status === "freigegeben").map(b => b.naechste_pruefung).filter(Boolean).sort()[0];
        return f ? asLfFrist(f, 30, true, "nächste Überprüfung " + asDat(f)) : { s: "ok", info: "alle Stoffe beurteilt" }; } }),
    K("1d-8", 1, "1d", "Betriebsanweisungen für Gefahrstoffe", { warum: "Schriftliche BA in verständlicher Sprache.", recht: "§ 14 Abs. 1 GefStoffV · TRGS 555", ziel: "gefahrstoffe",
      gilt: () => asLfGsAktiv(AS_LF.d).length > 0,
      pruef: () => { const frei = new Set((AS_LF.d.gsgbu || []).filter(b => b.status === "freigegeben").map(b => b.gefahrstoff_id));
        const o = asLfGsAktiv(AS_LF.d).filter(x => !x.ba_pfad && !x.ba_gruppe && !frei.has(x.id)).length; return asLfOk(!o, "alle Stoffe mit BA", o + " Stoffe ohne BA"); } }),

    /* 1e Unterweisung, Vorsorge & besondere Personengruppen */
    K("1e-1", 1, "1e", "Erstunterweisung vor Aufnahme der Tätigkeit", { warum: "Neue Beschäftigte sind am stärksten gefährdet.", recht: "§ 12 ArbSchG · § 4 DGUV V1", ziel: "unterweisungen", rot: true,
      pruef: () => { const f = (AS_LF.d.uw || []).filter(u => u.status === "erstunterweisung").map(u => u.faellig_am).filter(Boolean).sort()[0];
        return f ? asLfFrist(f, 7, true, "Erstunterweisung offen") : { s: "ok", info: "keine Erstunterweisung offen" }; } }),
    K("1e-2", 1, "1e", "Unterweisung mindestens jährlich für alle", { warum: "Wiederholung mindestens einmal jährlich.", recht: "§ 4 DGUV V1 · § 12 BetrSichV · § 6 ArbStättV", ziel: "unterweisungen",
      pruef: () => { const u = AS_LF.d.uw || []; if(!u.length) return { s: "offen", info: "Personen und Unterweisungen erfassen" };
        const f = u.filter(x => x.status !== "erstunterweisung").map(x => x.faellig_am).filter(Boolean).sort()[0];
        return f ? asLfFrist(f, 30, false, u.filter(x => x.status === "ok").length + " von " + u.length + " aktuell") : { s: "ok", info: "alle aktuell" }; } }),
    K("1e-3", 1, "1e", "Gefahrstoff-Unterweisung mündlich anhand der BA", { warum: "Besondere Form: mündlich, jährlich, unterschrieben.", recht: "§ 14 Abs. 2 GefStoffV", sa: 12,
      gilt: () => asLfGsAktiv(AS_LF.d).length > 0 }),
    K("1e-4", 1, "1e", "Arbeitsmedizinische Vorsorge veranlasst bzw. angeboten", { warum: "Ohne Pflichtvorsorge darf die Tätigkeit nicht ausgeübt werden.", recht: "§§ 3–5 ArbMedVV", ziel: "nachweise/vorsorge", rot: true,
      pruef: () => { if(!d0().vorsorge_am) return { s: "offen", info: "Vorsorgeanlässe mit dem Betriebsarzt festlegen" };
        const p = (AS_LF.d.vorsorge || []).filter(v => v.art === "pflicht" && v.naechste).map(v => v.naechste).sort()[0];
        const a = (AS_LF.d.vorsorge || []).filter(v => v.art === "angebot" && v.naechste).map(v => v.naechste).sort()[0];
        const rp = p ? asLfFrist(p, 60, true) : { s: "ok" }, ra = a ? asLfFrist(a, 60, false) : { s: "ok" };
        const rang = { ok: 0, warn: 1, karenz: 2, offen: 3 }, r = rang[rp.s] >= rang[ra.s] ? rp : ra;
        return Object.assign({}, r, { info: r.s === "ok" ? "Vorsorge fristgerecht" : (r === rp ? "Pflichtvorsorge: " : "Angebotsvorsorge: ") + r.info }); } }),
    K("1e-5", 1, "1e", "Jugendliche: Beurteilung, halbjährliche Unterweisung, Untersuchungen", { warum: "Strengere Regeln für unter 18-Jährige (Auszubildende!).", recht: "§§ 28a, 29, 32, 33 JArbSchG", sa: 6, nz: "Keine Beschäftigten unter 18 Jahren" }),
    K("1e-6", 1, "1e", "Arbeitszeit wird erfasst", { warum: "Erfassungspflicht nach BAG.", recht: "§ 3 Abs. 2 ArbSchG · BAG 1 ABR 22/21 · § 16 ArbZG", sa: 24 }),

    /* Stufe 2 – System */
    K("2-1", 2, "2", "Willenserklärung der Geschäftsführung", { warum: "Startpunkt jedes Arbeitsschutzmanagements.", recht: "NLF/ILO-OSH „Politik“ · BGHM-Reifegrad K3", ziel: "organisation",
      pruef: () => asLfFrist(asLfMon(d0().willenserklaerung_am, 36), 30, false) }),
    K("2-2", 2, "2", "Leitung je Bereich und Prozess Organisation freigegeben", { warum: "Jeder kennt seine Aufgabe.", recht: "BGHM-Reifegrad K1 · GDA-ORGAcheck 1.2", ziel: "organisation/struktur",
      pruef: () => { const ohne = asT("as_einheit").filter(e => +e.beschaeftigte > 0 && !e.leitung).length, p = asT("as_prozess").some(x => x.prozess_id === "P01" && x.freigegeben_am);
        return asLfOk(!ohne && p, "alle Bereiche mit Leitung", [ohne && ohne + " Bereiche ohne Leitung", !p && "Prozess P01 nicht freigegeben"].filter(Boolean).join(" · ")); } }),
    K("2-3", 2, "2", "Wahrnehmung der übertragenen Pflichten jährlich kontrolliert", { warum: "Übertragung wirkt nur mit Kontrolle.", recht: "GDA-ORGAcheck 2 · BGHM-Reifegrad K1.6", sa: 12 }),
    K("2-4", 2, "2", "Mitzeichnung der Sifa bei Planung und Beschaffung", { warum: "Gefährdungen vermeiden, bevor sie eingekauft werden.", recht: "§ 6 ASiG · § 3 Abs. 3 BetrSichV · Prozess P12", ziel: "mitzeichnung",
      pruef: () => { const p = asT("as_prozess").some(x => x.prozess_id === "P12" && x.freigegeben_am);
        const spaet = asT("as_mitzeichnung").filter(m => m.freigabe_am && (!m.empfehlung_am || m.empfehlung_am > m.freigabe_am) && asTageSeit(m.freigabe_am) <= 365).length;
        return asLfOk(p && !spaet, "Prozess P12 freigegeben", [!p && "Prozess P12 nicht freigegeben", spaet && spaet + " Freigaben ohne vorherige Empfehlung"].filter(Boolean).join(" · ")); } }),
    K("2-5", 2, "2", "Prozessbeschreibungen (Kernprozesse) freigegeben", { warum: "Regelungen statt Einzelwissen.", recht: "BGHM-Reifegrad K2 · NLF „Organisation“", ziel: "prozesse",
      pruef: () => { const kp = AS_KUNDENPROZESSE.filter(p => p.stufe <= 2), fr = new Set(asT("as_prozess").filter(p => p.freigegeben_am).map(p => p.prozess_id));
        const n = kp.filter(p => fr.has(p.id)).length; return asLfOk(n === kp.length, n + " von " + kp.length, n + " von " + kp.length + " freigegeben"); } }),
    K("2-6", 2, "2", "Rechtsänderungen bewertet (zur Kenntnis genommen)", { warum: "Organisiert wissen, was gilt und was sich ändert.", recht: "GDA-ORGAcheck 8 · ISO 45001 Abschn. 6.1.3, 9.1.2", ziel: "aktuelles",
      pruef: () => { const q = new Set((AS_LF.d.rq || []).map(x => x.rechtsinfo_id));
        const offen = (AS_LF.d.ri || []).filter(r => r.sichtbar !== false && (!r.kunde_slug || r.kunde_slug === AS.kunde) && ["gilt", "kommt"].includes(r.status) && !q.has(r.id));
        const f = offen.map(r => asLfPlus(String(r.erfasst_am).slice(0, 10), 60)).sort()[0];
        return f ? asLfFrist(f, 30, false, offen.length + " Neuerung(en) noch nicht zur Kenntnis genommen") : { s: "ok", info: "alle Neuerungen bewertet" }; } }),
    K("2-7", 2, "2", "Qualifizierung der Personen mit Arbeitsschutzaufgaben", { warum: "Fachkunde ist Voraussetzung wirksamer Übertragung.", recht: "GDA-ORGAcheck 4 · § 20 Abs. 6 DGUV V1", sa: 36 }),
    K("2-8", 2, "2", "Meldungen werden binnen 30 Tagen bearbeitet", { warum: "Frühindikatoren statt nur Unfallzahlen.", recht: "GDA-ORGAcheck 10 · BGHM-Reifegrad K4", ziel: "vorfaelle",
      pruef: () => { if(!(AS_LF.d.melde || []).length) return { s: "offen", info: "Melde-Code fehlt" };
        const f = (AS_LF.d.vorf || []).filter(v => !["erledigt", "abgeschlossen"].includes(v.status)).map(v => asLfPlus(String(v.angelegt_am).slice(0, 10), 30)).sort()[0];
        return f ? asLfFrist(f, 7, false, "älteste offene Meldung bearbeiten bis " + asDat(f)) : { s: "ok", info: "keine offenen Meldungen" }; } }),
    K("2-9", 2, "2", "Wirksamkeit bei mindestens 80 % der Maßnahmen bestätigt", { warum: "Kontrolle als Routine (Schwelle: OAK-Festlegung).", recht: "NLF „Messung und Bewertung“ · BGHM-Reifegrad K5", ziel: "massnahmen",
      pruef: () => { const w = asKennzahlen().massnahmen_wirksam; return asLfOk(w >= 80, w + " %", w + " % (Ziel 80 %)"); } }),
    K("2-10", 2, "2", "Fremdfirmen und Zeitarbeit über einen geregelten Prozess", { warum: "Standardablauf statt Einzelfall.", recht: "GDA-ORGAcheck 13, 14 · Prozess P26", sa: 36, nz: "Keine Fremdfirmen und keine Zeitarbeit" }),
    K("2-11", 2, "2", "Jährliche Selbstbewertung (Reifegrad-Check), K1/K2/K5/K6 mindestens Stufe II", { warum: "Systematische Standortbestimmung.", recht: "BGHM-Reifegradinstrument · GDA-ORGAcheck", ziel: "check",
      pruef: () => { const c = asLetzterCheck("voll"); if(!c) return { s: "offen", info: "Reifegrad-Check (Vollfassung) durchführen" };
        const rg = asCheckReifegrad(c), schwach = ["K1", "K2", "K5", "K6"].filter(x => rg[x] != null && rg[x] < 2);
        return schwach.length ? { s: "offen", info: "unter Stufe II: " + schwach.join(", ") } : asLfFrist(asLfPlus(c.datum, 365), 30, false); } }),

    /* Stufe 3 – Steuerung */
    K("3-1", 3, "3", "Mindestens zwei messbare Ziele, von der GF freigegeben", { warum: "Steuerung braucht ein messbares Ziel.", recht: "BGHM-Reifegrad K7.3 · ISO 45001 Abschn. 6.2", ziel: "steuerung/ziele",
      pruef: () => { const z = asT("as_ziel").filter(x => x.status === "aktiv" && x.freigegeben_am && x.kennzahl && x.soll != null && asTageSeit(x.freigegeben_am) <= 365);
        return asLfOk(z.length >= 2, z.length + " Ziele", z.length + " von 2 Zielen"); } }),
    K("3-2", 3, "3", "Ziele von Führungskräften verantwortet", { warum: "Ziele wirken erst, wenn Führungskräfte sie verantworten.", recht: "BGHM-Reifegrad K3.6", ziel: "steuerung/ziele",
      gilt: () => asBeschaeftigte().kopf > 50,
      pruef: () => { const n = asT("as_ziel").filter(x => x.status === "aktiv" && x.verantwortlich).length; return asLfOk(n >= 1, n + " Ziele mit Verantwortlichem", "kein Ziel mit Verantwortlichem"); } }),
    K("3-3", 3, "3", "Kennzahlen im ASA besprochen (letzte Sitzung)", { warum: "Vergleich über die Zeit.", recht: "BGHM-Reifegrad K7.2 · ISO 45001 Abschn. 9.1", ziel: "steuerung/asa",
      pruef: () => { const a = asT("as_asa").filter(x => x.abgeschlossen).sort((x, y) => String(y.datum).localeCompare(String(x.datum)))[0];
        return a && /kennzahl/i.test((a.tagesordnung || "") + " " + (a.protokoll || "")) ? asLfFrist(asLfPlus(a.datum, 100), 14, false, "ASA " + asDat(a.datum)) : { s: "offen", info: "Kennzahlen als Tagesordnungspunkt im ASA aufnehmen" }; } }),
    K("3-4", 3, "3", "Einsatzzeiten werden erfasst", { warum: "Die Betreuung findet tatsächlich statt.", recht: "DGUV V2 Anlage 2", ziel: "organisation/einsatz",
      gilt: () => asBeschaeftigte().gewichtet > 20,
      pruef: () => { const l = asT("as_einsatz").map(x => x.datum).filter(Boolean).sort().pop(); return asLfFrist(asLfPlus(l, 120), 30, false, l ? "letzter Eintrag " + asDat(l) : ""); } }),
    K("3-5", 3, "3", "Internes Audit nach Jahresprogramm", { warum: "Eigene Kontrolle vor der externen.", recht: "BGHM-Reifegrad K7.6 · ISO 45001 Abschn. 9.2", sa: 12 }),
    K("3-6", 3, "3", "Jährliche Managementbewertung durch die GF", { warum: "Leitung zieht Bilanz und entscheidet.", recht: "BGHM-Reifegrad K7.6 · ISO 45001 Abschn. 9.3", sa: 12 }),
    K("3-7", 3, "3", "Keine überfälligen Maßnahmen", { warum: "Verbesserung wird abgeschlossen, nicht nur geplant.", recht: "BGHM-Reifegrad K7.1, K7.4", ziel: "massnahmen",
      pruef: () => { const n = asKennzahlen().massnahmen_ueberfaellig; return asLfOk(!n, "keine überfällig", n + " überfällig"); } }),

    /* Stufe 4 – Kultur */
    K("4-1", 4, "4", "Kultur mit den Beschäftigten eingeschätzt (12 Monate)", { warum: "Kultur lässt sich nur mit den Beschäftigten messen.", recht: "DGUV/IAG KulturCheck (IAG Report 2/2018)", ziel: "steuerung/kultur",
      pruef: () => { const k = asT("as_kultur").map(x => x.datum).filter(Boolean).sort().pop(); return asLfFrist(asLfPlus(k, 365), 30, false); } }),
    K("4-2", 4, "4", "Kein Handlungsfeld der Kultureinschätzung im roten Bereich", { warum: "Kein Handlungsfeld darf Handlungsbedarf zeigen.", recht: "kommmitmensch-Handlungsfelder · KulturCheck-Auswertung", ziel: "steuerung/kultur",
      pruef: () => { const kc = typeof asKurzCheckLetzter === "function" ? asKurzCheckLetzter() : null; if(!kc) return { s: "offen", info: "KurzCheck durchführen" };
        const rot = Object.values((kc.antworten || {}).felder || {}).filter(x => x === "rot").length; return asLfOk(!rot, "kein Feld rot", rot + " Handlungsfeld(er) rot"); } }),
    K("4-3", 4, "4", "Sicherheitskultur mindestens „proaktiv“ (Hudson) bzw. „unabhängig“ (Bradley)", { warum: "Sicherheit aus eigener Überzeugung statt Kontrolle.", recht: "Hudson 2003 · Parker/Lawrie/Hudson 2006 (Bradley nur zur Anschauung)", ziel: "steuerung/kultur",
      pruef: () => { const k = typeof asKulturListe === "function" ? asKulturListe("bradley")[0] : null; return k ? asLfOk(k.stufe >= 3, "Einstufung " + asDat(k.datum), "Stufe " + k.stufe + " von 4") : { s: "offen", info: "Kultur einstufen" }; } }),
    K("4-4", 4, "4", "Thema des Monats läuft, mindestens die Hälfte erreicht", { warum: "Regelmäßiger Dialog statt nur Jahresunterweisung (Schwelle: OAK).", recht: "kommmitmensch HF Kommunikation", ziel: "steuerung/thema",
      pruef: () => { const t = asT("as_thema").filter(x => asTageSeit(x.monat) <= 62); const q = t.filter(x => x.beschaeftigte).map(x => (x.teilnehmer || 0) / x.beschaeftigte);
        return asLfOk(t.length >= 2 && q.length && q.reduce((a, b) => a + b, 0) / q.length >= 0.5, t.length + " Themen in 2 Monaten", t.length < 2 ? "Thema in jedem Monat" : "Beteiligung unter 50 %"); } }),
    K("4-5", 4, "4", "Melder bekommen Rückmeldung (mindestens 80 %)", { warum: "Wer meldet, erfährt, was passiert.", recht: "kommmitmensch HF Fehlerkultur", ziel: "steuerung/meldungen",
      pruef: () => { const q = asKennzahlen().rueckmeldung_quote; return asLfOk(q >= 80, q + " %", q + " % (Ziel 80 %)"); } }),
    K("4-6", 4, "4", "Aus Unfällen und Beinahe-Unfällen wird gelernt", { warum: "Lernen statt Schuldige suchen.", recht: "kommmitmensch HF Fehlerkultur · ISO 45001 Abschn. 10.2", ziel: "vorfaelle",
      pruef: () => { const v = (AS_LF.d.vorf || []).filter(x => ["unfall", "beinahe"].includes(x.art) && asTageSeit(x.ereignis_am || x.angelegt_am) > 30 && (!x.ausgewertet_am || !x.ursache)).length;
        return asLfOk(!v, "alle ausgewertet", v + " Ereignis(se) ohne Auswertung"); } }),
    K("4-7", 4, "4", "Beschäftigte an Beurteilungen beteiligt", { warum: "Wissen der Ausführenden nutzen.", recht: "BGHM-Reifegrad K4.7", ziel: "bda",
      pruef: () => { const s = asT("as_arbeitssystem"); const b = s.filter(x => asT("as_psyche").some(p => p.arbeitssystem_id === x.id && +p.teilnehmer > 0)).length;
        return asLfOk(s.length && b / s.length >= 0.8, b + " von " + s.length, b + " von " + s.length + " (Ziel 80 %)"); } }),
    K("4-8", 4, "4", "Führungskräfte zeigen Präsenz (Sicherheitsrundgänge je Quartal)", { warum: "Führung ist der wichtigste Impulsgeber.", recht: "kommmitmensch HF Führung · BGHM-Reifegrad K3.12", sa: 3 }),
    K("4-9", 4, "4", "Maßnahmen aus der Kultureinschätzung umgesetzt", { warum: "Messen allein ändert nichts.", recht: "KulturCheck Maßnahmenplan", sa: 12 }),
  ];
}

/* ---------- Auswertung ---------- */
function asLfAuswerten(){
  const d = AS_LF.d; if(!d) return null;
  const liste = asLfKriterien().map(k => {
    let r;
    try{
      if(k.gilt && !k.gilt()) r = { s: "na", info: "trifft nicht zu" };
      else if(k.sa && !k.pruef) r = asLfSaPruef(d, k);
      else r = k.pruef();
    }catch(e){ r = { s: "offen", info: "nicht auswertbar" }; }
    return Object.assign({}, k, r);
  });
  const erfuellt = x => ["ok", "warn", "karenz", "na"].includes(x.s);
  const stufen = AS_LF_STUFEN.map(st => {
    const eig = liste.filter(x => x.stufe === st.nr), bis = liste.filter(x => x.stufe <= st.nr);
    const zaehl = eig.filter(x => x.s !== "na");
    return Object.assign({}, st, { krit: eig, ok: zaehl.filter(erfuellt).length, gesamt: zaehl.length,
      erreicht: bis.every(erfuellt), gefaehrdet: bis.some(x => x.s === "karenz" || x.s === "warn") && bis.every(erfuellt) });
  });
  const stufe = stufen.filter(s => s.erreicht).length && stufen.findIndex(s => !s.erreicht) === -1 ? 4 : Math.max(0, stufen.findIndex(s => !s.erreicht));
  return { liste, stufen, stufe };
}
/* Badge-Verlauf in as_badge festhalten (nur mit Schreibrecht; angezeigt wird immer die Live-Auswertung) */
async function asLfVerlauf(erg){
  if(!(AS.gf || AS.fachkraft) || !erg) return;
  const heute = asHeute(), alt = AS_LF.d.badge || [];
  for(const st of erg.stufen){
    const b = alt.find(x => x.stufe === st.nr), aktiv = b && b.seit && !b.entzogen_am;
    if(st.erreicht && !aktiv){
      const z = { kunde_slug: AS.kunde, stufe: st.nr, erstmals_am: (b && b.erstmals_am) || heute, seit: heute, entzogen_am: null, ausloeser: null, geaendert_am: new Date().toISOString() };
      try{ if(b) await apiSend("PATCH", "/rest/v1/as_badge?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&stufe=eq." + st.nr, { erstmals_am: z.erstmals_am, seit: heute, entzogen_am: null, ausloeser: null, geaendert_am: z.geaendert_am }, "return=minimal");
        else await apiSend("POST", "/rest/v1/as_badge", z, "return=minimal");
        Object.assign(b || (alt[alt.length] = {}), z);
        await apiSend("POST", "/rest/v1/rpc/portal_logbuch_eintragen", { p_slug: AS.kunde, p_wer: "Automatik", p_bereich: "leitfaden", p_aktion: "Badge Stufe " + st.nr + " erreicht", p_objekt: st.name, p_details: null }).catch(() => {});
      }catch(e){ /* kein Schreibrecht oder offline – Anzeige bleibt live */ }
    } else if(!st.erreicht && aktiv){
      const ausl = st.krit.concat(erg.liste.filter(x => x.stufe < st.nr)).find(x => x.s === "offen");
      try{ await apiSend("PATCH", "/rest/v1/as_badge?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&stufe=eq." + st.nr, { entzogen_am: heute, ausloeser: ausl ? ausl.titel : null, geaendert_am: new Date().toISOString() }, "return=minimal");
        b.entzogen_am = heute;
        await apiSend("POST", "/rest/v1/rpc/portal_logbuch_eintragen", { p_slug: AS.kunde, p_wer: "Automatik", p_bereich: "leitfaden", p_aktion: "Badge Stufe " + st.nr + " erloschen", p_objekt: st.name, p_details: ausl ? ausl.titel : null }).catch(() => {});
      }catch(e){}
    }
  }
}

/* ---------- Darstellung ---------- */
const AS_LF_FARBE = { ok: "gruen", warn: "gelb", karenz: "orange", offen: "rot", na: "grau" };
const AS_LF_TEXT = { ok: "erfüllt", warn: "bald fällig", karenz: "Badge gefährdet", offen: "offen", na: "trifft nicht zu" };
function asLfCss(){
  if(document.getElementById("asLfCss")) return;
  const s = document.createElement("style"); s.id = "asLfCss";
  s.textContent = `.lf-badges{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  @media(max-width:820px){.lf-badges{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .lf-badge{border:1px solid var(--linie);border-radius:14px;padding:14px;text-align:center;background:#fff;cursor:pointer;position:relative}
  .lf-badge svg{width:64px;height:64px;display:block;margin:0 auto 6px}
  .lf-badge b{display:block;font-size:15px}.lf-badge small{display:block;color:#6b7785;font-size:12px;line-height:1.4;margin-top:3px}
  .lf-badge.aus{opacity:.55}.lf-badge.aus svg{filter:grayscale(1)}
  .lf-badge .lf-st{display:inline-block;margin-top:6px;font-size:11.5px;font-weight:600;border-radius:99px;padding:2px 9px}
  .lf-k{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:10px 0;border-top:1px solid var(--linie)}
  .lf-k .lf-p{width:12px;height:12px;border-radius:50%;margin-top:4px}
  .lf-k b{font-size:14px}.lf-k small{display:block;color:#6b7785;font-size:12.5px;line-height:1.45}
  .lf-p.gruen{background:#2e7d32}.lf-p.gelb{background:#f2b600}.lf-p.orange{background:#ef6c00}.lf-p.rot{background:#c62828}.lf-p.grau{background:#b0bac4}
  .lf-rot{color:#c62828;font-weight:700}
  .lf-etappe{margin:16px 0 2px;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7785}`;
  document.head.appendChild(s);
}
function asLfBadgeSvg(nr, an){
  const f = an ? ["#8a6d1f", "#5f6b75", "#2d6a4f", "#1b4332"][nr - 1] : "#b0bac4";
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 56 13v18c0 15-10 25-24 30C18 56 8 46 8 31V13z" fill="${f}" opacity=".14" stroke="${f}" stroke-width="2.5"/>
    <text x="32" y="40" text-anchor="middle" font-size="22" font-weight="700" fill="${f}" font-family="Jost,Segoe UI,sans-serif">${nr}</text></svg>`;
}
/* Badge-Zeile für die Übersicht (und oben auf „Ihr Weg“) */
function asLfBadgesHtml(erg){
  const b = AS_LF.d ? AS_LF.d.badge || [] : [];
  return `<div class="lf-badges">${erg.stufen.map(st => { const v = b.find(x => x.stufe === st.nr), an = st.erreicht;
    const st2 = an ? (st.gefaehrdet ? ["gefährdet", "#fff3e0", "#ef6c00"] : ["erreicht", "#e8f5e9", "#2e7d32"]) : ["noch offen", "#eef1f4", "#5f6b75"];
    return `<div class="lf-badge ${an ? "" : "aus"}" onclick="asGehe('leitfaden/${st.nr}')" title="${esc(st.text)}">${asLfBadgeSvg(st.nr, an)}
      <b>Stufe ${st.nr} · ${esc(st.name)}</b><small>${st.ok} von ${st.gesamt} Kriterien</small>
      <span class="lf-st" style="background:${st2[1]};color:${st2[2]}">${st2[0]}</span>
      ${an && v && v.seit ? `<small>seit ${esc(asDat(v.seit))}${v.audit_am ? " · + OAK-Audit " + esc(asDat(v.audit_am)) : ""}</small>` : ""}</div>`; }).join("")}</div>
    <p class="hinweis" style="margin-top:8px">Automatische Auswertung der vom Betrieb gepflegten Angaben. Keine Zertifizierung. Ein Badge erlischt von selbst, wenn ein Kriterium nicht mehr erfüllt ist.</p>`;
}
/* Für die Übersicht: lädt nach und füllt den Platzhalter */
async function asLfUebersicht(el){
  asLfCss();
  try{ await asLfLaden(); }catch(e){ el.innerHTML = `<div class="leer">Leitfaden konnte nicht geladen werden.</div>`; return; }
  const erg = asLfAuswerten(); if(!erg || !document.body.contains(el)) return;
  const naechste = erg.liste.filter(x => x.s !== "ok" && x.s !== "na").sort((a, b) => (a.stufe - b.stufe) || ((b.rot ? 1 : 0) - (a.rot ? 1 : 0)) || ({ offen: 0, karenz: 1, warn: 2 }[a.s] - { offen: 0, karenz: 1, warn: 2 }[b.s])).slice(0, 5);
  el.innerHTML = `<h2>Ihr Weg <a href="#leitfaden" class="btn sek klein" style="text-decoration:none">Leitfaden öffnen</a></h2>${asLfBadgesHtml(erg)}
    ${naechste.length ? `<div style="margin-top:6px"><h3>Als Nächstes</h3>${naechste.map(k => asLfZeile(k, true)).join("")}</div>` : ""}`;
  asLfZeilenAktiv(el);
  asLfVerlauf(erg);
}
function asLfZeile(k, kurz){
  const farbe = AS_LF_FARBE[k.s] || "grau";
  return `<div class="lf-k" data-lfk="${esc(k.id)}" style="cursor:pointer"><span class="lf-p ${farbe}"></span>
    <div><b>${esc(k.titel)}</b>${k.rot ? ' <span class="lf-rot" title="lebensrelevant, keine Karenz">●</span>' : ""}
      <small>${esc(asKlartext(k.info || ""))}${!kurz && k.warum ? " · " + esc(asKlartext(k.warum)) : ""}</small>
      ${!kurz && k.recht ? `<small>Grundlage: ${esc(asKlartext(k.recht))}</small>` : ""}${!kurz && k.hinweis ? `<small>${esc(k.hinweis())}</small>` : ""}</div>
    <span>${asChip(AS_LF_TEXT[k.s] || k.s, farbe === "orange" ? "gelb" : farbe)}</span></div>`;
}
function asLfZeilenAktiv(el){
  el.querySelectorAll("[data-lfk]").forEach(z => z.onclick = () => {
    const erg = asLfAuswerten(), k = erg.liste.find(x => x.id === z.dataset.lfk); if(!k) return;
    if(k.sa) return asLfSaDialog(k);
    if(k.id === "1b-8" && k.unfall) return asLfUnfallDialog(k);
    asGehe(k.ziel || "leitfaden");
  });
}

/* ---------- Seite „Ihr Weg“ ---------- */
AS_SEITEN.leitfaden = { titel: "Ihr Weg", icon: "◆", sort: 0.8, async render(main){
  asLfCss();
  main.innerHTML = `<h1 class="seite">Ihr Weg</h1><p class="unter">Schritt für Schritt zu einer vollständigen Arbeitsschutzorganisation – automatisch aus Ihren Daten ausgewertet.</p><div class="karte"><div class="leer">wird ausgewertet …</div></div>`;
  try{ await asLfLaden(true); }catch(e){}
  const erg = asLfAuswerten(); if(!erg) return;
  const akt = +(AS.reiter.leitfaden || (erg.stufe >= 4 ? 4 : erg.stufe + 1)) || 1, st = erg.stufen[Math.min(4, Math.max(1, akt)) - 1];
  const etappen = [...new Set(st.krit.map(k => k.etappe))];
  main.innerHTML = `<h1 class="seite">Ihr Weg</h1><p class="unter">Schritt für Schritt zu einer vollständigen Arbeitsschutzorganisation – automatisch aus Ihren Daten ausgewertet. Ein Klick auf ein Kriterium führt zur passenden Stelle.</p>
    <div class="karte">${asLfBadgesHtml(erg)}</div>
    <div class="reiter">${erg.stufen.map(s => `<button class="${s.nr === st.nr ? "an" : ""}" onclick="asGehe('leitfaden/${s.nr}')">Stufe ${s.nr} · ${esc(s.name)}</button>`).join("")}</div>
    <div class="karte"><h2>Stufe ${st.nr} · ${esc(st.name)} <span class="hinweis">${st.ok} von ${st.gesamt} erfüllt</span></h2>
      <p class="hinweis">${esc(st.text)}.${st.nr === 1 ? " Stufe 1 umfasst alle gesetzlichen Grundpflichten. ● = lebensrelevant: Hier erlischt das Badge ohne Schonfrist." : ""} Gelb = bald fällig, orange = überfällig mit 14 Tagen Schonfrist, rot = offen.</p>
      ${etappen.map(e => `<div class="lf-etappe">${esc(e === st.nr + "" ? AS_LF_ETAPPEN[e] : e.length > 1 && e !== "S" ? e + " · " + AS_LF_ETAPPEN[e] : AS_LF_ETAPPEN[e])}</div>${st.krit.filter(k => k.etappe === e).map(k => asLfZeile(k, false)).join("")}`).join("")}
      <p class="hinweis" style="margin-top:12px">Kriterien mit „Selbstauskunft“ bestätigen Sie mit Datum, Person und Nachweis (z. B. Foto oder PDF); sie laufen nach der angegebenen Zeit ab. Das optionale OAK-Audit prüft die Angaben vor Ort.</p></div>`;
  asLfZeilenAktiv(main);
  asLfVerlauf(erg);
}};

/* ---------- Selbstauskunft ---------- */
function asLfSaDialog(k){
  const x = asLfSa(AS_LF.d, k.id), darf = !!(AS.gf || AS.fachkraft);
  const verlauf = (AS_LF.d.sa || []).filter(s => s.kriterium === k.id).slice(0, 5);
  asDialog({ titel: k.titel, inhalt: `<p class="hinweis">${esc(asKlartext(k.warum))} Grundlage: ${esc(asKlartext(k.recht))}. Gültig ${k.sa} Monate ab Datum.</p>
    ${k.hinweis ? `<p class="hinweis">${esc(k.hinweis())}</p>` : ""}
    ${verlauf.length ? `<div class="zeilen">${verlauf.map(s => `<div class="z" style="cursor:default"><div><b>${s.nicht_zutreffend ? "trifft nicht zu" : "bestätigt"} am ${esc(asDat(s.datum))}</b>
      <small>${esc(s.person || "")}${s.notiz ? " · " + esc(s.notiz) : ""}${s.erfasst_von ? " · erfasst von " + esc(s.erfasst_von) : ""}</small></div>
      ${s.datei_pfad ? `<button class="btn sek klein" data-sad="${esc(s.datei_pfad)}">Nachweis</button>` : ""}</div>`).join("")}</div>` : `<p>Noch keine Selbstauskunft.</p>`}
    ${darf ? `<div class="form" style="margin-top:10px">${asFeld("Datum", "datum", asHeute(), "date")}${asFeld("Verantwortliche Person", "person", AS.ich || "")}
      ${asFeld("Notiz / Begründung", "notiz", "", "textarea", "voll")}
      <label class="voll">Nachweis (PDF oder Foto)<input type="file" id="saDatei" accept=".pdf,.jpg,.jpeg,.png,.webp"></label>
      ${k.nz ? asFeld(k.nz, "nz", false, "checkbox", "voll") : ""}</div>` : `<p class="hinweis">Bestätigen kann die Geschäftsführung oder die Fachkraft.</p>`}`,
    knoepfe: darf ? [{ t: "Bestätigen", fn: async dl => {
      const w = asWerte(dl), f = dl.querySelector("#saDatei").files[0];
      if(!w.nz && !f && !confirm("Ohne Nachweisdatei speichern? Für das Badge reicht das, für ein Audit sollte ein Nachweis vorliegen.")) return false;
      if(w.nz && !w.notiz){ asMeldung("Bitte kurz begründen, warum es nicht zutrifft"); return false; }
      let pfad = null;
      try{
        if(f){ asNwDateiOk(f); pfad = AS.kunde + "/selbstauskunft/" + k.id + "-" + Date.now() + "-" + asNwDateiName(f); await asNwHochladen(f, pfad); }
        await apiSend("POST", "/rest/v1/as_selbstauskunft", { kunde_slug: AS.kunde, kriterium: k.id, datum: w.datum || asHeute(), person: w.person || null,
          notiz: w.notiz || null, datei_pfad: pfad, nicht_zutreffend: !!w.nz, erfasst_von: AS.ich || null }, "return=minimal");
        apiSend("POST", "/rest/v1/rpc/portal_logbuch_eintragen", { p_slug: AS.kunde, p_wer: AS.ich || "Portal", p_bereich: "leitfaden", p_aktion: "Selbstauskunft", p_objekt: k.titel, p_details: w.nz ? "trifft nicht zu" : null }).catch(() => {});
      }catch(e){ asMeldung(e.message || String(e)); return false; }
      asMeldung("Gespeichert"); await asLfLaden(true); asZeige();
    } }] : [] });
  document.querySelectorAll("#dlg [data-sad]").forEach(b => b.onclick = async () => { const u = await asSigniert(b.dataset.sad); if(u) window.open(u, "_blank", "noopener"); });
}
/* 1b-8: Unfallanzeige je Unfall als erstattet vermerken */
function asLfUnfallDialog(k){
  const darf = !!(AS.gf || AS.fachkraft);
  asDialog({ titel: "Unfallanzeige (§ 193 SGB VII)", inhalt: `<p class="hinweis">Bei mehr als 3 Tagen Arbeitsunfähigkeit muss der Unfall binnen 3 Tagen der BG angezeigt werden (Formular der BG bzw. Extranet).</p>
    <div class="zeilen">${k.unfall.map(v => `<div class="z" style="cursor:default"><div><b>${esc(asDat(v.ereignis_am || String(v.angelegt_am).slice(0, 10)))} · ${esc(v.anlage || "Unfall")}</b><small>${esc(v.ausfalltage)} Ausfalltage</small></div>
      ${darf ? `<button class="btn klein" data-ua="${esc(v.id)}">angezeigt heute</button>` : ""}</div>`).join("")}</div>` });
  document.querySelectorAll("#dlg [data-ua]").forEach(b => b.onclick = async () => {
    try{ await apiSend("PATCH", "/rest/v1/portal_vorfaelle?id=eq." + encodeURIComponent(b.dataset.ua), { unfallanzeige_am: asHeute() }, "return=minimal"); }
    catch(e){ asMeldung(e.message || String(e)); return; }
    document.getElementById("dlg").close(); asMeldung("Unfallanzeige vermerkt"); await asLfLaden(true); asZeige();
  });
}

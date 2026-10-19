/* OAK EHS-Cockpit – Nutzung (nur OAK): Was tut sich in den Betrieben? Änderungen, aktive Zugänge (nur Anzahl),
   genutzte Bereiche, eingegangene Begehungs-Erfassungen – je Betrieb, nie je Person (keine Leistungs- oder
   Verhaltenskontrolle, § 87 Abs. 1 Nr. 6 BetrVG). Quellen: as_log, portal_logbuch, portal_erfassungen. Globale Namen: asNu/AS_NU. */
"use strict";

AS_ICON.nutzung = '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>';
const AS_NU_TAB = { as_massnahme: "Maßnahmen", as_gefaehrdung: "Beurteilungen", as_arbeitssystem: "Beurteilungen", as_taetigkeit: "Beurteilungen",
  as_pruefobjekt: "Prüfungen", as_pruefung: "Prüfungen", as_meldung: "Meldungen", as_ziel: "Ziele", as_asa: "ASA", as_mitzeichnung: "Mitzeichnung",
  as_notfall: "Notfall", as_fremdfirma: "Fremdfirmen", as_erlaubnisschein: "Fremdfirmen", as_orgcheck: "Organisations-Check", as_einsatz: "Einsatzzeiten",
  as_thema: "Thema des Monats", as_kultur: "Sicherheitskultur", as_psyche: "Psychische Belastung", as_ba: "Betriebsanweisungen", as_prozess: "Prozesse" };
const AS_NU = { tage: 30 };
function asNuDatum(t){ const x = new Date(); x.setDate(x.getDate() - t); return x.toISOString(); }

AS_SEITEN.nutzung = { titel: "Nutzung (OAK)", icon: "▤", sort: 9.6, get versteckt(){ return !AS.admin; }, async render(main){
  if(!AS.admin){ main.innerHTML = `<div class="leer">Nur für OAK.</div>`; return; }
  main.innerHTML = `<h1 class="seite">Nutzung</h1><p class="unter">wird geladen …</p>`;
  const seit = asNuDatum(AS_NU.tage), seit7 = asNuDatum(7);
  const hole = p => apiGet(p).then(r => Array.isArray(r) ? r : []).catch(() => []);
  const [log, lb, erf, kunden] = await Promise.all([
    hole("/rest/v1/as_log?select=kunde_slug,am,wer,tabelle&am=gte." + encodeURIComponent(seit) + "&order=am.desc&limit=20000"),
    hole("/rest/v1/portal_logbuch?select=kunde_slug,am,wer,bereich&am=gte." + encodeURIComponent(seit) + "&order=am.desc&limit=20000"),
    hole("/rest/v1/portal_erfassungen?select=id,kunde_slug,anlage,eingegangen_am,status&order=eingegangen_am.desc&limit=500"),
    hole("/rest/v1/as_organisation?select=kunde_slug,name&order=name.asc")]);
  const ereignisse = log.map(x => ({ k: x.kunde_slug, am: x.am, wer: x.wer, ber: AS_NU_TAB[x.tabelle] || "Sonstiges" }))
    .concat(lb.filter(x => x.wer !== "Automatik").map(x => ({ k: x.kunde_slug, am: x.am, wer: x.wer, ber: ({ maengel: "Mängel", unterweisung: "Unterweisungen", unterlagen: "Unterlagen", bda: "Beurteilungen", pruefauftrag: "Überprüfungen", leitfaden: "Safety-Journey", vorfaelle: "Vorfälle" })[x.bereich] || "Sonstiges" })));
  const zeilen = kunden.map(k => {
    const e = ereignisse.filter(x => x.k === k.kunde_slug), e7 = e.filter(x => x.am >= seit7);
    const ber = {}; e.forEach(x => ber[x.ber] = (ber[x.ber] || 0) + 1);
    const top = Object.entries(ber).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b, n]) => b + " " + n);
    const neu = erf.filter(x => x.kunde_slug === k.kunde_slug && (x.status || "neu") === "neu");
    return { k, n30: e.length, n7: e7.length, wer: new Set(e.map(x => x.wer).filter(Boolean)).size, letzte: e[0] ? e[0].am : null, top, neu };
  }).sort((a, b) => b.n7 - a.n7 || b.n30 - a.n30);
  const aktiv7 = zeilen.filter(z => z.n7).length, still = zeilen.filter(z => !z.n30).length, offen = erf.filter(x => (x.status || "neu") === "neu").length;
  const kachel = (farbe, lbl, zahl, hinweis) => `<div class="kachel k-${farbe}"><div class="lbl">${esc(lbl)}</div><div class="zahl">${zahl}</div><div class="hinweis">${esc(hinweis)}</div></div>`;
  main.innerHTML = `<h1 class="seite">Nutzung</h1><p class="unter">Was in den Betrieben passiert – je Betrieb und Bereich, bewusst ohne Auswertung einzelner Personen.</p>
    <div class="kacheln k4">
      ${kachel("gruen", "Betriebe aktiv (7 Tage)", aktiv7 + " / " + zeilen.length, "mit mindestens einer Änderung")}
      ${kachel("blau", "Änderungen (7 Tage)", zeilen.reduce((n, z) => n + z.n7, 0), zeilen.reduce((n, z) => n + z.n30, 0) + " in " + AS_NU.tage + " Tagen")}
      ${kachel(offen ? "gelb" : "gruen", "Neue Begehungs-Erfassungen", offen, offen ? "abholen: tools/erfassungen_holen.py" : "nichts offen")}
      ${kachel(still ? "gelb" : "gruen", "Ohne Aktivität (" + AS_NU.tage + " Tage)", still, "Betriebe – nachfassen?")}
    </div>
    <div class="karte"><h2>Je Betrieb <span class="hinweis">letzte ${AS_NU.tage} Tage</span></h2><div class="zeilen">${zeilen.map(z => `<div class="z" data-nk="${esc(z.k.kunde_slug)}"><div><b>${esc(z.k.name || z.k.kunde_slug)}</b>
        <small>${z.n30 ? z.n30 + " Änderungen · " + z.wer + " aktive Zugänge · zuletzt " + asDat(z.letzte) + (z.top.length ? " · " + esc(z.top.join(", ")) : "") : "keine Aktivität"}${z.neu.length ? " · " + z.neu.length + " neue Erfassung(en)" : ""}</small></div>
        ${asChip(z.n7 ? z.n7 + " in 7 Tagen" : z.n30 ? "ruhig" : "inaktiv", z.n7 ? "gruen" : z.n30 ? "gelb" : "grau")}</div>`).join("") || `<div class="leer">Keine Betriebe.</div>`}</div></div>
    <div class="karte"><h2>Begehungs-Erfassungen der Betriebe</h2><div class="zeilen">${erf.slice(0, 30).map(x => `<div class="z"><div><b>${esc(x.anlage)}</b>
        <small>${esc((kunden.find(k => k.kunde_slug === x.kunde_slug) || {}).name || x.kunde_slug)} · eingegangen ${asDat(x.eingegangen_am)}</small></div>
        ${asChip({ neu: "neu – abholen", in_arbeit: "in Arbeit", erledigt: "erledigt" }[x.status || "neu"] || x.status, (x.status || "neu") === "neu" ? "gelb" : x.status === "erledigt" ? "gruen" : "blau")}</div>`).join("")
        || `<div class="leer">Noch keine Erfassungen.</div>`}</div>
      <p class="hinweis">Abholen und auswerten: <code>python tools/erfassungen_holen.py --kunde &lt;slug&gt;</code> – danach wie gewohnt Transkript → GBU/BA → Portal.</p></div>`;
  main.querySelectorAll("[data-nk]").forEach(z => z.onclick = async () => { AS.kunde = z.dataset.nk; try{ localStorage.setItem("as_kunde", AS.kunde); }catch(e){}
    await asLaden(); asGehe("cockpit"); });
}};

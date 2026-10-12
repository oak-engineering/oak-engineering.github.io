/* OAK EHS-Cockpit – Leistungsnachweis: was OAK im Betrieb erbracht hat (Begehungen, Beurteilungen, Betriebsanweisungen,
   Kataster, Unterweisungen, Organisation) mit Listenwert nach references/oak.md § 5 (AS_KAT.preise).
   Ob und wie abgerechnet wird, steht je Betrieb in as_organisation.daten.abrechnung (z. B. WIBO: nicht berechnet,
   Anstellungsverhältnis). Werte sieht der Betrieb nur, wenn OAK das freischaltet (daten.leistungen_werte_zeigen). */
"use strict";

function asLeEuro(v){ return v == null ? "nach Aufwand" : v.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }); }
function asLeDatum(s){ const m = String(s || "").match(/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; }
async function asLePosten(){
  await asBetriebLaden();
  const P = AS_KAT.preise || {}, docs = AS_B.docs || [], L = [];
  const add = (gruppe, datum, titel, menge, einzel, hinweis) => L.push({ gruppe, datum, titel, menge, einzel, wert: einzel == null ? null : einzel * menge, hinweis: hinweis || "" });
  // Begehungen (nach Aufwand; Stunden aus den Einsatzzeiten desselben Tages)
  docs.filter(d => d.kategorie === "begehungen").forEach(d => {
    const tag = asLeDatum(d.stand) || asLeDatum(d.titel), h = asT("as_einsatz").filter(e => e.datum === tag).reduce((s, e) => s + (+e.stunden || 0), 0);
    add("Begehungen", tag, d.titel || "Begehung", 1, h ? h * P.stundensatz : null, h ? h + " h × " + P.stundensatz + " €" : "Dauer unter Organisation → Einsatzzeiten eintragen");
  });
  // Beurteilungen je Arbeitssystem (Anlage, allgemein, zentral) + Betriebsanweisungen je Anlage
  asT("as_arbeitssystem").forEach(s => {
    const tag = asLeDatum((String(s.beschreibung || "").match(/BdA vom (\d{4}-\d{2}-\d{2})/) || [])[1]);
    add("Beurteilungen der Arbeitsbedingungen", tag, s.name, 1, P.bda);
    if(s.ba_vorhanden) add("Betriebsanweisungen", tag, "BA " + s.name, 1, P.ba);
  });
  docs.filter(d => d.kategorie === "ba-sammel").forEach(d => add("Betriebsanweisungen", asLeDatum(d.stand), d.titel + " (Sammel-BA)", 1, P.ba));
  // Anlagenkataster: Ersterfassung vor Ort je Anlage (Anlagen, nicht Tätigkeiten)
  const anl = asAnlagen().filter(d => d.kategorie === "anlagen" && !/^ALLG/i.test(d.maschinen_id || ""));
  if(anl.length) add("Anlagenkataster", anl.map(d => asLeDatum(d.stand)).filter(Boolean).sort()[0], "Ersterfassung vor Ort", anl.length, P.kataster_vor_ort);
  // Gefahrstoffe
  const gs = docs.filter(d => d.kategorie === "gefahrstoffe");
  const anzahlStoffe = (await apiGet("/rest/v1/portal_gefahrstoff?select=id&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => [])).length;
  if(anzahlStoffe) add("Gefahrstoffe", gs.map(d => asLeDatum(d.stand)).filter(Boolean).sort()[0], "Gefahrstoffverzeichnis (" + anzahlStoffe + " Stoffe)", 1,
    P.gefahrstoffverzeichnis_bis_50, anzahlStoffe > 50 ? "Pauschale gilt bis 50 Stoffe – darüber nach Aufwand ergänzen" : "");
  gs.filter(d => /betriebsanweisung/i.test(d.titel || "")).forEach(d => add("Gefahrstoffe", asLeDatum(d.stand), d.titel, 1, P.ba));
  gs.filter(d => !/betriebsanweisung/i.test(d.titel || "")).forEach(d => add("Gefahrstoffe", asLeDatum(d.stand), d.titel, 1, null));
  // Unterweisungsmodule (je Thema einmal; Seitenzahl unbekannt -> Grundpreis, Seiten kommen dazu)
  const themen = new Map();
  docs.filter(d => d.kategorie === "unterweisungen").forEach(d => { const k = String(d.titel || "").replace(/\s*[–-]\s*Online-Unterweisung.*$/i, "").trim(); if(!themen.has(k)) themen.set(k, d); });
  themen.forEach((d, k) => add("Unterweisungen", asLeDatum(d.stand), "Unterweisungsmodul " + k, 1, P.unterweisung_grund, "zzgl. " + P.unterweisung_seite + " € je Seite"));
  // Weitere Unterlagen nach Aufwand
  docs.filter(d => d.kategorie === "hallenplan" && d.doc_typ !== "svg").forEach(d => add("Weitere Unterlagen", asLeDatum(d.stand), d.titel || "Hallenplan", 1, null));
  docs.filter(d => d.kategorie === "vorfall-aushang").slice(0, 1).forEach(d => add("Weitere Unterlagen", asLeDatum(d.stand), "Aushang „Vorfall melden“ mit QR-Melder", 1, null));
  // Organisation
  asT("as_orgcheck").forEach(c => add("Organisation des Arbeitsschutzes", c.datum, c.art === "voll" ? "Reifegrad-Check (BGHM, 7 Kernelemente)" : "Erstaufnahme der Organisation", 1, null));
  asKulturListe("dguv-kurzcheck").forEach(k => add("Organisation des Arbeitsschutzes", k.datum, "KurzCheck Präventionskultur (DGUV)", 1, null));
  asKulturListe("dguv-strukturcheck").forEach(k => add("Organisation des Arbeitsschutzes", k.datum, "StrukturCheck Präventionskultur (DGUV)", 1, null));
  // Einsatzzeiten (ohne Begehungstage, die oben stehen)
  const begTage = new Set(L.filter(x => x.gruppe === "Begehungen").map(x => x.datum));
  asT("as_einsatz").filter(e => !begTage.has(e.datum)).forEach(e => add("Betreuung (Einsatzzeiten)", e.datum, e.taetigkeit || "Einsatz", +e.stunden || 0, P.stundensatz, (e.rolle === "ba" ? "Betriebsarzt · " : "") + (+e.stunden || 0) + " h"));
  return L.sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
}

AS_SEITEN.leistungen = { titel: "Leistungen", icon: "€", sort: 9.2, async render(main){
  main.innerHTML = `<h1 class="seite">Leistungsnachweis</h1><p class="unter">Was OAK engineering im Betrieb erbracht hat.</p><div class="leer">wird geladen …</div>`;
  const L = await asLePosten(), d = asOrgDaten(), werte = AS.fachkraft || d.leistungen_werte_zeigen;
  const abr = d.abrechnung || "", gruppen = [...new Set(L.map(x => x.gruppe))];
  const summe = L.reduce((s, x) => s + (x.wert || 0), 0), offen = L.filter(x => x.wert == null).length;
  main.innerHTML = `<h1 class="seite">Leistungsnachweis</h1><p class="unter">Was OAK engineering bei ${esc(AS.org ? AS.org.name : "")} erbracht hat – Begehungen, Beurteilungen, Betriebsanweisungen, Kataster, Unterweisungen und Organisation.</p>
    <div class="karte"><h2>Überblick <span class="nodruck">${AS.admin ? `<button class="btn adm klein" id="leAbr">Abrechnung festlegen</button> ` : ""}<button class="btn sek klein" onclick="window.print()">Drucken</button></span></h2>
      ${abr ? `<p>${asChip("Abrechnung", "blau")} ${esc(abr)}</p>` : ""}
      <div class="kacheln">
        <div class="kachel"><div class="lbl">Leistungen</div><div class="zahl">${L.length}</div><div class="hinweis">Positionen</div></div>
        <div class="kachel"><div class="lbl">Begehungen</div><div class="zahl">${L.filter(x => x.gruppe === "Begehungen").length}</div></div>
        <div class="kachel"><div class="lbl">Beurteilungen</div><div class="zahl">${L.filter(x => x.gruppe.startsWith("Beurteilungen")).length}</div></div>
        ${werte ? `<div class="kachel"><div class="lbl">Wert nach Listenpreis</div><div class="zahl">${asLeEuro(summe)}</div><div class="hinweis">netto${offen ? " · " + offen + " Positionen nach Aufwand" : ""}${abr ? " · nicht abgerechnet, siehe oben" : ""}</div></div>` : ""}
      </div>
      ${werte ? `<p class="hinweis">Listenpreise nach den OAK-Dokumentenpauschalen (netto zzgl. 19 % USt). Positionen „nach Aufwand“ werden mit 90 €/h bewertet, sobald die Stunden unter Organisation → Einsatzzeiten erfasst sind.</p>` : ""}</div>
    ${gruppen.map(g => { const l = L.filter(x => x.gruppe === g), s = l.reduce((a, x) => a + (x.wert || 0), 0);
      return `<div class="karte"><h2>${esc(g)} <span class="hinweis">${l.length}${werte && s ? " · " + asLeEuro(s) : ""}</span></h2><div class="zeilen">${l.map(x => `<div class="z"><div><b>${esc(x.titel)}</b>
        <small>${x.datum ? asDat(x.datum) : "ohne Datum"}${x.menge !== 1 ? " · Menge " + x.menge : ""}${x.hinweis ? " · " + esc(x.hinweis) : ""}</small></div>
        ${werte ? `<span class="hinweis" style="white-space:nowrap">${asLeEuro(x.wert)}</span>` : ""}</div>`).join("")}</div></div>`; }).join("") || `<div class="karte"><div class="leer">Noch keine Leistungen erfasst.</div></div>`}`;
  const a = document.getElementById("leAbr"); if(a) a.onclick = () => asDialog({ titel: "Abrechnung festlegen", inhalt: `<div class="form">
      ${asFeld("Abrechnung (erscheint auf dem Nachweis)", "abrechnung", d.abrechnung || "", "text", "voll")}
      ${asFeld("Werte auch dem Betrieb zeigen", "leistungen_werte_zeigen", d.leistungen_werte_zeigen, "checkbox")}</div>
      <p class="hinweis">Beispiel: „nicht berechnet – erbracht im Rahmen der Anstellung (bis 28.02.2027)“.</p>`,
    knoepfe: [{ t: "Speichern", fn: async dl => { await asOrgSpeichern(asWerte(dl)); asZeige(); } }] });
}};

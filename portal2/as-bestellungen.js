/* OAK EHS-Cockpit – Bestellungen und Beauftragungen drucken (Organisation › Beauftragte, Stufe 18c, 25.11.2026).
   Daten: as_beauftragter (= portal_nachweis in V1, AS_QUELLEN) sowie Sifa/Betriebsarzt aus den Grunddaten.
   Texte je Art: AS_KAT.bestellungen (references/prozesse/app_kataloge.json). Druckoptik wie die Übertragungsschreiben
   (asPmDokument/asPmKopf aus as-pflichtenmatrix.js). Globale Namen nur mit asBs/AS_BS. */
"use strict";

const AS_BS_REIHE = ["sifa", "ba", "sibe", "ersthelfer", "brandschutzhelfer", "stapler", "kran", "anschlaeger", "befaehigt", "efk"];
function asBsKat(){ return (typeof AS_KAT !== "undefined" && AS_KAT.bestellungen) || { arten: {}, allgemein: [] }; }
function asBsArt(k){ return asBsKat().arten[k] || null; }
/* Art des Schreibens zu einem Eintrag der Beauftragten (V1 kennt Anschläger getrennt vom Kranführer) */
function asBsSchluessel(b){ if(!b) return null; if(b._art === "anschlaeger") return "anschlaeger"; return asBsArt(b.funktion) ? b.funktion : null; }
function asBsPlatzhalter(n){ return !n || /^(extern|sifa|betriebsarzt|geschäftsführung)\b/i.test(String(n).trim()); }
function asBsGf(){
  const f = typeof asPmFunktionen === "function" ? asPmFunktionen().find(x => x.art === "gf") : null;
  const n = f && typeof asPmPerson === "function" ? asPmPerson(f) : asOrgDaten().gf_name;
  return asBsPlatzhalter(n) ? "" : n;
}
function asBsDatum(d){ return d ? asDat(d) : ""; }
/* Bestellungen als Liste: Sifa und Betriebsarzt aus den Grunddaten, dann alle Beauftragten */
function asBsListe(){
  const d = asOrgDaten(), l = [];
  l.push({ k: "sifa", name: asBsPlatzhalter(d.sifa_name) ? "" : d.sifa_name, bestellt: d.sifa_bestellt_am, quelle: "grund" });
  l.push({ k: "ba", name: asBsPlatzhalter(d.ba_name) ? "" : d.ba_name, bestellt: d.ba_bestellt_am, quelle: "grund" });
  asT("as_beauftragter").forEach(b => l.push({ k: asBsSchluessel(b) || b.funktion, b, name: b.person, bereich: b.einheit_id ? asEinheitName(b.einheit_id) : "",
    schicht: b.schicht, bestellt: b.bestellt_am, schulung: b.schulung_am, gueltig: b.gueltig_bis }));
  const rang = k => { const i = AS_BS_REIHE.indexOf(k); return i < 0 ? 99 : i; };
  return l.sort((a, b) => rang(a.k) - rang(b.k) || String(a.name || "").localeCompare(String(b.name || ""), "de"));
}
function asBsTitel(k){ const a = asBsArt(k); return a ? a.rolle : ((AS_KAT.beauftragte[k] || {}).titel || k); }

/* ---------------- Druckseiten ---------------- */
function asBsSeite(k, p, entwurf){
  const a = asBsArt(k); if(!a) return "";
  p = p || {}; const mk = asPmMarke(), gf = asBsGf(), name = p.name || "";
  const leer = "____________________________";
  const bereich = [p.bereich, p.schicht ? "Schicht " + p.schicht : ""].filter(Boolean).join(" · ");
  const felder = (a.felder || []).map(([t, v], i) => { let w = v;
    if(i === 0 && p.schulung && /vom ________/.test(w)) w = w.replace("vom ________", "vom " + asDat(p.schulung));
    if(p.gueltig && /nächste bis ________/.test(w)) w = w.replace("nächste bis ________", "nächste bis " + asDat(p.gueltig));
    return `<tr><td>${esc(t)}</td><td>${esc(w)}</td></tr>`; }).join("");
  const unter = a.nach + (name ? "" : " · Vorlage") + (entwurf ? " · ENTWURF zur Freigabe" : "");
  const abschnitt = (nr, t, l) => l && l.length ? `<div class="block"><h2>${nr}. ${esc(t)}</h2><ul>${l.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  const hinweise = (a.hinweise || []).concat(asBsKat().allgemein || []);
  return `<div class="seite">${asPmKopf(a.titel, unter)}
    <table class="meta"><tr><td>Unternehmen</td><td>${esc(mk.firma)}${gf ? " · Geschäftsführung: " + esc(gf) : ""}</td></tr>
      <tr><td>${esc(a.verb)} wird</td><td>${esc(name || leer)}</td></tr>
      <tr><td>Bereich / Schicht</td><td>${esc(bereich || (name ? "gesamter Betrieb" : leer))}</td></tr>
      ${felder}
      <tr><td>gültig ab</td><td>${esc(p.bestellt ? asDat(p.bestellt) + " bis auf Widerruf" : "________ bis auf Widerruf")}</td></tr></table>
    <div class="block"><h2>1. ${esc(a.titel.split(" ")[0])}</h2><p>Hiermit wird ${name ? esc(name) : "die oben genannte Person"} mit Wirkung vom ${p.bestellt ? esc(asDat(p.bestellt)) : "oben genannten Datum"} als ${esc(a.rolle)} der ${esc(mk.firma)} ${esc(a.verb)}.</p></div>
    ${abschnitt(2, "Aufgaben", a.aufgaben)}${abschnitt(3, "Befugnisse", a.befugnisse)}${abschnitt(4, "Voraussetzungen und Qualifikation", a.voraussetzungen)}${abschnitt(5, "Hinweise", hinweise)}
    <p class="unter">Rechtsgrundlage: ${esc(a.grundlage)}</p>
    <div class="unterschrift"><div>Ort, Datum · Geschäftsführung${gf ? " (" + esc(gf) + ")" : ""}</div><div>Ort, Datum · ${esc(name || a.rolle)} – Kenntnisnahme und Annahme</div></div></div>`;
}
function asBsSchreibenHtml(liste, entwurf){
  const mk = asPmMarke();
  return asPmDokument(liste.length === 1 ? asBsArt(liste[0].k).titel : "Bestellungen und Beauftragungen", liste.map(x => asBsSeite(x.k, x.p, entwurf)).join(""), false,
    mk.firma + " · Bestellungen und Beauftragungen · Stand " + asDat(asHeute()) + (entwurf ? " · ENTWURF zur Freigabe" : ""));
}
function asBsUebersichtHtml(entwurf){
  const mk = asPmMarke(), l = asBsListe(), soll = asBeauftragteSoll(), heute = asHeute(), leer = "offen";
  const status = x => x.gueltig && x.gueltig < heute ? "abgelaufen" : x.name && x.bestellt ? "bestellt" : x.name ? "Bestellung offen" : "nicht besetzt";
  const zeilen = l.map(x => { const a = asBsArt(x.k);
    return `<tr><td>${esc(asBsTitel(x.k))}</td><td>${esc(x.name || leer)}</td><td>${esc([x.bereich, x.schicht ? "Schicht " + x.schicht : ""].filter(Boolean).join(" · ") || "Betrieb")}</td>
      <td>${esc(asBsDatum(x.bestellt) || "–")}</td><td>${esc(asBsDatum(x.schulung) || "–")}</td><td>${esc(asBsDatum(x.gueltig) || "–")}</td>
      <td>${esc(status(x))}</td><td class="rq">${esc(a ? a.nach.replace(/^nach /, "") : ((AS_KAT.beauftragte[x.k] || {}).recht || ""))}</td></tr>`; }).join("");
  const sollZ = soll.map(z => `<tr><td>${esc((AS_KAT.beauftragte[z.funktion] || {}).titel || z.funktion)}</td><td>${esc(z.einheit)}</td><td>${z.schicht || "–"}</td>
    <td>${z.n}</td><td>${z.soll}${z.richtwert ? " *" : ""}</td><td>${z.ist}</td><td>${z.ist >= z.soll ? "erfüllt" : "fehlt " + (z.soll - z.ist)}</td></tr>`).join("");
  const inhalt = `<div class="seite">${asPmKopf("Bestellungen und Beauftragungen im Arbeitsschutz", "Übersicht · Stand " + asDat(heute) + (entwurf ? " · ENTWURF zur Freigabe" : ""))}
    <table class="meta"><tr><td>Unternehmen</td><td>${esc(mk.firma)}</td></tr>${asBsGf() ? `<tr><td>Geschäftsführung</td><td>${esc(asBsGf())}</td></tr>` : ""}</table>
    <h2>1. Bestellte und beauftragte Personen</h2>
    <table><thead><tr><th>Funktion</th><th>Person</th><th>Bereich / Schicht</th><th>bestellt am</th><th>Schulung</th><th>gültig bis</th><th>Stand</th><th>Rechtsgrundlage</th></tr></thead><tbody>${zeilen}</tbody></table>
    <div class="block"><h2>2. Soll und Ist je Bereich und Schicht</h2>${sollZ ? `<table><thead><tr><th>Funktion</th><th>Bereich</th><th>Schicht</th><th>Anwesend</th><th>Soll</th><th>Ist</th><th>Stand</th></tr></thead><tbody>${sollZ}</tbody></table>
      <p class="unter">Ersthelfer: 1 bei 2 bis 20 Anwesenden, darüber 10 % (Verwaltung 5 %) – § 26 DGUV Vorschrift 1. Brandschutzhelfer: in der Regel 5 % – ASR A2.2. * Sicherheitsbeauftragte: Anzahl legt der Unternehmer fest (§ 22 SGB VII, DGUV Regel 100-001); Soll = Empfehlung.</p>`
      : `<p>Für das Soll fehlen Bereiche mit Beschäftigtenzahl und Schichten (Organisation › Struktur).</p>`}</div>
    <div class="block"><h2>3. Hinweise</h2><ul><li>Bestellungen und Beauftragungen erfolgen schriftlich mit Unterschrift der Geschäftsführung und der beauftragten Person.</li>
      <li>Ablaufende Qualifikationen (Erste Hilfe alle zwei Jahre, Unterweisungen jährlich) werden im Cockpit als Termin geführt.</li></ul></div></div>`;
  return asPmDokument("Übersicht Bestellungen und Beauftragungen", inhalt, false, mk.firma + " · Übersicht Bestellungen und Beauftragungen · Stand " + asDat(heute) + (entwurf ? " · ENTWURF zur Freigabe" : ""));
}
function asBsPerson(x){ return { name: x.name, bereich: x.bereich, schicht: x.schicht, bestellt: x.bestellt, schulung: x.schulung, gueltig: x.gueltig }; }
function asBsDruckPerson(b){ const k = asBsSchluessel(b); if(!k){ asMeldung("Für diese Funktion gibt es kein Bestellschreiben."); return; }
  const x = asBsListe().find(y => y.b && y.b.id === b.id); asPmOeffnen(asBsSchreibenHtml([{ k, p: asBsPerson(x) }])); }
function asBsDruckUebersicht(){ asPmOeffnen(asBsUebersichtHtml(false)); }
function asBsVorlagenDialog(){
  const d = asOrgDaten();
  asDialog({ titel: "Bestellschreiben", breit: true, inhalt: `<p class="hinweis">Je Art eine Vorlage ohne Namen zum Ausfüllen. Für erfasste Personen druckt der Eintrag unter „Personen“ das Schreiben mit Namen.</p>
    <div class="zeilen">${AS_BS_REIHE.map(k => { const a = asBsArt(k); if(!a) return "";
      const n = k === "sifa" ? (asBsPlatzhalter(d.sifa_name) ? "" : d.sifa_name) : k === "ba" ? (asBsPlatzhalter(d.ba_name) ? "" : d.ba_name) : "";
      return `<div class="z" data-bs="${k}"><div><b>${esc(a.titel)}</b><small>${esc(a.nach)}</small></div>${n ? `<button type="button" class="btn sek klein" data-bsn="${k}">mit Namen</button>` : asChip("Vorlage", "grau")}</div>`; }).join("")}</div>`,
    knoepfe: [{ t: "Alle Vorlagen drucken", klasse: "sek", fn: () => { asPmOeffnen(asBsSchreibenHtml(AS_BS_REIHE.filter(asBsArt).map(k => ({ k, p: {} })))); return false; } }] });
  document.querySelectorAll("#dlg [data-bs]").forEach(z => z.onclick = ev => { if(ev.target.closest("[data-bsn]")) return; asPmOeffnen(asBsSchreibenHtml([{ k: z.dataset.bs, p: {} }])); });
  document.querySelectorAll("#dlg [data-bsn]").forEach(b => b.onclick = () => { const k = b.dataset.bsn;
    asPmOeffnen(asBsSchreibenHtml([{ k, p: { name: k === "sifa" ? d.sifa_name : d.ba_name, bestellt: k === "sifa" ? d.sifa_bestellt_am : d.ba_bestellt_am } }])); });
}

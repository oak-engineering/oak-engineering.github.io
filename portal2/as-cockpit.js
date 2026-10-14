/* OAK Arbeitsschutz-App – Cockpit (P05): „Ihr Weg“ mit Stufen-Badges (as-leitfaden.js), wenige Kacheln.
   Alles wird aus den Daten berechnet; nichts wird hier gepflegt. */
"use strict";

AS_SEITEN.cockpit = { titel: "Übersicht", icon: "◉", sort: 1, render(main){
  const pfad = asPfad(), kz = asKennzahlen(), e = asEinsatz(), soll = asBeauftragteSoll();
  const offeneStufe = (pfad.find(s => s.krit.some(k => !k.ok)) || pfad[3]).nr;
  AS.cockpitStufe = AS.cockpitStufe || offeneStufe;
  const jetzt = [];
  pfad.forEach(s => s.krit.forEach(k => { if(!k.ok) jetzt.push({ ...k, stufe: s.nr }); }));
  const chk = asLetzterCheck(), voll = asLetzterCheck("voll"), faellig = !voll || asTageSeit(voll.datum) > 365;
  const rg = chk ? asCheckReifegrad(chk) : null;
  // Psyche: je Merkmalsbereich der schlechteste Wert aller Arbeitssysteme (nur aggregiert)
  const psy = {}, rang = { gruen: 1, gelb: 2, rot: 3 };
  asT("as_psyche").forEach(p => Object.entries(p.ergebnis || {}).forEach(([b, v]) => { if(!psy[b] || rang[v] > rang[psy[b]]) psy[b] = v; }));
  const helferFehlt = soll.filter(z => z.ist < z.soll).length;
  const mOffen = asT("as_massnahme").filter(m => m.status === "offen").length, mPruef = asT("as_massnahme").filter(m => m.status === "erledigt").length;
  const kachel = (ziel, farbe, zahl, lbl, info) => `<div class="kachel k-${farbe}" onclick="asGehe('${ziel}')"><div class="lbl">${lbl}</div><div class="zahl">${zahl}</div><div class="hinweis">${info || ""}</div></div>`;
  const akt = pfad.find(s => s.nr === AS.cockpitStufe);
  main.innerHTML = `<h1 class="seite">${esc(AS.org.name)}</h1><p class="unter">Stand ${asDat(asHeute())}</p>
    <div class="karte" id="lfUebersicht"><div class="leer">Ihr Weg wird ausgewertet …</div></div>
    <div class="kacheln">
      ${kachel("check", rg ? (Object.values(rg).some(s => s === 1) ? "rot" : Object.values(rg).some(s => s === 2) ? "gelb" : "gruen") : "grau",
        rg ? kz.reifegrad_mittel.toString().replace(".", ",") : "–", "Reifegrad (Mittel)", rg ? Object.entries(rg).map(([k, s]) => k + " " + (s ? "I".repeat(s) : "–")).join(" · ") : "noch kein Check")}
      ${kachel("massnahmen", kz.massnahmen_rot_offen ? "rot" : mOffen ? "gelb" : "gruen", mOffen, "Offene Maßnahmen", `${kz.massnahmen_rot_offen} zu hohen Risiken · ${kz.massnahmen_ueberfaellig} überfällig · ${mPruef} Wirksamkeit prüfen`)}
      ${kachel("organisation/beauftragte", helferFehlt || kz.beauftragte_abgelaufen ? "rot" : soll.length ? "gruen" : "grau", kz.beauftragte_erfuellt + " %", "Beauftragte Soll erfüllt", `${helferFehlt} Lücken · ${kz.beauftragte_abgelaufen} abgelaufen`)}
      ${kachel("organisation/einsatz", !e.sollSifa ? "grau" : kz.einsatz_sifa >= 100 ? "gruen" : "gelb", Math.round(e.istSifa) + " / " + Math.round(e.sollSifa) + " h", "Einsatzzeit Sifa " + e.jahr, "Betriebsarzt " + Math.round(e.istBa) + " / " + Math.round(e.sollBa) + " h")}
      ${kachel("bda", kz.bda_freigegeben === 100 ? "gruen" : "gelb", kz.bda_freigegeben + " %", "BdA freigegeben", asT("as_arbeitssystem").length + " Arbeitssysteme · Psyche " + kz.psyche_beurteilt + " %")}
      ${kachel("bda", Object.values(psy).includes("rot") ? "rot" : Object.values(psy).includes("gelb") ? "gelb" : Object.keys(psy).length ? "gruen" : "grau",
        Object.keys(psy).length ? Object.values(psy).filter(v => v !== "gruen").length : "–", "Psychische Belastung: auffällige Bereiche",
        AS_KAT.psyche_bereiche.map(b => asPunkt(psy[b] ? { gruen: "gruen", gelb: "gelb", rot: "rot" }[psy[b]] : "grau") + esc(b.split(" /")[0])).join(" "))}
      ${(() => { const p = asPfObjekte(), s = p.map(asPfStand), rot = s.filter(x => x.farbe === "rot").length, nie = s.filter(x => x.k === "nie").length;
        return kachel("pruefungen", !p.length ? "grau" : rot ? "rot" : nie || s.some(x => x.k === "bald") ? "gelb" : "gruen", p.length ? kz.pruefungen_aktuell + " %" : "–", "Prüfungen fristgerecht", p.length ? rot + " überfällig/nicht i. O. · " + nie + " ungeprüft" : "Prüfkataster noch leer"); })()}
      ${kachel("steuerung/asa", kz.asa_jahr >= 4 ? "gruen" : "gelb", kz.asa_jahr + " / 4", "ASA-Sitzungen " + new Date().getFullYear(), "")}
      ${kachel("mitzeichnung", asT("as_mitzeichnung").some(x => x.status !== "entschieden") ? "gelb" : "gruen", asT("as_mitzeichnung").filter(x => x.status !== "entschieden").length, "Offene Mitzeichnungen", "")}
      ${kachel("steuerung/ziele", "blau", asT("as_ziel").filter(z => z.status === "aktiv").length, "Aktive Ziele", asT("as_ziel").filter(z => z.status === "aktiv" && asZielStand(z).erreicht).length + " erreicht")}
      ${kachel("steuerung/meldungen", asT("as_meldung").some(m => !m.rueckmeldung) ? "gelb" : "gruen", asT("as_meldung").filter(m => !m.rueckmeldung).length, "Meldungen ohne Rückmeldung", kz.meldungen_beinahe + " Beinahe-Unfälle (12 Mon.)")}
      ${(() => { const kc = asKurzCheckLetzter(), k = asKulturListe("bradley")[0];
        if(kc){ const v = Object.values(kc.antworten.felder || {}), n = f => v.filter(x => x === f).length;
          return kachel("steuerung/kultur", n("rot") ? "rot" : n("gelb") ? "gelb" : "gruen", n("rot") + " rot · " + n("gelb") + " gelb", "Präventionskultur", "KurzCheck " + asDat(kc.datum)); }
        return kachel("steuerung/kultur", "grau", k && AS_KAT.bradley[k.stufe - 1] ? esc(AS_KAT.bradley[k.stufe - 1].split(" – ")[0]) : "–", "Sicherheitskultur", "Bradley-Kurve"); })()}
    </div>`;
  if(typeof asLfUebersicht === "function") asLfUebersicht(document.getElementById("lfUebersicht"));
}};

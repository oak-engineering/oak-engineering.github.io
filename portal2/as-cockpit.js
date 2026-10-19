/* OAK Arbeitsschutz-App – Cockpit (P05): „Ihr Weg“ mit Stufen-Badges (as-leitfaden.js), wenige Kacheln.
   Alles wird aus den Daten berechnet; nichts wird hier gepflegt. */
"use strict";

/* Spinnennetz: Reifegrad der Arbeitsschutzorganisation je Kernelement (BGHM-Reifegradinstrument, Stufe I–III)
   aus dem Organisations-Check – aktueller Check gefüllt, vorheriger gestrichelt zum Vergleich. */
function asNetzSvg(reihen){
  const ke = AS_CHECK.kernelemente, n = ke.length, cx = 210, cy = 190, R = 130, max = 3;
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / max, cy + Math.sin(a) * R * v / max]; };
  const poly = vals => vals.map((v, i) => pt(i, v || 0).map(x => x.toFixed(1)).join(",")).join(" ");
  let s = `<svg viewBox="0 0 420 380" role="img" aria-label="Reifegrad je Kernelement" style="width:100%;height:auto;max-height:380px;display:block">`;
  for(let r = 1; r <= max; r++) s += `<polygon points="${poly(ke.map(() => r))}" fill="none" stroke="#d5dde3" stroke-width="1"/>`;
  ke.forEach((k, i) => { const [x, y] = pt(i, max); s += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d5dde3" stroke-width="1"/>`;
    const [lx, ly] = pt(i, max + 0.42), anker = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
    const w = AS_KE_KURZ[k.id].split(" "), z = w.length > 2 && AS_KE_KURZ[k.id].length > 18 ? [w.slice(0, Math.ceil(w.length / 2)).join(" "), w.slice(Math.ceil(w.length / 2)).join(" ")] : [AS_KE_KURZ[k.id]];
    s += `<text x="${lx.toFixed(1)}" y="${(ly - (z.length - 1) * 7 + 4).toFixed(1)}" text-anchor="${anker}" font-size="12" fill="#1B4332" font-family="Jost,sans-serif"><title>${esc(k.titel)}</title>${z.map((t, j) => `<tspan x="${lx.toFixed(1)}" dy="${j ? 14 : 0}">${esc(t)}</tspan>`).join("")}</text>`; });
  [1, 2, 3].forEach(r => { const [x, y] = pt(0, r); s += `<text x="${(x + 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" fill="#7a8794" font-family="Jost,sans-serif">${"I".repeat(r)}</text>`; });
  reihen.forEach(r => { s += `<polygon points="${poly(r.werte)}" fill="${r.fuell}" stroke="${r.farbe}" stroke-width="2.5" ${r.strich ? 'stroke-dasharray="6 5"' : ""} stroke-linejoin="round"/>`;
    if(!r.strich) r.werte.forEach((v, i) => { if(v){ const [x, y] = pt(i, v); s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${r.farbe}"/>`; } }); });
  return s + `</svg>`;
}
function asNetzKarte(){
  const checks = asT("as_orgcheck").filter(c => c.abgeschlossen).sort((a, b) => b.datum.localeCompare(a.datum));
  const ke = AS_CHECK.kernelemente;
  if(!checks.length) return `<div class="karte"><h2>Reifegrad der Arbeitsschutzorganisation</h2><div class="leer">Noch kein Organisations-Check abgeschlossen – das Netz entsteht aus dem Check (Organisation → Organisations-Check).</div></div>`;
  const rg = c => { const r = asCheckReifegrad(c); return ke.map(k => r[k.id] || 0); };
  const akt = rg(checks[0]), vor = checks[1] ? rg(checks[1]) : null;
  const reihen = (vor ? [{ werte: vor, farbe: "#9aa7b1", fuell: "none", strich: true }] : []).concat([{ werte: akt, farbe: "#2D6A4F", fuell: "rgba(82,183,136,.25)" }]);
  const zeile = (k, i) => { const v = akt[i], d = vor ? v - vor[i] : 0;
    return `<div class="z" onclick="asGehe('check')"><div><b>${esc(AS_KE_KURZ[k.id])}</b><small>${esc(k.titel)}</small></div>
      <span>${d ? asChip((d > 0 ? "+" : "−") + Math.abs(d), d > 0 ? "gruen" : "rot") + " " : ""}${asChip(v ? "Stufe " + "I".repeat(v) : "nicht bewertet", v === 3 ? "gruen" : v === 2 ? "gelb" : v === 1 ? "rot" : "grau")}</span></div>`; };
  return `<div class="karte"><h2>Reifegrad der Arbeitsschutzorganisation <span class="hinweis">Check vom ${asDat(checks[0].datum)}${vor ? " · gestrichelt: " + asDat(checks[1].datum) : ""}</span></h2>
    <div class="netz-raster"><div>${asNetzSvg(reihen)}</div><div class="zeilen">${ke.map(zeile).join("")}</div></div>
    <p class="hinweis">BGHM-Reifegradinstrument: Stufe III = nahezu alle Anforderungen umfassend erfüllt · II = überwiegend mindestens teilweise · I = nicht oder nur punktuell.</p></div>`;
}
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
    ${asNetzKarte()}
    <div class="kacheln">
      ${kachel("check", rg ? (Object.values(rg).some(s => s === 1) ? "rot" : Object.values(rg).some(s => s === 2) ? "gelb" : "gruen") : "grau",
        rg ? kz.reifegrad_mittel.toString().replace(".", ",") : "–", "Reifegrad (Mittel)", rg ? (() => { const sw = Object.entries(rg).filter(([, s]) => s).sort((a, b) => a[1] - b[1])[0]; return sw ? "schwächstes Feld: " + AS_KE_KURZ[sw[0]] + " (Stufe " + "I".repeat(sw[1]) + ")" : ""; })() : "noch kein Check")}
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

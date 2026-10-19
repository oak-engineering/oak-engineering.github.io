/* OAK EHS-Cockpit – Notfallorganisation (Prozessmodell P25): Ersthelfer und Brandschutzhelfer je Schicht (aus der
   Organisation, DGUV V1 § 26, ASR A2.2), Flucht- und Rettungsplan / Alarmplan mit Stand (ASR A1.3, A2.3),
   Räumungsübungen mit Auswertung und Maßnahmen, Erste-Hilfe-Material und Feuerlöscher aus dem Prüfkataster.
   Ändern sich Schichten oder Bereiche, markiert die Datenbank die Pläne zur Aktualisierung (notfall_einheit_geaendert).
   Tabelle as_notfall. Globale Namen: asNf/AS_NF. */
"use strict";

const AS_NF_ART = { fluchtplan: "Flucht- und Rettungsplan", alarmplan: "Alarmplan / Notfallnummern", uebung: "Räumungsübung", erstehilfe: "Erste-Hilfe-Einrichtung", sonstiges: "Sonstiges" };
AS_ICON.notfall = '<path d="M12 3 3 20h18z"/><path d="M12 10v4"/><path d="M12 17.2v.1"/>';

function asNfListe(art){ return asT("as_notfall").filter(n => n.status !== "archiviert" && (!art || [].concat(art).includes(n.art))); }
function asNfPlanAlt(n){ return !!(n.pruefen_ab && (!n.stand_am || String(n.pruefen_ab).slice(0, 10) > String(n.stand_am).slice(0, 10))); }
function asNfLetzteUebung(){ return asNfListe("uebung").sort((a, b) => String(b.stand_am || "").localeCompare(String(a.stand_am || "")))[0]; }
function asNfUebungFaellig(){ const u = asNfLetzteUebung(); if(!u) return null;
  if(u.naechste_am) return u.naechste_am; const x = new Date(u.stand_am || asHeute()); x.setFullYear(x.getFullYear() + 1); return x.toISOString().slice(0, 10); }
function asNfPlus(tage){ const x = new Date(); x.setDate(x.getDate() + tage); return x.toISOString().slice(0, 10); }

AS_SEITEN.notfall = { titel: "Notfallorganisation", icon: "!", sort: 2.6, render(main){
  const soll = (typeof asBeauftragteSoll === "function" ? asBeauftragteSoll() : []).filter(z => z.funktion === "ersthelfer" || z.funktion === "brandschutzhelfer");
  const summe = f => soll.filter(z => z.funktion === f).reduce((a, z) => ({ soll: a.soll + z.soll, ist: a.ist + Math.min(z.ist, z.soll), luecke: a.luecke + (z.ist < z.soll ? 1 : 0) }), { soll: 0, ist: 0, luecke: 0 });
  const eh = summe("ersthelfer"), bsh = summe("brandschutzhelfer");
  const plaene = asNfListe(["fluchtplan", "alarmplan"]), alt = plaene.filter(asNfPlanAlt);
  const ue = asNfLetzteUebung(), ueF = asNfUebungFaellig(), ueRot = !ue || (ueF && ueF < asHeute());
  const pfEH = asT("as_pruefobjekt").filter(o => o.aktiv !== false && (o.art === "erstehilfe" || o.art === "feuerloescher"));
  const pfUeber = pfEH.filter(o => o.naechste_am && o.naechste_am < asHeute()).length;
  const kachel = (farbe, lbl, zahl, hinweis, ziel) => `<div class="kachel k-${farbe}" ${ziel ? `data-ziel="${ziel}"` : ""}><div class="lbl">${esc(lbl)}</div><div class="zahl">${zahl}</div><div class="hinweis">${esc(hinweis)}</div></div>`;
  main.innerHTML = `<h1 class="seite">Notfallorganisation</h1><p class="unter">Erste Hilfe, Brandschutz und Räumung so organisieren, dass sie in jeder Schicht funktionieren (§ 10 ArbSchG).</p>
    <div class="kacheln k4">
      ${kachel(eh.luecke ? "rot" : "gruen", "Ersthelfer je Schicht", eh.ist + " / " + eh.soll, eh.luecke ? eh.luecke + " Schicht(en) unterbesetzt" : "in jeder Schicht erfüllt", "organisation/beauftragte")}
      ${kachel(bsh.luecke ? "rot" : "gruen", "Brandschutzhelfer je Schicht", bsh.ist + " / " + bsh.soll, bsh.luecke ? bsh.luecke + " Schicht(en) unterbesetzt" : "in jeder Schicht erfüllt", "organisation/beauftragte")}
      ${kachel(!plaene.length || alt.length ? "gelb" : "gruen", "Pläne aktuell", (plaene.length - alt.length) + " / " + plaene.length, !plaene.length ? "noch kein Plan erfasst" : alt.length ? alt.length + " zu aktualisieren" : "Stand passt zur Organisation")}
      ${kachel(ueRot ? "rot" : "gruen", "Räumungsübung", ue ? asDat(ue.stand_am) : "–", ue ? "nächste " + asDat(ueF) : "noch keine Übung erfasst")}
    </div>
    <div class="karte"><h2>Ersthelfer und Brandschutzhelfer je Bereich und Schicht <span><button class="btn sek klein" data-ziel="organisation/beauftragte">Beauftragte</button></span></h2>
      <p class="hinweis">Soll aus den Beschäftigten je Bereich und Schicht: Ersthelfer ab 2 Anwesenden 1, ab 21 je 10 % (Verwaltung 5 %) – § 26 DGUV Vorschrift 1; Brandschutzhelfer 5 % – ASR A2.2.
        Ändern sich Beschäftigte oder Schichten unter Organisation, rechnet das Soll sich neu.</p>
      <div class="zeilen">${soll.filter(z => z.soll > 0).map(z => `<div class="z" data-ziel="organisation/beauftragte"><div><b>${esc(z.einheit)}${z.schicht ? " · Schicht " + z.schicht : ""} · ${esc((AS_KAT.beauftragte[z.funktion] || {}).titel || z.funktion)}</b>
        <small>${z.n} Beschäftigte je Schicht · Soll ${z.soll}, vorhanden ${z.ist}</small></div>${asChip(z.ist >= z.soll ? "erfüllt" : (z.soll - z.ist) + " fehlen", z.ist >= z.soll ? "gruen" : "rot")}</div>`).join("")
        || `<div class="leer">Unter Organisation die Bereiche mit Beschäftigten und Schichten anlegen – dann rechnet das Soll sich hier.</div>`}</div></div>
    <div class="karte"><h2>Flucht- und Rettungspläne, Alarmplan <span><button class="btn sek klein" id="nfBau">Bauliche Änderung melden</button><button class="btn klein" id="nfPlan">+ Plan</button></span></h2>
      <p class="hinweis">Flucht- und Rettungsplan nach ASR A2.3 Nr. 9 (Gestaltung ASR A1.3): aushängen und bei jeder baulichen oder organisatorischen Änderung aktualisieren.</p>
      <div class="zeilen">${plaene.map(n => `<div class="z" data-nf="${n.id}"><div><b>${esc(n.titel)}</b><small>${esc(AS_NF_ART[n.art])} · ${n.einheit_id ? esc(asEinheitName(n.einheit_id)) : "betriebsweit"} · Stand ${asDat(n.stand_am)}${n.notiz ? " · " + esc(n.notiz) : ""}</small></div>
        ${asNfPlanAlt(n) ? `<span title="${esc(n.pruefen_grund || "")}">${asChip("aktualisieren", "gelb")}</span>` : asChip("aktuell", "gruen")}</div>`).join("") || `<div class="leer">Noch kein Plan erfasst.</div>`}</div></div>
    <div class="karte"><h2>Räumungsübungen <span><button class="btn klein" id="nfUebung">+ Übung</button></span></h2>
      <p class="hinweis">Anhand des Flucht- und Rettungsplans in angemessenen Zeitabständen üben (ASR A2.3 Nr. 9) – üblich ist jährlich. Auffälligkeiten werden Maßnahmen.</p>
      <div class="zeilen">${asNfListe("uebung").sort((a, b) => String(b.stand_am || "").localeCompare(String(a.stand_am || ""))).map(n => `<div class="z" data-nf="${n.id}"><div><b>${asDat(n.stand_am)} · ${esc(n.titel)}</b>
        <small>${n.einheit_id ? esc(asEinheitName(n.einheit_id)) : "betriebsweit"}${n.ergebnis ? " · " + esc(n.ergebnis.slice(0, 120)) : ""}</small></div>${asChip("nächste " + asDat(n.naechste_am), n.naechste_am && n.naechste_am < asHeute() ? "rot" : "grau")}</div>`).join("")
        || `<div class="leer">Noch keine Übung erfasst.</div>`}</div></div>
    <div class="karte"><h2>Erste-Hilfe-Material und Feuerlöscher <span><button class="btn sek klein" id="nfPf">Im Prüfkataster</button></span></h2>
      <p class="hinweis">Verbandkästen (§ 25 DGUV Vorschrift 1, ASR A4.3) und Feuerlöscher (ASR A2.2) stehen mit Frist im Prüfkataster – geprüft wird dort.</p>
      <div class="zeilen">${pfEH.sort((a, b) => String(a.naechste_am || "").localeCompare(String(b.naechste_am || ""))).slice(0, 12).map(o => `<div class="z" data-ziel="pruefungen"><div><b>${esc(o.bezeichnung)}</b>
        <small>${esc(asPfArt(o.art).titel)}${o.ort ? " · " + esc(o.ort) : ""}${o.einheit_id ? " · " + esc(asEinheitName(o.einheit_id)) : ""}</small></div>${asChip(asPfStand(o).text, asPfStand(o).farbe)}</div>`).join("")
        || `<div class="leer">Noch keine Verbandkästen oder Feuerlöscher erfasst – „Im Prüfkataster“ → erfassen.</div>`}
        ${pfEH.length > 12 ? `<div class="z" data-ziel="pruefungen"><div><b>Weitere ${pfEH.length - 12}</b><small>${pfUeber} überfällig</small></div></div>` : ""}</div></div>`;
  main.querySelectorAll("[data-ziel]").forEach(e => e.onclick = () => asGehe(e.dataset.ziel));
  main.querySelector("#nfPlan").onclick = () => asNfDialog(null, "fluchtplan");
  main.querySelector("#nfUebung").onclick = () => asNfDialog(null, "uebung");
  main.querySelector("#nfPf").onclick = () => { AS.pfFilter = { art: "erstehilfe", q: "" }; asGehe("pruefungen/kataster"); };
  main.querySelector("#nfBau").onclick = () => asDialog({ titel: "Bauliche oder organisatorische Änderung", inhalt: `<div class="form">
      ${asFeld("Was hat sich geändert? (z. B. neue Halle, Wand versetzt, Notausgang verlegt)", "grund", "", "textarea", "voll")}</div>
      <p class="hinweis">Alle Flucht- und Rettungspläne und Alarmpläne werden zur Aktualisierung fällig.</p>`,
    knoepfe: [{ t: "Melden", fn: async d => { const g = asWerte(d).grund; if(!g){ asMeldung("Bitte kurz beschreiben"); return false; }
      for(const n of plaene) await asSpeichern("as_notfall", { id: n.id, pruefen_ab: new Date().toISOString(), pruefen_grund: ("Änderung: " + g).slice(0, 200) });
      asMeldung(plaene.length ? plaene.length + " Plan/Pläne zur Aktualisierung markiert" : "Noch kein Plan erfasst – bitte Plan anlegen"); asZeige(); } }] });
  main.querySelectorAll("[data-nf]").forEach(z => z.onclick = () => asNfDialog(asNach("as_notfall", z.dataset.nf)));
}};

function asNfDialog(n, art){
  const neu = !n; n = n || { art, stand_am: asHeute(), titel: art === "uebung" ? "Räumungsübung" : "" };
  const ueb = n.art === "uebung";
  const kn = [{ t: neu ? "Speichern" : "Speichern", fn: async d => { const w = asWerte(d), mn = asListe((w.maengel || "").replace(/\n/g, ",")); delete w.maengel;
    if(!w.titel){ asMeldung("Bezeichnung fehlt"); return false; }
    w.einheit_id = w.einheit_id || null;
    if(ueb && !w.naechste_am){ const x = new Date(w.stand_am || asHeute()); x.setFullYear(x.getFullYear() + 1); w.naechste_am = x.toISOString().slice(0, 10); }
    if(neu) w.erstellt_von = AS.ich;
    const r = await asSpeichern("as_notfall", Object.assign({ id: n.id }, w));
    for(const t of mn) await asSpeichern("as_massnahme", { quelle: "notfall", quelle_id: r.id, stop: "O", text: t, umsetzung: "zentral", status: "offen",
      termin: asNfPlus(28), einheit_id: w.einheit_id });
    asMeldung(mn.length ? mn.length + " Maßnahme(n) aus der Übung angelegt" : "Gespeichert"); asZeige(); } }];
  if(!neu && !ueb && asNfPlanAlt(n)) kn.unshift({ t: "Aktualisiert (Stand heute)", klasse: "sek", fn: async () => {
    await asSpeichern("as_notfall", { id: n.id, stand_am: asHeute() }); asMeldung("Plan aktualisiert"); asZeige(); } });
  if(!neu) kn.push({ t: "Archivieren", klasse: "gefahr", fn: async () => { await asSpeichern("as_notfall", { id: n.id, status: "archiviert" }); asZeige(); } });
  asDialog({ titel: neu ? (ueb ? "Räumungsübung erfassen" : "Plan erfassen") : n.titel, breit: ueb, inhalt: `${!neu && asNfPlanAlt(n) ? `<p class="hinweis">Zu aktualisieren: ${esc(n.pruefen_grund || "Änderung in der Organisation")} (${asDat(n.pruefen_ab)})</p>` : ""}<div class="form">
      ${ueb ? "" : asAuswahl("Art", "art", n.art, [["fluchtplan", AS_NF_ART.fluchtplan], ["alarmplan", AS_NF_ART.alarmplan], ["sonstiges", "Sonstiger Notfallplan"]])}
      ${asFeld(ueb ? "Bezeichnung" : "Bezeichnung (z. B. „Halle 1, EG“)", "titel", n.titel, "text", ueb ? "voll" : "")}
      ${asBereichWahl("Bereich", "einheit_id", n.einheit_id || "", "", "– betriebsweit –")}
      ${asFeld(ueb ? "Datum der Übung" : "Stand des Plans", "stand_am", n.stand_am, "date")}
      ${ueb ? asFeld("Nächste Übung (leer = in 12 Monaten)", "naechste_am", n.naechste_am, "date")
        + asFeld("Ergebnis (Räumungszeit, Sammelplatz, Auffälligkeiten)", "ergebnis", n.ergebnis, "textarea", "voll")
        + asFeld("Auffälligkeiten als Maßnahmen (je Zeile eine)", "maengel", "", "textarea", "voll") : ""}
      ${asFeld(ueb ? "Notiz" : "Aushang / Ablage (wo hängt der Plan?)", "notiz", n.notiz, "text", "voll")}</div>`, knoepfe: kn });
}

/* Aufgaben für Kalender & To-dos (as-service.js) */
function asNfAufgaben(){
  const l = []; if(!AS.kunde) return l;
  asNfListe(["fluchtplan", "alarmplan"]).filter(asNfPlanAlt).forEach(n => l.push({ schluessel: "nf-plan:" + n.id + ":" + String(n.pruefen_ab).slice(0, 10), stufe: "warnung",
    titel: "Flucht- und Rettungsplan aktualisieren: " + n.titel, sub: (n.pruefen_grund || "Änderung in der Organisation") + " – ASR A2.3 Nr. 9", frist: null,
    aktionen: [["Öffnen", () => asNfDialog(n)]] }));
  if(!asNfListe("fluchtplan").length && asT("as_einheit").length) l.push({ schluessel: "nf-kein-plan", stufe: "info", quittierbar: true,
    titel: "Flucht- und Rettungsplan im Cockpit erfassen", sub: "Stand und Aushang festhalten – dann meldet das Cockpit, wenn er nach Änderungen aktualisiert werden muss",
    frist: null, aktionen: [["Notfallorganisation", () => asGehe("notfall")]] });
  const f = asNfUebungFaellig(), t = f ? asTageSeit(f) : null;
  if(!asNfLetzteUebung() && asT("as_einheit").length) l.push({ schluessel: "nf-keine-uebung", stufe: "info", quittierbar: true, titel: "Räumungsübung planen",
    sub: "Noch keine Übung erfasst – in angemessenen Zeitabständen üben (ASR A2.3 Nr. 9)", frist: null, aktionen: [["Übung erfassen", () => { asGehe("notfall"); setTimeout(() => asNfDialog(null, "uebung"), 300); }]] });
  else if(t != null && t > -30) l.push({ schluessel: "nf-uebung:" + f, stufe: t > 0 ? "kritisch" : "warnung", quittierbar: true, titel: "Räumungsübung fällig",
    sub: "letzte Übung " + asDat(asNfLetzteUebung().stand_am) + " · fällig " + asDat(f), frist: -t,
    aktionen: [["Übung erfassen", () => { asGehe("notfall"); setTimeout(() => asNfDialog(null, "uebung"), 300); }]] });
  return l;
}

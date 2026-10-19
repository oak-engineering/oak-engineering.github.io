/* OAK Arbeitsschutz-App – Steuerung: ASA (P04), Ziele (P03), Meldungen (P13), Thema des Monats (P20),
   Sicherheitskultur (P27), Logbuch; Prozesse (Freigabe je Kunde); Jahresbericht der Sifa (P05). */
"use strict";

const AS_THEMEN_SAISON = ["Glätte und Winterdienst", "Hautschutz", "Leitern und Tritte", "Verkehrswege und Ordnung", "Lärm und Gehörschutz",
  "Hitze am Arbeitsplatz", "Sonnenschutz und Trinken", "Gefahrstoffe richtig handhaben", "Heben und Tragen", "Beleuchtung und Stolperstellen",
  "Brandschutz", "Stress und Pausen"];

AS_SEITEN.steuerung = { titel: "Steuerung", icon: "◷", sort: 7, render(main){
  const r = asReiter("steuerung", [["asa", "ASA"], ["ziele", "Ziele"], ["meldungen", "Meldungen"], ["thema", "Thema des Monats"], ["kultur", "Sicherheitskultur"], ["log", "Logbuch"]], "asa");
  main.innerHTML = `<h1 class="seite">Steuerung</h1><p class="unter">Planen, prüfen, verbessern – und die Beschäftigten beteiligen.</p>${r.html}<div id="stInhalt"></div>`;
  const box = document.getElementById("stInhalt");
  ({ asa: asAsa, ziele: asZiele, meldungen: asMeldungen, thema: asThema, kultur: asKultur, log: asLog })[r.akt](box);
}};

/* ---------- ASA ---------- */
function asAsaTagesordnung(){
  const letzte = asT("as_asa").filter(a => a.abgeschlossen).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const seit = letzte ? letzte.datum : "0000";
  const kz = asKennzahlen(), soll = asBeauftragteSoll().filter(z => z.ist < z.soll), e = asEinsatz();
  const z = [];
  z.push("1. Protokoll der letzten Sitzung" + (letzte ? " (" + asDat(letzte.datum) + ")" : ""));
  const m = asT("as_meldung").filter(x => x.datum > seit);
  z.push("2. Unfälle und Meldungen seit der letzten Sitzung: " + (m.length ? m.map(x => x.art + ": " + x.beschreibung.slice(0, 60)).join("; ") : "keine"));
  z.push("3. Maßnahmen: " + kz.massnahmen_rot_offen + " offen zu hohen Risiken, " + kz.massnahmen_ueberfaellig + " überfällig, " + kz.massnahmen_wirksam + " % wirksam");
  const rot = asT("as_arbeitssystem").filter(s => asBand(asSystemRisiko(s.id)) === "rot").map(s => s.name);
  z.push("4. BdA: " + kz.bda_freigegeben + " % freigegeben" + (rot.length ? "; hohes Risiko in: " + rot.join(", ") : ""));
  z.push("5. Beauftragte: " + (soll.length ? soll.map(x => (AS_KAT.beauftragte[x.funktion] || {}).titel + " " + x.einheit + (x.schicht ? " S" + x.schicht : "") + " fehlt " + (x.soll - x.ist)).join("; ") : "vollständig") + (kz.beauftragte_abgelaufen ? "; " + kz.beauftragte_abgelaufen + " Qualifikationen abgelaufen" : ""));
  const mz = asT("as_mitzeichnung").filter(x => x.status !== "entschieden");
  z.push("6. Offene Mitzeichnungen: " + (mz.length ? mz.map(x => x.titel).join(", ") : "keine"));
  const zi = asT("as_ziel").filter(x => x.status === "aktiv");
  /* Prozessmodell P03 → P04: erreichte oder abgelaufene Ziele seit der letzten Sitzung bewerten */
  const zb = asT("as_ziel").filter(x => x.status !== "verworfen" && (x.status === "erreicht" || asZielStand(x).erreicht || (x.termin && x.termin < asHeute() && x.termin > seit)));
  z.push("7. Ziele: " + (zi.length ? zi.map(x => x.titel + " (" + asZielStand(x).text + ")").join("; ") : "keine aktiven Ziele")
    + (zb.length ? " – zu bewerten (erreicht/Termin abgelaufen): " + zb.map(x => x.titel).join("; ") : ""));
  z.push("8. Einsatzzeiten " + e.jahr + ": Sifa " + Math.round(e.istSifa) + "/" + Math.round(e.sollSifa) + " h, Betriebsarzt " + Math.round(e.istBa) + "/" + Math.round(e.sollBa) + " h");
  if(kz.pruefungen_ueberfaellig) z.push("Prüfungen: " + kz.pruefungen_ueberfaellig + " überfällig");
  if(kz.kultur_rot) z.push("Sicherheitskultur: " + kz.kultur_rot + " rote Handlungsfelder im KurzCheck");
  /* alle übrigen Kennzahlen im roten Bereich (Prozessmodell P05 → P04) */
  const schon = ["massnahmen_rot_offen", "massnahmen_ueberfaellig", "massnahmen_wirksam", "bda_freigegeben", "beauftragte_erfuellt", "beauftragte_abgelaufen", "pruefungen_ueberfaellig", "kultur_rot", "einsatz_sifa", "einsatz_ba", "meldungen_beinahe"];
  const rotK = Object.entries(AS_KAT.kennzahlen).filter(([k, v]) => !schon.includes(k) && kz[k] != null && (v.einheit === "%" ? v.mehr_besser && kz[k] < 80 : v.einheit === "Anzahl" ? !v.mehr_besser && kz[k] > 0 : k === "asa_jahr" ? kz[k] < 4 : k === "reifegrad_mittel" ? kz[k] < 2 : false));
  if(rotK.length) z.push("Kennzahlen im roten Bereich: " + rotK.map(([k, v]) => v.titel + " " + kz[k] + (v.einheit === "%" ? " %" : "")).join("; "));
  z.push("Verschiedenes");
  return z.map((x, i) => (i + 1) + ". " + x.replace(/^\d+\.\s*/, "")).join("\n");
}
function asAsa(box){
  const liste = asT("as_asa").slice().sort((a, b) => b.datum.localeCompare(a.datum)), jahr = new Date().getFullYear();
  const n = liste.filter(a => a.abgeschlossen && String(a.datum).startsWith(String(jahr))).length;
  box.innerHTML = `<div class="karte"><h2>Arbeitsschutzausschuss ${jahr}: ${n} von mindestens 4 Sitzungen <button class="btn klein" id="asaNeu">+ Sitzung</button></h2>
    <p class="hinweis">§ 11 ASiG: mindestens vierteljährlich. Die Tagesordnung wird aus dem aktuellen Stand vorgeschlagen, Beschlüsse werden Maßnahmen.</p>
    <div class="zeilen">${liste.map(a => `<div class="z" data-a="${a.id}"><div><b>${asDat(a.datum)}</b><small>${esc(a.teilnehmer || "Teilnehmende offen")}</small></div>${a.abgeschlossen ? asChip("Protokoll", "gruen") : asChip("geplant", "grau")}</div>`).join("") || `<div class="leer">Noch keine Sitzung.</div>`}</div></div>`;
  const dlg = a => { const neu = !a; a = a || { datum: asHeute(), tagesordnung: asAsaTagesordnung() };
    const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); delete w.beschluesse; await asSpeichern("as_asa", Object.assign({ id: a.id }, w)); asZeige(); } },
      { t: "Protokoll abschließen", klasse: "sek", fn: async d => { const w = asWerte(d), b = asListe((w.beschluesse || "").replace(/\n/g, ",")); delete w.beschluesse;
        const r = await asSpeichern("as_asa", Object.assign({ id: a.id, abgeschlossen: true }, w));
        const term = (() => { const x = new Date(w.datum || asHeute()); x.setDate(x.getDate() + 28); return x.toISOString().slice(0, 10); })();
        /* Prozessmodell P04: Beschlüsse werden Maßnahmen oder – mit „Ziel:“ davor – Ziele (P03), Termin Jahresende */
        let nm = 0, nz = 0;
        for(const t of b){ const z = /^\s*ziel\s*:\s*(.+)$/i.exec(t);
          if(z){ await asSpeichern("as_ziel", { titel: z[1].trim(), kennzahl: null, quelle: "ASA " + asDat(w.datum || asHeute()), status: "entwurf",
            termin: String(w.datum || asHeute()).slice(0, 4) + "-12-31" }); nz++; }
          else { await asSpeichern("as_massnahme", { quelle: "asa", quelle_id: r.id, stop: "O", text: t, umsetzung: "zentral", status: "offen", termin: term }); nm++; } }
        asMeldung(nm || nz ? [nm ? nm + " Maßnahme(n)" : "", nz ? nz + " Ziel(e)" : ""].filter(Boolean).join(" und ") + " angelegt" : "Protokoll abgeschlossen"); asZeige(); } }];
    if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { await asLoeschen("as_asa", a.id); asZeige(); } });
    const d = asDialog({ titel: neu ? "ASA-Sitzung" : "ASA " + asDat(a.datum), breit: true, inhalt: `<div class="form">${asFeld("Datum", "datum", a.datum, "date")}
      ${asFeld("Teilnehmende (GF, Sifa, Betriebsarzt, SiBe, Betriebsrat)", "teilnehmer", a.teilnehmer)}
      <label class="voll">Tagesordnung <span><button type="button" class="btn sek klein" id="toVorschlag">aus aktuellem Stand vorschlagen</button></span><textarea data-f="tagesordnung" rows="9">${esc(a.tagesordnung || "")}</textarea></label>
      ${asFeld("Protokoll", "protokoll", a.protokoll, "textarea", "voll")}
      ${!a.abgeschlossen ? asFeld("Beschlüsse (je Zeile einer – werden beim Abschließen Maßnahmen; mit „Ziel:“ davor ein Ziel)", "beschluesse", "", "textarea", "voll") : ""}</div>`, knoepfe: kn });
    d.querySelector("#toVorschlag").onclick = () => d.querySelector('[data-f="tagesordnung"]').value = asAsaTagesordnung(); };
  document.getElementById("asaNeu").onclick = () => dlg(null);
  box.querySelectorAll("[data-a]").forEach(z => z.onclick = () => dlg(asNach("as_asa", z.dataset.a)));
}

/* ---------- Ziele ---------- */
function asZielStand(z){
  if(!z.kennzahl){ const e = z.status === "erreicht"; return { ist: null, proz: e ? 100 : 0, erreicht: e, text: e ? "erreicht" : "ohne Kennzahl – in der ASA bewerten" }; }
  const k = AS_KAT.kennzahlen[z.kennzahl] || { mehr_besser: true, einheit: "" };
  const ist = asKennzahlen()[z.kennzahl];
  const start = +z.start || 0, soll = +z.soll;
  const weg = soll - start, proz = weg ? Math.max(0, Math.min(100, Math.round((ist - start) / weg * 100))) : (ist === soll ? 100 : 0);
  const erreicht = k.mehr_besser ? ist >= soll : ist <= soll;
  return { ist, proz: erreicht ? 100 : proz, erreicht, text: ist + " " + k.einheit + " (Ziel " + soll + ")" };
}
function asZielVorschlaege(){
  const kz = asKennzahlen(), v = [];
  const add = (kennzahl, titel, soll, quelle) => { if(!v.some(x => x.kennzahl === kennzahl) && !asT("as_ziel").some(z => z.kennzahl === kennzahl && z.status !== "verworfen")) v.push({ kennzahl, titel, soll, start: kz[kennzahl], quelle }); };
  if(kz.massnahmen_rot_offen > 0) add("massnahmen_rot_offen", "Alle Maßnahmen zu hohen Risiken wirksam umgesetzt", 0, "BdA");
  if(kz.beauftragte_erfuellt < 100) add("beauftragte_erfuellt", "Ersthelfer, Brandschutzhelfer und SiBe in jeder Schicht vollständig", 100, "Beauftragte");
  if(kz.bda_freigegeben < 100) add("bda_freigegeben", "BdA für alle Arbeitssysteme freigegeben", 100, "Aufbaupfad");
  if(kz.psyche_beurteilt < 100) add("psyche_beurteilt", "Psychische Belastung in allen Arbeitssystemen beurteilt", 100, "Aufbaupfad");
  if(kz.asa_jahr < 4) add("asa_jahr", "Vier ASA-Sitzungen im Jahr", 4, "ASA");
  if(kz.massnahmen_wirksam < 80) add("massnahmen_wirksam", "80 % der Maßnahmen wirksam umgesetzt", 80, "Maßnahmen");
  if(kz.prozesse_freigegeben < 100) add("prozesse_freigegeben", "Alle Prozessbeschreibungen freigegeben", 100, "Organisations-Check K2");
  if(kz.reifegrad_mittel && kz.reifegrad_mittel < 2) add("reifegrad_mittel", "Reifegrad im Mittel mindestens Stufe II", 2, "Organisations-Check");
  if(asT("as_meldung").length && kz.rueckmeldung_quote < 80) add("rueckmeldung_quote", "80 % der Melder erhalten eine Rückmeldung", 80, "Feedback-Kultur");
  if(kz.pruefungen_ueberfaellig > 0) add("pruefungen_ueberfaellig", "Alle Prüfungen fristgerecht durchgeführt", 0, "Prüfkataster");
  if(kz.kultur_rot > 0) add("kultur_rot", "Keine roten Handlungsfelder im KurzCheck Präventionskultur", 0, "Sicherheitskultur");
  if(kz.einsatz_sifa < 100 && asEinsatz().sollSifa) add("einsatz_sifa", "Einsatzzeit der Sifa vollständig erbracht", 100, "DGUV V2");
  /* übrige Kennzahlen im roten Bereich (Prozessmodell P05 → P03) */
  Object.entries(AS_KAT.kennzahlen).forEach(([k, d]) => { if(kz[k] == null) return;
    if(d.einheit === "%" && d.mehr_besser && kz[k] < 80) add(k, d.titel + ": mindestens 80 %", k === "einsatz_ba" || k === "pruefungen_aktuell" || k === "organisation_nachweise" ? 100 : 80, "Kennzahl");
    else if(d.einheit === "Anzahl" && !d.mehr_besser && kz[k] > 0) add(k, d.titel + ": keine mehr", 0, "Kennzahl"); });
  return v;
}
function asZiele(box){
  const z = asT("as_ziel").filter(x => x.status !== "verworfen"), v = asZielVorschlaege();
  box.innerHTML = `<div class="karte"><h2>Ziele <button class="btn klein" id="zNeu">+ Ziel</button></h2>
    <p class="hinweis">SMART: konkret, messbar über eine Kennzahl aus der App, mit Verantwortlichem und Termin. Der Fortschritt rechnet sich selbst.</p>
    <div class="zeilen">${z.map(x => { const s = asZielStand(x);
      return `<div class="z" data-z="${x.id}"><div><b>${esc(x.titel)}</b><small>${esc(s.text)} · ${esc(x.verantwortlich || "Verantwortlich offen")} · bis ${asDat(x.termin)}${x.freigegeben_am ? " · freigegeben " + asDat(x.freigegeben_am) : ""}</small>
        <div class="balken" style="margin-top:6px;max-width:320px"><span style="width:${s.proz}%;background:${s.erreicht ? "var(--gruen)" : "var(--blau)"}"></span></div></div>
        ${s.erreicht ? asChip("erreicht", "gruen") : x.status === "entwurf" ? asChip("Entwurf", "grau") : asChip(s.proz + " %", "blau")}</div>`; }).join("") || `<div class="leer">Noch keine Ziele.</div>`}</div></div>
    ${v.length ? `<div class="karte"><h2>Vorschläge aus dem aktuellen Stand</h2><div class="zeilen">${v.map((x, i) => `<div class="z"><div><b>${esc(x.titel)}</b><small>heute ${x.start} · Ziel ${x.soll} · Quelle: ${esc(x.quelle)}</small></div><button class="btn sek klein" data-v="${i}">übernehmen</button></div>`).join("")}</div></div>` : ""}`;
  const dlg = x => { const neu = !x; x = x || { kennzahl: "massnahmen_wirksam", status: "entwurf" };
    const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.titel || (w.kennzahl && w.soll == null)){ asMeldung("Titel und Zielwert angeben"); return false; }
      w.kennzahl = w.kennzahl || null; if(neu || (w.kennzahl && !x.kennzahl)) w.start = w.kennzahl ? asKennzahlen()[w.kennzahl] : null;
      w.termin = w.termin || null; await asSpeichern("as_ziel", Object.assign({ id: x.id }, w)); asZeige(); } }];
    if(!neu && !x.kennzahl && x.status !== "erreicht") kn.push({ t: "Erreicht", klasse: "sek", fn: async () => { await asSpeichern("as_ziel", { id: x.id, status: "erreicht" }); asZeige(); } });
    if(!neu && !x.freigegeben_am) kn.push({ t: "Freigeben (Geschäftsführung)", klasse: "sek", fn: async () => { await asSpeichern("as_ziel", { id: x.id, freigegeben_am: asHeute(), freigegeben_von: AS.ich, status: "aktiv" }); asZeige(); } });
    if(!neu) kn.push({ t: "Verwerfen", klasse: "gefahr", fn: async () => { await asSpeichern("as_ziel", { id: x.id, status: "verworfen" }); asZeige(); } });
    asDialog({ titel: neu ? "Neues Ziel" : x.titel, inhalt: `<div class="form">${asFeld("Ziel", "titel", x.titel, "text", "voll")}
      ${asAuswahl("Messgröße (Kennzahl aus der App)", "kennzahl", x.kennzahl || "", [["", "– ohne Kennzahl (Ergebnis in der ASA bewerten) –"]].concat(Object.entries(AS_KAT.kennzahlen).map(([k, v]) => [k, v.titel + " (" + v.einheit + ")"])), "voll")}
      ${asFeld("Zielwert", "soll", x.soll, "number")}${asFeld("Bis wann", "termin", x.termin, "date")}
      ${asFeld("Verantwortlich", "verantwortlich", x.verantwortlich)}${asFeld("Quelle", "quelle", x.quelle)}</div>
      ${!neu ? `<p class="hinweis">Stand: ${esc(asZielStand(x).text)} · Ausgangswert ${x.start}</p>` : ""}`, knoepfe: kn }); };
  document.getElementById("zNeu").onclick = () => dlg(null);
  box.querySelectorAll("[data-z]").forEach(e => e.onclick = () => dlg(asNach("as_ziel", e.dataset.z)));
  box.querySelectorAll("[data-v]").forEach(b => b.onclick = async ev => { ev.stopPropagation(); const x = v[+b.dataset.v];
    await asSpeichern("as_ziel", { titel: x.titel, kennzahl: x.kennzahl, start: x.start, soll: x.soll, quelle: x.quelle, status: "entwurf" }); asZeige(); });
}

/* ---------- Meldungen ---------- */
const AS_MELDEART = { unfall: "Unfall", beinahe: "Beinahe-Unfall", zustand: "Unsicherer Zustand", vorschlag: "Verbesserungsvorschlag" };
function asMeldungen(box){
  const liste = asT("as_meldung").slice().sort((a, b) => b.datum.localeCompare(a.datum));
  box.innerHTML = `<div class="karte"><h2>Meldungen <button class="btn klein" id="meNeu">+ Meldung</button></h2>
    <p class="hinweis">Jede Meldung bekommt eine Rückmeldung an den Melder: „Das hat Ihre Meldung bewirkt“. Beinahe-Unfälle sind erwünscht – sie zeigen eine gute Meldekultur.</p>
    <div class="zeilen">${liste.map(m => `<div class="z" data-m="${m.id}"><div><b>${esc(AS_MELDEART[m.art] || m.art)} · ${asDat(m.datum)}</b><small>${esc(m.beschreibung.slice(0, 120))} · ${esc(asEinheitName(m.einheit_id))}</small></div>
      ${m.rueckmeldung ? asChip("Rückmeldung gegeben", "gruen") : asChip(m.status === "neu" ? "neu" : "in Arbeit", m.art === "unfall" ? "rot" : "gelb")}</div>`).join("") || `<div class="leer">Keine Meldungen.</div>`}</div></div>`;
  const dlg = m => { const neu = !m; m = m || { art: "beinahe", datum: asHeute(), status: "neu" };
    const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.beschreibung){ asMeldung("Beschreibung fehlt"); return false; }
      w.einheit_id = w.einheit_id || null; if(w.rueckmeldung && !m.rueckmeldung) w.rueckmeldung_am = asHeute();
      if(w.rueckmeldung) w.status = "erledigt"; await asSpeichern("as_meldung", Object.assign({ id: m.id }, w)); asZeige(); } }];
    if(!neu) kn.unshift({ t: "Maßnahme ableiten", klasse: "sek", fn: () => { asMassnahmeDialog(null, { quelle: "meldung", quelle_id: m.id }); return false; } });
    asDialog({ titel: neu ? "Neue Meldung" : AS_MELDEART[m.art], inhalt: `<div class="form">
      ${asAuswahl("Art", "art", m.art, Object.entries(AS_MELDEART))}${asFeld("Datum", "datum", m.datum, "date")}
      ${asBereichWahl("Bereich", "einheit_id", m.einheit_id || "", "voll", "– betriebsweit –")}
      ${asFeld("Was ist passiert / was fällt auf?", "beschreibung", m.beschreibung, "textarea", "voll")}
      ${!neu ? asAuswahl("Status", "status", m.status, [["neu", "neu"], ["in_arbeit", "in Arbeit"], ["erledigt", "erledigt"]]) : ""}
      ${!neu ? asFeld("Rückmeldung an den Melder", "rueckmeldung", m.rueckmeldung, "textarea", "voll") : ""}</div>
      ${m.art === "unfall" ? `<p class="hinweis">Bei mehr als 3 Tagen Arbeitsunfähigkeit: Unfallanzeige an die BG (§ 193 SGB VII).</p>` : ""}`, knoepfe: kn }); };
  document.getElementById("meNeu").onclick = () => dlg(null);
  box.querySelectorAll("[data-m]").forEach(z => z.onclick = () => { const m = asNach("as_meldung", z.dataset.m);
    // Vorfälle aus dem Kundenportal: Status und Rückmeldung pflegt OAK; der Betrieb wertet auf der Vorfall-Seite aus
    if(m && m._v1 && !AS.admin && AS_SEITEN.vorfaelle){ asGehe("vorfaelle"); return; } dlg(m); });
}

/* ---------- Thema des Monats ---------- */
function asThema(box){
  const liste = asT("as_thema").slice().sort((a, b) => b.monat.localeCompare(a.monat));
  const mon = new Date().getMonth(), rot = asT("as_gefaehrdung").filter(g => asBand(asGefRisiko(g)) === "rot").map(g => g.kurz);
  const vorschlag = [AS_THEMEN_SAISON[mon]].concat(rot.slice(0, 2)).concat(asT("as_meldung").slice(-1).map(m => "Aus einer Meldung: " + m.beschreibung.slice(0, 50)));
  box.innerHTML = `<div class="karte"><h2>Thema des Monats <button class="btn klein" id="thNeu">+ Thema</button></h2>
    <p class="hinweis">Ein kurzes Thema pro Monat – Aushang plus 5-Minuten-Kurzunterweisung durch die Führungskraft. Vorschläge: ${vorschlag.map(esc).join(" · ")}</p>
    <div class="zeilen">${liste.map(t => `<div class="z" data-t="${t.id}"><div><b>${esc(t.monat.slice(0, 7).split("-").reverse().join("/"))} · ${esc(t.titel)}</b><small>${t.teilnehmer ? t.teilnehmer + " von " + (t.beschaeftigte || "?") + " erreicht" : "Teilnahme noch nicht erfasst"}</small></div>
      ${t.teilnehmer && t.beschaeftigte ? asChip(asProz(t.teilnehmer, t.beschaeftigte) + " %", asProz(t.teilnehmer, t.beschaeftigte) >= 80 ? "gruen" : "gelb") : ""}</div>`).join("") || `<div class="leer">Noch kein Thema.</div>`}</div></div>`;
  const dlg = t => { const neu = !t; t = t || { monat: asHeute().slice(0, 8) + "01", titel: vorschlag[0], beschaeftigte: asBeschaeftigte().kopf };
    const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.titel){ asMeldung("Titel fehlt"); return false; } await asSpeichern("as_thema", Object.assign({ id: t.id }, w)); asZeige(); } }];
    if(!neu) kn.unshift({ t: "Aushang drucken", klasse: "sek", fn: () => { const w = window.open("", "_blank");
      if(w){ w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(t.titel)}</title><body style="font-family:Segoe UI,Arial;padding:40px"><p style="color:#1f4e79;font-size:20px">Thema des Monats ${esc(t.monat.slice(0, 7).split("-").reverse().join("/"))}</p><h1 style="font-size:44px;color:#1f4e79">${esc(t.titel)}</h1><div style="font-size:22px;white-space:pre-wrap">${esc(t.inhalt || "")}</div><p style="margin-top:60px;color:#666">${esc(AS.org.name)}</p></body>`); w.document.close(); w.print(); } return false; } });
    if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { await asLoeschen("as_thema", t.id); asZeige(); } });
    asDialog({ titel: neu ? "Thema des Monats" : t.titel, inhalt: `<div class="form">${asFeld("Monat", "monat", t.monat, "date")}${asFeld("Thema", "titel", t.titel)}
      ${asFeld("Kernbotschaften (kurz, je Zeile eine)", "inhalt", t.inhalt, "textarea", "voll")}
      ${asFeld("Erreichte Beschäftigte", "teilnehmer", t.teilnehmer, "number")}${asFeld("Beschäftigte gesamt", "beschaeftigte", t.beschaeftigte, "number")}</div>`, knoepfe: kn }); };
  document.getElementById("thNeu").onclick = () => dlg(null);
  box.querySelectorAll("[data-t]").forEach(z => z.onclick = () => dlg(asNach("as_thema", z.dataset.t)));
}

/* ---------- Sicherheitskultur (Bradley-Kurve) ---------- */
function asBradleySvg(stufe, vorher){
  // Kurve: Unfallrate faellt von reaktiv (1) nach teamorientiert (4)
  const x = s => 40 + (s - 1) * 150, y = s => 30 + 150 * Math.pow(Math.max(0, (4 - s) / 3), 1.6);
  let pfad = ""; for(let s = 1; s <= 4.001; s += 0.1) pfad += (pfad ? " L" : "M") + x(s).toFixed(1) + " " + y(s).toFixed(1);
  const punkt = (s, farbe, txt) => s ? `<circle cx="${x(s)}" cy="${y(s)}" r="9" fill="${farbe}"/><text x="${x(s)}" y="${y(s) - 14}" text-anchor="middle" font-size="12" fill="${farbe}">${txt}</text>` : "";
  return `<svg viewBox="0 0 560 230" style="width:100%;max-width:620px"><path d="${pfad}" fill="none" stroke="#1f4e79" stroke-width="3"/>
    ${AS_KAT.bradley.map((b, i) => `<text x="${x(i + 1)}" y="222" text-anchor="middle" font-size="11" fill="#6b7785">${esc(b.split(" – ")[0])}</text>`).join("")}
    <text x="8" y="20" font-size="11" fill="#6b7785">Unfallrate</text>${punkt(vorher, "#8a96a3", "Vorjahr")}${punkt(stufe, "#d64545", "heute")}</svg>`;
}
/* as_kultur enthaelt drei Arten: Bradley-Einstufung (antworten = {Index: Wert}, stufe),
   DGUV-KurzCheck (antworten.methode = "dguv-kurzcheck") und DGUV-StrukturCheck je Handlungsfeld ("dguv-strukturcheck"). */
const AS_AMPEL3 = { gruen: ["grün", "gruen"], gelb: ["gelb", "gelb"], rot: ["rot", "rot"] };
function asKulturArt(r){ return (r.antworten && r.antworten.methode) || "bradley"; }
function asKulturListe(art){ return asT("as_kultur").filter(r => asKulturArt(r) === art).sort((a, b) => b.datum.localeCompare(a.datum)); }
function asKurzCheckLetzter(){ return asKulturListe("dguv-kurzcheck")[0] || null; }
function asStrukturFeld(id){ return AS_KULTURCHECK.felder.find(f => f.id === id); }
function asStrukturProzent(r){ const f = asStrukturFeld(r.antworten.feld), q = f && f.gruppen.flatMap(g => g.fragen).find(x => x.typ === "prozentskala");
  const v = q ? (r.antworten.a || {})[q.id] : null; return v == null ? null : v * 10; }
function asStrukturAmpel(p){ return p == null ? ["offen", "grau"] : p <= 50 ? ["Handlungsbedarf", "rot"] : p <= 80 ? ["Diskussionsbedarf", "gelb"] : ["kein dringender Bedarf", "gruen"]; }

function asKultur(box){
  const sid = AS.reiter.kultur && AS.reiter.kultur.length > 20 ? AS.reiter.kultur : null;
  if(sid && asNach("as_kultur", sid)) return asStrukturEditor(box, asNach("as_kultur", sid));
  const kc = asKulturListe("dguv-kurzcheck"), sc = asKulturListe("dguv-strukturcheck"), letzt = kc[0];
  box.innerHTML = `<div class="karte"><h2>KurzCheck Präventionskultur (DGUV) ${AS.fachkraft ? `<button class="btn adm klein" id="kcNeu">+ KurzCheck</button>` : ""}</h2>
      <p class="hinweis">${esc(AS_KAT.kurzcheck._quelle)}</p>
      ${letzt ? `<div class="zeilen">${AS_KAT.kurzcheck.felder.map(f => { const v = (letzt.antworten.felder || {})[f.id];
        return `<div class="z"><div><b>${esc(f.titel)}</b><small>${esc(f.satz)}</small></div>${v ? asChip(AS_AMPEL3[v][0], AS_AMPEL3[v][1]) : asChip("offen", "grau")}</div>`; }).join("")}</div>
        <p class="hinweis">Stand ${asDat(letzt.datum)}${letzt.antworten.von ? " · eingeschätzt von: " + esc(letzt.antworten.von) : ""}${letzt.notiz ? " · " + esc(letzt.notiz) : ""}${kc.length > 1 ? " · frühere: " + kc.slice(1).map(x => asDat(x.datum)).join(", ") : ""}</p>`
        : `<div class="leer">Noch kein KurzCheck. Er zeigt, welches Handlungsfeld mit dem StrukturCheck vertieft werden sollte.</div>`}</div>
    <div class="karte"><h2>StrukturCheck je Handlungsfeld ${AS.fachkraft ? `<button class="btn adm klein" id="scNeu">+ StrukturCheck</button>` : ""}</h2>
      <p class="hinweis">${esc(AS_KULTURCHECK.quelle.split(" (")[0])} – Teil 1: gemeinsame Bewertung der Strukturen im Arbeitskreis (GF, Sifa, Betriebsarzt, Personal, Beschäftigtenvertretung). Ampel aus der Gesamteinschätzung: rot 0–50 %, orange 51–80 %, grün 81–100 %.</p>
      <div class="zeilen">${sc.map(r => { const f = asStrukturFeld(r.antworten.feld), p = asStrukturProzent(r), a = asStrukturAmpel(p);
        return `<div class="z" data-sc="${r.id}"><div><b>${esc(f ? f.titel : r.antworten.feld)} · ${asDat(r.datum)}</b><small>${p == null ? "Gesamteinschätzung offen" : "Gesamteinschätzung " + p + " %"}${r.notiz ? " · " + esc(r.notiz) : ""}</small></div>
          ${asChip(a[0], a[1])}</div>`; }).join("") || `<div class="leer">Noch kein StrukturCheck.</div>`}</div></div>
    <div id="kuBradley"></div>`;
  const kn = document.getElementById("kcNeu"); if(kn) kn.onclick = () => asDialog({ titel: "KurzCheck Präventionskultur", breit: true,
    inhalt: `<p class="hinweis">Je Handlungsfeld: grün = trifft zu · gelb = teilweise · rot = trifft nicht zu. Am besten mit einigen Beschäftigten gemeinsam.</p>
      ${AS_KAT.kurzcheck.felder.map(f => `<div class="frage"><div class="ft">${esc(f.titel)}: ${esc(f.satz)}</div><div class="reihe">${asAuswahl("", "kc_" + f.id, letzt ? (letzt.antworten.felder || {})[f.id] || "" : "", [["", "–"], ["gruen", "grün"], ["gelb", "gelb"], ["rot", "rot"]])}</div></div>`).join("")}
      <div class="form">${asFeld("Datum", "datum", asHeute(), "date")}${asFeld("Eingeschätzt von", "von", "", "text")}${asFeld("Notiz", "notiz", "", "text", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d), felder = {};
      AS_KAT.kurzcheck.felder.forEach(f => { if(w["kc_" + f.id]) felder[f.id] = w["kc_" + f.id]; });
      if(Object.keys(felder).length < AS_KAT.kurzcheck.felder.length){ asMeldung("Bitte alle Handlungsfelder einschätzen"); return false; }
      await asSpeichern("as_kultur", { datum: w.datum, notiz: w.notiz, stufe: null, antworten: { methode: "dguv-kurzcheck", felder, von: w.von } }); asZeige(); } }] });
  const sn = document.getElementById("scNeu"); if(sn) sn.onclick = () => {
    const rot = letzt ? AS_KAT.kurzcheck.felder.filter(f => (letzt.antworten.felder || {})[f.id] === "rot").map(f => f.id) : [];
    asDialog({ titel: "StrukturCheck starten", inhalt: `<div class="form">${asAuswahl("Handlungsfeld", "feld", rot[0] || "", AS_KULTURCHECK.felder.map(f => [f.id, f.titel + (rot.includes(f.id) ? " (KurzCheck rot)" : "")]), "voll")}
        ${asFeld("Datum", "datum", asHeute(), "date")}${asFeld("Teilnehmende (Arbeitskreis)", "notiz", "", "text", "voll")}</div>`,
      knoepfe: [{ t: "Starten", fn: async d => { const w = asWerte(d);
        const r = await asSpeichern("as_kultur", { datum: w.datum, notiz: w.notiz, stufe: null, antworten: { methode: "dguv-strukturcheck", feld: w.feld, a: {}, frei: {} } });
        AS.reiter.kultur = r.id; asZeige(); } }] }); };
  box.querySelectorAll("[data-sc]").forEach(z => z.onclick = () => { AS.reiter.kultur = z.dataset.sc; asZeige(); });
  asBradley(document.getElementById("kuBradley"));
}

let AS_SC_TIMER = null;
function asStrukturEditor(box, r){
  const f = asStrukturFeld(r.antworten.feld), A = r.antworten.a = r.antworten.a || {}, FR = r.antworten.frei = r.antworten.frei || {};
  const nur = !AS.fachkraft || r.antworten.abgeschlossen;
  const sp = () => { clearTimeout(AS_SC_TIMER); AS_SC_TIMER = setTimeout(() => asSpeichern("as_kultur", { id: r.id, antworten: r.antworten, notiz: r.notiz }).catch(e => asMeldung("Nicht gespeichert: " + e.message)), 500); };
  const seg = (key, optionen, wert) => `<span class="seg">${optionen.map((o, i) => `<button class="${wert === i ? "an" : ""}" data-k="${key}" data-w="${i}" ${nur ? "disabled" : ""}>${esc(o)}</button>`).join("")}</span>`;
  const zeichnen = () => {
    const p = asStrukturProzent(r), am = asStrukturAmpel(p);
    let ja = 0, n = 0; const zaehl = v => { if(typeof v === "number"){ n++; if(v === 0) ja++; } else if(v && typeof v === "object") Object.values(v).forEach(zaehl); };
    f.gruppen.forEach(g => { if(!g.gesamteinschaetzung) g.fragen.forEach(q => zaehl(A[q.id])); });
    let h = `<p class="nodruck"><a href="#steuerung" onclick="AS.reiter.kultur='';">← Sicherheitskultur</a></p>
      <div class="karte"><h2>StrukturCheck · ${esc(f.titel)} · ${asDat(r.datum)} ${asChip(am[0] + (p != null ? " · " + p + " %" : ""), am[1])}</h2>
      <p><b>${esc(f.leitsatz)}</b></p>${f.einleitung ? `<p class="hinweis">${esc(f.einleitung)}</p>` : ""}
      <p class="hinweis">${esc(r.notiz || "")}${n ? ` · Hilfswert: ${ja} von ${n} beantworteten Punkten mit „Ja“ bzw. erster Antwort` : ""} · Quelle: ${esc(AS_KULTURCHECK.quelle.split(";")[0])}</p></div>`;
    f.gruppen.forEach((g, gi) => {
      h += `<div class="karte"><h2>${esc(g.titel)}</h2>${g.fragen.map(q => {
        const v = A[q.id], kopf = `<div class="ft">${esc(q.id)} ${esc(q.text)}</div>${q.hinweis ? `<div class="hw">${esc(q.hinweis)}</div>` : ""}${q.erlaeuterung ? `<div class="hw">${esc(q.erlaeuterung)}</div>` : ""}${q.bedingung ? `<div class="hw">→ ${esc(q.bedingung)}</div>` : ""}`;
        let ctl = "";
        if(q.typ === "einfach" || q.typ === "prozentskala") ctl = seg(q.id, q.optionen, v);
        else if(q.typ === "liste") ctl = q.items.map((it, i) => `<div class="reihe" style="justify-content:space-between"><span>${esc(it)}</span>${seg(q.id + "|" + i, q.optionen, (v || {})[i])}</div>`).join("");
        else if(q.typ === "matrix") ctl = q.items.map((it, i) => `<div class="reihe" style="justify-content:space-between"><span>${esc(it)}</span>${(q.spalten || ["a", "b"]).map((s, j) => `<small>${esc(s)}</small>${seg(q.id + "|" + i + "|" + j, q.optionen, ((v || {})[i] || {})[j])}`).join(" ")}</div>`).join("");
        else ctl = `<textarea data-ft="${q.id}" rows="3" style="width:100%" ${nur ? "disabled" : ""}>${esc(v || "")}</textarea>`;
        return `<div class="frage">${kopf}<div style="margin-top:6px">${ctl}</div></div>`; }).join("")}
        ${g.freitext ? `<div class="frage"><div class="hw">${esc(g.freitext_hinweis || "Anmerkungen")}</div><textarea data-fg="${gi}" rows="2" style="width:100%" ${nur ? "disabled" : ""}>${esc(FR[gi] || "")}</textarea></div>` : ""}</div>`; });
    h += `<div class="karte"><h2>Ansatzpunkte (DGUV) ${!nur ? `<button class="btn klein" id="scAbschluss">Abschließen</button>` : asChip("abgeschlossen", "gruen")}</h2>
      <p class="hinweis">Maßnahmenplan nach dem KulturCheck: WAS · WER · Mit WEM · Bis WANN. Übernommene Ansatzpunkte erscheinen als Maßnahme.</p>
      <div class="zeilen">${(f.ansatzpunkte || []).map((a, i) => { const da = asT("as_massnahme").some(m => m.quelle === "kultur" && m.quelle_id === r.id && m.text === a);
        return `<div class="z"><div><b>${esc(a)}</b></div>${da ? asChip("übernommen", "gruen") : AS.fachkraft ? `<button class="btn sek klein" data-ap="${i}">als Maßnahme</button>` : ""}</div>`; }).join("")}</div></div>`;
    box.innerHTML = h;
    box.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { const [id, i, j] = b.dataset.k.split("|"), w = +b.dataset.w;
      if(i == null) A[id] = A[id] === w ? null : w;
      else if(j == null){ A[id] = A[id] || {}; A[id][i] = A[id][i] === w ? null : w; }
      else { A[id] = A[id] || {}; A[id][i] = A[id][i] || {}; A[id][i][j] = A[id][i][j] === w ? null : w; }
      sp(); zeichnen(); });
    box.querySelectorAll("[data-ft]").forEach(t => t.oninput = () => { A[t.dataset.ft] = t.value; sp(); });
    box.querySelectorAll("[data-fg]").forEach(t => t.oninput = () => { FR[t.dataset.fg] = t.value; sp(); });
    box.querySelectorAll("[data-ap]").forEach(b => b.onclick = async () => {
      await asSpeichern("as_massnahme", { quelle: "kultur", quelle_id: r.id, stop: "O", text: f.ansatzpunkte[+b.dataset.ap], umsetzung: "zentral", status: "offen" }); asMeldung("Maßnahme angelegt"); zeichnen(); });
    const ab = document.getElementById("scAbschluss"); if(ab) ab.onclick = async () => { r.antworten.abgeschlossen = true; await asSpeichern("as_kultur", { id: r.id, antworten: r.antworten }); asMeldung("StrukturCheck abgeschlossen"); zeichnen(); };
  };
  zeichnen();
}

function asBradley(box){
  const liste = asKulturListe("bradley"), akt = liste[0], vor = liste[1];
  const kz = asKennzahlen();
  box.innerHTML = `<div class="karte"><h2>Sicherheitskultur (Bradley-Kurve) ${AS.fachkraft ? `<button class="btn adm klein" id="kuNeu">+ Einstufung</button>` : ""}</h2>
    ${asBradleySvg(akt && akt.stufe, vor && vor.stufe)}
    <p>${akt ? `Einstufung ${asDat(akt.datum)}: <b>${esc(AS_KAT.bradley[Math.round(akt.stufe) - 1])}</b>` : "Noch nicht eingestuft."}</p>
    <p class="hinweis">Kennzahlen dazu: ${kz.meldungen_beinahe} Beinahe-Unfälle gemeldet (12 Monate) · Rückmeldung an Melder ${kz.rueckmeldung_quote} % · Maßnahmen wirksam ${kz.massnahmen_wirksam} %.
      Einstufung aus anonymer Kurzbefragung oder Workshop – nur zusammengefasste Werte.</p></div>`;
  const b = document.getElementById("kuNeu"); if(b) b.onclick = () => asDialog({ titel: "Sicherheitskultur einstufen", breit: true,
    inhalt: `<p class="hinweis">Je Aussage die Antwort wählen, die im Betrieb überwiegend zutrifft (Mehrheit der Befragung / Ergebnis des Workshops).</p>
      ${AS_KAT.kultur.map((q, i) => `<div class="frage"><div class="ft">${i + 1}. ${esc(q.f)}</div><div class="reihe">${asAuswahl("", "k" + i, "", [["", "–"]].concat(q.a.map((a, j) => [j + 1, (j + 1) + " – " + a])))}</div></div>`).join("")}
      <div class="form">${asFeld("Datum", "datum", asHeute(), "date")}${asFeld("Notiz (Methode, Teilnehmende)", "notiz", "", "text")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d), ant = {}; let s = 0, n = 0;
      AS_KAT.kultur.forEach((q, i) => { if(w["k" + i]){ ant[i] = +w["k" + i]; s += +w["k" + i]; n++; } delete w["k" + i]; });
      if(n < AS_KAT.kultur.length){ asMeldung("Bitte alle Aussagen beantworten"); return false; }
      await asSpeichern("as_kultur", Object.assign({ antworten: ant, stufe: Math.round(s / n) }, w)); asZeige(); } }] });
}

/* ---------- Logbuch ---------- */
async function asLog(box){
  box.innerHTML = `<div class="karte"><h2>Logbuch</h2><div class="leer">wird geladen …</div></div>`;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  // ein Logbuch: Einträge der App (as_log) und des Kundenportals (portal_logbuch: Mängel, Vorfälle, Nachweise, Dokumente …)
  const [l2, l1] = await Promise.all([apiGet("/rest/v1/as_log?select=*" + k + "&order=am.desc&limit=200").catch(() => []),
    apiGet("/rest/v1/portal_logbuch?select=*" + k + "&order=am.desc&limit=200").catch(() => [])]);
  const l = l2.concat(l1.map(x => ({ am: x.am, wer: x.wer, tabelle: x.bereich || "Kundenportal", aktion: x.aktion, objekt: [x.objekt, x.details].filter(Boolean).join(" – ") })))
    .sort((a, b) => String(b.am).localeCompare(String(a.am))).slice(0, 300);
  const T = { as_massnahme: "Maßnahme", as_arbeitssystem: "BdA", as_mitzeichnung: "Mitzeichnung", as_orgcheck: "Organisations-Check", as_asa: "ASA", as_ziel: "Ziel",
    as_meldung: "Meldung", as_beauftragter: "Beauftragte", as_einheit: "Struktur", as_organisation: "Organisation", as_psyche: "Psyche", as_thema: "Thema", as_kultur: "Kultur", as_prozess: "Prozess" };
  box.innerHTML = `<div class="karte"><h2>Logbuch <span class="hinweis">automatisch – jede Änderung mit Name und Zeit</span></h2><div class="zeilen">
    ${l.map(x => `<div class="z"><div><b>${esc(T[x.tabelle] || x.tabelle)} · ${esc(x.aktion)}</b><small>${esc(x.objekt || "")} · ${esc(x.wer || "")} · ${new Date(x.am).toLocaleString("de-DE")}</small></div></div>`).join("") || `<div class="leer">Noch keine Einträge.</div>`}</div></div>`;
}

/* ======================= Prozesse ======================= */
AS_SEITEN.prozesse = { titel: "Prozesse", icon: "☰", sort: 8, render(main){
  const frei = Object.fromEntries(asT("as_prozess").map(p => [p.prozess_id, p]));
  const ART = { fuehrung: "Führungsprozesse", kern: "Kernprozesse", unterstuetzung: "Unterstützungsprozesse" };
  const R = AS_PROZESSE.rollen;
  main.innerHTML = `<h1 class="seite">Prozesse</h1><p class="unter">${esc(AS_PROZESSE.rahmen.titel)}: ${esc(AS_PROZESSE.rahmen.zweck)} Je Prozess eine Seite – freigegeben durch die Geschäftsführung.</p>
    ${AS.fachkraft ? `<div class="karte"><h2>OAK-Vorgehen bei diesem Kunden</h2><div class="zeilen">${AS_PROZESSE.oak_vorgehen.schritte.map((s, i) => `<div class="z" data-o="${i}"><div><b>${i + 1}. ${esc(s.t)}</b><small>${esc(s.ergebnis || "")}</small></div></div>`).join("")}</div></div>` : ""}
    ${Object.entries(ART).map(([art, t]) => `<div class="karte"><h2>${t}</h2><div class="zeilen">${AS_KUNDENPROZESSE.filter(p => p.art === art).map(p =>
      `<div class="z" data-p="${p.id}"><div><b>${esc(p.titel)}</b><small>Stufe ${p.stufe} · verantwortlich: ${esc(R[p.verantwortlich] || p.verantwortlich)}</small></div>
      ${frei[p.id] && frei[p.id].freigegeben_am ? asChip("freigegeben " + asDat(frei[p.id].freigegeben_am), "gruen") : asChip("nicht freigegeben", "grau")}</div>`).join("")}</div></div>`).join("")}`;
  main.querySelectorAll("[data-p]").forEach(z => z.onclick = () => { const p = AS_KUNDENPROZESSE.find(x => x.id === z.dataset.p), f = frei[p.id];
    asDialog({ titel: p.titel, breit: true, inhalt: `<p><b>${esc(p.zweck)}</b></p>
      <p class="hinweis">Verantwortlich: ${esc(R[p.verantwortlich])} · durchführend: ${p.durchfuehrend.map(x => esc(R[x] || x)).join(", ")} · beteiligt: ${p.beteiligt.map(x => esc(R[x] || x)).join(", ")}</p>
      <p class="hinweis">Auslöser: ${p.ausloeser.map(esc).join(" · ")}</p>
      <ol>${p.ablauf.map(s => `<li style="margin:6px 0">${esc(s.t)} <span class="hinweis">– ${esc(s.wer === "—" ? "automatisch" : R[s.wer] || s.wer)}${s.da ? "" : " · noch nicht in der App"}</span></li>`).join("")}</ol>
      <p class="hinweis">Ergebnis: ${p.ergebnisse.map(esc).join(" · ")} · Kennzahl: ${esc(p.kennzahl)}<br>Rechtsgrundlage: ${esc(p.recht)}</p>`,
      knoepfe: f && f.freigegeben_am ? (AS.fachkraft ? [{ t: "Freigabe zurücknehmen", klasse: "adm", fn: async () => { await asProzessSetzen(p.id, false); asZeige(); } }] : [])
        : [{ t: "Freigeben (Geschäftsführung)", fn: async () => { await asProzessSetzen(p.id, true); asZeige(); } }] }); });
  main.querySelectorAll("[data-o]").forEach(z => z.onclick = () => { const s = AS_PROZESSE.oak_vorgehen.schritte[+z.dataset.o];
    asDialog({ titel: s.t, inhalt: `<p>${esc(s.text)}</p><h4>Voraussetzungen</h4><ul>${(s.voraussetzungen || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>Ziele – fertig, wenn</h4><ul>${(s.ziele || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` }); });
}};

/* ======================= Jahresbericht ======================= */
AS_SEITEN.bericht = { titel: "Jahresbericht", icon: "▣", sort: 9, render(main){
  const jahr = +(AS.reiter.bericht || new Date().getFullYear()), J = String(jahr);
  const d = asOrgDaten(), e = asEinsatz(jahr), kz = asKennzahlen(), r1 = x => Math.round(x * 10) / 10;
  const m = asT("as_massnahme"), imJ = x => String(x || "").startsWith(J);
  const chk = asT("as_orgcheck").filter(c => c.abgeschlossen).sort((a, b) => b.datum.localeCompare(a.datum));
  const rgJetzt = chk[0] ? asCheckReifegrad(chk[0]) : null, rgVor = chk[1] ? asCheckReifegrad(chk[1]) : null;
  const empf = (d.bericht_empfehlungen || {})[J] || "";
  const abschnitt = (t, inhalt) => `<div class="karte"><h2>${t}</h2>${inhalt}</div>`;
  const soll = asBeauftragteSoll();
  main.innerHTML = `<h1 class="seite">Jahresbericht der Fachkraft für Arbeitssicherheit ${jahr}</h1>
    <p class="unter">${esc(AS.org.name)} · erstellt ${asDat(asHeute())} von ${esc(d.sifa_name || AS.ich)} · nach DGUV Vorschrift 2</p>
    <div class="filterleiste nodruck"><select id="bJahr" aria-label="Jahr">${[0, 1, 2].map(i => new Date().getFullYear() - i).map(y => `<option value="${y}" ${y === jahr ? "selected" : ""}>Jahr: ${y}</option>`).join("")}</select>
      <button class="btn sek klein" onclick="window.print()">Drucken / PDF</button>${AS.fachkraft ? `<button class="btn adm klein" id="bErstellt">Als erstellt vermerken</button>` : ""}</div>
    ${abschnitt("1. Betreuung und Einsatzzeiten", `<p>Betreuungsgruppe ${esc(e.gruppe || "–")} · ${r1(e.ma)} Beschäftigte (gewichtet). Sifa: <b>${r1(e.istSifa)} von ${r1(e.sollSifa)} h</b> (${e.sollSifa ? asProz(e.istSifa, e.sollSifa) : 0} %).
      Betriebsarzt: <b>${r1(e.istBa)} von ${r1(e.sollBa)} h</b>.</p>
      <p class="hinweis">Einsätze: ${asT("as_einsatz").filter(x => imJ(x.datum)).map(x => asDat(x.datum) + " " + (x.taetigkeit || x.art)).join(" · ") || "keine erfasst"}</p>`)}
    ${abschnitt("2. Organisation", `<div class="zeilen">${AS_NACHWEISE.map(([k, t]) => `<div class="z"><div>${asPunkt(d[k] ? "gruen" : "rot")}${esc(t)}</div><span class="hinweis">${asDat(d[k])}</span></div>`).join("")}</div>
      <p>Beauftragte: ${soll.filter(z => z.ist >= z.soll).length} von ${soll.length} Vorgaben erfüllt · ${kz.beauftragte_abgelaufen} abgelaufene Qualifikationen.</p>`)}
    ${abschnitt("3. Beurteilung der Arbeitsbedingungen", `<div class="zeilen">${asT("as_arbeitssystem").map(s => `<div class="z"><div>${asPunkt(asBand(asSystemRisiko(s.id)))}<b>${esc(s.name)}</b>
      <small>${s.freigabe_am ? "freigegeben " + asDat(s.freigabe_am) : "nicht freigegeben"} · Psyche ${asT("as_psyche").some(p => p.arbeitssystem_id === s.id) ? "beurteilt" : "offen"} · BA ${s.ba_vorhanden ? "vorhanden" : "fehlt"}</small></div></div>`).join("") || `<div class="leer">keine</div>`}</div>`)}
    ${abschnitt("4. Maßnahmen", `<p>${m.length} Maßnahmen: ${m.filter(x => x.status === "wirksam").length} wirksam, ${m.filter(x => x.status === "erledigt").length} erledigt (Wirksamkeit offen), ${m.filter(x => x.status === "offen").length} offen, davon ${kz.massnahmen_ueberfaellig} überfällig.
      Im Jahr ${jahr} wirksam umgesetzt: ${m.filter(x => imJ(x.wirksam_am)).length}.</p><p class="hinweis">Nach STOP: ${Object.keys(AS_STOP).map(s => s + " " + m.filter(x => x.stop === s).length).join(" · ")}</p>`)}
    ${abschnitt("5. Unfälle und Meldungen", `<p>${Object.entries(AS_MELDEART).map(([k, t]) => t + ": " + asT("as_meldung").filter(x => x.art === k && imJ(x.datum)).length).join(" · ")} · Rückmeldung an Melder: ${kz.rueckmeldung_quote} %</p>`)}
    ${abschnitt("6. Arbeitsschutzausschuss und Mitzeichnungen", `<p>ASA-Sitzungen ${jahr}: ${asT("as_asa").filter(a => a.abgeschlossen && imJ(a.datum)).map(a => asDat(a.datum)).join(", ") || "keine"} (Soll mindestens 4).</p>
      <p>Mitzeichnungen ${jahr}: ${asT("as_mitzeichnung").filter(x => imJ(x.angemeldet_am)).map(x => esc(x.titel) + " (" + (x.freigabe || "offen") + ")").join(", ") || "keine"}</p>`)}
    ${abschnitt("7. Ziele", `<div class="zeilen">${asT("as_ziel").filter(z => z.status !== "verworfen").map(z => { const s = asZielStand(z); return `<div class="z"><div><b>${esc(z.titel)}</b><small>${esc(s.text)}</small></div>${s.erreicht ? asChip("erreicht", "gruen") : asChip(s.proz + " %", "blau")}</div>`; }).join("") || `<div class="leer">keine Ziele vereinbart</div>`}</div>`)}
    ${abschnitt("8. Organisation des Arbeitsschutzes (Reifegrad) und Kultur", rgJetzt ? `<div class="tabwrap"><table class="tab"><tr><th>Kernelement</th><th>${asDat(chk[0].datum)}</th>${rgVor ? `<th>${asDat(chk[1].datum)}</th>` : ""}</tr>
      ${AS_CHECK.kernelemente.map(k => `<tr><td>${k.id} ${esc(k.titel)}</td><td>${rgJetzt[k.id] ? "Stufe " + "I".repeat(rgJetzt[k.id]) : "–"}</td>${rgVor ? `<td>${rgVor[k.id] ? "Stufe " + "I".repeat(rgVor[k.id]) : "–"}</td>` : ""}</tr>`).join("")}</table></div>` : `<p>Noch kein abgeschlossener Organisations-Check.</p>`)}
    ${abschnitt("9. Empfehlungen für das Folgejahr", AS.fachkraft ? `<textarea id="bEmpf" style="width:100%;min-height:120px">${esc(empf)}</textarea><p class="nodruck"><button class="btn klein" id="bEmpfSp">Speichern</button></p>
      <div class="hinweis nodruck">Vorschläge: ${asZielVorschlaege().map(v => esc(v.titel)).join(" · ") || "–"}</div>` : `<p style="white-space:pre-wrap">${esc(empf) || "–"}</p>`)}`;
  document.getElementById("bJahr").onchange = ev => { AS.reiter.bericht = ev.target.value; asZeige(); };
  const sp = document.getElementById("bEmpfSp"); if(sp) sp.onclick = async () => { const be = Object.assign({}, d.bericht_empfehlungen || {}); be[J] = document.getElementById("bEmpf").value; await asOrgSpeichern({ bericht_empfehlungen: be }); asMeldung("Gespeichert"); };
  const er = document.getElementById("bErstellt"); if(er) er.onclick = async () => { await asOrgSpeichern({ jahresbericht_am: asHeute() }); asMeldung("Jahresbericht vermerkt"); };
}};

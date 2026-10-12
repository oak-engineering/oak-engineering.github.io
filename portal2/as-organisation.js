/* OAK Arbeitsschutz-App – Organisation (P01, P06, P21) und Organisations-Check (OAK-Vorgehen Schritt 2 / 8). */
"use strict";

const AS_NACHWEISE = [
  ["willenserklaerung_am", "Willenserklärung der Geschäftsführung", "Startpunkt nach BGHM-Gesamtkonzept"],
  ["pflichten_am", "Pflichten schriftlich übertragen", "§ 13 ArbSchG, an alle Führungskräfte"],
  ["sifa_bestellt_am", "Fachkraft für Arbeitssicherheit bestellt", "ASiG § 5", "sifa_name"],
  ["ba_bestellt_am", "Betriebsarzt bestellt", "ASiG § 2", "ba_name"],
  ["avv_am", "Auftragsverarbeitung (AVV) abgeschlossen", "Art. 28 DSGVO – vor dem Erfassen von Personendaten"],
  ["pruefkataster_am", "Prüfkataster für gefährliche Arbeitsmittel", "BetrSichV § 14"],
  ["grundunterweisung_am", "Grundunterweisung aller Beschäftigten nachgewiesen", "§ 12 ArbSchG"],
  ["gefahrstoffe_am", "Gefahrstoffverzeichnis mit aktuellen SDB geprüft", "GefStoffV § 6 – jährlich"],
  ["vorsorge_am", "Arbeitsmedizinische Vorsorge organisiert", "ArbMedVV"],
];

/* ======================= Organisation ======================= */
AS_SEITEN.organisation = { titel: "Organisation", icon: "▦", sort: 2, render(main){
  const r = asReiter("organisation", [["grund", "Grunddaten & Nachweise"], ["struktur", "Struktur"], ["organigramm", "Organigramm"],
    ["beauftragte", "Beauftragte"], ["einsatz", "Einsatzzeiten"]], "grund");
  main.innerHTML = `<h1 class="seite">Organisation</h1><p class="unter">Wer ist wofür zuständig – Grundlage für alles Weitere.</p>${r.html}<div id="orgInhalt"></div>`;
  const box = document.getElementById("orgInhalt");
  ({ grund: asOrgGrund, struktur: asOrgStruktur, organigramm: asOrgOrganigramm, beauftragte: asOrgBeauftragte, einsatz: asOrgEinsatz })[r.akt](box);
}};

function asOrgGrund(box){
  const d = asOrgDaten(), ma = asBeschaeftigte();
  box.innerHTML = `<div class="karte"><h2>Grunddaten <button class="btn sek klein" id="grundEdit">Bearbeiten</button></h2>
      <div class="zeilen">
        <div class="z"><div><b>${esc(AS.org.name)}</b><small>WZ-Kode ${esc(d.wz_kode || "–")} · Schichtmodell: ${esc(d.schichtmodell || "–")}</small></div></div>
        <div class="z"><div><b>${ma.kopf} Beschäftigte</b><small>${d.ma_vz || 0} Vollzeit · ${d.ma_tz20 || 0} Teilzeit bis 20 h · ${d.ma_tz30 || 0} Teilzeit bis 30 h → ${Math.round(ma.gewichtet * 10) / 10} gewichtet (DGUV V2)</small></div></div>
        <div class="z"><div><b>Geschäftsführung: ${esc(d.gf_name || "–")}</b><small>Fachkraft vor Ort: ${esc(d.fkv_name || "–")} · Betriebsrat: ${esc(d.br || "–")}</small></div></div>
      </div></div>
    <div class="karte"><h2>Nachweise zur Organisation</h2><div class="zeilen">${AS_NACHWEISE.map(([k, t, h, name]) => `
      <div class="z" data-n="${k}"><div><b>${asPunkt(d[k] ? "gruen" : "rot")}${esc(t)}</b><small>${esc(h)}${name && d[name] ? " · " + esc(d[name]) : ""}</small></div>
      ${d[k] ? asChip(asDat(d[k]), "gruen") : asChip("fehlt", "rot")}</div>`).join("")}</div></div>`;
  document.getElementById("grundEdit").onclick = () => asDialog({ titel: "Grunddaten", inhalt: `<div class="form">
      ${asFeld("WZ-Kode (Branche)", "wz_kode", d.wz_kode)}${asFeld("Schichtmodell", "schichtmodell", d.schichtmodell)}
      ${asFeld("Vollzeit-Beschäftigte", "ma_vz", d.ma_vz, "number")}${asFeld("Teilzeit bis 20 h", "ma_tz20", d.ma_tz20, "number")}
      ${asFeld("Teilzeit bis 30 h", "ma_tz30", d.ma_tz30, "number")}${asFeld("Geschäftsführung", "gf_name", d.gf_name)}
      ${asFeld("Fachkraft vor Ort", "fkv_name", d.fkv_name)}${asFeld("Betriebsrat (falls vorhanden)", "br", d.br)}</div>`,
    knoepfe: [{ t: "Speichern", fn: async dl => { await asOrgSpeichern(asWerte(dl)); asZeige(); } }] });
  box.querySelectorAll("[data-n]").forEach(z => z.onclick = () => {
    const [k, t, h, name] = AS_NACHWEISE.find(n => n[0] === z.dataset.n);
    asDialog({ titel: t, inhalt: `<p class="hinweis">${esc(h)}</p><div class="form">
        ${asFeld("Datum (leer = fehlt)", k, d[k], "date")}${name ? asFeld("Name", name, d[name]) : ""}</div>`,
      knoepfe: [{ t: "Speichern", fn: async dl => { await asOrgSpeichern(asWerte(dl)); asZeige(); } }] });
  });
}

function asOrgStruktur(box){
  const zweig = pid => { const k = asKinder(pid); if(!k.length) return "";
    return `<ul class="baum">${k.map(e => `<li><div data-e="${e.id}"><span><b>${esc(e.name)}</b> <span class="hinweis">${esc(e.art)}${e.kst_nr ? " · KSt " + esc(e.kst_nr) : ""}${e.leitung ? " · " + esc(e.leitung) : ""}</span></span>
      <span class="hinweis">${e.beschaeftigte ? e.beschaeftigte + " MA · " + e.schichten + " Schicht" + (e.schichten > 1 ? "en" : "") : ""}</span></div>${zweig(e.id)}</li>`).join("")}</ul>`; };
  box.innerHTML = `<div class="karte"><h2>Organisationsstruktur <button class="btn klein" id="eNeu">+ Einheit</button></h2>
    <p class="hinweis">Standort → Bereich/Abteilung → Kostenstelle. Beschäftigte und Schichten je Einheit bestimmen die nötigen Ersthelfer und Brandschutzhelfer.</p>
    ${asKinder(null).length ? zweig(null) : `<div class="leer">Noch keine Struktur. Mit „+ Einheit“ beginnen, z. B. mit dem Standort.</div>`}</div>`;
  document.getElementById("eNeu").onclick = () => asEinheitDialog(null);
  box.querySelectorAll("[data-e]").forEach(z => z.onclick = () => asEinheitDialog(asNach("as_einheit", z.dataset.e)));
}
function asEinheitDialog(e){
  const neu = !e; e = e || { art: "bereich", schichten: 1, beschaeftigte: 0 };
  const eltern = [["", "– oberste Ebene –"]].concat(asT("as_einheit").filter(x => !e.id || x.id !== e.id).map(x => [x.id, x.name]));
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.name){ asMeldung("Name fehlt"); return false; }
    w.parent_id = w.parent_id || null; w.beschaeftigte = w.beschaeftigte || 0; w.schichten = w.schichten || 1;
    await asSpeichern("as_einheit", Object.assign({ id: e.id }, w)); asZeige(); } }];
  if(!neu){
    kn.unshift({ t: "+ Untereinheit", klasse: "sek", fn: () => { asEinheitDialog({ parent_id: e.id, art: "kostenstelle", schichten: e.schichten, beschaeftigte: 0 }); return false; } });
    if(AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!confirm("Einheit mit allen Untereinheiten löschen?")) return false; await asLoeschen("as_einheit", e.id); await asLaden(); asZeige(); } });
  }
  asDialog({ titel: neu ? "Neue Einheit" : e.name, inhalt: `<div class="form">
      ${asFeld("Name", "name", e.name, "text", "voll")}
      ${asAuswahl("Art", "art", e.art, [["standort", "Standort"], ["bereich", "Bereich"], ["abteilung", "Abteilung"], ["kostenstelle", "Kostenstelle"]])}
      ${asAuswahl("Gehört zu", "parent_id", e.parent_id || "", eltern)}
      ${asFeld("Kostenstellen-Nr.", "kst_nr", e.kst_nr)}${asFeld("Leitung (verantwortliche Führungskraft)", "leitung", e.leitung)}
      ${asFeld("Beschäftigte (nur in der untersten Ebene zählen)", "beschaeftigte", e.beschaeftigte, "number")}${asFeld("Schichten", "schichten", e.schichten, "number")}
      ${asFeld("Verwaltung/Büro (Ersthelfer 5 % statt 10 %)", "verwaltung", e.verwaltung, "checkbox", "voll")}</div>`, knoepfe: kn });
}

function asOrgOrganigramm(box){
  const d = asOrgDaten(), heute = asHeute();
  const namen = f => asT("as_beauftragter").filter(b => b.funktion === f && (!b.gueltig_bis || b.gueltig_bis >= heute)).map(b => b.person);
  const knoten = e => { const k = asKinder(e.id);
    const eh = asT("as_beauftragter").filter(b => b.einheit_id === e.id && b.funktion === "ersthelfer").length;
    const bsh = asT("as_beauftragter").filter(b => b.einheit_id === e.id && b.funktion === "brandschutzhelfer").length;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:10px"><div class="box"><b>${esc(e.name)}</b>${esc(e.leitung || "Leitung offen")}
      ${(eh || bsh) ? `<div class="hinweis">EH ${eh} · BSH ${bsh}</div>` : ""}</div>
      ${k.length ? `<div class="ebene">${k.map(knoten).join("")}</div>` : ""}</div>`; };
  box.innerHTML = `<div class="karte"><h2>Organigramm Arbeitsschutz <button class="btn sek klein nodruck" onclick="window.print()">Drucken</button></h2>
    <p class="hinweis nodruck">Wird automatisch aus Struktur, Bestellungen und Beauftragten erzeugt – nie von Hand pflegen.</p>
    <div class="org">
      <div class="box"><b>Geschäftsführung</b>${esc(d.gf_name || "–")}</div>
      <div class="ebene">
        <div class="box stab"><b>Fachkraft für Arbeitssicherheit</b>${esc(d.sifa_name || "nicht bestellt")}</div>
        <div class="box stab"><b>Betriebsarzt</b>${esc(d.ba_name || "nicht bestellt")}</div>
        <div class="box stab"><b>Sicherheitsbeauftragte</b>${esc(namen("sibe").join(", ") || "keine")}</div>
        <div class="box stab"><b>Arbeitsschutzausschuss</b>${asT("as_asa").filter(a => a.abgeschlossen && String(a.datum).startsWith(String(new Date().getFullYear()))).length} Sitzungen ${new Date().getFullYear()}</div>
      </div>
      <div class="ebene">${asKinder(null).map(knoten).join("") || `<div class="leer">Struktur unter „Struktur“ anlegen.</div>`}</div>
    </div></div>`;
}

function asOrgBeauftragte(box){
  const soll = asBeauftragteSoll(), heute = asHeute();
  box.innerHTML = `<div class="karte"><h2>Soll / Ist je Bereich und Schicht</h2>
      ${soll.length ? `<div class="tabwrap"><table class="tab"><tr><th>Funktion</th><th>Bereich</th><th>Schicht</th><th>Anwesend</th><th>Soll</th><th>Ist</th><th></th></tr>
      ${soll.map(z => `<tr><td>${esc(AS_KAT.beauftragte[z.funktion].titel)}</td><td>${esc(z.einheit)}</td><td>${z.schicht || "–"}</td><td>${z.n}</td>
        <td>${z.soll}${z.richtwert ? " *" : ""}</td><td>${z.ist}</td><td>${z.ist >= z.soll ? asChip("erfüllt", "gruen") : asChip("fehlt " + (z.soll - z.ist), "rot")}</td></tr>`).join("")}</table></div>
      <p class="hinweis">Ersthelfer: 1 bei 2–20 Anwesenden, darüber 10 % (Verwaltung 5 %) – DGUV V1 § 26. Brandschutzhelfer: in der Regel 5 % – ASR A2.2. * Sicherheitsbeauftragte: Richtwert, maßgeblich ist die Unfallverhütungsvorschrift der BG.</p>`
      : `<div class="leer">Unter „Struktur“ Einheiten mit Beschäftigten und Schichten anlegen – dann rechnet die App das Soll.</div>`}</div>
    <div class="karte"><h2>Personen <button class="btn klein" id="bNeu">+ Person</button></h2><div class="zeilen">
      ${asT("as_beauftragter").sort((a, b) => a.funktion.localeCompare(b.funktion)).map(b => { const ab = b.gueltig_bis && b.gueltig_bis < heute;
        return `<div class="z" data-b="${b.id}"><div><b>${esc(b.person)}</b><small>${esc((AS_KAT.beauftragte[b.funktion] || {}).titel || b.funktion)} · ${esc(asEinheitName(b.einheit_id))}${b.schicht ? " · Schicht " + b.schicht : ""}${b.vertretung ? " · Vertretung: " + esc(b.vertretung) : ""}</small></div>
        ${ab ? asChip("abgelaufen " + asDat(b.gueltig_bis), "rot") : b.gueltig_bis ? asChip("bis " + asDat(b.gueltig_bis), "gruen") : asChip(b.bestellt_am ? "bestellt" : "ohne Datum", b.bestellt_am ? "gruen" : "grau")}</div>`; }).join("") || `<div class="leer">Noch niemand erfasst.</div>`}</div></div>`;
  document.getElementById("bNeu").onclick = () => asBeauftragterDialog(null);
  box.querySelectorAll("[data-b]").forEach(z => z.onclick = () => asBeauftragterDialog(asNach("as_beauftragter", z.dataset.b)));
}
function asBeauftragterDialog(b){
  const neu = !b; b = b || { funktion: "ersthelfer" };
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.person){ asMeldung("Name fehlt"); return false; }
    w.einheit_id = w.einheit_id || null;
    if(w.schulung_am && !w.gueltig_bis){ const m = (AS_KAT.beauftragte[w.funktion] || {}).auffrischung_monate;
      if(m){ const x = new Date(w.schulung_am); x.setMonth(x.getMonth() + m); w.gueltig_bis = x.toISOString().slice(0, 10); } }
    await asSpeichern("as_beauftragter", Object.assign({ id: b.id }, w)); asZeige(); } }];
  if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { await asLoeschen("as_beauftragter", b.id); asZeige(); } });
  asDialog({ titel: neu ? "Person erfassen" : b.person, inhalt: `<div class="form">
      ${asFeld("Name", "person", b.person, "text", "voll")}
      ${asAuswahl("Funktion", "funktion", b.funktion, Object.entries(AS_KAT.beauftragte).map(([k, v]) => [k, v.titel]))}
      ${asAuswahl("Bereich", "einheit_id", b.einheit_id || "", [["", "– Betrieb gesamt –"]].concat(asT("as_einheit").map(e => [e.id, e.name])))}
      ${asFeld("Schicht (leer = alle)", "schicht", b.schicht, "number")}${asFeld("Schriftlich bestellt am", "bestellt_am", b.bestellt_am, "date")}
      ${asFeld("Letzte Schulung", "schulung_am", b.schulung_am, "date")}${asFeld("Gültig bis (leer = aus Schulung berechnen)", "gueltig_bis", b.gueltig_bis, "date")}
      ${asFeld("Vertretung", "vertretung", b.vertretung, "text", "voll")}</div>`, knoepfe: kn });
}

function asOrgEinsatz(box){
  const e = asEinsatz(), d = asOrgDaten(), r1 = x => Math.round(x * 10) / 10;
  const balken = (ist, soll) => `<div class="balken"><span style="width:${Math.min(100, asProz(ist, soll))}%;background:${ist >= soll ? "var(--gruen)" : "var(--blau)"}"></span></div>`;
  box.innerHTML = `<div class="karte"><h2>Betreuungsumfang ${e.jahr} (DGUV Vorschrift 2, Anlage 2) <button class="btn sek klein" id="einsatzEdit">Berechnung anpassen</button></h2>
      ${e.gruppe ? `<div class="kacheln">
        <div class="kachel"><div class="lbl">Grundbetreuung gesamt</div><div class="zahl">${r1(e.grund)} h</div><div class="hinweis">${r1(e.ma)} Beschäftigte × ${AS_KAT.betreuungsgruppen[e.gruppe].stunden} h (Gruppe ${e.gruppe})</div></div>
        <div class="kachel"><div class="lbl">Sifa: Soll / Ist</div><div class="zahl">${r1(e.istSifa)} / ${r1(e.sollSifa)} h</div>${balken(e.istSifa, e.sollSifa)}<div class="hinweis">Grund ${r1(e.sifaGrund)} h + spezifisch ${r1(e.spezSifa)} h</div></div>
        <div class="kachel"><div class="lbl">Betriebsarzt: Soll / Ist</div><div class="zahl">${r1(e.istBa)} / ${r1(e.sollBa)} h</div>${balken(e.istBa, e.sollBa)}<div class="hinweis">Grund ${r1(e.baGrund)} h + spezifisch ${r1(e.spezBa)} h</div></div>
      </div><p class="hinweis">Aufteilung der Grundbetreuung: Sifa ${e.anteil} % / Betriebsarzt ${100 - e.anteil} % – je mindestens 20 % und 0,2 h je Beschäftigtem. ${d.einsatz_vereinbart_am ? "Vereinbart am " + asDat(d.einsatz_vereinbart_am) + "." : "<b>Noch nicht vereinbart.</b>"}</p>`
      : `<div class="leer">Betreuungsgruppe noch nicht gewählt – „Berechnung anpassen“.</div>`}</div>
    <div class="karte"><h2>Erfasste Einsatzzeiten <button class="btn klein" id="eNeuZeit">+ Einsatz</button></h2><div class="zeilen">
      ${asT("as_einsatz").sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 40).map(x => `<div class="z" data-x="${x.id}"><div><b>${asDat(x.datum)} · ${x.rolle === "ba" ? "Betriebsarzt" : "Sifa"} · ${x.stunden} h</b><small>${x.art === "spezifisch" ? "betriebsspezifisch" : "Grundbetreuung"}${x.taetigkeit ? " · " + esc(x.taetigkeit) : ""}</small></div></div>`).join("") || `<div class="leer">Noch keine Einsätze erfasst.</div>`}</div></div>`;
  document.getElementById("einsatzEdit").onclick = () => {
    const sp = d.spezifisch || {};
    asDialog({ titel: "Betreuungsumfang berechnen", breit: true, inhalt: `<div class="form">
        ${asAuswahl("Betreuungsgruppe (aus WZ-Kode)", "betreuungsgruppe", d.betreuungsgruppe || "", [["", "– wählen –"]].concat(Object.entries(AS_KAT.betreuungsgruppen).map(([k, v]) => [k, v.text])), "voll")}
        ${asFeld("Anteil Sifa an der Grundbetreuung in % (20–80)", "anteil_sifa", d.anteil_sifa || 50, "number")}
        ${asFeld("Umfang vereinbart am", "einsatz_vereinbart_am", d.einsatz_vereinbart_am, "date")}</div>
        <h4 style="margin:16px 0 6px">Betriebsspezifischer Teil (Anhang 4) – Stunden pro Jahr</h4>
        <div class="form">${AS_KAT.aufgabenfelder_spezifisch.map((f, i) => `<label class="voll">${esc(f)}<span style="display:flex;gap:8px">
          <input type="number" step="0.5" placeholder="Sifa h" data-sp="${i}" data-r="sifa" value="${esc((sp[i] || {}).sifa || "")}">
          <input type="number" step="0.5" placeholder="BA h" data-sp="${i}" data-r="ba" value="${esc((sp[i] || {}).ba || "")}"></span></label>`).join("")}</div>`,
      knoepfe: [{ t: "Speichern", fn: async dl => { const w = asWerte(dl); const s = {};
        dl.querySelectorAll("[data-sp]").forEach(f => { s[f.dataset.sp] = s[f.dataset.sp] || {}; s[f.dataset.sp][f.dataset.r] = +f.value || 0; });
        w.spezifisch = s; await asOrgSpeichern(w); asZeige(); } }] });
  };
  const zeitDlg = x => { const neu = !x; x = x || { datum: asHeute(), rolle: "sifa", art: "grund" };
    const kn = [{ t: "Speichern", fn: async dl => { const w = asWerte(dl); if(!w.stunden){ asMeldung("Stunden fehlen"); return false; }
      await asSpeichern("as_einsatz", Object.assign({ id: x.id }, w)); asZeige(); } }];
    if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { await asLoeschen("as_einsatz", x.id); asZeige(); } });
    asDialog({ titel: neu ? "Einsatz erfassen" : "Einsatz", inhalt: `<div class="form">${asFeld("Datum", "datum", x.datum, "date")}${asFeld("Stunden", "stunden", x.stunden, "number")}
      ${asAuswahl("Wer", "rolle", x.rolle, [["sifa", "Sifa"], ["ba", "Betriebsarzt"]])}${asAuswahl("Art", "art", x.art, [["grund", "Grundbetreuung"], ["spezifisch", "betriebsspezifisch"]])}
      ${asFeld("Tätigkeit (z. B. Begehung, ASA, Beratung)", "taetigkeit", x.taetigkeit, "text", "voll")}</div>`, knoepfe: kn }); };
  document.getElementById("eNeuZeit").onclick = () => zeitDlg(null);
  box.querySelectorAll("[data-x]").forEach(z => z.onclick = () => zeitDlg(asNach("as_einsatz", z.dataset.x)));
}

/* ======================= Organisations-Check ======================= */
AS_SEITEN.check = { titel: "Organisations-Check", icon: "✓", sort: 3, render(main){
  const offenId = AS.reiter.check && AS.reiter.check.length > 20 ? AS.reiter.check : null;
  if(offenId && asNach("as_orgcheck", offenId)) return asCheckEditor(main, asNach("as_orgcheck", offenId));
  const liste = asT("as_orgcheck").slice().sort((a, b) => b.datum.localeCompare(a.datum));
  const letzt = asLetzterCheck("voll"), faellig = !letzt || asTageSeit(letzt.datum) > 365;
  main.innerHTML = `<h1 class="seite">Organisations-Check</h1>
    <p class="unter">Bewertung der Arbeitsschutzorganisation nach den 7 Kernelementen des BGHM-Reifegradinstruments. Quellen: Gespräch/Fragebogen, Auditbericht ISO 45001, Begehung, Unterlagen.</p>
    <div class="karte"><h2>Checks ${AS.fachkraft ? `<span><button class="btn adm klein" id="ckKurz">Erstaufnahme starten</button> <button class="btn adm klein" id="ckVoll">Reifegrad-Check starten</button></span>` : ""}</h2>
      ${faellig ? `<p>${asChip("Jährlicher Reifegrad-Check fällig", "gelb")}</p>` : ""}
      <div class="zeilen">${liste.map(c => { const rg = asCheckReifegrad(c);
        return `<div class="z" data-c="${c.id}"><div><b>${c.art === "voll" ? "Reifegrad-Check (Vollfassung)" : "Erstaufnahme (Kurzfassung)"} · ${asDat(c.datum)}</b>
          <small>${Object.entries(rg).map(([k, s]) => k + " " + (s ? "I".repeat(s) : "–")).join(" · ")}</small></div>${c.abgeschlossen ? asChip("abgeschlossen", "gruen") : asChip("in Arbeit", "gelb")}</div>`; }).join("") || `<div class="leer">Noch kein Check. Bei einem neuen Kunden mit der Erstaufnahme beginnen.</div>`}</div></div>`;
  const start = async art => { const c = await asSpeichern("as_orgcheck", { art, datum: asHeute(), antworten: {}, reifegrad: {}, erstellt_von: AS.ich }); asGehe("check/" + c.id); };
  const k = document.getElementById("ckKurz"); if(k) k.onclick = () => start("kurz");
  const v = document.getElementById("ckVoll"); if(v) v.onclick = () => start("voll");
  main.querySelectorAll("[data-c]").forEach(z => z.onclick = () => asGehe("check/" + z.dataset.c));
}};

let AS_CK_TIMER = null;
function asCheckEditor(main, c){
  const kes = asCheckFragen(c.art);
  AS.ckKe = AS.ckKe && (AS.ckKe === "erg" || kes.some(k => k.id === AS.ckKe)) ? AS.ckKe : "K1";
  const nur = !AS.fachkraft || c.abgeschlossen;
  const zaehl = k => k.fragen.filter(q => asCheckGrad(c.antworten[q.id]) !== "offen").length;
  const TXT = { umfassend: ["umfassend", "gruen"], teilweise: ["teilweise", "gelb"], keine: ["keine", "rot"], offen: ["offen", "grau"], nrel: ["nicht relevant", "grau"] };
  const speichernSpaeter = () => { clearTimeout(AS_CK_TIMER); AS_CK_TIMER = setTimeout(() => asSpeichern("as_orgcheck", { id: c.id, antworten: c.antworten, reifegrad: c.reifegrad, geaendert_am: new Date().toISOString() }).catch(e => asMeldung("Nicht gespeichert: " + e.message)), 500); };
  const zeichnen = () => {
    let h = `<p class="nodruck"><a href="#check" onclick="AS.reiter.check='';">← alle Checks</a></p>
      <h1 class="seite">${c.art === "voll" ? "Reifegrad-Check" : "Erstaufnahme"} · ${asDat(c.datum)}</h1>
      <p class="unter">${esc(AS.org.name)} · Regelung = schriftlich festgelegt · gelebte Praxis = so wird es tatsächlich gemacht ${c.abgeschlossen ? "· abgeschlossen" : ""}</p>
      <div class="reiter nodruck">${kes.map(k => `<button class="${AS.ckKe === k.id ? "an" : ""}" data-ke="${k.id}">${k.id} · ${zaehl(k)}/${k.fragen.length}</button>`).join("")}
        <button class="${AS.ckKe === "erg" ? "an" : ""}" data-ke="erg">Ergebnis</button></div>`;
    if(AS.ckKe !== "erg"){
      const k = kes.find(x => x.id === AS.ckKe);
      h += `<div class="karte"><h2>${k.id} · ${esc(k.titel)}</h2><p class="hinweis">ISO 45001: ${esc(k.iso)}</p>
        ${k.fragen.map(q => { const a = c.antworten[q.id] || {}, g = asCheckGrad(a);
          const seg = (f, werte) => `<span class="seg">${werte.map((w, i) => `<button class="${a[f] === i ? "an" : ""}" data-q="${q.id}" data-feld="${f}" data-w="${i}" ${nur ? "disabled" : ""}>${w}</button>`).join("")}</span>`;
          return `<div class="frage"><div style="display:flex;justify-content:space-between;gap:10px"><div class="ft">${q.id} ${esc(q.text)}</div>${asChip(TXT[g][0], TXT[g][1])}</div>
            ${q.hinweis ? `<div class="hw">Prüfen: ${esc(q.hinweis)}</div>` : ""}
            <div class="reihe">Regelung ${seg("r", ["nein", "teilweise", "ja"])} Gelebte Praxis ${seg("p", ["punktuell", "überwiegend", "umfassend"])}
              <label><input type="checkbox" data-nr="${q.id}" ${a.nr ? "checked" : ""} ${nur ? "disabled" : ""}> nicht relevant</label></div>
            <div class="reihe" style="margin-top:6px"><select data-qq="${q.id}" ${nur ? "disabled" : ""}>${["Gespräch / Fragebogen", "Auditbericht ISO 45001", "Begehung", "Unterlagen"].map(o => `<option ${a.q === o ? "selected" : ""}>${o}</option>`).join("")}</select>
              <input style="flex:1 1 240px" placeholder="Beleg / Notiz" data-qb="${q.id}" value="${esc(a.b || "")}" ${nur ? "disabled" : ""}></div></div>`; }).join("")}</div>`;
    } else h += asCheckErgebnis(c, nur);
    main.innerHTML = h;
    main.querySelectorAll("[data-ke]").forEach(b => b.onclick = () => { AS.ckKe = b.dataset.ke; zeichnen(); });
    const a = id => (c.antworten[id] = c.antworten[id] || { q: "Gespräch / Fragebogen" });
    main.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const x = a(b.dataset.q), f = b.dataset.feld, w = +b.dataset.w; x[f] = x[f] === w ? null : w; speichernSpaeter(); zeichnen(); });
    main.querySelectorAll("[data-nr]").forEach(b => b.onchange = () => { a(b.dataset.nr).nr = b.checked; speichernSpaeter(); zeichnen(); });
    main.querySelectorAll("[data-qq]").forEach(b => b.onchange = () => { a(b.dataset.qq).q = b.value; speichernSpaeter(); });
    main.querySelectorAll("[data-qb]").forEach(b => b.oninput = () => { a(b.dataset.qb).b = b.value; speichernSpaeter(); });
    main.querySelectorAll("[data-rg]").forEach(s => s.onchange = () => { c.reifegrad[s.dataset.rg] = +s.value || null; if(!c.reifegrad[s.dataset.rg]) delete c.reifegrad[s.dataset.rg]; speichernSpaeter(); zeichnen(); });
    const ab = document.getElementById("ckAbschluss"); if(ab) ab.onclick = async () => { c.abgeschlossen = true; await asSpeichern("as_orgcheck", { id: c.id, abgeschlossen: true, antworten: c.antworten, reifegrad: c.reifegrad }); asMeldung("Check abgeschlossen"); zeichnen(); };
    const lu = document.getElementById("ckLuecken"); if(lu) lu.onclick = async () => {
      const vorh = new Set(asT("as_massnahme").filter(m => m.quelle === "orgcheck" && m.quelle_id === c.id).map(m => m.text));
      let n = 0;
      for(const l of asCheckLuecken(c)){ if(vorh.has(l.q.massnahme)) continue;
        await asSpeichern("as_massnahme", { quelle: "orgcheck", quelle_id: c.id, stop: "O", text: l.q.massnahme, umsetzung: "zentral", status: "offen" }); vorh.add(l.q.massnahme); n++; }
      asMeldung(n + " Maßnahmen angelegt"); };
  };
  zeichnen();
}
function asCheckLuecken(c){
  const L = [];
  asCheckFragen(c.art).forEach(k => k.fragen.forEach(q => { const g = asCheckGrad(c.antworten[q.id]); if(g === "keine" || g === "teilweise" || g === "offen") L.push({ q, g, k }); }));
  const rang = { keine: 0, offen: 1, teilweise: 2 };
  return L.sort((a, b) => a.q.stufe - b.q.stufe || rang[a.g] - rang[b.g]);
}
function asCheckErgebnis(c, nur){
  const rg = asCheckReifegrad(c), F = { umfassend: "var(--gruen)", teilweise: "var(--gelb)", keine: "var(--rot)", offen: "#c5ced8" };
  let h = `<div class="karte"><h2>Reifegrad je Kernelement <button class="btn sek klein nodruck" onclick="window.print()">Drucken</button></h2>`;
  asCheckFragen(c.art).forEach(k => { const g = k.fragen.map(q => asCheckGrad(c.antworten[q.id])).filter(x => x !== "nrel"), n = t => g.filter(x => x === t).length;
    h += `<div style="display:grid;grid-template-columns:minmax(200px,1.3fr) 2fr 170px;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--linie)">
      <b style="font-size:13px">${k.id} · ${esc(k.titel)}</b>
      <div class="balken">${["umfassend", "teilweise", "keine", "offen"].map(t => n(t) ? `<span style="flex:${n(t)};background:${F[t]}"></span>` : "").join("")}</div>
      <div>${rg[k.id] ? asChip("Stufe " + "I".repeat(rg[k.id]), ["", "rot", "gelb", "gruen"][rg[k.id]]) : "–"}
        <select class="nodruck" data-rg="${k.id}" ${nur ? "disabled" : ""}><option value="">auto</option>${[1, 2, 3].map(s => `<option value="${s}" ${(c.reifegrad || {})[k.id] === s ? "selected" : ""}>${"I".repeat(s)}</option>`).join("")}</select></div></div>`; });
  h += `<p class="hinweis">${esc(AS_CHECK.erfuellung.reifegrad)}</p></div>`;
  const L = asCheckLuecken(c), ST = { 1: "Stufe 1 – Fundament", 2: "Stufe 2 – System", 3: "Stufe 3 – Steuerung", 4: "Stufe 4 – Kultur" };
  h += `<div class="karte"><h2>Lücken nach Dringlichkeit ${!nur || c.abgeschlossen ? `<span class="nodruck">${AS.fachkraft ? `<button class="btn adm klein" id="ckLuecken">Lücken als Maßnahmen übernehmen</button>` : ""} ${!c.abgeschlossen && AS.fachkraft ? `<button class="btn klein" id="ckAbschluss">Abschließen</button>` : ""}</span>` : ""}</h2>`;
  [1, 2, 3, 4].forEach(s => { const l = L.filter(x => x.q.stufe === s); if(!l.length) return;
    h += `<h3 style="font-size:13px;color:var(--blau);margin:14px 0 6px">${ST[s]}</h3>` + l.map(x => `<div class="krit"><span>${asPunkt(x.g === "teilweise" ? "gelb" : x.g === "offen" ? "grau" : "rot")}</span>
      <div><b>${esc(x.q.massnahme)}</b><div class="hinweis">${x.q.id} · ${esc(x.q.text)}${(c.antworten[x.q.id] || {}).b ? " – " + esc(c.antworten[x.q.id].b) : ""}</div></div></div>`).join(""); });
  if(!L.length) h += `<div class="leer">Keine Lücken.</div>`;
  return h + `</div>`;
}

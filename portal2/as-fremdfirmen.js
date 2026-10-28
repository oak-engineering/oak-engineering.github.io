/* OAK EHS-Cockpit – Fremdfirmen (Prozessmodell P26): Auftrag an eine Fremdfirma → gegenseitige Gefährdungen abstimmen
   (§ 8 ArbSchG, § 13 BetrSichV, §§ 5, 6 DGUV Vorschrift 1; Grundlage: die Beurteilung des Bereichs bzw. der Anlage),
   Einweisung der Externen vor Arbeitsbeginn mit Nachweis, Erlaubnisschein bei gefährlichen Arbeiten.
   Tabellen as_fremdfirma, as_erlaubnisschein. Globale Namen: asFf/AS_FF. */
"use strict";

AS_ICON.fremdfirmen = '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>';
const AS_FF = { f: { status: "aktiv" } };
/* Erlaubnisschein: Art → Rechtsgrundlage + Schutzmaßnahmen zum Abhaken */
const AS_FF_SCHEIN = {
  heissarbeiten: { titel: "Heißarbeiten (Schweißen, Trennen, Löten)", recht: "DGUV Regel 100-500 Kap. 2.26 · ASR A2.2", massnahmen: [
    "Brennbare Stoffe im Umkreis entfernt oder abgedeckt", "Öffnungen, Fugen und Durchbrüche abgedichtet", "Geeigneter Feuerlöscher bereitgestellt",
    "Brandwache während der Arbeiten bestimmt", "Brandmelder im Arbeitsbereich abgeschaltet und Rückschaltung geregelt",
    "Nachkontrolle nach Abschluss (Brandwache) festgelegt"] },
  behaelter: { titel: "Arbeiten in Behältern und engen Räumen", recht: "DGUV Regel 113-004", massnahmen: [
    "Behälter entleert, gereinigt und von Zuleitungen getrennt", "Freimessung (Sauerstoff, Gefahrstoffe, Ex) durchgeführt", "Lüftung sichergestellt",
    "Sicherungsposten außerhalb bestimmt", "Rettungsausrüstung bereitgestellt", "Antriebe gegen Einschalten gesichert"] },
  hoehe: { titel: "Arbeiten mit Absturzgefahr", recht: "TRBS 2121 · DGUV Regel 112-198", massnahmen: [
    "Kollektiver Absturzschutz (Geländer, Netz) geprüft", "Hubarbeitsbühne/Gerüst geprüft und freigegeben", "PSA gegen Absturz mit Anschlagpunkt",
    "Bereich darunter abgesperrt", "Rettung aus der Höhe geregelt"] },
  elektro: { titel: "Arbeiten an elektrischen Anlagen", recht: "DGUV Vorschrift 3 · DIN VDE 0105-100", massnahmen: [
    "Freigeschaltet", "Gegen Wiedereinschalten gesichert", "Spannungsfreiheit festgestellt", "Geerdet und kurzgeschlossen",
    "Benachbarte, unter Spannung stehende Teile abgedeckt", "Elektrofachkraft als Anlagenverantwortlicher benannt"] },
  sonstiges: { titel: "Sonstige gefährliche Arbeit", recht: "§ 8 ArbSchG · § 13 BetrSichV", massnahmen: ["Gefährdungen beurteilt", "Schutzmaßnahmen festgelegt", "Bereich abgesperrt"] },
};
function asFfSchein(art){ return AS_FF_SCHEIN[art] || AS_FF_SCHEIN.sonstiges; }
function asFfScheine(fid){ return asT("as_erlaubnisschein").filter(s => s.status !== "archiviert" && (!fid || s.fremdfirma_id === fid)); }
function asFfLaeuft(f){ return f.status === "aktiv"; }
/* datetime-local zeigt Ortszeit, gespeichert wird mit Zeitzone */
function asFfLokal(v){ if(!v) return ""; const d = new Date(v); return isNaN(d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
function asFfIso(v){ if(!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString(); }
function asFfZeit(v){ return v ? asFfLokal(v).replace("T", " ") : "–"; }
/* Was fehlt noch? (gleiche Prüfung für Liste, Chips und To-dos) */
function asFfOffen(f){
  const o = [];
  if(!f.abgestimmt_am) o.push("abstimmen");
  if(!f.unterwiesen_am) o.push("einweisen");
  if(f.gefaehrlich && !asFfScheine(f.id).some(s => s.status === "freigegeben" || s.status === "abgeschlossen")) o.push("erlaubnisschein");
  return o;
}
/* Gefährdungen aus der Beurteilung von Anlage bzw. Bereich (Prozessmodell P26 → P10) */
function asFfGefaehrdungen(f){
  const sys = asT("as_arbeitssystem").filter(s => !s.stillgelegt_am && ((f.maschinen_id && asListe(s.anlagen).includes(f.maschinen_id)) || (!f.maschinen_id && f.einheit_id && s.einheit_id === f.einheit_id)));
  const ids = new Set(sys.map(s => s.id));
  return asT("as_gefaehrdung").filter(g => ids.has(g.arbeitssystem_id) && g.art !== "ressource")
    .sort((a, b) => asRisiko(b.w_v, b.s_v) - asRisiko(a.w_v, a.s_v));
}

AS_SEITEN.fremdfirmen = { titel: "Fremdfirmen", icon: "⌂", sort: 5.5, render(main){
  const alle = asT("as_fremdfirma").filter(f => f.status !== "archiviert"), aktiv = alle.filter(asFfLaeuft);
  const n = k => aktiv.filter(f => asFfOffen(f).includes(k)).length;
  const scheineOffen = asFfScheine().filter(s => s.status === "freigegeben").length;
  const liste = alle.filter(f => AS_FF.f.status === "alle" || f.status === AS_FF.f.status)
    .sort((a, b) => String(b.von || b.erstellt_am || "").localeCompare(String(a.von || a.erstellt_am || "")));
  const kachel = (farbe, lbl, zahl, hinweis) => `<div class="kachel k-${farbe}"><div class="lbl">${esc(lbl)}</div><div class="zahl">${zahl}</div><div class="hinweis">${esc(hinweis)}</div></div>`;
  const chip = f => { if(f.status !== "aktiv") return asChip(f.status === "abgeschlossen" ? "abgeschlossen" : f.status, "grau");
    const o = asFfOffen(f), erst = o.includes("erlaubnisschein") ? "erlaubnisschein" : o.includes("einweisen") ? "einweisen" : o[0];
    return o.length ? asChip({ abstimmen: "abstimmen", einweisen: "Einweisung offen", erlaubnisschein: "Erlaubnisschein fehlt" }[erst] + (o.length > 1 ? " +" + (o.length - 1) : ""), erst === "abstimmen" ? "gelb" : "rot") : asChip("bereit", "gruen"); };
  main.innerHTML = `<h1 class="seite">Fremdfirmen</h1><p class="unter">Vor Arbeitsbeginn: gegenseitige Gefährdungen abstimmen, Externe einweisen, bei gefährlichen Arbeiten Erlaubnisschein (§ 8 ArbSchG, §§ 5, 6 DGUV Vorschrift 1).</p>
    <div class="kacheln k4">
      ${kachel(aktiv.length ? "blau" : "gruen", "Laufende Aufträge", aktiv.length, alle.length - aktiv.length + " abgeschlossen")}
      ${kachel(n("einweisen") ? "rot" : "gruen", "Ohne Einweisung", n("einweisen"), "Externe vor Arbeitsbeginn einweisen")}
      ${kachel(n("abstimmen") ? "gelb" : "gruen", "Nicht abgestimmt", n("abstimmen"), "gegenseitige Gefährdungen")}
      ${kachel(n("erlaubnisschein") ? "rot" : scheineOffen ? "gelb" : "gruen", "Erlaubnisscheine", n("erlaubnisschein") ? n("erlaubnisschein") + " fehlen" : scheineOffen, n("erlaubnisschein") ? "gefährliche Arbeit ohne Schein" : "freigegeben, noch nicht abgeschlossen")}
    </div>
    <div class="karte"><h2>Aufträge <span><button class="btn klein" id="ffNeu">+ Auftrag</button></span></h2>
      <div class="filterleiste">${asFilterWahl('id="ffStatus"', AS_FF.f.status, [["aktiv", "laufend"], ["abgeschlossen", "abgeschlossen"], ["alle", "alle"]], "Status")}
        <span class="fl-zahl">${liste.length} Auftrag/Aufträge</span></div>
      <div class="zeilen">${liste.map(f => `<div class="z" data-ff="${f.id}"><div><b>${esc(f.name)}${f.taetigkeit ? " · " + esc(f.taetigkeit) : ""}</b>
        <small>${[f.von ? asDat(f.von) + (f.bis && f.bis !== f.von ? " – " + asDat(f.bis) : "") : "", f.maschinen_id ? "Anlage " + f.maschinen_id : "", f.einheit_id ? asEinheitName(f.einheit_id) : "", f.verantwortlich ? "Auftraggeber: " + f.verantwortlich : ""].filter(Boolean).map(esc).join(" · ")}</small></div>${chip(f)}</div>`).join("")
        || `<div class="leer">Keine Aufträge.</div>`}</div></div>
    <div class="karte"><h2>Erlaubnisscheine</h2>
      <div class="zeilen">${asFfScheine().filter(s => s.status !== "abgeschlossen" || asTageSeit(s.abgeschlossen_am) < 90).sort((a, b) => String(b.erstellt_am).localeCompare(String(a.erstellt_am))).map(s => {
        const f = asNach("as_fremdfirma", s.fremdfirma_id);
        return `<div class="z" data-es="${s.id}"><div><b>${esc(s.titel)}</b><small>${esc(asFfSchein(s.art).titel)}${f ? " · " + esc(f.name) : ""}${s.ort ? " · " + esc(s.ort) : ""}${s.von ? " · ab " + esc(asFfZeit(s.von)) : ""}</small></div>
          ${asChip({ entwurf: "Entwurf", freigegeben: "freigegeben", abgeschlossen: "abgeschlossen" }[s.status] || s.status, { entwurf: "grau", freigegeben: "gelb", abgeschlossen: "gruen" }[s.status] || "grau")}</div>`; }).join("")
        || `<div class="leer">Keine offenen Erlaubnisscheine. Neue entstehen am Auftrag („Erlaubnisschein“).</div>`}</div></div>`;
  main.querySelector("#ffNeu").onclick = () => asFfDialog(null);
  main.querySelector("#ffStatus").onchange = e => { AS_FF.f.status = e.target.value; AS_SEITEN.fremdfirmen.render(main); };
  main.querySelectorAll("[data-ff]").forEach(z => z.onclick = () => asFfDialog(asNach("as_fremdfirma", z.dataset.ff)));
  main.querySelectorAll("[data-es]").forEach(z => z.onclick = () => asFfScheinDialog(asNach("as_erlaubnisschein", z.dataset.es)));
}};

function asFfDialog(f){
  const neu = !f; f = f || { von: asHeute(), bis: asHeute(), verantwortlich: AS.ich, gefaehrlich: false, status: "aktiv" };
  const anl = typeof asAnlagen === "function" ? asAnlagen() : [];
  const gef = asFfGefaehrdungen(f);
  const speichern = async (d, extra) => { const w = Object.assign(asWerte(d), extra || {});
    if(!w.name){ asMeldung("Name der Fremdfirma fehlt"); return null; }
    w.einheit_id = w.einheit_id || null; w.maschinen_id = w.maschinen_id || null;
    if(w.abgestimmt === true && !f.abgestimmt_am) w.abgestimmt_am = asHeute(); if(w.abgestimmt === false) w.abgestimmt_am = null; delete w.abgestimmt;
    if(neu) w.erstellt_von = AS.ich;
    return asSpeichern("as_fremdfirma", Object.assign({ id: f.id }, w)); };
  const kn = [{ t: "Speichern", fn: async d => { if(!(await speichern(d))) return false; asZeige(); } }];
  if(!neu){
    kn.unshift({ t: "Einweisung …", klasse: "sek", fn: async d => { const r = await speichern(d); if(!r) return false; asFfEinweisung(r); return false; } });
    kn.unshift({ t: "Erlaubnisschein", klasse: "sek", fn: async d => { const r = await speichern(d); if(!r) return false; asFfScheinDialog(null, r); return false; } });
    if(f.status === "aktiv") kn.push({ t: "Abschließen", klasse: "sek", fn: async () => {
      if(asFfScheine(f.id).some(s => s.status === "freigegeben")){ asMeldung("Erst die freigegebenen Erlaubnisscheine abschließen"); return false; }
      await asSpeichern("as_fremdfirma", { id: f.id, status: "abgeschlossen" }); asZeige(); } });
    kn.push({ t: "Archivieren", klasse: "gefahr", fn: async () => { await asSpeichern("as_fremdfirma", { id: f.id, status: "archiviert" }); asZeige(); } });
  }
  const d = asDialog({ titel: neu ? "Auftrag an eine Fremdfirma" : f.name, breit: true, inhalt: `<div class="form">
      ${asFeld("Fremdfirma", "name", f.name)}${asFeld("Ansprechpartner (vor Ort)", "ansprechpartner", f.ansprechpartner)}
      ${asFeld("Was wird gemacht?", "taetigkeit", f.taetigkeit, "text", "voll")}
      ${asBereichWahl("Bereich", "einheit_id", f.einheit_id || "", "", "– betriebsweit –")}
      ${asAuswahl("Anlage", "maschinen_id", f.maschinen_id || "", [["", "– keine bestimmte Anlage –"]].concat(anl.map(a => [a.maschinen_id, (a.maschine || a.titel || "") + " (" + a.maschinen_id + ")"])))}
      ${asFeld("Von", "von", f.von, "date")}${asFeld("Bis", "bis", f.bis, "date")}
      ${asFeld("Auftraggeber im Betrieb", "verantwortlich", f.verantwortlich)}${asFeld("Koordinator (§ 6 DGUV V1, bei gegenseitiger Gefährdung)", "koordinator", f.koordinator)}
      ${asFeld("Gefährliche Arbeit – Erlaubnisschein nötig (Heißarbeiten, Behälter, Absturz, Elektro)", "gefaehrlich", f.gefaehrlich, "checkbox", "voll")}
      ${asFeld("Gegenseitige Gefährdungen und vereinbarte Maßnahmen", "gefaehrdungen", f.gefaehrdungen, "textarea", "voll")}
      ${asFeld("Mit der Fremdfirma abgestimmt" + (f.abgestimmt_am ? " (am " + asDat(f.abgestimmt_am) + ")" : ""), "abgestimmt", !!f.abgestimmt_am, "checkbox", "voll")}</div>
      ${gef.length ? `<div style="margin-top:10px"><b>Aus der Beurteilung dieses Bereichs bzw. dieser Anlage</b> <button type="button" class="btn sek klein" id="ffGefUeb">in die Abstimmung übernehmen</button>
        <div class="zeilen">${gef.slice(0, 8).map(g => `<div class="z"><div><b>${asPunkt(asBand(asRisiko(g.w_v, g.s_v)))}${esc(g.kurz || "")}</b><small>${esc((g.schutzmassnahmen || []).map(m => m.text || m).slice(0, 3).join(" · "))}</small></div></div>`).join("")}</div></div>`
        : `<p class="hinweis">Anlage oder Bereich wählen und speichern – dann erscheinen hier die Gefährdungen aus der Beurteilung als Grundlage der Abstimmung.</p>`}
      ${!neu ? `<p class="hinweis">Einweisung: ${f.unterwiesen_am ? asDat(f.unterwiesen_am) + (f.unterwiesen_durch ? " durch " + esc(f.unterwiesen_durch) : "") + (f.unterwiesen_personen ? " · " + esc(f.unterwiesen_personen) : "") : "noch offen"}
        · Erlaubnisscheine: ${asFfScheine(f.id).length || "keine"}</p>` : ""}`, knoepfe: kn });
  const b = d.querySelector("#ffGefUeb");
  if(b) b.onclick = () => { const t = d.querySelector('[data-f="gefaehrdungen"]');
    t.value = (t.value ? t.value + "\n" : "") + gef.slice(0, 8).map(g => "- " + (g.kurz || "") + ((g.schutzmassnahmen || []).length ? ": " + (g.schutzmassnahmen || []).map(m => m.text || m).slice(0, 3).join(", ") : "")).join("\n"); };
}

/* Einweisung der Externen: Nachweis + Druckblatt zum Unterschreiben (Prozessmodell P26 → P20) */
function asFfEinweisung(f){
  asDialog({ titel: "Einweisung: " + f.name, inhalt: `<div class="form">
      ${asFeld("Eingewiesen am", "unterwiesen_am", f.unterwiesen_am || asHeute(), "date")}${asFeld("Eingewiesen durch", "unterwiesen_durch", f.unterwiesen_durch || AS.ich)}
      ${asFeld("Eingewiesene Personen (Namen, mit Komma)", "unterwiesen_personen", f.unterwiesen_personen, "textarea", "voll")}</div>
      <p class="hinweis">Inhalt: Gefährdungen und Maßnahmen aus der Abstimmung, Verhalten im Notfall, Ansprechpartner. „Drucken“ erzeugt das Blatt zum Unterschreiben.</p>`,
    knoepfe: [{ t: "Drucken", klasse: "sek", fn: d => { asFfDruck(Object.assign({}, f, asWerte(d))); return false; } },
      { t: "Einweisung speichern", fn: async d => { const w = asWerte(d); if(!w.unterwiesen_personen){ asMeldung("Bitte die eingewiesenen Personen eintragen"); return false; }
        await asSpeichern("as_fremdfirma", Object.assign({ id: f.id }, w)); asMeldung("Einweisung vermerkt"); asZeige(); } }] });
}
function asFfDruck(f){
  const nf = typeof asNfListe === "function" ? asNfListe("alarmplan")[0] : null;
  const pers = asListe(f.unterwiesen_personen || "");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Einweisung ${esc(f.name)}</title><style>
    body{font-family:Jost,Arial,sans-serif;color:#1B4332;margin:24px;font-size:13px} h1{font-family:'Cormorant Garamond',Georgia,serif;color:#2D6A4F;font-size:24px;margin:0 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:10px} td,th{border:1px solid #b7c9bf;padding:6px;text-align:left;vertical-align:top} th{background:#D8F3DC}
    .k{color:#555;font-size:12px} pre{white-space:pre-wrap;font-family:inherit;margin:0}</style></head><body>
    <h1>Einweisung Fremdfirma</h1><div class="k">${esc(AS.org ? AS.org.name : "")} · § 8 ArbSchG · §§ 5, 6 DGUV Vorschrift 1</div>
    <table><tr><th style="width:28%">Fremdfirma</th><td>${esc(f.name)}${f.ansprechpartner ? " · " + esc(f.ansprechpartner) : ""}</td></tr>
      <tr><th>Tätigkeit</th><td>${esc(f.taetigkeit || "")}</td></tr>
      <tr><th>Ort / Zeitraum</th><td>${esc([f.maschinen_id ? "Anlage " + f.maschinen_id : "", f.einheit_id ? asEinheitName(f.einheit_id) : ""].filter(Boolean).join(" · "))} · ${asDat(f.von)}${f.bis ? " – " + asDat(f.bis) : ""}</td></tr>
      <tr><th>Auftraggeber / Koordinator</th><td>${esc(f.verantwortlich || "")}${f.koordinator ? " · Koordinator: " + esc(f.koordinator) : ""}</td></tr>
      <tr><th>Gefährdungen und Maßnahmen</th><td><pre>${esc(f.gefaehrdungen || "")}</pre></td></tr>
      <tr><th>Im Notfall</th><td>${nf ? esc(nf.titel) + (nf.notiz ? " · " + esc(nf.notiz) : "") : "Notruf 112 · Ersthelfer und Sammelplatz laut Aushang"}</td></tr>
      <tr><th>Erlaubnisschein</th><td>${f.gefaehrlich ? "erforderlich – Arbeiten erst nach Freigabe des Erlaubnisscheins" : "nicht erforderlich"}</td></tr></table>
    <p>Eingewiesen am ${asDat(f.unterwiesen_am)} durch ${esc(f.unterwiesen_durch || "")}.</p>
    <table><tr><th>Name</th><th style="width:40%">Unterschrift</th></tr>${(pers.length ? pers : ["", "", "", ""]).map(p => `<tr><td style="height:26px">${esc(p)}</td><td></td></tr>`).join("")}</table>
    <script>window.print()<\/script></body></html>`;
  const w = window.open("", "_blank"); if(w){ w.document.write(html); w.document.close(); } else asMeldung("Bitte Pop-ups erlauben");
}

function asFfScheinDialog(s, f){
  const neu = !s; s = s || { art: "heissarbeiten", fremdfirma_id: f && f.id, titel: "", ort: f && f.maschinen_id ? "Anlage " + f.maschinen_id : "", einheit_id: f && f.einheit_id,
    ausfuehrende: f ? f.unterwiesen_personen || "" : "", massnahmen: [], status: "entwurf" };
  const art = asFfSchein(s.art), hak = new Set((s.massnahmen || []).filter(m => m.ok).map(m => m.t));
  const werte = d => { const w = asWerte(d); const a = asFfSchein(w.art || s.art);
    w.massnahmen = a.massnahmen.map(t => ({ t, ok: !!d.querySelector(`[data-esm="${CSS.escape(t)}"]:checked`) }));
    w.einheit_id = w.einheit_id || null; w.titel = w.titel || a.titel; w.von = asFfIso(w.von); w.bis = asFfIso(w.bis); w.brandwache_bis = asFfIso(w.brandwache_bis);
    return w; };
  const kn = [];
  if(s.status === "entwurf"){
    kn.push({ t: "Speichern", klasse: "sek", fn: async d => { await asSpeichern("as_erlaubnisschein", Object.assign({ id: s.id, fremdfirma_id: s.fremdfirma_id || null }, werte(d))); asZeige(); } });
    if(AS.fachkraft || AS.gf) kn.push({ t: "Freigeben", fn: async d => { const w = werte(d);
      if(w.massnahmen.some(m => !m.ok)){ asMeldung("Erst alle Schutzmaßnahmen abhaken"); return false; }
      if(!w.von || !w.bis){ asMeldung("Gültigkeit von/bis angeben"); return false; }
      await asSpeichern("as_erlaubnisschein", Object.assign({ id: s.id, fremdfirma_id: s.fremdfirma_id || null, status: "freigegeben", ausgestellt_von: AS.ich, ausgestellt_am: new Date().toISOString() }, w));
      asMeldung("Erlaubnisschein freigegeben"); asZeige(); } });
  }
  if(s.status === "freigegeben") kn.push({ t: "Arbeiten beendet", fn: async d => { const w = asWerte(d);
    if(s.art === "heissarbeiten" && !w.brandwache_bis && !s.brandwache_bis){ asMeldung("Bei Heißarbeiten die Brandwache bis … eintragen"); return false; }
    await asSpeichern("as_erlaubnisschein", { id: s.id, status: "abgeschlossen", abgeschlossen_am: new Date().toISOString(), abgeschlossen_von: AS.ich, brandwache_bis: asFfIso(w.brandwache_bis) || s.brandwache_bis || null });
    asMeldung("Erlaubnisschein abgeschlossen"); asZeige(); } });
  if(!neu) kn.unshift({ t: "Drucken", klasse: "sek", fn: () => { asFfScheinDruck(s); return false; } });
  const nurLesen = s.status !== "entwurf", dt = asFfLokal;
  const d = asDialog({ titel: neu ? "Erlaubnisschein" : s.titel, breit: true, inhalt: `<div class="form">
      ${asAuswahl("Art der Arbeit", "art", s.art, Object.entries(AS_FF_SCHEIN).map(([k, v]) => [k, v.titel]))}${asFeld("Bezeichnung", "titel", s.titel)}
      ${asFeld("Ort", "ort", s.ort)}${asBereichWahl("Bereich", "einheit_id", s.einheit_id || "", "", "– betriebsweit –")}
      ${asFeld("Gültig von", "von", dt(s.von), "datetime-local")}${asFeld("Gültig bis", "bis", dt(s.bis), "datetime-local")}
      ${asFeld("Ausführende Personen", "ausfuehrende", s.ausfuehrende, "text", "voll")}
      ${s.art === "heissarbeiten" || neu ? asFeld("Brandwache / Nachkontrolle bis", "brandwache_bis", dt(s.brandwache_bis), "datetime-local") : ""}</div>
      <div style="margin-top:10px"><b>Schutzmaßnahmen</b> <span class="hinweis" id="esRecht">${esc(art.recht)}</span><div class="hakenliste" id="esListe">${art.massnahmen.map(t =>
        `<label><input type="checkbox" data-esm="${esc(t)}" ${hak.has(t) ? "checked" : ""} ${nurLesen ? "disabled" : ""}> ${esc(t)}</label>`).join("")}</div></div>
      ${s.status === "entwurf" && !(AS.fachkraft || AS.gf) ? `<p class="hinweis">Freigeben dürfen Fachkraft oder Geschäftsführung – Schein speichern und vorlegen.</p>` : ""}
      ${s.ausgestellt_am ? `<p class="hinweis">Freigegeben ${asDat(s.ausgestellt_am)} von ${esc(s.ausgestellt_von || "")}${s.abgeschlossen_am ? " · abgeschlossen " + asDat(s.abgeschlossen_am) + " von " + esc(s.abgeschlossen_von || "") : ""}</p>` : ""}`, knoepfe: kn });
  const sel = d.querySelector('[data-f="art"]');
  if(sel && !nurLesen) sel.onchange = () => { const a = asFfSchein(sel.value);
    d.querySelector("#esRecht").textContent = a.recht;
    d.querySelector("#esListe").innerHTML = a.massnahmen.map(t => `<label><input type="checkbox" data-esm="${esc(t)}"> ${esc(t)}</label>`).join(""); };
  if(nurLesen) d.querySelectorAll("[data-f]").forEach(x => { if(x.dataset.f !== "brandwache_bis") x.disabled = true; });
}
function asFfScheinDruck(s){
  const f = asNach("as_fremdfirma", s.fremdfirma_id), a = asFfSchein(s.art), z = asFfZeit;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Erlaubnisschein ${esc(s.titel)}</title><style>
    body{font-family:Jost,Arial,sans-serif;color:#1B4332;margin:24px;font-size:13px} h1{font-family:'Cormorant Garamond',Georgia,serif;color:#2D6A4F;font-size:24px;margin:0 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:10px} td,th{border:1px solid #b7c9bf;padding:6px;text-align:left;vertical-align:top} th{background:#D8F3DC;width:30%}
    .k{color:#555;font-size:12px}</style></head><body>
    <h1>Erlaubnisschein: ${esc(a.titel)}</h1><div class="k">${esc(AS.org ? AS.org.name : "")} · ${esc(a.recht)}</div>
    <table><tr><th>Bezeichnung</th><td>${esc(s.titel)}</td></tr><tr><th>Fremdfirma</th><td>${esc(f ? f.name : "eigene Beschäftigte")}</td></tr>
      <tr><th>Ort</th><td>${esc([s.ort, s.einheit_id ? asEinheitName(s.einheit_id) : ""].filter(Boolean).join(" · "))}</td></tr>
      <tr><th>Gültig</th><td>${z(s.von)} bis ${z(s.bis)}</td></tr><tr><th>Ausführende</th><td>${esc(s.ausfuehrende || "")}</td></tr>
      ${(s.massnahmen || []).map(m => `<tr><th>${m.ok ? "erledigt" : "OFFEN"}</th><td>${esc(m.t)}</td></tr>`).join("")}
      ${s.art === "heissarbeiten" ? `<tr><th>Brandwache bis</th><td>${z(s.brandwache_bis)}</td></tr>` : ""}
      <tr><th>Freigegeben</th><td>${s.ausgestellt_am ? z(s.ausgestellt_am) + " · " + esc(s.ausgestellt_von || "") : "noch nicht"}</td></tr>
      <tr><th>Unterschrift Auftraggeber</th><td style="height:34px"></td></tr><tr><th>Unterschrift Ausführende</th><td style="height:34px"></td></tr></table>
    <script>window.print()<\/script></body></html>`;
  const w = window.open("", "_blank"); if(w){ w.document.write(html); w.document.close(); } else asMeldung("Bitte Pop-ups erlauben");
}

/* Aufgaben für Kalender & To-dos (as-service.js) */
function asFfAufgaben(){
  const l = []; if(!AS.kunde) return l;
  asT("as_fremdfirma").filter(asFfLaeuft).forEach(f => {
    const vor = f.von ? asTageSeit(f.von) : 0, frist = f.von ? -vor : null;      // > 0 = Arbeitsbeginn liegt in der Vergangenheit
    if(vor < -14) return;                                                      // mehr als zwei Wochen voraus: noch nicht melden
    const o = asFfOffen(f), oeffnen = [["Öffnen", () => { asGehe("fremdfirmen"); setTimeout(() => asFfDialog(f), 300); }]];
    if(o.includes("abstimmen")) l.push({ schluessel: "ff-abstimmen:" + f.id, stufe: vor >= 0 ? "kritisch" : "warnung", titel: "Gegenseitige Gefährdungen mit " + f.name + " abstimmen",
      sub: (f.taetigkeit || "") + " · ab " + asDat(f.von) + " – § 8 ArbSchG, § 6 DGUV Vorschrift 1", frist, aktionen: oeffnen });
    if(o.includes("einweisen")) l.push({ schluessel: "ff-einweisen:" + f.id, stufe: vor >= 0 ? "kritisch" : "warnung", titel: "Fremdfirma vor Arbeitsbeginn einweisen: " + f.name,
      sub: (f.taetigkeit || "") + " · ab " + asDat(f.von), frist, aktionen: [["Einweisung …", () => asFfEinweisung(f)]] });
    if(o.includes("erlaubnisschein")) l.push({ schluessel: "ff-schein:" + f.id, stufe: "kritisch", titel: "Erlaubnisschein fehlt: " + f.name,
      sub: "gefährliche Arbeit – erst nach freigegebenem Erlaubnisschein beginnen", frist, aktionen: [["Erlaubnisschein", () => { asGehe("fremdfirmen"); setTimeout(() => asFfScheinDialog(null, f), 300); }]] });
    if(f.bis && asTageSeit(f.bis) > 0) l.push({ schluessel: "ff-ende:" + f.id, stufe: "info", quittierbar: true, titel: "Auftrag abschließen: " + f.name,
      sub: "geplant bis " + asDat(f.bis), frist: -asTageSeit(f.bis), aktionen: oeffnen });
  });
  asFfScheine().filter(s => s.status === "freigegeben" && s.bis && new Date(s.bis) < new Date()).forEach(s => l.push({ schluessel: "ff-schein-ende:" + s.id, stufe: "warnung",
    titel: "Erlaubnisschein abschließen: " + s.titel, sub: "abgelaufen " + asFfZeit(s.bis) + (s.art === "heissarbeiten" ? " – Brandwache/Nachkontrolle eintragen" : ""),
    frist: null, aktionen: [["Öffnen", () => asFfScheinDialog(s)]] }));
  return l;
}

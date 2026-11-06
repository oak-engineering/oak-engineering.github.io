/* OAK Arbeitsschutz-App – Unterweisungen (Terminal, Fälligkeiten, Nachweise, Module, Mitarbeiter, Inhalte).
   Funktionsgleich zum Kundenportal (unterweisungen.js, unterweisungen-start.js, personen.js, kapitel.js):
   gleiche Tabellen, gleiche RPCs, gleiche Rollenregeln. Das Kundenportal selbst wird nicht verändert.
   Bewusst OHNE Punktestand (Datenminimierung, § 12 ArbSchG verlangt den Nachweis, keine Leistungsauswertung).
   Globale Namen immer mit asUw/AS_UW-Präfix – alle Skripte teilen einen Scope. */
"use strict";

const AS_UW = { kunde: null, d: {}, kap: null, detail: null, kapThema: null, mobil: null,
  pf: { einheit: "", status: "aktiv", suche: "" }, nf: { q: "", jahr: "", best: "" },
  kat: null, kf: { kat: "", q: "" }, pe: { an: false, wahl: new Set() } };
/* DGUV Vorschrift 1 § 4: mindestens jährlich – Warnung ab 11 Monaten */
const AS_UW_FAELLIG_TAGE = 365, AS_UW_WARN_TAGE = 335;
const AS_UW_SPALTEN = "id,kunde_slug,mitarbeiter_name,funktion,bereich,module,unterweisung,bestanden,bestaetigung,config_version,created_at,geraet,quelle,bestaetigt_von";
/* Wo wurde unterwiesen? Kurzform für die Liste (Gerätename kommt aus dem Terminal-Zugang) */
function asUwGeraet(n){
  if(n.quelle === "nachtrag") return "Nachtrag";
  const g = String(n.geraet || "");
  return /handy|qr/i.test(g) ? "Handy" : /tablet/i.test(g) ? "Tablet" : /terminal|surface/i.test(g) ? "Terminal" : (g || "—");
}
const AS_UW_RANG = { ueberfaellig: 3, erstunterweisung: 2, bald: 1, ok: 0 };
const AS_UW_AMPEL = { kritisch: 0, warnung: 1, grau: 2, gut: 3 };
const AS_UW_FARBE = { kritisch: "rot", warnung: "gelb", gut: "gruen", grau: "grau" };
const AS_UW_TYP = { eigen: "eigenes Personal", leiharbeit: "Leiharbeit", fremdfirma: "Fremdfirma", besucher: "Besucher" };
const AS_UW_STAND = { fertig: "einsetzbar", aufbau: "im Aufbau", geplant: "in Planung" };
const AS_UW_FSTATUS = { ueberfaellig: ["rot", "überfällig"], erstunterweisung: ["rot", "Erstunterweisung"], bald: ["gelb", "läuft ab"],
  ok: ["gruen", "aktuell"], keine: ["grau", "nichts zugewiesen"], ohne: ["grau", "nichts zugewiesen"] };
const AS_UW_MODUL_ALT = { grund: "Allgemeine Grundunterweisung", spritzguss: "Sicher an der Spritzgießmaschine", leitern: "Leitern & Tritte",
  flurfoerder: "Flurförderzeuge", kran: "Hallenkran und Anschlagen", bildschirm: "Gesund am Bildschirm", extern: "Sicher auf dem Betriebsgelände" };

/* ---------------- Daten ---------------- */
async function asUwLaden(neu){
  /* Zwischenspeicher höchstens 10 s: Nachweise kommen vom Terminal (anderes Gerät), Fälligkeiten aus DB-Triggern –
     beim Öffnen der Seite gilt der Stand der Datenbank (Abnahme K5-06, 06.11.2026) */
  if(!neu && AS_UW.kunde === AS.kunde && AS_UW.d.geladen && Date.now() - (AS_UW.d.am || 0) < 10000) return;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const hole = p => apiGet(p).then(r => r || []).catch(() => []);
  const [nachweise, pers, rollen, einheiten, tok, beleg, einarb, module, buchung, faellig, modulZuw, zusatz, docs, baustein, anlassP, anlassA] = await Promise.all([
    hole("/rest/v1/unterweisungsnachweise?select=" + AS_UW_SPALTEN + k + "&order=created_at.desc"),
    hole("/rest/v1/uw_person?select=*,uw_person_einheit(einheit_id),uw_person_rolle(rolle_id)" + k + "&order=name.asc"),
    hole("/rest/v1/uw_rolle?select=*" + k + "&order=name.asc"),
    hole("/rest/v1/uw_einheit?select=*" + k + "&order=name.asc"),
    hole("/rest/v1/portal_terminal_token?select=token,kunde_slug,bezeichnung&aktiv=is.true" + k),
    hole("/rest/v1/portal_belegschaft?select=*" + k),
    hole("/rest/v1/portal_einarbeitung?select=*&archiviert=is.false" + k + "&order=am.desc"),
    hole("/rest/v1/uw_modul?select=*&aktiv=is.true&order=reihenfolge.asc").then(r => r.filter(m => m.ebene !== "inhalt")),   // nur die bisherigen Pakete; neue Inhalte zeigt der Reiter „Katalog“
    hole("/rest/v1/uw_buchung?select=*" + k),
    hole("/rest/v1/v_uw_faelligkeit?select=*" + k),
    hole("/rest/v1/uw_modul_zuweisung?select=*" + k),
    hole("/rest/v1/uw_zusatz?select=*" + k + "&order=sortierung.asc"),
    hole("/rest/v1/portal_dokumente?select=id,kunde_slug,storage_path,doc_typ,titel,kategorie,stand,updated_at" + k
      + "&kategorie=eq.unterweisungen&order=sortierung.asc,titel.asc"),
    hole("/rest/v1/portal_uw_baustein?select=*" + k + "&order=gueltig_ab.desc"),
    hole("/rest/v1/portal_pruefauftrag_person?select=person_id,am,durch,pruefauftrag_id" + k + "&order=am.desc"),
    hole("/rest/v1/portal_pruefauftrag?select=id,objekt_titel&objekt_typ=eq.unterweisung&erledigt_am=not.is.null" + k)]);
  AS_UW.d = { geladen: true, am: Date.now(), nachweise, pers, rollen, einheiten, tok, beleg, einarb, module, buchung, faellig, modulZuw, zusatz, docs, baustein,
    anlass: (anlassP || []).map(x => Object.assign({}, x, { titel: ((anlassA || []).find(a => a.id === x.pruefauftrag_id) || {}).objekt_titel || "" })) };
  if(AS_UW.kunde !== AS.kunde){ AS_UW.kap = null; AS_UW.detail = null; AS_UW.mobil = null; AS_UW.kat = null; AS_UW.pe = { an: false, wahl: new Set() }; }
  AS_UW.kunde = AS.kunde;
}
async function asUwKapLaden(neu){
  if(!neu && AS_UW.kap) return;
  const hole = p => apiGet(p).then(r => r || []).catch(() => []);
  const [kap, medien, zuw] = await Promise.all([
    hole("/rest/v1/uw_kapitel?select=*&order=thema.asc,kennung.asc"),
    hole("/rest/v1/uw_medium?select=*"),
    hole("/rest/v1/uw_zuweisung?select=id,kunde_slug,kennung,rolle_id,aktiv&kunde_slug=eq." + encodeURIComponent(AS.kunde))]);
  AS_UW.kap = { kap, medien, zuw };
}
async function asUwNeu(text){ await asUwLaden(true); asZeige(); if(text) asMeldung(text); }

/* ---------------- Hilfen ---------------- */
function asUwDarfPflegen(){ return asDarf("pflegen"); }
function asUwNorm(s){ return String(s || "").toLowerCase().replace(/\s+/g, " ").trim().split(" ").sort().join(" "); }
function asUwTage(s){ return s ? Math.floor((Date.now() - new Date(s).getTime()) / 864e5) : null; }
function asUwBis(n){ return new Date(new Date(n.created_at).getTime() + AS_UW_FAELLIG_TAGE * 864e5).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function asUwStatus(n){
  const t = asUwTage(n.created_at);
  if(t === null) return { klasse: "grau", text: "—" };
  if(t >= AS_UW_FAELLIG_TAGE) return { klasse: "kritisch", text: "überfällig seit " + asUwBis(n) };
  if(t >= AS_UW_WARN_TAGE) return { klasse: "warnung", text: "fällig am " + asUwBis(n) };
  return { klasse: "gut", text: "gültig bis " + asUwBis(n) };
}
function asUwJeMitarbeiter(rows){
  const map = new Map();
  rows.forEach(n => { const k = (n.mitarbeiter_name || "").trim().toLowerCase(); if(!k) return;
    const alt = map.get(k); if(!alt || new Date(n.created_at) > new Date(alt.created_at)) map.set(k, n); });
  return [...map.values()].sort((a, b) => (a.mitarbeiter_name || "").localeCompare(b.mitarbeiter_name || "", "de"));
}
function asUwLetzter(name){
  const k = asUwNorm(name); let best = null;
  AS_UW.d.nachweise.forEach(n => { if(asUwNorm(n.mitarbeiter_name) === k && (!best || new Date(n.created_at) > new Date(best.created_at))) best = n; });
  return best;
}
function asUwModulTitel(k){
  const bu = AS_UW.d.buchung.find(x => x.kiosk_modul === k || x.thema === k);
  const m = AS_UW.d.module.find(x => x.thema === (bu ? bu.thema : k)) || (AS_UW.kat ? AS_UW.kat.inhalte.find(x => x.thema === k) : null);
  return (m && m.titel) || AS_UW_MODUL_ALT[k] || k;
}
function asUwModule(n){
  const m = Array.isArray(n.module) ? n.module : (n.unterweisung ? String(n.unterweisung).split(/,\s*/) : []);
  return m.filter(Boolean).map(asUwModulTitel);
}
function asUwGruppen(){ return AS_UW.d.rollen.filter(r => r.status !== "archiviert" && r.typ !== "besucher"); }
function asUwGruppenName(p){ return (p.uw_person_rolle || []).map(x => (AS_UW.d.rollen.find(r => r.id === x.rolle_id) || {}).name).filter(Boolean).join(", "); }
function asUwName(id, liste){ const t = liste.find(x => x.id === id); return t ? t.name : "—"; }
function asUwEinarb(name){ const k = asUwNorm(name); return AS_UW.d.einarb.find(e => asUwNorm(e.person_name) === k) || null; }
function asUwToken(){ const t = AS_UW.d.tok; return (t.find(x => !/geteilt|handy/i.test(x.bezeichnung || "")) || t[0] || {}).token || ""; }
function asUwGebucht(thema){ return AS_UW.d.buchung.some(b => b.thema === thema && b.aktiv !== false); }
function asUwDokument(thema){ return AS_UW.d.docs.find(r => r.storage_path && r.storage_path.endsWith("/unterweisungen/" + thema + ".html")) || null; }
function asUwViewer(d, titel){ return "viewer.html?typ=" + encodeURIComponent(d.doc_typ || "html") + "&p=" + encodeURIComponent(d.storage_path || "") + "&t=" + encodeURIComponent(titel || d.titel || ""); }
function asUwGruppenVon(thema){ return AS_UW.d.modulZuw.filter(z => z.thema === thema && z.aktiv !== false); }
function asUwZusaetze(thema){
  return AS_UW.d.zusatz.filter(z => z.thema === thema && z.status !== "zurueckgezogen")
    .sort((a, b) => (a.sortierung - b.sortierung) || String(a.angelegt_am).localeCompare(String(b.angelegt_am)));
}
function asUwPersStatus(pid){
  const zeilen = AS_UW.d.faellig.filter(f => f.person_id === pid);
  if(!zeilen.length) return { status: "keine", offen: 0, gesamt: 0, naechste: null };
  let schlimm = "ok", offen = 0, naechste = null;
  zeilen.forEach(z => { if((AS_UW_RANG[z.status] || 0) > (AS_UW_RANG[schlimm] || 0)) schlimm = z.status;
    if(z.status === "ueberfaellig" || z.status === "erstunterweisung") offen++;
    if(z.faellig_am && (!naechste || z.faellig_am < naechste)) naechste = z.faellig_am; });
  return { status: schlimm, offen, gesamt: zeilen.length, naechste };
}
async function asUwHochladen(pfad, inhalt, typ){
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad.split("/").map(encodeURIComponent).join("/"), { method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + (await token()), "Content-Type": typ || "application/octet-stream", "x-upsert": "true" }, body: inhalt });
  if(!r.ok) throw new Error("Speichern fehlgeschlagen (" + r.status + ")");
}

/* ======================= Je Rolle: was zu unterweisen ist (aus der Beurteilung) =======================
   Prozessmodell P20 Schritt 1: Inhalt je Rolle = Gefährdungen der Tätigkeiten mit Schutzmaßnahmen + Betriebsanweisungen
   + Gefahrstoffe dieser Arbeitssysteme. Eine Quelle: Beurteilung (as_*), BA (Viewer anl:/gs:). */
async function asUwJeRolle(box){
  const rollen = AS_UW.d.rollen.filter(r => r.status !== "archiviert");
  AS_UW.rolle = AS_UW.rolle && rollen.some(r => r.id === AS_UW.rolle) ? AS_UW.rolle : (rollen[0] || {}).id;
  const rolle = rollen.find(r => r.id === AS_UW.rolle);
  const norm = x => String(x || "").trim().toLowerCase();
  const sys = rolle ? asT("as_arbeitssystem").filter(s => !s.stillgelegt_am && asListe(s.rollen).map(norm).includes(norm(rolle.name))) : [];
  const gefs = await apiGet("/rest/v1/portal_gefahrstoff?select=id,bezeichnung,signalwort,ba_gruppe&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => []) || [];
  const personen = rolle ? AS_UW.d.pers.filter(p => p.status !== "archiviert" && (p.uw_person_rolle || []).some(x => x.rolle_id === rolle.id)) : [];
  const block = s => { const g = asT("as_gefaehrdung").filter(x => x.arbeitssystem_id === s.id && x.art !== "ressource");
    const stoffe = [...new Set(g.map(x => x.gefahrstoff_id).filter(Boolean))].map(id => gefs.find(x => x.id === id)).filter(Boolean);
    const mid = asListe(s.anlagen)[0];
    return `<div class="karte"><h2>${esc(s.name)}<span>${mid ? `<button class="btn sek klein" data-uwba="${esc(s.id)}">Betriebsanweisung</button>` : ""}
        <button class="btn sek klein" onclick="AS.reiter.bda='${esc(s.id)}'; asGehe('bda/${esc(s.id)}')">Beurteilung</button></span></h2>
      <div class="zeilen">${g.map(x => `<div class="z"><div><b>${esc(x.kurz || "")}</b><small>${esc((x.schutzmassnahmen || []).map(m => m.text || m).filter(Boolean).slice(0, 4).join(" · ") || x.situation || x.beschreibung || "")}</small></div>
        ${x.gefahrstoff_id ? `<button class="btn sek klein" onclick="AS_GS.oeffnen='${esc(x.gefahrstoff_id)}'; asGehe('gefahrstoffe/kataster')">Stoff</button>` : ""}</div>`).join("") || `<div class="leer">Keine Gefährdungen erfasst.</div>`}</div>
      ${stoffe.length ? `<p class="hinweis">Gefahrstoffe: ${stoffe.map(x => esc(x.bezeichnung) + (x.signalwort ? " (" + esc(x.signalwort) + ")" : "")).join(" · ")} – je Stoff die Gefahrstoff-BA unterweisen.</p>` : ""}</div>`; };
  box.innerHTML = `<div class="karte"><h2>Was ist zu unterweisen? <span class="hinweis">aus den Beurteilungen der Arbeitsbedingungen</span></h2>
      <div class="filterleiste">${asFilterWahl('id="uwRolleWahl"', AS_UW.rolle || "", rollen.map(r => [r.id, r.name]), "Rolle")}
        <span class="fl-zahl">${sys.length} Beurteilung(en) · ${personen.length} Person(en)</span></div>
      <p class="hinweis">Grundlage der Unterweisung nach § 12 ArbSchG: die Gefährdungen dieser Rolle mit ihren Schutzmaßnahmen, die Betriebsanweisungen und die Gefahrstoffe.
        Welche Beurteilung zu welcher Rolle gehört, steht in der Beurteilung (Feld „Rollen“).</p>
      ${personen.length ? `<p class="hinweis">Personen: ${personen.map(p => esc(p.name)).join(", ")}</p>` : ""}</div>
    ${sys.map(block).join("") || `<div class="karte"><div class="leer">${rolle ? "Diese Rolle ist noch keiner Beurteilung zugeordnet – in der Beurteilung unter „Bearbeiten“ die Rolle eintragen." : "Noch keine Rollen angelegt."}</div></div>`}`;
  const w = box.querySelector("#uwRolleWahl"); if(w) w.onchange = () => { AS_UW.rolle = w.value; asUwJeRolle(box); };
  box.querySelectorAll("[data-uwba]").forEach(b => b.onclick = () => { const s = asNach("as_arbeitssystem", b.dataset.uwba);
    if(s && typeof asBaVorschauUrl === "function") asDokOeffnen(asBaVorschauUrl(s, "ba"), s.name + " · BA"); });
}

/* ======================= Seite ======================= */
AS_SEITEN.unterweisungen = { titel: "Unterweisungen", icon: "✎", sort: 5.5, async render(main){
  const liste = [["terminal", "Terminal & fällig"], ["nachweise", "Nachweise"], ["je_rolle", "Je Rolle"]];
  if(asUwDarfPflegen()) liste.push(["module", "Module"], ["mitarbeiter", "Mitarbeiter"], ["inhalte", "Inhalte"]);
  liste.push(["katalog", "Katalog"]);
  const r = asReiter("unterweisungen", liste, "terminal");
  main.innerHTML = `<h1 class="seite">Unterweisungen</h1><p class="unter">Unterweisungs-Terminal, Fälligkeiten und Nachweise – dieselben Daten wie im Kundenportal (§ 12 ArbSchG, § 4 DGUV Vorschrift 1).</p>
    ${r.html}<div id="asUwBox"><div class="leer">wird geladen …</div></div>`;
  const box = main.querySelector("#asUwBox");
  try{
    await asUwLaden();
    if(r.akt === "inhalte") await asUwKapLaden();
    if(r.akt === "katalog") await asUwKatLaden();
    ({ terminal: asUwTerminal, nachweise: asUwNachweise, module: asUwModuleSeite, mitarbeiter: asUwMitarbeiter, inhalte: asUwInhalte, je_rolle: asUwJeRolle,
      katalog: asUwKatalog })[r.akt](box);
  }catch(e){ box.innerHTML = `<div class="karte"><div class="leer">Konnte nicht geladen werden: ${esc(e.message || e)}</div></div>`; }
}};

/* ======================= 1. Terminal & fällig ======================= */
function asUwTerminal(box){
  const tok = asUwToken(), d = AS_UW.d;
  /* Überblick aus v_uw_faelligkeit: je Person der schlechteste Status */
  const leute = d.pers.filter(p => p.status === "aktiv").map(p => Object.assign({ name: p.name }, asUwPersStatus(p.id)));
  const zahl = s => leute.filter(p => p.status === s).length;
  const ueber = zahl("ueberfaellig"), erst = zahl("erstunterweisung"), bald = zahl("bald"), ok = zahl("ok");
  const vorschlaege = d.baustein.filter(v => v.status === "vorgeschlagen");
  const dringend = leute.filter(p => ["ueberfaellig", "erstunterweisung", "bald"].includes(p.status))
    .sort((a, b) => (AS_UW_RANG[b.status] || 0) - (AS_UW_RANG[a.status] || 0) || String(a.naechste || "").localeCompare(String(b.naechste || ""))).slice(0, 12);
  const gebucht = d.module.filter(m => asUwGebucht(m.thema)), ohneRecht = gebucht.filter(m => !m.rechtsbezug || !m.rechtsbezug.length);

  /* Liste je Name (Nachweise vom Terminal), wie „Wer ist fällig" im Kundenportal */
  const pers = d.pers.filter(p => p.status !== "archiviert");
  const zusatz = asUwJeMitarbeiter(d.nachweise).filter(n => !pers.some(p => asUwNorm(p.name) === asUwNorm(n.mitarbeiter_name)));
  const einarbZelle = (name, taet) => { const e = asUwEinarb(name);
    return e ? `<span title="${esc("bestätigt von " + e.bestaetigt_von + (e.taetigkeit ? " · " + e.taetigkeit : "") + (e.notiz ? " – " + e.notiz : ""))}">${asChip("erfolgt " + asDat(e.am), "gruen")}</span>`
      : `<button class="btn sek klein" data-einarb="${esc(name)}" data-taet="${esc(taet || "")}">Einarbeitung bestätigen</button>`; };
  const pdf = n => n && n.id ? `<button class="btn sek klein" data-pdf="${esc(n.id)}">Nachweis (PDF)</button>` : "";
  const zeilen = pers.map(p => { const n = asUwLetzter(p.name), st = n ? asUwStatus(n) : { klasse: "kritisch", text: "noch keine Unterweisung" }, g = asUwGruppenName(p);
    return { rang: AS_UW_AMPEL[st.klasse] ?? 2, html: `<tr class="bda-klick" data-pedit="${esc(p.id)}" data-name="${esc(p.name.toLowerCase())}" data-gruppe="${esc(g)}" data-stand="${st.klasse}" data-ea="${asUwEinarb(p.name) ? "ja" : "nein"}">
      <td><b>${esc(p.name)}</b>${(() => { const a = (AS_UW.d.anlass || []).find(x => x.person_id === p.id);
        return a ? `<br><small class="hinweis" title="anlassbezogene Unterweisung (Neuunterweisung)">Anlass: ${esc(a.titel || "Neuunterweisung")} · ${asDat(a.am)}${a.durch ? " · " + esc(a.durch) : ""}</small>` : ""; })()}</td><td>${esc(g || "—")}</td><td>${n ? asDat(n.created_at) : "—"}</td><td>${asChip(st.text, AS_UW_FARBE[st.klasse])}</td>
      <td>${einarbZelle(p.name, g)}</td><td style="white-space:nowrap">${pdf(n)}</td></tr>` }; })
    .concat(zusatz.map(n => { const st = asUwStatus(n);
      return { rang: AS_UW_AMPEL[st.klasse] ?? 2, html: `<tr data-name="${esc((n.mitarbeiter_name || "").toLowerCase())}" data-gruppe="${esc(n.funktion || "")}" data-stand="${st.klasse}" data-ea="${asUwEinarb(n.mitarbeiter_name) ? "ja" : "nein"}">
        <td><b>${esc(n.mitarbeiter_name)}</b></td><td>${esc(n.funktion || "—")}${n.bereich ? `<br><small class="hinweis">${esc(n.bereich)}</small>` : ""}</td><td>${asDat(n.created_at)}</td>
        <td>${asChip(st.text, AS_UW_FARBE[st.klasse])}</td><td>${einarbZelle(n.mitarbeiter_name, n.funktion)}</td><td>${pdf(n)}</td></tr>` }; }))
    .sort((a, b) => a.rang - b.rang);
  const faelligZahl = zeilen.filter(z => z.rang <= 1).length;
  const gruppenOpt = [...new Set(pers.map(asUwGruppenName).concat(zusatz.map(n => n.funktion)).filter(Boolean).flatMap(g => g.split(", ")))].sort();

  /* Belegschaft: Zählung, kein Namensabgleich */
  const b = d.beleg[0] || null;
  let beleg = `<div class="karte"><h2>Belegschaft noch nicht eingetragen</h2><p class="hinweis">Ohne Mitarbeiterzahl kann das Portal nicht zählen, wer noch fällig ist.</p><button class="btn sek" data-beleg="stamm">Mitarbeiterzahl eintragen</button></div>`;
  if(b){
    const gueltig = asUwJeMitarbeiter(d.nachweise).filter(n => asUwStatus(n).klasse !== "kritisch");
    const leihOk = gueltig.filter(n => /leih|zeitarb/i.test(n.bereich || "")).length, stammOk = gueltig.length - leihOk;
    const sf = Math.max(0, b.stamm - stammOk), lf = Math.max(0, b.leih - leihOk);
    beleg = `<div class="kacheln">
      <div class="kachel k-${sf ? "rot" : "gruen"}"><div class="lbl">Stammbelegschaft fällig</div><div class="zahl">${sf}</div><div class="hinweis">${Math.min(stammOk, b.stamm)} von ${esc(b.stamm)} gültig unterwiesen${b.stamm_hinweis ? " · " + esc(b.stamm_hinweis) : ""}</div><button class="btn sek klein" data-beleg="stamm">ändern</button></div>
      <div class="kachel k-${lf ? "rot" : "gruen"}"><div class="lbl">Leiharbeiter fällig</div><div class="zahl">${lf}</div><div class="hinweis">${b.leih ? Math.min(leihOk, b.leih) + " von " + esc(b.leih) + " unterwiesen" : "aktuelle Anzahl bitte eintragen"}</div><button class="btn sek klein" data-beleg="leih">${b.leih ? "Anzahl ändern" : "Anzahl eintragen"}</button></div></div>
      <p class="hinweis">Gezählt wird der jüngste Nachweis je Name (gültig 12 Monate). Leiharbeiter wählen am Terminal „Leiharbeit / Zeitarbeit“.</p>`;
  }

  box.innerHTML = `<div class="karte">
      ${tok ? `<div class="reihe" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn gross" id="uwStart">Unterweisungs-Terminal starten</button>
          <button class="btn sek" id="uwTeilen" title="QR-Code für Handy & Tablet">Teilen</button>
          <button class="btn sek" id="uwEinst" title="Module je Rolle festlegen, Rollen anlegen">Einstellungen</button>
          <span id="uwMobil"></span></div>`
        : `<div class="leer">Terminal noch nicht eingerichtet – ${asDarf("pflegen") ? `Gerät unter <a href="#organisation/zugaenge">Organisation › Zugänge & Geräte</a> einrichten.` : "Geräte richtet die Fachkraft oder die Geschäftsführung unter Organisation › Zugänge & Geräte ein."}</div>`}
      <p class="hinweis">Am Terminal: Name eingeben, Rolle wählen, Module durchgehen, unterschreiben. Der Nachweis landet automatisch hier im Portal.</p></div>
    <div class="kacheln">
      <div class="kachel k-${ueber + erst ? "rot" : "gruen"}"><div class="lbl">überfällig</div><div class="zahl">${ueber + erst}</div><div class="hinweis">${ueber} überfällig · ${erst} Erstunterweisung</div></div>
      <div class="kachel k-${bald ? "gelb" : "gruen"}"><div class="lbl">läuft in 28 Tagen ab</div><div class="zahl">${bald}</div><div class="hinweis">rechtzeitig einplanen</div></div>
      <div class="kachel k-gruen"><div class="lbl">aktuell unterwiesen</div><div class="zahl">${ok}</div><div class="hinweis">von ${leute.length} aktiven Personen</div></div>
      <div class="kachel k-${vorschlaege.length ? "gelb" : "gruen"}"><div class="lbl">wartet auf Freigabe</div><div class="zahl">${vorschlaege.length}</div><div class="hinweis">Vorschläge für die nächste Unterweisung</div></div></div>
    <div class="karte"><h2>Wer ist fällig (nach Rollen und Kapiteln) <span class="hinweis">${gebucht.length} von ${d.module.length} Modulen freigeschaltet</span></h2>
      <div class="zeilen">${leute.length ? (dringend.map(p => `<div class="z"><div><b>${esc(p.name)}</b><small>${p.naechste ? "fällig am " + asDat(p.naechste) : ""}</small></div>${asChip(AS_UW_FSTATUS[p.status][1], AS_UW_FSTATUS[p.status][0])}</div>`).join("")
          || `<div class="leer">Niemand ist fällig. Alle zugewiesenen Unterweisungen sind aktuell.</div>`)
        : `<div class="leer">Noch keine Personen angelegt. Unter <b>Mitarbeiter</b> Bereiche, Rollen und Personen anlegen — daraus rechnet das Portal die Fälligkeiten.</div>`}</div>
      ${vorschlaege.length || ohneRecht.length ? `<h3>Was ist freizugeben</h3><div class="zeilen">
        ${vorschlaege.slice(0, 8).map(v => `<div class="z"><div><b>${esc(v.titel || "Vorschlag")}</b><small>${asDat(v.gueltig_ab)}</small></div>${asChip("wartet auf Freigabe", "gelb")}</div>`).join("")}
        ${ohneRecht.map(m => `<div class="z"><div><b>${esc(m.titel)}</b></div>${asChip("Rechtsbezug fehlt", "gelb")}</div>`).join("")}</div>` : ""}
      <p class="hinweis">Grundlage der Fälligkeit: § 12 ArbSchG und § 4 DGUV Vorschrift 1 — vor Aufnahme der Tätigkeit und danach mindestens jährlich. Für Beschäftigte unter 18 Jahren rechnet das Portal automatisch mit sechs Monaten (§ 29 JArbSchG). Gespeichert wird, <i>dass</i> unterwiesen wurde — kein Punktestand.</p></div>
    ${beleg}
    <div class="karte"><h2>Jährliche Unterweisung je Person (Terminal) <span class="hinweis">${zeilen.length ? (faelligZahl ? faelligZahl + " fällig" : "alle aktuell") : ""}</span>
        ${d.nachweise.length ? `<button class="btn sek klein" id="uwCsv">Excel-Export</button>` : ""} <button class="btn klein" id="uwPersNeu">Mitarbeiter anlegen</button></h2>
      ${zeilen.length ? `<div class="filterleiste">
          <input type="search" id="uwfName" placeholder="Name suchen" autocomplete="off">
          <select id="uwfGruppe" aria-label="Gruppe"><option value="">Gruppe: alle</option>${gruppenOpt.map(g => `<option value="${esc(g)}">Gruppe: ${esc(g)}</option>`).join("")}</select>
          <select id="uwfStand" aria-label="Stand"><option value="">Stand: alle</option><option value="faellig">Stand: fällig oder überfällig</option><option value="gut">Stand: gültig</option><option value="einarb">Stand: Einarbeitung offen</option></select>
          <span class="fl-zahl" id="uwfZahl"></span></div>
        <div class="tabwrap"><table class="tab" id="uwListe"><thead><tr><th>Name</th><th>Gruppe</th><th>zuletzt unterwiesen</th><th>Stand</th><th>Praktische Einarbeitung</th><th></th></tr></thead>
          <tbody>${zeilen.map(z => z.html).join("")}</tbody></table></div>`
        : `<div class="leer">Noch niemand eingetragen. <b>„Mitarbeiter anlegen"</b> – oder die Beschäftigten tragen sich am Terminal selbst ein und erscheinen dann hier.</div>`}</div>`;

  const q = s => box.querySelector(s);
  if(q("#uwStart")) q("#uwStart").onclick = () => asDokOeffnen("kiosk.html#t=" + encodeURIComponent(tok), "Unterweisungs-Terminal");
  if(q("#uwTeilen")){ q("#uwTeilen").onclick = () => asUwTeilen(false); asUwMobilStatus(); }
  if(q("#uwEinst")) q("#uwEinst").onclick = asUwEinstellungen;
  if(q("#uwCsv")) q("#uwCsv").onclick = () => asUwExport(AS_UW.d.nachweise);
  q("#uwPersNeu").onclick = () => asUwPersonKurz(null);
  box.querySelectorAll("[data-pedit]").forEach(x => x.onclick = ev => { if(ev.target.closest("button, a, input, select")) return; asUwPersonKurz(d.pers.find(p => p.id === x.dataset.pedit)); });
  box.querySelectorAll("[data-pdf]").forEach(x => x.onclick = () => asUwPdf(x.dataset.pdf));
  box.querySelectorAll("[data-einarb]").forEach(x => x.onclick = () => asUwEinarbDialog(x.dataset.einarb, x.dataset.taet));
  box.querySelectorAll("[data-beleg]").forEach(x => x.onclick = () => asUwBelegDialog(x.dataset.beleg));
  const filtern = () => {
    const n = (q("#uwfName") || {}).value || "", g = (q("#uwfGruppe") || {}).value || "", s = (q("#uwfStand") || {}).value || ""; let c = 0;
    box.querySelectorAll("#uwListe tbody tr").forEach(tr => {
      const okk = (!n || tr.dataset.name.includes(n.toLowerCase().trim())) && (!g || (", " + tr.dataset.gruppe + ",").includes(", " + g + ","))
        && (!s || (s === "einarb" ? tr.dataset.ea === "nein" : s === "gut" ? tr.dataset.stand === "gut" : tr.dataset.stand !== "gut"));
      tr.hidden = !okk; if(okk) c++; });
    if(q("#uwfZahl")) q("#uwfZahl").textContent = c + " von " + zeilen.length;
  };
  ["#uwfName", "#uwfGruppe", "#uwfStand"].forEach(id => { const el = q(id); if(el) el[id === "#uwfName" ? "oninput" : "onchange"] = filtern; });
  filtern();
}

/* Mitarbeiter anlegen / ändern (kurz): Name + Gruppe – jedes Konto des Betriebs darf das (RLS grenzt ein) */
function asUwPersonKurz(p){
  const gruppen = asUwGruppen(), gew = new Set(p ? (p.uw_person_rolle || []).map(x => x.rolle_id) : []);
  asDialog({ titel: p ? "Mitarbeiter ändern" : "Mitarbeiter anlegen", inhalt: `<div class="form">
      <label class="voll">Vor- und Nachname<input type="text" id="uwPName" value="${esc(p ? p.name : "")}" placeholder="z. B. Max Müller" autocomplete="off"></label></div>
      <p><b>Gruppe</b> <span class="hinweis">(mehrere möglich)</span></p>
      <div style="display:flex;flex-wrap:wrap;gap:6px 16px">${gruppen.map(g => `<label><input type="checkbox" class="uwPG" value="${esc(g.id)}"${gew.has(g.id) ? " checked" : ""}> ${esc(g.name)}</label>`).join("") || '<span class="hinweis">Noch keine Gruppen angelegt.</span>'}</div>
      ${p ? `<p><label><input type="checkbox" id="uwPAus"> ausgeschieden (nicht mehr anzeigen)</label></p>` : ""}`,
    knoepfe: [{ t: p ? "Speichern" : "Anlegen", fn: async dlg => {
      const name = dlg.querySelector("#uwPName").value.trim().replace(/\s+/g, " ");
      if(name.length < 3){ asMeldung("Bitte den vollständigen Namen eintragen."); return false; }
      const rollen = [...dlg.querySelectorAll(".uwPG:checked")].map(x => x.value);
      const aus = dlg.querySelector("#uwPAus"), status = aus && aus.checked ? "archiviert" : "aktiv";
      if(!p && !rollen.length && gruppen.length){ asMeldung("Bitte mindestens eine Gruppe wählen."); return false; }
      let id = p ? p.id : null;
      if(p) await apiSend("PATCH", "/rest/v1/uw_person?id=eq." + encodeURIComponent(p.id), { name, status, geaendert_am: new Date().toISOString() }, "return=minimal");
      else { const neu = await apiSend("POST", "/rest/v1/uw_person", { kunde_slug: AS.kunde, name, status: "aktiv", sprache: "de" }, "return=representation");
        id = Array.isArray(neu) ? neu[0].id : neu.id; }
      await apiSend("DELETE", "/rest/v1/uw_person_rolle?person_id=eq." + encodeURIComponent(id), null, "return=minimal");
      if(rollen.length) await apiSend("POST", "/rest/v1/uw_person_rolle", rollen.map(r => ({ person_id: id, rolle_id: r })), "return=minimal");
      await asUwNeu(p ? (status === "archiviert" ? name + " wird nicht mehr angezeigt." : name + " ist gespeichert.") : name + " ist angelegt.");
    } }] });
}

function asUwBelegDialog(art){
  const b = AS_UW.d.beleg[0] || null, alt = b ? (art === "stamm" ? b.stamm : b.leih) : "";
  asDialog({ titel: art === "stamm" ? "Stammbelegschaft" : "Leiharbeiter", inhalt: `<div class="form">
      ${asFeld(art === "stamm" ? "Anzahl fester Mitarbeiter (Stammbelegschaft)" : "Aktuelle Anzahl Leiharbeiter", "zahl", alt, "number", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async dlg => {
      const z = asWerte(dlg).zahl;
      if(z == null || isNaN(z) || z < 0 || z > 100000 || Math.floor(z) !== z){ asMeldung("Bitte eine Zahl eintragen."); return false; }
      const daten = { kunde_slug: AS.kunde, geaendert_am: new Date().toISOString(), geaendert_von: AS.ich || "" };
      daten[art === "stamm" ? "stamm" : "leih"] = z;
      if(b) await apiSend("PATCH", "/rest/v1/portal_belegschaft?kunde_slug=eq." + encodeURIComponent(AS.kunde), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_belegschaft", Object.assign({ stamm: 0, leih: 0 }, daten), "return=minimal");
      await asUwNeu(art === "stamm" ? "Stammbelegschaft gespeichert." : "Anzahl Leiharbeiter gespeichert.");
    } }] });
}

/* Praktische Einarbeitung (§ 12 Abs. 1 ArbSchG: auf den Arbeitsplatz ausgerichtet) – bestätigt der Schichtführer */
function asUwEinarbDialog(name, taet){
  const heute = asHeute();
  asDialog({ titel: "Praktische Einarbeitung", inhalt: `<p><b>${esc(name)}</b> wurde am Arbeitsplatz praktisch eingearbeitet – ergänzend zur Unterweisung am Terminal (§ 12 ArbSchG).</p>
      <div class="form">${asFeld("Tätigkeit / Arbeitsplatz", "taetigkeit", taet || "", "text", "voll")}
        <label>Eingearbeitet am<input type="date" data-f="am" value="${heute}" max="${heute}"></label>
        ${asFeld("Bestätigt von (Einarbeiter/in)", "wer", AS.ich || "")}
        ${asFeld("Notiz (optional)", "notiz", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Bestätigen", fn: async dlg => {
      const w = asWerte(dlg);
      if(!w.wer){ asMeldung("Bitte eintragen, wer die Einarbeitung bestätigt."); return false; }
      if(!/^\d{4}-\d{2}-\d{2}$/.test(w.am || "") || w.am > heute){ asMeldung("Bitte ein Datum bis heute eintragen."); return false; }
      await apiSend("POST", "/rest/v1/portal_einarbeitung", { kunde_slug: AS.kunde, person_name: name, taetigkeit: w.taetigkeit || null,
        am: w.am, bestaetigt_von: w.wer, notiz: w.notiz || null }, "return=minimal");
      await asUwNeu("Praktische Einarbeitung von " + name + " bestätigt.");
    } }] });
}

/* ---- Handy & Tablet: geteilter Link, Schalter bis 23:59 Uhr ---- */
function asUwMobilText(s){
  if(!s || !s.an) return "Link aktivieren";
  const bis = s.bis ? new Date(s.bis).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
  return "Link aktiv" + (bis ? " bis " + bis + " Uhr" : "");
}
async function asUwMobilStatus(){
  try{ AS_UW.mobil = await apiSend("POST", "/rest/v1/rpc/terminal_mobil_status", { p_kunde_slug: AS.kunde }); }catch(e){ AS_UW.mobil = null; }
  const el = document.getElementById("uwMobil");
  if(el) el.innerHTML = AS_UW.mobil && AS_UW.mobil.an ? asChip(asUwMobilText(AS_UW.mobil), "gruen") : "";
}
async function asUwQrLib(){
  if(typeof qrcode === "function") return true;
  await new Promise((ok, fehl) => { const s = document.createElement("script"); s.src = "../portal/libs/qrcode/qrcode.min.js?v=1.4.4"; s.onload = ok; s.onerror = fehl; document.head.appendChild(s); }).catch(() => {});
  return typeof qrcode === "function";
}
async function asUwTeilen(neu){
  const dlg = asDialog({ titel: "Unterweisung am Handy & Tablet", inhalt: `<p class="hinweis">Link wird vorbereitet …</p>` });
  let erg;
  try{ erg = await apiSend("POST", "/rest/v1/rpc/terminal_link_teilen", { p_kunde_slug: AS.kunde, p_neu: !!neu }); }
  catch(e){ dlg.querySelector(".dlg-inhalt").innerHTML = `<p class="hinweis">Link konnte nicht erzeugt werden: ${esc(e.message || e)}</p>`; return; }
  AS_UW.mobil = { an: !!erg.an, bis: erg.bis };
  const url = new URL("../portal/kiosk.html", location.href).href + "#t=" + encodeURIComponent(erg.token);
  let svg = "";
  try{ if(await asUwQrLib()){ const qq = qrcode(0, "M"); qq.addData(url); qq.make(); svg = qq.createSvgTag({ cellSize: 6, margin: 4, scalable: true }); } }catch(e){ svg = ""; }
  const zeichnen = () => {
    const an = !!(AS_UW.mobil && AS_UW.mobil.an);
    dlg.querySelector(".dlg-inhalt").innerHTML = `<p class="hinweis">Link aktivieren und QR-Code scannen lassen – das Terminal öffnet sich, ohne Login. Mehrere Beschäftigte können gleichzeitig unterweisen, alle Nachweise landen hier. Danach wieder ausschalten; um 23:59 Uhr geht er von selbst aus.</p>
      <div style="max-width:260px;margin:10px auto;${an ? "" : "opacity:.25;filter:grayscale(1)"}">${svg || '<p class="hinweis">QR-Code nicht verfügbar – bitte den Link kopieren.</p>'}</div>
      <p style="text-align:center"><button class="btn ${an ? "" : "sek"}" id="uwMobilSch">${esc(asUwMobilText(AS_UW.mobil))}${an ? " – ausschalten" : ""}</button></p>
      <div class="form"><label class="voll">Link<input type="text" readonly id="uwTeilenUrl" value="${esc(url)}"></label></div>
      <p class="reihe" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sek klein" id="uwKopie">Link kopieren</button>
        <button class="btn sek klein" id="uwSperren">Link sperren und neu erzeugen</button></p>
      <p class="hinweis" id="uwTeilenMsg">${neu ? "Neuer Link erzeugt – der alte ist gesperrt. Bitte neu scannen." : ""}</p>`;
    dlg.querySelector("#uwMobilSch").onclick = async ev => { ev.currentTarget.disabled = true;
      try{ AS_UW.mobil = await apiSend("POST", "/rest/v1/rpc/terminal_mobil_schalten", { p_kunde_slug: AS.kunde, p_an: !an }); neu = false; zeichnen(); asUwMobilStatus(); }
      catch(e){ asMeldung("Konnte nicht umgeschaltet werden: " + (e.message || e)); ev.currentTarget.disabled = false; } };
    dlg.querySelector("#uwKopie").onclick = async () => { const f = dlg.querySelector("#uwTeilenUrl"); f.select();
      try{ await navigator.clipboard.writeText(url); }catch(e){ try{ document.execCommand("copy"); }catch(e2){} }
      dlg.querySelector("#uwTeilenMsg").textContent = "Link kopiert."; };
    dlg.querySelector("#uwSperren").onclick = () => { if(confirm("Link wirklich sperren? Wer den alten QR-Code gespeichert hat, kommt nicht mehr hinein – bitte danach neu scannen lassen.")) asUwTeilen(true); };
  };
  zeichnen(); asUwMobilStatus();
}

/* ---- Einstellungen: Module je Rolle (RPC unterweisung_zuordnung_lesen/_speichern, neue freigegebene Fassung) ---- */
async function asUwEinstellungen(){
  const dlg = asDialog({ titel: "Einstellungen · Module je Rolle", breit: true, inhalt: `<p class="hinweis">wird geladen …</p>` });
  let cfg;
  try{ cfg = await apiSend("POST", "/rest/v1/rpc/unterweisung_zuordnung_lesen", { p_kunde_slug: AS.kunde }); }
  catch(e){ dlg.querySelector(".dlg-inhalt").innerHTML = `<p class="hinweis">Konnte nicht geladen werden: ${esc(e.message || e)}</p>`; return; }
  if(!cfg || !Array.isArray(cfg.roles) || !(cfg.modules || []).length){
    dlg.querySelector(".dlg-inhalt").innerHTML = `<p class="hinweis">Für diesen Betrieb ist das Terminal noch nicht eingerichtet.</p>`; return; }
  const module = cfg.modules, rollen = cfg.roles.map(r => ({ name: r.name, extern: !!r.extern, modules: (r.modules || []).slice() }));
  const uebernehmen = () => rollen.forEach((r, i) => { r.modules = module.map(m => m.id).filter(id => {
    const cb = dlg.querySelector(`input[data-r="${i}"][data-m="${CSS.escape(id)}"]`); return cb ? cb.checked : r.modules.includes(id); }); });
  const zeichnen = (hinweis) => {
    asDialog({ titel: "Einstellungen · Module je Rolle", breit: true, inhalt: `<p class="hinweis">Haken setzen: Diese Module bekommt die Rolle am Terminal. Gilt ab dem nächsten Start des Terminals.</p>
      <div class="tabwrap"><table class="tab"><tr><th>Rolle</th>${module.map(m => `<th>${esc(m.title)}</th>`).join("")}<th></th></tr>
        ${rollen.map((r, i) => `<tr><td><b>${esc(r.name)}</b>${r.extern ? ' <span class="hinweis">(Externe)</span>' : ""}</td>${module.map(m =>
          `<td style="text-align:center"><input type="checkbox" data-r="${i}" data-m="${esc(m.id)}"${r.modules.includes(m.id) ? " checked" : ""} aria-label="${esc(r.name)}: ${esc(m.title)}"></td>`).join("")}
          <td>${r.extern ? "" : `<button class="btn sek klein" data-weg="${i}">entfernen</button>`}</td></tr>`).join("")}</table></div>
      <div class="form"><label>Neue Rolle<input type="text" id="uwEinstNeu" placeholder="z. B. Qualitätssicherung" maxlength="60" autocomplete="off"></label>
        <button class="btn sek" id="uwEinstNeuK" style="align-self:end">Rolle anlegen</button></div>
      <p class="hinweis">${esc(hinweis || "")}</p>
      <p class="hinweis">Fassung ${esc(cfg.version)}${cfg.freigegeben_am ? " vom " + asDat(cfg.freigegeben_am) : ""}${cfg.freigegeben_von ? " · " + esc(cfg.freigegeben_von) : ""}</p>`,
      knoepfe: [{ t: "Abbrechen", klasse: "sek", fn: () => {} }, { t: "Speichern", fn: async () => {
        uebernehmen();
        const leer = rollen.filter(r => !r.modules.length).map(r => r.name);
        if(leer.length && !confirm("Ohne Modul: " + leer.join(", ") + ". Trotzdem speichern?")) return false;
        const v = await apiSend("POST", "/rest/v1/rpc/unterweisung_zuordnung_speichern",
          { p_kunde_slug: AS.kunde, p_rollen: rollen.map(r => ({ name: r.name, modules: r.modules })), p_version: cfg.version });
        asMeldung("Einstellungen gespeichert (Fassung " + v + "). Das Terminal übernimmt sie beim nächsten Start.");
      } }] });
    dlg.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { const i = +b.dataset.weg;
      if(!confirm("Rolle „" + rollen[i].name + "“ entfernen? Sie steht dann am Terminal nicht mehr zur Auswahl.")) return;
      uebernehmen(); rollen.splice(i, 1); zeichnen(); });
    const neu = () => { const f = dlg.querySelector("#uwEinstNeu"), name = f.value.trim();
      if(name.length < 2){ asMeldung("Bitte einen Namen für die Rolle eintragen."); return; }
      if(rollen.some(r => r.name.toLowerCase() === name.toLowerCase())){ asMeldung("Diese Rolle gibt es schon."); return; }
      uebernehmen(); rollen.splice(rollen.filter(r => !r.extern).length, 0, { name, extern: false, modules: [] });
      zeichnen("Rolle angelegt – jetzt die Module ankreuzen und speichern."); };
    dlg.querySelector("#uwEinstNeuK").onclick = neu;
    dlg.querySelector("#uwEinstNeu").onkeydown = e => { if(e.key === "Enter"){ e.preventDefault(); neu(); } };
  };
  zeichnen();
}

/* ======================= 2. Nachweise ======================= */
function asUwCsv(rows){
  const kopf = ["Datum", "Name", "Rolle", "Module", "bestanden", "bestätigt", "gültig bis", "Fassung", "praktische Einarbeitung"];
  const zeilen = rows.map(n => [asDat(n.created_at), n.mitarbeiter_name || "", n.funktion || "", asUwModule(n).join(" | "),
    n.bestanden ? "ja" : "nein", n.bestaetigung ? "ja" : "nein", asUwBis(n), n.config_version || "",
    (e => e ? asDat(e.am) + " (" + e.bestaetigt_von + ")" : "")(asUwEinarb(n.mitarbeiter_name))]);
  return [kopf, ...zeilen].map(z => z.map(w => `"${String(w).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
function asUwExport(rows){
  if(!rows.length) return;
  const blob = new Blob(["﻿" + asUwCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "Unterweisungsnachweise_" + AS.kunde + "_" + asHeute() + ".csv";
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function asUwNachweise(box){
  const f = AS_UW.nf, alle = AS_UW.d.nachweise;
  const jahre = [...new Set(alle.map(n => String(n.created_at || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const sicht = alle.filter(n => (!f.q || (n.mitarbeiter_name + " " + (n.funktion || "") + " " + asUwModule(n).join(" ")).toLowerCase().includes(f.q.toLowerCase()))
    && (!f.jahr || String(n.created_at).startsWith(f.jahr)) && (!f.best || (f.best === "ja") === !!n.bestanden));
  box.innerHTML = `<div class="karte"><h2>${sicht.length} von ${alle.length} Nachweisen <span>${asDarf("pflegen") ? `<button class="btn sek klein" id="uwNachtrag">+ Nachweis nachtragen</button> ` : ""}${sicht.length ? `<button class="btn sek klein" id="uwCsvN">Excel-Export</button>` : ""}</span></h2>
    <div class="filterleiste">
      <input type="search" id="uwnQ" value="${esc(f.q)}" placeholder="Suchen (Name, Rolle, Modul)" autocomplete="off">
      ${asFilterWahl('data-f="jahr"', f.jahr, [["", "alle"]].concat(jahre), "Jahr")}
      ${asFilterWahl('data-f="best"', f.best, [["", "alle"], ["ja", "bestanden"], ["nein", "nicht bestanden"]], "Verständnisfragen")}</div>
    ${sicht.length ? `<div class="tabwrap"><table class="tab"><tr><th>Datum</th><th>Name</th><th>Gerät</th><th>Rolle</th><th>Module</th><th>bestanden</th><th>Stand</th><th>Fassung</th><th></th></tr>
      ${sicht.map(n => { const st = asUwStatus(n); return `<tr class="${asDarf("pflegen") ? "bda-klick" : ""}" data-nwname="${esc(n.id)}" title="${esc(n.geraet || "")}"><td>${asDat(n.created_at)}</td><td><b>${esc(n.mitarbeiter_name || "")}</b></td><td>${esc(asUwGeraet(n))}</td>
        <td>${esc(n.funktion || "—")}${n.bereich ? `<br><small class="hinweis">${esc(n.bereich)}</small>` : ""}</td><td>${asUwModule(n).map(esc).join("<br>") || "—"}</td>
        <td>${n.bestanden ? asChip("ja", "gruen") : asChip("nein", "rot")}${n.bestaetigung ? "" : " " + asChip("nicht bestätigt", "gelb")}</td>
        <td>${asChip(st.text, AS_UW_FARBE[st.klasse])}</td><td>${esc(n.config_version || "")}</td>
        <td><button class="btn sek klein" data-pdf="${esc(n.id)}">Nachweis (PDF)</button></td></tr>`; }).join("")}</table></div>`
      : `<div class="leer">Keine Nachweise${f.q || f.jahr || f.best ? " zum Filter" : ""}.</div>`}
    <p class="hinweis">Gespeichert sind Name, Rolle, Datum, Module und bestanden ja/nein – bewusst ohne Punktestand. Die Unterschrift wird erst beim PDF geladen.</p></div>`;
  const q = box.querySelector("#uwnQ");
  q.oninput = () => { f.q = q.value; clearTimeout(AS_UW.nt); AS_UW.nt = setTimeout(() => { asUwNachweise(box); const n = box.querySelector("#uwnQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
  box.querySelectorAll("select[data-f]").forEach(s => s.onchange = () => { f[s.dataset.f] = s.value; asUwNachweise(box); });
  if(box.querySelector("#uwCsvN")) box.querySelector("#uwCsvN").onclick = () => asUwExport(sicht);
  /* Nachweis von Hand: Unterweisung auf Papier, in der Schulung oder verlorener Terminal-Nachweis */
  if(box.querySelector("#uwNachtrag")) box.querySelector("#uwNachtrag").onclick = () => {
    const heute = asHeute(), gruppen = (AS_UW.d.rollen || []).map(r => r.name);
    asDialog({ titel: "Nachweis nachtragen", inhalt: `<div class="form">
        ${asFeld("Vor- und Nachname", "mitarbeiter_name", "")}
        <label>Gruppe<select data-f="funktion"><option value="">– wählen –</option>${gruppen.map(g => `<option>${esc(g)}</option>`).join("")}</select></label>
        ${asFeld("Arbeitgeber / Bereich", "bereich", "")}
        ${asFeld("Unterwiesen am", "datum", heute, "date")}
        ${asFeld("Inhalte (Module, mit Komma getrennt)", "inhalt", "")}
        ${asFeld("Vermerk", "vermerk", "")}</div>`,
      knoepfe: [{ t: "Nachweis eintragen", fn: async d => { const w = asWerte(d);
        const name = String(w.mitarbeiter_name || "").trim().replace(/\s+/g, " ");
        if(name.length < 3){ asMeldung("Bitte den vollständigen Namen eintragen."); return false; }
        const module = String(w.inhalt || "").split(/\s*,\s*/).filter(Boolean);
        if(!module.length){ asMeldung("Bitte die Inhalte angeben."); return false; }
        await apiSend("POST", "/rest/v1/unterweisungsnachweise", { kunde_slug: AS.kunde,
          mitarbeiter_name: name.split(" ").map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(" "),
          funktion: w.funktion || null, bereich: w.bereich || null, module, unterweisung: module.join(", "),
          bestanden: true, bestaetigung: true, quelle: "nachtrag", geraet: "Nachtrag", bestaetigt_von: AS.ichName || AS.ich || "",
          nachfrage: "Nachgetragen am " + new Date().toLocaleDateString("de-DE") + (w.vermerk ? ": " + w.vermerk : "."),
          created_at: new Date((w.datum || heute) + "T12:00:00").toISOString() }, "return=minimal");
        asMeldung("Nachweis eingetragen"); await asUwLaden(true); asZeige(); } }] });
  };
  box.querySelectorAll("[data-pdf]").forEach(x => x.onclick = ev => { ev.stopPropagation(); asUwPdf(x.dataset.pdf); });
  /* Klick auf den Eintrag: Name korrigieren (z. B. Nachname nachtragen) – pflegeberechtigte Betriebskonten und OAK */
  if(asDarf("pflegen")) box.querySelectorAll("tr[data-nwname]").forEach(z => z.onclick = ev => { if(ev.target.closest("button")) return;
    const n = AS_UW.d.nachweise.find(x => x.id === z.dataset.nwname); if(!n) return;
    asDialog({ titel: "Nachweis – Name", inhalt: `<div class="form">${asFeld("Vollständiger Name", "mitarbeiter_name", n.mitarbeiter_name || "")}</div>
      <p class="hinweis">${esc(asDat(n.created_at))} · ${esc(asUwModule(n).join(", "))} · ${esc(n.geraet || asUwGeraet(n))}</p>`,
      knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d); const name = String(w.mitarbeiter_name || "").trim().replace(/\s+/g, " ");
        if(name.length < 3){ asMeldung("Bitte den vollständigen Namen eintragen."); return false; }
        const gross = name.split(" ").map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(" ");
        await apiSend("PATCH", "/rest/v1/unterweisungsnachweise?id=eq." + encodeURIComponent(n.id), { mitarbeiter_name: gross }, "return=minimal");
        n.mitarbeiter_name = gross; asMeldung("Name gespeichert"); asUwNachweise(box); } }] });
  });
}

/* Nachweis als PDF: Druckansicht im Layout des Betriebs mit Unterschrift aus dem Terminal */
async function asUwPdf(id){
  const n = AS_UW.d.nachweise.find(x => x.id === id); if(!n) return;
  const w = window.open("", "_blank");
  if(!w){ asMeldung("Bitte Pop-up-Fenster für die App erlauben."); return; }
  w.document.write('<p style="font-family:sans-serif;padding:20px">Nachweis wird geladen …</p>');
  let voll = {};
  try{ const r = await apiGet("/rest/v1/unterweisungsnachweise?select=unterschrift,nachfrage,praxis_von,praxis_am,bestaetigt_von,bestaetigt_unterschrift&id=eq." + encodeURIComponent(id)); voll = (r && r[0]) || {}; }catch(e){}
  const bsig = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(voll.bestaetigt_unterschrift || "") ? voll.bestaetigt_unterschrift : "";
  const m = (AS.kundeV1 && AS.kundeV1.marke) || {};
  const farbe = /^#[0-9a-fA-F]{3,8}$/.test(m.farbe || "") ? m.farbe : "#2D6A4F";
  const logo = typeof m.logo === "string" && /^(marken\/[\w.-]+|https:\/\/[\w./%-]+)$/.test(m.logo)
    ? new URL(/^https:/.test(m.logo) ? m.logo : "../portal/" + m.logo, location.href).href : new URL("../assets/oak-logo.png", location.href).href;
  const kunde = (AS.org && AS.org.name) || (AS.kundeV1 && AS.kundeV1.name) || n.kunde_slug || "";
  const sig = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(voll.unterschrift || "") ? voll.unterschrift : "";
  const dd = new Date(n.created_at);
  const wann = dd.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + ", " + dd.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  const module = asUwModule(n);
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Unterweisungsnachweis ${esc(n.mitarbeiter_name || "")} ${esc(asDat(n.created_at))}</title>
<style>@page{size:A4;margin:18mm 16mm}body{font-family:"Segoe UI",Arial,sans-serif;color:#1d2939;margin:0;font-size:12.5pt}
.kopf{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${farbe};padding-bottom:10px;margin-bottom:18px}
.kopf img{height:56px;max-width:220px;object-fit:contain}h1{font-size:20pt;margin:0;color:${farbe}}.unter{font-size:10pt;color:#667085;margin-top:2px}
table{width:100%;border-collapse:collapse;margin:0 0 16px}td{border:1px solid #d0d5dd;padding:8px 10px;vertical-align:top}td.k{width:34%;background:#f5f7fa;font-weight:600}
ul{margin:0;padding-left:18px}.ok{color:#1e7b34;font-weight:700}.nein{color:#b42318;font-weight:700}.sig{margin-top:26px;width:60%}
.sig img{max-width:100%;height:110px;object-fit:contain;display:block}.sig .linie{border-top:1px solid #1d2939;padding-top:4px;font-size:10pt;color:#344054}
.fuss{margin-top:28px;font-size:9pt;color:#667085;line-height:1.5}</style></head><body onload="setTimeout(function(){window.print()},400)">
<div class="kopf"><div><h1>Nachweis über die Unterweisung</h1><div class="unter">${esc(kunde)}</div></div><img src="${esc(logo)}" alt=""></div>
<table><tr><td class="k">Name</td><td>${esc(n.mitarbeiter_name || "—")}</td></tr>
<tr><td class="k">Rolle / Tätigkeit</td><td>${esc(n.funktion || "—")}</td></tr>
${n.bereich ? `<tr><td class="k">Bereich</td><td>${esc(n.bereich)}</td></tr>` : ""}
<tr><td class="k">Datum und Uhrzeit</td><td>${esc(wann)}</td></tr>
<tr><td class="k">Unterweisungsinhalte</td><td>${module.length ? "<ul>" + module.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "—"}</td></tr>
<tr><td class="k">Verständnisfragen</td><td>${n.bestanden ? '<span class="ok">bestanden</span>' : '<span class="nein">nicht bestanden</span>'}</td></tr>
<tr><td class="k">Bestätigung</td><td>${n.bestaetigung ? "Die unterwiesene Person hat bestätigt, die Inhalte verstanden zu haben und sie zu beachten." : "nicht bestätigt"}</td></tr>
<tr><td class="k">Durchgeführt an</td><td>${esc(n.geraet || asUwGeraet(n))}</td></tr>
${voll.nachfrage ? `<tr><td class="k">${n.quelle === "nachtrag" ? "Vermerk" : "Rückfrage"}</td><td>${esc(voll.nachfrage)}</td></tr>` : ""}
${voll.praxis_von ? `<tr><td class="k">Praktische Unterweisung</td><td>${esc(voll.praxis_von)}${voll.praxis_am ? " am " + esc(asDat(voll.praxis_am)) : ""}</td></tr>` : ""}</table>
<div class="sig">${sig ? `<img src="${sig}" alt="Unterschrift">` : '<div style="height:110px"></div>'}<div class="linie">Unterschrift der unterwiesenen Person${sig ? " (elektronisch am Terminal geleistet)" : ""}</div></div>
${voll.bestaetigt_von ? `<div class="sig">${bsig ? `<img src="${bsig}" alt="Bestätigung">` : '<div style="height:110px"></div>'}<div class="linie">${esc(voll.bestaetigt_von)} (Nachtrag zur Unterweisung)</div></div>` : ""}
<div class="fuss">Rechtsgrundlage: § 12 Arbeitsschutzgesetz, § 4 DGUV Vorschrift 1 (Unterweisung vor Aufnahme der Tätigkeit und mindestens einmal jährlich).<br>
Erfasst am Unterweisungs-Terminal, gespeichert im OAK EHS-Cockpit${n.config_version ? " · Fassung " + esc(n.config_version) : ""} · Druck am ${esc(new Date().toLocaleDateString("de-DE"))}.</div></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}

/* ======================= 3. Module (Katalog, am Terminal, Gruppen & eigene Inhalte) ======================= */
function asUwModuleSeite(box){
  if(AS_UW.detail && AS_UW.d.module.some(m => m.thema === AS_UW.detail)){ asUwModulDetail(box, AS_UW.detail); return; }
  AS_UW.detail = null;
  const d = AS_UW.d, gebucht = d.module.filter(m => asUwGebucht(m.thema)), gesperrt = d.module.filter(m => !asUwGebucht(m.thema));
  const zeile = (m, frei) => {
    const b = d.buchung.find(x => x.thema === m.thema), dok = frei ? asUwDokument(m.thema) : null;
    const n = asUwZusaetze(m.thema).length, g = asUwGruppenVon(m.thema).length;
    const eck = [m.dauer_min ? "ca. " + m.dauer_min + " Min." : "Dauer offen", "alle " + m.turnus_monate + " Monate", AS_UW_STAND[m.stand] || m.stand];
    const mehr = m.beschreibung || (m.rechtsbezug && m.rechtsbezug.length) || (frei && b && b.gebucht_am);
    return `<div class="z" style="${frei ? "" : "opacity:.75"}"><div style="flex:1"><b>${esc(m.titel)}</b>${m.untertitel ? ` <span class="hinweis">${esc(m.untertitel)}</span>` : ""}
        <small>${eck.map(esc).join(" · ")}${m.praktischer_anteil ? " · praktischer Anteil nötig" : ""}</small>
        <div class="reihe" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${frei ? (dok ? `<button class="btn klein" data-dok="${esc(asUwViewer(dok, m.titel))}" data-titel="${esc(m.titel)}">Starten</button>` : `<span class="hinweis">Inhalt folgt</span>`) : ""}
          ${frei ? `<button class="btn sek klein" data-detail="${esc(m.thema)}">Gruppen &amp; Inhalte${g || n ? ` (${g}/${n})` : ""}</button>` : ""}
          ${AS.admin ? `<button class="btn adm klein" data-buchen="${esc(m.thema)}" data-frei="${frei ? 1 : 0}">${frei ? "Sperren" : "Freischalten"}</button>
            <button class="btn adm klein" data-dok="${esc("editor.html?thema=" + encodeURIComponent(m.thema))}" data-titel="Bearbeiten · ${esc(m.titel)}">Bearbeiten</button>` : ""}</div>
        ${mehr ? `<details style="margin-top:6px"><summary class="hinweis">Beschreibung &amp; Rechtsbezug</summary>
          ${m.beschreibung ? `<p>${esc(m.beschreibung)}</p>` : ""}${m.rechtsbezug && m.rechtsbezug.length ? `<p class="hinweis">${m.rechtsbezug.map(esc).join(" · ")}</p>` : ""}
          ${frei && b && b.gebucht_am ? `<p class="hinweis">freigeschaltet am ${asDat(b.gebucht_am)}</p>` : ""}</details>` : ""}</div>
      ${frei ? asChip("freigeschaltet", "gruen") : asChip("nicht gebucht", "grau")}</div>`;
  };
  /* Was am Terminal läuft: je gebuchtem Modul Version 1.0 / 2.0 (uw_buchung.fassung) */
  const docs = d.docs.filter(x => x.kategorie === "unterweisungen"), base = r => String(r.storage_path || "").split("/").pop();
  const titel = th => (d.module.find(m => m.thema === th) || {}).titel || th, reihe = th => (d.module.find(m => m.thema === th) || {}).reihenfolge || 99;
  const benutzt = new Set();
  const oeffnen = (dok, t) => { if(!dok) return '<span class="hinweis">—</span>'; benutzt.add(dok);
    return `<button class="btn sek klein" data-dok="${esc(asUwViewer(dok, t))}" data-titel="${esc(t)}">Öffnen</button>`
      + (asDarf("oak") ? ` <button class="btn adm klein" data-text="${esc(dok.storage_path)}" data-titel="${esc(t)}">Text ändern</button>` : ""); };   // vorerst nur OAK: alle Beschäftigten bekommen 100 % denselben Inhalt (Nik 05.11.2026)
  const aktiv = d.buchung.filter(x => x.aktiv).sort((x, y) => reihe(x.thema) - reihe(y.thema));
  const archiv = aktiv.map(bu => {
    const d1 = bu.datei_v1 ? docs.find(r => base(r) === bu.datei_v1) : null, d2 = docs.find(r => base(r) === bu.thema + ".html"), f = bu.fassung === 2 ? 2 : 1;
    const wahl = AS.admin ? `<span class="seg">${[1, 2].map(v => `<button class="${f === v ? "an" : ""}" data-fassung="${v}" data-thema="${esc(bu.thema)}"${(v === 1 ? d1 : d2) ? "" : " disabled"}>${v}.0</button>`).join("")}</span>`
      : asChip("Version " + f + ".0", "gruen");
    return `<tr><td><b>${esc(titel(bu.thema))}</b></td><td>${oeffnen(d1, titel(bu.thema) + " · Version 1.0")}</td><td>${oeffnen(d2, titel(bu.thema) + " · Version 2.0")}</td><td>${wahl}</td></tr>`;
  }).join("");
  const weitere = docs.filter(x => !benutzt.has(x));

  box.innerHTML = `<div class="karte"><h2>Modulkatalog <span class="hinweis">${gebucht.length} freigeschaltet · ${gesperrt.length} verfügbar</span></h2>
      ${gebucht.length ? `<h3>Für diesen Betrieb freigeschaltet</h3><div class="zeilen">${gebucht.map(m => zeile(m, true)).join("")}</div>` : ""}
      ${gesperrt.length ? `<h3>Weitere Module von OAK engineering</h3><div class="zeilen">${gesperrt.map(m => zeile(m, false)).join("")}</div>` : ""}
      <p class="hinweis">Der Katalog zeigt das vollständige Angebot. Fachlicher Inhalt und Rechtsbezug kommen von OAK engineering und werden zentral aktuell gehalten; Auswahl, eigene Ergänzungen und Medien liegen beim Betrieb. Zum Freischalten weiterer Module sprechen Sie uns an.</p></div>
    <div class="karte"><h2>Was am Terminal läuft <span class="hinweis">${AS.admin ? "Auswahl = läuft am Terminal, sofort wirksam" : "hervorgehoben = läuft am Terminal"}</span></h2>
      <div class="tabwrap"><table class="tab"><tr><th>Thema</th><th>Version 1.0</th><th>Version 2.0</th><th>Am Terminal</th></tr>
        ${archiv || '<tr><td colspan="4" class="hinweis">Noch keine Module freigeschaltet.</td></tr>'}</table></div>
      ${weitere.length ? `<h3>Weitere Unterlagen</h3><div class="zeilen">${weitere.map(x => `<div class="z"><div><b>${esc(x.titel || base(x))}</b><small>${esc(x.stand || "")}</small></div>
        <button class="btn sek klein" data-dok="${esc(asUwViewer(x, x.titel))}" data-titel="${esc(x.titel || "")}">Öffnen</button></div>`).join("")}</div>` : ""}</div>`;

  box.querySelectorAll("[data-dok]").forEach(b => b.onclick = () => asDokOeffnen(b.dataset.dok, b.dataset.titel));
  box.querySelectorAll("[data-detail]").forEach(b => b.onclick = () => { AS_UW.detail = b.dataset.detail; asZeige(); });
  box.querySelectorAll("[data-text]").forEach(b => b.onclick = () => asUwTextDialog(b.dataset.text, b.dataset.titel));
  box.querySelectorAll("[data-buchen]").forEach(b => b.onclick = async () => {
    const thema = b.dataset.buchen, frei = b.dataset.frei === "1"; b.disabled = true;
    try{
      if(frei) await apiSend("DELETE", "/rest/v1/uw_buchung?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&thema=eq." + encodeURIComponent(thema), null, "return=minimal");
      else await apiSend("POST", "/rest/v1/uw_buchung", { kunde_slug: AS.kunde, thema }, "return=minimal");
      await asUwNeu(titel(thema) + (frei ? " gesperrt." : " freigeschaltet."));
    }catch(e){ asMeldung("Nicht gespeichert: " + (e.message || e)); b.disabled = false; }
  });
  box.querySelectorAll("[data-fassung]").forEach(b => b.onclick = async () => {
    const th = b.dataset.thema, f = +b.dataset.fassung, bu = d.buchung.find(x => x.thema === th);
    if(!bu || (bu.fassung === 2 ? 2 : 1) === f) return;
    try{ await apiSend("PATCH", "/rest/v1/uw_buchung?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&thema=eq." + encodeURIComponent(th), { fassung: f }, "return=minimal");
      bu.fassung = f; asZeige(); asMeldung(titel(th) + " läuft am Terminal jetzt in Version " + f + ".0."); }
    catch(e){ asMeldung("Konnte nicht gespeichert werden: " + (e.message || e)); }
  });
}

function asUwModulDetail(box, thema){
  const d = AS_UW.d, m = d.module.find(x => x.thema === thema);
  const rollen = d.rollen.filter(r => r.status !== "archiviert"), gew = new Set(asUwGruppenVon(thema).map(z => z.rolle_id));
  const zus = asUwZusaetze(thema), pflegen = asUwDarfPflegen();
  box.innerHTML = `<p><button class="btn sek klein" id="uwZurueck">← Katalog</button></p>
    <div class="karte"><h2>${esc(m.titel)} <span class="hinweis">${esc(m.untertitel || "")}</span></h2>
      <h3>Für welche Gruppen gilt dieses Modul?</h3>
      ${rollen.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px 18px">${rollen.map(r => `<label><input type="checkbox" data-rolle="${esc(r.id)}"${gew.has(r.id) ? " checked" : ""}${pflegen ? "" : " disabled"}>
          <b>${esc(r.name)}</b> <span class="hinweis">${esc(AS_UW_TYP[r.typ] || r.typ)}</span></label>`).join("")}</div>`
        : `<div class="leer">Noch keine Nutzergruppen angelegt. Unter <b>Mitarbeiter</b> → Bereiche &amp; Rollen anlegen.</div>`}
      <p class="hinweis">Wer keiner Gruppe zugeordnet ist, bekommt das Modul nicht angezeigt. Mehrfachzuordnung ist gewollt – die Pflichten addieren sich.</p></div>
    <div class="karte"><h2>Eigene Inhalte des Betriebs <span class="hinweis">${zus.length} Stück</span>
        ${pflegen ? `<button class="btn klein" id="uwNeuM">Inhalt hinzufügen</button> <button class="btn sek klein" id="uwNeuV">Aus einem Vorfall erzeugen</button>` : ""}</h2>
      <div class="zeilen">${zus.map(z => `<div class="z"><div style="flex:1"><b>${esc(z.titel)}</b>
          <small style="white-space:pre-wrap">${esc(z.text)}</small>
          ${pflegen ? `<div class="reihe" style="display:flex;gap:6px;margin-top:6px"><button class="btn sek klein" data-zfrei="${esc(z.id)}">${z.status === "freigegeben" ? "Zurückziehen" : "Freigeben"}</button>
            <button class="btn sek klein" data-zweg="${esc(z.id)}">Entfernen</button></div>` : ""}</div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${asChip(z.status === "freigegeben" ? "in der Unterweisung" : "Entwurf", z.status === "freigegeben" ? "gruen" : "gelb")}
          ${z.quelle === "vorfall" ? asChip("aus Vorfall", "grau") : ""}${z.neuunterweisung ? asChip("Neuunterweisung nötig", "rot") : ""}</div></div>`).join("")
        || `<div class="leer">Noch keine eigenen Inhalte. Hier kommt hinein, was nur in diesem Betrieb gilt – oder was aus einem Vorfall gelernt wurde.</div>`}</div>
      <p class="hinweis">Eigene Inhalte erscheinen am Ende des Moduls, vor dem Selbsttest. Freigegebene Inhalte sind Teil der Unterweisung und stehen im Nachweis; Entwürfe sieht nur der Betrieb. Ob eine Änderung eine <b>Neuunterweisung</b> auslöst, entscheidet der Betrieb – deshalb die Frage beim Freigeben.</p></div>`;
  box.querySelector("#uwZurueck").onclick = () => { AS_UW.detail = null; asZeige(); };
  box.querySelectorAll("[data-rolle]").forEach(cb => cb.onchange = async () => {
    cb.disabled = true;
    try{
      if(cb.checked) await apiSend("POST", "/rest/v1/uw_modul_zuweisung", { kunde_slug: AS.kunde, thema, rolle_id: cb.dataset.rolle, aktiv: true, geaendert_von: AS.ich || "Portal" },
        "resolution=merge-duplicates,return=minimal");
      else await apiSend("DELETE", "/rest/v1/uw_modul_zuweisung?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&thema=eq." + encodeURIComponent(thema)
        + "&rolle_id=eq." + encodeURIComponent(cb.dataset.rolle), null, "return=minimal");
      await asUwNeu();
    }catch(e){ asMeldung("Nicht gespeichert: " + (e.message || e)); cb.checked = !cb.checked; cb.disabled = false; }
  });
  box.querySelectorAll("[data-zfrei]").forEach(b => b.onclick = () => asUwZusatzFreigeben(zus.find(x => x.id === b.dataset.zfrei)));
  box.querySelectorAll("[data-zweg]").forEach(b => b.onclick = async () => {
    if(!confirm("Diesen Inhalt entfernen?")) return; b.disabled = true;
    try{ await apiSend("DELETE", "/rest/v1/uw_zusatz?id=eq." + encodeURIComponent(b.dataset.zweg), null, "return=minimal"); await asUwNeu("Inhalt entfernt."); }
    catch(e){ asMeldung("Nicht entfernt: " + (e.message || e)); b.disabled = false; }
  });
  const nm = box.querySelector("#uwNeuM"); if(nm) nm.onclick = () => asUwZusatzForm(thema, null);
  const nv = box.querySelector("#uwNeuV"); if(nv) nv.onclick = () => asUwVorfallWahl(thema);
}
function asUwZusatzFreigeben(z){
  if(z.status === "freigegeben"){
    apiSend("PATCH", "/rest/v1/uw_zusatz?id=eq." + encodeURIComponent(z.id), { status: "entwurf", neuunterweisung: false, freigegeben_am: null, freigegeben_von: null }, "return=minimal")
      .then(() => asUwNeu("Inhalt zurückgezogen.")).catch(e => asMeldung("Nicht gespeichert: " + (e.message || e)));
    return;
  }
  asDialog({ titel: "Inhalt freigeben", inhalt: `<p><b>${esc(z.titel)}</b></p><p>Löst dieser Inhalt eine Neuunterweisung aus?</p>
      <p class="hinweis">Ja = alle Betroffenen müssen die Unterweisung erneut durchlaufen. Nein = der Inhalt läuft in der nächsten regulären Unterweisung mit.</p>`,
    knoepfe: [{ t: "Nein, normal freigeben", klasse: "sek", fn: () => asUwZusatzSetzen(z, false) }, { t: "Ja, Neuunterweisung", fn: () => asUwZusatzSetzen(z, true) }] });
}
async function asUwZusatzSetzen(z, neuu){
  await apiSend("PATCH", "/rest/v1/uw_zusatz?id=eq." + encodeURIComponent(z.id),
    { status: "freigegeben", neuunterweisung: !!neuu, freigegeben_am: new Date().toISOString(), freigegeben_von: AS.ich || "Portal" }, "return=minimal");
  await asUwNeu("Inhalt freigegeben.");
}
function asUwZusatzForm(thema, vorlage){
  asDialog({ titel: "Eigener Inhalt", breit: true, inhalt: `<div class="form">
      ${asFeld("Überschrift des Inhalts", "titel", (vorlage && vorlage.titel) || "", "text", "voll")}
      ${asFeld("Was sollen die Beschäftigten daraus mitnehmen?", "text", (vorlage && vorlage.text) || "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async dlg => { const w = asWerte(dlg);
      if(!w.titel || !w.text){ asMeldung("Bitte Überschrift und Text eintragen."); return false; }
      await apiSend("POST", "/rest/v1/uw_zusatz", { kunde_slug: AS.kunde, thema, titel: w.titel, text: w.text, quelle: vorlage ? "vorfall" : "manuell",
        vorfall_id: vorlage ? vorlage.vorfall_id : null, angelegt_von: AS.ich || "Portal" }, "return=minimal");
      await asUwNeu("Inhalt gespeichert (Entwurf)."); } }] });
}
/* Aus einem gemeldeten Vorfall (portal_vorfaelle) wird ein Lernpunkt */
function asUwVorfallWahl(thema){
  const art = { unfall: "Unfall", beinahe: "Beinahe-Unfall", zustand: "Vorfall" };
  const offen = asT("as_meldung").filter(v => v._v1).sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || ""))).slice(0, 15);
  if(!offen.length){ asMeldung("Es sind keine Vorfälle gemeldet."); return; }
  asDialog({ titel: "Welcher Vorfall soll in die Unterweisung?", breit: true, inhalt: `<div class="zeilen">${offen.map((v, i) => `<div class="z" data-v="${i}" style="cursor:pointer"><div>
      <b>${asDat(v.datum)} · ${esc(art[v.art] || v.art)}</b><small>${esc(String(v.beschreibung || v.ort || "").slice(0, 120))}</small></div><span class="btn sek klein">wählen</span></div>`).join("")}</div>` });
  document.querySelectorAll("#dlg [data-v]").forEach(z => z.onclick = () => { const v = offen[+z.dataset.v];
    asUwZusatzForm(thema, { titel: (art[v.art] || "Vorfall") + " vom " + asDat(v.datum), text: String(v.beschreibung || "").trim() + (v.ort ? "\nOrt: " + v.ort : ""), vorfall_id: v.id }); });
}

/* Text in einem Modul ändern (vorerst nur OAK – einheitlicher Inhalt, Nik 05.11.2026): Suchen und Ersetzen in der Moduldatei, vorher Sicherung unter _versionen/ */
function asUwTextVarianten(s){
  const ent = { "ä": "&auml;", "ö": "&ouml;", "ü": "&uuml;", "Ä": "&Auml;", "Ö": "&Ouml;", "Ü": "&Uuml;", "ß": "&szlig;" };
  const uni = x => x.replace(/[^\x00-\x7f]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const html = x => x.replace(/[äöüÄÖÜß]/g, c => ent[c]);
  return [[s, x => x], [html(s), html], [uni(s), uni]];
}
async function asUwTextDialog(pfad, titel){
  if(!asDarf("oak")) return;
  const dlg = asDialog({ titel: "Text ändern", breit: true, inhalt: `<p><b>${esc(titel || "")}</b></p><div class="form">
      <label class="voll">Suchen<input type="text" id="uwtSuche" placeholder="Wort oder Satz genau wie in der Folie" autocomplete="off"></label>
      <div class="voll" id="uwtTreffer"><span class="hinweis">Modul wird geladen …</span></div>
      <label class="voll">Ersetzen durch<textarea id="uwtNeu" rows="3"></textarea></label></div>
      <p class="hinweis">Jede Stelle mit genau diesem Text wird ersetzt. Die bisherige Fassung wird vorher gesichert.</p>`,
    knoepfe: [{ t: "Ersetzen und speichern", fn: async () => {
      const neuText = dlg.querySelector("#uwtNeu").value;
      if(!wahl){ asMeldung("Erst einen Text suchen, der im Modul vorkommt."); return false; }
      if(!neuText.trim()){ asMeldung("Bitte den neuen Text eintragen."); return false; }
      if(!confirm(wahl.anzahl + " Stelle(n) ersetzen und speichern?")) return false;
      const teile = pfad.split("/"), datei = teile.pop();
      await asUwHochladen(teile.join("/") + "/_versionen/" + datei.replace(/\.html$/i, "") + "-" + Date.now() + ".html", html, "text/html;charset=utf-8");
      const neuHtml = html.split(wahl.v).join(wahl.kod(neuText));
      await asUwHochladen(pfad, neuHtml, "text/html;charset=utf-8");
      asMeldung(wahl.anzahl + " Stelle(n) geändert und gespeichert. Am Terminal ab dem nächsten Modulstart sichtbar.");
    } }] });
  const treffer = dlg.querySelector("#uwtTreffer");
  let html = "", wahl = null;
  try{ html = await apiGet(storagePfad(pfad), true); treffer.innerHTML = '<span class="hinweis">Suchbegriff eingeben.</span>'; }
  catch(e){ treffer.textContent = "Modul konnte nicht geladen werden: " + (e.message || e); return; }
  dlg.querySelector("#uwtSuche").oninput = () => {
    const q = dlg.querySelector("#uwtSuche").value; wahl = null; treffer.textContent = "";
    if(q.length < 3){ treffer.innerHTML = '<span class="hinweis">Mindestens 3 Zeichen.</span>'; return; }
    for(const [v, kod] of asUwTextVarianten(q)){
      const anzahl = html.split(v).length - 1;
      if(!anzahl) continue;
      wahl = { v, kod, anzahl };
      const kopf = document.createElement("div"); kopf.className = "hinweis"; kopf.textContent = anzahl + (anzahl === 1 ? " Stelle gefunden" : " Stellen gefunden") + " (DE und ggf. weitere Stellen im Modul):";
      treffer.appendChild(kopf);
      let pos = -1;
      for(let i = 0; i < Math.min(anzahl, 4); i++){
        pos = html.indexOf(v, pos + 1);
        const z = document.createElement("div"); z.style.cssText = "font-size:13px;margin:4px 0;padding:4px 8px;background:#f5f7fa;border-radius:6px";
        const vor = html.slice(Math.max(0, pos - 70), pos).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
        const nach = html.slice(pos + v.length, pos + v.length + 70).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
        const b = document.createElement("b"); b.textContent = q; z.append("… " + vor, b, nach + " …"); treffer.appendChild(z);
      }
      return;
    }
    treffer.innerHTML = '<span class="hinweis">Nicht gefunden – bitte den Text genau so eingeben, wie er in der Folie steht (kürzeren Ausschnitt versuchen).</span>';
  };
}

/* ======================= 4. Mitarbeiter (Personen & Fälligkeiten) ======================= */
function asUwMitarbeiter(box){
  const d = AS_UW.d, f = AS_UW.pf, pflegen = asUwDarfPflegen(), pe = AS_UW.pe, bearb = pflegen && pe.an;
  const einh = d.einheiten.filter(e => e.status === "aktiv");
  const offen = d.pers.filter(p => p.status === "aktiv").map(p => asUwPersStatus(p.id)).filter(s => s.status === "ueberfaellig" || s.status === "erstunterweisung").length;
  const q = f.suche.trim().toLowerCase();
  const rows = d.pers.filter(p => (!f.status || p.status === f.status) && (!f.einheit || (p.uw_person_einheit || []).some(x => x.einheit_id === f.einheit))
    && (!q || p.name.toLowerCase().includes(q)));
  pe.wahl = new Set([...pe.wahl].filter(id => d.pers.some(p => p.id === id)));
  const alle = rows.length > 0 && rows.every(p => pe.wahl.has(p.id)), n = pe.wahl.size;
  box.innerHTML = `<div class="karte"><h2>Personen &amp; Fälligkeiten <span class="hinweis">${d.pers.filter(p => p.status === "aktiv").length} aktiv${offen ? ` · <b>${offen} offen</b>` : ""}</span>
      ${pflegen ? `<button class="btn klein" id="uwpNeu">Person anlegen</button> <button class="btn sek klein" id="uwpOrg">Bereiche &amp; Rollen</button>
        <button class="btn sek klein" id="uwpListe">${bearb ? "Fertig" : "Liste bearbeiten"}</button>` : ""}</h2>
    <div class="filterleiste">
      <input type="search" id="uwpSuche" value="${esc(f.suche)}" placeholder="Person suchen …" autocomplete="off">
      ${asFilterWahl('data-f="einheit"', f.einheit, [["", "alle"]].concat(einh.map(e => [e.id, e.name + (e.kst_nr ? " (" + e.kst_nr + ")" : "")])), "Bereich")}
      ${asFilterWahl('data-f="status"', f.status, [["aktiv", "aktiv"], ["ruhend", "ruhend"], ["archiviert", "archiviert"], ["", "alle"]], "Status")}</div>
    ${rows.length ? `<div class="tabwrap"><table class="tab"><tr>${bearb ? `<th><label title="alle sichtbaren auswählen"><input type="checkbox" id="uwpAlle"${alle ? " checked" : ""}> alle</label></th>` : ""}<th>Name</th><th>Bereich</th><th>Rolle</th><th>Unterweisungen</th><th>nächste</th></tr>
      ${rows.map(p => { const st = asUwPersStatus(p.id), [farbe, txt] = AS_UW_FSTATUS[st.status] || ["grau", ""];
        const minderj = p.geburtsdatum && new Date(p.geburtsdatum) > new Date(Date.now() - 18 * 365.25 * 864e5);
        return `<tr${pflegen ? ` class="bda-klick" data-pers="${esc(p.id)}"` : ""}>${bearb ? `<td><input type="checkbox" data-wahl="${esc(p.id)}"${pe.wahl.has(p.id) ? " checked" : ""} aria-label="${esc(p.name)} auswählen"></td>` : ""}<td><b>${esc(p.name)}</b>${p.status !== "aktiv" ? " " + asChip(p.status, "grau") : ""}${minderj ? ` <span title="unter 18 – halbjährliche Unterweisung nach § 29 JArbSchG">${asChip("<18", "blau")}</span>` : ""}</td>
          <td>${esc((p.uw_person_einheit || []).map(x => asUwName(x.einheit_id, d.einheiten)).join(", ") || "—")}</td>
          <td>${esc((p.uw_person_rolle || []).map(x => asUwName(x.rolle_id, d.rollen)).join(", ") || "—")}</td>
          <td>${asChip(txt, farbe)}${st.gesamt ? ` <span class="hinweis">${st.gesamt - st.offen}/${st.gesamt}</span>` : ""}</td>
          <td>${asDat(st.naechste)}</td></tr>`; }).join("")}</table></div>`
      : `<div class="leer">Keine Personen — über „Person anlegen" beginnen.</div>`}
    <p class="hinweis">Personendaten sind auf das Nötige beschränkt. Das Geburtsdatum dient nur der halbjährlichen Unterweisung Minderjähriger (§ 29 JArbSchG). Ausgeschiedene werden archiviert, nie gelöscht — Nachweise müssen erhalten bleiben.</p>
    ${bearb ? `<div class="uwp-aktionsleiste"><span class="hinweis">${n} ausgewählt</span>
        ${[["archiv", "Ausgeschieden (archivieren)"], ["status", "Status setzen"], ["bereich", "Bereich zuordnen/entfernen"], ["rolle", "Rolle zuordnen/entfernen"]]
          .map(([k, t]) => `<button class="btn sek klein" data-pakt="${k}"${n ? "" : " disabled"}>${t}</button>`).join("")}</div>` : ""}</div>`;
  const s = box.querySelector("#uwpSuche");
  s.oninput = () => { f.suche = s.value; clearTimeout(AS_UW.pt); AS_UW.pt = setTimeout(() => { asUwMitarbeiter(box); const n = box.querySelector("#uwpSuche"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
  box.querySelectorAll("select[data-f]").forEach(x => x.onchange = () => { f[x.dataset.f] = x.value; asUwMitarbeiter(box); });
  if(box.querySelector("#uwpNeu")) box.querySelector("#uwpNeu").onclick = () => asUwPersonDialog(null);
  if(box.querySelector("#uwpOrg")) box.querySelector("#uwpOrg").onclick = asUwOrgDialog;
  if(box.querySelector("#uwpListe")) box.querySelector("#uwpListe").onclick = () => { pe.an = !pe.an; if(!pe.an) pe.wahl.clear(); asUwMitarbeiter(box); };
  /* Klick auf die Zeile: im Bearbeiten-Modus auswählen, sonst Dialog (OAK-UI-Regel 11) */
  box.querySelectorAll("tr[data-pers]").forEach(tr => tr.onclick = ev => {
    if(ev.target.closest("button, a, select") || (ev.target.closest("input") && !ev.target.closest("[data-wahl]"))) return;
    const id = tr.dataset.pers;
    if(!bearb){ asUwPersonDialog(d.pers.find(p => p.id === id)); return; }
    if(pe.wahl.has(id)) pe.wahl.delete(id); else pe.wahl.add(id);
    asUwMitarbeiter(box);
  });
  const al = box.querySelector("#uwpAlle");
  if(al) al.onclick = ev => { ev.stopPropagation(); rows.forEach(p => al.checked ? pe.wahl.add(p.id) : pe.wahl.delete(p.id)); asUwMitarbeiter(box); };
  box.querySelectorAll("[data-pakt]").forEach(b => b.onclick = () => asUwPersAktion(b.dataset.pakt));
}
/* Liste bearbeiten: eine Aktion für alle ausgewählten Personen. Nichts wird gelöscht – Nachweise bleiben erhalten.
   Verknüpfungen: uw_person_einheit PK (person_id, einheit_id), uw_person_rolle PK (person_id, rolle_id) – live gelesen 05.11.2026. */
function asUwPersAktion(art){
  const d = AS_UW.d, ids = [...AS_UW.pe.wahl].filter(id => d.pers.some(p => p.id === id)), n = ids.length;
  if(!n) return;
  const titel = { archiv: "Ausgeschieden (archivieren)", status: "Status setzen", bereich: "Bereich zuordnen/entfernen", rolle: "Rolle zuordnen/entfernen" }[art];
  const namen = ids.map(id => d.pers.find(p => p.id === id).name);
  const ziele = art === "bereich" ? d.einheiten.filter(e => e.status === "aktiv") : art === "rolle" ? d.rollen.filter(r => r.status !== "archiviert") : [];
  if((art === "bereich" || art === "rolle") && !ziele.length){ asMeldung(art === "bereich" ? "Noch keine Bereiche angelegt." : "Noch keine Rollen angelegt."); return; }
  let inhalt = `<p><b>${n} ${n === 1 ? "Person" : "Personen"}</b> ausgewählt: ${esc(namen.slice(0, 8).join(", "))}${n > 8 ? " und " + (n - 8) + " weitere" : ""}</p>`;
  if(art === "archiv") inhalt += `<p>Die ausgewählten Personen werden als ausgeschieden archiviert und erscheinen nicht mehr in den Fälligkeiten.</p>`;
  if(art === "status") inhalt += `<div class="form">${asAuswahl("Neuer Status", "status", "aktiv", [["aktiv", "aktiv"], ["ruhend", "ruhend (Elternzeit/Langzeitkrank)"], ["archiviert", "ausgeschieden (archiviert)"]], "voll")}</div>`;
  if(ziele.length) inhalt += `<div class="form">${asAuswahl(art === "bereich" ? "Bereich" : "Rolle", "ziel", ziele[0].id, ziele.map(x => [x.id, x.name]))}
    ${asAuswahl("Aktion", "wie", "dazu", [["dazu", "zuordnen"], ["weg", "entfernen"]])}</div>`;
  inhalt += `<p class="hinweis">Nachweise bleiben erhalten – es wird nichts gelöscht.</p>`;
  asDialog({ titel, inhalt, knoepfe: [{ t: "Abbrechen", klasse: "sek", fn: () => {} }, { t: "Ausführen (" + n + ")", fn: async dlg => {
    const w = asWerte(dlg), inn = "in.(" + ids.map(encodeURIComponent).join(",") + ")";
    let text = "";
    try{
      if(art === "archiv" || art === "status"){
        const status = art === "archiv" ? "archiviert" : w.status;
        const erg = await apiSend("PATCH", "/rest/v1/uw_person?id=" + inn + "&select=id", { status, geaendert_am: new Date().toISOString() }, "return=representation");
        const z = (erg || []).length;
        text = (z === n ? n : z + " von " + n) + (status === "archiviert" ? " archiviert. Nachweise bleiben erhalten." : " auf „" + status + "“ gesetzt.");
      } else {
        const tab = art === "bereich" ? "uw_person_einheit" : "uw_person_rolle", sp = art === "bereich" ? "einheit_id" : "rolle_id";
        const zname = (ziele.find(x => x.id === w.ziel) || {}).name || "";
        if(w.wie === "weg"){
          await apiSend("DELETE", "/rest/v1/" + tab + "?person_id=" + inn + "&" + sp + "=eq." + encodeURIComponent(w.ziel), null, "return=minimal");
          text = "„" + zname + "“ bei " + n + (n === 1 ? " Person" : " Personen") + " entfernt.";
        } else {
          await apiSend("POST", "/rest/v1/" + tab + "?on_conflict=person_id," + sp, ids.map(id => ({ person_id: id, [sp]: w.ziel })), "resolution=ignore-duplicates,return=minimal");
          text = "„" + zname + "“ " + n + (n === 1 ? " Person" : " Personen") + " zugeordnet.";
        }
      }
    }catch(e){ asUwFehler(titel, e, { personen: ids, art, ziel: w.ziel || w.status || null, wie: w.wie || null }); return false; }
    AS_UW.pe.wahl.clear();
    await asUwNeu(text);
  } }] });
}
function asUwPersonDialog(p){
  const d = AS_UW.d, einh = d.einheiten.filter(e => e.status === "aktiv"), roll = d.rollen.filter(r => r.status === "aktiv");
  const mE = new Set((p && p.uw_person_einheit || []).map(x => x.einheit_id)), mR = new Set((p && p.uw_person_rolle || []).map(x => x.rolle_id));
  const faellig = p ? d.faellig.filter(f => f.person_id === p.id).sort((a, b) => String(a.faellig_am).localeCompare(String(b.faellig_am))) : [];
  asDialog({ titel: p ? p.name : "Neue Person", breit: true, inhalt: `<div class="form">
      ${asFeld("Name", "name", p ? p.name : "", "text", "voll")}
      ${asAuswahl("Sprache", "sprache", p ? p.sprache : "de", [["de", "Deutsch"], ["en", "English"], ["tr", "Türkçe"]])}
      ${asFeld("Eintritt", "eintritt", p ? p.eintritt : "", "date")}
      ${asFeld("Geburtsdatum (nur für § 29 JArbSchG)", "geburtsdatum", p ? p.geburtsdatum : "", "date")}
      ${asAuswahl("Status", "status", p ? p.status : "aktiv", [["aktiv", "aktiv"], ["ruhend", "ruhend (Elternzeit/Langzeitkrank)"], ["archiviert", "ausgeschieden (archiviert)"]])}</div>
    <p><b>Bereiche</b></p><div style="display:flex;flex-wrap:wrap;gap:6px 16px">${einh.map(e => `<label><input type="checkbox" class="uwpE" value="${esc(e.id)}"${mE.has(e.id) ? " checked" : ""}> ${esc(e.name)}</label>`).join("") || '<span class="hinweis">Noch keine Bereiche angelegt.</span>'}</div>
    <p><b>Rollen</b> <span class="hinweis">(mehrere möglich – die Pflichten addieren sich)</span></p><div style="display:flex;flex-wrap:wrap;gap:6px 16px">${roll.map(r => `<label><input type="checkbox" class="uwpR" value="${esc(r.id)}"${mR.has(r.id) ? " checked" : ""}> ${esc(r.name)} <span class="hinweis">${esc(AS_UW_TYP[r.typ] || r.typ)}</span></label>`).join("") || '<span class="hinweis">Noch keine Rollen angelegt.</span>'}</div>
    ${p ? `<p><b>Zugewiesene Unterweisungen</b></p><div class="zeilen">${faellig.map(f => { const [farbe, txt] = AS_UW_FSTATUS[f.status] || ["grau", f.status];
        return `<div class="z"><div><b>${esc(f.kennung)}</b><small>${asDat(f.faellig_am)} · alle ${esc(f.turnus_monate)} Monate</small></div>${asChip(txt, farbe)}</div>`; }).join("")
      || '<div class="leer">Nichts zugewiesen — Rolle und Bereich setzen, dann greift die Matrix.</div>'}</div>` : ""}`,
    knoepfe: (p && p.status !== "archiviert" && asUwDarfPflegen() ? [{ t: "Ausgeschieden", klasse: "sek", fn: async () => {
      if(!confirm(p.name + " als ausgeschieden archivieren?\n\nNachweise bleiben erhalten – es wird nichts gelöscht.")) return false;
      try{ await apiSend("PATCH", "/rest/v1/uw_person?id=eq." + encodeURIComponent(p.id), { status: "archiviert", geaendert_am: new Date().toISOString() }, "return=minimal"); }
      catch(e){ asUwFehler("Ausgeschieden", e, { person: p.id }); return false; }
      await asUwNeu(p.name + " ist archiviert. Nachweise bleiben erhalten.");
    } }] : []).concat([{ t: "Speichern", fn: async dlg => {
      const w = asWerte(dlg);
      if(!w.name || w.name.length < 3){ asMeldung("Bitte den vollständigen Namen eintragen."); return false; }
      const satz = { kunde_slug: AS.kunde, name: w.name, sprache: w.sprache, eintritt: w.eintritt || null, geburtsdatum: w.geburtsdatum || null,
        status: w.status, geaendert_am: new Date().toISOString() };
      let id = p ? p.id : null;
      if(p) await apiSend("PATCH", "/rest/v1/uw_person?id=eq." + encodeURIComponent(p.id), satz, "return=minimal");
      else { const neu = await apiSend("POST", "/rest/v1/uw_person", satz, "return=representation"); id = Array.isArray(neu) ? neu[0].id : neu.id; }
      const eIds = [...dlg.querySelectorAll(".uwpE:checked")].map(x => x.value), rIds = [...dlg.querySelectorAll(".uwpR:checked")].map(x => x.value);
      await apiSend("DELETE", "/rest/v1/uw_person_einheit?person_id=eq." + encodeURIComponent(id), null, "return=minimal");
      await apiSend("DELETE", "/rest/v1/uw_person_rolle?person_id=eq." + encodeURIComponent(id), null, "return=minimal");
      if(eIds.length) await apiSend("POST", "/rest/v1/uw_person_einheit", eIds.map(x => ({ person_id: id, einheit_id: x })), "return=minimal");
      if(rIds.length) await apiSend("POST", "/rest/v1/uw_person_rolle", rIds.map(x => ({ person_id: id, rolle_id: x })), "return=minimal");
      await asUwNeu(w.name + " ist gespeichert.");
    } }]) });
}
function asUwOrgDialog(){
  const d = AS_UW.d;
  const dlg = asDialog({ titel: "Bereiche & Rollen", breit: true, inhalt: `<p class="hinweis">Bereiche sind Abteilungen oder Kostenstellen. Rollen beschreiben Tätigkeiten — der Typ entscheidet über die rechtliche Einordnung (Leiharbeit ist vom Entleiher zu unterweisen). Wer Personen zugeordnet hat, lässt sich nicht löschen, nur archivieren.</p>
    <h3>Bereiche</h3><div class="zeilen">${d.einheiten.map(e => `<div class="z"><div><b>${esc(e.name)}</b><small>${esc(e.kst_nr || "")}</small></div>
      ${e.status === "aktiv" ? `<button class="btn sek klein" data-earch="${esc(e.id)}">archivieren</button>` : asChip("archiviert", "grau")}</div>`).join("") || '<div class="leer">noch keiner</div>'}</div>
    <div class="form"><label>Name<input id="uwoEName" placeholder="z. B. Halle 1"></label><label>Kst-Nr. (optional)<input id="uwoEKst"></label><button class="btn sek" id="uwoENeu" style="align-self:end">anlegen</button></div>
    <h3>Rollen</h3><div class="zeilen">${d.rollen.map(r => `<div class="z" data-rbearb="${esc(r.id)}" title="Rolle ändern"><div><b>${esc(r.name)}</b><small>${esc(AS_UW_TYP[r.typ] || r.typ)}</small></div>
      <span><button class="btn sek klein" data-rbearb="${esc(r.id)}">ändern</button> ${r.status === "aktiv" ? `<button class="btn sek klein" data-rarch="${esc(r.id)}">archivieren</button>` : `<button class="btn sek klein" data-rreakt="${esc(r.id)}">reaktivieren</button>`}</span></div>`).join("") || '<div class="leer">noch keine</div>'}</div>
    <div class="form"><label>Name<input id="uwoRName" placeholder="z. B. Einrichter"></label>
      <label>Typ<select id="uwoRTyp">${Object.entries(AS_UW_TYP).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></label>
      <button class="btn sek" id="uwoRNeu" style="align-self:end">anlegen</button></div>` });
  /* Nach dem Speichern den Dialog nur dann neu aufbauen, wenn er noch offen ist – sonst springt er nach dem Neuladen
     ungefragt wieder auf und verdeckt die Seite (Abnahme K11/K12, 06.11.2026). */
  const nochOffen = () => dlg.open && !!dlg.querySelector("#uwoRNeu");
  const nach = async (fn, text) => { try{ await fn(); await asLaden(); await asUwNeu(text); if(nochOffen()) asUwOrgDialog(); }catch(e){ asMeldung("Fehler: " + (e.message || e)); } };
  dlg.querySelector("#uwoENeu").onclick = () => { const n = dlg.querySelector("#uwoEName").value.trim(); if(!n) return;
    nach(() => apiSend("POST", "/rest/v1/uw_einheit", { kunde_slug: AS.kunde, name: n, kst_nr: dlg.querySelector("#uwoEKst").value.trim() || null }, "return=minimal"), "Bereich angelegt."); };
  dlg.querySelector("#uwoRNeu").onclick = () => { const n = dlg.querySelector("#uwoRName").value.trim(); if(!n) return;
    nach(() => apiSend("POST", "/rest/v1/uw_rolle", { kunde_slug: AS.kunde, name: n, typ: dlg.querySelector("#uwoRTyp").value }, "return=minimal"), "Rolle angelegt."); };
  dlg.querySelectorAll("[data-earch]").forEach(b => b.onclick = () => { const e = d.einheiten.find(x => x.id === b.dataset.earch);   // ein Weg: mit Umhängen (as-organisation.js)
    if(e && typeof asEinheitStilllegen === "function") asEinheitStilllegen(e); });
  dlg.querySelectorAll("[data-rarch]").forEach(b => b.onclick = ev => { ev.stopPropagation(); nach(() => apiSend("PATCH", "/rest/v1/uw_rolle?id=eq." + encodeURIComponent(b.dataset.rarch), { status: "archiviert" }, "return=minimal"), "Rolle archiviert."); });
  dlg.querySelectorAll("[data-rreakt]").forEach(b => b.onclick = ev => { ev.stopPropagation(); nach(() => apiSend("PATCH", "/rest/v1/uw_rolle?id=eq." + encodeURIComponent(b.dataset.rreakt), { status: "aktiv" }, "return=minimal"), "Rolle wieder aktiv."); });
  /* Klick auf die Rolle = ändern (Name, Typ). Die DB zieht den neuen Namen in den Beurteilungen nach (Trigger uw_rolle_umbenannt). */
  dlg.querySelectorAll("[data-rbearb]").forEach(z => z.onclick = ev => { ev.stopPropagation(); const r = d.rollen.find(x => x.id === z.dataset.rbearb); if(r) asUwRolleDialog(r); });
}
function asUwRolleDialog(r){
  asDialog({ titel: "Rolle ändern", inhalt: `<div class="form">${asFeld("Name", "name", r.name, "text", "voll")}
      <label>Typ<select data-f="typ">${Object.entries(AS_UW_TYP).map(([v, t]) => `<option value="${v}"${v === r.typ ? " selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
    <p class="hinweis">Personen, Unterweisungs-Zuordnungen und Beurteilungen mit dieser Rolle behalten die Verknüpfung.</p>`,
    knoepfe: [{ t: "Speichern", fn: async dl => { const w = asWerte(dl), n = String(w.name || "").trim();
      if(!n){ asMeldung("Bitte einen Namen eintragen."); return false; }
      if(AS_UW.d.rollen.some(x => x.id !== r.id && x.name.trim().toLowerCase() === n.toLowerCase())){ asMeldung("Diese Rolle gibt es schon."); return false; }
      try{ await apiSend("PATCH", "/rest/v1/uw_rolle?id=eq." + encodeURIComponent(r.id), { name: n, typ: w.typ || r.typ }, "return=minimal");
        await asLaden(); await asUwNeu("Rolle gespeichert."); }
      catch(e){ asMeldung("Fehler: " + (e.message || e)); return false; }
      asUwOrgDialog(); return false; } }, { t: "Abbrechen", klasse: "sek", fn: () => { setTimeout(asUwOrgDialog, 0); return true; } }] });
}

/* ======================= 5. Inhalte (Kapitel) – Auswahl und Medien beim Kunden, Inhalt und Recht bei OAK ======================= */
function asUwAbgewaehlt(kennung){ const z = AS_UW.kap.zuw.filter(x => x.kennung === kennung); return z.length > 0 && z.every(x => !x.aktiv); }
function asUwThemaTitel(t){ return String(t).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function asUwInhalte(box){
  const K = AS_UW.kap, themen = [...new Set(K.kap.map(k => k.thema))].sort();
  if(!AS_UW.kapThema || !themen.includes(AS_UW.kapThema)) AS_UW.kapThema = themen[0] || null;
  box.innerHTML = `<div class="karte"><h2>Unterweisungs-Inhalte <span class="hinweis">${K.kap.length} Kapitel in ${themen.length} Themen</span>
      ${AS.admin ? `<button class="btn adm klein" data-dok="editor.html" data-titel="Unterweisung bearbeiten">Editor öffnen</button>` : ""}</h2>
    <p class="hinweis">${AS.admin ? "Als OAK bearbeitest du hier Text, Fragen und Rechtsbezug. Änderungen wirken bei allen Kunden, die dieses Kapitel verwenden."
      : "Sie können Kapitel für Ihren Betrieb ab- und anwählen und eigene Bilder einsetzen. Der Fachtext wird von OAK engineering gepflegt und ist deshalb schreibgeschützt."}</p>
    <div class="filterleiste">${asFilterWahl('data-f="thema"', AS_UW.kapThema || "", themen.map(t => [t, asUwThemaTitel(t)]), "Thema")}
      <input type="search" id="uwkSuche" placeholder="Kapitel suchen …" autocomplete="off"></div>
    <div id="uwkTab"></div></div>`;
  const tab = box.querySelector("#uwkTab");
  const zeichnen = () => {
    const q = box.querySelector("#uwkSuche").value.trim().toLowerCase();
    const rows = K.kap.filter(k => k.thema === AS_UW.kapThema && (!q || k.titel.toLowerCase().includes(q) || k.kennung.includes(q)));
    tab.innerHTML = rows.length ? `<div class="tabwrap"><table class="tab"><tr><th title="Für diesen Betrieb aktiv">aktiv</th><th>Kapitel</th><th>Rechtsbezug</th><th>Fassung</th><th>Bilder</th><th></th></tr>
      ${rows.map(k => { const aus = asUwAbgewaehlt(k.kennung), bilder = ((k.inhalt || {}).bilder || []).length;
        const eigen = K.medien.filter(m => m.kennung === k.kennung && m.kunde_slug === AS.kunde).length;
        return `<tr style="${aus ? "opacity:.55" : ""}"><td><input type="checkbox" data-an="${esc(k.kennung)}"${aus ? "" : " checked"}${asUwDarfPflegen() ? "" : " disabled"}></td>
          <td><b>${esc(k.titel)}</b><br><small class="hinweis">${esc(k.kennung)}</small></td>
          <td>${(k.rechtsbezug || []).length ? k.rechtsbezug.map(r => asChip(r, "blau")).join(" ") : asChip("fehlt", "gelb")}</td>
          <td>${esc(k.fassung)}</td><td>${bilder}${eigen ? ` <span class="hinweis">${eigen} eigen</span>` : ""}</td>
          <td><button class="btn sek klein" data-kap="${esc(k.kennung)}">${AS.admin ? "bearbeiten" : "ansehen"}</button></td></tr>`; }).join("")}</table></div>`
      : `<div class="leer">Keine Kapitel.</div>`;
    tab.querySelectorAll("[data-kap]").forEach(b => b.onclick = () => asUwKapitelDialog(K.kap.find(k => k.kennung === b.dataset.kap)));
    tab.querySelectorAll("[data-an]").forEach(cb => cb.onchange = async () => {
      const kennung = cb.dataset.an, an = cb.checked; cb.disabled = true;
      try{
        await apiSend("PATCH", "/rest/v1/uw_zuweisung?kennung=eq." + encodeURIComponent(kennung) + "&kunde_slug=eq." + encodeURIComponent(AS.kunde),
          { aktiv: an, quelle: "kunde", geaendert_am: new Date().toISOString(), geaendert_von: AS.ich || "Portal" }, "return=minimal");
        K.zuw.filter(z => z.kennung === kennung).forEach(z => z.aktiv = an);
        asMeldung(an ? "Kapitel für diesen Betrieb aktiv." : "Kapitel für diesen Betrieb abgewählt.");
      }catch(e){ asMeldung("Konnte nicht umgeschaltet werden: " + (e.message || e)); }
      zeichnen();
    });
  };
  box.querySelector("select[data-f]").onchange = e => { AS_UW.kapThema = e.target.value; zeichnen(); };
  box.querySelector("#uwkSuche").oninput = zeichnen;
  box.querySelectorAll("[data-dok]").forEach(b => b.onclick = () => asDokOeffnen(b.dataset.dok, b.dataset.titel));
  zeichnen();
}
function asUwTextZuAbsaetzen(text){ return text.split("\n").map(z => z.trim()).filter(Boolean).map(z => z.startsWith("- ") ? { md: z.slice(2).trim(), bu: true } : { md: z, bu: false }); }
function asUwTextZuFragen(text){
  const fragen = []; let akt = null;
  text.split("\n").map(z => z.trim()).filter(Boolean).forEach(z => {
    if(z.startsWith("?? ")){ akt = { frage: z.slice(3).trim(), optionen: [], richtig: 0 }; fragen.push(akt); return; }
    if(akt && z.startsWith("- ")){ let o = z.slice(2); if(o.endsWith("[richtig]")){ akt.richtig = akt.optionen.length; o = o.slice(0, -9).trim(); } akt.optionen.push(o); }
  });
  return fragen;
}
async function asUwKapitelDialog(k){
  if(!k) return;
  const K = AS_UW.kap, inhalt = k.inhalt || { absaetze: [], fragen: [], bilder: [] }, lesen = !AS.admin, ro = lesen ? " readonly" : "", dis = lesen ? " disabled" : "";
  const dlg = asDialog({ titel: k.titel, breit: true, inhalt: `<div class="form">
      <label class="voll">Titel<input id="kfTitel" value="${esc(k.titel)}"${ro}></label>
      <label class="voll">Rechtsbezug (Kürzel aus dem Rechtskataster, mit Komma getrennt)<input id="kfRecht" value="${esc((k.rechtsbezug || []).join(", "))}"${ro}></label>
      <label>Wiederholung<select id="kfTurnus"${dis}>${[6, 12, 24, 36].map(m => `<option value="${m}"${k.turnus_monate === m ? " selected" : ""}>alle ${m} Monate</option>`).join("")}</select></label>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="kfPraxis"${k.praktischer_anteil ? " checked" : ""}${dis}> mit praktischem Anteil (zweite Unterschrift nötig)</label>
      <label class="voll">Text <span class="hinweis">Eine Zeile je Absatz. Zeilen mit „- " werden zur Aufzählung, **fett** hebt hervor.${lesen ? " Schreibgeschützt – Fachtext pflegt OAK engineering." : ""}</span>
        <textarea id="kfText" rows="12"${ro}>${esc((inhalt.absaetze || []).map(a => (a.bu ? "- " : "") + a.md).join("\n"))}</textarea></label>
      <label class="voll">Verständnisfragen <span class="hinweis">Je Frage eine Zeile „?? Frage", darunter die Antworten mit „- ", die richtige mit „[richtig]" am Ende.${lesen ? " Schreibgeschützt." : ""}</span>
        <textarea id="kfFragen" rows="7"${ro}>${esc((inhalt.fragen || []).map(f => "?? " + f.frage + "\n" + (f.optionen || []).map((o, i) => "- " + o + (i === f.richtig ? " [richtig]" : "")).join("\n")).join("\n\n"))}</textarea></label></div>
    <p><b>Bilder</b></p><div id="kfBilder" style="display:flex;flex-wrap:wrap;gap:10px"></div>
    <p><b>Historie</b></p><div id="kfHist" class="zeilen"><div class="leer">wird geladen …</div></div>`,
    knoepfe: lesen ? [] : [{ t: "Speichern", fn: async dl => {
      const satz = { titel: dl.querySelector("#kfTitel").value.trim() || k.titel,
        rechtsbezug: dl.querySelector("#kfRecht").value.split(",").map(s => s.trim()).filter(Boolean),
        turnus_monate: parseInt(dl.querySelector("#kfTurnus").value, 10) || 12, praktischer_anteil: dl.querySelector("#kfPraxis").checked,
        inhalt: { absaetze: asUwTextZuAbsaetzen(dl.querySelector("#kfText").value), fragen: asUwTextZuFragen(dl.querySelector("#kfFragen").value), bilder: (k.inhalt || {}).bilder || [] },
        fassung: (k.fassung || 1) + 1, geaendert_am: new Date().toISOString() };
      await apiSend("PATCH", "/rest/v1/uw_kapitel?kennung=eq." + encodeURIComponent(k.kennung), satz, "return=minimal");
      await apiSend("POST", "/rest/v1/uw_kapitel_historie", { kennung: k.kennung, fassung: satz.fassung, anlass: "redaktionell",
        beschreibung: "Im Portal bearbeitet", von: AS.ich || "OAK engineering" }, "return=minimal");
      Object.assign(k, satz); asZeige(); asMeldung("Gespeichert als Fassung " + satz.fassung + ".");
    } }] });
  asUwBilder(dlg, k);
  try{
    const h = await apiGet("/rest/v1/uw_kapitel_historie?select=fassung,datum,anlass,beschreibung,von&kennung=eq." + encodeURIComponent(k.kennung) + "&order=fassung.desc");
    dlg.querySelector("#kfHist").innerHTML = (h || []).map(x => `<div class="z"><div><b>Fassung ${esc(x.fassung)} · ${asDat(x.datum)}</b><small>${esc(x.beschreibung)} · ${esc(x.von)}</small></div>${asChip(x.anlass, "grau")}</div>`).join("")
      || '<div class="leer">Noch keine Einträge.</div>';
  }catch(e){ dlg.querySelector("#kfHist").innerHTML = '<div class="leer">Historie nicht abrufbar.</div>'; }
}
/* Bilder: Grundstock bleibt unangetastet, eigenes Bild in uw_medium – „Original" jederzeit möglich */
function asUwBilder(dlg, k){
  const K = AS_UW.kap, el = dlg.querySelector("#kfBilder"), bilder = (k.inhalt || {}).bilder || [];
  if(!bilder.length){ el.innerHTML = '<span class="hinweis">Dieses Kapitel hat keine Bilder.</span>'; return; }
  el.innerHTML = bilder.map((name, i) => { const eigen = K.medien.find(m => m.kennung === k.kennung && m.bild_key === name && m.kunde_slug === AS.kunde);
    return `<figure style="margin:0;width:180px;border:1px solid var(--linie);border-radius:8px;padding:6px">
      <img data-bild="${i}" alt="${esc(name)}" style="width:100%;height:110px;object-fit:contain;background:#f5f7fa">
      <figcaption class="hinweis">${esc(name)}${eigen ? " · eigenes Bild" : ""}</figcaption>
      ${asUwDarfPflegen() ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"><label class="btn sek klein">Tauschen<input type="file" accept="image/*" hidden data-neu="${esc(name)}"></label>
        ${eigen ? `<button class="btn sek klein" data-orig="${esc(eigen.id)}">Original</button>` : ""}</div>` : ""}</figure>`; }).join("");
  bilder.forEach(async (name, i) => { const eigen = K.medien.find(m => m.kennung === k.kennung && m.bild_key === name && m.kunde_slug === AS.kunde);
    const u = await asSigniert(eigen ? eigen.storage_path : "_grundstock/unterweisungen/" + k.thema + "/" + name);
    const img = el.querySelector(`[data-bild="${i}"]`); if(img && u) img.src = u; });
  el.querySelectorAll("[data-neu]").forEach(inp => inp.onchange = async () => {
    const datei = inp.files[0], key = inp.dataset.neu; if(!datei) return;
    if(datei.size > 4 * 1024 * 1024){ asMeldung("Bild zu groß (max. 4 MB)."); return; }
    try{
      const endung = (datei.name.split(".").pop() || "jpg").toLowerCase();
      const pfad = AS.kunde + "/unterweisungen/" + k.thema + "/" + key.replace(/\.[^.]+$/, "") + "-eigen." + endung;
      await asUwHochladen(pfad, datei, datei.type || "application/octet-stream");
      const alt = K.medien.find(m => m.kennung === k.kennung && m.bild_key === key && m.kunde_slug === AS.kunde);
      if(alt){ await apiSend("PATCH", "/rest/v1/uw_medium?id=eq." + encodeURIComponent(alt.id), { storage_path: pfad }, "return=minimal"); alt.storage_path = pfad; }
      else { const neu = await apiSend("POST", "/rest/v1/uw_medium", { kunde_slug: AS.kunde, kennung: k.kennung, bild_key: key, storage_path: pfad, art: "bild",
        angelegt_von: AS.ich || "Portal" }, "return=representation"); K.medien.push(Array.isArray(neu) ? neu[0] : neu); }
      asMeldung("Bild ersetzt."); asUwBilder(dlg, k);
    }catch(e){ asMeldung("Fehler: " + (e.message || e)); }
  });
  el.querySelectorAll("[data-orig]").forEach(b => b.onclick = async () => {
    try{ await apiSend("DELETE", "/rest/v1/uw_medium?id=eq." + encodeURIComponent(b.dataset.orig), null, "return=minimal");
      K.medien = K.medien.filter(m => m.id !== b.dataset.orig); asMeldung("Originalbild wiederhergestellt."); asUwBilder(dlg, k); }
    catch(e){ asMeldung("Fehler: " + (e.message || e)); }
  });
}

/* ======================= 6. Katalog – neue Unterweisungsinhalte (uw_modul.ebene='inhalt') =======================
   ZUSÄTZLICH zur bisherigen Unterweisung: Terminal, Module, Fälligkeit (v_uw_faelligkeit) und die alten Zuweisungen bleiben unberührt
   (WIBO bleibt bis zur Umstellung darauf, Plan Phase 6). Hier nur: uw_inhalt_kategorie, uw_modul (ebene=inhalt), uw_inhalt_zuordnung,
   v_uw_inhalt_luecke, uw_buchung (Freischalten nur OAK). Kein DELETE auf Zuordnungen – Abwählen = aktiv=false, Pflicht nur mit Begründung. */
const AS_UW_PFLICHT = { immer: "Pflicht", bei_anlagentyp: "Pflicht bei Anlage", bei_stoffkategorie: "Pflicht bei Gefahrstoff", bei_taetigkeit: "Pflicht bei Tätigkeit" };
async function asUwKatLaden(neu){
  if(!neu && AS_UW.kat && AS_UW.kat.kunde === AS.kunde) return;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const hole = p => apiGet(p).then(r => r || []).catch(() => []);
  const [kategorien, inhalte, zuordnung, luecken] = await Promise.all([
    hole("/rest/v1/uw_inhalt_kategorie?select=*&aktiv=is.true&order=reihenfolge.asc"),
    hole("/rest/v1/uw_modul?select=*&ebene=eq.inhalt&order=reihenfolge.asc,titel.asc"),
    hole("/rest/v1/uw_inhalt_zuordnung?select=*" + k),
    hole("/rest/v1/v_uw_inhalt_luecke?select=*" + k)]);
  AS_UW.kat = { kunde: AS.kunde, kategorien, inhalte, zuordnung, luecken };
}
async function asUwKatNeu(text){ await Promise.all([asUwLaden(true), asUwKatLaden(true)]); asZeige(); if(text) asMeldung(text); }
/* Fehler gehen an OAK (portal_fehler), der Nutzer bekommt eine kurze Meldung */
function asUwFehler(was, e, details){
  const m = String((e && e.message) || e);
  if(window.OAK_FEHLER && m !== "AUTH") window.OAK_FEHLER("unterweisung", was + ": " + m, Object.assign({ kunde: AS.kunde }, details || {}));
  asMeldung(was + " – nicht gespeichert: " + m.replace(/^HTTP \d+ /, "").slice(0, 140));
}
/* gebucht wie im DB-Trigger: aktiv und nicht abgelaufen */
function asUwKatGebucht(thema){
  const heute = asHeute();
  return AS_UW.d.buchung.some(b => b.thema === thema && b.aktiv !== false && (!b.laeuft_bis || String(b.laeuft_bis) >= heute));
}
function asUwPflichtChip(m){
  const t = AS_UW_PFLICHT[m.pflicht_art]; if(!t) return "";
  const r = m.rechtsbezug || [];
  return `<span title="${esc(r.join(" · ") || "Rechtsgrundlage wird ergänzt")}">${asChip(t + (r.length ? " · " + r[0] : ""), "blau")}</span>`;
}
function asUwKatTitel(s){ return ((AS_UW.kat.kategorien.find(k => k.schluessel === s) || {}).titel) || "ohne Kategorie"; }

function asUwKatalog(box){
  const K = AS_UW.kat, d = AS_UW.d, f = AS_UW.kf, pflegen = asDarf("pflegen"), oak = asDarf("oak");
  const katRang = s => { const i = K.kategorien.findIndex(k => k.schluessel === s); return i < 0 ? 999 : i; };
  const sichtbar = K.inhalte.filter(m => oak || m.aktiv || asUwKatGebucht(m.thema))
    .sort((a, b) => katRang(a.kategorie) - katRang(b.kategorie) || (a.reihenfolge || 0) - (b.reihenfolge || 0) || String(a.titel).localeCompare(String(b.titel), "de"));
  const frei = sichtbar.filter(m => asUwKatGebucht(m.thema)).length;
  if(f.kat && !K.kategorien.some(k => k.schluessel === f.kat)) f.kat = "";
  const rollenZahl = th => new Set(K.zuordnung.filter(z => z.thema === th && z.aktiv).map(z => z.rolle_id)).size;

  /* Pflicht-Lücken: je Inhalt und Bereich eine Zeile, Rollen zusammengefasst */
  const lGruppen = new Map();
  K.luecken.forEach(l => { const key = l.thema + "|" + (l.einheit_id || ""); const g = lGruppen.get(key) || { l, rollen: [], gruende: new Set() };
    g.rollen.push(asUwName(l.rolle_id, d.rollen)); String(l.vorschlag_grund || "").split("; ").filter(Boolean).forEach(x => g.gruende.add(x)); lGruppen.set(key, g); });
  const inhaltTitel = th => (K.inhalte.find(m => m.thema === th) || {}).titel || th;
  const frage = AS_SEITEN.fragen ? ` – <a href="#fragen">Frage an OAK</a>` : "";
  const lueckeHtml = lGruppen.size ? `<div class="karte"><h2>Pflicht-Lücken <span class="hinweis">${lGruppen.size} ${lGruppen.size === 1 ? "Inhalt fehlt" : "Inhalte fehlen"}</span></h2>
      <p class="hinweis">Laut Anlagen- und Gefahrstoffkataster nötig, für diesen Betrieb aber noch nicht freigeschaltet. Bitte bei OAK freischalten lassen${frage}.</p>
      <div class="zeilen">${[...lGruppen.values()].map(g => `<div class="z"><div><b>${esc(inhaltTitel(g.l.thema))}</b>
          <small>${esc([...g.gruende].join(" · ") || "Pflichtinhalt")} · ${esc(g.l.einheit_id ? asUwName(g.l.einheit_id, d.einheiten) : "betriebsweit")} · ${esc([...new Set(g.rollen)].join(", "))}</small></div>
        ${asChip("fehlt – bei OAK freischalten lassen", "rot")}</div>`).join("")}</div></div>` : "";

  box.innerHTML = `${lueckeHtml}
    <div class="karte"><h2>Unterweisungsinhalte <span class="hinweis">${frei} freigeschaltet · ${sichtbar.length} im Katalog</span>
        ${pflegen ? `<button class="btn klein" id="uwkVorschlag" title="Pflichtinhalte aus Anlagen, Gefahrstoffen und Rollen den Rollen zuordnen">Vorschläge übernehmen</button>` : ""}</h2>
      <div class="filterleiste">${asFilterWahl('id="uwkKat"', f.kat, [["", "alle"]].concat(K.kategorien.map(k => [k.schluessel, k.titel])), "Kategorie")}
        <input type="search" id="uwkQ" value="${esc(f.q)}" placeholder="Inhalt suchen …" autocomplete="off">
        <span class="fl-zahl" id="uwkZahl"></span></div>
      ${frei ? "" : `<p class="hinweis">Für diesen Betrieb sind noch keine Inhalte aus dem neuen Katalog freigeschaltet – der Katalog zeigt das Angebot. Zum Freischalten bei OAK anfragen${frage}. Die bisherige Unterweisung (Terminal, Module, Nachweise) läuft unverändert weiter.</p>`}
      <div class="zeilen" id="uwkListe"></div>
      <p class="hinweis">Kleine Inhalte je Kategorie, vom Betrieb je Rolle und Bereich zusammengestellt. Pflichtinhalte sind vorausgewählt und mit Rechtsgrundlage markiert; abwählen nur mit Begründung. Zeile antippen: Beschreibung und Zuordnung.</p></div>`;

  const liste = box.querySelector("#uwkListe");
  const zeichnen = () => {
    const q = f.q.trim().toLowerCase();
    const rows = sichtbar.filter(m => (!f.kat || m.kategorie === f.kat)
      && (!q || [m.titel, m.untertitel, asUwKatTitel(m.kategorie), (m.rechtsbezug || []).join(" ")].join(" ").toLowerCase().includes(q)));
    liste.innerHTML = rows.map(m => { const gb = asUwKatGebucht(m.thema), n = rollenZahl(m.thema);
      return `<div class="z" data-inhalt="${esc(m.thema)}"><div><b>${esc(m.titel)}</b>
          <small>${esc(asUwKatTitel(m.kategorie))}${m.untertitel ? " · " + esc(m.untertitel) : ""}${gb ? "" : " · noch nicht freigeschaltet – bei OAK anfragen"}</small></div>
        <span class="uwk-chips">${asUwPflichtChip(m)}${asChip(gb ? "freigeschaltet" : "nicht freigeschaltet", gb ? "gruen" : "grau")}${gb ? asChip(n === 1 ? "1 Rolle" : n + " Rollen", n ? "gruen" : "gelb") : ""}${m.aktiv ? "" : asChip("im Aufbau", "grau")}${oak ? `<button class="btn adm klein" data-katbuchen="${esc(m.thema)}" data-frei="${gb ? 1 : 0}">${gb ? "Sperren" : "Freischalten"}</button>` : ""}</span></div>`; }).join("")
      || `<div class="leer">${sichtbar.length ? "Keine Treffer." : "Der neue Katalog wird gerade aufgebaut – noch keine Inhalte verfügbar."}</div>`;
    box.querySelector("#uwkZahl").textContent = rows.length + (rows.length === 1 ? " Inhalt" : " Inhalte");
    liste.querySelectorAll("[data-inhalt]").forEach(z => z.onclick = ev => { if(ev.target.closest("button, a")) return;
      asUwInhaltDialog(K.inhalte.find(m => m.thema === z.dataset.inhalt)); });
    liste.querySelectorAll("[data-katbuchen]").forEach(b => b.onclick = async ev => {
      ev.stopPropagation(); if(!asDarf("oak")) return;
      const thema = b.dataset.katbuchen, warFrei = b.dataset.frei === "1"; b.disabled = true;
      try{
        if(warFrei) await apiSend("DELETE", "/rest/v1/uw_buchung?kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&thema=eq." + encodeURIComponent(thema), null, "return=minimal");
        else await apiSend("POST", "/rest/v1/uw_buchung?on_conflict=kunde_slug,thema", { kunde_slug: AS.kunde, thema, aktiv: true }, "resolution=merge-duplicates,return=minimal");
      }catch(e){ asUwFehler(warFrei ? "Sperren" : "Freischalten", e, { thema }); b.disabled = false; return; }
      await asUwKatNeu(inhaltTitel(thema) + (warFrei ? " gesperrt." : " freigeschaltet."));
    });
  };
  box.querySelector("#uwkKat").onchange = e => { f.kat = e.target.value; zeichnen(); };
  box.querySelector("#uwkQ").oninput = e => { f.q = e.target.value; zeichnen(); };
  const vk = box.querySelector("#uwkVorschlag");
  if(vk) vk.onclick = async () => { vk.disabled = true;
    let n;
    try{ n = await apiSend("POST", "/rest/v1/rpc/uw_inhalt_vorschlag_anwenden", { p_slug: AS.kunde }); }
    catch(e){ asUwFehler("Vorschläge übernehmen", e, {}); vk.disabled = false; return; }
    n = +n || 0;
    await asUwKatNeu(n ? n + (n === 1 ? " neue Zuordnung" : " neue Zuordnungen") + " aus den Vorschlägen übernommen."
      : frei ? "Keine neuen Vorschläge – alles ist schon zugeordnet." : "Keine Vorschläge übernommen – es sind noch keine Inhalte freigeschaltet.");
  };
  zeichnen();
}

/* Dialog je Inhalt: Beschreibung, Rechtsgrundlage, Turnus + Matrix Rolle × (betriebsweit + Bereiche) */
function asUwInhaltDialog(m){
  if(!m) return;
  const K = AS_UW.kat, d = AS_UW.d, gb = asUwKatGebucht(m.thema), darf = asDarf("pflegen") && gb, dis = darf ? "" : " disabled";
  const rollen = d.rollen.filter(r => r.status !== "archiviert"), einh = d.einheiten.filter(e => e.status === "aktiv");
  const spalten = [{ id: null, name: "betriebsweit" }].concat(einh.map(e => ({ id: e.id, name: e.name })));
  const zu = K.zuordnung.filter(z => z.thema === m.thema);
  const finde = (rid, eid) => zu.find(z => z.rolle_id === rid && (z.einheit_id || null) === eid);
  const kt = +m.turnus_monate || 12, turnusOpt = [...new Set([6, 12, 24, 36, kt])].sort((a, b) => a - b);
  const rTurnus = rid => { const z = zu.find(x => x.rolle_id === rid && x.aktiv && x.turnus_monate); return z ? { t: z.turnus_monate, g: z.turnus_grund || "" } : { t: "", g: "" }; };
  const r = m.rechtsbezug || [], abgewaehlt = zu.filter(z => z.pflicht && !z.aktiv);
  const zelle = (ro, sp) => { const z = finde(ro.id, sp.id), an = z ? z.aktiv : false, ab = z && z.pflicht && !z.aktiv;
    const tip = ab ? "Pflicht abgewählt: " + (z.abwahl_grund || "") : z && z.vorschlag_grund ? z.vorschlag_grund : "";
    return `<td${ab ? ' class="uwk-abwahl"' : ""}${tip ? ` title="${esc(tip)}"` : ""}><label><input type="checkbox" data-zr="${esc(ro.id)}" data-ze="${esc(sp.id || "")}"${an ? " checked" : ""}${dis}
      aria-label="${esc(ro.name + " · " + sp.name)}">${z && z.pflicht ? ` <small class="hinweis">${ab ? "abgewählt" : "Pflicht"}</small>` : ""}</label></td>`; };
  const matrix = rollen.length ? `<div class="tabwrap"><table class="tab"><tr><th>Rolle</th>${spalten.map(s => `<th>${esc(s.name)}</th>`).join("")}<th>Turnus</th></tr>
      ${rollen.map(ro => { const t = rTurnus(ro.id);
        return `<tr><td><b>${esc(ro.name)}</b></td>${spalten.map(sp => zelle(ro, sp)).join("")}
          <td><select data-turnus="${esc(ro.id)}" aria-label="Turnus ${esc(ro.name)}"${dis}><option value="">wie Katalog (${kt} Monate)</option>
            ${turnusOpt.map(x => `<option value="${x}"${+t.t === x ? " selected" : ""}>alle ${x} Monate</option>`).join("")}</select>
            <input type="text" data-tgrund="${esc(ro.id)}" value="${esc(t.g)}" placeholder="Begründung bei längerem Turnus" maxlength="300"${dis}></td></tr>`; }).join("")}</table></div>`
    : `<div class="leer">Noch keine Rollen angelegt – unter <b>Mitarbeiter</b> → Bereiche &amp; Rollen anlegen.</div>`;
  const inhalt = `${m.beschreibung || m.untertitel ? `<p>${esc(m.beschreibung || m.untertitel)}</p>` : ""}
    <div class="zeilen">
      <div class="z"><div><b>Rechtsgrundlage</b><small>${esc(r.join(" · ") || "wird ergänzt")}</small></div>${asUwPflichtChip(m) || asChip("freiwillig", "grau")}</div>
      <div class="z"><div><b>Turnus</b><small>alle ${kt} Monate${m.dauer_min ? " · ca. " + esc(m.dauer_min) + " Min." : ""} · ${esc(asUwKatTitel(m.kategorie))}</small></div>${asChip(gb ? "freigeschaltet" : "nicht freigeschaltet", gb ? "gruen" : "grau")}</div></div>
    ${gb ? "" : `<p class="hinweis">Noch nicht freigeschaltet – bei OAK anfragen${AS_SEITEN.fragen ? ` (<a href="#fragen">Frage an OAK</a>)` : ""}. Zuordnen geht nach der Freischaltung.</p>`}
    <h3>Wer bekommt diesen Inhalt?</h3>
    <p class="hinweis">Haken = die Rolle bekommt den Inhalt betriebsweit oder nur im Bereich. „Pflicht“ kommt aus den Vorschlägen (Kataster, Rechtsgrundlage).${darf ? "" : " Nur lesend."}</p>
    ${matrix}
    ${abgewaehlt.length ? `<h3 class="rot">Abgewählte Pflichten</h3><div class="zeilen">${abgewaehlt.map(z => `<div class="z"><div><b>${esc(asUwName(z.rolle_id, d.rollen))} · ${esc(z.einheit_id ? asUwName(z.einheit_id, d.einheiten) : "betriebsweit")}</b>
        <small>${esc(z.abwahl_grund || "")}</small></div>${asChip("Pflicht abgewählt", "rot")}</div>`).join("")}</div>` : ""}
    ${darf && zu.some(z => z.pflicht && z.aktiv) ? `<div class="form"><label class="voll">Begründung, falls eine Pflicht abgewählt wird (mindestens 10 Zeichen)<textarea id="uwkGrund" rows="2" maxlength="500"></textarea></label></div>` : ""}`;
  asDialog({ titel: m.titel, breit: true, inhalt, knoepfe: darf && rollen.length ? [{ t: "Speichern", fn: async dlg => {
    const grund = ((dlg.querySelector("#uwkGrund") || {}).value || "").trim();
    const jetzt = new Date().toISOString(), aenderungen = [];
    const box = (rid, eid) => dlg.querySelector(`[data-zr="${CSS.escape(rid)}"][data-ze="${CSS.escape(eid || "")}"]`);
    let pflichtAb = 0;
    for(const ro of rollen){
      const tv = dlg.querySelector(`[data-turnus="${CSS.escape(ro.id)}"]`).value, tn = tv ? +tv : null;
      const tg = dlg.querySelector(`[data-tgrund="${CSS.escape(ro.id)}"]`).value.trim();
      const zeileAn = spalten.some(sp => box(ro.id, sp.id).checked);
      if(zeileAn && tn && tn > kt && tg.length < 10){ asMeldung("Längerer Turnus als im Katalog (" + kt + " Monate) für „" + ro.name + "“: bitte begründen (mindestens 10 Zeichen)."); return false; }
      const turnus = { turnus_monate: tn, turnus_grund: tn && tn > kt ? tg : null };
      for(const sp of spalten){
        const an = box(ro.id, sp.id).checked, z = finde(ro.id, sp.id);
        if(z){
          const satz = {};
          if(z.aktiv !== an){ satz.aktiv = an; if(!an && z.pflicht){ satz.abwahl_grund = grund; pflichtAb++; } if(an) satz.abwahl_grund = null; }
          if(an && ((z.turnus_monate || null) !== turnus.turnus_monate || (z.turnus_grund || null) !== turnus.turnus_grund)) Object.assign(satz, turnus);
          if(Object.keys(satz).length) aenderungen.push(["PATCH", "/rest/v1/uw_inhalt_zuordnung?id=eq." + encodeURIComponent(z.id), Object.assign(satz, { geaendert_am: jetzt })]);
        } else if(an) aenderungen.push(["POST", "/rest/v1/uw_inhalt_zuordnung", Object.assign({ kunde_slug: AS.kunde, thema: m.thema, rolle_id: ro.id, einheit_id: sp.id, aktiv: true }, turnus)]);
      }
    }
    if(pflichtAb && grund.length < 10){ asMeldung("Eine Pflicht abwählen geht nur mit Begründung (mindestens 10 Zeichen)."); return false; }
    if(!aenderungen.length){ asMeldung("Nichts geändert."); return; }
    try{ for(const [art, pfad, satz] of aenderungen) await apiSend(art, pfad, satz, "return=minimal"); }
    catch(e){ asUwFehler("Zuordnung " + m.titel, e, { thema: m.thema, aenderungen: aenderungen.length }); await asUwKatNeu(); return; }   // Teilstand neu laden, Dialog schließen
    await asUwKatNeu(m.titel + ": Zuordnung gespeichert" + (pflichtAb ? " – " + pflichtAb + " Pflicht(en) mit Begründung abgewählt." : "."));
  } }] : [] });
}

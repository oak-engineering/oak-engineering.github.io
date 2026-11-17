/* OAK EHS-Cockpit – Modul „Sicherheitskultur“ (Beta, 17.11.2026), erster Baustein: Rundgänge.
   Lernrundgang = ganze Gruppe (Führungskraft + Sicherheitsbeauftragte/r + Fremder Blick), ein Arbeitsplatz gründlich (45–60 Min.).
   Sicherheitsrundgang = Führungskraft allein, 3–5 Tätigkeiten kurz. Vorgaben (Soll je Zeitraum), Berichtsfrist, Erinnerungen und
   Sichtbarkeit je Betrieb einstellbar (rg_einstellung). Gruppen würfelt der Betrieb (pflegeberechtigt) regelmäßig neu.
   Tabellen rg_* (SQL references/vorlagen/supabase/rundgang_2026-11-17.sql), Mails Edge Function rundgang-mail (.ics, Erinnerungen).
   Konten mit rollen.nur_rundgang sehen nur dieses Modul (Datenbank sperrt alles andere). Protokoll-Inhalte folgen (Felder aus
   rg_einstellung.protokoll_felder, bis dahin Platzhalter + Datei). Freischaltung je Betrieb: as_organisation.daten.module.sicherheitskultur.
   Globale Namen: asRg/AS_RG. */
"use strict";

AS_ICON.sicherheitskultur = '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>';
const AS_RG = { d: null, slug: null, monat: null, ansicht: "monat", f: { art: "", gruppe: "", meine: "" }, entwurf: null };
const AS_RG_ART = { lern: "Lernrundgang", sicher: "Sicherheitsrundgang" };
const AS_RG_KURZ = { lern: "Lern-RG", sicher: "Sicherheits-RG" };
const AS_RG_ROLLE = { fk: "Führungskraft", sibe: "Sicherheitsbeauftragte/r", fremd: "Fremder Blick" };
const AS_RG_ROLLE_KURZ = { fk: "FK", sibe: "SiBe", fremd: "Fremder Blick" };
const AS_RG_STD = { arten: { lern: true, sicher: true }, soll: { lern: { anzahl: 1, monate: 1, bezug: "gruppe" }, sicher: { anzahl: 1, monate: 1, bezug: "fk" } },
  berichtsfrist_tage: 7, erinnerung_tage: [3, 1, 0], sichtbarkeit: "alle", mindest: { fk: 1, sibe: 1, fremd: 1 }, mail_an: true, auswertung_fk: true, protokoll_felder: {} };
/* Platzhalter, bis die Protokolle gemeinsam ausgearbeitet sind (dann über rg_einstellung.protokoll_felder je Art ersetzen) */
const AS_RG_FELDER_STD = {
  lern: [{ k: "arbeitsplatz", t: "Arbeitsplatz / Tätigkeit", typ: "text" }, { k: "notiz", t: "Notizen zum Rundgang (Protokoll wird noch ausgearbeitet)", typ: "textarea" }],
  sicher: [{ k: "bereiche", t: "Angesehene Tätigkeiten / Arbeitsplätze", typ: "text" }, { k: "notiz", t: "Notizen zum Rundgang (Protokoll wird noch ausgearbeitet)", typ: "textarea" }],
};

/* ---------------- Freischaltung (Modul) und Sicht ---------------- */
function asRgPaket(){ return asOrgDaten().paket === "sicherheitskultur"; }   // eigenständiges Angebot: nur dieses Modul
function asRgFrei(){ const m = asOrgDaten().module; return asRgPaket() || !!(m && m.sicherheitskultur); }
if(typeof window.asFunktionAn !== "function") window.asFunktionAn = k => k === "sicherheitskultur" ? (asRgFrei() || asDarf("oak")) : true;
function asRgPflege(){ return asDarf("pflegen"); }

/* ---------------- Daten ---------------- */
const AS_RG_TAB = ["rg_einstellung", "rg_teilnehmer", "rg_gruppe", "rg_gruppe_mitglied", "rg_termin", "rg_protokoll"];
async function asRgLaden(erzwingen){
  if(AS_RG.d && AS_RG.slug === AS.kunde && !erzwingen) return AS_RG.d;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const erg = await Promise.all(AS_RG_TAB.map(t => apiGet("/rest/v1/" + t + "?select=*" + k).catch(() => [])));
  AS_RG_TAB.forEach((t, i) => AS.db[t] = erg[i] || []);
  AS_RG.slug = AS.kunde; AS_RG.d = true; return true;
}
function asRgE(){ return Object.assign({}, AS_RG_STD, asT("rg_einstellung")[0] || {}); }
function asRgTn(){ return asT("rg_teilnehmer"); }
function asRgIch(){ return asRgTn().filter(t => t.user_id && t.user_id === AS.uid && t.status !== "inaktiv"); }
function asRgIchFk(){ return asRgIch().find(t => t.rolle === "fk" && t.status === "bestaetigt"); }
function asRgGruppen(){ return asT("rg_gruppe").filter(g => !g.archiviert).sort((a, b) => String(a.name).localeCompare(String(b.name), "de", { numeric: true })); }
function asRgMitglieder(gid){ const ids = new Set(asT("rg_gruppe_mitglied").filter(m => m.gruppe_id === gid).map(m => m.teilnehmer_id));
  return asRgTn().filter(t => ids.has(t.id)).sort((a, b) => ["fk", "sibe", "fremd"].indexOf(a.rolle) - ["fk", "sibe", "fremd"].indexOf(b.rolle)); }
function asRgGruppeVon(tid){ const akt = new Set(asRgGruppen().map(g => g.id)); const m = asT("rg_gruppe_mitglied").find(x => x.teilnehmer_id === tid && akt.has(x.gruppe_id));
  return m ? asNach("rg_gruppe", m.gruppe_id) : null; }
function asRgMeineGruppen(){ const ich = new Set(asRgIch().map(t => t.id)); const akt = new Set(asRgGruppen().map(g => g.id));
  return [...new Set(asT("rg_gruppe_mitglied").filter(m => ich.has(m.teilnehmer_id) && akt.has(m.gruppe_id)).map(m => m.gruppe_id))]; }
function asRgName(tid){ const t = asNach("rg_teilnehmer", tid); return t ? t.name : "–"; }
function asRgProt(rid){ return asT("rg_protokoll").find(p => p.termin_id === rid); }
function asRgLokal(iso){ const d = new Date(iso); return isNaN(d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString(); }
function asRgTag(iso){ return asRgLokal(iso).slice(0, 10); }
function asRgUhr(iso){ return asRgLokal(iso).slice(11, 16); }
/* Status eines Termins für Farbe/Chip: abgeschlossen · abgesagt · geplant · protokoll (durchgeführt, Protokoll offen) · ueberfaellig */
function asRgStatus(r){
  if(r.status === "abgeschlossen" || asRgProt(r.id)) return "abgeschlossen";
  if(r.status === "abgesagt") return "abgesagt";
  if(new Date(r.beginn) > new Date()) return "geplant";
  return r.bericht_faellig_am && r.bericht_faellig_am < asHeute() ? "ueberfaellig" : "protokoll";
}
const AS_RG_ST = { geplant: ["geplant", "grau"], protokoll: ["Protokoll offen", "gelb"], ueberfaellig: ["Protokoll überfällig", "rot"],
  abgeschlossen: ["abgeschlossen", "gruen"], abgesagt: ["abgesagt", "grau"] };
/* Sichtbarkeit (rg_einstellung.sichtbarkeit) – pflegeberechtigte Konten sehen immer alles */
function asRgSichtbar(r){
  if(asRgPflege()) return true;
  const s = asRgE().sichtbarkeit, ich = new Set(asRgIch().map(t => t.id)), meine = new Set(asRgMeineGruppen());
  if(s === "alle") return true;
  const eigen = ich.has(r.fk_id) || (r.art === "lern" && meine.has(r.gruppe_id));
  if(s === "eigene") return eigen;
  const gruppenLeute = new Set(asT("rg_gruppe_mitglied").filter(m => meine.has(m.gruppe_id)).map(m => m.teilnehmer_id));
  return eigen || meine.has(r.gruppe_id) || gruppenLeute.has(r.fk_id);
}
function asRgDarfPlanen(r){
  if(asRgPflege()) return true;
  const fk = asRgIchFk(); if(!fk) return false;
  return !r || r.fk_id === fk.id || (r.gruppe_id && asRgMitglieder(r.gruppe_id).some(t => t.id === fk.id));
}
function asRgDarfProtokoll(r){
  if(asRgPflege()) return true;
  const ich = new Set(asRgIch().map(t => t.id));
  return ich.has(r.fk_id) || (r.art === "lern" && r.gruppe_id && asRgMitglieder(r.gruppe_id).some(t => ich.has(t.id)));
}
/* Zeitraum der Vorgabe: Blöcke ab Januar (1 = Monat, 3 = Quartal, 6 = Halbjahr, 12 = Jahr) */
function asRgZeitraum(monate){
  const h = new Date(), mon = Math.max(1, Math.min(12, +monate || 1)), s = Math.floor(h.getMonth() / mon) * mon;
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  return { von: iso(new Date(h.getFullYear(), s, 1)), bis: iso(new Date(h.getFullYear(), s + mon, 0)) };
}
async function asRgMail(body){
  try{
    const t = await token();
    const r = await fetch(CFG.url + "/functions/v1/rundgang-mail", { method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.anon, Authorization: "Bearer " + t }, body: JSON.stringify(Object.assign({ kunde_slug: AS.kunde }, body)) });
    const j = await r.json().catch(() => ({}));
    if(!r.ok || !j.ok) throw new Error(j.error || ("Fehler " + r.status));
    return j;
  }catch(e){
    if(typeof window.OAK_FEHLER === "function") window.OAK_FEHLER("rundgang-mail", String(e.message || e), body);
    return null;
  }
}

/* ---------------- Stil (einmalig) ---------------- */
(function(){ if(document.getElementById("rgStil")) return; const s = document.createElement("style"); s.id = "rgStil";
  s.textContent = `.rg-gruppen{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.rg-gruppe{background:#fff;border:1px solid var(--linie);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0}
.rg-gruppe h3{margin:0;font-size:15px;display:flex;justify-content:space-between;gap:8px;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-person{display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid var(--linie);border-radius:8px;padding:6px 8px;background:#fafbfc;cursor:default;min-width:0}
.rg-person b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-person small{color:var(--grau);white-space:nowrap}
.rg-person.klick{cursor:pointer}.rg-person.klick:hover{border-color:var(--blau)}
.rg-warn{color:var(--rot);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rg-hinweis{border-left:4px solid var(--gelb);background:var(--gelb2);padding:10px 12px;border-radius:8px;font-size:13px;margin:10px 0}
.rg-datei{display:inline-block;margin:4px 6px 0 0;font-size:13px}
@media(max-width:1100px){.rg-gruppen{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.rg-gruppen{grid-template-columns:1fr}}`;
  document.head.appendChild(s); })();

/* ---------------- Seite ---------------- */
AS_SEITEN.sicherheitskultur = { titel: "Sicherheitskultur", icon: "◈", sort: 5.6, async render(main){
  main.innerHTML = `<h1 class="seite">Sicherheitskultur</h1><div class="karte"><div class="leer">Wird geladen …</div></div>`;
  try{ await asRgLaden(); }catch(e){ main.innerHTML = `<h1 class="seite">Sicherheitskultur</h1><div class="karte"><div class="leer">Konnte nicht geladen werden: ${esc(e.message || e)}</div></div>`; return; }
  if(AS.seite !== "sicherheitskultur") return;
  const pflege = asRgPflege();
  const liste = [["rundgaenge", "Rundgänge"], ["stand", "Stand"], ["gruppen", "Gruppen"], ["teilnehmer", "Teilnehmende"]].concat(pflege ? [["einstellungen", "Einstellungen"]] : []);
  const r = asReiter("sicherheitskultur", liste, "rundgaenge");
  const beta = asDarf("oak") && !asRgFrei()
    ? `<div class="rg-hinweis">Beta – für diesen Betrieb noch nicht freigeschaltet (nur OAK sieht das Modul). <button class="btn klein" id="rgFrei">Für den Betrieb freischalten</button></div>`
    : asDarf("oak") ? `<div class="hinweis" style="margin-bottom:8px">Beta · ${asRgPaket() ? "<b>eigenständig</b> (Betrieb sieht nur die Sicherheitskultur)" : "freigeschaltet als Modul im Cockpit"}
        <button class="btn sek klein" id="rgPaket">${asRgPaket() ? "Als Modul im vollen Cockpit" : "Nur Sicherheitskultur (eigenständig)"}</button>
        ${asRgPaket() ? "" : `<button class="btn sek klein" id="rgSperr">Freischaltung zurücknehmen</button>`}</div>` : "";
  main.innerHTML = `<h1 class="seite">Sicherheitskultur</h1>
    <p class="unter">Rundgänge planen, durchführen und nachweisen: Lernrundgang in der Gruppe, Sicherheitsrundgang der Führungskraft.</p>
    ${beta}${r.html}<div id="rgInhalt"></div>`;
  const fr = main.querySelector("#rgFrei"), sp = main.querySelector("#rgSperr");
  if(fr) fr.onclick = async () => { await asOrgSpeichern({ module: Object.assign({}, asOrgDaten().module || {}, { sicherheitskultur: true }) }); asMeldung("Modul freigeschaltet"); asZeige(); };
  if(sp) sp.onclick = async () => { await asOrgSpeichern({ module: Object.assign({}, asOrgDaten().module || {}, { sicherheitskultur: false }) }); asMeldung("Freischaltung zurückgenommen"); asZeige(); };
  const pk = main.querySelector("#rgPaket");
  if(pk) pk.onclick = async () => { const nur = !asRgPaket();
    if(!confirm(nur ? "Betrieb auf „nur Sicherheitskultur“ stellen? Alle Konten des Betriebs sehen dann nur dieses Modul." : "Betrieb wieder auf das volle Cockpit stellen?")) return;
    await asOrgSpeichern({ paket: nur ? "sicherheitskultur" : null, module: Object.assign({}, asOrgDaten().module || {}, { sicherheitskultur: true }) });
    asMeldung(nur ? "Eigenständig: nur Sicherheitskultur" : "Volles Cockpit"); asZeige(); };
  const box = main.querySelector("#rgInhalt");
  ({ rundgaenge: asRgKalender, stand: asRgStand, gruppen: asRgGruppenSeite, teilnehmer: asRgTeilnehmerSeite, einstellungen: asRgEinstellungen }[r.akt] || asRgKalender)(box);
}};

/* ---------------- Reiter Rundgänge: Kalender ---------------- */
function asRgKalender(box){
  if(typeof asSvCss === "function") asSvCss();   // gleiches Kalender-Raster wie „Kalender & To-dos“
  const e = asRgE(), f = AS_RG.f, ich = new Set(asRgIch().map(t => t.id)), meine = new Set(asRgMeineGruppen());
  const alle = asT("rg_termin").filter(r => r.status !== "abgesagt" && asRgSichtbar(r)
      && (!f.art || r.art === f.art) && (!f.gruppe || r.gruppe_id === f.gruppe)
      && (!f.meine || ich.has(r.fk_id) || meine.has(r.gruppe_id)))
    .sort((a, b) => String(a.beginn).localeCompare(String(b.beginn)));
  const arten = Object.keys(AS_RG_ART).filter(a => e.arten[a]);
  const darf = asRgDarfPlanen(null);
  const eigen = asRgIch()[0];
  box.innerHTML = `${!eigen && !asRgPflege() ? `<div class="rg-hinweis">Sie sind noch nicht für die Rundgänge angemeldet. <button class="btn klein" id="rgMit">Jetzt anmelden</button></div>` : ""}
    ${eigen && eigen.status === "angemeldet" ? `<div class="rg-hinweis">Ihre Anmeldung als ${esc(AS_RG_ROLLE[eigen.rolle])} wartet auf Bestätigung durch den Betrieb.</div>` : ""}
    <div class="filterleiste">
      ${darf ? `<button class="btn" id="rgNeu">Rundgang planen</button>` : ""}
      ${arten.length > 1 ? asFilterWahl('id="rgFArt"', f.art, [["", "alle"]].concat(arten.map(a => [a, AS_RG_ART[a]])), "Art") : ""}
      ${asFilterWahl('id="rgFGr"', f.gruppe, [["", "alle"]].concat(asRgGruppen().map(g => [g.id, g.name])), "Gruppe")}
      ${asRgIch().length ? asFilterWahl('id="rgFMeine"', f.meine, [["", "alle"], ["1", "nur meine"]], "Termine") : ""}
      <span style="flex:1"></span>
      <button class="sv-pill${AS_RG.ansicht === "monat" ? " an" : ""}" data-ans="monat">Monat</button><button class="sv-pill${AS_RG.ansicht === "liste" ? " an" : ""}" data-ans="liste">Liste</button>
    </div><div id="rgKal"></div>`;
  const kal = box.querySelector("#rgKal");
  if(AS_RG.ansicht === "monat") asRgMonat(kal, alle, box); else asRgListe(kal, alle);
  const on = (id, fn) => { const el = box.querySelector(id); if(el) el.onchange = fn; };
  on("#rgFArt", ev => { f.art = ev.target.value; asRgKalender(box); });
  on("#rgFGr", ev => { f.gruppe = ev.target.value; asRgKalender(box); });
  on("#rgFMeine", ev => { f.meine = ev.target.value; asRgKalender(box); });
  box.querySelectorAll("[data-ans]").forEach(b => b.onclick = () => { AS_RG.ansicht = b.dataset.ans; asRgKalender(box); });
  const n = box.querySelector("#rgNeu"); if(n) n.onclick = () => asRgTerminDialog(null);
  const m = box.querySelector("#rgMit"); if(m) m.onclick = () => asRgAnmelden();
}
function asRgEintragText(r){ return asRgUhr(r.beginn) + " " + AS_RG_KURZ[r.art] + (r.gruppe_id ? " · " + ((asNach("rg_gruppe", r.gruppe_id) || {}).name || "") : r.fk_id ? " · " + asRgName(r.fk_id) : ""); }
function asRgMonat(box, alle, aussen){
  if(!AS_RG.monat){ const h = new Date(); AS_RG.monat = new Date(h.getFullYear(), h.getMonth(), 1); }
  const jahr = AS_RG.monat.getFullYear(), mon = AS_RG.monat.getMonth();
  const start = new Date(jahr, mon, 1 - ((new Date(jahr, mon, 1).getDay() + 6) % 7)), heute = asHeute();
  const farbe = { geplant: "", protokoll: "gelb", ueberfaellig: "rot", abgeschlossen: "gruen" };
  let zellen = "";
  for(let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const tag = alle.filter(r => asRgTag(r.beginn) === k);
    zellen += `<div class="sv-tag${d.getMonth() !== mon ? " fremd" : ""}${k === heute ? " heute" : ""}" data-tag="${k}"><span class="sv-nr">${d.getDate()}</span>
      ${tag.slice(0, 3).map(r => `<button class="sv-e ${farbe[asRgStatus(r)] || ""}" data-r="${r.id}" title="${esc(AS_RG_ART[r.art] + " · " + asRgEintragText(r) + (r.bereich ? " · " + r.bereich : ""))}">${esc(asRgEintragText(r))}</button>`).join("")}
      ${tag.length > 3 ? `<span class="hinweis">+${tag.length - 3} weitere</span>` : ""}</div>`;
  }
  const offen = alle.filter(r => asRgStatus(r) === "ueberfaellig");
  box.innerHTML = (offen.length ? `<div class="karte" style="border-left:4px solid var(--rot);cursor:pointer" id="rgUeber"><b>${offen.length} ${offen.length === 1 ? "Protokoll ist" : "Protokolle sind"} überfällig</b> <span class="hinweis">– in der Liste ansehen</span></div>` : "")
    + `<div class="karte"><div class="sv-mkopf"><button class="btn sek klein" id="rgZur" aria-label="Vormonat">‹</button>
      <h2>${esc(AS_RG.monat.toLocaleDateString("de-DE", { month: "long", year: "numeric" }))}</h2>
      <button class="btn sek klein" id="rgVor" aria-label="Nächster Monat">›</button><button class="btn sek klein" id="rgHeute">Heute</button></div>
    <div class="sv-raster">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(t => `<div class="sv-wt">${t}</div>`).join("")}${zellen}</div>
    <p class="hinweis">Tag anklicken = Rundgang an diesem Tag planen · grün abgeschlossen · gelb Protokoll offen · rot Protokoll überfällig</p></div>`;
  const ub = box.querySelector("#rgUeber"); if(ub) ub.onclick = () => { AS_RG.ansicht = "liste"; asRgKalender(aussen); };
  box.querySelector("#rgZur").onclick = () => { AS_RG.monat = new Date(jahr, mon - 1, 1); asRgKalender(aussen); };
  box.querySelector("#rgVor").onclick = () => { AS_RG.monat = new Date(jahr, mon + 1, 1); asRgKalender(aussen); };
  box.querySelector("#rgHeute").onclick = () => { AS_RG.monat = null; asRgKalender(aussen); };
  box.querySelectorAll("[data-r]").forEach(b => b.onclick = ev => { ev.stopPropagation(); asRgTerminOeffnen(asNach("rg_termin", b.dataset.r)); });
  if(asRgDarfPlanen(null)) box.querySelectorAll("[data-tag]").forEach(z => { z.style.cursor = "pointer"; z.onclick = () => asRgTerminDialog(null, z.dataset.tag); });
}
function asRgListe(box, alle){
  const zeile = r => { const st = asRgStatus(r), [t, c] = AS_RG_ST[st];
    return `<div class="z" data-r="${r.id}"><div><b>${esc(asDat(asRgTag(r.beginn)))} ${esc(asRgUhr(r.beginn))} · ${esc(AS_RG_ART[r.art])}${r.bereich ? " · " + esc(r.bereich) : ""}</b>
      <small>${[r.gruppe_id ? (asNach("rg_gruppe", r.gruppe_id) || {}).name : "", r.fk_id ? "Leitung: " + asRgName(r.fk_id) : "", st === "protokoll" || st === "ueberfaellig" ? "Protokoll bis " + asDat(r.bericht_faellig_am) : ""].filter(Boolean).map(esc).join(" · ")}</small></div>${asChip(t, c)}</div>`; };
  const offen = alle.filter(r => ["protokoll", "ueberfaellig"].includes(asRgStatus(r))), kommend = alle.filter(r => asRgStatus(r) === "geplant"),
    fertig = alle.filter(r => asRgStatus(r) === "abgeschlossen").reverse();
  const block = (titel, l, zu) => l.length ? `<details class="karte"${zu ? "" : " open"}><summary style="cursor:pointer"><b style="color:var(--blau)">${titel}</b> <span class="hinweis">${l.length}</span></summary><div class="zeilen">${l.map(zeile).join("")}</div></details>` : "";
  box.innerHTML = alle.length ? block("Protokoll offen", offen) + block("Geplant", kommend) + block("Abgeschlossen", fertig, fertig.length > 10)
    : `<div class="karte"><div class="leer">Noch keine Rundgänge geplant.</div></div>`;
  box.querySelectorAll("[data-r]").forEach(z => z.onclick = () => asRgTerminOeffnen(asNach("rg_termin", z.dataset.r)));
}
function asRgTerminOeffnen(r){
  if(!r) return;
  const st = asRgStatus(r);
  if((st === "protokoll" || st === "ueberfaellig" || st === "abgeschlossen") && asRgDarfProtokoll(r)) return asRgProtokollDialog(r);
  if(asRgDarfPlanen(r) && st === "geplant") return asRgTerminDialog(r);
  asRgTerminAnsicht(r);
}
function asRgTerminAnsicht(r){
  const g = r.gruppe_id ? asNach("rg_gruppe", r.gruppe_id) : null, p = asRgProt(r.id);
  asDialog({ titel: AS_RG_ART[r.art], inhalt: `<table class="tab"><tbody>
      <tr><td>Termin</td><td>${esc(asDat(asRgTag(r.beginn)))} · ${esc(asRgUhr(r.beginn))} Uhr · ${esc(r.dauer_min)} Min.</td></tr>
      <tr><td>Bereich</td><td>${esc(r.bereich || (r.einheit_id ? asEinheitName(r.einheit_id) : "–"))}</td></tr>
      <tr><td>Leitung</td><td>${esc(asRgName(r.fk_id))}</td></tr>
      ${g ? `<tr><td>Gruppe</td><td>${esc(g.name)}: ${asRgMitglieder(g.id).map(t => esc(t.name)).join(", ")}</td></tr>` : ""}
      <tr><td>Status</td><td>${asChip(...AS_RG_ST[asRgStatus(r)])}${p ? " · Protokoll von " + esc(p.erstellt_von || "") : ""}</td></tr></tbody></table>`,
    knoepfe: [{ t: "Schließen", klasse: "sek", fn: () => true }] });
}

/* ---------------- Termin planen ---------------- */
function asRgTerminDialog(r, tag){
  const neu = !r, e = asRgE(), fkIch = asRgIchFk(), pflege = asRgPflege();
  const arten = Object.keys(AS_RG_ART).filter(a => e.arten[a]);
  const fks = asRgTn().filter(t => t.rolle === "fk" && t.status === "bestaetigt");
  const gruppeVonFk = fid => { const g = asRgGruppeVon(fid); return g ? g.id : ""; };
  r = r || { art: arten.length === 2 ? "beide" : arten[0], beginn: null, dauer_min: 60, fk_id: fkIch ? fkIch.id : (fks[0] || {}).id, bereich: "" };
  if(!r.gruppe_id && r.fk_id) r.gruppe_id = gruppeVonFk(r.fk_id);
  const datum = r.beginn ? asRgTag(r.beginn) : (tag || asHeute()), uhr = r.beginn ? asRgUhr(r.beginn) : "09:00";
  const artOpt = (neu && arten.length === 2 ? [["beide", "Beides (zwei Termine)"]] : []).concat(arten.map(a => [a, AS_RG_ART[a]]));
  const kn = [{ t: neu ? "Planen und einladen" : "Speichern und informieren", fn: async d => {
    const w = asWerte(d);
    if(!w.datum || !w.uhr){ asMeldung("Datum und Uhrzeit angeben"); return false; }
    const beginn = new Date(w.datum + "T" + w.uhr).toISOString();
    const fk = w.fk_id || (fkIch && fkIch.id); if(!fk){ asMeldung("Führungskraft wählen"); return false; }
    const gruppe = w.gruppe_id || gruppeVonFk(fk) || null;
    const welche = w.art === "beide" ? ["lern", "sicher"] : [w.art];
    if(welche.includes("lern") && !gruppe){ asMeldung("Für den Lernrundgang braucht die Führungskraft eine Gruppe"); return false; }
    const gesp = [];
    for(const a of welche){
      const row = { art: a, beginn: a === "sicher" && w.art === "beide" ? new Date(new Date(beginn).getTime() + (+w.dauer_min || 60) * 6e4 + 15 * 6e4).toISOString() : beginn,
        dauer_min: a === "sicher" && w.art === "beide" ? 30 : (+w.dauer_min || 60), fk_id: fk, gruppe_id: a === "lern" ? gruppe : null,
        bereich: w.bereich, einheit_id: w.einheit_id || null, notiz: w.notiz };
      if(neu) row.angelegt_von = AS.ich; else row.id = r.id;
      const x = await asSpeichern("rg_termin", row); if(!x){ asMeldung("Konnte nicht gespeichert werden"); return false; }
      gesp.push(x);
    }
    let n = 0; for(const x of gesp){ const m = await asRgMail({ ereignis: "termin", termin_id: x.id, art: neu ? "neu" : "geaendert" }); if(m) n += m.gesendet || 0; }
    asMeldung((neu ? "Geplant" : "Gespeichert") + (n ? " – " + n + " Einladung" + (n === 1 ? "" : "en") + " verschickt" : ""));
    await asRgLaden(true); asZeige(); } }];
  if(!neu){
    kn.push({ t: "Absagen", klasse: "gefahr", fn: async () => {
      if(!confirm("Rundgang absagen? Die Teilnehmenden werden informiert.")) return false;
      await asSpeichern("rg_termin", { id: r.id, status: "abgesagt" }); await asRgMail({ ereignis: "termin", termin_id: r.id, art: "abgesagt" });
      asMeldung("Abgesagt"); await asRgLaden(true); asZeige(); } });
    kn.push({ t: "Kalenderdatei", klasse: "sek", fn: () => { asRgIcs(r); return false; } });
  }
  const d = asDialog({ titel: neu ? "Rundgang planen" : AS_RG_ART[r.art] + " ändern", breit: true, inhalt: `<div class="form">
      ${asAuswahl("Art", "art", r.art, neu ? artOpt : [[r.art, AS_RG_ART[r.art]]])}
      ${asFeld("Datum", "datum", datum, "date")}${asFeld("Uhrzeit", "uhr", uhr, "time")}
      ${asAuswahl("Dauer", "dauer_min", r.dauer_min || 60, [[30, "30 Minuten"], [45, "45 Minuten"], [60, "60 Minuten"], [90, "90 Minuten"]])}
      ${pflege || !fkIch ? asAuswahl("Führungskraft (Leitung)", "fk_id", r.fk_id || "", [["", "– wählen –"]].concat(fks.map(t => [t.id, t.name])))
        : `<label>Führungskraft (Leitung)<input value="${esc(fkIch.name)}" disabled></label>`}
      ${pflege ? asAuswahl("Gruppe (für den Lernrundgang)", "gruppe_id", r.gruppe_id || "", [["", "– Gruppe der Führungskraft –"]].concat(asRgGruppen().map(g => [g.id, g.name])))
        : `<label>Gruppe<input value="${esc((asNach("rg_gruppe", r.gruppe_id) || {}).name || "– keine –")}" disabled></label>`}
      ${asAuswahl("Abteilung", "einheit_id", r.einheit_id || "", [["", "– wählen –"]].concat(asT("as_einheit").map(x => [x.id, x.name])))}
      ${asFeld("Arbeitsplatz / Bereich", "bereich", r.bereich)}
      ${asFeld("Notiz für die Teilnehmenden", "notiz", r.notiz, "textarea", "voll")}</div>
      <p class="hinweis">Lernrundgang: die ganze Gruppe erhält eine Einladung mit Kalenderdatei. Sicherheitsrundgang: nur die Führungskraft. Bei „Beides“ folgt der Sicherheitsrundgang 15 Minuten nach dem Lernrundgang (30 Min.).</p>`, knoepfe: kn });
  const art = d.querySelector('[data-f="art"]'), dauer = d.querySelector('[data-f="dauer_min"]');
  if(art && neu) art.onchange = () => { dauer.value = art.value === "sicher" ? "30" : "60"; };
}
function asRgIcs(r){
  const f = iso => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ende = new Date(new Date(r.beginn).getTime() + (r.dauer_min || 60) * 6e4).toISOString();
  const txt = [ "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OAK engineering//EHS-Cockpit//DE", "BEGIN:VEVENT", "UID:rg-" + r.id + "@oak-engineering.de",
    "DTSTAMP:" + f(new Date().toISOString()), "DTSTART:" + f(r.beginn), "DTEND:" + f(ende), "SUMMARY:" + AS_RG_ART[r.art] + (r.bereich ? " – " + r.bereich : ""),
    "LOCATION:" + (r.bereich || ""), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); a.download = "rundgang.ics"; a.click();
}

/* ---------------- Protokoll (Gerüst: Felder aus der Einstellung, Platzhalter, Dateien) ---------------- */
async function asRgProtokollDialog(r){
  const p = asRgProt(r.id) || { inhalt: {}, dateien: [] }, e = asRgE();
  const felder = (e.protokoll_felder && e.protokoll_felder[r.art]) || AS_RG_FELDER_STD[r.art];
  const darf = asRgDarfProtokoll(r);
  const links = await Promise.all((p.dateien || []).map(async pf => { const u = typeof asSvSigniert === "function" ? await asSvSigniert(pf) : null;
    return u ? `<a class="rg-datei" href="${esc(u)}" target="_blank" rel="noopener">${esc(pf.split("/").pop())}</a>` : `<span class="rg-datei">${esc(pf.split("/").pop())}</span>`; }));
  const feld = x => x.typ === "textarea" ? asFeld(x.t, x.k, p.inhalt[x.k], "textarea", "voll") : asFeld(x.t, x.k, p.inhalt[x.k], x.typ || "text", "voll");
  asDialog({ titel: "Protokoll " + AS_RG_ART[r.art], breit: true, inhalt: `<p class="hinweis">${esc(asDat(asRgTag(r.beginn)))} · ${esc(asRgUhr(r.beginn))} Uhr${r.bereich ? " · " + esc(r.bereich) : ""} · Leitung ${esc(asRgName(r.fk_id))}
      ${r.gruppe_id ? " · " + esc((asNach("rg_gruppe", r.gruppe_id) || {}).name || "") : ""}${p.id ? "<br>Zuletzt gespeichert von " + esc(p.erstellt_von || "") : " · Protokoll bis " + esc(asDat(r.bericht_faellig_am))}</p>
    <div class="form">${felder.map(feld).join("")}
      <label class="voll">Foto oder PDF anhängen<input type="file" id="rgDatei" accept="application/pdf,image/*" capture="environment" multiple ${darf ? "" : "disabled"}></label></div>
    ${links.length ? `<div>${links.join("")}</div>` : ""}
    <p class="hinweis">Keine Namen von Beschäftigten eintragen – nur Funktionen (z. B. „Maschinenbediener“). Mit dem Speichern ist der Rundgang abgeschlossen und die Erinnerungen enden.</p>`,
    knoepfe: darf ? [{ t: "Protokoll speichern", fn: async d => {
      const w = asWerte(d), inhalt = {}; felder.forEach(x => inhalt[x.k] = w[x.k]);
      const dateien = (p.dateien || []).slice();
      for(const datei of d.querySelector("#rgDatei").files){
        try{ asSvDateiOk(datei); }catch(err){ asMeldung(err.message); return false; }
        dateien.push(await asSvHochladen(datei, AS.kunde + "/rundgaenge/" + r.id + "/" + Date.now() + "-" + asSvDateiName(datei)));
      }
      const row = { termin_id: r.id, art: r.art, inhalt, dateien, erstellt_von: AS.ich };
      if(p.id) row.id = p.id;
      if(!(await asSpeichern("rg_protokoll", row))){ asMeldung("Konnte nicht gespeichert werden"); return false; }
      asMeldung("Protokoll gespeichert"); await asRgLaden(true); asZeige(); } }, { t: "Abbrechen", klasse: "sek", fn: () => true }]
      : [{ t: "Schließen", klasse: "sek", fn: () => true }] });
}

/* ---------------- Reiter Stand: Soll/Ist ---------------- */
function asRgStand(box){
  const e = asRgE(), heute = asHeute(), termine = asT("rg_termin").filter(asRgSichtbar);
  const offen = termine.filter(r => ["protokoll", "ueberfaellig"].includes(asRgStatus(r)));
  const ueber = offen.filter(r => asRgStatus(r) === "ueberfaellig");
  const monat = heute.slice(0, 7), dieserMonat = termine.filter(r => r.status !== "abgesagt" && asRgTag(r.beginn).slice(0, 7) === monat);
  const tnOk = asRgTn().filter(t => t.status === "bestaetigt"), tnNeu = asRgTn().filter(t => t.status === "angemeldet");
  const kachel = (farbe, lbl, zahl, hinweis) => `<div class="kachel k-${farbe}"><div class="lbl">${esc(lbl)}</div><div class="zahl">${zahl}</div><div class="hinweis">${esc(hinweis)}</div></div>`;
  let tab = "";
  Object.keys(AS_RG_ART).filter(a => e.arten[a]).forEach(art => {
    const s = e.soll[art] || {}, z = asRgZeitraum(s.monate), soll = +s.anzahl || 0;
    const imZ = termine.filter(r => r.art === art && r.status !== "abgesagt" && asRgTag(r.beginn) >= z.von && asRgTag(r.beginn) <= z.bis);
    const zeile = (name, l, sl) => { sl = sl == null ? soll : sl; const fertig = l.filter(r => asRgStatus(r) === "abgeschlossen").length, ist = l.length;
      const [t, c] = fertig >= sl ? ["im Soll", "gruen"] : ist >= sl ? ["geplant", "gelb"] : ["offen", "rot"];
      return `<tr><td>${esc(name)}</td><td>${sl}</td><td>${ist}</td><td>${fertig}</td><td>${asChip(t, c)}</td></tr>`; };
    let zeilen = "";
    if(s.bezug === "gruppe" && art === "lern") zeilen = asRgGruppen().map(g => zeile(g.name, imZ.filter(r => r.gruppe_id === g.id))).join("");
    else {
      const fks = asRgTn().filter(t => t.rolle === "fk" && t.status === "bestaetigt");
      // Auswertung je FK aus (Mitbestimmung): nur die eigene Zeile + Summe aller
      const sicht = e.auswertung_fk ? fks : fks.filter(t => asRgIch().some(i => i.id === t.id));
      zeilen = sicht.map(t => zeile(t.name, imZ.filter(r => r.fk_id === t.id))).join("");
      if(!e.auswertung_fk) zeilen += zeile("Alle Führungskräfte zusammen", imZ, soll * fks.length);
    }
    tab += `<div class="karte"><h2>${esc(AS_RG_ART[art])} <span class="hinweis">Vorgabe ${soll} × je ${s.bezug === "gruppe" ? "Gruppe" : "Führungskraft"} · Zeitraum ${esc(asDat(z.von))} – ${esc(asDat(z.bis))}</span></h2>
      <table class="tab"><thead><tr><th>${s.bezug === "gruppe" ? "Gruppe" : "Führungskraft"}</th><th>Soll</th><th>Geplant</th><th>Abgeschlossen</th><th>Stand</th></tr></thead>
      <tbody>${zeilen || `<tr><td colspan="5" class="leer">Noch keine ${s.bezug === "gruppe" ? "Gruppen" : "bestätigten Führungskräfte"}.</td></tr>`}</tbody></table></div>`;
  });
  box.innerHTML = `<div class="kacheln k4">
      ${kachel(dieserMonat.length ? "blau" : "grau", "Rundgänge diesen Monat", dieserMonat.length, "geplant oder durchgeführt")}
      ${kachel(offen.length ? "gelb" : "gruen", "Protokolle offen", offen.length, "durchgeführt, Protokoll fehlt")}
      ${kachel(ueber.length ? "rot" : "gruen", "Protokolle überfällig", ueber.length, "Frist " + e.berichtsfrist_tage + " Tage nach dem Rundgang")}
      ${kachel(tnNeu.length ? "gelb" : "blau", "Teilnehmende", tnOk.length, tnNeu.length ? tnNeu.length + " Anmeldung(en) offen" : "bestätigt")}
    </div>${tab}
    <div class="karte"><h2>Nachweis</h2><p class="hinweis">Die Rundgänge belegen „Führungskräfte zeigen Präsenz“ (Leitfaden, Baustein 4-8) und fließen in den Kalender des Betriebs ein.
      ${typeof AS_SEITEN.leitfaden !== "undefined" ? `<a href="#leitfaden">Zum Leitfaden</a>` : ""}</p></div>`;
}

/* ---------------- Reiter Gruppen: würfeln, umsetzen, veröffentlichen ---------------- */
function asRgGruppenSeite(box){
  const pflege = asRgPflege(), e = asRgE(), ent = AS_RG.entwurf;
  const runde = Math.max(0, ...asT("rg_gruppe").map(g => +g.runde || 0));
  const karte = (name, leute, extra, idx) => {
    const fehlt = Object.keys(AS_RG_ROLLE).filter(ro => leute.filter(t => t.rolle === ro).length < (+(e.mindest || {})[ro] || 0)).map(ro => AS_RG_ROLLE[ro]);
    const fkAbt = new Set(leute.filter(t => t.rolle === "fk").map(t => t.einheit_id).filter(Boolean));
    const fremdGleich = leute.some(t => t.rolle === "fremd" && t.einheit_id && fkAbt.has(t.einheit_id));
    return `<div class="rg-gruppe"><h3><span title="${esc(name)}">${esc(name)}</span>${extra || ""}</h3>
      ${leute.map(t => `<div class="rg-person${ent && pflege ? " klick" : ""}" ${ent && pflege ? `data-um="${t.id}" data-von="${idx}"` : ""} title="${esc(t.name + " · " + AS_RG_ROLLE[t.rolle] + (t.einheit_id ? " · " + asEinheitName(t.einheit_id) : ""))}">
        <b>${esc(t.name)}</b><small>${esc(AS_RG_ROLLE_KURZ[t.rolle])}${t.einheit_id ? " · " + esc(asEinheitName(t.einheit_id)) : ""}</small></div>`).join("") || `<div class="leer">leer</div>`}
      ${fehlt.length ? `<div class="rg-warn" title="Mindestbesetzung">fehlt: ${esc(fehlt.join(", "))}</div>` : ""}
      ${fremdGleich ? `<div class="rg-warn">Fremder Blick aus derselben Abteilung wie die Führungskraft</div>` : ""}</div>`;
  };
  let html = "";
  if(ent){
    const ohne = asRgTn().filter(t => t.status === "bestaetigt" && !ent.gruppen.some(g => g.ids.includes(t.id)));
    html = `<div class="rg-hinweis">Entwurf Runde ${runde + 1} – Person anklicken, um sie in eine andere Gruppe zu setzen. Erst „Veröffentlichen“ ersetzt die bisherigen Gruppen und informiert alle per Mail.</div>
      <div class="filterleiste"><button class="btn" id="rgVer">Veröffentlichen</button><button class="btn sek" id="rgNochmal">Neu würfeln</button><button class="btn sek" id="rgVerwerfen">Verwerfen</button></div>
      <div class="rg-gruppen">${ent.gruppen.map((g, i) => karte(g.name, g.ids.map(id => asNach("rg_teilnehmer", id)).filter(Boolean), "", i)).join("")}</div>
      ${ohne.length ? `<div class="karte"><h2>Ohne Gruppe (${ohne.length})</h2><div class="rg-gruppen">${ohne.map(t => `<div class="rg-person klick" data-um="${t.id}" data-von="-1"><b>${esc(t.name)}</b><small>${esc(AS_RG_ROLLE_KURZ[t.rolle])}</small></div>`).join("")}</div></div>` : ""}`;
  } else {
    const gr = asRgGruppen();
    html = `${pflege ? `<div class="filterleiste"><button class="btn" id="rgWuerfeln">${gr.length ? "Neue Runde würfeln" : "Gruppen würfeln"}</button>
        <span class="fl-zahl">${gr.length ? "Runde " + runde + " · seit " + esc(asDat((gr[0] || {}).gueltig_von)) : "noch keine Gruppen"}</span></div>` : ""}
      ${gr.length ? `<div class="rg-gruppen">${gr.map(g => karte(g.name, asRgMitglieder(g.id), asRgMeineGruppen().includes(g.id) ? asChip("meine", "gruen") : "")).join("")}</div>`
        : `<div class="karte"><div class="leer">Noch keine Gruppen. ${pflege ? "Erst Teilnehmende bestätigen, dann würfeln." : "Der Betrieb stellt die Gruppen zusammen."}</div></div>`}`;
  }
  box.innerHTML = html;
  const b = id => box.querySelector(id);
  if(b("#rgWuerfeln")) b("#rgWuerfeln").onclick = () => { const x = asRgWuerfeln(); if(x){ AS_RG.entwurf = x; asRgGruppenSeite(box); } };
  if(b("#rgNochmal")) b("#rgNochmal").onclick = () => { const x = asRgWuerfeln(); if(x){ AS_RG.entwurf = x; asRgGruppenSeite(box); } };
  if(b("#rgVerwerfen")) b("#rgVerwerfen").onclick = () => { AS_RG.entwurf = null; asRgGruppenSeite(box); };
  if(b("#rgVer")) b("#rgVer").onclick = () => asRgVeroeffentlichen(box);
  box.querySelectorAll("[data-um]").forEach(el => el.onclick = () => {
    const t = asNach("rg_teilnehmer", el.dataset.um), von = +el.dataset.von;
    asDialog({ titel: t.name + " umsetzen", inhalt: asAuswahl("In Gruppe", "ziel", von, [[-1, "– ohne Gruppe –"]].concat(AS_RG.entwurf.gruppen.map((g, i) => [i, g.name]))),
      knoepfe: [{ t: "Umsetzen", fn: d => { const z = +asWerte(d).ziel;
        AS_RG.entwurf.gruppen.forEach(g => g.ids = g.ids.filter(id => id !== t.id));
        if(z >= 0) AS_RG.entwurf.gruppen[z].ids.push(t.id); asRgGruppenSeite(box); } }] });
  });
}
/* Würfeln: Gruppenzahl = knappste Pflichtrolle; je Gruppe zuerst die Mindestbesetzung, dann Rest auf die kleinsten Gruppen.
   Kosten je Platz: Größe, Fremder Blick aus der Abteilung der FK (stark), Wiederholung früherer Paarungen. */
function asRgWuerfeln(){
  const e = asRgE(), min = Object.assign({ fk: 1, sibe: 1, fremd: 1 }, e.mindest || {});
  const misch = l => { const a = l.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = ro => misch(asRgTn().filter(t => t.status === "bestaetigt" && t.rolle === ro));
  const p = { fk: pool("fk"), sibe: pool("sibe"), fremd: pool("fremd") };
  const n = Math.min(...Object.keys(p).filter(ro => +min[ro] > 0).map(ro => Math.floor(p[ro].length / +min[ro])));
  if(!(n >= 1)){ asMeldung("Zu wenige bestätigte Teilnehmende: je Gruppe mindestens " + Object.keys(min).filter(ro => +min[ro] > 0).map(ro => min[ro] + " × " + AS_RG_ROLLE[ro]).join(", ")); return null; }
  // frühere Paarungen (alle Runden)
  const frueher = new Set(); const nachGruppe = {};
  asT("rg_gruppe_mitglied").forEach(m => (nachGruppe[m.gruppe_id] = nachGruppe[m.gruppe_id] || []).push(m.teilnehmer_id));
  Object.values(nachGruppe).forEach(ids => ids.forEach(a => ids.forEach(b => { if(a < b) frueher.add(a + "|" + b); })));
  const gruppen = Array.from({ length: n }, (_, i) => ({ name: "Gruppe " + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ""), ids: [] }));
  const tn = id => asNach("rg_teilnehmer", id);
  const kosten = (g, t) => { let k = g.ids.length * 10;
    if(t.rolle === "fremd" && t.einheit_id && g.ids.some(id => tn(id).rolle === "fk" && tn(id).einheit_id === t.einheit_id)) k += 100;
    if(t.rolle === "fk" && t.einheit_id && g.ids.some(id => tn(id).rolle === "fremd" && tn(id).einheit_id === t.einheit_id)) k += 100;
    g.ids.forEach(id => { if(frueher.has([id, t.id].sort().join("|"))) k += 5; }); return k + Math.random(); };
  const setze = (t, kandidaten) => { const g = kandidaten.sort((a, b) => kosten(a, t) - kosten(b, t))[0]; g.ids.push(t.id); };
  ["fk", "sibe", "fremd"].forEach(ro => { for(let r = 0; r < (+min[ro] || 0); r++) gruppen.forEach(() => {
    const t = p[ro].shift(); if(!t) return;
    setze(t, gruppen.filter(g => g.ids.filter(id => tn(id).rolle === ro).length <= r)); }); });
  ["fremd", "sibe", "fk"].forEach(ro => p[ro].forEach(t => setze(t, gruppen.slice())));
  return { gruppen };
}
async function asRgVeroeffentlichen(box){
  const ent = AS_RG.entwurf; if(!ent) return;
  if(!confirm("Gruppen veröffentlichen? Die bisherigen Gruppen werden archiviert, alle Mitglieder erhalten eine Mail mit ihrer Gruppe.")) return;
  try{
    const runde = Math.max(0, ...asT("rg_gruppe").map(g => +g.runde || 0)) + 1;
    for(const g of asRgGruppen()) await asSpeichern("rg_gruppe", { id: g.id, archiviert: true, gueltig_bis: asHeute() });
    for(const g of ent.gruppen){
      if(!g.ids.length) continue;
      const neu = await asSpeichern("rg_gruppe", { name: g.name, runde, gueltig_von: asHeute() });
      await apiSend("POST", "/rest/v1/rg_gruppe_mitglied", g.ids.map(id => ({ kunde_slug: AS.kunde, gruppe_id: neu.id, teilnehmer_id: id })), "return=minimal");
    }
    AS_RG.entwurf = null; await asRgLaden(true);
    const m = await asRgMail({ ereignis: "gruppen" });
    asMeldung("Gruppen veröffentlicht" + (m && m.gesendet ? " – " + m.gesendet + " Mails verschickt" : ""));
    asRgGruppenSeite(box);
  }catch(e){ asMeldung("Fehler: " + (e.message || e)); }
}

/* ---------------- Reiter Teilnehmende ---------------- */
function asRgTeilnehmerSeite(box){
  const pflege = asRgPflege(), ich = asRgIch();
  const liste = asRgTn().filter(t => pflege || t.status === "bestaetigt" || ich.some(i => i.id === t.id))
    .sort((a, b) => ({ angemeldet: 0, bestaetigt: 1, inaktiv: 2 }[a.status] - { angemeldet: 0, bestaetigt: 1, inaktiv: 2 }[b.status]) || String(a.name).localeCompare(String(b.name), "de"));
  const st = { angemeldet: ["Bestätigung offen", "gelb"], bestaetigt: ["bestätigt", "gruen"], inaktiv: ["inaktiv", "grau"] };
  const zahl = ro => asRgTn().filter(t => t.status === "bestaetigt" && t.rolle === ro).length;
  box.innerHTML = `<div class="filterleiste">
      ${!ich.length ? `<button class="btn" id="rgMit">Selbst anmelden</button>` : ""}
      ${pflege ? `<button class="btn${ich.length ? "" : " sek"}" id="rgTnNeu">+ Person</button><button class="btn sek" id="rgTnListe">Liste einfügen</button>` : ""}
      <span class="fl-zahl">${zahl("fk")} Führungskräfte · ${zahl("sibe")} Sicherheitsbeauftragte · ${zahl("fremd")} Fremder Blick</span></div>
    <div class="karte"><div class="zeilen">${liste.map(t => { const g = asRgGruppeVon(t.id);
      return `<div class="z" ${pflege ? `data-tn="${t.id}"` : `style="cursor:default"`}><div><b>${esc(t.name)}</b>
        <small>${[AS_RG_ROLLE[t.rolle], t.einheit_id ? asEinheitName(t.einheit_id) : "", pflege ? t.email : "", g ? g.name : "", pflege && t.user_id ? "Cockpit-Zugang" : ""].filter(Boolean).map(esc).join(" · ")}</small></div>${asChip(...st[t.status])}</div>`; }).join("")
      || `<div class="leer">Noch niemand angemeldet.</div>`}</div></div>
    ${pflege ? `<p class="hinweis">Gespeichert werden nur Name, dienstliche E-Mail, Abteilung und Rolle. Personen ohne Cockpit-Zugang erhalten ihn über „Zugang anlegen“ – dieser Zugang sieht nur die Sicherheitskultur.</p>` : ""}`;
  const b = id => box.querySelector(id);
  if(b("#rgMit")) b("#rgMit").onclick = () => asRgAnmelden();
  if(b("#rgTnNeu")) b("#rgTnNeu").onclick = () => asRgTnDialog(null);
  if(b("#rgTnListe")) b("#rgTnListe").onclick = () => asRgTnListe();
  box.querySelectorAll("[data-tn]").forEach(z => z.onclick = () => asRgTnDialog(asNach("rg_teilnehmer", z.dataset.tn)));
}
function asRgFelderPerson(t){
  return `${asFeld("Vor- und Nachname", "name", t.name, "text")}${asFeld("Dienstliche E-Mail", "email", t.email, "email")}
    ${asAuswahl("Abteilung", "einheit_id", t.einheit_id || "", [["", "– wählen –"]].concat(asT("as_einheit").map(x => [x.id, x.name])))}
    ${asAuswahl("Rolle im Betrieb", "rolle", t.rolle || "fk", Object.entries(AS_RG_ROLLE))}`;
}
function asRgPruefen(w){
  if(!w.name || w.name.length < 2){ asMeldung("Namen angeben"); return false; }
  if(w.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.email)){ asMeldung("E-Mail prüfen"); return false; }
  if(!w.einheit_id && asT("as_einheit").length){ asMeldung("Abteilung wählen"); return false; }
  return true;
}
function asRgAnmelden(){
  const s = (getSession() || {}).user || {};
  asDialog({ titel: "Für die Rundgänge anmelden", inhalt: `<div class="form">${asRgFelderPerson({ name: AS.ich, email: s.email || "" })}</div>
      <p class="hinweis">Der Betrieb bestätigt Ihre Anmeldung und teilt Sie einer Gruppe zu. Gespeichert werden nur diese Angaben.</p>`,
    knoepfe: [{ t: "Anmelden", fn: async d => { const w = asWerte(d); if(!asRgPruefen(w)) return false;
      try{ await asSpeichern("rg_teilnehmer", Object.assign(w, { user_id: AS.uid, status: "angemeldet", angelegt_von: AS.ich, email: w.email ? w.email.toLowerCase() : null })); }
      catch(e){ asMeldung(/23505|duplicate/.test(String(e.message || e)) ? "Diese E-Mail ist schon angemeldet" : "Fehler: " + (e.message || e)); return false; }
      asMeldung("Angemeldet – der Betrieb bestätigt"); await asRgLaden(true); asZeige(); } }, { t: "Abbrechen", klasse: "sek", fn: () => true }] });
}
function asRgTnDialog(t){
  const neu = !t; t = t || { rolle: "fk", status: "bestaetigt" };
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!asRgPruefen(w)) return false;
    w.email = w.email ? w.email.toLowerCase() : null;
    try{ await asSpeichern("rg_teilnehmer", Object.assign({ id: t.id }, w, neu ? { angelegt_von: AS.ich } : {})); }
    catch(e){ asMeldung(/23505|duplicate/.test(String(e.message || e)) ? "Diese E-Mail gibt es schon" : "Fehler: " + (e.message || e)); return false; }
    asZeige(); } }];
  if(!neu && t.email && !t.user_id && typeof asZgAufruf === "function") kn.unshift({ t: "Zugang anlegen", klasse: "sek", fn: async () => {
    if(!confirm("Cockpit-Zugang für " + t.name + " anlegen? Der Zugang sieht nur die Sicherheitskultur.")) return false;
    const pw = asZgPasswort();
    try{
      const z = await asZgAufruf({ aktion: "anlegen", name: t.name, email: t.email, passwort: pw, rolle: "kunde" });
      await apiSend("POST", "/rest/v1/rpc/rg_zugang_einschraenken", { p_user: z.user_id, p_teilnehmer: t.id });
      await asRgLaden(true);
      asDialog({ titel: "Zugang angelegt", inhalt: `<p>Bitte persönlich weitergeben (nicht per Mail zusammen mit der Adresse):</p>
        <table class="tab"><tbody><tr><td>Adresse</td><td>www.oak-engineering.de/portal2/</td></tr><tr><td>Anmeldung</td><td>${esc(t.email)}</td></tr><tr><td>Erstes Passwort</td><td><b>${esc(pw)}</b></td></tr></tbody></table>
        <p class="hinweis">Das Passwort wird nicht gespeichert und erscheint nur jetzt. Ändern lässt es sich nach der Anmeldung über „Passwort ändern“.</p>`,
        knoepfe: [{ t: "Fertig", fn: () => { asZeige(); return true; } }] });
      return false;
    }catch(e){ asMeldung("Zugang: " + (e.message || e)); return false; } } });
  if(!neu && t.status === "angemeldet") kn.unshift({ t: "Bestätigen", fn: async d => { const w = asWerte(d); if(!asRgPruefen(w)) return false;
    await asSpeichern("rg_teilnehmer", Object.assign({ id: t.id }, w, { status: "bestaetigt" })); asMeldung("Bestätigt"); asZeige(); } });
  if(!neu) kn.push({ t: t.status === "inaktiv" ? "Wieder aktiv" : "Inaktiv setzen", klasse: "sek", fn: async () => {
    await asSpeichern("rg_teilnehmer", { id: t.id, status: t.status === "inaktiv" ? "bestaetigt" : "inaktiv" }); asZeige(); } });
  asDialog({ titel: neu ? "Person hinzufügen" : t.name, inhalt: `<div class="form">${asRgFelderPerson(t)}</div>
      ${!neu ? `<p class="hinweis">${t.user_id ? "Hat einen Cockpit-Zugang." : "Noch kein Cockpit-Zugang."}${asRgGruppeVon(t.id) ? " · " + esc(asRgGruppeVon(t.id).name) : ""}</p>` : ""}`, knoepfe: kn });
}
function asRgTnListe(){
  asDialog({ titel: "Liste einfügen", breit: true, inhalt: `<p class="hinweis">Je Zeile: <b>Name; E-Mail; Abteilung; Rolle</b> – aus Excel kopieren geht auch (Tabulator).
      Rolle: Führungskraft · Sicherheitsbeauftragte/r · Fremder Blick (FK / SiBe / FB genügt). Abteilung wie im Cockpit angelegt.</p>
      <div class="form">${asFeld("Liste", "liste", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Übernehmen", fn: async d => {
      const zeilen = String(asWerte(d).liste || "").split(/\r?\n/).map(z => z.split(/\t|;/).map(x => x.trim())).filter(z => z[0]);
      const rolle = s => /^(fk|f[üu]hr)/i.test(s) ? "fk" : /^(sib|sicher)/i.test(s) ? "sibe" : /^(fb|fremd)/i.test(s) ? "fremd" : null;
      const abt = s => { const e = asT("as_einheit").find(x => String(x.name).toLowerCase() === String(s || "").toLowerCase()); return e ? e.id : null; };
      const vorhanden = new Set(asRgTn().map(t => String(t.email || "").toLowerCase()).filter(Boolean));
      const neu = [], fehler = [];
      zeilen.forEach((z, i) => { const [name, mail, ab, ro] = z, r = rolle(ro || "");
        if(!name || !r){ fehler.push("Zeile " + (i + 1) + ": Rolle fehlt/unklar"); return; }
        if(mail && vorhanden.has(mail.toLowerCase())) { fehler.push("Zeile " + (i + 1) + ": E-Mail schon vorhanden"); return; }
        neu.push({ kunde_slug: AS.kunde, name, email: mail ? mail.toLowerCase() : null, einheit_id: abt(ab), rolle: r, status: "bestaetigt", angelegt_von: AS.ich }); });
      if(!neu.length){ asMeldung(fehler[0] || "Nichts zu übernehmen"); return false; }
      try{ await apiSend("POST", "/rest/v1/rg_teilnehmer", neu, "return=minimal"); }catch(e){ asMeldung("Fehler: " + (e.message || e)); return false; }
      await asRgLaden(true); asMeldung(neu.length + " übernommen" + (fehler.length ? ", " + fehler.length + " übersprungen" : "")); asZeige(); } }] });
}

/* ---------------- Reiter Einstellungen ---------------- */
function asRgEinstellungen(box){
  const e = asRgE(), s = e.soll || {};
  const zeitraum = [[1, "Monat"], [3, "Quartal"], [6, "Halbjahr"], [12, "Jahr"]];
  const artBlock = (a, bezugWahl) => `<div class="karte"><h2>${esc(AS_RG_ART[a])}</h2><div class="form">
      ${asFeld("Wird im Betrieb durchgeführt", "an_" + a, !!e.arten[a], "checkbox", "voll")}
      ${asFeld("Anzahl je Zeitraum", "anzahl_" + a, (s[a] || {}).anzahl ?? 1, "number")}
      ${asAuswahl("Zeitraum", "monate_" + a, (s[a] || {}).monate || 1, zeitraum)}
      ${bezugWahl ? asAuswahl("Vorgabe gilt je", "bezug_" + a, (s[a] || {}).bezug || "gruppe", [["gruppe", "Gruppe"], ["fk", "Führungskraft"]]) : `<label>Vorgabe gilt je<input value="Führungskraft" disabled></label>`}</div></div>`;
  box.innerHTML = `${artBlock("lern", true)}${artBlock("sicher", false)}
    <div class="karte"><h2>Protokoll, Erinnerung, Sichtbarkeit</h2><div class="form">
      ${asFeld("Protokoll fällig (Tage nach dem Rundgang)", "frist", e.berichtsfrist_tage, "number")}
      ${asFeld("Erinnern (Tage vor Fristende, z. B. 3,1,0 – danach täglich)", "erinnerung", (e.erinnerung_tage || []).join(","))}
      ${asAuswahl("Kalender sichtbar für", "sichtbarkeit", e.sichtbarkeit, [["alle", "alle Teilnehmenden"], ["gruppe", "die eigene Gruppe"], ["eigene", "nur die eigenen Termine"]])}
      ${asFeld("Mails verschicken (Einladung mit Kalenderdatei, Erinnerungen)", "mail_an", e.mail_an !== false, "checkbox", "voll")}
      ${asFeld("Stand je Führungskraft auswerten (sonst nur je Gruppe bzw. gesamt)", "auswertung_fk", e.auswertung_fk !== false, "checkbox", "voll")}</div>
      <h3>Mindestbesetzung je Gruppe</h3><div class="form">
      ${Object.entries(AS_RG_ROLLE).map(([k, t]) => asFeld(t, "min_" + k, (e.mindest || {})[k] ?? 1, "number")).join("")}</div>
      <div class="rg-hinweis"><b>Mitbestimmung:</b> Die Auswertung je Führungskraft kann eine technische Leistungs- und Verhaltenskontrolle sein
        (§ 87 Abs. 1 Nr. 6 BetrVG). Vor dem Echtbetrieb mit dem Betriebsrat klären (Betriebsvereinbarung) – oder die Auswertung je Führungskraft ausschalten.
        Datenschutz: nur Name, dienstliche E-Mail, Abteilung, Rolle; keine Namen von Beschäftigten im Protokoll.</div>
      <div class="filterleiste"><button class="btn" id="rgEsp">Speichern</button></div></div>
    <div class="karte"><h2>Abteilungen <span><button class="btn klein" id="rgAbtNeu">+ Abteilung</button></span></h2>
      <div class="zeilen">${asT("as_einheit").map(x => `<div class="z" data-abt="${x.id}"><div><b>${esc(x.name)}</b>
        <small>${asRgTn().filter(t => t.einheit_id === x.id && t.status !== "inaktiv").length} Teilnehmende</small></div></div>`).join("") || `<div class="leer">Noch keine Abteilungen.</div>`}</div>
      <p class="hinweis">Dieselben Abteilungen gelten im ganzen Cockpit (Organisation). Für die Gruppen wichtig: Der „Fremde Blick“ kommt aus einer anderen Abteilung als die Führungskraft.</p></div>`;
  const abt = x => asDialog({ titel: x ? x.name : "Neue Abteilung", inhalt: `<div class="form">${asFeld("Name", "name", x ? x.name : "", "text", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.name){ asMeldung("Namen angeben"); return false; }
      await asSpeichern("as_einheit", x ? { id: x.id, name: w.name } : { name: w.name }); asZeige(); } }] });
  box.querySelector("#rgAbtNeu").onclick = () => abt(null);
  box.querySelectorAll("[data-abt]").forEach(z => z.onclick = () => abt(asNach("as_einheit", z.dataset.abt)));
  box.querySelector("#rgEsp").onclick = async () => {
    const w = asWerte(box), zahl = (v, d) => Number.isFinite(+v) && v !== null ? Math.max(0, Math.round(+v)) : d;
    const row = { kunde_slug: AS.kunde, arten: { lern: !!w.an_lern, sicher: !!w.an_sicher },
      soll: { lern: { anzahl: zahl(w.anzahl_lern, 1), monate: +w.monate_lern || 1, bezug: w.bezug_lern || "gruppe" }, sicher: { anzahl: zahl(w.anzahl_sicher, 1), monate: +w.monate_sicher || 1, bezug: "fk" } },
      berichtsfrist_tage: Math.min(90, Math.max(1, zahl(w.frist, 7))),
      erinnerung_tage: String(w.erinnerung || "").split(/[,; ]+/).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 60),
      sichtbarkeit: w.sichtbarkeit, mail_an: !!w.mail_an, auswertung_fk: !!w.auswertung_fk,
      mindest: { fk: zahl(w.min_fk, 1), sibe: zahl(w.min_sibe, 1), fremd: zahl(w.min_fremd, 1) }, geaendert_am: new Date().toISOString(), geaendert_von: AS.ich };
    if(!row.arten.lern && !row.arten.sicher){ asMeldung("Mindestens eine Art muss aktiv sein"); return; }
    try{ const erg = await apiSend("POST", "/rest/v1/rg_einstellung?on_conflict=kunde_slug", row, "resolution=merge-duplicates,return=representation");
      AS.db.rg_einstellung = erg || [row]; asMeldung("Gespeichert"); }
    catch(e){ asMeldung("Fehler: " + (e.message || e)); }
  };
}

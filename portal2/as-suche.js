/* Suche (Plan intern/portal-eigenstaendig.md, Schritt 9; Nikolai 14./15.10.2026): ein Suchfeld oben im Cockpit,
   Treffer über Seiten/Funktionen, Unterlagen, Anlagen, Mängel, Maßnahmen, Beurteilungen, Gefahrstoffe, Personen,
   Beauftragte/Nachweise, Prüfungen, Termine und Bereiche – mit Filter nach Art und Bereich. Ohne KI, rein aus den Daten.
   Der Bereichsfilter (as-bereich.js) greift automatisch, weil alles über apiGet bzw. die geladenen Tabellen läuft. */
"use strict";

const AS_SU = { q: "", art: "", daten: null, kunde: null, zeit: 0, timer: null };
const AS_SU_ARTEN = [["seite", "Funktionen"], ["dokument", "Unterlagen"], ["anlage", "Anlagen"], ["mangel", "Mängel"], ["massnahme", "Maßnahmen"],
  ["bda", "Beurteilungen"], ["gefahrstoff", "Gefahrstoffe"], ["person", "Personen"], ["nachweis", "Beauftragte & Nachweise"],
  ["pruefung", "Prüfungen"], ["termin", "Termine"], ["bereich", "Bereiche"]];
/* zusätzliche Suchwörter je Seite, damit man Funktionen auch mit Alltagswörtern findet */
const AS_SU_WOERTER = { maengel: "mangel defekt reparatur befund", anlagen: "maschine maschinen geräte", gefahrstoffe: "sdb sicherheitsdatenblatt chemie handschuh handschuhplan kataster",
  unterweisungen: "schulung unterweisen terminal", nachweise: "beauftragte ersthelfer stapler kran vorsorge zertifikat", pruefungen: "prüfung prüffrist dguv v3 leiter not-halt",
  bda: "gefährdungsbeurteilung gbu risiko", massnahmen: "aufgabe to-do", kalender: "termin frist todo", vorfaelle: "unfall beinahe meldung verbandbuch",
  hallenplan: "plan halle karte", organisation: "bereiche zugänge struktur einheiten", vorort: "prüfen melden terminal" };

function asSuNorm(s){
  return String(s == null ? "" : s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[®™]/g, "");
}

/* ---- Kopfzeile: Lupe öffnet das Suchfeld, Menü enthält Betrieb/Bereich/Konto (Nikolai 15.10.2026) ---- */
function asSuOeffnen(){
  const kopf = document.querySelector(".kopf"), f = document.getElementById("suchFeld"); if(!kopf || !f) return;
  kopf.classList.add("sucht"); asKopfMenue(false); f.value = AS_SU.q; f.focus(); f.select();
}
function asSuSchliessen(){
  const kopf = document.querySelector(".kopf"); if(kopf) kopf.classList.remove("sucht");
}
function asKopfMenue(auf){
  const m = document.getElementById("kopfMenue"), k = document.getElementById("kopfMenueKnopf"); if(!m) return;
  auf = auf === undefined ? m.hidden : auf;
  m.hidden = !auf; if(k) k.setAttribute("aria-expanded", String(auf));
}
function asSuFeld(){
  if(document.getElementById("suchFeld")) return;
  const kopf = document.querySelector(".kopf"); if(!kopf) return;
  const f = document.createElement("input");
  f.type = "search"; f.id = "suchFeld"; f.placeholder = "Suchen …"; f.autocomplete = "off"; f.setAttribute("aria-label", "Im Cockpit suchen");
  kopf.insertBefore(f, kopf.querySelector(".kopf-rechts"));
  f.oninput = () => { clearTimeout(AS_SU.timer); AS_SU.timer = setTimeout(() => {
    AS_SU.q = f.value.trim();
    if(AS.seite !== "suche"){ if(AS_SU.q.length >= 2) asGehe("suche"); }
    else asSuZeigen();
  }, 250); };
  f.onkeydown = ev => { if(ev.key === "Enter"){ AS_SU.q = f.value.trim(); AS.seite === "suche" ? asSuZeigen() : asGehe("suche"); }
    if(ev.key === "Escape"){ f.value = ""; AS_SU.q = ""; asSuSchliessen(); if(AS.seite === "suche") history.back(); } };
  f.onblur = () => { if(!f.value.trim()) setTimeout(asSuSchliessen, 150); };
  const lupe = document.getElementById("suchKnopf");
  if(lupe) lupe.onclick = () => kopf.classList.contains("sucht") && !f.value.trim() ? asSuSchliessen() : asSuOeffnen();
  const mk = document.getElementById("kopfMenueKnopf"), kx = document.getElementById("kopfKontext");
  if(mk) mk.onclick = ev => { ev.stopPropagation(); asKopfMenue(); };
  if(kx) kx.onclick = ev => { ev.stopPropagation(); asKopfMenue(); };
  document.addEventListener("click", ev => { const m = document.getElementById("kopfMenue");
    if(m && !m.hidden && !m.contains(ev.target) && !(mk && mk.contains(ev.target))) asKopfMenue(false); });
  document.addEventListener("keydown", ev => {
    if(ev.key === "Escape") asKopfMenue(false);
    if(ev.key === "/" && !/^(input|textarea|select)$/i.test((ev.target.tagName || "")) && !ev.target.isContentEditable){ ev.preventDefault(); asSuOeffnen(); }
  });
}
function asKopfKontext(){
  const kx = document.getElementById("kopfKontext"); if(!kx) return;
  const k = (AS.kunden || []).find(x => x.kunde_slug === AS.kunde), b = typeof asBereichName === "function" ? asBereichName() : "";
  kx.textContent = (k ? k.name : "Kein Betrieb") + " · " + (b || "Alle Bereiche");
  kx.hidden = !AS.kunde && !(AS.kunden || []).length;
}
const asSuKundeWahlRoh = asKundeWahl;
asKundeWahl = function(){
  asSuKundeWahlRoh(); asSuFeld(); asKopfKontext();
  if(AS_SU.kunde !== AS.kunde) AS_SU.daten = null;
  if(AS.seite === "suche"){ const kopf = document.querySelector(".kopf"), f = document.getElementById("suchFeld"); if(kopf && f && AS_SU.q){ kopf.classList.add("sucht"); if(f.value !== AS_SU.q) f.value = AS_SU.q; } }
  else if(!(document.getElementById("suchFeld") || {}).value) asSuSchliessen();
  // Auswahl im Menü: nach dem Wechsel Menü schließen
  ["kundeSel", "bereichSel"].forEach(id => { const s = document.getElementById(id); if(s) s.addEventListener("change", () => asKopfMenue(false)); });
};

/* ---- Daten: was schon geladen ist, plus wenige Zusatzabfragen (einmal je Kunde, 2 Minuten gültig) ---- */
async function asSuDaten(){
  if(AS_SU.daten && AS_SU.kunde === AS.kunde && Date.now() - AS_SU.zeit < 120000) return AS_SU.daten;
  if(typeof asBetriebLaden === "function") await asBetriebLaden().catch(() => {});
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde), h = p => apiGet(p + k).catch(() => []);
  const [gs, pers, rollen, bea, nw, po, ter, vf] = await Promise.all([
    h("/rest/v1/portal_gefahrstoff?select=id,bezeichnung,hersteller,artikelnummer,verwendung_status,sdb_pfad,einheit_ids,signalwort"),
    h("/rest/v1/uw_person?select=id,name,status"),
    h("/rest/v1/uw_rolle?select=id,name,status"),
    h("/rest/v1/as_beauftragter?select=id,funktion,person,einheit_id,gueltig_bis"),
    h("/rest/v1/portal_nachweis?select=id,person_name,art,bezeichnung,gueltig_bis,archiviert,as_einheit_id"),
    h("/rest/v1/as_pruefobjekt?select=id,art,bezeichnung,maschinen_id,ort,inventar_nr,naechste_am,aktiv,einheit_id"),
    h("/rest/v1/portal_termin?select=id,titel,art,faellig_am,objekt,erledigt_am,archiviert,einheit_id"),
    h("/rest/v1/portal_vorfaelle?select=id,art,ereignis_am,ort,anlage,beschreibung,as_einheit_id")]);
  AS_SU.daten = { gs, pers, rollen, bea, nw, po, ter, vf };
  AS_SU.kunde = AS.kunde; AS_SU.zeit = Date.now();
  return AS_SU.daten;
}

/* ---- Trefferliste bauen: jeder Treffer { art, titel, sub, text (durchsucht), los() } ---- */
function asSuEintraege(d){
  const l = [], add = (art, titel, sub, text, los, extra) => l.push(Object.assign({ art, titel, sub: sub || "", text: asSuNorm(titel + " " + (sub || "") + " " + (text || "")), los }, extra || {}));
  const sicht = k => AS_SEITEN[k] && !AS_SEITEN[k].versteckt && (AS.fachkraft || !AS_SEITEN[k].nurFachkraft);
  Object.keys(AS_SEITEN).filter(sicht).forEach(k => add("seite", AS_SEITEN[k].titel, "Seite im Cockpit", k + " " + (AS_SU_WOERTER[k] || ""), () => asGehe(k)));
  if(sicht("gefahrstoffe")) add("seite", "Handschuhplan", "Gefahrstoffe → Handschuhplan", "handschuh schutzhandschuh", () => asGehe("gefahrstoffe/handschuhe"));
  const einh = (AS.bereich && AS.bereich.einheiten) || [], eName = id => (einh.find(e => e.id === id) || {}).name || "";

  (typeof AS_B !== "undefined" && AS_B.docs || []).filter(x => x.kategorie !== "anlagen" && x.kategorie !== "allg-gbu").forEach(x =>
    add("dokument", asSvDokTitel(x), [x.kategorie, x.maschine, x.stand].filter(Boolean).join(" · "), x.maschinen_id, () => asDokOeffnen(asSvDokUrl(x), asSvDokTitel(x))));
  (typeof asAnlagen === "function" ? asAnlagen() : []).forEach(x => {
    const ki = (AS_B.kurz || {})[x.maschinen_id] || {};
    add("anlage", x.maschine || x.titel, [x.maschinen_id, String(x.maschinentyp || "").replace(/\s*\(.*\)\s*$/, ""), ki.bereich].filter(Boolean).join(" · "), ki.hersteller,
      () => { AS.anlFilter = { q: x.maschine || x.titel || "", band: "" }; asGehe("anlagen"); });
  });
  (typeof asMaengelRoh === "function" ? asMaengelRoh() : []).forEach(m => add("mangel", asMgFeld(m, "label") || "Mangel",
    [m.mangel_nr, m.maschine, m.status === "erledigt" ? "erledigt" : "offen"].filter(Boolean).join(" · "), (asMgFeld(m, "massnahme") || "") + " " + (m.maschinen_id || ""),
    () => { AS.mgFilter = { status: "alle", anlage: m.maschinen_id || "", band: "" }; asGehe("maengel"); }, { erledigt: m.status === "erledigt" }));
  asT("as_massnahme").filter(m => !m._v1).forEach(m => add("massnahme", m.text || "Maßnahme", [m.verantwortlich, m.termin, m.status].filter(Boolean).join(" · "), m.anlage, () => asGehe("massnahmen")));
  asT("as_arbeitssystem").forEach(s => add("bda", s.name, "Beurteilung der Arbeitsbedingungen" + (s.einheit_id ? " · " + eName(s.einheit_id) : ""), s.beschreibung,
    () => { AS.reiter.bda = s.id; asGehe("bda/" + s.id); }));
  (d.gs || []).forEach(g => add("gefahrstoff", g.bezeichnung, [g.hersteller, (g.einheit_ids || []).map(eName).filter(Boolean).join(", "), g.verwendung_status === "inaktiv" ? "nicht mehr verwendet" : ""].filter(Boolean).join(" · "),
    g.artikelnummer, () => { if(typeof AS_GS !== "undefined") AS_GS.oeffnen = g.id; asGehe("gefahrstoffe/kataster"); }, { sdb: g.sdb_pfad, erledigt: g.verwendung_status === "inaktiv" }));
  (d.pers || []).forEach(p => add("person", p.name, "Beschäftigte(r)" + (p.status && p.status !== "aktiv" ? " · " + p.status : ""), "", () => asGehe("unterweisungen")));
  (d.rollen || []).filter(r => r.status !== "archiviert").forEach(r => add("person", r.name, "Rolle / Tätigkeit", "rolle", () => asGehe("unterweisungen")));
  (d.bea || []).forEach(b => add("nachweis", b.person || "Beauftragte(r)", [b.funktion, eName(b.einheit_id), b.gueltig_bis ? "gültig bis " + b.gueltig_bis : ""].filter(Boolean).join(" · "), "", () => asGehe("nachweise")));
  (d.nw || []).filter(n => !n.archiviert).forEach(n => add("nachweis", n.person_name || n.bezeichnung || "Nachweis", [n.art, n.bezeichnung, n.gueltig_bis ? "gültig bis " + n.gueltig_bis : ""].filter(Boolean).join(" · "), "", () => asGehe("nachweise")));
  (d.po || []).filter(o => o.aktiv !== false).forEach(o => add("pruefung", o.bezeichnung || o.art, [o.art, o.ort, o.inventar_nr, o.naechste_am ? "nächste " + o.naechste_am : ""].filter(Boolean).join(" · "), o.maschinen_id, () => asGehe("pruefungen")));
  (d.ter || []).filter(t => !t.archiviert).forEach(t => add("termin", t.titel, [t.art, t.faellig_am, t.erledigt_am ? "erledigt" : ""].filter(Boolean).join(" · "), t.objekt, () => asGehe("kalender"), { erledigt: !!t.erledigt_am }));
  (d.vf || []).forEach(v => add("termin", (v.art || "Vorfall") + (v.ereignis_am ? " vom " + v.ereignis_am : ""), [v.ort, v.anlage].filter(Boolean).join(" · "), v.beschreibung, () => asGehe("vorfaelle")));
  einh.forEach(e => add("bereich", e.name, "Bereich der Organisation" + (e.leitung ? " · Leitung " + e.leitung : ""), e.kst_nr, () => asGehe("organisation")));
  return l;
}

function asSuTreffer(liste, q){
  const w = asSuNorm(q).split(/\s+/).filter(Boolean); if(!w.length) return [];
  return liste.map(e => {
    if(!w.every(x => e.text.includes(x))) return null;
    const t = asSuNorm(e.titel); let p = 0;
    w.forEach(x => { if(t.startsWith(x)) p += 3; else if(new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t)) p += 2; else if(t.includes(x)) p += 1; });
    if(e.erledigt) p -= 1;
    return Object.assign({ p }, e);
  }).filter(Boolean).sort((a, b) => b.p - a.p || String(a.titel).localeCompare(String(b.titel), "de", { numeric: true }));
}

/* ---- Ergebnisseite ---- */
AS_SEITEN.suche = { titel: "Suche", icon: "⌕", sort: 0.1, versteckt: true, async render(main){
  main.innerHTML = `<h1 class="seite">Suche</h1><div id="suInhalt"><div class="leer">wird geladen …</div></div>`;
  const f = document.getElementById("suchFeld"); if(f && f.value.trim() !== AS_SU.q) f.value = AS_SU.q;
  await asSuDaten();
  asSuZeigen();
}};

function asSuZeigen(){
  const box = document.getElementById("suInhalt"); if(!box || !AS_SU.daten) return;
  const alle = asSuTreffer(asSuEintraege(AS_SU.daten), AS_SU.q);
  const zahl = a => alle.filter(t => t.art === a).length;
  const sicht = AS_SU.art ? alle.filter(t => t.art === AS_SU.art) : alle;
  const bName = typeof asBereichName === "function" ? asBereichName() : "";
  const artName = a => (AS_SU_ARTEN.find(x => x[0] === a) || [a, a])[1];
  box.innerHTML = `<div class="karte nodruck" style="padding:10px 14px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="hinweis">${bName ? "Bereich: <b>" + esc(bName) + "</b> (im Menü ☰ umstellen)" : "Alle Bereiche – im Menü ☰ auf einen Bereich einschränken"}</span></div>
      <div class="reiter" style="margin-top:8px"><button class="${!AS_SU.art ? "an" : ""}" data-suart="">Alle (${alle.length})</button>${AS_SU_ARTEN.filter(([a]) => zahl(a)).map(([a, t]) =>
        `<button class="${AS_SU.art === a ? "an" : ""}" data-suart="${a}">${esc(t)} (${zahl(a)})</button>`).join("")}</div></div>
    ${AS_SU.q.length < 2 ? `<div class="karte"><div class="leer">Mindestens zwei Zeichen eingeben. Gesucht wird in Funktionen, Unterlagen, Anlagen, Mängeln, Maßnahmen, Beurteilungen, Gefahrstoffen, Personen, Nachweisen, Prüfungen, Terminen und Bereichen.</div></div>`
      : `<div class="karte"><div class="zeilen">${sicht.slice(0, 200).map((t, i) => `<div class="z" data-su="${i}" style="cursor:pointer"><div><b>${esc(t.titel)}</b><small>${esc(t.sub)}</small></div>
        <span class="reihe" style="gap:6px">${t.sdb ? `<button class="btn sek klein" data-susdb="${i}">SDB</button>` : ""}<span class="chip">${esc(artName(t.art))}</span></span></div>`).join("")
        || `<div class="leer">Nichts gefunden zu „${esc(AS_SU.q)}“${bName ? " im Bereich " + esc(bName) : ""}.</div>`}</div>
        ${sicht.length > 200 ? `<p class="hinweis">Die ersten 200 von ${sicht.length} Treffern – Suchbegriff genauer fassen.</p>` : ""}</div>`}`;
  box.querySelectorAll("[data-suart]").forEach(b => b.onclick = () => { AS_SU.art = b.dataset.suart; asSuZeigen(); });
  box.querySelectorAll("[data-su]").forEach(z => z.onclick = () => sicht[+z.dataset.su].los());
  box.querySelectorAll("[data-susdb]").forEach(b => b.onclick = ev => { ev.stopPropagation(); const t = sicht[+b.dataset.susdb];
    asDokOeffnen(asViewerUrl("pdf", t.sdb, "Sicherheitsdatenblatt · " + t.titel), "Sicherheitsdatenblatt · " + t.titel); });
}

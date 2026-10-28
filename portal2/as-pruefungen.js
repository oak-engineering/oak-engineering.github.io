/* OAK EHS-Cockpit – Prüfungen (Prüfkataster): jede prüfpflichtige Einrichtung einmal erfasst (Not-Halt, Schutztür-
   schalter, Krane, Leitern, E-Geräte …) und auf zwei Wegen geprüft: als Runde je Prüfart („alle Not-Halt“) oder je
   Maschine („alles an der D250/1“). Prüfarten mit Vorschlagsfrist und Rechtsgrundlage: AS_KAT.pruefarten
   (references/prozesse/app_kataloge.json). Tabellen as_pruefobjekt + as_pruefung; ein Trigger schreibt letzte Prüfung
   und nächste Fälligkeit ins Objekt. „Nicht in Ordnung“ und „Mängel“ werden ein Eintrag in der Mängelliste
   (portal_maengel, thema "pruefung") – derselbe Weg wie jeder andere Mangel. Globale Namen: asPf/AS_PF. */
"use strict";

const AS_PF_ARTEN = (AS_KAT.pruefarten && AS_KAT.pruefarten.liste) || [];
const AS_PF_ERG = { ok: ["in Ordnung", "gruen"], maengel: ["Mängel, Weiterbetrieb", "gelb"], nicht_ok: ["nicht in Ordnung", "rot"] };
AS_ICON.pruefungen = '<path d="M9 4h6v3H9z"/><path d="M9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15"/><path d="m8.5 13.5 2.5 2.5 4.5-5"/>';

function asPfArt(id){ return AS_PF_ARTEN.find(a => a.id === id) || { id, titel: id, gruppe: "Sonstige", grundlage: "", frage: "Prüfung durchgeführt" }; }
function asPfObjekte(){ return asT("as_pruefobjekt").filter(o => o.aktiv !== false); }
/* Stand eines Objekts: farbe + Text für Chips und Kacheln */
function asPfStand(o){
  const t = o.naechste_am ? asTageSeit(o.naechste_am) : null;          // > 0 = überfällig seit t Tagen
  if(o.letzte_ergebnis === "nicht_ok") return { k: "nicht_ok", farbe: "rot", text: "nicht in Ordnung" };
  if(!o.letzte_am && !o.naechste_am) return { k: "nie", farbe: "grau", text: "noch nicht geprüft" };
  if(t != null && t > 0) return { k: "ueberfaellig", farbe: "rot", text: "überfällig seit " + asDat(o.naechste_am) };
  if(t != null && t > -31) return { k: "bald", farbe: "gelb", text: "fällig " + asDat(o.naechste_am) };
  if(o.letzte_ergebnis === "maengel") return { k: "maengel", farbe: "gelb", text: "Mängel, nächste " + asDat(o.naechste_am) };
  return { k: "ok", farbe: "gruen", text: o.naechste_am ? "nächste " + asDat(o.naechste_am) : "geprüft " + asDat(o.letzte_am) };
}
function asPfAnlageName(mid){
  if(!mid) return "";
  const d = (typeof asAnlagen === "function" ? asAnlagen() : []).find(x => x.maschinen_id === mid);
  return d ? (d.maschine || d.titel) : mid;
}
function asPfOrt(o){ return [o.maschinen_id ? asPfAnlageName(o.maschinen_id) + " (" + o.maschinen_id + ")" : "", o.einheit_id ? asEinheitName(o.einheit_id) : "", o.ort, o.inventar_nr ? "Nr. " + o.inventar_nr : ""].filter(Boolean).join(" · "); }
function asPfSort(a, b){ return String(asPfAnlageName(a.maschinen_id) || a.ort || "").localeCompare(String(asPfAnlageName(b.maschinen_id) || b.ort || ""), "de", { numeric: true })
  || String(a.bezeichnung).localeCompare(String(b.bezeichnung), "de", { numeric: true }); }

/* ---------------- Seite ---------------- */
AS_SEITEN.pruefungen = { titel: "Prüfungen", icon: "✓", sort: 4.3, async render(main){
  main.innerHTML = `<h1 class="seite">Prüfungen</h1><p class="unter">wird geladen …</p>`;
  await asBetriebLaden();
  const r = asReiter("pruefungen", [["arten", "Nach Prüfart"], ["maschinen", "Nach Maschine"], ["kataster", "Prüfkataster"], ["verlauf", "Nachweise"], ["import", "Import"]], "arten");
  const obj = asPfObjekte(), st = obj.map(asPfStand);
  const n = k => st.filter(s => s.k === k).length;
  main.innerHTML = `<h1 class="seite">Prüfungen</h1><p class="unter">Prüfkataster: jede prüfpflichtige Einrichtung mit Frist, Prüfer und Nachweis. Prüfen als Runde je Prüfart oder je Maschine – „nicht in Ordnung“ landet automatisch in der Mängelliste.</p>
    ${r.html}
    <div class="kacheln">
      <div class="kachel k-${n("ueberfaellig") + n("nicht_ok") ? "rot" : "gruen"}"><div class="lbl">Überfällig / nicht in Ordnung</div><div class="zahl">${n("ueberfaellig") + n("nicht_ok")}</div><div class="hinweis">${n("ueberfaellig")} überfällig · ${n("nicht_ok")} nicht in Ordnung</div></div>
      <div class="kachel k-${n("bald") ? "gelb" : "gruen"}"><div class="lbl">Fällig in 30 Tagen</div><div class="zahl">${n("bald")}</div></div>
      <div class="kachel k-${n("nie") ? "gelb" : "gruen"}"><div class="lbl">Noch nicht geprüft</div><div class="zahl">${n("nie")}</div><div class="hinweis">ohne Prüfdatum im Kataster</div></div>
      <div class="kachel k-blau"><div class="lbl">Einrichtungen im Kataster</div><div class="zahl">${obj.length}</div><div class="hinweis">${new Set(obj.map(o => o.art)).size} Prüfarten</div></div>
    </div><div id="pfBox"></div>`;
  const box = main.querySelector("#pfBox");
  ({ arten: asPfArten, maschinen: asPfMaschinen, kataster: asPfKataster, verlauf: asPfVerlauf, import: asPfImport })[r.akt](box);
}};

/* Nach Prüfart: je Gruppe die Prüfarten mit Stand, Runde starten */
function asPfArten(box){
  const obj = asPfObjekte(), gruppen = [...new Set(AS_PF_ARTEN.map(a => a.gruppe))];
  box.innerHTML = gruppen.map(g => `<div class="karte"><h2>${esc(g)}</h2><div class="zeilen">${AS_PF_ARTEN.filter(a => a.gruppe === g).map(a => {
      const l = obj.filter(o => o.art === a.id), s = l.map(asPfStand), rot = s.filter(x => x.farbe === "rot").length, gelb = s.filter(x => x.farbe === "gelb" || x.k === "nie").length;
      return `<div class="z" data-art="${esc(a.id)}"><div><b>${esc(a.titel)}</b>
        <small>${l.length ? l.length + " Einrichtungen · " + (rot ? rot + " überfällig/nicht i. O. · " : "") + (gelb ? gelb + " fällig/ungeprüft" : "alle aktuell") : "noch keine Einrichtung erfasst"}
        · ${a.intervall ? "Vorschlag alle " + a.intervall + " Monate" : "Frist nach Einstufung"} · ${esc(a.grundlage)}</small></div>
        <span class="reihe" style="gap:6px">${l.length ? `<button class="btn klein" data-runde="${esc(a.id)}">Prüfrunde</button>` : ""}<button class="btn sek klein" data-neu="${esc(a.id)}">+ erfassen</button></span></div>`; }).join("")}</div></div>`).join("");
  box.querySelectorAll("[data-runde]").forEach(b => b.onclick = ev => { ev.stopPropagation(); const a = asPfArt(b.dataset.runde);
    asPfRunde(asPfObjekte().filter(o => o.art === a.id).sort(asPfSort), "Prüfrunde: " + a.titel); });
  box.querySelectorAll("[data-neu]").forEach(b => b.onclick = ev => { ev.stopPropagation(); asPfNeu(b.dataset.neu); });
  box.querySelectorAll("[data-art]").forEach(z => z.onclick = () => { AS.pfFilter = { art: z.dataset.art, q: "" }; asGehe("pruefungen/kataster"); });
}

/* Nach Maschine: je Anlage alle Prüfungen, Runde „alles an dieser Maschine“ */
function asPfMaschinen(box){
  const obj = asPfObjekte(), anl = asAnlagen().filter(d => d.maschinen_id && d.kategorie === "anlagen");
  const rang = { rot: 3, gelb: 2, grau: 1, gruen: 0 };
  const zeilen = anl.map(d => { const l = obj.filter(o => o.maschinen_id === d.maschinen_id).sort((a, b) => String(a.art).localeCompare(String(b.art)));
    const s = l.map(asPfStand), schlimm = s.reduce((m, x) => rang[x.farbe] > rang[m] ? x.farbe : m, l.length ? "gruen" : "grau");
    return { d, l, s, schlimm }; }).sort((a, b) => rang[b.schlimm] - rang[a.schlimm] || String(a.d.maschine || a.d.titel).localeCompare(String(b.d.maschine || b.d.titel), "de", { numeric: true }));
  const ohne = zeilen.filter(z => !z.l.length).length;
  box.innerHTML = `<div class="karte"><h2>${anl.length} Anlagen <span class="hinweis">${ohne ? ohne + " ohne erfasste Prüfungen" : ""}</span>
      ${AS.fachkraft || AS.admin ? `<button class="btn sek klein" id="pfMasse">Für mehrere Anlagen erfassen</button>` : ""}</h2>
    <div class="zeilen">${zeilen.map(z => `<div class="z" data-mid="${esc(z.d.maschinen_id)}"><div><b>${asPunkt(z.schlimm)}${esc(z.d.maschine || z.d.titel)} <span class="hinweis">${esc(z.d.maschinen_id)}</span></b>
        <small>${z.l.length ? z.l.map((o, i) => `${esc(asPfArt(o.art).titel.split(" – ")[0].split(" (")[0])}: ${esc(z.s[i].text)}`).join(" · ") : "keine Prüfungen erfasst"}</small></div>
        <span class="reihe" style="gap:6px">${z.l.length ? `<button class="btn klein" data-mrunde="${esc(z.d.maschinen_id)}">Prüfen</button>` : ""}<button class="btn sek klein" data-mneu="${esc(z.d.maschinen_id)}">+</button></span></div>`).join("") || `<div class="leer">Keine Anlagen.</div>`}</div></div>`;
  box.querySelectorAll("[data-mrunde]").forEach(b => b.onclick = ev => { ev.stopPropagation(); const mid = b.dataset.mrunde;
    asPfRunde(asPfObjekte().filter(o => o.maschinen_id === mid), "Prüfung: " + asPfAnlageName(mid)); });
  box.querySelectorAll("[data-mneu]").forEach(b => b.onclick = ev => { ev.stopPropagation(); asPfNeu("notaus", null, b.dataset.mneu); });
  box.querySelectorAll("[data-mid]").forEach(z => z.onclick = () => { AS.pfFilter = { art: "", q: z.dataset.mid }; asGehe("pruefungen/kataster"); });
  const m = document.getElementById("pfMasse"); if(m) m.onclick = asPfMasse;
}

/* Prüfkataster: alle Einrichtungen, filterbar */
function asPfKataster(box){
  const f = AS.pfFilter = AS.pfFilter || { art: "", q: "" };
  const alle = asT("as_pruefobjekt"), q = (f.q || "").toLowerCase();
  const sicht = alle.filter(o => (!f.art || o.art === f.art) && (f.inaktiv || o.aktiv !== false)
    && (!q || (o.bezeichnung + " " + asPfOrt(o) + " " + (o.maschinen_id || "") + " " + (o.pruefer || "")).toLowerCase().includes(q))).sort(asPfSort);
  box.innerHTML = `<div class="karte"><h2>${sicht.length} Einrichtungen</h2><div class="filterleiste nodruck">
      <select id="pfArt" aria-label="Prüfart"><option value="">Prüfart: alle</option>${AS_PF_ARTEN.map(a => `<option value="${esc(a.id)}" ${f.art === a.id ? "selected" : ""}>Prüfart: ${esc(a.titel)}</option>`).join("")}</select>
      <input type="search" id="pfQ" placeholder="Suchen (Anlage, Nr., Ort)" value="${esc(f.q || "")}">
      <button class="btn sek klein" id="pfNeu">+ Einrichtung</button>
      ${sicht.length ? `<button class="btn klein" id="pfRunde">Prüfrunde (${sicht.length})</button>` : ""}
      <button class="btn sek klein" id="pfCsv">CSV</button></div>
    <div class="zeilen">${sicht.map(o => { const s = asPfStand(o), a = asPfArt(o.art);
      return `<div class="z" data-o="${o.id}"><div><b>${esc(o.bezeichnung)}${o.aktiv === false ? " <span class=\"hinweis\">(außer Betrieb)</span>" : ""}</b>
        <small>${esc(a.titel)}${asPfOrt(o) ? " · " + esc(asPfOrt(o)) : ""} · ${o.intervall_monate ? "alle " + o.intervall_monate + " Monate" : "ohne Frist"}${o.pruefer ? " · Prüfer: " + esc(o.pruefer) : ""}${o.letzte_am ? " · zuletzt " + asDat(o.letzte_am) : ""}</small></div>
        ${asChip(s.text, s.farbe)}</div>`; }).join("") || `<div class="leer">Keine Einrichtungen${f.art || f.q ? " zum Filter" : ""}. Unter „Nach Prüfart“ erfassen oder per Import übernehmen.</div>`}</div></div>`;
  const neu = () => asZeige();
  box.querySelector("#pfArt").onchange = ev => { f.art = ev.target.value; neu(); };
  const qi = box.querySelector("#pfQ"); qi.oninput = () => { f.q = qi.value; clearTimeout(AS.pfT); AS.pfT = setTimeout(() => { neu(); const n = document.getElementById("pfQ"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 350); };
  box.querySelector("#pfNeu").onclick = () => asPfNeu(f.art || "notaus");
  const ru = box.querySelector("#pfRunde"); if(ru) ru.onclick = () => asPfRunde(sicht.filter(o => o.aktiv !== false), "Prüfrunde" + (f.art ? ": " + asPfArt(f.art).titel : ""));
  box.querySelector("#pfCsv").onclick = () => asPfCsv(sicht);
  box.querySelectorAll("[data-o]").forEach(z => z.onclick = () => asPfObjekt(asNach("as_pruefobjekt", z.dataset.o)));
}

/* Nachweise: letzte Prüfungen */
function asPfVerlauf(box){
  const l = asT("as_pruefung").slice().sort((a, b) => String(b.datum).localeCompare(String(a.datum)) || String(b.erstellt_am).localeCompare(String(a.erstellt_am))).slice(0, 300);
  box.innerHTML = `<div class="karte"><h2>Letzte Prüfungen <span class="hinweis">${asT("as_pruefung").length} insgesamt</span></h2><div class="zeilen">${l.map(p => {
      const o = asNach("as_pruefobjekt", p.objekt_id) || {}, e = AS_PF_ERG[p.ergebnis] || [p.ergebnis, "grau"];
      return `<div class="z" data-o="${esc(p.objekt_id)}"><div><b>${esc(o.bezeichnung || "–")}</b><small>${asDat(p.datum)} · ${esc(asPfArt(o.art).titel)}${p.pruefer_name ? " · " + esc(p.pruefer_name) : ""}${p.bemerkung ? " · " + esc(p.bemerkung) : ""}${p.quelle === "import" ? " · importiert" : ""}${p.mangel_id ? " · Mangel angelegt" : ""}</small></div>
        <span class="reihe" style="gap:6px">${p.nachweis_pfad ? `<button class="btn sek klein" data-nw="${esc(p.nachweis_pfad)}">Nachweis</button>` : ""}${asChip(e[0], e[1])}</span></div>`; }).join("") || `<div class="leer">Noch keine Prüfung eingetragen.</div>`}</div></div>`;
  asPfNachweisKnoepfe(box);
  box.querySelectorAll("[data-o]").forEach(z => z.onclick = () => { const o = asNach("as_pruefobjekt", z.dataset.o); if(o) asPfObjekt(o); });
}
function asPfNachweisKnoepfe(box){
  box.querySelectorAll("[data-nw]").forEach(b => b.onclick = async ev => { ev.stopPropagation(); const u = await asSigniert(b.dataset.nw);
    if(u) window.open(u, "_blank", "noopener"); else asMeldung("Nachweis konnte nicht geöffnet werden."); });
}

/* ---------------- Einrichtung anlegen / bearbeiten ---------------- */
function asPfFormular(o, art, mid){
  const a = asPfArt(o ? o.art : art), anl = asAnlagen().filter(d => d.maschinen_id);
  return `<div class="form">
    ${asAuswahl("Prüfart", "art", o ? o.art : a.id, AS_PF_ARTEN.map(x => [x.id, x.titel]), "voll")}
    ${asFeld("Bezeichnung (z. B. „Not-Halt-Taster Bedienseite“, „Leiter Nr. 47“)", "bezeichnung", o ? o.bezeichnung : "", "text", "voll")}
    ${asAuswahl("Anlage", "maschinen_id", o ? o.maschinen_id || "" : mid || "", [["", "– keine (Bereich / allgemein) –"]].concat(anl.map(d => [d.maschinen_id, (d.maschine || d.titel) + " (" + d.maschinen_id + ")"])))}
    ${asBereichWahl("Bereich", "einheit_id", o ? o.einheit_id || "" : null, "", "– wie die Anlage / betriebsweit –")}
    ${asFeld("Standort / Ort", "ort", o ? o.ort : "")}
    ${asFeld("Inventar-/Geräte-Nr.", "inventar_nr", o ? o.inventar_nr : "")}
    ${asFeld("Prüfintervall in Monaten", "intervall_monate", o ? o.intervall_monate : a.intervall, "number")}
    ${asFeld("Prüfer (befähigte Person / Firma)", "pruefer", o ? o.pruefer : "")}
    ${asFeld("Rechtsgrundlage", "grundlage", o ? o.grundlage : a.grundlage, "text", "voll")}
    ${o ? "" : asFeld("Letzte Prüfung (falls bekannt)", "letzte_am", "", "date")}
    ${o ? "" : asFeld("Nächste Prüfung fällig (falls abweichend)", "naechste_am", "", "date")}
    ${asFeld("Notiz", "notiz", o ? o.notiz : "", "textarea", "voll")}
    ${o ? asFeld("In Betrieb (abwählen = außer Betrieb, wird nicht mehr fällig)", "aktiv", o.aktiv !== false, "checkbox", "voll") : ""}</div>
    <p class="hinweis">${esc(a.hinweis || "Die Frist ist ein Vorschlag. Verbindlich ist die Frist aus der Gefährdungsbeurteilung (§ 3 Abs. 6 BetrSichV).")}</p>`;
}
function asPfNeu(art, o, mid){
  asDialog({ titel: o ? "Einrichtung bearbeiten" : "Einrichtung erfassen", inhalt: asPfFormular(o, art, mid), knoepfe: [{ t: "Speichern", fn: async d => {
    const w = asWerte(d);
    if(!w.bezeichnung){ asMeldung("Bitte eine Bezeichnung angeben."); return false; }
    if(!o){ if(w.letzte_am && w.intervall_monate && !w.naechste_am){ const x = new Date(w.letzte_am); x.setMonth(x.getMonth() + w.intervall_monate); w.naechste_am = x.toISOString().slice(0, 10); }
      w.erstellt_von = AS.ich; }
    else w.id = o.id;
    await asSpeichern("as_pruefobjekt", w); asMeldung("Gespeichert"); asZeige(); } }] });
  /* Prüfart gewechselt: Frist, Grundlage und Hinweis der neuen Prüfart übernehmen (Durchlauf 15.10.2026: Leiter bekam Not-Halt-Grundlage) */
  const dl = document.getElementById("dlg"), sel = dl.querySelector('[data-f="art"]');
  if(sel) sel.onchange = () => { const n = asPfArt(sel.value), f = k => dl.querySelector(`[data-f="${k}"]`);
    if(f("grundlage")) f("grundlage").value = n.grundlage || "";
    if(f("intervall_monate")) f("intervall_monate").value = n.intervall || "";
    const h = dl.querySelector(".dlg-inhalt > p.hinweis"); if(h) h.textContent = n.hinweis || "Die Frist ist ein Vorschlag. Verbindlich ist die Frist aus der Gefährdungsbeurteilung (§ 3 Abs. 6 BetrSichV)."; };
}
/* Mehrere Anlagen auf einmal (z. B. Not-Halt + Schutztür für alle Spritzgießmaschinen) */
function asPfMasse(){
  const anl = asAnlagen().filter(d => d.maschinen_id && d.kategorie === "anlagen"), obj = asT("as_pruefobjekt");
  asDialog({ titel: "Prüfungen für mehrere Anlagen erfassen", breit: true, inhalt: `
    <p class="hinweis">Legt je gewählter Anlage und Prüfart eine Einrichtung an. Bereits vorhandene Kombinationen werden übersprungen.</p>
    <div class="form"><div class="voll"><b>Prüfarten</b><div class="reihe" style="flex-wrap:wrap;gap:4px 14px;margin-top:6px">${AS_PF_ARTEN.filter(a => a.je_maschine).map(a =>
      `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-pfa="${esc(a.id)}" ${["notaus", "schutztuer"].includes(a.id) ? "checked" : ""}> ${esc(a.titel)}</label>`).join("")}</div></div>
    <div class="voll"><b>Anlagen</b> <button class="btn sek klein" type="button" id="pfAlle">alle</button> <button class="btn sek klein" type="button" id="pfSpritz">nur Spritzgießmaschinen</button>
      <div style="columns:2 220px;margin-top:6px">${anl.map(d => `<label style="flex-direction:row;gap:6px;align-items:center;break-inside:avoid"><input type="checkbox" data-pfm="${esc(d.maschinen_id)}" data-typ="${esc(d.maschinentyp || "")}"> ${esc(d.maschine || d.titel)} <span class="hinweis">${esc(d.maschinen_id)}</span></label>`).join("")}</div></div>
    ${asFeld("Letzte Prüfung (für alle, falls bekannt)", "letzte_am", "", "date")}
    ${asFeld("Prüfer", "pruefer", "")}</div>`,
    knoepfe: [{ t: "Anlegen", fn: async d => {
      const arten = [...d.querySelectorAll("[data-pfa]:checked")].map(x => x.dataset.pfa), mids = [...d.querySelectorAll("[data-pfm]:checked")].map(x => x.dataset.pfm), w = asWerte(d);
      if(!arten.length || !mids.length){ asMeldung("Bitte Prüfart und Anlagen wählen."); return false; }
      const zeilen = [];
      mids.forEach(mid => arten.forEach(art => { if(obj.some(o => o.maschinen_id === mid && o.art === art)) return; const a = asPfArt(art);
        let naechste = null; if(w.letzte_am && a.intervall){ const x = new Date(w.letzte_am); x.setMonth(x.getMonth() + a.intervall); naechste = x.toISOString().slice(0, 10); }
        zeilen.push({ kunde_slug: AS.kunde, art, bezeichnung: a.titel.split(" – ")[0].split(" (")[0] + " " + asPfAnlageName(mid), maschinen_id: mid,
          intervall_monate: a.intervall, grundlage: a.grundlage, pruefer: w.pruefer, letzte_am: w.letzte_am, naechste_am: naechste, erstellt_von: AS.ich }); }));
      if(!zeilen.length){ asMeldung("Alles schon vorhanden."); return; }
      await apiSend("POST", "/rest/v1/as_pruefobjekt", zeilen, "return=minimal");
      await asLaden(); asZeige(); asMeldung(zeilen.length + " Einrichtungen angelegt"); } }] });
  const dl = document.getElementById("dlg");
  dl.querySelector("#pfAlle").onclick = () => dl.querySelectorAll("[data-pfm]").forEach(x => x.checked = true);
  dl.querySelector("#pfSpritz").onclick = () => dl.querySelectorAll("[data-pfm]").forEach(x => x.checked = /spritzgie/i.test(x.dataset.typ));
}

/* Detail: Stand, Verlauf, Prüfung eintragen */
function asPfObjekt(o){
  if(!o) return;
  const a = asPfArt(o.art), s = asPfStand(o), verlauf = asT("as_pruefung").filter(p => p.objekt_id === o.id).sort((x, y) => String(y.datum).localeCompare(String(x.datum)));
  const dl = asDialog({ titel: o.bezeichnung, breit: true, inhalt: `
    <p>${asChip(s.text, s.farbe)} ${esc(a.titel)}${asPfOrt(o) ? " · " + esc(asPfOrt(o)) : ""}</p>
    ${asPfFormular(o, o.art)}
    <p class="hinweis">Prüfen: ${esc(a.frage || "")}<br>Grundlage: ${esc(o.grundlage || a.grundlage || "–")} · ${o.intervall_monate ? "alle " + o.intervall_monate + " Monate" : "ohne Frist"}${o.pruefer ? " · Prüfer: " + esc(o.pruefer) : ""}${a.wer ? " · wer prüft: " + esc(a.wer) : ""}</p>
    ${o.notiz ? `<p>${esc(o.notiz)}</p>` : ""}
    <h3>Verlauf</h3><div class="zeilen">${verlauf.map(p => { const e = AS_PF_ERG[p.ergebnis] || [p.ergebnis, "grau"];
      return `<div class="z"><div><b>${asDat(p.datum)}</b><small>${esc(p.pruefer_name || "")}${p.bemerkung ? " · " + esc(p.bemerkung) : ""}${p.mangel_id ? " · Mangel angelegt" : ""}</small></div>
        <span class="reihe" style="gap:6px">${p.nachweis_pfad ? `<button class="btn sek klein" data-nw="${esc(p.nachweis_pfad)}">Nachweis</button>` : ""}${asChip(e[0], e[1])}</span></div>`; }).join("") || `<div class="leer">Noch keine Prüfung eingetragen.</div>`}</div>`,
    knoepfe: [{ t: "Prüfung eintragen", klasse: "sek", fn: () => { setTimeout(() => asPfEintragen(o), 0); } },
      { t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.bezeichnung){ asMeldung("Bitte eine Bezeichnung angeben."); return false; }
        await asSpeichern("as_pruefobjekt", Object.assign(w, { id: o.id })); asMeldung("Gespeichert"); asZeige(); } }].concat(AS.admin ? [{ t: "Löschen", klasse: "sek", fn: async () => {
        if(!confirm("Einrichtung „" + o.bezeichnung + "“ mit allen Prüfungen löschen? Besser: außer Betrieb setzen.")) return false;
        await asLoeschen("as_pruefobjekt", o.id); AS.db.as_pruefung = asT("as_pruefung").filter(p => p.objekt_id !== o.id); asZeige(); } }] : []) });
  asPfNachweisKnoepfe(dl);
}
function asPfEintragen(o){
  asDialog({ titel: "Prüfung eintragen: " + o.bezeichnung, inhalt: `<div class="form">
      ${asFeld("Prüfdatum", "datum", asHeute(), "date")}
      ${asFeld("Geprüft von", "pruefer_name", o.pruefer || AS.ich)}
      ${asAuswahl("Ergebnis", "ergebnis", "ok", Object.entries(AS_PF_ERG).map(([k, v]) => [k, v[0]]), "voll")}
      ${asFeld("Bemerkung / festgestellte Mängel", "bemerkung", "", "textarea", "voll")}
      <label class="voll">Prüfprotokoll / Nachweis (PDF oder Foto, optional)<input type="file" accept="application/pdf,image/*" id="pfDatei"></label></div>
      <p class="hinweis">Bei „Mängel“ oder „nicht in Ordnung“ wird ein Eintrag in der Mängelliste angelegt.</p>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d), f = d.querySelector("#pfDatei").files[0];
      if((w.ergebnis !== "ok") && !w.bemerkung){ asMeldung("Bitte den Mangel kurz beschreiben."); return false; }
      const pfad = f ? await asPfDatei(f) : null;
      await asPfSpeichern([{ o, ergebnis: w.ergebnis, bemerkung: w.bemerkung, nachweis_pfad: pfad }], w.datum || asHeute(), w.pruefer_name, null);
      asMeldung("Prüfung gespeichert"); asZeige(); } }] });
}
async function asPfDatei(f){
  const endung = (f.name.match(/\.([a-z0-9]+)$/i) || [, "pdf"])[1].toLowerCase();
  const pfad = AS.kunde + "/pruefungen/" + asHeute() + "-" + Math.random().toString(36).slice(2, 8) + "." + endung;
  if(/^image\//.test(f.type)) return asFotoHochladen(f, pfad.replace(/\.[a-z0-9]+$/, ".jpg"));
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST",
    headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": f.type || "application/pdf", "x-upsert": "true" }, body: f });
  if(!r.ok) throw new Error("Upload fehlgeschlagen (" + r.status + ")");
  return pfad;
}

/* Ergebnisse speichern: Prüfung je Objekt, bei Mängeln Eintrag in der Mängelliste (thema "pruefung") */
async function asPfSpeichern(ergebnisse, datum, pruefer, runde){
  const zeilen = [];
  for(const e of ergebnisse){
    let mangelId = null;
    if(e.ergebnis !== "ok"){
      const a = asPfArt(e.o.art), band = e.ergebnis === "nicht_ok" ? "gefahr" : "besorgnis", mid = e.o.maschinen_id || "ALLG-HALLE";
      const dok = asAnlagen().find(x => x.maschinen_id === e.o.maschinen_id);
      const r = await apiSend("POST", "/rest/v1/portal_maengel", { kunde_slug: AS.kunde, kunde: AS.org ? AS.org.name : null, maschinen_id: mid,
        maschine: dok ? dok.maschine || dok.titel : (e.o.ort || "Halle / allgemein"), maschinentyp: dok ? dok.maschinentyp : "Tätigkeit / allgemein",
        schluessel: "PR-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6), thema: "pruefung", thema_rang: 0,
        label: "Prüfung " + a.titel + " (" + asDat(datum) + "): " + e.o.bezeichnung + " – " + (e.bemerkung || AS_PF_ERG[e.ergebnis][0]),
        rechtsquelle: e.o.grundlage || a.grundlage || null, band, prioritaet: band === "gefahr" ? 10 : 3010, status: "offen",
        termin: (() => { const t = new Date(datum); t.setDate(t.getDate() + (band === "gefahr" ? 14 : 42)); return t.toISOString().slice(0, 10); })(),
        einheit_id: e.o.einheit_id || (dok && dok.einheit_id) || null,
        gemeldet_von: pruefer || AS.ich, gemeldet_am: datum }, "return=representation").catch(err => { asMeldung("Mangel nicht angelegt: " + (err.message || err)); return null; });
      if(r && r[0]){ mangelId = r[0].id; await asMgLog(mangelId, "erfasst", "aus Prüfung " + a.titel, null); }
    }
    zeilen.push({ kunde_slug: AS.kunde, objekt_id: e.o.id, datum, ergebnis: e.ergebnis, pruefer_name: pruefer || AS.ich, bemerkung: e.bemerkung || null,
      mangel_id: mangelId, nachweis_pfad: e.nachweis_pfad || null, runde, quelle: "app", erstellt_von: AS.ich });
  }
  if(zeilen.length) await apiSend("POST", "/rest/v1/as_pruefung", zeilen, "return=minimal");
  await asLaden();
}

/* ---------------- Prüfrunde: eine Einrichtung je Bildschirm, Ergebnis antippen ---------------- */
function asPfRunde(liste, titel){
  if(!liste.length){ asMeldung("Keine Einrichtungen für diese Runde."); return; }
  const erg = {}; let i = -1, kopf = { datum: asHeute(), pruefer: AS.ich };
  const dl = asDialog({ titel, inhalt: `<div id="pfR"></div>` });
  const zeige = () => {
    const el = dl.querySelector("#pfR");
    if(i < 0){
      el.innerHTML = `<p>${liste.length} Einrichtungen. Je Einrichtung „in Ordnung“, „Mängel“ oder „nicht in Ordnung“ antippen – übersprungene bleiben ungeprüft.</p>
        <div class="form">${asFeld("Prüfdatum", "datum", kopf.datum, "date")}${asFeld("Geprüft von", "pruefer", kopf.pruefer)}</div>
        <div class="reihe" style="margin-top:14px;justify-content:flex-end"><button class="btn" id="pfLos">Runde starten</button></div>`;
      el.querySelector("#pfLos").onclick = () => { const w = asWerte(el); kopf = { datum: w.datum || asHeute(), pruefer: w.pruefer || AS.ich }; i = 0; zeige(); };
      return;
    }
    if(i >= liste.length){
      const n = k => Object.values(erg).filter(e => e.ergebnis === k).length, fehlt = liste.length - Object.keys(erg).length;
      el.innerHTML = `<p><b>Zusammenfassung</b> · ${asDat(kopf.datum)} · ${esc(kopf.pruefer)}</p>
        <p>${asChip(n("ok") + " in Ordnung", "gruen")} ${asChip(n("maengel") + " Mängel", "gelb")} ${asChip(n("nicht_ok") + " nicht in Ordnung", "rot")} ${fehlt ? asChip(fehlt + " übersprungen", "grau") : ""}</p>
        ${n("maengel") + n("nicht_ok") ? `<p class="hinweis">${n("maengel") + n("nicht_ok")} Einträge werden in der Mängelliste angelegt.</p>` : ""}
        <div class="reihe" style="margin-top:14px;justify-content:space-between"><button class="btn sek" id="pfZur">Zurück</button><button class="btn" id="pfFertig">Speichern</button></div>`;
      el.querySelector("#pfZur").onclick = () => { i = liste.length - 1; zeige(); };
      el.querySelector("#pfFertig").onclick = async ev => { ev.target.disabled = true;
        try{ await asPfSpeichern(Object.values(erg), kopf.datum, kopf.pruefer, "R-" + Date.now().toString(36)); dl.close(); asZeige(); asMeldung(Object.keys(erg).length + " Prüfungen gespeichert"); }
        catch(e){ ev.target.disabled = false; asMeldung("Fehler: " + (e.message || e)); } };
      return;
    }
    const o = liste[i], a = asPfArt(o.art), e = erg[o.id] || {}, s = asPfStand(o);
    el.innerHTML = `<div class="hinweis">${i + 1} von ${liste.length}</div>
      <div style="height:6px;background:var(--linie);border-radius:3px;margin:6px 0 12px"><div style="height:6px;width:${Math.round((i) / liste.length * 100)}%;background:var(--blau);border-radius:3px"></div></div>
      <h3>${esc(o.bezeichnung)}</h3>
      <p class="hinweis" style="margin:0 0 8px">${esc(a.titel)}${asPfOrt(o) ? " · " + esc(asPfOrt(o)) : ""} · ${esc(s.text)}</p>
      <p><b>Prüfen:</b> ${esc(a.frage || "Funktion in Ordnung")}</p>
      <div class="reihe" style="gap:8px;flex-wrap:wrap;margin:10px 0">${Object.entries(AS_PF_ERG).map(([k, v]) =>
        `<button class="btn ${e.ergebnis === k ? "" : "sek"}" data-erg="${k}" style="flex:1 1 140px;min-height:52px">${esc(v[0])}</button>`).join("")}</div>
      <label style="display:flex;flex-direction:column;gap:4px">Bemerkung${e.ergebnis && e.ergebnis !== "ok" ? " (was ist nicht in Ordnung?)" : " (optional)"}<textarea id="pfBem" rows="2">${esc(e.bemerkung || "")}</textarea></label>
      <div class="reihe" style="margin-top:14px;justify-content:space-between"><button class="btn sek" id="pfZur">Zurück</button><button class="btn sek" id="pfWeiter">${e.ergebnis ? "Weiter" : "Überspringen"}</button></div>`;
    const bem = el.querySelector("#pfBem");
    el.querySelectorAll("[data-erg]").forEach(b => b.onclick = () => { const k = b.dataset.erg;
      if(k !== "ok" && !bem.value.trim()){ erg[o.id] = { o, ergebnis: k, bemerkung: "" }; zeige(); el.querySelector("#pfBem").focus(); asMeldung("Bitte kurz beschreiben, was nicht in Ordnung ist."); return; }
      erg[o.id] = { o, ergebnis: k, bemerkung: bem.value.trim() }; i++; zeige(); });
    el.querySelector("#pfZur").onclick = () => { if(erg[o.id]) erg[o.id].bemerkung = bem.value.trim(); i--; zeige(); };
    el.querySelector("#pfWeiter").onclick = () => { if(erg[o.id]){ erg[o.id].bemerkung = bem.value.trim(); if(erg[o.id].ergebnis !== "ok" && !erg[o.id].bemerkung){ asMeldung("Bitte kurz beschreiben, was nicht in Ordnung ist."); return; } } i++; zeige(); };
  };
  zeige();
}

/* ---------------- Export / Import ---------------- */
function asPfCsv(liste){
  const sp = ["Prüfart", "Bezeichnung", "Anlage", "Anlagen-Nr.", "Ort", "Inventar-Nr.", "Intervall (Monate)", "Prüfer", "Letzte Prüfung", "Ergebnis", "Nächste Prüfung", "Stand", "Rechtsgrundlage"];
  const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const z = liste.map(o => [asPfArt(o.art).titel, o.bezeichnung, asPfAnlageName(o.maschinen_id), o.maschinen_id, o.ort, o.inventar_nr, o.intervall_monate, o.pruefer,
    asDat(o.letzte_am), o.letzte_ergebnis ? AS_PF_ERG[o.letzte_ergebnis][0] : "", asDat(o.naechste_am), asPfStand(o).text, o.grundlage].map(q).join(";"));
  const blob = new Blob(["﻿" + [sp.map(q).join(";")].concat(z).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Pruefkataster_" + AS.kunde + "_" + asHeute() + ".csv"; a.click();
}
/* Import: Tabelle aus Excel kopieren und einfügen (Tab-getrennt) oder CSV (;) – Spalten werden über die Überschriften erkannt */
const AS_PF_SPALTEN = { art: /pr[üu]fart|art|kategorie/i, bezeichnung: /bezeichnung|einrichtung|ger[äa]t|objekt|beschreibung/i, maschinen_id: /anlagen.?nr|maschinen.?id|wib-/i,
  anlage: /^anlage$|maschine/i, ort: /ort|standort|halle|bereich/i, inventar_nr: /inventar|ger[äa]te.?nr|^nr/i, intervall_monate: /intervall|frist|monat/i,
  pruefer: /pr[üu]fer|gepr[üu]ft von|durchgef[üu]hrt/i, letzte_am: /letzte|pr[üu]fdatum|datum|gepr[üu]ft am/i, ergebnis: /ergebnis|status|befund|i\.?\s?o/i, bemerkung: /bemerkung|mangel|notiz/i };
function asPfImport(box){
  box.innerHTML = `<div class="karte"><h2>Prüfliste übernehmen</h2>
    <p>Die Prüfliste in Excel markieren (mit Überschriftenzeile), kopieren und hier einfügen – oder eine CSV-Datei wählen. Die Spalten werden über die Überschriften erkannt und vor dem Speichern angezeigt.</p>
    <div class="form"><label class="voll">Tabelle einfügen<textarea id="pfIn" rows="8" placeholder="Prüfart	Bezeichnung	Anlage	Prüfdatum	Ergebnis	Prüfer …"></textarea></label>
      <label>oder CSV-Datei<input type="file" accept=".csv,text/csv,text/plain" id="pfDat"></label>
      ${asAuswahl("Prüfart, wenn die Tabelle keine Spalte dafür hat", "standard_art", "notaus", AS_PF_ARTEN.map(a => [a.id, a.titel]))}</div>
    <div class="reihe" style="margin-top:10px"><button class="btn" id="pfLesen">Vorschau</button></div><div id="pfVor"></div></div>`;
  box.querySelector("#pfDat").onchange = async ev => { const f = ev.target.files[0]; if(f) box.querySelector("#pfIn").value = await f.text(); };
  box.querySelector("#pfLesen").onclick = () => asPfVorschau(box, box.querySelector("#pfIn").value, asWerte(box).standard_art);
}
function asPfDatumLesen(s){
  s = String(s || "").trim(); let m;
  if((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + "-" + m[2] + "-" + m[3];
  if((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) return (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  if(/^\d{5}$/.test(s)){ const d = new Date(Date.UTC(1899, 11, 30) + (+s) * 864e5); return d.toISOString().slice(0, 10); }   // Excel-Seriennummer
  return null;
}
function asPfErgebnisLesen(s){
  s = String(s || "").toLowerCase().trim(); if(!s) return null;
  if(/nicht|n\.?\s?i\.?\s?o|defekt|fehl|^nein|^x$|gesperrt/.test(s)) return "nicht_ok";
  if(/m[äa]ngel|bedingt|eingeschr/.test(s)) return "maengel";
  if(/i\.?\s?o|ok|in ordnung|^ja|bestanden|^✓|^v$|aktiv|funktion/.test(s)) return "ok";
  return null;
}
function asPfArtLesen(s, std){
  s = String(s || "").toLowerCase(); if(!s) return std;
  const t = [["notaus", /not.?(aus|halt)/], ["schutztuer", /schutzt[üu]r|t[üu]rschalter|verriegel|zuhaltung/], ["endschalter", /endschalter|positionsschalter/], ["bws", /licht|scanner/],
    ["roboterzelle", /roboter|zaun/], ["kran", /kran|hebezeug|katze/], ["lastaufnahme", /anschlag|kette|gurt|lastaufnahme/], ["stapler", /stapler|flurf|hubwagen/], ["leiter", /leiter|tritt/],
    ["regal", /regal/], ["tor", /tor\b|tore/], ["elektro_fest", /ortsfest|anlage.*elektr|verteil/], ["elektro_mobil", /elektr|dguv.?v?3|ortsver|kabel/], ["druckanlage", /druck|kompressor/],
    ["feuerloescher", /l[öo]scher/], ["psa_absturz", /absturz|auffang/]].find(([, r]) => r.test(s));
  return t ? t[0] : std;
}
function asPfVorschau(box, text, stdArt){
  const vor = box.querySelector("#pfVor"); text = String(text || "").replace(/^﻿/, "").trim();
  if(!text){ vor.innerHTML = `<p class="hinweis">Bitte zuerst eine Tabelle einfügen.</p>`; return; }
  const trenn = text.split("\n")[0].includes("\t") ? "\t" : ";";
  const zeilen = text.split(/\r?\n/).filter(z => z.trim()).map(z => z.split(trenn).map(x => x.replace(/^"|"$/g, "").trim()));
  const kopf = zeilen.shift(), map = {};
  kopf.forEach((h, i) => { const k = Object.keys(AS_PF_SPALTEN).find(k => !(k in map) && AS_PF_SPALTEN[k].test(h)); if(k) map[k] = i; });
  const anl = asAnlagen().filter(d => d.maschinen_id);
  const findeAnlage = (nr, name) => { const s = String(nr || name || "").trim().toLowerCase(); if(!s) return null;
    const d = anl.find(x => x.maschinen_id.toLowerCase() === s) || anl.find(x => String(x.maschine || "").toLowerCase() === s)
      || anl.find(x => s.includes(String(x.maschine || "").toLowerCase()) && String(x.maschine || "").length > 2); return d ? d.maschinen_id : null; };
  const wert = (z, k) => k in map ? z[map[k]] : "";
  const satz = zeilen.map(z => { const art = asPfArtLesen(wert(z, "art"), stdArt), a = asPfArt(art), mid = findeAnlage(wert(z, "maschinen_id"), wert(z, "anlage"));
    const bez = wert(z, "bezeichnung") || (a.titel.split(" – ")[0].split(" (")[0] + (mid ? " " + asPfAnlageName(mid) : wert(z, "anlage") ? " " + wert(z, "anlage") : ""));
    return { art, bezeichnung: bez, maschinen_id: mid, anlage_text: wert(z, "anlage") || wert(z, "maschinen_id"), ort: wert(z, "ort") || null, inventar_nr: wert(z, "inventar_nr") || null,
      intervall_monate: parseInt(wert(z, "intervall_monate"), 10) || a.intervall || null, pruefer: wert(z, "pruefer") || null, datum: asPfDatumLesen(wert(z, "letzte_am")),
      ergebnis: asPfErgebnisLesen(wert(z, "ergebnis")) || (asPfDatumLesen(wert(z, "letzte_am")) ? "ok" : null), bemerkung: wert(z, "bemerkung") || null }; }).filter(s => s.bezeichnung);
  const erkannt = Object.keys(map).map(k => kopf[map[k]] + " → " + k).join(" · ");
  vor.innerHTML = `<p class="hinweis" style="margin-top:12px">Erkannte Spalten: ${esc(erkannt || "keine")}. ${satz.length} Zeilen.</p>
    <div class="tabwrap"><table class="tab"><thead><tr><th>Prüfart</th><th>Bezeichnung</th><th>Anlage</th><th>Prüfdatum</th><th>Ergebnis</th><th>Prüfer</th></tr></thead><tbody>${satz.slice(0, 200).map(s =>
      `<tr><td>${esc(asPfArt(s.art).titel)}</td><td>${esc(s.bezeichnung)}</td><td>${s.maschinen_id ? esc(s.maschinen_id) : `<span class="hinweis">${esc(s.anlage_text || "–")}${s.anlage_text ? " (nicht zugeordnet)" : ""}</span>`}</td>
        <td>${s.datum ? asDat(s.datum) : "–"}</td><td>${s.ergebnis ? asChip(AS_PF_ERG[s.ergebnis][0], AS_PF_ERG[s.ergebnis][1]) : "–"}</td><td>${esc(s.pruefer || "")}</td></tr>`).join("")}</tbody></table></div>
    <p class="hinweis">Vorhandene Einrichtungen (gleiche Prüfart und Anlage bzw. Bezeichnung) werden ergänzt, nicht doppelt angelegt. Prüfungen mit Datum werden als Nachweis „importiert“ eingetragen; Ergebnisse „nicht in Ordnung“ legen einen Mangel an.</p>
    <div class="reihe"><button class="btn" id="pfUebern">${satz.length} Zeilen übernehmen</button></div>`;
  vor.querySelector("#pfUebern").onclick = async ev => { ev.target.disabled = true;
    try{ const n = await asPfUebernehmen(satz); asMeldung(n.obj + " Einrichtungen neu, " + n.pr + " Prüfungen übernommen"); asGehe("pruefungen/kataster"); asZeige(); }
    catch(e){ ev.target.disabled = false; asMeldung("Import fehlgeschlagen: " + (e.message || e)); } };
}
async function asPfUebernehmen(satz){
  const vorh = asT("as_pruefobjekt").slice(), neu = [];
  const schluessel = s => s.art + "|" + (s.maschinen_id || "") + "|" + (s.maschinen_id ? "" : String(s.bezeichnung).toLowerCase());
  satz.forEach(s => { if(vorh.concat(neu).some(o => schluessel(o) === schluessel(s))) return;
    neu.push({ kunde_slug: AS.kunde, art: s.art, bezeichnung: s.bezeichnung, maschinen_id: s.maschinen_id, ort: s.ort, inventar_nr: s.inventar_nr,
      intervall_monate: s.intervall_monate, pruefer: s.pruefer, grundlage: asPfArt(s.art).grundlage, erstellt_von: AS.ich + " (Import)" }); });
  if(neu.length) await apiSend("POST", "/rest/v1/as_pruefobjekt", neu, "return=minimal");
  await asLaden();
  const alle = asT("as_pruefobjekt"), mitDatum = satz.filter(s => s.datum && s.ergebnis);
  const gruppen = {};
  mitDatum.forEach(s => { const o = alle.find(x => schluessel(x) === schluessel(s)); if(!o) return;
    if(asT("as_pruefung").some(p => p.objekt_id === o.id && p.datum === s.datum)) return;
    const k = s.datum + "|" + (s.pruefer || ""); (gruppen[k] = gruppen[k] || []).push({ o, ergebnis: s.ergebnis, bemerkung: s.bemerkung }); });
  let pr = 0;
  for(const [k, l] of Object.entries(gruppen)){ const [datum, pruefer] = k.split("|"); await asPfSpeichernImport(l, datum, pruefer); pr += l.length; }
  await asLaden();
  return { obj: neu.length, pr };
}
async function asPfSpeichernImport(l, datum, pruefer){
  const runde = "I-" + Date.now().toString(36);
  await asPfSpeichern(l, datum, pruefer || null, runde);
  // als Import kennzeichnen
  await apiSend("PATCH", "/rest/v1/as_pruefung?runde=eq." + encodeURIComponent(runde), { quelle: "import" }, "return=minimal").catch(() => {});
}

/* ---------------- Kennzahlen / Kalender (von Kern und Service genutzt) ---------------- */
function asPfKennzahlen(){
  const o = asPfObjekte().filter(x => x.intervall_monate || x.naechste_am), s = o.map(asPfStand);
  return { ueberfaellig: s.filter(x => x.k === "ueberfaellig").length, aktuell: o.length ? asProz(s.filter(x => x.k === "ok" || x.k === "bald" || x.k === "maengel").length, o.length) : 0 };
}
function asPfKalender(){
  return asPfObjekte().filter(o => o.naechste_am).map(o => ({ quelle: "pruefung", id: o.id, datum: String(o.naechste_am).slice(0, 10), art: "pruefung",
    titel: "Prüfung fällig: " + o.bezeichnung, sub: [asPfArt(o.art).titel, o.pruefer ? "Prüfer: " + o.pruefer : ""].filter(Boolean).join(" · "), ziel: "pruefungen/kataster", roh: o }));
}

/* OAK EHS-Cockpit — Kalender mit kritischen Terminen (Nikolai 17.09.2026: „Kalenderfunktion mit kritischen Terminen
   (UVV-Prüfungen, Ablauf Nachweise etc.)").
   Eigene Termine: portal_termin (Prüfungen, Wartung, Schulungen, Fristen) – Erledigen über termin_erledigen(), bei Intervall
   legt die Datenbank den Folgetermin an. Dazu automatisch: Ablauf von Qualifikationsnachweisen, nächste Vorsorge,
   Wiederholung der Unterweisung (12 Monate nach dem letzten Nachweis). Die Vorlagen nennen übliche Fristen mit Fundstelle –
   die verbindliche Frist legt der Betrieb in seiner Gefährdungsbeurteilung fest. */
"use strict";

let KAL_ROWS = [], KAL_GELADEN_FUER = null, KAL_ANSICHT = "liste", KAL_MONAT = null, KAL_FILTER = "";
const KAL_ART = { pruefung: "Prüfung", wartung: "Wartung", schulung: "Schulung", vorsorge: "Vorsorge", begehung: "Begehung", frist: "Frist", sonstiges: "Sonstiges",
                  nachweis: "Nachweis läuft ab", unterweisung: "Unterweisung" };
const KAL_INTERVALLE = [[0, "einmalig"], [1, "monatlich"], [3, "alle 3 Monate"], [6, "alle 6 Monate"], [12, "jährlich"], [24, "alle 2 Jahre"],
                        [36, "alle 3 Jahre"], [48, "alle 4 Jahre"], [60, "alle 5 Jahre"]];
/* [Titel, Art, Intervall in Monaten (0 = selbst festlegen), Grundlage] */
const KAL_VORLAGEN = [
  ["Prüfung Flurförderzeuge (Stapler)", "pruefung", 12, "DGUV Vorschrift 68 § 37 – mindestens jährlich durch Sachkundigen"],
  ["Prüfung Krane", "pruefung", 12, "DGUV Vorschrift 52 § 26 – mindestens jährlich durch Sachkundigen"],
  ["Prüfung ortsveränderliche elektrische Betriebsmittel", "pruefung", 12, "DGUV Vorschrift 3, Durchführungsanweisung – Richtwert 6 Monate, bei Fehlerquote unter 2 % in Betriebsstätten 1 Jahr"],
  ["Prüfung ortsfeste elektrische Anlagen und Betriebsmittel", "pruefung", 48, "DGUV Vorschrift 3, Durchführungsanweisung – Richtwert 4 Jahre"],
  ["Prüfung Leitern und Tritte", "pruefung", 12, "DGUV Information 208-016 – mindestens jährliche Prüfung empfohlen, Frist nach Gefährdungsbeurteilung"],
  ["Regalinspektion", "pruefung", 12, "TRBS 1201 / DGUV Regel 115-401 Tab. 13 – bewährte Frist einmal jährlich"],
  ["Prüfung kraftbetätigte Tore und Türen", "pruefung", 12, "ASR A1.7 – wiederkehrende sachkundige Prüfung, in der Regel jährlich"],
  ["Prüfung Feuerlöscher", "pruefung", 24, "ASR A2.2 – Prüfung durch Sachkundige mindestens alle 2 Jahre"],
  ["Wiederkehrende Prüfung Spritzgießmaschine", "pruefung", 0, "§ 14 BetrSichV – Frist aus der Gefährdungsbeurteilung festlegen (DGUV Information 113-606)"],
  ["Jährliche Unterweisung", "schulung", 12, "§ 12 ArbSchG, DGUV Vorschrift 1 § 4 – mindestens einmal jährlich"],
  ["Fortbildung Ersthelfer", "schulung", 24, "DGUV Vorschrift 1 § 26 – Fortbildung in der Regel alle 2 Jahre"],
  ["Sitzung Arbeitsschutzausschuss (ASA)", "sonstiges", 3, "§ 11 ASiG – mindestens einmal vierteljährlich"],
  ["Überprüfung Erste-Hilfe-Material", "wartung", 12, ""],
];

async function kalLaden(erzwingen){
  if(!erzwingen && KAL_GELADEN_FUER === AKTIV) return KAL_ROWS;
  try{ KAL_ROWS = await apiGet("/rest/v1/portal_termin?select=*&archiviert=is.false" + (AKTIV ? "&kunde_slug=eq." + encodeURIComponent(AKTIV) : "")
    + "&order=faellig_am.asc&limit=2000", false) || []; }
  catch(e){ KAL_ROWS = []; }
  KAL_GELADEN_FUER = AKTIV;
  return KAL_ROWS;
}

/* Alle offenen Termine: eigene + abgeleitete (Nachweise, Vorsorge, Unterweisungen). Einheitliches Format. */
function kalEintraege(){
  const liste = [];
  KAL_ROWS.filter(t => !t.erledigt_am && (!AKTIV || t.kunde_slug === AKTIV)).forEach(t => liste.push({
    quelle: "termin", id: t.id, datum: t.faellig_am, art: t.art, titel: t.titel,
    sub: [t.objekt, t.zustaendig ? "zuständig: " + t.zustaendig : "", t.intervall_monate ? (KAL_INTERVALLE.find(i => i[0] === t.intervall_monate) || [0, "alle " + t.intervall_monate + " Monate"])[1] : ""].filter(Boolean).join(" · "),
    ziel: null, roh: t }));
  (typeof NW_ROWS !== "undefined" ? NW_ROWS : []).filter(n => !n.archiviert && n.gueltig_bis && (!AKTIV || n.kunde_slug === AKTIV) && !nwErsetzt(n)).forEach(n => liste.push({
    quelle: "nachweis", id: n.id, datum: n.gueltig_bis, art: "nachweis", titel: nwArtLabel(n.art) + " läuft ab: " + n.person_name,
    sub: n.bezeichnung || "", ziel: ["mehr", "nachweise"], roh: n }));
  (typeof VS_ROWS !== "undefined" ? VS_ROWS : []).filter(v => v.naechste && (!AKTIV || v.kunde_slug === AKTIV) && !vsErsetzt(v)).forEach(v => liste.push({
    quelle: "vorsorge", id: v.id, datum: v.naechste, art: "vorsorge", titel: "Vorsorge fällig: " + v.person_name,
    sub: VS_ART[v.art] || "", ziel: ["mehr", "nachweise", "vorsorge"], roh: v }));
  try{
    if(typeof uwJeMitarbeiter === "function") uwJeMitarbeiter(uwSichtbar()).forEach(n => {
      const d = String(n.created_at || "").slice(0, 10); if(!d) return;
      liste.push({ quelle: "unterweisung", id: n.id, datum: ehsPlusMonate(d, 12), art: "unterweisung", titel: "Unterweisung wiederholen: " + n.mitarbeiter_name,
        sub: "zuletzt unterwiesen " + ehsDatum(d), ziel: ["mehr", "unterweisungen"], roh: n });
    });
  }catch(e){}
  return liste.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
}

async function renderKalender(wrap){
  const sec = document.createElement("section"); sec.className = "sektion kal-seite";
  sec.innerHTML = `<div class="ck-fuss">Kalender wird geladen …</div>`;
  wrap.appendChild(sec);
  await Promise.all([kalLaden(true), typeof nwLaden === "function" ? nwLaden() : null]);
  if(typeof HASH_Q !== "undefined" && HASH_Q && HASH_Q.get("neu")){ HASH_Q = null; setTimeout(() => kalTerminDialog(null), 50); }
  const zeichnen = () => {
    const alle = kalEintraege().filter(e => !KAL_FILTER || e.art === KAL_FILTER || (KAL_FILTER === "pruefung" && e.art === "wartung"));
    const filterOpt = [["", "Alle Termine"], ["pruefung", "Prüfungen & Wartung"], ["schulung", "Schulungen"], ["nachweis", "Nachweise"], ["vorsorge", "Vorsorge"],
                       ["unterweisung", "Unterweisungen"], ["frist", "Fristen"], ["sonstiges", "Sonstiges"]];
    sec.innerHTML = `<div class="kal-kopf">
        <div class="kal-knoepfe"><button type="button" class="btn" id="kalNeu">Termin anlegen</button>
          <button type="button" class="btn sek" id="kalVorlage">Aus Vorlage (UVV-Prüfungen …)</button></div>
        <div class="kal-rechts"><select class="uw-fassung" id="kalFilter" aria-label="Art">${filterOpt.map(o => `<option value="${o[0]}"${o[0] === KAL_FILTER ? " selected" : ""}>${o[1]}</option>`).join("")}</select>
          <div class="uw-pills"><button type="button" class="uw-pill${KAL_ANSICHT === "liste" ? " aktiv" : ""}" data-ansicht="liste">Liste</button><button type="button" class="uw-pill${KAL_ANSICHT === "monat" ? " aktiv" : ""}" data-ansicht="monat">Monat</button></div></div>
      </div>
      <div id="kalInhalt"></div>`;
    const inhalt = sec.querySelector("#kalInhalt");
    if(KAL_ANSICHT === "monat") kalMonat(inhalt, alle, zeichnen); else kalListe(inhalt, alle, zeichnen);
    sec.querySelector("#kalNeu").addEventListener("click", () => kalTerminDialog(null, null, zeichnenNeu));
    sec.querySelector("#kalVorlage").addEventListener("click", () => kalVorlagenDialog(zeichnenNeu));
    sec.querySelector("#kalFilter").addEventListener("change", ev => { KAL_FILTER = ev.target.value; zeichnen(); });
    sec.querySelectorAll("[data-ansicht]").forEach(b => b.addEventListener("click", () => { KAL_ANSICHT = b.dataset.ansicht; zeichnen(); }));
  };
  const zeichnenNeu = async () => { await kalLaden(true); zeichnen(); };
  zeichnen();
}

function kalZeile(e){
  const tage = ehsTage(e.datum), stufe = ehsStufe(tage, 30);
  const d = new Date(String(e.datum).slice(0, 10) + "T12:00:00");
  const akt = e.quelle === "termin"
    ? `<button type="button" class="btn sek kal-btn" data-erledigt="${esc(e.id)}">Erledigt</button><button type="button" class="btn-klein" data-aendern="${esc(e.id)}">ändern</button>`
    : `<button type="button" class="btn-klein" data-ziel="${esc(e.ziel.join("/"))}">ansehen</button>`;
  return `<div class="kal-zeile kal-${stufe}">
      <div class="kal-datum"><b>${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</b><span>${d.toLocaleDateString("de-DE", { weekday: "short", year: "numeric" })}</span></div>
      <div class="kal-text"><div class="kal-titel">${esc(e.titel)}</div>
        <div class="uw-leise">${esc(KAL_ART[e.art] || e.art)}${e.sub ? " · " + esc(e.sub) : ""}</div></div>
      <span class="uw-badge uw-${stufe}">${esc(ehsFristText(tage))}</span>
      <div class="kal-akt">${akt}</div></div>`;
}
function kalVerdrahten(box, neu){
  box.querySelectorAll("[data-erledigt]").forEach(b => b.addEventListener("click", () => kalErledigenDialog(KAL_ROWS.find(t => t.id === b.dataset.erledigt), neu)));
  box.querySelectorAll("[data-aendern]").forEach(b => b.addEventListener("click", () => kalTerminDialog(KAL_ROWS.find(t => t.id === b.dataset.aendern), null, neu)));
  box.querySelectorAll("[data-ziel]").forEach(b => b.addEventListener("click", () => { const z = b.dataset.ziel.split("/");
    if(z[2] && typeof NW_REITER !== "undefined") NW_REITER = z[2]; else if(z[1] === "nachweise" && typeof NW_REITER !== "undefined") NW_REITER = "qualifikation";
    portalGehe(z[0], z[1]); }));
}
function kalListe(box, alle, neuZeichnen){
  const neu = async () => { await kalLaden(true); neuZeichnen(); };
  const ueber = alle.filter(e => ehsTage(e.datum) < 0), bald = alle.filter(e => { const t = ehsTage(e.datum); return t >= 0 && t <= 30; }),
        spaeter = alle.filter(e => ehsTage(e.datum) > 30);
  const gruppe = (titel, l, zu) => l.length ? `<details class="kal-gruppe"${zu ? "" : " open"}><summary><h2 class="ul-bereich">${titel} <span class="akt-zahl">${l.length}</span></h2></summary>
      <div class="kal-zeilen">${l.map(kalZeile).join("")}</div></details>` : "";
  const erledigt = KAL_ROWS.filter(t => t.erledigt_am && (!AKTIV || t.kunde_slug === AKTIV) && ehsTage(t.erledigt_am) > -366)
    .sort((a, b) => String(b.erledigt_am).localeCompare(String(a.erledigt_am)));
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);
  box.innerHTML = (alle.length ? gruppe("Überfällig", ueber) + gruppe("Nächste 30 Tage", bald) + gruppe("Später", spaeter, spaeter.length > 12)
      : `<div class="leer">Noch keine Termine. Legen Sie Prüftermine an – am schnellsten über <b>„Aus Vorlage"</b>.</div>`)
    + (erledigt.length ? `<details class="kal-gruppe"><summary><h2 class="ul-bereich">Erledigt <span class="uw-leise">letzte 12 Monate</span> <span class="akt-zahl">${erledigt.length}</span></h2></summary>
        <div class="kal-zeilen">${erledigt.map(t => `<div class="kal-zeile kal-erledigt"><div class="kal-datum"><b>${esc(ehsDatum(t.erledigt_am).slice(0, 5))}</b><span>${esc(ehsDatum(t.erledigt_am).slice(6))}</span></div>
          <div class="kal-text"><div class="kal-titel">${esc(t.titel)}${t.objekt ? " · " + esc(t.objekt) : ""}</div>
          <div class="uw-leise">erledigt von ${esc(t.erledigt_von || "")}${t.erledigt_notiz ? " – " + esc(t.erledigt_notiz) : ""} · war fällig ${esc(ehsDatum(t.faellig_am))}</div></div>
          <span class="uw-badge uw-gut">erledigt</span>
          <div class="kal-akt">${istAdmin ? `<button type="button" class="btn-klein" data-zurueck="${esc(t.id)}">rückgängig</button>` : ""}</div></div>`).join("")}</div></details>` : "");
  kalVerdrahten(box, neu);
  box.querySelectorAll("[data-zurueck]").forEach(b => b.addEventListener("click", async () => {
    const t = KAL_ROWS.find(x => x.id === b.dataset.zurueck); if(!t || !confirm("Erledigung zurücknehmen? Ein automatisch angelegter Folgetermin wird entfernt.")) return;
    try{
      if(t.nachfolger_id){ const n = KAL_ROWS.find(x => x.id === t.nachfolger_id); if(n && !n.erledigt_am) await apiSend("DELETE", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(n.id), null, "return=minimal"); }
      await apiSend("PATCH", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(t.id), { erledigt_am: null, erledigt_von: null, erledigt_notiz: null, nachfolger_id: null,
        geaendert_von: "OAK engineering", geaendert_am: new Date().toISOString() }, "return=minimal");
      await neu();
    }catch(e){ alert("Konnte nicht zurückgenommen werden: " + (e.message || e)); }
  }));
}
function kalMonat(box, alle, neuZeichnen){
  const neu = async () => { await kalLaden(true); neuZeichnen(); };
  if(!KAL_MONAT){ const h = new Date(); KAL_MONAT = new Date(h.getFullYear(), h.getMonth(), 1); }
  const jahr = KAL_MONAT.getFullYear(), mon = KAL_MONAT.getMonth();
  const start = new Date(jahr, mon, 1 - ((new Date(jahr, mon, 1).getDay() + 6) % 7));
  const heute = ehsHeute();
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  let zellen = "";
  for(let i = 0; i < 42; i++){
    const d = new Date(start); d.setDate(start.getDate() + i); const k = iso(d);
    const tag = alle.filter(e => String(e.datum).slice(0, 10) === k);
    zellen += `<div class="kal-tag${d.getMonth() !== mon ? " kal-fremd" : ""}${k === heute ? " kal-heute" : ""}"><span class="kal-nr">${d.getDate()}</span>
      ${tag.slice(0, 3).map(e => `<button type="button" class="kal-punkt kal-${ehsStufe(ehsTage(e.datum), 30)}" data-idx="${esc(e.quelle + ":" + e.id)}" title="${esc(e.titel)}">${esc(e.titel)}</button>`).join("")}
      ${tag.length > 3 ? `<span class="uw-leise">+${tag.length - 3} weitere</span>` : ""}</div>`;
  }
  box.innerHTML = `<div class="kal-monat-kopf"><button type="button" class="btn-klein" id="kalZurueck">‹</button>
      <h2>${KAL_MONAT.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h2>
      <button type="button" class="btn-klein" id="kalVor">›</button><button type="button" class="btn-klein" id="kalHeute">Heute</button></div>
    <div class="tabelle-wrap"><div class="kal-raster">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(t => `<div class="kal-wt">${t}</div>`).join("")}${zellen}</div></div>`;
  box.querySelector("#kalZurueck").addEventListener("click", () => { KAL_MONAT = new Date(jahr, mon - 1, 1); neuZeichnen(); });
  box.querySelector("#kalVor").addEventListener("click", () => { KAL_MONAT = new Date(jahr, mon + 1, 1); neuZeichnen(); });
  box.querySelector("#kalHeute").addEventListener("click", () => { KAL_MONAT = null; neuZeichnen(); });
  box.querySelectorAll("[data-idx]").forEach(b => b.addEventListener("click", () => {
    const [q, id] = b.dataset.idx.split(":"); const e = alle.find(x => x.quelle === q && String(x.id) === id); if(!e) return;
    if(e.quelle === "termin") kalErledigenDialog(e.roh, neu, true);
    else { if(e.ziel[2] && typeof NW_REITER !== "undefined") NW_REITER = e.ziel[2]; portalGehe(e.ziel[0], e.ziel[1]); }
  }));
}

function kalTerminDialog(t, vorlage, danach){
  const dlg = ehsDialog("kalDlg", "kal-dlg");
  const v = vorlage || [];
  const wert = (feld, std) => t ? (t[feld] == null ? "" : t[feld]) : (std == null ? "" : std);
  const intervall = t ? (t.intervall_monate || 0) : (v[2] != null ? v[2] : 12);
  dlg.innerHTML = `<form method="dialog">
      <h3>${t ? "Termin ändern" : "Termin anlegen"}</h3>
      <label>Was?<input type="text" id="kalTitel" maxlength="200" value="${esc(wert("titel", v[0]))}" placeholder="z. B. UVV-Prüfung Stapler"></label>
      <div class="ehs-zwei"><label>Art<select id="kalArt">${["pruefung", "wartung", "schulung", "vorsorge", "begehung", "frist", "sonstiges"].map(a => `<option value="${a}"${a === wert("art", v[1] || "pruefung") ? " selected" : ""}>${KAL_ART[a]}</option>`).join("")}</select></label>
        <label>Fällig am<input type="date" id="kalDatum" value="${esc(wert("faellig_am", ""))}"></label></div>
      <label>Wiederholung<select id="kalIntervall">${KAL_INTERVALLE.map(i => `<option value="${i[0]}"${i[0] === intervall ? " selected" : ""}>${i[1]}</option>`).join("")}${intervall && !KAL_INTERVALLE.some(i => i[0] === intervall) ? `<option value="${intervall}" selected>alle ${intervall} Monate</option>` : ""}</select></label>
      ${vorlage && !v[2] ? `<p class="pw-hint">Frist bitte aus der Gefährdungsbeurteilung übernehmen.</p>` : ""}
      <label>Gerät, Maschine oder Bereich<input type="text" id="kalObjekt" list="kalObjekte" maxlength="200" value="${esc(wert("objekt", ""))}" placeholder="z. B. Stapler 3, Halle 14"></label>
      <datalist id="kalObjekte">${ehsMaschinenListe().map(m => `<option value="${esc(m)}">`).join("")}</datalist>
      <label>Zuständig<input type="text" id="kalZust" maxlength="120" value="${esc(wert("zustaendig", ""))}" placeholder="z. B. Instandhaltung, Fa. Muster (Prüfer)"></label>
      <label>Grundlage<input type="text" id="kalGrund" maxlength="300" value="${esc(wert("grundlage", v[3]))}"></label>
      <label>Notiz<textarea id="kalNotiz" rows="2" maxlength="2000">${esc(wert("notiz", ""))}</textarea></label>
      ${ehsNameFeld("kalWer")}
      <p class="pw-msg" id="kalMsg"></p>
      <div class="pw-akt">${t ? `<button type="button" class="btn-klein kal-weg" id="kalWeg">Entfernen</button>` : ""}<button type="button" class="btn sek" id="kalAbbruch">Abbrechen</button><button type="submit" class="btn">Speichern</button></div>
    </form>`;
  const msg = dlg.querySelector("#kalMsg");
  dlg.querySelector("#kalAbbruch").addEventListener("click", () => dlg.close());
  const weg = dlg.querySelector("#kalWeg");
  if(weg) weg.addEventListener("click", async () => {
    const wer = ehsNameLesen(dlg, "kalWer"); if(!wer){ msg.textContent = "Bitte Ihren Namen eintragen."; msg.className = "pw-msg fehler"; return; }
    if(!confirm("Termin „" + t.titel + "\" entfernen?")) return;
    try{ await apiSend("PATCH", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(t.id), { archiviert: true, geaendert_von: wer, geaendert_am: new Date().toISOString() }, "return=minimal");
      dlg.close(); if(danach) danach(); }
    catch(e){ msg.textContent = "Konnte nicht entfernt werden: " + (e.message || e); msg.className = "pw-msg fehler"; }
  });
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); msg.className = "pw-msg";
    const titel = dlg.querySelector("#kalTitel").value.trim(), datum = dlg.querySelector("#kalDatum").value;
    if(titel.length < 2){ msg.textContent = "Bitte eintragen, was ansteht."; msg.classList.add("fehler"); return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(datum)){ msg.textContent = "Bitte das Fälligkeitsdatum eintragen."; msg.classList.add("fehler"); return; }
    const wer = ehsNameLesen(dlg, "kalWer"); if(!wer){ msg.textContent = "Bitte Ihren Namen eintragen."; msg.classList.add("fehler"); return; }
    const iv = parseInt(dlg.querySelector("#kalIntervall").value, 10) || null;
    const daten = { titel, art: dlg.querySelector("#kalArt").value, faellig_am: datum, intervall_monate: iv,
      objekt: dlg.querySelector("#kalObjekt").value.trim() || null, zustaendig: dlg.querySelector("#kalZust").value.trim() || null,
      grundlage: dlg.querySelector("#kalGrund").value.trim() || null, notiz: dlg.querySelector("#kalNotiz").value.trim() || null,
      geaendert_von: wer, geaendert_am: new Date().toISOString() };
    try{
      if(t) await apiSend("PATCH", "/rest/v1/portal_termin?id=eq." + encodeURIComponent(t.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_termin", Object.assign({ kunde_slug: AKTIV, erstellt_von: wer }, daten), "return=minimal");
      dlg.close(); if(danach) danach();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
  dlg.showModal();
}

function kalErledigenDialog(t, danach, mitAendern){
  if(!t) return;
  const dlg = ehsDialog("kalErlDlg", "kal-dlg");
  const heute = ehsHeute();
  dlg.innerHTML = `<form method="dialog">
      <h3>Termin erledigt</h3>
      <p class="pw-hint"><b>${esc(t.titel)}</b>${t.objekt ? " · " + esc(t.objekt) : ""}<br>fällig ${esc(ehsDatum(t.faellig_am))}${t.grundlage ? "<br>" + esc(t.grundlage) : ""}</p>
      ${ehsNameFeld("kalErlWer", "Wer hat es erledigt?")}
      <label>Erledigt am<input type="date" id="kalErlDatum" value="${heute}" max="${heute}"></label>
      <label>Bemerkung (z. B. Prüfer, Ergebnis, Plakette)<textarea id="kalErlNotiz" rows="2" maxlength="2000"></textarea></label>
      <p class="pw-hint" id="kalErlNaechst"></p>
      <p class="pw-msg" id="kalErlMsg"></p>
      <div class="pw-akt">${mitAendern ? `<button type="button" class="btn-klein" id="kalErlAendern">ändern</button>` : ""}<button type="button" class="btn sek" id="kalErlAbbruch">Abbrechen</button><button type="submit" class="btn">Erledigt</button></div>
    </form>`;
  const naechst = () => { const d = dlg.querySelector("#kalErlDatum").value;
    dlg.querySelector("#kalErlNaechst").textContent = t.intervall_monate && d ? "Der nächste Termin wird automatisch für den " + ehsDatum(ehsPlusMonate(d, t.intervall_monate)) + " angelegt." : ""; };
  dlg.querySelector("#kalErlDatum").addEventListener("change", naechst); naechst();
  dlg.querySelector("#kalErlAbbruch").addEventListener("click", () => dlg.close());
  const ae = dlg.querySelector("#kalErlAendern"); if(ae) ae.addEventListener("click", () => { dlg.close(); kalTerminDialog(t, null, danach); });
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); const msg = dlg.querySelector("#kalErlMsg"); msg.className = "pw-msg";
    const wer = ehsNameLesen(dlg, "kalErlWer"); if(!wer){ msg.textContent = "Bitte eintragen, wer den Termin erledigt hat."; msg.classList.add("fehler"); return; }
    const d = dlg.querySelector("#kalErlDatum").value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > heute){ msg.textContent = "Bitte ein Datum bis heute eintragen."; msg.classList.add("fehler"); return; }
    try{
      await apiSend("POST", "/rest/v1/rpc/termin_erledigen", { p_id: t.id, p_datum: d, p_wer: wer, p_notiz: dlg.querySelector("#kalErlNotiz").value.trim() || null });
      dlg.close(); if(danach) danach();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
  dlg.showModal();
}

function kalVorlagenDialog(danach){
  const dlg = ehsDialog("kalVorlDlg", "sk-dlg");
  dlg.innerHTML = `<form method="dialog"><h3>Termin aus Vorlage</h3>
      <p class="pw-hint">Übliche Prüfungen und Fristen mit Fundstelle. Die verbindliche Frist legt der Betrieb in seiner Gefährdungsbeurteilung fest.</p>
      <div class="sk-auswahl">${KAL_VORLAGEN.map((v, i) => `<button type="button" class="sk-option kal-vorlage" data-i="${i}"><span><b>${esc(v[0])}</b>
        <span class="uw-leise">${v[2] ? esc((KAL_INTERVALLE.find(x => x[0] === v[2]) || [0, "alle " + v[2] + " Monate"])[1]) : "Frist selbst festlegen"}${v[3] ? " · " + esc(v[3]) : ""}</span></span></button>`).join("")}</div>
      <div class="pw-akt"><button type="button" class="btn sek" id="kalVorlZu">Schließen</button></div></form>`;
  dlg.querySelector("#kalVorlZu").addEventListener("click", () => dlg.close());
  dlg.querySelectorAll(".kal-vorlage").forEach(b => b.addEventListener("click", () => { dlg.close(); kalTerminDialog(null, KAL_VORLAGEN[parseInt(b.dataset.i, 10)], danach); }));
  dlg.showModal();
}

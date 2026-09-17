/* OAK EHS-Cockpit — „To-dos" (Seite) und Hinweis „N offene Aufgaben" auf der Startseite (Nikolai 17.09.2026: „Cockpit startet auf dem Schichtführer-PC automatisch
   und nennt konkrete To-dos/Termine, fordert also zur aktiven Arbeit auf – mit Quittierungssystem").
   Aufgaben entstehen aus den Daten, niemand muss sie anlegen:
     Termine (≤ 14 Tage oder überfällig) · ablaufende Nachweise (≤ 60 Tage) · fehlende Beauftragung · fällige Vorsorge ·
     Unterweisungen fällig · praktische Einarbeitung offen · Vorfälle ohne Auswertung · neue rechtliche Hinweise ·
     neue Antworten im Forum · (nur OAK) Mängel bewerten/übernehmen, offene Fragen.
   Rechtliche Neuerungen sind KEINE Aufgabe (Nikolai 17.09.: „rein informativ") – sie stehen nur in Aktuelles.
   Startseite: nur der Hinweis „9 offene Aufgaben" (Nikolai: „nicht so wuchtig"), Klick führt zu den To-dos.
   Erledigt wird am Ort der Aufgabe (Termin erledigen, Nachweis eintragen …) – dann verschwindet sie von selbst.
   Hinweise ohne eigene Handlung werden quittiert: portal_aufgabe_quittung (wer, wann, Notiz; Logbuch). Der Schlüssel enthält
   den Stand (z. B. „bald" → „abgelaufen"), damit eine Verschärfung wieder auftaucht. */
"use strict";

let AUF_QUITT = [];

async function aufQuittungenLaden(){
  try{ AUF_QUITT = await apiGet("/rest/v1/portal_aufgabe_quittung?select=*" + (AKTIV ? "&kunde_slug=eq." + encodeURIComponent(AKTIV) : "")
    + "&order=quittiert_am.desc&limit=1000", false) || []; }
  catch(e){ AUF_QUITT = []; }
}
function aufQuittiert(schluessel){ return AUF_QUITT.some(q => q.schluessel === schluessel && (!AKTIV || q.kunde_slug === AKTIV)); }
function aufKw(d){ const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const tag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - tag);
  return t.getUTCFullYear() + "-" + Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7); }

/* Liste der offenen Aufgaben: { schluessel, stufe (kritisch|warnung|info), titel, sub, frist, aktionen:[[text, fn]], quittierbar } */
function aufAufgaben(){
  const l = [], istAdmin = (typeof ADMIN !== "undefined" && ADMIN), neu = () => renderSektionen();
  if(!AKTIV) return l;
  /* 1. Termine */
  (typeof KAL_ROWS !== "undefined" ? KAL_ROWS : []).filter(t => t.kunde_slug === AKTIV && !t.erledigt_am && !t.archiviert).forEach(t => {
    const tage = ehsTage(t.faellig_am); if(tage > 14) return;
    l.push({ schluessel: "termin:" + t.id, stufe: tage < 0 ? "kritisch" : "warnung", titel: t.titel + (t.objekt ? " · " + t.objekt : ""),
      sub: (KAL_ART[t.art] || "Termin") + " · fällig " + ehsDatum(t.faellig_am) + (t.zustaendig ? " · zuständig: " + t.zustaendig : ""), frist: tage,
      aktionen: [["Erledigt", () => kalErledigenDialog(t, async () => { await kalLaden(true); neu(); })]] });
  });
  /* 2. Nachweise */
  (typeof NW_ROWS !== "undefined" ? NW_ROWS : []).filter(n => n.kunde_slug === AKTIV && !n.archiviert).forEach(n => {
    if(n.gueltig_bis && !nwErsetzt(n)){
      const tage = ehsTage(n.gueltig_bis);
      if(tage <= 60){ const st = tage < 0 ? "abgelaufen" : "bald";
        l.push({ schluessel: "nachweis:" + n.id + ":" + st, stufe: tage < 0 ? "kritisch" : "warnung", quittierbar: true,
          titel: nwArtLabel(n.art) + " von " + n.person_name + (tage < 0 ? " ist abgelaufen" : " läuft ab"), sub: "gültig bis " + ehsDatum(n.gueltig_bis) + (n.bezeichnung ? " · " + n.bezeichnung : ""), frist: tage,
          aktionen: [["Neuen Nachweis eintragen", () => nwDialog(null, async () => { await nwLaden(true); neu(); }, n.person_name)]] }); }
    }
    if(NW_BEAUFTRAGUNG.includes(n.art) && !n.beauftragt && !nwErsetzt(n))
      l.push({ schluessel: "beauftragung:" + n.id, stufe: "warnung", quittierbar: true, titel: "Schriftliche Beauftragung fehlt: " + n.person_name,
        sub: nwArtLabel(n.art) + " vorhanden, Beauftragung nicht vermerkt", aktionen: [["Nachweis öffnen", () => nwDialog(n, async () => { await nwLaden(true); neu(); })]] });
  });
  /* 3. Vorsorge */
  (typeof VS_ROWS !== "undefined" ? VS_ROWS : []).filter(v => v.kunde_slug === AKTIV && v.naechste && !vsErsetzt(v)).forEach(v => {
    const tage = ehsTage(v.naechste); if(tage > 60) return; const st = tage < 0 ? "ueberfaellig" : "bald";
    l.push({ schluessel: "vorsorge:" + v.id + ":" + st, stufe: tage < 0 ? "kritisch" : "warnung", quittierbar: true,
      titel: "Arbeitsmedizinische Vorsorge " + (tage < 0 ? "überfällig" : "fällig") + ": " + v.person_name, sub: v.anlass + " · fällig " + ehsDatum(v.naechste), frist: tage,
      aktionen: [["Termin beim Betriebsarzt eintragen", () => vsDialog(null, async () => { await nwLaden(true); neu(); }, v.person_name)]] });
  });
  /* 4. Unterweisungen */
  try{
    const bz = (typeof uwBelegZahlen === "function") ? uwBelegZahlen() : null;
    const n = bz ? bz.stammFaellig + bz.leihFaellig : ((typeof uwFaelligZahl === "function") ? uwFaelligZahl() : 0);
    if(n > 0) l.push({ schluessel: "unterweisung:" + aufKw(new Date()), stufe: "warnung", quittierbar: true,
      titel: n + (n === 1 ? " Beschäftigte/r ohne gültige Unterweisung" : " Beschäftigte ohne gültige Unterweisung"),
      sub: bz ? "Stammbelegschaft " + bz.stammFaellig + " · Leiharbeit " + bz.leihFaellig + " – am Terminal nachholen" : "am Terminal nachholen",
      aktionen: [["Terminal starten", () => portalGehe("mehr", "terminal")], ["Liste", () => portalGehe("mehr", "unterweisungen")]] });
    /* 5. praktische Einarbeitung: Nachweise der letzten 60 Tage ohne Bestätigung */
    if(typeof uwJeMitarbeiter === "function" && typeof uwEinarbeitung === "function") uwJeMitarbeiter(uwSichtbar()).forEach(nw => {
      if(ehsTage(String(nw.created_at).slice(0, 10)) < -60 || uwEinarbeitung(nw.mitarbeiter_name)) return;
      l.push({ schluessel: "einarbeitung:" + nw.id, stufe: "info", quittierbar: true, titel: "Praktische Einarbeitung bestätigen: " + nw.mitarbeiter_name,
        sub: "am Terminal unterwiesen am " + ehsDatum(nw.created_at) + (nw.funktion ? " · " + nw.funktion : ""),
        aktionen: [["Einarbeitung bestätigen", () => uwEinarbeitungDialog(nw.mitarbeiter_name, nw.funktion, neu)]] });
    });
  }catch(e){}
  /* 6. Vorfälle ohne Auswertung */
  (typeof VORFAELLE !== "undefined" ? VORFAELLE : []).filter(v => v.kunde_slug === AKTIV && v.status !== "neu" && v.status !== "erledigt" && v.domaene !== "umwelt"
    && !(v.ausgewertet_am || v.sofortmassnahme || v.langzeitmassnahme)).forEach(v => l.push({
      schluessel: "vorfall:" + v.id, stufe: "warnung", titel: "Vorfall auswerten: " + ({ unfall: "Unfall", beinahe: "Beinahe-Unfall", mangel: "Mangel" }[v.art] || "Vorfall") + (v.ort ? " · " + v.ort : ""),
      sub: "gemeldet für " + ehsDatum(v.ereignis_am) + " · Ausfalltage, Sofort- und Langzeitmaßnahme eintragen", aktionen: [["Auswerten", () => portalGehe("mehr", "vorfaelle")]] }));
  /* 8. Forum */
  (typeof ANFRAGEN !== "undefined" ? ANFRAGEN : []).filter(a => a.kunde_slug === AKTIV).forEach(a => {
    const zuOeffnen = () => { ANFR_OFFEN = a.id; ANFR_SCROLL = true; portalGehe("mehr", "anfragen"); };
    if(istAdmin && a.status !== "beantwortet")
      l.push({ schluessel: "frage:" + a.id, stufe: "warnung", titel: "Frage beantworten: " + a.betreff, sub: (a.von_name || "") + " · " + anfrDatum(a.letzte_aktivitaet || a.created_at), aktionen: [["Antworten", zuOeffnen]] });
    else if(!istAdmin && a.status === "beantwortet" && a.letzte_aktivitaet && ehsTage(String(a.letzte_aktivitaet).slice(0, 10)) >= -14)
      l.push({ schluessel: "antwort:" + a.id + ":" + String(a.letzte_aktivitaet).slice(0, 19), stufe: "info", quittierbar: true, quittText: "Gelesen",
        titel: "Neue Antwort: " + a.betreff, sub: "Fragen zur Arbeitssicherheit · " + anfrDatum(a.letzte_aktivitaet), aktionen: [["Lesen", zuOeffnen]] });
  });
  /* 9. Nur OAK: Mängel */
  if(istAdmin && typeof MAENGEL !== "undefined"){
    const mg = MAENGEL.filter(m => m.kunde_slug === AKTIV && !m.ausgeblendet);
    const ueb = mg.filter(m => m.status === "erledigt" && !m.uebernommen_am).length, bew = mg.filter(m => /^BM-/.test(m.schluessel || "") && m.status !== "erledigt" && !m.bewertung_manuell).length;
    const zu = s => () => { if(typeof MG_FILTER !== "undefined"){ MG_FILTER.maschine = ""; MG_FILTER.ampel = ""; MG_FILTER.status = s; } portalGehe("maengel"); };
    if(ueb) l.push({ schluessel: "oak-uebernehmen", stufe: "info", titel: ueb + " erledigte Mängel in GBU, BA und Mängelliste übernehmen", sub: "nur für OAK sichtbar", aktionen: [["ansehen", zu("uebernehmen")]] });
    if(bew) l.push({ schluessel: "oak-bewerten", stufe: "info", titel: bew + " vom Betrieb gemeldete Mängel bewerten", sub: "nur für OAK sichtbar", aktionen: [["ansehen", zu("offen")]] });
  }
  const rang = { kritisch: 0, warnung: 1, info: 2 };
  return l.filter(a => !(a.quittierbar && aufQuittiert(a.schluessel)))
    .sort((a, b) => (rang[a.stufe] - rang[b.stufe]) || ((a.frist ?? 999) - (b.frist ?? 999)));
}

async function aufLaden(){
  await Promise.all([
    typeof kalLaden === "function" ? kalLaden(true) : null, typeof nwLaden === "function" ? nwLaden(true) : null, aufQuittungenLaden(),
    typeof ladeAnfragen === "function" ? ladeAnfragen() : null,
    typeof uwEinarbeitungLaden === "function" ? uwEinarbeitungLaden() : null].map(p => Promise.resolve(p).catch(() => null)));
}

/* Startseite: ein schlanker Hinweis */
async function renderAufgabenHinweis(box){
  if(!box) return;
  box.innerHTML = "";
  await aufLaden();
  if(!box.isConnected) return;
  const liste = aufAufgaben(), ueber = liste.filter(a => a.stufe === "kritisch").length;
  box.innerHTML = liste.length
    ? `<a class="auf-hinweis${ueber ? " auf-h-kritisch" : ""}" href="#mehr/todos"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVG.todos}</svg>
        <b>${liste.length} ${liste.length === 1 ? "offene Aufgabe" : "offene Aufgaben"}</b><span class="auf-pfeil" aria-hidden="true">›</span></a>`
    : `<a class="auf-hinweis auf-h-leer" href="#mehr/todos"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_SVG.todos}</svg><b>Keine offenen Aufgaben</b></a>`;
}

/* Seite „To-dos" */
async function renderTodos(wrap){
  const box = document.createElement("section"); box.className = "sektion auf-seite";
  box.innerHTML = `<div class="ck-fuss">wird geladen …</div>`;
  wrap.appendChild(box);
  await aufLaden();
  const zeichnen = () => {
    const liste = aufAufgaben();
    const kuerzlich = AUF_QUITT.filter(q => (!AKTIV || q.kunde_slug === AKTIV) && ehsTage(String(q.quittiert_am).slice(0, 10)) >= -7);
    box.innerHTML = `<p class="uw-erkl">Aufgaben entstehen aus Kalender, Nachweisen, Vorsorge, Unterweisungen, Vorfällen und dem Forum.
        Erledigen Sie sie direkt hier – Hinweise ohne eigene Handlung quittieren Sie.</p>
      ${liste.length ? `<div class="auf-liste">${liste.map((a, i) => `<div class="auf-karte auf-${a.stufe}">
          <div class="auf-text"><b>${esc(a.titel)}</b>${a.sub ? `<span>${esc(a.sub)}</span>` : ""}</div>
          ${a.frist != null ? `<span class="uw-badge uw-${a.frist < 0 ? "kritisch" : "warnung"}">${esc(ehsFristText(a.frist))}</span>` : ""}
          <div class="auf-akt">${a.aktionen.map((x, j) => `<button type="button" class="${j === 0 ? "btn sek" : "btn-klein"}" data-auf="${i}" data-akt="${j}">${esc(x[0])}</button>`).join("")}
            ${a.quittierbar ? `<button type="button" class="btn-klein auf-quitt" data-quitt="${i}" title="Zur Kenntnis genommen – verschwindet aus der Liste, bleibt im Logbuch">${esc(a.quittText || "Quittieren")}</button>` : ""}</div>
        </div>`).join("")}</div>`
        : `<div class="auf-leer">Alles erledigt – keine offenen Aufgaben.</div>`}
      ${kuerzlich.length ? `<details class="auf-quittiert"><summary>Zuletzt quittiert <span class="uw-leise">${kuerzlich.length}</span></summary>
        <ul>${kuerzlich.map(q => `<li><span>${esc(q.titel || q.schluessel)}</span><span class="uw-leise">${esc(q.quittiert_von)} · ${esc(anfrDatum(q.quittiert_am))}${q.notiz ? " – " + esc(q.notiz) : ""}</span></li>`).join("")}</ul></details>` : ""}`;
    box.querySelectorAll("[data-auf]").forEach(b => b.addEventListener("click", () => liste[+b.dataset.auf].aktionen[+b.dataset.akt][1]()));
    box.querySelectorAll("[data-quitt]").forEach(b => b.addEventListener("click", () => aufQuittierenDialog(liste[+b.dataset.quitt], zeichnen)));
  };
  zeichnen();
}

function aufQuittierenDialog(a, danach){
  const dlg = ehsDialog("aufDlg");
  dlg.innerHTML = `<form method="dialog">
      <h3>${esc(a.quittText === "Gelesen" ? "Als gelesen quittieren" : "Aufgabe quittieren")}</h3>
      <p class="pw-hint"><b>${esc(a.titel)}</b>${a.sub ? "<br>" + esc(a.sub) : ""}</p>
      ${ehsNameFeld("aufWer", "Wer quittiert?")}
      <label>Notiz (optional)<textarea id="aufNotiz" rows="2" maxlength="1000" placeholder="z. B. Termin beim Schulungsanbieter angefragt"></textarea></label>
      <p class="pw-hint">Die Aufgabe verschwindet aus der Liste. Name, Uhrzeit und Notiz stehen im Logbuch.</p>
      <p class="pw-msg" id="aufMsg"></p>
      <div class="pw-akt"><button type="button" class="btn sek" id="aufAbbruch">Abbrechen</button><button type="submit" class="btn">${esc(a.quittText || "Quittieren")}</button></div>
    </form>`;
  dlg.querySelector("#aufAbbruch").addEventListener("click", () => dlg.close());
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); const msg = dlg.querySelector("#aufMsg"); msg.className = "pw-msg";
    const wer = ehsNameLesen(dlg, "aufWer"); if(!wer){ msg.textContent = "Bitte Ihren Namen eintragen."; msg.classList.add("fehler"); return; }
    try{
      await apiSend("POST", "/rest/v1/portal_aufgabe_quittung", { kunde_slug: AKTIV, schluessel: a.schluessel, titel: a.titel.slice(0, 300), quittiert_von: wer,
        notiz: dlg.querySelector("#aufNotiz").value.trim() || null }, "return=minimal");
    }catch(e){ if(!/409|duplicate|23505/.test(String(e.message || e))){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); return; } }
    await aufQuittungenLaden(); dlg.close(); if(danach) danach();
  });
  dlg.showModal();
}

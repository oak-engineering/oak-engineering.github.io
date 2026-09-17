/* OAK EHS-Cockpit — Schnellzugriffe auf der Startseite (Nikolai 17.09.2026: „Buttons mit der Überschrift Schnellzugriffe
   kennzeichnen, entfernen bzw. anpassen, weitere aus einer Liste auswählen").
   Auswahl je Nutzer und Bereich in portal_nutzer_einstellung.daten.schnellzugriffe = { arbeitssicherheit: [ids], … }.
   Ohne gespeicherte Auswahl gelten die Standardkacheln des Bereichs. */
"use strict";

const SK_NAV = n => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (typeof NAV_SVG !== "undefined" && NAV_SVG[n] ? NAV_SVG[n] : "") + "</svg>";
/* id: [Adresse, Titel, Untertitel, Symbol] – Symbol: Schluessel aus START_SVG oder NAV:<name> */
const SK_KATALOG = {
  terminal:        ["#mehr/terminal", "Unterweisung starten", "Terminal für die Beschäftigten", "terminal"],
  melden:          ["#mehr/melden", "Vorfall melden", "Unfall oder Beinahe-Unfall", "warnung"],
  mangel:          ["#maengel?neu=1", "Mangel erfassen", "An Maschine oder Halle, mit Foto", "mangel"],
  pruefen:         ["#mehr/pruefen", "Maschine prüfen", "Checkliste direkt an der Maschine", "begehung"],
  ba:              ["#unterlagen/ba", "Betriebsanweisungen", "Sammel-BA je Maschinentyp und je Maschine", "ba"],
  anfragen:        ["#mehr/anfragen", FRAGE_TITEL, "Fragen stellen und Antworten lesen – wie im Forum", "brief"],
  kalender:        ["#mehr/kalender", "Kalender", "Prüftermine, Fristen, ablaufende Nachweise", "NAV:kalender"],
  "termin-neu":    ["#mehr/kalender?neu=1", "Termin anlegen", "UVV-Prüfung, Wartung, Schulung", "NAV:kalender"],
  nachweise:       ["#mehr/nachweise", "Nachweise", "Staplerschein, Kranschein, Ersthelfer", "NAV:nachweise"],
  vorsorge:        ["#mehr/nachweise?reiter=vorsorge", "Betriebsärztliche Vorsorge", "Wer ist wann fällig", "NAV:nachweise"],
  aktuelles:       ["#mehr/aktuelles", "Aktuelles", "Rechtliche Neuerungen und Wochenrückblick", "aktuelles"],
  maengel:         ["#maengel", "Mängelliste", "Offene Mängel nach Priorität", "NAV:maengel"],
  kataster:        ["#unterlagen/anlagen", "Anlagenkataster", "Alle Anlagen mit Kurzinfo und Dokumenten", "dokument"],
  hallenplan:      ["#unterlagen/hallenplan", "Hallenplan", "Alle Maschinen mit offenen Mängeln", "NAV:unterlagen"],
  gbu:             ["#unterlagen/gbu", "Gefährdungsbeurteilungen", "Je Maschine und je Tätigkeit", "dokument"],
  qr:              ["#unterlagen/qr", "QR-Codes", "Je Anlage zum Ausdrucken", "dokument"],
  unterweisungen:  ["#mehr/unterweisungen", "Unterweisungen", "Wer ist fällig, Nachweise, Einstellungen", "NAV:unterweisungen"],
  vorfaelle:       ["#mehr/vorfaelle", "Vorfälle", "Gemeldete Vorfälle und Auswertung", "NAV:vorfaelle"],
  gefahrstoffe:    ["#unterlagen/gefahrstoffe", "Gefahrstoffkataster", "Sicherheitsdatenblätter, BA und GBU", "dokument"],
  begehungen:      ["#unterlagen/begehungen", "Begehungsprotokolle", "Was bei den Begehungen festgestellt wurde", "dokument"],
  upload:          ["#unterlagen/vom-betrieb", "Unterlagen hochladen", "Interne Unterlagen ablegen und ansehen", "NAV:unterlagen"],
  logbuch:         ["#mehr/logbuch", "Logbuch", "Wer hat wann was geändert", "NAV:logbuch"],
  "melden-umwelt": ["#mehr/melden?art=umwelt", "Umweltvorfall melden", "Austritt, Leckage, falsch entsorgt", "warnung"],
  "vf-umwelt":     ["#mehr/vf-umwelt", "Umweltvorfälle", "Gemeldete Vorfälle und ihr Stand", "liste"],
  "umwelt-unterlagen": ["#unterlagen", "Umwelt-Unterlagen", "Immissionsschutz, Gewässerschutz, AwSV", "dokument"],
  "e-massnahmen":  ["#unterlagen/energie-massnahmen", "Effizienzmaßnahmen", "Befunde aus den Begehungen", "blitz"],
  "e-verbrauch":   ["#unterlagen/energie-verbrauch", "Verbrauch & Messstellen", "Zähler und Messkonzept", "dokument"],
  "e-aspekte":     ["#unterlagen/energie-aspekte", "Energieaspekte", "Antriebe, Druckluft, Temperierung", "dokument"],
};
const SK_STANDARD = {
  arbeitssicherheit: ["terminal", "melden", "mangel", "pruefen", "ba", "anfragen", "aktuelles"],
  umwelt: ["melden-umwelt", "vf-umwelt", "umwelt-unterlagen", "anfragen"],
  energie: ["e-massnahmen", "e-verbrauch", "e-aspekte", "anfragen"],
};
let SK_EINST = null, SK_LADEN = null, SK_EDIT = false;

function skAuswahl(bereich){
  const eigene = SK_EINST && SK_EINST.schnellzugriffe && SK_EINST.schnellzugriffe[bereich];
  return (Array.isArray(eigene) ? eigene : (SK_STANDARD[bereich] || SK_STANDARD.arbeitssicherheit)).filter(id => SK_KATALOG[id]);
}
async function skLaden(){
  if(SK_EINST) return SK_EINST;
  if(!SK_LADEN) SK_LADEN = (async () => {
    try{ const r = await apiGet("/rest/v1/portal_nutzer_einstellung?select=daten", false); SK_EINST = (r && r[0] && r[0].daten) || {}; }
    catch(e){ try{ SK_EINST = JSON.parse(localStorage.getItem("oak_schnellzugriffe") || "{}"); }catch(e2){ SK_EINST = {}; } }
    return SK_EINST;
  })();
  return SK_LADEN;
}
async function skSpeichern(){
  try{ localStorage.setItem("oak_schnellzugriffe", JSON.stringify(SK_EINST)); }catch(e){}
  try{ await apiSend("POST", "/rest/v1/portal_nutzer_einstellung?on_conflict=user_id", { daten: SK_EINST, geaendert_am: new Date().toISOString() },
         "resolution=merge-duplicates,return=minimal"); }
  catch(e){ /* bleibt im Geraet gespeichert */ }
}
function skSetzen(bereich, liste){
  SK_EINST = SK_EINST || {};
  SK_EINST.schnellzugriffe = Object.assign({}, SK_EINST.schnellzugriffe || {}, { [bereich]: liste });
  skSpeichern();
}
function skSymbol(s){ return s.indexOf("NAV:") === 0 ? SK_NAV(s.slice(4)) : ((typeof START_SVG !== "undefined" && START_SVG[s]) || ""); }

/* Zeichnet Überschrift + Kacheln in den Container der Startseite */
function renderSchnellzugriffe(box, bereich){
  if(!box) return;
  const zeichnen = () => {
    const liste = skAuswahl(bereich);
    const kachel = (id, i) => { const k = SK_KATALOG[id];
      const inhalt = `<span class="sk-kopf"><span class="sk-titel">${esc(k[1])}</span>${skSymbol(k[3])}</span><span class="sk-sub">${esc(k[2])}</span>`;
      return SK_EDIT
        ? `<div class="start-kachel sk-edit" data-id="${esc(id)}">${inhalt}<span class="sk-werkzeug">
             <button type="button" data-sk="links" data-i="${i}" title="nach vorne"${i === 0 ? " disabled" : ""}>←</button>
             <button type="button" data-sk="rechts" data-i="${i}" title="nach hinten"${i === liste.length - 1 ? " disabled" : ""}>→</button>
             <button type="button" data-sk="weg" data-i="${i}" title="entfernen" class="sk-weg">✕</button></span></div>`
        : `<a class="start-kachel" href="${k[0]}">${inhalt}</a>`; };
    box.innerHTML = `<div class="start-blick-kopf schnell-kopf"><h2>Schnellzugriffe</h2>
        <span class="schnell-knoepfe">${SK_EDIT
          ? `<button type="button" class="btn-klein" id="skStandard">Standard wiederherstellen</button><button type="button" class="btn sek" id="skFertig">Fertig</button>`
          : `<button type="button" class="btn-klein" id="skAnpassen">Anpassen</button>`}</span></div>
      <div class="start-raster${SK_EDIT ? " sk-bearbeiten" : ""}">${liste.map(kachel).join("")}
        ${SK_EDIT ? `<button type="button" class="start-kachel sk-neu" id="skNeu"><span class="sk-plus">+</span><span class="sk-titel">Schnellzugriff hinzufügen</span></button>` : ""}</div>`;
    const an = box.querySelector("#skAnpassen"); if(an) an.addEventListener("click", () => { SK_EDIT = true; zeichnen(); });
    const fe = box.querySelector("#skFertig"); if(fe) fe.addEventListener("click", () => { SK_EDIT = false; zeichnen(); });
    const st = box.querySelector("#skStandard"); if(st) st.addEventListener("click", () => {
      if(!confirm("Standard-Schnellzugriffe für diesen Bereich wiederherstellen?")) return;
      if(SK_EINST && SK_EINST.schnellzugriffe){ delete SK_EINST.schnellzugriffe[bereich]; skSpeichern(); } zeichnen(); });
    box.querySelectorAll("[data-sk]").forEach(b => b.addEventListener("click", () => {
      const l = skAuswahl(bereich).slice(), i = parseInt(b.dataset.i, 10);
      if(b.dataset.sk === "weg") l.splice(i, 1);
      else { const j = b.dataset.sk === "links" ? i - 1 : i + 1; if(j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; }
      skSetzen(bereich, l); zeichnen();
    }));
    const neu = box.querySelector("#skNeu"); if(neu) neu.addEventListener("click", () => skHinzufuegenDialog(bereich, zeichnen));
  };
  zeichnen();
  if(!SK_EINST) skLaden().then(zeichnen);
}

function skHinzufuegenDialog(bereich, danach){
  const vorhanden = new Set(skAuswahl(bereich));
  const frei = Object.keys(SK_KATALOG).filter(id => !vorhanden.has(id));
  let dlg = document.getElementById("skDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "skDlg"; dlg.className = "pw-dlg sk-dlg"; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog"><h3>Schnellzugriff hinzufügen</h3>
      ${frei.length ? `<div class="sk-auswahl">${frei.map(id => { const k = SK_KATALOG[id];
        return `<button type="button" class="sk-option" data-id="${esc(id)}">${skSymbol(k[3])}<span><b>${esc(k[1])}</b><span class="uw-leise">${esc(k[2])}</span></span></button>`; }).join("")}</div>`
        : `<p class="pw-hint">Alle Schnellzugriffe sind schon auf der Startseite.</p>`}
      <div class="pw-akt"><button type="button" class="btn sek" id="skDlgZu">Schließen</button></div></form>`;
  dlg.querySelector("#skDlgZu").addEventListener("click", () => dlg.close());
  dlg.querySelectorAll(".sk-option").forEach(b => b.addEventListener("click", () => {
    skSetzen(bereich, skAuswahl(bereich).concat([b.dataset.id])); dlg.close(); danach();
  }));
  dlg.showModal();
}

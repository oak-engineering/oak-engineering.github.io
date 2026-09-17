/* OAK EHS-Cockpit — Versionshinweise (Nikolai 17.09.2026). Neueste Version oben.
   Bei jeder Auslieferung mit sichtbaren Änderungen einen Eintrag ergänzen und EHS_VERSION hochzählen – die Fußzeile
   zeigt die Nummer und verlinkt hierher. Texte für die Nutzer im Betrieb: kurz, ohne Technik. */
"use strict";

const EHS_VERSION = "1.0";
const EHS_VERSIONEN = [
  { version: "1.0", datum: "2026-09-17", titel: "Start des OAK EHS-Cockpits", gruppen: [
    ["Start & Übersicht", [
      "Startseite mit „Auf einen Blick“ und anpassbaren Schnellzugriffen",
      "Hinweis auf offene Aufgaben – die Liste steht unter „To-dos“: erledigen oder quittieren, mit Name und Uhrzeit",
      "Seitenleiste auch im Browser, installierbar als App (auf Wunsch mit Autostart am PC)"]],
    ["Mängel & Anlagen", [
      "Mängelliste nach Priorität, Mängel mit Foto und Gefahrenpotenzial erfassen, als erledigt melden",
      "Anlagenkataster mit Kurzinfo je Anlage, offenen Mängeln und allen Dokumenten",
      "Gefährdungsbeurteilungen, Betriebsanweisungen (Sammel-BA je Maschinentyp), QR-Codes, Hallenplan, Begehungsprotokolle",
      "Kennzeichen „nicht mehr aktuell“, wenn behobene Mängel noch nicht in die Dokumente eingearbeitet sind"]],
    ["Gefahrstoffe", [
      "Gefahrstoffkataster mit GHS-Piktogrammen, H-Sätzen, Sicherheitsdatenblatt, Betriebsanweisung und Hautschutzplänen"]],
    ["Termine & Nachweise", [
      "Kalender für Prüfungen und Fristen – mit Vorlagen (Stapler, Krane, E-Prüfung, Leitern, Tore, Feuerlöscher …), Folgetermin automatisch",
      "Qualifikationsnachweise (Stapler, Kran, Ersthelfer …) mit Ablaufdatum und Beauftragung",
      "Betriebsärztliche Vorsorge als Vorsorgekartei – nur Anlass und Termine, keine Befunde"]],
    ["Unterweisungen", [
      "Unterweisungs-Terminal am PC, Tablet oder Handy – Link nur freigeschaltet, solange er gebraucht wird",
      "Module je Rolle festlegen, Zählung der fälligen Beschäftigten (Stammbelegschaft und Leiharbeit)",
      "Praktische Einarbeitung je Mitarbeiter bestätigen"]],
    ["Vorfälle, Fragen & Nachvollziehbarkeit", [
      "Vorfälle per QR-Code melden, später auswerten (Ausfalltage, Sofort- und Langzeitmaßnahme), Aushang drucken",
      "Fragen zur Arbeitssicherheit als Forum – Antworten direkt im Cockpit",
      "Dokumente in Tabs öffnen, per E-Mail teilen, Frage zum Dokument stellen",
      "Aktuelles mit rechtlichen Neuerungen, Logbuch mit Wochenbericht (Was lief · Was steht an)",
      "Datenschutzhinweise mit Stand des Auftragsverarbeitungsvertrags"]]
  ]}
];

function renderVersionshinweise(box){
  if(!box) return;
  const datum = s => { const t = String(s).split("-"); return t[2] + "." + t[1] + "." + t[0]; };
  box.innerHTML = EHS_VERSIONEN.map((v, i) => `<article class="vh-version${i === 0 ? " vh-aktuell" : ""}">
      <div class="vh-kopf"><b>Version ${esc(v.version)}</b><span class="uw-leise">${esc(datum(v.datum))}</span>${i === 0 ? '<span class="akt-neu">aktuell</span>' : ""}</div>
      ${v.titel ? `<div class="vh-titel">${esc(v.titel)}</div>` : ""}
      <div class="vh-gruppen">${v.gruppen.map(g => `<div class="vh-gruppe"><h4>${esc(g[0])}</h4><ul>${g[1].map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}</div>
    </article>`).join("");
}

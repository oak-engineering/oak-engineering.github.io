/* OAK EHS-Cockpit — „Nicht mehr aktuell"-Kennzeichen für GBU, BA und Mängelliste (Nikolai 17.09.2026:
   „wenn Mängel behoben wurden, müssen die zugehörigen Dokumente bis zur nächsten Überarbeitung als nicht mehr
   aktuell gekennzeichnet werden – kleines Symbol auf den Buttons und im Dokument mit Mouse-over").
   Regel: an der Maschine ist ein Mangel als erledigt gemeldet, NACH dem Stand des Dokuments, und noch nicht als
   „in die Unterlagen übernommen" markiert. Neues Dokument (neuer Stand) oder „übernommen" -> Kennzeichen weg.
   Das Begehungsprotokoll wird nie gekennzeichnet (hält einen Stichtag fest). Genutzt von app.js, maschine.js, viewer.js. */
"use strict";

const VERALT_TYPEN = ["bda", "ba", "maengelliste"];
const VERALT_SYMBOL = '<svg class="veraltet-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>';

function dokVeraltetInfo(row, maengel, typ){
  if(!row || !Array.isArray(maengel) || (typ && !VERALT_TYPEN.includes(typ))) return null;
  const stand = String(row.stand || "").slice(0, 10);
  const liste = maengel.filter(m => m.maschinen_id === row.maschinen_id && (!row.kunde_slug || !m.kunde_slug || m.kunde_slug === row.kunde_slug)
    && !m.ausgeblendet && m.status === "erledigt" && !m.uebernommen_am && (!stand || String(m.erledigt_am || "").slice(0, 10) > stand));
  if(!liste.length) return null;
  const seit = liste.map(m => String(m.erledigt_am || "").slice(0, 10)).sort()[0];
  return { anzahl: liste.length, seit, liste };
}
function dokVeraltetDatum(s){ const t = String(s || "").split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : ""; }
function dokVeraltetText(v){
  return "Nicht mehr aktuell: " + (v.anzahl === 1 ? "1 Mangel wurde" : v.anzahl + " Mängel wurden") + " seit " + dokVeraltetDatum(v.seit)
    + " als behoben gemeldet und " + (v.anzahl === 1 ? "ist" : "sind") + " hier noch nicht eingearbeitet. Die Überarbeitung übernimmt OAK engineering.";
}
/* kleines Symbol für Knöpfe/Links (Text im title = Mouse-over) */
function dokVeraltetSymbol(v){
  if(!v) return "";
  const t = dokVeraltetText(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<span class="dok-veraltet" title="${t}" aria-label="${t}">${VERALT_SYMBOL}</span>`;
}

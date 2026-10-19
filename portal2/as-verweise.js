/* OAK Arbeitsschutz-App – Unterlagen: alle Dokumente des Betriebs (portal_dokumente) zum Ansehen im Programm.
   Anlagen-Dokumente stehen unter „Anlagen“. Bereiche, die (noch) im Kundenportal gepflegt werden, sind verlinkt.
   Gefahrstoffe: eigene Seite in as-betrieb.js (bettet das Kataster aus dem Kundenportal ein). */
"use strict";

const AS_UL_KAT = [
  ["ba-sammel", "Betriebsanweisungen (Sammel-BA)"], ["allg-gbu", "Allgemeine Beurteilungen (Tätigkeiten)"], ["begehungen", "Begehungsprotokolle"],
  ["unterweisungen", "Unterweisungen"], ["gefahrstoffe", "Gefahrstoffe"], ["hallenplan", "Hallenplan"], ["vorfall-aushang", "Aushänge"],
  ["vom-betrieb", "Interne Unterlagen (vom Betrieb hochgeladen)"], ["umwelt-immissionsschutz", "Immissionsschutz"], ["umwelt-gewaesserschutz", "Gewässerschutz"],
  ["umwelt-awsv", "AwSV"], ["umwelt-unterweisungen", "Unterweisungen Umwelt"], ["energie-aspekte", "Energieaspekte"], ["energie-verbrauch", "Verbrauch & Messstellen"]];
const AS_V1 = [];   // alle Bereiche des Kundenportals gibt es inzwischen auch hier

AS_SEITEN.unterlagen = { titel: "Unterlagen", icon: "▤", sort: 8, async render(main){
  main.innerHTML = `<h1 class="seite">Unterlagen</h1><p class="unter">Alle Dokumente des Betriebs – gleiche Ablage wie im Kundenportal.</p><div class="leer">wird geladen …</div>`;
  await asBetriebLaden();
  const termine = await apiGet("/rest/v1/portal_termin?select=id,titel,faellig_am,unterlagen&archiviert=is.false&erledigt_am=is.null&kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&order=faellig_am.asc").catch(() => []);
  const fuerTermine = id => (termine || []).filter(t => (t.unterlagen || []).includes(id));
  const docs = (AS_B.docs || []).filter(d => d.kategorie !== "anlagen");
  const kats = AS_UL_KAT.map(([k, t]) => [k, t, docs.filter(d => d.kategorie === k)]).filter(x => x[2].length);
  const sonst = docs.filter(d => !AS_UL_KAT.some(([k]) => k === d.kategorie));
  if(sonst.length) kats.push(["sonstige", "Weitere Unterlagen", sonst]);
  const zeile = d => { const titel = d.titel || d.maschine || "Dokument";
    const knoepfe = d.kategorie === "allg-gbu"
      ? AS_DOKTYPEN.filter(([t]) => (d.typen || []).includes(t)).map(([t, l]) => `<button class="btn sek klein" data-dok="${esc(asAnlageDokUrl(d, t, l))}" data-titel="${esc(titel + " · " + l)}">${esc(l)}</button>`).join(" ")
      : `<button class="btn sek klein" data-dok="${esc(d.url || asViewerUrl(d.doc_typ || "pdf", d.storage_path, titel))}" data-titel="${esc(titel)}">öffnen</button>`;
    const tl = fuerTermine(d.id), entwurf = /^\s*entwurf/i.test(titel);
    return `<div class="z"><div><b>${esc(titel.replace(/^\s*ENTWURF( zur Freigabe)?\s*[–-]\s*/i, ""))}</b><small>${entwurf ? "Entwurf zur Freigabe · " : ""}${d.stand ? "Stand " + asDat(d.stand) : "aktualisiert " + asDat(d.updated_at)}</small>
      ${tl.length ? `<small>Für ${tl.map(t => `<a href="#kalender/kalender" title="${esc(t.titel)} – im Kalender ansehen">Termin ${esc(asDat(t.faellig_am))}</a>`).join(", ")}</small>` : ""}</div>
      <div>${entwurf ? asChip("Entwurf", "gelb") + " " : ""}${knoepfe}</div></div>`; };
  main.innerHTML = `<h1 class="seite">Unterlagen</h1><p class="unter">Alle Dokumente des Betriebs – gleiche Ablage wie im Kundenportal. Dokumente je Anlage stehen unter „Anlagen“.</p>
    ${kats.map(([, t, l]) => `<div class="karte"><h2>${esc(t)} <span class="hinweis">${l.length}</span></h2><div class="zeilen">${l.map(zeile).join("")}</div></div>`).join("") || `<div class="karte"><div class="leer">Noch keine Dokumente.</div></div>`}
    ${AS_V1.length ? `<div class="karte"><h2>Weitere Bereiche im Kundenportal</h2><div class="zeilen">${AS_V1.map(([t, ziel, h]) => `<div class="z"><div><b>${esc(t)}</b><small>${esc(h)}</small></div>
      <a class="btn sek klein" href="../portal/#${ziel}" target="_blank" rel="noopener">öffnen</a></div>`).join("")}</div></div>` : ""}`;
  asDokKnoepfe(main);
}};

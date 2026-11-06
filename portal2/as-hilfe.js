/* OAK EHS-Cockpit – Hilfe (alle Rollen, Betrieb und OAK): öffnet die bebilderte Bedienungsanleitung hilfe/anleitung.html
   (wird aus dem Abnahmelauf gebaut, Plan staged-inventing-blum D) im Dokument-Viewer oder in einem neuen Tab.
   Fehlt die Datei noch, steht ein Hinweis da. Globale Namen mit asHi/AS_HI-Präfix. */
"use strict";

AS_ICON.hilfe = '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.7"/><path d="M12 17h.01"/>';
const AS_HI = { url: "hilfe/anleitung.html", pdf: "hilfe/anleitung.pdf" };

async function asHiDa(pfad){
  try{ const r = await fetch(pfad + "?v=" + Date.now(), { method: "HEAD", cache: "no-store" }); return r.ok; }catch(e){ return false; }
}
AS_SEITEN.hilfe = { titel: "Hilfe", icon: "hilfe", sort: 9.9, async render(main){
  main.innerHTML = `<h1 class="seite">Hilfe</h1><p class="unter">Bedienungsanleitung des EHS-Cockpits – Schritt für Schritt mit Bildern.</p>
    <div class="karte"><h2>Bedienungsanleitung <span id="hiKnoepfe"></span></h2><p class="hinweis" id="hiText">wird geprüft …</p></div>
    ${AS_SEITEN.fragen ? `<div class="karte"><h2>Frage an OAK <span><a class="btn sek klein" href="#fragen">Frage stellen</a></span></h2>
      <p class="hinweis">Etwas unklar oder ein Fehler? Schreiben Sie uns – die Antwort kommt ins Cockpit.</p></div>` : ""}`;
  const [html, pdf] = await Promise.all([asHiDa(AS_HI.url), asHiDa(AS_HI.pdf)]);
  const kn = document.getElementById("hiKnoepfe"), tx = document.getElementById("hiText");
  if(!kn || !tx) return;
  if(!html){
    tx.textContent = "Die bebilderte Anleitung wird gerade fertiggestellt und erscheint hier automatisch. Bis dahin hilft „Frage an OAK“.";
    return;
  }
  kn.innerHTML = `<button type="button" class="btn klein" id="hiOeffnen">Anleitung öffnen</button>
    <a class="btn sek klein" href="${AS_HI.url}" target="_blank" rel="noopener">In neuem Tab</a>${pdf ? `<a class="btn sek klein" href="${AS_HI.pdf}" target="_blank" rel="noopener">Als PDF</a>` : ""}`;
  tx.textContent = "Einstieg, Rollen und alle Kernabläufe mit Bildschirmbildern des geprüften Stands.";
  document.getElementById("hiOeffnen").onclick = () => asDokOeffnen("../portal2/" + AS_HI.url, "Bedienungsanleitung");
}};

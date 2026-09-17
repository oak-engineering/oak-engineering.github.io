/* OAK Kundenportal — Logbuch (16.09.2026, Nikolai: „nachvollziehen, was durch welchen Nutzer oder durch mich
   im Rahmen eines Updates verändert wurde" – auch für die Schichtführer).
   Daten: portal_logbuch, geschrieben ausschließlich von Datenbank-Triggern (Mängel, Unterlagen, Unterweisungen,
   Vorfälle, Fragen, Maschinenprüfung, Einstellungen). Lesen: RLS je Betrieb. Niemand kann Einträge ändern. */
"use strict";

let LB_ROWS = [], LB_GELADEN_FUER = null, LB_FILTER = { bereich: "", suche: "" };
const LB_BEREICH = { maengel: "Mängel", unterlagen: "Unterlagen", unterweisungen: "Unterweisungen", vorfaelle: "Vorfälle",
                     anfragen: "Fragen zur Arbeitssicherheit", pruefung: "Maschine prüfen", einstellungen: "Einstellungen",
                     kalender: "Kalender", nachweise: "Nachweise", vorsorge: "Vorsorge", aufgaben: "Aufgaben", gefahrstoffe: "Gefahrstoffe" };

async function lbLaden(){
  const slug = AKTIV || "";
  LB_ROWS = await apiGet("/rest/v1/portal_logbuch?select=am,wer,bereich,aktion,objekt,details,kunde_slug"
    + (slug ? "&kunde_slug=eq." + encodeURIComponent(slug) : "") + "&order=am.desc&limit=1000", false) || [];
  LB_GELADEN_FUER = slug;
}
function lbZeit(s){
  const d = new Date(s);
  return d.toLocaleDateString("de-DE") + " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

async function renderLogbuch(wrap){
  const sec = document.createElement("section"); sec.className = "sektion lb-seite";
  sec.innerHTML = `<div class="ck-fuss">Logbuch wird geladen …</div>`;
  wrap.appendChild(sec);
  try{ await lbLaden(); }
  catch(e){ sec.innerHTML = `<div class="leer">Logbuch konnte nicht geladen werden: ${esc(e.message || e)}</div>`; return; }
  const zeichnen = () => {
    const q = LB_FILTER.suche.toLowerCase().trim();
    const rows = LB_ROWS.filter(r => (!LB_FILTER.bereich || r.bereich === LB_FILTER.bereich)
      && (!q || [r.wer, r.aktion, r.objekt, r.details].join(" ").toLowerCase().includes(q)));
    const liste = sec.querySelector("#lbListe");
    liste.innerHTML = rows.length ? `<table class="uw-tab lb-tab"><thead><tr><th>Wann</th><th>Wer</th><th>Bereich</th><th>Was</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td class="lb-zeit">${esc(lbZeit(r.am))}</td><td class="lb-wer${r.wer === "OAK engineering" ? " lb-oak" : ""}">${esc(r.wer || "—")}</td>
        <td>${esc(LB_BEREICH[r.bereich] || r.bereich)}</td>
        <td><b>${esc(r.aktion)}</b>${r.objekt ? `<div class="lb-objekt">${esc(r.objekt)}</div>` : ""}${r.details ? `<div class="lb-details">${esc(r.details)}</div>` : ""}</td></tr>`).join("")}</tbody></table>`
      : `<div class="ck-fuss">Keine Einträge in dieser Auswahl.</div>`;
    sec.querySelector("#lbZahl").textContent = rows.length + (rows.length === 1 ? " Eintrag" : " Einträge");
  };
  const bereiche = [...new Set(LB_ROWS.map(r => r.bereich))];
  sec.innerHTML = `<div class="mg-filter">
      <div class="uw-pills"><button type="button" class="uw-pill${!LB_FILTER.bereich ? " aktiv" : ""}" data-lb="">Alle</button>
        ${Object.keys(LB_BEREICH).filter(k => bereiche.includes(k)).map(k => `<button type="button" class="uw-pill${LB_FILTER.bereich === k ? " aktiv" : ""}" data-lb="${k}">${esc(LB_BEREICH[k])}</button>`).join("")}</div>
      <input type="search" class="uw-suche" id="lbSuche" placeholder="Suchen (Name, Maschine …)" autocomplete="off" value="${esc(LB_FILTER.suche)}">
      <span class="uw-leise" id="lbZahl"></span>
    </div>
    <div class="tabelle-wrap" id="lbListe"></div>
    <p class="uw-leise lb-hinweis">Das Logbuch schreibt die Datenbank selbst mit. Einträge lassen sich nicht ändern oder löschen.</p>`;
  sec.querySelectorAll("[data-lb]").forEach(b => b.addEventListener("click", () => {
    LB_FILTER.bereich = b.dataset.lb;
    sec.querySelectorAll("[data-lb]").forEach(x => x.classList.toggle("aktiv", x === b)); zeichnen(); }));
  sec.querySelector("#lbSuche").addEventListener("input", e => { LB_FILTER.suche = e.target.value; zeichnen(); });
  zeichnen();
}

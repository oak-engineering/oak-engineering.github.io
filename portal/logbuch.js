/* OAK Kundenportal — Logbuch (16.09.2026, Nikolai: „nachvollziehen, was durch welchen Nutzer oder durch mich
   im Rahmen eines Updates verändert wurde" – auch für die Schichtführer).
   Daten: portal_logbuch, geschrieben ausschließlich von Datenbank-Triggern (Mängel, Unterlagen, Unterweisungen,
   Vorfälle, Fragen, Maschinenprüfung, Einstellungen, Kalender, Nachweise, Aufgaben, Gefahrstoffe). Lesen: RLS je Betrieb.
   Niemand kann Einträge ändern.
   Zweite Ansicht „Wochenbericht" (Nikolai 17.09.2026, aus Aktuelles hierher verlegt): Was lief · Was steht an · Drucken. */
"use strict";

let LB_ROWS = [], LB_GELADEN_FUER = null, LB_FILTER = { bereich: "", suche: "" }, LB_ANSICHT = "eintraege", LB_WOCHE = 0;
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
  if(typeof HASH_Q !== "undefined" && HASH_Q && HASH_Q.get("ansicht")){ LB_ANSICHT = HASH_Q.get("ansicht") === "wochenbericht" ? "wochenbericht" : "eintraege"; HASH_Q = null; }
  const sec = document.createElement("section"); sec.className = "sektion lb-seite";
  wrap.appendChild(sec);
  const umschalter = `<div class="lb-ansicht uw-pills"><button type="button" class="uw-pill${LB_ANSICHT === "eintraege" ? " aktiv" : ""}" data-ansicht="eintraege">Einträge</button>
    <button type="button" class="uw-pill${LB_ANSICHT === "wochenbericht" ? " aktiv" : ""}" data-ansicht="wochenbericht">Wochenbericht</button></div>`;
  const verdrahten = () => sec.querySelectorAll("[data-ansicht]").forEach(b => b.addEventListener("click", () => { LB_ANSICHT = b.dataset.ansicht; renderSektionen(); }));
  if(LB_ANSICHT === "wochenbericht"){ sec.innerHTML = umschalter + `<div id="lbWoche"><div class="ck-fuss">wird geladen …</div></div>`; verdrahten(); await lbWochenbericht(sec.querySelector("#lbWoche")); return; }
  sec.innerHTML = umschalter + `<div class="ck-fuss">Logbuch wird geladen …</div>`; verdrahten();
  try{ await lbLaden(); }
  catch(e){ sec.innerHTML = umschalter + `<div class="leer">Logbuch konnte nicht geladen werden: ${esc(e.message || e)}</div>`; verdrahten(); return; }
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
  sec.innerHTML = umschalter + `<div class="mg-filter">
      <div class="uw-pills"><button type="button" class="uw-pill${!LB_FILTER.bereich ? " aktiv" : ""}" data-lb="">Alle</button>
        ${Object.keys(LB_BEREICH).filter(k => bereiche.includes(k)).map(k => `<button type="button" class="uw-pill${LB_FILTER.bereich === k ? " aktiv" : ""}" data-lb="${k}">${esc(LB_BEREICH[k])}</button>`).join("")}</div>
      <input type="search" class="uw-suche" id="lbSuche" placeholder="Suchen (Name, Maschine …)" autocomplete="off" value="${esc(LB_FILTER.suche)}">
      <span class="uw-leise" id="lbZahl"></span>
    </div>
    <div class="tabelle-wrap" id="lbListe"></div>
    <p class="uw-leise lb-hinweis">Das Logbuch schreibt die Datenbank selbst mit. Einträge lassen sich nicht ändern oder löschen.</p>`;
  verdrahten();
  sec.querySelectorAll("[data-lb]").forEach(b => b.addEventListener("click", () => {
    LB_FILTER.bereich = b.dataset.lb;
    sec.querySelectorAll("[data-lb]").forEach(x => x.classList.toggle("aktiv", x === b)); zeichnen(); }));
  sec.querySelector("#lbSuche").addEventListener("input", e => { LB_FILTER.suche = e.target.value; zeichnen(); });
  zeichnen();
}

/* ---- Wochenbericht: Was lief (Logbuch der Woche, zusammengefasst) · Was steht an (Kalender der Folgewoche) ---- */
async function lbWochenbericht(box){
  const von = aktMontag(LB_WOCHE), bis = new Date(von); bis.setDate(bis.getDate() + 7);
  let log = [];
  await Promise.all([
    apiGet("/rest/v1/portal_logbuch?select=am,wer,bereich,aktion,objekt,details&kunde_slug=eq." + encodeURIComponent(AKTIV || "")
      + "&am=gte." + encodeURIComponent(von.toISOString()) + "&am=lt." + encodeURIComponent(bis.toISOString()) + "&order=am.desc&limit=1000", false)
      .then(r => { log = r || []; }).catch(() => { log = []; }),
    typeof kalLaden === "function" ? kalLaden(true).catch(() => null) : null,
    typeof nwLaden === "function" ? nwLaden(true).catch(() => null) : null]);
  const nach = (bereich, re) => log.filter(e => e.bereich === bereich && (!re || re.test(e.aktion)));
  const posten = (e, mitDetails) => `<li><span class="akt-zeit">${esc(new Date(e.am).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }))}</span>
      <span>${esc(e.objekt || e.aktion)}${e.wer ? ` <span class="uw-leise">· ${esc(e.wer)}</span>` : ""}${mitDetails && e.details ? `<br><span class="uw-leise">${esc(e.details)}</span>` : ""}</span></li>`;
  const liste = (titel, eintraege, mitDetails, max) => eintraege.length
    ? `<div class="akt-block"><h4>${esc(titel)} <span class="akt-zahl">${eintraege.length}</span></h4><ul class="akt-liste">${eintraege.slice(0, max || 8).map(e => posten(e, mitDetails)).join("")}</ul>${eintraege.length > (max || 8) ? `<div class="uw-leise">und ${eintraege.length - (max || 8)} weitere – siehe Einträge</div>` : ""}</div>` : "";
  const bloecke = [
    liste("Mängel gemeldet", nach("maengel", /erfasst/), true),
    liste("Mängel erledigt", nach("maengel", /erledigt/), true),
    liste("Mängel von OAK engineering neu bewertet", nach("maengel", /bearbeitet|Bewertung/), false, 5),
    liste("Vorfälle", nach("vorfaelle"), true),
    liste("Maschinen geprüft", nach("pruefung"), true),
    liste("Unterweisungen", nach("unterweisungen"), false),
    liste("Termine erledigt", nach("kalender", /erledigt/), true),
    liste("Termine angelegt oder geändert", nach("kalender", /angelegt|geändert|entfernt/), false, 5),
    liste("Nachweise", nach("nachweise"), true, 6),
    liste("Vorsorge eingetragen", nach("vorsorge"), false, 6),
    liste("Aufgaben quittiert", nach("aufgaben"), true, 6),
    liste("Neue Unterlagen", nach("unterlagen", /neu/), false),
    liste("Aktualisierte Unterlagen", nach("unterlagen", /aktualisiert/), false, 5),
    liste("Gefahrstoffe", nach("gefahrstoffe"), true, 5),
    liste(typeof FRAGE_TITEL !== "undefined" ? FRAGE_TITEL : "Fragen", nach("anfragen"), false),
    liste("Einstellungen", nach("einstellungen"), false, 5),
  ].filter(Boolean);
  const abV = new Date(bis), abB = new Date(bis); abB.setDate(abB.getDate() + 7);
  const isoT = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const eintraege = (typeof kalEintraege === "function") ? kalEintraege() : [];
  const naechste = eintraege.filter(e => String(e.datum) >= isoT(abV) && String(e.datum) < isoT(abB));
  const ueberfaellig = LB_WOCHE === 0 ? eintraege.filter(e => ehsTage(e.datum) < 0) : [];
  const aPosten = e => `<li><span class="akt-zeit">${esc(new Date(String(e.datum).slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }))}</span>
      <span>${esc(e.titel)}${e.sub ? `<br><span class="uw-leise">${esc(e.sub)}</span>` : ""}</span></li>`;
  const ausblick = (ueberfaellig.length ? `<div class="akt-block akt-ueberfaellig"><h4>Bereits überfällig <span class="akt-zahl">${ueberfaellig.length}</span></h4><ul class="akt-liste">${ueberfaellig.slice(0, 10).map(aPosten).join("")}</ul></div>` : "")
    + (naechste.length ? `<div class="akt-block"><h4>Termine KW ${aktKw(abV)} <span class="akt-zahl">${naechste.length}</span></h4><ul class="akt-liste">${naechste.map(aPosten).join("")}</ul></div>` : "");
  const wochen = [0, 1, 2, 3].map(v => `<button type="button" class="uw-pill${v === LB_WOCHE ? " aktiv" : ""}" data-woche="${v}">${v === 0 ? "Diese Woche" : "KW " + aktKw(aktMontag(v))}</button>`).join("");
  const zeitraum = aktTag(von) + "–" + aktTag(new Date(bis.getTime() - 86400000));
  box.innerHTML = `<div class="akt-kopf"><h2 class="akt-titel">Wochenbericht KW ${aktKw(von)} · ${zeitraum}</h2>
      <div class="akt-kopf-rechts"><div class="uw-pills">${wochen}</div><button type="button" class="btn sek" id="lbDruck">Drucken</button></div></div>
    <div class="lb-druck">
      <h2 class="ul-bereich">Was ${LB_WOCHE === 0 ? "diese Woche" : "in KW " + aktKw(von)} lief</h2>
      ${bloecke.length ? `<div class="akt-bloecke">${bloecke.join("")}</div>` : `<div class="ck-fuss">In dieser Woche gab es keine Änderungen.</div>`}
      <h2 class="ul-bereich">Was in KW ${aktKw(abV)} ansteht</h2>
      ${ausblick ? `<div class="akt-bloecke">${ausblick}</div>` : `<div class="ck-fuss">Keine Termine im Kalender.</div>`}
    </div>`;
  box.querySelectorAll("[data-woche]").forEach(b => b.addEventListener("click", () => { LB_WOCHE = parseInt(b.dataset.woche, 10) || 0; lbWochenbericht(box); }));
  box.querySelector("#lbDruck").addEventListener("click", () => {
    const d = box.querySelector(".lb-druck").cloneNode(true); d.querySelectorAll("button").forEach(b => b.remove());
    const betrieb = ((typeof MARKEN !== "undefined" ? MARKEN : []).find(k => k.slug === AKTIV) || {}).name || "";
    ehsDrucken("Wochenbericht KW " + aktKw(von), `<h1>Wochenbericht KW ${aktKw(von)}</h1><p class="leise">${esc(betrieb)} · ${zeitraum} · OAK EHS-Cockpit</p>` + d.innerHTML);
  });
}

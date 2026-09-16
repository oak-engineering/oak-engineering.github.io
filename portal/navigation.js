/* OAK Kundenportal — Navigation fürs Handy und Sprung aus dem Cockpit (seit 16.09.2026).

   1) Bottom-Bar: Unter 720 px Breite verschwinden die beiden Reiterzeilen; stattdessen steht
      unten eine feste Leiste wie in einer Handy-App: Überblick · Hallenplan · Maschinen ·
      Unterweisungen · Mehr. „Mehr" öffnet ein Blatt mit allen Bereichen und Reitern, damit
      nichts unerreichbar wird (Umwelt, Energie, Vorfälle, Begehungen …).
   2) Cockpit-Sprünge: Kacheln und Ring-Legende im Überblick sind Links der Form
      #bereich/reiter?status=…  Der Klick wird hier abgefangen und direkt gerendert; app.js liest
      den Filter (ANL_FILTER) und belegt Status-Filter bzw. Sortierung der Maschinenliste vor.

   Bewusst eigene Datei: app.js und index.html bleiben schlank, die Navigation lässt sich getrennt
   weiterentwickeln. Braucht die Globals aus app.js: AKTIVE_DOM, AKTIVE_SUB, ANL_FILTER,
   renderTabs, renderSubTabs, renderSektionen, hashSetzen, verfuegbareDomaenen, katRows.
   Alle Namen hier tragen das Präfix bb (Bottom-Bar) – im Portal teilen sich alle Skripte einen
   globalen Scope (siehe tools/portal_check.py). */
"use strict";

const BB_ICON = {
  ueberblick: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>'
            + '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  hallenplan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  maschinen:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1'
            + 'a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3'
            + 'l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1'
            + 'a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9'
            + 'a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8'
            + 'l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  unterweisungen: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
            + '<path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  mehr: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>'
      + '<circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
};
const BB_EINTRAEGE = [
  { dom: "arbeitssicherheit", sub: "ck-arbeitssicherheit", label: "Überblick",      icon: "ueberblick" },
  { dom: "arbeitssicherheit", sub: "hallenplan",           label: "Hallenplan",     icon: "hallenplan" },
  { dom: "arbeitssicherheit", sub: "anlagen",              label: "Maschinen",      icon: "maschinen" },
  { dom: "arbeitssicherheit", sub: "unterweisungen",       label: "Unterweisungen", icon: "unterweisungen" },
];
function bbSvg(name){ return `<svg viewBox="0 0 24 24" aria-hidden="true">${BB_ICON[name]}</svg>`; }

/* Navigation ohne Hash-Umweg: Zustand setzen und rendern – genau wie ein Klick auf einen Reiter. */
function bbGehe(dom, sub, filter){
  AKTIVE_DOM = dom || AKTIVE_DOM; AKTIVE_SUB = sub || null; ANL_FILTER = filter || {};
  renderTabs(); renderSubTabs(); renderSektionen(); hashSetzen(false);
  bbSheetSchliessen();
  try{ window.scrollTo({ top: 0 }); }catch(e){}
}

function bbBauen(){
  const app = document.getElementById("appView");
  if(!app || app.querySelector(".bb")) return;
  const nav = document.createElement("nav");
  nav.className = "bb"; nav.setAttribute("aria-label", "Navigation");
  nav.innerHTML = BB_EINTRAEGE.map(e =>
      `<button type="button" data-dom="${e.dom}" data-sub="${e.sub}">${bbSvg(e.icon)}<span>${e.label}</span></button>`).join("")
    + `<button type="button" data-mehr="1">${bbSvg("mehr")}<span>Mehr</span></button>`;
  nav.addEventListener("click", ev => {
    const b = ev.target.closest("button"); if(!b) return;
    if(b.dataset.mehr){ bbSheetOeffnen(); return; }
    bbGehe(b.dataset.dom, b.dataset.sub, {});
  });
  app.appendChild(nav);

  const sheet = document.createElement("div");
  sheet.className = "bb-sheet"; sheet.id = "bbSheet";
  sheet.innerHTML = `<div class="bb-box" role="dialog" aria-label="Alle Bereiche"><div class="bb-griff"></div><div id="bbListe"></div></div>`;
  sheet.addEventListener("click", ev => { if(ev.target === sheet) bbSheetSchliessen(); });
  app.appendChild(sheet);
}

function bbSheetOeffnen(){
  const sheet = document.getElementById("bbSheet"), liste = document.getElementById("bbListe");
  if(!sheet || !liste) return;
  liste.innerHTML = verfuegbareDomaenen().map(d =>
    `<div class="bb-dom">${d.label}</div>` + d.subs.map(s => {
      const n = katRows(s.kat).length, aktiv = d.key === AKTIVE_DOM && s.kat === AKTIVE_SUB;
      return `<button type="button" data-dom="${d.key}" data-sub="${s.kat}"${aktiv ? ' class="aktiv"' : ""}>`
        + `<span>${s.label}</span>${n ? `<span class="bb-n">${n}</span>` : ""}</button>`;
    }).join("")).join("");
  liste.onclick = ev => { const b = ev.target.closest("button"); if(b) bbGehe(b.dataset.dom, b.dataset.sub, {}); };
  sheet.classList.add("offen"); document.body.classList.add("bb-offen");
}
function bbSheetSchliessen(){
  const sheet = document.getElementById("bbSheet"); if(sheet) sheet.classList.remove("offen");
  document.body.classList.remove("bb-offen");
}

/* Aktiven Eintrag markieren. Liegt der Reiter nicht in der Leiste (Umwelt, Vorfälle …), ist „Mehr" aktiv. */
function bbAktualisieren(){
  const nav = document.querySelector(".bb"); if(!nav) return;
  let treffer = false;
  nav.querySelectorAll("button").forEach(b => {
    const aktiv = !b.dataset.mehr && b.dataset.dom === AKTIVE_DOM && b.dataset.sub === AKTIVE_SUB;
    b.classList.toggle("aktiv", aktiv); if(aktiv) treffer = true;
  });
  const mehr = nav.querySelector("[data-mehr]"); if(mehr) mehr.classList.toggle("aktiv", !treffer);
}

/* Cockpit-Kacheln und Legenden: Link-Klick abfangen und direkt rendern – kein Hash-Umweg,
   damit es sofort und ohne Doppelrendern (popstate + hashchange) passiert. */
document.addEventListener("click", ev => {
  const a = ev.target.closest("a.ck-kachel, a.ck-leg"); if(!a) return;
  const h = a.getAttribute("href") || ""; if(h.indexOf("#") !== 0) return;
  ev.preventDefault();
  const roh = h.slice(1), frage = roh.indexOf("?");
  const pfad = frage >= 0 ? roh.slice(0, frage) : roh;
  const t = pfad.split("/");
  const filter = frage >= 0 ? Object.fromEntries(new URLSearchParams(roh.slice(frage + 1))) : {};
  bbGehe(t[0], t[1] || null, filter);
});

/* Nach jedem Rendern der Sektionen die Leiste aufbauen und den aktiven Eintrag setzen.
   renderSektionen stammt aus app.js und wird hier umhüllt – app.js muss die Leiste nicht kennen. */
const bbRenderSektionenOriginal = renderSektionen;
renderSektionen = function(){
  bbRenderSektionenOriginal.apply(this, arguments);
  bbBauen(); bbAktualisieren();
};

/* OAK EHS-Cockpit — „Aktuelles" (Nikolai 17.09.2026): rein informativ.
     1. Rechtliche Neuerungen – portal_rechtsinfo (gepflegt von OAK, Grundlage references/rechtskataster/rechts-radar.md)
     2. Versionshinweise      – was im EHS-Cockpit neu ist (versionen.js)
   Der Wochenbericht (Was lief · Was steht an) steht im Logbuch (logbuch.js), Aufgaben unter „To-dos" (aufgaben.js).
   Die Wochen-Helfer unten nutzt der Wochenbericht mit. */
"use strict";

let AKT_RECHT = null;
const AKT_STATUS = { gilt: "gilt seit", kommt: "gilt ab", vorhaben: "geplant" };

function aktMontag(versatz){
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * versatz);
  return d;
}
function aktKw(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahr = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - jahr) / 86400000 + 1) / 7);
}
function aktTag(d){ return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }); }
function aktDatum(s){ const t = String(s || "").slice(0, 10).split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : ""; }

async function aktRechtLaden(){
  if(AKT_RECHT) return AKT_RECHT;
  try{ AKT_RECHT = await apiGet("/rest/v1/portal_rechtsinfo?select=*&order=sortierung.asc,erfasst_am.desc", false) || []; }
  catch(e){ AKT_RECHT = []; }
  return AKT_RECHT;
}

async function renderAktuelles(wrap){
  const sec = document.createElement("section"); sec.className = "sektion akt-seite";
  sec.innerHTML = `<div class="ck-fuss">wird geladen …</div>`;
  wrap.appendChild(sec);
  await aktRechtLaden();
  const teil = (typeof HASH_Q !== "undefined" && HASH_Q) ? HASH_Q.get("teil") : null;
  if(teil) HASH_Q = null;
  const recht = (AKT_RECHT || []).filter(r => !r.kunde_slug || r.kunde_slug === AKTIV);
  const neu = r => new Date(r.erfasst_am) >= new Date(Date.now() - 14 * 86400000);
  const rechtKarte = r => `<article class="akt-recht akt-${esc(r.status)}">
      <div class="akt-recht-kopf"><span class="akt-status">${esc(AKT_STATUS[r.status] || r.status)}${r.datum ? " " + esc(aktDatum(r.datum)) : ""}</span>
        ${neu(r) ? '<span class="akt-neu">neu</span>' : ""}${r.bereich === "umwelt" ? '<span class="akt-bereich">Umwelt</span>' : ""}</div>
      <h3>${esc(r.titel)}</h3>
      <p>${esc(r.kurz)}</p>
      ${r.fuer_betrieb ? `<p class="akt-fuer"><b>Was heißt das für uns?</b> ${esc(r.fuer_betrieb)}</p>` : ""}
      ${r.quelle ? `<div class="uw-leise">${esc(r.quelle)}</div>` : ""}
    </article>`;
  const reihenfolge = { gilt: 1, kommt: 0, vorhaben: 2 };
  const sortiert = recht.slice().sort((a, b) => (neu(b) - neu(a)) || (reihenfolge[a.status] - reihenfolge[b.status]) || (a.sortierung - b.sortierung));
  sec.innerHTML = `<h2 class="ul-bereich">Rechtliche Neuerungen</h2>
    ${sortiert.length ? `<div class="akt-recht-raster">${sortiert.map(rechtKarte).join("")}</div>` : `<div class="ck-fuss">Keine Einträge.</div>`}
    <h2 class="ul-bereich" id="aktVersionen">Versionshinweise</h2>
    <div id="aktVersionenInhalt"></div>`;
  if(typeof renderVersionshinweise === "function") renderVersionshinweise(sec.querySelector("#aktVersionenInhalt"));
  if(teil === "versionen") setTimeout(() => { const z = sec.querySelector("#aktVersionen"); if(z) z.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
}

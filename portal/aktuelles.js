/* OAK Kundenportal — „Aktuelles" (Nikolai 17.09.2026: Update-Service als Einträge im Kundenportal, nicht als Mail;
   rechtliche Neuerungen auch für die Schichtführer, Button auf der Startseite).
   Je Kalenderwoche:
     1. Rechtliche Neuerungen   – portal_rechtsinfo (gepflegt von OAK, Grundlage references/rechtskataster/rechts-radar.md)
     2. Diese Woche im Portal   – Rückblick aus dem Logbuch (portal_logbuch), zusammengefasst
     3. Zu tun für OAK          – nur Admin: erledigte Mängel nachziehen, neue Meldungen, offene Fragen */
"use strict";

let AKT_RECHT = null, AKT_WOCHE = 0;   // 0 = diese Woche, 1 = Vorwoche …
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
  const von = aktMontag(AKT_WOCHE), bis = new Date(von); bis.setDate(bis.getDate() + 7);
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);
  let log = [];
  const laden = [aktRechtLaden(),
    apiGet("/rest/v1/portal_logbuch?select=am,wer,bereich,aktion,objekt,details&kunde_slug=eq." + encodeURIComponent(AKTIV || "")
      + "&am=gte." + encodeURIComponent(von.toISOString()) + "&am=lt." + encodeURIComponent(bis.toISOString()) + "&order=am.desc&limit=1000", false)
      .then(r => { log = r || []; }).catch(() => { log = []; })];
  if(istAdmin){
    if(typeof MG_GELADEN !== "undefined" && !MG_GELADEN && typeof ladeMaengel === "function") laden.push(ladeMaengel());
    if(typeof ladeAnfragen === "function") laden.push(ladeAnfragen());
  }
  await Promise.all(laden);
  const recht = (AKT_RECHT || []).filter(r => !r.kunde_slug || r.kunde_slug === AKTIV);

  /* 1. Rechtliche Neuerungen */
  const neuDieseWoche = r => new Date(r.erfasst_am) >= von && new Date(r.erfasst_am) < bis;
  const rechtKarte = r => `<article class="akt-recht akt-${esc(r.status)}">
      <div class="akt-recht-kopf"><span class="akt-status">${esc(AKT_STATUS[r.status] || r.status)}${r.datum ? " " + esc(aktDatum(r.datum)) : ""}</span>
        ${neuDieseWoche(r) ? '<span class="akt-neu">neu</span>' : ""}${r.bereich === "umwelt" ? '<span class="akt-bereich">Umwelt</span>' : ""}</div>
      <h3>${esc(r.titel)}</h3>
      <p>${esc(r.kurz)}</p>
      ${r.fuer_betrieb ? `<p class="akt-fuer"><b>Was heißt das für uns?</b> ${esc(r.fuer_betrieb)}</p>` : ""}
      ${r.quelle ? `<div class="uw-leise">${esc(r.quelle)}</div>` : ""}
    </article>`;
  const reihenfolge = { gilt: 1, kommt: 0, vorhaben: 2 };
  const rechtSortiert = recht.slice().sort((a, b) => (neuDieseWoche(b) - neuDieseWoche(a)) || (reihenfolge[a.status] - reihenfolge[b.status]) || (a.sortierung - b.sortierung));

  /* 2. Diese Woche im Portal (Logbuch zusammengefasst) */
  const nach = (bereich, re) => log.filter(e => e.bereich === bereich && (!re || re.test(e.aktion)));
  const posten = (e, mitDetails) => `<li><span class="akt-zeit">${esc(new Date(e.am).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }))}</span>
      <span>${esc(e.objekt || e.aktion)}${e.wer ? ` <span class="uw-leise">· ${esc(e.wer)}</span>` : ""}${mitDetails && e.details ? `<br><span class="uw-leise">${esc(e.details)}</span>` : ""}</span></li>`;
  const liste = (titel, eintraege, mitDetails, max) => eintraege.length
    ? `<div class="akt-block"><h4>${esc(titel)} <span class="akt-zahl">${eintraege.length}</span></h4><ul class="akt-liste">${eintraege.slice(0, max || 8).map(e => posten(e, mitDetails)).join("")}</ul>${eintraege.length > (max || 8) ? `<div class="uw-leise">und ${eintraege.length - (max || 8)} weitere – siehe Logbuch</div>` : ""}</div>` : "";
  const unterlagenNeu = nach("unterlagen", /neu/), unterlagenAkt = nach("unterlagen", /aktualisiert/);
  const bloecke = [
    liste("Mängel gemeldet", nach("maengel", /erfasst/), true),
    liste("Mängel erledigt", nach("maengel", /erledigt/), true),
    liste("Mängel von OAK engineering neu bewertet", nach("maengel", /bearbeitet|Bewertung/), false, 5),
    liste("Vorfälle", nach("vorfaelle"), true),
    liste("Maschinen geprüft", nach("pruefung"), true),
    liste("Unterweisungen", nach("unterweisungen"), false),
    liste("Neue Unterlagen", unterlagenNeu, false),
    liste("Aktualisierte Unterlagen", unterlagenAkt, false, 5),
    liste("Fragen an OAK engineering", nach("anfragen"), false),
    liste("Einstellungen", nach("einstellungen"), false, 5),
  ].filter(Boolean);

  /* 3. Zu tun für OAK (nur Admin) */
  let todo = "";
  if(istAdmin){
    const mg = (typeof MAENGEL !== "undefined" ? MAENGEL : []).filter(m => m.kunde_slug === AKTIV && !m.ausgeblendet);
    const uebernehmen = mg.filter(m => m.status === "erledigt" && !m.uebernommen_am).length;
    const vomBetrieb = mg.filter(m => /^BM-/.test(m.schluessel || "") && m.status !== "erledigt" && !m.bewertung_manuell).length;
    const fragen = (typeof ANFRAGEN !== "undefined" ? ANFRAGEN : []).filter(a => a.kunde_slug === AKTIV && a.status !== "beantwortet").length;
    const punkt = (n, text, ziel) => `<li class="${n ? "" : "akt-erledigt"}"><b>${n}</b> ${esc(text)}${n ? ` <button type="button" class="btn-klein" data-akt-ziel="${ziel}">ansehen</button>` : ""}</li>`;
    todo = `<section class="akt-todo"><h2 class="ul-bereich">Zu tun für OAK engineering <span class="uw-leise">nur für dich sichtbar</span></h2>
      <ul>${punkt(uebernehmen, "erledigte Mängel prüfen und in GBU, BA und Mängelliste übernehmen", "uebernehmen")}
        ${punkt(vomBetrieb, "vom Betrieb gemeldete Mängel bewerten", "betrieb")}
        ${punkt(fragen, "offene Fragen beantworten", "fragen")}</ul></section>`;
  }

  const wochen = [0, 1, 2, 3].map(v => { const m = aktMontag(v); return `<button type="button" class="uw-pill${v === AKT_WOCHE ? " aktiv" : ""}" data-akt-woche="${v}">${v === 0 ? "Diese Woche" : "KW " + aktKw(m)}</button>`; }).join("");
  sec.innerHTML = `<div class="akt-kopf"><div><h2 class="akt-titel">KW ${aktKw(von)} · ${aktTag(von)}–${aktTag(new Date(bis.getTime() - 86400000))}</h2></div>
      <div class="uw-pills">${wochen}</div></div>
    ${todo}
    <h2 class="ul-bereich">Rechtliche Neuerungen</h2>
    ${rechtSortiert.length ? `<div class="akt-recht-raster">${rechtSortiert.map(rechtKarte).join("")}</div>` : `<div class="ck-fuss">Keine Einträge.</div>`}
    <h2 class="ul-bereich">Diese Woche im Portal</h2>
    ${bloecke.length ? `<div class="akt-bloecke">${bloecke.join("")}</div>` : `<div class="ck-fuss">In dieser Woche gab es keine Änderungen.</div>`}
    <p class="uw-leise">Alle Einzelheiten stehen im <a href="#mehr/logbuch">Logbuch</a>.</p>`;
  sec.querySelectorAll("[data-akt-woche]").forEach(b => b.addEventListener("click", () => { AKT_WOCHE = parseInt(b.dataset.aktWoche, 10) || 0; renderSektionen(); }));
  sec.querySelectorAll("[data-akt-ziel]").forEach(b => b.addEventListener("click", () => {
    const z = b.dataset.aktZiel;
    if(z === "fragen"){ portalGehe("mehr", "anfragen"); return; }
    if(typeof MG_FILTER !== "undefined"){ MG_FILTER.maschine = ""; MG_FILTER.ampel = ""; MG_FILTER.status = z === "uebernehmen" ? "uebernehmen" : "offen"; }
    portalGehe("maengel");
  }));
}

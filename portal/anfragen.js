/* OAK EHS-Cockpit — „Fragen zur Arbeitssicherheit" als Forum (Nikolai 17.09.2026: „eher wie Foren-Einträge, als Admin direkt im
   Cockpit antworten, per Mail nur die Info, dass es einen neuen Eintrag gibt").
   Themen: portal_anfrage (Betreff, erster Beitrag, Anhang, optional Maschine/Dokument). Antworten: portal_anfrage_beitrag –
   beliebig viele, von OAK und aus dem Betrieb. Alle im Betrieb lesen mit (RLS je Betrieb). Status „beantwortet" setzt die
   Datenbank, sobald OAK antwortet; ein neuer Beitrag aus dem Betrieb öffnet das Thema wieder.
   Mail (Edge Function anfrage-mail): nur Hinweis mit Link, kein Inhalt. */
"use strict";

const FRAGE_TITEL = "Fragen zur Arbeitssicherheit";
let ANFRAGEN = [], ANFR_BEITRAEGE = [];
let ANFR_MELDUNG = "", ANFR_OFFEN = null, ANFR_FILTER = "", ANFR_SCROLL = false;

async function ladeAnfragen(){
  try{ ANFRAGEN = await apiGet("/rest/v1/portal_anfrage?select=*&order=letzte_aktivitaet.desc.nullslast,created_at.desc&limit=300", false) || []; }
  catch(e){ ANFRAGEN = []; }
  try{ ANFR_BEITRAEGE = await apiGet("/rest/v1/portal_anfrage_beitrag?select=*&order=created_at.asc&limit=3000", false) || []; }
  catch(e){ ANFR_BEITRAEGE = []; }
}
function anfrDatum(s){
  if(!s) return "";
  const d = new Date(s);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " · "
       + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
async function anfrSigned(pfad){ return ehsSigniert(pfad); }
async function anfrMail(body){
  try{
    const t = await token(); if(!t) return;
    await fetch(CFG.url + "/functions/v1/anfrage-mail", { method: "POST",
      headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify(typeof body === "string" ? { anfrage_id: body } : body) });
  }catch(e){ /* Mail ist nur ein Hinweis – der Eintrag steht im Cockpit */ }
}
function anfrMaschinenName(mid){
  const r = (typeof ALLE !== "undefined" ? ALLE : []).find(x => x.maschinen_id === mid && x.maschine);
  return r ? r.maschine : "Maschine";
}
function anfrMaschinenAuswahl(id, gewaehlt){
  const liste = (typeof anlagen === "function" ? anlagen() : [])
    .map(r => ({ id: r.maschinen_id, name: r.maschine || r.titel })).filter(x => x.id);
  if(!liste.length) return "";
  return `<label>Maschine (optional)<select id="${id}"><option value="">– keine bestimmte Maschine –</option>
    ${liste.map(m => `<option value="${esc(m.id)}"${m.id === gewaehlt ? " selected" : ""}>${esc(m.name || m.id)}</option>`).join("")}</select></label>`;
}
function anfrBeitraege(id){ return ANFR_BEITRAEGE.filter(b => b.anfrage_id === id); }

async function renderAnfragen(wrap){
  const sec = document.createElement("section"); sec.className = "sektion anfr-seite";
  sec.innerHTML = `<div class="ck-fuss">wird geladen …</div>`;
  wrap.appendChild(sec);
  await ladeAnfragen();
  if(typeof HASH_Q !== "undefined" && HASH_Q && HASH_Q.get("thema")){ ANFR_OFFEN = HASH_Q.get("thema"); HASH_Q = null; }
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);
  const zeichnen = () => {
    const themen = ANFRAGEN.filter(a => !AKTIV || a.kunde_slug === AKTIV);
    const meld = ANFR_MELDUNG ? `<div class="uw-meld">${esc(ANFR_MELDUNG)}</div>` : ""; ANFR_MELDUNG = "";
    const offen = themen.filter(a => a.status !== "beantwortet").length;
    const karte = a => {
      const bt = anfrBeitraege(a.id), auf = ANFR_OFFEN === a.id;
      return `<article class="anfr-thema${a.status === "beantwortet" ? " anfr-beantwortet" : ""}${auf ? " anfr-auf" : ""}" data-id="${esc(a.id)}"
          data-suche="${esc([a.betreff, a.text, a.von_name, ...bt.map(b => b.text)].filter(Boolean).join(" ").toLowerCase())}" data-status="${a.status === "beantwortet" ? "beantwortet" : "offen"}">
        <button type="button" class="anfr-zeile" aria-expanded="${auf}">
          <span class="anfr-z-text"><b>${esc(a.betreff)}</b>
            <span class="uw-leise">${esc(a.von_name || "")} · ${anfrDatum(a.created_at)}${istAdmin && !AKTIV ? " · " + esc(a.kunde_slug) : ""}${a.maschinen_id ? " · " + esc(anfrMaschinenName(a.maschinen_id)) : ""}${a.dokument_titel ? " · zum Dokument" : ""}</span></span>
          <span class="anfr-z-meta"><span class="anfr-anzahl" title="Antworten">${bt.length} ${bt.length === 1 ? "Antwort" : "Antworten"}</span>
            <span class="uw-badge ${a.status === "beantwortet" ? "uw-gut" : "uw-warnung"}">${a.status === "beantwortet" ? "beantwortet" : "offen"}</span></span>
        </button>
        ${auf ? anfrDetail(a, bt) : ""}
      </article>`;
    };
    sec.innerHTML = `${meld}
      <div class="anfr-kopf-leiste">
        <p class="uw-erkl">Fragen stellen, Antworten lesen – wie in einem Forum. Alle im Betrieb sehen die Beiträge; ${istAdmin ? "du antwortest direkt hier." : "OAK engineering antwortet direkt hier."}</p>
        <button type="button" class="btn" id="anfrNeu">Neue Frage stellen</button></div>
      <div id="anfrFormBox"></div>
      <div class="mg-filter"><input type="search" class="uw-suche" id="anfrSuche" placeholder="In Fragen und Antworten suchen" autocomplete="off">
        <div class="uw-pills">${[["", "Alle"], ["offen", "Offen" + (offen ? " (" + offen + ")" : "")], ["beantwortet", "Beantwortet"]].map(p => `<button type="button" class="uw-pill${ANFR_FILTER === p[0] ? " aktiv" : ""}" data-filter="${p[0]}">${p[1]}</button>`).join("")}</div>
        <span class="uw-leise" id="anfrZahl"></span></div>
      <div class="anfr-liste">${themen.length ? themen.map(karte).join("") : `<div class="leer">Noch keine Fragen. Stellen Sie die erste – ein Foto oder eine Datei können Sie anhängen.</div>`}</div>`;
    const filtern = () => { const q = (sec.querySelector("#anfrSuche").value || "").toLowerCase().trim(); let n = 0;
      sec.querySelectorAll(".anfr-thema").forEach(t => { const ok = (!q || t.dataset.suche.includes(q)) && (!ANFR_FILTER || t.dataset.status === ANFR_FILTER); t.hidden = !ok; if(ok) n++; });
      sec.querySelector("#anfrZahl").textContent = themen.length ? n + (n === 1 ? " Thema" : " Themen") : ""; };
    sec.querySelector("#anfrSuche").addEventListener("input", filtern);
    sec.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => { ANFR_FILTER = b.dataset.filter; zeichnen(); }));
    filtern();
    sec.querySelector("#anfrNeu").addEventListener("click", () => anfrFormular(sec.querySelector("#anfrFormBox"), neu));
    sec.querySelectorAll(".anfr-zeile").forEach(b => b.addEventListener("click", () => { const id = b.closest(".anfr-thema").dataset.id; ANFR_OFFEN = ANFR_OFFEN === id ? null : id; zeichnen(); }));
    sec.querySelectorAll(".anfr-anhang").forEach(a => a.addEventListener("click", async ev => {
      ev.preventDefault(); const u = await ehsSigniert(a.dataset.pfad); if(u) window.open(u, "_blank", "noopener"); else alert("Anhang konnte nicht geöffnet werden."); }));
    const antwort = sec.querySelector(".anfr-antwort-form"); if(antwort) anfrAntwortVerdrahten(antwort, neu);
    const auf = sec.querySelector(".anfr-auf"); if(auf && ANFR_SCROLL){ ANFR_SCROLL = false; auf.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };
  const neu = async () => { await ladeAnfragen(); zeichnen(); };
  ANFR_SCROLL = !!ANFR_OFFEN;
  zeichnen();
}

function anfrDetail(a, bt){
  const beitrag = (von, admin, zeit, text, anhang) => `<div class="anfr-beitrag${admin ? " anfr-oak" : ""}">
      <div class="anfr-b-kopf"><b>${esc(von || (admin ? "OAK engineering" : ""))}</b><span class="uw-leise">${anfrDatum(zeit)}</span></div>
      ${text ? `<div class="anfr-text">${esc(text)}</div>` : ""}
      ${anhang ? `<a class="btn-klein anfr-anhang" data-pfad="${esc(anhang)}" href="#">Anhang öffnen</a>` : ""}</div>`;
  const dok = a.dokument_link && /^(viewer|maschine)\.html\?/.test(a.dokument_link)
    ? `<p><a class="btn-klein" href="${esc(a.dokument_link)}" target="_blank" rel="noopener">Zum Dokument${a.dokument_titel ? ": " + esc(a.dokument_titel) : ""}</a></p>` : "";
  return `<div class="anfr-detail">
      ${beitrag(a.von_name, false, a.created_at, a.text, a.anhang_pfad)}${dok}
      ${bt.map(b => beitrag(b.von_name, b.von_admin, b.created_at, b.text, b.anhang_pfad)).join("")}
      <form class="anfr-antwort-form" data-id="${esc(a.id)}">
        ${ehsGemeinsamerZugang() && !(typeof ADMIN !== "undefined" && ADMIN) ? `<label class="uw-lab">Ihr Name<input type="text" class="anfr-name" autocomplete="name" value="${esc(ehsVorname())}" placeholder="Vor- und Nachname"></label>` : ""}
        <textarea rows="3" class="anfr-antwort-text" placeholder="Antwort schreiben …"></textarea>
        <div class="uw-form-knoepfe"><input type="file" class="anfr-antwort-datei" accept="image/*,.pdf">
          <button type="submit" class="btn sek">Antworten</button><span class="uw-leise anfr-antwort-meld"></span></div>
      </form></div>`;
}

function anfrAntwortVerdrahten(form, neu){
  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const meld = form.querySelector(".anfr-antwort-meld"), text = form.querySelector(".anfr-antwort-text").value.trim();
    const datei = form.querySelector(".anfr-antwort-datei").files[0];
    const nameFeld = form.querySelector(".anfr-name");
    let name = window.__oakName || "";
    if(nameFeld){ name = nameFeld.value.trim().replace(/\s+/g, " "); if(name.length < 3){ meld.textContent = "Bitte Ihren Namen eintragen."; nameFeld.focus(); return; }
      try{ localStorage.setItem(EHS_NAME_KEY, name); }catch(e){} }
    if(!text){ meld.textContent = "Bitte eine Antwort schreiben."; return; }
    meld.textContent = "Wird gesendet …";
    try{
      ehsDateiOk(datei);
      const pfad = datei ? await ehsHochladen(datei, anfrSlug(form.dataset.id) + "/anfragen/" + Date.now() + "-" + ehsDateiName(datei)) : null;
      const neuB = await apiSend("POST", "/rest/v1/portal_anfrage_beitrag", { anfrage_id: form.dataset.id, kunde_slug: anfrSlug(form.dataset.id), von_name: name, text, anhang_pfad: pfad }, "return=representation");
      const id = Array.isArray(neuB) ? neuB[0].id : (neuB && neuB.id);
      if(id) anfrMail({ beitrag_id: id });
      await neu();
    }catch(e){ meld.textContent = "Konnte nicht gesendet werden: " + (e.message || e); }
  });
}
/* Slug des Themas (Admin ohne gewählten Betrieb antwortet in den Betrieb des Themas) */
function anfrSlug(anfrageId){ const a = ANFRAGEN.find(x => x.id === anfrageId); return (a && a.kunde_slug) || AKTIV; }

function anfrFormular(box, neu){
  if(box.innerHTML){ box.innerHTML = ""; return; }
  box.innerHTML = `<form class="uw-form anfr-neu-form">
      ${ehsGemeinsamerZugang() && !(typeof ADMIN !== "undefined" && ADMIN) ? `<label class="uw-lab" for="anfrName">Ihr Name</label><input type="text" id="anfrName" autocomplete="name" value="${esc(ehsVorname())}" placeholder="Vor- und Nachname">` : ""}
      <label class="uw-lab" for="anfrBetreff">Worum geht es?</label>
      <input type="text" id="anfrBetreff" maxlength="200" placeholder="z. B. Schutztür an der D100 schließt nicht richtig" autocomplete="off">
      <label class="uw-lab" for="anfrText">Ihre Frage oder Beschreibung</label>
      <textarea id="anfrText" rows="4"></textarea>
      <div class="anfr-neu-zwei">${anfrMaschinenAuswahl("anfrMaschine")}
        <label>Foto oder Datei (optional)<input type="file" id="anfrDatei" accept="image/*,.pdf"></label></div>
      <div class="uw-form-knoepfe"><button type="submit" class="btn">Frage veröffentlichen</button><button type="button" class="btn-klein" id="anfrAbbruch">Abbrechen</button><span class="uw-leise" id="anfrMeld"></span></div>
    </form>`;
  box.querySelector("#anfrAbbruch").addEventListener("click", () => { box.innerHTML = ""; });
  box.querySelector("#anfrBetreff").focus();
  box.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const meld = box.querySelector("#anfrMeld");
    const betreff = box.querySelector("#anfrBetreff").value.trim(), text = box.querySelector("#anfrText").value.trim();
    const masch = box.querySelector("#anfrMaschine"), datei = box.querySelector("#anfrDatei").files[0];
    const nameFeld = box.querySelector("#anfrName");
    let name = window.__oakName || "";
    if(nameFeld){ name = nameFeld.value.trim().replace(/\s+/g, " "); if(name.length < 3){ meld.textContent = "Bitte Ihren Namen eintragen."; nameFeld.focus(); return; }
      try{ localStorage.setItem(EHS_NAME_KEY, name); }catch(e){} }
    if(betreff.length < 3){ meld.textContent = "Bitte kurz sagen, worum es geht."; return; }
    if(!text && !datei){ meld.textContent = "Bitte eine Frage schreiben oder ein Foto anhängen."; return; }
    if(!AKTIV){ meld.textContent = "Bitte zuerst oben einen Betrieb wählen."; return; }
    const s = getSession();
    meld.textContent = "Wird gesendet …";
    try{
      ehsDateiOk(datei);
      const pfad = datei ? await ehsHochladen(datei, AKTIV + "/anfragen/" + Date.now() + "-" + ehsDateiName(datei)) : null;
      const neuA = await apiSend("POST", "/rest/v1/portal_anfrage", {
        kunde_slug: AKTIV, von_user_id: s && s.user ? s.user.id : null, von_name: name,
        von_email: s && s.user ? s.user.email : null, betreff, text, maschinen_id: masch && masch.value ? masch.value : null, anhang_pfad: pfad,
        letzte_aktivitaet: new Date().toISOString()
      }, "return=representation");
      const id = Array.isArray(neuA) ? neuA[0].id : (neuA && neuA.id);
      if(id){ anfrMail(id); ANFR_OFFEN = id; }
      ANFR_MELDUNG = "Ihre Frage ist veröffentlicht. OAK engineering ist benachrichtigt – die Antwort erscheint hier.";
      await neu();
    }catch(e){ meld.textContent = "Konnte nicht gesendet werden: " + (e.message || e); }
  });
}

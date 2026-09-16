/* OAK Kundenportal — „Frage an OAK engineering": ein Formular mit Anhang, kein Chat.
   Der Betrieb schreibt Betreff, Frage, optional Maschine und Foto/Datei. Die Anfrage landet in
   portal_anfrage (RLS je Betrieb), OAK bekommt eine Mail (Edge Function anfrage-mail) und antwortet
   im Portal (Admin); der Betrieb sieht Status und Antwort in seiner Liste und per Mail. */
"use strict";

let ANFRAGEN = [];
let ANFR_MELDUNG = "";

async function ladeAnfragen(){
  try{ ANFRAGEN = await apiGet("/rest/v1/portal_anfrage?select=*&order=created_at.desc&limit=200", false) || []; }
  catch(e){ ANFRAGEN = []; }
}
function anfrDatum(s){
  if(!s) return "";
  const d = new Date(s);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " · "
       + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
async function anfrSigned(pfad){
  try{
    const r = await apiSend("POST", "/storage/v1/object/sign/" + CFG.bucket + "/" + pfad, { expiresIn: 600 });
    return (r && r.signedURL) ? CFG.url + "/storage/v1" + r.signedURL : null;
  }catch(e){ return null; }
}
async function anfrMail(id){
  try{
    const t = await token(); if(!t) return;
    await fetch(CFG.url + "/functions/v1/anfrage-mail", { method: "POST",
      headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ anfrage_id: id }) });
  }catch(e){ /* Mail ist Komfort – die Anfrage steht im Portal */ }
}
function anfrMaschinenAuswahl(id, gewaehlt){
  const liste = (typeof anlagen === "function" ? anlagen() : [])
    .map(r => ({ id: r.maschinen_id, name: r.maschine || r.titel })).filter(x => x.id);
  if(!liste.length) return "";
  return `<label class="uw-lab" for="${id}">Maschine (optional)</label>
    <select id="${id}" class="uw-fassung" style="max-width:420px;width:100%"><option value="">– keine bestimmte Maschine –</option>
    ${liste.map(m => `<option value="${esc(m.id)}"${m.id === gewaehlt ? " selected" : ""}>${esc(m.id)} · ${esc(m.name || "")}</option>`).join("")}</select>`;
}

async function renderAnfragen(wrap){
  await ladeAnfragen();
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);
  const meine = ANFRAGEN.filter(a => !AKTIV || a.kunde_slug === AKTIV);
  const sec = document.createElement("section"); sec.className = "sektion";
  const meld = ANFR_MELDUNG ? `<div class="uw-meld">${esc(ANFR_MELDUNG)}</div>` : ""; ANFR_MELDUNG = "";
  const formular = istAdmin ? "" : `<div class="uw-form" id="anfrForm">
      <label class="uw-lab" for="anfrBetreff">Worum geht es?</label>
      <input type="text" id="anfrBetreff" placeholder="z. B. Schutztür an der D100 schließt nicht richtig" autocomplete="off">
      <label class="uw-lab" for="anfrText">Ihre Frage oder Beschreibung</label>
      <textarea id="anfrText" rows="4" style="width:100%;max-width:640px;padding:12px 14px;font:inherit;font-size:16px;border:1px solid var(--rand,#D6E4DA);border-radius:10px"></textarea>
      ${anfrMaschinenAuswahl("anfrMaschine")}
      <label class="uw-lab" for="anfrDatei">Foto oder Datei anhängen (optional)</label>
      <input type="file" id="anfrDatei" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="font-size:15px">
      <div class="uw-form-knoepfe"><button class="btn sek" id="anfrSenden">Absenden</button><span class="uw-leise" id="anfrMeld"></span></div>
    </div>`;
  const karte = a => `<div class="anfr-karte${a.status === "beantwortet" ? " anfr-beantwortet" : ""}" data-id="${esc(a.id)}">
      <div class="anfr-kopf"><b>${esc(a.betreff)}</b>
        <span class="uw-badge ${a.status === "beantwortet" ? "uw-gut" : "uw-warnung"}">${a.status === "beantwortet" ? "beantwortet" : "offen"}</span></div>
      <div class="uw-leise">${anfrDatum(a.created_at)} · ${esc(a.von_name || "")}${istAdmin ? " · " + esc(a.kunde_slug) : ""}${a.maschinen_id ? " · Maschine " + esc(a.maschinen_id) : ""}</div>
      ${a.text ? `<p class="anfr-text">${esc(a.text)}</p>` : ""}
      ${a.anhang_pfad ? `<p><a class="btn-klein anfr-anhang" data-pfad="${esc(a.anhang_pfad)}" href="#">Anhang öffnen</a></p>` : ""}
      ${a.antwort ? `<div class="anfr-antwort"><b>Antwort von OAK engineering</b> <span class="uw-leise">${anfrDatum(a.beantwortet_am)}</span><p>${esc(a.antwort)}</p></div>` : ""}
      ${istAdmin && a.status !== "beantwortet" ? `<div class="anfr-antworten"><textarea rows="3" placeholder="Antwort schreiben …" style="width:100%;padding:10px 12px;font:inherit;font-size:15px;border:1px solid var(--rand,#D6E4DA);border-radius:10px"></textarea>
        <div class="uw-form-knoepfe"><button class="btn sek anfr-antwort-senden" data-id="${esc(a.id)}">Antwort senden</button><span class="uw-leise"></span></div></div>` : ""}
    </div>`;
  sec.innerHTML = `${meld}
    <div class="sek-kopf"><h2>Frage an OAK engineering</h2><span class="zaehler">${meine.filter(a => a.status !== "beantwortet").length} offen</span>
      <a class="btn sek" href="tel:+4915679787193">Anrufen</a></div>
    <p class="uw-erkl">Schreiben Sie, was Sie brauchen – ein Foto oder eine Datei können Sie anhängen. Die Antwort kommt hier ins
      Portal und per E-Mail. Dringend? Anrufen: 0156 79787193.</p>
    ${formular}
    <h3 class="uw-h3">${istAdmin ? "Anfragen der Betriebe" : "Ihre Anfragen"}</h3>
    ${meine.length ? meine.map(karte).join("") : `<div class="ck-fuss">Noch keine Anfragen.</div>`}`;
  wrap.appendChild(sec);

  sec.querySelectorAll(".anfr-anhang").forEach(a => a.addEventListener("click", async ev => {
    ev.preventDefault(); const u = await anfrSigned(a.dataset.pfad); if(u) window.open(u, "_blank", "noopener"); else alert("Anhang konnte nicht geöffnet werden.");
  }));
  const senden = sec.querySelector("#anfrSenden");
  if(senden) senden.addEventListener("click", () => anfrAbsenden(sec));
  sec.querySelectorAll(".anfr-antwort-senden").forEach(b => b.addEventListener("click", () => anfrAntworten(b)));
}

async function anfrAbsenden(sec){
  const meld = sec.querySelector("#anfrMeld");
  const betreff = sec.querySelector("#anfrBetreff").value.trim();
  const text = sec.querySelector("#anfrText").value.trim();
  const masch = sec.querySelector("#anfrMaschine"); const maschine = masch ? masch.value : "";
  const datei = sec.querySelector("#anfrDatei").files[0];
  if(betreff.length < 3){ meld.textContent = "Bitte kurz sagen, worum es geht."; return; }
  if(!text && !datei){ meld.textContent = "Bitte eine Frage schreiben oder ein Foto anhängen."; return; }
  const s = getSession();
  meld.textContent = "Wird gesendet …";
  try{
    let pfad = null;
    if(datei){
      if(datei.size > 15 * 1024 * 1024){ meld.textContent = "Die Datei ist größer als 15 MB."; return; }
      const rein = datei.name.replace(/[^A-Za-z0-9._-]+/g, "-");
      pfad = AKTIV + "/anfragen/" + Date.now() + "-" + rein;
      const t = await token();
      const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST",
        headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "x-upsert": "true" }, body: datei });
      if(!r.ok) throw new Error("Anhang konnte nicht hochgeladen werden (" + r.status + ")");
    }
    const neu = await apiSend("POST", "/rest/v1/portal_anfrage", {
      kunde_slug: AKTIV, von_user_id: s && s.user ? s.user.id : null, von_name: window.__oakName || "",
      von_email: s && s.user ? s.user.email : null, betreff, text, maschinen_id: maschine || null, anhang_pfad: pfad
    }, "return=representation");
    const id = Array.isArray(neu) ? neu[0].id : (neu && neu.id);
    if(id) anfrMail(id);
    ANFR_MELDUNG = "Ihre Frage ist bei OAK engineering eingegangen. Sie bekommen die Antwort hier und per E-Mail.";
    if(window.portalGehe) portalGehe("mehr", "anfragen");
  }catch(e){ meld.textContent = "Konnte nicht gesendet werden: " + (e.message || e); }
}

async function anfrAntworten(btn){
  const box = btn.closest(".anfr-antworten"); const ta = box.querySelector("textarea"); const meld = box.querySelector("span");
  const antwort = ta.value.trim(); if(antwort.length < 2){ meld.textContent = "Bitte eine Antwort schreiben."; return; }
  meld.textContent = "Speichere …";
  try{
    await apiSend("PATCH", "/rest/v1/portal_anfrage?id=eq." + encodeURIComponent(btn.dataset.id),
      { antwort, status: "beantwortet", beantwortet_am: new Date().toISOString() }, "return=minimal");
    anfrMail(btn.dataset.id);
    ANFR_MELDUNG = "Antwort gespeichert und per E-Mail verschickt.";
    if(window.portalGehe) portalGehe("mehr", "anfragen");
  }catch(e){ meld.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); }
}

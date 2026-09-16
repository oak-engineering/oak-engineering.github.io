/* OAK Kundenportal — Sektion „Vorfälle": Unfälle, Beinahe-Unfälle, unsichere Zustände und
   Umweltvorfälle. Meldungen kommen über den QR-Aushang (Funktion vorfall_melden, ohne Login)
   oder werden hier vom Admin erfasst, wenn sie mündlich gemeldet wurden.
   Lesen: RLS je Kunde. Status/Notiz ändern: nur Admin. */
"use strict";

let VORFAELLE = [];

const V_ART = {
  unfall:   { label: "Unfall",            farbe: "#c0392b", bg: "#fdecea" },
  beinahe:  { label: "Beinahe-Unfall",    farbe: "#e08e0b", bg: "#fdf6e3" },
  unsicher: { label: "Unsicherer Zustand", farbe: "#2d6a4f", bg: "#eaf5ef" },
  umwelt:   { label: "Umweltvorfall",     farbe: "#1f6f8b", bg: "#e8f4f8" },
};
const V_STATUS = { neu: "eingegangen – wird geprüft", offen: "offen", bearbeitung: "in Bearbeitung", erledigt: "erledigt" };
let V_MELDER = {};   // nur Admin: vorfall_id -> Melder (Nebentabelle, fuer den Betrieb bleiben Meldungen anonym)
const V_DOMAENE = { arbeitssicherheit: "Arbeitssicherheit", umwelt: "Umwelt", beides: "Arbeitssicherheit + Umwelt" };

function vDatum(s){
  if(!s) return "—";
  const t = String(s).slice(0, 10).split("-");
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : s;
}
/* Das Foto kommt aus einer Meldung ohne Login. Nur echte Bild-Data-URLs rendern –
   sonst waere ein "javascript:"-Wert im Feld ein Einfallstor. */
function vFoto(wert){
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(wert || ""))) return "";
  const s = esc(wert);
  return `<a href="${s}" target="_blank" rel="noopener"><img class="v-foto" src="${s}" alt="Belegfoto zur Meldung"></a>`;
}
function vSichtbar(){ return AKTIV ? VORFAELLE.filter(v => v.kunde_slug === AKTIV) : VORFAELLE; }
/* Eine Meldung kann beide Bereiche betreffen ("beides") – sie erscheint dann in beiden Reitern. */
function vBereich(bereich){
  return vSichtbar().filter(v => bereich === "umwelt"
    ? (v.domaene === "umwelt" || v.domaene === "beides" || v.art === "umwelt")
    : (v.domaene !== "umwelt" || v.domaene === "beides"));
}
function vOffen(rows){ return rows.filter(v => v.status !== "erledigt").length; }

async function ladeVorfaelle(){
  try{
    VORFAELLE = await apiGet("/rest/v1/portal_vorfaelle?select=id,kunde_slug,kunde,art,domaene,ereignis_am,ereignis_zeit,ort,anlage,beschreibung,verletzte,erste_hilfe,stoff,menge,wohin,status,bearbeitung,quelle,angelegt_am,updated_at,ausfalltage,ursache,sofortmassnahme,langzeitmassnahme,ausgewertet_von,ausgewertet_am&order=ereignis_am.desc,angelegt_am.desc", false) || [];   // Foto (Base64, bis 2,5 MB) erst auf Klick
  }catch(e){ VORFAELLE = []; }
  V_MELDER = {};
  if(typeof ADMIN !== "undefined" && ADMIN){
    try{ (await apiGet("/rest/v1/portal_vorfall_melder?select=vorfall_id,melder", false) || []).forEach(m => { V_MELDER[m.vorfall_id] = m.melder; }); }catch(e){}
  }
}

function vKarte(v){
  const a = V_ART[v.art] || V_ART.unsicher;
  const umwelt = v.art === "umwelt" || v.domaene === "umwelt" || v.domaene === "beides";
  const zeilen = [
    ["Wann", vDatum(v.ereignis_am) + (v.ereignis_zeit ? " · " + esc(v.ereignis_zeit) : "")],
    ["Wo", [v.ort, v.anlage].filter(Boolean).map(esc).join(" · ") || "—"],
    umwelt ? ["Stoff / Menge", [v.stoff, v.menge].filter(Boolean).map(esc).join(" · ") || "—"] : null,
    umwelt ? ["Gelangt nach", esc(v.wohin || "—")] : null,
    (typeof ADMIN !== "undefined" && ADMIN) ? ["Gemeldet von", V_MELDER[v.id] ? esc(V_MELDER[v.id]) : "<i>anonym</i>"] : null,
  ].filter(Boolean);

  const ausgewertet = !!(v.ausgewertet_am || v.sofortmassnahme || v.langzeitmassnahme);
  const merkmale = [
    v.verletzte ? '<span class="v-merk">Person verletzt</span>' : "",
    v.erste_hilfe ? '<span class="v-merk">Erste Hilfe geleistet</span>' : "",
    `<span class="v-merk">${esc(V_DOMAENE[v.domaene] || v.domaene)}</span>`,
  ].join("");

  const statusFeld = ADMIN
    ? `<select class="v-status" data-id="${esc(v.id)}">${Object.entries(V_STATUS).map(([k, l]) =>
        `<option value="${k}"${v.status === k ? " selected" : ""}>${l}</option>`).join("")}</select>`
    : `<span class="v-badge v-${esc(v.status)}">${esc(V_STATUS[v.status] || v.status)}</span>`;

  const notiz = ADMIN
    ? `<label class="v-notiz-label">Bearbeitung / veranlasste Maßnahme
         <textarea class="v-notiz" data-id="${esc(v.id)}" rows="2"
           placeholder="Was wurde veranlasst?">${esc(v.bearbeitung || "")}</textarea></label>`
    : (v.bearbeitung ? `<div class="v-notiz-ro"><b>Bearbeitung:</b> ${esc(v.bearbeitung)}</div>` : "");

  /* Eingeklappt: eine Zeile je Meldung. Aufgeklappt erst auf Klick – bei mehreren Meldungen
     mit Fotos ist die Seite sonst nicht mehr überblickbar (Nikolai, 14.08.2026). */
  const kurz = (v.beschreibung || "").replace(/\s+/g, " ").slice(0, 90);
  return `<details class="v-karte" style="border-left:5px solid ${a.farbe}">
    <summary class="v-kopf">
      <span class="v-art" style="background:${a.bg};color:${a.farbe}">${a.label}</span>
      <span class="v-datum">${vDatum(v.ereignis_am)}</span>
      <span class="v-kurz">${esc(v.ort || kurz)}</span>
      <span class="v-spacer"></span>
      ${ausgewertet ? "" : '<span class="v-merk v-ausw-offen">Auswertung offen</span>'}
      <span class="v-badge v-${esc(v.status)}">${esc(V_STATUS[v.status] || v.status)}</span>
    </summary>
    <div class="v-kopf v-kopf-innen"><span class="v-spacer"></span>${statusFeld}</div>
    <div class="v-text">${esc(v.beschreibung).replace(/\n/g, "<br>")}</div>
    <div class="v-merkmale">${merkmale}</div>
    <table class="v-daten">${zeilen.map(([k, w]) => `<tr><th>${k}</th><td>${w}</td></tr>`).join("")}</table>
    ${v.foto === undefined ? `<button class="btn-klein v-foto-laden" data-id="${esc(v.id)}">Foto anzeigen</button>` : vFoto(v.foto)}
    ${vAuswertungBlock(v)}
    ${notiz}
    <div class="v-fuss">Eingegangen ${vDatum(v.angelegt_am)}${v.quelle === "portal" ? " · im Portal erfasst" : " · über den Meldelink"}</div>
  </details>`;
}

function renderVorfaelle(wrap, bereich){
  bereich = bereich || "arbeitssicherheit";
  const umwelt = bereich === "umwelt";
  const rows = vBereich(bereich);
  const offen = vOffen(rows);
  const sec = document.createElement("section");
  sec.className = "sektion";
  const knopf = ADMIN
    ? `<button class="btn sek" id="vNeu" type="button">+ Vorfall erfassen</button>` : "";
  /* Der Meldeaushang liegt als Dokument im Katalog – hier direkt verlinkt, damit man ihn
     dort findet, wo man ihn braucht (statt in einem eigenen Reiter). */
  /* Drucken ueber die fertige PDF – Strg+P auf der Anzeige zerschiesst das Layout (Nikolai 16.09.) */
  const aushangPdf = sichtbar().find(r => r.kategorie === "vorfall-aushang" && r.doc_typ === "pdf");
  const aushang = aushangPdf || sichtbar().find(r => r.kategorie === "vorfall-aushang");
  const aushangLink = aushangPdf
    ? ` <button type="button" class="btn sek v-aushang-druck" data-aushang="${esc(aushangPdf.storage_path)}">Aushang drucken</button>`
    : aushang ? ` <a class="v-aushang" href="${viewerUrl(aushang.doc_typ, aushang.storage_path, aushang.titel)}"
         target="_blank" rel="noopener">Aushang mit QR-Code öffnen</a>` : "";
  sec.innerHTML = `<div class="sek-kopf"><h2>${umwelt ? "Umweltvorfälle" : "Unfälle &amp; Beinahe-Unfälle"}</h2>
      <span class="zaehler">${rows.length} ${rows.length === 1 ? "Meldung" : "Meldungen"}${offen ? " · " + offen + " offen" : ""}</span>
      <span class="v-spacer"></span>${knopf}</div>
    <div class="v-info">${umwelt
      ? `Gemeldete Umweltvorfälle – Austritt von Öl, Kraftstoff oder Chemikalien, Leckagen und
         vergleichbare Ereignisse. <b>Gelangen wassergefährdende Stoffe in nicht nur unerheblicher Menge
         in Gewässer, Kanalisation oder Boden, ist das unverzüglich anzuzeigen</b> (§ 24 Abs. 2 AwSV).`
      : `Meldungen aus dem Betrieb – über den QR-Aushang in der Halle oder hier erfasst.
         <b>Beinahe-Unfälle sind die wertvollsten Meldungen</b>: Sie zeigen die Lücke, bevor etwas passiert.`}${aushangLink}</div>
    ${rows.length ? `<div class="v-liste">${rows.map(vKarte).join("")}</div>`
      : `<div class="leer">Bisher keine Meldungen.<br><span style="font-style:normal">Der Meldelink für die Beschäftigten hängt als QR-Aushang in der Halle.</span></div>`}`;
  wrap.appendChild(sec);

  sec.querySelectorAll(".v-foto-laden").forEach(b => b.addEventListener("click", async () => {
    b.disabled = true; b.textContent = "lädt …";
    try{
      const r = await apiGet("/rest/v1/portal_vorfaelle?select=foto&id=eq." + encodeURIComponent(b.dataset.id), false);
      const v = VORFAELLE.find(x => x.id === b.dataset.id); const foto = (r && r[0] && r[0].foto) || null;
      if(v) v.foto = foto;
      b.insertAdjacentHTML("afterend", foto ? vFoto(foto) : '<span class="uw-leise">kein Foto</span>'); b.remove();
    }catch(e){ b.disabled = false; b.textContent = "Foto anzeigen"; }
  }));
  sec.querySelectorAll("[data-aushang]").forEach(b => b.addEventListener("click", () => vAushangDrucken(b)));
  sec.querySelectorAll("[data-vausw]").forEach(b => b.addEventListener("click", () => vAuswertungDialog(b.dataset.vausw)));
  if(!ADMIN) return;
  sec.querySelectorAll(".v-status").forEach(s => s.addEventListener("change", async ev => {
    const el = ev.target; el.disabled = true;
    try{
      await vSpeichern(el.dataset.id, { status: el.value });
      const v = VORFAELLE.find(x => x.id === el.dataset.id); if(v) v.status = el.value;
    }catch(e){ alert("Status konnte nicht gespeichert werden: " + (e.message || e)); }
    finally{ el.disabled = false; }
  }));
  sec.querySelectorAll(".v-notiz").forEach(t => t.addEventListener("change", async ev => {
    const el = ev.target; el.disabled = true;
    try{
      await vSpeichern(el.dataset.id, { bearbeitung: el.value });
      const v = VORFAELLE.find(x => x.id === el.dataset.id); if(v) v.bearbeitung = el.value;
    }catch(e){ alert("Notiz konnte nicht gespeichert werden: " + (e.message || e)); }
    finally{ el.disabled = false; }
  }));
  const neu = sec.querySelector("#vNeu");
  if(neu) neu.addEventListener("click", vDialogOeffnen);
}

/* PDF laden und direkt den Druckdialog oeffnen; klappt das nicht, oeffnet sich die PDF im neuen Tab */
async function vAushangDrucken(knopf){
  const text = knopf.textContent; knopf.disabled = true; knopf.textContent = "wird geladen …";
  try{
    const url = (typeof anfrSigned === "function") ? await anfrSigned(knopf.dataset.aushang) : null;
    if(!url) throw new Error("kein Link");
    const blob = await (await fetch(url)).blob();
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    let f = document.getElementById("vAushangFrame");
    if(f) f.remove();
    f = document.createElement("iframe"); f.id = "vAushangFrame"; f.title = "Aushang";
    f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    f.onload = () => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ window.open(blobUrl, "_blank", "noopener"); } };
    f.src = blobUrl; document.body.appendChild(f);
  }catch(e){ alert("Aushang konnte nicht geladen werden."); }
  finally{ knopf.disabled = false; knopf.textContent = text; }
}

async function vSpeichern(id, felder){
  felder.updated_at = new Date().toISOString();
  await apiSend("PATCH", "/rest/v1/portal_vorfaelle?id=eq." + encodeURIComponent(id), felder, "return=minimal");
}

/* Erfassung im Portal – für Meldungen, die mündlich oder telefonisch kommen. */
function vDialogOeffnen(){
  let dlg = document.getElementById("vDlg");
  if(!dlg){
    dlg = document.createElement("dialog");
    dlg.id = "vDlg"; dlg.className = "pw-dlg";
    dlg.innerHTML = `<form id="vForm" method="dialog">
      <h3>Vorfall erfassen</h3>
      <label class="feld">Art
        <select id="vArt">${Object.entries(V_ART).map(([k, a]) => `<option value="${k}">${a.label}</option>`).join("")}</select></label>
      <label class="feld">Datum <input type="date" id="vDatum"></label>
      <label class="feld">Uhrzeit / Schicht <input type="text" id="vZeit" placeholder="z. B. 22:30 oder Nachtschicht"></label>
      <label class="feld">Ort <input type="text" id="vOrt" placeholder="Halle, Bereich"></label>
      <label class="feld">Maschine / Anlage <input type="text" id="vAnlage"></label>
      <label class="feld">Was ist passiert? <textarea id="vText" rows="5"></textarea></label>
      <label class="feld">Gemeldet von <input type="text" id="vMelder" placeholder="leer = anonym"></label>
      <label class="v-check"><input type="checkbox" id="vVerletzt"> Person verletzt</label>
      <div class="pw-msg" id="vMsg"></div>
      <div class="pw-aktionen">
        <button class="btn sek" type="button" id="vAbbruch">Abbrechen</button>
        <button class="btn" type="submit" id="vOk">Speichern</button>
      </div></form>`;
    document.body.appendChild(dlg);
    dlg.querySelector("#vAbbruch").addEventListener("click", () => dlg.close());
    dlg.querySelector("#vForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      const msg = dlg.querySelector("#vMsg");
      const text = dlg.querySelector("#vText").value.trim();
      if(text.length < 5){ msg.textContent = "Bitte kurz beschreiben, was passiert ist."; msg.className = "pw-msg fehler"; return; }
      msg.textContent = "Wird gespeichert …"; msg.className = "pw-msg";
      const art = dlg.querySelector("#vArt").value;
      const kunde = (ALLE.find(r => r.kunde_slug === AKTIV) || {}).kunde || "";
      try{
        await apiSend("POST", "/rest/v1/portal_vorfaelle", [{
          kunde_slug: AKTIV, kunde: kunde, art: art,
          domaene: art === "umwelt" ? "umwelt" : "arbeitssicherheit",
          ereignis_am: dlg.querySelector("#vDatum").value || null,
          ereignis_zeit: dlg.querySelector("#vZeit").value || null,
          ort: dlg.querySelector("#vOrt").value || null,
          anlage: dlg.querySelector("#vAnlage").value || null,
          beschreibung: text,
          melder: dlg.querySelector("#vMelder").value || null,
          verletzte: dlg.querySelector("#vVerletzt").checked,
          status: "offen", quelle: "portal"
        }], "return=minimal");
        await ladeVorfaelle();
        dlg.close();
        renderSektionen();
      }catch(e){ msg.textContent = "Fehlgeschlagen: " + (e.message || e); msg.className = "pw-msg fehler"; }
    });
  }
  dlg.querySelector("#vDatum").valueAsDate = new Date();
  dlg.querySelector("#vText").value = "";
  dlg.querySelector("#vMsg").textContent = "";
  dlg.showModal();
}

/* ---- Auswertung (Nikolai 16.09.2026): Ausfalltage, Ursache, Sofort- und Langzeitmassnahme ----
   Darf auch der Betrieb (Schichtfuehrer) nachtragen. Die Datenbank laesst fuer den Betrieb nur diese
   Felder zu (Trigger portal_vorfaelle_nur_auswertung); Meldung und Status bleiben bei OAK. */
function vAuswertungBlock(v){
  const hat = v.ausgewertet_am || v.sofortmassnahme || v.langzeitmassnahme || v.ursache || v.ausfalltage != null;
  const zeilen = [
    v.art === "unfall" ? ["Ausfalltage", v.ausfalltage != null ? String(v.ausfalltage) : "—"] : null,
    ["Ursache", v.ursache], ["Sofortmaßnahme", v.sofortmassnahme], ["Langzeitmaßnahme", v.langzeitmassnahme]
  ].filter(z => z && z[1] != null && z[1] !== "");
  const anzeige = v.art === "unfall" && v.ausfalltage > 3
    ? `<div class="v-anzeige">Mehr als 3 Ausfalltage: Unfallanzeige an die Berufsgenossenschaft innerhalb von 3 Tagen (§ 193 Abs. 1 SGB VII).</div>` : "";
  return `<div class="v-auswertung">
      <div class="v-ausw-kopf"><b>Auswertung</b><button type="button" class="btn-klein" data-vausw="${esc(v.id)}">${hat ? "Auswertung ändern" : "Auswerten"}</button></div>
      ${hat ? `<table class="v-daten">${zeilen.map(([k, w]) => `<tr><th>${k}</th><td>${esc(w).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>
        ${anzeige}${v.ausgewertet_von || v.ausgewertet_am ? `<div class="v-fuss">ausgewertet${v.ausgewertet_von ? " von " + esc(v.ausgewertet_von) : ""}${v.ausgewertet_am ? " am " + vDatum(v.ausgewertet_am) : ""}</div>` : ""}`
      : `<div class="uw-leise">Noch nicht ausgewertet.</div>`}
    </div>`;
}

function vAuswertungDialog(id){
  const v = VORFAELLE.find(x => x.id === id); if(!v) return;
  let dlg = document.getElementById("vAuswDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "vAuswDlg"; dlg.className = "pw-dlg mg-dlg"; document.body.appendChild(dlg); }
  const a = V_ART[v.art] || V_ART.unsicher;
  const name = /^Schichtf/i.test(window.__oakName || "") ? "" : (window.__oakName || "");
  dlg.innerHTML = `<form method="dialog">
      <h3>Vorfall auswerten</h3>
      <p class="pw-hint"><b>${a.label}</b> · ${vDatum(v.ereignis_am)}${v.ort ? " · " + esc(v.ort) : ""}<br>${esc((v.beschreibung || "").slice(0, 160))}</p>
      ${v.art === "unfall" ? `<label>Ausfalltage<input type="number" id="vaTage" min="0" max="3650" step="1" inputmode="numeric" placeholder="0 = keine" value="${v.ausfalltage != null ? String(v.ausfalltage) : ""}"></label>` : ""}
      <label>Ursache<textarea id="vaUrsache" rows="2" placeholder="Was hat dazu geführt?">${esc(v.ursache || "")}</textarea></label>
      <label>Sofortmaßnahme<textarea id="vaSofort" rows="2" placeholder="Was wurde direkt getan?">${esc(v.sofortmassnahme || "")}</textarea></label>
      <label>Langzeitmaßnahme<textarea id="vaLang" rows="2" placeholder="Was verhindert, dass es wieder passiert?">${esc(v.langzeitmassnahme || "")}</textarea></label>
      <label>Ausgewertet von<input type="text" id="vaWer" autocomplete="name" placeholder="Vor- und Nachname" value="${esc(v.ausgewertet_von || name)}"></label>
      <p class="pw-msg" id="vaMsg"></p>
      <div class="pw-akt"><button type="button" class="btn sek" id="vaAbbruch">Abbrechen</button><button type="submit" class="btn" id="vaOk">Speichern</button></div>
    </form>`;
  const msg = dlg.querySelector("#vaMsg");
  dlg.querySelector("#vaAbbruch").addEventListener("click", () => dlg.close());
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const wert = sel => (dlg.querySelector(sel).value || "").trim() || null;
    const tageFeld = dlg.querySelector("#vaTage");
    const tage = tageFeld && tageFeld.value !== "" ? parseInt(tageFeld.value, 10) : null;
    const felder = { ursache: wert("#vaUrsache"), sofortmassnahme: wert("#vaSofort"), langzeitmassnahme: wert("#vaLang"), ausgewertet_von: wert("#vaWer") };
    if(tageFeld) felder.ausfalltage = tage;
    msg.className = "pw-msg";
    if(tage != null && (isNaN(tage) || tage < 0)){ msg.textContent = "Bitte die Ausfalltage als Zahl eintragen (0 = keine)."; msg.classList.add("fehler"); return; }
    if(!felder.sofortmassnahme && !felder.langzeitmassnahme && !felder.ursache && tage == null){ msg.textContent = "Bitte mindestens ein Feld ausfüllen."; msg.classList.add("fehler"); return; }
    if(!felder.ausgewertet_von || felder.ausgewertet_von.length < 3){ msg.textContent = "Bitte eintragen, wer ausgewertet hat."; msg.classList.add("fehler"); return; }
    felder.ausgewertet_am = new Date().toISOString();
    const knopf = dlg.querySelector("#vaOk"); knopf.disabled = true; msg.textContent = "Wird gespeichert …";
    try{
      await vSpeichern(v.id, felder);
      Object.assign(v, felder); dlg.close(); renderSektionen();
    }catch(e){ knopf.disabled = false; msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
  dlg.showModal();
}

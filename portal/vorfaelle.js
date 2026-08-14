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
const V_STATUS = { offen: "offen", bearbeitung: "in Bearbeitung", erledigt: "erledigt" };
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
function vOffen(){ return vSichtbar().filter(v => v.status !== "erledigt").length; }

async function ladeVorfaelle(){
  try{
    VORFAELLE = await apiGet("/rest/v1/portal_vorfaelle?select=*&order=ereignis_am.desc,angelegt_am.desc", false) || [];
  }catch(e){ VORFAELLE = []; }
}

function vKarte(v){
  const a = V_ART[v.art] || V_ART.unsicher;
  const umwelt = v.art === "umwelt" || v.domaene === "umwelt" || v.domaene === "beides";
  const zeilen = [
    ["Wann", vDatum(v.ereignis_am) + (v.ereignis_zeit ? " · " + esc(v.ereignis_zeit) : "")],
    ["Wo", [v.ort, v.anlage].filter(Boolean).map(esc).join(" · ") || "—"],
    umwelt ? ["Stoff / Menge", [v.stoff, v.menge].filter(Boolean).map(esc).join(" · ") || "—"] : null,
    umwelt ? ["Gelangt nach", esc(v.wohin || "—")] : null,
    ["Gemeldet von", v.melder ? esc(v.melder) : "<i>anonym</i>"],
  ].filter(Boolean);

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
      <span class="v-badge v-${esc(v.status)}">${esc(V_STATUS[v.status] || v.status)}</span>
    </summary>
    <div class="v-kopf v-kopf-innen"><span class="v-spacer"></span>${statusFeld}</div>
    <div class="v-text">${esc(v.beschreibung).replace(/\n/g, "<br>")}</div>
    <div class="v-merkmale">${merkmale}</div>
    <table class="v-daten">${zeilen.map(([k, w]) => `<tr><th>${k}</th><td>${w}</td></tr>`).join("")}</table>
    ${vFoto(v.foto)}
    ${notiz}
    <div class="v-fuss">Eingegangen ${vDatum(v.angelegt_am)}${v.quelle === "portal" ? " · im Portal erfasst" : " · über den Meldelink"}</div>
  </details>`;
}

function renderVorfaelle(wrap){
  const rows = vSichtbar();
  const sec = document.createElement("section");
  sec.className = "sektion";
  const knopf = ADMIN
    ? `<button class="btn sek" id="vNeu" type="button">+ Vorfall erfassen</button>` : "";
  sec.innerHTML = `<div class="sek-kopf"><h2>Unfälle &amp; Beinahe-Unfälle</h2>
      <span class="zaehler">${rows.length} ${rows.length === 1 ? "Meldung" : "Meldungen"}${vOffen() ? " · " + vOffen() + " offen" : ""}</span>
      <span class="v-spacer"></span>${knopf}</div>
    <div class="v-info">Meldungen aus dem Betrieb – über den QR-Aushang in der Halle oder hier erfasst.
      Erfasst werden Unfälle, Beinahe-Unfälle, unsichere Zustände und Umweltvorfälle (z. B. Ölaustritt).
      <b>Beinahe-Unfälle sind die wertvollsten Meldungen</b>: Sie zeigen die Lücke, bevor etwas passiert.</div>
    ${rows.length ? `<div class="v-liste">${rows.map(vKarte).join("")}</div>`
      : `<div class="leer">Bisher keine Meldungen.<br><span style="font-style:normal">Der Meldelink für die Beschäftigten hängt als QR-Aushang in der Halle.</span></div>`}`;
  wrap.appendChild(sec);

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

/* OAK Kundenportal — Register „Effizienzmaßnahmen" (Domäne Energie).
   Energiebefunde aus den Begehungen: bewusst KEIN erzeugtes Dokument, sondern eine gepflegte Liste
   (Nikolai, 14.08.2026) – Status und Notiz ändern sich laufend, ein PDF wäre am Tag darauf veraltet.
   Aufbau bewusst identisch zu vorfaelle.js; die Kartenklassen (.v-*) werden mitbenutzt. */
"use strict";

let ENERGIE = [];

const E_STATUS = { offen: "offen", geplant: "geplant", umgesetzt: "umgesetzt" };
const E_FARBE  = { offen: "#e08e0b", geplant: "#1f6f8b", umgesetzt: "#2d6a4f" };

async function ladeEnergie(){
  try{
    ENERGIE = await apiGet("/rest/v1/portal_energiemassnahmen?select=*&order=status.asc,festgestellt_am.desc", false) || [];
  }catch(e){ ENERGIE = []; }
}
function eSichtbar(){ return AKTIV ? ENERGIE.filter(e => e.kunde_slug === AKTIV) : ENERGIE; }

function eKarte(m){
  const farbe = E_FARBE[m.status] || E_FARBE.offen;
  const statusFeld = ADMIN
    ? `<select class="v-status e-status" data-id="${esc(m.id)}">${Object.entries(E_STATUS).map(([k, l]) =>
        `<option value="${k}"${m.status === k ? " selected" : ""}>${l}</option>`).join("")}</select>`
    : `<span class="v-badge v-${esc(m.status)}">${esc(E_STATUS[m.status] || m.status)}</span>`;
  const zeilen = [
    ["Ort / Anlage", esc(m.ort || "—")],
    ["Festgestellt", vDatum(m.festgestellt_am) + (m.quelle ? " · " + esc(m.quelle) : "")],
    ["Maßnahme", esc(m.massnahme || "—")],
    ["Einsparung", m.einsparung ? esc(m.einsparung) : "<i>nicht beziffert – Messung ausstehend</i>"],
  ];
  const notiz = ADMIN
    ? `<label class="v-notiz-label">Bearbeitungsstand
         <textarea class="v-notiz e-notiz" data-id="${esc(m.id)}" rows="2"
           placeholder="Was ist veranlasst?">${esc(m.notiz || "")}</textarea></label>`
    : (m.notiz ? `<div class="v-notiz-ro"><b>Bearbeitung:</b> ${esc(m.notiz)}</div>` : "");

  return `<details class="v-karte" style="border-left:5px solid ${farbe}">
    <summary class="v-kopf">
      <span class="v-art" style="background:#eef4f1;color:${farbe}">Energie</span>
      <span class="v-datum">${vDatum(m.festgestellt_am)}</span>
      <span class="v-kurz">${esc(m.titel)}</span>
      <span class="v-spacer"></span>
      <span class="v-badge v-${esc(m.status)}">${esc(E_STATUS[m.status] || m.status)}</span>
    </summary>
    <div class="v-kopf v-kopf-innen"><span class="v-spacer"></span>${statusFeld}</div>
    <div class="v-text"><b>${esc(m.titel)}</b><br>${esc(m.beschreibung || "").replace(/\n/g, "<br>")}</div>
    <table class="v-daten">${zeilen.map(([k, w]) => `<tr><th>${k}</th><td>${w}</td></tr>`).join("")}</table>
    ${notiz}
    <div class="v-fuss">Erfasst ${vDatum(m.angelegt_am)}</div>
  </details>`;
}

function renderEnergie(wrap){
  const rows = eSichtbar();
  const offen = rows.filter(m => m.status === "offen").length;
  const sec = document.createElement("section");
  sec.className = "sektion";
  const knopf = ADMIN ? `<button class="btn sek" id="eNeu" type="button">+ Maßnahme erfassen</button>` : "";
  sec.innerHTML = `<div class="sek-kopf"><h2>Effizienzmaßnahmen</h2>
      <span class="zaehler">${rows.length} ${rows.length === 1 ? "Eintrag" : "Einträge"}${offen ? " · " + offen + " offen" : ""}</span>
      <span class="v-spacer"></span>${knopf}</div>
    <div class="v-info">Energiebefunde aus den Begehungen und die daraus abgeleiteten Maßnahmen.
      Sie stehen bewusst getrennt von der Mängelliste Arbeitsschutz: <b>keine Sicherheitsrelevanz,
      aber ein Kostenthema</b> – und der Einstieg in ein Energiemanagement nach ISO 50001.</div>
    ${rows.length ? `<div class="v-liste">${rows.map(eKarte).join("")}</div>`
      : `<div class="leer">Noch keine Energiebefunde erfasst.</div>`}`;
  wrap.appendChild(sec);

  if(!ADMIN) return;
  sec.querySelectorAll(".e-status").forEach(s => s.addEventListener("change", async ev => {
    const el = ev.target; el.disabled = true;
    try{
      await eSpeichern(el.dataset.id, { status: el.value });
      const m = ENERGIE.find(x => x.id === el.dataset.id); if(m) m.status = el.value;
    }catch(e){ alert("Status konnte nicht gespeichert werden: " + (e.message || e)); }
    finally{ el.disabled = false; }
  }));
  sec.querySelectorAll(".e-notiz").forEach(t => t.addEventListener("change", async ev => {
    const el = ev.target; el.disabled = true;
    try{
      await eSpeichern(el.dataset.id, { notiz: el.value });
      const m = ENERGIE.find(x => x.id === el.dataset.id); if(m) m.notiz = el.value;
    }catch(e){ alert("Notiz konnte nicht gespeichert werden: " + (e.message || e)); }
    finally{ el.disabled = false; }
  }));
  const neu = sec.querySelector("#eNeu");
  if(neu) neu.addEventListener("click", eDialogOeffnen);
}

async function eSpeichern(id, felder){
  felder.updated_at = new Date().toISOString();
  await apiSend("PATCH", "/rest/v1/portal_energiemassnahmen?id=eq." + encodeURIComponent(id), felder, "return=minimal");
}

function eDialogOeffnen(){
  let dlg = document.getElementById("eDlg");
  if(!dlg){
    dlg = document.createElement("dialog");
    dlg.id = "eDlg"; dlg.className = "pw-dlg";
    dlg.innerHTML = `<form id="eForm" method="dialog">
      <h3>Energiemaßnahme erfassen</h3>
      <label class="feld">Befund (Kurztitel) <input type="text" id="eTitel" placeholder="z. B. Druckluftleckage an der Kupplung"></label>
      <label class="feld">Beschreibung <textarea id="eBeschr" rows="3"></textarea></label>
      <label class="feld">Ort / Anlage <input type="text" id="eOrt" placeholder="z. B. D150/3 oder betriebsweit"></label>
      <label class="feld">Festgestellt am <input type="date" id="eDatum"></label>
      <label class="feld">Maßnahme <textarea id="eMass" rows="2"></textarea></label>
      <label class="feld">Einsparung <input type="text" id="eSpar" placeholder="leer lassen, solange nicht gemessen"></label>
      <div class="pw-msg" id="eMsg"></div>
      <div class="pw-aktionen">
        <button class="btn sek" type="button" id="eAbbruch">Abbrechen</button>
        <button class="btn" type="submit">Speichern</button>
      </div></form>`;
    document.body.appendChild(dlg);
    dlg.querySelector("#eAbbruch").addEventListener("click", () => dlg.close());
    dlg.querySelector("#eForm").addEventListener("submit", async ev => {
      ev.preventDefault();
      const msg = dlg.querySelector("#eMsg");
      const titel = dlg.querySelector("#eTitel").value.trim();
      if(titel.length < 3){ msg.textContent = "Bitte einen Kurztitel angeben."; msg.className = "pw-msg fehler"; return; }
      msg.textContent = "Wird gespeichert …"; msg.className = "pw-msg";
      const kunde = (ALLE.find(r => r.kunde_slug === AKTIV) || {}).kunde || "";
      try{
        await apiSend("POST", "/rest/v1/portal_energiemassnahmen", [{
          kunde_slug: AKTIV, kunde: kunde, titel: titel,
          beschreibung: dlg.querySelector("#eBeschr").value || null,
          ort: dlg.querySelector("#eOrt").value || null,
          festgestellt_am: dlg.querySelector("#eDatum").value || null,
          massnahme: dlg.querySelector("#eMass").value || null,
          einsparung: dlg.querySelector("#eSpar").value || null,
          status: "offen", quelle: "im Portal erfasst"
        }], "return=minimal");
        await ladeEnergie();
        dlg.close();
        renderSektionen();
      }catch(e){ msg.textContent = "Fehlgeschlagen: " + (e.message || e); msg.className = "pw-msg fehler"; }
    });
  }
  dlg.querySelector("#eDatum").valueAsDate = new Date();
  dlg.querySelector("#eTitel").value = "";
  dlg.querySelector("#eMsg").textContent = "";
  dlg.showModal();
}

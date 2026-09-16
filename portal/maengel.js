/* OAK Kundenportal — Mängel als To-Do-Liste: alle Mängel aller Maschinen, nach Priorität
   (Schutzzaun/Roboter zuerst, dann Leitern, dann Leckagen/Ordnung), je Zeile Maschine, Mangel,
   Maßnahme, Risiko. Schichtführer haken ab – mit Zeitstempel und Name im Log (portal_maengel_log).
   Daten: portal_maengel (befüllt von tools/maengel_publish.py aus den doc-data der Maschinen). */
"use strict";

let MAENGEL = [], MAENGEL_LOG = [], MG_FILTER = { status: "offen", thema: "" }, MG_MELDUNG = "";
const MG_THEMA = { schutzzaun: "Schutzzaun / Roboter", leiter_aufstieg: "Leitern / Aufstieg", leckage_ordnung: "Leckagen / Ordnung",
                   pruefung: "Prüfung", elektrik: "Elektrik", sonstiges: "Sonstiges" };

async function ladeMaengel(){
  try{ MAENGEL = await apiGet("/rest/v1/portal_maengel?select=*&order=prioritaet.asc,maschinen_id.asc", false) || []; }catch(e){ MAENGEL = []; }
  try{ MAENGEL_LOG = await apiGet("/rest/v1/portal_maengel_log?select=mangel_id,aktion,von_name,am&order=am.desc&limit=500", false) || []; }catch(e){ MAENGEL_LOG = []; }
}
function mgSichtbar(){ return AKTIV ? MAENGEL.filter(m => m.kunde_slug === AKTIV) : MAENGEL; }
function mgOffen(){ return mgSichtbar().filter(m => m.status !== "erledigt").length; }
function mgDatum(s){ if(!s) return ""; const d = new Date(s); return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }
function mgRisiko(m){
  const r = m.risiko_v || 0; if(!r) return "";
  const kl = r >= 9 ? "kritisch" : (r >= 4 ? "warnung" : "gut");
  return `<span class="uw-badge uw-${kl}" title="Ausgangsrisiko nach Nohl">${r}</span>`;
}

async function renderMaengel(wrap){
  if(!MAENGEL.length) await ladeMaengel();
  const alle = mgSichtbar();
  const themen = [...new Set(alle.map(m => m.thema))].sort((a, b) => (alle.find(x => x.thema === a).thema_rang) - (alle.find(x => x.thema === b).thema_rang));
  let rows = alle.filter(m => MG_FILTER.status === "alle" ? true : (MG_FILTER.status === "erledigt" ? m.status === "erledigt" : m.status !== "erledigt"));
  if(MG_FILTER.thema) rows = rows.filter(m => m.thema === MG_FILTER.thema);
  const offen = alle.filter(m => m.status !== "erledigt").length;
  const meld = MG_MELDUNG ? `<div class="uw-meld">${esc(MG_MELDUNG)}</div>` : ""; MG_MELDUNG = "";
  const sec = document.createElement("section"); sec.className = "sektion";
  const chip = (wert, text, akt) => `<button type="button" class="uw-pill${akt ? " aktiv" : ""}" data-mgf="${esc(wert)}">${text}</button>`;
  sec.innerHTML = `${meld}
    <div class="sek-kopf"><h2>Mängel</h2><span class="zaehler">${offen} offen · ${alle.length - offen} erledigt</span></div>
    <p class="uw-erkl">Die To-Do-Liste aus allen Gefährdungsbeurteilungen, wichtigstes zuerst. Erledigt? Haken setzen – Datum und Name
      werden festgehalten. Schutzzäune an den Roboterzellen stehen ganz oben.</p>
    <div class="mg-filter">
      <div class="uw-pills">${chip("offen", "Offen", MG_FILTER.status === "offen")}${chip("erledigt", "Erledigt", MG_FILTER.status === "erledigt")}${chip("alle", "Alle", MG_FILTER.status === "alle")}</div>
      <select class="uw-fassung" id="mgThema"><option value="">Alle Themen</option>${themen.map(t => `<option value="${esc(t)}"${MG_FILTER.thema === t ? " selected" : ""}>${esc(MG_THEMA[t] || t)}</option>`).join("")}</select>
    </div>
    ${rows.length ? `<div class="tabelle-wrap"><table class="uw-tab mg-tab">
      <thead><tr><th></th><th>Maschine</th><th>Mangel</th><th>Maßnahme</th><th>Risiko</th><th>Stand</th></tr></thead>
      <tbody>${rows.map(m => {
        const erledigt = m.status === "erledigt";
        return `<tr class="${erledigt ? "mg-erledigt" : ""}" data-id="${esc(m.id)}">
          <td><label class="mg-check"><input type="checkbox" data-mg="${esc(m.id)}"${erledigt ? " checked" : ""}><span></span></label></td>
          <td><b>${esc(m.maschinen_id)}</b><div class="uw-leise">${esc(m.maschine || "")}</div></td>
          <td><div class="mg-label">${esc(m.label)}</div><div class="uw-leise">${esc(MG_THEMA[m.thema] || m.thema)}${m.rechtsquelle ? " · " + esc(m.rechtsquelle) : ""}</div></td>
          <td class="mg-massnahme">${esc(m.massnahme || "—")}</td>
          <td>${mgRisiko(m)}</td>
          <td class="uw-leise">${erledigt ? "erledigt " + mgDatum(m.erledigt_am) + (m.erledigt_von ? "<br>" + esc(m.erledigt_von) : "") : "offen"}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="ck-fuss">${alle.length ? "Nichts in dieser Auswahl." : "Noch keine Mängel übertragen."}</div>`}`;
  wrap.appendChild(sec);
  sec.querySelectorAll("[data-mgf]").forEach(b => b.addEventListener("click", () => { MG_FILTER.status = b.dataset.mgf; renderSektionen(); }));
  sec.querySelector("#mgThema").addEventListener("change", e => { MG_FILTER.thema = e.target.value; renderSektionen(); });
  sec.querySelectorAll("input[data-mg]").forEach(cb => cb.addEventListener("change", () => mgSetzen(cb.dataset.mg, cb.checked)));
}

async function mgSetzen(id, erledigt){
  const m = MAENGEL.find(x => x.id === id); if(!m) return;
  const s = getSession(); const name = window.__oakName || (s && s.user && s.user.email) || "";
  const jetzt = new Date().toISOString();
  try{
    await apiSend("PATCH", "/rest/v1/portal_maengel?id=eq." + encodeURIComponent(id),
      erledigt ? { status: "erledigt", erledigt_am: jetzt, erledigt_von: name, updated_at: jetzt }
               : { status: "offen", erledigt_am: null, erledigt_von: null, updated_at: jetzt }, "return=minimal");
    await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: id, kunde_slug: m.kunde_slug, aktion: erledigt ? "erledigt" : "wieder geöffnet",
      von_name: name, von_user_id: s && s.user ? s.user.id : null }, "return=minimal");
    m.status = erledigt ? "erledigt" : "offen"; m.erledigt_am = erledigt ? jetzt : null; m.erledigt_von = erledigt ? name : null;
    MG_MELDUNG = (erledigt ? "Erledigt: " : "Wieder offen: ") + m.maschinen_id + " – " + m.label.slice(0, 80);
    renderSektionen();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); renderSektionen(); }
}

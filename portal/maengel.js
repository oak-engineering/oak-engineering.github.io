/* OAK Kundenportal — Mängel als To-Do-Liste (16.09.2026, zweite Fassung nach Nikolais Rückmeldung).
   - Karten statt Tabelle, gruppiert nach Priorität (Schutzzaun/Roboter zuerst, dann Leitern, Leckagen …).
   - Maschine mit ihrem Namen im Betrieb (D330/1) – die OAK-Nummer WIB-xx bleibt intern.
   - „Erledigt melden" nur MIT Nachweis: kurzer Text oder Foto (Pflicht auch in der Datenbank,
     Constraint maengel_erledigt_mit_nachweis). Name + Zeitstempel landen im Log (portal_maengel_log).
   - Wieder öffnen darf nur der Admin (Fehlklick oder Nachweis reicht nicht).
   Daten: portal_maengel (befüllt von tools/maengel_publish.py), Fotos im Speicher unter <slug>/maengel/. */
"use strict";

let MAENGEL = [], MG_GELADEN = false, MG_FILTER = { status: "offen", maschine: "", ampel: "" }, MG_MELDUNG = "";
const MG_THEMA = { schutzzaun: "Schutzzäune & Roboterzellen", leiter_aufstieg: "Leitern & Aufstiege", leckage_ordnung: "Leckagen & Ordnung",
                   pruefung: "Prüfungen & Dokumentation", elektrik: "Elektrik", sonstiges: "Sonstiges",
                   pruefung_meldung: "Gemeldet bei der Maschinenprüfung", betrieb_meldung: "Vom Betrieb gemeldet" };

async function ladeMaengel(){
  try{ MAENGEL = await apiGet("/rest/v1/portal_maengel?select=*&order=prioritaet.asc,maschine.asc", false) || []; MG_GELADEN = true; }
  catch(e){ MAENGEL = []; }
}
const MG_RANG = { schutzzaun: 1, leiter_aufstieg: 2, leckage_ordnung: 3, pruefung: 4, elektrik: 5, sonstiges: 6, pruefung_meldung: 3, betrieb_meldung: 0 };
/* Von Hand bearbeitete Werte (nur Admin, Spalte manuell) gehen vor; maengel_publish.py ueberschreibt sie nie. */
function mgFeld(m, k){ return (m.manuell && m.manuell[k] != null && m.manuell[k] !== "") ? m.manuell[k] : m[k]; }
function mgSichtbar(){ return (AKTIV ? MAENGEL.filter(m => m.kunde_slug === AKTIV) : MAENGEL).filter(m => !m.ausgeblendet); }
function mgOffen(){ return mgSichtbar().filter(m => m.status !== "erledigt").length; }
function mgDatum(s){ if(!s) return ""; const d = new Date(s); return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"; }
/* Name im Betrieb; bei allgemeinen Themen (ALLG-xx) steht dort der Thementitel */
function mgMaschine(m){ return (m.maschine || "").trim() || "ohne Maschine"; }
/* Klick auf den Mangel: Maengelliste der Maschine (mit Befundfotos) im Dokument-Viewer (Nikolai 16.09.) */
function mgListeLink(m){
  const r = (typeof ALLE !== "undefined" ? ALLE : []).find(x => x.kunde_slug === m.kunde_slug && x.maschinen_id === m.maschinen_id && (x.typen || []).includes("maengelliste"));
  if(!r || typeof viewerUrl !== "function") return "";
  return viewerUrl("maengelliste", r.storage_path, (r.maschine || "") + " · Mängelliste", "&m=" + encodeURIComponent(r.maschine || "") + "&mid=" + encodeURIComponent(r.maschinen_id || ""));
}
function mgIstAllgemein(m){ return /^ALLG/i.test(m.maschinen_id || "") || /tätigkeit/i.test(m.maschinentyp || ""); }

async function renderMaengel(wrap){
  if(!MG_GELADEN) await ladeMaengel();
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);
  const betrieb = AKTIV ? MAENGEL.filter(m => m.kunde_slug === AKTIV) : MAENGEL;
  const alle = betrieb.filter(m => !m.ausgeblendet);
  const aus = betrieb.filter(m => m.ausgeblendet);
  const offenAlle = alle.filter(m => m.status !== "erledigt");
  if((MG_FILTER.status === "ausgeblendet" || MG_FILTER.status === "uebernehmen") && !istAdmin) MG_FILTER.status = "offen";
  /* Arbeitsliste fuer OAK: erledigt gemeldet, aber GBU/BA/Maengelliste noch nicht nachgezogen */
  const zuUebernehmen = alle.filter(m => m.status === "erledigt" && !m.uebernommen_am);
  let rows = MG_FILTER.status === "ausgeblendet" ? aus
           : MG_FILTER.status === "uebernehmen" ? zuUebernehmen
           : alle.filter(m => MG_FILTER.status === "erledigt" ? m.status === "erledigt" : m.status !== "erledigt");
  if(MG_FILTER.maschine) rows = rows.filter(m => mgMaschine(m) === MG_FILTER.maschine);
  /* Kurzuebersicht nach Ampel (wie bei den Maschinen), klickbar als Filter */
  const bwVon = m => m.bewertung_manuell || m.band || "ohne";
  const zahl = { gefahr: 0, besorgnis: 0, akzeptanz: 0 };
  rows.forEach(m => { if(zahl[bwVon(m)] != null) zahl[bwVon(m)]++; });
  const kurz = [["gefahr", "Gefahrbereich", "sofort", "kritisch"], ["besorgnis", "Besorgnisbereich", "zeitnah", "warnung"], ["akzeptanz", "Akzeptanzbereich", "bei Gelegenheit", "gut"]]
    .map(([k, l, h, stufe]) => `<button type="button" class="ck-kachel ck-${stufe} mg-kurz${MG_FILTER.ampel === k ? " aktiv" : ""}" data-mgampel="${k}">
        <div class="ck-zahl">${zahl[k]}</div><div class="ck-label">${l}</div><div class="ck-hinweis">${h}${MG_FILTER.ampel === k ? " · Filter aktiv" : ""}</div></button>`).join("");
  if(MG_FILTER.ampel) rows = rows.filter(m => bwVon(m) === MG_FILTER.ampel);
  const maschinen = [...new Set(alle.filter(m => !mgIstAllgemein(m)).map(mgMaschine))].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
  const allgemein = [...new Set(alle.filter(mgIstAllgemein).map(mgMaschine))].sort();
  const meld = MG_MELDUNG ? `<div class="uw-meld">${esc(MG_MELDUNG)}</div>` : ""; MG_MELDUNG = "";

  /* Gruppen nach (ggf. von Hand gesetztem) Thema in der festgelegten Reihenfolge */
  const gruppen = [];
  rows.forEach(m => { const th = mgFeld(m, "thema"); let g = gruppen.find(x => x.thema === th);
    if(!g){ g = { thema: th, rang: MG_RANG[th] || m.thema_rang || 9, liste: [] }; gruppen.push(g); } g.liste.push(m); });
  gruppen.sort((a, b) => a.rang - b.rang);
  const typ = m => mgIstAllgemein(m) ? "allgemein" : String(m.maschinentyp || "").replace(/\s*\(mit [^)]*\)/i, "");
  const bwText = { gefahr: "Gefahrbereich · sofort", besorgnis: "Besorgnisbereich · zeitnah", akzeptanz: "Akzeptanzbereich · bei Gelegenheit" };
  const zeile = m => {
    const erledigt = m.status === "erledigt";
    const bw = m.bewertung_manuell || m.band || "ohne";
    const label = mgFeld(m, "label"), massnahme = mgFeld(m, "massnahme"), link = mgListeLink(m);
    const vonHand = !!(m.manuell || m.bewertung_manuell);
    return `<div class="mg-zeile mg-${bw}${erledigt ? " mg-erledigt" : ""}">
      <span class="mg-ampel" title="${esc(bwText[bw] || "nicht bewertet")}"></span>
      <div class="mg-wer"><b>${esc(mgMaschine(m))}</b><span>${esc(typ(m))}</span></div>
      <div class="mg-text">${link ? `<a class="mg-label mg-link" href="${link}" target="_blank" rel="noopener" title="Mängelliste der Maschine mit Fotos öffnen">${esc(label)}</a>` : `<div class="mg-label">${esc(label)}</div>`}
        ${massnahme ? `<div class="mg-massnahme">Maßnahme: ${esc(massnahme)}</div>` : ""}
        ${m.gemeldet_von || m.gemeldet_am ? `<div class="mg-massnahme">gemeldet${m.gemeldet_am ? " am " + esc(new Date(m.gemeldet_am + "T12:00:00").toLocaleDateString("de-DE")) : ""}${m.gemeldet_von ? " von " + esc(m.gemeldet_von) : ""}</div>` : ""}
        ${istAdmin && vonHand ? `<div class="mg-massnahme"><i>von OAK engineering angepasst</i></div>` : ""}
        ${erledigt ? `<div class="mg-nachweis">✓ erledigt ${esc(mgDatum(m.erledigt_am))}${m.erledigt_von ? " · " + esc(m.erledigt_von) : ""}${m.notiz ? " – " + esc(m.notiz) : ""}</div>` : ""}
        ${erledigt && m.uebernommen_am ? `<div class="mg-massnahme">in die Unterlagen übernommen am ${esc(new Date(m.uebernommen_am).toLocaleDateString("de-DE"))}</div>`
          : erledigt && istAdmin ? `<div class="mg-uebernahme">GBU/BA/Mängelliste noch nicht nachgezogen</div>` : ""}</div>
      <div class="mg-aktion">${istAdmin ? `<button type="button" class="btn-klein" data-mgedit="${esc(m.id)}">Bearbeiten</button>` : ""}${m.foto_pfad ? `<button type="button" class="btn-klein" data-mgfoto="${esc(m.foto_pfad)}">Befundfoto</button>` : ""}${m.ausgeblendet ? "" : (erledigt
        ? `${m.nachweis_pfad ? `<button type="button" class="btn-klein" data-mgfoto="${esc(m.nachweis_pfad)}">Foto</button>` : ""}${istAdmin && !m.uebernommen_am ? `<button type="button" class="btn-klein" data-mgueb="${esc(m.id)}">übernommen</button>` : ""}${istAdmin ? `<button type="button" class="btn-klein" data-mgauf="${esc(m.id)}">öffnen</button>` : ""}`
        : `<button type="button" class="btn-klein mg-erl" data-mgerl="${esc(m.id)}">Erledigt</button>`)}</div>
    </div>`;
  };
  /* Mangel erfassen – wie „Vorfall melden" bei den Vorfaellen (Nikolai 16.09.) */
  const hero = document.createElement("section"); hero.className = "sektion uw-hero vf-melden-hero";
  hero.innerHTML = `<button type="button" class="uw-start" id="mgNeuKnopf">Mangel erfassen</button>
    <p class="uw-erkl uw-hero-text">Mangel an einer Maschine oder in der Halle – mit Foto. OAK engineering bewertet ihn und nimmt ihn in die Unterlagen auf.</p>`;
  wrap.appendChild(hero);
  hero.querySelector("#mgNeuKnopf").addEventListener("click", mgErfassen);
  const sec = document.createElement("section"); sec.className = "sektion mg-seite";
  sec.innerHTML = `${meld}
    <div class="mg-filter">
      <div class="uw-pills">
        <button type="button" class="uw-pill${MG_FILTER.status === "offen" ? " aktiv" : ""}" data-mgf="offen">Offen · ${offenAlle.length}</button>
        <button type="button" class="uw-pill${MG_FILTER.status === "erledigt" ? " aktiv" : ""}" data-mgf="erledigt">Erledigt · ${alle.length - offenAlle.length}</button>
        ${istAdmin ? `<button type="button" class="uw-pill${MG_FILTER.status === "uebernehmen" ? " aktiv" : ""}" data-mgf="uebernehmen" title="Erledigt, aber GBU/BA/Mängelliste noch nicht nachgezogen">In Unterlagen übernehmen · ${zuUebernehmen.length}</button>` : ""}
        ${istAdmin ? `<button type="button" class="uw-pill${MG_FILTER.status === "ausgeblendet" ? " aktiv" : ""}" data-mgf="ausgeblendet">Ausgeblendet · ${aus.length}</button>` : ""}
      </div>
      <select class="uw-fassung" id="mgMaschine" aria-label="Maschine">
        <option value="">Alle Maschinen</option>
        ${maschinen.map(n => `<option${MG_FILTER.maschine === n ? " selected" : ""}>${esc(n)}</option>`).join("")}
        ${allgemein.length ? `<optgroup label="Allgemein">${allgemein.map(n => `<option${MG_FILTER.maschine === n ? " selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>` : ""}
      </select>
    </div>
    <div class="mg-kurzreihe">${kurz}</div>
    ${gruppen.length ? gruppen.map((g, i) => `<details class="mg-gruppe"${(i === 0 || MG_FILTER.maschine || MG_FILTER.ampel || MG_FILTER.status !== "offen") ? " open" : ""}>
        <summary><span>${esc(MG_THEMA[g.thema] || g.thema)}</span><b>${g.liste.length}</b></summary>
        <div class="mg-liste">${g.liste.map(zeile).join("")}</div></details>`).join("")
      : `<div class="ck-fuss">${alle.length ? "Nichts in dieser Auswahl." : "Noch keine Mängel übertragen."}</div>`}`;
  wrap.appendChild(sec);
  sec.querySelectorAll("[data-mgf]").forEach(b => b.addEventListener("click", () => { MG_FILTER.status = b.dataset.mgf; renderSektionen(); }));
  sec.querySelectorAll("[data-mgampel]").forEach(b => b.addEventListener("click", () => { MG_FILTER.ampel = MG_FILTER.ampel === b.dataset.mgampel ? "" : b.dataset.mgampel; renderSektionen(); }));
  sec.querySelector("#mgMaschine").addEventListener("change", e => { MG_FILTER.maschine = e.target.value; renderSektionen(); });
  sec.querySelectorAll("[data-mgerl]").forEach(b => b.addEventListener("click", () => mgDialog(b.dataset.mgerl)));
  sec.querySelectorAll("[data-mgedit]").forEach(b => b.addEventListener("click", () => mgBearbeiten(b.dataset.mgedit)));
  sec.querySelectorAll("[data-mgauf]").forEach(b => b.addEventListener("click", () => mgWiederAuf(b.dataset.mgauf)));
  sec.querySelectorAll("[data-mgueb]").forEach(b => b.addEventListener("click", () => mgUebernommen(b.dataset.mgueb)));
  sec.querySelectorAll("[data-mgfoto]").forEach(b => b.addEventListener("click", async () => {
    const u = (typeof anfrSigned === "function") ? await anfrSigned(b.dataset.mgfoto) : null;
    if(u) window.open(u, "_blank", "noopener"); else alert("Foto konnte nicht geöffnet werden.");
  }));
  /* Startkachel „Mangel erfassen" fuehrt auf #maengel?neu=1 */
  if(typeof HASH_Q !== "undefined" && HASH_Q && HASH_Q.get("neu")){ HASH_Q = null; mgErfassen(); }
}

/* Maschinen des Betriebs fuer die Auswahl – Name im Betrieb, sortiert (D50/3 vor D100/4) */
function mgMaschinenAuswahl(){
  const quelle = (typeof ALLE !== "undefined" ? ALLE : []).concat(MAENGEL);
  const je = new Map();
  quelle.forEach(r => { if(r.kunde_slug === AKTIV && r.maschinen_id && (r.maschine || "").trim() && !mgIstAllgemein(r) && !je.has(r.maschinen_id)) je.set(r.maschinen_id, r); });
  return [...je.values()].sort((a, b) => a.maschine.localeCompare(b.maschine, "de", { numeric: true }));
}

/* Neuer Mangel (Schichtfuehrer, Fachkraft, Admin). Datenbank: Policy maengel_vom_betrieb_erfassen (Schluessel BM-…),
   Text/Bewertung aendert danach nur OAK (Trigger portal_maengel_admin_felder). */
function mgErfassen(){
  if(!AKTIV){ alert("Bitte zuerst oben den Betrieb wählen."); return; }
  let dlg = document.getElementById("mgNeuDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "mgNeuDlg"; dlg.className = "pw-dlg mg-dlg"; document.body.appendChild(dlg); }
  const heute = new Date().toISOString().slice(0, 10);
  const maschinen = mgMaschinenAuswahl();
  dlg.innerHTML = `<form method="dialog">
      <h3>Mangel erfassen</h3>
      <label>Wo?<select id="mgnWo"><option value="">– Maschine wählen –</option>
        ${maschinen.map(r => `<option value="${esc(r.maschinen_id)}">${esc(r.maschine)}</option>`).join("")}
        <option value="ALLG-HALLE">Halle / allgemein (keine Maschine)</option></select></label>
      <label>Was ist nicht in Ordnung?<textarea id="mgnText" rows="3" placeholder="z. B. Schutztür schließt nicht, Leiter beschädigt"></textarea></label>
      <label>Wie dringend?<select id="mgnBw">
        <option value="gefahr">Sofort – akute Gefahr</option>
        <option value="besorgnis" selected>Zeitnah beheben</option>
        <option value="akzeptanz">Bei Gelegenheit</option></select></label>
      <label>Foto<input type="file" id="mgnFoto" accept="image/*" capture="environment"></label>
      <img id="mgnVorschau" class="mg-vorschau" alt="" hidden>
      <label>Gemeldet von<input type="text" id="mgnWer" autocomplete="name" placeholder="Vor- und Nachname" value="${esc(/^Schichtf/i.test(window.__oakName || "") ? "" : (window.__oakName || ""))}"></label>
      <label>Festgestellt am<input type="date" id="mgnDatum" value="${heute}" max="${heute}"></label>
      <p class="pw-msg" id="mgnMsg"></p>
      <div class="pw-akt"><button type="button" class="btn sek" id="mgnAbbruch">Abbrechen</button><button type="submit" class="btn" id="mgnSpeichern">Speichern</button></div>
    </form>`;
  const foto = dlg.querySelector("#mgnFoto"), vorschau = dlg.querySelector("#mgnVorschau"), msg = dlg.querySelector("#mgnMsg");
  foto.addEventListener("change", () => { const f = foto.files[0]; if(f){ vorschau.src = URL.createObjectURL(f); vorschau.hidden = false; } else vorschau.hidden = true; });
  dlg.querySelector("#mgnAbbruch").addEventListener("click", () => dlg.close());
  const fehler = (text, feld) => { msg.textContent = text; msg.className = "pw-msg fehler"; if(feld) dlg.querySelector(feld).focus(); };
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const wo = dlg.querySelector("#mgnWo").value, text = dlg.querySelector("#mgnText").value.trim();
    const bw = dlg.querySelector("#mgnBw").value, wer = dlg.querySelector("#mgnWer").value.trim();
    const datum = dlg.querySelector("#mgnDatum").value, datei = foto.files[0];
    if(!wo) return fehler("Bitte die Maschine wählen (oder „Halle / allgemein“).", "#mgnWo");
    if(text.length < 5) return fehler("Bitte kurz beschreiben, was nicht in Ordnung ist.", "#mgnText");
    if(wer.length < 3) return fehler("Bitte eintragen, wer den Mangel meldet.", "#mgnWer");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return fehler("Bitte das Datum eintragen.", "#mgnDatum");
    const knopf = dlg.querySelector("#mgnSpeichern"); knopf.disabled = true; msg.className = "pw-msg"; msg.textContent = "Wird gespeichert …";
    try{
      const schluessel = "BM-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
      let pfad = null;
      if(datei){
        const blob = /^image\//.test(datei.type) ? await mgFotoKlein(datei) : null;
        if(!blob) throw new Error("Bitte ein Foto wählen.");
        pfad = AKTIV + "/maengel/" + schluessel + ".jpg";
        const t = await token();
        const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST",
          headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob });
        if(!r.ok) throw new Error("Foto konnte nicht hochgeladen werden (" + r.status + ")");
      }
      const m = wo === "ALLG-HALLE" ? { maschinen_id: "ALLG-HALLE", maschine: "Halle / allgemein", maschinentyp: "Tätigkeit / allgemein" } : mgMaschinenAuswahl().find(r => r.maschinen_id === wo);
      const kunde = (MAENGEL.find(x => x.kunde_slug === AKTIV && x.kunde) || {}).kunde || null;
      const neu = await apiSend("POST", "/rest/v1/portal_maengel", {
        kunde_slug: AKTIV, kunde, maschinen_id: m.maschinen_id, maschine: m.maschine, maschinentyp: m.maschinentyp || null,
        schluessel, thema: "betrieb_meldung", thema_rang: 0, label: text, band: bw,
        prioritaet: { gefahr: 10, besorgnis: 3010, akzeptanz: 6010 }[bw], status: "offen", foto_pfad: pfad,
        gemeldet_von: wer, gemeldet_am: datum }, "return=representation");
      const zeile = Array.isArray(neu) ? neu[0] : neu;
      const s = getSession();
      try{ await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: zeile.id, kunde_slug: AKTIV, aktion: "erfasst",
        von_name: wer, von_user_id: s && s.user ? s.user.id : null, notiz: text.slice(0, 2000), nachweis_pfad: pfad }, "return=minimal"); }catch(e){}
      MAENGEL.push(zeile);
      MG_FILTER = { status: "offen", maschine: "", ampel: "" };
      MG_MELDUNG = "Mangel erfasst: " + m.maschine + " – " + text.slice(0, 80);
      dlg.close(); renderSektionen(); window.scrollTo(0, 0);
    }catch(e){ knopf.disabled = false; fehler("Konnte nicht gespeichert werden: " + (e.message || e)); }
  });
  dlg.showModal();
}

/* Bearbeiten (nur Admin): Text, Massnahme, Thema, Ampel, ausblenden. Die Datenbank laesst das nur OAK zu
   (Trigger portal_maengel_admin_felder). Originalwerte bleiben erhalten, geaendert wird die Spalte manuell. */
function mgBearbeiten(id){
  const m = MAENGEL.find(x => x.id === id); if(!m || !(typeof ADMIN !== "undefined" && ADMIN)) return;
  let dlg = document.getElementById("mgEditDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "mgEditDlg"; dlg.className = "pw-dlg mg-dlg mg-edit"; document.body.appendChild(dlg); }
  const bw = m.bewertung_manuell || m.band || "besorgnis", th = mgFeld(m, "thema");
  dlg.innerHTML = `<form method="dialog">
      <h3>Mangel bearbeiten</h3>
      <p class="pw-hint"><b>${esc(mgMaschine(m))}</b>${m.mangel_nr ? " · " + esc(m.mangel_nr) : ""}</p>
      <label>Mangel<textarea id="mgeLabel" rows="3">${esc(mgFeld(m, "label") || "")}</textarea></label>
      <label>Maßnahme<textarea id="mgeMassnahme" rows="3">${esc(mgFeld(m, "massnahme") || "")}</textarea></label>
      <label>Bewertung<select id="mgeBw">${[["gefahr", "Gefahrbereich · sofort"], ["besorgnis", "Besorgnisbereich · zeitnah"], ["akzeptanz", "Akzeptanzbereich · bei Gelegenheit"]]
        .map(([w, l]) => `<option value="${w}"${w === bw ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Thema<select id="mgeThema">${Object.keys(MG_THEMA).map(k => `<option value="${k}"${k === th ? " selected" : ""}>${esc(MG_THEMA[k])}</option>`).join("")}</select></label>
      <label class="mg-edit-aus"><input type="checkbox" id="mgeAus"${m.ausgeblendet ? " checked" : ""}> Mangel ausblenden (trifft nicht zu)</label>
      <p class="pw-hint">Original: ${esc(m.label)}</p>
      <p class="pw-msg" id="mgeMsg"></p>
      <div class="pw-akt">${m.manuell || m.bewertung_manuell ? `<button type="button" class="btn sek" id="mgeZurueck">Original wiederherstellen</button>` : ""}
        <button type="button" class="btn sek" id="mgeAbbruch">Abbrechen</button><button type="submit" class="btn">Speichern</button></div>
    </form>`;
  dlg.querySelector("#mgeAbbruch").addEventListener("click", () => dlg.close());
  const speichern = async (felder, aktion) => {
    const s = getSession(); const name = window.__oakName || (s && s.user && s.user.email) || "";
    const msg = dlg.querySelector("#mgeMsg"); msg.className = "pw-msg"; msg.textContent = "Wird gespeichert …";
    try{
      await apiSend("PATCH", "/rest/v1/portal_maengel?id=eq." + encodeURIComponent(m.id), Object.assign({ updated_at: new Date().toISOString() }, felder), "return=minimal");
      await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: m.id, kunde_slug: m.kunde_slug, aktion, von_name: name,
        von_user_id: s && s.user ? s.user.id : null, notiz: JSON.stringify(felder).slice(0, 2000) }, "return=minimal");
      Object.assign(m, felder); MG_MELDUNG = "Gespeichert: " + mgMaschine(m); dlg.close(); renderSektionen();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  };
  const zb = dlg.querySelector("#mgeZurueck");
  if(zb) zb.addEventListener("click", () => speichern({ manuell: null, bewertung_manuell: null }, "Original wiederhergestellt"));
  dlg.querySelector("form").addEventListener("submit", ev => {
    ev.preventDefault();
    const label = dlg.querySelector("#mgeLabel").value.trim(), massnahme = dlg.querySelector("#mgeMassnahme").value.trim();
    const thema = dlg.querySelector("#mgeThema").value, bwNeu = dlg.querySelector("#mgeBw").value;
    if(label.length < 3){ const msg = dlg.querySelector("#mgeMsg"); msg.textContent = "Bitte den Mangel beschreiben."; msg.className = "pw-msg fehler"; return; }
    const manuell = {};
    if(label !== m.label) manuell.label = label;
    if(massnahme !== (m.massnahme || "")) manuell.massnahme = massnahme;
    if(thema !== m.thema) manuell.thema = thema;
    speichern({ manuell: Object.keys(manuell).length ? manuell : null, bewertung_manuell: bwNeu === m.band ? null : bwNeu,
                ausgeblendet: dlg.querySelector("#mgeAus").checked }, "bearbeitet");
  });
  dlg.showModal();
}

/* Foto verkleinern (lange Kante 1600 px, JPEG) – am Handy sind Originale 4–8 MB */
function mgFotoKlein(datei){
  return new Promise((ok, fehler) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image();
      img.onload = () => { const max = 1600, f = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? ok(b) : fehler(new Error("Foto nicht lesbar")), "image/jpeg", 0.75); };
      img.onerror = () => fehler(new Error("Foto nicht lesbar")); img.src = r.result; };
    r.onerror = () => fehler(new Error("Foto nicht lesbar")); r.readAsDataURL(datei);
  });
}

function mgDialog(id){
  const m = MAENGEL.find(x => x.id === id); if(!m) return;
  let dlg = document.getElementById("mgDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "mgDlg"; dlg.className = "pw-dlg mg-dlg"; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog">
      <h3>Mangel erledigt</h3>
      <p class="pw-hint"><b>${esc(mgMaschine(m))}</b> – ${esc(m.label)}</p>
      <label>Wer hat es erledigt?<input type="text" id="mgWer" autocomplete="name" placeholder="Vor- und Nachname" value="${esc(/^Schichtf/i.test(window.__oakName || "") ? "" : (window.__oakName || ""))}"></label>
      <label>Erledigt am<input type="date" id="mgDatum" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}"></label>
      <label>Was wurde gemacht?<textarea id="mgNotiz" rows="3" placeholder="z. B. Schutzzaun geschlossen, Tür verriegelt"></textarea></label>
      <label>Foto als Nachweis<input type="file" id="mgFoto" accept="image/*" capture="environment"></label>
      <img id="mgVorschau" class="mg-vorschau" alt="" hidden>
      <p class="pw-hint">Text oder Foto ist Pflicht. Ihr Name und die Uhrzeit werden gespeichert.</p>
      <p class="pw-msg" id="mgMsg"></p>
      <div class="pw-akt"><button type="button" class="btn sek" id="mgAbbruch">Abbrechen</button><button type="submit" class="btn" id="mgSpeichern">Speichern</button></div>
    </form>`;
  const foto = dlg.querySelector("#mgFoto"), vorschau = dlg.querySelector("#mgVorschau"), msg = dlg.querySelector("#mgMsg");
  foto.addEventListener("change", () => { const f = foto.files[0]; if(f){ vorschau.src = URL.createObjectURL(f); vorschau.hidden = false; } else vorschau.hidden = true; });
  dlg.querySelector("#mgAbbruch").addEventListener("click", () => dlg.close());
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const notiz = dlg.querySelector("#mgNotiz").value.trim(), datei = foto.files[0], wer = dlg.querySelector("#mgWer").value.trim();
    msg.className = "pw-msg";
    if(wer.length < 3){ msg.textContent = "Bitte eintragen, wer den Mangel erledigt hat."; msg.classList.add("fehler"); dlg.querySelector("#mgWer").focus(); return; }
    const datumWert = dlg.querySelector("#mgDatum").value;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(datumWert)){ msg.textContent = "Bitte das Datum der Erledigung eintragen."; msg.classList.add("fehler"); return; }
    if(!notiz && !datei){ msg.textContent = "Bitte kurz schreiben, was gemacht wurde, oder ein Foto aufnehmen."; msg.classList.add("fehler"); return; }
    const knopf = dlg.querySelector("#mgSpeichern"); knopf.disabled = true; msg.textContent = "Wird gespeichert …";
    try{
      let pfad = null;
      if(datei){
        const blob = /^image\//.test(datei.type) ? await mgFotoKlein(datei) : null;
        if(!blob) throw new Error("Bitte ein Foto wählen.");
        pfad = m.kunde_slug + "/maengel/" + m.id + "-" + Date.now() + ".jpg";
        const t = await token();
        const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST",
          headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob });
        if(!r.ok) throw new Error("Foto konnte nicht hochgeladen werden (" + r.status + ")");
      }
      const s = getSession(); const name = wer;
      /* Erledigt-Datum aus dem Formular (Uhrzeit mittags, damit keine Zeitzone den Tag verschiebt); Log behaelt den echten Zeitpunkt */
      const jetzt = (datumWert === new Date().toISOString().slice(0, 10)) ? new Date().toISOString() : datumWert + "T12:00:00";
      await apiSend("PATCH", "/rest/v1/portal_maengel?id=eq." + encodeURIComponent(m.id),
        { status: "erledigt", erledigt_am: jetzt, erledigt_von: name, notiz: notiz || null, nachweis_pfad: pfad, updated_at: jetzt }, "return=minimal");
      await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: m.id, kunde_slug: m.kunde_slug, aktion: "erledigt",
        von_name: name, von_user_id: s && s.user ? s.user.id : null, notiz: notiz || null, nachweis_pfad: pfad }, "return=minimal");
      Object.assign(m, { status: "erledigt", erledigt_am: jetzt, erledigt_von: name, notiz: notiz || null, nachweis_pfad: pfad });
      MG_MELDUNG = "Erledigt gemeldet: " + mgMaschine(m) + " – " + m.label.slice(0, 80);
      dlg.close(); renderSektionen();
    }catch(e){ knopf.disabled = false; msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
  dlg.showModal();
}

/* OAK hat GBU, BA und Maengelliste der Maschine nachgezogen (nach Wirksamkeitskontrolle) – nur Admin */
async function mgUebernommen(id){
  const m = MAENGEL.find(x => x.id === id); if(!m) return;
  if(!confirm("GBU, BA und Mängelliste für " + mgMaschine(m) + " sind nachgezogen und hochgeladen?")) return;
  const s = getSession(); const jetzt = new Date().toISOString();
  try{
    await apiSend("PATCH", "/rest/v1/portal_maengel?id=eq." + encodeURIComponent(id), { uebernommen_am: jetzt, uebernommen_von: "OAK engineering", updated_at: jetzt }, "return=minimal");
    await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: id, kunde_slug: m.kunde_slug, aktion: "in die Unterlagen übernommen",
      von_name: "OAK engineering", von_user_id: s && s.user ? s.user.id : null }, "return=minimal");
    Object.assign(m, { uebernommen_am: jetzt, uebernommen_von: "OAK engineering" });
    MG_MELDUNG = "In die Unterlagen übernommen: " + mgMaschine(m); renderSektionen();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
}

async function mgWiederAuf(id){
  const m = MAENGEL.find(x => x.id === id); if(!m || !confirm("Diesen Mangel wieder öffnen?")) return;
  const s = getSession(); const name = window.__oakName || (s && s.user && s.user.email) || ""; const jetzt = new Date().toISOString();
  try{
    await apiSend("PATCH", "/rest/v1/portal_maengel?id=eq." + encodeURIComponent(id),
      { status: "offen", erledigt_am: null, erledigt_von: null, notiz: null, nachweis_pfad: null, updated_at: jetzt }, "return=minimal");
    await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: id, kunde_slug: m.kunde_slug, aktion: "wieder geöffnet",
      von_name: name, von_user_id: s && s.user ? s.user.id : null }, "return=minimal");
    Object.assign(m, { status: "offen", erledigt_am: null, erledigt_von: null, notiz: null, nachweis_pfad: null });
    MG_MELDUNG = "Wieder offen: " + mgMaschine(m); renderSektionen();
  }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
}

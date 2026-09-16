/* OAK Kundenportal — Mängel als To-Do-Liste (16.09.2026, zweite Fassung nach Nikolais Rückmeldung).
   - Karten statt Tabelle, gruppiert nach Priorität (Schutzzaun/Roboter zuerst, dann Leitern, Leckagen …).
   - Maschine mit ihrem Namen im Betrieb (D330/1) – die OAK-Nummer WIB-xx bleibt intern.
   - „Erledigt melden" nur MIT Nachweis: kurzer Text oder Foto (Pflicht auch in der Datenbank,
     Constraint maengel_erledigt_mit_nachweis). Name + Zeitstempel landen im Log (portal_maengel_log).
   - Wieder öffnen darf nur der Admin (Fehlklick oder Nachweis reicht nicht).
   Daten: portal_maengel (befüllt von tools/maengel_publish.py), Fotos im Speicher unter <slug>/maengel/. */
"use strict";

let MAENGEL = [], MG_GELADEN = false, MG_FILTER = { status: "offen", maschine: "" }, MG_MELDUNG = "";
const MG_THEMA = { schutzzaun: "Schutzzäune & Roboterzellen", leiter_aufstieg: "Leitern & Aufstiege", leckage_ordnung: "Leckagen & Ordnung",
                   pruefung: "Prüfungen & Dokumentation", elektrik: "Elektrik", sonstiges: "Sonstiges",
                   pruefung_meldung: "Gemeldet bei der Maschinenprüfung" };

async function ladeMaengel(){
  try{ MAENGEL = await apiGet("/rest/v1/portal_maengel?select=*&order=prioritaet.asc,maschine.asc", false) || []; MG_GELADEN = true; }
  catch(e){ MAENGEL = []; }
}
function mgSichtbar(){ return AKTIV ? MAENGEL.filter(m => m.kunde_slug === AKTIV) : MAENGEL; }
function mgOffen(){ return mgSichtbar().filter(m => m.status !== "erledigt").length; }
function mgDatum(s){ if(!s) return ""; const d = new Date(s); return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"; }
/* Name im Betrieb; bei allgemeinen Themen (ALLG-xx) steht dort der Thementitel */
function mgMaschine(m){ return (m.maschine || "").trim() || "ohne Maschine"; }
function mgIstAllgemein(m){ return /^ALLG/i.test(m.maschinen_id || "") || /tätigkeit/i.test(m.maschinentyp || ""); }

async function renderMaengel(wrap){
  if(!MG_GELADEN) await ladeMaengel();
  const alle = mgSichtbar();
  const offenAlle = alle.filter(m => m.status !== "erledigt");
  let rows = alle.filter(m => MG_FILTER.status === "erledigt" ? m.status === "erledigt" : m.status !== "erledigt");
  if(MG_FILTER.maschine) rows = rows.filter(m => mgMaschine(m) === MG_FILTER.maschine);
  const maschinen = [...new Set(alle.filter(m => !mgIstAllgemein(m)).map(mgMaschine))].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
  const allgemein = [...new Set(alle.filter(mgIstAllgemein).map(mgMaschine))].sort();
  const meld = MG_MELDUNG ? `<div class="uw-meld">${esc(MG_MELDUNG)}</div>` : ""; MG_MELDUNG = "";

  /* Gruppen nach Thema in der festgelegten Reihenfolge; erste Gruppe offen, bei Maschinenfilter alle */
  const gruppen = [];
  rows.forEach(m => { let g = gruppen.find(x => x.thema === m.thema); if(!g){ g = { thema: m.thema, rang: m.thema_rang || 9, liste: [] }; gruppen.push(g); } g.liste.push(m); });
  gruppen.sort((a, b) => a.rang - b.rang);
  const typ = m => mgIstAllgemein(m) ? "allgemein" : String(m.maschinentyp || "").replace(/\s*\(mit [^)]*\)/i, "");
  const zeile = m => {
    const erledigt = m.status === "erledigt";
    return `<div class="mg-zeile mg-${m.band || "ohne"}${erledigt ? " mg-erledigt" : ""}">
      <span class="mg-ampel" title="${esc(m.band === "gefahr" ? "Gefahrbereich" : m.band === "besorgnis" ? "Besorgnisbereich" : m.band === "akzeptanz" ? "Akzeptanzbereich" : "nicht bewertet")}"></span>
      <div class="mg-wer"><b>${esc(mgMaschine(m))}</b><span>${esc(typ(m))}</span></div>
      <div class="mg-text"><div class="mg-label">${esc(m.label)}</div>
        ${m.massnahme ? `<div class="mg-massnahme">Maßnahme: ${esc(m.massnahme)}</div>` : ""}
        ${erledigt ? `<div class="mg-nachweis">✓ erledigt ${esc(mgDatum(m.erledigt_am))}${m.erledigt_von ? " · " + esc(m.erledigt_von) : ""}${m.notiz ? " – " + esc(m.notiz) : ""}</div>` : ""}</div>
      <div class="mg-aktion">${m.foto_pfad ? `<button type="button" class="btn-klein" data-mgfoto="${esc(m.foto_pfad)}">Befundfoto</button>` : ""}${erledigt
        ? `${m.nachweis_pfad ? `<button type="button" class="btn-klein" data-mgfoto="${esc(m.nachweis_pfad)}">Foto</button>` : ""}${ADMIN ? `<button type="button" class="btn-klein" data-mgauf="${esc(m.id)}">öffnen</button>` : ""}`
        : `<button type="button" class="btn-klein mg-erl" data-mgerl="${esc(m.id)}">Erledigt</button>`}</div>
    </div>`;
  };
  const sec = document.createElement("section"); sec.className = "sektion mg-seite";
  sec.innerHTML = `${meld}
    <div class="mg-filter">
      <div class="uw-pills">
        <button type="button" class="uw-pill${MG_FILTER.status === "offen" ? " aktiv" : ""}" data-mgf="offen">Offen · ${offenAlle.length}</button>
        <button type="button" class="uw-pill${MG_FILTER.status === "erledigt" ? " aktiv" : ""}" data-mgf="erledigt">Erledigt · ${alle.length - offenAlle.length}</button>
      </div>
      <select class="uw-fassung" id="mgMaschine" aria-label="Maschine">
        <option value="">Alle Maschinen</option>
        ${maschinen.map(n => `<option${MG_FILTER.maschine === n ? " selected" : ""}>${esc(n)}</option>`).join("")}
        ${allgemein.length ? `<optgroup label="Allgemein">${allgemein.map(n => `<option${MG_FILTER.maschine === n ? " selected" : ""}>${esc(n)}</option>`).join("")}</optgroup>` : ""}
      </select>
    </div>
    ${gruppen.length ? gruppen.map((g, i) => `<details class="mg-gruppe"${(i === 0 || MG_FILTER.maschine || MG_FILTER.status === "erledigt") ? " open" : ""}>
        <summary><span>${esc(MG_THEMA[g.thema] || g.thema)}</span><b>${g.liste.length}</b></summary>
        <div class="mg-liste">${g.liste.map(zeile).join("")}</div></details>`).join("")
      : `<div class="ck-fuss">${alle.length ? "Nichts in dieser Auswahl." : "Noch keine Mängel übertragen."}</div>`}`;
  wrap.appendChild(sec);
  sec.querySelectorAll("[data-mgf]").forEach(b => b.addEventListener("click", () => { MG_FILTER.status = b.dataset.mgf; renderSektionen(); }));
  sec.querySelector("#mgMaschine").addEventListener("change", e => { MG_FILTER.maschine = e.target.value; renderSektionen(); });
  sec.querySelectorAll("[data-mgerl]").forEach(b => b.addEventListener("click", () => mgDialog(b.dataset.mgerl)));
  sec.querySelectorAll("[data-mgauf]").forEach(b => b.addEventListener("click", () => mgWiederAuf(b.dataset.mgauf)));
  sec.querySelectorAll("[data-mgfoto]").forEach(b => b.addEventListener("click", async () => {
    const u = (typeof anfrSigned === "function") ? await anfrSigned(b.dataset.mgfoto) : null;
    if(u) window.open(u, "_blank", "noopener"); else alert("Foto konnte nicht geöffnet werden.");
  }));
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
    const notiz = dlg.querySelector("#mgNotiz").value.trim(), datei = foto.files[0];
    msg.className = "pw-msg";
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
      const s = getSession(); const name = window.__oakName || (s && s.user && s.user.email) || "";
      const jetzt = new Date().toISOString();
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

/* OAK Kundenportal — „Dokument hochladen": der Betrieb legt eigene Unterlagen ins Portal
   (Prüfprotokolle, Lieferantendokumente, Fotos). Datei landet im Bucket unter <slug>/vom-betrieb/,
   die Zeile in portal_dokumente mit kategorie 'vom-betrieb' (RLS: nur eigener Betrieb). */
"use strict";

let UPL_MELDUNG = "";

function uplTyp(name){
  const e = (name.split(".").pop() || "").toLowerCase();
  if(e === "pdf") return "pdf";
  if(["jpg", "jpeg", "png", "webp", "gif"].indexOf(e) >= 0) return "bild";
  if(["html", "htm"].indexOf(e) >= 0) return "html";
  return "datei";
}

function renderUpload(wrap){
  const sec = document.createElement("section"); sec.className = "sektion";
  const meld = UPL_MELDUNG ? `<div class="uw-meld">${esc(UPL_MELDUNG)}</div>` : ""; UPL_MELDUNG = "";
  const liste = (typeof anlagen === "function" ? anlagen() : [])
    .map(r => ({ id: r.maschinen_id, name: r.maschine || r.titel })).filter(x => x.id);
  const eigene = (typeof sichtbar === "function" ? sichtbar() : []).filter(r => r.kategorie === "vom-betrieb");
  sec.innerHTML = `${meld}
    <div class="sek-kopf"><h2>Dokument hochladen</h2><span class="zaehler">${eigene.length} vom Betrieb</span></div>
    <p class="uw-erkl">Prüfprotokolle, Lieferantenunterlagen, Fotos – alles, was OAK engineering und die Kollegen im Portal
      sehen sollen. Erscheint sofort unter <b>Unterlagen → Vom Betrieb</b>.</p>
    <div class="uw-form">
      <label class="uw-lab" for="uplDatei">Datei (PDF, Foto, Word, Excel)</label>
      <input type="file" id="uplDatei" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.html" style="font-size:15px">
      <label class="uw-lab" for="uplTitel">Titel</label>
      <input type="text" id="uplTitel" placeholder="z. B. Prüfprotokoll Hallenkran 2026" autocomplete="off">
      ${liste.length ? `<label class="uw-lab" for="uplMaschine">Maschine (optional)</label>
        <select id="uplMaschine" class="uw-fassung" style="max-width:420px;width:100%"><option value="">– keine bestimmte Maschine –</option>
        ${liste.map(m => `<option value="${esc(m.id)}">${esc(m.id)} · ${esc(m.name || "")}</option>`).join("")}</select>` : ""}
      <div class="uw-form-knoepfe"><button class="btn sek" id="uplGo">Hochladen</button><span class="uw-leise" id="uplMeld"></span></div>
    </div>
    ${eigene.length ? `<h3 class="uw-h3">Bisher vom Betrieb hochgeladen</h3>
      <table><thead><tr><th>Dokument</th><th style="width:130px">Art</th><th style="width:120px">Stand</th><th style="width:120px"></th></tr></thead>
      <tbody>${eigene.map(docZeile).join("")}</tbody></table>` : ""}`;
  wrap.appendChild(sec);
  sec.querySelector("#uplGo").addEventListener("click", () => uplHochladen(sec));
  const df = sec.querySelector("#uplDatei"), ti = sec.querySelector("#uplTitel");
  df.addEventListener("change", () => { if(!ti.value && df.files[0]) ti.value = df.files[0].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "); });
}

async function uplHochladen(sec){
  const meld = sec.querySelector("#uplMeld");
  const datei = sec.querySelector("#uplDatei").files[0];
  const titel = sec.querySelector("#uplTitel").value.trim();
  const ms = sec.querySelector("#uplMaschine"); const mid = ms ? ms.value : "";
  if(!datei){ meld.textContent = "Bitte eine Datei wählen."; return; }
  if(datei.size > 25 * 1024 * 1024){ meld.textContent = "Die Datei ist größer als 25 MB."; return; }
  if(titel.length < 3){ meld.textContent = "Bitte einen Titel eintragen."; return; }
  meld.textContent = "Lädt hoch …";
  try{
    const rein = datei.name.replace(/[^A-Za-z0-9._-]+/g, "-");
    const pfad = AKTIV + "/vom-betrieb/" + Date.now() + "-" + rein;
    const t = await token();
    const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST",
      headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "x-upsert": "true" }, body: datei });
    if(!r.ok) throw new Error("Datei konnte nicht hochgeladen werden (" + r.status + ")");
    const kunde = (ALLE.find(x => x.kunde_slug === AKTIV) || {}).kunde || AKTIV;
    const masch = mid ? ((typeof anlagen === "function" ? anlagen() : []).find(x => x.maschinen_id === mid) || {}) : {};
    const zeile = { kunde_slug: AKTIV, kunde, kategorie: "vom-betrieb", titel, doc_typ: uplTyp(datei.name), storage_path: pfad,
                    stand: new Date().toISOString().slice(0, 10), maschinen_id: mid || null, maschine: masch.maschine || null, sortierung: 0 };
    const neu = await apiSend("POST", "/rest/v1/portal_dokumente", zeile, "return=representation");
    const row = Array.isArray(neu) ? neu[0] : neu;
    if(row) ALLE.push(row); else ALLE.push(zeile);
    UPL_MELDUNG = "„" + titel + "“ ist hochgeladen und unter Unterlagen → Vom Betrieb zu finden.";
    if(window.portalGehe) portalGehe("mehr", "upload");
  }catch(e){ meld.textContent = "Konnte nicht hochgeladen werden: " + (e.message || e); }
}

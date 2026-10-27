/* OAK Arbeitsschutz-App – ASA-Sitzungsmappe (P04): je Sitzung eine leere Vorlage, in die Folien (PDF/Bilder)
   und Unterlagen geladen werden. Präsentieren ohne Scrollen, Notizen direkt auf der Folie, Unterlagen auf jeder Folie,
   Beschlüsse mit Wer/Bis → beim Abschließen Maßnahmen (as_massnahme) und Termine im Kalender (portal_termin).
   Daten: as_asa.mappe (jsonb), Dateien im Storage <slug>/organisation/asa/<asa-id>/. Globale Namen: asMp/AS_MP. */
"use strict";

const AS_MP = { a: null, m: null, screens: [], akt: 0, werkzeug: null, verlauf: [], pdf: {}, bild: {}, timer: null, render: 0 };
const AS_MP_FARBE = { stift: { c: "#D0021B", w: 0.0025, a: 1 }, marker: { c: "#FFD400", w: 0.014, a: 0.4 } };
const AS_MP_ICON = {
  akte: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  folie: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  voll: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zu: '<path d="M6 6l12 12M18 6L6 18"/>',
  links: '<path d="M15 5l-7 7 7 7"/>', rechts: '<path d="M9 5l7 7-7 7"/>',
  stift: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>', marker: '<path d="M9 15l-3 5h6l1-2M9 15l6-11 4 2-6 11z"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', radierer: '<path d="M16 3l5 5-11 11H5l-2-2z"/><path d="M10 19h11"/>',
  undo: '<path d="M9 7H4V2"/><path d="M4 7a9 9 0 1 1-1 7"/>', datei: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'
};
function asMpI(n, g){ return `<svg viewBox="0 0 24 24" width="${g || 18}" height="${g || 18}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${AS_MP_ICON[n]}</svg>`; }
/* Protokollfelder (für „Protokoll drucken“): zeit, ort, vorsitz, protokollfuehrer, offen (je Zeile ein Punkt), naechste (Datum), naechste_text,
   naechste_termin_id; je Beschluss zusätzlich prio (1–3) und nach dem Abschluss massnahme_id bzw. ziel_id (Verweis Sitzung → Maßnahme/Ziel). */
function asMpLeer(){ return { folien: [], unterlagen: [], anno: {}, teilnehmende: [], beschluesse: [], log: [],
  zeit: "", ort: "", vorsitz: "", protokollfuehrer: "", offen: "", naechste: "", naechste_text: "" }; }
function asMpJetzt(){ const d = new Date(); return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }

/* ---------- Anlegen, Öffnen, Speichern ---------- */
async function asMpNeu(){
  const m = asMpLeer();
  m.teilnehmende = [["", "Geschäftsführung"], ["", "Fachkraft für Arbeitssicherheit"], ["", "Betriebsarzt"], ["", "Sicherheitsbeauftragte"], ["", "Betriebsrat"], ["", ""]]
    .map(([name, funktion]) => ({ name, funktion, anwesend: false }));
  m.beschluesse = [1, 2, 3].map(() => ({ text: "", prio: "", wer: "", bis: "", ok: false }));
  const r = await asSpeichern("as_asa", { datum: asHeute(), tagesordnung: asAsaTagesordnung(), mappe: m });
  if(r) asMpOeffnen(r.id); else asMeldung("Sitzung konnte nicht angelegt werden");
}
async function asMpOeffnen(id){
  const a = asNach("as_asa", id); if(!a) return;
  AS_MP.a = a; AS_MP.m = Object.assign(asMpLeer(), a.mappe || {}); AS_MP.akt = 0; AS_MP.werkzeug = null; AS_MP.verlauf = [];
  if(!AS_MP.m.teilnehmende.length && a.teilnehmer) AS_MP.m.teilnehmende = String(a.teilnehmer).split(/[,;\n]/).map(s => s.trim()).filter(Boolean).map(name => ({ name, funktion: "", anwesend: true }));
  if(!AS_MP.m.beschluesse.length) AS_MP.m.beschluesse = [{ text: "", prio: "", wer: "", bis: "", ok: false }];
  document.getElementById("asaMappe")?.remove();
  const el = document.createElement("div"); el.id = "asaMappe"; el.className = "mp";
  document.body.appendChild(el); document.body.classList.add("mp-offen"); document.documentElement.classList.add("mp-offen");
  el.innerHTML = `<div class="mp-leiste"><b class="mp-titel">ASA ${asDat(a.datum)}</b><nav class="mp-nav" id="mpNav"></nav>
    <span class="mp-status" id="mpStatus"></span>
    <button class="mp-knopf" id="mpUnterlagen" title="Unterlagen zur Sitzung">${asMpI("akte")}<span>Unterlagen</span></button>
    <button class="mp-knopf" id="mpFolienNeu" title="Folien hochladen (PDF oder Bilder)">${asMpI("folie")}<span>Folien</span></button>
    <button class="mp-knopf" id="mpLogKnopf" title="Vermerkte Änderungen">${asMpI("uhr")}<span>Änderungen <b id="mpLogAnz">0</b></span></button>
    <button class="mp-knopf" id="mpVoll" title="Vollbild (Taste F)">${asMpI("voll")}<span>Vollbild</span></button>
    <button class="mp-knopf dunkel" id="mpZu" title="Schließen">${asMpI("zu")}<span>Schließen</span></button></div>
    <div class="mp-panel" id="mpPanelU" hidden></div><div class="mp-panel breit" id="mpPanelL" hidden></div>
    <input type="file" id="mpDateiF" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple hidden>
    <input type="file" id="mpDateiU" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" multiple hidden>
    <main class="mp-main" id="mpMain"></main>
    <footer class="mp-fuss"><button id="mpZurueck" title="Zurück (Pfeil links)">${asMpI("links", 20)}</button><span id="mpZaehler"></span><button id="mpWeiter" title="Weiter (Pfeil rechts)">${asMpI("rechts", 20)}</button></footer>`;
  const $ = s => el.querySelector(s);
  $("#mpZu").onclick = asMpSchliessen;
  $("#mpVoll").onclick = asMpVollbild;
  $("#mpZurueck").onclick = () => asMpZeige(AS_MP.akt - 1);
  $("#mpWeiter").onclick = () => asMpZeige(AS_MP.akt + 1);
  $("#mpFolienNeu").onclick = () => $("#mpDateiF").click();
  $("#mpDateiF").onchange = e => asMpHochladen([...e.target.files], "folien");
  $("#mpDateiU").onchange = e => asMpHochladen([...e.target.files], "unterlagen");
  [["mpUnterlagen", "mpPanelU", asMpPanelU], ["mpLogKnopf", "mpPanelL", asMpPanelL]].forEach(([b, p, fn]) => $("#" + b).onclick = ev => {
    ev.stopPropagation(); const pn = $("#" + p), auf = pn.hidden; asMpPanelsZu(); if(auf){ fn(pn); pn.hidden = false; $("#" + b).classList.add("an"); } });
  el.addEventListener("click", ev => { if(!ev.target.closest(".mp-panel")) asMpPanelsZu(); });
  document.addEventListener("keydown", asMpTaste);
  window.addEventListener("resize", asMpPassen);
  document.addEventListener("fullscreenchange", asMpFsWechsel);
  asMpLogAnz();
  await asMpFolienLaden();
  asMpZeige(0);
}
function asMpFsWechsel(){ setTimeout(asMpPassen, 60); }
function asMpPanelsZu(){ const el = document.getElementById("asaMappe"); if(!el) return;
  el.querySelectorAll(".mp-panel").forEach(p => p.hidden = true); el.querySelectorAll(".mp-leiste .an").forEach(b => b.classList.remove("an")); }
async function asMpSchliessen(){
  await asMpSpeichernJetzt();
  if(document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  document.removeEventListener("keydown", asMpTaste); window.removeEventListener("resize", asMpPassen);
  document.removeEventListener("fullscreenchange", asMpFsWechsel);
  document.getElementById("asaMappe")?.remove(); document.body.classList.remove("mp-offen"); document.documentElement.classList.remove("mp-offen");
  AS_MP.a = null; asZeige();
}
function asMpSpeichern(){
  clearTimeout(AS_MP.timer);
  const st = document.getElementById("mpStatus"); if(st) st.textContent = "wird gespeichert …";
  AS_MP.timer = setTimeout(asMpSpeichernJetzt, 1500);
}
async function asMpSpeichernJetzt(){
  clearTimeout(AS_MP.timer); AS_MP.timer = null;
  const a = AS_MP.a, m = AS_MP.m; if(!a) return;
  const anw = m.teilnehmende.filter(t => t.anwesend && t.name).map(t => t.name + (t.funktion ? " (" + t.funktion + ")" : ""));
  try{
    const r = await asSpeichern("as_asa", { id: a.id, mappe: m, datum: a.datum, tagesordnung: a.tagesordnung || null, protokoll: a.protokoll || null,
      teilnehmer: anw.length ? anw.join(", ") : (a.teilnehmer || null) });
    if(r) AS_MP.a = Object.assign(a, r);
    const st = document.getElementById("mpStatus"); if(st) st.textContent = "gespeichert " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }catch(e){
    const st = document.getElementById("mpStatus"); if(st) st.textContent = "nicht gespeichert";
    if(window.OAK_FEHLER) window.OAK_FEHLER("asa-mappe", "Speichern fehlgeschlagen: " + (e.message || e), { asa: a.id, mappe: m });
    asMeldung("Speichern fehlgeschlagen – bitte erneut versuchen");
  }
}
function asMpVermerk(feld, alt, neu){
  if(String(alt == null ? "" : alt) === String(neu == null ? "" : neu)) return;
  const z = v => v === true ? "ja" : v === false ? "nein" : (v == null || v === "" ? "–" : String(v));
  AS_MP.m.log.push({ t: asMpJetzt(), wer: AS.ich || "", f: feld, a: z(alt), n: z(neu) });
  asMpLogAnz(); asMpSpeichern();
}
function asMpLogAnz(){ const e = document.getElementById("mpLogAnz"); if(e) e.textContent = AS_MP.m.log.length; }

/* ---------- Dateien ---------- */
async function asMpHochladen(dateien, art){
  const m = AS_MP.m, ok = art === "folien" ? /\.(pdf|jpe?g|png|webp)$/i : /\.(pdf|jpe?g|png|webp|docx?|xlsx?)$/i;
  for(const d of dateien){
    if(/\.pptx?$/i.test(d.name)){ asMeldung("PowerPoint bitte als PDF speichern (Datei → Speichern unter → PDF) und dann hochladen."); continue; }
    if(!ok.test(d.name)){ asMeldung(d.name + ": Dateityp nicht erlaubt"); continue; }
    if(d.size > 40 * 1024 * 1024){ asMeldung(d.name + ": größer als 40 MB"); continue; }
    const name = d.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-");
    const pfad = AS.kunde + "/organisation/asa/" + AS_MP.a.id + "/" + Date.now() + "-" + name;
    asMeldung(d.name + " wird hochgeladen …");
    try{
      const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad.split("/").map(encodeURIComponent).join("/"), { method: "POST",
        headers: { apikey: CFG.anon, Authorization: "Bearer " + (await token()), "Content-Type": d.type || "application/octet-stream", "x-upsert": "false" }, body: d });
      if(!r.ok) throw new Error("Status " + r.status);
      m[art].push({ pfad, name: d.name, typ: (d.name.split(".").pop() || "").toLowerCase() });
      asMpVermerk(art === "folien" ? "Folien hochgeladen" : "Unterlage hochgeladen", "", d.name);
    }catch(e){ asMeldung(d.name + ": Hochladen fehlgeschlagen (" + (e.message || e) + ")"); }
  }
  await asMpSpeichernJetzt();
  if(art === "folien"){ await asMpFolienLaden(); asMpZeige(AS_MP.akt); }
  else { const p = document.getElementById("mpPanelU"); if(p && !p.hidden) asMpPanelU(p); asMpZeige(AS_MP.akt); }
  asMeldung("Hochgeladen");
}
async function asMpUrl(pfad){
  try{ const r = await apiSend("POST", "/storage/v1/object/sign/" + CFG.bucket + "/" + pfad, { expiresIn: 3600 });
    return r && r.signedURL ? CFG.url + "/storage/v1" + r.signedURL : null; }catch(e){ return null; }
}
async function asMpDateiOeffnen(pfad){
  const w = window.open("", "_blank"); const u = await asMpUrl(pfad);
  if(!u){ if(w) w.close(); asMeldung("Datei nicht erreichbar"); return; }
  if(w) w.location = u; else location.href = u;
}
function asMpPanelU(p){
  const m = AS_MP.m, darf = AS.fachkraft || AS.gf;
  const zeile = (d, art, i) => `<div class="mp-doc"><a href="#" data-p="${esc(d.pfad)}">${asMpI("datei", 16)}<span title="${esc(d.name)}">${esc(d.name)}</span></a>${darf ? `<button class="mp-x" data-weg="${art}:${i}" title="Aus der Mappe entfernen">${asMpI("zu", 14)}</button>` : ""}</div>`;
  p.innerHTML = `<h4>Unterlagen zur Sitzung</h4><div class="mp-docs">${m.unterlagen.map((d, i) => zeile(d, "unterlagen", i)).join("") || `<div class="mp-leer">Noch keine Unterlagen.</div>`}</div>
    <button class="btn klein" id="mpUNeu">${asMpI("plus", 16)} Unterlagen hochladen</button>
    <h4 class="mt">Folien</h4><div class="mp-docs">${m.folien.map((d, i) => zeile(d, "folien", i)).join("") || `<div class="mp-leer">Noch keine Folien.</div>`}</div>
    <p class="mp-hinweis">Folien als PDF oder Bilder. PowerPoint vorher als PDF speichern. Unterlagen: PDF, Bilder, Word, Excel.</p>`;
  p.querySelector("#mpUNeu").onclick = () => document.getElementById("mpDateiU").click();
  p.querySelectorAll("a[data-p]").forEach(x => x.onclick = ev => { ev.preventDefault(); asMpDateiOeffnen(x.dataset.p); });
  p.querySelectorAll("[data-weg]").forEach(x => x.onclick = async ev => { ev.stopPropagation();
    const [art, i] = x.dataset.weg.split(":"), d = m[art][+i]; if(!d || !confirm(d.name + " aus der Mappe entfernen?")) return;
    m[art].splice(+i, 1); asMpVermerk(art === "folien" ? "Folien entfernt" : "Unterlage entfernt", d.name, "");
    await asMpSpeichernJetzt(); if(art === "folien"){ await asMpFolienLaden(); asMpZeige(Math.min(AS_MP.akt, AS_MP.screens.length - 1)); } asMpPanelU(p); });
}
function asMpPanelL(p){
  const l = AS_MP.m.log.slice().reverse();
  p.innerHTML = `<h4>Vermerkte Änderungen</h4><div class="mp-logwrap"><table class="mp-tab mp-log"><thead><tr><th>Zeit</th><th>Wer</th><th>Feld</th><th>vorher</th><th>nachher</th></tr></thead><tbody>${
    l.map(x => `<tr><td>${esc(x.t)}</td><td title="${esc(x.wer)}">${esc(x.wer)}</td><td title="${esc(x.f)}">${esc(x.f)}</td><td title="${esc(x.a)}">${esc(x.a)}</td><td title="${esc(x.n)}">${esc(x.n)}</td></tr>`).join("")
    || `<tr><td colspan="5">Noch keine Änderungen.</td></tr>`}</tbody></table></div>`;
}

/* ---------- Folien laden (PDF-Seiten oder Bilder) ---------- */
async function asMpFolienLaden(){
  const folien = [];
  for(const d of AS_MP.m.folien){
    if(d.typ === "pdf"){
      if(!AS_MP.pdf[d.pfad]){
        if(!(await asSdbPdfJs())){ asMeldung("PDF-Anzeige nicht verfügbar"); continue; }
        try{ const u = await asMpUrl(d.pfad), buf = await (await fetch(u)).arrayBuffer();
          AS_MP.pdf[d.pfad] = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise; }
        catch(e){ asMeldung(d.name + " konnte nicht geladen werden"); continue; }
      }
      for(let s = 1; s <= AS_MP.pdf[d.pfad].numPages; s++) folien.push({ key: d.pfad + "#" + s, pfad: d.pfad, seite: s, name: d.name });
    } else {
      if(!AS_MP.bild[d.pfad]){
        try{ const u = await asMpUrl(d.pfad), b = await (await fetch(u)).blob(); AS_MP.bild[d.pfad] = await createImageBitmap(b); }
        catch(e){ continue; }
      }
      folien.push({ key: d.pfad, pfad: d.pfad, bild: true, name: d.name });
    }
  }
  AS_MP.screens = [{ art: "start", kurz: "Start", titel: "Sitzung und Teilnehmende" }]
    .concat(folien.length ? folien.map((f, i) => Object.assign({ art: "folie", kurz: String(i + 1), titel: "Folie " + (i + 1) }, f)) : [{ art: "keine", kurz: "Folien", titel: "Folien" }])
    .concat([{ art: "beschluesse", kurz: "Beschlüsse", titel: "Beschlüsse und Protokoll" }]);
}

/* ---------- Bildschirme ---------- */
function asMpZeige(i){
  const S = AS_MP.screens; AS_MP.akt = Math.max(0, Math.min(S.length - 1, i)); const s = S[AS_MP.akt];
  const nav = document.getElementById("mpNav"); if(!nav) return;
  nav.innerHTML = S.map((x, k) => `<a href="#" data-i="${k}" class="${k === AS_MP.akt ? "an" : ""}" title="${esc(x.titel)}">${esc(x.kurz)}</a>`).join("");
  nav.querySelectorAll("a").forEach(a => a.onclick = ev => { ev.preventDefault(); asMpZeige(+a.dataset.i); });
  nav.querySelector("a.an")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  document.getElementById("mpZurueck").disabled = AS_MP.akt === 0;
  document.getElementById("mpWeiter").disabled = AS_MP.akt === S.length - 1;
  document.getElementById("mpZaehler").textContent = s.titel.replace(/ und .*/, "") + " · " + (AS_MP.akt + 1) + " von " + S.length;
  asMpPanelsZu();
  const main = document.getElementById("mpMain");
  ({ start: asMpStart, folie: asMpFolie, keine: asMpKeine, beschluesse: asMpBeschluesse })[s.art](main, s);
}
function asMpKopf(nr, titel, rechts){ return `<header class="mp-kopf"><span class="mp-nr">${esc(nr)}</span><h2 title="${esc(titel)}">${esc(titel)}</h2>${rechts || ""}</header>`; }
function asMpStart(main){
  const a = AS_MP.a, m = AS_MP.m;
  main.innerHTML = `<section class="mp-screen">${asMpKopf("Start", "Sitzung und Teilnehmende", a.abgeschlossen ? asChip("abgeschlossen", "gruen") : asChip("geplant", "grau"))}
    <div class="mp-start"><div class="mp-spalte"><div class="mp-felder drei"><label>Datum<input type="date" id="mpDatum" value="${esc(a.datum || "")}"></label>
        <label>Uhrzeit<input type="text" data-m="zeit" value="${esc(m.zeit || "")}" placeholder="08:00–09:30"></label>
        <label class="ort">Ort<input type="text" data-m="ort" value="${esc(m.ort || "")}" placeholder="${esc((AS.kundeV1 && AS.kundeV1.name) || "Ort")}"></label></div>
      <div class="mp-block grow"><h4>Teilnehmende</h4><div class="mp-tabwrap"><table class="mp-tab"><colgroup><col style="width:42%"><col style="width:42%"><col style="width:16%"></colgroup>
        <tr><th>Name</th><th>Funktion</th><th class="mitte">anwesend</th></tr>
        ${m.teilnehmende.map((t, i) => `<tr><td><input type="text" data-t="${i}" data-k="name" value="${esc(t.name)}" placeholder="Name"></td><td><input type="text" data-t="${i}" data-k="funktion" value="${esc(t.funktion)}" placeholder="Funktion"></td><td class="mitte"><input type="checkbox" data-t="${i}" data-k="anwesend" ${t.anwesend ? "checked" : ""}></td></tr>`).join("")}
      </table></div><button class="btn sek klein" id="mpTnNeu">${asMpI("plus", 16)} Person</button></div></div>
      <div class="mp-spalte"><div class="mp-felder zwei"><label>Vorsitz<input type="text" data-m="vorsitz" value="${esc(m.vorsitz || "")}" placeholder="Name"></label>
        <label>Protokoll<input type="text" data-m="protokollfuehrer" value="${esc(m.protokollfuehrer || "")}" placeholder="Name"></label></div>
      <label class="grow">Tagesordnung <textarea id="mpTo">${esc(a.tagesordnung || "")}</textarea></label>
      <div class="mp-zeile"><button class="btn sek klein" id="mpToVorschlag">aus aktuellem Stand vorschlagen</button>${AS.admin ? `<button class="btn gefahr klein" id="mpLoeschen">Sitzung löschen</button>` : ""}</div></div></div></section>`;
  main.querySelector("#mpDatum").onchange = e => { asMpVermerk("Datum", a.datum, e.target.value); a.datum = e.target.value; document.querySelector(".mp-titel").textContent = "ASA " + asDat(a.datum); };
  main.querySelectorAll("[data-t]").forEach(f => f.onchange = () => { const t = m.teilnehmende[+f.dataset.t], k = f.dataset.k, v = f.type === "checkbox" ? f.checked : f.value.trim();
    asMpVermerk("Teilnehmende " + (+f.dataset.t + 1) + " · " + k, t[k], v); t[k] = v; });
  asMpFelderBinden(main);
  main.querySelector("#mpTnNeu").onclick = () => { m.teilnehmende.push({ name: "", funktion: "", anwesend: false }); asMpSpeichern(); asMpStart(main); };
  const to = main.querySelector("#mpTo"); to.onchange = () => { asMpVermerk("Tagesordnung", a.tagesordnung, to.value); a.tagesordnung = to.value; };
  main.querySelector("#mpToVorschlag").onclick = () => { to.value = asAsaTagesordnung(); to.onchange(); };
  const lo = main.querySelector("#mpLoeschen"); if(lo) lo.onclick = async () => { if(!confirm("Sitzung mit Mappe löschen?")) return;
    await asLoeschen("as_asa", a.id); AS_MP.a = null; document.getElementById("asaMappe")?.remove(); document.body.classList.remove("mp-offen"); document.documentElement.classList.remove("mp-offen");
    document.removeEventListener("keydown", asMpTaste); asZeige(); };
}
function asMpKeine(main){
  main.innerHTML = `<section class="mp-screen">${asMpKopf("Folien", "Noch keine Folien")}
    <div class="mp-ablage" id="mpAblage">${asMpI("folie", 40)}<b>Folien hochladen</b><span>PDF oder Bilder hierher ziehen oder klicken. PowerPoint vorher als PDF speichern (Datei → Speichern unter → PDF).</span></div></section>`;
  const z = main.querySelector("#mpAblage");
  z.onclick = () => document.getElementById("mpDateiF").click();
  z.ondragover = e => { e.preventDefault(); z.classList.add("an"); }; z.ondragleave = () => z.classList.remove("an");
  z.ondrop = e => { e.preventDefault(); z.classList.remove("an"); asMpHochladen([...e.dataTransfer.files], "folien"); };
}
function asMpFolie(main, s){
  const n = AS_MP.akt;
  const wz = `<div class="mp-werkzeug">${["stift", "marker", "text", "radierer"].map(w => `<button data-w="${w}" class="${AS_MP.werkzeug === w ? "an" : ""}" title="${{ stift: "Stift (rot)", marker: "Marker (gelb)", text: "Textnotiz: auf die Folie klicken", radierer: "Radierer: Strich oder Notiz antippen" }[w]}">${asMpI(w)}</button>`).join("")}<button data-a="undo" title="Rückgängig">${asMpI("undo")}</button></div>`;
  const docs = AS_MP.m.unterlagen.map(d => `<a class="mp-chip" href="#" data-p="${esc(d.pfad)}" title="${esc(d.name)}">${asMpI("datei", 15)}<span>${esc(d.name)}</span></a>`).join("");
  main.innerHTML = `<section class="mp-screen">${asMpKopf("Folie " + n, s.name + (s.seite ? " · Seite " + s.seite : ""), wz + `<div class="mp-chips">${docs}</div>`)}
    <div class="mp-buehne"><div class="mp-rahmen" data-key="${esc(s.key)}"><canvas class="mp-bild"></canvas><canvas class="mp-zeichnen"></canvas><div class="mp-textebene"></div></div></div></section>`;
  main.querySelectorAll(".mp-chip").forEach(x => x.onclick = ev => { ev.preventDefault(); asMpDateiOeffnen(x.dataset.p); });
  main.querySelectorAll(".mp-werkzeug [data-w]").forEach(b => b.onclick = () => asMpWerkzeug(b.dataset.w));
  main.querySelector('.mp-werkzeug [data-a="undo"]').onclick = asMpUndo;
  asMpZeichenEreignisse(main.querySelector(".mp-rahmen"), s.key);
  asMpWerkzeug(AS_MP.werkzeug, true);
  requestAnimationFrame(asMpPassen);
}
const AS_MP_FELD = { zeit: "Uhrzeit", ort: "Ort", vorsitz: "Vorsitz", protokollfuehrer: "Protokoll", offen: "Offene Punkte", naechste_text: "Nächste Sitzung · Hinweis" };
function asMpFelderBinden(main){
  main.querySelectorAll("[data-m]").forEach(f => f.onchange = () => { const k = f.dataset.m, v = f.value.trim();
    asMpVermerk(AS_MP_FELD[k] || k, AS_MP.m[k], v); AS_MP.m[k] = v; });
}
function asMpBeschluesse(main){
  const a = AS_MP.a, m = AS_MP.m;
  const offenNeu = m.beschluesse.filter(b => b.ok && b.text && !asMpVerknuepft(b)).length;
  const rechts = `<span class="mp-rechts">${a.abgeschlossen ? asChip("abgeschlossen", "gruen") : ""}<button class="btn sek klein" id="mpDruck" title="Protokoll als A4-Seite drucken oder als PDF speichern">Protokoll drucken</button></span>`;
  const letzte = (b, i) => { const v = asMpVerknuepft(b);
    return v ? `<button class="mp-mn" data-v="${i}" title="${v.art === "ziel" ? "Ziel öffnen" : "Maßnahme öffnen"}">${v.art === "ziel" ? "Ziel" : "Maßnahme"}</button>`
      : `<input type="checkbox" data-b="${i}" data-k="ok" ${b.ok ? "checked" : ""} title="beschlossen">`; };
  main.innerHTML = `<section class="mp-screen">${asMpKopf("Ergebnis", "Beschlüsse und Protokoll", rechts)}
    <div class="mp-besch"><div class="mp-tabwrap"><table class="mp-tab mp-beschl"><colgroup><col style="width:4%"><col style="width:44%"><col style="width:8%"><col style="width:17%"><col style="width:15%"><col style="width:12%"></colgroup>
      <tr><th class="mitte">Nr.</th><th>Beschluss / Maßnahme</th><th class="mitte" title="Priorität: 1 = sofort beginnen · 2 = danach · 3 = laufend">Prio</th><th>Wer</th><th>Bis wann</th><th class="mitte">beschlossen</th></tr>
      ${m.beschluesse.map((b, i) => `<tr><td class="mitte">${i + 1}</td><td><textarea data-b="${i}" data-k="text" placeholder="Beschluss (mit „Ziel:“ davor wird es ein Ziel)">${esc(b.text)}</textarea></td>
        <td><select data-b="${i}" data-k="prio" title="1 = sofort beginnen · 2 = danach · 3 = laufend">${["", "1", "2", "3"].map(p => `<option value="${p}" ${String(b.prio || "") === p ? "selected" : ""}>${p || "–"}</option>`).join("")}</select></td>
        <td><textarea data-b="${i}" data-k="wer" placeholder="Name">${esc(b.wer)}</textarea></td><td><textarea data-b="${i}" data-k="bis" placeholder="TT.MM.JJJJ oder MM/JJJJ">${esc(b.bis)}</textarea></td>
        <td class="mitte">${letzte(b, i)}</td></tr>`).join("")}</table></div>
      <div class="mp-zeile"><button class="btn sek klein" id="mpBNeu">${asMpI("plus", 16)} Beschluss</button><span class="mp-hinweis">Beschlossene Punkte stehen im Protokoll unter „Maßnahmen“ und werden beim Abschließen Maßnahmen; mit Datum zusätzlich ein Termin im Kalender.</span></div>
      <div class="mp-felder zwei"><label>Beschlüsse und Notizen (je Zeile ein Punkt)<textarea id="mpProt">${esc(a.protokoll || "")}</textarea></label>
        <label>Offene Punkte (je Zeile einer)<textarea data-m="offen">${esc(m.offen || "")}</textarea></label></div>
      <div class="mp-zeile ende"><div class="mp-naechste-wrap"><label class="mp-naechste">Nächste Sitzung<input type="date" id="mpNaechste" value="${esc(m.naechste || "")}"></label>
        <input type="text" data-m="naechste_text" value="${esc(m.naechste_text || "")}" placeholder="oder z. B. KW 49, Termin folgt"></div>
        ${!a.abgeschlossen ? `<button class="btn" id="mpAbschluss">Sitzung abschließen</button>`
          : offenNeu ? `<button class="btn" id="mpAbschluss">${offenNeu} neue Beschlüsse übernehmen</button>` : `<span class="mp-hinweis">Abgeschlossen – Maßnahmen und Termine sind angelegt.</span>`}</div></div></section>`;
  main.querySelectorAll("[data-b]").forEach(f => f.onchange = () => { const b = m.beschluesse[+f.dataset.b], k = f.dataset.k, v = f.type === "checkbox" ? f.checked : f.value.trim();
    asMpVermerk("Beschluss " + (+f.dataset.b + 1) + " · " + ({ text: "Maßnahme", prio: "Prio", wer: "Wer", bis: "Bis", ok: "beschlossen" })[k], b[k], v); b[k] = v;
    if(k === "ok" && a.abgeschlossen) asMpBeschluesse(main); });
  main.querySelectorAll("[data-v]").forEach(x => x.onclick = () => { const v = asMpVerknuepft(m.beschluesse[+x.dataset.v]); if(!v) return;
    if(v.art === "massnahme") asMassnahmeDialog(v.x); else { asMpSchliessen().then(() => asGehe("steuerung/ziele")); } });
  asMpFelderBinden(main);
  main.querySelector("#mpBNeu").onclick = () => { m.beschluesse.push({ text: "", prio: "", wer: "", bis: "", ok: false }); asMpSpeichern(); asMpBeschluesse(main); };
  const pr = main.querySelector("#mpProt"); pr.onchange = () => { asMpVermerk("Beschlüsse und Notizen", a.protokoll, pr.value); a.protokoll = pr.value; };
  const nx = main.querySelector("#mpNaechste"); nx.onchange = () => { asMpVermerk("Nächste Sitzung", m.naechste, nx.value); m.naechste = nx.value; };
  const ab = main.querySelector("#mpAbschluss"); if(ab) ab.onclick = asMpAbschliessen;
  main.querySelector("#mpDruck").onclick = asMpDrucken;
}
/* Verweis Beschluss → Maßnahme/Ziel; ältere abgeschlossene Sitzungen (ohne gespeicherte Kennung) über Quelle und Text */
function asMpVerknuepft(b){
  const a = AS_MP.a; if(!a || !b) return null;
  if(b.massnahme_id){ const x = asNach("as_massnahme", b.massnahme_id); if(x) return { art: "massnahme", x }; }
  if(b.ziel_id){ const x = asNach("as_ziel", b.ziel_id); if(x) return { art: "ziel", x }; }
  if(!a.abgeschlossen || !b.ok || !b.text || b.massnahme_id || b.ziel_id) return null;
  const z = /^\s*ziel\s*:\s*(.+)$/i.exec(b.text);
  if(z){ const x = asT("as_ziel").find(y => y.titel === z[1].trim() && y.quelle === "ASA " + asDat(a.datum)); return x ? { art: "ziel", x } : null; }
  const x = asT("as_massnahme").find(y => y.quelle === "asa" && y.quelle_id === a.id && y.text === b.text); return x ? { art: "massnahme", x } : null;
}
/* aus einer Maßnahme zurück in die Sitzung (Verweis Maßnahme → Sitzung, as-bda.js) */
async function asMpZurSitzung(id){
  document.getElementById("dlg")?.close();
  if(AS_MP.a && AS_MP.a.id === id){ asMpZeige(AS_MP.screens.length - 1); return; }
  if(AS_MP.a) await asMpSchliessen();
  asMpOeffnen(id);
}

/* ---------- Abschließen: Maßnahmen, Ziele, Termine ---------- */
function asMpDatum(t){
  t = String(t || "").trim(); let x;
  if((x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) return t;
  if((x = /(\d{1,2})\.(\d{1,2})\.(\d{2,4})/.exec(t))) return (x[3].length === 2 ? "20" + x[3] : x[3]) + "-" + x[2].padStart(2, "0") + "-" + x[1].padStart(2, "0");
  if((x = /\bQ([1-4])\s*\/\s*(\d{4})/i.exec(t))){ const mo = +x[1] * 3; return new Date(Date.UTC(+x[2], mo, 0)).toISOString().slice(0, 10); }
  if((x = /\b(\d{1,2})\s*\/\s*(\d{4})/.exec(t))) return new Date(Date.UTC(+x[2], +x[1], 0)).toISOString().slice(0, 10);
  return null;
}
async function asMpAbschliessen(){
  const a = AS_MP.a, m = AS_MP.m, nach = !!a.abgeschlossen, ok = m.beschluesse.filter(b => b.ok && b.text && !asMpVerknuepft(b));
  if(nach && !ok.length) return;
  if(!confirm((nach ? "Neue Beschlüsse übernehmen? " : "Sitzung abschließen? ") + ok.length + " beschlossene Punkte werden Maßnahmen bzw. Ziele, mit Datum zusätzlich Termine im Kalender.")) return;
  await asMpSpeichernJetzt();
  const datum = a.datum || asHeute(), plus28 = (() => { const x = new Date(datum); x.setDate(x.getDate() + 28); return x.toISOString().slice(0, 10); })();
  let nm = 0, nz = 0, nt = 0;
  try{
    for(const b of ok){
      const z = /^\s*ziel\s*:\s*(.+)$/i.exec(b.text), termin = asMpDatum(b.bis);
      if(z){ const r = await asSpeichern("as_ziel", { titel: z[1].trim(), kennzahl: null, quelle: "ASA " + asDat(datum), status: "entwurf", termin: termin || datum.slice(0, 4) + "-12-31" });
        if(r) b.ziel_id = r.id; nz++; continue; }
      const r = await asSpeichern("as_massnahme", { quelle: "asa", quelle_id: a.id, stop: "O", text: b.text, umsetzung: "zentral", status: "offen", termin: termin || plus28, verantwortlich: b.wer || null });
      if(r) b.massnahme_id = r.id; nm++;
      if(termin){ await apiSend("POST", "/rest/v1/portal_termin", { kunde_slug: AS.kunde, titel: ("ASA: " + b.text).slice(0, 200), art: "frist", faellig_am: termin,
        zustaendig: (b.wer || "").slice(0, 120) || null, grundlage: "ASA-Beschluss vom " + asDat(datum), erstellt_von: AS.ich || null }, "return=minimal"); nt++; }
    }
    if(m.naechste && !m.naechste_termin_id){ const r = await apiSend("POST", "/rest/v1/portal_termin", { kunde_slug: AS.kunde, titel: "Sitzung Arbeitsschutzausschuss (ASA)", art: "sonstiges", faellig_am: m.naechste,
      grundlage: "§ 11 ASiG", notiz: m.naechste_text || null, erstellt_von: AS.ich || null }, "return=representation");
      if(r && r[0]) m.naechste_termin_id = r[0].id; nt++; }
    asMpVermerk(nach ? "Beschlüsse übernommen" : "Sitzung abgeschlossen", "", nm + " Maßnahmen, " + nz + " Ziele, " + nt + " Termine");
    if(!nach){ a.abgeschlossen = true; await asSpeichern("as_asa", { id: a.id, abgeschlossen: true }); }
    await asMpSpeichernJetzt();
    asMeldung([nm ? nm + " Maßnahme(n)" : "", nz ? nz + " Ziel(e)" : "", nt ? nt + " Termin(e)" : ""].filter(Boolean).join(", ") + " angelegt" || "Sitzung abgeschlossen");
    asMpZeige(AS_MP.akt);
  }catch(e){
    if(window.OAK_FEHLER) window.OAK_FEHLER("asa-mappe", "Abschluss fehlgeschlagen: " + (e.message || e), { asa: a.id, beschluesse: ok });
    asMeldung("Abschließen fehlgeschlagen: " + (e.message || e));
  }
}

/* ---------- Präsentation: Größe, Folie zeichnen, Notizen ---------- */
function asMpTaste(e){
  if(!document.getElementById("asaMappe") || e.target.closest("input, textarea, [contenteditable=true]")) return;
  if(document.getElementById("dlg")?.open) return;
  if(e.key === "ArrowRight" || e.key === "PageDown"){ asMpZeige(AS_MP.akt + 1); e.preventDefault(); }
  if(e.key === "ArrowLeft" || e.key === "PageUp"){ asMpZeige(AS_MP.akt - 1); e.preventDefault(); }
  if(e.key === "f" || e.key === "F") asMpVollbild();
  if(e.key === "Escape"){ asMpPanelsZu(); if(AS_MP.werkzeug) asMpWerkzeug(AS_MP.werkzeug); }
}
function asMpVollbild(){ const el = document.getElementById("asaMappe"); if(document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen().catch(() => {}); }
function asMpSeitenmass(s){
  if(s.bild){ const b = AS_MP.bild[s.pfad]; return b ? b.width / b.height : 16 / 9; }
  return s._ar || 16 / 9;
}
async function asMpPassen(){
  const b = document.querySelector("#asaMappe .mp-buehne"); if(!b) return;
  const s = AS_MP.screens[AS_MP.akt]; if(!s || s.art !== "folie") return;
  if(!s.bild && !s._ar){ try{ const pg = await AS_MP.pdf[s.pfad].getPage(s.seite), v = pg.getViewport({ scale: 1 }); s._ar = v.width / v.height; }catch(e){} }
  const r = b.querySelector(".mp-rahmen"), W = b.clientWidth, H = b.clientHeight, ar = asMpSeitenmass(s); if(!W || !H) return;
  let w = W, h = W / ar; if(h > H){ h = H; w = H * ar; }
  w = Math.floor(w); h = Math.floor(h); r.style.width = w + "px"; r.style.height = h + "px";
  const dpr = window.devicePixelRatio || 1, bc = r.querySelector(".mp-bild"), zc = r.querySelector(".mp-zeichnen");
  zc.width = Math.floor(w * dpr); zc.height = Math.floor(h * dpr);
  const nr = ++AS_MP.render;
  if(bc.width !== Math.floor(w * dpr) || bc.dataset.key !== s.key){
    bc.width = Math.floor(w * dpr); bc.height = Math.floor(h * dpr); bc.dataset.key = s.key;
    const x = bc.getContext("2d");
    if(s.bild) x.drawImage(AS_MP.bild[s.pfad], 0, 0, bc.width, bc.height);
    else { const pg = await AS_MP.pdf[s.pfad].getPage(s.seite), v1 = pg.getViewport({ scale: 1 });
      if(nr !== AS_MP.render) return;
      await pg.render({ canvasContext: x, viewport: pg.getViewport({ scale: bc.width / v1.width }) }).promise.catch(() => {}); }
  }
  asMpZeichne(r); asMpNotizen(r);
}
function asMpAnno(key){ const a = AS_MP.m.anno; return a[key] || (a[key] = { s: [], t: [] }); }
function asMpZeichne(r){
  const c = r.querySelector(".mp-zeichnen"), x = c.getContext("2d"), d = asMpAnno(r.dataset.key);
  x.clearRect(0, 0, c.width, c.height); x.lineCap = "round"; x.lineJoin = "round";
  d.s.forEach(st => { const f = AS_MP_FARBE[st.k]; x.globalAlpha = f.a; x.strokeStyle = f.c; x.lineWidth = f.w * c.width; x.beginPath();
    st.p.forEach(([px, py], i) => i ? x.lineTo(px * c.width, py * c.height) : x.moveTo(px * c.width, py * c.height));
    if(st.p.length === 1) x.lineTo(st.p[0][0] * c.width + 0.5, st.p[0][1] * c.height); x.stroke(); });
  x.globalAlpha = 1;
}
function asMpFolieNr(){ return "Folie " + AS_MP.akt; }
function asMpNotizen(r){
  const eb = r.querySelector(".mp-textebene"), key = r.dataset.key, d = asMpAnno(key);
  eb.textContent = "";
  d.t.forEach(t => {
    const el = document.createElement("div"); el.className = "mp-notiz"; el.contentEditable = "true"; el.textContent = t.txt;
    el.style.left = (t.x * 100) + "%"; el.style.top = (t.y * 100) + "%";
    el.addEventListener("blur", () => { const alt = t.txt, neu = el.innerText.trim();
      if(!neu){ if(d.t.includes(t)) d.t.splice(d.t.indexOf(t), 1); asMpNotizen(r); } else t.txt = neu;
      asMpVermerk(asMpFolieNr() + " · Notiz auf der Folie", alt, neu); });
    el.addEventListener("pointerdown", e => { if(AS_MP.werkzeug !== "radierer") return; e.preventDefault(); e.stopPropagation();
      d.t.splice(d.t.indexOf(t), 1); AS_MP.verlauf.push({ key, art: "t", obj: t }); asMpVermerk(asMpFolieNr() + " · Notiz gelöscht", t.txt, ""); asMpNotizen(r); });
    eb.appendChild(el);
  });
}
function asMpPos(e, r){ const b = r.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; }
function asMpZeichenEreignisse(r, key){
  const c = r.querySelector(".mp-zeichnen"); let akt = null;
  c.addEventListener("pointerdown", e => {
    const d = asMpAnno(key);
    if(AS_MP.werkzeug === "radierer"){ const p = asMpPos(e, r), i = d.s.findIndex(st => st.p.some(([px, py]) => Math.hypot((px - p[0]) * 16, (py - p[1]) * 9) < 0.25));
      if(i >= 0){ AS_MP.verlauf.push({ key, art: "s", obj: d.s[i] }); d.s.splice(i, 1); asMpVermerk(asMpFolieNr() + " · Strich gelöscht", "Strich", ""); asMpZeichne(r); } return; }
    if(!AS_MP_FARBE[AS_MP.werkzeug]) return;
    c.setPointerCapture(e.pointerId); akt = { k: AS_MP.werkzeug, p: [asMpPos(e, r)] }; d.s.push(akt); asMpZeichne(r);
  });
  c.addEventListener("pointermove", e => { if(akt){ akt.p.push(asMpPos(e, r)); asMpZeichne(r); } });
  const ende = () => { if(!akt) return; akt.p = akt.p.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]);
    AS_MP.verlauf.push({ key, art: "neu-s", obj: akt }); asMpVermerk(asMpFolieNr() + " · " + (akt.k === "stift" ? "Stift" : "Marker"), "", "gezeichnet"); akt = null; };
  c.addEventListener("pointerup", ende); c.addEventListener("pointercancel", ende);
  r.querySelector(".mp-textebene").addEventListener("pointerdown", e => {
    if(AS_MP.werkzeug !== "text" || e.target.closest(".mp-notiz")) return; e.preventDefault();
    const p = asMpPos(e, r), t = { x: +p[0].toFixed(4), y: +p[1].toFixed(4), txt: "" }, d = asMpAnno(key);
    d.t.push(t); AS_MP.verlauf.push({ key, art: "neu-t", obj: t }); asMpNotizen(r);
    const el = r.querySelectorAll(".mp-notiz")[d.t.length - 1]; el.focus();
  });
}
function asMpWerkzeug(w, nurAnzeige){
  if(!nurAnzeige) AS_MP.werkzeug = AS_MP.werkzeug === w ? null : w;
  const wz = AS_MP.werkzeug;
  document.querySelectorAll("#asaMappe .mp-werkzeug [data-w]").forEach(b => b.classList.toggle("an", b.dataset.w === wz));
  const r = document.querySelector("#asaMappe .mp-rahmen"); if(!r) return;
  r.classList.toggle("zeichnen", !!AS_MP_FARBE[wz]); r.classList.toggle("text", wz === "text"); r.classList.toggle("radierer", wz === "radierer");
}
function asMpUndo(){
  const v = AS_MP.verlauf.pop(); if(!v) return; const d = asMpAnno(v.key);
  if(v.art === "neu-s") d.s.splice(d.s.indexOf(v.obj), 1);
  if(v.art === "neu-t") d.t.splice(d.t.indexOf(v.obj), 1);
  if(v.art === "s") d.s.push(v.obj);
  if(v.art === "t") d.t.push(v.obj);
  asMpVermerk(asMpFolieNr() + " · rückgängig", "", "");
  AS_MP.m.log.pop(); asMpLogAnz(); asMpSpeichern();
  const r = document.querySelector("#asaMappe .mp-rahmen"); if(r && r.dataset.key === v.key){ asMpZeichne(r); asMpNotizen(r); }
}

/* ---------- Protokoll drucken (1 Seite A4, Layout-Standard § 1: Kopf · Sitzungsdaten · 1.–4. · Unterschriften) ----------
   Farbe und Logo = Kundenmarke (portal_kunde.marke, wie as-app.js), kein OAK-Logo. Keine internen Schlüssel im Druck. */
function asMpOhneSchluessel(t){
  return String(t == null ? "" : t)
    .replace(/\s*[\[(]?\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b[\])]?/gi, "")
    .replace(/\s*[\[(]\s*[A-ZÄÖÜ]{1,5}-\d{1,3}\s*[\])]/g, "")
    .replace(/\b[A-ZÄÖÜ]{1,5}-\d{2,3}\b\s*[·:–]?\s*/g, "")
    .replace(/\s{2,}/g, " ").trim();
}
function asMpPunkte(t){ return String(t || "").split(/\n/).map(s => asMpOhneSchluessel(s.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, ""))).filter(Boolean); }
function asMpDruckDaten(){
  const a = AS_MP.a, m = AS_MP.m, marke = typeof asMarkePruefen === "function" ? asMarkePruefen(AS.kundeV1 && AS.kundeV1.marke) : {};
  const jahr = String(a.datum || "").slice(0, 4);
  const gleich = asT("as_asa").filter(x => String(x.datum || "").slice(0, 4) === jahr)
    .sort((x, y) => String(x.datum).localeCompare(String(y.datum)) || String(x.id).localeCompare(String(y.id)));
  const nr = gleich.findIndex(x => x.id === a.id) + 1;
  const anw = m.teilnehmende.filter(t => t.anwesend && t.name);
  const gf = anw.find(t => /geschäftsf/i.test(t.funktion || ""));
  const zeit = (m.zeit || "").trim();
  const besch = m.beschluesse.filter(b => b.ok && (b.text || "").trim());
  const ziel = t => /^\s*ziel\s*:/i.test(t);
  return {
    farbe: marke.farbe || "#2D6A4F",
    logo: marke.logo ? new URL(/^https:/.test(marke.logo) ? marke.logo : "../portal/" + marke.logo, location.href).href : null,
    firma: (AS.kundeV1 && AS.kundeV1.name) || "",
    sitzung: [nr ? nr + ". Sitzung" : "", asDat(a.datum) + (zeit ? ", " + zeit + (/uhr/i.test(zeit) ? "" : " Uhr") : ""), (m.ort || "").trim() || (AS.kundeV1 && AS.kundeV1.name) || ""].filter(Boolean).join(" · "),
    vorsitz: (m.vorsitz || "").trim() || (gf ? gf.name : ""),
    protokoll: (m.protokollfuehrer || "").trim(),
    teilnehmende: anw.map(t => asMpOhneSchluessel(t.name) + (t.funktion ? " (" + asMpOhneSchluessel(t.funktion) + ")" : "")).join(" · "),
    notizen: asMpPunkte(a.protokoll).concat(besch.filter(b => ziel(b.text)).map(b => "Ziel: " + asMpOhneSchluessel(b.text.replace(/^\s*ziel\s*:\s*/i, "")))),
    massnahmen: besch.filter(b => !ziel(b.text)).map(b => ({ text: asMpOhneSchluessel(b.text), prio: b.prio || "", wer: asMpOhneSchluessel(b.wer), bis: asMpOhneSchluessel(b.bis) })),
    offen: asMpPunkte(m.offen),
    naechste: [m.naechste ? asDat(m.naechste) : "", (m.naechste_text || "").trim()].filter(Boolean).join(" · ") || "Termin folgt.",
    ohneHaken: m.beschluesse.filter(b => !b.ok && (b.text || "").trim()).length,
    datum: asDat(a.datum)
  };
}
function asMpDruckHtml(d){
  const f = n => new URL("../assets/fonts/" + n, location.href).href;
  const liste = p => p.length ? `<table>${p.map((x, i) => `<tr><td class="nr">${i + 1}</td><td>${esc(x)}</td></tr>`).join("")}</table>` : `<p class="leer">Keine.</p>`;
  const mn = d.massnahmen.length ? `<table><colgroup><col style="width:24px"><col><col style="width:42px"><col style="width:130px"><col style="width:110px"></colgroup>
      <tr><th></th><th>Maßnahme</th><th class="m">Prio</th><th>Wer</th><th>Bis</th></tr>
      ${d.massnahmen.map((x, i) => `<tr><td class="nr">${i + 1}</td><td>${esc(x.text)}</td><td class="m">${esc(x.prio || "–")}</td><td>${esc(x.wer || "–")}</td><td>${esc(x.bis || "–")}</td></tr>`).join("")}</table>
      ${d.massnahmen.some(x => x.prio) ? `<p class="hinweis">Prio 1 = sofort beginnen · 2 = danach · 3 = laufend</p>` : ""}` : `<p class="leer">Keine.</p>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ASA-Protokoll ${esc(d.datum)}</title><style>
@font-face{font-family:'Cormorant Garamond';font-weight:600 700;src:url(${f("cormorant-garamond-600-normal.woff2")}) format('woff2')}
@font-face{font-family:'Jost';font-weight:400;src:url(${f("jost-400-normal.woff2")}) format('woff2')}
@font-face{font-family:'Jost';font-weight:600;src:url(${f("jost-600-normal.woff2")}) format('woff2')}
:root{--p:${d.farbe};--text:#1E2A3A;--grau:#5B6675;--linie:#D6DEE8}
@page{size:A4;margin:12mm 15mm 10mm}
*{box-sizing:border-box}
html{background:#E9EDF2}
body{font:10pt/1.3 Jost,"Segoe UI",Arial,sans-serif;color:var(--text);margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.leiste{position:sticky;top:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 16px;background:#fff;border-bottom:1px solid var(--linie);font-size:13px}
.leiste button{font:inherit;height:32px;padding:0 14px;border-radius:16px;border:1px solid var(--p);background:var(--p);color:#fff;cursor:pointer}
.leiste button.sek{background:#fff;color:var(--p)}
.leiste span{color:var(--grau)}
.blatt{background:#fff;width:210mm;max-width:100%;min-height:297mm;margin:16px auto;padding:12mm 15mm 10mm;box-shadow:0 2px 12px rgba(0,0,0,.12)}
.kopf{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:2px solid var(--p);padding-bottom:6px}
.kopf img{max-width:120px;max-height:48px;width:auto;height:auto}
.kopf .firma{font-weight:600;color:var(--p);text-align:right}
h1{font:700 19pt 'Cormorant Garamond',Georgia,serif;color:var(--p);margin:0}
h2{font:700 13pt 'Cormorant Garamond',Georgia,serif;color:var(--p);margin:12px 0 4px;break-after:avoid}
table{width:100%;border-collapse:collapse;break-inside:avoid;table-layout:fixed}
th{background:var(--p);color:#fff;text-align:left;padding:3px 6px;font-weight:600}
td{border-bottom:1px solid var(--linie);padding:3px 6px;vertical-align:top;overflow-wrap:anywhere}
td.nr{width:24px;color:var(--p);font-weight:600}
.m{text-align:center}
.meta{margin-top:6px}.meta td{border:none;padding:1px 6px 1px 0}.meta td:first-child{color:var(--grau);width:100px}
.hinweis{font-size:9pt;color:var(--grau);margin:4px 0 0}
.leer,.naechste{margin:0}
.leer{color:var(--grau)}
.abschnitt{break-inside:avoid}
.unt{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:26px;break-inside:avoid}
.unt div{border-top:1px solid var(--text);padding-top:3px;font-size:9.5pt;color:var(--grau)}
@media print{html{background:#fff}.leiste{display:none}.blatt{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}}
@media (max-width:820px){.blatt{margin:0;padding:16px;min-height:0;box-shadow:none}}
</style></head><body>
<div class="leiste"><button id="drucken">Drucken / als PDF speichern</button><button class="sek" id="zu">Schließen</button>
${d.ohneHaken ? `<span>${d.ohneHaken} Punkt(e) nicht als beschlossen markiert – stehen nicht im Protokoll.</span>` : ""}</div>
<div class="blatt">
<div class="kopf"><h1>Protokoll Arbeitsschutzausschuss</h1>${d.logo ? `<img src="${esc(d.logo)}" alt="${esc(d.firma)}">` : `<span class="firma">${esc(d.firma)}</span>`}</div>
<table class="meta"><tr><td>Sitzung</td><td>${esc(d.sitzung)}</td></tr>
<tr><td>Vorsitz</td><td>${esc(d.vorsitz || "–")}</td></tr><tr><td>Protokoll</td><td>${esc(d.protokoll || "–")}</td></tr>
<tr><td>Teilnehmende</td><td>${esc(d.teilnehmende || "–")}</td></tr></table>
<div class="abschnitt"><h2>1. Beschlüsse und Notizen</h2>${liste(d.notizen)}</div>
<div class="abschnitt"><h2>2. Maßnahmen</h2>${mn}</div>
<div class="abschnitt"><h2>3. Offene Punkte</h2>${liste(d.offen)}</div>
<div class="abschnitt"><h2>4. Nächste Sitzung</h2><p class="naechste">${esc(d.naechste)}</p></div>
<div class="unt"><div>Datum, Unterschrift Vorsitz${d.vorsitz ? " (" + esc(d.vorsitz) + ")" : ""}</div><div>Datum, Unterschrift Protokoll${d.protokoll ? " (" + esc(d.protokoll) + ")" : ""}</div></div>
</div>
<script>
document.getElementById("drucken").onclick=function(){window.print();};
document.getElementById("zu").onclick=function(){window.close();};
window.addEventListener("load",function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){if(!navigator.webdriver)setTimeout(function(){window.print();},200);});});
<\/script></body></html>`;
}
async function asMpDrucken(){
  const w = window.open("", "_blank");
  if(!w){ asMeldung("Druckansicht blockiert – bitte Pop-ups für das Cockpit erlauben"); return; }
  await asMpSpeichernJetzt();
  w.document.open(); w.document.write(asMpDruckHtml(asMpDruckDaten())); w.document.close();
}

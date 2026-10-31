/* ======================= Begehung im Cockpit (Fachkraft) =======================
   Eine Begehung, ein Punkt je Maschine: Notiz und Fotos liegen zusammen, egal ob am Laptop oder Handy erfasst.
   Fällt das Netz aus, bleiben Änderungen im Gerät (IndexedDB) und gehen automatisch nach. Die KI (Edge Function oak-ki)
   macht nur Vorschläge; der Mangel entsteht erst, wenn die Fachkraft ihn bestätigt. Tabellen: as_begehung, as_begehung_punkt. */
const AS_BG = { id: null, punkt: null, punkte: [], ki: null, warte: 0, abfrage: null, tippt: null, lokal: {} };

/* ---------------- Warteschlange fürs Funkloch ---------------- */
function asBgDb(){
  return new Promise((ok, nein) => { const r = indexedDB.open("oak-begehung", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("warte", { keyPath: "nr", autoIncrement: true });
    r.onsuccess = () => ok(r.result); r.onerror = () => nein(r.error); });
}
async function asBgStore(modus, fn){
  const db = await asBgDb();
  return new Promise((ok, nein) => { const t = db.transaction("warte", modus), q = fn(t.objectStore("warte"));
    t.oncomplete = () => ok(q.result); t.onerror = () => nein(t.error); });
}
async function asBgAusfuehren(a){
  if(a.typ === "punkt") return apiSend("POST", "/rest/v1/as_begehung_punkt", a.zeile, "return=minimal");
  if(a.typ === "notiz") return apiSend("PATCH", "/rest/v1/as_begehung_punkt?id=eq." + a.id, { notiz: a.notiz }, "return=minimal");
  if(a.typ === "foto"){
    const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + a.pfad, { method: "POST",
      headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: a.blob });
    if(!r.ok) throw new Error("Foto-Upload fehlgeschlagen (" + r.status + ")");
    const [p] = await apiGet("/rest/v1/as_begehung_punkt?select=fotos&id=eq." + a.id);
    return apiSend("PATCH", "/rest/v1/as_begehung_punkt?id=eq." + a.id, { fotos: asListe(p && p.fotos).concat([a.pfad]) }, "return=minimal");
  }
}
async function asBgSchreiben(a){
  try{ if(AS_BG.warte || !navigator.onLine) throw new Error("offline"); await asBgAusfuehren(a); }
  catch(e){ await asBgStore("readwrite", s => s.add(a)); AS_BG.warte++; asBgStand(); }
}
async function asBgNachsenden(){
  const alle = await asBgStore("readonly", s => s.getAll()); AS_BG.warte = alle.length; asBgStand();
  for(const a of alle){
    try{ await asBgAusfuehren(a); await asBgStore("readwrite", s => s.delete(a.nr)); AS_BG.warte--; asBgStand(); }
    catch(e){ a.versuche = (a.versuche || 0) + 1;
      if(a.versuche === 5 && window.OAK_FEHLER) window.OAK_FEHLER("begehung", "Begehungsdaten lassen sich nicht senden", { typ: a.typ, id: a.id, fehler: String(e.message || e) });
      await asBgStore("readwrite", s => s.put(a)); return; }
  }
}
function asBgStand(){ const el = document.getElementById("bgStand"); if(el) el.textContent = AS_BG.warte ? AS_BG.warte + " warten auf Netz" : "gespeichert"; }
window.addEventListener("online", () => asBgNachsenden().catch(() => {}));

/* ---------------- Liste ---------------- */
async function asBgSeite(box, k){
  await asBgNachsenden().catch(() => {});
  if(AS_BG.id) return asBgDetail(box, k);
  const liste = await apiGet("/rest/v1/as_begehung?select=*&order=datum.desc,erstellt_am.desc&limit=50" + k).catch(() => []) || [];
  box.innerHTML = `<div class="karte"><h2>Begehungen <span><button class="btn klein" id="bgNeu">Neue Begehung</button></span></h2><div class="zeilen">${liste.map(b => `<div class="z" data-bg="${b.id}"><div><b>${esc(b.titel)}</b><small>${asDat(b.datum)}${b.teilnehmer ? " · " + esc(b.teilnehmer) : ""}</small></div><span class="hinweis">${b.status === "offen" ? "offen" : "abgeschlossen"}</span></div>`).join("") || `<div class="leer">Noch keine Begehung angelegt.</div>`}</div></div><div id="bgSelbst"></div>`;
  box.querySelectorAll("[data-bg]").forEach(z => z.onclick = () => { AS_BG.id = z.dataset.bg; AS_BG.punkt = null; asBgSeite(box, k); });
  box.querySelector("#bgNeu").onclick = () => asDialog({ titel: "Neue Begehung", inhalt: `<div class="form">${asFeld("Titel", "titel", "Begehung " + asDat(asHeute()), "text", "voll")}${asFeld("Datum", "datum", asHeute(), "date")}${asFeld("Teilnehmer", "teilnehmer", "", "text")}</div>`,
    knoepfe: [{ t: "Anlegen", fn: async d => { const w = asWerte(d); if(!w.titel){ asMeldung("Bitte benennen"); return false; }
      const r = await apiSend("POST", "/rest/v1/as_begehung", { kunde_slug: AS.kunde, titel: w.titel, datum: w.datum || asHeute(), teilnehmer: w.teilnehmer, erstellt_von: AS.ich }, "return=representation");
      AS_BG.id = r[0].id; asBgSeite(box, k); } }] });
  await asBegehung(box.querySelector("#bgSelbst"), k);
}

/* ---------------- Eine Begehung: links Maschinen, rechts Notiz und Fotos ---------------- */
async function asBgLaden(k){
  const [b] = await apiGet("/rest/v1/as_begehung?select=*&id=eq." + AS_BG.id);
  const p = await apiGet("/rest/v1/as_begehung_punkt?select=*&order=erstellt_am&begehung_id=eq." + AS_BG.id) || [];
  const [ki] = await apiGet("/rest/v1/as_ki_einstellung?select=aktiv&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => []) || [];
  AS_BG.ki = ki || null; AS_BG.punkte = p.concat(Object.values(AS_BG.lokal).filter(x => !p.some(y => y.id === x.id)));
  return b;
}
async function asBgDetail(box, k){
  if(typeof asBetriebLaden === "function") await asBetriebLaden();
  const b = await asBgLaden(k).catch(() => null);
  if(!b){ box.innerHTML = `<div class="karte"><div class="leer">Begehung nicht erreichbar. Bitte Netz prüfen.</div></div>`; return; }
  AS_BG.b = b;
  const anl = asAnlagen().filter(d => d.maschinen_id), zu = b.status !== "offen";
  box.innerHTML = `<div class="karte bg-kopf"><div><b>${esc(b.titel)}</b><small>${asDat(b.datum)} · <span id="bgStand">gespeichert</span></small></div>
    <div class="bg-knoepfe"><button class="btn sek klein" id="bgZurueck">Liste</button><button class="btn sek klein" id="bgProt">Protokoll</button>${zu ? "" : `<button class="btn klein" id="bgFertig">Abschließen</button>`}</div></div>
    <div class="bg-raster"><div class="karte bg-links">
      ${zu ? "" : `<div class="bg-wahl"><select id="bgWahl" aria-label="Maschine wählen"><option value="">Maschine wählen …</option><option value="ALLG-HALLE">Halle / allgemein</option>${anl.map(d => `<option value="${esc(d.maschinen_id)}">${esc(d.maschine || d.titel)}</option>`).join("")}</select></div>`}
      <div class="zeilen" id="bgPunkte"></div></div><div class="karte bg-rechts" id="bgRechts"></div></div>`;
  box.querySelector("#bgZurueck").onclick = () => { AS_BG.id = null; clearInterval(AS_BG.abfrage); asBgSeite(box, k); };
  box.querySelector("#bgProt").onclick = () => asBgProtokoll();
  const f = box.querySelector("#bgFertig"); if(f) f.onclick = async () => { await apiSend("PATCH", "/rest/v1/as_begehung?id=eq." + b.id, { status: "abgeschlossen" }, "return=minimal"); asBgDetail(box, k); };
  const w = box.querySelector("#bgWahl"); if(w) w.onchange = async () => {
    if(!w.value) return;
    const da = AS_BG.punkte.find(p => (p.maschinen_id || "") === w.value);
    if(da){ AS_BG.punkt = da.id; w.value = ""; return asBgZeichnen(box); }
    const d = anl.find(x => x.maschinen_id === w.value);
    const z = { id: crypto.randomUUID(), kunde_slug: AS.kunde, begehung_id: b.id, maschinen_id: w.value, maschine: d ? d.maschine || d.titel : "Halle / allgemein" };
    AS_BG.lokal[z.id] = Object.assign({ fotos: [], mangel_ids: [], notiz: "" }, z); AS_BG.punkte.push(AS_BG.lokal[z.id]); AS_BG.punkt = z.id; w.value = "";
    await asBgSchreiben({ typ: "punkt", zeile: z }); asBgZeichnen(box);
  };
  asBgZeichnen(box);
  clearInterval(AS_BG.abfrage);
  AS_BG.abfrage = setInterval(async () => {   // Fotos vom Handy erscheinen von selbst am Laptop
    if(!document.getElementById("bgRechts")){ clearInterval(AS_BG.abfrage); return; }
    if(AS_BG.tippt || document.querySelector("dialog[open]") || AS_BG.warte) return;
    const alt = JSON.stringify(AS_BG.punkte); await asBgLaden(k).catch(() => {}); if(alt !== JSON.stringify(AS_BG.punkte)) asBgZeichnen(box);
  }, 10000);
}
function asBgZeichnen(box){
  const liste = box.querySelector("#bgPunkte"), rechts = box.querySelector("#bgRechts"), p = AS_BG.punkte.find(x => x.id === AS_BG.punkt), zu = AS_BG.b.status !== "offen";
  liste.innerHTML = AS_BG.punkte.map(x => `<div class="z${x.id === AS_BG.punkt ? " bg-akt" : ""}" data-p="${x.id}"><div><b title="${esc(x.maschine)}">${esc(x.maschine)}</b><small>${asListe(x.fotos).length} Fotos · ${asListe(x.mangel_ids).length} Mängel${x.signiert_am ? " · unterschrieben" : x.arbeitssystem_id ? " · BdA gespeichert" : ""}</small></div></div>`).join("") || `<div class="leer">Maschine wählen, um zu beginnen.</div>`;
  liste.querySelectorAll("[data-p]").forEach(z => z.onclick = () => { AS_BG.punkt = z.dataset.p; asBgZeichnen(box); });
  if(!p){ rechts.innerHTML = `<div class="leer">Links eine Maschine wählen.</div>`; return; }
  const ki = AS_BG.ki && AS_BG.ki.aktiv;
  rechts.innerHTML = `<h2>${esc(p.maschine)}</h2><textarea id="bgNotiz" class="bg-notiz" placeholder="Beobachtungen mittippen …" ${zu ? "readonly" : ""}>${esc(p.notiz || "")}</textarea>
    <div class="bg-fotos" id="bgFotos"></div>
    ${zu ? "" : `<div class="bg-knoepfe"><label class="btn sek klein">Foto<input type="file" id="bgFoto" accept="image/*" capture="environment" multiple hidden></label>
      <button class="btn klein" id="bgFertigM">Maschine fertig</button>${p.arbeitssystem_id ? `<button class="btn sek klein" id="bgBda">BdA öffnen</button><button class="btn sek klein" id="bgSign">${p.signiert_am ? "Erneut unterschreiben" : "Unterschreiben"}</button>` : ""}<button class="btn sek klein" id="bgMangel">Mangel erfassen</button>${ki ? `<button class="btn klein" id="bgKi">KI-Vorschlag</button><button class="btn sek klein" id="bgFrage">KI fragen</button>` : AS.admin ? `<button class="btn sek klein" id="bgKiAn">KI einschalten</button>` : ""}</div>`}`;
  const n = rechts.querySelector("#bgNotiz");
  n.oninput = () => { clearTimeout(AS_BG.tippt); AS_BG.tippt = setTimeout(() => { AS_BG.tippt = null; asBgNotiz(p, n.value); }, 800); };
  n.onblur = () => { if(AS_BG.tippt){ clearTimeout(AS_BG.tippt); AS_BG.tippt = null; asBgNotiz(p, n.value); } };
  const fo = rechts.querySelector("#bgFotos");
  asListe(p.fotos).forEach(async pfad => { const a = document.createElement("a"); a.className = "bg-foto"; fo.appendChild(a);
    const u = pfad.startsWith("blob:") ? pfad : await asSigniert(pfad); if(u){ a.href = u; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = `<img src="${esc(u)}" alt="Foto">`; } });
  const fi = rechts.querySelector("#bgFoto"); if(fi) fi.onchange = async () => { for(const f of fi.files){
      const blob = await asFotoKlein(f), pfad = AS.kunde + "/begehung/" + AS_BG.b.id + "/" + p.id + "/" + Date.now() + ".jpg";
      p.fotos = asListe(p.fotos).concat([URL.createObjectURL(blob)]); await asBgSchreiben({ typ: "foto", id: p.id, pfad, blob }); }
    asBgZeichnen(box); };
  const mg = rechts.querySelector("#bgMangel"); if(mg) mg.onclick = () => asBgMangel(box, p, { befund: n.value });
  const fm = rechts.querySelector("#bgFertigM"); if(fm) fm.onclick = () => { if(AS_BG.tippt){ clearTimeout(AS_BG.tippt); AS_BG.tippt = null; } asBgNotiz(p, n.value); asBgFertig(box, p); };
  const bd = rechts.querySelector("#bgBda"); if(bd) bd.onclick = () => { AS.reiter.bda = p.arbeitssystem_id; asGehe("bda/" + p.arbeitssystem_id); };
  const sg = rechts.querySelector("#bgSign"); if(sg) sg.onclick = () => asBgSignieren(box, p);
  const fr = rechts.querySelector("#bgFrage"); if(fr) fr.onclick = asBgFrage;
  const kb = rechts.querySelector("#bgKi"); if(kb) kb.onclick = async () => { kb.disabled = true; kb.textContent = "KI arbeitet …";
    try{ const v = await asBgKi("mangel", "Maschine: " + p.maschine + "\nNotiz: " + (n.value || "(keine)"), asListe(p.fotos).filter(x => !x.startsWith("blob:")).slice(-3)); asBgMangel(box, p, v, true); }
    catch(e){ asMeldung(e.message); } kb.disabled = false; kb.textContent = "KI-Vorschlag"; };
  const an = rechts.querySelector("#bgKiAn"); if(an) an.onclick = () => asDialog({ titel: "KI für diesen Betrieb einschalten", inhalt: `<p>Notizen und Fotos dieser Begehung gehen dann an den KI-Anbieter. Das muss im AVV mit dem Betrieb geregelt sein.</p><p class="hinweis">AVV laut Stammdaten: ${AS.kundeV1 && AS.kundeV1.avv_abgeschlossen_am ? asDat(AS.kundeV1.avv_abgeschlossen_am) : "nicht hinterlegt"}</p>`,
    knoepfe: [{ t: "Einschalten, AVV ist geregelt", fn: async () => { await apiSend("POST", "/rest/v1/as_ki_einstellung?on_conflict=kunde_slug", { kunde_slug: AS.kunde, aktiv: true, avv_bestaetigt_am: asHeute() }, "resolution=merge-duplicates,return=minimal"); AS_BG.ki = { aktiv: true }; asBgZeichnen(box); } }] });
}
function asBgNotiz(p, wert){ p.notiz = wert; if(AS_BG.lokal[p.id]) AS_BG.lokal[p.id].notiz = wert; const s = document.getElementById("bgStand"); if(s) s.textContent = "speichert …"; asBgSchreiben({ typ: "notiz", id: p.id, notiz: wert }).then(asBgStand); }

async function asBgKi(funktion, text, fotos){
  const r = await fetch(CFG.url + "/functions/v1/oak-ki", { method: "POST", headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ kunde: AS.kunde, funktion, text, fotos: fotos || [] }) });
  const j = await r.json().catch(() => ({})); if(!r.ok) throw new Error(j.fehler || "KI nicht erreichbar"); return j;
}

/* Frage an den Assistenten: nutzt immer Rechtskataster, Fachwissen und die Daten dieses Betriebs */
function asBgFrage(){
  const d = asDialog({ titel: "KI fragen", breit: true, inhalt: `<div class="form">${asFeld("Ihre Frage", "frage", "", "textarea", "voll")}</div><div id="bgAntwort" class="bg-antwort"></div>
      <p class="hinweis">KI-Antwort aus Rechtskataster, Fachwissen und Betriebsdaten. Ersetzt weder Fachkraft noch Rechtsberatung.</p>`,
    knoepfe: [{ t: "Fragen", fn: async dl => { const w = asWerte(dl), a = dl.querySelector("#bgAntwort"); if(!w.frage) return false;
      a.textContent = "KI arbeitet …";
      try{ const r = await asBgKi("frage", w.frage);
        a.innerHTML = `<p>${esc(r.antwort).replace(/\n/g, "<br>")}</p>${r.quellen && r.quellen.length ? `<p class="hinweis">Quellen: ${r.quellen.map(esc).join(" · ")}</p>` : ""}`; }
      catch(e){ a.textContent = e.message; }
      return false; } }] });
  return d;
}

/* Mangel entsteht erst hier: Vorschlag prüfen, ändern, bestätigen */
function asBgMangel(box, p, v, vonKi){
  asDialog({ titel: vonKi ? "KI-Vorschlag prüfen" : "Mangel erfassen", inhalt: `${vonKi ? `<p class="hinweis">Vorschlag der KI. Bitte fachlich prüfen, bevor er in die Mängelliste geht.</p>` : ""}<div class="form">
      ${asFeld("Mangel", "label", v.befund || "", "textarea", "voll")}${asFeld("Maßnahme", "massnahme", v.massnahme || "", "textarea", "voll")}
      ${asAuswahl("Wie gefährlich?", "band", v.band || "besorgnis", [["gefahr", "Gefahr – sofort handeln"], ["besorgnis", "Besorgnis – bald beheben"], ["akzeptanz", "gering"]])}
      ${asAuswahl("Art der Maßnahme", "stop", v.stop || "T", [["S", "Substitution"], ["T", "Technisch"], ["O", "Organisatorisch"], ["P", "Persönlich"]])}
      ${asFeld("Rechtsgrundlage", "rechtsgrundlage", v.rechtsgrundlage || "", "text", "voll")}</div>`,
    knoepfe: [{ t: "In die Mängelliste", fn: async d => { const w = asWerte(d); if(!w.label){ asMeldung("Bitte den Mangel beschreiben."); return false; }
      const dok = asAnlagen().find(x => x.maschinen_id === p.maschinen_id), foto = asListe(p.fotos).filter(x => !x.startsWith("blob:")).slice(-1)[0] || null;
      const r = await apiSend("POST", "/rest/v1/portal_maengel", { kunde_slug: AS.kunde, kunde: AS.org ? AS.org.name : null, maschinen_id: p.maschinen_id || "ALLG-HALLE", maschine: p.maschine,
        maschinentyp: dok ? dok.maschinentyp : "Tätigkeit / allgemein", schluessel: "BG-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6), thema: "begehung", thema_rang: 0,
        label: w.label, massnahme: [w.massnahme, w.rechtsgrundlage ? "Rechtsgrundlage: " + w.rechtsgrundlage : ""].filter(Boolean).join(" · ") || null, stop: w.stop, band: w.band,
        prioritaet: { gefahr: 10, besorgnis: 3010, akzeptanz: 6010 }[w.band], status: "offen", foto_pfad: foto, gemeldet_von: AS.ich, gemeldet_am: asHeute() }, "return=representation");
      if(r && r[0]){ await asMgLog(r[0].id, "erfasst", vonKi ? "Begehung, KI-Vorschlag bestätigt: " + w.label : "Begehung: " + w.label, null);
        p.mangel_ids = asListe(p.mangel_ids).concat([r[0].id]);
        await apiSend("PATCH", "/rest/v1/as_begehung_punkt?id=eq." + p.id, { mangel_ids: p.mangel_ids }, "return=minimal"); }
      asMeldung("Mangel gespeichert"); asBgZeichnen(box); } }] });
}

/* ---------------- Protokoll: aus denselben Daten, Druck oder PDF ---------------- */
async function asBgProtokoll(){
  const w = window.open("", "_blank"); if(!w){ asMeldung("Bitte Pop-ups erlauben"); return; }
  w.document.write("<p>Protokoll wird erstellt …</p>");
  const b = AS_BG.b, ids = AS_BG.punkte.flatMap(p => asListe(p.mangel_ids));
  const mg = ids.length ? await apiGet("/rest/v1/portal_maengel?select=id,label,massnahme,band,termin&id=in.(" + ids.join(",") + ")").catch(() => []) : [];
  if(AS_BG.ki && AS_BG.ki.aktiv && !b.zusammenfassung && AS_BG.punkte.length) try{
    const r = await asBgKi("protokoll", AS_BG.punkte.map(p => p.maschine + ": " + (p.notiz || "(keine Notiz)")).join("\n"));
    b.zusammenfassung = r.zusammenfassung;
    await apiSend("PATCH", "/rest/v1/as_begehung?id=eq." + b.id, { zusammenfassung: r.zusammenfassung }, "return=minimal");
  }catch(e){ /* Protokoll geht auch ohne KI */ }
  const teile = [];
  for(const p of AS_BG.punkte){
    const urls = await Promise.all(asListe(p.fotos).filter(x => !x.startsWith("blob:")).map(asSigniert));
    const m = mg.filter(x => asListe(p.mangel_ids).includes(x.id)), sig = p.signatur_pfad ? await asSigniert(p.signatur_pfad) : null;
    teile.push(`<section><h2>${esc(p.maschine)}</h2>${p.notiz ? `<p>${esc(p.notiz).replace(/\n/g, "<br>")}</p>` : ""}
      ${m.length ? `<table><tr><th>Mangel</th><th>Maßnahme</th><th>Einstufung</th></tr>${m.map(x => `<tr><td>${esc(x.label)}</td><td>${esc(x.massnahme || "–")}</td><td>${esc(x.band || "–")}</td></tr>`).join("")}</table>` : ""}
      ${asListe(p.entwurf).length ? `<table><tr><th>Gefährdung</th><th>Situation</th><th>W×S vorher</th><th>W×S nachher</th></tr>${p.entwurf.map(g => `<tr><td>${esc(g.kurz)}</td><td>${esc(g.situation || "")}</td><td>${esc(g.w_v)}×${esc(g.s_v)}</td><td>${esc(g.w_n)}×${esc(g.s_n)}</td></tr>`).join("")}</table>` : ""}
      ${p.signiert_am ? `<p>Durchgesprochen und unterschrieben: ${esc(p.signiert_von)}, ${asDat(p.signiert_am)}</p>${sig ? `<img class="sig" src="${esc(sig)}" alt="Unterschrift">` : ""}` : ""}
      <div class="fotos">${urls.filter(Boolean).map(u => `<img src="${esc(u)}" alt="Foto">`).join("")}</div></section>`);
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(b.titel)}</title><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Jost:wght@400;500&display=swap" rel="stylesheet"><style>
    @page{size:A4;margin:16mm}body{font:11pt/1.4 Jost,Arial,sans-serif;color:#222;margin:0}h1,h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;color:#1a3a5c;margin:0 0 6px}h1{font-size:24pt}h2{font-size:15pt}
    section{break-inside:avoid;margin-top:16px}table{width:100%;border-collapse:collapse;break-inside:avoid;margin:6px 0}th,td{border:1px solid #ccd;padding:4px 6px;text-align:left;vertical-align:top;font-size:10pt}
    .fotos{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.fotos img{width:100%;height:110px;object-fit:cover}.kopf{color:#555}.sig{height:60px;display:block}.nodruck{margin:12px 0}@media print{.nodruck{display:none}}
    </style></head><body><div class="nodruck"><button onclick="print()">Drucken oder als PDF speichern</button></div><h1>${esc(b.titel)}</h1>
    <p class="kopf">${esc(AS.org ? AS.org.name : "")} · ${asDat(b.datum)}${b.teilnehmer ? " · Teilnehmer: " + esc(b.teilnehmer) : ""}</p>
    ${b.zusammenfassung ? `<section><h2>Zusammenfassung</h2><p>${esc(b.zusammenfassung)}</p></section>` : ""}${teile.join("") || "<p>Noch keine Punkte erfasst.</p>"}</body></html>`);
  w.document.close();
}

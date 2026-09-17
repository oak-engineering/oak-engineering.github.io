/* OAK EHS-Cockpit — Gefahrstoffkataster (Nikolai 17.09.2026: „Gefahrstoffkataster mit Dokumenten (SDB, GBU, BA)").
   Daten: portal_gefahrstoff (Verzeichnis nach § 6 GefStoffV, eingespielt mit tools/gefahrstoffe_portal.py), Dokumente der
   Kategorie „gefahrstoffe" (Betriebsanweisungen, Hautschutzpläne). Aufbau wie das Anlagenkataster: Liste mit Suche und Filter,
   Klick öffnet die Kurzinfo mit H-Sätzen und den Dokumenten. Pflegen dürfen OAK und die Fachkraft des Betriebs. */
"use strict";

let GS_ROWS = [], GS_GELADEN_FUER = null;
/* Gefahrenhinweise (H-Sätze) nach CLP-Verordnung, deutscher Wortlaut – nur die im Betrieb üblichen */
const GS_H = {
  H220: "Extrem entzündbares Gas.", H222: "Extrem entzündbares Aerosol.", H223: "Entzündbares Aerosol.",
  H224: "Flüssigkeit und Dampf extrem entzündbar.", H225: "Flüssigkeit und Dampf leicht entzündbar.", H226: "Flüssigkeit und Dampf entzündbar.",
  H228: "Entzündbarer Feststoff.", H229: "Behälter steht unter Druck: Kann bei Erwärmung bersten.", H280: "Enthält Gas unter Druck; kann bei Erwärmung explodieren.",
  H290: "Kann gegenüber Metallen korrosiv sein.", H301: "Giftig bei Verschlucken.", H302: "Gesundheitsschädlich bei Verschlucken.",
  H304: "Kann bei Verschlucken und Eindringen in die Atemwege tödlich sein.", H311: "Giftig bei Hautkontakt.", H312: "Gesundheitsschädlich bei Hautkontakt.",
  H314: "Verursacht schwere Verätzungen der Haut und schwere Augenschäden.", H315: "Verursacht Hautreizungen.", H317: "Kann allergische Hautreaktionen verursachen.",
  H318: "Verursacht schwere Augenschäden.", H319: "Verursacht schwere Augenreizung.", H331: "Giftig bei Einatmen.", H332: "Gesundheitsschädlich bei Einatmen.",
  H334: "Kann bei Einatmen Allergie, asthmaartige Symptome oder Atembeschwerden verursachen.", H335: "Kann die Atemwege reizen.",
  H336: "Kann Schläfrigkeit und Benommenheit verursachen.", H340: "Kann genetische Defekte verursachen.", H341: "Kann vermutlich genetische Defekte verursachen.",
  H350: "Kann Krebs erzeugen.", H351: "Kann vermutlich Krebs erzeugen.", H360: "Kann die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen.",
  H361: "Kann vermutlich die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen.", H370: "Schädigt die Organe.", H371: "Kann die Organe schädigen.",
  H372: "Schädigt die Organe bei längerer oder wiederholter Exposition.", H373: "Kann die Organe schädigen bei längerer oder wiederholter Exposition.",
  H400: "Sehr giftig für Wasserorganismen.", H410: "Sehr giftig für Wasserorganismen mit langfristiger Wirkung.",
  H411: "Giftig für Wasserorganismen, mit langfristiger Wirkung.", H412: "Schädlich für Wasserorganismen, mit langfristiger Wirkung.",
  H413: "Kann für Wasserorganismen schädlich sein, mit langfristiger Wirkung."
};

/* GHS-Piktogramme aus den H-Sätzen nach CLP-Verordnung (Anhang I) mit Vorrangregeln aus Art. 26:
   GHS06 -> kein GHS07 · GHS05 -> kein GHS07 für Haut-/Augenreizung · H334 (GHS08) -> kein GHS07 für Hautsensibilisierung/-reizung.
   H229 allein, H412, H413 und H362 haben kein Piktogramm. Verbindlich bleibt das Etikett bzw. SDB Abschnitt 2.2. */
const GS_GHS = {
  GHS01: ["H200", "H201", "H202", "H203", "H204", "H240", "H241"],
  GHS02: ["H220", "H221", "H222", "H223", "H224", "H225", "H226", "H228", "H241", "H242", "H250", "H251", "H252", "H260", "H261"],
  GHS03: ["H270", "H271", "H272"],
  GHS04: ["H280", "H281"],
  GHS05: ["H290", "H314", "H318"],
  GHS06: ["H300", "H301", "H310", "H311", "H330", "H331"],
  GHS07: ["H302", "H312", "H315", "H317", "H319", "H332", "H335", "H336", "H420"],
  GHS08: ["H304", "H334", "H340", "H341", "H350", "H351", "H360", "H361", "H370", "H371", "H372", "H373"],
  GHS09: ["H400", "H410", "H411"]
};
const GS_GHS_NAME = { GHS01: "Explodierende Bombe", GHS02: "Flamme", GHS03: "Flamme über einem Kreis", GHS04: "Gasflasche", GHS05: "Ätzwirkung",
  GHS06: "Totenkopf mit gekreuzten Knochen", GHS07: "Ausrufezeichen", GHS08: "Gesundheitsgefahr", GHS09: "Umwelt" };
function gsPiktogramme(hs){
  const h = new Set((hs || []).map(x => String(x).toUpperCase().slice(0, 4)));
  const hat = k => GS_GHS[k].some(x => h.has(x));
  const p = Object.keys(GS_GHS).filter(k => k !== "GHS07" && hat(k));
  let g07 = GS_GHS.GHS07.filter(x => h.has(x));
  if(p.includes("GHS06")) g07 = [];
  if(p.includes("GHS05")) g07 = g07.filter(x => x !== "H315" && x !== "H319");
  if(h.has("H334")) g07 = g07.filter(x => !["H315", "H317", "H319"].includes(x));
  if(g07.length) p.push("GHS07");
  return p.sort();
}
function gsPiktoHtml(hs, klasse){
  return gsPiktogramme(hs).map(k => `<img class="${klasse || "gs-pikto"}" src="ghs/ghs${k.slice(3)}.png" alt="${esc(k + " " + GS_GHS_NAME[k])}" title="${esc(k + " – " + GS_GHS_NAME[k])}" loading="lazy">`).join("");
}

async function gsLaden(erzwingen){
  if(!erzwingen && GS_GELADEN_FUER === AKTIV) return GS_ROWS;
  try{ GS_ROWS = await apiGet("/rest/v1/portal_gefahrstoff?select=*" + (AKTIV ? "&kunde_slug=eq." + encodeURIComponent(AKTIV) : "") + "&order=bezeichnung.asc", false) || []; }
  catch(e){ GS_ROWS = []; }
  GS_GELADEN_FUER = AKTIV;
  return GS_ROWS;
}
function gsDarfPflegen(){ return !!(typeof ADMIN !== "undefined" && ADMIN) || !!window.__oakFachkraft; }
function gsDokumente(){ return (typeof katRows === "function" ? katRows("gefahrstoffe") : []); }
function gsDokTitel(pfad){ const d = gsDokumente().find(r => r.storage_path === pfad); return d ? String(d.titel).replace(/^Betriebsanweisung\s*–\s*/, "") : String(pfad).split("/").pop(); }
function gsOeffnen(pfad, titel, klasse){ return `<a class="${klasse || "btn sek ul-btn"}" href="${viewerUrl("pdf", pfad, titel)}" target="_blank" rel="noopener">${esc(titel)}</a>`; }

async function renderGefahrstoffe(wrap){
  const sec = document.createElement("section"); sec.className = "sektion ul-liste-seite gs-seite";
  sec.innerHTML = `<div class="ck-fuss">Gefahrstoffkataster wird geladen …</div>`;
  wrap.appendChild(sec);
  await gsLaden(true);
  const aktiv = GS_ROWS.filter(g => g.aktiv), alt = GS_ROWS.filter(g => !g.aktiv);
  const docs = gsDokumente();
  const bas = docs.filter(d => /^Betriebsanweisung/.test(d.titel)), hs = docs.filter(d => /^Hautschutz/i.test(d.titel)), sonst = docs.filter(d => !bas.includes(d) && !hs.includes(d));
  const bereiche = [...new Set(aktiv.flatMap(g => g.bereiche || []))].sort((a, b) => a.localeCompare(b, "de"));
  const ohneSdb = aktiv.filter(g => !g.sdb_pfad).length, ohneGbu = aktiv.filter(g => !g.gbu_pfad).length;
  const zeile = g => `<div class="ul-zeile ul-klick" data-id="${esc(g.id)}" data-suche="${esc([g.bezeichnung, g.hersteller, g.verwendung, g.artikelnummer, (g.h_saetze || []).join(" ")].filter(Boolean).join(" ").toLowerCase())}"
      data-bereiche="${esc((g.bereiche || []).join("|"))}" data-signal="${esc(g.signalwort || "")}" data-luecke="${!g.sdb_pfad || !g.gbu_pfad ? "1" : ""}">
      <span class="gs-signal gs-${g.signalwort === "Gefahr" ? "gefahr" : g.signalwort === "Achtung" ? "achtung" : "ohne"}">${esc(g.signalwort || "–")}</span>
      <span class="gs-piktos">${gsPiktoHtml(g.h_saetze)}</span>
      <div class="ul-z-name"><b>${esc(g.bezeichnung)}</b><span>${esc([g.hersteller, (g.bereiche || []).join(", ")].filter(Boolean).join(" · "))}</span></div>
      <div class="ul-z-info">${(g.h_saetze || []).length ? `<span>${(g.h_saetze || []).length} H-Sätze</span>` : ""}
        ${g.sdb_pfad ? `<span>SDB${g.sdb_ausgabe ? " " + esc(ehsDatum(g.sdb_ausgabe)) : ""}</span>` : `<span class="ul-mg">SDB fehlt</span>`}
        ${g.gbu_pfad ? "" : `<span class="gs-luecke" title="Gefährdungsbeurteilung für Tätigkeiten mit Gefahrstoffen (§ 6 GefStoffV) noch nicht hinterlegt">GBU fehlt</span>`}</div>
      <span class="ul-pfeil" aria-hidden="true">›</span></div>`;
  const dokKnoepfe = l => l.map(d => `<a class="btn sek ul-btn" href="${viewerUrl(d.doc_typ || "pdf", d.storage_path, d.titel)}" target="_blank" rel="noopener">${esc(String(d.titel).replace(/^Betriebsanweisung\s*–\s*/, ""))}</a>`).join("");
  sec.innerHTML = `<p class="uw-erkl">Verzeichnis der im Betrieb verwendeten Gefahrstoffe (§ 6 GefStoffV) mit Sicherheitsdatenblatt, Betriebsanweisung und Gefährdungsbeurteilung.
      ${aktiv.length} Stoffe${ohneSdb ? ` · <b>${ohneSdb} ohne Sicherheitsdatenblatt</b>` : ""}${ohneGbu ? ` · ${ohneGbu} ohne Gefährdungsbeurteilung` : ""}.</p>
    ${bas.length ? `<h2 class="ul-bereich">Betriebsanweisungen Gefahrstoffe</h2><div class="ul-docs">${dokKnoepfe(bas)}</div>` : ""}
    ${hs.length ? `<h2 class="ul-bereich">Hautschutzpläne</h2><div class="ul-docs">${dokKnoepfe(hs)}</div>` : ""}
    ${sonst.length ? `<h2 class="ul-bereich">Weitere Unterlagen</h2><div class="ul-docs">${dokKnoepfe(sonst)}</div>` : ""}
    <h2 class="ul-bereich">Gefahrstoffe</h2>
    <div class="mg-filter ul-filter"><input type="search" class="uw-suche" id="gsSuche" placeholder="Suchen (Name, Hersteller, H-Satz …)" autocomplete="off">
      ${bereiche.length > 1 ? `<select class="uw-fassung" id="gsBereich"><option value="">Alle Bereiche</option>${bereiche.map(b => `<option>${esc(b)}</option>`).join("")}</select>` : ""}
      <select class="uw-fassung" id="gsSignal"><option value="">Alle Einstufungen</option><option>Gefahr</option><option>Achtung</option></select>
      <label class="gs-nur"><input type="checkbox" id="gsLuecke"> nur mit fehlenden Unterlagen</label>
      <span class="uw-leise" id="gsZahl"></span>
      ${gsDarfPflegen() ? `<button type="button" class="btn sek" id="gsNeu">Stoff aufnehmen</button>` : ""}</div>
    ${aktiv.length ? `<div class="ul-zeilen" id="gsListe">${aktiv.map(zeile).join("")}</div>` : `<div class="leer">Noch kein Gefahrstoffverzeichnis hinterlegt.</div>`}
    ${alt.length ? `<details class="kal-gruppe"><summary><h2 class="ul-bereich">Nicht mehr verwendet <span class="akt-zahl">${alt.length}</span></h2></summary><div class="ul-zeilen">${alt.map(zeile).join("")}</div></details>` : ""}`;
  const filtern = () => {
    const q = (sec.querySelector("#gsSuche").value || "").toLowerCase().trim(), b = (sec.querySelector("#gsBereich") || {}).value || "",
          s = sec.querySelector("#gsSignal").value, l = sec.querySelector("#gsLuecke").checked; let n = 0;
    sec.querySelectorAll("#gsListe .ul-zeile").forEach(z => { const ok = (!q || z.dataset.suche.includes(q)) && (!b || z.dataset.bereiche.split("|").includes(b))
      && (!s || z.dataset.signal === s) && (!l || z.dataset.luecke); z.hidden = !ok; if(ok) n++; });
    sec.querySelector("#gsZahl").textContent = n + (n === 1 ? " Stoff" : " Stoffe");
  };
  ["#gsSuche", "#gsBereich", "#gsSignal", "#gsLuecke"].forEach(id => { const el = sec.querySelector(id); if(el) el.addEventListener(id === "#gsSuche" ? "input" : "change", filtern); });
  filtern();
  const neu = async () => { GS_GELADEN_FUER = null; if(typeof renderSektionen === "function") renderSektionen(); };
  sec.querySelectorAll(".ul-klick").forEach(z => z.addEventListener("click", () => gsKurzinfo(GS_ROWS.find(g => g.id === z.dataset.id), neu)));
  const nb = sec.querySelector("#gsNeu"); if(nb) nb.addEventListener("click", () => gsDialog(null, neu));
}

function gsKurzinfo(g, neu){
  if(!g) return;
  const dlg = ehsDialog("gsDlg", "ul-dlg");
  if(!dlg.dataset.zu){ dlg.dataset.zu = "1"; dlg.addEventListener("click", ev => { if(ev.target === dlg) dlg.close(); }); }
  const feld = (l, v) => (v != null && v !== "") ? `<dt>${l}</dt><dd>${esc(v)}</dd>` : "";
  const docs = [g.sdb_pfad ? gsOeffnen(g.sdb_pfad, "Sicherheitsdatenblatt") : "",
                ...(g.ba_pfade || []).map(p => gsOeffnen(p, "BA " + gsDokTitel(p))),
                g.gbu_pfad ? gsOeffnen(g.gbu_pfad, "Gefährdungsbeurteilung") : ""].filter(Boolean).join("");
  dlg.innerHTML = `<div class="ul-dlg-inhalt">
      <div class="ul-dlg-kopf"><div><h3>${esc(g.bezeichnung)}</h3><div class="uw-leise">${esc([g.hersteller, g.artikelnummer ? "Art.-Nr. " + g.artikelnummer : ""].filter(Boolean).join(" · "))}</div></div>
        <button type="button" class="dok-zu ul-dlg-zu" aria-label="Schließen">✕</button></div>
      ${gsPiktogramme(g.h_saetze).length ? `<div class="gs-piktos-gross">${gsPiktogramme(g.h_saetze).map(k => `<figure><img src="ghs/ghs${k.slice(3)}.png" alt="${esc(k)}"><figcaption>${esc(k)}<br>${esc(GS_GHS_NAME[k])}</figcaption></figure>`).join("")}</div>` : ""}
      ${g.signalwort ? `<div class="ul-risiko ${g.signalwort === "Gefahr" ? "ul-gefahr" : "ul-besorgnis"}">Signalwort: ${esc(g.signalwort)}</div>` : ""}
      ${g.hinweis ? `<div class="ul-hinweis">${esc(g.hinweis)}</div>` : ""}
      ${!g.aktiv ? `<div class="ul-hinweis">Wird nicht mehr verwendet.</div>` : ""}
      <dl class="ul-dl">${feld("Bereiche", (g.bereiche || []).join(", "))}${feld("Verwendung", g.verwendung)}${feld("Menge", g.menge)}${feld("Lagerort", g.lagerort)}
        ${feld("Sicherheitsdatenblatt", g.sdb_pfad ? (g.sdb_ausgabe ? "Ausgabe " + ehsDatum(g.sdb_ausgabe) : "vorhanden") : "fehlt – beim Lieferanten anfordern")}</dl>
      ${(g.h_saetze || []).length ? `<h4 class="ul-h4">Gefahrenhinweise</h4><ul class="gs-hliste">${g.h_saetze.map(h => `<li><b>${esc(h)}</b> ${esc(GS_H[h] || "")}</li>`).join("")}</ul>
        <p class="uw-leise gs-pikto-hinweis">Piktogramme nach CLP-Verordnung aus den H-Sätzen abgeleitet – verbindlich sind Etikett und Sicherheitsdatenblatt (Abschnitt 2.2).</p>` : ""}
      <h4 class="ul-h4">Dokumente</h4>
      <div class="ul-docs">${docs || '<span class="uw-leise">Keine Dokumente hinterlegt.</span>'}</div>
      ${g.gbu_pfad ? "" : `<p class="uw-leise gs-gbu-hinweis">Gefährdungsbeurteilung für Tätigkeiten mit diesem Stoff (§ 6 GefStoffV) ist noch nicht hinterlegt.</p>`}
      ${gsDarfPflegen() ? `<div class="pw-akt" style="margin-top:14px"><button type="button" class="btn sek" id="gsAendern">ändern</button></div>` : ""}
    </div>`;
  dlg.querySelector(".ul-dlg-zu").addEventListener("click", () => dlg.close());
  dlg.querySelectorAll('a[target="_blank"]').forEach(a => a.addEventListener("click", () => dlg.close()));
  const ae = dlg.querySelector("#gsAendern"); if(ae) ae.addEventListener("click", () => { dlg.close(); gsDialog(g, neu); });
  if(!dlg.open) dlg.showModal();
}

function gsDialog(g, danach){
  const dlg = ehsDialog("gsEditDlg", "gs-edit");
  const w = f => g ? (g[f] == null ? "" : g[f]) : "";
  const bas = gsDokumente().filter(d => /^Betriebsanweisung/.test(d.titel));
  const gewaehlt = new Set(g ? (g.ba_pfade || []) : []);
  dlg.innerHTML = `<form method="dialog">
      <h3>${g ? "Gefahrstoff ändern" : "Gefahrstoff aufnehmen"}</h3>
      <label>Bezeichnung (Handelsname)<input type="text" id="gsName" maxlength="200" value="${esc(w("bezeichnung"))}"></label>
      <div class="ehs-zwei"><label>Hersteller / Lieferant<input type="text" id="gsHerst" maxlength="200" value="${esc(w("hersteller"))}"></label>
        <label>Signalwort<select id="gsSig"><option value="">–</option>${["Gefahr", "Achtung"].map(s => `<option${s === w("signalwort") ? " selected" : ""}>${s}</option>`).join("")}</select></label></div>
      <label>H-Sätze (mit Leerzeichen getrennt)<input type="text" id="gsH" value="${esc((g ? g.h_saetze || [] : []).join(" "))}" placeholder="H225 H319"></label>
      <label>Bereiche (mit Komma getrennt)<input type="text" id="gsBer" value="${esc((g ? g.bereiche || [] : []).join(", "))}" placeholder="Produktion, Instandhaltung"></label>
      <label>Verwendung<input type="text" id="gsVerw" maxlength="300" value="${esc(w("verwendung"))}"></label>
      <div class="ehs-zwei"><label>Menge pro Jahr<input type="text" id="gsMenge" maxlength="100" value="${esc(w("menge"))}"></label>
        <label>Lagerort<input type="text" id="gsLager" maxlength="200" value="${esc(w("lagerort"))}"></label></div>
      ${bas.length ? `<div class="gs-ba-wahl"><div class="uw-lab">Betriebsanweisungen</div>${bas.map(d => `<label class="ehs-check"><input type="checkbox" value="${esc(d.storage_path)}"${gewaehlt.has(d.storage_path) ? " checked" : ""}> ${esc(String(d.titel).replace(/^Betriebsanweisung\s*–\s*/, ""))}</label>`).join("")}</div>` : ""}
      <label>Sicherheitsdatenblatt (PDF) ${g && g.sdb_pfad ? "– vorhanden, neue Datei ersetzt es" : ""}<input type="file" id="gsSdb" accept=".pdf"></label>
      <label>Ausgabedatum SDB<input type="date" id="gsAusgabe" value="${esc(w("sdb_ausgabe"))}"></label>
      <label>Hinweis<input type="text" id="gsHinweis" maxlength="300" value="${esc(w("hinweis"))}"></label>
      ${g ? `<label class="ehs-check"><input type="checkbox" id="gsAlt"${g.aktiv ? "" : " checked"}> wird nicht mehr verwendet</label>` : ""}
      <p class="pw-msg" id="gsMsg"></p>
      <div class="pw-akt"><button type="button" class="btn sek" id="gsAbbruch">Abbrechen</button><button type="submit" class="btn">Speichern</button></div>
    </form>`;
  const msg = dlg.querySelector("#gsMsg");
  dlg.querySelector("#gsAbbruch").addEventListener("click", () => dlg.close());
  dlg.querySelector("form").addEventListener("submit", async ev => {
    ev.preventDefault(); msg.className = "pw-msg";
    const name = dlg.querySelector("#gsName").value.trim();
    if(name.length < 2){ msg.textContent = "Bitte die Bezeichnung eintragen."; msg.classList.add("fehler"); return; }
    const datei = dlg.querySelector("#gsSdb").files[0];
    if(datei && !/\.pdf$/i.test(datei.name)){ msg.textContent = "Bitte das Sicherheitsdatenblatt als PDF wählen."; msg.classList.add("fehler"); return; }
    try{
      msg.textContent = "Wird gespeichert …";
      let sdb = g ? g.sdb_pfad : null;
      if(datei) sdb = await ehsHochladen(datei, AKTIV + "/gefahrstoffe/sdb/" + Date.now() + "-" + ehsDateiName(datei));
      const h = [...new Set((dlg.querySelector("#gsH").value.toUpperCase().match(/H\d{3}[A-Z]{0,2}/g) || []))].sort();
      const alt = dlg.querySelector("#gsAlt");
      const daten = { bezeichnung: name, hersteller: dlg.querySelector("#gsHerst").value.trim() || null, signalwort: dlg.querySelector("#gsSig").value || null,
        h_saetze: h, bereiche: dlg.querySelector("#gsBer").value.split(",").map(s => s.trim()).filter(Boolean),
        verwendung: dlg.querySelector("#gsVerw").value.trim() || null, menge: dlg.querySelector("#gsMenge").value.trim() || null,
        lagerort: dlg.querySelector("#gsLager").value.trim() || null, sdb_pfad: sdb, sdb_ausgabe: dlg.querySelector("#gsAusgabe").value || null,
        ba_pfade: [...dlg.querySelectorAll(".gs-ba-wahl input:checked")].map(x => x.value), hinweis: dlg.querySelector("#gsHinweis").value.trim() || null,
        aktiv: alt ? !alt.checked : true, quelle: "portal", geaendert_von: window.__oakName || "", geaendert_am: new Date().toISOString() };
      if(g) await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_gefahrstoff", Object.assign({ kunde_slug: AKTIV }, daten), "return=minimal");
      dlg.close(); if(danach) danach();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.className = "pw-msg fehler"; }
  });
  dlg.showModal();
}

/* OAK EHS-Cockpit — Gefahrstoffkataster (Nikolai 17.09.2026: „Gefahrstoffkataster mit Dokumenten (SDB, GBU, BA)").
   Daten: portal_gefahrstoff (Verzeichnis nach § 6 GefStoffV, eingespielt mit tools/gefahrstoffe_portal.py), Dokumente der
   Kategorie „gefahrstoffe" (Betriebsanweisungen, Hautschutzpläne). Aufbau wie das Anlagenkataster: Liste mit Suche und Filter,
   Klick öffnet die Kurzinfo mit H-Sätzen und den Dokumenten. Pflegen dürfen OAK und die Fachkraft des Betriebs.
   17.09.2026 nachmittags (Nikolai): veraltetes SDB direkt in der Liste; Sammel-BA und Hautschutzpläne nur über Knöpfe;
   je Stoff eine eigene BA auf Grundlage der GBU nach EMKG (Spalten ba_pfad, gbu_pfad) – bis dahin gelten die Sammel-BA. */
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

/* Sicherheitsdatenblatt veraltet? Betriebliche Prüfregel (references/gefahrstoffe/gefahrstoffe.md): Fassung höchstens 2 Jahre alt.
   Eine feste gesetzliche Frist gibt es nicht – der Lieferant muss das SDB bei neuen Erkenntnissen aktualisieren (Art. 31 Abs. 9 REACH).
   Stichtag = jüngeres Datum aus Überarbeitungsdatum des SDB und „beim Lieferanten nachgefragt, keine neuere Fassung". */
const GS_SDB_JAHRE = 2;
function gsSdbStand(g){
  if(!g.sdb_pfad) return { klasse: "kritisch", kurz: "SDB fehlt", text: "Sicherheitsdatenblatt fehlt – beim Lieferanten anfordern." };
  const bezug = [g.sdb_ausgabe, g.sdb_geprueft_am].filter(Boolean).sort().pop();
  if(!bezug) return { klasse: "warnung", kurz: "SDB-Datum unbekannt", text: "Überarbeitungsdatum des Sicherheitsdatenblatts unbekannt – Fassung prüfen." };
  const grenze = new Date(); grenze.setFullYear(grenze.getFullYear() - GS_SDB_JAHRE);
  const alt = String(bezug) < grenze.toISOString().slice(0, 10);
  const stand = (g.sdb_ausgabe ? "Fassung " + ehsDatum(g.sdb_ausgabe) : "Fassung ohne Datum") + (g.sdb_geprueft_am ? " · geprüft " + ehsDatum(g.sdb_geprueft_am) + (g.sdb_geprueft_von ? " (" + g.sdb_geprueft_von + ")" : "") : "");
  return alt
    ? { klasse: "warnung", kurz: "SDB veraltet", text: "Sicherheitsdatenblatt älter als " + GS_SDB_JAHRE + " Jahre (" + stand + ") – beim Lieferanten die aktuelle Fassung anfordern." }
    : { klasse: "gut", kurz: "SDB " + ehsDatum(g.sdb_ausgabe), text: stand };
}
function gsLuecken(g){ return [g.gbu_pfad ? "" : "GBU", g.ba_pfad ? "" : "BA"].filter(Boolean); }

async function renderGefahrstoffe(wrap){
  const sec = document.createElement("section"); sec.className = "sektion ul-liste-seite gs-seite";
  sec.innerHTML = `<div class="ck-fuss">Gefahrstoffkataster wird geladen …</div>`;
  wrap.appendChild(sec);
  await gsLaden(true);
  const aktiv = GS_ROWS.filter(g => g.aktiv), alt = GS_ROWS.filter(g => !g.aktiv);
  const docs = gsDokumente();
  const bas = docs.filter(d => /^Betriebsanweisung/.test(d.titel)), hs = docs.filter(d => /^Hautschutz/i.test(d.titel)), sonst = docs.filter(d => !bas.includes(d) && !hs.includes(d));
  const bereiche = [...new Set(aktiv.flatMap(g => g.bereiche || []))].sort((a, b) => a.localeCompare(b, "de"));
  const sdbProblem = aktiv.filter(g => gsSdbStand(g).klasse !== "gut").length;
  const zeile = g => { const st = gsSdbStand(g), l = gsLuecken(g);
    return `<div class="ul-zeile ul-klick" data-id="${esc(g.id)}" data-suche="${esc([g.bezeichnung, g.hersteller, g.verwendung, g.artikelnummer, (g.h_saetze || []).join(" ")].filter(Boolean).join(" ").toLowerCase())}"
      data-bereiche="${esc((g.bereiche || []).join("|"))}" data-signal="${esc(g.signalwort || "")}" data-sdb="${st.klasse}" data-gbu="${g.gbu_pfad ? "1" : ""}" data-ba="${g.ba_pfad ? "1" : ""}">
      <span class="gs-signal gs-${g.signalwort === "Gefahr" ? "gefahr" : g.signalwort === "Achtung" ? "achtung" : "ohne"}">${esc(g.signalwort || "–")}</span>
      <span class="gs-piktos">${gsPiktoHtml(g.h_saetze)}</span>
      <div class="ul-z-name"><b>${esc(g.bezeichnung)}</b><span>${esc([g.hersteller, (g.bereiche || []).join(", ")].filter(Boolean).join(" · "))}</span></div>
      <div class="ul-z-info"><span class="gs-sdb gs-sdb-${st.klasse}" title="${esc(st.text)}">${esc(st.kurz)}</span>
        ${l.length ? `<span class="gs-luecke" title="Stoffbezogene Gefährdungsbeurteilung (EMKG) und Betriebsanweisung">${esc(l.join(" + "))} fehlt</span>` : ""}</div>
      <span class="ul-pfeil" aria-hidden="true">›</span></div>`; };
  sec.innerHTML = `<div class="gs-kopf">
      <p class="uw-erkl">Verzeichnis der verwendeten Gefahrstoffe (§ 6 GefStoffV) · ${aktiv.length} Stoffe${sdbProblem ? ` · <b>${sdbProblem} Sicherheitsdatenblätter prüfen</b>` : ""}</p>
      <div class="gs-dokknoepfe">
        ${bas.length ? `<button type="button" class="btn sek" id="gsBa">Betriebsanweisungen <span class="akt-zahl">${bas.length}</span></button>` : ""}
        ${hs.length ? `<button type="button" class="btn sek" id="gsHs">Hautschutzpläne <span class="akt-zahl">${hs.length}</span></button>` : ""}
        ${sonst.length ? `<button type="button" class="btn sek" id="gsSonst">Weitere Unterlagen <span class="akt-zahl">${sonst.length}</span></button>` : ""}
        ${gsDarfPflegen() ? `<button type="button" class="btn sek" id="gsNeu">Stoff aufnehmen</button>` : ""}</div></div>
    <div class="mg-filter ul-filter"><input type="search" class="uw-suche" id="gsSuche" placeholder="Suchen (Name, Hersteller, H-Satz …)" autocomplete="off">
      ${bereiche.length > 1 ? `<select class="uw-fassung" id="gsBereich"><option value="">Alle Bereiche</option>${bereiche.map(b => `<option>${esc(b)}</option>`).join("")}</select>` : ""}
      <select class="uw-fassung" id="gsSignal"><option value="">Alle Einstufungen</option><option>Gefahr</option><option>Achtung</option></select>
      <select class="uw-fassung" id="gsStand"><option value="">Alle Unterlagen</option><option value="sdb">SDB veraltet oder fehlt</option><option value="gbu">GBU fehlt</option><option value="ba">BA fehlt</option></select>
      <span class="uw-leise" id="gsZahl"></span></div>
    ${aktiv.length ? `<div class="ul-zeilen" id="gsListe">${aktiv.map(zeile).join("")}</div>` : `<div class="leer">Noch kein Gefahrstoffverzeichnis hinterlegt.</div>`}
    ${alt.length ? `<details class="kal-gruppe"><summary><h2 class="ul-bereich">Nicht mehr verwendet <span class="akt-zahl">${alt.length}</span></h2></summary><div class="ul-zeilen">${alt.map(zeile).join("")}</div></details>` : ""}`;
  const filtern = () => {
    const q = (sec.querySelector("#gsSuche").value || "").toLowerCase().trim(), b = (sec.querySelector("#gsBereich") || {}).value || "",
          s = sec.querySelector("#gsSignal").value, u = sec.querySelector("#gsStand").value; let n = 0;
    sec.querySelectorAll("#gsListe .ul-zeile").forEach(z => { const ok = (!q || z.dataset.suche.includes(q)) && (!b || z.dataset.bereiche.split("|").includes(b))
      && (!s || z.dataset.signal === s) && (!u || (u === "sdb" ? z.dataset.sdb !== "gut" : u === "gbu" ? !z.dataset.gbu : !z.dataset.ba)); z.hidden = !ok; if(ok) n++; });
    sec.querySelector("#gsZahl").textContent = n + (n === 1 ? " Stoff" : " Stoffe");
  };
  ["#gsSuche", "#gsBereich", "#gsSignal", "#gsStand"].forEach(id => { const el = sec.querySelector(id); if(el) el.addEventListener(id === "#gsSuche" ? "input" : "change", filtern); });
  filtern();
  const neu = async () => { GS_GELADEN_FUER = null; if(typeof renderSektionen === "function") renderSektionen(); };
  sec.querySelectorAll(".ul-klick").forEach(z => z.addEventListener("click", () => gsKurzinfo(GS_ROWS.find(g => g.id === z.dataset.id), neu)));
  const knopf = (id, titel, liste, hinweis) => { const k = sec.querySelector(id); if(k) k.addEventListener("click", () => gsDokDialog(titel, liste, hinweis)); };
  knopf("#gsBa", "Betriebsanweisungen Gefahrstoffe", bas, "Sammel-Betriebsanweisungen nach Stoffgruppen. Je Gefahrstoff entsteht eine eigene Betriebsanweisung auf Grundlage der Gefährdungsbeurteilung nach EMKG – sie steht dann direkt beim Stoff.");
  knopf("#gsHs", "Hautschutzpläne", hs, "Vorlagen – Hautschutz-, Reinigungs- und Pflegemittel (Hersteller, Präparat) sind noch nicht eingetragen.");
  knopf("#gsSonst", "Weitere Unterlagen", sonst, "");
  const nb = sec.querySelector("#gsNeu"); if(nb) nb.addEventListener("click", () => gsDialog(null, neu));
}

function gsDokDialog(titel, liste, hinweis){
  const dlg = ehsDialog("gsDokDlg");
  dlg.innerHTML = `<form method="dialog"><h3>${esc(titel)}</h3>${hinweis ? `<p class="pw-hint">${esc(hinweis)}</p>` : ""}
      <div class="gs-dokliste">${liste.map(d => `<a class="gs-dok" href="${viewerUrl(d.doc_typ || "pdf", d.storage_path, d.titel)}" target="_blank" rel="noopener">${esc(String(d.titel).replace(/^Betriebsanweisung\s*–\s*/, ""))}<span aria-hidden="true">›</span></a>`).join("")}</div>
      <div class="pw-akt"><button type="button" class="btn sek" id="gsDokZu">Schließen</button></div></form>`;
  dlg.querySelector("#gsDokZu").addEventListener("click", () => dlg.close());
  dlg.querySelectorAll("a.gs-dok").forEach(a => a.addEventListener("click", () => dlg.close()));
  dlg.showModal();
}

function gsKurzinfo(g, neu){
  if(!g) return;
  const dlg = ehsDialog("gsDlg", "ul-dlg");
  if(!dlg.dataset.zu){ dlg.dataset.zu = "1"; dlg.addEventListener("click", ev => { if(ev.target === dlg) dlg.close(); }); }
  const feld = (l, v) => (v != null && v !== "") ? `<dt>${l}</dt><dd>${esc(v)}</dd>` : "";
  const st = gsSdbStand(g), pflege = gsDarfPflegen();
  const sammel = (g.ba_pfade || []).map(p => gsOeffnen(p, gsDokTitel(p), "btn-klein")).join(" ");
  dlg.innerHTML = `<div class="ul-dlg-inhalt">
      <div class="ul-dlg-kopf"><div><h3>${esc(g.bezeichnung)}</h3><div class="uw-leise">${esc([g.hersteller, g.artikelnummer ? "Art.-Nr. " + g.artikelnummer : ""].filter(Boolean).join(" · "))}</div></div>
        <button type="button" class="dok-zu ul-dlg-zu" aria-label="Schließen">✕</button></div>
      ${gsPiktogramme(g.h_saetze).length ? `<div class="gs-piktos-gross">${gsPiktogramme(g.h_saetze).map(k => `<figure><img src="ghs/ghs${k.slice(3)}.png" alt="${esc(k)}"><figcaption>${esc(k)}<br>${esc(GS_GHS_NAME[k])}</figcaption></figure>`).join("")}</div>` : ""}
      ${g.signalwort ? `<div class="ul-risiko ${g.signalwort === "Gefahr" ? "ul-gefahr" : "ul-besorgnis"}">Signalwort: ${esc(g.signalwort)}</div>` : ""}
      ${!g.aktiv ? `<div class="ul-hinweis">Wird nicht mehr verwendet.</div>` : ""}
      <dl class="ul-dl">${feld("Bereiche", (g.bereiche || []).join(", "))}${feld("Verwendung", g.verwendung)}${feld("Menge", g.menge)}${feld("Lagerort", g.lagerort)}</dl>
      <h4 class="ul-h4">Sicherheitsdatenblatt</h4>
      <div class="gs-sdb-block gs-sdb-${st.klasse}"><span>${esc(st.text)}</span>
        <span class="gs-sdb-akt">${g.sdb_pfad ? gsOeffnen(g.sdb_pfad, "Öffnen", "btn-klein") : ""}
          ${pflege && g.sdb_pfad && st.klasse !== "gut" ? `<button type="button" class="btn-klein" id="gsGeprueft">Aktualität geprüft</button>` : ""}
          ${pflege ? `<button type="button" class="btn-klein" id="gsNeueFassung">Neue Fassung hochladen</button>` : ""}</span></div>
      <h4 class="ul-h4">Gefährdungsbeurteilung und Betriebsanweisung</h4>
      <div class="gs-doks">
        <div>${g.gbu_pfad ? gsOeffnen(g.gbu_pfad, "Gefährdungsbeurteilung") : `<span class="gs-luecke">Gefährdungsbeurteilung (EMKG) fehlt</span>`}</div>
        <div>${g.ba_pfad ? gsOeffnen(g.ba_pfad, "Betriebsanweisung") : `<span class="gs-luecke">Stoffbezogene Betriebsanweisung fehlt</span>`}</div>
      </div>
      ${!g.ba_pfad && sammel ? `<p class="uw-leise gs-sammel">Bis dahin gelten die Sammel-Betriebsanweisungen: ${sammel}</p>` : ""}
      ${(g.h_saetze || []).length ? `<h4 class="ul-h4">Gefahrenhinweise</h4><ul class="gs-hliste">${g.h_saetze.map(h => `<li><b>${esc(h)}</b> ${esc(GS_H[h] || "")}</li>`).join("")}</ul>
        <p class="uw-leise gs-pikto-hinweis">Piktogramme nach CLP-Verordnung aus den H-Sätzen abgeleitet – verbindlich sind Etikett und Sicherheitsdatenblatt (Abschnitt 2.2).</p>` : ""}
      ${pflege ? `<div class="pw-akt" style="margin-top:14px"><button type="button" class="btn sek" id="gsAendern">ändern</button></div>` : ""}
    </div>`;
  dlg.querySelector(".ul-dlg-zu").addEventListener("click", () => dlg.close());
  dlg.querySelectorAll('a[target="_blank"]').forEach(a => a.addEventListener("click", () => dlg.close()));
  const ae = dlg.querySelector("#gsAendern"); if(ae) ae.addEventListener("click", () => { dlg.close(); gsDialog(g, neu); });
  const nf = dlg.querySelector("#gsNeueFassung"); if(nf) nf.addEventListener("click", () => { dlg.close(); gsDialog(g, neu, "sdb"); });
  const gp = dlg.querySelector("#gsGeprueft");
  if(gp) gp.addEventListener("click", async () => {
    const wer = (window.__oakName && !ehsGemeinsamerZugang()) ? window.__oakName : prompt("Beim Lieferanten nachgefragt – es gibt keine neuere Fassung.\nIhr Name:", ehsVorname());
    if(!wer || wer.trim().length < 3) return;
    try{
      await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), { sdb_geprueft_am: ehsHeute(), sdb_geprueft_von: wer.trim(),
        quelle: "portal", geaendert_von: wer.trim(), geaendert_am: new Date().toISOString() }, "return=minimal");
      dlg.close(); if(neu) neu();
    }catch(e){ alert("Konnte nicht gespeichert werden: " + (e.message || e)); }
  });
  if(!dlg.open) dlg.showModal();
}

function gsDialog(g, danach, fokus){
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
      <fieldset class="gs-feld" id="gsSdbFeld"><legend>Sicherheitsdatenblatt</legend>
        <label>PDF ${g && g.sdb_pfad ? "– vorhanden, neue Datei ersetzt es" : ""}<input type="file" id="gsSdb" accept=".pdf"></label>
        <label>Überarbeitungsdatum (steht auf Seite 1)<input type="date" id="gsAusgabe" value="${esc(w("sdb_ausgabe"))}" max="${ehsHeute()}"></label></fieldset>
      <fieldset class="gs-feld"><legend>Gefährdungsbeurteilung und Betriebsanweisung für diesen Stoff</legend>
        <label>Gefährdungsbeurteilung (PDF) ${g && g.gbu_pfad ? "– vorhanden" : ""}<input type="file" id="gsGbu" accept=".pdf"></label>
        <label>Betriebsanweisung (PDF) ${g && g.ba_pfad ? "– vorhanden" : ""}<input type="file" id="gsBaStoff" accept=".pdf"></label></fieldset>
      ${bas.length ? `<fieldset class="gs-feld gs-ba-wahl"><legend>Sammel-Betriebsanweisungen (bis zur stoffbezogenen BA)</legend>${bas.map(d => `<label class="ehs-check"><input type="checkbox" value="${esc(d.storage_path)}"${gewaehlt.has(d.storage_path) ? " checked" : ""}> ${esc(String(d.titel).replace(/^Betriebsanweisung\s*–\s*/, ""))}</label>`).join("")}</fieldset>` : ""}
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
    const datei = id => dlg.querySelector(id).files[0];
    const sdb = datei("#gsSdb"), gbu = datei("#gsGbu"), baStoff = datei("#gsBaStoff");
    if([sdb, gbu, baStoff].some(f => f && !/\.pdf$/i.test(f.name))){ msg.textContent = "Bitte nur PDF-Dateien wählen."; msg.classList.add("fehler"); return; }
    if(sdb && !dlg.querySelector("#gsAusgabe").value){ msg.textContent = "Bitte das Überarbeitungsdatum des neuen Sicherheitsdatenblatts eintragen."; msg.classList.add("fehler"); return; }
    try{
      msg.textContent = "Wird gespeichert …";
      const hoch = async (f, ordner) => ehsHochladen(f, AKTIV + "/gefahrstoffe/" + ordner + "/" + Date.now() + "-" + ehsDateiName(f));
      const h = [...new Set((dlg.querySelector("#gsH").value.toUpperCase().match(/H\d{3}[A-Z]{0,2}/g) || []))].sort();
      const alt = dlg.querySelector("#gsAlt");
      const daten = { bezeichnung: name, hersteller: dlg.querySelector("#gsHerst").value.trim() || null, signalwort: dlg.querySelector("#gsSig").value || null,
        h_saetze: h, bereiche: dlg.querySelector("#gsBer").value.split(",").map(s => s.trim()).filter(Boolean),
        verwendung: dlg.querySelector("#gsVerw").value.trim() || null, menge: dlg.querySelector("#gsMenge").value.trim() || null,
        lagerort: dlg.querySelector("#gsLager").value.trim() || null, sdb_ausgabe: dlg.querySelector("#gsAusgabe").value || null,
        ba_pfade: [...dlg.querySelectorAll(".gs-ba-wahl input:checked")].map(x => x.value), hinweis: dlg.querySelector("#gsHinweis").value.trim() || null,
        aktiv: alt ? !alt.checked : true, quelle: "portal", geaendert_von: window.__oakName || "", geaendert_am: new Date().toISOString() };
      if(sdb){ daten.sdb_pfad = await hoch(sdb, "sdb"); daten.sdb_geprueft_am = null; daten.sdb_geprueft_von = null; }
      if(gbu) daten.gbu_pfad = await hoch(gbu, "gbu");
      if(baStoff) daten.ba_pfad = await hoch(baStoff, "ba-stoff");
      if(g) await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), daten, "return=minimal");
      else await apiSend("POST", "/rest/v1/portal_gefahrstoff", Object.assign({ kunde_slug: AKTIV }, daten), "return=minimal");
      dlg.close(); if(danach) danach();
    }catch(e){ msg.textContent = "Konnte nicht gespeichert werden: " + (e.message || e); msg.className = "pw-msg fehler"; }
  });
  dlg.showModal();
  if(fokus === "sdb"){ const f = dlg.querySelector("#gsSdbFeld"); if(f){ f.scrollIntoView({ block: "center" }); f.classList.add("gs-fokus"); } }
}

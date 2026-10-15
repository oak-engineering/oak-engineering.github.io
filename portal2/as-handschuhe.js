/* Handschuhplan (15.10.2026): welcher Schutzhandschuh für welchen Gefahrstoff – je Bereich, aus dem Kataster.
   Daten: portal_handschuh (Handschuhe des Betriebs, je Bereich) · portal_gefahrstoff.handschuh_ids / handschuh_status /
   handschuh_hinweis / handschuh_sdb (Anforderung laut SDB Abschnitt 8.2). Im Plan eines Bereichs gilt der zugeordnete
   Handschuh, der diesem Bereich gehört – fehlt er dort, steht „Passender Handschuh fehlt“ mit der SDB-Anforderung.
   Grundlage: GefStoffV § 7, TRGS 401, SDB Abschnitt 8.2. */
"use strict";

const AS_HS_STATUS = { passt: "geeignet", spritzschutz: "nur Spritzschutz", fehlt: "passender Handschuh fehlt", nicht_noetig: "kein Schutzhandschuh nötig" };
const AS_HS = { bereich: "" };

AS_SEITEN.gefahrstoffe = { titel: "Gefahrstoffe", icon: "◬", sort: 4.65, async render(main){
  const r = asReiter("gefahrstoffe", [["kataster", "Kataster"], ["handschuhe", "Handschuhplan"]], "kataster");
  main.innerHTML = `<h1 class="seite nodruck">Gefahrstoffe</h1>${r.html}<div id="gsInhalt"></div>`;
  const box = document.getElementById("gsInhalt");
  if(r.akt === "handschuhe") return asHsRender(box);
  box.innerHTML = `<p class="unter">Gefahrstoffkataster mit Sicherheitsdatenblättern, Betriebsanweisungen und Gefährdungsbeurteilung – dieselbe Seite wie im Kundenportal.</p>
    <iframe src="../portal/index.html?eingebettet=1&k=${encodeURIComponent(AS.kunde)}#unterlagen/gefahrstoffe" style="width:100%;height:calc(100vh - 250px);min-height:560px;border:1px solid var(--linie);border-radius:10px;background:#fff"></iframe>`;
}};

function asHsStil(){
  if(document.getElementById("hsStil")) return;
  const s = document.createElement("style"); s.id = "hsStil";
  s.textContent = `.hs-karten{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin:8px 0 12px}
.hs-karte{border:2px solid;border-radius:10px;padding:8px;background:#fff;cursor:default}.hs-karte.edit{cursor:pointer}
.hs-karte img{width:100%;height:80px;object-fit:contain;background:#fff;padding:4px}.hs-name{font-weight:800;font-size:17px}
.hs-modell{font-size:12px;color:var(--grau,#667085)}.hs-einsatz{font-size:13px;margin-top:4px}.hs-norm{font-size:11px;color:var(--grau,#667085);margin-top:4px}
.hs-chip{display:inline-flex;align-items:center;gap:6px;color:#fff;font-weight:700;border-radius:20px;padding:2px 10px 2px 2px;font-size:12px;margin:1px 4px 1px 0}
.hs-chip img{width:22px;height:22px;border-radius:50%;object-fit:cover;background:#fff}.hs-chip.ohne{padding:3px 10px}
.hs-fehlt{background:#b42318}.hs-nein{background:#98a2b3}.hs-sdb{font-size:11px;color:var(--grau,#667085)}
tr.hs-rot td{background:#fef3f2}.hs-bereich{margin-bottom:18px}
@media print{.hs-bereich{break-after:page;border:0}.hs-karte img{height:70px}table.tab{font-size:11px}}`;
  document.head.appendChild(s);
}

async function asHsLaden(){
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const [hs, gs] = await Promise.all([
    apiGet("/rest/v1/portal_handschuh?select=*&aktiv=is.true&order=sortierung.asc,name.asc" + k).catch(() => []),
    apiGet("/rest/v1/portal_gefahrstoff?select=id,bezeichnung,hersteller,verwendung_status,aktiv,einheit_ids,h_saetze,sdb_pfad,handschuh_ids,handschuh_status,handschuh_hinweis,handschuh_sdb&order=bezeichnung.asc" + k).catch(() => [])]);
  return { hs: hs || [], gs: (gs || []).filter(g => (g.verwendung_status || (g.aktiv === false ? "inaktiv" : "aktiv")) !== "inaktiv") };
}

function asHsChip(h, zusatz){
  return `<span class="hs-chip" style="background:${esc(h.farbe || "#2D6A4F")}">${h.bild_url ? `<img src="${esc(h.bild_url)}" alt="">` : ""}${esc(h.name)}</span>${zusatz ? `<span class="hs-sdb">${esc(zusatz)}</span>` : ""}`;
}

async function asHsRender(box){
  asHsStil();
  box.innerHTML = `<div class="leer">wird geladen …</div>`;
  const { hs, gs } = await asHsLaden();
  const einh = (AS.bereich.einheiten || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(b.name));
  const mitStoff = einh.filter(e => gs.some(g => (g.einheit_ids || []).includes(e.id)));
  if(AS_HS.bereich && !mitStoff.some(e => e.id === AS_HS.bereich)) AS_HS.bereich = "";
  const zeigen = AS_HS.bereich ? mitStoff.filter(e => e.id === AS_HS.bereich) : mitStoff;
  const edit = AS.fachkraft;

  const abschnitt = e => {
    const hsB = hs.filter(h => (h.einheit_ids || []).includes(e.id));
    const st = gs.filter(g => (g.einheit_ids || []).includes(e.id));
    const zeile = g => {
      const status = g.handschuh_status || "";
      const passend = hsB.filter(h => (g.handschuh_ids || []).includes(h.id));
      let zelle, rot = false;
      if(status === "nicht_noetig") zelle = `<span class="hs-chip ohne hs-nein">kein Schutzhandschuh nötig</span>`;
      else if(passend.length) zelle = passend.map(h => asHsChip(h)).join("") + (status === "spritzschutz" ? `<div class="hs-sdb">nur Spritzschutz – nach Kontakt sofort wechseln</div>` : "");
      else if(!g.sdb_pfad && !g.handschuh_sdb){ zelle = `<span class="hs-chip ohne hs-nein">Sicherheitsdatenblatt fehlt</span>`; }
      else { zelle = `<span class="hs-chip ohne hs-fehlt">passender Handschuh fehlt</span>`; rot = true; }
      return `<tr class="${rot ? "hs-rot" : ""}"><td><b>${esc(g.bezeichnung)}</b>${g.hersteller ? `<div class="hs-sdb">${esc(g.hersteller)}</div>` : ""}</td>
        <td>${zelle}</td><td>${g.handschuh_hinweis ? esc(g.handschuh_hinweis) : ""}${g.handschuh_sdb ? `<div class="hs-sdb">SDB 8.2: ${esc(g.handschuh_sdb)}</div>` : ""}</td>
        ${edit ? `<td class="nodruck"><button class="btn klein sek" data-hsz="${esc(g.id)}">Zuordnen</button></td>` : ""}</tr>`;
    };
    const fehlt = st.filter(g => g.handschuh_status !== "nicht_noetig" && !hsB.some(h => (g.handschuh_ids || []).includes(h.id)) && (g.sdb_pfad || g.handschuh_sdb)).length;
    return `<div class="karte hs-bereich"><h2>Handschuhplan ${esc(e.name)} <span class="hs-sdb">${st.length} Stoffe${fehlt ? ` · <b style="color:#b42318">${fehlt} ohne passenden Handschuh</b>` : ""}</span></h2>
      <div class="hs-karten">${hsB.length ? hsB.map(h => `<div class="hs-karte ${edit ? "edit" : ""}" data-hs="${esc(h.id)}" style="border-color:${esc(h.farbe || "#2D6A4F")}">
        ${h.bild_url ? `<img src="${esc(h.bild_url)}" alt="">` : ""}<div class="hs-name" style="color:${esc(h.farbe || "#2D6A4F")}">${esc(h.name)}</div>
        <div class="hs-modell">${esc([h.modell, h.artikel].filter(Boolean).join(" · "))}</div><div class="hs-einsatz">${esc(h.einsatz || "")}</div>
        <div class="hs-norm">${esc([h.material, h.normen].filter(Boolean).join(" · "))}</div></div>`).join("")
        : `<div class="leer">Für diesen Bereich ist noch kein Handschuh erfasst.</div>`}</div>
      <div class="tabwrap"><table class="tab"><thead><tr><th style="width:32%">Stoff</th><th style="width:28%">Handschuh</th><th>Hinweis</th>${edit ? `<th class="nodruck"></th>` : ""}</tr></thead>
      <tbody>${st.map(zeile).join("")}</tbody></table></div>
      <p class="hs-sdb">Grundlage: GefStoffV § 7, TRGS 401, Sicherheitsdatenblätter Abschnitt 8.2. Handschuh vor Gebrauch auf Schäden prüfen; nach Kontakt mit dem Stoff wechseln. Stand ${esc(new Date().toLocaleDateString("de-DE"))}.</p></div>`;
  };

  box.innerHTML = `<div class="nodruck" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 10px">
      <select id="hsBereich"><option value="">Alle Bereiche (${mitStoff.length})</option>${mitStoff.map(e => `<option value="${esc(e.id)}" ${e.id === AS_HS.bereich ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select>
      <button class="btn sek klein" id="hsDruck">Drucken</button>${edit ? `<button class="btn klein" id="hsNeu">+ Handschuh</button>` : ""}
      <span class="hinweis">Welcher Handschuh für welchen Stoff – je Bereich, direkt aus dem Gefahrstoffkataster.</span></div>
    ${zeigen.length ? zeigen.map(abschnitt).join("") : `<div class="karte"><div class="leer">Keine Gefahrstoffe mit Bereich erfasst.</div></div>`}`;

  box.querySelector("#hsBereich").onchange = ev => { AS_HS.bereich = ev.target.value; asHsRender(box); };
  box.querySelector("#hsDruck").onclick = () => window.print();
  if(!edit) return;
  box.querySelector("#hsNeu").onclick = () => asHsHandschuhDialog(null, einh, box);
  box.querySelectorAll("[data-hs]").forEach(el => el.onclick = () => asHsHandschuhDialog(hs.find(h => h.id === el.dataset.hs), einh, box));
  box.querySelectorAll("[data-hsz]").forEach(el => el.onclick = () => asHsZuordnen(gs.find(g => g.id === el.dataset.hsz), hs, einh, box));
}

function asHsHandschuhDialog(h, einh, box){
  const neu = !h; h = h || { farbe: "#2D6A4F", einheit_ids: AS_HS.bereich ? [AS_HS.bereich] : [] };
  const kn = [{ t: "Speichern", fn: async dl => {
    const w = asWerte(dl);
    if(!w.name){ asMeldung("Bitte einen Kurznamen vergeben (z. B. „LILA“)"); return false; }
    w.einheit_ids = [...dl.querySelectorAll("[data-he]:checked")].map(x => x.dataset.he);
    w.geaendert_von = AS.ich; w.geaendert_am = new Date().toISOString();
    if(neu) await apiSend("POST", "/rest/v1/portal_handschuh", Object.assign({ kunde_slug: AS.kunde }, w), "return=minimal");
    else await apiSend("PATCH", "/rest/v1/portal_handschuh?id=eq." + encodeURIComponent(h.id), w, "return=minimal");
    asMeldung("Gespeichert"); asHsRender(box);
  } }];
  if(!neu) kn.unshift({ t: "Ausmustern", klasse: "gefahr", fn: async () => {
    if(!confirm("Handschuh ausmustern? Er verschwindet aus dem Plan.")) return false;
    await apiSend("PATCH", "/rest/v1/portal_handschuh?id=eq." + encodeURIComponent(h.id), { aktiv: false }, "return=minimal"); asHsRender(box); } });
  asDialog({ titel: neu ? "Handschuh erfassen" : "Handschuh: " + h.name, breit: true, knoepfe: kn, inhalt: `<div class="form">
    ${asFeld("Kurzname für Beschäftigte (z. B. Farbe: „LILA“)", "name", h.name)}
    ${asFeld("Anzeigefarbe", "farbe", h.farbe, "color")}
    ${asFeld("Modell", "modell", h.modell)}${asFeld("Artikelnummer", "artikel", h.artikel)}
    ${asFeld("Material", "material", h.material)}${asFeld("Normen / Kennzeichnung (EN ISO 374-1 Typ …)", "normen", h.normen, "text", "voll")}
    ${asFeld("Chemikalienschutz (EN ISO 374-1)", "chemikalienschutz", h.chemikalienschutz, "checkbox")}
    ${asFeld("Merksatz für Beschäftigte", "einsatz", h.einsatz, "textarea", "voll")}
    ${asFeld("Bild-Adresse (URL)", "bild_url", h.bild_url, "text", "voll")}
    <div class="voll"><b>Bereiche, in denen der Handschuh ausliegt</b><div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">
      ${einh.map(e => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-he="${esc(e.id)}" ${(h.einheit_ids || []).includes(e.id) ? "checked" : ""}> ${esc(e.name)}</label>`).join("")}</div></div></div>` });
}

function asHsZuordnen(g, hs, einh, box){
  const name = id => (einh.find(e => e.id === id) || {}).name || "";
  asDialog({ titel: "Handschuh für " + g.bezeichnung, breit: true, inhalt: `<div class="form">
    ${g.handschuh_sdb ? `<p class="voll hinweis">Laut Sicherheitsdatenblatt (8.2): ${esc(g.handschuh_sdb)}</p>` : ""}
    <div class="voll"><b>Geeignete Handschuhe</b><div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
      ${hs.length ? hs.map(h => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-hz="${esc(h.id)}" ${(g.handschuh_ids || []).includes(h.id) ? "checked" : ""}>
        ${asHsChip(h)} <span class="hs-sdb">${esc([h.modell, (h.einheit_ids || []).map(name).filter(Boolean).join(", ")].filter(Boolean).join(" · "))}</span></label>`).join("")
        : `<span class="hinweis">Noch keine Handschuhe erfasst – zuerst „+ Handschuh“.</span>`}</div></div>
    ${asAuswahl("Eignung", "handschuh_status", g.handschuh_status || "passt", Object.entries(AS_HS_STATUS))}
    ${asFeld("Hinweis für Beschäftigte", "handschuh_hinweis", g.handschuh_hinweis, "text", "voll")}
    ${asFeld("Anforderung laut SDB 8.2 (Material, Dicke, Durchbruchzeit)", "handschuh_sdb", g.handschuh_sdb, "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async dl => {
      const w = asWerte(dl);
      w.handschuh_ids = [...dl.querySelectorAll("[data-hz]:checked")].map(x => x.dataset.hz);
      w.geaendert_von = AS.ich; w.geaendert_am = new Date().toISOString();
      await apiSend("PATCH", "/rest/v1/portal_gefahrstoff?id=eq." + encodeURIComponent(g.id), w, "return=minimal");
      asMeldung("Gespeichert"); asHsRender(box);
    } }] });
}

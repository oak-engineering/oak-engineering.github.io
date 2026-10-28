/* OAK Arbeitsschutz-App – Vorfälle: Unfälle, Beinahe-Unfälle, unsichere Zustände und Umweltvorfälle.
   Gleiche Daten wie das Kundenportal (portal/vorfaelle.js): portal_vorfaelle, portal_vorfall_melder (nur OAK),
   portal_melde_token (QR-Melder), portal_dokumente (Aushang). Das Kundenportal selbst bleibt unverändert.
   Rechte wie in der Datenbank: OAK legt an und ändert alles. Der Betrieb sieht nur geprüfte Meldungen
   (Status ≠ neu) und darf nur die Auswertung nachtragen (Trigger portal_vorfaelle_nur_auswertung).
   Globale Namen immer mit asVf/AS_VF-Präfix (gemeinsamer Scope aller V2-Skripte). */
"use strict";

const AS_VF_ART = {
  unfall:   { label: "Unfall",             farbe: "rot" },
  beinahe:  { label: "Beinahe-Unfall",     farbe: "gelb" },
  unsicher: { label: "Unsicherer Zustand", farbe: "gruen" },
  umwelt:   { label: "Umweltvorfall",      farbe: "blau" },
};
const AS_VF_STATUS = { neu: "eingegangen – wird geprüft", offen: "offen", bearbeitung: "in Bearbeitung", erledigt: "erledigt" };
const AS_VF_STATUS_FARBE = { neu: "blau", offen: "gelb", bearbeitung: "gelb", erledigt: "gruen" };
const AS_VF_DOMAENE = { arbeitssicherheit: "Arbeitssicherheit", umwelt: "Umwelt", beides: "Arbeitssicherheit + Umwelt" };
const AS_VF_SPALTEN = "id,kunde_slug,kunde,art,domaene,ereignis_am,ereignis_zeit,ort,anlage,beschreibung,verletzte,erste_hilfe,stoff,menge,wohin,"
  + "status,bearbeitung,quelle,angelegt_am,updated_at,ausfalltage,ursache,sofortmassnahme,langzeitmassnahme,ausgewertet_von,ausgewertet_am,"
  + "rueckmeldung,rueckmeldung_am,as_einheit_id";   // Foto (Base64, bis 2,5 MB) erst auf Klick
const AS_VF = { kunde: null, liste: [], melder: {}, token: "", aushang: null, fotos: {}, fehler: "",
  filter: { q: "", art: "", status: "", auswertung: false } };

/* ---------------- Hilfen ---------------- */
function asVfDatum(s){ return s ? asDat(s) : "—"; }
function asVfText(s){ return esc(s == null ? "" : s).replace(/\n/g, "<br>"); }
function asVfBetrieb(){ return (AS.org && AS.org.name) || (AS.kundeV1 && AS.kundeV1.name) || ""; }
/* Das Foto kommt aus einer Meldung ohne Login. Nur echte Bild-Data-URLs rendern –
   sonst wäre ein "javascript:"-Wert im Feld ein Einfallstor (wie im Kundenportal). */
function asVfFotoOk(wert){ return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(wert || "")); }
function asVfFotoHtml(wert){
  if(!asVfFotoOk(wert)) return "";
  const s = esc(wert);
  return `<a href="${s}" target="_blank" rel="noopener"><img src="${s}" alt="Belegfoto zur Meldung" style="max-width:100%;max-height:360px;border-radius:8px;border:1px solid var(--linie);margin-top:8px"></a>`;
}
function asVfIstUmwelt(v){ return v.art === "umwelt" || v.domaene === "umwelt" || v.domaene === "beides"; }
/* Eine Meldung kann beide Bereiche betreffen ("beides") – sie erscheint dann in beiden Reitern (wie V1). */
function asVfBereich(bereich){
  return AS_VF.liste.filter(v => bereich === "umwelt"
    ? (v.domaene === "umwelt" || v.domaene === "beides" || v.art === "umwelt")
    : (v.domaene !== "umwelt" || v.domaene === "beides"));
}
function asVfAusgewertet(v){ return !!(v.ausgewertet_am || v.sofortmassnahme || v.langzeitmassnahme); }
function asVfMelder(v){ return AS.admin ? (AS_VF.melder[v.id] || v.melder || "") : ""; }
/* Wer prüft neue Meldungen? OAK (Standard) oder – je Betrieb einstellbar – die Fachkraft (Plan Portal eigenständig, Schritt 5) */
function asVfVerwalter(){ return !!(AS.admin || (AS.fachkraft && AS_VF.betrieb)); }
function asVfFehlertext(e){ const t = String((e && e.message) || e || "unbekannter Fehler");
  return /nur die auswertung/i.test(t) ? "Diese Angabe darf nur OAK engineering ändern. Der Betrieb trägt die Auswertung nach." : t; }
function asVfMassnahmen(v){ return asT("as_massnahme").filter(m => m.quelle === "meldung" && m.quelle_id === v.id); }

/* ---------------- Daten ---------------- */
async function asVfLaden(neu){
  if(!neu && AS_VF.kunde === AS.kunde) return;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  AS_VF.fehler = "";
  const [rows, tok, docs] = await Promise.all([
    apiGet("/rest/v1/portal_vorfaelle?select=" + AS_VF_SPALTEN + (AS.admin ? ",melder" : "") + k + "&order=ereignis_am.desc.nullslast,angelegt_am.desc")
      .catch(e => { AS_VF.fehler = asVfFehlertext(e); return []; }),
    apiGet("/rest/v1/portal_melde_token?select=token,kunde_slug&aktiv=is.true" + k).catch(() => []),
    apiGet("/rest/v1/portal_dokumente?select=storage_path,doc_typ,titel,kategorie&kategorie=eq.vorfall-aushang" + k).catch(() => [])]);
  AS_VF.liste = rows || [];
  AS_VF.betrieb = await apiSend("POST", "/rest/v1/rpc/portal_vorfall_betrieb", { p_slug: AS.kunde }).catch(() => false) === true;
  AS_VF.token = ((tok || [])[0] || {}).token || "";
  const d = docs || [];
  AS_VF.aushang = d.find(r => r.doc_typ === "pdf") || d[0] || null;
  AS_VF.melder = {};
  if(AS.admin && AS_VF.liste.length){
    // Melder stehen in einer Nebentabelle – für den Betrieb bleiben Meldungen anonym
    const ids = AS_VF.liste.map(v => v.id);
    for(let i = 0; i < ids.length; i += 80){
      const teil = await apiGet("/rest/v1/portal_vorfall_melder?select=vorfall_id,melder&vorfall_id=in.(" + ids.slice(i, i + 80).map(encodeURIComponent).join(",") + ")").catch(() => []);
      (teil || []).forEach(m => { AS_VF.melder[m.vorfall_id] = m.melder; });
    }
  }
  if(AS_VF.kunde !== AS.kunde) AS_VF.fotos = {};
  AS_VF.kunde = AS.kunde;
}
async function asVfSpeichern(id, felder){
  felder.updated_at = new Date().toISOString();
  await apiSend("PATCH", "/rest/v1/portal_vorfaelle?id=eq." + encodeURIComponent(id), felder, "return=minimal");
}
/* Nach jedem Schreiben: eigene Liste und die übrigen V2-Seiten (as_meldung) neu laden */
async function asVfNeu(text){
  await asVfLaden(true);
  try{ await asLaden(); }catch(e){}
  asZeige();
  if(text) asMeldung(text);
}
async function asVfFoto(id){
  if(id in AS_VF.fotos) return AS_VF.fotos[id];
  const r = await apiGet("/rest/v1/portal_vorfaelle?select=foto&id=eq." + encodeURIComponent(id));
  return (AS_VF.fotos[id] = (r && r[0] && r[0].foto) || null);
}

/* ---------------- Seite ---------------- */
AS_SEITEN.vorfaelle = { titel: "Vorfälle", icon: "△", sort: 4.7, async render(main){
  const r = asReiter("vorfaelle", [["arbeitssicherheit", "Arbeitssicherheit"], ["umwelt", "Umwelt"]], "arbeitssicherheit");
  const umwelt = r.akt === "umwelt";
  const kopf = `<h1 class="seite">Vorfälle</h1><p class="unter">Unfälle, Beinahe-Unfälle, unsichere Zustände und Umweltvorfälle – gemeldet über den QR-Aushang oder von OAK erfasst.</p>${r.html}`;
  main.innerHTML = kopf + `<div class="leer">wird geladen …</div>`;
  try{ await asVfLaden(); }
  catch(e){ main.innerHTML = kopf + `<div class="karte"><div class="leer">Vorfälle konnten nicht geladen werden: ${esc(asVfFehlertext(e))}</div></div>`; return; }
  if(AS.seite !== "vorfaelle") return;   // inzwischen weiternavigiert

  const alle = asVfBereich(r.akt), st = AS_VF.filter;
  const offen = alle.filter(v => v.status !== "erledigt").length;
  const auswOffen = alle.filter(v => !asVfAusgewertet(v)).length;
  const neuZahl = alle.filter(v => v.status === "neu").length;
  const q = st.q.toLowerCase();
  const sicht = alle.filter(v => (!st.art || v.art === st.art) && (!st.status || v.status === st.status)
    && (!st.auswertung || !asVfAusgewertet(v))
    && (!q || [v.beschreibung, v.ort, v.anlage, v.stoff, asVfMelder(v)].join(" ").toLowerCase().includes(q)));

  const aushang = AS_VF.aushang;
  const aushangKnopf = AS_VF.token ? `<button class="btn sek klein" id="vfAushang">Aushang drucken</button>` : aushang ? (aushang.doc_typ === "pdf"
      ? `<button class="btn sek klein" id="vfAushang">Aushang drucken</button>`
      : `<button class="btn sek klein" id="vfAushang">Aushang mit QR-Code öffnen</button>`) : "";
  const info = umwelt
    ? `Gemeldete Umweltvorfälle – Austritt von Öl, Kraftstoff oder Chemikalien, Leckagen und
       vergleichbare Ereignisse. <b>Gelangen wassergefährdende Stoffe in nicht nur unerheblicher Menge
       in Gewässer, Kanalisation oder Boden, ist das unverzüglich anzuzeigen</b> (§ 24 Abs. 2 AwSV).`
    : `Meldungen aus dem Betrieb – über den QR-Aushang in der Halle oder hier erfasst.
       <b>Beinahe-Unfälle sind die wertvollsten Meldungen</b>: Sie zeigen die Lücke, bevor etwas passiert.`;
  const arten = Object.entries(AS_VF_ART).filter(([a]) => alle.some(v => v.art === a) || st.art === a);
  const kachel = (farbe, lbl, zahl, hw, key) => `<div class="kachel k-${farbe}"${key ? ` data-kachel="${key}" style="cursor:pointer"` : ""}><div class="lbl">${lbl}</div><div class="zahl">${zahl}</div><div class="hinweis">${hw}</div></div>`;

  main.innerHTML = kopf + `
    <div class="karte nodruck"><h2>${umwelt ? "Umweltvorfall melden" : "Vorfall melden"}</h2>
      <p>Unfall, Beinahe-Unfall, unsicherer Zustand oder Umweltvorfall – mit Foto. Die Meldung geht an ${AS_VF.betrieb ? "die Fachkraft für Arbeitssicherheit im Betrieb (und zur Kenntnis an OAK engineering)" : "OAK engineering"}.</p>
      <div class="reihe" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="vfMelden">${umwelt ? "Umweltvorfall melden" : "Vorfall melden"}</button>
        ${asVfVerwalter() ? `<button class="btn ${AS.admin ? "adm" : ""}" id="vfNeu">+ Vorfall erfassen</button>` : ""}${aushangKnopf}</div>
      ${AS.gf ? `<div class="form" style="margin-top:12px"><label>Neue Meldungen prüft und gibt frei
        <select id="vfFreigabe"><option value="oak" ${AS_VF.betrieb ? "" : "selected"}>OAK engineering</option><option value="betrieb" ${AS_VF.betrieb ? "selected" : ""}>die Fachkraft im Betrieb</option></select></label>
        <p class="hinweis" style="align-self:end">Bei „Fachkraft“ erhalten die Empfänger der E-Mail-Erinnerungen jede neue Meldung (ohne Namen der Meldenden).</p></div>` : ""}</div>
    ${AS_VF.fehler ? `<div class="karte"><div class="leer">Vorfälle konnten nicht geladen werden: ${esc(AS_VF.fehler)}</div></div>` : ""}
    <div class="kacheln">
      ${kachel("grau", "Meldungen", alle.length, umwelt ? "Umweltvorfälle" : "Unfälle & Beinahe-Unfälle", "")}
      ${kachel(offen ? "gelb" : "gruen", "Offen", offen, st.status === "offen" ? "Filter aktiv – erneut tippen zum Aufheben" : "noch nicht erledigt", "offen")}
      ${kachel(auswOffen ? "rot" : "gruen", "Auswertung offen", auswOffen, st.auswertung ? "Filter aktiv – erneut tippen zum Aufheben" : "Ursache und Maßnahmen fehlen", "auswertung")}
      ${asVfVerwalter() ? kachel(neuZahl ? "gelb" : "gruen", "Neu eingegangen", neuZahl, st.status === "neu" ? "Filter aktiv – erneut tippen zum Aufheben" : "noch freizugeben", "neu") : ""}
    </div>
    <div class="karte">
      <h2>${umwelt ? "Umweltvorfälle" : "Unfälle &amp; Beinahe-Unfälle"} <span class="hinweis">${alle.length} ${alle.length === 1 ? "Meldung" : "Meldungen"}${offen ? " · " + offen + " offen" : ""}</span></h2>
      <p class="hinweis">${info}</p>
      <div class="filterleiste nodruck">
        <input type="search" id="vfSuche" placeholder="Suchen (Beschreibung, Ort, Anlage${AS.admin ? ", Melder" : ""})" value="${esc(st.q)}">
        <select id="vfArt" aria-label="Art"><option value="">Art: alle</option>${arten.map(([k, a]) => `<option value="${k}" ${st.art === k ? "selected" : ""}>Art: ${esc(a.label)}</option>`).join("")}</select>
        <select id="vfStatus" aria-label="Status"><option value="">Status: alle</option>${Object.entries(AS_VF_STATUS).filter(([k]) => asVfVerwalter() || k !== "neu").map(([k, l]) => `<option value="${k}" ${st.status === k ? "selected" : ""}>Status: ${esc(l)}</option>`).join("")}</select>
        <label class="fl-schalter"><input type="checkbox" id="vfAusw" ${st.auswertung ? "checked" : ""}> nur „Auswertung offen“</label>
      </div>
      <div class="zeilen">${sicht.map(asVfZeile).join("") || (alle.length
        ? `<div class="leer">Keine Meldungen zum Filter.</div>`
        : `<div class="leer">Bisher keine Meldungen.<br>Der Meldelink für die Beschäftigten hängt als QR-Aushang in der Halle.</div>`)}</div>
    </div>`;

  const neuZeichnen = () => AS_SEITEN.vorfaelle.render(main);
  const su = document.getElementById("vfSuche");
  su.oninput = () => { st.q = su.value; clearTimeout(AS_VF.t); AS_VF.t = setTimeout(() => { neuZeichnen().then(() => { const s = document.getElementById("vfSuche"); if(s){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }); }, 300); };
  document.getElementById("vfArt").onchange = e => { st.art = e.target.value; neuZeichnen(); };
  document.getElementById("vfStatus").onchange = e => { st.status = e.target.value; neuZeichnen(); };
  document.getElementById("vfAusw").onchange = e => { st.auswertung = e.target.checked; neuZeichnen(); };
  main.querySelectorAll("[data-kachel]").forEach(k => k.onclick = () => {
    const w = k.dataset.kachel;
    if(w === "auswertung") st.auswertung = !st.auswertung;
    else st.status = st.status === w ? "" : w;
    neuZeichnen();
  });
  main.querySelectorAll("[data-vf]").forEach(z => z.onclick = () => asVfDetail(z.dataset.vf));
  document.getElementById("vfMelden").onclick = () => asVfMeldenOeffnen(umwelt);
  const nb = document.getElementById("vfNeu"); if(nb) nb.onclick = () => asVfErfassen(umwelt);
  const ab = document.getElementById("vfAushang"); if(ab) ab.onclick = () => asVfAushang(ab);
  const fg = document.getElementById("vfFreigabe");
  if(fg) fg.onchange = async () => {
    try{ await apiSend("POST", "/rest/v1/rpc/portal_vorfall_freigabe_setzen", { p_slug: AS.kunde, p_wer: fg.value }); }
    catch(e){ asMeldung("Konnte nicht umgestellt werden: " + asVfFehlertext(e)); return; }
    await asVfNeu(fg.value === "betrieb" ? "Neue Meldungen prüft jetzt die Fachkraft im Betrieb" : "Neue Meldungen prüft OAK engineering");
  };
}};

function asVfZeile(v){
  const a = AS_VF_ART[v.art] || AS_VF_ART.unsicher;
  const kurz = (v.beschreibung || "").replace(/\s+/g, " ").slice(0, 90);
  const melder = asVfMelder(v);
  return `<div class="z" data-vf="${esc(v.id)}" style="cursor:pointer"><div>
      <b>${asPunkt(a.farbe)}${esc(a.label)} · ${asVfDatum(v.ereignis_am)}${v.ort ? " · " + esc(v.ort) : ""}</b>
      <small>${esc(kurz)}${(v.beschreibung || "").length > 90 ? " …" : ""}${v.anlage ? " · " + esc(v.anlage) : ""}${v.verletzte ? " · Person verletzt" : ""}${AS.admin ? " · Gemeldet von: " + (melder ? esc(melder) : "anonym") : ""}</small></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
      ${asVfAusgewertet(v) ? "" : asChip("Auswertung offen", "rot")}
      ${asChip(AS_VF_STATUS[v.status] || v.status || "–", AS_VF_STATUS_FARBE[v.status] || "grau")}</div></div>`;
}

/* ---------------- Melden (QR-Melder des Kundenportals, eingebettet) ---------------- */
function asVfMeldenOeffnen(umwelt){
  if(!AS_VF.token){ asMeldung("Für diesen Betrieb ist noch kein Zugang eingerichtet – bitte bei OAK engineering melden."); return; }
  asDokOeffnen("melden.html?t=" + encodeURIComponent(AS_VF.token) + "&eingebettet=1" + (umwelt ? "&art=umwelt" : ""),
    umwelt ? "Umweltvorfall melden" : "Vorfall melden");
  // Beim Zurückkehren die Liste auffrischen (eine neue Meldung ist für den Betrieb erst nach Prüfung sichtbar)
  const zu = document.getElementById("asDokZu");
  if(zu && !zu.dataset.vf){ zu.dataset.vf = "1"; zu.addEventListener("click", () => { if(AS.seite === "vorfaelle") asVfNeu(); }); }
}

/* ---------------- Aushang (PDF drucken, sonst anzeigen) ---------------- */
async function asVfAushang(knopf){
  // mit Melde-Code: Aushang immer aktuell im Browser bauen (as-organisation.js), sonst das hinterlegte Dokument
  if(AS_VF.token && typeof asAushangVorfall === "function"){ asAushangVorfall(AS_VF.token); return; }
  const d = AS_VF.aushang; if(!d) return;
  if(d.doc_typ !== "pdf"){ asDokOeffnen(asViewerUrl(d.doc_typ, d.storage_path, d.titel), d.titel || "Aushang"); return; }
  const text = knopf.textContent; knopf.disabled = true; knopf.textContent = "wird geladen …";
  let blobUrl = null;
  try{
    const url = await asSigniert(d.storage_path);
    if(!url) throw new Error("kein Link");
    const blob = await (await fetch(url)).blob();
    blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    let f = document.getElementById("asVfAushangRahmen"); if(f) f.remove();
    f = document.createElement("iframe"); f.id = "asVfAushangRahmen"; f.title = "Aushang";
    f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
    f.onload = () => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ window.open(blobUrl, "_blank", "noopener"); } };
    f.src = blobUrl; document.body.appendChild(f);
  }catch(e){ asMeldung("Aushang konnte nicht geladen werden."); }
  finally{ knopf.disabled = false; knopf.textContent = text; }
}

/* ---------------- Detail ---------------- */
function asVfDatenZeilen(v){
  const umwelt = asVfIstUmwelt(v), melder = asVfMelder(v);
  return [
    ["Art", esc((AS_VF_ART[v.art] || AS_VF_ART.unsicher).label)],
    ["Bereich", esc(AS_VF_DOMAENE[v.domaene] || v.domaene || "—")],
    ["Wann", asVfDatum(v.ereignis_am) + (v.ereignis_zeit ? " · " + esc(v.ereignis_zeit) : "")],
    ["Wo", [v.ort, v.anlage].filter(Boolean).map(esc).join(" · ") || "—"],
    v.as_einheit_id ? ["Bereich", esc(asEinheitName(v.as_einheit_id))] : null,
    umwelt ? ["Stoff / Menge", [v.stoff, v.menge].filter(Boolean).map(esc).join(" · ") || "—"] : null,
    umwelt ? ["Gelangt nach", esc(v.wohin || "—")] : null,
    ["Merkmale", [v.verletzte ? "Person verletzt" : "", v.erste_hilfe ? "Erste Hilfe geleistet" : ""].filter(Boolean).join(" · ") || "—"],
    AS.admin ? ["Gemeldet von", melder ? esc(melder) : "<i>anonym</i>"] : null,
    ["Eingegangen", asVfDatum(v.angelegt_am) + (v.quelle === "portal" || v.quelle === "portal2" ? " · im Portal erfasst" : " · über den Meldelink")],
  ].filter(Boolean);
}
function asVfAuswertungHtml(v){
  const zeilen = [
    v.art === "unfall" ? ["Ausfalltage", v.ausfalltage != null ? String(v.ausfalltage) : "—"] : null,
    ["Ursache", v.ursache], ["Sofortmaßnahme", v.sofortmassnahme], ["Langzeitmaßnahme", v.langzeitmassnahme]
  ].filter(z => z && z[1] != null && z[1] !== "");
  const hat = v.ausgewertet_am || v.sofortmassnahme || v.langzeitmassnahme || v.ursache || v.ausfalltage != null;
  const anzeige = v.art === "unfall" && v.ausfalltage > 3
    ? `<p class="hinweis" style="color:#a32f2f"><b>Mehr als 3 Ausfalltage: Unfallanzeige an die Berufsgenossenschaft innerhalb von 3 Tagen (§ 193 Abs. 1 SGB VII).</b></p>` : "";
  if(!hat) return `<p class="hinweis">Noch nicht ausgewertet.</p>`;
  return `<div class="tabwrap"><table class="tab">${zeilen.map(([k, w]) => `<tr><th>${k}</th><td>${asVfText(w)}</td></tr>`).join("")}</table></div>${anzeige}
    ${v.ausgewertet_von || v.ausgewertet_am ? `<p class="hinweis">ausgewertet${v.ausgewertet_von ? " von " + esc(v.ausgewertet_von) : ""}${v.ausgewertet_am ? " am " + asVfDatum(v.ausgewertet_am) : ""}</p>` : ""}`;
}

function asVfDetail(id){
  const v = AS_VF.liste.find(x => x.id === id); if(!v) return;
  const a = AS_VF_ART[v.art] || AS_VF_ART.unsicher;
  const mn = asVfMassnahmen(v);
  const einheiten = asT("as_einheit");
  const verwaltung = asVfVerwalter() ? `
    <h3>Bearbeitung${AS.admin ? " durch OAK" : ""}</h3>
    <div class="form">
      ${asAuswahl("Status", "status", v.status || "offen", Object.entries(AS_VF_STATUS))}
      ${asAuswahl("Themenfeld", "domaene", v.domaene || "arbeitssicherheit", Object.entries(AS_VF_DOMAENE))}
      ${asBereichWahl("Bereich", "as_einheit_id", v.as_einheit_id || "", "", "– betriebsweit –")}
      ${asFeld("Bearbeitung / veranlasste Maßnahme", "bearbeitung", v.bearbeitung, "textarea", "voll")}
      ${asFeld("Rückmeldung an den Melder", "rueckmeldung", v.rueckmeldung, "textarea", "voll")}
    </div>
    ${v.status === "neu" ? `<p class="hinweis">Status „eingegangen – wird geprüft“: Der Betrieb sieht die Meldung erst, wenn sie auf „offen“ oder weiter gesetzt ist.</p>` : ""}
    ${v.rueckmeldung_am ? `<p class="hinweis">Rückmeldung gegeben am ${asVfDatum(v.rueckmeldung_am)}.</p>` : ""}`
    : `${v.bearbeitung ? `<h3>Bearbeitung</h3><p>${asVfText(v.bearbeitung)}</p>` : ""}
       ${v.rueckmeldung ? `<h3>Rückmeldung an den Melder</h3><p>${asVfText(v.rueckmeldung)}</p><p class="hinweis">am ${asVfDatum(v.rueckmeldung_am)}</p>` : ""}`;

  const knoepfe = [
    { t: "Drucken", klasse: "sek", fn: () => { asVfDrucken(v); return false; } },
    { t: asVfAusgewertet(v) || v.ursache || v.ausfalltage != null ? "Auswertung ändern" : "Auswerten", klasse: "sek", fn: () => { asVfAuswerten(v); return false; } },
    { t: "Maßnahme ableiten", klasse: "sek", fn: () => { asVfMassnahme(v); return false; } },
  ];
  if(v.status === "neu" && asVfVerwalter()) knoepfe.push({ t: "Freigeben", fn: async d => {
    /* Eingaben aus demselben Dialog mitnehmen (Durchlauf 2: gingen beim Freigeben verloren) */
    const w = asWerte(d), felder = { status: "offen" };
    ["bearbeitung", "rueckmeldung", "domaene"].forEach(k => { if(k in w && w[k] != null) felder[k] = w[k]; });
    if("as_einheit_id" in w) felder.as_einheit_id = w.as_einheit_id || null;
    if(felder.rueckmeldung) felder.rueckmeldung_am = felder.rueckmeldung === v.rueckmeldung && v.rueckmeldung_am ? v.rueckmeldung_am : asHeute();
    try{ await asVfSpeichern(v.id, felder); }
    catch(e){ asMeldung("Konnte nicht freigegeben werden: " + asVfFehlertext(e)); return false; }
    await asVfNeu("Meldung freigegeben");
  }});
  if(asVfVerwalter()) knoepfe.push({ t: "Speichern", klasse: AS.admin ? "adm" : "", fn: async d => {
    const w = asWerte(d);
    const felder = { status: w.status || "offen", domaene: w.domaene || "arbeitssicherheit", bearbeitung: w.bearbeitung, rueckmeldung: w.rueckmeldung };
    if("as_einheit_id" in w) felder.as_einheit_id = w.as_einheit_id || null;
    felder.rueckmeldung_am = w.rueckmeldung ? (w.rueckmeldung === v.rueckmeldung && v.rueckmeldung_am ? v.rueckmeldung_am : asHeute()) : null;
    try{ await asVfSpeichern(v.id, felder); }
    catch(e){ asMeldung("Konnte nicht gespeichert werden: " + asVfFehlertext(e)); return false; }
    await asVfNeu("Vorfall gespeichert");
  }});

  const d = asDialog({ titel: a.label + " · " + asVfDatum(v.ereignis_am), breit: true, inhalt: `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${asChip(a.label, a.farbe)} ${asChip(AS_VF_STATUS[v.status] || v.status || "–", AS_VF_STATUS_FARBE[v.status] || "grau")}
      ${asVfAusgewertet(v) ? asChip("ausgewertet", "gruen") : asChip("Auswertung offen", "rot")}</div>
    <h3>Was ist passiert?</h3>
    <p>${asVfText(v.beschreibung)}</p>
    <div class="tabwrap"><table class="tab">${asVfDatenZeilen(v).map(([k, w]) => `<tr><th>${k}</th><td>${w}</td></tr>`).join("")}</table></div>
    <div id="vfFotoBox" style="margin:8px 0">${v.id in AS_VF.fotos
      ? (asVfFotoHtml(AS_VF.fotos[v.id]) || `<span class="hinweis">kein Foto</span>`)
      : `<button class="btn sek klein" id="vfFotoLaden">Foto anzeigen</button>`}</div>
    <h3>Auswertung</h3>
    ${asVfAuswertungHtml(v)}
    ${mn.length ? `<h3>Abgeleitete Maßnahmen</h3><div class="zeilen">${mn.map(m => `<div class="z"><div><b>${esc(m.text || "")}</b><small>${m.verantwortlich ? esc(m.verantwortlich) + " · " : ""}${m.termin ? "bis " + asDat(m.termin) : "ohne Termin"}</small></div>${asChip(m.status === "wirksam" ? "wirksam" : m.status === "erledigt" ? "erledigt" : "offen", m.status === "offen" ? "gelb" : "gruen")}</div>`).join("")}</div>` : ""}
    ${verwaltung}`, knoepfe });

  const fb = d.querySelector("#vfFotoLaden");
  if(fb) fb.onclick = async () => {
    fb.disabled = true; fb.textContent = "lädt …";
    try{ const f = await asVfFoto(v.id); const box = d.querySelector("#vfFotoBox");
      if(box) box.innerHTML = asVfFotoHtml(f) || `<span class="hinweis">kein Foto</span>`; }
    catch(e){ fb.disabled = false; fb.textContent = "Foto anzeigen"; asMeldung("Foto konnte nicht geladen werden."); }
  };
}

/* ---------------- Auswertung (Ausfalltage, Ursache, Sofort- und Langzeitmaßnahme) ----------------
   Darf auch der Betrieb (Schichtführer) nachtragen – die Datenbank lässt für ihn nur diese Felder zu. */
function asVfAuswerten(v){
  const a = AS_VF_ART[v.art] || AS_VF_ART.unsicher;
  const name = /^Schichtf/i.test(AS.ich || "") ? "" : (AS.ich || "");
  asDialog({ titel: "Vorfall auswerten", inhalt: `
    <p class="hinweis"><b>${esc(a.label)}</b> · ${asVfDatum(v.ereignis_am)}${v.ort ? " · " + esc(v.ort) : ""}<br>${esc((v.beschreibung || "").slice(0, 160))}</p>
    <div class="form">
      ${v.art === "unfall" ? `<label>Ausfalltage<input type="number" data-f="ausfalltage" min="0" max="3650" step="1" inputmode="numeric" placeholder="0 = keine" value="${v.ausfalltage != null ? esc(String(v.ausfalltage)) : ""}"></label>` : ""}
      <label class="voll">Ursache<textarea data-f="ursache" placeholder="Was hat dazu geführt?">${esc(v.ursache || "")}</textarea></label>
      <label class="voll">Sofortmaßnahme<textarea data-f="sofortmassnahme" placeholder="Was wurde direkt getan?">${esc(v.sofortmassnahme || "")}</textarea></label>
      <label class="voll">Langzeitmaßnahme<textarea data-f="langzeitmassnahme" placeholder="Was verhindert, dass es wieder passiert?">${esc(v.langzeitmassnahme || "")}</textarea></label>
      <label class="voll">Ausgewertet von<input type="text" data-f="ausgewertet_von" autocomplete="name" placeholder="Vor- und Nachname" value="${esc(v.ausgewertet_von || name)}"></label>
    </div>
    <p class="hinweis">Mehr als 3 Ausfalltage nach einem Unfall: Unfallanzeige an die Berufsgenossenschaft innerhalb von 3 Tagen (§ 193 Abs. 1 SGB VII).</p>`,
    knoepfe: [
      { t: "Zurück", klasse: "sek", fn: () => { asVfDetail(v.id); return false; } },
      { t: "Speichern", fn: async d => {
        const w = asWerte(d);
        const felder = { ursache: w.ursache, sofortmassnahme: w.sofortmassnahme, langzeitmassnahme: w.langzeitmassnahme, ausgewertet_von: w.ausgewertet_von };
        const tage = v.art === "unfall" ? w.ausfalltage : null;
        if(v.art === "unfall") felder.ausfalltage = tage;
        if(tage != null && (isNaN(tage) || tage < 0 || Math.floor(tage) !== tage)){ asMeldung("Bitte die Ausfalltage als Zahl eintragen (0 = keine)."); return false; }
        if(!felder.sofortmassnahme && !felder.langzeitmassnahme && !felder.ursache && tage == null){ asMeldung("Bitte mindestens ein Feld ausfüllen."); return false; }
        if(!felder.ausgewertet_von || felder.ausgewertet_von.length < 3){ asMeldung("Bitte eintragen, wer ausgewertet hat."); return false; }
        felder.ausgewertet_am = new Date().toISOString();
        try{ await asVfSpeichern(v.id, felder); }
        catch(e){ asMeldung("Konnte nicht gespeichert werden: " + asVfFehlertext(e)); return false; }
        /* Prozessmodell P13 → P11: die Langzeitmaßnahme wird eine Maßnahme mit Termin (einmal je Vorfall) */
        if(felder.langzeitmassnahme && felder.langzeitmassnahme !== v.langzeitmassnahme && typeof asSpeichern === "function"
           && !asT("as_massnahme").some(m => m.quelle === "meldung" && m.quelle_id === v.id)){
          const t = new Date(); t.setDate(t.getDate() + 28);
          await asSpeichern("as_massnahme", { quelle: "meldung", quelle_id: v.id, stop: "O", text: felder.langzeitmassnahme.slice(0, 500), umsetzung: "zentral",
            status: "offen", termin: t.toISOString().slice(0, 10), verantwortlich: felder.ausgewertet_von, einheit_id: v.as_einheit_id || null }).catch(() => {});
        }
        await asVfNeu(tage > 3 ? "Gespeichert – Unfallanzeige an die BG nicht vergessen" : "Auswertung gespeichert");
      }}]});
}

/* ---------------- Erfassung durch OAK (mündlich oder telefonisch gemeldet) ---------------- */
function asVfErfassen(umwelt){
  if(!asVfVerwalter()) return;
  const einheiten = asT("as_einheit");
  const d = asDialog({ titel: "Vorfall erfassen", breit: true, inhalt: `<div class="form">
      ${asAuswahl("Art", "art", umwelt ? "umwelt" : "unfall", Object.entries(AS_VF_ART).map(([k, a]) => [k, a.label]))}
      ${asAuswahl("Thema", "domaene", umwelt ? "umwelt" : "arbeitssicherheit", Object.entries(AS_VF_DOMAENE))}
      ${asFeld("Datum", "ereignis_am", asHeute(), "date")}
      <label>Uhrzeit / Schicht<input type="text" data-f="ereignis_zeit" placeholder="z. B. 22:30 oder Nachtschicht"></label>
      <label>Ort<input type="text" data-f="ort" placeholder="Halle, Bereich"></label>
      ${asFeld("Maschine / Anlage", "anlage", "")}
      ${asBereichWahl("Bereich", "as_einheit_id", null, "", "– betriebsweit –")}
      <label class="voll">Was ist passiert?<textarea data-f="beschreibung" rows="5"></textarea></label>
      <div class="voll vfUmwelt form" style="padding:0">
        ${asFeld("Stoff", "stoff", "")}${asFeld("Menge", "menge", "")}
        <label class="voll">Gelangt nach<input type="text" data-f="wohin" placeholder="z. B. Boden, Kanalisation, Auffangwanne"></label></div>
      ${AS.admin ? `<label>Gemeldet von<input type="text" data-f="melder" placeholder="leer = anonym"></label>` : ""}
      ${asFeld("Person verletzt", "verletzte", false, "checkbox")}
      ${asFeld("Erste Hilfe geleistet", "erste_hilfe", false, "checkbox")}
    </div>`,
    knoepfe: [{ t: "Speichern", klasse: AS.admin ? "adm" : "", fn: async dlg => {
      const w = asWerte(dlg);
      if(!w.beschreibung || w.beschreibung.length < 5){ asMeldung("Bitte kurz beschreiben, was passiert ist."); return false; }
      const art = AS_VF_ART[w.art] ? w.art : "unsicher";
      const domaene = AS_VF_DOMAENE[w.domaene] ? w.domaene : (art === "umwelt" ? "umwelt" : "arbeitssicherheit");
      const zeigtUmwelt = art === "umwelt" || domaene !== "arbeitssicherheit";
      const row = {
        kunde_slug: AS.kunde, kunde: asVfBetrieb(), art, domaene,
        ereignis_am: w.ereignis_am || null, ereignis_zeit: w.ereignis_zeit, ort: w.ort, anlage: w.anlage,
        beschreibung: w.beschreibung, melder: w.melder, verletzte: !!w.verletzte, erste_hilfe: !!w.erste_hilfe,
        stoff: zeigtUmwelt ? w.stoff : null, menge: zeigtUmwelt ? w.menge : null, wohin: zeigtUmwelt ? w.wohin : null,
        status: "offen", quelle: "portal" };
      if("as_einheit_id" in w) row.as_einheit_id = w.as_einheit_id || null;
      try{ await apiSend("POST", "/rest/v1/portal_vorfaelle", [row], "return=minimal"); }
      catch(e){ asMeldung("Fehlgeschlagen: " + asVfFehlertext(e)); return false; }
      await asVfNeu("Vorfall erfasst");
    }}]});
  // Umwelt-Felder nur bei Umweltvorfall bzw. Bereich Umwelt / beides
  const sel = n => d.querySelector(`[data-f="${n}"]`), box = d.querySelector(".vfUmwelt");
  const sicht = () => { box.hidden = !(sel("art").value === "umwelt" || sel("domaene").value !== "arbeitssicherheit"); };
  sel("art").onchange = () => { sel("domaene").value = sel("art").value === "umwelt" ? "umwelt" : (sel("domaene").value === "umwelt" ? "arbeitssicherheit" : sel("domaene").value); sicht(); };
  sel("domaene").onchange = sicht;
  sicht();
}

/* ---------------- Maßnahme ableiten (V2-Tabelle as_massnahme, Quelle = Meldung) ---------------- */
function asVfMassnahme(v){
  const text = v.langzeitmassnahme || v.sofortmassnahme || "";
  const vorgabe = { quelle: "meldung", quelle_id: v.id, stop: "O", text, umsetzung: "zentral", status: "offen", einheit_id: v.as_einheit_id || null };
  if(typeof asMassnahmeDialog === "function"){ asMassnahmeDialog(null, vorgabe); return; }
  asDialog({ titel: "Maßnahme ableiten", inhalt: `<div class="form">${asFeld("Maßnahme", "text", text, "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Anlegen", fn: async d => { const w = asWerte(d); if(!w.text){ asMeldung("Text fehlt"); return false; }
      await asSpeichern("as_massnahme", Object.assign({}, vorgabe, { text: w.text })); asMeldung("Maßnahme angelegt"); asZeige(); } }]});
}

/* ---------------- Druck eines Vorfalls ---------------- */
async function asVfDrucken(v){
  let foto = null;
  try{ foto = await asVfFoto(v.id); }catch(e){ foto = null; }
  const a = AS_VF_ART[v.art] || AS_VF_ART.unsicher;
  const zeilen = asVfDatenZeilen(v).concat([["Status", esc(AS_VF_STATUS[v.status] || v.status || "–")]]);
  const ausw = [
    v.art === "unfall" ? ["Ausfalltage", v.ausfalltage != null ? String(v.ausfalltage) : "—"] : null,
    ["Ursache", v.ursache || "—"], ["Sofortmaßnahme", v.sofortmassnahme || "—"], ["Langzeitmaßnahme", v.langzeitmassnahme || "—"],
    ["Ausgewertet", (v.ausgewertet_von || "—") + (v.ausgewertet_am ? " am " + asVfDatum(v.ausgewertet_am) : "")]
  ].filter(Boolean);
  const inhalt = `<h1>${esc(a.label)} vom ${asVfDatum(v.ereignis_am)}</h1>
    <p class="leise">${esc(asVfBetrieb())} · gedruckt am ${asDat(asHeute())}</p>
    <h2>Was ist passiert?</h2><p>${asVfText(v.beschreibung)}</p>
    <table>${zeilen.map(([k, w]) => `<tr><th style="width:32%">${k}</th><td>${w}</td></tr>`).join("")}</table>
    ${asVfFotoOk(foto) ? `<h2>Foto</h2><img src="${esc(foto)}" alt="Belegfoto" style="max-width:100%;max-height:110mm">` : ""}
    <h2>Auswertung</h2>
    <table>${ausw.map(([k, w]) => `<tr><th style="width:32%">${k}</th><td>${asVfText(w)}</td></tr>`).join("")}</table>
    ${v.art === "unfall" && v.ausfalltage > 3 ? `<p><b>Mehr als 3 Ausfalltage: Unfallanzeige an die Berufsgenossenschaft innerhalb von 3 Tagen (§ 193 Abs. 1 SGB VII).</b></p>` : ""}
    ${v.bearbeitung ? `<h2>Bearbeitung / veranlasste Maßnahme</h2><p>${asVfText(v.bearbeitung)}</p>` : ""}
    ${v.rueckmeldung ? `<h2>Rückmeldung an den Melder</h2><p>${asVfText(v.rueckmeldung)}</p><p class="leise">am ${asVfDatum(v.rueckmeldung_am)}</p>` : ""}
    ${asVfIstUmwelt(v) ? `<p class="leise">Gelangen wassergefährdende Stoffe in nicht nur unerheblicher Menge in Gewässer, Kanalisation oder Boden, ist das unverzüglich anzuzeigen (§ 24 Abs. 2 AwSV).</p>` : ""}`;
  let f = document.getElementById("asVfDruckRahmen"); if(f) f.remove();
  f = document.createElement("iframe"); f.id = "asVfDruckRahmen"; f.title = "Druck";
  f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
  f.onload = () => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ asMeldung("Drucken nicht möglich."); } };
  f.srcdoc = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(a.label)} ${asVfDatum(v.ereignis_am)}</title><style>
    body{font:11.5pt/1.45 "Jost","Segoe UI",Arial,sans-serif;color:#1b1b1b;margin:16mm}
    h1{font-size:17pt;margin:0 0 4pt} h2{font-size:12.5pt;margin:14pt 0 6pt;border-bottom:1px solid #999;padding-bottom:2pt}
    table{width:100%;border-collapse:collapse;margin:6pt 0} th,td{border:1px solid #bbb;padding:4pt 6pt;text-align:left;vertical-align:top;font-size:10.5pt}
    th{background:#eef2ef} .leise{color:#555;font-size:10pt} @page{size:A4;margin:0}</style></head><body>${inhalt}</body></html>`;
  document.body.appendChild(f);
}

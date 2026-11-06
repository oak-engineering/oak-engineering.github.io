/* PSA-Matrix (Stufe 12, 06.11.2026 – Plan staged-inventing-blum C2). Persönliche Schutzausrüstung je Tätigkeit.
   Daten: psa_art (Katalog, OAK) · psa_vorlage (Branchenvorlage, OAK; Spritzguss nach DGUV Information 113-606) ·
   as_psa_zuordnung (Matrix des Betriebs: as_taetigkeit × PSA-Art) · v_as_psa (Matrix + Chemikalienschutzhandschuh aus
   Tätigkeiten mit Gefahrstoff) · portal_handschuh (Modelltabelle für ALLE PSA, Spalte psa_art; Handschuhplan unverändert) ·
   as_psa_ausgabe (Ausgabenachweis je Person). Folgen (Prüfaufträge BdA/BA) setzt die Datenbank (Trigger as_psa_zuordnung_folgen).
   Gebotszeichen: AS_PSA_ZEICHEN (as-psa-zeichen.js, ASR A1.3 / ISO 7010). Keine KI. */
"use strict";

const AS_PSA = { sys: "", sq: "", art: "", rolle: "", q: "", d: null, extraSpalten: {} };
const AS_PSA_BRANCHE = { "kunststoff-spritzguss": "Kunststoff-Spritzguss" };
const AS_PSA_STANDARD = 100;   // Spalten bis Sortierung 100 = Tabelle der DGUV-Vorlage; weitere Arten nur, wenn benutzt oder dazugenommen
AS_ICON.psa = '<path d="M3.5 17.5h17v2.5h-17z"/><path d="M5 17.5a7 7 0 0 1 14 0"/><path d="M10 10.8V6.5h4v4.3"/>';

AS_SEITEN.psa = { titel: "PSA-Matrix", icon: "", sort: 4.66, async render(main){
  /* #psa/<Arbeitssystem-ID> wählt die Anlage (Pill) und zeigt die Matrix */
  const hashSys = AS.reiter.psa && /^[0-9a-f-]{36}$/.test(AS.reiter.psa) ? AS.reiter.psa : "";
  if(hashSys){ AS_PSA.sys = hashSys; AS.reiter.psa = "matrix"; }
  const r = asReiter("psa", [["matrix", "Matrix"], ["modelle", "Modelle"], ["ausgabe", "Ausgabe"]], "matrix");
  main.innerHTML = `<h1 class="seite nodruck">PSA-Matrix</h1><p class="unter nodruck">Persönliche Schutzausrüstung je Tätigkeit, die Modelle des Betriebs und die Ausgabe an die Beschäftigten.</p>${r.html}<div id="psaInhalt"><div class="leer">wird geladen …</div></div>`;
  asPsaStil();
  const box = document.getElementById("psaInhalt");
  try{ await asPsaLaden(); }catch(e){ box.innerHTML = `<div class="karte"><div class="leer">Fehler beim Laden: ${esc(e.message || e)}</div></div>`; return; }
  if(r.akt === "modelle") return asPsaModelle(box);
  if(r.akt === "ausgabe") return asPsaAusgabe(box);
  return asPsaMatrix(box);
}};

function asPsaStil(){
  if(document.getElementById("psaStil")) return;
  const s = document.createElement("style"); s.id = "psaStil";
  s.textContent = `.psa-tab{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px}
.psa-tab th{font-family:'Jost','Segoe UI',Arial,sans-serif;font-weight:600;font-size:11px;color:var(--grau);vertical-align:bottom;padding:6px 2px;border-bottom:2px solid var(--linie);text-align:center;height:78px}
.psa-tab th .psa-kopf{display:flex;flex-direction:column;align-items:center;gap:4px;height:66px;justify-content:flex-start}
.psa-tab th .psa-kopf span{max-width:100%;overflow:hidden;white-space:normal;hyphens:auto;-webkit-hyphens:auto;overflow-wrap:anywhere;line-height:1.2;height:2.4em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.psa-tab th.t,.psa-tab td.t{text-align:left;width:26%;padding-left:8px}
.psa-tab td{height:44px;border-bottom:1px solid var(--linie);text-align:center;padding:0 2px}
.psa-tab td.t{font-weight:600;cursor:pointer;line-height:1.25}
.psa-tab td.t .tn{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.psa-tab td.t:hover{color:var(--blau)}
.psa-tab td.z.edit{cursor:pointer}.psa-tab td.z.edit:hover{background:var(--blau2)}
.psa-zei{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:0 0 auto}
.psa-zei.k{width:24px;height:24px}
.psa-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--blau);color:#fff;position:relative}
.psa-mark svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.psa-mark.opt{background:#fff;color:var(--blau);border:2px solid var(--blau)}
.psa-mark.gs{background:#fff;color:#1d6b3f;border:2px solid #1d6b3f}
.psa-mark sup{position:absolute;top:-6px;right:-8px;font-size:11px;color:var(--text);font-weight:700}
.psa-liste{display:none}
.psa-pills{display:flex;flex-wrap:wrap;gap:6px;flex:1 1 100%;min-width:0}
.psa-pill{height:32px;border-radius:16px;border:1px solid var(--linie);background:#fff;color:var(--text);padding:0 14px;font:13px 'Jost','Segoe UI',Arial,sans-serif;white-space:nowrap;max-width:100%;cursor:pointer}
.psa-pill:hover{border-color:var(--blau)}.psa-pill.an{background:var(--blau);border-color:var(--blau);color:#fff}
.psa-zeile{display:flex;align-items:center;gap:10px;min-height:48px;border-top:1px solid var(--linie);padding:4px 2px;cursor:pointer}
.psa-zeile:first-child{border-top:0}
.psa-zeile b{flex:1 1 auto;min-width:0;font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.psa-zeile .psa-icons{display:flex;gap:3px;flex:0 0 auto}
.psa-fuss{font-size:12px;color:var(--grau);margin-top:8px}
.psa-karten{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.psa-karte{border:1px solid var(--linie);border-radius:10px;padding:10px;background:#fff;height:176px;display:grid;grid-template-rows:84px 22px 20px 20px;gap:4px;overflow:hidden}
.psa-karte.edit{cursor:pointer}.psa-karte.edit:hover{border-color:var(--blau)}
.psa-karte .bild{display:flex;align-items:center;justify-content:center;gap:8px;background:#fafbfc;border-radius:8px}
.psa-karte .bild img.foto{max-height:80px;max-width:60%;object-fit:contain}
.psa-karte .n{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psa-karte .m,.psa-karte .s{font-size:12px;color:var(--grau);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psa-person td{height:44px}.psa-person th{height:auto;vertical-align:middle}
.psa-person td .psa-icons{display:flex;gap:3px;flex-wrap:nowrap;overflow:hidden}
.psa-hinweis{display:flex;gap:10px;align-items:center;background:var(--blau2);border-radius:10px;padding:10px 12px;margin:0 0 12px;font-size:13px}
.psa-hinweis .btn{margin-left:auto;flex:0 0 auto}
@media(max-width:820px){.psa-tab.matrix{display:none!important}.psa-liste{display:block}
  .psa-person th:nth-child(2),.psa-person td:nth-child(2){display:none}
  .psa-hinweis{flex-wrap:wrap}.psa-hinweis .btn{margin-left:0}}
@media print{.psa-tab td.z.edit:hover{background:none}.psa-liste{display:none!important}.psa-tab.matrix{display:table!important}}`;
  document.head.appendChild(s);
}

/* ---------------- Daten ---------------- */
async function asPsaLaden(){
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const hole = p => apiGet(p).then(x => x || []).catch(() => []);
  const [arten, vorlage, zuord, sicht, modelle, ausgabe, rollen, personen] = await Promise.all([
    hole("/rest/v1/psa_art?select=*&aktiv=is.true&order=sort.asc"),
    hole("/rest/v1/psa_vorlage?select=*&order=branche.asc,sort.asc"),
    hole("/rest/v1/as_psa_zuordnung?select=*" + k),
    hole("/rest/v1/v_as_psa?select=*" + k),
    hole("/rest/v1/portal_handschuh?select=*&aktiv=is.true&order=sortierung.asc,name.asc" + k),
    hole("/rest/v1/as_psa_ausgabe?select=*&order=ausgegeben_am.desc" + k),
    hole("/rest/v1/uw_rolle?select=id,name,status&status=eq.aktiv" + k),
    hole("/rest/v1/uw_person?select=id,name,status,uw_person_rolle(rolle_id)&status=eq.aktiv&order=name.asc" + k)]);
  AS_PSA.d = { arten, vorlage, zuord, sicht, modelle, ausgabe, rollen, personen, kunde: AS.kunde };
  AS.db.as_psa_zuordnung = zuord;   // Vorsorgehinweis (as-service.js) rechnet mit dem frischen Stand
}
function asPsaArt(k){ return (AS_PSA.d.arten || []).find(a => a.schluessel === k) || { schluessel: k, name: k, kurz: k }; }
function asPsaZeichen(a, klein){
  const z = (typeof AS_PSA_ZEICHEN !== "undefined" && a && AS_PSA_ZEICHEN[a.zeichen]) || null;
  return z ? `<img class="psa-zei${klein ? " k" : ""}" src="${z.bild}" alt="" title="${esc(a.name + " – " + z.name + " (" + a.zeichen + ")")}">` : "";
}
const AS_PSA_HAKEN = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
/* Anlagen und Arbeitssysteme mit Tätigkeiten oder als leere Hülle – stillgelegte nicht */
function asPsaSysteme(){
  return asT("as_arbeitssystem").filter(s => !s.stillgelegt_am)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "de"));
}
function asPsaTaetigkeiten(sid){ return asT("as_taetigkeit").filter(t => t.arbeitssystem_id === sid); }
function asPsaRollenVon(t, s){ const r = asListe(t.rollen); return r.length ? r : asListe(s && s.rollen); }
/* Zeilen der Sicht (Matrix + Gefahrstoff) einer Beurteilung */
function asPsaSicht(sid){ return (AS_PSA.d.sicht || []).filter(z => z.arbeitssystem_id === sid); }
/* Branche einer Beurteilung: Spritzguss, sobald Name/Typ danach aussieht – sonst die einzige vorhandene Vorlage */
function asPsaBrancheVorschlag(s){
  const br = [...new Set((AS_PSA.d.vorlage || []).map(v => v.branche))];
  if(br.length === 1) return br[0];
  const txt = JSON.stringify([s.name, (s.dok || {}).meta || {}]).toLowerCase();
  return br.find(b => b === "kunststoff-spritzguss" && /spritzg|sgm|spritzguss/.test(txt)) || br[0] || "";
}

/* ---------------- Matrix ---------------- */
function asPsaMatrix(box){
  const D = AS_PSA.d, edit = asDarf("pflegen"), sys = asPsaSysteme();
  if(!sys.length){ box.innerHTML = `<div class="karte"><div class="leer">Noch keine Anlage und kein Arbeitssystem erfasst – zuerst im Anlagenkataster anlegen.</div></div>`; return; }
  if(!sys.some(s => s.id === AS_PSA.sys)){
    const mit = sys.find(s => (D.zuord || []).some(z => asPsaTaetigkeiten(s.id).some(t => t.id === z.taetigkeit_id)));
    AS_PSA.sys = (mit || sys[0]).id; }
  /* Anlagenwahl als Pills (OAK-UI-Regel 3): umbrechende Leiste, Suchfeld grenzt ein; die gewählte Anlage bleibt immer sichtbar */
  const sq = AS_PSA.sq.trim().toLowerCase();
  const pills = sys.filter(x => x.id === AS_PSA.sys || !sq || String(x.name).toLowerCase().includes(sq));
  const s = sys.find(x => x.id === AS_PSA.sys);
  const taet = asPsaTaetigkeiten(s.id).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name), "de"));
  const sicht = asPsaSicht(s.id), zuord = (D.zuord || []).filter(z => taet.some(t => t.id === z.taetigkeit_id));
  const extra = AS_PSA.extraSpalten[s.id] || [];
  const benutzt = new Set(sicht.map(z => z.psa_art).concat(extra));
  const spalten = (D.arten || []).filter(a => a.sort <= AS_PSA_STANDARD || benutzt.has(a.schluessel));
  const weitere = (D.arten || []).filter(a => !spalten.includes(a));
  const zelle = (t, a) => sicht.find(z => z.taetigkeit_id === t.id && z.psa_art === a.schluessel);
  const leer = !zuord.length;
  const bedingungen = [];
  const bedNr = txt => { let i = bedingungen.indexOf(txt); if(i < 0){ bedingungen.push(txt); i = bedingungen.length - 1; } return "*".repeat(i + 1); };
  const markHtml = (z, a) => { if(!z) return "";
    const bed = z.quelle === "matrix" ? (z.bedingung || a.bedingung || "") : "";
    const sup = bed ? `<sup>${bedNr(bed)}</sup>` : "";
    const tip = z.quelle === "gefahrstoff" ? "aus dem Gefahrstoffverzeichnis: " + (z.stoffe || []).join(", ") : (z.pflicht ? "Pflicht" : "empfohlen") + (bed ? " – " + bed : "");
    return `<span class="psa-mark${z.quelle === "gefahrstoff" ? " gs" : z.pflicht ? "" : " opt"}" title="${esc(tip)}">${AS_PSA_HAKEN}${sup}</span>`; };
  const tabelle = `<table class="psa-tab matrix"><thead><tr><th class="t">Tätigkeit</th>${spalten.map(a => `<th title="${esc(a.name + (a.norm ? " · " + a.norm : ""))}"><div class="psa-kopf">${asPsaZeichen(a)}<span>${esc(a.kurz)}</span></div></th>`).join("")}</tr></thead>
    <tbody>${taet.map(t => `<tr><td class="t" data-taet="${esc(t.id)}" title="${esc(t.name)}"><span class="tn">${esc(t.name)}</span></td>${spalten.map(a => { const z = zelle(t, a);
      return `<td class="z${edit ? " edit" : ""}" data-t="${esc(t.id)}" data-a="${esc(a.schluessel)}" data-psa="${esc(a.schluessel)}">${markHtml(z, a)}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
  const liste = `<div class="psa-liste">${taet.map(t => { const zs = sicht.filter(z => z.taetigkeit_id === t.id);
      return `<div class="psa-zeile" data-taet="${esc(t.id)}"><b title="${esc(t.name)}">${esc(t.name)}</b><span class="psa-icons">${zs.map(z => asPsaZeichen(asPsaArt(z.psa_art), true)).join("")}</span></div>`; }).join("")}</div>`;
  const gehoer = sicht.some(z => z.psa_art === "gehoerschutz" && z.pflicht);
  const quelleVorlage = zuord.some(z => /^vorlage:/.test(z.quelle || ""));
  const fuss = [bedingungen.map((b, i) => "*".repeat(i + 1) + " " + b).join(" · "),
    sicht.some(z => z.quelle === "gefahrstoff") ? "grüner Rand = Tätigkeit mit Gefahrstoff, Handschuh laut Handschuhplan" : "",
    sicht.some(z => z.quelle === "matrix" && !z.pflicht) ? "weißer Kreis = empfohlen" : "",
    quelleVorlage ? "Vorlage: DGUV Information 113-606, vom Betrieb angepasst" : "",
    "Rechtsgrundlage: § 2 PSA-Benutzungsverordnung, § 3 ArbSchG"].filter(Boolean).join(" · ");
  const vorlageBr = asPsaBrancheVorschlag(s);
  const vorlageZeilen = (D.vorlage || []).filter(v => v.branche === vorlageBr);

  box.innerHTML = `<div class="karte"><h2>PSA je Tätigkeit <span class="hinweis">${taet.length} Tätigkeiten</span>
      <span><button class="btn sek klein" id="psaAushang">Aushang</button>${edit && !leer ? `<button class="btn sek klein" id="psaSpalte">+ PSA-Art</button><button class="btn klein" id="psaTaetNeu">+ Tätigkeit</button>` : ""}</span></h2>
    <div class="filterleiste nodruck">${sys.length > 8 ? `<input type="search" id="psaSysQ" value="${esc(AS_PSA.sq)}" placeholder="Anlage suchen …" autocomplete="off">` : ""}
      <span class="psa-pills" role="tablist" aria-label="Anlage">${pills.map(x => `<button type="button" class="psa-pill${x.id === AS_PSA.sys ? " an" : ""}" data-sys="${esc(x.id)}" title="${esc(x.name)}">${esc(x.name)}</button>`).join("")}</span>
      <span class="fl-zahl">${zuord.length} Zuordnungen</span></div>
    ${leer && edit && vorlageZeilen.length ? `<div class="psa-hinweis nodruck"><span>Für diese ${s.art === "arbeitssystem" ? "Beurteilung" : "Anlage"} ist noch keine PSA festgelegt. Die Branchenvorlage ${esc(AS_PSA_BRANCHE[vorlageBr] || vorlageBr)} legt ${vorlageZeilen.length} Tätigkeiten mit ihrer PSA an (DGUV Information 113-606); danach passen Sie die Matrix an.</span>
        <button class="btn klein" id="psaVorlage">Aus Branchenvorlage übernehmen</button></div>` : ""}
    ${leer && edit ? `<div class="psa-hinweis nodruck"><span>Oder selbst festlegen: Tätigkeit anlegen und Felder antippen.</span><button class="btn sek klein" id="psaTaetNeu2">+ Tätigkeit</button></div>` : ""}
    ${taet.length ? `<div class="tabwrap">${tabelle}</div>${liste}` : `<div class="leer">Noch keine Tätigkeiten erfasst.</div>`}
    ${gehoer ? `<div class="psa-hinweis"><span>Gehörschutz ist Pflicht: Für die Beschäftigten dieser Tätigkeiten gilt Pflichtvorsorge Lärm ab 85 dB(A) nach ArbMedVV. Fehlende Vorsorge erscheint unter Aufgaben.</span><button class="btn sek klein" id="psaVorsorge">Vorsorge öffnen</button></div>` : ""}
    <p class="psa-fuss">${esc(fuss)}</p></div>`;

  box.querySelectorAll("[data-sys]").forEach(el => el.onclick = () => { AS_PSA.sys = el.dataset.sys; asGehe("psa/" + el.dataset.sys); });
  const sqF = box.querySelector("#psaSysQ"); if(sqF) sqF.oninput = () => { AS_PSA.sq = sqF.value; clearTimeout(AS_PSA.sqT);
    AS_PSA.sqT = setTimeout(() => { asPsaMatrix(box); const n = document.getElementById("psaSysQ"); if(n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
  box.querySelector("#psaAushang").onclick = () => asDokOeffnen("../portal/psa-aushang.html?k=" + encodeURIComponent(AS.kunde) + "&sys=" + encodeURIComponent(s.id), "PSA-Aushang · " + s.name);
  const vs = box.querySelector("#psaVorsorge"); if(vs) vs.onclick = () => asGehe("nachweise/vorsorge");
  box.querySelectorAll("[data-taet]").forEach(el => el.onclick = () => asPsaTaetDialog(asNach("as_taetigkeit", el.dataset.taet), s, box));
  if(!edit) return;
  const vl = box.querySelector("#psaVorlage"); if(vl) vl.onclick = () => asPsaVorlageUebernehmen(s, vorlageBr, box);
  ["#psaTaetNeu", "#psaTaetNeu2"].forEach(id => { const b = box.querySelector(id); if(b) b.onclick = () => asPsaTaetDialog(null, s, box); });
  const sp = box.querySelector("#psaSpalte"); if(sp) sp.onclick = () => {
    if(!weitere.length){ asMeldung("Alle PSA-Arten sind schon als Spalte da"); return; }
    asDialog({ titel: "PSA-Art als Spalte dazunehmen", inhalt: `<div class="form">${asAuswahl("PSA-Art", "art", weitere[0].schluessel, weitere.map(a => [a.schluessel, a.name]), "voll")}</div>`,
      knoepfe: [{ t: "Dazunehmen", fn: d => { const w = asWerte(d); AS_PSA.extraSpalten[s.id] = (AS_PSA.extraSpalten[s.id] || []).concat(w.art); asPsaMatrix(box); } }] }); };
  box.querySelectorAll("td.z.edit").forEach(el => el.onclick = () => asPsaZelleUmschalten(el.dataset.t, el.dataset.a, box));
}

/* Klick auf eine Zelle schaltet um: leer → Pflicht → leer (empfohlen/Bedingung/Modelle im Tätigkeitsdialog) */
async function asPsaZelleUmschalten(tid, art, box){
  const z = (AS_PSA.d.zuord || []).find(x => x.taetigkeit_id === tid && x.psa_art === art);
  try{
    if(z) await apiSend("DELETE", "/rest/v1/as_psa_zuordnung?id=eq." + encodeURIComponent(z.id), null, "return=minimal");
    else await apiSend("POST", "/rest/v1/as_psa_zuordnung", { kunde_slug: AS.kunde, taetigkeit_id: tid, psa_art: art, pflicht: true, quelle: "betrieb" }, "return=minimal");
    await asPsaLaden(); asPsaMatrix(box);
  }catch(e){ asPsaFehler("PSA-Zuordnung", e, { taetigkeit_id: tid, psa_art: art }); }
}
function asPsaFehler(was, e, details){
  const m = String((e && e.message) || e);
  if(window.OAK_FEHLER && m !== "AUTH") window.OAK_FEHLER("psa", was + ": " + m, Object.assign({ kunde: AS.kunde }, details || {}));
  asMeldung(was + " – nicht gespeichert: " + m.replace(/^HTTP \d+ /, "").slice(0, 140));
}

/* Branchenvorlage: legt fehlende Tätigkeiten an (gleicher Name wird wiederverwendet) und die Matrix; bestehende Zellen bleiben */
async function asPsaVorlageUebernehmen(s, branche, box){
  const zeilen = (AS_PSA.d.vorlage || []).filter(v => v.branche === branche);
  if(!zeilen.length) return;
  if(!confirm(`${zeilen.length} Tätigkeiten mit ihrer PSA aus der Branchenvorlage ${AS_PSA_BRANCHE[branche] || branche} übernehmen?
Vorhandene Tätigkeiten gleichen Namens werden weiterverwendet.`)) return;
  try{
    const n = await asPsaVorlageAnwenden(s, branche);
    asMeldung(`Vorlage übernommen: ${n.taetigkeiten} Tätigkeiten, ${n.felder} PSA-Felder – bitte an den Betrieb anpassen`); asPsaMatrix(box);
  }catch(e){ asPsaFehler("Branchenvorlage", e, { arbeitssystem_id: s.id, branche }); }
}
/* Kern ohne Rückfrage – auch für den Einrichtungs-Assistenten (as-einrichtung.js). Lädt die Vorlage bei Bedarf. */
async function asPsaVorlageAnwenden(s, branche){
  if(!AS_PSA.d || AS_PSA.d.kunde !== AS.kunde || !AS_PSA.d.vorlage) await asPsaLaden();
  const zeilen = (AS_PSA.d.vorlage || []).filter(v => v.branche === branche);
  if(!zeilen.length) return { taetigkeiten: 0, felder: 0 };
  const norm = x => String(x || "").trim().toLowerCase();
  const vorh = asPsaTaetigkeiten(s.id), fehlt = zeilen.filter(v => !vorh.some(t => norm(t.name) === norm(v.taetigkeit)));
  let neu = [];
  if(fehlt.length) neu = (await apiSend("POST", "/rest/v1/as_taetigkeit", fehlt.map(v => ({ kunde_slug: AS.kunde, arbeitssystem_id: s.id, name: v.taetigkeit,
    rollen: [], sort: v.sort })), "return=representation")) || [];
  AS.db.as_taetigkeit = asT("as_taetigkeit").concat(neu);
  const alle = vorh.concat(neu), zuord = [];
  zeilen.forEach(v => { const t = alle.find(x => norm(x.name) === norm(v.taetigkeit)); if(!t) return;
    (v.psa || []).forEach(a => zuord.push({ kunde_slug: AS.kunde, taetigkeit_id: t.id, psa_art: a, pflicht: true,
      bedingung: (v.bedingung || {})[a] || null, quelle: "vorlage:" + branche })); });
  if(zuord.length) await apiSend("POST", "/rest/v1/as_psa_zuordnung?on_conflict=taetigkeit_id,psa_art", zuord, "resolution=ignore-duplicates,return=minimal");
  await asPsaLaden();
  return { taetigkeiten: zeilen.length, felder: zuord.length };
}

/* Tätigkeit: Name, Rollen, je PSA Pflicht/empfohlen, Bedingung, Modelle; Mangel „PSA fehlt / nicht getragen“ */
function asPsaTaetDialog(t, s, box){
  const D = AS_PSA.d, edit = asDarf("pflegen"), neu = !t;
  t = t || { name: "", rollen: [] };
  const sicht = neu ? [] : asPsaSicht(s.id).filter(z => z.taetigkeit_id === t.id);
  const zuord = neu ? [] : (D.zuord || []).filter(z => z.taetigkeit_id === t.id);
  const rollenAlle = [...new Set((D.rollen || []).map(r => r.name).concat(asListe(s.rollen)))].sort((a, b) => a.localeCompare(b, "de"));
  const rollenT = asListe(t.rollen);
  const zeile = z => { const a = asPsaArt(z.psa_art), mods = (D.modelle || []).filter(m => m.psa_art === z.psa_art);
    const gs = z.quelle === "gefahrstoff";
    return `<div class="voll" style="border-top:1px solid var(--linie);padding-top:8px">
      <div style="display:flex;align-items:center;gap:10px">${asPsaZeichen(a, true)}<b style="flex:1">${esc(a.name)}</b>
        ${gs ? asChip("aus Gefahrstoff", "gruen") : ""}
        ${edit ? `<button class="btn sek klein" data-mangel="${esc(z.psa_art)}">Mangel: fehlt / nicht getragen</button>` : ""}</div>
      ${gs ? `<p class="hinweis">Tätigkeit mit ${esc((z.stoffe || []).join(", "))} – Chemikalienschutzhandschuh laut Handschuhplan${(z.modell_ids || []).length ? ": " + esc(z.modell_ids.map(id => ((D.modelle || []).find(m => m.id === id) || {}).name).filter(Boolean).join(", ")) : ""}.</p>`
      : `<div class="form" style="margin-top:6px">${asAuswahl("Festlegung", "pf_" + z.psa_art, z.pflicht ? "1" : "0", [["1", "Pflicht"], ["0", "empfohlen"]])}
        ${asFeld("Bedingung (z. B. ab 85 dB(A))", "bd_" + z.psa_art, z.bedingung || "")}
        ${mods.length ? `<div class="voll"><small>Modelle</small><div style="display:flex;flex-wrap:wrap;gap:4px 14px">${mods.map(m => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-md="${esc(z.psa_art)}" value="${esc(m.id)}" ${(z.modell_ids || []).includes(m.id) ? "checked" : ""}> ${esc(m.name)}</label>`).join("")}</div></div>` : `<p class="hinweis voll">Noch kein Modell dieser Art erfasst (Reiter Modelle).</p>`}</div>`}</div>`; };
  const inhalt = `<div class="form">${asFeld("Tätigkeit", "name", t.name, "text", "voll")}
    <div class="voll"><b>Rollen (wer übt die Tätigkeit aus)</b> <span class="hinweis">ohne Auswahl gelten die Rollen der Beurteilung: ${esc(asListe(s.rollen).join(", ") || "–")}</span>
      <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">${rollenAlle.map(r => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-rl="${esc(r)}" ${rollenT.includes(r) ? "checked" : ""}> ${esc(r)}</label>`).join("") || `<span class="hinweis">Keine Rollen angelegt.</span>`}</div></div>
    ${neu ? `<p class="hinweis voll">Nach dem Speichern die PSA in der Matrix antippen.</p>` : sicht.length ? sicht.map(zeile).join("") : `<p class="hinweis voll">Noch keine PSA – in der Matrix das Feld antippen.</p>`}</div>`;
  const kn = edit ? [{ t: "Speichern", fn: async d => {
    const w = asWerte(d);
    if(!w.name){ asMeldung("Bitte die Tätigkeit benennen"); return false; }
    const rollen = [...d.querySelectorAll("[data-rl]:checked")].map(x => x.dataset.rl);
    try{
      await asSpeichern("as_taetigkeit", Object.assign(neu ? { arbeitssystem_id: s.id, sort: 900 } : { id: t.id }, { name: w.name, rollen }));
      for(const z of zuord){
        const pf = w["pf_" + z.psa_art] === "1", bd = w["bd_" + z.psa_art] || null;
        const md = [...d.querySelectorAll(`[data-md="${z.psa_art}"]:checked`)].map(x => x.value);
        if(pf !== z.pflicht || (bd || null) !== (z.bedingung || null) || md.join(",") !== (z.modell_ids || []).join(","))
          await apiSend("PATCH", "/rest/v1/as_psa_zuordnung?id=eq." + encodeURIComponent(z.id), { pflicht: pf, bedingung: bd, modell_ids: md }, "return=minimal");
      }
      await asPsaLaden(); asMeldung("Gespeichert"); asPsaMatrix(box);
    }catch(e){ asPsaFehler("Tätigkeit", e, { taetigkeit_id: t.id }); return false; }
  } }] : [];
  if(edit && !neu) kn.unshift({ t: "Tätigkeit löschen", klasse: "gefahr", fn: async () => {
    if(!(await asLoeschenBestaetigt("Tätigkeit „" + t.name + "“ samt ihrer PSA löschen?", "as_taetigkeit", t.id))) return false;
    await asPsaLaden(); asPsaMatrix(box); } });
  const dl = asDialog({ titel: neu ? "Tätigkeit anlegen" : t.name, breit: true, inhalt, knoepfe: kn });
  if(!edit) dl.querySelectorAll("input,select,textarea").forEach(x => { x.disabled = true; });
  dl.querySelectorAll("[data-mangel]").forEach(b => b.onclick = () => asPsaMangel(t, s, asPsaArt(b.dataset.mangel)));
}

/* Mängelvorlage „PSA fehlt / nicht getragen“ mit Bezug auf das Matrixfeld (Anlage → Mängelliste der Anlage) */
async function asPsaMangel(t, s, a){
  const anl = asListe(s.anlagen)[0] || "";
  const text = "PSA fehlt / nicht getragen: " + a.name + " bei Tätigkeit „" + t.name + "“ (PSA-Matrix " + s.name + ")";
  asDialog({ titel: "Mangel melden", breit: true, inhalt: `<div class="form">
      ${asFeld("Mangel", "text", text, "textarea", "voll")}
      ${asAuswahl("Was trifft zu", "art", "nicht_getragen", [["nicht_getragen", "PSA wird nicht getragen – unterweisen"], ["fehlt", "PSA fehlt / nicht vorhanden – beschaffen"], ["defekt", "PSA beschädigt – ersetzen"]])}
      ${asFeld("Verantwortlich", "verantwortlich", "")}${asFeld("Termin", "termin", new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), "date")}</div>`,
    knoepfe: [{ t: "Mangel anlegen", fn: async d => {
      const w = asWerte(d), zusatz = { nicht_getragen: " – Beschäftigte unterweisen (§ 3 PSA-BV)", fehlt: " – PSA beschaffen und bereitstellen (§ 2 PSA-BV)", defekt: " – PSA ersetzen (§ 2 PSA-BV)" }[w.art] || "";
      try{
        await asSpeichern("as_massnahme", { text: (w.text || text) + zusatz, stop: "P", anlage: anl ? anl + " " + s.name : "", quelle: "psa", verantwortlich: w.verantwortlich, termin: w.termin, status: "offen",
          folge_art: w.art === "nicht_getragen" ? "unterweisung" : null });
        asMeldung("Mangel angelegt – steht in der Mängelliste" + (anl ? " der Anlage" : ""));
      }catch(e){ asPsaFehler("Mangel PSA", e, { taetigkeit_id: t.id, psa_art: a.schluessel }); return false; }
    } }] });
}

/* ---------------- Modelle ---------------- */
function asPsaModelle(box){
  const D = AS_PSA.d, edit = asDarf("pflegen");
  const arten = D.arten || [];
  if(AS_PSA.art && !arten.some(a => a.schluessel === AS_PSA.art)) AS_PSA.art = "";
  const liste = (D.modelle || []).filter(m => !AS_PSA.art || m.psa_art === AS_PSA.art);
  const einh = (AS.bereich && AS.bereich.einheiten) || asT("as_einheit");
  const bereich = ids => (ids || []).map(id => (einh.find(e => e.id === id) || {}).name).filter(Boolean).join(", ");
  box.innerHTML = `<div class="karte"><h2>Modelle des Betriebs <span class="hinweis">${(D.modelle || []).length} Modelle</span>
      <span>${edit ? `<button class="btn klein" id="psaModNeu">+ Modell</button>` : ""}</span></h2>
    <div class="filterleiste nodruck">${asFilterWahl('id="psaArt"', AS_PSA.art, [["", "alle"]].concat(arten.map(a => [a.schluessel, a.kurz])), "PSA-Art")}
      <span class="fl-zahl">${liste.length} Treffer</span></div>
    ${liste.length ? `<div class="psa-karten">${liste.map(m => { const a = asPsaArt(m.psa_art);
        return `<div class="psa-karte${edit ? " edit" : ""}" data-mod="${esc(m.id)}" title="${esc([m.name, m.hersteller, m.modell].filter(Boolean).join(" · "))}">
        <div class="bild">${asPsaZeichen(a)}${m.bild_url ? `<img class="foto" src="${esc(m.bild_url)}" alt="">` : ""}</div>
        <div class="n">${esc(m.name)}</div><div class="m">${esc([a.kurz, m.hersteller, m.modell].filter(Boolean).join(" · "))}</div>
        <div class="s">${esc([m.schutzstufe || m.normen, m.groessen ? "Größen " + m.groessen : "", m.snr ? "SNR " + m.snr : "", bereich(m.einheit_ids)].filter(Boolean).join(" · ") || "–")}</div></div>`; }).join("")}</div>`
      : `<div class="leer">Noch kein Modell erfasst.</div>`}
    <p class="psa-fuss">Chemikalienschutzhandschuhe stehen zusätzlich im Handschuhplan je Gefahrstoff (Gefahrstoffkataster › Handschuhplan) – dieselben Einträge, dort mit der Zuordnung zu den Stoffen.</p></div>`;
  box.querySelector("#psaArt").onchange = ev => { AS_PSA.art = ev.target.value; asPsaModelle(box); };
  if(!edit) return;
  box.querySelector("#psaModNeu").onclick = () => asPsaModellDialog(null, einh, box);
  box.querySelectorAll("[data-mod]").forEach(el => el.onclick = () => asPsaModellDialog((D.modelle || []).find(m => m.id === el.dataset.mod), einh, box));
}
function asPsaModellDialog(m, einh, box){
  const neu = !m; m = m || { psa_art: AS_PSA.art || "sicherheitsschuhe", farbe: "#2D6A4F", einheit_ids: [] };
  const arten = AS_PSA.d.arten || [];
  const kn = [{ t: "Speichern", fn: async d => {
    const w = asWerte(d);
    if(!w.name){ asMeldung("Bitte einen Kurznamen vergeben"); return false; }
    w.einheit_ids = [...d.querySelectorAll("[data-pe]:checked")].map(x => x.dataset.pe);
    w.chemikalienschutz = w.psa_art === "handschuh_chemie" ? !!w.chemikalienschutz : false;
    try{
      if(neu) await apiSend("POST", "/rest/v1/portal_handschuh", Object.assign({ kunde_slug: AS.kunde }, w), "return=minimal");
      else await apiSend("PATCH", "/rest/v1/portal_handschuh?id=eq." + encodeURIComponent(m.id), w, "return=minimal");
      await asPsaLaden(); asMeldung("Gespeichert"); asPsaModelle(box);
    }catch(e){ asPsaFehler("PSA-Modell", e, { id: m.id }); return false; }
  } }];
  if(!neu) kn.unshift({ t: "Ausmustern", klasse: "gefahr", fn: async () => {
    if(!confirm("Modell ausmustern? Es verschwindet aus Matrix, Aushang und Handschuhplan.")) return false;
    await apiSend("PATCH", "/rest/v1/portal_handschuh?id=eq." + encodeURIComponent(m.id), { aktiv: false }, "return=minimal"); await asPsaLaden(); asPsaModelle(box); } });
  asDialog({ titel: neu ? "PSA-Modell erfassen" : "Modell: " + m.name, breit: true, knoepfe: kn, inhalt: `<div class="form">
    ${asAuswahl("PSA-Art", "psa_art", m.psa_art, arten.map(a => [a.schluessel, a.name]))}
    ${asFeld("Kurzname für Beschäftigte", "name", m.name)}
    ${asFeld("Hersteller", "hersteller", m.hersteller)}${asFeld("Modell", "modell", m.modell)}
    ${asFeld("Artikelnummer", "artikel", m.artikel)}${asFeld("Schutzstufe (z. B. S3, EN 388 4X42C)", "schutzstufe", m.schutzstufe)}
    ${asFeld("Normen / Kennzeichnung", "normen", m.normen)}${asFeld("Größen", "groessen", m.groessen)}
    ${asFeld("SNR (nur Gehörschutz)", "snr", m.snr)}${asFeld("Anzeigefarbe", "farbe", m.farbe || "#2D6A4F", "color")}
    ${asFeld("Material", "material", m.material)}${asFeld("Chemikalienschutz (EN ISO 374-1)", "chemikalienschutz", m.chemikalienschutz, "checkbox")}
    ${asFeld("Merksatz für Beschäftigte", "einsatz", m.einsatz, "textarea", "voll")}
    ${asFeld("Foto-Adresse (URL)", "bild_url", m.bild_url, "text", "voll")}
    <div class="voll"><b>Bereiche, in denen das Modell ausliegt</b><div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">
      ${einh.map(e => `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-pe="${esc(e.id)}" ${(m.einheit_ids || []).includes(e.id) ? "checked" : ""}> ${esc(e.name)}</label>`).join("")}</div></div></div>` });
}

/* ---------------- Ausgabe: Person → Rolle → Tätigkeit → PSA → Modell ---------------- */
function asPsaBedarf(){
  const D = AS_PSA.d, norm = x => String(x || "").trim().toLowerCase();
  const rolleName = Object.fromEntries((D.rollen || []).map(r => [r.id, r.name]));
  const sysV = Object.fromEntries(asPsaSysteme().map(s => [s.id, s]));
  const taetV = Object.fromEntries(asT("as_taetigkeit").map(t => [t.id, t]));
  return (D.personen || []).map(p => {
    const rollen = (p.uw_person_rolle || []).map(r => rolleName[r.rolle_id]).filter(Boolean);
    const rs = new Set(rollen.map(norm)), bedarf = {};
    (D.sicht || []).filter(z => z.pflicht && sysV[z.arbeitssystem_id]).forEach(z => {
      const t = taetV[z.taetigkeit_id] || { rollen: z.rollen }, s = sysV[z.arbeitssystem_id];
      if(!asPsaRollenVon(t, s).some(r => rs.has(norm(r)))) return;
      const b = bedarf[z.psa_art] = bedarf[z.psa_art] || { art: z.psa_art, modelle: new Set(), wo: new Set() };
      (z.modell_ids || []).forEach(m => b.modelle.add(m)); b.wo.add(z.taetigkeit + " (" + s.name + ")");
    });
    const aus = (D.ausgabe || []).filter(a => a.person_id === p.id);
    const liste = Object.values(bedarf).sort((a, b) => asPsaArt(a.art).sort - asPsaArt(b.art).sort)
      .map(b => Object.assign(b, { letzte: aus.find(a => a.psa_art === b.art) || null }));
    return { p, rollen, liste, offen: liste.filter(b => !b.letzte).length, aus };
  });
}
function asPsaAusgabe(box){
  const D = AS_PSA.d, edit = asDarf("pflegen"), alle = asPsaBedarf();
  if(AS_PSA.rolle && !(D.rollen || []).some(r => r.id === AS_PSA.rolle)) AS_PSA.rolle = "";
  const q = AS_PSA.q.trim().toLowerCase();
  const zeigen = alle.filter(x => x.liste.length && (!AS_PSA.rolle || (x.p.uw_person_rolle || []).some(r => r.rolle_id === AS_PSA.rolle))
    && (!q || x.p.name.toLowerCase().includes(q)));
  const ohne = alle.filter(x => !x.liste.length).length;
  box.innerHTML = `<div class="karte"><h2>Ausgabeliste <span class="hinweis">${zeigen.length} Personen mit PSA-Bedarf</span>
      <span><button class="btn sek klein" id="psaDruck">Drucken</button></span></h2>
    <div class="filterleiste nodruck">${asFilterWahl('id="psaRolle"', AS_PSA.rolle, [["", "alle"]].concat((D.rollen || []).map(r => [r.id, r.name])), "Rolle")}
      <input type="search" id="psaQ" value="${esc(AS_PSA.q)}" placeholder="Person suchen …" autocomplete="off">
      <span class="fl-zahl">${zeigen.filter(x => x.offen).length} mit offener Ausgabe</span></div>
    ${zeigen.length ? `<div class="tabwrap"><table class="tab psa-tab psa-person"><thead><tr><th class="t" style="width:24%">Person</th><th style="width:22%;text-align:left">Rolle</th><th style="text-align:left">PSA laut Matrix</th><th style="width:150px">Ausgabe</th></tr></thead>
      <tbody>${zeigen.map(x => `<tr data-pers="${esc(x.p.id)}" style="cursor:pointer"><td class="t" title="${esc(x.p.name)}">${esc(x.p.name)}</td>
        <td style="text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(x.rollen.join(", "))}">${esc(x.rollen.join(", "))}</td>
        <td style="text-align:left"><span class="psa-icons">${x.liste.map(b => asPsaZeichen(asPsaArt(b.art), true)).join("")}</span></td>
        <td>${x.offen ? asChip(x.offen + " offen", "gelb") : asChip("vollständig", "gruen")}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="leer">Keine Person mit PSA-Bedarf. Bedarf entsteht über Person → Rolle → Tätigkeit in der Matrix (Rollen unter Unterweisungen › Mitarbeiter zuordnen).</div>`}
    <p class="psa-fuss">${ohne ? ohne + " weitere Personen ohne PSA-Bedarf laut Matrix. " : ""}Grundlage: § 2 PSA-Benutzungsverordnung (Bereitstellung), § 3 PSA-BV (Unterweisung). Zeile antippen: Ausgabe eintragen und quittieren lassen.</p></div>`;
  box.querySelector("#psaRolle").onchange = ev => { AS_PSA.rolle = ev.target.value; asPsaAusgabe(box); };
  const s = box.querySelector("#psaQ"); s.oninput = () => { AS_PSA.q = s.value; clearTimeout(AS_PSA.qT); AS_PSA.qT = setTimeout(() => { asPsaAusgabe(box); const n = document.getElementById("psaQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); };
  box.querySelector("#psaDruck").onclick = () => window.print();
  box.querySelectorAll("[data-pers]").forEach(el => el.onclick = () => asPsaPersonDialog(alle.find(x => x.p.id === el.dataset.pers), edit, box));
}
function asPsaPersonDialog(x, edit, box){
  const D = AS_PSA.d, modName = id => ((D.modelle || []).find(m => m.id === id) || {}).name || "";
  const inhalt = `<div class="form">${x.liste.map(b => { const a = asPsaArt(b.art), mods = (D.modelle || []).filter(m => m.psa_art === b.art);
      const vor = [...b.modelle][0] || (mods[0] || {}).id || "";
      return `<div class="voll" style="border-top:1px solid var(--linie);padding-top:8px">
        <div style="display:flex;align-items:center;gap:10px">${asPsaZeichen(a, true)}<b style="flex:1">${esc(a.name)}</b>
          ${b.letzte ? asChip("ausgegeben " + asDat(b.letzte.ausgegeben_am) + (b.letzte.quittiert_am ? " · quittiert" : ""), b.letzte.quittiert_am ? "gruen" : "gelb") : asChip("offen", "gelb")}</div>
        <small class="hinweis">${esc([...b.wo].join(" · "))}</small>
        ${edit ? `<div class="form" style="margin-top:6px">
          ${asAuswahl("Modell", "md_" + b.art, vor, [["", "–"]].concat(mods.map(m => [m.id, m.name])))}
          ${asFeld("Größe", "gr_" + b.art, (b.letzte || {}).groesse || "")}
          ${asFeld("Heute ausgeben", "neu_" + b.art, false, "checkbox")}${asFeld("vom Beschäftigten quittiert", "qu_" + b.art, false, "checkbox")}</div>` : ""}</div>`; }).join("")}
    ${x.aus.length ? `<div class="voll"><b>Bisherige Ausgaben</b><div class="zeilen">${x.aus.map(a => `<div class="z"><div><b>${esc(asPsaArt(a.psa_art).name)}</b><small>${esc([modName(a.modell_id), a.groesse ? "Größe " + a.groesse : "", "ausgegeben " + asDat(a.ausgegeben_am), a.erfasst_von ? "von " + a.erfasst_von : ""].filter(Boolean).join(" · "))}</small></div>
      ${a.quittiert_am ? asChip("quittiert " + asDat(a.quittiert_am), "gruen") : edit ? `<button class="btn sek klein" data-quitt="${esc(a.id)}">quittiert</button>` : asChip("nicht quittiert", "gelb")}</div>`).join("")}</div></div>` : ""}</div>`;
  const dl = asDialog({ titel: "PSA-Ausgabe: " + x.p.name, breit: true, inhalt, knoepfe: edit ? [{ t: "Ausgabe speichern", fn: async d => {
    const w = asWerte(d), zeilen = x.liste.filter(b => w["neu_" + b.art]).map(b => ({ kunde_slug: AS.kunde, person_id: x.p.id, psa_art: b.art,
      modell_id: w["md_" + b.art] || null, groesse: w["gr_" + b.art] || null, ausgegeben_am: asHeute(), quittiert_am: w["qu_" + b.art] ? asHeute() : null }));
    if(!zeilen.length){ asMeldung("Bitte bei mindestens einer PSA „Heute ausgeben“ ankreuzen"); return false; }
    try{ await apiSend("POST", "/rest/v1/as_psa_ausgabe", zeilen, "return=minimal"); await asPsaLaden(); asMeldung("Ausgabe eingetragen"); asPsaAusgabe(box); }
    catch(e){ asPsaFehler("PSA-Ausgabe", e, { person_id: x.p.id, zeilen }); return false; }
  } }] : [] });
  dl.querySelectorAll("[data-quitt]").forEach(b => b.onclick = async () => {
    try{ await apiSend("PATCH", "/rest/v1/as_psa_ausgabe?id=eq." + encodeURIComponent(b.dataset.quitt), { quittiert_am: asHeute() }, "return=minimal");
      await asPsaLaden(); dl.close(); asPsaAusgabe(box); asMeldung("Quittung eingetragen"); }
    catch(e){ asPsaFehler("PSA-Quittung", e, { id: b.dataset.quitt }); } });
}

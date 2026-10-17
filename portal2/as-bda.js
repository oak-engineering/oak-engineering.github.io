/* OAK Arbeitsschutz-App – BdA (P10), Massnahmen und Wirksamkeit (P11), Mitzeichnung der Sifa (P12). */
"use strict";

const AS_STOP = { S: "Substitution", T: "technisch", O: "organisatorisch", P: "persönlich" };
function asStopChip(s){ return `<span class="stop stop-${esc(s)}" title="${esc(AS_STOP[s] || "")}">${esc(s)}</span>`; }
function asStatusChip(m){
  if(m.status === "wirksam") return asChip("wirksam", "gruen");
  if(m.status === "erledigt") return asChip("Wirksamkeit prüfen", "gelb");
  if(m.termin && m.termin < asHeute()) return asChip("überfällig", "rot");
  return asChip("offen", "grau");
}
function asListe(v){ return Array.isArray(v) ? v : String(v || "").split(",").map(x => x.trim()).filter(Boolean); }

/* ======================= BdA ======================= */
AS_SEITEN.bda = { titel: "Beurteilung (BdA)", icon: "⚠", sort: 4, render(main){
  const id = AS.reiter.bda && AS.reiter.bda.length > 20 ? AS.reiter.bda : null;
  const sys = id && asNach("as_arbeitssystem", id);
  if(sys) return asBdaSystem(main, sys);
  const liste = asT("as_arbeitssystem");
  main.innerHTML = `<h1 class="seite">Beurteilung der Arbeitsbedingungen</h1>
    <p class="unter">Je Arbeitssystem alle Tätigkeiten mit Gefährdungen, Belastungen und Ressourcen – ein übersichtliches Dokument, das die Geschäftsführung freigibt.</p>
    <div class="karte"><h2>Arbeitssysteme ${AS.fachkraft ? `<button class="btn klein" id="sysNeu">+ Arbeitssystem</button>` : ""}</h2><div class="zeilen">
    ${liste.map(s => { const b = asBand(asSystemRisiko(s.id)), psy = asT("as_psyche").some(p => p.arbeitssystem_id === s.id);
      const nT = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id).length;
      return `<div class="z" data-s="${s.id}"><div><b>${asPunkt(b)}${esc(s.name)}</b><small>${esc(asEinheitName(s.einheit_id))} · ${nT} Tätigkeiten · Risiko heute: ${asBandText(b)}
        · ${psy ? "Psyche beurteilt" : "Psyche offen"} · ${s.ba_vorhanden ? "BA vorhanden" : "BA fehlt"}</small></div>
        ${s.freigabe_am ? asChip("freigegeben " + asDat(s.freigabe_am), "gruen") : asChip("nicht freigegeben", "gelb")}</div>`; }).join("") || `<div class="leer">Noch kein Arbeitssystem. Beispiel: „Spritzgießen“, „Lager und Versand“, „Verwaltung“.</div>`}</div></div>`;
  const n = document.getElementById("sysNeu"); if(n) n.onclick = () => asSystemDialog(null);
  main.querySelectorAll("[data-s]").forEach(z => z.onclick = () => asGehe("bda/" + z.dataset.s));
}};

/* Rollen kommen aus der Unterweisung (uw_rolle) – dieselben Rollen bestimmen, wer nach einer Änderung neu unterwiesen wird.
   Anlagen aus dem Anlagenkataster (Durchlauf 15.10.2026: vorher Freitext, nicht verknüpft). */
async function asSystemDialog(s){
  const neu = !s; s = s || { rollen: [], anlagen: [] };
  const rollen = (await apiGet("/rest/v1/uw_rolle?select=id,name,status&kunde_slug=eq." + encodeURIComponent(AS.kunde) + "&order=name.asc").catch(() => []) || []).filter(r => r.status !== "archiviert");
  if(typeof asBetriebLaden === "function") await asBetriebLaden().catch(() => {});
  const anl = (typeof asAnlagen === "function" ? asAnlagen() : []).filter(d => d.maschinen_id);
  const gewR = new Set(asListe(s.rollen)), gewA = new Set(asListe(s.anlagen));
  const fremdR = [...gewR].filter(n => !rollen.some(r => r.name === n)), fremdA = [...gewA].filter(m => !anl.some(d => d.maschinen_id === m));
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.name){ asMeldung("Name fehlt"); return false; }
    w.rollen = [...d.querySelectorAll("[data-sr]:checked")].map(x => x.value).concat(asListe(w.rollen_neu));
    w.anlagen = [...d.querySelectorAll("[data-sa]:checked")].map(x => x.value); delete w.rollen_neu; w.einheit_id = w.einheit_id || null;
    const neuR = asListe(d.querySelector('[data-f="rollen_neu"]').value);
    for(const n of neuR) await apiSend("POST", "/rest/v1/uw_rolle", { kunde_slug: AS.kunde, name: n, typ: "eigen", status: "aktiv" }, "return=minimal").catch(() => {});
    const r = await asSpeichern("as_arbeitssystem", Object.assign({ id: s.id }, w)); asGehe("bda/" + r.id); asZeige(); } }];
  if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!confirm("Arbeitssystem mit allen Tätigkeiten und Gefährdungen löschen?")) return false;
    await asLoeschen("as_arbeitssystem", s.id); await asLaden(); asGehe("bda"); } });
  asDialog({ titel: neu ? "Neues Arbeitssystem" : s.name, inhalt: `<div class="form">
      ${asFeld("Name", "name", s.name, "text", "voll")}
      ${asBereichWahl("Bereich", "einheit_id", s.einheit_id || "", "", "– betriebsweit –")}
      ${asFeld("Betriebsanweisungen vorhanden und ausgehängt", "ba_vorhanden", s.ba_vorhanden, "checkbox")}
      <div class="voll"><b>Wer arbeitet hier? (Rollen aus der Unterweisung)</b><div class="hakenliste">
        ${rollen.map(r => `<label><input type="checkbox" data-sr value="${esc(r.name)}"${gewR.has(r.name) ? " checked" : ""}> ${esc(r.name)}</label>`).join("")}
        ${fremdR.map(n => `<label title="Diese Rolle gibt es in der Unterweisung noch nicht"><input type="checkbox" data-sr value="${esc(n)}" checked> ${esc(n)} ⚠</label>`).join("")}
        ${rollen.length || fremdR.length ? "" : `<span class="hinweis">Noch keine Rollen – unter Unterweisungen → Mitarbeiter → „Bereiche &amp; Rollen“ anlegen.</span>`}</div></div>
      ${asFeld("Weitere Rolle (wird in der Unterweisung als Rolle angelegt)", "rollen_neu", "", "text", "voll")}
      <div class="voll"><b>Anlagen in diesem Arbeitssystem</b><div class="hakenliste">
        ${anl.map(d => `<label><input type="checkbox" data-sa value="${esc(d.maschinen_id)}"${gewA.has(d.maschinen_id) ? " checked" : ""}> ${esc(d.maschine || d.titel)} <span class="hinweis">${esc(d.maschinen_id)}</span></label>`).join("")}
        ${fremdA.map(m => `<label><input type="checkbox" data-sa value="${esc(m)}" checked> ${esc(m)} ⚠</label>`).join("")}</div></div>
      ${asFeld("Beschreibung", "beschreibung", s.beschreibung, "textarea", "voll")}</div>`, knoepfe: kn });
}

function asBdaSystem(main, s){
  const r = asReiter("bda_" + s.id, [["tabelle", "Beurteilung"], ["bearbeiten", "Bearbeiten"], ["dokumente", "Dokumente & BA"], ["psyche", "Psychische Belastung"]], "tabelle");
  main.innerHTML = `<p class="nodruck"><a href="#bda" onclick="AS.reiter.bda=''">← alle Arbeitssysteme</a></p>
    <h1 class="seite">${esc(s.name)}</h1><p class="unter">${esc(asEinheitName(s.einheit_id))} · Rollen: ${esc(asListe(s.rollen).join(", ") || "–")}</p>
    <div class="reiter nodruck">${[["tabelle", "Beurteilung"], ["bearbeiten", "Bearbeiten"], ["dokumente", "Dokumente & BA"], ["psyche", "Psychische Belastung"]].map(([k, t]) =>
      `<button class="${k === r.akt ? "an" : ""}" data-r="${k}">${t}</button>`).join("")}</div><div id="sysInhalt"></div>`;
  main.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { AS.reiter["bda_" + s.id] = b.dataset.r; asBdaSystem(main, s); });
  const box = document.getElementById("sysInhalt");
  ({ tabelle: asBdaTabelle, bearbeiten: asBdaBearbeiten, psyche: asBdaPsyche, dokumente: typeof asBdaDokumente === "function" ? asBdaDokumente : asBdaTabelle })[r.akt](box, s);
}

/* Kundenansicht wie die klassische taetigkeitsbezogene GBU: Taetigkeit | Gefaehrdung | Risiko 1-2-3 | Massnahmen | Wer | Bis wann | Stand */
function asBdaTabelle(box, s){
  const tk = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id);
  const gef = asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id);
  const stufe = r => r >= 9 ? 3 : r >= 4 ? 2 : r > 0 ? 1 : 0;
  const ampel = r => { const st = stufe(r); return `<div class="ampel3">${[1, 2, 3].map(i => `<span style="background:${i === st ? ["", "var(--gruen)", "var(--gelb)", "var(--rot)"][i] : "#eef1f5"}">${i === st ? i : ""}</span>`).join("")}</div>`; };
  let nr = 0, rows = "";
  const gruppen = tk.concat(gef.some(g => !g.taetigkeit_id && g.art !== "ressource")
    ? [{ id: null, name: tk.length ? "Anlage gesamt (alle Betriebszustände)" : "Arbeitsplatz / Anlage gesamt", rollen: s.rollen }] : []);
  gruppen.forEach(t => { const gg = gef.filter(g => (g.taetigkeit_id || null) === t.id && g.art !== "ressource");
    if(!gg.length){ rows += `<tr><td>${++nr}</td><td><b>${esc(t.name)}</b><div class="hinweis">${esc(asListe(t.rollen).join(", "))}</div></td><td colspan="5" class="hinweis">noch keine Gefährdung erfasst</td></tr>`; return; }
    gg.forEach((g, i) => {
      // Massnahmen je Anlage zu einer Zeile buendeln: „x von y Anlagen wirksam"
      const ms = [], gesehen = new Set();
      asMassnahmenZu(g.id).forEach(m => { if(!m.gruppe){ ms.push({ m }); return; } if(gesehen.has(m.gruppe)) return; gesehen.add(m.gruppe);
        const alle = asT("as_massnahme").filter(x => x.gruppe === m.gruppe); ms.push({ m, alle }); });
      const stand = e => { if(!e.alle) return asStatusChip(e.m); const w = e.alle.filter(x => x.status === "wirksam").length;
        return asChip(w + " von " + e.alle.length + " Anlagen wirksam", w === e.alle.length ? "gruen" : "gelb"); };
      const mzeilen = ms.map(e => `<div class="mz"><div>${asStopChip(e.m.stop)}${esc(e.m.text)}</div><div>${esc(e.m.verantwortlich || "–")}</div><div>${asDat(e.m.termin)}</div><div>${stand(e)}</div></div>`).join("")
        || `<div class="mz"><div class="hinweis">keine Maßnahme</div><div></div><div></div><div></div></div>`;
      rows += `<tr>${i === 0 ? `<td rowspan="${gg.length}">${++nr}</td><td rowspan="${gg.length}"><b>${esc(t.name)}</b><div class="hinweis">${esc(asListe(t.rollen).join(", "))}</div></td>` : ""}
        <td>${esc(g.kurz)}<div class="hinweis">${esc(g.faktor || "")}${g.art === "belastung" ? " · Belastung" : ""}</div></td><td>${ampel(asGefRisiko(g))}</td>
        <td colspan="4" style="padding:0">${mzeilen}</td></tr>`; }); });
  const res = gef.filter(g => g.art === "ressource");
  box.innerHTML = `<div class="karte"><h2>Beurteilung der Arbeitsbedingungen – ${esc(s.name)}
      <span class="nodruck"><button class="btn sek klein" onclick="window.print()">Drucken</button>
      ${s.freigabe_am ? (AS.gf ? `<button class="btn adm klein" id="frZur">Freigabe zurücknehmen</button>` : "")
        : (AS.gf ? `<button class="btn klein" id="frGeben">Freigeben (Geschäftsführung)</button>`
          : (AS.fachkraft ? (s.vorgelegt_am ? `<span class="hinweis">zur Freigabe vorgelegt ${asDat(s.vorgelegt_am)}</span>` : `<button class="btn klein" id="frVorlegen">Zur Freigabe vorlegen</button>`)
            : `<span class="hinweis">Freigabe durch die Geschäftsführung</span>`))}</span></h2>
    <p class="hinweis">Arbeitsbereich: ${esc(asEinheitName(s.einheit_id))} · Beschäftigte: ${esc(asListe(s.rollen).join(", "))} · Stand ${asDat(asHeute())}
      · ${s.freigabe_am ? "freigegeben am " + asDat(s.freigabe_am) + " von " + esc(s.freigabe_von) : "<b>noch nicht freigegeben</b>"}</p>
    <div class="tabwrap"><table class="tab"><tr><th>Nr.</th><th>Tätigkeit</th><th>Gefährdung / Belastung</th><th>Risiko*</th><th colspan="4"><div class="mz mz-kopf"><div>Maßnahmen (STOP)</div><div>Wer</div><div>Bis wann</div><div>Stand</div></div></th></tr>
    ${rows || `<tr><td colspan="8" class="leer">Unter „Bearbeiten“ Tätigkeiten und Gefährdungen erfassen.</td></tr>`}</table></div>
    <p class="hinweis">* Risiko heute: 1 gering · 2 mittel · 3 hoch. Erst wenn alle Maßnahmen einer Gefährdung wirksam sind, gilt das Restrisiko.
      STOP: S Substitution · T technisch · O organisatorisch · P persönlich.</p>
    ${res.length ? `<h3>Ressourcen</h3>${res.map(g => `<div class="krit"><span class="ok">+</span><div><b>${esc(g.kurz)}</b> <span class="hinweis">${esc(g.faktor || "")} ${esc(g.beschreibung || "")}</span></div></div>`).join("")}` : ""}
    <div class="hinweis" style="margin-top:14px">Fachliche Herleitung: Bewertung nach Wahrscheinlichkeit × Schwere (je 1–4) unter „Bearbeiten“.</div></div>`;
  const fg = document.getElementById("frGeben"); if(fg) fg.onclick = () => asDialog({ titel: "BdA freigeben", inhalt: `<p>Mit der Freigabe übernimmt die Geschäftsführung die Beurteilung als verbindlich.</p>
      <div class="form">${asFeld("Datum", "freigabe_am", asHeute(), "date")}</div><p class="hinweis">Freigegeben wird unter Ihrem Namen (${esc(AS.ich)}).</p>`,
    knoepfe: [{ t: "Freigeben", fn: async d => { const w = asWerte(d); w.freigabe_von = AS.ich;
      await asSpeichern("as_arbeitssystem", { id: s.id, ...w, vorgelegt_am: null, vorgelegt_von: null }); asZeige(); } }] });
  const fv = document.getElementById("frVorlegen"); if(fv) fv.onclick = async () => {
    await asSpeichern("as_arbeitssystem", { id: s.id, vorgelegt_am: new Date().toISOString(), vorgelegt_von: AS.ich });
    asMeldung("Der Geschäftsführung zur Freigabe vorgelegt – sie sieht es in ihren Aufgaben"); asZeige(); };
  const fz = document.getElementById("frZur"); if(fz) fz.onclick = async () => { await asSpeichern("as_arbeitssystem", { id: s.id, freigabe_am: null, freigabe_von: null }); asZeige(); };
}

function asBdaBearbeiten(box, s){
  const tk = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id);
  const gef = asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id);
  const zeile = g => { const r = asRisiko(g.w_v, g.s_v), rn = asRisiko(g.w_n, g.s_n), n = asMassnahmenZu(g.id).length;
    return `<div class="z" data-g="${g.id}"><div><b>${asPunkt(asBand(r))}${esc(g.kurz)}</b><small>${esc(g.art === "ressource" ? "Ressource" : g.faktor || "")}
      ${g.art !== "ressource" ? ` · ${g.w_v || "?"}×${g.s_v || "?"} → ${g.w_n || "?"}×${g.s_n || "?"} · ${n} Maßnahme${n === 1 ? "" : "n"}` : ""}</small></div>${g.art !== "ressource" ? asChip(r + " → " + rn, asBand(r)) : asChip("Ressource", "blau")}</div>`; };
  box.innerHTML = `<div class="karte"><h2>Einstellungen <button class="btn sek klein" id="sysEdit">Bearbeiten</button></h2>
      <p class="hinweis">Anlagen: ${esc(asListe(s.anlagen).join(", ") || "–")} · BA ${s.ba_vorhanden ? "vorhanden" : "fehlt"}</p></div>
    ${tk.map(t => `<div class="karte"><h2><span>${esc(t.name)} <span class="hinweis">${esc(asListe(t.rollen).join(", "))}</span></span>
        <span><button class="btn sek klein" data-te="${t.id}">Tätigkeit</button> <button class="btn klein" data-gn="${t.id}">+ Gefährdung</button></span></h2>
      <div class="zeilen">${gef.filter(g => g.taetigkeit_id === t.id).map(zeile).join("") || `<div class="leer">Noch keine Gefährdung.</div>`}</div></div>`).join("")}
    <div class="karte"><h2>Ohne Tätigkeitsbezug (z. B. Ressourcen) <button class="btn klein" data-gn="">+ Eintrag</button></h2><div class="zeilen">${gef.filter(g => !g.taetigkeit_id).map(zeile).join("") || `<div class="leer">–</div>`}</div></div>
    <p><button class="btn" id="tkNeu">+ Tätigkeit</button></p>`;
  document.getElementById("sysEdit").onclick = () => asSystemDialog(s);
  document.getElementById("tkNeu").onclick = () => asTaetigkeitDialog(s, null);
  box.querySelectorAll("[data-te]").forEach(b => b.onclick = () => asTaetigkeitDialog(s, asNach("as_taetigkeit", b.dataset.te)));
  box.querySelectorAll("[data-gn]").forEach(b => b.onclick = () => asGefDialog(s, null, b.dataset.gn || null));
  box.querySelectorAll("[data-g]").forEach(z => z.onclick = () => asGefDialog(s, asNach("as_gefaehrdung", z.dataset.g)));
}
function asTaetigkeitDialog(s, t){
  const neu = !t; t = t || { rollen: asListe(s.rollen).slice(0, 1) };
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.name){ asMeldung("Name fehlt"); return false; }
    w.rollen = asListe(w.rollen); await asSpeichern("as_taetigkeit", Object.assign({ id: t.id, arbeitssystem_id: s.id, sort: t.sort || asT("as_taetigkeit").length }, w)); asZeige(); } }];
  if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!confirm("Tätigkeit mit ihren Gefährdungen löschen?")) return false; await asLoeschen("as_taetigkeit", t.id); await asLaden(); asZeige(); } });
  asDialog({ titel: neu ? "Neue Tätigkeit" : t.name, inhalt: `<div class="form">${asFeld("Tätigkeit (z. B. Werkzeugwechsel, Störung beseitigen)", "name", t.name, "text", "voll")}
    ${asFeld("Wer führt sie aus? (Rollen mit Komma)", "rollen", asListe(t.rollen).join(", "), "text", "voll")}</div>
    <p class="hinweis">Rollen dieses Arbeitssystems: ${esc(asListe(s.rollen).join(", ") || "–")}</p>`, knoepfe: kn });
}
/* Vorschaubilder der Gefährdungsfotos (signiert, nur eigener Fotoordner) */
async function asGefFotosZeigen(){
  for(const img of document.querySelectorAll("#gefFotoListe img[data-fpfad]")){
    const p = img.dataset.fpfad; if(!p || !p.startsWith(AS.kunde + "/bda-fotos/")) continue;
    const u = await asSigniert(p); if(u) img.src = u;
  }
}
function asGefDialog(s, g, taetigkeitId){
  const neu = !g; g = g || { art: "gefaehrdung", taetigkeit_id: taetigkeitId, w_v: 2, s_v: 2, w_n: 1, s_n: 2 };
  const ws = (f, v) => asAuswahl(f.startsWith("w") ? "Wahrscheinlichkeit " + (f.endsWith("v") ? "vorher" : "nachher") : "Schwere " + (f.endsWith("v") ? "vorher" : "nachher"), f, v || "", [["", "–"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]]);
  const ms = g.id ? asMassnahmenZu(g.id) : [];
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.kurz){ asMeldung("Kurztext fehlt"); return false; }
    ["w_v", "s_v", "w_n", "s_n"].forEach(k => w[k] = w[k] ? +w[k] : null); w.taetigkeit_id = w.taetigkeit_id || null;
    /* Schutzmaßnahmen zeilenweise „T: Text“ (S/T/O/P) – vorhandene Zusatzangaben (Priorität, Status …) bleiben erhalten */
    if("schutz_text" in w){ const alt = g.schutzmassnahmen || [];
      w.schutzmassnahmen = String(w.schutz_text || "").split(/\n/).map(z => z.trim()).filter(Boolean).map(z => {
        const m = /^([STOP])\s*[:|]\s*(.+)$/i.exec(z), stop = m ? m[1].toUpperCase() : "T", text = m ? m[2].trim() : z;
        return Object.assign({}, alt.find(x => x.text === text) || {}, { stop, text }); });
      delete w.schutz_text; }
    /* Fotos: abgewählte entfernen, neue hochladen (Storage <slug>/bda-fotos/cockpit/…, nur Fachkraft/GF) */
    const behalten = new Set([...d.querySelectorAll("[data-fbeh]:checked")].map(x => x.dataset.fbeh));
    let fotos = (g.fotos || []).filter((f, i) => behalten.has(String(i)));
    const dateien = [...((d.querySelector("#gefFotos") || {}).files || [])];
    const r = await asSpeichern("as_gefaehrdung", Object.assign({ id: g.id, arbeitssystem_id: s.id }, w, g.id ? { fotos } : {}));
    if(dateien.length){
      const gid = (r && r.id) || g.id;
      for(const [i, f] of dateien.entries()){
        const pfad = AS.kunde + "/bda-fotos/cockpit/" + gid + "-" + Date.now() + "-" + i + ".jpg";
        await asFotoHochladen(f, pfad); fotos.push({ pfad, alt: f.name.replace(/\.[^.]+$/, "") });
      }
      await asSpeichern("as_gefaehrdung", { id: gid, fotos });
    }
    asZeige(); } }];
  if(!neu){
    kn.unshift({ t: "+ Maßnahme", klasse: "sek", fn: () => { asMassnahmeDialog(null, { gefaehrdung_id: g.id, quelle: "bda" }, s); return false; } });
    if(AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!confirm("Gefährdung löschen? Maßnahmen bleiben ohne Bezug erhalten.")) return false; await asLoeschen("as_gefaehrdung", g.id); await asLaden(); asZeige(); } });
  }
  asDialog({ titel: neu ? "Neue Gefährdung / Belastung / Ressource" : g.kurz, breit: true, inhalt: `${g.gefahrstoff_id ? `<p class="hinweis voll">Gefahrstoff aus dem Kataster – Beurteilung nach EMKG, Betriebsanweisung und Handschuh dort:
      <button type="button" class="btn sek klein" onclick="document.getElementById('dlg').close(); AS_GS.oeffnen='${esc(g.gefahrstoff_id)}'; asGehe('gefahrstoffe/kataster')">Im Gefahrstoffkataster öffnen</button></p>` : ""}<div class="form">
      ${asAuswahl("Art", "art", g.art, [["gefaehrdung", "Gefährdung"], ["belastung", "Belastung (physisch/psychisch)"], ["ressource", "Ressource (stärkt die Beschäftigten)"]])}
      ${asAuswahl("Tätigkeit", "taetigkeit_id", g.taetigkeit_id || "", [["", "– ohne Tätigkeitsbezug –"]].concat(asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id).map(t => [t.id, t.name])))}
      ${asAuswahl("Gefährdungsfaktor", "faktor", g.faktor || "", [["", "–"]].concat(AS_KAT.faktoren.map(f => [f, f])).concat(AS_KAT.ressourcen.map(r => [r, "Ressource: " + r])), "voll")}
      ${asFeld("Kurz und verständlich (z. B. „Quetschen im Werkzeugbereich“)", "kurz", g.kurz, "text", "voll")}
      ${asFeld("Situation (was kann passieren?)", "situation", g.situation || "", "textarea", "voll")}
      ${asFeld("Schutzmaßnahmen – eine je Zeile, vorne S/T/O/P (z. B. „T: Verriegelte Schutztür“)", "schutz_text", (g.schutzmassnahmen || []).map(x => (x.stop || "T") + ": " + x.text).join(String.fromCharCode(10)), "textarea", "voll")}
      ${asFeld("Rechtsquelle / Regel (typspezifisch, z. B. DGUV Information 113-606 Abschn. 3.1.3)", "rechtsquelle", g.rechtsquelle || "", "text", "voll")}
      ${asFeld("Schutzziel", "schutzziel", g.schutzziel || "")}${asFeld("Exposition (wer, wie oft)", "exposition", g.exposition || "")}
      ${asFeld("Herleitung / Notiz", "beschreibung", g.beschreibung, "textarea", "voll")}
      <div class="voll"><b>Fotos</b><div class="hakenliste" id="gefFotoListe">${(g.fotos || []).map((f, i) =>
          `<label title="abwählen = entfernen"><input type="checkbox" data-fbeh="${i}" checked><img data-fpfad="${esc(f.pfad || "")}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px;background:#eef1f5"> ${esc(f.alt || "Foto " + (i + 1))}</label>`).join("")
          || `<span class="hinweis">noch keine</span>`}</div>
        ${AS.fachkraft || AS.gf ? `<label style="margin-top:6px">Fotos hinzufügen<input type="file" id="gefFotos" accept="image/*" capture="environment" multiple></label>` : ""}</div>
      ${ws("w_v", g.w_v)}${ws("s_v", g.s_v)}${ws("w_n", g.w_n)}${ws("s_n", g.s_n)}</div>
      <p class="hinweis">Wahrscheinlichkeit 1 unwahrscheinlich … 4 häufig · Schwere 1 leicht … 4 tödlich/irreversibel · Risiko = W × S: ab 9 hoch, ab 4 mittel.</p>
      ${!neu ? `<h4 style="margin:14px 0 6px">Maßnahmen</h4>${ms.map(m => `<div class="krit">${asStopChip(m.stop)}<div>${esc(m.text)} ${asStatusChip(m)}</div></div>`).join("") || `<div class="leer">Noch keine – „+ Maßnahme“.</div>`}` : ""}`, knoepfe: kn });
  asGefFotosZeigen();
}

function asBdaPsyche(box, s){
  const liste = asT("as_psyche").filter(p => p.arbeitssystem_id === s.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const F = { gruen: "gruen", gelb: "gelb", rot: "rot" };
  box.innerHTML = `<div class="karte"><h2>Psychische Belastung <button class="btn klein" id="psNeu">+ Ergebnis</button></h2>
    <p class="hinweis">Nur zusammengefasste Ergebnisse je Merkmalsbereich (GDA) – keine Angaben zu einzelnen Personen. Methode z. B. Befragung, moderierter Workshop, Beobachtung.</p>
    <div class="zeilen">${liste.map(p => `<div class="z" data-p="${p.id}"><div><b>${asDat(p.datum)} · ${esc(p.methode || "–")}${p.teilnehmer ? " · " + p.teilnehmer + " Teilnehmende" : ""}</b>
      <small>${AS_KAT.psyche_bereiche.map(b => asPunkt(F[(p.ergebnis || {})[b]] || "grau") + esc(b)).join(" &nbsp; ")}</small></div></div>`).join("") || `<div class="leer">Noch nicht beurteilt.</div>`}</div></div>`;
  const dlg = p => { const neu = !p; p = p || { datum: asHeute(), ergebnis: {} };
    const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d), erg = {};
      AS_KAT.psyche_bereiche.forEach((b, i) => { if(w["b" + i]) erg[b] = w["b" + i]; delete w["b" + i]; });
      if(w.teilnehmer != null && w.teilnehmer < 5 && w.teilnehmer > 0 && !confirm("Weniger als 5 Teilnehmende – Ergebnisse könnten Rückschlüsse auf Personen erlauben. Trotzdem speichern?")) return false;
      await asSpeichern("as_psyche", Object.assign({ id: p.id, arbeitssystem_id: s.id, ergebnis: erg }, w));
      const auff = Object.entries(erg).filter(([, v]) => v !== "gruen");
      if(auff.length && neu) asMeldung("Auffällige Bereiche: bitte Maßnahmen ableiten (Maßnahmen → + Maßnahme)."); asZeige(); } }];
    if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { await asLoeschen("as_psyche", p.id); asZeige(); } });
    asDialog({ titel: "Ergebnis psychische Belastung", inhalt: `<div class="form">${asFeld("Datum", "datum", p.datum, "date")}${asFeld("Methode", "methode", p.methode)}
      ${asFeld("Teilnehmende (Anzahl)", "teilnehmer", p.teilnehmer, "number")}
      ${AS_KAT.psyche_bereiche.map((b, i) => asAuswahl(b, "b" + i, (p.ergebnis || {})[b] || "", [["", "– nicht erhoben –"], ["gruen", "grün – unauffällig"], ["gelb", "gelb – beobachten"], ["rot", "rot – handeln"]])).join("")}
      ${asFeld("Notiz", "notiz", p.notiz, "textarea", "voll")}</div>`, knoepfe: kn }); };
  document.getElementById("psNeu").onclick = () => dlg(null);
  box.querySelectorAll("[data-p]").forEach(z => z.onclick = () => dlg(asNach("as_psyche", z.dataset.p)));
}

/* ======================= Massnahmen ======================= */
function asMassnahmeDialog(m, vorgabe, sys){
  const neu = !m; m = m || Object.assign({ stop: "T", umsetzung: "zentral", status: "offen" }, vorgabe || {});
  const anlagen = sys ? asListe(sys.anlagen) : [];
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.text){ asMeldung("Text fehlt"); return false; }
    w.termin = w.termin || null;
    if("einheit_id" in w) w.einheit_id = w.einheit_id || null;
    if(neu && w.umsetzung === "anlage"){
      const gew = [...d.querySelectorAll("[data-anl]:checked")].map(x => x.value);
      if(!gew.length){ asMeldung("Mindestens eine Anlage wählen"); return false; }
      const gruppe = crypto.randomUUID ? crypto.randomUUID() : null;
      for(const a of gew) await asSpeichern("as_massnahme", Object.assign({}, m, w, { anlage: a, gruppe }));
    } else await asSpeichern("as_massnahme", Object.assign({ id: m.id }, neu ? m : {}, w));
    asZeige(); } }];
  if(!neu && AS.admin) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!confirm("Maßnahme löschen?")) return false; await asLoeschen("as_massnahme", m.id); asZeige(); } });
  asDialog({ titel: neu ? "Neue Maßnahme" : "Maßnahme bearbeiten", inhalt: `<div class="form">
      ${asAuswahl("STOP-Stufe", "stop", m.stop, Object.entries(AS_STOP).map(([k, v]) => [k, k + " – " + v]))}
      ${neu ? asAuswahl("Umsetzung", "umsetzung", m.umsetzung, [["zentral", "zentral für alle"], ["anlage", "je Anlage (Zähler „x von y“)"]]) : ""}
      ${asFeld("Maßnahme", "text", m.text, "textarea", "voll")}
      ${asFeld("Verantwortlich", "verantwortlich", m.verantwortlich)}${asFeld("Bis wann", "termin", m.termin, "date")}
      ${m.gefaehrdung_id ? "" : asBereichWahl("Bereich", "einheit_id", neu && !("einheit_id" in m) ? null : (m.einheit_id || ""), "", "– betriebsweit –")}</div>
      ${neu && anlagen.length ? `<div style="margin-top:10px"><span class="hinweis">Anlagen (bei „je Anlage“):</span><br>${anlagen.map(a => `<label style="margin-right:12px"><input type="checkbox" data-anl value="${esc(a)}" checked> ${esc(a)}</label>`).join("")}</div>` : ""}
      <p class="hinweis">Rangfolge nach § 4 ArbSchG: erst S und T, dann O, zuletzt P (z. B. Gehörschutz ist P).</p>`, knoepfe: kn });
}

AS_SEITEN.massnahmen = { titel: "Maßnahmen", icon: "▶", sort: 5, render(main){
  const r = asReiter("massnahmen", [["offen", "Offen"], ["erledigt", "Wirksamkeit prüfen"], ["wirksam", "Wirksam"], ["alle", "Alle"]], "offen");
  const alle = asT("as_massnahme");
  const filt = alle.filter(m => r.akt === "alle" || m.status === r.akt);
  // Gruppen (je Anlage) zusammenfassen
  const gruppen = {}, einzeln = [];
  filt.forEach(m => { if(m.gruppe){ (gruppen[m.gruppe] = gruppen[m.gruppe] || []).push(m); } else einzeln.push(m); });
  const herkunft = m => { const g = asNach("as_gefaehrdung", m.gefaehrdung_id); if(g){ const s = asNach("as_arbeitssystem", g.arbeitssystem_id); return (s ? s.name + " · " : "") + g.kurz; }
    if(m._v1) return "Mangel " + (m.anlage || "") + " · noch keiner Gefährdung zugeordnet";
    return { orgcheck: "Organisations-Check", asa: "ASA-Beschluss", mitzeichnung: "Mitzeichnung", meldung: "Meldung", ziel: "Ziel", kultur: "Präventionskultur" }[m.quelle] || m.quelle; };
  const zeilen = einzeln.sort((a, b) => (a.termin || "9").localeCompare(b.termin || "9")).map(m => `<div class="z" data-m="${m.id}"><div><b>${asStopChip(m.stop)}${esc(m.text)}</b>
      <small>${esc(herkunft(m))} · ${esc(m.verantwortlich || "Verantwortlich offen")} · bis ${asDat(m.termin)}</small></div>${asStatusChip(m)}</div>`)
    .concat(Object.values(gruppen).map(g => { const alleG = alle.filter(x => x.gruppe === g[0].gruppe), w = alleG.filter(x => x.status === "wirksam").length;
      return `<div class="z" data-gr="${g[0].gruppe}"><div><b>${asStopChip(g[0].stop)}${esc(g[0].text)}</b><small>${esc(herkunft(g[0]))} · je Anlage · ${esc(g[0].verantwortlich || "Verantwortlich offen")} · bis ${asDat(g[0].termin)}</small></div>
        ${asChip(w + " von " + alleG.length + " Anlagen wirksam", w === alleG.length ? "gruen" : "gelb")}</div>`; }));
  main.innerHTML = `<h1 class="seite">Maßnahmen</h1><p class="unter">Erledigt meldet die Führungskraft vor Ort, „wirksam“ bestätigt die Fachkraft (OAK oder vor Ort). Erst dann wirkt die Maßnahme in der BdA.</p>
    ${r.html}<div class="karte"><h2>${filt.length} Maßnahmen <button class="btn klein" id="mNeu">+ Maßnahme</button></h2><div class="zeilen">${zeilen.join("") || `<div class="leer">Keine.</div>`}</div></div>`;
  document.getElementById("mNeu").onclick = () => asMassnahmeDialog(null, { quelle: "ziel" });
  main.querySelectorAll("[data-m]").forEach(z => z.onclick = () => asMassnahmeStatus(asNach("as_massnahme", z.dataset.m)));
  main.querySelectorAll("[data-gr]").forEach(z => z.onclick = () => asGruppeDialog(z.dataset.gr));
}};
function asMassnahmeStatus(m){
  const kn = [];
  if(m.status === "offen") kn.push({ t: "Erledigt melden", fn: () => { asErledigtDialog(m); return false; } });
  if(m.status === "erledigt" && AS.fachkraft) kn.push({ t: "Wirksam bestätigen", klasse: "adm", fn: async () => { await asSpeichern("as_massnahme", { id: m.id, status: "wirksam" }); asZeige(); } });
  if(m.status !== "offen" && AS.fachkraft) kn.push({ t: "Zurück auf offen", klasse: "sek", fn: async () => { await asSpeichern("as_massnahme", { id: m.id, status: "offen" }); asZeige(); } });
  kn.push({ t: "Bearbeiten", klasse: "sek", fn: () => { asMassnahmeDialog(m); return false; } });
  asDialog({ titel: "Maßnahme", inhalt: `<p>${asStopChip(m.stop)}<b>${esc(m.text)}</b></p>${m.befund ? `<p class="hinweis">Befund: ${esc(m.befund)}</p>` : ""}<p>${asStatusChip(m)}${m._v1 ? ` <span class="hinweis">· Mangel im Kundenportal – Änderungen wirken in Mängelliste, Hallenplan und Dokumenten</span>` : ""}</p>
    <div class="zeilen"><div class="z"><div><b>Verantwortlich</b><small>${esc(m.verantwortlich || "–")} · bis ${asDat(m.termin)}${m.anlage ? " · Anlage " + esc(m.anlage) : ""}</small></div></div>
    ${m.erledigt_am ? `<div class="z"><div><b>Erledigt</b><small>${asDat(m.erledigt_am)} · ${esc(m.erledigt_von || "")} · ${esc(m.erledigt_notiz || "")}</small></div></div>` : ""}
    ${m.wirksam_am ? `<div class="z"><div><b>Wirksam bestätigt</b><small>${asDat(m.wirksam_am)} · ${esc(m.wirksam_von || "")}</small></div></div>` : ""}</div>`, knoepfe: kn });
}
function asErledigtDialog(m){
  asDialog({ titel: "Erledigt melden", inhalt: `<p>${asStopChip(m.stop)}${esc(m.text)}${m.anlage ? " · " + esc(m.anlage) : ""}</p><div class="form">
      ${asFeld("Wer hat es erledigt?", "erledigt_von", AS.ich)}${asFeld("Erledigt am", "erledigt_am", asHeute(), "date")}
      ${asFeld("Was wurde gemacht?", "erledigt_notiz", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.erledigt_von || !w.erledigt_notiz){ asMeldung("Wer und was ausfüllen"); return false; }
      await asSpeichern("as_massnahme", Object.assign({ id: m.id, status: "erledigt" }, w)); asZeige(); } }] });
}
function asGruppeDialog(gid){
  const g = asT("as_massnahme").filter(m => m.gruppe === gid).sort((a, b) => (a.anlage || "").localeCompare(b.anlage || ""));
  const d = asDialog({ titel: g[0].text, inhalt: `<p>${asStopChip(g[0].stop)} je Anlage · ${g.filter(x => x.status === "wirksam").length} von ${g.length} wirksam</p>
    <div class="zeilen">${g.map(m => `<div class="z" data-m="${m.id}"><div><b>${esc(m.anlage || "–")}</b><small>${m.erledigt_notiz ? esc(m.erledigt_notiz) : ""}</small></div>${asStatusChip(m)}</div>`).join("")}</div>` });
  d.querySelectorAll("[data-m]").forEach(z => z.onclick = () => asMassnahmeStatus(asNach("as_massnahme", z.dataset.m)));
}

/* ======================= Mitzeichnung ======================= */
AS_SEITEN.mitzeichnung = { titel: "Mitzeichnung", icon: "✎", sort: 6, render(main){
  const liste = asT("as_mitzeichnung").slice().sort((a, b) => b.angemeldet_am.localeCompare(a.angemeldet_am));
  const st = x => x.status === "entschieden" ? asChip(x.freigabe === "freigegeben" ? "freigegeben" : "abgelehnt", x.freigabe === "freigegeben" ? "gruen" : "rot")
    : x.status === "geprueft" ? asChip("Sifa-Empfehlung liegt vor", "gelb") : asChip("wartet auf Sifa", "grau");
  main.innerHTML = `<h1 class="seite">Mitzeichnung der Sifa</h1>
    <p class="unter">Neue Maschinen, Umbauten, Gefahrstoffe, Stellen, Bauvorhaben – vor der Umsetzung anmelden. Die Sifa berät und empfiehlt, die Führungskraft gibt frei und trägt die Verantwortung (§ 6 ASiG).</p>
    <div class="karte"><h2>Vorhaben <button class="btn klein" id="mzNeu">+ Vorhaben anmelden</button></h2><div class="zeilen">
    ${liste.map(x => `<div class="z" data-x="${x.id}"><div><b>${esc(x.titel)}</b><small>${esc((AS_KAT.mitzeichnung[x.art] || {}).titel || x.art)} · angemeldet ${asDat(x.angemeldet_am)} von ${esc(x.angemeldet_von || "–")}</small></div>${st(x)}</div>`).join("") || `<div class="leer">Noch keine Vorhaben.</div>`}</div></div>`;
  document.getElementById("mzNeu").onclick = () => asDialog({ titel: "Vorhaben anmelden", inhalt: `<div class="form">
      ${asAuswahl("Art", "art", "maschine", Object.entries(AS_KAT.mitzeichnung).map(([k, v]) => [k, v.titel]), "voll")}
      ${asFeld("Kurzbezeichnung", "titel", "", "text", "voll")}${asBereichWahl("Bereich", "einheit_id", null, "", "– betriebsweit –")}
      ${asFeld("Angemeldet von", "angemeldet_von", AS.ich)}${asFeld("Beschreibung", "beschreibung", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Anmelden", fn: async d => { const w = asWerte(d); if(!w.titel){ asMeldung("Bezeichnung fehlt"); return false; }
      w.einheit_id = w.einheit_id || null; await asSpeichern("as_mitzeichnung", w); asZeige(); } }] });
  main.querySelectorAll("[data-x]").forEach(z => z.onclick = () => asMitzeichnungDialog(asNach("as_mitzeichnung", z.dataset.x)));
}};
/* Typische Folgeschritte je Vorhaben (Prozessmodell P12: BdA, BA, Unterweisung, Gefahrstoffverzeichnis, Prüfkataster ergänzen) */
const AS_MZ_FOLGEN = {
  maschine: ["Beurteilung der Arbeitsbedingungen für die neue Anlage erstellen", "Prüfung vor erster Verwendung durchführen (§ 14 Abs. 1 BetrSichV)", "Betriebsanweisung erstellen und vor Inbetriebnahme unterweisen"],
  umbau: ["Beurteilung der Arbeitsbedingungen anpassen", "Prüfung nach Änderung durchführen (§ 14 Abs. 2 BetrSichV)", "Betriebsanweisung anpassen und neu unterweisen"],
  gefahrstoff: ["Stoff ins Gefahrstoffverzeichnis aufnehmen, SDB hinterlegen und Tätigkeit nach EMKG beurteilen", "Betriebsanweisung und Unterweisung vor der ersten Verwendung"],
  bau: ["Beurteilung der Arbeitsbedingungen für den Bereich anpassen", "Flucht- und Rettungsplan prüfen"],
  verfahren: ["Beurteilung der Arbeitsbedingungen anpassen", "Beschäftigte unterweisen"],
  stelle: ["Erstunterweisung und Vorsorge vor Arbeitsbeginn planen"],
  mutterschutz: ["Schutzmaßnahmen nach § 10 MuSchG umsetzen und Gespräch anbieten", "Mitteilung an die Aufsichtsbehörde"],
  psa: ["PSA beschaffen und Benutzung unterweisen"],
  fremdfirma: ["Gegenseitige Gefährdungen abstimmen und Externe unterweisen"] };
function asMitzeichnungDialog(x){
  const kat = AS_KAT.mitzeichnung[x.art] || { titel: x.art, punkte: [] };
  const cl = x.checkliste || {}, sifa = AS.fachkraft && x.status !== "entschieden";
  const auflagen = asT("as_massnahme").filter(m => m.quelle === "mitzeichnung" && m.quelle_id === x.id);
  const kn = [];
  if(sifa) kn.push({ t: "Empfehlung speichern", klasse: "adm", fn: async d => { const w = asWerte(d), c = {};
    kat.punkte.forEach((p, i) => c[i] = w["cl" + i] || ""); if(!w.empfehlung){ asMeldung("Empfehlung wählen"); return false; }
    c._auflagen = asListe((w.auflagen || "").replace(/\n/g, ",")).concat((cl._auflagen || []));   // werden erst mit der Freigabe zu Maßnahmen
    await asSpeichern("as_mitzeichnung", { id: x.id, checkliste: c, empfehlung: w.empfehlung, empfehlung_text: w.empfehlung_text, empfehlung_am: asHeute(), empfehlung_von: AS.ich, status: "geprueft" });
    asZeige(); } });
  if(x.status === "geprueft") kn.push({ t: "Entscheiden (Führungskraft)", fn: () => { asDialog({ titel: "Entscheidung zu: " + x.titel, inhalt: `
      <p>Empfehlung der Sifa: <b>${esc({ ohne: "freigeben ohne Auflagen", auflagen: "freigeben mit Auflagen", nicht: "nicht empfohlen" }[x.empfehlung])}</b>${x.empfehlung_text ? " – " + esc(x.empfehlung_text) : ""}</p><div class="form">
      ${asAuswahl("Entscheidung", "freigabe", "freigegeben", [["freigegeben", "freigegeben"], ["abgelehnt", "abgelehnt"]])}${asFeld("Name", "freigabe_von", AS.ich)}
      ${asFeld("Begründung (Pflicht, wenn von der Empfehlung abgewichen wird)", "begruendung", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d);
      const abw = (x.empfehlung === "nicht" && w.freigabe === "freigegeben") || (x.empfehlung !== "nicht" && w.freigabe === "abgelehnt");
      if(abw && !w.begruendung){ asMeldung("Abweichung von der Empfehlung bitte begründen"); return false; }
      await asSpeichern("as_mitzeichnung", Object.assign({ id: x.id, freigabe_am: asHeute(), status: "entschieden" }, w));
      if(w.freigabe === "freigegeben"){   // Auflagen + typische Folgeschritte als Maßnahmen mit Termin (Prozessmodell P12 → P10/P20/P22/P23)
        const term = (() => { const t = new Date(); t.setDate(t.getDate() + 28); return t.toISOString().slice(0, 10); })();
        const folgen = (x.checkliste && x.checkliste._auflagen || []).concat(AS_MZ_FOLGEN[x.art] || []);
        for(const t of folgen) await asSpeichern("as_massnahme", { quelle: "mitzeichnung", quelle_id: x.id, stop: "O", text: t + " – " + x.titel, umsetzung: "zentral",
          status: "offen", termin: term, einheit_id: x.einheit_id || null });
        if(folgen.length) asMeldung(folgen.length + " Folgeschritte als Maßnahmen angelegt");
      }
      asZeige(); } }] }); return false; } });
  asDialog({ titel: x.titel, breit: true, inhalt: `<p class="hinweis">${esc(kat.titel)} · angemeldet ${asDat(x.angemeldet_am)} von ${esc(x.angemeldet_von || "–")} · ${esc(asEinheitName(x.einheit_id))}</p>
    <p>${esc(x.beschreibung || "")}</p>
    <h4 style="margin:12px 0 6px">Checkliste der Sifa</h4>
    ${kat.punkte.map((p, i) => sifa ? `<div class="krit"><div style="flex:1">${esc(p)}</div><select data-f="cl${i}"><option value="">–</option>${["ok", "Auflage", "n. z."].map(o => `<option ${cl[i] === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`
      : `<div class="krit"><span class="${cl[i] === "ok" ? "ok" : "nok"}">${cl[i] === "ok" ? "✓" : cl[i] ? "!" : "–"}</span><div>${esc(p)} <span class="hinweis">${esc(cl[i] || "")}</span></div></div>`).join("")}
    ${sifa ? `<div class="form" style="margin-top:12px">${asAuswahl("Empfehlung", "empfehlung", x.empfehlung || "", [["", "– wählen –"], ["ohne", "freigeben ohne Auflagen"], ["auflagen", "freigeben mit Auflagen"], ["nicht", "nicht empfohlen"]])}
        ${asFeld("Begründung / Hinweise", "empfehlung_text", x.empfehlung_text, "textarea", "voll")}
        ${asFeld("Neue Auflagen (je Zeile eine) – werden mit der Freigabe zu Maßnahmen", "auflagen", "", "textarea", "voll")}
        ${(cl._auflagen || []).length ? `<p class="hinweis voll">Vorgemerkte Auflagen: ${esc(cl._auflagen.join(" · "))}</p>` : ""}</div>`
      : x.empfehlung ? `<p>Empfehlung: <b>${esc({ ohne: "freigeben ohne Auflagen", auflagen: "freigeben mit Auflagen", nicht: "nicht empfohlen" }[x.empfehlung])}</b> (${esc(x.empfehlung_von || "")}, ${asDat(x.empfehlung_am)}) ${esc(x.empfehlung_text || "")}</p>` : ""}
    ${auflagen.length ? `<h4 style="margin:12px 0 6px">Auflagen</h4>${auflagen.map(m => `<div class="krit">${asStopChip(m.stop)}<div>${esc(m.text)} ${asStatusChip(m)}</div></div>`).join("")}` : ""}
    ${x.status === "entschieden" ? `<p>Entscheidung: <b>${esc(x.freigabe)}</b> von ${esc(x.freigabe_von || "")} am ${asDat(x.freigabe_am)} ${x.begruendung ? "– " + esc(x.begruendung) : ""}</p>` : ""}`, knoepfe: kn });
}

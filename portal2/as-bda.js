/* OAK Arbeitsschutz-App – BdA (P10), Massnahmen und Wirksamkeit (P11), Mitzeichnung der Sifa (P12). */
"use strict";

const AS_STOP = { S: "Substitution", T: "technisch", O: "organisatorisch", P: "persönlich" };
function asStopChip(s){ return `<span class="stop stop-${esc(s)}" title="${esc(AS_STOP[s] || "")}">${esc(s)}</span>`; }
function asStatusChip(m){
  if(m.status === "wirksam") return asChip("wirksam", "gruen");
  if(m.status === "erledigt" && (m.stop === "O" || m.stop === "P") && !m.unterwiesen_am && (!m.folge_art || m.folge_art === "unterweisung")) return asChip("Unterweisung offen", "gelb");
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
    <div class="karte"><h2>Arbeitssysteme ${asDarf("pflegen") ? `<button class="btn klein" id="sysNeu">+ Arbeitssystem</button>` : ""}</h2><div class="zeilen">
    ${liste.map(s => { const b = asBand(asSystemRisiko(s.id)), psy = asT("as_psyche").some(p => p.arbeitssystem_id === s.id);
      const nT = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id).length;
      return `<div class="z" data-s="${s.id}"><div><b>${asPunkt(b)}${esc(s.name)}</b><small>${esc(asEinheitName(s.einheit_id))} · ${nT} Tätigkeiten · Risiko heute: ${asBandText(b)}
        · ${psy ? "Psyche beurteilt" : "Psyche offen"} · ${s.ba_vorhanden ? "BA vorhanden" : "BA fehlt"}</small></div>
        ${s.stillgelegt_am ? asChip("ruht – Anlage stillgelegt " + asDat(s.stillgelegt_am), "grau") : s.freigabe_am ? asChip("freigegeben " + asDat(s.freigabe_am), "gruen") : asChip("nicht freigegeben", "gelb")}</div>`; }).join("") || `<div class="leer">Noch kein Arbeitssystem. Beispiel: „Spritzgießen“, „Lager und Versand“, „Verwaltung“.</div>`}</div></div>`;
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
  if(!neu && asDarf("loeschen")) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!await asLoeschenBestaetigt("Arbeitssystem mit allen Tätigkeiten und Gefährdungen löschen?", "as_arbeitssystem", s.id)) return false;
    await asLaden(); asGehe("bda"); } });
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
  const r = asReiter("bda_" + s.id, [["tabelle", "Beurteilung"], ["dokumente", "Dokumente & BA"], ["psyche", "Psychische Belastung"]], "tabelle");
  main.innerHTML = `<p class="nodruck"><a href="#bda" onclick="AS.reiter.bda=''">← alle Arbeitssysteme</a></p>
    <h1 class="seite">${esc(s.name)}</h1><p class="unter bda-klick" id="sysKopf" title="Bereich, Rollen und Anlagen bearbeiten">${esc(asEinheitName(s.einheit_id))} · Rollen: ${esc(asListe(s.rollen).join(", ") || "–")} · Anlagen: ${esc(asListe(s.anlagen).join(", ") || "–")}</p>
    <div class="reiter nodruck">${[["tabelle", "Beurteilung"], ["dokumente", "Dokumente & BA"], ["psyche", "Psychische Belastung"]].map(([k, t]) =>
      `<button class="${k === r.akt ? "an" : ""}" data-r="${k}">${t}</button>`).join("")}</div><div id="sysInhalt"></div>`;
  main.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { AS.reiter["bda_" + s.id] = b.dataset.r; asBdaSystem(main, s); });
  main.querySelector("#sysKopf").onclick = () => asSystemDialog(s);
  const box = document.getElementById("sysInhalt");
  ({ tabelle: asBdaTabelle, bearbeiten: asBdaTabelle, psyche: asBdaPsyche, dokumente: typeof asBdaDokumente === "function" ? asBdaDokumente : asBdaTabelle })[r.akt](box, s);
}

/* BdA nach Tätigkeiten (Fahrplan Selbstbedienung Schritt 2, 20.11.2026): Kachel je Tätigkeit → Tabelle je Tätigkeit
   (Gefährdung · Wann/wo · Risiko heute · Maßnahmen · Risiko danach · Stand) → Fotos gesammelt → Matrix einmal → Unterschriften.
   „Für alle Tätigkeiten“ = Gefährdungen ohne Tätigkeit. Tätigkeiten kommen nur aus den Daten, nichts ist fest verdrahtet. */
function asBdRk(r, titel, kurz){ const b = asBand(r); return `<span class="bd-rk bd-${b}"${titel ? ` title="${esc(titel)}"` : ""}>${r ? r + (kurz ? "" : " " + asBandText(b)) : kurz ? "–" : asBandText(b)}</span>`; }
/* Eigene Typ-Vorlage aus einer fertig bewerteten Anlage (Fahrplan Schritt 3, Stufe 14): Tätigkeiten, Gefährdungen mit
   Bewertung, Fundstelle und Maßnahmen (S/T/O/P) sowie die BA des Systems. Nur der Betrieb sieht sie; OAK-Vorlagen bleiben unverändert.
   Typ-Standard: references/vorlagen/typ-vorlage-standard.md */
async function asAlsVorlageDialog(s){
  const tk = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id).sort((x, y) => (x.sort || 0) - (y.sort || 0));
  const gef = asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id && g.art !== "ressource");
  if(!gef.length){ asMeldung("Noch keine Gefährdung – erst beurteilen, dann als Vorlage speichern"); return; }
  const vorschlag = String(s.name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  asDialog({ titel: "Als Vorlage speichern", inhalt: `<p class="hinweis">Aus dieser Beurteilung wird eine Vorlage für gleiche Maschinen in Ihrem Betrieb: ${tk.length} Tätigkeiten,
      ${gef.length} Gefährdungen mit Bewertung, Fundstelle und Maßnahmen, dazu die Betriebsanweisung. Bei der nächsten Begehung steht sie unter „Maschine fertig“ zur Auswahl.
      Fotos, Termine und Verantwortliche werden nicht übernommen.</p><div class="form">${asFeld("Name des Maschinentyps (z. B. „Kantenschleifmaschine“)", "titel", vorschlag, "text", "voll")}</div>`,
    knoepfe: [{ t: "Vorlage speichern", fn: async d => { const titel = String(asWerte(d).titel || "").trim(); if(!titel){ asMeldung("Name fehlt"); return false; }
      const slug = AS.kunde + "--" + titel.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const da = await apiGet("/rest/v1/as_maschinentyp?select=slug&slug=eq." + encodeURIComponent(slug)).catch(() => []) || [];
      if(da.length && !confirm("Eine eigene Vorlage „" + titel + "“ gibt es schon. Ersetzen?")) return false;
      const key = t => "t" + (tk.indexOf(t) + 1);
      const v = { _typ: "Eigene Vorlage " + titel, _hinweis: "Vom Betrieb aus „" + s.name + "“ gespeichert am " + asDat(asHeute()) + " von " + AS.ich,
        meta: { maschinenart: titel },
        taetigkeiten: tk.map(t => ({ key: key(t), name: t.name, rollen: asListe(t.rollen), rechtsquelle: t.rechtsquelle || "" })),
        hazards: gef.map((g, i) => { const t = tk.find(x => x.id === g.taetigkeit_id), gesehen = new Set();
          const top = asMassnahmenZu(g.id).filter(m => { const k = String(m.text || "").trim().toLowerCase(); if(!k || gesehen.has(k)) return false; gesehen.add(k); return true; }).map(m => [m.stop || "T", m.text]);
          return { nr: "e" + (i + 1), taetigkeit: t ? key(t) : null, kat: g.faktor || "Gefährdung", sub: g.kurz, situation: g.situation || "", rq: g.rechtsquelle || "",
            wV: g.w_v, sV: g.s_v, wN: g.w_n, sN: g.s_n, top, verantwortlich: "", termin: "", status: "offen" }; }) };
      const ba = await apiGet("/rest/v1/as_ba?select=inhalt&limit=1&arbeitssystem_id=eq." + s.id).catch(() => []) || [];
      if(ba[0] && ba[0].inhalt && typeof ba[0].inhalt === "object") v.ba = ba[0].inhalt;
      await apiSend("POST", "/rest/v1/as_maschinentyp?on_conflict=slug", { slug, titel, vorlage: v, quelle: "Betrieb " + asHeute(), aktiv: true, kunde_slug: AS.kunde }, "resolution=merge-duplicates,return=minimal");
      if(typeof AS_TYPEN !== "undefined") AS_TYPEN = null;
      asMeldung("Vorlage „" + titel + "“ gespeichert – bei der nächsten Begehung unter „Maschine fertig“ wählbar"); } }] });
}
/* Maßnahmen aus der Typ-Vorlage, die noch keine Begehung bestätigt hat (Anlage über „Anlage anlegen“ aus der Bibliothek, 23.11.2026) */
const AS_VORL_MN = "Schutzmaßnahmen lt. Vorlage (bei der Begehung bestätigen) – ";
function asVorlageMn(g){
  if(asMassnahmenZu(g.id).length) return [];
  const z = String(g.beschreibung || "").split("\n").find(l => l.startsWith(AS_VORL_MN));
  return z ? z.slice(AS_VORL_MN.length).split(" · ").map(x => { const m = x.match(/^([STOP]): ([\s\S]*)$/); return m ? [m[1], m[2]] : ["T", x]; }) : [];
}
/* Plausibilitätsprüfung (Fahrplan Schritt 4, 20.11.2026): Hinweise je Arbeitssystem, nur Anzeige – nichts wird gesperrt */
function asBdaPruefung(s){
  const tk = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id);
  const gef = asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id && g.art !== "ressource");
  const h = [];
  const unbest = gef.filter(g => asVorlageMn(g).length).length;
  if(unbest) h.push([null, "Begehung", `${unbest} Gefährdung${unbest === 1 ? "" : "en"} mit Maßnahmen aus der Vorlage, noch nicht bestätigt – bei der Begehung „Maschine fertig“ durchgehen`]);
  gef.forEach(g => { const v = asRisiko(g.w_v, g.s_v), n = asRisiko(g.w_n, g.s_n), ms = asMassnahmenZu(g.id);
    if(!v) h.push([g.id, g.kurz, "nicht bewertet (W und S fehlen)"]);
    else if(n > v) h.push([g.id, g.kurz, `Risiko danach (${n}) höher als heute (${v})`]);
    if(!String(g.rechtsquelle || "").trim()) h.push([g.id, g.kurz, "keine Fundstelle (Rechtsquelle)"]);
    if(asGefRisiko(g) >= 9 && !ms.some(m => m.status !== "wirksam") && !asVorlageMn(g).length) h.push([g.id, g.kurz, "Risiko hoch, aber keine offene Maßnahme"]);
    const ohne = ms.filter(m => m.status === "offen" && (!m.verantwortlich || !m.termin)).length;
    if(ohne && asGefRisiko(g) >= 4) h.push([g.id, g.kurz, `${ohne} offene Maßnahme${ohne === 1 ? "" : "n"} ohne Verantwortlichen oder Termin`]); });
  tk.forEach(t => { if(String(t.name || "").length > 60 || /festgestellt|begehung|notiz/i.test(t.name || "")) h.push([null, t.name, "Tätigkeitsname sieht aus wie eine Notiz – kurz benennen, Text ins Hinweisfeld"]);
    if(!gef.some(g => g.taetigkeit_id === t.id)) h.push([null, t.name, "Tätigkeit ohne Gefährdung"]); });
  return h;
}
function asBdaTabelle(box, s){
  const tk = asT("as_taetigkeit").filter(t => t.arbeitssystem_id === s.id).sort((x, y) => (x.sort || 0) - (y.sort || 0));
  const gef = asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id).sort((x, y) => (x.sort || 0) - (y.sort || 0));
  const lauf = gef.filter(g => g.art !== "ressource");
  const gruppen = (lauf.some(g => !g.taetigkeit_id) || !tk.length ? [{ id: null, name: tk.length ? "Für alle Tätigkeiten" : "Arbeitsplatz / Anlage", rollen: tk.length ? ["Alle an und um die Anlage"] : s.rollen }] : []).concat(tk);
  const vonGr = t => lauf.filter(g => (g.taetigkeit_id || null) === t.id);
  const heute = g => asGefRisiko(g), danach = g => asRisiko(g.w_n, g.s_n) || asGefRisiko(g);
  const mnOffen = g => asMassnahmenZu(g.id).filter(m => m.status !== "wirksam");
  const wann = g => g.situation || String(g.beschreibung || "").split("\n")[0].replace(/^Schutzmaßnahmen lt\. BdA.*$/, "");
  const ws = (w, x) => w && x ? `W ${w} × S ${x}` : "nicht bewertet";
  // Kacheln
  const kacheln = gruppen.map(t => { const gg = vonGr(t), id = "bdtk-" + (t.id || "alle");
    const hv = gg.reduce((m, g) => Math.max(m, heute(g)), 0), hn = gg.reduce((m, g) => Math.max(m, danach(g)), 0);
    const off = gg.reduce((n, g) => n + mnOffen(g).length, 0);
    return `<a class="bd-kachel" href="#${id}" onclick="event.preventDefault();document.getElementById('${id}').scrollIntoView({behavior:'smooth'})">
      <span class="bd-k-titel" title="${esc(t.name)}">${esc(t.name)}</span><span class="bd-k-wer" title="${esc(asListe(t.rollen).join(", "))}">${esc(asListe(t.rollen).join(", ") || "–")}</span>
      <span class="bd-k-risk" title="Höchstes Risiko heute → nach den Maßnahmen: ${asBandText(asBand(hv))} → ${asBandText(asBand(hn))}">${asBdRk(hv, "", true)}<span class="bd-pfeil">→</span>${asBdRk(hn, "", true)}</span>
      <span class="bd-k-zahl" title="${gg.length} Gefährdungen · ${off} Maßnahmen offen"><span><b>${gg.length}</b> Gef.</span><span><b>${off}</b> offen</span></span></a>`; }).join("");
  // Abschnitte
  const abschnitte = gruppen.map(t => { const gg = vonGr(t), id = "bdtk-" + (t.id || "alle");
    const zeilen = gg.map((g, i) => {
      const ms = [], gesehen = new Set();
      asMassnahmenZu(g.id).forEach(m => { if(!m.gruppe){ ms.push({ m }); return; } if(gesehen.has(m.gruppe)) return; gesehen.add(m.gruppe);
        ms.push({ m, alle: asT("as_massnahme").filter(x => x.gruppe === m.gruppe) }); });
      const stand = e => { if(!e.alle) return asStatusChip(e.m); const w = e.alle.filter(x => x.status === "wirksam").length;
        return asChip(w + " von " + e.alle.length + " Anlagen wirksam", w === e.alle.length ? "gruen" : "gelb"); };
      const mz = ms.map(e => `<div class="bd-ms bda-klick" ${e.alle ? `data-mg="${e.m.gruppe}"` : `data-mk="${e.m.id}"`} title="Maßnahme öffnen${e.m.verantwortlich ? " · " + esc(e.m.verantwortlich) : ""}${e.m.termin ? " · bis " + asDat(e.m.termin) : ""}">${asStopChip(e.m.stop)}<span>${esc(e.m.text)}</span>${stand(e)}</div>`).join("")
        || asVorlageMn(g).map(([k, t]) => `<div class="bd-ms bd-vorl" title="Maßnahme aus der Vorlage – bei der Begehung bestätigen oder als fehlend melden">${asStopChip(k)}<span>${esc(t)}</span>${asChip("lt. Vorlage", "grau")}</div>`).join("")
        || `<div class="hinweis">keine Maßnahme erfasst</div>`;
      const off = mnOffen(g).length, alle = asMassnahmenZu(g.id).length, ueber = mnOffen(g).some(m => m.status === "offen" && m.termin && m.termin < asHeute());
      const st = !alle ? (asVorlageMn(g).length ? asChip("Begehung offen", "grau") : asChip("keine Maßnahme", "grau")) : !off ? asChip("wirksam", "gruen") : asChip(off + " offen", ueber ? "rot" : "gelb");
      return `<tr><td class="bd-nr">${i + 1}</td>
        <td class="bd-gef bda-klick" data-gk="${g.id}" title="Gefährdung bearbeiten"><div class="bd-g1">${esc(g.kurz)}${g.art === "belastung" ? ` <span class="hinweis">Belastung</span>` : ""}</div><div class="bd-g2" title="${esc(g.rechtsquelle || "")}">${esc(g.rechtsquelle || g.faktor || "")}</div></td>
        <td class="bd-wann bda-klick" data-gk="${g.id}" title="${esc(wann(g))}">${esc(wann(g))}</td>
        <td class="bd-risk bda-klick" data-gk="${g.id}" data-l="heute">${asBdRk(heute(g), ws(g.w_v, g.s_v) + (heute(g) !== asRisiko(g.w_v, g.s_v) ? " · alle Maßnahmen wirksam: Restrisiko" : ""))}</td>
        <td class="bd-mass">${mz}</td>
        <td class="bd-risk bda-klick" data-gk="${g.id}" data-l="danach">${asBdRk(danach(g), ws(g.w_n, g.s_n))}</td>
        <td class="bd-st">${st}</td></tr>`; }).join("");
    return `<section class="bd-abschnitt" id="${id}"><div class="bd-a-kopf"><h2${t.id ? ` class="bda-klick" data-tk="${t.id}" title="Tätigkeit bearbeiten"` : ""}>${esc(t.name)}</h2>
        <span class="bd-a-wer">${esc(asListe(t.rollen).join(", "))}</span>${t.rechtsquelle ? `<span class="bd-a-quelle" title="${esc(t.rechtsquelle)}">${esc(t.rechtsquelle)}</span>` : ""}
        ${asDarf("pflegen") ? `<button class="btn sek klein nodruck" data-gn="${t.id || ""}">+ Gefährdung</button>` : ""}</div>
      ${zeilen ? `<table class="bd-tab"><colgroup><col class="bd-c-nr"><col class="bd-c-gef"><col class="bd-c-wann"><col class="bd-c-r"><col><col class="bd-c-r"><col class="bd-c-st"></colgroup>
        <thead><tr><th></th><th>Gefährdung</th><th>Wann / wo</th><th>Risiko heute</th><th>Maßnahmen</th><th>Risiko danach</th><th>Stand</th></tr></thead><tbody>${zeilen}</tbody></table>`
        : `<p class="hinweis">Noch keine Gefährdung – „+ Gefährdung“.</p>`}</section>`; }).join("");
  // Fotos gesammelt, Matrix aus denselben Grenzen wie die Rechnung (asBand)
  const fotos = lauf.flatMap(g => (g.fotos || []).filter(f => f.pfad).map(f => ({ pfad: f.pfad, alt: f.alt || g.kurz })));
  const WN = { 4: "häufig", 3: "wahrscheinlich", 2: "möglich", 1: "unwahrscheinlich" }, SN = ["leicht", "mittel", "schwer", "ggf. tödlich"];
  const matrix = `<div class="bd-mx">${[4, 3, 2, 1].map(w => `<span class="bd-ax" title="${WN[w]}">W${w}</span>` + [1, 2, 3, 4].map(x => `<b class="bd-${asBand(w * x)}">${w * x}</b>`).join("")).join("")}
    <span></span>${SN.map((t, i) => `<span class="bd-ko" title="${t}">S${i + 1}</span>`).join("")}</div>`;
  const legende = `<div class="bd-mxl"><span>${asBdRk(2)} 1–3 vertretbar</span><span>${asBdRk(6)} 4–8 Maßnahmen planen</span><span>${asBdRk(12)} 9–16 sofort handeln</span></div>`;
  const quellen = ["§§ 5, 6 ArbSchG", "§ 3 BetrSichV"].concat([...new Set(tk.map(t => t.rechtsquelle).filter(Boolean))]);
  const res = gef.filter(g => g.art === "ressource");
  box.innerHTML = `<div class="karte bd"><h2>Beurteilung der Arbeitsbedingungen – ${esc(s.name)}
      <span class="nodruck">${asDarf("pflegen") ? `<button class="btn sek klein" id="tkNeu">+ Tätigkeit</button><button class="btn sek klein" id="resNeu">+ Ressource</button>` : ""}${asDarf("pflegen") ? `<button class="btn sek klein" id="alsVorlage" title="Diese Beurteilung als Vorlage für gleiche Maschinen speichern">Als Vorlage</button>` : ""}<button class="btn sek klein" onclick="window.print()">Drucken</button>
      ${s.freigabe_am ? (AS.gf ? `<button class="btn sek klein" id="frZur">Freigabe zurücknehmen</button>` : "")
        : (AS.gf ? `<button class="btn klein" id="frGeben">Freigeben (Geschäftsführung)</button>`
          : (asDarf("pflegen") ? (s.vorgelegt_am ? `<span class="hinweis">zur Freigabe vorgelegt ${asDat(s.vorgelegt_am)}</span>` : `<button class="btn klein" id="frVorlegen">Zur Freigabe vorlegen</button>`)
            : `<span class="hinweis">Freigabe durch die Geschäftsführung</span>`))}</span></h2>
    <div class="bd-stamm"><div><span>Bereich</span><b>${esc(asEinheitName(s.einheit_id) || "–")}</b></div><div><span>Anlagen</span><b title="${esc(asListe(s.anlagen).join(", "))}">${esc(asListe(s.anlagen).join(", ") || "–")}</b></div>
      <div><span>Beschäftigte</span><b title="${esc(asListe(s.rollen).join(", "))}">${esc(asListe(s.rollen).join(", ") || "–")}</b></div><div><span>Stand</span><b>${asDat(asHeute())}</b></div>
      <div><span>Freigabe</span><b>${s.freigabe_am ? asDat(s.freigabe_am) + " · " + esc(s.freigabe_von || "") : "noch nicht freigegeben"}</b></div></div>
    <p class="bd-zweck">Beurteilt nach § 5 ArbSchG und § 3 BetrSichV, getrennt nach Tätigkeiten. Je Zeile: Risiko heute → Maßnahmen → Risiko danach. Das Restrisiko gilt, sobald alle Maßnahmen einer Gefährdung wirksam sind.</p>
    ${(() => { const h = asDarf("pflegen") ? asBdaPruefung(s) : []; return h.length ? `<details class="bd-pruef nodruck"><summary>${h.length} Hinweis${h.length === 1 ? "" : "e"} zur Prüfung</summary>${h.map(([gid, was, txt]) =>
      `<div class="bd-pz${gid ? " bda-klick" : ""}"${gid ? ` data-gk="${gid}"` : ""}><b title="${esc(was)}">${esc(was)}</b><span>${esc(txt)}</span></div>`).join("")}</details>` : ""; })()}
    <div class="bd-kacheln" style="--n:${Math.min(Math.max(gruppen.length, 1), 6)}">${kacheln}</div>
    ${abschnitte || `<p class="leer">Mit „+ Tätigkeit“ beginnen, dann je Tätigkeit „+ Gefährdung“.</p>`}
    ${res.length ? `<section class="bd-abschnitt"><div class="bd-a-kopf"><h2>Ressourcen</h2></div>${res.map(g => `<div class="krit bda-klick" data-gk="${g.id}"><span class="ok">+</span><div><b>${esc(g.kurz)}</b> <span class="hinweis">${esc(g.faktor || "")} ${esc(g.beschreibung || "")}</span></div></div>`).join("")}</section>` : ""}
    ${fotos.length ? `<section class="bd-abschnitt"><div class="bd-a-kopf"><h2>Fotos</h2><span class="bd-a-wer nodruck">antippen zum Vergrößern</span></div><div class="bd-galerie">${fotos.map(f =>
      `<figure><button type="button" class="bd-fx" title="${esc(f.alt)}"><img data-fpfad="${esc(f.pfad)}" alt="${esc(f.alt)}"></button><figcaption title="${esc(f.alt)}">${esc(f.alt)}</figcaption></figure>`).join("")}</div></section>` : ""}
    <div class="bd-fuss"><div class="bd-box"><h3>Beurteilungsmatrix (W × S)</h3><div class="bd-mxw">${matrix}${legende}</div></div>
      <div class="bd-box"><h3>Maßnahmen (STOP)</h3><div class="bd-stop">${["S", "T", "O", "P"].map(k => `<span>${asStopChip(k)} ${esc(AS_STOP[k])}</span>`).join("")}</div></div>
      <div class="bd-box"><h3>Grundlagen</h3><p>${quellen.map(esc).join(" · ")}</p></div></div>
    <div class="bd-unter"><div>Erstellt</div><div>Fachkraft für Arbeitssicherheit</div><div>Geschäftsführung${s.freigabe_am ? ": " + esc(s.freigabe_von || "") + ", " + asDat(s.freigabe_am) : ""}</div></div>
    <div class="hinweis nodruck" style="margin-top:14px">Zum Bearbeiten auf Tätigkeit, Gefährdung, Risiko oder Maßnahme klicken; neue Maßnahme über die Gefährdung. Bewertung nach Wahrscheinlichkeit × Schwere (je 1–4).</div></div>`;
  box.querySelectorAll("[data-tk]").forEach(el => el.onclick = () => asTaetigkeitDialog(s, asNach("as_taetigkeit", el.dataset.tk)));
  box.querySelectorAll("[data-gn]").forEach(b => b.onclick = ev => { ev.stopPropagation(); asGefDialog(s, null, b.dataset.gn || null); });
  box.querySelectorAll("[data-gk]").forEach(el => el.onclick = () => asGefDialog(s, asNach("as_gefaehrdung", el.dataset.gk)));
  box.querySelectorAll("[data-mk]").forEach(el => el.onclick = () => asMassnahmeStatus(asNach("as_massnahme", el.dataset.mk)));
  box.querySelectorAll("[data-mg]").forEach(el => el.onclick = () => asGruppeDialog(el.dataset.mg));
  box.querySelectorAll("[data-mn]").forEach(b => b.onclick = ev => { ev.stopPropagation(); asMassnahmeDialog(null, { gefaehrdung_id: b.dataset.mn, quelle: "bda" }, s); });
  box.querySelectorAll(".bd-fx").forEach(b => b.onclick = () => { const im = b.querySelector("img"); if(!im.src) return;
    asDialog({ titel: im.alt || "Foto", breit: true, inhalt: `<img src="${esc(im.src)}" alt="" style="width:100%;max-height:75vh;object-fit:contain">`, knoepfe: [] }); });
  (async () => { for(const im of box.querySelectorAll("img[data-fpfad]")){ const p = im.dataset.fpfad; if(!p.startsWith(AS.kunde + "/")) continue; const u = await asSigniert(p); if(u) im.src = u; } })();
  const tn = box.querySelector("#tkNeu"); if(tn) tn.onclick = () => asTaetigkeitDialog(s, null);
  const av = box.querySelector("#alsVorlage"); if(av) av.onclick = () => asAlsVorlageDialog(s);
  const rn = box.querySelector("#resNeu"); if(rn) rn.onclick = () => asGefDialog(s, Object.assign({ art: "ressource" }), null);

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
  if(!neu && asDarf("loeschen")) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!await asLoeschenBestaetigt("Tätigkeit mit ihren Gefährdungen löschen?", "as_taetigkeit", t.id)) return false; await asLaden(); asZeige(); } });
  asDialog({ titel: neu ? "Neue Tätigkeit" : t.name, inhalt: `<div class="form">${asFeld("Tätigkeit (z. B. Werkzeugwechsel, Störung beseitigen)", "name", t.name, "text", "voll")}
    ${asFeld("Wer führt sie aus? (Rollen mit Komma)", "rollen", asListe(t.rollen).join(", "), "text", "voll")}
    ${asFeld("Fundstelle (z. B. DGUV 113-606 3.2.2)", "rechtsquelle", t.rechtsquelle || "", "text", "voll")}</div>
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
  const neu = !g || !g.id; g = Object.assign({ art: "gefaehrdung", taetigkeit_id: taetigkeitId, w_v: 2, s_v: 2, w_n: 1, s_n: 2 }, g || {});
  const ws = (f, v) => asAuswahl(f.startsWith("w") ? "Wahrscheinlichkeit " + (f.endsWith("v") ? "vorher" : "nachher") : "Schwere " + (f.endsWith("v") ? "vorher" : "nachher"), f, v || "", [["", "–"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]]);
  const ms = g.id ? asMassnahmenZu(g.id) : [];
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.kurz){ asMeldung("Kurztext fehlt"); return false; }
    ["w_v", "s_v", "w_n", "s_n"].forEach(k => w[k] = w[k] ? +w[k] : null); w.taetigkeit_id = w.taetigkeit_id || null;
    // Plausibilität beim Speichern (Schritt 4): danach nie höher als heute; fehlende Fundstelle nur als Hinweis
    if(w.art !== "ressource" && asRisiko(w.w_n, w.s_n) > asRisiko(w.w_v, w.s_v) && asRisiko(w.w_v, w.s_v)){ asMeldung("Risiko nach Maßnahmen ist höher als heute – bitte Bewertung prüfen"); return false; }
    w.vorsorge = [...d.querySelectorAll("[data-vs]:checked")].map(x => x.dataset.vs);
    w.pruefarten = [...d.querySelectorAll("[data-pa]:checked")].map(x => x.dataset.pa);
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
    if(w.art !== "ressource" && !String(w.rechtsquelle || "").trim()) asMeldung("Gespeichert – bitte noch die Fundstelle (Rechtsquelle) ergänzen");
    asZeige(); } }];
  if(!neu){
    kn.unshift({ t: "+ Maßnahme", klasse: "sek", fn: () => { asMassnahmeDialog(null, { gefaehrdung_id: g.id, quelle: "bda" }, s); return false; } });
    if(asDarf("loeschen")) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!await asLoeschenBestaetigt("Gefährdung löschen? Maßnahmen bleiben ohne Bezug erhalten.", "as_gefaehrdung", g.id)) return false; await asLaden(); asZeige(); } });
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
      <div class="voll"><b>Vorsorgeanlass (ArbMedVV)</b> <span class="hinweis">– für alle Personen der Rollen dieser Beurteilung wird die Vorsorge fällig</span>
        <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">${(typeof AS_NW_ANLAESSE !== "undefined" ? AS_NW_ANLAESSE : []).map(([t, art]) =>
          `<label style="flex-direction:row;gap:6px;align-items:center"><input type="checkbox" data-vs="${esc(t)}" ${(g.vorsorge || []).includes(t) ? "checked" : ""}> ${esc(t)} <span class="hinweis">(${art === "pflicht" ? "Pflicht" : "Angebot"})</span></label>`).join("")}</div></div>
      <div class="voll"><b>Prüfung erforderlich (BetrSichV)</b> <span class="hinweis">– fehlt die Einrichtung im Prüfkataster, wird das eine Aufgabe</span>
        <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">${(typeof AS_PF_ARTEN !== "undefined" ? AS_PF_ARTEN : []).map(a =>
          `<label style="flex-direction:row;gap:6px;align-items:center" title="${esc(a.grundlage || "")}"><input type="checkbox" data-pa="${esc(a.id)}" ${(g.pruefarten || []).includes(a.id) ? "checked" : ""}> ${esc(a.titel)}</label>`).join("")}</div></div>
      ${asFeld("Herleitung / Notiz", "beschreibung", g.beschreibung, "textarea", "voll")}
      <div class="voll"><b>Fotos</b><div class="hakenliste" id="gefFotoListe">${(g.fotos || []).map((f, i) =>
          `<label title="abwählen = entfernen"><input type="checkbox" data-fbeh="${i}" checked><img data-fpfad="${esc(f.pfad || "")}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:6px;background:#eef1f5"> ${esc(f.alt || "Foto " + (i + 1))}</label>`).join("")
          || `<span class="hinweis">noch keine</span>`}</div>
        ${asDarf("pflegen") ? `<label style="margin-top:6px">Fotos hinzufügen<input type="file" id="gefFotos" accept="image/*" capture="environment" multiple></label>` : ""}</div>
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
    if(!neu && asDarf("loeschen")) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!await asLoeschenBestaetigt("Eintrag zur psychischen Belastung löschen?", "as_psyche", p.id)) return false; asZeige(); } });
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
  const frei = neu && !m.gefaehrdung_id && !sys;       // aus der Maßnahmen-Seite: Anlage(n) und Gefährdung frei wählbar
  const alleAnl = frei && typeof asAnlagen === "function" ? asAnlagen().filter(d => d.maschinen_id) : [];
  const kn = [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.text){ asMeldung("Text fehlt"); return false; }
    w.termin = w.termin || null;
    if("einheit_id" in w) w.einheit_id = w.einheit_id || null;
    if(frei){
      const gew = [...d.querySelectorAll("[data-anlw]:checked")].map(x => x.value), gef = (d.querySelector("#mnGef") || {}).value || null;
      if(gew.length){
        const gruppe = gew.length > 1 && crypto.randomUUID ? crypto.randomUUID() : null;
        for(const a of gew) await asSpeichern("as_massnahme", Object.assign({}, m, w, { anlage: a, gefaehrdung_id: gef, gruppe }));
        asMeldung(gew.length > 1 ? "Maßnahme für " + gew.length + " Anlagen angelegt (je Anlage in der Mängelliste)" : "Maßnahme angelegt – steht in der Mängelliste der Anlage");
        asZeige(); return; }
    }
    if(neu && w.umsetzung === "anlage"){
      const gew = [...d.querySelectorAll("[data-anl]:checked")].map(x => x.value);
      if(!gew.length){ asMeldung("Mindestens eine Anlage wählen"); return false; }
      const gruppe = crypto.randomUUID ? crypto.randomUUID() : null;
      for(const a of gew) await asSpeichern("as_massnahme", Object.assign({}, m, w, { anlage: a, gruppe }));
    } else await asSpeichern("as_massnahme", Object.assign({ id: m.id }, neu ? m : {}, w));
    asZeige(); } }];
  if(!neu && asDarf("loeschen")) kn.unshift({ t: "Löschen", klasse: "gefahr", fn: async () => { if(!await asLoeschenBestaetigt("Maßnahme löschen?", "as_massnahme", m.id)) return false; asZeige(); } });
  if(!neu){   /* Aktionen im selben Dialog (UI-Regel § 11) */
    if(m.status === "offen") kn.unshift({ t: "Erledigt melden", klasse: "sek", fn: () => { asErledigtDialog(m); return false; } });
    if(m.status === "erledigt" && asDarf("pflegen")) kn.unshift({ t: "Wirksam bestätigen", klasse: "", fn: async () => { await asSpeichern("as_massnahme", { id: m.id, status: "wirksam" }); asZeige(); } });
    if(m.status !== "offen" && asDarf("pflegen")) kn.unshift({ t: "Zurück auf offen", klasse: "sek", fn: async () => { await asSpeichern("as_massnahme", { id: m.id, status: "offen" }); asZeige(); } });
  }
  const gefS = m.gefaehrdung_id ? asNach("as_gefaehrdung", m.gefaehrdung_id) : null;
  const asaS = !neu && m.quelle === "asa" && m.quelle_id ? asNach("as_asa", m.quelle_id) : null;   // Verweis Maßnahme → ASA-Sitzung
  const stand = neu ? "" : `${asaS && typeof asMpZurSitzung === "function" ? `<p class="hinweis">Beschluss der ASA-Sitzung vom ${asDat(asaS.datum)} · <a href="#" onclick="asMpZurSitzung('${esc(asaS.id)}'); return false;">Sitzung öffnen</a></p>` : ""}<p>${asStatusChip(m)}${m.befund ? ` <span class="hinweis">Befund: ${esc(m.befund)}</span>` : ""}${m._v1 ? ` <span class="hinweis">· Mangel im Kundenportal – Änderungen wirken in Mängelliste, Hallenplan und Dokumenten</span>` : ""}</p>
    ${m.erledigt_am || m.wirksam_am || m.unterwiesen_am ? `<div class="zeilen">${m.erledigt_am ? `<div class="z"><div><b>Erledigt</b><small>${asDat(m.erledigt_am)} · ${esc(m.erledigt_von || "")} · ${esc(m.erledigt_notiz || "")}</small></div></div>` : ""}
      ${m.unterwiesen_am ? `<div class="z"><div><b>Unterwiesen</b><small>${asDat(m.unterwiesen_am)}</small></div></div>` : ""}
      ${m.wirksam_am ? `<div class="z"><div><b>Wirksam bestätigt</b><small>${asDat(m.wirksam_am)} · ${esc(m.wirksam_von || "")}</small></div></div>` : ""}</div>` : ""}`;
  asDialog({ titel: neu ? "Neue Maßnahme" : "Maßnahme", inhalt: `${stand}${!neu && m.stop === "S" && gefS && gefS.gefahrstoff_id ? `<p class="hinweis">Substitution:
        den Stoff im Gefahrstoffkataster durch einen Ersatzstoff ersetzen – die Maßnahme gilt damit als umgesetzt.
        <button type="button" class="btn sek klein" onclick="document.getElementById('dlg').close(); AS_GS.oeffnen='${esc(gefS.gefahrstoff_id)}'; asGehe('gefahrstoffe/kataster')">Ersatzstoff festlegen</button></p>` : ""}<div class="form">
      ${asAuswahl("STOP-Stufe", "stop", m.stop, Object.entries(AS_STOP).map(([k, v]) => [k, k + " – " + v]))}
      ${asAuswahl("Folge bei O (was die Maßnahme regelt)", "folge_art", m.folge_art || "", Object.entries(AS_MN_FOLGE), "mnFolge")}
      ${neu ? asAuswahl("Umsetzung", "umsetzung", m.umsetzung, [["zentral", "zentral für alle"], ["anlage", "je Anlage (Zähler „x von y“)"]]) : ""}
      ${asFeld("Maßnahme", "text", m.text, "textarea", "voll")}
      ${asFeld("Verantwortlich", "verantwortlich", m.verantwortlich)}${asFeld("Bis wann", "termin", m.termin, "date")}
      ${m.gefaehrdung_id ? "" : asBereichWahl("Bereich", "einheit_id", neu && !("einheit_id" in m) ? null : (m.einheit_id || ""), "", "– betriebsweit –")}
      ${frei && alleAnl.length ? `<div class="voll"><b>An welchen Anlagen?</b> <span class="hinweis">optional – dann steht die Maßnahme in der Mängelliste der Anlage</span>
        <div class="filterleiste" style="margin:6px 0"><input type="search" id="mnAnlSuche" placeholder="Anlage suchen"></div>
        <div class="hakenliste" id="mnAnl" style="max-height:200px;overflow:auto">${alleAnl.map(d => `<label data-such="${esc(((d.maschine || d.titel || "") + " " + d.maschinen_id).toLowerCase())}"><input type="checkbox" data-anlw value="${esc(d.maschinen_id)}"> ${esc(d.maschine || d.titel)} <span class="hinweis">${esc(d.maschinen_id)}</span></label>`).join("")}</div></div>
        <label class="voll">Gefährdung in der Beurteilung (optional)<select id="mnGef"><option value="">– erst Anlage wählen –</option></select></label>` : ""}</div>
      ${neu && anlagen.length ? `<div style="margin-top:10px"><span class="hinweis">Anlagen (bei „je Anlage“):</span><br>${anlagen.map(a => `<label style="margin-right:12px"><input type="checkbox" data-anl value="${esc(a)}" checked> ${esc(a)}</label>`).join("")}</div>` : ""}
      <p class="hinweis">Rangfolge nach § 4 ArbSchG: erst S und T, dann O, zuletzt P (z. B. Gehörschutz ist P). Umgesetzte O- und P-Maßnahmen werden
        automatisch zur Unterweisung fällig; P an einem Gefahrstoff zusätzlich zum Handschuh-/Hautschutzplan.</p>`, knoepfe: kn });
  const dl = document.getElementById("dlg"), st = dl.querySelector('[data-f="stop"]'), fo = dl.querySelector(".mnFolge");
  if(frei && dl.querySelector("#mnAnl")){
    const sel = dl.querySelector("#mnGef"), su = dl.querySelector("#mnAnlSuche");
    const fuell = () => { const gew = [...dl.querySelectorAll("[data-anlw]:checked")].map(x => x.value);
      const sysIds = new Set(asT("as_arbeitssystem").filter(s2 => asListe(s2.anlagen).some(a => gew.includes(a))).map(s2 => s2.id));
      const gef = asT("as_gefaehrdung").filter(g => sysIds.has(g.arbeitssystem_id) && g.art !== "ressource");
      sel.innerHTML = `<option value="">${gew.length ? "– keine bestimmte Gefährdung –" : "– erst Anlage wählen –"}</option>` + gef.map(g => `<option value="${esc(g.id)}">${esc(g.kurz)}</option>`).join(""); };
    dl.querySelectorAll("[data-anlw]").forEach(c => c.onchange = fuell);
    su.oninput = () => { const q = su.value.trim().toLowerCase(); dl.querySelectorAll("#mnAnl label").forEach(l => l.style.display = !q || l.dataset.such.includes(q) ? "" : "none"); };
  }
  const zeig = () => { if(fo) fo.style.display = st.value === "O" ? "" : "none"; }; if(st){ st.onchange = zeig; zeig(); }
}
/* Prozessmodell P11 „Maßnahme O“: Unterweisung/BA (über den Unterweisungsauftrag), Frist/Prüfung, Beauftragung */
const AS_MN_FOLGE = { "": "– nur Regelung/Anweisung –", unterweisung: "Unterweisung / Betriebsanweisung anpassen", pruefung: "Prüfung oder Frist festlegen", beauftragung: "Beauftragung / Zuständigkeit regeln" };
function asMnFolgeAnlage(m){ return (m.maschinen_id || String(m.anlage || "").split(" ")[0] || "").trim(); }
function asMnFolge(m){
  if(m.stop !== "O" || !m.folge_art) return;
  if(m.folge_art === "pruefung" && typeof asPfNeu === "function"){
    asPfNeu("sonstiges", null, asMnFolgeAnlage(m) || undefined);
    const n = document.querySelector('#dlg [data-f="notiz"]'); if(n) n.value = "aus Maßnahme " + m.id + ": " + (m.text || "");
    const b = document.querySelector('#dlg [data-f="bezeichnung"]'); if(b && !b.value) b.value = String(m.text || "").slice(0, 80);
    asMeldung("Prüfung bzw. Frist zur Maßnahme im Prüfkataster festlegen"); }
  else if(m.folge_art === "beauftragung"){ asMeldung("Beauftragung regeln: Person bestellen und Nachweis eintragen"); asGehe("organisation/beauftragte"); }
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
    if(m.quelle === "asa"){ const s = asNach("as_asa", m.quelle_id); return "ASA-Beschluss" + (s ? " vom " + asDat(s.datum) : ""); }
    return { orgcheck: "Organisations-Check", asa: "ASA-Beschluss", mitzeichnung: "Mitzeichnung", meldung: "Meldung", ziel: "Ziel", kultur: "Präventionskultur" }[m.quelle] || m.quelle; };
  const zeilen = einzeln.sort((a, b) => (a.termin || "9").localeCompare(b.termin || "9")).map(m => `<div class="z" data-m="${m.id}"><div><b>${asStopChip(m.stop)}${esc(m.text)}</b>
      <small>${esc(herkunft(m))} · ${esc(m.verantwortlich || "Verantwortlich offen")} · bis ${asDat(m.termin)}</small></div>${asStatusChip(m)}</div>`)
    .concat(Object.values(gruppen).map(g => { const alleG = alle.filter(x => x.gruppe === g[0].gruppe), w = alleG.filter(x => x.status === "wirksam").length;
      return `<div class="z" data-gr="${g[0].gruppe}"><div><b>${asStopChip(g[0].stop)}${esc(g[0].text)}</b><small>${esc(herkunft(g[0]))} · je Anlage · ${esc(g[0].verantwortlich || "Verantwortlich offen")} · bis ${asDat(g[0].termin)}</small></div>
        ${asChip(w + " von " + alleG.length + " Anlagen wirksam", w === alleG.length ? "gruen" : "gelb")}</div>`; }));
  main.innerHTML = `<h1 class="seite">Maßnahmen</h1><p class="unter">Erledigt meldet die Führungskraft vor Ort, „wirksam“ bestätigt die Fachkraft (OAK oder vor Ort). Erst dann wirkt die Maßnahme in der BdA.</p>
    ${r.html}<div class="karte"><h2>${filt.length} Maßnahmen <button class="btn klein" id="mNeu">+ Maßnahme</button></h2><div class="zeilen">${zeilen.join("") || `<div class="leer">Keine.</div>`}</div></div>`;
  document.getElementById("mNeu").onclick = async () => { if(typeof asBetriebLaden === "function") await asBetriebLaden().catch(() => {}); asMassnahmeDialog(null, { quelle: "massnahme" }); };
  main.querySelectorAll("[data-m]").forEach(z => z.onclick = () => asMassnahmeStatus(asNach("as_massnahme", z.dataset.m)));
  main.querySelectorAll("[data-gr]").forEach(z => z.onclick = () => asGruppeDialog(z.dataset.gr));
}};
function asMassnahmeStatus(m){ return asMassnahmeDialog(m); }
function asMassnahmeStatusAlt(m){
  const kn = [];
  if(m.status === "offen") kn.push({ t: "Erledigt melden", fn: () => { asErledigtDialog(m); return false; } });
  if(m.status === "erledigt" && asDarf("pflegen")) kn.push({ t: "Wirksam bestätigen", klasse: "", fn: async () => { await asSpeichern("as_massnahme", { id: m.id, status: "wirksam" }); asZeige(); } });
  if(m.status !== "offen" && asDarf("pflegen")) kn.push({ t: "Zurück auf offen", klasse: "sek", fn: async () => { await asSpeichern("as_massnahme", { id: m.id, status: "offen" }); asZeige(); } });
  kn.push({ t: "Bearbeiten", klasse: "sek", fn: () => { asMassnahmeDialog(m); return false; } });
  asDialog({ titel: "Maßnahme", inhalt: `<p>${asStopChip(m.stop)}<b>${esc(m.text)}</b></p>${m.befund ? `<p class="hinweis">Befund: ${esc(m.befund)}</p>` : ""}<p>${asStatusChip(m)}${m._v1 ? ` <span class="hinweis">· Mangel im Kundenportal – Änderungen wirken in Mängelliste, Hallenplan und Dokumenten</span>` : ""}</p>
    <div class="zeilen"><div class="z"><div><b>Verantwortlich</b><small>${esc(m.verantwortlich || "–")} · bis ${asDat(m.termin)}${m.anlage ? " · Anlage " + esc(m.anlage) : ""}</small></div></div>
    ${m.erledigt_am ? `<div class="z"><div><b>Erledigt</b><small>${asDat(m.erledigt_am)} · ${esc(m.erledigt_von || "")} · ${esc(m.erledigt_notiz || "")}</small></div></div>` : ""}
    ${m.unterwiesen_am ? `<div class="z"><div><b>Unterwiesen</b><small>${asDat(m.unterwiesen_am)} – Nachweis unter Unterweisungen</small></div></div>` : ""}
    ${m.folge_art ? `<div class="z"><div><b>Folge</b><small>${esc(AS_MN_FOLGE[m.folge_art] || m.folge_art)}</small></div></div>` : ""}
    ${m.wirksam_am ? `<div class="z"><div><b>Wirksam bestätigt</b><small>${asDat(m.wirksam_am)} · ${esc(m.wirksam_von || "")}</small></div></div>` : ""}</div>`, knoepfe: kn });
}
function asErledigtDialog(m){
  asDialog({ titel: "Erledigt melden", inhalt: `<p>${asStopChip(m.stop)}${esc(m.text)}${m.anlage ? " · " + esc(m.anlage) : ""}</p><div class="form">
      ${asFeld("Wer hat es erledigt?", "erledigt_von", AS.ich)}${asFeld("Erledigt am", "erledigt_am", asHeute(), "date")}
      ${asFeld("Was wurde gemacht?", "erledigt_notiz", "", "textarea", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.erledigt_von || !w.erledigt_notiz){ asMeldung("Wer und was ausfüllen"); return false; }
      await asSpeichern("as_massnahme", Object.assign({ id: m.id, status: "erledigt" }, w)); asZeige();
      if(m.stop === "O" && m.folge_art && m.folge_art !== "unterweisung"){ setTimeout(() => asMnFolge(m), 50); } } }] });
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
/* [Text, folge_art] – folge_art steuert die automatische Folge der Maßnahme (unterweisung → Unterweisungsauftrag,
   pruefung → Prüfkataster). Objekte, die direkt entstehen können, legt asMzObjekte an (Stoff, Plan-Prüfung, BdA-Auftrag). */
const AS_MZ_FOLGEN = {
  maschine: [["Anlage im Cockpit anlegen (Anlagen → + Anlage): legt Beurteilung als Entwurf und die Prüfung vor erster Verwendung an", ""],
    ["Prüfung vor erster Verwendung durchführen – vorher keine Inbetriebnahme (§ 14 Abs. 1 BetrSichV)", "pruefung"], ["Betriebsanweisung erstellen und vor Inbetriebnahme unterweisen", "unterweisung"]],
  umbau: [["Änderung an der Anlage melden (Anlagen → Verwalten → Änderung melden): Prüfung nach § 14 Abs. 2 BetrSichV und Beurteilung werden fällig", ""],
    ["Betriebsanweisung anpassen und neu unterweisen", "unterweisung"]],
  gefahrstoff: [["SDB hinterlegen und Tätigkeit nach EMKG beurteilen (der Stoff steht schon im Verzeichnis)", ""], ["Betriebsanweisung und Unterweisung vor der ersten Verwendung", "unterweisung"]],
  bau: [["Beurteilung der Arbeitsbedingungen für den Bereich anpassen (Auftrag ist angelegt)", ""], ["Flucht- und Rettungsplan aktualisieren (ist zur Aktualisierung markiert)", ""]],
  verfahren: [["Beurteilung der Arbeitsbedingungen anpassen (Auftrag ist angelegt)", ""], ["Beschäftigte unterweisen", "unterweisung"]],
  stelle: [["Erstunterweisung und Vorsorge vor Arbeitsbeginn planen", "unterweisung"]],
  mutterschutz: [["Schutzmaßnahmen nach § 10 MuSchG umsetzen und Gespräch anbieten", ""], ["Mitteilung an die Aufsichtsbehörde", ""]],
  psa: [["PSA beschaffen und Benutzung unterweisen", "unterweisung"]],
  fremdfirma: [["Auftrag unter Personal → Fremdfirmen anlegen: Gefährdungen abstimmen, Externe einweisen", ""]] };
/* Mit der Freigabe entstehen die Folgeobjekte selbst (Prozessmodell P12 → P10/P22/P23/P25/P26) */
async function asMzObjekte(x){
  const obj = {};
  try{
    if(x.art === "gefahrstoff"){
      const r = await apiSend("POST", "/rest/v1/portal_gefahrstoff", { kunde_slug: AS.kunde, bezeichnung: x.titel, verwendung_status: "aktiv", aktiv: true, quelle: "portal",
        einheit_ids: x.einheit_id ? [x.einheit_id] : [], hinweis: "aus Mitzeichnung vom " + asDat(asHeute()), geaendert_von: AS.ich }, "return=representation");
      if(r && r[0]) obj.gefahrstoff = r[0].id;
    }
    if(["bau", "verfahren", "umbau"].includes(x.art) && x.einheit_id)
      obj.bda = await apiSend("POST", "/rest/v1/rpc/portal_mitzeichnung_folgen", { p_id: x.id }).catch(() => 0) || 0;
    if(x.art === "bau") for(const n of asT("as_notfall").filter(n => n.status !== "archiviert" && (n.art === "fluchtplan" || n.art === "alarmplan") && (!n.einheit_id || !x.einheit_id || n.einheit_id === x.einheit_id)))
      await asSpeichern("as_notfall", { id: n.id, pruefen_ab: new Date().toISOString(), pruefen_grund: ("Bauvorhaben: " + x.titel).slice(0, 200) });
    if(x.art === "fremdfirma"){ const r = await asSpeichern("as_fremdfirma", { name: x.titel, taetigkeit: x.beschreibung || null, einheit_id: x.einheit_id || null, gefaehrlich: true, erstellt_von: AS.ich });
      if(r) obj.fremdfirma = r.id; }
  }catch(e){ asMeldung("Folgeobjekt nicht angelegt: " + (e.message || e)); }
  return obj;
}
function asMitzeichnungDialog(x){
  const kat = AS_KAT.mitzeichnung[x.art] || { titel: x.art, punkte: [] };
  const cl = x.checkliste || {}, sifa = AS.fachkraft && x.status !== "entschieden";
  const auflagen = asT("as_massnahme").filter(m => m.quelle === "mitzeichnung" && m.quelle_id === x.id);
  const kn = [];
  if(sifa) kn.push({ t: "Empfehlung speichern", klasse: "", fn: async d => { const w = asWerte(d), c = {};
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
        const folgen = (x.checkliste && x.checkliste._auflagen || []).map(t => [t, ""]).concat(AS_MZ_FOLGEN[x.art] || []);
        for(const [t, fa] of folgen) await asSpeichern("as_massnahme", { quelle: "mitzeichnung", quelle_id: x.id, stop: "O", text: t + " – " + x.titel, umsetzung: "zentral",
          status: "offen", termin: term, einheit_id: x.einheit_id || null, folge_art: fa || null });
        const obj = await asMzObjekte(x);
        if(Object.keys(obj).length) await asSpeichern("as_mitzeichnung", { id: x.id, checkliste: Object.assign({}, x.checkliste || {}, { _objekt: obj.gefahrstoff || obj.fremdfirma || null, _folgen: obj }) });
        asMeldung(folgen.length + " Folgeschritte als Maßnahmen angelegt" + (obj.gefahrstoff ? " · Stoff ins Verzeichnis aufgenommen" : "") + (obj.bda ? " · " + obj.bda + " Beurteilung(en) zur Anpassung" : "") + (obj.fremdfirma ? " · Fremdfirmen-Auftrag angelegt" : ""));
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

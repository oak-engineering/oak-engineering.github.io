/* Dokumente & Betriebsanweisung einer Beurteilung (Plan intern/plan-eine-welt.md, Schritt 4).
   Die Dokumente (BdA, BA, Mängelliste, Begehungsprotokoll) entstehen aus der Datenbank (portal/anlage-bauen.js) –
   hier wird die BA bearbeitet (as_ba.inhalt wie doc-data.ba: piktogramme + t.de/en/tr), vorgelegt und freigegeben.
   Listen werden zeilenweise bearbeitet (eine Zeile = ein Punkt), **fett** steht für Hervorhebung. Keine KI. */
"use strict";

const AS_BA_FELDER = [
  ["titel2", "Titel (Maschine / Tätigkeit)", "zeile"], ["scope_text", "1. Anwendungsbereich", "text"],
  ["gefahren", "2. Gefahren für Mensch und Umwelt", "liste"], ["p015_text", "Wichtigstes Verbot (rot hervorgehoben)", "text"],
  ["schutz", "3. Schutzmaßnahmen und Verhaltensregeln", "liste"], ["psa_note", "Persönliche Schutzausrüstung (Hinweis)", "text"],
  ["fault_list", "4. Verhalten bei Störungen und im Gefahrfall", "li"], ["first_list", "5. Erste Hilfe", "li"],
  ["checks_text", "6. Prüfung und Instandhaltung", "text"]];
const AS_BA_SPR = [["de", "Deutsch"], ["en", "English"], ["tr", "Türkçe"]];
const AS_BA = { sprache: "de" };

/* HTML der Vorlage <-> einfacher Text für Beschäftigte (**fett**, eine Zeile je Punkt) */
function asBaZuText(v, art){
  const zuT = h => String(h || "").replace(/<br\s*\/?>/gi, " / ").replace(/<\/?b>/gi, "**").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
  if(art === "liste") return (Array.isArray(v) ? v : []).map(zuT).join("\n");
  if(art === "li") return String(v || "").split(/<\/li>/i).map(x => zuT(x.replace(/<li>/i, ""))).filter(Boolean).join("\n");
  return zuT(v);
}
function asBaZuHtml(t, art){
  const zuH = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const zeilen = String(t || "").split("\n").map(x => x.trim()).filter(Boolean);
  if(art === "liste") return zeilen.map(zuH);
  if(art === "li") return zeilen.map(z => "<li>" + zuH(z) + "</li>").join("");
  return zuH(String(t || "").trim());
}

function asBaVorschauUrl(s, typ){
  const key = s.quelle_id || (asListe(s.anlagen)[0] || "");
  const mid = ((s.dok || {}).meta || {}).maschinenId || asListe(s.anlagen)[0] || key;
  return "viewer.html?typ=" + typ + "&p=" + encodeURIComponent("anl:" + AS.kunde + ":" + key) + "&mid=" + encodeURIComponent(mid) + "&t=" + encodeURIComponent(s.name + " · " + typ.toUpperCase());
}

async function asBdaDokumente(box, s){
  box.innerHTML = `<div class="leer">wird geladen …</div>`;
  const bas = await apiGet("/rest/v1/as_ba?select=*&arbeitssystem_id=eq." + encodeURIComponent(s.id) + "&order=version.desc").catch(() => []);
  let ba = (bas || [])[0];
  const darf = !!(AS.fachkraft || AS.gf), istAnlage = s.art !== "arbeitssystem" || s.quelle_id;
  const dokKnopf = (typ, t) => `<button class="btn sek klein" data-vor="${typ}">${t}</button>`;
  const status = !ba ? asChip("noch keine BA", "grau")
    : ba.status === "freigegeben" ? asChip("freigegeben " + asDat(ba.freigabe_am) + (ba.freigabe_von ? " · " + ba.freigabe_von : ""), "gruen")
    : ba.vorgelegt_am ? asChip("Entwurf – der GF vorgelegt " + asDat(ba.vorgelegt_am), "gelb") : asChip("Entwurf", "gelb");
  const t = ((ba && ba.inhalt && ba.inhalt.t) || {})[AS_BA.sprache] || {};
  box.innerHTML = `<div class="karte"><h2>Dokumente aus der Datenbank <span>${istAnlage ? dokKnopf("bda", "BdA") + dokKnopf("ba", "BA") + dokKnopf("maengelliste", "Mängelliste") + dokKnopf("protokoll", "Begehungsprotokoll") : dokKnopf("ba", "BA")}</span></h2>
      <p class="hinweis">Die Dokumente werden bei jedem Öffnen aus der Beurteilung und der Betriebsanweisung unten gebaut – es gibt keine zweite Fassung mehr.</p></div>
    <div class="karte"><h2>Betriebsanweisung ${status}
      <span>${ba && darf ? `<button class="btn klein" id="baSpeichern">Speichern</button>` : ""}
        ${ba && ba.status !== "freigegeben" && AS.fachkraft && !AS.gf && !ba.vorgelegt_am ? `<button class="btn sek klein" id="baVorlegen">Zur Freigabe vorlegen</button>` : ""}
        ${ba && ba.status !== "freigegeben" && AS.gf ? `<button class="btn klein" id="baFrei">Freigeben (Geschäftsführung)</button>` : ""}
        ${!ba && darf ? `<button class="btn klein" id="baNeu">BA anlegen</button>` : ""}</span></h2>
      ${ba ? `<div class="reiter nodruck">${AS_BA_SPR.map(([k, n]) => `<button class="${k === AS_BA.sprache ? "an" : ""}" data-spr="${k}">${n}</button>`).join("")}</div>
      ${AS_BA.sprache !== "de" ? `<p class="hinweis">Übersetzung: nach Änderungen am deutschen Text bitte hier nachziehen – es wird nichts automatisch übersetzt.</p>` : ""}
      <div class="form">${AS_BA_FELDER.map(([f, l, art]) => art === "zeile" ? asFeld(l, "ba_" + f, asBaZuText(t[f], art), "text", "voll")
        : `<label class="voll">${esc(l)}${art !== "text" ? ` <span class="hinweis">(eine Zeile je Punkt, **fett**)</span>` : ""}<textarea data-f="ba_${f}" rows="${art === "text" ? 3 : 5}"${darf ? "" : " readonly"}>${esc(asBaZuText(t[f], art))}</textarea></label>`).join("")}
        ${asFeld("Piktogramme Gefahren (Codes, z. B. W024 W017)", "pk_gefahren", asBaPk(ba, "gefahren"), "text", "voll")}
        ${asFeld("Piktogramme Schutz (z. B. M004 M009)", "pk_schutz", asBaPk(ba, "schutz"), "text", "voll")}
        ${asFeld("Piktogramme Erste Hilfe (z. B. E003)", "pk_ersthilfe", asBaPk(ba, "ersthilfe"), "text", "voll")}</div>
      <p class="hinweis">Version ${ba.version}${ba.geaendert_am ? " · zuletzt geändert " + asDat(ba.geaendert_am) + (ba.geaendert_von ? " von " + esc(ba.geaendert_von) : "") : ""}. Jede Änderung nach der Freigabe macht die BA wieder zum Entwurf – die Geschäftsführung gibt neu frei.</p>`
      : `<div class="leer">Für diese Beurteilung gibt es noch keine Betriebsanweisung.</div>`}</div>`;
  box.querySelectorAll("[data-vor]").forEach(b => b.onclick = () => asDokOeffnen(asBaVorschauUrl(s, b.dataset.vor), s.name + " · " + b.textContent));
  box.querySelectorAll("[data-spr]").forEach(b => b.onclick = () => { AS_BA.sprache = b.dataset.spr; asBdaDokumente(box, s); });
  const neu = box.querySelector("#baNeu"); if(neu) neu.onclick = async () => {
    await apiSend("POST", "/rest/v1/as_ba", { kunde_slug: AS.kunde, arbeitssystem_id: s.id, maschinen_id: asListe(s.anlagen)[0] || null, titel: s.name,
      inhalt: asBaVorschlag(s), status: "entwurf", einheit_id: s.einheit_id || null }, "return=minimal");
    asMeldung("BA als Entwurf aus der Beurteilung vorgeschlagen – bitte prüfen und ergänzen"); asBdaDokumente(box, s); };
  if(!ba) return;
  const speichern = async () => {
    const w = asWerte(box), inhalt = JSON.parse(JSON.stringify(ba.inhalt || {}));
    inhalt.t = inhalt.t || {}; const tt = inhalt.t[AS_BA.sprache] = inhalt.t[AS_BA.sprache] || {};
    AS_BA_FELDER.forEach(([f, , art]) => { if(("ba_" + f) in w) tt[f] = asBaZuHtml(w["ba_" + f] || "", art); });
    inhalt.piktogramme = inhalt.piktogramme || {};
    ["gefahren", "schutz", "ersthilfe"].forEach(k => { const c = String(w["pk_" + k] || "").toUpperCase().match(/[A-Z]\d{3}/g) || [];
      const h = Math.ceil(c.length / 2); inhalt.piktogramme[k] = { links: c.slice(0, h), rechts: c.slice(h) }; });
    await apiSend("PATCH", "/rest/v1/as_ba?id=eq." + encodeURIComponent(ba.id), { inhalt }, "return=minimal");
  };
  const sp = box.querySelector("#baSpeichern"); if(sp) sp.onclick = async () => { try{ await speichern(); asMeldung("Gespeichert"); asBdaDokumente(box, s); }catch(e){ asMeldung("Fehler: " + (e.message || e)); } };
  const vl = box.querySelector("#baVorlegen"); if(vl) vl.onclick = async () => { await speichern();
    await apiSend("PATCH", "/rest/v1/as_ba?id=eq." + encodeURIComponent(ba.id), { vorgelegt_am: new Date().toISOString() }, "return=minimal");
    asMeldung("Der Geschäftsführung zur Freigabe vorgelegt"); asBdaDokumente(box, s); };
  const fr = box.querySelector("#baFrei"); if(fr) fr.onclick = async () => { await speichern();
    await apiSend("PATCH", "/rest/v1/as_ba?id=eq." + encodeURIComponent(ba.id), { status: "freigegeben" }, "return=minimal");
    asMeldung("Betriebsanweisung freigegeben"); asBdaDokumente(box, s); };
}
function asBaPk(ba, k){ const p = ((ba.inhalt || {}).piktogramme || {})[k] || {}; return [].concat(p.links || [], p.rechts || []).join(" "); }

/* Vorschlag für eine neue BA aus der Beurteilung (Mensch prüft und gibt frei) */
function asBaVorschlag(s){
  const gef = asT("as_gefaehrdung").filter(g => g.arbeitssystem_id === s.id && g.art === "gefaehrdung");
  const gefahren = gef.slice(0, 6).map(g => "<b>" + esc(String(g.kurz || "").split(" – ").pop()) + ":</b> " + esc(g.situation || g.beschreibung || ""));
  const schutz = [...new Set(gef.flatMap(g => (g.schutzmassnahmen || []).map(x => x.text)).filter(Boolean))].slice(0, 8).map(esc);
  return { piktogramme: { gefahren: { links: [], rechts: [] }, schutz: { links: [], rechts: [] }, ersthilfe: { links: ["E003"], rechts: [] } },
    t: { de: { titel2: s.name, v_for: s.name, scope_text: "Diese Anweisung gilt für " + esc(s.name) + ".", gefahren, schutz,
      fault_list: "<li>Bei Störungen: Anlage stillsetzen (NOT-AUS) und Vorgesetzten verständigen.</li>",
      first_list: "<li>Ersthelfer holen, Notruf 112, Unfall melden.</li>", checks_text: "", p015_text: "", psa_note: "",
      footer: "Piktogramme nach ASR A1.3 / ISO 7010." } } };
}

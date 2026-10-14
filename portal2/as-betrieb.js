/* OAK Arbeitsschutz-App – Betrieb vor Ort, wie im Kundenportal: Anlagenkataster, Mängel, Hallenplan,
   Maschine prüfen, Vorfall melden, Unterweisungs-Terminal.
   Gleiche Daten wie das Kundenportal (portal_dokumente, portal_maengel, Storage „kundendokumente“).
   Die Einzelseiten des Kundenportals (viewer, maschine, qr, pruefen, melden, kiosk) werden unverändert
   eingebettet – das Kundenportal selbst wird hier nicht verändert. */
"use strict";

const AS_MG_THEMA = { schutzzaun: "Schutzzäune & Roboterzellen", leiter_aufstieg: "Leitern & Aufstiege", leckage_ordnung: "Leckagen & Ordnung",
  pruefung: "Prüfungen & Dokumentation", elektrik: "Elektrik", sonstiges: "Sonstiges",
  pruefung_meldung: "Gemeldet bei der Maschinenprüfung", betrieb_meldung: "Vom Betrieb gemeldet" };
const AS_MG_RANG = { betrieb_meldung: 0, schutzzaun: 1, leiter_aufstieg: 2, leckage_ordnung: 3, pruefung_meldung: 3, pruefung: 4, elektrik: 5, sonstiges: 6 };
const AS_BAND_WERT = { gefahr: 3, besorgnis: 2, akzeptanz: 1 };
const AS_BAND_FARBE = { gefahr: "rot", besorgnis: "gelb", akzeptanz: "gruen", keine: "gruen", aus: "grau" };
const AS_BAND_TEXT = { gefahr: "Gefahr", besorgnis: "Besorgnis", akzeptanz: "Akzeptanz", keine: "keine offenen Mängel", aus: "außer Betrieb" };
const AS_DOKTYPEN = [["bda", "BdA"], ["ba", "BA"], ["maengelliste", "Mängelliste"], ["protokoll", "Protokoll"]];
const AS_B = { docs: null, kurz: null, kunde: null };

/* ---------------- Daten ---------------- */
async function asBetriebLaden(neu){
  if(!neu && AS_B.kunde === AS.kunde && AS_B.docs) return;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const [docs, kurz] = await Promise.all([
    apiGet("/rest/v1/portal_dokumente?select=id,kunde,kunde_slug,maschine,maschinen_id,maschinentyp,storage_path,typen,status,updated_at,kategorie,titel,doc_typ,stand,url,sortierung"
      + k + "&order=kategorie.asc,sortierung.asc,maschine.asc,titel.asc").catch(() => []),
    apiGet(storagePfad(AS.kunde + "/anlagenkataster/kurzinfo.json")).catch(() => ({}))]);
  AS_B.docs = docs || []; AS_B.kurz = kurz && typeof kurz === "object" && !Array.isArray(kurz) ? kurz : {}; AS_B.kunde = AS.kunde;
}
function asMaengelRoh(){ return asT("as_massnahme").filter(m => m._v1 && m._mg).map(m => m._mg); }
function asMgFeld(m, k){ return (m.manuell && m.manuell[k]) || m[k]; }
function asMgBand(m){ return m.bewertung_manuell || m.band || "akzeptanz"; }
function asAnlagenBand(mid){
  let r = 0; asMaengelRoh().forEach(m => { if(m.maschinen_id === mid && m.status !== "erledigt") r = Math.max(r, AS_BAND_WERT[asMgBand(m)] || 1); });
  return ["keine", "akzeptanz", "besorgnis", "gefahr"][r];
}
function asAnlagen(){
  return (AS_B.docs || []).filter(d => d.kategorie === "anlagen" || d.kategorie === "allg-gbu")
    .sort((a, b) => String(a.maschine || a.titel || "").localeCompare(String(b.maschine || b.titel || ""), "de", { numeric: true }));
}
function asViewerUrl(typ, pfad, titel, extra){
  if(/^(docx?|xlsx?|pptx?|odt|ods|csv|zip)$/i.test(typ || "")) typ = "datei";   // Office-Dateien: Download statt Anzeige
  return "viewer.html?typ=" + encodeURIComponent(typ || "") + "&p=" + encodeURIComponent(pfad || "") + "&t=" + encodeURIComponent(titel || "") + (extra || "");
}
function asAnlageDokUrl(d, typ, label){
  return asViewerUrl(typ, d.storage_path, (d.maschine || d.titel) + " · " + label, "&m=" + encodeURIComponent(d.maschine || "") + "&mid=" + encodeURIComponent(d.maschinen_id || ""));
}
async function asSigniert(pfad){
  try{ const r = await apiSend("POST", "/storage/v1/object/sign/" + CFG.bucket + "/" + pfad, { expiresIn: 600 });
    return r && r.signedURL ? CFG.url + "/storage/v1" + r.signedURL : null; }catch(e){ return null; }
}
async function asFotoKlein(datei){
  const bild = await createImageBitmap(datei), f = Math.min(1, 1600 / Math.max(bild.width, bild.height));
  const c = document.createElement("canvas"); c.width = Math.round(bild.width * f); c.height = Math.round(bild.height * f);
  c.getContext("2d").drawImage(bild, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.75));
}
async function asFotoHochladen(datei, pfad){
  const blob = await asFotoKlein(datei);
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST",
    headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob });
  if(!r.ok) throw new Error("Foto-Upload fehlgeschlagen (" + r.status + ")");
  return pfad;
}
async function asMgLog(mangelId, aktion, notiz, nachweis){
  await apiSend("POST", "/rest/v1/portal_maengel_log", { mangel_id: mangelId, kunde_slug: AS.kunde, aktion, von_name: AS.ich, von_user_id: AS.uid,
    notiz: notiz || null, nachweis_pfad: nachweis || null }, "return=minimal").catch(() => {});
}
async function asMgAendern(m, daten, aktion, notiz, nachweis){
  await apiSend("PATCH", "/rest/v1/portal_maengel?id=eq." + encodeURIComponent(m.id), Object.assign({ updated_at: new Date().toISOString() }, daten), "return=minimal");
  await asMgLog(m.id, aktion, notiz, nachweis);
  await asLaden(); asZeige();
}

/* ---------------- Dokumente im Programm öffnen (Hook der Kundenportal-Seiten) ---------------- */
function asDokOeffnen(url, titel){
  let el = document.getElementById("asDok");
  if(!el){ el = document.createElement("div"); el.id = "asDok";
    el.style.cssText = "position:fixed;inset:0;z-index:50;background:#fff;display:flex;flex-direction:column";
    el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:#1f4e79;color:#fff">
        <button class="btn sek klein" id="asDokZu">← zurück</button><b id="asDokTitel" style="flex:1"></b>
        <a id="asDokNeu" target="_blank" rel="noopener" style="color:#fff">in neuem Fenster</a></div>
      <iframe id="asDokRahmen" style="flex:1;border:0;width:100%" allow="fullscreen; camera; microphone"></iframe>`;
    document.body.appendChild(el);
    document.getElementById("asDokZu").onclick = asDokSchliessen; }
  const ziel = /^(https?:|\/|\.\.\/)/.test(url) ? url : "../portal/" + url;
  document.getElementById("asDokTitel").textContent = titel || "";
  document.getElementById("asDokNeu").href = ziel;
  document.getElementById("asDokRahmen").src = ziel;
  el.style.display = "flex";
}
function asDokSchliessen(){ const el = document.getElementById("asDok"); if(el){ el.style.display = "none"; document.getElementById("asDokRahmen").src = "about:blank"; } }
window.portalDokOeffnen = asDokOeffnen;
window.portalDokSchliessenAktiv = asDokSchliessen;
function asDokKnoepfe(box){ box.querySelectorAll("[data-dok]").forEach(b => b.onclick = ev => { ev.stopPropagation(); asDokOeffnen(b.dataset.dok, b.dataset.titel || b.textContent); }); }

/* ======================= Anlagen ======================= */
AS_SEITEN.anlagen = { titel: "Anlagen", icon: "▦", sort: 4.2, async render(main){
  main.innerHTML = `<h1 class="seite">Anlagen</h1><p class="unter">Alle Anlagen mit Kurzinfo, offenen Mängeln und Dokumenten – Farbe = schlimmster offener Mangel.</p><div class="leer">wird geladen …</div>`;
  await asBetriebLaden();
  const roh = asMaengelRoh(), zeilen = asAnlagen().map(d => {
    const mid = d.maschinen_id, ki = AS_B.kurz[mid] || {}, aus = ki.betrieb === "ausser_betrieb";
    const band = aus ? "aus" : asAnlagenBand(mid), offen = roh.filter(m => m.maschinen_id === mid && m.status !== "erledigt").length;
    const sys = asT("as_arbeitssystem").find(s => asListe(s.anlagen).includes(mid));
    return { d, mid, ki, band, offen, sys };
  });
  const st = AS.anlFilter = AS.anlFilter || { q: "", band: "" };
  const zahl = b => zeilen.filter(z => z.band === b).length;
  const sicht = zeilen.filter(z => (!st.band || z.band === st.band) && (!st.q || (z.d.maschine + " " + (z.d.titel || "") + " " + z.mid + " " + (z.d.maschinentyp || "") + " " + (z.ki.bereich || "")).toLowerCase().includes(st.q.toLowerCase())))
    .sort((a, b) => (AS_BAND_WERT[b.band] || 0) - (AS_BAND_WERT[a.band] || 0) || String(a.d.maschine || a.d.titel).localeCompare(String(b.d.maschine || b.d.titel), "de", { numeric: true }));
  const veraltet = (d, typ) => typeof dokVeraltetInfo === "function" ? dokVeraltetInfo(d, roh, typ) : null;
  main.innerHTML = `<h1 class="seite">Anlagen</h1><p class="unter">Alle Anlagen mit Kurzinfo, offenen Mängeln und Dokumenten – Farbe = schlimmster offener Mangel.</p>
    <div class="kacheln">${["gefahr", "besorgnis", "akzeptanz", "keine"].map(b => `<div class="kachel k-${AS_BAND_FARBE[b]}" data-band="${b}"><div class="lbl">${AS_BAND_TEXT[b]}</div><div class="zahl">${zahl(b)}</div><div class="hinweis">${st.band === b ? "Filter aktiv – erneut tippen zum Aufheben" : "Anlagen"}</div></div>`).join("")}</div>
    <div class="karte"><h2>${sicht.length} von ${zeilen.length} Anlagen <input id="anlSuche" placeholder="Suchen (Name, Nr., Typ, Bereich)" value="${esc(st.q)}" style="max-width:280px"></h2>
      <div class="zeilen">${sicht.map(z => { const d = z.d;
        return `<div class="z" data-anl="${esc(z.mid)}"><div><b>${asPunkt(AS_BAND_FARBE[z.band])}${esc(d.maschine || d.titel)} <span class="hinweis">${esc(z.mid || "")}</span></b>
          <small>${esc(String(d.maschinentyp || "").replace(/\s*\(.*\)\s*$/, ""))}${z.ki.bereich ? " · " + esc(z.ki.bereich) : ""}${z.ki.baujahr ? " · Bj. " + esc(z.ki.baujahr) : ""} · ${z.offen} offene Mängel${z.band === "aus" ? " · außer Betrieb" : ""}</small>
          <div class="reihe" style="margin-top:6px;gap:6px;flex-wrap:wrap">${AS_DOKTYPEN.filter(([t]) => (d.typen || []).includes(t)).map(([t, l]) => { const v = veraltet(d, t);
              return `<button class="btn sek klein" data-dok="${esc(asAnlageDokUrl(d, t, l))}" data-titel="${esc((d.maschine || d.titel) + " · " + l)}">${esc(l)}${v ? " ⚠" : ""}</button>`; }).join("")}
            ${d.maschinen_id ? `<button class="btn sek klein" data-dok="${esc("maschine.html?k=" + encodeURIComponent(AS.kunde) + "&mid=" + encodeURIComponent(d.maschinen_id))}" data-titel="${esc(d.maschine || d.titel)}">Maschine</button>
              <button class="btn sek klein" data-dok="${esc("qr.html?k=" + encodeURIComponent(AS.kunde) + "&mid=" + encodeURIComponent(d.maschinen_id))}" data-titel="QR · ${esc(d.maschine || d.titel)}">QR</button>` : ""}
            ${z.sys ? `<button class="btn klein" data-sys="${z.sys.id}">BdA in der App</button>` : ""}</div></div>
          ${asChip(AS_BAND_TEXT[z.band], AS_BAND_FARBE[z.band])}</div>`; }).join("") || `<div class="leer">Keine Anlagen${st.q || st.band ? " zum Filter" : ""}.</div>`}</div>
      <p class="hinweis">⚠ = Dokument nicht mehr aktuell: ein Mangel wurde nach dem Dokumentstand behoben und ist noch nicht in die Unterlagen übernommen.</p></div>`;
  main.querySelectorAll("[data-band]").forEach(k => k.onclick = () => { st.band = st.band === k.dataset.band ? "" : k.dataset.band; AS_SEITEN.anlagen.render(main); });
  const s = document.getElementById("anlSuche"); s.oninput = () => { st.q = s.value; clearTimeout(AS.anlT); AS.anlT = setTimeout(() => { AS_SEITEN.anlagen.render(main).then(() => { const n = document.getElementById("anlSuche"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }); }, 300); };
  asDokKnoepfe(main);
  main.querySelectorAll("[data-sys]").forEach(b => b.onclick = ev => { ev.stopPropagation(); AS.reiter.bda = b.dataset.sys; asGehe("bda/" + b.dataset.sys); });
}};

/* ======================= Mängel ======================= */
AS_SEITEN.maengel = { titel: "Mängel", icon: "!", sort: 4.4, async render(main){
  await asBetriebLaden();
  const st = AS.mgFilter = AS.mgFilter || { status: "offen", anlage: "", band: "" };
  const alle = asMaengelRoh();
  const offen = alle.filter(m => m.status !== "erledigt"), zahl = b => offen.filter(m => asMgBand(m) === b).length;
  const sicht = alle.filter(m => (st.status === "alle" || (st.status === "offen" && m.status !== "erledigt") || (st.status === "erledigt" && m.status === "erledigt")
      || (st.status === "uebernehmen" && m.status === "erledigt" && !m.uebernommen_am))
    && (!st.anlage || m.maschinen_id === st.anlage) && (!st.band || asMgBand(m) === st.band));
  const gruppen = {};
  sicht.forEach(m => { const th = asMgFeld(m, "thema") || "sonstiges"; (gruppen[th] = gruppen[th] || []).push(m); });
  const anlagen = [...new Map(alle.map(m => [m.maschinen_id, m.maschine || m.maschinen_id])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "de", { numeric: true }));
  const vMid = new Map(asAnlagen().map(d => [d.maschinen_id, d]));
  main.innerHTML = `<h1 class="seite">Mängel</h1><p class="unter">Gleiche Mängelliste wie im Kundenportal. Erledigt melden mit Foto oder Text; „wirksam“ bestätigt die Fachkraft unter Maßnahmen.</p>
    <div class="kacheln">${["gefahr", "besorgnis", "akzeptanz"].map(b => `<div class="kachel k-${AS_BAND_FARBE[b]}" data-band="${b}"><div class="lbl">${AS_BAND_TEXT[b]}</div><div class="zahl">${zahl(b)}</div><div class="hinweis">offen${st.band === b ? " · Filter aktiv" : ""}</div></div>`).join("")}</div>
    <div class="karte"><h2>${sicht.length} Mängel <span><button class="btn klein" id="mgNeu">+ Mangel melden</button>${AS.admin ? ` <button class="btn adm klein" id="mgCsv">Zusammenstellung (CSV)</button>` : ""}</span></h2>
      <div class="form" style="margin-bottom:10px">${asAuswahl("Status", "status", st.status, [["offen", "offen"], ["erledigt", "erledigt"], ["alle", "alle"]].concat(AS.admin ? [["uebernehmen", "erledigt, noch nicht übernommen"]] : []))}
        ${asAuswahl("Anlage", "anlage", st.anlage, [["", "alle Anlagen"]].concat(anlagen))}</div>
      ${Object.entries(gruppen).sort((a, b) => (AS_MG_RANG[a[0]] ?? 9) - (AS_MG_RANG[b[0]] ?? 9)).map(([th, l]) => `<h3 style="font-size:14px;color:var(--blau);margin:16px 0 6px">${esc(AS_MG_THEMA[th] || th)} · ${l.length}</h3>
        <div class="zeilen">${l.sort((a, b) => (a.prioritaet || 9999) - (b.prioritaet || 9999)).map(m => `<div class="z" data-mg="${m.id}"><div>
          <b>${asPunkt(AS_BAND_FARBE[asMgBand(m)])}${esc(asMgFeld(m, "label") || "")}</b>
          <small>${esc(m.maschine || m.maschinen_id)}${asMgFeld(m, "massnahme") ? " · Maßnahme: " + esc(asMgFeld(m, "massnahme")) : ""}${m.gemeldet_von ? " · gemeldet von " + esc(m.gemeldet_von) + (m.gemeldet_am ? " am " + asDat(m.gemeldet_am) : "") : ""}
            ${m.status === "erledigt" ? " · erledigt " + asDat(m.erledigt_am) + (m.erledigt_von ? " von " + esc(m.erledigt_von) : "") + (m.uebernommen_am ? " · übernommen" : "") : ""}${m.wirksam_am ? " · wirksam bestätigt" : ""}</small></div>
          ${m.status === "erledigt" ? asChip(m.wirksam_am ? "wirksam" : "erledigt", m.wirksam_am ? "gruen" : "gelb") : asChip(AS_BAND_TEXT[asMgBand(m)], AS_BAND_FARBE[asMgBand(m)])}</div>`).join("")}</div>`).join("") || `<div class="leer">Keine Mängel zum Filter.</div>`}</div>`;
  main.querySelectorAll("[data-band]").forEach(k => k.onclick = () => { st.band = st.band === k.dataset.band ? "" : k.dataset.band; AS_SEITEN.maengel.render(main); });
  main.querySelectorAll("[data-f]").forEach(s => s.onchange = () => { st[s.dataset.f] = s.value; AS_SEITEN.maengel.render(main); });
  document.getElementById("mgNeu").onclick = () => asMangelNeu();
  if(AS.mgNeuSofort){ AS.mgNeuSofort = false; asMangelNeu(); }
  const csvK = document.getElementById("mgCsv"); if(csvK) csvK.onclick = () => asMgZusammenstellung(sicht);
  main.querySelectorAll("[data-mg]").forEach(z => z.onclick = () => asMangelDialog(alle.find(m => m.id === z.dataset.mg), vMid));
}};

/* ---- Zusammenstellung für die rechtliche Prüfung (nur Admin) – gleiche Einteilung wie im Kundenportal (maengel.js)
   und tools/maengel_zusammenstellung.py: A Beschaffenheit · B Zustand/Verschleiß · C Betreiberpflicht. Vorschlag nach Stichworten, kein Gutachten. */
const AS_KAUF_C = /gefährdungsbeurteilung|betriebsanweisung \(ba\)|\bgbu\b|\bba fehlt|prüf(ung|status|plakette|frist)|ungeprüft|dguv v(orschrift)? ?3|leiter|tritt|podest|aufstieg|befüll|gefahrstoff|kanister|ordnung|sauberkeit|feuerlöscher|verkehrsweg|stolper|hinweisschild|lesbar|stuhl|ergonom|arbeitsplatz|platzverhältnis|augenschutz|psa\b|unterweis|innerhalb der schutzumzäunung|fremdgerät|etikettier|abgestellt|lagerung|lagern|materialsäcke|hebe/i;
const AS_KAUF_A = /schutzz|umzäunung|umhausung|schutzabdeckung|abdeckung|schutzhaube|schutzeinrichtung|verriegel|not-?halt|not-?aus|\bce\b|ce-|konformität|typenschild|betriebsanleitung|anleitung|ungeschützt|ungesichert|einzug|eingreif|hineingreif|untergreif|durchgreif|durchgang|überfahren|bewegungsbereich|standsicher|schneidwerk|zugänglich/i;
function asMgGruppeKauf(m){
  const label = asMgFeld(m, "label") || "", thema = asMgFeld(m, "thema") || "";
  if(/^ALLG/i.test(m.maschinen_id || "")) return "C";
  if(AS_KAUF_C.test(label) && !/schutzz|umzäunung|schutzabdeckung|schutzhaube/i.test(label)) return "C";
  if(thema === "schutzzaun" || AS_KAUF_A.test(label)) return "A";
  if(thema === "pruefung" || thema === "leiter_aufstieg") return "C";
  return "B";
}
function asMgZusammenstellung(liste){
  const ki = AS_B.kurz || {};
  const gName = { A: "A Beschaffenheit der Anlage (kaufrechtlich prüfen)", B: "B Zustand/Verschleiß (Übergabe klären)", C: "C Betreiberpflicht (kein Mangel der Kaufsache)" };
  const masch = m => m.maschine || m.maschinen_id || "";
  const zeilen = liste.map(m => ({ m, g: asMgGruppeKauf(m), k: ki[m.maschinen_id] || {} }))
    .sort((x, y) => x.g.localeCompare(y.g) || masch(x.m).localeCompare(masch(y.m), "de", { numeric: true }));
  const zelle = v => '"' + String(v == null ? "" : v).replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
  const tag = s => s ? new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("de-DE") : "";
  const kopf = ["Gruppe", "Maschine", "Hersteller", "Typ", "Baujahr", "Serien-Nr.", "Mangel", "Norm / Rechtsgrundlage", "festgestellt am", "Richtkosten (€ netto)", "Status", "Einstufung"];
  const csv = [kopf.map(zelle).join(";")].concat(zeilen.map(({ m, g, k }) => [gName[g], masch(m), k.hersteller, k.typ, k.baujahr, k.seriennr, asMgFeld(m, "label"),
    m.rechtsquelle, tag(m.gemeldet_am || k.datum), m.kosten != null ? String(m.kosten).replace(".", ",") : "",
    m.status === "erledigt" ? "erledigt " + asDat(m.erledigt_am) : "offen",
    ({ gefahr: "Gefahrbereich", besorgnis: "Besorgnisbereich", akzeptanz: "Akzeptanzbereich" })[m.bewertung_manuell || m.band] || ""].map(zelle).join(";"))).join("\r\n");
  const el = document.createElement("a");
  el.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  el.download = "Maengel-Zusammenstellung-" + (AS.kunde || "betrieb") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(el); el.click(); el.remove();
}

function asMangelDialog(m, vMid){
  const d = vMid.get(m.maschinen_id), kn = [];
  if(m.status !== "erledigt") kn.push({ t: "Erledigt melden", fn: () => { asMangelErledigt(m); return false; } });
  if(AS.admin && m.status === "erledigt" && !m.uebernommen_am) kn.push({ t: "In Unterlagen übernommen", klasse: "adm", fn: async () => {
    await asMgAendern(m, { uebernommen_am: new Date().toISOString(), uebernommen_von: "OAK engineering" }, "übernommen"); } });
  if(AS.admin && m.status === "erledigt") kn.push({ t: "Wieder öffnen", klasse: "sek", fn: async () => {
    await asMgAendern(m, { status: "offen", erledigt_am: null, erledigt_von: null, notiz: null, nachweis_pfad: null }, "wieder geöffnet"); } });
  if(AS.admin) kn.push({ t: "Bearbeiten", klasse: "sek", fn: () => { asMangelBearbeiten(m); return false; } });
  const g = asNach("as_gefaehrdung", m.as_gefaehrdung_id);
  const dlg = asDialog({ titel: m.maschine || m.maschinen_id, inhalt: `<p>${asChip(AS_BAND_TEXT[asMgBand(m)], AS_BAND_FARBE[asMgBand(m)])} <b>${esc(asMgFeld(m, "label") || "")}</b></p>
      ${asMgFeld(m, "massnahme") ? `<p>Maßnahme: ${esc(asMgFeld(m, "massnahme"))}</p>` : ""}
      <div class="zeilen">${m.rechtsquelle ? `<div class="z"><div><b>Rechtsquelle</b><small>${esc(m.rechtsquelle)}</small></div></div>` : ""}
        <div class="z"><div><b>Gefährdung in der BdA</b><small>${g ? esc(g.kurz) : "noch nicht zugeordnet"}</small></div></div>
        ${m.status === "erledigt" ? `<div class="z"><div><b>Erledigt</b><small>${asDat(m.erledigt_am)} · ${esc(m.erledigt_von || "")} · ${esc(m.notiz || "")}</small></div></div>` : ""}</div>
      <div class="reihe" style="gap:6px;margin-top:10px;flex-wrap:wrap">
        ${m.foto_pfad ? `<button class="btn sek klein" data-foto="${esc(m.foto_pfad)}">Foto</button>` : ""}
        ${m.nachweis_pfad ? `<button class="btn sek klein" data-foto="${esc(m.nachweis_pfad)}">Nachweis-Foto</button>` : ""}
        ${d && (d.typen || []).includes("maengelliste") ? `<button class="btn sek klein" data-dok="${esc(asAnlageDokUrl(d, "maengelliste", "Mängelliste"))}" data-titel="${esc((d.maschine || d.titel) + " · Mängelliste")}">Mängelliste</button>` : ""}</div>`, knoepfe: kn });
  dlg.querySelectorAll("[data-foto]").forEach(b => b.onclick = async () => { const u = await asSigniert(b.dataset.foto); if(u) window.open(u, "_blank", "noopener"); else asMeldung("Foto nicht abrufbar"); });
  dlg.querySelectorAll("[data-dok]").forEach(b => b.onclick = () => { dlg.close(); asDokOeffnen(b.dataset.dok, b.dataset.titel); });
}
function asMangelErledigt(m){
  asDialog({ titel: "Erledigt melden", inhalt: `<p><b>${esc(asMgFeld(m, "label") || "")}</b></p><div class="form">
      ${asFeld("Erledigt am", "datum", asHeute(), "date")}${asFeld("Was wurde gemacht?", "notiz", "", "textarea", "voll")}
      <label class="voll">Foto als Nachweis (optional)<input type="file" accept="image/*" capture="environment" id="mgNachweis"></label></div>
      <p class="hinweis">Text oder Foto ist nötig. Die Fachkraft bestätigt danach die Wirksamkeit.</p>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d), f = d.querySelector("#mgNachweis").files[0];
      if(!w.notiz && !f){ asMeldung("Bitte beschreiben oder ein Foto anhängen."); return false; }
      const nachweis = f ? await asFotoHochladen(f, AS.kunde + "/maengel/" + m.id + "-" + Date.now() + ".jpg") : null;
      const am = !w.datum || w.datum === asHeute() ? new Date().toISOString() : w.datum + "T12:00:00";
      await asMgAendern(m, { status: "erledigt", erledigt_am: am, erledigt_von: AS.ich, notiz: w.notiz, nachweis_pfad: nachweis }, "erledigt", w.notiz, nachweis); } }] });
}
function asMangelBearbeiten(m){
  const sysIds = new Set(asT("as_arbeitssystem").filter(s => asListe(s.anlagen).includes(m.maschinen_id)).map(s => s.id));
  const gef = asT("as_gefaehrdung").filter(g => sysIds.has(g.arbeitssystem_id));
  asDialog({ titel: "Mangel bearbeiten (OAK)", breit: true, inhalt: `<div class="form">
      ${asFeld("Befund", "label", asMgFeld(m, "label"), "textarea", "voll")}${asFeld("Maßnahme", "massnahme", asMgFeld(m, "massnahme"), "textarea", "voll")}
      ${asAuswahl("Thema", "thema", asMgFeld(m, "thema") || "sonstiges", Object.entries(AS_MG_THEMA))}
      ${asAuswahl("Bewertung", "bewertung_manuell", m.bewertung_manuell || "", [["", "wie berechnet (" + (AS_BAND_TEXT[m.band] || "–") + ")"], ["gefahr", "Gefahr"], ["besorgnis", "Besorgnis"], ["akzeptanz", "Akzeptanz"]])}
      ${asAuswahl("Gefährdung in der BdA", "as_gefaehrdung_id", m.as_gefaehrdung_id || "", [["", "– keine –"]].concat(gef.map(g => [g.id, g.kurz])), "voll")}
      ${asFeld("Ausblenden (gilt nicht mehr)", "ausgeblendet", m.ausgeblendet, "checkbox")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d);
      const manuell = (w.label || "") !== (m.label || "") || (w.massnahme || "") !== (m.massnahme || "") || (w.thema || "") !== (m.thema || "")
        ? { label: w.label, massnahme: w.massnahme, thema: w.thema } : null;
      await asMgAendern(m, { manuell, bewertung_manuell: w.bewertung_manuell || null, as_gefaehrdung_id: w.as_gefaehrdung_id || null, ausgeblendet: !!w.ausgeblendet },
        "bearbeitet", w.bewertung_manuell ? "Bewertung: " + w.bewertung_manuell : null); } }] });
}
function asMangelNeu(){
  const anl = asAnlagen().filter(d => d.maschinen_id);
  asDialog({ titel: "Mangel melden", inhalt: `<div class="form">
      ${asAuswahl("Wo?", "mid", "", [["ALLG-HALLE", "Halle / allgemein"]].concat(anl.map(d => [d.maschinen_id, (d.maschine || d.titel) + " (" + d.maschinen_id + ")"])), "voll")}
      ${asFeld("Was ist der Mangel?", "label", "", "textarea", "voll")}
      ${asAuswahl("Wie gefährlich?", "band", "besorgnis", [["gefahr", "Gefahr – sofort handeln"], ["besorgnis", "Besorgnis – bald beheben"], ["akzeptanz", "gering"]])}
      <label class="voll">Foto (optional)<input type="file" accept="image/*" capture="environment" id="mgFoto"></label></div>`,
    knoepfe: [{ t: "Melden", fn: async d => { const w = asWerte(d), f = d.querySelector("#mgFoto").files[0];
      if(!w.label){ asMeldung("Bitte den Mangel beschreiben."); return false; }
      const sl = "BM-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
      const foto = f ? await asFotoHochladen(f, AS.kunde + "/maengel/" + sl + ".jpg") : null;
      const dok = anl.find(x => x.maschinen_id === w.mid);
      const r = await apiSend("POST", "/rest/v1/portal_maengel", { kunde_slug: AS.kunde, kunde: AS.org ? AS.org.name : null, maschinen_id: w.mid,
        maschine: dok ? dok.maschine || dok.titel : "Halle / allgemein", maschinentyp: dok ? dok.maschinentyp : "Tätigkeit / allgemein", schluessel: sl,
        thema: "betrieb_meldung", thema_rang: 0, label: w.label, band: w.band, prioritaet: { gefahr: 10, besorgnis: 3010, akzeptanz: 6010 }[w.band],
        status: "offen", foto_pfad: foto, gemeldet_von: AS.ich, gemeldet_am: asHeute() }, "return=representation");
      if(r && r[0]) await asMgLog(r[0].id, "erfasst", w.label, null);
      await asLaden(); asZeige(); asMeldung("Mangel gemeldet"); } }] });
}

/* ======================= Hallenplan ======================= */
AS_SEITEN.hallenplan = { titel: "Hallenplan", icon: "⌗", sort: 4.6, async render(main){
  await asBetriebLaden();
  const pl = (AS_B.docs || []).filter(d => d.kategorie === "hallenplan" && d.doc_typ !== "svg");
  const akt = pl.find(d => d.id === AS.reiter.hallenplan) || pl[0];
  main.innerHTML = `<h1 class="seite">Hallenplan</h1><p class="unter">Farbe je Maschine = schlimmster offener Mangel (live). Klick auf eine Maschine öffnet ihre Dokumente.</p>
    ${pl.length > 1 ? `<div class="reiter">${pl.map(d => `<button class="${d === akt ? "an" : ""}" onclick="asGehe('hallenplan/${d.id}')">${esc(d.titel || "Plan")}</button>`).join("")}</div>` : ""}
    ${akt ? `<iframe src="../portal/${esc(asViewerUrl(akt.doc_typ || "html", akt.storage_path, akt.titel || "Hallenplan"))}" style="width:100%;height:calc(100vh - 200px);min-height:520px;border:1px solid var(--linie);border-radius:10px;background:#fff"></iframe>`
      : `<div class="karte"><div class="leer">Für diesen Betrieb ist noch kein Hallenplan hinterlegt.</div></div>`}`;
}};

/* ======================= Gefahrstoffe ======================= */
/* Das Gefahrstoffkataster wird im Kundenportal laufend weiterentwickelt (SDB-Status, Verwendung, EMKG) –
   hier eingebettet, damit beide Apps immer denselben Stand zeigen (eine Quelle: portal_gefahrstoff*). */
AS_SEITEN.gefahrstoffe = { titel: "Gefahrstoffe", icon: "◬", sort: 4.65, render(main){
  main.innerHTML = `<h1 class="seite">Gefahrstoffe</h1><p class="unter">Gefahrstoffkataster mit Sicherheitsdatenblättern, Betriebsanweisungen und Gefährdungsbeurteilung – dieselbe Seite wie im Kundenportal.</p>
    <iframe src="../portal/index.html?eingebettet=1&k=${encodeURIComponent(AS.kunde)}#unterlagen/gefahrstoffe" style="width:100%;height:calc(100vh - 210px);min-height:560px;border:1px solid var(--linie);border-radius:10px;background:#fff"></iframe>`;
}};

/* ======================= Vor Ort: prüfen, melden, Terminal ======================= */
AS_SEITEN.vorort = { titel: "Vor Ort", icon: "⌂", sort: 4.8, async render(main){
  const r = asReiter("vorort", [["pruefen", "Maschine prüfen"], ["melden", "Vorfall melden"], ["terminal", "Unterweisungs-Terminal"]], "pruefen");
  main.innerHTML = `<h1 class="seite">Vor Ort</h1><p class="unter">Die Werkzeuge für Schichtführer und Beschäftigte – dieselben Seiten wie im Kundenportal.</p>${r.html}<div id="voInhalt"><div class="leer">wird geladen …</div></div>`;
  const box = document.getElementById("voInhalt"), k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const rahmen = src => `<iframe src="${esc(src)}" allow="fullscreen; camera; microphone; geolocation" style="width:100%;height:calc(100vh - 230px);min-height:560px;border:1px solid var(--linie);border-radius:10px;background:#fff"></iframe>`;
  if(r.akt === "pruefen") box.innerHTML = rahmen("../portal/pruefen.html?eingebettet=1&k=" + encodeURIComponent(AS.kunde));
  else if(r.akt === "melden"){
    const t = (await apiGet("/rest/v1/portal_melde_token?select=token,kunde_slug&aktiv=is.true" + k).catch(() => []))[0];
    box.innerHTML = t ? rahmen("../portal/melden.html?t=" + encodeURIComponent(t.token) + "&eingebettet=1")
      : `<div class="karte"><div class="leer">Für diesen Betrieb ist noch kein Melde-Zugang eingerichtet.</div></div>`;
  } else {
    const ts = await apiGet("/rest/v1/portal_terminal_token?select=token,kunde_slug,bezeichnung&aktiv=is.true" + k).catch(() => []);
    const t = ts.find(x => !/geteilt|handy/i.test(x.bezeichnung || "")) || ts[0];
    box.innerHTML = `<div class="karte"><h2>Unterweisungs-Terminal</h2>
      <p>Beschäftigte geben ihren Namen ein, wählen die Rolle und werden unterwiesen; der Nachweis geht direkt in die Datenbank.</p>
      ${t ? `<button class="btn" id="voTerm">Terminal starten</button> <span class="hinweis">Gerät: ${esc(t.bezeichnung || "Terminal")}</span>` : `<div class="leer">Für diesen Betrieb ist noch kein Terminal-Gerät eingerichtet.</div>`}
      <p class="hinweis">Nachweise, Fälligkeiten und Module stehen unter Unterlagen → Unterweisungen.</p></div>`;
    const b = document.getElementById("voTerm"); if(b) b.onclick = () => asDokOeffnen("kiosk.html#t=" + encodeURIComponent(t.token), "Unterweisungs-Terminal");
  }
}};

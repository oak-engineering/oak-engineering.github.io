/* OAK Kundenportal — Unterlagen: Anlagenkataster, Gefährdungsbeurteilungen, Betriebsanweisungen, QR-Codes
   (Nikolai 17.09.2026: „Anlagenkataster statt Maschinen & Anlagen, Betriebsanweisungen mit Sammel-BA und den
   einzelnen getrennt mit Suche, Gefährdungsbeurteilungen, QR-Codes. Im Anlagenkataster per Klick die Kurzinfo
   wie im Hallenplan im Pop-up, dort die zugehörigen Dokumente verlinkt" + „Kurzübersicht der Mängel je Maschine,
   automatisch weg, sobald behoben").
   Kurzinfo: <slug>/anlagenkataster/kurzinfo.json (tools/anlagen_kurzinfo.py). Mängel live aus portal_maengel. */
"use strict";

let UL_KURZINFO = null, UL_KURZINFO_FUER = null;
const UL_LISTEN = ["anlagen", "gbu", "ba", "qr"];

async function ulKurzinfoLaden(){
  if(UL_KURZINFO && UL_KURZINFO_FUER === AKTIV) return UL_KURZINFO;
  try{ UL_KURZINFO = await apiGet(storagePfad((AKTIV || "") + "/anlagenkataster/kurzinfo.json"), false) || {}; }
  catch(e){ UL_KURZINFO = {}; }
  UL_KURZINFO_FUER = AKTIV;
  return UL_KURZINFO;
}
function ulAnlagen(){ return sichtbar().filter(r => r.kategorie === "anlagen"); }
function ulAllg(){ return sichtbar().filter(r => r.kategorie === "allg-gbu"); }
function ulSammel(){ return sichtbar().filter(r => r.kategorie === "ba-sammel"); }
function ulHat(r, typ){ return (r.typen || []).includes(typ); }
function ulSort(a, b){ return String(a.maschine || a.titel || "").localeCompare(String(b.maschine || b.titel || ""), "de", { numeric: true }); }
function ulTyp(r){ return String(r.maschinentyp || "").replace(/\s*\(.*\)\s*$/, ""); }
/* Zaehler fuer die Karten auf der Unterlagen-Seite */
function ulAnzahl(kat){
  if(kat === "anlagen" || kat === "qr") return ulAnlagen().length;
  if(kat === "gbu") return ulAnlagen().filter(r => ulHat(r, "bda")).length + ulAllg().filter(r => ulHat(r, "bda")).length;
  if(kat === "ba") return ulSammel().length + ulAnlagen().filter(r => ulHat(r, "ba")).length + ulAllg().filter(r => ulHat(r, "ba")).length;
  return null;
}
/* Farbe der Anlage = schlimmster offener Mangel (Nikolai 17.09.2026) – dieselbe Regel wie Cockpit und Hallenplan */
function ulBereich(k, mid){
  if(k && k.betrieb === "ausser_betrieb") return { cls: "aus", text: "außer Betrieb" };
  const b = (typeof mgAnlagenBand === "function") ? mgAnlagenBand(mid, AKTIV) : null;
  if(b === "gefahr") return { cls: "gefahr", text: "offene Mängel im Gefahrbereich" };
  if(b === "besorgnis") return { cls: "besorgnis", text: "offene Mängel im Besorgnisbereich" };
  if(b === "akzeptanz") return { cls: "akzeptanz", text: "offene Mängel im Akzeptanzbereich" };
  if(b === "keine") return { cls: "akzeptanz", text: "keine offenen Mängel" };
  return { cls: "ohne", text: "nicht bewertet" };
}
function ulOffeneMaengel(mid){
  if(typeof MAENGEL === "undefined") return [];
  const rang = { gefahr: 0, besorgnis: 1, akzeptanz: 2 };
  return MAENGEL.filter(m => m.maschinen_id === mid && m.kunde_slug === AKTIV && !m.ausgeblendet && m.status !== "erledigt")
    .sort((a, b) => (rang[a.bewertung_manuell || a.band] ?? 3) - (rang[b.bewertung_manuell || b.band] ?? 3));
}
function ulDatum(s){ const t = String(s || "").slice(0, 10).split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : (s || ""); }

async function renderUnterlagenListe(wrap, art){
  const sec = document.createElement("section"); sec.className = "sektion ul-liste-seite";
  wrap.appendChild(sec);
  let gruppen = [];
  if(typeof MG_GELADEN !== "undefined" && !MG_GELADEN && typeof ladeMaengel === "function"){ sec.innerHTML = `<div class="ck-fuss">wird geladen …</div>`; await ladeMaengel(); }
  const oeffnen = (url, text) => `<a class="btn sek ul-btn" href="${url}" target="_blank" rel="noopener">${esc(text)}</a>`;
  const zeile = (r, inhalt, akt, extra) => `<div class="ul-zeile${extra || ""}" data-typ="${esc(r.kategorie === "ba-sammel" ? ulTyp({ maschinentyp: r.maschinentyp }) : ulTyp(r))}" data-suche="${esc([r.maschine, r.titel, r.maschinentyp].filter(Boolean).join(" ").toLowerCase())}"${r.maschinen_id ? ` data-mid="${esc(r.maschinen_id)}"` : ""}>${inhalt}<div class="ul-z-akt">${akt}</div></div>`;
  const name = r => `<div class="ul-z-name"><b>${esc(r.maschine || r.titel || "")}</b>${ulTyp(r) ? `<span>${esc(ulTyp(r))}</span>` : ""}</div>`;

  if(art === "anlagen"){
    sec.innerHTML = `<div class="ck-fuss">wird geladen …</div>`;
    const [ki] = await Promise.all([ulKurzinfoLaden(), (typeof MG_GELADEN !== "undefined" && !MG_GELADEN && typeof ladeMaengel === "function") ? ladeMaengel() : null]);
    gruppen = [["", ulAnlagen().sort(ulSort).map(r => {
      const k = ki[r.maschinen_id], b = ulBereich(k, r.maschinen_id), n = ulOffeneMaengel(r.maschinen_id).length;
      return zeile(r, `<span data-band="${b.cls}" class="ul-ampel ul-${b.cls}" title="${esc(b.text)}"></span>${name(r)}`
        + `<div class="ul-z-info">${k && k.datum ? "Begehung " + esc(ulDatum(k.datum)) : ""}${n ? `<span class="ul-mg">${n} offene Mängel</span>` : ""}${(typeof dokVeraltetInfo === "function" && dokVeraltetInfo(r, MAENGEL)) ? `<span class="ul-veraltet" title="${esc(dokVeraltetText(dokVeraltetInfo(r, MAENGEL)))}">${VERALT_SYMBOL} Unterlagen nicht aktuell</span>` : ""}</div>`,
        `<span class="ul-pfeil" aria-hidden="true">›</span>`, " ul-klick");
    })]];
  } else if(art === "gbu"){
    gruppen = [["Maschinen & Anlagen", ulAnlagen().filter(r => ulHat(r, "bda")).sort(ulSort).map(r => zeile(r, name(r), machDoc(r, "bda", "Öffnen", "btn sek ul-btn")))],
               ["Tätigkeiten & allgemeine Themen", ulAllg().filter(r => ulHat(r, "bda")).sort(ulSort).map(r => zeile(r, name(r), machDoc(r, "bda", "Öffnen", "btn sek ul-btn")))]];
  } else if(art === "ba"){
    gruppen = [["Sammel-Betriebsanweisungen je Maschinentyp", ulSammel().map(r => zeile(r, `<div class="ul-z-name"><b>${esc(r.titel)}</b></div>`, oeffnen(viewerUrl(r.doc_typ, r.storage_path, r.titel), "Öffnen")))],
               ["Betriebsanweisungen je Maschine", ulAnlagen().filter(r => ulHat(r, "ba")).sort(ulSort).map(r => zeile(r, name(r), machDoc(r, "ba", "Öffnen", "btn sek ul-btn")))],
               ["Tätigkeiten & allgemeine Themen", ulAllg().filter(r => ulHat(r, "ba")).sort(ulSort).map(r => zeile(r, name(r), machDoc(r, "ba", "Öffnen", "btn sek ul-btn")))]];
  } else if(art === "qr"){
    gruppen = [["", ulAnlagen().sort(ulSort).map(r => zeile(r, name(r),
      `<a class="btn sek ul-btn" href="qr.html?k=${encodeURIComponent(r.kunde_slug || "")}&mid=${encodeURIComponent(r.maschinen_id)}" target="_blank" rel="noopener">QR-Code drucken</a>`))]];
  }
  gruppen = gruppen.filter(g => g[1].length);
  const typen = [...new Set(ulAnlagen().map(ulTyp).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
  sec.innerHTML = `<div class="mg-filter ul-filter"><input type="search" class="uw-suche" id="ulSuche" placeholder="Suchen (Maschine, Typ …)" autocomplete="off">
      ${typen.length > 1 ? `<select class="uw-fassung" id="ulTyp" aria-label="Maschinentyp"><option value="">Alle Maschinentypen</option>${typen.map(x => `<option>${esc(x)}</option>`).join("")}</select>` : ""}
      <span class="uw-leise" id="ulZahl"></span></div>`
    + (gruppen.length ? gruppen.map(g => `<div class="ul-gruppe">${g[0] ? `<h2 class="ul-bereich">${esc(g[0])}</h2>` : ""}<div class="ul-zeilen">${g[1].join("")}</div></div>`).join("")
      : `<div class="ck-fuss">Noch keine Unterlagen hinterlegt.</div>`);
  let bandFilter = "";
  const zaehlen = () => {
    const q = (sec.querySelector("#ulSuche").value || "").toLowerCase().trim(); let n = 0;
    const typ = (sec.querySelector("#ulTyp") || {}).value || "";
    sec.querySelectorAll(".ul-gruppe").forEach(g => { let sichtbarG = 0;
      g.querySelectorAll(".ul-zeile").forEach(z => { const ok = (!q || z.dataset.suche.includes(q)) && (!typ || z.dataset.typ === typ) && (!bandFilter || z.dataset.band === bandFilter); z.hidden = !ok; if(ok){ sichtbarG++; n++; } });
      g.hidden = !sichtbarG; });
    sec.querySelector("#ulZahl").textContent = n + (n === 1 ? " Eintrag" : " Einträge");
  };
  if(art === "anlagen" && typeof HASH_Q !== "undefined" && HASH_Q && HASH_Q.get("status")){ bandFilter = HASH_Q.get("status"); HASH_Q = null; }
  if(bandFilter){
    sec.querySelectorAll(".ul-zeile").forEach(z => { const a = z.querySelector("[data-band]"); z.dataset.band = a ? a.dataset.band : ""; });
    const hinweis = document.createElement("div"); hinweis.className = "uw-meld";
    hinweis.innerHTML = `Gefiltert: Anlagen mit ${esc({ gefahr: "offenen Mängeln im Gefahrbereich", besorgnis: "offenen Mängeln im Besorgnisbereich", akzeptanz: "höchstens Mängeln im Akzeptanzbereich" }[bandFilter] || bandFilter)} <button type="button" class="btn-klein">Filter aufheben</button>`;
    hinweis.querySelector("button").addEventListener("click", () => { bandFilter = ""; hinweis.remove(); zaehlen(); });
    sec.insertBefore(hinweis, sec.firstChild);
  }
  sec.querySelector("#ulSuche").addEventListener("input", zaehlen);
  { const ts = sec.querySelector("#ulTyp"); if(ts) ts.addEventListener("change", zaehlen); }
  zaehlen();
  if(art === "anlagen") sec.querySelectorAll(".ul-klick").forEach(z => z.addEventListener("click", () => ulKurzinfoDialog(z.dataset.mid)));
}

/* Pop-up je Anlage: Kurzinfo wie im Hallenplan, offene Mängel (live), Dokumente */
async function ulKurzinfoDialog(mid){
  const r = ulAnlagen().find(x => x.maschinen_id === mid); if(!r) return;
  const ki = await ulKurzinfoLaden(); const k = ki[mid] || {};
  if(typeof MG_GELADEN !== "undefined" && !MG_GELADEN && typeof ladeMaengel === "function") await ladeMaengel();
  const b = ulBereich(ki[mid], mid);
  const offen = ulOffeneMaengel(mid);
  let dlg = document.getElementById("ulDlg");
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = "ulDlg"; dlg.className = "pw-dlg ul-dlg"; document.body.appendChild(dlg);
    dlg.addEventListener("click", ev => { if(ev.target === dlg) dlg.close(); }); }   // Klick neben das Fenster schliesst
  const feld = (l, v) => (v != null && v !== "") ? `<dt>${l}</dt><dd>${esc(v)}</dd>` : "";
  const mgText = m => (typeof mgFeld === "function" ? mgFeld(m, "label") : m.label) || "";
  const docs = [machDoc(r, "bda", "Gefährdungsbeurteilung", "btn sek ul-btn"), machDoc(r, "ba", "Betriebsanweisung", "btn sek ul-btn"),
                machDoc(r, "maengelliste", "Mängelliste", "btn sek ul-btn"), machDoc(r, "protokoll", "Begehungsprotokoll", "btn sek ul-btn"),
                `<a class="btn sek ul-btn" href="qr.html?k=${encodeURIComponent(r.kunde_slug || "")}&mid=${encodeURIComponent(mid)}" target="_blank" rel="noopener">QR-Code</a>`].filter(Boolean).join("");
  dlg.innerHTML = `<div class="ul-dlg-inhalt">
      <div class="ul-dlg-kopf"><div><h3>${esc(r.maschine || "")}</h3><div class="uw-leise">${esc(ulTyp(r))}</div></div>
        <button type="button" class="dok-zu ul-dlg-zu" aria-label="Schließen">✕</button></div>
      <div class="ul-risiko ul-${b.cls}">${esc(b.text)}</div>
      ${k.betrieb === "ausser_betrieb" ? `<div class="ul-hinweis">Außer Betrieb${k.betrieb_hinweis ? " – " + esc(k.betrieb_hinweis) : ""}. Die Bewertung gilt wieder, sobald die Anlage in Betrieb geht.</div>` : ""}
      ${k.roboter ? `<div class="ul-hinweis">Mit Linearroboter / Entnahmegerät</div>` : ""}
      <dl class="ul-dl">${feld("Hersteller", k.hersteller)}${feld("Typ", k.typ)}${feld("Baujahr", k.baujahr)}${feld("Serien-Nr.", k.seriennr)}
        ${feld("Bereich", k.bereich)}${feld("CE", k.ce)}${feld("Gefährdungen", k.gefaehrdungen)}
        ${feld("Höchstes Risiko laut GBU (vor Maßnahmen)", k.ausgang)}${feld("Restrisiko laut GBU (nach Maßnahmen)", k.rest)}${feld("Begehung", k.datum ? ulDatum(k.datum) : "")}</dl>
      <h4 class="ul-h4">Offene Mängel <span class="uw-leise">${offen.length}</span></h4>
      ${offen.length ? `<ul class="ul-mgliste">${offen.map(m => `<li class="mg-${esc(m.bewertung_manuell || m.band || "ohne")}"><span class="mg-ampel"></span><span>${esc(mgText(m))}</span></li>`).join("")}</ul>
        <button type="button" class="btn-klein ul-alle-mg">Alle Mängel dieser Maschine</button>`
        : `<div class="uw-leise">Keine offenen Mängel.</div>`}
      <h4 class="ul-h4">Dokumente</h4>
      <div class="ul-docs">${docs}</div>
    </div>`;
  dlg.querySelector(".ul-dlg-zu").addEventListener("click", () => dlg.close());
  dlg.querySelectorAll('a[target="_blank"]').forEach(a => a.addEventListener("click", () => dlg.close()));
  const alle = dlg.querySelector(".ul-alle-mg");
  if(alle) alle.addEventListener("click", () => { dlg.close(); if(typeof MG_FILTER !== "undefined"){ MG_FILTER.maschine = r.maschine || ""; MG_FILTER.status = "offen"; MG_FILTER.ampel = ""; } portalGehe("maengel"); });
  if(!dlg.open) dlg.showModal();
}

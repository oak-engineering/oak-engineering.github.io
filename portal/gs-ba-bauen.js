/* gs-ba-bauen.js – rote Gefahrstoff-Betriebsanweisung (TRGS 555) im Browser erzeugen, ohne OAK und ohne KI
   (Plan intern/portal-eigenstaendig.md, Schritt 2; Nikolai 14.10.2026).
   Quellen: Stoff (portal_gefahrstoff: H-Sätze, Signalwort, SDB-Stand), freigegebene EMKG-Beurteilungen
   (portal_gefahrstoff_gbu.ergebnis → Schutzleitfäden je Modul) und der geprüfte Textkatalog gs-bausteine.json
   (DE/EN/TR). Ergebnis ist ein doc-data-Objekt für shells/ba.html (meta.art = "gefahrstoff").
   Eigener Scope (IIFE) – die Portal-Skripte teilen sich sonst einen globalen Namensraum (tools/portal_check.py).
   Nach außen: window.GSBA = { daten(p), doc(stoff, gbus, katalog, opt), katalog() }  */
(function(){
  "use strict";
  /* GHS-Piktogramme aus H-Sätzen – gleiche Regeln wie gsPiktogramme() in gefahrstoffe.js (CLP Art. 26) */
  const GHS = {
    GHS01: ["H200", "H201", "H202", "H203", "H204", "H240", "H241"],
    GHS02: ["H220", "H221", "H222", "H223", "H224", "H225", "H226", "H228", "H241", "H242", "H250", "H251", "H252", "H260", "H261"],
    GHS03: ["H270", "H271", "H272"], GHS04: ["H280", "H281"], GHS05: ["H290", "H314", "H318"],
    GHS06: ["H300", "H301", "H310", "H311", "H330", "H331"],
    GHS07: ["H302", "H312", "H315", "H317", "H319", "H332", "H335", "H336", "H420"],
    GHS08: ["H304", "H334", "H340", "H341", "H350", "H351", "H360", "H361", "H370", "H371", "H372", "H373"],
    GHS09: ["H400", "H410", "H411"] };
  function ghs(hs){
    const h = new Set(hs.map(x => x.slice(0, 4)));
    const p = Object.keys(GHS).filter(k => k !== "GHS07" && GHS[k].some(x => h.has(x)));
    let g07 = GHS.GHS07.filter(x => h.has(x));
    if(p.includes("GHS06")) g07 = [];
    if(p.includes("GHS05")) g07 = g07.filter(x => x !== "H315" && x !== "H319");
    if(h.has("H334")) g07 = g07.filter(x => !["H315", "H317", "H319"].includes(x));
    if(g07.length) p.push("GHS07");
    return p.sort();
  }
  const SPR = ["de", "en", "tr"];
  const TXT = {
    grundlage: { de: "Gefährdungsbeurteilung nach EMKG", en: "risk assessment per EMKG", tr: "EMKG'ye göre risk değerlendirmesi" },
    gilt: { de: (k, b, t) => `Diese Betriebsanweisung gilt für ${k}${b ? ", Arbeitsbereich " + b : ""}${t ? ", Tätigkeit: " + t : ""}.`,
            en: (k, b, t) => `This operating instruction applies to ${k}${b ? ", work area " + b : ""}${t ? ", activity: " + t : ""}.`,
            tr: (k, b, t) => `Bu iş talimatı ${k} için geçerlidir${b ? ", çalışma alanı " + b : ""}${t ? ", faaliyet: " + t : ""}.` },
    gruppe: { de: "Gruppenbetriebsanweisung: gilt für die genannten Produkte mit ähnlichen Gefährdungen und vergleichbaren Schutzmaßnahmen (TRGS 555 Nr. 3.1 Abs. 13).",
              en: "Group operating instruction for the listed products with similar hazards and comparable protective measures.",
              tr: "Grup iş talimatı: benzer tehlikeleri ve karşılaştırılabilir koruyucu önlemleri olan listelenen ürünler için geçerlidir." },
    ohneGbu: { de: "Entwurf: Für diesen Stoff ist noch keine Gefährdungsbeurteilung nach EMKG freigegeben – Schutzmaßnahmen nur allgemein.",
               en: "Draft: no approved EMKG risk assessment yet – protective measures are general only.",
               tr: "Taslak: Bu madde için henüz onaylanmış bir EMKG risk değerlendirmesi yok – koruyucu önlemler yalnızca geneldir." } };

  let KAT = null;
  async function katalog(){
    if(!KAT) KAT = await fetch("gs-bausteine.json", { cache: "no-cache" }).then(r => { if(!r.ok) throw new Error("Textkatalog fehlt"); return r.json(); });
    return KAT;
  }
  function norm(hs){ return [...new Set((hs || []).map(x => { const c = String(x).replace(/\s+/g, ""); return /^euh/i.test(c) ? c.toUpperCase() : "H" + c.slice(1); }))]; }
  function trifft(hs, wenn){ return wenn === "immer" || (Array.isArray(wenn) && wenn.some(c => hs.includes(c))); }
  /* „ausser“: Regel entfällt, wenn der Stoff einen dieser Codes hat (z. B. Haut-Grundregel nicht bei H281 Kälteverbrennung) */
  function frei(hs, r){ return !(Array.isArray(r.ausser) && r.ausser.some(c => hs.includes(c))); }
  /* Regel-Listen: alle passenden Regeln; „sonst“-Regeln nur, wenn keine gezielte (nicht „immer“) Regel greift */
  function regeln(liste, hs){
    const r = (liste || []).filter(x => frei(hs, x));
    const gezielt = r.filter(x => !x.sonst && Array.isArray(x.wenn) && trifft(hs, x.wenn));
    const immer = r.filter(x => !x.sonst && x.wenn === "immer");
    const sonst = gezielt.length ? [] : r.filter(x => x.sonst && trifft(hs, x.wenn || "immer"));
    return gezielt.concat(sonst, immer).map(x => ({ de: x.de, en: x.en || x.de, tr: x.tr || x.de }));
  }
  function datumDe(s){ const t = String(s || "").slice(0, 10).split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : ""; }
  function haelften(a){ const h = Math.ceil(a.length / 2); return { links: a.slice(0, h), rechts: a.slice(h) }; }

  /* stoff = Zeile portal_gefahrstoff, gbus = Zeilen portal_gefahrstoff_gbu (freigegebene bevorzugt) */
  function doc(stoff, gbus, kat, opt){
    opt = opt || {};
    /* Reihenfolge wie auf dem Etikett: H-Sätze aufsteigend, danach EUH-Sätze */
    const hs = norm(stoff.h_saetze).sort((a, b) => (a.startsWith("EUH") - b.startsWith("EUH")) || a.localeCompare(b, "de", { numeric: true })),
      frei = (gbus || []).filter(x => x.status === "freigegeben");
    const basis = frei.length ? frei : (gbus || []).filter(x => x.status === "entwurf");
    /* Schutzleitfäden aller Module aller Tätigkeiten, ohne Doppelungen, Reihenfolge wie im Ergebnis */
    const slf = [];
    basis.forEach(x => { const m = (x.ergebnis && x.ergebnis.module) || {};
      Object.keys(m).forEach(k => (m[k] && m[k].schutzleitfaeden || []).forEach(s => { if(s && s.nr && !slf.includes(String(s.nr))) slf.push(String(s.nr)); })); });
    /* noch keine Beurteilung: Grundregeln + PSA nach Einstufung (Haut → Handschuhe, Augen → Schutzbrille) */
    if(!slf.length){
      ["100", "110", "120"].forEach(n => slf.push(n));
      if(hs.some(h => /^H31[0-7]$|^EUH066$|^H314$/.test(h))) slf.push("2110");
      if(hs.some(h => ["H314", "H318", "H319"].includes(h))) slf.push("2200");
    }
    /* Eine BA muss auf eine Seite passen (Nikolai): je Abschnitt höchstens MAX Sätze. Reihenfolge: tätigkeitsbezogene
       Leitfäden (24xx, 3xx) vor Stufe 2 (2xxx) vor Grundregeln (1xx, La-, pc-); erst der wichtigste Satz jedes Leitfadens,
       dann die zweiten usw. */
    const MAX = { technisch: 3, organisatorisch: 4, persoenlich: 3 };
    const rang = n => /^24\d\d$|^3\d\d$/.test(n) ? 0 : /^2\d{3}$/.test(n) ? 1 : 2;
    const sortiert = slf.slice().sort((a, b) => rang(a) - rang(b));
    const schutz = { technisch: [], organisatorisch: [], persoenlich: [] }, psa = [];
    sortiert.forEach(n => { const e = kat.slf && kat.slf[n]; if(e) (e.pikto || []).forEach(p => { if(!psa.includes(p)) psa.push(p); }); });
    for(let i = 0; i < 3; i++) sortiert.forEach(n => { const e = kat.slf && kat.slf[n], s = e && (e.saetze || [])[i]; if(!s) return;
      const k = schutz[e.kat] ? e.kat : "organisatorisch", z = schutz[k];
      if(z.length < MAX[k] && !z.some(v => v.de === s.de)) z.push({ de: s.de, en: s.en || s.de, tr: s.tr || s.de }); });   // Leitfaden-Nummern stehen in der gedruckten GBU, nicht in der BA (eine Seite)
    /* H-/EUH-Sätze im amtlichen Wortlaut (Nikolai 14.10.2026: „H-Sätze bleiben im O-Ton“), Code vorangestellt */
    const esc0 = v => String(v || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const gef = SPR.reduce((o, l) => { o[l] = hs.filter(h => kat.h && kat.h[h]).map(h => "<b>" + esc0(h) + "</b> " + esc0(kat.h[h][l] || kat.h[h].de)); return o; }, {});
    const bereiche = [...new Set(basis.map(x => x.arbeitsbereich).filter(Boolean))].join(", ") || (stoff.bereiche || []).join(", ");
    const taet = [...new Set(basis.map(x => x.taetigkeit).filter(Boolean))].join(", ");
    const stand = frei.map(x => String(x.freigegeben_am || "").slice(0, 10)).filter(Boolean).sort().pop() || "";
    /* Piktogramme je Abschnitt nach kat.pikto; pikto._wenn = H-Codes, bei denen ein Schlüssel gilt (ohne Eintrag: immer) */
    const pw = (kat.pikto && kat.pikto._wenn) || {};
    const pk = (...keys) => [...new Set(keys.flatMap(k => (!pw[k] || trifft(hs, pw[k])) ? ((kat.pikto && kat.pikto[k]) || []) : []))];
    const t = {};
    /* die Vorlage setzt Texte als HTML ein – Eingaben aus dem Portal (Name, Bereich, Tätigkeit) daher escapen */
    const e = v => String(v || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    SPR.forEach(l => { t[l] = { gefahren: gef[l], scope_text: TXT.gilt[l](e(opt.kunde || "den Betrieb"), e(bereiche), e(taet)) + (frei.length ? "" : " " + TXT.ohneGbu[l]),
      stoff_hinweis: opt.produkte && opt.produkte.length > 1 ? TXT.gruppe[l] : "" }; });
    return {
      meta: { art: "gefahrstoff", kunde: opt.kunde || "", titel: stoff.bezeichnung, maschinenId: "GS-" + String(stoff.id).slice(0, 8),
        slug: "gs-" + String(stoff.id).slice(0, 8), baNr: "BA-GS-" + String(stoff.id).slice(0, 4).toUpperCase(),
        datum: datumDe(stand) || datumDe(new Date().toISOString()), arbeitsbereich: bereiche, taetigkeit: taet, notruf: "112",
        oakLogoB64: opt.oakLogo || undefined, kundenLogoB64: opt.kundenLogo || undefined },
      stoff: { bezeichnung: stoff.bezeichnung, signalwort: stoff.signalwort || "", ghs: ghs(hs),
        produkte: opt.produkte || [{ name: stoff.bezeichnung, hersteller: stoff.hersteller || "", sdb_stand: datumDe(stoff.sdb_ausgabe) }] },
      ba: {
        piktogramme: { gefahren: haelften(pk("gefahren_entzuendbar", "gefahren_brandfoerdernd", "gefahren_aetzend", "gefahren_giftig", "gefahren_gasflaschen")),
          schutz: haelften(psa.concat(pk("hygiene").filter(c => !psa.includes(c)))), gefahrfall: haelften(pk("gefahrfall_entzuendbar")),
          ersthilfe: { links: pk("ersthilfe", "ersthilfe_arzt"), rechts: pk("ersthilfe_augen", "ersthilfe_notdusche") } },
        t,
        gs: { grundlage: TXT.grundlage, stand: datumDe(stand), schutz,
          gefahrfall: { brand: regeln(kat.gefahrfall && kat.gefahrfall.brand, hs), freisetzung: regeln(kat.gefahrfall && kat.gefahrfall.freisetzung, hs),
            umwelt: regeln(kat.gefahrfall && kat.gefahrfall.umwelt, hs) },
          ersthilfe: ["einatmen", "haut", "augen", "verschlucken", "arzt"].reduce((o, k) => { o[k] = regeln(kat.ersthilfe && kat.ersthilfe[k], hs); return o; }, {}),
          entsorgung: regeln(kat.entsorgung, hs) } } };
  }

  async function alsDataUrl(url){
    try{ const b = await fetch(url).then(r => r.ok ? r.blob() : null); if(!b) return undefined;
      return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => res(undefined); f.readAsDataURL(b); }); }
    catch(e){ return undefined; }
  }
  /* Viewer: p = "gs:<slug>:<stoff-id>" → doc-data als JSON-Text */
  /* Gruppen-BA (TRGS 555 Nr. 3.1 Abs. 13): alle Stoffe mit gleicher ba_gruppe; H-Sätze und Beurteilungen vereinigt,
     Signalwort das strengere, jedes Produkt mit eigenem SDB-Stand. p = "gsg:<slug>:<gruppe>" */
  function docGruppe(name, stoffe, gbus, kat, opt){
    const hs = [...new Set(stoffe.flatMap(x => norm(x.h_saetze)))].sort();
    const sw = stoffe.some(x => x.signalwort === "Gefahr") ? "Gefahr" : (stoffe.some(x => x.signalwort === "Achtung") ? "Achtung" : "");
    const virt = { id: "g" + Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0"),
      bezeichnung: name, signalwort: sw, h_saetze: hs, bereiche: [...new Set(stoffe.flatMap(x => x.bereiche || []))] };
    const produkte = stoffe.map(x => ({ name: x.bezeichnung, hersteller: x.hersteller || "", sdb_stand: datumDe(x.sdb_ausgabe) }));
    return doc(virt, gbus, kat, Object.assign({}, opt, { produkte }));
  }
  async function daten(p){
    if(/^gsg:/.test(String(p))) return datenGruppe(p);
    const [, slug, id] = String(p).split(":");
    if(!slug || !/^[0-9a-f-]{36}$/i.test(id || "")) throw new Error("Ungültiger Gefahrstoff-Link");
    const k = "&kunde_slug=eq." + encodeURIComponent(slug);
    const [st, gbus, kunde, kat] = await Promise.all([
      apiGet("/rest/v1/portal_gefahrstoff?select=*&id=eq." + id + k, false),
      apiGet("/rest/v1/portal_gefahrstoff_gbu?select=*&gefahrstoff_id=eq." + id + k + "&status=neq.ueberholt", false),
      apiGet("/rest/v1/portal_kunde?select=name&slug=eq." + encodeURIComponent(slug), false).catch(() => []),
      katalog()]);
    if(!st || !st[0]) throw new Error("Gefahrstoff nicht gefunden");
    const m = window.OAK_MARKE && OAK_MARKE.aktuell;
    const [oakLogo, kundenLogo] = await Promise.all([alsDataUrl("../assets/oak-logo.png"), m && m.logo ? alsDataUrl(m.logo) : Promise.resolve(undefined)]);
    return JSON.stringify(doc(st[0], gbus || [], kat, { kunde: (kunde && kunde[0] && kunde[0].name) || (m && m.name) || slug, oakLogo, kundenLogo }));
  }
  async function datenGruppe(p){
    const t = String(p), i1 = t.indexOf(":"), i2 = t.indexOf(":", i1 + 1);
    const slug = t.slice(i1 + 1, i2), name = t.slice(i2 + 1);
    if(!slug || !name) throw new Error("Ungültiger Gruppen-Link");
    const k = "&kunde_slug=eq." + encodeURIComponent(slug);
    const stoffe = await apiGet("/rest/v1/portal_gefahrstoff?select=*&ba_gruppe=eq." + encodeURIComponent(name) + k + "&verwendung_status=neq.inaktiv&order=bezeichnung", false) || [];
    if(!stoffe.length) throw new Error("Keine Stoffe in dieser Gruppe");
    const ids = stoffe.map(x => x.id).join(",");
    const [gbus, kunde, kat] = await Promise.all([
      apiGet("/rest/v1/portal_gefahrstoff_gbu?select=*&gefahrstoff_id=in.(" + ids + ")" + k + "&status=neq.ueberholt", false),
      apiGet("/rest/v1/portal_kunde?select=name&slug=eq." + encodeURIComponent(slug), false).catch(() => []), katalog()]);
    const m = window.OAK_MARKE && OAK_MARKE.aktuell;
    const [oakLogo, kundenLogo] = await Promise.all([alsDataUrl("../assets/oak-logo.png"), m && m.logo ? alsDataUrl(m.logo) : Promise.resolve(undefined)]);
    return JSON.stringify(docGruppe(name, stoffe, gbus || [], kat, { kunde: (kunde && kunde[0] && kunde[0].name) || (m && m.name) || slug, oakLogo, kundenLogo }));
  }
  window.GSBA = { daten, doc, docGruppe, katalog, ghs };
})();

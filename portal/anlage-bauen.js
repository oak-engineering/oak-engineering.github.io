/* Anlagen-Dokumente aus der Cockpit-Datenbank (Plan intern/plan-eine-welt.md, Schritt 3).
   Baut aus as_arbeitssystem (dok), as_gefaehrdung, as_ba dieselbe doc-data, die bisher als JSON im Storage lag –
   die Shells (shells/bda.html, ba.html, maengelliste.html, protokoll.html) bleiben unverändert Ansicht und Druck.
   Aufruf über den Viewer: viewer.html?typ=bda&p=anl:<slug>:<KEY oder Maschinen-ID>&mid=<Maschinen-ID>
   Fotos liegen im Storage (<slug>/bda-fotos/…) und werden für die Anzeige kurzzeitig signiert. */
"use strict";
(function(){
  const deDatum = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "." + m[2] + "." + m[1] : (s || ""); };

  async function alsDataUri(url){
    try{ const r = await fetch(url, { cache: "force-cache" }); if(!r.ok) return "";
      const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(""); fr.readAsDataURL(b); });
    }catch(e){ return ""; }
  }
  async function signieren(pfade){
    const liste = [...new Set(pfade.filter(Boolean))]; if(!liste.length) return {};
    const t = await token();
    const r = await fetch(CFG.url + "/storage/v1/object/sign/" + CFG.bucket, { method: "POST",
      headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600, paths: liste }) });
    const j = r.ok ? await r.json() : [], m = {};
    (j || []).forEach(x => { if(x && x.signedURL && x.path) m[x.path] = CFG.url + "/storage/v1" + x.signedURL; });
    return m;
  }
  const foto = (f, url) => f && f.pfad ? Object.assign({}, f, { src: url[f.pfad] || "", data: undefined, pfad: undefined }) : f;

  async function daten(p){
    const [, slug, id] = String(p).split(":");
    if(!slug || !id) throw new Error("Ungültiger Anlagen-Verweis");
    const k = "&kunde_slug=eq." + encodeURIComponent(slug), q = encodeURIComponent;
    let sys = (await apiGet("/rest/v1/as_arbeitssystem?select=*&quelle_id=eq." + q(id) + k, false) || [])[0];
    if(!sys) sys = (await apiGet("/rest/v1/as_arbeitssystem?select=*&anlagen=cs." + q(JSON.stringify([id])) + "&order=art.asc,sort.asc" + k, false) || [])[0];   // „anlage“ vor „arbeitssystem“
    if(!sys) throw new Error("Für diese Anlage ist keine Beurteilung hinterlegt");
    const dok = sys.dok || {}, meta0 = dok.meta || {}, mid = meta0.maschinenId || (sys.anlagen || [])[0] || id;
    const [gef, bas, kunde, qr, pa] = await Promise.all([
      apiGet("/rest/v1/as_gefaehrdung?select=*&art=eq.gefaehrdung&arbeitssystem_id=eq." + sys.id + "&order=sort.asc", false),
      apiGet("/rest/v1/as_ba?select=*&arbeitssystem_id=eq." + sys.id + "&order=version.desc", false).catch(() => []),
      apiGet("/rest/v1/portal_kunde?select=name,marke&slug=eq." + q(slug), false).catch(() => []),
      apiGet("/rest/v1/portal_dokumente?select=qr_svg&kategorie=in.(anlagen,allg-gbu)&maschinen_id=eq." + q(mid) + k, false).catch(() => []),
      /* offener Prüfauftrag zu dieser Beurteilung = seit der letzten Änderung nicht neu freigegeben */
      apiGet("/rest/v1/portal_pruefauftrag?select=erstellt_am,anlaesse&objekt_typ=eq.bda_system&erledigt_am=is.null&objekt_id=eq." + sys.id + k, false).catch(() => [])]);
    /* Live-Stand der Maßnahmen (Plan B3): verknüpfte Mängel und Maßnahmen des Cockpits je Gefährdung */
    const gids = (gef || []).map(g => g.id);
    const [mgl, mas] = gids.length ? await Promise.all([
      apiGet("/rest/v1/portal_maengel?select=as_gefaehrdung_id,label,massnahme,stop,status,erledigt_am,wirksam_am,termin,verantwortlich,ausgeblendet&as_gefaehrdung_id=in.(" + gids.join(",") + ")" + k, false).catch(() => []),
      apiGet("/rest/v1/as_massnahme?select=gefaehrdung_id,text,stop,status,erledigt_am,wirksam_am,termin,verantwortlich&gefaehrdung_id=in.(" + gids.join(",") + ")" + k, false).catch(() => [])]) : [[], []];
    const prot = Object.assign({}, dok.protokoll || {});
    /* nur Fotos aus dem Begehungsordner DIESES Betriebs signieren (Pfade stehen in der DB – keine fremden Dateien freigeben) */
    const erlaubt = x => typeof x === "string" && x.startsWith(slug + "/bda-fotos/") && !x.includes("..");
    const url = await signieren((gef || []).flatMap(g => (g.fotos || []).map(f => f && f.pfad)).concat((prot.fotos || []).map(f => f && f.pfad)).filter(erlaubt));
    const marke = ((kunde || [])[0] || {}).marke || {};
    const [oakLogo, kundenLogo] = await Promise.all([alsDataUri("../assets/oak-logo.png"),
      marke.logo ? alsDataUri(/^https:/.test(marke.logo) ? marke.logo : marke.logo.replace(/^\/?/, "")) : Promise.resolve("")]);
    /* leer = nie Beispielinhalte der Vorlage (Schneidmühle) einsetzen – die Datenbank ist die einzige Quelle */
    const meta = Object.assign({}, meta0, { maschinenId: mid, leer: true });
    if(oakLogo) meta.oakLogoB64 = oakLogo;
    if(kundenLogo) meta.kundenLogoB64 = kundenLogo;
    if(!meta.kunde) meta.kunde = ((kunde || [])[0] || {}).name || "";
    if(qr && qr[0] && qr[0].qr_svg){ meta.qrSvg = qr[0].qr_svg; meta.qrUrl = "https://www.oak-engineering.de/portal/maschine.html?k=" + q(slug) + "&mid=" + q(mid); }
    if(Array.isArray(prot.fotos)) prot.fotos = prot.fotos.map(f => foto(f, url));
    /* Maßnahmenliste je Gefährdung: Schutzmaßnahmen der Beurteilung + verknüpfte Mängel + Cockpit-Maßnahmen.
       Gleicher Text = eine Zeile; der weiter fortgeschrittene Stand gewinnt (offen < umsetzung < erledigt, wirksam). */
    const norm = t => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
    const rang = m => (m.status === "erledigt" ? 2 : m.status === "umsetzung" ? 1 : 0) + (m.wirksam === "wirksam" ? 2 : 0);
    const ausLive = (x, text) => ({ k: x.stop || "T", text, status: x.status === "erledigt" || x.status === "wirksam" || x.erledigt_am ? "erledigt" : (x.status === "umsetzung" ? "umsetzung" : "offen"),
      wirksam: x.wirksam_am || x.status === "wirksam" ? "wirksam" : "offen", termin: x.termin || "", verantwortlich: x.verantwortlich || "",
      erledigtAm: deDatum(String(x.erledigt_am || "").slice(0, 10)), wirksamAm: deDatum(String(x.wirksam_am || "").slice(0, 10)) });
    function massnahmenVon(g){
      const liste = [], je = {};
      const dazu = m => { if(!m.text || m.text === "–") return; const n = norm(m.text);
        if(je[n]){ const a = je[n]; if(rang(m) > rang(a)) Object.assign(a, m, { k: a.k || m.k }); else { a.erledigtAm = a.erledigtAm || m.erledigtAm; a.wirksamAm = a.wirksamAm || m.wirksamAm; } return; }
        je[n] = m; liste.push(m); };
      (g.schutzmassnahmen || []).forEach(x => x && dazu({ k: x.stop || "T", text: x.text || "", status: x.status || "offen", wirksam: x.wirksam || "offen",
        termin: x.termin || "", verantwortlich: x.verantwortlich || "", erledigtAm: "", wirksamAm: "" }));
      (mgl || []).filter(x => x.as_gefaehrdung_id === g.id && !x.ausgeblendet).forEach(x => dazu(ausLive(x, x.massnahme || x.label || "")));
      (mas || []).filter(x => x.gefaehrdung_id === g.id).forEach(x => dazu(ausLive(x, x.text || "")));
      return liste;
    }
    /* Freigabe der Beurteilung durch die Geschäftsführung (as_arbeitssystem) */
    const fDat = v => deDatum(String(v || "").slice(0, 10));
    meta.bdaFreigabeAm = fDat(sys.freigabe_am); meta.bdaFreigabeVon = sys.freigabe_von || "";
    meta.bdaFreigabeText = sys.freigabe_am ? "freigegeben am " + fDat(sys.freigabe_am) + (sys.freigabe_von ? " von " + sys.freigabe_von : "")
      : (pa && pa.length) ? "seit der letzten Änderung (" + fDat(pa[0].erstellt_am) + ") nicht neu freigegeben" + (sys.vorgelegt_am ? " · vorgelegt am " + fDat(sys.vorgelegt_am) : "")
      : sys.vorgelegt_am ? "noch nicht freigegeben · zur Freigabe vorgelegt am " + fDat(sys.vorgelegt_am) : "noch nicht freigegeben";
    meta.bdaFreigabeStatus = sys.freigabe_am ? "frei" : (pa && pa.length) ? "geaendert" : "offen";
    const hazards = (gef || []).map(g => {
      const [kat, ...sub] = String(g.kurz || "").split(" – ");
      return Object.assign({}, g.extra || {}, {
        nr: g.nr || String((g.sort || 0) + 1), kat: kat || "", sub: sub.join(" – "), situation: g.situation || g.beschreibung || "",
        rq: g.rechtsquelle || "", wV: g.w_v, sV: g.s_v, wN: g.w_n, sN: g.s_n,
        massnahmen: massnahmenVon(g),
        verantwortlich: g.verantwortlich || "", termin: deDatum(g.termin), status: g.bearbeitung || "", bghm: g.bghm || "",
        wirkweise: g.wirkweise || "", schutzziel: g.schutzziel || "", exposition: g.exposition || "",
        fotos: (g.fotos || []).map(f => foto(f, url)).filter(f => f && (f.src || f.data)) });
    });
    const ba = (bas || []).find(b => b.status === "freigegeben") || (bas || [])[0];
    /* Freigabe der BA (Cockpit, nur GF) in die Unterschriftszeile der BA */
    if(ba && ba.status === "freigegeben"){ meta.freigabeVon = ba.freigabe_von || ""; meta.freigabeAm = String(ba.freigabe_am || "").slice(0, 10).split("-").reverse().join("."); }
    return JSON.stringify({ _typ: "OAK-doc-data", _quelle: "Cockpit-Datenbank", meta, hazards, rechtsquellen: dok.rechtsquellen || [],
      ba: ba ? ba.inhalt : {}, maengel: dok.maengel || [], protokoll: prot, stundensatz: dok.stundensatz });
  }
  window.ANLB = { daten };
})();

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
    const [gef, bas, kunde, qr] = await Promise.all([
      apiGet("/rest/v1/as_gefaehrdung?select=*&art=eq.gefaehrdung&arbeitssystem_id=eq." + sys.id + "&order=sort.asc", false),
      apiGet("/rest/v1/as_ba?select=*&arbeitssystem_id=eq." + sys.id + "&order=version.desc", false).catch(() => []),
      apiGet("/rest/v1/portal_kunde?select=name,marke&slug=eq." + q(slug), false).catch(() => []),
      apiGet("/rest/v1/portal_dokumente?select=qr_svg&kategorie=in.(anlagen,allg-gbu)&maschinen_id=eq." + q(mid) + k, false).catch(() => [])]);
    const prot = Object.assign({}, dok.protokoll || {});
    /* nur Fotos aus dem Begehungsordner DIESES Betriebs signieren (Pfade stehen in der DB – keine fremden Dateien freigeben) */
    const erlaubt = x => typeof x === "string" && x.startsWith(slug + "/bda-fotos/") && !x.includes("..");
    const url = await signieren((gef || []).flatMap(g => (g.fotos || []).map(f => f && f.pfad)).concat((prot.fotos || []).map(f => f && f.pfad)).filter(erlaubt));
    const marke = ((kunde || [])[0] || {}).marke || {};
    const [oakLogo, kundenLogo] = await Promise.all([alsDataUri("../assets/oak-logo.png"),
      marke.logo ? alsDataUri(/^https:/.test(marke.logo) ? marke.logo : marke.logo.replace(/^\/?/, "")) : Promise.resolve("")]);
    const meta = Object.assign({}, meta0, { maschinenId: mid });
    if(oakLogo) meta.oakLogoB64 = oakLogo;
    if(kundenLogo) meta.kundenLogoB64 = kundenLogo;
    if(qr && qr[0] && qr[0].qr_svg){ meta.qrSvg = qr[0].qr_svg; meta.qrUrl = "https://www.oak-engineering.de/portal/maschine.html?k=" + q(slug) + "&mid=" + q(mid); }
    if(Array.isArray(prot.fotos)) prot.fotos = prot.fotos.map(f => foto(f, url));
    const hazards = (gef || []).map(g => {
      const [kat, ...sub] = String(g.kurz || "").split(" – ");
      return Object.assign({}, g.extra || {}, {
        nr: g.nr || String((g.sort || 0) + 1), kat: kat || "", sub: sub.join(" – "), situation: g.situation || g.beschreibung || "",
        rq: g.rechtsquelle || "", wV: g.w_v, sV: g.s_v, wN: g.w_n, sN: g.s_n,
        top: (g.schutzmassnahmen || []).map(x => [x.stop || "", x.text || ""]),
        verantwortlich: g.verantwortlich || "", termin: deDatum(g.termin), status: g.bearbeitung || "", bghm: g.bghm || "",
        wirkweise: g.wirkweise || "", schutzziel: g.schutzziel || "", exposition: g.exposition || "",
        fotos: (g.fotos || []).map(f => foto(f, url)).filter(f => f && (f.src || f.data)) });
    });
    const ba = (bas || []).find(b => b.status === "freigegeben") || (bas || [])[0];
    return JSON.stringify({ _typ: "OAK-doc-data", _quelle: "Cockpit-Datenbank", meta, hazards, rechtsquellen: dok.rechtsquellen || [],
      ba: ba ? ba.inhalt : {}, maengel: dok.maengel || [], protokoll: prot, stundensatz: dok.stundensatz });
  }
  window.ANLB = { daten };
})();

/* ======================= Begehung → BdA/BA-Entwurf direkt nach der Aufnahme =======================
   „Maschine fertig“: Typ-Vorlage (as_maschinentyp, Inventar references/anlagenkataster/maschinen/) + Notiz und Fotos ergeben
   sofort den Entwurf. Mit KI: Rückfragen und Anpassung. Ohne KI: die unveränderte Vorlage. Rechtsquellen stammen immer aus der
   Vorlage. Fachkraft korrigiert, dann wird in as_arbeitssystem/as_gefaehrdung/as_ba gespeichert; die BA bleibt Entwurf. */
const AS_BG_FAKTOR = [[/psych/, "10 Psychische Belastung"], [/physische/, "9 Physische Belastung"], [/elektr/, "2 Elektrische Gefährdungen"], [/gefahrstoff/, "3 Gefahrstoffe"],
  [/brand|explosion/, "5 Brand- und Explosionsgefährdungen"], [/therm/, "6 Thermische Gefährdungen"], [/lärm|physikalische/, "7 Physikalische Einwirkungen (Lärm, Vibration, Strahlung)"],
  [/mechan|absturz|stolper|rutsch|druck/, "1 Mechanische Gefährdungen"]];
function asBgFaktor(kat){ const k = String(kat || "").toLowerCase(), t = AS_BG_FAKTOR.find(([m]) => m.test(k)); return t ? t[1] : "11 Sonstige"; }

async function asBgFertig(box, p){
  const typen = await apiGet("/rest/v1/as_maschinentyp?select=slug,titel,vorlage&aktiv=is.true&order=titel").catch(() => []) || [];
  const dok = asAnlagen().find(x => x.maschinen_id === p.maschinen_id), name = String((dok && dok.maschinentyp) || p.maschine).toLowerCase();
  const tipp = p.typ_slug || (typen.find(t => name.includes(t.titel.toLowerCase().split(" ")[0])) || {}).slug || "";
  const dl = asDialog({ titel: "Maschine fertig: " + p.maschine, inhalt: `<div class="form">${asAuswahl("Maschinentyp", "typ", tipp, [["", "Bitte wählen …"]].concat(typen.map(t => [t.slug, t.titel])), "voll")}</div>
      <p class="hinweis">Fehlt der Typ, gibt es noch keine Vorlage und deshalb keinen Entwurf.</p>${AS.admin ? `<label class="btn sek klein">Vorlage hochladen (JSON)<input type="file" id="bgVorlage" accept=".json" hidden></label>` : ""}`,
    knoepfe: [{ t: "Entwurf erstellen", fn: async d => { const w = asWerte(d), typ = typen.find(t => t.slug === w.typ);
      if(!typ){ asMeldung("Bitte einen Maschinentyp wählen"); return false; }
      asBgLaeuft(box, p, typ, ""); } }] });
  const up = dl.querySelector("#bgVorlage"); if(up) up.onchange = async () => { try{
      const v = JSON.parse(await up.files[0].text()); if(!Array.isArray(v.hazards) || !v.hazards.length) throw new Error("Datei enthält keine Gefährdungen");
      const titel = (v.meta && (v.meta.maschinenart || v.meta.typ)) || v._typ || up.files[0].name.replace(/\.json$/, "");
      const slug = String(titel).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await apiSend("POST", "/rest/v1/as_maschinentyp?on_conflict=slug", { slug, titel, vorlage: v, quelle: "Upload " + asHeute(), aktiv: true }, "resolution=merge-duplicates,return=minimal");
      asMeldung("Vorlage gespeichert"); asBgFertig(box, p); }catch(e){ asMeldung("Vorlage nicht lesbar: " + e.message); } };
}

async function asBgLaeuft(box, p, typ, antworten){
  const vorlage = typ.vorlage, roh = (vorlage.hazards || []).map(h => ({ nr: String(h.nr), gilt: true, situation: h.situation, wV: h.wV, sV: h.sV, wN: h.wN, sN: h.sN }));
  let e = { fragen: [], hazards: roh, zusatz: [] };
  if(AS_BG.ki && AS_BG.ki.aktiv){
    asDialog({ titel: "KI erstellt den Entwurf", inhalt: `<div class="leer">Das dauert meist unter einer Minute.</div>` });
    try{ const r = await asBgKiTyp(p, typ.slug, antworten);
      if(r.fragen && r.fragen.length && !antworten) return asBgFragen(box, p, typ, r.fragen);
      e = { fragen: [], hazards: roh.map(h => r.hazards.find(x => String(x.nr) === h.nr) || h), zusatz: r.zusatz || [] };
    }catch(x){ asMeldung(x.message + " Es gilt die unveränderte Vorlage."); }
  }
  asBgPruefen(box, p, typ, e);
}
function asBgKiTyp(p, slug, antworten){
  const fotos = asListe(p.fotos).filter(x => !x.startsWith("blob:")).slice(-3);
  return token().then(async t => { const r = await fetch(CFG.url + "/functions/v1/oak-ki", { method: "POST", headers: { Authorization: "Bearer " + t, apikey: CFG.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ kunde: AS.kunde, funktion: "entwurf", typ: slug, fotos, text: "Maschine: " + p.maschine + "\nNotiz: " + (p.notiz || "(keine)") + (antworten ? "\nAntworten der Fachkraft:\n" + antworten : "") }) });
    const j = await r.json().catch(() => ({})); if(!r.ok) throw new Error(j.fehler || "KI nicht erreichbar."); return j; });
}
function asBgFragen(box, p, typ, fragen){
  asDialog({ titel: "Rückfragen der KI", breit: true, inhalt: `<div class="form">${fragen.map((f, i) => asFeld(f, "f" + i, "", "textarea", "voll")).join("")}</div>`,
    knoepfe: [{ t: "Weiter", fn: async d => { const w = asWerte(d), a = fragen.map((f, i) => f + " → " + (w["f" + i] || "keine Angabe")).join("\n");
      p.notiz = (p.notiz || "") + "\n" + a; asBgNotiz(p, p.notiz); asBgLaeuft(box, p, typ, a); } }] });
}

/* Durchsprechen und korrigieren: eine Zeile je Gefährdung */
function asBgPruefen(box, p, typ, e){
  const hz = typ.vorlage.hazards || [], zahl = (f, w) => `<input type="number" min="0" max="9" data-f="${f}" value="${esc(w == null ? "" : w)}" aria-label="${f}">`;
  const zeile = (g, i, titel, rq) => `<div class="bg-gef" data-i="${i}"><label class="bg-gilt"><input type="checkbox" data-f="gilt"${g.gilt === false ? "" : " checked"}> <b title="${esc(titel)}">${esc(titel)}</b></label>
      <textarea data-f="situation" rows="2">${esc(g.situation || "")}</textarea><div class="bg-risiko">W ${zahl("wV", g.wV)} S ${zahl("sV", g.sV)} nach Maßnahme W ${zahl("wN", g.wN)} S ${zahl("sN", g.sN)}</div>
      ${rq ? `<small title="${esc(rq)}">${esc(rq)}</small>` : `<small>Rechtsquelle bitte prüfen</small>`}</div>`;
  const zeilen = e.hazards.map((g, i) => { const h = hz[i] || {}; return zeile(g, i, [h.kat, h.sub].filter(Boolean).join(" – "), h.rq); })
    .concat((e.zusatz || []).map((g, i) => zeile(g, "z" + i, "Neu: " + (g.kat || "Gefährdung"), "")));
  asDialog({ titel: "BdA-Entwurf: " + p.maschine, breit: true, inhalt: `<p class="hinweis">Entwurf aus der Vorlage „${esc(typ.titel)}“. Gemeinsam durchgehen und korrigieren.</p><div class="bg-gefliste">${zeilen.join("")}</div>`,
    knoepfe: [{ t: "Speichern", klasse: "sek", fn: d => asBgSpeichern(box, p, typ, e, d, false) }, { t: "Speichern und unterschreiben", fn: d => asBgSpeichern(box, p, typ, e, d, true) }] });
}
async function asBgSpeichern(box, p, typ, e, d, signieren){
  const hz = typ.vorlage.hazards || [], neu = [];
  d.querySelectorAll(".bg-gef").forEach(z => { const w = asWerte(z), i = z.dataset.i, zu = i[0] === "z", q = zu ? e.zusatz[+i.slice(1)] : hz[+i];
    if(!w.gilt) return;
    const kat = q.kat, top = zu ? "" : (q.top || []).filter(t => Array.isArray(t) && t[1] && !["–", "-"].includes(t[1])).map(t => t[0] + ": " + t[1]).join(" · ");
    neu.push({ kat, kurz: zu ? (q.kat || "Gefährdung") : [q.kat, q.sub].filter(Boolean).join(" – "), rq: zu ? "" : q.rq, text: [w.situation, top ? "Schutzmaßnahmen lt. BdA – " + top : "", !zu && q.rq ? "Rechtsquelle: " + q.rq : "Rechtsquelle: bitte prüfen"].filter(Boolean).join("\n"), w_v: w.wV, s_v: w.sV, w_n: w.wN, s_n: w.sN, situation: w.situation }); });
  if(!neu.length){ asMeldung("Keine Gefährdung ausgewählt"); return false; }
  const mid = p.maschinen_id && p.maschinen_id !== "ALLG-HALLE" ? p.maschinen_id : null;
  await asLaden();
  let s = p.arbeitssystem_id ? asNach("as_arbeitssystem", p.arbeitssystem_id) : mid ? asT("as_arbeitssystem").find(x => asListe(x.anlagen).includes(mid) && !x.stillgelegt_am) : null;
  if(!s){ const r = await apiSend("POST", "/rest/v1/as_arbeitssystem", { kunde_slug: AS.kunde, name: p.maschine + (mid ? " (" + mid + ")" : ""), beschreibung: typ.titel + " · Entwurf aus Begehung " + asDat(AS_BG.b.datum), anlagen: mid ? [mid] : [], art: "anlage" }, "return=representation"); s = r[0]; }
  const da = await apiGet("/rest/v1/as_gefaehrdung?select=id,kurz&arbeitssystem_id=eq." + s.id + "&kunde_slug=eq." + encodeURIComponent(AS.kunde)) || [];
  for(const [i, g] of neu.entries()){ const x = da.find(y => y.kurz === g.kurz), z = { beschreibung: g.text, situation: g.situation, rechtsquelle: g.rq || null, w_v: g.w_v, s_v: g.s_v, w_n: g.w_n, s_n: g.s_n };
    if(x) await apiSend("PATCH", "/rest/v1/as_gefaehrdung?id=eq." + x.id, z, "return=minimal");
    else await apiSend("POST", "/rest/v1/as_gefaehrdung", Object.assign({ kunde_slug: AS.kunde, arbeitssystem_id: s.id, art: "gefaehrdung", faktor: asBgFaktor(g.kat), kurz: g.kurz, sort: 100 + i }, z), "return=minimal"); }
  const ba = await apiGet("/rest/v1/as_ba?select=id&limit=1&arbeitssystem_id=eq." + s.id) || [];
  if(!ba.length && typ.vorlage.ba) await apiSend("POST", "/rest/v1/as_ba", { kunde_slug: AS.kunde, arbeitssystem_id: s.id, maschinen_id: mid, titel: "Betriebsanweisung " + p.maschine, inhalt: typ.vorlage.ba, status: "entwurf", geaendert_von: AS.ich }, "return=minimal");
  p.typ_slug = typ.slug; p.arbeitssystem_id = s.id; p.entwurf = neu;
  await apiSend("PATCH", "/rest/v1/as_begehung_punkt?id=eq." + p.id, { typ_slug: typ.slug, arbeitssystem_id: s.id, entwurf: neu }, "return=minimal");
  asMeldung("BdA und BA gespeichert, BA ist Entwurf"); asBgZeichnen(box);
  if(signieren) asBgSignieren(box, p);
}

/* Unterschrift am Gerät: bestätigt das Durchsprechen der BdA mit dem Vorgesetzten */
function asBgSignieren(box, p){
  const dl = asDialog({ titel: "Unterschrift: " + p.maschine, inhalt: `<div class="form">${asFeld("Name, Funktion", "name", "", "text", "voll")}</div><p class="hinweis">Beurteilung gemeinsam durchgesprochen und zur Kenntnis genommen.</p><canvas id="bgSig" class="bg-sig" width="640" height="200"></canvas>`,
    knoepfe: [{ t: "Löschen", klasse: "sek", fn: () => { const c = dl.querySelector("#bgSig"); c.getContext("2d").clearRect(0, 0, c.width, c.height); c.dataset.voll = ""; return false; } },
      { t: "Unterschreiben", fn: async d => { const w = asWerte(d), c = d.querySelector("#bgSig"); if(!w.name || !c.dataset.voll){ asMeldung("Bitte Name und Unterschrift"); return false; }
        const blob = await new Promise(ok => c.toBlob(ok, "image/png")), pfad = AS.kunde + "/begehung/" + AS_BG.b.id + "/" + p.id + "/unterschrift-" + Date.now() + ".png";
        const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST", headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": "image/png", "x-upsert": "true" }, body: blob });
        if(!r.ok) throw new Error("Unterschrift nicht gespeichert (" + r.status + ")");
        Object.assign(p, { signiert_von: w.name, signiert_am: new Date().toISOString(), signatur_pfad: pfad });
        await apiSend("PATCH", "/rest/v1/as_begehung_punkt?id=eq." + p.id, { signiert_von: p.signiert_von, signiert_am: p.signiert_am, signatur_pfad: pfad }, "return=minimal");
        asMeldung("Unterschrift gespeichert"); asBgZeichnen(box); } }] });
  const c = dl.querySelector("#bgSig"), g = c.getContext("2d"); g.lineWidth = 2.5; g.lineCap = "round"; let an = false;
  const pos = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * c.width / b.width, (e.clientY - b.top) * c.height / b.height]; };
  c.onpointerdown = e => { an = true; c.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(...pos(e)); };
  c.onpointermove = e => { if(an){ g.lineTo(...pos(e)); g.stroke(); c.dataset.voll = "1"; } };
  c.onpointerup = () => { an = false; };
}

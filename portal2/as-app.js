/* OAK Arbeitsschutz-App – App-Ebene: Kundenmarke, Startseite mit Schnellzugriffen (Schichtführer-Ansicht),
   Name beim gemeinsamen Zugang, Installation als App, Erscheinungsbild (Marke selbst pflegen).
   Gleiche Daten wie das Kundenportal: Marke aus portal_kunde.marke, Schnellzugriffe in
   portal_nutzer_einstellung.daten.schnellzugriffe (dieselben Kennungen – eine Auswahl gilt in beiden Apps),
   Name im Gerät unter „oak_mein_name“. */
"use strict";

/* ---------------- Kundenmarke ----------------
   Fünf Farben wie im Kundenportal (portal_kunde.marke: farbe, farbe_tief, farbe_hell, akzent, hintergrund) → --blau,
   --blau-tief, --blau-hell, --blau2, --bg. --gruen bleibt Ampelfarbe. Gleicher Gerätespeicher wie V1 (oak_portal_marke),
   den as-marke.js im <head> vor dem ersten Zeichnen liest – kein Aufblitzen. Logo: marken/… (statisch im Portal) oder
   https-Adresse, auch die signierte Adresse eines selbst hochgeladenen Logos im eigenen Ordner. */
const AS_MARKE_KEY = "oak_portal_marke";
const AS_MARKE_FARBEN = [["farbe", "--blau"], ["farbe_tief", "--blau-tief"], ["farbe_hell", "--blau-hell"], ["akzent", "--blau2"], ["hintergrund", "--bg"]];
function asMarkePruefen(m){
  const farbe = v => typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null;
  const logo = v => typeof v === "string" && /^(marken\/[\w.-]+|https:\/\/[\w.\/%-]+(\?token=[\w.-]+)?)$/.test(v) ? v : null;
  m = m || {};
  return { farbe: farbe(m.farbe), tief: farbe(m.farbe_tief), hell: farbe(m.farbe_hell), akzent: farbe(m.akzent), hintergrund: farbe(m.hintergrund),
    logo: logo(m.logo), druckfuss_oak: m.druckfuss_oak !== false };
}
function asMarkeLogoUrl(logo){ return logo ? (/^https:/.test(logo) ? logo : "../portal/" + logo) : ""; }
function asMarkeAnwenden(){
  const roh = (AS.kundeV1 && AS.kundeV1.marke) || {}, st = document.documentElement.style, m = asMarkePruefen(roh);
  const wert = { farbe: m.farbe, farbe_tief: m.tief, farbe_hell: m.hell, akzent: m.akzent, hintergrund: m.hintergrund };
  AS_MARKE_FARBEN.forEach(([feld, v]) => { if(wert[feld]) st.setProperty(v, wert[feld]); else st.removeProperty(v); });
  let meta = document.querySelector('meta[name="theme-color"]');
  if(!meta){ meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = m.farbe || "#2D6A4F";
  /* Gerätespeicher wie V1 (marke.js): beim Kundenwechsel (OAK) wechselt er mit, ohne Marke wird er geleert */
  try{
    if(m.farbe) localStorage.setItem(AS_MARKE_KEY, JSON.stringify(Object.assign({}, wert, { logo: m.logo || undefined, name: (AS.kundeV1 && AS.kundeV1.name) || undefined })));
    else localStorage.removeItem(AS_MARKE_KEY);
  }catch(e){}
  const marke = document.getElementById("kopfLogo"); if(!marke) return;
  let img = document.getElementById("asKundeLogo");
  if(m.logo){
    if(!img){ img = document.createElement("img"); img.id = "asKundeLogo"; marke.appendChild(img); }
    img.src = asMarkeLogoUrl(m.logo); img.alt = (AS.kundeV1 && AS.kundeV1.name) || ""; img.hidden = false;
  } else if(img) img.hidden = true;
}
/* Kundenbegriffe (AS_TITEL_KUNDE in as-kern.js) als Feld titelKunde an die Seiten hängen – Seiten dürfen eigene mitbringen */
Object.keys(AS_TITEL_KUNDE).filter(k => !k.includes("/")).forEach(k => { if(AS_SEITEN[k] && !AS_SEITEN[k].titelKunde) AS_SEITEN[k].titelKunde = AS_TITEL_KUNDE[k]; });

/* ---------------- Erscheinungsbild selbst pflegen (Betrieb autark, Stufe 9) ----------------
   Logo in den eigenen Ordner, fünf Farben, Datenschutz-Kontakt, Druckfuß „betreut durch OAK engineering“.
   Der Betrieb speichert über RPC portal_kunde_selbst (security definer, nur pflegeberechtigt), OAK direkt in portal_kunde. */
async function asMarkeDialog(){
  if(!asDarf("pflegen")) return;
  const roh = Object.assign({}, (AS.kundeV1 && AS.kundeV1.marke) || {});
  const k = ((await apiGet("/rest/v1/portal_kunde?select=datenschutz_kontakt&slug=eq." + encodeURIComponent(AS.kunde)).catch(() => [])) || [])[0] || {};
  const std = { farbe: "#2D6A4F", farbe_tief: "#1B4332", farbe_hell: "#52B788", akzent: "#D8F3DC", hintergrund: "#F4F7FA" };
  const farbe = (label, feld, hilfe) => `<label title="${esc(hilfe)}">${esc(label)}<input type="color" data-f="${feld}" value="${esc(/^#[0-9a-fA-F]{6}$/.test(roh[feld] || "") ? roh[feld] : std[feld])}"></label>`;
  const logo = asMarkePruefen(roh).logo;
  const d = asDialog({ titel: "Erscheinungsbild", inhalt: `<div class="form">
      <div class="voll marke-logo">${logo ? `<img src="${esc(asMarkeLogoUrl(logo))}" alt="Logo">` : `<span class="hinweis">Noch kein Logo</span>`}
        <label class="btn sek klein">Logo hochladen<input type="file" accept="image/png,image/jpeg,image/webp" id="markeDatei" hidden></label></div>
      <div class="voll marke-farben">${farbe("Hauptfarbe", "farbe", "Knöpfe, Kopfzeilen-Kante, Links")}${farbe("Dunkel", "farbe_tief", "Seitentitel und aktive Einträge")}${farbe("Hell", "farbe_hell", "helle Akzente")}${farbe("Akzent", "akzent", "Fläche aktiver Einträge und Hinweise")}${farbe("Hintergrund", "hintergrund", "Seitenhintergrund")}</div>
      ${asFeld("Datenschutz-Kontakt (erscheint auf der Datenschutzseite)", "datenschutz_kontakt", k.datenschutz_kontakt || "", "textarea", "voll")}
      ${asFeld("Druckfuß „betreut durch OAK engineering“ auf Aushängen und Ausdrucken", "druckfuss_oak", roh.druckfuss_oak !== false, "checkbox", "voll")}</div>
      <p class="hinweis">Gilt für alle Zugänge des Betriebs, am PC und am Handy.</p>`,
    knoepfe: [{ t: "OAK-Standardfarben", klasse: "sek", fn: async () => {
        await asMarkeSpeichern(Object.assign({}, roh, { farbe: null, farbe_tief: null, farbe_hell: null, akzent: null, hintergrund: null }), null); } },
      { t: "Speichern", fn: async dl => { const w = asWerte(dl), neu = Object.assign({}, roh);
        AS_MARKE_FARBEN.forEach(([feld]) => { neu[feld] = w[feld] || null; });
        neu.druckfuss_oak = !!w.druckfuss_oak;
        await asMarkeSpeichern(neu, w.datenschutz_kontakt || ""); } }] });
  d.querySelector("#markeDatei").onchange = async ev => {
    const datei = ev.target.files && ev.target.files[0]; if(!datei) return;
    if(datei.size > 2 * 1024 * 1024){ asMeldung("Das Logo ist größer als 2 MB."); return; }
    try{ roh.logo = await asMarkeLogoHochladen(datei); await asMarkeSpeichern(roh, null); asMeldung("Logo übernommen."); d.close(); asMarkeDialog(); }
    catch(e){ asMeldung("Hochladen fehlgeschlagen: " + ((e && e.message) || e)); }
  };
}
/* Logo in den eigenen Ordner (kundendokumente/<betrieb>/marke/) und als lange gültige signierte Adresse merken –
   der Ordner ist privat, ein <img> braucht eine Adresse ohne Anmeldung. */
async function asMarkeLogoHochladen(datei){
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })[datei.type]; if(!ext) throw new Error("nur PNG, JPG oder WebP");
  const pfad = AS.kunde + "/marke/logo-" + Date.now() + "." + ext, enc = pfad.split("/").map(encodeURIComponent).join("/");
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + enc, { method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + (await token()), "Content-Type": datei.type, "x-upsert": "true" }, body: datei });
  if(!r.ok) throw new Error("HTTP " + r.status);
  const s = await apiSend("POST", "/storage/v1/object/sign/" + CFG.bucket + "/" + enc, { expiresIn: 60 * 60 * 24 * 365 * 10 });
  const url = s && (s.signedURL || s.signedUrl); if(!url) throw new Error("keine Adresse erhalten");
  return CFG.url + "/storage/v1" + url;
}
async function asMarkeSpeichern(marke, kontakt){
  const m = {}; Object.keys(marke).forEach(x => { if(marke[x] !== null && marke[x] !== undefined && marke[x] !== "") m[x] = marke[x]; });
  if(asDarf("oak") || AS.alsBetrieb){   // OAK (auch in der Prüfansicht) schreibt direkt
    const teil = { marke: m }; if(kontakt !== null) teil.datenschutz_kontakt = kontakt || null;
    await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(AS.kunde), teil, "return=minimal");
  } else await apiSend("POST", "/rest/v1/rpc/portal_kunde_selbst", { p_marke: m, p_datenschutz_kontakt: kontakt });
  AS.kundeV1 = Object.assign({}, AS.kundeV1 || {}, { marke: m });
  asMarkeAnwenden(); asMeldung("Erscheinungsbild gespeichert.");
}

/* ---------------- Name beim gemeinsamen Zugang (Schichtführer teilen sich einen Login) ---------------- */
const AS_NAME_KEY = "oak_mein_name";
function asGemeinsamerZugang(){ return /^Schichtf/i.test(AS.kontoName || "") || !(AS.kontoName || "").trim(); }
function asNameFragen(danach){
  asDialog({ titel: "Wer arbeitet gerade?", inhalt: `<p>Dieser Zugang wird von mehreren Personen genutzt. Wer etwas meldet, erledigt oder quittiert, trägt seinen Namen ein – er wird in diesem Gerät gemerkt.</p>
      <div class="form">${asFeld("Ihr Name", "name", (() => { try{ return localStorage.getItem(AS_NAME_KEY) || ""; }catch(e){ return ""; } })(), "text", "voll")}</div>`,
    knoepfe: [{ t: "Übernehmen", fn: async d => { const w = asWerte(d); if(!w.name || w.name.length < 3){ asMeldung("Bitte den Namen eintragen."); return false; }
      try{ localStorage.setItem(AS_NAME_KEY, w.name); }catch(e){}
      AS.ich = w.name; document.getElementById("ichName").textContent = w.name + " · " + AS.kontoName; if(danach) danach(); } }] });
}
function asNameSetzen(){
  // Prüfansicht für OAK: ?als=betrieb zeigt die Oberfläche eines Betriebskontos (nur Anzeige – die Datenrechte bleiben die des Admins)
  if(AS.admin && /[?&]als=betrieb\b/.test(location.search) && !AS.alsBetrieb){
    AS.alsBetrieb = true; AS.admin = false; AS.oak = false; AS.fachkraft = false;   // Prüfansicht = Geschäftsführung des Betriebs (AS.gf/AS.pflege bleiben)
    const b = document.createElement("div"); b.className = "nodruck pruefansicht";
    b.textContent = "Prüfansicht: so sieht es ein Betriebskonto"; document.body.appendChild(b);
  }
  if(AS.kontoName === undefined) AS.kontoName = AS.ich;
  asPasswortKnopf();
  if(!asGemeinsamerZugang()) return;
  let n = ""; try{ n = localStorage.getItem(AS_NAME_KEY) || ""; }catch(e){}
  if(n){ AS.ich = n; const el = document.getElementById("ichName"); if(el) el.textContent = n + " · " + AS.kontoName; }
  else setTimeout(() => asNameFragen(), 300);
}

/* ---------------- Schnellzugriffe (gleiche Kennungen wie im Kundenportal) ---------------- */
const AS_SK_KATALOG = {
  terminal: ["vorort/terminal", "Unterweisung starten", "Terminal für die Beschäftigten"],
  melden: ["vorort/melden", "Vorfall melden", "Unfall oder Beinahe-Unfall"],
  mangel: ["maengel", "Mangel erfassen", "An Maschine oder Halle, mit Foto", "mangelNeu"],
  pruefen: ["vorort/pruefen", "Maschine prüfen", "Checkliste direkt an der Maschine"],
  ba: ["unterlagen", "Betriebsanweisungen", "Sammel-BA je Maschinentyp und je Maschine"],
  anfragen: ["fragen", "Frage an OAK", "Fragen stellen und Antworten lesen"],
  kalender: ["kalender/kalender", "Kalender", "Prüftermine, Fristen, ablaufende Nachweise"],
  "termin-neu": ["kalender/kalender", "Termin anlegen", "UVV-Prüfung, Wartung, Schulung"],
  nachweise: ["nachweise/qualifikation", "Nachweise", "Staplerschein, Kranschein, Ersthelfer"],
  vorsorge: ["nachweise/vorsorge", "Betriebsärztliche Vorsorge", "Wer ist wann fällig"],
  aktuelles: ["aktuelles", "Aktuelles", "Rechtliche Neuerungen und Versionshinweise"],
  todos: ["kalender/todos", "To-dos", "Offene Aufgaben erledigen oder quittieren"],
  wochenbericht: ["pflichten/wochenbericht", "Wochenbericht", "Was lief, was steht an"],
  maengel: ["maengel", "Mängelliste", "Offene Mängel nach Priorität"],
  kataster: ["anlagen", "Anlagenkataster", "Alle Anlagen mit Kurzinfo und Dokumenten"],
  hallenplan: ["hallenplan", "Hallenplan", "Alle Maschinen mit offenen Mängeln"],
  gbu: ["anlagen", "Gefährdungsbeurteilungen", "Je Maschine und je Tätigkeit"],
  qr: ["anlagen", "QR-Codes", "Je Anlage zum Ausdrucken"],
  unterweisungen: ["unterweisungen", "Unterweisungen", "Wer ist fällig, Nachweise, Einstellungen"],
  vorfaelle: ["steuerung/meldungen", "Vorfälle", "Gemeldete Vorfälle und Auswertung"],
  gefahrstoffe: ["gefahrstoffe", "Gefahrstoffkataster", "Sicherheitsdatenblätter, BA und GBU"],
  begehungen: ["unterlagen", "Begehungsprotokolle", "Was bei den Begehungen festgestellt wurde"],
  upload: ["unterlagen", "Unterlagen", "Interne Unterlagen ablegen und ansehen"],
  logbuch: ["steuerung/log", "Logbuch", "Wer hat wann was geändert"],
  "e-massnahmen": ["energie", "Effizienzmaßnahmen", "Befunde aus den Begehungen"],
  massnahmen: ["massnahmen", "Maßnahmen", "Offen, Wirksamkeit prüfen, wirksam"],
  pflichten: ["pflichten", "Stand der Pflichten", "Was bei einer Prüfung zuerst gefragt wird"],
  ziele: ["steuerung/ziele", "Ziele", "Arbeitsschutzziele mit Kennzahl"],
};
const AS_SK_STANDARD = ["terminal", "melden", "mangel", "pruefen", "ba", "anfragen", "aktuelles"];
const AS_SK = { einst: null, edit: false };
async function asSkLaden(){
  if(AS_SK.einst) return AS_SK.einst;
  try{ const r = await apiGet("/rest/v1/portal_nutzer_einstellung?select=daten"); AS_SK.einst = (r && r[0] && r[0].daten) || {}; }
  catch(e){ try{ AS_SK.einst = JSON.parse(localStorage.getItem("oak_schnellzugriffe") || "{}"); }catch(e2){ AS_SK.einst = {}; } }
  return AS_SK.einst;
}
function asSkAuswahl(){
  const eigene = AS_SK.einst && AS_SK.einst.schnellzugriffe && AS_SK.einst.schnellzugriffe.arbeitssicherheit;
  return (Array.isArray(eigene) ? eigene : AS_SK_STANDARD).filter(id => AS_SK_KATALOG[id] && (id !== "gefahrstoffe" || AS_SEITEN.gefahrstoffe));
}
async function asSkSetzen(liste){
  AS_SK.einst = AS_SK.einst || {};
  AS_SK.einst.schnellzugriffe = Object.assign({}, AS_SK.einst.schnellzugriffe || {}, { arbeitssicherheit: liste });
  try{ localStorage.setItem("oak_schnellzugriffe", JSON.stringify(AS_SK.einst)); }catch(e){}
  await apiSend("POST", "/rest/v1/portal_nutzer_einstellung?on_conflict=user_id", { daten: AS_SK.einst, geaendert_am: new Date().toISOString() },
    "resolution=merge-duplicates,return=minimal").catch(() => {});
}

/* ======================= Start =======================
   Wie im Kundenportal (V1 app.js renderStart/cockpit.js): Überschrift „Start“, zuerst „Auf einen Blick“ (was ein
   Schichtführer morgens wissen will, jede Kachel führt zur Liste), darunter die Schnellzugriffe. */
function asStartBlick(uwFaellig, aufgaben){
  const datum = d => d ? asDat(String(d).slice(0, 10)) : "–";
  const mg = typeof asMaengelRoh === "function" ? asMaengelRoh().filter(m => m.status !== "erledigt") : [];
  const zaun = mg.filter(m => asMgFeld(m, "thema") === "schutzzaun").length, mgGefahr = mg.filter(m => asMgBand(m) === "gefahr").length;
  const vf = asT("as_meldung").filter(m => m._v1).sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  const vOffen = vf.filter(v => v.status !== "erledigt").length, ART = { unfall: "Unfall", beinahe: "Beinahe-Unfall", zustand: "unsicherer Zustand" };
  const docs = (typeof AS_B !== "undefined" && AS_B.docs) || [];
  const beg = docs.filter(d => d.kategorie === "begehungen"), letzteBeg = beg.map(d => d.stand).filter(Boolean).sort().slice(-1)[0];
  const anl = typeof asAnlagen === "function" ? asAnlagen() : [], band = b => anl.filter(d => asAnlagenBand(d.maschinen_id) === b).length;
  const letzteDoku = anl.map(d => d.updated_at || d.stand).filter(Boolean).sort().slice(-1)[0];
  const kachel = (zahl, lbl, sub, farbe, ziel) => `<div class="kachel k-${farbe}" data-ziel="${esc(ziel)}" title="${esc(lbl + " – " + sub)}">
      <div class="zahl">${esc(String(zahl))}</div><div class="lbl">${esc(lbl)}</div><div class="hinweis">${esc(sub)}</div></div>`;
  /* Offene Aufgaben = die To-do-Liste (Prüfaufträge, Fristen, Freigaben …) – Abnahme K2-05, 06.11.2026.
     Sechs Kacheln (3 × 2): „letzte Begehung“ und „Unterlagen aktualisiert“ teilen sich eine Kachel. */
  const auf = aufgaben || [], krit = auf.filter(a => a.stufe === "kritisch").length, pa = auf.filter(a => /^pa:|^bda-neu-freigeben:|^bda-freigabe:|^ba-freigabe:/.test(a.schluessel || "")).length;
  return [
    kachel(mg.length, "offene Mängel", zaun + " an Schutzzäunen / Robotern · " + mgGefahr + " im Gefahrbereich", mg.length ? "rot" : "gruen", "maengel"),
    kachel(aufgaben ? auf.length : "–", "offene Aufgaben", aufgaben ? krit + " überfällig · " + pa + " Prüfaufträge und Freigaben" : "To-dos nicht geladen", krit ? "rot" : auf.length ? "gelb" : "gruen", "kalender/todos"),
    kachel(uwFaellig, "Unterweisungen fällig", uwFaellig ? "Personen ohne gültige Unterweisung" : "alle unterwiesen", uwFaellig ? "gelb" : "gruen", "unterweisungen"),
    kachel(vf[0] ? datum(vf[0].datum) : "keiner", "letzter Vorfall", vf[0] ? (ART[vf[0].art] || "Vorfall") + " · " + vOffen + " offen" : "bisher nichts gemeldet", vOffen ? "gelb" : "grau", "vorfaelle"),
    kachel(band("gefahr") + " von " + anl.length, "Anlagen im Gefahrbereich", band("besorgnis") + " Besorgnis · " + band("akzeptanz") + " Akzeptanz", band("gefahr") ? "rot" : "gruen", "anlagen"),
    kachel(datum(letzteDoku), "Unterlagen aktualisiert", anl.length + " Maschinen · letzte Begehung " + datum(letzteBeg), "grau", "unterlagen"),
  ].join("");
}
AS_SEITEN.start = { titel: "Start", sort: 0.5, async render(main){
  const kopf = `<h1 class="seite">Start</h1><p class="unter">${AS.ich ? "Guten Tag, " + esc(AS.ich.split(" ")[0]) + " · " : ""}${esc(AS.org ? AS.org.name : "")}</p>`;
  main.innerHTML = kopf + `<div class="leer">wird geladen …</div>`;
  await asSkLaden();
  if(typeof asBetriebLaden === "function") await asBetriebLaden().catch(() => {});
  const [fae, svOk] = await Promise.all([
    apiGet("/rest/v1/v_uw_faelligkeit?select=person_id,status&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => []),
    typeof asSvLaden === "function" ? asSvLaden().then(() => true).catch(() => false) : false]);
  let aufgaben = null; if(svOk) try{ aufgaben = asSvAufgaben(); }catch(e){ aufgaben = null; }
  const uwFaellig = new Set((fae || []).filter(f => f.status === "ueberfaellig" || f.status === "erstunterweisung").map(f => f.person_id)).size;
  if(AS.seite !== "start") return;
  asNav();   // Zähler und Umwelt-Eintrag kennen jetzt die Unterlagen
  const zeichnen = () => {
    const liste = asSkAuswahl();
    /* volle Reihen ohne einzelne Kachel am Ende: Spaltenzahl 1–4 so wählen, dass die letzte Reihe ≥ 2 Kacheln hat (Rest dehnt sich) */
    const n = liste.length + (AS_SK.edit ? 1 : 0), spalten = n <= 4 ? Math.max(1, n) : n % 4 === 1 ? 3 : 4;
    const kachel = (id, i) => { const k = AS_SK_KATALOG[id];
      return AS_SK.edit ? `<div class="kachel sk-kachel" title="${esc(k[2])}"><div class="lbl">${esc(k[1])}</div>
          <div class="sk-knoepfe"><button class="btn sek klein" data-sk="links" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="nach links">‹</button>
          <button class="btn sek klein" data-sk="rechts" data-i="${i}" ${i === liste.length - 1 ? "disabled" : ""} aria-label="nach rechts">›</button>
          <button class="btn sek klein" data-sk="weg" data-i="${i}">entfernen</button></div></div>`
        : `<div class="kachel k-gruen sk-kachel" data-geh="${esc(id)}" title="${esc(k[1] + " – " + k[2])}"><div class="zahl klein">${esc(k[1])}</div><div class="hinweis">${esc(k[2])}</div></div>`; };
    main.innerHTML = kopf + `<div class="karte"><h2>Auf einen Blick</h2><div class="kacheln blick">${asStartBlick(uwFaellig, aufgaben)}</div></div>
      <div class="karte"><h2>Schnellzugriffe <span>${AS_SK.edit ? `<button class="btn sek klein" id="skStd">Standard</button> <button class="btn klein" id="skFertig">Fertig</button>` : `<button class="btn sek klein" id="skAnp">Anpassen</button>`}</span></h2>
        <div class="kacheln blick sk sk-${spalten}">${liste.map(kachel).join("")}${AS_SK.edit ? `<div class="kachel sk-kachel" id="skNeu"><div class="zahl">+</div><div class="hinweis">Schnellzugriff hinzufügen</div></div>` : ""}</div></div>`;
    main.querySelectorAll("[data-geh]").forEach(k => k.onclick = () => { const z = AS_SK_KATALOG[k.dataset.geh]; if(z[3] === "mangelNeu") AS.mgNeuSofort = true; asGehe(z[0]); });
    main.querySelectorAll("[data-ziel]").forEach(k => k.onclick = () => asGehe(k.dataset.ziel));
    const an = document.getElementById("skAnp"); if(an) an.onclick = () => { AS_SK.edit = true; zeichnen(); };
    const fe = document.getElementById("skFertig"); if(fe) fe.onclick = () => { AS_SK.edit = false; zeichnen(); };
    const sd = document.getElementById("skStd"); if(sd) sd.onclick = async () => { if(AS_SK.einst && AS_SK.einst.schnellzugriffe){ delete AS_SK.einst.schnellzugriffe.arbeitssicherheit; await asSkSetzen(undefined); } zeichnen(); };
    main.querySelectorAll("[data-sk]").forEach(b => b.onclick = async () => { const l = asSkAuswahl().slice(), i = +b.dataset.i;
      if(b.dataset.sk === "weg") l.splice(i, 1); else { const j = b.dataset.sk === "links" ? i - 1 : i + 1; [l[i], l[j]] = [l[j], l[i]]; }
      await asSkSetzen(l); zeichnen(); });
    const nk = document.getElementById("skNeu"); if(nk) nk.onclick = () => { const da = new Set(asSkAuswahl());
      const frei = Object.keys(AS_SK_KATALOG).filter(id => !da.has(id) && (id !== "gefahrstoffe" || AS_SEITEN.gefahrstoffe));
      const d = asDialog({ titel: "Schnellzugriff hinzufügen", inhalt: `<div class="zeilen">${frei.map(id => `<div class="z" data-neu="${esc(id)}"><div><b>${esc(AS_SK_KATALOG[id][1])}</b><small>${esc(AS_SK_KATALOG[id][2])}</small></div></div>`).join("") || `<div class="leer">Alle sind schon da.</div>`}</div>` });
      d.querySelectorAll("[data-neu]").forEach(z => z.onclick = async () => { await asSkSetzen(asSkAuswahl().concat([z.dataset.neu])); d.close(); zeichnen(); }); };
  };
  zeichnen();
}};

/* ---------------- Installation als App (Knopf im Fuß der Seitenleiste, wie V1) ---------------- */
let AS_INSTALL = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); AS_INSTALL = e; asInstallZeigen(); });
function asInstallZeigen(){ document.querySelectorAll('[data-sl="install"]').forEach(b => { b.hidden = !AS_INSTALL; }); }
async function asInstallStarten(){ if(!AS_INSTALL) return; AS_INSTALL.prompt(); await AS_INSTALL.userChoice.catch(() => {}); AS_INSTALL = null; asInstallZeigen(); }
if("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
/* „Melden“: ein Weg, zwei Ziele – Mangel/unsicherer Zustand in die Mängelliste, Unfall/Beinahe-Unfall als Vorfall (Durchlauf 15.10.) */
function asMeldenWahl(){
  const d = asDialog({ titel: "Was soll gemeldet werden?", inhalt: `<div class="zeilen">
      <div class="z" data-mw="mangel"><div><b>Mangel oder unsicherer Zustand</b><small>an einer Anlage, im Gebäude oder am Arbeitsplatz – kommt in die Mängelliste</small></div><span class="chip c-gelb">Mangel</span></div>
      <div class="z" data-mw="vorfall"><div><b>Unfall oder Beinahe-Unfall</b><small>Ereignis mit oder ohne Verletzung – wird ausgewertet</small></div><span class="chip c-rot">Vorfall</span></div></div>` });
  d.querySelector('[data-mw="mangel"]').onclick = async () => { d.close(); if(typeof asBetriebLaden === "function") await asBetriebLaden(); asMangelNeu(); };
  d.querySelector('[data-mw="vorfall"]').onclick = () => { d.close(); asGehe("vorort/melden"); };
}

/* ---------------- Betriebskonten: Management-Werkzeuge der Fachkraft ausblenden (wie V1 „Erweiterte Funktionen“) ---------------- */
["check", "prozesse", "bericht"].forEach(k => { if(AS_SEITEN[k]) AS_SEITEN[k].nurFachkraft = true; });

/* ---------------- Passwort ändern (nicht beim gemeinsamen Schichtführer-Zugang, wie V1) ----------------
   Erreichbar im Fuß der Seitenleiste und im Kopfmenü. */
function asPasswortDialog(){
  asDialog({ titel: "Passwort ändern", inhalt: `<div class="form">${asFeld("Neues Passwort (mindestens 8 Zeichen)", "p1", "", "password", "voll")}${asFeld("Wiederholen", "p2", "", "password", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d);
      if(!w.p1 || w.p1.length < 8){ asMeldung("Mindestens 8 Zeichen."); return false; }
      if(w.p1 !== w.p2){ asMeldung("Die Eingaben stimmen nicht überein."); return false; }
      try{ await passwortAendern(w.p1); asMeldung("Passwort geändert – gilt ab sofort."); }
      catch(e){ asMeldung(e && e.message === "AUTH" ? "Sitzung abgelaufen – bitte neu anmelden." : "Fehlgeschlagen: " + ((e && e.message) || e)); return false; } } }] });
}
function asPasswortKnopf(){
  const ich = document.querySelector(".kopf .ich"); if(!ich) return;
  if(!document.getElementById("asPw") && !/^Schichtf/i.test(AS.kontoName || AS.ich || "")){
    const b = document.createElement("button"); b.className = "link"; b.id = "asPw"; b.type = "button"; b.textContent = "Passwort ändern";
    ich.insertBefore(b, document.getElementById("abmelden")); b.onclick = () => { if(typeof asKopfMenue === "function") asKopfMenue(false); asPasswortDialog(); };
  }
  /* Erscheinungsbild (Logo, Farben, Datenschutz-Kontakt) – pflegeberechtigte Konten */
  if(!document.getElementById("asMarkeKnopf") && asDarf("pflegen")){
    const b = document.createElement("button"); b.className = "link"; b.id = "asMarkeKnopf"; b.type = "button"; b.textContent = "Erscheinungsbild";
    ich.insertBefore(b, document.getElementById("abmelden")); b.onclick = () => { if(typeof asKopfMenue === "function") asKopfMenue(false); asMarkeDialog(); };
  }
}

/* ---------------- Neue Version online? (wie V1: Vergleich der Stylesheet-Fassung in index.html, nichts lädt ungefragt neu) ---------------- */
(function(){
  const stil = document.querySelector('link[href*="as.css"]'), meins = stil ? stil.getAttribute("href") : "";
  let gezeigt = false;
  async function pruefen(){
    if(!meins || gezeigt) return;
    try{ const t = await (await fetch("index.html?stand=" + Date.now(), { cache: "no-store" })).text();
      const m = t.match(/href="(as\.css\?v=[^"]+)"/);
      if(m && m[1] !== meins){ gezeigt = true;
        const b = document.createElement("div"); b.className = "nodruck neue-version";
        b.innerHTML = `<b>Eine neue Version der App ist online.</b> <button class="btn klein">Aktualisieren</button>`;
        b.querySelector("button").onclick = () => location.reload(); document.body.appendChild(b); } }catch(e){}
  }
  setInterval(pruefen, 30000);
  document.addEventListener("visibilitychange", () => { if(!document.hidden) pruefen(); });
})();

/* ---------------- Kiosk-Betrieb (?kiosk=1): Gerät steht offen in der Halle – nach 5 Minuten ohne Bedienung abmelden (wie V1) ---------------- */
(function(){
  const KEY = "oak_portal_kiosk";
  try{ if(new URLSearchParams(location.search).get("kiosk") === "1") sessionStorage.setItem(KEY, "1"); }catch(e){}
  let kiosk = false; try{ kiosk = sessionStorage.getItem(KEY) === "1"; }catch(e){}
  if(!kiosk) return;
  let uhr = null;
  const neu = () => { clearTimeout(uhr); uhr = setTimeout(() => { clearSession(); location.reload(); }, 5 * 60000); };
  ["click", "keydown", "pointerdown", "wheel", "touchstart"].forEach(ev => document.addEventListener(ev, neu, { passive: true }));
  neu();
})();

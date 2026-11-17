/* OAK Sicherheitskultur – Demo ohne Anmeldung (17.11.2026).
   Nutzt das echte Modul ../portal2/as-rundgang.js unverändert und ersetzt nur das Cockpit drumherum:
   Daten liegen im Browser (localStorage), Mails landen im „Postausgang“ statt im Versand, „Ansicht als“ wechselt die Rolle.
   Globale Namen wie im Cockpit (as…/AS…), damit das Modul ohne Änderung läuft. */
"use strict";

const SK_KEY = "oak_sicherheitskultur_demo_v1";
const CFG = { url: "", anon: "", bucket: "demo" };
const AS = { kunde: "demo", ich: "Betrieb (Demo)", uid: "admin", pflege: true, db: {}, seite: "sicherheitskultur", reiter: {}, nurModul: true, org: { daten: { paket: "sicherheitskultur" } } };
const AS_SEITEN = {};
const AS_ICON = {};
let SK = { post: [], ich: null, modus: "start" };

/* ---------------- kleine Hilfen wie im Cockpit ---------------- */
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function asHeute(){ const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function asDat(d){ return d ? String(d).slice(0, 10).split("-").reverse().join(".") : "–"; }
function asChip(text, farbe){ return `<span class="chip c-${farbe}">${esc(text)}</span>`; }
function asT(t){ return AS.db[t] || []; }
function asNach(t, id){ return asT(t).find(r => r.id === id); }
function asDarf(a){ return a === "pflegen" || a === "loeschen" ? AS.pflege : false; }
function asOrgDaten(){ return AS.org.daten; }
async function asOrgSpeichern(teil){ Object.assign(AS.org.daten, teil); skSichern(); }
function asEinheitName(id){ const e = asNach("as_einheit", id); return e ? e.name : "–"; }
function asMeldung(text){ const m = document.getElementById("meldung"); m.textContent = text; m.hidden = false; clearTimeout(asMeldung.t); asMeldung.t = setTimeout(() => m.hidden = true, 3200); }
function asGehe(ziel){ location.hash = "#" + ziel; }
function asDialog({ titel, inhalt, breit, knoepfe }){
  const d = document.getElementById("dlg");
  d.className = "dlg" + (breit ? " breit" : "");
  d.innerHTML = `<div class="dlg-kopf"><h3>${esc(titel)}</h3><button class="zu" data-zu>✕</button></div><div class="dlg-inhalt">${inhalt}</div>
    ${knoepfe && knoepfe.length ? `<div class="dlg-fuss">${knoepfe.map((k, i) => `<button class="btn ${k.klasse || ""}" data-k="${i}">${esc(k.t)}</button>`).join("")}</div>` : ""}`;
  d.querySelector("[data-zu]").onclick = () => d.close();
  (knoepfe || []).forEach((k, i) => d.querySelector(`[data-k="${i}"]`).onclick = async () => {
    try{ const r = await k.fn(d); if(r !== false) d.close(); }catch(e){ asMeldung("Fehler: " + (e.message || e)); } });
  if(!d.open) d.showModal();
  return d;
}
function asWerte(el){ const w = {}; el.querySelectorAll("[data-f]").forEach(f => { const k = f.dataset.f;
  if(f.type === "checkbox") w[k] = f.checked; else if(f.type === "number") w[k] = f.value === "" ? null : +f.value; else w[k] = f.value.trim() === "" ? null : f.value.trim(); }); return w; }
function asFeld(label, f, wert, typ, extra){ typ = typ || "text";
  if(typ === "textarea") return `<label class="${extra || ""}">${label}<textarea data-f="${f}">${esc(wert || "")}</textarea></label>`;
  if(typ === "checkbox") return `<label class="${extra || ""}" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" data-f="${f}" ${wert ? "checked" : ""}> ${label}</label>`;
  return `<label class="${extra || ""}">${label}<input type="${typ}" data-f="${f}" value="${esc(wert == null ? "" : wert)}"></label>`; }
function asFilterWahl(attr, wert, optionen, bez){ return `<select ${attr} aria-label="${esc(bez)}">${optionen.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o];
  return `<option value="${esc(v)}" ${String(wert) === String(v) ? "selected" : ""}>${esc(bez + ": " + t)}</option>`; }).join("")}</select>`; }
function asAuswahl(label, f, wert, optionen, extra){ return `<label class="${extra || ""}">${label}<select data-f="${f}">${optionen.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o];
  return `<option value="${esc(v)}" ${String(wert) === String(v) ? "selected" : ""}>${esc(t)}</option>`; }).join("")}</select></label>`; }
function asReiter(seite, liste, standard){
  const akt = AS.reiter[seite] && liste.some(l => l[0] === AS.reiter[seite]) ? AS.reiter[seite] : standard;
  return { akt, html: `<div class="reiter nodruck">${liste.map(([k, t]) => `<button class="${k === akt ? "an" : ""}" title="${esc(t)}" onclick="asGehe('${seite}/${k}')">${esc(t)}</button>`).join("")}</div>` }; }
function asZeige(){
  const main = document.getElementById("haupt"); main.innerHTML = "";
  document.body.dataset.modus = SK.modus;
  const ab = document.getElementById("skAb"); if(ab) ab.hidden = !SK.ich || SK.modus === "verwaltung";
  const zu = document.getElementById("skZurueck"); if(zu) zu.hidden = SK.modus !== "verwaltung";
  if(SK.modus === "verwaltung"){
    const [s, r] = decodeURIComponent(location.hash.replace(/^#/, "")).split("/");
    AS.seite = "sicherheitskultur"; if(s === "sicherheitskultur" && r) AS.reiter.sicherheitskultur = r;
    AS_SEITEN.sicherheitskultur.render(main); return;
  }
  if(SK.modus === "mein" && asNach("rg_teilnehmer", SK.ich)) return skMein(main);
  SK.modus = "start"; skStartseite(main);
}

/* ---------------- Datenhaltung im Browser (statt Supabase) ---------------- */
const SK_TAB = ["rg_einstellung", "rg_teilnehmer", "rg_gruppe", "rg_gruppe_mitglied", "rg_termin", "rg_protokoll", "as_einheit"];
function skSichern(){ try{ localStorage.setItem(SK_KEY, JSON.stringify({ db: AS.db, org: AS.org.daten, post: SK.post, ich: SK.ich, modus: SK.modus })); }catch(e){} }
function skId(){ return (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now()); }
function skTrigger(t, row){
  if(t === "rg_termin"){
    const frist = (asT("rg_einstellung")[0] || {}).berichtsfrist_tage || 7, d = new Date(row.beginn);
    const tag = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); tag.setDate(tag.getDate() + frist);
    row.bericht_faellig_am = tag.toISOString().slice(0, 10); row.status = row.status || "geplant"; row.geaendert_am = new Date().toISOString();
  }
  if(t === "rg_protokoll"){ const r = asNach("rg_termin", row.termin_id); if(r && r.status === "geplant") r.status = "abgeschlossen"; }
}
async function asSpeichern(t, row){
  const liste = AS.db[t] = AS.db[t] || [];
  if(t === "rg_teilnehmer" && row.email && liste.some(x => x.id !== row.id && String(x.email || "").toLowerCase() === String(row.email).toLowerCase())) throw new Error("23505 duplicate");
  let neu;
  if(row.id && liste.some(x => x.id === row.id)){ neu = Object.assign(liste.find(x => x.id === row.id), row); }
  else { neu = Object.assign({ id: skId(), kunde_slug: AS.kunde, angelegt_am: new Date().toISOString() }, row); if(!row.id) delete row.id; neu.id = neu.id || skId(); liste.push(neu); }
  skTrigger(t, neu); skSichern(); return neu;
}
async function apiGet(pfad){ const m = pfad.match(/\/rest\/v1\/([a-z_]+)/); return m ? (AS.db[m[1]] = AS.db[m[1]] || []) : []; }
async function apiSend(methode, pfad, body){
  const m = pfad.match(/\/rest\/v1\/(rpc\/)?([a-z_]+)/); if(!m) return null;
  if(m[1]){ if(m[2] === "rg_zugang_einschraenken"){ const t = asNach("rg_teilnehmer", body.p_teilnehmer); if(t) t.user_id = "u-" + t.id; skSichern(); } return true; }
  const t = m[2], liste = AS.db[t] = AS.db[t] || [];
  if(t === "rg_einstellung"){ AS.db[t] = [Object.assign({}, liste[0] || {}, body)]; skSichern(); return AS.db[t]; }
  (Array.isArray(body) ? body : [body]).forEach(b => { const n = Object.assign({ id: skId() }, b);
    if(t === "rg_teilnehmer" && n.email && liste.some(x => String(x.email || "").toLowerCase() === n.email.toLowerCase())) return;
    liste.push(n); });
  skSichern(); return null;
}
async function token(){ return "demo"; }
function getSession(){ return { user: { email: "" } }; }
function asSvSigniert(){ return Promise.resolve(null); }
function asSvDateiOk(d){ if(d && d.size > 15 * 1024 * 1024) throw new Error("Die Datei ist größer als 15 MB."); return true; }
function asSvDateiName(d){ return d.name.replace(/[^A-Za-z0-9._-]+/g, "-"); }
async function asSvHochladen(datei, pfad){ return pfad; }   // Demo: nur der Dateiname wird gemerkt
function asZgPasswort(){ return "(in der Demo nicht nötig)"; }
async function asZgAufruf(){ return { ok: true, user_id: "demo" }; }
function asSvCss(){ /* steht in index.html */ }

/* ---------------- Beispieldaten ---------------- */
function skBeispiel(){
  const tag = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  const abt = ["Montage", "Fertigung", "Instandhaltung", "Logistik", "Qualität", "Verwaltung"].map((n, i) => ({ id: "abt-" + i, name: n, sort: i }));
  const A = n => abt.find(a => a.name === n).id;
  const p = [["Thomas Brandt", "Montage", "fk"], ["Julia Neumann", "Fertigung", "fk"], ["Stefan Krüger", "Logistik", "fk"], ["Mehmet Arslan", "Montage", "sibe"],
    ["Claudia Berger", "Fertigung", "sibe"], ["Daniel Vogel", "Instandhaltung", "sibe"], ["Sandra Lange", "Qualität", "fremd"], ["Markus Frank", "Verwaltung", "fremd"],
    ["Nina Hartmann", "Verwaltung", "fremd"], ["Oliver Schmid", "Instandhaltung", "fremd"]].map(([name, a, rolle], i) => ({ id: "tn-" + i, kunde_slug: "demo", name,
      email: name.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(" ", ".") + "@muster.example", einheit_id: A(a), rolle,
      status: i === 9 ? "angemeldet" : "bestaetigt", user_id: "u-tn-" + i }));
  const g = ["A", "B", "C"].map((x, i) => ({ id: "gr-" + i, kunde_slug: "demo", name: "Gruppe " + x, runde: 1, gueltig_von: asHeute(), archiviert: false }));
  const mit = [[0, 4, 6], [1, 5, 7], [2, 3, 8]].flatMap((ids, gi) => ids.map(i => ({ id: "gm-" + gi + "-" + i, kunde_slug: "demo", gruppe_id: g[gi].id, teilnehmer_id: "tn-" + i })));
  AS.db = { as_einheit: abt, rg_teilnehmer: p, rg_gruppe: g, rg_gruppe_mitglied: mit, rg_termin: [], rg_protokoll: [],
    rg_einstellung: [{ kunde_slug: "demo", arten: { lern: true, sicher: true }, soll: { lern: { anzahl: 1, monate: 1, bezug: "gruppe" }, sicher: { anzahl: 1, monate: 1, bezug: "fk" } },
      berichtsfrist_tage: 7, erinnerung_tage: [3, 1, 0], sichtbarkeit: "alle", mindest: { fk: 1, sibe: 1, fremd: 1 }, mail_an: true, auswertung_fk: true, protokoll_felder: {} }] };
  const t = (art, gi, fk, n, h, dauer, bereich) => { const r = { id: skId(), kunde_slug: "demo", art, gruppe_id: gi == null ? null : g[gi].id, fk_id: "tn-" + fk, beginn: tag(n, h), dauer_min: dauer, bereich };
    skTrigger("rg_termin", r); AS.db.rg_termin.push(r); return r; };
  const r1 = t("lern", 0, 0, -9, 8, 60, "Montagelinie 2 – Schrauberplatz");
  AS.db.rg_protokoll.push({ id: skId(), kunde_slug: "demo", termin_id: r1.id, art: "lern", inhalt: { arbeitsplatz: "Montagelinie 2 – Schrauberplatz", notiz: "Gespräch mit dem Monteur zu Griffhöhe und Werkzeugwechsel. Idee: Ablage näher an den Platz." }, dateien: [], erstellt_von: "Thomas Brandt" });
  r1.status = "abgeschlossen";
  t("sicher", null, 1, -3, 7, 30, "Fertigung Halle 1");
  t("lern", 1, 1, 6, 9, 60, "Fertigung – Biegepresse");
  t("sicher", null, 2, 2, 13, 30, "Wareneingang");
  AS.org.daten = { paket: "sicherheitskultur" }; SK.post = []; SK.ich = null; SK.modus = "start";
}

/* ---------------- Mails → Postausgang (statt Versand) ---------------- */
const SK_ART = { lern: "Lernrundgang", sicher: "Sicherheitsrundgang" };
function skEmpfaenger(r){ const ids = new Set([r.fk_id]); if(r.art === "lern" && r.gruppe_id) asT("rg_gruppe_mitglied").filter(m => m.gruppe_id === r.gruppe_id).forEach(m => ids.add(m.teilnehmer_id));
  return asT("rg_teilnehmer").filter(t => ids.has(t.id) && t.status !== "inaktiv"); }
function skPost(betreff, an, text){ SK.post.unshift({ am: new Date().toISOString(), betreff, an: an.map(t => t.name), ids: an.map(t => t.id), text }); skSichern();
  if(SK.ich && an.some(t => t.id === SK.ich) && SK.modus !== "verwaltung") setTimeout(() => asMeldung("Neue Mail: " + betreff), 1400); }
async function skMail(b){
  if((asT("rg_einstellung")[0] || {}).mail_an === false) return { ok: true, gesendet: 0 };
  if(b.ereignis === "termin"){ const r = asNach("rg_termin", b.termin_id); if(!r) return null; const an = skEmpfaenger(r);
    const kopf = { neu: "Neuer Termin", geaendert: "Termin geändert", abgesagt: "Termin abgesagt" }[b.art] || "Termin";
    skPost(`${kopf}: ${SK_ART[r.art]} – ${asDat(asRgTag(r.beginn))} ${asRgUhr(r.beginn)} Uhr`, an, `${r.bereich || ""}${b.art === "abgesagt" ? "" : " · mit Kalenderdatei (.ics)"}`);
    return { ok: true, gesendet: an.length }; }
  if(b.ereignis === "gruppen"){ let n = 0; asRgGruppen().forEach(g => { const an = asRgMitglieder(g.id); n += an.length;
    skPost("Ihre Rundgangs-Gruppe: " + g.name, an, ""); }); return { ok: true, gesendet: n }; }
  return { ok: true, gesendet: 0 };
}
/* täglicher Erinnerungslauf (im Cockpit automatisch um 06:15 Uhr) – hier per Knopf */
function skErinnern(){
  const e = Object.assign({ erinnerung_tage: [3, 1, 0] }, asT("rg_einstellung")[0] || {}); let n = 0;
  asT("rg_termin").filter(r => r.status === "geplant" && new Date(r.beginn) < new Date() && !asRgProt(r.id)).forEach(r => {
    const rest = Math.round((new Date(r.bericht_faellig_am) - new Date(asHeute())) / 864e5);
    if(rest < 0 || (e.erinnerung_tage || []).includes(rest)){ const an = skEmpfaenger(r); n++;
      skPost((rest < 0 ? "Protokoll überfällig: " : rest === 0 ? "Protokoll heute fällig: " : `Protokoll fällig in ${rest} Tagen: `) + SK_ART[r.art], an, (r.bereich || "") + " · an die ganze Gruppe"); }
  });
  return n;
}

/* ---------------- Rolle setzen ---------------- */
function skAls(wer){
  if(wer === "admin"){ AS.pflege = true; AS.uid = "admin"; AS.ich = "Betrieb (Demo)"; return; }
  const t = asNach("rg_teilnehmer", wer); AS.pflege = false; AS.uid = t ? t.user_id : "gast"; AS.ich = t ? t.name : "";
}
const SK_ROLLE = { fk: "Führungskraft", sibe: "Sicherheitsbeauftragte/r", fremd: "Fremder Blick" };

/* ---------------- Startseite: erklären + anmelden ---------------- */
function skStartseite(main){
  skAls("gast");
  const abt = asT("as_einheit");
  main.innerHTML = `<div class="sk-start">
    <section class="sk-intro">
      <h1>Sicherheitskultur bei der Muster GmbH</h1>
      <p>Gemeinsam hinschauen, miteinander reden, besser werden. Melden Sie sich an – Sie werden einer Gruppe zugeordnet und zu den Rundgängen eingeladen.</p>
      <div class="sk-kacheln">
        <div class="sk-kachel"><b>Lernrundgang</b><span>Die Gruppe schaut sich einen Arbeitsplatz genau an und spricht mit den Beschäftigten – 45 bis 60 Minuten.</span></div>
        <div class="sk-kachel"><b>Sicherheitsrundgang</b><span>Die Führungskraft sieht sich allein drei bis fünf Tätigkeiten kurz an – etwa 30 Minuten.</span></div>
      </div>
    </section>
    <form class="sk-karte sk-form" id="skForm" autocomplete="on">
      <h2>Mitmachen</h2>
      <label>Vor- und Nachname<input id="skName" required autocomplete="name"></label>
      <label>Dienstliche E-Mail<input id="skMail" type="email" required autocomplete="email"></label>
      <label>Abteilung<select id="skAbt" required><option value="">– bitte wählen –</option>${abt.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select></label>
      <div class="sk-rolle-titel">Meine Rolle</div>
      <div class="sk-rollen">${Object.entries(SK_ROLLE_KURZ).map(([k, t], i) => `<label class="sk-rolle" title="${esc(SK_ROLLE[k])}"><input type="radio" name="skRolle" value="${k}" ${i === 0 ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>
      <button class="btn sk-los" type="submit">Anmelden</button>
    </form></div>`;
  main.querySelector("#skForm").onsubmit = async ev => {
    ev.preventDefault();
    const name = main.querySelector("#skName").value.trim(), email = main.querySelector("#skMail").value.trim().toLowerCase();
    const einheit_id = main.querySelector("#skAbt").value, rolle = (main.querySelector('input[name="skRolle"]:checked') || {}).value;
    if(name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !einheit_id){ asMeldung("Bitte Name, E-Mail und Abteilung angeben"); return; }
    let t = asT("rg_teilnehmer").find(x => String(x.email || "").toLowerCase() === email);
    if(!t){ const id = skId(); t = await asSpeichern("rg_teilnehmer", { id, name, email, einheit_id, rolle, status: "bestaetigt", user_id: "u-" + id, angelegt_von: "Selbstanmeldung" }); }
    SK.ich = t.id; SK.modus = "mein"; skAls(t.id);
    const g = asRgGruppeVon(t.id) || await asRgNachruecken(t);
    skSichern(); asZeige();
    asMeldung(g ? "Willkommen! Sie sind in " + g.name + "." : "Willkommen! Sie werden bald einer Gruppe zugeordnet.");
    if(g) skPost("Ihre Rundgangs-Gruppe: " + g.name, asRgMitglieder(g.id), "");
  };
}
const SK_ROLLE_KURZ = { fk: "Führungskraft", sibe: "Sicherheits­beauftragte/r", fremd: "Fremder Blick" };

/* ---------------- Meine Seite ---------------- */
function skMein(main){
  const t = asNach("rg_teilnehmer", SK.ich); skAls(t.id);
  const g = asRgGruppeVon(t.id), leute = g ? asRgMitglieder(g.id) : [];
  const meine = asT("rg_termin").filter(r => r.status !== "abgesagt" && (r.fk_id === t.id || (r.art === "lern" && g && r.gruppe_id === g.id)));
  const naechster = meine.filter(r => new Date(r.beginn) > new Date()).sort((a, b) => String(a.beginn).localeCompare(String(b.beginn)))[0];
  const offen = meine.filter(r => ["protokoll", "ueberfaellig"].includes(asRgStatus(r)));
  const fk = t.rolle === "fk";
  const art = r => r.art === "lern" ? "Lernrundgang" : "Sicherheitsrundgang";
  main.innerHTML = `<div class="sk-mein">
    <h1>Hallo ${esc(t.name.split(" ")[0])}</h1>
    <p class="sk-unter">${esc(SK_ROLLE[t.rolle])} · ${esc(asEinheitName(t.einheit_id))}</p>
    <div class="sk-karten">
      <div class="sk-karte"><h2>Meine Gruppe</h2>
        ${g ? `<div class="sk-gross">${esc(g.name)}</div><ul class="sk-liste">${leute.map(x => `<li${x.id === t.id ? ' class="sk-ich"' : ""}><span>${esc(x.name)}</span><small>${esc(SK_ROLLE[x.rolle])}</small></li>`).join("")}</ul>`
          : `<p class="sk-leer">Sie werden bald einer Gruppe zugeordnet.</p>`}</div>
      <div class="sk-karte"><h2>Nächster Rundgang</h2>
        ${naechster ? `<div class="sk-gross">${esc(asDat(asRgTag(naechster.beginn)))} · ${esc(asRgUhr(naechster.beginn))} Uhr</div>
            <ul class="sk-liste"><li><span>${esc(art(naechster))}</span></li>${naechster.bereich ? `<li><span>${esc(naechster.bereich)}</span></li>` : ""}<li><span>Leitung: ${esc(asRgName(naechster.fk_id))}</span></li></ul>`
          : `<div class="sk-gross">Noch nicht geplant</div><p class="sk-leer">${fk ? "Planen Sie den nächsten Rundgang – Ihre Gruppe wird eingeladen." : "Sie bekommen eine Einladung per Mail."}</p>`}
        ${fk ? `<button class="btn sk-unten" id="skPlanen">Rundgang planen</button>` : ""}</div>
      <div class="sk-karte"><h2>Zu tun</h2>
        ${offen.length ? `<div class="sk-gross">Protokoll offen</div><ul class="sk-liste"><li><span>${esc(art(offen[0]))} vom ${esc(asDat(asRgTag(offen[0].beginn)))}</span></li>
            <li><span>bis ${esc(asDat(offen[0].bericht_faellig_am))} eintragen</span></li></ul><button class="btn sk-unten" id="skProt">Protokoll eintragen</button>`
          : `<div class="sk-gross">Nichts offen</div><p class="sk-leer">Nach jedem Rundgang tragen Sie hier das Protokoll ein.</p>`}</div>
    </div></div>`;
  const pl = main.querySelector("#skPlanen"); if(pl) pl.onclick = () => asRgTerminDialog(null);
  const pr = main.querySelector("#skProt"); if(pr) pr.onclick = () => asRgProtokollDialog(offen[0]);
}

/* ---------------- Start ---------------- */
function skStart(){
  let st = null; try{ st = JSON.parse(localStorage.getItem(SK_KEY) || "null"); }catch(e){}
  if(st && st.db){ AS.db = st.db; AS.org.daten = st.org || { paket: "sicherheitskultur" }; SK.post = st.post || []; SK.ich = st.ich || null;
    SK.modus = st.modus === "mein" && st.ich ? "mein" : "start"; }
  else skBeispiel();
  SK_TAB.forEach(t => AS.db[t] = AS.db[t] || []);
  asRgMail = skMail;   // Mails → nur kurze Meldung
  AS_RG.d = true; AS_RG.slug = AS.kunde;
  document.getElementById("skAb").onclick = ev => { ev.preventDefault(); SK.ich = null; SK.modus = "start"; skSichern(); asZeige(); };
  document.getElementById("skVerw").onclick = ev => { ev.preventDefault(); SK.modus = "verwaltung"; skAls("admin"); location.hash = "#sicherheitskultur/gruppen"; asZeige(); window.scrollTo(0, 0); };
  document.getElementById("skZurueck").onclick = ev => { ev.preventDefault(); SK.modus = SK.ich ? "mein" : "start"; AS_RG.entwurf = null; history.replaceState(null, "", location.pathname); asZeige(); };
  document.getElementById("skReset").onclick = ev => { ev.preventDefault(); if(!confirm("Demo auf die Beispieldaten zurücksetzen?")) return;
    skBeispiel(); skSichern(); AS_RG.entwurf = null; history.replaceState(null, "", location.pathname); asZeige(); };
  window.addEventListener("hashchange", () => { if(SK.modus === "verwaltung") asZeige(); });
  asZeige();
}

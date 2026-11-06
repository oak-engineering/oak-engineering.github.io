/* OAK EHS-Cockpit – Testphase (Plan staged-inventing-blum C, 06.11.2026).
   Nur für Betriebe mit portal_kunde.rechte.testphase = true (Demo-Betriebe für die Sifa-Tests):
   - Hinweisband „Testphase – bitte nur Testdaten eingeben“ mit Knopf „Feedback an OAK“
   - Feedback-Abfrage: öffnet sich ab dem 3. Nutzungstag oder nach 30 Minuten aktiver Nutzung (Zähler je Nutzer in
     portal_nutzung_test), „Später“ = 2 Tage Ruhe, nach dem Absenden nicht erneut (außer über den Knopf).
     Bewertet werden nur die Seiten, die die Person geöffnet hat, plus „Bedienung allgemein“ und „Bedienungsanleitung“.
   - OAK-Ansicht „Feedback (Testphase)“: Durchschnitt je Funktion und Betrieb + Freitexte (portal_feedback).
   Der Zähler dient nur dem Zeitpunkt der Abfrage; jede Person sieht nur die eigene Zeile, OAK wertet nur das Feedback aus.
   Globale Namen mit asTp/AS_TP-Präfix. */
"use strict";

const AS_TP = { slug: null, rechte: null, zeile: null, gezeigt: false, aktiv: Date.now(), timer: null, laedt: null,
  extra: [["bedienung", "Bedienung allgemein"], ["anleitung", "Bedienungsanleitung"]] };
AS_ICON.feedback = '<path d="M4 5h16v11H9l-5 4z"/><path d="m12 7.6.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>';
const AS_TP_STERN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

function asTpAn(){ return !!(AS.kunde && AS_TP.slug === AS.kunde && AS_TP.rechte && AS_TP.rechte.testphase); }
function asTpHeute(){ return asHeute(); }
function asTpPlusTage(n){ const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

/* Rechte des aktuellen Betriebs (einmal je Betrieb) */
async function asTpRechte(){
  if(AS_TP.slug === AS.kunde && AS_TP.rechte) return;
  if(AS_TP.laedt && AS_TP.laedt.slug === AS.kunde) return AS_TP.laedt.p;
  const slug = AS.kunde;
  const p = apiGet("/rest/v1/portal_kunde?select=rechte&slug=eq." + encodeURIComponent(slug)).catch(() => [])
    .then(r => { if(AS.kunde !== slug) return; AS_TP.slug = slug; AS_TP.rechte = (r && r[0] && r[0].rechte) || {}; AS_TP.zeile = null; AS_TP.gezeigt = false; });
  AS_TP.laedt = { slug, p };
  return p;
}

/* Hinweisband zwischen Kopf und Inhalt (sticky unter dem Kopf) */
function asTpBand(){
  let b = document.getElementById("asTpBand");
  const an = asTpAn();
  document.body.classList.toggle("tp-an", an);
  if(!an){ if(b) b.remove(); return; }
  if(!b){
    b = document.createElement("div"); b.id = "asTpBand"; b.className = "tp-band nodruck";
    b.innerHTML = `<span class="tp-band-text"><b>Testphase</b><span class="tp-lang"> – bitte nur Testdaten eingeben, keine echten Personen- oder Firmendaten</span><span class="tp-kurz"> – nur Testdaten</span></span>
      <button type="button" class="tp-band-knopf" id="asTpKnopf">${asIcon("feedback")}<span>Feedback an OAK</span></button>`;
    const rumpf = document.querySelector("#appView .rumpf"); if(rumpf) rumpf.parentNode.insertBefore(b, rumpf);
    b.querySelector("#asTpKnopf").onclick = () => asTpDialog(false);
  }
}

/* ---------------- Nutzungszähler (nur Betriebskonten, nicht OAK) ---------------- */
function asTpZaehlt(){ return asTpAn() && !AS.admin && AS.uid; }
async function asTpZeileLaden(){
  if(AS_TP.zeile && AS_TP.zeile.kunde_slug === AS.kunde) return AS_TP.zeile;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  let z = ((await apiGet("/rest/v1/portal_nutzung_test?select=*&user_id=eq." + encodeURIComponent(AS.uid) + k).catch(() => [])) || [])[0];
  if(!z){
    z = { user_id: AS.uid, kunde_slug: AS.kunde, tage: 1, minuten: 0, erster_tag: asTpHeute(), letzter_tag: asTpHeute(), seiten: [] };
    await apiSend("POST", "/rest/v1/portal_nutzung_test", z, "return=minimal").catch(() => {});
  }
  AS_TP.zeile = z; return z;
}
async function asTpSpeichern(felder){
  const z = AS_TP.zeile; if(!z) return;
  Object.assign(z, felder);
  await apiSend("PATCH", "/rest/v1/portal_nutzung_test?user_id=eq." + encodeURIComponent(z.user_id) + "&kunde_slug=eq." + encodeURIComponent(z.kunde_slug),
    Object.assign({ geaendert_am: new Date().toISOString() }, felder), "return=minimal").catch(() => {});
}
/* neuer Tag + besuchte Seite */
async function asTpBesuch(){
  if(!asTpZaehlt()) return;
  const z = await asTpZeileLaden(), f = {};
  if(z.letzter_tag !== asTpHeute()){ f.tage = (z.tage || 0) + 1; f.letzter_tag = asTpHeute(); }
  const s = AS.seite;
  if(s && AS_SEITEN[s] && !(z.seiten || []).includes(s)) f.seiten = (z.seiten || []).concat(s);
  if(Object.keys(f).length) await asTpSpeichern(f);
  asTpPruefen();
}
/* aktive Minute: Fenster sichtbar und in den letzten 2 Minuten bedient */
async function asTpMinute(){
  if(!asTpZaehlt() || document.visibilityState !== "visible" || Date.now() - AS_TP.aktiv > 120000) return;
  const z = await asTpZeileLaden();
  const f = { minuten: (z.minuten || 0) + 1 };
  if(z.letzter_tag !== asTpHeute()){ f.tage = (z.tage || 0) + 1; f.letzter_tag = asTpHeute(); }
  await asTpSpeichern(f);
  asTpPruefen();
}
function asTpPruefen(){
  const z = AS_TP.zeile; if(!z || AS_TP.gezeigt || !asTpZaehlt()) return;
  if(z.feedback_am || (z.spaeter_bis && z.spaeter_bis > asTpHeute())) return;
  if((z.tage || 0) < 3 && (z.minuten || 0) < 30) return;
  const d = document.getElementById("dlg"); if(d && d.open) return;   // nie über einen offenen Dialog legen – beim nächsten Takt erneut
  AS_TP.gezeigt = true; asTpDialog(true);
}
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => window.addEventListener(ev, () => { AS_TP.aktiv = Date.now(); }, { passive: true }));

/* ---------------- Feedback-Abfrage ---------------- */
function asTpFunktionen(){
  const z = AS_TP.zeile || {}, liste = [];
  (z.seiten || []).forEach(k => { if(AS_SEITEN[k] && !AS_SEITEN[k].versteckt) liste.push([k, asSeitenTitel(k) || AS_SEITEN[k].titel || k]); });
  if(!liste.length && AS.seite && AS_SEITEN[AS.seite]) liste.push([AS.seite, asSeitenTitel(AS.seite)]);
  return liste.concat(AS_TP.extra);
}
async function asTpDialog(auto){
  if(asTpZaehlt()) await asTpZeileLaden();
  const zeilen = asTpFunktionen().map(([k, t]) => `<div class="tp-zeile" data-fn="${esc(k)}">
      <span class="tp-name" title="${esc(t)}">${esc(t)}</span>
      <span class="tp-sterne" role="radiogroup" aria-label="Bewertung ${esc(t)}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="tp-stern" data-n="${n}" aria-label="${n} von 5" title="${n} von 5">${AS_TP_STERN}</button>`).join("")}</span>
      <input class="tp-text" maxlength="500" placeholder="${innerWidth < 600 ? "Notiz" : "Anmerkung (optional)"}" aria-label="Anmerkung ${esc(t)}"></div>`).join("");
  const knoepfe = [];
  if(auto && asTpZaehlt()) knoepfe.push({ t: "Später", klasse: "sek", fn: async () => { await asTpSpeichern({ spaeter_bis: asTpPlusTage(2) }); asMeldung("Gern später – wir fragen in zwei Tagen noch einmal."); } });
  knoepfe.push({ t: "Absenden", fn: asTpSenden });
  const d = asDialog({ titel: "Feedback an OAK", inhalt: `<p class="tp-intro">Wie gut hilft Ihnen das Cockpit? Bewertung je Funktion freiwillig – 1 = schlecht, 5 = sehr gut.</p>
    <div class="tp-liste">${zeilen}</div>
    <label class="tp-gesamt">Gesamteindruck, Wünsche, Fehler<textarea id="asTpGesamt" rows="2" maxlength="4000" placeholder="Was fehlt, was stört, was gefällt?"></textarea></label>
    <p class="tp-forum">Lieber ausführlich mit Bildschirmfoto? <a href="#fragen" id="asTpForum">Frage an OAK</a> – dort antworten wir direkt.</p>`, knoepfe });
  d.classList.add("tp-dlg");
  if(auto && asTpZaehlt()) d.querySelector("[data-zu]").onclick = async () => { d.close(); await asTpSpeichern({ spaeter_bis: asTpPlusTage(2) }); };
  d.querySelector("#asTpForum").onclick = () => d.close();
  d.querySelectorAll(".tp-zeile").forEach(r => r.querySelectorAll(".tp-stern").forEach(b => b.onclick = () => {
    const n = +b.dataset.n, akt = +(r.dataset.note || 0), neu = akt === n ? 0 : n;   // gleicher Stern noch einmal = Bewertung zurücknehmen
    r.dataset.note = neu || "";
    r.querySelectorAll(".tp-stern").forEach(s => s.classList.toggle("an", +s.dataset.n <= neu));
  }));
}
async function asTpSenden(d){
  const name = AS.ich || "", rows = [];
  d.querySelectorAll(".tp-zeile").forEach(r => {
    const note = +(r.dataset.note || 0) || null, text = r.querySelector(".tp-text").value.trim() || null;
    if(note || text) rows.push({ kunde_slug: AS.kunde, nutzer_name: name, funktion: r.dataset.fn, note, text });
  });
  const ges = d.querySelector("#asTpGesamt").value.trim();
  if(ges) rows.push({ kunde_slug: AS.kunde, nutzer_name: name, funktion: "gesamt", note: null, text: ges });
  if(!rows.length){ asMeldung("Bitte mindestens eine Bewertung oder Anmerkung eintragen."); return false; }
  try{ await apiSend("POST", "/rest/v1/portal_feedback", rows, "return=minimal"); }
  catch(e){
    if(window.OAK_FEHLER) window.OAK_FEHLER("cockpit-feedback", String(e.message || e), { zeilen: rows });   // Daten nicht verlieren
    asMeldung("Senden hat nicht geklappt – OAK ist informiert und hat Ihre Angaben."); return;
  }
  if(asTpZaehlt()) await asTpSpeichern({ feedback_am: new Date().toISOString() });
  asMeldung("Danke! Ihr Feedback ist bei OAK angekommen.");
}

/* ---------------- OAK-Ansicht ---------------- */
function asTpTitel(k){
  if(k === "gesamt") return "Gesamteindruck";
  const e = AS_TP.extra.find(x => x[0] === k); if(e) return e[1];
  const s = AS_SEITEN[k]; return s ? (s.titelKunde || AS_TITEL_KUNDE[k] || s.titel) : k;
}
AS_SEITEN.feedback = { titel: "Feedback (Testphase)", icon: "?", sort: 9.7, get versteckt(){ return !asDarf("oak"); }, async render(main){
  if(!asDarf("oak")){ main.innerHTML = `<div class="leer">Nur für OAK.</div>`; return; }
  main.innerHTML = `<h1 class="seite">Feedback (Testphase)</h1><p class="unter">wird geladen …</p>`;
  const [fb, kunden] = await Promise.all([
    apiGet("/rest/v1/portal_feedback?select=*&order=erstellt_am.desc&limit=5000").catch(() => []),
    apiGet("/rest/v1/as_organisation?select=kunde_slug,name").catch(() => [])]);
  const kname = s => (kunden.find(k => k.kunde_slug === s) || {}).name || s;
  const betriebe = [...new Set((fb || []).map(x => x.kunde_slug))].sort();
  const funktionen = [...new Set((fb || []).filter(x => x.note).map(x => x.funktion))].sort((a, b) => asTpTitel(a).localeCompare(asTpTitel(b), "de"));
  const schnitt = l => { const n = l.filter(x => x.note); return n.length ? (n.reduce((s, x) => s + x.note, 0) / n.length) : null; };
  const zelle = l => { const s = schnitt(l), n = l.filter(x => x.note).length;
    return s == null ? `<td class="tp-zahl">–</td>` : `<td class="tp-zahl"><span class="chip c-${s >= 4 ? "gruen" : s >= 3 ? "gelb" : "rot"}">Ø ${s.toFixed(1).replace(".", ",")}</span> <small>(${n})</small></td>`; };
  const tab = funktionen.length ? `<div class="tp-scroll"><table class="tab"><thead><tr><th>Funktion</th><th>alle</th>${betriebe.map(b => `<th>${esc(kname(b))}</th>`).join("")}</tr></thead><tbody>
      ${funktionen.map(f => { const l = fb.filter(x => x.funktion === f); return `<tr><td>${esc(asTpTitel(f))}</td>${zelle(l)}${betriebe.map(b => zelle(l.filter(x => x.kunde_slug === b))).join("")}</tr>`; }).join("")}
    </tbody></table></div>` : `<div class="leer">Noch keine Bewertungen.</div>`;
  const texte = (fb || []).filter(x => x.text);
  main.innerHTML = `<h1 class="seite">Feedback (Testphase)</h1><p class="unter">Bewertungen der Testbetriebe je Funktion (1 = schlecht, 5 = sehr gut) und alle Anmerkungen.</p>
    <div class="karte"><h2>Durchschnitt je Funktion und Betrieb</h2>${tab}</div>
    <div class="karte"><h2>Anmerkungen <span>${texte.length}</span></h2>${texte.length ? `<div class="tp-scroll"><table class="tab"><thead><tr><th>Datum</th><th>Betrieb</th><th>Funktion</th><th>Note</th><th>Anmerkung</th><th>von</th></tr></thead><tbody>
      ${texte.map(x => `<tr><td>${asDat(x.erstellt_am)}</td><td>${esc(kname(x.kunde_slug))}</td><td>${esc(asTpTitel(x.funktion))}</td><td>${x.note || "–"}</td><td>${esc(x.text)}</td><td>${esc(x.nutzer_name || "")}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="leer">Noch keine Anmerkungen.</div>`}</div>`;
}};

/* ---------------- Einhängen: nach jedem Seitenaufbau (asZeige) Band, Besuch, Zähler ---------------- */
const AS_TP_ZEIGE = asZeige;
asZeige = function(){
  AS_TP_ZEIGE.apply(this, arguments);
  asTpRechte().then(() => { asTpBand(); asTpBesuch(); asTpNavKnopf(); });
  if(!AS_TP.timer) AS_TP.timer = setInterval(asTpMinute, 60000);
};
/* Menü: Eintrag „Feedback an OAK“ im Fuß der Seitenleiste (und im „Mehr“-Blatt am Handy) */
const AS_TP_NAVFUSS = asNavFuss;
asNavFuss = function(extra){
  const k = asTpAn() ? `<button type="button" class="sl-eintrag" data-sl="feedback" title="Feedback an OAK">${asIcon("feedback")}<span>Feedback an OAK</span></button>` : "";
  return AS_TP_NAVFUSS.call(this, (extra || "") + k);
};
const AS_TP_NAVAKTION = asNavAktion;
asNavAktion = function(was){
  if(was === "feedback"){ const hg = document.getElementById("blattHg"); if(hg) hg.classList.remove("zeig"); return asTpDialog(false); }
  return AS_TP_NAVAKTION.apply(this, arguments);
};
/* Rechte kommen asynchron – Menü einmal neu zeichnen, sobald die Testphase bekannt ist */
function asTpNavKnopf(){
  const n = document.getElementById("nav"); if(!n) return;
  const hat = !!n.querySelector('[data-sl="feedback"]');
  if(hat !== asTpAn()) asNav();
}

/* OAK Arbeitsschutz-App – App-Ebene: Kundenmarke, Startseite mit Schnellzugriffen (Schichtführer-Ansicht),
   Name beim gemeinsamen Zugang, untere Leiste fürs Handy, Installation als App.
   Gleiche Daten wie das Kundenportal: Marke aus portal_kunde.marke, Schnellzugriffe in
   portal_nutzer_einstellung.daten.schnellzugriffe (dieselben Kennungen – eine Auswahl gilt in beiden Apps),
   Name im Gerät unter „oak_mein_name“. */
"use strict";

/* ---------------- Kundenmarke ---------------- */
function asMarkePruefen(m){
  const farbe = v => typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null;
  const logo = v => typeof v === "string" && /^(marken\/[\w.-]+|https:\/\/[\w.\/%-]+)$/.test(v) ? v : null;
  m = m || {}; return { farbe: farbe(m.farbe), tief: farbe(m.farbe_tief), akzent: farbe(m.akzent), logo: logo(m.logo) };
}
function asMarkeAnwenden(){
  const m = asMarkePruefen(AS.kundeV1 && AS.kundeV1.marke), st = document.documentElement.style;
  const setz = (k, v) => { if(v) st.setProperty(k, v); else st.removeProperty(k); };
  setz("--blau", m.farbe); setz("--blau2", m.akzent);
  let meta = document.querySelector('meta[name="theme-color"]');
  if(!meta){ meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
  meta.content = m.farbe || "#2D6A4F";
  const marke = document.getElementById("kopfLogo"); if(!marke) return;
  let img = document.getElementById("asKundeLogo");
  if(m.logo){
    if(!img){ img = document.createElement("img"); img.id = "asKundeLogo"; marke.appendChild(img); }
    img.src = /^https:/.test(m.logo) ? m.logo : "../portal/" + m.logo; img.alt = (AS.kundeV1 && AS.kundeV1.name) || ""; img.hidden = false;
  } else if(img) img.hidden = true;
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
    AS.alsBetrieb = true; AS.admin = false; AS.fachkraft = false;
    const b = document.createElement("div"); b.className = "nodruck";
    b.style.cssText = "position:fixed;bottom:70px;right:14px;z-index:40;background:#b7791f;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px";
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

/* ======================= Start ======================= */
AS_SEITEN.start = { titel: "Start", icon: "⌂", sort: 0.5, async render(main){
  main.innerHTML = `<h1 class="seite">Guten Tag${AS.ich ? ", " + esc(AS.ich.split(" ")[0]) : ""}</h1><p class="unter">${esc(AS.org ? AS.org.name : "")}</p><div class="leer">wird geladen …</div>`;
  await asSkLaden();
  if(typeof asBetriebLaden === "function") await asBetriebLaden().catch(() => {});
  const fae = await apiGet("/rest/v1/v_uw_faelligkeit?select=person_id,status&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => []);
  const uwFaellig = new Set((fae || []).filter(f => f.status === "ueberfaellig" || f.status === "erstunterweisung").map(f => f.person_id)).size;
  const gefahr = typeof asAnlagen === "function" ? asAnlagen().filter(d => asAnlagenBand(d.maschinen_id) === "gefahr").length : 0;
  const vorf = asT("as_meldung").filter(m => m._v1 && m.status !== "erledigt").length;
  const offenM = asT("as_massnahme").filter(m => m.status === "offen").length;
  const zeichnen = () => {
    const liste = asSkAuswahl();
    const kachel = (id, i) => { const k = AS_SK_KATALOG[id];
      return AS_SK.edit ? `<div class="kachel"><div class="lbl">${esc(k[1])}</div><div class="hinweis">${esc(k[2])}</div>
          <div class="reihe" style="gap:4px;margin-top:6px"><button class="btn sek klein" data-sk="links" data-i="${i}" ${i === 0 ? "disabled" : ""}>←</button>
          <button class="btn sek klein" data-sk="rechts" data-i="${i}" ${i === liste.length - 1 ? "disabled" : ""}>→</button>
          <button class="btn sek klein" data-sk="weg" data-i="${i}">entfernen</button></div></div>`
        : `<div class="kachel k-gruen" data-geh="${esc(id)}" style="cursor:pointer"><div class="zahl" style="font-size:18px">${esc(k[1])}</div><div class="hinweis">${esc(k[2])}</div></div>`; };
    main.innerHTML = `<h1 class="seite">Guten Tag${AS.ich ? ", " + esc(AS.ich.split(" ")[0]) : ""}</h1><p class="unter">${esc(AS.org ? AS.org.name : "")}</p>
      <div class="karte"><h2>Schnellzugriffe <span>${AS_SK.edit ? `<button class="btn sek klein" id="skStd">Standard</button> <button class="btn klein" id="skFertig">Fertig</button>` : `<button class="btn sek klein" id="skAnp">Anpassen</button>`}</span></h2>
        <div class="kacheln">${liste.map(kachel).join("")}${AS_SK.edit ? `<div class="kachel" id="skNeu" style="cursor:pointer"><div class="zahl">+</div><div class="hinweis">Schnellzugriff hinzufügen</div></div>` : ""}</div></div>
      <div class="karte"><h2>Auf einen Blick</h2><div class="kacheln">
        <div class="kachel k-${gefahr ? "rot" : "gruen"}" data-ziel="anlagen" style="cursor:pointer"><div class="lbl">Anlagen im Gefahrbereich</div><div class="zahl">${gefahr}</div></div>
        <div class="kachel k-${vorf ? "gelb" : "gruen"}" data-ziel="steuerung/meldungen" style="cursor:pointer"><div class="lbl">Offene Vorfälle</div><div class="zahl">${vorf}</div></div>
        <div class="kachel k-${uwFaellig ? "gelb" : "gruen"}" data-ziel="unterweisungen" style="cursor:pointer"><div class="lbl">Unterweisungen fällig</div><div class="zahl">${uwFaellig}</div><div class="hinweis">Personen</div></div>
        <div class="kachel k-${offenM ? "gelb" : "gruen"}" data-ziel="massnahmen" style="cursor:pointer"><div class="lbl">Offene Maßnahmen</div><div class="zahl">${offenM}</div></div></div></div>
      <div class="karte" id="asInstall" hidden><h2>Als App installieren</h2><p>Die App startet dann ohne Browserleiste, wie ein Programm – am PC und am Handy.</p><button class="btn" id="asInstallKnopf">Jetzt installieren</button></div>`;
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
      const d = asDialog({ titel: "Schnellzugriff hinzufügen", inhalt: `<div class="zeilen">${frei.map(id => `<div class="z" data-neu="${esc(id)}" style="cursor:pointer"><div><b>${esc(AS_SK_KATALOG[id][1])}</b><small>${esc(AS_SK_KATALOG[id][2])}</small></div></div>`).join("") || `<div class="leer">Alle sind schon da.</div>`}</div>` });
      d.querySelectorAll("[data-neu]").forEach(z => z.onclick = async () => { await asSkSetzen(asSkAuswahl().concat([z.dataset.neu])); d.close(); zeichnen(); }); };
    asInstallZeigen();
  };
  zeichnen();
}};

/* ---------------- Installation als App + untere Leiste ---------------- */
let AS_INSTALL = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); AS_INSTALL = e; asInstallZeigen(); });
function asInstallZeigen(){
  const k = document.getElementById("asInstall"); if(!k) return;
  k.hidden = !AS_INSTALL;
  const b = document.getElementById("asInstallKnopf"); if(b) b.onclick = async () => { if(!AS_INSTALL) return; AS_INSTALL.prompt(); await AS_INSTALL.userChoice.catch(() => {}); AS_INSTALL = null; asInstallZeigen(); };
}
if("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
function asUnterleiste(){
  const u = document.querySelector(".unterleiste"); if(!u || u.dataset.fertig) return;
  u.dataset.fertig = "1"; u.style.display = ""; u.classList.add("as-leiste");
  const s = document.createElement("style");
  s.textContent = "@media (max-width:900px){.unterleiste.as-leiste{display:flex!important;gap:8px}.unterleiste.as-leiste button{flex:1;width:auto}"
    + "#menueTitel{display:none}#menueKnopf::after{content:'Mehr'}}";
  document.head.appendChild(s);
  const knopf = (txt, ziel) => { const b = document.createElement("button"); b.textContent = txt; b.onclick = () => asGehe(ziel); return b; };
  u.insertBefore(knopf("Melden", "vorort/melden"), u.firstChild);
  u.insertBefore(knopf("Start", "start"), u.firstChild);
}
document.addEventListener("DOMContentLoaded", asUnterleiste);

/* ---------------- Betriebskonten: Management-Werkzeuge der Fachkraft ausblenden (wie V1 „Erweiterte Funktionen“) ---------------- */
["check", "prozesse", "bericht"].forEach(k => { if(AS_SEITEN[k]) AS_SEITEN[k].nurFachkraft = true; });

/* ---------------- Passwort ändern (nicht beim gemeinsamen Schichtführer-Zugang, wie V1) ---------------- */
function asPasswortKnopf(){
  const ich = document.querySelector(".kopf .ich"); if(!ich || document.getElementById("asPw") || /^Schichtf/i.test(AS.kontoName || AS.ich || "")) return;
  const b = document.createElement("button"); b.className = "link"; b.id = "asPw"; b.textContent = "Passwort ändern";
  ich.insertBefore(b, document.getElementById("abmelden"));
  b.onclick = () => asDialog({ titel: "Passwort ändern", inhalt: `<div class="form">${asFeld("Neues Passwort (mindestens 8 Zeichen)", "p1", "", "password", "voll")}${asFeld("Wiederholen", "p2", "", "password", "voll")}</div>`,
    knoepfe: [{ t: "Speichern", fn: async d => { const w = asWerte(d);
      if(!w.p1 || w.p1.length < 8){ asMeldung("Mindestens 8 Zeichen."); return false; }
      if(w.p1 !== w.p2){ asMeldung("Die Eingaben stimmen nicht überein."); return false; }
      try{ await passwortAendern(w.p1); asMeldung("Passwort geändert – gilt ab sofort."); }
      catch(e){ asMeldung(e && e.message === "AUTH" ? "Sitzung abgelaufen – bitte neu anmelden." : "Fehlgeschlagen: " + ((e && e.message) || e)); return false; } } }] });
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
        const b = document.createElement("div"); b.className = "nodruck";
        b.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:60;background:#e8a800;color:#1d2733;padding:8px 14px;display:flex;gap:12px;align-items:center;justify-content:center";
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

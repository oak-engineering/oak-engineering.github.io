/* ======================= Assistent =======================
   Beantwortet Fragen zu Maschinen, Schulungen und Rechtsquellen und sortiert Eingaben samt Anhängen direkt ein
   (Unterlagen, Mängel, Termine, Vorfälle). Edge Function oak-ki, Funktion „assistent“. Anhänge liegen unter <kunde>/assistent/.
   Datenschutz (Stufe 17, 07.11.2026): Die KI ist optional und je Betrieb schaltbar (as_ki_einstellung, Standard AUS).
   Namen, E-Mail-Adressen und Telefonnummern ersetzt die Edge Function vor dem Senden durch Platzhalter; was gesendet wurde,
   steht 90 Tage in as_ki_protokoll („Was wurde an die KI gesendet?“). Ohne KI läuft das Cockpit unverändert. */
const AS_KI = { verlauf: [], anhaenge: [], laeuft: false, einst: null };
const AS_KI_MAX_MB = 20;
const AS_KI_ARTEN = { person: "Personen", email: "E-Mail", telefon: "Telefon", personalnr: "Personalnr." };

(function asKiStil(){
  if(document.getElementById("asKiStil")) return;
  const s = document.createElement("style"); s.id = "asKiStil";
  s.textContent = `.ki-hinweis{display:flex;align-items:center;gap:8px;min-width:0;margin:0;padding:8px 12px;font-size:13px;color:var(--grau);background:#fff;border:1px solid var(--linie);border-radius:8px}
.ki-hinweis span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ki-hinweis button{flex:none;border:0;background:none;color:var(--blau);font:inherit;font-weight:500;cursor:pointer;padding:0;text-decoration:underline}
.ki-aus{display:flex;flex-direction:column;gap:12px;align-items:flex-start;max-width:none}
.ki-aus p{margin:0;text-align:left}
.ki-prot{display:flex;flex-direction:column;gap:6px;margin:6px 0 0}
.ki-prot button{display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--linie);border-radius:8px;background:#fff;padding:8px 10px;font:inherit;font-size:13px;cursor:pointer;min-width:0}
.ki-prot button span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ki-prot small{color:var(--grau);white-space:nowrap}
.ki-roh{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;background:var(--bg);border:1px solid var(--linie);border-radius:8px;padding:8px;margin:4px 0 10px;max-height:240px;overflow:auto}
.ki-text p{margin:0 0 8px;text-align:left}
.ki-kurz{display:none}
@media(max-width:820px){.ki-prot button{grid-template-columns:1fr;gap:2px}.ki-lang{display:none}.ki-kurz{display:block}}`;
  document.head.appendChild(s);
})();

async function asKiEinstLaden(){
  const [e] = await apiGet("/rest/v1/as_ki_einstellung?select=aktiv,fotos_erlaubt,hinweis,token_limit_monat,avv_bestaetigt_am&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => []) || [];
  AS_KI.einst = Object.assign({ aktiv: false, fotos_erlaubt: false, hinweis: "" }, e || {}, { kunde: AS.kunde });
  return AS_KI.einst;
}
async function asKiEinstSetzen(aktiv, fotos){
  const r = await apiSend("POST", "/rest/v1/rpc/as_ki_einstellung_setzen", { p_kunde: AS.kunde, p_aktiv: aktiv, p_fotos: fotos });
  AS_KI.einst = Object.assign({}, AS_KI.einst, r || {}, { kunde: AS.kunde });
}

/* Transparenz: was die KI bekommt, wer sie betreibt, was protokolliert wird – knapp, keine Rechtsberatung */
function asKiDetailText(){
  const e = AS_KI.einst || {};
  return `<div class="ki-text">
    <p><b>Anbieter:</b> Anthropic (Claude) als Unterauftragsverarbeiter von OAK engineering. Genutzt wird der kommerzielle API-Zugang: Anthropic trainiert nicht mit euren Inhalten.</p>
    <p><b>Namen bleiben im Cockpit:</b> Vor dem Senden ersetzt das Cockpit Namen von Beschäftigten, E-Mail-Adressen, Telefon- und Personalnummern durch Platzhalter wie [Person 1]. Erst die Antwort zeigt wieder die echten Namen.</p>
    <p><b>Keine Gesundheitsdaten:</b> Vorsorge, Befunde, Verletzungen und Krankheitstage gibt das Cockpit nie an die KI. Bitte auch selbst keine eintippen.</p>
    <p><b>Fotos und Anhänge:</b> ${e.fotos_erlaubt ? "erlaubt – bitte nur Anlagen und Befunde fotografieren, keine Personen oder Gesichter." : "gehen nicht an die KI; der Assistent kennt nur den Dateinamen."}</p>
    <p><b>Protokoll:</b> Jede Anfrage steht 90 Tage in der Liste unten, so wie sie gesendet wurde (mit Platzhaltern).</p>
    <p><b>Ohne KI:</b> Alle Funktionen des Cockpits arbeiten auch ohne den Assistenten.</p>
    ${e.hinweis ? `<p><b>Hinweis des Betriebs:</b> ${esc(e.hinweis)}</p>` : ""}</div>`;
}
async function asKiProtokollListe(){
  const zeilen = await apiGet("/rest/v1/as_ki_protokoll?select=id,erstellt_am,funktion,gesendet,werkzeuge,ersetzt,anhaenge,modell,eingabe_tokens,ausgabe_tokens&kunde_slug=eq."
    + encodeURIComponent(AS.kunde) + "&order=erstellt_am.desc&limit=40").catch(() => []) || [];
  AS_KI.prot = zeilen;
  if(!zeilen.length) return `<p class="leer">Noch nichts gesendet.</p>`;
  return `<div class="ki-prot">${zeilen.map((z, i) => {
    const n = Object.entries(z.ersetzt || {}).filter(([, v]) => v).map(([k, v]) => v + " " + (AS_KI_ARTEN[k] || k)).join(", ");
    const t = new Date(z.erstellt_am);
    return `<button data-prot="${i}" title="${esc(z.gesendet || "")}"><small>${asDat(z.erstellt_am)} ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}</small>`
      + `<span>${esc((z.gesendet || "").replace(/^EINGABE: |^AUFGABE: /, ""))}</span><small>${esc(n ? "ersetzt: " + n : "nichts ersetzt")}</small></button>`; }).join("")}</div>`;
}
function asKiProtokollEintrag(z){
  const n = Object.entries(z.ersetzt || {}).map(([k, v]) => (AS_KI_ARTEN[k] || k) + ": " + v).join(" · ");
  asDialog({ titel: "Gesendet am " + asDat(z.erstellt_am), breit: true, inhalt:
    `<p class="unter">So ist die Anfrage bei der KI angekommen. Ersetzt: ${esc(n || "nichts")} · Fotos/Anhänge: ${z.anhaenge || 0}</p>
     <h3>Eingabe</h3><div class="ki-roh">${esc(z.gesendet || "")}</div>
     ${(z.werkzeuge || []).map(w => `<h3>${esc(w.name === "betriebsdaten" ? "Betriebsdaten (Auszug)" : "Nachgeschlagen: " + w.name)}</h3>
       <div class="ki-roh">${esc((w.eingabe ? JSON.stringify(w.eingabe) + "\n" : "") + (w.ergebnis || w.fehler || ""))}</div>`).join("")}`,
    knoepfe: [{ t: "Zurück", klasse: "sek", fn: () => { asKiDetails(); return false; } }] });
}
/* Details-Dialog: Transparenz, Einstellungen (Fachkraft/GF), Protokoll */
async function asKiDetails(){
  const e = AS_KI.einst || await asKiEinstLaden(), darf = asDarf("pflegen");
  const d = asDialog({ titel: "KI-Assistent und Datenschutz", breit: true, inhalt: asKiDetailText()
    + (darf ? `<h3>Einstellungen für diesen Betrieb</h3>${asFeld("KI-Assistent eingeschaltet", "aktiv", e.aktiv, "checkbox")}${asFeld("Fotos und Anhänge an die KI geben", "fotos", e.fotos_erlaubt, "checkbox")}` : "")
    + `<h3>Was wurde an die KI gesendet?</h3><div id="kiProt"><p class="leer">Wird geladen …</p></div>`,
    knoepfe: darf ? [{ t: "Einstellungen speichern", fn: async dlg => { const w = asWerte(dlg); await asKiEinstSetzen(!!w.aktiv, !!w.fotos);
      asMeldung(w.aktiv ? "KI-Assistent eingeschaltet" : "KI-Assistent ausgeschaltet"); asZeige(); } }] : [] });
  const box = d.querySelector("#kiProt");
  box.innerHTML = await asKiProtokollListe();
  box.querySelectorAll("[data-prot]").forEach(b => b.onclick = () => asKiProtokollEintrag(AS_KI.prot[+b.dataset.prot]));
}
function asKiEinschalten(){
  asDialog({ titel: "KI-Assistent einschalten", inhalt: asKiDetailText()
      + `<p class="unter">Mit dem Einschalten bestätigt ihr, dass der Auftragsverarbeitungsvertrag mit OAK engineering den KI-Einsatz abdeckt.</p>`
      + asFeld("Fotos und Anhänge an die KI geben", "fotos", false, "checkbox"),
    knoepfe: [{ t: "Abbrechen", klasse: "sek", fn: () => true },
      { t: "Einschalten", fn: async dlg => { await asKiEinstSetzen(true, !!asWerte(dlg).fotos); asMeldung("KI-Assistent eingeschaltet"); asZeige(); } }] });
}

function asKiZeile(z){
  return `<div class="ki-b${z.rolle === "ich" ? " ich" : ""}">${esc(z.text)}${z.datei && z.datei.length ? `<small>${z.datei.map(esc).join(" · ")}</small>` : ""}${z.ablage && z.ablage.length ? `<div class="ki-ablage">${z.ablage.map(a => `<a href="#${esc(a.seite)}">${asChip(a.art + " abgelegt", "gruen")}</a>`).join("")}</div>` : ""}${z.quellen && z.quellen.length ? `<small>Quellen: ${z.quellen.map(esc).join(" · ")}</small>` : ""}</div>`;
}
function asKiZeichnen(box){
  const v = box.querySelector("#kiVerlauf");
  v.innerHTML = AS_KI.verlauf.map(asKiZeile).join("") + (AS_KI.laeuft ? `<div class="ki-b">Arbeitet …</div>` : "") || `<div class="leer">Frag nach Maschinen, Schulungen oder Rechtsquellen. Mängel, Termine, Vorfälle und Dateien sortiert der Assistent selbst ein.</div>`;
  v.scrollTop = v.scrollHeight;
  box.querySelector("#kiAnh").innerHTML = AS_KI.anhaenge.map(f => asChip(f.name.length > 28 ? f.name.slice(0, 26) + " …" : f.name, "blau")).join("");
  box.querySelector("#kiSenden").disabled = AS_KI.laeuft;
}
async function asKiHochladen(f){
  const name = f.name.normalize("NFKD").replace(/[^\w.-]+/g, "_"), pfad = AS.kunde + "/assistent/" + Date.now() + "-" + name;
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad, { method: "POST", headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": f.type || "application/octet-stream" }, body: f });
  if(!r.ok) throw new Error("Anhang konnte nicht hochgeladen werden (" + r.status + ")");
  return pfad;
}
async function asKiSenden(box){
  const feld = box.querySelector("#kiText"), text = feld.value.trim(), dateien = AS_KI.anhaenge.slice();
  if(AS_KI.laeuft || (!text && !dateien.length)) return;
  AS_KI.laeuft = true; AS_KI.verlauf.push({ rolle: "ich", text: text || "Bitte einsortieren.", datei: dateien.map(f => f.name) }); asKiZeichnen(box);
  try{
    const pfade = []; for(const f of dateien) pfade.push(await asKiHochladen(f));
    const frueher = AS_KI.verlauf.slice(0, -1).map(z => ({ rolle: z.rolle, text: z.text }));
    const r = await fetch(CFG.url + "/functions/v1/oak-ki", { method: "POST", headers: { Authorization: "Bearer " + (await token()), apikey: CFG.anon, "Content-Type": "application/json" },
      body: JSON.stringify({ kunde: AS.kunde, funktion: "assistent", text: text || "Bitte die Anhänge einsortieren.", anhaenge: pfade, verlauf: frueher, ich: AS.ich }) });
    const j = await r.json().catch(() => ({}));
    if(r.status === 403 && j.aus){ AS_KI.einst = null; AS_KI.laeuft = false; asZeige(); return; }   // inzwischen ausgeschaltet
    if(!r.ok){ if(j.ablage && j.ablage.length) AS_KI.verlauf.push({ rolle: "ki", text: "Abgelegt, Antwort fehlgeschlagen.", ablage: j.ablage }); throw new Error(j.fehler || "Assistent nicht erreichbar."); }
    AS_KI.verlauf.push({ rolle: "ki", text: j.antwort, quellen: j.quellen, ablage: j.ablage });
    feld.value = ""; AS_KI.anhaenge = [];
  }catch(e){
    AS_KI.verlauf.push({ rolle: "ki", text: e.message + " Eingabe und Anhänge bleiben hier stehen." });
    feld.value = text;
    if(window.OAK_FEHLER && !/nicht eingerichtet|nicht eingeschaltet|Monatslimit/.test(e.message)) window.OAK_FEHLER("assistent", e.message, { anhaenge: dateien.map(f => f.name) });
  }
  AS_KI.laeuft = false; asKiZeichnen(box);
}

/* Ein Bildschirm: Höhe = sichtbare Höhe ab Oberkante (Hinweisband/Testphase-Band verschieben sie), die Seite selbst scrollt nie */
function asKiHoehe(){
  const w = document.querySelector("#haupt .ki-seite"), main = document.getElementById("haupt"); if(!w || !main) return;
  w.style.marginBottom = "0";
  const unten = parseFloat(getComputedStyle(main).paddingBottom) || 0;
  const h = window.innerHeight - (w.getBoundingClientRect().top + window.scrollY) - unten;
  w.style.height = Math.max(320, Math.floor(h)) + "px";
  const ueber = document.documentElement.scrollHeight - window.innerHeight;
  if(ueber > 0 && h - ueber >= 320) w.style.height = Math.floor(h - ueber) + "px";
  if(!asKiHoehe.an){ asKiHoehe.an = true; window.addEventListener("resize", () => { clearTimeout(asKiHoehe.t); asKiHoehe.t = setTimeout(asKiHoehe, 120); }); }
}

AS_SEITEN.assistent = { titel: "Assistent", icon: "?", sort: 1.2, async render(main){
  const e = (AS_KI.einst && AS_KI.einst.kunde === AS.kunde) ? AS_KI.einst : await asKiEinstLaden();
  if(!e.aktiv){
    // KI aus: kein Aufruf, nur der Hinweis – alle übrigen Funktionen laufen unverändert
    main.innerHTML = `<div class="karte ki-aus" id="kiAus"><h2>KI-Assistent ausgeschaltet</h2>
      <p>Für diesen Betrieb ist der KI-Assistent ausgeschaltet. Alle Funktionen des Cockpits arbeiten ohne KI: Anlagen, Beurteilungen, Mängel, Prüfungen, Unterweisungen und Kalender bedienst du wie gewohnt über das Menü.</p>
      <p>${asDarf("pflegen") ? "Ihr könnt den Assistenten jederzeit einschalten. Namen werden vor dem Senden ersetzt, jede Anfrage wird protokolliert." : "Einschalten kann die Fachkraft oder die Geschäftsführung."}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${asDarf("pflegen") ? `<button class="btn" id="kiEin">KI-Assistent einschalten …</button>` : ""}<button class="btn sek" id="kiInfo">Datenschutz und Protokoll</button></div></div>`;
    const ein = main.querySelector("#kiEin"); if(ein) ein.onclick = asKiEinschalten;
    main.querySelector("#kiInfo").onclick = asKiDetails;
    return;
  }
  main.innerHTML = `<div class="ki-seite"><div class="ki-hinweis" id="kiHinweis"><span class="ki-lang">KI von Anthropic · Namen werden vor dem Senden ersetzt · jede Anfrage im Protokoll${e.fotos_erlaubt ? " · Fotos: keine Personen" : " · Fotos gehen nicht an die KI"}</span><span class="ki-kurz">KI · Namen werden ersetzt · Protokoll</span><button id="kiDetails">Details</button></div>
    <div class="karte ki-verlauf" id="kiVerlauf"></div>
    <div class="karte ki-eingabe"><div class="ki-anh" id="kiAnh"></div>
      <label class="btn sek klein">Anhang<input type="file" id="kiDatei" multiple hidden></label>
      <textarea id="kiText" aria-label="Eingabe an den Assistenten" placeholder="Frage oder Sachverhalt …"></textarea>
      <button class="btn klein" id="kiSenden">Senden</button></div></div>`;
  const box = main;
  box.querySelector("#kiDetails").onclick = asKiDetails;
  box.querySelector("#kiDatei").onchange = ev => { for(const f of ev.target.files){ if(f.size > AS_KI_MAX_MB * 1048576) asMeldung(f.name + " ist größer als " + AS_KI_MAX_MB + " MB"); else AS_KI.anhaenge.push(f); } AS_KI.anhaenge = AS_KI.anhaenge.slice(0, 5); ev.target.value = ""; asKiZeichnen(box); };
  box.querySelector("#kiSenden").onclick = () => asKiSenden(box);
  box.querySelector("#kiText").onkeydown = ev => { if(ev.key === "Enter" && !ev.shiftKey){ ev.preventDefault(); asKiSenden(box); } };
  asKiZeichnen(box);
  asKiHoehe(); setTimeout(asKiHoehe, 400); setTimeout(asKiHoehe, 1500);
} };

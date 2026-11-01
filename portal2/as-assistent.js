/* ======================= Assistent =======================
   Beantwortet Fragen zu Maschinen, Schulungen und Rechtsquellen und sortiert Eingaben samt Anhängen direkt ein
   (Unterlagen, Mängel, Termine, Vorfälle). Edge Function oak-ki, Funktion „assistent“. Anhänge liegen unter <kunde>/assistent/. */
const AS_KI = { verlauf: [], anhaenge: [], laeuft: false };
const AS_KI_MAX_MB = 20;

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
    if(!r.ok){ if(j.ablage && j.ablage.length) AS_KI.verlauf.push({ rolle: "ki", text: "Abgelegt, Antwort fehlgeschlagen.", ablage: j.ablage }); throw new Error(j.fehler || "Assistent nicht erreichbar."); }
    AS_KI.verlauf.push({ rolle: "ki", text: j.antwort, quellen: j.quellen, ablage: j.ablage });
    feld.value = ""; AS_KI.anhaenge = [];
  }catch(e){
    AS_KI.verlauf.push({ rolle: "ki", text: e.message + " Eingabe und Anhänge bleiben hier stehen." });
    feld.value = text;
    if(window.OAK_FEHLER && !/nicht eingerichtet|nicht eingeschaltet/.test(e.message)) window.OAK_FEHLER("assistent", e.message, { anhaenge: dateien.map(f => f.name) });
  }
  AS_KI.laeuft = false; asKiZeichnen(box);
}

AS_SEITEN.assistent = { titel: "Assistent", icon: "?", sort: 1.2, async render(main){
  main.innerHTML = `<div class="ki-seite"><div class="karte ki-verlauf" id="kiVerlauf"></div>
    <div class="karte ki-eingabe"><div class="ki-anh" id="kiAnh"></div>
      <label class="btn sek klein">Anhang<input type="file" id="kiDatei" multiple hidden></label>
      <textarea id="kiText" aria-label="Eingabe an den Assistenten" placeholder="Frage oder Sachverhalt …"></textarea>
      <button class="btn klein" id="kiSenden">Senden</button></div></div>`;
  const box = main;
  box.querySelector("#kiDatei").onchange = e => { for(const f of e.target.files){ if(f.size > AS_KI_MAX_MB * 1048576) asMeldung(f.name + " ist größer als " + AS_KI_MAX_MB + " MB"); else AS_KI.anhaenge.push(f); } AS_KI.anhaenge = AS_KI.anhaenge.slice(0, 5); e.target.value = ""; asKiZeichnen(box); };
  box.querySelector("#kiSenden").onclick = () => asKiSenden(box);
  box.querySelector("#kiText").onkeydown = e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); asKiSenden(box); } };
  asKiZeichnen(box);
} };

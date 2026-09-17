/* OAK EHS-Cockpit — gemeinsame Helfer für Kalender, Nachweise, Vorsorge, Gefahrstoffe, Aufgaben und Forum (17.09.2026).
   Name bei gemeinsamem Zugang: Schichtführer teilen sich einen Login – wer etwas erledigt oder quittiert,
   trägt seinen Namen ein (wird im Gerät gemerkt). */
"use strict";

const EHS_NAME_KEY = "oak_mein_name";
function ehsGemeinsamerZugang(){ return /^Schichtf/i.test(window.__oakName || "") || !(window.__oakName || "").trim(); }
function ehsVorname(){
  if(!ehsGemeinsamerZugang()) return window.__oakName || "";
  try{ return localStorage.getItem(EHS_NAME_KEY) || ""; }catch(e){ return ""; }
}
function ehsNameFeld(id, label){
  return `<label>${esc(label || "Ihr Name")}<input type="text" id="${id}" autocomplete="name" placeholder="Vor- und Nachname" value="${esc(ehsVorname())}"></label>`;
}
/* liest und prüft das Namensfeld; merkt sich den Namen bei gemeinsamem Zugang */
function ehsNameLesen(wurzel, id){
  const el = wurzel.querySelector("#" + id); const v = el ? el.value.trim().replace(/\s+/g, " ") : "";
  if(v.length < 3){ if(el) el.focus(); return null; }
  if(ehsGemeinsamerZugang()){ try{ localStorage.setItem(EHS_NAME_KEY, v); }catch(e){} }
  return v;
}
function ehsHeute(){ const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function ehsDatum(s){ const t = String(s || "").slice(0, 10).split("-"); return t.length === 3 ? t[2] + "." + t[1] + "." + t[0] : ""; }
/* Tage bis zum Datum (negativ = vorbei) */
function ehsTage(s){
  if(!s) return null;
  const t = String(s).slice(0, 10).split("-").map(Number); if(t.length !== 3) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  return Math.round((new Date(t[0], t[1] - 1, t[2]) - heute) / 86400000);
}
function ehsPlusMonate(iso, m){
  const t = String(iso).slice(0, 10).split("-").map(Number); const d = new Date(t[0], t[1] - 1 + m, t[2]);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function ehsFristText(tage){
  if(tage == null) return "";
  if(tage < -1) return "seit " + (-tage) + " Tagen überfällig";
  if(tage === -1) return "seit gestern überfällig";
  if(tage === 0) return "heute fällig";
  if(tage === 1) return "morgen fällig";
  return "in " + tage + " Tagen";
}
/* Stufe für Farben: rot = überfällig/abgelaufen, gelb = bald, gruen = ok */
function ehsStufe(tage, vorlauf){ if(tage == null) return "grau"; if(tage < 0) return "kritisch"; if(tage <= (vorlauf || 30)) return "warnung"; return "gut"; }
function ehsDialog(id, klasse){
  let dlg = document.getElementById(id);
  if(!dlg){ dlg = document.createElement("dialog"); dlg.id = id; dlg.className = "pw-dlg ehs-dlg " + (klasse || ""); document.body.appendChild(dlg); }
  return dlg;
}
async function ehsHochladen(datei, pfad){
  const t = await token();
  const r = await fetch(CFG.url + "/storage/v1/object/" + CFG.bucket + "/" + pfad.split("/").map(encodeURIComponent).join("/"), { method: "POST",
    headers: { apikey: CFG.anon, Authorization: "Bearer " + t, "Content-Type": datei.type || "application/octet-stream", "x-upsert": "true" }, body: datei });
  if(!r.ok) throw new Error("Datei konnte nicht hochgeladen werden (" + r.status + ")");
  return pfad;
}
async function ehsSigniert(pfad){
  try{
    const r = await apiSend("POST", "/storage/v1/object/sign/" + CFG.bucket + "/" + pfad, { expiresIn: 600 });
    return (r && r.signedURL) ? CFG.url + "/storage/v1" + r.signedURL : null;
  }catch(e){ return null; }
}
function ehsDateiOk(datei){
  if(!datei) return true;
  if(datei.size > 15 * 1024 * 1024) throw new Error("Die Datei ist größer als 15 MB.");
  if(!/\.(pdf|jpe?g|png|webp)$/i.test(datei.name)) throw new Error("Bitte ein PDF oder Foto (JPG, PNG) wählen.");
  return true;
}
function ehsDateiName(datei){ return datei.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-"); }
/* Druckt eine kleine HTML-Seite über einen unsichtbaren Rahmen (kein neues App-Fenster) */
function ehsDrucken(titel, inhalt){
  let f = document.getElementById("ehsDruckRahmen"); if(f) f.remove();
  f = document.createElement("iframe"); f.id = "ehsDruckRahmen"; f.title = "Druck";
  f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
  f.onload = () => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} };
  f.srcdoc = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title><style>
    body{font:12pt/1.45 "Jost","Segoe UI",Arial,sans-serif;color:#1b1b1b;margin:18mm}
    h1{font-size:18pt;margin:0 0 4pt} h2{font-size:13pt;margin:16pt 0 6pt;border-bottom:1px solid #999;padding-bottom:2pt}
    table{width:100%;border-collapse:collapse;margin:6pt 0} th,td{border:1px solid #bbb;padding:4pt 6pt;text-align:left;vertical-align:top;font-size:10.5pt}
    th{background:#eef2ef} ul{margin:4pt 0 8pt;padding-left:16pt} li{margin:2pt 0} .leise{color:#555;font-size:10pt}
    @page{size:A4;margin:0}</style></head><body>${inhalt}</body></html>`;
  document.body.appendChild(f);
}
function ehsMaschinenListe(){
  return (typeof anlagen === "function" ? anlagen() : []).map(r => r.maschine || r.titel).filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
}
function ehsPersonenListe(){
  const namen = new Set();
  try{ (typeof uwPersonen === "function" ? uwPersonen() : []).forEach(p => namen.add(p.name)); }catch(e){}
  try{ (typeof uwSichtbar === "function" ? uwSichtbar() : []).forEach(n => n.mitarbeiter_name && namen.add(n.mitarbeiter_name)); }catch(e){}
  (typeof NW_ROWS !== "undefined" ? NW_ROWS : []).forEach(n => namen.add(n.person_name));
  (typeof VS_ROWS !== "undefined" ? VS_ROWS : []).forEach(n => namen.add(n.person_name));
  return [...namen].filter(Boolean).sort((a, b) => a.localeCompare(b, "de"));
}

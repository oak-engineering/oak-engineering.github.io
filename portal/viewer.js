/* OAK Kundenportal — Viewer. Rendert nach Login je Format: GBU/BA/Mängel/Protokoll (Template-Shell +
   doc-data aus Storage), freies HTML (srcdoc) oder PDF (Blob). Nutzt auth.js. */
"use strict";
const SHELL_TYPEN = { bda:"Gefährdungsbeurteilung (GBU)", ba:"Betriebsanweisung",
  maengelliste:"Mängelliste", protokoll:"Begehungsprotokoll" };
const FMT_LABEL = { html:"Dokument", pdf:"PDF" };

function param(n){ return new URLSearchParams(location.search).get(n) || ""; }
function fehler(msg){ const l=document.getElementById("ladehinweis"); l.classList.remove("hidden"); l.textContent = msg; }

function injiziere(shellHtml, docdataText){
  // "</" -> "<\/": verhindert, dass Inhalte den Script-Block vorzeitig schliessen (XSS-Haertung);
  // JSON.parse liest \/ wieder als / — Inhalt bleibt identisch.
  const safe = docdataText.replace(/<\//g, "<\\/");
  return shellHtml.replace(/(<script id="doc-data"[^>]*>)[\s\S]*?(<\/script>)/, (m,a,b)=> a + safe + b);
}

/* Portal-Kontext-Flag in die Shell setzen: markiert das Dokument als „im Kundenportal" und pinnt
   gleichzeitig die Ziel-Origin fuers Zurueckmelden (postMessage). Steuert im Dokument ausserdem,
   dass die HTML-Speichern-Schaltflaeche verborgen wird (Kunden laden nur PDF). location.origin
   ueber JSON.stringify sicher einbetten. */
function setzePortalFlag(shellHtml){
  const tag = "<script>window.__OAK_PORTAL_ORIGIN=" + JSON.stringify(location.origin) + ";</scr"+"ipt>";
  return shellHtml.replace(/<head([^>]*)>/i, (m)=> m + tag);
}

/* Foto-Lightbox: Klick auf ein Foto im Dokument -> Vollbild (Fotos sind sonst zu klein zum
   Erkennen). Wird in GBU/Mängelliste/Protokoll injiziert — NICHT in die BA (dort sind die
   Piktogramme klick-interaktiv) und nicht in freie HTML-Dokumente (eigene Lightbox/Interaktion). */
const LIGHTBOX =
  '<style>.oaklb{position:fixed;inset:0;background:rgba(10,22,16,.94);z-index:2147483000;'
  + 'display:flex;align-items:center;justify-content:center;cursor:zoom-out}'
  + '.oaklb img{max-width:96vw;max-height:96vh;border-radius:6px;box-shadow:0 12px 48px rgba(0,0,0,.55)}'
  + '.oaklb .oaklb-x{position:fixed;top:12px;right:18px;font:700 30px/1 sans-serif;color:#fff;cursor:pointer}</style>'
  + '<scr'+'ipt>document.addEventListener("click",function(e){'
  + 'var t=e.target;if(!(t&&t.tagName==="IMG"))return;'
  + 'if(t.closest(".oaklb"))return;'
  + 'if(t.closest(".kopf,.oak-marke,.marke,header"))return;'   // Logos nicht zoomen
  + 'var r=t.getBoundingClientRect();if(r.width<80||r.height<60)return;'
  + 'if(t.naturalWidth<300)return;'                             // Piktogramme/Icons ignorieren
  + 'var o=document.createElement("div");o.className="oaklb";'
  + 'var i=document.createElement("img");i.src=t.src;i.alt=t.alt||"";'
  + 'var x=document.createElement("div");x.className="oaklb-x";x.textContent="\\u2715";'
  + 'o.appendChild(i);o.appendChild(x);'
  + 'o.addEventListener("click",function(){o.remove();});'
  + 'document.addEventListener("keydown",function esc(ev){if(ev.key==="Escape"){o.remove();document.removeEventListener("keydown",esc);}});'
  + 'document.body.appendChild(o);e.stopPropagation();},true);</scr'+'ipt>';
const LIGHTBOX_TYPEN = { bda:1, maengelliste:1, protokoll:1 };
function mitLightbox(html, typ){
  if(!LIGHTBOX_TYPEN[typ]) return html;
  return html.includes("</body>") ? html.replace("</body>", LIGHTBOX + "</body>") : html + LIGHTBOX;
}

/* ===== Stufe 2: Live-Bearbeitung — Dokument meldet seinen Arbeitsstand per postMessage,
   der (eingeloggte) Viewer speichert serverseitig, schreibt das Bearbeitungslog und
   aktualisiert die Ampel. Der Live-State wird beim Öffnen in den oak-state-Block injiziert. */
const LIVE_TYPEN = { bda:1, ba:1, maengelliste:1 };
let LIVE = { slug:"", mid:"", docTyp:"", userName:"", letzterStatus:null, letzterZaehler:null, timer:null, ausstehend:null };

function badge(txt, err){
  const b=document.getElementById("saveBadge");
  b.classList.remove("hidden"); b.classList.toggle("err", !!err); b.textContent=txt;
}
function injiziereLiveState(html, stateObj){
  if(!stateObj) return html;
  const blob = JSON.stringify(stateObj).replace(/<\//g, "<\\/");
  return html.replace(/(<script id="oak-state"[^>]*>)[\s\S]*?(<\/script>)/, (m,a,b)=> a + blob + b);
}
/* Kompakter Log-Diff statt Voll-State: was hat sich auf Statusebene geändert? */
function zaehlerVon(docTyp, state, status){
  if(docTyp==="bda"){
    const sig = state && state.signaturen ? Object.keys(state.signaturen).filter(k=>state.signaturen[k]).length : 0;
    return { offen:(status||{}).offen, wirksam:(status||{}).wirksam, unterschriften:sig };
  }
  if(docTyp==="ba"){
    const sig = state && state.sign ? Object.keys(state.sign).filter(k=>state.sign[k]).length : 0;
    return { unterschriften:sig };
  }
  if(docTyp==="maengelliste"){
    let summe=0; (state&&state.m||[]).forEach(x=>{ const v=Number(x.kosten); if(isFinite(v)) summe+=v; });
    return { kosten_summe:summe };
  }
  return {};
}
function diffText(alt, neu){
  if(!alt) return "Erste Änderung in dieser Sitzung";
  const teile=[];
  for(const k of Object.keys(neu)){
    if(JSON.stringify(alt[k])!==JSON.stringify(neu[k])) teile.push(k+": "+alt[k]+" → "+neu[k]);
  }
  return teile.join(" · ") || "Details geändert";
}
async function speichereLive(msg){
  const zaehler = zaehlerVon(msg.docTyp, msg.state, msg.status);
  const s = getSession();
  try{
    badge("Speichern …");
    await apiSend("POST", "/rest/v1/portal_doc_state?on_conflict=kunde_slug,maschinen_id,doc_typ",
      [{ kunde_slug:LIVE.slug, maschinen_id:LIVE.mid, doc_typ:msg.docTyp, state:msg.state,
         geaendert_von:(s&&s.user&&s.user.id)||null, geaendert_name:LIVE.userName,
         updated_at:new Date().toISOString() }],
      "resolution=merge-duplicates,return=minimal");
    await apiSend("POST", "/rest/v1/portal_log",
      [{ kunde_slug:LIVE.slug, maschinen_id:LIVE.mid, doc_typ:msg.docTyp,
         user_id:(s&&s.user&&s.user.id)||null, user_name:LIVE.userName,
         aktion:"Dokument bearbeitet", details:{ aenderung:diffText(LIVE.letzterZaehler, zaehler), stand:zaehler } }],
      "return=minimal").catch(()=>{});
    if(msg.docTyp==="bda" && msg.status)
      await apiSend("POST", "/rest/v1/rpc/portal_status_setzen",
        { p_kunde_slug:LIVE.slug, p_maschinen_id:LIVE.mid, p_doc_typ:"bda", p_status:msg.status }).catch(()=>{});
    LIVE.letzterZaehler = zaehler;
    badge("✓ Gespeichert "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}));
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    badge("Speichern fehlgeschlagen – Änderungen ggf. nicht gesichert!", true);
  }
}
window.addEventListener("message", ev => {
  // Nur Nachrichten aus GENAU dem injizierten Dokument-iframe akzeptieren (der Sandbox-iframe hat eine
  // opake Origin -> ev.origin==="null", daher ist der source-Vergleich die belastbare Prüfung).
  const rahmen = document.getElementById("rahmen");
  if(!rahmen || ev.source !== rahmen.contentWindow) return;
  const d = ev.data;
  if(!d || d.typ!=="oak-doc-state" || !LIVE_TYPEN[d.docTyp] || d.docTyp!==LIVE.docTyp) return;
  LIVE.ausstehend = d;
  clearTimeout(LIVE.timer);
  badge("Änderung erkannt …");
  LIVE.timer = setTimeout(()=>{ const m=LIVE.ausstehend; LIVE.ausstehend=null; speichereLive(m); }, 1500);
});
async function zeigeLog(){
  const modal=document.getElementById("logModal"), liste=document.getElementById("logListe");
  modal.classList.remove("hidden"); liste.textContent="lädt …";
  try{
    const rows = await apiGet("/rest/v1/portal_log?maschinen_id=eq."+encodeURIComponent(LIVE.mid)
      +"&kunde_slug=eq."+encodeURIComponent(LIVE.slug)+"&order=created_at.desc&limit=40", false);
    liste.innerHTML = rows.length ? rows.map(r =>
      `<div style="padding:9px 0;border-bottom:1px solid #eef3f1">
        <b>${esc(new Date(r.created_at).toLocaleString("de-DE"))}</b> · ${esc(r.user_name||"?")}
        <span style="color:var(--grau)">(${esc(r.doc_typ||"")})</span><br>
        <span style="color:var(--grau)">${esc(r.aktion)}${r.details&&r.details.aenderung?": "+esc(r.details.aenderung):""}</span>
      </div>`).join("") : "<i>Noch keine Einträge.</i>";
  }catch(e){ liste.textContent = "Log konnte nicht geladen werden ("+e.message+")."; }
}

document.addEventListener("DOMContentLoaded", async () => {
  const t = await token();
  if(!t){ try{ sessionStorage.setItem("oak_nach_login", location.pathname.split("/").pop() + location.search); }catch(e){} location.replace("index.html"); return; }

  const typ = param("typ"), p = param("p");
  const titel = param("t") || (param("m") + (param("mid") ? " · " + param("mid") : ""));
  const istShell = !!SHELL_TYPEN[typ];
  const label = SHELL_TYPEN[typ] || FMT_LABEL[typ] || "Dokument";
  document.getElementById("vTyp").textContent = label;
  document.getElementById("vTitel").textContent = titel || "Dokument";
  document.title = "OAK Portal — " + label + (titel ? " " + titel : "");

  if(!typ || (istShell ? !p : (typ!=="html" && typ!=="pdf")) || !p){ fehler("Ungültiger Dokument-Link."); return; }
  const frame = document.getElementById("rahmen");
  // Sandbox: Dokumente laufen in einer eigenen (opaken) Origin — kein Zugriff auf die
  // Portal-Session/localStorage der Seite. PDF ohne Sandbox (Browser-PDF-Viewer braucht das).
  if(typ !== "pdf") frame.setAttribute("sandbox", "allow-scripts allow-modals");

  try{
    if(istShell){
      // Live-Kontext: Mandant aus dem Storage-Pfad (<slug>/...), Nutzername fuers Log.
      LIVE.slug = String(p).split("/")[0] || "";
      if(window.OAK_MARKE) await OAK_MARKE.anwenden(LIVE.slug);   // Farben des Betriebs auch in der Dokument-Ansicht
      LIVE.mid = param("mid") || "";
      LIVE.docTyp = LIVE_TYPEN[typ] ? typ : "";
      const s = getSession();
      try{
        const me = await apiGet("/rest/v1/portal_mitglied?select=name&user_id=eq."
          + encodeURIComponent((s&&s.user&&s.user.id)||""), false);
        LIVE.userName = (me&&me[0]&&me[0].name) || (s&&s.user&&s.user.email) || "?";
      }catch(e){ LIVE.userName = (s&&s.user&&s.user.email) || "?"; }

      const liveStatePromise = (LIVE.docTyp && LIVE.mid)
        ? apiGet("/rest/v1/portal_doc_state?select=state&kunde_slug=eq."+encodeURIComponent(LIVE.slug)
            +"&maschinen_id=eq."+encodeURIComponent(LIVE.mid)+"&doc_typ=eq."+typ, false).catch(()=>[])
        : Promise.resolve([]);
      const [shell, docdata, liveRows] = await Promise.all([
        // cache:"no-cache" erzwingt die Revalidierung: sonst rendert ein wiederkehrender
        // Besucher noch die alte Shell (z. B. mit den alten Risiko-Bezeichnungen).
        fetch("shells/" + typ + ".html", {cache:"no-cache"})
          .then(r => { if(!r.ok) throw new Error("Vorlage fehlt"); return r.text(); }),
        apiGet(storagePfad(p), true),
        liveStatePromise,
      ]);
      let html = setzePortalFlag(injiziere(shell, docdata));
      const liveState = liveRows && liveRows[0] && liveRows[0].state;
      if(liveState){
        html = injiziereLiveState(html, liveState);
        LIVE.letzterZaehler = null;   // Diff beginnt mit der ersten Aenderung dieser Sitzung
      }
      if(LIVE.docTyp && LIVE.mid){
        const lb=document.getElementById("logBtn");
        lb.classList.remove("hidden"); lb.addEventListener("click", zeigeLog);
        document.getElementById("logZu").addEventListener("click", ()=>document.getElementById("logModal").classList.add("hidden"));
        document.getElementById("logModal").addEventListener("click", ev=>{ if(ev.target.id==="logModal") ev.target.classList.add("hidden"); });
        badge(liveState ? "Stand geladen (zuletzt gespeicherte Version)" : "Bereit – Änderungen werden automatisch gespeichert");
      }
      frame.srcdoc = mitLightbox(html, typ).replace(/<\/head>/i, (window.OAK_MARKE ? OAK_MARKE.styleBlock() : "") + "</head>");   // Kundenmarke ins Dokument
    } else if(typ==="html"){
      if(/\/(vom-betrieb|anfragen|maengel)\//.test(p)) throw new Error("Vom Betrieb hochgeladene Dateien werden nicht als Seite angezeigt.");
      let inhalt = await apiGet(storagePfad(p), true);
      /* Hallenplan: Farbe = schlimmster offener Mangel, live aus dem Portal (nicht der Stand beim Erzeugen) */
      if(/\/hallenplan\//.test(p)){
        try{
          const slug = String(p).split("/")[0];
          const mg = await apiGet("/rest/v1/portal_maengel?select=maschinen_id,band,bewertung_manuell,status,ausgeblendet&kunde_slug=eq." + encodeURIComponent(slug), false) || [];
          const wert = { gefahr: 3, besorgnis: 2, akzeptanz: 1 }, je = {};
          mg.forEach(m => { if(m.ausgeblendet || m.status === "erledigt") return;
            je[m.maschinen_id] = je[m.maschinen_id] || { band: 0, anzahl: 0 };
            je[m.maschinen_id].band = Math.max(je[m.maschinen_id].band, wert[m.bewertung_manuell || m.band] || 1); je[m.maschinen_id].anzahl++; });
          const tag = "<script>window.OAK_MAENGEL=" + JSON.stringify(je).replace(/</g, "\\u003c") + ";</scr" + "ipt>";
          inhalt = /<head[^>]*>/i.test(inhalt) ? inhalt.replace(/<head([^>]*)>/i, m => m + tag) : tag + inhalt;
        }catch(e){ /* ohne Maengel zeigt der Plan den Stand beim Erzeugen */ }
      }
      frame.srcdoc = inhalt;
    } else if(typ==="pdf" || typ==="bild" || typ==="datei"){
      const roh = await (await apiFetch(storagePfad(p))).blob();
      /* Sicherheit: Typ erzwingen – PDF oder Bild wird angezeigt, alles andere nur heruntergeladen; kein Skript im Portal-Ursprung */
      const mime = typ==="pdf" ? "application/pdf" : (typ==="bild" && /^image\/(png|jpe?g|webp|gif)$/.test(roh.type) ? roh.type : "application/octet-stream");
      frame.removeAttribute("srcdoc");
      if(/\/(vom-betrieb|anfragen|maengel)\//.test(p)) frame.setAttribute("sandbox", "");
      frame.src = URL.createObjectURL(new Blob([roh], {type: mime}));
    }
    frame.classList.remove("hidden");
    document.getElementById("ladehinweis").classList.add("hidden");
  }catch(e){
    if(e.message==="AUTH"){ location.replace("index.html"); return; }
    fehler("Dokument konnte nicht geladen werden: " + e.message);
  }
});

/* Links aus einem Dokument (z. B. Hallenplan „Zu den Dokumenten"): das Dokument laeuft ohne Popup-Recht
   in einer Sandbox und meldet den Wunsch per postMessage. Nur Portal-Seiten, nur aus dem eigenen Rahmen. */
window.addEventListener("message", ev => {
  const f = document.getElementById("rahmen");
  if(!f || ev.source !== f.contentWindow) return;
  const d = ev.data || {}; if(d.oak !== "dokument-oeffnen") return;
  let u; try{ u = new URL(String(d.url || ""), location.href); }catch(e){ return; }
  if(!(u.origin === location.origin || /(^|\.)oak-engineering\.de$/.test(u.hostname))) return;
  if(!/^\/portal\/(maschine|viewer|qr)\.html$/.test(u.pathname)) return;
  const ziel = u.pathname.replace(/^\/portal\//, "") + u.search, titel = String(d.titel || "").slice(0, 80);
  let oben = null; try{ if(window.top !== window && typeof window.top.portalDokOeffnen === "function") oben = window.top; }catch(e){}
  if(oben) oben.portalDokOeffnen(ziel, titel); else window.open(ziel, "_blank", "noopener");
});

/* ---- Teilen und Fragen (Nikolai 17.09.2026) --------------------------------------------------
   Teilen: E-Mail mit dem Link zu diesem Dokument – GBU/BA bleiben hinter dem Login (Geschaeftsgeheimnisse),
   der Empfaenger meldet sich an und landet direkt im Dokument. Kein Download, keine Kopie im Mailpostfach.
   Frage: geht als Anfrage an OAK (portal_anfrage, mit Link zurueck zum Dokument) + Mail an OAK. */
function vDokTitel(){
  const typ = param("typ"), label = SHELL_TYPEN[typ] || FMT_LABEL[typ] || "Dokument";
  const titel = param("t") || param("m") || "";
  return titel && titel.indexOf(label) !== 0 ? label + " · " + titel : (titel || label);
}
document.addEventListener("DOMContentLoaded", () => {
  const teilen = document.getElementById("teilenBtn"), frage = document.getElementById("frageBtn");
  if(teilen) teilen.addEventListener("click", () => {
    const link = location.origin + location.pathname + location.search;
    const betreff = vDokTitel();
    const text = "Hallo,\n\nhier das Dokument „" + betreff + "“ im OAK EHS-Cockpit:\n" + link
      + "\n\nZum Öffnen ist die Anmeldung im EHS-Cockpit nötig.\n";
    location.href = "mailto:?subject=" + encodeURIComponent(betreff) + "&body=" + encodeURIComponent(text);
  });
  if(!frage) return;
  const dlg = document.getElementById("frageDlg"), msg = document.getElementById("frageMsg");
  frage.addEventListener("click", async () => {
    document.getElementById("frageDok").textContent = vDokTitel();
    document.getElementById("frageText").value = ""; msg.textContent = ""; msg.className = "pw-msg";
    const nameFeld = document.getElementById("frageName");
    if(!nameFeld.value){
      try{ const s = getSession();
        const me = await apiGet("/rest/v1/portal_mitglied?select=name&user_id=eq." + encodeURIComponent((s && s.user && s.user.id) || ""), false);
        const n = (me && me[0] && me[0].name) || ""; if(!/^Schichtf/i.test(n)) nameFeld.value = n; }catch(e){}
    }
    dlg.showModal();
  });
  document.getElementById("frageAbbruch").addEventListener("click", () => dlg.close());
  document.getElementById("frageForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const text = document.getElementById("frageText").value.trim(), name = document.getElementById("frageName").value.trim();
    msg.className = "pw-msg";
    if(text.length < 3){ msg.textContent = "Bitte die Frage kurz beschreiben."; msg.classList.add("fehler"); return; }
    if(name.length < 3){ msg.textContent = "Bitte den Namen eintragen."; msg.classList.add("fehler"); return; }
    const knopf = document.getElementById("frageSenden"); knopf.disabled = true; msg.textContent = "Wird gesendet …";
    try{
      const s = getSession();
      const slug = String(param("p")).split("/")[0] || null;
      const titel = vDokTitel();
      const neu = await apiSend("POST", "/rest/v1/portal_anfrage", {
        kunde_slug: slug, von_user_id: s && s.user ? s.user.id : null, von_name: name, von_email: s && s.user ? s.user.email : null,
        betreff: ("Frage zu: " + titel).slice(0, 200), text, maschinen_id: param("mid") || null,
        dokument_link: location.pathname.split("/").pop() + location.search, dokument_titel: titel.slice(0, 200)
      }, "return=representation");
      const id = Array.isArray(neu) ? (neu[0] && neu[0].id) : (neu && neu.id);
      if(id){ try{ const tk = await token();
        await fetch(CFG.url + "/functions/v1/anfrage-mail", { method: "POST",
          headers: { apikey: CFG.anon, Authorization: "Bearer " + tk, "Content-Type": "application/json" }, body: JSON.stringify({ anfrage_id: id }) }); }catch(e){} }
      msg.textContent = "Danke – die Frage ist bei OAK engineering. Die Antwort kommt unter „Frage an OAK“ und per E-Mail."; msg.classList.add("ok");
      setTimeout(() => { dlg.close(); knopf.disabled = false; }, 2200);
    }catch(e){ knopf.disabled = false; msg.textContent = "Konnte nicht gesendet werden: " + (e.message || e); msg.classList.add("fehler"); }
  });
});

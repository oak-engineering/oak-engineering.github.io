/* OAK Kundenportal — Sektion „Unterweisungs-Inhalte": Kapitel bearbeiten.

   Die Rechteformel des Produkts, hier in Code gegossen:
     Auswahl und Medien beim Kunden — Inhalt und Recht bei OAK.

   Konkret: OAK (admin) bearbeitet Text, Fragen und Rechtsbezug des Grundstocks.
   Die Fachkraft des Betriebs kann Kapitel für ihren Bereich ab-/anwählen und
   Bilder gegen eigene tauschen — den Fachtext sieht sie, kann ihn aber nicht ändern.
   Sonst dreht jemand am Text zur Leiterprüfung und OAK steht mit dem Namen darunter.

   Der Inhalt liegt in uw_kapitel.inhalt (jsonb); die Markdown-Dateien im Repo sind
   der versionierte Spiegel (tools/kapitel_sync.py --runter erzeugt den Git-Diff). */
"use strict";

let KAP = [], KAP_MEDIEN = [], KAP_ZUW = [], KAP_THEMA = null, KAP_OFFEN = null;

async function ladeKapitel(){
  const hole = async p => { try { return await apiGet(p, false) || []; } catch(e){ return []; } };
  [KAP, KAP_MEDIEN, KAP_ZUW] = await Promise.all([
    hole("/rest/v1/uw_kapitel?select=*&order=thema.asc,kennung.asc"),
    hole("/rest/v1/uw_medium?select=*"),
    hole("/rest/v1/uw_zuweisung?select=id,kennung,rolle_id,aktiv"),
  ]);
}

function kapAdmin(){ return !!(typeof ADMIN !== "undefined" && ADMIN); }
function kapFachkraft(){ return !!window.__oakFachkraft; }
function kapDarfMedien(){ return kapAdmin() || kapFachkraft(); }
function kapSlug(){ return (typeof AKTIV !== "undefined" && AKTIV) ? AKTIV : null; }

function kapThemen(){
  return [...new Set(KAP.map(k => k.thema))].sort();
}
function kapThemaTitel(t){
  return t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
/* Ein Kapitel gilt als abgewählt, wenn ALLE Zuweisungen dieses Kunden darauf inaktiv sind. */
function kapAbgewaehlt(kennung){
  const z = KAP_ZUW.filter(x => x.kennung === kennung);
  return z.length > 0 && z.every(x => !x.aktiv);
}

/* ------------------------------------------------------------------ Übersicht */
function renderKapitel(wrap){
  const sec = document.createElement("section");
  sec.className = "sektion";
  const themen = kapThemen();
  if(!KAP_THEMA || themen.indexOf(KAP_THEMA) < 0) KAP_THEMA = themen[0] || null;
  const meine = KAP.filter(k => k.thema === KAP_THEMA);

  sec.innerHTML = `
    <div class="sek-kopf">
      <h2>Unterweisungs-Inhalte</h2>
      <span class="zaehler">${KAP.length} Kapitel in ${themen.length} Themen</span>
    </div>
    <p class="leise" style="margin:0 0 14px">
      ${kapAdmin()
        ? "Als OAK bearbeitest du hier Text, Fragen und Rechtsbezug. Änderungen wirken bei allen Kunden, die dieses Kapitel verwenden."
        : "Sie können Kapitel für Ihren Betrieb ab- und anwählen und eigene Bilder einsetzen. Der Fachtext wird von OAK engineering gepflegt und ist deshalb schreibgeschützt."}
    </p>
    <div class="toolbar">
      <select id="kapThema">
        ${themen.map(t => `<option value="${esc(t)}"${t===KAP_THEMA?" selected":""}>${esc(kapThemaTitel(t))}</option>`).join("")}
      </select>
      <input type="search" id="kapSuche" placeholder="Kapitel suchen …">
    </div>
    <div class="tabelle-wrap"><table id="kapTabelle"></table></div>
    <div id="kapDetail"></div>`;
  wrap.appendChild(sec);

  zeichneKapTabelle();
  document.getElementById("kapThema").addEventListener("change", e => {
    KAP_THEMA = e.target.value; KAP_OFFEN = null;
    document.getElementById("kapDetail").innerHTML = ""; zeichneKapTabelle();
  });
  document.getElementById("kapSuche").addEventListener("input", zeichneKapTabelle);
}

function zeichneKapTabelle(){
  const tab = document.getElementById("kapTabelle");
  if(!tab) return;
  const q = (document.getElementById("kapSuche")?.value || "").trim().toLowerCase();
  const rows = KAP.filter(k => k.thema === KAP_THEMA)
                  .filter(k => !q || k.titel.toLowerCase().includes(q) || k.kennung.includes(q));
  tab.innerHTML = `
    <thead><tr>
      <th style="width:44px" title="Für diesen Betrieb aktiv">aktiv</th>
      <th>Kapitel</th>
      <th style="width:180px">Rechtsbezug</th>
      <th style="width:90px">Fassung</th>
      <th style="width:110px">Bilder</th>
      <th style="width:110px"></th>
    </tr></thead>
    <tbody>${rows.map(k => {
      const aus = kapAbgewaehlt(k.kennung);
      const bilder = (k.inhalt?.bilder || []).length;
      const getauscht = KAP_MEDIEN.filter(m => m.kennung === k.kennung && m.kunde_slug).length;
      return `<tr${aus ? ` class="inaktiv"` : ""}>
        <td><input type="checkbox" class="kap-an" data-k="${esc(k.kennung)}"${aus?"":" checked"}${kapDarfMedien()?"":" disabled"}></td>
        <td><strong>${esc(k.titel)}</strong><br><span class="leise" style="font-size:12px">${esc(k.kennung)}</span></td>
        <td>${(k.rechtsbezug||[]).length
              ? (k.rechtsbezug||[]).map(r => `<span class="norm-chip">${esc(r)}</span>`).join(" ")
              : `<span class="ampel besorgnis">fehlt</span>`}</td>
        <td>${k.fassung}</td>
        <td>${bilder}${getauscht?` <span class="tab-n" title="vom Betrieb getauscht">${getauscht} eigen</span>`:""}</td>
        <td><button type="button" class="btn klein" data-kap="${esc(k.kennung)}">${kapAdmin()?"bearbeiten":"ansehen"}</button></td>
      </tr>`;
    }).join("")}</tbody>`;

  tab.querySelectorAll("[data-kap]").forEach(b =>
    b.addEventListener("click", () => kapitelOeffnen(b.dataset.kap)));
  tab.querySelectorAll(".kap-an").forEach(cb =>
    cb.addEventListener("change", () => kapitelSchalten(cb.dataset.k, cb.checked)));
}

/* Ab-/Anwählen: setzt alle Zuweisungen dieses Kunden auf das Kapitel.
   Das ist der Wibo-Fall „Arbeiten im Freien brauchen wir nicht". */
async function kapitelSchalten(kennung, an){
  /* Ohne Kundenfilter traf der Schalter fuer einen Admin ALLE Mandanten - ein Klick
     haette das Kapitel bei jedem Kunden abgeschaltet. RLS faengt das nur fuer die
     Fachkraft ab, nicht fuer den Admin. */
  const slug = (typeof AKTIV !== "undefined" && AKTIV) ? AKTIV : null;
  if(!slug){ alert("Kein Kunde gewaehlt - bitte oben den Mandanten auswaehlen."); return; }
  try{
    await apiSend("PATCH", "/rest/v1/uw_zuweisung?kennung=eq." + encodeURIComponent(kennung)
      + "&kunde_slug=eq." + encodeURIComponent(slug),
      { aktiv: an, quelle: "kunde", geaendert_am: new Date().toISOString(),
        geaendert_von: (window.__oakName || "Portal") }, "return=minimal");
    KAP_ZUW.filter(z => z.kennung === kennung && z.kunde_slug === slug)
           .forEach(z => z.aktiv = an);
    zeichneKapTabelle();
  }catch(e){ alert("Konnte nicht umgeschaltet werden: " + (e.message || e)); }
}

/* ------------------------------------------------------------------ Kapitel-Detail */
function kapitelOeffnen(kennung){
  const k = KAP.find(x => x.kennung === kennung);
  if(!k) return;
  KAP_OFFEN = kennung;
  const inhalt = k.inhalt || { absaetze: [], fragen: [], bilder: [] };
  const box = document.getElementById("kapDetail");
  const nurLesen = !kapAdmin();

  box.innerHTML = `
    <div class="karte-detail">
      <h3>${esc(k.titel)}</h3>
      <div class="formraster">
        <label>Titel<input id="kfTitel" value="${esc(k.titel)}"${nurLesen?" readonly":""}></label>
        <label>Rechtsbezug <span class="leise">(Kürzel aus dem Rechtskataster, mit Komma getrennt)</span>
          <input id="kfRecht" value="${esc((k.rechtsbezug||[]).join(', '))}"${nurLesen?" readonly":""}></label>
        <label>Wiederholung
          <select id="kfTurnus"${nurLesen?" disabled":""}>
            ${[6,12,24,36].map(m => `<option value="${m}"${k.turnus_monate===m?" selected":""}>alle ${m} Monate</option>`).join("")}
          </select></label>
        <label class="haken" style="align-self:end">
          <input type="checkbox" id="kfPraxis"${k.praktischer_anteil?" checked":""}${nurLesen?" disabled":""}>
          mit praktischem Anteil <span class="leise">(zweite Unterschrift nötig)</span></label>
      </div>

      <fieldset><legend>Text</legend>
        <p class="leise" style="margin:0 0 8px">Eine Zeile je Absatz. Zeilen mit „- " werden zur Aufzählung,
          <code>**fett**</code> hebt hervor.${nurLesen?" Schreibgeschützt – Fachtext pflegt OAK engineering.":""}</p>
        <textarea id="kfText" rows="14" class="voll"${nurLesen?" readonly":""}>${esc(
          (inhalt.absaetze||[]).map(a => (a.bu ? "- " : "") + a.md).join("\n"))}</textarea>
      </fieldset>

      <fieldset><legend>Verständnisfragen</legend>
        <p class="leise" style="margin:0 0 8px">Je Frage eine Zeile „?? Frage", darunter die Antworten
          mit „- ", die richtige mit „[richtig]" am Ende.${nurLesen?" Schreibgeschützt.":""}</p>
        <textarea id="kfFragen" rows="7" class="voll"${nurLesen?" readonly":""}>${esc(
          (inhalt.fragen||[]).map(f => "?? " + f.frage + "\n"
            + (f.optionen||[]).map((o,i) => "- " + o + (i===f.richtig ? " [richtig]" : "")).join("\n")
          ).join("\n\n"))}</textarea>
      </fieldset>

      <fieldset><legend>Bilder</legend>
        <div class="bild-raster" id="kfBilder"></div>
      </fieldset>

      <div class="aktionen">
        ${nurLesen ? "" : `<button type="button" class="btn haupt" id="kfSpeichern">Speichern</button>`}
        <button type="button" class="btn" id="kfZu">Schließen</button>
        <span id="kfMeldung" class="leise"></span>
      </div>
    </div>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  zeichneBilder(k);
  document.getElementById("kfZu").onclick = () => { box.innerHTML = ""; KAP_OFFEN = null; };
  const sp = document.getElementById("kfSpeichern");
  if(sp) sp.onclick = () => kapitelSpeichern(k);
}

function bildUrl(pfad){
  return (typeof CFG !== "undefined" ? CFG.url : "")
       + "/storage/v1/object/authenticated/kundendokumente/"
       + pfad.split("/").map(encodeURIComponent).join("/");
}

function zeichneBilder(k){
  const box = document.getElementById("kfBilder");
  const bilder = (k.inhalt?.bilder) || [];
  if(!bilder.length){
    box.innerHTML = `<span class="leise">Dieses Kapitel hat keine Bilder.</span>`;
    return;
  }
  box.innerHTML = bilder.map(name => {
    const eigen = KAP_MEDIEN.find(m => m.kennung === k.kennung && m.bild_key === name && m.kunde_slug);
    const pfad = eigen ? eigen.storage_path : `_grundstock/unterweisungen/${k.thema}/${name}`;
    return `<figure class="bild-kachel">
      <img src="${esc(bildUrl(pfad))}" alt="${esc(name)}" loading="lazy">
      <figcaption>${esc(name)}${eigen?` <span class="tab-n">eigenes Bild</span>`:""}</figcaption>
      ${kapDarfMedien() ? `<div class="bild-aktionen">
        <label class="btn klein">Tauschen<input type="file" accept="image/*" hidden
          class="bild-neu" data-k="${esc(k.kennung)}" data-key="${esc(name)}"></label>
        ${eigen?`<button type="button" class="btn klein" data-zurueck="${esc(eigen.id)}">Original</button>`:""}
      </div>` : ""}
    </figure>`;
  }).join("");

  box.querySelectorAll(".bild-neu").forEach(inp =>
    inp.addEventListener("change", ev => bildTauschen(k, inp.dataset.key, ev.target.files[0])));
  box.querySelectorAll("[data-zurueck]").forEach(b =>
    b.addEventListener("click", () => bildZuruecksetzen(k, b.dataset.zurueck)));
}

/* Bild tauschen: Datei in den Kundenordner des Buckets, Verweis in uw_medium.
   Der Grundstock bleibt unangetastet — deshalb ist „Original" jederzeit möglich. */
async function bildTauschen(k, bildKey, datei){
  const meld = document.getElementById("kfMeldung");
  if(!datei) return;
  if(datei.size > 4 * 1024 * 1024){ meld.textContent = "Bild zu groß (max. 4 MB)."; return; }
  meld.textContent = "Lade Bild …";
  try{
    const endung = (datei.name.split(".").pop() || "jpg").toLowerCase();
    const pfad = `${kapSlug()}/unterweisungen/${k.thema}/${bildKey.replace(/\.[^.]+$/, "")}-eigen.${endung}`;
    const t = await token();
    const r = await fetch(CFG.url + "/storage/v1/object/kundendokumente/"
                          + pfad.split("/").map(encodeURIComponent).join("/"), {
      method: "POST",
      headers: { apikey: CFG.anon, Authorization: "Bearer " + t,
                 "Content-Type": datei.type || "application/octet-stream", "x-upsert": "true" },
      body: datei });
    if(!r.ok) throw new Error("Upload HTTP " + r.status);

    const alt = KAP_MEDIEN.find(m => m.kennung === k.kennung && m.bild_key === bildKey && m.kunde_slug);
    if(alt){
      await apiSend("PATCH", "/rest/v1/uw_medium?id=eq." + encodeURIComponent(alt.id),
        { storage_path: pfad }, "return=minimal");
      alt.storage_path = pfad;
    }else{
      const neu = await apiSend("POST", "/rest/v1/uw_medium", {
        kunde_slug: kapSlug(), kennung: k.kennung, bild_key: bildKey,
        storage_path: pfad, art: "bild", angelegt_von: (window.__oakName || "Portal")
      }, "return=representation");
      KAP_MEDIEN.push(Array.isArray(neu) ? neu[0] : neu);
    }
    meld.textContent = "Bild ersetzt.";
    zeichneBilder(k); zeichneKapTabelle();
  }catch(e){ meld.textContent = "Fehler: " + (e.message || e); }
}

async function bildZuruecksetzen(k, id){
  const meld = document.getElementById("kfMeldung");
  try{
    await apiSend("DELETE", "/rest/v1/uw_medium?id=eq." + encodeURIComponent(id), null, "return=minimal");
    KAP_MEDIEN = KAP_MEDIEN.filter(m => m.id !== id);
    meld.textContent = "Originalbild wiederhergestellt.";
    zeichneBilder(k); zeichneKapTabelle();
  }catch(e){ meld.textContent = "Fehler: " + (e.message || e); }
}

/* Text -> Struktur. Bewusst dasselbe Format wie die Repo-Dateien, damit
   tools/kapitel_sync.py --runter daraus wieder saubere Markdown-Dateien macht. */
function textZuAbsaetzen(text){
  return text.split("\n").map(z => z.trim()).filter(Boolean).map(z =>
    z.startsWith("- ") ? { md: z.slice(2).trim(), bu: true } : { md: z, bu: false });
}
function textZuFragen(text){
  const fragen = [];
  let akt = null;
  text.split("\n").map(z => z.trim()).filter(Boolean).forEach(z => {
    if(z.startsWith("?? ")){ akt = { frage: z.slice(3).trim(), optionen: [], richtig: 0 }; fragen.push(akt); return; }
    if(akt && z.startsWith("- ")){
      let o = z.slice(2);
      if(o.endsWith("[richtig]")){ akt.richtig = akt.optionen.length; o = o.slice(0, -9).trim(); }
      akt.optionen.push(o);
    }
  });
  return fragen;
}

async function kapitelSpeichern(k){
  const meld = document.getElementById("kfMeldung");
  meld.textContent = "Speichere …";
  try{
    const inhalt = {
      absaetze: textZuAbsaetzen(document.getElementById("kfText").value),
      fragen: textZuFragen(document.getElementById("kfFragen").value),
      bilder: (k.inhalt?.bilder) || [],
    };
    const recht = document.getElementById("kfRecht").value
                    .split(",").map(s => s.trim()).filter(Boolean);
    const satz = {
      titel: document.getElementById("kfTitel").value.trim() || k.titel,
      rechtsbezug: recht,
      turnus_monate: parseInt(document.getElementById("kfTurnus").value, 10) || 12,
      praktischer_anteil: document.getElementById("kfPraxis").checked,
      inhalt, fassung: (k.fassung || 1) + 1, geaendert_am: new Date().toISOString(),
    };
    await apiSend("PATCH", "/rest/v1/uw_kapitel?kennung=eq." + encodeURIComponent(k.kennung),
      satz, "return=minimal");
    /* Jede Änderung bekommt einen Historieneintrag – Pflicht laut Design:
       der Kunde entscheidet danach, ob neu unterwiesen werden muss. */
    await apiSend("POST", "/rest/v1/uw_kapitel_historie", {
      kennung: k.kennung, fassung: satz.fassung, anlass: "redaktionell",
      beschreibung: "Im Portal bearbeitet", von: (window.__oakName || "OAK engineering")
    }, "return=minimal");
    Object.assign(k, satz);
    meld.textContent = `Gespeichert als Fassung ${satz.fassung}.`;
    zeichneKapTabelle();
  }catch(e){ meld.textContent = "Fehler beim Speichern: " + (e.message || e); }
}

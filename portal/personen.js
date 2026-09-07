/* OAK Kundenportal — Sektion „Personen & Fälligkeiten".
   Der Kunde pflegt hier seine eigene Organisation: Einheiten (Abteilung/Kostenstelle),
   Rollen und Personen. Zugewiesen wird über die Matrix Einheit × Rolle → Kapitel;
   daraus rechnet die Datenbank (v_uw_faelligkeit) die Fälligkeiten.

   Rollenteilung wie überall im Portal: OAK-Admin und die Fachkraft des Betriebs pflegen,
   die Geschäftsführung liest mit. Fachinhalte (Kapitel) sind hier NICHT bearbeitbar —
   Auswahl und Medien beim Kunden, Inhalt und Recht bei OAK.

   Datenschutz: Personendaten sind auf das Nötige beschränkt (Name, Einheit, Rolle,
   Sprache, Eintritt, Geburtsdatum). Das Geburtsdatum steht hier nicht aus Neugier,
   sondern weil Minderjährige nach § 29 JArbSchG halbjährlich zu unterweisen sind.
   Ausgeschiedene werden archiviert, nie gelöscht — Nachweise müssen erhalten bleiben. */
"use strict";

let PERSONEN = [], EINHEITEN = [], ROLLEN = [], FAELLIG = [], ZUWEISUNG = [], KAPITEL = [];
let PERS_FILTER = { einheit: "", status: "aktiv", suche: "" };

const PERS_TYP_LABEL = {
  eigen: "eigenes Personal", leiharbeit: "Leiharbeit",
  fremdfirma: "Fremdfirma", besucher: "Besucher"
};

async function ladePersonen(){
  const hole = async (pfad, ziel) => {
    try { return await apiGet(pfad, false) || []; } catch(e){ return []; }
  };
  [EINHEITEN, ROLLEN, PERSONEN, FAELLIG, ZUWEISUNG, KAPITEL] = await Promise.all([
    hole("/rest/v1/uw_einheit?select=*&order=name.asc"),
    hole("/rest/v1/uw_rolle?select=*&order=name.asc"),
    hole("/rest/v1/uw_person?select=*,uw_person_einheit(einheit_id),uw_person_rolle(rolle_id)&order=name.asc"),
    hole("/rest/v1/v_uw_faelligkeit?select=*"),
    hole("/rest/v1/uw_zuweisung?select=*"),
    hole("/rest/v1/uw_kapitel?select=kennung,thema,titel,status&status=eq.aktiv&order=thema.asc,kennung.asc"),
  ]);
}

function persDarfPflegen(){
  return !!(typeof ADMIN !== "undefined" && ADMIN) || !!window.__oakFachkraft;
}
function persSlug(){ return (typeof AKTIV !== "undefined" && AKTIV) ? AKTIV : null; }
function persMeine(liste){
  const s = persSlug();
  return s ? liste.filter(r => r.kunde_slug === s) : liste;
}
function persDatum(s){
  if(!s) return "—";
  const t = String(s).slice(0,10).split("-");
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : s;
}
function persName(id, liste){
  const t = liste.find(x => x.id === id);
  return t ? t.name : "—";
}

/* Fälligkeit je Person zusammenfassen: der schlechteste Status zählt.
   Reihenfolge bewusst: überfällig schlägt Erstunterweisung schlägt bald schlägt ok. */
const PERS_RANG = { ueberfaellig: 3, erstunterweisung: 2, bald: 1, ok: 0 };
function persStatus(personId){
  const zeilen = FAELLIG.filter(f => f.person_id === personId);
  if(!zeilen.length) return { status: "keine", offen: 0, gesamt: 0 };
  let schlimm = "ok", offen = 0;
  zeilen.forEach(z => {
    if(PERS_RANG[z.status] > PERS_RANG[schlimm]) schlimm = z.status;
    if(z.status === "ueberfaellig" || z.status === "erstunterweisung") offen++;
  });
  return { status: schlimm, offen, gesamt: zeilen.length };
}
function persAmpel(st){
  return { ueberfaellig: ["gefahr","überfällig"], erstunterweisung: ["gefahr","Erstunterweisung"],
           bald: ["besorgnis","läuft ab"], ok: ["akzeptanz","aktuell"],
           keine: ["",  "nichts zugewiesen"] }[st] || ["",""];
}

/* ------------------------------------------------------------------ Rendern */
function renderPersonen(wrap){
  const sec = document.createElement("section");
  sec.className = "sektion";
  const meine = persMeine(PERSONEN);
  const einh  = persMeine(EINHEITEN).filter(e => e.status === "aktiv");

  const offen = meine.filter(p => p.status === "aktiv")
                     .map(p => persStatus(p.id))
                     .filter(s => s.status === "ueberfaellig" || s.status === "erstunterweisung").length;

  sec.innerHTML = `
    <div class="sek-kopf">
      <h2>Personen &amp; Fälligkeiten</h2>
      <span class="zaehler">${meine.filter(p=>p.status==="aktiv").length} aktiv${offen ? ` · <strong>${offen} offen</strong>` : ""}</span>
    </div>
    <div class="toolbar">
      <input type="search" id="persSuche" placeholder="Person suchen …" value="${esc(PERS_FILTER.suche)}">
      <select id="persEinheit">
        <option value="">Alle Bereiche</option>
        ${einh.map(e => `<option value="${esc(e.id)}"${PERS_FILTER.einheit===e.id?" selected":""}>${esc(e.name)}${e.kst_nr?` (${esc(e.kst_nr)})`:""}</option>`).join("")}
      </select>
      <select id="persStatus">
        <option value="aktiv"${PERS_FILTER.status==="aktiv"?" selected":""}>Aktive</option>
        <option value="ruhend"${PERS_FILTER.status==="ruhend"?" selected":""}>Ruhend</option>
        <option value="archiviert"${PERS_FILTER.status==="archiviert"?" selected":""}>Archiviert</option>
        <option value=""${PERS_FILTER.status===""?" selected":""}>Alle</option>
      </select>
      ${persDarfPflegen() ? `<button type="button" class="btn" id="persNeu">Person anlegen</button>
        <button type="button" class="btn" id="persOrg">Bereiche &amp; Rollen</button>` : ""}
    </div>
    <div class="tabelle-wrap"><table id="persTabelle"></table></div>
    <div id="persDetail"></div>`;
  wrap.appendChild(sec);

  zeichnePersTabelle();
  const s = document.getElementById("persSuche");
  if(s) s.addEventListener("input", e => { PERS_FILTER.suche = e.target.value; zeichnePersTabelle(); });
  const fe = document.getElementById("persEinheit");
  if(fe) fe.addEventListener("change", e => { PERS_FILTER.einheit = e.target.value; zeichnePersTabelle(); });
  const fs = document.getElementById("persStatus");
  if(fs) fs.addEventListener("change", e => { PERS_FILTER.status = e.target.value; zeichnePersTabelle(); });
  const nb = document.getElementById("persNeu");
  if(nb) nb.addEventListener("click", () => personBearbeiten(null));
  const ob = document.getElementById("persOrg");
  if(ob) ob.addEventListener("click", organisationBearbeiten);
}

function persGefiltert(){
  const q = PERS_FILTER.suche.trim().toLowerCase();
  return persMeine(PERSONEN).filter(p => {
    if(PERS_FILTER.status && p.status !== PERS_FILTER.status) return false;
    if(PERS_FILTER.einheit && !(p.uw_person_einheit||[]).some(x => x.einheit_id === PERS_FILTER.einheit)) return false;
    if(q && p.name.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}

function zeichnePersTabelle(){
  const tab = document.getElementById("persTabelle");
  if(!tab) return;
  const rows = persGefiltert();
  if(!rows.length){
    tab.innerHTML = `<tbody><tr><td class="leer">Keine Personen — über „Person anlegen" beginnen.</td></tr></tbody>`;
    return;
  }
  tab.innerHTML = `
    <thead><tr>
      <th>Name</th><th style="width:190px">Bereich</th><th style="width:190px">Rolle</th>
      <th style="width:150px">Unterweisungen</th><th style="width:120px">nächste</th>
      <th style="width:110px"></th>
    </tr></thead>
    <tbody>${rows.map(p => {
      const st = persStatus(p.id);
      const [amp, txt] = persAmpel(st.status);
      const eNamen = (p.uw_person_einheit||[]).map(x => persName(x.einheit_id, EINHEITEN)).join(", ") || "—";
      const rNamen = (p.uw_person_rolle||[]).map(x => persName(x.rolle_id, ROLLEN)).join(", ") || "—";
      const naechste = FAELLIG.filter(f => f.person_id === p.id)
                              .map(f => f.faellig_am).sort()[0];
      const minderj = p.geburtsdatum &&
        (new Date(p.geburtsdatum) > new Date(Date.now() - 18*365.25*86400000));
      return `<tr>
        <td><strong>${esc(p.name)}</strong>${p.status!=="aktiv"?` <span class="tab-n">${esc(p.status)}</span>`:""}${minderj?` <span class="tab-n" title="unter 18 – halbjährliche Unterweisung nach § 29 JArbSchG">&lt;18</span>`:""}</td>
        <td>${esc(eNamen)}</td>
        <td>${esc(rNamen)}</td>
        <td>${amp?`<span class="ampel ${amp}">${txt}</span>`:`<span class="leise">${txt}</span>`}${st.gesamt?` <span class="tab-n">${st.gesamt-st.offen}/${st.gesamt}</span>`:""}</td>
        <td>${persDatum(naechste)}</td>
        <td>${persDarfPflegen()?`<button type="button" class="btn klein" data-pers="${esc(p.id)}">bearbeiten</button>`:""}</td>
      </tr>`;
    }).join("")}</tbody>`;
  tab.querySelectorAll("[data-pers]").forEach(b =>
    b.addEventListener("click", () => personBearbeiten(b.dataset.pers)));
}

/* ------------------------------------------------------------------ Bearbeiten */
function personBearbeiten(id){
  const p = id ? PERSONEN.find(x => x.id === id) : null;
  const einh = persMeine(EINHEITEN).filter(e => e.status === "aktiv");
  const roll = persMeine(ROLLEN).filter(r => r.status === "aktiv");
  const meineE = new Set((p && p.uw_person_einheit || []).map(x => x.einheit_id));
  const meineR = new Set((p && p.uw_person_rolle  || []).map(x => x.rolle_id));

  const box = document.getElementById("persDetail");
  box.innerHTML = `
    <div class="karte-detail">
      <h3>${p ? esc(p.name) : "Neue Person"}</h3>
      <div class="formraster">
        <label>Name<input id="pfName" value="${p?esc(p.name):""}"></label>
        <label>Sprache
          <select id="pfSprache">
            ${["de","en","tr"].map(l => `<option value="${l}"${p&&p.sprache===l?" selected":""}>${{de:"Deutsch",en:"English",tr:"Türkçe"}[l]}</option>`).join("")}
          </select>
        </label>
        <label>Eintritt<input type="date" id="pfEintritt" value="${p&&p.eintritt?esc(p.eintritt):""}"></label>
        <label>Geburtsdatum <span class="leise">(nur für § 29 JArbSchG)</span>
          <input type="date" id="pfGeb" value="${p&&p.geburtsdatum?esc(p.geburtsdatum):""}"></label>
        <label>Status
          <select id="pfStatus">
            ${[["aktiv","aktiv"],["ruhend","ruhend (Elternzeit/Langzeitkrank)"],["archiviert","ausgeschieden (archiviert)"]]
              .map(([v,t]) => `<option value="${v}"${p&&p.status===v?" selected":""}>${t}</option>`).join("")}
          </select>
        </label>
        <label>PIN <span class="leise">(4–6 Ziffern, für die Anmeldung am Terminal)</span>
          <input id="pfPin" inputmode="numeric" placeholder="${p&&p.pin_hash?"unverändert lassen":"z. B. 4711"}"></label>
      </div>
      <fieldset><legend>Bereiche</legend>
        ${einh.map(e => `<label class="haken"><input type="checkbox" class="pfE" value="${esc(e.id)}"${meineE.has(e.id)?" checked":""}> ${esc(e.name)}</label>`).join("") || `<span class="leise">Noch keine Bereiche angelegt.</span>`}
      </fieldset>
      <fieldset><legend>Rollen <span class="leise">(mehrere möglich – die Pflichten addieren sich)</span></legend>
        ${roll.map(r => `<label class="haken"><input type="checkbox" class="pfR" value="${esc(r.id)}"${meineR.has(r.id)?" checked":""}> ${esc(r.name)} <span class="tab-n">${esc(PERS_TYP_LABEL[r.typ]||r.typ)}</span></label>`).join("") || `<span class="leise">Noch keine Rollen angelegt.</span>`}
      </fieldset>
      ${p ? `<div class="faellig-liste"><h4>Zugewiesene Unterweisungen</h4>${
        FAELLIG.filter(f => f.person_id === p.id).sort((a,b)=>String(a.faellig_am).localeCompare(String(b.faellig_am)))
          .map(f => { const [amp,txt] = persAmpel(f.status);
            return `<div class="faellig-zeile"><span>${esc(f.kennung)}</span>
              <span class="ampel ${amp}">${txt}</span>
              <span class="leise">${persDatum(f.faellig_am)} · alle ${f.turnus_monate} Monate</span></div>`; }).join("")
        || `<span class="leise">Nichts zugewiesen — Rolle und Bereich setzen, dann greift die Matrix.</span>`}</div>` : ""}
      <div class="aktionen">
        <button type="button" class="btn haupt" id="pfSpeichern">Speichern</button>
        <button type="button" class="btn" id="pfAbbrechen">Abbrechen</button>
        <span id="pfMeldung" class="leise"></span>
      </div>
    </div>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  document.getElementById("pfAbbrechen").onclick = () => { box.innerHTML = ""; };
  document.getElementById("pfSpeichern").onclick = () => personSpeichern(p);
}

async function sha256Hex(text){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
}

async function personSpeichern(p){
  const meld = document.getElementById("pfMeldung");
  const name = document.getElementById("pfName").value.trim();
  if(name.length < 3){ meld.textContent = "Bitte den vollständigen Namen eintragen."; return; }
  const pin = document.getElementById("pfPin").value.trim();
  if(pin && !/^\d{4,6}$/.test(pin)){ meld.textContent = "PIN: 4 bis 6 Ziffern."; return; }
  meld.textContent = "Speichere …";

  const satz = {
    kunde_slug: persSlug(),
    name,
    sprache: document.getElementById("pfSprache").value,
    eintritt: document.getElementById("pfEintritt").value || null,
    geburtsdatum: document.getElementById("pfGeb").value || null,
    status: document.getElementById("pfStatus").value,
    geaendert_am: new Date().toISOString(),
  };
  if(pin) satz.pin_hash = await sha256Hex(pin);

  try{
    let id = p ? p.id : null;
    if(p){
      await apiSend("PATCH", "/rest/v1/uw_person?id=eq." + encodeURIComponent(p.id), satz, "return=minimal");
    }else{
      const neu = await apiSend("POST", "/rest/v1/uw_person", satz, "return=representation");
      id = Array.isArray(neu) ? neu[0].id : neu.id;
    }
    const eIds = [...document.querySelectorAll(".pfE:checked")].map(x => x.value);
    const rIds = [...document.querySelectorAll(".pfR:checked")].map(x => x.value);
    await apiSend("DELETE", "/rest/v1/uw_person_einheit?person_id=eq." + encodeURIComponent(id), null, "return=minimal");
    await apiSend("DELETE", "/rest/v1/uw_person_rolle?person_id=eq."  + encodeURIComponent(id), null, "return=minimal");
    if(eIds.length) await apiSend("POST", "/rest/v1/uw_person_einheit",
      eIds.map(x => ({ person_id: id, einheit_id: x })), "return=minimal");
    if(rIds.length) await apiSend("POST", "/rest/v1/uw_person_rolle",
      rIds.map(x => ({ person_id: id, rolle_id: x })), "return=minimal");

    await ladePersonen();
    document.getElementById("persDetail").innerHTML = "";
    zeichnePersTabelle();
  }catch(e){
    meld.textContent = "Fehler beim Speichern: " + (e && e.message ? e.message : e);
  }
}

/* ------------------------------------------------------------------ Bereiche & Rollen */
function organisationBearbeiten(){
  const box = document.getElementById("persDetail");
  const einh = persMeine(EINHEITEN), roll = persMeine(ROLLEN);
  box.innerHTML = `
    <div class="karte-detail">
      <h3>Bereiche &amp; Rollen</h3>
      <p class="leise">Bereiche sind Abteilungen oder Kostenstellen. Rollen beschreiben Tätigkeiten —
      der Typ entscheidet über die rechtliche Einordnung (Leiharbeit ist vom Entleiher zu unterweisen).
      Wer Personen zugeordnet hat, lässt sich nicht löschen, nur archivieren.</p>
      <div class="zwei-spalten">
        <div>
          <h4>Bereiche</h4>
          <table><tbody>${einh.map(e => `<tr><td>${esc(e.name)}${e.kst_nr?` <span class="tab-n">${esc(e.kst_nr)}</span>`:""}</td>
            <td style="width:110px">${e.status==="aktiv"?`<button type="button" class="btn klein" data-earch="${esc(e.id)}">archivieren</button>`:`<span class="leise">archiviert</span>`}</td></tr>`).join("")
            || `<tr><td class="leer">noch keiner</td></tr>`}</tbody></table>
          <div class="formzeile">
            <input id="oeName" placeholder="Name, z. B. Halle 1">
            <input id="oeKst" placeholder="Kst-Nr. (optional)" style="max-width:150px">
            <button type="button" class="btn" id="oeNeu">anlegen</button>
          </div>
        </div>
        <div>
          <h4>Rollen</h4>
          <table><tbody>${roll.map(r => `<tr><td>${esc(r.name)} <span class="tab-n">${esc(PERS_TYP_LABEL[r.typ]||r.typ)}</span></td>
            <td style="width:110px">${r.status==="aktiv"?`<button type="button" class="btn klein" data-rarch="${esc(r.id)}">archivieren</button>`:`<span class="leise">archiviert</span>`}</td></tr>`).join("")
            || `<tr><td class="leer">noch keine</td></tr>`}</tbody></table>
          <div class="formzeile">
            <input id="orName" placeholder="Name, z. B. Einrichter">
            <select id="orTyp" style="max-width:170px">
              ${Object.entries(PERS_TYP_LABEL).map(([v,t]) => `<option value="${v}">${t}</option>`).join("")}
            </select>
            <button type="button" class="btn" id="orNeu">anlegen</button>
          </div>
        </div>
      </div>
      <div class="aktionen">
        <button type="button" class="btn" id="ooZu">Schließen</button>
        <span id="ooMeldung" class="leise"></span>
      </div>
    </div>`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const meld = document.getElementById("ooMeldung");
  const neu = async (pfad, satz) => {
    try{
      await apiSend("POST", pfad, satz, "return=minimal");
      await ladePersonen(); organisationBearbeiten(); zeichnePersTabelle();
    }catch(e){ meld.textContent = "Fehler: " + (e.message || e); }
  };
  const archiv = async (pfad) => {
    try{
      await apiSend("PATCH", pfad, { status: "archiviert" }, "return=minimal");
      await ladePersonen(); organisationBearbeiten(); zeichnePersTabelle();
    }catch(e){ meld.textContent = "Fehler: " + (e.message || e); }
  };
  document.getElementById("ooZu").onclick = () => { box.innerHTML = ""; };
  document.getElementById("oeNeu").onclick = () => {
    const n = document.getElementById("oeName").value.trim();
    if(!n) return;
    neu("/rest/v1/uw_einheit", { kunde_slug: persSlug(), name: n,
        kst_nr: document.getElementById("oeKst").value.trim() || null });
  };
  document.getElementById("orNeu").onclick = () => {
    const n = document.getElementById("orName").value.trim();
    if(!n) return;
    neu("/rest/v1/uw_rolle", { kunde_slug: persSlug(), name: n,
        typ: document.getElementById("orTyp").value });
  };
  box.querySelectorAll("[data-earch]").forEach(b => b.onclick = () =>
    archiv("/rest/v1/uw_einheit?id=eq." + encodeURIComponent(b.dataset.earch)));
  box.querySelectorAll("[data-rarch]").forEach(b => b.onclick = () =>
    archiv("/rest/v1/uw_rolle?id=eq." + encodeURIComponent(b.dataset.rarch)));
}

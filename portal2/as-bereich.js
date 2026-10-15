/* Bereichsfilter – Stufe 1 (Plan intern/portal-eigenstaendig.md, Schritt 14; Nikolai 14.10.2026).
   Alles bezieht sich auf die Organisationsstruktur (uw_einheit-Baum):
   - Ist ein Login Einheiten zugeordnet (portal_mitglied_einheit, gepflegt unter Organisation -> Zugänge),
     sieht er nur diese Einheiten samt Unterbereichen; übergeordnete und betriebsweite Einträge nur lesend.
   - Logins ohne Zuordnung (GF, Fachkraft, OAK) sehen alles und können oben auf einen Bereich einschränken.
   Gefiltert wird zentral in apiGet – jede Liste, Kachel und Suche bekommt die Einschränkung automatisch.
   Stufe 2 (harte Sperre in der Datenbank) liegt vorbereitet in references/vorlagen/supabase/bereich_sichtbarkeit_2026-10-14.sql.
   Eingebettete V1-Seiten (iframe) filtern noch nicht – das leistet erst Stufe 2. */
"use strict";

AS.bereich = { aktiv: false, fest: false, meine: [], wurzeln: [], einheiten: [], lesen: new Set(), schreiben: new Set(), versteckt: new Set() };
/* Tabelle -> Feld mit der Einheit (leer = betriebsweit, für alle sichtbar) */
const AS_BEREICH_FELD = { portal_maengel: "einheit_id", as_massnahme: "einheit_id", portal_termin: "einheit_id",
  portal_dokumente: "einheit_id", portal_anlage_daten: "einheit_id", as_pruefobjekt: "einheit_id", as_meldung: "einheit_id",
  as_arbeitssystem: "einheit_id", portal_vorfaelle: "as_einheit_id", portal_nachweis: "as_einheit_id", portal_gefahrstoff: "einheit_ids",
  as_beauftragter: "einheit_id", as_mitzeichnung: "einheit_id", portal_handschuh: "einheit_ids" };
const AS_BEREICH_PERSON = ["v_uw_faelligkeit", "unterweisungsnachweise", "uw_zuweisung_person", "uw_person_einheit", "uw_person_rolle"];
/* V2-Tabellen mit eigener Spalte einheit_id: neue Einträge eines Bereichs-Logins landen in seinem Bereich */
const AS_BEREICH_NEU = ["as_massnahme", "as_pruefobjekt", "as_meldung", "as_arbeitssystem"];

function asBereichTeilbaum(wurzeln){
  const s = new Set(wurzeln), alle = AS.bereich.einheiten;
  let neu = true;
  while(neu){ neu = false; alle.forEach(e => { if(e.parent_id && s.has(e.parent_id) && !s.has(e.id)){ s.add(e.id); neu = true; } }); }
  return s;
}
function asBereichVorfahren(wurzeln){
  const s = new Set(), nach = new Map(AS.bereich.einheiten.map(e => [e.id, e]));
  wurzeln.forEach(w => { let e = nach.get(w); while(e && e.parent_id && !s.has(e.parent_id)){ s.add(e.parent_id); e = nach.get(e.parent_id); } });
  return s;
}
function asBereichLesbar(v){
  const b = AS.bereich; if(!b.aktiv || v == null || v === "") return true;
  if(Array.isArray(v)) return !v.length || v.some(x => b.lesen.has(x));
  return b.lesen.has(v);
}
function asBereichSchreibbar(v){
  const b = AS.bereich; if(!b.fest) return true;
  if(Array.isArray(v)) return v.some(x => b.schreiben.has(x));
  return v != null && v !== "" && b.schreiben.has(v);
}
function asBereichName(){
  const b = AS.bereich; if(!b.aktiv) return "";
  return b.wurzeln.map(id => (b.einheiten.find(e => e.id === id) || {}).name || "").filter(Boolean).join(", ");
}

/* ---- Bereichsauswahl in Dialogen (Durchlauf 15.10.2026: Bereich muss überall wählbar sein) ---- */
function asBereichListe(){
  const b = AS.bereich, z = [];
  const kinder = p => b.einheiten.filter(e => (e.parent_id || null) === p).sort((x, y) => (x.sort || 0) - (y.sort || 0) || String(x.name).localeCompare(y.name, "de"));
  (function lauf(p, t){ kinder(p).forEach(e => { z.push([e, t]); lauf(e.id, t + 1); }); })(null, 0);
  return b.fest ? z.filter(([e]) => b.schreiben.has(e.id)) : z;
}
function asBereichStandard(){ const b = AS.bereich; return b.aktiv && b.wurzeln.length === 1 ? b.wurzeln[0] : ""; }
function asBereichName1(id){ return ((AS.bereich.einheiten || []).find(e => e.id === id) || {}).name || ""; }
function asBereichWahl(label, f, wert, extra, leerText){
  const opt = (AS.bereich.fest ? [] : [["", leerText || "– betriebsweit –"]]).concat(asBereichListe().map(([e, t]) => [e.id, " ".repeat(t) + e.name]));
  return asAuswahl(label, f, wert == null ? asBereichStandard() : wert, opt, extra);
}

/* ---- zentraler Filter: jede Leseabfrage der App läuft hier durch ---- */
const asApiGetRoh = apiGet;
apiGet = async function(path, asText){
  const d = await asApiGetRoh(path, asText);
  return asText ? d : asBereichFiltern(path, d);
};
function asBereichFiltern(path, d){
  const b = AS.bereich; if(!b.aktiv || !Array.isArray(d)) return d;
  const t = (/\/rest\/v1\/([a-z0-9_]+)/.exec(path) || [])[1];
  const f = AS_BEREICH_FELD[t];
  if(f) return d.filter(r => !(f in r) || asBereichLesbar(r[f]));
  if(t === "uw_person") return d.filter(r => !b.versteckt.has(r.id));
  if(AS_BEREICH_PERSON.includes(t)) return d.filter(r => !r.person_id || !b.versteckt.has(r.person_id));
  return d;
}

/* ---- vor jedem Laden: Zuordnung des Logins + gewählte Ansicht bestimmen ---- */
async function asBereichVorbereiten(){
  const b = AS.bereich;
  Object.assign(b, { aktiv: false, fest: false, meine: [], wurzeln: [], einheiten: [], lesen: new Set(), schreiben: new Set(), versteckt: new Set() });
  if(!AS.kunde) return;
  const k = "&kunde_slug=eq." + encodeURIComponent(AS.kunde);
  const [einh, meine] = await Promise.all([
    asApiGetRoh("/rest/v1/uw_einheit?select=id,parent_id,name,art,status,sort" + k).catch(() => []),
    asApiGetRoh("/rest/v1/portal_mitglied_einheit?select=einheit_id&user_id=eq." + encodeURIComponent(AS.uid || "") + k).catch(() => [])]);
  b.einheiten = (einh || []).filter(e => e.status === "aktiv");
  const bekannt = new Set(b.einheiten.map(e => e.id));
  b.meine = (meine || []).map(x => x.einheit_id).filter(id => bekannt.has(id));
  b.fest = b.meine.length > 0;
  let wahl = ""; try{ wahl = localStorage.getItem("as_bereich_" + AS.kunde) || ""; }catch(e){}
  const erlaubt = b.fest ? asBereichTeilbaum(b.meine) : bekannt;
  b.wurzeln = wahl && erlaubt.has(wahl) ? [wahl] : (b.fest ? b.meine : []);
  if(!b.wurzeln.length) return;
  b.aktiv = true;
  b.schreiben = asBereichTeilbaum(b.wurzeln);
  b.lesen = new Set([...b.schreiben, ...asBereichVorfahren(b.wurzeln)]);
  // Personen: ausgeblendet, wer nur Einheiten außerhalb der Ansicht hat (ohne Einheit = betriebsweit sichtbar)
  const pe = await asApiGetRoh("/rest/v1/uw_person_einheit?select=person_id,einheit_id").catch(() => []);
  const proP = new Map();
  (pe || []).forEach(x => { if(!proP.has(x.person_id)) proP.set(x.person_id, []); proP.get(x.person_id).push(x.einheit_id); });
  proP.forEach((liste, pid) => { if(!liste.some(e => b.lesen.has(e))) b.versteckt.add(pid); });
}
/* nach dem Laden: abhängige Tabellen über ihr Eltern-Objekt einschränken */
function asBereichNachLaden(){
  if(!AS.bereich.aktiv) return;
  const sys = new Set(asT("as_arbeitssystem").map(s => s.id)), obj = new Set(asT("as_pruefobjekt").map(o => o.id));
  ["as_gefaehrdung", "as_taetigkeit"].forEach(t => AS.db[t] = asT(t).filter(r => !r.arbeitssystem_id || sys.has(r.arbeitssystem_id)));
  AS.db.as_pruefung = asT("as_pruefung").filter(r => !r.objekt_id || obj.has(r.objekt_id));
  const gef = new Set(asT("as_gefaehrdung").map(g => g.id));
  AS.db.as_massnahme = asT("as_massnahme").filter(m => !m.gefaehrdung_id || gef.has(m.gefaehrdung_id) || asBereichLesbar(m.einheit_id || (m._mg && m._mg.einheit_id)));
}

/* ---- Speichern: übergeordnete Einträge nur lesen, Neues in den eigenen Bereich ---- */
const asSpeichernRoh = asSpeichern;
asSpeichern = async function(t, row){
  const b = AS.bereich;
  if(b.fest){
    if(row.id){
      const alt = asNach(t, row.id);
      const v = alt && (alt._mg ? alt._mg.einheit_id : alt.einheit_id);
      if(alt && v !== undefined && !asBereichSchreibbar(v))
        throw new Error("Dieser Eintrag gehört zu einem übergeordneten Bereich und kann hier nur gelesen werden.");
    } else if(AS_BEREICH_NEU.includes(t) && !row.einheit_id){
      row = Object.assign({}, row, { einheit_id: b.wurzeln[0] });
    }
  }
  return asSpeichernRoh(t, row);
};

/* ---- Auswahl oben neben dem Betrieb ---- */
const asKundeWahlRoh = asKundeWahl;
asKundeWahl = function(){
  asKundeWahlRoh();
  const b = AS.bereich, el = document.getElementById("kundeWahl");
  if(!el || !AS.kunde || !b.einheiten.length) return;
  const basis = b.fest ? asBereichTeilbaum(b.meine) : new Set(b.einheiten.map(e => e.id));
  // Baum in Reihenfolge, eingerückt
  const kinder = p => b.einheiten.filter(e => (e.parent_id || null) === p).sort((x, y) => (x.sort || 0) - (y.sort || 0) || String(x.name).localeCompare(y.name));
  const zeilen = [];
  (function lauf(p, tiefe){ kinder(p).forEach(e => { if(basis.has(e.id)) zeilen.push([e, tiefe]); lauf(e.id, tiefe + (basis.has(e.id) ? 1 : 0)); }); })(null, 0);
  const akt = b.aktiv && b.wurzeln.length === 1 && !(b.fest && b.wurzeln === b.meine) ? b.wurzeln[0] : "";
  const sel = document.createElement("select");
  sel.id = "bereichSel"; sel.title = b.fest ? "Ihre Bereiche" : "Ansicht auf einen Bereich einschränken";
  sel.innerHTML = `<option value="">${b.fest ? "Meine Bereiche" : "Alle Bereiche"}</option>`
    + zeilen.map(([e, t]) => `<option value="${esc(e.id)}" ${e.id === akt ? "selected" : ""}>${"  ".repeat(t)}${esc(e.name)}</option>`).join("");
  sel.onchange = async () => {
    try{ sel.value ? localStorage.setItem("as_bereich_" + AS.kunde, sel.value) : localStorage.removeItem("as_bereich_" + AS.kunde); }catch(e){}
    await asLaden(); asZeige();
  };
  el.appendChild(sel);
};

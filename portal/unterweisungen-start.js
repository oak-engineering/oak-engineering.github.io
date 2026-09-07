/* OAK Kundenportal — Domäne „Unterweisungen": Überblick und Modulkatalog.

   Der Überblick beantwortet die zwei Fragen, wegen derer jemand das Tool öffnet:
   *Wer ist fällig?* (links) und *Was muss ich freigeben?* (rechts).

   Der Katalog zeigt das **volle** Angebot — auch Module, die dieser Betrieb nicht
   gebucht hat. Die stehen gesperrt da, mit Beschreibung und Rechtsbezug. Freischalten
   kann nur OAK (Tabelle uw_buchung, Schreibrecht nur für Admin): der Kunde soll sehen,
   was es gibt, sich aber nicht selbst bedienen.

   Datenquellen: uw_modul (Katalog, global) · uw_buchung (je Kunde) ·
   v_uw_faelligkeit (Fälligkeiten je Person und Kapitel) · uw_person ·
   portal_uw_baustein (Vorschläge, die auf Freigabe warten). */
"use strict";

let UW_MODULE = [], UW_BUCHUNG = [], UW_FAELLIG = [], UW_PERS = [], UW_VORSCHLAG = [];
let UW_GELADEN = false;

async function ladeUwStart(){
  const hole = async (pfad) => { try { return await apiGet(pfad, false) || []; } catch(e){ return []; } };
  [UW_MODULE, UW_BUCHUNG, UW_FAELLIG, UW_PERS, UW_VORSCHLAG] = await Promise.all([
    hole("/rest/v1/uw_modul?select=*&aktiv=is.true&order=reihenfolge.asc"),
    hole("/rest/v1/uw_buchung?select=*"),
    hole("/rest/v1/v_uw_faelligkeit?select=*"),
    hole("/rest/v1/uw_person?select=id,name,status,kunde_slug"),
    hole("/rest/v1/portal_uw_baustein?select=*&order=gueltig_ab.desc"),
  ]);
  UW_GELADEN = true;
}

/* Mandant des angemeldeten Kontos. Für Admins der im Umschalter gewählte Kunde. */
function uwSlug(){ return (typeof AKTIV !== "undefined" && AKTIV) ? AKTIV : null; }
function uwMeine(liste){
  const s = uwSlug();
  return s ? liste.filter(r => !r.kunde_slug || r.kunde_slug === s) : liste;
}
function uwDarfBuchen(){ return !!(typeof ADMIN !== "undefined" && ADMIN); }
function uwGebucht(thema){
  const s = uwSlug();
  return UW_BUCHUNG.some(b => b.thema === thema && b.aktiv !== false
                              && (!s || b.kunde_slug === s));
}
/* Das Modul selbst liegt als EIN Dokument im Portal (…/unterweisungen/<thema>.html).
   Gibt es das Dokument, fuehrt die Karte direkt hinein - sonst ist der Katalog ein
   Schaufenster ohne Ware. */
function uwDokument(thema){
  if(typeof ALLE === "undefined") return null;
  const s = uwSlug();
  return ALLE.find(r => r.storage_path
    && r.storage_path.endsWith("/unterweisungen/" + thema + ".html")
    && (!s || r.kunde_slug === s)) || null;
}

function uwDatum(s){
  if(!s) return "—";
  const t = String(s).slice(0,10).split("-");
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : s;
}

/* ---------------------------------------------------------------- Überblick */

const UW_RANG = { ueberfaellig: 3, erstunterweisung: 2, bald: 1, ok: 0 };

/* Je Person den schlechtesten Status - eine überfällige Unterweisung macht die
   ganze Person überfällig, nicht „im Schnitt in Ordnung". */
function uwStatusJePerson(){
  const s = uwSlug();
  const personen = UW_PERS.filter(p => (!s || p.kunde_slug === s) && p.status === "aktiv");
  return personen.map(p => {
    const zeilen = UW_FAELLIG.filter(f => f.person_id === p.id);
    let schlechtester = "ok", naechste = null;
    zeilen.forEach(z => {
      if((UW_RANG[z.status] || 0) > (UW_RANG[schlechtester] || 0)) schlechtester = z.status;
      if(z.faellig_am && (!naechste || z.faellig_am < naechste)) naechste = z.faellig_am;
    });
    return { name: p.name, status: zeilen.length ? schlechtester : "ohne",
             anzahl: zeilen.length, faellig_am: naechste };
  });
}

function renderUwUeberblick(wrap){
  const sec = document.createElement("section");
  sec.className = "sektion";

  const leute = uwStatusJePerson();
  const zahl = k => leute.filter(p => p.status === k).length;
  const ueberfaellig = zahl("ueberfaellig"), erst = zahl("erstunterweisung");
  const bald = zahl("bald"), ok = zahl("ok"), ohne = zahl("ohne");

  const offeneVorschlaege = uwMeine(UW_VORSCHLAG).filter(v => v.status === "vorgeschlagen");
  const gebuchte = UW_MODULE.filter(m => uwGebucht(m.thema));
  const ohneRecht = UW_MODULE.filter(m => uwGebucht(m.thema)
                                     && (!m.rechtsbezug || !m.rechtsbezug.length));

  /* Liste der dringendsten Personen. Namen stehen hier bewusst im Klartext:
     Die Fachkraft muss wissen, wen sie ansprechen soll. Punktestände gibt es nicht. */
  const dringend = leute
    .filter(p => p.status === "ueberfaellig" || p.status === "erstunterweisung" || p.status === "bald")
    .sort((a,b) => (UW_RANG[b.status]||0) - (UW_RANG[a.status]||0)
                   || String(a.faellig_am||"").localeCompare(String(b.faellig_am||"")))
    .slice(0, 12);

  const UW_LABEL = { ueberfaellig: "überfällig", erstunterweisung: "Erstunterweisung",
                     bald: "läuft ab", ok: "aktuell", ohne: "nichts zugewiesen" };
  const UW_KLASSE = { ueberfaellig: "kritisch", erstunterweisung: "kritisch",
                      bald: "warnung", ok: "gut", ohne: "" };

  const linkeSeite = leute.length ? `
    <div class="uw-liste">
      ${dringend.length ? dringend.map(p => `
        <div class="uw-zeile">
          <span class="uw-name">${esc(p.name)}</span>
          <span class="uw-zettel uw-${UW_KLASSE[p.status] || "neutral"}">${UW_LABEL[p.status]}</span>
          <span class="uw-datum">${uwDatum(p.faellig_am)}</span>
        </div>`).join("")
        : `<div class="leer">Niemand ist fällig. Alle zugewiesenen Unterweisungen sind aktuell.</div>`}
    </div>`
    : `<div class="leer">Noch keine Personen angelegt.<br>
         <span style="font-style:normal">Unter <b>Mitarbeiter</b> Bereiche, Rollen und Personen
         anlegen — daraus rechnet das Portal die Fälligkeiten.</span></div>`;

  const rechteSeite = `
    <div class="uw-liste">
      ${offeneVorschlaege.length ? offeneVorschlaege.slice(0, 8).map(v => `
        <div class="uw-zeile">
          <span class="uw-name">${esc(v.titel || "Vorschlag")}</span>
          <span class="uw-zettel uw-warnung">wartet auf Freigabe</span>
          <span class="uw-datum">${uwDatum(v.gueltig_ab)}</span>
        </div>`).join("") : ""}
      ${ohneRecht.length ? ohneRecht.map(m => `
        <div class="uw-zeile">
          <span class="uw-name">${esc(m.titel)}</span>
          <span class="uw-zettel uw-warnung">Rechtsbezug fehlt</span>
          <span class="uw-datum">—</span>
        </div>`).join("") : ""}
      ${(!offeneVorschlaege.length && !ohneRecht.length)
        ? `<div class="leer">Nichts offen. Sobald sich eine Rechtsgrundlage ändert oder ein
             Vorfall in die nächste Unterweisung gehört, steht es hier.</div>` : ""}
    </div>`;

  sec.innerHTML = `
    <div class="sek-kopf"><h2>Überblick</h2>
      <span class="zaehler">${gebuchte.length} von ${UW_MODULE.length} Modulen freigeschaltet</span></div>
    <div class="ck-reihe uw-vier">
      ${ckTile(ueberfaellig + erst, "überfällig", ueberfaellig + " überfällig · " + erst + " Erstunterweisung",
               (ueberfaellig + erst) ? "kritisch" : "gut")}
      ${ckTile(bald, "läuft in 28 Tagen ab", "rechtzeitig einplanen", bald ? "warnung" : "gut")}
      ${ckTile(ok, "aktuell unterwiesen", "von " + leute.length + " aktiven Personen", ok ? "gut" : "")}
      ${ckTile(offeneVorschlaege.length, "wartet auf Freigabe", "Vorschläge für die nächste Unterweisung",
               offeneVorschlaege.length ? "warnung" : "gut")}
    </div>
    <div class="uw-zweispalt">
      <div class="uw-block">
        <h3>Wer ist fällig</h3>
        ${linkeSeite}
      </div>
      <div class="uw-block">
        <h3>Was ist freizugeben</h3>
        ${rechteSeite}
      </div>
    </div>
    <div class="ck-fuss">Grundlage der Fälligkeit: § 12 ArbSchG und § 4 DGUV Vorschrift 1 —
      vor Aufnahme der Tätigkeit und danach mindestens jährlich. Für Beschäftigte unter 18 Jahren
      rechnet das Portal automatisch mit sechs Monaten (§ 29 JArbSchG). Gespeichert wird, <i>dass</i>
      unterwiesen wurde — kein Punktestand.</div>`;
  wrap.appendChild(sec);
}

/* ------------------------------------------------------------------ Katalog */

const UW_STAND_LABEL = { fertig: "einsetzbar", aufbau: "im Aufbau", geplant: "in Planung" };

function renderUwKatalog(wrap){
  const sec = document.createElement("section");
  sec.className = "sektion";
  const gebucht = UW_MODULE.filter(m => uwGebucht(m.thema));
  const gesperrt = UW_MODULE.filter(m => !uwGebucht(m.thema));

  const karte = (m, frei) => {
    const b = UW_BUCHUNG.find(x => x.thema === m.thema && (!uwSlug() || x.kunde_slug === uwSlug()));
    return `
    <div class="uw-modul${frei ? "" : " uw-gesperrt"}" data-thema="${esc(m.thema)}">
      <div class="uw-modul-kopf">
        <b>${esc(m.titel)}</b>
        ${frei ? `<span class="uw-zettel uw-gut">freigeschaltet</span>`
               : `<span class="uw-zettel uw-schloss">${uwSchloss()} nicht gebucht</span>`}
      </div>
      <div class="uw-modul-unter">${esc(m.untertitel || "")}</div>
      <p class="uw-modul-text">${esc(m.beschreibung || "")}</p>
      <div class="uw-modul-fuss">
        <span>${m.dauer_min ? "ca. " + m.dauer_min + " Min." : "Dauer offen"}</span>
        <span>Wiederholung alle ${m.turnus_monate} Monate</span>
        <span>${UW_STAND_LABEL[m.stand] || m.stand}</span>
        ${m.praktischer_anteil ? `<span class="uw-praxis">praktischer Anteil nötig</span>` : ""}
      </div>
      ${(m.rechtsbezug && m.rechtsbezug.length)
        ? `<div class="uw-recht">${m.rechtsbezug.map(esc).join(" · ")}</div>` : ""}
      ${frei && b && b.gebucht_am ? `<div class="uw-recht">freigeschaltet am ${uwDatum(b.gebucht_am)}</div>` : ""}
      ${(function(){
        if(!frei) return "";
        const d = uwDokument(m.thema);
        return d
          ? `<div class="uw-oeffnen"><a class="btn" href="${viewerUrl(d.doc_typ || "html", d.storage_path, m.titel)}"
               target="_blank" rel="noopener">Unterweisung starten</a></div>`
          : `<div class="uw-recht">Inhalt wird bereitgestellt.</div>`;
      })()}
      ${uwDarfBuchen() ? `<div class="uw-admin">
          <button type="button" class="btn-klein" data-buchen="${esc(m.thema)}" data-frei="${frei ? 1 : 0}">
            ${frei ? "Freischaltung zurücknehmen" : "Für diesen Kunden freischalten"}</button></div>` : ""}
    </div>`;
  };

  sec.innerHTML = `
    <div class="sek-kopf"><h2>Modulkatalog</h2>
      <span class="zaehler">${gebucht.length} freigeschaltet · ${gesperrt.length} verfügbar</span></div>
    ${gebucht.length ? `<h3 class="uw-gruppe">Für diesen Betrieb freigeschaltet</h3>
      <div class="uw-raster">${gebucht.map(m => karte(m, true)).join("")}</div>` : ""}
    ${gesperrt.length ? `<h3 class="uw-gruppe">Weitere Module von OAK engineering</h3>
      <div class="uw-raster">${gesperrt.map(m => karte(m, false)).join("")}</div>` : ""}
    <div class="ck-fuss">Der Katalog zeigt das vollständige Angebot. Fachlicher Inhalt und
      Rechtsbezug kommen von OAK engineering und werden zentral aktuell gehalten; Auswahl,
      eigene Ergänzungen und Medien liegen beim Betrieb. Zum Freischalten weiterer Module
      sprechen Sie uns an.</div>`;

  sec.querySelectorAll("[data-buchen]").forEach(b => b.addEventListener("click", async () => {
    const thema = b.dataset.buchen, frei = b.dataset.frei === "1", slug = uwSlug();
    if(!slug){ alert("Kein Kunde gewählt."); return; }
    b.disabled = true;
    try {
      if(frei){
        await apiSend("DELETE", "/rest/v1/uw_buchung?kunde_slug=eq."
          + encodeURIComponent(slug) + "&thema=eq." + encodeURIComponent(thema),
          null, "return=minimal");
      } else {
        await apiSend("POST", "/rest/v1/uw_buchung",
          { kunde_slug: slug, thema: thema }, "return=minimal");
      }
      await ladeUwStart();
      renderSektionen();
    } catch(e){
      alert("Nicht gespeichert: " + e.message);
      b.disabled = false;
    }
  }));
  wrap.appendChild(sec);
}

function uwSchloss(){
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px">
    <rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
}

/* OAK Kundenportal — Cockpit je Domäne: die wenigen Zahlen, die eine Entscheidung auslösen.
   Die Zahlen tragen der Reihe nach die Lage; EIN Ring daneben zeigt das Verhältnis, das man
   sonst im Kopf ausrechnen müsste (wie viele Anlagen stehen im Gefahrbereich – von wie vielen).
   Mehr Grafik gibt es bewusst nicht: es sind Bestandszahlen, keine Zeitreihen.
   (Bis 19.08.2026 stand hier gar kein Diagramm; auf Wunsch von Nikolai jetzt der Ring.)
   Unverändert gilt: Farbe ist nie die einzige Aussage – jede Kachel und jedes Ringsegment
   trägt Zahl UND Text, damit die Ampel auch ohne Farbsehen lesbar bleibt. */
"use strict";

/* Kachel; mit `ziel` (#domaene/reiter[?status=…]) wird sie ein Link und springt auf die Liste dahinter. */
function ckTile(zahl, label, hinweis, stufe, ziel){
  const klassen = "ck-kachel" + (stufe ? " ck-" + stufe : "") + (ziel ? " ck-link" : "");
  const innen = `<div class="ck-zahl">${esc(String(zahl))}</div>
    <div class="ck-label">${label}</div>
    ${hinweis ? `<div class="ck-hinweis">${hinweis}</div>` : ""}`;
  return ziel ? `<a class="${klassen}" href="#${esc(ziel)}">${innen}</a>` : `<div class="${klassen}">${innen}</div>`;
}

/* Verteilungsbalken: Anteile mit Zahl + Name am Segment, 2px Lücke zwischen den Flächen. */
function ckBalken(teile){
  const summe = teile.reduce((n, t) => n + t.wert, 0);
  if(!summe) return "";
  return `<div class="ck-balken-block">
    <div class="ck-balken">${teile.filter(t => t.wert).map(t =>
      `<span class="ck-seg ck-${t.klasse}" style="flex:${t.wert}" title="${esc(t.name)}: ${t.wert}"></span>`).join("")}</div>
    <div class="ck-legende">${teile.map(t =>
      `<span class="ck-leg"><i class="ck-punkt ck-${t.klasse}"></i>${esc(t.name)} <b>${t.wert}</b></span>`).join("")}</div>
  </div>`;
}

/* Ring (Donut) als Inline-SVG – nach dem Muster des Digitalisierungs-Checks
   (tools/OAK_Digitalisierungs-Check.html): ein Kreis je Segment, Laenge ueber
   stroke-dasharray, Start ueber stroke-dashoffset. Bewusst ohne Diagramm-Bibliothek:
   das Portal laedt ausschliesslich lokale Dateien (intern/anforderungen.md).
   teile = [{name, wert, klasse}], klasse wie beim Balken: kritisch|warnung|gut|neutral. */
function ckRing(teile, mitteLabel){
  const werte = teile.filter(t => t.wert > 0);
  const summe = werte.reduce((n, t) => n + t.wert, 0);
  if(!summe) return "";
  const R = 52, U = 2 * Math.PI * R;
  /* Kleine Luecke zwischen den Flaechen, damit zwei Segmente nicht ineinanderlaufen.
     Bei nur einem Segment entfaellt sie – sonst klaffte im vollen Ring ein Schlitz. */
  const luecke = werte.length > 1 ? 3 : 0;
  let gedreht = 0;
  const boegen = werte.map(t => {
    const laenge = U * (t.wert / summe);
    const bogen = Math.max(0, laenge - luecke);
    const s = `<circle class="ck-bogen ck-${t.klasse}" cx="60" cy="60" r="${R}"
        stroke-dasharray="${bogen.toFixed(2)} ${(U - bogen).toFixed(2)}"
        stroke-dashoffset="${(-gedreht).toFixed(2)}"><title>${esc(t.name)}: ${t.wert}</title></circle>`;
    gedreht += laenge;
    return s;
  }).join("");
  return `<div class="ck-ring-block">
    <div class="ck-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label="${esc(mitteLabel)}: ${summe}">
        <circle class="ck-bahn" cx="60" cy="60" r="${R}"></circle>
        ${boegen}
      </svg>
      <div class="ck-ring-mitte"><b>${summe}</b><span>${esc(mitteLabel)}</span></div>
    </div>
    <div class="ck-legende">${teile.map(t =>
      `<span class="ck-leg"><i class="ck-punkt ck-${t.klasse}"></i>${esc(t.name)} <b>${t.wert}</b></span>`).join("")}</div>
  </div>`;
}

function ckAnlagenZahlen(){
  const rows = sichtbar().filter(r => r.kategorie === "anlagen");
  const z = { gefahr: 0, besorgnis: 0, akzeptanz: 0, ohne: 0, offen: 0, gesamt: 0, maengel: 0 };
  rows.forEach(r => {
    /* Farbe = schlimmster offener Mangel (maengel.js); vor dem Laden der Maengel wie bisher aus dem GBU-Status */
    const b = (typeof mgAnlagenBand === "function") ? mgAnlagenBand(r.maschinen_id, r.kunde_slug) : null;
    const k = b ? ({ gefahr: "rot", besorgnis: "orange", akzeptanz: "gruen", keine: "gruen" })[b] : ampelKlasse(r.status);
    if(k === "rot" || k === "akut") z.gefahr++;
    else if(k === "orange") z.besorgnis++;
    else if(k === "gruen") z.akzeptanz++;
    else z.ohne++;
    const st = r.status || {};
    z.offen += (st.offen || 0); z.gesamt += (st.gesamt || 0);
    z.maengel += (st.maengelGefahr || 0);
  });
  z.anlagen = rows.length;
  z.freigegeben = rows.filter(r => FREIGABE[fgKey(r)]).length;
  z.letzte = rows.map(r => r.stand).filter(Boolean).sort().slice(-1)[0] || "";
  return z;
}

function ckDatum(s){
  if(!s) return "—";
  const t = String(s).slice(0, 10).split("-");
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : s;
}

function renderCockpit(wrap, bereich){
  const sec = document.createElement("section");
  sec.className = "sektion";
  let inhalt = "";

  if(bereich === "arbeitssicherheit"){
    /* Startseite „Auf einen Blick" (16.09.2026): was ein Schichtfuehrer morgens wissen will – jede Karte fuehrt zur Liste. */
    const z = ckAnlagenZahlen();
    const vf = vSichtbar().filter(v => v.domaene !== "umwelt");
    const vOffenN = vf.filter(v => v.status !== "erledigt").length;
    const letzterV = vf.slice().sort((a, b) => String(b.ereignis_am || b.angelegt_am || "").localeCompare(String(a.ereignis_am || a.angelegt_am || "")))[0];
    const ART = { unfall: "Unfall", beinahe: "Beinahe-Unfall", mangel: "Mangel", umwelt: "Umweltvorfall", sonstiges: "Sonstiges" };
    const mgGeladen = (typeof MG_GELADEN !== "undefined" && MG_GELADEN);
    const mg = mgGeladen ? mgSichtbar().filter(m => m.status !== "erledigt") : [];
    const mgZaun = mg.filter(m => mgFeld(m, "thema") === "schutzzaun").length, mgGefahr = mg.filter(m => (m.bewertung_manuell || m.band) === "gefahr").length;
    const begehungen = sichtbar().filter(r => r.kategorie === "begehungen");
    /* Letzte Begehung = juengstes Begehungsprotokoll (nicht das Erstelldatum eines Maschinendokuments) */
    const letzteBeg = begehungen.map(r => r.stand).filter(Boolean).sort().slice(-1)[0] || "";
    const uwF = (typeof uwFaelligZahl === "function") ? uwFaelligZahl() : 0;
    const uwRows = (typeof uwSichtbar === "function") ? uwSichtbar() : [];
    const uwLetzt = uwRows.length ? uwRows[0].created_at : "";
    inhalt = `
      <div class="ck-oben">
        <div class="ck-reihe">
          ${ckTile(mgGeladen ? mg.length : "…", "offene Mängel", mgGeladen ? (mgZaun + " an Schutzzäunen / Robotern · " + mgGefahr + " im Gefahrbereich") : "wird geladen", mg.length ? "kritisch" : "gut", "maengel")}
          ${ckTile(uwF, "Unterweisungen fällig", uwLetzt ? "letzter Nachweis " + ckDatum(uwLetzt) : "noch kein Nachweis", uwF ? "warnung" : "gut", "mehr/unterweisungen")}
          ${ckTile(letzterV ? ckDatum(letzterV.ereignis_am || letzterV.angelegt_am) : "keiner", "letzter Vorfall", letzterV ? (ART[letzterV.art] || "Vorfall") + " · " + vOffenN + " offen" : "bisher nichts gemeldet", vOffenN ? "warnung" : "", "mehr/vorfaelle")}
          ${ckTile(ckDatum(letzteBeg), "letzte Begehung", begehungen.length + " Begehungsprotokolle", "", "unterlagen/begehungen")}
          ${ckTile(z.gefahr + " von " + z.anlagen, "Anlagen im Gefahrbereich", z.besorgnis + " Besorgnis · " + z.akzeptanz + " Akzeptanz", z.gefahr ? "kritisch" : "gut", "unterlagen/anlagen?status=gefahr")}
          ${ckTile(ckDatum(z.letzte), "Unterlagen aktualisiert", z.anlagen + " Maschinen dokumentiert", "", "unterlagen")}
        </div>
        ${ckRing([
          { name: "Gefahrbereich", wert: z.gefahr, klasse: "kritisch" },
          { name: "Besorgnisbereich", wert: z.besorgnis, klasse: "warnung" },
          { name: "Akzeptanzbereich", wert: z.akzeptanz, klasse: "gut" },
          { name: "nicht bewertet", wert: z.ohne, klasse: "neutral" },
        ], "Maschinen")}
      </div>
`;
  }

  if(bereich === "umwelt"){
    const vf = vSichtbar().filter(v => v.domaene === "umwelt" || v.domaene === "beides" || v.art === "umwelt");
    const offen = vf.filter(v => v.status !== "erledigt").length;
    const kritisch = vf.filter(v => /Kanalisation|Gewässer|Erdreich|unklar/i.test(v.wohin || "")).length;
    const dok = k => sichtbar().filter(r => r.kategorie === k).length;
    const fach = dok("umwelt-immissionsschutz") + dok("umwelt-gewaesserschutz") + dok("umwelt-awsv");
    const inArbeit = vf.filter(v => v.status === "bearbeitung").length;
    const erledigt = vf.filter(v => v.status === "erledigt").length;
    inhalt = `
      <div class="ck-oben">
        <div class="ck-reihe">
          ${ckTile(offen, "offene Umweltvorfälle", vf.length + " insgesamt gemeldet", offen ? "warnung" : "gut", "mehr/vf-umwelt")}
          ${ckTile(kritisch, "davon mit Austritt", "Kanalisation, Boden oder Gewässer", kritisch ? "kritisch" : "gut", "mehr/vf-umwelt")}
          ${ckTile(dok("umwelt-immissionsschutz"), "Immissionsschutz", "Dokumente", "", "unterlagen/umwelt-immissionsschutz")}
          ${ckTile(dok("umwelt-gewaesserschutz"), "Gewässerschutz", "Dokumente", "", "unterlagen/umwelt-gewaesserschutz")}
          ${ckTile(dok("umwelt-awsv"), "AwSV", "Dokumente", "", "unterlagen/umwelt-awsv")}
        </div>
        ${ckRing([
          /* „neu gemeldet" statt „offen": die Kachel daneben zaehlt unter „offen" alles,
             was nicht erledigt ist – gleiche Bezeichnung, andere Zahl waere verwirrend. */
          { name: "neu gemeldet", wert: offen - inArbeit, klasse: "kritisch" },
          { name: "in Arbeit", wert: inArbeit, klasse: "warnung" },
          { name: "erledigt", wert: erledigt, klasse: "gut" },
        ], "Vorfälle")}
      </div>
      ${kritisch ? `<div class="ck-hinweisbox"><b>Prüfen:</b> Gelangen wassergefährdende Stoffe in nicht nur
        unerheblicher Menge in ein Gewässer, in die Kanalisation oder in den Boden, ist das unverzüglich
        der zuständigen Behörde oder einer Polizeidienststelle anzuzeigen (§ 24 Abs. 2 AwSV).</div>` : ""}
      ${!fach ? `<div class="ck-fuss">Für die Umweltthemen sind bisher keine Fachdokumente hinterlegt –
        der Bereich wird gerade aufgebaut (Immissionsschutz zuerst).</div>` : ""}`;
  }

  if(bereich === "energie"){
    const dok = k => sichtbar().filter(r => r.kategorie === k).length;
    const em = eSichtbar();
    const nach = s => em.filter(m => m.status === s).length;
    const gesamt = dok("energie-aspekte") + dok("energie-verbrauch") + em.length;
    inhalt = `
      <div class="ck-oben">
        <div class="ck-reihe">
          ${ckTile(nach("offen"), "offene Maßnahmen", em.length + " Befunde insgesamt", nach("offen") ? "warnung" : "gut", "unterlagen/energie-massnahmen")}
          ${ckTile(nach("geplant"), "geplant", "Umsetzung terminiert", "", "unterlagen/energie-massnahmen")}
          ${ckTile(nach("umgesetzt"), "umgesetzt", "abgeschlossen", nach("umgesetzt") ? "gut" : "", "unterlagen/energie-massnahmen")}
          ${ckTile(dok("energie-aspekte"), "Energieaspekte", "Dokumente", "", "unterlagen/energie-aspekte")}
          ${ckTile(dok("energie-verbrauch"), "Verbrauch & Messstellen", "Dokumente", "", "unterlagen/energie-verbrauch")}
        </div>
        ${ckRing([
          { name: "offen", wert: nach("offen"), klasse: "warnung" },
          { name: "geplant", wert: nach("geplant"), klasse: "plan" },
          { name: "umgesetzt", wert: nach("umgesetzt"), klasse: "gut" },
        ], "Maßnahmen")}
      </div>
      <div class="ck-fuss">${gesamt ? "" : "<b>Der Bereich Energie wird gerade aufgebaut.</b> "}
        Ziel ist die Vorbereitung eines Energiemanagements nach <b>ISO 50001</b>. Die nächsten Schritte:
        Energieaspekte je Anlage erfassen (Antriebe, Druckluft, Temperierung, Beleuchtung) ·
        Messkonzept und Basisjahr festlegen · Maßnahmen bewerten und priorisieren.<br><br>
        Energiebefunde aus den Begehungen stehen unter <b>Effizienzmaßnahmen</b>. Sie sind bewusst von
        der Mängelliste Arbeitsschutz getrennt: keine Sicherheitsrelevanz, aber ein Kostenthema.</div>`;
  }

  sec.className = "sektion ck-blick";
  sec.innerHTML = inhalt;
  wrap.appendChild(sec);
}

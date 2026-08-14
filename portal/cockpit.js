/* OAK Kundenportal — Cockpit je Domäne: die wenigen Zahlen, die eine Entscheidung auslösen.
   Bewusst KEINE Diagramme: es sind Bestandszahlen, keine Zeitreihen – dafür sind Kennzahl-Kacheln
   die richtige Form. Farbe ist nie die einzige Aussage: jede Kachel trägt Zahl UND Text. */
"use strict";

function ckTile(zahl, label, hinweis, stufe){
  return `<div class="ck-kachel${stufe ? " ck-" + stufe : ""}">
    <div class="ck-zahl">${esc(String(zahl))}</div>
    <div class="ck-label">${label}</div>
    ${hinweis ? `<div class="ck-hinweis">${hinweis}</div>` : ""}</div>`;
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

function ckAnlagenZahlen(){
  const rows = sichtbar().filter(r => r.kategorie === "anlagen");
  const z = { gefahr: 0, besorgnis: 0, akzeptanz: 0, ohne: 0, offen: 0, gesamt: 0, maengel: 0 };
  rows.forEach(r => {
    const k = ampelKlasse(r.status);
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
    const z = ckAnlagenZahlen();
    const vf = vSichtbar().filter(v => v.domaene !== "umwelt");
    const vOffenN = vf.filter(v => v.status !== "erledigt").length;
    const unfaelle = vf.filter(v => v.art === "unfall").length;
    const beinahe = vf.filter(v => v.art === "beinahe").length;
    inhalt = `
      <div class="ck-reihe">
        ${ckTile(z.anlagen, "Anlagen dokumentiert", z.ohne ? z.ohne + " ohne Bewertung" : "alle bewertet")}
        ${ckTile(z.gefahr, "im Gefahrbereich", z.gefahr ? "vorrangig abstellen" : "keine", z.gefahr ? "kritisch" : "gut")}
        ${ckTile(z.maengel, "Mängel im Gefahrbereich", "aus den Mängellisten", z.maengel ? "kritisch" : "gut")}
        ${ckTile(z.gesamt - z.offen, "Maßnahmen wirksam", "von " + z.gesamt + " dokumentierten", (z.gesamt && !(z.gesamt - z.offen)) ? "warnung" : "")}
        ${ckTile(vOffenN, "offene Vorfälle", unfaelle + " Unfälle · " + beinahe + " Beinahe-Unfälle", vOffenN ? "warnung" : "gut")}
        ${ckTile(z.freigegeben + "/" + z.anlagen, "Dokumente freigegeben", "durch die Sicherheitsfachkraft")}
        ${ckTile(ckDatum(z.letzte), "Unterlagen aktualisiert", "Stand der Anlagendokumente")}
      </div>
      ${ckBalken([
        { name: "Gefahrbereich", wert: z.gefahr, klasse: "kritisch" },
        { name: "Besorgnisbereich", wert: z.besorgnis, klasse: "warnung" },
        { name: "Akzeptanzbereich", wert: z.akzeptanz, klasse: "gut" },
        { name: "nicht bewertet", wert: z.ohne, klasse: "neutral" },
      ])}
      <div class="ck-fuss">Risiko = höchstes <b>Ausgangsrisiko</b> der Gefährdungsbeurteilung je Anlage
        (1–3 Akzeptanz · 4–8 Besorgnis · 9–16 Gefahr) – also der Zustand <i>vor</i> Umsetzung der Maßnahmen.
        „Maßnahmen wirksam" zählt die in den Gefährdungsbeurteilungen als umgesetzt und wirksam
        bestätigten Maßnahmen; solange dort nichts abgehakt ist, steht der Wert bei null.</div>`;
  }

  if(bereich === "umwelt"){
    const vf = vSichtbar().filter(v => v.domaene === "umwelt" || v.domaene === "beides" || v.art === "umwelt");
    const offen = vf.filter(v => v.status !== "erledigt").length;
    const kritisch = vf.filter(v => /Kanalisation|Gewässer|Erdreich|unklar/i.test(v.wohin || "")).length;
    const dok = k => sichtbar().filter(r => r.kategorie === k).length;
    const fach = dok("umwelt-immissionsschutz") + dok("umwelt-gewaesserschutz") + dok("umwelt-awsv");
    inhalt = `
      <div class="ck-reihe">
        ${ckTile(offen, "offene Umweltvorfälle", vf.length + " insgesamt gemeldet", offen ? "warnung" : "gut")}
        ${ckTile(kritisch, "davon mit Austritt", "Kanalisation, Boden oder Gewässer", kritisch ? "kritisch" : "gut")}
        ${ckTile(dok("umwelt-immissionsschutz"), "Immissionsschutz", "Dokumente")}
        ${ckTile(dok("umwelt-gewaesserschutz"), "Gewässerschutz", "Dokumente")}
        ${ckTile(dok("umwelt-awsv"), "AwSV", "Dokumente")}
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
      <div class="ck-reihe">
        ${ckTile(nach("offen"), "offene Maßnahmen", em.length + " Befunde insgesamt", nach("offen") ? "warnung" : "gut")}
        ${ckTile(nach("geplant"), "geplant", "Umsetzung terminiert")}
        ${ckTile(nach("umgesetzt"), "umgesetzt", "abgeschlossen", nach("umgesetzt") ? "gut" : "")}
        ${ckTile(dok("energie-aspekte"), "Energieaspekte", "Dokumente")}
        ${ckTile(dok("energie-verbrauch"), "Verbrauch & Messstellen", "Dokumente")}
      </div>
      <div class="ck-fuss">${gesamt ? "" : "<b>Der Bereich Energie wird gerade aufgebaut.</b> "}
        Ziel ist die Vorbereitung eines Energiemanagements nach <b>ISO 50001</b>. Die nächsten Schritte:
        Energieaspekte je Anlage erfassen (Antriebe, Druckluft, Temperierung, Beleuchtung) ·
        Messkonzept und Basisjahr festlegen · Maßnahmen bewerten und priorisieren.<br><br>
        Energiebefunde aus den Begehungen stehen unter <b>Effizienzmaßnahmen</b>. Sie sind bewusst von
        der Mängelliste Arbeitsschutz getrennt: keine Sicherheitsrelevanz, aber ein Kostenthema.</div>`;
  }

  sec.innerHTML = `<div class="sek-kopf"><h2>Überblick</h2></div>${inhalt}`;
  wrap.appendChild(sec);
}

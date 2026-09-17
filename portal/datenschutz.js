/* OAK EHS-Cockpit — Datenschutzhinweise und Stand der Auftragsverarbeitung (Nikolai 17.09.2026:
   „AVV und Datenschutz sollten im Cockpit ersichtlich sein, z. B. als Fußnote").
   Fußzeile auf jeder Seite (Stand AVV), eigene Seite #mehr/datenschutz. AVV-Datum pflegt OAK (portal_kunde.avv_abgeschlossen_am).
   Grundlage: references/datenschutz.md, references/datenschutz-ki.md, references/vorlagen/datenschutz/avv-muster.md.
   Kein Rechtsrat – finale Abnahme durch Datenschutzbeauftragte/n des Betriebs. */
"use strict";

function dsKunde(){ return (typeof MARKEN !== "undefined" ? MARKEN : []).find(x => x.slug === AKTIV) || null; }
function dsAvvText(k){
  if(k && k.avv_abgeschlossen_am){ const t = String(k.avv_abgeschlossen_am).split("-"); return "Auftragsverarbeitungsvertrag abgeschlossen am " + t[2] + "." + t[1] + "." + t[0]; }
  return "Auftragsverarbeitungsvertrag in Vorbereitung";
}
function dsFussZeichnen(){
  const f = document.querySelector("#appView .fuss"); if(!f) return;
  const k = dsKunde();
  f.innerHTML = `<div class="fuss-links">
      <a href="#mehr/aktuelles?teil=versionen" title="Versionshinweise">OAK EHS-Cockpit V${typeof EHS_VERSION !== "undefined" ? EHS_VERSION : "1.0"}</a><span>·</span>
      <a href="#mehr/datenschutz">Datenschutz</a><span>·</span>
      <span class="${k && k.avv_abgeschlossen_am ? "" : "ds-offen"}">${esc(dsAvvText(k))}</span><span>·</span>
      <a href="../impressum.html" target="_blank" rel="noopener">Impressum</a><span>·</span>
      <a href="../index.html" target="_blank" rel="noopener">oak-engineering.de</a>
    </div>`;
}

function renderDatenschutz(wrap){
  const k = dsKunde() || {};
  const betrieb = k.name || "der Betrieb";
  const istAdmin = (typeof ADMIN !== "undefined" && ADMIN);
  const sec = document.createElement("section"); sec.className = "sektion ds-seite";
  sec.innerHTML = `
    <div class="ds-stand ${k.avv_abgeschlossen_am ? "ds-ok" : "ds-warn"}"><b>${esc(dsAvvText(k))}</b>
      ${istAdmin ? `<button type="button" class="btn-klein" id="dsAvv">AVV-Datum eintragen</button>` : ""}</div>

    <h2 class="ul-bereich">Wer ist verantwortlich?</h2>
    <p><b>Verantwortlich</b> für die Verarbeitung ist <b>${esc(betrieb)}</b> als Arbeitgeber. Fragen zu Ihren Daten richten Sie bitte zuerst an den Betrieb${k.datenschutz_kontakt ? ` (Datenschutz: ${esc(k.datenschutz_kontakt)})` : ""}.</p>
    <p><b>Auftragsverarbeiter</b> ist Nikolai Krawielitzki – OAK engineering, Gögginger Straße 137, 86199 Augsburg, info@oak-engineering.de.
      OAK engineering betreibt das EHS-Cockpit im Auftrag des Betriebs und verarbeitet die Daten nur nach dessen Weisung (Art. 28 DSGVO).</p>

    <h2 class="ul-bereich">Wofür werden Daten verarbeitet?</h2>
    <p>Für die Organisation von Arbeitsschutz, Umweltschutz und Energie im Betrieb: Gefährdungsbeurteilungen, Betriebsanweisungen, Mängel,
      Unterweisungsnachweise, Meldungen von Vorfällen, Prüfungen von Maschinen,
      Prüf- und Fristentermine, Qualifikationsnachweise und die Vorsorgekartei. Rechtsgrundlage ist die Erfüllung der Arbeitgeberpflichten
      (Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit dem Arbeitsschutzgesetz, u. a. §§ 5, 6 und 12 ArbSchG).</p>
    <p><b>Keine Leistungs- oder Verhaltenskontrolle:</b> Unterweisungen werden ohne Punktestand gespeichert, das Logbuch dient nur der
      Nachvollziehbarkeit von Änderungen.</p>

    <h2 class="ul-bereich">Welche Daten?</h2>
    <ul class="ds-liste">
      <li><b>Zugang:</b> Name und E-Mail-Adresse der angemeldeten Nutzer.</li>
      <li><b>Unterweisungen:</b> Name, Tätigkeit, Arbeitgeber (Stamm/Leiharbeit), Datum, Module, bestanden ja/nein und die Unterschrift als Nachweis.</li>
      <li><b>Mängel und Maschinenprüfungen:</b> Beschreibung, Fotos von Anlagen und Befunden, Name und Datum bei Erfassung oder Erledigung.</li>
      <li><b>Vorfälle:</b> Beschreibung, Ort, Zeitpunkt, optional Foto. Der Name ist freiwillig – ohne Namen bleibt die Meldung anonym.</li>
      <li><b>Praktische Einarbeitung:</b> Name, Tätigkeit, Datum und wer die Einarbeitung bestätigt hat.</li>
      <li><b>Qualifikationsnachweise:</b> Name, Art des Nachweises (z. B. Staplerschein, Ersthelfer), Ausstellungs- und Ablaufdatum, Beauftragung, optional eine Kopie des Nachweises.</li>
      <li><b>Arbeitsmedizinische Vorsorge:</b> nur dass, wann und aus welchem Anlass Vorsorge stattgefunden hat und der nächste Termin (Vorsorgekartei nach § 3 Abs. 4 ArbMedVV) – keine Befunde oder Diagnosen. Die Angaben werden nach dem Ende der Beschäftigung gelöscht; die Person erhält vorher eine Kopie.</li>
      <li><b>Kalender und Aufgaben:</b> Termine sowie Name und Zeitpunkt, wenn ein Termin erledigt oder eine Aufgabe quittiert wird.</li>
      <li><b>Fragen zur Arbeitssicherheit:</b> Fragen und Antworten mit Namen – sichtbar für alle Nutzer des Betriebs.</li>
      <li><b>Logbuch:</b> wer wann was im EHS-Cockpit geändert hat.</li>
    </ul>

    <h2 class="ul-bereich">Wer verarbeitet die Daten technisch?</h2>
    <div class="tabelle-wrap"><table class="uw-tab">
      <thead><tr><th>Dienst</th><th>Aufgabe</th><th>Ort</th></tr></thead>
      <tbody>
        <tr><td>Supabase</td><td>Datenbank und Dateien des EHS-Cockpits</td><td>Rechenzentrum Frankfurt (EU)</td></tr>
        <tr><td>Resend</td><td>Versand von Benachrichtigungen per E-Mail</td><td>EU</td></tr>
        <tr><td>GitHub Pages</td><td>Auslieferung der Programmoberfläche – verarbeitet technische Zugriffsdaten (z. B. IP-Adresse), keine Inhalte des Cockpits</td><td>USA · EU-Standardvertragsklauseln / Data Privacy Framework</td></tr>
        <tr><td>Anthropic</td><td>KI-gestützte Auswertung von Begehungsnotizen und Fotos, wenn OAK engineering die Unterlagen erstellt – kein Training mit Kundendaten</td><td>USA · EU-Standardvertragsklauseln</td></tr>
      </tbody></table></div>

    <h2 class="ul-bereich">Wie lange?</h2>
    <p>Für die Dauer der Betreuung durch OAK engineering. Unterweisungsnachweise und Unterlagen bleiben erhalten, solange sie als Nachweis gebraucht
      werden. Die genauen Löschfristen werden im Auftragsverarbeitungsvertrag festgelegt; nach Ende der Betreuung werden die Daten an den Betrieb
      übergeben oder gelöscht.</p>

    <h2 class="ul-bereich">Sicherheit</h2>
    <p>Verschlüsselte Übertragung (HTTPS), Anmeldung mit persönlichem Zugang, Zugriff nur auf den eigenen Betrieb (auf Datenbankebene getrennt),
      Beschäftigte am Terminal ohne eigenen Login, Logbuch aller Änderungen.</p>

    <h2 class="ul-bereich">Ihre Rechte</h2>
    <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Widerspruch (Art. 15–21 DSGVO). Wenden Sie sich
      dazu an den Betrieb oder an OAK engineering. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren – in Bayern beim
      Bayerischen Landesamt für Datenschutzaufsicht (BayLDA).</p>
    <p class="uw-leise">Stand 17.09.2026 · wird mit dem Auftragsverarbeitungsvertrag abgestimmt.</p>`;
  wrap.appendChild(sec);
  const b = sec.querySelector("#dsAvv");
  if(b) b.addEventListener("click", async () => {
    const e = prompt("Datum des unterschriebenen Auftragsverarbeitungsvertrags (TT.MM.JJJJ), leer = in Vorbereitung:", k.avv_abgeschlossen_am ? String(k.avv_abgeschlossen_am).split("-").reverse().join(".") : "");
    if(e === null) return;
    let iso = null;
    if(e.trim()){ const m = e.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if(!m){ alert("Bitte als TT.MM.JJJJ eintragen."); return; }
      iso = m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
    try{
      await apiSend("PATCH", "/rest/v1/portal_kunde?slug=eq." + encodeURIComponent(AKTIV), { avv_abgeschlossen_am: iso }, "return=minimal");
      if(dsKunde()) dsKunde().avv_abgeschlossen_am = iso;
      dsFussZeichnen(); renderSektionen();
    }catch(err){ alert("Konnte nicht gespeichert werden: " + (err.message || err)); }
  });
}

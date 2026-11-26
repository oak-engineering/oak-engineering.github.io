"""OAK Adventskalender 2026: Inhalte der 24 Downloads (einseitige PDFs) – EINE Quelle fuer PDFs und Kalenderseite.

Jede Zeile ist gegen den amtlichen Originaltext geprueft (Faktenblatt: faktenblatt.md, Rechtsstand 26.11.2026).
Unsichere Aussagen sind bewusst weggelassen. Empfehlungen sind als solche gekennzeichnet.

  python intern/marketing/website/advent/advent_inhalte.py          # baut alle PDFs + advent.json
  python intern/marketing/website/advent/advent_inhalte.py --tag 3  # nur ein Blatt
"""
import argparse, json, shutil, subprocess, sys, tempfile
from pathlib import Path

HIER = Path(__file__).resolve().parent
REPO = HIER.parents[3]
STAND = "Rechtsstand 26.11.2026"
ASR = "Bei Einhaltung der ASR kann der Arbeitgeber davon ausgehen, die Anforderungen der ArbStättV zu erfüllen."
FUSS_ENDE = "Allgemeine Information, keine Rechtsberatung im Einzelfall · OAK engineering · www.oak-engineering.de"
E = " (Empfehlung)"

# Je Blatt: datei, titel, teaser (Kalenderseite, 2 Saetze), kopf (Tabellenkopf), zeilen, grundsatz, recht
B = {}

B[1] = dict(datei="lichterketten-pruefen", titel="Lichterkette prüfen, bevor sie leuchtet",
  teaser="Elektrische Deko ist ein elektrisches Betriebsmittel wie jedes andere. Die Checkliste zeigt, worauf Sie vor dem Einschalten achten.",
  kopf=["Nr.", "Prüfpunkt", "Fundstelle {34}"],
  zeilen=[
    ["Jede Lichterkette vor dem Einschalten auf sichtbare Mängel ansehen.", "§ 4 Abs. 5 BetrSichV · TRBS 1201 Nr. 5.2"],
    ["Anschlussleitung: keine Knicke, Quetschungen oder offenen Stellen.", "TRBS 1201 Nr. 5.2 Abs. 1"],
    ["Stecker: kein Bruch, keine losen Teile.", "TRBS 1201 Nr. 5.2 Abs. 1"],
    ["Gehäuse und Abdeckungen: keine Risse, keine Brüche.", "TRBS 1201 Nr. 5.2 Abs. 1"],
    ["Beschädigte Deko nicht benutzen, sofort aussortieren.", "§ 5 Abs. 2 BetrSichV · § 3 Abs. 2 DGUV V 3"],
    ["Draußen nur Geräte verwenden, die für diese Bedingungen geeignet sind.", "§ 5 Abs. 1 BetrSichV"],
    ["Private Lichterketten nur mit Erlaubnis des Arbeitgebers.", "§ 5 Abs. 4 BetrSichV"],
    ["Elektrische Betriebsmittel werden in festgelegten Abständen geprüft.", "§ 5 Abs. 1 Nr. 2 DGUV V 3"],
    ["Richtwert ortsveränderliche Geräte 6 Monate, im Büro höchstens 2 Jahre.", "DGUV V 3, DA Tab. 1B" + E],
    ["Die Prüfplakette ersetzt nicht den Blick vor der Benutzung.", "TRBS 1201 Nr. 8.3.1 Abs. 3"],
  ],
  grundsatz="Die Prüffristen legt der Arbeitgeber in der Gefährdungsbeurteilung fest (§ 3 Abs. 6 BetrSichV).",
  recht="BetrSichV §§ 3, 4, 5 · DGUV Vorschrift 3 §§ 3, 5 · TRBS 1201 (03/2019, geänd. 2025)")

B[2] = dict(datei="fluchtwege", titel="Fluchtwege: frei, breit genug, gut erkennbar",
  teaser="Kartons, Deko und Getränkekisten stehen im Dezember gern im Flur. Hier stehen die Mindestbreiten und was sonst für Fluchtwege gilt.",
  kopf=["Nr.", "Anforderung", "Fundstelle {34}"],
  zeilen=[
    ["Fluchtwege und Notausgänge ständig in voller Breite freihalten.", "§ 4 Abs. 4 ArbStättV · ASR A2.3 Nr. 4"],
    ["Breite Fluchtweg: bis 5 Personen 0,90 m, bis 20 Personen 1,00 m.", "ASR A2.3 Nr. 5 Tab. 1"],
    ["Bis 200 Personen 1,20 m, bis 300 Personen 1,80 m, bis 400 Personen 2,40 m.", "ASR A2.3 Nr. 5 Tab. 1"],
    ["Türen im Fluchtweg: bis 5 Personen 0,80 m, bis 50 0,90 m, bis 100 1,00 m.", "ASR A2.3 Nr. 5 Tab. 1"],
    ["Fluchtweg höchstens 35 m, bei erhöhter Brandgefahr ohne Löschanlage 25 m.", "ASR A2.3 Nr. 5 Abs. 2"],
    ["Fluchtwege mit Zeichen E001 oder E002 und Richtungspfeil kennzeichnen.", "ASR A2.3 Nr. 8.2 · ArbStättV Anh. 2.3"],
    ["Notausgangstüren öffnen in Fluchtrichtung.", "ArbStättV Anh. 2.3 Abs. 2 · ASR A2.3 Nr. 7"],
    ["Türen im Fluchtweg öffnen ohne Schlüssel, Karte oder Code.", "ArbStättV Anh. 2.3 Abs. 2 · ASR A2.3 Nr. 7"],
    ["Flucht- und Rettungsplan, wenn Lage, Größe oder Nutzung es erfordern.", "§ 4 Abs. 4 ArbStättV · ASR A2.3 Nr. 10"],
    ["Mindestens jährlich zu Fluchtwegen und Verhalten im Notfall unterweisen.", "ASR A2.3 Nr. 11 Abs. 1"],
    ["Mit Fluchtplan regelmäßig Räumung üben. Bewährt sind 2 bis 5 Jahre.", "§ 4 Abs. 4 ArbStättV · ASR A2.3 Nr. 11" + E],
  ],
  grundsatz=ASR,
  recht="ArbStättV § 4 Abs. 4, Anhang Nr. 2.3 · ASR A2.3 (03/2022, geänd. GMBl 2024 S. 913)")

B[3] = dict(datei="verbandkasten", titel="Verbandkasten-Check",
  teaser="Wie viele Verbandkästen braucht Ihr Betrieb und wie weit darf der nächste entfernt sein? Die Tabelle zeigt es auf einen Blick.",
  kopf=["Betriebsart", "Beschäftigte", "Verbandkasten {30}"],
  zeilen=[
    ["Verwaltung und Handel", "1 bis 50", "1 kleiner"],
    ["Verwaltung und Handel", "51 bis 300", "1 großer"],
    ["Verwaltung und Handel", "301 bis 600", "2 große"],
    ["Verwaltung und Handel", "je 300 weitere", "1 großer mehr"],
    ["Herstellung, Verarbeitung u. ä.", "1 bis 20", "1 kleiner"],
    ["Herstellung, Verarbeitung u. ä.", "21 bis 100", "1 großer"],
    ["Herstellung, Verarbeitung u. ä.", "101 bis 200", "2 große"],
    ["Herstellung, Verarbeitung u. ä.", "je 100 weitere", "1 großer mehr"],
  ],
  extra=("Außerdem gilt", [
    "Statt eines großen dürfen zwei kleine Verbandkästen verwendet werden (ASR A4.3 Nr. 4 Abs. 2).",
    "Verbandkasten in höchstens 100 m Weg oder einer Geschosshöhe erreichbar (ASR A4.3 Nr. 4 Abs. 3).",
    "Material nach Verbrauch oder Ablauf des Verfallsdatums ersetzen (§ 25 Abs. 2 DGUV V 1, ASR A4.3 Nr. 4).",
    "Aushang mit Notruf, Ersthelfern, Ärzten und Krankenhäusern aktuell halten (§ 24 Abs. 5 DGUV V 1).",
    "In Einsatzfahrzeugen genügt der Kfz-Verbandkasten als kleiner Verbandkasten (ASR A4.3 Nr. 4 Abs. 2).",
  ]),
  grundsatz=ASR,
  recht="DGUV Vorschrift 1 §§ 24, 25 · ASR A4.3 Nr. 4 Tab. 1 (12/2010, geänd. GMBl 2024 S. 914)")

B[4] = dict(datei="leiter-check", titel="Leiter-Check in 60 Sekunden",
  teaser="Für den Stern auf dem Baum gilt dasselbe wie im Lager: Leiter oder Tritt, nie der Drehstuhl. Die Checkliste passt an jede Leiter.",
  kopf=["Nr.", "Prüfpunkt", "Fundstelle {34}"],
  zeilen=[
    ["Leiter und Tritt vor jeder Benutzung auf Schäden ansehen.", "§ 4 Abs. 5 BetrSichV · DGUV I 208-016"],
    ["Holme und Schenkel: nicht verbogen, gerissen oder korrodiert.", "TRBS 1201 Nr. 5.2 · DGUV I 208-016"],
    ["Sprossen und Stufen: alle vorhanden, fest, nicht stark abgenutzt.", "DGUV I 208-016 Anhang 2" + E],
    ["Leiterfüße und Fußkappen: vorhanden und nicht abgenutzt.", "DGUV I 208-016 Anhang 2" + E],
    ["Spreizsicherung vorhanden und vor jeder Benutzung gespannt.", "TRBS 1201 Nr. 5.3 · DGUV I 208-016"],
    ["Leiter frei von Öl, Fett, Farbe und Schmutz.", "DGUV I 208-016 Anhang 2" + E],
    ["Mängel melden. Defekte Leiter nicht benutzen und aussondern.", "§ 5 Abs. 2 BetrSichV"],
    ["Nur geeignete Leitern. Stuhl, Hocker, Tisch oder Kiste sind kein Aufstieg.", "BetrSichV Anh. 1 Nr. 3.3.1 · DGUV I 208-016"],
    ["Stehleiter: obere zwei Stufen nicht besteigen.", "DGUV I 208-016 Nr. 5.2" + E],
    ["Leiter im Freien nicht bei Vereisung, Schneeglätte oder starkem Wind.", "BetrSichV Anh. 1 Nr. 3.1.8"],
    ["Wiederkehrende Prüfung durch befähigte Person, Frist laut GBU.", "§ 3 Abs. 6, § 14 BetrSichV"],
  ],
  grundsatz="Empfohlen wird eine Prüfung mindestens einmal jährlich (DGUV Information 208-016 Nr. 6).",
  recht="BetrSichV §§ 3, 4, 5, 14 und Anhang 1 Nr. 3 · TRBS 1201 · DGUV Information 208-016 (08/2022)")

B[5] = dict(datei="feuerloescher", titel="Feuerlöscher: wie viele, wo, wie oft",
  teaser="Die Grundausstattung richtet sich nach der Fläche und wird in Löschmitteleinheiten gerechnet. Hier stehen Tabelle, Abstände und Wartung.",
  kopf=["Grundfläche bis", "Löschmitteleinheiten (LE) {30}", "Grundfläche bis", "LE {18}"],
  zeilen=[
    ["50 m²", "6", "500 m²", "21"],
    ["100 m²", "9", "600 m²", "24"],
    ["200 m²", "12", "700 m²", "27"],
    ["300 m²", "15", "800 m²", "30"],
    ["400 m²", "18", "1.000 m²", "36 · je weitere 250 m² + 6"],
  ],
  extra=("So setzen Sie es um", [
    "Umrechnung: 21A oder 113B = 6 LE, 43A oder 183B = 12 LE (ASR A2.2 Tab. 2).",
    "Angerechnet werden in der Regel Löscher mit mindestens 6 LE, je Geschoss mindestens 6 LE (Nr. 5.2).",
    "Höchstens 20 m Laufweg bis zum nächsten Löscher, bei erhöhter Brandgefahr in der Regel 5 m (Nr. 5.3, 6.2).",
    "Gut sichtbar und erreichbar, mit Zeichen F001 gekennzeichnet (ArbStättV Anh. 2.2, ASR A2.2 Nr. 5.3).",
    "Alle 2 Jahre durch Fachkundige warten. Kürzere Herstellerfristen gelten vor (ASR A2.2 Nr. 7.4.2).",
    "Prüfung dokumentieren und am Löscher kennzeichnen, z. B. mit Prüfetikett (ASR A2.2 Nr. 7.4.1).",
  ]),
  grundsatz="Die Tabelle gilt bei normaler Brandgefährdung (ASR A2.2 Nr. 5.2 Tab. 3). " + ASR,
  recht="ArbStättV § 4 Abs. 3, Anhang Nr. 2.2 · ASR A2.2 (05/2018, geänd. GMBl 2025 S. 365)")

B[6] = dict(datei="sicher-durch-den-winter", titel="Sicher durch den Winter: Glätte und Stürze",
  teaser="Stürze auf Glätte gehören im Winter zu den häufigsten Unfällen. Die Checkliste zeigt, was auf dem Betriebsgelände geregelt sein muss.",
  kopf=["Nr.", "Maßnahme", "Fundstelle {34}"],
  zeilen=[
    ["Wege, Treppen, Rampen und Eingänge im Freien bei jedem Wetter sicher halten.", "ASR A1.8 Nr. 4.1 Abs. 8"],
    ["Winterdienst in der Gefährdungsbeurteilung festlegen.", "ASR A1.8 Nr. 5 · § 5 ArbSchG"],
    ["Plan: welche Wege, wer räumt, ab wann, mit welchem Mittel.", "ASR A1.8 Nr. 5 Abs. 1"],
    ["Bei Glätte Außenwege angemessen räumen und bei Bedarf streuen.", "ASR A1.5 Nr. 6"],
    ["Eingänge so gestalten, dass Nässe und Schmutz nicht zur Rutschgefahr werden.", "ASR A1.5 Nr. 6"],
    ["Sauberlaufmatten gegen Verrutschen sichern und stolperfrei verlegen.", "ASR A1.5 Nr. 6 · ArbStättV Anh. 1.5"],
    ["Nasse oder verschmutzte Böden innen sofort beseitigen.", "§ 4 Abs. 2 ArbStättV"],
    ["Wege während der Nutzung beleuchten. Fußwege mindestens 5 lx, Parkplätze 10 lx.", "ASR A1.8 Nr. 5 · ASR A3.4 Anh. 4"],
    ["Zu Wegen, Verkehrsregeln und Parkflächen auf dem Gelände unterweisen.", "ASR A1.8 Nr. 5 Abs. 2"],
    ["Geeignetes Schuhwerk für Arbeit im Freien über die GBU festlegen.", "§ 5 ArbSchG · ArbStättV Anh. 5.1"],
    ["Gegenüber Besuchern haftet der Betrieb bei Verschulden auf Schadensersatz.", "§ 823 Abs. 1 BGB"],
  ],
  grundsatz="Öffentliche Gehwege vor dem Grundstück regeln Landesrecht und Gemeindesatzung. Zeiten bitte vor Ort prüfen.",
  recht="ArbSchG § 5 · ArbStättV § 4, Anhang 1.5, 5.1 · ASR A1.8 (geänd. 2024) · ASR A1.5 (geänd. 2025) · ASR A3.4 · § 823 BGB")

B[7] = dict(datei="beleuchtung", titel="Wie hell muss es sein?",
  teaser="Im Winter beginnt und endet die Schicht im Dunkeln. Die Tabelle zeigt die Mindestwerte der Beleuchtung innen und außen.",
  kopf=["Bereich", "Mindestwert {18}", "Fundstelle {26}"],
  zeilen=[
    ["Flure und Verkehrsflächen ohne Fahrzeugverkehr", "50 lx", "ASR A3.4 Anh. 3 Nr. 1.1"],
    ["Flure im Bereich von Absätzen und Stufen · Treppen", "100 lx", "Anh. 3 Nr. 1.1a, 1.3"],
    ["Verkehrsflächen mit Fahrzeugverkehr · Laderampen", "150 lx", "Anh. 3 Nr. 1.2, 1.4"],
    ["Lager mit gleichartigem oder großteiligem Lagergut", "50 lx", "Anh. 3 Nr. 2.2"],
    ["Lager mit Suchaufgabe / mit Leseaufgabe", "100 / 200 lx", "Anh. 3 Nr. 2.3, 2.4"],
    ["Versand und Verpackung", "300 lx", "Anh. 3 Nr. 2.1"],
    ["Pausenräume, Kantinen, Toiletten, Umkleiden", "200 lx", "Anh. 3 Nr. 3.1, 3.2, 3.4"],
    ["Büro: Ablegen, Kopieren", "300 lx", "Anh. 3 Nr. 4.1"],
    ["Büro: Schreiben, Lesen, Datenverarbeitung", "500 lx", "Anh. 3 Nr. 4.2"],
    ["Erste-Hilfe-Raum", "500 lx", "Anh. 3 Nr. 3.5"],
    ["Außen: Fußwege · Parkplätze · Toranlagen", "5 · 10 · 50 lx", "ASR A3.4 Anh. 4"],
  ],
  grundsatz="Werte sind Mindestwerte der mittleren Beleuchtungsstärke. Bei Bestandsanlagen, bei denen das offensichtlich unverhältnismäßig ist, wird einzeln beurteilt (ASR A3.4 Nr. 6.2, 7.1).",
  recht="ArbStättV Anhang Nr. 3.4 · ASR A3.4 (Ausgabe 05/2023) Anhang 3 und 4")

B[8] = dict(datei="pruefung-elektrogeraete", titel="Elektrogeräte prüfen: wer, wann, wie oft",
  teaser="Wasserkocher, Heizlüfter, Verlängerungskabel: Ortsveränderliche Geräte brauchen eine festgelegte Prüffrist. Hier stehen die Richtwerte.",
  kopf=["Nr.", "Regel", "Fundstelle {34}"],
  zeilen=[
    ["Der Arbeitgeber legt Art, Umfang und Fristen der Prüfungen in der GBU fest.", "§ 3 Abs. 6 BetrSichV"],
    ["Fristen so wählen, dass Mängel rechtzeitig erkannt werden.", "§ 5 Abs. 1 DGUV V 3 · § 14 BetrSichV"],
    ["Gilt für Geräte, Verlängerungs- und Anschlussleitungen mit Stecker.", "DGUV V 3, DA Tab. 1B"],
    ["Richtwert alle 6 Monate, auf Baustellen alle 3 Monate.", "DGUV V 3, DA Tab. 1B" + E],
    ["Höchstwert Werkstatt, Fertigung und Baustelle: 1 Jahr.", "DGUV V 3, DA Tab. 1B" + E],
    ["Höchstwert Büro und ähnliche Bedingungen: 2 Jahre.", "DGUV V 3, DA Tab. 1B" + E],
    ["Verlängern ist möglich, wenn die Fehlerquote unter 2 % liegt.", "DGUV V 3, DA Tab. 1B" + E],
    ["Prüfer: Elektrofachkraft, mit Messgerät auch elektrotechnisch unterwiesene Person.", "DGUV V 3, DA Tab. 1B"],
    ["FI-Schutzschalter fest installiert: Prüftaste alle 6 Monate drücken.", "DGUV V 3, DA Tab. 1A" + E],
    ["Ergebnis aufzeichnen: Art, Umfang, Ergebnis, Name des Prüfers.", "§ 14 Abs. 7 BetrSichV"],
    ["Vor jeder Benutzung zusätzlich auf sichtbare Mängel kontrollieren.", "§ 4 Abs. 5 BetrSichV"],
  ],
  grundsatz="Die Werte der Tabellen 1A und 1B stehen in den Durchführungsanweisungen. Pflicht ist die Festlegung durch den Arbeitgeber.",
  recht="BetrSichV §§ 3 Abs. 6, 4 Abs. 5, 14 · DGUV Vorschrift 3 § 5 mit DA (Tab. 1A, 1B) · TRBS 1201")

B[9] = dict(datei="raumtemperatur", titel="Wie warm muss es am Arbeitsplatz sein?",
  teaser="Im Büro sind es mindestens 20 °C, bei schwerer Arbeit im Stehen darf es kühler sein. Die Tabelle zeigt alle Mindestwerte.",
  kopf=["Körperhaltung", "leichte Arbeit {18}", "mittelschwer {18}", "schwer {18}"],
  zeilen=[
    ["Sitzen", "+20 °C", "+19 °C", "kein Wert"],
    ["Stehen oder Gehen", "+19 °C", "+17 °C", "+12 °C"],
  ],
  extra=("Außerdem gilt", [
    "Die Werte gelten während der gesamten Nutzungsdauer (ASR A3.5 Nr. 4.2 Abs. 1).",
    "Pausen-, Sanitär-, Kantinen- und Erste-Hilfe-Räume: mindestens +21 °C (Nr. 4.2 Abs. 4).",
    "Waschräume mit Duschen: mindestens +24 °C (Nr. 4.2 Abs. 6).",
    "Gemessen wird in 0,6 m Höhe im Sitzen und 1,1 m Höhe im Stehen (Nr. 4.1 Abs. 6).",
    "Zu kalt trotz Heizung? Zuerst Technik, z. B. Heizstrahler oder Heizmatten (Nr. 4.2 Abs. 2).",
    "Dann Organisation, z. B. Aufwärmzeiten. Zuletzt geeignete Kleidung (Nr. 4.2 Abs. 2).",
    "Leicht = ruhiges Sitzen oder Stehen, Hand- und Armarbeit. Schwer = schwere Arbeit mit Rumpf und Beinen (Tab. 2).",
  ]),
  grundsatz=ASR,
  recht="ArbStättV § 3a, Anhang Nr. 3.5 · ASR A3.5 (06/2010, geänd. GMBl 2022 S. 198) Tab. 1 und 2")

B[10] = dict(datei="richtig-lueften", titel="Richtig lüften im Winter",
  teaser="Stoßlüften statt Dauerkipp: kurz und kräftig spart Heizenergie und hält die Luft gut. Hier stehen die Werte der ASR.",
  kopf=["Nr.", "Regel", "Fundstelle {30}"],
  zeilen=[
    ["Unter 1000 ppm CO2: keine weiteren Maßnahmen nötig.", "ASR A3.6 Nr. 4.2 Tab. 1"],
    ["1000 bis 2000 ppm: Lüftungsverhalten prüfen, Lüftungsplan aufstellen.", "ASR A3.6 Nr. 4.2 Tab. 1"],
    ["Über 2000 ppm: verstärkt lüften oder weniger Personen im Raum.", "ASR A3.6 Nr. 4.2 Tab. 1"],
    ["Maßnahmen ab 1000 ppm in der Gefährdungsbeurteilung festhalten.", "ASR A3.6 Nr. 4.2 Abs. 2"],
    ["Gemessen wird nur bei begründetem Verdacht, ca. 1,50 m hoch.", "ASR A3.6 Nr. 4.2 Abs. 3"],
    ["Stoßlüften heißt kurz und intensiv, ca. 3 bis 10 Minuten.", "ASR A3.6 Nr. 5.4 Abs. 1"],
    ["Büro nach 60 Minuten lüften, Besprechungsraum nach 20 Minuten.", "ASR A3.6 Nr. 5.4 Abs. 2" + E],
    ["Dauer im Winter 3 Minuten, Frühling und Herbst 5, Sommer bis 10 Minuten.", "ASR A3.6 Nr. 5.4 Abs. 3" + E],
    ["Querlüften über gegenüberliegende Fenster braucht weniger Öffnungsfläche.", "ASR A3.6 Nr. 5.3 Tab. 3"],
    ["Zugluft möglichst vermeiden.", "ASR A3.6 Nr. 5.2 Abs. 4"],
  ],
  grundsatz=ASR,
  recht="ArbStättV § 3a, Anhang Nr. 3.6 · ASR A3.6 (01/2012, geänd. GMBl 2018 S. 474)")

B[11] = dict(datei="fahrzeuge-wintertauglich", titel="Firmenfahrzeuge fit für den Winter",
  teaser="Die Winterreifenpflicht hängt am Wetter, nicht am Kalender. Die Checkliste zeigt, was Halter und Fahrer vor dem Winter prüfen.",
  kopf=["Nr.", "Prüfpunkt", "Fundstelle {30}"],
  zeilen=[
    ["Bei Glatteis, Schneeglätte, Schneematsch, Eis- oder Reifglätte nur mit Winterreifen fahren.", "§ 2 Abs. 3a StVO"],
    ["Winterreifen auf allen Rädern. Maßgeblich ist das Alpine-Symbol.", "§ 2 Abs. 3a StVO · § 36 Abs. 4 StVZO"],
    ["Reifen nur mit M+S ohne Alpine-Symbol reichen seit 1.10.2024 nicht mehr.", "§ 52 Abs. 2 StVO"],
    ["Profiltiefe im Hauptprofil mindestens 1,6 mm.", "§ 36 Abs. 3 StVZO"],
    ["Als Halter keine Fahrt mit nicht vorschriftsmäßigem Fahrzeug zulassen.", "§ 31 Abs. 2 StVZO"],
    ["Scheiben frei von Eis und Schnee, Kennzeichen gut lesbar.", "§ 23 Abs. 1 StVO"],
    ["Beleuchtung betriebsbereit, nicht verdeckt und nicht verschmutzt.", "§ 23 Abs. 1, § 17 Abs. 1 StVO"],
    ["Scheibenwischer müssen ein ausreichendes Blickfeld schaffen.", "§ 40 Abs. 2 StVZO"],
    ["Frostschutz in die Scheibenwaschanlage.", "Empfehlung, keine Pflichtnorm"],
    ["Fahrzeuge mindestens jährlich durch Sachkundige prüfen, schriftlich festhalten.", "§ 57 DGUV V 70"],
    ["Fahrer prüfen vor jeder Schicht die Sicherheitseinrichtungen und melden Mängel.", "§ 36 DGUV V 70"],
    ["Fahrer mindestens jährlich unterweisen und dokumentieren.", "§ 4 DGUV V 1 · § 12 ArbSchG"],
  ],
  grundsatz="Bußgeld bei Glätte ohne Winterreifen: Fahrer 60 €, mit Behinderung 80 €, Halter 75 € (BKatV Nr. 5a, 5a.1, 213a).",
  recht="StVO §§ 2 Abs. 3a, 17, 23, 52 · StVZO §§ 31, 36, 40 · BKatV (Stand 30.01.2026) · DGUV Vorschrift 70 §§ 36, 57 · DGUV Vorschrift 1 § 4")

B[12] = dict(datei="wegeunfall", titel="Wegeunfall: was versichert ist, was zu tun ist",
  teaser="Ein Sturz auf dem Weg zur Arbeit ist ein Arbeitsunfall. Das Merkblatt zeigt, welche Wege versichert sind und welche Fristen gelten.",
  kopf=["Nr.", "Regel", "Fundstelle {30}"],
  zeilen=[
    ["Versichert ist der unmittelbare Weg zur Arbeit und zurück.", "§ 8 Abs. 2 Nr. 1 SGB VII"],
    ["Auch der Umweg, um Kinder wegen der Arbeit in fremde Obhut zu geben.", "§ 8 Abs. 2 Nr. 2a SGB VII"],
    ["Auch der Umweg für eine Fahrgemeinschaft mit Berufstätigen.", "§ 8 Abs. 2 Nr. 2b SGB VII"],
    ["Homeoffice: Der Weg zur Kinderbetreuung und zurück ist versichert.", "§ 8 Abs. 2 Nr. 2a SGB VII"],
    ["Ein Wegeunfall ist ein Arbeitsunfall und genauso anzuzeigen.", "§ 8 Abs. 2, § 193 SGB VII"],
    ["Unfallanzeige bei Tod oder mehr als 3 Tagen Arbeitsunfähigkeit.", "§ 193 Abs. 1 SGB VII"],
    ["Frist: binnen 3 Tagen, nachdem Sie vom Unfall erfahren haben.", "§ 193 Abs. 4 SGB VII"],
    ["Betriebs- oder Personalrat unterschreibt mit. Sifa und Betriebsarzt informieren.", "§ 193 Abs. 5 SGB VII"],
    ["Kopie der Anzeige an die Arbeitsschutzbehörde.", "§ 193 Abs. 7 SGB VII"],
    ["Beschäftigte melden jeden Unfall unverzüglich im Betrieb.", "§ 28 Abs. 2 DGUV V 1"],
    ["Jede Erste-Hilfe-Leistung dokumentieren, 5 Jahre aufbewahren.", "§ 24 Abs. 6 DGUV V 1"],
    ["Auf die Vorstellung beim Durchgangsarzt hinwirken.", "§ 24 Abs. 4 DGUV V 1"],
  ],
  grundsatz="Die Form der Erste-Hilfe-Dokumentation ist frei, z. B. Meldeblock oder elektronisch (DGUV Regel 100-001 Nr. 4.6.6).",
  recht="SGB VII § 8 Abs. 2, § 193 · DGUV Vorschrift 1 §§ 24, 28")

B[13] = dict(datei="ersthelfer", titel="Wie viele Ersthelfer braucht Ihr Betrieb?",
  teaser="Über die Feiertage fehlen oft genau die Ausgebildeten. Hier steht, wie viele Ersthelfer Sie brauchen und wann sie zur Fortbildung müssen.",
  kopf=["Nr.", "Regel", "Fundstelle {30}"],
  zeilen=[
    ["2 bis 20 anwesende Versicherte: mindestens 1 Ersthelfer.", "§ 26 Abs. 1 Nr. 1 DGUV V 1"],
    ["Mehr als 20 Anwesende, Verwaltung und Handel: 5 %.", "§ 26 Abs. 1 Nr. 2a DGUV V 1"],
    ["Mehr als 20 Anwesende, sonstige Betriebe: 10 %.", "§ 26 Abs. 1 Nr. 2b DGUV V 1"],
    ["Beispiel: 40 Beschäftigte in der Produktion = 4 Ersthelfer.", "§ 26 Abs. 1 DGUV V 1"],
    ["Gezählt wird je Betriebsstätte. Urlaub, Krankheit und Schichten einplanen.", "DGUV Regel 100-001 Nr. 4.8.1" + E],
    ["Ausbildung nur bei einer ermächtigten Stelle, 9 Unterrichtseinheiten.", "§ 26 Abs. 2 DGUV V 1 · DGUV R 100-001"],
    ["Fortbildung in der Regel alle 2 Jahre, 9 Unterrichtseinheiten.", "§ 26 Abs. 3 DGUV V 1 · DGUV R 100-001"],
    ["Lassen Sie sich die Fortbildungsnachweise vorlegen.", "§ 26 Abs. 3 DGUV V 1"],
    ["Betriebssanitäter ab mehr als 1500 Anwesenden je Betriebsstätte.", "§ 27 Abs. 1 Nr. 1 DGUV V 1"],
    ["Ab mehr als 250, wenn Art, Schwere und Zahl der Unfälle es erfordern.", "§ 27 Abs. 1 Nr. 2 DGUV V 1"],
    ["Aushang mit Notruf, Ersthelfern, Ärzten und Krankenhäusern aktuell halten.", "§ 24 Abs. 5 DGUV V 1"],
  ],
  extra=("Unsere Ersthelfer", ["Name · Bereich · Telefon · Fortbildung bis: ______________________________",
                               "Name · Bereich · Telefon · Fortbildung bis: ______________________________",
                               "Name · Bereich · Telefon · Fortbildung bis: ______________________________"]),
  grundsatz="Von der Ersthelferzahl darf nur im Einvernehmen mit dem Unfallversicherungsträger abgewichen werden (§ 26 Abs. 1 DGUV V 1).",
  recht="DGUV Vorschrift 1 §§ 24, 26, 27 · DGUV Regel 100-001 (06/2025)")

B[14] = dict(datei="psychische-belastung", titel="Checkliste psychische Belastung",
  teaser="Termindruck vor Weihnachten ist eine psychische Belastung, und die gehört in die Gefährdungsbeurteilung. Die Checkliste führt durch die Merkmale.",
  kopf=["Nr.", "Prüffrage", "Grundlage {30}"],
  zeilen=[
    ["Psychische Belastung ist Pflichtteil jeder Gefährdungsbeurteilung.", "§ 5 Abs. 3 Nr. 6 ArbSchG"],
    ["Arbeitsinhalt: Handlungsspielraum, Abwechslung, Information, Qualifikation?", "GDA-Leitlinie Anh. 3"],
    ["Emotionale Beanspruchung: Konflikte, Gewalt, belastende Ereignisse?", "GDA-Leitlinie Anh. 3"],
    ["Arbeitsorganisation: Zeitdruck, Unterbrechungen, klare Zuständigkeiten?", "GDA-Leitlinie Anh. 3"],
    ["Arbeitszeit: Dauer, Schicht und Nacht, Planbarkeit, Pausen, Erreichbarkeit?", "GDA-Leitlinie Anh. 3 · § 5 Abs. 3 Nr. 4 ArbSchG"],
    ["Soziale Beziehungen: Unterstützung, Rückmeldung, Umgang mit Konflikten?", "GDA-Leitlinie Anh. 3"],
    ["Arbeitsmittel: geeignet und gut bedienbar, auch Software?", "GDA-Leitlinie Anh. 3"],
    ["Arbeitsumgebung: Lärm, Klima, Licht, Gerüche, räumliche Enge?", "GDA-Leitlinie Anh. 3"],
    ["Vorgehen planen, Arbeitsbereiche und Tätigkeiten festlegen.", "GDA-Empfehlungen Nr. 3.1, 3.2"],
    ["Gefährdungen ermitteln und beurteilen, Beschäftigte beteiligen.", "GDA-Empfehlungen Nr. 3.3"],
    ["Maßnahmen umsetzen, Verhältnisse vor Verhalten.", "GDA-Empfehlungen Nr. 3.4 · § 4 ArbSchG"],
    ["Wirksamkeit prüfen, fortschreiben, dokumentieren.", "GDA-Empfehlungen Nr. 3.5 bis 3.7 · § 6 ArbSchG"],
  ],
  grundsatz="Die GDA-Leitlinie ist der Prüfmaßstab der Aufsicht. Sie ist keine Rechtsnorm, zeigt aber, worauf bei Kontrollen geachtet wird.",
  recht="ArbSchG §§ 4, 5 Abs. 3, 6 · GDA-Leitlinie Psychische Belastung (Anhang 3 Stand 06/2024) · GDA-Empfehlungen (4. Aufl., aktual. 01/2026)")

B[15] = dict(datei="bildschirmarbeitsplatz", titel="Checkliste Bildschirmarbeitsplatz",
  teaser="Jahresendspurt am Bildschirm: Die Checkliste zeigt, was der Arbeitsplatz können muss und welche Vorsorge Sie anbieten.",
  kopf=["Nr.", "Prüfpunkt", "Fundstelle {30}"],
  zeilen=[
    ["Augenbelastung und Sehvermögen in der Gefährdungsbeurteilung berücksichtigen.", "§ 3 Abs. 1 ArbStättV"],
    ["Bildschirmarbeit regelmäßig durch andere Tätigkeiten oder Pausen unterbrechen.", "ArbStättV Anh. 6.1 Abs. 2"],
    ["Bewährt: kurze Erholungszeiten von ca. 5 Minuten je Stunde.", "ASR A6 Nr. 5.3" + E],
    ["Bildschirm ohne störende Spiegelungen und Blendung aufstellen.", "ArbStättV Anh. 6.1 Abs. 4"],
    ["Sehabstand mindestens 500 mm.", "ASR A6 Nr. 6.3.1"],
    ["Arbeitsfläche mindestens 1600 x 800 mm, bei einem Bildschirm 1200 mm breit.", "ASR A6 Nr. 6.3.10"],
    ["Vor der Tastatur Platz zum Auflegen der Handballen.", "ArbStättV Anh. 6.1 Abs. 5"],
    ["Bürostuhl drehbar, stufenlos höhenverstellbar, Rückenlehne neigbar.", "ASR A6 Nr. 6.3.12"],
    ["Fußstütze und Vorlagenhalter, wenn sonst keine gute Haltung möglich ist.", "ArbStättV Anh. 6.1 Abs. 7"],
    ["Zeichengröße, Helligkeit und Kontrast einstellbar, Bild flimmerfrei.", "ArbStättV Anh. 6.2"],
    ["Augenuntersuchung als Angebotsvorsorge anbieten, vor Beginn und regelmäßig.", "ArbMedVV Anh. Teil 4 Abs. 2 Nr. 1"],
    ["Bildschirmbrille zur Verfügung stellen, wenn die normale Brille nicht geeignet ist.", "ArbMedVV Anh. Teil 4 Abs. 2 Nr. 1"],
  ],
  grundsatz=ASR,
  recht="ArbStättV § 3, Anhang Nr. 6 · ASR A6 Bildschirmarbeit (07/2024) · ArbMedVV § 5, Anhang Teil 4")

B[16] = dict(datei="arbeiten-bei-kaelte", titel="Arbeiten im Freien bei Kälte",
  teaser="Wer draußen arbeitet, braucht Schutz vor Witterung und einen Ort zum Aufwärmen. Hier steht, was dazu wirklich geregelt ist.",
  kopf=["Nr.", "Regel", "Fundstelle {30}"],
  zeilen=[
    ["Arbeitsplätze im Freien bei jeder Witterung sicher erreichbar und nutzbar halten.", "ArbStättV Anh. 5.1"],
    ["Vor Witterung schützen oder geeignete PSA bereitstellen.", "ArbStättV Anh. 5.1"],
    ["PSA muss zu den Bedingungen passen und ergonomisch sein.", "§ 2 Abs. 1 PSA-BV"],
    ["Kälte als physikalische Einwirkung in der Gefährdungsbeurteilung bewerten.", "§ 5 Abs. 3 Nr. 2 ArbSchG"],
    ["Überwiegend Arbeit im Freien: Pausenraum unabhängig von der Beschäftigtenzahl.", "ASR A4.2 Nr. 4.1 Abs. 3"],
    ["Gleiches gilt bei erhöhter Gesundheitsgefährdung durch Kälte oder Nässe.", "ASR A4.2 Nr. 4.1 Abs. 3"],
    ["Pausenraum zum Aufwärmen: mindestens +21 °C während der Nutzung.", "ASR A3.5 Nr. 4.2 Abs. 4"],
    ["Baustellen: Umkleiden, Waschen und Wärmen geschützt vor Witterung ermöglichen.", "ArbStättV Anh. 5.2"],
    ["Kalte Halle: erst Technik, dann Aufwärmzeiten, dann Kleidung.", "ASR A3.5 Nr. 4.2 Abs. 2"],
    ["Extreme Kälte ab minus 25 °C: arbeitsmedizinische Pflichtvorsorge.", "ArbMedVV Anh. Teil 3"],
    ["Zu Kälte unterweisen, mindestens jährlich, dokumentiert.", "§ 12 ArbSchG · § 4 DGUV V 1"],
  ],
  grundsatz="Feste Aufwärmzeiten oder Temperaturgrenzen für Arbeit im Freien gibt es nicht. Sie ergeben sich aus der Gefährdungsbeurteilung.",
  recht="ArbStättV Anhang Nr. 5.1, 5.2 · ArbSchG §§ 5, 12 · PSA-BV § 2 · ArbMedVV Anhang Teil 3 · ASR A3.5, ASR A4.2")

B[17] = dict(datei="weihnachtsfeier", titel="Betriebsfeier: wann sind Sie unfallversichert?",
  teaser="Die Weihnachtsfeier kann gesetzlich unfallversichert sein. Das Merkblatt zeigt die Bedingungen aus der Rechtsprechung des Bundessozialgerichts.",
  kopf=["Nr.", "Bedingung", "Fundstelle {30}"],
  zeilen=[
    ["Unfälle bei versicherter Tätigkeit sind Arbeitsunfälle. Die Feier kann dazu zählen.", "§ 8 Abs. 1 SGB VII"],
    ["Die Leitung muss die Feier wollen, billigen und fördern. Selbst einladen muss sie nicht.", "BSG B 2 U 19/14 R, Rn. 14"],
    ["Veranstalter kann auch der Betriebsrat oder ein Team im Auftrag der Leitung sein.", "BSG B 2 U 19/14 R, Rn. 14"],
    ["Die Feier steht allen Beschäftigten offen, bei Teamfeiern allen im Team.", "BSG B 2 U 19/14 R · B 2 U 8/20 R"],
    ["Teamfeiern sind versichert, wenn die Leitung sie billigt und die Teamleitung teilnimmt.", "BSG B 2 U 19/14 R, Rn. 15 bis 17"],
    ["Die Chefin oder der Chef muss nicht persönlich dabei sein.", "BSG B 2 U 19/14 R, Rn. 16, 17"],
    ["Zweck ist, Betriebsklima und Zusammenhalt zu stärken. Reine Freizeit reicht nicht.", "BSG B 2 U 8/20 R, Rn. 19"],
    ["Das Programm muss alle ansprechen. Ein reines Sportturnier für Aktive genügt nicht.", "BSG B 2 U 8/20 R, Rn. 19 bis 22"],
    ["Eine Mindestzahl an Teilnehmenden gibt es nicht.", "BSG B 2 U 19/14 R · B 2 U 8/20 R"],
    ["Der direkte Weg nach Hause ist versichert, wie nach der Arbeit.", "§ 8 Abs. 2 Nr. 1 SGB VII"],
  ],
  grundsatz="BSG, Urteile vom 05.07.2016 (B 2 U 19/14 R) und vom 28.06.2022 (B 2 U 8/20 R). Im Zweifel entscheidet der Unfallversicherungsträger im Einzelfall.",
  recht="SGB VII § 8 Abs. 1 und Abs. 2 Nr. 1 · BSG 05.07.2016 B 2 U 19/14 R · BSG 28.06.2022 B 2 U 8/20 R")

B[18] = dict(datei="alkohol-im-betrieb", titel="Alkohol im Betrieb: was gilt?",
  teaser="Ein Glas Sekt zur Weihnachtsfeier ist kein Verbrechen, aber Arbeit unter Alkohol kann gefährlich werden. Hier steht, was die Vorschriften sagen.",
  kopf=["Nr.", "Regel", "Fundstelle {30}"],
  zeilen=[
    ["Niemand darf sich durch Alkohol oder Drogen in einen gefährlichen Zustand versetzen.", "§ 15 Abs. 2 DGUV V 1"],
    ["Das gilt auch für Medikamente.", "§ 15 Abs. 3 DGUV V 1"],
    ["Wer erkennbar nicht sicher arbeiten kann, darf nicht weiter beschäftigt werden.", "§ 7 Abs. 2 DGUV V 1"],
    ["Eine Promillegrenze nennt die DGUV Vorschrift 1 nicht. Maßgeblich ist der Zustand.", "§§ 7, 15 DGUV V 1"],
    ["Person aus der Tätigkeit nehmen, besonders an Maschinen, Fahrzeugen, in der Höhe.", "§ 7 Abs. 2 DGUV V 1"],
    ["Für einen sicheren Heimweg sorgen. Die Person nicht selbst fahren lassen.", "Empfehlung"],
    ["Beschäftigte melden eine erkannte erhebliche Gefahr sofort.", "§ 16 Abs. 1 ArbSchG · § 16 DGUV V 1"],
    ["Keine Abgabe von Alkohol an Jugendliche, soweit das Jugendschutzgesetz es verbietet.", "§ 31 Abs. 2 JArbSchG"],
    ["Alkohol, Drogen und Medikamente in die jährliche Unterweisung aufnehmen.", "§ 4 DGUV V 1" + E],
  ],
  grundsatz="Betriebliche Regeln zum Alkohol stimmen Sie am besten mit dem Betriebsrat ab, wenn es einen gibt.",
  recht="DGUV Vorschrift 1 §§ 4, 7, 15, 16 · ArbSchG § 16 · JArbSchG § 31")

B[19] = dict(datei="gewerbeabfall-trennen", titel="Gewerbeabfall richtig trennen",
  teaser="Kartons, Folien und Geschenkpapier: Für Gewerbebetriebe ist Trennen Pflicht. Die Übersicht enthält die Änderung der GewAbfV vom Juli 2026.",
  kopf=["Nr.", "Pflicht", "Fundstelle {30}"],
  zeilen=[
    ["Getrennt sammeln: Papier, Pappe und Karton (ohne Hygienepapier), Glas, Kunststoffe.", "§ 3 Abs. 1 Nr. 1 bis 3 GewAbfV"],
    ["Ebenso getrennt: Metalle, Holz, Textilien.", "§ 3 Abs. 1 Nr. 4 bis 6 GewAbfV"],
    ["Bioabfälle getrennt, verpackte und unverpackte jeweils für sich.", "§ 3 Abs. 1 Nr. 7 GewAbfV"],
    ["Dazu weitere Fraktionen gewerblicher Siedlungsabfälle.", "§ 3 Abs. 1 Nr. 8 GewAbfV"],
    ["Ausnahme nur, wenn technisch nicht möglich oder wirtschaftlich nicht zumutbar.", "§ 3 Abs. 2 GewAbfV"],
    ["Trennung belegen: Lagepläne, Fotos, Liefer- oder Wiegescheine.", "§ 3 Abs. 3 GewAbfV"],
    ["Erklärung des Verwerters: Name, Anschrift, Masse, Verwertung, Verbleib.", "§ 3 Abs. 3 GewAbfV"],
    ["Ausnahmen schriftlich begründen, auf Verlangen vorlegen.", "§ 3 Abs. 3 GewAbfV"],
    ["Gemische gehen unverzüglich in eine Vorbehandlungsanlage.", "§ 4 Abs. 1 GewAbfV"],
    ["Bei der ersten Übergabe Bestätigung der Anlage in Textform einholen.", "§ 4 Abs. 2 GewAbfV"],
    ["Keine Vorbehandlung nötig bei mindestens 90 % Getrenntsammlung im Vorjahr.", "§ 4 Abs. 3 GewAbfV"],
    ["Diese Quote bis 31. März des Folgejahres von Sachverständigen geprüft belegen.", "§ 4 Abs. 5 GewAbfV"],
  ],
  grundsatz="Bau- und Abbruchabfälle regelt § 8 GewAbfV gesondert.",
  recht="GewAbfV §§ 3, 4 (zuletzt geändert durch Art. 3 Abs. 4 G v. 13.07.2026, BGBl. 2026 I Nr. 207)")

B[20] = dict(datei="betriebsruhe-feiertage", titel="Betriebsruhe: sicher in die Feiertage",
  teaser="Bevor das Licht für die Feiertage ausgeht: Die Checkliste trennt klar zwischen Pflicht und gutem Rat.",
  kopf=["Nr.", "Punkt", "Fundstelle {30}"],
  zeilen=[
    ["Verkehrswege, Fluchtwege und Notausgänge freihalten, auch in der Ruhezeit.", "§ 4 Abs. 4 ArbStättV"],
    ["Feuerlöscher sichtbar und erreichbar lassen, nichts davor abstellen.", "ASR A2.2 Nr. 5.3"],
    ["Brandmelde- und Löscheinrichtungen funktionsfähig, Prüfungen aktuell.", "§ 4 Abs. 3 ArbStättV · ASR A2.2"],
    ["Sicherheitsbeleuchtung und Notschalter einsatzbereit halten.", "§ 4 Abs. 3 ArbStättV"],
    ["Gefahrstoffe über den Tagesbedarf zurück ins Lager bringen.", "TRGS 510 Nr. 1"],
    ["Wer allein gefährliche Arbeit macht, braucht Personenschutz, z. B. Notsignal.", "§ 8 Abs. 2 DGUV V 1"],
    ["Brennbare Abfälle und Verpackungen entfernen.", "Empfehlung"],
    ["Nicht benötigte Maschinen und Geräte abschalten, Stecker ziehen.", "Empfehlung"],
    ["Maschinen und Fahrzeuge gegen unbefugte Benutzung sichern, Schlüssel abziehen.", "Empfehlung"],
    ["Notfallkontakt und Erreichbarkeit festlegen, etwa für die Feuerwehr.", "Empfehlung"],
    ["Wasserleitungen und Anlagen vor Frost schützen.", "Empfehlung"],
    ["Zum Schluss: Fenster, Türen, Tore zu, Licht aus, Alarm an.", "Empfehlung"],
  ],
  grundsatz="Bedingungen Ihres Sachversicherers für Betriebsruhen zusätzlich beachten.",
  recht="ArbStättV § 4 Abs. 3 und 4 · ASR A2.2 · TRGS 510 · DGUV Vorschrift 1 § 8 · mit „Empfehlung“ markierte Punkte sind keine Rechtspflicht")

B[21] = dict(datei="prueffristen-2027", titel="Prüffristen 2027 auf einen Blick",
  teaser="Welche Prüfungen stehen im neuen Jahr an? Der Kalender zeigt die Fristen und sagt ehrlich, wo es nur Empfehlungen gibt.",
  kopf=["Prüfgegenstand", "Frist und Prüfer", "Fundstelle {24}", "nächste Prüfung {14}"],
  zeilen=[
    ["Feuerlöscher", "alle 2 Jahre, Fachkundige; kürzere Herstellerfrist gilt", "ASR A2.2 Nr. 7.4.2", ""],
    ["Kraftbetätigte Türen und Tore", "empfohlen jährlich, Sachkundige", "ASR A1.7 Nr. 10.2", ""],
    ["Krane, kraftbetrieben oder handbetrieben", "mindestens jährlich, befähigte Person", "BetrSichV Anh. 3", ""],
    ["Flurförderzeuge (Stapler)", "längstens 1 Jahr, Sachkundige", "§ 37 DGUV V 68", ""],
    ["Fahrzeuge", "mindestens jährlich, Sachkundige, schriftlich", "§ 57 DGUV V 70", ""],
    ["Aufzugsanlagen", "Hauptprüfung durch ZÜS höchstens alle 2 Jahre", "BetrSichV Anh. 2 Abschn. 2", ""],
    ["Ortsveränderliche Elektrogeräte", "Richtwert 6 Monate, max. 1 Jahr Werkstatt, 2 Jahre Büro", "DGUV V 3, DA Tab. 1B", ""],
    ["Elektrische Anlagen, ortsfest", "Richtwert 4 Jahre, Elektrofachkraft", "DGUV V 3, DA Tab. 1A", ""],
    ["FI-Schutzschalter, stationär", "Prüftaste alle 6 Monate", "DGUV V 3, DA Tab. 1A", ""],
    ["Regale", "Inspektion empfohlen alle 12 Monate, befähigte Person", "DIN EN 15635", ""],
    ["Leitern und Tritte", "keine feste Frist, in der GBU festlegen", "§ 3 Abs. 6 BetrSichV", ""],
    ["Sicherheitsbeleuchtung", "regelmäßig nach Hersteller", "ASR A2.3 Nr. 9", ""],
    ["Erste-Hilfe-Material", "nach Verbrauch und Verfallsdatum ergänzen", "ASR A4.3 Nr. 4", ""],
  ],
  grundsatz="Alle übrigen Fristen legen Sie in der Gefährdungsbeurteilung fest. Höchstfristen der BetrSichV-Anhänge dürfen nicht überschritten werden (§ 3 Abs. 6 BetrSichV).",
  recht="BetrSichV § 3 Abs. 6, § 14, Anhang 2 und 3 · ASR A1.7, A2.2, A2.3, A4.3 · DGUV Vorschriften 3, 68, 70 · DIN EN 15635")

B[22] = dict(datei="unterweisungsnachweis", titel="Nachweis der Unterweisung",
  teaser="Unterweisungen sind mindestens einmal im Jahr fällig. Die Vorlage zum Ausdrucken enthält alle Felder, die ein Nachweis braucht.",
  kopf=["Feld", "Eintrag {62}"],
  zeilen=[
    ["Betrieb, Bereich, Tätigkeit", ""],
    ["Datum und Dauer", ""],
    ["Anlass", "☐ Erstunterweisung  ☐ Wiederholung  ☐ aus besonderem Anlass"],
    ["Themen und Inhalte", ""],
    ["Betriebsanweisung(en)", ""],
    ["Sprache der Unterweisung", ""],
    ["Verständnis geprüft", "☐ ja, wie: __________________"],
    ["Unterweisende Person, Unterschrift", ""],
  ],
  tab2=("Teilnehmende", ["Nr.", "Name, Vorname {45}", "Unterschrift {45}"], [[str(i), "", ""] for i in range(1, 9)]),
  extra=("Wann unterweisen?", [
    "Pflicht: vor Aufnahme der Tätigkeit und bei Veränderungen (§ 12 Abs. 1 ArbSchG), mindestens jährlich (§ 4 DGUV V 1).",
    "Jugendliche halbjährlich (§ 29 Abs. 2 JArbSchG). Gefahrstoffe mündlich, mit Unterschrift (§ 14 Abs. 2 GefStoffV).",
  ]),
  grundsatz="Bei Arbeitsmitteln Datum und Namen festhalten (§ 12 Abs. 1 BetrSichV). Bei Leiharbeit unterweist der Entleiher (§ 12 Abs. 2 ArbSchG).",
  recht="ArbSchG § 12 · DGUV Vorschrift 1 § 4 · JArbSchG § 29 · GefStoffV § 14 Abs. 2 · BetrSichV § 12")

B[23] = dict(datei="silvesterfeuerwerk", titel="Silvesterfeuerwerk: was erlaubt ist",
  teaser="Feuerwerk ist nur an zwei Tagen im Jahr ohne Erlaubnis erlaubt. Hier stehen Verkaufstage, Verbote und was auf dem Betriebsgelände gilt.",
  kopf=["Nr.", "Regel", "Fundstelle {30}"],
  zeilen=[
    ["Feuerwerk der Kategorie F2 erst ab 18 Jahren kaufen und verwenden.", "§ 20 Abs. 1 1. SprengV"],
    ["Verkauf an Verbraucher nur vom 29. bis 31. Dezember, 2026 also Di. bis Do.", "§ 22 Abs. 1 1. SprengV"],
    ["Fällt einer der Tage auf einen Sonntag, beginnt der Verkauf am 28. Dezember.", "§ 22 Abs. 1 1. SprengV"],
    ["Abbrennen ohne Erlaubnis nur am 31. Dezember und 1. Januar.", "§ 23 Abs. 2 1. SprengV"],
    ["Verboten nahe Kirchen, Krankenhäusern, Kinder- und Altersheimen.", "§ 23 Abs. 1 1. SprengV"],
    ["Verboten auch nahe besonders brandempfindlicher Gebäude oder Anlagen.", "§ 23 Abs. 1 1. SprengV"],
    ["Die Gemeinde kann weitere Verbotszonen anordnen. Örtliche Regeln prüfen.", "§ 24 Abs. 2 1. SprengV"],
    ["Knallkörper mit Blitzknallsatz und Schwärmer sind für Verbraucher verboten.", "§ 20 Abs. 4 1. SprengV"],
    ["Raketen über 20 g Explosivstoff nur für Inhaber einer Erlaubnis.", "§ 20 Abs. 4 1. SprengV"],
    ["Firmenfeuerwerk außerhalb Silvester nur durch Fachleute mit Anzeige bei der Behörde.", "§ 23 Abs. 2, 3 1. SprengV"],
    ["Auf dem Betriebsgelände Feuerwerk per Hausrecht untersagen, etwa nahe Lagern.", "Empfehlung"],
  ],
  grundsatz="Feuerwerk hat im Betrieb nichts verloren. Einen guten Rutsch ins neue Jahr!",
  recht="Erste Verordnung zum Sprengstoffgesetz (1. SprengV) §§ 20, 22, 23, 24, zuletzt geändert 20.12.2021")

B[24] = dict(datei="pflichten-check-2027", titel="Pflichten-Check 2027",
  teaser="Frohe Weihnachten! Zum Abschluss die wichtigsten Arbeitgeberpflichten für das neue Jahr auf einer Seite, mit dem neuen Recht zu Sicherheitsbeauftragten.",
  kopf=["☐", "Pflicht", "Fundstelle {30}"],
  zeilen=[
    ["☐", "Gefährdungsbeurteilung aktuell, Maßnahmen und Wirksamkeit dokumentiert?", "§§ 5, 6 ArbSchG"],
    ["☐", "Unterweisung vor Beginn und mindestens jährlich, Jugendliche halbjährlich?", "§ 12 ArbSchG · § 4 DGUV V 1 · § 29 JArbSchG"],
    ["☐", "Betriebsarzt und Fachkraft für Arbeitssicherheit schriftlich bestellt?", "§§ 2, 5 ASiG · DGUV V 2"],
    ["☐", "Mehr als 20 Beschäftigte: Arbeitsschutzausschuss mindestens vierteljährlich?", "§ 11 ASiG"],
    ["☐", "Sicherheitsbeauftragte ab 50 Beschäftigten, bei 21 bis 49 bei besonderer Gefährdung?", "§ 22 SGB VII n. F. (seit 29.05.2026)"],
    ["☐", "Pflichtvorsorge veranlasst, Angebotsvorsorge angeboten, Vorsorgekartei geführt?", "§§ 3, 4, 5 ArbMedVV"],
    ["☐", "Gefahrstoffverzeichnis vollständig, Sicherheitsdatenblätter zugeordnet?", "§ 6 Abs. 12 GefStoffV"],
    ["☐", "Arbeitsmittel fristgerecht geprüft, Prüffristen festgelegt?", "§§ 3 Abs. 6, 14 BetrSichV"],
    ["☐", "Genug Ersthelfer, Fortbildung in der Regel alle 2 Jahre?", "§ 26 DGUV V 1"],
    ["☐", "Erste-Hilfe-Leistungen dokumentiert und 5 Jahre verfügbar?", "§ 24 Abs. 6 DGUV V 1"],
    ["☐", "Brandschutzhelfer: in der Regel 5 % der Beschäftigten?", "ASR A2.2 Nr. 7.3"],
    ["☐", "Aushänge: ArbZG, JArbSchG (ab einem Jugendlichen), MuSchG (ab mehr als 3 Frauen)?", "§ 16 ArbZG · § 47 JArbSchG · § 26 MuSchG"],
  ],
  grundsatz="Frohe Weihnachten und ein gesundes, sicheres 2027 wünscht Ihnen OAK engineering.",
  recht="ArbSchG · ASiG · DGUV Vorschriften 1 und 2 · SGB VII § 22 (BGBl. 2026 I Nr. 140) · ArbMedVV · GefStoffV · BetrSichV · ASR A2.2 · ArbZG · JArbSchG · MuSchG")


def markdown(n):
    b = B[n]
    zeilen = [f"# {b['titel']}", f"OAK Adventskalender · Türchen {n} · {STAND}", ""]
    kopf = b["kopf"]
    zeilen.append("| " + " | ".join(kopf) + " |")
    zeilen.append("|" + "---|" * len(kopf))
    nr = kopf[0].lower().startswith("nr")
    for i, z in enumerate(b["zeilen"], 1):
        zellen = ([str(i)] if nr else []) + z
        zeilen.append("| " + " | ".join(zellen) + " |")
    if b.get("tab2"):
        t = b["tab2"]
        zeilen += ["", f"## {t[0]}", "| " + " | ".join(t[1]) + " |", "|" + "---|" * len(t[1])]
        zeilen += ["| " + " | ".join(r) + " |" for r in t[2]]
    if b.get("extra"):
        zeilen += ["", f"## {b['extra'][0]}"] + [f"- {x}" for x in b["extra"][1]]
    zeilen += ["", f"**Gut zu wissen:** {b['grundsatz']}", "",
               f"> Rechtsgrundlage: {b['recht']} · {STAND} · {FUSS_ENDE}"]
    return "\n".join(zeilen) + "\n"


def bauen(nummern):
    tmp = Path(tempfile.mkdtemp(prefix="advent_"))
    ok = True
    for n in nummern:
        b = B[n]
        name = f"tag-{n:02d}-{b['datei']}"
        md = tmp / f"{name}.md"
        md.write_text(markdown(n), encoding="utf-8")
        def versuch(pt):
            r = subprocess.run([sys.executable, str(REPO / "tools" / "kurzfassung_bauen.py"), "--quelle", str(md),
                                "--kontext", "oak", "--pdf", "--schrift", str(pt)], capture_output=True, text=True,
                               encoding="utf-8", errors="replace")
            return "WARNUNG" not in r.stdout and "FEHLER" not in r.stdout
        lo, hi, best = 10.0, 15.0, None                      # halbe Punkte, binaere Suche
        if versuch(lo):
            best = lo
            while hi - lo > 0.5:
                mid = round((lo + hi) / 2 * 2) / 2
                if versuch(mid): lo = best = mid
                else: hi = mid
            versuch(best)
        else:
            ok = False
        print(f"Tag {n:2d}: {name}.pdf · {best or 'ZU LANG'} pt")
        pdf = tmp / f"{name}.pdf"
        if pdf.exists():
            shutil.copy(pdf, HIER / f"{name}.pdf")
    return ok


def json_schreiben():
    daten = [{"tag": n, "titel": B[n]["titel"], "teaser": B[n]["teaser"], "pdf": f"advent/tag-{n:02d}-{B[n]['datei']}.pdf"}
             for n in sorted(B)]
    (HIER / "advent.json").write_text(json.dumps(daten, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", type=int, action="append")
    a = ap.parse_args()
    assert sorted(B) == list(range(1, 25))
    ok = bauen(a.tag or sorted(B))
    json_schreiben()
    print("alle einseitig" if ok else "ACHTUNG: mindestens ein Blatt hat mehr als eine Seite")

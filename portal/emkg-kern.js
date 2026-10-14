/*
 * emkg-kern.js – Rechenlogik „Einfaches Maßnahmenkonzept Gefahrstoffe" (EMKG, BAuA)
 *
 * Reine Logik: kein DOM, kein fetch. Nach außen nur window.EMKG (Browser) bzw. module.exports (Node).
 * Die Portal-Skripte teilen einen globalen Scope (tools/portal_check.py) – deshalb alles in dieser IIFE.
 *
 * Regeln + Fundstellen: references/gefahrstoffe/emkg-regelwerk.md (inkl. „Festlegungen (Nikolai, 08.10.2026)").
 * Datenblock (H-/EUH-Sätze, Mutterschutz, Schutzleitfaden-Köpfe) wird von tools/emkg_kern_bauen.py aus
 * den Quell-MDs geschrieben – nicht von Hand ändern. Tests: node tools/test_emkg_kern.js
 *
 * Kürzel in Fundstellen: LF22 = Leitfaden 2.2 · Z26 = H-/EUH-Zuordnung 06/2026 · BE20 = Leitfaden Brand/Ex 2020 ·
 * AU25 = Hilfestellung Modul Augen · GG20 = Geringe Gefährdung · XLS/ANL = Lagermengenformular + Anleitung ·
 * Fx = Festlegung x (Nikolai, 08.10.2026) · Ox/Wx = offener Punkt / Widerspruch im Regelwerk.
 *
 * Stufen: 1/2/3 = Maßnahmenstufe, 4 = Beratung (Einatmen/Brand) bzw. M4 (Lagern), 0 = entfällt (Haut, Kontakt
 * technisch ausgeschlossen), null = nicht berechenbar (siehe fehlend[]) oder außerhalb des Moduls (siehe hinweise).
 */
(function () {
  'use strict';

  /* <<EMKG-DATEN */
  // automatisch erzeugt von tools/emkg_kern_bauen.py - nicht von Hand aendern
  var DATEN = {
   "quelle": {
    "titel": "H-/EUH-Sätze und Gefährlichkeitsgruppen im EMKG",
    "stand": "Juni 2026",
    "datei": "emkg-zuordnung-h-euh-saetze-gefaehrlichkeitsgruppen.md",
    "abgerufen_am": "2026-10-08"
   },
   "saetze": {
    "KEIN": {
     "wortlaut": "-",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH001": {
     "wortlaut": "In trockenem Zustand explosionsfähig.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A",
     "fussnoten": [
      "1"
     ]
    },
    "EUH006": {
     "wortlaut": "Mit und ohne Luft explosionsfähig.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A",
     "fussnoten": [
      "2"
     ]
    },
    "EUH014": {
     "wortlaut": "Reagiert heftig mit Wasser.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-A"
    },
    "EUH018": {
     "wortlaut": "Kann bei Verwendung explosionsfähige/entzündbare Dampf/Luft-Gemische bilden.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH019": {
     "wortlaut": "Kann explosionsfähige Peroxide bilden.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A"
    },
    "EUH029": {
     "wortlaut": "Entwickelt bei Berührung mit Wasser giftige Gase.",
     "einatmen": "C",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH031": {
     "wortlaut": "Entwickelt bei Berührung mit Säure giftige Gase.",
     "einatmen": "C",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH032": {
     "wortlaut": "Entwickelt bei Berührung mit Säure sehr giftige Gase.",
     "einatmen": "D",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH044": {
     "wortlaut": "Explosionsgefahr bei Erhitzen unter Einschluss.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-A"
    },
    "EUH059": {
     "wortlaut": "Die Ozonschicht schädigend",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A",
     "fussnoten": [
      "3"
     ]
    },
    "EUH066": {
     "wortlaut": "Wiederholter Kontakt kann zu spröder oder rissiger Haut führen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH070": {
     "wortlaut": "Giftig bei Berührung mit den Augen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH071": {
     "wortlaut": "Wirkt ätzend auf die Atemwege.",
     "einatmen": "C",
     "haut": "HA",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH201": {
     "wortlaut": "Enthält Blei. Nicht für den Anstrich von Gegenständen verwenden, die von Kindern gekaut oder gelutscht werden könnten.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH201A": {
     "wortlaut": "Achtung! Enthält Blei.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH202": {
     "wortlaut": "Cyanacrylat. Gefahr. Klebt innerhalb von Sekunden Haut und Augenlider zusammen. Darf nicht in die Hände von Kindern gelangen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH203": {
     "wortlaut": "Enthält Chrom (VI). Kann allergische Reaktionen hervorrufen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH204": {
     "wortlaut": "Enthält Isocyanate. Kann allergische Reaktionen hervorrufen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH205": {
     "wortlaut": "Enthält epoxidhaltige Verbindungen. Kann allergische Reaktionen hervorrufen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH206": {
     "wortlaut": "Achtung! Nicht zusammen mit anderen Produkten verwenden, da gefährliche Gase (Chlor) freigesetzt werden können.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-A"
    },
    "EUH207": {
     "wortlaut": "Achtung enthält Cadmium. Bei der Verwendung entstehen gefährliche Dämpfe. Hinweise des Herstellers beachten. Sicherheitsanweisungen einhalten.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH208": {
     "wortlaut": "Enthält (Name des sensibilisierenden Stoffes). Kann allergische Reaktionen hervorrufen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH209": {
     "wortlaut": "Kann bei der Verwendung leicht entzündbar werden.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH209A": {
     "wortlaut": "Kann bei der Verwendung entzündbar werden.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-A"
    },
    "EUH210": {
     "wortlaut": "Sicherheitsdatenblatt auf Anfrage erhältlich.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH211": {
     "wortlaut": "Achtung! Beim Sprühen können gefährliche lungengängige Tröpfchen entstehen. Aerosol oder Nebel nicht einatmen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH212": {
     "wortlaut": "Achtung! Bei der Verwendung kann gefährlicher lungengängiger Staub entstehen. Staub nicht einatmen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH380": {
     "wortlaut": "Kann beim Menschen endokrine Störungen verursachen.",
     "einatmen": "C",
     "haut": "HC",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH381": {
     "wortlaut": "Steht in dem Verdacht, beim Menschen endokrine Störungen zu verursachen.",
     "einatmen": "C",
     "haut": "HC",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH401": {
     "wortlaut": "Zur Vermeidung von Risiken für Mensch und Umwelt die Gebrauchsanleitung einhalten.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH430": {
     "wortlaut": "Kann endokrine Störungen in der Umwelt verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH431": {
     "wortlaut": "Steht in dem Verdacht, endokrine Störungen in der Umwelt zu verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH440": {
     "wortlaut": "Reichert sich in der Umwelt und in lebenden Organismen, einschließlich Menschen, an.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH441": {
     "wortlaut": "Reichert sich stark in der Umwelt und in lebenden Organismen, einschließlich Menschen, an.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH450": {
     "wortlaut": "Kann langanhaltende und diffuse Verschmutzung von Wasserressourcen verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "EUH451": {
     "wortlaut": "Kann sehr lang anhaltende und diffuse Verschmutzung von Wasserressourcen verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H200": {
     "wortlaut": "Instabil, explosiv.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H201": {
     "wortlaut": "Explosiv; Gefahr der Massenexplosion.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H202": {
     "wortlaut": "Explosiv; große Gefahr durch Splitter, Spreng-und Wurfstücke.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H203": {
     "wortlaut": "Explosiv; Gefahr durch Feuer, Luftdruck oder Splitter, Spreng- und Wurfstücke.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H204": {
     "wortlaut": "Gefahr durch Feuer oder Splitter, Spreng-und Wurfstücke.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H205": {
     "wortlaut": "Gefahr der Massenexplosion bei Feuer.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H206": {
     "wortlaut": "Gefahr durch Feuer, Druckstoß oder Sprengstücke; erhöhte Explosionsgefahr, wenn das Desensibilisierungsmittel reduziert wird.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H207": {
     "wortlaut": "Gefahr durch Feuer oder Sprengstücke; erhöhte Explosionsgefahr, wenn das Desensibilisierungsmittel reduziert wird.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H208": {
     "wortlaut": "Gefahr durch Feuer; erhöhte Explosionsgefahr, wenn das Desensibilisierungsmittel reduziert wird.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H220": {
     "wortlaut": "Extrem entzündbares Gas.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-E"
    },
    "H221": {
     "wortlaut": "Entzündbares Gas.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-E"
    },
    "H222": {
     "wortlaut": "Extrem entzündbares Aerosol.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-E"
    },
    "H223": {
     "wortlaut": "Entzündbares Aerosol.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-E"
    },
    "H224": {
     "wortlaut": "Flüssigkeit und Dampf extrem entzündbar.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-D"
    },
    "H225": {
     "wortlaut": "Flüssigkeit und Dampf leicht entzündbar.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-D"
    },
    "H226": {
     "wortlaut": "Flüssigkeit und Dampf entzündbar.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-B"
    },
    "H228": {
     "wortlaut": "Entzündbarer Feststoff.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H229": {
     "wortlaut": "Behälter steht unter Druck: kann bei Erwärmung bersten.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-E"
    },
    "H230": {
     "wortlaut": "Kann auch in Abwesenheit von Luft explosionsartig reagieren.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A"
    },
    "H231": {
     "wortlaut": "Kann auch in Abwesenheit von Luft bei erhöhtem Druck und/oder erhöhter Temperatur explosionsartig reagieren.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A"
    },
    "H232": {
     "wortlaut": "Kann sich bei Kontakt mit Luft spontan entzünden.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A"
    },
    "H240": {
     "wortlaut": "Erwärmung kann Explosion verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H241": {
     "wortlaut": "Erwärmung kann Brand oder Explosion verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H242": {
     "wortlaut": "Erwärmung kann Brand verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-C"
    },
    "H250": {
     "wortlaut": "Entzündet sich in Berührung mit Luft von selbst.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-F"
    },
    "H251": {
     "wortlaut": "Selbsterhitzungsfähig; kann in Brand geraten.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-C",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H252": {
     "wortlaut": "In großen Mengen selbsterhitzungsfähig; kann in Brand geraten.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-A"
    },
    "H260": {
     "wortlaut": "In Berührung mit Wasser entstehen entzündbare Gase, die sich spontan entzünden können.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-E",
     "brand_fest": "pc-E",
     "lagern": "La-A"
    },
    "H261": {
     "wortlaut": "In Berührung mit Wasser entstehen entzündbare Gase.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-A"
    },
    "H270": {
     "wortlaut": "Kann Brand verursachen oder verstärken; Oxidationsmittel.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-E"
    },
    "H271": {
     "wortlaut": "Kann Brand oder Explosion verursachen; starkes Oxidationsmittel.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-F"
    },
    "H272": {
     "wortlaut": "Kann Brand verstärken; Oxidationsmittel.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-D",
     "brand_fest": "pc-D",
     "lagern": "La-C"
    },
    "H280": {
     "wortlaut": "Enthält Gas unter Druck; kann bei Erwärmung explodieren.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-E",
     "fussnoten": [
      "4"
     ]
    },
    "H281": {
     "wortlaut": "Enthält tiefgekühltes Gas; kann Kälteverbrennungen oder -verletzungen verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-E",
     "fussnoten": [
      "4"
     ]
    },
    "H290": {
     "wortlaut": "Kann gegenüber Metallen korrosiv sein.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-B",
     "brand_fest": "pc-B",
     "lagern": "La-A"
    },
    "H300": {
     "wortlaut": "Lebensgefahr bei Verschlucken.",
     "einatmen": "D",
     "haut": "HA",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H301": {
     "wortlaut": "Giftig bei Verschlucken.",
     "einatmen": "C",
     "haut": "HA",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H302": {
     "wortlaut": "Gesundheitsschädlich bei Verschlucken.",
     "einatmen": "B",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H304": {
     "wortlaut": "Kann bei Verschlucken und Eindringen in die Atemwege tödlich sein.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H310": {
     "wortlaut": "Lebensgefahr bei Hautkontakt.",
     "einatmen": "A",
     "haut": "HE",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H311": {
     "wortlaut": "Giftig bei Hautkontakt.",
     "einatmen": "A",
     "haut": "HD",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H312": {
     "wortlaut": "Gesundheitsschädlich bei Hautkontakt.",
     "einatmen": "A",
     "haut": "HC",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H314": {
     "wortlaut": "Verursacht schwere Verätzungen der Haut und schwere Augenschäden.",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H315": {
     "wortlaut": "Verursacht Hautreizungen.",
     "einatmen": "A",
     "haut": "HB",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H317": {
     "wortlaut": "Kann allergische Hautreaktionen verursachen.",
     "einatmen": "A",
     "haut": "HC",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H318": {
     "wortlaut": "Verursacht schwere Augenschäden.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H319": {
     "wortlaut": "Verursacht schwere Augenreizung.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H330": {
     "wortlaut": "Lebensgefahr bei Einatmen.",
     "einatmen": "D",
     "haut": "HA",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H331": {
     "wortlaut": "Giftig bei Einatmen.",
     "einatmen": "C",
     "haut": "HA",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H332": {
     "wortlaut": "Gesundheitsschädlich bei Einatmen.",
     "einatmen": "B",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H334": {
     "wortlaut": "Kann bei Einatmen Allergie, asthmaartige Symptome oder Atembeschwerden verursachen.",
     "einatmen": "C",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H335": {
     "wortlaut": "Kann die Atemwege reizen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H336": {
     "wortlaut": "Kann Schläfrigkeit und Benommenheit verursachen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H340": {
     "wortlaut": "Kann genetische Defekte verursachen (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "E",
     "haut": "HE",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H341": {
     "wortlaut": "Kann vermutlich genetische Defekte verursachen (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H350": {
     "wortlaut": "Kann Krebs erzeugen (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "E",
     "haut": "HE",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H350i": {
     "wortlaut": "Kann bei Einatmen Krebs erzeugen.",
     "einatmen": "E",
     "haut": "HA",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H351": {
     "wortlaut": "Kann vermutlich Krebs erzeugen (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H360": {
     "wortlaut": "Kann die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen (konkrete Wirkung angeben, sofern bekannt) (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "E",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H360D": {
     "wortlaut": "Kann das Kind im Mutterleib schädigen.",
     "einatmen": "D",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H360Df": {
     "wortlaut": "Kann das Kind im Mutterleib schädigen. Kann vermutlich die Fruchtbarkeit beeinträchtigen.",
     "einatmen": "D",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H360F": {
     "wortlaut": "Kann die Fruchtbarkeit beeinträchtigen.",
     "einatmen": "E",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H360Fd": {
     "wortlaut": "Kann die Fruchtbarkeit beeinträchtigen. Kann vermutlich das Kind im Mutterleib schädigen.",
     "einatmen": "E",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H360FD": {
     "wortlaut": "Kann die Fruchtbarkeit beeinträchtigen. Kann das Kind im Mutterleib schädigen.",
     "einatmen": "E",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H361": {
     "wortlaut": "Kann vermutlich die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen (konkrete Wirkung angeben, sofern bekannt) (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H361d": {
     "wortlaut": "Kann vermutlich das Kind im Mutterleib schädigen.",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H361f": {
     "wortlaut": "Kann vermutlich die Fruchtbarkeit beeinträchtigen.",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H361fd": {
     "wortlaut": "Kann vermutlich die Fruchtbarkeit beeinträchtigen. Kann vermutlich das Kind im Mutterleib schädigen.",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H362": {
     "wortlaut": "Kann Säuglinge über die Muttermilch schädigen.",
     "einatmen": "A",
     "haut": "HE",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A",
     "fussnoten": [
      "5"
     ]
    },
    "H370": {
     "wortlaut": "Schädigt die Organe (oder alle betroffenen Organe nennen, sofern bekannt) (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "C",
     "haut": "HD",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H371": {
     "wortlaut": "Kann die Organe schädigen (oder alle betroffenen Organe nennen, sofern bekannt) (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "B",
     "haut": "HC",
     "augen": "Au-B",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H372": {
     "wortlaut": "Schädigt die Organe (alle betroffenen Organe nennen, sofern bekannt) bei längerer oder wiederholter Exposition (Expositionsweg angeben, wenn schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "D",
     "haut": "HD",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H373": {
     "wortlaut": "Kann die Organe schädigen (alle betroffenen Organe nennen, sofern bekannt) bei längerer oder wiederholter Exposition (Expositionsweg angeben, sofern schlüssig belegt ist, dass diese Gefahr bei keinem anderen Expositionsweg besteht).",
     "einatmen": "C",
     "haut": "HC",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H311+H314": {
     "wortlaut": "Giftig bei Hautkontakt. Verursacht schwere Verätzungen der Haut und schwere Augenschäden.",
     "einatmen": "C",
     "haut": "HE",
     "augen": "Au-C",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-C"
    },
    "H400": {
     "wortlaut": "Sehr giftig für Wasserorganismen.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H410": {
     "wortlaut": "Sehr giftig für Wasserorganismen, mit langfristiger Wirkung.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H411": {
     "wortlaut": "Giftig für Wasserorganismen, mit langfristiger Wirkung.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H412": {
     "wortlaut": "Schädlich für Wasserorganismen, mit langfristiger Wirkung.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H413": {
     "wortlaut": "Kann für Wasserorganismen schädlich sein, mit langfristiger Wirkung.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    },
    "H420": {
     "wortlaut": "Schädigt die öffentliche Gesundheit und die Umwelt durch Ozonabbau in der äußeren Atmosphäre.",
     "einatmen": "A",
     "haut": "HA",
     "augen": "Au-A",
     "brand_fluessig": "pc-A",
     "brand_fest": "pc-C",
     "lagern": "La-A"
    }
   },
   "fussnoten": {
    "1": "Der EUH001 ist mit der Einführung der H-Sätze H206, H207 und H208 aufgehoben. Er ist hier nur für Restbestände aufgeführt.",
    "2": "Der EUH006 ist aufgehoben und durch H230/P420 ersetzt. Er ist hier nur für Restbestände aufgeführt.",
    "3": "Der EUH059 ist aufgehoben und durch H420 ersetzt. Er ist hier nur für Restbestände aufgeführt.",
    "4": "ACHTUNG: treten der H280 oder H281 gemeinsam mit H330 oder H331 auf, führt dies in GG La-F.",
    "5": "Der H362 gilt nur für Schwangere und Stillende."
   },
   "mutterschutz": [
    "H300",
    "H301",
    "H310",
    "H311",
    "H311+H314",
    "H330",
    "H331",
    "H340",
    "H350",
    "H350i",
    "H360",
    "H360D",
    "H360Df",
    "H360F",
    "H360FD",
    "H360Fd",
    "H361",
    "H361d",
    "H361f",
    "H361fd",
    "H362",
    "H370"
   ],
   "regeln": {
    "lagern_gas_akut_toxisch": {
     "eines_von": [
      "H280",
      "H281"
     ],
     "zusammen_mit": [
      "H330",
      "H331"
     ],
     "gruppe": "La-F",
     "fundstelle": "Z26 Fn. 4",
     "text": "ACHTUNG: treten der H280 oder H281 gemeinsam mit H330 oder H331 auf, führt dies in GG La-F."
    },
    "h362_nur_schwangere_stillende": {
     "satz": "H362",
     "fundstelle": "Z26 Fn. 5",
     "text": "Der H362 gilt nur für Schwangere und Stillende."
    }
   },
   "slf": {
    "100": {
     "nr": "100",
     "titel": "Freie Lüftung - Mindeststandards",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2022-05)",
     "datei": "emkg-schutzleitfaden-100-freie-lueftung-mindeststandards.md",
     "pdf": "emkg-schutzleitfaden-100-freie-lueftung-mindeststandards.pdf"
    },
    "110": {
     "nr": "110",
     "titel": "Organisations-und Hygienemaßnahmen \"Einatmen\" - Mindeststandards",
     "stand": "März 2023",
     "datei": "emkg-schutzleitfaden-110-organisations-und-hygienemassnahmen-einatmen-mindeststandards.md",
     "pdf": "emkg-schutzleitfaden-110-organisations-und-hygienemassnahmen-einatmen-mindeststandards.pdf"
    },
    "120": {
     "nr": "120",
     "titel": "Organisations-und Hygienemaßnahmen \"Haut\" - Mindeststandards",
     "stand": "März 2023",
     "datei": "emkg-schutzleitfaden-120-organisations-und-hygienemassnahmen-haut-mindeststandards.md",
     "pdf": "emkg-schutzleitfaden-120-organisations-und-hygienemassnahmen-haut-mindeststandards.pdf"
    },
    "2000": {
     "nr": "2000",
     "titel": "Organisation",
     "stand": "05/2025",
     "datei": "emkg-schutzleitfaden-2000-organisation.md",
     "pdf": "emkg-schutzleitfaden-2000-organisation.pdf"
    },
    "2100": {
     "nr": "2100",
     "titel": "Hautschutz",
     "stand": "06/2025",
     "datei": "emkg-schutzleitfaden-2100-hautschutz.md",
     "pdf": "emkg-schutzleitfaden-2100-hautschutz.pdf"
    },
    "2110": {
     "nr": "2110",
     "titel": "Schutzhandschuhe",
     "stand": "07/2025",
     "datei": "emkg-schutzleitfaden-2110-schutzhandschuhe.md",
     "pdf": "emkg-schutzleitfaden-2110-schutzhandschuhe.pdf"
    },
    "2111": {
     "nr": "2111",
     "titel": "Schutzschuhe",
     "stand": "03/2025",
     "datei": "emkg-schutzleitfaden-2111-schutzschuhe.md",
     "pdf": "emkg-schutzleitfaden-2111-schutzschuhe.pdf"
    },
    "2112": {
     "nr": "2112",
     "titel": "Schutzkleidung",
     "stand": "03/2025",
     "datei": "emkg-schutzleitfaden-2112-schutzkleidung.md",
     "pdf": "emkg-schutzleitfaden-2112-schutzkleidung.pdf"
    },
    "2120": {
     "nr": "2120",
     "titel": "Feuchtarbeit",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2120-feuchtarbeit.md",
     "pdf": "emkg-schutzleitfaden-2120-feuchtarbeit.pdf"
    },
    "2121": {
     "nr": "2121",
     "titel": "Hautsensibilisierende Gefahrstoffe",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2121-hautsensibilisierende-gefahrstoffe.md",
     "pdf": "emkg-schutzleitfaden-2121-hautsensibilisierende-gefahrstoffe.pdf"
    },
    "2200": {
     "nr": "2200",
     "titel": "Augenschutz",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2200-augenschutz.md",
     "pdf": "emkg-schutzleitfaden-2200-augenschutz.pdf"
    },
    "2201": {
     "nr": "2201",
     "titel": "Augenspüleinrichtung",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2201-augenspueleinrichtung.md",
     "pdf": "emkg-schutzleitfaden-2201-augenspueleinrichtung.pdf"
    },
    "2411": {
     "nr": "2411",
     "titel": "Förderbandtransport",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2411-foerderbandtransport.md",
     "pdf": "emkg-schutzleitfaden-2411-foerderbandtransport.pdf"
    },
    "2421": {
     "nr": "2421",
     "titel": "Befüllen von Säcken",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2421-befuellen-von-saecken.md",
     "pdf": "emkg-schutzleitfaden-2421-befuellen-von-saecken.pdf"
    },
    "2422": {
     "nr": "2422",
     "titel": "Befüllen von Fässern",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2422-befuellen-von-faessern.md",
     "pdf": "emkg-schutzleitfaden-2422-befuellen-von-faessern.pdf"
    },
    "2423": {
     "nr": "2423",
     "titel": "Befüllen von Pulverflaschen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2423-befuellen-von-pulverflaschen.md",
     "pdf": "emkg-schutzleitfaden-2423-befuellen-von-pulverflaschen.pdf"
    },
    "2424": {
     "nr": "2424",
     "titel": "Beschicken von Kesseln",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2424-beschicken-von-kesseln.md",
     "pdf": "emkg-schutzleitfaden-2424-beschicken-von-kesseln.pdf"
    },
    "2425": {
     "nr": "2425",
     "titel": "Abfüllen entzündbarer Flüssigkeiten",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2425-abfuellen-entzuendbarer-fluessigkeiten.md",
     "pdf": "emkg-schutzleitfaden-2425-abfuellen-entzuendbarer-fluessigkeiten.pdf"
    },
    "2426": {
     "nr": "2426",
     "titel": "Abfüllen organischer Lösemittel",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2426-abfuellen-organischer-loesemittel.md",
     "pdf": "emkg-schutzleitfaden-2426-abfuellen-organischer-loesemittel.pdf"
    },
    "2431": {
     "nr": "2431",
     "titel": "Entleeren von Säcken",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2431-entleeren-von-saecken.md",
     "pdf": "emkg-schutzleitfaden-2431-entleeren-von-saecken.pdf"
    },
    "2432": {
     "nr": "2432",
     "titel": "Entleeren mittels Fasspumpe",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2432-entleeren-mittels-fasspumpe.md",
     "pdf": "emkg-schutzleitfaden-2432-entleeren-mittels-fasspumpe.pdf"
    },
    "2433": {
     "nr": "2433",
     "titel": "Entleeren mittels Zapfhahns",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2433-entleeren-mittels-zapfhahns.md",
     "pdf": "emkg-schutzleitfaden-2433-entleeren-mittels-zapfhahns.pdf"
    },
    "2441": {
     "nr": "2441",
     "titel": "Wiegen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2441-wiegen.md",
     "pdf": "emkg-schutzleitfaden-2441-wiegen.pdf"
    },
    "2442": {
     "nr": "2442",
     "titel": "Mischen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2442-mischen.md",
     "pdf": "emkg-schutzleitfaden-2442-mischen.pdf"
    },
    "2451": {
     "nr": "2451",
     "titel": "Pulverbeschichten",
     "stand": "Mai 2026",
     "datei": "emkg-schutzleitfaden-2451-pulverbeschichten.md",
     "pdf": "emkg-schutzleitfaden-2451-pulverbeschichten.pdf"
    },
    "2452": {
     "nr": "2452",
     "titel": "Spritzlackieren",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2452-spritzlackieren.md",
     "pdf": "emkg-schutzleitfaden-2452-spritzlackieren.pdf"
    },
    "2453": {
     "nr": "2453",
     "titel": "Streichen, Rollen, Tauchen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2453-streichen-rollen-tauchen.md",
     "pdf": "emkg-schutzleitfaden-2453-streichen-rollen-tauchen.pdf"
    },
    "2454": {
     "nr": "2454",
     "titel": "Trocknen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2454-trocknen.md",
     "pdf": "emkg-schutzleitfaden-2454-trocknen.pdf"
    },
    "2461": {
     "nr": "2461",
     "titel": "Reinigen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2461-reinigen.md",
     "pdf": "emkg-schutzleitfaden-2461-reinigen.pdf"
    },
    "2462": {
     "nr": "2462",
     "titel": "Staubentnahme und Filterwechsel",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2462-staubentnahme-und-filterwechsel.md",
     "pdf": "emkg-schutzleitfaden-2462-staubentnahme-und-filterwechsel.pdf"
    },
    "2471": {
     "nr": "2471",
     "titel": "Pellets herstellen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2471-pellets-herstellen.md",
     "pdf": "emkg-schutzleitfaden-2471-pellets-herstellen.pdf"
    },
    "2500": {
     "nr": "2500",
     "titel": "Emissionsminderung",
     "stand": "06/2025",
     "datei": "emkg-schutzleitfaden-2500-emissionsminderung.md",
     "pdf": "emkg-schutzleitfaden-2500-emissionsminderung.pdf"
    },
    "2501": {
     "nr": "2501",
     "titel": "Beschaffung Erfassungseinrichtungen",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2501-beschaffung-erfassungseinrichtungen.md",
     "pdf": "emkg-schutzleitfaden-2501-beschaffung-erfassungseinrichtungen.pdf"
    },
    "2502": {
     "nr": "2502",
     "titel": "Staub",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2502-staub.md",
     "pdf": "emkg-schutzleitfaden-2502-staub.pdf"
    },
    "2510": {
     "nr": "2510",
     "titel": "Absaugschrank",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2510-absaugschrank.md",
     "pdf": "emkg-schutzleitfaden-2510-absaugschrank.pdf"
    },
    "2511": {
     "nr": "2511",
     "titel": "Abzugschrank",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2511-abzugschrank.md",
     "pdf": "emkg-schutzleitfaden-2511-abzugschrank.pdf"
    },
    "2512": {
     "nr": "2512",
     "titel": "Absaugwand",
     "stand": "Mai 2026",
     "datei": "emkg-schutzleitfaden-2512-absaugwand.md",
     "pdf": "emkg-schutzleitfaden-2512-absaugwand.pdf"
    },
    "2513": {
     "nr": "2513",
     "titel": "Absaugtisch",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2513-absaugtisch.md",
     "pdf": "emkg-schutzleitfaden-2513-absaugtisch.pdf"
    },
    "2514": {
     "nr": "2514",
     "titel": "Randabsaugung",
     "stand": "03/2026",
     "datei": "emkg-schutzleitfaden-2514-randabsaugung.md",
     "pdf": "emkg-schutzleitfaden-2514-randabsaugung.pdf"
    },
    "2515": {
     "nr": "2515",
     "titel": "Punktabsaugung",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2515-punktabsaugung.md",
     "pdf": "emkg-schutzleitfaden-2515-punktabsaugung.pdf"
    },
    "2600": {
     "nr": "2600",
     "titel": "Brandschutz",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2600-brandschutz.md",
     "pdf": "emkg-schutzleitfaden-2600-brandschutz.pdf"
    },
    "2601": {
     "nr": "2601",
     "titel": "Baulicher Brandschutz",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2601-baulicher-brandschutz.md",
     "pdf": "emkg-schutzleitfaden-2601-baulicher-brandschutz.pdf"
    },
    "2602": {
     "nr": "2602",
     "titel": "Zündquellenvermeidung",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2602-zuendquellenvermeidung.md",
     "pdf": "emkg-schutzleitfaden-2602-zuendquellenvermeidung.pdf"
    },
    "2603": {
     "nr": "2603",
     "titel": "Explosionsschutz",
     "stand": "05/2026",
     "datei": "emkg-schutzleitfaden-2603-explosionsschutz.md",
     "pdf": "emkg-schutzleitfaden-2603-explosionsschutz.pdf"
    },
    "2700": {
     "nr": "2700",
     "titel": "Lager",
     "stand": "06/2025",
     "datei": "emkg-schutzleitfaden-2700-lager.md",
     "pdf": "emkg-schutzleitfaden-2700-lager.pdf"
    },
    "2710": {
     "nr": "2710",
     "titel": "Zusammenlagern",
     "stand": "06/2025",
     "datei": "emkg-schutzleitfaden-2710-zusammenlagern.md",
     "pdf": "emkg-schutzleitfaden-2710-zusammenlagern.pdf"
    },
    "2711": {
     "nr": "2711",
     "titel": "Eingeschränkt Zusammenlagern",
     "stand": "06/2025",
     "datei": "emkg-schutzleitfaden-2711-eingeschraenkt-zusammenlagern.md",
     "pdf": "emkg-schutzleitfaden-2711-eingeschraenkt-zusammenlagern.pdf"
    },
    "2712": {
     "nr": "2712",
     "titel": "Separatlagern",
     "stand": "06/2025",
     "datei": "emkg-schutzleitfaden-2712-separatlagern.md",
     "pdf": "emkg-schutzleitfaden-2712-separatlagern.pdf"
    },
    "2714": {
     "nr": "2714",
     "titel": "Leckagen und Verschütten",
     "stand": "07/2026",
     "datei": "emkg-schutzleitfaden-2714-leckagen-und-verschuetten.md",
     "pdf": "emkg-schutzleitfaden-2714-leckagen-und-verschuetten.pdf"
    },
    "300": {
     "nr": "300",
     "titel": "Geschlossenes System",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2005-06)",
     "datei": "emkg-schutzleitfaden-300-geschlossenes-system.md",
     "pdf": "emkg-schutzleitfaden-300-geschlossenes-system.pdf"
    },
    "301": {
     "nr": "301",
     "titel": "Handschuhkasten (glove box)",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2007-06)",
     "datei": "emkg-schutzleitfaden-301-handschuhkasten-glove-box.md",
     "pdf": "emkg-schutzleitfaden-301-handschuhkasten-glove-box.pdf"
    },
    "305": {
     "nr": "305",
     "titel": "Fassbefüllung",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2007-05)",
     "datei": "emkg-schutzleitfaden-305-fassbefuellung.md",
     "pdf": "emkg-schutzleitfaden-305-fassbefuellung.pdf"
    },
    "306": {
     "nr": "306",
     "titel": "Fassentleerung",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2007-05)",
     "datei": "emkg-schutzleitfaden-306-fassentleerung.md",
     "pdf": "emkg-schutzleitfaden-306-fassentleerung.pdf"
    },
    "307": {
     "nr": "307",
     "titel": "Befüllung und Entleerung von IBC-Containern (Feststoffe)",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2007-05)",
     "datei": "emkg-schutzleitfaden-307-befuellung-und-entleerung-von-ibc.md",
     "pdf": "emkg-schutzleitfaden-307-befuellung-und-entleerung-von-ibc.pdf"
    },
    "308": {
     "nr": "308",
     "titel": "Befüllung und Entleerung von IBC-Containern (Flüssigkeiten)",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2007-05)",
     "datei": "emkg-schutzleitfaden-308-befuellung-und-entleerung-von-ibc.md",
     "pdf": "emkg-schutzleitfaden-308-befuellung-und-entleerung-von-ibc.pdf"
    },
    "310": {
     "nr": "310",
     "titel": "Befüllen und Entleeren von Tankfahrzeugen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2005-06)",
     "datei": "emkg-schutzleitfaden-310-befuellen-und-entleeren-von-tankfahrzeugen.md",
     "pdf": "emkg-schutzleitfaden-310-befuellen-und-entleeren-von-tankfahrzeugen.pdf"
    },
    "312": {
     "nr": "312",
     "titel": "Umpumpen von Flüssigkeiten",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2005-06)",
     "datei": "emkg-schutzleitfaden-312-umpumpen-von-fluessigkeiten.md",
     "pdf": "emkg-schutzleitfaden-312-umpumpen-von-fluessigkeiten.pdf"
    },
    "BP 1081": {
     "nr": "BP 1081",
     "titel": "Vorbeugender Holzschutz: Grundmaßnahmen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp1081-vorbeugender-holzschutz-grundmassnahmen.md",
     "pdf": "emkg-schutzleitfaden-bp1081-vorbeugender-holzschutz-grundmassnahmen.pdf"
    },
    "BP 1082": {
     "nr": "BP 1082",
     "titel": "Bekämpfender Holzschutz: Grundmaßnahmen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp1082-bekaempfender-holzschutz-grundmassnahmen.md",
     "pdf": "emkg-schutzleitfaden-bp1082-bekaempfender-holzschutz-grundmassnahmen.pdf"
    },
    "BP 1141": {
     "nr": "BP 1141",
     "titel": "Bekämpfung von Schadnagern: Grundmaßnahmen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp1141-bekaempfung-von-schadnagern-grundmassnahmen.md",
     "pdf": "emkg-schutzleitfaden-bp1141-bekaempfung-von-schadnagern-grundmassnahmen.pdf"
    },
    "BP 1181": {
     "nr": "BP 1181",
     "titel": "Bekämpfung von Insekten: Grundmaßnahmen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp1181-bekaempfung-von-insekten-grundmassnahmen.md",
     "pdf": "emkg-schutzleitfaden-bp1181-bekaempfung-von-insekten-grundmassnahmen.pdf"
    },
    "BP 2081": {
     "nr": "BP 2081",
     "titel": "Holzschutzmittel: Streichen, Rollen, Spachteln und Wischen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2081-holzschutzmittel-streichen-rollen-spachteln-und.md",
     "pdf": "emkg-schutzleitfaden-bp2081-holzschutzmittel-streichen-rollen-spachteln-und.pdf"
    },
    "BP 2082": {
     "nr": "BP 2082",
     "titel": "Holzschutzmittel: Bekämpfender Holzschutz in Sprühanwendungen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2082-holzschutzmittel-bekaempfender-holzschutz-in-spruehanwendungen.md",
     "pdf": "emkg-schutzleitfaden-bp2082-holzschutzmittel-bekaempfender-holzschutz-in-spruehanwendungen.pdf"
    },
    "BP 2083": {
     "nr": "BP 2083",
     "titel": "Anwendung von Holzschutzmitteln in offenen Anlagen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2083-anwendung-von-holzschutzmitteln-in-offenen.md",
     "pdf": "emkg-schutzleitfaden-bp2083-anwendung-von-holzschutzmitteln-in-offenen.pdf"
    },
    "BP 2084": {
     "nr": "BP 2084",
     "titel": "Anwendung von Holzschutzmitteln in geschlossenen Anlagen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2084-anwendung-von-holzschutzmitteln-in-geschlossenen.md",
     "pdf": "emkg-schutzleitfaden-bp2084-anwendung-von-holzschutzmitteln-in-geschlossenen.pdf"
    },
    "BP 2141": {
     "nr": "BP 2141",
     "titel": "Bekämpfung von Schadnagern: Ausbringung von schüttfähigen Ködern",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2141-bekaempfung-von-schadnagern-ausbringung-von.md",
     "pdf": "emkg-schutzleitfaden-bp2141-bekaempfung-von-schadnagern-ausbringung-von.pdf"
    },
    "BP 2142": {
     "nr": "BP 2142",
     "titel": "Bekämpfung von Schadnagern: Ausbringung von Formködern und Pasten",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2142-bekaempfung-von-schadnagern-ausbringung-von.md",
     "pdf": "emkg-schutzleitfaden-bp2142-bekaempfung-von-schadnagern-ausbringung-von.pdf"
    },
    "BP 2143": {
     "nr": "BP 2143",
     "titel": "Bekämpfung von Schadnagern: Ausbringung von Schäumen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2143-bekaempfung-von-schadnagern-ausbringung-von.md",
     "pdf": "emkg-schutzleitfaden-bp2143-bekaempfung-von-schadnagern-ausbringung-von.pdf"
    },
    "BP 2181": {
     "nr": "BP 2181",
     "titel": "Bekämpfung von Insekten: Granulate (fertig verwendbar)",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2181-bekaempfung-von-insekten-granulate-fertig.md",
     "pdf": "emkg-schutzleitfaden-bp2181-bekaempfung-von-insekten-granulate-fertig.pdf"
    },
    "BP 2182": {
     "nr": "BP 2182",
     "titel": "Bekämpfung von Insekten: Streichen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2182-bekaempfung-von-insekten-streichen.md",
     "pdf": "emkg-schutzleitfaden-bp2182-bekaempfung-von-insekten-streichen.pdf"
    },
    "BP 2183": {
     "nr": "BP 2183",
     "titel": "Bekämpfung von Insekten: Sprühen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2183-bekaempfung-von-insekten-spruehen.md",
     "pdf": "emkg-schutzleitfaden-bp2183-bekaempfung-von-insekten-spruehen.pdf"
    },
    "BP 2184": {
     "nr": "BP 2184",
     "titel": "Bekämpfung von Insekten: Gele, Pasten",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2184-bekaempfung-von-insekten-gele-pasten.md",
     "pdf": "emkg-schutzleitfaden-bp2184-bekaempfung-von-insekten-gele-pasten.pdf"
    },
    "BP 2185": {
     "nr": "BP 2185",
     "titel": "Bekämpfung von Insekten: Gießkanne oder Dosierwagen",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2014-08)",
     "datei": "emkg-schutzleitfaden-bp2185-bekaempfung-von-insekten-giesskanne-oder.md",
     "pdf": "emkg-schutzleitfaden-bp2185-bekaempfung-von-insekten-giesskanne-oder.pdf"
    },
    "La-101": {
     "nr": "La-101",
     "titel": "Bereitstellen und Lagern - Mindeststandards",
     "stand": "05/2022 (laut PDF-Fußzeile „Stand 05/22“)",
     "datei": "emkg-schutzleitfaden-la101-bereitstellen-und-lagern-mindeststandards.md",
     "pdf": "emkg-schutzleitfaden-la101-bereitstellen-und-lagern-mindeststandards.pdf"
    },
    "pc-170": {
     "nr": "pc-170",
     "titel": "Brandschutzmaßnahmen - Mindeststandards",
     "stand": "03/2023",
     "datei": "emkg-schutzleitfaden-pc170-brandschutzmassnahmen-mindeststandards.md",
     "pdf": "emkg-schutzleitfaden-pc170-brandschutzmassnahmen-mindeststandards.pdf"
    },
    "pc-370": {
     "nr": "pc-370",
     "titel": "Hohe Brandschutzmaßnahmen - Grundanforderungen - Geschlossenes System",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2016-05)",
     "datei": "emkg-schutzleitfaden-pc370-hohe-brandschutzmassnahmen-grundanforderungen-geschlossenes-system.md",
     "pdf": "emkg-schutzleitfaden-pc370-hohe-brandschutzmassnahmen-grundanforderungen-geschlossenes-system.pdf"
    },
    "S 001": {
     "nr": "S 001",
     "titel": "Augenoptiker",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2009-08)",
     "datei": "emkg-schutzleitfaden-s001-augenoptiker.md",
     "pdf": "emkg-schutzleitfaden-s001-augenoptiker.pdf"
    },
    "S 002": {
     "nr": "S 002",
     "titel": "Abstellen von Dieselfahrzeugen in Wachen und Gerätehäusern der Feuerwehr",
     "stand": "im Dokument nicht angegeben (PDF erstellt 2010-01)",
     "datei": "emkg-schutzleitfaden-s002-abstellen-von-dieselfahrzeugen-in-wachen.md",
     "pdf": "emkg-schutzleitfaden-s002-abstellen-von-dieselfahrzeugen-in-wachen.pdf"
    },
    "S 003": {
     "nr": "S 003",
     "titel": "Druckerservice",
     "stand": "Mai 2026",
     "datei": "emkg-schutzleitfaden-s003-druckerservice.md",
     "pdf": "emkg-schutzleitfaden-s003-druckerservice.pdf"
    }
   }
  };
  /* EMKG-DATEN>> */

  var VERSION = '1.0 · Regelwerk 08.10.2026 · Z26 ' + (DATEN && DATEN.quelle ? DATEN.quelle.stand : '?');

  var ORD = {
    einatmen: ['A', 'B', 'C', 'D', 'E'],
    haut: ['HA', 'HB', 'HC', 'HD', 'HE'],
    augen: ['Au-A', 'Au-B', 'Au-C'],
    brand: ['pc-A', 'pc-B', 'pc-C', 'pc-D', 'pc-E'],
    lagern: ['La-A', 'La-B', 'La-C', 'La-D', 'La-E', 'La-F']
  };
  var FG = ['niedrig', 'mittel', 'hoch'];
  var MG_EINATMEN = ['gering', 'mittel', 'hoch'];
  var MG_BRAND = ['klein', 'mittel', 'groß'];
  var HAUT_BEDARF = ['gering', 'erweitert', 'hoch'];

  // ---------------------------------------------------------------- Entscheidungstabellen
  // Einatmen Tab. 4.1 (LF22 S. 24): [Menge gering/mittel/hoch][FG niedrig/mittel/hoch]; 4 = Beratung
  var TAB_EINATMEN = {
    A: [[1, 1, 1], [1, 1, 2], [1, { fl: 1, fest: 2 }, 2]],
    B: [[1, 1, 1], [1, 2, 2], [1, { fl: 2, fest: 3 }, 3]],
    C: [[1, { fl: 2, fest: 1 }, 2], [2, 3, 3], [2, 3, 3]],
    D: [[2, { fl: 3, fest: 2 }, 3], [3, 4, 4], [3, 4, 4]],
    E: [[4, 4, 4], [4, 4, 4], [4, 4, 4]]
  };
  // Haut Tab. 7.1 (LF22 S. 32): Spalten klein+kurz, klein+lang, groß+kurz, groß+lang; 1 gering, 2 erweitert, 3 hoch
  var TAB_HAUT = { HA: [1, 1, 1, 2], HB: [1, 2, 2, 2], HC: [1, 2, 2, 3], HD: [2, 2, 2, 3], HE: [3, 3, 3, 3] };
  // Augen Tab. 6 (AU25 S. 5): 1 = Stufe 1, B = Bügelbrille (Stufe 2), K = Korbbrille (Stufe 2)
  var TAB_AUGEN = {
    'Au-A': [['1', '1', '1'], ['1', '1', 'K'], ['1', { fl: '1', fest: 'K' }, 'K']],
    'Au-B': [['1', '1', 'B'], ['1', 'B', 'K'], ['B', { fl: 'B', fest: 'K' }, 'K']],
    'Au-C': [['B', 'K', 'K'], ['K', 'K', 'K'], ['K', 'K', 'K']]
  };
  // Brand & Explosion Tab. 4.9 (BE20 S. 30): '2*' = „bei Feststoffen reichen Brandschutzmaßnahmen ab Stufe 2"
  var TAB_BRAND = {
    'pc-A': [['1', '1', '1'], ['1', '1', '2*'], ['1', '2*', '2*']],
    'pc-B': [['1', '1', '1'], ['1', '2*', '2*'], ['2*', '2*', '3*']],
    'pc-C': [['1', '1', { fl: '1', fest: '2' }], ['2*', '2', { fl: '2', fest: '3' }], ['2*', '3', '3']]
  };

  // ---------------------------------------------------------------- Satzlisten aus dem Regelwerk
  var AUSNAHME_15MIN = ['H335', 'H314', 'H311+H314', 'H334', 'EUH071'];              // F3
  var ENTZUENDBAR = ['H224', 'H225', 'H226', 'H228'];                                  // Regelwerk Teil I §5 Hinweis
  var ENTZUENDBAR_FL = ['H224', 'H225', 'H226'];
  var EINSTIEG_BRAND_EUH = ['EUH001', 'EUH006', 'EUH014', 'EUH018', 'EUH019', 'EUH044']; // BE20 S. 20 Tab. 4.1
  var VERSCHLUSS_LA101 = ['H300', 'H301', 'H310', 'H311', 'H311+H314', 'H330', 'H331', 'H350', 'H350i', 'H340', 'H370', 'H372'];
  var CMR_SENS_LF22 = ['H340', 'H341', 'H350', 'H350i', 'H351', 'H360', 'H360F', 'H360Fd', 'H360FD', 'H360D', 'H360Df',
    'H361', 'H361d', 'H361f', 'H361fd', 'H334'];                                         // LF22 S. 23 (CMR 1/2, atemwegssens.)
  var REAKTIV_LAGERN = ['EUH014', 'EUH029', 'EUH031', 'EUH032'];                       // SLF 2710 Nr. 1 Anm.
  var CHEM_REAKTION = ['H242', 'H260', 'H261', 'H271', 'H272'];                        // BE20 S. 48; SLF 2602 Nr. 6

  // ---------------------------------------------------------------- Schutzleitfäden: Voraussetzungen (Regelwerk 4.3/4.4)
  // unbedingte Voraussetzungen „setzt voraus" laut SLF-Kopf
  var VOR = {
    '2500': ['2000'], '2501': ['2000'], '2502': ['2000', '2500'],
    '2510': ['2000', '2500'], '2511': ['2000', '2500'], '2512': ['2000', '2500'], '2513': ['2000', '2500'],
    '2514': ['2000', '2500'], '2515': ['2000', '2500'],
    '2100': ['2000'], '2110': ['2000', '2100'], '2111': ['2000', '2100'], '2112': ['2000', '2100'],
    '2120': ['2000', '2100'], '2121': ['2000', '2100'], '2200': ['2000'], '2201': ['2000'], '2714': ['2000'],
    '2600': ['2601'], '2602': ['2603'], '2603': ['2600', '2602', '2500']
  };
  // Tätigkeits-SLF 24xx: Voraussetzungen mit Bedingung (Regelwerk 4.4, wörtlich aus den SLF-Köpfen)
  // wenn: immer | staub | staub_ex | entzuendbar | entzuendbar_fl | brennbar | hautkontakt | loesemittel | wahl | ggf
  var VOR_24 = {
    '2411': [['immer', '2000', '2500', '2515']],
    '2421': [['immer', '2000', '2500', '2515'], ['staub', '2502'], ['staub_ex', '2603']],
    '2422': [['immer', '2000', '2500'], ['entzuendbar_fl', '2425']],
    '2423': [['immer', '2000', '2500', '2515', '2502']],
    '2424': [['immer', '2000', '2500', '2515'], ['staub', '2502'], ['brennbar', '2600'], ['staub_ex', '2603']],
    '2425': [['immer', '2000', '2500', '2600', '2603'], ['ggf', '2515', '2602']],
    '2426': [['immer', '2000', '2425', '2500', '2515', '2600', '2603']],
    '2431': [['immer', '2000', '2500', '2502'], ['wahl', '2515', '2510'], ['staub_ex', '2603']],
    '2432': [['immer', '2000'], ['brennbar', '2600'], ['hautkontakt', '2100']],
    '2433': [['immer', '2000'], ['brennbar', '2600'], ['hautkontakt', '2100']],
    '2441': [['immer', '2000', '2500', '2714'], ['wahl', '2510', '2511', '2512', '2515'], ['staub', '2502'], ['entzuendbar', '2600', '2603']],
    '2442': [['immer', '2000', '2500', '2515', '2714'], ['staub', '2502'], ['entzuendbar', '2600', '2603']],
    '2451': [['immer', '2000', '2462', '2500', '2600', '2603'], ['wahl', '2510', '2512']],
    '2452': [['immer', '2000', '2500', '2100'], ['wahl', '2510', '2512'], ['loesemittel', '2600', '2603']],
    '2453': [['immer', '2000', '2500', '2512', '2100'], ['loesemittel', '2600', '2603']],
    '2454': [['immer', '2000', '2500'], ['staub_oder_entzuendbar', '2603']],
    '2461': [['immer', '2000'], ['staub', '2502'], ['staub_ex', '2600', '2603']],
    '2462': [['immer', '2000', '2502']],
    '2471': [['immer', '2000', '2500', '2515']]
  };
  var BEDINGUNG_TEXT = {
    immer: 'setzt voraus', staub: 'bei Staubexposition', staub_ex: 'Staubexplosion möglich',
    entzuendbar: 'entzündbarer Gefahrstoff', entzuendbar_fl: 'entzündbare Flüssigkeit', brennbar: 'brennbarer Gefahrstoff',
    hautkontakt: 'Hautkontakt möglich', loesemittel: 'lösemittelhaltig', wahl: 'wahlweise (eine davon)',
    ggf: 'ggf. (nach Bedarf)', staub_oder_entzuendbar: 'entzündbare Flüssigkeiten oder Stäube'
  };
  // Tätigkeitsart → SLF Stufe 2 (24xx) / Stufe 3 (30x), Zuordnung über die SLF-Titel
  var TAETIGKEIT = {
    foerderband: { s2: '2411' },
    saecke_befuellen: { s2: '2421' },
    faesser_befuellen: { s2: '2422', s3: '305' },
    ibc_befuellen: { s2: '2422', s3: { fl: '308', fest: '307' } },
    ibc_entleeren: { s3: { fl: '308', fest: '307' } },
    pulverflaschen_befuellen: { s2: '2423' },
    kessel_beschicken: { s2: '2424' },
    abfuellen_entzuendbar: { s2: '2425' },
    abfuellen_loesemittel: { s2: '2426' },
    saecke_entleeren: { s2: '2431' },
    fass_entleeren_pumpe: { s2: '2432', s3: '306' },
    fass_entleeren_zapfhahn: { s2: '2433', s3: '306' },
    wiegen: { s2: '2441' },
    mischen: { s2: '2442' },
    pulverbeschichten: { s2: '2451' },
    spritzlackieren: { s2: '2452' },
    streichen_rollen_tauchen: { s2: '2453' },
    trocknen: { s2: '2454' },
    reinigen: { s2: '2461' },
    filterwechsel: { s2: '2462' },
    pellets_herstellen: { s2: '2471' },
    glovebox: { s3: '301' },
    tankfahrzeug: { s3: '310' },
    umpumpen: { s3: '312' }
  };
  // F4: nur aktuelle Leitfäden ausgeben (Stufe 1 = 100/110/120 + La-101, pc-170; 2000er; Stufe 3 = 300–312 + pc-370)
  var ERLAUBT = /^(100|110|120|La-101|pc-170|pc-370|2\d{3}|30[0-9]|31[0-2])$/;

  // ---------------------------------------------------------------- Hilfen
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function pushU(arr, v) { if (arr.indexOf(v) < 0) arr.push(v); }
  function hat(codes, liste) { return codes.filter(function (c) { return liste.indexOf(c) >= 0; }); }
  function anzeige(c) { return c === 'KEIN' ? 'kein H-Satz' : c; }
  function zelleWert(z, agg) { return (z && typeof z === 'object') ? (agg === 'fest' ? z.fest : z.fl) : z; }

  function neuesModul() {
    return {
      gruppe: null, treiber: [], eingaben: {}, stufe: null, stufeAlternativ: [], schutzleitfaeden: [],
      massnahmenHinweise: [], fundstellen: [], hinweise: [], konservativ: [], fehlend: []
    };
  }

  function SlfListe() { this.liste = []; this.idx = {}; }
  SlfListe.prototype.add = function (nr, grund) {
    nr = String(nr);
    if (!ERLAUBT.test(nr)) throw new Error('EMKG: SLF ' + nr + ' ist nach Festlegung 4 nicht auszugeben');
    var d = DATEN.slf[nr];
    if (!d) throw new Error('EMKG: Schutzleitfaden ' + nr + ' fehlt im Datenblock');
    if (this.idx[nr] !== undefined) {
      var e = this.liste[this.idx[nr]];
      if (grund && e.grund.indexOf(grund) < 0) e.grund += (e.grund ? '; ' : '') + grund;
      return false;
    }
    this.idx[nr] = this.liste.length;
    this.liste.push({ nr: d.nr, titel: d.titel, stand: d.stand, datei: d.datei, grund: grund || '' });
    return true;
  };
  // mit unbedingten Voraussetzungen (transitiv, zyklenfest)
  SlfListe.prototype.addV = function (nr, grund) {
    var neu = this.add(nr, grund), self = this;
    if (!neu) return;
    (VOR[nr] || []).forEach(function (v) { self.addV(v, 'Voraussetzung von SLF ' + nr); });
  };

  // ---------------------------------------------------------------- Kontext
  function Kontext(stoff, taetigkeit) {
    this.s = stoff || {};
    this.t = taetigkeit || {};
    this.hinweise = [];
    this.konservativ = [];
    this.fehlend = [];
    this.v = {};                    // Zwischenwerte für geringe Gefährdung
    this.saetzeAufloesen();
  }
  Kontext.prototype.fehlt = function (m, feld, text) {
    pushU(m.fehlend, feld);
    pushU(this.fehlend, feld);
    if (text) pushU(m.hinweise, text);
  };
  Kontext.prototype.kons = function (m, modul, text) {
    pushU(m.konservativ, text);
    pushU(this.konservativ, modul + ': ' + text + ' – konservativ angesetzt');
  };

  // H-/EUH-Sätze normalisieren, Kombinationen zerlegen, unbekannte Kodierungen sammeln (nicht raten)
  Kontext.prototype.saetzeAufloesen = function () {
    var roh = this.s.h_saetze, codes = [], unbekannt = [], keys = Object.keys(DATEN.saetze);
    this.saetzeOk = Array.isArray(roh);
    if (!this.saetzeOk) { pushU(this.fehlend, 'stoff.h_saetze'); this.codes = []; this.unbekannt = []; return; }
    function finde(c) {
      if (DATEN.saetze[c]) return c;
      var treffer = keys.filter(function (k) { return k.toLowerCase() === c.toLowerCase(); });
      return treffer.length === 1 ? treffer[0] : null;  // H360FD/H360Fd nicht raten
    }
    roh.forEach(function (eintrag) {
      var c = String(eintrag).replace(/\s+/g, '');
      if (!c) return;
      c = c.replace(/^euh/i, 'EUH').replace(/^h/i, 'H').replace(/\+h/gi, '+H');
      var k = finde(c);
      if (k) { pushU(codes, k); if (k.indexOf('+') > 0) k.split('+').forEach(function (t) { pushU(codes, t); }); return; }
      if (c.indexOf('+') > 0) {                       // R2.6: Kombination → Bestandteile einzeln
        c.split('+').forEach(function (t) { var kk = finde(t); if (kk) pushU(codes, kk); else pushU(unbekannt, t); });
        return;
      }
      pushU(unbekannt, c);
    });
    if (codes.indexOf('H311') >= 0 && codes.indexOf('H314') >= 0) pushU(codes, 'H311+H314'); // R2.6 Ausnahme
    this.codes = codes.filter(function (c) { return c !== 'KEIN'; });
    this.unbekannt = unbekannt;
    var self = this;
    unbekannt.forEach(function (u) {
      pushU(self.fehlend, 'stoff.h_saetze: ' + u + ' (keine Zuordnung in Z26)');
    });
  };
  Kontext.prototype.saetzeBrauchbar = function (m) {
    if (!this.saetzeOk) { this.fehlt(m, 'stoff.h_saetze'); return false; }
    if (this.unbekannt.length) {
      var self = this;
      this.unbekannt.forEach(function (u) { self.fehlt(m, 'stoff.h_saetze: ' + u + ' (keine Zuordnung in Z26)'); });
      pushU(m.hinweise, 'Unbekannte Kodierung – Zuordnung bei Nikolai/BAuA klären, nicht geraten (Regelwerk Teil II O12, Teil III G5).');
      return false;
    }
    return true;
  };
  Kontext.prototype.maxGruppe = function (spalte, ord) {
    var liste = this.codes.length ? this.codes : ['KEIN'], best = -1, treiber = [];
    liste.forEach(function (c) {
      var i = ord.indexOf(DATEN.saetze[c][spalte]);
      if (i > best) { best = i; treiber = [c]; } else if (i === best) treiber.push(c);
    });
    // niedrigste Gruppe: kein Satz „treibt" sie – Grundzuordnung (R2.5)
    if (best === 0 && this.codes.length) treiber = ['kein Satz mit höherer Zuordnung'];
    return { index: best, gruppe: ord[best], treiber: treiber.map(anzeige) };
  };

  // Mengengruppe nach F2: < 1 kg/l gering · 1 kg/l bis < 1 t/m³ mittel · ≥ 1 t/m³ hoch
  var EINHEIT = { g: 0.001, kg: 1, t: 1000, ml: 0.001, l: 1, m3: 1000, 'm³': 1000 };
  Kontext.prototype.mengengruppe = function (m) {
    var mg = this.t.menge, w = mg ? num(mg.wert) : null, f = mg ? EINHEIT[String(mg.einheit || '').toLowerCase()] : undefined;
    if (w === null || f === undefined || w < 0) { this.fehlt(m, 'taetigkeit.menge'); return null; }
    var basis = w * f, i = basis < 1 ? 0 : (basis < 1000 ? 1 : 2);
    m.eingaben.menge = w + ' ' + mg.einheit;
    if (this.t.grossflaechig === true) pushU(m.hinweise, 'Großflächige Anwendung: Menge pro Arbeitstag ansetzen (LF22 S. 19; BE20 S. 26).');
    return i;
  };

  function siedepunktWert(v) {
    if (Array.isArray(v)) { var a = v.map(num).filter(function (x) { return x !== null; }); return a.length ? Math.min.apply(null, a) : null; }
    if (v && typeof v === 'object') return num(v.min);
    return num(v);
  }
  function dampfdruckWert(v) {
    if (Array.isArray(v)) { var a = v.map(num).filter(function (x) { return x !== null; }); return a.length ? Math.max.apply(null, a) : null; }
    if (v && typeof v === 'object') return num(v.max);
    return num(v);
  }
  // FG flüssig über Siedepunkt (LF22 Tab. 3.1 / BE20 Tab. 4.6/4.7); Grenzwerte → höhere Gruppe (F1, O4/O7)
  function fgSiedepunkt(sdp, at, r) {
    var gN = 5 * at + 50, gH = 2 * at + 10, i;
    if (sdp > gN) i = 0;
    else if (sdp <= gH) {
      i = 2;
      if (sdp === gH && at === 20) r.kons.push('Siedepunkt ' + sdp + ' °C genau auf der Grenze mittel/hoch (Tab. 3.1 RT-Spalte: mittel; 2·AT+10: hoch) → hoch (F1, O4)');
    } else {
      i = 1;
      if (sdp === gN) r.kons.push('Siedepunkt ' + sdp + ' °C genau auf der Grenze niedrig/mittel (5·AT+50 = ' + gN + ' °C) → mittel (F1, O4)');
    }
    r.quelle.push('Siedepunkt ' + sdp + ' °C bei ' + at + ' °C → ' + FG[i] + ' (LF22 S. 20 Tab. 3.1; BE20 S. 27)');
    return i;
  }
  function fgDampfdruck(dd, r) {
    var i = dd < 5 ? 0 : (dd < 250 ? 1 : 2);
    if (dd === 250) r.kons.push('Dampfdruck genau 250 hPa (Grenze mittel/hoch) → hoch (F1, O7)');
    r.quelle.push('Dampfdruck ' + dd + ' hPa → ' + FG[i] + ' (LF22 S. 20 Tab. 3.1; BE20 S. 27 Tab. 4.6)');
    return i;
  }
  // Freisetzungsgruppe (gleich für Einatmen, Augen, Brand – AU25 S. 1); modus 'brand' kennt zusätzlich „Abrieb"
  Kontext.prototype.freisetzung = function (modus) {
    var key = 'fg_' + modus;
    if (this[key]) return this[key];
    var s = this.s, t = this.t, r = { index: null, quelle: [], fehlend: [], kons: [] };
    var at = num(t.verarbeitungstemp_c), dd = dampfdruckWert(s.dampfdruck_hpa), kand = [];
    if (s.aggregat === 'fluessig') {
      if (t.versprueht === true) { r.index = 2; r.quelle.push('Versprühen/Aerosol → hoch (LF22 S. 21; BE20 S. 28)'); }
      else if (t.waessrig_nichtfluechtig === true) { r.index = 0; r.quelle.push('wässrige Lösung, gelöste Stoffe gering flüchtig, nicht versprüht → niedrig (LF22 S. 21; BE20 S. 28)'); }
      else if (at === null) r.fehlend.push('taetigkeit.verarbeitungstemp_c');
      else {
        var sdp = siedepunktWert(s.siedepunkt_c);
        if (sdp !== null) kand.push(fgSiedepunkt(sdp, at, r));
        if (dd !== null) {
          if (at <= 20) {
            kand.push(fgDampfdruck(dd, r));
            if (at < 20) r.kons.push('Dampfdruck bei 20 °C für ' + at + ' °C verwendet (überschätzt die Freisetzung)');
          } else r.quelle.push('Dampfdruck gilt nur bei Raumtemperatur – bei ' + at + ' °C nicht verwendbar');
        }
        if (!kand.length) r.fehlend.push(dd !== null ? 'stoff.siedepunkt_c' : 'stoff.siedepunkt_c oder stoff.dampfdruck_hpa');
      }
    } else if (s.aggregat === 'fest') {
      var st = FG.indexOf(s.staubung);
      if (st < 0) r.fehlend.push('stoff.staubung');
      else { kand.push(st); r.quelle.push('Staubungsverhalten ' + s.staubung + ' (LF22 S. 21 Tab. 3.2; BE20 S. 29 Tab. 4.8)'); }
      if (dd !== null && at !== null && at <= 20) {   // flüchtige Feststoffe, LF22 S. 21 Fn. 2
        kand.push(fgDampfdruck(dd, r));
      }
      if (modus === 'brand' && t.abrieb === true) { kand.push(2); r.quelle.push('Abrieb durch Fördern/Abwerfen/Abkippen → hoch (BE20 S. 29)'); }
    }
    if (r.index === null && kand.length && !r.fehlend.length) {
      r.index = Math.max.apply(null, kand);
      var verschieden = kand.some(function (k) { return k !== kand[0]; });
      if (verschieden) r.kons.push('Kenngrößen führen zu verschiedenen Freisetzungsgruppen → höhere (' + FG[r.index] + ') angesetzt (F1, O9)');
    }
    var self = this;
    r.kons.forEach(function (k) { pushU(self.konservativ, 'Freisetzungsgruppe: ' + k + ' – konservativ angesetzt'); });
    this[key] = r;
    return r;
  };
  function fgUebernehmen(ctx, m, r) {
    r.fehlend.forEach(function (f) { ctx.fehlt(m, f); });
    r.kons.forEach(function (k) { pushU(m.konservativ, k); });
    if (r.index !== null) m.eingaben.freisetzungsgruppe = FG[r.index];
    if (r.quelle.length) m.eingaben.freisetzungBegruendung = r.quelle.slice();
  }

  // Tätigkeitsart auflösen (Schlüssel aus TAETIGKEIT oder direkte SLF-Nummer)
  Kontext.prototype.taetigkeitsart = function () {
    var a = this.t.taetigkeitsart;
    if (a === undefined || a === null || a === '') return null;
    a = String(a).trim();
    if (TAETIGKEIT[a]) return { key: a, s2: TAETIGKEIT[a].s2, s3: TAETIGKEIT[a].s3 };
    if (/^24\d\d$/.test(a)) return { key: a, s2: a };
    if (/^3\d\d$/.test(a)) return { key: a, s3: a };
    return { key: a, unbekannt: true };
  };
  // Bedingungen der 24xx-Köpfe (O11: Auslegung, nicht als Schwelle definiert)
  Kontext.prototype.bedingung = function (b, m, modul) {
    var s = this.s, t = this.t, c = this.codes, fg = this.freisetzung('einatmen').index;
    var staub = s.aggregat === 'fest' && fg !== null && fg >= 1;
    var staubEx = s.aggregat === 'fest' && this.v.ggBrandIndex !== undefined ? this.v.ggBrandIndex >= 2 : s.aggregat === 'fest';
    var entz = hat(c, ENTZUENDBAR).length > 0;
    switch (b) {
      case 'immer': case 'wahl': return true;
      case 'ggf': return true;
      case 'staub':
        if (staub) pushU(m.hinweise, '„Staubexposition" ausgelegt als Feststoff mit Freisetzungsgruppe ≥ mittel (Regelwerk O11).');
        return staub;
      case 'staub_ex': return s.aggregat === 'fest' && staubEx && s.staub_nicht_explosionsfaehig !== true;
      case 'entzuendbar': return entz;
      case 'entzuendbar_fl': return hat(c, ENTZUENDBAR_FL).length > 0;
      case 'brennbar':
        if (entz) return true;
        if (this.v.stufeBrand >= 2) { pushU(m.hinweise, '„brennbar" ausgelegt als Brand-&-Ex-Stufe ≥ 2 (Regelwerk O11).'); return true; }
        return false;
      case 'hautkontakt': return t.hautkontakt_ausgeschlossen !== true;
      case 'staub_oder_entzuendbar': return entz || staub;
      case 'loesemittel':
        if (entz || s.loesemittelhaltig === true) return true;
        if (s.loesemittelhaltig === false) return false;
        this.kons(m, modul, 'lösemittelhaltig nicht angegeben → Brand-/Ex-Leitfäden 2600/2603 einbezogen (F1)');
        return true;
    }
    return false;
  };
  Kontext.prototype.taetigkeitsSlf = function (L, m, stufe, modul) {
    var art = this.taetigkeitsart(), self = this;
    if (!art) {
      pushU(m.massnahmenHinweise, stufe === 2
        ? 'Tätigkeits-Schutzleitfaden 24xx nach Tätigkeit wählen (taetigkeitsart angeben); passt keiner: Einrichtung 2510–2515 oder qualifizierte Beratung (LF22 S. 22, R3.6).'
        : 'Neben SLF 300 den tätigkeitspassenden SLF 301–312 wählen (taetigkeitsart angeben); passt keiner: Beratung bzw. branchenbezogene Bewertung (LF22 S. 22–23).');
      return;
    }
    if (art.unbekannt) { pushU(m.hinweise, 'Unbekannte Tätigkeitsart „' + art.key + '" – Schutzleitfaden manuell wählen.'); return; }
    var nr = stufe === 2 ? art.s2 : zelleWert(art.s3, this.s.aggregat);
    if (!nr) {
      pushU(m.massnahmenHinweise, 'Für diese Tätigkeit gibt es keinen Schutzleitfaden der Stufe ' + stufe + ' → qualifizierte Beratung (LF22 S. 22–23, R3.6).');
      return;
    }
    L.addV(nr, 'Tätigkeit (' + art.key + '), Stufe ' + stufe);
    if (stufe !== 2) return;
    (VOR_24[nr] || []).forEach(function (regel) {
      var b = regel[0];
      if (!self.bedingung(b, m, modul)) return;
      regel.slice(1).forEach(function (v) { L.addV(v, 'SLF ' + nr + ': ' + BEDINGUNG_TEXT[b]); });
      if (b === 'wahl') pushU(m.massnahmenHinweise, 'SLF ' + nr + ': eine Einrichtung wählen – ' + regel.slice(1).join(' oder ') + '.');
    });
    if (this.t.beschaffung_absaugung === true) L.addV('2501', 'Beschaffung einer Absaugung');
    else pushU(m.massnahmenHinweise, 'Bei Neubeschaffung einer Absaugung zusätzlich SLF 2501.');
  };

  // ---------------------------------------------------------------- Modul EINATMEN
  function ggAusAgw(agw, agg) {
    var w = num(agw && agw.wert), e = agw ? String(agw.einheit || '').toLowerCase().replace('³', '3') : '';
    if (w === null || w <= 0) return { fehlt: 'stoff.agw.wert' };
    var gr;
    if (agg === 'fluessig' && e === 'ppm') gr = [500, 50, 5, 0.5, 0.05];
    else if (agg === 'fest' && e === 'mg/m3') gr = [10, 1, 0.1, 0.01, 0.001];
    else return { fehlt: 'stoff.agw.einheit (Flüssigkeit: ppm, Feststoff: mg/m3 – LF22 S. 17 Tab. 1.2)' };
    if (w > gr[0]) return { index: 0, kons: 'AGW ' + w + ' ' + agw.einheit + ' über dem Tabellenbereich (Tab. 1.2 endet bei ' + gr[0] + ') → A (F1, O4)' };
    for (var i = 1; i < 5; i++) if (w > gr[i]) return { index: i - 1 };
    return { index: 4 };
  }
  function tabEinatmen(gg, mg, fg, agg) { return zelleWert(TAB_EINATMEN[ORD.einatmen[gg]][mg][fg], agg); }

  function modulEinatmen(ctx) {
    var m = neuesModul(), s = ctx.s, t = ctx.t, N = 'Einatmen';
    m.fundstellen.push('LF22 S. 16–25 (Tab. 1.2, 2.1, 3.1, 3.2, 4.1, Abb. 4.1)', 'Z26 S. 1–6', 'LF22 S. 34–38 (AGW-Nachweis)');
    if (s.aggregat === 'gas') {
      pushU(m.hinweise, 'Gase: industrielle/gewerbliche Handhabung ist nicht Gegenstand des EMKG-Moduls Einatmen (LF22 S. 7, R0.1) – anderes Verfahren.');
      m.eingaben.ausserhalbEmkg = true;
      return m;
    }
    if (t.stoff_entsteht_bei_taetigkeit === true) {
      pushU(m.hinweise, 'Gefahrstoff entsteht bei der Tätigkeit (Rauch, Pyrolyse, Abgas …) – nicht im EMKG (LF22 S. 7, R0.1).');
      m.eingaben.ausserhalbEmkg = true;
      return m;
    }
    if (!ctx.saetzeBrauchbar(m)) return m;
    if (s.aggregat !== 'fluessig' && s.aggregat !== 'fest') ctx.fehlt(m, 'stoff.aggregat');

    // Schritt 1: Gefährlichkeitsgruppe (R2.1/R2.2/R2.4)
    var gg = null, hs = ctx.maxGruppe('einatmen', ORD.einatmen), agwPfad = false;
    if (s.agw && s.ist_gemisch !== true && (s.aggregat === 'fluessig' || s.aggregat === 'fest')) {
      var a = ggAusAgw(s.agw, s.aggregat);
      if (a.fehlt) ctx.fehlt(m, a.fehlt);
      else {
        agwPfad = true;
        gg = a.index;
        m.treiber = ['AGW ' + s.agw.wert + ' ' + s.agw.einheit];
        m.eingaben.gruppeQuelle = 'AGW (TRGS 900) – LF22 S. 17 Tab. 1.2';
        if (a.kons) ctx.kons(m, N, a.kons);
        if (s.ist_gemisch !== false && hs.index > gg) {   // unklar, ob Stoff oder Gemisch → strengere GG (F1)
          gg = hs.index; m.treiber = hs.treiber; agwPfad = false;
          m.eingaben.gruppeQuelle = 'H-/EUH-Sätze (Z26)';
          ctx.kons(m, N, 'ist_gemisch nicht angegeben: GG aus H-Sätzen (' + hs.gruppe + ') strenger als aus AGW → H-Sätze');
        }
      }
    } else {
      gg = hs.index; m.treiber = hs.treiber;
      m.eingaben.gruppeQuelle = 'H-/EUH-Sätze (Z26) – R2.2';
    }
    if (gg !== null) { m.gruppe = ORD.einatmen[gg]; ctx.v.ggEinatmen = gg; }
    if (s.datenluecken && s.datenluecken.indexOf('akute_toxizitaet') >= 0)
      pushU(m.hinweise, 'Akute Toxizität im SDB nicht bewertet: für Einatmen gibt es unter CLP keine Ersatzregel (Regelwerk O5) – Nikolai fragen.');

    // R3.10: Gemisch mit AGW-Komponenten
    if (s.ist_gemisch === true) {
      var komp = (s.agw_komponenten || []).slice();
      if (s.agw) komp.push(s.agw);
      if (komp.length && gg !== null) {
        var kg = komp.map(function (k) { return ggAusAgw(k, s.aggregat); });
        if (kg.some(function (k) { return k.fehlt; })) pushU(m.hinweise, 'AGW-Komponenten mit fehlender/falscher Einheit – Vergleich nach LF22 S. 36 nicht möglich.');
        else if (kg.every(function (k) { return k.index < gg; })) {
          m.eingaben.nichtmesstechnischAusreichend = true;
          pushU(m.hinweise, 'GG aus der Einstufung des Gemisches strenger als alle GG aus den AGW der Komponenten → EMKG gilt als nichtmesstechnische Ermittlungsmethode, Arbeitsplatzmessung nicht zwingend (LF22 S. 36–38 Abb. 8.3).');
        } else {
          m.eingaben.nichtmesstechnischAusreichend = false;
          pushU(m.massnahmenHinweise, 'AGW-Einhaltung der Komponenten im Einzelfall nachweisen (Messung/Berechnung) – keine maschinelle Regel (LF22 S. 38, Regelwerk O14).');
        }
      }
    }

    // Schritt 2/3: Menge und Freisetzung
    var mg = ctx.mengengruppe(m);
    if (mg !== null) { m.eingaben.mengengruppe = MG_EINATMEN[mg]; ctx.v.mg = mg; }
    var fr = ctx.freisetzung('einatmen');
    fgUebernehmen(ctx, m, fr);
    if (fr.index !== null) ctx.v.fg = fr.index;
    m.eingaben.aggregat = s.aggregat;
    if (t.dauer_min_tag !== undefined) m.eingaben.dauer_min_tag = t.dauer_min_tag;
    if (t.verfahren) m.eingaben.verfahren = t.verfahren;
    if (gg === null || mg === null || fr.index === null || m.fehlend.length) return m;

    // Schritt 4: Tab. 4.1 + Wirksamkeit (R3.9)
    var stufeGG = tabEinatmen(gg, mg, fr.index, s.aggregat);
    if (agwPfad) {
      var stufeStreng = tabEinatmen(Math.min(gg + 1, 4), mg, fr.index, s.aggregat);
      m.eingaben.gruppeOhneMessung = ORD.einatmen[Math.min(gg + 1, 4)];
      m.eingaben.mit_messung = t.mit_messung === true;
      if (t.mit_messung === true) {
        m.stufe = stufeGG;
        if (stufeStreng !== stufeGG) m.stufeAlternativ.push({ stufe: stufeStreng, grund: 'ohne Arbeitsplatzmessung: GG eine Kategorie strenger (' + m.eingaben.gruppeOhneMessung + ') – werden diese Maßnahmen umgesetzt, ist keine Messung nötig', fundstelle: 'LF22 S. 34–35 Abb. 8.2 (R3.9)' });
      } else {
        m.stufe = stufeStreng;
        if (stufeStreng !== stufeGG) m.stufeAlternativ.push({ stufe: stufeGG, grund: 'nur wenn die AGW-Einhaltung anders nachgewiesen wird (Messung TRGS 402, Berechnung, vergleichbare Messungen)', fundstelle: 'LF22 S. 34–35, S. 40 (R3.9)' });
        if (t.mit_messung === undefined) ctx.kons(m, N, 'mit_messung nicht angegeben → ohne Messung gerechnet, GG ' + m.eingaben.gruppeOhneMessung + ' (R3.9)');
      }
    } else m.stufe = stufeGG;

    // 15-min-Regel: nur anbieten (F3)
    if (m.stufe === 2 || m.stufe === 3) {
      var dauer = num(t.dauer_min_tag), aus = hat(ctx.codes, AUSNAHME_15MIN);
      if (dauer === null) pushU(m.hinweise, 'Tätigkeitsdauer nicht angegeben – 15-min-Regel nicht geprüft.');
      else if (dauer < 15) {
        if (aus.length) pushU(m.hinweise, '15-min-Reduktion ausgeschlossen wegen ' + aus.join(', ') + ' (F3; LF22 S. 25).');
        else if (s.geruchsintensiv === true) pushU(m.hinweise, '15-min-Reduktion ausgeschlossen: geruchsintensiver Stoff (F3; LF22 S. 25).');
        else if (s.geruchsintensiv !== false) ctx.kons(m, N, '15-min-Reduktion nicht angeboten, weil „geruchsintensiv" nicht angegeben ist (F3, O3)');
        else m.stufeAlternativ.push({ stufe: m.stufe - 1, grund: 'Tätigkeitsdauer ' + dauer + ' min/Tag (< 15 min): Kann-Regel, Entscheidung bei der Freigabe, Dokumentation „kurz"', fundstelle: 'LF22 S. 25 Abb. 4.1; F3' });
      }
    }

    // Schritt 7: Schutzleitfäden
    var L = new SlfListe();
    L.add('100', 'Maßnahmenstufe 1 – immer (LF22 S. 22)');
    L.add('110', 'Maßnahmenstufe 1 – immer (LF22 S. 22)');
    var staubAp = s.aggregat === 'fest' && fr.index >= 1 && mg >= 1;
    if (m.stufe === 1 && staubAp) {
      L.addV('2502', 'Feststoff, FG ≥ mittel, Menge ≥ mittel: Staubarbeitsplatz (früher SLF 240)');
      ctx.kons(m, N, 'Staubarbeitsplatz bei Stufe 1 über SLF 2502 abgedeckt – Ablösung von SLF 240 nicht amtlich (O10, W11)');
    }
    if (m.stufe === 2) {
      L.addV('2000', 'Maßnahmenstufe 2'); L.addV('2500', 'Maßnahmenstufe 2 – Emissionsminderung an der Entstehungsstelle');
      if (staubAp) L.addV('2502', 'Feststoff, FG ≥ mittel, Menge ≥ mittel (SLF 2502 Geltungsbereich)');
      ctx.taetigkeitsSlf(L, m, 2, N);
    }
    if (m.stufe === 3) {
      L.addV('2000', 'Organisation');
      ctx.kons(m, N, 'SLF 2000 auch bei Stufe 3 ausgegeben (O10)');
      L.add('300', 'Maßnahmenstufe 3 – geschlossenes System (LF22 S. 22)');
      ctx.taetigkeitsSlf(L, m, 3, N);
      pushU(m.massnahmenHinweise, 'Integrierte Absaugungen zählen nach TRGS 500 zum geschlossenen System (LF22 S. 22, R3.4).');
    }
    if (m.stufe === 4) {
      pushU(m.massnahmenHinweise, 'Stufe 4 „Beratung": zuerst stoff-/tätigkeitsbezogene TRGS, UVT-Regeln, GISBAU/GisChem, GESTIS; sonst vertiefende Gefährdungsbeurteilung mit Fachkraft für Arbeitssicherheit/Betriebsarzt (LF22 S. 23, R3.5).');
    }
    if (m.stufe >= 2 && L.idx['2500'] !== undefined) pushU(m.massnahmenHinweise, 'Absaugungen/RLT mindestens alle 3 Jahre prüfen, Staubabscheider jährlich (LF22 S. 34; SLF 2500 Nr. 6).');
    if (s.aggregat === 'fest' && fr.index === 2) pushU(m.massnahmenHinweise, 'Substitution prüfen: geringere Freisetzung (z. B. Granulat statt Pulver) senkt meist die Stufe (LF22 S. 25 Abb. 4.2, R3.8).');
    if (t.verfahren === 'geschlossen') pushU(m.hinweise, 'Verfahren „geschlossen" angegeben: ändert die errechnete Stufe nicht, ist aber ggf. bereits Umsetzung der Stufe 3 (R3.4).');
    m.schutzleitfaeden = L.liste;
    return m;
  }

  // ---------------------------------------------------------------- Modul HAUT
  function modulHaut(ctx) {
    var m = neuesModul(), s = ctx.s, t = ctx.t, N = 'Haut';
    m.fundstellen.push('LF22 S. 27–32 (Tab. 5.1, 6.1, 6.2, 7.1)', 'Z26 S. 1–6', 'H401-1 S. 2', 'H401-2 S. 1–3');
    if (s.aggregat === 'gas') {
      pushU(m.hinweise, 'Gase: nicht Gegenstand des EMKG-Moduls Haut (LF22 S. 7, R0.1).');
      m.eingaben.ausserhalbEmkg = true;
      return m;
    }
    if (!ctx.saetzeBrauchbar(m)) return m;
    var g = ctx.maxGruppe('haut', ORD.haut), gg = g.index;
    m.treiber = g.treiber;
    // R2.9 Datenlücken (H401-1 S. 2)
    var dl = { akute_toxizitaet: 3, hautsensibilisierung: 2, hautreizung: 1 };
    (s.datenluecken || []).forEach(function (d) {
      if (dl[d] !== undefined && dl[d] > gg) { gg = dl[d]; m.treiber = ['Datenlücke ' + d + ' (H401-1 S. 2)']; }
      else if (dl[d] !== undefined && dl[d] === gg) m.treiber.push('Datenlücke ' + d);
    });
    if (s.hautaetzend_1a === true && ctx.codes.indexOf('H314') >= 0 && gg < 4) {
      gg = 4; m.treiber = ['H314 Skin Corr. 1A'];
      ctx.kons(m, N, 'H314 Kat. 1A: H401-1 Tabelle HE gegen Z26 HD → HE (F1, O1)');
    }
    if (gg === 4 && m.treiber.length === 1 && m.treiber[0] === 'H362')
      ctx.kons(m, N, 'H362 gilt nur für Schwangere/Stillende (Z26 Fn. 5) – HE allgemein angesetzt');
    m.gruppe = ORD.haut[gg];
    ctx.v.ggHaut = gg;

    if (t.hautkontakt_ausgeschlossen === true) {
      m.stufe = 0;
      m.eingaben.bedarf = 'entfällt';
      pushU(m.hinweise, 'Hautkontakt technisch grundsätzlich ausgeschlossen – Schritte 5–7 entfallen; PSA zählt nicht als Ausschluss (LF22 S. 27).');
      return m;
    }
    var fl = t.wirkflaeche === 'klein' ? 0 : (t.wirkflaeche === 'gross' || t.wirkflaeche === 'groß' ? 1 : null);
    var wd = t.wirkdauer === 'kurz' ? 0 : (t.wirkdauer === 'lang' ? 1 : null);
    if (wd === null && num(t.wirkdauer_min_tag) !== null) {
      var min = num(t.wirkdauer_min_tag);
      wd = min < 15 ? 0 : 1;
      if (min === 15) ctx.kons(m, N, 'Wirkdauer genau 15 min/Tag → lang (F1, O4)');
    }
    if (fl === null) ctx.fehlt(m, 'taetigkeit.wirkflaeche');
    if (wd === null) ctx.fehlt(m, 'taetigkeit.wirkdauer');
    if (fl !== null) m.eingaben.wirkflaeche = fl ? 'groß' : 'klein';
    if (wd !== null) m.eingaben.wirkdauer = wd ? 'lang' : 'kurz';
    ctx.v.hautKleinKurz = fl === 0 && wd === 0;
    if (fl === null || wd === null) return m;

    var spalte = fl * 2 + wd;
    m.stufe = TAB_HAUT[m.gruppe][spalte];
    m.eingaben.bedarf = HAUT_BEDARF[m.stufe - 1];
    if ((m.gruppe === 'HD' && spalte === 3) || (m.gruppe === 'HE' && spalte === 0))
      ctx.kons(m, N, 'Fußnoten */** der Tab. 7.1 (nur für R-Sätze formuliert) nicht angewandt (F1, O2)');

    var L = new SlfListe();
    L.add('120', 'Hautkontakt möglich – Mindeststandards (LF22 S. 30)');
    if (m.stufe >= 2) {
      L.addV('2100', 'Haut „' + m.eingaben.bedarf + '" (LF22 S. 30–31; Nachfolger SLF 250 nicht amtlich, O10)');
      var ks = { haende: '2110', fuesse: '2111', rumpf: '2112', gesicht: '2200' }, stellen = t.koerperstellen || [];
      stellen.forEach(function (k) { if (ks[k]) L.addV(ks[k], 'PSA ' + k + ' (SLF 2100 Nr. 8)'); });
      if (!stellen.length) pushU(m.massnahmenHinweise, 'PSA nach Körperstelle wählen (SLF 2100 Nr. 8): Hände/Arme 2110 · Füße/Beine 2111 · Rumpf 2112 · Gesicht/Augen 2200 (taetigkeit.koerperstellen angeben).');
      if (ctx.codes.indexOf('H317') >= 0) L.addV('2121', 'H317 hautsensibilisierend (SLF 2100 Kopf)');
    } else if (ctx.codes.indexOf('H317') >= 0) {
      pushU(m.massnahmenHinweise, 'H317: SLF 2121 gehört zur Stufe 2 – bei Stufe 1 nicht verlangt.');
    }
    if (m.stufe === 3) {
      pushU(m.massnahmenHinweise, 'Hoher Maßnahmenbedarf: Substitution bevorzugt; prüfen, ob ein geschlossenes System (SLF 300) Hautkontakt vollständig ausschließt; sonst Schutzmaßnahmen eng mit dem Betriebsarzt (LF22 S. 31, R3.14).');
    }
    if (t.feuchtarbeit === true) {
      L.addV('2120', 'Feuchtarbeit (H401-2; R3.13) – unabhängig von Tab. 7.1');
      if (t.schutzhandschuhe === true) L.addV('2110', 'Feuchtarbeit mit flüssigkeitsdichten Handschuhen (SLF 2120 Kopf)');
      pushU(m.massnahmenHinweise, 'Feuchtarbeit: Pflichtvorsorge ab 4 h/Tag Kontakt, 25×/Tag Waschen bzw. im Wechsel mit Handschuhen 20×/10× (H401-2 S. 3; SLF 2120 S. 2).');
    } else if (t.feuchtarbeit === undefined) {
      pushU(m.hinweise, 'Feuchtarbeit nicht angegeben: > 2 h/Tag Kontakt mit Wasser oder > 15×/Tag Händewaschen prüfen (H401-2 S. 1–2).');
    }
    if (m.stufe >= 2 && t.feuchtarbeit !== true) pushU(m.massnahmenHinweise, 'Verzicht auf Handschuhe nur ausnahmsweise mit Betriebsarzt und Begründung (LF22 S. 31, R3.15).');
    m.schutzleitfaeden = L.liste;
    return m;
  }

  // ---------------------------------------------------------------- Modul AUGEN
  function modulAugen(ctx) {
    var m = neuesModul(), s = ctx.s, N = 'Augen';
    m.fundstellen.push('AU25 S. 3–6 (Tab. 2–6)', 'Z26 Spalte Augen', 'SLF 2200 / 2201');
    if (s.aggregat === 'gas') {
      pushU(m.hinweise, 'Gase: Tabelle des Moduls Augen gilt für Flüssigkeiten und Feststoffe (AU25 S. 3–5).');
      m.eingaben.ausserhalbEmkg = true;
      return m;
    }
    if (!ctx.saetzeBrauchbar(m)) return m;
    if (s.aggregat !== 'fluessig' && s.aggregat !== 'fest') ctx.fehlt(m, 'stoff.aggregat');
    var g = ctx.maxGruppe('augen', ORD.augen);
    m.gruppe = g.gruppe; m.treiber = g.treiber;
    var mg = ctx.mengengruppe(m), fr = ctx.freisetzung('einatmen');
    if (mg !== null) m.eingaben.mengengruppe = MG_BRAND[mg];
    fgUebernehmen(ctx, m, fr);
    if (mg === null || fr.index === null || m.fehlend.length) return m;

    var z = zelleWert(TAB_AUGEN[m.gruppe][mg][fr.index], s.aggregat), visier = hat(ctx.codes, ['H314', 'H315', 'H311+H314']).length > 0;
    var L = new SlfListe();
    ['100', '110', '120'].forEach(function (nr) { L.add(nr, 'Mindeststandards Reihe 100 (AU25 S. 5; Nummern nach F4, O14)'); });
    if (z === '1') {
      m.stufe = 1;
      if (visier) {
        pushU(m.massnahmenHinweise, 'H314/H315: Gesichtsvisier (Kennz. 3) zusammen mit Schutzbrille (SLF 2200 Nr. 5).');
        ctx.kons(m, N, 'Gesichtsvisier bei H314/H315 auch in Stufe 1 empfohlen (F1, O13)');
      }
    } else {
      m.stufe = 2;
      var kennz = fr.index === 2 ? '345' : '34';
      m.eingaben.brille = z === 'B' ? 'Bügelbrille mit Dichtlippe' : 'Korbbrille';
      m.eingaben.kennzeichnung = kennz;
      L.addV('2200', 'Augenschutz Stufe 2 (AU25 S. 5)');
      L.addV('2201', 'Augenspüleinrichtung Stufe 2 (AU25 S. 5)');
      pushU(m.massnahmenHinweise, 'Zuerst Arbeitsmittel gegen Augenkontakt (Abdeckung, Spritzschutz), dann PSA (SLF 2200 Nr. 1–2).');
      pushU(m.massnahmenHinweise, m.eingaben.brille + ', Kennzeichnung ' + kennz + ' nach DIN EN ISO 16321 bzw. DIN EN 166 (SLF 2200 Nr. 2' + (kennz === '345' ? '; bei FG hoch nur Korbbrille 345, AU25 S. 6' : '') + ').');
      if (z === 'B') pushU(m.massnahmenHinweise, 'Mit zusätzlicher Abdeckung/Sichtscheibe genügt eine Bügelbrille mit Seitenschutz ohne Kennzeichnung (SLF 2200 Nr. 2).');
      if (z === 'K' && fr.index < 2) pushU(m.massnahmenHinweise, 'Ersatz der Korbbrille bei fehlender Akzeptanz nur bei FG niedrig/mittel: Bügelbrille mit Dichtlippe 34 oder Bügelbrille + Visier (SLF 2200 Nr. 6).');
      if (visier) pushU(m.massnahmenHinweise, 'H314/H315: zusätzlich Gesichtsvisier Kennz. 3, immer mit Schutzbrille (SLF 2200 Nr. 5 „muss").');
      pushU(m.massnahmenHinweise, 'Augendusche ≤ 10 s erreichbar (Labor ≤ 5 s), Funktionsprüfung monatlich, mind. 10 min spülen (SLF 2201 Nr. 2–4).');
    }
    m.eingaben.gesichtsvisier = visier;
    pushU(m.hinweise, 'UV-Strahlung, Splitter/Späne sind nicht Gegenstand der Tabelle – gesondert beurteilen (AU25 S. 1).');
    m.schutzleitfaeden = L.liste;
    return m;
  }

  // ---------------------------------------------------------------- Modul BRAND & EXPLOSION
  function modulBrand(ctx) {
    var m = neuesModul(), s = ctx.s, t = ctx.t, N = 'Brand & Explosion', agg = s.aggregat;
    m.fundstellen.push('BE20 S. 20–40 (Tab. 4.1–4.12)', 'Z26 Spalten Brand & Explosion flüssig/fest');
    if (!ctx.saetzeBrauchbar(m)) return m;
    if (agg !== 'fluessig' && agg !== 'fest' && agg !== 'gas') { ctx.fehlt(m, 'stoff.aggregat'); return m; }
    var spalte = agg === 'fest' ? 'brand_fest' : 'brand_fluessig';
    var g = ctx.maxGruppe(spalte, ORD.brand), gg = g.index;
    m.treiber = g.treiber;
    var phys = ctx.codes.some(function (c) { return ORD.brand.indexOf(DATEN.saetze[c].brand_fluessig) >= 1; });
    // B2.2 Feststoffe ohne physikalische Einstufung (BE20 S. 24–25)
    if (agg === 'fest' && !phys) {
      if (s.staubexplosionsklasse) { gg = 2; m.treiber = ['Staubexplosionsklasse ' + s.staubexplosionsklasse + ' (BE20 S. 24)']; }
      else if (s.staub_nicht_explosionsfaehig === true) {
        var bz = num(s.brennzahl);
        if (s.nicht_brennbar === true) { gg = 0; m.treiber = ['nachweislich nicht brennbar (BE20 S. 24)']; }
        else if (bz !== null && bz >= 1 && bz <= 3) { gg = 0; m.treiber = ['Brennzahl ' + bz + ' (BE20 S. 25 Tab. 4.4)']; }
        else { gg = 1; m.treiber = [bz !== null ? 'Brennzahl ' + bz + ' (BE20 S. 25 Tab. 4.4)' : 'nicht explosionsfähig, Brennzahl unbekannt → pc-B (BE20 S. 25)']; }
      } else m.treiber = ['Feststoff ohne physikalische Einstufung → pc-C (BE20 S. 24; Z26 Spalte fest)'];
    }
    m.gruppe = ORD.brand[gg];
    ctx.v.ggBrandIndex = gg;
    m.eingaben.aggregat = agg;

    if (agg === 'gas') {
      if (gg >= 3) { m.stufe = 4; pushU(m.massnahmenHinweise, 'pc-D/pc-E: Expertenberatung Brand-/Explosionsschutz (BE20 S. 39–40).'); }
      else pushU(m.hinweise, 'Gase sind nicht Gegenstand des Moduls (BE20 S. 9–10; TRGS 407) – gesondert beurteilen.');
      m.eingaben.ausserhalbEmkg = gg < 3;
      return m;
    }

    // B0 Einstiegsprüfung (BE20 S. 20–22)
    var at = num(t.verarbeitungstemp_c), fp = num(s.flammpunkt_c), gruende = [];
    if (phys || hat(ctx.codes, EINSTIEG_BRAND_EUH).length || ctx.codes.some(function (c) { return /^H2\d\d$/.test(c); })) gruende.push('physikalische Einstufung');
    if (agg === 'fest') gruende.push('Feststoff (brennbarer Staub/Abrieb nicht ausgeschlossen, Fragen 3–5)');
    if (t.versprueht === true) gruende.push('Versprühen/Aerosol (Frage 6)');
    if (agg === 'fluessig' && !phys) {
      if (fp === null) { gruende.push('Flammpunkt unbekannt'); ctx.kons(m, N, 'Flammpunkt nicht angegeben → Modul durchlaufen (Einstieg Frage 2)'); }
      else if (at !== null) {
        var kw = s.kohlenwasserstoff, marge = kw === 'rein' ? 5 : (kw === 'gemisch' ? 15 : (kw === false ? 0 : 15));
        if (kw === undefined && at > fp - 15 && at <= fp) ctx.kons(m, N, 'Kohlenwasserstoff-Eigenschaft unbekannt → 15-K-Abstand zum Flammpunkt angesetzt (BE20 S. 21–22, Fragen 9/10)');
        if (at > fp - marge) gruende.push('Anwendungstemperatur zu nah am/über Flammpunkt (Fragen 2/9/10)');
      }
    }
    m.eingaben.einstieg = gruende;
    if (!gruende.length && at !== null) {
      m.stufe = 1;
      pushU(m.hinweise, 'Einstiegsprüfung: keine Frage mit JA → Mindeststandards Reihe 100 genügen (BE20 S. 20–22).');
      var L0 = new SlfListe();
      ['100', 'La-101', '110', 'pc-170'].forEach(function (nr) { L0.add(nr, 'Mindeststandards (BE20 S. 33 Tab. 4.11)'); });
      m.schutzleitfaeden = L0.liste;
      ctx.v.stufeBrand = 1;
      return m;
    }

    var mg = ctx.mengengruppe(m), fr = ctx.freisetzung('brand');
    if (mg !== null) m.eingaben.mengengruppe = MG_BRAND[mg];
    fgUebernehmen(ctx, m, fr);
    if (gg >= 3) {
      m.stufe = 4;
      pushU(m.massnahmenHinweise, 'pc-D/pc-E (z. B. wasserreaktiv, Oxidationsmittel, explosiv): immer Expertenberatung; pc-E = Sprengstoffgesetz (BE20 S. 39–40).');
      ctx.v.stufeBrand = 4;
      return m;
    }
    if (mg === null || fr.index === null || m.fehlend.length) return m;

    var z = zelleWert(TAB_BRAND[m.gruppe][mg][fr.index], agg), stern = z.indexOf('*') > 0, stufe = parseInt(z, 10);
    m.eingaben.tabellenzelle = z;
    if (stufe === 3 && stern && agg === 'fest') ctx.kons(m, N, 'Zelle 300* bei Feststoff: Bedeutung der Fußnote offen (O5) → volle Stufe 3');
    if (t.feuerarbeiten_dauerhaft === true && stufe < 2) { stufe = 2; pushU(m.hinweise, 'Ständige Feuerarbeiten/Schweißplätze: Brandschutz mind. Stufe 2 (BE20 S. 37).'); }
    var lw = t.luftwechsel_gering === true || t.raumlueftung === 'gering' || t.raumlueftung === 'keine';
    if (lw) {
      m.eingaben.luftwechsel = 'gering';
      if (stufe === 3) { stufe = 4; ctx.kons(m, N, 'geringer Luftwechsel bei Stufe 3: keine Regel (O6) → Beratung'); }
      else stufe += 1;
      stern = false;
      pushU(m.hinweise, 'Geringer/kein Luftwechsel → nächsthöhere Stufe (BE20 S. 31).');
    }
    m.stufe = stufe;
    ctx.v.stufeBrand = stufe;

    var L = new SlfListe();
    ['100', 'La-101', '110', 'pc-170'].forEach(function (nr) { L.add(nr, 'Mindeststandards, gesamter Arbeitsbereich (BE20 S. 33 Tab. 4.11)'); });
    if (stufe === 1 && agg === 'fest' && fr.index >= 1 && mg >= 1) {
      L.addV('2502', 'Feststoff, FG ≥ mittel, ab kg-Bereich (früher SLF 240, BE20 S. 33)');
      ctx.kons(m, N, 'Staubarbeitsplatz bei Stufe 1 über SLF 2502 abgedeckt – Ablösung von SLF 240 nicht amtlich (O2 Teil II)');
    }
    if (stufe >= 2 && stufe <= 3) {
      L.addV('2000', 'Maßnahmenstufe 2'); L.addV('2500', 'Emissionsminderung (BE20 S. 34)');
      L.addV('2600', 'erweiterter Brandschutz (BE20 S. 34; Nachfolger pc-270 nicht amtlich, O1 Teil II)');
      var exFrei = agg === 'fest' && stern && s.staub_nicht_explosionsfaehig === true;
      if (!exFrei) {
        L.addV('2603', 'vorbeugender Explosionsschutz (BE20 S. 35; Nachfolger pc-280 nicht amtlich, O1 Teil II)');
        L.addV('2602', 'Zündquellenvermeidung (BE20 S. 35)');
      } else pushU(m.hinweise, 'Feststoff nachweislich nicht explosionsfähig, Zelle mit *: Brandschutz der Stufe 2 genügt (BE20 S. 31).');
      ctx.taetigkeitsSlf(L, m, 2, N);
      pushU(m.massnahmenHinweise, 'Weitere Ex-Maßnahmen entbehrlich nur, wenn keine explosionsfähige Atmosphäre entsteht, bei Lüftungsausfall die Tätigkeit eingestellt und Freisetzung verhindert wird (BE20 S. 35).');
      pushU(m.massnahmenHinweise, 'Substitution prüfen (BE20 S. 34).');
    }
    if (stufe === 3) {
      ctx.kons(m, N, 'Stufe 3: Leitfäden der Stufe 2 zusätzlich ausgegeben (Stufen bauen aufeinander auf)');
      L.add('pc-370', 'hohe Brandschutzmaßnahmen, geschlossenes System (BE20 S. 38)');
      L.add('300', 'geschlossenes System (BE20 S. 38)');
      ctx.taetigkeitsSlf(L, m, 3, N);
      pushU(m.massnahmenHinweise, 'Konstruktiver Explosionsschutz: kein SLF vorhanden, i. d. R. externe Beratung; Inertisierung nach TRGS 722 bevorzugt (BE20 S. 38–39).');
    }
    if (stufe === 4) pushU(m.massnahmenHinweise, 'Beratung durch Brand-/Explosionsschutz-Fachleute (BE20 S. 39–40).');
    pushU(m.massnahmenHinweise, 'Instandsetzung/Wartung immer mit Freigabeverfahren (BE20 S. 31; SLF 2603 Nr. 4).');
    if (hat(ctx.codes, CHEM_REAKTION).length) pushU(m.hinweise, 'Chemische Reaktion als Zündquelle prüfen: ' + hat(ctx.codes, CHEM_REAKTION).join(', ') + ' (BE20 S. 48; SLF 2602 Nr. 6).');
    if (ctx.codes.indexOf('H314') >= 0) pushU(m.hinweise, 'H314 wird im Modul nicht bewertet, kann aber als Zündquelle (chemische Reaktion) wirken (BE20 S. 18–19).');
    if (phys && fp !== null && at !== null && at > fp) pushU(m.hinweise, 'Eingestufte Flüssigkeit über dem Flammpunkt verarbeitet: eine GG-Erhöhung regelt das EMKG nicht (Regelwerk Teil II O8) – fachlich prüfen.');
    m.schutzleitfaeden = L.liste;
    return m;
  }

  // ---------------------------------------------------------------- Modul LAGERN
  function modulLagern(ctx) {
    var m = neuesModul(), t = ctx.t, s = ctx.s, N = 'Lagern', codes = ctx.codes;
    m.fundstellen.push('Z26 Spalte Lagern + Fn. 4', 'XLS Zeile 5 (Stufenformeln)', 'ANL S. 1–3', 'SLF La-101, 2700, 2714');
    if (!ctx.saetzeBrauchbar(m)) return m;
    var g = ctx.maxGruppe('lagern', ORD.lagern), gg = g.index, regel = DATEN.regeln.lagern_gas_akut_toxisch;
    m.treiber = g.treiber;
    var gas = hat(codes, regel.eines_von), tox = hat(codes, regel.zusammen_mit);
    if (gas.length && tox.length) { gg = ORD.lagern.indexOf(regel.gruppe); m.treiber = [gas.concat(tox).join(' + ') + ' (' + regel.fundstelle + ')']; }
    m.gruppe = ORD.lagern[gg];
    var laGruppen = {};
    codes.forEach(function (c) { laGruppen[DATEN.saetze[c].lagern] = 1; });
    if (Object.keys(laGruppen).length > 1) ctx.kons(m, N, 'mehrere La-Gruppen → höchste angesetzt (F1, Teil III O1)');

    var mk = num(t.lagermenge_kg);
    m.eingaben.lagermenge_kg = mk;
    m.eingaben.lagermengeBezug = 'Summe aller Produkte dieser La-Gruppe auf der Lagerfläche (Gebäude, Brandabschnitt oder Nutzungseinheit; ANL S. 1)';
    if (s.lagerklasse) m.eingaben.lagerklasse = s.lagerklasse;
    var stufe = null;
    if (m.gruppe === 'La-E') stufe = 3;
    else if (m.gruppe === 'La-F') stufe = 4;
    else if (mk === null) ctx.fehlt(m, 'taetigkeit.lagermenge_kg');
    else if (mk <= 0) pushU(m.hinweise, 'Lagermenge 0 kg – keine Stufe (XLS liefert hier Scheinwerte).');
    else if (m.gruppe === 'La-A') {
      stufe = mk < 200 ? 1 : 3;
      if (mk === 200) ctx.kons(m, N, 'La-A genau 200 kg: Formel ≥ 200 → M3, Kommentar „max. 200 kg" → M3 (F1, W2)');
    } else if (m.gruppe === 'La-B') stufe = mk <= 50 ? 1 : (mk <= 1000 ? 2 : 3);
    else if (m.gruppe === 'La-C') stufe = mk <= 50 ? 1 : (mk <= 200 ? 2 : 3);
    else if (m.gruppe === 'La-D') {
      stufe = mk <= 200 ? 2 : 3;
      if (mk > 200 && mk <= 1000) ctx.kons(m, N, 'La-D: M2-Grenze 200 kg (Kommentar/TRGS 510) statt 1000 kg (Formel) → M3 (F1, W1)');
    }
    m.stufe = stufe;
    if (stufe !== null) m.eingaben.bezeichnung = 'M' + stufe;
    m.eingaben.obergrenzen = {
      'La-A': 'M1 ≤ 200 kg · M3 unbegrenzt', 'La-B': 'M1 ≤ 50 kg · M2 ≤ 1000 kg · M3 unbegrenzt',
      'La-C': 'M1 ≤ 50 kg · M2 ≤ 200 kg · M3 unbegrenzt', 'La-D': 'kein M1 · M2 ≤ 200 kg (F1) · M3 unbegrenzt',
      'La-E': 'nur M3', 'La-F': 'nur M4 (außerhalb EMKG)'
    }[m.gruppe];
    if (stufe === null) return m;

    var L = new SlfListe();
    ['La-101', '100', '110', '120', 'pc-170'].forEach(function (nr) { L.add(nr, 'jede Lagerung – Mindeststandards (La-101 S. 2)'); });
    if (stufe === 2 || stufe === 3) {
      L.addV('2700', 'Lagerung im Lager (Maßnahmenstufe 2)');
      L.addV('2714', 'Notfallplan/Leckagen (SLF 2700 Nr. 7)');
      if (stufe === 3) ctx.kons(m, N, 'M3: SLF 2700/2714 auch für das besondere Lager ausgegeben (Teil III O6)');
    }
    if (stufe === 3) pushU(m.massnahmenHinweise, 'M3 „besonderes Lager" (z. B. zusätzliche Brandschutzmaßnahmen): kein EMKG-Schutzleitfaden – TRGS 510 Abschn. 6–12 heranziehen (ANL S. 2; Teil III O6).');
    if (stufe === 4) pushU(m.massnahmenHinweise, 'M4: Maßnahmen über das EMKG hinaus – TRGS 510; Explosivstoffe nach 2. SprengV (ANL S. 2; La-101 Fn.).');
    if (stufe === 1) pushU(m.massnahmenHinweise, 'Außerhalb von Lagern insgesamt höchstens 1500 kg Gefahrstoffe (XLS I6; La-101 S. 1); Kleinmengenregel La-101 kann Ausnahmen erlauben (ANL S. 3).');
    if (mk !== null && mk >= 200) {
      pushU(m.massnahmenHinweise, 'Zusammenlagerung prüfen (Matrix SLF 2700 Nr. 6 → 2710/2711/2712), Schwelle 200 kg je Lagerklasse bzw. 400 kg gesamt.');
      ctx.kons(m, N, 'Zusammenlagerungsregeln ab 200 kg (F1, W3)');
    }
    if (!s.lagerklasse) pushU(m.hinweise, 'Lagerklasse fehlt (SDB Abschn. 7) – für die Zusammenlagerung nötig.');
    if (hat(codes, REAKTIV_LAGERN).length) pushU(m.massnahmenHinweise, 'Gefährliche Reaktionen bei Zusammenlagerung möglich (' + hat(codes, REAKTIV_LAGERN).join(', ') + ') → getrennte Aufbewahrung prüfen (SLF 2710 Nr. 1).');
    if (hat(codes, ENTZUENDBAR_FL).length) pushU(m.massnahmenHinweise, 'Entzündbare Flüssigkeiten außerhalb des Lagers nur in Behältern ≤ 10 l (unzerbrechlich), ≤ 2,5 l (zerbrechlich), ≤ 20 l (Gefahrgut-zugelassen) (La-101 S. 1).');
    if (hat(codes, VERSCHLUSS_LA101).length) pushU(m.massnahmenHinweise, 'Unter Verschluss, Zugang nur fachkundige Personen (La-101 S. 2): ' + hat(codes, VERSCHLUSS_LA101).join(', ') + '.');
    m.schutzleitfaeden = L.liste;
    return m;
  }

  // ---------------------------------------------------------------- geringe Gefährdung (GG20, R3.16)
  function geringeGefaehrdung(ctx, mod) {
    var v = ctx.v, s = ctx.s, t = ctx.t, gruende = [], offen = [];
    if (v.ggEinatmen === undefined) offen.push('Gefährlichkeitsgruppe Einatmen');
    if (v.ggHaut === undefined) offen.push('Gefährlichkeitsgruppe Haut');
    if (v.ggBrandIndex === undefined) offen.push('Gefährlichkeitsgruppe Brand & Explosion');
    if (v.mg === undefined) offen.push('Menge');
    if (v.fg === undefined) offen.push('Freisetzungsgruppe');
    if (v.ggEinatmen !== undefined && v.ggEinatmen > 2) gruende.push('GG Einatmen ' + ORD.einatmen[v.ggEinatmen] + ' > C');
    if (v.ggHaut !== undefined && v.ggHaut > 2) gruende.push('GG Haut ' + ORD.haut[v.ggHaut] + ' > HC');
    if (v.ggBrandIndex !== undefined && v.ggBrandIndex > 2) gruende.push('GG Brand ' + ORD.brand[v.ggBrandIndex] + ' > pc-C');
    if (v.mg !== undefined && v.mg > 0) gruende.push('Menge ≥ 1 kg bzw. 1 l');
    if (v.fg !== undefined) {
      if (v.fg === 2) gruende.push('Freisetzungsgruppe hoch');
      else if (v.ggEinatmen === 2 && v.fg > 0) gruende.push('GG C nur mit Freisetzung niedrig');
    }
    if (t.hautkontakt_ausgeschlossen !== true) {
      if (mod.haut.stufe === null && mod.haut.gruppe) offen.push('Wirkfläche/Wirkdauer');
      else if (mod.haut.stufe !== null && !v.hautKleinKurz) gruende.push('Hautkontakt nicht kleinflächig und kurz');
      if (ctx.codes.indexOf('H314') >= 0) gruende.push('Hautkontakt mit ätzendem Stoff möglich');
    }
    if (t.enge_raeume === true) gruende.push('enge Räume/Behälter');
    if (s.aggregat === 'gas') gruende.push('Gas – außerhalb EMKG Einatmen/Haut');
    var erfuellt = gruende.length ? false : (offen.length ? null : true);
    return {
      erfuellt: erfuellt, gruende: gruende, offen: offen,
      fundstelle: 'GG20 S. 1–2 Tab. 1/2; LF22 S. 14–15',
      hinweis: erfuellt ? 'Voraussetzung zusätzlich: keine technischen/persönlichen Schutzmaßnahmen nötig, keine engen Räume. Dann keine Substitutionsprüfung, keine Betriebsanweisung, kein Eintrag ins Gefahrstoffverzeichnis (GG20 S. 2). Stufe 1 bleibt Empfehlung.'
        : 'Maßnahmenstufe 1 ist nicht „geringe Gefährdung", sondern die nächste Stufe (GG20 S. 1).'
    };
  }

  // ---------------------------------------------------------------- Einstieg
  function bewerten(stoff, taetigkeit) {
    if (!DATEN) throw new Error('EMKG: Datenblock fehlt – python tools/emkg_kern_bauen.py ausführen');
    var ctx = new Kontext(stoff, taetigkeit);
    // Brand zuerst: die 24xx-Bedingungen „brennbar"/„Staub-Ex" im Modul Einatmen brauchen dessen Werte
    var brand = modulBrand(ctx);
    var mod = { einatmen: modulEinatmen(ctx), haut: null, augen: null, brand: brand, lagern: null };
    mod.haut = modulHaut(ctx);
    mod.augen = modulAugen(ctx);
    mod.lagern = modulLagern(ctx);

    var ms = DATEN.mutterschutz, msSaetze = ctx.codes.filter(function (c) { return ms.indexOf(c) >= 0; });
    if (msSaetze.length) pushU(ctx.hinweise, 'Mutterschutz zusätzlich beachten (Z26 S. 6): ' + msSaetze.join(', ') + '.');
    if (ctx.codes.indexOf('H362') >= 0) pushU(ctx.hinweise, DATEN.regeln.h362_nur_schwangere_stillende.text + ' (Z26 Fn. 5)');
    var vs = hat(ctx.codes, VERSCHLUSS_LA101), cmr = hat(ctx.codes, CMR_SENS_LF22);
    if (vs.length || cmr.length) {
      pushU(ctx.hinweise, 'Unter Verschluss aufbewahren, Zugang nur fachkundige Personen, besondere Unterweisung (La-101 S. 2; LF22 S. 23, R3.7): ' + vs.concat(cmr.filter(function (c) { return vs.indexOf(c) < 0; })).join(', ') + '.');
      if (cmr.some(function (c) { return vs.indexOf(c) < 0; })) pushU(ctx.konservativ, 'Allgemein: Verschluss/besondere Unterweisung auch für CMR 1/2 und atemwegssensibilisierende Stoffe (LF22 S. 23 neben La-101, W7) – konservativ angesetzt');
    }
    var stufeMax = Math.max(mod.einatmen.stufe || 0, mod.haut.stufe || 0, mod.brand.stufe || 0);
    if (stufeMax >= 2 || cmr.some(function (c) { return /^H3[456]/.test(c) && c !== 'H334'; }))
      pushU(ctx.hinweise, 'Substitutionsprüfung (TRGS 600) durchführen und begründen, warum nicht substituiert wird (LF22 S. 14, R0.4).');
    pushU(ctx.hinweise, 'Vorrang stoff-/tätigkeitsspezifischer TRGS bzw. VSK nach TRGS 420 prüfen; Abweichung begründen (LF22 S. 8, R0.2).');
    if (stoff && stoff.verduennung) pushU(ctx.hinweise, 'Mit Wasser verdünnt: Einstufung der Gebrauchslösung vorab nach „Wasserverdünnte Gefahrstoffe" Tab. 1 bestimmen und als h_saetze übergeben (R2.10) – der Kern rechnet mit den übergebenen Sätzen.');

    return {
      version: VERSION,
      module: mod,
      geringeGefaehrdung: geringeGefaehrdung(ctx, mod),
      mutterschutz: msSaetze.length > 0,
      mutterschutzSaetze: msSaetze,
      hinweise: ctx.hinweise,
      konservativ: ctx.konservativ,
      fehlend: ctx.fehlend
    };
  }
  var EMKG = {
    version: VERSION,
    bewerten: bewerten,
    daten: DATEN,
    slf: function (nr) { return DATEN && DATEN.slf[String(nr)] || null; },
    taetigkeitsarten: Object.keys(TAETIGKEIT),
    // für Tests/Prüfung: alle im Code referenzierten Leitfäden
    _referenzierteSlf: function () {
      var set = {};
      ['100', '110', '120', 'La-101', 'pc-170', 'pc-370', '300', '2000', '2100', '2110', '2111', '2112', '2120', '2121',
        '2200', '2201', '2500', '2501', '2502', '2600', '2601', '2602', '2603', '2700', '2714'].forEach(function (n) { set[n] = 1; });
      Object.keys(VOR).forEach(function (k) { set[k] = 1; VOR[k].forEach(function (n) { set[n] = 1; }); });
      Object.keys(VOR_24).forEach(function (k) { set[k] = 1; VOR_24[k].forEach(function (r) { r.slice(1).forEach(function (n) { set[n] = 1; }); }); });
      Object.keys(TAETIGKEIT).forEach(function (k) {
        var a = TAETIGKEIT[k];
        if (a.s2) set[a.s2] = 1;
        if (a.s3) { if (typeof a.s3 === 'object') { set[a.s3.fl] = 1; set[a.s3.fest] = 1; } else set[a.s3] = 1; }
      });
      return Object.keys(set);
    }
  };

  if (typeof module === 'object' && module && module.exports) module.exports = EMKG;
  if (typeof window !== 'undefined') window.EMKG = EMKG;
})();

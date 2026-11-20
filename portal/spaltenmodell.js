/* GHS-Spaltenmodell (IFA/DGUV, Stand 2020) für die Substitutionsprüfung nach TRGS 600 – EINE Quelle für
   Cockpit V2 (as-gefahrstoffe.js), Website-Demo (gefahrstoffkataster-beispiel.html) und Substitutions-Checker.
   Einstufung je Spalte: 5 = sehr hoch · 4 = hoch · 3 = mittel · 2 = gering · 1 = vernachlässigbar.
   g = Gesundheit · u = Umwelt · p = Brand/Explosion. Zuordnung übernommen aus tools.entwurf/OAK_Substitutions-Checker.html
   (vor Freigabe gegen das IFA-Original abgleichen). Eigener Scope: nach außen nur window.OAK_SPALTEN. */
(function(){
  "use strict";
  var HP = {
    // --- Gesundheit ---
    H300:{t:"Lebensgefahr bei Verschlucken",g:5}, H301:{t:"Giftig bei Verschlucken",g:4}, H302:{t:"Gesundheitsschädlich bei Verschlucken",g:3}, H303:{t:"Kann bei Verschlucken schädlich sein",g:2},
    H304:{t:"Kann bei Verschlucken in die Atemwege tödlich sein",g:5}, H305:{t:"Kann bei Verschlucken in die Atemwege schädlich sein",g:3},
    H310:{t:"Lebensgefahr bei Hautkontakt",g:5}, H311:{t:"Giftig bei Hautkontakt",g:4}, H312:{t:"Gesundheitsschädlich bei Hautkontakt",g:3}, H313:{t:"Kann bei Hautkontakt gesundheitsschädlich sein",g:2},
    H314:{t:"Verursacht schwere Verätzungen der Haut und Augenschäden",g:4}, H315:{t:"Verursacht Hautreizungen",g:3}, H316:{t:"Verursacht milde Hautreizung",g:2}, H317:{t:"Kann allergische Hautreaktionen verursachen",g:3},
    H318:{t:"Verursacht schwere Augenschäden",g:4}, H319:{t:"Verursacht schwere Augenreizung",g:3}, H320:{t:"Verursacht Augenreizung",g:2},
    H330:{t:"Lebensgefahr bei Einatmen",g:5}, H331:{t:"Giftig bei Einatmen",g:4}, H332:{t:"Gesundheitsschädlich bei Einatmen",g:3}, H333:{t:"Kann bei Einatmen schädlich sein",g:2},
    H334:{t:"Kann bei Einatmen Allergie, asthmaartige Symptome/Atembeschwerden verursachen",g:4}, H335:{t:"Kann die Atemwege reizen",g:3}, H336:{t:"Kann Schläfrigkeit und Benommenheit verursachen",g:3},
    H340:{t:"Kann genetische Defekte verursachen",g:5}, H341:{t:"Kann vermutlich genetische Defekte verursachen",g:4},
    H350:{t:"Kann Krebs erzeugen",g:5}, "H350i":{t:"Kann bei Einatmen Krebs erzeugen",g:5}, H351:{t:"Kann vermutlich Krebs erzeugen",g:4},
    H360:{t:"Kann die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen",g:5}, H361:{t:"Kann vermutlich die Fruchtbarkeit/das Kind schädigen",g:4}, H362:{t:"Kann Säuglinge über die Muttermilch schädigen",g:3},
    H370:{t:"Schädigt die Organe",g:5}, H371:{t:"Kann die Organe schädigen",g:4}, H372:{t:"Schädigt die Organe bei längerer/wiederholter Exposition",g:5}, H373:{t:"Kann die Organe bei längerer/wiederholter Exposition schädigen",g:4},
    EUH070:{t:"Giftig bei Berührung mit den Augen",g:5}, EUH071:{t:"Wirkt ätzend auf die Atemwege",g:4}, EUH066:{t:"Wiederholter Kontakt kann zu spröder oder rissiger Haut führen",g:2},
    EUH029:{t:"Entwickelt bei Berührung mit Wasser giftige Gase",g:4}, EUH031:{t:"Entwickelt bei Berührung mit Säure giftige Gase",g:3}, EUH032:{t:"Entwickelt bei Berührung mit Säure sehr giftige Gase",g:4},
    // --- Umwelt ---
    H400:{t:"Sehr giftig für Wasserorganismen",u:4}, H410:{t:"Sehr giftig für Wasserorganismen, mit langfristiger Wirkung",u:5}, H411:{t:"Giftig für Wasserorganismen, mit langfristiger Wirkung",u:4},
    H412:{t:"Schädlich für Wasserorganismen, mit langfristiger Wirkung",u:3}, H413:{t:"Kann für Wasserorganismen schädlich sein, mit langfristiger Wirkung",u:2},
    H420:{t:"Schädigt die öffentliche Gesundheit und die Umwelt durch Ozonabbau",u:4}, EUH059:{t:"Die Ozonschicht schädigend",u:4},
    // --- Physikalisch (Brand/Explosion) ---
    H200:{t:"Instabil, explosiv",p:5}, H201:{t:"Explosiv, Gefahr der Massenexplosion",p:5}, H202:{t:"Explosiv; große Gefahr durch Splitter, Spreng-/Wurfstücke",p:5}, H203:{t:"Explosiv; Gefahr durch Feuer, Luftdruck oder Splitter",p:5}, H204:{t:"Gefahr durch Feuer oder Splitter",p:4}, H205:{t:"Gefahr der Massenexplosion bei Feuer",p:5},
    H220:{t:"Extrem entzündbares Gas",p:5}, H221:{t:"Entzündbares Gas",p:4}, H222:{t:"Extrem entzündbares Aerosol",p:5}, H223:{t:"Entzündbares Aerosol",p:4}, H224:{t:"Flüssigkeit und Dampf extrem entzündbar",p:5}, H225:{t:"Flüssigkeit und Dampf leicht entzündbar",p:4}, H226:{t:"Flüssigkeit und Dampf entzündbar",p:3}, H228:{t:"Entzündbarer Feststoff",p:4}, H229:{t:"Behälter steht unter Druck: kann bei Erwärmung bersten",p:3},
    H230:{t:"Kann auch in Abwesenheit von Luft explosionsartig reagieren",p:5}, H231:{t:"Kann auch in Abwesenheit von Luft bei erhöhtem Druck/Temperatur explosionsartig reagieren",p:5},
    H240:{t:"Erwärmung kann Explosion verursachen",p:5}, H241:{t:"Erwärmung kann Brand oder Explosion verursachen",p:5}, H242:{t:"Erwärmung kann Brand verursachen",p:4},
    H250:{t:"Entzündet sich in Berührung mit Luft von selbst",p:5}, H251:{t:"Selbsterhitzungsfähig; kann in Brand geraten",p:4}, H252:{t:"In großen Mengen selbsterhitzungsfähig; kann in Brand geraten",p:4},
    H260:{t:"In Berührung mit Wasser entzündbare Gase, die sich spontan entzünden können",p:5}, H261:{t:"In Berührung mit Wasser entzündbare Gase",p:4},
    H270:{t:"Kann Brand verursachen oder verstärken; Oxidationsmittel",p:5}, H271:{t:"Kann Brand oder Explosion verursachen; starkes Oxidationsmittel",p:5}, H272:{t:"Kann Brand verstärken; Oxidationsmittel",p:4},
    H280:{t:"Enthält Gas unter Druck; kann bei Erwärmung explodieren",p:2}, H281:{t:"Enthält tiefkaltes Gas; kann Kälteverbrennungen verursachen",p:2},
    EUH001:{t:"In trockenem Zustand explosiv",p:5}, EUH014:{t:"Reagiert heftig mit Wasser",p:4}, EUH018:{t:"Kann bei Verwendung explosionsfähiges Dampf/Luft-Gemisch bilden",p:3}, EUH019:{t:"Kann explosionsfähige Peroxide bilden",p:4}, EUH044:{t:"Explosionsgefahr bei Erhitzen unter Einschluss",p:4}
  };
  var NAMEN = { 5: "sehr hoch", 4: "hoch", 3: "mittel", 2: "gering", 1: "vernachlässigbar" };
  /* Besonders gefährliche Eigenschaften: Substitution vorrangig prüfen (§ 7 Abs. 3 GefStoffV, TRGS 600) */
  var VORRANG = ["H300","H301","H310","H311","H330","H331","H340","H341","H350","H350i","H351","H360","H361","H370","H371"];
  function saetze(text){ return (String(text || "").toUpperCase().match(/EUH\d{3}|H\d{3}I?/g) || []); }
  function bewerten(hs){ var r = { g: 1, u: 1, p: 1 };
    (hs || []).forEach(function(h){ var e = HP[String(h).toUpperCase()] || HP[h]; if(!e) return;
      ["g","u","p"].forEach(function(k){ if(e[k] && e[k] > r[k]) r[k] = e[k]; }); });
    return r; }
  function vorrangig(hs){ return (hs || []).filter(function(h){ return VORRANG.indexOf(String(h)) >= 0; }); }
  window.OAK_SPALTEN = { HP: HP, NAMEN: NAMEN, saetze: saetze, bewerten: bewerten, vorrangig: vorrangig,
    spalten: [["g", "Gesundheit"], ["u", "Umwelt"], ["p", "Brand/Explosion"]] };
})();

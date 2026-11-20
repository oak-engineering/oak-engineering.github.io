/* GESTIS-Spaltenmodell 2025 (IFA, „Auf Basis von GHS/CLP“, Ausgabe 2025, berücksichtigt Delegierte VO (EU) 2023/707)
   für die Substitutionsprüfung nach § 6 Abs. 1 Nr. 4 GefStoffV / TRGS 600 – EINE Quelle für Cockpit V2 (as-gefahrstoffe.js)
   und Website-Demo (gefahrstoffkataster-beispiel.html). Quelle: https://publikationen.dguv.de/widgets/pdf/download/article/3736
   (abgeglichen 20.11.2026). Spalten 2a, 2b, 3, 4 des Modells; Freisetzungsverhalten (5) und Verfahren (6) hängen nicht am
   H-Satz und werden hier nicht bewertet. Stufen: 5 sehr hoch · 4 hoch · 3 mittel · 2 gering · 1 vernachlässigbar.
   Kommt ein H-Satz im Modell in mehreren Stufen vor (Kategorie nicht am Satz erkennbar, z. B. H314, H228, H242), gilt die
   höhere Stufe (konservativ). WGK 1–3 und nwg (Spalte Umwelt) sind keine H-Sätze und bleiben hier außen vor.
   Eigener Scope: nach außen nur window.OAK_SPALTEN. */
(function(){
  "use strict";
  // a = akute Gesundheitsgefahren (2a) · c = chronische Gesundheitsgefahren (2b) · u = Umweltgefahren (3) · p = Brand/Explosion u. a. (4)
  var T = {
    a: { 5: ["H300","H310","H330","EUH032"],
         4: ["H301","H311","H331","EUH070","EUH029","EUH031","H370","H317","H334","H314"],
         3: ["H302","H312","H332","H371","H318","EUH071"],
         2: ["H315","H319","H304","EUH066","H335","H336"] },
    c: { 5: ["H350","H350i","H340"],
         4: ["H360","H360F","H360D","H360FD","H360Fd","H360Df","H351","H341","H372","EUH380"],
         3: ["H361","H361f","H361d","H361fd","H373","H362","EUH381"] },
    u: { 5: ["H400","H410","EUH441","EUH451"],
         4: ["H411","H420","EUH430","EUH440","EUH450"],
         3: ["H412","EUH431"],
         2: ["H413"] },
    p: { 5: ["H200","H201","H202","H203","H204","H205","H220","H221","H230","H231","H232","H224","H240","H241","H250","H260","H271"],
         4: ["H222","H225","H228","H242","H251","H261","H270","H272","H206","H207","EUH001","EUH014","EUH018","EUH019","EUH044"],
         3: ["H223","H226","H252","H280","H281","H290","H208"],
         2: ["H229"] }
  };
  var HP = {};
  Object.keys(T).forEach(function(k){ Object.keys(T[k]).forEach(function(st){ T[k][st].forEach(function(h){
    HP[h] = HP[h] || {}; HP[h][k] = Math.max(HP[h][k] || 0, +st); }); }); });
  var NAMEN = { 5: "sehr hoch", 4: "hoch", 3: "mittel", 2: "gering", 1: "vernachlässigbar" };
  /* Besonders gefährliche Eigenschaften: Substitution vorrangig prüfen (§ 7 Abs. 3 GefStoffV, TRGS 600) */
  var VORRANG = ["H300","H301","H310","H311","H330","H331","H340","H341","H350","H350i","H351","H360","H360F","H360D","H360FD","H360Fd","H360Df","H361","H361f","H361d","H361fd","H370","H371"];
  function saetze(text){ return (String(text || "").toUpperCase().replace(/H350I/g, "H350i").match(/EUH\d{3}|H\d{3}(?:i|[FD]{1,2}[fd]?|[fd]{1,2})?/g) || []); }
  function bewerten(hs){ var r = { a: 1, c: 1, u: 1, p: 1 };
    (hs || []).forEach(function(h){ var e = HP[String(h)] || HP[String(h).slice(0, 4)]; if(!e) return;
      Object.keys(e).forEach(function(k){ if(e[k] > r[k]) r[k] = e[k]; }); });
    return r; }
  function vorrangig(hs){ return (hs || []).filter(function(h){ return VORRANG.indexOf(String(h)) >= 0; }); }
  window.OAK_SPALTEN = { HP: HP, NAMEN: NAMEN, saetze: saetze, bewerten: bewerten, vorrangig: vorrangig, stand: "GESTIS-Spaltenmodell 2025 (IFA)",
    spalten: [["a", "Akut"], ["c", "Chronisch"], ["u", "Umwelt"], ["p", "Brand/Explosion"]] };
})();

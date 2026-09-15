/* OAK Unterweisungen – ein Modul im Browser aus Datenbank-Bloecken zusammensetzen.

   Dieselbe Zusammensetzung wie einzeldatei() in tools/unterweisung_export.py, nur in JS:
   Player-Vorlage + erster Block als Daten + gemeinsamer Bildvorrat + Schale (Tafel, Kapitelwechsel,
   Nachweis) + Transport (Nachweis-RPC). Genutzt vom Portal-Editor (mit Stift) und vom
   Online-Terminal (ohne Stift). Die Bausteine liegen als statische Dateien neben dieser Datei
   (erzeugt von tools/uw_portal_bauen.py). */
(function(){
"use strict";
var teile = null;

function json(o){ return JSON.stringify(o).replace(/<\//g, '<\\/'); }

async function laden(basis){
  if(teile) return teile;
  basis = basis || 'uw/';
  var namen = ['player.html', 'schale.js', 'schale.css', 'transport.js', 'nurlesen.js'];
  var texte = await Promise.all(namen.map(function(n){
    return fetch(basis + n + '?v=' + (window.OAKUW_VERSION || 'dev'), {cache:'no-cache'}).then(function(r){
      if(!r.ok) throw new Error(n + ' nicht ladbar (' + r.status + ')'); return r.text(); });
  }));
  teile = {player: texte[0], schale: texte[1], css: texte[2], transport: texte[3], nurlesen: texte[4]};
  return teile;
}

/* opts: {modul:{thema,titel,untertitel,bestehen_prozent}, bloecke:[{block,meta,teile,fragen,bilder}],
          marke:{firma,farbe,farbe_tief,logo}, stift:bool, kopfSkript:string (z. B. __OAK_TERMINAL)} */
function html(t, opts){
  var bloecke = (opts.bloecke || []).map(function(b){
    return {block: b.block, meta: b.meta || {}, teile: b.teile || [], fragen: b.fragen || []};
  });
  var bilder = {};
  (opts.bloecke || []).forEach(function(b){ Object.keys(b.bilder || {}).forEach(function(k){ bilder[k] = b.bilder[k]; }); });
  if(!bloecke.length) throw new Error('Keine Bloecke');
  var erst = {meta: bloecke[0].meta, teile: bloecke[0].teile, fragen: bloecke[0].fragen,
              bilder: bilder, bildliste: Object.keys(bilder).sort(), marke: opts.marke || {}, portal: {},
              thema: opts.modul.thema, block: bloecke[0].block, titel: opts.modul.titel};
  var seite = t.player.replace('__DATEN__', json(erst));
  var modul = {thema: opts.modul.thema, titel: opts.modul.titel, untertitel: opts.modul.untertitel || '',
               bestehen_prozent: opts.modul.bestehen_prozent || 80, marke: opts.marke || {}, bloecke: bloecke};
  var kopf = (opts.kopfSkript ? '<script>' + opts.kopfSkript + '</scr' + 'ipt>' : '');
  if(opts.stift) kopf += '<script>window.OAK_STIFT=true;</scr' + 'ipt>';
  seite = seite.replace(/<head([^>]*)>/i, function(m){ return m + kopf; });
  var anhang = (opts.stift ? '' : '<script>' + t.nurlesen + '</scr' + 'ipt>')
    + '<script>' + t.transport + '</scr' + 'ipt>'
    + '<style>' + t.css + '</style>'
    + '<script id="modul-daten" type="application/json">' + json(modul) + '</script>'
    + '<script>' + t.schale + '</scr' + 'ipt>';
  return seite.replace('</body>', anhang + '</body>');
}

window.OAKUW = {laden: laden, html: html};
})();

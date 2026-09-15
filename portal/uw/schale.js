/* Schale für die Auslieferung eines Moduls als EINE Datei.

   Warum eine Datei: Das Kundenportal und der Viewer öffnen ein Dokument, keinen
   Ordner — mit signierten Links brechen relative Verweise auf Nachbardateien.
   Ein Modul ist damit ein Dokument wie eine Betriebsanweisung auch: hochladen,
   öffnen, fertig. Auf dem Terminal ist es dieselbe Datei.

   Aufgesetzt auf block_player.html (Lernplattform-Aufbau): der Player zeigt ein
   Kapitel schrittweise, diese Schale liefert ihm die Kapitelliste, schaltet um,
   zeigt die Start-/Abschlusstafel und hängt den Nachweis an. Der Nachweis ist
   derselbe Code wie in der Kursübersicht. */
(function(){
"use strict";
var M = JSON.parse(document.getElementById('modul-daten').textContent);
var P = window.OAKPlayer;
if(!P){ return; }

/* Eigene Inhalte des Betriebs live aus dem Online-Terminal: Der Rahmen reicht die im
   Portal freigegebenen Zusätze herein (window.__OAK_TERMINAL.zusaetze). Sind sie nicht
   schon beim Export eingebacken (Block 99-eigene-inhalte), hängen wir sie hier an -
   dieselbe Form wie zusatz_block() in tools/unterweisung_export.py. */
(function(){
  var T = window.__OAK_TERMINAL || null;
  var z = (T && T.zusaetze) || [];
  if(!z.length) return;
  if(M.bloecke.some(function(b){ return b.block === '99-eigene-inhalte'; })) return;
  var firma = (M.marke && M.marke.firma) || 'dem Betrieb';
  var teile = [{art:'h1', text:'Was bei uns im Betrieb gilt', nr:0},
               {art:'text', nr:1, text:'Diese Punkte gelten zusätzlich zum allgemeinen Teil - festgelegt von '
                                        + firma + '. Sie sind Teil dieser Unterweisung.'}];
  var nr = 2;
  z.forEach(function(e){
    teile.push({art:'h2', text: e.titel || '', nr: nr++});
    teile.push({art:'text', text: e.text || '', nr: nr++});
    if(e.quelle === 'vorfall') teile.push({art:'hinweis', nr: nr++, text:'Dieser Punkt stammt aus einem gemeldeten Vorfall im Betrieb.'});
    if(e.hinweis) teile.push({art:'hinweis', text: e.hinweis, nr: nr++});
  });
  M.bloecke.push({block:'99-eigene-inhalte', meta:{titel:'Was bei uns im Betrieb gilt', dauer_min: Math.max(2, z.length*2)},
                  teile: teile, fragen: []});
})();

var D = P.daten;
D.thema = M.thema;
D.titel = M.titel;
D.bestehen_prozent = M.bestehen_prozent || 80;
D.marke = M.marke || {};
D.bloecke = M.bloecke.map(function(b){ return {datei: b.block, titel: b.meta.titel,
                                              dauer: b.meta.dauer_min, pflicht: true}; });
var SPEICHER = 'oak-uw-stand-' + M.thema;

function el(tag, cls, html){ var e=document.createElement(tag); if(cls) e.className=cls;
  if(html!=null) e.innerHTML=html; return e; }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function melde(t){ P.melde(t); }
function stand(){
  try { return JSON.parse(localStorage.getItem(SPEICHER) || '{}'); } catch(e){ return {}; }
}
function zeichne(){ zeigeStart(); }   // von der Nachweis-Logik nach „nächste Person" erwartet

/* Hülle für den Nachweis-Dialog - muss stehen, bevor der übernommene
   Nachweis-Code sie sucht. */
var dlgHuelle = el('div','dialog');
dlgHuelle.id = 'dlg';
dlgHuelle.appendChild(el('div','blatt')).id = 'blatt';
document.body.appendChild(dlgHuelle);

/* ---- ab hier der unveränderte Nachweis-Code aus der Kursübersicht -------- */
var dlg = document.getElementById('dlg'), blatt = document.getElementById('blatt');
var unterschriftLeer = true, zeichenFlaeche = null;

function bilanz(){
  var s = stand(), pflicht = D.bloecke.filter(function(b){ return b.pflicht; });
  var r = 0, g = 0, zeilen = pflicht.map(function(b){
    var e = s[b.datei] || {}; r += (e.richtig||0); g += (e.gesamt||0);
    return {titel: b.titel || b.datei, richtig: e.richtig||0, gesamt: e.gesamt||0, am: e.am||''};
  });
  /* Im Online-Terminal laufen alle Module der Gruppe nacheinander und es gibt EINEN
     Nachweis am Ende: die vorherigen Module kommen als je eine Zeile dazu, das aktuelle
     Modul wird zu einer Zeile zusammengefasst. */
  var T = window.__OAK_TERMINAL || null, L = (T && T.lauf) || null;
  var alleBestanden = true;
  if(L && L.bisher && L.bisher.length){
    var rM = r, gM = g;
    zeilen = L.bisher.map(function(e){
      if(e.bestanden === false) alleBestanden = false;
      return {titel: e.titel, richtig: e.richtig||0, gesamt: e.gesamt||0, am: ''};
    });
    zeilen.push({titel: D.titel || D.thema, richtig: rM, gesamt: gM, am: ''});
    L.bisher.forEach(function(e){ r += (e.richtig||0); g += (e.gesamt||0); });
  }
  var proz = g ? Math.round(r / g * 100) : 0;
  return {zeilen: zeilen, richtig: r, gesamt: g, prozent: proz,
          bestanden: alleBestanden && proz >= (D.bestehen_prozent || 80), schwelle: D.bestehen_prozent || 80};
}

function datumDE(d){
  return ('0'+d.getDate()).slice(-2) + '.' + ('0'+(d.getMonth()+1)).slice(-2) + '.' + d.getFullYear();
}
function faellig(){
  var d = new Date(); d.setFullYear(d.getFullYear() + 1);
  return datumDE(d);
}

function dialogAuf(html){
  blatt.innerHTML = html; dlg.classList.add('auf');
  document.body.style.overflow = 'hidden'; dlg.scrollTop = 0;
  requestAnimationFrame(function(){ dlg.scrollTop = 0; });
}
function dialogZu(){ dlg.classList.remove('auf'); document.body.style.overflow = ''; }

function nachweisFormular(){
  var b = bilanz();
  if(!b.bestanden){ nachweisGesperrt(b); return; }
  var reihen = b.zeilen.map(function(z){
    return '<div class="zeile"><span>' + esc(z.titel) + '</span><span class="wert">'
         + (z.gesamt ? z.richtig + ' von ' + z.gesamt + ' richtig' : 'bearbeitet') + '</span></div>';
  }).join('');
  reihen += '<div class="zeile summe"><span>Selbsttest gesamt</span><span class="wert">'
          + (b.gesamt ? b.richtig + ' von ' + b.gesamt + ' · ' + b.prozent + ' %' : '–')
          + (b.bestanden ? ' · bestanden' : ' · nicht bestanden') + '</span></div>';

  dialogAuf(
    '<h2>Nachweis der Unterweisung</h2>'
  + '<p class="lead">Trage deinen Namen ein und unterschreibe. Der Nachweis geht an die '
  + 'Fachkraft für Arbeitssicherheit und wird im Kundenportal abgelegt.</p>'
  + '<div class="feld"><label for="nwName">Vor- und Nachname</label>'
  + '<input type="text" id="nwName" autocomplete="name" autocapitalize="words" spellcheck="false" placeholder="z. B. Maria Schneider"></div>'
  + '<div class="feld"><label>Ergebnis <span class="hilf">· automatisch aus den bearbeiteten Modulen</span></label>'
  + '<div class="bilanz">' + reihen + '</div></div>'
  + '<label class="haken-feld" id="nwHakenFeld"><input type="checkbox" id="nwHaken">'
  + '<span>Ich habe die Unterweisung vollständig bearbeitet, den Inhalt verstanden und werde ihn '
  + 'befolgen. Offene Fragen konnte ich stellen.</span></label>'
  + '<div class="feld"><label for="nwFrage">Offene Frage <span class="hilf">· freiwillig, geht an die Fachkraft</span></label>'
  + '<textarea id="nwFrage" placeholder="Etwas unklar geblieben oder ein Mangel aufgefallen?"></textarea></div>'
  + '<div class="feld"><label>Unterschrift</label>'
  + '<div class="unterschrift" id="nwUBox"><canvas id="nwCanvas"></canvas>'
  + '<div class="platz">Mit dem Finger oder Stift hier unterschreiben</div></div>'
  + '<div class="u-leiste"><button type="button" id="nwLeeren">Neu unterschreiben</button>'
  + '<span class="recht">' + datumDE(new Date()) + ' · ' + esc((D.marke && D.marke.firma) || '') + '</span></div></div>'
  + '<div class="knopfreihe"><button class="k-haupt" id="nwSenden" disabled>Unterweisung bestätigen</button>'
  + '<button class="k-neben" id="nwAbbruch">Zurück</button></div>'
  + '<div class="rechtsfuss">Rechtsgrundlage: § 12 Arbeitsschutzgesetz und § 4 DGUV Vorschrift 1 – '
  + 'Unterweisung vor Aufnahme der Tätigkeit und danach mindestens einmal jährlich; für Beschäftigte '
  + 'unter 18 Jahren halbjährlich (§ 29 Jugendarbeitsschutzgesetz). Für Arbeitsmittel gilt zusätzlich '
  + '§ 12 Betriebssicherheitsverordnung. Nächste Fälligkeit nach heutigem Stand: ' + faellig() + '.</div>');

  unterschriftPfad();
  var name = document.getElementById('nwName'), haken = document.getElementById('nwHaken');
  var senden = document.getElementById('nwSenden');
  function pruefe(){
    senden.disabled = !(name.value.trim().length >= 3 && haken.checked && !unterschriftLeer);
  }
  nachweisFormular.pruefe = pruefe;
  /* Im Online-Terminal hat die Person ihren Namen schon am Start eingegeben -
     der Rahmen reicht ihn herein, hier wird er nur noch bestaetigt. */
  var T = window.__OAK_TERMINAL || null;
  if(T && T.name){ name.value = T.name; name.readOnly = true; pruefe(); }
  name.addEventListener('input', pruefe);
  haken.addEventListener('change', function(){
    document.getElementById('nwHakenFeld').classList.toggle('an', haken.checked); pruefe();
  });
  document.getElementById('nwLeeren').onclick = function(){ unterschriftLeeren(); pruefe(); };
  document.getElementById('nwAbbruch').onclick = dialogZu;
  senden.onclick = function(){ absenden(name.value.trim(), document.getElementById('nwFrage').value.trim()); };
}

/* Unterschriftenfeld - Finger, Stift und Maus */
function unterschriftPfad(){
  var c = document.getElementById('nwCanvas'), box = document.getElementById('nwUBox');
  var dpr = window.devicePixelRatio || 1;
  var b = c.getBoundingClientRect();
  c.width = Math.round(b.width * dpr); c.height = Math.round(b.height * dpr);
  var g = c.getContext('2d');
  g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#141C28';
  zeichenFlaeche = c; unterschriftLeer = true; box.classList.remove('hat');
  var malt = false;
  function ort(ev){ var r = c.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
  c.addEventListener('pointerdown', function(ev){
    ev.preventDefault(); malt = true; c.setPointerCapture(ev.pointerId);
    var o = ort(ev); g.beginPath(); g.moveTo(o[0], o[1]);
    unterschriftLeer = false; box.classList.add('hat');
    if(nachweisFormular.pruefe) nachweisFormular.pruefe();
  });
  c.addEventListener('pointermove', function(ev){
    if(!malt) return; ev.preventDefault(); var o = ort(ev); g.lineTo(o[0], o[1]); g.stroke();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(function(e){
    c.addEventListener(e, function(){ malt = false; });
  });
}
function unterschriftLeeren(){
  if(!zeichenFlaeche) return;
  var g = zeichenFlaeche.getContext('2d');
  g.save(); g.setTransform(1,0,0,1,0,0);
  g.clearRect(0,0,zeichenFlaeche.width,zeichenFlaeche.height); g.restore();
  unterschriftLeer = true; document.getElementById('nwUBox').classList.remove('hat');
}

function absenden(name, frage){
  var b = bilanz();
  var daten = {
    thema: D.thema, titel: D.titel, firma: (D.marke && D.marke.firma) || '',
    marke: D.marke || {},
    name: name, am: new Date().toISOString(),
    rolle: (window.__OAK_TERMINAL && window.__OAK_TERMINAL.rolle) || '',
    module: b.zeilen.map(function(z){ return z.titel; }),
    // fuer den Portal-Nachweis: Modultitel (im Lauf alle Module) und alle Kapiteltitel
    module_titel: (function(){ var T = window.__OAK_TERMINAL||null, L = T && T.lauf;
      return (L && L.bisher && L.bisher.length) ? b.zeilen.map(function(z){ return z.titel; }) : [D.titel || D.thema]; })(),
    kapitel_titel: (function(){ var T = window.__OAK_TERMINAL||null, L = T && T.lauf; var k = [];
      if(L && L.bisher) L.bisher.forEach(function(e){ k = k.concat(e.bausteine || []); });
      return k.concat(D.bloecke.filter(function(x){ return x.pflicht; }).map(function(x){ return x.titel || x.datei; })); })(),
    bausteine: D.bloecke.filter(function(x){ return x.pflicht; }).map(function(x){ return x.datei; }),
    ergebnis: {richtig: b.richtig, gesamt: b.gesamt, prozent: b.prozent, schwelle: b.schwelle},
    bestanden: b.bestanden, bestaetigung: true, nachfrage: frage,
    unterschrift: zeichenFlaeche ? zeichenFlaeche.toDataURL('image/png') : '',
    faellig_am: faellig(), version: D.version || 1
  };
  var knopf = document.getElementById('nwSenden');
  knopf.disabled = true; knopf.textContent = 'Wird gesendet …';

  var weg = (window.OAK && typeof window.OAK.nachweis === 'function')
    ? window.OAK.nachweis(daten)
    : fetch('/nachweis', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(daten)}).then(function(r){
          if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });

  Promise.resolve(weg).then(function(a){ nachweisFertig(daten, a || {}); })
    .catch(function(e){
      knopf.disabled = false; knopf.textContent = 'Unterweisung bestätigen';
      melde('Nachweis nicht übermittelt: ' + e.message);
    });
}

/* Vollstaendiger Nachweis - am Schirm verborgen, beim Drucken das einzige Blatt. */
function belegBlatt(d){
  var e = d.ergebnis || {};
  function z(k, w){ return '<tr><th>' + k + '</th><td>' + w + '</td></tr>'; }
  return '<div class="beleg">'
  + '<h2>Nachweis der Unterweisung</h2>'
  + '<p class="firma">' + esc(d.firma) + '</p><table>'
  + z('Unterwiesene Person', esc(d.name))
  + z('Thema der Unterweisung', esc(d.titel))
  + z('Behandelte Module', esc((d.module || []).join(' · ')))
  + z('Datum', datumDE(new Date(d.am)) + ', '
       + new Date(d.am).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}) + ' Uhr')
  + z('Erfolgskontrolle', e.richtig + ' von ' + e.gesamt + ' Fragen richtig (' + e.prozent
       + ' %) – ' + (d.bestanden ? 'bestanden' : 'nicht bestanden')
       + ' (Schwelle ' + e.schwelle + ' %)')
  + z('Bestätigung', 'Inhalt vollständig bearbeitet, verstanden und Befolgung zugesagt')
  + z('Offene Frage', esc(d.nachfrage || '–'))
  + z('Nächste Unterweisung fällig', esc(d.faellig_am))
  + '</table><div class="sig">'
  + (d.unterschrift ? '<img src="' + d.unterschrift + '" alt="Unterschrift">' : '')
  + '<span>Unterschrift der unterwiesenen Person</span></div>'
  + '<p class="recht">Rechtsgrundlage: § 12 Arbeitsschutzgesetz und § 4 DGUV Vorschrift 1 – '
  + 'Unterweisung vor Aufnahme der Tätigkeit und danach mindestens einmal jährlich; für '
  + 'Beschäftigte unter 18 Jahren halbjährlich (§ 29 Jugendarbeitsschutzgesetz). Für '
  + 'Arbeitsmittel gilt zusätzlich § 12 Betriebssicherheitsverordnung.<br>'
  + 'Unterweisungsmittel: Online-Unterweisung „' + esc(d.titel) + '“, Fassung '
  + esc(String(d.version)) + ', erstellt von Nikolai Krawielitzki – OAK engineering.</p></div>';
}

function nachweisFertig(daten, antwort){
  antwort = antwort || {};
  var beleg = antwort.beleg;
  /* Ehrlich sagen, wo der Nachweis gerade liegt - bei einem Pflichtnachweis darf
     niemand glauben, er sei im Portal, wenn er noch im Geraet wartet. */
  var wohin;
  if(antwort.lokal)
    wohin = 'Dieses Gerät ist noch nicht mit dem Kundenportal verbunden: Bitte den Nachweis '
          + 'ausdrucken und der Fachkraft für Arbeitssicherheit geben.';
  else if(antwort.wartet)
    wohin = 'Der Nachweis wird ans Kundenportal übertragen, sobald das Gerät wieder online ist. '
          + 'Zur Sicherheit kannst du ihn ausdrucken.';
  else
    wohin = 'Der Nachweis ist im Kundenportal gespeichert.';

  dialogAuf(
    '<div class="fertig-bild"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>'
  + '<h2>Unterweisung abgeschlossen</h2>'
  + '<p class="lead">Danke, ' + esc(daten.name.split(' ')[0]) + '. ' + wohin
  + (daten.nachfrage ? ' Deine Frage geht an die Fachkraft für Arbeitssicherheit.' : '') + '</p>'
  + '<div class="bilanz">'
  + '<div class="zeile"><span>Unterweisung</span><span class="wert">' + esc(daten.titel) + '</span></div>'
  + '<div class="zeile"><span>Selbsttest</span><span class="wert">' + daten.ergebnis.richtig
  + ' von ' + daten.ergebnis.gesamt + ' · ' + daten.ergebnis.prozent + ' %</span></div>'
  + '<div class="zeile summe"><span>Nächste Unterweisung fällig</span><span class="wert">'
  + esc(daten.faellig_am) + '</span></div></div>'
  + '<div class="knopfreihe"><button class="k-haupt" id="nwNaechste">Fertig – nächste Person</button>'
  + '<button class="k-neben" id="nwDrucken">Nachweis drucken</button></div>'
  + belegBlatt(daten));
  document.getElementById('nwDrucken').onclick = function(){
    if(beleg) window.open(beleg, '_blank'); else window.print(); };
  /* Laeuft das Modul im Online-Terminal (Rahmen), erfaehrt der Rahmen den Abschluss -
     ohne Rahmen (Datei, Stick, Wiki) passiert hier nichts. */
  function anRahmen(typ){
    try{ if(window.parent && window.parent !== window)
      window.parent.postMessage({type: typ, thema: D.thema, wartet: !!antwort.wartet, lokal: !!antwort.lokal}, '*'); }catch(e){}
  }
  anRahmen('oak-uw-nachweis');
  document.getElementById('nwNaechste').onclick = function(){
    try { localStorage.removeItem(SPEICHER); } catch(e){}
    dialogZu(); zeichne(); window.scrollTo(0,0);
    anRahmen('oak-uw-naechste');
  };
}

function nachweisGesperrt(b){
  var schwach = b.zeilen.filter(function(z){
    return z.gesamt && (z.richtig / z.gesamt) * 100 < b.schwelle; });
  dialogAuf(
    '<h2>Noch nicht geschafft</h2>'
  + '<p class="lead">Im Selbsttest sind ' + b.richtig + ' von ' + b.gesamt + ' Antworten richtig ('
  + b.prozent + ' %). Für den Nachweis brauchst du mindestens ' + b.schwelle + ' %. '
  + 'Arbeite die folgenden Module noch einmal durch – das kostet ein paar Minuten und du '
  + 'bist danach auf der sicheren Seite.</p>'
  + '<div class="bilanz">' + (schwach.length ? schwach : b.zeilen).map(function(z){
      return '<div class="zeile"><span>' + esc(z.titel) + '</span><span class="wert">'
           + z.richtig + ' von ' + z.gesamt + ' richtig</span></div>'; }).join('') + '</div>'
  + '<div class="knopfreihe"><button class="k-haupt" id="nwZurueck">Verstanden</button></div>');
  document.getElementById('nwZurueck').onclick = dialogZu;
}



/* --------------------------------------------------------------------------- */

var HAKEN = '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';

P.kurs = {
  bloecke: M.bloecke.map(function(b){ return {block: b.block, titel: b.meta.titel, dauer: b.meta.dauer_min}; }),
  aktiv: -1,
  stand: stand,
  oeffne: function(i){ oeffne(i); },
  uebersicht: function(){ zeigeStart(); }
};

function naechsterOffener(){
  var s = stand();
  for(var i = 0; i < M.bloecke.length; i++){ if(!s[M.bloecke[i].block]) return i; }
  return -1;
}

/* --- Start- und Abschlusstafel: Stand, Kapitelliste, Nachweis --------------- */
function zeigeStart(){
  var s = stand();
  var fertig = M.bloecke.filter(function(b){ return s[b.block]; }).length;
  var proz = M.bloecke.length ? Math.round(fertig / M.bloecke.length * 100) : 0;
  var minuten = M.bloecke.reduce(function(a,b){ return a + (b.meta.dauer_min || 0); }, 0);
  var umfang = 2 * Math.PI * 30;
  var naechster = naechsterOffener();
  P.kurs.aktiv = -1;

  var T = window.__OAK_TERMINAL || null, L = (T && T.lauf) || null;
  var html =
    (L && L.gesamt > 1 ? '<p class="tafel-hinweis">Modul ' + L.nr + ' von ' + L.gesamt + ' deiner Unterweisung</p>' : '')
  + '<h1>' + esc(M.titel) + '</h1>'
  + '<p class="unter">' + esc(M.untertitel || '') + '</p>'
  + '<div class="tafel-stand">'
    + '<div class="ring"><svg width="72" height="72" viewBox="0 0 72 72">'
      + '<circle class="bahn" cx="36" cy="36" r="30"></circle>'
      + '<circle class="fort" cx="36" cy="36" r="30" stroke-dasharray="' + (umfang * proz / 100) + ' ' + umfang + '"></circle></svg>'
      + '<b>' + proz + ' %</b></div>'
    + '<div class="txt"><h2>' + (proz === 0 ? 'Noch nicht begonnen' : (proz === 100 ? 'Alle Kapitel abgeschlossen' : 'In Bearbeitung')) + '</h2>'
      + '<p>' + M.bloecke.length + ' Kapitel' + (minuten ? ', insgesamt etwa ' + minuten + ' Minuten' : '')
      + '. Jedes Kapitel endet mit ein paar Fragen.</p></div>'
    + '<button class="btn" id="tfWeiter"></button>'
  + '</div>'
  + '<div class="tafel-liste" id="tfListe"></div>'
  + '<p class="tafel-hinweis" id="tfHinweis"></p>'
  + '<p><button class="btn gut" id="abschluss" disabled>' + HAKEN
  + (L && !L.letztes ? 'Weiter mit Modul ' + (L.nr + 1) + ' von ' + L.gesamt : 'Nachweis erstellen') + '</button></p>';

  P.zeigeTafel(html);

  var liste = document.getElementById('tfListe');
  M.bloecke.forEach(function(b, i){
    var ist = !!s[b.block];
    var z = el('div','zeile' + (ist ? ' fertig' : ''));
    z.appendChild(el('span','nr', ist ? HAKEN : String(i + 1)));
    z.appendChild(el('span', null, esc(b.meta.titel || b.block)));
    z.appendChild(el('small', null, (b.meta.dauer_min ? 'ca. ' + b.meta.dauer_min + ' Min.' : '') + (ist ? ' · abgeschlossen' : '')));
    z.onclick = function(){ oeffne(i); };
    liste.appendChild(z);
  });

  var w = document.getElementById('tfWeiter');
  w.textContent = naechster < 0 ? 'Alles erledigt' : (fertig ? 'Weiter mit Kapitel ' + (naechster + 1) : 'Beginnen');
  w.disabled = naechster < 0;
  w.onclick = function(){ if(naechster >= 0) oeffne(naechster); };

  var ab = document.getElementById('abschluss');
  ab.disabled = proz < 100;
  if(L && !L.letztes){
    document.getElementById('tfHinweis').textContent = proz < 100
      ? 'Sobald alle Kapitel abgeschlossen sind, geht es mit dem nächsten Modul weiter.'
      : 'Modul abgeschlossen. Weiter geht es mit Modul ' + (L.nr + 1) + ' von ' + L.gesamt + '.';
    ab.onclick = function(){
      var b = bilanz();
      try{ window.parent.postMessage({type:'oak-uw-modul-fertig', thema: M.thema, titel: M.titel,
        richtig: b.richtig, gesamt: b.gesamt, prozent: b.prozent, bestanden: b.bestanden,
        bausteine: M.bloecke.map(function(x){ return x.meta.titel || x.block; })}, '*'); }catch(e){}
    };
  } else {
    document.getElementById('tfHinweis').textContent = proz < 100
      ? 'Sobald alle Kapitel abgeschlossen sind, kannst du den Nachweis erstellen.'
      : (L ? 'Alle Module sind abgeschlossen. Jetzt Bestätigung und Unterschrift.' : 'Alle Kapitel sind abgeschlossen. Jetzt Name und Unterschrift eintragen.');
    ab.onclick = nachweisFormular;
  }

  document.getElementById('mModul').textContent = M.titel;
  document.title = M.titel + ((M.marke && M.marke.firma) ? ' · ' + M.marke.firma : '');
  P.fortschritt();
}

function oeffne(i){
  P.kurs.aktiv = i;
  P.setzeBlock(M.bloecke[i]);
}

/* Kapitel geschafft: weiter zum nächsten offenen, am Ende zur Tafel. */
P.beiAbschluss = function(){
  var n = naechsterOffener();
  if(n >= 0 && n !== P.kurs.aktiv){ melde('Kapitel abgeschlossen. Weiter geht es mit Kapitel ' + (n + 1) + '.'); oeffne(n); }
  else { zeigeStart(); }
};

/* Kopfzeile: „Übersicht" führt hier zur Tafel statt auf eine andere Seite. */
var zurueck = document.getElementById('uebersicht');
if(zurueck){ zurueck.removeAttribute('href'); zurueck.style.cursor = 'pointer';
  zurueck.onclick = function(ev){ ev.preventDefault(); zeigeStart(); }; }

zeigeStart();
})();

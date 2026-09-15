(function(){
  "use strict";
  var PORTAL = {url: "https://ayieotppxrjrzdpeofkx.supabase.co", anon: "sb_publishable_fz1o6tjpwa7gjiNb17uuEg_-ZwNdFcS"};
  var TERMKEY = 'oak-uw-terminal';        // {token, kunde} – vom Terminal gesetzt
  var QKEY    = 'oak-uw-warteschlange-neu';

  function zugang(){
    try{ var t = JSON.parse(localStorage.getItem(TERMKEY) || 'null');
         return (t && t.token) ? t : null; }catch(e){ return null; }
  }
  function warteschlange(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }
                            catch(e){ return []; } }
  function warteschlangeSetzen(l){ try{ localStorage.setItem(QKEY, JSON.stringify(l)); }catch(e){} }

  function rpc(name, koerper){
    return fetch(PORTAL.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', apikey: PORTAL.anon,
                Authorization: 'Bearer ' + PORTAL.anon},
      body: JSON.stringify(koerper)
    }).then(function(r){
      if(!r.ok) return r.json().catch(function(){ return {}; }).then(function(j){
        throw new Error(j.message || ('Server ' + r.status)); });
      return r.json();
    });
  }

  function senden(n){
    var z = zugang();
    if(!z) return Promise.reject(new Error('kein Terminal-Zugang'));
    // Wie beim bestehenden Terminal: funktion = Gruppe der Person, module = Modultitel,
    // bausteine = die bearbeiteten Kapitel. Ohne Terminal-Rahmen steht der Modultitel
    // als Gruppe, damit der Nachweis im Portal nicht leer bleibt.
    return rpc('unterweisung_nachweis', {
      p_token: z.token, p_name: n.name, p_rolle: n.rolle || n.titel || n.thema,
      p_bereich: null, p_module: (n.module_titel && n.module_titel.length) ? n.module_titel : [n.titel || n.thema],
      p_bestanden: !!n.bestanden, p_bestaetigung: !!n.bestaetigung,
      p_nachfrage: n.nachfrage || null, p_unterschrift: n.unterschrift || null,
      p_version: n.version || 0,
      p_bausteine: (n.kapitel_titel && n.kapitel_titel.length) ? n.kapitel_titel : ((n.module && n.module.length) ? n.module : null)
    });
  }

  function abarbeiten(){
    if(!zugang() || navigator.onLine === false) return Promise.resolve(0);
    var q = warteschlange(); if(!q.length) return Promise.resolve(0);
    return senden(q[0]).then(function(){
      q.shift(); warteschlangeSetzen(q); return abarbeiten();
    }).catch(function(){ return 0; });
  }

  window.OAK = window.OAK || {};
  window.OAK.nachweis = function(daten){
    if(!zugang()){
      // Kein Portal-Zugang auf diesem Geraet: Nachweis bleibt lokal und wird gedruckt.
      var q = warteschlange(); q.push(daten); warteschlangeSetzen(q);
      return Promise.resolve({ok: true, lokal: true});
    }
    return senden(daten).then(function(){ return {ok: true}; }).catch(function(e){
      var q = warteschlange(); q.push(daten); warteschlangeSetzen(q);
      return {ok: true, wartet: true, grund: e.message};
    });
  };
  window.addEventListener('online', abarbeiten);
  abarbeiten();
})();
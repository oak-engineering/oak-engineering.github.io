/* Liegengebliebene Unterweisungsnachweise dieses Geräts nachreichen – egal welche Seite
   geöffnet wird (Portal V1, Cockpit V2, Terminal). Die Warteschlangen liegen im Browser des
   Geräts (gleiche Adresse oak-engineering.de); bisher leerte sie nur die Terminal-Seite selbst.
   Anlass 21.10.2026: Nachweise vom Surface hingen tagelang, weil dort nur das Portal geöffnet wurde. */
(function(){
  "use strict";
  var URL_ = "https://ayieotppxrjrzdpeofkx.supabase.co", ANON = "sb_publishable_fz1o6tjpwa7gjiNb17uuEg_-ZwNdFcS";
  function lies(k){ try{ return JSON.parse(localStorage.getItem(k) || "null"); }catch(e){ return null; } }
  function schreib(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  var z = lies("oak-uw-terminal");
  if(!z || !z.token || navigator.onLine === false) return;
  function senden(b){
    return fetch(URL_ + "/rest/v1/rpc/unterweisung_nachweis", { method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + ANON },
      body: JSON.stringify(b) }).then(function(r){ if(!r.ok) throw new Error("Server " + r.status); });
  }
  var kiosk = function(n){ return { p_token: z.token, p_name: n.name, p_rolle: n.rolle, p_bereich: n.bereich || null,
    p_module: n.module || [], p_bestanden: !!n.bestanden, p_bestaetigung: !!n.bestaetigung, p_nachfrage: n.nachfrage || null,
    p_unterschrift: n.unterschrift || null, p_version: 0, p_bausteine: (n.bausteine && n.bausteine.length) ? n.bausteine : null }; };
  var neu = function(n){ return { p_token: z.token, p_name: n.name, p_rolle: n.rolle || n.titel || n.thema, p_bereich: null,
    p_module: (n.module_titel && n.module_titel.length) ? n.module_titel : [n.titel || n.thema], p_bestanden: !!n.bestanden,
    p_bestaetigung: !!n.bestaetigung, p_nachfrage: n.nachfrage || null, p_unterschrift: n.unterschrift || null, p_version: n.version || 0,
    p_bausteine: (n.kapitel_titel && n.kapitel_titel.length) ? n.kapitel_titel : ((n.module && n.module.length) ? n.module : null) }; };
  function leeren(key, map){
    var q = lies(key) || []; var ok = 0;
    function weiter(){
      if(!q.length) return Promise.resolve(ok);
      return senden(map(q[0])).then(function(){ q.shift(); ok++; schreib(key, q); return weiter(); }).catch(function(){ return ok; });
    }
    return weiter();
  }
  if(location.pathname.indexOf("kiosk.html") >= 0) return;   // das Terminal leert selbst
  setTimeout(function(){
    leeren("oak-uw-warteschlange", kiosk).then(function(a){
      return leeren("oak-uw-warteschlange-neu", neu).then(function(b){
        var n = a + b; if(!n) return;
        var d = document.createElement("div");
        d.textContent = n + " Unterweisungsnachweis(e) von diesem Gerät nachträglich übermittelt.";
        d.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1B4332;color:#fff;padding:12px 18px;border-radius:12px;font:15px Jost,sans-serif;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.25)";
        document.body.appendChild(d); setTimeout(function(){ d.remove(); }, 8000);
      });
    });
  }, 2500);
})();

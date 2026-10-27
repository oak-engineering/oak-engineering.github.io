/* Lobby/Duell der Educational Mini Games (für Schulungen).
   Die Lobby entsteht auf der Übersichtsseite: Trainer erstellt sie (QR-Code + 6-stelliger Code), Teilnehmer treten mit
   Spitznamen bei und bleiben für alle Spiele darin. Startet der Trainer ein Spiel, springen alle Handys hinein (gleicher
   Zufallsstartwert = gleiche Aufgaben), danach zurück in den Wartebereich. Rangliste je Spiel und gesamt.
   Gespeichert werden nur Spitzname und Punkte; gelöscht nach 24 Stunden (Supabase spiel_lobby_*, spiel_duell_*).
   Der publishable Key ist öffentlich by design. */
'use strict';
const DUELL = (() => {
  const API = 'https://ayieotppxrjrzdpeofkx.supabase.co/rest/v1/rpc/';
  const KEY = 'sb_publishable_fz1o6tjpwa7gjiNb17uuEg_-ZwNdFcS';
  // Spielkennung → Datei (relativ zum Ordner spiele/) und Name
  const SPIELE = { piktogramm: ['piktogramm-check', 'Piktogramm-Check'], laut: ['wie-laut-ist-das', 'Wie laut ist das?'], mythos: ['frist-oder-mythos', 'Frist oder Mythos?'],
    zustaendig: ['wer-ist-zustaendig', 'Wer ist zuständig?'], pruefristen: ['pruefristen-puzzle', 'Prüffristen-Puzzle'], lager: ['zusammenlagerung', 'Zusammenlagerung'], wimmelbild: ['wimmelbild', 'Mängel-Wimmelbild'] };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ENTWURF = location.pathname.includes('.entwurf'), BASIS = /\/wimmelbild[^/]*\//.test(location.pathname) ? '../' : '';
  let aktiv = null, uhr = null;

  async function rpc(fn, daten) {
    const r = await fetch(API + fn, { method: 'POST', cache: 'no-store', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(daten) });
    if (!r.ok) { let m = 'Verbindung fehlgeschlagen (' + r.status + ')'; try { m = (await r.json()).message || m; } catch (e) { /* leer */ } throw new Error(m); }
    return r.status === 204 ? null : r.json();
  }
  const lesen = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const schreiben = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ohne Speicher */ } };
  const neueId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const zeit = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const qr = text => { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 1, scalable: true }); } catch (e) { return ''; } };
  const stopp = () => { clearInterval(uhr); uhr = null; };

  // gespeicherte Lobby dieses Geräts: { code, rolle: 'trainer'|'spieler', trainer?, spieler?, name?, gespielt? }
  const lobby = v => v === undefined ? lesen('mini-lobby') : schreiben('mini-lobby', v);
  const startseite = () => BASIS + (ENTWURF ? 'index.entwurf.html' : 'index.html');
  const lobbyUrl = (code, teil = false) => startseite() + '?modus=duell' + (code ? '&lobby=' + code : '') + (teil ? '&beitreten=1' : '');
  function spielUrl(spiel, code, runde, seed) {
    const s = SPIELE[spiel]; if (!s) return lobbyUrl(code);
    const pfad = spiel === 'wimmelbild' ? `wimmelbild${ENTWURF ? '.entwurf' : ''}/index.html?beispiel=halle&` : `${s[0]}${ENTWURF ? '.entwurf' : ''}.html?`;
    return BASIS + pfad + `lobby=${code}&runde=${runde}&seed=${seed}`;
  }
  const spielName = id => (SPIELE[id] || [, id])[1];

  // Rangliste: Platz, Name, Stand, Punkte dieses Spiels, Gesamtpunkte der Lobby
  function rangHtml(liste, runden, leer) {
    if (!liste.length) return `<p class="du-leer">${leer}</p>`;
    return liste.map((e, i) => `<div class="du-zeile${e.ich ? ' ich' : ''}${i < 3 && e.punkte ? ' p' + (i + 1) : ''}"><b>${i + 1}</b><span title="${esc(e.name)}">${esc(e.name)}</span>
      <small>${e.fertig ? 'fertig · ' + zeit(Number(e.sek) || 0) : e.schritt ? 'Runde ' + Math.min(e.schritt + 1, runden) + '/' + runden : '–'}</small><em>${Number(e.punkte) | 0}</em><em class="du-gesamt" title="Gesamtpunkte in der Lobby">${Number(e.gesamt) | 0}</em></div>`).join('');
  }
  async function rangliste(el, runden = 10, runde = null, leer = 'Noch niemand dabei.') {
    const code = aktiv?.code || lobby()?.code; if (!el || !code) return null;
    try { const l = await rpc('spiel_lobby_rangliste', { p_code: code, p_runde: runde, p_spieler: aktiv?.spieler || lobby()?.spieler || null }); el.innerHTML = rangHtml(l || [], runden, leer); return l; }
    catch (e) { return null; }
  }

  // Im Spiel: Start aus der Lobby (?lobby=CODE&runde=N&seed=S)
  function lobbyStart(cfg) {
    const P = new URLSearchParams(location.search), code = P.get('lobby') || '', runde = Number(P.get('runde')), seed = Number(P.get('seed'));
    if (!/^\d{6}$/.test(code) || !runde || !seed) return false;
    const l = lobby();
    if (!l || l.code !== code || l.rolle !== 'spieler' || !l.spieler) { location.href = lobbyUrl(code, true); return true; }
    aktiv = { code, runde, seed, spieler: l.spieler, name: l.name, runden: cfg.runden };
    lobby({ ...l, gespielt: Math.max(l.gespielt || 0, runde) });
    cfg.los(seed);
    return true;
  }
  function melden(stand) {
    if (!aktiv) return;
    rpc('spiel_lobby_melden', { p_code: aktiv.code, p_spieler: aktiv.spieler, p_name: aktiv.name, p_runde: aktiv.runde, p_punkte: Math.round(stand.punkte), p_schritt: stand.runde || 0, p_sek: Math.round(stand.sek * 10) / 10, p_fertig: !!stand.fertig }).catch(() => {});
  }
  // nach dem Spiel: Rangliste aktualisieren und automatisch zum nächsten Spiel des Trainers wechseln
  function aufNaechstes() {
    stopp();
    const pruefen = async () => {
      try { const d = (await rpc('spiel_lobby_holen', { p_code: aktiv.code }))[0]; if (d && d.runde > aktiv.runde && d.spiel) { location.href = spielUrl(d.spiel, aktiv.code, d.runde, d.seed); return; } } catch (e) { /* weiter warten */ }
      rangliste(document.getElementById('du-rang-live'), aktiv.runden || 10, aktiv.runde);
    };
    pruefen(); uhr = setInterval(pruefen, 2500);
  }
  function ende(app, cfg, ergebnis) {
    aktiv.runden = cfg.runden;
    app.innerHTML = `<div class="du-trainer du-ende">
      <div class="du-karte du-qr"><small>Lobby ${aktiv.code.slice(0, 3)} ${aktiv.code.slice(3)} · ${esc(cfg.titel)}</small><h2>Geschafft, ${esc(aktiv.name)}!</h2>
        <div class="du-code">${ergebnis.punkte}</div><p class="du-link">Punkte · Zeit ${zeit(ergebnis.sek)}</p>
        <p class="du-warten">Das nächste Spiel startet automatisch, sobald der Trainer es auswählt.</p>
        <div class="du-knoepfe"><button class="knopf zwei" data-a="lobby">Zur Lobby</button><button class="knopf zwei" data-a="raus">Lobby verlassen</button></div></div>
      <div class="du-karte du-rang"><h2>Rangliste <small>Spiel · Gesamt</small></h2><div class="du-liste" id="du-rang-live"></div></div></div>`;
    app.querySelector('[data-a="lobby"]').onclick = () => { location.href = lobbyUrl(aktiv.code); };
    app.querySelector('[data-a="raus"]').onclick = () => { lobby(null); location.href = startseite(); };
    aufNaechstes();
  }
  // Wimmelbild: Rangliste im eigenen Ergebnisdialog, Wechsel zum nächsten Spiel ebenfalls automatisch
  function ranglisteEinbetten(el) { if (!el || !aktiv) return; el.id = 'du-rang-live'; el.classList.add('du-liste'); aktiv.runden = 1; aufNaechstes(); }
  // „Duell“ im Spiel → zur Lobby auf der Übersicht
  function menue() { location.href = lobbyUrl(lobby()?.code || ''); }

  return { get aktiv() { return aktiv; }, rng, rpc, esc, qr, zeit, neueId, lobby, lobbyUrl, spielUrl, spielName, startseite, rangHtml, rangliste, lobbyStart, melden, ende, menue, stopp,
    ranglisteEinbetten, codeAusUrl: () => '', SPIELE };
})();
window.DUELL = DUELL;

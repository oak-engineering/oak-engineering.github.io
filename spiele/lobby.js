/* Lobby auf der Übersichtsseite der Educational Mini Games (nutzt duell.js).
   Modus „Duell“: Dialog „Lobby erstellen / Mitmachen“. Trainer sieht QR-Code, Code, Teilnehmer und Rangliste und startet
   per Klick auf eine Kachel das nächste Spiel für alle. Teilnehmer warten in der Lobby und springen automatisch ins Spiel. */
'use strict';
(() => {
  const D = window.DUELL, esc = D.esc, $ = s => document.querySelector(s);
  const bereich = $('.bereich'), panel = $('.lobby'), dialog = $('#lobby-dialog');
  let uhr = null, letzteRunde = -1;
  const stopp = () => { clearInterval(uhr); uhr = null; };
  const code3 = c => c.slice(0, 3) + ' ' + c.slice(3);
  const absolut = rel => new URL(rel, location.href).href;
  const P = new URLSearchParams(location.search);

  function dialogZeigen(html) { dialog.innerHTML = `<div class="ld-karte">${html}</div>`; dialog.hidden = false; }
  function dialogZu() { dialog.hidden = true; dialog.innerHTML = ''; }

  // Auswahl: erstellen oder mitmachen
  function auswahl() {
    const l = D.lobby();
    dialogZeigen(`<h2>Duell für Schulungen</h2><p>Alle spielen gleichzeitig auf ihrem Handy und bleiben für alle Spiele in derselben Lobby.</p>
      <div class="du-wahl">
        <button class="du-kachel" data-a="erstellen"><b>Lobby erstellen</b><span>Ich leite die Schulung: QR-Code für den Beamer, ich wähle die Spiele</span></button>
        <button class="du-kachel" data-a="mitmachen"><b>Mitmachen</b><span>Ich habe einen Code oder QR-Code bekommen</span></button>
      </div>
      ${l ? `<button class="knopf zwei ld-zurueck" data-a="zurueck">Zurück in Lobby ${code3(l.code)}</button>` : ''}
      <button class="ld-schliessen" data-a="zu" aria-label="Schließen">×</button>`);
    dialog.querySelector('[data-a="erstellen"]').onclick = erstellen;
    dialog.querySelector('[data-a="mitmachen"]').onclick = () => mitmachen('');
    dialog.querySelector('[data-a="zurueck"]')?.addEventListener('click', () => { dialogZu(); ansicht(); });
    dialog.querySelector('[data-a="zu"]').onclick = () => { dialogZu(); window.modusSetzen?.('allein'); };
  }

  async function erstellen() {
    try {
      const d = (await D.rpc('spiel_lobby_anlegen', {}))[0];
      D.lobby({ code: d.code, rolle: 'trainer', trainer: d.trainer });
      dialogZu(); ansicht();
    } catch (e) { alert('Lobby konnte nicht erstellt werden: ' + e.message); }
  }

  function mitmachen(code) {
    let name = ''; try { name = localStorage.getItem('duell-name') || ''; } catch (e) { /* leer */ }
    dialogZeigen(`<h2>Mitmachen</h2>
      <form class="du-form" autocomplete="off">
        <label>Code<input name="code" inputmode="numeric" maxlength="7" required placeholder="123 456" value="${code ? code3(code) : ''}"></label>
        <label>Spitzname<input name="name" maxlength="24" required placeholder="z. B. Max S." value="${esc(name)}"></label>
        <button class="knopf">In die Lobby</button>
        <p class="du-fehler" hidden></p>
      </form>
      <p class="du-hinweis">Für die Rangliste werden nur dein Spitzname und deine Punkte gespeichert und nach 24 Stunden gelöscht. Ein echter Name ist nicht nötig.</p>
      <button class="ld-schliessen" data-a="zu" aria-label="Schließen">×</button>`);
    const f = dialog.querySelector('form'), fehler = dialog.querySelector('.du-fehler');
    dialog.querySelector('[data-a="zu"]').onclick = () => { dialogZu(); window.modusSetzen?.('allein'); };
    (code ? f.name : f.code).focus();
    f.onsubmit = async ev => {
      ev.preventDefault(); fehler.hidden = true;
      const c = f.code.value.replace(/\D/g, ''), n = f.name.value.trim().slice(0, 24);
      if (!/^\d{6}$/.test(c) || !n) { fehler.textContent = 'Bitte 6-stelligen Code und Spitznamen eingeben.'; fehler.hidden = false; return; }
      try {
        const alt = D.lobby(), spieler = alt && alt.code === c && alt.spieler ? alt.spieler : D.neueId();
        const d = (await D.rpc('spiel_lobby_beitreten', { p_code: c, p_spieler: spieler, p_name: n }))[0];
        try { localStorage.setItem('duell-name', n); } catch (e) { /* leer */ }
        // läuft gerade ein Spiel, steigt man direkt ein; sonst Wartebereich
        D.lobby({ code: c, rolle: 'spieler', spieler, name: n, gespielt: d.spiel ? d.runde - 1 : d.runde });
        dialogZu(); ansicht();
      } catch (e) { fehler.textContent = e.message; fehler.hidden = false; }
    };
  }

  function verlassen() { stopp(); D.lobby(null); bereich.className = 'bereich'; panel.innerHTML = ''; history.replaceState(null, '', location.pathname); window.modusSetzen?.('allein'); }

  // Ansicht je nach Rolle
  function ansicht() {
    const l = D.lobby(); stopp();
    if (!l) { bereich.className = 'bereich'; panel.innerHTML = ''; return; }
    window.modusSetzen?.('duell', true);
    l.rolle === 'trainer' ? trainer(l) : warten(l);
  }

  function trainer(l) {
    bereich.className = 'bereich trainer';
    const link = absolut(D.lobbyUrl(l.code, true));
    panel.innerHTML = `<div class="lb-kopf"><div class="lb-qr">${D.qr(link)}</div><div><small>Lobby · Code</small><div class="du-code">${code3(l.code)}</div><p class="lb-zahl">0 dabei</p></div></div>
      <p class="lb-status">Tippe auf ein Spiel, um es für alle zu starten.</p>
      <h2>Rangliste <small class="lb-spalten">Spiel · Gesamt</small></h2><div class="du-liste lb-liste"></div>
      <button class="knopf zwei lb-raus">Lobby schließen</button>`;
    panel.querySelector('.lb-raus').onclick = () => { if (confirm('Lobby schließen? Die Teilnehmer bleiben im Wartebereich hängen.')) verlassen(); };
    const status = panel.querySelector('.lb-status'), zahl = panel.querySelector('.lb-zahl'), liste = panel.querySelector('.lb-liste');
    const aktualisieren = async () => {
      try {
        const d = (await D.rpc('spiel_lobby_holen', { p_code: l.code }))[0];
        if (!d) { status.textContent = 'Lobby abgelaufen.'; stopp(); return; }
        zahl.textContent = `${d.teilnehmer} dabei`;
        if (d.spiel) status.innerHTML = `Läuft: <b>${esc(D.spielName(d.spiel))}</b> (Spiel ${d.runde}) – nächstes Spiel per Klick auf eine Kachel.`;
        document.querySelectorAll('[data-spiel]').forEach(a => a.classList.toggle('laeuft', a.dataset.spiel === d.spiel));
        D.rangliste(liste, d.spiel === 'wimmelbild' ? 1 : 10, d.runde, 'QR-Code scannen oder Code eingeben – wer dabei ist, erscheint hier.');
      } catch (e) { /* kurz offline */ }
    };
    aktualisieren(); uhr = setInterval(aktualisieren, 2500);
  }

  function warten(l) {
    bereich.className = 'bereich warten';
    panel.innerHTML = `<div class="lb-kopf lb-ich"><div><small>Lobby ${code3(l.code)}</small><h2>Du bist dabei, ${esc(l.name)}!</h2>
      <p class="lb-status">Warte, bis der Trainer ein Spiel startet – es öffnet sich automatisch.</p></div></div>
      <h2>Rangliste <small class="lb-spalten">letztes Spiel · Gesamt</small></h2><div class="du-liste lb-liste"></div>
      <button class="knopf zwei lb-raus">Lobby verlassen</button>`;
    panel.querySelector('.lb-raus').onclick = verlassen;
    const liste = panel.querySelector('.lb-liste');
    const pruefen = async () => {
      try {
        const d = (await D.rpc('spiel_lobby_holen', { p_code: l.code }))[0];
        if (!d) { panel.querySelector('.lb-status').textContent = 'Diese Lobby ist abgelaufen.'; stopp(); return; }
        if (d.spiel && d.runde > (D.lobby()?.gespielt || 0)) { location.href = D.spielUrl(d.spiel, l.code, d.runde, d.seed); return; }
        if (d.runde !== letzteRunde) { letzteRunde = d.runde; }
        D.rangliste(liste, 10, d.runde || null, 'Noch keine Ergebnisse.');
      } catch (e) { /* weiter warten */ }
    };
    pruefen(); uhr = setInterval(pruefen, 2500);
  }

  // Kachel-Klick: Trainer startet das Spiel für alle (statt selbst zu spielen)
  document.querySelectorAll('[data-spiel]').forEach(a => a.addEventListener('click', async ev => {
    const l = D.lobby(); if (!l || l.rolle !== 'trainer') return;
    ev.preventDefault();
    try { await D.rpc('spiel_lobby_starten', { p_code: l.code, p_trainer: l.trainer, p_spiel: a.dataset.spiel }); }
    catch (e) { alert('Spiel konnte nicht gestartet werden: ' + e.message); }
  }));

  // Moduswechsel aus der Übersicht
  window.lobbyModus = m => { if (m === 'duell' && !D.lobby()) auswahl(); if (m === 'allein' && D.lobby()) { dialogZu(); } };

  // Einstieg: QR-Link (?lobby=CODE&beitreten=1), Rückkehr aus einem Spiel (?lobby=CODE) oder gespeicherte Lobby
  const urlCode = /^\d{6}$/.test(P.get('lobby') || '') ? P.get('lobby') : '';
  const l = D.lobby();
  if (urlCode && (!l || l.code !== urlCode || (P.get('beitreten') && l.rolle !== 'spieler'))) { window.modusSetzen?.('duell', true); mitmachen(urlCode); }
  else if (l) ansicht();
  else if (P.get('modus') === 'duell') { window.modusSetzen?.('duell', true); auswahl(); }
})();

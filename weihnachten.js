/* Weihnachtsschmuck (Entwurf 26.11.2026, Nikolai): grosser OAK-Baum hinter dem Netz mit feiner Lichterkette, Schneefall
   ueber dem Kopfbereich, Laufband oben. Das Logo links oben bleibt unveraendert.
   2. Fassung: keine bunten Kugeln mehr ("sieht billig aus"), sondern warmweisse Lichter entlang der Aeste (aus dem Signet
   abgetastet), goldene Astenden, schlanker Stern; Schmuck liegt UEBER dem Aufleuchten; Schnee faellt dauerhaft.
   Aktiv 26.11.2026 bis einschl. 01.01.2027 (Freigabe Nikolai 26.11.) oder mit data-erzwingen am Script-Tag (Vorschau). Zeichnet ueber den Andockpunkt window.OAK_DEKO
   im Gitter von site.js; muss VOR site.js geladen werden. */
(function () {
  var tag = document.currentScript, h = new Date();
  var zeit = h >= new Date(2026, 10, 26) && h < new Date(2027, 0, 2);   // live 26.11.2026 bis einschl. 01.01.2027
  if (!zeit && !(tag && tag.hasAttribute('data-erzwingen'))) return;
  var ruhig = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Astenden im Signet (Bildkoordinaten 1024 x 559) -> goldene Lichtkugeln
  var ENDEN = [[538, 80], [585, 92], [385, 130], [657, 139], [357, 179], [694, 210], [312, 268], [715, 266], [350, 340],
               [692, 305], [361, 369]];
  var lichter = null, enden = null;

  // Lichter einmal aus dem Signet abtasten: Punkte auf den Aesten, Rahmen und Stamm-Unterteil ausgenommen
  function abtasten(logo, B) {
    var c = document.createElement('canvas'), N = 240;
    c.width = N; c.height = N;
    var g = c.getContext('2d');
    g.drawImage(logo, B.x, B.y, B.w, B.h, 0, 0, N, N);
    var px;
    try { px = g.getImageData(0, 0, N, N).data; } catch (e) { return []; }
    var kand = [];
    for (var y = 8; y < N * 0.78; y += 2) for (var x = 8; x < N - 8; x += 2) {
      if (px[(y * N + x) * 4 + 3] > 120) kand.push([x / N, y / N]);
    }
    for (var i = kand.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = kand[i]; kand[i] = kand[j]; kand[j] = t; }
    var aus = [], ABST = 0.09;
    for (var k = 0; k < kand.length && aus.length < 24; k++) {
      var p = kand[k], frei = true;
      for (var q = 0; q < aus.length && frei; q++) { var dx = aus[q].x - p[0], dy = aus[q].y - p[1]; frei = dx * dx + dy * dy > ABST * ABST; }
      if (frei) aus.push({ x: p[0], y: p[1], ph: Math.random() * 6.28, sp: 0.0012 + Math.random() * 0.0018 });
    }
    return aus;
  }

  function licht(ctx, x, y, r, a, kern) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,248,225,' + a + ')');
    g.addColorStop(0.25, 'rgba(255,226,150,' + (a * 0.55) + ')');
    g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    if (kern) { ctx.fillStyle = 'rgba(255,250,235,' + a + ')'; ctx.beginPath(); ctx.arc(x, y, kern, 0, 6.2832); ctx.fill(); }
  }

  function stern(ctx, x, y, r, a) {
    ctx.save();
    licht(ctx, x, y, r * 2.4, a * 0.5, 0);
    ctx.beginPath();
    for (var i = 0; i < 16; i++) {                                    // achtzackig, schlank
      var w = -Math.PI / 2 + i * Math.PI / 8, rr = i % 2 ? r * 0.22 : (i % 4 ? r * 0.6 : r);
      ctx.lineTo(x + Math.cos(w) * rr, y + Math.sin(w) * rr);
    }
    ctx.closePath();
    var g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, 'rgba(255,240,190,' + a + ')'); g.addColorStop(1, 'rgba(222,178,90,' + a + ')');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }

  // Schnee: dauerhaft, Flocken kommen oben wieder herein
  var flocken = null, fw = 0, fh = 0;
  function neueFlocke(oben) {
    var tiefe = Math.random();                                        // vorne gross/schnell, hinten klein/langsam
    return { x: Math.random() * fw, y: oben ? -5 - Math.random() * 40 : Math.random() * fh, r: 0.8 + tiefe * 2.2,
             v: 0.25 + tiefe * 0.75, ph: Math.random() * 6.28, a: 0.35 + tiefe * 0.5 };
  }

  window.OAK_DEKO = {
    baum: function (ctx, lx, ly, s, t, logo, B) {
      if (!lichter && logo && logo.complete && B) {
        lichter = abtasten(logo, B);
        enden = ENDEN.map(function (e) { return { x: (e[0] - B.x) / B.w, y: (e[1] - B.y) / B.h }; });
      }
      if (!lichter) return;
      var r = Math.max(2, s * 0.012);
      ctx.save();
      lichter.forEach(function (l) {
        var a = ruhig ? 0.6 : 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * l.sp + l.ph));
        licht(ctx, lx + l.x * s, ly + l.y * s, r * 2.2, a, r * 0.28);
      });
      enden.forEach(function (e, i) {
        var a = ruhig ? 0.85 : 0.65 + 0.3 * Math.sin(t * 0.0015 + i);
        licht(ctx, lx + e.x * s, ly + e.y * s, r * 3, a * 0.7, r * 0.75);
      });
      stern(ctx, lx + 0.5 * s, ly + 0.005 * s, r * 3.2, 0.95);
      ctx.restore();
    },
    oben: function (ctx, w, hh, t) {
      if (ruhig) return;
      if (!flocken || Math.abs(w - fw) > 50) {
        fw = w; fh = hh; flocken = [];
        var n = Math.round(Math.min(110, w / 12));
        for (var i = 0; i < n; i++) flocken.push(neueFlocke(false));
      }
      fh = hh;
      ctx.save(); ctx.fillStyle = '#FFFFFF';
      for (var k = 0; k < flocken.length; k++) {
        var f = flocken[k];
        f.y += f.v; f.x += Math.sin(t * 0.0009 + f.ph) * 0.3;
        if (f.y > fh + 5) { flocken[k] = neueFlocke(true); continue; }
        ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }
  };

  // ── Laufband oberhalb der Navigation ──
  var css = document.createElement('style');
  css.textContent =
    '.xm-band{background:#1B4332;color:#E9C46A;overflow:hidden;white-space:nowrap;height:30px;display:flex;align-items:center;' +
      'font-family:var(--sans,Jost,sans-serif);font-size:.78rem;font-weight:500;letter-spacing:.14em;text-transform:uppercase;}' +
    '.xm-lauf{display:inline-flex;padding-left:100%;animation:xm-lauf 30s linear infinite;}' +
    '.xm-lauf span{display:inline-flex;align-items:center;gap:.8rem;}' +
    '.xm-lauf svg{width:12px;height:12px;flex:0 0 auto;}' +
    '@keyframes xm-lauf{to{transform:translateX(-100%);}}' +
    // eingeklappter Kopfbalken der Unterseiten ragt sonst unter dem Band hervor (sitzt bei 68 px - 115 %)
    'body:not(.kopf-fest) .kopf-balken{visibility:hidden;}' +
    '@media (prefers-reduced-motion:reduce){.xm-lauf{animation:none;padding-left:0;justify-content:center;width:100%;}' +
      '}';
  document.head.appendChild(css);
  var svg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E9C46A" d="M12 1.5l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.8l7.1-.7z"/></svg>';
  var text = 'OAK engineering wünscht eine besinnliche Weihnachtszeit und einen guten Rutsch ins neue Jahr!';
  function band() {
    var b = document.createElement('div');
    b.className = 'xm-band'; b.setAttribute('role', 'note'); b.setAttribute('data-laufband', '');
    b.innerHTML = '<div class="xm-lauf">' + '<span>' + svg + text + svg + '</span>' + '</div>';
    var nav = document.querySelector('nav');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(b, nav); else document.body.insertBefore(b, document.body.firstChild);
    document.documentElement.style.setProperty('--xm-band', '30px');   // Seiten mit Vollhoehe ziehen das Band ab
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', band); else band();
})();

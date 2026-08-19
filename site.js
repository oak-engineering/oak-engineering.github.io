/* ============================================================
   OAK engineering – gemeinsame Interaktionen
   1) Interaktives Gitter (Canvas #gridCanvas, reagiert auf Maus) + OAK-Signet
   2) Akkordeon (.acc-head öffnet/schließt .acc-item)
   3) Mobiles Menü (Burger) + Dropdown
   4) Seitenkopf schrumpft beim Scrollen (Klasse body.kopf-kompakt)
   ============================================================ */

/* ── 1) Interaktives Gitter ──────────────────────────── */
(function(){
  const canvas = document.getElementById('gridCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const GAP = 32, R = 140, PUSH = 24;
  let w = 0, h = 0, cols = 0, rows = 0, dots = [];
  const mouse = { x: -9999, y: -9999 };

  /* OAK-Signet als halbtransparentes Wasserzeichen hinter dem Gitter.
     Das PNG ist dunkelgruen und waere auf dem dunklen Kopf unsichtbar -> einmalig in ein
     Offscreen-Canvas zeichnen und per 'source-in' hell einfaerben. Nur der Baum-Ausschnitt
     (bbox im 1024x559-PNG), sonst sitzt das Signet klein und ausserhalb der Mitte. */
  const LOGO_BOX = { x: 285, y: 54, w: 454, h: 453 };
  const LOGO_MITTE = parseFloat(canvas.dataset.logoX || '0.5');   // 0..1, je Seite ueberschreibbar
  const LOGO_SKALA = parseFloat(canvas.dataset.logoS || '0.78'); // Anteil der Kopfhoehe
  let logoTint = null, logoWeiss = null;
  const glanz = document.createElement('canvas');   // Zwischenbild fuer das Aufleuchten
  const einfaerben = (farbe) => {
    const o = document.createElement('canvas');
    o.width = LOGO_BOX.w; o.height = LOGO_BOX.h;
    const oc = o.getContext('2d');
    oc.drawImage(logo, LOGO_BOX.x, LOGO_BOX.y, LOGO_BOX.w, LOGO_BOX.h, 0, 0, LOGO_BOX.w, LOGO_BOX.h);
    oc.globalCompositeOperation = 'source-in';
    oc.fillStyle = farbe; oc.fillRect(0, 0, LOGO_BOX.w, LOGO_BOX.h);
    return o;
  };
  const logo = new Image();
  logo.onload = () => { logoTint = einfaerben('#74C69D'); logoWeiss = einfaerben('#FFFFFF'); };
  logo.src = document.querySelector('.nav-logo img')?.getAttribute('src') || 'assets/oak-logo.png';

  function build(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    if(w === 0 || h === 0) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / GAP) + 1;
    rows = Math.ceil(h / GAP) + 1;
    dots = [];
    for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++)
      dots.push({ x: c*GAP, y: r*GAP, bx: c*GAP, by: r*GAP, c, r, glow: 0 });
  }
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows) ? null : dots[r*cols + c];

  function draw(t){
    ctx.clearRect(0, 0, w, h);
    if(logoTint){
      const s = Math.min(h * LOGO_SKALA, w * 0.45);   // skaliert mit dem Kopf, bleibt aber im Bild
      const lx = w * LOGO_MITTE - s / 2, ly = (h - s) / 2;
      ctx.globalAlpha = 0.14;
      ctx.drawImage(logoTint, lx, ly, s, s);
      ctx.globalAlpha = 1;
      /* Weisses Aufleuchten dort, wo der Zeiger steht: das weisse Signet wird mit einem
         radialen Verlauf am Mauszeiger ausgestanzt und darueber gelegt. */
      if(logoWeiss && mouse.x > -9000 && s > 0){
        if(glanz.width !== Math.round(s)){ glanz.width = Math.round(s); glanz.height = Math.round(s); }
        const g = glanz.getContext('2d');
        g.clearRect(0, 0, glanz.width, glanz.height);
        g.globalCompositeOperation = 'source-over';
        g.drawImage(logoWeiss, 0, 0, glanz.width, glanz.height);
        g.globalCompositeOperation = 'destination-in';
        const mx = mouse.x - lx, my = mouse.y - ly, r = 165;
        const verlauf = g.createRadialGradient(mx, my, 0, mx, my, r);
        verlauf.addColorStop(0, 'rgba(0,0,0,1)');
        verlauf.addColorStop(.55, 'rgba(0,0,0,.45)');
        verlauf.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = verlauf; g.fillRect(0, 0, glanz.width, glanz.height);
        ctx.globalAlpha = 0.75;
        ctx.drawImage(glanz, lx, ly, s, s);
        ctx.globalAlpha = 1;
      }
    }
    for(const d of dots){
      const wave = Math.sin((d.bx + d.by) * 0.01 + t * 0.0006) * 1.8;
      let tx = d.bx, ty = d.by + wave;
      const dx = tx - mouse.x, dy = ty - mouse.y, dist = Math.hypot(dx, dy);
      if(dist < R){
        const f = 1 - dist / R, ang = Math.atan2(dy, dx);
        tx += Math.cos(ang) * f * PUSH; ty += Math.sin(ang) * f * PUSH;
        d.glow = Math.max(d.glow, f);
      }
      d.glow *= 0.9;
      d.x += (tx - d.x) * 0.18; d.y += (ty - d.y) * 0.18;
    }
    ctx.lineWidth = 1;
    for(const d of dots){
      for(const n of [at(d.c+1, d.r), at(d.c, d.r+1)]){
        if(!n) continue;
        const g = Math.max(d.glow, n.glow);
        ctx.strokeStyle = 'rgba(116,198,157,' + (0.05 + g*0.4) + ')';
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(n.x, n.y); ctx.stroke();
      }
    }
    for(const d of dots){
      const g = d.glow;
      ctx.fillStyle = 'rgba(' + Math.round(116+g*120) + ',' + Math.round(198+g*57) + ',' + Math.round(157+g*60) + ',' + (0.3 + g*0.7) + ')';
      ctx.beginPath(); ctx.arc(d.x, d.y, 1.3 + g*2.2, 0, 6.2832); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if(x >= 0 && y >= 0 && x <= rect.width && y <= rect.height){ mouse.x = x; mouse.y = y; }
    else { mouse.x = -9999; mouse.y = -9999; }
  });
  let rt;
  const neuAufbauen = () => { clearTimeout(rt); rt = setTimeout(build, 150); };
  window.addEventListener('resize', neuAufbauen);
  /* Der Kopf schrumpft beim Scrollen -> das Canvas aendert seine Hoehe ohne Fenster-Resize.
     Ohne Rebuild wuerde das Gitter dabei gestaucht. */
  if(window.ResizeObserver) new ResizeObserver(neuAufbauen).observe(canvas);
  build();
  requestAnimationFrame(draw);
})();

/* ── 2) Akkordeon ────────────────────────────────────── */
document.addEventListener('click', e => {
  const head = e.target.closest('.acc-head');
  if(!head) return;
  const item = head.closest('.acc-item');
  const open = item.classList.contains('open');
  // optional: andere offen lassen (kein Auto-Close) – Klavier-Stil mit Mehrfach-Öffnen
  item.classList.toggle('open', !open);
  head.setAttribute('aria-expanded', String(!open));
});

/* ── 3) Mobiles Menü (Burger) + Dropdown „Leistungen" ── */
document.addEventListener('click', e => {
  // Dropdown „Leistungen" auf-/zuklappen (Klick/Touch)
  const ddBtn = e.target.closest('.nav-dd-btn');
  if(ddBtn){ ddBtn.closest('.nav-dd').classList.toggle('open'); return; }
  const burger = e.target.closest('.nav-burger');
  if(burger){
    /* Der Menue-Knopf sitzt nicht mehr nur im Kopf, sondern auch als „Mehr" in der
       Fussleiste – und die ist selbst ein <nav>. Nur im eigenen <nav> zu suchen fand
       dort nichts; die Liste gibt es je Seite ohnehin genau einmal. */
    const eigenesNav = burger.closest('nav');
    const links = (eigenesNav && eigenesNav.querySelector('.nav-links'))
               || document.querySelector('.nav-links');
    if(links){ links.classList.toggle('open');
      document.body.classList.toggle('nav-offen', links.classList.contains('open')); }
    return;
  }
  // Klick außerhalb schließt offene Dropdowns
  if(!e.target.closest('.nav-dd')) document.querySelectorAll('.nav-dd.open').forEach(d => d.classList.remove('open'));
  // Menü schließen, wenn ein Navigationslink geklickt wird (nicht beim Tippen in die Suche)
  const link = e.target.closest('.nav-links a');
  if(link){ const l = link.closest('.nav-links'); if(l) l.classList.remove('open'); document.body.classList.remove('nav-offen'); }
  // Klick auf die Abdunklung neben dem Drawer schliesst das Menue
  if(document.body.classList.contains('nav-offen') && !e.target.closest('.nav-links') && !e.target.closest('.nav-burger')){
    document.querySelectorAll('.nav-links.open').forEach(l => l.classList.remove('open'));
    document.body.classList.remove('nav-offen');
  }
});

/* ── 4) Titelbalken faehrt ein, wenn der Kopf weggescrollt ist ──
   Eigenes fixed-Element statt eines schrumpfenden sticky-Kopfes: dessen Hoehenaenderung
   verkuerzt das Dokument, die Umschaltschwelle kippt hin und her und die Ueberschrift zittert. */
(function(){
  /* Im Kundenportal nicht: dort traegt die Seite einen eigenen, dauerhaften Kopf, und der
     gruene Farbbalken gehoert allein zur Anmeldeseite. Nach dem Anmelden wird die
     ausgeblendet – ein Titelbalken dafuer waere nur noch ein Streifen ueber dem Inhalt. */
  if(/\/portal\//.test(location.pathname)) return;
  const hero = document.querySelector('.sub-hero');
  const h1 = hero && hero.querySelector('h1');
  if(!hero || !h1 || !window.IntersectionObserver) return;

  const balken = document.createElement('div');
  balken.className = 'kopf-balken';
  balken.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = h1.textContent.trim();
  balken.appendChild(text);
  document.body.appendChild(balken);

  /* Bewusst mit Hysterese (einblenden < 100px, ausblenden > 150px): ohne den toten Bereich
     schaltet der Balken bei jeder kleinen Hoehenaenderung – z. B. wenn ein Akkordeon auf-
     oder zuklappt – hin und her, und die Ueberschrift wackelt. */
  let laeuft = false;
  const pruefen = () => {
    laeuft = false;
    /* Ist der Kopf gar nicht eingeblendet, gibt es auch nichts zu ersetzen. Ohne diese
       Pruefung meldet ein ausgeblendeter Kopf die Unterkante 0 – das las sich wie
       „ganz weggescrollt", und der Titelbalken fuhr ein und legte sich ueber den Inhalt.
       Im Kundenportal passierte genau das nach dem Anmelden: dort wird der Login-Bereich
       samt seinem Kopf versteckt, und „Kundenportal" klebte ueber der Ueberschrift. */
    if(!hero.getClientRects().length){
      document.body.classList.remove('kopf-fest');
      return;
    }
    const unten = hero.getBoundingClientRect().bottom;
    const fest = document.body.classList.contains('kopf-fest');
    if(!fest && unten < 100) document.body.classList.add('kopf-fest');
    else if(fest && unten > 150) document.body.classList.remove('kopf-fest');
  };
  const anstossen = () => { if(!laeuft){ laeuft = true; requestAnimationFrame(pruefen); } };
  window.addEventListener('scroll', anstossen, { passive: true });
  window.addEventListener('resize', anstossen);
  pruefen();
})();

/* ── 5) Tab Bar: feste Fussleiste auf schmalen Geraeten ──
   Auf dem Handy fuehrte jeder Weg ueber den Burger oben rechts. Jetzt klebt unten eine
   Leiste, deren Reiter immer an derselben Stelle stehen – dasselbe Muster wie in den
   Feld-Tools (tools/OAK_Begehungsbogen.html, .fussblock). Sichtbarkeit regelt allein das
   CSS (nav.css, ab 900px aus); hier wird nur gebaut.
   Bewusst per JS eingehaengt: das <nav>-Markup liegt elfmal kopiert in den Seiten, ein
   zwoelfter Block waere die naechste Quelle fuer Auseinanderlaufen. */
(function(){
  const SVG = {
    haus:    '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
    raster:  '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    brief:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m21 7-9 6-9-6"/>',
    menue:   '<path d="M4 7h16M4 12h16M4 17h16"/>',
    tafel:   '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    warnung: '<path d="M12 3.5 2.8 20h18.4L12 3.5z"/><path d="M12 10v4.2M12 17.4h.01"/>',
    schloss: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    /* Leistungsseiten – dieselben Symbole wie im Drawer, damit nichts zweierlei aussieht */
    schild:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    blattIco:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    chip:    '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
    buch:    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
  };
  /* Nur die fest verdrahteten SVG-Pfade kommen als Markup ins Dokument. Jeder Text –
     auch Beschriftungen, die aus dem Portal gelesen werden – geht ueber textContent. */
  function icoEl(n){
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = SVG[n] || '';
    return s;
  }

  const imPortal = /\/portal\//.test(location.pathname);
  const datei = location.pathname.split('/').pop() || 'index.html';
  const LEISTUNGSSEITEN = ['arbeitssicherheit.html','umweltschutz.html','ki-digitalisierung.html','schulungen.html'];

  /* Vor der Anmeldung kann der Kunde nichts abrufen – der Mitarbeiter aber melden.
     Deshalb traegt der Anmeldeschirm eine eigene, kurze Leiste. */
  const ZIELE_WEBSITE = [
    { href:'index.html',   label:'Start',      ico:'haus'   },
    { id:'leistungen',     label:'Leistungen', ico:'raster' },
    { href:'kontakt.html', label:'Kontakt',    ico:'brief'  }
  ];
  const ZIELE_PORTAL_AN = [
    { id:'ueberblick', label:'Übersicht', ico:'tafel'   },
    { id:'bereiche',   label:'Bereiche',  ico:'raster'  },
    { id:'vorfaelle',  label:'Vorfälle',  ico:'warnung' }
  ];
  const ZIELE_PORTAL_AUS = [
    { id:'anmelden',      label:'Anmelden', ico:'schloss' },
    { href:'melden.html', label:'Melden',   ico:'warnung' }
  ];

  /* ── Leiste bauen ── */
  const leiste = document.createElement('nav');
  leiste.className = 'tabbar-fest';
  leiste.setAttribute('aria-label', 'Hauptbereiche');
  const reihe = document.createElement('div');
  reihe.className = 'tb-reihe';
  leiste.appendChild(reihe);

  function fuellen(ziele){
    reihe.textContent = '';
    ziele.forEach(z => {
      const k = document.createElement(z.href ? 'a' : 'button');
      k.className = 'tab-i';
      if(z.href){ k.href = z.href; } else { k.type = 'button'; k.dataset.blatt = z.id; }
      k.dataset.ziel = z.href || z.id;
      const t = document.createElement('span');
      t.textContent = z.label;
      k.appendChild(icoEl(z.ico));
      k.appendChild(t);
      reihe.appendChild(k);
    });
    /* „Mehr" traegt bewusst die Klasse nav-burger: der bestehende Handler weiter oben
       oeffnet damit denselben Drawer – keine zweite Menue-Logik daneben. */
    const mehr = document.createElement('button');
    mehr.type = 'button';
    mehr.className = 'tab-i nav-burger';
    mehr.setAttribute('aria-label', 'Weitere Punkte');
    const mt = document.createElement('span');
    mt.textContent = 'Mehr';
    mehr.appendChild(icoEl('menue'));
    mehr.appendChild(mt);
    reihe.appendChild(mehr);
    aktivSetzen();
  }

  /* ── Aktiven Reiter markieren ── */
  function aktivSetzen(){
    if(document.body.classList.contains('tb-blatt-auf')) return;
    reihe.querySelectorAll('.tab-i').forEach(t => t.classList.remove('on'));
    let treffer = null;
    if(imPortal){
      if(reihe.querySelector('[data-ziel="anmelden"]')){
        treffer = reihe.querySelector('[data-ziel="anmelden"]');
      } else {
        /* Das Portal ist eine einzige Seite – der aktive Reiter folgt dem geoeffneten
           Unterbereich, nicht der Adresse. Cockpit heisst ck-…, Meldungen vf-… */
        const sub = document.querySelector('#subTabs .sub-tab.aktiv');
        const kat = sub ? (sub.dataset.sub || '') : '';
        treffer = kat.indexOf('vf-') === 0 ? reihe.querySelector('[data-ziel="vorfaelle"]')
                : kat.indexOf('ck-') === 0 ? reihe.querySelector('[data-ziel="ueberblick"]')
                : null;
      }
    } else if(LEISTUNGSSEITEN.indexOf(datei) >= 0){
      treffer = reihe.querySelector('[data-ziel="leistungen"]');
    } else {
      treffer = reihe.querySelector('[data-ziel="' + datei + '"]');
    }
    if(treffer) treffer.classList.add('on');
  }

  /* ── Auswahlblatt (faehrt von unten hoch, sitzt auf der Leiste auf) ── */
  let blatt = null;
  function blattZu(){
    if(!blatt) return;
    blatt.classList.remove('auf');
    document.body.classList.remove('tb-blatt-auf');
    aktivSetzen();
  }
  /* eintraege: [{href, ico, text, domZiel?}] – Text immer per textContent */
  function blattAuf(titel, eintraege, knopf){
    if(!blatt){
      blatt = document.createElement('div');
      blatt.className = 'tb-blatt';
      document.body.appendChild(blatt);
    }
    blatt.textContent = '';
    const h = document.createElement('h2');
    h.textContent = titel;
    blatt.appendChild(h);
    eintraege.forEach(e => {
      const a = document.createElement('a');
      a.href = e.href;
      if(e.domZiel) a.dataset.domZiel = e.domZiel;
      a.appendChild(icoEl(e.ico));
      a.appendChild(document.createTextNode(e.text));
      blatt.appendChild(a);
    });
    /* Erst im naechsten Frame die Klasse setzen: sonst sieht der Browser das Element
       im selben Durchgang neu UND geoeffnet – der Uebergang faellt aus, es springt. */
    requestAnimationFrame(() => {
      blatt.classList.add('auf');
      document.body.classList.add('tb-blatt-auf');
    });
    reihe.querySelectorAll('.tab-i').forEach(t => t.classList.remove('on'));
    knopf.classList.add('on');
  }

  document.body.appendChild(leiste);
  fuellen(imPortal ? ZIELE_PORTAL_AUS : ZIELE_WEBSITE);

  /* Die Leiste am sichtbaren Ausschnitt halten, nicht am Layout-Viewport.
     Beim Seitenaufruf faehrt die Browser-Adressleiste unten in voller Hoehe aus; ein
     Element mit „bottom:0" steckt dann dahinter und taucht erst beim Scrollen auf –
     genau das war zu beheben. Dieselbe Rechnung faengt spaeter die Tastatur ab.
     Der Begehungsbogen filtert dort bewusst mit diff>90, um NUR die Tastatur zu
     erwischen; hier soll gerade auch der kleine Betrag der Adressleiste wirken. */
  if(window.visualViewport){
    const vv = window.visualViewport;
    let laeuft = false;
    const messen = () => {
      laeuft = false;
      const verdeckt = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--tb-versatz', Math.round(verdeckt) + 'px');
    };
    const anstossen = () => { if(!laeuft){ laeuft = true; requestAnimationFrame(messen); } };
    vv.addEventListener('resize', anstossen);
    vv.addEventListener('scroll', anstossen);
    window.addEventListener('orientationchange', anstossen);
    messen();
  }

  /* Das Portal blendet #appView per Klasse „hidden" um – daran haengt sich die Leiste,
     statt den Anmeldezustand ein zweites Mal zu erraten. */
  if(imPortal){
    const app = document.getElementById('appView');
    if(app){
      let warAn = null;
      const stand = () => {
        const an = !app.classList.contains('hidden');
        if(an === warAn) return;
        warAn = an;
        fuellen(an ? ZIELE_PORTAL_AN : ZIELE_PORTAL_AUS);
      };
      new MutationObserver(stand).observe(app, { attributes:true, attributeFilter:['class'] });
      stand();
    }
    /* Der aktive Reiter folgt dem Unterbereich – der wechselt auch ohne Zutun der Leiste. */
    const subs = document.getElementById('subTabs');
    if(subs) new MutationObserver(() => aktivSetzen()).observe(subs, { childList:true, subtree:true });
  }

  /* ── Klicks ── */
  document.addEventListener('click', e => {
    // Klick auf die Abdunklung neben dem Blatt schliesst es
    if(document.body.classList.contains('tb-blatt-auf')
       && !e.target.closest('.tb-blatt') && !e.target.closest('.tab-i')){ blattZu(); return; }

    // Auswahl im Bereiche-Blatt: den echten Portal-Reiter ausloesen
    const dz = e.target.closest('[data-dom-ziel]');
    if(dz){
      e.preventDefault();
      const echt = document.querySelector('#katTabs .kat-tab[data-dom="' + dz.dataset.domZiel + '"]');
      if(echt) echt.click();
      blattZu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if(e.target.closest('.tb-blatt a')){ blattZu(); return; }

    const k = e.target.closest('.tab-i[data-blatt]');
    if(!k) return;

    // Zweiter Druck auf denselben Reiter schliesst wieder
    if(document.body.classList.contains('tb-blatt-auf') && k.classList.contains('on')){ blattZu(); return; }

    if(k.dataset.blatt === 'leistungen'){
      blattAuf('Leistungen', [
        { href:'arbeitssicherheit.html',  ico:'schild',   text:'Arbeitssicherheit' },
        { href:'umweltschutz.html',       ico:'blattIco', text:'Umweltschutz' },
        { href:'ki-digitalisierung.html', ico:'chip',     text:'KI & Digitalisierung' },
        { href:'schulungen.html',         ico:'buch',     text:'Schulungen' }
      ], k);

    } else if(k.dataset.blatt === 'bereiche'){
      /* Die Bereiche stehen bereits als Reiter im Portal – von dort lesen und beim
         Antippen den vorhandenen Reiter ausloesen. So bleibt die Portal-Logik die eine
         Wahrheit, statt die Bereichsliste hier ein zweites Mal zu pflegen. */
      const tabs = Array.prototype.slice.call(document.querySelectorAll('#katTabs .kat-tab'));
      if(!tabs.length) return;
      blattAuf('Bereiche', tabs.map(t => ({
        href: '#', ico: 'raster', domZiel: t.dataset.dom,
        /* Der Reiter fuehrt hinter dem Label noch einen Zaehler – nur das Label uebernehmen. */
        text: (t.childNodes[0] && t.childNodes[0].textContent || t.textContent || '').trim()
      })), k);

    } else if(k.dataset.blatt === 'ueberblick' || k.dataset.blatt === 'vorfaelle'){
      const praefix = k.dataset.blatt === 'vorfaelle' ? 'vf-' : 'ck-';
      const ziel = document.querySelector('#subTabs .sub-tab[data-sub^="' + praefix + '"]');
      if(ziel) ziel.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      aktivSetzen();

    } else if(k.dataset.blatt === 'anmelden'){
      const feld = document.querySelector('#loginView input[type="email"], #loginView input');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if(feld) feld.focus();
    }
  });

  document.addEventListener('keydown', e => { if(e.key === 'Escape') blattZu(); });
})();

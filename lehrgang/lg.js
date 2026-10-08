/* Lehrgang-Umfragen – gemeinsame Funktionen für Teilnehmer-, Live- und Referentenseite.
   Eigene Namen (LG_*, lg*) – kein Konflikt mit portal/auth.js (CFG, esc), das referent.html zusätzlich lädt.
   Der publishable Key ist öffentlich by design; Schreibrechte regelt RLS (Antworten nur bei offener Frage,
   alles andere nur Admin). Es werden keine personenbezogenen Daten erhoben. */
"use strict";
const LG_URL = "https://ayieotppxrjrzdpeofkx.supabase.co";
const LG_KEY = "sb_publishable_fz1o6tjpwa7gjiNb17uuEg_-ZwNdFcS";

function lgEsc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function lgParam(name){ return new URLSearchParams(location.search).get(name) || ""; }

async function lgGet(pfad){
  const r = await fetch(LG_URL + "/rest/v1/" + pfad, { cache: "no-store", headers: { apikey: LG_KEY } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function lgPost(tabelle, daten){
  const r = await fetch(LG_URL + "/rest/v1/" + tabelle, {
    method: "POST",
    headers: { apikey: LG_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(daten) });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Die Umfrage ist geschlossen." : "Senden fehlgeschlagen (" + r.status + ").");
}
async function lgFrage(id){ const d = await lgGet("lg_frage?id=eq." + encodeURIComponent(id) + "&select=*"); return d[0] || null; }
async function lgAntworten(id){ return lgGet("lg_antwort?frage=eq." + encodeURIComponent(id) + "&select=wert,erstellt&order=erstellt.asc&limit=2000"); }

function lgZahl(s){ const t = String(s).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); const n = parseFloat(t); return isFinite(n) ? n : null; }
function lgFmt(n){ return (Math.round(n * 100) / 100).toLocaleString("de-DE"); }
function lgNorm(s){ return String(s).trim().replace(/\s+/g, " "); }

/* Ergebnis-Darstellung (Live-Seite und Referentenansicht) */
function lgErgebnisHTML(frage, antworten, mitLoesung){
  const n = antworten.length;
  let h = '<p class="lg-anzahl">' + n + (n === 1 ? " Antwort" : " Antworten") + "</p>";
  if (!n) return h + '<p class="lg-leer">Noch keine Antworten.</p>';
  if (frage.typ === "zahl"){
    const w = antworten.map(a => lgZahl(a.wert)).filter(v => v != null).sort((a, b) => a - b);
    if (w.length){
      const med = w.length % 2 ? w[(w.length - 1) / 2] : (w[w.length / 2 - 1] + w[w.length / 2]) / 2;
      const e = frage.einheit ? " " + lgEsc(frage.einheit) : "";
      h += '<div class="lg-kennz"><div><b>' + lgFmt(med) + e + "</b><span>Median</span></div>"
         + "<div><b>" + lgFmt(w[0]) + e + "</b><span>kleinste</span></div>"
         + "<div><b>" + lgFmt(w[w.length - 1]) + e + "</b><span>größte</span></div></div>";
      h += lgHistogramm(w, frage.einheit);
    }
  } else if (frage.typ === "auswahl" || frage.typ === "mehrfach"){
    const opt = Array.isArray(frage.optionen) ? frage.optionen : [];
    const z = {}; opt.forEach(o => z[o] = 0);
    antworten.forEach(a => { z[a.wert] = (z[a.wert] || 0) + 1; });
    const max = Math.max(1, ...Object.values(z));
    h += '<div class="lg-balken">' + Object.keys(z).map(k =>
      '<div class="lg-b"><span class="lg-bl">' + lgEsc(k) + '</span><span class="lg-bb"><i style="width:' + (z[k] / max * 100) + '%"></i></span><span class="lg-bz">' + z[k] + "</span></div>").join("") + "</div>";
  } else {
    const z = {}, anzeige = {};
    antworten.forEach(a => { const k = lgNorm(a.wert).toLowerCase(); z[k] = (z[k] || 0) + 1; anzeige[k] = anzeige[k] || lgNorm(a.wert); });
    const max = Math.max(...Object.values(z));
    const liste = Object.keys(z).sort((a, b) => z[b] - z[a] || a.localeCompare(b, "de"));
    h += '<div class="lg-wolke">' + liste.map(k => {
      const g = 1 + (z[k] - 1) / Math.max(1, max - 1) * 1.2;
      return '<span style="font-size:' + g.toFixed(2) + 'em">' + lgEsc(anzeige[k]) + (z[k] > 1 ? " <small>×" + z[k] + "</small>" : "") + "</span>"; }).join("") + "</div>";
  }
  if (mitLoesung && frage.loesung) h += '<div class="lg-loesung"><b>Auflösung:</b> ' + lgEsc(frage.loesung) + "</div>";
  return h;
}

function lgHistogramm(w, einheit){
  const min = w[0], max = w[w.length - 1];
  if (min === max) return "";
  const k = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(w.length))));
  const breite = (max - min) / k;
  const fach = new Array(k).fill(0);
  w.forEach(v => { fach[Math.min(k - 1, Math.floor((v - min) / breite))]++; });
  const top = Math.max(...fach);
  return '<div class="lg-hist">' + fach.map((c, i) =>
    '<div class="lg-h"><i style="height:' + (c / top * 100) + '%"></i><span>' + lgFmt(min + i * breite) + "–" + lgFmt(min + (i + 1) * breite) + "</span><em>" + c + "</em></div>").join("") + "</div>";
}

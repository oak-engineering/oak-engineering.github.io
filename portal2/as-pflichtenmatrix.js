/* OAK EHS-Cockpit – Pflichtenmatrix Arbeitsschutz (Organisation › Pflichten & Verantwortung, Stufe 18, 25.11.2026).
   Der Betrieb pflegt Funktionen, Pflichten und Zuordnungen selbst (ohne OAK, ohne KI). Daten: as_pflicht_funktion, as_pflicht,
   as_pflichtenmatrix (SQL references/vorlagen/supabase/stufe18_pflichtenmatrix_2026-11-25.sql), Standardkatalog AS_KAT.pflichtenmatrix
   (references/prozesse/app_kataloge.json). Eine Quelle: Maßnahmen, Mängel, Termine und Prüfobjekte verweisen über funktion_id auf
   eine Funktion; Personenwechsel zieht der Datenbank-Trigger in alle offenen Einträge nach (auch V1).
   Globale Namen nur mit asPm/AS_PM. */
"use strict";

const AS_PM = { gruppe: "", ackFrei: false };
const AS_PM_CODES = ["V", "K", "M", "B", "I"];
const AS_PM_ZYKLUS = { gf: ["", "V", "K", "M", "I"], linie: ["", "V", "M", "B", "I"], beratend: ["", "B", "M", "I", "V"] };
const AS_PM_KURZLEG = "V verantwortlich · K GF behält Gesamtverantwortung, kontrolliert · M wirkt mit · B berät · I wird informiert";

function asPmKat(){ return (typeof AS_KAT !== "undefined" && AS_KAT.pflichtenmatrix) || { funktionen: [], gruppen: [], codes: {}, hinweise: [], befugnisse: [], bezug: {} }; }
function asPmFunktionen(mitArchiv){ return asT("as_pflicht_funktion").filter(f => mitArchiv || !f.archiviert).sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name), "de")); }
function asPmPflichten(){ return asT("as_pflicht").filter(p => !p.archiviert).sort((a, b) => String(a.gruppe).localeCompare(String(b.gruppe)) || (a.sort || 0) - (b.sort || 0)); }
function asPmMatrix(){ return asT("as_pflichtenmatrix")[0] || null; }
function asPmGruppeTitel(g){ const x = asPmKat().gruppen.find(y => y.id === g); return x ? x.titel : g; }
function asPmQuelle(f){ const k = asPmKat().funktionen.find(x => x.k === f.schluessel); return k ? k.quelle || "" : ""; }
/* Person einer Funktion: eigener Eintrag, sonst aus der vorhandenen Quelle (Grunddaten bzw. Beauftragte) – nichts doppelt erfassen */
function asPmPerson(f){
  if(!f) return "";
  if(f.person && String(f.person).trim()) return String(f.person).trim();
  const q = asPmQuelle(f), d = asOrgDaten();
  if(q === "sibe"){ const h = asHeute(); return asT("as_beauftragter").filter(b => b.funktion === "sibe" && (!b.gueltig_bis || b.gueltig_bis >= h)).map(b => b.person).join(", "); }
  return q && d[q] && !/^(extern|sifa|geschäftsführung)\b/i.test(d[q]) ? String(d[q]) : "";
}
function asPmText(f){ if(!f) return ""; const p = asPmPerson(f); return f.name + (p ? " (" + p + ")" : ""); }
// Nur erlaubte Kürzel – codes kommt aus der DB und landet ungeschützt in Klassen, Zellen und Druck (XSS-Schutz 25.11.2026)
function asPmCode(p, f){ const c = ((p && p.codes) || {})[f.id]; return AS_PM_CODES.includes(c) ? c : ""; }
function asPmMitCode(p, codes){ return asPmFunktionen().filter(f => codes.includes(asPmCode(p, f))); }

/* Plausibilitätsprüfung – Hinweis, keine Sperre */
function asPmHinweise(p){
  const fs = asPmFunktionen(), v = fs.filter(f => asPmCode(p, f) === "V"), h = [];
  if(!v.length) h.push("Keine Funktion verantwortlich (V)");
  else if(v.length > 1) h.push(v.length + " Funktionen verantwortlich – Abgrenzung (Bereich/Schicht) im Übertragungsschreiben festlegen");
  v.filter(f => f.art === "beratend").forEach(f => h.push(f.name + " berät nur und übernimmt keine Unternehmerpflichten (§§ 3, 6 ASiG, § 22 SGB VII)"));
  return h;
}
function asPmAlleHinweise(){ return asPmPflichten().map(p => ({ p, h: asPmHinweise(p) })).filter(x => x.h.length); }

/* ---------------- Reiter Organisation › Pflichten ---------------- */
function asOrgPflichten(box){
  const m = asPmMatrix(), fs = asPmFunktionen(), ps = asPmPflichten(), darf = asDarf("pflegen");
  if(!m && !ps.length){
    box.innerHTML = `<div class="karte"><h2>Pflichtenmatrix</h2>
      <div class="leer">Noch keine Pflichtenmatrix angelegt. Sie legt fest, welche Funktion welche Arbeitsschutzpflicht wahrnimmt (§ 13 ArbSchG) –
        Grundlage für die schriftlichen Übertragungen.${darf ? `<br><br><button class="btn klein" id="pmKat">OAK-Standardkatalog übernehmen</button>` : ""}</div></div>`;
    const k = box.querySelector("#pmKat"); if(k) k.onclick = async () => { k.disabled = true; try{ await asPmKatalogUebernehmen(); asZeige(); }catch(e){ asMeldung("Fehler: " + e.message); k.disabled = false; } };
    return;
  }
  const alt = box.querySelector(".pm-wrap"), pos = alt ? [alt.scrollTop, alt.scrollLeft] : [0, 0];
  const frei = m && m.status === "freigegeben", hw = asPmAlleHinweise();
  const sicht = ps.filter(p => !AS_PM.gruppe || p.gruppe === AS_PM.gruppe);
  const gruppen = [...new Set(sicht.map(p => p.gruppe))];
  const zelle = (p, f) => { const c = asPmCode(p, f);
    return `<td class="pm-c"><button type="button" class="pm-code${c ? " pm-" + c : ""}" data-z="${esc(p.id)}|${esc(f.id)}" ${darf ? "" : "disabled"} title="${esc(f.name + ": " + (c ? (asPmKat().codes[c] || c) : "nicht beteiligt"))}">${c || "·"}</button></td>`; };
  box.innerHTML = `<div class="karte pm-karte"><h2>Pflichtenmatrix ${frei ? `<span class="chip c-gruen" title="${esc("freigegeben am " + asDat(m.freigegeben_am) + " durch " + (m.freigegeben_von || "–"))}">freigegeben ${asDat(m.freigegeben_am)}</span>` : asChip("Entwurf", "gelb")}
      <span>${!frei && asDarf("freigeben") ? `<button class="btn klein" id="pmFrei">Freigeben</button>` : ""}
        <button class="btn sek klein" id="pmSchreiben"><span class="pm-l">Übertragungsschreiben</span><span class="pm-k">Schreiben</span></button><button class="btn sek klein" id="pmDruck"><span class="pm-l">Matrix drucken</span><span class="pm-k">Drucken</span></button>
        ${darf ? `<button class="btn sek klein" id="pmNeuP">+ Pflicht</button><button class="btn sek klein" id="pmNeuF">+ Funktion</button>` : ""}</span></h2>
    <div class="filterleiste">${asFilterWahl('id="pmGruppe"', AS_PM.gruppe, [["", "alle"]].concat(asPmKat().gruppen.map(g => [g.id, g.id + " " + g.titel])), "Gruppe")}
      ${hw.length ? `<button type="button" class="chip c-gelb pm-hwk" id="pmHw" title="Plausibilitätsprüfung anzeigen">${hw.length} Hinweise</button>` : asChip("plausibel", "gruen")}
      <span class="pm-leg" title="${esc(asPmKat().legende || AS_PM_KURZLEG)}">${esc(AS_PM_KURZLEG)}</span><span class="pm-leg pm-leg-k" title="${esc(asPmKat().legende || AS_PM_KURZLEG)}">V verantw. · K kontrolliert · M wirkt mit · B berät · I info</span></div>
    <div class="pm-wrap"><table class="pm-tab"><thead><tr><th class="pm-p">Pflicht · Rechtsgrundlage</th>
      ${fs.map(f => `<th class="pm-f" data-fn="${esc(f.id)}" title="${esc(asPmText(f) + " – zum Bearbeiten anklicken")}"><b>${esc(asPmKurz(f))}</b><small>${esc(asPmPerson(f) || "Person offen")}</small></th>`).join("")}</tr></thead>
      <tbody>${gruppen.map(g => `<tr class="pm-g"><td class="pm-p" colspan="${fs.length + 1}"><b>${esc(g)} · ${esc(asPmGruppeTitel(g))}</b></td></tr>`
        + sicht.filter(p => p.gruppe === g).map(p => { const h = asPmHinweise(p);
          return `<tr><td class="pm-p" data-p="${esc(p.id)}" title="${esc(p.text + (p.recht ? " – " + p.recht : "") + (h.length ? "\nHinweis: " + h.join("; ") : ""))}">
            <span class="pm-t">${h.length ? asPunkt("gelb") : ""}${esc(p.text)}</span><small>${esc(p.recht || "–")}</small></td>${fs.map(f => zelle(p, f)).join("")}</tr>`; }).join("")).join("")
        || `<tr><td class="pm-p" colspan="${fs.length + 1}"><div class="leer">Keine Pflichten in dieser Gruppe.</div></td></tr>`}</tbody></table></div></div>`;
  const wrap = box.querySelector(".pm-wrap"); wrap.scrollTop = pos[0]; wrap.scrollLeft = pos[1];
  asPmHoeheSpaeter(); if(!AS_PM.resize){ AS_PM.resize = true; window.addEventListener("resize", asPmHoehe); }
  box.querySelector("#pmGruppe").onchange = ev => { AS_PM.gruppe = ev.target.value; asOrgPflichten(box); };
  const hk = box.querySelector("#pmHw"); if(hk) hk.onclick = () => asPmHinweisDialog();
  const fr = box.querySelector("#pmFrei"); if(fr) fr.onclick = () => asPmFreigeben();
  box.querySelector("#pmSchreiben").onclick = () => asPmSchreibenListe();
  box.querySelector("#pmDruck").onclick = () => asPmDruckMatrix();
  const np = box.querySelector("#pmNeuP"); if(np) np.onclick = () => asPmPflichtDialog(null);
  const nf = box.querySelector("#pmNeuF"); if(nf) nf.onclick = () => asPmFunktionDialog(null);
  box.querySelectorAll("[data-fn]").forEach(th => th.onclick = () => asPmFunktionDialog(asNach("as_pflicht_funktion", th.dataset.fn)));
  box.querySelectorAll("[data-p]").forEach(td => td.onclick = () => asPmPflichtDialog(asNach("as_pflicht", td.dataset.p)));
  box.querySelectorAll("[data-z]").forEach(b => b.onclick = () => { const [pid, fid] = b.dataset.z.split("|"); asPmZelle(box, pid, fid); });
}
function asPmKurz(f){ const k = asPmKat().funktionen.find(x => x.k === f.schluessel); return k && k.name === f.name ? k.kurz : (String(f.name).length > 14 ? String(f.name).slice(0, 13) + "…" : f.name); }
/* Seite scrollt nicht – nur die Matrix (PC 1400×900, Handy 390×844) */
function asPmHoehe(){
  const w = document.querySelector(".pm-wrap"); if(!w) return;
  const main = document.getElementById("haupt"), karte = w.closest(".karte");
  const unten = (parseFloat(getComputedStyle(main).paddingBottom) || 0) + (parseFloat(getComputedStyle(karte).paddingBottom) || 0) + (parseFloat(getComputedStyle(karte).marginBottom) || 0);
  const top = w.getBoundingClientRect().top + window.scrollY;
  let h = Math.max(240, Math.floor(window.innerHeight - top - unten - 2));
  w.style.height = h + "px";
  const ueber = document.documentElement.scrollHeight - window.innerHeight;   // Banner/Seitenkopf, die später erscheinen
  if(ueber > 0 && h > 240){ h = Math.max(240, h - ueber); w.style.height = h + "px"; }
}
function asPmHoeheSpaeter(){ asPmHoehe(); requestAnimationFrame(asPmHoehe); setTimeout(asPmHoehe, 250); setTimeout(asPmHoehe, 900); }

async function asPmNachladen(){
  await asNachladen(["as_pflicht_funktion", "as_pflicht", "as_pflichtenmatrix"]);
  const o = await apiGet("/rest/v1/as_organisation?select=*&kunde_slug=eq." + encodeURIComponent(AS.kunde)).catch(() => null);
  if(o && o[0]) AS.org = o[0];
}
async function asPmFreigabeHinweis(){
  const m = asPmMatrix();
  if(!m || m.status !== "freigegeben" || AS_PM.ackFrei) return true;
  if(!confirm("Die Pflichtenmatrix ist freigegeben. Jede Änderung setzt sie auf Entwurf zurück; die Geschäftsführung muss neu freigeben.\n\nFortfahren?")) return false;
  AS_PM.ackFrei = true; return true;
}
async function asPmZelle(box, pid, fid){
  if(!asDarf("pflegen")) return;
  const p = asNach("as_pflicht", pid), f = asNach("as_pflicht_funktion", fid); if(!p || !f) return;
  if(!await asPmFreigabeHinweis()) return;
  const z = AS_PM_ZYKLUS[f.art] || AS_PM_ZYKLUS.linie, alt = asPmCode(p, f);
  const neu = z[(Math.max(0, z.indexOf(alt)) + 1) % z.length];
  const codes = Object.assign({}, p.codes || {}); if(neu) codes[fid] = neu; else delete codes[fid];
  const war = asPmMatrix() && asPmMatrix().status;
  p.codes = codes; asOrgPflichten(box);   // sofort zeigen, dann speichern
  try{ await asSpeichern("as_pflicht", { id: pid, codes }); }
  catch(e){ asMeldung("Nicht gespeichert: " + e.message); p.codes = Object.assign({}, p.codes); await asPmNachladen(); }
  if(war === "freigegeben" || f.schreiben_status === "unterschrieben"){ await asPmNachladen(); }
  asOrgPflichten(box);
}

/* ---------------- Dialoge ---------------- */
function asPmNurLesen(dl){ if(!asDarf("pflegen")) dl.querySelectorAll(".dlg-inhalt input, .dlg-inhalt select, .dlg-inhalt textarea").forEach(x => x.disabled = true); }
function asPmFunktionDialog(f){
  const neu = !f, darf = asDarf("pflegen");
  f = f || { art: "linie", sort: (asPmFunktionen(true).reduce((n, x) => Math.max(n, x.sort || 0), 0) + 10) };
  const q = asPmQuelle(f), ps = asPmPflichten();
  const v = ps.filter(p => asPmCode(p, f) === "V"), mm = ps.filter(p => asPmCode(p, f) === "M");
  const st = { offen: ["Schreiben offen", "rot"], neu: ["neu zu unterschreiben", "gelb"], unterschrieben: ["unterschrieben " + asDat(f.uebertragen_am), "gruen"] }[f.schreiben_status || "offen"];
  const kn = [];
  if(!neu && darf) kn.push({ t: "Archivieren", klasse: "sek", fn: async () => {
    if(!confirm(v.length ? "„" + f.name + "“ ist für " + v.length + " Pflichten verantwortlich (V). Nach dem Archivieren ist dort niemand mehr eingetragen.\n\nArchivieren?" : "„" + f.name + "“ archivieren?")) return false;
    await asSpeichern("as_pflicht_funktion", { id: f.id, archiviert: true });
    const m = asPmMatrix(); if(m && m.status === "freigegeben") await asSpeichern("as_pflichtenmatrix", { id: m.id, status: "entwurf" });
    await asPmNachladen(); asZeige(); } });
  if(!neu && f.art !== "gf") kn.push({ t: "Schreiben drucken", klasse: "sek", fn: () => { asPmDruckSchreiben([f]); return false; } });
  if(!neu && darf && f.art !== "gf" && f.schreiben_status !== "unterschrieben") kn.push({ t: "Als unterschrieben vermerken", klasse: "sek", fn: async () => {
    if(!asPmPerson(f)){ asMeldung("Erst eine Person eintragen."); return false; }
    const am = prompt("Unterschrieben am (TT.MM.JJJJ):", asDat(asHeute())); if(am == null) return false;
    const t = String(am).trim().split("."); const iso = t.length === 3 ? t[2].padStart(4, "20") + "-" + t[1].padStart(2, "0") + "-" + t[0].padStart(2, "0") : asHeute();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)){ asMeldung("Datum bitte als TT.MM.JJJJ"); return false; }
    await asSpeichern("as_pflicht_funktion", { id: f.id, schreiben_status: "unterschrieben", uebertragen_am: iso, person: f.person || asPmPerson(f) || null });
    await asPmNachladen(); asMeldung("Übertragung vermerkt" + ((AS.org && AS.org.daten && AS.org.daten.pflichten_am) ? " – Nachweis „Pflichten schriftlich übertragen“ gesetzt" : "")); asZeige(); } });
  if(darf) kn.push({ t: "Speichern", fn: async d => {
    const w = asWerte(d); if(!w.name){ asMeldung("Bezeichnung fehlt"); return false; }
    if(q === "sibe") delete w.person;
    const altP = asPmPerson(f);
    if(!neu && altP && (w.person || "") !== altP && "person" in w
       && !confirm("Personenwechsel: Die Übertragung an " + altP + " gilt damit als beendet. Ein neues Übertragungsschreiben wird fällig und die Matrix muss neu freigegeben werden.\n\nFortfahren?")) return false;
    w.budget_eur = w.budget_eur == null ? null : w.budget_eur;
    await asSpeichern("as_pflicht_funktion", Object.assign({ id: f.id }, neu ? { schluessel: null, sort: f.sort } : {}, w));
    /* Person der Geschäftsführung / Sifa / Betriebsarzt steht auch in den Grunddaten – eine Quelle, beide Stellen gleich */
    if(q && q !== "sibe" && "person" in w && (asOrgDaten()[q] || "") !== (w.person || "")) await asOrgSpeichern({ [q]: w.person || null });
    await asPmNachladen(); await asNachladen(["as_massnahme", "as_pruefobjekt"]); asZeige(); } });
  const dl = asDialog({ titel: neu ? "Neue Funktion" : f.name, breit: true, inhalt: `${neu ? "" : `<p>${asChip(st[0], st[1])} <span class="hinweis">${v.length} Pflichten verantwortlich · ${mm.length} Mitwirkungen</span></p>`}
    <div class="form">${asFeld("Bezeichnung der Funktion", "name", f.name, "text", "voll")}
      ${asAuswahl("Art", "art", f.art, [["gf", "Geschäftsführung (Unternehmer)"], ["linie", "Führungskraft / Linie"], ["beratend", "beratend (Sifa, Betriebsarzt, SiBe)"]])}
      ${q === "sibe" ? `<label>Person(en)<input type="text" value="${esc(asPmPerson(f))}" disabled></label>`
        : `<label>Person<input type="text" data-f="person" list="asPmPersonen" value="${esc(f.person || asPmPerson(f) || "")}" autocomplete="off"></label>`}
      <datalist id="asPmPersonen">${(AS.personen || []).map(p => `<option value="${esc(p.name)}">`).join("")}</datalist>
      ${asFeld("Vertretung", "vertretung", f.vertretung)}
      ${asFeld("Verantwortungsbereich (Bereich, Schicht)", "bereich", f.bereich)}
      ${asBereichWahl("Einheit der Organisation (optional)", "einheit_id", f.einheit_id || "", "", "– ganzer Betrieb –")}
      ${asFeld("Budgetgrenze je Einzelfall in €", "budget_eur", f.budget_eur, "number")}</div>
    ${q === "sibe" ? `<p class="hinweis">Sicherheitsbeauftragte werden unter Organisation › Beauftragte gepflegt und hier übernommen.</p>` : q ? `<p class="hinweis">Die Person steht auch in den Grunddaten und wird dort mitgeändert.</p>` : ""}
    ${(f.verlauf || []).length ? `<h3>Beendete Übertragungen</h3><div class="zeilen">${f.verlauf.slice().reverse().map(x => `<div class="z"><div><b>${esc(x.person || "")}</b><small>${x.uebertragen_am ? "unterschrieben " + asDat(x.uebertragen_am) + " · " : ""}beendet ${asDat(x.bis)}</small></div></div>`).join("")}</div>` : ""}`,
    knoepfe: kn });
  asPmNurLesen(dl);
}
function asPmPflichtDialog(p){
  const neu = !p, darf = asDarf("pflegen"); p = p || { gruppe: AS_PM.gruppe || "A", codes: {} };
  const kn = [];
  if(!neu && darf) kn.push({ t: "Archivieren", klasse: "sek", fn: async () => {
    if(!confirm("Pflicht „" + p.text + "“ aus der Matrix nehmen?")) return false;
    if(!await asPmFreigabeHinweis()) return false;
    await asSpeichern("as_pflicht", { id: p.id, archiviert: true }); await asPmNachladen(); asZeige(); } });
  if(darf) kn.push({ t: "Speichern", fn: async d => { const w = asWerte(d); if(!w.text){ asMeldung("Pflicht fehlt"); return false; }
    if(neu) w.sort = asPmPflichten().filter(x => x.gruppe === w.gruppe).reduce((n, x) => Math.max(n, x.sort || 0), 0) + 10;
    await asSpeichern("as_pflicht", Object.assign({ id: p.id }, neu ? { codes: {} } : {}, w)); asZeige(); } });
  const zeile = (t, codes) => { const l = asPmMitCode(p, codes); return `<div class="z"><div><b>${t}</b><small>${l.map(f => esc(asPmText(f))).join(" · ") || "–"}</small></div></div>`; };
  const h = neu ? [] : asPmHinweise(p);
  const dl = asDialog({ titel: neu ? "Neue Pflicht" : "Pflicht", breit: true, inhalt: `<div class="form">
      ${asAuswahl("Gruppe", "gruppe", p.gruppe, asPmKat().gruppen.map(g => [g.id, g.id + " · " + g.titel]))}
      ${asFeld("Rechtsgrundlage", "recht", p.recht)}
      ${asFeld("Pflicht", "text", p.text, "textarea", "voll")}</div>
    ${neu ? `<p class="hinweis">Die Zuordnung zu den Funktionen erfolgt danach direkt in der Matrix (Feld antippen).</p>`
      : `<div class="zeilen">${zeile("Verantwortlich", ["V"])}${zeile("Gesamtverantwortung / Kontrolle", ["K"])}${zeile("Wirkt mit", ["M"])}${zeile("Berät, wird informiert", ["B", "I"])}</div>
        ${h.length ? `<p>${h.map(x => asChip(x, "gelb")).join(" ")}</p>` : ""}`}`, knoepfe: kn });
  asPmNurLesen(dl);
}
function asPmHinweisDialog(){
  const l = asPmAlleHinweise();
  asDialog({ titel: "Plausibilitätsprüfung", breit: true, inhalt: `<p class="hinweis">Hinweise, keine Sperre. Je Pflicht sollte genau eine Funktion verantwortlich sein; Fachkraft für Arbeitssicherheit,
      Betriebsarzt und Sicherheitsbeauftragte beraten nur (§§ 3, 6 ASiG, § 22 SGB VII).</p>
    <div class="zeilen">${l.map(x => `<div class="z" data-p="${esc(x.p.id)}"><div><b>${esc(x.p.gruppe)} · ${esc(x.p.text)}</b><small>${x.h.map(esc).join(" · ")}</small></div></div>`).join("") || `<div class="leer">Keine Hinweise.</div>`}</div>` });
  document.querySelectorAll("#dlg [data-p]").forEach(z => z.onclick = () => asPmPflichtDialog(asNach("as_pflicht", z.dataset.p)));
}
async function asPmFreigeben(){
  const m = asPmMatrix(); if(!m || !asDarf("freigeben")) return;
  const n = asPmAlleHinweise().length;
  if(!confirm("Pflichtenmatrix freigeben?" + (n ? "\n\nHinweis: " + n + " Punkte der Plausibilitätsprüfung sind offen." : "")
    + "\n\nDie jährliche Überprüfung im ASA wird als Termin angelegt. Der Nachweis „Pflichten schriftlich übertragen“ gilt, sobald alle Übertragungsschreiben unterschrieben sind.")) return;
  try{ await asSpeichern("as_pflichtenmatrix", { id: m.id, status: "freigegeben" }); }
  catch(e){ asMeldung("Nicht freigegeben: " + e.message); return; }
  AS_PM.ackFrei = false; await asPmNachladen();
  asMeldung("Freigegeben – Wiedervorlage " + asDat((asPmMatrix() || {}).wiedervorlage_am) + " im Kalender"); asZeige();
}
function asPmSchreibenListe(){
  const fs = asPmFunktionen().filter(f => f.art !== "gf"), ps = asPmPflichten();
  const st = f => ({ offen: ["offen", "rot"], neu: ["neu zu unterschreiben", "gelb"], unterschrieben: ["unterschrieben " + asDat(f.uebertragen_am), "gruen"] }[f.schreiben_status || "offen"]);
  asDialog({ titel: "Übertragungsschreiben", breit: true, inhalt: `<p class="hinweis">Je Funktion ein Schreiben nach § 13 Abs. 2 ArbSchG und § 13 DGUV Vorschrift 1 – übertragen werden die Pflichten mit V in der Spalte der Funktion.
      Unterschriebene Schreiben hier vermerken; ändert sich die Matrix oder die Person, wird das Schreiben neu fällig.</p>
    <div class="zeilen">${fs.map(f => { const s = st(f), v = ps.filter(p => asPmCode(p, f) === "V").length, mm = ps.filter(p => asPmCode(p, f) === "M").length;
      return `<div class="z" data-fn="${esc(f.id)}"><div><b>${esc(asPmText(f))}</b><small>${v} übertragene Pflichten · ${mm} Mitwirkungen${f.bereich ? " · " + esc(f.bereich) : ""}</small></div>${asChip(s[0], s[1])}</div>`; }).join("")}</div>`,
    knoepfe: [{ t: "Alle drucken", klasse: "sek", fn: () => { asPmDruckSchreiben(fs.filter(f => ps.some(p => ["V", "M"].includes(asPmCode(p, f))))); return false; } }] });
  document.querySelectorAll("#dlg [data-fn]").forEach(z => z.onclick = () => asPmFunktionDialog(asNach("as_pflicht_funktion", z.dataset.fn)));
}

/* ---------------- Standardkatalog übernehmen (idempotent) ---------------- */
async function asPmKatalogUebernehmen(){
  const kat = asPmKat(), d = asOrgDaten(), ids = {};
  const vorh = asPmFunktionen(true);
  for(const [i, k] of kat.funktionen.entries()){
    let f = vorh.find(x => x.schluessel === k.k);
    if(!f){ const pers = k.quelle && k.quelle !== "sibe" && d[k.quelle] && !/^(extern|sifa|geschäftsführung)\b/i.test(d[k.quelle]) ? d[k.quelle] : null;
      f = await asSpeichern("as_pflicht_funktion", { schluessel: k.k, name: k.name, art: k.art, person: pers, sort: (i + 1) * 10 }); }
    ids[k.k] = f.id;
  }
  const da = new Set(asT("as_pflicht").map(p => p.katalog_id).filter(Boolean));
  for(const g of kat.gruppen) for(const [i, p] of g.pflichten.entries()){
    if(da.has(p.id)) continue;
    const codes = {}; Object.entries(p.codes || {}).forEach(([k, c]) => { if(ids[k]) codes[ids[k]] = c; });
    await asSpeichern("as_pflicht", { gruppe: g.id, katalog_id: p.id, text: p.text, recht: p.recht, codes, sort: (i + 1) * 10 });
  }
  if(!asPmMatrix()) await asSpeichern("as_pflichtenmatrix", { status: "entwurf" });
  await asPmNachladen();
  asMeldung("Standardkatalog übernommen – bitte Personen eintragen und Zuordnungen prüfen");
}

/* Grunddaten geändert (Geschäftsführung, Sifa, Betriebsarzt) → Person der Funktion gleichziehen */
async function asPmQuelleAbgleich(){
  if(!asT("as_pflicht_funktion").length) return;
  const d = asOrgDaten();
  for(const f of asPmFunktionen()){ const q = asPmQuelle(f); if(!q || q === "sibe" || !(q in d)) continue;
    const w = d[q] && !/^(extern|sifa|geschäftsführung)\b/i.test(d[q]) ? d[q] : null;
    if(w && (f.person || "") !== w) await asSpeichern("as_pflicht_funktion", { id: f.id, person: w }).catch(() => {}); }
}

/* ---------------- Eine Quelle: Auswahl der Funktion in anderen Dialogen ----------------
   asPmWahl(...) liefert Auswahl „Funktion (Person)“ + Freitext. Ohne Pflichtenmatrix bleibt es beim Freitext.
   asSpeichern übernimmt bei gesetzter funktion_id den Text (as_massnahme, as_pruefobjekt); Termine/Mängel rufen asPmUebernehmen. */
const AS_PM_TEXTFELD = { as_massnahme: "verantwortlich", as_pruefobjekt: "pruefer" };
function asPmWahl(label, textFeld, textWert, fid, bezug, extra){
  const fs = asPmFunktionen();
  if(!fs.length) return asFeld(label, textFeld, textWert, "text", extra || "");
  return `<label class="${extra || ""}">${esc(label)} – Funktion<select data-f="funktion_id" data-pm-bezug="${esc(bezug || "")}" data-pm-text="${esc(textFeld)}">
      <option value="">– keine Funktion, frei eintragen –</option>${fs.map(f => `<option value="${esc(f.id)}" ${f.id === fid ? "selected" : ""}>${esc(asPmText(f))}</option>`).join("")}</select></label>
    <label class="${extra || ""}">${esc(label)}<input type="text" data-f="${esc(textFeld)}" value="${esc(textWert || "")}" ${fid && asNach("as_pflicht_funktion", fid) ? "readonly" : ""}></label>
    <p class="hinweis voll pm-hwz" ${fid ? "" : "hidden"}>${esc(asPmPlausibel(fid, bezug))}</p>`;
}
function asPmPlausibel(fid, bezug){
  const f = asNach("as_pflicht_funktion", fid), kid = asPmKat().bezug[bezug]; if(!f || !kid) return "";
  const p = asT("as_pflicht").find(x => x.katalog_id === kid && !x.archiviert); if(!p) return "";
  const c = asPmCode(p, f); if(["V", "K"].includes(c)) return "";
  const v = asPmMitCode(p, ["V"]).map(asPmText).join(", ");
  return "Hinweis: Laut Pflichtenmatrix ist für „" + p.text + "“ verantwortlich: " + (v || "niemand eingetragen")
    + " – „" + f.name + "“ " + (c ? ({ M: "wirkt nur mit", B: "berät nur", I: "wird nur informiert" }[c]) : "ist dort nicht eingetragen") + ".";
}
function asPmUebernehmen(w, textFeld){
  if(!w || !("funktion_id" in w)) return w;
  const f = w.funktion_id ? asNach("as_pflicht_funktion", w.funktion_id) : null;
  if(f) w[textFeld] = asPmText(f); else w.funktion_id = null;
  return w;
}
document.addEventListener("change", ev => {
  const s = ev.target; if(!s || !s.matches || !s.matches("select[data-pm-bezug]")) return;
  const dl = s.closest(".dlg-inhalt") || document, t = dl.querySelector(`input[data-f="${s.dataset.pmText}"]`), h = dl.querySelector(".pm-hwz");
  const f = s.value ? asNach("as_pflicht_funktion", s.value) : null;
  if(t){ if(f){ t.value = asPmText(f); t.readOnly = true; } else t.readOnly = false; }
  if(h){ const x = f ? asPmPlausibel(f.id, s.dataset.pmBezug) : ""; h.textContent = x; h.hidden = !x; }
});

/* ---------------- Druck (A4, Kundenmarke) ---------------- */
function asPmMarke(){
  const m = (AS.kundeV1 && AS.kundeV1.marke) || {};
  const logo = m.logo && typeof asMarkeLogoUrl === "function" ? new URL(asMarkeLogoUrl(m.logo), location.href).href : "";
  const farbe = /^#[0-9a-fA-F]{3,8}$/.test(m.farbe || "") ? m.farbe : "#2D6A4F";
  return { logo, farbe, firma: (AS.kundeV1 && AS.kundeV1.name) || (AS.org && AS.org.name) || "" };
}
function asPmDokument(titel, inhalt, quer, fuss){
  const mk = asPmMarke();
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Jost:wght@400;500;600&display=swap" rel="stylesheet">
<style>
@page{size:A4 ${quer ? "landscape" : "portrait"};margin:14mm 16mm 16mm;
  @bottom-left{content:"${String(fuss).replace(/["\\<>\n]/g, " ")}";font-family:Jost,Arial,sans-serif;font-size:7.5pt;color:#5B6675}
  @bottom-right{content:"Seite " counter(page) " von " counter(pages);font-family:Jost,Arial,sans-serif;font-size:7.5pt;color:#5B6675}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Jost,Arial,sans-serif;font-size:9.5pt;color:#1E2A3A;line-height:1.4;background:#fff}
.seite{break-after:page}.seite:last-child{break-after:auto}
.kopf{display:flex;justify-content:space-between;align-items:flex-end;gap:12mm;border-bottom:2px solid ${mk.farbe};padding-bottom:6px;margin-bottom:8px}
.kopf img{max-height:14mm;max-width:55mm;object-fit:contain}
h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:19pt;color:${mk.farbe};line-height:1.1}
h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:12.5pt;color:${mk.farbe};margin:9px 0 4px;break-after:avoid}
.unter{color:#5B6675;font-size:9pt}
p{margin:0 0 5px}
.block{break-inside:avoid}
table{width:100%;border-collapse:collapse;break-inside:avoid;margin-bottom:5px}
th{background:${mk.farbe};color:#fff;font-weight:600;font-size:8.3pt;text-align:left;padding:3px 5px;vertical-align:bottom}
td{border-bottom:1px solid #D5DEEA;padding:3px 5px;vertical-align:top}
table.meta td{border:0;padding:1px 10px 1px 0}table.meta td:first-child{color:#5B6675;width:44mm}
td.n{width:8mm;color:#5B6675}td.rq{width:55mm;color:#5B6675;font-size:8.3pt}
td.c{text-align:center;font-weight:600;width:17mm}td.cV{background:#E8EEF5}th.c{text-align:center}
ul{padding-left:5mm}li{margin:1px 0}
.unterschrift{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:16mm;break-inside:avoid}
.unterschrift div{border-top:1px solid #1E2A3A;padding-top:3px;font-size:8.3pt;color:#5B6675}
.leiste{position:sticky;top:0;background:#F4F6F8;padding:8px 12px;margin:-14mm -16mm 10px;display:flex;gap:10px;align-items:center;font-size:10pt}
.leiste button{font:inherit;padding:6px 14px;border-radius:16px;border:1px solid ${mk.farbe};background:${mk.farbe};color:#fff;cursor:pointer}
@media screen{body{padding:14mm 16mm;max-width:${quer ? "297mm" : "210mm"};margin:0 auto}}
@media print{.leiste{display:none}}
</style></head><body><div class="leiste"><button onclick="window.print()">Drucken / als PDF speichern</button><span>${esc(titel)}</span></div>${inhalt}</body></html>`;
}
function asPmKopf(titel, unter){ const mk = asPmMarke();
  return `<div class="kopf"><div><h1>${esc(titel)}</h1><div class="unter">${esc(unter)}</div></div>${mk.logo ? `<img src="${esc(mk.logo)}" alt="Logo">` : `<b>${esc(mk.firma)}</b>`}</div>`; }
function asPmOeffnen(html){
  const w = window.open("", "_blank");
  if(!w){ asMeldung("Bitte Pop-ups für das Cockpit erlauben."); return null; }
  w.document.open(); w.document.write(html); w.document.close(); return w;
}
function asPmStandText(){ const m = asPmMatrix();
  return m && m.status === "freigegeben" ? "freigegeben am " + asDat(m.freigegeben_am) + (m.freigegeben_von ? " durch " + m.freigegeben_von : "") : "Entwurf, Stand " + asDat(asHeute()); }
function asPmMatrixHtml(){
  const fs = asPmFunktionen(), ps = asPmPflichten(), kat = asPmKat(), mk = asPmMarke(), gfF = fs.find(x => x.art === "gf"), gfN = gfF ? asPmPerson(gfF) : "";
  let nr = 0;
  const tabellen = [...new Set(ps.map(p => p.gruppe))].map(g => `<table><thead><tr><th class="n">Nr.</th><th>${esc(g)} · ${esc(asPmGruppeTitel(g))}</th><th>Rechtsgrundlage</th>${fs.map(f => `<th class="c">${esc(asPmKurz(f))}</th>`).join("")}</tr></thead><tbody>
    ${ps.filter(p => p.gruppe === g).map(p => { nr++; return `<tr><td class="n">${nr}</td><td>${esc(p.text)}</td><td class="rq">${esc(p.recht || "")}</td>${fs.map(f => { const c = asPmCode(p, f); return `<td class="c${c === "V" ? " cV" : ""}">${c}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table>`).join("");
  const inhalt = `<div class="seite">${asPmKopf("Pflichtenmatrix Arbeitsschutz", "Zuordnung der Unternehmerpflichten zu den Funktionen · Grundlage der schriftlichen Pflichtenübertragungen")}
    <table class="meta"><tr><td>Unternehmen</td><td>${esc(mk.firma)}</td></tr><tr><td>Stand</td><td>${esc(asPmStandText())}</td></tr>
      <tr><td>Funktionen</td><td>${fs.map(f => esc(asPmKurz(f) + " = " + asPmText(f))).join(" · ")}</td></tr></table>
    <h2>1. Matrix</h2><p class="unter">${esc(kat.legende || AS_PM_KURZLEG)}</p>${tabellen}
    <div class="block"><h2>2. Hinweise</h2><ul>${(kat.hinweise || []).map(h => `<li>${esc(h)}</li>`).join("")}</ul></div>
    <div class="block"><h2>3. Freigabe</h2><p>Die Matrix wurde mit den genannten Funktionen abgestimmt und wird hiermit freigegeben.</p>
      <div class="unterschrift"><div>Ort, Datum · Geschäftsführung${gfN ? " (" + esc(gfN) + ")" : ""}</div><div>Ort, Datum · Kenntnisnahme Arbeitsschutzausschuss</div></div></div></div>`;
  return asPmDokument("Pflichtenmatrix Arbeitsschutz", inhalt, true, mk.firma + " · Pflichtenmatrix Arbeitsschutz · " + asPmStandText());
}
function asPmDruckMatrix(){ asPmOeffnen(asPmMatrixHtml()); }
function asPmSchreibenSeite(f){
  const ps = asPmPflichten(), d = asOrgDaten(), mk = asPmMarke(), kat = asPmKat();
  const v = ps.filter(p => asPmCode(p, f) === "V"), mm = ps.filter(p => asPmCode(p, f) === "M");
  const name = asPmPerson(f), gf = (asPmFunktionen().find(x => x.art === "gf") || null);
  const gfName = gf ? asPmPerson(gf) : "";
  const budget = f.budget_eur != null && f.budget_eur !== "" ? Number(f.budget_eur).toLocaleString("de-DE") + " € (netto) je Einzelfall" : "nach Absprache mit der Geschäftsführung";
  const liste = (l, leer) => l.length ? `<table><thead><tr><th class="n">Nr.</th><th>Pflicht</th><th>Rechtsgrundlage</th></tr></thead><tbody>${l.map((p, i) => `<tr><td class="n">${i + 1}</td><td>${esc(p.text)}</td><td class="rq">${esc(p.recht || "")}</td></tr>`).join("")}</tbody></table>` : `<p>${leer}</p>`;
  const beratend = f.art === "beratend";
  const bef = beratend ? [] : (kat.befugnisse || []).map(b => !/Budgetgrenze/.test(b) ? b : f.budget_eur != null && f.budget_eur !== ""
    ? b.replace("bis zur genannten Budgetgrenze", "bis " + budget.replace(" je Einzelfall", ""))
    : "Befugnis, Aufträge für Arbeitsschutzmaßnahmen nach Absprache mit der Geschäftsführung zu erteilen; bei Gefahr im Verzug sind die nötigen Sofortmaßnahmen zu veranlassen");
  return `<div class="seite">${asPmKopf(beratend ? "Festlegung von Aufgaben im Arbeitsschutz" : "Übertragung von Unternehmerpflichten im Arbeitsschutz",
      beratend ? "auf Grundlage der Pflichtenmatrix Arbeitsschutz" : "nach § 13 Abs. 2 ArbSchG und § 13 DGUV Vorschrift 1")}
    <table class="meta"><tr><td>Unternehmen</td><td>${esc(mk.firma)}</td></tr>
      <tr><td>Funktion</td><td>${esc(f.name)}</td></tr><tr><td>Name</td><td>${esc(name || "____________________________")}</td></tr>
      <tr><td>Verantwortungsbereich</td><td>${esc(f.bereich || (f.einheit_id ? asEinheitName(f.einheit_id) : "gesamter Betrieb"))}</td></tr>
      <tr><td>Vertretung</td><td>${esc(f.vertretung || "____________________________")}</td></tr>
      ${beratend ? "" : `<tr><td>Budgetgrenze</td><td>${esc(budget)}</td></tr>`}
      <tr><td>Grundlage</td><td>Pflichtenmatrix Arbeitsschutz, ${esc(asPmStandText())}</td></tr></table>
    <div class="block"><h2>1. ${beratend ? "Festlegung" : "Übertragung"}</h2>
      <p>${beratend
        ? `Die Geschäftsführung der ${esc(mk.firma)} legt für die Funktion „${esc(f.name)}“ die nachstehenden Aufgaben im Arbeitsschutz fest. Die Funktion berät und unterstützt; Unternehmerpflichten werden nicht übertragen (§§ 3, 6 ASiG, § 22 SGB VII).`
        : `Die Geschäftsführung der ${esc(mk.firma)} überträgt ${name ? esc(name) : "der/dem Beauftragten"} in der Funktion „${esc(f.name)}“ für den genannten Verantwortungsbereich die nachstehenden Pflichten des Arbeitgebers im Arbeitsschutz zur Wahrnehmung in eigener Verantwortung (§ 13 Abs. 2 ArbSchG, § 13 DGUV Vorschrift 1).`}</p></div>
    <div class="block"><h2>2. ${beratend ? "Verantwortlich wahrzunehmende Aufgaben" : "Übertragene Pflichten"}</h2>${liste(v, "Keine Pflichten zur eigenverantwortlichen Wahrnehmung.")}</div>
    <div class="block"><h2>3. Mitwirkung</h2>${liste(mm, "Keine Mitwirkungsaufgaben festgelegt.")}</div>
    ${bef.length ? `<div class="block"><h2>4. Befugnisse</h2><ul>${bef.map(b => `<li>${esc(b)}</li>`).join("")}</ul></div>` : ""}
    <div class="block"><h2>${bef.length ? 5 : 4}. Hinweise</h2><ul>
      <li>Die Gesamtverantwortung für den Arbeitsschutz verbleibt bei der Geschäftsführung (§ 3 ArbSchG). Übertragen wird die Wahrnehmung der genannten Pflichten in eigener Verantwortung, nicht die Verantwortung als solche.</li>
      <li>Die Fachkraft für Arbeitssicherheit und der Betriebsarzt stehen beratend zur Verfügung (§§ 3, 6 ASiG).</li>
      <li>Die Übertragung gilt bis auf Widerruf oder bis zum Wechsel der Funktion. Änderungen der Pflichtenmatrix werden schriftlich nachgetragen.</li>
      <li>Die Wahrnehmung der übertragenen Pflichten wird regelmäßig, mindestens jährlich im Arbeitsschutzausschuss, überprüft.</li></ul></div>
    <div class="unterschrift"><div>Ort, Datum · Geschäftsführung${gfName ? " (" + esc(gfName) + ")" : ""}</div><div>Ort, Datum · ${esc(name || "Beauftragte(r)")} – Kenntnisnahme und Übernahme</div></div></div>`;
}
function asPmSchreibenHtml(fs){
  const mk = asPmMarke();
  return asPmDokument(fs.length === 1 ? "Übertragungsschreiben " + fs[0].name : "Übertragungsschreiben", fs.map(asPmSchreibenSeite).join(""), false,
    mk.firma + " · Pflichtenübertragung Arbeitsschutz · " + asPmStandText());
}
function asPmDruckSchreiben(fs){ if(!fs.length){ asMeldung("Keine Funktion mit übertragenen Pflichten."); return; } asPmOeffnen(asPmSchreibenHtml(fs)); }

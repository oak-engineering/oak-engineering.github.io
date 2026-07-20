/* OAK Kundenportal — Login-Ansicht + Anlagenübersicht. Nutzt auth.js (vorher geladen). */
"use strict";
const $ = s => document.querySelector(s);
function zurLogin(){ $("#appView").classList.add("hidden"); $("#loginView").classList.remove("hidden"); }
function zurApp(){ $("#loginView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

function ampelKlasse(st){
  if(!st || !st.gesamt) return "grau";
  if((st.offen||0)===0) return "gruen";
  if(st.band==="hoch") return "rot";
  return "orange";
}
function docLink(row, typ, label, extra){
  if(!(row.typen||[]).includes(typ)) return "";
  const q = "viewer.html?p="+encodeURIComponent(row.docdata_path)+"&typ="+encodeURIComponent(typ)
    +"&m="+encodeURIComponent(row.maschine||"")+"&mid="+encodeURIComponent(row.maschinen_id||"");
  return `<a class="${extra||""}" href="${q}" target="_blank" rel="noopener">${label}</a>`;
}

let ALLE = [];
function render(){
  const q = ($("#suche").value||"").toLowerCase().trim();
  const tf = $("#typFilter").value;
  const rows = ALLE.filter(r => (!tf || r.maschinentyp===tf) &&
    (!q || (r.maschine||"").toLowerCase().includes(q) || (r.maschinen_id||"").toLowerCase().includes(q)));
  const tb = $("#liste");
  if(!rows.length){ tb.innerHTML = `<tr><td colspan="5" class="leer">keine Anlagen</td></tr>`; }
  else tb.innerHTML = rows.map(r => `<tr>
      <td><span class="ampel ${ampelKlasse(r.status)}" title="${esc((r.status&&r.status.band)||"—")}"></span></td>
      <td>${esc(r.maschine)}</td><td>${esc(r.maschinentyp||"–")}</td><td>${esc(r.maschinen_id)}</td>
      <td class="docs">${docLink(r,"bda","GBU","gbu")}${docLink(r,"ba","BA")}${docLink(r,"maengelliste","Mängel")}${docLink(r,"protokoll","Protokoll")}</td>
    </tr>`).join("");
  $("#zaehler").textContent = rows.length + " von " + ALLE.length + " Anlagen";
}

async function ladeUebersicht(){
  const s = getSession();
  $("#userMail").textContent = (s && s.user && s.user.email) || "";
  try{
    const rows = await apiGet("/rest/v1/portal_dokumente?select=*&order=maschine.asc", false);
    ALLE = rows || [];
    if(ALLE.length) $("#kundeName").textContent = ALLE[0].kunde || "";
    const typen = [...new Set(ALLE.map(r=>r.maschinentyp).filter(Boolean))].sort();
    $("#typFilter").innerHTML = '<option value="">Alle Maschinentypen</option>' +
      typen.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
    render();
  }catch(e){
    if(e.message==="AUTH"){ zurLogin(); return; }
    $("#liste").innerHTML = `<tr><td colspan="5" class="leer">Fehler: ${esc(e.message)}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("#loginForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn=$("#loginBtn"); btn.disabled=true; $("#loginFehler").textContent="";
    try{ await login($("#email").value.trim(), $("#pass").value); $("#pass").value="";
      zurApp(); await ladeUebersicht(); }
    catch(e){ $("#loginFehler").textContent = /Invalid login|invalid_grant/i.test(e.message) ? "E-Mail oder Passwort falsch." : e.message; }
    finally{ btn.disabled=false; }
  });
  $("#logoutBtn").addEventListener("click", ()=>{ clearSession(); ALLE=[]; zurLogin(); });
  $("#suche").addEventListener("input", render);
  $("#typFilter").addEventListener("change", render);

  const t = await token();
  if(t){ zurApp(); await ladeUebersicht(); } else { zurLogin(); }
});

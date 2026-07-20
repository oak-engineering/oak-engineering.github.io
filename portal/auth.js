/* OAK Kundenportal — gemeinsame Auth/Session-Primitiven (raw fetch, keine Library, keine CDN).
   Der publishable Key ist öffentlich by design; Zugriff auf Daten erzwingt Login + RLS je Kunde. */
"use strict";
const CFG = {
  url: "https://ayieotppxrjrzdpeofkx.supabase.co",
  anon: "sb_publishable_fz1o6tjpwa7gjiNb17uuEg_-ZwNdFcS",
  sessionKey: "oak_portal_session",
  bucket: "kundendokumente",
};

function getSession(){ try{ return JSON.parse(localStorage.getItem(CFG.sessionKey)||"null"); }catch(e){ return null; } }
function setSession(s){ s.expires_at = Date.now() + (s.expires_in||3600)*1000 - 60000; localStorage.setItem(CFG.sessionKey, JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem(CFG.sessionKey); }

async function authPost(path, body){
  const r = await fetch(CFG.url + path, {
    method:"POST", headers:{ "apikey":CFG.anon, "Content-Type":"application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP "+r.status));
  return d;
}
async function login(email, password){ const d = await authPost("/auth/v1/token?grant_type=password",{email,password}); setSession(d); return d; }
async function refresh(){ const s=getSession(); if(!s||!s.refresh_token) throw new Error("keine Session");
  const d = await authPost("/auth/v1/token?grant_type=refresh_token",{refresh_token:s.refresh_token}); setSession(d); return d; }

async function token(){ let s=getSession(); if(!s) return null;
  if(Date.now()>=(s.expires_at||0)){ try{ await refresh(); s=getSession(); }catch(e){ clearSession(); return null; } }
  return s.access_token; }

/* Authenticated GET (REST oder Storage), einmaliger Refresh-Retry bei 401 -> liefert Response.
   Wirft "AUTH", wenn keine gültige Sitzung -> Aufrufer leitet zum Login. */
async function apiFetch(path){
  let t = await token(); if(!t){ clearSession(); throw new Error("AUTH"); }
  const doFetch = tk => fetch(CFG.url + path, { headers:{ "apikey":CFG.anon, "Authorization":"Bearer "+tk } });
  let r = await doFetch(t);
  if(r.status===401){ try{ await refresh(); t=(getSession()||{}).access_token; r = await doFetch(t); }
    catch(e){ clearSession(); throw new Error("AUTH"); } }
  if(r.status===401){ clearSession(); throw new Error("AUTH"); }
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r;
}
async function apiGet(path, asText){
  const r = await apiFetch(path);
  return asText ? r.text() : r.json();
}

/* Storage-Download (privater Bucket, RLS erzwingt eigenen Kunden-Ordner). Pfad-Segmente encoden, / behalten. */
function storagePfad(docdata_path){
  const seg = String(docdata_path).split("/").map(encodeURIComponent).join("/");
  return "/storage/v1/object/authenticated/" + CFG.bucket + "/" + seg;
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

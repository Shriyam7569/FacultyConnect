/* FacultyConnect — shared history. Saves faculty data, uploaded files and chat history to the
   Postgres database (via /api/data and /api/file) so it is the same on every device.
   If the database is not connected the site silently keeps using this browser's own storage. */
const cloud = { on: null, sigs: {}, timer: null, busy: false, again: false };
const MAX_CLOUD_FILE = 3 * 1024 * 1024;

const _persistLocal = persistData;
persistData = function(){ _persistLocal(); cloudSchedule(); };

function cloudSchedule(){ if(cloud.on === false) return; clearTimeout(cloud.timer); cloud.timer = setTimeout(cloudPush, 1200); }

async function cloudUpload(dataUrl, name){
  const m = /^data:([^;,]+)[^,]*;base64,(.*)$/.exec(dataUrl || '');
  if(!m || m[2].length * 3 / 4 > MAX_CLOUD_FILE) return null;
  try{
    const r = await fetch('/api/file', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, mime:m[1], data:m[2]})});
    if(r.status === 503){ cloud.on = false; return null; }
    return r.ok ? (await r.json()).id : null;
  }catch(e){ return null; }
}
const attMeta = a => ({name:a.name, type:a.type, size:a.size, fileId:a.fileId});
function cloudDoc(f){
  const cleanMsg = m => { const c = {...m}; if(m.attach) c.attach = m.attach.map(attMeta); return c; };
  return {
    uploads: (f.uploads||[]).map(u=>{ const c = {...u}; delete c.fileData; return c; }),
    messages: (f.messages||[]).map(cleanMsg),
    outbox: (f.outbox||[]).map(cleanMsg),
    userAnn: (f.userAnn||[]).map(cleanMsg),
    annDeleted: f.annDeleted || [],
    customQB: f.customQB || []
  };
}
function mergeList(local, srv, keyf){
  const lm = new Map((local||[]).map(x=>[keyf(x), x]));
  const seen = new Set();
  const out = (srv||[]).map(s=>{
    const k = keyf(s); seen.add(k);
    const l = lm.get(k); if(!l) return s;
    const o = {...s};
    if(l.fileData && !s.fileData) o.fileData = l.fileData;
    if(l.attach && s.attach) o.attach = s.attach.map((a,i)=>{ const la = l.attach.find(x=>a.fileId && x.fileId===a.fileId) || l.attach[i]; return la && la.data && !a.data ? {...a, data:la.data} : a; });
    return o;
  });
  (local||[]).forEach(l=>{ if(!seen.has(keyf(l))) out.push(l); });
  return out;
}
const msgId = m => m.id || ((m.ts||m.date||'')+'|'+(m.from||m.to||'')+'|'+(m.subject||''));
function applyDoc(f, d){
  if(!d) return;
  const deleted = [...new Set([...(f.annDeleted||[]), ...(d.annDeleted||[])].map(String))];
  f.annDeleted = deleted;
  f.uploads = mergeList(f.uploads, d.uploads, u=>u.id||u.title);
  f.messages = mergeList(f.messages, d.messages, msgId);
  f.outbox = mergeList(f.outbox, d.outbox, msgId);
  f.userAnn = mergeList(f.userAnn, d.userAnn, a=>a.aid).filter(a=>!deleted.includes(String(a.aid)));
  f.customQB = mergeList(f.customQB, d.customQB, q=>(q.type||'')+'|'+(q.q||''));
}
const docSig = f => JSON.stringify(cloudDoc(f));

async function cloudPush(){
  if(cloud.busy){ cloud.again = true; return; }
  cloud.busy = true; let touched = false;
  try{
    for(const f of FACULTY){
      for(const u of (f.uploads||[])) if(u.fileData && !u.fileId){ const id = await cloudUpload(u.fileData, u.fileName||u.title); if(id){ u.fileId = id; touched = true; } }
      for(const list of [f.messages, f.outbox, f.userAnn]) for(const m of (list||[])){
        if(list !== f.userAnn && !m.id){ m.id = (m.ts||'')+'|'+(m.from||m.to||'')+'|'+(m.subject||'')+'|'+Math.random().toString(36).slice(2,6); touched = true; }
        for(const x of (m.attach||[])) if(x.data && !x.fileId){ const id = await cloudUpload(x.data, x.name); if(id){ x.fileId = id; touched = true; } }
      }
      if(cloud.on === false) return;
      const sig = docSig(f);
      if(cloud.sigs[f.id] === sig) continue;
      const r = await fetch('/api/data', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scope:'faculty', key:f.id, doc:cloudDoc(f)})});
      if(r.status === 503){ cloud.on = false; return; }
      if(r.ok){ cloud.on = true; applyDoc(f, (await r.json()).doc); cloud.sigs[f.id] = docSig(f); touched = true; }
    }
  }catch(e){}
  finally{
    if(touched) _persistLocal();
    cloud.busy = false;
    if(cloud.again){ cloud.again = false; cloudSchedule(); }
  }
}

async function cloudPull(){
  try{
    const r = await fetch('/api/data?scope=faculty');
    if(r.status === 503){ cloud.on = false; return; }
    if(!r.ok) return;
    cloud.on = true;
    const docs = (await r.json()).docs || {};
    const changed = [];
    FACULTY.forEach(f=>{
      const d = docs[f.id]; if(!d) return;
      const before = docSig(f);
      applyDoc(f, d);
      if(docSig(f) !== before) changed.push(f);
    });
    if(changed.length){ _persistLocal(); changed.forEach(f=>{ try{ onFacultyDataChanged(f); }catch(e){} }); }
  }catch(e){}
}

/* chat history (Study agent and Helpdesk), per user */
function pushChat(key, log){
  if(cloud.on === false) return;
  fetch('/api/data', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scope:'chat', key, log})}).catch(()=>{});
}
async function cloudChats(){
  if(cloud.on === false) return;
  for(const kind of ['study','help']){
    const key = kind==='study' ? studyKey() : helpKey();
    try{
      const r = await fetch('/api/data?scope=chat&key='+encodeURIComponent(key));
      if(!r.ok) continue;
      const srv = (await r.json()).log || [];
      let loc = []; try{ loc = JSON.parse(localStorage.getItem(key)||'[]'); }catch(e){}
      if(srv.length > loc.length){
        try{ localStorage.setItem(key, JSON.stringify(srv)); }catch(e){}
        if(kind==='study' && location.hash.indexOf('#/study')===0 && !studyBusy) renderStudy();
        if(kind==='help') renderChatGreeting();
      } else if(loc.length > srv.length) pushChat(key, loc);
    }catch(e){}
  }
}
const _saveStudyLog = saveStudyLog;
saveStudyLog = function(l){ _saveStudyLog(l); pushChat(studyKey(), l.slice(-100)); };
const _saveHelpLog = saveHelpLog;
saveHelpLog = function(l){ _saveHelpLog(l); pushChat(helpKey(), l.slice(-80)); };
const _clearStudyLog = clearStudyLog;
clearStudyLog = function(){ const k = studyKey(); _clearStudyLog(); pushChat(k, []); };
const _clearHelpLog = clearHelpLog;
clearHelpLog = function(){ const k = helpKey(); _clearHelpLog(); pushChat(k, []); };

async function cloudStart(){
  if(!state.loggedIn) return;
  await cloudPull();
  if(cloud.on){ cloudPush(); cloudChats(); }
}
const _boot = boot;
boot = function(){ _boot(); cloudStart(); };
setInterval(()=>{ if(document.visibilityState==='visible' && state.loggedIn && cloud.on===true) cloudPull(); }, 20000);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && state.loggedIn && cloud.on===true) cloudPull(); });
cloudStart();

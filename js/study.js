/* FacultyConnect — study agent (talks to /api/study, which holds the Gemini key server-side) */
let studyMode = 'ask', studyHistory = [], studyBusy = false;
const studyKey = ()=> 'fc_study_'+String(state.name||'').trim().toLowerCase();
function loadStudyLog(){ try{ return JSON.parse(localStorage.getItem(studyKey())||'[]'); }catch(e){ return []; } }
function saveStudyLog(l){ try{ localStorage.setItem(studyKey(), JSON.stringify(l.slice(-100))); }catch(e){} }
function clearStudyLog(){ try{ localStorage.removeItem(studyKey()); }catch(e){} studyHistory = []; renderStudy(); }
const STUDY_MODES = {
  ask:{label:'Ask',q:''}, summary:{label:'Summarise',q:'Summarise this material for revision.'},
  quiz:{label:'Quiz me',q:'Quiz me on this material.'}, cards:{label:'Flashcards',q:'Make flashcards from this material.'},
  explain:{label:'Explain simply',q:'Explain the main idea simply.'}
};
let studyTab = 'teacher', studySel = '';
const TYPE_LABEL = {lecture:'Slides / notes', video:'Video', solutions:'Solutions', paper:'Paper', project:'Project', assignment:'Assignment'};
function studyResources(){
  const out = [];
  FACULTY.forEach(f=> (f.uploads||[]).forEach((u,i)=>{
    const course = (f.teaching||[]).find(t=>t.code===u.course);
    out.push({key:f.id+':'+(u.id||i), date:String(u.date||''), isNew:!String(u.id||'').startsWith('seed-'), uid:u.id, fileId:u.fileId||'', fid:f.id, faculty:f.name, title:u.title, type:u.type, course:u.course||'', courseName:course?course.name:'', note:u.note||'', fileName:u.fileName||'', data:u.fileData||'', f});
  }));
  out.sort((a,b)=> b.date.localeCompare(a.date));
  return out;
}
function resourceContext(r){
  const f = r.f;
  const ls = (f.lectures||[]).map(l=>l.title+': '+l.desc).join('\n');
  const as = (f.assignments||[]).filter(x=>!r.course||x.course===r.course).map(x=>x.title+' — '+x.desc).join('\n');
  const qb = ((f.questionBank||{}).topics||[]).map(t=>t.name).join(', ');
  return 'Teacher resource: '+r.title+' ('+(TYPE_LABEL[r.type]||r.type||'resource')+(r.course?', course '+r.course+(r.courseName?' '+r.courseName:''):'')+') shared by '+r.faculty+'.'+(r.note?' Teacher note: '+r.note:'')+'\n(The original file is not attached, so teach from this description and the course outline below, and say when you are going beyond it.)\nCourse outline:\n'+ls+'\nAssignments:\n'+as+'\nImportant topics: '+qb;
}
function drawStudySrc(){
  const box = document.getElementById('study-src-body'); if(!box) return;
  document.querySelectorAll('.study-tabs button').forEach(b=> b.classList.toggle('active', b.dataset.tab===studyTab));
  drawStudyChip();
  if(studyTab==='teacher'){
    const res = studyResources();
    const groups = {}; res.forEach(r=> (groups[r.faculty] = groups[r.faculty]||[]).push(r));
    box.innerHTML = res.length ? Object.keys(groups).map(n=>`<div class="sr-group"><h5>${esc(n)}</h5>${groups[n].map(r=>`<button type="button" class="sr-item${r.key===studySel?' on':''}" onclick="pickStudyRes('${r.key}')"><span class="sr-type">${esc(TYPE_LABEL[r.type]||'Resource')}${r.isNew?' · new':''}</span><b>${esc(r.title)}</b><i>${r.course?esc(r.course):''}${(r.data||r.fileId)?' · file attached':' · outline'}</i></button>`).join('')}</div>`).join('') : '<p class="study-hint">No teacher resources yet.</p>';
    box.insertAdjacentHTML('beforeend', '<p class="study-hint">Only files and resources shared by your teachers. Pick one, then ask.</p>');
  } else {
    box.innerHTML = attPickerHTML('stu') + '<div class="field"><label for="st-text">Or paste notes</label><textarea id="st-text" rows="5" maxlength="20000" placeholder="Paste text from a lecture, slide or textbook…"></textarea></div><p class="study-hint">PDFs, images and text work best. Word files: save as PDF first.</p>';
  }
}
function pickStudyRes(k){
  studySel = studySel===k ? '' : k; drawStudySrc();
  if(!studySel) return;
  if(studyMode!=='ask') setStudyMode('ask');
  const chat = document.querySelector('.study-chat');
  if(chat) chat.scrollIntoView({behavior:'smooth', block:'nearest'});
  const q = document.getElementById('st-q'); if(q) q.focus({preventScroll:true});
  askStudy('Give a very brief overview in 3-4 short lines: what this material is about and what I will learn from it. Plain sentences only, no headings or lists.', {silent:true});
}
/* the chosen teacher file sits on the chat box like an attachment */
function drawStudyChip(){
  const box = document.getElementById('study-attached'); if(!box) return;
  const r = studyTab==='teacher' && studySel ? studyResources().find(z=>z.key===studySel) : null;
  box.innerHTML = r ? '<span class="att-chip sa-chip"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3"/></svg><b>'+esc(r.title)+'</b><i>'+esc(r.faculty)+((r.data||r.fileId)?' · file':' · outline')+'</i><button type="button" aria-label="Remove" onclick="pickStudyRes(studySel)">×</button></span>' : '';
  box.classList.toggle('hidden', !r);
}
function setStudyTab(t){ studyTab = t; drawStudySrc(); }
function renderStudy(){
  studyHistory = []; studyMode = 'ask'; studySel = ''; studyTab = 'teacher';
  document.getElementById('view-study').innerHTML = `
    <div class="index-head index-head--small"><div><span class="kicker">AI study agent</span><h1 class="sans-display x3d">Study <span class="outline">here.</span></h1>
      <p>Choose material your teachers shared, or bring your own. Ask questions, get a summary, a quiz or flashcards — no downloading, no switching tabs.</p></div></div>
    <div class="study-layout">
      <aside class="panel study-src">
        <h3>Study material</h3>
        <div class="study-tabs"><button type="button" data-tab="teacher" onclick="setStudyTab('teacher')">Teacher's files</button><button type="button" data-tab="own" onclick="setStudyTab('own')">My own material</button></div>
        <div id="study-src-body"></div>
      </aside>
      <section class="study-chat">
        <div class="study-modes" role="tablist">${Object.keys(STUDY_MODES).map(k=>`<button type="button" class="${k===studyMode?'active':''}" data-mode="${k}" onclick="setStudyMode('${k}')">${STUDY_MODES[k].label}</button>`).join('')}</div>
        <div class="study-thread" id="study-thread"><div class="study-empty"><b>What shall we study?</b><span>Choose material on the left, then ask a question or tap a mode.</span></div></div>
        <div class="study-attached hidden" id="study-attached"></div><form class="study-input" id="study-form"><input id="st-q" placeholder="Ask about the material…" autocomplete="off" maxlength="1500"><button class="btn btn-accent" type="submit">Send</button></form>
      </section>
    </div>`;
  drawStudySrc();
  const log = loadStudyLog();
  if(log.length){
    log.forEach(m=> addStudyMsg(m.who, m.who==='me' ? esc(m.text) : studyMd(m.text)));
    studyHistory = log.slice(-8).map(m=>({role:m.who==='me'?'user':'model', text:m.text}));
    document.querySelector('.study-modes').insertAdjacentHTML('beforeend', '<button type="button" class="study-clear" onclick="clearStudyLog()">Clear history</button>');
  }
  document.getElementById('study-form').onsubmit = e=>{ e.preventDefault(); const q = document.getElementById('st-q').value.trim(); if(q){ document.getElementById('st-q').value=''; askStudy(q); } };
}
function setStudyMode(k){
  studyMode = k;
  document.querySelectorAll('.study-modes button').forEach(b=> b.classList.toggle('active', b.dataset.mode===k));
  if(k!=='ask') askStudy(STUDY_MODES[k].q);
  else document.getElementById('st-q').focus();
}
function studyMd(t){
  let h = esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm,'<h4>$1</h4>');
  h = h.replace(/(^|\n)([-*•] .+(?:\n[-*•] .+)*)/g,(m,a,list)=> a+'<ul>'+list.split('\n').map(l=>'<li>'+l.replace(/^[-*•] /,'')+'</li>').join('')+'</ul>');
  return h.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');
}
function addStudyMsg(who, html, cls){
  const th = document.getElementById('study-thread');
  const empty = th.querySelector('.study-empty'); if(empty) empty.remove();
  const d = document.createElement('div'); d.className = 'study-msg '+who+(cls?' '+cls:''); d.innerHTML = html;
  th.appendChild(d); th.scrollTop = th.scrollHeight; return d;
}
function dataUrlParts(u){ const m = /^data:([^;,]+)[^,]*;base64,(.*)$/.exec(u||''); return m ? {mime:m[1], data:m[2]} : null; }
function studySources(){
  const files = []; let text = '', title = '';
  const add = (data,name)=>{
    const p = dataUrlParts(data); if(!p) return;
    if(p.mime==='application/pdf' || /^image\//.test(p.mime)) files.push(p);
    else if(p.mime.startsWith('text/')){ try{ text += '\n'+decodeURIComponent(escape(atob(p.data))); }catch(e){} }
    else showToast((name||'That file')+' can\'t be read yet — save it as PDF.');
  };
  if(studyTab==='teacher'){
    const r = studyResources().find(x=>x.key===studySel);
    if(r){ title = r.title; if(r.data) add(r.data, r.fileName||r.title); else text = resourceContext(r); }
  } else {
    (ATT.stu||[]).forEach(f=>{ add(f.data, f.name); title = title || f.name; });
    const pasted = (document.getElementById('st-text')||{value:''}).value.trim();
    if(pasted){ text += '\n'+pasted; title = title || 'pasted notes'; }
  }
  return {files, text, title};
}
async function ensureStudyFile(){
  if(studyTab!=='teacher') return;
  const r = studyResources().find(x=>x.key===studySel);
  if(!r || r.data || !r.fileId) return;
  try{
    const resp = await fetch('/api/file?id='+encodeURIComponent(r.fileId));
    if(!resp.ok) return;
    const blob = await resp.blob();
    const url = await new Promise(res=>{ const fr = new FileReader(); fr.onload = ()=>res(fr.result); fr.readAsDataURL(blob); });
    const u = (r.f.uploads||[]).find(x=>x.id===r.uid); if(u) u.fileData = url;
  }catch(e){}
}
async function askStudy(question, opts){
  opts = opts || {};
  if(studyBusy) return;
  studyBusy = true;
  await ensureStudyFile();
  const src = studySources();
  if(!opts.silent) addStudyMsg('me', esc(question));
  const wait = addStudyMsg('bot', '<span class="spin"></span> Reading and thinking…', 'wait');
  try{
    const r = await fetch('/api/study', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({question, mode:studyMode, history:studyHistory, files:src.files, text:src.text, title:src.title})});
    let j = null; try{ j = await r.json(); }catch(e){}
    if(!r.ok || !j || !j.answer){
      const msg = j && j.error==='not_configured' ? 'The study agent is not switched on yet — the site owner needs to add a Gemini key. Until then it can\'t answer.' : (j && j.error) || 'The study agent is not available right now.';
      wait.className = 'study-msg bot err'; wait.textContent = msg;
    } else {
      wait.className = 'study-msg bot'; wait.innerHTML = studyMd(j.answer);
      studyHistory.push({role:'user', text:question}, {role:'model', text:j.answer});
      studyHistory = studyHistory.slice(-8);
      const lg = loadStudyLog(); if(!opts.silent) lg.push({who:'me',text:question}); lg.push({who:'bot',text:j.answer}); saveStudyLog(lg);
    }
  }catch(e){ wait.className = 'study-msg bot err'; wait.textContent = 'Could not reach the study agent. Check your connection.'; }
  studyBusy = false;
  const th = document.getElementById('study-thread'); th.scrollTop = th.scrollHeight;
}

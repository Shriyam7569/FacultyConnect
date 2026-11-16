/* FacultyConnect — application logic (router, views, timeline, sync, AI) */
/* ============================ STATE ============================ */
let state = {loggedIn:false, role:null, name:'', idNum:'', managingId:null};
try{ const saved = JSON.parse(localStorage.getItem('fc_state')||'null'); if(saved) state = saved; }catch(e){}
function persist(){ try{ localStorage.setItem('fc_state', JSON.stringify(state)); }catch(e){} }
try{
  const savedData = JSON.parse(localStorage.getItem('fc_data')||'null');
  if(savedData){ savedData.forEach(d=>{ const f=FACULTY.find(x=>x.id===d.id); if(f){ f.uploads=d.uploads||f.uploads; f.messages=d.messages||f.messages; f.customQB=d.customQB||f.customQB||[]; } }); }
}catch(e){}
FACULTY.forEach(f=> (f.uploads||[]).forEach(u=>{ if(!u.date || u.date==='just now') u.date = new Date().toISOString(); }));
function persistData(){
  const snap = strip => JSON.stringify(FACULTY.map(f=>({id:f.id, uploads: strip ? f.uploads.map(u=>{ const c={...u}; delete c.fileData; return c; }) : f.uploads, messages:f.messages, customQB:f.customQB||[]})));
  try{ localStorage.setItem('fc_data', snap(false)); }
  catch(e){ try{ localStorage.setItem('fc_data', snap(true)); }catch(e2){} }
}
function findFaculty(id){ return FACULTY.find(f=>f.id===id); }

/* ---- student progress tracker (per-device) ---- */
function getProgress(){ try{ return JSON.parse(localStorage.getItem('fc_progress')||'{"videos":[],"assignments":[],"qb":[]}'); }catch(e){ return {videos:[],assignments:[],qb:[]}; } }
function saveProgress(p){ try{ localStorage.setItem('fc_progress', JSON.stringify(p)); }catch(e){} }
function trackProgress(kind, id){
  const p = getProgress();
  if(!p[kind]) p[kind]=[];
  if(!p[kind].includes(id)){ p[kind].push(id); saveProgress(p); }
  if(location.hash.replace('#/','')==='dashboard') renderDashboard();
}

/* ============================ CAPABILITIES: db, room, sample ============================ */
let dbCap = null, roomCap = null, sampleCap = null;
async function initCapabilities(){
  try{ dbCap = await claude.use('db'); }catch(e){ dbCap = null; }
  try{ roomCap = await claude.use('room'); }catch(e){ roomCap = null; }
  try{ sampleCap = await claude.use('sample'); }catch(e){ sampleCap = null; }
  if(dbCap) subscribeAllFaculty();
  if(roomCap) setupPresence();
  else {
    const pb = document.getElementById('presence-badge'); if(pb) pb.classList.add('hidden');
    const lp = document.getElementById('login-presence'); if(lp) lp.parentElement.textContent = 'Live presence shows here when the campus network is online.';
  }
}
function dbSyncFaculty(faculty){
  persistData();
  if(!dbCap) return;
  dbCap.doc('faculty/'+faculty.id).set({uploads:faculty.uploads.map(u=>{ const c={...u}; delete c.fileData; return c; }), messages:faculty.messages, customQB:faculty.customQB||[]}).catch(()=>{
    showToast('Could not sync to the shared database — saved on this device only.');
  });
}
function snapExists(snap){ return !!snap && (typeof snap.exists==='function' ? snap.exists() : snap.exists); }
function subscribeAllFaculty(){
  FACULTY.forEach(f=>{
    const ref = dbCap.doc('faculty/'+f.id);
    ref.get().then(snap=>{ if(!snapExists(snap)){ ref.set({uploads:f.uploads.map(u=>{ const c={...u}; delete c.fileData; return c; }), messages:f.messages, customQB:f.customQB||[]}).catch(()=>{}); } }).catch(()=>{});
    f._msgCount = f.messages.length;
    f._dbReady = false;
    ref.onSnapshot(snap=>{
      if(snapExists(snap)){
        const d = snap.data();
        if(Array.isArray(d.uploads)) f.uploads = d.uploads;
        if(Array.isArray(d.customQB)) f.customQB = d.customQB;
        if(Array.isArray(d.messages)){
          if(f._dbReady && d.messages.length > f._msgCount && state.role==='faculty' && state.managingId===f.id){
            showToast('New message for '+f.name+' — check Messages.');
          }
          f.messages = d.messages;
          f._msgCount = d.messages.length;
        }
      }
      f._dbReady = true;
      onFacultyDataChanged(f);
    });
  });
}
function onFacultyDataChanged(f){
  updateBellBadge();
  const hash = location.hash.replace('#/','');
  if(hash==='dashboard') renderDashboard();
  if(hash==='faculty/'+f.id || hash.indexOf('faculty/'+f.id+'/')===0) renderProfile(f.id, hash.split('/')[2]||'about');
  if(hash==='messages') renderMessages();
}
function updateBellBadge(){
  const f = currentFaculty();
  const btn = document.getElementById('bell-btn'), badge = document.getElementById('bell-badge');
  if(!btn) return;
  if(state.role==='faculty' && f){
    btn.classList.remove('hidden');
    const n = f.messages.length;
    badge.textContent = n; badge.classList.toggle('hidden', n===0);
  } else { btn.classList.add('hidden'); }
}

function setupPresence(){ updatePresence(); roomCap.onPeers(()=>renderPresenceCount()); renderPresenceCount(); }
function updatePresence(){
  if(!roomCap) return;
  const page = state.loggedIn ? (location.hash.replace('#/','')||'dashboard') : 'login';
  roomCap.presence({page, role: state.role, name: state.name || null}).catch(()=>{});
}
function renderPresenceCount(){
  if(!roomCap) return;
  const peers = roomCap.peers();
  const count = Math.max(peers.length, 1);
  const pc = document.getElementById('presence-count'); if(pc) pc.textContent = count;
  const lp = document.getElementById('login-presence'); if(lp) lp.textContent = count;
  const dc = document.getElementById('dir-count-num');
  if(dc){ dc.textContent = count; document.getElementById('dir-count-lbl').textContent = 'people online right now'; }
  const badge = document.getElementById('profile-live-badge');
  if(badge){
    const id = badge.dataset.facultyId;
    const viewing = peers.filter(p=> p.presence && p.presence.page === ('faculty/'+id)).length;
    if(viewing>0){ badge.style.display='inline-flex'; badge.querySelector('span:last-child').textContent = viewing===1?'1 person viewing now':viewing+' people viewing now'; }
    else badge.style.display='none';
  }
}

/* ============================ LOGIN ============================ */
let loginRole = 'student';
function setLoginRole(r){
  loginRole = r;
  document.getElementById('tab-student').classList.toggle('active', r==='student');
  document.getElementById('tab-faculty').classList.toggle('active', r==='faculty');
  document.getElementById('login-id-label').textContent = r==='student' ? 'Roll number' : 'Employee ID';
  document.getElementById('login-id').placeholder = r==='student' ? 'e.g. 102203045' : 'e.g. FAC-2091';
  document.getElementById('faculty-picker-field').style.display = r==='faculty' ? 'block' : 'none';
}
function populateFacultyPicker(){ document.getElementById('faculty-picker').innerHTML = FACULTY.map(f=>`<option value="${f.id}">${f.name} — ${f.dept}</option>`).join(''); }
populateFacultyPicker();

function doLogin(){
  const name = document.getElementById('login-name').value.trim() || (loginRole==='student' ? 'Student' : 'Faculty member');
  state.loggedIn = true; state.role = loginRole; state.name = name;
  state.idNum = document.getElementById('login-id').value.trim();
  state.managingId = loginRole==='faculty' ? document.getElementById('faculty-picker').value : null;
  persist();
  // graduation-cap intro plays over the site while the dashboard renders underneath
  if(typeof window.playIntro === 'function'){
    const shown = state.role==='faculty' && !document.getElementById('login-name').value.trim() ? (findFaculty(state.managingId)||{}).name : state.name;
    window.playIntro(shown, state.role);
  }
  boot();
}
function doLogout(){
  state = {loggedIn:false, role:null, name:'', idNum:'', managingId:null};
  persist();
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  location.hash='';
  updatePresence();
}

/* ============================ TOAST ============================ */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 3400);
}
function showModal(html){
  document.getElementById('generic-modal-box').innerHTML = html;
  document.getElementById('generic-modal-overlay').classList.remove('hidden');
}
function closeModal(){ document.getElementById('generic-modal-overlay').classList.add('hidden'); }

/* ============================ ANIMATED COUNTERS & SCROLL REVEAL ============================ */
function animateCount(el, target){
  if(!el) return;
  const dur = 700, t0 = performance.now();
  function tick(now){
    const p = Math.min(1, (now-t0)/dur);
    const eased = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(target*eased);
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function stagger(container, selector, delayStep){
  const items = container.querySelectorAll(selector||':scope > *');
  items.forEach((el,i)=>{ el.style.animationDelay = (i*(delayStep||0.05))+'s'; });
}
function setupScrollReveal(){
  const els = document.querySelectorAll('.scroll-reveal:not(.revealed)');
  if(!els.length) return;
  if(!('IntersectionObserver' in window)){ els.forEach(el=>el.classList.add('revealed')); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('revealed'); io.unobserve(en.target); } });
  }, {threshold:0.25});
  els.forEach(el=>io.observe(el));
}

/* ============================ AVATAR HELPER ============================ */
function initials(name){ const first = String(name||'').trim().replace(/^(Dr\.?|Prof\.?)\s+/i,''); return (first.charAt(0)||'?').toUpperCase(); }
/* line icons used in rendered templates */
const ICON = {
  arrow:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>',
  chev:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
};
const FEED_LABEL = {opening:'Open role', paper:'Research', course:'Course', note:'Notice', msg:'Message'};
/* each feed category has its own identity: icon, action word (colour comes from CSS) */
const FEED_KIND = {
  opening:{cta:'Apply',       icon:'<path d="M3 8h18v11H3z"/><path d="M8 8V5h8v3"/><path d="M3 13h18"/>'},
  paper:  {cta:'Read',        icon:'<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7.5 15h9"/>'},
  course: {cta:'Open course', icon:'<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5"/><path d="M9 8h6"/>'},
  note:   {cta:'Details',     icon:'<path d="M4 10v4"/><path d="M4 11l11-5v12L4 13"/><path d="M15 9a3 3 0 010 6"/><path d="M7 14v4h3"/>'}
};
function roleTitle(f){ return f.role.split(',')[0].trim(); }
function roleFocus(f){ const p = f.role.split(','); return p.length>1 ? p.slice(1).join(',').trim() : f.dept; }
function pad2(n){ return String(n).padStart(2,'0'); }
function coverHTML(f){
  if(f.cover && f.photo) return `<img src="${f.cover}" alt="" loading="lazy"><span class="fac-portrait"><img src="${f.photo}" alt="Portrait of ${esc(f.name)}" loading="lazy"></span>`;
  if(f.photo) return `<span class="fac-portrait fac-portrait--center"><img src="${f.photo}" alt="Portrait of ${esc(f.name)}" loading="lazy"></span>`;
  if(f.cover) return `<img src="${f.cover}" alt="" loading="lazy">`;
  return `<span class="fac-initials">${initials(f.name)}</span>`;
}
/* hamburger drawer */
function toggleMenu(open){
  const d = document.getElementById('nav-drawer');
  const willOpen = open===undefined ? d.classList.contains('hidden') : open;
  d.classList.toggle('hidden', !willOpen);
  document.getElementById('menu-btn').setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ toggleMenu(false); closeModal(); toggleChat(false); } });
function avatarInner(f){
  if(f.photo) return `<img src="${f.photo}" class="avatar-img" alt="${f.name}">`;
  return initials(f.name);
}

/* ============================ ROUTER (with page-transition) ============================ */
function navigate(route){ location.hash = '#/'+route; }
window.addEventListener('hashchange', ()=>{ renderRoute(); updatePresence(); });
function currentFaculty(){ return state.role==='faculty' ? findFaculty(state.managingId) : null; }

function renderRoute(){
  if(!state.loggedIn) return;
  if(document.startViewTransition){ const vt = document.startViewTransition(()=>doRenderRoute()); vt.ready.catch(()=>{}); vt.finished.catch(()=>{}); }
  else { doRenderRoute(); }
}
function doRenderRoute(){
  const hash = location.hash.replace('#/','') || 'dashboard';
  const parts = hash.split('/');
  ['dashboard','directory','messages','match'].forEach(v=> document.getElementById('view-'+v).classList.add('hidden'));
  document.getElementById('view-profile').classList.add('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  // only one upload composer may exist in the DOM at a time (they share element ids)
  if(parts[0]!=='faculty') document.getElementById('view-profile').innerHTML = '';
  if(parts[0]==='faculty' || parts[0]==='messages' || parts[0]==='directory' || parts[0]==='match') document.getElementById('dash-upload-panel').innerHTML = '';

  if(parts[0]==='faculty' && parts[1]){
    renderProfile(parts[1], parts[2]||'about');
    document.getElementById('view-profile').classList.remove('hidden');
  } else if(parts[0]==='messages'){
    renderMessages();
    document.getElementById('view-messages').classList.remove('hidden');
    document.querySelector('[data-route="messages"]').classList.add('active');
  } else if(parts[0]==='directory'){
    renderDirectory();
    document.getElementById('view-directory').classList.remove('hidden');
    document.querySelector('[data-route="directory"]').classList.add('active');
  } else if(parts[0]==='match'){
    document.getElementById('view-match').classList.remove('hidden');
    document.querySelector('[data-route="match"]').classList.add('active');
  } else {
    renderDashboard();
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.querySelector('[data-route="dashboard"]').classList.add('active');
  }
  const activeRoute = (document.querySelector('.nav-btn.active')||{}).dataset;
  document.querySelectorAll('.drawer-link').forEach(b=> b.classList.toggle('active', !!activeRoute && b.dataset.drawerRoute===activeRoute.route));
  window.scrollTo({top:0, behavior:'instant'});
  updateBellBadge();
  setupScrollReveal();
}

/* ============================ BOOT / SHELL ============================ */
function boot(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('role-chip').textContent = state.role==='faculty' ? 'Faculty' : 'Student';
  document.getElementById('user-name').textContent = state.name;
  document.getElementById('user-avatar').textContent = (state.name||'?').trim().charAt(0).toUpperCase();
  document.getElementById('brand-tag').textContent = state.role==='faculty' ? ' · faculty view' : ' · student view';
  renderChatGreeting();
  if(!location.hash) location.hash = '#/dashboard';
  doRenderRoute();
  updatePresence();
}
function buildAnnouncementTrack(){
  const items = [];
  FACULTY.forEach(f=>{ f.announcements.slice(0,2).forEach(a=> items.push({who:f.name, ...a})); });
  CAMPUS_NOTICES.forEach(n=> items.push({who:null, ...n}));
  const html = items.map(i=>`<span class="ab-item ab--${FEED_KIND[i.tag]?i.tag:'note'}"><i class="ab-kind">${i.who ? (FEED_LABEL[i.tag]||'Notice') : 'Campus'}</i>${i.who?`<b>${esc(i.who)}</b>`:''}<span>${esc(i.text)}</span></span>`).join('');
  const track = document.getElementById('announce-track');
  if(track) track.innerHTML = html + html;
}

/* ============================ DASHBOARD ============================ */
/* ---- live clock + time-of-day greeting (updates every second) ---- */
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function dayPeriod(h){
  if(h>=5 && h<12) return {key:'morning', text:'Good morning,'};
  if(h>=12 && h<17) return {key:'afternoon', text:'Good afternoon,'};
  if(h>=17 && h<21) return {key:'evening', text:'Good evening,'};
  return {key:'night', text:'Still up,'};     // late night: a greeting, not a goodbye
}
function fmtClock(d){ let h=d.getHours(); const ap=h>=12?'PM':'AM'; h=h%12||12; return h+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds())+' '+ap; }
function updateLiveClock(){
  const now = new Date();
  const ld = document.getElementById('live-date'), lt = document.getElementById('live-time');
  if(ld) ld.textContent = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_FULL[now.getMonth()]} ${now.getFullYear()}`;
  if(lt) lt.textContent = fmtClock(now);
  const p = dayPeriod(now.getHours());
  const title = document.getElementById('dash-title');
  if(title && state.loggedIn && title.dataset.period !== p.key){
    const f = currentFaculty();
    const who = state.role==='faculty' && f ? f.name : (state.name.split(' ')[0] || 'there');
    title.dataset.period = p.key;
    title.innerHTML = `<span class="greet-word">${p.text}</span> <em class="shimmer">${esc(who)}.</em>`;
  }
  document.querySelectorAll('[data-live-time]').forEach(el=> el.textContent = fmtClock(now).replace(/:\d\d (AM|PM)$/, ' $1'));
  document.querySelectorAll('[data-live-greet]').forEach(el=> el.textContent = p.text.replace(',', ''));
}
setInterval(updateLiveClock, 1000);

function renderDashboard(){
  const isFaculty = state.role==='faculty';
  const f = currentFaculty();
  document.getElementById('dash-kicker').innerHTML = `<span class="lk-line"><span class="live-dot" aria-hidden="true"></span><span id="live-date"></span></span><span class="lk-line"><span id="live-time" class="mono-num"></span><span class="lk-sep">/</span><span>${isFaculty ? 'Faculty desk' : 'Your campus'}</span></span>`;
  document.getElementById('dash-title').dataset.period = '';
  updateLiveClock();
  document.getElementById('dash-sub').textContent = isFaculty ? 'Post updates, upload material, and see who has reached out — live, across every device.' : 'The right people, context, and opportunities for the work you want to do.';
  document.getElementById('dash-actions').innerHTML = isFaculty
    ? `<button class="btn btn-accent btn-split" onclick="document.getElementById('work-form').scrollIntoView({behavior:'smooth',block:'start'})"><span>Add to your timeline</span>${ICON.arrow}</button>
       <button class="btn btn-ghost" onclick="navigate('faculty/${f.id}')">View your profile</button>`
    : `<button class="btn btn-accent btn-split" onclick="navigate('directory')"><span>Explore the directory</span>${ICON.arrow}</button>
       <button class="btn btn-ghost" onclick="navigate('match')">Find my faculty</button>`;
  buildAnnouncementTrack();

  const stats = document.getElementById('dash-stats');
  const tiles = isFaculty ? [
    {n:f.stats.publications, l:'publications', href:'faculty/'+f.id+'/publications', d:'Papers, venues and co-authors on your profile', cta:'Open publications'},
    {n:f.students.current.length, l:'active students', href:'faculty/'+f.id+'/students', d:'Ph.D. and M.Tech students you supervise now', cta:'See students'},
    {n:workItems(f).length, l:'items in your work timeline', href:'faculty/'+f.id+'/work', d:'Lectures, videos, solutions, papers and assignments', cta:'Open timeline'},
    {n:f.messages.length, l:'messages received', href:'messages', d:'Student and colleague messages, synced live', cta:'Read messages'}
  ] : [
    {n:FACULTY.length, l:'faculty listed', href:'directory', d:'CSE, Mechanical, Electronics and Chemical faculty', cta:'Open directory'},
    {n:7, l:'departments', href:'directory', d:'Every department mapped in one search', cta:'Browse'},
    {n:FACULTY.reduce((n,x)=>n+workItems(x).length,0), l:'resources shared', href:'faculty/komal-bharti/work', d:'Lectures, videos, solutions, papers and projects', cta:'See all work'},
    {n:roomCap? Math.max(roomCap.peers().length,1) : null, l:'browsing now', href:null, d:'People exploring FacultyConnect at this moment', cta:'Live presence'}
  ];
  stats.innerHTML = tiles.map((t,i)=>`<div class="stat-tile flip-tile${t.href?' clickable':''}" tabindex="0"${t.href?` role="link" onclick="navigate('${t.href}')" onkeydown="if(event.key==='Enter')navigate('${t.href}')"`:''}>
    <div class="ft-inner"><div class="ft-face ft-front"><div class="num mono-num" id="stat-num-${i}">0</div><div class="lbl">${t.l}</div></div>
    <div class="ft-face ft-back"><p>${t.d}</p><span>${t.cta}${t.href?' →':''}</span></div></div></div>`).join('');
  tiles.forEach((t,i)=>{ if(t.n!=null) animateCount(document.getElementById('stat-num-'+i), t.n); else document.getElementById('stat-num-'+i).textContent='—'; });

  const feed = document.getElementById('dash-feed');
  const allAnn = [];
  FACULTY.forEach(fac=> fac.announcements.forEach(a=> allAnn.push({who:fac.name, id:fac.id, ...a})));
  feed.innerHTML = allAnn.length ? allAnn.slice(0,7).map((a,i)=>`
    <div class="feed-row feed--${FEED_KIND[a.tag]?a.tag:'note'}" role="link" tabindex="0" onclick="navigate('faculty/${a.id}')" onkeydown="if(event.key==='Enter')navigate('faculty/${a.id}')">
      <span class="feed-badge" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24">${(FEED_KIND[a.tag]||FEED_KIND.note).icon}</svg><i>${pad2(i+1)}</i></span>
      <div><span class="feed-tagline">${FEED_LABEL[a.tag]||a.tag}${a.tag==='opening'?'<em class="feed-live">Open now</em>':''}</span>
        <div class="feed-title">${esc(a.text)}</div>
        <div class="feed-meta"><span>${esc(a.who)}</span><span class="dot"></span><span>${esc(a.date)}</span></div></div>
      <span class="feed-arrow"><span class="feed-cta">${(FEED_KIND[a.tag]||FEED_KIND.note).cta}</span>${ICON.arrow}</span>
    </div>`).join('') : '<div class="empty" style="margin-top:24px;">Nothing posted yet — faculty updates will appear here as they come in.</div>';

  const side = document.getElementById('dash-side-panel');
  if(isFaculty){
    side.innerHTML = `
      <div class="progress-card">
        <span class="kicker">Your inbox</span>
        <div class="pc-big mono-num"><span id="prog-msgs">0</span></div>
        <p class="pc-lbl">message${f.messages.length===1?'':'s'} from students and colleagues</p>
        <div class="pc-lines">
        ${f.messages.length ? f.messages.slice(-3).reverse().map(m=>`
          <div class="progress-line"><span>${esc(m.from)} — ${esc(m.subject)}</span><b style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;margin-left:10px;">${esc(m.reason)}</b></div>`).join('')
          : '<div class="empty empty--dark" style="margin-top:16px;">No messages yet — students who reach out will show up here live.</div>'}
        </div>
        <button class="link-btn" onclick="navigate('messages')">View all messages ${ICON.chev}</button>
      </div>`;
    animateCount(document.getElementById('prog-msgs'), f.messages.length);
  } else {
    const p = getProgress();
    const km = findFaculty('komal-bharti');
    const explored = p.videos.length + p.assignments.length + p.qb.length;
    const totalRes = Math.max(explored, FACULTY.reduce((n,x)=>n+workItems(x).length,0));
    side.innerHTML = `
      <div class="progress-card">
        <span class="kicker">Your progress</span>
        <div class="pc-big mono-num"><span id="prog-total">00</span><small>/${pad2(totalRes)}</small></div>
        <p class="pc-lbl">resources explored so far</p>
        <div class="pc-bar"><span id="prog-bar"></span></div>
        <div class="pc-lines">
          <div class="progress-line"><span>Videos watched</span><b id="prog-videos">0</b></div>
          <div class="progress-line"><span>Assignments done</span><b id="prog-assign">0</b></div>
          <div class="progress-line"><span>Questions attempted</span><b id="prog-qb">0</b></div>
        </div>
        <button class="link-btn" onclick="navigate('faculty/komal-bharti/work')">See what's new ${ICON.chev}</button>
      </div>
      <div class="side-card" style="margin-top:28px;">
        <span class="kicker">Shortcuts</span>
        <div class="quick-links">
          <button class="quick-link" onclick="navigate('faculty/komal-bharti')"><span style="display:flex;align-items:center;gap:12px;">${km.photo?`<span class="ql-avatar">${avatarInner(km)}</span>`:''}Komal Bharti — Software Engineering</span>${ICON.arrow}</button>
          <button class="quick-link" onclick="navigate('match')"><span>Find my faculty (AI match)</span>${ICON.arrow}</button>
          <button class="quick-link" onclick="navigate('directory')"><span>Browse full directory</span>${ICON.arrow}</button>
          <button class="quick-link" onclick="toggleChat(true)"><span>Ask the helpdesk</span>${ICON.arrow}</button>
        </div>
      </div>`;
    const tot = document.getElementById('prog-total');
    const dur = 700, t0 = performance.now();
    (function tick(n){ const k=Math.min(1,(n-t0)/dur); tot.textContent = pad2(Math.round(explored*(1-Math.pow(1-k,3)))); if(k<1) requestAnimationFrame(tick); })(t0);
    requestAnimationFrame(()=>{ const bar = document.getElementById('prog-bar'); if(bar) bar.style.width = (totalRes ? Math.round(explored/totalRes*100) : 0)+'%'; });
    animateCount(document.getElementById('prog-videos'), p.videos.length);
    animateCount(document.getElementById('prog-assign'), p.assignments.length);
    animateCount(document.getElementById('prog-qb'), p.qb.length);
  }
  document.getElementById('dash-upload-panel').innerHTML = isFaculty ? uploadPanelHTML(f) : '';
  if(isFaculty) wireWorkForm(f);
  document.getElementById('dash-spotlight').innerHTML = spotlightHTML(findFaculty('komal-bharti'));
  setupScrollReveal();
}
function spotlightHTML(f){
  return `
  <div class="spotlight">
    <span class="kicker">In the spotlight ${ICON.arrow}</span>
    <div class="spot-person">
      <div class="spotlight-photo">${avatarInner(f)}</div>
      <div><h3>${esc(f.name)}</h3><p class="role">${esc(roleFocus(f))}</p></div>
    </div>
    <p class="spot-quote">“${esc(f.tagline)}”</p>
    <div class="chip-row">${f.research.slice(0,3).map(r=>`<span class="chip">${esc(r.name.replace('/',''))}</span>`).join('')}</div>
    <button class="link-btn link-accent" onclick="navigate('faculty/${f.id}')">View profile ${ICON.chev}</button>
  </div>`;
}

/* ============================ ALL WORK — one date-wise timeline ============================ */
/* Every thing a faculty member shares (uploads, assignments, lecture units, question-bank
   additions) is merged into ONE list, sorted newest-first and grouped by month. Uploading
   simply adds a dated entry to this same list — there is no separate "uploads" section. */
const WORK_TYPES = {
  lecture:   {label:'Lecture / slides',    plural:'Lectures'},
  video:     {label:'Video recording',     plural:'Videos'},
  solutions: {label:'MST / EST solutions', plural:'Solutions'},
  paper:     {label:'Research paper',      plural:'Papers'},
  project:   {label:'Project material',    plural:'Project material'},
  assignment:{label:'Assignment',          plural:'Assignments'},
  question:  {label:'Question bank',       plural:'Questions'}
};
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let workFilter = 'all', lastAddedId = null;
function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toDate(v, fallback){
  if(v instanceof Date) return v;
  if(!v) return fallback || new Date(2026,6,1);
  if(v==='just now') return new Date();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if(m) return new Date(+m[1], +m[2]-1, +m[3], 12);
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(v);
  if(m){ const i = MON.indexOf(m[1][0].toUpperCase()+m[1].slice(1,3).toLowerCase()); if(i>=0) return new Date(+m[2], i, 1, 12); }
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(v);
  if(m){ const i = MON.indexOf(m[2][0].toUpperCase()+m[2].slice(1,3).toLowerCase()); if(i>=0) return new Date(+m[3], i, +m[1], 12); }
  const d = new Date(v);
  return isNaN(d) ? (fallback || new Date(2026,6,1)) : d;
}
function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtDay(d){ return d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear(); }
function relDay(d){
  const a = new Date(); a.setHours(0,0,0,0); const b = new Date(d); b.setHours(0,0,0,0);
  const diff = Math.round((a-b)/864e5);
  return diff===0 ? 'Today' : diff===1 ? 'Yesterday' : fmtDay(d);
}
function workItems(f){
  const items = [];
  (f.uploads||[]).forEach((u,i)=> items.push({key:'upload:'+i, src:'upload', idx:i, id:u.id, type:WORK_TYPES[u.type]?u.type:'lecture', title:u.title, note:u.note||'', course:u.course||'', due:u.due||'', date:toDate(u.date), views:u.views||0, fileName:u.fileName||'', hasFile:!!u.fileData}));
  (f.assignments||[]).forEach((a,i)=> items.push({key:'assignment:'+i, src:'assignment', idx:i, type:'assignment', title:a.title, note:a.desc||'', course:a.course||'', due:a.due||'', status:a.status, date:toDate(a.posted, new Date(toDate(a.due).getTime()-14*864e5))}));
  (f.lectures||[]).forEach((l,i)=> items.push({key:'lecture:'+i, src:'lecture', idx:i, type:'lecture', title:'Unit '+l.num+' — '+l.title, note:l.desc||'', date:toDate(l.posted)}));
  (f.customQB||[]).forEach((q,i)=> items.push({key:'question:'+i, src:'question', idx:i, type:'question', title:q.q, note:[q.topic,q.difficulty].filter(Boolean).join(' · '), date:toDate(q.added)}));
  return items.sort((a,b)=> b.date - a.date);
}
function assignmentStatus(it){
  if(it.status) return it.status;
  if(!it.due) return 'open';
  const d = toDate(it.due); d.setHours(23,59,59); return d >= new Date() ? 'open' : 'closed';
}
function workTimelineHTML(f, opts){
  opts = opts || {};
  const all = workItems(f);
  const counts = {}; all.forEach(i=> counts[i.type]=(counts[i.type]||0)+1);
  if(workFilter!=='all' && !counts[workFilter]) workFilter = 'all';
  const types = Object.keys(WORK_TYPES).filter(t=>counts[t]);
  const chips = opts.noFilters ? '' : `<div class="work-toolbar">${['all',...types].map(t=>`<button class="filter-chip ${workFilter===t?'active':''}" onclick="setWorkFilter('${t}')">${t==='all'?'Everything':WORK_TYPES[t].plural}<span class="wc">${t==='all'?all.length:counts[t]}</span></button>`).join('')}</div>`;
  let items = workFilter==='all' ? all : all.filter(i=>i.type===workFilter);
  const total = items.length;
  if(opts.limit) items = items.slice(0, opts.limit);
  if(!items.length) return chips + '<div class="empty" style="margin-top:14px;">Nothing shared yet — anything uploaded will appear here, by date.</div>';
  const groups = [];
  items.forEach(it=>{
    const k = it.date.getFullYear()+'-'+it.date.getMonth();
    let g = groups[groups.length-1];
    if(!g || g.k!==k){ g = {k, label: MONTH_FULL[it.date.getMonth()]+' '+it.date.getFullYear(), items:[]}; groups.push(g); }
    g.items.push(it);
  });
  const body = groups.map(g=>`
    <div class="work-month"><span>${g.label}</span><span class="wm-n">${g.items.length} item${g.items.length===1?'':'s'}</span></div>
    ${g.items.map(it=>{
      const isNew = lastAddedId && it.id===lastAddedId;
      const meta = [ it.course ? esc(it.course) : '', relDay(it.date),
        it.type==='assignment' && it.due ? 'due '+esc(it.due)+' · '+assignmentStatus(it) : '',
        it.views ? it.views+' view'+(it.views===1?'':'s') : '',
        it.fileName ? '📎 '+esc(it.fileName) : '' ].filter(Boolean).join(' · ');
      return `<div class="work-item${isNew?' is-new':''}" onclick="openWorkItem('${f.id}','${it.src}',${it.idx})">
        <div class="wi-date"><b>${it.date.getDate()}</b><span>${MON[it.date.getMonth()]}</span></div>
        <div><div class="wi-title">${esc(it.title)}</div><div class="wi-meta">${isNew?'<span class="new-pill">just added · </span>':''}${meta}</div></div>
        <span class="type-badge t-${it.type}">${it.type==='question'?'question':it.type}</span>
      </div>`;}).join('')}`).join('');
  const more = opts.limit && total > opts.limit ? `<button class="btn btn-ghost" style="width:100%;margin-top:6px;" onclick="navigate('faculty/${f.id}/work')">See all ${total} items in the timeline →</button>` : '';
  return chips + body + more;
}
function setWorkFilter(t){
  workFilter = t;
  document.querySelectorAll('[data-work-timeline]').forEach(el=>{
    el.innerHTML = workTimelineHTML(findFaculty(el.dataset.fid), {limit: +el.dataset.limit || 0});
  });
}
function workComposerHTML(f){
  const courses = (f.teaching||[]).map(t=>`<option value="${esc(t.code)}">${esc(t.code)} — ${esc(t.name)}</option>`).join('');
  return `
  <div class="panel">
    <h3>Add to your work <span class="path">goes straight into your timeline, by date</span></h3>
    <form id="work-form">
      <div class="composer-grid">
        <div class="field span2"><label for="up-title">Title</label><input id="up-title" required placeholder="e.g. Unit 4 slides — Software Architecture"></div>
        <div class="field"><label for="up-type">Type</label>
          <select id="up-type">${Object.keys(WORK_TYPES).filter(t=>t!=='question').map(t=>`<option value="${t}">${WORK_TYPES[t].label}</option>`).join('')}</select>
        </div>
        <div class="field"><label for="up-course">Course</label><select id="up-course"><option value="">General / not course-specific</option>${courses}</select></div>
        <div class="field"><label for="up-date">Date shared</label><input id="up-date" type="date" value="${todayISO()}" max="${todayISO()}"></div>
        <div class="field hidden" id="up-due-field"><label for="up-due">Due date</label><input id="up-due" type="date"></div>
        <div class="field"><label for="up-file">File (optional)</label><input id="up-file" type="file"></div>
        <div class="field span2"><label for="up-note">Short note (optional)</label><textarea id="up-note" rows="2" placeholder="What students should know about this"></textarea></div>
      </div>
      <button class="btn btn-coral" type="submit">Add to timeline</button>
      <p class="login-footnote" style="margin-top:10px;">Older work? Set an earlier date and it slots into the right place among everything you've shared.</p>
    </form>
  </div>`;
}
function uploadPanelHTML(f){
  return `${workComposerHTML(f)}
  <div class="panel section-gap" style="--dept-color:${f.deptColor}">
    <h3>All your work <span class="path">newest first</span></h3>
    <div data-work-timeline data-fid="${f.id}" data-limit="6">${workTimelineHTML(f, {limit:6})}</div>
  </div>`;
}
function wireWorkForm(f){
  const form = document.getElementById('work-form');
  if(!form) return;
  const typeEl = document.getElementById('up-type'), dueField = document.getElementById('up-due-field');
  typeEl.onchange = ()=> dueField.classList.toggle('hidden', typeEl.value!=='assignment');
  form.onsubmit = function(e){
    e.preventDefault();
    const title = document.getElementById('up-title').value.trim();
    if(!title) return;
    const type = typeEl.value;
    const dateVal = document.getElementById('up-date').value || todayISO();
    const dueVal = document.getElementById('up-due').value;
    const item = {
      id:'u'+Date.now().toString(36),
      title, type,
      course: document.getElementById('up-course').value,
      note: document.getElementById('up-note').value.trim(),
      date: dateVal===todayISO() ? new Date().toISOString() : dateVal
    };
    if(type==='assignment' && dueVal) item.due = fmtDay(toDate(dueVal));
    const file = document.getElementById('up-file').files[0];
    const finish = ()=>{
      f.uploads.push(item);
      lastAddedId = item.id; workFilter = 'all';
      dbSyncFaculty(f);
      showToast(`Added to your timeline under ${relDay(toDate(item.date))}.`);
      renderRoute();
    };
    if(!file) return finish();
    item.fileName = file.name;
    if(file.size > 1.5*1024*1024) return finish();
    const r = new FileReader();
    r.onload = ()=>{ item.fileData = r.result; finish(); };
    r.onerror = finish;
    r.readAsDataURL(file);
  };
}
function openWorkItem(fid, src, idx){
  const f = findFaculty(fid);
  const it = workItems(f).find(x=>x.src===src && x.idx===idx);
  if(!it) return;
  let extra = '';
  if(src==='upload'){
    const u = f.uploads[idx];
    u.views = (u.views||0)+1; it.views = u.views;
    dbSyncFaculty(f);
    if(u.type==='video' && state.role==='student') trackProgress('videos', f.id+'-'+(u.id||idx));
    extra = u.fileData ? `<a class="btn btn-coral btn-sm" href="${u.fileData}" download="${esc(u.fileName||'file')}" style="margin-right:8px;">Download ${esc(u.fileName||'file')}</a>`
      : `<p style="color:var(--ink-3);font-size:13.5px;margin:0;flex-basis:100%;">${u.fileName ? 'File: '+esc(u.fileName)+' — prototype storage keeps files only on the device they were uploaded from.' : 'This prototype doesn\'t host files — the entry, its date and its view count are what sync.'}</p>`;
  }
  if(it.type==='assignment' && state.role==='student'){
    const uid = src==='assignment' ? f.id+'-'+idx : f.id+'-u'+(it.id||idx);
    const done = getProgress().assignments.includes(uid);
    extra += `<button class="btn ${done?'btn-ghost':'btn-coral'} btn-sm" style="margin-right:8px;" onclick="toggleAssignmentDone('${uid}');closeModal();">${done?'Marked done ✓':'Mark as done'}</button>`;
  }
  if(src==='lecture'){
    extra += `<button class="btn btn-coral btn-sm" style="margin-right:8px;" onclick="trackProgress('videos','${f.id}-${esc(f.lectures[idx].num)}');showToast('Marked as watched.');closeModal();">Watch</button>`;
  }
  if(src==='question'){
    extra += `<button class="btn btn-coral btn-sm" style="margin-right:8px;" onclick="closeModal();navigate('faculty/${f.id}/questionbank');">Practise in question bank</button>`;
  }
  showModal(`
    <span class="type-badge t-${it.type}">${it.type}</span>
    <h3 style="margin-top:10px;">${esc(it.title)}</h3>
    <p class="mono" style="color:var(--ink-3);font-size:12.5px;margin:0 0 14px;line-height:1.6;">Shared ${fmtDay(it.date)} by ${esc(f.name)}${it.course?' · '+esc(it.course):''}${it.due?' · due '+esc(it.due):''}${src==='upload'?' · '+it.views+' view'+(it.views===1?'':'s'):''}</p>
    ${it.note?`<p style="font-size:16px;line-height:1.6;color:var(--ink-2);margin:0 0 6px;">${esc(it.note)}</p>`:''}
    <div class="modal-actions">${extra.replace(/margin-right:8px;/g,'')}
    <button class="btn btn-ghost btn-sm" onclick="closeModal()">Close</button></div>
  `);
}

/* ============================ DIRECTORY ============================ */
let dirFilter = 'all', dirQuery = '';
function renderDirectory(){
  const depts = ['all', ...new Set(FACULTY.map(f=>f.dept))];
  document.getElementById('dir-kicker').textContent = `The people index / ${pad2(depts.length-1)} departments`;
  if(!roomCap){ document.getElementById('dir-count-num').textContent = FACULTY.length; document.getElementById('dir-count-lbl').textContent = 'faculty profiles on file'; }
  else renderPresenceCount();
  document.getElementById('dir-filters').innerHTML = depts.map(d=>
    `<button class="filter-chip ${dirFilter===d?'active':''}" onclick="setDirFilter('${d.replace(/'/g,"\\'")}')">${d==='all'?'All departments':d}</button>`
  ).join('');
  renderDirGrid();
}
function setDirFilter(d){ dirFilter = d; renderDirectory(); }
function clearDirSearch(){ dirFilter = 'all'; dirQuery = ''; const gs = document.getElementById('global-search'); if(gs) gs.value=''; renderDirectory(); }
function onGlobalSearch(q){ dirQuery = q.toLowerCase(); if(!location.hash.includes('directory')) navigate('directory'); else renderDirGrid(); }
function matchesQuery(f, q){
  if(!q) return true;
  const hay = [f.name, f.dept, f.role, ...(f.research||[]).map(r=>r.name+' '+r.desc), ...(f.publications||[]).map(p=>p.title)].join(' ').toLowerCase();
  return hay.includes(q);
}
function renderDirGrid(){
  let list = FACULTY.filter(f=> (dirFilter==='all'||f.dept===dirFilter) && matchesQuery(f, dirQuery));
  list = list.slice().sort((a,b)=> (b.featured?1:0)-(a.featured?1:0));
  const grid = document.getElementById('dir-grid');
  const total = document.getElementById('dir-total');
  if(total) total.textContent = list.length+' profile'+(list.length===1?'':'s');
  if(!list.length){ grid.innerHTML = `<div class="empty">No faculty match${dirQuery?` “${esc(dirQuery)}”`:' that filter'}. <button class="btn btn-ghost btn-sm" onclick="clearDirSearch()">Clear search &amp; filters</button></div>`; return; }
  grid.innerHTML = list.map((f,i)=>`
    <a class="fac-card" href="#/faculty/${f.id}" style="--dept-color:${f.deptColor}" aria-label="${esc(f.name)}, ${esc(f.role)}">
      <div class="fac-cover">${coverHTML(f)}<span class="fac-num">${pad2(i+1)}</span>${f.demo?'<span class="demo-badge">demo profile</span>':''}</div>
      <div class="fac-body">
        <div class="fac-dept">${esc(f.dept)}</div>
        <div class="fac-name">${esc(f.name)}</div>
        <div class="fac-role">${esc(roleTitle(f))}</div>
        <div class="fac-desc">${esc(f.tagline)}</div>
        <div class="fac-foot"><span>${esc(roleFocus(f))}</span>${ICON.arrow}</div>
      </div>
    </a>`).join('');
  stagger(grid, ':scope > *', 0.05);
}

/* ============================ FACULTY PROFILE ============================ */
function renderProfile(id, tab){
  const f = findFaculty(id);
  if(tab==='lectures') tab = 'work';
  const view = document.getElementById('view-profile');
  if(!f){ view.innerHTML = `<div class="empty">That faculty profile doesn't exist. <button class="btn btn-ghost btn-sm" onclick="navigate('directory')">Back to the directory</button></div>`; return; }
  const isOwner = state.role==='faculty' && state.managingId===f.id;
  const tabs = [['about','About'],['work','All work'],['research','Research'],['publications','Publications'],['teaching','Teaching'],['assignments','Assignments'],['questionbank','Question bank'],['students','Students'],['contact','Contact']];
  view.style.setProperty('--dept-color', f.deptColor);
  view.innerHTML = `
    <button class="back-link" onclick="navigate('directory')">${ICON.chev} The people index</button>
    <div class="profile-cover" style="--dept-color:${f.deptColor};">
      ${f.cover?`<div class="pc-img" style="background-image:url('${f.cover}')" aria-hidden="true"></div>`:''}
      <div class="profile-hero">
        <div class="profile-photo">${avatarInner(f)}</div>
        <div>
          <span class="kicker">${esc(f.dept)}</span>
          <h1>${esc(f.name)}${f.demo?' <span class="demo-badge">demo profile</span>':''}<span class="live-badge" id="profile-live-badge" data-faculty-id="${f.id}"><span class="live-dot"></span><span>viewing now</span></span></h1>
          <p class="role">${esc(f.role)}</p>
          <p class="dept">Thapar Institute of Engineering &amp; Technology, Patiala</p>
        </div>
      </div>
    </div>
    <div class="profile-stats">
      <div><b class="mono-num" id="pstat-0">0</b>publications</div>
      <div><b class="mono-num" id="pstat-1">0</b>years in dept.</div>
      <div><b class="mono-num" id="pstat-2">0</b>active students</div>
    </div>
    <div class="tab-strip" role="tablist" style="--dept-color:${f.deptColor}">${tabs.map(t=>`<button class="p-tab ${t[0]===tab?'active':''}" role="tab" aria-selected="${t[0]===tab}" onclick="navigate('faculty/${f.id}/${t[0]}')">${t[1]}</button>`).join('')}</div>
    <div id="profile-tab-content" style="--dept-color:${f.deptColor}"></div>
  `;
  animateCount(document.getElementById('pstat-0'), f.stats.publications);
  animateCount(document.getElementById('pstat-1'), f.stats.years);
  animateCount(document.getElementById('pstat-2'), f.students.current.length);
  document.getElementById('profile-tab-content').innerHTML = profileTabHTML(f, tab, isOwner);
  if(tab==='contact'){ wireContactForm(f); renderInlineChatGreeting(f); }
  if(tab==='questionbank') wireQBForm(f);
  if(tab==='work' && isOwner) wireWorkForm(f);
  renderPresenceCount();
}
function profileTabHTML(f, tab, isOwner){
  if(tab==='research'){
    if(!f.research.length) return '<div class="empty">No research areas listed yet.</div>';
    const nice = s=> s.replace('/','').replace(/-/g,' ').replace(/^\w/, c=>c.toUpperCase());
    return `<div class="mod-grid">${f.research.map((r,i)=>`<div class="mod"><span class="mod-num">${pad2(i+1)} / ${esc(r.name)}</span><div class="mod-name">${esc(nice(r.name))}</div><div class="mod-desc">${esc(r.desc)}</div></div>`).join('')}</div>`;
  }
  if(tab==='publications'){
    return `<div>${f.publications.map(p=>`
      <div class="pub"><div class="pub-year">${p.year}</div>
        <div><h3>${p.title}</h3><div class="pub-meta"><span class="pub-venue">${p.venue}</span>${p.authors}</div></div>
      </div>`).join('')}</div>`;
  }
  if(tab==='teaching'){
    return `<div class="table-scroll"><table class="course-table"><thead><tr><th>Code</th><th>Course</th><th>Level</th></tr></thead><tbody>
      ${f.teaching.map(c=>`<tr><td class="course-code">${c.code}</td><td>${c.name}</td><td><span class="level-badge">${c.level}</span></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  if(tab==='assignments'){
    const list = workItems(f).filter(it=>it.type==='assignment');
    if(!list.length) return '<div class="empty">No assignments posted yet.</div>';
    const p = getProgress();
    return '<div class="assign-list">' + list.map(it=>{
      const uid = it.src==='assignment' ? f.id+'-'+it.idx : f.id+'-u'+(it.id||it.idx);
      const done = p.assignments.includes(uid);
      const st = assignmentStatus(it);
      return `<div class="assign-card">
        <div class="assign-top"><span class="course-code">${esc(it.course||'General')}</span><span class="assign-status status-${st}">${st}</span></div>
        <div class="assign-title">${esc(it.title)}</div>
        <div class="assign-desc">${esc(it.note)}</div>
        <div class="assign-bottom"><span class="assign-due">${it.due?'Due '+esc(it.due)+' · ':''}posted ${fmtDay(it.date)}</span>${state.role==='student'?`<button class="btn ${done?'btn-ghost':'btn-coral'} btn-sm" onclick="toggleAssignmentDone('${uid}')">${done?'Marked done ✓':'Mark as done'}</button>`:''}</div>
      </div>`;
    }).join('') + '</div>';
  }
  if(tab==='questionbank'){ return questionBankTabHTML(f, isOwner); }
  if(tab==='work'){
    const intro = `<p style="color:var(--ink-2);font-size:17px;line-height:1.6;margin:0 0 24px;max-width:60ch;">Everything ${esc(f.name)} has shared — lectures, recordings, solutions, papers, project material, assignments and question-bank additions — in one place, newest first.</p>`;
    return `${isOwner ? workComposerHTML(f)+'<div class="section-gap"></div>' : intro}
      <div data-work-timeline data-fid="${f.id}">${workTimelineHTML(f)}</div>`;
  }
  if(tab==='students'){
    return `<h4 class="mini-head">Current students</h4>
      <div class="roster">${f.students.current.map(s=>`<div class="roster-item"><span class="rn">${s.name}</span><span class="rr">${s.role}</span><span class="rt">${s.topic}</span></div>`).join('') || '<div class="empty">No current students listed.</div>'}</div>
      <h4 class="mini-head" style="margin-top:40px;">Alumni</h4>
      <div class="roster">${f.students.alumni.map(s=>`<div class="roster-item"><span class="rn">${s.name}</span><span class="rr">${s.role}</span><span class="rt">${s.topic}</span></div>`).join('') || '<div class="empty">No alumni listed.</div>'}</div>`;
  }
  if(tab==='contact'){
    return `
    <div class="two-col">
      <div class="panel">
        <h3>Send a message</h3>
        <form id="contact-form">
          <div class="field"><label for="c-reason">Reason</label>
            <select id="c-reason"><option>Academic query</option><option>Project inquiry</option><option>Meeting request</option><option>Campus-wide concern</option></select>
          </div>
          <div class="field"><label for="c-subject">Subject</label><input id="c-subject" required placeholder="What's this about?"></div>
          <div class="field"><label for="c-message">Message</label><textarea id="c-message" rows="4" required placeholder="Write your message…"></textarea></div>
          <button class="btn btn-dark btn-block btn-split" type="submit"><span>Send — ${f.name.split(' ').slice(-1)[0]} will be notified</span>${ICON.arrow}</button>
        </form>
      </div>
      <div class="panel panel--plain">
        <h4 class="mini-head">Details</h4>
        <div class="kv">
          <div class="kv-row"><div class="kv-key">Email</div><div class="kv-val">${f.email}</div></div>
          <div class="kv-row"><div class="kv-key">Office</div><div class="kv-val">${f.office}</div></div>
          <div class="kv-row"><div class="kv-key">Office hours</div><div class="kv-val">${f.officeHours}</div></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:28px;">
      <h3>Ask before you write in <span class="path">helpdesk · answers from this profile</span></h3>
      <div id="inline-chat-body" class="inline-chat-body"></div>
      <div class="chat-input-row" style="padding:0;border:none;">
        <input id="inline-chat-input" placeholder="Ask about ${f.name.split(' ').slice(-1)[0]}'s courses, office hours…" onkeydown="if(event.key==='Enter'){sendInlineChat('${f.id}');}">
        <button onclick="sendInlineChat('${f.id}')" aria-label="Send">&#10148;</button>
      </div>
    </div>`;
  }
  return `<div class="prose">${f.about.map(p=>`<p>${p}</p>`).join('')}</div>
    <div class="kv" style="margin-top:36px;max-width:640px;">
      <div class="kv-row"><div class="kv-key">Position</div><div class="kv-val">${f.role}</div></div>
      <div class="kv-row"><div class="kv-key">Ph.D.</div><div class="kv-val">${f.phd}</div></div>
      <div class="kv-row"><div class="kv-key">Joined dept.</div><div class="kv-val">${f.joined}</div></div>
      <div class="kv-row"><div class="kv-key">Office</div><div class="kv-val">${f.office}</div></div>
      <div class="kv-row"><div class="kv-key">Office hours</div><div class="kv-val">${f.officeHours}</div></div>
    </div>`;
}
function toggleAssignmentDone(uid){
  const p = getProgress();
  const i = p.assignments.indexOf(uid);
  if(i>=0) p.assignments.splice(i,1); else p.assignments.push(uid);
  saveProgress(p);
  renderRoute();
}
function wireContactForm(f){
  const form = document.getElementById('contact-form');
  if(!form) return;
  form.onsubmit = function(e){
    e.preventDefault();
    const reason = document.getElementById('c-reason').value;
    const subject = document.getElementById('c-subject').value.trim();
    const message = document.getElementById('c-message').value.trim();
    if(!subject || !message) return;
    f.messages.push({from: state.name || 'A student', reason, subject, body:message, date:'just now'});
    dbSyncFaculty(f);
    showToast(`Sent — ${f.name} has been notified.`);
    form.reset();
  };
}

/* ============================ QUESTION BANK ============================ */
let qbUidCounter = 1;
function qbCardHTML(item, uid){
  if(item.type==='mcq' && Array.isArray(item.options)){
    return `<div class="qb-card">
      <div class="qb-top"><span class="qb-type">MCQ</span><span class="qb-topic">${item.topic||''}</span><span class="qb-diff diff-${item.difficulty||'medium'}">${item.difficulty||'medium'}</span></div>
      <div class="qb-q">${item.q}</div>
      <div class="qb-options">${item.options.map((o,i)=>`<button class="qb-opt" onclick="answerMCQ('${uid}',${i},${item.answer})">${o}</button>`).join('')}</div>
      <div class="qb-feedback" id="qbf-${uid}"></div>
    </div>`;
  }
  return `<div class="qb-card">
    <div class="qb-top"><span class="qb-type">${item.type==='numerical'?'Numerical':'Theory'}</span><span class="qb-topic">${item.topic||''}</span><span class="qb-diff diff-${item.difficulty||'medium'}">${item.difficulty||'medium'}</span></div>
    <div class="qb-q">${item.q}</div>
    <button class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="revealQB('${uid}')">Reveal answer</button>
    <div class="qb-answer hidden" id="qba-${uid}">${item.answer}</div>
  </div>`;
}
function answerMCQ(uid, chosen, correct){
  trackProgress('qb', uid);
  const fb = document.getElementById('qbf-'+uid);
  if(!fb) return;
  fb.textContent = chosen===correct ? 'Correct!' : 'Not quite — check the highlighted option.';
  fb.className = 'qb-feedback show ' + (chosen===correct?'ok':'no');
  const btns = fb.parentElement.querySelectorAll('.qb-opt');
  btns.forEach((b,i)=>{ b.classList.toggle('correct', i===correct); if(i===chosen && chosen!==correct) b.classList.add('wrong'); b.disabled=true; });
}
function revealQB(uid){ trackProgress('qb', uid); const el=document.getElementById('qba-'+uid); if(el) el.classList.remove('hidden'); }

function questionBankTabHTML(f, isOwner){
  const topicsHTML = (f.questionBank.topics||[]).length ? f.questionBank.topics.map(t=>`<span class="chip${t.tag==='high-yield'?' chip--hot':''}">${t.name}${t.tag?' · '+t.tag:''}</span>`).join('') : '<span style="color:var(--ink-3);font-size:14.5px;">No highlighted topics yet.</span>';
  const allItems = [...(f.questionBank.items||[]).map(it=>({...it})), ...(f.customQB||[]).map(it=>({...it}))];
  const bankHTML = allItems.length ? allItems.map(it=>qbCardHTML(it, 'qb'+(qbUidCounter++))).join('') : '<div class="empty">No questions in the bank yet.</div>';
  const ownerForm = isOwner ? `
    <div class="panel" style="margin-top:20px;">
      <h3>Add a question to the bank</h3>
      <form id="qb-form">
        <div class="field"><label for="qb-type">Type</label><select id="qb-type"><option value="mcq">MCQ</option><option value="numerical">Numerical</option><option value="theory">Theory</option></select></div>
        <div class="field"><label for="qb-topic">Topic</label><input id="qb-topic" placeholder="e.g. Software Testing"></div>
        <div class="field"><label for="qb-diff">Difficulty</label><select id="qb-diff"><option>easy</option><option selected>medium</option><option>hard</option></select></div>
        <div class="field"><label for="qb-q">Question</label><textarea id="qb-q-input" rows="2"></textarea></div>
        <div class="field"><label for="qb-a">Answer — for MCQ, list options comma-separated and mark the correct one with a leading *, e.g. "Option A, *Option B, Option C"</label><textarea id="qb-a-input" rows="2"></textarea></div>
        <button class="btn btn-coral" type="submit">Add to bank</button>
      </form>
    </div>` : '';
  return `
    <h4 class="mini-head">Most important topics</h4>
    <div class="chip-row" style="margin-bottom:32px;">${topicsHTML}</div>
    <div class="match-input-wrap match-input-wrap--inline">
      <span class="kicker">Practice generator</span>
      <h3>Generate practice questions for me</h3>
      <div class="field"><label for="qb-ai-topic">Topic</label><input id="qb-ai-topic" placeholder="e.g. Boundary value analysis, COCOMO, UML diagrams…" onkeydown="if(event.key==='Enter')generateQB('${f.id}')"></div>
      <button class="btn btn-accent btn-split" onclick="generateQB('${f.id}')"><span>Generate</span>${ICON.arrow}</button>
      <div id="qb-ai-results" class="qb-list" style="margin-top:20px;"></div>
    </div>
    <h4 class="mini-head">Question bank</h4>
    <div class="qb-list">${bankHTML}</div>
    ${ownerForm}
  `;
}
function wireQBForm(f){
  const form = document.getElementById('qb-form');
  if(!form) return;
  form.onsubmit = function(e){
    e.preventDefault();
    const type = document.getElementById('qb-type').value;
    const topic = document.getElementById('qb-topic').value.trim();
    const difficulty = document.getElementById('qb-diff').value;
    const q = document.getElementById('qb-q-input').value.trim();
    const aRaw = document.getElementById('qb-a-input').value.trim();
    if(!q || !aRaw) return;
    let item;
    if(type==='mcq'){
      const parts = aRaw.split(',').map(s=>s.trim());
      let answer = 0;
      const options = parts.map((p,i)=>{ if(p.startsWith('*')){ answer=i; return p.slice(1).trim(); } return p; });
      item = {type:'mcq', topic, difficulty, q, options, answer};
    } else {
      item = {type, topic, difficulty, q, answer:aRaw};
    }
    item.added = new Date().toISOString();
    f.customQB = f.customQB || [];
    f.customQB.push(item);
    dbSyncFaculty(f);
    showToast('Added to the question bank — live for everyone now.');
    renderRoute();
  };
}
async function generateQB(fid){
  const f = findFaculty(fid);
  const topic = document.getElementById('qb-ai-topic').value.trim();
  if(!topic) return;
  const resultsEl = document.getElementById('qb-ai-results');
  resultsEl.innerHTML = '<div class="empty"><span class="spin"></span> &nbsp;Generating questions on '+topic+'…</div>';
  let items = null;
  try{ if(!sampleCap) sampleCap = await claude.use('sample'); }catch(e){ sampleCap = null; }
  if(sampleCap){
    try{
      const prompt = `Generate 3 personalized practice exam questions on "${topic}", for a student in ${f.name}'s course(s): ${f.teaching.map(t=>t.name).join(', ')} (${f.dept}, engineering college). Mix question types if it makes sense. Return ONLY a JSON array, no markdown fences, each item shaped: {"type":"mcq"|"numerical"|"theory","topic":"${topic.replace(/"/g,'')}","difficulty":"easy"|"medium"|"hard","q":"<question text>","options":["...","...","...","..."] (ONLY for type mcq, exactly 4 options),"answer": <the correct option's index (0-3) for mcq, or a short plain-text answer string for numerical/theory>}`;
      const data = await sampleCap.json(prompt, {modelTier:'quick'});
      if(Array.isArray(data) && data.length) items = data;
    }catch(e){ items = null; }
  }
  if(!items) items = keywordQB(f, topic);
  resultsEl.innerHTML = items.map(it=>qbCardHTML(it, 'qbai'+(qbUidCounter++))).join('');
}
function keywordQB(f, topic){
  const q = topic.toLowerCase();
  const all = [...(f.questionBank.items||[]), ...(f.customQB||[])];
  const found = all.filter(it=> (it.topic||'').toLowerCase().includes(q) || (it.q||'').toLowerCase().includes(q));
  if(found.length) return found.slice(0,3);
  return [{type:'theory', topic, difficulty:'medium', q:`No AI connection right now, and no bank questions matched "${topic}" — try the exact topic name from the highlighted list above, or check back once you're online.`, answer:'—'}];
}

/* ============================ MESSAGES ============================ */
function renderMessages(){
  const isFaculty = state.role==='faculty';
  document.getElementById('msg-title').textContent = isFaculty ? 'Your messages' : 'Sent messages';
  if(isFaculty){
    const f = currentFaculty();
    document.getElementById('msg-sub').textContent = `Everything students and colleagues have sent to ${f.name} — synced live.`;
    document.getElementById('msg-body').innerHTML = f.messages.length ? '<div class="msg-list">' + f.messages.slice().reverse().map((m,i)=>`
      <div class="msg-item"><span class="msg-num">${pad2(i+1)}</span><div><div class="mi-top"><span>${esc(m.from)} · ${esc(m.date)}</span><span class="msg-reason">${esc(m.reason)}</span></div>
        <div class="mi-subj">${esc(m.subject)}</div><div class="mi-body">${esc(m.body)}</div></div></div>`).join('') + '</div>' : '<div class="empty">No messages yet — students who reach out from your Contact tab will land here, live.</div>';
  } else {
    document.getElementById('msg-sub').textContent = 'Messages you send from a faculty profile land here too.';
    const mine = [];
    FACULTY.forEach(f=> f.messages.forEach(m=>{ if(m.from===state.name) mine.push({...m, to:f.name}); }));
    document.getElementById('msg-body').innerHTML = mine.length ? '<div class="msg-list">' + mine.slice().reverse().map((m,i)=>`
      <div class="msg-item"><span class="msg-num">${pad2(i+1)}</span><div><div class="mi-top"><span>To ${esc(m.to)} · ${esc(m.date)}</span><span class="msg-reason">${esc(m.reason)}</span></div>
        <div class="mi-subj">${esc(m.subject)}</div><div class="mi-body">${esc(m.body)}</div></div></div>`).join('') + '</div>' : '<div class="empty">You haven\'t contacted any faculty yet — visit a profile\'s Contact tab to send one. <button class="btn btn-ghost btn-sm" onclick="navigate(\'directory\')">Browse the directory</button></div>';
  }
}

/* ============================ AI FACULTY MATCHMAKER ============================ */
async function runMatch(){
  const query = document.getElementById('match-input').value.trim();
  if(!query) return;
  const resultsEl = document.getElementById('match-results');
  resultsEl.innerHTML = '<div class="empty"><span class="spin"></span> &nbsp;Matching you to faculty…</div>';
  let matches = null;
  try{ if(!sampleCap) sampleCap = await claude.use('sample'); }catch(e){ sampleCap = null; }
  if(sampleCap){
    try{
      const prompt = `You match students to faculty at an engineering college based on stated interests. Faculty list, one per line as "id | name | department | research areas":\n${FACULTY.map(f=>`${f.id} | ${f.name} | ${f.dept} | ${f.research.map(r=>r.name.replace('/','')+': '+r.desc).join('; ')}`).join('\n')}\n\nStudent interest: "${query}"\n\nReturn ONLY a JSON array (no markdown fences), up to 3 objects, best match first: [{"id": "<one of the ids above, exactly>", "reason": "<one short plain-text sentence on why this faculty fits>"}]`;
      const data = await sampleCap.json(prompt, {modelTier:'quick'});
      if(Array.isArray(data) && data.length) matches = data;
    }catch(e){ matches = null; }
  }
  if(!matches) matches = keywordMatch(query);
  renderMatchResults(matches);
}
function keywordMatch(query){
  const q = query.toLowerCase();
  const words = q.split(/\W+/).filter(w=>w.length>3);
  const scored = FACULTY.map(f=>{
    let score = 0, bestArea = f.research[0];
    f.research.forEach(r=>{
      const text = (r.name+' '+r.desc).toLowerCase();
      let s = 0; words.forEach(w=>{ if(text.includes(w)) s++; });
      if(s>score){ score=s; bestArea=r; }
    });
    return {id:f.id, score, reason: bestArea ? `Works on ${bestArea.name.replace('/','')} — ${bestArea.desc}` : 'General match on department.'};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
  return scored.length ? scored : [{id:'komal-bharti', reason:"No strong keyword overlap found — here's a well-rounded starting point in software research."}];
}
function renderMatchResults(matches){
  const resultsEl = document.getElementById('match-results');
  const valid = matches.filter(m=>findFaculty(m.id));
  if(!valid.length){ resultsEl.innerHTML='<div class="empty">No matches found — try describing your interest differently.</div>'; return; }
  resultsEl.innerHTML = valid.map((m,i)=>{
    const f = findFaculty(m.id);
    return `<div class="match-card" style="--dept-color:${f.deptColor};animation-delay:${i*0.08}s">
      <span class="match-num">${pad2(i+1)}</span>
      <div class="match-thumb">${f.photo?`<img src="${f.photo}" alt="">`:f.cover?`<img src="${f.cover}" alt="">`:initials(f.name)}</div>
      <div><div class="match-head"><span class="fac-role">${esc(f.dept)}</span><span class="fac-name">${esc(f.name)}</span></div><p>${esc(m.reason)}</p></div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('faculty/${f.id}')">View profile ${ICON.arrow}</button></div>`;
  }).join('');
}

/* ============================ CHATBOT (floating + inline contact widget) ============================ */
function toggleChat(open){ document.getElementById('chat-panel').classList.toggle('hidden', !open); }
function renderChatGreeting(){
  const body = document.getElementById('chat-body');
  body.innerHTML = '';
  addChatMsgTo(body, 'bot', `Hi ${state.name ? state.name.split(' ')[0] : ''}! I can help with faculty office hours, courses, assignments, question banks, or how to reach someone. What do you need?`);
  addChatSuggestTo(body, ['Who teaches software testing?', "Komal Bharti's office hours", 'How do I attempt the question bank?']);
}
function addChatMsgTo(body, who, text){
  const div = document.createElement('div');
  div.className = 'chat-msg ' + who;
  div.textContent = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}
function addChatSuggestTo(body, list, onPick){
  const wrap = document.createElement('div');
  wrap.className = 'chat-suggest';
  list.forEach(s=>{
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = ()=>{ onPick ? onPick(s) : (document.getElementById('chat-input').value = s, sendChat()); };
    wrap.appendChild(b);
  });
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}
async function sendChat(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  const body = document.getElementById('chat-body');
  addChatMsgTo(body, 'user', text);
  input.value = '';
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot typing-dots';
  typing.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(typing);
  body.scrollTop = body.scrollHeight;
  let answer = await getSmartAnswer(text).catch(()=>null);
  if(!answer) answer = ruleBasedAnswer(text);
  typing.remove();
  addChatMsgTo(body, 'bot', answer);
}
function renderInlineChatGreeting(f){
  const body = document.getElementById('inline-chat-body');
  if(!body || body.dataset.greeted) return;
  body.dataset.greeted = '1';
  addChatMsgTo(body, 'bot', `Ask me anything about ${f.name} — office hours, courses, assignments, or the question bank — before you send a message.`);
}
async function sendInlineChat(fid){
  const input = document.getElementById('inline-chat-input');
  const body = document.getElementById('inline-chat-body');
  const text = input.value.trim();
  if(!text) return;
  addChatMsgTo(body, 'user', text);
  input.value = '';
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot typing-dots';
  typing.innerHTML = '<span></span><span></span><span></span>';
  body.appendChild(typing);
  body.scrollTop = body.scrollHeight;
  let answer = await getSmartAnswer(text, fid).catch(()=>null);
  if(!answer) answer = ruleBasedAnswer(text);
  typing.remove();
  addChatMsgTo(body, 'bot', answer);
}
function facultySummaryForBot(){
  return FACULTY.map(f=>`${f.name} (${f.role}, ${f.dept}) — office ${f.office}, hours ${f.officeHours}, email ${f.email}. Research: ${f.research.map(r=>r.name.replace('/','')).join(', ')}. Teaches: ${f.teaching.map(t=>t.code+' '+t.name).join(', ')}. Assignments: ${(f.assignments||[]).map(a=>a.title+' (due '+a.due+', '+a.status+')').join('; ') || 'none posted'}.`).join('\n');
}
async function getSmartAnswer(text, focusFid){
  if(!sampleCap){ try{ sampleCap = await claude.use('sample'); }catch(e){ sampleCap=null; } }
  if(!sampleCap) return null;
  const focus = focusFid ? findFaculty(focusFid) : null;
  const system = `You are the helpdesk assistant inside FacultyConnect, a Thapar Institute faculty directory app. Answer briefly (2-4 sentences), warmly, in plain text with no markdown. Use only the faculty data below; if something isn't covered, say you don't have that on file and suggest visiting the faculty's Contact tab.${focus?(' The student is currently on '+focus.name+"'s profile page, so prioritize her info when relevant."):''} Faculty data:\n${facultySummaryForBot()}`;
  try{
    const res = await sampleCap([{role:'user', content: system + '\n\nStudent question: ' + text}], {modelTier:'quick'});
    return res && res.text ? res.text.trim() : null;
  }catch(e){ return null; }
}
function ruleBasedAnswer(text){
  const q = text.toLowerCase();
  if(q.includes('upload')) return "Everything a faculty member shares — lectures, videos, MST/EST solutions, papers, project material, assignments and question-bank additions — lives in one date-wise timeline on the 'All work' tab of their profile. New uploads land in that same list, under the date they were shared.";
  if(q.includes('question bank') || q.includes('qb') || q.includes('mcq')) return "Each faculty profile has a Question Bank tab — faculty-curated MCQs, numericals and theory questions, plus a 'Generate practice questions for me' box that creates a personalized set on any topic you type in.";
  if(q.includes('assignment')) return "Open the Assignments tab on a faculty's profile to see due dates and status — students can mark one done, which also shows up in Your progress on the dashboard.";
  for(const f of FACULTY){
    if(q.includes(f.name.toLowerCase().split(' ')[0]) || q.includes(f.name.toLowerCase())){
      if(q.includes('office') || q.includes('hour')) return `${f.name} holds office hours ${f.officeHours} in ${f.office}.`;
      if(q.includes('email') || q.includes('contact') || q.includes('reach')) return `You can email ${f.name} at ${f.email}, or use the Contact tab on their profile — they'll be notified instantly.`;
      return `${f.name} is ${f.role} in ${f.dept}. Focus areas: ${f.research.map(r=>r.name.replace('/','')).join(', ')}.`;
    }
  }
  for(const f of FACULTY){
    for(const r of f.research){
      if(q.includes(r.name.replace('/','')) || r.desc.toLowerCase().split(' ').some(w=>w.length>5 && q.includes(w))){
        return `${f.name} works on ${r.name.replace('/','')} — ${r.desc}`;
      }
    }
  }
  if(q.includes('testing')) return `Komal Bharti's group leads software testing research — see her Research tab for the full breakdown.`;
  if(q.includes('match') || q.includes('recommend') || q.includes('suggest')) return `Try the "Find faculty ✦" page in the top nav — describe your interest and it'll match you to the closest faculty member.`;
  return "I don't have that on file yet — try asking about a specific faculty member's office hours, courses, assignments, or the question bank.";
}

/* ============================ COMMAND PALETTE ============================ */
let paletteItems = [], paletteIndex = 0;
function openPalette(prefill){
  document.getElementById('cmdk-overlay').classList.remove('hidden');
  const input = document.getElementById('cmdk-input');
  input.value = prefill || '';
  buildPaletteItems(input.value);
  setTimeout(()=>input.focus(), 10);
}
function closePalette(){ document.getElementById('cmdk-overlay').classList.add('hidden'); }
function paletteActions(){
  return [
    {icon:'&#8962;', label:'Go to dashboard', run:()=>navigate('dashboard')},
    {icon:'&#9776;', label:'Browse directory', run:()=>navigate('directory')},
    {icon:'&#10022;', label:'Find my faculty (AI match)', run:()=>navigate('match')},
    {icon:'&#9993;', label:'Open messages', run:()=>navigate('messages')},
    {icon:'&#128172;', label:'Open helpdesk chat', run:()=>toggleChat(true)}
  ];
}
function buildPaletteItems(q){
  q = (q||'').toLowerCase();
  const acts = paletteActions().filter(a=>!q || a.label.toLowerCase().includes(q)).map(a=>({icon:a.icon, label:a.label, run:a.run}));
  const facs = FACULTY.filter(f=> !q || (f.name+' '+f.dept+' '+f.role).toLowerCase().includes(q))
    .map(f=>({icon:'&#9679;', label:f.name+' — '+f.dept, run:()=>navigate('faculty/'+f.id)}));
  paletteItems = [...acts, ...facs];
  paletteIndex = 0;
  renderPaletteList();
}
function renderPaletteList(){
  const list = document.getElementById('cmdk-list');
  if(!paletteItems.length){ list.innerHTML = '<div class="cmdk-empty">Nothing matches — try a different search.</div>'; return; }
  list.innerHTML = paletteItems.map((it,i)=>`<div class="cmdk-item ${i===paletteIndex?'sel':''}" data-i="${i}" onmouseenter="paletteIndex=${i};renderPaletteList();" onclick="runPaletteItem(${i})"><span class="ci-icon">${it.icon}</span>${it.label}</div>`).join('');
}
function runPaletteItem(i){ const it = paletteItems[i]; if(!it) return; closePalette(); it.run(); }
function paletteKeydown(e){
  if(e.key==='Escape'){ closePalette(); return; }
  if(e.key==='ArrowDown'){ e.preventDefault(); paletteIndex = Math.min(paletteIndex+1, paletteItems.length-1); renderPaletteList(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); paletteIndex = Math.max(paletteIndex-1, 0); renderPaletteList(); }
  else if(e.key==='Enter'){ e.preventDefault(); runPaletteItem(paletteIndex); }
}
document.addEventListener('keydown', function(e){
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); if(state.loggedIn) openPalette(''); }
});

/* ============================ LOGIN CURSOR GLOW ============================ */
const loginVisual = document.getElementById('login-visual');
if(loginVisual){
  loginVisual.addEventListener('mousemove', function(e){
    const r = loginVisual.getBoundingClientRect();
    loginVisual.style.setProperty('--mx', (e.clientX-r.left)+'px');
    loginVisual.style.setProperty('--my', (e.clientY-r.top)+'px');
  });
}

/* ============================ INIT ============================ */
initCapabilities().then(()=>{ if(state.loggedIn) boot(); });
if(!state.loggedIn) updatePresence();

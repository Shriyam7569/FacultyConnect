/* FacultyConnect — motion & 3D effects
   1. Campus navigator cube (drag / touch to spin, click any side to go there, sound)
   2. Sound effects (Web Audio, synthesized — no audio files)
   3. 3D tilt cards with glare
   4. 3D flip-in reveal for list rows
   5. Extruded headings that follow the pointer
   6. Letter-by-letter 3D drop-in + highlighter markers                         */
(function(){
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = matchMedia('(pointer: fine)').matches;

/* =============================== SOUND =============================== */
const Sound = {
  ctx:null,
  on: (()=>{ try{ return localStorage.getItem('fc_sound')!=='off'; }catch(e){ return true; } })(),
  ensure(){
    if(!this.on) return null;
    try{
      if(!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      if(this.ctx.state==='suspended') this.ctx.resume();
    }catch(e){ return null; }
    return this.ctx;
  },
  tone(freq, dur, {type='sine', vol=.12, attack=.005, slideTo=null, delay=0}={}){
    const c = this.ensure(); if(!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t+dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t+attack);
    g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.02);
  },
  noise(dur, {vol=.08, from=600, to=2400}={}){
    const c = this.ensure(); if(!c) return;
    const t = c.currentTime, len = Math.floor(c.sampleRate*dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type='bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t+dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  },
  grab(){ this.noise(.22, {vol:.07, from:400, to:1800}); },
  detent(){ this.tone(2200, .03, {type:'triangle', vol:.035}); },
  snap(){ this.tone(180, .16, {type:'sine', vol:.18, slideTo:90}); this.tone(1400, .05, {type:'triangle', vol:.05}); },
  hover(){ this.tone(880, .07, {type:'sine', vol:.035}); },
  select(){ this.tone(523.25, .18, {vol:.11}); this.tone(783.99, .22, {vol:.1, delay:.07}); this.tone(1046.5, .32, {vol:.08, delay:.14}); },
  toggle(){ this.tone(660, .08, {type:'triangle', vol:.08}); }
};
window.FCSound = Sound;

/* =============================== CUBE =============================== */
const ICON_ARROW = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>';
const SPEAKER_ON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>';
const SPEAKER_OFF = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>';

/* each side: the rotation that brings it to the front, and where it takes you */
const FACES = [
  {key:'now',       pos:'front',  rx:0,   ry:0,   num:'00', label:'Now',          sub:'<span data-live-time></span>', img:'campus-main-building.webp', tone:'plum',
   go:()=>{ const s=document.querySelector('.feed-section'); if(s) s.scrollIntoView({behavior:'smooth'}); }},
  {key:'directory', pos:'right',  rx:0,   ry:-90, num:'01', label:'Directory',    sub:'Find your people',     img:'library.jpg',              tone:'gold',
   go:()=>navigate('directory')},
  {key:'match',     pos:'back',   rx:0,   ry:180, num:'02', label:'Find faculty', sub:'AI matchmaker',        img:'graduates.jpg',            tone:'plum',
   go:()=>navigate('match')},
  {key:'messages',  pos:'left',   rx:0,   ry:90,  num:'03', label:'Messages',     sub:'Inbox &amp; sent',     img:'chemistry-lab.jpg',        tone:'gold',
   go:()=>navigate('messages')},
  {key:'helpdesk',  pos:'top',    rx:-90, ry:0,   num:'04', label:'Helpdesk',     sub:'Ask anything',         img:'electrical-machines-lab.webp', tone:'rose',
   go:()=>toggleChat(true)},
  {key:'search',    pos:'bottom', rx:90,  ry:0,   num:'05', label:'Search',       sub:'Ctrl / ⌘ K',           img:null,                       tone:'ink',
   go:()=>openPalette('')}
];
const NORMALS = {front:[0,0,1], right:[1,0,0], back:[0,0,-1], left:[-1,0,0], top:[0,-1,0], bottom:[0,1,0]};

function initCube(){
  const cube = document.getElementById('nav-cube'), scene = document.getElementById('cube-scene');
  if(!cube || !scene) return;
  cube.innerHTML = FACES.map(f=>`
    <button class="face face--${f.pos} face--${f.tone}" type="button" data-face="${f.key}" data-pos="${f.pos}" aria-label="${f.label.replace('&amp;','and')}"
      style="${f.img?`--img:url('${new URL('assets/images/'+f.img, document.baseURI).href}')`:''}">
      <span class="face-top"><span class="face-num">${f.num}</span>${ICON_ARROW}</span>
      <span class="face-bottom">${f.key==='now'?'<span class="face-greet" data-live-greet></span>':''}<b>${f.label}</b><small>${f.sub}</small></span>
    </button>`).join('');
  if(typeof updateLiveClock==='function') updateLiveClock();
  const faceEls = [...cube.querySelectorAll('.face')];
  const facingEl = document.getElementById('cube-facing');
  const goBtn = document.getElementById('cube-go');
  const soundBtn = document.getElementById('sound-btn');

  let rx = -22, ry = -32, vx = 0, vy = 0;          // rotation + angular velocity (deg / frame)
  let pressed = false, dragging = false, lastX = 0, lastY = 0, startX = 0, startY = 0, pid = null;
  let snapping = null, lastInteract = 0, front = null, lastDetent = 0, suppressClick = false;

  const rad = d => d*Math.PI/180;
  function frontFace(){
    let best = null, bestZ = -2;
    for(const f of FACES){
      const [x,y,z] = NORMALS[f.pos];
      const z1 = -x*Math.sin(rad(ry)) + z*Math.cos(rad(ry));
      const z2 = y*Math.sin(rad(rx)) + z1*Math.cos(rad(rx));
      if(z2 > bestZ){ bestZ = z2; best = f; }
    }
    return best;
  }
  function apply(){
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    // real 3D shading: brightness of each side follows the angle between it and the light
    const sy = Math.sin(rad(ry)), cy = Math.cos(rad(ry)), sx = Math.sin(rad(rx)), cx = Math.cos(rad(rx));
    for(const el of faceEls){
      const [x,y,z] = NORMALS[el.dataset.pos];
      const x1 = x*cy + z*sy, z1 = -x*sy + z*cy;
      const y2 = y*cx - z1*sx, z2 = y*sx + z1*cx;
      const lit = Math.max(0, x1*-0.42 + y2*-0.62 + z2*0.66);
      el.style.setProperty('--lit', lit.toFixed(3));
      el.classList.toggle('is-back', z2 < -0.02);     // far sides: seen through the glass
    }
    const f = frontFace();
    if(f && f.key !== front){
      front = f.key;
      faceEls.forEach(el=> el.classList.toggle('is-front', el.dataset.face===front));
      if(facingEl) facingEl.textContent = f.label.replace('&amp;','&');
    }
    const det = Math.floor(ry/30) + Math.floor(rx/30)*1000;
    if((dragging || Math.abs(vy)+Math.abs(vx) > .6) && det !== lastDetent){ lastDetent = det; Sound.detent(); }
  }
  function snapTo(tx, ty, sound=true){ snapping = {fx:rx, fy:ry, tx, ty, t0:performance.now(), dur:520, sound}; vx = vy = 0; }
  // snap to the nearest side; tipping onto top/bottom needs a clear vertical push (past 60°)
  function snapAxis(a, bias){ const k = a/90, base = Math.trunc(k), frac = k - base; return (Math.abs(frac) > bias ? base + Math.sign(frac) : base)*90; }
  function nearestSnap(){ snapTo(snapAxis(rx, .66), Math.round(ry/90)*90); }
  function faceTarget(f){
    // the equivalent angle closest to the current rotation, so the cube doesn't unwind
    return [f.rx + 360*Math.round((rx - f.rx)/360), f.ry + 360*Math.round((ry - f.ry)/360)];
  }
  function activate(key){
    const f = FACES.find(x=>x.key===key); if(!f) return;
    const el = faceEls.find(e=>e.dataset.face===key);
    Sound.select();
    if(el){ el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    const [tx,ty] = faceTarget(f);
    snapTo(tx, ty, false);
    lastInteract = performance.now();
    setTimeout(()=>f.go(), 420);
  }

  function loop(now){
    requestAnimationFrame(loop);
    if(scene.offsetParent === null) return;           // dashboard hidden: idle
    if(snapping){
      const p = Math.min(1, (now - snapping.t0)/snapping.dur);
      const e = 1 - Math.pow(1-p, 4) + Math.sin(p*Math.PI)*.04;
      rx = snapping.fx + (snapping.tx - snapping.fx)*e;
      ry = snapping.fy + (snapping.ty - snapping.fy)*e;
      if(p>=1){ rx = snapping.tx; ry = snapping.ty; if(snapping.sound) Sound.snap(); snapping = null; lastInteract = now; }
    } else if(!dragging){
      if(Math.abs(vx) > .05 || Math.abs(vy) > .05){
        rx += vx; ry += vy; vx *= .94; vy *= .94;
        if(Math.abs(vx) < .25 && Math.abs(vy) < .25 && lastInteract) nearestSnap();
      } else if(!REDUCED && now - lastInteract > 3500){
        ry += .18;                                     // idle auto-spin
        rx += ((-22) - rx) * .01;                      // drift back to a nice viewing angle
      }
    }
    apply();
  }

  /* Drag starts only after the pointer moves a few px, so a plain click
     lands on the side under the cursor as a normal button click.        */
  scene.addEventListener('pointerdown', e=>{
    if(e.button !== undefined && e.button !== 0) return;
    pressed = true; dragging = false; pid = e.pointerId;
    lastX = startX = e.clientX; lastY = startY = e.clientY; vx = vy = 0;
  });
  scene.addEventListener('pointermove', e=>{
    if(!pressed) return;
    if(!dragging){
      if(Math.hypot(e.clientX-startX, e.clientY-startY) < 6) return;
      dragging = true; snapping = null;
      try{ scene.setPointerCapture(pid); }catch(err){}
      scene.classList.add('grabbing');
      Sound.grab();
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    ry += dx*.45; rx -= dy*.45;
    vy = dx*.45; vx = -dy*.45;
  });
  function endPress(){
    if(!pressed) return;
    pressed = false;
    if(dragging){
      dragging = false; suppressClick = true; setTimeout(()=>suppressClick=false, 0);
      scene.classList.remove('grabbing');
      lastInteract = performance.now();
      if(Math.abs(vx) < .25 && Math.abs(vy) < .25) nearestSnap();
    }
  }
  scene.addEventListener('pointerup', endPress);
  scene.addEventListener('pointercancel', endPress);

  faceEls.forEach(el=>{
    el.addEventListener('click', e=>{ if(suppressClick){ e.preventDefault(); return; } activate(el.dataset.face); });
    el.addEventListener('focus', ()=>{ if(pressed) return; const [tx,ty]=faceTarget(FACES.find(x=>x.key===el.dataset.face)); snapTo(tx,ty); lastInteract = performance.now(); });
    el.addEventListener('pointerenter', ()=>{ if(!pressed && FINE_POINTER) Sound.hover(); });
  });
  // When the cube is square-on, the browser's 3D hit-testing can miss the side and report the
  // wrapper instead. Any click on the cube that didn't reach a side opens the side facing you.
  scene.addEventListener('click', e=>{
    if(suppressClick || (e.target.closest && e.target.closest('.face'))) return;
    const r = cube.parentElement.getBoundingClientRect(), pad = 8;   // un-rotated box: stays square even when the cube is tipped flat
    if(e.clientX>=r.left-pad && e.clientX<=r.right+pad && e.clientY>=r.top-pad && e.clientY<=r.bottom+pad) activate(front);
  });
  scene.addEventListener('keydown', e=>{
    const step = {ArrowLeft:[0,90], ArrowRight:[0,-90], ArrowUp:[-90,0], ArrowDown:[90,0]}[e.key];
    if(!step) return; e.preventDefault();
    snapTo(Math.round(rx/90)*90 + step[0], Math.round(ry/90)*90 + step[1]); lastInteract = performance.now();
  });
  if(goBtn) goBtn.addEventListener('click', ()=> activate(front));
  function renderSoundBtn(){
    if(!soundBtn) return;
    soundBtn.innerHTML = Sound.on ? SPEAKER_ON : SPEAKER_OFF;
    soundBtn.setAttribute('aria-pressed', Sound.on ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', Sound.on ? 'Sound effects on — turn off' : 'Sound effects off — turn on');
  }
  if(soundBtn) soundBtn.addEventListener('click', ()=>{
    Sound.on = !Sound.on;
    try{ localStorage.setItem('fc_sound', Sound.on ? 'on' : 'off'); }catch(e){}
    renderSoundBtn(); if(Sound.on) Sound.toggle();
  });
  renderSoundBtn();
  apply();
  requestAnimationFrame(loop);
}

/* =============================== TILT =============================== */
const TILT_SEL = '.fac-card, .spotlight, .progress-card, .side-card, .mod, .qb-card';
let tiltEl = null;
function resetTilt(el){ if(!el) return; el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; el.classList.remove('tilting'); }
if(FINE_POINTER && !REDUCED){
  document.addEventListener('mousemove', e=>{
    const el = e.target.closest && e.target.closest(TILT_SEL);
    if(el !== tiltEl){ resetTilt(tiltEl); tiltEl = el; }
    if(!el || el.classList.contains('flip-pre')) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left)/r.width, y = (e.clientY - r.top)/r.height;
    const strength = r.width > 500 ? 6 : 10;
    el.classList.add('tiltable','tilting');
    el.style.transition = 'transform .12s ease-out';
    el.style.transform = `perspective(1000px) rotateX(${(.5-y)*strength}deg) rotateY(${(x-.5)*strength*1.3}deg) translateZ(6px)`;
    el.style.setProperty('--gx', (x*100)+'%'); el.style.setProperty('--gy', (y*100)+'%');
  }, {passive:true});
  document.addEventListener('mouseleave', ()=>{ resetTilt(tiltEl); tiltEl = null; });
}

/* =============================== FLIP-IN =============================== */
const FLIP_SEL = '.feed-row, .work-item, .msg-item, .pub, .assign-card, .match-card, .roster-item, .fac-card, .mod, .qb-card, .upload-item';
let flipQueue = 0, flipTimer = null;
const flipIO = ('IntersectionObserver' in window) ? new IntersectionObserver(entries=>{
  entries.forEach(en=>{
    if(!en.isIntersecting) return;
    flipIO.unobserve(en.target);
    const el = en.target, delay = (flipQueue++)*85;
    clearTimeout(flipTimer); flipTimer = setTimeout(()=>{ flipQueue = 0; }, 160);
    setTimeout(()=>{
      el.classList.add('flip-done');
      const done = ()=>{ el.classList.remove('flip-pre','flip-done'); el.removeEventListener('transitionend', done); };
      el.addEventListener('transitionend', done); setTimeout(done, 1200);
    }, delay);
  });
}, {threshold:.12, rootMargin:'0px 0px -6% 0px'}) : null;
function prepFlips(root){
  if(REDUCED || !flipIO || !root.querySelectorAll) return;
  (root.matches && root.matches(FLIP_SEL) ? [root] : []).concat([...root.querySelectorAll(FLIP_SEL)])
    .forEach(el=>{ if(el.dataset.flip) return; el.dataset.flip = '1'; el.classList.add('flip-pre'); flipIO.observe(el); });
  clearTimeout(flipSweepTimer); flipSweepTimer = setTimeout(flipSweep, 900);
}
/* safety net: the observer can miss rows that are rendered while already on screen
   (e.g. a freshly sent message), which left them invisible. Reveal anything on screen. */
let flipSweepTimer = null, flipSweepRAF = 0;
function flipSweep(){
  document.querySelectorAll('.flip-pre:not(.flip-done)').forEach(el=>{
    const r = el.getBoundingClientRect();
    if(r.bottom > 0 && r.top < innerHeight){
      if(flipIO) flipIO.unobserve(el);
      el.classList.add('flip-done');
      setTimeout(()=> el.classList.remove('flip-pre','flip-done'), 700);
    }
  });
}
addEventListener('scroll', ()=>{ if(flipSweepRAF) return; flipSweepRAF = requestAnimationFrame(()=>{ flipSweepRAF = 0; clearTimeout(flipSweepTimer); flipSweepTimer = setTimeout(flipSweep, 350); }); }, {passive:true});

/* =============================== HEADINGS =============================== */
// extruded headings lean toward the pointer
let xEls = [], raf = 0, mx = innerWidth/2, my = innerHeight/2;
function refreshX(){ xEls = [...document.querySelectorAll('.x3d')]; }
if(FINE_POINTER && !REDUCED){
  document.addEventListener('mousemove', e=>{ mx = e.clientX; my = e.clientY; if(!raf) raf = requestAnimationFrame(tickX); }, {passive:true});
}
function tickX(){
  raf = 0;
  for(const el of xEls){
    if(el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if(r.bottom < 0 || r.top > innerHeight) continue;
    const dx = Math.max(-1, Math.min(1, (mx - (r.left + r.width/2)) / (innerWidth/2)));
    const dy = Math.max(-1, Math.min(1, (my - (r.top + r.height/2)) / (innerHeight/2)));
    el.style.transform = `perspective(900px) rotateY(${dx*9}deg) rotateX(${-dy*7}deg)`;
  }
}
// letter-by-letter 3D drop-in (keeps words together so wrapping still works)
function buildDrop(el){
  if(el.dataset.dropped) return;
  el.dataset.dropped = '1';
  const text = el.textContent.trim(); let i = 0;
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(' ').map(w=>`<span class="drop-word" aria-hidden="true">${[...w].map(ch=>`<span class="drop-ch" style="animation-delay:${(i++)*.04}s">${ch}</span>`).join('')}</span>`).join(' ');
}
// highlighter markers sweep in when visible
const markIO = ('IntersectionObserver' in window) ? new IntersectionObserver(es=>es.forEach(en=>{
  if(en.isIntersecting){ en.target.classList.add('on'); markIO.unobserve(en.target); }
}), {threshold:.6}) : null;
function prepMarkers(root){
  (root.querySelectorAll ? [...root.querySelectorAll('.marker')] : []).forEach(m=>{
    if(m.dataset.mk) return; m.dataset.mk = '1';
    if(markIO && !REDUCED) markIO.observe(m); else m.classList.add('on');
  });
}

/* =============================== BOOT =============================== */
function scan(root){ prepFlips(root); prepMarkers(root); root.querySelectorAll && root.querySelectorAll('[data-drop]').forEach(buildDrop); }
function boot(){
  document.querySelectorAll('[data-drop]').forEach(buildDrop);
  initCube();
  refreshX();
  prepMarkers(document);
  const app = document.getElementById('app-screen');
  if(app){
    prepFlips(app);
    new MutationObserver(muts=>{
      for(const m of muts) m.addedNodes.forEach(n=>{ if(n.nodeType===1) scan(n); });
      refreshX();
    }).observe(app, {childList:true, subtree:true});
  }
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

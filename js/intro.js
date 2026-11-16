/* FacultyConnect — login intro
   Plays once, right after a student or faculty member signs in:
   the graduation cap flips into view, its tassel swings, it is tossed into the air
   with a burst of confetti, drops back and settles in the centre, and the curtain
   lifts to reveal the site. No text, no sound. Click anywhere or press Esc to skip. */
(function(){
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAP = `
  <svg class="ix-cap-svg" viewBox="0 0 100 100" aria-hidden="true">
    <g class="ix-band"><path d="M26 47.5 L50 57.5 L74 47.5 L74 67 C66 62.5 57 62 50 65.5 C43 62 34 62.5 26 67 Z"/></g>
    <g class="ix-board"><path d="M50 17 L96 36 L50 55 L4 36 Z"/><path class="ix-shine" d="M50 21 L86 36 L50 51 Z"/></g>
    <g class="ix-tassel"><path d="M14.6 39.4 L17.6 38.2 L17.6 62 L14.6 62 Z"/><path d="M16.1 59 L22.5 75 C19.5 77.4 12.7 77.4 9.7 75 Z"/></g>
    <circle class="ix-button" cx="50" cy="36" r="2.6"/>
  </svg>`;
const COLORS = ['#D9822B','#F2B866','#F8F4EF','#E0457B','#FFFFFF','#B9691A'];

window.playIntro = function(){
  const old = document.getElementById('intro'); if(old) old.remove();
  const el = document.createElement('div');
  el.id = 'intro'; el.setAttribute('aria-hidden','true');
  el.className = REDUCED ? 'ix ix--calm' : 'ix';
  const pieces = REDUCED ? '' : Array.from({length:54}, (_,i)=>{
    const a = Math.random()*Math.PI*2, d = 140 + Math.random()*340;
    const x = Math.cos(a)*d, y = Math.sin(a)*d*0.75 - 120;
    const w = 6 + Math.random()*8, h = 4 + Math.random()*10;
    return `<i style="--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;--r:${(Math.random()*900-450).toFixed(0)}deg;--c:${COLORS[i%COLORS.length]};--w:${w.toFixed(1)}px;--h:${h.toFixed(1)}px;--dl:${(Math.random()*.18).toFixed(2)}s"></i>`;
  }).join('');
  el.innerHTML = `
    <div class="ix-bg"><div class="ix-grid"></div><div class="ix-glow"></div></div>
    <div class="ix-stage">
      <div class="ix-ring"></div>
      <div class="ix-cap">${CAP}</div>
      <div class="ix-confetti">${pieces}</div>
    </div>
    <button class="ix-skip" type="button" aria-label="Skip intro"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('ix-lock');

  let finished = false, timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  function finish(){
    if(finished) return; finished = true;
    timers.forEach(clearTimeout);
    el.classList.add('ix-out');
    document.documentElement.classList.remove('ix-lock');
    document.removeEventListener('keydown', onKey);
    setTimeout(()=> el.remove(), 900);
  }
  const onKey = e => { if(e.key==='Escape' || e.key==='Enter') finish(); };
  el.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  if(REDUCED){ at(1100, finish); return; }
  requestAnimationFrame(()=> el.classList.add('ix-go'));
  at(3300, finish);
};
})();

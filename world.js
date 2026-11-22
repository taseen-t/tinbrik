import { tunnel as layout } from './layouts.js'; // or wave

// Hero wall (cards in 3D, arranged by a layout from layouts.js), the client row reveal,
// the floating "Book a call", nav states, pause and the tab title.

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut3 = (t) => 1 - (1 - t) ** 3;
const hash = (n) => { const s = Math.sin(n * 78.233) * 43758.5453; return s - Math.floor(s); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s, r = document) => r.querySelector(s);
const hero = $('.hero'), stage = $('.stage'), world = $('.world'), intro = $('.intro'), book = $('.book');
const casesEl = $('.cases'), hint = $('.hint');
const nav = $('.nav'), floatBtn = $('.float'), pauseBtn = $('.pause'), footer = $('.foot');
const wall = JSON.parse($('#wall').textContent);
const freeIntro = 'i' in stage.dataset; // intro.js variant: CSS lays it out, reads --r / .opened
const slot = intro.querySelector('.book-slot');
let stageRect, slotRect;

let paused = false;
const still = () => reduce || paused;

// ---------- Build the wall ----------
let G, cards = [], firstCards = [], mobile = false;
let hovered = null;

const chip = document.createElement('span');
chip.className = 'chip';
chip.setAttribute('aria-hidden', 'true');
stage.append(chip);
const dot = document.createElement('span');
dot.className = 'wcur';
dot.setAttribute('aria-hidden', 'true');
dot.textContent = 'Drag';
stage.append(dot);
const moveChip = (e) => { chip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`; };

function buildWall() {
  world.textContent = '';
  mobile = innerWidth < 760;
  const k = Math.max(1, innerWidth / 1440), kc = Math.min(k, 1.35);
  G = mobile
    ? { W: 150, R: 560, Z: 330, P: 760, GAP: 22 }
    : { W: Math.round(250 * kc), R: Math.round(900 * k), Z: Math.round(540 * k), P: Math.round(1100 * k), GAP: Math.round(34 * kc) };
  Object.assign(G, { k, mobile, items: wall });
  world.style.perspective = G.P + 'px';

  // Spec `item` numbers are spread so neighbours don't repeat the same picture.
  cards = layout.build(G).map((s) => makeCard(wall[s.item % wall.length], s));
  // The cards nearest the middle at rest gate the intro, so it never starts on blank tiles.
  const rest = { turn: 0, drift: 0, tilt: 0 };
  const d = (c) => { const p = layout.place(c.spec, rest, G); return p ? Math.hypot(p.x, p.y) - p.z : Infinity; };
  firstCards = [...cards].sort((a, b) => d(a) - d(b)).slice(0, mobile ? 8 : 14);
}

function makeCard(item, spec) {
  const el = document.createElement('a');
  el.className = 'wc';
  el.href = item.url || '#';
  el.tabIndex = -1;
  el.draggable = false;
  el.style.width = spec.w + 'px';
  el.style.height = spec.h + 'px';
  const card = { el, spec, shown: false, lift: 0, ready: 0, video: null, z: 0 };
  const ready = () => { card.ready ||= performance.now(); };
  const kind = item.kind || 'photo';
  el.classList.add('wc-' + kind);
  if (kind === 'video') {
    const v = Object.assign(document.createElement('video'), { src: item.src + '#t=0.1', muted: true, loop: true, playsInline: true, preload: 'metadata' });
    if (item.poster) v.poster = item.poster;
    v.addEventListener('loadeddata', ready, { once: true });
    v.addEventListener('error', ready, { once: true });
    card.video = v;
    el.append(v);
  } else if (kind === 'pattern') {
    // Drawn tile: a CSS pattern.
    el.dataset.p = item.p;
    if (item.bg) el.style.setProperty('--bg', item.bg);
    if (item.fg) el.style.setProperty('--fg', item.fg);
    ready();
  } else {
    const img = Object.assign(document.createElement('img'), { src: item.img, alt: '', decoding: 'async', draggable: false });
    img.addEventListener('load', () => img.decode().then(ready, ready), { once: true });
    img.addEventListener('error', ready, { once: true });
    el.append(img);
  }
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovered = card;
    chip.textContent = `${item.name} · case study`;
    chip.classList.add('on');
    moveChip(e);
  });
  el.addEventListener('pointerleave', () => {
    if (hovered === card) hovered = null;
    chip.classList.remove('on');
  });
  el.addEventListener('click', (e) => { if (dragDist > 6) e.preventDefault(); });
  world.append(el);
  return card;
}

// ---------- Wall input ----------
let rot = 0;            // cylinder angle, degrees
let spin = 0;           // momentum from drags and horizontal wheel
let edgeSpin = 0;       // auto-turn when the cursor rests near a side
let drift = 0;          // columns slide upward, px
let px = 0, py = 0;     // pointer, -1..1
let mx = 0, my = 0;     // eased pointer for the wall parallax
let lastSY = scrollY, scrollBoost = 0; // scrolling spins the wall faster for a moment
let pace = 1; // eases to 0.08 while a photo is hovered
let pointerIn = false, lastMove = -1e9;
let dragging = false, dragDist = 0, dragAxis = 0, dragX = 0, downX = 0, downY = 0, touch = false;

world.addEventListener('pointerdown', (e) => {
  dragging = true; dragDist = 0; spin = 0;
  dragX = downX = e.clientX; downY = e.clientY;
  touch = e.pointerType !== 'mouse';
  dragAxis = touch ? 0 : 1; // touch decides between scroll and spin after 8px
});
world.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  if (!dragAxis) {
    const ax = Math.abs(e.clientX - downX), ay = Math.abs(e.clientY - downY);
    if (ax + ay < 8) return;
    dragAxis = ax > ay * 1.2 ? 1 : -1;
    dragX = e.clientX;
  }
  if (dragAxis < 0) return;
  const dx = e.clientX - dragX;
  dragX = e.clientX;
  dragDist += Math.abs(dx);
  if (dragDist > 6 && !world.hasPointerCapture(e.pointerId)) {
    try { world.setPointerCapture(e.pointerId); } catch {}
    world.classList.add('grab'); dot.classList.add('grab');
  }
  rot += dx * 0.09;
  spin += (dx * 6 - spin) * (touch ? 0.35 : 1);
});
const endDrag = () => { dragging = false; world.classList.remove('grab'); dot.classList.remove('grab'); };
world.addEventListener('pointerup', endDrag);
world.addEventListener('pointercancel', endDrag);

stage.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || reduce) return;
  px = (e.clientX / innerWidth) * 2 - 1;
  py = (e.clientY / innerHeight) * 2 - 1;
  pointerIn = true;
  lastMove = performance.now();
  if (hovered) moveChip(e);
  dot.style.translate = `${e.clientX}px ${e.clientY}px`;
  dot.classList.toggle('on', q < 0.05 && !e.target.closest('.book, .pause, .hint'));
});
const pointerGone = () => { pointerIn = false; edgeSpin = 0; chip.classList.remove('on'); dot.classList.remove('on'); };
stage.addEventListener('pointerleave', pointerGone);
document.addEventListener('mouseleave', pointerGone);
addEventListener('blur', pointerGone);
stage.addEventListener('wheel', (e) => {
  if (reduce || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  spin -= e.deltaX * 0.9;
  e.preventDefault();
}, { passive: false });

// ---------- Pause ----------
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.toggleAttribute('data-paused', paused);
  document.documentElement.toggleAttribute('data-paused', paused); // CSS loops (client row) pause too
  $('.pause-t', pauseBtn).textContent = paused ? 'Play motion' : 'Pause motion';
  pickVideos();
});

// ---------- Floating Book a call ----------
let docked = false, dockAnim = null;
function setDocked(on) {
  dockAnim?.cancel();
  dockAnim = null;
  const from = book.getBoundingClientRect();
  if (on) {
    book.style.visibility = 'hidden';
    floatBtn.classList.add('on');
    floatBtn.tabIndex = 0;
    floatBtn.removeAttribute('aria-hidden');
    if (reduce) return;
    const to = floatBtn.getBoundingClientRect();
    // Falls from where the hero button was, then squashes and settles.
    dockAnim = floatBtn.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, easing: 'cubic-bezier(.55,0,.9,.45)' },
      { transform: 'translate(0,0) scale(.94,1.1)', offset: 0.62, easing: 'cubic-bezier(.2,.8,.2,1)' },
      { transform: 'translate(0,3px) scale(1.16,.8)', offset: 0.74, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: 'translate(0,-4px) scale(.95,1.06)', offset: 0.87, easing: 'cubic-bezier(.3,0,.3,1)' },
      { transform: 'none' },
    ], { duration: 720 });
  } else {
    const done = () => {
      floatBtn.classList.remove('on');
      floatBtn.tabIndex = -1;
      floatBtn.setAttribute('aria-hidden', 'true');
      book.style.visibility = '';
      dockAnim = null;
    };
    if (reduce) return done();
    const to = floatBtn.getBoundingClientRect();
    dockAnim = floatBtn.animate(
      [{ transform: 'none' }, { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }],
      { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)' },
    );
    dockAnim.onfinish = done;
  }
}
// Hide the float (and pause) while the footer is on screen.
new IntersectionObserver(([e]) => {
  floatBtn.classList.toggle('foot', e.isIntersecting);
}).observe(footer);
// [data-reveal] (services statement, giant footer word): add .in once, when it scrolls into view.
const revealIO = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
}), { threshold: 0.4 });
document.querySelectorAll('[data-reveal]').forEach((el) => revealIO.observe(el));


// Service cards play their clip while hovered (one at a time, like the wall). Not with reduced motion.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const card of document.querySelectorAll('.sv-c')) {
    const v = card.querySelector('video');
    card.addEventListener('pointerenter', () => { v.play().then(() => card.classList.add('playing')).catch(() => {}); });
    card.addEventListener('pointerleave', () => { v.pause(); card.classList.remove('playing'); d.style.setProperty('--rx', '0deg'); d.style.setProperty('--ry', '0deg'); });
    const d = card.querySelector('details');
    card.addEventListener('pointermove', (e) => {
      const r = d.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      d.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`); d.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    });
  }
}

// Footer: live studio time and copy-email button.
const clock = $('.ft-time'), fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' });
const tick = () => { clock.textContent = `${fmt.format(new Date())} PKT`; };
tick(); setInterval(tick, 15000);
$('.ft-up').addEventListener('click', () => scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
for (const b of document.querySelectorAll('.ft-copy')) {
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; }
    catch { b.textContent = 'Press ⌘C'; getSelection().selectAllChildren(b.previousElementSibling); }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  });
}

// The Monthly pass flips on click; Cards / Compare swaps the deck for the table.
const hwPass = $('.hw-pass');
hwPass?.addEventListener('click', () => hwPass.setAttribute('aria-pressed', hwPass.getAttribute('aria-pressed') !== 'true'));
const hwDeck = $('.hw-deck'), hwCmp = $('#hwCmp'), hwViews = document.querySelectorAll('.hw-view button');
hwViews.forEach((b) => b.addEventListener('click', () => {
  const cmp = b.dataset.v === 'cmp';
  hwViews.forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
  hwDeck.hidden = cmp; hwCmp.hidden = !cmp;
}));

// ---------- Tab title while away ----------
const title = document.title;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { document.title = "👋 come back, we miss you"; return; }
  document.title = title;
  if (reduce) return;
  document.documentElement.classList.remove('oven');
  void document.documentElement.offsetWidth; // restart the animation
  document.documentElement.classList.add('oven');
  setTimeout(() => document.documentElement.classList.remove('oven'), 4600);
});

// ---------- Layout ----------
let introH = 0, bookH = 56, stageH = innerHeight;
function measure() {
  introH = intro.offsetHeight;
  bookH = book.offsetHeight || 56;
  stageH = stage.offsetHeight || innerHeight;
  floatBtn.style.width = (book.offsetWidth || 168) + 'px';
  floatBtn.style.height = bookH + 'px';
}
document.fonts?.ready.then(measure);
let resizeT = 0, lastW = innerWidth;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    measure();
    if ((innerWidth < 760) !== (lastW < 760)) buildWall();
    lastW = innerWidth;
  }, 120);
});
buildWall();
measure();

// ---------- Frame ----------
const start = performance.now();
let last = start, t0 = 0, q = 0, navState = '';

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Start once the middle photos are ready (max 1.2 s), but not before the loader's bricks are built.
  if (!t0 && now - start > (reduce ? 0 : 850) && (now - start > 1200 || firstCards.every((c) => c.ready))) { t0 = now; document.documentElement.classList.add('built'); }
  const life = t0 ? (now - t0) / 1000 : 0;

  // Read every rect here, before this frame writes styles, so the browser never has to lay out twice.
  const hr = hero.getBoundingClientRect();
  if (freeIntro) { stageRect = stage.getBoundingClientRect(); slotRect = slot.getBoundingClientRect(); }
  const target = clamp(-hr.top / (innerHeight * 0.9)); // 0 = wall, 1 = opened
  q = reduce || Math.abs(target - q) < 5e-4 ? target : q + (target - q) * (1 - Math.exp(-dt / 0.1));

  if (hr.bottom > 0) {
    drawWall(now, dt, life);
    drawIntro(life);
  }

  const state = hr.bottom < innerHeight * 0.5 ? 'stuck' : scrollY < 8 ? 'top' : 'away';
  if (state !== navState) nav.dataset.state = navState = state;

  if (life > 1.7) {
    const past = docked ? hr.bottom < innerHeight + 8 : hr.bottom < innerHeight - 8;
    if (past !== docked) {
      docked = past;
      setDocked(docked);
      pauseBtn.classList.toggle('gone', docked);
    }
  }
  requestAnimationFrame(frame);
}

// Playing videos inside moving 3D tiles cost the most: on Taseen's Mac 1 playing video keeps
// 60 fps, 2 drop the wall to 30. So only the video nearest the middle plays; the rest hold a still frame.
// ponytail: fixed cap of 1, raise it once the real videos are encoded small (e.g. 480p, same fps).
let videoT = 0;
function pickVideos() {
  const max = still() ? 0 : 1;
  const live = cards.filter((c) => c.video && c.shown).sort((a, b) => b.near - a.near); // biggest on screen first
  live.forEach((c, i) => (i < max ? c.video.play().catch(() => {}) : c.video.pause()));
}

function drawWall(now, dt, life) {
  if (!dragging) {
    spin *= 0.04 ** dt;
    const atEdge = pointerIn && now - lastMove > 450 && Math.abs(px) > 0.78 && !hovered;
    const want = atEdge ? Math.sign(px) * 14 * Math.min(1, (Math.abs(px) - 0.78) / 0.2) : 0;
    edgeSpin += (want - edgeSpin) * (1 - 0.02 ** dt);
    // Page scroll speed (px/s) adds spin, eased in and out so it surges, then settles.
    const sv = dt > 0 ? Math.abs(scrollY - lastSY) / dt : 0;
    scrollBoost += ((still() ? 0 : Math.min(90, sv * 0.06)) - scrollBoost) * (1 - 0.01 ** dt);
    pace += ((hovered ? 0.08 : 1) - pace) * (1 - 0.003 ** dt);
    rot += ((still() ? 0 : 7 * pace) + spin + edgeSpin + scrollBoost * pace) * dt;
  }
  lastSY = scrollY;
  if (!still()) drift += 22 * pace * dt;
  // Cards fly out from under a still cursor without a pointerleave, so drop the hover here.
  if (q > 0.05 && hovered) { hovered = null; chip.classList.remove('on'); }
  if (q > 0.05) dot.classList.remove('on');

  if (!reduce) { const k = 1 - 0.02 ** dt, tx = pointerIn ? px : 0, ty = pointerIn ? py : 0;
    mx += (tx - mx) * k; my += (ty - my) * k;
    world.style.perspectiveOrigin = `${(50 + mx * 8).toFixed(2)}% ${(50 + my * 8).toFixed(2)}%`; }
  const { P } = G;
  const t = { turn: rot, drift, tilt: 0 }, diag = Math.hypot(innerWidth, innerHeight);
  // Hover: only tiles inside a small circle around the cursor rise a little; the wave keeps running.
  const cx = px * innerWidth / 2, cy = py * innerHeight / 2, near = pointerIn && q < 0.2 && !dragging;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i], { w, h } = card.spec;
    const pose = q < 1 ? layout.place(card.spec, t, G) : null;
    let show = !!pose, opacity = 1;
    if (pose) {
      let { x, y } = pose;
      // Where the card sits on screen decides which way it flies when the wall opens.
      const s = P / (P - pose.z), sx = x * s, sy = y * s, d = Math.hypot(sx, sy);
      card.d = d; card.near = s;
      const dir = d < 40 ? hash(i + 13) * Math.PI * 2 : Math.atan2(sy, sx);
      const open = smooth(clamp((q - Math.min(1, d / 900) * 0.3) / 0.7));
      if (open > 0.995) show = false;
      else {
        const push = ((Math.max(0, diag / 1.7 - d) + 250) / s) * open;
        const stagger = d / 700;
        const enter = reduce ? 1 : easeOut3(clamp((life - 0.1 - stagger * 0.9) / 0.9));
        x += Math.cos(dir) * push;
        y += Math.sin(dir) * push;
        const want = near ? clamp(1 - Math.hypot(sx - cx, sy - cy) / 300) : 0;
        card.lift += (want * want - card.lift) * (1 - 0.004 ** dt);
        const z = pose.z - (1 - enter) * 500 + 160 * open + card.lift * 45;
        if (z > P * 0.7) show = false;
        opacity = enter * (pose.fade ?? 1) * Math.min(1, (P * 0.7 - z) / 250) * (card.ready ? clamp((now - card.ready) / 220) : 0);
        if (show) {
          const ry = pose.ry + card.lift * clamp((cx - sx) / 220, -1, 1) * 18, rx = pose.rx - card.lift * clamp((cy - sy) / 220, -1, 1) * 18;
          card.el.style.transform =
            `translate3d(${(x - w / 2).toFixed(1)}px,${(y - h / 2).toFixed(1)}px,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
          // Nearer cards paint on top (siblings aren't depth-sorted without preserve-3d).
          const zi = Math.round(z / 8) + 1000;
          if (zi !== card.z) card.el.style.zIndex = card.z = zi;
        }
      }
    }
    if (show !== card.shown) {
      card.shown = show;
      card.el.style.visibility = show ? 'visible' : 'hidden';
      if (card.video && !show) card.video.pause();
    }
    if (show) card.el.style.opacity = opacity.toFixed(3);
  }
  if (now - videoT > 400) { videoT = now; pickVideos(); }
}

function drawIntro(life) {
  const reveal = easeOut3(clamp((q - 0.45) / 0.4));
  intro.style.opacity = reveal.toFixed(3);
  const from = stageH / 2 - bookH / 2;
  if (freeIntro) {
    stage.style.setProperty('--r', reveal.toFixed(3));
    stage.classList.toggle('opened', reveal > 0.6);
    // Book a call: centre of the wall, then into the variant's .book-slot.
    const sr = stageRect, r = slotRect, k = smooth(q);
    const tx = r.left + r.width / 2 - sr.left - sr.width / 2, ty = r.top + r.height / 2 - sr.top - bookH / 2;
    book.style.transform = `translate(calc(-50% + ${(tx * k).toFixed(1)}px), ${(from + (ty - from) * k).toFixed(1)}px)`;
  } else {
    intro.style.transform = `translate(-50%, calc(-50% + ${((1 - reveal) * 14).toFixed(1)}px))`;
    // Book a call: centre of the wall, then just under the intro text.
    const to = stageH / 2 - 90 + introH / 2 + 36;
    book.style.transform = `translate(-50%, ${(from + (to - from) * smooth(q)).toFixed(1)}px)`;
  }
  book.style.opacity = clamp((life - 1.2) / 0.5).toFixed(3);

  casesEl.style.opacity = reveal.toFixed(3);
  casesEl.style.transform = `translateY(${((1 - reveal) * 16).toFixed(1)}px)`;
  casesEl.style.pointerEvents = reveal > 0.5 ? 'auto' : 'none';
  if ((reveal > 0.5) === casesEl.inert) casesEl.inert = reveal <= 0.5;

  hint.style.opacity = life > 1.8 && q < 0.04 ? '1' : '0';
}

requestAnimationFrame(frame);

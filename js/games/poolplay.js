// 8-ball vs computer on top of poolphys.js. Simplified WPA-style rules:
// open table after the break; first legal pot decides groups; foul (scratch, no hit, wrong ball first) = ball in hand;
// potting the 8 early or with a foul loses, potting it after clearing your group wins.
// Phone-first: the table fills the screen, turns sideways in landscape, and you shoot by pulling the power bar.
import { simulate, aimFor, firstContact, POCKETS, W, H, R } from './poolphys.js';
import { makeView, canFullscreen, toggleFullscreen, phoneLandscape } from './fitview.js';

const M = 28, CUSH = 9; // rail width around the playing area, cushion rubber inside it
const TW = W + 2 * M, TH = H + 2 * M;
function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 34); }
const COL = { 1: '#f5c400', 2: '#1747c9', 3: '#d8232a', 4: '#5b2a9e', 5: '#f07a12', 6: '#0c8a43', 7: '#86201d', 8: '#141414' };
const color = (n) => (n === 0 ? '#f7f4ea' : COL[n > 8 ? n - 8 : n]);
const groupOf = (n) => (n >= 1 && n <= 7 ? 'solid' : n >= 9 ? 'stripe' : null);
const MSG = {
  break: { en: 'Your break! Aim on the table, pull the bar, let go.', de: 'Dein Anstoß! Zielen, Balken ziehen, loslassen.' },
  aim: { en: 'Your shot. Aim on the table, pull the bar and let go.', de: 'Du bist dran. Zielen, Balken ziehen, loslassen.' },
  inHand: { en: 'Ball in hand: move the white ball, then aim.', de: 'Freie Lage: Schieb die Weiße, dann ziele.' },
  cpu: { en: 'Computer is playing…', de: 'Der Computer spielt…' },
  pull: { en: 'pull & release', de: 'ziehen & loslassen' },
  spinL: { en: 'Spin', de: 'Effet' },
  open: { en: 'open', de: 'offen' },
  you: { en: 'You', de: 'Du' }, cpuName: { en: 'Computer', de: 'Computer' },
  solid: { en: 'solids', de: 'Volle' }, stripe: { en: 'stripes', de: 'Halbe' },
  foulScratch: { en: 'Foul: the white went in.', de: 'Foul: Die Weiße ist gefallen.' },
  foulNone: { en: 'Foul: no ball was hit.', de: 'Foul: Keine Kugel getroffen.' },
  foulWrong: { en: 'Foul: wrong ball hit first.', de: 'Foul: Falsche Kugel zuerst getroffen.' },
  youGet: { en: 'You get ball in hand.', de: 'Du hast freie Lage.' },
  cpuGets: { en: 'Computer gets ball in hand.', de: 'Der Computer hat freie Lage.' },
  win8: { en: 'You sank the 8-ball. Game!', de: 'Du hast die 8 versenkt. Gewonnen!' },
  lose8early: { en: 'The 8-ball went in too early (or with a foul).', de: 'Die 8 fiel zu früh (oder mit Foul).' },
  cpuWin8: { en: 'The computer sank the 8-ball.', de: 'Der Computer hat die 8 versenkt.' },
  cpuLose8: { en: 'The computer sank the 8 too early. You win!', de: 'Der Computer hat die 8 zu früh versenkt. Du gewinnst!' },
  spin: [{ en: 'Draw', de: 'Rück' }, { en: 'Stun', de: 'Stopp' }, { en: 'Follow', de: 'Nach' }],
};

function rack() {
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 13, 5, 14, 6, 15, 7]; // 8 in the centre, mixed corners
  const balls = [{ n: 0, x: W / 2, y: H * 0.75 }];
  let k = 0;
  for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) {
    const jitter = (Math.random() - 0.5) * 0.4;
    balls.push({ n: order[k++], x: W / 2 + (i - row / 2) * 2 * R * 1.002 + jitter, y: H * 0.25 - row * 2 * R * 0.868 });
  }
  return balls;
}

// seeded noise so the felt and wood grain look the same every time
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export function playPool(stage, ctx) {
  const app = document.getElementById('app');
  app?.classList.add('wide');
  const wrap = document.createElement('div'); wrap.className = 'pgame';
  wrap.innerHTML = `<div class="ptop"><button class="pico pexit" title="✕">✕</button><div class="pl me"></div><div class="pl cpu"></div>
      <button class="pico pfs" title="⛶">⛶</button></div>
    <div class="phint"></div>
    <div class="pmain"><div class="pcvbox"><canvas class="gcv"></canvas></div>
      <div class="pside">
        <div class="pspinw"><div class="pspin"><i></i></div><span></span></div>
        <button class="pico pfine" data-n="-1">◀</button>
        <div class="ppow"><div class="pfill"></div><div class="pcue"></div><span></span></div>
        <button class="pico pfine" data-n="1">▶</button>
      </div></div>`;
  stage.append(wrap);
  const $ = (s) => wrap.querySelector(s);
  const cv = $('canvas'), g = cv.getContext('2d'), hintEl = $('.phint'), powEl = $('.ppow'), fillEl = $('.pfill'), cueEl = $('.pcue');
  const spinEl = $('.pspin'), spinDot = $('.pspin i'), spinLbl = $('.pspinw span');
  $('.ppow span').textContent = ctx.t(MSG.pull);
  const view = makeView(cv, TW, TH);
  const bg = document.createElement('canvas'), bgg = bg.getContext('2d');

  let balls = rack(), turn = 'me', groups = { me: null, cpu: null }, inHand = false, breakShot = true, phase = 'aim';
  let angle = -Math.PI / 2, spin = 0, alive = true, cpuAim = null, power = 0, pulling = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };
  const cue = () => balls.find((b) => b.n === 0);
  const other = (w) => (w === 'me' ? 'cpu' : 'me');
  const say = (m) => { hintEl.textContent = m ? ctx.t(m) : ''; };
  const speedOf = (p) => 120 + (p / 100) * 1500;
  const myTurn = () => turn === 'me' && phase === 'aim';

  // ---------- layout: pick the bigger table (upright vs sideways) ----------
  function layout() {
    if (!alive) return;
    const fs = (phoneLandscape() || document.fullscreenElement === wrap) && phase !== 'over';
    wrap.classList.toggle('fs', fs);
    document.body.style.overflow = fs ? 'hidden' : '';
    let sUp = 0, sSide, side;
    if (fs) { // phone sideways: players + hint in a left column, so the table gets the full height
      const lw = $('.ptop').offsetWidth || 150;
      sSide = view.fit(true, wrap.clientWidth - lw - 108 - 20, wrap.clientHeight - 10); side = true;
    } else {
      const top = $('.ptop').offsetHeight + hintEl.offsetHeight + 8;
      const W0 = wrap.clientWidth, H0 = window.innerHeight - 16 - top;
      sUp = view.fit(false, W0, H0 - 70); sSide = view.fit(true, W0 - 108, H0);
      side = sSide > sUp * 1.05;
    }
    wrap.classList.toggle('side', side);
    view.size(side, side ? sSide : sUp);
    paintTable(); draw();
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(wrap);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  document.addEventListener('fullscreenchange', onResize);
  $('.pexit').onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); location.hash = '#/g/pool'; };
  const fsBtn = $('.pfs'); if (!canFullscreen()) fsBtn.style.display = 'none';
  fsBtn.onclick = () => toggleFullscreen(wrap);

  // ---------- controls ----------
  function setSpin(v) {
    spin = v; spinDot.style.top = 50 - v * 30 + '%';
    spinLbl.textContent = ctx.t(MSG.spin[v + 1]); draw();
  }
  spinEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); const r = spinEl.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
    setSpin(y < 0.36 ? 1 : y > 0.64 ? -1 : 0); ctx.sfx.tap();
  });
  wrap.querySelectorAll('.pfine').forEach((b) => {
    let iv = null, to = null; const d = +b.dataset.n * 0.12 * Math.PI / 180;
    const stop = () => { clearTimeout(to); clearInterval(iv); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!myTurn()) return; angle += d; draw(); to = setTimeout(() => { iv = setInterval(() => { angle += d; draw(); }, 45); }, 280); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
  });
  // power bar: press, pull along the bar, let go = shoot (pull back to the start to cancel)
  function showPower() {
    const vert = wrap.classList.contains('side');
    fillEl.style.cssText = vert ? `height:${power * 100}%;width:100%` : `width:${power * 100}%;height:100%`;
    cueEl.style.cssText = vert ? `top:${power * 86}%` : `left:${power * 86}%`;
  }
  powEl.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return; e.preventDefault();
    try { powEl.setPointerCapture(e.pointerId); } catch {}
    pulling = { x: e.clientX, y: e.clientY }; power = 0; showPower(); draw();
  });
  powEl.addEventListener('pointermove', (e) => {
    if (!pulling) return;
    const vert = wrap.classList.contains('side'), r = powEl.getBoundingClientRect();
    const d = vert ? e.clientY - pulling.y : Math.abs(e.clientX - pulling.x);
    power = Math.max(0, Math.min(1, d / ((vert ? r.height : r.width) * 0.8)));
    showPower(); draw();
  });
  const release = () => {
    if (!pulling) return; pulling = null;
    const p = power; power = 0; showPower();
    if (p > 0.04 && myTurn()) shoot({ angle, speed: speedOf(p * 100), spin, pull: 4 + p * 70 }); else draw();
  };
  powEl.addEventListener('pointerup', release);
  powEl.addEventListener('pointercancel', () => { pulling = null; power = 0; showPower(); draw(); });

  // ---------- table input ----------
  const toTable = (e) => { const p = view.toLocal(e); return [p[0] - M, p[1] - M]; };
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    const p = toTable(e), c = cue();
    try { cv.setPointerCapture(e.pointerId); } catch {}
    if (inHand && Math.hypot(p[0] - c.x, p[1] - c.y) < 3.2 * R) drag = 'cue'; else { drag = 'aim'; aimAt(p); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || !myTurn()) return;
    const p = toTable(e);
    if (drag === 'cue') placeCue(p[0], p[1]); else aimAt(p);
  });
  cv.addEventListener('pointerup', () => { drag = null; });
  function aimAt(p) { const c = cue(); if (Math.hypot(p[0] - c.x, p[1] - c.y) < 4) return; angle = Math.atan2(p[1] - c.y, p[0] - c.x); draw(); }
  function freeSpot(x, y) {
    x = Math.min(W - R, Math.max(R, x)); y = Math.min(H - R, Math.max(R, y));
    return balls.every((b) => b.n === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.5) ? [x, y] : null;
  }
  function placeCue(x, y) { const s = freeSpot(x, y); if (s) { const c = cue(); c.x = s[0]; c.y = s[1]; draw(); } }

  // ---------- static table (painted once per size) ----------
  function paintTable() {
    bg.width = cv.width; bg.height = cv.height;
    const q = bgg; view.apply(q);
    const rnd = rng(7);
    // walnut rail with grain
    const wood = q.createLinearGradient(0, 0, TW, 0);
    wood.addColorStop(0, '#4b2812'); wood.addColorStop(0.18, '#6d3c1c'); wood.addColorStop(0.5, '#7d4822'); wood.addColorStop(0.82, '#6d3c1c'); wood.addColorStop(1, '#4b2812');
    q.fillStyle = wood; q.beginPath(); q.roundRect(0, 0, TW, TH, 20); q.fill();
    q.save(); q.beginPath(); q.roundRect(0, 0, TW, TH, 20); q.clip();
    for (let i = 0; i < 46; i++) {
      const x = rnd() * TW; q.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,.13)' : 'rgba(255,220,170,.06)'; q.lineWidth = 0.6 + rnd() * 1.6;
      q.beginPath(); q.moveTo(x, 0); q.bezierCurveTo(x + 6 - rnd() * 12, TH * 0.33, x + 6 - rnd() * 12, TH * 0.66, x + 4 - rnd() * 8, TH); q.stroke();
    }
    q.restore();
    // outer bevel highlight + inner dark edge
    q.strokeStyle = 'rgba(255,230,190,.28)'; q.lineWidth = 2; q.beginPath(); q.roundRect(1.5, 1.5, TW - 3, TH - 3, 19); q.stroke();
    q.strokeStyle = 'rgba(0,0,0,.55)'; q.lineWidth = 3; q.strokeRect(M - CUSH - 1.5, M - CUSH - 1.5, W + 2 * CUSH + 3, H + 2 * CUSH + 3);
    // cushions
    q.fillStyle = '#0f5634'; q.fillRect(M - CUSH, M - CUSH, W + 2 * CUSH, H + 2 * CUSH);
    // felt + fine noise
    const felt = q.createRadialGradient(M + W / 2, M + H / 2, 30, M + W / 2, M + H / 2, H * 0.62);
    felt.addColorStop(0, '#23985f'); felt.addColorStop(1, '#167246');
    q.fillStyle = felt; q.fillRect(M, M, W, H);
    for (let i = 0; i < 2600; i++) { q.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; q.fillRect(M + rnd() * W, M + rnd() * H, 1.2, 1.2); }
    // cushion nose shading
    q.strokeStyle = 'rgba(0,0,0,.35)'; q.lineWidth = 2; q.strokeRect(M + 1, M + 1, W - 2, H - 2);
    q.strokeStyle = 'rgba(120,220,160,.35)'; q.lineWidth = 1.2; q.strokeRect(M - 0.6, M - 0.6, W + 1.2, H + 1.2);
    // head string + foot spot
    q.strokeStyle = 'rgba(255,255,255,.16)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(M, M + H * 0.75); q.lineTo(M + W, M + H * 0.75); q.stroke();
    q.fillStyle = 'rgba(255,255,255,.35)'; q.beginPath(); q.arc(M + W / 2, M + H * 0.25, 2.2, 0, 7); q.fill();
    // pearl diamonds on the rails
    const dia = (x, y) => { q.save(); q.translate(x, y); q.rotate(Math.PI / 4); const gr = q.createLinearGradient(-3, -3, 3, 3); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#c9b48a'); q.fillStyle = gr; q.fillRect(-2.6, -2.6, 5.2, 5.2); q.restore(); };
    const rm = (M - CUSH) / 2;
    for (let i = 1; i < 4; i++) for (const y of [rm, TH - rm]) dia(M + (W * i) / 4, y);
    for (let i = 1; i < 8; i++) { if (i === 4) continue; for (const x of [rm, TW - rm]) dia(x, M + (H * i) / 8); }
    // pockets: cut through cushion, dark hole, leather rim
    POCKETS.forEach(([px, py], i) => {
      const side = i === 2 || i === 3, r = side ? 16 : 19, x = M + px + (side ? (px ? 4 : -4) : 0), y = M + py;
      q.fillStyle = '#2a170b'; q.beginPath(); q.arc(x, y, r + 5, 0, 7); q.fill();
      const ho = q.createRadialGradient(x, y, 2, x, y, r); ho.addColorStop(0, '#000'); ho.addColorStop(0.75, '#070707'); ho.addColorStop(1, '#262626');
      q.fillStyle = ho; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill();
      q.strokeStyle = 'rgba(255,220,170,.22)'; q.lineWidth = 1.4; q.beginPath(); q.arc(x, y, r + 4, 0, 7); q.stroke();
    });
  }

  // ---------- dynamic drawing ----------
  // rolling: each ball keeps a roll phase (distance / radius) and the direction it last rolled in
  const roll = new Map();
  function rollTo(n, x, y) {
    const r = roll.get(n);
    if (!r) { roll.set(n, { x, y, ph: 0, ux: 1, uy: 0 }); return; }
    const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { r.ux = dx / d; r.uy = dy / d; r.ph += d / R; }
    r.x = x; r.y = y;
  }
  function ballAt(x, y, n, alpha = 1, scale = 1, dark = 0) {
    g.save(); g.globalAlpha = alpha; g.translate(M + x, M + y); if (scale !== 1) g.scale(scale, scale);
    g.save(); if (view.rot) g.rotate(-Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(2.4, 3.4, R * 1.02, R * 0.9, 0, 0, 7); g.fill();
    g.restore();
    const base = color(n), rs = roll.get(n) || { ph: 0, ux: 1, uy: 0 };
    // markings slide across the ball and foreshorten as it turns (numbers sit on two opposite sides)
    const sn = Math.sin(rs.ph), cs = Math.cos(rs.ph), ang = Math.atan2(rs.uy, rs.ux), fore = 0.5 + 0.5 * Math.abs(cs); // never fully edge-on, so stripes and numbers stay readable
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip();
    if (n > 8) {
      g.fillStyle = '#f7f4ea'; g.fillRect(-R, -R, 2 * R, 2 * R);
      // the coloured band turns with the ball
      g.save(); g.rotate(ang); g.translate(sn * R * 0.45, 0); g.scale(fore, 1); g.fillStyle = base; g.fillRect(-R * 0.56, -R * 1.2, R * 1.12, R * 2.4); g.restore();
    } else { g.fillStyle = base; g.fillRect(-R, -R, 2 * R, 2 * R); }
    if (n) {
      g.save(); g.rotate(ang); g.translate(sn * R * 0.42, 0); g.scale(fore, 1); g.rotate(-ang);
      if (view.rot) g.rotate(-Math.PI / 2);
      g.fillStyle = '#fbf8ee'; g.beginPath(); g.arc(0, 0, R * 0.5, 0, 7); g.fill();
      g.fillStyle = '#151515'; g.font = `bold ${n > 9 ? R * 0.62 : R * 0.74}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 0.6);
      g.restore();
    }
    g.restore();
    if (view.rot) g.rotate(-Math.PI / 2);
    const sh = g.createRadialGradient(-R * 0.38, -R * 0.42, R * 0.05, 0, 0, R * 1.05);
    sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.28, 'rgba(255,255,255,.07)'); sh.addColorStop(0.72, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(-R * 0.4, -R * 0.46, R * 0.2, R * 0.13, -0.6, 0, 7); g.fill();
    if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); }
    g.restore();
  }
  // tapered cue: tip, white ferrule, maple shaft, dark butt with a brass ring
  function cueStick(c, a, pull) {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, back = R + 4 + pull, len = 330;
    const at = (t) => [M + c.x - dx * (back + t * len), M + c.y - dy * (back + t * len)];
    const wid = (t) => 2.3 + t * 3.4; // half width
    const seg = (t0, t1, fill) => {
      const [x0, y0] = at(t0), [x1, y1] = at(t1), w0 = wid(t0), w1 = wid(t1);
      g.fillStyle = fill; g.beginPath();
      g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.closePath(); g.fill();
    };
    g.save();
    g.translate(4, 6); g.globalAlpha = 0.35; seg(0, 1, '#000'); g.globalAlpha = 1; g.translate(-4, -6);
    const [sx, sy] = at(0.05), [ex, ey] = at(0.6);
    const maple = g.createLinearGradient(sx + nx * 3, sy + ny * 3, sx - nx * 3, sy - ny * 3);
    maple.addColorStop(0, '#f6e2b8'); maple.addColorStop(0.5, '#e2bf82'); maple.addColorStop(1, '#b58a4f');
    const butt = g.createLinearGradient(ex + nx * 6, ey + ny * 6, ex - nx * 6, ey - ny * 6);
    butt.addColorStop(0, '#5a2d14'); butt.addColorStop(0.5, '#2e140a'); butt.addColorStop(1, '#150904');
    seg(0, 0.012, '#2f6fb3'); seg(0.012, 0.045, '#f4f1ea'); seg(0.045, 0.6, maple); seg(0.6, 0.62, '#d9ac5c'); seg(0.62, 0.97, butt); seg(0.97, 1, '#0b0b0b');
    g.restore();
  }
  // thick line with a dark outline so it reads on any felt and on small screens
  function line(x0, y0, x1, y1, col, w, dash) {
    g.save(); g.lineCap = 'round'; if (dash) g.setLineDash(dash);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = w + 2.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  }
  function ring(x, y, r, col, w, fill) {
    g.save(); if (fill) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = w + 2.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore();
  }
  function arrowHead(x, y, a, col) {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -6); g.lineTo(-5, 6); g.closePath(); g.stroke(); g.fill(); g.restore();
  }
  // distance from the cue ball to the cushion along the aim
  function toWall(c, a) {
    const dx = Math.cos(a), dy = Math.sin(a); let t = 1e9;
    if (dx > 1e-6) t = Math.min(t, (W - R - c.x) / dx); if (dx < -1e-6) t = Math.min(t, (R - c.x) / dx);
    if (dy > 1e-6) t = Math.min(t, (H - R - c.y) / dy); if (dy < -1e-6) t = Math.min(t, (R - c.y) / dy);
    return Math.max(0, t);
  }
  function guide() {
    const c = cue(), fc = firstContact(balls, c.x, c.y, angle), WHITE = 'rgba(255,255,255,.95)', GOLD = '#ffd45a';
    if (!fc) {
      const L = toWall(c, angle), ex = M + c.x + Math.cos(angle) * L, ey = M + c.y + Math.sin(angle) * L;
      line(M + c.x, M + c.y, ex, ey, WHITE, 2.6); ring(ex, ey, R, WHITE, 2.4, 'rgba(255,255,255,.12)'); return;
    }
    line(M + c.x, M + c.y, M + fc.gx, M + fc.gy, WHITE, 2.6);
    ring(M + fc.gx, M + fc.gy, R, WHITE, 2.4, 'rgba(255,255,255,.14)');
    const objLen = [150, 80, 40][ctx.level] ?? 80, ox = M + fc.ball.x + fc.ox * (R + 3), oy = M + fc.ball.y + fc.oy * (R + 3);
    const tx = ox + fc.ox * objLen, ty = oy + fc.oy * objLen;
    line(ox, oy, tx, ty, GOLD, 3.2); arrowHead(tx, ty, Math.atan2(fc.oy, fc.ox), GOLD);
    if (ctx.level === 0) { // where the white goes (90° rule)
      let qx = -fc.oy, qy = fc.ox; if (qx * Math.cos(angle) + qy * Math.sin(angle) < 0) { qx = -qx; qy = -qy; }
      line(M + fc.gx, M + fc.gy, M + fc.gx + qx * 60, M + fc.gy + qy * 60, 'rgba(255,255,255,.6)', 2, [7, 6]);
    }
    const own = groups[turn];
    const bad = (own && groupOf(fc.ball.n) !== own && !(fc.ball.n === 8 && cleared(turn))) || (!own && fc.ball.n === 8);
    if (bad) ring(M + fc.ball.x, M + fc.ball.y, R + 4, '#ff4a3a', 3);
  }
  function draw(pos, extra) {
    if (!alive || !bg.width) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); view.apply(g);
    const list = pos || balls;
    if (!pos && myTurn()) guide();
    if (extra && extra.sink) for (const s of extra.sink) ballAt(s.x, s.y, s.n, s.a, s.k, s.d);
    for (const b of list) if (b) ballAt(b.x, b.y, b.n);
    if (extra && extra.cue) { g.save(); g.globalAlpha = extra.cue.alpha; cueStick(extra.cue.c, extra.cue.a, extra.cue.pull); g.restore(); }
    if (!pos && phase === 'aim') {
      if (turn === 'me') {
        if (inHand) { const c = cue(); const k = (performance.now() / 600) % 1; ring(M + c.x, M + c.y, R + 6 + k * 4, '#ffd45a', 2.6); }
        cueStick(cue(), angle, 4 + power * 70);
      } else if (cpuAim) cueStick(cue(), cpuAim.a, cpuAim.pull);
    }
    renderInfo();
  }
  function renderInfo() {
    const gname = (w) => (groups[w] ? ctx.t(MSG[groups[w]]) : ctx.t(MSG.open));
    const gone = (gp) => [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].filter((n) => groupOf(n) === gp && !balls.some((b) => b.n === n));
    const dots = (w) => (groups[w] ? gone(groups[w]) : []).map((n) => `<i class="pb ${n > 8 ? 'st' : ''}" style="--c:${color(n)}">${n}</i>`).join('');
    const html = (w, name) => `<b>${ctx.t(name)}</b> <small>${gname(w)}</small><span>${dots(w)}</span>`;
    const me = $('.pl.me'), cp = $('.pl.cpu'), hm = html('me', MSG.you), hc = html('cpu', MSG.cpuName);
    if (me.innerHTML !== hm) me.innerHTML = hm; if (cp.innerHTML !== hc) cp.innerHTML = hc;
    me.classList.toggle('on', turn === 'me'); cp.classList.toggle('on', turn === 'cpu');
    powEl.classList.toggle('off', !myTurn());
  }
  const cleared = (w) => groups[w] && !balls.some((b) => groupOf(b.n) === groups[w]);
  // ball-in-hand ring pulses
  const pulse = () => { if (!alive) return; if (inHand && myTurn() && !drag && !pulling) draw(); later(() => frame(pulse), 60); };
  pulse();
  // ---------- shot playback ----------
  function shoot(shot) {
    phase = 'anim'; renderInfo();
    const res = simulate(balls, shot, true);
    const ids = balls.map((b) => b.n);
    // the cue snaps forward from its pulled-back spot (~70 ms), hits, then fades while the balls run
    const STRIKE = 0.07, c0 = { ...cue() }, pull0 = shot.pull ?? 30;
    ctx.sfx.cue(Math.min(1, (shot.speed - 120) / 1500));
    const tStart = performance.now(), t0 = tStart + STRIKE * 1000; let evI = 0; let lastRail = 0;
    const evs = res.events.slice().sort((a, b) => a.t - b.t);
    const sinking = []; // potted balls glide into the pocket, shrink and darken
    let prev = res.frames[0];
    const stepF = (tm) => {
      if (!alive) return;
      const t = (tm - t0) / 1000, fi = Math.max(0, Math.min(res.frames.length - 1, Math.floor(t * 60)));
      while (evI < evs.length && evs[evI].t <= t) {
        const e = evs[evI++];
        if (e.type === 'hit' && e.v > 25) ctx.sfx.ball(e.v);
        else if (e.type === 'pot') {
          later(() => ctx.sfx.pocket(), 110); if (ctx.sfx.buzz) ctx.sfx.buzz(20);
          const last = prev[ids.indexOf(e.n)];
          if (last) {
            let best = POCKETS[0];
            for (const pk of POCKETS) if (Math.hypot(pk[0] - last[0], pk[1] - last[1]) < Math.hypot(best[0] - last[0], best[1] - last[1])) best = pk;
            sinking.push({ n: e.n, x0: last[0], y0: last[1], px: best[0], py: best[1], t: e.t });
          }
        } else if (e.type === 'rail' && e.v > 60 && e.t - lastRail > 0.05) { lastRail = e.t; ctx.sfx.rail(e.v); }
      }
      const cur = res.frames[fi];
      cur.forEach((p, i) => { if (p) rollTo(ids[i], p[0], p[1]); });
      prev = cur.map((p, i) => p || prev[i]);
      const sink = sinking.map((s) => {
        const k = Math.min(1, (t - s.t) / 0.2), e = 1 - (1 - k) * (1 - k);
        return { n: s.n, x: s.x0 + (s.px - s.x0) * e, y: s.y0 + (s.py - s.y0) * e, k: 1 - 0.35 * e, a: 1 - k, d: 0.5 * e, done: k >= 1 };
      }).filter((s) => !s.done);
      const ts = (tm - tStart) / 1000;
      let cueFx = null;
      if (ts < STRIKE + 0.22) {
        const k = Math.min(1, ts / STRIKE);
        cueFx = { c: c0, a: shot.angle, pull: ts < STRIKE ? pull0 * (1 - k * k) - 2 : -2, alpha: ts < STRIKE ? 1 : Math.max(0, 1 - (ts - STRIKE) / 0.22) };
      }
      draw(cur.map((p, i) => (p ? { x: p[0], y: p[1], n: ids[i] } : null)), { sink, cue: cueFx });
      if (fi < res.frames.length - 1 || sink.length || cueFx) frame(stepF); else later(() => afterShot(res), 150);
    };
    frame(stepF);
  }
  function afterShot(res) {
    const shooter = turn, own = groups[shooter], wasCleared = cleared(shooter);
    balls = res.balls;
    const pottedObj = res.potted.filter((n) => n !== 0 && n !== 8);
    let foul = null;
    if (res.potted.includes(0)) foul = MSG.foulScratch;
    else if (res.firstHit == null) foul = MSG.foulNone;
    else if (own && groupOf(res.firstHit) !== own && !(wasCleared && res.firstHit === 8)) foul = MSG.foulWrong;
    else if (!own && res.firstHit === 8 && !breakShot) foul = MSG.foulWrong;
    // the 8-ball
    if (res.potted.includes(8)) {
      if (breakShot) { balls.push({ n: 8, ...spot(W / 2, H * 0.25) }); }
      else {
        const won = wasCleared && !foul;
        phase = 'over'; layout();
        if (shooter === 'me') ctx.over(won ? { result: 'win', text: MSG.win8 } : { result: 'lose', text: MSG.lose8early });
        else ctx.over(won ? { result: 'lose', text: MSG.cpuWin8 } : { result: 'win', text: MSG.cpuLose8 });
        return;
      }
    }
    if (!balls.some((b) => b.n === 0)) balls.push({ n: 0, ...spot(W / 2, H * 0.75) });
    // groups
    if (!own && !breakShot && !foul && pottedObj.length) {
      const gp = groupOf(pottedObj[0]); groups[shooter] = gp; groups[other(shooter)] = gp === 'solid' ? 'stripe' : 'solid';
    }
    const ownNow = groups[shooter];
    const keep = !foul && (ownNow ? pottedObj.some((n) => groupOf(n) === ownNow) : pottedObj.length > 0);
    breakShot = false;
    if (foul) ctx.toast(ctx.t(foul) + ' ' + ctx.t(shooter === 'me' ? MSG.cpuGets : MSG.youGet), 2400);
    turn = keep ? shooter : other(shooter);
    inHand = !!foul;
    phase = 'aim';
    if (turn === 'me') { say(inHand ? MSG.inHand : MSG.aim); draw(); }
    else { say(MSG.cpu); draw(); later(cpuTurn, 700); }
  }
  function spot(x, y) {
    for (let k = 0; k < 40; k++) { const s = freeSpot(x, y + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (2 * R + 1)); if (s) return { x: s[0], y: s[1] }; }
    return { x, y };
  }

  // ---------- computer ----------
  function targetsFor(w) {
    const own = groups[w];
    if (own && cleared(w)) return balls.filter((b) => b.n === 8);
    return balls.filter((b) => b.n !== 0 && b.n !== 8 && (!own || groupOf(b.n) === own));
  }
  function evaluateShot(w, shot, list = balls) {
    const r = simulate(list, shot, false);
    const own = groups[w], ownTargets = targetsFor(w).map((b) => b.n);
    if (r.potted.includes(0) || r.firstHit == null) return { s: -100, r };
    const ok1st = own ? ownTargets.includes(r.firstHit) : r.firstHit !== 8;
    if (!ok1st) return { s: -80, r };
    if (r.potted.includes(8)) return { s: cleared(w) ? 1000 : -1000, r };
    const good = r.potted.filter((n) => n !== 8 && (!own || groupOf(n) === own)).length;
    return { s: good * 100 - r.potted.filter((n) => own && groupOf(n) && groupOf(n) !== own).length * 30, r };
  }
  function cpuTurn() {
    if (!alive) return;
    const noise = [0.06, 0.028, 0.008][ctx.level] ?? 0.028; // aim error (radians): human-like misses
    let best = null;
    const tryCue = (cx, cy, list) => {
      for (const t of targetsFor('cpu')) for (const P of POCKETS) {
        const a = aimFor(cx, cy, t, P);
        if (a.cut > 1.3) continue;
        for (const sp of [380, 600, 900]) {
          const shot = { angle: a.angle, speed: sp, spin: 0 };
          const e = evaluateShot('cpu', shot, list);
          const s = e.s - a.cut * 25 - a.dist * 0.02;
          if (!best || s > best.s) best = { s, shot, cx, cy };
        }
      }
    };
    if (breakShot) best = { s: 0, shot: { angle: -Math.PI / 2 + (Math.random() - 0.5) * 0.02, speed: 1550, spin: 0 } };
    else if (inHand) {
      // try a few placements: straight-in positions behind each target
      for (const t of targetsFor('cpu').slice(0, 5)) for (const P of POCKETS) {
        const ux = t.x - P[0], uy = t.y - P[1], l = Math.hypot(ux, uy);
        const s = freeSpot(t.x + (ux / l) * (2 * R + 90), t.y + (uy / l) * (2 * R + 90));
        if (!s) continue;
        const list = balls.map((b) => (b.n === 0 ? { n: 0, x: s[0], y: s[1] } : b));
        tryCue(s[0], s[1], list);
      }
      if (best && best.cx != null) { const c = cue(); c.x = best.cx; c.y = best.cy; }
    } else { const c = cue(); tryCue(c.x, c.y, balls); }
    if (!best || best.s < 50) {
      // safety: just hit one of our balls softly
      const c = cue(); let safe = null;
      for (const t of targetsFor('cpu')) {
        const shot = { angle: Math.atan2(t.y - c.y, t.x - c.x), speed: 320, spin: 0 };
        const e = evaluateShot('cpu', shot);
        if (!safe || e.s > safe.s) safe = { s: e.s, shot };
      }
      if (safe && (!best || safe.s > best.s)) best = safe;
    }
    if (!best) best = { shot: { angle: Math.random() * 6.28, speed: 500, spin: 0 } };
    // gaussian-ish aim error plus a little power error
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const shot = { ...best.shot, angle: best.shot.angle + gauss() * noise * (breakShot ? 0.2 : 1), speed: best.shot.speed * (1 + gauss() * 0.08) };
    // show the cue lining up, then shoot
    const a0 = shot.angle + 0.5, t0 = performance.now();
    const aimAnim = (tm) => {
      if (!alive) return;
      const k = Math.min(1, (tm - t0) / 700);
      cpuAim = { a: a0 + (shot.angle - a0) * (1 - Math.pow(1 - k, 3)), pull: 8 + k * k * (12 + Math.min(1, (shot.speed - 120) / 1500) * 50) };
      draw();
      if (k < 1) frame(aimAnim); else { const pull = cpuAim.pull; cpuAim = null; shoot({ ...shot, pull }); }
    };
    frame(aimAnim);
  }

  say(MSG.break); setSpin(0);
  layout();
  if (window.innerWidth < 700) later(() => window.scrollTo(0, wrap.getBoundingClientRect().top + window.scrollY - 4), 120);
  window.__pooldbg = () => ({ turn, phase, inHand, groups, balls: balls.map((b) => ({ ...b })), breakShot });
  window.__poolshoot = (a, p, s) => { if (myTurn()) { angle = a; shoot({ angle: a, speed: speedOf(p), spin: s || 0 }); } };
  return () => {
    alive = false; timers.forEach(clearTimeout); ro.disconnect();
    window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize);
    document.removeEventListener('fullscreenchange', onResize);
    document.body.style.overflow = ''; app?.classList.remove('wide');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

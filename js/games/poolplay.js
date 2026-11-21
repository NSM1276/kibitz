// 8-ball vs computer on top of poolphys.js. Simplified WPA-style rules:
// open table after the break; first legal pot decides groups; foul (scratch, no hit, wrong ball first) = ball in hand;
// potting the 8 early or with a foul loses, potting it after clearing your group wins.
import { simulate, aimFor, firstContact, POCKETS, W, H, R } from './poolphys.js';

const M = 24;
function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 34); }
const COL = { 1: '#f7c600', 2: '#1d4fd8', 3: '#e0242b', 4: '#6b2fb3', 5: '#f57c00', 6: '#0f8a3c', 7: '#8a1c1c', 8: '#111111' };
const color = (n) => (n === 0 ? '#f7f5ec' : COL[n > 8 ? n - 8 : n]);
const groupOf = (n) => (n >= 1 && n <= 7 ? 'solid' : n >= 9 ? 'stripe' : null);
const MSG = {
  break: { en: 'Your break! Drag to aim, set the power, then shoot.', de: 'Du hast den Anstoß! Ziehen zum Zielen, Stärke wählen, stoßen.' },
  aim: { en: 'Your shot. Drag to aim.', de: 'Du bist dran. Ziehen zum Zielen.' },
  inHand: { en: 'Ball in hand: drag the white ball where you want it, then aim.', de: 'Freie Lage: Schieb die weiße Kugel, wohin du willst, dann ziele.' },
  cpu: { en: 'Computer is playing…', de: 'Der Computer spielt…' },
  shoot: { en: 'Shoot', de: 'Stoßen' }, power: { en: 'Power', de: 'Stärke' },
  open: { en: 'Open table', de: 'Tisch offen' },
  you: { en: 'You', de: 'Du' }, cpuName: { en: 'Computer', de: 'Computer' },
  solid: { en: 'solids 1–7', de: 'Volle 1–7' }, stripe: { en: 'stripes 9–15', de: 'Halbe 9–15' },
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

export function playPool(stage, ctx) {
  const CW = W + 2 * M, CH = H + 2 * M, dpr = Math.min(2, window.devicePixelRatio || 1);
  const info = document.createElement('div'); info.className = 'poolinfo';
  const cv = document.createElement('canvas'); cv.className = 'stagecv';
  cv.width = CW * dpr; cv.height = CH * dpr; cv.style.aspectRatio = `${CW}/${CH}`;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const ctrl = document.createElement('div'); ctrl.className = 'poolctrl';
  ctrl.innerHTML = `<div class="row"><button class="btn sm" data-n="-1">◀</button><button class="btn sm" data-n="1">▶</button>
    <label class="pw"><span>${ctx.t(MSG.power)}</span><input type="range" min="8" max="100" value="55"></label></div>
    <div class="row"><div class="spins"></div><button class="btn primary shoot">${ctx.t(MSG.shoot)}</button></div>`;
  stage.append(info, cv, ctrl);
  const powerEl = ctrl.querySelector('input'), shootBtn = ctrl.querySelector('.shoot'), spinsEl = ctrl.querySelector('.spins');

  let balls = rack(), turn = 'me', groups = { me: null, cpu: null }, inHand = false, breakShot = true, phase = 'aim';
  let angle = -Math.PI / 2, spin = 0, alive = true, cpuAim = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };
  const cue = () => balls.find((b) => b.n === 0);
  const other = (w) => (w === 'me' ? 'cpu' : 'me');

  MSG.spin.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'btn sm spin' + (i === 1 ? ' on' : ''); b.textContent = ctx.t(s);
    b.onclick = () => { spin = i - 1; spinsEl.querySelectorAll('.spin').forEach((x, j) => x.classList.toggle('on', j === i)); draw(); };
    spinsEl.append(b);
  });
  // fine aim buttons (hold to repeat)
  ctrl.querySelectorAll('[data-n]').forEach((b) => {
    let iv = null, to = null; const d = +b.dataset.n * 0.1 * Math.PI / 180;
    const stop = () => { clearTimeout(to); clearInterval(iv); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!myTurn()) return; angle += d; draw(); to = setTimeout(() => { iv = setInterval(() => { angle += d; draw(); }, 50); }, 300); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
  });
  shootBtn.onclick = () => { if (myTurn()) shoot({ angle, speed: speedOf(+powerEl.value), spin }); };
  powerEl.oninput = () => draw();
  const speedOf = (p) => 120 + (p / 100) * 1500;
  const myTurn = () => turn === 'me' && phase === 'aim';

  // ---------- input ----------
  const toTable = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * CW) / r.width - M, ((e.clientY - r.top) * CH) / r.height - M]; };
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    const p = toTable(e), c = cue();
    try { cv.setPointerCapture(e.pointerId); } catch {}
    if (inHand && Math.hypot(p[0] - c.x, p[1] - c.y) < 3 * R) drag = 'cue'; else { drag = 'aim'; aimAt(p); }
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

  // ---------- drawing ----------
  function ballAt(x, y, n) {
    g.save(); g.translate(M + x, M + y);
    g.fillStyle = '#0005'; g.beginPath(); g.arc(2, 3, R, 0, 7); g.fill();
    if (n > 8) {
      g.fillStyle = '#f7f5ec'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip(); g.fillStyle = color(n); g.fillRect(-R, -R * 0.55, 2 * R, R * 1.1); g.restore();
    } else { g.fillStyle = color(n); g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); }
    if (n) { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, R * 0.5, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = `bold ${R * 0.72}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 0.5); }
    const sh = g.createRadialGradient(-R * 0.35, -R * 0.4, 1, 0, 0, R); sh.addColorStop(0, '#ffffffaa'); sh.addColorStop(0.35, '#ffffff10'); sh.addColorStop(1, '#00000040');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    g.restore();
  }
  function tableBg() {
    g.clearRect(0, 0, CW, CH);
    const wood = g.createLinearGradient(0, 0, CW, 0); wood.addColorStop(0, '#6e4020'); wood.addColorStop(0.5, '#86522b'); wood.addColorStop(1, '#6e4020');
    g.fillStyle = wood; g.beginPath(); g.roundRect(0, 0, CW, CH, 16); g.fill();
    const felt = g.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CH * 0.7); felt.addColorStop(0, '#1f8f5a'); felt.addColorStop(1, '#126b41');
    g.fillStyle = felt; g.fillRect(M, M, W, H);
    g.strokeStyle = '#0d4f30'; g.lineWidth = 3; g.strokeRect(M, M, W, H);
    g.fillStyle = '#f3e3c3';
    for (let i = 1; i < 4; i++) for (const y of [M / 2, CH - M / 2]) { g.beginPath(); g.arc(M + (W * i) / 4, y, 2.2, 0, 7); g.fill(); }
    for (let i = 1; i < 8; i++) { if (i === 4) continue; for (const x of [M / 2, CW - M / 2]) { g.beginPath(); g.arc(x, M + (H * i) / 8, 2.2, 0, 7); g.fill(); } }
    g.strokeStyle = '#ffffff22'; g.lineWidth = 1; g.beginPath(); g.moveTo(M, M + H * 0.75); g.lineTo(M + W, M + H * 0.75); g.stroke(); // head string
    POCKETS.forEach(([px, py], i) => { g.fillStyle = '#060606'; g.beginPath(); g.arc(M + px, M + py, i === 2 || i === 3 ? 15 : 17, 0, 7); g.fill(); });
  }
  function cueStick(c, a, pull) {
    const d = [Math.cos(a), Math.sin(a)], back = 16 + pull, len = 230;
    const p1 = [c.x - d[0] * back, c.y - d[1] * back], p2 = [c.x - d[0] * (back + len), c.y - d[1] * (back + len)];
    g.save(); g.lineCap = 'round';
    g.strokeStyle = '#00000055'; g.lineWidth = 8; g.beginPath(); g.moveTo(M + p1[0] + 3, M + p1[1] + 4); g.lineTo(M + p2[0] + 3, M + p2[1] + 4); g.stroke();
    const grd = g.createLinearGradient(M + p1[0], M + p1[1], M + p2[0], M + p2[1]); grd.addColorStop(0, '#f2f2f2'); grd.addColorStop(0.04, '#3b82c4'); grd.addColorStop(0.06, '#e8c48a'); grd.addColorStop(0.7, '#b07a3c'); grd.addColorStop(1, '#2a1a0c');
    g.strokeStyle = grd; g.lineWidth = 6; g.beginPath(); g.moveTo(M + p1[0], M + p1[1]); g.lineTo(M + p2[0], M + p2[1]); g.stroke(); g.restore();
  }
  function guide() {
    const c = cue(), fc = firstContact(balls, c.x, c.y, angle);
    g.save(); g.setLineDash([4, 4]); g.strokeStyle = '#ffffffaa'; g.lineWidth = 1.4;
    if (!fc) { const L = 600; g.beginPath(); g.moveTo(M + c.x, M + c.y); g.lineTo(M + c.x + Math.cos(angle) * L, M + c.y + Math.sin(angle) * L); g.stroke(); g.restore(); return; }
    g.beginPath(); g.moveTo(M + c.x, M + c.y); g.lineTo(M + fc.gx, M + fc.gy); g.stroke();
    g.setLineDash([3, 3]); g.beginPath(); g.arc(M + fc.gx, M + fc.gy, R, 0, 7); g.stroke();
    const objLen = [150, 70, 30][ctx.level] ?? 70;
    g.setLineDash([2, 4]); g.strokeStyle = '#e8c46acc';
    g.beginPath(); g.moveTo(M + fc.ball.x, M + fc.ball.y); g.lineTo(M + fc.ball.x + fc.ox * objLen, M + fc.ball.y + fc.oy * objLen); g.stroke();
    if (ctx.level === 0) { // where the white goes (90° rule)
      let tx = -fc.oy, ty = fc.ox; if (tx * Math.cos(angle) + ty * Math.sin(angle) < 0) { tx = -tx; ty = -ty; }
      g.strokeStyle = '#ffffff55'; g.beginPath(); g.moveTo(M + fc.gx, M + fc.gy); g.lineTo(M + fc.gx + tx * 60, M + fc.gy + ty * 60); g.stroke();
    }
    // warn when the first ball is not yours
    const own = groups[turn];
    const bad = (own && groupOf(fc.ball.n) !== own && !(fc.ball.n === 8 && cleared(turn))) || (!own && fc.ball.n === 8);
    if (bad) { g.setLineDash([]); g.strokeStyle = '#d0453a'; g.lineWidth = 2; g.beginPath(); g.arc(M + fc.ball.x, M + fc.ball.y, R + 3, 0, 7); g.stroke(); }
    g.restore();
  }
  function draw(pos) {
    if (!alive) return;
    tableBg();
    const list = pos || balls;
    if (!pos && myTurn()) guide();
    for (const b of list) if (b) ballAt(b.x, b.y, b.n);
    if (!pos && phase === 'aim') {
      if (turn === 'me') {
        if (inHand) { const c = cue(); g.save(); g.strokeStyle = '#e8c46a'; g.setLineDash([3, 3]); g.lineWidth = 2; g.beginPath(); g.arc(M + c.x, M + c.y, R + 6, 0, 7); g.stroke(); g.restore(); }
        cueStick(cue(), angle, 6 + (+powerEl.value) * 0.35);
      } else if (cpuAim) cueStick(cue(), cpuAim.a, cpuAim.pull);
    }
    renderInfo();
  }
  function renderInfo() {
    const gname = (w) => (groups[w] ? ctx.t(MSG[groups[w]]) : ctx.t(MSG.open));
    const gone = (gp) => [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].filter((n) => groupOf(n) === gp && !balls.some((b) => b.n === n));
    const dots = (w) => (groups[w] ? gone(groups[w]) : []).map((n) => `<i class="pb ${n > 8 ? 'st' : ''}" style="--c:${color(n)}">${n}</i>`).join('');
    info.innerHTML = `<div class="pl ${turn === 'me' ? 'on' : ''}"><b>${ctx.t(MSG.you)}</b> · ${gname('me')}<div>${dots('me')}</div></div>
      <div class="pl ${turn === 'cpu' ? 'on' : ''}"><b>${ctx.t(MSG.cpuName)}</b> · ${gname('cpu')}<div>${dots('cpu')}</div></div>`;
    shootBtn.disabled = !myTurn();
  }
  const cleared = (w) => groups[w] && !balls.some((b) => groupOf(b.n) === groups[w]);

  // ---------- shot playback ----------
  function shoot(shot) {
    phase = 'anim'; renderInfo();
    const res = simulate(balls, shot, true);
    const ids = balls.map((b) => b.n);
    ctx.sfx.tap();
    const t0 = performance.now(); let evI = 0;
    const evs = res.events.slice().sort((a, b) => a.t - b.t);
    const stepF = (tm) => {
      if (!alive) return;
      const t = (tm - t0) / 1000, fi = Math.min(res.frames.length - 1, Math.floor(t * 60));
      while (evI < evs.length && evs[evI].t <= t) {
        const e = evs[evI++];
        if (e.type === 'hit' && e.v > 30) ctx.sfx.hit(); else if (e.type === 'pot') ctx.sfx.drop();
      }
      draw(res.frames[fi].map((p, i) => (p ? { x: p[0], y: p[1], n: ids[i] } : null)));
      if (fi < res.frames.length - 1) frame(stepF); else later(() => afterShot(res), 150);
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
        phase = 'over'; draw();
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
    if (turn === 'me') { ctx.hint(inHand ? MSG.inHand : MSG.aim); draw(); }
    else { ctx.hint(MSG.cpu); draw(); later(cpuTurn, 700); }
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
      cpuAim = { a: a0 + (shot.angle - a0) * (1 - Math.pow(1 - k, 3)), pull: 10 + Math.sin(k * Math.PI) * 18 };
      draw();
      if (k < 1) frame(aimAnim); else { cpuAim = null; shoot(shot); }
    };
    frame(aimAnim);
  }

  ctx.hint(MSG.break);
  draw();
  window.__pooldbg = () => ({ turn, phase, inHand, groups, balls: balls.map((b) => ({ ...b })), breakShot });
  window.__poolshoot = (a, p, s) => { if (myTurn()) { angle = a; shoot({ angle: a, speed: speedOf(p), spin: s || 0 }); } };
  return () => { alive = false; timers.forEach(clearTimeout); };
}

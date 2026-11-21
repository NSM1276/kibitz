// 8-ball vs computer on top of poolphys.js. Simplified WPA-style rules:
// open table after the break; first legal pot decides groups; foul (scratch, no hit, wrong ball first) = ball in hand;
// potting the 8 early or with a foul loses, potting it after clearing your group wins.
// Phone-first: the table fills the screen, turns sideways in landscape, and you shoot by pulling the power bar.
import { simulate, aimFor, firstContact, POCKETS, W, H, R } from './poolphys.js';
import { makeView, canFullscreen, toggleFullscreen, phoneLandscape } from './fitview.js';
import { makeArt, M, TW, TH, color } from './poolart.js';

function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 34); }
const groupOf = (n) => (n >= 1 && n <= 7 ? 'solid' : n >= 9 ? 'stripe' : null);
const MSG = {
  break: { en: 'Your break! Drag to aim, ‹ wheel › for fine aim, pull the bar to shoot.', de: 'Dein Anstoß! Ziehen zum Zielen, ‹ Rad › zum Feinzielen, Balken ziehen zum Stoßen.' },
  aim: { en: 'Your shot. Drag to aim, ‹ wheel › for fine aim.', de: 'Du bist dran. Ziehen zum Zielen, ‹ Rad › fein.' },
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
        <div class="ppow"><div class="pfill"></div><div class="pcue"></div><span></span></div>
        <div class="proll" title="fine aim"><i></i></div>
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
      sSide = view.fit(true, wrap.clientWidth - lw - 116 - 20, wrap.clientHeight - 10); side = true;
    } else {
      const top = $('.ptop').offsetHeight + hintEl.offsetHeight + 8;
      const W0 = wrap.clientWidth, H0 = window.innerHeight - 16 - top;
      sUp = view.fit(false, W0, H0 - 70); sSide = view.fit(true, W0 - 116, H0);
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
  // fine-aim roller (like a thumb wheel): slide along it to turn the cue very slowly; tap an end to nudge
  const rollEl = $('.proll'), ribs = $('.proll i');
  let rollDrag = null, ribOff = 0, tickAcc = 0;
  const FINE = 0.035 * Math.PI / 180; // radians per pixel
  const turnBy = (px) => {
    angle += px * FINE; ribOff += px; ribs.style.backgroundPosition = wrap.classList.contains('side') ? `0 ${ribOff}px` : `${ribOff}px 0`;
    tickAcc += Math.abs(px); if (tickAcc > 14) { tickAcc = 0; ctx.sfx.diceTick(0.12); }
    draw();
  };
  rollEl.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return; e.preventDefault();
    try { rollEl.setPointerCapture(e.pointerId); } catch {}
    rollDrag = { x: e.clientX, y: e.clientY, moved: 0 };
  });
  rollEl.addEventListener('pointermove', (e) => {
    if (!rollDrag || !myTurn()) return;
    const vert = wrap.classList.contains('side'), d = vert ? e.clientY - rollDrag.y : e.clientX - rollDrag.x;
    rollDrag.x = e.clientX; rollDrag.y = e.clientY; rollDrag.moved += Math.abs(d);
    if (d) turnBy(d);
  });
  rollEl.addEventListener('pointerup', (e) => {
    if (!rollDrag) return;
    if (rollDrag.moved < 4 && myTurn()) { // a tap: nudge 0.1° towards that end
      const r = rollEl.getBoundingClientRect(), vert = wrap.classList.contains('side');
      const k = vert ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      turnBy((k < 0.5 ? -1 : 1) * (0.1 * Math.PI / 180) / FINE); ctx.sfx.tap();
    }
    rollDrag = null;
  });
  rollEl.addEventListener('pointercancel', () => { rollDrag = null; });
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
  // tap on the table = point the cue there; drag = turn the cue around the white ball (no jump, finger never
  // has to cover the target); the further from the ball you drag, and the slower, the finer it turns
  let drag = null, aimDrag = null;
  const around = (p) => { const c = cue(); return Math.atan2(p[1] - c.y, p[0] - c.x); };
  cv.addEventListener('pointerdown', (e) => {
    if (!myTurn()) return;
    const p = toTable(e), c = cue();
    try { cv.setPointerCapture(e.pointerId); } catch {}
    if (inHand && Math.hypot(p[0] - c.x, p[1] - c.y) < 3.2 * R) drag = 'cue';
    else { drag = 'aim'; aimDrag = { sx: e.clientX, sy: e.clientY, pa: around(p), moved: false }; }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || !myTurn()) return;
    const p = toTable(e);
    if (drag === 'cue') return placeCue(p[0], p[1]);
    if (!aimDrag.moved && Math.hypot(e.clientX - aimDrag.sx, e.clientY - aimDrag.sy) < 6) return;
    aimDrag.moved = true;
    const c = cue(), dist = Math.hypot(p[0] - c.x, p[1] - c.y), pa = around(p);
    let da = pa - aimDrag.pa; da = Math.atan2(Math.sin(da), Math.cos(da)); aimDrag.pa = pa;
    if (dist < 2 * R) return;
    angle += da * Math.min(1, Math.max(0.3, dist / 220)); draw();
  });
  cv.addEventListener('pointerup', (e) => {
    if (drag === 'aim' && aimDrag && !aimDrag.moved && myTurn()) aimAt(toTable(e));
    drag = null; aimDrag = null;
  });
  function aimAt(p) { const c = cue(); if (Math.hypot(p[0] - c.x, p[1] - c.y) < 4) return; angle = Math.atan2(p[1] - c.y, p[0] - c.x); draw(); }
  function freeSpot(x, y) {
    x = Math.min(W - R, Math.max(R, x)); y = Math.min(H - R, Math.max(R, y));
    return balls.every((b) => b.n === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.5) ? [x, y] : null;
  }
  function placeCue(x, y) { const s = freeSpot(x, y); if (s) { const c = cue(); c.x = s[0]; c.y = s[1]; draw(); } }

  const art = makeArt(g, view);
  const { rollTo, ballAt, cueStick, line, ring, arrowHead } = art;
  const paintTable = () => art.paintTable(bg, cv);
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

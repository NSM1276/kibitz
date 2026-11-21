// Backgammon vs computer (no doubling cube). You are white and move 24 -> 1, the computer is red.
// Phone-first: the board fills the screen and stands upright when the phone is held upright
// (bigger checkers), lies flat when it is turned sideways. Tap the dice to roll.
import { start, flip, sequences, step as applyStep, bestPlay, pips } from './bgfull.js';
import { makeView, canFullscreen, toggleFullscreen, phoneLandscape } from './fitview.js';

function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 40); }
const MSG = {
  roll: { en: 'Tap the dice to roll.', de: 'Tippe auf die Würfel.' },
  pick: { en: 'Tap a white checker, then a glowing spot.', de: 'Tippe einen weißen Stein, dann eine leuchtende Stelle.' },
  bar: { en: 'You are on the bar: enter first, tap a glowing spot.', de: 'Du stehst auf der Bar: Erst einsetzen, tippe auf eine leuchtende Stelle.' },
  none: { en: 'No legal move with this roll.', de: 'Mit diesem Wurf ist kein Zug möglich.' },
  cpu: { en: 'Computer is moving…', de: 'Der Computer zieht…' },
  rollBtn: { en: 'Roll', de: 'Würfeln' }, undo: { en: 'Undo', de: 'Zurück' },
  you: { en: 'You', de: 'Du' }, cpuName: { en: 'Computer', de: 'Computer' }, pips: { en: 'pips', de: 'Augen' },
  winText: { en: 'All your checkers are off. Well played!', de: 'Alle deine Steine sind draußen. Gut gespielt!' },
  loseText: { en: 'The computer bore off first.', de: 'Der Computer war zuerst fertig.' },
  gammon: { en: ' Gammon (double win)!', de: ' Gammon (doppelter Sieg)!' },
};
const BOARD = 400, TRAY = 34, BW = BOARD + TRAY, BH = 300, F = 10, BAR = 26, PW = (BOARD - 2 * F - BAR) / 12, PH = 124, CR = 14;
const BARX = F + 6 * PW + BAR / 2;
function pointX(p) { const col = p <= 12 ? 12 - p : p - 13; return F + col * PW + PW / 2 + (col >= 6 ? BAR : 0); }
const isTop = (p) => p >= 13;
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export function playBackgammon(stage, ctx) {
  const app = document.getElementById('app');
  app?.classList.add('wide');
  const wrap = document.createElement('div'); wrap.className = 'pgame bg';
  wrap.innerHTML = `<div class="ptop"><button class="pico pexit">✕</button><div class="pl me"></div><div class="pl cpu"></div><button class="pico pfs">⛶</button></div>
    <div class="phint"></div>
    <div class="pmain"><div class="pcvbox"><canvas class="gcv"></canvas></div>
      <div class="pside"><button class="btn bundo"></button><button class="btn primary broll"></button></div></div>`;
  stage.append(wrap);
  const $ = (q) => wrap.querySelector(q);
  const cv = $('canvas'), g = cv.getContext('2d'), hintEl = $('.phint'), undoBtn = $('.bundo'), rollBtn = $('.broll');
  undoBtn.textContent = '↶ ' + ctx.t(MSG.undo); rollBtn.textContent = '🎲 ' + ctx.t(MSG.rollBtn);
  const view = makeView(cv, BW, BH);
  const bgc = document.createElement('canvas'), bgg = bgc.getContext('2d');
  const say = (m) => { hintEl.textContent = m ? ctx.t(m) : ''; };

  let s = start(), dice = [], used = [], seqs = [], done = [], history = [], sel = null, busy = false, alive = true, anim = null, turn = 'me', cpuDice = null, rollAnim = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };

  // ---------- layout ----------
  function layout() {
    if (!alive) return;
    const fs = (phoneLandscape() || document.fullscreenElement === wrap) && !wrap.dataset.over;
    wrap.classList.toggle('fs', fs);
    document.body.style.overflow = fs ? 'hidden' : '';
    const top = $('.ptop').offsetHeight + hintEl.offsetHeight + 8;
    const W0 = wrap.clientWidth, H0 = (fs ? wrap.clientHeight : window.innerHeight - 16) - top;
    const opts = [
      { rot: false, side: false, s: view.fit(false, W0, H0 - 62) },
      { rot: false, side: true, s: view.fit(false, W0 - 128, H0) },
      { rot: true, side: false, s: view.fit(true, W0, H0 - 62) },
    ];
    let best = fs ? opts[1] : opts.reduce((a, b) => (b.s > a.s * 1.04 ? b : a));
    wrap.classList.toggle('side', best.side);
    view.size(best.rot, best.s);
    paintBoard(); draw();
  }
  const ro = new ResizeObserver(() => layout()); ro.observe(wrap);
  const onResize = () => layout();
  window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize);
  document.addEventListener('fullscreenchange', onResize);
  $('.pexit').onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); location.hash = '#/g/backgammon'; };
  const fsBtn = $('.pfs'); if (!canFullscreen()) fsBtn.style.display = 'none';
  fsBtn.onclick = () => toggleFullscreen(wrap);

  // text and dice stay upright when the board is turned
  function upright(x, y, fn) { g.save(); g.translate(x, y); if (view.rot) g.rotate(-Math.PI / 2); fn(); g.restore(); }

  // ---------- static board ----------
  function paintBoard() {
    bgc.width = cv.width; bgc.height = cv.height;
    const q = bgg; view.apply(q); const rnd = rng(11);
    const wood = q.createLinearGradient(0, 0, 0, BH);
    wood.addColorStop(0, '#5b3218'); wood.addColorStop(0.5, '#7a4521'); wood.addColorStop(1, '#5b3218');
    q.fillStyle = wood; q.beginPath(); q.roundRect(0, 0, BW, BH, 14); q.fill();
    q.save(); q.beginPath(); q.roundRect(0, 0, BW, BH, 14); q.clip();
    for (let i = 0; i < 40; i++) { const y = rnd() * BH; q.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,220,170,.06)'; q.lineWidth = 0.6 + rnd() * 1.4;
      q.beginPath(); q.moveTo(0, y); q.bezierCurveTo(BW * 0.33, y + 5 - rnd() * 10, BW * 0.66, y + 5 - rnd() * 10, BW, y + 3 - rnd() * 6); q.stroke(); }
    q.restore();
    q.strokeStyle = 'rgba(255,230,190,.3)'; q.lineWidth = 1.6; q.beginPath(); q.roundRect(1.2, 1.2, BW - 2.4, BH - 2.4, 13); q.stroke();
    // two felt halves
    const half = (x0, x1) => {
      const fg = q.createRadialGradient((x0 + x1) / 2, BH / 2, 10, (x0 + x1) / 2, BH / 2, BH * 0.7);
      fg.addColorStop(0, '#2f7a55'); fg.addColorStop(1, '#1f5a3d'); q.fillStyle = fg; q.fillRect(x0, F, x1 - x0, BH - 2 * F);
      for (let i = 0; i < 700; i++) { q.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; q.fillRect(x0 + rnd() * (x1 - x0), F + rnd() * (BH - 2 * F), 1.1, 1.1); }
      q.strokeStyle = 'rgba(0,0,0,.5)'; q.lineWidth = 2; q.strokeRect(x0 - 1, F - 1, x1 - x0 + 2, BH - 2 * F + 2);
    };
    half(F, F + 6 * PW); half(F + 6 * PW + BAR, BOARD - F);
    // bar with a hinge line
    q.fillStyle = 'rgba(0,0,0,.18)'; q.fillRect(F + 6 * PW, F, BAR, BH - 2 * F);
    q.strokeStyle = 'rgba(0,0,0,.4)'; q.lineWidth = 1; q.beginPath(); q.moveTo(BARX, F); q.lineTo(BARX, BH - F); q.stroke();
    // off tray
    q.fillStyle = '#24130a'; q.fillRect(BOARD, F, TRAY - F, BH - 2 * F);
    q.strokeStyle = 'rgba(0,0,0,.6)'; q.lineWidth = 2; q.strokeRect(BOARD - 1, F - 1, TRAY - F + 2, BH - 2 * F + 2);
    q.strokeStyle = 'rgba(255,230,190,.18)'; q.beginPath(); q.moveTo(BOARD, BH / 2); q.lineTo(BOARD + TRAY - F, BH / 2); q.stroke();
    // points
    for (let p = 1; p <= 24; p++) {
      const x = pointX(p), top = isTop(p), y0 = top ? F : BH - F, y1 = top ? F + PH : BH - F - PH, light = p % 2 === 1;
      const pg = q.createLinearGradient(x, y0, x, y1);
      if (light) { pg.addColorStop(0, '#efdcb0'); pg.addColorStop(1, '#d9bd83'); } else { pg.addColorStop(0, '#a83a26'); pg.addColorStop(1, '#7e2516'); }
      q.fillStyle = pg; q.beginPath(); q.moveTo(x - PW / 2 + 1.2, y0); q.lineTo(x + PW / 2 - 1.2, y0); q.lineTo(x, y1); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(0,0,0,.25)'; q.lineWidth = 0.8; q.stroke();
    }
  }

  // ---------- dynamic ----------
  function checker(x, y, mine, ring, lift) {
    g.save();
    if (lift) y -= 0;
    g.fillStyle = 'rgba(0,0,0,.42)'; g.beginPath(); g.arc(x + (lift ? 3.5 : 1.6), y + (lift ? 5 : 2.6), CR, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - 4, y - 5, 1, x, y, CR);
    if (mine) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.7, '#ece5d3'); gr.addColorStop(1, '#bfb59c'); }
    else { gr.addColorStop(0, '#d65a40'); gr.addColorStop(0.7, '#9c2c1b'); gr.addColorStop(1, '#5e170c'); }
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, CR, 0, 7); g.fill();
    g.strokeStyle = mine ? 'rgba(90,75,50,.55)' : 'rgba(40,6,2,.7)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, CR * 0.64, 0, 7); g.stroke();
    g.strokeStyle = mine ? 'rgba(255,255,255,.8)' : 'rgba(255,170,150,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, CR * 0.64 - 1.4, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, CR, 0, 7); g.stroke();
    if (ring) { g.strokeStyle = ring; g.lineWidth = 3.4; g.beginPath(); g.arc(x, y, CR + 2.2, 0, 7); g.stroke(); }
    g.restore();
  }
  const slotY = (p, i, n) => { const st = n > 5 ? (PH - CR * 2) / (n - 1) : CR * 2; return isTop(p) ? F + CR + i * st : BH - F - CR - i * st; };
  function die(x, y, v, dim, wob = 0) {
    upright(x, y, () => {
      g.rotate(wob); g.globalAlpha = dim ? 0.35 : 1; const S = 17;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(-S + 2, -S + 3, 2 * S, 2 * S, 7); g.fill();
      const dg = g.createLinearGradient(-S, -S, S, S); dg.addColorStop(0, '#ffffff'); dg.addColorStop(1, '#e7dfcc');
      g.fillStyle = dg; g.beginPath(); g.roundRect(-S, -S, 2 * S, 2 * S, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#1d1d1d';
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
      for (const [a, b] of P) { g.beginPath(); g.arc(a * 8.5, b * 8.5, 3.3, 0, 7); g.fill(); }
    });
  }
  function nextOptions() {
    const k = done.length;
    const match = seqs.filter((sq) => done.every((d, i) => sq[i] && sq[i].mv[0] === d[0] && sq[i].mv[1] === d[1]));
    return match.filter((sq) => sq[k]).map((sq) => sq[k]);
  }
  const myDiceX = F + 6 * PW + BAR + 3 * PW, cpuDiceX = F + 3 * PW;
  function draw() {
    if (!alive || !bgc.width) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgc, 0, 0); view.apply(g);
    const opts = turn === 'me' && !busy ? nextOptions() : [];
    const targets = sel != null ? opts.filter((o) => o.mv[0] === sel).map((o) => o.mv[1]) : [];
    const movable = new Set(opts.map((o) => o.mv[0]));
    const t = performance.now() / 1000, glow = 0.55 + 0.35 * Math.sin(t * 5);
    // target points: soft gold wash over the point
    for (const p of targets) {
      if (p === 0) continue;
      const x = pointX(p), top = isTop(p), y0 = top ? F : BH - F, y1 = top ? F + PH : BH - F - PH;
      g.fillStyle = `rgba(255,214,90,${0.25 + 0.2 * glow})`; g.beginPath(); g.moveTo(x - PW / 2 + 1, y0); g.lineTo(x + PW / 2 - 1, y0); g.lineTo(x, y1); g.closePath(); g.fill();
    }
    // point numbers (small, upright)
    g.fillStyle = 'rgba(255,240,210,.55)'; g.font = 'bold 9px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let p = 1; p <= 24; p++) upright(pointX(p), isTop(p) ? F + PH + 8 : BH - F - PH - 8, () => g.fillText(p, 0, 0));
    for (let p = 1; p <= 24; p++) {
      const x = pointX(p), n = Math.abs(s.b[p]), mine = s.b[p] > 0;
      for (let i = 0; i < n; i++) {
        if (anim && anim.to === p && i === n - 1 && anim.mine === mine) continue;
        const topOne = i === n - 1, isSel = mine && sel === p && topOne;
        if (isSel) continue;
        checker(x, slotY(p, i, n), mine, mine && topOne && sel == null && movable.has(p) ? `rgba(217,172,92,${glow})` : null);
      }
    }
    // bar: mine in the upper half (I enter at 19..24), computer's in the lower half
    for (let i = 0; i < s.bar[0]; i++) if (!(anim && anim.to === 25 && i === s.bar[0] - 1) && !(sel === 25 && i === s.bar[0] - 1)) checker(BARX, BH / 2 - 24 - i * 20, true, sel == null && movable.has(25) && i === s.bar[0] - 1 ? `rgba(217,172,92,${glow})` : null);
    for (let i = 0; i < s.bar[1]; i++) if (!(anim && anim.to === -25 && i === s.bar[1] - 1)) checker(BARX, BH / 2 + 24 + i * 20, false);
    // borne off: stacked edges
    for (let i = 0; i < s.off[0]; i++) { g.fillStyle = i % 2 ? '#efe8d6' : '#fffdf6'; g.fillRect(BOARD + 3, BH - F - 7 - i * 8, TRAY - F - 6, 7); }
    for (let i = 0; i < s.off[1]; i++) { g.fillStyle = i % 2 ? '#8a2618' : '#a83a26'; g.fillRect(BOARD + 3, F + 2 + i * 8, TRAY - F - 6, 7); }
    if (targets.includes(0)) {
      g.fillStyle = `rgba(255,214,90,${0.3 + 0.25 * glow})`; g.fillRect(BOARD + 1, BH / 2 + 3, TRAY - F - 2, BH / 2 - F - 5);
      upright(BOARD + (TRAY - F) / 2, BH * 0.62, () => { g.fillStyle = '#2a1a08'; g.font = 'bold 18px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⇩', 0, 0); });
    }
    // landing spots: glowing rings where the checker would go
    for (const p of targets) {
      if (p === 0) continue;
      const n = Math.max(0, s.b[p] > 0 ? s.b[p] : 0), x = pointX(p), y = slotY(p, Math.min(n, 5), Math.max(n + 1, 1));
      g.save(); g.setLineDash([4, 3]); g.strokeStyle = `rgba(255,224,120,${0.6 + 0.4 * glow})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, CR - 1, 0, 7); g.stroke();
      g.setLineDash([]); g.fillStyle = 'rgba(255,224,120,.18)'; g.fill(); g.restore();
    }
    // selected checker: lifted, glowing
    if (sel != null) {
      const sx = sel === 25 ? BARX : pointX(sel), n = sel === 25 ? s.bar[0] : Math.abs(s.b[sel]);
      const sy = sel === 25 ? BH / 2 - 24 - (n - 1) * 20 : slotY(sel, n - 1, n);
      checker(sx, sy + (sel === 25 ? 0 : isTop(sel) ? 6 : -6), true, '#ffd45a', true);
    }
    if (anim) checker(anim.x, anim.y, anim.mine, null, true);
    // dice
    const dd = turn === 'me' ? dice : cpuDice;
    if (rollAnim) {
      const k = rollAnim.k, cx = rollAnim.x;
      [0, 1].forEach((i) => die(cx - 21 + i * 42, BH / 2 + Math.sin(k * 9 + i) * 6 * (1 - k), 1 + Math.floor(Math.random() * 6), false, (1 - k) * (i ? -1.6 : 1.9) * Math.sin(k * 7)));
    } else if (dd && dd.length) {
      const list = dd[0] === dd[1] ? [dd[0], dd[0], dd[0], dd[0]] : dd;
      const cx = turn === 'me' ? myDiceX : cpuDiceX;
      list.forEach((d, i) => die(cx - (list.length - 1) * 19 + i * 38, BH / 2, d, turn === 'me' && i < used.length));
    } else if (turn === 'me' && !busy) {
      // invitation to roll: two dice that bob gently
      [5, 3].forEach((v, i) => die(myDiceX - 21 + i * 42, BH / 2 + Math.sin(t * 3 + i) * 2, v, false, Math.sin(t * 2 + i) * 0.12));
      g.save(); g.strokeStyle = `rgba(255,214,90,${glow})`; g.lineWidth = 2.5; g.beginPath(); g.roundRect(myDiceX - 46, BH / 2 - 25, 92, 50, 12); g.stroke(); g.restore();
    }
    renderInfo();
  }
  function renderInfo() {
    const [mp, op] = pips(s);
    const me = $('.pl.me'), cp = $('.pl.cpu');
    const hm = `<i class="cki w"></i><b>${ctx.t(MSG.you)}</b> <small>${mp} ${ctx.t(MSG.pips)}</small>`, hc = `<i class="cki r"></i><b>${ctx.t(MSG.cpuName)}</b> <small>${op} ${ctx.t(MSG.pips)}</small>`;
    if (me.innerHTML !== hm) me.innerHTML = hm; if (cp.innerHTML !== hc) cp.innerHTML = hc;
    me.classList.toggle('on', turn === 'me'); cp.classList.toggle('on', turn === 'cpu');
  }
  // gentle glow loop while waiting for the player
  const pulse = () => { if (!alive) return; if (turn === 'me' && !busy && !anim) draw(); later(() => frame(pulse), 70); };
  pulse();
  // ---------- animation ----------
  function coords(p, mine, idxFromTop) {
    if (p === 25) return [BARX, mine ? BH / 2 - 24 - idxFromTop * 20 : BH / 2 + 24 + idxFromTop * 20];
    if (p === 0) return [BOARD + (TRAY - F) / 2, mine ? BH - F - 20 : F + 20];
    const n = Math.max(1, idxFromTop + 1); return [pointX(p), slotY(p, idxFromTop, n)];
  }
  function animate(from, to, mine, before, after, cb) {
    const nFrom = from === 25 ? (mine ? before.bar[0] : before.bar[1]) : Math.abs(before.b[from]);
    const [x0, y0] = coords(from, mine, nFrom - 1);
    s = after;
    const nTo = to === 0 ? 1 : Math.abs(after.b[to]);
    const [x1, y1] = to === 0 ? coords(0, mine, 0) : [pointX(to), slotY(to, nTo - 1, nTo)];
    const t0 = performance.now(), T = 380;
    anim = { to: to === 0 ? -99 : to, mine, x: x0, y: y0 };
    const stepF = (tm) => {
      if (!alive) return;
      const k = Math.min(1, (tm - t0) / T), e = 1 - Math.pow(1 - k, 3);
      anim.x = x0 + (x1 - x0) * e; anim.y = y0 + (y1 - y0) * e - Math.sin(k * Math.PI) * 30;
      draw();
      if (k < 1) frame(stepF); else { anim = null; ctx.sfx.move(); draw(); cb && cb(); }
    };
    frame(stepF);
  }
  // dice tumble before showing the result
  function tumble(x, cb) {
    const t0 = performance.now(); rollAnim = { x, k: 0 };
    const stepF = (tm) => {
      if (!alive) return;
      rollAnim.k = Math.min(1, (tm - t0) / 520); draw();
      if (rollAnim.k < 1) frame(stepF); else { rollAnim = null; cb(); }
    };
    frame(stepF);
  }
  // ---------- my turn ----------
  function roll() {
    if (busy || turn !== 'me' || dice.length) return;
    busy = true; syncButtons(); ctx.sfx.tap();
    tumble(myDiceX, () => {
      busy = false;
      dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      used = []; done = []; history = [];
      seqs = sequences(s, dice);
      ctx.sfx.tap(); draw();
      if (!seqs.length || !seqs[0].length) { say(MSG.none); busy = true; syncButtons(); later(() => { busy = false; endMyTurn(); }, 1400); return; }
      // a single possible source? pre-select it (bar entry, mostly)
      say(s.bar[0] ? MSG.bar : MSG.pick);
      if (s.bar[0]) sel = 25;
      syncButtons(); draw();
    });
  }
  function syncButtons() {
    rollBtn.disabled = busy || turn !== 'me' || dice.length > 0; undoBtn.disabled = busy || !done.length;
  }
  function hit(e) {
    const [x, y] = view.toLocal(e);
    if (x >= BOARD - 2) return 0;
    if (Math.abs(x - BARX) < BAR / 2 + 3) return 25;
    for (let p = 1; p <= 24; p++) if (Math.abs(x - pointX(p)) < PW / 2 + 1 && (isTop(p) ? y < BH / 2 : y >= BH / 2)) return p;
    return null;
  }
  cv.addEventListener('click', (e) => {
    if (busy || turn !== 'me') return;
    if (!dice.length) { roll(); return; } // any tap on the board rolls when it is time to roll
    const p = hit(e); if (p == null) return;
    const opts = nextOptions();
    if (sel != null) {
      const o = opts.find((x) => x.mv[0] === sel && x.mv[1] === p);
      if (o) {
        const before = s, after = applyStep(s, o.mv);
        history.push({ s, sel }); done.push(o.mv); used.push(o.d); sel = null; busy = true; syncButtons();
        const wasHit = after.bar[1] > before.bar[1];
        animate(o.mv[0], o.mv[1], true, before, after, () => {
          if (wasHit) ctx.sfx.capture();
          busy = false;
          if (s.off[0] === 15) return finish(true);
          if (!nextOptions().length) return endMyTurn();
          say(s.bar[0] ? MSG.bar : MSG.pick);
          if (s.bar[0]) sel = 25;
          syncButtons(); draw();
        });
        return;
      }
    }
    const canFrom = opts.some((x) => x.mv[0] === p);
    sel = canFrom ? (sel === p ? null : p) : null;
    if (sel != null) ctx.sfx.tap();
    draw();
  });
  undoBtn.onclick = () => {
    if (busy || !done.length) return;
    const h = history.pop(); s = h.s; done.pop(); used.pop(); sel = s.bar[0] ? 25 : null; draw(); syncButtons(); say(s.bar[0] ? MSG.bar : MSG.pick);
  };
  rollBtn.onclick = roll;
  function endMyTurn() { dice = []; used = []; done = []; seqs = []; sel = null; turn = 'cpu'; busy = true; syncButtons(); draw(); later(cpuTurn, 500); }
  // ---------- computer ----------
  const toMine = (p) => (p === 25 || p === 0 ? p : 25 - p);
  function cpuTurn() {
    busy = true; syncButtons(); say(MSG.cpu);
    tumble(cpuDiceX, () => {
      cpuDice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      ctx.sfx.tap(); draw();
      const play = bestPlay(flip(s), cpuDice, ctx.level);
      const stepsList = play ? play.steps.slice() : [];
      let fv = flip(s);
      const next = () => {
        if (!stepsList.length) {
          later(() => {
            cpuDice = null; turn = 'me'; busy = false; draw();
            if (s.off[1] === 15) return finish(false);
            say(MSG.roll); syncButtons();
          }, 500);
          return;
        }
        const mv = stepsList.shift();
        const before = s; fv = applyStep(fv, mv); const after = flip(fv);
        const wasHit = after.bar[0] > before.bar[0];
        animate(toMine(mv[0]), toMine(mv[1]), false, before, after, () => { if (wasHit) ctx.sfx.capture(); if (after.off[1] === 15) { cpuDice = null; return finish(false); } later(next, 240); });
      };
      later(next, 600);
    });
  }
  function finish(won) {
    busy = true; syncButtons(); say(''); draw();
    wrap.dataset.over = '1'; layout();
    const gammon = won ? s.off[1] === 0 : s.off[0] === 0;
    ctx.over(won ? { result: 'win', text: { en: MSG.winText.en + (gammon ? MSG.gammon.en : ''), de: MSG.winText.de + (gammon ? MSG.gammon.de : '') } }
      : { result: 'lose', text: { en: MSG.loseText.en + (gammon ? MSG.gammon.en : ''), de: MSG.loseText.de + (gammon ? MSG.gammon.de : '') } });
  }
  syncButtons(); say(MSG.roll); layout();
  if (window.innerWidth < 700) later(() => window.scrollTo(0, wrap.getBoundingClientRect().top + window.scrollY - 4), 120);
  window.__bgdbg = () => ({ s, dice, turn, busy, done, sel, rot: view.rot, opts: nextOptions().map((o) => o.mv) });
  // test helper: point number -> screen position of its checker column
  window.__bgxy = (p) => { const x = p === 25 ? BARX : p === 0 ? BOARD + 12 : pointX(p), y = p === 0 ? BH * 0.75 : p === 25 ? BH / 2 - 24 : isTop(p) ? F + 40 : BH - F - 40;
    const r = cv.getBoundingClientRect(); return view.rot ? [r.left + (BH - y) * view.s, r.top + x * view.s] : [r.left + x * view.s, r.top + y * view.s]; };
  return () => {
    alive = false; timers.forEach(clearTimeout); ro.disconnect();
    window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize);
    document.removeEventListener('fullscreenchange', onResize);
    document.body.style.overflow = ''; app?.classList.remove('wide');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}

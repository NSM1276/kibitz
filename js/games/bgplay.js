// Long nardy (default) and backgammon vs computer. You are white and move 24 -> 1, the computer is red.
// The game opens like a real one: each side throws one die, the higher one starts.
// Dice are thrown across your half of the board, bounce off the walls and settle where they land.
// Phone-first: the board stands upright on a phone held upright (bigger checkers) and lies flat sideways.
import * as BG from './bgfull.js';
import * as NR from './nardlogic.js';
import { makeView, canFullscreen, toggleFullscreen, phoneLandscape } from './fitview.js';

function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 40); }
const MSG = {
  hintBtn: { en: 'Hint', de: 'Tipp' },
  opening: { en: 'Who starts? Tap the board to throw your die.', de: 'Wer beginnt? Tippe aufs Brett und wirf deinen Würfel.' },
  tie: { en: 'Same number, throw again!', de: 'Gleiche Zahl, nochmal werfen!' },
  youStart: (a, b) => ({ en: `You ${a} : ${b} Computer. You start!`, de: `Du ${a} : ${b} Computer. Du beginnst!` }),
  cpuStarts: (a, b) => ({ en: `You ${a} : ${b} Computer. The computer starts.`, de: `Du ${a} : ${b} Computer. Der Computer beginnt.` }),
  roll: { en: 'Tap the board to roll the dice.', de: 'Tippe aufs Brett, um zu würfeln.' },
  pick: { en: 'Tap a white checker, then a glowing spot.', de: 'Tippe einen weißen Stein, dann eine leuchtende Stelle.' },
  bar: { en: 'You are on the bar: enter first, tap a glowing spot.', de: 'Du stehst auf der Bar: Erst einsetzen, tippe auf eine leuchtende Stelle.' },
  none: { en: 'No legal move with this roll.', de: 'Mit diesem Wurf ist kein Zug möglich.' },
  cpu: { en: 'Computer is moving…', de: 'Der Computer zieht…' },
  headOnce: { en: 'Only one checker may leave the head per turn (first turn 6-6, 4-4, 3-3: two).', de: 'Vom Kopf darf pro Zug nur ein Stein (erster Zug mit 6-6, 4-4, 3-3: zwei).' },
  blocked: { en: 'That point is taken: in long nardy one checker blocks a point.', de: 'Der Punkt ist besetzt: In der Langen Narde sperrt schon ein Stein.' },
  rollBtn: { en: 'Roll', de: 'Würfeln' }, undo: { en: 'Undo', de: 'Zurück' },
  you: { en: 'You', de: 'Du' }, cpuName: { en: 'Computer', de: 'Computer' }, pips: { en: 'pips', de: 'Augen' },
  nard: { en: 'Long nardy', de: 'Lange Narde' }, bg: { en: 'Backgammon', de: 'Backgammon' },
  winText: { en: 'All your checkers are off. Well played!', de: 'Alle deine Steine sind draußen. Gut gespielt!' },
  loseText: { en: 'The computer bore off first.', de: 'Der Computer war zuerst fertig.' },
  gammon: { en: ' Gammon (double win)!', de: ' Gammon (doppelter Sieg)!' },
  mars: { en: ' Mars (double win)!', de: ' Mars (doppelter Sieg)!' },
};
const BOARD = 400, TRAY = 34, BW = BOARD + TRAY, BH = 300, F = 10, BAR = 26, PW = (BOARD - 2 * F - BAR) / 12, PH = 124, CR = 14, DS = 16;
const BARX = F + 6 * PW + BAR / 2;
function pointX(p) { const col = p <= 12 ? 12 - p : p - 13; return F + col * PW + PW / 2 + (col >= 6 ? BAR : 0); }
const isTop = (p) => p >= 13;
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
// halves of the board where dice land: mine on the right, the computer's on the left
const REST = 0.78; // dice rest on the bar between the halves, where no checkers stand
const slot = (owner, i) => [BARX, owner === 'me' ? BH - F - DS * REST - 3 - i * (DS * REST * 2 + 4) : F + DS * REST + 3 + i * (DS * REST * 2 + 4)];
const HALF = { me: [F + 6 * PW + BAR, BOARD - F], cpu: [F, F + 6 * PW] };
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

export function playBackgammon(stage, ctx) {
  const app = document.getElementById('app');
  app?.classList.add('wide');
  const wrap = document.createElement('div'); wrap.className = 'pgame bg';
  wrap.innerHTML = `<div class="ptop"><button class="pico pexit">✕</button><div class="pl me"></div><div class="pl cpu"></div><button class="pico pfs">⛶</button></div>
    <div class="pvar"><button data-v="nard"></button><button data-v="bg"></button></div>
    <div class="phint"></div>
    <div class="pmain"><div class="pcvbox"><canvas class="gcv"></canvas></div>
      <div class="pside"><button class="btn bundo"></button><button class="btn bhint"></button><button class="btn primary broll"></button></div></div>`;
  stage.append(wrap);
  const $ = (q) => wrap.querySelector(q);
  const cv = $('canvas'), g = cv.getContext('2d'), hintEl = $('.phint'), undoBtn = $('.bundo'), rollBtn = $('.broll'), hintBtn = $('.bhint');
  hintBtn.textContent = '💡 ' + ctx.t(MSG.hintBtn);
  undoBtn.textContent = '↶ ' + ctx.t(MSG.undo); rollBtn.textContent = '🎲 ' + ctx.t(MSG.rollBtn);
  const view = makeView(cv, BW, BH);
  const bgc = document.createElement('canvas'), bgg = bgc.getContext('2d');
  const say = (m) => { hintEl.textContent = m ? ctx.t(m) : ''; };

  let variant = 'nard';
  try { variant = localStorage.getItem('ym:bgvar') === 'bg' ? 'bg' : 'nard'; } catch {}
  let E = variant === 'nard' ? NR : BG;
  const toMine = (p) => (p === 0 || p === 25 ? p : variant === 'nard' ? NR.other(p) : 25 - p);

  // phase: opening | roll | move | cpu | over
  let s, phase, dice, used, seqs, done, history, sel, busy, anim, turn, dobj, first, tipMv = null, gen = 0, alive = true;
  const timers = [];
  const later = (fn, ms) => { const g0 = gen; const id = setTimeout(() => alive && g0 === gen && fn(), ms); timers.push(id); };

  // ---------- layout ----------
  function layout() {
    if (!alive) return;
    const fs = (phoneLandscape() || document.fullscreenElement === wrap) && phase !== 'over';
    wrap.classList.toggle('fs', fs);
    document.body.style.overflow = fs ? 'hidden' : '';
    // the board always lies the normal way. Sideways phone: players + hint in a left column, buttons on the right,
    // so the board gets the whole height of the screen.
    let best;
    if (fs) {
      wrap.classList.add('side');
      const lw = $('.ptop').offsetWidth || 150;
      best = { rot: false, side: true, s: view.fit(false, wrap.clientWidth - lw - 128 - 20, wrap.clientHeight - 10) };
    } else {
      const top = $('.ptop').offsetHeight + hintEl.offsetHeight + $('.pvar').offsetHeight + 12;
      const W0 = wrap.clientWidth, H0 = window.innerHeight - 16 - top;
      const opts = [
        { rot: false, side: false, s: view.fit(false, W0, H0 - 62) },
        { rot: false, side: true, s: view.fit(false, W0 - 128, H0) },
      ];
      best = opts.reduce((x, y) => (y.s > x.s * 1.04 ? y : x));
    }
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
  wrap.querySelectorAll('.pvar button').forEach((b) => {
    b.textContent = ctx.t(MSG[b.dataset.v]);
    b.onclick = () => { if (b.dataset.v === variant) return; variant = b.dataset.v; try { localStorage.setItem('ym:bgvar', variant); } catch {} E = variant === 'nard' ? NR : BG; ctx.sfx.tap(); newGame(); };
  });

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
    // a lifted checker (being carried) is a bit bigger and casts its shadow further away
    if (lift) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 6, y + 8, CR * 1.04, 0, 7); g.fill(); g.translate(x, y); g.scale(1.1, 1.1); g.translate(-x, -y); }
    else { g.fillStyle = 'rgba(0,0,0,.42)'; g.beginPath(); g.arc(x + 1.6, y + 2.6, CR, 0, 7); g.fill(); }
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
  // a die with rounded corners; z = height above the board while it flies (bigger, shadow further away)
  function die(x, y, v, dim, ang = 0, z = 0, badge = '', sc = 1) {
    g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = dim ? 0.38 : 1;
    const S = DS * sc * (1 + z * 0.35);
    g.fillStyle = `rgba(0,0,0,${0.42 - z * 0.15})`; g.beginPath(); g.roundRect(-S + 2 + z * 9, -S + 3 + z * 12, 2 * S, 2 * S, S * 0.4); g.fill();
    const dg = g.createLinearGradient(-S, -S, S, S); dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.6, '#f3eee2'); dg.addColorStop(1, '#d9d0bb');
    g.fillStyle = dg; g.beginPath(); g.roundRect(-S, -S, 2 * S, 2 * S, S * 0.4); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2; g.beginPath(); g.roundRect(-S + 1.5, -S + 1.5, 2 * S - 3, 2 * S - 3, S * 0.36); g.stroke();
    if (view.rot) g.rotate(-Math.PI / 2); // keep the pips upright on a turned board (looks the same, but 2/3/6 read right)
    g.fillStyle = '#1b1b1b'; const k = S / DS;
    for (const [a, b] of PIPS[v]) { g.beginPath(); g.arc(a * 8 * k, b * 8 * k, 3.1 * k, 0, 7); g.fill(); }
    if (badge) { g.globalAlpha = 1; g.fillStyle = '#b8873a'; g.beginPath(); g.arc(S - 1, -S + 1, 6.5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 8px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(badge, S - 1, -S + 1.5); }
    g.restore();
  }
  function nextOptions() {
    const k = done.length;
    const match = seqs.filter((sq) => done.every((d, i) => sq[i] && sq[i].mv[0] === d[0] && sq[i].mv[1] === d[1]));
    return match.filter((sq) => sq[k]).map((sq) => sq[k]);
  }
  function draw() {
    if (!alive || !bgc.width) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgc, 0, 0); view.apply(g);
    const opts = phase === 'move' && !busy ? nextOptions() : [];
    const targets = sel != null ? opts.filter((o) => o.mv[0] === sel).map((o) => o.mv[1]) : [];
    const movable = new Set(opts.map((o) => o.mv[0]));
    const t = performance.now() / 1000, glow = 0.55 + 0.35 * Math.sin(t * 5);
    for (const p of targets) {
      if (p === 0) continue;
      const x = pointX(p), top = isTop(p), y0 = top ? F : BH - F, y1 = top ? F + PH : BH - F - PH;
      g.fillStyle = `rgba(255,214,90,${0.25 + 0.2 * glow})`; g.beginPath(); g.moveTo(x - PW / 2 + 1, y0); g.lineTo(x + PW / 2 - 1, y0); g.lineTo(x, y1); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,240,210,.55)'; g.font = 'bold 9px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let p = 1; p <= 24; p++) upright(pointX(p), isTop(p) ? F + PH + 8 : BH - F - PH - 8, () => g.fillText(p, 0, 0));
    for (let p = 1; p <= 24; p++) {
      const x = pointX(p), n = Math.abs(s.b[p]), mine = s.b[p] > 0;
      let shown = n;
      for (let i = 0; i < n; i++) {
        if (anim && anim.to === p && i === n - 1 && anim.mine === mine) { shown--; continue; }
        const topOne = i === n - 1;
        if (mine && sel === p && topOne) continue;
        checker(x, slotY(p, i, n), mine, mine && topOne && sel == null && movable.has(p) ? `rgba(217,172,92,${glow})` : null);
      }
      if (shown > 5) { // tall stack: show the count on the top checker
        upright(x, slotY(p, n - 1, n), () => { g.fillStyle = mine ? '#3b2416' : '#fff'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(shown, 0, 0.5); });
      }
    }
    for (let i = 0; i < s.bar[0]; i++) if (!(anim && anim.to === 25 && i === s.bar[0] - 1) && !(sel === 25 && i === s.bar[0] - 1)) checker(BARX, BH / 2 - 24 - i * 20, true, sel == null && movable.has(25) && i === s.bar[0] - 1 ? `rgba(217,172,92,${glow})` : null);
    for (let i = 0; i < s.bar[1]; i++) if (!(anim && anim.to === -25 && i === s.bar[1] - 1)) checker(BARX, BH / 2 + 24 + i * 20, false);
    for (let i = 0; i < s.off[0]; i++) { g.fillStyle = i % 2 ? '#efe8d6' : '#fffdf6'; g.fillRect(BOARD + 3, BH - F - 7 - i * 8, TRAY - F - 6, 7); }
    for (let i = 0; i < s.off[1]; i++) { g.fillStyle = i % 2 ? '#8a2618' : '#a83a26'; g.fillRect(BOARD + 3, F + 2 + i * 8, TRAY - F - 6, 7); }
    if (targets.includes(0)) {
      g.fillStyle = `rgba(255,214,90,${0.3 + 0.25 * glow})`; g.fillRect(BOARD + 1, BH / 2 + 3, TRAY - F - 2, BH / 2 - F - 5);
      upright(BOARD + (TRAY - F) / 2, BH * 0.62, () => { g.fillStyle = '#2a1a08'; g.font = 'bold 18px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⇩', 0, 0); });
    }
    for (const p of targets) {
      if (p === 0) continue;
      const n = Math.max(0, s.b[p] > 0 ? s.b[p] : 0), x = pointX(p), y = slotY(p, Math.min(n, 5), Math.max(n + 1, 1));
      g.save(); g.setLineDash([4, 3]); g.strokeStyle = `rgba(255,224,120,${0.6 + 0.4 * glow})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, CR - 1, 0, 7); g.stroke();
      g.setLineDash([]); g.fillStyle = 'rgba(255,224,120,.18)'; g.fill(); g.restore();
    }
    if (tipMv && phase === 'move' && !busy) {
      const [tf, tt] = tipMv, pulseR = CR + 2 + 2 * glow;
      const ring = (x, y) => { g.save(); g.strokeStyle = '#4fc3ff'; g.lineWidth = 3.5; g.shadowColor = '#4fc3ff'; g.shadowBlur = 10; g.beginPath(); g.arc(x, y, pulseR, 0, 7); g.stroke(); g.restore(); };
      if (tt === 0) { g.save(); g.strokeStyle = '#4fc3ff'; g.lineWidth = 3.5; g.strokeRect(BOARD + 2, BH / 2 + 4, TRAY - F - 4, BH / 2 - F - 7); g.restore(); }
      else { const n = Math.max(0, s.b[tt] > 0 ? s.b[tt] : 0); ring(pointX(tt), slotY(tt, Math.min(n, 5), Math.max(n + 1, 1))); }
      if (sel == null && tf !== 25) { const n = Math.abs(s.b[tf]); if (n) ring(pointX(tf), slotY(tf, n - 1, n)); }
    }
    if (sel != null) {
      const sx = sel === 25 ? BARX : pointX(sel), n = sel === 25 ? s.bar[0] : Math.abs(s.b[sel]);
      const sy = sel === 25 ? BH / 2 - 24 - (n - 1) * 20 : slotY(sel, n - 1, n);
      checker(sx, sy + (sel === 25 ? 0 : isTop(sel) ? 6 : -6), true, '#ffd45a', true);
    }
    if (anim) checker(anim.x, anim.y, anim.mine, null, true);
    // dice where they landed (or in flight)
    const dbl = dice && dice.length === 2 && dice[0] === dice[1];
    dobj.forEach((d, i) => {
      let dim = false, badge = '';
      if (phase === 'move' && turn === 'me' && !d.flying) {
        if (dbl) { const left = 4 - used.length, mine2 = Math.max(0, Math.min(2, left - (1 - i) * 2)); dim = mine2 === 0; badge = mine2 === 2 ? '2' : ''; }
        else dim = used.includes(d.face);
      }
      die(d.x, d.y, d.face, dim, d.a, d.z || 0, badge, d.sc || 1);
    });
    if ((phase === 'roll' || phase === 'opening') && turn === 'me' && !busy && !dobj.length) {
      const list = phase === 'opening' ? [6] : [5, 3];
      list.forEach((v, i) => { const [x, y] = slot('me', i); die(x, y, v, false, Math.sin(t * 2.5 + i) * 0.08, 0, '', REST); });
      const [, y0] = slot('me', list.length - 1);
      g.save(); g.strokeStyle = `rgba(255,214,90,${glow})`; g.lineWidth = 2.5; g.beginPath(); g.roundRect(BARX - BAR / 2 - 1, y0 - DS * REST - 4, BAR + 2, BH - F - (y0 - DS * REST - 4) - 2, 8); g.stroke(); g.restore();
    }
    renderInfo();
  }
  function renderInfo() {
    const [mp, op] = E.pips(s);
    const me = $('.pl.me'), cp = $('.pl.cpu');
    const hm = `<i class="cki w"></i><b>${ctx.t(MSG.you)}</b> <small>${mp} ${ctx.t(MSG.pips)}</small>`, hc = `<i class="cki r"></i><b>${ctx.t(MSG.cpuName)}</b> <small>${op} ${ctx.t(MSG.pips)}</small>`;
    if (me.innerHTML !== hm) me.innerHTML = hm; if (cp.innerHTML !== hc) cp.innerHTML = hc;
    me.classList.toggle('on', turn === 'me' && phase !== 'opening'); cp.classList.toggle('on', turn === 'cpu' && phase !== 'opening');
    wrap.querySelectorAll('.pvar button').forEach((b) => b.classList.toggle('on', b.dataset.v === variant));
    rollBtn.disabled = busy || turn !== 'me' || !(phase === 'roll' || phase === 'opening');
    undoBtn.disabled = busy || !done.length || phase !== 'move';
  }
  const pulse = () => { if (!alive) return; if (turn === 'me' && !busy && !anim) draw(); setTimeout(() => frame(pulse), 70); };

  // ---------- checker animation ----------
  function coords(p, mine, idxFromTop) {
    if (p === 25) return [BARX, mine ? BH / 2 - 24 - idxFromTop * 20 : BH / 2 + 24 + idxFromTop * 20];
    if (p === 0) return [BOARD + (TRAY - F) / 2, mine ? BH - F - 20 : F + 20];
    const n = Math.max(1, idxFromTop + 1); return [pointX(p), slotY(p, idxFromTop, n)];
  }
  function animate(from, to, mine, before, after, cb) {
    const g0 = gen;
    const nFrom = from === 25 ? (mine ? before.bar[0] : before.bar[1]) : Math.abs(before.b[from]);
    const [x0, y0] = coords(from, mine, nFrom - 1);
    s = after;
    const nTo = to === 0 ? 1 : Math.abs(after.b[to]);
    const [x1, y1] = to === 0 ? coords(0, mine, 0) : [pointX(to), slotY(to, nTo - 1, nTo)];
    // ease in-out slide with a small arc; longer trips take a little longer and arc higher
    const dist = Math.hypot(x1 - x0, y1 - y0), t0 = performance.now(), T = 240 + Math.min(160, dist * 0.35), arc = Math.min(34, 10 + dist * 0.08);
    anim = { to: to === 0 ? -99 : to, mine, x: x0, y: y0 };
    const stepF = (tm) => {
      if (!alive || g0 !== gen) return;
      const k = Math.min(1, (tm - t0) / T), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      anim.x = x0 + (x1 - x0) * e; anim.y = y0 + (y1 - y0) * e - Math.sin(k * Math.PI) * arc;
      draw();
      if (k < 1) frame(stepF); else { anim = null; to === 0 ? ctx.sfx.move() : ctx.sfx.checker(); draw(); cb && cb(); }
    };
    frame(stepF);
  }

  // ---------- dice throw: a little 2D physics run, precomputed, then played back ----------
  // list: [{owner:'me'|'cpu', value}]
  function throwDice(list, cb) {
    const g0 = gen, dt = 1 / 60;
    const ds = list.map((it, i) => {
      const [x0, x1] = HALF[it.owner], fromRight = it.owner === 'me';
      const y = BH / 2 + (i % 2 ? 1 : -1) * (30 + Math.random() * 40) + (list.length === 1 ? 0 : 0);
      return { owner: it.owner, value: it.value, x: fromRight ? x1 - DS - 2 : x0 + DS + 2, y,
        vx: (fromRight ? -1 : 1) * (430 + Math.random() * 160), vy: (Math.random() - 0.5) * 260,
        a: Math.random() * 6, va: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 10), z: 0.9, vz: 1.2 + Math.random() * 0.6, face: 1 + Math.floor(Math.random() * 6), tick: 0 };
    });
    const frames = [], ticks = [];
    for (let f = 0; f < 120; f++) {
      let moving = false;
      for (const d of ds) {
        const sp = Math.hypot(d.vx, d.vy);
        if (sp > 6 || d.z > 0) moving = true;
        d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
        const fr = d.z > 0 ? 0.985 : 0.9; d.vx *= fr; d.vy *= fr; d.va *= d.z > 0 ? 0.99 : 0.86;
        d.vz -= 9 * dt; d.z += d.vz * dt;
        if (d.z < 0) { d.z = 0; if (d.vz < -0.5) { ticks.push([f, Math.min(0.5, -d.vz * 0.18)]); d.va += (Math.random() - 0.5) * 8; } d.vz = -d.vz * 0.42; if (d.vz < 0.35) d.vz = 0; }
        const [x0, x1] = HALF[d.owner];
        if (d.x < x0 + DS) { d.x = x0 + DS; d.vx = Math.abs(d.vx) * 0.55; ticks.push([f, 0.3]); }
        if (d.x > x1 - DS) { d.x = x1 - DS; d.vx = -Math.abs(d.vx) * 0.55; ticks.push([f, 0.3]); }
        if (d.y < F + DS) { d.y = F + DS; d.vy = Math.abs(d.vy) * 0.55; ticks.push([f, 0.25]); }
        if (d.y > BH - F - DS) { d.y = BH - F - DS; d.vy = -Math.abs(d.vy) * 0.55; ticks.push([f, 0.25]); }
        // faces tumble while the die moves fast, then it shows its number
        if (sp > 90 || d.z > 0.05) { if (++d.tick % 3 === 0) d.face = 1 + Math.floor(Math.random() * 6); } else d.face = d.value;
      }
      // dice push each other apart
      for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
        const a = ds[i], b = ds[j], dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1, min = DS * 2.3;
        if (dd < min && a.owner === b.owner) { const push = (min - dd) / 2, nx = dx / dd, ny = dy / dd; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny; if (vn > 0) { a.vx -= vn * nx; a.vy -= vn * ny; b.vx += vn * nx; b.vy += vn * ny; ticks.push([f, 0.3]); } }
      }
      frames.push(ds.map((d) => ({ x: d.x, y: d.y, a: d.a, z: d.z, face: d.face })));
      if (!moving && f > 20) break;
    }
    // settle: the dice show their numbers, then glide onto the bar so they never hide checkers
    const stop = frames[frames.length - 1].map((d, i) => ({ ...d, face: list[i].value, z: 0 }));
    const perOwner = { me: 0, cpu: 0 };
    const targets = list.map((it) => slot(it.owner, perOwner[it.owner]++));
    const aim = stop.map((d) => Math.round(d.a / (Math.PI / 2)) * (Math.PI / 2));
    for (let k = 1; k <= 16; k++) {
      const e = 1 - Math.pow(1 - k / 16, 3);
      frames.push(stop.map((d, i) => ({ x: d.x + (targets[i][0] - d.x) * e, y: d.y + (targets[i][1] - d.y) * e, a: d.a + (aim[i] - d.a) * e, z: Math.sin(e * Math.PI) * 0.25, face: d.face, sc: 1 + (REST - 1) * e })));
    }
    const last = frames[frames.length - 1];
    list.length === 1 ? ctx.sfx.die() : ctx.sfx.dice();
    const t0 = performance.now(); let ti = 0;
    dobj = last.map((d) => ({ ...d, flying: true }));
    busy = true;
    const stepF = (tm) => {
      if (!alive || g0 !== gen) return;
      const fi = Math.min(frames.length - 1, Math.floor((tm - t0) / 1000 * 60));
      while (ti < ticks.length && ticks[ti][0] <= fi) { if (ticks[ti][0] > 4) ctx.sfx.diceTick(ticks[ti][1]); ti++; }
      dobj = frames[fi].map((d) => ({ ...d, flying: fi < frames.length - 1 }));
      draw();
      if (fi < frames.length - 1) frame(stepF); else { dobj.forEach((d, i) => { d.face = list[i].value; d.flying = false; }); busy = false; draw(); cb(); }
    };
    frame(stepF);
  }
  const d6 = () => 1 + Math.floor(Math.random() * 6);

  // ---------- opening: each side throws one die ----------
  function openingThrow() {
    if (busy || phase !== 'opening') return;
    const a = d6(), b = d6();
    throwDice([{ owner: 'me', value: a }, { owner: 'cpu', value: b }], () => {
      if (a === b) { say(MSG.tie); later(() => { dobj = []; draw(); say(MSG.opening); }, 1100); return; }
      const meFirst = a > b;
      say(meFirst ? MSG.youStart(a, b) : MSG.cpuStarts(a, b));
      busy = true;
      later(() => {
        busy = false; dobj = [];
        if (meFirst) { turn = 'me'; phase = 'roll'; draw(); later(() => say(MSG.roll), 900); }
        else { turn = 'cpu'; phase = 'cpu'; draw(); cpuTurn(); }
      }, 1500);
    });
  }
  // ---------- my turn ----------
  function roll() {
    if (busy || turn !== 'me' || phase !== 'roll') return;
    const v = [d6(), d6()];
    throwDice([{ owner: 'me', value: v[0] }, { owner: 'me', value: v[1] }], () => {
      dice = v; used = []; done = []; history = [];
      seqs = E.sequences(s, dice, first.me);
      phase = 'move';
      if (!seqs.length || !seqs[0].length) { say(MSG.none); busy = true; draw(); later(() => { busy = false; endMyTurn(); }, 1500); return; }
      say(s.bar[0] ? MSG.bar : MSG.pick);
      if (s.bar[0]) sel = 25;
      draw();
    });
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
    if (phase === 'opening') return openingThrow();
    if (phase === 'roll') return roll();
    if (phase !== 'move') return;
    const p = hit(e); if (p == null) return;
    const opts = nextOptions();
    if (sel != null) {
      const o = opts.find((x) => x.mv[0] === sel && x.mv[1] === p);
      if (o) return doMove(o);
      if (variant === 'nard' && p !== sel && p >= 1 && s.b[p] < 0) { ctx.toast(ctx.t(MSG.blocked), 2200); }
    }
    const canFrom = opts.some((x) => x.mv[0] === p);
    if (!canFrom && variant === 'nard' && p === 24 && s.b[24] > 0 && done.some((m) => m[0] === 24)) ctx.toast(ctx.t(MSG.headOnce), 2800);
    sel = canFrom ? (sel === p ? null : p) : null;
    if (sel != null) {
      // only one place this checker can go: move it straight away (undo is there if it was a slip)
      const dest = [...new Set(opts.filter((x) => x.mv[0] === sel).map((x) => x.mv[1]))];
      if (dest.length === 1) return doMove(opts.find((x) => x.mv[0] === sel));
      ctx.sfx.tap();
    }
    draw();
  });
  function doMove(o) {
    const before = s, after = E.step(s, o.mv);
    tipMv = null;
    history.push({ s, sel: o.mv[0] }); done.push(o.mv); used.push(o.d); sel = null; busy = true; renderInfo();
    const wasHit = after.bar[1] > before.bar[1];
    animate(o.mv[0], o.mv[1], true, before, after, () => {
      if (wasHit) ctx.sfx.capture();
      busy = false;
      if (s.off[0] === 15) return finish(true);
      if (!nextOptions().length) return endMyTurn();
      say(s.bar[0] ? MSG.bar : MSG.pick);
      if (s.bar[0]) sel = 25;
      draw();
    });
  }
  undoBtn.onclick = () => {
    if (busy || !done.length || phase !== 'move') return;
    tipMv = null;
    const h = history.pop(); s = h.s; done.pop(); used.pop(); sel = s.bar[0] ? 25 : null; draw(); say(s.bar[0] ? MSG.bar : MSG.pick);
  };
  rollBtn.onclick = () => (phase === 'opening' ? openingThrow() : roll());
  // hint: the engine's best play for this roll (from the start of the turn); if you already went another way,
  // the best next step from where you are
  hintBtn.onclick = () => {
    if (busy || turn !== 'me' || phase !== 'move') return;
    const opts = nextOptions(); if (!opts.length) return;
    const s0 = history.length ? history[0].s : s;
    const play = E.bestPlay(s0, dice, 2, first.me);
    const k = done.length, st = play && play.steps;
    let mv = null;
    if (st && st[k] && done.every((d, i) => st[i] && st[i][0] === d[0] && st[i][1] === d[1])) mv = st[k];
    if (!mv || !opts.some((o) => o.mv[0] === mv[0] && o.mv[1] === mv[1])) mv = opts[0].mv;
    tipMv = mv; ctx.sfx.tap();
    if (s.bar[0] && mv[0] !== 25) tipMv = opts[0].mv;
    draw();
  };
  function endMyTurn() {
    tipMv = null; first.me = false; dice = []; used = []; done = []; seqs = []; sel = null; turn = 'cpu'; phase = 'cpu'; busy = true;
    later(() => { dobj = []; draw(); later(cpuTurn, 250); }, 450);
    draw();
  }
  // ---------- computer ----------
  function cpuTurn() {
    busy = true; say(MSG.cpu); draw();
    const cd = [d6(), d6()];
    throwDice([{ owner: 'cpu', value: cd[0] }, { owner: 'cpu', value: cd[1] }], () => {
      busy = true;
      const play = E.bestPlay(E.flip(s), cd, ctx.level, first.cpu);
      first.cpu = false;
      const stepsList = play ? play.steps.slice() : [];
      let fv = E.flip(s);
      const next = () => {
        if (!stepsList.length) {
          later(() => {
            dobj = []; turn = 'me'; phase = 'roll'; busy = false; draw();
            if (s.off[1] === 15) return finish(false);
            say(MSG.roll);
          }, 600);
          return;
        }
        const mv = stepsList.shift();
        const before = s; fv = E.step(fv, mv); const after = E.flip(fv);
        const wasHit = after.bar[0] > before.bar[0];
        animate(toMine(mv[0]), toMine(mv[1]), false, before, after, () => { if (wasHit) ctx.sfx.capture(); if (after.off[1] === 15) { dobj = []; return finish(false); } later(next, 260); });
      };
      later(next, 500);
    });
  }
  function finish(won) {
    busy = true; phase = 'over'; say(''); draw();
    layout();
    const dbl = won ? s.off[1] === 0 : s.off[0] === 0, extra = dbl ? (variant === 'nard' ? MSG.mars : MSG.gammon) : null;
    const base = won ? MSG.winText : MSG.loseText;
    ctx.over({ result: won ? 'win' : 'lose', text: { en: base.en + (extra ? extra.en : ''), de: base.de + (extra ? extra.de : '') } });
  }
  function newGame() {
    gen++;
    s = E.start(); phase = 'opening'; dice = []; used = []; seqs = []; done = []; history = []; sel = null; busy = false; anim = null; tipMv = null;
    turn = 'me'; dobj = []; first = { me: true, cpu: true };
    say(MSG.opening); draw();
  }

  newGame(); layout(); pulse();
  if (window.innerWidth < 700) later(() => window.scrollTo(0, wrap.getBoundingClientRect().top + window.scrollY - 4), 120);
  window.__bgdbg = () => ({ tip: tipMv, s, dice, turn, busy, done, sel, phase, variant, rot: view.rot, opts: phase === 'move' ? nextOptions().map((o) => o.mv) : [] });
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

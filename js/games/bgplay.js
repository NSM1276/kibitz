// Backgammon vs computer (no doubling cube). You are white and move 24 -> 1, the computer is red.
import { start, flip, sequences, step as applyStep, bestPlay, pips } from './bgfull.js';

function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 40); }
const MSG = {
  roll: { en: 'Tap “Roll” to throw the dice.', de: 'Tippe „Würfeln“.' },
  pick: { en: 'Tap a white checker, then a glowing point.', de: 'Tippe einen weißen Stein, dann einen leuchtenden Punkt.' },
  bar: { en: 'You are on the bar: enter first (tap the bar).', de: 'Du stehst auf der Bar: Erst einsetzen (tippe auf die Bar).' },
  none: { en: 'No legal move with this roll.', de: 'Mit diesem Wurf ist kein Zug möglich.' },
  cpu: { en: 'Computer is moving…', de: 'Der Computer zieht…' },
  rollBtn: { en: 'Roll', de: 'Würfeln' }, undo: { en: 'Undo', de: 'Zurück' },
  winText: { en: 'All your checkers are off. Well played!', de: 'Alle deine Steine sind draußen. Gut gespielt!' },
  loseText: { en: 'The computer bore off first.', de: 'Der Computer war zuerst fertig.' },
  gammon: { en: ' Gammon (double win)!', de: ' Gammon (doppelter Sieg)!' },
};
const BOARD = 400, TRAY = 34, BW = BOARD + TRAY, BH = 300, F = 10, BAR = 26, PW = (BOARD - 2 * F - BAR) / 12, PH = 122, CR = 13.2;
const BARX = F + 6 * PW + BAR / 2;
function pointX(p) { const col = p <= 12 ? 12 - p : p - 13; return F + col * PW + PW / 2 + (col >= 6 ? BAR : 0); }
const isTop = (p) => p >= 13;

export function playBackgammon(stage, ctx) {
  const cv = document.createElement('canvas'); cv.className = 'stagecv';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = BW * dpr; cv.height = BH * dpr; cv.style.aspectRatio = `${BW}/${BH}`;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const bar = document.createElement('div'); bar.className = 'toolbar';
  const undoBtn = document.createElement('button'); undoBtn.className = 'btn'; undoBtn.textContent = ctx.t(MSG.undo);
  const rollBtn = document.createElement('button'); rollBtn.className = 'btn primary'; rollBtn.textContent = ctx.t(MSG.rollBtn);
  bar.append(undoBtn, rollBtn); stage.append(cv, bar);

  let s = start(), dice = [], used = [], seqs = [], done = [], history = [], sel = null, busy = false, alive = true, anim = null, turn = 'me', cpuDice = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };

  // ---------- drawing ----------
  function checker(x, y, mine, glow) {
    g.save();
    g.fillStyle = '#0006'; g.beginPath(); g.arc(x + 1.5, y + 2.5, CR, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - 4, y - 5, 2, x, y, CR);
    if (mine) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9d2c0'); } else { gr.addColorStop(0, '#c0503a'); gr.addColorStop(1, '#6b1f14'); }
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, CR, 0, 7); g.fill();
    g.strokeStyle = mine ? '#a99f86' : '#3e0f08'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, CR * 0.62, 0, 7); g.stroke();
    if (glow) { g.strokeStyle = '#e8c46a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, CR + 1.5, 0, 7); g.stroke(); }
    g.restore();
  }
  const slotY = (p, i, n) => { const st = n > 5 ? (PH - CR * 2) / (n - 1) : CR * 2; return isTop(p) ? F + CR + i * st : BH - F - CR - i * st; };
  function die(x, y, v, dim) {
    g.save(); g.globalAlpha = dim ? 0.35 : 1; g.fillStyle = '#fffdf6'; g.strokeStyle = '#0003'; g.beginPath(); g.roundRect(x - 13, y - 13, 26, 26, 5); g.fill(); g.stroke();
    g.fillStyle = '#222';
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
    for (const [a, b] of P) { g.beginPath(); g.arc(x + a * 6.5, y + b * 6.5, 2.6, 0, 7); g.fill(); }
    g.restore();
  }
  function nextOptions() {
    const k = done.length;
    const match = seqs.filter((sq) => done.every((d, i) => sq[i] && sq[i].mv[0] === d[0] && sq[i].mv[1] === d[1]));
    return match.filter((sq) => sq[k]).map((sq) => sq[k]);
  }
  function draw() {
    if (!alive) return;
    g.clearRect(0, 0, BW, BH);
    g.fillStyle = '#4a2a14'; g.beginPath(); g.roundRect(0, 0, BW, BH, 12); g.fill();
    g.fillStyle = '#2f6d50'; g.fillRect(F, F, BOARD - 2 * F, BH - 2 * F);
    g.fillStyle = '#3a2010'; g.fillRect(F + 6 * PW, F, BAR, BH - 2 * F);
    g.fillStyle = '#2a170b'; g.fillRect(BOARD, F, TRAY - F, BH - 2 * F);
    const opts = turn === 'me' && sel != null ? nextOptions().filter((o) => o.mv[0] === sel).map((o) => o.mv[1]) : [];
    for (let p = 1; p <= 24; p++) {
      const x = pointX(p), top = isTop(p), y0 = top ? F : BH - F, y1 = top ? F + PH : BH - F - PH;
      g.fillStyle = opts.includes(p) ? '#e8c46a' : (p % 2 ? '#e7d3a7' : '#9b3b2a');
      g.beginPath(); g.moveTo(x - PW / 2 + 1, y0); g.lineTo(x + PW / 2 - 1, y0); g.lineTo(x, y1); g.closePath(); g.fill();
      g.fillStyle = '#ffffff60'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
      g.fillText(p, x, top ? F + PH + 10 : BH - F - PH - 4);
    }
    // off tray target
    if (opts.includes(0)) { g.fillStyle = '#e8c46a'; g.fillRect(BOARD + 2, BH / 2 + 4, TRAY - F - 4, BH / 2 - F - 8); }
    for (let p = 1; p <= 24; p++) {
      const x = pointX(p), n = Math.abs(s.b[p]), mine = s.b[p] > 0;
      for (let i = 0; i < n; i++) {
        if (anim && anim.to === p && i === n - 1 && anim.mine === mine) continue;
        checker(x, slotY(p, i, n), mine, mine && sel === p && i === n - 1);
      }
    }
    // bar: mine in the upper half (I enter at 19..24), computer's in the lower half
    for (let i = 0; i < s.bar[0]; i++) if (!(anim && anim.to === 25 && i === s.bar[0] - 1)) checker(BARX, BH / 2 - 22 - i * 20, true, sel === 25);
    for (let i = 0; i < s.bar[1]; i++) if (!(anim && anim.to === -25 && i === s.bar[1] - 1)) checker(BARX, BH / 2 + 22 + i * 20, false);
    // borne off
    g.fillStyle = '#fffdf6'; for (let i = 0; i < s.off[0]; i++) g.fillRect(BOARD + 3, BH - F - 6 - i * 8, TRAY - F - 6, 6);
    g.fillStyle = '#9b3b2a'; for (let i = 0; i < s.off[1]; i++) g.fillRect(BOARD + 3, F + 2 + i * 8, TRAY - F - 6, 6);
    if (anim) checker(anim.x, anim.y, anim.mine);
    const dd = turn === 'me' ? dice : cpuDice;
    if (dd && dd.length) {
      const list = dd[0] === dd[1] ? [dd[0], dd[0], dd[0], dd[0]] : dd;
      const cx = turn === 'me' ? F + 6 * PW + BAR + 3 * PW : F + 3 * PW;
      list.forEach((d, i) => die(cx - (list.length - 1) * 15 + i * 30, BH / 2, d, turn === 'me' && i < used.length));
    }
    const [mp, op] = pips(s);
    g.fillStyle = '#ffffffa0'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center';
    g.fillText(mp, BOARD + (TRAY - F) / 2, BH / 2 + 3 + 10); g.fillText(op, BOARD + (TRAY - F) / 2, BH / 2 - 4);
  }
  // ---------- animation ----------
  function coords(p, mine, idxFromTop) {
    if (p === 25) return [BARX, mine ? BH / 2 - 22 - idxFromTop * 20 : BH / 2 + 22 + idxFromTop * 20];
    if (p === 0) return [BOARD + (TRAY - F) / 2, mine ? BH - F - 20 : F + 20];
    const n = Math.max(1, idxFromTop + 1); return [pointX(p), slotY(p, idxFromTop, n)];
  }
  function animate(from, to, mine, before, after, cb) {
    const nFrom = from === 25 ? (mine ? before.bar[0] : before.bar[1]) : Math.abs(before.b[from]);
    const [x0, y0] = coords(from, mine, nFrom - 1);
    s = after;
    const nTo = to === 0 ? 1 : Math.abs(after.b[to]);
    const [x1, y1] = to === 0 ? coords(0, mine, 0) : [pointX(to), slotY(to, nTo - 1, nTo)];
    const t0 = performance.now(), T = 360;
    anim = { to: to === 0 ? -99 : to, mine, x: x0, y: y0 };
    const stepF = (tm) => {
      if (!alive) return;
      const k = Math.min(1, (tm - t0) / T), e = 1 - Math.pow(1 - k, 3);
      anim.x = x0 + (x1 - x0) * e; anim.y = y0 + (y1 - y0) * e - Math.sin(k * Math.PI) * 36;
      draw();
      if (k < 1) frame(stepF); else { anim = null; ctx.sfx.move(); draw(); cb && cb(); }
    };
    frame(stepF);
  }
  // ---------- my turn ----------
  function roll() {
    if (busy || turn !== 'me' || dice.length) return;
    dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    used = []; done = []; history = [];
    seqs = sequences(s, dice);
    ctx.sfx.tap(); draw();
    if (!seqs.length || !seqs[0].length) { ctx.hint(MSG.none); busy = true; later(() => { busy = false; endMyTurn(); }, 1400); return; }
    ctx.hint(s.bar[0] ? MSG.bar : MSG.pick);
    syncButtons();
  }
  function syncButtons() { rollBtn.disabled = busy || turn !== 'me' || dice.length > 0; undoBtn.disabled = busy || !done.length; }
  function hit(e) {
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * BW) / r.width, y = ((e.clientY - r.top) * BH) / r.height;
    if (x >= BOARD) return 0;
    if (Math.abs(x - BARX) < BAR / 2 + 2) return 25;
    for (let p = 1; p <= 24; p++) if (Math.abs(x - pointX(p)) < PW / 2 && (isTop(p) ? y < BH / 2 : y >= BH / 2)) return p;
    return null;
  }
  cv.addEventListener('click', (e) => {
    if (busy || turn !== 'me' || !dice.length) return;
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
          ctx.hint(s.bar[0] ? MSG.bar : MSG.pick); syncButtons(); draw();
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
    const h = history.pop(); s = h.s; done.pop(); used.pop(); sel = null; draw(); syncButtons(); ctx.hint(MSG.pick);
  };
  rollBtn.onclick = roll;
  function endMyTurn() { dice = []; used = []; done = []; seqs = []; sel = null; turn = 'cpu'; syncButtons(); draw(); later(cpuTurn, 500); }
  // ---------- computer ----------
  const toMine = (p) => (p === 25 || p === 0 ? p : 25 - p);
  function cpuTurn() {
    busy = true; syncButtons(); ctx.hint(MSG.cpu);
    cpuDice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    ctx.sfx.tap(); draw();
    const play = bestPlay(flip(s), cpuDice, ctx.level);
    const stepsList = play ? play.steps.slice() : [];
    let view = flip(s);
    const next = () => {
      if (!stepsList.length) {
        later(() => {
          cpuDice = null; turn = 'me'; busy = false; draw();
          if (s.off[1] === 15) return finish(false);
          ctx.hint(MSG.roll); syncButtons();
        }, stepsList.length ? 0 : 500);
        return;
      }
      const mv = stepsList.shift();
      const before = s; view = applyStep(view, mv); const after = flip(view);
      const wasHit = after.bar[0] > before.bar[0];
      animate(toMine(mv[0]), toMine(mv[1]), false, before, after, () => { if (wasHit) ctx.sfx.capture(); if (after.off[1] === 15) { cpuDice = null; return finish(false); } later(next, 220); });
    };
    later(next, 700);
  }
  function finish(won) {
    busy = true; syncButtons(); ctx.hint(''); draw();
    const gammon = won ? s.off[1] === 0 : s.off[0] === 0;
    ctx.over(won ? { result: 'win', text: { en: MSG.winText.en + (gammon ? MSG.gammon.en : ''), de: MSG.winText.de + (gammon ? MSG.gammon.de : '') } }
      : { result: 'lose', text: { en: MSG.loseText.en + (gammon ? MSG.gammon.en : ''), de: MSG.loseText.de + (gammon ? MSG.gammon.de : '') } });
  }
  draw(); syncButtons(); ctx.hint(MSG.roll);
  window.__bgdbg = () => ({ s, dice, turn, busy, done, opts: nextOptions().map((o) => o.mv) });
  return () => { alive = false; timers.forEach(clearTimeout); };
}

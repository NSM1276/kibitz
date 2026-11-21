import tasks from '../../data/backgammon.js';
import { start, targets, apply, key, playKey } from './bglogic.js';
import { playBackgammon } from './bgplay.js';

function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 40); }
const MSG = {
  pick: { en: 'Tap one of your white checkers, then a glowing point.', de: 'Tippe einen weißen Stein, dann einen leuchtenden Punkt.' },
  next: { en: 'One die left…', de: 'Noch ein Würfel…' },
  undo: { en: 'Undo', de: 'Zurück' },
  wrong: { en: 'Legal, but not the best play.', de: 'Erlaubt, aber nicht der beste Zug.' },
  best: { en: 'Best:', de: 'Am besten:' },
  watch: { en: 'Watch the best play.', de: 'Schau dir den besten Zug an.' },
};

// geometry (logical px)
const BW = 400, BH = 300, F = 10, BAR = 26, PW = (BW - 2 * F - BAR) / 12, PH = 122, CR = 13.2;
function pointX(p) { // centre x of point p
  let col; // 0..11 from left
  if (p <= 12) col = 12 - p; else col = p - 13;
  return F + col * PW + PW / 2 + (col >= 6 ? BAR : 0);
}
const isTop = (p) => p >= 13;

export default {
  id: 'backgammon', icon: '🎲', color: '#ff9f5a',
  title: { en: 'Backgammon Openings', de: 'Backgammon: Eröffnungen' },
  tagline: { en: 'The best first move for every roll', de: 'Der beste erste Zug für jeden Wurf' },
  tasks,
  play: playBackgammon,
  playTitle: { en: 'Backgammon vs computer', de: 'Backgammon gegen Computer' },
  mount(stage, task, ctx) {
    const cv = document.createElement('canvas'); cv.className = 'stagecv';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = BW * dpr; cv.height = BH * dpr; cv.style.aspectRatio = `${BW}/${BH}`;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const bar = document.createElement('div'); bar.className = 'toolbar';
    const undoBtn = document.createElement('button'); undoBtn.className = 'btn'; undoBtn.textContent = ctx.t(MSG.undo);
    bar.append(undoBtn); stage.append(cv, bar);

    let pos = start(), dice = task.dice.slice(), history = [], sel = null, busy = false, anim = null, alive = true, mark = null;
    ctx.hint(MSG.pick);

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
    function slotY(p, i, n) {
      const step = n > 5 ? (PH - CR * 2) / (n - 1) : CR * 2;
      return isTop(p) ? F + CR + i * step : BH - F - CR - i * step;
    }
    function die(x, y, v) {
      g.save(); g.fillStyle = '#fffdf6'; g.strokeStyle = '#0003'; g.beginPath(); g.roundRect(x - 13, y - 13, 26, 26, 5); g.fill(); g.stroke();
      g.fillStyle = '#222';
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
      for (const [a, b] of P) { g.beginPath(); g.arc(x + a * 6.5, y + b * 6.5, 2.6, 0, 7); g.fill(); }
      g.restore();
    }

    function draw() {
      if (!alive) return;
      g.clearRect(0, 0, BW, BH);
      g.fillStyle = '#4a2a14'; g.beginPath(); g.roundRect(0, 0, BW, BH, 12); g.fill();
      g.fillStyle = '#2f6d50'; g.fillRect(F, F, BW - 2 * F, BH - 2 * F);
      g.fillStyle = '#4a2a14'; g.fillRect(F + 6 * PW, F, BAR, BH - 2 * F);
      const tgts = sel ? targets(pos, sel, dice).map((x) => x.to) : [];
      for (let p = 1; p <= 24; p++) {
        const x = pointX(p), top = isTop(p), y0 = top ? F : BH - F, y1 = top ? F + PH : BH - F - PH;
        g.fillStyle = tgts.includes(p) ? '#e8c46a' : (p % 2 ? '#e7d3a7' : '#9b3b2a');
        g.beginPath(); g.moveTo(x - PW / 2 + 1, y0); g.lineTo(x + PW / 2 - 1, y0); g.lineTo(x, y1); g.closePath(); g.fill();
        g.fillStyle = '#ffffff70'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center';
        g.fillText(p, x, top ? F + PH + 10 : BH - F - PH - 4);
      }
      for (let p = 1; p <= 24; p++) {
        const x = pointX(p);
        let n = pos.me[p]; const m = anim && anim.from === p ? n : n; // static count
        for (let i = 0; i < pos.opp[p]; i++) checker(x, slotY(p, i, pos.opp[p]), false);
        for (let i = 0; i < n; i++) {
          if (anim && anim.to === p && i === n - 1) continue; // moving checker drawn separately
          checker(x, slotY(p, i, n), true, sel === p && i === n - 1);
        }
        void m;
      }
      if (anim) checker(anim.x, anim.y, true);
      // dice (right half, centre) — used dice greyed
      const used = task.dice.map(() => false); const left = dice.slice();
      task.dice.forEach((d, i) => { const j = left.indexOf(d); if (j >= 0) left.splice(j, 1); else used[i] = true; });
      task.dice.forEach((d, i) => { g.globalAlpha = used[i] ? 0.35 : 1; die(F + 6 * PW + BAR + 2.3 * PW + i * 34, BH / 2, d); g.globalAlpha = 1; });
      if (mark) { g.fillStyle = mark.ok ? '#bfe3b0' : '#ffb4a8'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText(mark.text, F + 3 * PW, BH / 2 + 5); }
    }

    function moveAnim(from, to, done) {
      const x0 = pointX(from), y0 = slotY(from, pos.me[from] - 1, pos.me[from]);
      pos = apply(pos, from, to);
      const x1 = pointX(to), y1 = slotY(to, pos.me[to] - 1, pos.me[to]);
      const t0 = performance.now(), T = 380;
      anim = { from, to, x: x0, y: y0 };
      const step = (tm) => {
        if (!alive) return;
        const k = Math.min(1, (tm - t0) / T), e = 1 - Math.pow(1 - k, 3);
        anim.x = x0 + (x1 - x0) * e; anim.y = y0 + (y1 - y0) * e - Math.sin(k * Math.PI) * 40;
        draw();
        if (k < 1) frame(step); else { anim = null; ctx.sfx.move(); draw(); done && done(); }
      };
      frame(step);
    }

    function hitPoint(e) {
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * BW) / r.width, y = ((e.clientY - r.top) * BH) / r.height;
      for (let p = 1; p <= 24; p++) if (Math.abs(x - pointX(p)) < PW / 2 && (isTop(p) ? y < BH / 2 : y >= BH / 2)) return p;
      return null;
    }
    cv.addEventListener('click', (e) => {
      if (busy || !dice.length) return;
      const p = hitPoint(e); if (p == null) return;
      if (sel) {
        const t = targets(pos, sel, dice).find((x) => x.to === p);
        if (t) {
          const from = sel; sel = null; busy = true;
          history.push({ pos, dice: dice.slice() });
          dice.splice(dice.indexOf(t.die), 1);
          moveAnim(from, p, () => { busy = false; dice.length ? ctx.hint(MSG.next) : judge(); });
          return;
        }
      }
      sel = pos.me[p] && targets(pos, p, dice).length ? (sel === p ? null : p) : null;
      if (sel) ctx.sfx.tap();
      draw();
    });
    undoBtn.onclick = () => { if (busy || !history.length || mark) return; const h = history.pop(); pos = h.pos; dice = h.dice; sel = null; ctx.hint(MSG.pick); draw(); };

    const fmt = (play) => play.map(([f, t]) => `${f}/${t}`).join(' ');
    function judge() {
      const k = key(pos), okPlay = task.accept.find((pl) => playKey(pl) === k);
      ctx.hint('');
      if (okPlay) { mark = { ok: true, text: fmt(okPlay) }; draw(); return ctx.result({ ok: true, text: task.explain }); }
      mark = { ok: false, text: '✗' }; draw();
      ctx.result({
        ok: false,
        text: { en: `${MSG.wrong.en} ${MSG.best.en} ${task.accept.map(fmt).join(' or ')}. ${task.explain.en}`, de: `${MSG.wrong.de} ${MSG.best.de} ${task.accept.map(fmt).join(' oder ')}. ${task.explain.de}` },
        reveal: () => { pos = start(); dice = []; mark = null; draw(); ctx.hint(MSG.watch); const pl = task.accept[0].slice(); const nx = () => { if (!pl.length) { mark = { ok: true, text: fmt(task.accept[0]) }; draw(); return; } const [f, t] = pl.shift(); moveAnim(f, t, () => setTimeout(nx, 250)); }; setTimeout(nx, 300); },
      });
    }

    draw();
    return () => { alive = false; };
  },
};

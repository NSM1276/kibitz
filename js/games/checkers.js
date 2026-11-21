import { start, moves, apply, bestMove } from './checkerslogic.js';

const MSG = {
  you: { en: 'Your move (white). Tap a piece, then a square.', de: 'Du ziehst (Weiß). Tippe einen Stein, dann ein Feld.' },
  must: { en: 'You must capture! The glowing pieces can take.', de: 'Schlagpflicht! Die leuchtenden Steine können schlagen.' },
  more: { en: 'Keep jumping…', de: 'Weiter schlagen…' },
  think: { en: 'Computer is thinking…', de: 'Der Computer denkt nach…' },
  winText: { en: 'The computer has no moves left.', de: 'Der Computer hat keine Züge mehr.' },
  loseText: { en: 'You have no moves left. Try again!', de: 'Du hast keine Züge mehr. Versuch es nochmal!' },
  drawText: { en: '30 moves without a capture: draw.', de: '30 Züge ohne Schlagen: Remis.' },
};

export default {
  id: 'checkers', icon: '⛀', color: '#c9a36a',
  title: { en: 'Draughts', de: 'Dame' },
  playTitle: { en: 'Draughts vs computer', de: 'Dame gegen Computer' },
  tagline: { en: 'Russian rules: flying kings, captures are a must', de: 'Russische Regeln: fliegende Damen, Schlagpflicht' },
  tasks: [],
  play(stage, ctx) {
    let b = start(), turn = 1, alive = true, sel = null, partial = null, quiet = 0, busy = false;
    const timers = [];
    const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };
    const board = document.createElement('div'); board.className = 'board ckboard';
    stage.append(board);
    const sqEls = [], pcs = new Map();
    const pos = (sq) => [(sq & 7) * 12.5, (sq >> 3) * 12.5];
    for (let sq = 0; sq < 64; sq++) {
      const r = sq >> 3, c = sq & 7, el = document.createElement('div');
      el.className = 'sq ' + ((r + c) % 2 ? 'd' : 'l');
      const [x, y] = pos(sq); el.style.left = x + '%'; el.style.top = y + '%';
      el.onclick = () => click(sq);
      board.append(el); sqEls.push(el);
    }
    function draw() {
      for (const el of pcs.values()) el.remove();
      pcs.clear();
      b.forEach((p, sq) => {
        if (!p) return;
        const el = document.createElement('div');
        el.className = 'ck ' + (p > 0 ? 'w' : 'b') + (Math.abs(p) === 2 ? ' king' : '');
        const [x, y] = pos(sq); el.style.left = x + '%'; el.style.top = y + '%';
        board.append(el); pcs.set(sq, el);
      });
    }
    function marks() {
      sqEls.forEach((el) => el.classList.remove('sel', 'tgt', 'hintsq', 'from', 'to'));
      if (turn !== 1 || busy) return;
      const ms = legalNow();
      if (!sel && ms[0] && ms[0].caps.length) new Set(ms.map((m) => partial ? partial.at : m.from)).forEach((s) => sqEls[s].classList.add('hintsq'));
      if (sel != null) {
        sqEls[sel].classList.add('sel');
        const k = partial ? partial.k : 0;
        ms.filter((m) => m.from === (partial ? partial.from : sel)).forEach((m) => sqEls[m.path[k]].classList.add('tgt'));
      }
    }
    // moves still possible given the steps already taken in a multi-jump
    function legalNow() {
      const all = moves(b, 1);
      if (!partial) return all;
      return all.filter((m) => m.from === partial.from && partial.steps.every((s, i) => m.path[i] === s));
    }
    function slide(from, to) {
      const el = pcs.get(from); if (!el) return;
      pcs.delete(from); pcs.set(to, el);
      const [x, y] = pos(to); el.style.left = x + '%'; el.style.top = y + '%';
      // the piece lifts a little while it travels
      try { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)', filter: 'drop-shadow(0 6px 5px #0006)', offset: 0.45 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-in-out' }); } catch {}
    }
    // a captured piece stays half-visible until the whole move ends (Russian rules), then shrinks away
    function fade(sq) { const el = pcs.get(sq); if (el) { el.style.opacity = '.3'; el.dataset.dying = '1'; } }
    function vanish(then) {
      const dying = [...pcs.values()].filter((el) => el.dataset.dying);
      dying.forEach((el) => { try { el.animate([{ transform: 'scale(1)', opacity: 0.3 }, { transform: 'scale(.3)', opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }); } catch {} });
      later(then, dying.length ? 220 : 0);
    }
    // crowning: the new king pops and a chime plays
    function crown(before, m) {
      const to = m.path.at(-1);
      if (Math.abs(before[m.from]) !== 1 || Math.abs(b[to]) !== 2) return;
      const el = pcs.get(to); if (!el) return;
      try { el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.5,.5,1)' }); } catch {}
      ctx.sfx.ok(); ctx.sfx.buzz && ctx.sfx.buzz(25);
    }

    function click(sq) {
      if (turn !== 1 || busy || !alive) return;
      const ms = legalNow();
      if (partial) {
        const opts = ms.filter((m) => m.path[partial.k] === sq);
        if (opts.length) return step(opts, sq);
        return;
      }
      if (b[sq] > 0) {
        if (!ms.some((m) => m.from === sq)) { if (ms[0] && ms[0].caps.length) ctx.hint(MSG.must); sel = null; marks(); return; }
        sel = sq; ctx.sfx.tap(); marks(); return;
      }
      if (sel != null) {
        const opts = ms.filter((m) => m.from === sel && m.path[0] === sq);
        if (opts.length) return step(opts, sq);
      }
    }
    function step(opts, sq) {
      const from = partial ? partial.at : sel;
      const k = partial ? partial.k : 0;
      slide(from, sq);
      if (opts[0].caps.length) { fade(opts[0].caps[k]); ctx.sfx.capture(); } else ctx.sfx.move();
      const done = opts.find((m) => m.path.length === k + 1);
      if (done && opts.every((m) => m.path.length === k + 1)) return finish(done);
      partial = { from: partial ? partial.from : sel, at: sq, k: k + 1, steps: [...(partial ? partial.steps : []), sq] };
      sel = sq; ctx.hint(MSG.more); marks();
    }
    function finish(m) {
      const before = b; b = apply(b, m); partial = null; sel = null; busy = true; marks();
      quiet = m.caps.length ? 0 : quiet + 1;
      later(() => vanish(() => { draw(); crown(before, m); lastMarks(m); if (!checkEnd(-1)) { turn = -1; computer(); } }), 300);
    }
    function lastMarks(m) { sqEls[m.from].classList.add('from'); sqEls[m.path.at(-1)].classList.add('to'); }
    function checkEnd(next) {
      if (!moves(b, next).length) { busy = true; ctx.hint(''); ctx.over(next === -1 ? { result: 'win', text: MSG.winText } : { result: 'lose', text: MSG.loseText }); return true; }
      if (quiet >= 60) { busy = true; ctx.hint(''); ctx.over({ result: 'draw', text: MSG.drawText }); return true; }
      return false;
    }
    function computer() {
      busy = true; ctx.hint(MSG.think);
      later(() => {
        const m = bestMove(b, -1, ctx.level);
        let i = 0, at = m.from;
        const hop = () => {
          if (i < m.path.length) {
            slide(at, m.path[i]); if (m.caps[i] != null) { fade(m.caps[i]); ctx.sfx.capture(); } else ctx.sfx.move();
            at = m.path[i]; i++; later(hop, 330);
          } else {
            const before = b; b = apply(b, m); quiet = m.caps.length ? 0 : quiet + 1;
            vanish(() => {
              draw(); crown(before, m); turn = 1; busy = false;
              if (!checkEnd(1)) { const ms = moves(b, 1); ctx.hint(ms[0] && ms[0].caps.length ? MSG.must : MSG.you); marks(); lastMarks(m); }
            });
          }
        };
        hop();
      }, moves(b, -1).length <= 1 ? 250 : 450 + Math.random() * 400);
    }
    draw(); marks(); ctx.hint(MSG.you);
    window.__ckdbg = () => ({ turn, busy, sel, partial, quiet, b: b.join(',') });
    return () => { alive = false; timers.forEach(clearTimeout); };
  },
};

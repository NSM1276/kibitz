import { Chess } from '../../vendor/chess.js';
import tasks from '../../data/chess.js';
import { playChess } from './chessplay.js';

const FILES = 'abcdefgh';
const norm = (s) => s.replace(/[+#]/g, '');
const MSG = {
  watch: { en: 'Watch the opening…', de: 'Schau dir die Eröffnung an…' },
  play: { en: 'Tap a piece, then a square.', de: 'Tippe eine Figur, dann ein Feld.' },
  again: { en: 'Not that one. Look for checks and captures.', de: 'Nicht dieser. Suche nach Schachs und Schlagzügen.' },
  again2: { en: 'Not that one. Hint: the glowing piece moves.', de: 'Nicht dieser. Tipp: Die leuchtende Figur zieht.' },
  good: { en: 'Good! Keep going…', de: 'Gut! Weiter so…' },
  wrongText: { en: 'Two misses. Watch the solution, then try the next one.', de: 'Zwei Fehlversuche. Schau dir die Lösung an.' },
};

export default {
  id: 'chess', icon: '♞', color: '#7fb3ff',
  title: { en: 'Chess Traps', de: 'Schachfallen' },
  tagline: { en: 'Famous traps that win in under 10 moves', de: 'Berühmte Fallen, die in unter 10 Zügen gewinnen' },
  tasks,
  play: playChess,
  playTitle: { en: 'Chess vs computer', de: 'Schach gegen Computer' },
  mount(stage, task, ctx) {
    const game = new Chess();
    const flip = task.user === 'b';
    const board = document.createElement('div'); board.className = 'board';
    stage.append(board);
    const sqEls = {}, pieceEls = new Map();
    let sel = null, busy = true, step = 0, misses = 0, alive = true, lastMove = null, hintSq = null;
    const timers = [];
    const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };

    const xy = (sq) => {
      let f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
      if (flip) f = 7 - f; else r = 7 - r;
      return [f * 12.5, (flip ? r : r) * 12.5];
    };
    // squares
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = FILES[f] + (r + 1); const [x, y] = xy(sq);
      const el = document.createElement('div');
      el.className = 'sq ' + ((f + r) % 2 ? 'l' : 'd');
      el.style.left = x + '%'; el.style.top = y + '%';
      el.addEventListener('click', () => onSquare(sq));
      board.append(el); sqEls[sq] = el;
    }
    // coordinates
    for (let i = 0; i < 8; i++) {
      const fileSq = FILES[i] + (flip ? 8 : 1), [fx] = xy(fileSq);
      const c = document.createElement('div'); c.className = 'coord'; c.textContent = FILES[i];
      c.style.left = `calc(${fx + 12.5}% - 10px)`; c.style.bottom = '2px'; c.style.color = (i + (flip ? 1 : 0)) % 2 ? '#ae8a68' : '#ecd9b9';
      board.append(c);
      const rankSq = (flip ? 'h' : 'a') + (i + 1), [, ry] = xy(rankSq);
      const d = document.createElement('div'); d.className = 'coord'; d.textContent = i + 1;
      d.style.left = '3px'; d.style.top = `calc(${ry}% + 2px)`; d.style.color = i % 2 ? '#ae8a68' : '#ecd9b9';
      board.append(d);
    }
    const arrows = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrows.setAttribute('class', 'arrows'); arrows.setAttribute('viewBox', '0 0 100 100');
    arrows.innerHTML = '<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="#e8c46a"/></marker></defs>';
    board.append(arrows);
    const flash = document.createElement('div'); flash.className = 'flash'; board.append(flash);

    function drawPieces() {
      const seen = new Set();
      for (const row of game.board()) for (const p of row) {
        if (!p) continue;
        const key = p.square; seen.add(key);
        let el = pieceEls.get(key);
        const img = `url(assets/pieces/${p.color}${p.type.toUpperCase()}.svg)`;
        if (!el) { el = document.createElement('div'); el.className = 'pc'; board.append(el); pieceEls.set(key, el); }
        el.style.backgroundImage = img;
        const [x, y] = xy(key); el.style.left = x + '%'; el.style.top = y + '%';
      }
      for (const [k, el] of pieceEls) if (!seen.has(k)) { el.remove(); pieceEls.delete(k); }
    }
    function highlights() {
      for (const el of Object.values(sqEls)) el.classList.remove('from', 'to', 'sel', 'check', 'hintsq');
      if (hintSq) sqEls[hintSq].classList.add('hintsq');
      board.querySelectorAll('.dot').forEach((d) => d.remove());
      if (lastMove) { sqEls[lastMove.from].classList.add('from'); sqEls[lastMove.to].classList.add('to'); }
      if (game.inCheck()) {
        for (const row of game.board()) for (const p of row) if (p && p.type === 'k' && p.color === game.turn()) sqEls[p.square].classList.add('check');
      }
      if (sel) {
        sqEls[sel].classList.add('sel');
        for (const m of game.moves({ square: sel, verbose: true })) {
          const d = document.createElement('div'); d.className = 'dot' + (m.captured ? ' cap' : '');
          const [x, y] = xy(m.to); d.style.left = x + '%'; d.style.top = y + '%'; board.append(d);
        }
      }
    }
    // animate a move: move the piece element from->to so CSS transitions it
    function doMove(m) {
      const res = game.move(m);
      const el = pieceEls.get(res.from);
      const victim = pieceEls.get(res.to);
      if (victim) { victim.style.opacity = '0'; pieceEls.delete(res.to); setTimeout(() => victim.remove(), 250); }
      if (res.flags.includes('e')) { const capSq = res.to[0] + res.from[1]; const v = pieceEls.get(capSq); if (v) { v.remove(); pieceEls.delete(capSq); } }
      if (el) { pieceEls.delete(res.from); pieceEls.set(res.to, el); const [x, y] = xy(res.to); el.style.left = x + '%'; el.style.top = y + '%'; }
      if (res.flags.includes('k') || res.flags.includes('q')) {
        const r = res.from[1], rf = res.flags.includes('k') ? 'h' : 'a', rt = res.flags.includes('k') ? 'f' : 'd';
        const rk = pieceEls.get(rf + r); if (rk) { pieceEls.delete(rf + r); pieceEls.set(rt + r, rk); const [x, y] = xy(rt + r); rk.style.left = x + '%'; rk.style.top = y + '%'; }
      }
      lastMove = res;
      setTimeout(() => alive && drawPieces(), 340); // sync promotions etc.
      res.captured ? ctx.sfx.capture() : ctx.sfx.move();
      highlights();
      return res;
    }
    function arrow(from, to) {
      const [x1, y1] = xy(from), [x2, y2] = xy(to);
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x1 + 6.25); l.setAttribute('y1', y1 + 6.25);
      l.setAttribute('x2', x2 + 6.25); l.setAttribute('y2', y2 + 6.25);
      l.setAttribute('stroke', '#e8c46a'); l.setAttribute('stroke-width', '2.2'); l.setAttribute('stroke-linecap', 'round');
      l.setAttribute('opacity', '.9'); l.setAttribute('marker-end', 'url(#ah)');
      arrows.append(l);
    }
    function boom() { flash.style.transition = 'none'; flash.style.opacity = '.55'; requestAnimationFrame(() => { flash.style.transition = 'opacity .6s'; flash.style.opacity = '0'; }); }

    function onSquare(sq) {
      if (busy || game.turn() !== task.user) return;
      const p = game.get(sq);
      if (sel && sel !== sq) {
        const legal = game.moves({ square: sel, verbose: true }).find((m) => m.to === sq);
        if (legal) { const from = sel; sel = null; return tryMove(from, sq); }
      }
      if (p && p.color === task.user) { sel = sq === sel ? null : sq; ctx.sfx.tap(); highlights(); }
      else { sel = null; highlights(); }
    }

    function tryMove(from, to) {
      const before = game.fen();
      const res = doMove({ from, to, promotion: 'q' });
      const expected = task.line[step];
      const last = step === task.line.length - 1;
      const okFirst = step === 0 && task.accept && task.accept.map(norm).includes(norm(res.san));
      const ok = norm(res.san) === norm(expected) || okFirst || (last && task.mateOk && game.isCheckmate());
      if (!ok) {
        busy = true; misses++;
        ctx.sfx.bad();
        later(() => {
          game.load(before); lastMove = null; drawPieces(); highlights();
          if (misses >= 2) { reveal(); return; }
          try { const tmp = new Chess(before); hintSq = tmp.move(task.accept && step === 0 ? task.accept[0] : task.line[step]).from; } catch { hintSq = null; }
          highlights(); ctx.hint(MSG.again2); busy = false;
        }, 750);
        return;
      }
      hintSq = null;
      arrows.innerHTML = arrows.innerHTML.split('</defs>')[0] + '</defs>';
      arrow(res.from, res.to);
      if (last || okFirst) return win();
      step++;
      ctx.hint(MSG.good); busy = true;
      later(() => { arrows.innerHTML = arrows.innerHTML.split('</defs>')[0] + '</defs>'; doMove(task.line[step]); step++; busy = false; }, 650);
    }

    function win() {
      busy = true; ctx.hint('');
      if (game.isCheckmate()) boom();
      later(() => ctx.result({ ok: true, text: task.explain }), 450);
    }

    function reveal() {
      busy = true; ctx.hint('');
      const g2 = new Chess(); for (const m of task.setup) g2.move(m);
      for (let k = 0; k < step; k++) g2.move(task.line[k]);
      game.load(g2.fen()); drawPieces(); highlights();
      let k = step;
      const playNext = () => {
        if (k >= task.line.length) {
          if (game.isCheckmate()) boom();
          later(() => ctx.result({ ok: false, text: { en: MSG.wrongText.en + ' ' + task.explain.en, de: MSG.wrongText.de + ' ' + task.explain.de } }), 500);
          return;
        }
        arrows.innerHTML = arrows.innerHTML.split('</defs>')[0] + '</defs>';
        const r = doMove(task.line[k]); if (k % 2 === step % 2) arrow(r.from, r.to); k++; later(playNext, 900);
      };
      later(playNext, 500);
    }

    // intro: auto-play the setup moves
    drawPieces(); highlights(); ctx.hint(MSG.watch);
    let i = 0;
    const intro = () => {
      if (i < task.setup.length) { doMove(task.setup[i++]); later(intro, i === task.setup.length ? 500 : 420); }
      else { busy = false; ctx.hint(MSG.play); }
    };
    later(intro, 500);

    return () => { alive = false; timers.forEach(clearTimeout); };
  },
};

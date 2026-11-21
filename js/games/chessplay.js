// Free play vs computer. The trainer tie-in: when the game reaches a position from one of our traps,
// the player gets a nudge ("There is a trap here!").
import { Chess } from '../../vendor/chess.js';
import { bestMove } from './chessai.js';
import traps from '../../data/chess.js';

const FILES = 'abcdefgh';
const MSG = {
  you: { en: 'Your move.', de: 'Du bist am Zug.' },
  undo: { en: 'Undo', de: 'Zurück' }, hintBtn: { en: 'Hint', de: 'Tipp' },
  playBlack: { en: 'Play black', de: 'Mit Schwarz' }, playWhite: { en: 'Play white', de: 'Mit Weiß' },
  think: { en: 'Computer is thinking…', de: 'Der Computer denkt nach…' },
  check: { en: 'Check!', de: 'Schach!' },
  trapHere: (n) => ({ en: `There is a trap here: “${n.en}”. Find it!`, de: `Hier steckt eine Falle: „${n.de}“. Finde sie!` }),
  trapWarn: (n) => ({ en: `Careful: this is the position of “${n.en}”.`, de: `Vorsicht: Das ist die Stellung aus „${n.de}“.` }),
  winText: { en: 'Checkmate! Well played.', de: 'Schachmatt! Gut gespielt.' },
  loseText: { en: 'Checkmate. The computer got you this time.', de: 'Schachmatt. Diesmal hat dich der Computer erwischt.' },
  drawText: { en: 'Draw (stalemate, repetition or not enough material).', de: 'Remis (Patt, Wiederholung oder zu wenig Material).' },
};
// positions (piece placement + side to move) right before a trap's winning move, for the side that sets it
const TRAPS = traps.map((tr) => {
  const g = new Chess(); try { for (const m of tr.setup) g.move(m); } catch { return null; }
  return { fen: g.fen().split(' ').slice(0, 2).join(' '), user: tr.user || 'w', title: tr.title };
}).filter(Boolean);

export function playChess(stage, ctx) {
  const game = new Chess();
  let me = 'w'; try { me = localStorage.getItem('ym:chess:side') === 'b' ? 'b' : 'w'; } catch {}
  const cpu = me === 'w' ? 'b' : 'w';
  const capTop = document.createElement('div'); capTop.className = 'capt';
  const board = document.createElement('div'); board.className = 'board drag-ok';
  const capBot = document.createElement('div'); capBot.className = 'capt';
  stage.append(capTop, board, capBot);
  const sqEls = {}, pieceEls = new Map();
  let sel = null, busy = false, alive = true, lastMove = null, hintMv = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };
  // board seen from my side: black players get the board turned round
  const xy = (sq) => { const f = FILES.indexOf(sq[0]), r = +sq[1]; return me === 'w' ? [f * 12.5, (8 - r) * 12.5] : [(7 - f) * 12.5, (r - 1) * 12.5]; };
  for (let r = 1; r <= 8; r++) for (let f = 0; f < 8; f++) {
    const sq = FILES[f] + r, [x, y] = xy(sq), el = document.createElement('div');
    el.className = 'sq ' + ((f + r) % 2 ? 'l' : 'd'); el.style.left = x + '%'; el.style.top = y + '%';
    el.onclick = () => onSquare(sq); board.append(el); sqEls[sq] = el;
  }
  for (let i = 0; i < 8; i++) {
    const file = me === 'w' ? FILES[i] : FILES[7 - i], rank = me === 'w' ? 8 - i : i + 1;
    const c = document.createElement('div'); c.className = 'coord'; c.textContent = file;
    c.style.left = `calc(${i * 12.5 + 12.5}% - 10px)`; c.style.bottom = '2px'; c.style.color = i % 2 ? '#ae8a68' : '#ecd9b9'; board.append(c);
    const d = document.createElement('div'); d.className = 'coord'; d.textContent = rank;
    d.style.left = '3px'; d.style.top = `calc(${i * 12.5}% + 2px)`; d.style.color = i % 2 ? '#ae8a68' : '#ecd9b9'; board.append(d);
  }
  function drawPieces(fresh = false) {
    if (fresh) { for (const el of pieceEls.values()) el.remove(); pieceEls.clear(); }
    const seen = new Set();
    for (const row of game.board()) for (const p of row) {
      if (!p) continue; seen.add(p.square);
      let el = pieceEls.get(p.square);
      if (!el) { el = document.createElement('div'); el.className = 'pc'; board.append(el); pieceEls.set(p.square, el); }
      el.style.backgroundImage = `url(assets/pieces/${p.color}${p.type.toUpperCase()}.svg)`;
      const [x, y] = xy(p.square); el.style.left = x + '%'; el.style.top = y + '%';
    }
    for (const [k, el] of pieceEls) if (!seen.has(k)) { el.remove(); pieceEls.delete(k); }
  }
  // captured pieces and the material balance, like the big apps show beside the board
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 }, ORDER = 'qrbnp';
  function captures() {
    const took = { w: [], b: [] }; // pieces each side has captured
    for (const m of game.history({ verbose: true })) if (m.captured) took[m.color].push(m.captured);
    const sum = (l) => l.reduce((a, x) => a + VAL[x], 0), diff = sum(took[me]) - sum(took[cpu]);
    const row = (el, side, d) => {
      const opp = side === 'w' ? 'b' : 'w';
      el.innerHTML = took[side].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).map((x) => `<i style="background-image:url(assets/pieces/${opp}${x.toUpperCase()}.svg)"></i>`).join('') + (d > 0 ? `<b>+${d}</b>` : '');
    };
    row(capTop, cpu, -diff); row(capBot, me, diff);
  }
  function highlights() {
    for (const el of Object.values(sqEls)) el.classList.remove('from', 'to', 'sel', 'check', 'hintsq');
    board.querySelectorAll('.dot').forEach((d) => d.remove());
    if (lastMove) { sqEls[lastMove.from].classList.add('from'); sqEls[lastMove.to].classList.add('to'); }
    if (hintMv) { sqEls[hintMv.from].classList.add('hintsq'); sqEls[hintMv.to].classList.add('hintsq'); }
    if (game.inCheck()) for (const row of game.board()) for (const p of row) if (p && p.type === 'k' && p.color === game.turn()) sqEls[p.square].classList.add('check');
    if (sel) {
      sqEls[sel].classList.add('sel');
      for (const m of game.moves({ square: sel, verbose: true })) {
        const d = document.createElement('div'); d.className = 'dot' + (m.captured ? ' cap' : '');
        const [x, y] = xy(m.to); d.style.left = x + '%'; d.style.top = y + '%'; board.append(d);
      }
    }
    if (tools) {
      tools.set('undo', !busy && game.turn() === me && game.history().length >= (me === 'w' ? 2 : 3) && !game.isGameOver());
      tools.set('hint', !busy && game.turn() === me && !game.isGameOver());
    }
  }
  function doMove(m, dropped = false) {
    const res = game.move(m);
    hintMv = null;
    const el = pieceEls.get(res.from), victim = pieceEls.get(res.to);
    if (victim) { victim.style.opacity = '0'; pieceEls.delete(res.to); setTimeout(() => victim.remove(), 250); }
    if (res.flags.includes('e')) { const cs = res.to[0] + res.from[1], v = pieceEls.get(cs); if (v) { v.remove(); pieceEls.delete(cs); } }
    if (el) {
      pieceEls.delete(res.from); pieceEls.set(res.to, el); const [x, y] = xy(res.to);
      if (dropped) { el.style.transition = 'none'; el.style.transform = ''; el.classList.remove('drag'); }
      el.style.left = x + '%'; el.style.top = y + '%';
      if (dropped) { void el.offsetWidth; el.style.transition = ''; }
    }
    if (res.flags.includes('k') || res.flags.includes('q')) {
      const r = res.from[1], rf = res.flags.includes('k') ? 'h' : 'a', rt = res.flags.includes('k') ? 'f' : 'd', rk = pieceEls.get(rf + r);
      if (rk) { pieceEls.delete(rf + r); pieceEls.set(rt + r, rk); const [x, y] = xy(rt + r); rk.style.left = x + '%'; rk.style.top = y + '%'; }
    }
    lastMove = res;
    setTimeout(() => alive && drawPieces(), 340);
    if (game.inCheck() && !game.isCheckmate()) { res.captured ? ctx.sfx.capture() : ctx.sfx.move(); setTimeout(() => alive && ctx.sfx.check(), 90); }
    else if (res.promotion) { ctx.sfx.move(); setTimeout(() => alive && ctx.sfx.ok(), 120); }
    else res.captured ? ctx.sfx.capture() : ctx.sfx.move();
    captures(); highlights();
    return res;
  }
  // my move: a pawn reaching the last rank asks which piece it becomes (queen first, like every big app)
  function myMove(from, to, dropped) {
    const legal = game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (!legal.length) return false;
    sel = null;
    if (legal.some((m) => m.promotion)) {
      const el = pieceEls.get(from);
      if (dropped && el) { el.style.transition = 'none'; el.style.transform = ''; el.classList.remove('drag'); }
      pickPromotion(to, (pc) => { doMove({ from, to, promotion: pc }); after(); });
      return true;
    }
    doMove({ from, to }, dropped); after();
    return true;
  }
  function pickPromotion(to, done) {
    busy = true; highlights();
    const box = document.createElement('div'); box.className = 'promo';
    const [x] = xy(to);
    const col = document.createElement('div'); col.className = 'promocol'; col.style.left = x + '%';
    for (const pc of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button'); b.style.backgroundImage = `url(assets/pieces/${me}${pc.toUpperCase()}.svg)`;
      b.onclick = (e) => { e.stopPropagation(); box.remove(); busy = false; ctx.sfx.tap(); done(pc); };
      col.append(b);
    }
    box.append(col); box.onclick = () => { box.remove(); busy = false; highlights(); };
    board.append(box);
  }
  function onSquare(sq) {
    if (busy || game.turn() !== me || justDragged) return;
    const p = game.get(sq);
    if (sel && sel !== sq && myMove(sel, sq, false)) return;
    if (p && p.color === me) { sel = sq === sel ? null : sq; ctx.sfx.tap(); } else sel = null;
    highlights();
  }
  function trapNote() {
    const key = game.fen().split(' ').slice(0, 2).join(' ');
    const tr = TRAPS.find((x) => x.fen === key);
    if (!tr) return null;
    return tr.user === me ? MSG.trapHere(tr.title) : MSG.trapWarn(tr.title);
  }
  function over() {
    if (!game.isGameOver()) return false;
    busy = true; ctx.hint(''); highlights();
    if (game.isCheckmate()) ctx.over(game.turn() === cpu ? { result: 'win', text: MSG.winText } : { result: 'lose', text: MSG.loseText });
    else ctx.over({ result: 'draw', text: MSG.drawText });
    return true;
  }
  function cpuMove() {
    busy = true; ctx.hint(MSG.think); highlights();
    // a human-like pause: quick when there is only one reply, longer otherwise
    const n = game.moves().length, wait = n <= 1 ? 250 : 450 + Math.random() * 450;
    later(() => {
      const m = bestMove(game, ctx.level);
      doMove(m);
      later(() => {
        if (over()) return;
        busy = false; highlights();
        const note = trapNote();
        if (note) { ctx.hint(note); ctx.toast(ctx.t(note), 3200); } else ctx.hint(game.inCheck() ? MSG.check : MSG.you);
      }, 360);
    }, wait);
  }
  function after() { if (!over()) cpuMove(); }

  // ----- tools: take back, hint, play the other colour -----
  let tools = null;
  tools = ctx.tools([
    { id: 'undo', icon: '↶', label: MSG.undo, fn: () => {
      if (busy || game.turn() !== me) return;
      game.undo(); game.undo(); sel = null; hintMv = null;
      const h = game.history({ verbose: true }); lastMove = h[h.length - 1] || null;
      drawPieces(true); captures(); highlights(); ctx.hint(MSG.you);
    } },
    { id: 'hint', icon: '💡', label: MSG.hintBtn, fn: () => {
      if (busy || game.turn() !== me) return;
      busy = true; highlights();
      later(() => {
        const m = bestMove(game, 2), all = game.moves({ verbose: true });
        hintMv = all.find((x) => (typeof m === 'string' ? x.san === m : (x.from === m.from && x.to === m.to))) || null;
        busy = false; highlights();
      }, 30);
    } },
    { id: 'side', icon: '⇅', label: me === 'w' ? MSG.playBlack : MSG.playWhite, fn: () => {
      try { localStorage.setItem('ym:chess:side', me === 'w' ? 'b' : 'w'); } catch {}
      ctx.restart();
    } },
  ]);
  stage.append(tools);

  // ----- drag a piece with the finger or mouse (a tap still selects; drag starts after a few pixels) -----
  let drag = null, justDragged = false;
  const sqAt = (e) => {
    const r = board.getBoundingClientRect(), c = Math.floor(((e.clientX - r.left) / r.width) * 8), w = Math.floor(((e.clientY - r.top) / r.height) * 8);
    if (c < 0 || c > 7 || w < 0 || w > 7) return null;
    return me === 'w' ? FILES[c] + (8 - w) : FILES[7 - c] + (w + 1);
  };
  board.addEventListener('pointerdown', (e) => {
    if (busy || game.turn() !== me || e.button > 0) return;
    const sq = sqAt(e), p = sq && game.get(sq);
    if (!p || p.color !== me) return;
    drag = { sq, x: e.clientX, y: e.clientY, on: false, el: pieceEls.get(sq), id: e.pointerId };
  });
  board.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 4) return;
      drag.on = true; try { board.setPointerCapture(e.pointerId); } catch {}
      sel = drag.sq; highlights(); ctx.sfx.tap();
      drag.el.classList.add('drag');
    }
    e.preventDefault();
    const lift = e.pointerType === 'touch' ? -board.clientWidth / 8 * 0.55 : 0;
    drag.el.style.transform = `translate(${dx}px, ${dy + lift}px) scale(${e.pointerType === 'touch' ? 1.45 : 1.15})`;
    const ov = sqAt({ clientX: e.clientX, clientY: e.clientY + lift });
    board.querySelectorAll('.sq.hover').forEach((x) => x.classList.remove('hover'));
    if (ov) sqEls[ov].classList.add('hover');
  });
  const endDrag = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.on) return; // a plain tap: the square's click handler does the rest
    justDragged = true; setTimeout(() => { justDragged = false; }, 0);
    board.querySelectorAll('.sq.hover').forEach((x) => x.classList.remove('hover'));
    const lift = e.pointerType === 'touch' ? -board.clientWidth / 8 * 0.55 : 0;
    const to = cancel ? null : sqAt({ clientX: e.clientX, clientY: e.clientY + lift });
    if (to && myMove(d.sq, to, true)) return;
    // snap back
    d.el.classList.remove('drag');
    d.el.style.transition = 'transform .15s ease-out'; d.el.style.transform = '';
    setTimeout(() => { d.el.style.transition = ''; }, 170);
    if (to && to !== d.sq) { ctx.sfx.bad(); sel = null; }
    highlights();
  };
  board.addEventListener('pointerup', (e) => endDrag(e, false));
  board.addEventListener('pointercancel', (e) => endDrag(e, true));
  drawPieces(); captures(); highlights();
  if (me === 'b') cpuMove(); else ctx.hint(MSG.you);
  window.__chfen = (f) => { game.load(f); lastMove = null; drawPieces(true); captures(); highlights(); };
  window.__chdbg = () => ({ fen: game.fen(), busy, me, hint: hintMv && hintMv.from + hintMv.to, moves: game.moves({ verbose: true }).map((m) => m.from + m.to) });
  return () => { alive = false; timers.forEach(clearTimeout); };
}

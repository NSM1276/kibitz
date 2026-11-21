// Free play vs computer. The trainer tie-in: when the game reaches a position from one of our traps,
// the player gets a nudge ("There is a trap here!").
import { Chess } from '../../vendor/chess.js';
import { bestMove } from './chessai.js';
import traps from '../../data/chess.js';

const FILES = 'abcdefgh';
const MSG = {
  you: { en: 'Your move (white).', de: 'Du ziehst (Weiß).' },
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
  const board = document.createElement('div'); board.className = 'board';
  stage.append(board);
  const sqEls = {}, pieceEls = new Map();
  let sel = null, busy = false, alive = true, lastMove = null;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => alive && fn(), ms); timers.push(id); };
  const xy = (sq) => [FILES.indexOf(sq[0]) * 12.5, (8 - +sq[1]) * 12.5];
  for (let r = 1; r <= 8; r++) for (let f = 0; f < 8; f++) {
    const sq = FILES[f] + r, [x, y] = xy(sq), el = document.createElement('div');
    el.className = 'sq ' + ((f + r) % 2 ? 'l' : 'd'); el.style.left = x + '%'; el.style.top = y + '%';
    el.onclick = () => onSquare(sq); board.append(el); sqEls[sq] = el;
  }
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('div'); c.className = 'coord'; c.textContent = FILES[i];
    c.style.left = `calc(${i * 12.5 + 12.5}% - 10px)`; c.style.bottom = '2px'; c.style.color = i % 2 ? '#ae8a68' : '#ecd9b9'; board.append(c);
    const d = document.createElement('div'); d.className = 'coord'; d.textContent = 8 - i;
    d.style.left = '3px'; d.style.top = `calc(${i * 12.5}% + 2px)`; d.style.color = i % 2 ? '#ae8a68' : '#ecd9b9'; board.append(d);
  }
  function drawPieces() {
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
  function highlights() {
    for (const el of Object.values(sqEls)) el.classList.remove('from', 'to', 'sel', 'check');
    board.querySelectorAll('.dot').forEach((d) => d.remove());
    if (lastMove) { sqEls[lastMove.from].classList.add('from'); sqEls[lastMove.to].classList.add('to'); }
    if (game.inCheck()) for (const row of game.board()) for (const p of row) if (p && p.type === 'k' && p.color === game.turn()) sqEls[p.square].classList.add('check');
    if (sel) {
      sqEls[sel].classList.add('sel');
      for (const m of game.moves({ square: sel, verbose: true })) {
        const d = document.createElement('div'); d.className = 'dot' + (m.captured ? ' cap' : '');
        const [x, y] = xy(m.to); d.style.left = x + '%'; d.style.top = y + '%'; board.append(d);
      }
    }
  }
  function doMove(m) {
    const res = game.move(m);
    const el = pieceEls.get(res.from), victim = pieceEls.get(res.to);
    if (victim) { victim.style.opacity = '0'; pieceEls.delete(res.to); setTimeout(() => victim.remove(), 250); }
    if (res.flags.includes('e')) { const cs = res.to[0] + res.from[1], v = pieceEls.get(cs); if (v) { v.remove(); pieceEls.delete(cs); } }
    if (el) { pieceEls.delete(res.from); pieceEls.set(res.to, el); const [x, y] = xy(res.to); el.style.left = x + '%'; el.style.top = y + '%'; }
    if (res.flags.includes('k') || res.flags.includes('q')) {
      const r = res.from[1], rf = res.flags.includes('k') ? 'h' : 'a', rt = res.flags.includes('k') ? 'f' : 'd', rk = pieceEls.get(rf + r);
      if (rk) { pieceEls.delete(rf + r); pieceEls.set(rt + r, rk); const [x, y] = xy(rt + r); rk.style.left = x + '%'; rk.style.top = y + '%'; }
    }
    lastMove = res;
    setTimeout(() => alive && drawPieces(), 340);
    res.captured ? ctx.sfx.capture() : ctx.sfx.move();
    highlights();
    return res;
  }
  function onSquare(sq) {
    if (busy || game.turn() !== 'w') return;
    const p = game.get(sq);
    if (sel && sel !== sq) {
      const legal = game.moves({ square: sel, verbose: true }).find((m) => m.to === sq);
      if (legal) { const from = sel; sel = null; doMove({ from, to: sq, promotion: 'q' }); return after(); }
    }
    if (p && p.color === 'w') { sel = sq === sel ? null : sq; ctx.sfx.tap(); } else sel = null;
    highlights();
  }
  function trapNote() {
    const key = game.fen().split(' ').slice(0, 2).join(' ');
    const tr = TRAPS.find((x) => x.fen === key);
    if (!tr) return null;
    return tr.user === 'w' ? MSG.trapHere(tr.title) : MSG.trapWarn(tr.title);
  }
  function over() {
    if (!game.isGameOver()) return false;
    busy = true; ctx.hint('');
    if (game.isCheckmate()) ctx.over(game.turn() === 'b' ? { result: 'win', text: MSG.winText } : { result: 'lose', text: MSG.loseText });
    else ctx.over({ result: 'draw', text: MSG.drawText });
    return true;
  }
  function after() {
    if (over()) return;
    busy = true; ctx.hint(MSG.think);
    later(() => {
      const m = bestMove(game, ctx.level);
      doMove(m);
      later(() => {
        if (over()) return;
        busy = false;
        const note = trapNote();
        if (note) { ctx.hint(note); ctx.toast(ctx.t(note), 3200); } else ctx.hint(game.inCheck() ? MSG.check : MSG.you);
      }, 360);
    }, 250);
  }
  drawPieces(); highlights(); ctx.hint(MSG.you);
  window.__chdbg = () => ({ fen: game.fen(), busy, moves: game.moves({ verbose: true }).map((m) => m.from + m.to) });
  return () => { alive = false; timers.forEach(clearTimeout); };
}

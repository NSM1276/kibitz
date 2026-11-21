// Small alpha-beta chess player on top of chess.js. Good enough for casual play, not an engine.
const V = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// piece-square tables from white's view, a8..h8 first row (index 0 = a8)
const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};
function evaluate(g) {
  let s = 0;
  const b = g.board();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]; if (!p) continue;
    const idx = p.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
    const v = V[p.type] + PST[p.type][idx];
    s += p.color === 'w' ? v : -v;
  }
  return g.turn() === 'w' ? s : -s;
}
const order = (ms) => ms.sort((a, b) => (b.captured ? V[b.captured] * 10 - V[a.piece] : 0) - (a.captured ? V[a.captured] * 10 - V[b.piece] : 0) || (b.promotion ? 1 : 0) - (a.promotion ? 1 : 0));

function quiesce(g, alpha, beta, st, d) {
  st.n++;
  const stand = evaluate(g);
  if (stand >= beta || d > 4 || st.n > st.max) return stand;
  if (stand > alpha) alpha = stand;
  const caps = order(g.moves({ verbose: true }).filter((m) => m.captured));
  for (const m of caps) {
    g.move(m); const v = -quiesce(g, -beta, -alpha, st, d + 1); g.undo();
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function search(g, depth, alpha, beta, st, ply) {
  st.n++;
  if (g.isCheckmate()) return -99999 + ply;
  if (g.isDraw()) return 0;
  if (depth <= 0) return quiesce(g, alpha, beta, st, 0);
  let best = -Infinity;
  for (const m of order(g.moves({ verbose: true }))) {
    g.move(m); const v = -search(g, depth - 1, -beta, -alpha, st, ply + 1); g.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta || st.n > st.max) break;
  }
  return best;
}
// level 0 easy, 1 medium, 2 hard. Returns a verbose move.
export function bestMove(g, level = 1) {
  const ms = order(g.moves({ verbose: true }));
  if (!ms.length) return null;
  const depth = [1, 2, 3][level] ?? 2;
  const st = { n: 0, max: [4e3, 4e4, 2.5e5][level] };
  const scored = ms.map((m) => { g.move(m); const v = -search(g, depth - 1, -Infinity, Infinity, st, 1); g.undo(); return { m, v }; });
  scored.sort((a, b) => b.v - a.v);
  if (level === 0) {
    // a beginner: often plays a random reasonable move and misses tactics
    if (Math.random() < 0.4) return scored[Math.floor(Math.random() * Math.min(scored.length, 8))].m;
  }
  const slack = [60, 15, 0][level];
  const top = scored.filter((x) => x.v >= scored[0].v - slack);
  return top[Math.floor(Math.random() * top.length)].m;
}

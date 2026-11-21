// Russian draughts (шашки) on 8x8. Board: array of 64, index r*8+c, r=0 is the top.
// 1 white man, 2 white king, -1 black man, -2 black king. White starts at the bottom and moves up.
// Rules: capture is mandatory (any capture sequence, not necessarily the longest), men capture backwards too,
// kings fly, a man reaching the last row during a capture becomes a king and keeps capturing as a king,
// captured pieces are removed only after the move (no jumping the same piece twice).
export const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const on = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function start() {
  const b = Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) {
    if (r < 3) b[r * 8 + c] = -1; else if (r > 4) b[r * 8 + c] = 1;
  }
  return b;
}
const lastRow = (side) => (side === 1 ? 0 : 7);

function captures(b, side, from) {
  const out = [];
  const startPiece = b[from];
  const rec = (sq, king, path, caps) => {
    const r = sq >> 3, c = sq & 7;
    const found = [];
    for (const [dr, dc] of DIRS) {
      if (!king) {
        const r1 = r + dr, c1 = c + dc, r2 = r + 2 * dr, c2 = c + 2 * dc;
        if (!on(r2, c2)) continue;
        const m = r1 * 8 + c1, l = r2 * 8 + c2;
        if (b[m] * side < 0 && !caps.includes(m) && b[l] === 0) found.push({ land: [l], cap: m });
      } else {
        let r1 = r + dr, c1 = c + dc;
        while (on(r1, c1) && b[r1 * 8 + c1] === 0) { r1 += dr; c1 += dc; }
        if (!on(r1, c1)) continue;
        const m = r1 * 8 + c1;
        if (b[m] * side >= 0 || caps.includes(m)) continue;
        const lands = [];
        let r2 = r1 + dr, c2 = c1 + dc;
        while (on(r2, c2) && b[r2 * 8 + c2] === 0) { lands.push(r2 * 8 + c2); r2 += dr; c2 += dc; }
        if (lands.length) found.push({ land: lands, cap: m });
      }
    }
    if (!found.length) { if (caps.length) out.push({ from, path: path.slice(), caps: caps.slice(), promote: king && Math.abs(startPiece) === 1 }); return; }
    for (const f of found) {
      // a flying king must land where it can keep capturing, if such a square exists
      const opts = f.land.map((l) => ({ l, k: king || (l >> 3) === lastRow(side) }));
      let use = opts;
      if (king && opts.length > 1) {
        const cont = opts.filter((o) => canContinue(b, side, o.l, true, [...caps, f.cap]));
        if (cont.length) use = cont;
      }
      for (const o of use) rec(o.l, o.k, [...path, o.l], [...caps, f.cap]);
    }
  };
  const saved = b[from]; b[from] = 0; // the moving piece leaves its square
  rec(from, Math.abs(saved) === 2, [], []);
  b[from] = saved;
  return out;
}
function canContinue(b, side, sq, king, caps) {
  const r = sq >> 3, c = sq & 7;
  for (const [dr, dc] of DIRS) {
    let r1 = r + dr, c1 = c + dc;
    if (king) while (on(r1, c1) && b[r1 * 8 + c1] === 0) { r1 += dr; c1 += dc; }
    if (!on(r1, c1)) continue;
    const m = r1 * 8 + c1;
    if (b[m] * side >= 0 || caps.includes(m)) continue;
    const r2 = r1 + dr, c2 = c1 + dc;
    if (on(r2, c2) && b[r2 * 8 + c2] === 0) return true;
  }
  return false;
}

export function moves(b, side) {
  const caps = [], quiet = [];
  for (let sq = 0; sq < 64; sq++) {
    if (b[sq] * side <= 0) continue;
    caps.push(...captures(b, side, sq));
  }
  if (caps.length) return caps;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]; if (p * side <= 0) continue;
    const r = sq >> 3, c = sq & 7, king = Math.abs(p) === 2;
    for (const [dr, dc] of DIRS) {
      if (!king) {
        if (dr !== -side) continue; // men move forward only
        const r1 = r + dr, c1 = c + dc;
        if (on(r1, c1) && b[r1 * 8 + c1] === 0) quiet.push({ from: sq, path: [r1 * 8 + c1], caps: [], promote: r1 === lastRow(side) });
      } else {
        let r1 = r + dr, c1 = c + dc;
        while (on(r1, c1) && b[r1 * 8 + c1] === 0) { quiet.push({ from: sq, path: [r1 * 8 + c1], caps: [], promote: false }); r1 += dr; c1 += dc; }
      }
    }
  }
  return quiet;
}

export function apply(b, m) {
  const n = b.slice(), p = n[m.from];
  n[m.from] = 0;
  for (const c of m.caps) n[c] = 0;
  n[m.path[m.path.length - 1]] = m.promote ? Math.sign(p) * 2 : p;
  return n;
}

// ---------- computer player ----------
function evaluate(b, side) {
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq]; if (!p) continue;
    const r = sq >> 3, c = sq & 7;
    let v = Math.abs(p) === 2 ? 330 : 100;
    if (Math.abs(p) === 1) v += 4 * (p > 0 ? 7 - r : r);            // advance
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 6;                  // centre
    if (Math.abs(p) === 1 && (p > 0 ? r === 7 : r === 0)) v += 5;    // back rank guard
    s += Math.sign(p) * v;
  }
  return s * side;
}
function search(b, side, depth, alpha, beta, stats) {
  stats.n++;
  const ms = moves(b, side);
  if (!ms.length) return -100000 - depth;
  if (depth <= 0 && !ms[0].caps.length) return evaluate(b, side);
  if (depth <= -6) return evaluate(b, side); // cap capture extensions
  ms.sort((x, y) => y.caps.length - x.caps.length);
  let best = -Infinity;
  for (const m of ms) {
    const v = -search(apply(b, m), -side, depth - 1, -beta, -alpha, stats);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta || stats.n > stats.max) break;
  }
  return best;
}
// level 0 easy, 1 medium, 2 hard
export function bestMove(b, side, level = 1) {
  const ms = moves(b, side);
  if (ms.length <= 1) return ms[0] || null;
  const depth = [1, 4, 8][level] ?? 4;
  const stats = { n: 0, max: [3e3, 6e4, 4e5][level] };
  const scored = ms.map((m) => ({ m, v: -search(apply(b, m), -side, depth - 1, -Infinity, Infinity, stats) }));
  scored.sort((x, y) => y.v - x.v);
  if (level === 0 && Math.random() < 0.45) return scored[Math.floor(Math.random() * scored.length)].m;
  const top = scored.filter((x) => x.v >= scored[0].v - (level === 2 ? 0 : 8));
  return top[Math.floor(Math.random() * top.length)].m;
}

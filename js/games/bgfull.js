// Full backgammon rules (no doubling cube) for play vs computer.
// State from the point of view of the side to move ("me"): b[1..24], positive = my checkers, negative = opponent.
// I move 24 -> 1 and bear off to 0. bar = [mine, opp], off = [mine, opp]. 25 = "from bar", 0 = "off".
export function start() {
  const b = Array(26).fill(0);
  b[24] = 2; b[13] = 5; b[8] = 3; b[6] = 5;
  b[1] = -2; b[12] = -5; b[17] = -3; b[19] = -5;
  return { b, bar: [0, 0], off: [0, 0] };
}
export const clone = (s) => ({ b: s.b.slice(), bar: s.bar.slice(), off: s.off.slice() });
// the same position seen from the other side
export function flip(s) {
  const b = Array(26).fill(0);
  for (let p = 1; p <= 24; p++) b[p] = -s.b[25 - p];
  return { b, bar: [s.bar[1], s.bar[0]], off: [s.off[1], s.off[0]] };
}
const allHome = (s) => s.bar[0] === 0 && s.b.slice(7, 25).every((v) => v <= 0);

// single steps with one die
export function steps(s, d) {
  const out = [];
  if (s.bar[0] > 0) { const to = 25 - d; if (s.b[to] >= -1) out.push([25, to]); return out; }
  const home = allHome(s);
  for (let p = 24; p >= 1; p--) {
    if (s.b[p] <= 0) continue;
    const to = p - d;
    if (to >= 1) { if (s.b[to] >= -1) out.push([p, to]); }
    else if (home) {
      if (to === 0) out.push([p, 0]);
      else { let higher = false; for (let q = p + 1; q <= 6; q++) if (s.b[q] > 0) higher = true; if (!higher) out.push([p, 0]); }
    }
  }
  return out;
}
export function step(s, [from, to]) {
  const n = clone(s);
  if (from === 25) n.bar[0]--; else n.b[from]--;
  if (to === 0) n.off[0]++;
  else { if (n.b[to] === -1) { n.b[to] = 0; n.bar[1]++; } n.b[to]++; }
  return n;
}
const keyOf = (s) => s.b.join(',') + '|' + s.bar.join(',') + '|' + s.off.join(',');

// all legal full plays: {steps:[[from,to],...], state}. Uses as many dice as possible; if only one die can be
// played, the higher one must be used when possible.
export function plays(s, dice) {
  const ds = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice.slice();
  const res = new Map();
  let maxUsed = 0;
  const rec = (st, left, path) => {
    let moved = false;
    for (const d of new Set(left)) {
      for (const mv of steps(st, d)) {
        moved = true;
        const i = left.indexOf(d), nl = left.slice(0, i).concat(left.slice(i + 1));
        rec(step(st, mv), nl, [...path, { mv, d }]);
      }
    }
    if (!moved) {
      const used = path.length;
      if (used > maxUsed) { maxUsed = used; res.clear(); }
      if (used === maxUsed) { const k = keyOf(st); if (!res.has(k)) res.set(k, { steps: path.map((x) => x.mv), dice: path.map((x) => x.d), state: st }); }
    }
  };
  rec(s, ds, []);
  let list = [...res.values()];
  if (maxUsed === 1 && ds.length === 2 && ds[0] !== ds[1]) {
    const hi = Math.max(...ds);
    if (list.some((p) => p.dice[0] === hi)) list = list.filter((p) => p.dice[0] === hi);
  }
  return list;
}
export const pips = (s) => { let m = s.bar[0] * 25, o = s.bar[1] * 25; for (let p = 1; p <= 24; p++) { if (s.b[p] > 0) m += s.b[p] * p; else if (s.b[p] < 0) o += -s.b[p] * (25 - p); } return [m, o]; };
export const winner = (s) => (s.off[0] === 15 ? 1 : s.off[1] === 15 ? -1 : 0);

// ---------- computer ----------
function evaluate(s) {
  const [mp, op] = pips(s);
  let v = (op - mp) * 1.0;
  const contact = (() => { let myBack = 0, oppBack = 25; for (let p = 1; p <= 24; p++) { if (s.b[p] > 0) myBack = Math.max(myBack, p); if (s.b[p] < 0) oppBack = Math.min(oppBack, p); } return s.bar[0] || s.bar[1] || myBack > oppBack; })();
  if (!contact) return v * 2 + s.off[0] * 6 - s.off[1] * 6;
  // made points, especially in the home board and the bar point; primes
  let run = 0;
  for (let p = 1; p <= 24; p++) {
    if (s.b[p] >= 2) { v += p <= 6 ? 7 : p === 7 ? 6 : p <= 11 ? 3 : 1; run++; if (run >= 3) v += run * 2; } else run = 0;
  }
  // blots: count opponent checkers that can hit them (direct shots within 6, indirect within 12)
  for (let p = 1; p <= 24; p++) {
    if (s.b[p] !== 1) continue;
    let shots = 0;
    for (let q = 1; q < p; q++) if (s.b[q] < 0) { const dist = p - q; if (dist <= 6) shots += 3 * -s.b[q]; else if (dist <= 12) shots += 1; }
    if (s.bar[1] && p <= 6) shots += 3;
    if (shots) v -= (4 + Math.min(shots, 9)) * (0.4 + p / 24);
  }
  v += s.bar[1] * 14 - s.bar[0] * 14;
  v += s.off[0] * 3 - s.off[1] * 3;
  return v;
}
export function bestPlay(s, dice, level = 1) {
  const ps = plays(s, dice);
  if (!ps.length) return null;
  const scored = ps.map((p) => ({ p, v: evaluate(p.state) + (level === 0 ? Math.random() * 30 : level === 1 ? Math.random() * 3 : 0) }));
  scored.sort((a, b) => b.v - a.v);
  return scored[0].p;
}
// every legal ordering of steps (no de-duplication), for step-by-step input checking
export function sequences(s, dice) {
  const ds = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice.slice();
  const out = []; let maxUsed = 0;
  const rec = (st, left, path) => {
    let moved = false;
    for (const d of new Set(left)) for (const mv of steps(st, d)) {
      moved = true; const i = left.indexOf(d);
      rec(step(st, mv), left.slice(0, i).concat(left.slice(i + 1)), [...path, { mv, d }]);
    }
    if (!moved) { if (path.length > maxUsed) { maxUsed = path.length; out.length = 0; } if (path.length === maxUsed) out.push(path); }
  };
  rec(s, ds, []);
  if (maxUsed === 1 && ds.length === 2 && ds[0] !== ds[1]) {
    const hi = Math.max(...ds);
    if (out.some((p) => p[0].d === hi)) return out.filter((p) => p[0].d === hi);
  }
  return out;
}

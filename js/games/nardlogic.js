// Long nardy (Russian / Eastern "длинные нарды", German "Lange Narde").
// State from the side to move ("me"): b[1..24], positive = mine, negative = opponent. I move 24 -> 1, bear off to 0.
// Both sides travel the same way round the board; the opponent's 24 (its head) is my 12.
// Rules: all 15 start on the head; a single checker blocks a point (no hitting); only one checker may leave the
// head per turn (on the first turn 6-6, 4-4 or 3-3 may take two); no wall of 6 points in a row unless at least one
// opponent checker is already past it; use both dice if possible, otherwise the higher one; bear off when all are home.
export function start() {
  const b = Array(26).fill(0);
  b[24] = 15; b[12] = -15;
  return { b, bar: [0, 0], off: [0, 0] };
}
export const clone = (s) => ({ b: s.b.slice(), bar: s.bar.slice(), off: s.off.slice() });
// my point p seen by the opponent, and back
export const other = (p) => ((p + 11) % 24) + 1;
export function flip(s) {
  const b = Array(26).fill(0);
  for (let p = 1; p <= 24; p++) b[p] = -s.b[other(p)];
  return { b, bar: [0, 0], off: [s.off[1], s.off[0]] };
}
const allHome = (s) => s.b.slice(7, 25).every((v) => v <= 0);
const HEAD = 24;
export const headLimit = (dice, first) => (first && dice[0] === dice[1] && [6, 4, 3].includes(dice[0]) ? 2 : 1);

// a wall of 6+ of my points in a row (round the circle) with no opponent checker already past it
export function badWall(s) {
  const occ = (p) => s.b[((p - 1 + 48) % 24) + 1] > 0;
  for (let p = 1; p <= 24; p++) {
    if (!occ(p) || occ(p + 1)) continue; // p = the end of a run seen in my direction (highest number of the run)
    let len = 0; while (len < 24 && occ(p - len)) len++;
    if (len < 6) continue;
    // run covers my points p, p-1, ..., p-len+1 (wrapping). Opponent numbering: other(x). Opponent moves downward.
    let lowOpp = 99;
    for (let k = 0; k < len; k++) lowOpp = Math.min(lowOpp, other(((p - k - 1 + 48) % 24) + 1));
    let past = false;
    for (let q = 1; q <= 24; q++) if (s.b[q] < 0 && other(q) < lowOpp) past = true;
    if (!past) return true;
  }
  return false;
}

// single steps with one die; headLeft = how many more checkers may leave the head this turn
export function steps(s, d, headLeft = 1) {
  const out = [];
  const home = allHome(s);
  for (let p = 24; p >= 1; p--) {
    if (s.b[p] <= 0) continue;
    if (p === HEAD && headLeft <= 0) continue;
    const to = p - d;
    let mv = null;
    if (to >= 1) { if (s.b[to] >= 0) mv = [p, to]; }
    else if (home) {
      if (to === 0) mv = [p, 0];
      else { let higher = false; for (let q = p + 1; q <= 6; q++) if (s.b[q] > 0) higher = true; if (!higher) mv = [p, 0]; }
    }
    if (mv && !(mv[1] !== 0 && badWall(step(s, mv)))) out.push(mv);
  }
  return out;
}
export function step(s, [from, to]) {
  const n = clone(s);
  n.b[from]--;
  if (to === 0) n.off[0]++; else n.b[to]++;
  return n;
}
const keyOf = (s) => s.b.join(',') + '|' + s.off.join(',');

function search(s, dice, first, collect) {
  const ds = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice.slice();
  const lim = headLimit(dice, first);
  let maxUsed = 0;
  const rec = (st, left, path, headUsed) => {
    let moved = false;
    for (const d of new Set(left)) for (const mv of steps(st, d, lim - headUsed)) {
      moved = true; const i = left.indexOf(d);
      rec(step(st, mv), left.slice(0, i).concat(left.slice(i + 1)), [...path, { mv, d }], headUsed + (mv[0] === HEAD ? 1 : 0));
    }
    if (!moved) {
      if (path.length > maxUsed) { maxUsed = path.length; collect.reset(); }
      if (path.length === maxUsed) collect.add(path, st);
    }
  };
  rec(s, ds, [], 0);
  return { maxUsed, ds };
}
// all legal full plays: {steps, dice, state}
export function plays(s, dice, first = false) {
  const res = new Map();
  const { maxUsed, ds } = search(s, dice, first, {
    reset: () => res.clear(),
    add: (path, st) => { const k = keyOf(st); if (!res.has(k)) res.set(k, { steps: path.map((x) => x.mv), dice: path.map((x) => x.d), state: st }); },
  });
  let list = [...res.values()];
  if (maxUsed === 1 && ds.length === 2 && ds[0] !== ds[1]) {
    const hi = Math.max(...ds);
    if (list.some((p) => p.dice[0] === hi)) list = list.filter((p) => p.dice[0] === hi);
  }
  return list;
}
// every legal ordering of steps, for checking the player's input step by step
export function sequences(s, dice, first = false) {
  const out = [];
  const { maxUsed, ds } = search(s, dice, first, { reset: () => { out.length = 0; }, add: (path) => out.push(path) });
  if (maxUsed === 1 && ds.length === 2 && ds[0] !== ds[1]) {
    const hi = Math.max(...ds);
    if (out.some((p) => p[0].d === hi)) return out.filter((p) => p[0].d === hi);
  }
  return out;
}
export const pips = (s) => { let m = 0, o = 0; for (let p = 1; p <= 24; p++) { if (s.b[p] > 0) m += s.b[p] * p; else if (s.b[p] < 0) o += -s.b[p] * other(p); } return [m, o]; };
export const winner = (s) => (s.off[0] === 15 ? 1 : s.off[1] === 15 ? -1 : 0);

// ---------- computer ----------
// one side's shape: how much of the opponent's road it blocks, how well it is spread, how stuck it is
function shape(s) {
  let v = 0;
  // opponent's rearmost checker (in its own numbering): points it still has to pass
  let oppBack = 0;
  for (let q = 1; q <= 24; q++) if (s.b[q] < 0) oppBack = Math.max(oppBack, other(q));
  let run = 0;
  for (let k = 0; k < 24; k++) {
    // walk my points in the opponent's travel order (opponent 24 -> 1)
    const oppNum = 24 - k, p = other(oppNum);
    const mine = s.b[p] > 0, useful = oppNum < oppBack;
    if (mine && useful) { run++; v += 2.2 + (run >= 2 ? run * 1.6 : 0) + (run >= 4 ? 4 : 0); } else run = 0;
  }
  for (let p = 1; p <= 23; p++) if (s.b[p] > 4) v -= (s.b[p] - 4) * 1.2; // tall stacks waste checkers
  if (s.b[24] > 0) v -= Math.max(0, s.b[24] - 10) * 0.6; // leave the head steadily
  return v;
}
function evaluate(s) {
  const [mp, op] = pips(s);
  let v = (op - mp) * 1.0 + (s.off[0] - s.off[1]) * 5;
  const o = flip(s);
  v += shape(s) - shape(o);
  return v;
}
export function bestPlay(s, dice, level = 1, first = false) {
  const ps = plays(s, dice, first);
  if (!ps.length) return null;
  const scored = ps.map((p) => ({ p, v: evaluate(p.state) + (level === 0 ? Math.random() * 30 : level === 1 ? Math.random() * 4 : 0) }));
  scored.sort((a, b) => b.v - a.v);
  return scored[0].p;
}

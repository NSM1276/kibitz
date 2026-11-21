// Minimal backgammon rules for opening-position tasks (no hits needed from the start position, but supported).
// me[p], opp[p] = checker counts on point p (1..24, from MY side). opp[0] would be off; bar not needed here.
export function start() {
  const me = Array(25).fill(0), opp = Array(25).fill(0);
  me[24] = 2; me[13] = 5; me[8] = 3; me[6] = 5;
  opp[1] = 2; opp[12] = 5; opp[17] = 3; opp[19] = 5;
  return { me, opp };
}
export const canLand = (pos, to) => to >= 1 && pos.opp[to] < 2;
export function targets(pos, from, dice) {
  if (!pos.me[from]) return [];
  const out = new Map();
  for (const d of new Set(dice)) if (canLand(pos, from - d)) out.set(from - d, d);
  return [...out].map(([to, die]) => ({ to, die }));
}
export function apply(pos, from, to) {
  const me = pos.me.slice(), opp = pos.opp.slice();
  me[from]--; me[to]++;
  let hit = false; if (opp[to] === 1) { opp[to] = 0; hit = true; }
  return { me, opp, hit };
}
export const key = (pos) => pos.me.join(',');
export function playKey(play) {
  let p = start();
  for (const [f, t] of play) p = apply(p, f, t);
  return key(p);
}
// is the play legal with these dice? (each step uses one die; a single [24,13] step may combine both dice)
export function legalPlay(play, dice) {
  let p = start(), left = dice.slice();
  for (const [f, t] of play) {
    const dist = f - t, i = left.indexOf(dist);
    if (i >= 0) { if (!canLand(p, t)) return false; left.splice(i, 1); }
    else if (left.length === 2 && left[0] + left[1] === dist) {
      const mid1 = f - left[0], mid2 = f - left[1];
      if (!(canLand(p, mid1) || canLand(p, mid2)) || !canLand(p, t)) return false; left = [];
    } else return false;
    p = apply(p, f, t);
  }
  return left.length === 0;
}

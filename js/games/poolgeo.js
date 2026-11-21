// Pure pool geometry (shared by the game and the node tests).
export const W = 330, H = 660, R = 10;
export const POCKETS = {
  tl: [6, 6], tr: [W - 6, 6], bl: [6, H - 6], br: [W - 6, H - 6], ml: [-4, H / 2], mr: [W + 4, H / 2],
};
const TOL = { tl: 24, tr: 24, bl: 24, br: 24, ml: 16, mr: 16 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / len(a));
const rot = (a, deg) => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [a[0] * c - a[1] * s, a[0] * s + a[1] * c]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

export function layout(task) {
  const O = task.ob, P = POCKETS[task.pocket];
  const u = unit(sub(P, O));                 // object ball -> pocket
  const G = sub(O, mul(u, 2 * R));           // ghost ball
  const v = rot(u, task.cut);                // cue travel direction
  const C = sub(G, mul(v, task.cueDist));    // cue ball start
  return { O, P, G, C, u, v, angle: Math.atan2(v[1], v[0]) };
}

// where the cue ball ends up when shot at `angle` (radians); returns contact info
export function simulate(task, angle) {
  const { O, C } = layout(task);
  const d = [Math.cos(angle), Math.sin(angle)];
  // ray-circle (radius 2R around O)
  const f = sub(C, O), b = dot(f, d), c = dot(f, f) - 4 * R * R, disc = b * b - c;
  if (disc < 0 || -b - Math.sqrt(disc) < 0) return { hit: false, cueEnd: railPoint(C, d) };
  const t = -b - Math.sqrt(disc);
  const G = add(C, mul(d, t));
  const od = unit(sub(O, G));                // object ball direction
  let best = null;
  for (const [id, P] of Object.entries(POCKETS)) {
    const w = sub(P, O), s = dot(w, od), dist = Math.abs(cross(od, w));
    const tol = id === task.pocket && task.tol ? task.tol : TOL[id];
    if (s > 0 && dist < tol && (!best || s < best.s)) best = { id, s, P };
  }
  // stun shot: cue ball leaves along the tangent line (90° rule)
  let tan = [-od[1], od[0]]; if (dot(tan, d) < 0) tan = mul(tan, -1);
  const cut = Math.acos(Math.min(1, Math.max(-1, dot(d, od))));
  const cueEnd = clampIn(add(G, mul(tan, 40 + 160 * Math.sin(cut))));
  return {
    hit: true, G, od, cutDeg: (cut * 180) / Math.PI,
    pocket: best ? best.id : null, ok: !!best && best.id === task.pocket,
    objEnd: best ? best.P : railPoint(O, od), cueEnd,
  };
}

function clampIn(p) { return [Math.min(W - R, Math.max(R, p[0])), Math.min(H - R, Math.max(R, p[1]))]; }
export function railPoint(p, d) {
  let t = Infinity;
  if (d[0] > 0) t = Math.min(t, (W - R - p[0]) / d[0]); if (d[0] < 0) t = Math.min(t, (R - p[0]) / d[0]);
  if (d[1] > 0) t = Math.min(t, (H - R - p[1]) / d[1]); if (d[1] < 0) t = Math.min(t, (R - p[1]) / d[1]);
  return add(p, mul(d, t));
}

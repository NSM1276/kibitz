// 2D pool physics: rolling friction, elastic ball collisions, cushions with pocket mouths, simple follow/draw spin.
// Fixed time step, deterministic: the same shot always gives the same result (the computer uses it to test shots).
import { W, H, R } from './poolgeo.js';
export { W, H, R };

export const POCKETS = [[0, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W, H]];
const CORNER_CAP = 17, SIDE_CAP = 15, MOUTH_C = 24, MOUTH_S = 16;
const DT = 1 / 240, DECEL = 120, STOP = 5, E_BALL = 0.95, E_RAIL = 0.72, MAXT = 14;

// balls: [{n, x, y}] with n=0 the cue ball. shot: {angle, speed, spin} (spin -1 draw .. +1 follow)
export function simulate(balls, shot, record = false) {
  const B = balls.map((b) => ({ n: b.n, x: b.x, y: b.y, vx: 0, vy: 0, in: false }));
  const cue = B.find((b) => b.n === 0);
  const dir = [Math.cos(shot.angle), Math.sin(shot.angle)];
  cue.vx = dir[0] * shot.speed; cue.vy = dir[1] * shot.speed;
  let spin = shot.spin || 0, firstHit = null, cueTouched = false;
  const potted = [], events = [], frames = [];
  let railAfterHit = false;
  let t = 0, nextFrame = 0;
  const snap = () => frames.push(B.map((b) => (b.in ? null : [b.x, b.y])));
  if (record) snap();
  while (t < MAXT) {
    let moving = false;
    for (const b of B) {
      if (b.in) continue;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < STOP) { b.vx = b.vy = 0; continue; }
      moving = true;
      const k = Math.max(0, sp - DECEL * DT) / sp; b.vx *= k; b.vy *= k;
      b.x += b.vx * DT; b.y += b.vy * DT;
      // pockets
      for (let i = 0; i < 6; i++) {
        const [px, py] = POCKETS[i], cap = i === 2 || i === 3 ? SIDE_CAP : CORNER_CAP;
        if (Math.hypot(b.x - px, b.y - py) < cap) { b.in = true; b.vx = b.vy = 0; potted.push(b.n); events.push({ t, type: 'pot', n: b.n }); break; }
      }
      if (b.in) continue;
      // cushions (skip inside pocket mouths)
      const nearCornerY = b.y < MOUTH_C || b.y > H - MOUTH_C, nearSide = Math.abs(b.y - H / 2) < MOUTH_S, nearCornerX = b.x < MOUTH_C || b.x > W - MOUTH_C;
      if (b.x < R && !(nearCornerY || nearSide)) { b.x = R + (R - b.x); b.vx = -b.vx * E_RAIL; b.vy *= 0.96; rail(b); }
      if (b.x > W - R && !(nearCornerY || nearSide)) { b.x = W - R - (b.x - (W - R)); b.vx = -b.vx * E_RAIL; b.vy *= 0.96; rail(b); }
      if (b.y < R && !nearCornerX) { b.y = R + (R - b.y); b.vy = -b.vy * E_RAIL; b.vx *= 0.96; rail(b); }
      if (b.y > H - R && !nearCornerX) { b.y = H - R - (b.y - (H - R)); b.vy = -b.vy * E_RAIL; b.vx *= 0.96; rail(b); }
      // a ball that slipped through a mouth but missed the capture circle: it drops anyway
      if (b.x < -R || b.x > W + R || b.y < -R || b.y > H + R) { b.in = true; b.vx = b.vy = 0; potted.push(b.n); events.push({ t, type: 'pot', n: b.n }); }
    }
    // collisions
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (a.in) continue;
      for (let j = i + 1; j < B.length; j++) {
        const c = B[j]; if (c.in) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        const ov = (2 * R - d) / 2; a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        if (vn <= 0) continue;
        const jimp = ((1 + E_BALL) / 2) * vn;
        a.vx -= jimp * nx; a.vy -= jimp * ny; c.vx += jimp * nx; c.vy += jimp * ny;
        events.push({ t, type: 'hit', v: vn });
        const isCue = a.n === 0 ? a : c.n === 0 ? c : null;
        if (isCue && !cueTouched) {
          cueTouched = true; firstHit = (isCue === a ? c : a).n;
          // spin: follow keeps the cue ball rolling forward, draw pulls it back
          if (spin) { const add = spin * vn * 0.62; isCue.vx += dir[0] * add; isCue.vy += dir[1] * add; spin = 0; }
        }
      }
    }
    t += DT;
    if (record && t >= nextFrame) { snap(); nextFrame += 1 / 60; }
    if (!moving) break;
  }
  function rail(b) { events.push({ t, type: 'rail', n: b.n, v: Math.hypot(b.vx, b.vy) }); if (cueTouched) railAfterHit = true; }
  return { balls: B.filter((b) => !b.in).map((b) => ({ n: b.n, x: b.x, y: b.y })), potted, firstHit, railAfterHit, events, frames, time: t };
}

// aim angle from the cue ball at (cx,cy) to send ball O into pocket P (ghost-ball method)
export function aimFor(cx, cy, O, P) {
  const ux = P[0] - O.x, uy = P[1] - O.y, l = Math.hypot(ux, uy);
  const gx = O.x - (ux / l) * 2 * R, gy = O.y - (uy / l) * 2 * R;
  return { angle: Math.atan2(gy - cy, gx - cx), gx, gy, cut: Math.abs(Math.atan2((gx - cx) * uy - (gy - cy) * ux, (gx - cx) * ux + (gy - cy) * uy)), dist: Math.hypot(gx - cx, gy - cy) + l };
}
// first ball the cue ball would touch along a ray (for the aiming guide)
export function firstContact(balls, cx, cy, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = null;
  for (const b of balls) {
    if (b.n === 0) continue;
    const fx = cx - b.x, fy = cy - b.y, bb = fx * dx + fy * dy, c = fx * fx + fy * fy - 4 * R * R, disc = bb * bb - c;
    if (disc < 0) continue;
    const tt = -bb - Math.sqrt(disc);
    if (tt > 0 && (!best || tt < best.t)) best = { t: tt, b };
  }
  if (!best) return null;
  const gx = cx + dx * best.t, gy = cy + dy * best.t;
  const nx = best.b.x - gx, ny = best.b.y - gy, l = Math.hypot(nx, ny);
  return { ball: best.b, gx, gy, ox: nx / l, oy: ny / l };
}

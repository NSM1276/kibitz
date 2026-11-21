// Shared pool table art: walnut rails, felt, pockets, rolling balls, tapered cue and thick outlined guide lines.
// Used by the 8-ball game and by the aiming tasks so both look the same.
import { POCKETS, W, H, R } from './poolphys.js';

export const M = 28, CUSH = 9; // rail width around the playing area, cushion rubber inside it
export const TW = W + 2 * M, TH = H + 2 * M;
const COL = { 1: '#f5c400', 2: '#1747c9', 3: '#d8232a', 4: '#5b2a9e', 5: '#f07a12', 6: '#0c8a43', 7: '#86201d', 8: '#141414' };
export const color = (n) => (n === 0 ? '#f7f4ea' : COL[n > 8 ? n - 8 : n]);
// seeded noise so the felt and wood grain look the same every time
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export function makeArt(g, view) {
  // ---------- static table (painted once per size) ----------
  function paintTable(bg, cv) {
    bg.width = cv.width; bg.height = cv.height;
    const q = bg.getContext('2d'); view.apply(q);
    const rnd = rng(7);
    // walnut rail with grain
    const wood = q.createLinearGradient(0, 0, TW, 0);
    wood.addColorStop(0, '#4b2812'); wood.addColorStop(0.18, '#6d3c1c'); wood.addColorStop(0.5, '#7d4822'); wood.addColorStop(0.82, '#6d3c1c'); wood.addColorStop(1, '#4b2812');
    q.fillStyle = wood; q.beginPath(); q.roundRect(0, 0, TW, TH, 20); q.fill();
    q.save(); q.beginPath(); q.roundRect(0, 0, TW, TH, 20); q.clip();
    for (let i = 0; i < 46; i++) {
      const x = rnd() * TW; q.strokeStyle = rnd() < 0.5 ? 'rgba(0,0,0,.13)' : 'rgba(255,220,170,.06)'; q.lineWidth = 0.6 + rnd() * 1.6;
      q.beginPath(); q.moveTo(x, 0); q.bezierCurveTo(x + 6 - rnd() * 12, TH * 0.33, x + 6 - rnd() * 12, TH * 0.66, x + 4 - rnd() * 8, TH); q.stroke();
    }
    q.restore();
    // outer bevel highlight + inner dark edge
    q.strokeStyle = 'rgba(255,230,190,.28)'; q.lineWidth = 2; q.beginPath(); q.roundRect(1.5, 1.5, TW - 3, TH - 3, 19); q.stroke();
    q.strokeStyle = 'rgba(0,0,0,.55)'; q.lineWidth = 3; q.strokeRect(M - CUSH - 1.5, M - CUSH - 1.5, W + 2 * CUSH + 3, H + 2 * CUSH + 3);
    // cushions
    q.fillStyle = '#0f5634'; q.fillRect(M - CUSH, M - CUSH, W + 2 * CUSH, H + 2 * CUSH);
    // felt + fine noise
    const felt = q.createRadialGradient(M + W / 2, M + H / 2, 30, M + W / 2, M + H / 2, H * 0.62);
    felt.addColorStop(0, '#23985f'); felt.addColorStop(1, '#167246');
    q.fillStyle = felt; q.fillRect(M, M, W, H);
    for (let i = 0; i < 2600; i++) { q.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'; q.fillRect(M + rnd() * W, M + rnd() * H, 1.2, 1.2); }
    // cushion nose shading
    q.strokeStyle = 'rgba(0,0,0,.35)'; q.lineWidth = 2; q.strokeRect(M + 1, M + 1, W - 2, H - 2);
    q.strokeStyle = 'rgba(120,220,160,.35)'; q.lineWidth = 1.2; q.strokeRect(M - 0.6, M - 0.6, W + 1.2, H + 1.2);
    // head string + foot spot
    q.strokeStyle = 'rgba(255,255,255,.16)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(M, M + H * 0.75); q.lineTo(M + W, M + H * 0.75); q.stroke();
    q.fillStyle = 'rgba(255,255,255,.35)'; q.beginPath(); q.arc(M + W / 2, M + H * 0.25, 2.2, 0, 7); q.fill();
    // pearl diamonds on the rails
    const dia = (x, y) => { q.save(); q.translate(x, y); q.rotate(Math.PI / 4); const gr = q.createLinearGradient(-3, -3, 3, 3); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#c9b48a'); q.fillStyle = gr; q.fillRect(-2.6, -2.6, 5.2, 5.2); q.restore(); };
    const rm = (M - CUSH) / 2;
    for (let i = 1; i < 4; i++) for (const y of [rm, TH - rm]) dia(M + (W * i) / 4, y);
    for (let i = 1; i < 8; i++) { if (i === 4) continue; for (const x of [rm, TW - rm]) dia(x, M + (H * i) / 8); }
    // pockets: cut through cushion, dark hole, leather rim
    POCKETS.forEach(([px, py], i) => {
      const side = i === 2 || i === 3, r = side ? 16 : 19, x = M + px + (side ? (px ? 4 : -4) : 0), y = M + py;
      q.fillStyle = '#2a170b'; q.beginPath(); q.arc(x, y, r + 5, 0, 7); q.fill();
      const ho = q.createRadialGradient(x, y, 2, x, y, r); ho.addColorStop(0, '#000'); ho.addColorStop(0.75, '#070707'); ho.addColorStop(1, '#262626');
      q.fillStyle = ho; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill();
      q.strokeStyle = 'rgba(255,220,170,.22)'; q.lineWidth = 1.4; q.beginPath(); q.arc(x, y, r + 4, 0, 7); q.stroke();
    });
  }

  // ---------- dynamic drawing ----------
  // rolling: each ball keeps a roll phase (distance / radius) and the direction it last rolled in
  const roll = new Map();
  function rollTo(n, x, y) {
    const r = roll.get(n);
    if (!r) { roll.set(n, { x, y, ph: 0, ux: 1, uy: 0 }); return; }
    const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { r.ux = dx / d; r.uy = dy / d; r.ph += d / R; }
    r.x = x; r.y = y;
  }
  function ballAt(x, y, n, alpha = 1, scale = 1, dark = 0) {
    g.save(); g.globalAlpha = alpha; g.translate(M + x, M + y); if (scale !== 1) g.scale(scale, scale);
    g.save(); if (view.rot) g.rotate(-Math.PI / 2);
    g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.ellipse(2.4, 3.4, R * 1.02, R * 0.9, 0, 0, 7); g.fill();
    g.restore();
    const base = color(n), rs = roll.get(n) || { ph: 0, ux: 1, uy: 0 };
    // markings slide across the ball and foreshorten as it turns (numbers sit on two opposite sides)
    const sn = Math.sin(rs.ph), cs = Math.cos(rs.ph), ang = Math.atan2(rs.uy, rs.ux), fore = 0.5 + 0.5 * Math.abs(cs); // never fully edge-on, so stripes and numbers stay readable
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip();
    if (n > 8) {
      g.fillStyle = '#f7f4ea'; g.fillRect(-R, -R, 2 * R, 2 * R);
      // the coloured band turns with the ball
      g.save(); g.rotate(ang); g.translate(sn * R * 0.45, 0); g.scale(fore, 1); g.fillStyle = base; g.fillRect(-R * 0.56, -R * 1.2, R * 1.12, R * 2.4); g.restore();
    } else { g.fillStyle = base; g.fillRect(-R, -R, 2 * R, 2 * R); }
    if (n) {
      g.save(); g.rotate(ang); g.translate(sn * R * 0.42, 0); g.scale(fore, 1); g.rotate(-ang);
      if (view.rot) g.rotate(-Math.PI / 2);
      g.fillStyle = '#fbf8ee'; g.beginPath(); g.arc(0, 0, R * 0.5, 0, 7); g.fill();
      g.fillStyle = '#151515'; g.font = `bold ${n > 9 ? R * 0.62 : R * 0.74}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 0.6);
      g.restore();
    }
    g.restore();
    if (view.rot) g.rotate(-Math.PI / 2);
    const sh = g.createRadialGradient(-R * 0.38, -R * 0.42, R * 0.05, 0, 0, R * 1.05);
    sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.28, 'rgba(255,255,255,.07)'); sh.addColorStop(0.72, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(-R * 0.4, -R * 0.46, R * 0.2, R * 0.13, -0.6, 0, 7); g.fill();
    if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); }
    g.restore();
  }
  // tapered cue: tip, white ferrule, maple shaft, dark butt with a brass ring
  function cueStick(c, a, pull) {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, back = R + 4 + pull, len = 330;
    const at = (t) => [M + c.x - dx * (back + t * len), M + c.y - dy * (back + t * len)];
    const wid = (t) => 2.3 + t * 3.4; // half width
    const seg = (t0, t1, fill) => {
      const [x0, y0] = at(t0), [x1, y1] = at(t1), w0 = wid(t0), w1 = wid(t1);
      g.fillStyle = fill; g.beginPath();
      g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.closePath(); g.fill();
    };
    g.save();
    g.translate(4, 6); g.globalAlpha = 0.35; seg(0, 1, '#000'); g.globalAlpha = 1; g.translate(-4, -6);
    const [sx, sy] = at(0.05), [ex, ey] = at(0.6);
    const maple = g.createLinearGradient(sx + nx * 3, sy + ny * 3, sx - nx * 3, sy - ny * 3);
    maple.addColorStop(0, '#f6e2b8'); maple.addColorStop(0.5, '#e2bf82'); maple.addColorStop(1, '#b58a4f');
    const butt = g.createLinearGradient(ex + nx * 6, ey + ny * 6, ex - nx * 6, ey - ny * 6);
    butt.addColorStop(0, '#5a2d14'); butt.addColorStop(0.5, '#2e140a'); butt.addColorStop(1, '#150904');
    seg(0, 0.012, '#2f6fb3'); seg(0.012, 0.045, '#f4f1ea'); seg(0.045, 0.6, maple); seg(0.6, 0.62, '#d9ac5c'); seg(0.62, 0.97, butt); seg(0.97, 1, '#0b0b0b');
    g.restore();
  }
  // thick line with a dark outline so it reads on any felt and on small screens
  function line(x0, y0, x1, y1, col, w, dash) {
    g.save(); g.lineCap = 'round'; if (dash) g.setLineDash(dash);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = w + 2.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  }
  function ring(x, y, r, col, w, fill) {
    g.save(); if (fill) { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = w + 2.2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.restore();
  }
  function arrowHead(x, y, a, col) {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -6); g.lineTo(-5, 6); g.closePath(); g.stroke(); g.fill(); g.restore();
  }
  return { paintTable, rollTo, ballAt, cueStick, line, ring, arrowHead, roll };
}

// How often does the computer pot a ball at each level? (random single-ball positions)
import { simulate, aimFor, POCKETS, W, H, R } from '../js/games/poolphys.js';
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
for (const [lv, noise] of [[0, 0.06], [1, 0.028], [2, 0.011]]) {
  let pots = 0, N = 300;
  for (let i = 0; i < N; i++) {
    const O = { n: 1, x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 80) };
    const C = { n: 0, x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 80) };
    if (Math.hypot(O.x - C.x, O.y - C.y) < 60) { i--; continue; }
    let best = null;
    for (const P of POCKETS) { const a = aimFor(C.x, C.y, O, P); if (a.cut > 1.3) continue;
      for (const sp of [380, 600, 900]) { const r = simulate([C, O], { angle: a.angle, speed: sp }); const s = (r.potted.includes(1) && !r.potted.includes(0) ? 100 : 0) - a.cut * 25 - a.dist * 0.02; if (!best || s > best.s) best = { s, a, sp }; } }
    if (!best) { i--; continue; }
    const r = simulate([C, O], { angle: best.a.angle + gauss() * noise, speed: best.sp * (1 + gauss() * 0.08) });
    if (r.potted.includes(1) && !r.potted.includes(0)) pots++;
  }
  console.log('level', lv, 'pot rate', Math.round((100 * pots) / N) + '%');
}

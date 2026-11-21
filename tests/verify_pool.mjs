import tasks from '../data/pool.js';
import { layout, simulate, W, H, R } from '../js/games/poolgeo.js';
let bad = 0;
for (const t of tasks) {
  const L = layout(t), errs = [];
  for (const [n, p] of [['cue', L.C], ['ob', L.O]]) if (p[0] < R + 4 || p[0] > W - R - 4 || p[1] < R + 4 || p[1] > H - R - 4) errs.push(n + ' off table ' + p.map(Math.round));
  const s = simulate(t, L.angle);
  if (!s.ok) errs.push('correct angle does not pot: ' + s.pocket);
  // tolerance window in degrees
  let lo = 0, hi = 0;
  for (let e = 0; e < 15; e += 0.05) { if (simulate(t, L.angle + (e * Math.PI) / 180).ok) hi = e; else break; }
  for (let e = 0; e < 15; e += 0.05) { if (simulate(t, L.angle - (e * Math.PI) / 180).ok) lo = e; else break; }
  if (errs.length) bad++;
  console.log(errs.length ? 'FAIL' : 'OK  ', t.id.padEnd(10), 'cue', L.C.map(Math.round), 'cut', s.cutDeg?.toFixed(1), `window -${lo.toFixed(2)}/+${hi.toFixed(2)} deg`, errs.join('; '));
}
process.exit(bad ? 1 : 0);

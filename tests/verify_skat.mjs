import tasks from '../data/skat.js';
import { legal } from '../js/games/skatlogic.js';
let bad = 0;
for (const t of tasks) {
  const errs = [], all = [...t.hand, ...t.trick.map((x) => x.card)];
  if (new Set(all).size !== all.length) errs.push('duplicate card');
  const L = legal(t.hand, t.trick, t.game);
  for (const a of t.accept) if (!L.includes(a)) errs.push('accepted card illegal: ' + a);
  for (const c of Object.keys(t.why || {})) if (!t.hand.includes(c)) errs.push('why for card not in hand: ' + c);
  const order = t.trick.map((x) => x.who).join(',');
  if (!['', 'right', 'left,right'].includes(order)) errs.push('trick order not clockwise: ' + order);
  if (errs.length) bad++;
  console.log(errs.length ? 'FAIL' : 'OK  ', t.id.padEnd(14), 'legal', L.join(' '), errs.join('; '));
}
process.exit(bad ? 1 : 0);

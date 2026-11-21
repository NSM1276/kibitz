import tasks from '../data/backgammon.js';
import { legalPlay, playKey } from '../js/games/bglogic.js';
let bad = 0;
for (const t of tasks) {
  const errs = [];
  for (const p of t.accept) if (!legalPlay(p, t.dice)) errs.push('illegal ' + JSON.stringify(p));
  const keys = new Set(t.accept.map(playKey));
  if (keys.size !== t.accept.length) errs.push('duplicate accepted plays');
  if (errs.length) bad++;
  console.log(errs.length ? 'FAIL' : 'OK  ', t.id, t.dice.join('-'), t.accept.length, 'plays', errs.join('; '));
}
process.exit(bad ? 1 : 0);

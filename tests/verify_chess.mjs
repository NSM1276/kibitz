import { Chess } from '../vendor/chess.js';
import tasks from '../data/chess.js';
let bad = 0;
for (const t of tasks) {
  const g = new Chess();
  try {
    for (const m of t.setup) g.move(m);
    if (g.turn() !== t.user) throw new Error('side to move ' + g.turn() + ' != user ' + t.user);
    if (t.accept) for (const a of t.accept) { const h = new Chess(g.fen()); h.move(a); }
    for (const m of t.line) g.move(m);
    const last = t.line[t.line.length - 1];
    if (t.mateOk && !g.isCheckmate()) throw new Error('final not mate');
    console.log('OK  ', t.id, last, g.isCheckmate() ? 'MATE' : '');
  } catch (e) { bad++; console.log('FAIL', t.id, e.message); }
}
process.exit(bad ? 1 : 0);

import { start, plays, flip, winner, bestPlay, steps } from '../js/games/bgfull.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const total = (s, side) => (side === 0 ? s.b.reduce((a, v) => a + (v > 0 ? v : 0), 0) : s.b.reduce((a, v) => a + (v < 0 ? -v : 0), 0)) + s.bar[side] + s.off[side];
ok(plays(start(), [3, 1]).some((p) => p.state.b[5] === 2), '31 makes 5pt');
ok(plays(start(), [6, 6]).every((p) => p.steps.length === 4), '66 uses 4');
// blocked entry
let s = start(); s.bar[0] = 1; s.b[24] = 1; for (const p of [19, 20, 21, 22, 23, 24]) s.b[p] = p === 24 ? -2 : -2;
ok(plays(s, [1, 2]).length === 1 && plays(s, [1, 2])[0].steps.length === 0, 'closed board: no move');
let wins = { me: 0, cpu: 0 }, turns = 0;
for (let g = 0; g < 40; g++) {
  let st = start(), side = 0; // side 0 = AI hard, 1 = random
  for (let t = 0; t < 2000; t++) {
    const dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    let p;
    if (side === 0) p = bestPlay(st, dice, 2); else { const ps = plays(st, dice); p = ps[Math.floor(Math.random() * ps.length)]; }
    if (p) st = p.state;
    ok(total(st, 0) === 15 && total(st, 1) === 15, 'checker count');
    if (winner(st) === 1) { side === 0 ? wins.me++ : wins.cpu++; break; }
    st = flip(st); side = 1 - side; turns++;
  }
}
console.log('AI wins', wins.me, 'random wins', wins.cpu, 'turns', turns, 'fails', fails);
process.exit(fails ? 1 : 0);

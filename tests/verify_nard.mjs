import { start, plays, flip, winner, bestPlay, sequences, badWall, other } from '../js/games/nardlogic.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const total = (s, side) => (side === 0 ? s.b.reduce((a, v) => a + (v > 0 ? v : 0), 0) : s.b.reduce((a, v) => a + (v < 0 ? -v : 0), 0)) + s.off[side];
// head rule: normal roll takes only one from the head
ok(plays(start(), [5, 2]).every((p) => p.state.b[24] === 14), '52: one from head');
// 6-6 first turn: two from head (24->18 x2), opponent head on 12 blocks further
const p66 = plays(start(), [6, 6], true);
ok(p66.length >= 1 && p66.every((p) => p.state.b[24] === 13 && p.state.b[18] === 2), '66 first: two to 18 ' + JSON.stringify(p66.map((p) => p.steps)));
ok(plays(start(), [6, 6], false).every((p) => p.state.b[24] === 14), '66 later: one from head');
// 4-4 first turn: two leave the head
ok(plays(start(), [4, 4], true).every((p) => p.state.b[24] === 13), '44 first: two from head');
// no hitting: a single opponent checker blocks
let s = start(); s.b[12] = -14; s.b[19] = -1; ok(plays(s, [5, 1]).every((p) => !p.steps.some((m) => m[1] === 19)), 'single checker blocks');
ok(other(12) === 24 && other(24) === 12 && other(1) === 13 && other(13) === 1, 'mapping');
// wall of 6 with no opponent past it is illegal
s = { b: Array(26).fill(0), bar: [0, 0], off: [0, 0] }; s.b[24] = 4; for (const p of [23, 22, 21, 20, 19]) s.b[p] = 2; s.b[12] = -15; s.b[24] = 1; s.b[17] = 0; s.b[16] = 0;
const t = { ...s, b: s.b.slice() }; t.b[18] = 1; ok(badWall(t), 'six in a row flagged');
ok(!plays(s, [6, 5]).some((p) => p.state.b[18] > 0 && [24, 23, 22, 21, 20, 19].every((q) => p.state.b[q] > 0)), 'wall not allowed');
// random games: AI hard vs random, checker counts, games end
let wins = { ai: 0, rnd: 0 }, turns = 0;
for (let g = 0; g < 30; g++) {
  let st = start(), side = 0, first = [true, true];
  for (let k = 0; k < 3000; k++) {
    const dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    let p;
    if (side === 0) p = bestPlay(st, dice, 2, first[side]); else { const ps = plays(st, dice, first[side]); p = ps[Math.floor(Math.random() * ps.length)]; }
    const sq = sequences(st, dice, first[side]);
    ok(!p || sq.some((x) => x.length === p.steps.length), 'sequences agree with plays');
    first[side] = false;
    if (p) st = p.state;
    ok(total(st, 0) === 15 && total(st, 1) === 15, 'checker count');
    if (winner(st) === 1) { side === 0 ? wins.ai++ : wins.rnd++; break; }
    st = flip(st); side = 1 - side; turns++;
  }
}
console.log('AI wins', wins.ai, 'random wins', wins.rnd, 'turns', turns, 'fails', fails);
process.exit(fails ? 1 : 0);

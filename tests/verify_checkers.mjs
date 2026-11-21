import { start, moves, apply, bestMove } from '../js/games/checkerslogic.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const B = (list) => { const b = Array(64).fill(0); for (const [sq, p] of list) b[sq] = p; return b; };
const sq = (r, c) => r * 8 + c;
// start: white has 7 moves
ok(moves(start(), 1).length === 7, 'start moves 7');
// mandatory capture
let b = B([[sq(5, 2), 1], [sq(4, 3), -1], [sq(5, 6), 1]]);
let m = moves(b, 1); ok(m.length === 1 && m[0].caps[0] === sq(4, 3), 'must capture');
// man captures backwards
b = B([[sq(3, 2), 1], [sq(4, 3), -1]]); m = moves(b, 1); ok(m.some((x) => x.caps[0] === sq(4, 3)), 'backward capture');
// double jump
b = B([[sq(6, 1), 1], [sq(5, 2), -1], [sq(3, 4), -1]]); m = moves(b, 1); ok(m.length === 1 && m[0].caps.length === 2, 'double jump');
// promotion during capture continues as king
b = B([[sq(2, 1), 1], [sq(1, 2), -1], [sq(2, 5), -1]]); m = moves(b, 1);
ok(m.some((x) => x.promote && x.caps.length === 2), 'promote mid-capture and continue');
// flying king
b = B([[sq(7, 0), 2]]); m = moves(b, 1); ok(m.length === 7, 'flying king 7 squares');
// random self-play to catch crashes
let games = 0, plies = 0;
for (let g = 0; g < 30; g++) {
  let bb = start(), side = 1;
  for (let i = 0; i < 200; i++) {
    const ms = moves(bb, side); if (!ms.length) break;
    const mv = i % 2 ? ms[Math.floor(Math.random() * ms.length)] : bestMove(bb, side, 0);
    bb = apply(bb, mv); side = -side; plies++;
    ok(bb.filter((p) => p).length <= 24, 'piece count');
  }
  games++;
}
let t0 = Date.now(); bestMove(start(), 1, 2); const tHard = Date.now() - t0;
console.log(`games ${games}, plies ${plies}, hard move ${tHard} ms, fails ${fails}`);
process.exit(fails ? 1 : 0);

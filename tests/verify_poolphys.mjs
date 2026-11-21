import { simulate, aimFor, POCKETS, W, H, R } from '../js/games/poolphys.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
// straight shot into top-left corner
const O = { n: 1, x: 80, y: 80 }, C = { n: 0, x: 200, y: 200 };
const a = aimFor(C.x, C.y, O, POCKETS[0]);
let r = simulate([C, O], { angle: a.angle, speed: 700 });
ok(r.potted.includes(1) && !r.potted.includes(0), 'straight pot ' + JSON.stringify(r.potted));
ok(r.firstHit === 1, 'first hit');
// stun on straight shot: cue stops near contact point
const C2 = { n: 0, x: 80, y: 300 }, O2 = { n: 1, x: 80, y: 200 };
r = simulate([C2, O2], { angle: -Math.PI / 2, speed: 260 });
const cue = r.balls.find((b) => b.n === 0);
ok(cue && Math.abs(cue.y - 220) < 30, 'stun stops ' + (cue && cue.y.toFixed(1)));
// follow goes forward, draw comes back
const f = simulate([C2, O2], { angle: -Math.PI / 2, speed: 260, spin: 1 }).balls.find((b) => b.n === 0);
const d = simulate([C2, O2], { angle: -Math.PI / 2, speed: 260, spin: -1 }).balls.find((b) => b.n === 0);
ok(f && f.y < 200, 'follow forward ' + (f && f.y.toFixed(0)));
ok(d && d.y > 260, 'draw back ' + (d && d.y.toFixed(0)));
// energy: everything stops, nothing leaves the table without being potted
const rack = [{ n: 0, x: W / 2, y: H * 0.75 }];
let n = 1; for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) rack.push({ n: n++, x: W / 2 + (i - row / 2) * 2 * R * 1.01, y: H * 0.25 - row * 2 * R * 0.88 });
let t0 = Date.now(); r = simulate(rack, { angle: -Math.PI / 2 + 0.01, speed: 1500 }, true); const ms = Date.now() - t0;
ok(r.balls.every((b) => b.x >= R - 1 && b.x <= W - R + 1 && b.y >= R - 1 && b.y <= H - R + 1), 'all inside');
ok(r.balls.length + r.potted.length === 16, 'count');
console.log('break: potted', r.potted, 'time', r.time.toFixed(1) + 's', 'frames', r.frames.length, 'sim ms', ms, 'fails', fails);
process.exit(fails ? 1 : 0);

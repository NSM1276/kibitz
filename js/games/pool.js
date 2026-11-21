import tasks from '../../data/pool.js';
import { W, H, R, POCKETS, layout, simulate } from './poolgeo.js';
import { playPool } from './poolplay.js';

const M = 24; // rail width
// rAF with a timer fallback (rAF is paused in hidden/background views)
function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 40); return 0; }
const BALL = { 1: '#f7c600', 2: '#1d4fd8', 3: '#e0242b', 4: '#6b2fb3', 5: '#f57c00', 6: '#0f8a3c', 7: '#8a1c1c', 8: '#111111', 9: '#f7c600', 10: '#1d4fd8', 11: '#e0242b', 12: '#6b2fb3' };
const MSG = {
  aim: { en: 'Drag on the table to aim. Use ◀ ▶ for fine tuning.', de: 'Auf dem Tisch ziehen zum Zielen. ◀ ▶ zum Feinjustieren.' },
  shoot: { en: 'Shoot', de: 'Stoßen' },
  miss: { en: 'Missed the ball completely. Aim at the ghost ball, not at empty space.', de: 'Kugel verfehlt. Ziele auf die Geisterkugel.' },
  wrongPocket: { en: 'Pocketed, but in the wrong pocket.', de: 'Versenkt, aber in der falschen Tasche.' },
  thick: { en: 'Too full: the ball went too straight. Aim further outside.', de: 'Zu voll getroffen. Ziele weiter außen.' },
  thinMsg: { en: 'Too thin: the ball was cut too much. Aim fuller.', de: 'Zu dünn getroffen. Ziele voller.' },
  offc: { en: 'Slightly off-centre: on a straight shot hit the object ball dead centre.', de: 'Leicht außermittig: Beim geraden Stoß die Objektkugel genau mittig treffen.' },
  see: { en: 'The yellow ring shows the correct ghost ball.', de: 'Der gelbe Ring zeigt die richtige Geisterkugel.' },
};

export default {
  id: 'pool', icon: '🎱', color: '#5fd39a',
  title: { en: 'Pool Aiming', de: 'Billard: Zielen' },
  tagline: { en: 'Where do you aim? Cut shots from straight to thin', de: 'Wohin zielst du? Schnittbälle von gerade bis dünn' },
  tasks,
  play: playPool,
  playTitle: { en: '8-ball vs computer', de: '8-Ball gegen Computer' },
  mount(stage, task, ctx) {
    const L = layout(task);
    const cv = document.createElement('canvas'); cv.className = 'stagecv';
    const CW = W + 2 * M, CH = H + 2 * M, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = CW * dpr; cv.height = CH * dpr; cv.style.aspectRatio = `${CW}/${CH}`;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const bar = document.createElement('div'); bar.className = 'toolbar';
    const mk = (txt, fn, cls = 'btn') => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.onclick = fn; bar.append(b); return b; };
    stage.append(cv, bar);

    // start aim: straight at the object ball centre (a natural first guess, not the answer)
    let angle = Math.atan2(L.O[1] - L.C[1], L.O[0] - L.C[0]);
    let phase = 'aim', shot = null, t0 = 0, alive = true, raf = 0, showAnswer = false, sunk = false;
    const nudge = (deg) => { if (phase !== 'aim') return; angle += (deg * Math.PI) / 180; draw(); };
    const hold = (b, deg) => { let iv = null, to = null; const stop = () => { clearTimeout(to); clearInterval(iv); };
      b.onclick = null; b.addEventListener('pointerdown', (e) => { e.preventDefault(); nudge(deg); to = setTimeout(() => { iv = setInterval(() => nudge(deg), 60); }, 350); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop)); };
    hold(mk('◀', null), -0.1); hold(mk('▶', null), 0.1);
    const shootBtn = mk(ctx.t(MSG.shoot), () => fire(), 'btn primary'); shootBtn.style.flex = '2';
    ctx.hint(MSG.aim);

    const toTable = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * CW) / r.width - M, ((e.clientY - r.top) * CH) / r.height - M]; };
    let dragging = false;
    const aimAt = (e) => { const p = toTable(e); if (Math.hypot(p[0] - L.C[0], p[1] - L.C[1]) < 4) return; angle = Math.atan2(p[1] - L.C[1], p[0] - L.C[0]); draw(); };
    cv.addEventListener('pointerdown', (e) => { if (phase !== 'aim') return; dragging = true; try { cv.setPointerCapture(e.pointerId); } catch {} aimAt(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging && phase === 'aim') aimAt(e); });
    cv.addEventListener('pointerup', () => { dragging = false; });

    function ball(p, color, num) {
      g.save(); g.translate(M + p[0], M + p[1]);
      g.fillStyle = '#0005'; g.beginPath(); g.arc(2, 3, R, 0, 7); g.fill();
      if (num > 8) { // striped ball: white with a coloured band
        g.fillStyle = '#f7f5ec'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
        g.save(); g.beginPath(); g.arc(0, 0, R, 0, 7); g.clip(); g.fillStyle = color; g.fillRect(-R, -R * 0.55, 2 * R, R * 1.1); g.restore();
      } else { g.fillStyle = color; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); }
      if (num) { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, R * 0.52, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = `bold ${R * 0.8}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(num, 0, 0.5); }
      const sh = g.createRadialGradient(-R * 0.35, -R * 0.4, 1, 0, 0, R); sh.addColorStop(0, '#ffffffaa'); sh.addColorStop(0.35, '#ffffff10'); sh.addColorStop(1, '#00000040');
      g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
      g.restore();
    }
    function ring(p, color, dash) { g.save(); g.strokeStyle = color; g.lineWidth = 2; if (dash) g.setLineDash(dash); g.beginPath(); g.arc(M + p[0], M + p[1], R, 0, 7); g.stroke(); g.restore(); }
    function line(a, b, color, w = 1.5, dash) { g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(M + a[0], M + a[1]); g.lineTo(M + b[0], M + b[1]); g.stroke(); g.restore(); }

    function table() {
      g.clearRect(0, 0, CW, CH);
      const wood = g.createLinearGradient(0, 0, CW, 0); wood.addColorStop(0, '#6e4020'); wood.addColorStop(0.5, '#86522b'); wood.addColorStop(1, '#6e4020');
      g.fillStyle = wood; g.beginPath(); g.roundRect(0, 0, CW, CH, 16); g.fill();
      const felt = g.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CH * 0.7); felt.addColorStop(0, '#1f8f5a'); felt.addColorStop(1, '#126b41');
      g.fillStyle = felt; g.fillRect(M, M, W, H);
      g.strokeStyle = '#0d4f30'; g.lineWidth = 3; g.strokeRect(M, M, W, H);
      g.fillStyle = '#f3e3c3';
      for (let i = 1; i < 4; i++) for (const y of [M / 2, CH - M / 2]) { g.beginPath(); g.arc(M + (W * i) / 4, y, 2.2, 0, 7); g.fill(); }
      for (let i = 1; i < 8; i++) { if (i === 4) continue; for (const x of [M / 2, CW - M / 2]) { g.beginPath(); g.arc(x, M + (H * i) / 8, 2.2, 0, 7); g.fill(); } }
      for (const [id, P] of Object.entries(POCKETS)) {
        const px = M + Math.min(W, Math.max(0, P[0])), py = M + P[1];
        g.fillStyle = '#060606'; g.beginPath(); g.arc(px, py, id[0] === 'm' ? 15 : 17, 0, 7); g.fill();
        if (id === task.pocket && phase === 'aim') { g.strokeStyle = '#e8c46a'; g.lineWidth = 2.5; g.setLineDash([4, 4]); g.beginPath(); g.arc(px, py, 22, 0, 7); g.stroke(); g.setLineDash([]); }
      }
    }

    function draw(tm = 0) {
      if (!alive) return;
      table();
      if (phase === 'aim') {
        const s = simulate(task, angle), d = [Math.cos(angle), Math.sin(angle)];
        if (task.assist === 'none') line(L.C, [L.C[0] + d[0] * 70, L.C[1] + d[1] * 70], '#ffffff88', 1.5, [3, 4]);
        else if (s.hit) {
          line(L.C, s.G, '#ffffffaa', 1.5, [4, 4]); ring(s.G, '#ffffffcc', [3, 3]);
          if (task.assist === 'ghost') line(L.O, [L.O[0] + s.od[0] * 120, L.O[1] + s.od[1] * 120], '#e8c46acc', 1.5, [2, 4]);
        } else line(L.C, [L.C[0] + d[0] * 400, L.C[1] + d[1] * 400], '#ffffff55', 1.5, [4, 4]);
        ball(L.O, BALL[task.ball], task.ball); ball(L.C, '#f7f5ec');
        const back = 18, len = 230;
        const a = [L.C[0] - d[0] * back, L.C[1] - d[1] * back], b = [L.C[0] - d[0] * (back + len), L.C[1] - d[1] * (back + len)];
        g.save(); g.lineCap = 'round';
        g.strokeStyle = '#00000055'; g.lineWidth = 8; g.beginPath(); g.moveTo(M + a[0] + 3, M + a[1] + 4); g.lineTo(M + b[0] + 3, M + b[1] + 4); g.stroke();
        const grd = g.createLinearGradient(M + a[0], M + a[1], M + b[0], M + b[1]); grd.addColorStop(0, '#f2f2f2'); grd.addColorStop(0.04, '#3b82c4'); grd.addColorStop(0.06, '#e8c48a'); grd.addColorStop(0.7, '#b07a3c'); grd.addColorStop(1, '#2a1a0c');
        g.strokeStyle = grd; g.lineWidth = 6; g.beginPath(); g.moveTo(M + a[0], M + a[1]); g.lineTo(M + b[0], M + b[1]); g.stroke(); g.restore();
        return;
      }
      const s = shot, T1 = s.t1, T2 = s.t2, t = tm - t0;
      const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 2.2);
      let cue, ob = L.O;
      if (!s.r.hit) cue = lerp(L.C, s.r.cueEnd, ease(t / T1));
      else if (t < T1) cue = lerp(L.C, s.r.G, t / T1);
      else {
        if (!s.clacked) { s.clacked = true; ctx.sfx.hit(); }
        const k = ease((t - T1) / T2);
        cue = lerp(s.r.G, s.r.cueEnd, ease((t - T1) / (T2 * 0.8)));
        ob = lerp(L.O, s.r.objEnd, k);
        if (s.r.pocket && k > 0.97 && !sunk) { sunk = true; ctx.sfx.drop(); }
      }
      if (showAnswer) { ring(L.G, '#e8c46a'); line(L.O, L.P, '#e8c46a88', 1.5, [2, 4]); }
      if (!(sunk && s.r.pocket)) ball(ob, BALL[task.ball], task.ball);
      ball(cue, '#f7f5ec');
      if (t < T1 + T2 + 200 && !s.done) frame(draw);
      else if (!s.done) { s.done = true; finish(); }
    }

    function fire() {
      if (phase !== 'aim') return;
      const r = simulate(task, angle);
      phase = 'shot'; shootBtn.disabled = true; ctx.hint('');
      const d1 = r.hit ? Math.hypot(r.G[0] - L.C[0], r.G[1] - L.C[1]) : 300;
      shot = { r, t1: Math.max(250, d1 * 1.6), t2: 900, clacked: false, done: false };
      ctx.sfx.tap();
      frame((tm) => { t0 = tm; draw(tm); });
    }

    function finish() {
      if (!alive) return;
      const r = shot.r;
      if (r.ok) return ctx.result({ ok: true, text: task.explain });
      let why = MSG.miss;
      if (r.hit) why = r.pocket ? MSG.wrongPocket : task.cut === 0 ? MSG.offc : (r.cutDeg < Math.abs(task.cut) ? MSG.thick : MSG.thinMsg);
      showAnswer = true; draw(t0 + shot.t1 + shot.t2 + 300);
      ctx.result({ ok: false, text: { en: `${why.en} ${MSG.see.en} ${task.explain.en}`, de: `${why.de} ${MSG.see.de} ${task.explain.de}` } });
    }

    draw();
    return () => { alive = false; cancelAnimationFrame(raf); };
  },
};

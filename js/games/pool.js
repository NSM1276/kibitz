import tasks from '../../data/pool.js';
import { W, H, R, layout, simulate } from './poolgeo.js';
import { playPool } from './poolplay.js';
import { makeArt, M, TW, TH } from './poolart.js';
import { makeView, phoneLandscape } from './fitview.js';

// rAF with a timer fallback (rAF is paused in hidden/background views)
function frame(cb) { let done = false; const go = () => { if (!done) { done = true; cb(performance.now()); } }; requestAnimationFrame(go); setTimeout(go, 40); }
// pocket id -> index in the shared art's pocket list (tl, tr, ml, mr, bl, br)
const PIDX = { tl: 0, tr: 1, ml: 2, mr: 3, bl: 4, br: 5 };
const PXY = [[0, 0], [W, 0], [0, H / 2], [W, H / 2], [0, H], [W, H]];
const MSG = {
  aim: { en: 'Drag to turn the cue, ‹ wheel › for fine aim, then Shoot.', de: 'Ziehen zum Drehen, ‹ Rad › zum Feinzielen, dann Stoßen.' },
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
    const wrap = document.createElement('div'); wrap.className = 'ptask';
    wrap.innerHTML = `<div class="pcvbox"><canvas class="gcv"></canvas></div>
      <div class="ptbar"><div class="proll"><i></i></div><button class="btn primary pshoot"></button></div>`;
    stage.append(wrap);
    const app = document.getElementById('app'); app?.classList.add('wide');
    const cv = wrap.querySelector('canvas'), g = cv.getContext('2d');
    const rollEl = wrap.querySelector('.proll'), ribs = wrap.querySelector('.proll i'), shootBtn = wrap.querySelector('.pshoot');
    shootBtn.textContent = ctx.t(MSG.shoot);
    const view = makeView(cv, TW, TH), art = makeArt(g, view);
    const bg = document.createElement('canvas');
    const OB = task.ball, C = { x: L.C[0], y: L.C[1] };

    // start aim: straight at the object ball centre (a natural first guess, not the answer)
    let angle = Math.atan2(L.O[1] - L.C[1], L.O[0] - L.C[0]);
    let phase = 'aim', shot = null, alive = true, showAnswer = false;
    ctx.hint(MSG.aim);

    // ---------- size: the bigger of upright or sideways; a phone held sideways gets a sideways table ----------
    function fit() {
      if (!alive) return;
      const W0 = stage.clientWidth || wrap.clientWidth, land = phoneLandscape();
      const H0 = land ? window.innerHeight - 76 : Math.max(280, Math.min(window.innerHeight * 0.74, window.innerHeight - 200));
      const sUp = view.fit(false, W0, H0), sSide = view.fit(true, W0, H0);
      const side = land || sSide > sUp * 1.08;
      view.size(side, side ? sSide : sUp);
      art.paintTable(bg, cv); draw();
    }
    let lastW = 0;
    const ro = new ResizeObserver(() => { const w = stage.clientWidth; if (w !== lastW) { lastW = w; fit(); } }); ro.observe(stage);
    const onTurn = () => setTimeout(fit, 120);
    window.addEventListener('orientationchange', onTurn); window.addEventListener('resize', onTurn);

    // ---------- aiming: tap = point there, drag = turn around the white ball, wheel = very fine ----------
    const turn = (da) => { if (phase !== 'aim') return; angle += da; draw(); };
    let aimDrag = null;
    const around = (p) => Math.atan2(p[1] - C.y, p[0] - C.x);
    const toTable = (e) => { const p = view.toLocal(e); return [p[0] - M, p[1] - M]; };
    cv.addEventListener('pointerdown', (e) => {
      if (phase !== 'aim') return;
      try { cv.setPointerCapture(e.pointerId); } catch {}
      aimDrag = { sx: e.clientX, sy: e.clientY, pa: around(toTable(e)), moved: false };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!aimDrag || phase !== 'aim') return;
      if (!aimDrag.moved && Math.hypot(e.clientX - aimDrag.sx, e.clientY - aimDrag.sy) < 6) return;
      aimDrag.moved = true;
      const p = toTable(e), dist = Math.hypot(p[0] - C.x, p[1] - C.y), pa = around(p);
      let da = pa - aimDrag.pa; da = Math.atan2(Math.sin(da), Math.cos(da)); aimDrag.pa = pa;
      if (dist > 2 * R) turn(da * Math.min(1, Math.max(0.3, dist / 220)));
    });
    cv.addEventListener('pointerup', (e) => {
      if (aimDrag && !aimDrag.moved && phase === 'aim') { const p = toTable(e); if (Math.hypot(p[0] - C.x, p[1] - C.y) > 4) { angle = around(p); draw(); } }
      aimDrag = null;
    });
    const FINE = 0.035 * Math.PI / 180; // radians per pixel on the wheel
    let rollDrag = null, ribOff = 0, tickAcc = 0;
    const roll = (px) => {
      turn(px * FINE); ribOff += px; ribs.style.backgroundPosition = `${ribOff}px 0`;
      tickAcc += Math.abs(px); if (tickAcc > 14) { tickAcc = 0; ctx.sfx.diceTick(0.12); }
    };
    rollEl.addEventListener('pointerdown', (e) => { if (phase !== 'aim') return; e.preventDefault(); try { rollEl.setPointerCapture(e.pointerId); } catch {} rollDrag = { x: e.clientX, moved: 0 }; });
    rollEl.addEventListener('pointermove', (e) => { if (!rollDrag) return; const d = e.clientX - rollDrag.x; rollDrag.x = e.clientX; rollDrag.moved += Math.abs(d); if (d) roll(d); });
    rollEl.addEventListener('pointerup', (e) => {
      if (rollDrag && rollDrag.moved < 4 && phase === 'aim') { // a tap nudges 0.1° towards that end
        const r = rollEl.getBoundingClientRect(); roll(((e.clientX - r.left) / r.width < 0.5 ? -1 : 1) * (0.1 * Math.PI / 180) / FINE); ctx.sfx.tap();
      }
      rollDrag = null;
    });
    rollEl.addEventListener('pointercancel', () => { rollDrag = null; });
    shootBtn.onclick = () => fire();

    // ---------- drawing ----------
    const WHITE = 'rgba(255,255,255,.95)', GOLD = '#ffd45a';
    const pocketAt = (id) => { const i = PIDX[id], [px, py] = PXY[i], side = i === 2 || i === 3; return [px + (side ? (px ? 4 : -4) : 0), py, side]; };
    function pocketMark() {
      const [x, y, side] = pocketAt(task.pocket), k = (performance.now() / 900) % 1;
      art.ring(M + x, M + y, (side ? 22 : 25) + k * 5, `rgba(255,212,90,${0.95 - k * 0.6})`, 3.2);
    }
    function draw() {
      if (!alive || !bg.width) return;
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); view.apply(g);
      if (phase === 'aim') {
        pocketMark();
        const s = simulate(task, angle), d = [Math.cos(angle), Math.sin(angle)];
        if (task.assist === 'none') art.line(M + C.x, M + C.y, M + C.x + d[0] * 80, M + C.y + d[1] * 80, WHITE, 2.6);
        else if (s.hit) {
          art.line(M + C.x, M + C.y, M + s.G[0], M + s.G[1], WHITE, 2.6);
          art.ring(M + s.G[0], M + s.G[1], R, WHITE, 2.4, 'rgba(255,255,255,.14)');
          if (task.assist === 'ghost') {
            const ox = M + L.O[0] + s.od[0] * (R + 3), oy = M + L.O[1] + s.od[1] * (R + 3), tx = ox + s.od[0] * 120, ty = oy + s.od[1] * 120;
            art.line(ox, oy, tx, ty, GOLD, 3.2); art.arrowHead(tx, ty, Math.atan2(s.od[1], s.od[0]), GOLD);
          }
        } else art.line(M + C.x, M + C.y, M + C.x + d[0] * 420, M + C.y + d[1] * 420, 'rgba(255,255,255,.6)', 2.4, [8, 7]);
        art.ballAt(L.O[0], L.O[1], OB); art.ballAt(C.x, C.y, 0);
        art.cueStick(C, angle, 8);
        return;
      }
      if (showAnswer) {
        art.line(M + L.O[0], M + L.O[1], M + L.P[0], M + L.P[1], 'rgba(255,212,90,.75)', 2.6, [6, 6]);
        art.ring(M + L.G[0], M + L.G[1], R, GOLD, 3, 'rgba(255,212,90,.18)');
      }
      const f = shot.f;
      if (f.sink) art.ballAt(f.sink.x, f.sink.y, OB, f.sink.a, f.sink.k, f.sink.d);
      if (f.ob) art.ballAt(f.ob[0], f.ob[1], OB);
      art.ballAt(f.cue[0], f.cue[1], 0);
      if (f.stick) { g.save(); g.globalAlpha = f.stick.alpha; art.cueStick(C, angle, f.stick.pull); g.restore(); }
    }
    // the target pocket ring keeps pulsing while aiming
    const pulse = () => { if (!alive) return; if (phase === 'aim' && !aimDrag && !rollDrag) draw(); setTimeout(() => frame(pulse), 60); };
    pulse();

    // ---------- the shot: cue strikes, white rolls to the contact point, object ball runs (and drops) ----------
    function fire() {
      if (phase !== 'aim') return;
      const r = simulate(task, angle);
      phase = 'shot'; shootBtn.disabled = true; ctx.hint('');
      const d1 = r.hit ? Math.hypot(r.G[0] - L.C[0], r.G[1] - L.C[1]) : 300;
      const STRIKE = 70, T1 = Math.max(260, d1 * 1.4), T2 = 950;
      shot = { r, f: { cue: L.C, ob: L.O } };
      ctx.sfx.cue(0.55);
      const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      const out = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 2.2);
      let clacked = false, sunkAt = 0;
      const t0 = performance.now();
      const step = (tm) => {
        if (!alive) return;
        const ts = tm - t0, t = ts - STRIKE, f = shot.f;
        f.stick = ts < STRIKE + 220 ? { pull: ts < STRIKE ? 30 * (1 - (ts / STRIKE) ** 2) - 2 : -2, alpha: ts < STRIKE ? 1 : Math.max(0, 1 - (ts - STRIKE) / 220) } : null;
        if (t <= 0) f.cue = L.C;
        else if (!r.hit) f.cue = lerp(L.C, r.cueEnd, out(t / (T1 + T2 * 0.5)));
        else if (t < T1) f.cue = lerp(L.C, r.G, t / T1);
        else {
          if (!clacked) { clacked = true; ctx.sfx.ball(520); }
          const k = out((t - T1) / T2);
          f.cue = lerp(r.G, r.cueEnd, out((t - T1) / (T2 * 0.8)));
          if (r.pocket && k > 0.9) {
            if (!sunkAt) { sunkAt = tm; setTimeout(() => alive && ctx.sfx.pocket(), 110); if (ctx.sfx.buzz) ctx.sfx.buzz(20); }
            const sk = Math.min(1, (tm - sunkAt) / 200), e = 1 - (1 - sk) * (1 - sk), from = lerp(L.O, r.objEnd, 0.9), [px, py] = pocketAt(r.pocket);
            f.ob = null; f.sink = sk < 1 ? { x: from[0] + (px - from[0]) * e, y: from[1] + (py - from[1]) * e, k: 1 - 0.35 * e, a: 1 - sk, d: 0.5 * e } : null;
          } else f.ob = lerp(L.O, r.objEnd, k);
        }
        art.rollTo(0, f.cue[0], f.cue[1]); if (f.ob) art.rollTo(OB, f.ob[0], f.ob[1]);
        draw();
        if (t < T1 + T2 + 250) frame(step); else finish();
      };
      frame(step);
    }

    function finish() {
      if (!alive || phase === 'done') return;
      phase = 'done';
      const r = shot.r;
      if (r.ok) return ctx.result({ ok: true, text: task.explain });
      let why = MSG.miss;
      if (r.hit) why = r.pocket ? MSG.wrongPocket : task.cut === 0 ? MSG.offc : (r.cutDeg < Math.abs(task.cut) ? MSG.thick : MSG.thinMsg);
      showAnswer = true; draw();
      ctx.result({ ok: false, text: { en: `${why.en} ${MSG.see.en} ${task.explain.en}`, de: `${why.de} ${MSG.see.de} ${task.explain.de}` } });
    }

    fit();
    window.__pooltask = { get angle() { return angle; }, set angle(a) { angle = a; draw(); }, answer: L.angle, fire };
    return () => { alive = false; app?.classList.remove('wide'); ro.disconnect(); window.removeEventListener('orientationchange', onTurn); window.removeEventListener('resize', onTurn); };
  },
};

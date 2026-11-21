// FLIP card motion for DOM card games: every card element carries data-k (a stable id).
// Before re-rendering we remember where each card was; after, each card glides from its old place to the new one.
// Cards that appear for the first time come from `origin` (the deck); cards that vanish fly to `discard`.
const EASE = 'cubic-bezier(.2,.75,.25,1)';
export function flipRender(root, build, { origin = null, discard = null, duration = 340, stagger = 70, onBorn = null, order = null } = {}) {
  const before = new Map();
  root.querySelectorAll('[data-k]').forEach((el) => before.set(el.dataset.k, { r: el.getBoundingClientRect(), el: el.cloneNode(true), fs: getComputedStyle(el).fontSize }));
  const originRect = origin ? origin()?.getBoundingClientRect() : null;
  build();
  const seen = new Set();
  const els = [...root.querySelectorAll('[data-k]')];
  els.forEach((el) => seen.add(el.dataset.k));
  // new cards are dealt one after another, in the order the game wants (e.g. alternating players)
  const fresh = els.filter((el) => !before.has(el.dataset.k));
  if (order) fresh.sort((a, b) => order(a) - order(b));
  const bornAt = new Map(fresh.map((el, i) => [el, i]));
  els.forEach((el) => {
    const k = el.dataset.k;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    let from = before.get(k)?.r, delay = 0, isBorn = false;
    if (!from && originRect && originRect.width) { const i = bornAt.get(el); from = originRect; delay = i * stagger; isBorn = true; onBorn && onBorn(i, el); }
    if (!from) return;
    const dx = from.left + from.width / 2 - (r.left + r.width / 2), dy = from.top + from.height / 2 - (r.top + r.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const sc = isBorn ? 1 : Math.min(1.6, Math.max(0.5, from.width / r.width));
    const base = getComputedStyle(el).transform, rest = base && base !== 'none' ? base : '';
    try {
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${sc}) ${rest}`, zIndex: 20 },
        { transform: `translate(${dx * 0.12}px, ${dy * 0.12 - 6}px) scale(1.04) ${rest}`, offset: 0.75, zIndex: 20 },
        { transform: rest || 'none', zIndex: 20 },
      ], { duration, easing: EASE, delay, fill: 'backwards' });
    } catch { /* old browser: no motion */ }
  });
  // cards that left the screen (beaten pile): ghost copies sweep away
  if (discard) {
    let i = 0;
    before.forEach(({ r, el, fs }, k) => {
      if (seen.has(k)) return;
      const to = discard(); if (!to) return;
      const gh = el; gh.removeAttribute('data-k');
      gh.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;font-size:${fs};margin:0;z-index:60;pointer-events:none;transition:none;animation:none`;
      document.body.append(gh);
      const dx = to.x - r.left, dy = to.y - r.top, rot = 25 + Math.random() * 30;
      const a = gh.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.8)`, opacity: 0.0 }],
        { duration: 520, easing: 'cubic-bezier(.4,0,.6,1)', delay: i++ * 40, fill: 'forwards' });
      a.onfinish = () => gh.remove(); setTimeout(() => gh.remove(), 1500);
    });
  }
}

// Canvas view helper for phone-friendly games: crisp at any pixel ratio, fills the space it gets,
// and can turn the table by 90° so a long table always uses the long side of the screen.
// Drawing happens in "table units" (0..TW, 0..TH); the view maps them to the screen.
export function makeView(cv, TW, TH) {
  const v = {
    rot: false, s: 1, dpr: Math.min(2, window.devicePixelRatio || 1),
    // scale that fits the table (turned or not) into bw x bh css pixels
    fit(rot, bw, bh) { return Math.max(0.2, Math.min(bw / (rot ? TH : TW), bh / (rot ? TW : TH))); },
    size(rot, s) {
      v.rot = rot; v.s = s; v.dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.floor((rot ? TH : TW) * s), h = Math.floor((rot ? TW : TH) * s);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * v.dpr); cv.height = Math.round(h * v.dpr);
    },
    apply(g) {
      const k = v.s * v.dpr;
      if (v.rot) g.setTransform(0, k, -k, 0, TH * k, 0); else g.setTransform(k, 0, 0, k, 0, 0);
    },
    // pointer event -> table units
    toLocal(e) {
      const r = cv.getBoundingClientRect(), u = (e.clientX - r.left) / v.s, w = (e.clientY - r.top) / v.s;
      return v.rot ? [w, TH - u] : [u, w];
    },
  };
  return v;
}

// Full-screen helpers (Android/desktop; iPhone falls back to the CSS landscape layout)
export const canFullscreen = () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
export async function toggleFullscreen(el) {
  try {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    await el.requestFullscreen({ navigationUI: 'hide' });
    try { await screen.orientation.lock('landscape'); } catch {}
  } catch {}
}
// one shared media query: phone held sideways
export const phoneLandscape = () => window.matchMedia('(orientation: landscape) and (max-height: 560px)').matches;

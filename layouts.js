// Hero wall layout: Wave. Columns of different widths, each a stack of mixed-shape cards
// (every card keeps its item's own ratio), sliding up and sideways with a slow swell through it.
// build(G) -> card specs. place(spec, t, G) -> {x, y, z, ry, rx} or null (hidden).
// t = { turn: degrees from drag/edge/wheel, drift: px of time-based travel, tilt: px from mouse y }.

const RAD = Math.PI / 180;
const wrap = (v, len) => ((v % len) + len) % len;
const hash = (n) => { const s = Math.sin(n * 91.345) * 47453.5453; return s - Math.floor(s); };
const COLS = [1, 0.7, 1.5, 0.9, 1.2, 0.75, 1.8, 1.05, 0.8, 1.35]; // column widths, × G.W

export const wave = {
  build(G) {
    const gap = G.GAP * 1.4, spanW = innerWidth * 2, len = innerHeight * 2.1, out = [];
    let x = 0, c = 0, n = 0;
    while (x < spanW) {
      const w = Math.round(G.W * COLS[c % COLS.length]), col = [];
      let y = 0;
      while (y < len) {
        // Stride 5 must share no factor with the item count, or only a few items ever show.
        const item = (n++ * 5) % G.items.length, h = Math.round(w / G.items[item].ratio);
        col.push({ w, h, x: x + w / 2, y: y + h / 2, item });
        y += h + gap;
      }
      const off = hash(c + 3) * y;
      for (const s of col) Object.assign(s, { len: y, off });
      out.push(...col);
      x += w + gap; c++;
    }
    for (const s of out) s.span = x;
    return out;
  },
  place(s, t, G) {
    const x = wrap(s.x + t.turn * RAD * G.R, s.span) - s.span / 2;
    const y = wrap(s.y + s.off - t.drift * 0.6, s.len) - s.len / 2 + t.tilt * 0.5;
    if (Math.abs(x) - s.w / 2 > innerWidth * 0.8 || Math.abs(y) - s.h / 2 > innerHeight * 0.8) return null;
    const ph = x * 0.004 + y * 0.006 - t.drift * 0.05, A = G.R * 0.16; // swell
    return { x, y, z: -G.P * 0.28 + A * Math.sin(ph), ry: -Math.cos(ph) * 14, rx: Math.cos(ph) * 10 };
  },
};

// Hero wall layout: Tunnel. Rings of cards line an oval tunnel you look down into; they drift
// toward you and wrap back to the far end. turn spins the tunnel. Cards are angled toward the
// middle but capped at 50°, so none goes edge-on.
const SLOTS = 14, PER = 9;
export const tunnel = {
  build(G) {
    const out = [], D = G.P * 0.3; // depth between rings
    let n = 0;
    for (let r = 0; r < SLOTS; r++) {
      for (let i = 0; i < PER; i++) {
        const item = (n * 5) % G.items.length, w = Math.round(G.W * 0.9 * COLS[n % COLS.length]);
        out.push({ w, h: Math.round(w / G.items[item].ratio), a: (i / PER) * 360 + r * 37 + hash(n) * 14, z0: r * D, len: SLOTS * D, item });
        n++;
      }
    }
    return out;
  },
  place(s, t, G) {
    const a = (s.a + t.turn * 0.6) * RAD, ex = innerWidth * 0.46, ey = innerHeight * 0.44;
    const z = wrap(s.z0 + t.drift * 5, s.len) - s.len + G.P * 0.62; // far end .. just past the camera
    const x = Math.cos(a) * (ex + s.w * 0.3), y = Math.sin(a) * (ey + s.h * 0.3);
    const fade = Math.min(1, ((z + s.len - G.P * 0.62) / (G.P * 2.2)) ** 2); // far cards fade in, so the middle stays calm
    return { x, y, z, ry: Math.cos(a) * -50, rx: Math.sin(a) * 50, fade };
  },
};

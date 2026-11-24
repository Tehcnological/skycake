// The contour lines behind SkyCake Viewer's start screen, as SVG text. scripts/app.mjs writes them into www/ and
// app/app.css uses them as backgrounds. A made-up landscape, the same on every build; not chart data.
import assert from "node:assert/strict";

const RIPPLE = 10; // seconds for the brightening to pass through every height once
// Brightness steps per half ripple. A picture used as a background is redrawn whole on every change, so the ripple
// moves in steps too small to see (under 2% each, 5.6 a second) instead of on every frame, which cost about a tenth of
// a processor core. 28 is a multiple of 7: the heights' delays are then whole steps, and all seven change together.
const STEPS = 28;
const STEP = 3; // px, the grid the lines are traced on

// Sizes in CSS px. The lines fade out with distance from `fade`, the top right corner, before the picture's other
// edges and before a card's buttons (they start 70px down). The colours are literal because a background picture
// cannot read the page's variables: each sits just above --divider in app/app.css.
const SURFACES = {
  page: { w: 480, h: 360, seed: 111, scale: 0.08, color: "#323232", fade: { cx: 480, cy: 0, r: 350 } },
  card: { w: 200, h: 90, seed: 112, scale: 0.2, color: "#383838", fade: { cx: 200, cy: 0, r: 68 } },
};

// mulberry32: the same picture on every build.
const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// A smooth field, about 0.2 to 0.8: five long waves added up. A bigger `scale` gives smaller features.
function field(seed, scale) {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, () => [(r() - 0.5) * scale, (r() - 0.5) * scale, r() * 6.28, 0.5 + r()]);
  const total = waves.reduce((s, w) => s + w[3], 0);
  return (x, y) => 0.5 + (0.5 * waves.reduce((s, [kx, ky, p, a]) => s + a * Math.sin(kx * x + ky * y + p), 0)) / total;
}

// The lines where f equals `level`, each a list of [x, y]: marching squares on the grid, pieces joined end to end.
function lines(f, w, h, level, step = STEP) {
  const val = (i, j) => f(i * step, j * step) - level;
  // A crossing sits on a grid edge: "h,i,j" runs right from corner (i, j), "v,i,j" runs down from it.
  const point = (id) => { const [d, i, j] = id.split(",").map((s, n) => (n ? +s : s)); const a = val(i, j), b = d === "h" ? val(i + 1, j) : val(i, j + 1), t = a / (a - b); return d === "h" ? [(i + t) * step, j * step] : [i * step, (j + t) * step]; };
  const links = new Map();
  const link = (a, b) => { for (const [p, q] of [[a, b], [b, a]]) links.set(p, [...(links.get(p) ?? []), q]); };
  for (let j = 0; j < Math.ceil(h / step); j++) for (let i = 0; i < Math.ceil(w / step); i++) {
    const tl = val(i, j), tr = val(i + 1, j), bl = val(i, j + 1), br = val(i + 1, j + 1);
    const crossed = [[`h,${i},${j}`, tl, tr], [`v,${i + 1},${j}`, tr, br], [`h,${i},${j + 1}`, bl, br], [`v,${i},${j}`, tl, bl]].filter(([, a, b]) => a > 0 !== b > 0).map(([id]) => id);
    if (crossed.length >= 2) link(crossed[0], crossed[1]);
    if (crossed.length === 4) link(crossed[2], crossed[3]); // a saddle: either pairing will do
  }
  const seen = new Set();
  const walk = (start) => { const line = [start]; seen.add(start); for (let at = start, next; (next = links.get(at).find((n) => !seen.has(n))); at = next) { seen.add(next); line.push(next); } return line; };
  const out = [];
  for (const [id, to] of links) if (to.length === 1 && !seen.has(id)) out.push(walk(id)); // open lines, from one end
  for (const id of links.keys()) if (!seen.has(id)) { const ring = walk(id); out.push([...ring, ring[0]]); } // closed rings
  return out.map((line) => line.map(point));
}

// The picture for "page" or "card". Moving: each height brightens in turn. Still: no animation at all, for reduced
// motion and accessibility mode.
export function contours(surface, moving) {
  assert.ok(Object.hasOwn(SURFACES, surface), `no such surface: ${surface}`);
  const { w, h, seed, scale, color, fade } = SURFACES[surface];
  const f = field(seed, scale);
  const levels = [1, 2, 3, 4, 5, 6, 7].map((k) => lines(f, w, h, k / 8));
  assert.ok(levels.flat().length > 3, `${surface}: almost no contour lines`);
  // The grid's last cell may overhang the picture by one step; the viewBox clips it.
  for (const [x, y] of levels.flat(2)) assert.ok(x >= 0 && x <= w + STEP && y >= 0 && y <= h + STEP, `${surface}: a point at ${x}, ${y}`);
  const groups = levels.map((level, n) => `<g${moving ? ` style="animation-delay:-${((n * RIPPLE) / levels.length).toFixed(4)}s"` : ""}>${level.map((line) => `<path d="M${line.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}"/>`).join("")}</g>`).join("");
  const style = moving ? `@keyframes t{50%{opacity:1}}g{opacity:.5;animation:t ${RIPPLE}s steps(${STEPS}) infinite}` : "g{opacity:.8}";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="url(#c)" stroke-linecap="round" stroke-linejoin="round"><defs><radialGradient id="c" gradientUnits="userSpaceOnUse" cx="${fade.cx}" cy="${fade.cy}" r="${fade.r}"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><style>${style}</style>${groups}</svg>`;
}

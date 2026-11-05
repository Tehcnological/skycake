/** 33°26.5'N, 112°02.0'W, 33°26'N: degrees north or east, negative south or west. */
export function labelValue(text) {
    const m = text.replace(/\s/g, "").match(/^(\d{1,3})°(\d{1,2}(?:\.\d+)?)['’]([NSEW])$/);
    if (!m)
        return null;
    const v = Number(m[1]) + Number(m[2]) / 60;
    return { kind: m[3] === "N" || m[3] === "S" ? "lat" : "lon", value: m[3] === "S" || m[3] === "W" ? -v : v };
}
// Many diagrams turn their text into outlines, one to a character. Same font every time, so each character has one
// shape. A misread can't place a diagram: its label would miss the fit in fitLabels.
const OUTLINES = {
    "96/2": "0", "46/1": "2", "97/1": "3", "13/2": "4", "66/1": "5", "68/2": "6", "124/3": "8",
    "32/2": "°", "4/1": "'", "16/1": ".", "8/1": "N", "10/1": "W",
};
const char = (g) => {
    const w = g.x1 - g.x0, h = g.y1 - g.y0;
    // 1 and 7 have the same segments; a 1 is much the narrower.
    if (g.segs === 6 && g.subs === 1)
        return Math.min(w, h) / Math.max(w, h) < 0.5 ? "1" : "7";
    return OUTLINES[`${g.segs}/${g.subs}`] ?? "?";
};
/** Tick labels among outlines in drawing order, on a page with y running down: runs of touching characters that read as 33°26.5'N. */
export function readOutlines(glyphs) {
    const size = (g) => Math.max(g.x1 - g.x0, g.y1 - g.y0);
    const center = (g) => [(g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2];
    const labels = [];
    let start = 0;
    for (let i = 1; i <= glyphs.length; i++) {
        if (i < glyphs.length) {
            const [ax, ay] = center(glyphs[i - 1]), [bx, by] = center(glyphs[i]);
            if (Math.hypot(ax - bx, ay - by) <= 2 * Math.max(size(glyphs[i - 1]), size(glyphs[i])))
                continue;
        }
        const run = glyphs.slice(start, i);
        for (const m of run.map(char).join("").matchAll(/\d{1,3}°\d{1,2}(?:\.\d+)?'[NW]/g)) {
            const box = run.slice(m.index, m.index + m[0].length);
            // A 9 is a 6 turned over: the same outline with its hole at the top. Up is a quarter turn left of the reading direction.
            const [fx, fy] = center(box[0]), [lx, ly] = center(box[box.length - 1]);
            const text = [...m[0]].map((c, k) => {
                const g = box[k];
                if (c !== "6" || !g.hole)
                    return c;
                const [cx, cy] = center(g);
                return (g.hole[0] - cx) * (ly - fy) - (g.hole[1] - cy) * (lx - fx) > 0 ? "9" : "6";
            }).join("");
            const round = (v) => Math.round(v * 1e3) / 1e3;
            labels.push({
                x: round((Math.min(...box.map((g) => g.x0)) + Math.max(...box.map((g) => g.x1))) / 2),
                y: round((Math.min(...box.map((g) => g.y0)) + Math.max(...box.map((g) => g.y1))) / 2),
                text,
            });
        }
        start = i;
    }
    return labels;
}
function line(pts) {
    const values = new Set(pts.map((p) => p.value));
    if (values.size < 2)
        return null;
    const spread = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));
    const along = spread("x") > spread("y") ? "x" : "y";
    const n = pts.length, sx = pts.reduce((s, p) => s + p[along], 0), sv = pts.reduce((s, p) => s + p.value, 0);
    const sxx = pts.reduce((s, p) => s + p[along] ** 2, 0), sxv = pts.reduce((s, p) => s + p[along] * p.value, 0);
    const b = (n * sxv - sx * sv) / (n * sxx - sx * sx);
    return { along, a: (sv - b * sx) / n, b };
}
/**
 * Page position to latitude and longitude from the tick labels, or null when the labels don't make a trustworthy
 * north-aligned, true-scale map: too few, on the same axis, a label more than 100 ft off the fit, or the two scales
 * more than 3% apart.
 */
export function fitLabels(labels) {
    const pts = labels.flatMap((l) => {
        const v = labelValue(l.text);
        return v ? [{ ...v, x: l.x, y: l.y }] : [];
    });
    const lat = line(pts.filter((p) => p.kind === "lat")), lon = line(pts.filter((p) => p.kind === "lon"));
    if (!lat || !lon || lat.along === lon.along)
        return null;
    const at = (ax, p) => ax.a + ax.b * p[ax.along];
    const midLat = (Math.max(...pts.filter((p) => p.kind === "lat").map((p) => p.value)) + Math.min(...pts.filter((p) => p.kind === "lat").map((p) => p.value))) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const error = Math.max(...pts.map((p) => Math.abs(at(p.kind === "lat" ? lat : lon, p) - p.value) * (p.kind === "lat" ? 1 : k) * 60 * 6076));
    if (error > 100)
        return null;
    if (Math.abs(Math.abs(lon.b * k) / Math.abs(lat.b) - 1) > 0.03)
        return null;
    return { lat, lon, error: Math.round(error) };
}
export const latLon = (f, x, y) => [f.lat.a + f.lat.b * (f.lat.along === "x" ? x : y), f.lon.a + f.lon.b * (f.lon.along === "x" ? x : y)];
/** Clockwise turn, in degrees, that puts north at the top of the page image. */
export function northUp(f) {
    // Page y runs down. North is the way latitude grows.
    if (f.lat.along === "y")
        return f.lat.b < 0 ? 0 : 180;
    return f.lat.b < 0 ? 90 : 270;
}
/** The map area covered by a rectangle of the page. */
export function boundsOf(f, x0, y0, x1, y1) {
    const c = [latLon(f, x0, y0), latLon(f, x1, y1)];
    return { s: Math.min(c[0][0], c[1][0]), n: Math.max(c[0][0], c[1][0]), w: Math.min(c[0][1], c[1][1]), e: Math.max(c[0][1], c[1][1]) };
}
/**
 * The diagram's frame in a rendered page (RGBA): the outermost rows and columns with a dark line across most of the
 * page. Inside it are the airport and its notes; outside are the title, dates and margins.
 */
export function frame(rgba, w, h) {
    const dark = (i) => rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2] < 240;
    const longest = (n, at) => {
        let best = 0, run = 0;
        for (let i = 0; i < n; i++) {
            run = dark(at(i)) ? run + 1 : 0;
            best = Math.max(best, run);
        }
        return best;
    };
    const rows = [...Array(h).keys()].filter((y) => longest(w, (x) => y * w + x) > w * 0.6);
    const cols = [...Array(w).keys()].filter((x) => longest(h, (y) => y * w + x) > h * 0.6);
    if (rows.length < 2 || cols.length < 2)
        return [0, 0, w, h];
    // Just inside the lines.
    return [cols[0] + 3, rows[0] + 3, cols[cols.length - 1] - 3, rows[rows.length - 1] - 3];
}

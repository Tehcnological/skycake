import { approachName, cifpFixKey, cifpPositions, cifpRole, nm } from "./cifp.js";
// shortcut: climb legs assume this gradient and turns are corners, since the file gives no speed; true fly-by paths
// need a performance model.
const CLIMB_FT_PER_NM = 300;
const HOLD_NM_PER_MIN = 2.5;
const HOLD_RADIUS_NM = 1;
/** Legs that end in radar vectors (VM, FM) are drawn this far, then the next leg goes direct. */
const VECTORS_NM = 2.5;
const tenths = (s) => (/^\d+$/.test(s.trim()) ? Number(s) / 10 : null);
const level = (s) => (/^FL\d{3}$/.test(s) ? Number(s.slice(2)) * 100 : /^\d{5}$/.test(s) ? Number(s) : null);
const shown = (s) => (s.startsWith("FL") ? s : String(Number(s)));
/** A leg's altitude constraint as the chart gives it, and the height the path is drawn at. */
export function constraint(l) {
    const [desc, a1, a2] = [l[82], l.slice(84, 89).trim(), l.slice(89, 94).trim()];
    const [f1, f2] = [level(a1), level(a2)];
    if (f1 === null)
        return { alt: null, ft: null };
    // A window: at or above the second, at or below the first.
    if (desc === "B" && f2 !== null)
        return { alt: `${shown(a2)} to ${shown(a1)}`, ft: f2 };
    return { alt: `${shown(a1)}${desc === "+" || desc === "-" ? desc : ""}`, ft: f1 };
}
function coord(s) {
    const n = s.length - 6;
    const v = Number(s.slice(1, n)) + Number(s.slice(n, n + 2)) / 60 + Number(s.slice(n + 2)) / 360000;
    return s[0] === "S" || s[0] === "W" ? -v : v;
}
function row(l, airport, at) {
    const fix = l.slice(29, 34).trim();
    const angle = Number(l.slice(102, 106));
    const navId = l.slice(50, 54).trim(), navSec = l.slice(78, 80);
    const ctrId = l.slice(106, 111).trim(), ctrSec = l.slice(114, 116);
    const key = (sec, id, region) => (sec[0] === "P" ? `${sec}|${airport}|${id}` : `${sec}|${id}|${region}`);
    return {
        fix,
        pos: fix ? at.get(cifpFixKey(l, airport, fix)) : undefined,
        pt: l.slice(47, 49),
        turn: l[43],
        course: tenths(l.slice(70, 74)),
        dist: l.slice(74, 78).trim(),
        ...constraint(l),
        role: cifpRole(l),
        angle: angle ? Math.abs(angle) / 100 : null,
        nav: navId ? at.get(key(navSec, navId, l.slice(54, 56))) : undefined,
        center: ctrId ? at.get(key(ctrSec, ctrId, l.slice(112, 114))) : undefined,
    };
}
/** A flat local grid: nautical miles east and north of the airport. */
function grid(airport, variation) {
    const k = Math.cos((airport[0] * Math.PI) / 180);
    const to = (lat, lon) => [(lon - airport[1]) * 60 * k, (lat - airport[0]) * 60];
    const back = (x, y, ft) => [Math.round((airport[0] + y / 60) * 1e5) / 1e5, Math.round((airport[1] + x / 60 / k) * 1e5) / 1e5, Math.round(ft)];
    const dir = (magnetic) => {
        const a = ((magnetic + variation) * Math.PI) / 180;
        return [Math.sin(a), Math.cos(a)];
    };
    return { to, back, dir };
}
/**
 * Walks legs into a path. Heights come from the constraints; between them the path runs straight, by distance flown,
 * so a climb or descent spreads over the legs between two constraints. Before the first constraint the path holds
 * `seed` (or the first constraint), after the last it holds the last.
 */
export function walk(rows, g, start, seed) {
    const xy = [];
    const fts = [];
    let [x, y] = start ? g.to(start[0], start[1]) : [0, 0];
    let known = start ? start[2] : null; // last height set, for climb legs
    const go = (nx, ny, ft) => {
        if (xy.length && Math.hypot(nx - x, ny - y) < 0.01) {
            if (ft !== null)
                fts[fts.length - 1] = ft;
        }
        else {
            xy.push([nx, ny]);
            fts.push(ft);
        }
        [x, y] = [nx, ny];
        if (ft !== null)
            known = ft;
    };
    if (start)
        go(x, y, start[2]);
    const toFix = (r, ft = r.ft) => {
        const [fx, fy] = g.to(r.pos[0], r.pos[1]);
        go(fx, fy, ft);
    };
    const climb = (course, target) => {
        const [dx, dy] = g.dir(course);
        const run = Math.max((target - (known ?? target)) / CLIMB_FT_PER_NM, 0.5);
        go(x + dx * run, y + dy * run, target);
    };
    const run = (course, n) => {
        const [dx, dy] = g.dir(course);
        go(x + dx * n, y + dy * n, null);
    };
    rows.forEach((r, i) => {
        const started = xy.length > 0;
        // A path that starts with a leg from a fix (FA, FC, FM, PI, holds) starts at that fix.
        if (!started && r.pos && r.pt !== "VI" && r.pt !== "VA" && r.pt !== "CA" && r.pt !== "VM" && r.pt !== "VD")
            toFix(r);
        switch (r.pt) {
            case "CA":
            case "VA":
                if (r.course !== null && r.ft !== null)
                    climb(r.course, r.ft);
                return;
            case "FA":
                // From the fix when the path starts there; after a runway, a fix far away is only the course's reference.
                if (r.course !== null && r.ft !== null)
                    climb(r.course, r.ft);
                return;
            case "FC": {
                const d = tenths(r.dist);
                if (started && r.pos)
                    toFix(r, null);
                if (r.course !== null && d)
                    run(r.course, d);
                if (r.ft !== null)
                    fts[fts.length - 1] = r.ft;
                return;
            }
            case "VD":
            case "CD": {
                const d = tenths(r.dist);
                if (r.course === null || !d)
                    return;
                const [dx, dy] = g.dir(r.course);
                let t = d;
                if (r.nav) {
                    // Out along the course until the navaid is that far away.
                    const [nx, ny] = g.to(r.nav[0], r.nav[1]);
                    const b = dx * (x - nx) + dy * (y - ny), c = (x - nx) ** 2 + (y - ny) ** 2 - d * d;
                    const roots = b * b - c >= 0 ? [-b - Math.sqrt(b * b - c), -b + Math.sqrt(b * b - c)].filter((v) => v > 0.05) : [];
                    t = roots.length ? Math.min(...roots) : 1;
                }
                go(x + dx * t, y + dy * t, r.ft);
                return;
            }
            case "VI":
            case "CI": {
                // Heading to the next leg's course; without a forward crossing the next leg just goes direct.
                const next = rows[i + 1];
                if (r.course === null || !next?.pos || next.course === null)
                    return;
                const [dx, dy] = g.dir(r.course);
                const [cx, cy] = g.dir(next.course);
                const [fx, fy] = g.to(next.pos[0], next.pos[1]);
                const det = dx * -cy - -cx * dy;
                const t = Math.abs(det) < 1e-6 ? -1 : ((fx - x) * -cy - -cx * (fy - y)) / det;
                if (t > 0)
                    go(x + dx * t, y + dy * t, null);
                return;
            }
            case "VM":
            case "FM":
                if (r.pt === "FM" && started && r.pos)
                    toFix(r);
                if (r.course !== null)
                    run(r.course, VECTORS_NM);
                return;
            case "RF":
                if (r.pos && r.center)
                    arc(r);
                else if (r.pos)
                    toFix(r);
                return;
            case "PI":
                if (r.pos) {
                    if (started)
                        toFix(r);
                    procedureTurn(r);
                }
                return;
            case "HM":
            case "HF":
            case "HA":
                if (r.pos) {
                    if (started)
                        toFix(r);
                    if (r.course !== null)
                        hold(r);
                }
                return;
            default:
                if (r.pos && started)
                    toFix(r);
        }
    });
    // Heights between constraints, by distance flown.
    const along = [0];
    for (let i = 1; i < xy.length; i++)
        along.push(along[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
    const set = fts.map((f, i) => (f === null ? -1 : i)).filter((i) => i >= 0);
    const first = set.length ? fts[set[0]] : (seed ?? 0);
    const out = xy.map(([px, py], i) => {
        let ft = fts[i];
        if (ft === null) {
            const before = set.filter((j) => j < i).pop(), after = set.find((j) => j > i);
            if (before === undefined)
                ft = seed ?? first;
            else if (after === undefined)
                ft = fts[before];
            else
                ft = fts[before] + ((fts[after] - fts[before]) * (along[i] - along[before])) / (along[after] - along[before] || 1);
        }
        return g.back(px, py, ft);
    });
    return out;
    // Racetrack from the fix: turn past it, fly the outbound leg, turn back, fly inbound to it.
    function hold(r) {
        const [fx, fy] = [x, y];
        const ft = r.ft ?? known;
        const [dx, dy] = g.dir(r.course);
        const side = r.turn === "L" ? -1 : 1;
        const [rx, ry] = [dy * side, -dx * side]; // to the turn side of the inbound course
        const legNm = r.dist[0] === "T" ? (Number(r.dist.slice(1)) / 10) * HOLD_NM_PER_MIN : Number(r.dist) / 10 || HOLD_NM_PER_MIN;
        const R = HOLD_RADIUS_NM;
        const semi = (cx, cy, sign) => {
            for (let i = 1; i <= 8; i++) {
                const a = (i / 8) * Math.PI;
                go(cx + sign * (rx * R * (1 - Math.cos(a)) + dx * R * Math.sin(a)), cy + sign * (ry * R * (1 - Math.cos(a)) + dy * R * Math.sin(a)), ft);
            }
        };
        semi(fx, fy, 1);
        const [bx, by] = [fx + rx * 2 * R - dx * legNm, fy + ry * 2 * R - dy * legNm];
        go(bx, by, ft);
        semi(bx, by, -1);
        go(fx, fy, ft);
    }
    // Radius to fix: around the center, in the leg's turn direction.
    function arc(r) {
        const [cx, cy] = g.to(r.center[0], r.center[1]);
        const [ex, ey] = g.to(r.pos[0], r.pos[1]);
        const a0 = Math.atan2(y - cy, x - cx), a1 = Math.atan2(ey - cy, ex - cx);
        const r0 = Math.hypot(x - cx, y - cy), r1 = Math.hypot(ex - cx, ey - cy);
        let sweep = a1 - a0;
        // Right turns run clockwise on the map, which is a falling angle here.
        if (r.turn === "R")
            while (sweep > 0)
                sweep -= 2 * Math.PI;
        else
            while (sweep < 0)
                sweep += 2 * Math.PI;
        const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 18)));
        for (let i = 1; i < steps; i++) {
            const a = a0 + (sweep * i) / steps, rr = r0 + ((r1 - r0) * i) / steps;
            go(cx + rr * Math.cos(a), cy + rr * Math.sin(a), null);
        }
        go(ex, ey, r.ft);
    }
    // Procedure turn from the fix: outbound, the 45 degree leg on the record's course, a turn back, and in to the inbound
    // course. The record's turn direction is the turn back, so the 45 degree turn went the other way.
    function procedureTurn(r) {
        if (r.course === null)
            return;
        const [fx, fy] = [x, y];
        const ft = r.ft ?? known;
        const inbound = g.dir((r.turn === "L" ? r.course - 45 : r.course + 45) + 180);
        const [ax, ay] = [fx - inbound[0] * 2, fy - inbound[1] * 2];
        go(ax, ay, ft);
        const [dx, dy] = g.dir(r.course);
        const [bx, by] = [ax + dx * 2, ay + dy * 2];
        go(bx, by, ft);
        const side = r.turn === "R" ? 1 : -1;
        const [ox, oy] = [bx + dy * side, by - dx * side];
        go(ox, oy, ft);
        // Back on the reciprocal until the inbound course.
        const det = -dx * -inbound[1] - -inbound[0] * -dy;
        const t = Math.abs(det) < 1e-6 ? -1 : ((fx - ox) * -inbound[1] - -inbound[0] * (fy - oy)) / det;
        if (t > 0)
            go(ox - dx * t, oy - dy * t, ft);
    }
}
/** Liang-Barsky, piece by piece: the parts of a path inside the bounds, cut exactly at the edge. */
export function clipPath(pts, b) {
    const out = [];
    let cur = [];
    const lerp = (p, q, t) => [
        Math.round((p[0] + (q[0] - p[0]) * t) * 1e5) / 1e5,
        Math.round((p[1] + (q[1] - p[1]) * t) * 1e5) / 1e5,
        Math.round(p[2] + (q[2] - p[2]) * t),
    ];
    const flush = () => {
        if (cur.length >= 2)
            out.push(cur);
        cur = [];
    };
    for (let i = 0; i < pts.length - 1; i++) {
        const [p, q] = [pts[i], pts[i + 1]];
        let t0 = 0, t1 = 1;
        const dLat = q[0] - p[0], dLon = q[1] - p[1];
        const edges = [[-dLat, p[0] - b.s], [dLat, b.n - p[0]], [-dLon, p[1] - b.w], [dLon, b.e - p[1]]];
        let inside = true;
        for (const [pp, qq] of edges) {
            if (pp === 0) {
                if (qq < 0)
                    inside = false;
            }
            else {
                const t = qq / pp;
                if (pp < 0)
                    t0 = Math.max(t0, t);
                else
                    t1 = Math.min(t1, t);
            }
        }
        if (!inside || t0 > t1) {
            flush();
            continue;
        }
        const a = t0 === 0 ? p : lerp(p, q, t0), c = t1 === 1 ? q : lerp(p, q, t1);
        if (!cur.length)
            cur.push(a);
        else if (t0 > 0) {
            flush();
            cur.push(a);
        }
        cur.push(c);
        if (t1 < 1)
            flush();
    }
    flush();
    return out;
}
const SID_ROUTE = { runway: "14FT", common: "25M", enroute: "36SV" };
const STAR_ROUTE = { enroute: "147F", common: "258M", runway: "369S" };
/** Every airport inside the bounds with its approaches, departures and arrivals, each cut to the bounds. */
export function parseProcedures(text, b) {
    const lines = text.split(/\r?\n/).filter((l) => l[0] === "S");
    const at = cifpPositions(lines);
    const inside = (lat, lon) => lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
    const airports = [];
    const procedures = [];
    const recs = new Map();
    for (const l of lines) {
        if (l[4] !== "P")
            continue;
        const id = l.slice(6, 10).trim();
        let r = recs.get(id);
        if (!r)
            recs.set(id, (r = { apt: [], rwy: [], procs: [] }));
        if (l[12] === "A")
            r.apt.push(l);
        else if (l[12] === "G")
            r.rwy.push(l);
        else if ("DEF".includes(l[12]) && "01".includes(l[38]))
            r.procs.push(l);
    }
    for (const [id, r] of recs) {
        const rec = r.apt[0];
        if (!rec || !r.procs.length)
            continue;
        const apt = [coord(rec.slice(32, 41)), coord(rec.slice(41, 51))];
        if (!inside(apt[0], apt[1]))
            continue;
        const elev = Number(rec.slice(56, 61)) || 0;
        // The airport itself, for the vectors legs that name it.
        at.set(`PA|${id}|${id}`, apt);
        const variation = (rec[51] === "W" ? -1 : 1) * (Number(rec.slice(52, 56)) / 10);
        const g = grid(apt, variation);
        const runways = new Map(r.rwy.map((l) => [l.slice(13, 18).trim(), [coord(l.slice(32, 41)), coord(l.slice(41, 51)), Number(l.slice(66, 71)) || elev]]));
        const mine = parse(id, r.procs, g, elev, runways, (l) => row(l, id, at), b, inside);
        if (!mine.length)
            continue;
        procedures.push(...mine);
        airports.push({ id, name: rec.slice(93, 123).trim(), lat: apt[0], lon: apt[1], elev, procedures: mine.map((p) => ({ type: p.type, name: p.name })) });
    }
    return { airports: airports.sort((a, c) => a.id.localeCompare(c.id)), procedures };
}
/** The departure end of a runway: the opposite threshold, at this one's elevation. */
function departureEnd(rw, runways) {
    const m = rw.match(/^RW(\d\d)([LRC]?)$/);
    const own = runways.get(rw);
    if (!m || !own)
        return null;
    const n = ((Number(m[1]) + 17) % 36) + 1;
    const other = runways.get(`RW${String(n).padStart(2, "0")}${{ L: "R", R: "L", C: "C" }[m[2]] ?? ""}`);
    return other ? [other[0], other[1], own[2]] : own;
}
function parse(airport, lines, g, elev, runways, toRow, b, inside) {
    const groups = new Map();
    for (const l of lines) {
        const key = `${l[12]}|${l.slice(13, 19).trim()}`;
        groups.set(key, [...(groups.get(key) ?? []), l]);
    }
    const out = [];
    for (const [key, recs] of groups) {
        const [sub, id] = key.split("|");
        // Pieces in record order: route type and transition name.
        const pieces = new Map();
        for (const l of recs) {
            const k = `${l[19]}|${l.slice(20, 25).trim()}`;
            if (!pieces.has(k))
                pieces.set(k, { type: l[19], trans: l.slice(20, 25).trim(), rows: [] });
            pieces.get(k).rows.push(toRow(l));
        }
        const all = [...pieces.values()];
        const fallback = all.flatMap((p) => p.rows).find((r) => r.ft !== null)?.ft ?? elev + 3000;
        const walked = [];
        let course = null, glidepath = null, fafToMap = null;
        const last = (p) => p[p.length - 1];
        if (sub === "F") {
            const main = all.filter((p) => p.type !== "A").flatMap((p) => p.rows);
            const m = main.findIndex((r) => r.role === "MAP" && r.pos);
            if (m < 0)
                continue;
            const finalRows = main.slice(0, m + 1), missedRows = main.slice(m + 1);
            for (const p of all.filter((p) => p.type === "A"))
                walked.push({ seg: "transition", rows: p.rows, pts: walk(p.rows, g, undefined, fallback), role: true });
            const final = walk(finalRows, g, undefined, fallback);
            walked.push({ seg: "final", rows: finalRows, pts: final, role: true });
            if (final.length)
                walked.push({ seg: "missed", rows: missedRows, pts: walk(missedRows, g, last(final)), role: false });
            const faf = finalRows.find((r) => r.role === "FAF" && r.pos);
            const map = finalRows[m];
            if (faf?.pos && map.pos) {
                const [ax, ay] = g.to(faf.pos[0], faf.pos[1]), [bx, by] = g.to(map.pos[0], map.pos[1]);
                const bearing = ((Math.atan2(bx - ax, by - ay) * 180) / Math.PI + 720) % 360;
                // grid() turns magnetic into true; undo it for the course.
                const variation = (Math.atan2(...g.dir(0)) * 180) / Math.PI;
                course = map.course !== null ? Math.round(map.course) : Math.round((bearing - variation + 720) % 360);
                fafToMap = Math.round(nm(faf.pos[0], faf.pos[1], map.pos[0], map.pos[1]) * 10) / 10;
            }
            else if (map.course !== null)
                course = Math.round(map.course);
            const angles = finalRows.map((r) => r.angle).filter((a) => a !== null);
            glidepath = angles.length ? Math.max(...angles) : null;
        }
        else if (sub === "D") {
            // Departures: runway transitions from the departure end, then the common route, then the enroute transitions.
            const runwayPieces = all.filter((p) => SID_ROUTE.runway.includes(p.type));
            let end;
            for (const p of runwayPieces) {
                const m = p.trans.match(/^RW(\d\d)([LRCB]?)$/);
                const names = !m ? [] : m[2] === "B" ? ["L", "R", "C"].map((s) => `RW${m[1]}${s}`).filter((n) => runways.has(n)) : [p.trans];
                for (const n of names) {
                    const start = departureEnd(n, runways);
                    if (!start)
                        continue;
                    const pts = walk(p.rows, g, start);
                    walked.push({ seg: "transition", rows: p.rows, pts, role: false });
                    end ??= pts.length ? last(pts)[2] : undefined;
                }
            }
            for (const p of all.filter((p) => SID_ROUTE.common.includes(p.type))) {
                // A common route that starts with a heading leg starts at the airport.
                const start = p.rows[0]?.pos ? undefined : [...g.back(0, 0, elev)];
                const pts = walk(p.rows, g, start, end ?? fallback);
                walked.push({ seg: "common", rows: p.rows, pts, role: false });
                if (pts.length)
                    end = last(pts)[2];
            }
            for (const p of all.filter((p) => SID_ROUTE.enroute.includes(p.type)))
                walked.push({ seg: "transition", rows: p.rows, pts: walk(p.rows, g, undefined, end ?? fallback), role: false });
            // Many departures from the satellite fields start with radar vectors to the first fix, which the CIFP doesn't
            // code: nothing would leave the airport. Join the field to where the coded route starts, climbing from the field.
            const fromField = walked.some((w) => w.pts.length && Math.hypot(...g.to(w.pts[0][0], w.pts[0][1])) < 1.5);
            const first = walked.find((w) => w.seg === "common" && w.pts.length) ?? walked.find((w) => w.pts.length);
            if (!fromField && first)
                walked.unshift({ seg: "vectors", rows: [], pts: [g.back(0, 0, elev), first.pts[0]], role: false });
        }
        else {
            // Arrivals: enroute transitions, the common route, then the runway transitions.
            let end;
            for (const p of all.filter((p) => STAR_ROUTE.enroute.includes(p.type)))
                walked.push({ seg: "transition", rows: p.rows, pts: walk(p.rows, g, undefined, fallback), role: false });
            const enrouteEnd = walked.map((w) => w.pts).filter((p) => p.length).map((p) => last(p)[2])[0];
            for (const p of all.filter((p) => STAR_ROUTE.common.includes(p.type))) {
                const pts = walk(p.rows, g, undefined, enrouteEnd ?? fallback);
                walked.push({ seg: "common", rows: p.rows, pts, role: false });
                if (pts.length)
                    end = last(pts)[2];
            }
            const runwayWalked = [];
            for (const p of all.filter((p) => STAR_ROUTE.runway.includes(p.type))) {
                const pts = walk(p.rows, g, undefined, end ?? enrouteEnd ?? fallback);
                walked.push({ seg: "transition", rows: p.rows, pts, role: false });
                if (pts.length)
                    runwayWalked.push(pts);
            }
            // An arrival ends at a fix or in vectors, usually miles out. Join each place it ends to the field, down to the
            // field: the runway transitions where there are any, else the common route, else the enroute transitions.
            const common = walked.filter((w) => w.seg === "common" && w.pts.length).map((w) => w.pts);
            const ends = (runwayWalked.length ? runwayWalked : common.length ? common : walked.filter((w) => w.pts.length).map((w) => w.pts)).map(last);
            const joined = [];
            for (const e of ends) {
                if (Math.hypot(...g.to(e[0], e[1])) < 1.5 || joined.some((j) => Math.hypot(...g.to(j[0], j[1]).map((v, i) => v - g.to(e[0], e[1])[i])) < 0.1))
                    continue;
                joined.push(e);
                walked.push({ seg: "vectors", rows: [], pts: [e, g.back(0, 0, elev)], role: false });
            }
        }
        // Cut to the chart; fixes on the chart take their height from the nearest point drawn.
        const paths = [];
        const fixes = new Map();
        const rank = { final: 0, common: 1, transition: 2, missed: 3, vectors: 4 };
        for (const w of walked) {
            const cut = clipPath(w.pts, b);
            paths.push(...cut.map((pts) => ({ seg: w.seg, pts })));
            const drawn = cut.flat();
            if (!drawn.length)
                continue;
            for (const r of w.rows) {
                // A vectors leg names the airport only as where the vectors lead.
                if (!r.pos || r.pt === "VM" || !inside(r.pos[0], r.pos[1]))
                    continue;
                const near = drawn.reduce((best, p) => (Math.hypot(p[0] - r.pos[0], p[1] - r.pos[1]) < Math.hypot(best[0] - r.pos[0], best[1] - r.pos[1]) ? p : best));
                const old = fixes.get(r.fix);
                // The final's role and altitude win over the same fix on a transition or in a hold.
                if (old && rank[old.seg] <= rank[w.seg] && !(old.alt === null && r.alt))
                    continue;
                fixes.set(r.fix, { name: r.fix, lat: r.pos[0], lon: r.pos[1], ft: near[2], alt: r.alt, role: w.role ? r.role : null, seg: w.seg });
            }
        }
        if (!paths.length || (sub === "F" && !paths.some((p) => p.seg === "final")))
            continue;
        out.push({ airport, type: sub === "F" ? "IAP" : sub === "D" ? "SID" : "STAR", name: sub === "F" ? approachName(id) : id, paths, fixes: [...fixes.values()], course, glidepath, fafToMap });
    }
    return out.sort((a, c) => a.type.localeCompare(c.type) || a.name.localeCompare(c.name));
}

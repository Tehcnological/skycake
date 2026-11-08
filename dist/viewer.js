// 3D airspace over the FAA TAC: the chart, draped over real terrain, is the ground. Areas lie flat (the chart prints them)
// until raised, then stand from floor to ceiling in the chart's own colors and line styles. Approaches draw over it.
// Mouse: drag to orbit, scroll to zoom. Touch: one finger moves the map, pinch zooms, a twist turns, two fingers up or
// down tilt. Hover or tap for a label, tap to raise or lower. Units are nautical miles;
// heights are stretched (exaggerate) so shelves read. Draw order: terrain, then lines and approaches, then a depth-only
// pass, then the fills, so only the nearest surface of a stack is tinted and shelves read as one piece of glass.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { groundFt } from "./airclass.js";
import { clipRing, deepest, feetText, hundreds, inRing, modeOf, shownIn } from "./airspace.js";
import { isTap, twoFingers } from "./gesture.js";
import { fixTags } from "./roam.js";
import { along, flightLine } from "./fly.js";
import { PLANE_GLB } from "./plane.js";
const FT_PER_NM = 6076;
const BLUE = 0x2f6bff;
const MAGENTA = 0xd0349c;
// After the chart legend: B solid blue, C solid magenta, D dashed blue, E dashed magenta, E 700 ft a magenta tint,
// Mode C a thin magenta outline, restricted/prohibited/warning hatched blue, MOA/alert hatched magenta.
export const STYLE = {
    B: { color: BLUE, wall: 0.42, roof: 0.24, line: "solid", walls: true },
    C: { color: MAGENTA, wall: 0.42, roof: 0.24, line: "solid", walls: true },
    D: { color: BLUE, wall: 0.34, roof: 0.2, line: "dashed", walls: true },
    E: { color: MAGENTA, wall: 0.28, roof: 0.14, line: "dashed", walls: true },
    E700: { color: MAGENTA, wall: 0, roof: 0.1, line: "none", walls: false },
    MODEC: { color: MAGENTA, wall: 0, roof: 0, line: "solid", walls: false },
    R: { color: BLUE, wall: 0.5, roof: 0.1, line: "hatch", walls: true },
    P: { color: BLUE, wall: 0.5, roof: 0.1, line: "hatch", walls: true },
    W: { color: BLUE, wall: 0.5, roof: 0.1, line: "hatch", walls: true },
    MOA: { color: MAGENTA, wall: 0.45, roof: 0.08, line: "hatch", walls: true },
    A: { color: MAGENTA, wall: 0.45, roof: 0.08, line: "hatch", walls: true },
};
// Approaches: white transitions, green final, yellow missed. Departures and arrivals: white transitions, green common route.
// Radar vectors between the field and a departure or arrival: white and black dashes.
const PATH = { transition: 0xffffff, final: 0x22d36b, common: 0x22d36b, missed: 0xffc21a, vectors: 0xffffff };
const AIRWAY = 0x00a7c4;
const RAISE_SECONDS = 0.35;
export const START_SCALE = 1;
// Vertical stripes for hatched walls.
function stripes() {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 6, 16);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
}
// Fades the chart out toward its edge, over 2% of it so approaches near the edge stay on solid chart. Per pixel because
// canvas blur filters don't exist in every browser.
function softEdge() {
    const S = 256;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const v = Math.round(Math.min(1, Math.min(x, y, S - 1 - x, S - 1 - y) / 5) * 255);
            img.data.set([v, v, v, 255], (y * S + x) * 4);
        }
    }
    g.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
}
function el(tag, cls, ...kids) {
    const e = document.createElement(tag);
    e.className = cls;
    e.append(...kids);
    return e;
}
/** Ceiling over floor, as the chart prints them. */
export const fraction = (a, ground) => el("div", `frac ${STYLE[a.kind].color === MAGENTA ? "m" : "b"}`, el("b", "", hundreds(a.ceiling, ground)), el("b", "", hundreds(a.floor, ground)));
const same = (a, b) => a.airport === b.airport && a.name === b.name;
export async function build(host, data, label, raised, 
/** A tap on an airport's tag on the chart. */
airport = () => { }) {
    const { bounds: b } = data;
    const lat0 = (b.s + b.n) / 2, lon0 = (b.w + b.e) / 2;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const X = (lon) => (lon - lon0) * 60 * k;
    const Z = (lat) => -(lat - lat0) * 60;
    const latLon = (x, z) => [lat0 - z / 60, lon0 + x / (60 * k)];
    const nm = (ft) => ft / FT_PER_NM;
    const width = (b.e - b.w) * 60 * k, depth = (b.n - b.s) * 60;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const world = new THREE.Group(); // scaled in y by the exaggeration
    world.scale.y = START_SCALE;
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.68));
    const sun = new THREE.DirectionalLight(0xfff4e0, Math.PI * 0.42);
    sun.position.set(-40, 26, -40); // from the northwest, as charts shade relief
    scene.add(sun);
    const hatch = stripes();
    const tagBox = el("div", "tags");
    host.append(tagBox);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.prepend(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 3;
    // Far enough back to see the whole area in a tall, narrow view.
    controls.maxDistance = Math.max(300, 4 * Math.max(width, depth));
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // stay above the chart
    controls.screenSpacePanning = false; // a right drag slides over the chart, not up off it
    controls.zoomToCursor = true;
    controls.touches = { ONE: null, TWO: null }; // touch is handled below, as on a maps app
    let dirty = true;
    controls.addEventListener("change", () => (dirty = true));
    // The ground: the chart draped over the elevation grid. Without the grid it lies flat at the field elevation.
    const { nx, ny, url } = data.dem;
    const grid = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    const dem = grid && new Int16Array(grid);
    // Bilinear between the grid points, which are the ground mesh's vertices; the same sampling the quizzes use.
    const groundAt = (x, z) => nm(groundFt(data, dem, ...latLon(x, z)));
    const ground = new THREE.PlaneGeometry(width, depth, nx - 1, ny - 1);
    ground.rotateX(-Math.PI / 2);
    const pos = ground.attributes.position;
    for (let i = 0; i < pos.count; i++)
        pos.setY(i, nm(dem ? dem[i] : data.ground));
    ground.computeVertexNormals();
    // A sheet a set height above the ground, for floors written AGL. It lies on a grid of cells twice the terrain's,
    // each corner lifted above the highest ground around it so no ridge pokes through; cells on the edge are cut to the
    // outline.
    const S = 2, cx = Math.ceil((nx - 1) / S), cz = Math.ceil((ny - 1) / S), cw = width / cx, cd = depth / cz;
    let top = null;
    const drape = (ring, agl) => {
        if (!top) {
            top = new Float32Array((cx + 1) * (cz + 1));
            for (let j = 0; j <= cz; j++) {
                for (let i = 0; i <= cx; i++) {
                    let h = -Infinity;
                    for (let dj = -S; dj <= S; dj++)
                        for (let di = -S; di <= S; di++) {
                            const fi = Math.max(0, Math.min(nx - 1, i * S + di)), fj = Math.max(0, Math.min(ny - 1, j * S + dj));
                            h = Math.max(h, dem ? dem[fj * nx + fi] : data.ground);
                        }
                    top[j * (cx + 1) + i] = nm(h);
                }
            }
        }
        const t = top;
        const lift = (x, z) => {
            const fi = Math.max(0, Math.min(cx, (x + width / 2) / cw)), fj = Math.max(0, Math.min(cz, (z + depth / 2) / cd));
            const i = Math.min(Math.floor(fi), cx - 1), j = Math.min(Math.floor(fj), cz - 1);
            const [a, c] = [fi - i, fj - j];
            const h = (di, dj) => t[(j + dj) * (cx + 1) + i + di];
            return (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - c) + (h(0, 1) * (1 - a) + h(1, 1) * a) * c + agl;
        };
        const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
        const verts = [];
        for (let j = Math.max(0, Math.floor((Math.min(...zs) + depth / 2) / cd)); j < Math.min(cz, Math.ceil((Math.max(...zs) + depth / 2) / cd)); j++) {
            for (let i = Math.max(0, Math.floor((Math.min(...xs) + width / 2) / cw)); i < Math.min(cx, Math.ceil((Math.max(...xs) + width / 2) / cw)); i++) {
                const x0 = -width / 2 + i * cw, z0 = -depth / 2 + j * cd;
                // clipRing takes [lat, lon] against s/n and w/e; here the first coordinate is x and the second z.
                const cut = clipRing(ring, { s: x0, n: x0 + cw, w: z0, e: z0 + cd });
                if (cut.length < 3)
                    continue;
                const pts = cut.map(([x, z]) => new THREE.Vector2(x, z));
                for (const tri of THREE.ShapeUtils.triangulateShape(pts, []))
                    for (const k of tri)
                        verts.push(pts[k].x, lift(pts[k].x, pts[k].y), pts[k].y);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        return geo;
    };
    // A chart over the whole area (sectional or low) and, when on, a sharper one over its own map (TAC or area chart).
    const load = async (url) => {
        const t = await new THREE.TextureLoader().loadAsync(url);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return t;
    };
    const textures = new Map();
    const texture = (url) => {
        if (!textures.has(url))
            textures.set(url, load(url).catch((e) => { textures.delete(url); throw e; }));
        return textures.get(url);
    };
    const { tac, low, area } = data.charts;
    const [sectional, tacTex] = await Promise.all([texture(data.charts.sectional), tac ? texture(tac.url) : new THREE.Texture()]);
    const span = (lo, hi, a, b) => [(lo - a) / (b - a), (hi - a) / (b - a)];
    const rectOf = (m) => {
        const [u0, u1] = span(m.w, m.e, b.w, b.e);
        const [v0, v1] = span(m.s, m.n, b.s, b.n);
        return new THREE.Vector4(u0, v0, u1, v1);
    };
    const chartUniforms = { overMap: { value: tacTex }, overRect: { value: tac ? rectOf(tac.bounds) : new THREE.Vector4() }, overOn: { value: tac ? 1 : 0 } };
    const material = new THREE.MeshLambertMaterial({ map: sectional, alphaMap: softEdge(), transparent: true });
    // Both charts are sampled everywhere and mixed, so mipmaps stay right along the sharper chart's edge.
    material.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, chartUniforms);
        sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform sampler2D overMap;\nuniform vec4 overRect;\nuniform float overOn;")
            .replace("#include <map_fragment>", `vec4 baseColor = texture2D( map, vMapUv );
        vec2 overUv = ( vMapUv - overRect.xy ) / ( overRect.zw - overRect.xy );
        vec4 overColor = texture2D( overMap, clamp( overUv, 0.0, 1.0 ) );
        float onOver = overOn * step( 0.0, overUv.x ) * step( overUv.x, 1.0 ) * step( 0.0, overUv.y ) * step( overUv.y, 1.0 );
        diffuseColor *= mix( baseColor, overColor, onOver );`);
    };
    const chart = new THREE.Mesh(ground, material);
    chart.renderOrder = -1;
    world.add(chart);
    // The IFR charts load when first picked. The chart on screen stays until the new one is ready, and the latest pick wins.
    let chartTicket = 0;
    const showChart = async (name) => {
        const mine = ++chartTicket;
        const over = name === "tac" ? tac : name === "area" ? area : undefined;
        let base, overTex;
        try {
            [base, overTex] = await Promise.all([texture((name === "area" || name === "low") && low ? low : data.charts.sectional), over && texture(over.url)]);
        }
        catch (e) {
            // shortcut: the button then names a chart that is not showing, until the next pick tries again. Upgrade if it shows up in use.
            return console.warn(`skycake: ${e}`);
        }
        if (mine !== chartTicket)
            return;
        const before = [material.map, chartUniforms.overMap.value];
        material.map = base;
        chartUniforms.overOn.value = over ? 1 : 0;
        if (over && overTex) {
            chartUniforms.overMap.value = overTex;
            chartUniforms.overRect.value = rectOf(over.bounds);
        }
        // Only two charts on the GPU at a time, as phones have little room; the images stay loaded, so going back is quick.
        for (const t of before)
            if (t && t !== base && t !== chartUniforms.overMap.value)
                t.dispose();
        dirty = true;
    };
    // Tags follow their spot on screen. Procedure tags first, then airspace tags, each highest priority first; one that
    // would overlap a shown tag hides, so an airspace tag never covers a procedure tag (style.css also stacks them over).
    const shelfTags = [];
    const airportTags = [];
    const airwayTags = [];
    let approachTags = [];
    let tagsOn = true;
    const addTag = (node, at, pri, live, list) => {
        tagBox.append(node);
        node.style.visibility = "hidden";
        list.push({ el: node, at, pri, live, w: 0, h: 0 });
    };
    const v = new THREE.Vector3();
    const place = () => {
        const { clientWidth: w, clientHeight: h } = host;
        const taken = [];
        for (const t of [...approachTags, ...airportTags, ...airwayTags, ...shelfTags]) {
            // The airplane's altitude stays with tags off: an airplane question is asked about it.
            let show = (tagsOn || t.el.classList.contains("plane")) && t.live();
            if (show) {
                if (!t.w)
                    [t.w, t.h] = [t.el.offsetWidth, t.el.offsetHeight];
                v.set(t.at.x, t.at.y * world.scale.y, t.at.z).project(camera);
                const x = (v.x * 0.5 + 0.5) * w - t.w / 2, y = (-v.y * 0.5 + 0.5) * h - t.h - 6;
                const box = [x - 2, y - 2, x + t.w + 2, y + t.h + 2];
                show = v.z < 1 && x > 0 && x + t.w < w && y > 0 && y + t.h < h && !taken.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]);
                if (show) {
                    taken.push(box);
                    t.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
                }
            }
            t.el.style.visibility = show ? "visible" : "hidden";
        }
    };
    const span2 = ([p, q]) => Math.hypot((q[1] - p[1]) * k, q[0] - p[0]);
    const fat = (color, linewidth, dashed, opacity = 1) => new LineMaterial({ color, linewidth, transparent: true, opacity, dashed, dashSize: 0.5, gapSize: 0.35 });
    // VFR shows all the airspace; IFR only special use, airways and their fixes. Areas keep their raised state across modes.
    let mode = "vfr";
    const inMode = (l) => shownIn(mode, l.area.kind);
    // Each pixel takes one layer of airspace color: a depth-only pass finds the nearest surface, then only that surface draws.
    // The FAA's shelves overlap their cores in one plane (Tucson's 4,200-6,600 shelf covers its surface area, both up to 6,600),
    // and such ties would fight. So the depth pass sits just behind the surfaces, letting all tied ones through, and the first
    // to reach a pixel marks it in the stencil so the rest skip it.
    const oneLayer = { stencilWrite: true, stencilFunc: THREE.NotEqualStencilFunc, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp };
    // Every area stands in its own group, squashed into the ground while flat.
    const lives = [];
    for (const area of data.areas) {
        const s = STYLE[area.kind];
        const group = new THREE.Group();
        group.visible = false;
        world.add(group);
        const rings = area.rings.map((ring) => ring.map(([lat, lon]) => [X(lon), Z(lat)]));
        const live = { area, group, rings, picks: [], t: 0, goal: 0, size: Infinity };
        // Tapping the chart picks the smallest area there.
        const xs = rings.flat().map((p) => p[0]), zs = rings.flat().map((p) => p[1]);
        live.size = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
        lives.push(live);
        if (area.kind === "MODEC") {
            const pts = rings.flatMap((r) => r.flatMap((p, i) => {
                const n = r[(i + 1) % r.length];
                return [area.floor, area.ceiling].flatMap((alt) => [p[0], nm(alt), p[1], n[0], nm(alt), n[1]]);
            }));
            group.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pts), fat(s.color, 1, false, 0.6)));
            continue;
        }
        // SFC runs down into the terrain, which hides it.
        const floor = area.floor <= data.ground ? 0 : area.floor;
        for (const r of rings) {
            const shape = new THREE.Shape(r.map((p) => new THREE.Vector2(p[0], -p[1])));
            if (!s.walls) {
                const sheet = drape(r, nm(area.floor - data.ground));
                const mesh = new THREE.Mesh(sheet, new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.roof, depthWrite: false, side: THREE.DoubleSide }));
                mesh.renderOrder = 2;
                live.picks.push(mesh);
                group.add(mesh);
                continue;
            }
            const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(nm(area.ceiling - floor), 0.01), bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            geo.translate(0, nm(floor), 0);
            const pre = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
            pre.renderOrder = 1;
            group.add(pre);
            const roof = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.roof, depthWrite: false, side: THREE.DoubleSide, ...oneLayer });
            const wall = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.wall, depthWrite: false, side: THREE.DoubleSide, ...oneLayer, ...(s.line === "hatch" ? { map: hatch } : {}) });
            const fill = new THREE.Mesh(geo, [roof, wall]);
            fill.renderOrder = 2;
            live.picks.push(fill);
            group.add(fill);
            // Rims top and bottom, then ribs on corners and every 2.5 NM along the wall.
            const rims = [], ribs = [];
            let run = 0;
            r.forEach((p, i) => {
                const n = r[(i + 1) % r.length], o = r[(i + r.length - 1) % r.length];
                for (const h of [area.floor, area.ceiling])
                    rims.push(p[0], nm(h), p[1], n[0], nm(h), n[1]);
                const turn = Math.abs(Math.atan2(n[1] - p[1], n[0] - p[0]) - Math.atan2(p[1] - o[1], p[0] - o[0]));
                run += Math.hypot(n[0] - p[0], n[1] - p[1]);
                if (Math.min(turn, 2 * Math.PI - turn) > 0.5 || run > 2.5) {
                    ribs.push(p[0], nm(floor), p[1], p[0], nm(area.ceiling), p[1]);
                    run = 0;
                }
            });
            const rim = new LineSegments2(new LineSegmentsGeometry().setPositions(rims), fat(s.color, 1.6, s.line === "dashed"));
            if (s.line === "dashed")
                rim.computeLineDistances();
            group.add(rim);
            if (ribs.length)
                group.add(new LineSegments2(new LineSegmentsGeometry().setPositions(ribs), fat(s.color, 1, false, 0.45)));
        }
        if (s.walls) {
            // The chart's own form: ceiling over floor, on the widest ring.
            const widest = rings.reduce((a, c) => (c.length > a.length ? c : a));
            const [x, z] = deepest(widest);
            const node = fraction(area, data.ground);
            node.classList.add("tag");
            addTag(node, new THREE.Vector3(x, nm(area.ceiling), z), 5 - Math.min(4, Math.log10(live.size + 1)), () => live.t === 1 && inMode(live), shelfTags);
        }
    }
    shelfTags.sort((a, c) => a.pri - c.pri);
    // Airports with procedures get a tag at the field; tapping it makes the airport current, or answers a tap question there.
    let tapFn = null;
    const tapAirport = (id) => {
        const a = data.airports.find((x) => x.id === id);
        if (tapFn)
            tapFn({ area: null, at: [a.lat, a.lon] });
        else
            airport(id);
    };
    for (const a of data.airports) {
        if (!a.procedures.length)
            continue;
        const node = el("button", "tag apt", a.id);
        node.setAttribute("type", "button");
        node.addEventListener("click", () => tapAirport(a.id));
        addTag(node, new THREE.Vector3(X(a.lon), nm(a.elev), Z(a.lat)), 0, () => true, airportTags);
    }
    const tappable = lives.filter((l) => l.area.kind !== "E700" && l.area.kind !== "MODEC").sort((a, c) => a.size - c.size);
    // Airways stand at their minimum enroute altitude; a leg with none lies on the chart. A stem from the ground up to each
    // fix shows its height and joins legs at different heights. Built once: only the mode shows or hides them.
    const airways = new THREE.Group();
    airways.visible = false;
    world.add(airways);
    const legs = [], stems = [];
    const isIfr = () => mode === "ifr";
    const usedLegs = new Set();
    for (const a of data.airways) {
        const longest = [...a.legs].sort((l, m) => span2(m.pts) - span2(l.pts));
        // Each airway's name goes on its longest leg no other airway's name is on, so names on a shared route don't stack.
        const home = longest.find((l) => !usedLegs.has(String(l.pts))) ?? longest[0];
        usedLegs.add(String(home.pts));
        for (const l of a.legs) {
            const [[x0, z0], [x1, z1]] = l.pts.map(([lat, lon]) => [X(lon), Z(lat)]);
            const up = (x, z) => (l.ft === null ? groundAt(x, z) + nm(100) : nm(l.ft));
            // A leg on the chart follows the ground; one at altitude is straight.
            const steps = l.ft === null ? Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0))) : 1;
            for (let s = 0; s < steps; s++) {
                const [xa, za, xb, zb] = [x0 + ((x1 - x0) * s) / steps, z0 + ((z1 - z0) * s) / steps, x0 + ((x1 - x0) * (s + 1)) / steps, z0 + ((z1 - z0) * (s + 1)) / steps];
                legs.push(xa, up(xa, za), za, xb, up(xb, zb), zb);
            }
            if (l === home) {
                const [x, z] = [(x0 + x1) / 2, (z0 + z1) / 2];
                addTag(el("div", "tag awy", a.name), new THREE.Vector3(x, up(x, z), z), 0, isIfr, airwayTags);
            }
        }
    }
    for (const w of data.waypoints) {
        const [x, z] = [X(w.lon), Z(w.lat)];
        if (w.ft !== null)
            stems.push(x, groundAt(x, z), z, x, nm(w.ft), z);
        addTag(el("div", "tag wp", w.name), new THREE.Vector3(x, w.ft === null ? groundAt(x, z) + nm(100) : nm(w.ft), z), 1, isIfr, airwayTags);
    }
    if (legs.length) {
        // As procedures: a black outline that writes no depth, under the color.
        const under = new LineSegments2(new LineSegmentsGeometry().setPositions(legs), new LineMaterial({ color: 0x000000, linewidth: 4.2, transparent: true, depthWrite: false }));
        under.renderOrder = 0.1;
        const line = new LineSegments2(new LineSegmentsGeometry().setPositions(legs), new LineMaterial({ color: AIRWAY, linewidth: 3, transparent: true }));
        line.renderOrder = 0.2;
        airways.add(under, line);
    }
    if (stems.length)
        airways.add(new LineSegments2(new LineSegmentsGeometry().setPositions(stems), fat(AIRWAY, 1.2, false, 0.8)));
    const setKind = (kind) => raised(kind, lives.some((l) => l.area.kind === kind && l.goal === 1));
    const set = (l, on) => {
        l.goal = on ? 1 : 0;
        if (still)
            l.t = l.goal;
        setKind(l.area.kind);
        dirty = true;
    };
    // Eases the camera to a view of the given spots, from the south so the chart reads upright, tilted the given
    // degrees above the horizon (90 looks straight down with north up).
    let fly = null;
    const frame = (spots, tiltDeg = 32, now = false) => {
        free = false;
        const box = new THREE.Box3();
        const scaled = spots.map((s) => new THREE.Vector3(s.x, s.y * world.scale.y, s.z));
        for (const s of scaled)
            box.expandByPoint(s);
        const center = box.getCenter(new THREE.Vector3());
        const tilt = (Math.min(tiltDeg, 89.9) * Math.PI) / 180;
        const back = new THREE.Vector3(0, Math.sin(tilt), Math.cos(tilt)), up = new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt));
        const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
        // The nearest distance at which every spot is on screen, perspective included. Far spots look smaller, which
        // leaves empty sky, so a few rounds slide the view to center what shows, then fit again.
        let dist = 1;
        for (let round = 0; round < 4; round++) {
            dist = 1;
            for (const s of scaled) {
                const d = s.clone().sub(center);
                dist = Math.max(dist, d.dot(back) + Math.abs(d.x) / th, d.dot(back) + Math.abs(d.dot(up)) / tv);
            }
            let lo = Infinity, hi = -Infinity;
            for (const s of scaled) {
                const d = s.clone().sub(center);
                const y = d.dot(up) / ((dist - d.dot(back)) * tv);
                [lo, hi] = [Math.min(lo, y), Math.max(hi, y)];
            }
            center.addScaledVector(up, ((lo + hi) / 2) * dist * tv);
        }
        const p1 = center.clone().addScaledVector(back, dist * 1.04);
        if (now || still) {
            camera.position.copy(p1);
            controls.target.copy(center);
            fly = null;
            dirty = true;
        }
        else
            fly = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1: center, t: 0 };
    };
    // What is framed now, so a resize can frame it again.
    let framed = null;
    // Once someone moves the view it is theirs: no fly-in finishes, no resize refits it (a phone's toolbar hiding is a
    // resize), and they can't take it off the chart.
    let free = false;
    const takeOver = () => {
        fly = null;
        framed = null;
        free = true;
        host.dispatchEvent(new CustomEvent("skycake-moved", { bubbles: true }));
    };
    controls.addEventListener("start", takeOver);
    const keepOnChart = () => {
        const { target } = controls;
        const dx = THREE.MathUtils.clamp(target.x, -width / 2, width / 2) - target.x, dz = THREE.MathUtils.clamp(target.z, -depth / 2, depth / 2) - target.z;
        if (!dx && !dz)
            return;
        target.x += dx;
        target.z += dz;
        camera.position.x += dx;
        camera.position.z += dz;
        dirty = true;
    };
    const whole = () => [new THREE.Vector3(-width / 2, 0, -depth / 2), new THREE.Vector3(width / 2, 0, depth / 2)];
    const ringSpots = (l) => l.rings.flat().map(([x, z]) => new THREE.Vector3(x, nm(l.area.ceiling), z));
    // Procedures: each path outlined in black at a constant width on screen, the missed approach dashed yellow and black.
    // A curtain drops from the path to the ground so its height reads from any angle.
    const route = new THREE.Group();
    world.add(route);
    const toLocal = ([lat, lon, ft]) => new THREE.Vector3(X(lon), nm(ft), Z(lat));
    const path = (pts, color, dashed, opacity) => {
        if (pts.length < 2)
            return [];
        const positions = pts.flatMap((p) => [p.x, p.y, p.z]);
        // The outline writes no depth: at the same depth as the color line, the two would flicker.
        const under = new Line2(new LineGeometry().setPositions(positions), new LineMaterial({ color: 0x000000, linewidth: 7.5, transparent: true, opacity, depthWrite: false }));
        under.renderOrder = 0.1;
        const top = new Line2(new LineGeometry().setPositions(positions), new LineMaterial({ color, linewidth: 4.5, transparent: true, opacity, dashed, dashSize: 0.7, gapSize: 0.6 }));
        top.renderOrder = 0.2;
        if (dashed)
            top.computeLineDistances();
        route.add(under, top);
        return [under, top];
    };
    /** The mesh, and how many quads come before each point, so it can grow with the line. */
    const curtain = (pts, color, opacity) => {
        const verts = [], index = [], quads = [0];
        let n = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const steps = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / 0.3));
            quads.push(quads[i] + steps);
            for (let s = 0; s <= steps; s++) {
                const p = pts[i].clone().lerp(pts[i + 1], s / steps);
                verts.push(p.x, p.y, p.z, p.x, groundAt(p.x, p.z) - 0.02, p.z);
                if (s < steps)
                    index.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
                n += 2;
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(index);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
        route.add(mesh);
        return { mesh, quads };
    };
    // A closed line around x, z points: at height y, or on the ground following the terrain.
    const loop = (ring, color, linewidth, y) => {
        const pos = [];
        ring.forEach(([x0, z0], i) => {
            const [x1, z1] = ring[(i + 1) % ring.length];
            const steps = y === undefined ? Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5)) : 1;
            for (let s = 0; s < steps; s++) {
                const [x, z] = [x0 + ((x1 - x0) * s) / steps, z0 + ((z1 - z0) * s) / steps];
                pos.push(x, y ?? groundAt(x, z) + nm(100), z);
            }
        });
        pos.push(pos[0], pos[1], pos[2]);
        const line = new Line2(new LineGeometry().setPositions(pos), new LineMaterial({ color, linewidth, transparent: true }));
        line.renderOrder = 0.2;
        return line;
    };
    const circle = (x, z, r) => Array.from({ length: 48 }, (_, i) => [x + r * Math.cos((i * Math.PI) / 24), z + r * Math.sin((i * Math.PI) / 24)]);
    const dispose = (g) => g.traverse((o) => {
        const m = o;
        m.geometry?.dispose();
        m.material?.dispose();
    });
    const clearRoute = () => {
        dispose(route);
        route.clear();
        for (const t of approachTags)
            t.el.remove();
        approachTags = [];
        grows = [];
    };
    // The step timeline: procedures with draw grow path by path, fix tags show once drawn, the airplane flies.
    let tNow = 1, spunAt = 0;
    let grows = [];
    const grow = (g) => {
        const n = g.pts.length - 1;
        const d = THREE.MathUtils.clamp((tNow - g.from) / (g.to - g.from), 0, 1) * g.run[n];
        let j = 0;
        while (j < n - 1 && g.run[j + 1] < d)
            j++;
        const f = g.run[j + 1] > g.run[j] ? (d - g.run[j]) / (g.run[j + 1] - g.run[j]) : 1;
        const tip = g.pts[j].clone().lerp(g.pts[j + 1], f);
        for (const line of g.lines) {
            const end = line.geometry.attributes.instanceEnd;
            for (let i = 0; i < n; i++) {
                const q = i === j ? tip : g.pts[i + 1];
                end.setXYZ(i, q.x, q.y, q.z);
            }
            end.data.needsUpdate = true;
            line.geometry.instanceCount = d > 0 ? j + 1 : 0;
        }
        g.curtain.geometry.setDrawRange(0, d > 0 ? 6 * Math.round(g.quads[j] + f * (g.quads[j + 1] - g.quads[j])) : 0);
    };
    const runOf = (pts) => {
        let s = 0;
        return pts.map((p, i) => (s += i ? Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0));
    };
    // The airplane: outside the world, so a taller height scale lifts it without stretching it. Built on first use.
    let craft = null, prop = null, craftLoad = null;
    let flight = null, planeTag = null;
    const planeAt = new THREE.Vector3();
    const loadCraft = () => (craftLoad ??= new GLTFLoader()
        .parseAsync(Uint8Array.from(atob(PLANE_GLB), (c) => c.charCodeAt(0)).buffer, "")
        .then((gltf) => {
        const model = gltf.scene;
        // The propeller turns about its own centre, not the model's origin.
        prop = model.getObjectByName("Propeller_Cone") ?? null;
        if (prop) {
            const c = new THREE.Box3().setFromObject(prop).getCenter(new THREE.Vector3());
            prop.traverse((o) => o.geometry?.translate(-c.x, -c.y, -c.z));
            prop.position.add(c);
        }
        // Nose to -z (north), up +y; centred, scaled to a 0.6 NM span.
        const box = new THREE.Box3().setFromObject(model);
        model.position.sub(box.getCenter(new THREE.Vector3()));
        craft = new THREE.Group().add(model);
        craft.scale.setScalar(0.6 / (box.max.x - box.min.x));
        scene.add(craft);
        placePlane();
    })
        .catch((e) => console.warn(`skycake: no airplane: ${e}`)));
    const placePlane = () => {
        if (craft)
            craft.visible = !!flight;
        if (!flight)
            return;
        const p = along(flight, tNow);
        planeAt.copy(toLocal(p));
        if (planeTag) {
            const text = Math.round(p[2]).toLocaleString("en-US");
            if (planeTag.el.textContent !== text) {
                planeTag.el.textContent = text;
                planeTag.w = 0;
            }
        }
        if (!craft)
            return;
        craft.position.set(planeAt.x, planeAt.y * world.scale.y, planeAt.z);
        // Along the line, or north on a single point.
        const [a, b] = tNow < 1 ? [p, along(flight, tNow + 0.001)] : [along(flight, tNow - 0.001), p];
        const [dx, dz] = [X(b[1]) - X(a[1]), Z(b[0]) - Z(a[0])];
        craft.rotation.y = dx || dz ? Math.atan2(-dx, -dz) : 0;
        dirty = true;
    };
    // What a scene highlights stands out, and what a keyboard user is on is focused.
    let focusMark = null;
    const unfocus = () => {
        if (!focusMark)
            return;
        world.remove(focusMark);
        dispose(focusMark);
        focusMark = null;
        dirty = true;
    };
    const fade = (o, f) => o.traverse((x) => {
        for (const m of [x.material ?? []].flat()) {
            m.userData.base ??= m.opacity;
            m.opacity = m.userData.base * f;
        }
    });
    let shownFixes = [];
    // An airport diagram draped a little above the ground, or none. The same one again is left as it is.
    let plate = null, plateUrl = null, plateTicket = 0;
    const showDiagram = async (d) => {
        if ((d?.url ?? null) === plateUrl)
            return;
        const ticket = ++plateTicket;
        plateUrl = d?.url ?? null;
        if (plate) {
            world.remove(plate);
            plate.geometry.dispose();
            plate.material.map?.dispose();
            plate.material.dispose();
            plate = null;
            dirty = true;
        }
        if (!d)
            return;
        const map = await new THREE.TextureLoader().loadAsync(d.url).catch(() => null);
        if (!map || ticket !== plateTicket)
            return map?.dispose();
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const [x0, x1, z0, z1] = [X(d.bounds.w), X(d.bounds.e), Z(d.bounds.n), Z(d.bounds.s)];
        // The image's top is north.
        const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 24, 24);
        geo.rotateX(-Math.PI / 2);
        geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
        const at = geo.attributes.position;
        for (let i = 0; i < at.count; i++)
            at.setY(i, groundAt(at.getX(i), at.getZ(i)) + nm(40));
        plate = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
        plate.renderOrder = 0.05;
        world.add(plate);
        dirty = true;
    };
    // Where a scene's target is: an area's outline at its ceiling, a fix on a shown procedure, a procedure's paths, a
    // point on the ground.
    const onGround = (lat, lon) => new THREE.Vector3(X(lon), groundAt(X(lon), Z(lat)), Z(lat));
    const targetSpots = (t, procs) => {
        if ("area" in t)
            return lives.filter((l) => l.area.id === t.area).flatMap(ringSpots);
        if ("fix" in t)
            return procs.flatMap((p) => p.fixes).filter((f) => f.name === t.fix).slice(0, 1).map((f) => new THREE.Vector3(X(f.lon), nm(f.ft), Z(f.lat)));
        if ("procedure" in t)
            return procs.filter((p) => p.airport === t.procedure.airport && p.name === t.procedure.name).flatMap((p) => p.paths.flatMap((x) => x.pts.map(toLocal)));
        if ("diagram" in t) {
            const d = data.airports.find((a) => a.id === t.diagram)?.diagram;
            if (!d)
                return [];
            return [[d.bounds.w, d.bounds.n], [d.bounds.e, d.bounds.n], [d.bounds.w, d.bounds.s], [d.bounds.e, d.bounds.s]].map(([lon, lat]) => onGround(lat, lon));
        }
        if ("airport" in t)
            return data.airports.filter((a) => a.id === t.airport).map((a) => onGround(a.lat, a.lon));
        return [onGround(...t.point)];
    };
    // Hover or tap shows the area under the pointer: a raised one first, else the flat one printed on the chart there.
    const ray = new THREE.Raycaster();
    // The ground under the ray. A march down it to the terrain; three's own raycast would test every triangle.
    const groundHit = () => {
        const { origin, direction: d } = ray.ray;
        if (d.y >= 0)
            return null;
        // Steps of 0.5 NM, as far as the camera can be from the chart.
        for (let s = 0, p = origin.clone(), steps = Math.ceil((controls.maxDistance + Math.max(width, depth)) / 0.5); s < steps; s++) {
            p.addScaledVector(d, 0.5);
            if (p.y <= groundAt(p.x, p.z) * world.scale.y)
                return p;
        }
        return null;
    };
    // A fix sits at its altitude, so the ground under a tap on it can be miles past it in a tilted view: a tap on a shown
    // fix's tag, or within 24 px of its point, is at the fix.
    const fixAt = (e) => {
        if (!tagsOn)
            return null;
        const r = renderer.domElement.getBoundingClientRect();
        let best = null, bestD = 24;
        for (const { fix, tag } of shownFixes) {
            if (!tag.live())
                continue;
            const b = tag.el.getBoundingClientRect();
            if (tag.el.style.visibility === "visible" && e.clientX > b.left - 6 && e.clientX < b.right + 6 && e.clientY > b.top - 6 && e.clientY < b.bottom + 6)
                return [fix.lat, fix.lon];
            v.set(tag.at.x, tag.at.y * world.scale.y, tag.at.z).project(camera);
            if (v.z >= 1)
                continue;
            const d = Math.hypot(r.left + (v.x * 0.5 + 0.5) * r.width - e.clientX, r.top + (-v.y * 0.5 + 0.5) * r.height - e.clientY);
            if (d < bestD)
                [best, bestD] = [fix, d];
        }
        return best && [best.lat, best.lon];
    };
    const pick = (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const up = lives.filter((l) => l.goal === 1 && inMode(l));
        const hit = ray.intersectObjects(up.flatMap((l) => l.picks))[0];
        if (hit)
            return up.find((l) => l.picks.includes(hit.object)) ?? null;
        const p = groundHit();
        return (p && tappable.find((l) => l.goal === 0 && inMode(l) && l.rings.some((ring) => inRing([p.x, p.z], ring)))) ?? null;
    };
    const tell = (l, e) => {
        const r = renderer.domElement.getBoundingClientRect();
        label(l && l.area, e.clientX - r.left, e.clientY - r.top);
    };
    const el3d = renderer.domElement;
    el3d.addEventListener("pointermove", (e) => e.pointerType === "mouse" && !e.buttons && tell(pick(e), e));
    el3d.addEventListener("pointerleave", () => label(null, 0, 0));
    // A tap (not a drag): a flat area rises; a raised one is picked, then lowers on the next tap.
    let down = [0, 0], downAt = 0, most = 0;
    let picked = null;
    const fingers = new Map();
    let two = null;
    // Exactly two fingers on the view start a fresh gesture, also when a resting third one lifts.
    const regrip = () => {
        const [a, b] = [...fingers.values()];
        two = fingers.size === 2 ? twoFingers(a, b) : null;
    };
    const at = (e) => {
        const r = el3d.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };
    el3d.addEventListener("pointerdown", (e) => {
        if (!fingers.size) {
            down = [e.clientX, e.clientY];
            downAt = performance.now();
            most = 0;
        }
        if (e.pointerType !== "touch") {
            most = 1;
            return;
        }
        fingers.set(e.pointerId, at(e));
        most = Math.max(most, fingers.size);
        regrip();
        // Every finger's lift must reach the view, even over the tab bar, or it stays counted as down.
        el3d.setPointerCapture(e.pointerId);
    });
    // The spot on the ground under a point on screen. Near the horizon a finger has none to hold.
    const groundUnder = ([x, y]) => {
        ray.setFromCamera(new THREE.Vector2((x / el3d.clientWidth) * 2 - 1, -(y / el3d.clientHeight) * 2 + 1), camera);
        const { origin, direction: d } = ray.ray;
        if (d.y > -0.02)
            return null;
        const t = (controls.target.y - origin.y) / d.y;
        return t > 0 && t <= controls.maxDistance ? origin.clone().addScaledVector(d, t) : null;
    };
    // Keeps the ground under a finger as it moves.
    const slide = (from, to) => {
        const [a, c] = [groundUnder(from), groundUnder(to)];
        if (!a || !c)
            return;
        const shift = a.clone().sub(c);
        camera.position.add(shift);
        controls.target.add(shift);
    };
    const UP = new THREE.Vector3(0, 1, 0);
    const touchMoved = () => {
        label(null, 0, 0);
        keepOnChart();
        controls.update();
        camera.updateMatrixWorld();
        dirty = true;
    };
    // Run once a frame from the loop below, when both fingers' moves have arrived.
    let twoMoved = false;
    const readTwoFingers = () => {
        twoMoved = false;
        if (!two)
            return;
        const [a, b] = [...fingers.values()];
        const step = two(a, b);
        if (!step)
            return;
        takeOver();
        if (step.kind === "tilt") {
            view.orbit(0, (-step.dy / el3d.clientHeight) * Math.PI * 0.75);
        }
        else {
            // About the spot under the fingers. Only one finger moves the map, so a misread tilt can't drag it.
            const p = groundUnder(step.mid) ?? controls.target.clone();
            const off = camera.position.distanceTo(controls.target);
            const scale = THREE.MathUtils.clamp(off / step.zoom, controls.minDistance, controls.maxDistance) / off;
            for (const q of [camera.position, controls.target])
                q.sub(p).multiplyScalar(scale).applyAxisAngle(UP, step.twist).add(p);
        }
        touchMoved();
    };
    el3d.addEventListener("pointermove", (e) => {
        const was = fingers.get(e.pointerId);
        if (!was)
            return;
        const now = at(e);
        fingers.set(e.pointerId, now);
        if (fingers.size !== 1) {
            twoMoved = true;
            return;
        }
        if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) <= 3)
            return;
        takeOver();
        slide(was, now);
        touchMoved();
    });
    el3d.addEventListener("pointercancel", (e) => {
        fingers.delete(e.pointerId);
        regrip();
    });
    el3d.addEventListener("pointerup", (e) => {
        const touch = fingers.delete(e.pointerId);
        regrip();
        if (fingers.size)
            return;
        if (!isTap({ fingers: most, moved: Math.hypot(e.clientX - down[0], e.clientY - down[1]), ms: touch ? performance.now() - downAt : 0 }))
            return;
        // Where a finger can drag from a tag, the tag isn't the one receiving the tap (style.css).
        const tag = airportTags.find((t) => {
            const r = t.el.getBoundingClientRect();
            return t.el.style.visibility === "visible" && e.clientX > r.left - 6 && e.clientX < r.right + 6 && e.clientY > r.top - 6 && e.clientY < r.bottom + 6;
        });
        if (tag)
            return tapAirport(tag.el.textContent);
        const l = pick(e);
        if (tapFn) {
            const fix = fixAt(e), p = fix ? null : groundHit();
            if (fix || p)
                tapFn({ area: l?.area.id ?? null, at: fix ?? latLon(p.x, p.z) });
            return tell(l, e);
        }
        if (l && l.goal === 1 && picked === l) {
            set(l, false);
            picked = null;
            return label(null, 0, 0);
        }
        if (l && l.goal === 0)
            set(l, true);
        picked = l;
        tell(l, e);
    });
    let sized = [0, 0];
    const size = () => {
        const { clientWidth: w, clientHeight: h } = host;
        const changed = sized[0] > 0 && (w !== sized[0] || h !== sized[1]);
        sized = [w, h];
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        dirty = true;
        // A new shape (full screen, a turned phone) would clip what was in view.
        if (changed && framed)
            frame(framed.spots, framed.tilt, true);
    };
    new ResizeObserver(size).observe(host);
    size();
    const view = {
        dem: () => dem,
        raise: (kind, on) => {
            for (const l of lives)
                if (l.area.kind === kind)
                    set(l, on);
            setKind(kind);
        },
        // Only the world stretches: the camera and what it looks at stay put.
        exaggerate: (n) => {
            world.scale.y = n;
            placePlane();
            dirty = true;
        },
        tags: (on) => {
            tagsOn = on;
            dirty = true;
        },
        orbit: (azimuth, polar) => {
            const off = camera.position.clone().sub(controls.target);
            const s = new THREE.Spherical().setFromVector3(off);
            s.theta += azimuth;
            s.phi = Math.min(Math.max(s.phi + polar, Math.max(controls.minPolarAngle, 0.05)), controls.maxPolarAngle);
            camera.position.copy(controls.target).add(off.setFromSpherical(s));
            takeOver();
            dirty = true;
        },
        zoom: (factor) => {
            const off = camera.position.clone().sub(controls.target);
            off.setLength(Math.min(Math.max(off.length() * factor, controls.minDistance), controls.maxDistance));
            camera.position.copy(controls.target).add(off);
            takeOver();
            dirty = true;
        },
        raiseArea: (id, on) => {
            const l = lives.find((x) => x.area.id === id);
            if (l)
                set(l, on);
        },
        raisedAreas: () => lives.filter((l) => l.goal === 1).map((l) => l.area.id),
        apply: async (sc, procs, now = false, framing = [], time = 1) => {
            mode = modeOf(sc.chart);
            airways.visible = mode === "ifr";
            for (const l of lives)
                set(l, sc.raised.has(l.area.id));
            world.scale.y = sc.height;
            tagsOn = sc.tags;
            void showChart(sc.chart);
            clearRoute();
            unfocus();
            tNow = time;
            // With anything highlighted, what it does not name draws at 30% of its opacity.
            const hl = sc.highlight;
            const dim = (on) => (hl.length && !on ? 0.3 : 1);
            const hlProcs = procs.filter((p) => hl.some((t) => "procedure" in t && same(t.procedure, p)));
            const hlFix = (name) => hl.some((t) => "fix" in t && t.fix === name);
            for (const l of lives) {
                const on = hl.some((t) => "area" in t && t.area === l.area.id);
                fade(l.group, dim(on));
                // Flat or raised, a highlighted area gets a brighter outline on the ground.
                if (on)
                    for (const r of l.rings)
                        route.add(loop(r, new THREE.Color(STYLE[l.area.kind].color).lerp(new THREE.Color(0xffffff), 0.4), 2));
            }
            for (const t of hl)
                if ("point" in t)
                    route.add(loop(circle(X(t.point[1]), Z(t.point[0]), 0.25), 0xffffff, 2));
            for (const t of airportTags)
                t.el.classList.toggle("hl", hl.some((x) => "airport" in x && x.airport === t.el.textContent));
            // A procedure with draw grows path by path over the timeline; each fix tag shows once its point is drawn.
            const shows = new Map();
            procs.forEach((a) => {
                const draw = sc.procedures.find((r) => same(r, a))?.draw, n = a.paths.length, o = dim(hlProcs.includes(a));
                a.paths.forEach((p, k) => {
                    const pts = p.pts.map(toLocal), run = runOf(pts);
                    const main = p.seg === "final" || p.seg === "common";
                    const c = curtain(pts, PATH[p.seg], o * (main ? 0.28 : p.seg === "vectors" ? 0.08 : 0.14));
                    const lines = path(pts, PATH[p.seg], p.seg === "missed" || p.seg === "vectors", o);
                    if (draw && lines.length)
                        grows.push({ from: k / n, to: (k + 1) / n, pts, run, lines, curtain: c.mesh, quads: c.quads });
                    if (!draw)
                        return;
                    for (const f of a.fixes) {
                        const j = pts.findIndex((q) => Math.hypot(q.x - X(f.lon), q.z - Z(f.lat)) < 0.05);
                        if (j >= 0 && !shows.has(f))
                            shows.set(f, (k + run[j] / (run[run.length - 1] || 1)) / n);
                    }
                });
                if (draw)
                    for (const f of a.fixes)
                        if (!shows.has(f))
                            shows.set(f, 1);
            });
            shownFixes = [];
            for (const f of fixTags(procs)) {
                const cls = f.seg === "final" || f.seg === "common" ? "g" : f.seg === "missed" ? "y" : "w";
                const node = el("div", `tag fix ${cls}${hlFix(f.name) ? " hl" : ""}`, el("b", "", f.name, ...(f.role ? [el("i", "", f.role)] : [])), ...(f.alt ? [el("span", "alt", f.alt)] : []));
                if (dim(hlFix(f.name) || hlProcs.some((p) => p.fixes.some((x) => x.name === f.name))) < 1)
                    node.style.opacity = "0.3";
                const from = shows.get(f) ?? 0;
                addTag(node, new THREE.Vector3(X(f.lon), nm(f.ft), Z(f.lat)), f.role === "FAF" || f.role === "MAP" ? 0 : f.role ? 1 : 2, () => tNow >= from, approachTags);
                shownFixes.push({ fix: f, tag: approachTags[approachTags.length - 1] });
            }
            // The airplane, at a point or flying a procedure's route; its tag is the altitude.
            const plane = sc.airplane;
            const file = plane && "along" in plane ? [...procs, ...framing].find((p) => same(p, plane.along)) : undefined;
            flight = !plane ? null : "at" in plane ? [plane.at] : file ? flightLine(file) : null;
            if (plane && !flight)
                console.warn("skycake: the airplane's procedure was not passed to apply");
            planeTag = null;
            if (flight) {
                // The altitude shows even if the model fails to load: an airplane question is asked about it.
                addTag(el("div", "tag plane"), planeAt, -1, () => true, approachTags);
                planeTag = approachTags[approachTags.length - 1];
                void loadCraft();
            }
            approachTags.sort((x, y) => x.pri - y.pri);
            const plateDone = showDiagram(sc.diagram ? (data.airports.find((a) => a.id === sc.diagram)?.diagram ?? null) : null);
            const cam = sc.camera;
            if (cam === null) {
                // Leave the camera where it is.
            }
            else if (typeof cam === "object" && "azimuth" in cam) {
                // Placed directly: looking toward the azimuth (degrees true), tilt degrees above the horizon, distance in NM.
                const [lat, lon] = cam.target;
                const target = new THREE.Vector3(X(lon), groundAt(X(lon), Z(lat)) * world.scale.y, Z(lat));
                const [az, t] = [(cam.azimuth * Math.PI) / 180, (cam.tilt * Math.PI) / 180];
                const p1 = target.clone().add(new THREE.Vector3(-Math.sin(az) * Math.cos(t), Math.sin(t), Math.cos(az) * Math.cos(t)).multiplyScalar(cam.distance));
                framed = null;
                free = false;
                if (now || still) {
                    camera.position.copy(p1);
                    controls.target.copy(target);
                    fly = null;
                }
                else
                    fly = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1: target, t: 0 };
            }
            else {
                let spots;
                let tilt = 32;
                if (cam === "fit" || cam === "top") {
                    spots = lives.filter((l) => sc.raised.has(l.area.id) && inMode(l)).flatMap(ringSpots);
                    if (cam === "top")
                        tilt = 90;
                }
                else {
                    spots = cam.frame.flatMap((t) => targetSpots(t, [...procs, ...framing]));
                    tilt = cam.tilt ?? 32;
                }
                if (!spots.length)
                    spots = whole();
                framed = { spots, tilt };
                frame(spots, tilt, now);
            }
            view.timeline(time);
            await plateDone;
        },
        timeline: (t) => {
            if (t !== tNow)
                spunAt = performance.now();
            tNow = t;
            for (const g of grows)
                grow(g);
            placePlane();
            dirty = true;
        },
        camera: () => {
            const off = camera.position.clone().sub(controls.target);
            const distance = off.length();
            return {
                azimuth: (THREE.MathUtils.radToDeg(Math.atan2(-off.x, off.z)) + 360) % 360,
                tilt: THREE.MathUtils.radToDeg(Math.asin(off.y / distance)),
                distance,
                target: latLon(controls.target.x, controls.target.z),
            };
        },
        tap: (fn) => {
            tapFn = fn;
        },
        onScreen: () => {
            const seen = (x, y, z) => {
                v.set(x, y * world.scale.y, z).project(camera);
                return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
            };
            const { x: cx, z: cz } = controls.target;
            // shortcut: an area counts when a point of its outline is in view or it lies under the view's centre, so one only
            // crossing the view edge to edge is missed. Upgrade if tap to find misses areas in use.
            const areas = tappable.filter((l) => inMode(l) && (l.rings.some((r) => inRing([cx, cz], r)) || l.rings.some((r) => r.some(([x, z]) => seen(x, l.goal ? nm(l.area.ceiling) : groundAt(x, z), z)))));
            const at = (lat, lon) => [lat, lon];
            return [
                ...areas.map((l) => ({ area: l.area.id, name: l.area.name, floor: feetText(l.area.floor, data.ground), ceiling: feetText(l.area.ceiling, data.ground) })),
                ...shownFixes.filter(({ fix: f, tag }) => tag.live() && seen(X(f.lon), nm(f.ft), Z(f.lat))).map(({ fix: f }) => ({ fix: f.name, name: f.name, at: at(f.lat, f.lon) })),
                ...data.airports.filter((a) => a.procedures.length && seen(X(a.lon), nm(a.elev), Z(a.lat))).map((a) => ({ airport: a.id, name: a.name, at: at(a.lat, a.lon) })),
            ];
        },
        focus: (c) => {
            unfocus();
            if (!c)
                return;
            if ("area" in c) {
                focusMark = new THREE.Group().add(...(lives.find((l) => l.area.id === c.area)?.rings.map((r) => loop(r, 0xffffff, 3)) ?? []));
            }
            else {
                const [lat, lon] = c.at;
                // A fix is ringed at its altitude, an airport on the ground.
                const fix = "fix" in c ? shownFixes.find(({ fix: f }) => f.name === c.fix && f.lat === lat && f.lon === lon)?.fix : undefined;
                focusMark = loop(circle(X(lon), Z(lat), 0.4), 0xffffff, 3, fix && nm(fix.ft));
            }
            world.add(focusMark);
            dirty = true;
        },
        hints: (on) => {
            host.classList.toggle("sc-no-hints", !on);
            for (const t of approachTags)
                t.w = 0; // the altitudes change the tags' widths
            dirty = true;
        },
    };
    frame(whole(), 32, true);
    let last = performance.now();
    renderer.setAnimationLoop((now) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        for (const l of lives) {
            if (l.t !== l.goal) {
                l.t = l.goal > l.t ? Math.min(1, l.t + dt / RAISE_SECONDS) : Math.max(0, l.t - dt / RAISE_SECONDS);
                dirty = true;
            }
            const ease = l.t * (2 - l.t);
            l.group.visible = l.t > 0 && inMode(l);
            l.group.scale.y = Math.max(ease, 0.001);
        }
        if (twoMoved)
            readTwoFingers();
        if (fly) {
            fly.t = Math.min(1, fly.t + dt / 0.7);
            const e = fly.t * fly.t * (3 - 2 * fly.t);
            camera.position.lerpVectors(fly.p0, fly.p1, e);
            controls.target.lerpVectors(fly.t0, fly.t1, e);
            dirty = true;
            if (fly.t === 1)
                fly = null;
        }
        // The propeller turns while the timeline moves (a walkthrough playing), not when paused or with reduced motion.
        if (prop && craft?.visible && !still && now - spunAt < 250) {
            prop.rotation.z += dt * 40;
            dirty = true;
        }
        if (free)
            keepOnChart();
        controls.update();
        if (!dirty)
            return;
        dirty = false;
        renderer.render(scene, camera);
        place();
    });
    return view;
}

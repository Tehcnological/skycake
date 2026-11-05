// 3D airspace over the FAA TAC: the chart, draped over real terrain, is the ground. Areas lie flat (the chart prints them)
// until raised, then stand from floor to ceiling in the chart's own colors and line styles. Approaches draw over it.
// Drag to orbit, scroll or pinch to zoom, hover or tap for a label, tap to raise or lower. Units are nautical miles;
// heights are stretched (exaggerate) so shelves read. Draw order: terrain, then lines and approaches, then a depth-only
// pass, then the fills, so only the nearest surface of a stack is tinted and shelves read as one piece of glass.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { clipRing, deepest, hundreds, inRing, type AirspaceFile, type Area, type Bounds, type Kind } from "./airspace.js";
import type { Point, Procedure, Segment } from "./procedure.js";
import { fixTags } from "./roam.js";
import type { Resolved, Target } from "./scene.js";

const FT_PER_NM = 6076;
const BLUE = 0x2f6bff;
const MAGENTA = 0xd0349c;
type Style = { color: number; wall: number; roof: number; line: "solid" | "dashed" | "hatch" | "none"; walls: boolean };
// After the chart legend: B solid blue, C solid magenta, D dashed blue, E dashed magenta, E 700 ft a magenta tint,
// Mode C a thin magenta outline, restricted/prohibited/warning hatched blue, MOA/alert hatched magenta.
export const STYLE: Record<Kind, Style> = {
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
const PATH: Record<Segment, number> = { transition: 0xffffff, final: 0x22d36b, common: 0x22d36b, missed: 0xffc21a, vectors: 0xffffff };
const RAISE_SECONDS = 0.35;
export const START_SCALE = 1;

// Vertical stripes for hatched walls.
function stripes(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 6, 16);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

// Fades the chart out toward its edge. Per pixel because canvas blur filters don't exist in every browser.
function softEdge(): THREE.Texture {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
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

function el(tag: string, cls: string, ...kids: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.append(...kids);
  return e;
}
/** Ceiling over floor, as the chart prints them. */
export const fraction = (a: Area, ground: number) => el("div", `frac ${STYLE[a.kind].color === MAGENTA ? "m" : "b"}`, el("b", "", hundreds(a.ceiling, ground)), el("b", "", hundreds(a.floor, ground)));

export type View = {
  /** Raises or lowers every area of a type. */
  raise(kind: Kind, on: boolean): void;
  exaggerate(n: number): void;
  tags(on: boolean): void;
  /** Raises or lowers one area, by id. */
  raiseArea(id: string, on: boolean): void;
  /** The ids of the areas raised now, by any means: a scene, the type list or a tap on the chart. */
  raisedAreas(): string[];
  /**
   * Shows a scene. procedures: the procedure files' objects for scene.procedures, same order. now: no animation.
   * framing: files for procedures the camera frames but the scene does not show (framedOnly()); not drawn.
   */
  apply(scene: Resolved, procedures: Procedure[], now?: boolean, framing?: Procedure[]): Promise<void>;
  /** Keyboard: turns the camera around the target (radians), within the same limits as the mouse. */
  orbit(azimuth: number, polar: number): void;
  /** Keyboard: moves the camera closer (factor < 1) or farther (factor > 1). */
  zoom(factor: number): void;
};
type Tag = { el: HTMLElement; at: THREE.Vector3; pri: number; live: () => boolean; w: number; h: number };
type Live = { area: Area; group: THREE.Group; rings: number[][][]; picks: THREE.Mesh[]; t: number; goal: number; size: number };

export async function build(
  host: HTMLElement,
  data: AirspaceFile,
  label: (a: Area | null, x: number, y: number) => void,
  raised: (kind: Kind, on: boolean) => void,
  /** A tap on an airport's tag on the chart. */
  airport: (id: string) => void = () => {},
): Promise<View> {
  const { bounds: b } = data;
  const lat0 = (b.s + b.n) / 2, lon0 = (b.w + b.e) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const X = (lon: number) => (lon - lon0) * 60 * k;
  const Z = (lat: number) => -(lat - lat0) * 60;
  const nm = (ft: number) => ft / FT_PER_NM;
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.prepend(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 300;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // stay above the chart
  let dirty = true;
  controls.addEventListener("change", () => (dirty = true));

  // The ground: the chart draped over the elevation grid. Without the grid it lies flat at the field elevation.
  const { nx, ny, url } = data.dem;
  const grid = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const dem = grid && new Int16Array(grid);
  // Bilinear between the grid points, which are the ground mesh's vertices.
  const groundAt = (x: number, z: number) => {
    if (!dem) return nm(data.ground);
    const fi = Math.max(0, Math.min(nx - 1, ((x + width / 2) / width) * (nx - 1)));
    const fj = Math.max(0, Math.min(ny - 1, ((z + depth / 2) / depth) * (ny - 1)));
    const i = Math.min(Math.floor(fi), nx - 2), j = Math.min(Math.floor(fj), ny - 2);
    const [a, c] = [fi - i, fj - j];
    const h = (di: number, dj: number) => dem[(j + dj) * nx + i + di];
    return nm((h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - c) + (h(0, 1) * (1 - a) + h(1, 1) * a) * c);
  };
  const ground = new THREE.PlaneGeometry(width, depth, nx - 1, ny - 1);
  ground.rotateX(-Math.PI / 2);
  const pos = ground.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, nm(dem ? dem[i] : data.ground));
  ground.computeVertexNormals();
  // A sheet a set height above the ground, for floors written AGL. It lies on a grid of cells twice the terrain's,
  // each corner lifted above the highest ground around it so no ridge pokes through; cells on the edge are cut to the
  // outline.
  const S = 2, cx = Math.ceil((nx - 1) / S), cz = Math.ceil((ny - 1) / S), cw = width / cx, cd = depth / cz;
  let top: Float32Array | null = null;
  const drape = (ring: number[][], agl: number) => {
    if (!top) {
      top = new Float32Array((cx + 1) * (cz + 1));
      for (let j = 0; j <= cz; j++) {
        for (let i = 0; i <= cx; i++) {
          let h = -Infinity;
          for (let dj = -S; dj <= S; dj++) for (let di = -S; di <= S; di++) {
            const fi = Math.max(0, Math.min(nx - 1, i * S + di)), fj = Math.max(0, Math.min(ny - 1, j * S + dj));
            h = Math.max(h, dem ? dem[fj * nx + fi] : data.ground);
          }
          top[j * (cx + 1) + i] = nm(h);
        }
      }
    }
    const t = top;
    const lift = (x: number, z: number) => {
      const fi = Math.max(0, Math.min(cx, (x + width / 2) / cw)), fj = Math.max(0, Math.min(cz, (z + depth / 2) / cd));
      const i = Math.min(Math.floor(fi), cx - 1), j = Math.min(Math.floor(fj), cz - 1);
      const [a, c] = [fi - i, fj - j];
      const h = (di: number, dj: number) => t[(j + dj) * (cx + 1) + i + di];
      return (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - c) + (h(0, 1) * (1 - a) + h(1, 1) * a) * c + agl;
    };
    const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
    const verts: number[] = [];
    for (let j = Math.max(0, Math.floor((Math.min(...zs) + depth / 2) / cd)); j < Math.min(cz, Math.ceil((Math.max(...zs) + depth / 2) / cd)); j++) {
      for (let i = Math.max(0, Math.floor((Math.min(...xs) + width / 2) / cw)); i < Math.min(cx, Math.ceil((Math.max(...xs) + width / 2) / cw)); i++) {
        const x0 = -width / 2 + i * cw, z0 = -depth / 2 + j * cd;
        // clipRing takes [lat, lon] against s/n and w/e; here the first coordinate is x and the second z.
        const cut = clipRing(ring as [number, number][], { s: x0, n: x0 + cw, w: z0, e: z0 + cd });
        if (cut.length < 3) continue;
        const pts = cut.map(([x, z]) => new THREE.Vector2(x, z));
        for (const tri of THREE.ShapeUtils.triangulateShape(pts, [])) for (const k of tri) verts.push(pts[k].x, lift(pts[k].x, pts[k].y), pts[k].y);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  };

  // The sectional everywhere; the TAC, when on, over its own map area.
  const load = async (url: string) => {
    const t = await new THREE.TextureLoader().loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const tac = data.charts.tac;
  const [sectional, tacTex] = await Promise.all([load(data.charts.sectional), tac ? load(tac.url) : Promise.resolve(new THREE.Texture())]);
  const span = (lo: number, hi: number, a: number, b: number) => [(lo - a) / (b - a), (hi - a) / (b - a)];
  const [u0, u1] = tac ? span(tac.bounds.w, tac.bounds.e, b.w, b.e) : [0, 0];
  const [v0, v1] = tac ? span(tac.bounds.s, tac.bounds.n, b.s, b.n) : [0, 0];
  const chartUniforms = { tacMap: { value: tacTex }, tacRect: { value: new THREE.Vector4(u0, v0, u1, v1) }, tacOn: { value: tac ? 1 : 0 } };
  const material = new THREE.MeshLambertMaterial({ map: sectional, alphaMap: softEdge(), transparent: true });
  // Both charts are sampled everywhere and mixed, so mipmaps stay right along the TAC's edge.
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, chartUniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D tacMap;\nuniform vec4 tacRect;\nuniform float tacOn;")
      .replace(
        "#include <map_fragment>",
        `vec4 sectionalColor = texture2D( map, vMapUv );
        vec2 tacUv = ( vMapUv - tacRect.xy ) / ( tacRect.zw - tacRect.xy );
        vec4 tacColor = texture2D( tacMap, clamp( tacUv, 0.0, 1.0 ) );
        float onTac = tacOn * step( 0.0, tacUv.x ) * step( tacUv.x, 1.0 ) * step( 0.0, tacUv.y ) * step( tacUv.y, 1.0 );
        diffuseColor *= mix( sectionalColor, tacColor, onTac );`,
      );
  };
  const chart = new THREE.Mesh(ground, material);
  chart.renderOrder = -1;
  world.add(chart);

  // Tags follow their spot on screen. Procedure tags first, then airspace tags, each highest priority first; one that
  // would overlap a shown tag hides, so an airspace tag never covers a procedure tag (style.css also stacks them over).
  const shelfTags: Tag[] = [];
  const airportTags: Tag[] = [];
  let approachTags: Tag[] = [];
  let tagsOn = true;
  const addTag = (node: HTMLElement, at: THREE.Vector3, pri: number, live: () => boolean, list: Tag[]) => {
    tagBox.append(node);
    node.style.visibility = "hidden";
    list.push({ el: node, at, pri, live, w: 0, h: 0 });
  };
  const v = new THREE.Vector3();
  const place = () => {
    const { clientWidth: w, clientHeight: h } = host;
    const taken: number[][] = [];
    for (const t of [...approachTags, ...airportTags, ...shelfTags]) {
      let show = tagsOn && t.live();
      if (show) {
        if (!t.w) [t.w, t.h] = [t.el.offsetWidth, t.el.offsetHeight];
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

  const fat = (color: number, linewidth: number, dashed: boolean, opacity = 1) =>
    new LineMaterial({ color, linewidth, transparent: true, opacity, dashed, dashSize: 0.5, gapSize: 0.35 });

  // Every area stands in its own group, squashed into the ground while flat.
  const lives: Live[] = [];
  for (const area of data.areas) {
    const s = STYLE[area.kind];
    const group = new THREE.Group();
    group.visible = false;
    world.add(group);
    const rings = area.rings.map((ring) => ring.map(([lat, lon]) => [X(lon), Z(lat)]));
    const live: Live = { area, group, rings, picks: [], t: 0, goal: 0, size: Infinity };
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
      const pre = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, side: THREE.DoubleSide }));
      pre.renderOrder = 1;
      group.add(pre);
      const roof = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.roof, depthWrite: false, side: THREE.DoubleSide });
      const wall = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.wall, depthWrite: false, side: THREE.DoubleSide, ...(s.line === "hatch" ? { map: hatch } : {}) });
      const fill = new THREE.Mesh(geo, [roof, wall]);
      fill.renderOrder = 2;
      live.picks.push(fill);
      group.add(fill);
      // Rims top and bottom, then ribs on corners and every 2.5 NM along the wall.
      const rims: number[] = [], ribs: number[] = [];
      let run = 0;
      r.forEach((p, i) => {
        const n = r[(i + 1) % r.length], o = r[(i + r.length - 1) % r.length];
        for (const h of [area.floor, area.ceiling]) rims.push(p[0], nm(h), p[1], n[0], nm(h), n[1]);
        const turn = Math.abs(Math.atan2(n[1] - p[1], n[0] - p[0]) - Math.atan2(p[1] - o[1], p[0] - o[0]));
        run += Math.hypot(n[0] - p[0], n[1] - p[1]);
        if (Math.min(turn, 2 * Math.PI - turn) > 0.5 || run > 2.5) {
          ribs.push(p[0], nm(floor), p[1], p[0], nm(area.ceiling), p[1]);
          run = 0;
        }
      });
      const rim = new LineSegments2(new LineSegmentsGeometry().setPositions(rims), fat(s.color, 1.6, s.line === "dashed"));
      if (s.line === "dashed") rim.computeLineDistances();
      group.add(rim);
      if (ribs.length) group.add(new LineSegments2(new LineSegmentsGeometry().setPositions(ribs), fat(s.color, 1, false, 0.45)));
    }
    if (s.walls) {
      // The chart's own form: ceiling over floor, on the widest ring.
      const widest = rings.reduce((a, c) => (c.length > a.length ? c : a));
      const [x, z] = deepest(widest);
      const node = fraction(area, data.ground);
      node.classList.add("tag");
      addTag(node, new THREE.Vector3(x, nm(area.ceiling), z), 5 - Math.min(4, Math.log10(live.size + 1)), () => live.t === 1, shelfTags);
    }
  }
  shelfTags.sort((a, c) => a.pri - c.pri);
  // Airports with procedures get a tag at the field; tapping it makes the airport current.
  for (const a of data.airports) {
    if (!a.procedures.length) continue;
    const node = el("button", "tag apt", a.id);
    node.setAttribute("type", "button");
    node.addEventListener("click", () => airport(a.id));
    addTag(node, new THREE.Vector3(X(a.lon), nm(a.elev), Z(a.lat)), 0, () => true, airportTags);
  }
  const tappable = lives.filter((l) => l.area.kind !== "E700" && l.area.kind !== "MODEC").sort((a, c) => a.size - c.size);

  const setKind = (kind: Kind) => raised(kind, lives.some((l) => l.area.kind === kind && l.goal === 1));
  const set = (l: Live, on: boolean) => {
    l.goal = on ? 1 : 0;
    if (still) l.t = l.goal;
    setKind(l.area.kind);
    dirty = true;
  };

  // Eases the camera to a view of the given spots, from the south so the chart reads upright, tilted the given
  // degrees above the horizon (90 looks straight down with north up).
  let fly: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; t: number } | null = null;
  const frame = (spots: THREE.Vector3[], tiltDeg = 32, now = false) => {
    const box = new THREE.Box3();
    const scaled = spots.map((s) => new THREE.Vector3(s.x, s.y * world.scale.y, s.z));
    for (const s of scaled) box.expandByPoint(s);
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
    } else fly = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1: center, t: 0 };
  };
  // What is framed now, so a resize or a height change can frame it again.
  let framed: { spots: THREE.Vector3[]; tilt: number; procedures: boolean } | null = null;
  const whole = () => [new THREE.Vector3(-width / 2, 0, -depth / 2), new THREE.Vector3(width / 2, 0, depth / 2)];
  const ringSpots = (l: Live) => l.rings.flat().map(([x, z]) => new THREE.Vector3(x, nm(l.area.ceiling), z));

  // Procedures: each path outlined in black at a constant width on screen, the missed approach dashed yellow and black.
  // A curtain drops from the path to the ground so its height reads from any angle.
  const route = new THREE.Group();
  world.add(route);
  const toLocal = ([lat, lon, ft]: Point) => new THREE.Vector3(X(lon), nm(ft), Z(lat));
  const path = (pts: THREE.Vector3[], color: number, dashed: boolean) => {
    if (pts.length < 2) return;
    const positions = pts.flatMap((p) => [p.x, p.y, p.z]);
    // The outline writes no depth: at the same depth as the color line, the two would flicker.
    const under = new Line2(new LineGeometry().setPositions(positions), new LineMaterial({ color: 0x000000, linewidth: 7.5, transparent: true, depthWrite: false }));
    under.renderOrder = 0.1;
    const top = new Line2(new LineGeometry().setPositions(positions), new LineMaterial({ color, linewidth: 4.5, transparent: true, dashed, dashSize: 0.7, gapSize: 0.6 }));
    top.renderOrder = 0.2;
    if (dashed) top.computeLineDistances();
    route.add(under, top);
  };
  const curtain = (pts: THREE.Vector3[], color: number, opacity: number) => {
    const verts: number[] = [], index: number[] = [];
    let n = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const steps = Math.max(1, Math.ceil(pts[i].distanceTo(pts[i + 1]) / 0.3));
      for (let s = 0; s <= steps; s++) {
        const p = pts[i].clone().lerp(pts[i + 1], s / steps);
        verts.push(p.x, p.y, p.z, p.x, groundAt(p.x, p.z) - 0.02, p.z);
        if (s < steps) index.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        n += 2;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(index);
    route.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })));
  };
  const clearRoute = () => {
    route.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
    route.clear();
    for (const t of approachTags) t.el.remove();
    approachTags = [];
  };

  // An airport diagram draped a little above the ground, or none. The same one again is left as it is.
  let plate: THREE.Mesh | null = null, plateUrl: string | null = null, plateTicket = 0;
  const showDiagram = async (d: { url: string; bounds: Bounds } | null) => {
    if ((d?.url ?? null) === plateUrl) return;
    const ticket = ++plateTicket;
    plateUrl = d?.url ?? null;
    if (plate) {
      world.remove(plate);
      plate.geometry.dispose();
      (plate.material as THREE.MeshBasicMaterial).map?.dispose();
      (plate.material as THREE.Material).dispose();
      plate = null;
      dirty = true;
    }
    if (!d) return;
    const map = await new THREE.TextureLoader().loadAsync(d.url).catch(() => null);
    if (!map || ticket !== plateTicket) return map?.dispose();
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const [x0, x1, z0, z1] = [X(d.bounds.w), X(d.bounds.e), Z(d.bounds.n), Z(d.bounds.s)];
    // The image's top is north.
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 24, 24);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const at = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < at.count; i++) at.setY(i, groundAt(at.getX(i), at.getZ(i)) + nm(40));
    plate = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    plate.renderOrder = 0.05;
    world.add(plate);
    dirty = true;
  };

  // Where a scene's target is: an area's outline at its ceiling, a fix on a shown procedure, a procedure's paths, a
  // point on the ground.
  const targetSpots = (t: Target, procs: Procedure[]): THREE.Vector3[] => {
    if ("area" in t) return lives.filter((l) => l.area.id === t.area).flatMap(ringSpots);
    if ("fix" in t) return procs.flatMap((p) => p.fixes).filter((f) => f.name === t.fix).slice(0, 1).map((f) => new THREE.Vector3(X(f.lon), nm(f.ft), Z(f.lat)));
    if ("procedure" in t) return procs.filter((p) => p.airport === t.procedure.airport && p.name === t.procedure.name).flatMap((p) => p.paths.flatMap((x) => x.pts.map(toLocal)));
    if ("diagram" in t) {
      const d = data.airports.find((a) => a.id === t.diagram)?.diagram;
      if (!d) return [];
      return [[d.bounds.w, d.bounds.n], [d.bounds.e, d.bounds.n], [d.bounds.w, d.bounds.s], [d.bounds.e, d.bounds.s]].map(([lon, lat]) => new THREE.Vector3(X(lon), groundAt(X(lon), Z(lat)), Z(lat)));
    }
    const [lat, lon] = t.point;
    return [new THREE.Vector3(X(lon), groundAt(X(lon), Z(lat)), Z(lat))];
  };

  // Hover or tap shows the area under the pointer: a raised one first, else the flat one printed on the chart there.
  const ray = new THREE.Raycaster();
  const pick = (e: PointerEvent): Live | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const up = lives.filter((l) => l.goal === 1);
    const hit = ray.intersectObjects(up.flatMap((l) => l.picks))[0];
    if (hit) return up.find((l) => l.picks.includes(hit.object as THREE.Mesh)) ?? null;
    // March down the ray to the terrain; three's own raycast would test every triangle.
    const { origin, direction: d } = ray.ray;
    if (d.y >= 0) return null;
    for (let s = 0, p = origin.clone(); s < 800; s++) {
      p.addScaledVector(d, 0.5);
      if (p.y > groundAt(p.x, p.z) * world.scale.y) continue;
      return tappable.find((l) => l.goal === 0 && l.rings.some((ring) => inRing([p.x, p.z], ring))) ?? null;
    }
    return null;
  };
  const tell = (l: Live | null, e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    label(l && l.area, e.clientX - r.left, e.clientY - r.top);
  };
  const el3d = renderer.domElement;
  el3d.addEventListener("pointermove", (e) => e.pointerType === "mouse" && !e.buttons && tell(pick(e), e));
  el3d.addEventListener("pointerleave", () => label(null, 0, 0));
  // A tap (not a drag): a flat area rises; a raised one is picked, then lowers on the next tap.
  let down = [0, 0];
  let picked: Live | null = null;
  el3d.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
  el3d.addEventListener("pointerup", (e) => {
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const l = pick(e);
    if (l && l.goal === 1 && picked === l) {
      set(l, false);
      picked = null;
      return label(null, 0, 0);
    }
    if (l && l.goal === 0) set(l, true);
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
    if (changed && framed) frame(framed.spots, framed.tilt, true);
  };
  new ResizeObserver(size).observe(host);
  size();

  const view: View = {
    raise: (kind, on) => {
      for (const l of lives) if (l.area.kind === kind) set(l, on);
      setKind(kind);
    },
    exaggerate: (n) => {
      controls.target.y *= n / world.scale.y;
      world.scale.y = n;
      dirty = true;
      // A procedure's far ends move on screen with its height, so keep all of it in view.
      if (framed?.procedures) frame(framed.spots, framed.tilt);
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
      fly = null;
      dirty = true;
    },
    zoom: (factor) => {
      const off = camera.position.clone().sub(controls.target);
      off.setLength(Math.min(Math.max(off.length() * factor, controls.minDistance), controls.maxDistance));
      camera.position.copy(controls.target).add(off);
      fly = null;
      dirty = true;
    },
    raiseArea: (id, on) => {
      const l = lives.find((x) => x.area.id === id);
      if (l) set(l, on);
    },
    raisedAreas: () => lives.filter((l) => l.goal === 1).map((l) => l.area.id),
    apply: async (sc, procs, now = false, framing = []) => {
      for (const l of lives) set(l, sc.raised.has(l.area.id));
      if (world.scale.y !== sc.height) {
        controls.target.y *= sc.height / world.scale.y;
        world.scale.y = sc.height;
      }
      tagsOn = sc.tags;
      chartUniforms.tacOn.value = sc.chart === "tac" && tac ? 1 : 0;
      clearRoute();
      for (const a of procs) {
        for (const p of a.paths) {
          const pts = p.pts.map(toLocal);
          const main = p.seg === "final" || p.seg === "common";
          curtain(pts, PATH[p.seg], main ? 0.28 : p.seg === "vectors" ? 0.08 : 0.14);
          path(pts, PATH[p.seg], p.seg === "missed" || p.seg === "vectors");
        }
      }
      for (const f of fixTags(procs)) {
        const cls = f.seg === "final" || f.seg === "common" ? "g" : f.seg === "missed" ? "y" : "w";
        const node = el("div", `tag fix ${cls}`, el("b", "", f.name, ...(f.role ? [el("i", "", f.role)] : [])), ...(f.alt ? [f.alt] : []));
        addTag(node, new THREE.Vector3(X(f.lon), nm(f.ft), Z(f.lat)), f.role === "FAF" || f.role === "MAP" ? 0 : f.role ? 1 : 2, () => true, approachTags);
      }
      approachTags.sort((x, y) => x.pri - y.pri);
      const plateDone = showDiagram(sc.diagram ? (data.airports.find((a) => a.id === sc.diagram)?.diagram ?? null) : null);
      const cam = sc.camera;
      if (cam === null) {
        // Leave the camera where it is; a procedure's height change still reframes what was framed.
        if (framed) framed.procedures = procs.length > 0;
      } else if (typeof cam === "object" && "azimuth" in cam) {
        // Placed directly: looking toward the azimuth (degrees true), tilt degrees above the horizon, distance in NM.
        const [lat, lon] = cam.target;
        const target = new THREE.Vector3(X(lon), groundAt(X(lon), Z(lat)) * world.scale.y, Z(lat));
        const [az, t] = [(cam.azimuth * Math.PI) / 180, (cam.tilt * Math.PI) / 180];
        const p1 = target.clone().add(new THREE.Vector3(-Math.sin(az) * Math.cos(t), Math.sin(t), Math.cos(az) * Math.cos(t)).multiplyScalar(cam.distance));
        framed = null;
        if (now || still) {
          camera.position.copy(p1);
          controls.target.copy(target);
          fly = null;
        } else fly = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1: target, t: 0 };
      } else {
        let spots: THREE.Vector3[];
        let tilt = 32;
        if (cam === "fit" || cam === "top") {
          spots = lives.filter((l) => sc.raised.has(l.area.id)).flatMap(ringSpots);
          if (cam === "top") tilt = 90;
        } else {
          spots = cam.frame.flatMap((t) => targetSpots(t, [...procs, ...framing]));
          tilt = cam.tilt ?? 32;
        }
        if (!spots.length) spots = whole();
        framed = { spots, tilt, procedures: procs.length + framing.length > 0 };
        frame(spots, tilt, now);
      }
      dirty = true;
      await plateDone;
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
      l.group.visible = l.t > 0;
      l.group.scale.y = Math.max(ease, 0.001);
    }
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 0.7);
      const e = fly.t * fly.t * (3 - 2 * fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      dirty = true;
      if (fly.t === 1) fly = null;
    }
    controls.update();
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
    place();
  });

  return view;
}

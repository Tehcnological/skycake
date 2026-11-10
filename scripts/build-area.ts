/**
 * Builds each area's data for skycake from public domain FAA and USGS sources, into data/<area>/:
 *   sectional.webp     the area's sectional, cropped to BOUNDS and reprojected to plain lat/lon
 *   tac.webp           its TAC over the TAC's own map area (TAC_AREA), the same way
 *   low.webp           the FAA IFR low enroute sheet covering the area, the same way
 *   area.webp          the FAA IFR area chart over its own map, the same way
 *   dem.bin            USGS 3DEP terrain at the view's grid points over BOUNDS, 16-bit feet
 *   area.json          class airspace, Mode C veil, special use airspace inside BOUNDS, and the airports
 *   procedures/*.json  approaches, departures and arrivals of each airport inside BOUNDS, from the CIFP
 *   diagrams/*.webp    FAA airport diagrams (d-TPP), north up, placed by their own ticks
 *   charts/*.png       FAA approach, departure and arrival charts (d-TPP), one greyscale page per PDF, turned to read left to right
 *   charts/*.json      each airport's charts and the procedures they draw (src/tpp.ts)
 *
 *   npm run data                     # every area, current chart edition
 *   npm run data -- miami            # one area
 *   npm run data -- 2026-10-29       # a given edition (effective date)
 *   npm run data -- --terrain-only
 *   npm run data -- --cycle          # print the 28-day cycle in effect, build nothing
 *
 * Downloads go to .cache/ (git-ignored) and are reused. Airspace comes from the FAA's ADDS open data service
 * (same NASR data, already in lat/lon). Charts change every 56 days and procedures every 28; rerun this then.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { createCanvas } from "@napi-rs/canvas";
import { fromArrayBuffer, fromUrl } from "geotiff";
import proj4 from "proj4";
import sharp from "sharp";
import simplify from "simplify-js";
import { TOP, areaIds, classKind, clipRing, feet, suaKind, type AirspaceFile, type Area, type Bounds, type Ring } from "../src/airspace.js";
import { parseAirways } from "../src/airway.js";
import { boundsOf, fitLabels, frame, labelValue, northUp, readOutlines, type Glyph } from "../src/diagram.js";
import { airportsOffMap, parseProcedures, type Airport } from "../src/procedure.js";
import { airportBlock, chartGroups, chartRecords, noChart, pageFile, pageTurn, proceduresOn, type ChartEntry } from "../src/tpp.js";

const ROOT = join(import.meta.dirname, "..");
const DAY = 86_400_000;
const KNOWN_EDITION = Date.UTC(2026, 9, 29); // VFR charts repeat every 56 days.
// Each area: bounds holding every approach at its airports, clear of the chart's fade (viewer.ts); the TAC's map, inside
// its neatline so no collar shows; the field elevation where heights written above the ground start; terrain cells
// about 0.25 NM square; the FAA's name for its charts; its IFR area chart, with the map inside its neatline as for the TAC;
// its IFR low sheet, with the map panel in pixels (the sheets are tilted and also hold tables and a second side).
type AreaSetup = { bounds: Bounds; tac: Bounds; ground: number; dem: { nx: number; ny: number }; charts: string; sea?: boolean; ifrArea: { zip: string; tif: string; bounds: Bounds }; low: { zip: string; tif: string; panel: Panel } };
type Panel = [c0: number, r0: number, c1: number, r1: number];
const AREAS: Record<string, AreaSetup> = {
  // Phoenix to Tucson. The TAC's neatline is 34°05' N, 32°47' N; its east and west edges lean slightly.
  phoenix: { bounds: { s: 31.8, w: -113, n: 34.25, e: -110.27 }, tac: { s: 32.795, w: -112.845, n: 34.07, e: -111.195 }, ground: 1135, dem: { nx: 548, ny: 587 }, charts: "Phoenix", ifrArea: { zip: "enr_a02", tif: "ENR_A02_PHX.tif", bounds: { s: 32.794, w: -112.834, n: 34.093, e: -111.259 } }, low: { zip: "enr_l05", tif: "ENR_L05.tif", panel: [6205, 265, 21795, 7735] } },
  // Key West to Palm Beach; Lantana's RNAV (GPS)-B sets the north edge and Opa-locka's transitions the east. The TAC stops
  // at 25.49 N, above its Florida Keys inset, which is not drawn where the Keys are; the sectional shows them. L-23 ends just
  // south of Key West, short of the area's south edge, and the sheet that holds that water (L-21) stops at Key West: white there.
  miami: { bounds: { s: 24.4, w: -82.03, n: 27.32, e: -79.55 }, tac: { s: 25.49, w: -81.16, n: 26.76, e: -79.55 }, ground: 9, dem: { nx: 537, ny: 702 }, charts: "Miami", sea: true, ifrArea: { zip: "enr_a01", tif: "ENR_A01_MIA.tif", bounds: { s: 25.408, w: -80.828, n: 26.308, e: -79.816 } }, low: { zip: "enr_l23", tif: "ENR_L23.tif", panel: [5185, 265, 21795, 7735] } },
};
// The longer side of each chart image; 4096 is the largest texture every phone takes.
const SIDE = 4096;

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const date = args.find((a) => !(a in AREAS));
const now = date ? Date.parse(date) : Date.now();
// The edition in effect on that date.
const edition = new Date(KNOWN_EDITION + Math.floor((now - KNOWN_EDITION) / (56 * DAY)) * 56 * DAY);
const [y, m, d] = edition.toISOString().slice(0, 10).split("-");
const ADDS = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services";
const cache = join(ROOT, ".cache", "charts", `${y}-${m}-${d}`);
// The area being built.
let BOUNDS: Bounds, GROUND: number, DEM: { nx: number; ny: number }, SEA: boolean, OUT: string;

async function download(url: string, dir = cache): Promise<Uint8Array> {
  const file = join(dir, url.split("/").pop()!);
  if (!existsSync(file)) {
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    await mkdir(dir, { recursive: true });
    await writeFile(file, new Uint8Array(await res.arrayBuffer()));
  }
  return new Uint8Array(await readFile(file));
}

// ---- Charts: a Lambert conformal conic image (palette or RGB, north up or tilted) to an equirectangular RGB texture over an
// area. Anything outside the panel, if given, is left white.
async function chart(url: string, tifName: string, area: Bounds, name: string, panel?: Panel) {
  const zip = unzipSync(await download(url), { filter: (f) => f.name.endsWith(tifName) });
  const tif = Object.values(zip)[0];
  if (!tif) throw new Error(`no ${tifName} in ${url}`);
  const img = await (await fromArrayBuffer(tif.buffer.slice(tif.byteOffset, tif.byteOffset + tif.byteLength) as ArrayBuffer)).getImage();
  const k = img.getGeoKeys();
  if (k.ProjCoordTransGeoKey !== 8) throw new Error("expected a Lambert conformal conic chart");
  const lcc = `+proj=lcc +lat_1=${k.ProjStdParallel1GeoKey} +lat_2=${k.ProjStdParallel2GeoKey} +lat_0=${k.ProjFalseOriginLatGeoKey} +lon_0=${k.ProjFalseOriginLongGeoKey} +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs`;
  const toChart = proj4("EPSG:4326", lcc);
  const [ox, oy] = img.getOrigin();
  const [rx, ry] = img.getResolution();
  // World from pixel: x = t0 c + t1 r + t3, y = t4 c + t5 r + t7. The VFR charts are north up; the IFR sheets carry a tilt.
  const tf: number[] = img.fileDirectory.ModelTransformation ?? [rx, 0, 0, ox, 0, ry, 0, oy];
  const det = tf[0] * tf[5] - tf[1] * tf[4];
  const toPixel = ([x, y]: number[]) => [(tf[5] * (x - tf[3]) - tf[1] * (y - tf[7])) / det, (tf[0] * (y - tf[7]) - tf[4] * (x - tf[3])) / det];
  // Only the window the area needs: a sectional is 18,000 pixels across.
  const edge: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.125) edge.push([area.w + t * (area.e - area.w), area.s], [area.w + t * (area.e - area.w), area.n], [area.w, area.s + t * (area.n - area.s)], [area.e, area.s + t * (area.n - area.s)]);
  const at = edge.map((p) => toChart.forward(p)).map(toPixel);
  const c0 = Math.max(0, Math.floor(Math.min(...at.map((p) => p[0]))) - 2), r0 = Math.max(0, Math.floor(Math.min(...at.map((p) => p[1]))) - 2);
  const c1 = Math.min(img.getWidth(), Math.ceil(Math.max(...at.map((p) => p[0]))) + 2), r1 = Math.min(img.getHeight(), Math.ceil(Math.max(...at.map((p) => p[1]))) + 2);
  const sw = c1 - c0, sh = r1 - r0;
  const src = (await img.readRasters({ interleave: true, window: [c0, r0, c1, r1] })) as Uint8Array;
  const cmap = img.fileDirectory.ColorMap as Uint16Array | undefined; // R, G, B planes of 256, 16-bit; the IFR sheets are RGB
  const n = cmap ? cmap.length / 3 : 0;

  // Pixels square on the ground, the longer side SIDE.
  const aspect = (area.n - area.s) / ((area.e - area.w) * Math.cos((((area.s + area.n) / 2) * Math.PI) / 180));
  const WIDTH = aspect > 1 ? Math.round(SIDE / aspect) : SIDE;
  const height = aspect > 1 ? SIDE : Math.round(SIDE * aspect);
  const out = new Uint8Array(WIDTH * height * 3);
  // Source pixel for an output position; the projection is smooth, so a 2x2 supersample is plenty.
  const pixel = (u: number, v: number) => {
    const [c, r] = toPixel(toChart.forward([area.w + (u / WIDTH) * (area.e - area.w), area.n - (v / height) * (area.n - area.s)]));
    return [c - c0, r - r0];
  };
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < WIDTH; u++) {
      let r = 0, g = 0, b = 0;
      for (const [du, dv] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const [c, row] = pixel(u + du, v + dv);
        if (panel && (c + c0 < panel[0] || row + r0 < panel[1] || c + c0 > panel[2] || row + r0 > panel[3])) {
          r += 255;
          g += 255;
          b += 255;
          continue;
        }
        const i = Math.min(sh - 1, Math.max(0, Math.floor(row))) * sw + Math.min(sw - 1, Math.max(0, Math.floor(c)));
        if (cmap) {
          const p = src[i];
          r += cmap[p] >> 8;
          g += cmap[p + n] >> 8;
          b += cmap[p + 2 * n] >> 8;
        } else {
          r += src[i * 3];
          g += src[i * 3 + 1];
          b += src[i * 3 + 2];
        }
      }
      const o = (v * WIDTH + u) * 3;
      out[o] = r >> 2;
      out[o + 1] = g >> 2;
      out[o + 2] = b >> 2;
    }
  }
  const file = join(OUT, name);
  await mkdir(OUT, { recursive: true });
  await sharp(out, { raw: { width: WIDTH, height, channels: 3 } }).webp({ quality: 78 }).toFile(file);
  console.log(`${name} ${WIDTH}x${height}`);
}

// ---- Airspace from ADDS, as GeoJSON in lat/lon.
type Feature = { properties: Record<string, string | number | null>; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } | null };
async function query(layer: string): Promise<Feature[]> {
  const q = new URLSearchParams({
    where: "1=1",
    geometry: `${BOUNDS.w},${BOUNDS.s},${BOUNDS.e},${BOUNDS.n}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    geometryPrecision: "5",
    f: "geojson",
  });
  const res = await fetch(`${ADDS}/${layer}/FeatureServer/0/query?${q}`);
  if (!res.ok) throw new Error(`${res.status} for ${layer}`);
  const body = (await res.json()) as { features: Feature[]; exceededTransferLimit?: boolean };
  if (body.exceededTransferLimit) throw new Error(`${layer}: too many features for one page`);
  return body.features;
}

const polygons = (g: NonNullable<Feature["geometry"]>) => (g.type === "Polygon" ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]));
function rings(g: Feature["geometry"]): Ring[] {
  if (!g) return [];
  return polygons(g).flatMap((poly) =>
    poly.map((ring) => {
      const s = simplify(ring.map(([x, y]) => ({ x, y })), 0.0003, true);
      return clipRing(s.map((p) => [Math.round(p.y * 1e5) / 1e5, Math.round(p.x * 1e5) / 1e5] as [number, number]), BOUNDS);
    }).filter((r) => r.length >= 3),
  );
}

// The highest ground under a set of rings ([lat, lon]), from the terrain grid: the base of a Class E surface area, whose
// top is drawn where the 700 ft floor around it starts.
function highestGround(ft: Int16Array, rs: Ring[]): number {
  let top = -Infinity;
  for (const ring of rs) {
    const lats = ring.map((p) => p[0]), lons = ring.map((p) => p[1]);
    const j0 = Math.max(0, Math.floor(((BOUNDS.n - Math.max(...lats)) / (BOUNDS.n - BOUNDS.s)) * (DEM.ny - 1)));
    const j1 = Math.min(DEM.ny - 1, Math.ceil(((BOUNDS.n - Math.min(...lats)) / (BOUNDS.n - BOUNDS.s)) * (DEM.ny - 1)));
    const i0 = Math.max(0, Math.floor(((Math.min(...lons) - BOUNDS.w) / (BOUNDS.e - BOUNDS.w)) * (DEM.nx - 1)));
    const i1 = Math.min(DEM.nx - 1, Math.ceil(((Math.max(...lons) - BOUNDS.w) / (BOUNDS.e - BOUNDS.w)) * (DEM.nx - 1)));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const lat = BOUNDS.n - (j / (DEM.ny - 1)) * (BOUNDS.n - BOUNDS.s), lon = BOUNDS.w + (i / (DEM.nx - 1)) * (BOUNDS.e - BOUNDS.w);
        let inside = false;
        for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
          const [ya, xa] = ring[k], [yb, xb] = ring[m];
          if (ya > lat !== yb > lat && lon < ((xb - xa) * (lat - ya)) / (yb - ya) + xa) inside = !inside;
        }
        if (inside) top = Math.max(top, ft[j * DEM.nx + i]);
      }
    }
  }
  return Number.isFinite(top) ? top : GROUND;
}

async function airspace(ground: Int16Array): Promise<Area[]> {
  const areas: Omit<Area, "id">[] = [];
  for (const f of await query("Class_Airspace")) {
    const p = f.properties;
    const kind = classKind(p.CLASS as string, p.LOCAL_TYPE as string, Number(p.LOWER_VAL), p.LOWER_CODE as string);
    if (!kind) continue;
    const floor = feet(Number(p.LOWER_VAL), "FT", p.LOWER_CODE as string, GROUND);
    // Class E has no ceiling of its own (-9998): surface areas are drawn up to where the 700 ft floor starts,
    // and the 700 ft area is a sheet.
    const upper = Number(p.UPPER_VAL);
    const rs = rings(f.geometry);
    const ceiling = kind === "E" ? highestGround(ground, rs) + 700 : kind === "E700" ? floor : Math.min(TOP, feet(upper, "FT", p.UPPER_CODE as string, GROUND));
    areas.push({ kind, name: String(p.NAME), floor, ceiling, rings: rs });
  }
  for (const f of await query("Special_Use_Airspace")) {
    const p = f.properties;
    const kind = suaKind(p.TYPE_CODE as string);
    if (!kind) continue;
    const floor = feet(Number(p.LOWER_VAL), p.LOWER_UOM as string, p.LOWER_CODE as string, GROUND);
    const ceiling = Math.min(TOP, feet(Number(p.UPPER_VAL), p.UPPER_UOM as string, p.UPPER_CODE as string, GROUND));
    // Some records carry a placeholder SFC-to-SFC shape; nothing to draw.
    if (ceiling <= floor) continue;
    areas.push({ kind, name: String(p.NAME), floor, ceiling, rings: rings(f.geometry) });
  }
  // A shelf two airports share can come twice, once under each name (Tucson International and Davis-Monthan's
  // Class C); the first one is kept.
  const seen = new Set<string>();
  const kept = areas.filter((a) => {
    const key = `${a.kind}|${a.floor}|${a.ceiling}|${JSON.stringify(a.rings)}`;
    if (a.rings.length === 0 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = areaIds(kept, GROUND);
  return kept.map((a, i) => ({ id: ids[i], ...a }));
}

// ---- Terrain: USGS 3DEP 1 arc-second tiles (public domain), sampled at the view's grid points, as 16-bit feet.
// The grid's corners are the chart's corners, so it can't drift from the chart. (3DEP's exportImage service keeps
// its pixels square and quietly grows the box, which squeezed the terrain north-south.)
async function terrain() {
  type Tile = { data: Float32Array; w: number; h: number; ox: number; oy: number; rx: number; ry: number };
  const tiles: Tile[] = [];
  // A tile n34w113 covers 33 to 34 N, 113 to 112 W. Its first overview level under 4 arc-seconds is plenty for
  // cells about 12 arc-seconds apart, and is a few MB instead of 50.
  for (let n = Math.floor(BOUNDS.s) + 1; n <= Math.ceil(BOUNDS.n); n++) {
    for (let w = Math.ceil(-BOUNDS.e); w <= Math.ceil(-BOUNDS.w); w++) {
      const name = `n${n}w${String(w).padStart(3, "0")}`;
      const url = `https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/${name}/USGS_1_${name}.tif`;
      // 3DEP has no tile for open sea.
      if (SEA && (await fetch(url, { method: "HEAD" })).status === 404) continue;
      const tif = await fromUrl(url);
      const full = await tif.getImage(0);
      const [ox, oy] = full.getOrigin(), [rx, ry] = full.getResolution();
      let img = full;
      for (let i = 1; i < (await tif.getImageCount()); i++) {
        const o = await tif.getImage(i);
        if ((full.getWidth() / o.getWidth()) * rx > 4 / 3600) break;
        img = o;
      }
      const f = full.getWidth() / img.getWidth();
      const [data] = (await img.readRasters()) as unknown as [Float32Array];
      tiles.push({ data, w: img.getWidth(), h: img.getHeight(), ox, oy, rx: rx * f, ry: ry * f });
    }
  }
  // Bilinear, between pixel centers.
  const meters = (lat: number, lon: number) => {
    for (const t of tiles) {
      const c = (lon - t.ox) / t.rx - 0.5, r = (lat - t.oy) / t.ry - 0.5;
      if (c < 0 || r < 0 || c > t.w - 1 || r > t.h - 1) continue;
      const [c0, r0] = [Math.min(Math.floor(c), t.w - 2), Math.min(Math.floor(r), t.h - 2)];
      const [fc, fr] = [c - c0, r - r0];
      // Tiles on the coast mark the sea with a no-data value far below zero.
      const p = (dc: number, dr: number) => (SEA ? Math.max(0, t.data[(r0 + dr) * t.w + c0 + dc]) : t.data[(r0 + dr) * t.w + c0 + dc]);
      return (p(0, 0) * (1 - fc) + p(1, 0) * fc) * (1 - fr) + (p(0, 1) * (1 - fc) + p(1, 1) * fc) * fr;
    }
    if (SEA) return 0;
    throw new Error(`no 3DEP tile covers ${lat}, ${lon}`);
  };
  const ft = new Int16Array(DEM.nx * DEM.ny);
  for (let j = 0; j < DEM.ny; j++) {
    for (let i = 0; i < DEM.nx; i++) {
      const lat = BOUNDS.n - (j / (DEM.ny - 1)) * (BOUNDS.n - BOUNDS.s), lon = BOUNDS.w + (i / (DEM.nx - 1)) * (BOUNDS.e - BOUNDS.w);
      ft[j * DEM.nx + i] = Math.round(meters(lat, lon) * 3.28084);
    }
  }
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "dem.bin"), new Uint8Array(ft.buffer));
  console.log(`terrain ${DEM.nx}x${DEM.ny}, ${ft.reduce((a, b) => Math.min(a, b))} to ${ft.reduce((a, b) => Math.max(a, b))} ft`);
  return ft;
}

// ---- Procedures from the current CIFP cycle (every 28 days, on the same dates as the charts): approaches, departures
// and arrivals for every airport on the chart, one file per airport so the page loads only the one picked.
const cycleDate = new Date(KNOWN_EDITION + Math.floor((now - KNOWN_EDITION) / (28 * DAY)) * 28 * DAY);
// --cycle: print the cycle in effect and stop. The data workflow uses it to see whether a rebuild is due.
if (process.argv.includes("--cycle")) {
  console.log(cycleDate.toISOString().slice(0, 10));
  process.exit(0);
}
async function procedures() {
  const c = cycleDate.toISOString().slice(0, 10).split("-");
  const zip = unzipSync(await download(`https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_${c[0].slice(2)}${c[1]}${c[2]}.zip`), { filter: (f) => f.name === "FAACIFP18" });
  const text = Buffer.from(zip.FAACIFP18).toString("latin1");
  const off = airportsOffMap(text, BOUNDS);
  if (off.size) console.log(`left out, an approach runs off the map: ${[...off].join(" ")}`);
  const { airports, procedures } = parseProcedures(text, BOUNDS);
  const kept = airports.filter((a) => !off.has(a.id));
  const dir = join(OUT, "procedures");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const a of kept) await writeFile(join(dir, `${a.id}.json`), JSON.stringify(procedures.filter((p) => p.airport === a.id)));
  return { airports: kept, ...parseAirways(text, BOUNDS) };
}

type Dtpp = { base: string; dir: string; meta: string };
// The d-TPP of the same cycle: where its PDFs are, the folder they are cached in, and its metafile.
async function dtpp(): Promise<Dtpp> {
  // The d-TPP numbers its cycles YYNN, NN counting from the year's first cycle.
  let first = cycleDate.getTime();
  while (new Date(first - 28 * DAY).getUTCFullYear() === cycleDate.getUTCFullYear()) first -= 28 * DAY;
  const code = `${String(cycleDate.getUTCFullYear()).slice(2)}${String((cycleDate.getTime() - first) / (28 * DAY) + 1).padStart(2, "0")}`;
  const base = `https://aeronav.faa.gov/d-tpp/${code}`;
  const dir = join(ROOT, ".cache", "dtpp", code);
  return { base, dir, meta: Buffer.from(await download(`${base}/xml_data/d-tpp_Metafile.xml`, dir)).toString("utf8") };
}

// ---- Airport diagrams from the d-TPP of the same cycle, placed by their own latitude and longitude ticks, turned
// north up, white made clear. A diagram whose ticks don't fit (src/diagram.ts) is left out and named in the log.
async function diagrams(airports: Airport[], { base, dir, meta }: Dtpp) {
  const out = join(OUT, "diagrams");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  for (const a of airports) {
    const block = airportBlock(meta, a.id);
    const pdf = block && chartRecords(block).find((r) => r.code === "APD")?.pdf;
    if (!pdf) continue;
    const doc = await getDocument({ data: await download(`${base}/${pdf}`, dir), standardFontDataUrl: join(ROOT, "node_modules", "pdfjs-dist", "standard_fonts") + "/", verbosity: 0 }).promise;
    const page = await doc.getPage(1);
    const one = page.getViewport({ scale: 1 });
    // Label centers on the page: half the run along the text, a third of the size up from the baseline.
    const labels = ((await page.getTextContent()).items as { str: string; transform: number[]; width: number; height: number }[]).flatMap((it) => {
      if (!it.str.includes("°")) return [];
      const [ta, tb, tc, td, te, tf] = it.transform;
      const run = Math.hypot(ta, tb), up = Math.hypot(tc, td);
      const [x, y] = one.convertToViewportPoint(te + (ta / run) * (it.width / 2) + (tc / up) * it.height * 0.36, tf + (tb / run) * (it.width / 2) + (td / up) * it.height * 0.36);
      return [{ x, y, text: it.str }];
    });
    // Filled paths in drawing order, in page points, for labels drawn as outlines instead of text.
    const glyphs: Glyph[] = [];
    const ops = await page.getOperatorList();
    let m = [1, 0, 0, 1, 0, 0];
    const saved: number[][] = [];
    const concat = (t: number[]) => { m = [m[0] * t[0] + m[2] * t[1], m[1] * t[0] + m[3] * t[1], m[0] * t[2] + m[2] * t[3], m[1] * t[2] + m[3] * t[3], m[0] * t[4] + m[2] * t[5] + m[4], m[1] * t[4] + m[3] * t[5] + m[5]]; };
    ops.fnArray.forEach((fn, i) => {
      const args = ops.argsArray[i];
      if (fn === OPS.save) saved.push(m);
      else if (fn === OPS.restore) m = saved.pop() ?? m;
      else if (fn === OPS.transform) concat(args);
      else if (fn === OPS.constructPath && (args[0] === OPS.fill || args[0] === OPS.eoFill) && args[1][0]) {
        // pdf.js path: 0 move, 1 line, 2 curve, 3 quadratic, 4 close, each followed by its numbers. End points only.
        const d: ArrayLike<number> = args[1][0], contours: number[][][] = [];
        let segs = 0;
        for (let k = 0; k < d.length; ) {
          const c = d[k++], n = [2, 2, 6, 4, 0][c];
          if (c === 0) contours.push([]); else if (c !== 4) segs++;
          if (n) contours[contours.length - 1].push(one.convertToViewportPoint(m[0] * d[k + n - 2] + m[2] * d[k + n - 1] + m[4], m[1] * d[k + n - 2] + m[3] * d[k + n - 1] + m[5]));
          k += n;
        }
        if (!contours.length) return;
        const box = (pts: number[][]) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; };
        const area = (b: ReturnType<typeof box>) => (b.x1 - b.x0) * (b.y1 - b.y0);
        const inner = contours.map(box).sort((p, q) => area(p) - area(q))[0];
        glyphs.push({ segs, subs: contours.length, ...box(contours.flat()), hole: [(inner.x0 + inner.x1) / 2, (inner.y0 + inner.y1) / 2] });
      }
    });
    const outlined = readOutlines(glyphs);
    const fit = fitLabels(labels) ?? fitLabels(outlined);
    if (!fit) {
      console.log(`diagram ${a.id}: its ticks don't fit (${[...labels.filter((l) => labelValue(l.text)), ...outlined].map((l) => l.text).join(" ") || "no labels read"}), left out`);
      continue;
    }
    const scale = 3.4;
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext("2d");
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise;
    const w = canvas.width, h = canvas.height;
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const [x0, y0, x1, y1] = frame(rgba, w, h);
    // Ink stays and the paper turns to a 60% white veil, so the diagram reads over the busy chart.
    const cw = x1 - x0, ch = y1 - y0;
    const px = new Uint8Array(cw * ch * 4);
    for (let yy = 0; yy < ch; yy++) {
      for (let xx = 0; xx < cw; xx++) {
        const i = ((y0 + yy) * w + x0 + xx) * 4, o = (yy * cw + xx) * 4;
        const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
        // Paper over the chart, in straight alpha: white at 60%, ink at full.
        const ink = 1 - Math.min(r, g, b) / 255, a = 0.6 + 0.4 * ink;
        const k = (v: number) => Math.round(255 - (255 - v) / a);
        px.set([k(r), k(g), k(b), Math.round(a * 255)], o);
      }
    }
    const file = `${a.id}.webp`;
    await sharp(px, { raw: { width: cw, height: ch, channels: 4 } }).rotate(northUp(fit)).webp({ quality: 80, alphaQuality: 80 }).toFile(join(out, file));
    a.diagram = { url: `diagrams/${file}`, bounds: boundsOf(fit, x0 / scale, y0 / scale, x1 / scale, y1 / scale) };
    console.log(`diagram ${a.id}: ticks fit within ${fit.error} ft`);
  }
}

// ---- Approach, departure and arrival charts from the same d-TPP, each page rendered once (an arrival several airports
// share is one file) at 200 dpi in 8 shades of grey, turned to read left to right, and matched to the airport's procedures (src/tpp.ts). Returns whether
// any chart was written.
async function plates(airports: Airport[], { base, dir, meta }: Dtpp): Promise<boolean> {
  const out = join(OUT, "charts");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Each PDF written so far, with its page's text.
  const texts = new Map<string, string>();
  let bytes = 0;
  const page = async (pdf: string) => {
    if (texts.has(pdf)) return texts.get(pdf)!;
    const task = getDocument({ data: await download(`${base}/${pdf}`, dir), standardFontDataUrl: join(ROOT, "node_modules", "pdfjs-dist", "standard_fonts") + "/", verbosity: 0 });
    const p = await (await task.promise).getPage(1);
    const items = ((await p.getTextContent()).items as { str?: string; transform?: number[] }[]).flatMap((it) => (it.transform ? [{ str: it.str ?? "", transform: it.transform }] : []));
    const text = items.map((it) => it.str).join(" ");
    const vp = p.getViewport({ scale: 200 / 72 });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext("2d");
    await p.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: vp }).promise;
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const info = await sharp(rgba, { raw: { width: canvas.width, height: canvas.height, channels: 4 } }).removeAlpha().rotate(pageTurn(items)).greyscale().png({ palette: true, colours: 8, effort: 10 }).toFile(join(out, pageFile(pdf)));
    await task.destroy();
    bytes += info.size;
    texts.set(pdf, text);
    return text;
  };
  for (const a of airports) {
    const block = airportBlock(meta, a.id);
    const entries: ChartEntry[] = [];
    for (const g of block ? chartGroups(chartRecords(block)) : []) {
      const text = await page(g.pdfs[0]);
      for (const pdf of g.pdfs.slice(1)) await page(pdf);
      entries.push({ name: g.name, kind: g.kind, pages: g.pdfs.map(pageFile), procedures: proceduresOn(g.kind, g.name, text, a.procedures) });
    }
    if (entries.length) await writeFile(join(out, `${a.id}.json`), JSON.stringify(entries));
    const none = entries.filter((e) => !e.procedures.length).map((e) => e.name), missing = noChart(entries, a.procedures);
    if (none.length) console.log(`charts with no procedure: ${a.id} ${none.join(", ")}`);
    if (missing.length) console.log(`procedures with no chart: ${a.id} ${missing.join(", ")}`);
  }
  console.log(`charts: ${texts.size} pages, ${(bytes / 1e6).toFixed(1)} MB`);
  return texts.size > 0;
}

const named = args.filter((a) => a in AREAS);
for (const name of named.length ? named : Object.keys(AREAS)) {
  const area = AREAS[name];
  console.log(name);
  [BOUNDS, GROUND, DEM, SEA, OUT] = [area.bounds, area.ground, area.dem, !!area.sea, join(ROOT, "data", name)];
  if (!process.argv.includes("--no-chart") && !process.argv.includes("--terrain-only")) {
    await chart(`https://aeronav.faa.gov/visual/${m}-${d}-${y}/sectional-files/${area.charts}.zip`, "SEC.tif", BOUNDS, "sectional.webp");
    await chart(`https://aeronav.faa.gov/visual/${m}-${d}-${y}/tac-files/${area.charts}_TAC.zip`, "TAC.tif", area.tac, "tac.webp");
    await chart(`https://aeronav.faa.gov/enroute/${m}-${d}-${y}/${area.low.zip}.zip`, area.low.tif, BOUNDS, "low.webp", area.low.panel);
    await chart(`https://aeronav.faa.gov/enroute/${m}-${d}-${y}/${area.ifrArea.zip}.zip`, area.ifrArea.tif, area.ifrArea.bounds, "area.webp");
  }
  const ground = await terrain();
  if (process.argv.includes("--terrain-only")) continue;
  const areas = await airspace(ground);
  const { airports, airways, waypoints } = await procedures();
  const t = await dtpp();
  await diagrams(airports, t);
  const hasPlates = await plates(airports, t);
  const file: AirspaceFile = { edition: `${y}-${m}-${d}`, cycle: cycleDate.toISOString().slice(0, 10), bounds: BOUNDS, ground: GROUND, charts: { sectional: "sectional.webp", tac: { url: "tac.webp", bounds: area.tac }, low: "low.webp", area: { url: "area.webp", bounds: area.ifrArea.bounds } }, dem: { url: "dem.bin", ...DEM }, areas, airports, airways, waypoints, ...(hasPlates && { plates: true as const }) };
  await writeFile(join(OUT, "area.json"), JSON.stringify(file));
  console.log([...new Set(areas.map((a) => a.kind))].map((k) => `${k} ${areas.filter((a) => a.kind === k).length}`).join(", "));
  console.log(`airways ${airways.length}, legs ${airways.reduce((n, a) => n + a.legs.length, 0)}, no MEA ${airways.flatMap((a) => a.legs).filter((l) => l.ft === null).length}, waypoints ${waypoints.length}`);
  for (const t of ["IAP", "SID", "STAR"]) console.log(`${t} ${airports.reduce((n, a) => n + a.procedures.filter((p) => p.type === t).length, 0)}`);
  console.log(`${airports.length} airports, ${airports.filter((a) => a.diagram).length} diagrams`);
}

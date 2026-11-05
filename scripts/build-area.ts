/**
 * Builds one area's data for skycake from public domain FAA and USGS sources, into data/phoenix/:
 *   sectional.webp     the Phoenix sectional, cropped to BOUNDS and reprojected to plain lat/lon
 *   tac.webp           the Phoenix TAC over its own map area (TAC_AREA), the same way
 *   dem.bin            USGS 3DEP terrain at the view's grid points over BOUNDS, 16-bit feet
 *   area.json          class airspace, Mode C veil, special use airspace inside BOUNDS, and the airports
 *   procedures/*.json  approaches, departures and arrivals of each airport inside BOUNDS, from the CIFP
 *   diagrams/*.webp    FAA airport diagrams (d-TPP), north up, placed by their own ticks
 *
 *   npm run data                     # current chart edition
 *   npm run data -- 2026-10-29       # a given edition (effective date)
 *   npm run data -- --terrain-only
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
import { boundsOf, fitLabels, frame, labelValue, northUp } from "../src/diagram.js";
import { parseProcedures, type Airport } from "../src/procedure.js";

const ROOT = join(import.meta.dirname, "..");
const DAY = 86_400_000;
const KNOWN_EDITION = Date.UTC(2026, 9, 29); // VFR charts repeat every 56 days.
// Phoenix to Tucson: the Phoenix TAC's map area and south past Tucson, on the Phoenix sectional.
const BOUNDS: Bounds = { s: 31.85, w: -112.85, n: 34.07, e: -110.6 };
// Inside the TAC's neatline (34°05' N, 32°47' N; its east and west edges lean slightly), so no collar shows.
const TAC_AREA: Bounds = { s: 32.795, w: -112.845, n: 34.07, e: -111.195 };
// Sky Harbor field elevation: where heights written above the ground start.
const GROUND = 1135;
// The longer side of each chart image; 4096 is the largest texture every phone takes.
const SIDE = 4096;
// Terrain cells about 0.25 NM square.
const DEM = { nx: 452, ny: 532 };

const date = process.argv.slice(2).find((a) => !a.startsWith("--"));
const now = date ? Date.parse(date) : Date.now();
// The edition in effect on that date.
const edition = new Date(KNOWN_EDITION + Math.floor((now - KNOWN_EDITION) / (56 * DAY)) * 56 * DAY);
const [y, m, d] = edition.toISOString().slice(0, 10).split("-");
const TAC_URL = `https://aeronav.faa.gov/visual/${m}-${d}-${y}/tac-files/Phoenix_TAC.zip`;
const SECTIONAL_URL = `https://aeronav.faa.gov/visual/${m}-${d}-${y}/sectional-files/Phoenix.zip`;
const ADDS = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services";
const cache = join(ROOT, ".cache", "charts", `${y}-${m}-${d}`);
const OUT = join(ROOT, "data", "phoenix");

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

// ---- Charts: a Lambert conformal conic palette image to an equirectangular RGB texture over an area.
async function chart(url: string, tifName: string, area: Bounds, name: string) {
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
  // Only the window the area needs: a sectional is 18,000 pixels across.
  const edge: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.125) edge.push([area.w + t * (area.e - area.w), area.s], [area.w + t * (area.e - area.w), area.n], [area.w, area.s + t * (area.n - area.s)], [area.e, area.s + t * (area.n - area.s)]);
  const at = edge.map((p) => toChart.forward(p)).map(([x, y]) => [(x - ox) / rx, (y - oy) / ry]);
  const c0 = Math.max(0, Math.floor(Math.min(...at.map((p) => p[0]))) - 2), r0 = Math.max(0, Math.floor(Math.min(...at.map((p) => p[1]))) - 2);
  const c1 = Math.min(img.getWidth(), Math.ceil(Math.max(...at.map((p) => p[0]))) + 2), r1 = Math.min(img.getHeight(), Math.ceil(Math.max(...at.map((p) => p[1]))) + 2);
  const sw = c1 - c0, sh = r1 - r0;
  const src = (await img.readRasters({ interleave: true, window: [c0, r0, c1, r1] })) as Uint8Array;
  const cmap = img.fileDirectory.ColorMap as Uint16Array; // R, G, B planes of 256, 16-bit
  const n = cmap.length / 3;

  // Pixels square on the ground, the longer side SIDE.
  const aspect = (area.n - area.s) / ((area.e - area.w) * Math.cos((((area.s + area.n) / 2) * Math.PI) / 180));
  const WIDTH = aspect > 1 ? Math.round(SIDE / aspect) : SIDE;
  const height = aspect > 1 ? SIDE : Math.round(SIDE * aspect);
  const out = new Uint8Array(WIDTH * height * 3);
  // Source pixel for an output position; the projection is smooth, so a 2x2 supersample is plenty.
  const pixel = (u: number, v: number) => {
    const [x, yy] = toChart.forward([area.w + (u / WIDTH) * (area.e - area.w), area.n - (v / height) * (area.n - area.s)]);
    return [(x - ox) / rx - c0, (yy - oy) / ry - r0];
  };
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < WIDTH; u++) {
      let r = 0, g = 0, b = 0;
      for (const [du, dv] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const [c, row] = pixel(u + du, v + dv);
        const i = Math.min(sh - 1, Math.max(0, Math.floor(row))) * sw + Math.min(sw - 1, Math.max(0, Math.floor(c)));
        const p = src[i];
        r += cmap[p] >> 8;
        g += cmap[p + n] >> 8;
        b += cmap[p + 2 * n] >> 8;
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
  const kept = areas.filter((a) => a.rings.length > 0);
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
      const tif = await fromUrl(`https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/${name}/USGS_1_${name}.tif`);
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
      const p = (dc: number, dr: number) => t.data[(r0 + dr) * t.w + c0 + dc];
      return (p(0, 0) * (1 - fc) + p(1, 0) * fc) * (1 - fr) + (p(0, 1) * (1 - fc) + p(1, 1) * fc) * fr;
    }
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
async function procedures(): Promise<Airport[]> {
  const c = cycleDate.toISOString().slice(0, 10).split("-");
  const zip = unzipSync(await download(`https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_${c[0].slice(2)}${c[1]}${c[2]}.zip`), { filter: (f) => f.name === "FAACIFP18" });
  const { airports, procedures } = parseProcedures(Buffer.from(zip.FAACIFP18).toString("latin1"), BOUNDS);
  const dir = join(OUT, "procedures");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const a of airports) await writeFile(join(dir, `${a.id}.json`), JSON.stringify(procedures.filter((p) => p.airport === a.id)));
  return airports;
}

// ---- Airport diagrams from the d-TPP of the same cycle, placed by their own latitude and longitude ticks, turned
// north up, white made clear. A diagram whose ticks don't fit (src/diagram.ts) is left out and named in the log.
async function diagrams(airports: Airport[]) {
  // The d-TPP numbers its cycles YYNN, NN counting from the year's first cycle.
  let first = cycleDate.getTime();
  while (new Date(first - 28 * DAY).getUTCFullYear() === cycleDate.getUTCFullYear()) first -= 28 * DAY;
  const code = `${String(cycleDate.getUTCFullYear()).slice(2)}${String((cycleDate.getTime() - first) / (28 * DAY) + 1).padStart(2, "0")}`;
  const base = `https://aeronav.faa.gov/d-tpp/${code}`;
  const dir = join(ROOT, ".cache", "dtpp", code);
  const meta = Buffer.from(await download(`${base}/xml_data/d-tpp_Metafile.xml`, dir)).toString("utf8");
  const out = join(OUT, "diagrams");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  for (const a of airports) {
    const block = meta.split("<airport_name").find((b) => new RegExp(`(icao_ident|apt_ident)="${a.id}"`).test(b.slice(0, b.indexOf(">"))));
    const pdf = block?.split("<record>").find((r) => /<chart_code>APD<\/chart_code>/.test(r))?.match(/<pdf_name>([^<]+)<\/pdf_name>/)?.[1];
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
    const fit = fitLabels(labels);
    if (!fit) {
      const why = labels.filter((l) => labelValue(l.text)).length < 4 ? "its tick labels are drawn as shapes, not text" : "its ticks don't fit";
      console.log(`diagram ${a.id}: ${why}, left out`);
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

if (!process.argv.includes("--no-chart") && !process.argv.includes("--terrain-only")) {
  await chart(SECTIONAL_URL, "SEC.tif", BOUNDS, "sectional.webp");
  await chart(TAC_URL, "TAC.tif", TAC_AREA, "tac.webp");
}
const ground = await terrain();
if (process.argv.includes("--terrain-only")) process.exit(0);
const areas = await airspace(ground);
const airports = await procedures();
await diagrams(airports);
const file: AirspaceFile = { edition: `${y}-${m}-${d}`, bounds: BOUNDS, ground: GROUND, charts: { sectional: "sectional.webp", tac: { url: "tac.webp", bounds: TAC_AREA } }, dem: { url: "dem.bin", ...DEM }, areas, airports };
await writeFile(join(OUT, "area.json"), JSON.stringify(file));
console.log([...new Set(areas.map((a) => a.kind))].map((k) => `${k} ${areas.filter((a) => a.kind === k).length}`).join(", "));
for (const t of ["IAP", "SID", "STAR"]) console.log(`${t} ${airports.reduce((n, a) => n + a.procedures.filter((p) => p.type === t).length, 0)}`);
console.log(`${airports.length} airports, ${airports.filter((a) => a.diagram).length} diagrams`);

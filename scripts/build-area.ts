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
import { TOP, areaIds, boundaryKind, classKind, clipRing, feet, suaKind, type AirspaceFile, type Area, type Bounds, type Kind, type Ring } from "../src/airspace.js";
import { parseAirways } from "../src/airway.js";
import { boundsOf, fitLabels, frame, labelValue, northUp, readOutlines, type Glyph } from "../src/diagram.js";
import { airportsOffMap, parseProcedures, type Airport } from "../src/procedure.js";
import { airportBlock, chartGroups, chartRecords, noChart, pageFile, pageTurn, proceduresOn, type ChartEntry } from "../src/tpp.js";

const ROOT = join(import.meta.dirname, "..");
const DAY = 86_400_000;
const KNOWN_EDITION = Date.UTC(2026, 9, 29); // VFR charts repeat every 56 days.
// Each area: bounds holding every approach at its airports, clear of the chart's fade (viewer.ts); the field elevation where
// heights written above the ground start; terrain cells about 0.25 NM square; its sectionals; its TAC (FAA file name) with
// the map inside the neatline so no collar shows, where there is one; its IFR area chart, the map inside its neatline as
// for the TAC, where there is one; its IFR low sheets, each with its map panels in pixels (the sheets are tilted and also
// hold tables, insets and a second side). Each point of a chart image comes from the first source that holds it: a
// sectional past its box is a neighbour's (a sectional's picture runs on past its edge, so the seam is the edge itself),
// a point on no low sheet's map is white. TAC and area chart bounds are cut to the area's. lake: a lake's surface, feet;
// 3DEP carries the Great Lakes' beds, drawn at the surface instead.
// The panels and boxes were read off the charts of the 2026-10-29 edition; the FAA keeps sheet layouts between editions.
type Source = [name: string, box?: Partial<Bounds>];
type Sheet = [name: string, ...panels: Panel[]];
type AreaSetup = { bounds: Bounds; ground: number; dem: { nx: number; ny: number }; sea?: boolean; lake?: number; sectional: Source[]; tac?: [name: string, bounds: Bounds]; ifrArea?: { zip: string; tif: string; bounds: Bounds }; low: Sheet[] };
type Panel = [c0: number, r0: number, c1: number, r1: number];
// Low sheet map panels, between the sheet's neatlines. L-34's top right corner is its Boston inset, not drawn where Boston is.
const L: Record<string, Sheet> = {
  L01: ["L01", [2205, 265, 21791, 7733]], L02: ["L02", [2205, 267, 19795, 7735]], L03: ["L03", [2205, 265, 21795, 7735]], L04: ["L04", [4204, 265, 21795, 7735]],
  L05: ["L05", [6205, 265, 21795, 7735]], L07: ["L07", [2204, 265, 21794, 7735]], L08: ["L08", [2205, 265, 19795, 7735]], L09: ["L09", [2204, 265, 21793, 7735]],
  L10: ["L10", [4205, 265, 21795, 7735]], L12: ["L12", [4206, 265, 21795, 7735]], L13: ["L13", [2204, 265, 21794, 7735]], L14: ["L14", [4205, 265, 21794, 7735]],
  L17: ["L17", [4205, 265, 21795, 7735]], L18: ["L18", [4205, 265, 23795, 7735]], L19: ["L19", [2205, 265, 21795, 7735]], L20: ["L20", [2205, 265, 19795, 7735]],
  L23: ["L23", [5185, 265, 21795, 7735]], L25: ["L25", [2205, 265, 19795, 7735]], L26: ["L26", [204, 262, 19794, 7735]], L27: ["L27", [2205, 264, 21795, 7734]],
  L28: ["L28", [2205, 265, 19795, 7735]], L29: ["L29", [2205, 264, 21795, 7734]], L32: ["L32", [4205, 265, 23795, 7735]], L33: ["L33", [2206, 265, 17794, 7731]],
  L34: ["L34", [205, 260, 21950, 7731], [21950, 4750, 23797, 7731]], L36: ["L36", [205, 265, 21794, 7731]],
};
const AREAS: Record<string, AreaSetup> = {
  // Phoenix to Tucson. The TAC's neatline is 34°05' N, 32°47' N; its east and west edges lean slightly.
  phoenix: { bounds: { s: 31.8, w: -113, n: 34.25, e: -110.27 }, ground: 1135, dem: { nx: 548, ny: 587 }, sectional: [["Phoenix"]], tac: ["Phoenix", { s: 32.795, w: -112.845, n: 34.07, e: -111.195 }], ifrArea: { zip: "enr_a02", tif: "ENR_A02_PHX.tif", bounds: { s: 32.794, w: -112.834, n: 34.093, e: -111.259 } }, low: [L.L05] },
  // Key West to Palm Beach; Lantana's RNAV (GPS)-B sets the north edge and Opa-locka's transitions the east. The TAC stops
  // at 25.49 N, above its Florida Keys inset, which is not drawn where the Keys are; the sectional shows them. L-23 ends just
  // south of Key West, short of the area's south edge, and the sheet that holds that water (L-21) stops at Key West: white there.
  miami: { bounds: { s: 24.4, w: -82.03, n: 27.32, e: -79.55 }, ground: 9, dem: { nx: 537, ny: 702 }, sea: true, sectional: [["Miami"]], tac: ["Miami", { s: 25.49, w: -81.16, n: 26.76, e: -79.55 }], ifrArea: { zip: "enr_a01", tif: "ENR_A01_MIA.tif", bounds: { s: 25.408, w: -80.828, n: 26.308, e: -79.816 } }, low: [L.L23] },
  // Washington, Baltimore and the Flight Restricted Zone, Dulles to the Eastern Shore.
  washington: { bounds: { s: 37.9, w: -78.6, n: 40, e: -75.9 }, ground: 14, dem: { nx: 504, ny: 504 }, sea: true, sectional: [["Washington", { n: 40 }], ["New_York"]], tac: ["Baltimore-Washington", { s: 38.2, w: -78.303, n: 39.786, e: -75.795 }], ifrArea: { zip: "enr_a01", tif: "ENR_A01_DCA.tif", bounds: { s: 38.221, w: -78.355, n: 40.395, e: -74.729 } }, low: [L.L34, L.L29, L.L36, L.L26] },
  // New York: Kennedy, LaGuardia, Newark, Teterboro and White Plains, Trenton to Long Island. No IFR area chart; the sea past the lows is white.
  "new-york": { bounds: { s: 39.7, w: -75.3, n: 41.9, e: -72.3 }, ground: 13, dem: { nx: 545, ny: 528 }, sea: true, sectional: [["New_York", { s: 40 }], ["Washington"]], tac: ["New_York", { s: 40.231, w: -74.879, n: 41.249, e: -72.673 }], low: [L.L34, L.L33] },
  // Boston, Cape Cod and the islands.
  boston: { bounds: { s: 41.2, w: -72.6, n: 43.4, e: -69.9 }, ground: 19, dem: { nx: 479, ny: 528 }, sea: true, sectional: [["New_York"]], tac: ["Boston", { s: 41.267, w: -71.847, n: 42.855, e: -69.606 }], low: [L.L33, L.L32, L.L34] },
  "los-angeles": { bounds: { s: 33.2, w: -119.4, n: 35.1, e: -116.6 }, ground: 128, dem: { nx: 556, ny: 456 }, sea: true, sectional: [["Los_Angeles"]], tac: ["Los_Angeles", { s: 33.427, w: -119.124, n: 34.506, e: -116.82 }], ifrArea: { zip: "enr_a02", tif: "ENR_A02_LAX.tif", bounds: { s: 33.809, w: -118.992, n: 34.324, e: -117.205 } }, low: [L.L04, L.L07, L.L03, L.L05] },
  // San Diego to Oceanside and the border; Mexico is off the lows, white there.
  "san-diego": { bounds: { s: 32.3, w: -118, n: 33.6, e: -116.2 }, ground: 17, dem: { nx: 363, ny: 312 }, sea: true, sectional: [["Los_Angeles"]], tac: ["San_Diego", { s: 32.514, w: -117.959, n: 33.6, e: -116.31 }], low: [L.L04, L.L05] },
  // Seattle-Tacoma, Puget Sound to Mount Rainier.
  seattle: { bounds: { s: 46.6, w: -123.6, n: 48.6, e: -121 }, ground: 432, dem: { nx: 421, ny: 480 }, sea: true, sectional: [["Seattle"]], tac: ["Seattle", { s: 46.761, w: -123.172, n: 48.051, e: -121.559 }], low: [L.L01, L.L13] },
  // Grand Forks, its Air Force Base and Fargo. No TAC or IFR area chart.
  "grand-forks": { bounds: { s: 46.3, w: -98.6, n: 48.9, e: -95.9 }, ground: 845, dem: { nx: 437, ny: 624 }, sectional: [["Twin_Cities"]], low: [L.L14] },
  // Lake Michigan stands at 577 ft.
  chicago: { bounds: { s: 41, w: -89.3, n: 43, e: -86.9 }, ground: 680, dem: { nx: 428, ny: 480 }, lake: 577, sectional: [["Chicago"]], tac: ["Chicago", { s: 41.469, w: -88.755, n: 42.478, e: -87.273 }], ifrArea: { zip: "enr_a02", tif: "ENR_A02_ORD.tif", bounds: { s: 41.372, w: -88.585, n: 43.275, e: -87.335 } }, low: [L.L28, L.L27] },
  atlanta: { bounds: { s: 32.6, w: -85.6, n: 34.7, e: -83.2 }, ground: 1026, dem: { nx: 479, ny: 504 }, sectional: [["Atlanta"]], tac: ["Atlanta", { s: 32.992, w: -85.278, n: 34.298, e: -83.618 }], ifrArea: { zip: "enr_a01", tif: "ENR_A01_ATL.tif", bounds: { s: 33.18, w: -84.956, n: 34.095, e: -83.839 } }, low: [L.L18, L.L25] },
  // The sectional's south edge is 32 N.
  "dallas-fort-worth": { bounds: { s: 32.01, w: -98.3, n: 33.9, e: -95.8 }, ground: 606, dem: { nx: 503, ny: 454 }, sectional: [["Dallas-Ft_Worth"]], tac: ["Dallas-Ft_Worth", { s: 32.067, w: -98.19, n: 33.656, e: -95.911 }], ifrArea: { zip: "enr_a02", tif: "ENR_A02_DFW.tif", bounds: { s: 31.505, w: -98.092, n: 33.712, e: -96.136 } }, low: [L.L17, L.L19] },
  // Colorado Springs to Fort Collins: three sectionals meet at 40 N, 104 W.
  denver: { bounds: { s: 38.3, w: -106, n: 40.9, e: -103.6 }, ground: 5434, dem: { nx: 444, ny: 624 }, sectional: [["Denver", { n: 40, e: -104 }], ["Cheyenne", { s: 40 }], ["Wichita"]], tac: ["Denver", { s: 39.259, w: -105.562, n: 40.556, e: -103.755 }], ifrArea: { zip: "enr_a02", tif: "ENR_A02_DEN.tif", bounds: { s: 39.301, w: -105.371, n: 40.373, e: -103.956 } }, low: [L.L10, L.L09, L.L12] },
  houston: { bounds: { s: 28.8, w: -96.4, n: 30.9, e: -94 }, ground: 96, dem: { nx: 500, ny: 504 }, sea: true, sectional: [["Houston"]], tac: ["Houston", { s: 29.104, w: -96.123, n: 30.496, e: -94.539 }], low: [L.L19, L.L20] },
  "san-francisco": { bounds: { s: 36.7, w: -123.4, n: 38.9, e: -120.9 }, ground: 13, dem: { nx: 474, ny: 528 }, sea: true, sectional: [["San_Francisco"]], tac: ["San_Francisco", { s: 37.021, w: -123.138, n: 38.178, e: -121.396 }], ifrArea: { zip: "enr_a02", tif: "ENR_A02_SFO.tif", bounds: { s: 37.349, w: -122.886, n: 38.27, e: -121.705 } }, low: [L.L03, L.L02] },
  // Las Vegas sits on its sectional's south edge, about 35.66 N here: below it the Los Angeles sectional west of 115 W and Phoenix's east.
  "las-vegas": { bounds: { s: 35.2, w: -116.4, n: 37.2, e: -114 }, ground: 2183, dem: { nx: 465, ny: 480 }, sectional: [["Las_Vegas", { s: 35.66 }], ["Los_Angeles", { e: -115 }], ["Phoenix"]], tac: ["Las_Vegas", { s: 35.713, w: -115.603, n: 36.718, e: -113.891 }], low: [L.L07, L.L09, L.L08] },
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
const PADUS = "https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/Federal_Management_Agencies/FeatureServer/0";
const cache = join(ROOT, ".cache", "charts", `${y}-${m}-${d}`);
// The area being built.
let BOUNDS: Bounds, GROUND: number, DEM: { nx: number; ny: number }, SEA: boolean, LAKE: number, OUT: string;

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

// ---- Charts: Lambert conformal conic images (palette or RGB, north up or tilted) to one equirectangular RGB texture over an
// area. Each point comes from the first source whose box (lat/lon) and panels (pixels), where given, hold it; white if none.
type ChartSource = { url: string; tif: string; box?: Partial<Bounds>; panels?: Panel[] };
async function chart(sources: ChartSource[], area: Bounds, name: string) {
  // Pixels square on the ground, the longer side SIDE.
  const aspect = (area.n - area.s) / ((area.e - area.w) * Math.cos((((area.s + area.n) / 2) * Math.PI) / 180));
  const WIDTH = aspect > 1 ? Math.round(SIDE / aspect) : SIDE;
  const height = aspect > 1 ? SIDE : Math.round(SIDE * aspect);
  const out = new Uint8Array(WIDTH * height * 3);
  // Per source: its color at a point, or nothing where it doesn't hold the point.
  const charts: ((lon: number, lat: number) => number[] | undefined)[] = [];
  for (const { url, tif: tifName, box = {}, panels } of sources) {
    // The part of the area this source can give.
    const part = { s: Math.max(area.s, box.s ?? -90), w: Math.max(area.w, box.w ?? -180), n: Math.min(area.n, box.n ?? 90), e: Math.min(area.e, box.e ?? 180) };
    if (part.s >= part.n || part.w >= part.e) continue;
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
    // Only the window the part needs: a sectional is 18,000 pixels across.
    const edge: [number, number][] = [];
    for (let t = 0; t <= 1; t += 0.125) edge.push([part.w + t * (part.e - part.w), part.s], [part.w + t * (part.e - part.w), part.n], [part.w, part.s + t * (part.n - part.s)], [part.e, part.s + t * (part.n - part.s)]);
    const at = edge.map((p) => toChart.forward(p)).map(toPixel);
    const c0 = Math.max(0, Math.floor(Math.min(...at.map((p) => p[0]))) - 2), r0 = Math.max(0, Math.floor(Math.min(...at.map((p) => p[1]))) - 2);
    const c1 = Math.min(img.getWidth(), Math.ceil(Math.max(...at.map((p) => p[0]))) + 2), r1 = Math.min(img.getHeight(), Math.ceil(Math.max(...at.map((p) => p[1]))) + 2);
    if (c1 <= c0 || r1 <= r0) continue;
    const src = (await img.readRasters({ interleave: true, window: [c0, r0, c1, r1] })) as Uint8Array;
    const cmap = img.fileDirectory.ColorMap as Uint16Array | undefined; // R, G, B planes of 256, 16-bit; the IFR sheets are RGB
    const n = cmap ? cmap.length / 3 : 0, sw = c1 - c0, sh = r1 - r0;
    const inside = panels ?? [[0, 0, img.getWidth(), img.getHeight()]];
    charts.push((lon, lat) => {
      if (lat < part.s || lat > part.n || lon < part.w || lon > part.e) return;
      const [c, row] = toPixel(toChart.forward([lon, lat]));
      if (!inside.some((p) => c >= p[0] && row >= p[1] && c <= p[2] && row <= p[3])) return;
      const i = Math.min(sh - 1, Math.max(0, Math.floor(row - r0))) * sw + Math.min(sw - 1, Math.max(0, Math.floor(c - c0)));
      if (!cmap) return [src[i * 3], src[i * 3 + 1], src[i * 3 + 2]];
      return [cmap[src[i]] >> 8, cmap[src[i] + n] >> 8, cmap[src[i] + 2 * n] >> 8];
    });
  }
  if (!charts.length) throw new Error(`${name}: no source covers the area`);

  // An output position's color, from the first source that holds it; the projection is smooth, so a 2x2 supersample is plenty.
  const color = (lon: number, lat: number): number[] => {
    for (const at of charts) {
      const rgb = at(lon, lat);
      if (rgb) return rgb;
    }
    return [255, 255, 255];
  };
  for (let v = 0; v < height; v++) {
    for (let u = 0; u < WIDTH; u++) {
      let r = 0, g = 0, b = 0;
      for (const [du, dv] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const [cr, cg, cb] = color(area.w + ((u + du) / WIDTH) * (area.e - area.w), area.n - ((v + dv) / height) * (area.n - area.s));
        r += cr;
        g += cg;
        b += cb;
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
async function query(layer: string, url = `${ADDS}/${layer}/FeatureServer/0`, where = "1=1"): Promise<Feature[]> {
  const q = new URLSearchParams({
    where,
    geometry: `${BOUNDS.w},${BOUNDS.s},${BOUNDS.e},${BOUNDS.n}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    geometryPrecision: "5",
    f: "geojson",
  });
  // ArcGIS answers a busy moment with an error body and status 200; three tries, then stop.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${url}/query?${q}`);
    const body = (res.ok ? await res.json().catch(() => ({})) : {}) as { features?: Feature[]; exceededTransferLimit?: boolean; error?: unknown };
    if (body.exceededTransferLimit) throw new Error(`${layer}: too many features for one page`);
    if (body.features) return body.features;
    if (attempt === 3) throw new Error(`${layer}: ${res.status} ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
    await new Promise((done) => setTimeout(done, 5000 * attempt));
  }
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

// The lowest and highest ground under a set of rings ([lat, lon]), from the terrain grid. The highest is the base of a
// Class E surface area, whose top is drawn where the 700 ft floor around it starts.
function groundRange(ft: Int16Array, rs: Ring[]): [low: number, high: number] {
  let top = -Infinity, low = Infinity;
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
        if (inside) [low, top] = [Math.min(low, ft[j * DEM.nx + i]), Math.max(top, ft[j * DEM.nx + i])];
      }
    }
  }
  return Number.isFinite(top) ? [low, top] : [GROUND, GROUND];
}

async function airspace(ground: Int16Array): Promise<Area[]> {
  const areas: Omit<Area, "id">[] = [];
  for (const f of await query("Class_Airspace")) {
    const p = f.properties;
    const kind = classKind(p.CLASS as string, p.LOCAL_TYPE as string, Number(p.LOWER_VAL), p.LOWER_CODE as string);
    if (!kind) continue;
    const floor = feet(Number(p.LOWER_VAL), p.LOWER_UOM as string, p.LOWER_CODE as string, GROUND);
    // Class E has no ceiling of its own (-9998): surface areas are drawn up to where the 700 ft floor starts,
    // and the 700 ft area is a sheet.
    const upper = Number(p.UPPER_VAL);
    const rs = rings(f.geometry);
    // TNI: up to but not including, charted with a minus (-30, under a Class B floor at 3,000): the ceiling is 2,999.
    const tni = p.UPPER_DESC === "TNI" && ["B", "C", "D"].includes(kind) ? 1 : 0;
    const ceiling = kind === "E" ? groundRange(ground, rs)[1] + 700 : kind === "E700" ? floor : kind === "EFLOOR" ? TOP : Math.min(TOP, feet(upper, p.UPPER_UOM as string, p.UPPER_CODE as string, GROUND)) - tni;
    areas.push({ kind, name: String(p.NAME), floor, ceiling, rings: rs });
  }
  // A height above the ground (500 AGL) over terrain that varies, as one height: a floor over the lowest ground under the
  // area and a ceiling over the highest, so the drawn volume holds the real one and neither sinks into hills.
  // No value (-9998: the ADIZ, offshore Class E's ceiling) is the surface for a floor and the top for a ceiling.
  const msl = (val: number, uom: string, code: string, rs: Ring[], end: 0 | 1) =>
    val === -9998 && code !== "UNLTD" ? [GROUND, TOP][end] : code === "SFC" && val > 0 ? groundRange(ground, rs)[end] + val : feet(val, uom, code, GROUND);
  const special = async (layer: string, kindOf: (p: Feature["properties"]) => Kind | null, named: (p: Feature["properties"]) => string, features?: Feature[]) => {
    for (const f of features ?? (await query(layer))) {
      const p = f.properties;
      const kind = kindOf(p);
      if (!kind) continue;
      const rs = rings(f.geometry);
      const floor = msl(Number(p.LOWER_VAL), p.LOWER_UOM as string, p.LOWER_CODE as string, rs, 0);
      const tni = p.UPPER_DESC === "TNI" ? 1 : 0;
      const ceiling = Math.min(TOP, msl(Number(p.UPPER_VAL), p.UPPER_UOM as string, p.UPPER_CODE as string, rs, 1)) - tni;
      // Some records carry a placeholder SFC-to-SFC shape; nothing to draw.
      if (ceiling <= floor) continue;
      areas.push({ kind, name: named(p), floor, ceiling, rings: rs });
    }
  };
  await special("Special_Use_Airspace", (p) => suaKind(p.TYPE_CODE as string), (p) => String(p.NAME));
  // TRSAs, SFRAs (DC's, with its flight restricted zone) and special air traffic rule areas (Luke's sectors, DCA's).
  // Offshore Class E, permanent national defense TFRs, national security areas and the ADIZ are there too.
  await special("Boundary_Airspace", (p) => boundaryKind(p.TYPE_CODE as string, p.LOCAL_TYPE as string), (p) => (p.TYPE_CODE === "SATA" && p.SECTOR ? `${p.NAME} (${p.SECTOR})` : String(p.NAME)));
  // National parks, wildlife refuges, wilderness and NOAA marine sanctuaries, where the chart asks for 2,000 ft above the
  // ground: from USGS's Protected Areas Database (PAD-US), not FAA data.
  // Waterfowl production areas come under NWR here but are not charted.
  const parks = await query("PAD-US", PADUS, "(Des_Tp IN ('NP','NWR','WA') OR (Des_Tp = 'MPA' AND Mang_Name = 'NOAA')) AND Unit_Nm NOT LIKE '%Waterfowl Production%'");
  // One area per name (a refuge comes in many parcels, a park as land and as designation), without specks under ~0.3 NM.
  const byName = new Map<string, Feature>();
  for (const f of parks) {
    if (!f.geometry) continue;
    const big = polygons(f.geometry).filter((poly) => {
      const lats = poly[0].map((p) => p[1]), lons = poly[0].map((p) => p[0]);
      return Math.max(...lats) - Math.min(...lats) > 0.005 || Math.max(...lons) - Math.min(...lons) > 0.005;
    });
    const name = String(f.properties.Unit_Nm);
    const had = byName.get(name);
    if (had) (had.geometry!.coordinates as number[][][][]).push(...big);
    else byName.set(name, { properties: { ...f.properties, LOWER_VAL: 0, LOWER_CODE: "SFC", UPPER_VAL: 2000, UPPER_UOM: "FT", UPPER_CODE: "SFC" }, geometry: { type: "MultiPolygon", coordinates: big } });
  }
  await special("PAD-US", () => "PARK", (p) => String(p.Unit_Nm), [...byName.values()]);
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
      ft[j * DEM.nx + i] = Math.round(Math.max(LAKE, meters(lat, lon) * 3.28084));
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
  [BOUNDS, GROUND, DEM, SEA, LAKE, OUT] = [area.bounds, area.ground, area.dem, !!area.sea, area.lake ?? -Infinity, join(ROOT, "data", name)];
  const cut = (b: Bounds): Bounds => ({ s: Math.max(b.s, BOUNDS.s), w: Math.max(b.w, BOUNDS.w), n: Math.min(b.n, BOUNDS.n), e: Math.min(b.e, BOUNDS.e) });
  const tac = area.tac && { name: area.tac[0], bounds: cut(area.tac[1]) };
  const ifrArea = area.ifrArea && { ...area.ifrArea, bounds: cut(area.ifrArea.bounds) };
  if (!process.argv.includes("--no-chart") && !process.argv.includes("--terrain-only")) {
    const VFR = `https://aeronav.faa.gov/visual/${m}-${d}-${y}`, ENR = `https://aeronav.faa.gov/enroute/${m}-${d}-${y}`;
    await chart(area.sectional.map(([n, box]) => ({ url: `${VFR}/sectional-files/${n}.zip`, tif: "SEC.tif", box })), BOUNDS, "sectional.webp");
    if (tac) await chart([{ url: `${VFR}/tac-files/${tac.name}_TAC.zip`, tif: "TAC.tif" }], tac.bounds, "tac.webp");
    await chart(area.low.map(([n, ...panels]) => ({ url: `${ENR}/enr_${n.toLowerCase()}.zip`, tif: `ENR_${n}.tif`, panels })), BOUNDS, "low.webp");
    if (ifrArea) await chart([{ url: `${ENR}/${ifrArea.zip}.zip`, tif: ifrArea.tif }], ifrArea.bounds, "area.webp");
  }
  const ground = await terrain();
  if (process.argv.includes("--terrain-only")) continue;
  const areas = await airspace(ground);
  const { airports, airways, waypoints } = await procedures();
  const t = await dtpp();
  await diagrams(airports, t);
  const hasPlates = await plates(airports, t);
  const charts = { sectional: "sectional.webp", ...(tac && { tac: { url: "tac.webp", bounds: tac.bounds } }), low: "low.webp", ...(ifrArea && { area: { url: "area.webp", bounds: ifrArea.bounds } }) };
  const file: AirspaceFile = { edition: `${y}-${m}-${d}`, cycle: cycleDate.toISOString().slice(0, 10), bounds: BOUNDS, ground: GROUND, charts, dem: { url: "dem.bin", ...DEM }, areas, airports, airways, waypoints, ...(hasPlates && { plates: true as const }) };
  await writeFile(join(OUT, "area.json"), JSON.stringify(file));
  console.log([...new Set(areas.map((a) => a.kind))].map((k) => `${k} ${areas.filter((a) => a.kind === k).length}`).join(", "));
  console.log(`airways ${airways.length}, legs ${airways.reduce((n, a) => n + a.legs.length, 0)}, no MEA ${airways.flatMap((a) => a.legs).filter((l) => l.ft === null).length}, waypoints ${waypoints.length}`);
  for (const t of ["IAP", "SID", "STAR"]) console.log(`${t} ${airports.reduce((n, a) => n + a.procedures.filter((p) => p.type === t).length, 0)}`);
  console.log(`${airports.length} airports, ${airports.filter((a) => a.diagram).length} diagrams`);
}

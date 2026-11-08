// A scene: everything the view shows at one moment. Free roam starts from one; walkthrough steps and quiz questions
// each set one. resolve() fills in the defaults and checks every name against the area's data.
import { KINDS, pickChart, type AirspaceFile, type ChartName, type Kind } from "./airspace.js";

export type ProcedureRef = { airport: string; name: string };
export type AreaRef = { area: string };
/** diagram: an airport diagram's area, by airport id. airport: an airport by id. */
export type Target = AreaRef | { fix: string } | { procedure: ProcedureRef } | { point: [lat: number, lon: number] } | { diagram: string } | { airport: string };
export type Camera = "fit" | "top" | { frame: Target[]; tilt?: number } | { azimuth: number; tilt: number; distance: number; target: [lat: number, lon: number] };
export type Scene = {
  /** null: leave the camera where it is. */
  camera?: Camera | null;
  /** Raised; everything else lies flat on the chart. */
  raise?: (Kind | AreaRef)[];
  /** Any number at once. draw (leg by leg) plays in walkthroughs. */
  procedures?: (ProcedureRef & { draw?: boolean })[];
  /** Drawn emphasised. */
  highlight?: Target[];
  /** A fixed spot, or flying a procedure for `seconds`. */
  airplane?: { at: [lat: number, lon: number, ft: number] } | { along: ProcedureRef; seconds: number };
  /** An airport id. */
  diagram?: string | null;
  height?: 1 | 4;
  tags?: boolean;
  /** "tac": the TAC over its own map area and the sectional outside it; "sectional": the sectional everywhere; "area": the IFR area chart over its own map and the low outside it; "low": the IFR low everywhere. */
  chart?: ChartName;
};
/** What the viewer applies: every field filled in, names checked. raised holds area ids. */
export type Resolved = { camera: Camera | null; raised: Set<string>; procedures: (ProcedureRef & { draw: boolean })[]; highlight: Target[]; airplane: Scene["airplane"] | null; diagram: string | null; height: 1 | 4; tags: boolean; chart: ChartName };

export class SceneError extends Error {}

export function resolve(scene: Scene, data: AirspaceFile): Resolved {
  const raised = new Set<string>();
  for (const r of scene.raise ?? []) {
    if (typeof r === "string") {
      for (const a of data.areas) if (a.kind === r) raised.add(a.id);
    } else {
      if (!data.areas.some((a) => a.id === r.area)) throw new SceneError(`no area ${r.area}`);
      raised.add(r.area);
    }
  }
  const procedures = (scene.procedures ?? []).map(({ airport, name, draw }) => {
    procedureOf({ airport, name }, data);
    return { airport, name, draw: draw ?? false };
  });
  const highlight = scene.highlight ?? [];
  for (const t of highlight) target(t, data);
  const airplane = scene.airplane ?? null;
  if (airplane && "along" in airplane) procedureOf(airplane.along, data);
  if (airplane && "at" in airplane) {
    const [lat, lon] = airplane.at;
    const b = data.bounds;
    if (lat < b.s || lat > b.n || lon < b.w || lon > b.e) throw new SceneError(`airplane at ${lat}, ${lon} is outside the area`);
  }
  const diagram = scene.diagram ?? null;
  if (diagram !== null && !data.airports.find((a) => a.id === diagram)?.diagram) throw new SceneError(`no diagram for ${diagram}`);
  const camera = scene.camera;
  if (camera && typeof camera === "object" && "frame" in camera) for (const t of camera.frame) target(t, data);
  return { camera: scene.camera === undefined ? "fit" : scene.camera, raised, procedures, highlight, airplane, diagram, height: scene.height ?? 1, tags: scene.tags ?? true, chart: pickChart(data.charts, scene.chart) };
}

function procedureOf({ airport, name }: ProcedureRef, data: AirspaceFile) {
  if (!data.airports.find((a) => a.id === airport)?.procedures.some((p) => p.name === name)) throw new SceneError(`no procedure ${name} at ${airport}`);
}

function target(t: Target, data: AirspaceFile) {
  if ("area" in t && !data.areas.some((a) => a.id === t.area)) throw new SceneError(`no area ${t.area}`);
  if ("airport" in t && !data.airports.some((a) => a.id === t.airport)) throw new SceneError(`no airport ${t.airport}`);
  if ("procedure" in t) procedureOf(t.procedure, data);
  if ("diagram" in t && !data.airports.find((a) => a.id === t.diagram)?.diagram) throw new SceneError(`no diagram for ${t.diagram}`);
}

/** The scene without playback (highlight, airplane, draw): free roam gets a still scene. */
export function stripPlayback(scene: Scene): Scene {
  const { highlight, airplane, ...rest } = scene;
  return scene.procedures ? { ...rest, procedures: scene.procedures.map(({ airport, name }) => ({ airport, name })) } : rest;
}

/** Procedures the camera frames that the scene does not show: their files load for framing only. */
export function framedOnly(scene: Scene): ProcedureRef[] {
  const cam = scene.camera;
  if (!cam || typeof cam !== "object" || !("frame" in cam)) return [];
  const shown = scene.procedures ?? [];
  const out: ProcedureRef[] = [];
  for (const t of cam.frame) {
    if (!("procedure" in t)) continue;
    const { airport, name } = t.procedure;
    if (![...shown, ...out].some((p) => p.airport === airport && p.name === name)) out.push({ airport, name });
  }
  return out;
}

/** Free roam's first view: every airspace type in the area raised, the whole chart in view. */
export function freeRoamScene(data: AirspaceFile): Scene {
  return { camera: "fit", raise: KINDS.filter((k) => data.areas.some((a) => a.kind === k)) };
}

/** mount()'s older options as a first scene; undefined when none is given. */
export function shorthand(o: { types?: Kind[]; airport?: string; approach?: string }, data: AirspaceFile): Scene | undefined {
  if (!o.types && !o.airport && !o.approach) return undefined;
  const scene: Scene = { camera: "fit", raise: o.types ?? freeRoamScene(data).raise };
  const airport = o.airport ?? "KPHX";
  if (o.approach) {
    scene.procedures = [{ airport, name: o.approach }];
    scene.camera = { frame: [{ procedure: { airport, name: o.approach } }] };
  }
  return scene;
}

/**
 * The first scene from mount()'s options. A name the data no longer has (an FAA cycle renamed an approach, a typo)
 * falls back to free roam's first view, and warn() says why, so the embed still works.
 */
export function firstScene(o: { scene?: Scene; types?: Kind[]; airport?: string; approach?: string }, data: AirspaceFile, warn: (message: string) => void): Scene {
  const scene = o.scene ?? shorthand(o, data) ?? freeRoamScene(data);
  try {
    resolve(scene, data);
    return scene;
  } catch (e) {
    if (!(e instanceof SceneError)) throw e;
    warn(`skycake: ${e.message}; showing the whole chart instead`);
    return freeRoamScene(data);
  }
}

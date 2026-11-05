// A scene: everything the view shows at one moment. Free roam starts from one; walkthrough steps and quiz questions
// each set one. resolve() fills in the defaults and checks every name against the area's data.
import { KINDS, type AirspaceFile, type Kind } from "./airspace.js";

export type ProcedureRef = { airport: string; name: string };
export type AreaRef = { area: string };
export type Target = AreaRef | { fix: string } | { procedure: ProcedureRef } | { point: [lat: number, lon: number] };
export type Camera = "fit" | "top" | { frame: Target[]; tilt?: number } | { azimuth: number; tilt: number; distance: number; target: [lat: number, lon: number] };
export type Scene = {
  camera?: Camera;
  /** Raised; everything else lies flat on the chart. */
  raise?: (Kind | AreaRef)[];
  /** Any number at once. draw (leg by leg) plays in walkthroughs. */
  procedures?: (ProcedureRef & { draw?: boolean })[];
  /** An airport id. */
  diagram?: string | null;
  height?: 1 | 4;
  tags?: boolean;
};
/** What the viewer applies: every field filled in, names checked. raised holds area ids. */
export type Resolved = { camera: Camera; raised: Set<string>; procedures: ProcedureRef[]; diagram: string | null; height: 1 | 4; tags: boolean };

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
  const procedures = (scene.procedures ?? []).map(({ airport, name }) => {
    if (!data.airports.find((a) => a.id === airport)?.procedures.some((p) => p.name === name)) throw new SceneError(`no procedure ${name} at ${airport}`);
    return { airport, name };
  });
  const diagram = scene.diagram ?? null;
  if (diagram !== null && !data.airports.find((a) => a.id === diagram)?.diagram) throw new SceneError(`no diagram for ${diagram}`);
  return { camera: scene.camera ?? "fit", raised, procedures, diagram, height: scene.height ?? 4, tags: scene.tags ?? true };
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
  if (o.approach) scene.procedures = [{ airport, name: o.approach }];
  return scene;
}

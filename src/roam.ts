// Free-roam state: which procedures are shown (any number, from any airport), the current airport (the last one
// searched or picked from), and whether its diagram is on. sceneOf() turns it into the scene the viewer shows.
import type { Fix, Procedure, ProcType, Segment } from "./procedure.js";
import type { Kind } from "./airspace.js";
import type { AreaRef, Camera, ProcedureRef, Scene } from "./scene.js";

/**
 * camera: the camera to use next. undefined: frame what is shown (the procedures, else the diagram); null: leave it
 * where it is.
 */
export type Roam = { first: Scene; procedures: ProcedureRef[]; airport: string | null; diagram: boolean; camera: Camera | null | undefined };

const same = (a: ProcedureRef, b: ProcedureRef) => a.airport === b.airport && a.name === b.name;

/** Starts from the first scene: its procedures and diagram are shown and removable, its camera used until a change. */
export function start(first: Scene, airport?: string): Roam {
  const procedures = (first.procedures ?? []).map((p) => ({ airport: p.airport, name: p.name }));
  return { first, procedures, airport: first.diagram ?? airport ?? procedures[0]?.airport ?? null, diagram: !!first.diagram, camera: first.camera ?? "fit" };
}

// A departure and an approach are never flown together, so showing one takes the other kind away. Arrivals go with either.
const APART: Partial<Record<ProcType, ProcType>> = { SID: "IAP", IAP: "SID" };

/**
 * Adds a procedure once and frames what is shown; its airport becomes the current one, its diagram on only if it has
 * one. With typeOf, adding a departure removes the approaches shown and adding an approach removes the departures.
 */
export function add(r: Roam, p: ProcedureRef, hasDiagram: (airport: string) => boolean = () => true, typeOf?: (p: ProcedureRef) => ProcType | undefined): Roam {
  const apart = typeOf && APART[typeOf(p)!];
  const kept = apart ? r.procedures.filter((q) => typeOf(q) !== apart) : r.procedures;
  const procedures = kept.some((q) => same(q, p)) ? kept : [...kept, { airport: p.airport, name: p.name }];
  return { ...r, procedures, airport: p.airport, diagram: r.diagram && hasDiagram(p.airport), camera: undefined };
}

/** Removing one leaves the camera where it is. */
export function remove(r: Roam, p: ProcedureRef): Roam {
  return { ...r, procedures: r.procedures.filter((q) => !same(q, p)), camera: null };
}

/** Makes an airport current; its diagram stays on only if it has one. */
export function pickAirport(r: Roam, airport: string, hasDiagram: (airport: string) => boolean): Roam {
  return { ...r, airport, diagram: r.diagram && hasDiagram(airport), camera: null };
}

/** Turning it on or off leaves the camera where it is. */
export function toggleDiagram(r: Roam, hasDiagram: (airport: string) => boolean): Roam {
  const diagram = !r.diagram && r.airport !== null && hasDiagram(r.airport);
  return { ...r, diagram, camera: null };
}

/**
 * The raise to show: the first scene's until the viewer has shown it, then exactly what is raised on screen (raised:
 * area ids), so areas raised or lowered by tapping the chart stay that way through later changes.
 */
export function raiseNow(first: Scene, raised: string[] | null): (Kind | AreaRef)[] {
  return raised === null ? (first.raise ?? []) : raised.map((area) => ({ area }));
}

/** What the viewer shows now: the first scene, plus the diagram while on, plus the shown procedures framed. */
export function sceneOf(r: Roam): Scene {
  const scene: Scene = { ...r.first };
  delete scene.procedures;
  delete scene.diagram;
  const diagram = r.diagram && r.airport ? r.airport : null;
  if (diagram) scene.diagram = diagram;
  if (r.procedures.length) scene.procedures = r.procedures.map((p) => ({ ...p }));
  scene.camera =
    r.camera !== undefined ? r.camera
    : r.procedures.length ? { frame: r.procedures.map((p) => ({ procedure: { ...p } })) }
    : diagram ? { frame: [{ diagram }] }
    : null;
  return scene;
}

const RANK: Record<Segment, number> = { final: 0, common: 1, transition: 2, missed: 3, vectors: 4 };

/**
 * One tag per fix across all shown procedures: the final's role and altitude win, as within one procedure. A fix is
 * its name at its place, since runway fixes (RW03) share names across airports.
 */
export function fixTags(procedures: Procedure[]): Fix[] {
  const tags = new Map<string, Fix>();
  for (const p of procedures) {
    for (const f of p.fixes) {
      const key = `${f.name}|${f.lat.toFixed(3)}|${f.lon.toFixed(3)}`;
      const old = tags.get(key);
      if (old && RANK[old.seg] <= RANK[f.seg] && !(old.alt === null && f.alt)) continue;
      tags.set(key, f);
    }
  }
  return [...tags.values()];
}

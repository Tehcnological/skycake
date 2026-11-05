// Free-roam state: which procedures are shown (any number, from any airport), the current airport (the last one
// searched or picked from), and whether its diagram is on. sceneOf() turns it into the scene the viewer shows.
import type { Fix, Procedure, Segment } from "./procedure.js";
import type { ProcedureRef, Scene } from "./scene.js";

export type Roam = { first: Scene; procedures: ProcedureRef[]; airport: string | null; diagram: boolean };

const same = (a: ProcedureRef, b: ProcedureRef) => a.airport === b.airport && a.name === b.name;

export function start(first: Scene, airport?: string): Roam {
  return { first, procedures: [], airport: airport ?? null, diagram: false };
}

/** Adds a procedure once; its airport becomes the current one. */
export function add(r: Roam, p: ProcedureRef): Roam {
  const procedures = r.procedures.some((q) => same(q, p)) ? r.procedures : [...r.procedures, { airport: p.airport, name: p.name }];
  return { ...r, procedures, airport: p.airport };
}

export function remove(r: Roam, p: ProcedureRef): Roam {
  return { ...r, procedures: r.procedures.filter((q) => !same(q, p)) };
}

/** Makes an airport current; its diagram stays on only if it has one. */
export function pickAirport(r: Roam, airport: string, hasDiagram: (airport: string) => boolean): Roam {
  return { ...r, airport, diagram: r.diagram && hasDiagram(airport) };
}

export function toggleDiagram(r: Roam, hasDiagram: (airport: string) => boolean): Roam {
  return { ...r, diagram: !r.diagram && r.airport !== null && hasDiagram(r.airport) };
}

/** What the viewer shows now: the first scene, plus the diagram while on, plus the shown procedures framed. */
export function sceneOf(r: Roam): Scene {
  const scene: Scene = { ...r.first };
  if (r.diagram && r.airport) scene.diagram = r.airport;
  if (r.procedures.length) {
    scene.procedures = r.procedures.map((p) => ({ ...p }));
    scene.camera = { frame: r.procedures.map((p) => ({ procedure: { ...p } })) };
  }
  return scene;
}

const RANK: Record<Segment, number> = { final: 0, common: 1, transition: 2, missed: 3, vectors: 4 };

/** One tag per fix across all shown procedures: the final's role and altitude win, as within one procedure. */
export function fixTags(procedures: Procedure[]): Fix[] {
  const tags = new Map<string, Fix>();
  for (const p of procedures) {
    for (const f of p.fixes) {
      const old = tags.get(f.name);
      if (old && RANK[old.seg] <= RANK[f.seg] && !(old.alt === null && f.alt)) continue;
      tags.set(f.name, f);
    }
  }
  return [...tags.values()];
}

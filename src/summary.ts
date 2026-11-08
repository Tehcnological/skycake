// The map in words, for a screen reader reaching the view in accessibility mode: the chart, the raised areas with their
// altitudes, the procedures shown. Free roam's only, so it never gives a question's answer away.
import type { Labels } from "./ui.js";

export function describe(o: { chart: string; areas: { name: string; floor: string; ceiling: string }[]; procedures: string[] }, L: Labels): string {
  return L.summary(o.chart, o.areas.map((a) => L.facts(a.name, a.floor, a.ceiling)), o.procedures);
}

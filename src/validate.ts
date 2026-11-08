// Checks content against the area's data before it ships. Pure and DOM-free, so a site runs it in Node.
// Unknown extra fields are ignored: sites keep their own tags.
import type { AirspaceFile } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import { maker, type Quiz } from "./quiz.js";
import { seeded } from "./generate.js";
import { LABELS } from "./ui.js";
import type { Question } from "./question.js";
import { usable, type Scene } from "./scene.js";
import type { Walkthrough } from "./walkthrough.js";

/** Problems with a scene, one per field that names something the data lacks. */
function sceneProblems(scene: Scene | undefined, data: AirspaceFile, hasFix: (name: string) => boolean): string[] {
  const out: string[] = [];
  usable(scene ?? {}, data, hasFix, (m) => out.push(m.replace(/; leaving out .*$/, "")));
  return out;
}

/** Problems with a question, without a prefix; the quiz validator reuses this. */
export function questionProblems(q: Question, data: AirspaceFile, hasFix: (name: string) => boolean): string[] {
  const out = sceneProblems(q.scene, data, hasFix);
  if (q.type === "find") out.push(...sceneProblems({ highlight: [q.answer] }, data, hasFix));
  if (q.answerArea !== undefined) out.push(...sceneProblems({ highlight: [{ area: q.answerArea }] }, data, hasFix));
  if (typeof q.prompt !== "string" || !q.prompt.trim()) out.push("prompt is empty");
  if ("choices" in q) {
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4) out.push("choices must be 2 to 4");
    else {
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) out.push(`answer ${q.answer} is not a choice`);
      if (new Set(q.choices).size < q.choices.length) out.push("choices repeat");
    }
  }
  if ("number" in q && !(q.number.tolerance >= 0)) out.push("tolerance is below 0");
  return out;
}

/** Whether a fix name is in any airport's procedures or the area's waypoints. */
export async function fixFinder(data: AirspaceFile, procedures: (airport: string) => Promise<Procedure[]>): Promise<(name: string) => boolean> {
  const names = new Set(data.waypoints.map((w) => w.name));
  for (const a of data.airports) for (const p of await procedures(a.id)) for (const f of p.fixes) names.add(f.name);
  return (name) => names.has(name);
}

/** area: the folder name the site loaded (the data carries no area name). Problems read "<id> step <n>: <problem>". */
export async function validateWalkthrough(w: Walkthrough, data: AirspaceFile, procedures: (airport: string) => Promise<Procedure[]>, area: string): Promise<string[]> {
  const out: string[] = [];
  if (w.area !== area) out.push(`${w.id}: area ${w.area}, data is ${area}`);
  const hasFix = await fixFinder(data, procedures);
  w.steps.forEach((s, i) => {
    const at = `${w.id} step ${i + 1}: `;
    const problems: string[] = [];
    if (typeof s.caption !== "string") problems.push("caption is not text");
    if (s.seconds !== undefined && !(s.seconds > 0)) problems.push("seconds must be above 0");
    problems.push(...sceneProblems(s.scene, data, hasFix), ...(s.check ? questionProblems(s.check, data, hasFix) : []));
    out.push(...problems.map((p) => at + p));
  });
  return out;
}

/** Problems read "<quiz id> item <n>: <problem>". A generate item is tried once with seeded(0) and no elevation grid. */
export async function validateQuiz(q: Quiz, data: AirspaceFile, procedures: (airport: string) => Promise<Procedure[]>, area: string): Promise<string[]> {
  const out: string[] = [];
  if (q.area !== area) out.push(`${q.id}: area ${q.area}, data is ${area}`);
  const loaded = await Promise.all(data.airports.map((a) => procedures(a.id)));
  const hasFix = await fixFinder(data, async (id) => loaded[data.airports.findIndex((a) => a.id === id)]);
  const make = maker({ data, grid: null, procedures: loaded.flat(), ask: LABELS.ask }, seeded(0));
  q.items.forEach((it, i) => {
    const problems: string[] = [];
    if (!("generate" in it)) problems.push(...questionProblems(it, data, hasFix));
    else {
      if (!(it.count >= 1)) problems.push("count must be at least 1");
      problems.push(...sceneProblems({ highlight: (it.airports ?? []).map((airport) => ({ airport })) }, data, hasFix));
      if (!problems.length && !make(it)) problems.push("nothing to ask with these filters");
    }
    out.push(...problems.map((p) => `${q.id} item ${i + 1}: ${p}`));
  });
  return out;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { hundreds, type AirspaceFile } from "./airspace.js";
import { classAt, groundFt, nearBoundary, needs } from "./airclass.js";
import { flightLine } from "./fly.js";
import type { Procedure } from "./procedure.js";
import { LABELS } from "./ui.js";
import { generate, seeded, type Gen } from "./generate.js";
import type { Question } from "./question.js";

const data: AirspaceFile = JSON.parse(readFileSync("data/phoenix/area.json", "utf8"));
const grid = new Int16Array(readFileSync("data/phoenix/dem.bin").buffer);
const dir = "data/phoenix/procedures/";
const procedures: Procedure[] = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(dir + f, "utf8")));
const g: Gen = { data, grid, procedures, ask: LABELS.ask };
const ask = LABELS.ask;

/** Recomputes the right answer from the data alone; true when the question's marked answer matches. */
function trueAnswer(q: Question, g: Gen): boolean {
  const { data } = g;
  const shown = "choices" in q ? q.choices[q.answer] : null;
  if (q.type === "find") {
    if ("area" in q.answer) return data.areas.some((a) => a.id === (q.answer as { area: string }).area);
    const fix = (q.answer as { fix: string }).fix;
    return q.scene!.procedures!.some((r) => g.procedures.find((p) => p.airport === r.airport && p.name === r.name)!.fixes.some((f) => f.name === fix));
  }
  if (q.type === "read") {
    const a = data.areas.find((x) => x.id === (q.scene!.highlight![0] as { area: string }).area)!;
    if (q.prompt === ask.floor) return shown === hundreds(a.floor, data.ground);
    if (q.prompt === ask.ceiling) return shown === hundreds(a.ceiling, data.ground);
    return q.prompt === ask.cls && shown === a.kind;
  }
  if (q.type === "airplane") {
    const [lat, lon, ft] = (q.scene!.airplane as { at: [number, number, number] }).at;
    const c = classAt(data, grid, lat, lon, ft), n = needs(c, ft);
    const yn = (b: boolean) => (b ? ask.yes : ask.no);
    if (q.prompt === ask.airplaneClass) return shown === c.kind;
    if (q.prompt === ask.clearance) return shown === yn(n.clearance);
    if (q.prompt === ask.radio) return shown === yn(n.radio);
    return q.prompt === ask.transponder && shown === yn(n.transponder);
  }
  const r = q.scene!.procedures![0];
  const p = g.procedures.find((x) => x.airport === r.airport && x.name === r.name)!;
  if (q.prompt === ask.faf) return shown === p.fixes.find((f) => f.role === "FAF")!.name;
  if (q.prompt === ask.missed) return shown === p.fixes.find((f) => f.seg === "missed")!.name;
  const line = flightLine(p).map((pt) => p.fixes.find((f) => Math.abs(f.lat - pt[0]) < 1e-4 && Math.abs(f.lon - pt[1]) < 1e-4)?.name).filter((n) => n).filter((n, i, a) => n !== a[i - 1]); // a hold repeats its fix; the next fix that is charted
  return p.fixes.some((f) => {
    if (q.prompt === ask.altAt(f.name)) return shown === f.alt;
    const i = line.indexOf(f.name);
    return q.prompt === ask.after(f.name) && i >= 0 && shown === line[i + 1];
  });
}

for (const type of ["find", "read", "airplane", "procedure"] as const) {
  test(`${type}: answers match the data and choices are 2 to 4 and distinct`, () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const q = generate(type, g, rng)!;
      assert.ok(q, "a question");
      if ("choices" in q) {
        assert.ok(q.choices.length >= 2 && q.choices.length <= 4);
        assert.equal(new Set(q.choices).size, q.choices.length);
      }
      assert.ok(trueAnswer(q, g), q.prompt);
    }
  });
}
test("read questions start top-down and flat; find and airplane too", () => {
  const rng = seeded(3);
  for (let i = 0; i < 50; i++) {
    const q = generate("read", g, rng)!;
    assert.equal(q.scene!.highlight!.length, 1);
    assert.equal(q.scene!.camera, undefined);
    assert.equal(q.scene!.raise, undefined);
  }
});
test("airplane points are never near a boundary and stay in the altitude limits", () => {
  const rng = seeded(5);
  for (let i = 0; i < 200; i++) {
    const [lat, lon, ft] = (generate("airplane", g, rng)!.scene!.airplane as { at: [number, number, number] }).at;
    assert.ok(!nearBoundary(data, grid, lat, lon, ft));
    assert.ok(ft - groundFt(data, grid, lat, lon) >= 500 && ft <= 17500);
    assert.ok(lat >= data.bounds.s && lat <= data.bounds.n && lon >= data.bounds.w && lon <= data.bounds.e);
  }
});
test("airplane questions carry the class area at the point, for the reveal to raise", () => {
  const rng = seeded(7);
  let some = 0;
  for (let i = 0; i < 100; i++) {
    const q = generate("airplane", g, rng)!;
    const [lat, lon, ft] = (q.scene!.airplane as { at: [number, number, number] }).at;
    const area = classAt(data, grid, lat, lon, ft).area;
    assert.equal(q.answerArea, area ?? undefined);
    if (area) some++;
  }
  assert.ok(some > 0);
});
test("filters: kinds and airports are respected; nothing left gives null", () => {
  const p = generate("find", { ...g, kinds: ["P"], procedures: [] }, seeded(1));
  if (data.areas.some((a) => a.kind === "P")) assert.equal(data.areas.find((a) => "area" in (p as any).answer && a.id === (p as any).answer.area)!.kind, "P");
  else assert.equal(p, null);
  const rng = seeded(2);
  for (let i = 0; i < 100; i++) {
    const k = generate("read", { ...g, kinds: ["D"] }, rng)!;
    assert.equal(data.areas.find((a) => a.id === (k.scene!.highlight![0] as { area: string }).area)!.kind, "D");
  }
  const q = generate("procedure", { ...g, airports: ["KCHD"], procedures: g.procedures.filter((p) => p.airport === "KCHD") }, seeded(2))!;
  assert.ok(q.scene!.procedures!.every((p) => p.airport === "KCHD"));
  const wrong = generate("procedure", { ...g, airports: ["KCHD"], procedures: g.procedures.filter((p) => p.airport !== "KCHD") }, seeded(2));
  assert.equal(wrong, null);
  assert.equal(generate("procedure", { ...g, procedures: [] }, seeded(2)), null);
});
test("same seed, same questions", () => assert.deepEqual(generate("read", g, seeded(7)), generate("read", g, seeded(7))));
test("find prompts name exactly one area or one fix of the shown procedure", () => {
  const rng = seeded(11);
  for (let i = 0; i < 400; i++) {
    const q = generate("find", g, rng)! as Extract<Question, { type: "find" }>;
    if ("area" in q.answer) {
      const a = data.areas.find((x) => x.id === (q.answer as { area: string }).area)!;
      assert.equal(data.areas.filter((x) => x.name === a.name).length, 1);
    } else {
      const r = q.scene!.procedures![0], p = procedures.find((x) => x.airport === r.airport && x.name === r.name)!;
      assert.equal(p.fixes.filter((f) => f.name === (q.answer as { fix: string }).fix).length, 1);
    }
  }
});

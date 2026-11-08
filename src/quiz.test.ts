import assert from "node:assert/strict";
import { test } from "node:test";
import { seeded } from "./generate.js";
import { readdirSync, readFileSync } from "node:fs";
import type { AirspaceFile } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import { LABELS } from "./ui.js";
import { advance, answer, attempt, maker, practice, type Make, type Quiz } from "./quiz.js";
import type { Question } from "./question.js";

let n = 0;
const make: Make = (g) => ({ type: "read", prompt: `${g.generate} ${n++}`, choices: ["a", "b"], answer: 0, facts: null });
const w = (id: string): Question => ({ id, type: "read", prompt: id, choices: ["a", "b"], answer: 0 });
const quiz: Quiz = { id: "q", title: "", area: "phoenix", items: [w("w1"), { generate: "read", count: 2 }, w("w2")] };
const keys = (a: { items: { key: string }[] }) => a.items.map((x) => x.key);

test("written items stay; generated items are drawn fresh each attempt", () => {
  const a = attempt(quiz, make, seeded(1)), b = attempt(quiz, make, seeded(1));
  assert.deepEqual(keys(a), ["w1", "generate:read:0", "generate:read:1", "w2"]);
  assert.notDeepEqual(a.items[1].q, b.items[1].q);
  assert.deepEqual(a.items[0].q, b.items[0].q);
});
test("shuffle reorders with the rng, keeping every item", () => {
  const a = attempt({ ...quiz, shuffle: true }, make, seeded(3));
  assert.deepEqual(keys(a).sort(), ["generate:read:0", "generate:read:1", "w1", "w2"]);
  assert.notDeepEqual(keys(a), ["w1", "generate:read:0", "generate:read:1", "w2"]);
  assert.deepEqual(a.items.find((x) => x.key === "w1")!.q, w("w1"));
});
test("a generate item that makes nothing is left out", () => {
  const a = attempt({ ...quiz, items: [w("w1"), { generate: "find", count: 3 }] }, () => null, seeded(1));
  assert.deepEqual(keys(a), ["w1"]);
});
test("scoring and the end", () => {
  let a = attempt(quiz, make, seeded(1));
  const before = a;
  for (const r of [true, false, true, true]) a = advance(answer(a, r), make, seeded(1));
  assert.deepEqual([a.right, a.answered, a.done], [3, 4, true]);
  assert.deepEqual([before.right, before.answered, before.i, before.done], [0, 0, 0, false]);
});
test("practice never ends, and is null when nothing can be asked", () => {
  let a = practice(make, ["read"], {}, seeded(1))!;
  for (let i = 0; i < 50; i++) a = advance(answer(a, true), make, seeded(i));
  assert.equal(a.done, false);
  assert.equal(a.items.length, 51);
  assert.equal(practice(() => null, ["find"], { kinds: ["P"] }, seeded(1)), null);
  assert.equal(practice(make, [], {}, seeded(1)), null);
});
test("practice passes the filters and picks among the allowed types", () => {
  const seen: string[] = [];
  const spy: Make = (g) => (seen.push(`${g.generate}:${g.kinds}:${g.airports}`), make(g));
  let a = practice(spy, ["find", "airplane"], { kinds: ["D"], airports: ["KCHD"] }, seeded(2))!;
  for (let i = 0; i < 20; i++) a = advance(a, spy, seeded(i + 5));
  assert.ok(seen.every((s) => /^(find|airplane):D:KCHD$/.test(s)));
  assert.equal(new Set(seen.map((s) => s.split(":")[0])).size, 2);
});
test("maker: one filter alone keeps to its side; nothing to ask gives practice null", () => {
  const data: AirspaceFile = JSON.parse(readFileSync("data/phoenix/area.json", "utf8"));
  const dir = "data/phoenix/procedures/";
  const procedures: Procedure[] = readdirSync(dir).flatMap((f) => JSON.parse(readFileSync(dir + f, "utf8")));
  const m = maker({ data, grid: null, procedures, ask: LABELS.ask }, seeded(4));
  const all = ["find", "read", "airplane", "procedure"] as const;
  assert.equal(practice(m, [...all], { kinds: ["P"] }, seeded(1)), null);
  assert.equal(practice(m, [...all], { airports: ["KNONE"] }, seeded(1)), null);
  for (let i = 0; i < 20; i++) {
    const d = m({ generate: "find", count: 1, kinds: ["D"] })!;
    assert.ok("area" in (d as { answer: object }).answer, "kinds alone: no fix to tap");
    const f = m({ generate: "find", count: 1, airports: ["KCHD"] })!;
    assert.ok("fix" in (f as { answer: object }).answer, "airports alone: no area to tap");
  }
  assert.equal(m({ generate: "airplane", count: 1, airports: ["KCHD"] }), null);
  assert.ok(m({ generate: "airplane", count: 1, kinds: ["B"] }));
  assert.ok(m({ generate: "procedure", count: 1 }) && m({ generate: "read", count: 1 }));
});

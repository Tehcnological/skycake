import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AirspaceFile } from "./airspace.js";
import type { Procedure } from "./procedure.js";
import type { Quiz } from "./quiz.js";
import { validateQuiz, validateWalkthrough } from "./validate.js";
import type { Walkthrough } from "./walkthrough.js";

const data: AirspaceFile = JSON.parse(readFileSync("data/phoenix/area.json", "utf8"));
const files = async (airport: string): Promise<Procedure[]> => JSON.parse(readFileSync(`data/phoenix/procedures/${airport}.json`, "utf8"));
const good: Walkthrough = { id: "t", title: "T", area: "phoenix", steps: [{ caption: "a", scene: { raise: ["B"] } }] };

test("a good walkthrough has no problems", async () => assert.deepEqual(await validateWalkthrough(good, data, files, "phoenix"), []));
test("catches a missing area, airport, procedure and fix, with the step number", async () => {
  const bad = { ...good, steps: [
    { caption: "a", scene: { raise: [{ area: "nope" }] } },
    { caption: "b", scene: { highlight: [{ airport: "KZZZ" }] } },
    { caption: "c", scene: { procedures: [{ airport: "KPHX", name: "NOPE" }] } },
    { caption: "d", scene: { highlight: [{ fix: "ZZZZZ" }] } },
  ] };
  assert.deepEqual(await validateWalkthrough(bad, data, files, "phoenix"), ["t step 1: no area nope", "t step 2: no airport KZZZ", "t step 3: no procedure NOPE at KPHX", "t step 4: no fix ZZZZZ"]);
});
test("catches a check whose answer is out of range or a walkthrough for another area", async () => {
  const bad = { ...good, area: "miami", steps: [{ caption: "a", scene: {}, check: { type: "read" as const, prompt: "?", choices: ["x", "x"], answer: 2 } }] };
  assert.deepEqual(await validateWalkthrough(bad, data, files, "phoenix"), ["t: area miami, data is phoenix", "t step 1: answer 2 is not a choice", "t step 1: choices repeat"]);
});
test("catches bad captions, seconds, prompts, choice counts and tolerance; ignores unknown fields", async () => {
  const bad = { ...good, steps: [
    { caption: 5, scene: {}, seconds: 0, acs: "x" },
    { caption: "b", scene: {}, check: { type: "read", prompt: "", choices: ["x"], answer: 0 } },
    { caption: "c", scene: {}, check: { type: "read", prompt: "?", number: { answer: 1, tolerance: -1 } } },
  ] } as unknown as Walkthrough;
  assert.deepEqual(await validateWalkthrough(bad, data, files, "phoenix"), ["t step 1: caption is not text", "t step 1: seconds must be above 0", "t step 2: prompt is empty", "t step 2: choices must be 2 to 4", "t step 3: tolerance is below 0"]);
});
test("a check's own scene and find answer are checked too", async () => {
  const bad = { ...good, steps: [{ caption: "a", scene: {}, check: { type: "find" as const, prompt: "?", answer: { fix: "ZZZZZ" }, scene: { highlight: [{ airport: "KZZZ" }] } } }] };
  assert.deepEqual(await validateWalkthrough(bad, data, files, "phoenix"), ["t step 1: no airport KZZZ", "t step 1: no fix ZZZZZ"]);
});

const goodQuiz: Quiz = { id: "q", title: "Q", area: "phoenix", items: [
  { type: "find", prompt: "?", answer: { area: data.areas[0].id } },
  { generate: "read", count: 2 },
] };
test("a good quiz has no problems", async () => assert.deepEqual(await validateQuiz(goodQuiz, data, files, "phoenix"), []));
test("catches bad written items and impossible generate items", async () => {
  const bad = { ...goodQuiz, items: [
    { type: "find", prompt: "?", answer: { area: "nope" } },
    { type: "read", prompt: "?", number: { answer: 5000, tolerance: -1 } },
    { generate: "procedure", count: 2, airports: ["KZZZ"] },
    { generate: "find", count: 0 },
  ] } as Quiz;
  assert.deepEqual(await validateQuiz(bad, data, files, "phoenix"), [
    "q item 1: no area nope", "q item 2: tolerance is below 0", "q item 3: no airport KZZZ", "q item 4: count must be at least 1",
  ]);
});
test("catches another area, an answerArea the data lacks, and filters that leave nothing to ask", async () => {
  const bad = { ...goodQuiz, area: "miami", items: [
    { type: "airplane", prompt: "?", choices: ["a", "b"], answer: 0, answerArea: "nope" },
    { generate: "airplane", count: 1, kinds: ["MOA"] },
    { generate: "read", count: 1, extra: "ignored" },
  ] } as unknown as Quiz;
  assert.deepEqual(await validateQuiz(bad, data, files, "phoenix"), ["q: area miami, data is phoenix", "q item 1: no area nope", "q item 2: nothing to ask with these filters"]);
});

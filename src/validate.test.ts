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
test("catches questions the browser cannot run", async () => {
  const ils = { procedures: [{ airport: "KPHX", name: "ILS RWY 07L" }] };
  const bad = { ...goodQuiz, items: [
    { type: "read", prompt: "?" },
    { type: "find", prompt: "?" },
    { type: "find", prompt: "?", answer: { procedure: { airport: "KPHX", name: "ILS RWY 07L" } } },
    { type: "find", prompt: "?", answer: { fix: "ZINGA" } },
    { type: "find", prompt: "?", answer: { area: "e700-buckeye-class-e5" } },
    { type: "find", prompt: "?", answer: { area: "modec-phoenix-sky-harbor-international-mode-c" } },
    { type: "find", prompt: "?", answer: { fix: "ZINGA" }, scene: ils },
    { type: "find", prompt: "?", answer: { fix: "BXK" } },
  ] } as unknown as Quiz;
  assert.deepEqual(await validateQuiz(bad, data, files, "phoenix"), [
    "q item 1: no choices or number",
    "q item 2: answer must be an area, fix, airport or point",
    "q item 3: answer must be an area, fix, airport or point",
    "q item 4: fix ZINGA is not on the question's procedures or the area's waypoints",
    "q item 5: area e700-buckeye-class-e5 is E700, which cannot be tapped",
    "q item 6: area modec-phoenix-sky-harbor-international-mode-c is MODEC, which cannot be tapped",
  ]);
});
test("a fix on the procedure the airplane flies counts as shown", async () => {
  const q = { ...goodQuiz, items: [{ type: "find", prompt: "?", answer: { fix: "ZINGA" }, scene: { airplane: { along: { airport: "KPHX", name: "ILS RWY 07L" }, seconds: 30 } } }] } as Quiz;
  assert.deepEqual(await validateQuiz(q, data, files, "phoenix"), []);
});
test("a fix is known only from the scene's own procedures and the waypoints, as in the browser", async () => {
  const off = { ...good, steps: [{ caption: "a", scene: { highlight: [{ fix: "ZINGA" }] } }] };
  assert.deepEqual(await validateWalkthrough(off, data, files, "phoenix"), ["t step 1: no fix ZINGA"]);
  const on = { ...good, steps: [{ caption: "a", scene: { highlight: [{ fix: "ZINGA" }], procedures: [{ airport: "KPHX", name: "ILS RWY 07L" }] } }] };
  assert.deepEqual(await validateWalkthrough(on, data, files, "phoenix"), []);
});
test("a find question's also areas must exist", async () => {
  const q = { ...goodQuiz, items: [{ type: "find", prompt: "?", answer: { area: data.areas[0].id }, also: ["nope"] }] } as Quiz;
  assert.deepEqual(await validateQuiz(q, data, files, "phoenix"), ["q item 1: no area nope"]);
});
test("a find question's also areas must be tappable and beside an area answer", async () => {
  const e700 = data.areas.find((a) => a.kind === "E700")!.id;
  const one = (q: object) => validateQuiz({ ...goodQuiz, items: [q] } as Quiz, data, files, "phoenix");
  assert.deepEqual(await one({ type: "find", prompt: "?", answer: { area: data.areas[0].id }, also: [e700] }), [`q item 1: area ${e700} is E700, which cannot be tapped`]);
  assert.deepEqual(await one({ type: "find", prompt: "?", answer: { airport: "KPHX" }, also: [data.areas[0].id] }), ["q item 1: also must be a list of area ids, beside an area answer"]);
});
test("written item ids must not repeat", async () => {
  const q = { ...goodQuiz, items: [{ id: "a", type: "read", prompt: "?", choices: ["x", "y"], answer: 0 }, { id: "a", type: "read", prompt: "?", choices: ["x", "y"], answer: 1 }] } as Quiz;
  assert.deepEqual(await validateQuiz(q, data, files, "phoenix"), ["q item 2: id a repeats"]);
});
test("a walkthrough with no steps", async () => assert.deepEqual(await validateWalkthrough({ ...good, steps: [] }, data, files, "phoenix"), ["t: no steps"]));
test("the demo samples have no problems", async () => {
  assert.deepEqual(await validateQuiz(JSON.parse(readFileSync("demo/class-b-quiz.json", "utf8")), data, files, "phoenix"), []);
  assert.deepEqual(await validateWalkthrough(JSON.parse(readFileSync("demo/class-b.json", "utf8")), data, files, "phoenix"), []);
});

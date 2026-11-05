import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AirspaceFile } from "./airspace.js";
import { search } from "./search.js";

const { airports }: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));

test("airports match with or without the K, in any case", () => {
  for (const q of ["KPHX", "kphx", "phx"]) assert.equal(search(q, airports)[0].airport, "KPHX");
  assert.equal(search("sdl", airports)[0].airport, "KSDL");
});

test("procedures match on any part of the name, grouped by airport and type in the spec's order", () => {
  const g = search("25L", airports);
  assert.ok(g.length > 0 && g.every((x) => x.hits.every((h) => h.procedure!.name.includes("25L"))));
  assert.deepEqual(g.filter((x) => x.airport === "KPHX").map((x) => x.type), ["IAP"]);
  const b = search("bnyrd", airports);
  assert.ok(b.length >= 5 && b.every((x) => x.type === "SID" && x.hits[0].procedure!.name === "BNYRD6"));
  const s = search("KSDL", airports);
  assert.deepEqual(s.map((x) => x.type), [null, "IAP", "STAR", "SID"]);
});

test("nothing matches nothing", () => {
  assert.deepEqual(search("qqqq", airports), []); // not "zzz": IZZZO8 is a real departure
  assert.deepEqual(search("   ", airports), []);
});

test("an airport lists every one of its procedures", () => {
  const kphx = airports.find((a) => a.id === "KPHX")!;
  const hits = search("phx", airports).flatMap((g) => g.hits).filter((h) => h.procedure);
  assert.equal(hits.length, kphx.procedures.length);
});

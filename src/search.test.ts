import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AirspaceFile } from "./airspace.js";
import { airportList, proceduresAt, search } from "./search.js";

const { airports }: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));

test("the search box finds procedures only, not airports", () => {
  assert.deepEqual(search("phx", airports), []);
  assert.deepEqual(search("KSDL", airports), []);
});

test("procedures match on any part of the name, grouped by airport and type in the spec's order", () => {
  const g = search("25L", airports);
  assert.ok(g.length > 0 && g.every((x) => x.hits.every((h) => h.procedure.name.includes("25L"))));
  assert.deepEqual(g.filter((x) => x.airport === "KPHX").map((x) => x.type), ["IAP"]);
  const b = search("bnyrd", airports);
  assert.ok(b.length >= 5 && b.every((x) => x.type === "SID" && x.hits[0].procedure.name === "BNYRD6"));
});

test("nothing matches nothing", () => {
  assert.deepEqual(search("qqqq", airports), []); // not "zzz": IZZZO8 is a real departure
  assert.deepEqual(search("   ", airports), []);
});

test("the airport list: every airport with procedures, by id", () => {
  const list = airportList(airports);
  assert.ok(list.length > 0 && list.every((a) => a.procedures.length > 0));
  assert.deepEqual(list.map((a) => a.id), [...list.map((a) => a.id)].sort());
  assert.ok(list.some((a) => a.id === "KPHX"));
});

test("an airport's procedures: all of them, grouped Approaches, Arrivals, Departures", () => {
  const kphx = airports.find((a) => a.id === "KPHX")!;
  const g = proceduresAt(kphx);
  assert.deepEqual(g.map((x) => x.type), ["IAP", "STAR", "SID"]);
  assert.equal(g.flatMap((x) => x.hits).length, kphx.procedures.length);
});

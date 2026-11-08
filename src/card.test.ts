import assert from "node:assert/strict";
import { test } from "node:test";
import { pickByNumber } from "./card.js";

test("only a listed whole number picks", () => {
  assert.equal(pickByNumber("3", 5), 2);
  assert.equal(pickByNumber(" 1 ", 5), 0);
  for (const bad of ["0", "6", "99", "3.5", "", "x", "-1", "1e0"]) assert.equal(pickByNumber(bad, 5), null);
});

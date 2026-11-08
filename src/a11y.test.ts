import assert from "node:assert/strict";
import { test } from "node:test";
import { initial, store } from "./a11y.js";

const mem = (v: string | null) => ({ getItem: () => v });
const throws = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
};
test("a host's value wins and hides the row", () => {
  assert.deepEqual(initial(false, mem("1")), { on: false, row: false });
  assert.deepEqual(initial(true, mem(null)), { on: true, row: false });
});
test("no host value: the stored one, and the row", () => {
  assert.deepEqual(initial(undefined, mem("1")), { on: true, row: true });
  assert.deepEqual(initial(undefined, mem(null)), { on: false, row: true });
  assert.deepEqual(initial(undefined, null), { on: false, row: true });
});
test("blocked storage is off, never a throw", () => {
  assert.deepEqual(initial(undefined, throws), { on: false, row: true });
  const bad = {
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => store(bad, true));
});

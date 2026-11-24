// The stylesheet rules the UI audit's fixes rely on (UI_AUDIT.md): the area close in the phone header, the airspace
// sheet on its tab bar, the airport names in the picker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");
/** The text of each top-level block whose head matches, e.g. one @media query. */
function blocks(head: string): string[] {
  const out: string[] = [];
  for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head, at + 1)) {
    let depth = 0, i = css.indexOf("{", at);
    const start = i;
    for (; i < css.length; i++) if (css[i] === "{") depth++; else if (css[i] === "}" && --depth === 0) break;
    out.push(css.slice(start, i + 1));
  }
  return out;
}
const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
const rule = (text: string, selector: string) => text.match(new RegExp(escape(selector) + " \\{([^}]*)\\}"))?.[1];
const outside = (selector: string) => {
  let rest = css;
  for (const b of blocks("@media")) rest = rest.replace(b, "{}");
  return rule(rest, selector);
};

test("the area's Close is hidden outside the phone layout and shown, a full row high, in the phone header", () => {
  assert.match(outside(".skycake .sc-area-close, .skycake .sc-find") ?? "", /display: none/);
  const phone = blocks("@media (max-width: 860px) {").find((b) => b.includes(".sc-area-close {"));
  assert.ok(phone);
  assert.match(rule(phone, ".skycake .sc-area-close")!, /display: inline-flex;.*height: var\(--sc-row\)/);
});

test("the desktop offset under the area card applies only on desktop, so the phone sheet sits on its tabs", () => {
  assert.equal(outside(".skycake:has(.sc-where) .sc-tl"), undefined);
  assert.ok(blocks("@media (min-width: 861px) {").some((b) => rule(b, ".skycake:has(.sc-where) .sc-tl")));
  const phone = blocks("@media (max-width: 860px) {").find((b) => rule(b, ".skycake .sc-tl"));
  assert.match(rule(phone!, ".skycake .sc-tl")!, /top: auto; bottom: var\(--sc-tabs\)/);
});

test("airport names in the picker read at the id's size, in the softer text color, not the muted one", () => {
  const name = outside(".skycake .sc-airport span")!, id = outside(".skycake .sc-airport b")!;
  assert.match(name, /font-size: 14px/);
  assert.match(id, /14px/);
  assert.match(name, /color: var\(--sc-soft\)/);
});

test("the accent still follows a site's --red and solid tile follows --tile or --sc-accent", () => {
  assert.match(css, /var\(--red, /);
  assert.match(css, /--sc-tile:\s*var\(--tile,\s*color-mix\(in srgb,\s*var\(--sc-accent\)/);
  assert.match(css, /:root\[data-theme="light"\] \.skycake \{ --sc-edge: var\(--sc-frame\); \}/);
});

test("flat 0px chrome, no CSS case transforms, and motion disabled in a11y and reduced motion", () => {
  const appCss = readFileSync(new URL("../app/app.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /text-transform:\s*(uppercase|lowercase)/);
  assert.doesNotMatch(appCss, /text-transform:\s*(uppercase|lowercase)/);
  assert.match(css, /--sc-r-ctl:\s*0px;/);
  assert.match(css, /--sc-r-panel:\s*0px;/);
  assert.match(css, /--sc-shadow:\s*none;/);
  assert.match(css, /\.skycake\[data-a11y\] \*, .*transition: none !important; animation: none !important;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important;/);
});

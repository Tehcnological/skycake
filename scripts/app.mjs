// Builds SkyCake Viewer (app/) into www/: the app bundled with three.js, the library's style.css, the area data, a data
// manifest and the service worker. npm run app; Cloudflare runs the same. www/ is not in package.json files, so sites
// that install skycake never get it.
import { build } from "esbuild";
import sharp from "sharp";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { contours } from "./contours.mjs";

const out = "www";
const DAY = 864e5;

await rm(out, { recursive: true, force: true });
await build({ entryPoints: ["app/main.ts"], bundle: true, splitting: true, format: "esm", target: "es2022", minify: true, outdir: out, logLevel: "warning" });
for (const f of ["index.html", "demo.html", "help.html", "privacy.html", "accessibility.html", "app.css", "manifest.webmanifest"]) await cp(`app/${f}`, `${out}/${f}`);
await cp("style.css", `${out}/style.css`);
await cp("app/shots", `${out}/shots`, { recursive: true });
// The icons: Android, desktop, and favicon come from flat 2D app/icon.png (1024x1024 source, not shipped directly);
// iOS apple-touch-icon (icon-180.png) uses the Icon Composer Liquid Glass render flattened onto #0c0c0c.
// Maskable pads the artwork inside Android's safe zone on #0c0c0c so adaptive circles never clip the emblem.
await sharp("design/icon/export/png/skycake-liquidglass-1024.png").flatten({ background: "#0c0c0c" }).resize(180, 180).png({ palette: true, effort: 10 }).toFile(`${out}/icon-180.png`);
for (const size of [192, 512]) await sharp("app/icon.png").resize(size, size).png({ palette: true, effort: 10 }).toFile(`${out}/icon-${size}.png`);
const inner = await sharp("app/icon.png").resize(420, 420).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0c0c0c" } }).composite([{ input: inner, gravity: "center" }]).png({ palette: true, effort: 10 }).toFile(`${out}/icon-maskable-512.png`);
// The start screen's contour lines: top-level files, so they are in the shell below and work offline. The still ones,
// for reduced motion and accessibility mode, must not move.
for (const surface of ["page", "card"]) {
  const moving = contours(surface, true), still = contours(surface, false);
  assert.ok(moving.includes("animation") && !still.includes("animation"));
  await writeFile(`${out}/contours-${surface}.svg`, moving);
  await writeFile(`${out}/contours-${surface}-still.svg`, still);
}
await cp("data", `${out}/data`, { recursive: true });

// The data manifest: per area, its edition, the date it is current through, a revision that changes with any file,
// and its files for an offline copy.
// Through: the last day of the area's 28-day procedure cycle. Areas built before the cycle was recorded fall back to
// their chart edition, the earliest cycle they can be from.
const areas = {};
for (const id of (await readdir("data")).sort()) {
  await sharp(`data/${id}/sectional.webp`).resize(720, 210, { fit: "cover" }).webp({ quality: 72 }).toFile(`${out}/preview-${id}.webp`);
  const files = [];
  let bytes = 0;
  const rev = createHash("sha256");
  for (const f of (await readdir(`data/${id}`, { recursive: true })).map((p) => p.replaceAll("\\", "/")).sort()) {
    const s = await stat(`data/${id}/${f}`);
    if (!s.isFile()) continue;
    files.push(f);
    bytes += s.size;
    rev.update(f).update(await readFile(`data/${id}/${f}`));
  }
  const { edition, cycle = edition } = JSON.parse(await readFile(`data/${id}/area.json`, "utf8"));
  assert.match(edition, /^\d{4}-\d{2}-\d{2}$/, `${id}: edition`);
  assert.match(cycle, /^\d{4}-\d{2}-\d{2}$/, `${id}: cycle`);
  const through = new Date(Date.parse(cycle) + 27 * DAY).toISOString().slice(0, 10);
  areas[id] = { edition, through, rev: rev.digest("hex").slice(0, 12), bytes, files };
}
assert.ok(Object.keys(areas).length >= 16 && "phoenix" in areas, "every area built");
for (const a of Object.values(areas)) assert.ok(a.files.includes("area.json") && a.files.includes("sectional.webp"));
await writeFile(`${out}/data/manifest.json`, JSON.stringify({ areas }));

// The service worker. The shell is every top-level file (not data/, nor shots/, the demo page's screenshots, online
// only) plus the data manifest; VERSION changes with any of them, which makes browsers install the new shell.
const shell = ["./", "data/manifest.json", ...(await readdir(out, { withFileTypes: true })).filter((d) => d.isFile()).map((d) => d.name).sort()];
const hash = createHash("sha256");
for (const f of shell.slice(1)) hash.update(f).update(await readFile(`${out}/${f}`));
const sw = `const VERSION = ${JSON.stringify(hash.digest("hex").slice(0, 12))};\nconst SHELL = ${JSON.stringify(shell)};\n${await readFile("app/sw.js", "utf8")}`;
await writeFile(`${out}/sw.js`, sw);
assert.ok(shell.includes("index.html") && shell.includes("main.js") && shell.includes("help.html") && shell.includes("privacy.html") && shell.includes("accessibility.html") && shell.includes("demo.html"));
for (const f of ["contours-page.svg", "contours-page-still.svg", "contours-card.svg", "contours-card-still.svg"]) assert.ok(shell.includes(f), f);
console.log(`www/: ${shell.length} shell files, areas ${Object.entries(areas).map(([id, a]) => `${id} ${a.edition} through ${a.through}`).join(", ")}`);

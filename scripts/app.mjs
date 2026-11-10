// Builds SkyCake Viewer (app/) into www/: the app bundled with three.js, the library's style.css, the area data, a data
// manifest and the service worker. npm run app; Cloudflare runs the same. www/ is not in package.json files, so sites
// that install skycake never get it.
import { build } from "esbuild";
import sharp from "sharp";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";

const out = "www";
const DAY = 864e5;

await rm(out, { recursive: true, force: true });
await build({ entryPoints: ["app/main.ts"], bundle: true, splitting: true, format: "esm", target: "es2022", minify: true, outdir: out, logLevel: "warning" });
for (const f of ["index.html", "demo.html", "help.html", "privacy.html", "accessibility.html", "app.css", "manifest.webmanifest"]) await cp(`app/${f}`, `${out}/${f}`);
await cp("style.css", `${out}/style.css`);
await cp("app/shots", `${out}/shots`, { recursive: true });
// The icons, from app/icon.svg (the source only; it embeds a large raster, so it is not shipped). Palette PNGs keep
// the shell small. The 180 is the apple-touch-icon: full bleed, since iOS rounds it itself and paints transparency black.
const icon = await readFile("app/icon.svg", "utf8");
const fullBleed = icon.replace(' rx="112"', "");
assert.notEqual(fullBleed, icon);
for (const [size, svg] of [[180, fullBleed], [192, icon], [512, icon]]) await sharp(Buffer.from(svg)).resize(size).png({ palette: true, effort: 10 }).toFile(`${out}/icon-${size}.png`);
await cp("data", `${out}/data`, { recursive: true });

// The data manifest: per area, its edition, the date it is current through, a revision that changes with any file,
// and its files for an offline copy.
// Through: the last day of the area's 28-day procedure cycle. Areas built before the cycle was recorded fall back to
// their chart edition, the earliest cycle they can be from.
const areas = {};
for (const id of (await readdir("data")).sort()) {
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
assert.deepEqual(Object.keys(areas), ["miami", "phoenix"]);
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
console.log(`www/: ${shell.length} shell files, areas ${Object.entries(areas).map(([id, a]) => `${id} ${a.edition} through ${a.through}`).join(", ")}`);

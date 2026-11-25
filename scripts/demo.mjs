// A static server for demo/index.html: the built dist/, the area data and three.js from node_modules.
// npm run build && npm run demo, then open http://localhost:5179/demo/ (or npm run app, then /www/)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".bin": "application/octet-stream", ".map": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const port = Number(process.env.PORT ?? 5179);

createServer(async (req, res) => {
  // A page on another site can rebind its name to 127.0.0.1; only requests addressed to this machine by name are served.
  if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(req.headers.host ?? "")) return res.writeHead(403).end();
  let path;
  try {
    path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    return res.writeHead(400).end();
  }
  if (path.endsWith("/")) path += "index.html"; // before normalize, which turns / into \ on Windows
  path = normalize(path);
  const file = join(root, path);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
// 127.0.0.1 only: this serves the whole checkout, .git included, so it must not be reachable from the network.
}).listen(port, "127.0.0.1", () => console.log(`skycake demo: http://localhost:${port}/demo/`));

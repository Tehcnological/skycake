// A static server for demo/index.html: the built dist/, the area data and three.js from node_modules.
// npm run build && npm run demo, then open http://localhost:5179/demo/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".bin": "application/octet-stream", ".map": "application/json" };
const port = Number(process.env.PORT ?? 5179);

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
  if (path.endsWith("/")) path += "index.html";
  const file = join(root, path);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`skycake demo: http://localhost:${port}/demo/`));

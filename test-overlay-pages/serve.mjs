// Tiny static server for the recorder repro page.
//   node test-overlay-pages/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 8177;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

createServer(async (req, res) => {
  let path = decodeURIComponent(req.url.split('?')[0]);
  if (path === '/') path = '/index.html';
  const file = join(dir, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`recorder repro at http://localhost:${port}/`));

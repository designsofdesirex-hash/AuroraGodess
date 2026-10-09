import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(projectRoot, 'dist');
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  let relative = pathname.replace(/^\/+/, '');
  if (!relative) relative = 'index.html';
  let file = resolve(root, relative);
  if (!file.startsWith(`${root}${sep}`) && file !== root) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
    const stat = statSync(file);
    if (!stat.isFile() || !file.startsWith(`${root}${sep}`)) throw new Error('Not a file');
    const extension = extname(file).toLowerCase();
    const headers = {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Cache-Control': ['.html', '.css', '.js', '.json'].includes(extension) ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    if (extension === '.mp4') headers['Accept-Ranges'] = 'bytes';
    if (extension === '.mp4' && request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      const suffixLength = match[1] ? 0 : Number(match[2]);
      const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - suffixLength);
      const end = match[2] && match[1] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) { response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      headers['Content-Length'] = end - start + 1;
      response.writeHead(206, headers);
      if (request.method === 'HEAD') response.end(); else createReadStream(file, { start, end }).pipe(response);
      return;
    }
    headers['Content-Length'] = stat.size;
    response.writeHead(200, headers);
    if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Aurora static preview: http://127.0.0.1:${port}`));

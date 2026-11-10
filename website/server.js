const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const PORT = process.env.PORT || 1724;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const ENQUIRIES = path.join(DATA_DIR, 'enquiries.jsonl');
const MAX_BODY = 20 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const PRIVATE_FILES = new Set(['server.js', 'readme.md', 'package.json', 'package-lock.json', 'ecosystem.config.js']);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function isPrivate(rel) {
  const parts = rel.toLowerCase().split(path.sep);
  if (parts.some(p => p.startsWith('.'))) return true;
  if (parts[0] === 'data') return true;
  return parts.length === 1 && PRIVATE_FILES.has(parts[0]);
}

function serveStatic(req, res, pathname) {
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.join(ROOT, pathname);
  const rel = path.relative(ROOT, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || isPrivate(rel)) return send(res, 404, 'Not found');

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const longCache = rel.split(path.sep)[0] === 'assets';
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': longCache ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file)
      .on('error', e => { console.error('Read error', file, e.message); res.destroy(); })
      .pipe(res);
  });
}

function field(data, key, max) {
  const v = Array.isArray(data[key]) ? data[key][0] : data[key];
  return String(v || '').trim().slice(0, max);
}

function handleEnquiry(req, res) {
  const chunks = [];
  let size = 0, tooLarge = false;
  req.on('data', c => {
    size += c.length;
    if (size > MAX_BODY) tooLarge = true;
    else chunks.push(c);
  });
  req.on('end', () => {
    if (tooLarge) return send(res, 413, 'Payload too large');
    const data = querystring.parse(Buffer.concat(chunks).toString('utf8'));
    if (field(data, 'company_website', 200)) return send(res, 200, 'OK');

    const entry = {
      time: new Date().toISOString(),
      ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(),
      name: field(data, 'name', 200),
      company: field(data, 'company', 200),
      email: field(data, 'email', 200),
      phone: field(data, 'phone', 50),
      requirement: field(data, 'requirement', 100),
      message: field(data, 'message', 5000)
    };
    if (!entry.name || !/^[^\s@]+@[^\s@]+$/.test(entry.email)) return send(res, 400, 'Name and a valid email are required');

    fs.mkdir(DATA_DIR, { recursive: true }, err => {
      if (err) { console.error('Could not create data dir', err); return send(res, 500, 'Server error'); }
      fs.appendFile(ENQUIRIES, JSON.stringify(entry) + '\n', err => {
        if (err) { console.error('Could not save enquiry', err); return send(res, 500, 'Server error'); }
        console.log(`Enquiry from ${entry.name} <${entry.email}>`);
        send(res, 200, 'OK');
      });
    });
  });
  req.on('error', e => console.error('Request error', e.message));
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (pathname.includes('\0')) return send(res, 400, 'Bad request');

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  if (req.method === 'POST' && pathname === '/') return handleEnquiry(req, res);
  send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD, POST' });
});

server.on('error', err => {
  console.error('Server error:', err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => console.log(`Raunaq website listening on ${HOST}:${PORT}`));

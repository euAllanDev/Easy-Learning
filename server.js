const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { generateCoachResponse } = require('./groq-provider.js');

const send = (response, status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((request, response) => {
  if (request.method === 'GET') {
    const pathname = request.url === '/' ? '/index.html' : new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(__dirname, `.${pathname}`);
    if (!file.startsWith(`${__dirname}${path.sep}`)) return send(response, 403, { error: 'Forbidden' });
    return fs.readFile(file, (error, content) => {
      if (error) return send(response, 404, { error: 'Not found' });
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' }); response.end(content);
    });
  }
  if (request.method !== 'POST' || request.url !== '/api/ai/coach') return send(response, 404, { error: 'Not found' });
  let body = '';
  request.on('data', chunk => { body += chunk; if (body.length > 100000) request.destroy(); });
  request.on('end', async () => {
    try { const { context } = JSON.parse(body); if (!context || typeof context !== 'object') return send(response, 400, { error: 'Invalid context' }); const result = await generateCoachResponse(context); send(response, 200, result); }
    catch (error) { console.error('Study Coach request failed:', error.message); send(response, error.code === 'AI_UNAVAILABLE' ? 503 : 502, { error: 'Study Coach temporarily unavailable' }); }
  });
});
server.listen(process.env.PORT || 3000, () => console.log('Study Coach proxy listening.'));

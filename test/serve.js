const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(p);
    const m = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': m }); res.end(d);
  });
}).listen(9475, () => console.log('serving', ROOT));

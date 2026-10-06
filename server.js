import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const immutableAssetOptions = {
  etag: true,
  maxAge: '1y',
  immutable: true,
  dotfiles: 'deny',
  index: false,
};

const mutableAssetOptions = {
  etag: true,
  maxAge: '5m',
  dotfiles: 'deny',
  index: false,
};

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use('/assets', express.static(path.join(__dirname, 'assets'), immutableAssetOptions));
app.use('/portrait', express.static(path.join(__dirname, 'portrait'), mutableAssetOptions));
app.use('/music', express.static(path.join(__dirname, 'music'), mutableAssetOptions));

app.get(['/love-letter.json', '/metadata.json'], (req, res, next) => {
  const file = path.join(__dirname, req.path.slice(1));
  res.sendFile(file, { headers: { 'Cache-Control': 'no-cache' } }, (error) => {
    if (error) next(error);
  });
});

app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'index.html'), {
    headers: { 'Cache-Control': 'no-cache' },
  }, (error) => {
    if (error) next(error);
  });
});

// Keep client-side navigation working locally without exposing the whole repository.
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) {
    return res.status(404).type('text').send('Not found');
  }

  res.sendFile(path.join(__dirname, 'index.html'), {
    headers: { 'Cache-Control': 'no-cache' },
  }, (error) => {
    if (error) next(error);
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Request failed:', error);
  res.status(500).type('text').send('Internal server error');
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Local server listening on http://${HOST}:${PORT}`);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}; shutting down gracefully.`);
  server.close((error) => {
    if (error) {
      console.error('Shutdown failed:', error);
      process.exitCode = 1;
      return;
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

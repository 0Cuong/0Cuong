import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Disable HTTP caching for all responses to prevent stale bundle execution
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Serve static assets from root and subdirectories
app.use('/assets', express.static(path.join(__dirname, 'assets'), { etag: false, lastModified: false }));
app.use('/portrait', express.static(path.join(__dirname, 'portrait'), { etag: false, lastModified: false }));
app.use('/music', express.static(path.join(__dirname, 'music'), { etag: false, lastModified: false }));
app.use(express.static(__dirname, { etag: false, lastModified: false }));

// Single Page Application fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

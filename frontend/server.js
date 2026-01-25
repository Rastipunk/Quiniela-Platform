import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const DIST_PATH = join(__dirname, 'dist');
const INDEX_PATH = join(DIST_PATH, 'index.html');

// Startup checks - v2
console.log('=== Frontend Server Starting v2 ===');
console.log(`Working directory: ${__dirname}`);
console.log(`Dist path: ${DIST_PATH}`);
console.log(`Dist exists: ${existsSync(DIST_PATH)}`);
console.log(`Index.html exists: ${existsSync(INDEX_PATH)}`);

if (!existsSync(DIST_PATH)) {
  console.error('ERROR: dist folder does not exist! Build may have failed.');
}
if (!existsSync(INDEX_PATH)) {
  console.error('ERROR: dist/index.html does not exist! Build may have failed.');
}

// Serve static files from dist
app.use(express.static(DIST_PATH));

// SPA fallback - serve index.html for all non-file routes
app.get('*', (req, res) => {
  console.log(`[SPA Fallback] ${req.method} ${req.path}`);

  if (!existsSync(INDEX_PATH)) {
    return res.status(500).send(`
      <h1>Build Error</h1>
      <p>The dist/index.html file was not found.</p>
      <p>This usually means the build step failed.</p>
      <p>Check the Railway build logs for errors.</p>
    `);
  }

  res.sendFile(INDEX_PATH, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send('Error loading application');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend running on http://0.0.0.0:${PORT}`);
  console.log('=== Server Ready ===');
});

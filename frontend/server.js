import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all routes
// Express 5.x requires '/{*path}' syntax for catch-all routes
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend running on http://localhost:${PORT}`);
});

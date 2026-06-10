import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const STATE_FILE = join(DATA_DIR, 'state.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function readState() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.error('[state] read error:', e.message);
  }
  return {};
}

function writeState(data) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[state] write error:', e.message);
  }
}

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/state', (_req, res) => {
  res.json(readState());
});

app.post('/api/state', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'invalid body' });
  }
  writeState(req.body);
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(__dirname));

app.get('/', (_req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GW-SF URL Tool: http://localhost:${PORT}`);
});

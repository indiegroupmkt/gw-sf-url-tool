import express from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const STATE_FILE = join(DATA_DIR, 'state.json');
const BACKUP_DIR = join(DATA_DIR, 'backups');
const MAX_BACKUPS = 50;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

function readState() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.error('[state] read error:', e.message);
  }
  return {};
}

// Number of entries that carry actual work (a non-default status or a filled
// link), used to detect a client sending a blanked-out/reset state.
function filledCount(data) {
  return Object.values(data).filter(v =>
    v && ((v.status && v.status !== 'todo') || v.docLink || v.justineDoc)
  ).length;
}

function backupState() {
  if (!existsSync(STATE_FILE)) return;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(BACKUP_DIR, `state-${stamp}.json`), readFileSync(STATE_FILE), 'utf8');
    const files = readdirSync(BACKUP_DIR).filter(f => f.startsWith('state-')).sort();
    for (const f of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
      unlinkSync(join(BACKUP_DIR, f));
    }
  } catch (e) {
    console.error('[backup] error:', e.message);
  }
}

function writeState(data) {
  try {
    backupState();
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

  const current = readState();
  const currentFilled = filledCount(current);
  const incomingFilled = filledCount(req.body);

  // Guard against a client wiping meaningful progress (e.g. after a failed
  // load on its end). Require ?force=true to push through a big drop anyway.
  if (currentFilled >= 5 && incomingFilled === 0 && req.query.force !== 'true') {
    console.error(`[state] rejected write: would drop ${currentFilled} filled entries to 0`);
    return res.status(409).json({
      error: `refusing to overwrite ${currentFilled} filled entries with an empty state. Pass ?force=true to override.`,
      currentFilled,
    });
  }

  writeState(req.body);
  res.json({ ok: true });
});

app.get('/api/state/backups', (_req, res) => {
  try {
    const files = readdirSync(BACKUP_DIR).filter(f => f.startsWith('state-')).sort().reverse();
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/state/backups/:file', (req, res) => {
  const file = req.params.file;
  if (!/^state-[\w-]+\.json$/.test(file)) return res.status(400).json({ error: 'invalid filename' });
  const path = join(BACKUP_DIR, file);
  if (!existsSync(path)) return res.status(404).json({ error: 'not found' });
  res.json(JSON.parse(readFileSync(path, 'utf8')));
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

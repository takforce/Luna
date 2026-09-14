const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'luna.db');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// ── DB ──
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,              -- 'io' | 'luna'
  text TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ── Contenuti moduli (JSON statico, facile da modificare) ──
const modules = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'modules.json'), 'utf-8'));

// ── Middleware ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// ── API: Chat ──
app.get('/api/chat/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM chat_messages ORDER BY id ASC').all();
  res.json(rows);
});

app.post('/api/chat/messages', upload.single('attachment'), (req, res) => {
  const { sender, text } = req.body;
  if (!sender || (!text && !req.file)) {
    return res.status(400).json({ error: 'sender e (text o allegato) richiesti' });
  }
  const attachment_path = req.file ? '/uploads/' + req.file.filename : null;
  const attachment_name = req.file ? req.file.originalname : null;
  const attachment_type = req.file ? req.file.mimetype : null;

  const info = db.prepare(`
    INSERT INTO chat_messages (sender, text, attachment_path, attachment_name, attachment_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(sender, text || null, attachment_path, attachment_name, attachment_type);

  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  res.json(row);
});

app.delete('/api/chat/messages/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id);
  if (row && row.attachment_path) {
    const filePath = path.join(__dirname, 'public', row.attachment_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: Moduli ed esercizi ──
app.get('/api/modules', (req, res) => {
  const summary = modules.map(m => ({
    id: m.id, title: m.title, subtitle: m.subtitle, icon: m.icon,
    category: m.category || 'vocab',
    exerciseCount: m.exercises.length
  }));
  res.json(summary);
});

app.get('/api/modules/:id', (req, res) => {
  const m = modules.find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'modulo non trovato' });
  res.json(m);
});

// ── API: Progressi ──
app.post('/api/progress', (req, res) => {
  const { module_id, exercise_id, item_id, correct } = req.body;
  if (!module_id || !exercise_id || !item_id === undefined) {
    return res.status(400).json({ error: 'dati mancanti' });
  }
  db.prepare(`
    INSERT INTO exercise_results (module_id, exercise_id, item_id, correct)
    VALUES (?, ?, ?, ?)
  `).run(module_id, exercise_id, item_id, correct ? 1 : 0);
  res.json({ ok: true });
});

app.get('/api/progress/summary', (req, res) => {
  const rows = db.prepare(`
    SELECT module_id,
           COUNT(*) as tentativi,
           SUM(correct) as corretti
    FROM exercise_results
    GROUP BY module_id
  `).all();
  res.json(rows);
});

// Reset progressi di un singolo modulo
app.delete('/api/progress/:moduleId', (req, res) => {
  db.prepare('DELETE FROM exercise_results WHERE module_id = ?').run(req.params.moduleId);
  res.json({ ok: true });
});

// Reset di tutti i progressi
app.delete('/api/progress', (req, res) => {
  db.prepare('DELETE FROM exercise_results').run();
  res.json({ ok: true });
});

// Traduzione inglese -> italiano (per la pagina Liste), tramite MyMemory (gratuito)
app.get('/api/translate', async (req, res) => {
  const text = (req.query.text || '').trim();
  if (!text) return res.status(400).json({ error: 'testo mancante' });
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|it';
    const r = await fetch(url);
    const data = await r.json();
    const translated = data?.responseData?.translatedText || '';
    res.json({ original: text, translated });
  } catch (e) {
    res.status(500).json({ error: 'traduzione non disponibile' });
  }
});

app.listen(PORT, () => {
  console.log(`Luna Italiano in ascolto su porta ${PORT}`);
});

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Database = require('better-sqlite3');
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCfICr47eV88GBQSqPXyreRiFHgI5d2ZhFkXzX9EIWxvDCmD9Nux6FTEZ7QtTVkZSzVK8UyNlRwneQfA99y3dpE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '_7VFuXY3LPVejqL--Y62zlzWFoOBCuE9TbhrJU491Z8';
webpush.setVapidDetails('mailto:luna-italiano@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,               -- 'io' | 'luna'
  endpoint TEXT NOT NULL UNIQUE,
  subscription TEXT NOT NULL,        -- JSON completo della subscription
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO banner (id, message) VALUES (1, '');
`);
// Ripulisce il vecchio messaggio di default impostato per errore in una versione precedente
db.prepare("UPDATE banner SET message = '' WHERE message = 'Ti amo Luna! 💛'").run();

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

  // Notifica push a chi non ha scritto il messaggio
  notifyNewMessage(row).catch(() => {});
});

async function notifyNewMessage(row) {
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE owner != ?').all(row.sender);
  const title = row.sender === 'io' ? 'New message from Ivano' : 'New message from Luna';
  const body = row.text ? row.text.slice(0, 120) : '📎 Sent an attachment';
  for (const s of subs) {
    try {
      const subscription = JSON.parse(s.subscription);
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(s.id);
      }
    }
  }
}

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

// ── Notifiche push ──
app.get('/api/push/vapid-public-key', (req, res) => {
  res.type('text/plain').send(VAPID_PUBLIC_KEY);
});

app.post('/api/push/subscribe', (req, res) => {
  const { owner, subscription } = req.body;
  if (!owner || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'dati mancanti' });
  }
  db.prepare(`
    INSERT INTO push_subscriptions (owner, endpoint, subscription)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET owner = excluded.owner, subscription = excluded.subscription
  `).run(owner, subscription.endpoint, JSON.stringify(subscription));
  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

// ── Messaggio dello striscione trainato dall'aereo in home ──
app.get('/api/banner', (req, res) => {
  const row = db.prepare('SELECT message FROM banner WHERE id = 1').get();
  res.json({ message: row ? row.message : '' });
});

app.post('/api/banner', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'messaggio mancante' });
  const trimmed = message.trim().slice(0, 60);
  db.prepare('UPDATE banner SET message = ? WHERE id = 1').run(trimmed);
  res.json({ message: trimmed });
});

// ── Anteprima link (per la chat) ──
const linkPreviewCache = new Map(); // url -> { data, ts }
const LINK_CACHE_TTL = 1000 * 60 * 60 * 12; // 12 ore

app.get('/api/link-preview', async (req, res) => {
  const url = req.query.url || '';
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'url non valido' });

  const cached = linkPreviewCache.get(url);
  if (cached && (Date.now() - cached.ts) < LINK_CACHE_TTL) {
    return res.json(cached.data);
  }

  // YouTube: usa l'endpoint oEmbed ufficiale, molto più affidabile dello scraping
  // (la pagina normale spesso mostra un banner di consenso cookie invece del video)
  const isYouTube = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(new URL(url).hostname);
  if (isYouTube) {
    try {
      const oembedUrl = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json';
      const r = await fetch(oembedUrl);
      if (r.ok) {
        const yt = await r.json();
        const data = {
          url,
          title: yt.title || url,
          description: yt.author_name ? 'by ' + yt.author_name : '',
          image: yt.thumbnail_url || null,
          siteName: 'YouTube'
        };
        linkPreviewCache.set(url, { data, ts: Date.now() });
        return res.json(data);
      }
    } catch (e) { /* fallback allo scraping generico sotto */ }
  }

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LunaItalianoBot/1.0)' },
      redirect: 'follow'
    });
    const html = (await r.text()).slice(0, 300000); // limite di sicurezza

    const meta = (prop) => {
      const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']*)["\']', 'i');
      const m1 = html.match(re);
      if (m1) return m1[1];
      const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop + '["\']', 'i');
      const m2 = html.match(re2);
      return m2 ? m2[1] : null;
    };
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);

    const data = {
      url,
      title: meta('og:title') || (titleTag ? titleTag[1].trim() : url),
      description: meta('og:description') || meta('description') || '',
      image: meta('og:image') || null,
      siteName: meta('og:site_name') || new URL(url).hostname
    };
    linkPreviewCache.set(url, { data, ts: Date.now() });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'anteprima non disponibile' });
  }
});

app.listen(PORT, () => {
  console.log(`Luna Italiano in ascolto su porta ${PORT}`);
});

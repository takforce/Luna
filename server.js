const express = require('express');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const multer = require('multer');
const Database = require('better-sqlite3');
const webpush = require('web-push');
const { EdgeTTS } = require('node-edge-tts');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BCfICr47eV88GBQSqPXyreRiFHgI5d2ZhFkXzX9EIWxvDCmD9Nux6FTEZ7QtTVkZSzVK8UyNlRwneQfA99y3dpE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '_7VFuXY3LPVejqL--Y62zlzWFoOBCuE9TbhrJU491Z8';
webpush.setVapidDetails('mailto:luna-italiano@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'luna.db');
const DB_DIR = path.dirname(DB_PATH);
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Su Railway il Volume persistente a volte non e' ancora montato nell'istante esatto
// in cui il server parte: se lo tocco subito e fallisce, aspetto un attimo e riprovo,
// invece di far crashare tutto il processo (sia le sessioni che il database vivono li').
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function ensureDirWithRetry(dir, maxAttempts = 6, delayMs = 1000) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return;
    } catch (err) {
      lastErr = err;
      console.log(`⚠️  Tentativo ${attempt}/${maxAttempts} di preparare ${dir} fallito (${err.message}). Riprovo tra ${delayMs}ms...`);
      if (attempt < maxAttempts) sleepSync(delayMs);
    }
  }
  throw lastErr;
}
ensureDirWithRetry(DB_DIR);
ensureDirWithRetry(path.join(DB_DIR, 'sessions'));

// ── Accesso segreto: 4 tap veloci + password, solo per Io/Luna ──
app.set('trust proxy', 1); // necessario su Railway perche' i cookie 'secure' funzionino dietro il proxy HTTPS

let PASSWORD_ACCESSO = process.env.PASSWORD_ACCESSO;
if (!PASSWORD_ACCESSO) {
  PASSWORD_ACCESSO = crypto.randomBytes(6).toString('hex');
  console.log('⚠️  PASSWORD_ACCESSO non impostata su Railway. Password generata per questo avvio: ' + PASSWORD_ACCESSO);
  console.log('   Impostala come variabile d\'ambiente su Railway per renderla permanente e scegliere la tua.');
}
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.log('⚠️  SESSION_SECRET non impostato: generato casualmente (le sessioni non sopravvivono a un riavvio finche\' non lo imposti su Railway).');
}

const TEMPO_MASSIMO_SEQUENZA = 1500; // ms per completare i 4 tap
const MAX_TENTATIVI = 5;
const BLOCCO_MINUTI = 15;

app.use(session({
  store: new FileStore({
    path: path.join(path.dirname(DB_PATH), 'sessions'),
    logFn: () => {}, // niente log rumorosi in console
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 giorni
  }
}));
app.use(express.urlencoded({ extended: true }));

const GATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Luna Italiano</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/css/theme.css">
<style>
  body { display:flex; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; }
  #touch-zone { position:fixed; inset:0; z-index:5; -webkit-tap-highlight-color: transparent; }
  #gate-message {
    position:relative; z-index:2; padding:0 30px; font-family:'Quicksand',sans-serif;
    color: var(--muted); font-size:15px; max-width:340px; line-height:1.6;
  }
  #gate-message .gate-title {
    display:block; color: var(--text); font-size:22px; font-weight:700;
    font-family:'Baloo 2',sans-serif; margin-bottom:8px; line-height:1.4;
  }
  #gate-mask {
    display:block; width:140px; height:auto; margin:0 auto 18px; opacity:0.75;
  }
  #box-password {
    display:none; position:relative; z-index:6;
    background: var(--card-bg); border:1px solid var(--card-border); border-radius: var(--radius);
    padding: 30px 26px; max-width:280px; text-align:center; backdrop-filter: blur(8px);
  }
  #box-password h3 { font-family:'Baloo 2',sans-serif; margin-bottom:16px; color:var(--text); font-size:18px; }
  #box-password input {
    padding:12px 14px; font-size:16px; border:1px solid var(--card-border); border-radius:12px;
    outline:none; margin-bottom:14px; width:100%; box-sizing:border-box;
    background: rgba(255,255,255,0.08); color:var(--text); font-family:'Quicksand',sans-serif;
  }
  #box-password button {
    padding:12px 24px; font-size:15px; font-weight:700;
    background: linear-gradient(135deg, var(--gold), #f0a93a); color:#2a1c00;
    border:none; border-radius:26px; cursor:pointer; width:100%;
    font-family:'Quicksand',sans-serif;
  }
  #gate-error { color:#e65a5a; font-size:13px; margin-top:-6px; margin-bottom:10px; min-height:16px; }
</style>
</head>
<body>
  <div id="touch-zone"></div>
  <div id="gate-message">
    <img id="gate-mask" src="/img/icons/scary-mask.png" alt="">
    <span class="gate-title">Unless you're Luna,<br>get lost.</span>
    Nobody wants you here. 🌙
  </div>
  <div id="box-password">
    <h3>🌙 Enter password</h3>
    <div id="gate-error">__ERROR__</div>
    <form action="/login" method="POST">
      <input type="password" name="password" placeholder="••••••••" required autofocus>
      <button type="submit">Unlock</button>
    </form>
  </div>
  <script src="/js/starfield.js"></script>
  <script>
    const zone = document.getElementById('touch-zone');
    async function registraTap(e) {
      if (e.type === 'touchstart') e.preventDefault();
      try {
        const response = await fetch('/registra-tap', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await response.json();
        if (data.success) {
          zone.style.display = 'none';
          document.getElementById('gate-message').style.display = 'none';
          document.getElementById('box-password').style.display = 'block';
        }
      } catch (err) {}
    }
    zone.addEventListener('touchstart', registraTap, { passive: false });
    zone.addEventListener('mousedown', (e) => { if (e.detail === 0) return; registraTap(e); });
  </script>
</body>
</html>`;

app.get('/', (req, res, next) => {
  if (req.session && req.session.autenticato) return next(); // passa allo static, servira' index.html
  req.session.taps = 0;
  req.session.primoTapTime = 0;
  const errorMsg = req.session.gateError ? 'Wrong password. Try again.' : '';
  req.session.gateError = false;
  res.send(GATE_HTML.replace('__ERROR__', errorMsg));
});

app.post('/registra-tap', (req, res) => {
  const adesso = Date.now();
  if (!req.session.taps || req.session.taps === 0 || (adesso - req.session.primoTapTime > TEMPO_MASSIMO_SEQUENZA)) {
    req.session.taps = 1;
    req.session.primoTapTime = adesso;
  } else {
    req.session.taps += 1;
  }
  if (req.session.taps === 4 && (adesso - req.session.primoTapTime <= TEMPO_MASSIMO_SEQUENZA)) {
    req.session.sequenzaSuperata = true;
    req.session.taps = 0;
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (!req.session.sequenzaSuperata) return res.redirect('/');

  const now = Date.now();
  if (req.session.lockUntil && now < req.session.lockUntil) {
    req.session.sequenzaSuperata = false;
    return res.redirect('/');
  }

  if (password === PASSWORD_ACCESSO) {
    req.session.autenticato = true;
    req.session.sequenzaSuperata = false;
    req.session.tentativiFalliti = 0;
    return res.redirect('/');
  }

  req.session.tentativiFalliti = (req.session.tentativiFalliti || 0) + 1;
  if (req.session.tentativiFalliti >= MAX_TENTATIVI) {
    req.session.lockUntil = now + BLOCCO_MINUTI * 60 * 1000;
    req.session.tentativiFalliti = 0;
  }
  req.session.sequenzaSuperata = false;
  req.session.gateError = true;
  res.redirect('/');
});

// Da qui in poi, tutto (pagine statiche + API) richiede sessione autenticata,
// tranne le risorse condivise necessarie alla schermata del cancello.
const PUBLIC_GATE_ASSETS = ['/css/theme.css', '/js/starfield.js', '/favicon.svg', '/img/icons/scary-mask.png'];
const APP_PAGES = ['/', '/chat.html', '/moduli.html', '/esercizio.html', '/liste.html', '/review.html'];
app.use((req, res, next) => {
  if (req.session && req.session.autenticato) return next();
  if (PUBLIC_GATE_ASSETS.includes(req.path)) return next();
  if (req.method === 'GET' && APP_PAGES.includes(req.path)) {
    return res.redirect('/'); // sessione scaduta: torna al cancello invece di una pagina rotta
  }
  res.status(401).json({ error: 'Not authorized' });
});

function openDatabaseWithRetry(dbPath, maxAttempts = 3, delayMs = 500) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return new Database(dbPath);
    } catch (err) {
      lastErr = err;
      console.log(`⚠️  Tentativo ${attempt}/${maxAttempts} di apertura database fallito (${err.message}). Riprovo tra ${delayMs}ms...`);
      if (attempt < maxAttempts) sleepSync(delayMs);
    }
  }
  throw lastErr;
}

// ── DB ──
const db = openDatabaseWithRetry(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,              -- 'io' | 'luna'
  text TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  reply_to_id INTEGER,               -- id del messaggio a cui si risponde (o NULL)
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

CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT,                     -- 'io' | 'luna' (usato da /api/track-access)
  device TEXT,                    -- 'io' | 'luna' | 'unknown' (usato da /api/ping)
  page TEXT,                      -- quale pagina era aperta
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS read_status (
  device TEXT PRIMARY KEY,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  message TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO banner (id, message) VALUES (1, '');
`);
// Migrazione: access_log deve coprire sia il tracciamento per proprietario (owner),
// usato da /api/track-access, sia quello per dispositivo/pagina (device/page), usato
// da /api/ping — in precedenza le due funzionalità scrivevano sulla stessa tabella con
// schemi incompatibili, causando errori continui su /api/track-access. Ricostruisco la
// tabella con uno schema unico che copre entrambi i casi, senza perdere i dati raccolti.
const accessCols = db.prepare("PRAGMA table_info(access_log)").all().map(r => r.name);
if (!accessCols.includes('owner') || !accessCols.includes('device')) {
  db.exec(`CREATE TABLE access_log_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT,
    device TEXT,
    page TEXT,
    ts TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const oldCols = ['owner', 'device', 'page', 'ts'].filter(c => accessCols.includes(c));
  if (oldCols.length > 0) {
    db.exec(`INSERT INTO access_log_new (${oldCols.join(', ')}) SELECT ${oldCols.join(', ')} FROM access_log`);
  }
  db.exec('DROP TABLE access_log');
  db.exec('ALTER TABLE access_log_new RENAME TO access_log');
  console.log('♻️  Tabella access_log migrata: ora supporta sia owner che device/page, senza perdere dati.');
}

// Migrazione: aggiunge reply_to_id se il database esisteva già senza questa colonna
const chatCols = db.prepare("PRAGMA table_info(chat_messages)").all().map(c => c.name);
if (!chatCols.includes('reply_to_id')) {
  db.exec('ALTER TABLE chat_messages ADD COLUMN reply_to_id INTEGER');
}
if (!chatCols.includes('edited')) {
  db.exec('ALTER TABLE chat_messages ADD COLUMN edited INTEGER NOT NULL DEFAULT 0');
}

// Ripulisce il vecchio messaggio di default impostato per errore in una versione precedente
db.prepare("UPDATE banner SET message = '' WHERE message = 'Ti amo Luna! 💛'").run();

// ── Query preparate una sola volta all'avvio e riusate ad ogni richiesta ──
// (invece di richiamare db.prepare() dentro ogni handler: preparare uno statement
// crea un oggetto nativo lato SQLite che va poi ripulito da Node; farlo di continuo,
// ad ogni singola richiesta, è lo schema che più facilmente causa crash nativi di
// better-sqlite3 sotto carico prolungato — qui lo prepariamo una volta e lo riusiamo)
const stmt = {
  chat: {
    listAll: db.prepare('SELECT * FROM chat_messages ORDER BY id ASC'),
    insert: db.prepare(`
      INSERT INTO chat_messages (sender, text, attachment_path, attachment_name, attachment_type, reply_to_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    getById: db.prepare('SELECT * FROM chat_messages WHERE id = ?'),
    deleteById: db.prepare('DELETE FROM chat_messages WHERE id = ?'),
    updateText: db.prepare('UPDATE chat_messages SET text = ?, edited = 1 WHERE id = ?'),
  },
  read: {
    upsert: db.prepare(`
      INSERT INTO read_status (device, last_read_id) VALUES (?, ?)
      ON CONFLICT(device) DO UPDATE SET last_read_id = excluded.last_read_id, updated_at = datetime('now')
    `),
    getAll: db.prepare('SELECT device, last_read_id FROM read_status'),
  },
  push: {
    listOtherOwner: db.prepare('SELECT * FROM push_subscriptions WHERE owner != ?'),
    insertOrUpdate: db.prepare(`
      INSERT INTO push_subscriptions (owner, endpoint, subscription)
      VALUES (?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET owner = excluded.owner, subscription = excluded.subscription
    `),
    deleteById: db.prepare('DELETE FROM push_subscriptions WHERE id = ?'),
    deleteByEndpoint: db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?'),
  },
  progress: {
    insert: db.prepare(`
      INSERT INTO exercise_results (module_id, exercise_id, item_id, correct)
      VALUES (?, ?, ?, ?)
    `),
    summary: db.prepare(`
      SELECT module_id, COUNT(*) as tentativi, SUM(correct) as corretti
      FROM exercise_results
      GROUP BY module_id
    `),
    deleteByModule: db.prepare('DELETE FROM exercise_results WHERE module_id = ?'),
    deleteAll: db.prepare('DELETE FROM exercise_results'),
    resultsFor: db.prepare(`
      SELECT correct, created_at FROM exercise_results
      WHERE module_id = ? AND exercise_id = ? AND item_id = ?
      ORDER BY created_at ASC
    `),
  },
  access: {
    trackOwner: db.prepare('INSERT INTO access_log (owner) VALUES (?)'),
    logByOwner: db.prepare("SELECT owner, ts FROM access_log WHERE owner IS NOT NULL ORDER BY ts ASC"),
    ping: db.prepare('INSERT INTO access_log (device, page) VALUES (?, ?)'),
    statsRows: db.prepare('SELECT device, page, ts FROM access_log ORDER BY ts DESC LIMIT 2000'),
  },
  banner: {
    get: db.prepare('SELECT message FROM banner WHERE id = 1'),
    update: db.prepare('UPDATE banner SET message = ? WHERE id = 1'),
  },
};

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

const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,             // max 20 messaggi al minuto per sessione/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent — wait a moment and try again.' },
});

// ── API: Chat ──
app.get('/api/chat/messages', (req, res) => {
  const rows = stmt.chat.listAll.all();
  res.json(rows);
});

app.post('/api/chat/messages', messageRateLimiter, upload.single('attachment'), (req, res) => {
  const { sender, text, reply_to_id } = req.body;
  if (!sender || (!text && !req.file)) {
    return res.status(400).json({ error: 'sender e (text o allegato) richiesti' });
  }
  const attachment_path = req.file ? '/uploads/' + req.file.filename : null;
  const attachment_name = req.file ? req.file.originalname : null;
  const attachment_type = req.file ? req.file.mimetype : null;
  const replyToId = reply_to_id ? parseInt(reply_to_id, 10) : null;

  const info = stmt.chat.insert.run(sender, text || null, attachment_path, attachment_name, attachment_type, replyToId);

  const row = stmt.chat.getById.get(info.lastInsertRowid);
  res.json(row);

  // Notifica push a chi non ha scritto il messaggio
  notifyNewMessage(row).catch(() => {});
});

async function notifyNewMessage(row) {
  const subs = stmt.push.listOtherOwner.all(row.sender);
  const title = row.sender === 'io' ? 'New message from Ivano' : 'New message from Luna';
  const body = row.text ? row.text.slice(0, 120) : '📎 Sent an attachment';
  for (const s of subs) {
    try {
      const subscription = JSON.parse(s.subscription);
      await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        stmt.push.deleteById.run(s.id);
      }
    }
  }
}

app.delete('/api/chat/messages/:id', (req, res) => {
  const row = stmt.chat.getById.get(req.params.id);
  if (row && row.attachment_path) {
    const filePath = path.join(__dirname, 'public', row.attachment_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  stmt.chat.deleteById.run(req.params.id);
  res.json({ ok: true });
});

// Modifica testo di un messaggio esistente
app.patch('/api/chat/messages/:id', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'testo mancante' });
  stmt.chat.updateText.run(text.trim(), req.params.id);
  const row = stmt.chat.getById.get(req.params.id);
  res.json(row);
});

// Aggiorna stato di lettura (chiamato quando si apre la chat)
app.post('/api/chat/read', (req, res) => {
  const { device, last_read_id } = req.body;
  if (!device || !last_read_id) return res.status(400).json({ error: 'dati mancanti' });
  stmt.read.upsert.run(device, last_read_id);
  res.json({ ok: true });
});

// Stato di lettura di entrambi i device (per mostrare "Seen")
app.get('/api/chat/read-status', (req, res) => {
  const rows = stmt.read.getAll.all();
  const status = {};
  rows.forEach(r => { status[r.device] = r.last_read_id; });
  res.json(status);
});

// Logout — distrugge la sessione e rimanda al cancello
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
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
  if (!module_id || !exercise_id || item_id === undefined) {
    return res.status(400).json({ error: 'dati mancanti' });
  }
  stmt.progress.insert.run(module_id, exercise_id, item_id, correct ? 1 : 0);
  res.json({ ok: true });
});

app.get('/api/progress/summary', (req, res) => {
  const rows = stmt.progress.summary.all();
  res.json(rows);
});

// Reset progressi di un singolo modulo
app.delete('/api/progress/:moduleId', (req, res) => {
  stmt.progress.deleteByModule.run(req.params.moduleId);
  res.json({ ok: true });
});

// Reset di tutti i progressi
app.delete('/api/progress', (req, res) => {
  stmt.progress.deleteAll.run();
  res.json({ ok: true });
});

// Voce neurale italiana (Edge TTS, gratuito, nessuna chiave richiesta)
app.get('/api/speak', async (req, res) => {
  const text = (req.query.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'testo mancante' });
  const voice = req.query.voice === 'diego' ? 'it-IT-DiegoNeural' : 'it-IT-ElsaNeural';
  const tmpFile = path.join(os.tmpdir(), `tts-${crypto.randomUUID()}.mp3`);
  try {
    const tts = new EdgeTTS({ voice, lang: 'it-IT', outputFormat: 'audio-24khz-96kbitrate-mono-mp3', timeout: 12000 });
    await tts.ttsPromise(text, tmpFile);
    const audio = fs.readFileSync(tmpFile);
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
    res.send(audio);
  } catch (e) {
    console.error('Errore TTS:', e.message);
    res.status(500).json({ error: 'voce non disponibile' });
  } finally {
    fs.unlink(tmpFile, () => {});
  }
});

// ── Ripasso giornaliero (ripetizione dilazionata / SRS) ──
// Intervalli in giorni in base a quante volte di fila e' stata data la risposta giusta
const SRS_BOX_INTERVALS = [0, 1, 3, 7, 16, 30];

app.get('/api/review/due', (req, res) => {
  // Pesca da TUTTO il vocabolario gia' imparato (scelta multipla + abbinamento),
  // non da un set fisso di frasi: il pozzo cosi' non si esaurisce mai.
  const REVIEW_CATEGORIES = ['vocab', 'grammar', 'verbs'];
  const poolItems = [];
  modules.forEach(m => {
    if (!REVIEW_CATEGORIES.includes(m.category || 'vocab')) return;
    m.exercises.forEach(ex => {
      if (ex.type === 'scelta_multipla') {
        ex.items.forEach(item => {
          // Escludo domande o risposte ambigue con più significati (es. "to / at", falsi amici)
          if (item.answer.includes('/') || item.answer.includes('(')) return;
          if (item.prompt.includes('/') || item.prompt.includes('(')) return;
          poolItems.push({
            module_id: m.id, exercise_id: ex.id, item_id: item.id,
            sentence: `How do you say <b>"${item.prompt}"</b> in Italian?`,
            accepted: [item.answer]
          });
        });
      } else if (ex.type === 'abbinamento') {
        ex.pairs.forEach(pair => {
          if (pair.en.includes('/') || pair.en.includes('(')) return;
          if (pair.it.includes('/') || pair.it.includes('(')) return;
          poolItems.push({
            module_id: m.id, exercise_id: ex.id, item_id: pair.id,
            sentence: `How do you say <b>"${pair.en}"</b> in Italian?`,
            accepted: [pair.it]
          });
        });
      }
    });
  });

  const now = Date.now();
  const due = [];
  for (const ci of poolItems) {
    const rows = stmt.progress.resultsFor.all(ci.module_id, ci.exercise_id, ci.item_id);

    if (rows.length === 0) {
      due.push(ci); // mai provata prima, sempre da ripassare
      continue;
    }
    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].correct) streak++; else break;
    }
    const lastTime = new Date(rows[rows.length - 1].created_at + 'Z').getTime();
    const intervalDays = SRS_BOX_INTERVALS[Math.min(streak, SRS_BOX_INTERVALS.length - 1)];
    const dueTime = lastTime + intervalDays * 24 * 60 * 60 * 1000;
    if (now >= dueTime) due.push(ci);
  }

  due.sort(() => Math.random() - 0.5);
  res.json(due.slice(0, 20));
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
  stmt.push.insertOrUpdate.run(owner, subscription.endpoint, JSON.stringify(subscription));
  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) stmt.push.deleteByEndpoint.run(endpoint);
  res.json({ ok: true });
});

// ── Messaggio dello striscione trainato dall'aereo in home ──
// Videochiamata: stanza Jitsi con nome unico e non indovinabile, legato al segreto di sessione
const JITSI_ROOM = 'luna-italiano-' + crypto.createHash('sha256').update(SESSION_SECRET).digest('hex').slice(0, 20);
// ── Registro accessi (visibile solo dalla pagina nascosta) ──
app.post('/api/track-access', (req, res) => {
  const { owner } = req.body;
  if (owner !== 'io' && owner !== 'luna') return res.status(400).json({ error: 'owner non valido' });
  stmt.access.trackOwner.run(owner);
  res.json({ ok: true });
});

app.get('/api/access-log', (req, res) => {
  const rows = stmt.access.logByOwner.all();

  // raggruppa i "battiti" in sessioni: se passano piu' di 5 minuti senza segnali, e' una nuova sessione
  const GAP_MS = 5 * 60 * 1000;
  const sessions = [];
  let current = null;
  for (const row of rows) {
    const t = new Date(row.ts + 'Z').getTime();
    if (current && current.owner === row.owner && (t - current.lastTs) <= GAP_MS) {
      current.lastTs = t;
      current.pings++;
    } else {
      if (current) sessions.push(current);
      current = { owner: row.owner, firstTs: t, lastTs: t, pings: 1 };
    }
  }
  if (current) sessions.push(current);

  const result = sessions.map(s => ({
    owner: s.owner,
    start: new Date(s.firstTs).toISOString(),
    end: new Date(s.lastTs).toISOString(),
    minutes: Math.max(1, Math.round((s.lastTs - s.firstTs) / 60000)),
  })).reverse(); // piu' recenti prima

  res.json(result);
});

app.get('/api/video-room', (req, res) => {
  res.json({ url: `https://meet.jit.si/${JITSI_ROOM}`, room: JITSI_ROOM });
});

// ── Tracciamento accessi (silenzioso, solo lato server) ──
app.post('/api/ping', (req, res) => {
  const device = req.body.device || 'unknown';
  const page = req.body.page || '';
  stmt.access.ping.run(device, page);
  res.json({ ok: true });
});

// Pagina statistiche — URL fisso e segreto, non compare in nessun menu
const STATS_PATH = '/tak-private-stats-9f4e2a';

app.get(STATS_PATH, (req, res) => {
  if (!(req.session && req.session.autenticato)) return res.redirect('/');

  const rows = stmt.access.statsRows.all();

  // raggruppa in sessioni (gap > 10 min = nuova sessione)
  const GAP = 10 * 60 * 1000;
  const sessions = [];
  let cur = null;
  [...rows].reverse().forEach(r => {
    const t = new Date(r.ts + 'Z').getTime();
    if (!cur || r.device !== cur.device || t - cur.lastT > GAP) {
      cur = { device: r.device, start: t, lastT: t, pings: 1, page: r.page };
      sessions.push(cur);
    } else {
      cur.lastT = t;
      cur.pings++;
    }
  });

  // statistiche per device
  function statsFor(dev) {
    const s = sessions.filter(x => x.device === dev);
    const totalMin = s.reduce((a, x) => a + Math.round((x.lastT - x.start) / 60000), 0);
    const byDay = {};
    const byHour = new Array(24).fill(0);
    s.forEach(x => {
      const d = new Date(x.start).toISOString().slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
      byHour[new Date(x.start).getHours()]++;
    });
    return { sessions: s.length, totalMin, byDay, byHour };
  }

  const luna = statsFor('luna');
  const io   = statsFor('io');

  function barChart(arr) {
    const max = Math.max(...arr, 1);
    return arr.map((v, h) => {
      const pct = Math.round(v / max * 100);
      return `<div class="bar-wrap" title="${h}:00 — ${v} sessioni">
        <div class="bar" style="height:${pct}%"></div>
        <div class="bar-lbl">${h}</div>
      </div>`;
    }).join('');
  }

  function calHtml(byDay) {
    const days = Object.keys(byDay).sort().slice(-60);
    return days.map(d => {
      const v = byDay[d];
      const op = Math.min(0.2 + v * 0.2, 1).toFixed(2);
      return `<div class="cal-day" title="${d}: ${v} sessioni" style="background:rgba(89,214,148,${op})"></div>`;
    }).join('');
  }

  function recentList(dev) {
    return sessions.filter(x => x.device === dev).slice(-10).reverse().map(s => {
      const dt = new Date(s.start).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const dur = Math.round((s.lastT - s.start) / 60000);
      return `<li>${dt} — ${dur < 1 ? '<1' : dur} min${s.page ? ` <span class="pg">(${s.page})</span>` : ''}</li>`;
    }).join('');
  }

  res.send(`<!DOCTYPE html><html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stats</title>
<link rel="stylesheet" href="/css/theme.css">
<style>
  body{padding:0 0 80px;}
  .stats-wrap{max-width:640px;margin:0 auto;padding:20px 16px;}
  h2{font-size:18px;margin:24px 0 12px;}
  .kpi-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;}
  .kpi{background:var(--card-bg);border:1px solid var(--card-border);border-radius:14px;padding:14px 18px;flex:1;min-width:120px;text-align:center;}
  .kpi .val{font-size:28px;font-weight:800;font-family:'Baloo 2',sans-serif;color:var(--gold);}
  .kpi .lbl{font-size:11px;color:var(--muted);margin-top:2px;}
  .bar-chart{display:flex;align-items:flex-end;gap:3px;height:80px;margin:12px 0 4px;background:var(--card-bg);border-radius:10px;padding:8px 6px 0;}
  .bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;}
  .bar{width:100%;background:var(--gold);border-radius:3px 3px 0 0;min-height:2px;}
  .bar-lbl{font-size:8px;color:var(--muted);}
  .cal{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0;}
  .cal-day{width:18px;height:18px;border-radius:3px;background:rgba(89,214,148,0.1);border:1px solid var(--card-border);}
  ul.recent{list-style:none;padding:0;margin:8px 0;}
  ul.recent li{font-size:12px;padding:5px 0;border-bottom:1px solid var(--card-border);color:var(--muted);}
  .pg{opacity:.6;font-size:10px;}
  .dev-section{background:var(--card-bg);border:1px solid var(--card-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;}
</style>
</head>
<body>
<div class="app-content">
  <div class="stats-wrap">
    <h1 style="font-size:20px;margin-bottom:4px;">📊 Accessi App</h1>
    <p style="font-size:12px;color:var(--muted);margin-bottom:20px;">Ultimi 60 giorni · orari in ora italiana</p>

    <div class="dev-section">
      <h2>🌙 Luna</h2>
      <div class="kpi-row">
        <div class="kpi"><div class="val">${luna.sessions}</div><div class="lbl">sessioni totali</div></div>
        <div class="kpi"><div class="val">${luna.totalMin}</div><div class="lbl">minuti totali</div></div>
        <div class="kpi"><div class="val">${Object.keys(luna.byDay).length}</div><div class="lbl">giorni attivi</div></div>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 4px;">Orari preferiti</p>
      <div class="bar-chart">${barChart(luna.byHour)}</div>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 4px;">Giorni attivi (ultimi 60)</p>
      <div class="cal">${calHtml(luna.byDay)}</div>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 4px;">Sessioni recenti</p>
      <ul class="recent">${recentList('luna') || '<li style="opacity:.5">Nessun dato ancora</li>'}</ul>
    </div>

    <div class="dev-section">
      <h2>🌟 Tak</h2>
      <div class="kpi-row">
        <div class="kpi"><div class="val">${io.sessions}</div><div class="lbl">sessioni totali</div></div>
        <div class="kpi"><div class="val">${io.totalMin}</div><div class="lbl">minuti totali</div></div>
        <div class="kpi"><div class="val">${Object.keys(io.byDay).length}</div><div class="lbl">giorni attivi</div></div>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 4px;">Orari preferiti</p>
      <div class="bar-chart">${barChart(io.byHour)}</div>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 4px;">Giorni attivi (ultimi 60)</p>
      <div class="cal">${calHtml(io.byDay)}</div>
      <p style="font-size:12px;color:var(--muted);margin:10px 0 4px;">Sessioni recenti</p>
      <ul class="recent">${recentList('io') || '<li style="opacity:.5">Nessun dato ancora</li>'}</ul>
    </div>
  </div>
</div>
</body></html>`);
});

app.get('/api/banner', (req, res) => {
  const row = stmt.banner.get.get();
  res.json({ message: row ? row.message : '' });
});

app.post('/api/banner', (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'messaggio mancante' });
  const trimmed = message.trim().slice(0, 60);
  stmt.banner.update.run(trimmed);
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

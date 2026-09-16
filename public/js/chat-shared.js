// Funzioni condivise per il rendering dei messaggi chat (usate da chat.html e index.html)

const CHAT_URL_RE = /(https?:\/\/[^\s<]+)/g;

function chatLinkify(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped.replace(CHAT_URL_RE, url => `<a href="${url}" target="_blank" rel="noopener" class="chat-link">${url}</a>`);
}

const chatPreviewCache = new Map();

async function chatLoadLinkPreview(url, container) {
  if (chatPreviewCache.has(url)) {
    chatRenderPreviewCard(chatPreviewCache.get(url), container);
    return;
  }
  try {
    const data = await fetch('/api/link-preview?url=' + encodeURIComponent(url)).then(r => r.json());
    if (data.error) return;
    chatPreviewCache.set(url, data);
    chatRenderPreviewCard(data, container);
  } catch (e) {}
}

function chatRenderPreviewCard(data, container) {
  const card = document.createElement('a');
  card.href = data.url;
  card.target = '_blank';
  card.rel = 'noopener';
  card.className = 'link-preview-card';
  card.innerHTML = `
    ${data.image ? `<img class="lp-img" src="${data.image}" alt="">` : ''}
    <div class="lp-info">
      <div class="lp-title">${data.title || data.url}</div>
      ${data.description ? `<div class="lp-desc">${data.description.slice(0,100)}</div>` : ''}
      <div class="lp-site">${data.siteName || ''}</div>
    </div>
  `;
  container.appendChild(card);
}

// Combina emoji lunari + link cliccabili per il testo di un messaggio
function chatFormatText(text) {
  return replaceMoonShortcodes(chatLinkify(text));
}

// Aggancia il caricamento dell'anteprima link (se presente) a un elemento messaggio gia' nel DOM
function chatAttachPreview(text, container) {
  const urls = text.match(CHAT_URL_RE);
  if (urls && urls[0]) chatLoadLinkPreview(urls[0], container);
}

// ── Avviso "nuovo messaggio" (badge rosso su Chat, in ogni pagina) ──
async function checkUnreadChat() {
  try {
    const msgs = await fetch('/api/chat/messages').then(r => r.json());
    if (!msgs.length) return;
    const newestId = msgs[msgs.length - 1].id;
    const lastRead = parseInt(localStorage.getItem('luna_last_read_msg_id') || '0', 10);
    const unread = newestId > lastRead;
    document.querySelectorAll('.chat-badge').forEach(el => {
      el.style.display = unread ? 'block' : 'none';
    });
  } catch (e) {}
}

function markChatRead(latestId) {
  if (latestId) localStorage.setItem('luna_last_read_msg_id', String(latestId));
  document.querySelectorAll('.chat-badge').forEach(el => el.style.display = 'none');
}

// ── "Di chi è questo telefono?" — chiesto una sola volta, poi ricordato per sempre ──
function chatGetDeviceOwner() {
  return localStorage.getItem('luna_device_owner');
}

// Segnale silenzioso di attivita' (nessun contenuto, solo "questo dispositivo e' aperto ora")
(function trackAccess() {
  function ping() {
    const owner = localStorage.getItem('luna_device_owner');
    if (!owner) return;
    fetch('/api/track-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner })
    }).catch(() => {});
  }
  ping();
  setInterval(ping, 60000);
})();

function chatEnsureDeviceOwner(callback) {
  const existing = chatGetDeviceOwner();
  if (existing) { callback(existing); return; }

  const overlay = document.createElement('div');
  overlay.className = 'device-owner-overlay';
  overlay.innerHTML = `
    <div class="device-owner-box">
      <div style="font-size:34px; margin-bottom:6px;">🌙</div>
      <h3>Whose device is this?</h3>
      <p>So the app knows who's writing by default — you can still switch manually any time.</p>
      <div class="device-owner-btns">
        <button data-owner="io">🌟 Tak's</button>
        <button data-owner="luna">🌙 Luna's</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const owner = btn.dataset.owner;
      localStorage.setItem('luna_device_owner', owner);
      overlay.remove();
      callback(owner);
    });
  });
}

// ── Ping silenzioso per il tracciamento accessi ──
// Inviato automaticamente all'apertura di ogni pagina e poi ogni 2 minuti finché resta aperta.
function startAccessTracking() {
  const device = localStorage.getItem('luna_device_owner') || 'unknown';
  const page = location.pathname.replace('/', '').replace('.html', '') || 'home';

  function sendPing() {
    fetch('/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, page })
    }).catch(() => {});
  }

  sendPing();
  setInterval(sendPing, 2 * 60 * 1000); // ogni 2 minuti finché la pagina è aperta
}
document.addEventListener('DOMContentLoaded', startAccessTracking);

// ── Tasto Exit nel bottom-nav (tutte le pagine) ──
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('bn-exit-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to exit and lock the app?')) return;
    await fetch('/logout', { method: 'POST' });
    location.href = '/';
  });
});

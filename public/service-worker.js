self.addEventListener('push', event => {
  let data = { title: 'Luna Italiano', body: 'New message' };
  try { data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Luna Italiano', {
      body: data.body || '',
      tag: 'luna-chat',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('/chat.html') && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/chat.html');
    })
  );
});

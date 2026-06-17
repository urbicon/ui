/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

export function handlePushEvent(event: PushEvent): void {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title ?? 'Notification';
    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon,
      tag: data.tag ?? data.typeKey,
      data: { url: data.url }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Invalid push data
  }
}

export function handleNotificationClick(event: NotificationEvent): void {
  event.notification.close();

  const rawUrl = event.notification.data?.url;
  if (!rawUrl) return;

  // Resolve and schema-check the target before navigating. The payload is
  // VAPID-signed + encrypted, so this is defense-in-depth: even if a malformed
  // payload (or a future bug in the server's notification.url handling) slips a
  // `javascript:`/`data:` URL through, `client.navigate()` would execute it in
  // the page's origin. Only same-scheme http(s) URLs are allowed through.
  let target: URL;
  try {
    target = new URL(rawUrl, self.location.origin);
  } catch {
    return; // unparseable URL → ignore
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing same-origin window if one is open. Compare parsed
      // origins, not substring — `client.url.includes(origin)` would also match
      // `https://app.example.com.evil.test/`.
      for (const client of clients) {
        let clientOrigin: string;
        try {
          clientOrigin = new URL(client.url).origin;
        } catch {
          continue;
        }
        if (clientOrigin === target.origin && 'focus' in client) {
          client.focus();
          client.navigate(target.href);
          return;
        }
      }
      // Open a new window otherwise.
      return self.clients.openWindow(target.href);
    })
  );
}

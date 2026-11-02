self.addEventListener("push", (event) => {
  const payload = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(payload.title || "NXTDox Messenger", {
    body: payload.body || "You have a new message.",
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    tag: "nxtdox-messenger",
    renotify: true,
    data: { url: payload.url || "/messenger" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/messenger", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.navigate(target);
      return existing.focus();
    }
    return clients.openWindow(target);
  }));
});
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(self.registration.showNotification(data.title || "Encomendas", {
    body: data.body,
    icon: "/app-icon.svg",
    badge: "/app-icon.svg",
    tag: data.tag || "encomendas-kitchen",
    renotify: true,
    vibrate: [200, 100, 200, 100, 400],
    data: { url: data.url || "/cozinha" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => "focus" in client);
    return existing ? existing.focus() : self.clients.openWindow(event.notification.data?.url || "/cozinha");
  }));
});

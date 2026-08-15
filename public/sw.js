const ICON = "/icon.svg";

self.addEventListener("push", (event) => {
  let payload = { title: "Power's back!", body: "", url: "/" };
  try {
    const data = event.data ? event.data.json() : {};
    payload = { ...payload, ...data };
  } catch {
    // Malformed payload — fall back to defaults.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: ICON,
      badge: ICON,
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? "/"));
});

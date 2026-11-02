const DISMISSED_KEY = "walker.notifications.dismissed";

/** Whether the browser supports the Notifications API */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current permission state: "granted" | "denied" | "default" */
export function getPermission(): NotificationPermission | null {
  if (!notificationsSupported()) return null;
  return Notification.permission;
}

/** Request permission from the user. Returns the resulting permission. */
export async function requestPermission(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null;
  const result = await Notification.requestPermission();
  return result;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

export async function subscribeToPush(accessToken: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(subscription),
  });
  return response.ok;
}

/** Send a browser notification (no-op if not granted). */
export function sendNotification(
  title: string,
  options?: NotificationOptions,
): Notification | null {
  if (!notificationsSupported()) return null;
  if (Notification.permission !== "granted") return null;
  return new Notification(title, {
    icon: "/walker-red-graphic-v2.png",
    ...options,
  });
}

/** Whether the user dismissed the permission prompt banner this session */
export function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark the permission prompt banner as dismissed for this session */
export function setDismissed(): void {
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // silent
  }
}

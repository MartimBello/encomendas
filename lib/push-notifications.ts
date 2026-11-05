export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPreparation =
  | { status: "ready"; subscription: PushSubscriptionPayload }
  | { status: "idle" | "denied" | "unsupported" | "error" };

type PushManagerLike = {
  getSubscription: () => Promise<PushSubscription | null>;
  subscribe: (options: PushSubscriptionOptionsInit) => Promise<PushSubscription>;
};

export type PushEnvironment = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  register: () => Promise<{ pushManager: PushManagerLike }>;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function browserPushEnvironment(): PushEnvironment | null {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  return {
    permission: Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    register: () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }),
  };
}

export async function preparePushSubscription(publicKey: string | undefined, askPermission: boolean, environment = browserPushEnvironment()): Promise<PushPreparation> {
  if (!publicKey || !environment) return { status: "unsupported" };

  try {
    let permission = environment.permission;
    if (permission === "default") {
      if (!askPermission) return { status: "idle" };
      permission = await environment.requestPermission();
    }
    if (permission !== "granted") return { status: "denied" };

    const registration = await environment.register();
    const subscription = await registration.pushManager.getSubscription()
      ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const serialized = subscription.toJSON();
    const p256dh = serialized.keys?.p256dh;
    const auth = serialized.keys?.auth;
    if (!subscription.endpoint || !p256dh || !auth) return { status: "error" };

    return { status: "ready", subscription: { endpoint: subscription.endpoint, keys: { p256dh, auth } } };
  } catch {
    return { status: "error" };
  }
}

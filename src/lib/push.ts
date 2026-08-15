import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

const STORAGE_PREFIX = "roshni:notify:";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "unconfigured" | "error"; message?: string };

export function getStoredSubscription(areaId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_PREFIX + areaId) === "1";
}

export function clearStoredSubscription(areaId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_PREFIX + areaId);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function subscribeToPush(areaId: string): Promise<PushSubscribeResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unsupported" };
  }
  if (!isSupabaseConfigured) {
    return { ok: false, reason: "unconfigured", message: "Supabase configured nahi hai." };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported", message: "Ye browser push notifications support nahi karta." };
  }
  if (!vapidPublicKey) {
    return { ok: false, reason: "unconfigured", message: "VAPID public key configured nahi hai." };
  }

  try {
    if (Notification.permission === "denied") {
      return {
        ok: false,
        reason: "denied",
        message: "Notifications blocked. Browser settings se allow karo.",
      };
    }
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return {
          ok: false,
          reason: "denied",
          message: "Notification permission allow nahi hui. Dobara try karo.",
        };
      }
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await getSupabase()
      .from("subscriptions")
      .insert({ area_id: areaId, push_subscription: subscription.toJSON() });

    localStorage.setItem(STORAGE_PREFIX + areaId, "1");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error", message: "Subscribe nahi hua — dobara try karo." };
  }
}

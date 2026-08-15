// notify-power-back — sends one-shot Web Push notifications when a report
// with status = 'power_back' is inserted for a subscribed area.
//
// Triggered either by the DB trigger (pg_net, `supabase/schema.sql`) which sends
// an `x-webhook-secret` header, or by a Dashboard Database Webhook which sends
// `Authorization: Bearer <service_role_key>`. Either is accepted.
//
// Secrets (set via `supabase secrets set`):
//   VAPID_PUBLIC_KEY   — VAPID public key (same as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY  — VAPID private key
//   WEBHOOK_SECRET     — value of `push_webhook_secret` in public.app_settings
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const webhookSecret = Deno.env.get("WEBHOOK_SECRET") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:admin@roshni.app", vapidPublicKey, vapidPrivateKey);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const hasValidAuth = authHeader === `Bearer ${serviceRoleKey}`;
  if (!hasValidAuth && req.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    const payload = await req.json();
    if (
      payload?.type !== "INSERT" ||
      payload?.table !== "reports" ||
      payload?.record?.status !== "power_back"
    ) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200, headers: corsHeaders });
    }

    const areaId: string | undefined = payload.record.area_id;
    if (!areaId) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200, headers: corsHeaders });
    }

    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id, push_subscription")
      .eq("area_id", areaId);
    if (error) throw error;

    const subscribers = subs ?? [];
    if (subscribers.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), { status: 200, headers: corsHeaders });
    }

    const areaName: string = payload.record.area ?? "your area";
    const message = JSON.stringify({
      title: "Power's back!",
      body: `Power wapas aa gaya in ${areaName}. 💡`,
      url: "/",
    });

    let notified = 0;
    for (const sub of subscribers) {
      try {
        await webpush.sendNotification(sub.push_subscription, message);
        notified += 1;
      } catch (e) {
        // Stale subscriptions (404/410) are expected; skip and clean up below.
        console.error("push failed:", e);
      }
    }

    // One-shot: clear subscriptions for this area now that they've been notified.
    const { error: delError } = await supabase
      .from("subscriptions")
      .delete()
      .eq("area_id", areaId);
    if (delError) console.error("subscription cleanup failed:", delError);

    return new Response(JSON.stringify({ notified }), { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

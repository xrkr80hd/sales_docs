import webPush, { type PushSubscription } from "web-push";

import { getSupabaseServiceClient } from "@/lib/supabase-server";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:xrkr80hd@gmail.com";

export async function sendMessengerPush(
  recipientIds: string[],
  payload: { title: string; body: string; url: string },
) {
  if (!publicKey || !privateKey || recipientIds.length === 0) return;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = getSupabaseServiceClient();
  const { data: rows } = await supabase
    .from("push_subscriptions")
    .select("endpoint,subscription")
    .in("user_id", recipientIds);

  await Promise.all((rows ?? []).map(async (row) => {
    try {
      await webPush.sendNotification(row.subscription as PushSubscription, JSON.stringify(payload));
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
      }
    }
  }));
}
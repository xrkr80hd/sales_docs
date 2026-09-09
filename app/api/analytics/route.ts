import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

const EVENT_TYPES = new Set(["card_view", "video_view", "vehicle_view", "call_click", "text_click", "email_click", "listing_click"]);

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function visitorHash(request: NextRequest, day: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const agent = request.headers.get("user-agent") || "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-24) || "nxtdocs";
  return createHash("sha256").update(`${day}|${ip}|${agent}|${salt}`).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { slug?: string; eventType?: string; itemId?: string };
    const slug = body.slug?.trim().toLowerCase() || "";
    const eventType = body.eventType || "";
    const itemId = body.itemId?.trim() || "";
    if (!slug || !EVENT_TYPES.has(eventType) || itemId.length > 160) {
      return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: card } = await supabase
      .from("consultant_cards")
      .select("id")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!card) return NextResponse.json({ ok: true });

    const day = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("consultant_analytics_events").upsert({
      card_id: card.id,
      event_type: eventType,
      item_id: itemId,
      visitor_hash: visitorHash(request, day),
      event_day: day,
    }, {
      onConflict: "card_id,event_type,item_id,visitor_hash,event_day",
      ignoreDuplicates: true,
    });

    if (error) {
      console.error("Analytics event could not be recorded", error.message);
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getSupabaseServiceClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const requestedSlug = request.nextUrl.searchParams.get("slug")?.trim().toLowerCase();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
    const isAdmin = profile?.role === "admin" || authData.user.email?.toLowerCase() === "xrkr80hd@gmail.com";

    let cardQuery = supabase.from("consultant_cards").select("id, slug, display_name");
    cardQuery = isAdmin && requestedSlug
      ? cardQuery.eq("slug", requestedSlug)
      : cardQuery.eq("user_id", authData.user.id);
    const { data: card } = await cardQuery.maybeSingle();
    if (!card) return NextResponse.json({ summary: {}, videos: [], daily: [] });

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 89);
    const { data: events, error } = await supabase
      .from("consultant_analytics_events")
      .select("event_type,item_id,event_day")
      .eq("card_id", card.id)
      .gte("event_day", since.toISOString().slice(0, 10))
      .limit(10000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const summary: Record<string, number> = {};
    const videoCounts = new Map<string, number>();
    const dailyCounts = new Map<string, number>();
    for (const event of events || []) {
      summary[event.event_type] = (summary[event.event_type] || 0) + 1;
      if (event.event_type === "video_view" && event.item_id) {
        videoCounts.set(event.item_id, (videoCounts.get(event.item_id) || 0) + 1);
      }
      if (event.event_type === "card_view") {
        dailyCounts.set(event.event_day, (dailyCounts.get(event.event_day) || 0) + 1);
      }
    }

    const { data: videos } = await supabase
      .from("consultant_videos")
      .select("id,title")
      .eq("card_id", card.id)
      .order("sort_order");

    return NextResponse.json({
      card: { slug: card.slug, displayName: card.display_name },
      summary,
      videos: (videos || []).map((video) => ({ id: video.id, title: video.title, views: videoCounts.get(video.id) || 0 })),
      daily: [...dailyCounts.entries()].map(([date, views]) => ({ date, views })).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch {
    return NextResponse.json({ error: "Analytics are unavailable." }, { status: 500 });
  }
}

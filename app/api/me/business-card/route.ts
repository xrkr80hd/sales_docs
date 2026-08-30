import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { normalizeProfileContent, travDefaultContent } from "@/lib/consultant-profile";

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "consultant";
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(bearer(request));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("display_name,role").eq("id", user.id).single(),
    supabase.from("user_settings").select("dealer_info,consultant_info").eq("user_id", user.id).maybeSingle(),
  ]);
  const consultantInfo = (settings?.consultant_info ?? {}) as Record<string, unknown>;
  const existingCard = consultantInfo.business_card as Record<string, unknown> | undefined;
  const isTrav = user.email?.toLowerCase() === "xrkr80hd@gmail.com";
  const displayName = profile?.display_name || String(consultantInfo.name || user.email?.split("@")[0] || "Consultant");
  const slug = String(existingCard?.slug || (isTrav ? "trav" : `${slugify(displayName)}-${user.id.slice(0, 6)}`));
  const base = normalizeProfileContent(existingCard?.draft ?? travDefaultContent);
  base.identity.displayName = existingCard ? base.identity.displayName : displayName;
  base.identity.email = existingCard ? base.identity.email : String(consultantInfo.email || user.email || "");
  base.identity.phone = existingCard ? base.identity.phone : String(consultantInfo.phone || "");

  const card = {
    slug,
    draft: base,
    published: existingCard?.published ?? null,
    publishedAt: existingCard?.publishedAt ?? null,
  };
  await supabase.from("user_settings").upsert({
    user_id: user.id,
    dealer_info: settings?.dealer_info ?? {},
    consultant_info: { ...consultantInfo, business_card: card },
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ card, role: profile?.role ?? "user" });
}

export async function PUT(request: NextRequest) {
  const supabase = getSupabaseServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(bearer(request));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { action?: string; draft?: unknown };
  const { data: settings } = await supabase.from("user_settings").select("dealer_info,consultant_info").eq("user_id", user.id).single();
  const consultantInfo = (settings?.consultant_info ?? {}) as Record<string, unknown>;
  const existing = (consultantInfo.business_card ?? {}) as Record<string, unknown>;
  const draft = normalizeProfileContent(body.draft ?? existing.draft ?? travDefaultContent);
  const now = new Date().toISOString();
  const card = {
    ...existing,
    draft,
    published: body.action === "publish" ? draft : body.action === "unpublish" ? null : existing.published ?? null,
    publishedAt: body.action === "publish" ? now : body.action === "unpublish" ? null : existing.publishedAt ?? null,
  };
  const { error: saveError } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    dealer_info: settings?.dealer_info ?? {},
    consultant_info: { ...consultantInfo, business_card: card },
    updated_at: now,
  });
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  return NextResponse.json({ card });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(bearer(request));
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "Files must be 100 MB or smaller." }, { status: 400 });

  const bucket = "consultant-media";
  const { error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"],
    });
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
  }
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}

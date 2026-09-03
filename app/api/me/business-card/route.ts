import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import {
  ConsultantProfileContent,
  emptyConsultantContent,
  normalizeProfileContent,
  travDefaultContent,
} from "@/lib/consultant-profile";

function bearer(request: NextRequest) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "consultant";
}

function ownedStorageObject(publicUrl: string, userId: string) {
  try {
    const url = new URL(publicUrl);
    const marker = "/storage/v1/object/public/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectParts = url.pathname.slice(markerIndex + marker.length).split("/").map(decodeURIComponent);
    const bucket = objectParts.shift();
    const path = objectParts.join("/");
    const expectedBucket = `consultant-media-${userId}`;
    if (bucket !== expectedBucket || !path.startsWith(`${userId}/vehicles/`)) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const isLocalDev = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
  const token = bearer(request);
  if (!token && !isLocalDev) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user = { id: "local-xrkr80hd", email: "xrkr80hd@gmail.com" };
  let supabase: ReturnType<typeof getSupabaseServiceClient> | null = null;

  try {
    supabase = getSupabaseServiceClient();
    if (!isLocalDev) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      user = { id: data.user.id, email: data.user.email || "" };
    }
  } catch {
    if (!isLocalDev) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const isTrav = user.email?.toLowerCase() === "xrkr80hd@gmail.com";

  if (!supabase) {
    const defaultContent = isTrav
      ? structuredClone(travDefaultContent)
      : emptyConsultantContent({ displayName: "Travis Wilkinson", email: user.email });
    return NextResponse.json({
      card: {
        slug: "trav",
        draft: defaultContent,
        published: defaultContent,
        publishedAt: new Date().toISOString(),
      },
      role: "admin",
      isAdmin: true,
      permitted: true,
    });
  }

  // Check profile role and card permission
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name, card_enabled")
    .eq("id", user.id)
    .single();

  const isDonaldGoff = user.email?.toLowerCase().includes("donald") || profile?.display_name?.toLowerCase().includes("donald") || user.id === "donald-goff";
  const isAdmin = profile?.role === "admin" || isTrav;
  const isPermitted = isAdmin || Boolean(profile?.card_enabled) || isDonaldGoff;

  if (!isPermitted) {
    return NextResponse.json({
      permitted: false,
      role: profile?.role ?? "user",
      isAdmin: false,
      error: "Card permission is required. Contact an administrator to enable your card.",
    });
  }

  // 1. Check if consultant_cards has a record
  const { data: cardRow } = await supabase
    .from("consultant_cards")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Consultant";
  const slug = cardRow?.slug || (isTrav ? "trav" : `${slugify(displayName)}-${user.id.slice(0, 6)}`);

  let draft: ConsultantProfileContent;

  if (cardRow) {
    const [
      { data: reviews },
      { data: vehicles },
      { data: videos },
      { data: soldGallery },
      { data: socialLinks },
    ] = await Promise.all([
      supabase.from("consultant_reviews").select("*").eq("card_id", cardRow.id).order("sort_order", { ascending: true }),
      supabase.from("consultant_vehicles").select("*").eq("card_id", cardRow.id).order("sort_order", { ascending: true }),
      supabase.from("consultant_videos").select("*").eq("card_id", cardRow.id).order("sort_order", { ascending: true }),
      supabase.from("consultant_sold_gallery").select("*").eq("card_id", cardRow.id).order("sort_order", { ascending: true }),
      supabase.from("consultant_social_links").select("*").eq("card_id", cardRow.id).order("sort_order", { ascending: true }),
    ]);

    draft = {
      identity: {
        displayName: cardRow.display_name,
        jobTitle: cardRow.job_title || "Sales Consultant",
        dealership: cardRow.dealership || "Walker Automotive",
        location: cardRow.location || "Alexandria, Louisiana",
        phone: cardRow.phone || "",
        email: cardRow.email || "",
        profileImageUrl: cardRow.profile_image_url || "",
        callingCardImageUrl: cardRow.calling_card_image_url || "",
        logoUrl: cardRow.logo_url || "/branding/nxtdox-by-eben.png",
        languageLabel: cardRow.language_label || "EN · ES",
      },
      content: {
        primaryPhrase: cardRow.primary_phrase || "",
        salesQuote: cardRow.sales_quote || "",
        bio: cardRow.bio || "",
        inventoryUrl: cardRow.inventory_url || "https://www.walkerautomotive.com/",
        inventoryButtonLabel: cardRow.inventory_button_label || "Browse Walker Inventory",
      },
      contact: {
        callLabel: cardRow.call_label || "Call",
        textLabel: cardRow.text_label || "Text",
        emailLabel: cardRow.email_label || "Email",
      },
      reviews: (reviews ?? []).map((r) => ({
        id: r.id,
        title: r.reviewer_name || "",
        description: "",
        url: "",
        imageUrl: r.image_url || "",
        meta: r.is_long ? "long" : undefined,
      })),
      vehicles: (vehicles ?? []).map((v) => ({
        id: v.id,
        title: v.title || "",
        description: v.description || "",
        url: v.url || "",
        imageUrl: v.image_url || "",
        secondaryUrl: v.vin || undefined,
        meta: [v.price, v.stock ? `Stock ${v.stock}` : ""].filter(Boolean).join(" · "),
        builderData: v.builder_data ?? undefined,
      })),
      videos: (videos ?? []).map((v) => ({
        id: v.id,
        title: v.title || "",
        description: v.description || "",
        url: v.video_url || "",
        imageUrl: v.video_url || "",
      })),
      soldGallery: (soldGallery ?? []).map((s) => ({
        id: s.id,
        title: s.title || "",
        description: s.description || "",
        url: "",
        imageUrl: s.image_url || "",
      })),
      socialLinks: (socialLinks ?? []).map((s) => ({
        id: s.id,
        title: s.title || "",
        description: "",
        url: s.url || "",
        imageUrl: "",
      })),
    };
  } else {
    // Check legacy user_settings draft
    const { data: settings } = await supabase
      .from("user_settings")
      .select("consultant_info")
      .eq("user_id", user.id)
      .maybeSingle();

    const consultantInfo = (settings?.consultant_info ?? {}) as Record<string, unknown>;
    const existingLegacy = consultantInfo.business_card as Record<string, unknown> | undefined;

    if (existingLegacy?.draft) {
      draft = normalizeProfileContent(existingLegacy.draft, isTrav);
    } else {
      draft = isTrav
        ? structuredClone(travDefaultContent)
        : emptyConsultantContent({ displayName, email: user.email || "" });
    }
  }

  const card = {
    slug,
    draft,
    published: cardRow?.is_published ? draft : null,
    publishedAt: cardRow?.published_at ?? null,
  };

  return NextResponse.json({
    card,
    role: profile?.role ?? "user",
    isAdmin,
    permitted: true,
  });
}

export async function PUT(request: NextRequest) {
  const isLocalDev = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
  const token = bearer(request);
  if (!token && !isLocalDev) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user = { id: "local-xrkr80hd", email: "xrkr80hd@gmail.com" };
  let supabase: ReturnType<typeof getSupabaseServiceClient> | null = null;

  try {
    supabase = getSupabaseServiceClient();
    if (!isLocalDev) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      user = { id: data.user.id, email: data.user.email || "" };
    }
  } catch {
    if (!isLocalDev) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const isTrav = user.email?.toLowerCase() === "xrkr80hd@gmail.com";
  let profile: { role: string; card_enabled: boolean; display_name: string } = {
    role: "admin",
    card_enabled: true,
    display_name: "Travis Wilkinson",
  };

  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("role, card_enabled, display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (data) profile = data as typeof profile;
  }

  const isDonaldGoff = user.email?.toLowerCase().includes("donald") || profile.display_name?.toLowerCase().includes("donald") || user.id === "donald-goff";
  const isAdmin = profile.role === "admin" || isTrav;
  if (!isAdmin && !profile.card_enabled && !isDonaldGoff) {
    return NextResponse.json({ error: "Card permission required." }, { status: 403 });
  }

  const body = (await request.json()) as { action?: string; draft?: Partial<ConsultantProfileContent> };
  const action = body.action || "draft";
  const incomingDraft = normalizeProfileContent(body.draft, isTrav);

  // Set limits
  // Reviews: max 10
  const limitedReviews = incomingDraft.reviews.slice(0, 10);
  // Walk-around videos: max 2
  const limitedVideos = incomingDraft.videos.slice(0, 2);
  incomingDraft.reviews = limitedReviews;
  incomingDraft.videos = limitedVideos;

  const displayName = incomingDraft.identity.displayName || profile.display_name || user.email?.split("@")[0] || "Consultant";
  const slug = isTrav ? "trav" : `${slugify(displayName)}-${user.id.slice(0, 6)}`;
  const now = new Date().toISOString();

  if (!supabase) {
    const isPublishAction = action === "publish";
    return NextResponse.json({
      card: {
        slug,
        draft: incomingDraft,
        published: isPublishAction ? incomingDraft : null,
        publishedAt: isPublishAction ? now : null,
      },
    });
  }

  // 1. Upsert into consultant_cards
  const isPublishAction = action === "publish";
  const isUnpublishAction = action === "unpublish";

  // Check existing card status
  const { data: existingCard } = await supabase
    .from("consultant_cards")
    .select("id, is_published, published_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: existingVehicles } = existingCard
    ? await supabase.from("consultant_vehicles").select("image_url").eq("card_id", existingCard.id)
    : { data: [] as { image_url: string | null }[] };

  const isPublished = isPublishAction ? true : isUnpublishAction ? false : (existingCard?.is_published ?? false);
  const publishedAt = isPublishAction ? now : isUnpublishAction ? null : existingCard?.published_at ?? null;

  const cardPayload = {
    user_id: user.id,
    slug,
    is_published: isPublished,
    published_at: publishedAt,
    display_name: incomingDraft.identity.displayName,
    job_title: incomingDraft.identity.jobTitle,
    dealership: incomingDraft.identity.dealership,
    location: incomingDraft.identity.location,
    phone: incomingDraft.identity.phone,
    email: incomingDraft.identity.email,
    profile_image_url: incomingDraft.identity.profileImageUrl,
    calling_card_image_url: incomingDraft.identity.callingCardImageUrl,
    logo_url: incomingDraft.identity.logoUrl,
    language_label: incomingDraft.identity.languageLabel,
    primary_phrase: incomingDraft.content.primaryPhrase,
    sales_quote: incomingDraft.content.salesQuote,
    bio: incomingDraft.content.bio,
    inventory_url: incomingDraft.content.inventoryUrl,
    inventory_button_label: incomingDraft.content.inventoryButtonLabel,
    call_label: incomingDraft.contact.callLabel,
    text_label: incomingDraft.contact.textLabel,
    email_label: incomingDraft.contact.emailLabel,
    updated_at: now,
  };

  const { data: savedCard, error: cardError } = await supabase
    .from("consultant_cards")
    .upsert(cardPayload, { onConflict: "user_id" })
    .select("id")
    .single();

  if (cardError || !savedCard) {
    return NextResponse.json({ error: cardError?.message || "Failed to save card" }, { status: 500 });
  }

  const cardId = savedCard.id;

  // 2. Save items (reviews, vehicles, videos, soldGallery, socialLinks)
  await Promise.all([
    supabase.from("consultant_reviews").delete().eq("card_id", cardId),
    supabase.from("consultant_vehicles").delete().eq("card_id", cardId),
    supabase.from("consultant_videos").delete().eq("card_id", cardId),
    supabase.from("consultant_sold_gallery").delete().eq("card_id", cardId),
    supabase.from("consultant_social_links").delete().eq("card_id", cardId),
  ]);

  const insertPromises = [];

  if (limitedReviews.length) {
    insertPromises.push(
      supabase.from("consultant_reviews").insert(
        limitedReviews.map((r, i) => ({
          card_id: cardId,
          reviewer_name: r.title,
          image_url: r.imageUrl,
          is_long: r.meta === "long",
          sort_order: i,
        }))
      )
    );
  }

  if (incomingDraft.vehicles.length) {
    insertPromises.push(
      supabase.from("consultant_vehicles").insert(
        incomingDraft.vehicles.map((v, i) => ({
          card_id: cardId,
          title: v.title,
          description: v.description,
          url: v.url,
          image_url: v.imageUrl,
          vin: v.secondaryUrl || "",
          stock: v.meta?.match(/Stock\s+([^·]+)/i)?.[1]?.trim() || "",
          price: v.meta?.split("·")[0]?.trim() || "",
          builder_data: v.builderData ?? null,
          sort_order: i,
        }))
      )
    );
  }

  if (limitedVideos.length) {
    insertPromises.push(
      supabase.from("consultant_videos").insert(
        limitedVideos.map((v, i) => ({
          card_id: cardId,
          title: v.title,
          description: v.description,
          video_url: v.url || v.imageUrl,
          sort_order: i,
        }))
      )
    );
  }

  if (incomingDraft.soldGallery.length) {
    insertPromises.push(
      supabase.from("consultant_sold_gallery").insert(
        incomingDraft.soldGallery.map((s, i) => ({
          card_id: cardId,
          title: s.title,
          description: s.description,
          image_url: s.imageUrl,
          sort_order: i,
        }))
      )
    );
  }

  if (incomingDraft.socialLinks.length) {
    insertPromises.push(
      supabase.from("consultant_social_links").insert(
        incomingDraft.socialLinks.map((s, i) => ({
          card_id: cardId,
          title: s.title,
          url: s.url,
          sort_order: i,
        }))
      )
    );
  }

  const insertResults = await Promise.all(insertPromises);
  const insertError = insertResults.find((result) => result.error)?.error;
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Permanently remove files that belonged to vehicle records the consultant removed.
  // URLs outside this user's private consultant bucket are never touched.
  const retainedImageUrls = new Set([
    ...incomingDraft.vehicles.map((vehicle) => vehicle.imageUrl),
    ...incomingDraft.vehicles.flatMap((vehicle) => vehicle.builderData?.photos.map((photo) => photo.url) ?? []),
    ...incomingDraft.reviews.map((review) => review.imageUrl),
    ...incomingDraft.soldGallery.map((photo) => photo.imageUrl),
    incomingDraft.identity.profileImageUrl,
    incomingDraft.identity.callingCardImageUrl,
    incomingDraft.identity.logoUrl,
  ].filter(Boolean));
  const removedObjects = (existingVehicles ?? [])
    .map((vehicle) => vehicle.image_url || "")
    .filter((imageUrl) => imageUrl && !retainedImageUrls.has(imageUrl))
    .map((imageUrl) => ownedStorageObject(imageUrl, user.id))
    .filter((object): object is { bucket: string; path: string } => Boolean(object));

  const removalsByBucket = new Map<string, string[]>();
  for (const object of removedObjects) {
    removalsByBucket.set(object.bucket, [...(removalsByBucket.get(object.bucket) ?? []), object.path]);
  }
  for (const [bucket, paths] of removalsByBucket) {
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error("Failed to remove deleted vehicle media", { userId: user.id, bucket, error: removeError.message });
    }
  }

  // Sync to user_settings for legacy backward compatibility
  const legacyCard = {
    slug,
    draft: incomingDraft,
    published: isPublished ? incomingDraft : null,
    publishedAt,
  };
  const { data: existingSettings } = await supabase
    .from("user_settings")
    .select("dealer_info, consultant_info")
    .eq("user_id", user.id)
    .maybeSingle();
  const existingConsultantInfo = existingSettings?.consultant_info && typeof existingSettings.consultant_info === "object"
    ? existingSettings.consultant_info as Record<string, unknown>
    : {};
  await supabase.from("user_settings").upsert({
    user_id: user.id,
    dealer_info: existingSettings?.dealer_info ?? {},
    consultant_info: { ...existingConsultantInfo, business_card: legacyCard },
    updated_at: now,
  });

  return NextResponse.json({ card: legacyCard });
}

export async function POST(request: NextRequest) {
  const isLocalDev = process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";
  const token = bearer(request);
  if (!token && !isLocalDev) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user = { id: "local-xrkr80hd", email: "xrkr80hd@gmail.com" };
  let supabase: ReturnType<typeof getSupabaseServiceClient> | null = null;

  try {
    supabase = getSupabaseServiceClient();
    if (!isLocalDev) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      user = { id: data.user.id, email: data.user.email || "" };
    }
  } catch {
    if (!isLocalDev) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const isTrav = user.email?.toLowerCase() === "xrkr80hd@gmail.com";
  let profile: { role: string; card_enabled: boolean; display_name?: string } = { role: "admin", card_enabled: true };

  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("role, card_enabled, display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (data) profile = data as typeof profile;
  }

  const isDonaldGoff = user.email?.toLowerCase().includes("donald") || profile.display_name?.toLowerCase().includes("donald") || user.id === "donald-goff";
  const isPermitted = profile.role === "admin" || isTrav || Boolean(profile.card_enabled) || isDonaldGoff;
  if (!isPermitted) return NextResponse.json({ error: "Card permission required." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const category = (form.get("category")?.toString() || "media").toLowerCase().replace(/[^a-z0-9_-]/g, "");

  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "Files must be 100 MB or smaller." }, { status: 400 });

  if (!supabase) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
    return NextResponse.json({
      url: dataUrl,
      path: `local/${user.id}/${category}/${crypto.randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`,
    });
  }

  const bucket = `consultant-media-${user.id}`;
  const { error: bucketError } = await supabase.storage.getBucket(bucket);
  if (bucketError) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/webm",
        "video/quicktime",
      ],
    });
    if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${user.id}/${category}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, category, path });
}

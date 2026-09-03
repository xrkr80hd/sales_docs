import { ConsultantProfileContent, normalizeProfileContent } from "@/lib/consultant-profile";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function getPublishedConsultantProfile(slug: string): Promise<ConsultantProfileContent | null> {
  const isTrav = slug === "trav";
  try {
    const supabase = getSupabaseServiceClient();

    // 1. Try querying consultant_cards relational table
    const { data: card } = await supabase
      .from("consultant_cards")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (card) {
      const [
        { data: reviews },
        { data: vehicles },
        { data: videos },
        { data: soldGallery },
        { data: socialLinks },
      ] = await Promise.all([
        supabase.from("consultant_reviews").select("*").eq("card_id", card.id).order("sort_order", { ascending: true }),
        supabase.from("consultant_vehicles").select("*").eq("card_id", card.id).order("sort_order", { ascending: true }),
        supabase.from("consultant_videos").select("*").eq("card_id", card.id).order("sort_order", { ascending: true }),
        supabase.from("consultant_sold_gallery").select("*").eq("card_id", card.id).order("sort_order", { ascending: true }),
        supabase.from("consultant_social_links").select("*").eq("card_id", card.id).order("sort_order", { ascending: true }),
      ]);

      return {
        identity: {
          displayName: card.display_name,
          jobTitle: card.job_title || "Sales Consultant",
          dealership: card.dealership || "Walker Automotive",
          location: card.location || "Alexandria, Louisiana",
          phone: card.phone || "",
          email: card.email || "",
          profileImageUrl: card.profile_image_url || "",
          callingCardImageUrl: card.calling_card_image_url || "",
          logoUrl: card.logo_url || "/branding/nxtdox-by-eben.png",
          languageLabel: card.language_label || "EN · ES",
        },
        content: {
          primaryPhrase: card.primary_phrase || "",
          salesQuote: card.sales_quote || "",
          bio: card.bio || "",
          inventoryUrl: card.inventory_url || "https://www.walkerautomotive.com/",
          inventoryButtonLabel: card.inventory_button_label || "Browse Walker Inventory",
        },
        contact: {
          callLabel: card.call_label || "Call",
          textLabel: card.text_label || "Text",
          emailLabel: card.email_label || "Email",
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
    }

    // 2. Fallback: check legacy user_settings json
    const { data } = await supabase.from("user_settings").select("consultant_info");
    const match = data?.find((row) => {
      const c = (row.consultant_info as Record<string, unknown> | null)?.business_card as Record<string, unknown> | undefined;
      return c?.slug === slug && Boolean(c.publishedAt);
    });
    const legacyCard = (match?.consultant_info as Record<string, unknown> | null)?.business_card as Record<string, unknown> | undefined;
    if (legacyCard?.published) {
      return normalizeProfileContent(legacyCard.published, isTrav);
    }

    return null;
  } catch {
    return null;
  }
}

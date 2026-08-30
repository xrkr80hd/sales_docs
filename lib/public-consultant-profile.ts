import { normalizeProfileContent, travDefaultContent } from "@/lib/consultant-profile";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function getPublishedConsultantProfile(slug: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data } = await supabase.from("user_settings").select("consultant_info");
    const match = data?.find((row) => {
      const card = (row.consultant_info as Record<string, unknown> | null)?.business_card as Record<string, unknown> | undefined;
      return card?.slug === slug && Boolean(card.publishedAt);
    });
    const card = (match?.consultant_info as Record<string, unknown> | null)?.business_card as Record<string, unknown> | undefined;
    if (!card?.published) return slug === "trav" ? travDefaultContent : null;
    return normalizeProfileContent(card.published);
  } catch {
    return slug === "trav" ? travDefaultContent : null;
  }
}

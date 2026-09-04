import type { MetadataRoute } from "next";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = "https://nextdocs.xrkr80hd.studio";
  try {
    const supabase = getSupabaseServiceClient();
    const { data: cards } = await supabase
      .from("consultant_cards")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    const publishedCards = (cards ?? []).map((card) => ({
      url: `${siteUrl}/card/${card.slug}`,
      lastModified: card.updated_at ? new Date(card.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: card.slug === "trav" ? 1 : 0.8,
    }));
    return publishedCards.length
      ? publishedCards
      : [{ url: `${siteUrl}/card/trav`, changeFrequency: "weekly" as const, priority: 1 }];
  } catch {
    return [{ url: `${siteUrl}/card/trav`, changeFrequency: "weekly", priority: 1 }];
  }
}

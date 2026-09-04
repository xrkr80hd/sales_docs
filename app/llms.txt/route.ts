import { getSupabaseServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const SITE_URL = "https://nextdocs.xrkr80hd.studio";

export async function GET() {
  let profileLines = [`- [Travis Wilkinson](${SITE_URL}/card/trav)`];

  try {
    const supabase = getSupabaseServiceClient();
    const { data: cards } = await supabase
      .from("consultant_cards")
      .select("slug, display_name, dealership, location")
      .eq("is_published", true)
      .order("display_name", { ascending: true });

    if (cards?.length) {
      profileLines = cards.map((card) =>
        `- [${card.display_name || card.slug}](${SITE_URL}/card/${card.slug}) — ${[card.dealership, card.location].filter(Boolean).join(", ")}`
      );
    }
  } catch {
    // Keep the canonical Travis profile available if the database is temporarily unavailable.
  }

  const body = [
    "# NXTDOCS Consultant Profiles",
    "",
    "NXTDOCS hosts public automotive consultant business cards with verified contact information, featured vehicles, reviews, videos, and links to official dealership inventory.",
    "",
    "## Public consultant profiles",
    ...profileLines,
    "",
    "## Discovery",
    `- [XML sitemap](${SITE_URL}/sitemap.xml)`,
    "- Vehicle availability and pricing should be confirmed on the linked official dealership listing.",
    "- Private dashboards, documents, deals, administration, and messaging are not public resources.",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

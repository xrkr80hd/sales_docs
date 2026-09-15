import { getPublishedConsultantProfile } from "@/lib/public-consultant-profile";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const profile = await getPublishedConsultantProfile(slug);

  if (!profile) {
    return Response.json({ error: "Consultant card not found." }, { status: 404 });
  }

  const cardPath = `/card/${encodeURIComponent(slug)}`;
  const firstName = profile.identity.displayName.trim().split(/\s+/)[0] || "Consultant";

  return Response.json(
    {
      id: cardPath,
      name: `${profile.identity.displayName} — Business Card`,
      short_name: `${firstName} Card`,
      description:
        profile.content.bio ||
        profile.content.salesQuote ||
        `Contact ${profile.identity.displayName} at ${profile.identity.dealership}.`,
      start_url: cardPath,
      scope: `${cardPath}/`,
      display: "standalone",
      orientation: "any",
      theme_color: "#1c1c1e",
      background_color: "#1c1c1e",
      icons: [
        {
          src: "/icons/nxtdocs-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/icons/nxtdocs-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/nxtdocs-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}

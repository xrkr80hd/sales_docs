import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = "https://nextdocs.xrkr80hd.studio";
  return {
    rules: {
      userAgent: "*",
      allow: ["/card/"],
      disallow: ["/admin", "/api", "/auth", "/business-card", "/dashboard", "/deal-sheet", "/deals", "/documents", "/messenger", "/print", "/vehicle-collage"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

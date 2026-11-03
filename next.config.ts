import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old site is shut down: every address (pages, sign-in, API, business-card links)
  // goes to the same path on nextdox.app. Temporary (307) so it can be undone.
  async redirects() {
    return [{ source: "/:path*", destination: "https://nextdox.app/:path*", permanent: false }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ywtdskskkplpurniyyto.supabase.co" },
      { protocol: "https", hostname: "vehicle-images.carscommerce.inc" },
      { protocol: "https", hostname: "pictures.dealer.com" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server build (server.js + only the files it needs) for the cPanel Node.js app.
  output: "standalone",
  // Account data must never be stored by the host's front cache (it ignores who is signed in
  // and served one person's reply to everyone). Every /api reply is private and uncacheable.
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }, { key: "Vary", value: "Authorization" }] }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "nextdox.app" },
      { protocol: "https", hostname: "www.nextdox.app" },
      // Kept while old links still point at Supabase Storage.
      { protocol: "https", hostname: "ywtdskskkplpurniyyto.supabase.co" },
      { protocol: "https", hostname: "vehicle-images.carscommerce.inc" },
      { protocol: "https", hostname: "pictures.dealer.com" },
    ],
  },
};

export default nextConfig;

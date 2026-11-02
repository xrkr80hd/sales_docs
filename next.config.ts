import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server build (server.js + only the files it needs) for the cPanel Node.js app.
  output: "standalone",
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

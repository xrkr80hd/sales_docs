import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ywtdskskkplpurniyyto.supabase.co" },
      { protocol: "https", hostname: "vehicle-images.carscommerce.inc" },
      { protocol: "https", hostname: "pictures.dealer.com" },
    ],
  },
};

export default nextConfig;

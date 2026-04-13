import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "assets.nhle.com" },
    ],
  },
};

export default nextConfig;

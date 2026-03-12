import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow requests from localhost (Electron dev) and both production domains
      allowedOrigins: [
        "localhost:3000",
        "app.meetwingman.ai",
        "meetwingman.ai",
      ],
    },
  },
};

export default nextConfig;

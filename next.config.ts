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
  // Flight Recorder writes JSONL into <repo>/dev-logs/ during local dev. Those files
  // change several times/sec (Deepgram partials) — keep them out of the dev file-watcher
  // so a live TEST call is never jittered by watchpack FS churn. Dev-only concern.
  // NOTE: `ignored` REPLACES Next's default (which also ignores .next/.git), so we must
  // re-list those as globs — dropping them would make the watcher watch its own build
  // output and rebuild-loop (worse churn than the jitter this prevents).
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/dev-logs/**"],
      };
    }
    return config;
  },
};

export default nextConfig;

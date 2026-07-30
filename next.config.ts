import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build output directory. Defaults to .next — Railway and `npm run build` are
  // unchanged.
  //
  // WHY THIS IS OVERRIDABLE: a production build REPLACES the chunks in .next. If
  // Sebastian's `npm run electron:dev` is running against the same directory, his
  // already-loaded dev server suddenly can't resolve its own modules and the app
  // dies with "Cannot find module './XXXX.js'". This has now happened twice, both
  // times because a build was run as a verification gate while his server was up.
  // `npm run build:verify` sets this to a throwaway directory so a correctness
  // check can never take his running app down.
  distDir: process.env.WINGMAN_BUILD_DIR || ".next",

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

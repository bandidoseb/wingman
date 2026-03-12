/**
 * scripts/wait-and-launch.js
 *
 * When you run `npm run electron:dev`, this script:
 *   1. Waits for the Next.js dev server to be ready (polls localhost:3000)
 *   2. Compiles the Electron TypeScript (electron/*.ts → electron-dist/)
 *   3. Launches the Electron app
 *
 * This means you only need ONE terminal command to run everything.
 */

const { execSync, spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs   = require("fs");

// ─── Load .env.local into process.env so Electron inherits them ───────────────
const envFile = path.join(__dirname, "../.env.local");
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf-8").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

const NEXT_URL    = "http://localhost:3000";
const POLL_MS     = 1000;       // check every 1 second
const MAX_WAIT_MS = 60_000;     // give up after 60 seconds

// ─── Wait for Next.js to be ready ────────────────────────────────────────────
function waitForNext(resolve, reject, elapsed = 0) {
  if (elapsed >= MAX_WAIT_MS) {
    reject(new Error("Next.js didn't start within 60 seconds"));
    return;
  }

  http.get(NEXT_URL, (res) => {
    if (res.statusCode < 500) {
      console.log("\n[electron:dev] ✅ Next.js is ready — launching Electron...\n");
      resolve();
    } else {
      setTimeout(() => waitForNext(resolve, reject, elapsed + POLL_MS), POLL_MS);
    }
  }).on("error", () => {
    // Server not up yet — keep polling
    if (elapsed === 0) {
      process.stdout.write("[electron:dev] Waiting for Next.js");
    } else {
      process.stdout.write(".");
    }
    setTimeout(() => waitForNext(resolve, reject, elapsed + POLL_MS), POLL_MS);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Step 1: Wait for Next.js dev server
  await new Promise((resolve, reject) => waitForNext(resolve, reject));

  // Step 2: Compile Electron TypeScript
  console.log("[electron:dev] Compiling Electron TypeScript...");
  try {
    execSync("npx tsc -p tsconfig.electron.json", { stdio: "inherit" });
    console.log("[electron:dev] ✅ Compiled successfully\n");
  } catch (err) {
    console.error("[electron:dev] ❌ TypeScript compilation failed");
    process.exit(1);
  }

  // Step 3: Copy HUD files to electron-dist (tsc only copies .ts, not .html)
  const { cpSync, mkdirSync } = require("fs");
  try {
    mkdirSync(path.join(__dirname, "../electron-dist/hud"), { recursive: true });
    cpSync(
      path.join(__dirname, "../electron/hud"),
      path.join(__dirname, "../electron-dist/hud"),
      { recursive: true }
    );
  } catch (err) {
    // Fine if it fails — HUD might not exist yet
  }

  // Step 4: Launch Electron
  console.log("[electron:dev] 🚀 Launching Wingman desktop app...\n");
  const electron = require("electron");
  const child = spawn(String(electron), ["electron-dist/main.js"], {
    stdio:   "inherit",
    env:     { ...process.env, NODE_ENV: "development" },
    cwd:     path.join(__dirname, ".."),
  });

  child.on("close", (code) => {
    console.log(`\n[electron:dev] Electron exited (code ${code})`);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[electron:dev] Fatal error:", err.message);
  process.exit(1);
});

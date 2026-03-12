/**
 * scripts/notarize.js
 *
 * Apple Notarization Script
 * ─────────────────────────────────────────────────────────────────────────────
 * This script runs automatically after code signing when you build the DMG.
 * It submits the app to Apple for notarization, which is required for users
 * to download and open Wingman without seeing a scary "unidentified developer"
 * warning.
 *
 * ── What you need to enable this ────────────────────────────────────────────
 * 1. An Apple Developer account ($99/year at developer.apple.com)
 * 2. An app-specific password from appleid.apple.com
 * 3. Set these environment variables (add to your CI/CD or terminal):
 *
 *    APPLE_ID=your@email.com
 *    APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
 *    APPLE_TEAM_ID=XXXXXXXXXX   (found in your Developer account)
 *
 * 4. Uncomment "afterSign: scripts/notarize.js" in electron-builder.yml
 *
 * ── You don't need this yet ──────────────────────────────────────────────────
 * Skip this entirely until you're ready to launch publicly.
 * For internal testing (sharing the .dmg directly with people you know),
 * they can right-click → Open to bypass Gatekeeper.
 */

const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  // Only notarize macOS builds
  if (context.electronPlatformName !== "darwin") return;

  const appBundleId = "ai.meetwingman.app";
  const appName     = context.packager.appInfo.productFilename;
  const appPath     = `${context.appOutDir}/${appName}.app`;

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn("[Notarize] Skipping: APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set");
    return;
  }

  console.log(`[Notarize] Submitting ${appPath} to Apple for notarization…`);

  await notarize({
    tool:       "notarytool",
    appPath,
    appleId:    process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId:     process.env.APPLE_TEAM_ID,
  });

  console.log("[Notarize] Done ✓");
};

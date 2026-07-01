import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  globalShortcut,
  screen,
  dialog,
} from "electron";
import * as path from "path";
import { autoUpdater } from "electron-updater";
import { initRecallAI, stopRecallAI, setupRecallAI, hasMeetingDetected, AutoStopReason } from "./recall";

// ─── App URLs ────────────────────────────────────────────────────────────────
const PROD_URL = "https://app.meetwingman.ai";
const DEV_URL  = "http://localhost:3000";
const getAppUrl = (): string => (app.isPackaged ? PROD_URL : DEV_URL);

// ─── Window references ───────────────────────────────────────────────────────
let mainWindow:   BrowserWindow | null = null;
let hudWindow:    BrowserWindow | null = null;
let trayPopover:  BrowserWindow | null = null;
let tray:         Tray | null = null;

// ─── Call state ───────────────────────────────────────────────────────────────
// Tracks whether a call is active so the shortcut knows whether to show the
// "Ready to deploy?" confirmation toast or end the current call.
let callActive = false;

// ─── Pending outcome state ────────────────────────────────────────────────────
// Holds the callId + access token from the most recent ended call so the
// hud:save-outcome handler can make an authenticated API request.
let pendingOutcomeCallId: string | null = null;
let pendingOutcomeToken:  string | null = null;

// ─── HUD auto-hide timer ──────────────────────────────────────────────────────
// Stored so call:end can cancel it if the user manually ends the call while
// the auto-stop hide countdown is still running (prevents the outcome card
// from being hidden moments after it appears).
let hudAutoHideTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Zoom display name status ─────────────────────────────────────────────────
// Synced from the web app via 'app:set-zoom-status' IPC after DashboardClient mounts.
// Three states: null = unknown (web app hasn't reported yet), true = name is set,
// false = name is not set. We only block deploy on explicit false — null passes
// through so the dashboard's own check handles it if the web app hasn't loaded yet.
let zoomNameSet: boolean | null = null;

// ─── Quit guard ───────────────────────────────────────────────────────────────
// We hide the main window instead of destroying it so users can reopen it from
// the tray or dock without relaunching. But app.quit() must still work — this
// flag lets the "close" handler know when a real quit is in progress so it
// skips the hide and lets Electron destroy the window normally.
let isQuitting = false;

// ─── Hotkey compass menu state (Phase 3) ──────────────────────────────────────
// The Up Arrow summon key is registered only while a call is active. The
// direction keys (← ↓ →) + Esc are additionally registered only while the
// compass menu is open, so they don't swallow arrow presses in Zoom/Meet
// at any other time. Both layers are torn down on every call-end path.
let menuOpen         = false;   // is the compass menu visible on the HUD?
let hotkeyRegistered = false;   // idempotent guard — prevent double-registration
let menuAutoFadeTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Hotkey helpers (Phase 3) ─────────────────────────────────────────────────

/** Unregister ← ↓ → Esc and cancel the auto-fade. Called on pick, dismiss, timeout, or call-end. */
function teardownMenuKeys(): void {
  globalShortcut.unregister("Left");
  globalShortcut.unregister("Down");
  globalShortcut.unregister("Right");
  globalShortcut.unregister("Escape");
  if (menuAutoFadeTimer) { clearTimeout(menuAutoFadeTimer); menuAutoFadeTimer = null; }
}

/** Hide the compass menu and tear down its direction shortcuts.
 *  suppressHudSend (pick path only): the HUD's pick-flash animation owns the
 *  compass teardown there — sending menu-close too would stomp the flash
 *  mid-animation. main-side state (menuOpen, keys, auto-fade timer) ALWAYS
 *  resets regardless of the flag, so the two processes can never desync. */
function closeCompassMenu(reason = "unspecified", opts: { suppressHudSend?: boolean } = {}): void {
  if (!menuOpen) return;
  menuOpen = false;
  teardownMenuKeys();
  console.log(`[Compass] close (${reason})`); // debug #39
  if (!opts.suppressHudSend) {
    hudWindow?.webContents.send("wingman:menu-close");
  }
}

/** Phase 3.5 — tell the HUD which arrow was picked. The HUD plays the green
 *  flash on that arrow and then tears the compass down itself (menu-close is
 *  suppressed on the pick path — see closeCompassMenu). */
function sendPickFlash(direction: string): void {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.webContents.send("wingman:pick-flash", direction);
  }
}

/**
 * Show the compass menu and register the 4 direction shortcuts.
 * - ← ↓ → each close the menu and send a "menu-pick" with their direction to
 *   the web app. Phase 3 only implements "objection" (↑). The other three are
 *   wired so their keys are captured (not swallowed by Zoom/Meet), and the
 *   dashboard handler will no-op for unimplemented slots until Phase 4.
 * - Esc closes the menu without picking.
 * - Auto-fades after 5 s (silent — no visible countdown, per spec).
 */
function openCompassMenu(): void {
  menuOpen = true;
  // debug #39: make the send explicit so a missing/dead HUD window is loud,
  // not silently skipped by optional chaining.
  if (hudWindow && !hudWindow.isDestroyed()) {
    console.log(`[Compass] open → sending menu-open (HUD visible=${hudWindow.isVisible()})`);
    hudWindow.webContents.send("wingman:menu-open");
  } else {
    console.warn(`[Compass] open — menu-open NOT sent: hudWindow is ${hudWindow ? "DESTROYED" : "NULL"}`);
  }

  // Helper: register a direction key that picks a slot and closes the menu.
  // Flash first (instant visual ack on the HUD), then close with the HUD send
  // suppressed — the flash animation owns the compass teardown on this path.
  const registerPick = (key: string, direction: string) => {
    globalShortcut.register(key, () => {
      sendPickFlash(direction);
      closeCompassMenu(`pick:${direction}`, { suppressHudSend: true });
      mainWindow?.webContents.send("wingman:menu-pick", direction);
    });
  };

  registerPick("Left",  "answer");
  registerPick("Down",  "dig");
  registerPick("Right", "close");

  // Esc — dismiss without picking
  globalShortcut.register("Escape", () => { closeCompassMenu("esc"); });

  // Silent 5 s auto-fade (no visible countdown, per spec)
  menuAutoFadeTimer = setTimeout(() => { closeCompassMenu("auto-fade-5s"); }, 5_000);
}

/**
 * Register the Up Arrow summon key for the duration of a call.
 * Idempotent — safe to call even if already registered.
 * First press: opens the compass menu.
 * Second press (menu already open): picks "objection" immediately
 *   (double-tap Up = instant objection help without looking).
 */
function registerCallHotkey(): void {
  if (hotkeyRegistered) return;

  const ok = globalShortcut.register("Up", () => {
    console.log(`[Compass] Up pressed (callActive=${callActive}, menuOpen=${menuOpen})`); // debug #39
    if (!callActive) return; // safety — shouldn't happen since we unregister on call end

    if (menuOpen) {
      // Double-tap Up → instant objection pick (same flash-then-close as registerPick)
      sendPickFlash("objection");
      closeCompassMenu("double-tap-objection", { suppressHudSend: true });
      mainWindow?.webContents.send("wingman:menu-pick", "objection");
    } else {
      openCompassMenu();
    }
  });

  if (!ok) {
    console.warn("[Hotkey] Up Arrow registration failed — another app may have claimed it");
    return;
  }

  hotkeyRegistered = true;
  console.log("[Hotkey] Up Arrow registered");
}

/**
 * Unregister the Up Arrow summon key and close any open compass menu.
 * Idempotent — safe to call on every stop path.
 */
function unregisterCallHotkey(): void {
  closeCompassMenu("call-end"); // tears down direction keys first
  if (!hotkeyRegistered) return;
  globalShortcut.unregister("Up");
  hotkeyRegistered = false;
  console.log("[Hotkey] Up Arrow unregistered");
}

// ─── Auto-stop handler ────────────────────────────────────────────────────────
// Called by recall.ts when any of the three safeguards fire (meeting-lost,
// inactivity timeout, or hard cap). Ends the call, notifies both windows,
// then hides the HUD after giving it time to show the reason toast.
function autoStopCall(reason: AutoStopReason): void {
  console.log(`[AutoStop] Reason: ${reason}`);
  callActive = false;
  unregisterCallHotkey(); // close compass + release Up Arrow before anything else
  stopRecallAI();
  hudWindow?.webContents.send("call:ended");
  hudWindow?.webContents.send("hud:auto-stopped", reason);
  trayPopover?.webContents.send("tray:call-state", false);
  // Tell web app the call ended automatically — uses dedicated channel so the
  // web app can patch the session WITHOUT calling endCall() again (avoids double-stop).
  mainWindow?.webContents.send("call:auto-ended");
  // Give the HUD 4 seconds to show the reason toast before hiding.
  // Store the timer so call:end can cancel it if the user manually ends while
  // this countdown is running (prevents outcome card from being hidden prematurely).
  if (hudAutoHideTimer) { clearTimeout(hudAutoHideTimer); hudAutoHideTimer = null; }
  hudAutoHideTimer = setTimeout(() => {
    hudWindow?.hide();
    hudAutoHideTimer = null;
  }, 4000);
}

// ─── Main Window ─────────────────────────────────────────────────────────────
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          820,
    minWidth:        960,
    minHeight:       600,
    titleBarStyle:   "hiddenInset",
    vibrancy:        "sidebar",
    trafficLightPosition: { x: 18, y: 22 },
    backgroundColor: "#f5f5f7",
    show:            false,
    webPreferences: {
      preload:           path.join(__dirname, "preload.js"),
      contextIsolation:  true,
      nodeIntegration:   false,
      webSecurity:       true,
    },
  });

  mainWindow.loadURL(getAppUrl());

  mainWindow.once("ready-to-show", () => { mainWindow?.show(); });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(getAppUrl()) && !url.startsWith("http://localhost")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Hide instead of destroy when the user clicks the red X.
  // This lets them reopen the dashboard from the tray or dock without a full
  // reload. The isQuitting flag ensures app.quit() (tray → Quit Wingman) still
  // closes the window for real so the app can exit cleanly.
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  if (!app.isPackaged) {
    mainWindow.webContents.on("before-input-event", (_event, input) => {
      if (input.key === "F12") mainWindow?.webContents.openDevTools();
    });
  }
}

// ─── HUD Overlay Window ──────────────────────────────────────────────────────
// Full-screen transparent overlay — only the two floating components are visible.
// Mouse events pass through by default (setIgnoreMouseEvents with forward:true).
// When the suggestion bubble appears, we temporarily stop forwarding so the
// user can click "got it".
function createHudWindow(): void {
  // Match the primary display exactly so absolute-positioned components
  // (stage bar at top-center, bubble at bottom-right) land in the right place
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  hudWindow = new BrowserWindow({
    width,
    height,
    x:           0,
    y:           0,
    frame:       false,
    transparent: true,          // window is fully see-through
    alwaysOnTop: true,
    resizable:   false,
    movable:     false,
    skipTaskbar: true,
    hasShadow:   false,
    show:        false,         // hidden until call starts
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  hudWindow.loadFile(path.join(__dirname, "hud/index.html"));

  // TEMP (debug #39): in dev, open detached DevTools for the HUD overlay.
  // The HUD is frameless + click-through, so there is no other way to inspect
  // it or run console commands against it. Remove when #39 is closed.
  if (!app.isPackaged) {
    hudWindow.webContents.openDevTools({ mode: "detach" });
  }

  // Always above everything — including full-screen Zoom
  hudWindow.setAlwaysOnTop(true, "screen-saver");
  hudWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Prevent HUD from appearing in the user's screen recordings / screen share
  hudWindow.setContentProtection(true);

  // Default: all mouse events pass through to whatever app is underneath
  hudWindow.setIgnoreMouseEvents(true, { forward: true });

  hudWindow.on("closed", () => { hudWindow = null; });
}

// ─── Tray Popover ────────────────────────────────────────────────────────────
// Small floating panel that appears directly below the menu-bar icon when
// clicked.  Uses nodeIntegration (local HTML only — no remote content).
function createTrayPopover(): void {
  trayPopover = new BrowserWindow({
    width:      240,
    height:     180,          // resized dynamically (180 idle / 190 live)
    show:       false,
    frame:      false,
    resizable:  false,
    movable:    false,
    alwaysOnTop: true,
    transparent: true,
    hasShadow:  false,        // shadow is drawn in CSS for correct shape
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration:  true,   // local file only — safe to enable
      contextIsolation: false,
    },
  });

  trayPopover.loadFile(path.join(__dirname, "tray-popover/index.html"));
  trayPopover.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // "pop-up-menu" is the correct macOS window level for menu bar popovers —
  // ensures it appears above the menu bar itself.
  trayPopover.setAlwaysOnTop(true, "pop-up-menu");

  // Note: no blur auto-hide — we use showInactive() so focus never transfers,
  // meaning blur never fires. Popover closes on the next tray icon click instead.
  trayPopover.on("closed", () => { trayPopover = null; });
}

// ─── Menu Bar / Tray ─────────────────────────────────────────────────────────
function createTray(): void {
  // WingmanTray.png — transparent white W (no black background), template image
  // so macOS inverts it automatically for light/dark menu bars.
  const iconPath = !app.isPackaged
    ? path.join(__dirname, "../public/WingmanTray.png")
    : path.join(process.resourcesPath, "public/WingmanTray.png");

  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);   // enables macOS auto dark/light inversion
  tray = new Tray(icon);

  tray.setToolTip("Wingman — AI Sales Copilot");

  // Track when the right-click context menu is open so mouse-down doesn't interfere.
  let contextMenuOpen = false;

  // Right-click: dynamic context menu.
  // "Open Wingman" recreates the window if it was closed (mainWindow can be null).
  tray.on("right-click", () => {
    contextMenuOpen = true;
    const menu = Menu.buildFromTemplate([
      {
        label: "Open Wingman",
        click: () => {
          if (!mainWindow) createMainWindow();
          else { mainWindow.show(); mainWindow.focus(); }
        },
      },
      { type: "separator" },
      callActive
        ? { label: "End Call",       click: () => { mainWindow?.webContents.send("shortcut:toggle-call"); } }
        : { label: "Deploy Wingman", click: () => { mainWindow?.webContents.send("shortcut:toggle-call"); } },
      { type: "separator" },
      { label: "Quit Wingman", click: () => app.quit() },
    ]);
    // Reset flag after menu closes so mouse-down works again
    menu.once("menu-will-close", () => { setTimeout(() => { contextMenuOpen = false; }, 100); });
    tray!.popUpContextMenu(menu);
  });

  // Left-click: show the custom popover directly below the tray icon.
  // Uses mouse-down (fires before "click" and is more reliable on macOS Sequoia).
  // Guard against right-click menu being open — otherwise showInactive() steals
  // focus from the native menu and causes items to vanish before the click lands.
  // Note: mouse-down passes a Point (no width/height) so we use tray.getBounds() for sizing.
  tray.on("mouse-down", () => {
    if (contextMenuOpen) return;
    if (!trayPopover || trayPopover.isDestroyed()) return;

    if (trayPopover.isVisible()) {
      trayPopover.hide();
      return;
    }

    const iconBounds = tray!.getBounds();
    const popW = 240;
    const popX = Math.round(iconBounds.x + iconBounds.width  / 2 - popW / 2);
    const popY = Math.round(iconBounds.y + iconBounds.height);

    trayPopover.webContents.send("tray:call-state", callActive);
    trayPopover.showInactive();
    // Position after show — macOS ignores setPosition on hidden windows
    trayPopover.setBounds({ x: popX, y: popY, width: popW, height: trayPopover.getBounds().height });
  });
}

// ─── Deep Link Handler ───────────────────────────────────────────────────────
function handleDeepLink(url: string): void {
  console.log("[DeepLink] Received:", url);
  try {
    const parsed    = new URL(url);
    const targetUrl = !app.isPackaged
      ? `${DEV_URL}${parsed.pathname}${parsed.search}`
      : `${PROD_URL}${parsed.pathname}${parsed.search}`;
    mainWindow?.loadURL(targetUrl);
    mainWindow?.show();
    mainWindow?.focus();
  } catch (e) {
    console.error("[DeepLink] Failed to parse URL:", url, e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Sends a message to the main window, creating it first if it was closed.
// Does NOT force-show the window — the HUD handles the visible feedback.
function sendToMainWindow(channel: string): void {
  if (!mainWindow) {
    createMainWindow();
    mainWindow!.webContents.once("did-finish-load", () => {
      mainWindow?.webContents.send(channel);
    });
  } else {
    mainWindow.webContents.send(channel);
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
function setupIPC(): void {

  // ── Call lifecycle ──────────────────────────────────────────────────────────
  ipcMain.handle("call:start", async (_event, token?: string) => {
    console.log("[IPC] call:start");

    if (!hasMeetingDetected()) {
      return { success: false, error: "no_meeting" };
    }

    // Auth token is required — used server-side to fetch the Recall AI upload token.
    // The token comes from the web app's Supabase session (passed via startCall(token)).
    if (!token) {
      console.error("[call:start] No auth token — cannot fetch Recall AI upload token");
      return { success: false, error: "no_auth" };
    }

    callActive = true;
    hudWindow?.show();
    hudWindow?.webContents.send("call:started");
    trayPopover?.webContents.send("tray:call-state", true);

    const started = await initRecallAI({
      appUrl:             getAppUrl(),
      authToken:          token,
      onChunk:            (chunk: string) => { mainWindow?.webContents.send("transcript:chunk", chunk); },
      onAutoStop:         autoStopCall,
      onApproachingLimit: () => { hudWindow?.webContents.send("hud:cap-warning"); },
    });

    if (!started) {
      // Recording failed to start — roll back Electron state so the web app
      // knows not to create a session. HUD hides cleanly after 600ms.
      callActive = false;
      unregisterCallHotkey(); // release Up Arrow — nothing to summon during a failed start
      hudWindow?.webContents.send("call:ended", {});  // reset HUD to idle state
      trayPopover?.webContents.send("tray:call-state", false);
      setTimeout(() => hudWindow?.hide(), 600);
      return { success: false, error: "recording_failed" };
    }

    registerCallHotkey(); // Up Arrow live — call is genuinely active
    return { success: true };
  });

  ipcMain.handle("call:end", async (_event, callId?: string, token?: string) => {
    console.log("[IPC] call:end", callId ? "(with callId)" : "(no callId)");
    callActive = false;
    unregisterCallHotkey(); // close compass + release Up Arrow

    // Store for use when HUD picks an outcome
    pendingOutcomeCallId = callId ?? null;
    pendingOutcomeToken  = token  ?? null;

    // Pass callId to HUD so it knows whether to show the outcome card
    hudWindow?.webContents.send("call:ended", { callId });
    trayPopover?.webContents.send("tray:call-state", false);
    stopRecallAI();

    if (callId) {
      // Cancel any pending auto-hide from autoStopCall — the outcome card must
      // stay visible long enough for the user to pick an outcome.
      if (hudAutoHideTimer) { clearTimeout(hudAutoHideTimer); hudAutoHideTimer = null; }
      // Ensure the HUD is visible — it may have been hidden by a previous auto-stop.
      hudWindow?.show();
    } else {
      setTimeout(() => hudWindow?.hide(), 600);
    }

    return { success: true };
  });

  // ── HUD outcome save — called after user picks in the post-call card ────────
  ipcMain.handle("hud:save-outcome", async (_event, { callId, outcome }: { callId: string; outcome: string }) => {
    console.log("[IPC] hud:save-outcome", outcome);

    const appUrl = getAppUrl();
    const token  = pendingOutcomeToken;

    if (!token) {
      console.warn("[hud:save-outcome] No token available — cannot save");
      hudWindow?.webContents.send("hud:outcome-saved", false);
      return;
    }

    try {
      const res = await fetch(`${appUrl}/api/wingman/hud-outcome`, {
        method:  "PATCH",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ call_id: callId, outcome }),
      });

      const ok = res.ok;
      hudWindow?.webContents.send("hud:outcome-saved", ok);

      if (ok) {
        // Clear pending state — outcome is saved
        pendingOutcomeCallId = null;
        pendingOutcomeToken  = null;
        // Tell the dashboard to refresh so the disposition pill appears immediately
        mainWindow?.webContents.send("call:outcome-updated");
        // Hide HUD after the card shows its confirmation (1.5s handled in HUD)
        setTimeout(() => hudWindow?.hide(), 2200);
      }
    } catch (err) {
      console.error("[hud:save-outcome] fetch failed:", err);
      hudWindow?.webContents.send("hud:outcome-saved", false);
      // Clear pending state even on failure — a stale token from a previous call
      // should not be used for future saves (Supabase tokens expire after 1 hour).
      pendingOutcomeCallId = null;
      pendingOutcomeToken  = null;
    }
  });

  // ── Zoom name status sync — web app reports on mount + on name save ────────
  ipcMain.handle("app:set-zoom-status", (_event, hasName: boolean) => {
    zoomNameSet = hasName;
    console.log("[ZoomName] Status:", hasName ? "set" : "not set");
  });

  // ── HUD Deploy button → start call via web app toggle ──────────────────────
  ipcMain.handle("hud:deploy-call", () => {
    console.log("[IPC] hud:deploy-call");
    if (zoomNameSet === false) {
      hudWindow?.webContents.send("hud:setup-required");
      return;
    }
    sendToMainWindow("shortcut:toggle-call");
  });

  // ── HUD "Open Settings" → show dashboard and navigate to Settings tab ───────
  ipcMain.handle("hud:open-settings", () => {
    console.log("[IPC] hud:open-settings");
    hudWindow?.hide();
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow();
      mainWindow!.webContents.once("did-finish-load", () => {
        mainWindow?.webContents.send("navigate:settings");
      });
    } else {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("navigate:settings");
    }
  });

  // ── HUD End Call confirmed → end call via web app toggle ───────────────────
  ipcMain.handle("hud:confirm-end-call", () => {
    console.log("[IPC] hud:confirm-end-call");
    mainWindow?.webContents.send("shortcut:toggle-call");
  });

  // ── HUD visibility ──────────────────────────────────────────────────────────
  ipcMain.handle("hud:show", () => { hudWindow?.show(); });
  ipcMain.handle("hud:hide", () => { hudWindow?.hide(); });

  // ── HUD log relay (debug #39) — prints HUD-renderer messages in the terminal ─
  // The HUD window is frameless + click-through, so its console is otherwise
  // invisible. Remove when #39 is closed.
  ipcMain.on("hud:log", (_event, msg: string) => {
    console.log(`[HUD] ${msg}`);
  });

  // ── Detection toast dismissed — hide HUD (call never started) ──────────────
  ipcMain.handle("hud:dismiss-detection", () => { hudWindow?.hide(); });

  // ── Signal → HUD ───────────────────────────────────────────────────────────
  ipcMain.handle("hud:signal", (_event, signal: { header: string; text: string; type: string; seq?: number }) => {
    hudWindow?.webContents.send("hud:update-signal", signal);
  });

  // ── Streaming reveal delta → HUD (Step 4) — relay only, mirrors hud:signal ──
  ipcMain.handle("hud:signal-delta", (_event, payload: { seq: number; phase: string; textSoFar?: string; type?: string }) => {
    hudWindow?.webContents.send("hud:update-signal-delta", payload);
  });

  // ── Summon state → HUD (Phase 3.5 thinking pill) ────────────────────────────
  // DashboardClient reports card-generation progress ("thinking" | "error" |
  // "unsupported"); the HUD renders the pill. The pill's lifecycle contract
  // lives in the HUD (single owner of its timers).
  ipcMain.handle("hud:summon-state", (_event, payload: { state: string; slot?: string }) => {
    hudWindow?.webContents.send("wingman:summon-state", payload);
  });

  // ── Stage → HUD (richer payload: current + all stages + completed) ──────────
  ipcMain.handle("hud:stage", (_event, data: { current: string; all: string[]; completed: string[] }) => {
    hudWindow?.webContents.send("hud:update-stage", data);
  });

  // ── Scorecard → HUD (live scoring state — forwarded for future HUD use) ─────
  ipcMain.handle("hud:scorecard", (_event, scorecard: Record<string, unknown>) => {
    hudWindow?.webContents.send("hud:update-scorecard", scorecard);
  });

  // ── HUD dismiss → main window ───────────────────────────────────────────────
  ipcMain.handle("hud:dismiss", () => {
    mainWindow?.webContents.send("signal:dismiss");
  });

  // ── Mouse interaction toggle ────────────────────────────────────────────────
  // HUD calls this when the suggestion bubble appears/disappears so the
  // "got it" button is actually clickable, but transparent areas still pass through.
  ipcMain.handle("hud:set-mouse-ignore", (_event, ignore: boolean) => {
    if (ignore) {
      hudWindow?.setIgnoreMouseEvents(true, { forward: true });
    } else {
      hudWindow?.setIgnoreMouseEvents(false);
    }
  });

  // ── Tray popover actions ────────────────────────────────────────────────────
  ipcMain.handle("tray:deploy", () => {
    if (zoomNameSet === false) {
      trayPopover?.webContents.send("tray:setup-required");
      return;
    }
    if (!hasMeetingDetected()) {
      trayPopover?.webContents.send("tray:no-meeting");
      return;
    }
    trayPopover?.hide();
    sendToMainWindow("shortcut:toggle-call");
  });

  ipcMain.handle("tray:end-call", () => {
    trayPopover?.hide();
    sendToMainWindow("shortcut:toggle-call"); // uses createMainWindow fallback like tray:deploy
  });

  ipcMain.handle("tray:open-dashboard", () => {
    trayPopover?.hide();
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });

  // Resize the tray popover to fit idle (150px) or live (190px) content
  ipcMain.handle("tray:resize", (_event, height: number) => {
    trayPopover?.setSize(240, height);
  });
}

// ─── Global Keyboard Shortcuts ───────────────────────────────────────────────
function setupShortcuts(): void {
  globalShortcut.register("Ctrl+Shift+W", () => {
    // Suppress HUD during onboarding — the activation screen uses this shortcut
    // as an interactive tutorial step; we don't want the HUD interrupting it.
    const currentUrl = mainWindow?.webContents.getURL() ?? "";
    if (currentUrl.includes("/onboarding")) return;

    if (callActive) {
      // Call is running — show "End this call?" confirmation in the HUD
      hudWindow?.webContents.send("hud:end-call-confirm");
    } else {
      // No call active — show HUD, then route based on whether a meeting is detected
      hudWindow?.show();
      hudWindow?.webContents.send(hasMeetingDetected() ? "hud:manual-trigger" : "hud:no-meeting");
    }
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient("wingman");
  }

  // Wingman is a full app — keep the Dock icon visible at all times
  if (process.platform === "darwin" && app.dock) {
    app.dock.show();
  }

  createMainWindow();
  createHudWindow();
  createTrayPopover();
  createTray();
  setupIPC();
  setupShortcuts();
  setupRecallAI(() => {
    // Meeting detected — show the branded Wingman detection toast
    hudWindow?.show();
    hudWindow?.webContents.send("call:detected");
  });

  // Dock icon click on macOS — show the window if it's hidden.
  // Can't use getAllWindows().length === 0 here because a hidden window is still
  // in the list; we check mainWindow directly instead.
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });

  if (app.isPackaged) {
    // .catch() so a failed check (offline, 404, bad feed) can't surface as an
    // unhandled promise rejection. The autoUpdater.on("error") handler does the
    // actual logging; this just keeps the rejection from going unhandled.
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on("second-instance", (_event, commandLine) => {
  const url = commandLine.find((arg) => arg.startsWith("wingman://"));
  if (url) handleDeepLink(url);
  mainWindow?.show();
  mainWindow?.focus();
});

// Set the quit flag BEFORE windows are asked to close so the "close" handler
// in createMainWindow() knows to skip the hide and let Electron exit cleanly.
app.on("before-quit", () => { isQuitting = true; });

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopRecallAI();
});

autoUpdater.on("update-available", () => {
  console.log("[Updater] Update available — downloading");
});
autoUpdater.on("error", (err) => {
  // Never fail silently: a broken update feed (missing zip, signature mismatch,
  // network drop, unpublished/draft release) must leave a trace we can diagnose.
  console.error("[Updater] Update check/download failed:", err?.message ?? err);
});
autoUpdater.on("update-downloaded", () => {
  console.log("[Updater] Update downloaded — prompting user to restart");
  // Use async showMessageBox so the main process is not blocked while the dialog
  // is open — a sync dialog would freeze all IPC (including active call events).
  dialog.showMessageBox({
    type:      "info",
    title:     "Update Ready",
    message:   "Wingman has been updated.",
    detail:    "Restart now to install the latest version.",
    buttons:   ["Restart Now", "Later"],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) {
      // The main-window "close" handler hides (preventDefault) instead of closing
      // unless isQuitting is set. Without this, quitAndInstall() closes the window
      // → it only hides → the process stays alive → Squirrel can't swap the bundle
      // or auto-relaunch (the "had to fully quit 2-3 times" bug). Set the flag first
      // so the window truly closes and the app terminates + relaunches cleanly.
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });
});

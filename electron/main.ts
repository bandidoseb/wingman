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

// ─── Quit guard ───────────────────────────────────────────────────────────────
// We hide the main window instead of destroying it so users can reopen it from
// the tray or dock without relaunching. But app.quit() must still work — this
// flag lets the "close" handler know when a real quit is in progress so it
// skips the hide and lets Electron destroy the window normally.
let isQuitting = false;

// ─── Auto-stop handler ────────────────────────────────────────────────────────
// Called by recall.ts when any of the three safeguards fire (meeting-lost,
// inactivity timeout, or hard cap). Ends the call, notifies both windows,
// then hides the HUD after giving it time to show the reason toast.
function autoStopCall(reason: AutoStopReason): void {
  console.log(`[AutoStop] Reason: ${reason}`);
  callActive = false;
  stopRecallAI();
  hudWindow?.webContents.send("call:ended");
  hudWindow?.webContents.send("hud:auto-stopped", reason);
  trayPopover?.webContents.send("tray:call-state", false);
  // Tell web app the call ended automatically — uses dedicated channel so the
  // web app can patch the session WITHOUT calling endCall() again (avoids double-stop).
  mainWindow?.webContents.send("call:auto-ended");
  // Give the HUD 4 seconds to show the reason toast before hiding
  setTimeout(() => hudWindow?.hide(), 4000);
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
    trafficLightPosition: { x: 18, y: 18 },
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
  ipcMain.handle("call:start", async () => {
    console.log("[IPC] call:start");
    if (!hasMeetingDetected()) {
      return { success: false, error: "no_meeting" };
    }
    callActive = true;
    hudWindow?.show();
    hudWindow?.webContents.send("call:started");
    trayPopover?.webContents.send("tray:call-state", true);
    await initRecallAI({
      onChunk:            (chunk: string) => { mainWindow?.webContents.send("transcript:chunk", chunk); },
      onAutoStop:         autoStopCall,
      onApproachingLimit: () => { hudWindow?.webContents.send("hud:cap-warning"); },
    });
    return { success: true };
  });

  ipcMain.handle("call:end", async () => {
    console.log("[IPC] call:end");
    callActive = false;
    hudWindow?.webContents.send("call:ended");
    trayPopover?.webContents.send("tray:call-state", false);
    stopRecallAI();
    // Small delay so HUD can animate out before hiding
    setTimeout(() => hudWindow?.hide(), 600);
    return { success: true };
  });

  // ── HUD Deploy button → start call via web app toggle ──────────────────────
  ipcMain.handle("hud:deploy-call", () => {
    console.log("[IPC] hud:deploy-call");
    sendToMainWindow("shortcut:toggle-call");
  });

  // ── HUD End Call confirmed → end call via web app toggle ───────────────────
  ipcMain.handle("hud:confirm-end-call", () => {
    console.log("[IPC] hud:confirm-end-call");
    mainWindow?.webContents.send("shortcut:toggle-call");
  });

  // ── HUD visibility ──────────────────────────────────────────────────────────
  ipcMain.handle("hud:show", () => { hudWindow?.show(); });
  ipcMain.handle("hud:hide", () => { hudWindow?.hide(); });

  // ── Detection toast dismissed — hide HUD (call never started) ──────────────
  ipcMain.handle("hud:dismiss-detection", () => { hudWindow?.hide(); });

  // ── Signal → HUD ───────────────────────────────────────────────────────────
  ipcMain.handle("hud:signal", (_event, signal: { header: string; text: string; type: string }) => {
    hudWindow?.webContents.send("hud:update-signal", signal);
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
    autoUpdater.checkForUpdatesAndNotify();
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
autoUpdater.on("update-downloaded", () => {
  console.log("[Updater] Update downloaded — prompting user to restart");
  const response = dialog.showMessageBoxSync({
    type:      "info",
    title:     "Update Ready",
    message:   "Wingman has been updated.",
    detail:    "Restart now to install the latest version.",
    buttons:   ["Restart Now", "Later"],
    defaultId: 0,
  });
  if (response === 0) autoUpdater.quitAndInstall();
});

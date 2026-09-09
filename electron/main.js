const { app, BrowserWindow, dialog, session, Menu, protocol, net, ipcMain, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const isDev = !app.isPackaged && !!process.env.ELECTRON_START_URL;
const distDir = path.join(__dirname, "..", "dist");
const APP_SCHEME = "wealthos-app";
const APP_ORIGIN = `${APP_SCHEME}://local/`;

/**
 * The Expo web export uses absolute root paths (`/favicon.ico`,
 * `/_expo/...`) that only resolve against a real origin — and that origin
 * must be IDENTICAL on every launch, because `localStorage` (which is what
 * all of WealthOS's financial data lives in on desktop) is scoped per
 * origin, port included. A random port per launch would silently start a
 * fresh, empty storage bucket every time the app opens. A custom protocol
 * has a fixed origin with no port at all, so this can never happen.
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const requestUrl = new URL(request.url);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";

    const filePath = path.join(distDir, pathname);
    if (!filePath.startsWith(distDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    const response = await net.fetch(pathToFileURL(filePath).toString());
    if (response.ok) return response;

    return net.fetch(pathToFileURL(path.join(distDir, "index.html")).toString());
  });
}

app.setAppUserModelId("com.wealthos.app");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

const CONSOLE_LEVELS = ["log", "warning", "error"];

/**
 * Renderer console output is otherwise invisible once the app is packaged —
 * there is no DevTools shortcut exposed to the user. Warnings and errors are
 * appended to a small log file so a real bug leaves a trace to inspect
 * instead of vanishing silently.
 */
function attachRendererLogging(win) {
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, "renderer.log");

  win.webContents.on("console-message", (event) => {
    // Electron's `console-message` event carries level/message/line/sourceId
    // as properties on a single Event object, not as separate positional
    // arguments — a 5-arg `(event, level, message, line, sourceId)` listener
    // silently receives `level=undefined` here and never actually logs.
    const { level, message, lineNumber, sourceId } = event;
    if (level < 1) return; // 0 = verbose/log, skip — only warnings (1) and errors (2)
    const entry = `[${new Date().toISOString()}] ${CONSOLE_LEVELS[level] ?? level}: ${message} (${sourceId}:${lineNumber})\n`;
    fs.appendFile(logPath, entry, () => {});
  });

  win.webContents.on("render-process-gone", (event, details) => {
    fs.appendFile(logPath, `[${new Date().toISOString()}] render-process-gone: ${details.reason}\n`, () => {});
  });

  // A silent preload failure or a failed initial page load would otherwise
  // leave the renderer running with no bridge to the main process and no
  // trace of why — these two are worth keeping permanently, unlike the
  // request-level tracing used during this investigation.
  win.webContents.on("preload-error", (event, preloadPath, error) => {
    fs.appendFile(logPath, `[${new Date().toISOString()}] preload-error at ${preloadPath}: ${error?.stack || error}\n`, () => {});
  });

  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    fs.appendFile(logPath, `[${new Date().toISOString()}] did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}\n`, () => {});
  });
}

/**
 * API keys for market-data providers are the only "secrets" WealthOS ever
 * holds. They live in their own encrypted file — never in the AsyncStorage/
 * localStorage data the export feature reads — so a backup can never leak
 * them, by construction rather than by remembering to filter them out.
 * `safeStorage` encrypts with the OS credential store (DPAPI on Windows).
 */
const secureStoragePath = () => path.join(app.getPath("userData"), "secure-keys.json");

function readSecureStoreFile() {
  try {
    return JSON.parse(fs.readFileSync(secureStoragePath(), "utf8"));
  } catch {
    return {};
  }
}

function writeSecureStoreFile(data) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(secureStoragePath(), JSON.stringify(data), "utf8");
}

function registerSecureStorageHandlers() {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  ipcMain.handle("secure-storage:get", (event, key) => {
    if (typeof key !== "string") return null;
    const store = readSecureStoreFile();
    const encoded = store[key];
    if (!encoded) return null;
    try {
      const buffer = Buffer.from(encoded, "base64");
      return encryptionAvailable ? safeStorage.decryptString(buffer) : buffer.toString("utf8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("secure-storage:set", (event, key, value) => {
    if (typeof key !== "string" || typeof value !== "string") return false;
    const store = readSecureStoreFile();
    const buffer = encryptionAvailable ? safeStorage.encryptString(value) : Buffer.from(value, "utf8");
    store[key] = buffer.toString("base64");
    writeSecureStoreFile(store);
    return true;
  });

  ipcMain.handle("secure-storage:delete", (event, key) => {
    if (typeof key !== "string") return false;
    const store = readSecureStoreFile();
    delete store[key];
    writeSecureStoreFile(store);
    return true;
  });
}

/**
 * WealthOS has no feature today that opens an external link or navigates
 * away from its own origin — but nothing enforced that at the Electron
 * level either. This denies any `window.open()`/target=_blank popup outright
 * and blocks in-window navigation to anything other than the app's own
 * origin, so a future feature (e.g. a clickable company-website field)
 * can't accidentally hand external content a full, unrestricted
 * BrowserWindow. Same-origin navigation (the app's own routing) is
 * untouched — Expo Router's client-side navigation never triggers Electron
 * `will-navigate` in the first place, since it's in-page History API
 * routing, not a real page load.
 */
function attachNavigationGuard(win, allowedOrigin) {
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== allowedOrigin) {
      event.preventDefault();
    }
  });
}

/**
 * F11 and Ctrl+Shift+F toggle fullscreen; Escape exits it. The app has no
 * visible menu bar (`autoHideMenuBar` + no application menu), so there is no
 * other discoverable way to reach fullscreen — this is the only entry point.
 */
function attachFullScreenShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11" || (input.key.toLowerCase() === "f" && input.control && input.shift)) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if ((input.key === "Escape" || input.code === "Escape") && win.isFullScreen()) {
      win.setFullScreen(false);
      event.preventDefault();
    }
  });
}

function createWindow(startUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: "#F7F7F5",
    title: "WealthOS",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // No maximum size: earlier builds capped this window at 600×1100, which
  // made the desktop app permanently phone-sized regardless of the actual
  // window size — maximizing or resizing wider had no visual effect at all.
  Menu.setApplicationMenu(null);
  win.loadURL(startUrl);
  attachRendererLogging(win);
  attachNavigationGuard(win, new URL(startUrl).origin);
  attachFullScreenShortcuts(win);

  return win;
}

/**
 * WealthOS export triggers a plain browser download (Blob + `<a download>`).
 * Without this handler Electron silently saves it straight to the Downloads
 * folder; intercepting `will-download` gives the user a real native
 * "Opslaan als" dialog instead, matching how backups should feel on desktop.
 */
function attachDownloadHandler(win) {
  session.defaultSession.on("will-download", (event, item) => {
    const savePath = dialog.showSaveDialogSync(win, {
      title: "WealthOS-back-up opslaan",
      defaultPath: item.getFilename(),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (savePath) {
      item.setSavePath(savePath);
    } else {
      item.cancel();
    }
  });
}

/**
 * `app.quit()` (called above when `gotLock` is false) does NOT synchronously
 * prevent an already-in-flight `app.whenReady()` promise from resolving —
 * Electron resolves it once the engine itself is ready, independent of a
 * pending quit. A losing instance whose `.then()` callback isn't gated on
 * `gotLock` will still create a full second window and its own renderer,
 * which reads/writes the exact same userData/localStorage as the winning
 * instance — not a different storage location, but a second, spurious
 * window whose own fresh render can visibly race the real one (e.g. showing
 * an empty profile list for a moment) while the winning instance's
 * `second-instance` handler is trying to refocus the real one. Everything
 * below must only ever run in the process that actually holds the lock.
 */
if (gotLock) {
  app.whenReady().then(() => {
    if (!isDev) {
      registerAppProtocol();
    }

    registerSecureStorageHandlers();

    const startUrl = isDev ? process.env.ELECTRON_START_URL : APP_ORIGIN;
    const win = createWindow(startUrl);
    attachDownloadHandler(win);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(startUrl);
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

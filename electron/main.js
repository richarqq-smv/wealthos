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

  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    if (level < 1) return; // 0 = verbose/log, skip — only warnings (1) and errors (2)
    const entry = `[${new Date().toISOString()}] ${CONSOLE_LEVELS[level] ?? level}: ${message} (${sourceId}:${line})\n`;
    fs.appendFile(logPath, entry, () => {});
  });

  win.webContents.on("render-process-gone", (event, details) => {
    fs.appendFile(logPath, `[${new Date().toISOString()}] render-process-gone: ${details.reason}\n`, () => {});
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

function createWindow(startUrl) {
  const win = new BrowserWindow({
    width: 480,
    height: 860,
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

  win.setMaximumSize(600, 1100);
  Menu.setApplicationMenu(null);
  win.loadURL(startUrl);
  attachRendererLogging(win);
  attachNavigationGuard(win, new URL(startUrl).origin);

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

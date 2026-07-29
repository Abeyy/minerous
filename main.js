const { app, BrowserWindow, ipcMain, safeStorage, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const { autoUpdater } = require('electron-updater');

const saveFilePath = () => path.join(app.getPath('userData'), 'save.json');
const sessionFilePath = () => path.join(app.getPath('userData'), 'session.dat');

ipcMain.handle('local-save', (event, json) => {
  fs.writeFileSync(saveFilePath(), json, 'utf-8');
  return true;
});

ipcMain.handle('local-load', () => {
  try {
    return fs.readFileSync(saveFilePath(), 'utf-8');
  } catch (err) {
    return null;
  }
});

// Fire-and-forget variant used on window unload, where there's no time to await a promise.
ipcMain.on('local-save-sync', (event, json) => {
  try {
    fs.writeFileSync(saveFilePath(), json, 'utf-8');
  } catch (err) {
    // best effort — nothing to do if this fails during shutdown
  }
});

// A tiny encrypted-at-rest key/value store, used by supabase-js to persist the auth session
// (its default storage assumes a browser's localStorage, which doesn't exist in the main process).
function readSessionStore() {
  try {
    const raw = fs.readFileSync(sessionFilePath());
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf-8');
    return JSON.parse(json);
  } catch (err) {
    return {};
  }
}

function writeSessionStore(store) {
  const json = JSON.stringify(store);
  const out = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : Buffer.from(json, 'utf-8');
  fs.writeFileSync(sessionFilePath(), out);
}

const authStorage = {
  getItem: (key) => readSessionStore()[key] ?? null,
  setItem: (key, value) => {
    const store = readSessionStore();
    store[key] = value;
    writeSessionStore(store);
  },
  removeItem: (key) => {
    const store = readSessionStore();
    delete store[key];
    writeSessionStore(store);
  },
};

let supabase = null;
try {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'supabase.config.json'), 'utf-8'));
  supabase = createClient(config.url, config.anonKey, {
    auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
} catch (err) {
  console.error('Supabase not configured — cloud sync disabled:', err.message);
}

function toSessionSummary(session) {
  return session ? { userId: session.user.id, email: session.user.email } : null;
}

ipcMain.handle('auth-sign-up', async (event, { email, password }) => {
  if (!supabase) return { error: 'Cloud sync is not configured.' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { session: toSessionSummary(data && data.session), error: error ? error.message : null };
});

ipcMain.handle('auth-sign-in', async (event, { email, password }) => {
  if (!supabase) return { error: 'Cloud sync is not configured.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { session: toSessionSummary(data && data.session), error: error ? error.message : null };
});

ipcMain.handle('auth-sign-out', async () => {
  if (!supabase) return { error: 'Cloud sync is not configured.' };
  const { error } = await supabase.auth.signOut();
  return { error: error ? error.message : null };
});

ipcMain.handle('auth-get-session', async () => {
  if (!supabase) return { session: null, error: 'Cloud sync is not configured.' };
  const { data, error } = await supabase.auth.getSession();
  return { session: toSessionSummary(data && data.session), error: error ? error.message : null };
});

ipcMain.handle('cloud-push-save', async (event, dataJson) => {
  if (!supabase) return { error: 'Cloud sync is not configured.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData && sessionData.session && sessionData.session.user;
  if (!user) return { error: 'Not signed in.' };
  const { error } = await supabase
    .from('saves')
    .upsert({ user_id: user.id, data: JSON.parse(dataJson), updated_at: new Date().toISOString() });
  return { error: error ? error.message : null };
});

ipcMain.handle('cloud-pull-save', async () => {
  if (!supabase) return { data: null, error: 'Cloud sync is not configured.' };
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData && sessionData.session && sessionData.session.user;
  if (!user) return { data: null, error: 'Not signed in.' };
  const { data, error } = await supabase.from('saves').select('data, updated_at').eq('user_id', user.id).maybeSingle();
  return { data: data || null, error: error ? error.message : null };
});

// ---------------------------------------------------------------------------
// Auto-update, backed by GitHub Releases.
//
// The new build downloads in the background and is only swapped in when the player
// says so (or on next quit) — an idle game shouldn't restart itself out from under
// someone mid-boss-fight. Every state change is forwarded to the renderer so the UI
// can show progress rather than updating invisibly.
// ---------------------------------------------------------------------------
let updaterWindow = null;

function sendUpdateStatus(status, payload = {}) {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send('update-status', { status, ...payload });
  }
}

function setUpUpdater(win) {
  updaterWindow = win;

  // In development there's no packaged app to replace, and electron-updater throws
  // rather than no-oping. Report that plainly instead of surfacing a scary error.
  // Deferred like every other status: the renderer isn't listening until it loads.
  if (!app.isPackaged) {
    win.webContents.once('did-finish-load', () =>
      sendUpdateStatus('disabled', { reason: 'Updates only run in an installed build.' })
    );
    return;
  }

  autoUpdater.autoDownload = true;
  // Applied on the next quit if the player never clicks "Restart now".
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
  autoUpdater.on('update-not-available', () => sendUpdateStatus('current'));
  autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { version: info.version }));
  autoUpdater.on('download-progress', (p) => sendUpdateStatus('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('ready', { version: info.version }));
  autoUpdater.on('error', (err) => sendUpdateStatus('error', { message: String((err && err.message) || err) }));

  // Give the window a moment to finish booting before the first check, so an early
  // status message isn't sent into a renderer that isn't listening yet.
  win.webContents.once('did-finish-load', () => {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
  });
}

ipcMain.handle('update-check', async () => {
  if (!app.isPackaged) return { ok: false, error: 'Updates only run in an installed build.' };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

ipcMain.handle('update-install', () => {
  // Quit and swap in the downloaded build. The renderer saves synchronously before
  // calling this, so nothing in flight is lost.
  setImmediate(() => autoUpdater.quitAndInstall());
  return true;
});

ipcMain.handle('app-version', () => app.getVersion());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#14181f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  setUpUpdater(win);
}

app.whenReady().then(async () => {
  // Chromium caches file:// scripts between launches, so a freshly updated build can
  // boot running yesterday's game code. Clearing on startup keeps what you see on
  // screen honest about what's actually on disk.
  await session.defaultSession.clearCache();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

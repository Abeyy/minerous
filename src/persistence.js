window.Minerous = window.Minerous || {};

(function () {
  const { state } = window.Minerous;
  const AUTOSAVE_INTERVAL_MS = 10000;

  // `screen` is deliberately excluded — the app always boots to Home, and syncing
  // it would make a cloud pull yank you to whatever screen another device was on.
  function serialize() {
    const { screen, ...rest } = state;
    return JSON.stringify(rest);
  }

  // Items that were renamed after release. Without this, a save holding the old id
  // would silently lose the item — getItem() returns null for unknown ids, so it just
  // stops rendering. Applied on load so existing saves carry the item across.
  const RENAMED_ITEMS = { monk_staff: 'monk_gauntlets' };

  function migrateRenamedItems() {
    for (const [oldId, newId] of Object.entries(RENAMED_ITEMS)) {
      const count = state.inventory[oldId];
      if (count) {
        state.inventory[newId] = (state.inventory[newId] || 0) + count;
        delete state.inventory[oldId];
      }
      if (state.equippedWeaponId === oldId) state.equippedWeaponId = newId;
    }
  }

  // A plain Object.assign(state, saved) would wholesale-replace nested objects
  // (e.g. state.quests) with whatever an older save has, silently dropping any
  // fields added to the defaults since — merge one level deep instead so a save
  // from before a field existed doesn't erase it.
  function applySaved(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const [key, value] of Object.entries(saved)) {
      const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
      if (isPlainObject(value) && isPlainObject(state[key])) {
        Object.assign(state[key], value);
      } else {
        state[key] = value;
      }
    }
    migrateRenamedItems();
  }

  async function saveNow() {
    if (!window.minerousAPI) return;
    try {
      await window.minerousAPI.local.save(serialize());
    } catch (err) {
      console.error('Local save failed', err);
    }
    if (window.Minerous.Account && window.Minerous.Account.isSignedIn()) {
      try {
        await window.minerousAPI.cloud.pushSave(serialize());
      } catch (err) {
        console.error('Cloud push failed', err);
      }
    }
  }

  async function loadOnBoot() {
    if (!window.minerousAPI) return;
    try {
      const raw = await window.minerousAPI.local.load();
      if (raw) applySaved(JSON.parse(raw));
    } catch (err) {
      console.error('Local load failed', err);
    }
  }

  async function pushToCloud() {
    if (!window.minerousAPI) return { error: 'Not running in Electron.' };
    try {
      return await window.minerousAPI.cloud.pushSave(serialize());
    } catch (err) {
      return { error: err.message };
    }
  }

  window.Minerous.Persistence = {
    saveNow,
    loadOnBoot,
    pushToCloud,
    applyCloudSave: applySaved,
    // Synchronous flush for paths that end the process without an unload event —
    // installing an update quits the app outright.
    saveBeforeQuit() {
      if (window.minerousAPI) window.minerousAPI.local.saveSync(serialize());
    },
  };

  setInterval(saveNow, AUTOSAVE_INTERVAL_MS);

  window.addEventListener('beforeunload', () => {
    if (window.minerousAPI) window.minerousAPI.local.saveSync(serialize());
  });
})();

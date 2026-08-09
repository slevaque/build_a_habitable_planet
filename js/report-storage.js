(function (App) {
  "use strict";

  const STORAGE_KEY = "build-a-habitable-planet.phase4.report.v1";

  function resolveStorage(storageOverride) {
    try {
      const storage = storageOverride === undefined ? window.localStorage : storageOverride;
      if (!storage) return null;
      const testKey = `${STORAGE_KEY}.test`;
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function createStore(storageOverride) {
    let storage = resolveStorage(storageOverride);
    let persistent = Boolean(storage);
    let draft = App.reportRecords.initialDraft();

    if (storage) {
      try {
        const saved = storage.getItem(STORAGE_KEY);
        if (saved) draft = App.reportRecords.normalizeDraft(JSON.parse(saved));
      } catch (error) {
        draft = App.reportRecords.initialDraft();
      }
    }

    function persist() {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(draft));
        return true;
      } catch (error) {
        storage = null;
        persistent = false;
        return false;
      }
    }

    function update(patch) {
      draft = App.reportRecords.updateDraft(draft, patch);
      persist();
      return draft;
    }

    function clear() {
      const hadContent = JSON.stringify(draft) !== JSON.stringify(App.reportRecords.initialDraft());
      draft = App.reportRecords.initialDraft();
      if (storage) {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch (error) {
          storage = null;
          persistent = false;
        }
      }
      return hadContent;
    }

    return Object.freeze({
      getDraft: () => draft,
      update,
      clear,
      storageInfo: () => Object.freeze({
        persistent,
        message: persistent
          ? "Report selections and writing are saved in this browser on this device."
          : "Browser storage is unavailable. This report draft will last only until this page is closed.",
      }),
    });
  }

  App.reportStorage = Object.freeze({ STORAGE_KEY, createStore });
})(window.HabitablePlanet = window.HabitablePlanet || {});

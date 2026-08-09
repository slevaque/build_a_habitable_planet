(function (App) {
  "use strict";

  const STORAGE_KEY = "build-a-habitable-planet.phase3.experiments.v1";

  function initialState() {
    return App.experimentRecords.deepFreeze({
      schemaVersion: App.experimentRecords.SCHEMA_VERSION,
      nextSnapshotSequence: 1,
      nextDiscoverySequence: 1,
      snapshots: [],
      discoveries: [],
    });
  }

  function maximumOrder(records) {
    return records.reduce((highest, record) => Math.max(highest, record.creationOrder || 0), 0);
  }

  function normalizeState(candidate) {
    if (!candidate || candidate.schemaVersion !== App.experimentRecords.SCHEMA_VERSION) {
      return initialState();
    }
    const snapshots = Array.isArray(candidate.snapshots)
      ? candidate.snapshots.filter(App.experimentRecords.isSnapshotRecord).slice(0, App.experimentRecords.SNAPSHOT_LIMIT)
      : [];
    const discoveries = Array.isArray(candidate.discoveries)
      ? candidate.discoveries.filter(App.experimentRecords.isDiscoveryRecord)
      : [];
    return App.experimentRecords.deepFreeze({
      schemaVersion: App.experimentRecords.SCHEMA_VERSION,
      nextSnapshotSequence: Math.max(Number(candidate.nextSnapshotSequence) || 1, maximumOrder(snapshots) + 1),
      nextDiscoverySequence: Math.max(Number(candidate.nextDiscoverySequence) || 1, maximumOrder(discoveries) + 1),
      snapshots: App.experimentRecords.freezeCopy(snapshots),
      discoveries: App.experimentRecords.freezeCopy(discoveries),
    });
  }

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
    let state = initialState();

    if (storage) {
      try {
        const saved = storage.getItem(STORAGE_KEY);
        if (saved) state = normalizeState(JSON.parse(saved));
      } catch (error) {
        state = initialState();
      }
    }

    function persist() {
      if (!storage) return false;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (error) {
        storage = null;
        persistent = false;
        return false;
      }
    }

    function replace(nextState) {
      state = App.experimentRecords.deepFreeze(nextState);
      persist();
      return state;
    }

    function createSnapshot(planetState, lifeResults, draft) {
      if (state.snapshots.length >= App.experimentRecords.SNAPSHOT_LIMIT) {
        return Object.freeze({ ok: false, reason: "limit", state });
      }
      const record = App.experimentRecords.createSnapshot(
        state.nextSnapshotSequence,
        planetState,
        lifeResults,
        draft
      );
      replace({
        ...state,
        nextSnapshotSequence: state.nextSnapshotSequence + 1,
        snapshots: Object.freeze([...state.snapshots, record]),
      });
      return Object.freeze({ ok: true, record, state });
    }

    function editSnapshot(id, fields) {
      let edited = null;
      const snapshots = state.snapshots.map((snapshot) => {
        if (snapshot.id !== id) return snapshot;
        edited = App.experimentRecords.editSnapshot(snapshot, fields);
        return edited;
      });
      if (!edited) return Object.freeze({ ok: false, reason: "missing", state });
      replace({ ...state, snapshots: Object.freeze(snapshots) });
      return Object.freeze({ ok: true, record: edited, state });
    }

    function deleteSnapshot(id) {
      const snapshots = state.snapshots.filter((snapshot) => snapshot.id !== id);
      if (snapshots.length === state.snapshots.length) return false;
      replace({ ...state, snapshots: Object.freeze(snapshots) });
      return true;
    }

    function clearSnapshots() {
      if (state.snapshots.length === 0) return false;
      replace({ ...state, snapshots: Object.freeze([]) });
      return true;
    }

    function createDiscovery(suggestion, fields) {
      const record = App.experimentRecords.createDiscovery(
        state.nextDiscoverySequence,
        suggestion,
        fields
      );
      replace({
        ...state,
        nextDiscoverySequence: state.nextDiscoverySequence + 1,
        discoveries: Object.freeze([...state.discoveries, record]),
      });
      return record;
    }

    function clearDiscoveries() {
      if (state.discoveries.length === 0) return false;
      replace({ ...state, discoveries: Object.freeze([]) });
      return true;
    }

    return Object.freeze({
      getState: () => state,
      storageInfo: () => Object.freeze({
        persistent,
        message: persistent
          ? "Snapshots and discoveries are saved in this browser on this device."
          : "Browser storage is unavailable. Records will last only until this page is closed.",
      }),
      createSnapshot,
      editSnapshot,
      deleteSnapshot,
      clearSnapshots,
      createDiscovery,
      clearDiscoveries,
    });
  }

  App.experimentStorage = Object.freeze({ STORAGE_KEY, createStore, normalizeState });
})(window.HabitablePlanet = window.HabitablePlanet || {});

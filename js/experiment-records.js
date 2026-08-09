(function (App) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const SNAPSHOT_LIMIT = 5;

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function freezeCopy(value) {
    return deepFreeze(JSON.parse(JSON.stringify(value)));
  }

  function cleanText(value, fallback, maximumLength) {
    const cleaned = String(value == null ? "" : value).trim().slice(0, maximumLength);
    return cleaned || fallback;
  }

  function createSnapshot(sequence, planetState, lifeResults, draft = {}, now = new Date()) {
    if (!planetState || !planetState.inputs || !planetState.physics || !planetState.climate) {
      throw new Error("A completed Planet State is required to create a snapshot.");
    }
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      id: `snapshot-${sequence}`,
      creationOrder: sequence,
      createdAt: now.toISOString(),
      name: cleanText(draft.name, `Snapshot ${sequence}`, 40),
      note: cleanText(draft.note, "", 240),
      physical: {
        engine: planetState.meta && planetState.meta.engine
          ? planetState.meta.engine
          : "Phase 1 / Climate Version 4",
        planetState: freezeCopy(planetState),
      },
      biological: {
        ruleset: "Phase 2 accepted Life Compatibility rules",
        interpretations: freezeCopy(lifeResults || []),
      },
    });
  }

  function editSnapshot(snapshot, fields = {}) {
    return deepFreeze({
      ...snapshot,
      name: cleanText(fields.name, snapshot.name, 40),
      note: cleanText(fields.note, "", 240),
    });
  }

  function createDiscovery(sequence, suggestion, fields = {}, now = new Date()) {
    if (!suggestion || !suggestion.source) {
      throw new Error("A modeled suggestion or student-note source is required.");
    }
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      id: `discovery-${sequence}`,
      creationOrder: sequence,
      createdAt: now.toISOString(),
      title: cleanText(fields.title, suggestion.title || `Discovery ${sequence}`, 80),
      category: cleanText(suggestion.category, "Scientific Investigation", 48),
      source: suggestion.source,
      relatedSnapshotIds: freezeCopy(suggestion.relatedSnapshotIds || []),
      relatedSnapshotLabels: freezeCopy(suggestion.relatedSnapshotLabels || []),
      studentAction: cleanText(suggestion.studentAction, "Student recorded a scientific observation.", 280),
      modeledEvidence: freezeCopy(suggestion.modeledEvidence || []),
      causalChain: freezeCopy(suggestion.causalChain || []),
      note: cleanText(fields.note, "", 400),
    });
  }

  function isSnapshotRecord(value) {
    return Boolean(
      value
      && value.schemaVersion === SCHEMA_VERSION
      && typeof value.id === "string"
      && Number.isInteger(value.creationOrder)
      && value.physical
      && value.physical.planetState
      && value.physical.planetState.inputs
      && value.physical.planetState.physics
      && value.physical.planetState.climate
      && value.biological
      && Array.isArray(value.biological.interpretations)
    );
  }

  function isDiscoveryRecord(value) {
    return Boolean(
      value
      && value.schemaVersion === SCHEMA_VERSION
      && typeof value.id === "string"
      && Number.isInteger(value.creationOrder)
      && typeof value.title === "string"
      && typeof value.source === "string"
      && Array.isArray(value.modeledEvidence)
      && Array.isArray(value.causalChain)
    );
  }

  App.experimentRecords = Object.freeze({
    SCHEMA_VERSION,
    SNAPSHOT_LIMIT,
    deepFreeze,
    freezeCopy,
    createSnapshot,
    editSnapshot,
    createDiscovery,
    isSnapshotRecord,
    isDiscoveryRecord,
  });
})(window.HabitablePlanet = window.HabitablePlanet || {});

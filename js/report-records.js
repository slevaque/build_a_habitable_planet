(function (App) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const LIFE_CATEGORY_IDS = Object.freeze(["extremophile", "microbial", "photosynthetic", "aquatic", "terrestrial", "human"]);
  const WRITING_LIMITS = Object.freeze({
    environmentalSummary: 900,
    lifeCompatibility: 900,
    majorLimitation: 700,
    scientificEvidence: 900,
    uncertainty: 700,
    finalConclusion: 1600,
  });

  function boundedText(value, maximumLength) {
    return String(value == null ? "" : value).slice(0, maximumLength);
  }

  function uniqueStrings(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
  }

  function emptyWriting() {
    return Object.freeze(Object.fromEntries(Object.keys(WRITING_LIMITS).map((key) => [key, ""])));
  }

  function initialDraft() {
    return App.experimentRecords.deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      subjectSnapshotId: null,
      lastKnownSubjectLabel: "",
      selectedPhysicalEvidenceIds: [],
      expandedLifeCategoryIds: [],
      selectedExperimentSnapshotIds: [],
      comparison: null,
      selectedDiscoveryIds: [],
      writing: emptyWriting(),
      updatedAt: null,
    });
  }

  function normalizeComparison(value) {
    if (!value || typeof value !== "object") return null;
    const snapshotAId = typeof value.snapshotAId === "string" ? value.snapshotAId : "";
    const snapshotBId = typeof value.snapshotBId === "string" ? value.snapshotBId : "";
    if (!snapshotAId || !snapshotBId || snapshotAId === snapshotBId) return null;
    return Object.freeze({
      snapshotAId,
      snapshotBId,
      lifeCategoryId: LIFE_CATEGORY_IDS.includes(value.lifeCategoryId)
        ? value.lifeCategoryId
        : "microbial",
    });
  }

  function normalizeDraft(candidate) {
    if (!candidate || candidate.schemaVersion !== SCHEMA_VERSION) return initialDraft();
    const writingCandidate = candidate.writing && typeof candidate.writing === "object"
      ? candidate.writing
      : {};
    const writing = {};
    Object.entries(WRITING_LIMITS).forEach(([key, limit]) => {
      writing[key] = boundedText(writingCandidate[key], limit);
    });
    return App.experimentRecords.deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      subjectSnapshotId: typeof candidate.subjectSnapshotId === "string" && candidate.subjectSnapshotId
        ? candidate.subjectSnapshotId
        : null,
      lastKnownSubjectLabel: boundedText(candidate.lastKnownSubjectLabel, 40),
      selectedPhysicalEvidenceIds: uniqueStrings(candidate.selectedPhysicalEvidenceIds),
      expandedLifeCategoryIds: uniqueStrings(candidate.expandedLifeCategoryIds),
      selectedExperimentSnapshotIds: uniqueStrings(candidate.selectedExperimentSnapshotIds),
      comparison: normalizeComparison(candidate.comparison),
      selectedDiscoveryIds: uniqueStrings(candidate.selectedDiscoveryIds),
      writing,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    });
  }

  function updateDraft(current, patch = {}, now = new Date()) {
    const merged = {
      ...current,
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      writing: patch.writing ? { ...current.writing, ...patch.writing } : current.writing,
      updatedAt: now.toISOString(),
    };
    return normalizeDraft(merged);
  }

  App.reportRecords = Object.freeze({
    SCHEMA_VERSION,
    LIFE_CATEGORY_IDS,
    WRITING_LIMITS,
    initialDraft,
    normalizeDraft,
    updateDraft,
  });
})(window.HabitablePlanet = window.HabitablePlanet || {});

(function (App) {
  "use strict";

  const results = [];

  function test(name, predicate, evidence) {
    let passed = false;
    let detail = "";
    try {
      passed = Boolean(typeof predicate === "function" ? predicate() : predicate);
      detail = typeof evidence === "function" ? evidence() : evidence;
    } catch (error) {
      detail = error.message;
    }
    results.push({ name, passed, detail: String(detail || "") });
  }

  function memoryStorage(seed = {}, failWrites = false) {
    const values = new Map(Object.entries(seed));
    return {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => {
        if (failWrites) throw new Error("storage unavailable");
        values.set(key, String(value));
      },
      removeItem: (key) => values.delete(key),
      dump: () => Object.fromEntries(values),
    };
  }

  function snapshot(sequence, state, name) {
    return App.experimentRecords.createSnapshot(
      sequence,
      state,
      App.life.interpretAll(state),
      { name, note: `Investigation ${sequence}` },
      new Date(`2026-08-${String(sequence).padStart(2, "0")}T12:00:00Z`)
    );
  }

  function draftWith(patch) {
    return App.reportRecords.updateDraft(App.reportRecords.initialDraft(), patch, new Date("2026-08-09T12:00:00Z"));
  }

  function hasForbiddenKey(value) {
    const forbidden = /^(score|points?|rank|ranking|grade|weight|significance|probability|classification)$/i;
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, child]) => forbidden.test(key) || hasForbiddenKey(child));
  }

  const earth = App.simulatePlanet(App.CONSTANTS.earthInputs);
  const warmer = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, orbitalDistance: 0.95 });
  const earthSnapshot = snapshot(1, earth, "Earth Reference");
  const warmerSnapshot = snapshot(2, warmer, "Closer Orbit");
  const comparison = App.comparison.compare(earthSnapshot, warmerSnapshot, "microbial");
  const discovery = App.experimentRecords.createDiscovery(1, comparison.suggestions[0], {
    title: "Orbit and climate",
    note: "One input was isolated.",
  }, new Date("2026-08-09T13:00:00Z"));
  const experimentState = App.experimentRecords.deepFreeze({
    schemaVersion: App.experimentRecords.SCHEMA_VERSION,
    nextSnapshotSequence: 3,
    nextDiscoverySequence: 2,
    snapshots: [earthSnapshot, warmerSnapshot],
    discoveries: [discovery],
  });

  const initial = App.reportRecords.initialDraft();
  test("A new report has the current schema version", initial.schemaVersion === 1, `schema ${initial.schemaVersion}`);
  test("A new report has no automatically chosen subject", initial.subjectSnapshotId === null, "subjectSnapshotId is null");
  test("A new report selects no evidence automatically", initial.selectedPhysicalEvidenceIds.length === 0 && initial.selectedExperimentSnapshotIds.length === 0 && initial.selectedDiscoveryIds.length === 0, "All selection lists are empty");
  test("A new report includes all six student writing fields", Object.keys(initial.writing).length === 6, () => Object.keys(initial.writing).join(", "));
  test("A report draft is deeply immutable", Object.isFrozen(initial) && Object.isFrozen(initial.writing) && Object.isFrozen(initial.selectedPhysicalEvidenceIds), "Draft, writing, and selection array are frozen");

  const normalized = App.reportRecords.normalizeDraft({
    ...initial,
    selectedPhysicalEvidenceIds: ["gravity", "gravity", 4, ""],
    writing: { finalConclusion: "x".repeat(2000) },
  });
  test("Normalization removes duplicate and invalid selection identifiers", normalized.selectedPhysicalEvidenceIds.length === 1 && normalized.selectedPhysicalEvidenceIds[0] === "gravity", normalized.selectedPhysicalEvidenceIds.join(", "));
  test("Student writing is bounded at documented field limits", normalized.writing.finalConclusion.length === App.reportRecords.WRITING_LIMITS.finalConclusion, `${normalized.writing.finalConclusion.length} characters`);
  test("Invalid or same-snapshot comparisons normalize to no comparison", App.reportRecords.normalizeDraft({ ...initial, comparison: { snapshotAId: "a", snapshotBId: "a" } }).comparison === null, "Invalid pair rejected");
  test("Unknown Life category references fall back deterministically", App.reportRecords.normalizeDraft({ ...initial, comparison: { snapshotAId: "a", snapshotBId: "b", lifeCategoryId: "invented" } }).comparison.lifeCategoryId === "microbial", "Fallback is General Microbial Life");
  const updated = App.reportRecords.updateDraft(initial, { writing: { finalConclusion: "Student words" } }, new Date("2026-08-09T14:00:00Z"));
  test("A partial writing update preserves every other writing field", updated.writing.finalConclusion === "Student words" && updated.writing.uncertainty === "", "Only final conclusion changed");
  test("Draft updates receive an ISO timestamp", updated.updatedAt === "2026-08-09T14:00:00.000Z", updated.updatedAt);
  test("Updating a report does not mutate the prior draft", initial.writing.finalConclusion === "" && initial.updatedAt === null, "Initial draft remains empty");
  test("Older or unknown report schemas reset safely", App.reportRecords.normalizeDraft({ ...initial, schemaVersion: 99, subjectSnapshotId: earthSnapshot.id }).subjectSnapshotId === null, "Unknown schema discarded");

  const storage = memoryStorage({ experimentData: "preserve-me" });
  const store = App.reportStorage.createStore(storage);
  store.update({ subjectSnapshotId: earthSnapshot.id, lastKnownSubjectLabel: earthSnapshot.name, writing: { finalConclusion: "Evidence-based conclusion" } });
  test("Report state persists under its isolated Phase 4 key", Boolean(storage.getItem(App.reportStorage.STORAGE_KEY)), App.reportStorage.STORAGE_KEY);
  test("A persisted report reloads without recomputing content", App.reportStorage.createStore(storage).getDraft().writing.finalConclusion === "Evidence-based conclusion", "Student words reloaded exactly");
  test("Persistent browser storage is disclosed", store.storageInfo().persistent && /saved in this browser/.test(store.storageInfo().message), store.storageInfo().message);
  const sessionStore = App.reportStorage.createStore(null);
  sessionStore.update({ writing: { finalConclusion: "session text" } });
  test("Storage failure retains a session-only working draft", !sessionStore.storageInfo().persistent && sessionStore.getDraft().writing.finalConclusion === "session text", sessionStore.storageInfo().message);
  test("A corrupt stored report resets safely", App.reportStorage.createStore(memoryStorage({ [App.reportStorage.STORAGE_KEY]: "not-json" })).getDraft().subjectSnapshotId === null, "No corrupt subject exposed");
  const failingStore = App.reportStorage.createStore(memoryStorage({}, true));
  test("A write-test failure enters disclosed session mode", !failingStore.storageInfo().persistent, failingStore.storageInfo().message);
  test("Clear removes report selections and writing", store.clear() && store.getDraft().subjectSnapshotId === null && store.getDraft().writing.finalConclusion === "", "Report returned to its initial draft");
  test("Clear does not remove unrelated experiment storage", storage.getItem("experimentData") === "preserve-me", storage.getItem("experimentData"));

  const emptyModel = App.reportModel.build(experimentState, initial);
  test("The active experiment archive does not become the subject automatically", emptyModel.subject === null && emptyModel.availableSnapshots.length === 2, "Two choices available; none selected");
  test("An empty report contains exactly the two print requirements", emptyModel.validationErrors.length === 2, () => emptyModel.validationErrors.map((error) => error.fieldId).join(", "));
  test("The model never generates a student conclusion", emptyModel.draft.writing.finalConclusion === "", "Conclusion remains empty");

  const selectedDraft = draftWith({
    subjectSnapshotId: earthSnapshot.id,
    lastKnownSubjectLabel: earthSnapshot.name,
    selectedPhysicalEvidenceIds: ["stellar-flux", "surface-temperature", "water-state"],
    expandedLifeCategoryIds: ["photosynthetic"],
    selectedExperimentSnapshotIds: [warmerSnapshot.id],
    comparison: { snapshotAId: earthSnapshot.id, snapshotBId: warmerSnapshot.id, lifeCategoryId: "microbial" },
    selectedDiscoveryIds: [discovery.id],
    writing: { finalConclusion: "My evidence supports a multidimensional conclusion." },
  });
  const earthJSON = JSON.stringify(earthSnapshot);
  const selectedModel = App.reportModel.build(experimentState, selectedDraft);
  test("The explicitly selected snapshot is the canonical subject", selectedModel.subject === earthSnapshot, selectedModel.subject.name);
  test("The report reads the immutable saved Planet State", selectedModel.state === earthSnapshot.physical.planetState, "Planet State object comes from the snapshot");
  test("Report assembly does not mutate the subject snapshot", JSON.stringify(earthSnapshot) === earthJSON, "Snapshot serialization unchanged");
  test("An unrelated active Planet State is not part of report assembly", selectedModel.state.inputs.orbitalDistance === 1 && warmer.inputs.orbitalDistance === 0.95, "Selected orbit 1.00 AU; other state 0.95 AU");
  test("Planet Identity includes all nine approved input groups", selectedModel.identity.length === 9, () => selectedModel.identity.map((row) => row.label).join(", "));
  test("Atmospheric identity reports all four approved gases", ["N₂", "O₂", "CO₂", "CH₄"].every((gas) => selectedModel.identity.find((row) => row.label === "Atmospheric Composition").value.includes(gas)), selectedModel.identity.find((row) => row.label === "Atmospheric Composition").value);
  test("The physical-evidence catalog has ten approved factual options", selectedModel.physicalEvidence.length === 10, () => selectedModel.physicalEvidence.map((item) => item.id).join(", "));
  test("Only student-selected physical evidence enters the selected set", selectedModel.selectedPhysicalEvidence.length === 3 && selectedModel.selectedPhysicalEvidence.every((item) => selectedDraft.selectedPhysicalEvidenceIds.includes(item.id)), () => selectedModel.selectedPhysicalEvidence.map((item) => item.id).join(", "));
  test("Physical evidence formats accepted Planet State values", selectedModel.selectedPhysicalEvidence.find((item) => item.id === "surface-temperature").value === `${earth.climate.meanSurfaceTemperatureC.toFixed(1)}°C`, selectedModel.selectedPhysicalEvidence.find((item) => item.id === "surface-temperature").value);
  test("Planetary Systems includes the five accepted status cards", selectedModel.systems.length === 5, () => selectedModel.systems.map((item) => item.name).join(", "));
  test("Protection and Environmental Stability are explicitly preliminary", selectedModel.systems.filter((item) => item.preliminary).map((item) => item.name).sort().join("|") === "Environmental Stability|Protection", () => selectedModel.systems.filter((item) => item.preliminary).map((item) => item.name).join(", "));
  test("All six saved Life Lab interpretations appear", selectedModel.life.length === 6, () => selectedModel.life.map((item) => item.category.name).join("; "));
  test("Life statuses are copied from the saved snapshot", selectedModel.life.every((result, index) => result.status === earthSnapshot.biological.interpretations[index].status), "All six saved statuses match");
  test("Detailed Life evidence expands only student-selected categories", selectedModel.life.filter((item) => item.expanded).length === 1 && selectedModel.life.find((item) => item.expanded).category.id === "photosynthetic", "Photosynthetic Life expanded");
  test("Selected experiments are opt-in and factual", selectedModel.selectedExperiments.length === 1 && selectedModel.selectedExperiments[0].id === warmerSnapshot.id, selectedModel.selectedExperiments[0].name);
  test("Selected discoveries are opt-in saved records", selectedModel.selectedDiscoveries.length === 1 && selectedModel.selectedDiscoveries[0] === discovery, selectedModel.selectedDiscoveries[0].title);
  test("The selected comparison reuses the accepted Phase 3 interpreter", selectedModel.comparison.mode === "controlled" && selectedModel.comparison.changedAtomicKeys[0] === "orbitalDistance", selectedModel.comparison.mode);
  test("Comparison applies the same selected Life category to both snapshots", selectedModel.comparison.life.resultA.category.id === "microbial" && selectedModel.comparison.life.resultB.category.id === "microbial", selectedModel.comparison.life.categoryName);
  test("A selected subject plus student conclusion is valid for print", selectedModel.validForPrint && selectedModel.validationErrors.length === 0, "No print validation errors");
  test("The report provides six fixed model limitations", selectedModel.limitations.length === 6, `${selectedModel.limitations.length} limitations`);
  test("Limitations distinguish compatibility from detecting life", selectedModel.limitations.some((text) => /does not detect life/.test(text)), "Detection/probability limitation is explicit");

  const missingDraft = draftWith({
    subjectSnapshotId: "snapshot-deleted",
    lastKnownSubjectLabel: "Deleted Final Planet",
    selectedExperimentSnapshotIds: ["snapshot-missing"],
    selectedDiscoveryIds: ["discovery-missing"],
    comparison: { snapshotAId: earthSnapshot.id, snapshotBId: "snapshot-missing", lifeCategoryId: "human" },
    writing: { finalConclusion: "Preserve these student words." },
  });
  const missingModel = App.reportModel.build(experimentState, missingDraft);
  test("A deleted canonical subject is flagged without substitution", missingModel.subject === null && missingModel.subjectMissing && missingModel.subjectLabel === "Deleted Final Planet", missingModel.subjectLabel);
  test("Missing experiment references are identified", missingModel.missingExperimentIds[0] === "snapshot-missing", missingModel.missingExperimentIds.join(", "));
  test("Missing discovery references are identified", missingModel.missingDiscoveryIds[0] === "discovery-missing", missingModel.missingDiscoveryIds.join(", "));
  test("A comparison with a missing snapshot is not fabricated", missingModel.comparison === null && missingModel.comparisonMissing, "Comparison marked unavailable");
  test("Missing references preserve student-authored writing", missingModel.draft.writing.finalConclusion === "Preserve these student words.", missingModel.draft.writing.finalConclusion);
  test("A missing subject blocks printing", !missingModel.validForPrint && missingModel.validationErrors.some((error) => error.fieldId === "report-subject"), "Subject validation remains active");
  const subjectOnly = App.reportModel.build(experimentState, draftWith({ subjectSnapshotId: earthSnapshot.id }));
  test("A selected subject without a conclusion remains incomplete", !subjectOnly.validForPrint && subjectOnly.validationErrors.length === 1 && subjectOnly.validationErrors[0].fieldId === "writing-finalConclusion", subjectOnly.validationErrors[0].message);
  const conclusionOnly = App.reportModel.build(experimentState, draftWith({ writing: { finalConclusion: "Student conclusion" } }));
  test("A conclusion without a selected snapshot remains incomplete", !conclusionOnly.validForPrint && conclusionOnly.validationErrors.length === 1 && conclusionOnly.validationErrors[0].fieldId === "report-subject", conclusionOnly.validationErrors[0].message);

  test("Phase 4 report data contains no scoring, ranking, grading, weighting, probability, or classification keys", !hasForbiddenKey(selectedModel), "No prohibited key is present");
  const serialized = JSON.stringify({ selectedDraft, selectedModel }).toLowerCase();
  test("Phase 4 does not assign named planetary classifications", !["ocean world", "snowball world", "desert world", "volcanic world", "runaway greenhouse world"].some((label) => serialized.includes(label)), "No automatic named-world label appears");
  test("Report output does not contain a generated verdict", !/overall verdict|habitability score|chance of life|probability of life/.test(serialized), "No generated verdict or probability language");

  const body = document.getElementById("results");
  results.forEach((result) => {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = result.name;
    const outcome = document.createElement("td");
    outcome.className = result.passed ? "pass" : "fail";
    outcome.textContent = result.passed ? "PASS" : "FAIL";
    const evidence = document.createElement("td");
    evidence.textContent = result.detail;
    row.append(name, outcome, evidence);
    body.append(row);
  });
  const passed = results.filter((result) => result.passed).length;
  const summary = document.getElementById("summary");
  summary.textContent = `${passed} of ${results.length} tests passed.`;
  summary.dataset.passed = String(passed);
  summary.dataset.total = String(results.length);
  document.title = `${passed === results.length ? "PASS" : "FAIL"}: Phase 4 Tests (${passed}/${results.length})`;
})(window.HabitablePlanet = window.HabitablePlanet || {});

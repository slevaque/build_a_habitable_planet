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

  function memoryStorage(seed = {}) {
    const values = new Map(Object.entries(seed));
    return {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
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
      new Date(`2026-08-0${sequence}T12:00:00Z`)
    );
  }

  function changedState(overrides) {
    return App.simulatePlanet({ ...App.CONSTANTS.earthInputs, ...overrides });
  }

  function hasForbiddenRecordKey(value) {
    const forbidden = /^(score|points?|rank|ranking|weight|significance|probability)$/i;
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, child]) => forbidden.test(key) || hasForbiddenRecordKey(child));
  }

  const earth = App.simulatePlanet(App.CONSTANTS.earthInputs);
  const earthJSON = JSON.stringify(earth);
  const earthLife = App.life.interpretAll(earth);
  const first = snapshot(1, earth, "Earth Reference");

  test("Snapshot creation does not mutate Planet State", JSON.stringify(earth) === earthJSON, "Planet State serialization is unchanged");
  test("Snapshot record is deeply immutable", Object.isFrozen(first) && Object.isFrozen(first.physical) && Object.isFrozen(first.physical.planetState.inputs), "Record, physical wrapper, and inputs are frozen");
  test("Snapshot preserves the full validated input set", Object.keys(first.physical.planetState.inputs).length === Object.keys(earth.inputs).length, () => Object.keys(first.physical.planetState.inputs).join(", "));
  test("Snapshot preserves derived physics", first.physical.planetState.physics.escapeVelocityKms === earth.physics.escapeVelocityKms, () => `${first.physical.planetState.physics.escapeVelocityKms.toFixed(3)} km/s`);
  test("Snapshot preserves Version 4 climate output", first.physical.planetState.climate.meanSurfaceTemperatureC === earth.climate.meanSurfaceTemperatureC, () => `${earth.climate.meanSurfaceTemperatureC.toFixed(3)}°C`);
  test("Snapshot preserves five physical status cards", Object.keys(first.physical.planetState.statuses).length === 5, () => Object.keys(first.physical.planetState.statuses).join(", "));
  test("Snapshot preserves all six Life Lab interpretations", first.biological.interpretations.length === 6, () => first.biological.interpretations.map((item) => item.category.name).join("; "));
  test("Physical and biological records remain separated", !Object.prototype.hasOwnProperty.call(first.physical.planetState, "selectedLifeCategory") && Array.isArray(first.biological.interpretations), "No selected biology category is written into Planet State");
  test("Snapshot metadata identifies accepted engines", /Phase 1/.test(first.physical.engine) && /Phase 2/.test(first.biological.ruleset), () => `${first.physical.engine}; ${first.biological.ruleset}`);

  const edited = App.experimentRecords.editSnapshot(first, { name: "Renamed Earth", note: "New student note" });
  test("Renaming changes the student-visible name", edited.name === "Renamed Earth" && edited.note === "New student note", () => `${edited.name}: ${edited.note}`);
  test("Renaming cannot alter saved physical science", JSON.stringify(edited.physical) === JSON.stringify(first.physical), "Physical evidence is byte-identical after serialization");
  test("Renaming cannot alter saved Life results", JSON.stringify(edited.biological) === JSON.stringify(first.biological), "Biological evidence is byte-identical after serialization");
  const activeDifferent = changedState({ orbitalDistance: 1.2 });
  test("Changing the active planet does not alter a snapshot", JSON.stringify(first.physical.planetState) === earthJSON && activeDifferent.inputs.orbitalDistance === 1.2, "Saved orbit remains 1.00 AU while active fixture is 1.20 AU");

  const storage = memoryStorage();
  const store = App.experimentStorage.createStore(storage);
  const createdOne = store.createSnapshot(earth, earthLife, { name: "One" });
  const createdTwo = store.createSnapshot(activeDifferent, App.life.interpretAll(activeDifferent), { name: "Two" });
  test("Snapshot store creates ordered records", createdOne.ok && createdTwo.ok && createdTwo.record.creationOrder === 2, () => store.getState().snapshots.map((item) => item.id).join(", "));
  test("Snapshot identifiers are monotonic", createdOne.record.id === "snapshot-1" && createdTwo.record.id === "snapshot-2", `${createdOne.record.id}, ${createdTwo.record.id}`);
  test("Snapshot store persists to browser-compatible storage", Boolean(storage.getItem(App.experimentStorage.STORAGE_KEY)), "Serialized experiment state was written");
  const reloaded = App.experimentStorage.createStore(storage);
  test("Persisted snapshots reload without recomputation", JSON.stringify(reloaded.getState().snapshots) === JSON.stringify(store.getState().snapshots), "Reloaded records exactly match stored records");
  test("Persistent-storage status is explicit", store.storageInfo().persistent === true && /saved in this browser/.test(store.storageInfo().message), store.storageInfo().message);
  const sessionOnly = App.experimentStorage.createStore(null);
  test("Storage failure falls back to session-only records", sessionOnly.storageInfo().persistent === false && /page is closed/.test(sessionOnly.storageInfo().message), sessionOnly.storageInfo().message);
  const corruptStorage = memoryStorage({ [App.experimentStorage.STORAGE_KEY]: "not-json" });
  test("Corrupt saved data resets safely", App.experimentStorage.createStore(corruptStorage).getState().snapshots.length === 0, "No invalid snapshot is exposed");

  const limitStore = App.experimentStorage.createStore(null);
  for (let index = 0; index < 5; index += 1) limitStore.createSnapshot(earth, earthLife, { name: `Limit ${index + 1}` });
  const sixth = limitStore.createSnapshot(earth, earthLife, { name: "Sixth" });
  test("Snapshot library enforces the approved five-record limit", !sixth.ok && sixth.reason === "limit" && limitStore.getState().snapshots.length === 5, "Sixth save is rejected without deleting earlier work");
  limitStore.deleteSnapshot("snapshot-2");
  test("Deleting one snapshot leaves every other snapshot unchanged", limitStore.getState().snapshots.length === 4 && limitStore.getState().snapshots[0].id === "snapshot-1" && limitStore.getState().snapshots[1].id === "snapshot-3", () => limitStore.getState().snapshots.map((item) => item.id).join(", "));
  const afterDelete = limitStore.createSnapshot(earth, earthLife, { name: "Replacement" });
  test("Deleting one snapshot allows one replacement", afterDelete.ok && limitStore.getState().snapshots.length === 5, () => limitStore.getState().snapshots.map((item) => item.id).join(", "));
  test("Deleted identifiers are not reused", afterDelete.record.id === "snapshot-6", afterDelete.record.id);
  test("Deleting a missing snapshot is a safe no-op", limitStore.deleteSnapshot("missing") === false, "Store reports no mutation");

  const geology = changedState({ geologicActivity: "Active" });
  const geologySnapshot = snapshot(2, geology, "Active Geology");
  const unrelatedActiveBefore = JSON.stringify(activeDifferent);
  const controlled = App.comparison.compare(first, geologySnapshot, "microbial");
  test("One changed input produces a controlled comparison", controlled.mode === "controlled", controlled.mode);
  test("Controlled comparison identifies the exact atomic cause", controlled.changedAtomicKeys.length === 1 && controlled.changedAtomicKeys[0] === "geologicActivity", () => controlled.changedAtomicKeys.join(", "));
  test("Comparison groups geology under You Changed", controlled.inputDifferences.find((row) => row.id === "geology").changed, "Geologic Activity is the changed input group");
  test("Comparison does not falsely report unchanged orbit as changed", !controlled.inputDifferences.find((row) => row.id === "orbit").changed, "Orbit stays at 1.00 AU");
  test("Controlled comparison reuses a causal explanation", controlled.explanation && controlled.explanation.chain.length > 0 && controlled.mission.chain === controlled.explanation.chain, () => controlled.explanation.chain.join(" → "));
  test("Comparison does not mutate Snapshot A", JSON.stringify(first.physical.planetState) === earthJSON, "Snapshot A remains unchanged");
  test("Comparison does not mutate Snapshot B", JSON.stringify(geologySnapshot.physical.planetState) === JSON.stringify(geology), "Snapshot B remains unchanged");
  test("Comparison does not change an unrelated active Planet State", JSON.stringify(activeDifferent) === unrelatedActiveBefore, "Active Planet State remains byte-identical after serialization");
  test("Reversing A and B preserves the changed cause", App.comparison.compare(geologySnapshot, first, "microbial").changedAtomicKeys[0] === "geologicActivity", "Direction changes, scientific cause does not");

  const duplicateEarth = snapshot(3, earth, "Same Inputs");
  const identical = App.comparison.compare(first, duplicateEarth, "human");
  test("Identical scientific states are recognized", identical.mode === "identical" && identical.changedAtomicKeys.length === 0, identical.mode);
  test("Names and timestamps are excluded as scientific causes", identical.inputDifferences.every((row) => !row.changed), "Every validated input group is unchanged");

  const confoundedState = changedState({ orbitalDistance: 1.2, geologicActivity: "Active" });
  const confounded = App.comparison.compare(first, snapshot(4, confoundedState, "Two Changes"), "human");
  test("Multiple changed inputs produce a confounded comparison", confounded.mode === "confounded" && confounded.changedAtomicKeys.length === 2, () => confounded.changedAtomicKeys.join(", "));
  test("Confounded comparison does not invent a single cause", confounded.explanation === null && /cannot determine/.test(confounded.mission.why), confounded.mission.why);
  test("Confounded comparison does not generate a causal discovery", confounded.suggestions.every((item) => item.source !== "comparison"), () => `${confounded.suggestions.length} suggestions`);

  test("Life comparison uses the same selected category on both snapshots", controlled.life.categoryId === "microbial" && controlled.life.resultA.category.id === controlled.life.resultB.category.id, controlled.life.categoryName);
  test("Life comparison uses saved results rather than rerunning physics", controlled.life.resultA === first.biological.interpretations.find((item) => item.category.id === "microbial"), "Snapshot A result is the stored immutable object");
  const anoxic = changedState({ oxygenPct: 0 });
  const anoxicSnapshot = snapshot(5, anoxic, "Anoxic");
  const lifeDifferent = App.comparison.compare(first, anoxicSnapshot, "human");
  test("Same-category Life comparison reports a changed status", lifeDifferent.life.changed && lifeDifferent.life.resultA.status !== lifeDifferent.life.resultB.status, () => `${lifeDifferent.life.resultA.status} → ${lifeDifferent.life.resultB.status}`);
  test("A changed Life result can create a Life-specific suggestion", lifeDifferent.suggestions.some((item) => item.source === "life-comparison"), () => lifeDifferent.suggestions.map((item) => item.source).join(", "));

  test("Controlled comparison offers an evidence-backed suggestion", controlled.suggestions.length === 1 && controlled.suggestions[0].source === "comparison", controlled.suggestions[0].title);
  const discoveryStore = App.experimentStorage.createStore(null);
  discoveryStore.createSnapshot(earth, earthLife, { name: "Earth" });
  discoveryStore.createSnapshot(geology, App.life.interpretAll(geology), { name: "Geology" });
  test("Suggestions are not automatically saved", discoveryStore.getState().discoveries.length === 0, "Discovery Log is empty before explicit save");
  const savedDiscovery = discoveryStore.createDiscovery(controlled.suggestions[0], { note: "Geology was the isolated change." });
  test("Explicit save creates one Discovery Log record", discoveryStore.getState().discoveries.length === 1 && savedDiscovery.id === "discovery-1", savedDiscovery.id);
  test("Discovery preserves snapshot references and labels", savedDiscovery.relatedSnapshotIds.length === 2 && savedDiscovery.relatedSnapshotLabels.length === 2, () => savedDiscovery.relatedSnapshotLabels.join(" and "));
  test("Discovery preserves modeled evidence and causal chain", savedDiscovery.modeledEvidence.length > 0 && savedDiscovery.causalChain.length > 0, () => `${savedDiscovery.modeledEvidence.length} evidence rows; ${savedDiscovery.causalChain.length} causal steps`);
  discoveryStore.deleteSnapshot("snapshot-1");
  test("Deleting a snapshot retains saved discovery evidence", discoveryStore.getState().discoveries[0].id === savedDiscovery.id && discoveryStore.getState().discoveries[0].modeledEvidence.length > 0, "Discovery remains after a referenced snapshot is removed");
  discoveryStore.clearSnapshots();
  test("Clearing snapshots retains the Discovery Log", discoveryStore.getState().snapshots.length === 0 && discoveryStore.getState().discoveries.length === 1, "Snapshots cleared; one discovery retained");
  discoveryStore.clearDiscoveries();
  test("Clearing discoveries does not recreate or alter snapshots", discoveryStore.getState().discoveries.length === 0 && discoveryStore.getState().snapshots.length === 0, "Both collections now intentionally empty");

  const studentSuggestion = App.comparison.studentNoteSuggestion([first.id], [first.name]);
  const studentRecord = App.experimentRecords.createDiscovery(2, studentSuggestion, { title: "Question", note: "Would this relationship reverse?" });
  test("Student-authored notes remain distinguishable from modeled findings", studentRecord.source === "student-note" && studentRecord.modeledEvidence.length === 0, studentRecord.source);
  const committedExplanation = App.explanations.createExplanation("orbitalDistance", earth, activeDifferent);
  const committedSuggestion = App.comparison.suggestFromCommittedChange("orbitalDistance", earth, activeDifferent, committedExplanation);
  test("A committed Build change can be suggested without auto-saving", committedSuggestion.source === "committed-change" && committedSuggestion.relatedSnapshotIds.length === 0, committedSuggestion.studentAction);

  const colderComparison = App.comparison.compare(first, snapshot(6, activeDifferent, "Farther Orbit"), "photosynthetic");
  test("Feedback signatures appear only for controlled comparisons", colderComparison.feedback.every((item) => ["ice-albedo", "water-vapor"].includes(item.id)) && confounded.feedback.length === 0, () => colderComparison.feedback.map((item) => item.name).join(", ") || "No feedback signature met model evidence conditions");
  test("Feedback signatures contain model-supported causal steps", colderComparison.feedback.every((item) => item.chain.length >= 3), () => colderComparison.feedback.map((item) => item.chain.join(" → ")).join("; ") || "No feedback signature met model evidence conditions");
  test("Phase 3 records contain no score, points, rank, weight, significance, or probability fields", !hasForbiddenRecordKey({ first, controlled, savedDiscovery }), "No forbidden scoring key is present");
  const serialized = JSON.stringify({ first, controlled, savedDiscovery }).toLowerCase();
  test("Phase 3 does not assign automatic named world classifications", !["ocean world", "snowball world", "desert world", "volcanic world", "runaway greenhouse world"].some((label) => serialized.includes(label)), "No named classification appears in scientific records");

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
  document.title = `${passed === results.length ? "PASS" : "FAIL"}: Phase 3 Tests (${passed}/${results.length})`;
})(window.HabitablePlanet = window.HabitablePlanet || {});

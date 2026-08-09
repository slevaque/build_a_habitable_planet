(function (App) {
  "use strict";

  const session = {
    currentState: null,
    committedState: null,
    explanation: null,
    history: [],
    view: "build",
    selectedLifeCategory: "microbial",
    lifeResults: [],
    experimentStore: null,
    selectedSnapshotAId: null,
    selectedSnapshotBId: null,
    comparisonLifeCategory: "microbial",
    comparison: null,
    latestSuggestion: null,
    reportStore: null,
    report: null,
  };

  let syncResponsiveOrder = () => {};

  function byId(id) { return document.getElementById(id); }

  function addHistory(changeKey, explanation) {
    const label = App.explanations.labels[changeKey] || "Planet setting";
    const timestamp = new Date().toISOString();
    const committedEntries = [
      { kind: "You Changed", text: label, timestamp },
      ...explanation.responses.slice(0, 3).map((response) => ({
        kind: "Model Response",
        text: response,
        timestamp,
      })),
    ];
    session.history.unshift(...committedEntries);
    session.history = session.history.slice(0, 20);
  }

  function calculate(rawInputs, options) {
    return App.simulatePlanet(rawInputs, options);
  }

  function normalizeComparisonSelection() {
    const snapshots = session.experimentStore.getState().snapshots;
    const available = new Set(snapshots.map((snapshot) => snapshot.id));
    if (snapshots.length < 2) {
      session.selectedSnapshotAId = snapshots[0] ? snapshots[0].id : null;
      session.selectedSnapshotBId = null;
      session.comparison = null;
      return;
    }
    if (!available.has(session.selectedSnapshotAId)) session.selectedSnapshotAId = snapshots[0].id;
    if (!available.has(session.selectedSnapshotBId) || session.selectedSnapshotBId === session.selectedSnapshotAId) {
      session.selectedSnapshotBId = snapshots.find((snapshot) => snapshot.id !== session.selectedSnapshotAId).id;
    }
    const snapshotA = snapshots.find((snapshot) => snapshot.id === session.selectedSnapshotAId);
    const snapshotB = snapshots.find((snapshot) => snapshot.id === session.selectedSnapshotBId);
    session.comparison = App.comparison.compare(snapshotA, snapshotB, session.comparisonLifeCategory);
  }

  function renderExperiments() {
    normalizeComparisonSelection();
    App.discoveriesUI.render({
      storeState: session.experimentStore.getState(),
      storageInfo: session.experimentStore.storageInfo(),
      selectedAId: session.selectedSnapshotAId,
      selectedBId: session.selectedSnapshotBId,
      lifeCategoryId: session.comparisonLifeCategory,
      comparison: session.comparison,
      latestSuggestion: session.latestSuggestion,
    });
    if (session.view === "discoveries") {
      App.ui.renderMission(session.comparison ? session.comparison.mission : {
        observation: "Save at least two planetary snapshots to begin a comparison.",
        why: "Snapshots preserve student-controlled inputs and the resulting Planet State without changing the active planet.",
        investigate: "Return to Build, save one experiment, change one input, and save a second experiment.",
        chain: ["Build a planet", "Save a snapshot", "Change one input", "Save and compare"],
      });
    }
  }

  function renderReport(options = {}) {
    session.report = App.reportModel.build(
      session.experimentStore.getState(),
      session.reportStore.getDraft()
    );
    App.reportUI.render({
      ...session.report,
      storageInfo: session.reportStore.storageInfo(),
    }, options);
  }

  function renderCurrent(options = {}) {
    const lifeMode = session.view === "life";
    const discoveriesMode = session.view === "discoveries";
    const reportMode = session.view === "report";
    App.ui.render(
      session.currentState,
      lifeMode || discoveriesMode || reportMode ? null : session.explanation,
      session.history
    );
    session.lifeResults = App.life.interpretAll(session.currentState);
    const selected = App.lifeLabUI.render(
      session.currentState,
      session.lifeResults,
      session.selectedLifeCategory,
      Boolean(options.announceLife)
    );
    if (lifeMode) App.ui.renderMission(selected.mission);
    if (discoveriesMode || options.renderExperiments) renderExperiments();
    if (reportMode || options.renderReport) renderReport({ preserveEditor: Boolean(options.preserveReportEditor) });
  }

  function preview() {
    session.currentState = calculate(App.ui.readInputs());
    renderCurrent();
  }

  function commit(changeKey) {
    const previous = session.committedState;
    session.currentState = calculate(App.ui.readInputs());
    session.committedState = session.currentState;
    session.explanation = App.explanations.createExplanation(changeKey, previous, session.currentState);
    if (previous && changeKey) {
      addHistory(changeKey, session.explanation);
      session.latestSuggestion = App.comparison.suggestFromCommittedChange(
        changeKey,
        previous,
        session.currentState,
        session.explanation
      );
    }
    renderCurrent();
  }

  function loadPreset(preset, label) {
    App.ui.writeInputs(preset);
    const previous = session.committedState;
    session.currentState = calculate(preset);
    session.committedState = session.currentState;
    session.explanation = App.explanations.createExplanation("starType", previous, session.currentState);
    session.latestSuggestion = null;
    if (previous) {
      const timestamp = new Date().toISOString();
      session.history.unshift(
        { kind: "You Changed", text: label, timestamp },
        { kind: "Model Response", text: `Temperature ${session.currentState.climate.meanSurfaceTemperatureC.toFixed(1)}°C`, timestamp }
      );
    }
    renderCurrent({ announceLife: session.view === "life" });
  }

  function reset() {
    session.history = [];
    session.latestSuggestion = null;
    App.ui.writeInputs(App.CONSTANTS.defaultInputs);
    session.currentState = calculate(App.CONSTANTS.defaultInputs);
    session.committedState = session.currentState;
    session.explanation = App.explanations.createExplanation(null, null, session.currentState);
    renderCurrent({ announceLife: session.view === "life" });
  }

  function selectLifeCategory(categoryId) {
    session.selectedLifeCategory = categoryId;
    const selected = App.lifeLabUI.render(
      session.currentState,
      session.lifeResults,
      session.selectedLifeCategory,
      true
    );
    App.ui.renderMission(selected.mission);
  }

  function changeView(view) {
    session.view = view;
    App.lifeLabUI.setView(view);
    App.discoveriesUI.setView(view);
    App.reportUI.setView(view);
    syncResponsiveOrder();
    renderCurrent({
      announceLife: view === "life",
      renderExperiments: view === "discoveries",
      renderReport: view === "report",
    });
    if (view === "life") byId("life-lab").scrollIntoView({ block: "start" });
    if (view === "dashboard") byId("planetary-status").scrollIntoView({ block: "start" });
    if (view === "build") byId("engineering").scrollIntoView({ block: "start" });
    if (view === "discoveries") byId("discoveries-workspace").scrollIntoView({ block: "start" });
    if (view === "report") byId("report-workspace").scrollIntoView({ block: "start" });
  }

  function createSnapshot(draft) {
    const lifeResults = App.life.interpretAll(session.committedState);
    const result = session.experimentStore.createSnapshot(session.committedState, lifeResults, draft);
    if (!result.ok) {
      App.discoveriesUI.announce("Snapshot limit reached. Delete a saved snapshot before creating another.");
      return;
    }
    renderCurrent({ renderExperiments: true });
    App.discoveriesUI.announce(`${result.record.name} saved. The active planet was not changed.`);
  }

  function editSnapshot(id, fields) {
    const result = session.experimentStore.editSnapshot(id, fields);
    if (result.ok && session.reportStore.getDraft().subjectSnapshotId === id) {
      session.reportStore.update({ lastKnownSubjectLabel: result.record.name });
    }
    renderCurrent({ renderExperiments: true });
    if (result.ok) App.discoveriesUI.announce(`${result.record.name} updated. Its scientific evidence is unchanged.`);
  }

  function deleteSnapshot(id) {
    const snapshot = session.experimentStore.getState().snapshots.find((item) => item.id === id);
    if (!snapshot || !session.experimentStore.deleteSnapshot(id)) return;
    renderCurrent({ renderExperiments: true });
    App.discoveriesUI.announce(`${snapshot.name} deleted. Other snapshots and discoveries were not changed.`);
  }

  function clearSnapshots() {
    if (!session.experimentStore.clearSnapshots()) return;
    renderCurrent({ renderExperiments: true });
    App.discoveriesUI.announce("All snapshots cleared. Discovery records retained their captured evidence.");
  }

  function changeComparison(selection) {
    session.selectedSnapshotAId = selection.snapshotAId || null;
    session.selectedSnapshotBId = selection.snapshotBId || null;
    session.comparisonLifeCategory = selection.lifeCategoryId || "microbial";
    renderCurrent({ renderExperiments: true });
    if (session.comparison) {
      App.discoveriesUI.announce(`Comparison updated. ${session.comparison.mission.observation}`);
    }
  }

  function saveDiscovery(suggestion, fields) {
    const record = session.experimentStore.createDiscovery(suggestion, fields);
    renderCurrent({ renderExperiments: true });
    App.discoveriesUI.announce(`${record.title} saved to the Discovery Log.`);
  }

  function clearDiscoveries() {
    if (!session.experimentStore.clearDiscoveries()) return;
    renderCurrent({ renderExperiments: true });
    App.discoveriesUI.announce("Discovery Log cleared. Snapshots were not changed.");
  }

  function updateReportDraft(patch, preserveEditor) {
    session.reportStore.update(patch);
    renderReport({ preserveEditor: Boolean(preserveEditor) });
  }

  function clearReport() {
    session.reportStore.clear();
    renderReport();
    App.reportUI.announce("Report draft cleared. Snapshots, discoveries, and the active planet were not changed.");
  }

  function initialize() {
    session.experimentStore = App.experimentStorage.createStore();
    session.reportStore = App.reportStorage.createStore();
    App.ui.writeInputs(App.CONSTANTS.defaultInputs);
    session.currentState = calculate(App.CONSTANTS.defaultInputs);
    session.committedState = session.currentState;
    session.explanation = App.explanations.createExplanation(null, null, session.currentState);
    App.lifeLabUI.setView(session.view);
    App.discoveriesUI.setView(session.view);
    App.reportUI.setView(session.view);
    renderCurrent({ renderExperiments: true, renderReport: true });

    App.ui.setupStaticInteractions({
      onReset: reset,
      onEarthReference: () => loadPreset(App.CONSTANTS.earthInputs, "Loaded Earth Reference benchmark"),
    });
    App.lifeLabUI.setupStaticInteractions({
      onCategoryChange: selectLifeCategory,
      onViewChange: changeView,
    });
    App.discoveriesUI.setupStaticInteractions({
      onViewChange: changeView,
      getSnapshotContext: () => {
        const state = session.experimentStore.getState();
        return {
          atLimit: state.snapshots.length >= App.experimentRecords.SNAPSHOT_LIMIT,
          defaultName: `Snapshot ${state.nextSnapshotSequence}`,
        };
      },
      onCreateSnapshot: createSnapshot,
      onEditSnapshot: editSnapshot,
      onDeleteSnapshot: deleteSnapshot,
      onClearSnapshots: clearSnapshots,
      onComparisonChange: changeComparison,
      onSaveDiscovery: saveDiscovery,
      onClearDiscoveries: clearDiscoveries,
    });
    App.reportUI.setupStaticInteractions({
      onViewChange: changeView,
      onDraftChange: updateReportDraft,
      onClearReport: clearReport,
    });

    const shell = document.querySelector(".laboratory-shell");
    const regions = {
      engineering: document.querySelector(".engineering-panel"),
      planet: document.querySelector(".planet-stage"),
      status: document.querySelector(".status-panel"),
      life: document.querySelector(".life-lab-panel"),
      discoveries: document.querySelector(".discoveries-workspace"),
      report: document.querySelector(".report-workspace"),
      mission: document.querySelector(".mission-control"),
      history: document.querySelector(".recent-changes"),
    };
    const responsiveOrder = window.matchMedia("(max-width: 1120px)");
    syncResponsiveOrder = () => {
      const order = session.view === "life"
        ? [regions.planet, regions.life, regions.mission, regions.history, regions.engineering, regions.status, regions.discoveries, regions.report]
        : session.view === "discoveries"
          ? [regions.discoveries, regions.mission, regions.planet, regions.status, regions.engineering, regions.history, regions.life, regions.report]
          : session.view === "report"
            ? [regions.report, regions.planet, regions.status, regions.engineering, regions.mission, regions.history, regions.life, regions.discoveries]
          : responsiveOrder.matches
            ? [regions.planet, regions.status, regions.engineering, regions.mission, regions.history, regions.life, regions.discoveries, regions.report]
            : [regions.engineering, regions.planet, regions.status, regions.mission, regions.history, regions.life, regions.discoveries, regions.report];
      order.forEach((region) => shell.append(region));
    };
    syncResponsiveOrder();
    responsiveOrder.addEventListener("change", syncResponsiveOrder);

    const form = byId("planet-controls");
    form.addEventListener("input", (event) => {
      if (event.target.name === "starType") return;
      preview();
    });
    form.addEventListener("change", (event) => {
      if (!event.target.name) return;
      if (event.target.name === "starType") {
        const star = App.CONSTANTS.stars[event.target.value];
        App.ui.setStarOrbitRange(event.target.value, star.orbitDefault);
      }
      commit(event.target.name);
    });

    byId("planet-name").addEventListener("change", () => commit(null));
  }

  window.addEventListener("DOMContentLoaded", initialize, { once: true });
  App.session = session;
})(window.HabitablePlanet = window.HabitablePlanet || {});

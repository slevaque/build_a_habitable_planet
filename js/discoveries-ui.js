(function (App) {
  "use strict";

  let callbacks = null;
  let renderedModel = null;
  let activeSnapshotId = null;
  let activeSuggestion = null;
  let visibleSuggestions = [];

  function byId(id) { return document.getElementById(id); }

  function announce(message) {
    byId("experiment-live-status").textContent = "";
    window.requestAnimationFrame(() => { byId("experiment-live-status").textContent = message; });
  }

  function button(label, action, className = "utility-button") {
    const control = document.createElement("button");
    control.type = "button";
    control.className = className;
    control.dataset.action = action;
    control.textContent = label;
    return control;
  }

  function addDefinition(list, termText, definitionText) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = termText;
    const definition = document.createElement("dd");
    definition.textContent = definitionText;
    wrapper.append(term, definition);
    list.append(wrapper);
  }

  function snapshotById(id) {
    return renderedModel.storeState.snapshots.find((snapshot) => snapshot.id === id) || null;
  }

  function renderSnapshotCards(snapshots) {
    const container = byId("snapshot-cards");
    container.replaceChildren();
    snapshots.forEach((snapshot) => {
      const state = snapshot.physical.planetState;
      const card = document.createElement("article");
      card.className = "snapshot-card";
      card.dataset.snapshotId = snapshot.id;
      const heading = document.createElement("h3");
      heading.textContent = snapshot.name;
      const identity = document.createElement("p");
      identity.className = "snapshot-identity";
      identity.textContent = `Snapshot ${snapshot.creationOrder} · ${state.inputs.planetName}`;
      const evidence = document.createElement("dl");
      evidence.className = "snapshot-evidence";
      addDefinition(evidence, "Star / orbit", `${state.physics.star.shortName} · ${state.inputs.orbitalDistance.toFixed(2)} AU`);
      addDefinition(evidence, "Temperature", `${state.climate.meanSurfaceTemperatureC.toFixed(1)}°C`);
      addDefinition(evidence, "Water", `${(state.climate.liquidWaterFraction * 100).toFixed(0)}% liquid · ${(state.climate.iceFraction * 100).toFixed(0)}% ice`);
      if (snapshot.note) {
        const note = document.createElement("p");
        note.className = "snapshot-note";
        note.textContent = snapshot.note;
        card.append(heading, identity, evidence, note);
      } else {
        card.append(heading, identity, evidence);
      }
      const actions = document.createElement("div");
      actions.className = "card-actions";
      const rename = button("Rename", "rename-snapshot");
      rename.setAttribute("aria-label", `Rename ${snapshot.name}`);
      const remove = button("Delete", "delete-snapshot", "utility-button utility-danger");
      remove.setAttribute("aria-label", `Delete ${snapshot.name}`);
      actions.append(rename, remove);
      card.append(actions);
      container.append(card);
    });
    byId("snapshot-empty").hidden = snapshots.length > 0;
    byId("snapshot-count").textContent = `${snapshots.length} of ${App.experimentRecords.SNAPSHOT_LIMIT} saved`;
    byId("clear-snapshots-button").disabled = snapshots.length === 0;
    byId("snapshot-button").disabled = false;
    byId("snapshot-button").dataset.atLimit = String(snapshots.length >= App.experimentRecords.SNAPSHOT_LIMIT);
    byId("snapshot-button").title = snapshots.length >= App.experimentRecords.SNAPSHOT_LIMIT
      ? "Delete a snapshot before saving another"
      : "Preserve the current committed scientific state";
  }

  function populateSelector(select, snapshots, selectedId, otherId, label) {
    select.replaceChildren();
    if (snapshots.length === 0) {
      const option = document.createElement("option");
      option.textContent = `No ${label} available`;
      option.value = "";
      select.append(option);
      select.disabled = true;
      return;
    }
    snapshots.forEach((snapshot) => {
      const option = document.createElement("option");
      option.value = snapshot.id;
      option.textContent = `${snapshot.name} (Snapshot ${snapshot.creationOrder})`;
      option.selected = snapshot.id === selectedId;
      option.disabled = snapshot.id === otherId;
      select.append(option);
    });
    select.disabled = snapshots.length < 2;
  }

  function renderPlanetSummary(containerId, snapshot, side) {
    const container = byId(containerId);
    container.replaceChildren();
    const state = snapshot.physical.planetState;
    const heading = document.createElement("h3");
    heading.id = `snapshot-${side.toLowerCase()}-title`;
    container.setAttribute("aria-labelledby", heading.id);
    heading.textContent = `Snapshot ${side}: ${snapshot.name}`;
    const previewWrap = document.createElement("div");
    previewWrap.className = "comparison-preview-wrap";
    previewWrap.append(App.ui.createPlanetPreview(state, `preview-${side.toLowerCase()}-${snapshot.id}`, `Snapshot ${side}, ${snapshot.name}`));
    const evidence = document.createElement("dl");
    evidence.className = "comparison-summary-evidence";
    addDefinition(evidence, "Planet", state.inputs.planetName);
    addDefinition(evidence, "Star", state.physics.star.shortName);
    addDefinition(evidence, "Orbit", `${state.inputs.orbitalDistance.toFixed(2)} AU`);
    addDefinition(evidence, "Temperature", `${state.climate.meanSurfaceTemperatureC.toFixed(1)}°C`);
    addDefinition(evidence, "Liquid surface", `${(state.climate.liquidWaterFraction * 100).toFixed(0)}%`);
    addDefinition(evidence, "Pressure", `${state.inputs.atmosphericPressure.toFixed(2)} atm`);
    container.append(heading, previewWrap, evidence);
    if (snapshot.note) {
      const note = document.createElement("p");
      note.className = "snapshot-note";
      note.textContent = snapshot.note;
      container.append(note);
    }
  }

  function differenceItem(row, includeDirection = true) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = row.label;
    const a = document.createElement("span");
    a.textContent = `A: ${row.valueA}`;
    const b = document.createElement("span");
    b.textContent = `B: ${row.valueB}`;
    item.append(label, a, b);
    if (includeDirection) {
      const direction = document.createElement("em");
      direction.textContent = row.direction || (row.changed ? "changed" : "unchanged");
      item.append(direction);
    }
    return item;
  }

  function renderDifferences(comparison) {
    const inputList = byId("input-differences");
    inputList.replaceChildren();
    const changedInputs = comparison.inputDifferences.filter((row) => row.changed);
    if (changedInputs.length === 0) {
      const item = document.createElement("li");
      item.className = "empty-difference";
      item.textContent = "No student-controlled input differs.";
      inputList.append(item);
    } else {
      changedInputs.forEach((row) => inputList.append(differenceItem(row, false)));
    }

    const modelList = byId("model-differences");
    const unchangedList = byId("unchanged-evidence");
    modelList.replaceChildren();
    unchangedList.replaceChildren();
    const changedResponses = comparison.modelResponses.filter((row) => row.changed);
    const unchangedResponses = comparison.modelResponses.filter((row) => !row.changed);
    if (changedResponses.length === 0) {
      const item = document.createElement("li");
      item.className = "empty-difference";
      item.textContent = "No calculated result differs at the current displayed precision.";
      modelList.append(item);
    } else {
      changedResponses.forEach((row) => modelList.append(differenceItem(row)));
    }
    unchangedResponses.forEach((row) => unchangedList.append(differenceItem(row)));
    byId("unchanged-evidence-details").hidden = unchangedResponses.length === 0;
  }

  function renderInterpretation(comparison) {
    const summary = byId("comparison-interpretation");
    summary.dataset.mode = comparison.mode;
    if (comparison.mode === "controlled") {
      summary.textContent = `Controlled comparison: ${comparison.explanation.why}`;
    } else if (comparison.mode === "identical") {
      summary.textContent = "The validated student inputs are identical. Names and timestamps are not treated as scientific differences.";
    } else {
      summary.textContent = "Confounded comparison: several student-controlled causes changed, so the model responses cannot be assigned to one cause.";
    }
    const chain = byId("comparison-causal-chain");
    chain.replaceChildren();
    comparison.mission.chain.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      chain.append(item);
    });
    const feedbacks = byId("comparison-feedbacks");
    feedbacks.replaceChildren();
    comparison.feedback.forEach((feedback) => {
      const article = document.createElement("article");
      article.className = "feedback-signature";
      const heading = document.createElement("h4");
      heading.textContent = feedback.name;
      const paragraph = document.createElement("p");
      paragraph.textContent = feedback.explanation;
      article.append(heading, paragraph);
      feedbacks.append(article);
    });
  }

  function lifeEvidence(result) {
    if (result.status === "Compatible") return result.evidence.supporting.slice(0, 2);
    if (result.status === "Uncertain") return result.evidence.uncertainty.slice(0, 2);
    return result.evidence.limiting.slice(0, 2);
  }

  function lifeSide(snapshot, result, side) {
    const article = document.createElement("article");
    article.className = "life-comparison-card";
    article.dataset.status = result.status;
    const heading = document.createElement("h4");
    heading.textContent = `Snapshot ${side}: ${snapshot.name}`;
    const status = document.createElement("p");
    status.className = "life-comparison-status";
    status.textContent = result.status;
    const summary = document.createElement("p");
    summary.textContent = result.summary;
    const evidence = document.createElement("ul");
    lifeEvidence(result).forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.title}: ${entry.condition}`;
      evidence.append(item);
    });
    article.append(heading, status, summary, evidence);
    return article;
  }

  function renderLifeComparison(comparison, snapshotA, snapshotB) {
    const container = byId("life-comparison-results");
    container.replaceChildren();
    if (!comparison.life) return;
    container.append(
      lifeSide(snapshotA, comparison.life.resultA, "A"),
      lifeSide(snapshotB, comparison.life.resultB, "B")
    );
  }

  function renderSuggestions(comparison, latestSuggestion) {
    visibleSuggestions = [];
    if (latestSuggestion) visibleSuggestions.push(latestSuggestion);
    if (comparison) comparison.suggestions.forEach((suggestion) => visibleSuggestions.push(suggestion));
    const container = byId("suggestion-cards");
    container.replaceChildren();
    if (visibleSuggestions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-workspace";
      empty.textContent = "No evidence-backed suggestion is available for this comparison. Controlled comparisons that differ in one input can produce a suggestion.";
      container.append(empty);
      return;
    }
    visibleSuggestions.forEach((suggestion, index) => {
      const card = document.createElement("article");
      card.className = "suggestion-card";
      const heading = document.createElement("h4");
      heading.textContent = suggestion.title;
      const category = document.createElement("p");
      category.className = "discovery-category";
      category.textContent = suggestion.category;
      const action = document.createElement("p");
      action.textContent = suggestion.studentAction;
      const save = button("Save to Discovery Log", "save-suggestion", "primary-button");
      save.dataset.suggestionIndex = String(index);
      card.append(heading, category, action, save);
      container.append(card);
    });
  }

  function sourceLabel(source) {
    return ({
      comparison: "Snapshot comparison",
      "life-comparison": "Life Lab comparison",
      "committed-change": "Committed Build change",
      "student-note": "Student note",
    })[source] || "Scientific investigation";
  }

  function renderDiscoveryLog(discoveries, snapshots) {
    const container = byId("discovery-records");
    container.replaceChildren();
    const savedIds = new Set(snapshots.map((snapshot) => snapshot.id));
    discoveries.slice().reverse().forEach((record) => {
      const article = document.createElement("article");
      article.className = "discovery-record";
      const heading = document.createElement("h3");
      heading.textContent = record.title;
      const meta = document.createElement("p");
      meta.className = "discovery-category";
      meta.textContent = `${record.category} · ${sourceLabel(record.source)}`;
      const action = document.createElement("p");
      action.textContent = record.studentAction;
      article.append(heading, meta, action);
      if (record.relatedSnapshotLabels.length) {
        const references = document.createElement("p");
        references.className = "discovery-references";
        const missing = record.relatedSnapshotIds.some((id) => !savedIds.has(id));
        references.textContent = `Related snapshots: ${record.relatedSnapshotLabels.join(" and ")}${missing ? ". A referenced snapshot is no longer saved; captured evidence remains below." : "."}`;
        article.append(references);
      }
      if (record.modeledEvidence.length) {
        const evidenceHeading = document.createElement("h4");
        evidenceHeading.textContent = "Modeled evidence";
        const evidence = document.createElement("ul");
        record.modeledEvidence.forEach((text) => {
          const item = document.createElement("li");
          item.textContent = text;
          evidence.append(item);
        });
        article.append(evidenceHeading, evidence);
      }
      if (record.causalChain.length) {
        const chainHeading = document.createElement("h4");
        chainHeading.textContent = "Causal explanation";
        const chain = document.createElement("ol");
        record.causalChain.forEach((text) => {
          const item = document.createElement("li");
          item.textContent = text;
          chain.append(item);
        });
        article.append(chainHeading, chain);
      }
      if (record.note) {
        const note = document.createElement("p");
        note.className = "student-discovery-note";
        note.textContent = `Student note: ${record.note}`;
        article.append(note);
      }
      container.append(article);
    });
    byId("discovery-empty").hidden = discoveries.length > 0;
    byId("clear-discoveries-button").disabled = discoveries.length === 0;
  }

  function render(model) {
    renderedModel = model;
    const snapshots = model.storeState.snapshots;
    renderSnapshotCards(snapshots);
    byId("storage-status").textContent = model.storageInfo.message;
    byId("storage-status").dataset.persistent = String(model.storageInfo.persistent);
    populateSelector(byId("compare-snapshot-a"), snapshots, model.selectedAId, model.selectedBId, "Snapshot A");
    populateSelector(byId("compare-snapshot-b"), snapshots, model.selectedBId, model.selectedAId, "Snapshot B");
    byId("comparison-life-category").value = model.lifeCategoryId;

    const comparison = model.comparison;
    byId("comparison-results").hidden = !comparison;
    byId("comparison-guidance").hidden = Boolean(comparison);
    if (comparison) {
      const snapshotA = snapshotById(model.selectedAId);
      const snapshotB = snapshotById(model.selectedBId);
      renderPlanetSummary("snapshot-a-summary", snapshotA, "A");
      renderPlanetSummary("snapshot-b-summary", snapshotB, "B");
      renderDifferences(comparison);
      renderInterpretation(comparison);
      renderLifeComparison(comparison, snapshotA, snapshotB);
    }
    renderSuggestions(comparison, model.latestSuggestion);
    renderDiscoveryLog(model.storeState.discoveries, snapshots);
  }

  function setView(view) {
    const discoveriesMode = view === "discoveries";
    byId("discoveries-workspace").hidden = !discoveriesMode;
    byId("discoveries-view-link").toggleAttribute("aria-current", discoveriesMode);
    document.body.classList.toggle("discoveries-mode", discoveriesMode);
    document.querySelector(".laboratory-shell").classList.toggle("is-discoveries-mode", discoveriesMode);
    if (discoveriesMode) {
      byId("engineering").hidden = true;
      byId("living-planet").hidden = true;
      byId("planetary-status").hidden = true;
      byId("life-lab").hidden = true;
      document.querySelector(".recent-changes").hidden = true;
    } else {
      byId("living-planet").hidden = false;
      document.querySelector(".recent-changes").hidden = false;
    }
  }

  function openDiscoveryDialog(suggestion, manual = false) {
    activeSuggestion = suggestion;
    byId("discovery-title-input").value = manual ? "" : suggestion.title;
    byId("discovery-note-input").value = "";
    byId("discovery-note-input").required = manual;
    byId("discovery-source-description").textContent = manual
      ? "Record your own scientific observation or question. Student notes are labeled separately from modeled conclusions."
      : `${sourceLabel(suggestion.source)}: ${suggestion.studentAction}`;
    byId("discovery-save-dialog").showModal();
    byId("discovery-title-input").focus();
  }

  function setupStaticInteractions(handlers) {
    callbacks = handlers;
    byId("discoveries-view-link").addEventListener("click", (event) => {
      event.preventDefault();
      callbacks.onViewChange("discoveries");
    });
    byId("snapshot-button").addEventListener("click", () => {
      const context = callbacks.getSnapshotContext();
      if (context.atLimit) {
        callbacks.onViewChange("discoveries");
        announce("Five snapshots are already saved. Delete one before saving another.");
        return;
      }
      byId("snapshot-name").value = context.defaultName;
      byId("snapshot-note").value = "";
      byId("snapshot-create-dialog").showModal();
      byId("snapshot-name").select();
    });
    byId("snapshot-create-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "cancel") return byId("snapshot-create-dialog").close();
      callbacks.onCreateSnapshot({ name: byId("snapshot-name").value, note: byId("snapshot-note").value });
      byId("snapshot-create-dialog").close();
    });

    byId("snapshot-cards").addEventListener("click", (event) => {
      const control = event.target.closest("button[data-action]");
      if (!control) return;
      const card = control.closest("[data-snapshot-id]");
      const snapshot = snapshotById(card.dataset.snapshotId);
      if (!snapshot) return;
      activeSnapshotId = snapshot.id;
      if (control.dataset.action === "rename-snapshot") {
        byId("snapshot-edit-name").value = snapshot.name;
        byId("snapshot-edit-note").value = snapshot.note;
        byId("snapshot-edit-dialog").showModal();
        byId("snapshot-edit-name").select();
      } else {
        byId("snapshot-delete-message").textContent = `Delete ${snapshot.name}? This removes the saved physical Planet State.`;
        byId("snapshot-delete-dialog").showModal();
      }
    });
    byId("snapshot-edit-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "cancel") return byId("snapshot-edit-dialog").close();
      callbacks.onEditSnapshot(activeSnapshotId, { name: byId("snapshot-edit-name").value, note: byId("snapshot-edit-note").value });
      byId("snapshot-edit-dialog").close();
    });
    byId("snapshot-delete-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "delete") callbacks.onDeleteSnapshot(activeSnapshotId);
      byId("snapshot-delete-dialog").close();
    });
    byId("clear-snapshots-button").addEventListener("click", () => byId("clear-snapshots-dialog").showModal());
    byId("clear-snapshots-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "clear") callbacks.onClearSnapshots();
      byId("clear-snapshots-dialog").close();
    });

    ["compare-snapshot-a", "compare-snapshot-b", "comparison-life-category"].forEach((id) => {
      byId(id).addEventListener("change", () => callbacks.onComparisonChange({
        snapshotAId: byId("compare-snapshot-a").value,
        snapshotBId: byId("compare-snapshot-b").value,
        lifeCategoryId: byId("comparison-life-category").value,
      }));
    });

    byId("suggestion-cards").addEventListener("click", (event) => {
      const control = event.target.closest("button[data-action='save-suggestion']");
      if (!control) return;
      const suggestion = visibleSuggestions[Number(control.dataset.suggestionIndex)];
      if (suggestion) openDiscoveryDialog(suggestion, false);
    });
    byId("add-student-note-button").addEventListener("click", () => {
      const selected = [renderedModel.selectedAId, renderedModel.selectedBId]
        .map(snapshotById).filter(Boolean);
      openDiscoveryDialog(App.comparison.studentNoteSuggestion(
        selected.map((snapshot) => snapshot.id),
        selected.map((snapshot) => snapshot.name)
      ), true);
    });
    byId("discovery-save-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "cancel") return byId("discovery-save-dialog").close();
      callbacks.onSaveDiscovery(activeSuggestion, {
        title: byId("discovery-title-input").value,
        note: byId("discovery-note-input").value,
      });
      byId("discovery-save-dialog").close();
    });
    byId("clear-discoveries-button").addEventListener("click", () => byId("clear-discoveries-dialog").showModal());
    byId("clear-discoveries-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "clear") callbacks.onClearDiscoveries();
      byId("clear-discoveries-dialog").close();
    });
  }

  App.discoveriesUI = Object.freeze({ render, setView, setupStaticInteractions, announce });
})(window.HabitablePlanet = window.HabitablePlanet || {});

(function (App) {
  "use strict";

  let callbacks = null;
  let renderedModel = null;
  let previewMode = false;

  function byId(id) { return document.getElementById(id); }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function announce(message) {
    const region = byId("report-live-status");
    region.textContent = "";
    window.requestAnimationFrame(() => { region.textContent = message; });
  }

  function addDefinition(list, label, value) {
    const wrapper = node("div");
    wrapper.append(node("dt", null, label), node("dd", null, value));
    list.append(wrapper);
  }

  function optionCard(id, label, description, checked, group, disabled = false) {
    const wrapper = node("label", "report-option");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.disabled = disabled;
    input.dataset.reportList = group;
    input.dataset.recordId = id;
    const text = node("span");
    text.append(node("strong", null, label));
    if (description) text.append(node("small", null, description));
    wrapper.append(input, text);
    return wrapper;
  }

  function emptyOption(text) {
    return node("p", "empty-workspace", text);
  }

  function populateSubject(model) {
    const select = byId("report-subject");
    select.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = model.availableSnapshots.length ? "Select a saved snapshot" : "No snapshots available";
    empty.selected = !model.draft.subjectSnapshotId;
    select.append(empty);
    if (model.subjectMissing) {
      const missing = document.createElement("option");
      missing.value = model.draft.subjectSnapshotId;
      missing.textContent = `${model.subjectLabel || "Selected snapshot"} — no longer available`;
      missing.selected = true;
      missing.disabled = true;
      select.append(missing);
    }
    model.availableSnapshots.forEach((snapshot) => {
      const option = document.createElement("option");
      option.value = snapshot.id;
      option.textContent = `${snapshot.name} (Snapshot ${snapshot.creationOrder})`;
      option.selected = snapshot.id === model.draft.subjectSnapshotId;
      select.append(option);
    });
    select.disabled = model.availableSnapshots.length === 0;
  }

  function renderPhysicalOptions(model) {
    const container = byId("report-physical-options");
    container.replaceChildren();
    if (!model.subject) {
      container.append(emptyOption("Select the final planet before choosing physical evidence."));
      return;
    }
    model.physicalEvidence.forEach((item) => {
      container.append(optionCard(item.id, item.label, item.value, item.selected, "selectedPhysicalEvidenceIds"));
    });
  }

  function renderLifeOptions(model) {
    const container = byId("report-life-options");
    container.replaceChildren();
    if (!model.subject) {
      container.append(emptyOption("Select the final planet before choosing detailed Life Lab evidence."));
      return;
    }
    model.life.forEach((result) => {
      container.append(optionCard(
        result.category.id,
        result.category.name,
        `${result.status} · expand the full evidence chain`,
        result.expanded,
        "expandedLifeCategoryIds"
      ));
    });
  }

  function renderExperimentOptions(model) {
    const container = byId("report-experiment-options");
    container.replaceChildren();
    if (model.availableSnapshots.length === 0) {
      container.append(emptyOption("No saved experiments are available."));
      return;
    }
    const selected = new Set(model.draft.selectedExperimentSnapshotIds);
    model.availableSnapshots.forEach((snapshot) => {
      const state = snapshot.physical.planetState;
      container.append(optionCard(
        snapshot.id,
        snapshot.name,
        snapshot.note || `${state.climate.meanSurfaceTemperatureC.toFixed(1)}°C · ${state.statuses.water.status}`,
        selected.has(snapshot.id),
        "selectedExperimentSnapshotIds"
      ));
    });
    model.missingExperimentIds.forEach((id) => {
      container.append(optionCard(id, "Unavailable selected snapshot", "Remove this missing reference or choose another experiment.", true, "selectedExperimentSnapshotIds"));
    });
  }

  function populateSnapshotSelect(select, snapshots, selectedId, otherId) {
    select.replaceChildren();
    snapshots.forEach((snapshot) => {
      const option = document.createElement("option");
      option.value = snapshot.id;
      option.textContent = snapshot.name;
      option.selected = snapshot.id === selectedId;
      option.disabled = snapshot.id === otherId;
      select.append(option);
    });
    select.disabled = snapshots.length < 2;
  }

  function renderComparisonControls(model) {
    const enabled = Boolean(model.draft.comparison);
    byId("report-include-comparison").checked = enabled;
    byId("report-include-comparison").disabled = model.availableSnapshots.length < 2;
    byId("report-comparison-controls").hidden = !enabled;
    if (!enabled) return;
    populateSnapshotSelect(byId("report-comparison-a"), model.availableSnapshots, model.draft.comparison.snapshotAId, model.draft.comparison.snapshotBId);
    populateSnapshotSelect(byId("report-comparison-b"), model.availableSnapshots, model.draft.comparison.snapshotBId, model.draft.comparison.snapshotAId);
    byId("report-comparison-life").value = model.draft.comparison.lifeCategoryId;
  }

  function renderDiscoveryOptions(model) {
    const container = byId("report-discovery-options");
    container.replaceChildren();
    if (model.availableDiscoveries.length === 0 && model.missingDiscoveryIds.length === 0) {
      container.append(emptyOption("No Discovery Log entries are available. The report can still be completed with model evidence and your own reasoning."));
      return;
    }
    const selected = new Set(model.draft.selectedDiscoveryIds);
    model.availableDiscoveries.forEach((record) => {
      container.append(optionCard(
        record.id,
        record.title,
        `${record.category} · ${record.studentAction}`,
        selected.has(record.id),
        "selectedDiscoveryIds"
      ));
    });
    model.missingDiscoveryIds.forEach((id) => {
      container.append(optionCard(id, "Unavailable selected discovery", "Remove this missing reference or select another discovery.", true, "selectedDiscoveryIds"));
    });
  }

  function renderWriting(model, preserveEditor) {
    Object.entries(model.draft.writing).forEach(([key, value]) => {
      const field = byId(`writing-${key}`);
      if (!field) return;
      if (!preserveEditor || document.activeElement !== field) field.value = value;
    });
  }

  function renderMissingReferenceNotice(model) {
    let existing = byId("report-missing-references");
    if (!model.missingReferences) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = node("p", "report-source-warning");
      existing.id = "report-missing-references";
      byId("report-form").prepend(existing);
    }
    existing.textContent = "Some selected evidence is no longer available. Your writing has been preserved; remove or replace the missing references before relying on them in the report.";
  }

  function section(title, className) {
    const element = node("section", `report-page-section ${className || ""}`.trim());
    element.append(node("h2", null, title));
    return element;
  }

  function evidenceList(items, expanded) {
    const list = node("ul", expanded ? "report-detailed-evidence" : "report-compact-evidence");
    if (items.length === 0) {
      list.append(node("li", "report-no-evidence", "No evidence recorded in this group."));
      return list;
    }
    items.forEach((item) => {
      const entry = node("li");
      entry.append(node("strong", null, item.title));
      if (expanded) {
        entry.append(
          node("span", null, item.condition),
          node("span", null, item.consequence),
          node("span", null, item.implication)
        );
      }
      list.append(entry);
    });
    return list;
  }

  function renderLifeCard(result) {
    const card = node("article", "report-life-card");
    card.dataset.status = result.status;
    const header = node("header");
    header.append(node("h3", null, result.category.name), node("p", "report-life-status", result.status));
    card.append(header, node("p", "report-model-label", "Model-generated biological interpretation"), node("p", null, result.summary));
    [
      ["Supporting Conditions", result.evidence.supporting],
      ["Limiting Conditions", result.evidence.limiting],
      ["Important Uncertainty", result.evidence.uncertainty],
    ].forEach(([heading, items]) => {
      const group = node("section", "report-life-evidence-group");
      group.append(node("h4", null, heading), evidenceList(items, result.expanded));
      card.append(group);
    });
    return card;
  }

  function renderComparison(comparison) {
    const block = section("Selected Snapshot Comparison", "report-comparison-section");
    const mode = node("p", "report-comparison-mode", `${comparison.mode[0].toUpperCase()}${comparison.mode.slice(1)} comparison`);
    block.append(node("p", "report-model-label", "Model evidence from the accepted Phase 3 comparison interpreter"), mode, node("p", null, comparison.mission.observation), node("p", null, comparison.mission.why));

    const changedHeading = node("h3", null, "Student-Controlled Differences");
    const changed = node("ul");
    const changedRows = comparison.inputDifferences.filter((row) => row.changed);
    if (changedRows.length === 0) changed.append(node("li", null, "No validated student-controlled input differs."));
    changedRows.forEach((row) => changed.append(node("li", null, `${row.label}: ${row.valueA} → ${row.valueB}`)));
    block.append(changedHeading, changed);

    const responseHeading = node("h3", null, "Model Response");
    const responses = node("ul");
    const responseRows = comparison.modelResponses.filter((row) => row.changed);
    if (responseRows.length === 0) responses.append(node("li", null, "No calculated result changed at displayed precision."));
    responseRows.forEach((row) => responses.append(node("li", null, `${row.label}: ${row.valueA} → ${row.valueB} (${row.direction})`)));
    block.append(responseHeading, responses);

    const causalHeading = node("h3", null, "Scientific Interpretation");
    const chain = node("ol", "report-causal-chain");
    comparison.mission.chain.forEach((step) => chain.append(node("li", null, step)));
    block.append(causalHeading, chain);
    if (comparison.life) {
      block.append(node("h3", null, `Same-Category Life Lab: ${comparison.life.categoryName}`));
      const life = node("p", null, `Snapshot A: ${comparison.life.resultA.status}. Snapshot B: ${comparison.life.resultB.status}. Changing the biological question did not change either physical planet.`);
      block.append(life);
    }
    return block;
  }

  function writingSection(model) {
    const block = section("Student Scientific Reasoning", "student-authored-section");
    block.append(node("p", "report-student-label", "Student-authored content"));
    const labels = {
      environmentalSummary: "Environmental Summary",
      lifeCompatibility: "Life Compatibility",
      majorLimitation: "Major Limitation",
      scientificEvidence: "Scientific Evidence",
      uncertainty: "Important Uncertainty",
      finalConclusion: "Final Conclusion",
    };
    Object.entries(labels).forEach(([key, label]) => {
      const article = node("section", "student-writing-block");
      article.append(node("h3", null, label));
      const text = model.draft.writing[key].trim();
      article.append(node("p", text ? null : "report-incomplete", text || "Not yet completed."));
      block.append(article);
    });
    return block;
  }

  function renderPreview(model) {
    const documentRoot = byId("report-document");
    documentRoot.replaceChildren();
    const title = node("h1", null, "Planetary Habitability Report");
    title.id = "report-document-title";
    documentRoot.append(title, node("p", "report-principle", "This report documents modeled environmental compatibility and student scientific reasoning. Compatible does not mean inhabited."));

    if (!model.subject) {
      const empty = section("Final Planet Not Selected", "report-empty-document");
      empty.append(node("p", null, model.subjectMissing
        ? `${model.subjectLabel || "The selected snapshot"} is no longer available. Your writing remains saved; choose another report subject.`
        : "Select a saved snapshot in Edit Report to populate factual evidence."));
      documentRoot.append(empty, writingSection(model));
      return;
    }

    const subjectState = model.state;
    const hero = node("section", "report-planet-hero");
    const visual = App.ui.createPlanetPreview(subjectState, `report-${model.subject.id}`, `Final report planet, ${model.subject.name}`);
    const visualWrap = node("div", "report-planet-visual");
    visualWrap.append(visual);
    const intro = node("div");
    intro.append(
      node("p", "report-model-label", "Selected immutable Snapshot Record"),
      node("h2", null, model.subject.name),
      node("p", null, `${subjectState.inputs.planetName} orbits a ${subjectState.physics.star.shortName} at ${subjectState.inputs.orbitalDistance.toFixed(2)} AU.`),
      node("p", "report-planet-description", visual.querySelector("desc") ? visual.querySelector("desc").textContent : "Modeled planet visualization; complete evidence follows in text.")
    );
    hero.append(visualWrap, intro);
    documentRoot.append(hero);

    const identity = section("Planet Identity", "report-identity-section");
    identity.append(node("p", "report-model-label", "Student-controlled inputs preserved in the selected snapshot"));
    const identityList = node("dl", "report-data-list");
    model.identity.forEach((row) => addDefinition(identityList, row.label, row.value));
    identity.append(identityList);
    documentRoot.append(identity);

    const physical = section("Selected Physical Evidence", "report-physical-section");
    physical.append(node("p", "report-model-label", "Model-calculated results selected by the student"));
    if (model.selectedPhysicalEvidence.length === 0) {
      physical.append(node("p", "report-incomplete", "Add physical evidence in Edit Report."));
    } else {
      const physicalList = node("dl", "report-data-list");
      model.selectedPhysicalEvidence.forEach((row) => addDefinition(physicalList, row.label, row.value));
      physical.append(physicalList);
    }
    documentRoot.append(physical);

    const systems = section("Planetary Systems Interpretation", "report-systems-section");
    systems.append(node("p", "report-model-label", "Model evidence; Protection and Environmental Stability remain preliminary and non-scoring"));
    const systemGrid = node("div", "report-system-grid");
    model.systems.forEach((system) => {
      const card = node("article", "report-system-card");
      card.append(node("h3", null, system.name), node("p", "report-system-status", system.status), node("p", null, system.evidence), node("p", null, system.detail));
      if (system.preliminary) card.append(node("p", "report-preliminary", "Preliminary · non-scoring evidence"));
      systemGrid.append(card);
    });
    systems.append(systemGrid);
    documentRoot.append(systems);

    const life = section("Life Lab Findings", "report-life-section");
    life.append(node("p", "report-model-label", "Saved Phase 2 interpretations. These categories describe environmental compatibility, not the presence of life."));
    const lifeGrid = node("div", "report-life-grid");
    model.life.forEach((result) => lifeGrid.append(renderLifeCard(result)));
    life.append(lifeGrid);
    documentRoot.append(life);

    if (model.selectedExperiments.length > 0 || model.missingExperimentIds.length > 0) {
      const experiments = section("Selected Experiments", "report-experiments-section");
      experiments.append(node("p", "report-model-label", "Student-selected immutable snapshots"));
      const grid = node("div", "report-experiment-grid");
      model.selectedExperiments.forEach((experiment) => {
        const card = node("article", "report-experiment-card");
        card.append(node("h3", null, experiment.name));
        if (experiment.note) card.append(node("p", "report-student-label", `Investigation note: ${experiment.note}`));
        const facts = node("dl", "report-data-list compact");
        addDefinition(facts, "Star / orbit", `${experiment.star} · ${experiment.orbit}`);
        addDefinition(facts, "Temperature", experiment.temperature);
        addDefinition(facts, "Water", experiment.water);
        addDefinition(facts, "Confidence", experiment.confidence);
        card.append(facts);
        grid.append(card);
      });
      experiments.append(grid);
      if (model.missingExperimentIds.length) experiments.append(node("p", "report-source-warning", `${model.missingExperimentIds.length} selected experiment reference is unavailable.`));
      documentRoot.append(experiments);
    }

    if (model.comparison) documentRoot.append(renderComparison(model.comparison));
    else if (model.comparisonMissing) {
      const comparisonMissing = section("Selected Snapshot Comparison", "report-comparison-section");
      comparisonMissing.append(node("p", "report-source-warning", "A selected comparison snapshot is no longer available. Choose a new A/B pair in Edit Report."));
      documentRoot.append(comparisonMissing);
    }

    if (model.selectedDiscoveries.length > 0 || model.missingDiscoveryIds.length > 0) {
      const discoveries = section("Selected Discoveries", "report-discoveries-section");
      discoveries.append(node("p", "report-model-label", "Student-selected Discovery Log evidence"));
      model.selectedDiscoveries.forEach((record) => {
        const card = node("article", "report-discovery-card");
        card.append(node("h3", null, record.title), node("p", "report-discovery-meta", `${record.category} · ${record.source}`), node("p", null, record.studentAction));
        if (record.modeledEvidence.length) {
          card.append(node("h4", null, "Modeled Evidence"));
          const evidence = node("ul");
          record.modeledEvidence.forEach((text) => evidence.append(node("li", null, text)));
          card.append(evidence);
        }
        if (record.causalChain.length) {
          card.append(node("h4", null, "Causal Relationship"));
          const chain = node("ol");
          record.causalChain.forEach((text) => chain.append(node("li", null, text)));
          card.append(chain);
        }
        if (record.note) card.append(node("p", "report-student-label", `Student note: ${record.note}`));
        discoveries.append(card);
      });
      if (model.missingDiscoveryIds.length) discoveries.append(node("p", "report-source-warning", `${model.missingDiscoveryIds.length} selected discovery reference is unavailable.`));
      documentRoot.append(discoveries);
    }

    documentRoot.append(writingSection(model));

    const limits = section("Model Limitations", "report-limitations-section");
    limits.append(node("p", "report-model-label", "Scope of this educational model"));
    const limitList = node("ul");
    model.limitations.forEach((text) => limitList.append(node("li", null, text)));
    limits.append(limitList);
    documentRoot.append(limits);
  }

  function renderValidation(model, forceVisible = false) {
    const summary = byId("report-validation-summary");
    const list = byId("report-validation-list");
    list.replaceChildren();
    model.validationErrors.forEach((error) => {
      const item = node("li");
      const link = node("a", null, error.message);
      link.href = `#${error.fieldId}`;
      item.append(link);
      list.append(item);
    });
    summary.hidden = !(forceVisible && model.validationErrors.length > 0);
  }

  function setMode(mode, focusHeading = false) {
    previewMode = mode === "preview";
    byId("report-editor").hidden = previewMode;
    byId("report-preview-panel").hidden = !previewMode;
    byId("report-edit-mode").setAttribute("aria-pressed", String(!previewMode));
    byId("report-preview-mode").setAttribute("aria-pressed", String(previewMode));
    if (focusHeading) byId(previewMode ? "report-preview-heading" : "report-editor-title").focus({ preventScroll: true });
  }

  function render(model, options = {}) {
    renderedModel = model;
    byId("report-storage-status").textContent = model.storageInfo.message;
    byId("report-storage-status").dataset.persistent = String(model.storageInfo.persistent);
    if (!options.preserveEditor) {
      populateSubject(model);
      renderPhysicalOptions(model);
      renderLifeOptions(model);
      renderExperimentOptions(model);
      renderComparisonControls(model);
      renderDiscoveryOptions(model);
    }
    renderWriting(model, Boolean(options.preserveEditor));
    renderMissingReferenceNotice(model);
    renderPreview(model);
    renderValidation(model, false);
    setMode(previewMode, false);
  }

  function setView(view) {
    const reportMode = view === "report";
    byId("report-workspace").hidden = !reportMode;
    byId("report-view-link").toggleAttribute("aria-current", reportMode);
    document.body.classList.toggle("report-mode", reportMode);
    document.querySelector(".laboratory-shell").classList.toggle("is-report-mode", reportMode);
    if (reportMode) {
      ["engineering", "living-planet", "planetary-status", "life-lab", "discoveries-workspace"].forEach((id) => { byId(id).hidden = true; });
      document.querySelector(".mission-control").hidden = true;
      document.querySelector(".recent-changes").hidden = true;
    } else {
      document.querySelector(".mission-control").hidden = false;
    }
  }

  function patchList(key, id, checked) {
    const current = renderedModel.draft[key].slice();
    const next = checked ? [...new Set([...current, id])] : current.filter((value) => value !== id);
    callbacks.onDraftChange({ [key]: next }, false);
  }

  function comparisonPatch() {
    return {
      snapshotAId: byId("report-comparison-a").value,
      snapshotBId: byId("report-comparison-b").value,
      lifeCategoryId: byId("report-comparison-life").value,
    };
  }

  function showPreview() {
    setMode("preview", true);
    byId("report-workspace").scrollIntoView({ block: "start" });
  }

  function setupStaticInteractions(handlers) {
    callbacks = handlers;
    byId("report-view-link").addEventListener("click", (event) => {
      event.preventDefault();
      callbacks.onViewChange("report");
    });
    byId("report-edit-mode").addEventListener("click", () => setMode("edit", true));
    byId("report-preview-mode").addEventListener("click", showPreview);
    byId("preview-report-button").addEventListener("click", showPreview);
    byId("return-to-report-edit").addEventListener("click", () => setMode("edit", true));
    byId("report-go-snapshots").addEventListener("click", () => callbacks.onViewChange("discoveries"));

    byId("report-subject").addEventListener("change", (event) => {
      const snapshot = renderedModel.availableSnapshots.find((item) => item.id === event.target.value);
      callbacks.onDraftChange({
        subjectSnapshotId: snapshot ? snapshot.id : null,
        lastKnownSubjectLabel: snapshot ? snapshot.name : "",
      }, false);
    });

    byId("report-form").addEventListener("change", (event) => {
      const input = event.target.closest("input[data-report-list]");
      if (input) patchList(input.dataset.reportList, input.dataset.recordId, input.checked);
    });
    byId("report-form").addEventListener("input", (event) => {
      const field = event.target.closest("textarea[data-writing-key]");
      if (field) callbacks.onDraftChange({ writing: { [field.dataset.writingKey]: field.value } }, true);
    });

    byId("report-include-comparison").addEventListener("change", (event) => {
      if (!event.target.checked) return callbacks.onDraftChange({ comparison: null }, false);
      if (renderedModel.availableSnapshots.length < 2) {
        event.target.checked = false;
        announce("Save at least two snapshots before adding a comparison.");
        return;
      }
      callbacks.onDraftChange({ comparison: {
        snapshotAId: renderedModel.availableSnapshots[0].id,
        snapshotBId: renderedModel.availableSnapshots[1].id,
        lifeCategoryId: "microbial",
      } }, false);
    });
    ["report-comparison-a", "report-comparison-b", "report-comparison-life"].forEach((id) => {
      byId(id).addEventListener("change", () => callbacks.onDraftChange({ comparison: comparisonPatch() }, false));
    });

    byId("clear-report-button").addEventListener("click", () => byId("clear-report-dialog").showModal());
    byId("clear-report-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (event.submitter.value === "clear") callbacks.onClearReport();
      byId("clear-report-dialog").close();
    });

    byId("print-report-button").addEventListener("click", () => {
      if (!renderedModel.validForPrint) {
        renderValidation(renderedModel, true);
        setMode("edit", false);
        byId("report-validation-summary").focus();
        announce("The report needs a selected final planet and a student-written final conclusion before printing.");
        return;
      }
      window.print();
    });
  }

  App.reportUI = Object.freeze({ render, setView, setupStaticInteractions, announce });
})(window.HabitablePlanet = window.HabitablePlanet || {});

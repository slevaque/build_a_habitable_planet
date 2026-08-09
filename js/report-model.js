(function (App) {
  "use strict";

  const freeze = App.experimentRecords.deepFreeze;

  function gas(value) {
    if (value === 0) return "0%";
    if (value < 0.001) return `${value.toFixed(4)}%`;
    if (value < 0.1) return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
    return `${value.toFixed(value < 1 ? 2 : 1).replace(/\.0$/, "")}%`;
  }

  const physicalDefinitions = Object.freeze([
    Object.freeze({ id: "stellar-flux", label: "Stellar Flux", format: (s) => `${s.physics.stellarFluxEarth.toFixed(2)} × Earth` }),
    Object.freeze({ id: "albedo", label: "Planetary Albedo", format: (s) => s.climate.planetaryAlbedo.toFixed(3) }),
    Object.freeze({ id: "equilibrium-temperature", label: "Equilibrium Temperature", format: (s) => `${s.climate.equilibriumTemperatureC.toFixed(1)}°C` }),
    Object.freeze({ id: "surface-temperature", label: "Mean Surface Temperature", format: (s) => `${s.climate.meanSurfaceTemperatureC.toFixed(1)}°C` }),
    Object.freeze({ id: "gravity", label: "Surface Gravity", format: (s) => `${s.physics.surfaceGravityEarth.toFixed(2)} g` }),
    Object.freeze({ id: "escape-velocity", label: "Escape Velocity", format: (s) => `${s.physics.escapeVelocityKms.toFixed(1)} km/s` }),
    Object.freeze({ id: "atmospheric-column", label: "Atmospheric Column", format: (s) => `${s.physics.atmosphericColumnEarth.toFixed(2)} × Earth` }),
    Object.freeze({ id: "water-state", label: "Water State", format: (s) => `${s.statuses.water.status} · ${(s.climate.liquidWaterFraction * 100).toFixed(0)}% liquid · ${(s.climate.iceFraction * 100).toFixed(0)}% ice` }),
    Object.freeze({ id: "water-persistence", label: "Water Persistence", format: (s) => s.climate.waterPersistence }),
    Object.freeze({ id: "climate-confidence", label: "Climate Confidence", format: (s) => `${s.climate.modelConfidence} · ${s.climate.converged ? "solver converged" : "solver did not converge"}` }),
  ]);

  const limitations = Object.freeze([
    "Climate values are global means and do not resolve local weather, seasons, or microclimates.",
    "Clouds, atmospheric heat transport, greenhouse behavior, and pressure-dependent water physics are simplified for education.",
    "The model does not calculate detailed atmospheric chemistry, ocean chemistry, or subsurface habitats.",
    "Protection, radiation, atmospheric retention, and Environmental Stability remain preliminary, non-scoring evidence.",
    "Life Lab interprets environmental compatibility; it does not detect life or calculate a probability that life exists.",
    "The model does not simulate ecosystems, evolution, intelligence, or terraforming.",
  ]);

  function findById(records, id) {
    return records.find((record) => record.id === id) || null;
  }

  function identityRows(state) {
    return freeze([
      { label: "Planet Name", value: state.inputs.planetName },
      { label: "Star Type", value: state.physics.star.shortName },
      { label: "Orbital Distance", value: `${state.inputs.orbitalDistance.toFixed(2)} AU` },
      { label: "Planet Mass", value: `${state.inputs.planetMass.toFixed(1)} M⊕` },
      { label: "Atmospheric Pressure", value: `${state.inputs.atmosphericPressure.toFixed(2)} atm` },
      { label: "Atmospheric Composition", value: `N₂ ${gas(state.inputs.nitrogenPct)} · O₂ ${gas(state.inputs.oxygenPct)} · CO₂ ${gas(state.inputs.carbonDioxidePct)} · CH₄ ${gas(state.inputs.methanePct)}` },
      { label: "Surface Water Inventory", value: `${state.inputs.surfaceWaterInventory}%` },
      { label: "Geologic Activity", value: state.inputs.geologicActivity },
      { label: "Magnetic Field Strength", value: state.inputs.magneticField },
    ]);
  }

  function physicalEvidence(state, selectedIds) {
    const selected = new Set(selectedIds);
    return freeze(physicalDefinitions.map((definition) => freeze({
      id: definition.id,
      label: definition.label,
      value: definition.format(state),
      selected: selected.has(definition.id),
    })));
  }

  function systemEvidence(state) {
    return freeze(Object.values(state.statuses).map((status) => freeze({
      name: status.name,
      status: status.status,
      evidence: status.evidence,
      detail: status.detail,
      preliminary: Boolean(status.temporaryNonScoring),
    })));
  }

  function lifeEvidence(snapshot, expandedIds) {
    const expanded = new Set(expandedIds);
    return freeze(snapshot.biological.interpretations.map((result) => freeze({
      ...result,
      expanded: expanded.has(result.category.id),
    })));
  }

  function experimentSummary(snapshot) {
    const state = snapshot.physical.planetState;
    return freeze({
      id: snapshot.id,
      name: snapshot.name,
      note: snapshot.note,
      creationOrder: snapshot.creationOrder,
      planetName: state.inputs.planetName,
      star: state.physics.star.shortName,
      orbit: `${state.inputs.orbitalDistance.toFixed(2)} AU`,
      temperature: `${state.climate.meanSurfaceTemperatureC.toFixed(1)}°C`,
      water: `${(state.climate.liquidWaterFraction * 100).toFixed(0)}% liquid · ${(state.climate.iceFraction * 100).toFixed(0)}% ice`,
      confidence: state.climate.modelConfidence,
    });
  }

  function build(experimentState, draft) {
    const snapshots = experimentState.snapshots;
    const discoveries = experimentState.discoveries;
    const subject = draft.subjectSnapshotId ? findById(snapshots, draft.subjectSnapshotId) : null;
    const subjectMissing = Boolean(draft.subjectSnapshotId && !subject);
    const selectedExperiments = draft.selectedExperimentSnapshotIds
      .map((id) => findById(snapshots, id)).filter(Boolean).map(experimentSummary);
    const missingExperimentIds = draft.selectedExperimentSnapshotIds
      .filter((id) => !findById(snapshots, id));
    const selectedDiscoveries = draft.selectedDiscoveryIds
      .map((id) => findById(discoveries, id)).filter(Boolean);
    const missingDiscoveryIds = draft.selectedDiscoveryIds
      .filter((id) => !findById(discoveries, id));

    let comparison = null;
    let comparisonMissing = false;
    if (draft.comparison) {
      const snapshotA = findById(snapshots, draft.comparison.snapshotAId);
      const snapshotB = findById(snapshots, draft.comparison.snapshotBId);
      comparisonMissing = !snapshotA || !snapshotB;
      if (!comparisonMissing) {
        comparison = App.comparison.compare(snapshotA, snapshotB, draft.comparison.lifeCategoryId);
      }
    }

    const validationErrors = [];
    if (!draft.subjectSnapshotId) {
      validationErrors.push(freeze({ fieldId: "report-subject", message: "Select a saved snapshot as the report subject." }));
    } else if (subjectMissing) {
      validationErrors.push(freeze({ fieldId: "report-subject", message: `The selected subject ${draft.lastKnownSubjectLabel || "snapshot"} is no longer available. Select another saved snapshot.` }));
    }
    if (!draft.writing.finalConclusion.trim()) {
      validationErrors.push(freeze({ fieldId: "writing-finalConclusion", message: "Write your final scientific conclusion in your own words." }));
    }

    const state = subject ? subject.physical.planetState : null;
    return freeze({
      draft,
      subject,
      subjectMissing,
      subjectLabel: subject ? subject.name : draft.lastKnownSubjectLabel,
      state,
      identity: state ? identityRows(state) : [],
      physicalEvidence: state ? physicalEvidence(state, draft.selectedPhysicalEvidenceIds) : [],
      selectedPhysicalEvidence: state
        ? physicalEvidence(state, draft.selectedPhysicalEvidenceIds).filter((item) => item.selected)
        : [],
      systems: state ? systemEvidence(state) : [],
      life: subject ? lifeEvidence(subject, draft.expandedLifeCategoryIds) : [],
      selectedExperiments,
      selectedDiscoveries,
      comparison,
      comparisonMissing,
      missingExperimentIds: freeze(missingExperimentIds),
      missingDiscoveryIds: freeze(missingDiscoveryIds),
      missingReferences: subjectMissing || comparisonMissing || missingExperimentIds.length > 0 || missingDiscoveryIds.length > 0,
      limitations,
      validationErrors: freeze(validationErrors),
      validForPrint: validationErrors.length === 0,
      availableSnapshots: snapshots,
      availableDiscoveries: discoveries,
    });
  }

  App.reportModel = Object.freeze({ physicalDefinitions, limitations, build });
})(window.HabitablePlanet = window.HabitablePlanet || {});

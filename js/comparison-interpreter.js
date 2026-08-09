(function (App) {
  "use strict";

  const freeze = App.experimentRecords.deepFreeze;
  const categoriesByInput = Object.freeze({
    starType: "Stellar Energy",
    orbitalDistance: "Stellar Energy",
    planetMass: "Planetary Physics",
    atmosphericPressure: "Atmosphere",
    oxygenPct: "Atmosphere",
    carbonDioxidePct: "Atmosphere",
    methanePct: "Atmosphere",
    surfaceWaterInventory: "Water",
    geologicActivity: "Environmental Stability",
    magneticField: "Protection",
  });

  const atomicLabels = Object.freeze({
    starType: "Star Type",
    orbitalDistance: "Orbital Distance",
    planetMass: "Planet Mass",
    atmosphericPressure: "Atmospheric Pressure",
    oxygenPct: "Oxygen",
    carbonDioxidePct: "Carbon Dioxide",
    methanePct: "Methane",
    surfaceWaterInventory: "Surface Water Inventory",
    geologicActivity: "Geologic Activity",
    magneticField: "Magnetic Field Strength",
  });

  function gas(value) {
    if (value === 0) return "0%";
    if (value < 0.001) return `${value.toFixed(4)}%`;
    if (value < 0.1) return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
    return `${value.toFixed(value < 1 ? 2 : 1).replace(/\.0$/, "")}%`;
  }

  const inputGroups = Object.freeze([
    Object.freeze({
      id: "star",
      label: "Star Type",
      keys: ["starType"],
      format: (state) => state.physics.star.shortName,
    }),
    Object.freeze({
      id: "orbit",
      label: "Orbital Distance",
      keys: ["orbitalDistance"],
      format: (state) => `${state.inputs.orbitalDistance.toFixed(2)} AU`,
    }),
    Object.freeze({
      id: "mass",
      label: "Planet Mass",
      keys: ["planetMass"],
      format: (state) => `${state.inputs.planetMass.toFixed(1)} M⊕`,
    }),
    Object.freeze({
      id: "pressure",
      label: "Atmospheric Pressure",
      keys: ["atmosphericPressure"],
      format: (state) => `${state.inputs.atmosphericPressure.toFixed(2)} atm`,
    }),
    Object.freeze({
      id: "composition",
      label: "Atmospheric Composition",
      keys: ["oxygenPct", "carbonDioxidePct", "methanePct"],
      format: (state) => `N₂ ${gas(state.inputs.nitrogenPct)} · O₂ ${gas(state.inputs.oxygenPct)} · CO₂ ${gas(state.inputs.carbonDioxidePct)} · CH₄ ${gas(state.inputs.methanePct)}`,
    }),
    Object.freeze({
      id: "water",
      label: "Surface Water Inventory",
      keys: ["surfaceWaterInventory"],
      format: (state) => `${state.inputs.surfaceWaterInventory}%`,
    }),
    Object.freeze({
      id: "geology",
      label: "Geologic Activity",
      keys: ["geologicActivity"],
      format: (state) => state.inputs.geologicActivity,
    }),
    Object.freeze({
      id: "magnetic",
      label: "Magnetic Field Strength",
      keys: ["magneticField"],
      format: (state) => state.inputs.magneticField,
    }),
  ]);

  function scientificState(snapshot) {
    return snapshot.physical.planetState;
  }

  function atomicDifferenceKeys(stateA, stateB) {
    return Object.keys(atomicLabels).filter((key) => stateA.inputs[key] !== stateB.inputs[key]);
  }

  function inputComparison(group, stateA, stateB) {
    const valueA = group.format(stateA);
    const valueB = group.format(stateB);
    const changedKeys = group.keys.filter((key) => stateA.inputs[key] !== stateB.inputs[key]);
    return freeze({
      id: group.id,
      label: group.label,
      valueA,
      valueB,
      changed: changedKeys.length > 0,
      changedKeys,
    });
  }

  function responseComparison(id, label, stateA, stateB, getValue, formatValue) {
    const exactA = getValue(stateA);
    const exactB = getValue(stateB);
    const valueA = formatValue(exactA, stateA);
    const valueB = formatValue(exactB, stateB);
    let direction = "changed";
    if (typeof exactA === "number" && typeof exactB === "number") {
      direction = exactB > exactA ? "increased" : exactB < exactA ? "decreased" : "unchanged";
    } else if (valueA === valueB) {
      direction = "unchanged";
    }
    return freeze({
      id,
      label,
      valueA,
      valueB,
      exactA,
      exactB,
      changed: valueA !== valueB,
      direction: valueA === valueB ? "unchanged at displayed precision" : direction,
    });
  }

  function buildResponses(stateA, stateB) {
    const rows = [
      responseComparison("flux", "Stellar Flux", stateA, stateB, (s) => s.physics.stellarFluxEarth, (v) => `${v.toFixed(2)} × Earth`),
      responseComparison("temperature", "Mean Surface Temperature", stateA, stateB, (s) => s.climate.meanSurfaceTemperatureC, (v) => `${v.toFixed(1)}°C`),
      responseComparison("albedo", "Planetary Albedo", stateA, stateB, (s) => s.climate.planetaryAlbedo, (v) => v.toFixed(3)),
      responseComparison("water", "Water State", stateA, stateB, (s) => `${s.statuses.water.status}|${s.climate.liquidWaterFraction.toFixed(2)}|${s.climate.iceFraction.toFixed(2)}`, (v, s) => `${s.statuses.water.status} · ${(s.climate.liquidWaterFraction * 100).toFixed(0)}% liquid · ${(s.climate.iceFraction * 100).toFixed(0)}% ice`),
      responseComparison("column", "Atmospheric Column", stateA, stateB, (s) => s.physics.atmosphericColumnEarth, (v) => `${v.toFixed(2)} × Earth`),
      responseComparison("gravity", "Surface Gravity", stateA, stateB, (s) => s.physics.surfaceGravityEarth, (v) => `${v.toFixed(2)} g`),
      responseComparison("escape", "Escape Velocity", stateA, stateB, (s) => s.physics.escapeVelocityKms, (v) => `${v.toFixed(1)} km/s`),
    ];
    const statusKeys = ["energyBalance", "water", "atmosphere", "protection", "environmentalStability"];
    statusKeys.forEach((key) => {
      rows.push(responseComparison(
        `status-${key}`,
        `${stateA.statuses[key].name} Status`,
        stateA,
        stateB,
        (s) => s.statuses[key].status,
        (v) => v
      ));
    });
    return freeze(rows);
  }

  function feedbackSignatures(stateA, stateB, responses, controlled) {
    if (!controlled) return freeze([]);
    const changed = new Set(responses.filter((row) => row.changed).map((row) => row.id));
    const signatures = [];
    const iceDelta = stateB.climate.iceFraction - stateA.climate.iceFraction;
    const albedoDelta = stateB.climate.planetaryAlbedo - stateA.climate.planetaryAlbedo;
    const temperatureDelta = stateB.climate.meanSurfaceTemperatureC - stateA.climate.meanSurfaceTemperatureC;
    if (changed.has("albedo") && changed.has("temperature") && iceDelta !== 0
      && Math.sign(iceDelta) === Math.sign(albedoDelta)
      && Math.sign(temperatureDelta) === -Math.sign(albedoDelta)) {
      signatures.push(freeze({
        id: "ice-albedo",
        name: "Ice–albedo feedback",
        explanation: iceDelta > 0
          ? "More ice accompanied higher albedo and additional cooling."
          : "Less ice accompanied lower albedo and additional warming.",
        chain: freeze([
          iceDelta > 0 ? "Ice increased" : "Ice decreased",
          albedoDelta > 0 ? "Albedo increased" : "Albedo decreased",
          albedoDelta > 0 ? "Less stellar energy was absorbed" : "More stellar energy was absorbed",
          temperatureDelta > 0 ? "Warming was reinforced" : "Cooling was reinforced",
        ]),
      }));
    }
    const vaporDelta = stateB.climate.waterVaporFeedbackK - stateA.climate.waterVaporFeedbackK;
    if (changed.has("temperature") && vaporDelta !== 0 && Math.sign(vaporDelta) === Math.sign(temperatureDelta)) {
      signatures.push(freeze({
        id: "water-vapor",
        name: "Water-vapor feedback",
        explanation: vaporDelta > 0
          ? "Warmer conditions accompanied stronger bounded water-vapor greenhouse feedback."
          : "Cooler conditions accompanied weaker bounded water-vapor greenhouse feedback.",
        chain: freeze([
          temperatureDelta > 0 ? "Temperature increased" : "Temperature decreased",
          vaporDelta > 0 ? "Water-vapor feedback strengthened" : "Water-vapor feedback weakened",
          temperatureDelta > 0 ? "Additional warming was reinforced" : "Greenhouse reinforcement weakened",
        ]),
      }));
    }
    return freeze(signatures);
  }

  function lifeResult(snapshot, categoryId) {
    return snapshot.biological.interpretations.find((result) => result.category.id === categoryId) || null;
  }

  function evidenceSummary(rows) {
    const changed = rows.filter((row) => row.changed).slice(0, 6).map((row) => `${row.label}: ${row.valueA} → ${row.valueB}`);
    return freeze(changed.length > 0
      ? changed
      : ["No calculated result changed at the interface's displayed precision."]);
  }

  function comparisonSuggestion(snapshotA, snapshotB, changeKey, explanation, responses, feedback) {
    return freeze({
      title: feedback ? feedback.name : `${atomicLabels[changeKey]} experiment`,
      category: feedback ? "Feedback Loop" : categoriesByInput[changeKey],
      source: "comparison",
      relatedSnapshotIds: freeze([snapshotA.id, snapshotB.id]),
      relatedSnapshotLabels: freeze([snapshotA.name, snapshotB.name]),
      studentAction: `Compared ${snapshotA.name} with ${snapshotB.name} while ${atomicLabels[changeKey]} was the only changed input.`,
      modeledEvidence: evidenceSummary(responses),
      causalChain: feedback ? feedback.chain : explanation.chain,
    });
  }

  function lifeSuggestion(snapshotA, snapshotB, resultA, resultB) {
    return freeze({
      title: `${resultA.category.name} across two planets`,
      category: "Life Compatibility",
      source: "life-comparison",
      relatedSnapshotIds: freeze([snapshotA.id, snapshotB.id]),
      relatedSnapshotLabels: freeze([snapshotA.name, snapshotB.name]),
      studentAction: `Compared the same ${resultA.category.name} category on ${snapshotA.name} and ${snapshotB.name}.`,
      modeledEvidence: freeze([
        `${snapshotA.name}: ${resultA.status}`,
        `${snapshotB.name}: ${resultB.status}`,
      ]),
      causalChain: freeze([
        "Two saved physical Planet States were compared",
        `The same ${resultA.category.name} rules interpreted both planets`,
        `Compatibility changed from ${resultA.status} to ${resultB.status}`,
      ]),
    });
  }

  function compare(snapshotA, snapshotB, categoryId) {
    if (!snapshotA || !snapshotB || snapshotA.id === snapshotB.id) return null;
    const stateA = scientificState(snapshotA);
    const stateB = scientificState(snapshotB);
    const changedAtomic = atomicDifferenceKeys(stateA, stateB);
    const inputs = freeze(inputGroups.map((group) => inputComparison(group, stateA, stateB)));
    const responses = buildResponses(stateA, stateB);
    const controlled = changedAtomic.length === 1;
    let explanation = null;
    let mode = "confounded";
    if (controlled) {
      explanation = App.explanations.createExplanation(changedAtomic[0], stateA, stateB);
      mode = "controlled";
    } else if (changedAtomic.length === 0) {
      mode = "identical";
    }
    const feedback = feedbackSignatures(stateA, stateB, responses, controlled);
    const resultA = lifeResult(snapshotA, categoryId);
    const resultB = lifeResult(snapshotB, categoryId);
    const life = resultA && resultB ? freeze({
      categoryId,
      categoryName: resultA.category.name,
      resultA,
      resultB,
      changed: resultA.status !== resultB.status,
    }) : null;

    let mission;
    if (mode === "controlled") {
      mission = freeze({
        observation: `Snapshot B differs from Snapshot A in one student-controlled input: ${atomicLabels[changedAtomic[0]]}.`,
        why: explanation.why,
        investigate: "Reverse A and B, or save another planet that changes only this input, to test whether the same relationship remains visible.",
        chain: explanation.chain,
      });
    } else if (mode === "identical") {
      mission = freeze({
        observation: "These snapshots preserve identical student-controlled inputs.",
        why: "Record names and timestamps are not scientific variables, so they are excluded from the comparison.",
        investigate: "Save a new experiment after changing one input if you want to isolate cause and consequence.",
        chain: freeze(["Same validated inputs", "Same simulation relationships", "No controlled cause changed"]),
      });
    } else {
      mission = freeze({
        observation: `${changedAtomic.length} student-controlled values differ between Snapshot A and Snapshot B.`,
        why: "Because several causes changed, this comparison cannot determine which one produced any particular model response.",
        investigate: "Create a controlled pair that differs in only one input, then compare again.",
        chain: freeze(["Several inputs changed", "Several model pathways responded", "Single-cause attribution is not defensible"]),
      });
    }

    const suggestions = [];
    if (controlled) {
      suggestions.push(comparisonSuggestion(snapshotA, snapshotB, changedAtomic[0], explanation, responses, feedback[0] || null));
    }
    if (life && life.changed) suggestions.push(lifeSuggestion(snapshotA, snapshotB, resultA, resultB));

    return freeze({
      snapshotAId: snapshotA.id,
      snapshotBId: snapshotB.id,
      mode,
      changedAtomicKeys: freeze(changedAtomic),
      inputDifferences: inputs,
      modelResponses: responses,
      explanation,
      feedback,
      life,
      mission,
      suggestions: freeze(suggestions),
    });
  }

  function suggestFromCommittedChange(changeKey, previous, current, explanation) {
    if (!changeKey || !previous || !current || !explanation) return null;
    return freeze({
      title: `${atomicLabels[changeKey]} investigation`,
      category: categoriesByInput[changeKey] || "Scientific Investigation",
      source: "committed-change",
      relatedSnapshotIds: freeze([]),
      relatedSnapshotLabels: freeze([]),
      studentAction: `Changed ${atomicLabels[changeKey]} in the active planet.`,
      modeledEvidence: freeze(explanation.responses.slice()),
      causalChain: explanation.chain,
    });
  }

  function studentNoteSuggestion(snapshotIds, snapshotLabels) {
    return freeze({
      title: "Student scientific note",
      category: "Scientific Investigation",
      source: "student-note",
      relatedSnapshotIds: freeze(snapshotIds || []),
      relatedSnapshotLabels: freeze(snapshotLabels || []),
      studentAction: "Student recorded an observation or question for later investigation.",
      modeledEvidence: freeze([]),
      causalChain: freeze([]),
    });
  }

  App.comparison = Object.freeze({
    compare,
    suggestFromCommittedChange,
    studentNoteSuggestion,
    atomicLabels,
  });
})(window.HabitablePlanet = window.HabitablePlanet || {});

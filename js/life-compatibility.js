(function (App) {
  "use strict";

  const freeze = Object.freeze;

  const STATUS = freeze({
    COMPATIBLE: "Compatible",
    CHALLENGING: "Challenging",
    INCOMPATIBLE: "Incompatible",
    UNCERTAIN: "Uncertain",
  });

  const CATEGORIES = freeze([
    freeze({ id: "extremophile", name: "Extremophile Microorganisms", shortName: "Extremophiles", symbol: "✦" }),
    freeze({ id: "microbial", name: "General Microbial Life", shortName: "Microbial Life", symbol: "○" }),
    freeze({ id: "photosynthetic", name: "Photosynthetic Life", shortName: "Photosynthetic", symbol: "☼" }),
    freeze({ id: "aquatic", name: "Aquatic Multicellular Life", shortName: "Aquatic Life", symbol: "≈" }),
    freeze({ id: "terrestrial", name: "Complex Terrestrial Life", shortName: "Terrestrial Life", symbol: "◇" }),
    freeze({ id: "human", name: "Human-Like Life", shortName: "Human-Like", symbol: "△" }),
  ]);

  // These are the approved Phase 2 biological interpretation boundaries.
  // They are intentionally separate from Phase 1 physical constants.
  const RULES = freeze({
    display: freeze({ traceFraction: 0.10, limitedFraction: 0.30, substantialFraction: 0.70 }),
    extremophile: freeze({ supportiveTemperatureMinC: -50, supportiveTemperatureMaxC: 80, extremelyThinPressureAtm: 0.25 }),
    microbial: freeze({
      incompatibleTemperatureMinC: -60,
      incompatibleTemperatureMaxC: 100,
      supportiveTemperatureMinC: -20,
      supportiveTemperatureMaxC: 60,
      extremelyThinPressureAtm: 0.25,
    }),
    photosynthetic: freeze({
      incompatibleTemperatureMinC: -50,
      supportiveTemperatureMinC: -10,
      supportiveTemperatureMaxC: 50,
      incompatibleTemperatureMaxC: 90,
      traceLiquidMax: 0.10,
    }),
    aquatic: freeze({
      incompatibleTemperatureMinC: -30,
      supportiveTemperatureMinC: 0,
      supportiveTemperatureMaxC: 40,
      incompatibleTemperatureMaxC: 70,
      traceLiquidMax: 0.10,
      veryLowPressureAtm: 0.25,
    }),
    terrestrial: freeze({
      incompatibleTemperatureMinC: -20,
      supportiveTemperatureMinC: 0,
      supportiveTemperatureMaxC: 40,
      incompatibleTemperatureMaxC: 60,
      incompatiblePressureMinAtm: 0.20,
      supportivePressureMinAtm: 0.50,
      supportivePressureMaxAtm: 2.00,
      challengingPressureMaxAtm: 3.00,
      incompatibleOxygenMinAtm: 0.10,
      supportiveOxygenMinAtm: 0.16,
      supportiveOxygenMaxAtm: 0.30,
      incompatibleOxygenMaxAtm: 0.40,
      traceSurfaceMax: 0.10,
    }),
    human: freeze({
      incompatibleTemperatureMinC: -10,
      supportiveTemperatureMinC: 5,
      supportiveTemperatureMaxC: 35,
      incompatibleTemperatureMaxC: 45,
      incompatiblePressureMinAtm: 0.50,
      supportivePressureMinAtm: 0.70,
      supportivePressureMaxAtm: 1.50,
      incompatiblePressureMaxAtm: 2.00,
      incompatibleOxygenMinAtm: 0.16,
      supportiveOxygenMinAtm: 0.19,
      supportiveOxygenMaxAtm: 0.25,
      incompatibleOxygenMaxAtm: 0.30,
      supportiveCarbonDioxideMaxAtm: 0.005,
      challengingCarbonDioxideMaxAtm: 0.007,
    }),
  });

  function evidence(title, condition, consequence, implication, source = "Modeled evidence") {
    return freeze({ title, condition, consequence, implication, source });
  }

  function collector() {
    return { supporting: [], limiting: [], uncertainty: [] };
  }

  function add(items, group, item) {
    items[group].push(item);
  }

  function fractionBand(value) {
    if (value === 0) return "none";
    if (value < RULES.display.traceFraction) return "trace";
    if (value < RULES.display.limitedFraction) return "limited";
    if (value < RULES.display.substantialFraction) return "substantial";
    return "extensive";
  }

  function contextFrom(planetState) {
    const { inputs, physics, climate } = planetState;
    return freeze({
      temperatureC: climate.meanSurfaceTemperatureC,
      pressureAtm: inputs.atmosphericPressure,
      liquidFraction: climate.liquidWaterFraction,
      exposedFraction: climate.exposedSurfaceFraction,
      iceFraction: climate.iceFraction,
      liquidPhysicallyPossible: climate.liquidPhysicallyPossible,
      climateConverged: climate.converged,
      climateConfidence: climate.modelConfidence,
      acceptableClimateConfidence: climate.converged && climate.modelConfidence === "Standard Range",
      oxygenAtm: physics.gasPartialPressuresAtm.oxygen,
      carbonDioxideAtm: physics.gasPartialPressuresAtm.carbonDioxide,
      methaneAtm: physics.gasPartialPressuresAtm.methane,
      stellarFluxEarth: physics.stellarFluxEarth,
      starName: physics.star.shortName,
      stellarActivity: physics.star.activity,
      atmosphericColumnEarth: physics.atmosphericColumnEarth,
      magneticField: inputs.magneticField,
      geologicActivity: inputs.geologicActivity,
    });
  }

  function formatPercentFraction(value) {
    return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 1 : 0)}%`;
  }

  function formatAtm(value) {
    if (value === 0) return "0 atm";
    if (value < 0.001) return `${value.toFixed(5).replace(/0+$/, "")} atm`;
    return `${value.toFixed(value < 0.01 ? 4 : 3).replace(/0+$/, "").replace(/\.$/, "")} atm`;
  }

  function addGlobalMeanUncertainty(items) {
    add(items, "uncertainty", evidence(
      "Local habitats are unresolved",
      "The climate model reports a global mean surface environment.",
      "Polar regions, equatorial zones, highlands, caves, and hydrothermal or subsurface settings can differ from that mean.",
      "Phase 2 does not numerically invent those local habitats, so this result applies to the modeled broad surface environment.",
      "Model limit"
    ));
  }

  function addProtectionContext(items, ctx) {
    add(items, "uncertainty", evidence(
      "Protection and long-term persistence remain preliminary",
      `${ctx.atmosphericColumnEarth.toFixed(2)} × Earth atmospheric column; ${ctx.magneticField.toLowerCase()} magnetic field; ${ctx.stellarActivity.toLowerCase()} modeled stellar activity; ${ctx.geologicActivity.toLowerCase()} geology.`,
      "These conditions may affect radiation exposure, atmospheric retention, and environmental persistence.",
      "Phase 2 has no calibrated dose, retention, or composite stability gate, so this evidence does not change the compatibility status.",
      "Preliminary contextual evidence"
    ));
  }

  function addClimateConfidenceEvidence(items, ctx) {
    if (ctx.acceptableClimateConfidence) {
      add(items, "supporting", evidence(
        "Climate solution is within the standard model range",
        `The solver converged with confidence labeled ${ctx.climateConfidence}.`,
        "Temperature and modeled water state are available for biological interpretation.",
        "The approved category rules can use these physical results.",
        "Modeled evidence"
      ));
    } else {
      add(items, "uncertainty", evidence(
        "Climate confidence is reduced",
        `Solver converged: ${ctx.climateConverged ? "yes" : "no"}; confidence: ${ctx.climateConfidence}.`,
        "Temperature and water outputs may be outside the model's most reliable interpretive range.",
        "A category that depends on those outputs cannot receive an unsupported definitive conclusion.",
        "Model-confidence warning"
      ));
    }
  }

  function addStellarSpectrumContext(items, ctx) {
    add(items, "uncertainty", evidence(
      "Usable wavelengths are not modeled",
      `${ctx.starName} supplies ${ctx.stellarFluxEarth.toFixed(2)} × Earth's broad stellar flux in this model.`,
      "Photosynthetic systems depend on spectrum, pigments, and atmospheric transmission—not flux alone.",
      "Stellar flux is contextual and non-gating; Phase 2 does not infer a photosynthetically active radiation threshold.",
      "Important uncertainty"
    ));
  }

  function addAtmosphericChemistryContext(items, ctx, categoryName) {
    add(items, "uncertainty", evidence(
      "Atmospheric chemistry context",
      `CO₂ partial pressure is ${formatAtm(ctx.carbonDioxideAtm)} and CH₄ partial pressure is ${formatAtm(ctx.methaneAtm)}.`,
      `Organism-specific tolerance across ${categoryName.toLowerCase()} cannot be inferred from these gas values alone.`,
      "Their calibrated climate effects already appear through temperature; no second biological penalty or hidden score is applied.",
      "Important uncertainty"
    ));
  }

  function resolveStatus(hardIncompatible, majorLimitation, conclusionUncertain) {
    if (hardIncompatible) return STATUS.INCOMPATIBLE;
    if (majorLimitation) return STATUS.CHALLENGING;
    if (conclusionUncertain) return STATUS.UNCERTAIN;
    return STATUS.COMPATIBLE;
  }

  function addWaterEvidence(items, ctx, requirementText, options = {}) {
    const liquidText = `${formatPercentFraction(ctx.liquidFraction)} modeled liquid surface water (${fractionBand(ctx.liquidFraction)})`;
    if (!ctx.liquidPhysicallyPossible) {
      add(items, "limiting", evidence(
        "Stable surface liquid water is physically unavailable",
        `${liquidText}; pressure is ${ctx.pressureAtm.toFixed(2)} atm.`,
        "The modeled surface cannot maintain stable liquid water.",
        requirementText,
        "Modeled evidence"
      ));
    } else if (ctx.liquidFraction === 0) {
      add(items, "limiting", evidence(
        "No liquid surface water is modeled",
        liquidText,
        "No modeled surface liquid-water environment is currently present.",
        requirementText,
        "Modeled evidence"
      ));
    } else if (ctx.liquidFraction < (options.supportiveAt || 0.10)) {
      add(items, "limiting", evidence(
        "Liquid surface water is limited",
        liquidText,
        "Only a small modeled surface fraction provides liquid-water conditions.",
        requirementText,
        "Modeled evidence"
      ));
    } else {
      add(items, "supporting", evidence(
        "Liquid surface water is modeled",
        liquidText,
        "A broad surface liquid-water requirement is physically represented.",
        requirementText,
        "Modeled evidence"
      ));
    }
  }

  function addTemperatureEvidence(items, ctx, supportiveMin, supportiveMax, incompatibleMin, incompatibleMax) {
    const condition = `Global mean surface temperature is ${ctx.temperatureC.toFixed(1)}°C.`;
    if (ctx.temperatureC < incompatibleMin || ctx.temperatureC > incompatibleMax) {
      add(items, "limiting", evidence(
        "Global mean temperature is outside the approved broad limit",
        condition,
        "The modeled broad surface climate falls outside this category's approved activity range.",
        "This is an approved hard incompatibility when the category rule identifies temperature as essential.",
        "Modeled evidence + educational interpretation"
      ));
    } else if (ctx.temperatureC < supportiveMin || ctx.temperatureC > supportiveMax) {
      add(items, "limiting", evidence(
        "Global mean temperature creates a major stress",
        condition,
        "Long-term surface activity or persistence would be strongly constrained across the modeled broad environment.",
        "The approved rule treats this temperature band as Challenging.",
        "Modeled evidence + educational interpretation"
      ));
    } else {
      add(items, "supporting", evidence(
        "Global mean temperature is broadly supportive",
        condition,
        "The modeled broad climate falls within this category's approved supportive band.",
        "Temperature does not trigger a major limitation for this category.",
        "Modeled evidence + educational interpretation"
      ));
    }
  }

  function evaluateExtremophile(ctx) {
    const items = collector();
    const R = RULES.extremophile;
    const temperatureExtreme = ctx.temperatureC < R.supportiveTemperatureMinC || ctx.temperatureC > R.supportiveTemperatureMaxC;
    const noModeledSurfaceWater = !ctx.liquidPhysicallyPossible || ctx.liquidFraction === 0;
    const hardIncompatible = temperatureExtreme && noModeledSurfaceWater;
    const majorLimitation = noModeledSurfaceWater || temperatureExtreme || ctx.pressureAtm < R.extremelyThinPressureAtm;

    if (hardIncompatible) {
      add(items, "limiting", evidence(
        "Combined water and temperature extremes remove a plausible modeled surface environment",
        `Stable surface liquid water is unavailable or absent while the global mean is ${ctx.temperatureC.toFixed(1)}°C.`,
        "The modeled broad surface combines two essential stresses rather than providing a distinct tolerable environment.",
        "This approved combination is Incompatible; the extremophile label does not imply unlimited tolerance.",
        "Modeled evidence + category-specific interpretation"
      ));
    }
    addWaterEvidence(items, ctx, "Extremophiles are not automatically rescued by an assumed subsurface habitat.", { supportiveAt: Number.EPSILON });
    addTemperatureEvidence(items, ctx, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC);
    if (ctx.pressureAtm < R.extremelyThinPressureAtm) {
      add(items, "limiting", evidence(
        "The atmosphere is extremely thin",
        `Surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`,
        "Very low pressure constrains stable surface environments even for unusually tolerant microorganisms.",
        "This is a major modeled stress, not proof that an unmodeled protected habitat exists.",
        "Modeled evidence + approved Phase 1 pressure band"
      ));
    } else {
      add(items, "supporting", evidence(
        "Surface pressure avoids the extremely thin band",
        `Surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`,
        "The modeled atmosphere provides more surface-pressure support than an extremely thin atmosphere.",
        "Pressure alone does not create a major approved limitation.",
        "Modeled evidence"
      ));
    }
    addClimateConfidenceEvidence(items, ctx);
    addGlobalMeanUncertainty(items);
    addProtectionContext(items, ctx);
    add(items, "uncertainty", evidence(
      "Extremophile tolerance is still biologically bounded",
      "Salinity, pH, nutrients, hydrothermal conditions, and alien biochemistry are not modeled.",
      "Known extremophiles survive particular stresses, not every possible combination of extremes.",
      "The category is not automatically Compatible merely because it is labeled extremophile.",
      "Important uncertainty"
    ));
    return finalize("extremophile", resolveStatus(hardIncompatible, majorLimitation, !ctx.acceptableClimateConfidence), items);
  }

  function evaluateMicrobial(ctx) {
    const items = collector();
    const R = RULES.microbial;
    const temperatureBeyondHardBand = ctx.temperatureC < R.incompatibleTemperatureMinC || ctx.temperatureC > R.incompatibleTemperatureMaxC;
    const noModeledLiquidSupport = !ctx.liquidPhysicallyPossible || ctx.liquidFraction === 0;
    const hardIncompatible = temperatureBeyondHardBand && noModeledLiquidSupport;
    const temperatureChallenge = ctx.temperatureC < R.supportiveTemperatureMinC || ctx.temperatureC > R.supportiveTemperatureMaxC;
    const majorLimitation = noModeledLiquidSupport
      || ctx.liquidFraction < RULES.display.traceFraction
      || temperatureChallenge
      || ctx.pressureAtm < R.extremelyThinPressureAtm;

    if (hardIncompatible) {
      add(items, "limiting", evidence(
        "Extreme temperature and absent modeled liquid water combine as a hard limit",
        `Global mean temperature is ${ctx.temperatureC.toFixed(1)}°C and no modeled liquid-water environment is available.`,
        "The broad surface offers neither modeled liquid-water support nor a climate within the approved outer microbial band.",
        "This approved combination is Incompatible for General Microbial Life.",
        "Modeled evidence + category-specific interpretation"
      ));
    }
    addWaterEvidence(items, ctx, "General microbial surface activity is constrained when the model contains no liquid-water environment.");
    addTemperatureEvidence(items, ctx, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC, R.incompatibleTemperatureMinC, R.incompatibleTemperatureMaxC);
    if (ctx.pressureAtm < R.extremelyThinPressureAtm) {
      add(items, "limiting", evidence(
        "Very low pressure constrains surface activity",
        `Surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`,
        "A very thin atmosphere makes persistent surface liquid conditions more difficult.",
        "The approved microbial interpretation treats this as a major challenge.",
        "Modeled evidence + approved Phase 1 pressure band"
      ));
    } else {
      add(items, "supporting", evidence(
        "Pressure supports the modeled water state",
        `Surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`,
        "The atmosphere is not in the extremely thin Phase 1 band.",
        "Pressure does not independently create a microbial limitation here.",
        "Modeled evidence"
      ));
    }
    add(items, "supporting", evidence(
      "Oxygen is not a universal microbial requirement",
      `O₂ partial pressure is ${formatAtm(ctx.oxygenAtm)}.`,
      "Many microbial metabolisms do not require oxygen.",
      "Low or zero atmospheric oxygen does not independently reduce this category's status.",
      "Approved biological interpretation"
    ));
    addClimateConfidenceEvidence(items, ctx);
    addGlobalMeanUncertainty(items);
    addProtectionContext(items, ctx);
    return finalize("microbial", resolveStatus(hardIncompatible, majorLimitation, !ctx.acceptableClimateConfidence), items);
  }

  function evaluatePhotosynthetic(ctx) {
    const items = collector();
    const R = RULES.photosynthetic;
    let status;

    // The order below is the authoritative deterministic decision table.
    if (!ctx.liquidPhysicallyPossible) {
      status = STATUS.INCOMPATIBLE;
    } else if (!ctx.acceptableClimateConfidence) {
      status = STATUS.UNCERTAIN;
    } else if (ctx.liquidFraction === 0) {
      status = STATUS.INCOMPATIBLE;
    } else if (ctx.temperatureC < R.incompatibleTemperatureMinC || ctx.temperatureC > R.incompatibleTemperatureMaxC) {
      status = STATUS.INCOMPATIBLE;
    } else if (
      ctx.liquidFraction < R.traceLiquidMax
      || ctx.temperatureC < R.supportiveTemperatureMinC
      || ctx.temperatureC > R.supportiveTemperatureMaxC
    ) {
      status = STATUS.CHALLENGING;
    } else {
      status = STATUS.COMPATIBLE;
    }

    addWaterEvidence(items, ctx, "Surface photosynthetic activity requires modeled stable surface liquid water.");
    addTemperatureEvidence(items, ctx, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC, R.incompatibleTemperatureMinC, R.incompatibleTemperatureMaxC);
    add(items, "supporting", evidence(
      "Oxygen is not required by the Phase 2 rule",
      `O₂ partial pressure is ${formatAtm(ctx.oxygenAtm)}.`,
      "Photosynthetic organisms need not use Earth chlorophyll or require an oxygen-rich atmosphere.",
      "Atmospheric oxygen does not independently change this category's status.",
      "Approved biological interpretation"
    ));
    addClimateConfidenceEvidence(items, ctx);
    addStellarSpectrumContext(items, ctx);
    addGlobalMeanUncertainty(items);
    addProtectionContext(items, ctx);
    return finalize("photosynthetic", status, items);
  }

  function evaluateAquatic(ctx) {
    const items = collector();
    const R = RULES.aquatic;
    const hardIncompatible = !ctx.liquidPhysicallyPossible
      || ctx.liquidFraction === 0
      || ctx.temperatureC > R.incompatibleTemperatureMaxC
      || (ctx.temperatureC < R.incompatibleTemperatureMinC && ctx.liquidFraction === 0);
    const temperatureChallenge = ctx.temperatureC < R.supportiveTemperatureMinC || ctx.temperatureC > R.supportiveTemperatureMaxC;
    const majorLimitation = ctx.liquidFraction < R.traceLiquidMax
      || temperatureChallenge
      || ctx.pressureAtm < R.veryLowPressureAtm;

    addWaterEvidence(items, ctx, "Persistent modeled liquid environments are essential for aquatic multicellular life.");
    addTemperatureEvidence(items, ctx, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC, R.incompatibleTemperatureMinC, R.incompatibleTemperatureMaxC);
    if (ctx.pressureAtm < R.veryLowPressureAtm) {
      add(items, "limiting", evidence(
        "Very low pressure challenges liquid-water persistence",
        `Surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`,
        "Low surface pressure narrows the conditions that can sustain persistent liquid environments.",
        "This is a major challenge for the modeled aquatic surface environment.",
        "Modeled evidence + approved Phase 1 pressure band"
      ));
    }
    if (ctx.oxygenAtm < 0.10) {
      add(items, "uncertainty", evidence(
        "Dissolved oxygen is not modeled",
        `Atmospheric O₂ partial pressure is ${formatAtm(ctx.oxygenAtm)}.`,
        "Energetically demanding Earth-like aquatic organisms often depend on dissolved oxygen, which cannot be inferred directly from atmospheric O₂ here.",
        "Low atmospheric oxygen is biological context but not a Phase 2 hard gate for all aquatic multicellular life.",
        "Important uncertainty"
      ));
    } else {
      add(items, "uncertainty", evidence(
        "Dissolved oxygen is not calculated",
        `Atmospheric O₂ partial pressure is ${formatAtm(ctx.oxygenAtm)}.`,
        "Atmospheric oxygen does not establish oxygen concentration in the modeled water.",
        "Phase 2 therefore applies no universal aquatic oxygen gate.",
        "Important uncertainty"
      ));
    }
    addClimateConfidenceEvidence(items, ctx);
    addGlobalMeanUncertainty(items);
    addProtectionContext(items, ctx);
    return finalize("aquatic", resolveStatus(hardIncompatible, majorLimitation, !ctx.acceptableClimateConfidence), items);
  }

  function evaluateTerrestrial(ctx) {
    const items = collector();
    const R = RULES.terrestrial;
    const hardIncompatible = ctx.exposedFraction === 0
      || !ctx.liquidPhysicallyPossible
      || ctx.liquidFraction === 0
      || ctx.pressureAtm < R.incompatiblePressureMinAtm
      || ctx.temperatureC < R.incompatibleTemperatureMinC
      || ctx.temperatureC > R.incompatibleTemperatureMaxC
      || ctx.oxygenAtm < R.incompatibleOxygenMinAtm
      || ctx.oxygenAtm > R.incompatibleOxygenMaxAtm;
    const highPressureUncertain = ctx.pressureAtm > R.challengingPressureMaxAtm;
    const majorLimitation = ctx.exposedFraction < R.traceSurfaceMax
      || ctx.liquidFraction < R.traceSurfaceMax
      || ctx.pressureAtm < R.supportivePressureMinAtm
      || (ctx.pressureAtm > R.supportivePressureMaxAtm && ctx.pressureAtm <= R.challengingPressureMaxAtm)
      || ctx.temperatureC < R.supportiveTemperatureMinC
      || ctx.temperatureC > R.supportiveTemperatureMaxC
      || ctx.oxygenAtm < R.supportiveOxygenMinAtm
      || ctx.oxygenAtm > R.supportiveOxygenMaxAtm;
    const status = hardIncompatible
      ? STATUS.INCOMPATIBLE
      : highPressureUncertain
        ? STATUS.UNCERTAIN
        : resolveStatus(false, majorLimitation, !ctx.acceptableClimateConfidence);

    addWaterEvidence(items, ctx, "Complex terrestrial life requires some modeled stable surface liquid water.");
    if (ctx.exposedFraction === 0) {
      add(items, "limiting", evidence(
        "No exposed surface is modeled",
        "Exposed surface fraction is 0%.",
        "The model provides no land surface for primarily terrestrial organisms.",
        "This is an approved hard incompatibility.",
        "Modeled evidence"
      ));
    } else if (ctx.exposedFraction < R.traceSurfaceMax) {
      add(items, "limiting", evidence(
        "Exposed surface is only trace",
        `${formatPercentFraction(ctx.exposedFraction)} of the modeled surface is exposed.`,
        "Available terrestrial habitat is strongly constrained.",
        "The approved rule treats trace exposed surface as Challenging.",
        "Modeled evidence + educational interpretation"
      ));
    } else {
      add(items, "supporting", evidence(
        "Exposed surface is available",
        `${formatPercentFraction(ctx.exposedFraction)} of the modeled surface is exposed.`,
        "The planet provides modeled land-surface context.",
        "The exposed-surface requirement is supported.",
        "Modeled evidence"
      ));
    }
    addTemperatureEvidence(items, ctx, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC, R.incompatibleTemperatureMinC, R.incompatibleTemperatureMaxC);
    addTerrestrialPressureEvidence(items, ctx, R);
    addOxygenEvidence(items, ctx, R, "complex Earth-like aerobic metabolism");
    addClimateConfidenceEvidence(items, ctx);
    addAtmosphericChemistryContext(items, ctx, "Complex Terrestrial Life");
    addGlobalMeanUncertainty(items);
    addProtectionContext(items, ctx);
    return finalize("terrestrial", status, items);
  }

  function addTerrestrialPressureEvidence(items, ctx, R) {
    const condition = `Total surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`;
    if (ctx.pressureAtm < R.incompatiblePressureMinAtm) {
      add(items, "limiting", evidence("Atmospheric pressure is below the approved terrestrial minimum", condition, "The modeled atmosphere is too thin for this broad surface category.", "This is an approved hard incompatibility.", "Modeled evidence + educational interpretation"));
    } else if (ctx.pressureAtm < R.supportivePressureMinAtm) {
      add(items, "limiting", evidence("Atmospheric pressure is low", condition, "Low pressure strongly constrains terrestrial surface conditions.", "The approved rule treats this range as Challenging.", "Modeled evidence + educational interpretation"));
    } else if (ctx.pressureAtm <= R.supportivePressureMaxAtm) {
      add(items, "supporting", evidence("Atmospheric pressure is broadly supportive", condition, "The modeled atmosphere falls within the approved broad pressure range.", "Pressure does not trigger a major limitation.", "Modeled evidence + educational interpretation"));
    } else if (ctx.pressureAtm <= R.challengingPressureMaxAtm) {
      add(items, "limiting", evidence("Atmospheric pressure is high", condition, "High pressure may constrain broad terrestrial physiology.", "The approved rule treats this range as Challenging.", "Modeled evidence + educational interpretation"));
    } else {
      add(items, "uncertainty", evidence("High-pressure physiology is unresolved", condition, "Phase 2 lacks organism-general physiology above 3 atm.", "The overall result is Uncertain unless another approved hard incompatibility applies.", "Important uncertainty"));
    }
  }

  function addOxygenEvidence(items, ctx, R, consequenceSubject) {
    const condition = `O₂ partial pressure is ${formatAtm(ctx.oxygenAtm)}.`;
    if (ctx.oxygenAtm < R.incompatibleOxygenMinAtm || ctx.oxygenAtm > R.incompatibleOxygenMaxAtm) {
      add(items, "limiting", evidence(
        "Oxygen partial pressure is outside the approved broad limit",
        condition,
        `This level is strongly limiting for ${consequenceSubject}.`,
        "This is an approved hard incompatibility; oxygen percentage alone is not used.",
        "Calculated partial pressure + educational interpretation"
      ));
    } else if (ctx.oxygenAtm < R.supportiveOxygenMinAtm || ctx.oxygenAtm > R.supportiveOxygenMaxAtm) {
      add(items, "limiting", evidence(
        "Oxygen partial pressure is challenging",
        condition,
        `This level can constrain ${consequenceSubject}.`,
        "The approved rule treats this partial-pressure band as Challenging.",
        "Calculated partial pressure + educational interpretation"
      ));
    } else {
      add(items, "supporting", evidence(
        "Oxygen partial pressure is broadly supportive",
        condition,
        `This level supports the approved interpretation for ${consequenceSubject}.`,
        "Oxygen is supportive evidence, not evidence that life exists.",
        "Calculated partial pressure + educational interpretation"
      ));
    }
  }

  function evaluateHuman(ctx) {
    const items = collector();
    const R = RULES.human;
    const hardIncompatible = !ctx.liquidPhysicallyPossible
      || ctx.liquidFraction === 0
      || ctx.exposedFraction === 0
      || ctx.pressureAtm < R.incompatiblePressureMinAtm
      || ctx.pressureAtm > R.incompatiblePressureMaxAtm
      || ctx.oxygenAtm < R.incompatibleOxygenMinAtm
      || ctx.oxygenAtm > R.incompatibleOxygenMaxAtm
      || ctx.temperatureC < R.incompatibleTemperatureMinC
      || ctx.temperatureC > R.incompatibleTemperatureMaxC
      || ctx.carbonDioxideAtm > R.challengingCarbonDioxideMaxAtm;
    const majorLimitation = ctx.pressureAtm < R.supportivePressureMinAtm
      || ctx.pressureAtm > R.supportivePressureMaxAtm
      || ctx.oxygenAtm < R.supportiveOxygenMinAtm
      || ctx.oxygenAtm > R.supportiveOxygenMaxAtm
      || ctx.temperatureC < R.supportiveTemperatureMinC
      || ctx.temperatureC > R.supportiveTemperatureMaxC
      || ctx.carbonDioxideAtm > R.supportiveCarbonDioxideMaxAtm;

    addWaterEvidence(items, ctx, "Prolonged unprotected human-like surface life requires modeled stable liquid water.", { supportiveAt: Number.EPSILON });
    if (ctx.exposedFraction === 0) {
      add(items, "limiting", evidence("No exposed surface is modeled", "Exposed surface fraction is 0%.", "No unprotected land surface is represented.", "This is an approved hard incompatibility for Human-Like surface life.", "Modeled evidence"));
    } else {
      add(items, "supporting", evidence("Exposed surface is available", `${formatPercentFraction(ctx.exposedFraction)} of the modeled surface is exposed.`, "A land surface is represented for the prolonged unprotected-surface question.", "The exposed-surface requirement is present.", "Modeled evidence"));
    }
    addTemperatureEvidence(items, ctx, R.supportiveTemperatureMinC, R.supportiveTemperatureMaxC, R.incompatibleTemperatureMinC, R.incompatibleTemperatureMaxC);
    addHumanPressureEvidence(items, ctx, R);
    addOxygenEvidence(items, ctx, R, "prolonged unprotected Earth-human respiration");
    addHumanCarbonDioxideEvidence(items, ctx, R);
    add(items, "uncertainty", evidence(
      "Methane hazards are not independently gated",
      `CH₄ partial pressure is ${formatAtm(ctx.methaneAtm)}.`,
      "Methane can affect atmospheric safety through physiology, flammability, combustion, or oxygen displacement that Phase 2 does not fully model.",
      "Methane alone cannot change the Human-Like compatibility word; modeled O₂ partial pressure remains the respiratory evidence.",
      "Important uncertainty"
    ));
    addClimateConfidenceEvidence(items, ctx);
    addGlobalMeanUncertainty(items);
    addProtectionContext(items, ctx);
    add(items, "uncertainty", evidence(
      "Technology is outside this interpretation",
      "The result assumes prolonged surface exposure without spacesuits, habitats, domes, life support, or terraforming.",
      "Technology could create a different protected environment, but it would not change the modeled planetary surface.",
      "An incompatible surface cannot be rescued by assumed technology in Phase 2.",
      "Scope boundary"
    ));
    return finalize("human", resolveStatus(hardIncompatible, majorLimitation, !ctx.acceptableClimateConfidence), items);
  }

  function addHumanPressureEvidence(items, ctx, R) {
    const condition = `Total surface pressure is ${ctx.pressureAtm.toFixed(2)} atm.`;
    if (ctx.pressureAtm < R.incompatiblePressureMinAtm || ctx.pressureAtm > R.incompatiblePressureMaxAtm) {
      add(items, "limiting", evidence("Pressure is incompatible with the approved unprotected-surface interpretation", condition, "The atmosphere falls outside the broad approved pressure bounds for prolonged unprotected exposure.", "This is an approved hard incompatibility.", "Modeled evidence + educational interpretation"));
    } else if (ctx.pressureAtm < R.supportivePressureMinAtm || ctx.pressureAtm > R.supportivePressureMaxAtm) {
      add(items, "limiting", evidence("Pressure is challenging for prolonged unprotected exposure", condition, "The atmosphere is within the outer approved bounds but outside the broadly supportive range.", "The approved rule treats this pressure as Challenging.", "Modeled evidence + educational interpretation"));
    } else {
      add(items, "supporting", evidence("Pressure is broadly supportive", condition, "The atmosphere falls within the approved broad range for the unprotected-surface interpretation.", "Pressure does not trigger a major limitation.", "Modeled evidence + educational interpretation"));
    }
  }

  function addHumanCarbonDioxideEvidence(items, ctx, R) {
    const condition = `CO₂ partial pressure is ${formatAtm(ctx.carbonDioxideAtm)}.`;
    if (ctx.carbonDioxideAtm > R.challengingCarbonDioxideMaxAtm) {
      add(items, "limiting", evidence("Carbon dioxide exceeds the approved prolonged-exposure boundary", condition, "Sustained elevated CO₂ can impair human health and performance.", "The conservative Phase 2 rule treats this as Incompatible; it is not a probability of injury or survival.", "Calculated partial pressure + conservative educational interpretation"));
    } else if (ctx.carbonDioxideAtm > R.supportiveCarbonDioxideMaxAtm) {
      add(items, "limiting", evidence("Carbon dioxide is challenging for prolonged exposure", condition, "Sustained elevated CO₂ can impair human health and performance.", "The conservative Phase 2 rule treats this band as Challenging.", "Calculated partial pressure + conservative educational interpretation"));
    } else {
      add(items, "supporting", evidence("Carbon dioxide is within the approved broad range", condition, "CO₂ does not cross the conservative Phase 2 prolonged-exposure boundary.", "CO₂ does not trigger a modeled Human-Like limitation.", "Calculated partial pressure + conservative educational interpretation"));
    }
  }

  function finalize(categoryId, status, items) {
    const category = CATEGORIES.find((candidate) => candidate.id === categoryId);
    const summaries = {
      [STATUS.COMPATIBLE]: "The modeled essential requirements are supported and no approved major limitation is triggered.",
      [STATUS.CHALLENGING]: "Essential requirements may be present, but at least one approved modeled stress strongly limits long-term activity or persistence.",
      [STATUS.INCOMPATIBLE]: "At least one approved essential requirement is physically unavailable or outside this category's broad Phase 2 limit.",
      [STATUS.UNCERTAIN]: "The current model lacks reliable evidence needed for a defensible category-level conclusion.",
    };
    const decisiveGroup = status === STATUS.COMPATIBLE
      ? items.supporting
      : status === STATUS.UNCERTAIN
        ? items.uncertainty
        : items.limiting;
    const explicitDecision = status === STATUS.INCOMPATIBLE
      ? decisiveGroup.find((item) => /hard incompatibility|\bIncompatible\b/.test(item.implication))
      : status === STATUS.UNCERTAIN
        ? decisiveGroup.find((item) => /overall result is Uncertain|cannot receive|lacks|unresolved/i.test(item.implication))
        : null;
    const decisive = explicitDecision || decisiveGroup[0] || items.uncertainty[0] || items.supporting[0];
    return freeze({
      category,
      status,
      summary: summaries[status],
      evidence: freeze({
        supporting: freeze(items.supporting.slice()),
        limiting: freeze(items.limiting.slice()),
        uncertainty: freeze(items.uncertainty.slice()),
      }),
      mission: freeze({
        observation: `${category.name} is ${status.toLowerCase()} with the current modeled planet. Compatible describes environmental fit—not evidence that life is present.`,
        why: decisive
          ? `${decisive.condition} ${decisive.consequence} ${decisive.implication}`
          : summaries[status],
        investigate: "Select another life category and compare how the same unchanged planet creates different biological opportunities and constraints.",
        chain: freeze(decisive
          ? [decisive.condition, decisive.consequence, decisive.implication]
          : ["Planet State", "Category requirements", status]),
      }),
    });
  }

  const evaluators = freeze({
    extremophile: evaluateExtremophile,
    microbial: evaluateMicrobial,
    photosynthetic: evaluatePhotosynthetic,
    aquatic: evaluateAquatic,
    terrestrial: evaluateTerrestrial,
    human: evaluateHuman,
  });

  function interpret(planetState, categoryId) {
    const evaluator = evaluators[categoryId];
    if (!evaluator) throw new Error(`Unknown Life Lab category: ${categoryId}`);
    return evaluator(contextFrom(planetState));
  }

  function interpretAll(planetState) {
    return freeze(CATEGORIES.map((category) => interpret(planetState, category.id)));
  }

  App.life = freeze({ STATUS, CATEGORIES, RULES, fractionBand, interpret, interpretAll });
})(window.HabitablePlanet = window.HabitablePlanet || {});

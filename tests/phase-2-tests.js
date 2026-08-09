(function (App) {
  "use strict";

  const results = [];
  const S = App.life.STATUS;

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

  function fixture(base, overrides = {}) {
    return {
      ...base,
      inputs: { ...base.inputs, ...(overrides.inputs || {}) },
      physics: {
        ...base.physics,
        ...(overrides.physics || {}),
        star: { ...base.physics.star, ...((overrides.physics || {}).star || {}) },
        gasPartialPressuresAtm: {
          ...base.physics.gasPartialPressuresAtm,
          ...((overrides.physics || {}).gasPartialPressuresAtm || {}),
        },
      },
      climate: { ...base.climate, ...(overrides.climate || {}) },
      environment: { ...base.environment, ...(overrides.environment || {}) },
    };
  }

  function status(state, categoryId) {
    return App.life.interpret(state, categoryId).status;
  }

  function statusList(state) {
    return App.life.interpretAll(state).map((result) => `${result.category.id}: ${result.status}`).join(" · ");
  }

  function keysDeep(value, output = []) {
    if (!value || typeof value !== "object") return output;
    Object.keys(value).forEach((key) => {
      output.push(key.toLowerCase());
      keysDeep(value[key], output);
    });
    return output;
  }

  const earth = App.simulatePlanet(App.CONSTANTS.earthInputs);
  const earthBefore = JSON.stringify(earth);
  const earthResults = App.life.interpretAll(earth);
  const earthAfter = JSON.stringify(earth);

  test("Interpreter does not mutate Planet State", earthBefore === earthAfter, "Planet State serialization is identical before and after all six interpretations");
  test("Physical Planet State remains immutable", Object.isFrozen(earth) && Object.isFrozen(earth.physics) && Object.isFrozen(earth.climate), "Planet State, physics, and climate remain frozen");
  test("All six approved categories are present", earthResults.length === 6 && new Set(earthResults.map((result) => result.category.id)).size === 6, () => earthResults.map((result) => result.category.name).join("; "));
  test("Earth-like reference matches the approved pattern", earthResults.every((result) => result.status === S.COMPATIBLE), () => statusList(earth));
  test("Interpreter results and evidence arrays are immutable", earthResults.every((result) => Object.isFrozen(result) && Object.isFrozen(result.evidence) && Object.isFrozen(result.evidence.supporting)), "All category results are frozen");

  const anoxic = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, oxygenPct: 0 });
  test("Anoxic world can remain compatible with extremophiles", status(anoxic, "extremophile") === S.COMPATIBLE, () => status(anoxic, "extremophile"));
  test("Anoxic world can remain compatible with general microbial life", status(anoxic, "microbial") === S.COMPATIBLE, () => status(anoxic, "microbial"));
  test("Anoxic world can remain compatible with photosynthetic life", status(anoxic, "photosynthetic") === S.COMPATIBLE, () => status(anoxic, "photosynthetic"));
  test("Anoxic world is incompatible with complex terrestrial life", status(anoxic, "terrestrial") === S.INCOMPATIBLE, () => status(anoxic, "terrestrial"));
  test("Anoxic world is incompatible with Human-Like Life", status(anoxic, "human") === S.INCOMPATIBLE, () => status(anoxic, "human"));
  test("The same planet produces different biological interpretations", new Set(App.life.interpretAll(anoxic).map((result) => result.status)).size > 1, () => statusList(anoxic));

  const hotWet = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, orbitalDistance: 0.85, surfaceWaterInventory: 90 });
  test("Hot wet benchmark strongly limits Human-Like Life", status(hotWet, "human") !== S.COMPATIBLE, () => `${hotWet.climate.meanSurfaceTemperatureC.toFixed(1)}°C; ${statusList(hotWet)}`);

  const coldIcy = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, orbitalDistance: 1.55, surfaceWaterInventory: 90 });
  test("Cold icy benchmark does not pass Complex Terrestrial Life", status(coldIcy, "terrestrial") !== S.COMPATIBLE, () => `${coldIcy.climate.meanSurfaceTemperatureC.toFixed(1)}°C; ${status(coldIcy, "terrestrial")}`);
  test("Cold icy benchmark does not pass Human-Like Life", status(coldIcy, "human") !== S.COMPATIBLE, () => `${coldIcy.climate.meanSurfaceTemperatureC.toFixed(1)}°C; ${status(coldIcy, "human")}`);

  const thinAtmosphere = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, atmosphericPressure: 0.1 });
  test("Thin-atmosphere benchmark is incompatible with Complex Terrestrial Life", status(thinAtmosphere, "terrestrial") === S.INCOMPATIBLE, () => `${thinAtmosphere.physics.gasPartialPressuresAtm.oxygen.toFixed(3)} atm O₂; ${status(thinAtmosphere, "terrestrial")}`);
  test("Thin-atmosphere benchmark is incompatible with Human-Like Life", status(thinAtmosphere, "human") === S.INCOMPATIBLE, () => `${thinAtmosphere.inputs.atmosphericPressure.toFixed(2)} atm; ${status(thinAtmosphere, "human")}`);

  const highPressureGreenhouse = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, orbitalDistance: 0.85, atmosphericPressure: 5, carbonDioxidePct: 5, methanePct: 0, surfaceWaterInventory: 80 });
  test("High-pressure greenhouse benchmark is incompatible with Human-Like Life", status(highPressureGreenhouse, "human") === S.INCOMPATIBLE, () => `${highPressureGreenhouse.climate.meanSurfaceTemperatureC.toFixed(1)}°C; ${highPressureGreenhouse.inputs.atmosphericPressure.toFixed(1)} atm`);
  test("High-pressure greenhouse benchmark cannot pass Complex Terrestrial Life", status(highPressureGreenhouse, "terrestrial") !== S.COMPATIBLE, () => status(highPressureGreenhouse, "terrestrial"));

  const activeThickNoField = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, starType: "m", orbitalDistance: 0.2, atmosphericPressure: 3, magneticField: "None" });
  const activeThickStrongField = App.simulatePlanet({ ...activeThickNoField.inputs, magneticField: "Strong" });
  test("Preliminary magnetic-field evidence does not gate the active-star thick-atmosphere benchmark", App.life.interpretAll(activeThickNoField).every((result, index) => result.status === App.life.interpretAll(activeThickStrongField)[index].status), () => `${statusList(activeThickNoField)} with no field`);

  const thinHighPercentOxygen = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, atmosphericPressure: 0.5, oxygenPct: 35 });
  test("High O₂ percentage at low pressure is not treated as Earth-like oxygen availability", status(thinHighPercentOxygen, "human") !== S.COMPATIBLE && thinHighPercentOxygen.physics.gasPartialPressuresAtm.oxygen < 0.19, () => `35% O₂ → ${thinHighPercentOxygen.physics.gasPartialPressuresAtm.oxygen.toFixed(3)} atm; ${status(thinHighPercentOxygen, "human")}`);

  const noStableLiquid = App.simulatePlanet({ ...App.CONSTANTS.earthInputs, atmosphericPressure: 0.005 }, { allowExtendedPressure: true });
  test("Below-triple-point photosynthetic life is incompatible", status(noStableLiquid, "photosynthetic") === S.INCOMPATIBLE, () => status(noStableLiquid, "photosynthetic"));
  test("Below-triple-point aquatic life is incompatible", status(noStableLiquid, "aquatic") === S.INCOMPATIBLE, () => status(noStableLiquid, "aquatic"));
  test("Below-triple-point complex terrestrial life is incompatible", status(noStableLiquid, "terrestrial") === S.INCOMPATIBLE, () => status(noStableLiquid, "terrestrial"));
  test("Below-triple-point Human-Like Life is incompatible", status(noStableLiquid, "human") === S.INCOMPATIBLE, () => status(noStableLiquid, "human"));
  test("Below-triple-point microbial result is not automatically compatible", status(noStableLiquid, "microbial") !== S.COMPATIBLE, () => status(noStableLiquid, "microbial"));

  const extremeDry = fixture(earth, {
    inputs: { atmosphericPressure: 0.1 },
    climate: { meanSurfaceTemperatureC: 120, liquidPhysicallyPossible: false, liquidWaterFraction: 0 },
  });
  test("Extreme environments do not automatically pass extremophiles", status(extremeDry, "extremophile") === S.INCOMPATIBLE, () => status(extremeDry, "extremophile"));

  const reducedConfidence = fixture(earth, { climate: { converged: false, modelConfidence: "Extended Range" } });
  test("Reduced climate confidence makes Photosynthetic Life Uncertain", status(reducedConfidence, "photosynthetic") === S.UNCERTAIN, () => status(reducedConfidence, "photosynthetic"));
  test("Reduced climate confidence is visible in evidence", App.life.interpret(reducedConfidence, "photosynthetic").evidence.uncertainty.some((item) => item.title.includes("confidence")), "A model-confidence warning appears under Important Uncertainty");

  const photoBase = fixture(earth, { climate: { converged: true, modelConfidence: "Standard Range", liquidPhysicallyPossible: true, meanSurfaceTemperatureC: 20 } });
  test("Photosynthetic zero liquid water is Incompatible", status(fixture(photoBase, { climate: { liquidWaterFraction: 0 } }), "photosynthetic") === S.INCOMPATIBLE, "0% liquid");
  test("Photosynthetic trace liquid water is Challenging", status(fixture(photoBase, { climate: { liquidWaterFraction: 0.099 } }), "photosynthetic") === S.CHALLENGING, "9.9% liquid");
  test("Photosynthetic 10% liquid water can be Compatible", status(fixture(photoBase, { climate: { liquidWaterFraction: 0.10 } }), "photosynthetic") === S.COMPATIBLE, "10% liquid at 20°C");
  test("Photosynthetic -50°C boundary is Challenging", status(fixture(photoBase, { climate: { meanSurfaceTemperatureC: -50 } }), "photosynthetic") === S.CHALLENGING, "-50°C");
  test("Photosynthetic -10°C boundary is Compatible", status(fixture(photoBase, { climate: { meanSurfaceTemperatureC: -10 } }), "photosynthetic") === S.COMPATIBLE, "-10°C");
  test("Photosynthetic 50°C boundary is Compatible", status(fixture(photoBase, { climate: { meanSurfaceTemperatureC: 50 } }), "photosynthetic") === S.COMPATIBLE, "50°C");
  test("Photosynthetic 90°C boundary is Challenging", status(fixture(photoBase, { climate: { meanSurfaceTemperatureC: 90 } }), "photosynthetic") === S.CHALLENGING, "90°C");
  test("Photosynthetic temperature above 90°C is Incompatible", status(fixture(photoBase, { climate: { meanSurfaceTemperatureC: 90.01 } }), "photosynthetic") === S.INCOMPATIBLE, "90.01°C");
  const traceExtremePhoto = fixture(photoBase, { climate: { liquidWaterFraction: 0.05, meanSurfaceTemperatureC: 95 } });
  test("Photosynthetic hard temperature gate overrides trace-water challenge", status(traceExtremePhoto, "photosynthetic") === S.INCOMPATIBLE, () => status(traceExtremePhoto, "photosynthetic"));

  const terrestrialBase = fixture(earth, {
    inputs: { atmosphericPressure: 1 },
    physics: { gasPartialPressuresAtm: { oxygen: 0.21, carbonDioxide: 0.0004, methane: 0.000002 } },
    climate: { meanSurfaceTemperatureC: 20, liquidPhysicallyPossible: true, liquidWaterFraction: 0.4, exposedSurfaceFraction: 0.4, converged: true, modelConfidence: "Standard Range" },
  });
  test("Complex Terrestrial pressure below 0.20 atm is Incompatible", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 0.199 } }), "terrestrial") === S.INCOMPATIBLE, "0.199 atm");
  test("Complex Terrestrial 0.20 atm boundary is Challenging", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 0.20 } }), "terrestrial") === S.CHALLENGING, "0.20 atm");
  test("Complex Terrestrial 0.50 atm boundary is Compatible", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 0.50 } }), "terrestrial") === S.COMPATIBLE, "0.50 atm");
  test("Complex Terrestrial 2.00 atm boundary is Compatible", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 2.00 } }), "terrestrial") === S.COMPATIBLE, "2.00 atm");
  test("Complex Terrestrial 3.00 atm boundary is Challenging", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 3.00 } }), "terrestrial") === S.CHALLENGING, "3.00 atm");
  test("Complex Terrestrial pressure above 3 atm is Uncertain", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 3.01 } }), "terrestrial") === S.UNCERTAIN, "3.01 atm");
  test("Complex Terrestrial hard gate overrides high-pressure uncertainty", status(fixture(terrestrialBase, { inputs: { atmosphericPressure: 3.5 }, physics: { gasPartialPressuresAtm: { oxygen: 0.05 } } }), "terrestrial") === S.INCOMPATIBLE, "3.5 atm with 0.05 atm O₂");

  const terrestrialHighGases = fixture(terrestrialBase, { physics: { gasPartialPressuresAtm: { carbonDioxide: 0.5, methane: 0.2 } } });
  test("Complex Terrestrial CO₂ and CH₄ are contextual and non-gating", status(terrestrialHighGases, "terrestrial") === status(terrestrialBase, "terrestrial"), () => `${status(terrestrialBase, "terrestrial")} before and after gas-only context change`);
  test("Complex Terrestrial gas context appears as uncertainty", App.life.interpret(terrestrialHighGases, "terrestrial").evidence.uncertainty.some((item) => item.title === "Atmospheric chemistry context"), "Atmospheric Chemistry Context is visible");

  const humanBase = fixture(earth, {
    inputs: { atmosphericPressure: 1 },
    physics: { gasPartialPressuresAtm: { oxygen: 0.21, carbonDioxide: 0.004, methane: 0 } },
    climate: { meanSurfaceTemperatureC: 20, liquidPhysicallyPossible: true, liquidWaterFraction: 0.4, exposedSurfaceFraction: 0.4, converged: true, modelConfidence: "Standard Range" },
  });
  test("Human-Like CO₂ at 0.005 atm is Compatible", status(fixture(humanBase, { physics: { gasPartialPressuresAtm: { carbonDioxide: 0.005 } } }), "human") === S.COMPATIBLE, "0.005 atm CO₂");
  test("Human-Like CO₂ above 0.005 through 0.007 atm is Challenging", status(fixture(humanBase, { physics: { gasPartialPressuresAtm: { carbonDioxide: 0.006 } } }), "human") === S.CHALLENGING, "0.006 atm CO₂");
  test("Human-Like CO₂ at 0.007 atm remains Challenging", status(fixture(humanBase, { physics: { gasPartialPressuresAtm: { carbonDioxide: 0.007 } } }), "human") === S.CHALLENGING, "0.007 atm CO₂");
  test("Human-Like CO₂ above 0.007 atm is Incompatible", status(fixture(humanBase, { physics: { gasPartialPressuresAtm: { carbonDioxide: 0.0071 } } }), "human") === S.INCOMPATIBLE, "0.0071 atm CO₂");
  test("Human-Like methane alone does not change status", status(fixture(humanBase, { physics: { gasPartialPressuresAtm: { methane: 1 } } }), "human") === status(humanBase, "human"), () => `${status(humanBase, "human")} with 0 and 1 atm CH₄ context`);
  const humanResult = App.life.interpret(humanBase, "human");
  test("Human-Like interpretation explicitly excludes technology rescue", humanResult.evidence.uncertainty.some((item) => item.title === "Technology is outside this interpretation" && item.implication.includes("cannot be rescued")), "Technology scope boundary is visible and non-rescuing");

  const contextOnlyChange = fixture(earth, { inputs: { magneticField: "None", geologicActivity: "Extreme" }, physics: { star: { activity: "Elevated" } } });
  test("Preliminary protection, geology, and stellar-activity evidence is non-gating", status(contextOnlyChange, "microbial") === status(earth, "microbial"), () => `${status(earth, "microbial")} before and after context-only changes`);
  test("Preliminary evidence remains visible", App.life.interpret(contextOnlyChange, "microbial").evidence.uncertainty.some((item) => item.title.includes("Protection")), "Protection and persistence context is listed under Important Uncertainty");

  const forbiddenKeys = keysDeep(earthResults).filter((key) => /score|probability|weight|rating|points/.test(key));
  test("No hidden scores, probabilities, weights, ratings, or points exist", forbiddenKeys.length === 0, () => forbiddenKeys.join(", ") || "No forbidden result keys");
  test("Only approved compatibility vocabulary is returned", earthResults.concat(App.life.interpretAll(anoxic), App.life.interpretAll(noStableLiquid)).every((result) => Object.values(S).includes(result.status)), "All statuses use the four approved words");
  test("All named benchmark worlds use only approved vocabulary", [hotWet, coldIcy, thinAtmosphere, highPressureGreenhouse, activeThickNoField].every((world) => App.life.interpretAll(world).every((result) => Object.values(S).includes(result.status))), "Hot, cold, thin, high-pressure, and active-star worlds all return approved status words");
  test("Every result separates supporting, limiting, and uncertainty evidence", earthResults.every((result) => Array.isArray(result.evidence.supporting) && Array.isArray(result.evidence.limiting) && Array.isArray(result.evidence.uncertainty)), "Three explicit evidence groups per category");
  test("Mission Control reasoning follows condition → consequence → implication", earthResults.every((result) => result.mission.chain.length === 3), "Three-step causal chain per category");

  const passedCount = results.filter((result) => result.passed).length;
  const tbody = document.getElementById("results");
  results.forEach((result) => {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = result.name;
    const outcome = document.createElement("td");
    outcome.className = result.passed ? "pass" : "fail";
    outcome.textContent = result.passed ? "PASS" : "FAIL";
    const evidenceCell = document.createElement("td");
    evidenceCell.textContent = result.detail;
    row.append(name, outcome, evidenceCell);
    tbody.append(row);
  });
  const summary = document.getElementById("summary");
  summary.className = passedCount === results.length ? "pass" : "fail";
  summary.textContent = `${passedCount} of ${results.length} tests passed.`;
  document.documentElement.dataset.testStatus = passedCount === results.length ? "pass" : "fail";
  window.PHASE_TWO_TEST_RESULTS = results;
})(window.HabitablePlanet = window.HabitablePlanet || {});

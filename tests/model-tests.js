(function (App) {
  "use strict";

  const results = [];
  const C = App.CONSTANTS;

  function test(name, predicate, evidence) {
    let passed = false;
    let detail = "";
    try {
      const value = typeof predicate === "function" ? predicate() : predicate;
      passed = Boolean(value);
      detail = typeof evidence === "function" ? evidence() : evidence;
    } catch (error) {
      detail = error.message;
    }
    results.push({ name, passed, detail: String(detail || "") });
  }

  function near(value, target, tolerance) {
    return Math.abs(value - target) <= tolerance;
  }

  const earth = App.simulatePlanet(C.earthInputs);
  test("Earth albedo calibration", near(earth.climate.planetaryAlbedo, 0.302, 0.003), () => earth.climate.planetaryAlbedo.toFixed(4));
  test("Earth equilibrium temperature", near(earth.climate.equilibriumTemperatureC, -18.3, 0.4), () => `${earth.climate.equilibriumTemperatureC.toFixed(2)}°C`);
  test("Earth mean surface temperature", near(earth.climate.meanSurfaceTemperatureC, 15.2, 0.5), () => `${earth.climate.meanSurfaceTemperatureC.toFixed(2)}°C`);
  test("Earth climate converges", earth.climate.converged && earth.climate.iterations <= 30, () => `${earth.climate.iterations} iterations`);

  const redFlux = App.simulatePlanet({ ...C.earthInputs, starType: "m", orbitalDistance: 0.2 });
  const hotFlux = App.simulatePlanet({ ...C.earthInputs, starType: "f", orbitalDistance: 1.58 });
  test("Red dwarf reference flux", near(redFlux.physics.stellarFluxEarth, 1, 0.001), () => redFlux.physics.stellarFluxEarth.toFixed(3));
  test("Hotter-star reference flux", near(hotFlux.physics.stellarFluxEarth, 1, 0.01), () => hotFlux.physics.stellarFluxEarth.toFixed(3));

  const massTwo = App.simulatePlanet({ ...C.earthInputs, planetMass: 2 });
  test("Rocky mass-radius calculation", near(massTwo.physics.estimatedRadiusEarth, 1.206, 0.01), () => `${massTwo.physics.estimatedRadiusEarth.toFixed(3)} R⊕`);
  test("Mass changes gravity and escape velocity", massTwo.physics.surfaceGravityEarth > 1.3 && massTwo.physics.escapeVelocityKms > 14, () => `${massTwo.physics.surfaceGravityEarth.toFixed(2)} g; ${massTwo.physics.escapeVelocityKms.toFixed(1)} km/s`);

  const hotDry = App.simulatePlanet({ ...C.earthInputs, orbitalDistance: 0.85, surfaceWaterInventory: 5 });
  const hotWet = App.simulatePlanet({ ...C.earthInputs, orbitalDistance: 0.85, surfaceWaterInventory: 90 });
  test("Hot-wet exceeds hot-dry water-vapor feedback", hotWet.climate.waterVaporFeedbackK > hotDry.climate.waterVaporFeedbackK + 5, () => `${hotDry.climate.waterVaporFeedbackK.toFixed(1)} K dry vs ${hotWet.climate.waterVaporFeedbackK.toFixed(1)} K wet`);

  const coldDry = App.simulatePlanet({ ...C.earthInputs, orbitalDistance: 1.55, surfaceWaterInventory: 5 });
  const coldWet = App.simulatePlanet({ ...C.earthInputs, orbitalDistance: 1.55, surfaceWaterInventory: 90 });
  test("Cold-wet has stronger ice-albedo cooling than cold-dry", coldWet.climate.planetaryAlbedo > coldDry.climate.planetaryAlbedo && coldWet.climate.meanSurfaceTemperatureC < coldDry.climate.meanSurfaceTemperatureC, () => `Albedo ${coldDry.climate.planetaryAlbedo.toFixed(3)} dry vs ${coldWet.climate.planetaryAlbedo.toFixed(3)} wet`);

  const thin = App.simulatePlanet({ ...C.earthInputs, atmosphericPressure: 0.01, surfaceWaterInventory: 50 }, { allowExtendedPressure: true });
  test("Thin-atmosphere climate converges", thin.climate.converged && thin.climate.iterations <= 30, () => `${thin.climate.iterations} iterations; ${thin.climate.meanSurfaceTemperatureC.toFixed(1)}°C`);
  test("Thin atmosphere has weaker dry greenhouse", thin.climate.dryGreenhouse.totalK < earth.climate.dryGreenhouse.totalK, () => `${thin.climate.dryGreenhouse.totalK.toFixed(1)} K vs Earth ${earth.climate.dryGreenhouse.totalK.toFixed(1)} K`);

  const belowTriple = App.simulatePlanet({ ...C.earthInputs, atmosphericPressure: 0.005 }, { allowExtendedPressure: true });
  test("Triple-point rule forbids reported surface liquid", !belowTriple.climate.liquidPhysicallyPossible && belowTriple.climate.liquidWaterFraction === 0, () => `Possible: ${belowTriple.climate.liquidPhysicallyPossible}; reported liquid ${belowTriple.climate.liquidWaterFraction}`);
  test("Triple-point reporting does not break climate identity", near(belowTriple.climate.meanSurfaceTemperatureK, belowTriple.climate.equilibriumTemperatureK + belowTriple.climate.dryGreenhouse.totalK + belowTriple.climate.waterVaporFeedbackK, 0.15), () => `${belowTriple.climate.meanSurfaceTemperatureC.toFixed(2)}°C`);

  // The corrected Version 4 CSV row uses a calibration-only CO₂ mixture outside
  // the student control menu. It remains validated, but is never exposed in the UI.
  const correctedTripleBenchmark = App.simulatePlanet({
    ...C.earthInputs,
    atmosphericPressure: 0.005,
    oxygenPct: 0,
    carbonDioxidePct: 95,
  }, { allowExtendedPressure: true, allowCalibrationComposition: true });
  test(
    "Corrected below-triple-point benchmark row",
    near(correctedTripleBenchmark.climate.planetaryAlbedo, 0.207, 0.003)
      && near(correctedTripleBenchmark.climate.equilibriumTemperatureC, -10.1, 0.4)
      && near(correctedTripleBenchmark.climate.dryGreenhouse.totalK, 17.1, 0.4)
      && near(correctedTripleBenchmark.climate.waterVaporFeedbackK, 4.8, 0.3)
      && near(correctedTripleBenchmark.climate.meanSurfaceTemperatureC, 11.8, 0.5)
      && !correctedTripleBenchmark.climate.liquidPhysicallyPossible
      && correctedTripleBenchmark.climate.liquidWaterFraction === 0,
    () => `A ${correctedTripleBenchmark.climate.planetaryAlbedo.toFixed(3)}; Teq ${correctedTripleBenchmark.climate.equilibriumTemperatureC.toFixed(1)}°C; dry ${correctedTripleBenchmark.climate.dryGreenhouse.totalK.toFixed(1)} K; H₂O ${correctedTripleBenchmark.climate.waterVaporFeedbackK.toFixed(1)} K; Ts ${correctedTripleBenchmark.climate.meanSurfaceTemperatureC.toFixed(1)}°C; liquid ${correctedTripleBenchmark.climate.liquidWaterFraction}`
  );

  const highPressureHot = App.simulatePlanet({ ...C.earthInputs, orbitalDistance: 0.78, atmosphericPressure: 5, carbonDioxidePct: 5, methanePct: 0, surfaceWaterInventory: 80 });
  test("High pressure raises boiling temperature", near(highPressureHot.climate.boilingTemperatureC, 152, 0.1), () => `${highPressureHot.climate.boilingTemperatureC.toFixed(1)}°C boiling reference`);

  const anoxic = App.simulatePlanet({ ...C.earthInputs, oxygenPct: 0 });
  test("Removing oxygen does not materially change climate", near(anoxic.climate.meanSurfaceTemperatureC, earth.climate.meanSurfaceTemperatureC, 0.15), () => `${anoxic.climate.meanSurfaceTemperatureC.toFixed(2)}°C anoxic vs ${earth.climate.meanSurfaceTemperatureC.toFixed(2)}°C Earth`);

  const constrained = App.validateInputs({ ...C.earthInputs, oxygenPct: 35, carbonDioxidePct: 50, methanePct: 2 });
  const dryTotal = constrained.nitrogenPct + constrained.oxygenPct + constrained.carbonDioxidePct + constrained.methanePct;
  test("Dry atmospheric gases total 100%", near(dryTotal, 100, 0.0001), () => `${dryTotal.toFixed(4)}% total; N₂ ${constrained.nitrogenPct.toFixed(1)}%`);

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
    const evidence = document.createElement("td");
    evidence.textContent = result.detail;
    row.append(name, outcome, evidence);
    tbody.append(row);
  });
  const summary = document.getElementById("summary");
  summary.className = passedCount === results.length ? "pass" : "fail";
  summary.textContent = `${passedCount} of ${results.length} tests passed.`;
  document.documentElement.dataset.testStatus = passedCount === results.length ? "pass" : "fail";
  window.PHASE_ONE_TEST_RESULTS = results;
})(window.HabitablePlanet = window.HabitablePlanet || {});

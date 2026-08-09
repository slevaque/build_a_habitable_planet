(function (App) {
  "use strict";

  function pressureStatus(pressure) {
    if (pressure < 0.25) return "Extremely Thin";
    if (pressure < 0.70) return "Thin";
    if (pressure <= 1.50) return "Moderate";
    if (pressure <= 3.00) return "Dense";
    return "Very Dense";
  }

  function waterStatus(inputs, climate) {
    if (inputs.surfaceWaterInventory === 0) return "Absent";
    if (!climate.liquidPhysicallyPossible) return "Surface Liquid Unavailable";
    if (climate.vaporizedWaterFraction >= climate.iceFraction &&
        climate.vaporizedWaterFraction >= climate.liquidWaterFraction) {
      return "Mostly Vapor";
    }
    if (climate.iceFraction >= climate.vaporizedWaterFraction &&
        climate.iceFraction >= climate.liquidWaterFraction) {
      return "Mostly Frozen";
    }
    return climate.liquidWaterFraction > 0 ? "Stable Liquid" : "Absent";
  }

  function temperatureStatus(temperatureC) {
    if (temperatureC < -50) return "Cryogenic";
    if (temperatureC < -10) return "Frozen";
    if (temperatureC < 5) return "Cold";
    if (temperatureC <= 35) return "Temperate";
    if (temperatureC <= 60) return "Hot";
    if (temperatureC <= 100) return "Very Hot";
    return "Extreme";
  }

  function evaluateEnvironment(inputs, physics, climate) {
    const columnDescription = `${physics.atmosphericColumnEarth.toFixed(2)} × Earth atmospheric column`;
    const climateStress = temperatureStatus(climate.meanSurfaceTemperatureC);
    const geologicStress = inputs.geologicActivity === "Extreme"
      ? "Extreme geologic disturbance"
      : inputs.geologicActivity === "Dormant"
        ? "Limited geologic replenishment"
        : `${inputs.geologicActivity} geologic activity`;

    return Object.freeze({
      radiationEvidence: Object.freeze({
        status: "Preliminary Evidence",
        atmosphericColumn: columnDescription,
        stellarEnvironment: `${physics.star.activity} representative stellar activity`,
        magneticEnvironment: `${inputs.magneticField} magnetic field`,
        note: "Phase 1 shows the approved contributing evidence; a calibrated radiation index is not yet finalized.",
        temporaryNonScoring: true,
      }),
      retentionEvidence: Object.freeze({
        status: "Preliminary Evidence",
        escapeVelocity: `${physics.escapeVelocityKms.toFixed(1)} km/s escape velocity`,
        currentAtmosphere: `${inputs.atmosphericPressure.toFixed(2)} atm current pressure`,
        geology: `${inputs.geologicActivity} replenishment context`,
        note: "Current pressure and long-term atmospheric vulnerability are different questions.",
        temporaryNonScoring: true,
      }),
      stabilityEvidence: Object.freeze({
        status: "Preliminary Evidence",
        climateStress,
        atmosphericStress: climate.converged ? "Climate solver converged" : "Climate solution did not converge",
        stellarStress: `${physics.star.activity} stellar activity context`,
        geologicStress,
        note: "Subsystem evidence is shown without an uncalibrated composite stability score.",
        temporaryNonScoring: true,
      }),
      statuses: Object.freeze({
        energyBalance: Object.freeze({
          name: "Energy Balance",
          status: `${physics.stellarFluxEarth.toFixed(2)} × Earth`,
          evidence: `${physics.stellarFluxEarth.toFixed(2)} × Earth stellar flux`,
          detail: "Stellar luminosity and orbital distance set incoming energy; albedo controls how much is reflected.",
        }),
        water: Object.freeze({
          name: "Water",
          status: waterStatus(inputs, climate),
          evidence: `${Math.round(climate.iceFraction * 100)}% ice · ${Math.round(climate.liquidWaterFraction * 100)}% liquid`,
          detail: climate.waterPersistence,
        }),
        atmosphere: Object.freeze({
          name: "Atmosphere",
          status: pressureStatus(inputs.atmosphericPressure),
          evidence: `${inputs.atmosphericPressure.toFixed(2)} atm · ${columnDescription}`,
          detail: `Dry greenhouse warming is ${climate.dryGreenhouse.totalK.toFixed(1)} K. This describes physical atmosphere, not biological suitability.`,
        }),
        protection: Object.freeze({
          name: "Protection",
          status: "Preliminary Evidence",
          evidence: `${columnDescription} · ${inputs.magneticField} magnetic field`,
          detail: "Atmospheric column, stellar environment, and magnetic field are shown without an unapproved protection score.",
          temporaryNonScoring: true,
        }),
        environmentalStability: Object.freeze({
          name: "Environmental Stability",
          status: "Preliminary Evidence",
          evidence: `${climateStress} climate · ${inputs.geologicActivity} geology`,
          detail: "Climate, atmospheric, stellar, and geologic evidence remain separate until composite thresholds are calibrated.",
          temporaryNonScoring: true,
        }),
      }),
    });
  }

  App.environment = Object.freeze({ evaluateEnvironment, pressureStatus, temperatureStatus });
})(window.HabitablePlanet = window.HabitablePlanet || {});

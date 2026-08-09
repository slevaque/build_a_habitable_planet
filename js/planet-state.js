(function (App) {
  "use strict";

  function createVisualState(inputs, physics, climate) {
    const temperatureC = climate.meanSurfaceTemperatureC;
    const heat = App.utils.clamp((temperatureC + 40) / 140, 0, 1);
    const haze = App.utils.clamp(
      (inputs.atmosphericPressure / 5) * 0.65
        + (climate.dryGreenhouse.totalK / 120) * 0.35,
      0,
      1
    );
    const geologyIndex = App.CONSTANTS.geology.indexOf(inputs.geologicActivity) / 4;

    return Object.freeze({
      liquidWaterFraction: climate.liquidWaterFraction,
      iceFraction: climate.iceFraction,
      exposedSurfaceFraction: climate.exposedSurfaceFraction,
      atmosphericRimStrength: App.utils.clamp(inputs.atmosphericPressure / 3, 0.08, 1),
      hazeStrength: haze,
      geologicActivity: geologyIndex,
      heatLevel: heat,
      starLightColor: physics.star.lightColor,
      starType: inputs.starType,
    });
  }

  function simulatePlanet(rawInputs, options = {}) {
    const inputs = App.validateInputs(rawInputs, options);
    const physics = App.calculatePrimaryPhysics(inputs);
    const climate = App.climate.solveClimateV4(inputs, physics);
    const environment = App.environment.evaluateEnvironment(inputs, physics, climate);

    return Object.freeze({
      inputs,
      physics,
      climate,
      environment,
      statuses: environment.statuses,
      visualState: createVisualState(inputs, physics, climate),
      meta: Object.freeze({
        engine: "Phase 1 / Climate Version 4",
        calculatedAt: new Date().toISOString(),
      }),
    });
  }

  App.simulatePlanet = simulatePlanet;
})(window.HabitablePlanet = window.HabitablePlanet || {});

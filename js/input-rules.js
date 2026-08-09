(function (App) {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value)));
  }

  function round(value, places) {
    const factor = 10 ** places;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function interpolate(points, x) {
    if (x <= points[0][0]) return points[0][1];
    for (let index = 1; index < points.length; index += 1) {
      const [rightX, rightY] = points[index];
      const [leftX, leftY] = points[index - 1];
      if (x <= rightX) {
        const position = (x - leftX) / (rightX - leftX);
        return leftY + position * (rightY - leftY);
      }
    }
    return points[points.length - 1][1];
  }

  function nearestAllowed(value, options) {
    return options.reduce((nearest, option) =>
      Math.abs(option - value) < Math.abs(nearest - value) ? option : nearest
    );
  }

  function validateInputs(rawInputs, options = {}) {
    const C = App.CONSTANTS;
    const allowExtendedPressure = Boolean(options.allowExtendedPressure);
    const allowCalibrationComposition = Boolean(options.allowCalibrationComposition);
    const starType = C.stars[rawInputs.starType] ? rawInputs.starType : C.defaultInputs.starType;
    const star = C.stars[starType];
    const pressureMinimum = allowExtendedPressure
      ? 0.001
      : C.atmosphere.pressureMinUi;

    const oxygenPct = clamp(
      rawInputs.oxygenPct,
      0,
      allowCalibrationComposition ? 100 : C.atmosphere.oxygenMaxPct
    );
    let carbonDioxidePct = allowCalibrationComposition
      ? clamp(rawInputs.carbonDioxidePct, 0, 100)
      : nearestAllowed(
        clamp(rawInputs.carbonDioxidePct, 0, 50),
        C.atmosphere.co2OptionsPct
      );
    let methanePct = allowCalibrationComposition
      ? clamp(rawInputs.methanePct, 0, 100)
      : nearestAllowed(
        clamp(rawInputs.methanePct, 0, C.atmosphere.methaneMaxPct),
        C.atmosphere.methaneOptionsPct
      );

    const adjustableTotal = oxygenPct + carbonDioxidePct + methanePct;
    if (adjustableTotal > 100) {
      const available = Math.max(0, 100 - oxygenPct);
      carbonDioxidePct = Math.min(carbonDioxidePct, available);
      methanePct = Math.min(methanePct, Math.max(0, available - carbonDioxidePct));
    }

    return Object.freeze({
      planetName: String(rawInputs.planetName || "Unnamed World").trim().slice(0, 40) || "Unnamed World",
      starType,
      orbitalDistance: round(clamp(rawInputs.orbitalDistance, star.orbitMin, star.orbitMax), 2),
      planetMass: round(clamp(rawInputs.planetMass, C.planet.massMin, C.planet.massMax), 1),
      atmosphericPressure: round(clamp(rawInputs.atmosphericPressure, pressureMinimum, C.atmosphere.pressureMax), 3),
      oxygenPct: round(oxygenPct, 4),
      carbonDioxidePct: round(carbonDioxidePct, 4),
      methanePct: round(methanePct, 4),
      nitrogenPct: round(Math.max(0, 100 - oxygenPct - carbonDioxidePct - methanePct), 4),
      surfaceWaterInventory: round(clamp(rawInputs.surfaceWaterInventory, 0, 100), 0),
      geologicActivity: C.geology.includes(rawInputs.geologicActivity)
        ? rawInputs.geologicActivity
        : C.defaultInputs.geologicActivity,
      magneticField: C.magneticFields.includes(rawInputs.magneticField)
        ? rawInputs.magneticField
        : C.defaultInputs.magneticField,
    });
  }

  App.utils = Object.freeze({ clamp, round, interpolate, nearestAllowed });
  App.validateInputs = validateInputs;
})(window.HabitablePlanet = window.HabitablePlanet || {});

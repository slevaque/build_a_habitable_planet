(function (App) {
  "use strict";

  function calculatePrimaryPhysics(inputs) {
    const C = App.CONSTANTS;
    const star = C.stars[inputs.starType];
    const stellarFlux = star.luminosity / (inputs.orbitalDistance ** 2);
    const radiusEarth = inputs.planetMass ** C.planet.massExponent;
    const gravityEarth = inputs.planetMass / (radiusEarth ** 2);
    const escapeVelocityKms = C.references.earthEscapeVelocityKms
      * Math.sqrt(inputs.planetMass / radiusEarth);
    const pressure = inputs.atmosphericPressure;
    const fractions = {
      nitrogen: inputs.nitrogenPct / 100,
      oxygen: inputs.oxygenPct / 100,
      carbonDioxide: inputs.carbonDioxidePct / 100,
      methane: inputs.methanePct / 100,
    };

    return Object.freeze({
      star,
      stellarLuminositySolar: star.luminosity,
      stellarFluxEarth: stellarFlux,
      stellarFluxWm2: stellarFlux * C.references.solarConstantWm2,
      estimatedRadiusEarth: radiusEarth,
      surfaceGravityEarth: gravityEarth,
      surfaceGravityMs2: gravityEarth * 9.81,
      escapeVelocityKms,
      gasFractions: Object.freeze(fractions),
      gasPartialPressuresAtm: Object.freeze({
        nitrogen: pressure * fractions.nitrogen,
        oxygen: pressure * fractions.oxygen,
        carbonDioxide: pressure * fractions.carbonDioxide,
        methane: pressure * fractions.methane,
      }),
      atmosphericColumnEarth: pressure / gravityEarth,
    });
  }

  App.calculatePrimaryPhysics = calculatePrimaryPhysics;
})(window.HabitablePlanet = window.HabitablePlanet || {});

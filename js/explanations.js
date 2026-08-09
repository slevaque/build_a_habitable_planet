(function (App) {
  "use strict";

  const labels = Object.freeze({
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

  function direction(delta, higher = "increased", lower = "decreased") {
    if (Math.abs(delta) < 0.0001) return "changed little";
    return delta > 0 ? higher : lower;
  }

  function signed(value, digits = 1, suffix = "") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(digits)}${suffix}`;
  }

  function createExplanation(changeKey, previous, current) {
    if (!previous || !changeKey) {
      return Object.freeze({
        observation: "Your planetary laboratory is ready for investigation.",
        why: "Each input is connected to a single simulation engine. The planet, evidence strip, and dashboard all read the resulting Planet State.",
        investigate: "Change one variable, commit the change, and compare the resulting evidence.",
        chain: Object.freeze(["Student input", "Simulation engine", "Planet State", "Visible evidence"]),
        responses: Object.freeze([]),
      });
    }

    const previousClimate = previous.climate;
    const currentClimate = current.climate;
    const temperatureDelta = currentClimate.meanSurfaceTemperatureC - previousClimate.meanSurfaceTemperatureC;
    const albedoDelta = currentClimate.planetaryAlbedo - previousClimate.planetaryAlbedo;
    const fluxDelta = current.physics.stellarFluxEarth - previous.physics.stellarFluxEarth;
    const liquidDelta = currentClimate.liquidWaterFraction - previousClimate.liquidWaterFraction;
    const iceDelta = currentClimate.iceFraction - previousClimate.iceFraction;
    let observation;
    let why;
    let investigate;
    let chain;

    if (changeKey === "starType" || changeKey === "orbitalDistance") {
      observation = `Stellar flux ${direction(fluxDelta)} to ${current.physics.stellarFluxEarth.toFixed(2)} × Earth, while estimated mean temperature changed ${signed(temperatureDelta, 1, "°C")}.`;
      why = "Star luminosity and orbital distance set received energy through the inverse-square relationship. The climate solver then propagates that change through temperature, ice, albedo, and water vapor.";
      investigate = "Hold the orbit steady and compare stars, or hold the star steady and move the orbit. Which change produces the larger flux difference?";
      chain = [
        changeKey === "starType" ? "Star luminosity changed" : "Orbital distance changed",
        `Stellar flux ${direction(fluxDelta)}`,
        `Temperature ${direction(temperatureDelta)}`,
        `Water state responded`,
      ];
    } else if (changeKey === "planetMass") {
      const gravityDelta = current.physics.surfaceGravityEarth - previous.physics.surfaceGravityEarth;
      observation = `The rocky-radius estimate is now ${current.physics.estimatedRadiusEarth.toFixed(2)} R⊕, gravity ${current.physics.surfaceGravityEarth.toFixed(2)} g, and escape velocity ${current.physics.escapeVelocityKms.toFixed(1)} km/s.`;
      why = "Mass changes the estimated rocky-planet radius. Mass and radius together determine gravity and escape velocity; gravity also changes atmospheric column for the same surface pressure.";
      investigate = "Keep pressure fixed while changing mass. Watch how gravity and atmospheric column move in opposite directions.";
      chain = ["Planet mass changed", "Estimated radius changed", `Gravity ${direction(gravityDelta)}`, "Escape velocity and atmospheric column responded"];
    } else if (changeKey === "atmosphericPressure") {
      const columnDelta = current.physics.atmosphericColumnEarth - previous.physics.atmosphericColumnEarth;
      const greenhouseDelta = currentClimate.dryGreenhouse.totalK - previousClimate.dryGreenhouse.totalK;
      observation = `Atmospheric column ${direction(columnDelta)} to ${current.physics.atmosphericColumnEarth.toFixed(2)} × Earth; dry greenhouse warming changed ${signed(greenhouseDelta, 1, " K")}.`;
      why = "Pressure combines with gravity to determine atmospheric column. Pressure also changes gas partial pressures and the calibrated background-atmosphere greenhouse term.";
      investigate = "Compare the same pressure on a lower-mass and higher-mass planet. Does equal pressure create equal atmospheric column?";
      chain = ["Surface pressure changed", "Gas partial pressures changed", "Dry greenhouse response changed", "Temperature and water state responded"];
    } else if (["oxygenPct", "carbonDioxidePct", "methanePct"].includes(changeKey)) {
      const greenhouseDelta = currentClimate.dryGreenhouse.totalK - previousClimate.dryGreenhouse.totalK;
      observation = `The dry-atmosphere mixture remains 100%. Dry greenhouse warming changed ${signed(greenhouseDelta, 1, " K")}, and temperature changed ${signed(temperatureDelta, 1, "°C")}.`;
      why = "The model calculates CO₂ and CH₄ effects from gas partial pressure, not percentage alone. Nitrogen fills the remaining dry atmosphere; oxygen has little direct climate effect in this model.";
      investigate = "Try the same CO₂ percentage at two pressures. Partial pressure reveals why the greenhouse response differs.";
      chain = ["Dry gas mixture changed", "Gas partial pressure changed", "Greenhouse response changed", "Surface climate responded"];
    } else if (changeKey === "surfaceWaterInventory") {
      const coldFeedback = iceDelta > 0.02 && albedoDelta > 0.005;
      const warmFeedback = currentClimate.waterVaporFeedbackK > previousClimate.waterVaporFeedbackK + 0.2;
      observation = `Liquid surface changed ${signed(liquidDelta * 100, 0, "%")}; ice changed ${signed(iceDelta * 100, 0, "%")}; albedo changed ${signed(albedoDelta, 3)}.`;
      if (coldFeedback) {
        why = "More available water froze. The brighter ice raised albedo, reflected more stellar energy, and amplified cooling.";
        chain = ["Water inventory changed", "Ice increased", "Albedo increased", "Absorbed energy decreased", "Cooling amplified"];
      } else if (warmFeedback) {
        why = "Warm conditions allowed more of the available water to contribute atmospheric moisture. The bounded water-vapor feedback added greenhouse warming.";
        chain = ["Water inventory changed", "Atmospheric moisture increased", "Water-vapor feedback strengthened", "Warming amplified"];
      } else {
        why = "Water inventory supplies the climate system, but temperature and pressure determine whether that water becomes ice, liquid, or vapor.";
        chain = ["Water inventory changed", "Climate allocated water", "Ice, liquid, and vapor fractions changed", "Albedo and feedback responded"];
      }
      investigate = "Try the same water increase on a cold world and a warm world. Water can amplify different outcomes.";
    } else if (changeKey === "geologicActivity") {
      observation = `Geologic activity is now ${current.inputs.geologicActivity}. The planet visualization shows the corresponding volcanic evidence.`;
      why = "Phase 1 uses geology for volcanic disturbance and long-term replenishment context. It does not add a separate greenhouse bonus or silently change atmospheric composition.";
      investigate = "Compare active and extreme geology. What changes visually, and which climate values correctly remain unchanged?";
      chain = ["Geologic activity changed", "Volcanic evidence changed", "Replenishment context changed", "Climate was not double-counted"];
    } else {
      observation = `Magnetic field strength is now ${current.inputs.magneticField}.`;
      why = "Magnetic field is one layer of protection. Phase 1 shows it alongside atmospheric column and stellar environment without treating it as a habitability switch.";
      investigate = "Compare a strong field with a thin atmosphere and no field with a dense atmosphere. Protection is layered.";
      chain = ["Magnetic field changed", "Magnetic contribution changed", "Atmospheric and stellar evidence remained important"];
    }

    const responses = [];
    if (changeKey === "planetMass") {
      responses.push(
        `Radius ${current.physics.estimatedRadiusEarth.toFixed(2)} R⊕`,
        `Gravity ${current.physics.surfaceGravityEarth.toFixed(2)} g`,
        `Escape velocity ${current.physics.escapeVelocityKms.toFixed(1)} km/s`
      );
    } else if (changeKey === "atmosphericPressure") {
      responses.push(
        `Atmospheric column ${current.physics.atmosphericColumnEarth.toFixed(2)} × Earth`,
        `Dry greenhouse ${currentClimate.dryGreenhouse.totalK.toFixed(1)} K`
      );
    } else if (changeKey === "geologicActivity") {
      responses.push(`Volcanic evidence ${current.inputs.geologicActivity}`);
    } else if (changeKey === "magneticField") {
      responses.push(`Magnetic evidence ${current.inputs.magneticField}`);
    } else {
      if (Math.abs(temperatureDelta) >= 0.05) responses.push(`Temperature ${signed(temperatureDelta, 1, "°C")}`);
      if (Math.abs(albedoDelta) >= 0.0005) responses.push(`Albedo ${signed(albedoDelta, 3)}`);
      if (Math.abs(liquidDelta) >= 0.005) responses.push(`Liquid water ${signed(liquidDelta * 100, 0, "%")}`);
      if (responses.length === 0) responses.push("Calculated climate changed by less than the displayed precision");
    }

    return Object.freeze({ observation, why, investigate, chain: Object.freeze(chain), responses: Object.freeze(responses) });
  }

  App.explanations = Object.freeze({ labels, createExplanation });
})(window.HabitablePlanet = window.HabitablePlanet || {});

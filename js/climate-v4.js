(function (App) {
  "use strict";

  const { clamp, interpolate } = App.utils;

  function boilingTemperatureC(pressureAtm) {
    return interpolate(App.CONSTANTS.climate.boilingPoints, pressureAtm);
  }

  function temperatureWaterVaporFactor(temperatureK) {
    return interpolate(App.CONSTANTS.climate.waterVaporPoints, temperatureK);
  }

  function frozenWaterFraction(temperatureK) {
    return interpolate(App.CONSTANTS.climate.icePoints, temperatureK);
  }

  function calculateWaterAndAlbedo(temperatureK, inputs) {
    const C = App.CONSTANTS;
    const climate = C.climate;
    const waterInventory = clamp(inputs.surfaceWaterInventory / 100, 0, 1);
    const effectiveWater = Math.sqrt(waterInventory);
    const vaporTemperatureFactor = temperatureWaterVaporFactor(temperatureK);
    const iceFractionOfWater = frozenWaterFraction(temperatureK);
    const boilingC = boilingTemperatureC(inputs.atmosphericPressure);
    const boilingK = boilingC + C.references.kelvinOffset;
    const vaporizedWaterFraction = temperatureK <= boilingK
      ? 0
      : Math.min(1, (temperatureK - boilingK) / 20);

    const iceSurface = waterInventory * iceFractionOfWater;
    const vaporizedSurfaceEquivalent = waterInventory * vaporizedWaterFraction;
    const liquidSurface = Math.max(
      0,
      waterInventory - iceSurface - vaporizedSurfaceEquivalent
    );
    const exposedSurface = Math.max(0, 1 - waterInventory) + vaporizedSurfaceEquivalent;
    const surfaceAlbedo =
      (liquidSurface * climate.liquidWaterAlbedo)
      + (exposedSurface * climate.rockAlbedo)
      + (iceSurface * climate.iceAlbedo);

    const pressureReflectivity = 1 - Math.exp(-2 * inputs.atmosphericPressure);
    const moisture = clamp(
      effectiveWater * (vaporTemperatureFactor / 0.55),
      0,
      1
    );
    const atmosphericAlbedo = Math.min(
      climate.atmosphericAlbedoMax,
      pressureReflectivity * (0.115 + (0.08 * moisture))
    );
    const totalAlbedo = clamp(
      surfaceAlbedo + atmosphericAlbedo,
      climate.albedoMin,
      climate.albedoMax
    );

    return {
      waterInventory,
      effectiveWater,
      vaporTemperatureFactor,
      iceFractionOfWater,
      boilingTemperatureC: boilingC,
      boilingTemperatureK: boilingK,
      vaporizedWaterFraction,
      iceSurfaceFraction: iceSurface,
      climateLiquidSurfaceFraction: liquidSurface,
      vaporizedSurfaceEquivalent,
      exposedSurfaceFraction: exposedSurface,
      surfaceAlbedo,
      atmosphericAlbedo,
      totalAlbedo,
      moisture,
    };
  }

  function calculateDryGreenhouse(inputs, physics) {
    const C = App.CONSTANTS.climate;
    const partials = physics.gasPartialPressuresAtm;
    const background = C.backgroundGreenhouseK * Math.min(
      1.4,
      inputs.atmosphericPressure ** 0.25
    );
    const carbonDioxide = partials.carbonDioxide === 0
      ? 0
      : 4 * Math.log(1 + (partials.carbonDioxide / 0.0004));
    const methane = partials.methane === 0
      ? 0
      : 1.5 * Math.min(
        Math.log(1 + (partials.methane / 0.000002)),
        5
      );
    const denseCarbonDioxide = Math.min(
      C.denseCo2MaxK,
      6 * Math.max(0, Math.log(1 + (partials.carbonDioxide / 0.05)))
    );
    const total = clamp(
      background + carbonDioxide + methane + denseCarbonDioxide,
      0,
      C.dryGreenhouseMaxK
    );

    return Object.freeze({
      backgroundK: background,
      carbonDioxideK: carbonDioxide,
      methaneK: methane,
      denseCarbonDioxideK: denseCarbonDioxide,
      totalK: total,
    });
  }

  function calculateIterationComponents(temperatureK, inputs, physics, dryGreenhouse) {
    const C = App.CONSTANTS;
    const water = calculateWaterAndAlbedo(temperatureK, inputs);
    const equilibriumK = C.references.earthEquilibriumK
      * (physics.stellarFluxEarth ** 0.25)
      * (((1 - water.totalAlbedo) / 0.70) ** 0.25);
    const waterVaporK = C.climate.waterVaporCoefficientK
      * water.effectiveWater
      * water.vaporTemperatureFactor;
    const calculatedSurfaceK = clamp(
      equilibriumK + dryGreenhouse.totalK + waterVaporK,
      C.climate.minTemperatureK,
      C.climate.maxTemperatureK
    );

    return {
      water,
      equilibriumK,
      waterVaporK,
      calculatedSurfaceK,
    };
  }

  function solveClimateV4(inputs, physics) {
    const C = App.CONSTANTS;
    const climate = C.climate;
    const dryGreenhouse = calculateDryGreenhouse(inputs, physics);
    let currentTemperatureK = climate.initialTemperatureK;
    let previousRawDelta = null;
    let previousAlbedo = null;
    let iterations = 0;
    let converged = false;
    let finalDamping = climate.normalDamping;

    for (let index = 0; index < climate.maxIterations; index += 1) {
      iterations = index + 1;
      const components = calculateIterationComponents(
        currentTemperatureK,
        inputs,
        physics,
        dryGreenhouse
      );
      const rawDelta = components.calculatedSurfaceK - currentTemperatureK;
      const reversed = previousRawDelta !== null
        && Math.sign(rawDelta) !== 0
        && Math.sign(previousRawDelta) !== 0
        && Math.sign(rawDelta) !== Math.sign(previousRawDelta);

      let damping = climate.normalDamping;
      if (reversed) {
        damping = Math.abs(rawDelta) > 1 && Math.abs(previousRawDelta) > 1
          ? climate.strongOscillationDamping
          : climate.oscillationDamping;
      }

      const nextTemperatureK = clamp(
        currentTemperatureK + (damping * rawDelta),
        climate.minTemperatureK,
        climate.maxTemperatureK
      );
      const temperatureStable = Math.abs(nextTemperatureK - currentTemperatureK)
        < climate.temperatureToleranceK;
      const albedoStable = previousAlbedo !== null
        && Math.abs(components.water.totalAlbedo - previousAlbedo)
          < climate.albedoTolerance;

      currentTemperatureK = nextTemperatureK;
      finalDamping = damping;
      previousRawDelta = rawDelta;
      previousAlbedo = components.water.totalAlbedo;

      if (temperatureStable && albedoStable) {
        converged = true;
        break;
      }
    }

    const finalComponents = calculateIterationComponents(
      currentTemperatureK,
      inputs,
      physics,
      dryGreenhouse
    );
    const surfaceTemperatureK = converged
      ? finalComponents.calculatedSurfaceK
      : currentTemperatureK;
    const finalState = calculateIterationComponents(
      surfaceTemperatureK,
      inputs,
      physics,
      dryGreenhouse
    );
    const liquidPhysicallyPossible = inputs.atmosphericPressure
      >= C.references.waterTriplePointAtm;
    const reportedLiquidSurfaceFraction = liquidPhysicallyPossible
      ? finalState.water.climateLiquidSurfaceFraction
      : 0;

    let waterPersistence = "Stable surface liquid unavailable";
    if (liquidPhysicallyPossible && reportedLiquidSurfaceFraction > 0) {
      waterPersistence = inputs.atmosphericPressure < 0.1
        ? "Physically possible; broad persistence limited"
        : "Stable surface liquid possible";
    } else if (liquidPhysicallyPossible) {
      waterPersistence = "No stable liquid under current climate";
    }

    const touchesSafetyBound = surfaceTemperatureK <= climate.minTemperatureK
      || surfaceTemperatureK >= climate.maxTemperatureK;

    return Object.freeze({
      version: "4",
      planetaryAlbedo: finalState.water.totalAlbedo,
      surfaceAlbedo: finalState.water.surfaceAlbedo,
      atmosphericAlbedo: finalState.water.atmosphericAlbedo,
      equilibriumTemperatureK: finalState.equilibriumK,
      equilibriumTemperatureC: finalState.equilibriumK - C.references.kelvinOffset,
      dryGreenhouse,
      waterVaporFeedbackK: finalState.waterVaporK,
      meanSurfaceTemperatureK: surfaceTemperatureK,
      meanSurfaceTemperatureC: surfaceTemperatureK - C.references.kelvinOffset,
      surfaceWaterInventoryFraction: finalState.water.waterInventory,
      iceFraction: finalState.water.iceSurfaceFraction,
      climateLiquidWaterFraction: finalState.water.climateLiquidSurfaceFraction,
      liquidWaterFraction: reportedLiquidSurfaceFraction,
      vaporizedWaterFraction: finalState.water.vaporizedSurfaceEquivalent,
      exposedSurfaceFraction: finalState.water.exposedSurfaceFraction,
      boilingTemperatureC: finalState.water.boilingTemperatureC,
      liquidPhysicallyPossible,
      waterPersistence,
      iterations,
      converged,
      finalDamping,
      modelConfidence: touchesSafetyBound
        ? "Outside Core Model"
        : converged ? "Standard Range" : "Extended Range",
    });
  }

  App.climate = Object.freeze({
    boilingTemperatureC,
    temperatureWaterVaporFactor,
    frozenWaterFraction,
    calculateWaterAndAlbedo,
    calculateDryGreenhouse,
    solveClimateV4,
  });
})(window.HabitablePlanet = window.HabitablePlanet || {});

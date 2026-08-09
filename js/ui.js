(function (App) {
  "use strict";

  const statusOrder = [
    ["energyBalance", "energy"],
    ["water", "water"],
    ["atmosphere", "atmosphere"],
    ["protection", "protection"],
    ["environmentalStability", "stability"],
  ];

  function byId(id) { return document.getElementById(id); }

  function formatPercent(value, digits = 0) {
    return `${(value * 100).toFixed(digits)}%`;
  }

  function formatGas(value) {
    if (value === 0) return "0%";
    if (value < 0.001) return `${value.toFixed(4)}%`;
    if (value < 0.1) return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
    return `${value.toFixed(value < 1 ? 2 : 1).replace(/\.0$/, "")}%`;
  }

  function readInputs() {
    const form = byId("planet-controls");
    const data = new FormData(form);
    return {
      planetName: byId("planet-name").value,
      starType: data.get("starType"),
      orbitalDistance: Number(data.get("orbitalDistance")),
      planetMass: Number(data.get("planetMass")),
      atmosphericPressure: Number(data.get("atmosphericPressure")),
      oxygenPct: Number(data.get("oxygenPct")),
      carbonDioxidePct: Number(data.get("carbonDioxidePct")),
      methanePct: Number(data.get("methanePct")),
      surfaceWaterInventory: Number(data.get("surfaceWaterInventory")),
      geologicActivity: data.get("geologicActivity"),
      magneticField: data.get("magneticField"),
    };
  }

  function setStarOrbitRange(starType, value) {
    const star = App.CONSTANTS.stars[starType];
    const control = byId("orbital-distance");
    control.min = String(star.orbitMin);
    control.max = String(star.orbitMax);
    control.value = String(App.utils.clamp(value, star.orbitMin, star.orbitMax));
    byId("orbit-min").textContent = `${star.orbitMin.toFixed(2)} AU`;
    byId("orbit-max").textContent = `${star.orbitMax.toFixed(2)} AU`;
  }

  function writeInputs(inputs) {
    byId("planet-name").value = inputs.planetName;
    const radio = document.querySelector(`input[name="starType"][value="${inputs.starType}"]`);
    if (radio) radio.checked = true;
    setStarOrbitRange(inputs.starType, inputs.orbitalDistance);
    byId("planet-mass").value = String(inputs.planetMass);
    byId("atmospheric-pressure").value = String(inputs.atmosphericPressure);
    byId("oxygen").value = String(inputs.oxygenPct);
    byId("carbon-dioxide").value = String(inputs.carbonDioxidePct);
    byId("methane").value = String(inputs.methanePct);
    byId("surface-water").value = String(inputs.surfaceWaterInventory);
    byId("geologic-activity").value = inputs.geologicActivity;
    byId("magnetic-field").value = inputs.magneticField;
  }

  function renderControls(state) {
    const { inputs, physics } = state;
    byId("orbital-distance-output").textContent = `${inputs.orbitalDistance.toFixed(2)} AU`;
    byId("planet-mass-output").textContent = `${inputs.planetMass.toFixed(1)} M⊕`;
    byId("surface-water-output").textContent = `${inputs.surfaceWaterInventory}%`;
    byId("atmospheric-pressure-output").textContent = `${inputs.atmosphericPressure.toFixed(2)} atm`;
    byId("oxygen-output").textContent = `${inputs.oxygenPct.toFixed(0)}%`;
    byId("derived-radius").textContent = `${physics.estimatedRadiusEarth.toFixed(2)} R⊕`;
    byId("derived-gravity").textContent = `${physics.surfaceGravityEarth.toFixed(2)} g`;
    byId("derived-escape").textContent = `${physics.escapeVelocityKms.toFixed(1)} km/s`;
    byId("star-summary").textContent = `${physics.star.shortName} · ${inputs.orbitalDistance.toFixed(2)} AU`;
    byId("planet-summary").textContent = `${inputs.planetMass.toFixed(1)} M⊕ · ${inputs.surfaceWaterInventory}% water · ${inputs.geologicActivity}`;
    byId("atmosphere-summary").textContent = `${inputs.atmosphericPressure.toFixed(2)} atm · N₂ ${inputs.nitrogenPct.toFixed(1)}%`;

    const composition = [
      ["gas-n2", inputs.nitrogenPct], ["gas-o2", inputs.oxygenPct],
      ["gas-co2", inputs.carbonDioxidePct], ["gas-ch4", inputs.methanePct],
    ];
    composition.forEach(([id, percentage]) => {
      byId(id).style.width = `${percentage}%`;
    });
    const compositionText = `N₂ ${formatGas(inputs.nitrogenPct)} · O₂ ${formatGas(inputs.oxygenPct)} · CO₂ ${formatGas(inputs.carbonDioxidePct)} · CH₄ ${formatGas(inputs.methanePct)}`;
    byId("composition-text").textContent = compositionText;
    byId("composition-bar").setAttribute("aria-label", compositionText);
  }

  function renderHeader(state) {
    byId("header-star").textContent = state.physics.star.shortName;
    byId("header-orbit").textContent = `${state.inputs.orbitalDistance.toFixed(2)} AU`;
    byId("header-flux").textContent = `${state.physics.stellarFluxEarth.toFixed(2)} × Earth`;
  }

  function renderEvidence(state) {
    const climate = state.climate;
    byId("evidence-temperature").textContent = `${climate.meanSurfaceTemperatureC.toFixed(1)}°C`;
    byId("evidence-albedo").textContent = climate.planetaryAlbedo.toFixed(3);
    byId("evidence-liquid").textContent = formatPercent(climate.liquidWaterFraction);
    byId("evidence-pressure").textContent = `${state.inputs.atmosphericPressure.toFixed(2)} atm`;
    byId("evidence-flux").textContent = `${state.physics.stellarFluxEarth.toFixed(2)} ×`;
  }

  function describePlanet(state) {
    const climate = state.climate;
    const temperatureState = App.environment.temperatureStatus(climate.meanSurfaceTemperatureC);
    return `${state.inputs.planetName} is a fictional rocky planet shown with ${Math.round(climate.liquidWaterFraction * 100)} percent liquid surface water, ${Math.round(climate.iceFraction * 100)} percent ice, and ${Math.round(climate.exposedSurfaceFraction * 100)} percent exposed or vapor-cleared surface. Its estimated global mean temperature is ${climate.meanSurfaceTemperatureC.toFixed(1)} degrees Celsius, classified ${temperatureState}. The atmosphere is ${App.environment.pressureStatus(state.inputs.atmosphericPressure).toLowerCase()}, geology is ${state.inputs.geologicActivity.toLowerCase()}, and lighting comes from a ${state.physics.star.shortName}.`;
  }

  function applyPlanetVisual(svg, state) {
    const visual = state.visualState;
    svg.style.setProperty("--water-opacity", String(App.utils.clamp(0.08 + (visual.liquidWaterFraction * 1.25), 0.08, 0.95)));
    svg.style.setProperty("--terrain-opacity", String(App.utils.clamp(0.20 + visual.exposedSurfaceFraction, 0.20, 0.95)));
    svg.style.setProperty("--ice-opacity", String(App.utils.clamp(visual.iceFraction * 1.35, 0, 0.98)));
    svg.style.setProperty("--atmosphere-opacity", String(App.utils.clamp(visual.atmosphericRimStrength, 0.08, 0.82)));
    svg.style.setProperty("--haze-opacity", String(App.utils.clamp(visual.hazeStrength * 0.42, 0, 0.42)));
    svg.style.setProperty("--volcano-opacity", String(App.utils.clamp(visual.geologicActivity * 0.92, 0, 0.92)));
    svg.style.setProperty("--heat-opacity", String(App.utils.clamp(visual.heatLevel * 0.42, 0.03, 0.42)));
    svg.style.setProperty("--star-light", visual.starLightColor);
    const starDisc = svg.querySelector(".star-context circle:first-child");
    if (starDisc) {
      starDisc.style.fill = visual.starLightColor;
      starDisc.style.filter = `drop-shadow(0 0 15px ${visual.starLightColor})`;
    }
    const description = svg.querySelector("desc");
    if (description) description.textContent = describePlanet(state);
  }

  function renderPlanet(state) {
    const climate = state.climate;
    const svg = byId("planet-visual");
    applyPlanetVisual(svg, state);

    const temperatureState = App.environment.temperatureStatus(climate.meanSurfaceTemperatureC);
    const planetDescription = describePlanet(state);
    byId("planet-visual-desc").textContent = planetDescription;
    byId("planet-text-status").textContent = planetDescription;
    byId("planet-subtitle").textContent = `${temperatureState} · ${state.statuses.water.status} · Climate model ${climate.modelConfidence}`;
  }

  function prefixSvgIds(svg, prefix) {
    const idMap = new Map();
    svg.querySelectorAll("[id]").forEach((element) => {
      const previous = element.id;
      const next = `${prefix}-${previous}`;
      idMap.set(previous, next);
      element.id = next;
    });
    const attributes = ["aria-labelledby", "fill", "filter", "clip-path", "href", "xlink:href"];
    [svg, ...svg.querySelectorAll("*")].forEach((element) => {
      attributes.forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        let updated = value;
        idMap.forEach((next, previous) => {
          updated = updated.replaceAll(`#${previous}`, `#${next}`);
          if (attribute === "aria-labelledby") {
            updated = updated.split(" ").map((token) => token === previous ? next : token).join(" ");
          }
        });
        element.setAttribute(attribute, updated);
      });
    });
  }

  function createPlanetPreview(state, prefix, label) {
    const source = byId("planet-visual");
    const svg = source.cloneNode(true);
    svg.removeAttribute("id");
    svg.classList.add("comparison-planet-visual");
    svg.querySelectorAll(".overlay-layer").forEach((layer) => layer.classList.remove("is-visible"));
    prefixSvgIds(svg, prefix);
    const title = svg.querySelector("title");
    if (title) title.textContent = `${label}: fictional modeled planet`;
    applyPlanetVisual(svg, state);
    return svg;
  }

  function renderStatuses(state) {
    const container = byId("status-cards");
    container.replaceChildren();
    statusOrder.forEach(([key, className]) => {
      const item = state.statuses[key];
      const details = document.createElement("details");
      details.className = `status-card ${className}`;
      const summary = document.createElement("summary");
      const heading = document.createElement("h3");
      heading.textContent = item.name;
      const value = document.createElement("p");
      value.className = "status-value";
      value.textContent = item.status;
      const evidence = document.createElement("p");
      evidence.className = "status-evidence";
      evidence.textContent = item.evidence;
      summary.append(heading, value, evidence);
      if (item.temporaryNonScoring) {
        const badge = document.createElement("span");
        badge.className = "temporary-badge";
        badge.textContent = "Temporary non-scoring evidence";
        summary.append(badge);
      }
      const detail = document.createElement("p");
      detail.className = "status-detail";
      detail.textContent = item.detail;
      details.append(summary, detail);
      container.append(details);
    });
  }

  function renderMission(explanation) {
    byId("mission-observation").textContent = explanation.observation;
    byId("mission-why").textContent = explanation.why;
    byId("mission-investigate").textContent = explanation.investigate;
    const chain = byId("causal-chain");
    chain.replaceChildren();
    explanation.chain.forEach((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      chain.append(item);
    });
  }

  function renderHistory(history) {
    const list = byId("change-history");
    list.replaceChildren();
    history.slice(0, 8).forEach((entry) => {
      const item = document.createElement("li");
      const kind = document.createElement("span");
      kind.className = `change-kind${entry.kind === "Model Response" ? " model" : ""}`;
      kind.textContent = `${entry.kind}: `;
      item.append(kind, document.createTextNode(entry.text));
      const time = document.createElement("time");
      time.dateTime = entry.timestamp;
      time.textContent = "Committed just now";
      item.append(time);
      list.append(item);
    });
    byId("history-count").textContent = String(history.length);
  }

  function render(state, explanation, history) {
    renderControls(state);
    renderHeader(state);
    renderEvidence(state);
    renderPlanet(state);
    renderStatuses(state);
    if (explanation) renderMission(explanation);
    if (history) renderHistory(history);
  }

  function setupStaticInteractions(callbacks) {
    document.querySelectorAll(".accordion-button").forEach((button) => {
      button.addEventListener("click", () => {
        const targetId = button.getAttribute("aria-controls");
        document.querySelectorAll(".accordion-button").forEach((other) => {
          const otherTarget = byId(other.getAttribute("aria-controls"));
          const shouldOpen = other === button && other.getAttribute("aria-expanded") !== "true";
          other.setAttribute("aria-expanded", String(shouldOpen));
          otherTarget.hidden = !shouldOpen;
          other.closest(".control-family").classList.toggle("is-open", shouldOpen);
        });
      });
    });

    byId("why-toggle").addEventListener("click", () => {
      const button = byId("why-toggle");
      const panel = byId("causal-panel");
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    });

    document.querySelectorAll("[data-overlay]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        document.querySelectorAll(`[data-overlay-layer="${checkbox.dataset.overlay}"]`).forEach((layer) => {
          layer.classList.toggle("is-visible", checkbox.checked);
        });
      });
    });

    const helpDialog = byId("help-dialog");
    byId("help-button").addEventListener("click", () => helpDialog.showModal());
    const resetDialog = byId("reset-dialog");
    byId("reset-button").addEventListener("click", () => resetDialog.showModal());
    byId("confirm-reset").addEventListener("click", callbacks.onReset);
    byId("earth-reference-button").addEventListener("click", callbacks.onEarthReference);
  }

  App.ui = Object.freeze({
    readInputs,
    writeInputs,
    setStarOrbitRange,
    render,
    renderMission,
    renderHistory,
    createPlanetPreview,
    setupStaticInteractions,
  });
})(window.HabitablePlanet = window.HabitablePlanet || {});

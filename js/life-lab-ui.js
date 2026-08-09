(function (App) {
  "use strict";

  function byId(id) { return document.getElementById(id); }

  const statusSymbols = Object.freeze({
    Compatible: "✓",
    Challenging: "!",
    Incompatible: "×",
    Uncertain: "?",
  });

  function formatAtm(value) {
    if (value === 0) return "0 atm";
    if (value < 0.001) return `${value.toFixed(5).replace(/0+$/, "")} atm`;
    return `${value.toFixed(value < 0.01 ? 4 : 3).replace(/0+$/, "").replace(/\.$/, "")} atm`;
  }

  function createEvidenceItem(item) {
    const listItem = document.createElement("li");
    const details = document.createElement("details");
    details.className = "life-evidence-item";

    const summary = document.createElement("summary");
    const heading = document.createElement("span");
    heading.className = "life-evidence-title";
    heading.textContent = item.title;
    const condition = document.createElement("span");
    condition.className = "life-evidence-condition";
    condition.textContent = item.condition;
    summary.append(heading, condition);

    const body = document.createElement("div");
    body.className = "life-evidence-body";
    const source = document.createElement("p");
    source.className = "evidence-source";
    source.textContent = item.source;
    const chain = document.createElement("ol");
    chain.className = "evidence-reasoning-chain";
    [item.condition, item.consequence, item.implication].forEach((text, index) => {
      const step = document.createElement("li");
      const label = document.createElement("strong");
      label.textContent = ["Condition", "Biological consequence", "Compatibility implication"][index];
      step.append(label, document.createTextNode(` — ${text}`));
      chain.append(step);
    });
    body.append(source, chain);
    details.append(summary, body);
    listItem.append(details);
    return listItem;
  }

  function renderEvidenceList(containerId, items, emptyMessage) {
    const container = byId(containerId);
    container.replaceChildren();
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-evidence";
      empty.textContent = emptyMessage;
      container.append(empty);
      return;
    }
    items.forEach((item) => container.append(createEvidenceItem(item)));
  }

  function renderCategoryComparison(results, selectedCategoryId) {
    results.forEach((result) => {
      const categoryId = result.category.id;
      const input = document.querySelector(`input[name="lifeCategory"][value="${categoryId}"]`);
      if (input) input.checked = categoryId === selectedCategoryId;
      const status = byId(`category-status-${categoryId}`);
      if (status) {
        status.textContent = `${statusSymbols[result.status]} ${result.status}`;
        status.dataset.status = result.status;
      }
      const card = document.querySelector(`[data-category-card="${categoryId}"]`);
      if (card) card.dataset.status = result.status;
    });
  }

  function render(planetState, results, selectedCategoryId, announce = false) {
    const selected = results.find((result) => result.category.id === selectedCategoryId) || results[0];
    renderCategoryComparison(results, selected.category.id);

    byId("selected-life-name").textContent = selected.category.name;
    const status = byId("life-compatibility-status");
    status.dataset.status = selected.status;
    status.replaceChildren();
    const symbol = document.createElement("span");
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = statusSymbols[selected.status];
    status.append(symbol, document.createTextNode(` ${selected.status}`));
    byId("life-compatibility-summary").textContent = selected.summary;

    byId("life-snapshot-temperature").textContent = `${planetState.climate.meanSurfaceTemperatureC.toFixed(1)}°C`;
    byId("life-snapshot-water").textContent = `${(planetState.climate.liquidWaterFraction * 100).toFixed(0)}%`;
    byId("life-snapshot-pressure").textContent = `${planetState.inputs.atmosphericPressure.toFixed(2)} atm`;
    byId("life-snapshot-oxygen").textContent = formatAtm(planetState.physics.gasPartialPressuresAtm.oxygen);

    renderEvidenceList("supporting-evidence", selected.evidence.supporting, "No approved supporting condition is decisive for this result.");
    renderEvidenceList("limiting-evidence", selected.evidence.limiting, "No approved major limiting condition is identified.");
    renderEvidenceList("uncertainty-evidence", selected.evidence.uncertainty, "No additional model uncertainty is identified for this interpretation.");

    if (announce) {
      byId("life-live-status").textContent = `${selected.category.name}: ${selected.status}. ${selected.summary}`;
    }
    return selected;
  }

  function setView(view) {
    const lifeMode = view === "life";
    byId("engineering").hidden = lifeMode;
    byId("planetary-status").hidden = lifeMode;
    byId("life-lab").hidden = !lifeMode;
    document.body.classList.toggle("life-lab-mode", lifeMode);
    document.querySelector(".laboratory-shell").classList.toggle("is-life-mode", lifeMode);

    const links = {
      build: byId("build-view-link"),
      dashboard: byId("dashboard-view-link"),
      life: byId("life-lab-view-link"),
    };
    Object.entries(links).forEach(([key, link]) => {
      if (key === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    byId("why-toggle").textContent = lifeMode ? "Why this interpretation?" : "Why did this change?";
  }

  function setupStaticInteractions(callbacks) {
    byId("life-category-selector").addEventListener("change", (event) => {
      if (event.target.name === "lifeCategory") callbacks.onCategoryChange(event.target.value);
    });
    byId("life-lab-view-link").addEventListener("click", (event) => {
      event.preventDefault();
      callbacks.onViewChange("life");
    });
    byId("build-view-link").addEventListener("click", (event) => {
      event.preventDefault();
      callbacks.onViewChange("build");
    });
    byId("dashboard-view-link").addEventListener("click", (event) => {
      event.preventDefault();
      callbacks.onViewChange("dashboard");
    });
  }

  App.lifeLabUI = Object.freeze({ render, setView, setupStaticInteractions });
})(window.HabitablePlanet = window.HabitablePlanet || {});

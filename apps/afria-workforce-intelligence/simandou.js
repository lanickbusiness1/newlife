const model = Object.freeze({
  environment: "SYNTHETIC_SANDBOX",
  methodologyApproved: false,
  valueCaptureRatioPercent: null,
  truthClass: "SIMULATION",
});

const tabs = [...document.querySelectorAll("nav [data-target]")];
const workspaces = [...document.querySelectorAll("[data-view]")];

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;
    for (const candidate of tabs) candidate.setAttribute("aria-selected", String(candidate === tab));
    for (const workspace of workspaces) workspace.classList.toggle("active", workspace.dataset.view === target);
    document.querySelector(`[data-view="${target}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

const methodologyStatus = document.querySelector("#method-status");
const valueCaptureCard = document.querySelector("#kpi-value-capture");

function renderMethodologyGate() {
  const valueCaptureRatioPercent = model.methodologyApproved ? model.valueCaptureRatioPercent : null;
  if (!model.methodologyApproved || valueCaptureRatioPercent === null) {
    if (methodologyStatus) methodologyStatus.textContent = "METHOD_NOT_APPROVED — aucune agrégation souveraine publiée.";
    if (valueCaptureCard) valueCaptureCard.textContent = "METHOD_NOT_APPROVED";
    return;
  }
  if (methodologyStatus) methodologyStatus.textContent = `${valueCaptureRatioPercent.toFixed(2)}% · méthodologie approuvée`;
  if (valueCaptureCard) valueCaptureCard.textContent = `${valueCaptureRatioPercent.toFixed(2)}%`;
}

renderMethodologyGate();

const form = document.querySelector("#scenario-form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const capex = readNonNegative(data, "capex");
  const revenue = readNonNegative(data, "revenue");
  const opex = readNonNegative(data, "opex");
  const debt = readNonNegative(data, "debt");
  const discountPercent = readBounded(data, "discount", 0, 100);
  const years = Math.trunc(readBounded(data, "years", 1, 100));

  const ebitda = revenue - opex;
  const discount = discountPercent / 100;
  let npv = -capex;
  for (let year = 1; year <= years; year += 1) npv += ebitda / ((1 + discount) ** year);
  const dscr = debt === 0 ? null : ebitda / debt;

  setText("#res-ebitda", formatUsd(ebitda));
  setText("#res-npv", formatUsd(npv));
  setText("#res-dscr", dscr === null ? "N/A" : dscr.toFixed(2));
});

function readNonNegative(data, key) {
  return readBounded(data, key, 0, Number.MAX_SAFE_INTEGER);
}

function readBounded(data, key, min, max) {
  const value = Number(data.get(key));
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${key} hors limites`);
  return value;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function formatUsd(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

interface ExportPayload {
  productName: string;
  assetId: string;
  offer: string;
  productionRevenueReady: boolean;
}

export function exportMarketingPlanMarkdown(payload: ExportPayload): string {
  return [
    `# ${payload.productName} — Production Product`,
    "",
    `Canonical Asset ID: ${payload.assetId}`,
    `Offer: ${payload.offer}`,
    `PRODUCTION_REVENUE_READY=${payload.productionRevenueReady}`,
    "",
    "## Revenue chain",
    "Product → Offer → ICP → Proof → Channel → Script → CRM → Sequence → Payment → First revenue → Case study → Upsell → Scale / Correct / Kill",
    "",
    "## Governance",
    "S7+ policy, M6 evidence, CyberAudit, M8 and Big4 gates remain visible."
  ].join("\n");
}

export function exportEvidenceJson(payload: ExportPayload): string {
  return JSON.stringify({
    ...payload,
    productStandard: "Production Product",
    evidenceType: "AFRIA_MARKETING_TEAM_PRODUCTION_EVIDENCE",
    generatedAt: new Date(0).toISOString()
  }, null, 2);
}

export function exportHtmlReport(payload: ExportPayload): string {
  return `<!doctype html><html><body style="background:#120907;color:#f8ead5"><h1>${payload.productName}</h1><p>${payload.assetId}</p><p>Production Product</p><p>PRODUCTION_REVENUE_READY=${payload.productionRevenueReady}</p></body></html>`;
}

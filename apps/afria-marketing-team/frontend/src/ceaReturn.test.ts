import { describe, expect, test } from "vitest";
import {
  buildCeaCrmPayload,
  buildCeaQualifyPayload,
  canPersistCeaLead,
  resolveCeaAttribution,
  type CeaQualification,
  type CeaReturnForm,
} from "./ceaReturn";

const form: CeaReturnForm = {
  name: "Awa Diaspora",
  email: "awa@example.com",
  whatsapp: "+33 6 00 00 00 00",
  country: "France",
  organization: "Diaspora Bénin",
  language: "FR",
  primaryIntent: "Mémoire & Culture",
  whyNow: "Je prépare un voyage culturel.",
  horizon: "30-90d",
  budgetUsd: 1200,
  household: "2 personnes",
  investmentProject: "",
  consentContact: true,
};

const qualification: CeaQualification = {
  profile: "CEA_RETURN",
  content_id: "VODUN-KAKPO-001",
  narrative_source: "benin-roots",
  primary_intent: "Mémoire & Culture",
  language: "FR",
  priority: "P1 - Cette semaine",
  next_best_offer: "Accueil Cotonou 600 USD",
  estimated_value_usd: 600,
  payment_status: "Non proposé",
  revenue_attributed_usd: 0,
  contact_allowed: true,
};

describe("CEA Retour aux Sources capture contract", () => {
  test("preserves UTM content and narrative source", () => {
    expect(resolveCeaAttribution("?utm_source=linkedin&utm_campaign=benin-roots&utm_content=BEN-VODUN-01")).toEqual({
      contentId: "BEN-VODUN-01",
      narrativeSource: "benin-roots",
      sourceCampaign: "linkedin",
    });
  });

  test("uses Griot defaults when tracking parameters are absent", () => {
    expect(resolveCeaAttribution("")).toEqual({
      contentId: "VODUN-KAKPO-001",
      narrativeSource: "griot/capsule-01",
      sourceCampaign: "griot-vodun-patrimoine-avenir",
    });
  });

  test("builds qualification payload without PII", () => {
    const payload = buildCeaQualifyPayload(form, resolveCeaAttribution(""));
    expect(payload.content_id).toBe("VODUN-KAKPO-001");
    expect(payload.primary_intent).toBe("Mémoire & Culture");
    expect(payload.budget_usd).toBe(1200);
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("whatsapp");
  });

  test("requires consent and at least one contact path before CRM persistence", () => {
    expect(canPersistCeaLead(form)).toBe(true);
    expect(canPersistCeaLead({ ...form, consentContact: false })).toBe(false);
    expect(canPersistCeaLead({ ...form, email: "", whatsapp: "" })).toBe(false);
  });

  test("maps backend qualification to the canonical CRM contract", () => {
    const payload = buildCeaCrmPayload(
      form,
      resolveCeaAttribution("?utm_source=linkedin&utm_campaign=benin-roots"),
      qualification,
      "cea-return-001",
    );
    expect(payload.lead_id).toBe("cea-return-001");
    expect(payload.content_id).toBe("VODUN-KAKPO-001");
    expect(payload.narrative_source).toBe("benin-roots");
    expect(payload.next_best_offer).toBe("Accueil Cotonou 600 USD");
    expect(payload.priority).toBe("P1 - Cette semaine");
    expect(payload.consent_contact).toBe(true);
    expect(payload.revenue_attributed_usd).toBe(0);
  });
});

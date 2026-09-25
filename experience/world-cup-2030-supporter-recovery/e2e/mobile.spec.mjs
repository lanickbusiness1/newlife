import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["Pixel 5"] });

test("mobile pilot: profile, offline community, ticket safety and grounded assistant", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/index.html");
  await expect(page).toHaveTitle(/Supporter 2030/);
  await expect(page.getByRole("heading", { name: /football mondial/i })).toBeVisible();
  await expect(page.getByText("6 qualifications hôtes sourcées")).toBeVisible();

  await page.getByRole("button", { name: "Profil" }).click();
  await page.getByLabel("Pseudo").fill("QA Supporter");
  await page.getByLabel("Pays").fill("Bénin");
  await page.getByLabel("Équipes favorites").fill("Bénin, Morocco, Brazil");
  await page.getByRole("button", { name: "Enregistrer sur cet appareil" }).click();
  await expect(page.getByLabel("Pseudo")).toHaveValue("QA Supporter");

  await page.getByRole("button", { name: "Accueil" }).click();
  await expect(page.getByRole("heading", { name: "QA Supporter" })).toBeVisible();

  await page.getByRole("button", { name: "Communautés" }).click();
  await page.getByLabel("Brouillon supporter").fill("Message QA hors ligne");
  await page.getByRole("button", { name: "Mettre en file offline" }).click();
  await expect(page.getByText("COMMUNITY_DRAFT")).toBeVisible();
  await expect(page.getByText("Message QA hors ligne")).toBeVisible();
  await expect(page.getByText(/AUTHORITY_EDGE_PENDING/)).toBeVisible();

  await page.getByRole("button", { name: "Ticket Safety" }).click();
  await page.getByLabel("Vendeur / plateforme").fill("QA Seller");
  await page.getByLabel("Référence").fill("REF-2030");
  await page.getByLabel("Note de preuve").fill("Carte 4111111111111111 reçue");
  await page.getByRole("button", { name: "Enregistrer localement" }).click();
  await expect(page.getByText("[redacted-card-like-number]")).toBeVisible();
  await expect(page.getByText("4111111111111111")).toHaveCount(0);

  await page.getByRole("button", { name: "Assistant IA" }).click();
  await expect(page.getByText(/API BOUNDARY · PASS/)).toBeVisible();
  await expect(page.getByText(/Aucun calendrier, stade ou autre équipe n’est revendiqué/)).toBeVisible();

  const swReady = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  expect(swReady).toBe(true);
});

test("mobile pilot never presents unsupported official affiliation", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/index.html");
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("official fifa partner");
  expect(body).not.toContain("endorsed by fifa");
  expect(body).not.toContain("guinée qualifiée");
});

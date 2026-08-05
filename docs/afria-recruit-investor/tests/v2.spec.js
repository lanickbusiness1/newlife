import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/rpc/investor_demo_kpis', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: 12, institutional_needs: 3, candidate_job_matches: 7, placements: 2 }) });
  });
  await page.goto('http://127.0.0.1:4173');
});

test('shows AfrIAgenesis logos and WhatsApp CTA', async ({ page }) => {
  await expect(page.locator('[data-testid="brand-logo-header"]')).toBeVisible();
  await expect(page.locator('[data-testid="brand-logo-footer"]')).toBeVisible();
  const whatsapp = page.getByRole('link', { name: 'Échanger sur WhatsApp' });
  await expect(whatsapp).toBeVisible();
  await expect(whatsapp).toHaveAttribute('href', /wa\.me\/2290161107373/);
  await expect(whatsapp).toHaveAttribute('href', /Bonjour/);
});

test('assistant answers matching questions and guides to scenario', async ({ page }) => {
  await page.getByRole('button', { name: 'Ouvrir AfrIA Recruit Assistant' }).click();
  await expect(page.locator('#assistant-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Comprendre le matching' }).click();
  await expect(page.locator('#assistant-messages')).toContainText('critères');
  const input = page.getByLabel('Votre question à AfrIA Recruit Assistant');
  await input.fill('comment fonctionne le matching ?');
  await input.press('Enter');
  await expect(page.locator('#assistant-messages')).toContainText('correspondance');
  await page.getByRole('button', { name: 'Voir un cas d’usage' }).click();
  await expect(page.locator('#interactive-demo')).toBeInViewport();
  await page.getByRole('button', { name: 'Effacer la conversation' }).click();
  await expect(page.locator('#assistant-messages')).toContainText('Bonjour');
});

test('mobile page has no horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173');
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
  await context.close();
});

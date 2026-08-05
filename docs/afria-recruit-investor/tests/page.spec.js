import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/rest/v1/rpc/investor_demo_kpis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: 12,
        institutional_needs: 3,
        candidate_job_matches: 7,
        placements: 2,
      }),
    });
  });
  await page.goto('http://127.0.0.1:4173');
});

test('hides technical internals from the visible investor interface', async ({ page }) => {
  const visibleText = await page.locator('body').innerText();
  for (const forbidden of [
    'Supabase',
    'ACTIVE_HEALTHY',
    'RLS',
    'RPC',
    'GitHub',
    'publishable',
    'investor_demo_kpis',
    'hzrnrdeqscfesxlvfztx',
  ]) {
    expect(visibleText).not.toContain(forbidden);
  }
  await expect(page.getByText('Données actualisées')).toBeVisible();
});

test('updates the visible indicators from the secured aggregate response', async ({ page }) => {
  await expect(page.locator('#candidates')).toHaveText('12');
  await expect(page.locator('#needs')).toHaveText('3');
  await expect(page.locator('#matches')).toHaveText('7');
  await expect(page.locator('#placements')).toHaveText('2');
  await expect(page.locator('#pipeline')).toHaveText('10');
});

test('runs the complete interactive investor scenario', async ({ page }) => {
  await page.getByRole('button', { name: 'Lancer la démonstration' }).click();
  await expect(page.locator('#interactive-demo')).toBeInViewport();

  const runButton = page.getByRole('button', { name: 'Lancer la présélection' });
  await expect(runButton).toBeDisabled();

  await page.getByRole('button', { name: 'Transformation numérique' }).click();
  await expect(runButton).toBeEnabled();
  await runButton.click();

  await expect(page.locator('#demo-result')).toBeVisible();
  await expect(page.locator('#selected-role')).toHaveText('Responsable transformation numérique');
  await expect(page.getByText('Profil A — expérience sectorielle forte')).toBeVisible();

  await page.getByRole('button', { name: 'Valider la revue humaine' }).click();
  await expect(page.locator('#toast')).toContainText('Revue humaine validée');

  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(page.locator('#demo-select')).toBeVisible();
  await expect(runButton).toBeDisabled();
});

test('navigation buttons lead to their intended sections', async ({ page }) => {
  await page.getByRole('button', { name: 'Voir les indicateurs' }).click();
  await expect(page.locator('#indicators')).toBeInViewport();

  await page.getByRole('button', { name: 'Découvrir le parcours' }).click();
  await expect(page.locator('#journey')).toBeInViewport();
});

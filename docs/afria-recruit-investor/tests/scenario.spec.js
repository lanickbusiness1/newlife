import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
});

test('runs the interactive recruitment scenario', async ({ page }) => {
  await page.getByRole('button', { name: 'Lancer la démonstration' }).click();
  await expect(page.locator('#interactive-demo')).toBeInViewport();
  const run = page.getByRole('button', { name: 'Lancer la présélection' });
  await expect(run).toBeDisabled();
  await page.getByRole('button', { name: 'Transformation numérique' }).click();
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.locator('#demo-result')).toBeVisible();
  await expect(page.locator('#selected-role')).toHaveText('Responsable transformation numérique');
  await page.getByRole('button', { name: 'Valider la revue humaine' }).click();
  await expect(page.locator('#toast')).toContainText('Revue humaine validée');
  await page.getByRole('button', { name: 'Recommencer' }).click();
  await expect(run).toBeDisabled();
});

test('hero navigation reaches indicators and journey', async ({ page }) => {
  await page.getByRole('button', { name: 'Voir les indicateurs' }).click();
  await expect(page.locator('#indicators')).toBeInViewport();
  await page.getByRole('button', { name: 'Découvrir le parcours' }).click();
  await expect(page.locator('#journey')).toBeInViewport();
});

test('visible interface excludes technical internals', async ({ page }) => {
  const visible = await page.locator('body').innerText();
  for (const word of ['Supabase', 'ACTIVE_HEALTHY', 'RLS', 'RPC', 'GitHub', 'publishable', 'API key']) {
    expect(visible).not.toContain(word);
  }
});

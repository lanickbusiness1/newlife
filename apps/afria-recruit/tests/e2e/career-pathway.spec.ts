import { test, expect } from '@playwright/test';

const SYNTHETIC_TOKEN = 'e2e-synthetic-token';

async function authenticate(page: import('@playwright/test').Page) {
  await page.context().addCookies([{
    name: 'afria_recruit_session',
    value: SYNTHETIC_TOKEN,
    url: 'http://127.0.0.1:4174',
    httpOnly: true,
    sameSite: 'Strict',
  }]);
}

test('candidate sees ranked career next actions with provenance and no auto-submit', async ({ page }) => {
  await authenticate(page);
  await page.goto('/candidate/dashboard');
  await page.getByLabel('Objectif de carrière').fill('Programme Officer');
  await page.getByRole('button', { name: 'Calculer ma prochaine étape' }).click();

  await expect(page.getByRole('heading', { name: 'Prochaines étapes recommandées' })).toBeVisible();
  await expect(page.getByText('Aucune recommandation sûre tant que les critères bloquants ne sont pas vérifiés.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'À vérifier avant recommandation' })).toBeVisible();
  await expect(page.getByText('Source officielle').first()).toBeVisible();
  await expect(page.getByText('À vérifier').first()).toBeVisible();
  await expect(page.getByText('Score de progression — heuristique explicable').first()).toBeVisible();
  await expect(page.getByText(/Âge à renseigner|Données à compléter/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Postuler automatiquement/i })).toHaveCount(0);
});
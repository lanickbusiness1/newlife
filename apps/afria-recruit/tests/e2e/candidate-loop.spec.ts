import { test, expect } from '@playwright/test';

const SYNTHETIC_TOKEN = 'e2e-synthetic-token';

async function authenticate(page: import('@playwright/test').Page) {
  await page.addInitScript((token) => window.localStorage.setItem('afria_recruit_access_token', token), SYNTHETIC_TOKEN);
}

async function completeOptimizer(page: import('@playwright/test').Page) {
  await page.goto('/candidate/cv-optimizer');
  await page.getByRole('button', { name: 'Lancer le diagnostic' }).click();
  await page.getByRole('button', { name: 'Choisir une offre cible' }).click();
  await page.getByRole('radio', { name: /Responsable programmes régionaux/i }).check();
  await page.getByRole('button', { name: 'Analyser les écarts' }).click();
  await page.getByRole('button', { name: 'Générer les deux versions' }).click();
  await page.getByLabel('Raison de la validation').fill('Les faits et les preuves synthétiques ont été contrôlés avant validation.');
  await page.getByRole('button', { name: 'Valider humainement' }).click();
  await expect(page.getByText('Validation humaine enregistrée')).toBeVisible();
}

test('candidate closes the loop through interview practice and a non-submitted application package', async ({ page }) => {
  await authenticate(page);
  await completeOptimizer(page);
  await page.getByRole('link', { name: 'Préparer mon entretien' }).click();

  await expect(page.getByRole('heading', { name: 'Interview Coach™' })).toBeVisible();
  await page.getByLabel(/J’accepte le traitement de mes réponses/i).check();
  await page.getByRole('button', { name: 'Commencer l’entretien' }).click();
  await expect(page.getByTestId('interview-question')).toContainText(/situation concrète|réalisation pertinente/i);

  await page.getByLabel('Votre réponse').fill('Je coordonne les activités en utilisant les faits documentés du projet et je distingue clairement mon rôle de celui de l’équipe.');
  await page.getByRole('button', { name: 'Recevoir mon feedback' }).click();
  await expect(page.getByText(/faits précis|preuves/i)).toBeVisible();
  await expect(page.getByText(/réponse.*non conservée/i)).toBeVisible();

  await page.getByRole('link', { name: 'Créer mon dossier de candidature' }).click();
  await expect(page.getByRole('heading', { name: 'Dossier de candidature' })).toBeVisible();
  await page.getByRole('button', { name: 'Créer le dossier sans envoyer' }).click();
  await expect(page.getByText('Dossier créé — non envoyé')).toBeVisible();
  await expect(page.getByText(/Aucune candidature n’a été envoyée automatiquement/i)).toBeVisible();

  await page.getByRole('button', { name: 'J’ai obtenu un entretien' }).click();
  await expect(page.getByText(/En attente de confirmation/i)).toBeVisible();
  await expect(page.getByText(/statut officiel reste « started »/i)).toBeVisible();
});

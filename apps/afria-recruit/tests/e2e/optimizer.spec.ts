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

test('candidate completes the evidence-safe mission with recruiter lens and elicitation', async ({ page }) => {
  await authenticate(page);
  await page.goto('/candidate/dashboard');

  await expect(page.getByRole('heading', { name: /Candidate OS/i })).toBeVisible();
  await expect(page.getByText('Responsable opérations humanitaires')).toBeVisible();
  await page.getByRole('link', { name: 'Optimiser mon CV' }).click();

  await expect(page).toHaveURL(/\/candidate\/cv-optimizer/);
  await expect(page.getByRole('heading', { name: /Je veux décrocher ce poste/i })).toBeVisible();
  await expect(page.getByText('Gestion de projets')).toBeVisible();
  await expect(page.getByText('EVIDENCED').first()).toBeVisible();
  await expect(page.getByText('Logistique humanitaire')).toBeVisible();
  await expect(page.getByText('DECLARED').first()).toBeVisible();

  await page.getByRole('button', { name: 'Lancer le diagnostic' }).click();
  await expect(page.getByText(/compétence\(s\) restent déclaratives/i)).toBeVisible();

  await page.getByRole('button', { name: 'Choisir une offre cible' }).click();
  await page.getByRole('radio', { name: /Responsable programmes régionaux/i }).check();
  await page.getByRole('button', { name: 'Analyser les écarts' }).click();

  const projectRow = page.getByTestId('gap-row-skill:skill-project');
  await expect(projectRow).toContainText('Gestion de projets');
  await expect(projectRow).toContainText('COVERED');

  const financeRow = page.getByTestId('gap-row-skill:skill-finance');
  await expect(financeRow).toContainText('Conformité financière');
  await expect(financeRow).toContainText('GAP');
  await expect(financeRow).toContainText(/Aucune compétence correspondante/i);
  await expect(page.getByText(/Conformité financière.*VERIFIED/i)).toHaveCount(0);

  await expect(page.getByRole('heading', { name: /Recruiter Lens/i })).toBeVisible();
  const financeLens = page.getByTestId('recruiter-lens-skill:skill-finance');
  await expect(financeLens).toContainText('Conformité financière');
  await expect(financeLens).toContainText('GAP');
  await expect(financeLens).toContainText(/HIGH|BLOCKING/);
  await expect(financeLens).toContainText(/preuve|mise en situation|work sample/i);
  await expect(financeLens).toContainText(/ne pas revendiquer/i);

  await expect(page.getByRole('heading', { name: /Evidence Elicitation/i })).toBeVisible();
  const factInput = page.getByLabel('Fait complémentaire confirmé');
  await expect(factInput).toBeVisible();
  await expect(page.getByRole('button', { name: 'Proposer une reformulation' })).toBeDisabled();
  await factInput.fill('Coordination de plusieurs équipes terrain sur plusieurs sites.');
  await page.getByRole('checkbox', { name: /J’autorise le traitement/i }).check();
  await page.getByRole('button', { name: 'Proposer une reformulation' }).click();
  const rewriteResult = page.locator('.rewrite-result');
  await expect(rewriteResult.getByText(/Détail déclaré et confirmé par le candidat/i)).toBeVisible();
  await expect(rewriteResult).toContainText(/plusieurs équipes terrain sur plusieurs sites/i);
  await expect(rewriteResult).not.toContainText(/VERIFIED.*plusieurs équipes terrain/i);

  await page.getByRole('button', { name: 'Générer les deux versions' }).click();
  await expect(page.getByRole('heading', { name: 'CV ATS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CV humain' })).toBeVisible();
  const atsFingerprint = await page.getByTestId('ats-fingerprint').textContent();
  const humanFingerprint = await page.getByTestId('human-fingerprint').textContent();
  expect(atsFingerprint).toBeTruthy();
  expect(atsFingerprint).toBe(humanFingerprint);

  await page.getByLabel('Raison de la validation').fill('Les faits présentés correspondent au profil synthétique et les gaps restent visibles.');
  await page.getByRole('button', { name: 'Valider humainement' }).click();
  await expect(page.getByText('Validation humaine enregistrée')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Préparer mon entretien' })).toBeVisible();
  await expect(page.getByRole('button', { name: /envoyer|soumettre|postuler automatiquement/i })).toHaveCount(0);
});

test('optimizer remains usable at 390x844 without horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await authenticate(page);
  await page.goto('/candidate/cv-optimizer');
  await expect(page.getByRole('heading', { name: /Je veux décrocher ce poste/i })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
  await context.close();
});

test('primary optimizer controls are reachable by keyboard', async ({ page }) => {
  await authenticate(page);
  await page.goto('/candidate/cv-optimizer');
  await page.keyboard.press('Tab');
  let foundDiagnostic = false;
  for (let index = 0; index < 15; index += 1) {
    const label = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active?.innerText || active?.getAttribute('aria-label') || '';
    });
    if (/Lancer le diagnostic/i.test(label)) {
      foundDiagnostic = true;
      break;
    }
    await page.keyboard.press('Tab');
  }
  expect(foundDiagnostic).toBe(true);
});

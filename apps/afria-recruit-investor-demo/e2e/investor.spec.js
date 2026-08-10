import { test, expect } from '@playwright/test';

const rpcPattern = '**/rest/v1/rpc/investor_demo_kpis';

async function serveVerifiedKpis(page) {
  let calls = 0;
  await page.route(rpcPattern, async (route) => {
    calls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: 12,
        institutional_needs: 3,
        candidate_job_matches: 7,
        placements: 2,
        pipeline_opportunities: 10,
      }),
    });
  });
  return () => calls;
}

test('renders the verified RPC aggregate in the exact artifact under test', async ({ page }) => {
  const rpcCalls = await serveVerifiedKpis(page);

  await page.goto('/');

  await expect.poll(rpcCalls).toBe(1);
  await expect(page.locator('#candidates')).toHaveText('12');
  await expect(page.locator('#needs')).toHaveText('3');
  await expect(page.locator('#matches')).toHaveText('7');
  await expect(page.locator('#placements')).toHaveText('2');
  await expect(page.locator('#pipeline')).toHaveText('10');
  await expect(page.locator('#data-status')).toContainText('Données agrégées vérifiées');
});

test('never replaces an unavailable backend with fabricated KPIs', async ({ page }) => {
  await page.route(rpcPattern, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'unavailable' }),
    });
  });

  await page.goto('/');

  await expect(page.locator('#data-status')).toContainText('Indicateurs temporairement indisponibles');
  for (const selector of ['#candidates', '#needs', '#matches', '#placements', '#pipeline']) {
    await expect(page.locator(selector)).toHaveText('—');
  }
  await expect(page.locator('body')).not.toContainText('1 284');
  await expect(page.locator('body')).not.toContainText('184,5 M GNF');
});

test('states the governed staging scope and excludes unsupported claims', async ({ page }) => {
  await serveVerifiedKpis(page);
  await page.goto('/');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText('STAGING — CONCEPT — HORS PRODUCTION', { exact: true })).toBeVisible();
  await expect(page.getByText(/aucune donnée personnelle réelle/i).first()).toBeVisible();
  await expect(page.locator('[data-testid="brand-logo-header"]')).toBeVisible();
  await expect(page.locator('[data-testid="brand-logo-footer"]')).toBeVisible();

  const visible = await page.locator('body').innerText();
  for (const unsupported of ['CIAUD', 'Orange Guinée', 'UdA', '92%', '87%', '82%', 'Supabase', 'RLS', 'RPC', 'ACTIVE_HEALTHY']) {
    expect(visible).not.toContain(unsupported);
  }
});

test('blocks the illustrative shortlist until consent and verification gates are acknowledged', async ({ page }) => {
  await serveVerifiedKpis(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Lancer la démonstration' }).click();
  await expect(page.locator('#interactive-demo')).toBeInViewport();

  const run = page.getByRole('button', { name: 'Lancer la présélection' });
  await page.getByRole('button', { name: 'Transformation numérique' }).click();
  await expect(run).toBeDisabled();

  await page.getByLabel('Consentement requis avant tout partage').check();
  await expect(run).toBeDisabled();
  await page.getByLabel('Vérification requise avant toute recommandation').check();
  await expect(run).toBeEnabled();
  await run.click();

  await expect(page.locator('#demo-result')).toBeVisible();
  await expect(page.locator('#demo-result')).toContainText('DÉCLARÉ — À VÉRIFIER');
  await expect(page.locator('#demo-result')).not.toContainText(/\b\d{2,3}\s*%/);
  await page.getByRole('button', { name: 'Confirmer la revue humaine' }).click();
  await expect(page.locator('#toast')).toContainText('Revue humaine documentée');
});

test('assistant safely handles matching and pilot intents', async ({ page }) => {
  await serveVerifiedKpis(page);
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error));
  await page.goto('/');

  const panel = page.locator('#assistant-panel');
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Ouvrir l’assistant guidé AfrIA Recruit' }).click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'Fermer l’assistant guidé' }).click();
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Ouvrir l’assistant guidé AfrIA Recruit' }).click();
  await page.getByRole('button', { name: 'Comprendre le matching' }).click();
  await expect(page.locator('#assistant-messages')).toContainText('critères lisibles');

  const input = page.getByLabel('Votre question à l’assistant AfrIA Recruit');
  await input.fill('Je veux parler à l’équipe pour un pilote');
  await input.press('Enter');
  await expect(page.locator('#assistant-messages')).toContainText('échange de cadrage');
  await expect(page.locator('#assistant-messages').getByRole('link', { name: 'WhatsApp' })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('provides a safe WhatsApp CTA and has no horizontal overflow on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await serveVerifiedKpis(page);
  await page.goto('/');

  const whatsapp = page.getByRole('link', { name: 'Échanger sur WhatsApp' });
  await expect(whatsapp).toBeVisible();
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/2290161107373\?/);
  await expect(whatsapp).toHaveAttribute('rel', /noopener/);

  const floatingBox = await whatsapp.boundingBox();
  const heroButtons = await page.locator('.hero-actions .button').all();
  for (const button of heroButtons) {
    const buttonBox = await button.boundingBox();
    const overlaps = floatingBox && buttonBox
      && floatingBox.x < buttonBox.x + buttonBox.width
      && floatingBox.x + floatingBox.width > buttonBox.x
      && floatingBox.y < buttonBox.y + buttonBox.height
      && floatingBox.y + floatingBox.height > buttonBox.y;
    expect(overlaps).toBeFalsy();
  }

  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  await context.close();
});

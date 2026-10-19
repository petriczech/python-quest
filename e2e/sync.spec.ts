import { Page, expect, test } from '@playwright/test';
import { runInstantly } from './helpers';

// Běží jen přes `npm run e2e:sync` (emulátory nastaví proměnné prostředí)
test.skip(!process.env['FIREBASE_AUTH_EMULATOR_HOST'], 'Bez emulátorů Firebase');

/** Přihlášení přes okno auth emulátoru: nový účet, nebo existující podle jména. */
async function signIn(page: Page, existing?: string): Promise<void> {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Přihlásit přes Google' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  if (existing) {
    await popup.getByText(existing).click();
  } else {
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.getByLabel('Display name').fill('Ema Studentka');
    await popup.getByLabel('Email').fill(`ema-${Date.now()}@example.com`);
    await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();
  }
  await popup.waitForEvent('close');
}

test('postup se uloží do účtu a po novém přihlášení vrátí', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('python-quest.emulators', '1'));
  await page.goto('/uloha/1-1');

  await signIn(page);
  await expect(page.getByRole('button', { name: 'Účet: Ema Studentka' })).toBeVisible();

  await page.getByRole('group', { name: 'Paleta bloků' }).getByRole('button', { name: 'dopředu' }).click();
  await runInstantly(page);
  await expect(page.getByRole('dialog').getByText('Získáno +70 XP.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Zkusit znovu' }).click();

  await page.getByRole('button', { name: 'Účet: Ema Studentka' }).click();
  await expect(page.getByText('Postup je uložený v účtu.')).toBeVisible();

  await page.getByRole('button', { name: 'Odhlásit' }).click();
  await expect(page.getByText('0 / 200 XP')).toBeVisible();

  await signIn(page, 'Ema Studentka');
  await expect(page.getByText('70 / 200 XP')).toBeVisible();
});

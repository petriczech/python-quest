import { Page, expect, test } from '@playwright/test';
import { runInstantly } from './helpers';

const python = (page: Page) => page.getByLabel('Python kód programu').innerText();

async function setValue(page: Page, label: string, value: string): Promise<void> {
  await page.getByLabel(label).fill(value);
  await page.getByLabel(label).press('Enter');
}

test('spirála s proměnnou delka se složí klikáním a dá tři hvězdy', async ({ page }) => {
  await page.goto('/uloha/3-4');
  const palette = page.getByRole('group', { name: 'Paleta bloků' });

  await palette.getByRole('button', { name: 'nastav' }).click();
  await setValue(page, 'Hodnota: nastav', '3');
  await palette.getByRole('button', { name: 'opakuj' }).click();
  await setValue(page, 'Hodnota: opakuj', '36');
  // Nové opakuj zůstane vybrané, další bloky jdou dovnitř
  await palette.getByRole('button', { name: 'dopředu' }).click();
  await page.getByRole('button', { name: '= delka: hodnota z proměnné, dopředu' }).click();
  await palette.getByRole('button', { name: 'vlevo' }).click();
  await setValue(page, 'Hodnota: vlevo', '60');
  await palette.getByRole('button', { name: 'změň' }).click();
  await setValue(page, 'Hodnota: změň', '3');

  await expect
    .poll(() => python(page))
    .toContain('delka = 3\nfor i in range(36):\n    forward(delka)\n    left(60)\n    delka = delka + 3');

  await runInstantly(page);
  await expect(page.getByRole('dialog').getByRole('img', { name: '3 ze 3 hvězd' })).toBeVisible();
});

test('editor kódu jde zvětšit a zmenšit', async ({ page }) => {
  await page.goto('/uloha/1-1');
  await page.getByRole('button', { name: /Kód v Pythonu/ }).click();
  const editor = page.locator('.cm-editor');
  await expect(editor).toBeVisible();
  const before = (await editor.boundingBox())?.height ?? 0;

  await page.getByRole('button', { name: 'Zvětšit editor' }).click();
  await expect(page.getByRole('button', { name: 'Zmenšit editor' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(before);

  await page.getByRole('button', { name: 'Zmenšit editor' }).click();
  await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBe(before);
});

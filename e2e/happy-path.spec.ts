import { expect, test } from '@playwright/test';
import { runInstantly, seedProgress, worldOneUpTo } from './helpers';

test.describe('Happy path', () => {
  test('mapa → úloha → splnění → XP v hlavičce', async ({ page }) => {
    await page.goto('/mapa');
    await expect(page.getByRole('heading', { name: 'Základy pohybu' })).toBeVisible();
    await expect(page.getByText('0 / 200 XP')).toBeVisible();

    await page.getByRole('link', { name: 'Začít' }).first().click();
    await expect(page).toHaveURL(/\/uloha\/1-1$/);
    await expect(page.getByRole('heading', { name: 'Úsečka', level: 1 })).toBeVisible();

    await page.getByRole('group', { name: 'Paleta bloků' }).getByRole('button', { name: 'dopředu' }).click();
    await expect(page.getByLabel('Python kód programu')).toContainText('forward(100)');

    await runInstantly(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img', { name: '3 ze 3 hvězd' })).toBeVisible();
    await expect(dialog.getByText('První krok')).toBeVisible();
    await expect(dialog.getByText('Získáno +70 XP.')).toBeVisible();

    await dialog.getByRole('link', { name: 'Další úloha' }).click();
    await expect(page).toHaveURL(/\/uloha\/1-2$/);
    await expect(page.getByText('70 / 200 XP')).toBeVisible();

    await page.getByRole('link', { name: 'Mapa', exact: true }).first().click();
    await expect(page.getByRole('img', { name: '3 ze 3 hvězd' })).toHaveCount(1);
  });

  test('neúplný program ukáže shodu a co chybí', async ({ page }) => {
    await page.goto('/uloha/1-1');
    const palette = page.getByRole('group', { name: 'Paleta bloků' });
    await palette.getByRole('button', { name: 'dopředu' }).click();
    await page.getByLabel('Hodnota: dopředu').fill('50');
    await page.getByLabel('Hodnota: dopředu').press('Enter');

    await runInstantly(page);

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('.score-value')).not.toHaveText('100 %');
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('výplň ukazuje vybranou barvu', async ({ page }) => {
    await seedProgress(page, { solved: [...worldOneUpTo(12), ...['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7']] });
    await page.goto('/uloha/2-8');
    await page.getByRole('group', { name: 'Paleta bloků' }).getByRole('button', { name: 'výplň' }).click();
    const select = page.getByLabel('Barva: výplň');
    await expect(select.locator('option:checked')).toHaveText('oranžová');

    await select.selectOption({ label: 'modrá' });
    await expect(select.locator('option:checked')).toHaveText('modrá');
    await expect(page.getByLabel('Python kód programu')).toContainText('fillcolor("#1F5FBF")');
  });

  test('všechny úlohy jsou otevřené i bez postupu', async ({ page }) => {
    await page.goto('/uloha/5-4');
    await expect(page.getByRole('heading', { name: 'Sierpinského trojúhelník', level: 1 })).toBeVisible();
    await page.goto('/mapa');
    await expect(page.getByText(/Zamčeno/)).toHaveCount(0);
  });

  // Postupné odemykání je vypnuté (UNLOCK_ALL), test se vrátí s ním
  test.skip('zamčená úloha se neotevře', async ({ page }) => {
    await page.goto('/uloha/2-1');
    await expect(page.getByRole('heading', { name: 'Úloha je zamčená' })).toBeVisible();
  });
});

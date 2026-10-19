import { expect, test } from '@playwright/test';
import { runInstantly, seedProgress } from './helpers';

const worldsOneAndTwo = [
  ...Array.from({ length: 12 }, (_, i) => `1-${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `2-${i + 1}`),
];

test('cyklus for s délkou z proměnné nakreslí spirálu', async ({ page }) => {
  await seedProgress(page, { solved: worldsOneAndTwo });
  await page.goto('/uloha/3-1');
  const palette = page.getByRole('group', { name: 'Paleta bloků' });
  const python = page.getByLabel('Python kód programu');

  // Nový cyklus zůstane vybraný, další bloky jdou dovnitř
  await palette.getByRole('button', { name: 'cyklus for' }).click();
  await palette.getByRole('button', { name: 'dopředu' }).click();
  await page.getByRole('button', { name: 'Délka z proměnné i: dopředu' }).click();
  await palette.getByRole('button', { name: 'vlevo' }).click();
  await expect(python).toContainText('for i in range(10, 200, 10):\n    forward(i)\n    left(90)');

  await runInstantly(page);
  await expect(page.getByRole('dialog').getByRole('img', { name: '3 ze 3 hvězd' })).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { fontsReady, runInstantly, seedProgress, worldOneUpTo } from './helpers';

const HEXAGON = (times: number) => [
  {
    kind: 'repeat',
    times,
    body: [
      { kind: 'repeat', times: 6, body: [{ kind: 'forward', value: 50 }, { kind: 'left', angle: 60 }] },
      { kind: 'right', angle: 120 },
    ],
  },
];

test.describe('Plátno a vzor', () => {
  test.beforeEach(async ({ page }) => {
    // Svět 2 odemčený, plástev rozpracovaná se 2 ze 3 šestiúhelníků
    const solved = [...worldOneUpTo(12), ...Array.from({ length: 8 }, (_, i) => `2-${i + 1}`)];
    await seedProgress(page, { solved, drafts: { '2-9': HEXAGON(2) } });
    await page.goto('/uloha/2-9');
    await fontsReady(page);
  });

  test('screenshot: vzor s kótami', async ({ page }) => {
    await expect(page.locator('app-pattern-figure')).toHaveScreenshot('pattern-honeycomb.png');
  });

  test('screenshot: výstup přes vzor', async ({ page }) => {
    await runInstantly(page);
    await expect(page.locator('.score-value')).toHaveText('74.4 %');
    await expect(page.locator('app-turtle-canvas')).toHaveScreenshot('canvas-overlay.png');
  });

  test('screenshot: režim rozdíl', async ({ page }) => {
    await page.getByRole('button', { name: 'Rozdíl' }).click();
    await runInstantly(page);
    await expect(page.getByRole('status')).toHaveText(/Chybí 4 čáry\./);
    await expect(page.locator('app-turtle-canvas')).toHaveScreenshot('canvas-diff.png');
  });
});

import { Locator, Page, expect, test } from '@playwright/test';
import { runInstantly, seedProgress, worldOneUpTo } from './helpers';

const python = (page: Page) => page.getByLabel('Python kód programu').innerText();

/**
 * Tažení myší po malých krocích. Cíl se měří jednou před tažením: CDK při řazení posouvá
 * sousední bloky přes `transform`, takže přeměřovaný cíl by před ukazatelem uhýbal.
 */
async function drag(page: Page, source: Locator, target: Locator, toBottom = false): Promise<void> {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) {
    throw new Error('Zdroj nebo cíl tažení není vidět');
  }
  let x = from.x + from.width / 2;
  let y = from.y + from.height / 2;
  const targetX = to.x + to.width / 2;
  const targetY = to.y + (toBottom ? to.height - 6 : to.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 30; i++) {
    x += (targetX - x) * 0.3;
    y += (targetY - y) * 0.3;
    await page.mouse.move(x, y);
    // CDK zpracovává pohyb po snímcích
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test.describe('Drag & drop', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgress(page, {
      solved: worldOneUpTo(11),
      drafts: {
        '1-2': [
          { kind: 'left', angle: 90 },
          { kind: 'forward', value: 100 },
          { kind: 'forward', value: 60 },
        ],
        '1-12': [{ kind: 'repeat', times: 4, body: [] }],
      },
    });
  });

  test('změna pořadí bloků splní úlohu', async ({ page }) => {
    await page.goto('/uloha/1-2');
    await expect.poll(() => python(page)).toContain('left(90)\nforward(100)\nforward(60)');

    await drag(
      page,
      page.getByRole('button', { name: 'dopředu, vložit za' }).first(),
      page.locator('#blocks-root > li').first(),
    );
    await expect.poll(() => python(page)).toContain('forward(100)\nleft(90)\nforward(60)');

    await runInstantly(page);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('tažení bloku o jedno místo dolů', async ({ page }) => {
    await page.goto('/uloha/1-2');
    await drag(
      page,
      page.getByRole('button', { name: 'vlevo, vložit za' }),
      page.locator('#blocks-root > li').nth(1),
      true,
    );
    await expect.poll(() => python(page)).toContain('forward(100)\nleft(90)\nforward(60)');
  });

  test('blok jde vytáhnout z opakuj ven', async ({ page }) => {
    await page.goto('/uloha/1-12');
    const palette = page.getByRole('group', { name: 'Paleta bloků' });
    // Výběr opakuj a vložení dovnitř klikem
    await page.getByRole('button', { name: 'opakuj, vložit dovnitř' }).click();
    await palette.getByRole('button', { name: 'dopředu' }).click();
    await expect.poll(() => python(page)).toContain('for i in range(4):\n    forward(100)');

    await drag(
      page,
      page.getByRole('button', { name: 'dopředu, vložit za' }),
      page.locator('#blocks-root'),
      true,
    );
    await expect.poll(() => python(page)).toContain('for i in range(4):\n    pass\nforward(100)');
  });
});

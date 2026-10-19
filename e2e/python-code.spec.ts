import { Page, expect, test } from '@playwright/test';
import { runInstantly, seedProgress, worldOneUpTo } from './helpers';

const worldTwoUpTo = (last: number) => Array.from({ length: last }, (_, i) => `2-${i + 1}`);

/** Přepne na kód, počká na Python a nahradí obsah editoru. */
async function writeCode(page: Page, code: string): Promise<void> {
  await page.getByRole('button', { name: /Kód v Pythonu/ }).click();
  const editor = page.getByRole('textbox', { name: 'Python kód' });
  await expect(editor).toContainText('from turtle import *');
  await expect(page.getByText('Načítá se Python')).toBeHidden({ timeout: 60_000 });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(code);
}

test.describe('Psaní kódu v Pythonu', () => {
  // Pyodide se v každém testu načítá znovu
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await seedProgress(page, { solved: [...worldOneUpTo(12), ...worldTwoUpTo(7)] });
    await page.goto('/uloha/2-8');
  });

  test('úloha splněná v kódu dá dvojnásobek XP', async ({ page }) => {
    await writeCode(
      page,
      [
        'import turtle',
        'turtle.penup()',
        'turtle.goto(-60, -52)',
        'turtle.pendown()',
        "turtle.fillcolor('#E8632B')",
        'turtle.begin_fill()',
        'for i in range(3):',
        '    turtle.forward(120)',
        '    turtle.left(120)',
        'turtle.end_fill()',
        "print('hotovo')",
      ].join('\n'),
    );
    await runInstantly(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText('Napsáno v Pythonu')).toBeVisible();
    // Tvar + struktura + 100 % = 50 XP, v kódu ×2
    await expect(dialog.getByText('Získáno +100 XP.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Zkusit znovu' }).click();
    await expect(page.locator('.code-output')).toHaveText('hotovo');
  });

  test('chyba v kódu ukáže typ a řádek', async ({ page }) => {
    await writeCode(page, 'from turtle import *\nforward(50)\nleft("x")\n');
    await page.getByRole('button', { name: 'Spustit' }).click();
    await expect(page.getByRole('alert')).toContainText('TypeError na řádku 3');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('nekonečná smyčka se po limitu ukončí', async ({ page }) => {
    await writeCode(page, 'while True:\n    pass\n');
    await page.getByRole('button', { name: 'Spustit' }).click();
    await expect(page.getByRole('alert')).toContainText('nekonečná smyčka', { timeout: 15_000 });
  });
});

test('kód beze změny převzatý z bloků se jako psaný kód nepočítá', async ({ page }) => {
  test.setTimeout(90_000);
  await seedProgress(page, {
    solved: [...worldOneUpTo(12), ...worldTwoUpTo(7)],
    drafts: {
      '2-8': [
        {
          kind: 'fill',
          color: '#E8632B',
          body: [
            {
              kind: 'repeat',
              times: 3,
              body: [
                { kind: 'forward', value: 120 },
                { kind: 'left', angle: 120 },
              ],
            },
          ],
        },
      ],
    },
  });
  await page.goto('/uloha/2-8');
  await page.getByRole('button', { name: /Kód v Pythonu/ }).click();
  await expect(page.getByRole('textbox', { name: 'Python kód' })).toContainText('begin_fill()');
  await expect(page.getByText('Načítá se Python')).toBeHidden({ timeout: 60_000 });
  await runInstantly(page);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByText('Napsáno v Pythonu')).toHaveCount(0);
  await expect(dialog.getByText('Získáno +70 XP.')).toBeVisible();
});

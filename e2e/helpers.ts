import { Page, expect } from '@playwright/test';

const STORAGE_KEY = 'python-quest.progress.v1';

interface Seed {
  solved?: string[];
  drafts?: Record<string, unknown[]>;
}

/** Uložený postup před prvním načtením stránky (jen jednou, reload ho nepřepíše). */
export async function seedProgress(page: Page, seed: Seed): Promise<void> {
  const record = { stars: [true, true, true], bestMatch: 100, perfect: true, hintsUsed: 0, firstTry: true };
  const state = {
    records: Object.fromEntries((seed.solved ?? []).map((id) => [id, record])),
    streak: { days: 0, lastDay: null, best: 0 },
    drafts: seed.drafts ?? {},
  };
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-seeded', '1');
      }
    },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
}

export function worldOneUpTo(last: number): string[] {
  return Array.from({ length: last }, (_, i) => `1-${i + 1}`);
}

/** Rychlost na maximum, aby se program vyhodnotil hned. */
export async function runInstantly(page: Page): Promise<void> {
  await page.getByLabel('Rychlost').fill('10');
  await page.getByRole('button', { name: 'Spustit' }).click();
}

export async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('app-turtle-canvas canvas')).toBeVisible();
}

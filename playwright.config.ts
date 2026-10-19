import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4318';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  snapshotPathTemplate: 'e2e/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    locale: 'cs-CZ',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      // Tažení myší se testuje jen na desktopu
      testIgnore: /drag\.spec/,
    },
  ],
  webServer: {
    command: 'npx ng serve --port 4318 --configuration development',
    url: BASE_URL,
    // Nikdy nepřebírat cizí server na portu
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

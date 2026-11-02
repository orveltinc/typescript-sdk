import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './support/prepare-package.ts',
  outputDir: './results/playwright',
  reporter: [
    ['list'],
    ['html', { outputFolder: fileURLToPath(new URL('./report', import.meta.url)), open: 'never' }],
  ],
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  webServer: {
    command: 'bun test/support/serve-package.ts',
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    url: 'http://127.0.0.1:54810/health',
    reuseExistingServer: false,
  },
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});

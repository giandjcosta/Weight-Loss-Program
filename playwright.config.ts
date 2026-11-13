import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4173/Weight-Loss-Program/', trace: 'off' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Weight-Loss-Program/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'], browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});

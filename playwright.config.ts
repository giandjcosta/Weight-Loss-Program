import { defineConfig, devices } from '@playwright/test';

const PREVIEW = 'http://localhost:4173/Weight-Loss-Program/';
const DEV = 'http://localhost:5174/Weight-Loss-Program/';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { trace: 'off' },
  webServer: [
    {
      // production build: what users get
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: PREVIEW,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // dev server: serves test-only harness pages (tests/e2e/harness), never built
      command: 'npx vite --port 5174 --strictPort',
      url: DEV,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'iphone',
      testIgnore: /storage\.spec/,
      use: { ...devices['iPhone 15'], browserName: 'chromium', baseURL: PREVIEW },
    },
    {
      name: 'desktop',
      testIgnore: /storage\.spec/,
      use: { viewport: { width: 1440, height: 900 }, baseURL: PREVIEW },
    },
    { name: 'storage', testMatch: /storage\.spec/, use: { baseURL: DEV } },
  ],
});

import { defineConfig, devices } from '@playwright/test';

// Port is overridable via the PORT env var so that parallel worktrees / sessions
// don't collide on one hard-coded port. Without this, two sessions both target
// 5174: one reuses the other's dev server (serving the wrong worktree to its
// scans) and tears it down on teardown. Default 5174 keeps existing flows
// unchanged; a session runs isolated with e.g. `PORT=5178 bunx playwright test`.
const PORT = Number(process.env.PORT ?? 5174);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  snapshotDir: './e2e/snapshots',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled'
    }
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    actionTimeout: 15_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: `cd apps/docs && bun run dev -- --port ${PORT}`,
    url: BASE_URL,
    // Reuse an already-running dev server locally (fast iteration), but never in
    // CI: there a pre-existing listener on the port is a conflict to surface, not
    // a foreign server to silently adopt.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});

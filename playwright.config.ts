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
      // Tightened from 0.01: that ratio swallowed a full label colour inversion
      // (the text-on-primary bug) and a whole added Badge sentinel — both under
      // 1% of their shot — so a colour-only regression passed unnoticed. 0.002
      // catches element-level regressions and a stricter per-pixel threshold
      // catches clearer colour shifts, while tolerating font antialiasing. This
      // is safe because the fixtures are deterministic (the primitives fixture
      // sets `transition: none`, killing the mount-frame that made circular
      // Progress non-deterministic). Re-baseline deliberately with
      // `--update-snapshots=all` — the default 'changed' mode skips sub-threshold
      // drift and silently keeps a stale baseline (how the 8 stale shots survived).
      maxDiffPixelRatio: 0.002,
      threshold: 0.15,
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
      // `channel: 'chromium'` pins the FULL Chromium build. Without it Playwright
      // runs `headless_shell`, which renders fonts ~1px differently — enough to
      // flip every text-heavy snapshot. The visual baselines are produced from
      // the full build, so leaving the renderer implicit meant a plain local run
      // disagreed with the committed baselines by a constant ~1% of pixels (how
      // 13 shots in floating/guide.spec sat red at exactly the old 0.01 ratio).
      // Both builds ship with `playwright install chromium`; pinning costs
      // nothing and makes the renderer the same everywhere.
      use: { ...devices['Desktop Chrome'], channel: 'chromium' }
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

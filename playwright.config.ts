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
  // Parallel across files AND within them. The dominant cost is `a11y.spec.ts`,
  // whose 37 route scans live in a single `for` loop — with `fullyParallel:
  // false` they run one after another no matter how many workers exist, which is
  // why the suite sat at ~5 min while 15 cores idled.
  //
  // Browser-level state is per worker (own context, own storage/cookies) and the
  // Vite dev server handles concurrent requests fine. The one suite that drives
  // shared *server* state is `auth.spec.ts`, which resets an in-memory world on
  // the dev server; it pins `mode: 'serial'` itself rather than being protected
  // by a low worker count here. Screenshots are load-independent
  // (`animations: 'disabled'` + deterministic fixtures).
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Relative, so a 4-core box gets 2 and a 16-core one 8. Measured on 16 cores
  // (12 P + 4 E), full suite: 1 worker 310s · 4 → 98s · 8 → 66-73s · 12 → 69s ·
  // 16 → 69-73s. It saturates around half the cores — beyond that the extra
  // workers only compete for the single dev server.
  //
  // Do NOT raise this for CI. Tried on a GitHub runner (4 vCPU) on 2026-08-01,
  // reasoning that these tests wait on the dev server rather than on CPU and
  // that the saturation point above is an absolute ceiling: '100%' gave 4
  // workers, and the suite went from 6m51s / 120 passed to 8m0s with 4 failed
  // and 2 flaky — `frame.evaluate` and `waitForSelector` timeouts, i.e. the
  // dev server starving. Slower AND less reliable; the relative setting is
  // right, and on a 4-vCPU runner 2 workers is what it should buy.
  workers: '50%',
  // `blob` is the only format `merge-reports` can recombine, and CI sets
  // PLAYWRIGHT_BLOB_REPORT in the sharded e2e job for exactly that. Elsewhere
  // in CI (the release gate, which runs unsharded) `github` puts failures
  // inline in the run summary; an HTML report nobody uploads is dead weight
  // there. Locally, unchanged: the browsable HTML report.
  reporter: process.env.PLAYWRIGHT_BLOB_REPORT ? 'blob' : process.env.CI ? 'github' : 'html',
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
      // picks `headless_shell`, whose font rendering differs by ~1px — enough to
      // move a text-heavy snapshot on its own.
      //
      // This is a reproducibility pin, NOT a fix for any particular red shot: the
      // 13 failures that prompted it reproduced identically under both renderers
      // (their baselines were simply months stale). Leaving the renderer implicit
      // is still wrong — which build you get depends on how the run is invoked,
      // so baselines and runs could silently disagree. Both builds ship with
      // `playwright install chromium`, so pinning costs nothing.
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

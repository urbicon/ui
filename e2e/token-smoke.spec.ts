import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { parseDeclarations } from '../apps/docs/src/lib/css-declarations';

/**
 * Structural token smoke test. The VR suite compares pixels against committed baselines
 * and tolerates token-level total failures (a baseline captured with broken tokens keeps
 * passing). This spec instead asserts that var()-consuming token families RESOLVE to
 * real computed values: box-shadow (f7a9093 — light-dark() is color-only, shadows
 * defined through it computed to 'none' everywhere), transition-duration (an unresolved
 * var() collapses to 0s), and the tier border-radius scale. DOM/computed-style only —
 * portable to Linux CI.
 *
 * It also sweeps the `--color-*` namespace for values that are not colours (#368) —
 * see the test's own comment for why that question needs a browser.
 */

const FIXTURE_URL = '/test-fixtures/dialog';

async function setupPage(page: Page) {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });

  await page.goto(FIXTURE_URL, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="token-probe"]', { timeout: 30_000 });
}

const style = (locator: ReturnType<Page['locator']>, prop: string) =>
  locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `.css` under a package's `src`, walked rather than listed: a stylesheet
 *  that grows a `--color-*` key has to be swept even when nobody remembered to
 *  add its directory here. Four packages ship a stylesheet today, and three of
 *  those files carry no `--color-*` at all — which is exactly the shape a listed
 *  set gets wrong, because it looks complete right up until one of them gains a
 *  key. `src` rather than `dist` so the test needs no build; a file that is not
 *  shipped costs one extra check. */
function shippedStylesheets(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.css')) out.push(path);
    }
  };
  for (const pkg of readdirSync(resolve(REPO, 'packages'), { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = resolve(REPO, 'packages', pkg.name, 'src');
    if (existsSync(src)) walk(src);
  }
  return out;
}

/** Every `--color-*` declaration in the stylesheets the library ships, at any
 *  depth — an `@media` override is as much a shipped value as a base one.
 *  Parsed with the docs app's parser rather than a second one: it strips
 *  comments first, so prose naming a token is not read as a declaration. */
function shippedColorDeclarations(): { name: string; value: string; file: string }[] {
  const out: { name: string; value: string; file: string }[] = [];
  for (const path of shippedStylesheets()) {
    const css = readFileSync(path, 'utf8');
    for (const decl of parseDeclarations(css)) {
      if (decl.name.startsWith('--color-')) {
        out.push({ name: decl.name, value: decl.value, file: relative(REPO, path) });
      }
    }
  }
  return out;
}

test.describe('Token smoke', () => {
  test('shadow, motion, and radius token families resolve on static consumers', async ({
    page
  }) => {
    await setupPage(page);

    const card = page.getByTestId('probe-card');
    const button = page.getByTestId('probe-button');

    // Shadow family: --blocks-shadow-tint → --blocks-shadow-scale-md → --blocks-shadow-md.
    // A broken chain computes to 'none' (exactly the f7a9093 total failure).
    const boxShadow = await style(card, 'box-shadow');
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).not.toBe('');

    // Motion family: duration-[var(--blocks-duration-fast)] — if the token is gone the
    // computed transition-duration falls back to 0s on every entry.
    for (const target of [card, button]) {
      const durations = (await style(target, 'transition-duration'))
        .split(',')
        .map((d) => Number.parseFloat(d));
      expect(Math.max(...durations)).toBeGreaterThan(0);
    }

    // Tier radius family: Card sits on the contain tier (small but non-zero), Button on
    // the commit tier (pill). Unresolved var() → 0px.
    expect(Number.parseFloat(await style(card, 'border-radius'))).toBeGreaterThan(0);
    expect(Number.parseFloat(await style(button, 'border-radius'))).toBeGreaterThan(0);
  });

  /**
   * The general class behind #368: a key in the `--color-*` namespace whose
   * value is not a colour. Tailwind mints a utility per colour family from
   * every key in there, so such a key becomes a `bg-`, `text-` and `ring-`
   * spelling that writes an invalid `color` — and on an inherited property
   * invalid-at-computed-value-time means `inherit`, not "ignored".
   *
   * Asked of the browser's own CSS parser (`CSS.supports`), never of a colour
   * matcher of ours: a hand-written one would be a second model of what CSS
   * accepts, and `oklch(from … )`, `color-mix()` and `light-dark()` are exactly
   * where such a model goes wrong. `variants:lint` cannot cover this — it only
   * reports a key whose name happens to collide with a Tailwind size family,
   * which is how the shadow scale was found and why nothing else was.
   *
   * The population is what the library DECLARES, read off the shipped
   * stylesheets, not what this page happens to compute. Tailwind emits a
   * `@theme` key only where something reads it, so asking the rendered `:root`
   * would silently skip every key the docs app does not use — and a key that
   * exists precisely to mint utilities for a consumer is the normal case of
   * this namespace. The computed values are checked too, on top: for the keys
   * the page does emit, that is the fully substituted value, which catches a
   * chain this file's text cannot resolve.
   *
   * Two things make a local run green for the wrong reason, neither of which
   * bites in CI: `apps/docs` imports `@urbicon-ui/blocks/style/index.css`,
   * which resolves to `dist` — an edit under `src` reaches the page only after
   * a build, and the `e2e` job runs `bun run build` first. And
   * `reuseExistingServer: !process.env.CI` will adopt a dev server someone else
   * left running. Rebuild and check the port before trusting a green sabotage.
   */
  test('every --color-* key the library declares holds a colour', async ({ page }) => {
    await setupPage(page);

    const declared = shippedColorDeclarations();
    // A sweep that swept nothing passes for the wrong reason — blocks alone
    // declares ~200 of these, and the table theme adds its own ramps.
    expect(declared.length).toBeGreaterThan(100);

    const offenders = await page.evaluate(
      (rows: { name: string; value: string; file: string }[]) => {
        const computed = getComputedStyle(document.documentElement);
        const bad: { name: string; value: string; where: string }[] = [];
        for (const row of rows) {
          if (!CSS.supports('color', row.value)) {
            bad.push({ name: row.name, value: row.value, where: row.file });
          }
          const substituted = computed.getPropertyValue(row.name).trim();
          if (substituted !== '' && !CSS.supports('color', substituted)) {
            bad.push({ name: row.name, value: substituted, where: 'computed at :root' });
          }
        }
        return bad;
      },
      declared
    );

    expect(
      offenders,
      `--color-* keys whose value the browser does not accept as a colour:\n${offenders
        .map((o) => `  ${o.name}: ${o.value}   (${o.where})`)
        .join('\n')}`
    ).toEqual([]);
  });

  test('overlay surface consumes a resolved shadow token in the top layer', async ({ page }) => {
    await setupPage(page);

    // The Dialog panel carries shadow-[var(--blocks-shadow-lg)] — assert the overlay
    // branch of the family too, on a live top-layer element.
    await page.getByTestId('dialog-trigger').click();
    const dialog = page.getByTestId('dialog-el');
    await expect(dialog).toBeVisible();

    const panel = dialog.locator('[role="document"]');
    const boxShadow = await style(panel, 'box-shadow');
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).not.toBe('');
    expect(Number.parseFloat(await style(panel, 'border-radius'))).toBeGreaterThan(0);
  });
});

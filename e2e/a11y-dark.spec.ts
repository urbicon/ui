import { expect, test } from '@playwright/test';
import { createGate, describeViolation, loadExceptions, scan } from './axe-harness';

/**
 * Dark-mode a11y gate — the axis `a11y.spec.ts` (light-only) never covered.
 *
 * Scans the LIBRARY fixture (`/test-fixtures/primitives` with the docs Rooms
 * skin REMOVED), NOT the docs site: scanning the site would measure the skin's
 * token overrides, not the library tokens (`get_css_reference`-level truth). The
 * worst contrast regression in the system's history — `text-on-primary`, 125
 * dark-mode combinations bottoming out at 1.51:1 — was invisible to the
 * light-only gate by construction. `style/contrast.test.ts` guards the token
 * math statically; this guards the rendered dark page, so a skin/markup change
 * that only bites in dark mode still turns the suite red.
 *
 * The ratchet + baseline mechanics are shared with the light spec via
 * `axe-harness.ts`; exceptions live in `a11y-dark-baseline.json`.
 */

const PRIMITIVES = [
  'button',
  'input',
  'checkbox',
  'toggle',
  'badge',
  'alert',
  'card',
  'avatar',
  'progress',
  'select',
  'radio-group',
  'pin-input',
  'time-input'
] as const;

const EXCEPTIONS = loadExceptions(new URL('./a11y-dark-baseline.json', import.meta.url));
const gate = createGate(EXCEPTIONS);

test.describe('Primitives — dark-mode WCAG 2.1 AA axe scan (library fixture)', () => {
  test('dark · library', async ({ page }) => {
    // Emulate dark BEFORE navigation so the first paint already resolves the
    // dark branch of every light-dark() token.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/test-fixtures/primitives', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="primitives-fixtures"]');

    // The docs app.html ships `<html class="docs-rooms">` as its default skin;
    // remove it so axe measures the LIBRARY tokens, not the Rooms overrides.
    await page.evaluate(() => document.documentElement.classList.remove('docs-rooms'));
    await page.waitForTimeout(200); // settle the token re-resolution

    const failures: string[] = [];
    for (const name of PRIMITIVES) {
      const results = await scan(page, `[data-testid="vr-${name}"]`);
      for (const violation of results.violations) {
        const nodes = gate.unmatchedNodes(violation, 'dark', name);
        if (nodes.length > 0) {
          failures.push(`  [${name}] ${describeViolation(violation, nodes).trimStart()}`);
        }
      }
    }

    const stale = gate.staleIds();
    if (stale.length > 0 && gate.usedCount() > 0) {
      console.warn(
        `\n[a11y-dark-baseline] ${stale.length} exception(s) matched no violation:\n` +
          stale.map((id) => `  - ${id}`).join('\n')
      );
    }

    if (failures.length > 0) {
      throw new Error(
        `dark-mode axe reported ${failures.length} violation(s) on the library fixture that ` +
          `e2e/a11y-dark-baseline.json does not account for:\n${failures.join('\n')}\n\n` +
          `Fix the markup/token, or add a node-narrow exception with a reason and a ref.`
      );
    }
    expect(failures).toEqual([]);
  });
});

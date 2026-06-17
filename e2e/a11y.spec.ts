import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Accessibility harness for every primitive doc page.
 *
 * Each route is scanned with axe-core (WCAG 2.1 AA). The allow-list in
 * `e2e/a11y-baseline.json` captures the *known* violations so the suite
 * fails fast on new regressions without blocking on pre-existing findings.
 * When a row gets fixed, its entry has to be deleted from the baseline —
 * otherwise the suite keeps reminding us and eventually breaks when the
 * violation no longer surfaces.
 */

const PRIMITIVES = [
  'accordion',
  'alert',
  'avatar',
  'badge',
  'breadcrumb',
  'button',
  'button-group',
  'card',
  'checkbox',
  'collapsible',
  'combobox',
  'dialog',
  'drawer',
  'dropdown',
  'input',
  'pagination',
  'popover',
  'progress',
  'radio-group',
  'segment-group',
  'select',
  'separator',
  'sidebar',
  'skeleton',
  'slider',
  'spinner',
  'stepper',
  'tab',
  'textarea',
  'toast',
  'toggle',
  'toolbar',
  'tooltip'
] as const;

type Baseline = Record<string, string[]>;

let baseline: Baseline = {};
try {
  baseline = JSON.parse(readFileSync(new URL('./a11y-baseline.json', import.meta.url), 'utf8'));
} catch {
  baseline = {};
}

test.describe('Primitives — WCAG 2.1 AA axe scan', () => {
  for (const slug of PRIMITIVES) {
    test(`/blocks/primitives/${slug}`, async ({ page }) => {
      await page.goto(`/blocks/primitives/${slug}`, { waitUntil: 'networkidle' });

      // Ensure at least one CodeExample preview is present — otherwise
      // axe has nothing to scan and the test is a silent pass.
      await page.waitForSelector('[data-docs-preview]');

      const results = await new AxeBuilder({ page })
        // Scope the scan to the CodeExample preview regions so we only
        // audit what a *consumer* of the primitive renders, not the
        // surrounding PlaygroundConfigurator / ApiReference / navigation
        // UI (those have their own tickets).
        .include('[data-docs-preview]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const allowed = new Set(baseline[slug] ?? []);
      const newViolations = results.violations.filter((v) => !allowed.has(v.id));

      if (newViolations.length > 0) {
        const summary = newViolations
          .map(
            (v) =>
              `  - ${v.id} (${v.impact ?? 'n/a'}): ${v.description}\n    nodes: ${v.nodes.length}`
          )
          .join('\n');
        throw new Error(
          `axe reported ${newViolations.length} new violation(s) on /${slug} that are not in e2e/a11y-baseline.json:\n${summary}`
        );
      }

      // Informational: if a baselined rule no longer triggers, remind to clean
      // the baseline entry up.
      const stale = (baseline[slug] ?? []).filter(
        (id) => !results.violations.some((v) => v.id === id)
      );
      if (stale.length > 0) {
        test.info().annotations.push({
          type: 'a11y-baseline-stale',
          description: `Baseline for /${slug} contains rules that no longer violate: ${stale.join(', ')} — remove them from e2e/a11y-baseline.json.`
        });
      }

      expect(newViolations).toEqual([]);
    });
  }
});

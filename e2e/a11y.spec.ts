import { expect, test } from '@playwright/test';
import { createGate, describeViolation, loadExceptions, scan } from './axe-harness';

/**
 * Accessibility harness for every primitive doc page (light mode).
 *
 * Each route is scanned three times with axe-core (WCAG 2.1 AA):
 *
 *   1. `preview`    — the `[data-docs-preview]` regions, i.e. what a *consumer*
 *      of the primitive renders.
 *   2. `code`       — the CodeExample's own chrome: the read-only code textbox,
 *      the Shiki syntax tokens and the copy/expand toolbar. These sit OUTSIDE
 *      `[data-docs-preview]`, scoped to `[data-docs-stage="example"]` minus it.
 *   3. `playground` — the PlaygroundConfigurator's live specimen
 *      (`[data-docs-stage="playground"]`), previously ungated. Only the pages
 *      that have a playground stage run this pass.
 *
 * `e2e/a11y-baseline.json` holds narrowly-scoped, node-level exceptions for the
 * known failures — see the `$comment` block in that file. The dark-mode surface
 * is covered separately by `a11y-dark.spec.ts` (a library-only fixture, since
 * scanning the docs site measures its Rooms skin, not the library tokens).
 *
 * The ratchet logic lives in `axe-harness.ts`, shared with the dark spec.
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
  'confirm-dialog',
  'dialog',
  'drawer',
  'form-field',
  'input',
  'journey-timeline',
  'menu',
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
  'split-pane',
  'stepper',
  'tab',
  'textarea',
  'toast',
  'toggle',
  'toolbar',
  'tooltip'
] as const;

const EXCEPTIONS = loadExceptions(new URL('./a11y-baseline.json', import.meta.url));
const gate = createGate(EXCEPTIONS);

test.describe('Primitives — WCAG 2.1 AA axe scan', () => {
  for (const slug of PRIMITIVES) {
    test(`/blocks/primitives/${slug}`, async ({ page }) => {
      await page.goto(`/blocks/primitives/${slug}`, { waitUntil: 'networkidle' });

      // Both scopes must actually exist — otherwise axe has nothing to scan and
      // the test is a silent pass. `.shiki` additionally proves the async
      // highlighter resolved, so the `code` pass sees real syntax tokens.
      await page.waitForSelector('[data-docs-preview]');
      await page.waitForSelector('[data-docs-stage="example"] .shiki');

      const failures: string[] = [];

      const passes: [string, string, string?][] = [
        ['preview', '[data-docs-preview]'],
        ['code', '[data-docs-stage="example"]', '[data-docs-preview]']
      ];

      // Playground stage is optional — only the pages whose docs mount a
      // PlaygroundConfigurator have it. Gate it when present (previously never
      // scanned, so unlabelled playground inputs slipped through on ~36 pages).
      if ((await page.locator('[data-docs-stage="playground"]').count()) > 0) {
        passes.push(['playground', '[data-docs-stage="playground"]']);
      }

      for (const [pass, include, exclude] of passes) {
        const results = await scan(page, include, exclude);
        for (const violation of results.violations) {
          const nodes = gate.unmatchedNodes(violation, pass, slug);
          if (nodes.length > 0) {
            failures.push(`  [${pass} pass] ${describeViolation(violation, nodes).trimStart()}`);
          }
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `axe reported ${failures.length} violation(s) on /${slug} that e2e/a11y-baseline.json does not account for:\n${failures.join('\n')}\n\n` +
            `Fix the markup, or — if the finding is a deliberate deferral — add a node-narrow exception to e2e/a11y-baseline.json with a reason and a ref.`
        );
      }

      expect(failures).toEqual([]);
    });
  }

  test.afterAll(() => {
    // Informational: an exception that matched nothing is either fixed (delete
    // it) or mis-scoped. Only meaningful after a full run, so skip when filtered.
    const stale = gate.staleIds();
    if (stale.length > 0 && gate.usedCount() > 0) {
      console.warn(
        `\n[a11y-baseline] ${stale.length} exception(s) matched no violation in this run:\n` +
          stale.map((id) => `  - ${id}`).join('\n') +
          `\nIf the underlying issue is fixed, delete the entry from e2e/a11y-baseline.json.\n`
      );
    }
  });
});

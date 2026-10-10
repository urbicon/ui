import { expect, test } from '@playwright/test';
import { createGate, describeViolation, loadExceptions, scanScopes } from './axe-harness';
import { blocksDocRoutes } from './helpers/docs-routes';

/**
 * Accessibility harness for every primitive and component doc page under
 * `/blocks` (light mode). The routes come from the route tree
 * (`helpers/docs-routes.ts`), so a new page is scanned without being listed.
 *
 * Each route is checked in three passes with axe-core (WCAG 2.1 AA):
 *
 *   1. `preview`    — the `[data-docs-preview]` regions, i.e. what a *consumer*
 *      of the component renders.
 *   2. `code`       — the CodeExample's own chrome: the read-only code textbox,
 *      the Shiki syntax tokens and the copy/expand toolbar. These sit OUTSIDE
 *      `[data-docs-preview]`, inside `[data-docs-stage="example"]`.
 *   3. `playground` — the PlaygroundConfigurator's live specimen
 *      (`[data-docs-stage="playground"]`).
 *
 * The three passes share one axe run; `scanScopes` attributes every node to the
 * first scope below that contains it, which is what keeps the previews out of
 * the `code` pass.
 *
 * A page without one of the three stages fails, unless ABSENT_STAGES below says
 * why it has none — so a page that loses its previews is a red test, not a pass
 * that quietly scans less.
 *
 * `e2e/a11y-baseline.json` holds narrowly-scoped, node-level exceptions for the
 * known failures — see the `$comment` block in that file. An exception that
 * matches nothing on a route it names fails that route's test. The dark-mode
 * surface is covered separately by `a11y-dark.spec.ts` (a library-only fixture,
 * since scanning the docs site measures its Rooms skin, not the library tokens).
 */

const ROUTES = blocksDocRoutes();

type Pass = 'preview' | 'code' | 'playground';

const PASSES: ReadonlyArray<{
  pass: Pass;
  scope: string;
  /** What must exist for the pass to have something to scan. */
  present: string;
}> = [
  { pass: 'preview', scope: '[data-docs-preview]', present: '[data-docs-preview]' },
  {
    pass: 'code',
    scope: '[data-docs-stage="example"]',
    // `.shiki` rather than the stage: it proves the code panel rendered its
    // tokens, so the pass measures real syntax colours.
    present: '[data-docs-stage="example"] .shiki'
  },
  {
    pass: 'playground',
    scope: '[data-docs-stage="playground"]',
    present: '[data-docs-stage="playground"]'
  }
];

/**
 * Stages a page deliberately does not have, each with the reason. A listed
 * stage that the page does render fails as stale, like an unused baseline entry.
 */
const ABSENT_STAGES: ReadonlyArray<readonly [route: string, pass: Pass, why: string]> = [
  [
    '/blocks/components/chat',
    'preview',
    'every example is code-only (preview={false}); the live shell is /ai/chat, linked from the page'
  ],
  [
    '/blocks/components/chat-message-list',
    'preview',
    'every example is code-only (preview={false}); the live list is /ai/chat, linked from the page'
  ],
  [
    '/blocks/components/sidebar-layout',
    'preview',
    'every example is code-only (preview={false}); the page sends readers to the Dashboard ' +
      'recipe for a live app shell'
  ]
];

for (const [route, pass] of ABSENT_STAGES) {
  if (!ROUTES.includes(route)) {
    throw new Error(`ABSENT_STAGES names ${route} (${pass}), which is not a scanned route.`);
  }
}

const EXCEPTIONS = loadExceptions(new URL('./a11y-baseline.json', import.meta.url), ROUTES);

test.describe('Blocks doc pages — WCAG 2.1 AA axe scan', () => {
  for (const route of ROUTES) {
    test(route, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' });

      // Every doc page renders DocsLayout's header. Waiting on it, not on a
      // stage, means a page that lacks a stage fails below with a reason
      // instead of timing out here.
      await page.waitForSelector('[data-docs-header]');

      const failures: string[] = [];
      const scanned: (typeof PASSES)[number][] = [];

      for (const entry of PASSES) {
        const { pass, present } = entry;
        const absent = ABSENT_STAGES.some(([r, p]) => r === route && p === pass);
        const rendered = (await page.locator(present).count()) > 0;

        if (absent && rendered) {
          failures.push(
            `  [${pass} pass] ${route} renders ${present} now — delete its ABSENT_STAGES entry.`
          );
        } else if (!absent && !rendered) {
          failures.push(
            `  [${pass} pass] ${route} renders no ${present}, so this pass would scan nothing. ` +
              `Restore the stage, or add an ABSENT_STAGES entry with the reason.`
          );
        } else if (rendered) {
          scanned.push(entry);
        }
      }

      const gate = createGate(EXCEPTIONS);
      const results = await scanScopes(
        page,
        scanned.map(({ pass, scope }) => ({ name: pass, selector: scope }))
      );
      for (const [pass, violations] of results) {
        for (const violation of violations) {
          const nodes = gate.unmatchedNodes(violation, pass, route);
          if (nodes.length > 0) {
            failures.push(`  [${pass} pass] ${describeViolation(violation, nodes).trimStart()}`);
          }
        }
      }

      for (const stale of gate.staleFor([route])) {
        failures.push(
          `  [baseline] ${stale} matched no violation — delete the entry, or drop this route from it.`
        );
      }

      if (failures.length > 0) {
        throw new Error(
          `${failures.length} finding(s) on ${route}:\n${failures.join('\n')}\n\n` +
            `For an axe violation: fix the markup, or — if the finding is a deliberate deferral — ` +
            `add a node-narrow exception to e2e/a11y-baseline.json with a reason and a ref.`
        );
      }

      expect(failures).toEqual([]);
    });
  }
});

import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Result as AxeResult, NodeResult } from 'axe-core';

/**
 * Accessibility harness for every primitive doc page.
 *
 * Each route is scanned twice with axe-core (WCAG 2.1 AA):
 *
 *   1. `preview` — the `[data-docs-preview]` regions, i.e. what a *consumer*
 *      of the primitive renders.
 *   2. `code`    — the CodeExample's own chrome: the read-only code textbox,
 *      the Shiki syntax tokens and the copy/expand toolbar. These sit OUTSIDE
 *      `[data-docs-preview]`, so the original single-pass harness never
 *      scanned them — which is why the CodePanel `aria-input-field-name` +
 *      comment-contrast failures (572b738) went uncaught.
 *
 * The `code` pass is scoped to `[data-docs-stage="example"]` minus the preview
 * subtree. That covers the CodePanel component itself (shared with the
 * PlaygroundConfigurator, so a CodePanel regression is caught either way)
 * without reaching into `[data-docs-stage="playground"]`, whose configurator
 * chrome is a separate surface with its own findings.
 *
 * `e2e/a11y-baseline.json` holds narrowly-scoped, node-level exceptions for
 * the known failures — see the `$comment` block in that file. A violation is
 * only suppressed when every one of its nodes matches an exception, so new
 * regressions still turn the suite red.
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

type PassName = 'preview' | 'code';

type Exception = {
  id: string;
  pass: PassName;
  rule: string;
  routes: string[] | '*';
  contrast?: { fg: string; bg: string };
  htmlIncludes?: string[];
  reason: string;
  ref: string;
};

/**
 * Load + validate the baseline. Deliberately fails loud: a malformed baseline
 * must not silently degrade into "no exceptions" (vacuously red) or, worse,
 * "everything allowed".
 */
function loadExceptions(): Exception[] {
  const url = new URL('./a11y-baseline.json', import.meta.url);
  const raw = JSON.parse(readFileSync(url, 'utf8')) as { exceptions?: Exception[] };
  const list = raw.exceptions ?? [];

  list.forEach((e, i) => {
    const where = `e2e/a11y-baseline.json exceptions[${i}]${e.id ? ` (${e.id})` : ''}`;
    if (!e.id || !e.pass || !e.rule || !e.routes) {
      throw new Error(`${where}: needs id, pass, rule and routes.`);
    }
    if (!e.reason || !e.ref) {
      throw new Error(
        `${where}: needs a reason and a ref — an undocumented deferral is not allowed.`
      );
    }
    // The important guard: no predicate would mute the whole rule on the route.
    if (!e.contrast && !e.htmlIncludes?.length) {
      throw new Error(
        `${where}: needs a node predicate (contrast or htmlIncludes). ` +
          `Blanket rule suppression is not allowed — keep exceptions node-narrow.`
      );
    }
  });

  return list;
}

const EXCEPTIONS = loadExceptions();
const usedExceptionIds = new Set<string>();

const CONTRAST_RE = /foreground color: (#[0-9a-f]{6}), background color: (#[0-9a-f]{6})/i;

function matches(exc: Exception, pass: PassName, slug: string, rule: string, node: NodeResult) {
  if (exc.pass !== pass || exc.rule !== rule) return false;
  if (exc.routes !== '*' && !exc.routes.includes(slug)) return false;

  if (exc.contrast) {
    const m = CONTRAST_RE.exec(node.failureSummary ?? '');
    if (!m) return false;
    if (m[1].toLowerCase() !== exc.contrast.fg.toLowerCase()) return false;
    if (m[2].toLowerCase() !== exc.contrast.bg.toLowerCase()) return false;
  }

  if (exc.htmlIncludes && !exc.htmlIncludes.every((s) => node.html.includes(s))) return false;

  return true;
}

/** Returns the nodes that no exception accounts for. */
function unmatchedNodes(violation: AxeResult, pass: PassName, slug: string) {
  return violation.nodes.filter((node) => {
    const hit = EXCEPTIONS.find((exc) => matches(exc, pass, slug, violation.id, node));
    if (hit) usedExceptionIds.add(hit.id);
    return !hit;
  });
}

function describe(violation: AxeResult, nodes: NodeResult[]) {
  const lines = nodes.slice(0, 5).map((n) => {
    const summary = (n.failureSummary ?? '').split('\n').join(' ').trim();
    return `      node: ${n.html.slice(0, 160)}\n      target: ${JSON.stringify(n.target).slice(0, 160)}\n      ${summary.slice(0, 200)}`;
  });
  const more = nodes.length > 5 ? `\n      … and ${nodes.length - 5} more node(s)` : '';
  return `  - ${violation.id} (${violation.impact ?? 'n/a'}): ${violation.description}\n${lines.join('\n')}${more}`;
}

async function scan(page: import('@playwright/test').Page, pass: PassName) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

  if (pass === 'preview') {
    builder.include('[data-docs-preview]');
  } else {
    builder.include('[data-docs-stage="example"]').exclude('[data-docs-preview]');
  }

  return builder.analyze();
}

test.describe('Primitives — WCAG 2.1 AA axe scan', () => {
  for (const slug of PRIMITIVES) {
    test(`/blocks/primitives/${slug}`, async ({ page }) => {
      await page.goto(`/blocks/primitives/${slug}`, { waitUntil: 'networkidle' });

      // Both scopes must actually exist — otherwise axe has nothing to scan
      // and the test is a silent pass. `.shiki` additionally proves the async
      // highlighter resolved, so the `code` pass sees real syntax tokens.
      await page.waitForSelector('[data-docs-preview]');
      await page.waitForSelector('[data-docs-stage="example"] .shiki');

      const failures: string[] = [];

      for (const pass of ['preview', 'code'] as const) {
        const results = await scan(page, pass);
        for (const violation of results.violations) {
          const nodes = unmatchedNodes(violation, pass, slug);
          if (nodes.length > 0) {
            failures.push(`  [${pass} pass] ${describe(violation, nodes).trimStart()}`);
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
    // it) or mis-scoped (it is silently protecting nothing). Only meaningful
    // after a full run, so skip the report when the suite was filtered.
    const stale = EXCEPTIONS.filter((e) => !usedExceptionIds.has(e.id));
    if (stale.length > 0 && usedExceptionIds.size > 0) {
      console.warn(
        `\n[a11y-baseline] ${stale.length} exception(s) matched no violation in this run:\n` +
          stale.map((e) => `  - ${e.id} (${e.rule}, ${e.pass} pass)`).join('\n') +
          `\nIf the underlying issue is fixed, delete the entry from e2e/a11y-baseline.json.\n`
      );
    }
  });
});

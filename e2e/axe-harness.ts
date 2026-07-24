import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result as AxeResult, NodeResult } from 'axe-core';

/**
 * Shared axe ratchet harness for the a11y specs (light `a11y.spec.ts` and dark
 * `a11y-dark.spec.ts`). Each spec loads its own baseline file and drives the
 * same node-level matching: a violation is suppressed only when EVERY one of
 * its nodes matches an exception, so a new node (different colour pair, element)
 * still turns the suite red. An exception without a node predicate is rejected
 * at load time — blanket rule suppression is never allowed.
 */

export type Exception = {
  id: string;
  pass: string;
  rule: string;
  routes: string[] | '*';
  contrast?: { fg: string; bg: string };
  htmlIncludes?: string[];
  reason: string;
  ref: string;
};

/** Load + validate a baseline. Fails loud so a malformed file can't silently
 *  degrade into "no exceptions" (vacuously red) or "everything allowed". */
export function loadExceptions(url: URL): Exception[] {
  const raw = JSON.parse(readFileSync(url, 'utf8')) as { exceptions?: Exception[] };
  const list = raw.exceptions ?? [];

  list.forEach((e, i) => {
    const where = `${url.pathname.split('/').pop()} exceptions[${i}]${e.id ? ` (${e.id})` : ''}`;
    if (!e.id || !e.pass || !e.rule || !e.routes) {
      throw new Error(`${where}: needs id, pass, rule and routes.`);
    }
    if (!e.reason || !e.ref) {
      throw new Error(
        `${where}: needs a reason and a ref — an undocumented deferral is not allowed.`
      );
    }
    if (!e.contrast && !e.htmlIncludes?.length) {
      throw new Error(
        `${where}: needs a node predicate (contrast or htmlIncludes). ` +
          `Blanket rule suppression is not allowed — keep exceptions node-narrow.`
      );
    }
  });

  return list;
}

const CONTRAST_RE = /foreground color: (#[0-9a-f]{6}), background color: (#[0-9a-f]{6})/i;

function matches(exc: Exception, pass: string, slug: string, rule: string, node: NodeResult) {
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

/** A stateful gate over one baseline: tracks which exceptions were used so the
 *  spec can report stale ones after a full run. */
export function createGate(exceptions: Exception[]) {
  const used = new Set<string>();

  return {
    /** The nodes of a violation that no exception accounts for. */
    unmatchedNodes(violation: AxeResult, pass: string, slug: string): NodeResult[] {
      return violation.nodes.filter((node) => {
        const hit = exceptions.find((exc) => matches(exc, pass, slug, violation.id, node));
        if (hit) used.add(hit.id);
        return !hit;
      });
    },
    usedCount: () => used.size,
    staleIds: () => exceptions.filter((e) => !used.has(e.id)).map((e) => e.id)
  };
}

export function describeViolation(violation: AxeResult, nodes: NodeResult[]): string {
  const lines = nodes.slice(0, 5).map((n) => {
    const summary = (n.failureSummary ?? '').split('\n').join(' ').trim();
    return `      node: ${n.html.slice(0, 160)}\n      target: ${JSON.stringify(n.target).slice(0, 160)}\n      ${summary.slice(0, 200)}`;
  });
  const more = nodes.length > 5 ? `\n      … and ${nodes.length - 5} more node(s)` : '';
  return `  - ${violation.id} (${violation.impact ?? 'n/a'}): ${violation.description}\n${lines.join('\n')}${more}`;
}

/** Run axe (WCAG 2.1 AA) over an include selector, optionally excluding a subtree. */
export async function scan(page: Page, include: string, exclude?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  builder.include(include);
  if (exclude) builder.exclude(exclude);
  return builder.analyze();
}

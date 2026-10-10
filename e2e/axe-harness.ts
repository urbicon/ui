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
  routes: string[];
  contrast?: { fg: string; bg: string };
  htmlIncludes?: string[];
  /**
   * The node's exact failure summary, whitespace collapsed. `htmlIncludes`
   * pins WHICH node fails; this pins HOW, so a node that starts failing for a
   * second reason (another disallowed child) is no longer covered.
   */
  summary?: string;
  reason: string;
  ref: string;
};

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Load + validate a baseline against the routes its spec scans. Fails loud so
 * a malformed file can't silently degrade into "no exceptions" (vacuously red)
 * or "everything allowed".
 *
 * `routes` must name scanned routes one by one. A route the spec does not scan
 * would never be checked for staleness, and a `'*'` cannot be: the specs run
 * fully parallel, so no single worker sees every route.
 */
export function loadExceptions(url: URL, knownRoutes: readonly string[]): Exception[] {
  const raw = JSON.parse(readFileSync(url, 'utf8')) as { exceptions?: Exception[] };
  const list = raw.exceptions ?? [];

  list.forEach((e, i) => {
    const where = `${url.pathname.split('/').pop()} exceptions[${i}]${e.id ? ` (${e.id})` : ''}`;
    if (!e.id || !e.pass || !e.rule || !e.routes) {
      throw new Error(`${where}: needs id, pass, rule and routes.`);
    }
    if (!Array.isArray(e.routes) || e.routes.length === 0) {
      throw new Error(`${where}: routes must be a non-empty list of the routes it applies to.`);
    }
    const unknown = e.routes.filter((r) => !knownRoutes.includes(r));
    if (unknown.length > 0) {
      throw new Error(
        `${where}: routes ${JSON.stringify(unknown)} are not scanned by this spec, so the ` +
          `entry could never be checked. Use the exact scanned route, or delete the entry.`
      );
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
    if (e.summary !== undefined && (typeof e.summary !== 'string' || !collapse(e.summary))) {
      throw new Error(`${where}: summary, when given, must be the non-empty failure summary.`);
    }
  });

  return list;
}

const CONTRAST_RE = /foreground color: (#[0-9a-f]{6}), background color: (#[0-9a-f]{6})/i;

function matches(exc: Exception, pass: string, route: string, rule: string, node: NodeResult) {
  if (exc.pass !== pass || exc.rule !== rule) return false;
  if (!exc.routes.includes(route)) return false;

  if (exc.contrast) {
    const m = CONTRAST_RE.exec(node.failureSummary ?? '');
    if (!m) return false;
    if (m[1].toLowerCase() !== exc.contrast.fg.toLowerCase()) return false;
    if (m[2].toLowerCase() !== exc.contrast.bg.toLowerCase()) return false;
  }

  if (exc.htmlIncludes && !exc.htmlIncludes.every((s) => node.html.includes(s))) return false;

  if (exc.summary !== undefined && collapse(node.failureSummary ?? '') !== collapse(exc.summary)) {
    return false;
  }

  return true;
}

/**
 * The gate for ONE test's scans. Create it inside the test: the specs run fully
 * parallel, so state shared at module level only ever sees one worker's share of
 * the routes.
 */
export function createGate(exceptions: Exception[]) {
  const used = new Set<string>();
  const key = (id: string, route: string) => `${id}\u0000${route}`;

  return {
    /** The nodes of a violation that no exception accounts for. */
    unmatchedNodes(violation: AxeResult, pass: string, route: string): NodeResult[] {
      return violation.nodes.filter((node) => {
        const hit = exceptions.find((exc) => matches(exc, pass, route, violation.id, node));
        if (hit) used.add(key(hit.id, route));
        return !hit;
      });
    },
    /**
     * Exceptions that name one of `routes` and matched nothing there in this
     * gate's scans — fixed (delete the entry) or scoped wider than the finding
     * (drop the route). Call it after every pass over `routes` has run.
     */
    staleFor(routes: readonly string[]): string[] {
      const stale: string[] = [];
      for (const exc of exceptions) {
        for (const route of exc.routes) {
          if (routes.includes(route) && !used.has(key(exc.id, route))) {
            stale.push(`${exc.id} (${exc.pass} pass on ${route})`);
          }
        }
      }
      return stale;
    }
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

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Run axe (WCAG 2.1 AA) over an include selector, optionally excluding a subtree. */
export async function scan(page: Page, include: string, exclude?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_21_AA);
  builder.include(include);
  if (exclude) builder.exclude(exclude);
  return builder.analyze();
}

/**
 * Run axe (WCAG 2.1 AA) ONCE over several scopes and split the violations by
 * scope. Each node belongs to the FIRST scope in `scopes` whose selector
 * contains it, so a scope nested inside a later one (a preview inside its
 * example stage) has to come first.
 *
 * One run instead of one per scope because an axe run's cost follows the size
 * of the whole document, not of its include selector: on a large docs page a
 * run scoped to the code panels takes about as long as one scoped to the
 * previews.
 */
export async function scanScopes(
  page: Page,
  scopes: ReadonlyArray<{ name: string; selector: string }>
): Promise<Map<string, AxeResult[]>> {
  const byScope = new Map<string, AxeResult[]>(scopes.map((s) => [s.name, []]));
  if (scopes.length === 0) return byScope;

  const builder = new AxeBuilder({ page }).withTags(WCAG_21_AA);
  for (const { selector } of scopes) builder.include(selector);
  const { violations } = await builder.analyze();

  // The results are serialised out of the page, so a node can only be traced
  // back to its scope through its selector. The first segment is the node
  // itself, or the iframe / shadow host that contains it.
  const targets = violations.flatMap((v) => v.nodes.map((n) => n.target));
  const owners = await page.evaluate(
    ({ nodeTargets, scopeList }) =>
      nodeTargets.map((target) => {
        const first = target[0];
        const el = document.querySelector(Array.isArray(first) ? first[0] : first);
        return el ? (scopeList.find((s) => el.closest(s.selector))?.name ?? null) : null;
      }),
    { nodeTargets: targets, scopeList: scopes }
  );

  let i = 0;
  for (const violation of violations) {
    const split = new Map<string, NodeResult[]>();
    for (const node of violation.nodes) {
      const owner = owners[i++];
      if (owner === null) {
        throw new Error(
          `axe reported ${violation.id} on ${JSON.stringify(node.target)}, which is in none of ` +
            `the scanned scopes (or left the DOM before it could be attributed): ${node.html.slice(0, 160)}`
        );
      }
      split.set(owner, [...(split.get(owner) ?? []), node]);
    }
    for (const [owner, nodes] of split) byScope.get(owner)?.push({ ...violation, nodes });
  }
  return byScope;
}

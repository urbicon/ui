#!/usr/bin/env bun
/**
 * refsections-lint — every component page renders its reference sections.
 *
 * A route directory holding a generated `api.ts` and a `+page.svelte` is a
 * component page, and it documents the component's props and types with
 * `<ReferenceSections {componentData} />` from `@urbicon-ui/docs`. That
 * component reads `componentData` once for both tables, so whether the API
 * table's type links and the Types section agree is not a question any more.
 * What is left is whether the page renders them at all — and a page without
 * them is silent, because nothing else on it refers to either section.
 *
 * Asked of the Svelte parser, not of a regex: every `.svelte` file in the route
 * directory is parsed with `svelte/compiler`, and the page counts when one of
 * them renders the name its own script imports `ReferenceSections` from
 * `@urbicon-ui/docs` under. Markup quoted in a `code={`…`}` sample is an
 * expression to the parser, not an element, so a sample showing the tag does
 * not count.
 *
 * A directory with an `api.ts` and no page is `registry:lint`'s concern
 * (`PAGELESS`), not this script's.
 *
 * Reads the generated `api.ts` files, so run `bun run docs:gen:all` first.
 *
 * Run: `bun run refsections:lint`
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';

const ROUTES = join(dirname(fileURLToPath(import.meta.url)), '../src/routes');

/**
 * Component pages that compose `ApiReference` and `TypesReference` themselves,
 * each with the reason. An entry whose page renders `ReferenceSections`, or
 * that is no component page, is stale and an error.
 */
const COMPOSED: Record<string, string> = {
  '/blocks/components/guide':
    'family page — one API Reference section holds a prop table per Guide surface and per ' +
    'controller/tour/step/event API, all linking into the one Types section below them'
};

/** A generated tree this small means `docs:gen:all` has not run, not a clean one. */
const MIN_PAGES = 90;

interface Node {
  type?: string;
  name?: string;
  [key: string]: unknown;
}

/** The local name a file imports `ReferenceSections` from `@urbicon-ui/docs` under. */
function importedAs(ast: Node): string | null {
  const body = ((ast.instance as Node | null)?.content as { body?: Node[] } | undefined)?.body;
  for (const statement of body ?? []) {
    if (statement.type !== 'ImportDeclaration') continue;
    if ((statement.source as Node).value !== '@urbicon-ui/docs') continue;
    for (const spec of statement.specifiers as Node[]) {
      if (spec.type === 'ImportSpecifier' && (spec.imported as Node).name === 'ReferenceSections') {
        return (spec.local as Node).name ?? null;
      }
    }
  }
  return null;
}

/** Whether the template renders a component called `name`. */
function renders(node: unknown, name: string): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((child) => renders(child, name));
  const n = node as Node;
  if (n.type === 'Component' && n.name === name) return true;
  return Object.entries(n).some(([key, value]) => key !== 'parent' && renders(value, name));
}

function rendersReferenceSections(file: string): boolean {
  const ast = parse(readFileSync(file, 'utf8'), { modern: true }) as unknown as Node;
  const local = importedAs(ast);
  return local !== null && renders(ast.fragment, local);
}

function componentPages(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) componentPages(path, out);
  }
  if (existsSync(join(dir, 'api.ts')) && existsSync(join(dir, '+page.svelte'))) out.push(dir);
}

const pages: string[] = [];
componentPages(ROUTES, pages);

const errors: string[] = [];
const composedSeen = new Set<string>();

for (const dir of pages) {
  const route = dir.slice(ROUTES.length);
  const files = readdirSync(dir).filter((f) => f.endsWith('.svelte'));
  const rendered = files.some((f) => rendersReferenceSections(join(dir, f)));

  if (route in COMPOSED) {
    composedSeen.add(route);
    if (rendered) {
      errors.push(`${route}: renders <ReferenceSections> — drop its COMPOSED entry`);
    }
    continue;
  }
  if (!rendered) {
    errors.push(
      `${route}: has a generated api.ts and renders no <ReferenceSections>, so its props and ` +
        `types are documented nowhere. Add \`<ReferenceSections {componentData} />\` with ` +
        `\`componentData\` from './api', or list the page in COMPOSED with the reason.`
    );
  }
}

for (const route of Object.keys(COMPOSED)) {
  if (!composedSeen.has(route)) {
    errors.push(`COMPOSED: stale entry '${route}' — no component page there. Remove it.`);
  }
}

if (pages.length < MIN_PAGES) {
  console.error(
    `refsections-lint: only ${pages.length} component pages found (floor ${MIN_PAGES}) — the ` +
      'generated api.ts files are missing. Run `bun run docs:gen:all`.'
  );
  process.exit(1);
}

if (errors.length > 0) {
  console.error(`\n\x1b[31m✗ refsections-lint: ${errors.length} error(s)\x1b[0m`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(
  `\x1b[32m✓ refsections-lint: ${pages.length - composedSeen.size} component pages render ` +
    `<ReferenceSections>, ${composedSeen.size} compose the tables by decision.\x1b[0m`
);

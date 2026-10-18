#!/usr/bin/env bun
/**
 * refsections-lint — every component page renders its reference sections.
 *
 * A component page documents its component's props and types with
 * `<ReferenceSections {componentData} />` from `@urbicon-ui/docs`. That
 * component reads `componentData` once for both tables, so whether the API
 * table's type links and the Types section agree is not a question any more;
 * what is left is whether the page renders them. Dropping the component alone
 * is caught already — `sections:lint` reports the page's `api` and `types` nav
 * entries as dead. What reaches no other gate is a page that drops the nav
 * entries with it: no API table, no Types section, and a table of contents
 * that agrees with the page about both being gone.
 *
 * What this checks is presence, not reachability or binding. The tag inside
 * `{#if false}`, inside a snippet nothing renders, inside a `<CodeExample>`
 * demo, or fed `componentData={{}}` passes. Those are deliberate edits, not
 * the slip of forgetting the component.
 *
 * Which directories are component pages is asked of two sources, so neither
 * can shrink the set alone:
 *   - tracked source: a directory whose `.svelte` files import from `'./api'`;
 *   - generated output: a directory holding an `api.ts` and a `+page.svelte`.
 * A page that imports `'./api'` while no `api.ts` was generated is an error,
 * so a partial `docs:gen` fails here instead of shrinking what is checked. A
 * directory with an `api.ts` and no page is `registry:lint`'s (`PAGELESS`).
 *
 * Both questions — what a file imports, what it renders — go to the Svelte
 * parser, not a regex: markup and imports quoted in a `code={`…`}` sample are
 * strings to the parser, so a sample showing them does not count.
 *
 * Run: `bun run refsections:lint` (after `bun run docs:gen:all`)
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
    'controller/tour/step/event API under one Types section; every table renders through the ' +
    "page's `propTable` snippet, which binds the one `types` list that Types section renders"
};

interface Node {
  type?: string;
  name?: string;
  [key: string]: unknown;
}

const OWN_API = /^\.\/api(\.js|\.ts)?$/;

/** The `import` declarations of a file's instance and module scripts. */
function imports(ast: Node): Node[] {
  return [ast.instance, ast.module]
    .flatMap(
      (script) => ((script as Node | null)?.content as { body?: Node[] } | undefined)?.body ?? []
    )
    .filter((statement) => statement.type === 'ImportDeclaration');
}

/** The local name a file imports `ReferenceSections` from `@urbicon-ui/docs` under. */
function referenceSectionsAs(ast: Node): string | null {
  for (const statement of imports(ast)) {
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

interface Page {
  route: string;
  importsOwnApi: boolean;
  hasApi: boolean;
  rendersReferenceSections: boolean;
}

function read(dir: string): Page {
  let importsOwnApi = false;
  let rendersReferenceSections = false;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.svelte'))) {
    const ast = parse(readFileSync(join(dir, file), 'utf8'), { modern: true }) as unknown as Node;
    importsOwnApi ||= imports(ast).some((i) => OWN_API.test(String((i.source as Node).value)));
    const local = referenceSectionsAs(ast);
    rendersReferenceSections ||= local !== null && renders(ast.fragment, local);
  }
  return {
    route: dir.slice(ROUTES.length),
    importsOwnApi,
    hasApi: existsSync(join(dir, 'api.ts')),
    rendersReferenceSections
  };
}

function pageDirs(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) pageDirs(path, out);
  }
  if (existsSync(join(dir, '+page.svelte'))) out.push(dir);
}

const dirs: string[] = [];
pageDirs(ROUTES, dirs);
const pages = dirs.map(read).filter((p) => p.importsOwnApi || p.hasApi);

const errors: string[] = [];
const composedSeen = new Set<string>();

for (const page of pages) {
  const { route } = page;
  if (page.importsOwnApi && !page.hasApi) {
    errors.push(
      `${route}: imports './api' but no api.ts was generated for it, so its reference sections ` +
        'cannot be checked. Run `bun run docs:gen:all`; if it still lacks one, the component ' +
        'dropped out of the catalog.'
    );
    continue;
  }
  if (route in COMPOSED) {
    composedSeen.add(route);
    if (page.rendersReferenceSections) {
      errors.push(`${route}: renders <ReferenceSections> — drop its COMPOSED entry`);
    }
    continue;
  }
  if (!page.rendersReferenceSections) {
    errors.push(
      `${route}: is a component page and renders no <ReferenceSections>, so its props and ` +
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

if (pages.length === 0) {
  errors.push(`no component page under ${ROUTES} — did the routes move?`);
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

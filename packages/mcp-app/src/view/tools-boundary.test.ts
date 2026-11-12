/**
 * `tools/call` is written in exactly one module of the package —
 * `src/view/tools.ts`, the module behind `@urbicon-ui/mcp-app/view/tools`.
 *
 * That is the package's half. The app's half: its architecture rule forbids
 * that one specifier outside the entry of a view that declares `callsTools`,
 * and it scans its own view code for the literal, because `createBridge` from
 * `./view` keeps a free `request`. Both are a heuristic against an accident,
 * not a guarantee — a name put together (`'tools' + '/call'`) passes either.
 *
 * The rule is worth something only if no other module of the package writes
 * the method name: `startView` sending `tools/call` itself would hand every
 * view the path the rule closes. What is code is said by the TypeScript
 * compiler, not by a pattern — comments go, string literals of every kind stay.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

const SRC = new URL('..', import.meta.url).pathname;
const THE_ONE = 'view/tools.ts';

/** The method name as a string — `'tools/call'`, `"tools/call"` or `` `tools/call` ``. */
const TOOLS_CALL = /([`'"])tools\/call\1/;

/** The code of a module without comments. */
function codeOf(text: string): string {
  return ts.transpileModule(text, {
    compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext }
  }).outputText;
}

/** Every module the package publishes, relative to `src/`, with its text. */
function shippedModules(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(SRC, { recursive: true, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    const rel = relative(SRC, path);
    if (!entry.isFile() || !rel.endsWith('.ts') || rel.endsWith('.test.ts')) continue;
    if (rel.split('/').includes('__fixtures__')) continue;
    files[rel] = readFileSync(path, 'utf8');
  }
  return files;
}

function writersOf(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([path, text]) => path !== THE_ONE && TOOLS_CALL.test(codeOf(text)))
    .map(([path]) => path)
    .sort();
}

describe('tools/call in the package', () => {
  test('only view/tools.ts writes the method name', () => {
    const files = shippedModules();
    // The scan reaches the one module and the ones a regression would touch.
    for (const path of [THE_ONE, 'view/bridge.ts', 'view/start.ts', 'view/index.ts']) {
      expect(Object.keys(files), path).toContain(path);
    }
    expect(TOOLS_CALL.test(codeOf(files[THE_ONE] ?? ''))).toBe(true);
    expect(writersOf(files)).toEqual([]);
  });

  test('positive control: a planted call is found — quoted and as a template literal', () => {
    const files = shippedModules();
    const planted = {
      ...files,
      'view/start.ts': `${files['view/start.ts']}\nexport const x = (b: { request(m: string): void }) => b.request("tools/call");`,
      'view/bridge.ts': `${files['view/bridge.ts']}\nexport const y = \`tools/call\`;`
    };
    expect(writersOf(planted)).toEqual(['view/bridge.ts', 'view/start.ts']);
  });

  test('a comment is no call, a // inside a string hides none — a name put together passes', () => {
    expect(
      writersOf({
        'view/a.ts':
          '// calls \'tools/call\' through the host\n/* "tools/call" */\nexport const a = 1;'
      })
    ).toEqual([]);
    expect(
      writersOf({ 'view/b.ts': "const u = 'https://x'; export const b = ['tools/call', u];" })
    ).toEqual(['view/b.ts']);
    // The limit of a literal scan, here and in an app's: it is a heuristic.
    expect(writersOf({ 'view/c.ts': "export const c = 'tools' + '/call';" })).toEqual([]);
  });
});

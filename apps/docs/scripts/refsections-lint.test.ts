import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COMPOSED } from './refsections-lint';

/**
 * Positive controls for `refsections:lint`, run as the CLI over a fixture
 * routes tree (`--routes`). A lint that reads no page prints the same green
 * line as one that read them all, so the clean tree has to report a non-zero
 * count, and each way of failing to render the component has to come back by
 * route.
 *
 * The three red pages are the ones a text search would pass: the tag inside an
 * HTML comment and inside a `code={`…`}` sample are there as text, and only the
 * parser says neither renders.
 */

const SCRIPT = join(import.meta.dirname, 'refsections-lint.ts');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const API = 'export const componentData = { props: [], types: [] };\n';

function page(root: string, route: string, markup: string, imports: string[] = []) {
  const dir = join(root, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'api.ts'), API);
  const script = [`import { componentData } from './api';`, ...imports].join('\n  ');
  writeFileSync(
    join(dir, '+page.svelte'),
    `<script lang="ts">\n  ${script}\n</script>\n\n${markup}\n`
  );
}

const RENDERS = `import { ReferenceSections } from '@urbicon-ui/docs';`;

/** A tree the lint passes: one page rendering the component, every COMPOSED page composing. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'refsections-'));
  roots.push(root);
  page(root, 'blocks/components/button', '<ReferenceSections {componentData} />', [RENDERS]);
  for (const route of Object.keys(COMPOSED)) {
    page(root, route, '<ApiReference props={componentData.props} />', [
      `import { ApiReference } from '@urbicon-ui/docs';`
    ]);
  }
  return root;
}

function lint(root: string) {
  const run = spawnSync('bun', [SCRIPT, '--routes', root], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

describe('refsections-lint', () => {
  it('passes a tree whose component page renders <ReferenceSections>', () => {
    const { status, output } = lint(fixture());

    expect(output).toContain('1 component pages render <ReferenceSections>');
    expect(status).toBe(0);
  });

  it('names each page that only mentions the component', () => {
    const root = fixture();
    page(root, 'blocks/components/commented', '<!-- <ReferenceSections {componentData} /> -->', [
      RENDERS
    ]);
    page(
      root,
      'blocks/components/quoted',
      '<CodeExample code={`<ReferenceSections {componentData} />`} />',
      [RENDERS, `import { CodeExample } from '@urbicon-ui/docs';`]
    );
    page(root, 'blocks/components/dropped', '<h1>Dropped</h1>', [RENDERS]);

    const { status, output } = lint(root);
    const named = [...output.matchAll(/^\s+(\S+): is a component page/gm)].map((m) => m[1]);

    expect(named.sort()).toEqual([
      '/blocks/components/commented',
      '/blocks/components/dropped',
      '/blocks/components/quoted'
    ]);
    expect(status).toBe(1);
  });
});

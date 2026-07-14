import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { codeExamplePlugin } from './code-example-plugin';

const FIXTURE_PATH = fileURLToPath(
  new URL('./__fixtures__/CodeExampleRegression.svelte', import.meta.url)
);
const DEFAULT_ID = '/repo/apps/docs/src/routes/demo/+page.svelte';

const plugin = codeExamplePlugin();

function transform(source: string, id = DEFAULT_ID): string | null {
  const result = plugin.transform(source, id);
  return result ? result.code : null;
}

interface AstNode {
  type: string;
  start: number;
  end: number;
  name?: string;
  attributes?: AstNode[];
  [key: string]: unknown;
}

/**
 * Reads the plugin's output back through Svelte's parser rather than scanning for
 * `>` — which is the very bug under test. Parsing also asserts the invariant the
 * old regex broke: the transformed source is still valid Svelte.
 */
function examplesIn(output: string): AstNode[] {
  const found: AstNode[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const node = value as AstNode;
    if (node.type === 'Component' && node.name === 'CodeExample') found.push(node);
    for (const key of Object.keys(node)) visit(node[key]);
  };
  visit(parse(output, { modern: true }).fragment);
  return found;
}

function rawAttribute(source: string, node: AstNode, name: string): string | null {
  const attr = (node.attributes ?? []).find((a) => a.type === 'Attribute' && a.name === name);
  return attr ? source.slice(attr.start, attr.end) : null;
}

/** The raw (still-escaped) body of the `code={`…`}` template literal, by example title. */
function codeOf(output: string, title: string): string | null {
  const node = examplesIn(output).find(
    (n) => rawAttribute(output, n, 'title') === `title="${title}"`
  );
  if (!node) throw new Error(`no <CodeExample> titled "${title}" in the output`);
  const raw = rawAttribute(output, node, 'code');
  if (raw === null) return null;
  const match = raw.match(/^code=\{`([\s\S]*)`\}$/);
  if (!match) throw new Error(`code prop of "${title}" is not a template literal: ${raw}`);
  return match[1];
}

let fixtureOutput: string | undefined;
/** Transformed once, lazily, so the fixture's deliberate warning lands in a spy. */
function fixture(): string {
  if (fixtureOutput === undefined) {
    const result = transform(readFileSync(FIXTURE_PATH, 'utf-8'));
    if (result === null) throw new Error('fixture produced no transformation');
    fixtureOutput = result;
  }
  return fixtureOutput;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('codeExamplePlugin', () => {
  describe('regression fixture', () => {
    // Facet 2 (was live until ac4b4e3 worked around it): the self-closing example
    // above this one made the non-greedy match run to *this* element's closing tag
    // and swallow it, silently killing its extraction.
    it('extracts an isolate example that follows a self-closing example', () => {
      expect(codeOf(fixture(), 'Isolate after a self-closing example')).toBe(
        '<span data-testid="after-self-closing">extract me</span>'
      );
    });

    // Facet 1 (was latent): a literal `>` inside the preceding code={`…`} template
    // literal terminated the open-tag match early.
    it('extracts an isolate example that follows a literal `>` in a template literal', () => {
      expect(codeOf(fixture(), 'Isolate after both facets')).toBe(
        '<span data-testid="after-both-facets">extract me too</span>'
      );
    });

    it('leaves a literal `>` in an example’s own code prop untouched', () => {
      expect(codeOf(fixture(), 'Literal gt in a template literal')).toBe(
        '{#if count > 0}many{/if}'
      );
      expect(codeOf(fixture(), 'Both facets')).toBe('{#each items as i}<i>{i > 1}</i>{/each}');
    });

    it('inserts into a multi-line open tag without disturbing its attributes', () => {
      expect(codeOf(fixture(), 'Multi-line open tag')).toBe(
        '<span data-testid="multi-line-open-tag">nested</span>'
      );
      expect(fixture()).toContain('description={`Map<string, number> in a description`}');
    });

    it('escapes backticks and ${} in extracted children', () => {
      expect(codeOf(fixture(), 'Escaping')).toBe(
        '<span data-testid="escaping">{\\`a \\${1 + 1} b\\`}</span>'
      );
    });

    it('keeps an explicit code prop and does not extract over it', () => {
      expect(codeOf(fixture(), 'Explicit code wins')).toBe('<span>explicit</span>');
    });

    it('ignores examples without the isolate attribute', () => {
      expect(codeOf(fixture(), 'Not isolated')).toBeNull();
    });

    it('preserves every authored example', () => {
      // The old regex consumed whole elements; every example must survive.
      expect(examplesIn(fixture())).toHaveLength(10);
    });
  });

  describe('fail-loud warnings', () => {
    it('warns when an isolate example is self-closing', () => {
      transform('<CodeExample title="x" isolate />');
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain('no code to extract');
      expect(message).toContain('self-closing');
      expect(message).toContain('1:1');
    });

    it('warns when an isolate example has no children', () => {
      transform('<CodeExample title="x" isolate></CodeExample>');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('no code to extract');
    });

    it('warns when an isolate example has whitespace-only children', () => {
      transform('<CodeExample title="x" isolate>\n  \n</CodeExample>');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('children are empty');
    });

    it('reports the offending file and line', () => {
      transform('<p>a</p>\n<CodeExample isolate />', '/repo/apps/docs/src/routes/x/+page.svelte');
      expect(warn.mock.calls[0][0]).toContain('/repo/apps/docs/src/routes/x/+page.svelte:2:1');
    });

    it('warns and skips instead of throwing on unparseable source', () => {
      expect(() => transform('<CodeExample isolate>{#if}</CodeExample>')).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('could not parse');
    });

    it('stays silent for well-formed extractions', () => {
      transform('<CodeExample isolate><b>hi</b></CodeExample>');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('extraction', () => {
    it('dedents children to the shallowest non-empty line', () => {
      const output = transform(
        [
          '<CodeExample title="t" isolate>',
          '  <div>',
          '    <b>deep</b>',
          '  </div>',
          '</CodeExample>'
        ].join('\n')
      ) as string;
      expect(codeOf(output, 't')).toBe('<div>\n  <b>deep</b>\n</div>');
    });

    it('escapes backslashes in extracted children', () => {
      const output = transform('<CodeExample title="t" isolate><b>a\\nb</b></CodeExample>');
      expect(codeOf(output as string, 't')).toBe('<b>a\\\\nb</b>');
    });

    it('extracts examples nested inside blocks and snippets', () => {
      const source = [
        '{#snippet demo()}',
        '  <CodeExample title="in-snippet" isolate>',
        '    <b>snippet child</b>',
        '  </CodeExample>',
        '{/snippet}'
      ].join('\n');
      expect(codeOf(transform(source) as string, 'in-snippet')).toBe('<b>snippet child</b>');
    });
  });

  describe('file filtering', () => {
    const isolate = '<CodeExample isolate><b>x</b></CodeExample>';

    it('ignores non-svelte files', () => {
      expect(transform(isolate, '/repo/apps/docs/src/lib/x.ts')).toBeNull();
    });

    it('ignores sources without CodeExample', () => {
      expect(transform('<Button>x</Button>')).toBeNull();
    });

    it('ignores node_modules and package dist output', () => {
      expect(transform(isolate, '/repo/node_modules/@urbicon-ui/docs/x.svelte')).toBeNull();
      expect(transform(isolate, '/repo/packages/docs/dist/x.svelte')).toBeNull();
    });

    it('returns null when nothing was transformed', () => {
      expect(transform('<CodeExample title="x">no isolate</CodeExample>')).toBeNull();
    });
  });
});

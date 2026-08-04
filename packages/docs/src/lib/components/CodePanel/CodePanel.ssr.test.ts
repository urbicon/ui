import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { highlighterService } from '../../utils/highlighter';
import CodePanel from './CodePanel.svelte';

/**
 * What the server renders — the half #10 is about.
 *
 * `CodePanel` awaited an async highlighter inside an `$effect`, and effects do
 * not run during SSR. So every prerendered code block on the docs site was a
 * spinner plus the words "Loading syntax highlighting…", and a non-rendering
 * crawler — the audience this project is explicitly built for — read 186 code
 * examples as having no content at all.
 *
 * These assertions fail on effect-based highlighting and pass on the derived,
 * synchronous one. The measurement that unblocked the switch (bundle bytes,
 * engine output parity) is written up at the top of `utils/highlighter.ts`.
 */

const SNIPPET = `const answer: number = 42;`;

const bodyOf = (props: Partial<ComponentProps<typeof CodePanel>>) =>
  render(CodePanel, { props: props as ComponentProps<typeof CodePanel> }).body;

describe('CodePanel — server render', () => {
  it('carries the code itself, not a loading placeholder', () => {
    const body = bodyOf({ code: SNIPPET, language: 'typescript' });

    expect(body).toContain('answer');
    expect(body).toContain('42');
    expect(body).not.toContain('Loading syntax');
  });

  it('carries real highlighting, not escaped plain text', () => {
    // Shiki's own wrapper plus per-token colours. The fallback path (a bare
    // `<pre><code>`) would satisfy "contains the code" but not this.
    const body = bodyOf({ code: SNIPPET, language: 'typescript' });

    expect(body).toContain('class="shiki');
    expect(body).toContain('--shiki-dark');
  });

  it('highlights every language the site uses', () => {
    const cases: Array<[string, string]> = [
      ['svelte', '<script>let a = 1;</script>'],
      ['typescript', 'type A = 1;'],
      ['javascript', 'const a = 1;'],
      ['css', 'a { color: red }'],
      ['html', '<p>hi</p>'],
      ['bash', 'bun run build'],
      ['json', '{"a":1}'],
      ['toml', 'a = 1'],
      ['ini', '[a]\nb=1']
    ];

    for (const [language, code] of cases) {
      const body = bodyOf({ code, language });
      expect(body, `${language} fell back to plain text`).toContain('class="shiki');
    }
  });

  it('falls back to escaped text for a language it does not carry', () => {
    // Read-tolerant, like the async version: an unknown grammar must not throw
    // through the render. `&lt;` proves the fallback escaped rather than emitted
    // raw markup into `{@html}`.
    const body = bodyOf({ code: '<b>x</b>', language: 'brainfuck' });

    expect(body).toContain('&lt;b&gt;');
    expect(body).not.toContain('class="shiki');
  });

  it('escapes markup on the fallback path rather than trusting it', () => {
    expect(highlighterService.highlightCode('<img src=x onerror=y>', 'nope')).toBe(
      '<pre><code>&lt;img src=x onerror=y&gt;</code></pre>'
    );
  });
});

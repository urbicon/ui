import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
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
    // `Loading syntax` measured correctly against the pre-fix build, but it is
    // inert from here on: the i18n key is deleted, so the string cannot return.
    // A regression would show up in the assertion above instead.
    expect(body).not.toContain('Loading syntax');
    // Deleted here: `toContain('42')`. It passed on the BROKEN build — `42` sits
    // in the path data of the loading spinner's SVG (`3.0` + `42` + ` 1.135`) —
    // so it asserted the presence of the very element it was written to prove
    // gone.
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

describe('highlighterService — the paths that used to be silent', () => {
  it('carries yaml, which a docs page actually uses', () => {
    // `/i18n/auditing` renders a CI snippet as `language="yaml"`. It was not in
    // the grammar list and fell through to escaped plain text with no signal —
    // and since highlighting now runs on the server, that degradation was being
    // baked into the prerendered HTML where no console is watching.
    const html = highlighterService.highlightCode('jobs:\n  test:\n    name: x', 'yaml');

    expect(html).toContain('class="shiki');
  });

  it('reports a language it does not carry instead of silently degrading', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = highlighterService.highlightCode('print(1)', 'python');

      expect(html).toContain('<pre><code>');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('python');
    } finally {
      warn.mockRestore();
    }
  });

  it('answers a repeat from cache, so hydration does not re-highlight', () => {
    // `{@html}` re-evaluates its expression during hydration and then keeps the
    // server's DOM regardless, so every block would otherwise be highlighted a
    // second time and thrown away — synchronously, on the main thread.
    //
    // Counted at the highlighter, not compared on the result: JavaScript string
    // equality is by value, so two independently built identical strings are
    // `===` and even `Object.is` — an assertion on the output cannot tell a
    // cache hit from a recompute at all. (It was written that way first, and
    // stayed green with the cache removed.)
    const highlighter = highlighterService.getHighlighter();
    const spy = vi.spyOn(highlighter, 'codeToHtml');
    try {
      const code = `const cached = ${Math.floor(performance.now())};`;
      const first = highlighterService.highlightCode(code, 'typescript');
      const second = highlighterService.highlightCode(code, 'typescript');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    } finally {
      spy.mockRestore();
    }
  });
});

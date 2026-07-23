// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { StreamingMarkdownProps } from './index';
import StreamingMarkdown from './StreamingMarkdown.svelte';

// DOM tests for the renderer layer on top of the P0 parser engine. The engine's
// correctness (streaming invariant, URL policy, repair) is covered by the
// markdown/ suites; here we assert what actually reaches the DOM: exact text
// (whitespace discipline in MdInline), heading level mapping, policy-blocked
// nodes staying inert, citation wiring, and settled-block DOM-node identity
// across appends — the property the whole settled-cache design exists for.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(initial: StreamingMarkdownProps) {
  const props = $state(initial);
  const instance = mount(StreamingMarkdown, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return props;
}

describe('StreamingMarkdown (renderer)', () => {
  it('renders inline markup with exact text content — no stray whitespace', () => {
    render({ content: 'A **bold** move with `code` and *em*.' });
    const p = document.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBe('A bold move with code and em.');
    expect(p?.querySelector('strong')?.textContent).toBe('bold');
    expect(p?.querySelector('em')?.textContent).toBe('em');
    expect(p?.querySelector('code')?.textContent).toBe('code');
  });

  it('maps markdown heading levels through headingLevelStart', () => {
    render({ content: '# Title\n\n## Sub', headingLevelStart: 3 });
    expect(document.querySelector('h3')?.textContent).toBe('Title');
    expect(document.querySelector('h4')?.textContent).toBe('Sub');
    expect(document.querySelector('h1')).toBeNull();
  });

  it('defaults headings to their literal level', () => {
    render({ content: '# Title' });
    expect(document.querySelector('h1')?.textContent).toBe('Title');
  });

  it('renders a GFM table with per-column alignment inside a focusable region', () => {
    render({ content: '| A | B |\n| :-- | :-: |\n| 1 | 2 |' });
    const region = document.querySelector('[role="region"]');
    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(region?.getAttribute('aria-label')).toBe('Table');
    const headCells = document.querySelectorAll('th');
    expect(headCells).toHaveLength(2);
    expect(headCells[1].className).toContain('text-center');
    expect(document.querySelector('td')?.textContent).toBe('1');
  });

  it('renders javascript: links as inert text — no anchor, no href', () => {
    render({ content: 'Click [here](javascript:alert(1)) now.' });
    expect(document.querySelector('a')).toBeNull();
    expect(document.body.textContent).toContain('here');
    expect(document.body.innerHTML).not.toContain('javascript:');
  });

  it('blocks external images and shows the alt-text fallback chip', () => {
    render({ content: '![architecture diagram](https://evil.example/x.png)' });
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('architecture diagram');
    expect(document.body.innerHTML).not.toContain('evil.example');
  });

  it('keeps relative links working under the default policy', () => {
    render({ content: 'See [the docs](/docs/tokens).' });
    const a = document.querySelector('a');
    expect(a?.getAttribute('href')).toBe('/docs/tokens');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders task-list items as disabled checkboxes', () => {
    render({ content: '- [x] done\n- [ ] open' });
    const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(false);
    expect(boxes[0].disabled).toBe(true);
  });

  it('shows the streaming cursor only while streaming', () => {
    const props = render({ content: 'Hello', streaming: true });
    expect(document.querySelector('[aria-hidden="true"]')).not.toBeNull();
    props.streaming = false;
    flushSync();
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('keeps settled block DOM nodes identical across appends', () => {
    const props = render({ content: 'First paragraph.\n\nSecond paragraph.\n\n' });
    props.content += 'Third paragraph.\n\nFourth paragraph.\n\n';
    flushSync();
    const before = document.querySelectorAll('p');
    expect(before.length).toBeGreaterThanOrEqual(3);
    const settledNode = before[0];
    props.content += 'Fifth paragraph.\n\nSixth **and** more.\n\n';
    flushSync();
    const after = document.querySelectorAll('p');
    // Same DOM node object — the keyed {#each} never re-created the settled block.
    expect(after[0]).toBe(settledNode);
  });

  it('turns [id] markers into citation chips once a matching source arrives', () => {
    const props = render({ content: 'Grounded fact [1] in prose.' });
    // No sources yet: the marker stays literal prose, no interactive element.
    expect(document.body.textContent).toContain('[1]');
    expect(document.querySelector('button')).toBeNull();
    const pBefore = document.querySelector('p');

    props.sources = [{ id: '1', title: 'Design tokens', url: 'https://ui.urbicon.de/tokens' }];
    flushSync();
    // The option change re-parses, but index-sequential keys reconcile: the
    // paragraph element survives, now containing the chip trigger.
    const pAfter = document.querySelector('p');
    expect(pAfter).toBe(pBefore);
    expect(pAfter?.querySelector('button')).not.toBeNull();
    expect(pAfter?.textContent).not.toContain('[1]');
  });

  it('lets a renderers.codeBlock snippet replace the built-in CodeBlock', () => {
    const codeBlock = createRawSnippet<[{ code: string; lang?: string; open?: boolean }]>(
      (params) => ({
        render: () => `<div data-custom-code>${params().lang ?? 'none'}</div>`
      })
    );
    render({ content: '```ts\nconst x = 1;\n```', renderers: { codeBlock } });
    expect(document.querySelector('[data-custom-code]')?.textContent).toBe('ts');
    expect(document.querySelector('pre')).toBeNull();
  });

  it('strips a policy-blocked source.url before it reaches a citation renderer override', () => {
    const citation = createRawSnippet<[{ id: string; source?: { url?: string }; index?: number }]>(
      (params) => ({
        render: () => `<span data-cite>${params().source?.url ?? 'stripped'}</span>`
      })
    );
    render({
      content: 'Fact [1].',
      sources: [{ id: '1', title: 'Poisoned source', url: 'javascript:alert(1)' }],
      renderers: { citation }
    });
    expect(document.querySelector('[data-cite]')?.textContent).toBe('stripped');
    expect(document.body.innerHTML).not.toContain('javascript:');
  });

  it('applies slotClasses overrides and honors unstyled', () => {
    render({ content: 'Text', slotClasses: { paragraph: 'custom-p' } });
    expect(document.querySelector('p')?.className).toContain('custom-p');
    document.body.replaceChildren();
    dispose?.();
    render({ content: 'Text', unstyled: true, slotClasses: { paragraph: 'only-this' } });
    expect(document.querySelector('p')?.className).toBe('only-this');
  });
});

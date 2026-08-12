// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageData } from '../chat.types';
import ChatMessage from './ChatMessage.svelte';
import type { ChatMessageProps } from './index';

// DOM/interaction tests for the message renderer. The parser + URL-policy
// engines are covered by markdown/ and StreamingMarkdown's own suites; here we
// assert what reaches the DOM: part dispatch, the citation footer, attachment
// link policy, status affordances, the copy interaction and override hooks.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function render(initial: ChatMessageProps) {
  const props = $state(initial);
  const instance = mount(ChatMessage, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return props;
}

function msg(overrides: Partial<ChatMessageData>): ChatMessageData {
  return { id: 'm1', role: 'assistant', parts: [], ...overrides };
}

describe('ChatMessage', () => {
  it('renders a text part through StreamingMarkdown (markdown → real DOM)', () => {
    render({ message: msg({ parts: [{ type: 'text', text: 'A **bold** claim.' }] }) });
    const strong = document.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
    expect(document.body.textContent).toContain('A bold claim.');
  });

  it('defaults to a bubble and exposes data-role / data-status hooks', () => {
    render({ message: msg({ role: 'user', parts: [{ type: 'text', text: 'hi' }] }) });
    const root = document.querySelector('[data-role]');
    expect(root?.getAttribute('data-role')).toBe('user');
    // No status → treated as complete.
    expect(root?.getAttribute('data-status')).toBe('complete');
    // Bubble tint present.
    expect(document.querySelector('.bg-primary-subtle')).not.toBeNull();
  });

  it('renders a role header in plain layout that the bubble layout omits', () => {
    render({ message: msg({ parts: [{ type: 'text', text: 'x' }] }), layout: 'plain' });
    expect(document.body.textContent).toContain('Assistant');
    document.body.replaceChildren();
    dispose?.();
    render({ message: msg({ parts: [{ type: 'text', text: 'x' }] }), layout: 'bubble' });
    // Bubble layout shows no role name row.
    expect(document.body.textContent).not.toContain('Assistant');
  });

  /**
   * Structural, not cosmetic: the timestamp and citations used to be siblings of
   * `container` — the element that flips to `flex-row-reverse` for a user
   * message. So the bubble moved right while everything under it stayed pinned
   * to the left margin. They now share the aligned column with the bubble, which
   * is the only way the alignment can follow the role at all.
   */
  it('keeps the timestamp in the same aligned column as the bubble content', () => {
    for (const [role, alignment] of [
      ['user', 'items-end'],
      ['assistant', 'items-start']
    ] as const) {
      render({
        message: msg({
          role,
          parts: [{ type: 'text', text: 'Aligned with me' }],
          createdAt: new Date('2026-01-01T10:00:00')
        })
      });
      const time = document.querySelector('time');
      expect(time, `${role}: timestamp rendered`).not.toBeNull();

      const column = time!.closest(`.${alignment}`);
      expect(column, `${role}: timestamp hangs off a ${alignment} column`).not.toBeNull();
      // The same column holds the message text — that is what "aligned with the
      // bubble" means. A column containing only the footer would still match the
      // class assertion above.
      expect(column!.textContent, `${role}: that column also holds the bubble`).toContain(
        'Aligned with me'
      );

      document.body.replaceChildren();
      dispose?.();
    }
  });

  it('collects source parts into a numbered citation footer', () => {
    render({
      message: msg({
        parts: [
          { type: 'text', text: 'Grounded.' },
          { type: 'source', id: 'a', title: 'First source', url: 'https://example.com/a' },
          { type: 'source', id: 'b', title: 'Second source', url: 'https://example.com/b' }
        ]
      })
    });
    // Citation triggers are labelled "Source {n}: {title}" and show the ordinal.
    const chips = screen.getAllByRole('button', { name: /^Source \d+:/, hidden: true });
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent?.trim()).toBe('1');
    expect(chips[1].textContent?.trim()).toBe('2');
    expect(chips[0].getAttribute('aria-label')).toBe('Source 1: First source');
  });

  it('dedupes repeated source ids instead of crashing the keyed footer', () => {
    // Models cite the same source repeatedly — duplicate ids are ordinary
    // input and must not throw each_key_duplicate (adversarial-review finding).
    render({
      message: msg({
        parts: [
          { type: 'text', text: 'Cited twice.' },
          { type: 'source', id: 'a', title: 'Repeated source', url: 'https://example.com/a' },
          { type: 'source', id: 'a', title: 'Repeated source', url: 'https://example.com/a' },
          { type: 'source', id: 'b', title: 'Other source' }
        ]
      })
    });
    const chips = screen.getAllByRole('button', { name: /^Source \d+:/, hidden: true });
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute('aria-label')).toBe('Source 1: Repeated source');
  });

  it('hides the copy action for messages without any text part', () => {
    render({
      message: msg({
        parts: [{ type: 'reasoning', text: 'internal chain of thought' }]
      })
    });
    expect(screen.queryByRole('button', { name: 'Copy', hidden: true })).toBeNull();
  });

  it('never renders a javascript: attachment url as a link', () => {
    render({
      message: msg({
        parts: [
          {
            type: 'attachment',
            name: 'evil.pdf',
            mimeType: 'application/pdf',
            url: 'javascript:alert(1)'
          }
        ]
      })
    });
    expect(document.querySelector('a')).toBeNull();
    expect(document.body.textContent).toContain('evil.pdf');
    expect(document.body.innerHTML).not.toContain('javascript:');
  });

  it('wraps an https attachment in a safe download link', () => {
    render({
      message: msg({
        parts: [
          {
            type: 'attachment',
            name: 'report.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            url: 'https://files.example.com/report.pdf'
          }
        ]
      })
    });
    const a = document.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://files.example.com/report.pdf');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.hasAttribute('download')).toBe(true);
    expect(a?.textContent).toContain('report.pdf');
    // Human-readable size shown alongside the name.
    expect(a?.textContent).toContain('2 KB');
  });

  it('shows a failed tool call with its name and error message', () => {
    render({
      message: msg({
        parts: [
          {
            type: 'tool-call',
            id: 't1',
            name: 'search_web',
            state: 'error',
            errorMessage: 'rate limited'
          }
        ]
      })
    });
    expect(document.body.textContent).toContain('search_web');
    expect(document.body.textContent).toContain('rate limited');
    expect(document.querySelector('.text-danger-text')).not.toBeNull();
  });

  it('renders a running tool call through ToolCallCard with its status text', () => {
    render({
      message: msg({
        parts: [{ type: 'tool-call', id: 't1', name: 'search_web', state: 'running' }]
      })
    });
    // ToolCallCard's CoreSpinner is deliberately ARIA-free chrome; the status
    // text inside the trigger is the accessible signal (visible text in the
    // default quiet header, an sr-only line in `variant="card"`).
    expect(document.body.textContent).toContain('Running');
    expect(document.body.textContent).toContain('search_web');
    expect(screen.getByRole('button', { name: /search_web Running/ })).not.toBeNull();
  });

  it('labels a reasoning part with its rounded duration', () => {
    render({
      message: msg({
        parts: [{ type: 'reasoning', text: 'weighing options', durationMs: 3000 }]
      })
    });
    expect(document.body.textContent).toContain('Thought for 3s');
    expect(document.body.textContent).toContain('weighing options');
  });

  it('falls back to the reasoning label without a duration', () => {
    render({ message: msg({ parts: [{ type: 'reasoning', text: 'hmm' }] }) });
    expect(document.body.textContent).toContain('Reasoning');
    expect(document.body.textContent).not.toContain('Thought for');
  });

  it('renders an error Alert and wires the retry button', () => {
    const onRetry = vi.fn();
    render({
      message: msg({ parts: [{ type: 'text', text: 'partial' }], status: 'error' }),
      onRetry
    });
    expect(document.body.textContent).toContain('Something went wrong');
    const retry = screen.getByRole('button', { name: /Retry/ });
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders an aborted Alert with the stopped label', () => {
    render({ message: msg({ parts: [{ type: 'text', text: 'partial' }], status: 'aborted' }) });
    expect(document.body.textContent).toContain('Generation stopped');
  });

  it('renders a streaming placeholder when there are no parts yet', () => {
    render({ message: msg({ parts: [], status: 'streaming' }) });
    // Skeleton line stands in for the not-yet-arrived text.
    expect(document.querySelector('.animate-pulse, [class*="skeleton"]')).not.toBeNull();
  });

  it('copies the concatenated text parts to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render({
      message: msg({
        parts: [
          { type: 'text', text: 'First.' },
          { type: 'source', id: 'a', title: 'src', url: 'https://example.com' },
          { type: 'text', text: 'Second.' }
        ]
      })
    });
    screen.getByRole('button', { name: 'Copy' }).click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    // Only text parts, joined — sources are not part of the copied payload.
    expect(writeText).toHaveBeenCalledWith('First.\n\nSecond.');
  });

  it('only renders a regenerate action when onRegenerate is provided', () => {
    render({ message: msg({ parts: [{ type: 'text', text: 'x' }] }) });
    expect(screen.queryByRole('button', { name: 'Regenerate' })).toBeNull();
    document.body.replaceChildren();
    dispose?.();
    render({ message: msg({ parts: [{ type: 'text', text: 'x' }] }), onRegenerate: () => {} });
    expect(screen.getByRole('button', { name: 'Regenerate' })).not.toBeNull();
  });

  it('lets a partRenderers override replace the default text rendering', () => {
    const text = createRawSnippet<[{ text: string }]>((part) => ({
      render: () => `<div data-custom>${part().text}</div>`
    }));
    render({
      message: msg({ parts: [{ type: 'text', text: 'A **bold** claim.' }] }),
      partRenderers: { text }
    });
    expect(document.querySelector('[data-custom]')?.textContent).toBe('A **bold** claim.');
    // The default StreamingMarkdown path did not run.
    expect(document.querySelector('strong')).toBeNull();
  });

  it('renders createdAt as a <time> element, and nothing when absent', () => {
    const when = new Date('2026-07-23T09:41:00Z');
    render({ message: msg({ parts: [{ type: 'text', text: 'x' }], createdAt: when }) });
    const time = document.querySelector('time');
    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe(when.toISOString());
    document.body.replaceChildren();
    dispose?.();
    render({ message: msg({ parts: [{ type: 'text', text: 'x' }] }) });
    expect(document.querySelector('time')).toBeNull();
  });
});

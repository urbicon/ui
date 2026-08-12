// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatToolCallPart } from '../chat.types';
import type { ToolCallCardProps } from './index';
import ToolCallCard from './ToolCallCard.svelte';

// DOM/interaction tests for the tool-call renderer. ToolCallCard composes the
// Collapsible primitive; its content stays in the DOM even when collapsed, so
// body assertions don't require expanding first. Mounting uses Svelte's own
// `mount`/`unmount` (not @testing-library/svelte) so svelte-check sees a single
// `Snippet` type. Reactive-prop tests use a `$state` object mutated inside
// `flushSync` — never spread it (spreading severs the proxy).

type State = ChatToolCallPart['state'];

function part(state: State, extra: Partial<ChatToolCallPart> = {}): ChatToolCallPart {
  return { type: 'tool-call', id: 't1', name: 'search_web', state, ...extra };
}

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: ToolCallCardProps) {
  const instance = mount(ToolCallCard, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

// The header button is the only one carrying aria-expanded (CodeBlock's copy
// button does not), so it uniquely identifies the trigger.
function getTrigger(): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!el) throw new Error('trigger not rendered');
  return el;
}

function srStatus(): string {
  return getTrigger().querySelector('.sr-only')?.textContent?.trim() ?? '';
}

function hasSpinner(): boolean {
  return document.querySelector('.animate-spin') !== null;
}

// Finds an aria-hidden element inside the trigger whose text is the label — the
// visual status Badge (the spinner wrapper is aria-hidden but has empty text).
function hasBadgeLabel(label: string): boolean {
  return Array.from(getTrigger().querySelectorAll('[aria-hidden="true"]')).some(
    (el) => el.textContent?.trim() === label
  );
}

// How often the label appears in the header for a sighted reader AND for
// assistive tech — the accessible name is built from the same nodes, so a
// duplicate here is a status announced twice.
function labelOccurrences(label: string): number {
  return (getTrigger().textContent?.split(label).length ?? 1) - 1;
}

describe('ToolCallCard — quiet header (default)', () => {
  it('states the status as visible text, not as a badge', () => {
    render({ toolCall: part('complete') });
    expect(hasBadgeLabel('Done')).toBe(false);
    expect(getTrigger().textContent).toContain('Done');
  });

  it('carries the status exactly once (no sr-only duplicate of the visible text)', () => {
    render({ toolCall: part('complete') });
    expect(srStatus()).toBe('');
    expect(labelOccurrences('Done')).toBe(1);
  });

  it('shows a spinner beside the status while running', () => {
    render({ toolCall: part('running') });
    expect(hasSpinner()).toBe(true);
    expect(getTrigger().textContent).toContain('Running');
  });

  it('shows no spinner once the call is complete', () => {
    render({ toolCall: part('complete') });
    expect(hasSpinner()).toBe(false);
  });

  it('draws no frame of its own — the row sits in the message flow', () => {
    render({ toolCall: part('complete') });
    const root = getTrigger().closest('[data-state]');
    expect(root, 'collapsible root').not.toBeNull();
    expect(root?.className, 'no outline').not.toMatch(/(^|\s)border(-|\s|$)/);
    expect(root?.className, 'no shadow').not.toMatch(/\bshadow-/);
    expect(root?.className, 'no radius').not.toMatch(/\brounded-/);
  });

  it('honors custom status labels', () => {
    render({ toolCall: part('running'), runningLabel: 'Working…' });
    expect(getTrigger().textContent).toContain('Working…');
  });
});

describe('ToolCallCard — card header', () => {
  it('shows a spinner + sr status text + neutral badge while running', () => {
    render({ toolCall: part('running'), variant: 'card' });
    expect(hasSpinner()).toBe(true);
    expect(srStatus()).toBe('Running');
    expect(hasBadgeLabel('Running')).toBe(true);
  });

  it('shows a spinner + sr status text while pending', () => {
    render({ toolCall: part('pending'), variant: 'card' });
    expect(hasSpinner()).toBe(true);
    expect(srStatus()).toBe('Pending');
    expect(hasBadgeLabel('Pending')).toBe(true);
  });

  it('shows no spinner and a done badge when complete', () => {
    render({ toolCall: part('complete'), variant: 'card' });
    expect(hasSpinner()).toBe(false);
    expect(srStatus()).toBe('Done');
    expect(hasBadgeLabel('Done')).toBe(true);
  });

  it('shows no spinner and a failed badge when in error', () => {
    render({ toolCall: part('error'), variant: 'card' });
    expect(hasSpinner()).toBe(false);
    expect(srStatus()).toBe('Failed');
    expect(hasBadgeLabel('Failed')).toBe(true);
  });

  it('honors custom status labels', () => {
    render({ toolCall: part('running'), variant: 'card', runningLabel: 'Working…' });
    expect(srStatus()).toBe('Working…');
    expect(hasBadgeLabel('Working…')).toBe(true);
  });

  /**
   * The header is a rectangle inside a rounded frame that does not clip, so its
   * hover fill has to carry the radius itself or it squares off the corners it
   * sits in (invisible at the 2px default `--radius-contain`, glaring in a
   * rounded theme). Collapsed the header IS the frame → all four corners; open
   * → only the top two, because the body continues the fill below.
   */
  it('rounds its hover fill with the frame', async () => {
    const user = userEvent.setup();
    render({ toolCall: part('complete'), variant: 'card' });

    expect(getTrigger().className).toMatch(/\brounded-contain\b/);

    await user.click(getTrigger());
    flushSync();
    expect(getTrigger().className).toMatch(/\brounded-t-contain\b/);
    expect(getTrigger().className).not.toMatch(/\brounded-contain\b/);
  });
});

describe('ToolCallCard — header', () => {
  it('renders the tool name in the header', () => {
    render({ toolCall: part('complete') });
    expect(getTrigger().textContent).toContain('search_web');
  });
});

describe('ToolCallCard — open state', () => {
  it('starts expanded when the call is already in error', () => {
    render({ toolCall: part('error', { errorMessage: 'boom' }) });
    expect(getTrigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('starts collapsed when the call is complete', () => {
    render({ toolCall: part('complete') });
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('auto-opens when the state transitions to error while mounted', () => {
    const props = $state<ToolCallCardProps>({ toolCall: part('running') });
    render(props);
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');

    flushSync(() => {
      props.toolCall = part('error', { errorMessage: 'boom' });
    });
    expect(getTrigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('does not auto-open after the user has manually toggled the card', async () => {
    const user = userEvent.setup();
    const props = $state<ToolCallCardProps>({ toolCall: part('running') });
    render(props);

    // Open then close — the manual toggle latches userToggled.
    await user.click(getTrigger());
    flushSync();
    expect(getTrigger().getAttribute('aria-expanded')).toBe('true');
    await user.click(getTrigger());
    flushSync();
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');

    flushSync(() => {
      props.toolCall = part('error', { errorMessage: 'boom' });
    });
    // Manual choice wins: the failed call does NOT force the card open.
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('fires onOpenChange on a manual toggle', async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    render({ toolCall: part('complete'), onOpenChange: (o) => seen.push(o) });

    await user.click(getTrigger());
    flushSync();
    expect(seen).toEqual([true]);
  });

  it('honors defaultOpen={false} for a call already failed at mount', () => {
    // The auto-open effect must only react to a TRANSITION to error — a call
    // mounted in error is the seed's business, and an explicit defaultOpen
    // wins there (review finding, P3 wave).
    render({ toolCall: part('error', { errorMessage: 'boom' }), defaultOpen: false });
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('fires onOpenChange when the error transition auto-opens the card', () => {
    // Auto-open runs through the same notification path as a manual toggle so
    // a controlled-without-bind consumer can mirror it (review finding).
    const seen: boolean[] = [];
    const props = $state<ToolCallCardProps>({
      toolCall: part('running'),
      onOpenChange: (o) => seen.push(o)
    });
    render(props);
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');

    flushSync(() => {
      props.toolCall = part('error', { errorMessage: 'boom' });
    });
    expect(getTrigger().getAttribute('aria-expanded')).toBe('true');
    expect(seen).toEqual([true]);
  });

  it('marks the collapsed content region inert (no tab stop on the hidden copy button)', () => {
    render({ toolCall: part('complete', { output: { ok: true } }) });
    // Svelte applies `inert` as a DOM property, so query structurally (the
    // Collapsible content region is labelled by the trigger) and assert the
    // property. Collapsed: the clipped CodeBlock copy button must be out of
    // the tab order and a11y tree (WCAG 2.4.3 — review finding, fixed in
    // Collapsible).
    const trigger = getTrigger();
    const region = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    expect(region).not.toBeNull();
    expect((region as HTMLElement).inert || region?.hasAttribute('inert')).toBe(true);
  });
});

describe('ToolCallCard — body', () => {
  it('renders input and output as JSON code blocks', () => {
    render({ toolCall: part('complete', { input: { query: 'svelte' }, output: { hits: 3 } }) });
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
    expect(document.body.textContent).toContain('"query": "svelte"');
    expect(document.body.textContent).toContain('"hits": 3');
  });

  /**
   * The card IS the frame. A bordered child card would draw a second outline at
   * the same radius inside the first — the stacked-chrome look that made one
   * JSON payload cost two header rows and three divider lines. Asserted on the
   * rendered DOM rather than on the CodeBlock variant prop, because what matters
   * is that nothing downstream reintroduces the frame.
   */
  it('embeds the payloads without stacking a second framed card inside the card', () => {
    render({ toolCall: part('complete', { input: { query: 'svelte' }, output: { hits: 3 } }) });

    const pres = [...document.querySelectorAll('pre')];
    expect(pres.length, 'both payloads rendered').toBe(2);

    for (const pre of pres) {
      const block = pre.parentElement!;
      expect(block.className, 'payload draws no outline').not.toMatch(/(^|\s)border(-|\s|$)/);
      expect(block.className, 'payload draws no radius').not.toMatch(/\brounded-/);
      expect(block.className, 'payload draws no surface').not.toMatch(/\bbg-surface-/);
    }

    // One caption per payload, not a section heading plus a language label.
    expect(screen.getAllByText('Input')).toHaveLength(1);
    expect(document.body.textContent, 'the redundant "json" caption is gone').not.toContain('json');
  });

  it('omits the input section when input is undefined', () => {
    render({ toolCall: part('complete', { output: { hits: 3 } }) });
    expect(screen.queryByText('Input')).toBeNull();
    expect(screen.getByText('Output')).toBeTruthy();
  });

  it('shows the error message above the sections', () => {
    render({ toolCall: part('error', { errorMessage: 'Rate limited', input: { q: 1 } }) });
    expect(screen.getByText('Rate limited')).toBeTruthy();
    expect(screen.getByText('Input')).toBeTruthy();
  });

  it('renders a children snippet in place of the default body', () => {
    const children = createRawSnippet<[ChatToolCallPart]>((call) => ({
      render: () => `<div data-testid="custom">custom: ${call().name}</div>`
    }));
    render({
      toolCall: part('error', { errorMessage: 'boom', input: { q: 1 } }),
      children
    });

    expect(screen.getByTestId('custom').textContent).toBe('custom: search_web');
    // children replaces the ENTIRE default body — no input section, no error line.
    expect(screen.queryByText('Input')).toBeNull();
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('falls back to String() for a non-serializable value instead of throwing', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // Should not throw during render.
    render({ toolCall: part('complete', { output: circular }) });
    expect(screen.getByText('Output')).toBeTruthy();
  });
});

describe('ToolCallCard — styling hooks', () => {
  it('applies slotClasses to the trigger', () => {
    render({ toolCall: part('complete'), slotClasses: { trigger: 'my-custom-trigger' } });
    expect(getTrigger().classList.contains('my-custom-trigger')).toBe(true);
  });
});

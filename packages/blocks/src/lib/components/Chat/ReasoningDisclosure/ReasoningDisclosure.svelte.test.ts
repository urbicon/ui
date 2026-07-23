// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReasoningDisclosureProps } from './index';
import ReasoningDisclosure from './ReasoningDisclosure.svelte';

// DOM/interaction tests for the reasoning disclosure. It composes the
// Collapsible primitive and StreamingMarkdown; the collapsed panel stays in the
// DOM (grid 0fr) in jsdom, so open/closed is asserted via the trigger's
// `aria-expanded` and the base `data-state`, not visibility. Mounting uses
// Svelte's own `mount`/`unmount` (not @testing-library/svelte).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: ReasoningDisclosureProps) {
  const instance = mount(ReasoningDisclosure, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('ReasoningDisclosure', () => {
  it('shows the thinking label with a pulse while streaming', () => {
    render({ reasoning: { type: 'reasoning', text: 'Considering options' }, streaming: true });

    const label = screen.getByText('Thinking');
    expect(label.classList.contains('animate-pulse')).toBe(true);
    expect(label.classList.contains('motion-reduce:animate-none')).toBe(true);
  });

  it('shows a "Thought for Xs" label once settled with a duration', () => {
    render({ reasoning: { type: 'reasoning', text: 'Done', durationMs: 2400 } });
    expect(screen.getByText('Thought for 2s')).toBeTruthy();
  });

  it('shows the reasoning label once settled without a duration', () => {
    render({ reasoning: { type: 'reasoning', text: 'Done' } });
    expect(screen.getByText('Reasoning')).toBeTruthy();
  });

  it('honors a formatDuration override', () => {
    render({
      reasoning: { type: 'reasoning', text: 'Done', durationMs: 2400 },
      formatDuration: (s) => `${s} seconds elapsed`
    });
    expect(screen.getByText('2 seconds elapsed')).toBeTruthy();
  });

  it('is collapsed by default and expands on toggle', async () => {
    const user = userEvent.setup();
    render({ reasoning: { type: 'reasoning', text: 'Some reasoning' } });

    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);
    flushSync();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('stays collapsed by default even while streaming', () => {
    render({ reasoning: { type: 'reasoning', text: 'Growing…' }, streaming: true });
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the reasoning text as markdown', () => {
    render({ reasoning: { type: 'reasoning', text: 'This is **bold** reasoning' } });
    const strong = screen.getByText('bold');
    expect(strong.tagName).toBe('STRONG');
  });

  it('applies slotClasses to the trigger', () => {
    render({
      reasoning: { type: 'reasoning', text: 'x' },
      slotClasses: { trigger: 'my-custom-trigger' }
    });
    expect(screen.getByRole('button').classList.contains('my-custom-trigger')).toBe(true);
  });
});

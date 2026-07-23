// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CitationChip from './CitationChip.svelte';
import type { CitationChipProps, CitationSource } from './index';

// DOM/interaction tests for the citation marker. CitationChip composes the
// Popover primitive; the popover panel renders in a native popover, which jsdom
// keeps in the DOM but reads as "hidden" to accessibility queries (no top
// layer). So role queries into the panel pass `{ hidden: true }`, mirroring the
// Combobox reference test. Mounting uses Svelte's own `mount`/`unmount` (not
// @testing-library/svelte) so svelte-check sees a single `Snippet` type.

const SOURCE: CitationSource = {
  id: 'src-1',
  title: 'The Pragmatic Programmer',
  url: 'https://example.com/book',
  snippet: 'A classic on software craftsmanship.'
};

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: CitationChipProps) {
  const instance = mount(CitationChip, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

async function openPopover(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole('button');
  await user.click(trigger);
  flushSync();
  return trigger;
}

describe('CitationChip', () => {
  it('opens the popover on click and shows the source title', async () => {
    const user = userEvent.setup();
    render({ source: SOURCE, index: 1 });

    // Title lives only inside the (closed) popover content, not the numeric chip.
    expect(screen.queryByText(SOURCE.title)).toBeNull();

    await openPopover(user);

    expect(screen.getByText(SOURCE.title)).toBeTruthy();
    expect(screen.getByText(SOURCE.snippet as string)).toBeTruthy();
  });

  it('numeric style shows the index as the chip label', () => {
    render({ source: SOURCE, index: 3, citationStyle: 'numeric' });
    expect(screen.getByRole('button').textContent?.trim()).toBe('3');
  });

  it('numeric style falls back to the source id when no index is given', () => {
    render({ source: SOURCE, citationStyle: 'numeric' });
    expect(screen.getByRole('button').textContent?.trim()).toBe(SOURCE.id);
  });

  it('label style shows the source title as the chip label', () => {
    render({ source: SOURCE, index: 1, citationStyle: 'label' });
    expect(screen.getByRole('button').textContent?.trim()).toBe(SOURCE.title);
  });

  it('renders an https link with target/rel in the popover', async () => {
    const user = userEvent.setup();
    render({ source: SOURCE, index: 1, openLabel: 'Read more' });

    await openPopover(user);

    const link = screen.getByRole('link', { name: /Read more/, hidden: true });
    expect(link.getAttribute('href')).toBe('https://example.com/book');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('blocks a javascript: URL — no link is rendered', async () => {
    const user = userEvent.setup();
    render({
      source: { id: 'x', title: 'Evil', url: 'javascript:alert(1)' },
      index: 1
    });

    await openPopover(user);

    // Title still shows; the blocked URL yields no anchor.
    expect(screen.getByText('Evil')).toBeTruthy();
    expect(screen.queryByRole('link', { hidden: true })).toBeNull();
  });

  it('renders no link when the source has no url', async () => {
    const user = userEvent.setup();
    render({ source: { id: 'x', title: 'No link source' }, index: 1 });

    await openPopover(user);

    expect(screen.getByText('No link source')).toBeTruthy();
    expect(screen.queryByRole('link', { hidden: true })).toBeNull();
  });

  it('derives the trigger aria-label from index + title by default', () => {
    render({ source: SOURCE, index: 2 });
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'Source 2: The Pragmatic Programmer'
    );
  });

  it('omits the index from the aria-label when none is given', () => {
    render({ source: SOURCE });
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'Source: The Pragmatic Programmer'
    );
  });

  it('honors an explicit label override for the aria-label', () => {
    render({ source: SOURCE, index: 2, label: 'Citation two' });
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Citation two');
  });

  it('applies slotClasses to the trigger', () => {
    render({ source: SOURCE, index: 1, slotClasses: { trigger: 'my-custom-trigger' } });
    expect(screen.getByRole('button').classList.contains('my-custom-trigger')).toBe(true);
  });
});

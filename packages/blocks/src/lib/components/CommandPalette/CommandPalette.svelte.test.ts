// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SearchIcon from '$lib/icons/SearchIcon.svelte';
import CommandPalette from './CommandPalette.svelte';
import type { CommandPaletteItem, CommandPaletteProps } from './index';

// Item rendering for CommandPalette, which until now had only a variants test.
// The `icon` field used to be SVG *path data* that the component inlined into
// its own `<svg>` — foreign geometry in a library with a full icon set of its own and
// a written geometry contract (hero-review point 25b / S6). It is a component
// now, and this is the DOM guard for that: a variants test cannot tell whether
// the item's icon reaches an element.
//
// The palette renders inside a native popover/dialog, which jsdom has no top
// layer for — queries pass `{ hidden: true }` and assert structure, not
// visibility (that is Playwright's job).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<CommandPaletteProps> = {}) {
  const instance = mount(CommandPalette, {
    target: document.body,
    props: { open: true, shortcut: false, ...props } as CommandPaletteProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const withIcon: CommandPaletteItem[] = [
  { label: 'Search files', category: 'Edit', icon: SearchIcon },
  { label: 'No icon here', category: 'Edit' }
];

describe('CommandPalette (item icons)', () => {
  it('renders an item icon as a component', async () => {
    render({ items: withIcon });
    await tick();

    const option = screen.getByRole('option', { name: /Search files/, hidden: true });
    const svg = option.querySelector('svg');
    expect(svg).not.toBeNull();
    // The slot's own sizing reaches the component through its `class` prop —
    // the icon is not left at its intrinsic 24px.
    expect(svg?.getAttribute('class')).toContain('h-4');
  });

  it('renders no icon element for an item without one', async () => {
    render({ items: withIcon });
    await tick();

    // Negative half: without it, a rule that always renders an icon would pass
    // the assertion above and still be wrong.
    const option = screen.getByRole('option', { name: /No icon here/, hidden: true });
    expect(option.querySelector('svg')).toBeNull();
  });
});

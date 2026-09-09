// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from './__fixtures__/SidebarLayoutToggleHarness.svelte';

/**
 * The `toggle` snippet: what the layout hands it, where it renders it, and
 * what pressing it does.
 *
 * The layout renders one snippet at two seams — the desktop rail and the
 * mobile header — and both are in the document at once, hidden from each other
 * only by CSS. So the pair of ids is the thing worth asserting: a shared
 * `triggerId` would put a duplicate id in every collapsible app shell, which no
 * viewport can reveal because the DOM is the same at every width.
 */

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(Harness, {
    target,
    props: { mode: 'collapsible', ...props } as never
  });
  flushSync();
  dispose = () => unmount(app);
  return target;
}

const triggers = (target: HTMLElement) =>
  [...target.querySelectorAll('button')].filter((b) => b.hasAttribute('aria-expanded'));

describe('SidebarLayout toggle snippet', () => {
  it('renders both seams with distinct ids pointing at the one sidebar panel', () => {
    const target = render();
    const found = triggers(target);
    expect(found).toHaveLength(2);

    const ids = found.map((b) => b.id);
    expect(new Set(ids).size, `two triggers share the DOM id ${ids[0]}`).toBe(2);
    expect(ids.some((id) => id.endsWith('-rail-toggle'))).toBe(true);
    expect(ids.some((id) => id.endsWith('-header-toggle'))).toBe(true);

    const panel = target.querySelector('aside');
    expect(panel?.id).toBeTruthy();
    for (const trigger of found) {
      expect(trigger.getAttribute('aria-controls')).toBe(panel?.id);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('flips open and reports it, from either seam', () => {
    const onOpenChange = vi.fn();
    const target = render({ onOpenChange });
    const [rail, header] = triggers(target);

    rail.click();
    flushSync();
    expect(triggers(target).map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true']);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    header.click();
    flushSync();
    expect(triggers(target).map((b) => b.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false'
    ]);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('writes the new state through bind:open before reporting it', () => {
    const seen: boolean[] = [];
    const props = $state({
      mode: 'collapsible' as const,
      open: false,
      onOpenChange: (next: boolean) => seen.push(props.open === next)
    });
    const target = document.createElement('div');
    document.body.appendChild(target);
    const app = mount(Harness, { target, props: props as never });
    flushSync();
    dispose = () => unmount(app);

    triggers(target)[0].click();
    flushSync();
    expect(props.open).toBe(true);
    expect(seen, 'onOpenChange fired before the bindable write reached the parent').toEqual([true]);
  });

  it('reserves the content strip the floating grip sits in', () => {
    // The grip is `fixed`, so without the reservation it paints over whatever
    // the content column puts in its leading strip — measured at 1200px: a
    // collapsed rail put the 40px grip at x 8–48 over a heading starting at 32.
    const root = render().querySelector<HTMLElement>('[data-mode]');
    expect(root?.style.getPropertyValue('--sidebar-toggle-gutter')).toBe('3rem');
  });

  it('reserves nothing where no grip renders', () => {
    const root = render({ withToggle: false }).querySelector<HTMLElement>('[data-mode]');
    expect(root?.style.getPropertyValue('--sidebar-toggle-gutter')).toBe('');
  });

  it('reserves nothing in responsive mode, where the rail carries no grip', () => {
    const root = render({ mode: 'responsive' }).querySelector<HTMLElement>('[data-mode]');
    expect(root?.style.getPropertyValue('--sidebar-toggle-gutter')).toBe('');
  });

  it('keeps only the header seam in responsive mode — a permanent rail has nothing to toggle', () => {
    const target = render({ mode: 'responsive' });
    const found = triggers(target);
    expect(found).toHaveLength(1);
    expect(found[0].id.endsWith('-header-toggle')).toBe(true);
  });

  it('grows the mobileHeader context by toggle, without dropping openSidebar', () => {
    const target = render({ withToggle: false, withMobileHeader: true });
    const contextButton = target.querySelector<HTMLButtonElement>('[data-testid="context-toggle"]');
    expect(contextButton).not.toBeNull();

    contextButton?.click();
    flushSync();
    expect(target.querySelector('aside')?.dataset.state).toBe('open');
    contextButton?.click();
    flushSync();
    expect(target.querySelector('aside')?.dataset.state).toBe('closed');
  });

  it('leaves the layout untouched without the snippet — no header, no panel id', () => {
    const target = render({ withToggle: false });
    expect(triggers(target)).toHaveLength(0);
    expect(target.querySelector('header')).toBeNull();
    // The id exists for `aria-controls` to point at; nothing else needs it, so
    // a layout without the snippet renders exactly the markup it always did.
    expect(target.querySelector('aside')?.hasAttribute('id')).toBe(false);
  });
});

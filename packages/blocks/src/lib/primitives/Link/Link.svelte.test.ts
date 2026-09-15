// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentDefaults, ComponentPreset } from '$lib/provider/blocks-context';
import LinkProviderHost from './__fixtures__/LinkProviderHost.svelte';
import type { LinkProps } from './index';
import Link from './Link.svelte';

// Render layer for Link: the anchor it always emits, the two ARIA states
// (`aria-current`, `aria-disabled`) including who wins when a consumer spells
// one out, and the four styling escape hatches reaching the element.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const label = createRawSnippet(() => ({ render: () => '<span>Settings</span>' }));

function render(props: Partial<LinkProps> = {}) {
  const instance = mount(Link, {
    target: document.body,
    props: { href: '/settings', children: label, ...props } as LinkProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

interface ProviderConfig {
  defaults?: Record<string, ComponentDefaults>;
  presets?: Record<string, Record<string, ComponentPreset>>;
}

function renderInProvider(props: Partial<LinkProps>, config: ProviderConfig = {}) {
  const instance = mount(LinkProviderHost, {
    target: document.body,
    props: { ...config, props: { href: '/settings', children: label, ...props } as LinkProps }
  });
  dispose = () => unmount(instance);
  flushSync();
}

const anchor = () => document.querySelector('a') as HTMLAnchorElement;

describe('Link', () => {
  it('always renders an <a> carrying the href it was given', () => {
    render({ href: '/projects/1' });
    expect(anchor()).not.toBeNull();
    expect(anchor().getAttribute('href')).toBe('/projects/1');
    expect(anchor().textContent).toBe('Settings');
  });

  it('marks the active link as the current page', () => {
    render({ active: true });
    expect(anchor().getAttribute('aria-current')).toBe('page');
  });

  it('carries no aria-current when it is not active', () => {
    render();
    expect(anchor().getAttribute('aria-current')).toBeNull();
  });

  it('keeps a consumer-spelled aria-current reachable — step is not a page', () => {
    render({ 'aria-current': 'step' });
    expect(anchor().getAttribute('aria-current')).toBe('step');
  });

  it('lets active win when both it and an aria-current are given', () => {
    // `active` is the shorthand for the page case, so it is the more specific
    // statement of the two; the other values are reached by leaving it unset.
    render({ active: true, 'aria-current': 'step' });
    expect(anchor().getAttribute('aria-current')).toBe('page');
  });

  it('takes a disabled link out of the tab order while keeping its address', () => {
    render({ disabled: true });
    expect(anchor().getAttribute('aria-disabled')).toBe('true');
    expect(anchor().getAttribute('tabindex')).toBe('-1');
    // A disabled link is inert, not addressless — the href stays readable and copyable.
    expect(anchor().getAttribute('href')).toBe('/settings');
    expect(anchor().className).toContain('pointer-events-none');
  });

  it('adds no tabindex and no aria-disabled when it is not disabled', () => {
    render();
    expect(anchor().getAttribute('aria-disabled')).toBeNull();
    expect(anchor().getAttribute('tabindex')).toBeNull();
  });

  it('cancels the navigation of a disabled link that is clicked anyway', () => {
    // `pointer-events-none` only stops hit testing. Assistive-technology
    // activation goes through `element.click()`, which reaches the anchor
    // whatever CSS says, so the guard has to be in the handler.
    const onclick = vi.fn();
    render({ disabled: true, onclick });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onclick).not.toHaveBeenCalled();
  });

  it('cancels a disabled link activated by Enter from the keyboard', async () => {
    const onclick = vi.fn();
    render({ disabled: true, onclick });

    anchor().focus();
    await userEvent.keyboard('{Enter}');

    expect(onclick).not.toHaveBeenCalled();
  });

  it("runs the consumer's onclick on an enabled link and lets it navigate", () => {
    const onclick = vi.fn();
    render({ onclick });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor().dispatchEvent(event);

    expect(onclick).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves a consumer's own preventDefault standing on an enabled link", () => {
    render({ onclick: (fromConsumer: MouseEvent) => fromConsumer.preventDefault() });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('passes target and rel through to the anchor', () => {
    render({ target: '_blank', rel: 'noopener noreferrer' });
    expect(anchor().getAttribute('target')).toBe('_blank');
    expect(anchor().getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('strips the library classes when unstyled', () => {
    render({ unstyled: true });
    expect(anchor().className).not.toContain('underline');
    expect(anchor().className).not.toContain('rounded-modify');
  });

  it('merges a consumer class onto the anchor', () => {
    render({ class: 'my-link' });
    expect(anchor().className).toContain('my-link');
  });

  it("lets a tab strip's own class repaint the active handle", () => {
    // The shape the tab-navigation pattern renders: the strip's chrome travels
    // through `class` and has to win the colour the `active` axis writes.
    render({
      variant: 'standalone',
      active: true,
      class: 'border-b-2 border-primary text-primary-text'
    });
    expect(anchor().className).toContain('text-primary-text');
    expect(anchor().className).not.toContain('text-text-primary');
    expect(anchor().className).not.toMatch(/\bhover:text-/);
  });

  it('merges slotClasses.base onto the anchor', () => {
    render({ slotClasses: { base: 'slot-link' } });
    expect(anchor().className).toContain('slot-link');
  });

  it('applies a provider preset by name', () => {
    renderInProvider(
      { preset: 'quiet' },
      { presets: { Link: { quiet: { slotClasses: { base: 'preset-link' } } } } }
    );
    expect(anchor().className).toContain('preset-link');
  });

  it('applies provider defaults to every link', () => {
    renderInProvider({}, { defaults: { Link: { slotClasses: { base: 'default-link' } } } });
    expect(anchor().className).toContain('default-link');
  });

  it('fires a provider override keyed on the active state only when active', () => {
    const defaults = {
      Link: { overrides: [{ active: true, class: { base: 'current-link' } }] }
    };
    renderInProvider({ active: true }, { defaults });
    expect(anchor().className).toContain('current-link');

    dispose?.();
    document.body.replaceChildren();

    renderInProvider({}, { defaults });
    expect(anchor().className).not.toContain('current-link');
  });
});

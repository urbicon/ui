// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Badge from './Badge.svelte';
import type { BadgeProps } from './index';

// The `purpose` axis (BDG-1) is orchestrated in the component (it maps to the
// existing tv() visual props), so it needs a mounted DOM to observe, not a
// variant-config test. Also guards back-compat: the deprecated `variant="dot"`
// and `counter` boolean must keep working when `purpose` is unset.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const label = (t = 'Badge') => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

function render(props: Partial<BadgeProps> = {}) {
  const instance = mount(Badge, {
    target: document.body,
    props: { children: label(), ...props } as BadgeProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const badge = () => screen.getByRole('status');

describe('Badge — purpose axis (BDG-1)', () => {
  it('reflects purpose on data-purpose', () => {
    render({ purpose: 'status', intent: 'success' });
    expect(badge().getAttribute('data-purpose')).toBe('status');
  });

  it('purpose="dot" hides content and applies dot styling, overriding variant', () => {
    render({ purpose: 'dot', variant: 'filled', children: label('hidden') });
    const el = badge();
    expect(el.className).toContain('border-none'); // dot-only base class
    expect(el.textContent).not.toContain('hidden'); // dot renders no content span
  });

  it('purpose="counter" applies the numeric-pill styling', () => {
    render({ purpose: 'counter', children: label('5') });
    expect(badge().className).toContain('tabular-nums');
  });

  it('purpose="chip" makes the badge interactive (focusable)', () => {
    render({ purpose: 'chip', children: label('React') });
    expect(badge().getAttribute('tabindex')).toBe('0');
  });

  it('back-compat: variant="dot" still renders a dot without purpose', () => {
    render({ variant: 'dot' });
    expect(badge().className).toContain('border-none');
  });

  it('back-compat: the counter boolean still applies the pill styling', () => {
    render({ counter: true, children: label('9') });
    expect(badge().className).toContain('tabular-nums');
  });
});

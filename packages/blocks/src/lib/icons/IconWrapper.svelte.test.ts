// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { IconProps } from './icon-types';
import LogOutIcon from './LogOutIcon.svelte';

// The `width`/`height` the wrapper puts on its `<svg>`. An svg carrying a
// `viewBox` and no dimensions has no intrinsic size, so its used size is
// whatever its layout context happens to hand it — 0 in an inline-flex parent,
// the container's width in a block one. Only the attributes are asserted here;
// what each of those attribute values renders as is measured in the browser,
// not in jsdom, which resolves no layout.
//
// LogOutIcon is the subject because IconWrapper is never mounted directly by a
// consumer: every icon is a wrapper-over-wrapper like this one.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderIcon(props: IconProps = {}): SVGSVGElement {
  const instance = mount(LogOutIcon, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  const svg = document.body.querySelector('svg');
  if (!svg) throw new Error('icon rendered no <svg>');
  return svg;
}

describe('IconWrapper sizing', () => {
  it('falls back to 1em when no size is passed', () => {
    const svg = renderIcon();
    expect(svg.getAttribute('width')).toBe('1em');
    expect(svg.getAttribute('height')).toBe('1em');
  });

  it('uses a passed size', () => {
    const svg = renderIcon({ size: 16 });
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
  });

  it('keeps size={0} rather than treating it as absent', () => {
    const svg = renderIcon({ size: 0 });
    expect(svg.getAttribute('width')).toBe('0');
    expect(svg.getAttribute('height')).toBe('0');
  });

  // classList, not the whole attribute: IconWrapper has a <style> block, so
  // Svelte appends its own scoping class and the attribute carries a hash.
  it('still passes class through', () => {
    const svg = renderIcon({ class: 'size-4 text-danger' });
    expect(svg.classList.contains('size-4')).toBe(true);
    expect(svg.classList.contains('text-danger')).toBe(true);
    expect(svg.getAttribute('width')).toBe('1em');
  });
});

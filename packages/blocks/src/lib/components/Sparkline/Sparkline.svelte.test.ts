// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Sparkline from './Sparkline.svelte';

// The fluid-vs-fixed sizing contract the variant/type checks can't see. By
// default the <svg> carries fixed pixel width/height attributes and the wrapper
// shrink-wraps inline — byte-identical for existing consumers. With `fluid`
// those attributes drop so the svg fills its container width (viewBox +
// preserveAspectRatio keep it scaling) and the stroked line gains
// vector-effect="non-scaling-stroke" so it stays crisp under the non-uniform
// scale. Repo stack: svelte's own mount/unmount, native matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: ComponentProps<typeof Sparkline>) {
  const instance = mount(Sparkline, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Sparkline (sizing contract)', () => {
  it('keeps fixed pixel width/height attributes by default (unchanged output)', () => {
    render({ data: [1, 4, 2, 8, 5] });
    const svg = document.querySelector('svg')!;

    expect(svg.getAttribute('width')).toBe('96');
    expect(svg.getAttribute('height')).toBe('24');
    // viewBox is always present so it *can* scale, but no responsive class in fixed mode.
    expect(svg.getAttribute('viewBox')).toBe('0 0 96 24');
    expect(svg.getAttribute('class') ?? '').not.toContain('w-full');
    // Wrapper shrink-wraps inline, as before.
    expect(svg.parentElement?.getAttribute('class')).toContain('inline-block');
    // No vector-effect on the line in fixed mode — a strict no-op at 1:1, so omitted.
    const line = document.querySelector('path[stroke-linecap="round"]')!;
    expect(line.getAttribute('vector-effect')).toBeNull();
  });

  it('honours a custom fixed width/height', () => {
    render({ data: [1, 2, 3], width: 200, height: 40 });
    const svg = document.querySelector('svg')!;

    expect(svg.getAttribute('width')).toBe('200');
    expect(svg.getAttribute('height')).toBe('40');
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 40');
  });

  it('drops the fixed pixel attributes and fills its container when fluid', () => {
    render({ data: [1, 4, 2, 8, 5], width: 460, fluid: true });
    const svg = document.querySelector('svg')!;

    // The px width/height attributes are gone — CSS drives the size now.
    expect(svg.getAttribute('width')).toBeNull();
    expect(svg.getAttribute('height')).toBeNull();
    // Responsive sizing class + preserved viewBox/preserveAspectRatio keep it scaling.
    expect(svg.getAttribute('class') ?? '').toContain('w-full');
    expect(svg.getAttribute('viewBox')).toBe('0 0 460 24');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    // Wrapper becomes a full-width block instead of shrink-wrapping.
    const root = svg.parentElement!;
    expect(root.getAttribute('class')).toContain('w-full');
    expect(root.getAttribute('class')).not.toContain('inline-block');
    // The stroked line keeps a constant width under the non-uniform scale.
    const line = document.querySelector('path[stroke-linecap="round"]')!;
    expect(line.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  });
});

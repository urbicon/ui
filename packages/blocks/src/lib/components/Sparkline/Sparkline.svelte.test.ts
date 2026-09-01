// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentDefaults, PresetMap } from '$lib/provider/blocks-context';
import SparklineProviderHost from './__fixtures__/SparklineProviderHost.svelte';
import type { SparklineProps } from './index';
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

/**
 * Which consumer surfaces does the DEV rename warning actually reach?
 *
 * Four places can carry a slot key and only one of them is typed: an instance
 * `slotClasses` object literal is a compile error on `line` / `point` — which
 * is why every stale case below needs a cast to be written at all — while
 * `ComponentDefaults['slotClasses']`, `ComponentPreset['slotClasses']` and
 * `ConditionalOverride['class']` are each `Record<string, string>` and take a
 * stale key in silence. The warning is therefore read off the *resolved* map,
 * downstream of all four, and that is the claim measured here: one mount per
 * surface. A surface not asserted below is not covered by the warning either.
 *
 * The two quiet cases are the control. Without them a warning that fired on
 * every mount would satisfy all four.
 */
describe('Sparkline (DEV warning for the v9 slot rename)', () => {
  const STALE = /slotClasses\.(line|point) no longer resolves/;

  function renderHost(props: {
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    props?: SparklineProps;
  }) {
    const instance = mount(SparklineProviderHost, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
  }

  /** The instance surface, cast because the compiler is what rejects it there. */
  function renderStale(slotClasses: Record<string, string>) {
    render({ data: [1, 4, 2], slotClasses } as unknown as ComponentProps<typeof Sparkline>);
  }

  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('reports a stale key on the instance prop', () => {
    renderStale({ line: 'opacity-70' });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(STALE));
  });

  it('reports a stale key in BlocksProvider defaults', () => {
    renderHost({ defaults: { Sparkline: { slotClasses: { point: 'stroke-2' } } } });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(STALE));
  });

  it('reports a stale key in a BlocksProvider preset', () => {
    renderHost({
      presets: { Sparkline: { legacy: { slotClasses: { line: 'opacity-70' } } } },
      props: { data: [1, 4, 2], preset: 'legacy' }
    });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(STALE));
  });

  it('reports a stale key in a prop-conditional override', () => {
    renderHost({
      defaults: { Sparkline: { overrides: [{ fluid: true, class: { line: 'opacity-70' } }] } },
      props: { data: [1, 4, 2], fluid: true }
    });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(STALE));
  });

  it('names both keys when both are stale', () => {
    renderStale({ line: 'a', point: 'b' });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('slotClasses.line and slotClasses.point')
    );
  });

  it('stays quiet on the current names at the instance', () => {
    render({ data: [1, 4, 2], slotClasses: { mark: 'opacity-70', endPoint: 'stroke-2' } });
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet on the current names under a provider', () => {
    renderHost({ defaults: { Sparkline: { slotClasses: { mark: 'opacity-70' } } } });
    expect(warn).not.toHaveBeenCalled();
  });
});

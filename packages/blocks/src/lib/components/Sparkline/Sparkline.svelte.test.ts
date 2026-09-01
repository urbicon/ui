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
 * How many elements does each slot key reach?
 *
 * This is the measurement the `endPoint`-instead-of-`point` naming rests on,
 * and no other test in the repo makes it: `slot-reach.svelte.test.ts` collects
 * its probes into a Set, so one circle and the charts' thirty-six are the same
 * result there. Counted through `slotClasses` rather than by tag, because "one
 * circle is rendered" is not the claim — "an entry under this key lands on one
 * element" is.
 */
describe('Sparkline (slot cardinality)', () => {
  it('reaches exactly one element per slot, in the state that paints them all', () => {
    render({
      data: [1, 4, 2, 8, 5],
      area: true,
      showEndPoint: true,
      slotClasses: { mark: 'probe-mark', area: 'probe-area', endPoint: 'probe-end' }
    });

    // One series, so one stroked path and one band; one marker, at the last
    // value. `<LineChart>` under `showPoints` paints one `point` per series AND
    // datum — the asymmetry the two names exist to keep visible.
    expect(document.querySelectorAll('.probe-mark')).toHaveLength(1);
    expect(document.querySelectorAll('.probe-area')).toHaveLength(1);
    expect(document.querySelectorAll('.probe-end')).toHaveLength(1);
  });
});

/**
 * Which consumer surfaces does the DEV rename warning actually reach?
 *
 * `resolveSlotClasses` folds five sources, and only one of them is typed: an
 * instance `slotClasses` object literal is a compile error on `line` / `point`
 * — which is why every stale case below needs a cast to be written at all —
 * while `ComponentDefaults['slotClasses']`, `ComponentPreset['slotClasses']`
 * and `ConditionalOverride['class']` are each `Record<string, string>` and take
 * a stale key in silence.
 *
 * The warning is therefore read off the *resolved* map, once, downstream of all
 * five. That makes the coverage **structural rather than per-source**: it holds
 * for whatever `resolveSlotClasses` folds in, including a source added later
 * and never listed here. The cases below are the evidence for that, one per
 * source, not the definition of it.
 *
 * The two quiet cases are the control. Without them a warning that fired on
 * every mount would satisfy all five.
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

  it('reports a stale key in a prop-conditional override on the defaults', () => {
    renderHost({
      defaults: { Sparkline: { overrides: [{ fluid: true, class: { line: 'opacity-70' } }] } },
      props: { data: [1, 4, 2], fluid: true }
    });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(STALE));
  });

  it('reports a stale key in a prop-conditional override on a preset', () => {
    renderHost({
      presets: {
        Sparkline: { legacy: { overrides: [{ fluid: true, class: { point: 'stroke-2' } }] } }
      },
      props: { data: [1, 4, 2], fluid: true, preset: 'legacy' }
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

  // The blind spot, pinned because MIGRATION.md states it as behaviour: the
  // check reads the RESOLVED map, so a stale key inside an `overrides` rule is
  // only visible when that rule matches. A rule whose condition is never true
  // carries its key silently — it styles nothing either, so nothing is lost,
  // but the warning answers "a stale key is reaching this sparkline", not
  // "your config has no stale keys".
  it('stays quiet on a stale key in an override that never matches', () => {
    renderHost({
      // `fluid` is Sparkline's only axis, and this mount is not fluid.
      defaults: { Sparkline: { overrides: [{ fluid: true, class: { line: 'opacity-70' } }] } },
      props: { data: [1, 4, 2], fluid: false }
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports the same stale key once the rule does match', () => {
    // The control for the row above: same rule, same key, a mount it matches.
    // Without it, "quiet" would also be what a broken check produces.
    renderHost({
      defaults: { Sparkline: { overrides: [{ fluid: true, class: { line: 'opacity-70' } }] } },
      props: { data: [1, 4, 2], fluid: true }
    });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(STALE));
  });

  // The granularity, pinned because MIGRATION.md tells consumers about it: the
  // check sits in the component body, so it runs once per mount and not again.
  // The slot cascade around it *is* reactive — asserted here, or "no second
  // warning" would also pass on a component that stopped updating at all.
  it('checks at mount only, while the cascade around it keeps updating', () => {
    const defaults = $state<Record<string, ComponentDefaults>>({
      Sparkline: { slotClasses: { mark: 'probe-fresh' } }
    });
    renderHost({ defaults });
    expect(document.querySelector('.probe-fresh')).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();

    defaults.Sparkline = { slotClasses: { line: 'probe-stale' } };
    flushSync();

    // The new entry arrived — the old class is gone, so the cascade re-ran…
    expect(document.querySelector('.probe-fresh')).toBeNull();
    // …and the stale key it now carries goes unreported.
    expect(warn).not.toHaveBeenCalled();
  });
});

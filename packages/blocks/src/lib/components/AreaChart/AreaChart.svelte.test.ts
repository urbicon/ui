// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import AreaChart from './AreaChart.svelte';

/**
 * One series is two paths — the filled band and its top edge — and each carries
 * `mark` plus a slot of its own. Two finished tv() folds meet on one element,
 * so the call site has to fold them against each other: `stripConflicts` runs
 * *between* sources and never inside one, and a raw join leaves both tokens in
 * the attribute for the stylesheet to arbitrate.
 *
 * Measured on the joined form, in Chromium against a Tailwind build of the
 * shipped stylesheet: the slot a consumer picks made no difference — `fill-red`
 * beat `fill-blue` from either slot (palette order), `opacity-100` beat
 * `opacity-50` from either (scale order), and `{ area: 'duration-1000' }` lost
 * to `mark`'s own `duration-[var(--blocks-duration-fast)]`, which Tailwind
 * emits after it. Both halves are asserted here on the resolved attribute,
 * which is the deterministic thing: the specific slot wins its bucket, and the
 * library default it displaces is gone rather than outvoted.
 */

const DATA = {
  data: [
    { label: 'a', values: [1] },
    { label: 'b', values: [2] }
  ]
};

/** `mark`'s own transition duration — the library class a consumer must be able to beat. */
const LIBRARY_DURATION = 'duration-[var(--blocks-duration-fast)]';

function paths(slotClasses: Record<string, string>) {
  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(AreaChart, { target, props: { ...DATA, slotClasses } });
  flushSync();
  const all = [...target.querySelectorAll('path')];
  // The two paths null out each other's paint, which is what tells them apart.
  const pick = (attribute: string) => {
    const found = all.find((p) => p.getAttribute(attribute) === 'none');
    if (!found)
      throw new Error(
        `no <path> with ${attribute}="none" among ${all.length}: ` +
          `${all.map((p) => `fill=${p.getAttribute('fill')} stroke=${p.getAttribute('stroke')}`).join(' | ')}`
      );
    return (found.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  };
  const band = pick('stroke');
  const outline = pick('fill');
  unmount(app);
  document.body.innerHTML = '';
  return { band, outline };
}

describe('AreaChart slot folding', () => {
  it.each([
    ['area', 'fill-blue-500', 'fill-red-500'],
    ['area', 'fill-red-500', 'fill-blue-500'],
    ['area', 'opacity-100', 'opacity-50'],
    ['area', 'opacity-50', 'opacity-100'],
    ['areaOutline', 'opacity-50', 'opacity-100']
  ])('%s beats a same-bucket `mark` entry (%s over %s)', (slot, mine, theirs) => {
    const { band, outline } = paths({ mark: theirs, [slot]: mine });
    const element = slot === 'area' ? band : outline;
    expect(element).toContain(mine);
    expect(element).not.toContain(theirs);
  });

  it.each(['area', 'areaOutline'])(
    'a `%s` entry displaces the library default it collides with',
    (slot) => {
      const { band, outline } = paths({ [slot]: 'duration-1000' });
      const element = slot === 'area' ? band : outline;
      expect(element).toContain('duration-1000');
      expect(element).not.toContain(LIBRARY_DURATION);
    }
  );

  it('leaves the neighbouring path untouched', () => {
    const { band, outline } = paths({ area: 'duration-1000' });
    expect(band).toContain('duration-1000');
    expect(outline).toContain(LIBRARY_DURATION);
    expect(outline).not.toContain('duration-1000');
  });
});

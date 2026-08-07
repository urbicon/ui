// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import TableHarness from './__fixtures__/TableHarness.svelte';

/**
 * `variant` on the mobile side.
 *
 * Until 2026-08-07 it had none: the frame lived on `TableDesktop`'s scrollArea
 * alone, so `variant="framed"` framed the table on a laptop and left a phone
 * with bare records on the page ground — a documented prop (VARIANT-CONTRACT §5)
 * that half the readers never saw. Now both layouts read the same slot, and each
 * assertion below is one half of that promise.
 *
 * These are class assertions on purpose. jsdom applies no stylesheet, so there
 * is no computed border to measure here; what can be pinned is that the mobile
 * list asks for the very slot the desktop table asks for, which is the thing
 * that was missing.
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 300 },
  { id: 2, name: 'Grace', amount: 100 }
];

let target: HTMLElement | null = null;
let comp: Record<string, unknown> | null = null;

function mountTable(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(TableHarness, { target, props: { items: ROWS, ...props } });
  flushSync();
  const list = target.querySelector('[data-testid="mobile-table"]');
  if (!list) throw new Error('mobile list not rendered');
  return { list, desktop: target.querySelector('[data-table-layout="desktop"]') };
}

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = null;
  target = null;
});

describe('TableMobile — the frame is the list, not the record', () => {
  it('frames the record list exactly as it frames the desktop table', () => {
    const { list, desktop } = mountTable({ variant: 'framed' });
    const listUtilities = list.className.split(/\s+/);
    const desktopUtilities = (desktop?.className ?? '').split(/\s+/);
    for (const cls of [
      'border',
      'border-border-default',
      'rounded-contain',
      'bg-surface-elevated'
    ]) {
      expect(listUtilities, `mobile list is missing ${cls}`).toContain(cls);
      expect(desktopUtilities, `desktop scrollArea is missing ${cls}`).toContain(cls);
    }
  });

  it('tints the list for surface and leaves flush bare', () => {
    const surface = mountTable({ variant: 'surface' }).list.className;
    expect(surface).toContain('bg-surface-quiet');
    unmount(comp!);
    target!.remove();
    comp = null;

    const flush = mountTable({ variant: 'flush' }).list.className;
    expect(flush).not.toContain('bg-surface-quiet');
    expect(flush).not.toContain('border-border-default');
  });

  it('routes slotClasses.scrollArea to both layouts', () => {
    // One override, one frame — a consumer restyling the table frame should not
    // have to discover that the phone has a second one.
    const { list, desktop } = mountTable({ slotClasses: { scrollArea: 'ring-2' } });
    expect(list.className).toContain('ring-2');
    expect(desktop?.className).toContain('ring-2');
  });

  it('leaves the records themselves unframed', () => {
    const { list } = mountTable({ variant: 'framed' });
    const records = list.querySelectorAll('[data-testid^="mobile-card-"]');
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      // The list carries the frame; a record that re-drew one would put a box
      // inside the box — the look this rework removed.
      expect(record.className).not.toMatch(/\brounded-/);
      expect(record.className.split(/\s+/)).not.toContain('border');
    }
  });
});

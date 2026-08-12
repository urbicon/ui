import { describe, expect, it } from 'vitest';
import { resourceTimelineVariants } from './resource-timeline.variants';

const SIZES = ['sm', 'md', 'lg'] as const;
const VARIANTS = ['default', 'bordered', 'ghost'] as const;

describe('resourceTimelineVariants', () => {
  it('exposes all slots as functions and never emits dark: overrides', () => {
    const styles = resourceTimelineVariants();
    for (const [name, fn] of Object.entries(styles)) {
      expect(typeof fn, `slot ${name} should be a function`).toBe('function');
      expect((fn as () => string)(), `slot ${name} must not emit dark:`).not.toMatch(/\bdark:/);
    }
  });

  it('resolves every slot to a non-empty class under each variant × size', () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        const styles = resourceTimelineVariants({ variant, size });
        for (const [name, fn] of Object.entries(styles)) {
          expect(
            (fn as () => string)().length,
            `slot ${name} is empty at ${variant}/${size}`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps overflow-x on the track and off the root', () => {
    // Risk 2, guarded at the source: an `overflow-x` that reaches `base` scrolls
    // the PAGE sideways on a phone instead of the day track.
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        const styles = resourceTimelineVariants({ variant, size });
        expect(styles.base()).not.toContain('overflow-x');
        expect(styles.track()).toContain('overflow-x-auto');
      }
    }
  });

  it('declares the layout custom properties once per size, on the track', () => {
    // The row template, the cell height and every bar calc() read these; they
    // are the reason a consumer can re-tune density without restating a grid.
    for (const size of SIZES) {
      const track = resourceTimelineVariants({ size }).track();
      for (const token of [
        '--rt-lane-w',
        '--rt-day-w',
        '--rt-bar-h',
        '--rt-bar-gap',
        '--rt-bar-top'
      ])
        expect(track, `${token} missing at size=${size}`).toContain(token);
    }
    // Constant across sizes, so it is declared once on the track's base string
    // rather than repeated in every size.
    expect(resourceTimelineVariants().track()).toContain('--rt-bar-inset');
  });

  it('scales lane width, day width and bar height with size', () => {
    const widths = SIZES.map((size) => resourceTimelineVariants({ size }).track());
    expect(widths[0]).toContain('[--rt-lane-w:7rem]');
    expect(widths[1]).toContain('[--rt-lane-w:9rem]');
    expect(widths[2]).toContain('[--rt-lane-w:11rem]');
    expect(widths[0]).toContain('[--rt-bar-h:1rem]');
    expect(widths[2]).toContain('[--rt-bar-h:1.5rem]');

    expect(resourceTimelineVariants({ size: 'sm' }).navButton()).toContain('h-7');
    expect(resourceTimelineVariants({ size: 'lg' }).navButton()).toContain('h-9');
  });

  it('places every day row on the same shared column template', () => {
    const styles = resourceTimelineVariants();
    for (const row of [styles.dayHeaderRow(), styles.lane()]) {
      expect(row).toContain('grid-cols-[var(--rt-cols)]');
      expect(row).toContain('min-w-[var(--rt-min-w)]');
    }
  });

  it('keeps a group heading off the column template so it is not clipped', () => {
    // On `--rt-cols` the label would sit in the resource column and truncate at
    // `--rt-lane-w`; it spans the row and sticks to the left edge instead.
    const groupRow = resourceTimelineVariants().groupRow();
    expect(groupRow).not.toContain('grid-cols-[var(--rt-cols)]');
    expect(groupRow).toContain('min-w-[var(--rt-min-w)]');
  });

  it('sizes bar and cell geometry from the custom properties', () => {
    const styles = resourceTimelineVariants();
    expect(styles.span()).toContain('h-[var(--rt-bar-h)]');
    expect(styles.span()).toContain('--rt-span');
    expect(styles.span()).toContain('--rt-row');
    expect(styles.dayCell()).toContain('--rt-rows');
  });

  it('applies variant chrome', () => {
    expect(resourceTimelineVariants({ variant: 'bordered' }).base()).toContain('rounded-xl');
    expect(resourceTimelineVariants({ variant: 'ghost' }).dayCell()).toContain(
      'border-transparent'
    );
    expect(resourceTimelineVariants({ variant: 'ghost' }).laneHeader()).toContain(
      'border-transparent'
    );
    expect(resourceTimelineVariants({ variant: 'default' }).dayCell()).toContain(
      'border-border-hairline'
    );
  });

  it('uses semantic text + border tokens on the chrome', () => {
    const styles = resourceTimelineVariants();
    expect(styles.headerTitle()).toContain('text-text-primary');
    expect(styles.laneLabel()).toContain('text-text-primary');
    expect(styles.laneDescription()).toContain('text-text-tertiary');
    expect(styles.header()).toContain('border-border-hairline');
    expect(styles.span()).toContain('text-text-on-fill');
  });

  it('merges a call-site class into the slot and lets it win the bucket', () => {
    const merged = resourceTimelineVariants().laneLabel({ class: 'text-text-secondary' });
    expect(merged).toContain('text-text-secondary');
    expect(merged).not.toContain('text-text-primary');
  });
});

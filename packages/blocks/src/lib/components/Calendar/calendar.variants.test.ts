import { describe, expect, it } from 'vitest';
import { calendarVariants } from './calendar.variants';

describe('calendarVariants', () => {
  it('exposes every slot as a function (~60 slots) and never emits dark: overrides', () => {
    // Too many slots to hand-list, so derive them: assert each is callable AND that its class
    // output stays free of `dark:` overrides (the light-dark() maxim) in one pass.
    const styles = calendarVariants();
    const entries = Object.entries(styles);
    expect(entries.length).toBeGreaterThan(50);
    for (const [name, fn] of entries) {
      expect(typeof fn, `slot ${name} should be a function`).toBe('function');
      expect((fn as () => string)(), `slot ${name} must not emit dark:`).not.toMatch(/\bdark:/);
    }
  });

  it('scales the day cell height with size', () => {
    expect(calendarVariants({ size: 'sm' }).day()).toContain('h-8');
    expect(calendarVariants({ size: 'md' }).day()).toContain('h-12');
    expect(calendarVariants({ size: 'lg' }).day()).toContain('h-16');
  });

  it('applies variant chrome — bordered adds a frame, ghost strips hover fills', () => {
    const bordered = calendarVariants({ variant: 'bordered' });
    expect(bordered.base()).toContain('border');
    expect(bordered.base()).toContain('rounded-lg');

    const ghost = calendarVariants({ variant: 'ghost' });
    expect(ghost.base()).toContain('bg-transparent');
    expect(ghost.day()).toContain('hover:bg-transparent');
    expect(ghost.header()).toContain('border-b-0');
  });

  it('distinguishes today / selected / today+selected day states', () => {
    const today = calendarVariants({ dayState: 'today' });
    expect(today.day()).toContain('bg-primary');
    expect(today.dayNumber()).toContain('text-text-on-primary');

    const selected = calendarVariants({ dayState: 'selected' });
    expect(selected.day()).toContain('bg-primary-subtle');
    expect(selected.day()).toContain('ring-primary');
    expect(selected.dayNumber()).toContain('text-primary');

    // today+selected is the strongest state — filled primary AND an offset ring.
    const both = calendarVariants({ dayState: 'todaySelected' });
    expect(both.day()).toContain('bg-primary');
    expect(both.day()).toContain('ring-2');
    expect(both.day()).toContain('ring-offset-1');
  });

  it('rounds range selection for visual continuity — the whole range reads as one bar', () => {
    // Start keeps its left corner but squares the right; end mirrors it; middle squares both.
    // Break any of these and the range shows rounded gaps between adjacent days.
    expect(calendarVariants({ dayState: 'rangeStart' }).day()).toContain('rounded-r-none');
    expect(calendarVariants({ dayState: 'rangeEnd' }).day()).toContain('rounded-l-none');
    expect(calendarVariants({ dayState: 'inRange' }).day()).toContain('rounded-none');
    // The lighter preview range mirrors the in-range squaring.
    expect(calendarVariants({ dayState: 'previewRange' }).day()).toContain('rounded-none');
  });

  it('dims disabled days and de-emphasizes outside-month days', () => {
    const disabled = calendarVariants({ dayState: 'disabled' });
    expect(disabled.day()).toContain('opacity-40');
    expect(disabled.day()).toContain('cursor-not-allowed');
    expect(disabled.dayNumber()).toContain('text-text-disabled');

    expect(calendarVariants({ dayState: 'outsideMonth' }).dayNumber()).toContain(
      'text-text-quaternary'
    );
  });

  it('bolds days with events and flips the today dot to a light fill for contrast (compound)', () => {
    expect(calendarVariants({ hasEvents: true }).dayNumber()).toContain('font-bold');
    // On a today cell the dot sits on filled primary, so the compound flips it to a light fill.
    expect(calendarVariants({ dayState: 'today' }).dot()).toContain('bg-surface-base');
  });
});

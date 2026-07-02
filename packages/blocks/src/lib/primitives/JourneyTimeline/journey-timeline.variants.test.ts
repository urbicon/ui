import { describe, expect, it } from 'vitest';
import { journeyTimelineVariants } from './journey-timeline.variants';

describe('journeyTimelineVariants', () => {
  it('provides all documented slot functions', () => {
    const styles = journeyTimelineVariants();
    for (const slot of [
      'base',
      'rail',
      'node',
      'metaColumn',
      'meta',
      'markerColumn',
      'marker',
      'connector',
      'content',
      'card',
      'header',
      'trigger',
      'trailing',
      'labelGroup',
      'title',
      'subtitle',
      'segment',
      'detail',
      'detailInner',
      'detailContent',
      'panel'
    ] as const) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('renders small circular dot markers — punctuation, not Stepper discs', () => {
    const marker = journeyTimelineVariants().marker();
    expect(marker).toContain('rounded-commit');
    expect(marker).toContain('size-3');
    expect(marker).not.toMatch(/size-(7|9|11)/);
  });

  it('centres custom glyph content inside the dot', () => {
    const marker = journeyTimelineVariants().marker();
    expect(marker).toContain('grid');
    expect(marker).toContain('place-items-center');
  });

  describe('header row (trigger + trailing)', () => {
    it('right-aligns trailing content in vertical orientation', () => {
      const styles = journeyTimelineVariants({ orientation: 'vertical' });
      expect(styles.trailing()).toContain('ml-auto');
      expect(styles.trigger()).toContain('flex-1');
      expect(styles.trigger()).toContain('min-w-0');
    });

    it('appends trailing next to the pill in horizontal orientation', () => {
      const styles = journeyTimelineVariants({ orientation: 'horizontal' });
      expect(styles.header()).toContain('gap-x-1.5');
      expect(styles.trailing()).not.toContain('ml-auto');
    });
  });

  describe('status → semantic intent tokens', () => {
    it('maps complete to success (filled dot)', () => {
      const marker = journeyTimelineVariants({ status: 'complete' }).marker();
      expect(marker).toContain('bg-success');
      expect(marker).toContain('border-success');
    });

    it('maps active to primary (filled + ringed dot)', () => {
      const styles = journeyTimelineVariants({ status: 'active' });
      expect(styles.marker()).toContain('bg-primary');
      expect(styles.marker()).toContain('ring-4');
      expect(styles.title()).toContain('text-text-primary');
    });

    it('maps pending to a hollow dot (no fill token)', () => {
      const marker = journeyTimelineVariants({ status: 'pending' }).marker();
      expect(marker).toContain('bg-surface-base');
      expect(marker).toContain('border-border-strong');
      expect(marker).not.toContain('bg-primary');
      expect(marker).not.toContain('bg-success');
    });

    it('maps attention to a hollow warning dot (worth a look, not blocking)', () => {
      const styles = journeyTimelineVariants({ status: 'attention' });
      expect(styles.marker()).toContain('border-warning');
      expect(styles.marker()).toContain('bg-surface-base');
      expect(styles.title()).toContain('text-warning-emphasis');
    });

    it('maps blocked to danger, with the title as a second (non-colour-only) cue', () => {
      const styles = journeyTimelineVariants({ status: 'blocked' });
      expect(styles.marker()).toContain('bg-danger');
      expect(styles.title()).toContain('text-danger');
    });

    it('maps skipped to a muted, dimmed marker', () => {
      const styles = journeyTimelineVariants({ status: 'skipped' });
      expect(styles.marker()).toContain('bg-surface-subtle');
      expect(styles.marker()).toContain('opacity-80');
      expect(styles.title()).toContain('text-text-tertiary');
    });
  });

  describe('connector semantics', () => {
    it('paints the travelled segment with the success token', () => {
      expect(journeyTimelineVariants({ travelled: true }).connector()).toContain('border-success');
    });

    it('leaves an untravelled segment on the default border token', () => {
      const connector = journeyTimelineVariants({ travelled: false }).connector();
      expect(connector).toContain('border-border-default');
      expect(connector).not.toContain('border-success');
    });

    it('switches line style per node — the connector carries meaning', () => {
      expect(journeyTimelineVariants({ connectorStyle: 'solid' }).connector()).toContain(
        'border-solid'
      );
      expect(journeyTimelineVariants({ connectorStyle: 'dashed' }).connector()).toContain(
        'border-dashed'
      );
      expect(journeyTimelineVariants({ connectorStyle: 'dotted' }).connector()).toContain(
        'border-dotted'
      );
    });

    it('draws a vertical hairline in vertical mode', () => {
      const connector = journeyTimelineVariants({ orientation: 'vertical' }).connector();
      expect(connector).toContain('border-l-2');
      expect(connector).toContain('flex-1');
    });

    it('draws a horizontal hairline + stacks the panel below in horizontal mode', () => {
      const styles = journeyTimelineVariants({ orientation: 'horizontal' });
      expect(styles.connector()).toContain('border-t-2');
      expect(styles.base()).toContain('flex-col');
    });

    it('grows the horizontal line inside the spine row (never a fixed stub)', () => {
      const connector = journeyTimelineVariants({ orientation: 'horizontal' }).connector();
      expect(connector).toContain('flex-1');
      expect(connector).toContain('min-w-3');
    });
  });

  describe('horizontal spine', () => {
    const styles = journeyTimelineVariants({ orientation: 'horizontal', size: 'md' });

    it('stacks each station meta → spine → header via order utilities', () => {
      expect(styles.node()).toContain('flex-col');
      expect(styles.metaColumn()).toContain('order-1');
      expect(styles.markerColumn()).toContain('order-2');
      expect(styles.header()).toContain('order-3');
    });

    it('runs the spine as a full-width row so lines meet the next station', () => {
      const spine = styles.markerColumn();
      expect(spine).toContain('w-full');
      expect(spine).toContain('flex-row');
      expect(spine).not.toContain('w-4');
    });

    it('fixes spine + chronicle row heights so stations stay on one baseline', () => {
      // Spine: constant height with or without a segment label. Chronicle row:
      // min-height survives a consumer meta snippet that renders nothing.
      expect(styles.markerColumn()).toContain('h-4');
      expect(styles.metaColumn()).toContain('min-h-4');
    });

    it('keeps segment labels in the line — they may never overlap a marker', () => {
      const segment = styles.segment();
      expect(segment).toContain('shrink-0');
      expect(segment).toContain('whitespace-nowrap');
    });

    it('drops the vertical baseline offset from the marker', () => {
      expect(styles.marker()).not.toMatch(/\bmt-/);
      expect(journeyTimelineVariants({ orientation: 'vertical', size: 'md' }).marker()).toContain(
        'mt-2.5'
      );
    });

    it('left-aligns the pill text with marker and meta (-ml compensates px)', () => {
      const trigger = styles.trigger();
      expect(trigger).toContain('-ml-2');
      expect(trigger).toContain('px-2');
      expect(trigger).toContain('w-auto');
    });
  });

  describe('chronicle meta rail', () => {
    it('adds the meta grid column only when the rail is active', () => {
      expect(journeyTimelineVariants({ withMeta: true }).node()).toContain(
        'grid-cols-[auto_auto_minmax(0,1fr)]'
      );
      expect(journeyTimelineVariants({ withMeta: false }).node()).toContain(
        'grid-cols-[auto_minmax(0,1fr)]'
      );
    });

    it('sets the meta text in mono/tabular — a readable time axis', () => {
      const meta = journeyTimelineVariants().meta();
      expect(meta).toContain('font-mono');
      expect(meta).toContain('tabular-nums');
    });
  });

  describe('focused', () => {
    it('elevates the focused inline card (surface change, not a grey block)', () => {
      const styles = journeyTimelineVariants({ detail: 'inline', focused: true });
      expect(styles.card()).toContain('bg-surface-elevated');
      expect(styles.card()).toContain('border-border-default');
      expect(styles.title()).toContain('font-semibold');
    });

    it('tints the focused row quietly when the detail lives in the panel', () => {
      const card = journeyTimelineVariants({
        orientation: 'vertical',
        detail: 'panel',
        focused: true
      }).card();
      expect(card).toContain('bg-surface-selected');
      expect(card).not.toContain('bg-surface-elevated');
    });

    it('tints the focused horizontal trigger pill', () => {
      expect(
        journeyTimelineVariants({ orientation: 'horizontal', focused: true }).trigger()
      ).toContain('bg-surface-selected');
    });

    it('offers hover feedback only while not focused', () => {
      expect(journeyTimelineVariants({ interactive: true, focused: false }).card()).toContain(
        'hover:bg-surface-hover'
      );
      expect(journeyTimelineVariants({ interactive: true, focused: true }).card()).not.toContain(
        'hover:bg-surface-hover'
      );
    });
  });

  describe('detail placement', () => {
    it('lays rail + readout side by side (wide) and docks it (narrow) for vertical panel mode', () => {
      const styles = journeyTimelineVariants({ orientation: 'vertical', detail: 'panel' });
      expect(styles.base()).toContain('sm:grid');
      expect(styles.panel()).toContain('sm:sticky');
      expect(styles.panel()).toContain('max-sm:sticky');
      expect(styles.panel()).toContain('z-[var(--z-docked)]');
    });

    it('stretches the horizontal panel under the rail', () => {
      const panel = journeyTimelineVariants({ orientation: 'horizontal' }).panel();
      expect(panel).toContain('w-full');
      expect(panel).toContain('mt-4');
    });
  });

  describe('interactive', () => {
    it('shows a pointer on focusable nodes', () => {
      expect(journeyTimelineVariants({ interactive: true }).trigger()).toContain('cursor-pointer');
    });

    it('shows a default cursor on pure waypoints', () => {
      expect(journeyTimelineVariants({ interactive: false }).trigger()).toContain('cursor-default');
    });
  });

  describe('size', () => {
    it('scales the dot marker across sm/md/lg', () => {
      expect(journeyTimelineVariants({ size: 'sm' }).marker()).toContain('size-2.5');
      expect(journeyTimelineVariants({ size: 'md' }).marker()).toContain('size-3');
      expect(journeyTimelineVariants({ size: 'lg' }).marker()).toContain('size-3.5');
    });

    it('scales the meta rail width across sm/md/lg', () => {
      expect(journeyTimelineVariants({ size: 'sm' }).metaColumn()).toContain('w-10');
      expect(journeyTimelineVariants({ size: 'md' }).metaColumn()).toContain('w-12');
      expect(journeyTimelineVariants({ size: 'lg' }).metaColumn()).toContain('w-14');
    });
  });

  it('never emits dark: overrides (light-dark() handles theming)', () => {
    const statuses = ['complete', 'active', 'pending', 'blocked', 'skipped'] as const;
    for (const status of statuses) {
      const styles = journeyTimelineVariants({ status, focused: true });
      expect(styles.marker()).not.toMatch(/\bdark:/);
      expect(styles.title()).not.toMatch(/\bdark:/);
      expect(styles.connector()).not.toMatch(/\bdark:/);
      expect(styles.card()).not.toMatch(/\bdark:/);
      expect(styles.panel()).not.toMatch(/\bdark:/);
    }
  });
});

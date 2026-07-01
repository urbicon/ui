import { describe, expect, it } from 'vitest';
import { journeyTimelineVariants } from './journey-timeline.variants';

describe('journeyTimelineVariants', () => {
  it('provides all documented slot functions', () => {
    const styles = journeyTimelineVariants();
    for (const slot of [
      'base',
      'rail',
      'node',
      'trigger',
      'marker',
      'connectorColumn',
      'connector',
      'labelGroup',
      'title',
      'subtitle',
      'body',
      'detail',
      'detailInner',
      'detailContent',
      'panel'
    ] as const) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('renders circular markers (commit-tier radius)', () => {
    expect(journeyTimelineVariants().marker()).toContain('rounded-commit');
  });

  describe('status → semantic intent tokens', () => {
    it('maps complete to success (filled)', () => {
      const marker = journeyTimelineVariants({ status: 'complete' }).marker();
      expect(marker).toContain('bg-success');
      expect(marker).toContain('border-success');
    });

    it('maps active to primary (filled + elevated)', () => {
      const styles = journeyTimelineVariants({ status: 'active' });
      expect(styles.marker()).toContain('bg-primary');
      expect(styles.title()).toContain('text-text-primary');
    });

    it('maps pending to an empty outlined circle (no fill token)', () => {
      const marker = journeyTimelineVariants({ status: 'pending' }).marker();
      expect(marker).toContain('bg-surface-base');
      expect(marker).toContain('border-border-default');
      expect(marker).not.toContain('bg-primary');
      expect(marker).not.toContain('bg-success');
    });

    it('maps blocked to danger (filled)', () => {
      const styles = journeyTimelineVariants({ status: 'blocked' });
      expect(styles.marker()).toContain('bg-danger');
      expect(styles.title()).toContain('text-danger');
    });

    it('maps skipped to a muted, dimmed marker', () => {
      const marker = journeyTimelineVariants({ status: 'skipped' }).marker();
      expect(marker).toContain('bg-surface-subtle');
      expect(marker).toContain('opacity-70');
    });
  });

  describe('connectorComplete', () => {
    it('paints the travelled segment with the success token', () => {
      expect(journeyTimelineVariants({ connectorComplete: true }).connector()).toContain(
        'bg-success'
      );
    });

    it('leaves an untravelled segment on the subtle border token', () => {
      const connector = journeyTimelineVariants({ connectorComplete: false }).connector();
      expect(connector).toContain('bg-border-subtle');
      expect(connector).not.toContain('bg-success');
    });
  });

  describe('orientation geometry', () => {
    it('grows the connector vertically in vertical mode', () => {
      const connector = journeyTimelineVariants({ orientation: 'vertical' }).connector();
      expect(connector).toContain('w-0.5');
    });

    it('grows the connector horizontally + stacks the panel below in horizontal mode', () => {
      const styles = journeyTimelineVariants({ orientation: 'horizontal' });
      expect(styles.connector()).toContain('h-0.5');
      expect(styles.base()).toContain('flex-col');
    });
  });

  describe('focused', () => {
    it('emphasises the focused node title + trigger surface', () => {
      const styles = journeyTimelineVariants({ focused: true });
      expect(styles.title()).toContain('font-semibold');
      expect(styles.trigger()).toContain('bg-surface-subtle');
    });
  });

  describe('interactive', () => {
    it('shows a pointer + hover surface on focusable nodes', () => {
      expect(journeyTimelineVariants({ interactive: true }).trigger()).toContain('cursor-pointer');
    });

    it('shows a default cursor on pure waypoints', () => {
      expect(journeyTimelineVariants({ interactive: false }).trigger()).toContain('cursor-default');
    });
  });

  describe('size', () => {
    it('scales the marker across sm/md/lg', () => {
      expect(journeyTimelineVariants({ size: 'sm' }).marker()).toContain('size-7');
      expect(journeyTimelineVariants({ size: 'md' }).marker()).toContain('size-9');
      expect(journeyTimelineVariants({ size: 'lg' }).marker()).toContain('size-11');
    });
  });

  it('never emits dark: overrides (light-dark() handles theming)', () => {
    const statuses = ['complete', 'active', 'pending', 'blocked', 'skipped'] as const;
    for (const status of statuses) {
      const styles = journeyTimelineVariants({ status });
      expect(styles.marker()).not.toMatch(/\bdark:/);
      expect(styles.title()).not.toMatch(/\bdark:/);
      expect(styles.connector()).not.toMatch(/\bdark:/);
    }
  });
});

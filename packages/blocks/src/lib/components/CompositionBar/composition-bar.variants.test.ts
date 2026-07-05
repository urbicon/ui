import { describe, expect, it } from 'vitest';
import { compositionBarVariants } from './composition-bar.variants';

describe('compositionBarVariants', () => {
  it('default variants apply for empty props', () => {
    const styles = compositionBarVariants({});
    expect(styles.bar()).toContain('h-3');
    expect(styles.bar()).toContain('rounded-modify');
  });

  it('orientation horizontal vs vertical produce different bar layouts', () => {
    const horiz = compositionBarVariants({ orientation: 'horizontal' }).bar();
    const vert = compositionBarVariants({ orientation: 'vertical' }).bar();
    expect(horiz).toContain('flex-row');
    expect(vert).toContain('flex-col-reverse');
    expect(vert).toContain('w-12');
  });

  it('size sm/md/lg differ in bar height', () => {
    expect(compositionBarVariants({ size: 'sm' }).bar()).toContain('h-2');
    expect(compositionBarVariants({ size: 'md' }).bar()).toContain('h-3');
    expect(compositionBarVariants({ size: 'lg' }).bar()).toContain('h-5');
  });

  it('size sm/md/lg differ in legend dot diameter', () => {
    expect(compositionBarVariants({ size: 'sm' }).legendDot()).toContain('h-2');
    expect(compositionBarVariants({ size: 'md' }).legendDot()).toContain('h-2.5');
    expect(compositionBarVariants({ size: 'lg' }).legendDot()).toContain('h-3');
  });

  it('legendPlacement controls wrapper flex-direction in horizontal orientation', () => {
    expect(
      compositionBarVariants({ orientation: 'horizontal', legendPlacement: 'top' }).wrapper()
    ).toContain('flex-col-reverse');
    expect(
      compositionBarVariants({ orientation: 'horizontal', legendPlacement: 'bottom' }).wrapper()
    ).toContain('flex-col');
    expect(
      compositionBarVariants({ orientation: 'horizontal', legendPlacement: 'right' }).wrapper()
    ).toContain('flex-row');
    expect(
      compositionBarVariants({ orientation: 'horizontal', legendPlacement: 'left' }).wrapper()
    ).toContain('flex-row-reverse');
  });

  it('uses semantic surface tokens for tooltip background', () => {
    const tt = compositionBarVariants({}).tooltip();
    expect(tt).toContain('bg-surface-elevated');
    expect(tt).toContain('text-text-primary');
  });

  it('uses border-border-hairline for tooltip', () => {
    expect(compositionBarVariants({}).tooltip()).toContain('border-border-hairline');
  });

  it('uses focus-visible: pattern on segment and legendItem', () => {
    expect(compositionBarVariants({}).segment()).toContain('focus-visible:ring-2');
    expect(compositionBarVariants({}).legendItem()).toContain('focus-visible:ring-2');
  });

  it('legendValue uses tabular-nums for aligned figures', () => {
    expect(compositionBarVariants({}).legendValue()).toContain('tabular-nums');
  });

  it('total uses tabular-nums and font-semibold', () => {
    const total = compositionBarVariants({}).total();
    expect(total).toContain('tabular-nums');
    expect(total).toContain('font-semibold');
  });

  it('never outputs dark: overrides', () => {
    const placements = ['top', 'right', 'bottom', 'left'] as const;
    for (const placement of placements) {
      const styles = compositionBarVariants({ legendPlacement: placement });
      expect(styles.bar()).not.toMatch(/\bdark:/);
      expect(styles.tooltip()).not.toMatch(/\bdark:/);
      expect(styles.legendItem()).not.toMatch(/\bdark:/);
    }
  });

  it('segmentRest uses dashed border to distinguish from real segments', () => {
    expect(compositionBarVariants({}).segmentRest()).toContain('border-dashed');
  });

  it('tooltip uses z-tooltip token', () => {
    expect(compositionBarVariants({}).tooltip()).toContain('z-[var(--z-tooltip)]');
  });
});

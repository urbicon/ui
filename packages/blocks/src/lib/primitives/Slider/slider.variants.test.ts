import { describe, expect, it } from 'vitest';
import { sliderVariants } from './slider.variants';

describe('sliderVariants', () => {
  it('applies intent colors to range and thumb', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = sliderVariants({ intent });
      expect(styles.range()).toContain(`bg-${intent}`);
      expect(styles.thumb()).toContain(`border-${intent}`);
    }
  });

  it('differentiates all sizes for track height', () => {
    const sm = sliderVariants({ size: 'sm' }).track();
    const md = sliderVariants({ size: 'md' }).track();
    const lg = sliderVariants({ size: 'lg' }).track();

    expect(sm).toContain('h-1');
    expect(md).toContain('h-2');
    expect(lg).toContain('h-3');
  });

  it('differentiates thumb sizes', () => {
    const sm = sliderVariants({ size: 'sm' }).thumb();
    const md = sliderVariants({ size: 'md' }).thumb();
    const lg = sliderVariants({ size: 'lg' }).thumb();

    expect(sm).toContain('w-3.5');
    expect(md).toContain('w-5');
    expect(lg).toContain('w-7');
  });

  it('uses commit tier (rounded-commit) for track and thumb', () => {
    const styles = sliderVariants({});
    expect(styles.track()).toContain('rounded-commit');
    expect(styles.thumb()).toContain('rounded-commit');
  });

  // `surface-interactive`, not `surface-subtle`: the latter resolves to the same
  // neutral step as `surface-elevated`, so the groove was invisible on a card.
  it('uses semantic surface token for track background', () => {
    const track = sliderVariants({}).track();
    expect(track).toContain('bg-surface-interactive');
  });

  it('uses shadow token for thumb', () => {
    const thumb = sliderVariants({}).thumb();
    expect(thumb).toContain('shadow-[var(--blocks-shadow-sm)]');
  });

  it('applies disabled state', () => {
    const base = sliderVariants({ disabled: true }).base();
    expect(base).toContain('opacity-50');
    expect(base).toContain('cursor-not-allowed');
    expect(base).toContain('pointer-events-none');
  });

  it('uses focus-visible on thumb', () => {
    const thumb = sliderVariants({}).thumb();
    expect(thumb).toContain('focus-visible:ring-2');
    expect(thumb).toContain('focus-visible:ring-offset-surface-base');
  });

  it('applies error style to message', () => {
    const message = sliderVariants({ error: true }).message();
    expect(message).toContain('text-danger');
  });

  it('uses touch-none on base for pointer capture', () => {
    const base = sliderVariants({}).base();
    expect(base).toContain('touch-none');
  });

  it('uses tabular-nums for value text', () => {
    const valueText = sliderVariants({}).valueText();
    expect(valueText).toContain('tabular-nums');
  });

  it('never outputs dark: overrides', () => {
    const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
    for (const intent of intents) {
      const styles = sliderVariants({ intent });
      expect(styles.range()).not.toMatch(/\bdark:/);
      expect(styles.thumb()).not.toMatch(/\bdark:/);
      expect(styles.track()).not.toMatch(/\bdark:/);
    }
  });

  describe('variant="rail"', () => {
    it('collapses track and range to a 1px hairline', () => {
      const styles = sliderVariants({ variant: 'rail' });
      expect(styles.track()).toContain('h-px');
      expect(styles.range()).toContain('h-px');
      // Default chrome stripped: no commit-pill radius on the hairline
      expect(styles.track()).toContain('rounded-none');
      expect(styles.range()).toContain('rounded-none');
    });

    it('renders thumb as a fixed 8px solid dot regardless of size', () => {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const thumb = sliderVariants({ variant: 'rail', size }).thumb();
        expect(thumb).toContain('w-2');
        expect(thumb).toContain('h-2');
        expect(thumb).toContain('rounded-full');
        expect(thumb).toContain('border-0');
        expect(thumb).toContain('shadow-none');
      }
    });

    it('disables hover-scale and shadow lift on the dot', () => {
      const thumb = sliderVariants({ variant: 'rail' }).thumb();
      expect(thumb).toContain('hover:scale-100');
      expect(thumb).toContain('hover:shadow-none');
    });

    it('expands hit-target to 24×24 via ::before pseudo-element', () => {
      const thumb = sliderVariants({ variant: 'rail' }).thumb();
      expect(thumb).toContain('before:content-[""]');
      expect(thumb).toContain('before:absolute');
      expect(thumb).toContain('before:-inset-2');
    });

    it('maps intent to dot fill via text-color + bg-current', () => {
      const intents = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;
      for (const intent of intents) {
        const thumb = sliderVariants({ variant: 'rail', intent }).thumb();
        expect(thumb).toContain(`text-${intent}`);
        expect(thumb).toContain('bg-current');
      }
    });

    it('uses neutral hairline for the unfilled portion of the track', () => {
      const track = sliderVariants({ variant: 'rail' }).track();
      expect(track).toContain('bg-border-default');
    });
  });

  describe('rangeStatus', () => {
    it('rangeStatus="none" leaves intent-colored range untouched', () => {
      const noneStyles = sliderVariants({ intent: 'primary', rangeStatus: 'none' });
      expect(noneStyles.range()).toContain('bg-primary');
      expect(noneStyles.thumb()).toContain('border-primary');
    });

    it('rangeStatus="insideRecommended" overrides to success', () => {
      const styles = sliderVariants({ intent: 'primary', rangeStatus: 'insideRecommended' });
      expect(styles.range()).toContain('bg-success');
      expect(styles.thumb()).toContain('border-success');
      expect(styles.rangeStatus()).toContain('text-success');
    });

    it('rangeStatus="insideValidOnly" overrides to warning', () => {
      const styles = sliderVariants({ intent: 'primary', rangeStatus: 'insideValidOnly' });
      expect(styles.range()).toContain('bg-warning');
      expect(styles.thumb()).toContain('border-warning');
      expect(styles.rangeStatus()).toContain('text-warning');
    });

    it('rangeStatus="outsideValidDanger" overrides to danger', () => {
      const styles = sliderVariants({ intent: 'primary', rangeStatus: 'outsideValidDanger' });
      expect(styles.range()).toContain('bg-danger');
      expect(styles.thumb()).toContain('border-danger');
      expect(styles.rangeStatus()).toContain('text-danger');
    });

    it('rangeStatus="outsideValidWarning" overrides to warning', () => {
      const styles = sliderVariants({ intent: 'primary', rangeStatus: 'outsideValidWarning' });
      expect(styles.range()).toContain('bg-warning');
      expect(styles.thumb()).toContain('border-warning');
      expect(styles.rangeStatus()).toContain('text-warning');
    });

    it('boundaryTick uses subtle border color and small width', () => {
      const tick = sliderVariants({}).boundaryTick();
      expect(tick).toContain('w-px');
      expect(tick).toContain('bg-border-default');
    });

    it('rangeStatus has transition class', () => {
      const status = sliderVariants({ rangeStatus: 'insideRecommended' }).rangeStatus();
      expect(status).toContain('transition-[color]');
    });
  });
});

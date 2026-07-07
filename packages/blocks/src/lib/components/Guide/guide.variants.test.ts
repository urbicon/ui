import { describe, expect, it } from 'vitest';
import {
  guideArticleVariants,
  guideBeaconVariants,
  guideHintVariants,
  guideMarkerVariants,
  guideMentionVariants,
  guidePanelVariants,
  guideRefVariants,
  guideTourVariants
} from './guide.variants';

// Guide ships a family of independent tv() configs (one per surface), not a single one.
const CONFIGS = {
  guidePanelVariants,
  guideArticleVariants,
  guideMarkerVariants,
  guideMentionVariants,
  guideRefVariants,
  guideHintVariants,
  guideTourVariants,
  guideBeaconVariants
};

describe('guide variants', () => {
  it('every guide config exposes function slots and never emits dark: overrides', () => {
    for (const [name, config] of Object.entries(CONFIGS)) {
      const entries = Object.entries(config());
      expect(entries.length, `${name} should have slots`).toBeGreaterThan(0);
      for (const [slot, fn] of entries) {
        expect(typeof fn, `${name}.${slot} should be a function`).toBe('function');
        expect((fn as () => string)(), `${name}.${slot} must not emit dark:`).not.toMatch(
          /\bdark:/
        );
      }
    }
  });

  it('GuidePanel pins + rounds the panel per placement and sets width per size', () => {
    const left = guidePanelVariants({ placement: 'left' }).panel();
    expect(left).toContain('left-0');
    expect(left).toContain('border-r');
    expect(left).toContain('rounded-r-xl');

    const right = guidePanelVariants({ placement: 'right' }).panel();
    expect(right).toContain('right-0');
    expect(right).toContain('border-l');
    expect(right).toContain('rounded-l-xl');

    expect(guidePanelVariants({ size: 'sm' }).panel()).toContain('w-72');
    expect(guidePanelVariants({ size: 'md' }).panel()).toContain('w-96');
    expect(guidePanelVariants({ size: 'lg' }).panel()).toContain('w-[32rem]');
  });

  it('distinguishes GuideMention (dotted) from GuideRef (solid) underline', () => {
    // The dotted vs solid underline is the intentional signal: a Mention highlights a UI element
    // (Direction B), a Ref jumps to another article. Both are primary, link-like resets — swapping
    // the decoration would erase the distinction the docs promise.
    const mention = guideMentionVariants().mention();
    expect(mention).toContain('decoration-dotted');
    expect(mention).toContain('text-primary');

    const ref = guideRefVariants().ref();
    expect(ref).toContain('decoration-solid');
    expect(ref).toContain('text-primary');
  });

  it('GuideMarker + GuideBeacon scale with size and use identity tokens', () => {
    expect(guideMarkerVariants({ size: 'sm' }).icon()).toContain('h-4');
    expect(guideMarkerVariants().marker()).toContain('cursor-help');

    expect(guideBeaconVariants({ size: 'sm' }).beacon()).toContain('h-2.5');
    expect(guideBeaconVariants({ size: 'md' }).beacon()).toContain('h-3.5');
    expect(guideBeaconVariants().dot()).toContain('bg-primary');
  });

  it('GuideHint + GuideTour share a borderless rotated arrow in the bubble colour', () => {
    for (const arrow of [guideHintVariants().arrow(), guideTourVariants().arrow()]) {
      expect(arrow).toContain('rotate-45');
      expect(arrow).toContain('bg-surface-overlay');
    }
    // Each surface sits at its own stacking level.
    expect(guideHintVariants().hint()).toContain('z-[var(--z-popover)]');
    expect(guideTourVariants().bubble()).toContain('z-[var(--z-guide)]');
  });

  it('GuideTour marks the active step dot — wider + primary over the resting dot', () => {
    expect(guideTourVariants().dot()).toContain('bg-border-strong/50');
    const active = guideTourVariants().dotActive();
    expect(active).toContain('w-4');
    expect(active).toContain('bg-primary');
  });
});

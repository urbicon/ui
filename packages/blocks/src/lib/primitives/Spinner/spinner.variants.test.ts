import { describe, expect, it } from 'vitest';
import { spinnerVariants } from './spinner.variants';

describe('spinnerVariants', () => {
  it('maps each semantic intent to the matching text-color token', () => {
    const intents = [
      ['primary', 'text-primary'],
      ['secondary', 'text-secondary'],
      ['success', 'text-success'],
      ['warning', 'text-warning-emphasis'],
      ['danger', 'text-danger'],
      ['neutral', 'text-text-secondary']
    ] as const;

    for (const [intent, expectedClass] of intents) {
      expect(spinnerVariants({ intent }).base()).toContain(expectedClass);
    }
  });

  it('exposes `current` so the spinner inherits the parent text-color', () => {
    // `text-current` is the contract for use inside coloured surfaces
    // (filled Button, Toast action, ConfirmDialog primary) — BTN-1 fix.
    expect(spinnerVariants({ intent: 'current' }).base()).toContain('text-current');
  });

  it('staggers physical size from xs to xl', () => {
    expect(spinnerVariants({ size: 'xs' }).base()).toContain('w-4');
    expect(spinnerVariants({ size: 'sm' }).base()).toContain('w-5');
    expect(spinnerVariants({ size: 'md' }).base()).toContain('w-6');
    expect(spinnerVariants({ size: 'lg' }).base()).toContain('w-8');
    expect(spinnerVariants({ size: 'xl' }).base()).toContain('w-10');
  });

  it('sets the speed CSS custom property from the speed variant', () => {
    expect(spinnerVariants({ speed: 'slow' }).base()).toContain('[--spinner-speed:2s]');
    expect(spinnerVariants({ speed: 'normal' }).base()).toContain('[--spinner-speed:1s]');
    expect(spinnerVariants({ speed: 'fast' }).base()).toContain('[--spinner-speed:0.5s]');
  });
});

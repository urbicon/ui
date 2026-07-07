import { describe, expect, it } from 'vitest';
import { buttonGroupVariants } from './buttongroup.variants';

describe('buttonGroupVariants', () => {
  it('provides the base slot function', () => {
    expect(typeof buttonGroupVariants().base).toBe('function');
  });

  it('switches flex direction by orientation', () => {
    expect(buttonGroupVariants({ orientation: 'horizontal' }).base()).toContain('flex-row');
    expect(buttonGroupVariants({ orientation: 'vertical' }).base()).toContain('flex-col');
  });

  it('only adds a gap when NOT connected — connected groups read as one shape', () => {
    expect(buttonGroupVariants({ connected: false }).base()).toContain('gap-1');
    expect(buttonGroupVariants({ connected: true }).base()).not.toContain('gap-1');
  });

  it('connected groups collapse the inner seam + cap the outer corners per tier + orientation', () => {
    // horizontal / commit → pill cap radius on the outer left+right corners, inner children
    // pulled together with a negative left margin so the borders overlap into one seam.
    const hCommit = buttonGroupVariants({
      connected: true,
      orientation: 'horizontal',
      tier: 'commit'
    }).base();
    expect(hCommit).toContain('[&>:first-child]:rounded-l-commit');
    expect(hCommit).toContain('[&>:last-child]:rounded-r-commit');
    expect(hCommit).toContain('[&>*:not(:first-child)]:-ml-px');

    // horizontal / modify → soft cap radius on the same corners.
    const hModify = buttonGroupVariants({
      connected: true,
      orientation: 'horizontal',
      tier: 'modify'
    }).base();
    expect(hModify).toContain('[&>:first-child]:rounded-l-modify');
    expect(hModify).toContain('[&>:last-child]:rounded-r-modify');

    // vertical / commit → top+bottom cap radius, negative top margin for the vertical seam.
    const vCommit = buttonGroupVariants({
      connected: true,
      orientation: 'vertical',
      tier: 'commit'
    }).base();
    expect(vCommit).toContain('[&>:first-child]:rounded-t-commit');
    expect(vCommit).toContain('[&>:last-child]:rounded-b-commit');
    expect(vCommit).toContain('[&>*:not(:first-child)]:-mt-px');
  });

  it('drops the connected border compounds entirely when disconnected', () => {
    const disconnected = buttonGroupVariants({
      connected: false,
      orientation: 'horizontal',
      tier: 'commit'
    }).base();
    expect(disconnected).not.toContain('rounded-l-commit');
    expect(disconnected).not.toContain('-ml-px');
  });

  it('dims + blocks pointer events when disabled', () => {
    const d = buttonGroupVariants({ disabled: true }).base();
    expect(d).toContain('opacity-50');
    expect(d).toContain('pointer-events-none');
  });
});

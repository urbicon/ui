import { describe, expect, it } from 'vitest';
import { codeBlockVariants } from './code-block.variants';

const SLOTS = ['root', 'header', 'langLabel', 'copyButton', 'pre', 'code'] as const;

describe('codeBlockVariants', () => {
  it('provides all slot functions', () => {
    const styles = codeBlockVariants();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('defaults to the standalone card frame', () => {
    const styles = codeBlockVariants();
    expect(styles.root()).toContain('bg-surface-elevated');
    expect(styles.root()).toContain('border');
    expect(styles.root()).toContain('rounded-contain');
    expect(styles.header()).toContain('border-b');
    expect(styles.pre()).toContain('px-3');
  });

  /**
   * The whole point of `plain` is that an embedding parent already owns the
   * frame. If any of these leaked through, the block would draw a second outline
   * at the same radius INSIDE the first — the nested-card look this variant
   * exists to remove. Asserted per property, not as one blob, so a partial
   * regression cannot hide behind a passing test.
   */
  it('strips surface, outline, radius and padding for the embedded variant', () => {
    const styles = codeBlockVariants({ variant: 'plain' });
    const root = styles.root();
    expect(root, 'no surface of its own').not.toMatch(/\bbg-surface-/);
    // Anchored to a class boundary on purpose: `box-border` is box-sizing, not
    // an outline, and a looser /\bborder/ matches it.
    expect(root, 'no outline of its own').not.toMatch(/(^|\s)border(-|\s|$)/);
    expect(root, 'no radius of its own').not.toMatch(/\brounded-/);
    // No divider under the header either — there is no frame to divide.
    expect(styles.header(), 'no header divider').not.toMatch(/\bborder-b\b/);
    // The parent supplies the inset; a `plain` block that padded itself would
    // double the parent's padding on every side.
    expect(styles.pre(), 'no padding of its own').not.toMatch(/\bp[xy]?-\d/);
  });

  it('keeps the scroll affordance in both variants — it is behaviour, not chrome', () => {
    for (const variant of ['card', 'plain'] as const) {
      // Horizontal overflow must stay inside the block rather than the page,
      // and the focus ring is how a keyboard user knows they can scroll it.
      expect(codeBlockVariants({ variant, wrap: false }).pre()).toContain('overflow-x-auto');
      expect(codeBlockVariants({ variant }).pre()).toContain('focus-visible:ring-2');
    }
  });

  it('swaps scroll for wrapping when wrap is on', () => {
    const wrapped = codeBlockVariants({ wrap: true });
    expect(wrapped.pre()).toContain('whitespace-pre-wrap');
    expect(wrapped.pre()).not.toContain('overflow-x-auto');
  });

  it('never emits dark: overrides', () => {
    for (const variant of ['card', 'plain'] as const) {
      const styles = codeBlockVariants({ variant });
      for (const slot of SLOTS) {
        expect(styles[slot]()).not.toMatch(/\bdark:/);
      }
    }
  });
});

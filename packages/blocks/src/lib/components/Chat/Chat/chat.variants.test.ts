import { describe, expect, it } from 'vitest';
import { chatVariants } from './chat.variants';

const SLOTS = ['root', 'header', 'body', 'composer'] as const;

describe('chatVariants', () => {
  it('provides all slot functions', () => {
    const styles = chatVariants();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('lays the root out as a full-height flex column that clamps to min-h-0', () => {
    const root = chatVariants().root();
    expect(root).toContain('flex');
    expect(root).toContain('flex-col');
    expect(root).toContain('h-full');
    expect(root).toContain('min-h-0');
  });

  it('flexes the body to fill and hands it the scroll budget (min-h-0)', () => {
    const body = chatVariants().body();
    expect(body).toContain('flex-1');
    expect(body).toContain('min-h-0');
    // The shell itself never scrolls — no overflow on the body slot.
    expect(body).not.toContain('overflow');
  });

  it('separates header and composer with border tokens', () => {
    expect(chatVariants().header()).toContain('border-b');
    expect(chatVariants().header()).toContain('border-border-subtle');
    expect(chatVariants().composer()).toContain('border-t');
    expect(chatVariants().composer()).toContain('border-border-subtle');
  });

  it('never emits dark: overrides', () => {
    const styles = chatVariants();
    for (const slot of SLOTS) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { apiReferenceVariants } from './apireference.variants';

describe('apiReferenceVariants', () => {
  it('returns all expected slot functions', () => {
    const styles = apiReferenceVariants();
    const expectedSlots = [
      'base',
      'stats',
      'nameCode',
      'spreadCode',
      'typeCode',
      'typeChip',
      'defaultCode',
      'description',
      'descriptionCell',
      'seeAlsoRefs',
      'seeAlsoRef',
      'placeholder',
      'link',
      'typeLink',
      'highlightRing',
      'usageNotes'
    ];

    for (const slot of expectedSlots) {
      expect(typeof (styles as Record<string, unknown>)[slot]).toBe('function');
    }
  });

  it('uses semantic design tokens in base classes', () => {
    const styles = apiReferenceVariants();

    expect(styles.nameCode()).toContain('text-text-primary');
    expect(styles.typeCode()).toContain('text-text-secondary');
    expect(styles.description()).toContain('text-text-secondary');
    expect(styles.placeholder()).toContain('text-text-tertiary');
    expect(styles.link()).toContain('text-primary');
  });

  it('styles prose @see references as a quiet non-link footnote', () => {
    // The seeAlsoRefs block is the only surface for `@see` values that name a
    // type instead of a URL, so it must not borrow the `link` treatment.
    const styles = apiReferenceVariants();

    expect(styles.seeAlsoRefs()).toContain('text-text-tertiary');
    expect(styles.seeAlsoRefs()).not.toContain('text-primary');
    expect(styles.seeAlsoRef()).toContain('bg-surface-quiet');
    expect(styles.seeAlsoRef()).toContain('font-mono');
    expect(styles.seeAlsoRef()).not.toContain('underline');
  });

  it('stacks the description cell so refs sit under the description text', () => {
    const styles = apiReferenceVariants();
    expect(styles.descriptionCell()).toContain('flex');
    expect(styles.descriptionCell()).toContain('flex-col');
  });
});

import { describe, expect, it } from 'vitest';
import { apiReferenceVariants } from './apireference.variants';

describe('apiReferenceVariants', () => {
  it('exposes exactly the expected slots', () => {
    const styles = apiReferenceVariants();
    const expectedSlots = [
      'base',
      'stats',
      'requiredCount',
      'nameCell',
      'typeChips',
      'nameCode',
      'deprecatedCode',
      'spreadCode',
      'typeCode',
      'typeChip',
      'defaultCode',
      'description',
      'deprecationNote',
      'descriptionClamped',
      'expandedPanel',
      'signature',
      'sourceSection',
      'sourceName',
      'sourceLink',
      'valuesSection',
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

    // Both directions: a one-sided check lets a slot that no longer appears in
    // the markup linger in the config forever (TypesReference carried a dead
    // `expandedRow` slot exactly this way). Every slot the config exposes must
    // be an intentional, listed one.
    expect(Object.keys(styles).sort()).toEqual([...expectedSlots].sort());
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

  it('clamps the in-row description without clamping the expanded one', () => {
    // The clamp is a separate slot rather than part of `description`, because
    // the same slot styles the full text in the expanded row — folded into one,
    // the disclosure would show the same two lines the cell already showed.
    const styles = apiReferenceVariants();

    expect(styles.descriptionClamped()).toContain('line-clamp-2');
    expect(styles.description()).not.toContain('line-clamp');
  });

  it('prints the declaration line as a quiet code block, not as a link', () => {
    // The expanded row's counterpart to the type definition TypesReference
    // shows there: same quiet tint, same mono, and no link treatment.
    const styles = apiReferenceVariants();

    expect(styles.signature()).toContain('bg-surface-quiet');
    expect(styles.signature()).toContain('font-mono');
    // On a word boundary, not as a substring: the signature carries
    // `text-text-primary`, which contains `text-primary` and would pass a
    // `toContain` check that is supposed to reject the link colour.
    expect(styles.signature().split(/\s+/)).not.toContain('text-primary');
    expect(styles.sourceName()).toContain('bg-surface-quiet');
    expect(styles.sourceName()).not.toContain('underline');
  });
});

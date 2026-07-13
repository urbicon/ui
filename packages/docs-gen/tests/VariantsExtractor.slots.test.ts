import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { VariantsExtractor } from '../src/extractors/variants/VariantsExtractor';

// ---------------------------------------------------------------------------
// The catalog reported `slots: []` for nearly every slotted component because
// the slot names live behind a derived alias (`type CardSlots =
// SlotNames<typeof cardVariants>`) that no prop-type regex can resolve. The
// real source is the tv() `slots:` block, which VariantsExtractor now parses.
// These tests pin that AST extraction against tv() fixtures.
// ---------------------------------------------------------------------------

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

let extractor: VariantsExtractor;

beforeAll(() => {
  // The extractor logs progress; keep the suite output clean.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  extractor = new VariantsExtractor();
});

describe('VariantsExtractor.extractSlotNames — tv() slots: keys', () => {
  it('lifts the slots: keys in source order (base, header, content, footer)', async () => {
    const fixture = path.join(FIXTURES, 'card-slots.variants.ts');
    const slots = await extractor.extractSlotNames({
      componentPath: fixture,
      componentName: 'Card',
      variantsFilePath: fixture
    });
    // Source order, NOT alphabetical — base-first is the useful reading order.
    expect(slots).toEqual(['base', 'header', 'content', 'footer']);
  });

  it('returns [] for a tv() config with no slots: block (single-slot component)', async () => {
    const fixture = path.join(FIXTURES, 'button-noslots.variants.ts');
    const slots = await extractor.extractSlotNames({
      componentPath: fixture,
      componentName: 'Button',
      variantsFilePath: fixture
    });
    expect(slots).toEqual([]);
  });

  it('returns [] when no variants file exists (does not throw)', async () => {
    const slots = await extractor.extractSlotNames({
      componentPath: '/nonexistent/Ghost/index.ts',
      componentName: 'Ghost'
    });
    expect(slots).toEqual([]);
  });

  it('leaves the variant list free of a bogus "slots" entry', async () => {
    // Slots must never surface as a variant (would become a fake API prop).
    const fixture = path.join(FIXTURES, 'card-slots.variants.ts');
    const result = await extractor.extract({
      componentPath: fixture,
      componentName: 'Card',
      variantsFilePath: fixture
    });
    const names = (result.data ?? []).map((v) => v.name);
    expect(names).toContain('variant');
    expect(names).not.toContain('slots');
    expect(names).not.toContain('slot');
  });
});

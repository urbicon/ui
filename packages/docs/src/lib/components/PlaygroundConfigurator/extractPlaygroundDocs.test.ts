import { describe, expect, it } from 'vitest';
import { extractPlaygroundDocs } from './index';

describe('extractPlaygroundDocs', () => {
  it('extracts direct prop descriptions into propDocs', () => {
    const { propDocs } = extractPlaygroundDocs([
      { name: 'label', description: 'Button text content', source: { type: 'direct' } },
      { name: 'disabled', description: 'Disables the element', source: { type: 'direct' } }
    ]);

    expect(propDocs).toEqual({
      label: 'Button text content',
      disabled: 'Disables the element'
    });
  });

  it('separates variant-only keys from direct props', () => {
    const { variantKeys } = extractPlaygroundDocs([
      { name: 'size', description: 'Controls size', source: { type: 'variant' } },
      { name: 'intent', description: 'Semantic color', source: { type: 'variant' } }
    ]);

    expect(variantKeys).toContain('size');
    expect(variantKeys).toContain('intent');
  });

  it('direct descriptions win over variant sources', () => {
    const { propDocs, variantKeys } = extractPlaygroundDocs([
      { name: 'size', description: 'Size from variant', source: { type: 'variant' } },
      { name: 'size', description: 'Manual size description', source: { type: 'direct' } }
    ]);

    expect(propDocs.size).toBe('Manual size description');
    expect(variantKeys).not.toContain('size');
  });

  it('ignores props without descriptions', () => {
    const { propDocs, variantKeys } = extractPlaygroundDocs([
      { name: 'class' },
      { name: 'children', description: undefined }
    ]);

    expect(propDocs).toEqual({});
    expect(variantKeys).toEqual([]);
  });

  it('handles empty input', () => {
    const { propDocs, variantKeys } = extractPlaygroundDocs([]);

    expect(propDocs).toEqual({});
    expect(variantKeys).toEqual([]);
  });

  it('handles mixed sources correctly', () => {
    const result = extractPlaygroundDocs([
      { name: 'variant', description: 'Visual style', source: { type: 'variant' } },
      { name: 'label', description: 'Text content', source: { type: 'direct' } },
      { name: 'intent', description: 'Semantic color', source: { type: 'variant' } },
      { name: 'disabled', description: 'Disable interactions', source: { type: 'direct' } },
      { name: 'class' }
    ]);

    expect(result.propDocs).toEqual({
      label: 'Text content',
      disabled: 'Disable interactions'
    });
    expect(result.variantKeys).toEqual(['variant', 'intent']);
  });

  it('handles props without source field', () => {
    const { propDocs, variantKeys } = extractPlaygroundDocs([
      { name: 'foo', description: 'Some prop' }
    ]);

    expect(propDocs.foo).toBe('Some prop');
    expect(variantKeys).toEqual([]);
  });

  it('preserves original description text exactly', () => {
    const description = 'Error message that replaces helper text, styles red, sets aria-invalid.';
    const { propDocs } = extractPlaygroundDocs([
      { name: 'error', description, source: { type: 'direct' } }
    ]);

    expect(propDocs.error).toBe(description);
  });
});

// `@summary` on a prop: the knob-side line, distinct from the agent-side
// contract. Added 2026-07-28 after `CurrencyInput.locale` put nine lines of
// SSR-hydration prose next to a three-way switch.
describe('extractPlaygroundDocs — prop summaries', () => {
  it('prefers a summary over the description', () => {
    const { propDocs } = extractPlaygroundDocs([
      {
        name: 'locale',
        summary: 'Number and currency formatting.',
        description:
          'BCP 47 locale for Intl.NumberFormat. Resolved once on the server and reused on the client so hydration cannot disagree; `currency` is never auto-detected from it.',
        source: { type: 'direct' }
      }
    ]);

    expect(propDocs.locale).toBe('Number and currency formatting.');
  });

  it('falls back to the description when there is no summary', () => {
    const { propDocs } = extractPlaygroundDocs([
      { name: 'disabled', description: 'Disables the element', source: { type: 'direct' } }
    ]);

    expect(propDocs.disabled).toBe('Disables the element');
  });

  it('counts a summary-only prop as documented', () => {
    // A prop may carry only the short line; dropping it would hide the knob's
    // help entirely rather than falling back to something longer.
    const { propDocs } = extractPlaygroundDocs([
      {
        name: 'wrap',
        summary: 'Lets the row break onto a second line.',
        source: { type: 'direct' }
      }
    ]);

    expect(propDocs.wrap).toBe('Lets the row break onto a second line.');
  });
});

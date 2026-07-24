import { describe, expect, it } from 'vitest';
import { pinInputVariants } from '$lib/components/PinInput/pin-input.variants';
import { timeInputVariants } from '$lib/components/TimeInput/time-input.variants';
import { comboboxVariants } from '$lib/primitives/Combobox/combobox.variants';
import { inputVariants } from '$lib/primitives/Input/input.variants';
import { selectVariants } from '$lib/primitives/Select/select.variants';
import { textareaVariants } from '$lib/primitives/Textarea/textarea.variants';
import { FIELD_MESSAGE_TONES, fieldErrorFrame } from './field-chrome';

/**
 * Form-family validation invariants. These are cross-component rules, so they
 * live with the shared fragments rather than in one component's test file — a
 * field that joins the family is added to the tables below.
 */

/** The four fields that carry BOTH a tonal `intent` axis and a boolean `error`. */
const DUAL_AXIS = [
  ['Input', inputVariants, 'base', 'focus-visible'],
  ['Textarea', textareaVariants, 'base', 'focus-visible'],
  ['PinInput', pinInputVariants, 'cell', 'focus-visible'],
  ['TimeInput', timeInputVariants, 'field', 'focus-within']
] as const;

const INTENTS = ['success', 'warning', 'danger'] as const;

describe('field validation precedence', () => {
  describe.each(DUAL_AXIS)('%s', (_name, variants, slot, focus) => {
    it('paints the intent frame while the field is valid', () => {
      for (const intent of INTENTS) {
        const resolved = (variants as (p: Record<string, unknown>) => Record<string, () => string>)(
          {
            intent,
            error: false
          }
        )[slot]();
        expect(resolved).toContain(`border-${intent}`);
        expect(resolved).toContain(`${focus}:ring-${intent}/20`);
      }
    });

    it('lets `error` beat `intent` — the intent frame is gone, not just outranked', () => {
      for (const intent of INTENTS) {
        const resolved = (variants as (p: Record<string, unknown>) => Record<string, () => string>)(
          {
            intent,
            error: true
          }
        )[slot]();
        expect(resolved).toContain(fieldErrorFrame(focus));
        if (intent !== 'danger') {
          // The losing frame must not survive anywhere in the output — a
          // leftover `border-success` would be a live class, not dead weight.
          expect(resolved).not.toContain(`border-${intent}`);
          expect(resolved).not.toContain(`${focus}:ring-${intent}/20`);
        }
      }
    });

    it('applies the error frame in the compound stage, not by axis order', () => {
      // The rule must not depend on `error` happening to be DECLARED after
      // `intent`: compounds always fold after every axis, so an error frame
      // emitted there wins whatever the axis order is. Guarding the structure
      // (not just its current effect) is what keeps a later axis reshuffle from
      // silently turning validation feedback back into a green/amber frame.
      const config = (variants as unknown as { config: Record<string, unknown> }).config;
      const axis = (config.variants as Record<string, Record<string, Record<string, string>>>).error
        .true;
      expect(axis[slot]).toBeUndefined();

      const compounds = config.compoundVariants as Array<Record<string, unknown>>;
      const rule = compounds.find(
        (c) => c.error === true && Object.keys(c).length === 2 && c.class != null
      );
      expect(rule).toBeDefined();
      const frame = (rule as { class: Record<string, string> }).class;
      expect(frame[slot]).toBe(fieldErrorFrame(focus));
    });
  });

  describe.each([
    ['Select', selectVariants, 'trigger', 'focus-visible'],
    ['Combobox', comboboxVariants, 'input', 'focus-visible'],
    ['Combobox (multi tokenizer)', comboboxVariants, 'control', 'focus-within']
  ] as const)('%s', (_name, variants, slot, focus) => {
    it('uses the shared error frame (no hand-copied twin)', () => {
      const resolved = (variants as (p: Record<string, unknown>) => Record<string, () => string>)({
        error: true
      })[slot]();
      expect(resolved).toContain(fieldErrorFrame(focus));
      // The frame replaces the resting border rather than stacking on it.
      expect(resolved).not.toContain('border-border-subtle');
    });
  });
});

describe('field message tone follows the role of the text', () => {
  describe.each([
    ['Input', inputVariants],
    ['Textarea', textareaVariants],
    ['PinInput', pinInputVariants],
    ['TimeInput', timeInputVariants],
    ['Select', selectVariants]
  ] as const)('%s', (_name, variants) => {
    it('reads red as an error, quiet as a helper', () => {
      const resolve = variants as (p: Record<string, unknown>) => Record<string, () => string>;
      expect(resolve({ messageType: 'error' }).message()).toContain(FIELD_MESSAGE_TONES.error);
      expect(resolve({ messageType: 'helper' }).message()).toContain(FIELD_MESSAGE_TONES.helper);
      expect(resolve({ messageType: 'helper' }).message()).not.toContain(FIELD_MESSAGE_TONES.error);
      // `error: true` without an explicit messageType still reads as an error.
      expect(resolve({ error: true }).message()).toContain(FIELD_MESSAGE_TONES.error);
    });
  });

  it('Combobox splits the two roles across two slots instead of an axis', () => {
    // Combobox renders error and helper through separate slots (they are
    // mutually exclusive in the markup), so the tone is a slot constant. The
    // helper must stay quiet even while the field is invalid.
    const styles = comboboxVariants({ error: true });
    expect(styles.message()).toContain(FIELD_MESSAGE_TONES.error);
    expect(styles.helper()).toContain(FIELD_MESSAGE_TONES.helper);
    expect(styles.helper()).not.toContain(FIELD_MESSAGE_TONES.error);
  });
});

import { describe, expect, it } from 'vitest';
import { computeFormFieldAria } from './use-form-field.svelte';

/**
 * Direct unit tests against the pure-function core. The reactive
 * `useFormField` wrapper has no logic of its own — it is exercised
 * implicitly by every component that adopts the hook (Input, Textarea,
 * Select, Combobox, Checkbox, Toggle, etc.) and by FormField itself.
 */
describe('computeFormFieldAria', () => {
  it('passes through fieldId verbatim', () => {
    expect(computeFormFieldAria({ fieldId: 'email' }).fieldId).toBe('email');
  });

  it('generates errorId only when error is set', () => {
    expect(computeFormFieldAria({ fieldId: 'a' }).errorId).toBeUndefined();
    expect(computeFormFieldAria({ fieldId: 'a', error: 'bad' }).errorId).toBe('a-error');
  });

  it('empty string error is treated as no error', () => {
    expect(computeFormFieldAria({ fieldId: 'a', error: '' }).errorId).toBeUndefined();
    expect(computeFormFieldAria({ fieldId: 'a', error: '' }).invalid).toBe(false);
  });

  it('whitespace-only error is treated as truthy — caller is responsible for trimming', () => {
    // JS truthiness: any non-empty string is truthy. We document this so a
    // future consumer who passes `'   '` knows what to expect; components
    // that want to ignore whitespace should `.trim()` before calling the hook.
    const out = computeFormFieldAria({ fieldId: 'a', error: '   ' });
    expect(out.invalid).toBe(true);
    expect(out.errorId).toBe('a-error');
    expect(out.describedBy).toBe('a-error');
  });

  it('generates helperId only when helper is set AND no error', () => {
    expect(computeFormFieldAria({ fieldId: 'b', helper: 'help' }).helperId).toBe('b-helper');
    expect(
      computeFormFieldAria({ fieldId: 'b', helper: 'help', error: 'no' }).helperId
    ).toBeUndefined();
  });

  it('describedBy points at error when set', () => {
    expect(computeFormFieldAria({ fieldId: 'c', error: 'oops' }).describedBy).toBe('c-error');
  });

  it('describedBy points at helper when no error', () => {
    expect(computeFormFieldAria({ fieldId: 'c', helper: 'help' }).describedBy).toBe('c-helper');
  });

  it('describedBy puts error first when error replaces helper (still only error visible)', () => {
    // Error suppresses helper, so describedBy is just the error id.
    expect(computeFormFieldAria({ fieldId: 'c', helper: 'help', error: 'oops' }).describedBy).toBe(
      'c-error'
    );
  });

  it('describedBy is undefined when no description is set', () => {
    expect(computeFormFieldAria({ fieldId: 'd' }).describedBy).toBeUndefined();
  });

  it('invalid mirrors !!error', () => {
    expect(computeFormFieldAria({ fieldId: 'x' }).invalid).toBe(false);
    expect(computeFormFieldAria({ fieldId: 'x', error: '' }).invalid).toBe(false);
    expect(computeFormFieldAria({ fieldId: 'x', error: 'x' }).invalid).toBe(true);
  });

  it('required and disabled flags are coerced to boolean and exposed verbatim', () => {
    expect(computeFormFieldAria({ fieldId: 'x', required: true }).required).toBe(true);
    expect(computeFormFieldAria({ fieldId: 'x', required: false }).required).toBe(false);
    expect(computeFormFieldAria({ fieldId: 'x' }).required).toBe(false);
    expect(computeFormFieldAria({ fieldId: 'x', disabled: true }).disabled).toBe(true);
    expect(computeFormFieldAria({ fieldId: 'x' }).disabled).toBe(false);
  });

  it('all fields together (smoke)', () => {
    const out = computeFormFieldAria({
      fieldId: 'field-42',
      helper: 'Pick a strong one',
      error: undefined,
      required: true,
      disabled: false
    });
    expect(out).toEqual({
      fieldId: 'field-42',
      errorId: undefined,
      helperId: 'field-42-helper',
      describedBy: 'field-42-helper',
      invalid: false,
      required: true,
      disabled: false
    });
  });
});

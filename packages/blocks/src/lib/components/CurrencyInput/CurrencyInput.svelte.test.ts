// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CurrencyInput from './CurrencyInput.svelte';

// Interaction layer for CurrencyInput — the parse/format contract the variant tests can't reach.
// Its headline invariant: `value` is stored in **minor units** (integer cents), never a float — so
// typing "12.34" yields 1234, and 123456 renders as "1,234.56". Formatting is locale-driven
// (grouping + decimal separator + symbol via Intl.NumberFormat). Passing an explicit `locale` (a
// BCP 47 string) makes the tests deterministic and sidesteps the i18n provider entirely: the
// component reads useI18n().locale only for the `'auto'` default, and that read is tolerant (falls
// back to the base locale with no provider). Same stack as the Combobox pilot: svelte's own
// mount/unmount, @testing-library/dom + user-event, native matchers.
//
// Typing uses fireEvent.input with the full string so each assertion targets one deterministic
// parse of the whole value (handleInput re-sanitises target.value on every event). The caret
// restoration (requestAnimationFrame + setSelectionRange) is layout-driven — that's Playwright's
// job, not asserted here.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCurrency(props: ComponentProps<typeof CurrencyInput> = {}) {
  const instance = mount(CurrencyInput, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;

function type(value: string) {
  fireEvent.input(input(), { target: { value } });
  flushSync();
}

describe('CurrencyInput (component interaction)', () => {
  it('formats an integer cents value for display with grouping (en-US)', () => {
    renderCurrency({ value: 123456, locale: 'en-US' });
    expect(input().value).toBe('1,234.56');
  });

  it('uses the locale decimal + grouping separators (de-DE)', () => {
    renderCurrency({ value: 123456, locale: 'de-DE' });
    expect(input().value).toBe('1.234,56');
  });

  it('parses typed input into minor units (cents) and fires onValueChange', () => {
    const onValueChange = vi.fn();
    renderCurrency({ locale: 'en-US', onValueChange });

    type('1234.56');

    // Stored value is the integer 123456 cents, not the float 1234.56.
    expect(onValueChange).toHaveBeenLastCalledWith(123456);
    // …and the field reformats with grouping as you type.
    expect(input().value).toBe('1,234.56');
  });

  it('parses a negative value into negative minor units', () => {
    const onValueChange = vi.fn();
    renderCurrency({ locale: 'en-US', onValueChange });

    type('-5');

    // precision 2 → "-5" major units is -500 cents.
    expect(onValueChange).toHaveBeenLastCalledWith(-500);
  });

  it('honours precision=0 (whole units, no fractional digits)', () => {
    const onValueChange = vi.fn();
    renderCurrency({ value: 1000, locale: 'en-US', precision: 0, onValueChange });

    // No decimal part at precision 0.
    expect(input().value).toBe('1,000');

    type('42');
    expect(onValueChange).toHaveBeenLastCalledWith(42);
  });

  it('clearing the field yields a null value', () => {
    const onValueChange = vi.fn();
    renderCurrency({ value: 1234, locale: 'en-US', onValueChange });
    expect(input().value).toBe('12.34');

    type('');
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(input().value).toBe('');
  });

  it('renders the currency symbol for prefix/suffix and omits it for none', () => {
    renderCurrency({ value: 500, locale: 'en-US', currency: 'USD', symbolPosition: 'suffix' });
    expect(document.body.textContent).toContain('$');

    dispose?.();
    document.body.replaceChildren();
    renderCurrency({ value: 500, locale: 'en-US', currency: 'USD', symbolPosition: 'none' });
    expect(document.body.textContent).not.toContain('$');
  });

  it('carries the raw minor-unit value in the hidden input, not the formatted display', () => {
    renderCurrency({ value: 123456, locale: 'en-US', name: 'price' });

    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"][name="price"]');
    expect(hidden).not.toBeNull();
    // The submitted value is the integer cents, never "1,234.56".
    expect(hidden?.value).toBe('123456');
  });

  it("locale='auto' falls back to the base locale (en) without a provider", () => {
    renderCurrency({ value: 123456, locale: 'auto' });
    // en grouping/decimal — proves the tolerant useI18n().locale read resolved to the base locale.
    expect(input().value).toBe('1,234.56');
  });
});

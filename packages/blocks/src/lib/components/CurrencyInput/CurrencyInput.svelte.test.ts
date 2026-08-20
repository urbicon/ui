// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, tick, unmount } from 'svelte';
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
// parse of the whole value. The keystroke suite at the bottom is the other half: it edits the
// field the way a browser does — mutate the text, move the caret, dispatch `input` with an
// `inputType` — because the mask's contract is what the *field* ends up showing and where the
// caret ends up sitting, and neither survives being asserted on the value alone. The mapping
// itself is unit-tested in `currency.engine.test.ts`; what these cases guard is the wiring: the
// Input's own `bind:value` must not put the browser's raw text back on screen, and Svelte's
// flush must not drag the caret to the end of the field.

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

  it('truncates excess fractional digits instead of rounding (string-split, not parseFloat)', () => {
    const onValueChange = vi.fn();
    renderCurrency({ locale: 'en-US', onValueChange });

    // "1.999" at precision 2: the extra digit is truncated → 199 cents, NOT round(1.999*100)=200.
    // This is exactly the IEEE-754 drift the integer string-split parse exists to avoid, so it is
    // the assertion that actually locks the cents contract (a parseFloat*factor impl would give 200).
    type('1.999');
    expect(onValueChange).toHaveBeenLastCalledWith(199);
  });

  it('keeps a lone leading minus as an intermediate buffer', () => {
    renderCurrency({ locale: 'en-US' });

    // Typing just "-" is an intermediate state while composing a negative; the buffer must survive
    // so the next digit lands, rather than being wiped by formatDisplay(null) → ''.
    type('-');
    expect(input().value).toBe('-');
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

// ─── Keystrokes ───────────────────────────────────────────────────────────────
// One keypress, the way a browser delivers it: the text is already mutated and
// the caret already moved by the time `input` fires. `await tick()` afterwards
// lets Svelte's own `bind:value` finish — it re-checks the field a tick later
// and would be the thing to undo the mask if the wiring were wrong.

function focused(): HTMLInputElement {
  const el = input();
  el.focus();
  return el;
}

function place(caret: number) {
  focused().setSelectionRange(caret, caret);
}

async function press(inputType: string, mutate: (el: HTMLInputElement) => void) {
  const el = focused();
  mutate(el);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
  flushSync();
  await tick();
}

const backspace = () =>
  press('deleteContentBackward', (el) => {
    const end = el.selectionEnd ?? 0;
    const start = el.selectionStart === end ? Math.max(0, end - 1) : (el.selectionStart ?? end);
    el.value = el.value.slice(0, start) + el.value.slice(end);
    el.setSelectionRange(start, start);
  });

const typeChar = (ch: string) =>
  press('insertText', (el) => {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.value = el.value.slice(0, start) + ch + el.value.slice(end);
    el.setSelectionRange(start + ch.length, start + ch.length);
  });

/** The field as the user sees it, caret included. */
const field = () => {
  const el = input();
  return `${el.value.slice(0, el.selectionStart ?? 0)}|${el.value.slice(el.selectionStart ?? 0)}`;
};

describe('CurrencyInput (keystrokes)', () => {
  it('walks the caret through the fraction instead of past the separator', async () => {
    renderCurrency({ value: 2233_00, locale: 'de-DE' });
    expect(input().value).toBe('2.233,00');

    place(8);
    await backspace();
    expect(field()).toBe('2.233,0|0');

    // The reported defect landed here: the caret jumped in front of the comma
    // after the second delete, and could not be put back behind it.
    await backspace();
    expect(field()).toBe('2.233,|00');

    await backspace();
    expect(field()).toBe('2.233|,00');
  });

  it('types into the fraction slot the caret sits on', async () => {
    renderCurrency({ value: 2233_45, locale: 'de-DE' });

    place(6);
    await typeChar('9');
    expect(field()).toBe('2.233,9|5');
    expect(input().value).toBe('2.233,95');
  });

  it('keeps the amount when the separator itself is deleted', async () => {
    const onValueChange = vi.fn();
    renderCurrency({ value: 2233_00, locale: 'de-DE', onValueChange });

    // Deleting the comma used to move every cent digit into the integer part —
    // a silent ×100, `2.233,00` → `223.300,00`.
    place(6);
    await backspace();
    expect(input().value).toBe('2.233,00');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('repaints the mask even where Svelte writes the field back', async () => {
    // An edit that leaves the amount unchanged — deleting a cent digit that is
    // already `0` — sends nothing down to the Input, so its own copy of the
    // field is the browser's raw text. Whenever Svelte gets to write that copy
    // back (here: an unfocused field, where its "never rewrite what the user is
    // typing in" guard does not apply), it must not be able to undo the mask.
    renderCurrency({ value: 2233_00, locale: 'de-DE' });
    const el = input();

    el.setSelectionRange(8, 8);
    el.value = '2.233,0';
    el.setSelectionRange(7, 7);
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })
    );
    flushSync();
    await tick();
    flushSync();

    expect(el.value).toBe('2.233,00');
    expect(el.selectionStart).toBe(7);
  });

  it('regroups while typing and keeps the caret on the typed digit', async () => {
    renderCurrency({ value: 999_00, locale: 'de-DE' });

    place(3);
    await typeChar('9');
    expect(field()).toBe('9.999|,00');
  });

  it('composes a negative amount one keystroke at a time', async () => {
    const onValueChange = vi.fn();
    renderCurrency({ locale: 'de-DE', onValueChange });

    place(0);
    await typeChar('-');
    expect(field()).toBe('-|');

    await typeChar('4');
    expect(field()).toBe('-4|,00');
    expect(onValueChange).toHaveBeenLastCalledWith(-400);
  });

  it('drops the half-composed sign when the field is left', async () => {
    renderCurrency({ locale: 'de-DE' });

    place(0);
    await typeChar('-');
    expect(input().value).toBe('-');

    input().dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    flushSync();
    expect(input().value).toBe('');
  });
});

// ─── Writes that are not keystrokes ──────────────────────────────────────────
// The field's text can be written by something other than a key: Input's clear
// button, a <form> reset, a restored `persistKey`, hydration adopting text typed
// before the JS arrived. Each of those goes through the same value binding and
// none of them raises an `input` event this component can read — so each used to
// change what the field *says* without changing what it *holds*, which on a
// money field means a form that submits the amount the user just cleared.

// A task, not a microtask: the component defers the read-back by `setTimeout`,
// because a browser drains microtasks between event listeners and one scheduled
// there would beat the component's own `input` handler to the edit.
const task = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Two turns, because Svelte's own form-reset handling defers by a microtask
// before the component's read-back is even scheduled.
async function settle() {
  await task();
  flushSync();
  await task();
  flushSync();
}

describe('CurrencyInput (writes that are not keystrokes)', () => {
  it('clearing through the Input clear button empties the value too', async () => {
    const onValueChange = vi.fn();
    renderCurrency({
      value: 123456,
      locale: 'en-US',
      name: 'price',
      clearable: true,
      onValueChange
    });
    expect(input().value).toBe('1,234.56');

    const clear = screen.getByRole('button');
    fireEvent.click(clear);
    flushSync();
    await settle();

    expect(input().value).toBe('');
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    expect(
      document.querySelector<HTMLInputElement>('input[type="hidden"][name="price"]')?.value
    ).toBe('');
  });

  it('a form reset takes the value with the text', async () => {
    const onValueChange = vi.fn();
    const form = document.createElement('form');
    document.body.appendChild(form);
    const instance = mount(CurrencyInput, {
      target: form,
      props: { value: 123456, locale: 'en-US', name: 'price', onValueChange }
    });
    dispose = () => unmount(instance);
    flushSync();

    form.reset();
    flushSync();
    await settle();

    expect(input().value).toBe('');
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it('a consumer that clamps the amount wins the field', async () => {
    // The archetypal money case: a max the consumer enforces from onValueChange.
    // Whatever it settles on is what the field must show — never the text of an
    // amount that was refused.
    const props = $state({ value: 900 as number | null, max: 5000 });
    const instance = mount(CurrencyInput, {
      target: document.body,
      props: {
        get value() {
          return props.value;
        },
        set value(v: number | null) {
          props.value = v === null || v <= props.max ? v : props.max;
        },
        locale: 'en-US',
        onValueChange: (v: number | null) => {
          if (v !== null && v > props.max) props.value = props.max;
        }
      }
    });
    dispose = () => unmount(instance);
    flushSync();
    expect(input().value).toBe('9.00');

    const el = input();
    el.focus();
    el.setSelectionRange(0, 0);
    el.value = '99.00';
    el.setSelectionRange(1, 1);
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '9' })
    );
    flushSync();

    // Synchronously, in the keystroke itself — not repaired a microtask later,
    // which would flash the refused amount on screen first.
    expect(props.value).toBe(5000);
    expect(input().value).toBe('50.00');
    expect(input().selectionStart).toBe('50.00'.length);

    await tick();
    await settle();
    expect(input().value).toBe('50.00');
  });
});

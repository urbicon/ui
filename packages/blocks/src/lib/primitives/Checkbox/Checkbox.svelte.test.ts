// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Checkbox from './Checkbox.svelte';
import type { CheckboxProps } from './index';

// Interaction layer for Checkbox — a native `<input type="checkbox">` visually
// hidden (`sr-only`) behind a styled box. The native control owns click/Space
// toggling; what needs a mounted DOM is the component's own logic on top: the
// `indeterminate` third state (`aria-checked="mixed"`, the reflected
// `input.indeterminate` flag, and the "resets to unchecked on next user toggle"
// contract) plus reading the post-change value from `event.target.checked` so
// `onCheckedChange` reports the value the user just set.
//
// Same stack + rationale as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderCheckbox(props: CheckboxProps = {}) {
  const instance = mount(Checkbox, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

describe('Checkbox (component interaction)', () => {
  it('renders an unchecked checkbox labelled by its wrapping label', () => {
    renderCheckbox({ label: 'Accept terms' });

    const el = box('Accept terms');
    expect(el.checked).toBe(false);
    expect(el.getAttribute('aria-checked')).toBeNull();
  });

  it('checks on click and fires onCheckedChange(true)', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', onCheckedChange });

    const el = box('Accept terms');
    await user.click(el);

    expect(el.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('unchecks on a second click, reporting false', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', checked: true, onCheckedChange });

    const el = box('Accept terms');
    expect(el.checked).toBe(true);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it('forwards a consumer-passed native onchange instead of swallowing it', async () => {
    // The internal handler sits after {...restProps} on the <input>, so a
    // consumer onchange used to land in restProps and get overridden — the
    // exact silent failure that broke Table's selection wiring (d7b4dfe).
    // It composes now: onCheckedChange stays canonical, the native handler
    // fires afterwards with the committed value on its target.
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const onchange = vi.fn();
    renderCheckbox({ label: 'Accept terms', onCheckedChange, onchange });

    const el = box('Accept terms');
    await user.click(el);

    expect(onchange).toHaveBeenCalledOnce();
    expect((onchange.mock.calls[0][0].target as HTMLInputElement).checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    // Internal-first ordering: the canonical callback observes the state
    // before the consumer's supplemental native handler runs.
    expect(onCheckedChange.mock.invocationCallOrder[0]).toBeLessThan(
      onchange.mock.invocationCallOrder[0]
    );
  });

  it('toggles via the keyboard Space key', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', onCheckedChange });

    const el = box('Accept terms');
    el.focus();
    await user.keyboard(' ');

    expect(el.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('exposes the indeterminate state via aria-checked="mixed" and the input flag', () => {
    renderCheckbox({ label: 'Select all', indeterminate: true });

    const el = box('Select all');
    // aria-checked is only set explicitly for the mixed state; checked/unchecked
    // rely on the native property.
    expect(el.getAttribute('aria-checked')).toBe('mixed');
    // The $effect mirrors the prop onto the DOM property (no HTML attribute exists
    // for it), which is what actually paints the dash in a real browser.
    expect(el.indeterminate).toBe(true);
  });

  it('clears indeterminate and becomes checked on the next user toggle', async () => {
    // The documented "resets to unchecked on next user toggle" contract: handleChange
    // flips `indeterminate` off, then reads event.target.checked (true) — so the box
    // lands in a definite checked state and the callback reports it. A variant test
    // can't reach this because it needs a real change event.
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Select all', indeterminate: true, onCheckedChange });

    const el = box('Select all');
    await user.click(el);
    flushSync();

    expect(el.checked).toBe(true);
    expect(el.indeterminate).toBe(false);
    expect(el.getAttribute('aria-checked')).toBeNull();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle or fire the callback when disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderCheckbox({ label: 'Accept terms', disabled: true, onCheckedChange });

    const el = box('Accept terms');
    expect(el.disabled).toBe(true);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('links an error message via role=alert and marks the input invalid', () => {
    renderCheckbox({ label: 'Accept terms', error: 'Required' });

    const el = box('Accept terms');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Required');
    // The error owns the describedby wiring so a screen reader announces it.
    expect(el.getAttribute('aria-describedby')).toBe(alert.id);
  });
});

describe('Checkbox (aria-describedby merge)', () => {
  // Form-family forwarding contract (docs/COMPONENT-API-CONVENTIONS.md
  // §restProps ordering): a consumer-supplied
  // `aria-describedby` is APPENDED to the internal error/helper chain — internal
  // id first, consumer id last — never dropped, never replaced. Checkbox used to
  // spread `{...restProps}` after the explicit attribute, so a consumer value
  // silently REPLACED the internal error/helper id.
  it('appends a consumer aria-describedby after the internal error id', () => {
    renderCheckbox({ label: 'Accept terms', error: 'Required', 'aria-describedby': 'ext-hint' });

    const el = box('Accept terms');
    const alert = screen.getByRole('alert');
    expect(el.getAttribute('aria-describedby')).toBe(`${alert.id} ext-hint`);
  });

  it('appends a consumer aria-describedby after the internal helper id', () => {
    renderCheckbox({
      label: 'Accept terms',
      helper: 'Read the fine print',
      'aria-describedby': 'ext-hint'
    });

    const el = box('Accept terms');
    const helper = screen.getByText('Read the fine print');
    expect(el.getAttribute('aria-describedby')).toBe(`${helper.id} ext-hint`);
  });

  it('keeps a consumer aria-describedby when there is no internal description', () => {
    renderCheckbox({ label: 'Accept terms', 'aria-describedby': 'ext-hint' });

    expect(box('Accept terms').getAttribute('aria-describedby')).toBe('ext-hint');
  });
});

describe('Checkbox (internal ARIA wins over restProps)', () => {
  // The <input> spreads `{...restProps}` FIRST, so the component's own computed
  // aria-* always win — a consumer can't silently override the checkbox's state
  // through restProps (mirrors Input's ordering). Regression guard for the
  // restProps ordering contract.
  it('keeps computed aria-invalid="true" when a consumer passes aria-invalid="false" and error is set', () => {
    renderCheckbox({ label: 'Accept terms', error: 'Required', 'aria-invalid': 'false' });

    // `error` dictates aria-invalid; the consumer's restProps value does not win.
    expect(box('Accept terms').getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps computed aria-checked="mixed" when a consumer passes aria-checked="false" and indeterminate is set', () => {
    renderCheckbox({ label: 'Select all', indeterminate: true, 'aria-checked': 'false' });

    // The indeterminate third state owns aria-checked="mixed".
    expect(box('Select all').getAttribute('aria-checked')).toBe('mixed');
  });
});

// The selected-error state (hero-review point 20b). Asserted through the DOM,
// not through `checkboxVariants({error, checked})`: the fold has been right all
// along, what was missing is that the rendered box carried nothing at all when
// an error hit a *checked* control. The guard has to be the element.
describe('Checkbox (error on a selected control)', () => {
  const styledBox = () => document.querySelector('label > span') as HTMLElement;

  it('marks a checked box with a danger ring and keeps the intent fill', () => {
    renderCheckbox({ checked: true, error: 'Not available on your plan', label: 'Notify me' });

    const cls = styledBox().className;
    expect(cls).toContain('ring-danger/60');
    // The fill still says WHAT is selected — repainting it danger would read as
    // "unselected", the opposite of the truth.
    expect(cls).toContain('bg-primary');
    expect(cls).not.toContain('bg-danger');
  });

  it('leaves a checked box unringed without an error', () => {
    renderCheckbox({ checked: true, label: 'Notify me' });

    // Negative half: without it a rule that rings unconditionally would pass
    // the assertion above and still be wrong.
    expect(styledBox().className).not.toContain('ring-danger');
  });

  it('keeps the danger border (not a ring) while unchecked', () => {
    renderCheckbox({ checked: false, error: 'Required', label: 'Notify me' });

    const cls = styledBox().className;
    expect(cls).toContain('border-danger');
    expect(cls).not.toContain('ring-danger/60');
  });

  it('marks the indeterminate state too', () => {
    renderCheckbox({ indeterminate: true, error: 'Partially unavailable', label: 'Notify me' });

    expect(styledBox().className).toContain('ring-danger/60');
  });
});

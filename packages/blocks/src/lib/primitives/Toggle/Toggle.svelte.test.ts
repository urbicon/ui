// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToggleProps } from './index';
import Toggle from './Toggle.svelte';

// Interaction layer for Toggle — a native `<input type="checkbox" role="switch">`
// visually hidden (`sr-only`) behind a styled track. The browser owns the toggle
// mechanics (click, Space); what only a mounted DOM test can verify is the
// component's own `onCheckedChange` contract: the JSDoc promises the callback
// "receives the new checked value", which hinges on reading the *post-change*
// state, not a stale binding. That timing is exactly what a variant test can't see.
//
// Same stack + rationale as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom). The
// input is `sr-only` (visually hidden, not a11y-hidden), so `getByRole('switch')`
// finds it without `{ hidden: true }` — jsdom applies no stylesheet, so it is a
// plain focusable control here.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderToggle(props: ToggleProps = {}) {
  const instance = mount(Toggle, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const toggle = (name: string) => screen.getByRole('switch', { name }) as HTMLInputElement;

describe('Toggle (component interaction)', () => {
  it('renders a switch labelled by its wrapping label, unchecked by default', () => {
    renderToggle({ label: 'Wireless' });

    const el = toggle('Wireless');
    expect(el.getAttribute('role')).toBe('switch');
    expect(el.checked).toBe(false);
    expect(el.getAttribute('aria-checked')).toBe('false');
  });

  it('toggles on click and fires onCheckedChange with the NEW value', async () => {
    // The contract discriminator: onCheckedChange must report `true` on the
    // first click, not the pre-change `false`. handleChange reads the bound
    // `checked` state, so this fails if the binding hasn't propagated when the
    // user `onchange` runs — the same timing Checkbox guards by reading
    // event.target.checked. A stale read would call the callback with `false`.
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', onCheckedChange });

    const el = toggle('Wireless');
    await user.click(el);

    expect(el.checked).toBe(true);
    expect(el.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenCalledOnce();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('toggles back off on a second click, reporting false', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', onCheckedChange });

    const el = toggle('Wireless');
    await user.click(el);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('toggles via the keyboard Space key (native switch activation)', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', onCheckedChange });

    const el = toggle('Wireless');
    el.focus();
    expect(document.activeElement).toBe(el);

    await user.keyboard(' ');

    expect(el.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle or fire the callback when disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    renderToggle({ label: 'Wireless', disabled: true, onCheckedChange });

    const el = toggle('Wireless');
    expect(el.disabled).toBe(true);
    await user.click(el);

    expect(el.checked).toBe(false);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('falls back to an accessible name when no label is given', () => {
    renderToggle({});
    // Without a label the input carries an explicit aria-label ('Toggle' EN
    // fallback), so it still exposes an accessible name to assistive tech.
    expect(screen.getByRole('switch')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-label')).toBeTruthy();
  });

  it('error replaces helper, announces via role="alert", and flags aria-invalid', () => {
    // Form-family symmetry (P1): Toggle gets the same error contract as its
    // boolean-control sibling Checkbox — error-over-helper exclusivity plus
    // the aria-invalid + aria-describedby wiring from useFormField.
    renderToggle({
      label: 'Accept terms',
      helper: 'Required before checkout',
      error: 'You must accept the terms'
    });

    const el = toggle('Accept terms');
    expect(el.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Required before checkout')).toBeNull();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('You must accept the terms');
    expect(el.getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('helper shows without error, with no aria-invalid', () => {
    renderToggle({ label: 'Accept terms', helper: 'Required before checkout' });

    const el = toggle('Accept terms');
    expect(el.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('Required before checkout')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Toggle (aria-describedby merge)', () => {
  // Form-family forwarding contract (docs/COMPONENT-API-CONVENTIONS.md
  // §restProps ordering): a consumer-supplied
  // `aria-describedby` is APPENDED to the internal error/helper chain — internal
  // id first, consumer id last — never dropped, never replaced. Toggle used to
  // spread `{...restProps}` after the explicit attribute, so a consumer value
  // silently REPLACED the internal error/helper id.
  it('appends a consumer aria-describedby after the internal error id', () => {
    renderToggle({
      label: 'Accept terms',
      error: 'You must accept the terms',
      'aria-describedby': 'ext-hint'
    });

    const el = toggle('Accept terms');
    const alert = screen.getByRole('alert');
    expect(el.getAttribute('aria-describedby')).toBe(`${alert.id} ext-hint`);
  });

  it('appends a consumer aria-describedby after the internal helper id', () => {
    renderToggle({
      label: 'Wireless',
      helper: 'Uses more battery',
      'aria-describedby': 'ext-hint'
    });

    const el = toggle('Wireless');
    const helper = screen.getByText('Uses more battery');
    expect(el.getAttribute('aria-describedby')).toBe(`${helper.id} ext-hint`);
  });

  it('keeps a consumer aria-describedby when there is no internal description', () => {
    renderToggle({ label: 'Wireless', 'aria-describedby': 'ext-hint' });

    expect(toggle('Wireless').getAttribute('aria-describedby')).toBe('ext-hint');
  });
});

describe('Toggle (internal ARIA wins over restProps)', () => {
  // The <input> spreads `{...restProps}` FIRST, so the component's own computed
  // aria-checked / aria-invalid always win — a consumer can't silently override
  // the switch's state through restProps (mirrors Input's ordering). Regression
  // guard for the restProps ordering contract.
  it('keeps computed aria-checked="true" when a consumer passes aria-checked="mixed" and checked is set', () => {
    renderToggle({ label: 'Wireless', checked: true, 'aria-checked': 'mixed' });

    // The switch is on; aria-checked tracks the bound state, not the restProps value.
    expect(toggle('Wireless').getAttribute('aria-checked')).toBe('true');
  });

  it('keeps computed aria-invalid="true" when a consumer passes aria-invalid="false" and error is set', () => {
    renderToggle({
      label: 'Accept terms',
      error: 'You must accept the terms',
      'aria-invalid': 'false'
    });

    expect(toggle('Accept terms').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('Toggle (consumer aria-label survives without a visible label)', () => {
  // The reorder made `{...restProps}` spread first, so `aria-label` is now
  // destructured out and folded into the internal fallback chain — a consumer's
  // external label is preferred over the generic i18n fallback when there is no
  // visible `label`, instead of being clobbered by it.
  it('renders the consumer aria-label (not the generic fallback) when no visible label is given', () => {
    renderToggle({ 'aria-label': 'Notify me' });

    expect(screen.getByRole('switch').getAttribute('aria-label')).toBe('Notify me');
  });

  it('a visible label still wins — the switch carries no aria-label so names cannot diverge', () => {
    renderToggle({ label: 'Wireless', 'aria-label': 'Notify me' });

    // The wrapping <label> names the control; the consumer aria-label is the
    // fallback, not an override, so it is not applied here.
    expect(toggle('Wireless').getAttribute('aria-label')).toBeNull();
  });
});

// Selected-error state — hero-review point 20b. See the long rationale in
// checkbox.variants.ts: the boolean rule ("must be switched on") keeps the off
// state's danger boundary, and the on state gains a ring so an error on an
// already-enabled switch is visible at all.
describe('Toggle (error on a switched-on control)', () => {
  const track = () => document.querySelector('label > span') as HTMLElement;

  it('rings an on switch and keeps its intent fill', () => {
    renderToggle({ checked: true, error: 'This integration was revoked', label: 'Sync' });

    const cls = track().className;
    expect(cls).toContain('ring-danger/60');
    expect(cls).toContain('bg-primary');
  });

  it('does not ring an on switch without an error', () => {
    renderToggle({ checked: true, label: 'Sync' });
    expect(track().className).not.toContain('ring-danger');
  });

  it('keeps the danger border on the off state', () => {
    renderToggle({ checked: false, error: 'Must be enabled', label: 'Sync' });

    const cls = track().className;
    expect(cls).toContain('border-danger');
    expect(cls).not.toContain('ring-danger/60');
  });
});

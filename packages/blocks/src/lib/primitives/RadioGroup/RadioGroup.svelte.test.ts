// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RadioHarness from './__fixtures__/RadioHarness.svelte';
import type { RadioGroupProps, RadioItemProps } from './index';

// Interaction layer for RadioGroup — native <input type="radio"> children under
// a role=radiogroup, with the W3C radio pattern: selection follows focus (arrows
// move focus and check in one step), wrap-around, and disabled radios skipped.
// RadioGroup already skips disabled via a `:not(:disabled)` DOM query, so the
// disabled test here is a regression guard, not a fix. RadioItem reads context,
// so the test mounts a real composition (RadioHarness). Same stack as the
// Combobox pilot: svelte's own mount/unmount, @testing-library/dom + user-event,
// native vitest matchers. RadioGroup defaults to vertical orientation.

type Item = { value: string; label: string; disabled?: boolean };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderRadios(
  props: Partial<RadioGroupProps> & { items?: Item[]; itemProps?: Partial<RadioItemProps> } = {}
) {
  const instance = mount(RadioHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

describe('RadioGroup (component interaction)', () => {
  it('renders a radiogroup of radios with nothing checked by default', () => {
    renderRadios();

    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(radio('Small').checked).toBe(false);
    expect(radio('Medium').checked).toBe(false);
  });

  it('selects a radio on click and fires onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderRadios({ onValueChange });

    await user.click(radio('Medium'));

    expect(radio('Medium').checked).toBe(true);
    expect(radio('Small').checked).toBe(false);
    expect(onValueChange).toHaveBeenCalledWith('medium');
  });

  it('keeps only the checked radio in the tab order (roving tabindex)', () => {
    renderRadios({ value: 'medium' });

    expect(radio('Medium').getAttribute('tabindex')).toBe('0');
    expect(radio('Small').getAttribute('tabindex')).toBe('-1');
    expect(radio('Large').getAttribute('tabindex')).toBe('-1');
  });

  it('treats an empty-string value as a real selection, not as "nothing checked"', () => {
    // A group whose "none" option carries `value=""` — the shape the table's
    // sort and grouping lists use. `''` is falsy, so the "nothing is checked,
    // keep the group reachable" branch used to fire and hand a tab stop to
    // every row: 21 tab stops for 20 sortable columns instead of one.
    renderRadios({
      value: '',
      items: [
        { value: '', label: 'None' },
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' }
      ]
    });

    expect(radio('None').getAttribute('tabindex')).toBe('0');
    expect(radio('Small').getAttribute('tabindex')).toBe('-1');
    expect(radio('Medium').getAttribute('tabindex')).toBe('-1');
  });

  it('keeps every enabled radio reachable while genuinely nothing is checked', () => {
    // The other side of the same branch: with no `value` at all the group must
    // not fall out of the tab order.
    renderRadios();

    expect(radio('Small').getAttribute('tabindex')).toBe('0');
    expect(radio('Medium').getAttribute('tabindex')).toBe('0');
    expect(radio('Large').getAttribute('tabindex')).toBe('0');
  });

  it('ArrowDown moves focus and checks the next radio (selection follows focus), wrapping', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderRadios({ value: 'small', onValueChange });

    radio('Small').focus();
    await user.keyboard('{ArrowDown}');
    expect(radio('Medium').checked).toBe(true);
    expect(document.activeElement).toBe(radio('Medium'));

    await user.keyboard('{ArrowDown}'); // → Large
    await user.keyboard('{ArrowDown}'); // wraps → Small
    expect(radio('Small').checked).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith('small');
  });

  it('skips a disabled radio during keyboard navigation', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderRadios({
      value: 'a',
      onValueChange,
      items: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' }
      ]
    });

    radio('A').focus();
    await user.keyboard('{ArrowDown}');

    // The `:not(:disabled)` query drops B from the roving set, so ArrowDown
    // lands on C.
    expect(radio('C').checked).toBe(true);
    expect(radio('B').checked).toBe(false);
    expect(document.activeElement).toBe(radio('C'));
    expect(onValueChange).toHaveBeenLastCalledWith('c');
  });

  it('navigates with ArrowRight when orientation is horizontal', async () => {
    const user = userEvent.setup();
    renderRadios({ value: 'small', orientation: 'horizontal' });

    radio('Small').focus();
    await user.keyboard('{ArrowRight}');

    expect(radio('Medium').checked).toBe(true);
    expect(document.activeElement).toBe(radio('Medium'));
  });
});

describe('RadioGroup (aria-describedby merge)', () => {
  // Form-family forwarding contract (docs/COMPONENT-API-CONVENTIONS.md
  // §restProps ordering): a consumer-supplied
  // `aria-describedby` is APPENDED to the internal error/helper chain on the
  // group element (role="radiogroup") — internal id first, consumer id last —
  // never dropped, never replaced. RadioGroup used to spread `{...restProps}`
  // after the explicit attribute, so a consumer value silently REPLACED the
  // internal error/helper id.
  it('appends a consumer aria-describedby after the internal error id on the group', () => {
    renderRadios({ error: 'Pick one', 'aria-describedby': 'ext-hint' });

    const group = screen.getByRole('radiogroup');
    const alert = screen.getByRole('alert');
    expect(group.getAttribute('aria-describedby')).toBe(`${alert.id} ext-hint`);
  });

  it('appends a consumer aria-describedby after the internal helper id on the group', () => {
    renderRadios({ helper: 'Choose your plan', 'aria-describedby': 'ext-hint' });

    const group = screen.getByRole('radiogroup');
    const helper = screen.getByText('Choose your plan');
    expect(group.getAttribute('aria-describedby')).toBe(`${helper.id} ext-hint`);
  });

  it('keeps a consumer aria-describedby when there is no internal description', () => {
    renderRadios({ 'aria-describedby': 'ext-hint' });

    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe('ext-hint');
  });
});

describe('RadioGroup (internal ARIA wins over restProps)', () => {
  // Both the group element and every RadioItem <input> spread `{...restProps}`
  // FIRST, so the component's own computed attributes always win — a consumer
  // can't silently override the group's error state or a radio's roving tabindex
  // (mirrors Input's ordering). Regression guard for the
  // restProps ordering contract.
  it('keeps computed aria-invalid="true" on the group when a consumer passes aria-invalid="false" and error is set', () => {
    renderRadios({ error: 'Pick one', 'aria-invalid': 'false' });

    // The group is invalid because `error` is set; the consumer's restProps value
    // does not win.
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true');
  });

  it("keeps each radio's internal roving tabindex over a consumer-spread tabindex", () => {
    renderRadios({ value: 'medium', itemProps: { tabindex: 5 } });

    // The checked radio keeps tabindex 0 and the rest -1 — the component's roving
    // tabindex wins over the value spread through each RadioItem's restProps.
    expect(radio('Medium').getAttribute('tabindex')).toBe('0');
    expect(radio('Small').getAttribute('tabindex')).toBe('-1');
    expect(radio('Large').getAttribute('tabindex')).toBe('-1');
  });
});

describe('RadioGroup (consumer aria-labelledby survives without an internal label)', () => {
  // The reorder made `{...restProps}` spread first, so `aria-labelledby` is now
  // destructured out and used as the group's fallback — a consumer's external
  // heading association survives when there is no internal `label`, instead of
  // being cleared by the internal `undefined`.
  it('keeps a consumer aria-labelledby on the group when there is no internal label', () => {
    renderRadios({ 'aria-labelledby': 'ext-heading' });

    expect(screen.getByRole('radiogroup').getAttribute('aria-labelledby')).toBe('ext-heading');
  });

  it('an internal label still wins over a consumer aria-labelledby', () => {
    renderRadios({ label: 'Plan', 'aria-labelledby': 'ext-heading' });

    const group = screen.getByRole('radiogroup');
    const labelSpan = screen.getByText('Plan');
    // The rendered label owns the association; the consumer value is the fallback,
    // not an override.
    expect(group.getAttribute('aria-labelledby')).toBe(labelSpan.id);
  });
});

// Point 20b on the radio: the group's `error` reaches every item through the
// context, and the SELECTED item gains a ring rather than a danger fill —
// repainting the dot would read as "not chosen", the opposite of the truth.
describe('RadioGroup (error on the selected item)', () => {
  const indicatorOf = (name: string) =>
    radio(name).closest('label')?.querySelector('span') as HTMLElement;

  it('rings the checked item and keeps its intent fill', () => {
    renderRadios({ value: 'medium', error: 'Not available on your plan' });

    const cls = indicatorOf('Medium').className;
    expect(cls).toContain('ring-danger/60');
    expect(cls).toContain('bg-primary');
  });

  it('keeps the danger border on the unchecked items', () => {
    renderRadios({ value: 'medium', error: 'Not available on your plan' });

    const cls = indicatorOf('Small').className;
    expect(cls).toContain('border-danger');
    expect(cls).not.toContain('ring-danger/60');
  });

  it('does not ring the checked item without an error', () => {
    renderRadios({ value: 'medium' });
    expect(indicatorOf('Medium').className).not.toContain('ring-danger');
  });
});

// `required` used to draw an asterisk and set aria-required, and nothing more:
// an empty required group submitted straight through. The radios are real
// `<input type="radio">` sharing one `name`, so the constraint belongs on them
// — that is how HTML expresses a required radio group, and the browser then
// blocks the submit and points at the group itself.
describe('RadioGroup (required)', () => {
  function renderInForm(props: Partial<RadioGroupProps> & { items?: Item[] } = {}) {
    const form = document.createElement('form');
    document.body.appendChild(form);
    const instance = mount(RadioHarness, { target: form, props });
    dispose = () => unmount(instance);
    flushSync();
    return form;
  }

  it('blocks an empty submit and clears once a radio is picked', async () => {
    const user = userEvent.setup();
    const form = renderInForm({ required: true });

    expect(form.checkValidity()).toBe(false);

    await user.click(radio('Medium'));

    expect(form.checkValidity()).toBe(true);
  });

  it('leaves a group without `required` submittable while empty', () => {
    const form = renderInForm();

    expect(form.checkValidity()).toBe(true);
  });

  it('carries the constraint on every radio, so a conditional first item cannot drop it', () => {
    renderInForm({ required: true });

    expect(radio('Small').required).toBe(true);
    expect(radio('Medium').required).toBe(true);
    expect(radio('Large').required).toBe(true);
  });
});

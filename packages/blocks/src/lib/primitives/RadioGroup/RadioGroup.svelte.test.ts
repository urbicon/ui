// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RadioHarness from './__fixtures__/RadioHarness.svelte';
import type { RadioGroupProps } from './index';

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

function renderRadios(props: Partial<RadioGroupProps> & { items?: Item[] } = {}) {
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

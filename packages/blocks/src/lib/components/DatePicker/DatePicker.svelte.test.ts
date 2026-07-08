// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DatePicker from './DatePicker.svelte';

// Interaction layer for DatePicker — the input↔date parse/commit wiring plus the popover-calendar
// selection path, the timing the engine unit tests (datepicker.engine.test.ts) and variant tests
// can't reach. The engine's format/parse is already covered; here we assert the component glue:
// typing + blur commits through the engine, an invalid/out-of-range draft surfaces an error without
// committing, the keyboard opens the popover, a calendar day click sets the value and closes, and
// clear resets. useBlocksI18n is read-tolerant (no provider needed — labels resolve to the base
// locale, en), and locale defaults to 'de-DE' so the display mask is DD.MM.YYYY. Same stack as the
// Combobox pilot: svelte's own mount/unmount, @testing-library/dom + user-event, native matchers.
//
// jsdom note: the calendar renders inside a native popover with no top layer, so its day buttons are
// reached by their deterministic `data-date="YYYY-MM-DD"` attribute rather than by visible role.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderPicker(props: ComponentProps<typeof DatePicker> = {}) {
  const instance = mount(DatePicker, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;
const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`);

// Type into the input the way the component expects: focus (seeds the draft), input (updates it),
// blur (commits). fireEvent keeps it deterministic and off user-event's pointer model.
function typeAndBlur(text: string) {
  const el = input();
  fireEvent.focus(el);
  fireEvent.input(el, { target: { value: text } });
  fireEvent.blur(el);
  flushSync();
}

describe('DatePicker (component interaction)', () => {
  it('renders the bound value with the locale display mask (de-DE)', () => {
    renderPicker({ value: new Date(2026, 2, 15) });
    expect(input().value).toBe('15.03.2026');
  });

  it('commits a typed date on blur through the engine', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    typeAndBlur('20.03.2026');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const committed = onValueChange.mock.calls[0][0] as Date;
    expect(committed.getFullYear()).toBe(2026);
    expect(committed.getMonth()).toBe(2); // March
    expect(committed.getDate()).toBe(20);
  });

  it('commits a typed date on Enter while focused (popover closed)', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '20.03.2026' } });
    fireEvent.keyDown(el, { key: 'Enter' });
    flushSync();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect((onValueChange.mock.calls[0][0] as Date).getDate()).toBe(20);
  });

  it('does not commit a draft when focus moves to a control inside the picker', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '20.03.2026' } });
    // Blur into the picker's own open-calendar button (inside triggerEl) → "still editing", not
    // "done": commitDraft must be skipped so a half-interaction doesn't commit prematurely.
    fireEvent.blur(el, { relatedTarget: screen.getByRole('button', { name: 'Open calendar' }) });
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows a parse error and does not commit an invalid draft', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    typeAndBlur('not a date');

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Invalid date');
  });

  it('rejects an out-of-range date with an error, no commit', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange, maxDate: new Date(2026, 2, 10) });

    typeAndBlur('20.03.2026'); // after maxDate

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('outside the allowed range');
  });

  it('opens the calendar popover on ArrowDown', () => {
    renderPicker();

    expect(input().getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('selecting a calendar day sets the value and closes the popover', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // Seed a value so the calendar renders March 2026 deterministically.
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(input().getAttribute('aria-expanded')).toBe('true');

    const target = day('2026-03-20');
    expect(target).not.toBeNull();
    await user.click(target as HTMLElement);
    flushSync();

    expect(onValueChange).toHaveBeenCalled();
    const picked = onValueChange.mock.calls.at(-1)?.[0] as Date;
    expect(picked.getDate()).toBe(20);
    expect(picked.getMonth()).toBe(2);
    // closeOnSelect (default) closes the popover.
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the popover open on select when closeOnSelect is false', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange, closeOnSelect: false });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    await user.click(day('2026-03-20') as HTMLElement);
    flushSync();

    expect(onValueChange).toHaveBeenCalled();
    // The value still changes, but the popover stays open for further picking.
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the popover on Escape', () => {
    renderPicker();

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(input().getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(input(), { key: 'Escape' });
    flushSync();
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('discards an unsaved draft on Escape so a later blur does not commit it', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    const el = input();
    fireEvent.focus(el);
    // A *valid* draft: without the Escape below, the blur would commit it (onValueChange fires).
    fireEvent.input(el, { target: { value: '20.03.2026' } });
    fireEvent.keyDown(el, { key: 'Escape' }); // discard the draft (userDraft → null)
    fireEvent.blur(el);
    flushSync();

    // The discarded draft is not committed — the observable proof of the revert (asserting the
    // input's displayed value instead would couple to Svelte's one-way value reconciliation, which
    // jsdom + fireEvent.input don't reproduce faithfully).
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('clears the value via the clear button', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    // With a value + clearable (default), a "Clear input" button is shown.
    await user.click(screen.getByRole('button', { name: 'Clear input' }));
    flushSync();

    expect(onValueChange).toHaveBeenCalledWith(undefined);
    expect(input().value).toBe('');
  });

  it('carries the ISO date value in the hidden input for form submission', () => {
    renderPicker({ value: new Date(2026, 2, 15), name: 'date' });

    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"][name="date"]');
    expect(hidden).not.toBeNull();
    // valueFormat 'date' (default) → YYYY-MM-DD.
    expect(hidden?.value).toBe('2026-03-15');
  });
});

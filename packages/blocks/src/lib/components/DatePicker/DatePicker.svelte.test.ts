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
// locale, en); `renderPicker` pins locale='de-DE' so the display mask is DD.MM.YYYY. Same stack as the
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

// These tests assert German display masks (DD.MM.YYYY) and month names, so they pass `locale`
// explicitly. Until 2026-07-31 they relied on the component default being the literal `'de-DE'`;
// that default now follows the i18n provider and falls back to `en`, so the expectation has to be
// stated rather than inherited. Pinning it here also keeps these tests about what they are for
// (mask parsing / anchor logic), independent of whatever the default becomes next.
function renderPicker(props: ComponentProps<typeof DatePicker> = {}) {
  const instance = mount(DatePicker, {
    target: document.body,
    props: { locale: 'de-DE', ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;
const calendarButton = () =>
  screen.getByRole('button', { name: 'Open calendar' }) as HTMLButtonElement;
const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`);

// Type into the input the way the component expects: focus (seeds the draft), input (updates it),
// focusout to nowhere (commits — the picker listens for the bubbling `focusout`, not `blur`).
// fireEvent keeps it deterministic and off user-event's pointer model.
function typeAndLeave(text: string) {
  const el = input();
  fireEvent.focus(el);
  fireEvent.input(el, { target: { value: text } });
  fireEvent.focusOut(el);
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

    typeAndLeave('20.03.2026');

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
    fireEvent.focusOut(el, {
      relatedTarget: screen.getByRole('button', { name: 'Open calendar' })
    });
    flushSync();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('shows a parse error and does not commit an invalid draft', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange });

    typeAndLeave('not a date');

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Invalid date');
  });

  it('rejects an out-of-range date with an error, no commit', () => {
    const onValueChange = vi.fn();
    renderPicker({ onValueChange, maxDate: new Date(2026, 2, 10) });

    typeAndLeave('20.03.2026'); // after maxDate

    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('outside the allowed range');
  });

  it('opens the calendar popover on ArrowDown', () => {
    renderPicker();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('selecting a calendar day sets the value and closes the popover', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // Seed a value so the calendar renders March 2026 deterministically.
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');

    const target = day('2026-03-20');
    expect(target).not.toBeNull();
    await user.click(target as HTMLElement);
    flushSync();

    expect(onValueChange).toHaveBeenCalled();
    const picked = onValueChange.mock.calls.at(-1)?.[0] as Date;
    expect(picked.getDate()).toBe(20);
    expect(picked.getMonth()).toBe(2);
    // closeOnSelect (default) closes the popover.
    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
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
    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the popover on Escape', () => {
    renderPicker();

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(input(), { key: 'Escape' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('discards an unsaved draft on Escape so a later blur does not commit it', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    const el = input();
    fireEvent.focus(el);
    // A *valid* draft: without the Escape below, the blur would commit it (onValueChange fires).
    fireEvent.input(el, { target: { value: '20.03.2026' } });
    fireEvent.keyDown(el, { key: 'Escape' }); // discard the draft (userDraft → null)
    fireEvent.focusOut(el);
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

  it('clears the value when the field is typed empty (commitDraft empty-branch, not the Clear button)', () => {
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    // An empty draft drives commitDraft's `trimmed === ''` branch — a different path from the
    // Clear button's handleClear (tested above). Both reach onValueChange(undefined).
    typeAndLeave('');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(undefined);
  });

  it('carries the ISO date value in the hidden input for form submission', () => {
    renderPicker({ value: new Date(2026, 2, 15), name: 'date' });

    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"][name="date"]');
    expect(hidden).not.toBeNull();
    // valueFormat 'date' (default) → YYYY-MM-DD.
    expect(hidden?.value).toBe('2026-03-15');
  });

  it("serialises the hidden input as an ISO timestamp under valueFormat='iso'", () => {
    const value = new Date(2026, 2, 15);
    renderPicker({ value, name: 'date', valueFormat: 'iso' });

    const hidden = document.querySelector<HTMLInputElement>('input[type="hidden"][name="date"]');
    // valueFormat 'iso' → the full Date.toISOString() (for Drizzle/timestamp consumers), in
    // contrast to the 'date' default above which emits the bare YYYY-MM-DD calendar day.
    expect(hidden?.value).toBe(value.toISOString());
    expect(hidden?.value).toContain('T');
  });
});

// APG date-picker-dialog shape: the text field announces that a dialog exists, the calendar
// button reports whether it is showing. `aria-expanded` is not an allowed attribute on a textbox
// (axe `aria-allowed-attr`), so the field must never carry it, in any state.
describe('DatePicker (popup state)', () => {
  it('the text field announces the dialog but carries no expanded state, open or closed', () => {
    renderPicker();

    expect(input().getAttribute('aria-haspopup')).toBe('dialog');
    expect(input().hasAttribute('aria-expanded')).toBe(false);
    expect(input().hasAttribute('aria-controls')).toBe(false);

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
    expect(input().hasAttribute('aria-expanded')).toBe(false);
    expect(input().hasAttribute('aria-controls')).toBe(false);
  });

  it('the calendar button names the dialog it controls while open, and toggles it', async () => {
    const user = userEvent.setup();
    renderPicker();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(calendarButton().hasAttribute('aria-controls')).toBe(false);

    await user.click(calendarButton());
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
    const controlled = document.getElementById(
      calendarButton().getAttribute('aria-controls') ?? ''
    );
    // The id must resolve to the panel that holds the calendar, not merely to some element.
    expect(controlled?.getAttribute('role')).toBe('dialog');
    expect(controlled?.querySelector('[data-date]')).not.toBeNull();

    await user.click(calendarButton());
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(calendarButton().hasAttribute('aria-controls')).toBe(false);
  });

  it.each([
    ['empty field (calendar button alone)', {}],
    ['filled field (clear button beside it)', { value: new Date(2026, 2, 15) }]
  ])('reports the state on the calendar button: %s', (_, props) => {
    renderPicker(props);

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps the same calendar button, still expanded, when picking makes the clear button appear', async () => {
    const user = userEvent.setup();
    renderPicker({ closeOnSelect: false, defaultMonth: 2, defaultYear: 2026 });

    const button = calendarButton();
    await user.click(button);
    flushSync();
    expect(screen.queryByRole('button', { name: 'Clear input' })).toBeNull();

    await user.click(day('2026-03-20') as HTMLElement);
    flushSync();

    expect(screen.getByRole('button', { name: 'Clear input' })).not.toBeNull();
    expect(calendarButton()).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses the button when the popover dismisses itself on an outside pointerdown', () => {
    renderPicker();

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerDown(document.body);
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
  });

  // Tabbing from the field into the picker keeps the editing session open (no commit on that
  // blur), so the field's Enter-commits-the-draft handling must not claim keys pressed on a button.
  it.each([['{Enter}'], [' ']])(
    'opens from the calendar button on %j after tabbing there from the field',
    async (key) => {
      const user = userEvent.setup();
      renderPicker();

      await user.click(input());
      await user.tab();
      expect(document.activeElement).toBe(calendarButton());
      await user.keyboard(key);
      flushSync();

      expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
    }
  );

  it('clears from the clear button on Enter after tabbing there from the field', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderPicker({ value: new Date(2026, 2, 15), onValueChange });

    await user.click(input());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear input' }));
    await user.keyboard('{Enter}');
    flushSync();

    expect(onValueChange).toHaveBeenCalledWith(undefined);
  });

  it('renders the calendar button disabled, collapsed and unopenable when the picker is disabled', () => {
    renderPicker({ disabled: true });

    expect(calendarButton().disabled).toBe(true);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
  });
});

// A typed draft is what the field shows, so it must be what the form submits. Moving focus between
// the field and the picker's own buttons is still editing; leaving the picker, or opening the
// calendar from its button, commits. Each path ends outside the picker, on `after`.
describe('DatePicker (committing a typed draft)', () => {
  function renderWithOutside(props: ComponentProps<typeof DatePicker> = {}) {
    const onValueChange = vi.fn();
    renderPicker({
      value: new Date(2026, 0, 1),
      name: 'd',
      clearable: false,
      onValueChange,
      ...props
    });
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(after);
    return { onValueChange, after };
  }
  const hidden = () => document.querySelector<HTMLInputElement>('input[type="hidden"][name="d"]');

  it.each([
    ['Tab → Enter → Escape → Tab', ['{Tab}', '{Enter}', '{Escape}', '{Tab}']],
    ['Tab → Tab', ['{Tab}', '{Tab}']],
    ['Tab → Space → Escape → Tab', ['{Tab}', ' ', '{Escape}', '{Tab}']]
  ])('commits once on %s, and the form submits the typed date', async (_, keys) => {
    const user = userEvent.setup();
    const { onValueChange, after } = renderWithOutside();

    await user.click(input());
    fireEvent.input(input(), { target: { value: '20.03.2026' } });
    for (const key of keys) await user.keyboard(key);
    flushSync();

    expect(document.activeElement).toBe(after);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const committed = onValueChange.mock.calls[0][0] as Date;
    expect([committed.getFullYear(), committed.getMonth(), committed.getDate()]).toEqual([
      2026, 2, 20
    ]);
    expect(hidden()?.value).toBe('2026-03-20');
    expect(input().value).toBe('20.03.2026');
  });

  it('opens the calendar on the typed date when the button commits it', async () => {
    const user = userEvent.setup();
    renderWithOutside();

    await user.click(input());
    fireEvent.input(input(), { target: { value: '20.03.2026' } });
    await user.click(calendarButton());
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
    expect(day('2026-03-20')?.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the typed date through a trip into the calendar and back to the field', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderWithOutside();

    await user.click(input());
    fireEvent.input(input(), { target: { value: '20.03.2026' } });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    await user.click(
      document.querySelector<HTMLElement>('button[aria-label="Previous month"]') as HTMLElement
    );
    await user.click(input());
    flushSync();

    expect(input().value).toBe('20.03.2026');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not report the date again when the calendar picks the one the button just committed', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderWithOutside();

    await user.click(input());
    fireEvent.input(input(), { target: { value: '20.03.2026' } });
    await user.click(calendarButton());
    flushSync();
    expect(onValueChange).toHaveBeenCalledTimes(1);

    await user.click(day('2026-03-20') as HTMLElement);
    flushSync();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('holds the draft while focus is in the calendar, commits when it leaves for outside', () => {
    const { onValueChange, after } = renderWithOutside();

    const el = input();
    fireEvent.focus(el);
    fireEvent.input(el, { target: { value: '20.03.2026' } });
    fireEvent.keyDown(el, { key: 'ArrowDown' });
    flushSync();
    const inCalendar = day('2026-01-15') as HTMLElement;
    fireEvent.focusOut(el, { relatedTarget: inCalendar });
    flushSync();
    expect(onValueChange).not.toHaveBeenCalled();

    // The calendar panel is rendered outside the picker's root, so it listens on its own.
    fireEvent.focusOut(inCalendar, { relatedTarget: after });
    flushSync();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(hidden()?.value).toBe('2026-03-20');
  });
});

// Escape inside the calendar closes it through the Popover. Focus goes back to the button that
// opened it; an outside click leaves focus where the click put it.
describe('DatePicker (focus after the calendar closes)', () => {
  it('returns focus to the calendar button on Escape from inside the calendar', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    renderPicker({ defaultMonth: 2, defaultYear: 2026, onEscape });

    await user.click(calendarButton());
    flushSync();
    (day('2026-03-20') as HTMLElement).focus();
    await user.keyboard('{Escape}');
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(calendarButton());
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('leaves focus where it is on Escape once it has left the calendar', async () => {
    const user = userEvent.setup();
    renderPicker({ defaultMonth: 2, defaultYear: 2026 });
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(after);

    await user.click(calendarButton());
    flushSync();
    // Keyboard focus can leave an open calendar without closing it (no pointerdown).
    after.focus();
    await user.keyboard('{Escape}');
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(after);
  });

  it('returns focus to the calendar button after a day is picked from the keyboard', async () => {
    const user = userEvent.setup();
    renderPicker({ defaultMonth: 2, defaultYear: 2026 });

    await user.click(calendarButton());
    flushSync();
    (day('2026-03-20') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(calendarButton());
  });

  it('leaves focus on what an outside click focused', async () => {
    const user = userEvent.setup();
    renderPicker({ defaultMonth: 2, defaultYear: 2026 });
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(after);

    await user.click(calendarButton());
    flushSync();
    (day('2026-03-20') as HTMLElement).focus();
    await user.click(after);
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(after);
  });
});

// The per-size padding is folded in at the call site, not declared as an axis, so its precedence
// against the consumer's `slotClasses` is decided there and pinned here.
describe('DatePicker (icon button padding)', () => {
  const tokens = (el: Element) => el.className.split(/\s+/);

  it.each([
    ['xs', 'p-0.5'],
    ['md', 'p-1'],
    ['xl', 'p-1.5']
  ] as const)('gives both buttons Input’s icon-button padding at size %s', (size, padding) => {
    renderPicker({ size, value: new Date(2026, 2, 15) });

    expect(tokens(calendarButton())).toContain(padding);
    expect(tokens(screen.getByRole('button', { name: 'Clear input' }))).toContain(padding);
  });

  it('lets a consumer padding in slotClasses.iconButton replace it', () => {
    renderPicker({ slotClasses: { iconButton: 'p-3' } });

    expect(tokens(calendarButton())).toContain('p-3');
    expect(tokens(calendarButton())).not.toContain('p-1');
  });

  it('drops it under unstyled, with the rest of the library classes', () => {
    renderPicker({ unstyled: true, slotClasses: { iconButton: 'probe-ib' } });

    expect(calendarButton().className).toBe('probe-ib');
  });
});

// COMPONENT-API-CONVENTIONS § restProps ordering: the root spreads restProps first, and a
// consumer onkeydown is composed after the picker's own keyboard handling rather than dropped.
describe('DatePicker (restProps)', () => {
  it('passes an unmodelled attribute through to the root', () => {
    renderPicker({ 'data-testid': 'due-date' });
    expect(screen.getByTestId('due-date').contains(input())).toBe(true);
  });

  it('runs a consumer onfocusout as well as its own draft commit', () => {
    const seen: string[] = [];
    const onValueChange = vi.fn();
    renderPicker({ onValueChange, onfocusout: () => seen.push('consumer') });

    typeAndLeave('20.03.2026');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['consumer']);
  });

  it('runs a consumer onkeydown once, after ArrowDown has opened the calendar', () => {
    const seen: boolean[] = [];
    renderPicker({ onkeydown: (event) => seen.push(event.defaultPrevented) });

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('true');
    // Once, and after the picker had claimed the key.
    expect(seen).toEqual([true]);
  });
});

// A popover that sizes to its month changes height while paging, and the cells move out from
// under the pointer; the picker keeps 6 week rows by default, as DateRangePicker does.
describe('DatePicker (fixedWeeks)', () => {
  // The weekday header is a row too.
  const weekRows = () => document.querySelectorAll('[role="grid"] [role="row"]').length - 1;

  it.each([
    ['by default', {}, 6],
    ['unless fixedWeeks is false', { fixedWeeks: false }, 5]
  ])('renders the calendar for a 5-row month with its week rows %s', async (_, props, rows) => {
    const user = userEvent.setup();
    // February 2026 starts on a Sunday and needs 5 rows with the week starting on Monday.
    renderPicker({ defaultMonth: 1, defaultYear: 2026, ...props });

    await user.click(calendarButton());
    flushSync();

    expect(weekRows()).toBe(rows);
  });
});

// Popover closes itself on an outside pointerdown and on Escape inside the calendar panel,
// writing `bind:open` without passing through the picker's own open state; those closes must
// reach onOpenChange too, and the paths the picker closes itself must not report twice.
describe('DatePicker (onOpenChange)', () => {
  function renderWithOutside() {
    const onOpenChange = vi.fn();
    renderPicker({ defaultMonth: 2, defaultYear: 2026, onOpenChange });
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(after);
    return { onOpenChange, after };
  }

  it('reports the close by a pointerdown outside the picker', async () => {
    const user = userEvent.setup();
    const { onOpenChange, after } = renderWithOutside();

    await user.click(calendarButton());
    flushSync();
    await user.click(after);
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('reports the close by Escape inside the calendar', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderWithOutside();

    await user.click(calendarButton());
    flushSync();
    (day('2026-03-20') as HTMLElement).focus();
    await user.keyboard('{Escape}');
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('reports every open and close once, whichever path takes it', async () => {
    const user = userEvent.setup();
    const { onOpenChange, after } = renderWithOutside();

    // Escape in the field: the picker closes and claims the key, so the popover stays out.
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    flushSync();
    fireEvent.keyDown(input(), { key: 'Escape' });
    flushSync();
    // The calendar button toggles it.
    await user.click(calendarButton());
    flushSync();
    await user.click(calendarButton());
    flushSync();
    // Picking a date closes it.
    await user.click(calendarButton());
    flushSync();
    await user.click(day('2026-03-10') as HTMLElement);
    flushSync();
    // The two paths the popover takes on its own.
    await user.click(calendarButton());
    flushSync();
    await user.click(after);
    flushSync();
    await user.click(calendarButton());
    flushSync();
    (day('2026-03-20') as HTMLElement).focus();
    await user.keyboard('{Escape}');
    flushSync();

    expect(calendarButton().getAttribute('aria-expanded')).toBe('false');
    expect(onOpenChange.mock.calls).toEqual([
      [true],
      [false],
      [true],
      [false],
      [true],
      [false],
      [true],
      [false],
      [true],
      [false]
    ]);
  });
});

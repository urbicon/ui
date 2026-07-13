// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Badge from './Badge.svelte';
import type { BadgeProps } from './index';

// The `purpose` axis (BDG-1) is orchestrated in the component (it maps to the
// existing tv() visual props), so it needs a mounted DOM to observe, not a
// variant-config test. Also guards back-compat: the deprecated `variant="dot"`
// and `counter` boolean must keep working when `purpose` is unset.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const label = (t = 'Badge') => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

function render(props: Partial<BadgeProps> = {}) {
  const instance = mount(Badge, {
    target: document.body,
    props: { children: label(), ...props } as BadgeProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const badge = () => screen.getByRole('status');

describe('Badge — purpose axis (BDG-1)', () => {
  it('reflects purpose on data-purpose', () => {
    render({ purpose: 'status', intent: 'success' });
    expect(badge().getAttribute('data-purpose')).toBe('status');
  });

  it('purpose="dot" hides content and applies dot styling, overriding variant', () => {
    // `purpose="dot"` now forbids the label-only props at the type level (the
    // dot guard, Fix 2). Pass `children` anyway — via a cast — to prove the
    // runtime still hides them.
    const dotProps = { purpose: 'dot', variant: 'filled', children: label('hidden') };
    render(dotProps as unknown as Partial<BadgeProps>);
    const el = badge();
    expect(el.className).toContain('border-none'); // dot-only base class
    expect(el.textContent).not.toContain('hidden'); // dot renders no content span
  });

  it('purpose="counter" applies the numeric-pill styling', () => {
    render({ purpose: 'counter', children: label('5') });
    expect(badge().className).toContain('tabular-nums');
  });

  it('purpose="chip" makes the badge interactive (focusable)', () => {
    render({ purpose: 'chip', children: label('React') });
    // A chip is now announced as a button (see the a11y-role suite) and stays
    // focusable, so it is no longer queryable as a `status` region.
    expect(screen.getByRole('button', { name: 'React' }).getAttribute('tabindex')).toBe('0');
  });

  it('back-compat: variant="dot" still renders a dot without purpose', () => {
    render({ variant: 'dot' });
    expect(badge().className).toContain('border-none');
  });

  it('back-compat: the counter boolean still applies the pill styling', () => {
    render({ counter: true, children: label('9') });
    expect(badge().className).toContain('tabular-nums');
  });
});

// Interaction layer: remove button, keyboard activation/removal, hover callback,
// and the disabled contract. Keyboard paths use fireEvent — the handlers hang on
// the badge span, and a direct keydown dispatch exercises exactly the wiring
// under test without a focus dance (the guards, not focus routing, are the
// subject; the remove *button* focusability is asserted separately).
describe('Badge — remove & interaction', () => {
  it('remove button fires onRemove without triggering the badge onclick', async () => {
    const onRemove = vi.fn();
    const onclick = vi.fn();
    render({ removable: true, onRemove, onclick, children: label('React') });

    const removeBtn = screen.getByRole('button', { name: 'Remove badge' });
    await userEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledOnce();
    // handleRemove stops propagation — removing a chip must not also "click" it.
    expect(onclick).not.toHaveBeenCalled();
  });

  it('labels a removable badge and removes it via Delete/Backspace', () => {
    const onRemove = vi.fn();
    render({ removable: true, interactive: true, onRemove });

    // Interactive → role="button"; the aria-label is the button's accessible
    // name (and disambiguates it from the inner "Remove badge" control).
    const el = screen.getByRole('button', { name: 'Removable badge' });
    expect(el.getAttribute('aria-label')).toBe('Removable badge');
    fireEvent.keyDown(el, { key: 'Delete' });
    fireEvent.keyDown(el, { key: 'Backspace' });
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it('Enter and Space activate an interactive badge', () => {
    const onclick = vi.fn();
    render({ onclick });

    // onclick alone makes the badge interactive → focusable + role="button"
    // (default children give it the accessible name "Badge").
    const el = screen.getByRole('button', { name: 'Badge' });
    expect(el.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(onclick).toHaveBeenCalledTimes(2);
  });

  it('reports hover transitions through onHover', () => {
    const onHover = vi.fn();
    render({ onHover });

    fireEvent.mouseEnter(badge());
    expect(onHover).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(badge());
    expect(onHover).toHaveBeenLastCalledWith(false);
    expect(onHover).toHaveBeenCalledTimes(2);
  });

  it('disabled blocks pointer activation (JS guard, not just pointer-events CSS)', () => {
    const onclick = vi.fn();
    render({ onclick, disabled: true });

    // Direct dispatch bypasses pointer-events-none (jsdom computes no Tailwind
    // styles anyway) — the handleClick guard must hold on its own.
    fireEvent.click(badge());
    expect(onclick).not.toHaveBeenCalled();
  });

  it('disabled blocks keyboard activation and keyboard removal', () => {
    // Regression guard: handleKeydown lacked the disabled guard, so a disabled
    // badge was mouse-dead (pointer-events-none) but still keyboard-activatable.
    const onclick = vi.fn();
    const onRemove = vi.fn();
    render({ onclick, onRemove, removable: true, interactive: true, disabled: true });

    fireEvent.keyDown(badge(), { key: 'Enter' });
    fireEvent.keyDown(badge(), { key: ' ' });
    fireEvent.keyDown(badge(), { key: 'Delete' });
    fireEvent.keyDown(badge(), { key: 'Backspace' });
    expect(onclick).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('disabled removes the badge from the tab order and disables the remove button', () => {
    render({ removable: true, interactive: true, disabled: true, onRemove: vi.fn() });

    expect(badge().getAttribute('tabindex')).toBeNull();
    // The inner remove Button must be natively disabled — otherwise Tab still
    // reaches it and Enter removes a disabled badge.
    const removeBtn = screen.getByRole('button', { name: 'Remove badge' }) as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
  });
});

// Fix 1 (a11y): an interactive badge must carry button semantics, not the
// static `status` region — otherwise a focusable, Enter/Space-activatable chip
// is announced as a passive status. `effRole` derives it: an explicit `role`
// always wins; otherwise interactive-and-enabled → button, else status.
describe('Badge — interactive role (a11y)', () => {
  it('an onclick badge is announced as a button, not a status region', () => {
    render({ onclick: vi.fn(), children: label('Filter') });
    expect(screen.queryByRole('status')).toBeNull();
    const btn = screen.getByRole('button', { name: 'Filter' });
    // Accessible name comes from the text content (there is no aria-label here).
    expect(btn.getAttribute('role')).toBe('button');
    expect(btn.getAttribute('tabindex')).toBe('0');
  });

  it('purpose="chip" is announced as a button', () => {
    render({ purpose: 'chip', children: label('React') });
    expect(screen.getByRole('button', { name: 'React' }).getAttribute('role')).toBe('button');
  });

  it('a static (non-interactive) badge stays role="status"', () => {
    render({ children: label('Active') });
    expect(screen.getByRole('status').getAttribute('role')).toBe('status');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('an explicit role prop always wins over the derived button default', () => {
    render({ onclick: vi.fn(), role: 'status', children: label('Live') });
    // Consumer opted into status despite interactivity — respected verbatim.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a disabled interactive badge falls back to status (it is inert)', () => {
    render({ onclick: vi.fn(), disabled: true, children: label('x') });
    // Disabled ⇒ pointer-events-none + guarded handlers ⇒ not operable, so
    // announcing a "button" would be a lie; effRole keeps it a status.
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a removable interactive badge takes its accessible name from the aria-label', () => {
    render({ removable: true, interactive: true, onRemove: vi.fn(), children: label('React') });
    // Two buttons render: the badge itself (named by its aria-label) and the
    // inner remove control ("Remove badge"). The aria-label names the badge.
    const el = screen.getByRole('button', { name: 'Removable badge' });
    expect(el.getAttribute('role')).toBe('button');
  });
});

// ── Fix 2: discriminated-union contract (compile-time only) ──────────────────
// These assertions never run — `svelte-check` type-checks the body, and each
// `@ts-expect-error` asserts the union *rejects* a forbidden combo. Exported so
// biome doesn't flag it unused; it is never called. The point of Fix 2:
// `purpose="dot"` (now the canonical dot spelling) must forbid exactly what the
// deprecated `variant="dot"` forbids — `children` / `counter` / `removable` /
// `interactive` / `onRemove` — while the label + interactive surfaces stay valid.
export function _badgeUnionContract() {
  const s = label();
  return [
    // valid — both dot spellings (no label-only props) …
    { purpose: 'dot' } satisfies BadgeProps,
    { variant: 'dot' } satisfies BadgeProps,
    { purpose: 'dot', variant: 'filled' } satisfies BadgeProps,
    // … and the label / interactive / removable surfaces.
    { purpose: 'chip', onclick: () => undefined, children: s } satisfies BadgeProps,
    { removable: true, onRemove: () => undefined, children: s } satisfies BadgeProps,
    { counter: true, children: s } satisfies BadgeProps,
    { variant: 'outlined', intent: 'success', children: s } satisfies BadgeProps,

    // invalid — `purpose="dot"` forbids every label-only prop (same as `variant="dot"`):
    // @ts-expect-error content is hidden on a dot — children forbidden
    { purpose: 'dot', children: s } satisfies BadgeProps,
    // @ts-expect-error a remove button on a 2.5px dot is never intended
    { purpose: 'dot', removable: true } satisfies BadgeProps,
    // @ts-expect-error onRemove has no target without a remove button
    { purpose: 'dot', onRemove: () => undefined } satisfies BadgeProps,
    // @ts-expect-error the counter pill shape is meaningless on a dot
    { purpose: 'dot', counter: true } satisfies BadgeProps,
    // @ts-expect-error hover/scale interactivity on a dot is not a real UI
    { purpose: 'dot', interactive: true } satisfies BadgeProps
  ];
}

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

  // A `tag` names a category (a stage, a type, a version), and a category carries
  // no severity — painting one as a status is the measured colour defect this
  // purpose exists to prevent. It inherited the `primary` default until
  // 2026-08-02, i.e. it promised "neutral inline label" and rendered brand colour.
  it('purpose="tag" defaults to the neutral intent, not the brand primary', () => {
    render({ purpose: 'tag', children: label('Roasting') });
    expect(badge().className).toContain('blocks-intent-neutral');
    expect(badge().className).not.toContain('blocks-intent-primary');
  });

  it('an explicit intent still wins over the tag default', () => {
    render({ purpose: 'tag', intent: 'success', children: label('Shipped') });
    expect(badge().className).toContain('blocks-intent-success');
  });

  it('leaves every other purpose on the primary default', () => {
    render({ purpose: 'status', children: label('Active') });
    expect(badge().className).toContain('blocks-intent-primary');
  });

  it('purpose="chip" with onclick makes the badge a focusable button', () => {
    render({ purpose: 'chip', onclick: vi.fn(), children: label('React') });
    expect(screen.getByRole('button', { name: 'React' }).getAttribute('tabindex')).toBe('0');
  });

  it('purpose="chip" without onclick stays out of the tab order (#201)', () => {
    // A chip with nothing to activate keeps the interactive look but must not
    // be a focus stop: Enter and Space would answer with nothing.
    render({ purpose: 'chip', children: label('React') });
    expect(badge().getAttribute('tabindex')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
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

  it('removes via Delete/Backspace without an aria-label masking the visible text (#201)', () => {
    const onRemove = vi.fn();
    render({ removable: true, interactive: true, onRemove, children: label('React') });

    // No onclick → the badge stays a `status` region and its accessible name
    // is the visible content. The old removable aria-label replaced that name,
    // so a screen reader heard "Removable badge" and never "React".
    const el = badge();
    expect(el.getAttribute('aria-label')).toBeNull();
    expect(el.textContent).toContain('React');
    // The Delete/Backspace wiring on the badge span stays (it also serves
    // keydowns bubbling up from the focused ✕ control).
    fireEvent.keyDown(el, { key: 'Delete' });
    fireEvent.keyDown(el, { key: 'Backspace' });
    expect(onRemove).toHaveBeenCalledTimes(2);
  });

  it('Delete on the focused ✕ control reaches the badge handler via bubbling', () => {
    // The badge span itself is no tab stop without onclick (#201) — the ✕
    // button is. Its keydowns bubble to the span, so the Delete/Backspace
    // shortcut still works from the one place keyboard focus can actually be.
    const onRemove = vi.fn();
    render({ removable: true, onRemove });

    const removeBtn = screen.getByRole('button', { name: 'Remove badge' });
    fireEvent.keyDown(removeBtn, { key: 'Delete' });
    expect(onRemove).toHaveBeenCalledOnce();
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

  it('purpose="chip" with onclick is announced as a button', () => {
    render({ purpose: 'chip', onclick: vi.fn(), children: label('React') });
    expect(screen.getByRole('button', { name: 'React' }).getAttribute('role')).toBe('button');
  });

  it('a static (non-interactive) badge stays role="status"', () => {
    render({ children: label('Active') });
    expect(screen.getByRole('status').getAttribute('role')).toBe('status');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('interactive without onclick keeps status semantics and no tab stop (#201)', () => {
    // The visual axis alone must not fabricate a button: there is no handler,
    // so Enter/Space would be dead keys on an announced control.
    render({ interactive: true, children: label('Hot') });
    const el = screen.getByRole('status');
    expect(el.getAttribute('tabindex')).toBeNull();
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

  it('a removable clickable chip is named by its visible label, not an aria-label (#201)', () => {
    render({ removable: true, onclick: vi.fn(), onRemove: vi.fn(), children: label('React') });
    // Two buttons render: the chip and its inner ✕ ("Remove badge"). The
    // chip's name comes from its contents — the label is part of it, where the
    // old aria-label ("Removable badge") suppressed it entirely.
    const el = screen.getByRole('button', { name: /React/ });
    expect(el.getAttribute('aria-label')).toBeNull();
  });
});

// #201 carried the claim "pulse does not take effect initially, only after a
// re-render". The class string is a pure derived of props, so the animation
// utility must already sit on the very first mounted render — this is the
// positive control for that claim (it does not reproduce), and the DOM-level
// guard that the vestibular stop (`motion-reduce`) ships with the animation.
describe('Badge — pulse (#201)', () => {
  it('carries the pulse animation on the first render, paired with the motion-reduce stop', () => {
    render({ pulse: true, children: label('Live') });
    const cls = badge().className;
    expect(cls).toContain('animate-[badge-pulse');
    expect(cls).toContain('motion-reduce:animate-none');
  });

  it('omits the animation when pulse is off', () => {
    render({ children: label('Idle') });
    expect(badge().className).not.toContain('badge-pulse');
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

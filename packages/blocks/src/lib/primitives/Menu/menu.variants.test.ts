import { describe, expect, it } from 'vitest';
import { menuVariants } from './menu.variants';

describe('menuVariants', () => {
  it('paints surface tokens on the content slot', () => {
    // Positioning (z-index, top/left coords) is owned by the wrapping Popover —
    // Floating UI drives the floating coordinates and the browser's popover
    // top-layer handles stacking. The Menu's `content` slot is responsible only
    // for painting the panel: background, border, shadow, padding. The corner
    // radius is asserted separately because it varies with `tier`.
    const content = menuVariants({}).content();
    expect(content).toContain('shadow-[var(--blocks-shadow-md)]');
    expect(content).toContain('border');
  });

  it('uses the elevated surface background regardless of tier', () => {
    expect(menuVariants({ tier: 'commit' }).content()).toContain('bg-surface-elevated');
    expect(menuVariants({ tier: 'modify' }).content()).toContain('bg-surface-elevated');
  });

  it('mirrors the trigger border weight on the panel per tier', () => {
    // Commit (pill) trigger uses `border-neutral` (same token as the
    // outlined-neutral Button it sits under) for Linear-style cohesion.
    // Modify trigger keeps the subtle container border because the
    // trigger there is already a low-key surface and a stronger panel
    // border would feel heavier than the trigger.
    const commit = menuVariants({ tier: 'commit' }).content();
    expect(commit).toContain('border-neutral');
    expect(commit).not.toContain('border-border-hairline');

    const modify = menuVariants({ tier: 'modify' }).content();
    expect(modify).toContain('border-border-hairline');
    expect(modify).not.toContain('border-neutral');
  });

  it('uses semantic tokens for item styles', () => {
    const item = menuVariants({}).item();
    expect(item).toContain('text-text-primary');
    expect(item).toContain('hover:bg-surface-hover');
    expect(item).toContain('focus-visible:ring-primary/50');
  });

  it('applies default itemSize md', () => {
    const item = menuVariants({}).item();
    expect(item).toContain('px-3');
    expect(item).toContain('py-2');
    expect(item).toContain('text-base');
  });

  it('applies disabled state', () => {
    const item = menuVariants({ disabled: true }).item();
    expect(item).toContain('opacity-50');
    expect(item).toContain('pointer-events-none');
  });

  it('placement variants do not inject content-slot positioning', () => {
    // `placement` stays on the variant axis so consumers can pass it through
    // for type-checking, but the actual positioning happens in the wrapping
    // Popover via Floating UI. The content slot itself should be identical
    // across placements — anything else means we're double-floating.
    const bottomStart = menuVariants({ placement: 'bottom-start' }).content();
    const topEnd = menuVariants({ placement: 'top-end' }).content();
    expect(bottomStart).toBe(topEnd);
    expect(bottomStart).not.toContain('top-full');
    expect(bottomStart).not.toContain('bottom-full');
  });

  it('applies chevron rotation when open', () => {
    const chevron = menuVariants({ open: true, chevronAnimation: 'rotate' }).chevron();
    expect(chevron).toContain('rotate-180');
  });

  it('defaults syncWidth to true (min-w-0)', () => {
    const content = menuVariants({}).content();
    expect(content).toContain('min-w-0');
    expect(content).not.toContain('min-w-48');
  });

  it('section uses minimal styling without background or uppercase', () => {
    const section = menuVariants({}).section();
    expect(section).toContain('text-text-tertiary');
    expect(section).toContain('font-medium');
    expect(section).not.toContain('uppercase');
    expect(section).not.toContain('bg-surface-subtle');
    expect(section).not.toContain('border-b');
  });

  it('section header shares the item inset per itemSize', () => {
    expect(menuVariants({ itemSize: 'sm' }).section()).toContain('px-2');
    expect(menuVariants({ itemSize: 'md' }).section()).toContain('px-3');
    expect(menuVariants({ itemSize: 'lg' }).section()).toContain('px-4');
  });

  it('items follow the shared listbox baseline (min-h, XC-9)', () => {
    expect(menuVariants({ itemSize: 'sm' }).item()).toContain('min-h-[2rem]');
    expect(menuVariants({ itemSize: 'md' }).item()).toContain('min-h-[2.5rem]');
    expect(menuVariants({ itemSize: 'lg' }).item()).toContain('min-h-[3rem]');
  });

  it('panel edge inset is symmetric: content p-1 only, items wrapper adds no py', () => {
    // The 4px edge inset lives once on `content` — same rhythm as the
    // Select/Combobox listboxes. The items wrapper only spaces rows.
    expect(menuVariants({}).content()).toContain('p-1');
    const items = menuVariants({}).items();
    expect(items).toContain('space-y-0.5');
    expect(items).not.toMatch(/\bpy-/);
  });

  it('the item gap owns the icon↔label distance — indicator carries no mr-*', () => {
    expect(menuVariants({}).item()).toContain('gap-2');
    expect(menuVariants({}).indicator()).not.toMatch(/\bmr-/);
  });

  it('detail readout sits at the row end in tertiary text', () => {
    // Same look as the header-menu value readout it generalises: quiet,
    // small, pinned right even when the label span does not flex (unstyled).
    const detail = menuVariants({}).detail();
    expect(detail).toContain('ml-auto');
    expect(detail).toContain('text-text-tertiary');
    expect(detail).toContain('text-xs');
  });

  it('never outputs dark: overrides', () => {
    const styles = menuVariants({});
    expect(styles.base()).not.toMatch(/\bdark:/);
    expect(styles.content()).not.toMatch(/\bdark:/);
    expect(styles.item()).not.toMatch(/\bdark:/);
  });

  it('items render in modify tier (rounded-modify)', () => {
    const item = menuVariants({}).item();
    expect(item).toContain('rounded-modify');
  });

  it('panel radius bridges a pill (commit) trigger with the rounded-bridge token', () => {
    // A `commit` trigger is a fully-rounded pill (radius 9999px). Painting
    // the floating panel with `rounded-contain` (2px) underneath would look
    // disjointed — `rounded-bridge` (~6 px) sits between the two and
    // visually ties the surfaces together. Default tier is `commit`, so
    // this is also the default panel radius.
    //
    // The bridge token (semantic name, see foundation.css) replaced the
    // hard-coded `rounded-lg` so brand overrides can retune it without
    // touching the Menu component.
    const commitContent = menuVariants({ tier: 'commit' }).content();
    expect(commitContent).toContain('rounded-bridge');
    expect(commitContent).not.toContain('rounded-commit');
    expect(commitContent).not.toContain('rounded-contain');
    expect(commitContent).not.toContain('rounded-modify');

    const defaultContent = menuVariants({}).content();
    expect(defaultContent).toContain('rounded-bridge');
  });

  it('panel radius mirrors the modify trigger directly', () => {
    // A `modify` trigger already has a low radius, so the panel matches
    // its tier 1:1 — no bridging needed. `contain` is the Container-family
    // tier and is intentionally not part of menuVariants' `tier` axis
    // (Menu's trigger is a Button, which only ranges over `commit | modify`).
    const modify = menuVariants({ tier: 'modify' }).content();
    expect(modify).toContain('rounded-modify');
    expect(modify).not.toContain('rounded-bridge');
  });
});

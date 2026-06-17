import { describe, expect, it } from 'vitest';
import { resolveStickyMode } from '../core/sticky-context.svelte';
import { tableContainerVariants, tableHeaderVariants } from './table.variants';
import { groupHeaderVariants } from './table-features.variants';

describe('resolveStickyMode', () => {
  it('disables all layers by default', () => {
    expect(resolveStickyMode(false)).toEqual({ toolbar: false, header: false, group: false });
    expect(resolveStickyMode(undefined)).toEqual({ toolbar: false, header: false, group: false });
  });

  it('enables all layers for true / "both"', () => {
    expect(resolveStickyMode(true)).toEqual({ toolbar: true, header: true, group: true });
    expect(resolveStickyMode('both')).toEqual({ toolbar: true, header: true, group: true });
  });

  it('enables only the toolbar for "toolbar"', () => {
    expect(resolveStickyMode('toolbar')).toEqual({ toolbar: true, header: false, group: false });
  });

  it('enables header AND group for "header"', () => {
    expect(resolveStickyMode('header')).toEqual({ toolbar: false, header: true, group: true });
  });

  it('contained (fit="viewport") forces header + group and drops toolbar pinning', () => {
    expect(resolveStickyMode(false, true)).toEqual({
      toolbar: false,
      header: true,
      group: true
    });
  });

  it('contained supersedes the sticky prop entirely', () => {
    // even "toolbar"/"both" collapse to the box-relative header pin
    expect(resolveStickyMode('toolbar', true)).toEqual({
      toolbar: false,
      header: true,
      group: true
    });
    expect(resolveStickyMode('both', true)).toEqual({
      toolbar: false,
      header: true,
      group: true
    });
  });
});

describe('tableContainerVariants — sticky toolbar', () => {
  it('pins the toolbar to var(--blocks-table-sticky-top)', () => {
    const stuck = tableContainerVariants({ stickyToolbar: true }).toolbar();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(/top-\[var\(--blocks-table-sticky-top/);
    expect(stuck).toMatch(/z-30\b/);
  });

  it('reserves data-[stuck=true]:shadow-... for the IntersectionObserver feedback', () => {
    const stuck = tableContainerVariants({ stickyToolbar: true }).toolbar();
    expect(stuck).toMatch(/data-\[stuck=true\]:shadow-/);
  });
});

describe('tableContainerVariants — contained (fit="viewport")', () => {
  it('caps the container to the viewport minus the measured top offset', () => {
    const container = tableContainerVariants({ contained: true }).container();
    expect(container).toMatch(/md:max-h-\[calc\(100dvh-var\(--blocks-table-avail-top/);
  });

  it('makes the scrollArea the flex scroll child (flex-auto + min-h-0 + overflow)', () => {
    const scrollArea = tableContainerVariants({ contained: true }).scrollArea();
    expect(scrollArea).toMatch(/md:flex-auto/);
    expect(scrollArea).toMatch(/md:min-h-0/);
    expect(scrollArea).toMatch(/md:overflow-auto/);
    // must NOT use basis-0 `flex-1`, which collapses the box for short tables
    // in an auto-height (max-height-capped) flex container
    expect(scrollArea).not.toMatch(/\bflex-1\b/);
  });

  it('keeps the toolbar fixed outside the scroll area (shrink-0)', () => {
    const toolbar = tableContainerVariants({ contained: true }).toolbar();
    expect(toolbar).toMatch(/md:shrink-0/);
  });

  it('uses dvh (not vh) so the mobile URL bar does not clip the box', () => {
    const container = tableContainerVariants({ contained: true }).container();
    expect(container).toMatch(/100dvh/);
    expect(container).not.toMatch(/100vh\b/);
  });

  it('adds nothing when contained=false — the default (non-contained) mode is unchanged', () => {
    const container = tableContainerVariants({ contained: false }).container();
    const scrollArea = tableContainerVariants({ contained: false }).scrollArea();
    expect(container).not.toMatch(/max-h-\[calc\(100dvh/);
    expect(scrollArea).not.toMatch(/flex-auto/);
    expect(scrollArea).not.toMatch(/overflow-auto/);
  });
});

describe('tableHeaderVariants — sticky thead', () => {
  it('pins the thead below toolbar (sticky-top + toolbar-h)', () => {
    const stuck = tableHeaderVariants({ sticky: true }).header();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(/calc\(var\(--blocks-table-sticky-top.+var\(--blocks-table-toolbar-h/);
    expect(stuck).toMatch(/z-20\b/);
  });

  it('does NOT add sticky classes when sticky=false', () => {
    const free = tableHeaderVariants({ sticky: false }).header();
    expect(free).not.toMatch(/\bsticky\b/);
  });
});

describe('groupHeaderVariants — sticky group header (L3)', () => {
  it('pins the group header below toolbar + thead', () => {
    const stuck = groupHeaderVariants({ sticky: true }).row();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(
      /calc\(var\(--blocks-table-sticky-top.+var\(--blocks-table-toolbar-h.+var\(--blocks-table-thead-h/
    );
    expect(stuck).toMatch(/z-10\b/);
  });

  it('falls back to non-sticky behavior when sticky=false', () => {
    const free = groupHeaderVariants({ sticky: false }).row();
    expect(free).not.toMatch(/\bsticky\b/);
  });
});

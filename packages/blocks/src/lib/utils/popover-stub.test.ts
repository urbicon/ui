// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
// The setup already installs the stub; this import is what puts `scripts/vitest-popover.ts` under
// blocks' svelte-check — no tsconfig includes the root `scripts/`.
import '../../../../../scripts/vitest-popover';

/**
 * The suite's Popover API is the shared stub in `scripts/vitest-popover.ts`. jsdom keeps every
 * `[popover]` at `display: none` through its UA sheet and refuses `focus()` below it, so a stub
 * that shows nothing leaves an opened panel unfocusable — and one whose `:popover-open` answer
 * disagrees with its own state leaves the product's hide path (guarded on `:popover-open`)
 * never running. This pins both readers to the state `showPopover`/`hidePopover` set.
 */
function mountPanel(popover: string | null = 'manual') {
  const panel = document.createElement('div');
  if (popover !== null) panel.setAttribute('popover', popover);
  const item = document.createElement('button');
  item.textContent = 'item';
  panel.append(item);
  document.body.append(panel);
  return { panel, item };
}

describe('the Popover API the blocks suite runs against', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows a panel for the cascade and for focus, and hides it again', () => {
    const { panel, item } = mountPanel();
    expect(getComputedStyle(panel).display).toBe('none');

    panel.showPopover();
    expect(getComputedStyle(panel).display).not.toBe('none');
    item.focus();
    expect(document.activeElement).toBe(item);

    panel.hidePopover();
    expect(getComputedStyle(panel).display).toBe('none');
  });

  it('answers :popover-open from the same state in every selector method', () => {
    const { panel, item } = mountPanel();
    expect(panel.matches(':popover-open')).toBe(false);

    panel.showPopover();
    expect(panel.matches(':popover-open')).toBe(true);
    expect(panel.matches('[popover]:not(:popover-open)')).toBe(false);
    expect(item.closest(':popover-open')).toBe(panel);
    expect(document.querySelector(':popover-open')).toBe(panel);
    expect(document.body.querySelectorAll(':popover-open')).toHaveLength(1);

    panel.hidePopover();
    expect(panel.matches(':popover-open')).toBe(false);
    expect(document.querySelector(':popover-open')).toBeNull();
  });

  it('lets an inline display: none hide an open panel, as a browser does', () => {
    const { panel } = mountPanel();
    panel.showPopover();
    panel.style.display = 'none';
    expect(getComputedStyle(panel).display).toBe('none');
  });

  it('opens nothing on an element without the popover attribute', () => {
    const { panel } = mountPanel(null);
    panel.showPopover();
    expect(panel.matches(':popover-open')).toBe(false);

    panel.setAttribute('popover', 'manual');
    expect(panel.matches(':popover-open')).toBe(false);
    expect(getComputedStyle(panel).display).toBe('none');
  });
});

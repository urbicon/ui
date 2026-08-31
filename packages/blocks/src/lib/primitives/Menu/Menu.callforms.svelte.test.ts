// @vitest-environment jsdom
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from './__fixtures__/MenuCallFormsHarness.svelte';
import Menu from './Menu.svelte';

// One structure — a bare leading row, then a named section holding two rows
// split by a rule — written in the three call forms of the same API. Before
// #361 they produced three different accessibility trees: the declarative
// section was a `role="separator"` carrying text (colliding with MenuDivider's
// own separator and reaching no accessible name), the submenu section was a
// `role="presentation"` with neither id nor group, and only the array form
// built the APG pattern. The pin is that all three now agree, so the roles
// cannot drift apart again one call form at a time.
//
// Menu renders through Popover; in jsdom there is no top layer, so panel
// content reads as hidden and every query passes `{ hidden: true }`.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const FORMS = ['declarative', 'array', 'submenu'] as const;

function render(only?: (typeof FORMS)[number]) {
  const app = mount(Harness, { target: document.body, props: only ? { only } : {} });
  dispose = () => unmount(app);
  flushSync();
  // A bare `.click()` dispatches no pointerdown, so opening the submenu does
  // not light-dismiss the sibling menus — all three stay open in one DOM.
  const parentRow = document.querySelector('[role="menuitem"][aria-haspopup="menu"]');
  if (parentRow) {
    (parentRow as HTMLElement).click();
    flushSync();
  }
}

const formScope = (form: string) => document.querySelector(`[data-form="${form}"]`) as HTMLElement;

/**
 * The element that holds the section — the items wrapper for the two top-level
 * forms, the submenu's own `role="menu"` panel for the third. Anchoring on the
 * heading's parent normalises the submenu's extra nesting away, so the three
 * outlines are comparable at all.
 */
function sectionHost(form: string): HTMLElement {
  const heading = formScope(form).querySelector('[role="presentation"]');
  if (!heading?.parentElement) throw new Error(`no section heading in the ${form} form`);
  return heading.parentElement;
}

/** Role + collapsed text of every ARIA-roled element below `host`, in DOM order. */
function outline(host: HTMLElement): string[] {
  const lines: string[] = [];
  const walk = (el: Element, depth: number) => {
    for (const child of Array.from(el.children)) {
      const role = child.getAttribute('role');
      if (role) {
        const text = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
        lines.push(`${'  '.repeat(depth)}${role}:${text}`);
      }
      walk(child, role ? depth + 1 : depth);
    }
  };
  walk(host, 0);
  return lines;
}

describe('Menu (section roles across the three call forms)', () => {
  it('renders one structure, whichever way it was written', () => {
    render();
    const [declarative, array, submenu] = FORMS.map((form) => outline(sectionHost(form)));

    expect(array).toEqual([
      'menuitem:lead',
      'presentation:Group A',
      'group:one two',
      '  menuitem:one',
      '  separator:',
      '  menuitem:two'
    ]);
    expect(declarative).toEqual(array);
    expect(submenu).toEqual(array);
  });

  it('names the group by its heading in every form, and never names a separator', () => {
    render();
    for (const form of FORMS) {
      const scope = within(formScope(form));

      // Runs the real accessible-name computation, not a text lookup: the
      // heading's text only reaches assistive tech through this reference.
      expect(scope.getByRole('group', { name: 'Group A', hidden: true })).toBeTruthy();

      const group = scope.getByRole('group', { hidden: true });
      const heading = document.getElementById(group.getAttribute('aria-labelledby') as string);
      expect(heading?.getAttribute('role')).toBe('presentation');

      // The one separator is MenuDivider's rule — empty, and never the heading.
      const separators = scope.getAllByRole('separator', { hidden: true });
      expect(separators).toHaveLength(1);
      expect(separators[0].textContent).toBe('');
      expect(scope.queryAllByRole('separator', { name: 'Group A', hidden: true })).toHaveLength(0);
    }
  });

  it("renders a { type: 'divider' } entry as a rule, not as a nameless row", () => {
    const app = mount(Menu, {
      target: document.body,
      props: { open: true, placeholder: 'p', items: ['a', { type: 'divider' as const }, 'b'] }
    });
    dispose = () => unmount(app);
    flushSync();

    const scope = within(document.querySelector('[role="menu"]') as HTMLElement);
    expect(scope.getAllByRole('menuitem', { hidden: true }).map((el) => el.textContent?.trim())) //
      .toEqual(['a', 'b']);
    expect(scope.getAllByRole('separator', { hidden: true })).toHaveLength(1);
  });

  it('lets `isDivider` claim back a row whose own `type` reads "divider"', async () => {
    // A consumer's domain shape may carry `type: 'divider'` as data. The
    // built-in check is structural, so without the mapper that row becomes a
    // rule and its `onSelect` is unreachable — the mapper is the way out, and
    // it is asked before the structural check, exactly like `isSection`.
    const user = userEvent.setup();
    const onDivide = vi.fn();
    const rows = [
      { type: 'merge', label: 'Merge cells' },
      { type: 'divider', label: 'Divide cells', onSelect: onDivide },
      { type: 'split', label: 'Split cells' }
    ];

    const claimed = mount(Menu, {
      target: document.body,
      props: { open: true, placeholder: 'p', items: rows, isDivider: () => false }
    });
    flushSync();
    let scope = within(document.querySelector('[role="menu"]') as HTMLElement);
    expect(scope.getAllByRole('menuitem', { hidden: true }).map((el) => el.textContent?.trim())) //
      .toEqual(['Merge cells', 'Divide cells', 'Split cells']);
    expect(scope.queryAllByRole('separator', { hidden: true })).toHaveLength(0);
    await user.click(scope.getByRole('menuitem', { name: 'Divide cells', hidden: true }));
    expect(onDivide).toHaveBeenCalledTimes(1);
    unmount(claimed);
    document.body.replaceChildren();

    // The control: the same items without the mapper. This is what the mapper
    // exists to prevent, and it must stay visible in the suite.
    const structural = mount(Menu, {
      target: document.body,
      props: { open: true, placeholder: 'p', items: rows }
    });
    dispose = () => unmount(structural);
    flushSync();
    scope = within(document.querySelector('[role="menu"]') as HTMLElement);
    expect(scope.getAllByRole('menuitem', { hidden: true }).map((el) => el.textContent?.trim())) //
      .toEqual(['Merge cells', 'Split cells']);
    expect(scope.getAllByRole('separator', { hidden: true })).toHaveLength(1);
  });

  it('renders a rule before the next header between the groups, not inside the first', () => {
    // A rule that sits directly before a header separates the two sections; it
    // is not the closing section's last row, so it must not sit under that
    // section's name.
    const app = mount(Menu, {
      target: document.body,
      props: {
        open: true,
        placeholder: 'p',
        items: [
          'a',
          { type: 'section' as const, label: 'A' },
          'b',
          { type: 'divider' as const },
          { type: 'section' as const, label: 'B' },
          'c'
        ]
      }
    });
    dispose = () => unmount(app);
    flushSync();

    const heading = document.querySelector('[role="presentation"]') as HTMLElement;
    expect(outline(heading.parentElement as HTMLElement)).toEqual([
      'menuitem:a',
      'presentation:A',
      'group:b',
      '  menuitem:b',
      'separator:',
      'presentation:B',
      'group:c',
      '  menuitem:c'
    ]);
  });

  it('keeps arrow navigation identical across the three forms', async () => {
    // The group wrapper sits between the panel and its items — the change most
    // likely to break a roving-tabindex model that walks direct children.
    const user = userEvent.setup();
    const walks: string[][] = [];

    for (const form of FORMS) {
      render(form);
      const panel = formScope(form).querySelector('[role="menu"]') as HTMLElement;
      panel.focus();
      const seen: string[] = [];
      for (let i = 0; i < 5; i++) {
        await user.keyboard('{ArrowDown}');
        seen.push((document.activeElement as HTMLElement).textContent?.trim() ?? '');
      }
      await user.keyboard('{Home}');
      seen.push(`Home=${(document.activeElement as HTMLElement).textContent?.trim()}`);
      await user.keyboard('{End}');
      seen.push(`End=${(document.activeElement as HTMLElement).textContent?.trim()}`);
      walks.push(seen);
      dispose?.();
      dispose = undefined;
      document.body.replaceChildren();
    }

    const [declarative, array, submenu] = walks;
    // Three rows, wrapping after the last — the divider and the group wrapper
    // are both skipped, in every form.
    expect(array).toEqual(['lead', 'one', 'two', 'lead', 'one', 'Home=lead', 'End=two']);
    expect(declarative).toEqual(array);
    // The submenu form carries its disclosure row ahead of the same three.
    expect(submenu).toEqual(['parent', 'lead', 'one', 'two', 'parent', 'Home=parent', 'End=two']);
  });
});

import { describe, expect, it } from 'vitest';
import { tableContainerVariants, tableHeaderVariants, tableRowVariants } from './table.variants';
import { smartFilterBarVariants } from './table-features.variants';
import { mobileCardVariants } from './table-states.variants';

describe('tableContainerVariants', () => {
  it('produces base container, toolbar, scrollArea, table and body classes', () => {
    const styles = tableContainerVariants({ size: 'md' });
    expect(styles.container()).toBeTruthy();
    expect(styles.toolbar()).toBeTruthy();
    // scrollArea is empty in default `flush` variant
    expect(styles.scrollArea()).toBeDefined();
    expect(styles.table()).toBeTruthy();
    expect(styles.body()).toBeDefined();
  });

  it('does not clip the scroll area with overflow-hidden (would block position: sticky)', () => {
    const scrollArea = tableContainerVariants({ size: 'md' }).scrollArea();
    expect(scrollArea).not.toMatch(/\boverflow-hidden\b/);
  });

  it('supports all size values', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const styles = tableContainerVariants({ size });
      expect(styles.container()).toBeTruthy();
    }
  });

  it('never outputs dark: overrides', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const styles = tableContainerVariants({ size });
      expect(styles.container()).not.toMatch(/\bdark:/);
      expect(styles.scrollArea()).not.toMatch(/\bdark:/);
      expect(styles.toolbar()).not.toMatch(/\bdark:/);
    }
  });

  it('uses tokenized shadows, not bare shadow-sm/md/lg', () => {
    const styles = tableContainerVariants({ size: 'md' });
    const scrollArea = styles.scrollArea();
    if (scrollArea.includes('shadow')) {
      expect(scrollArea).not.toMatch(/(?<!\[var\(--blocks-)shadow-(sm|md|lg)\b/);
    }
  });

  it('enables sticky toolbar pinning when stickyToolbar=true', () => {
    const stuck = tableContainerVariants({ stickyToolbar: true }).toolbar();
    const free = tableContainerVariants({ stickyToolbar: false }).toolbar();
    expect(stuck).toMatch(/\bsticky\b/);
    expect(stuck).toMatch(/var\(--blocks-table-sticky-top/);
    expect(free).not.toMatch(/\bsticky\b/);
  });
});

describe('tableRowVariants', () => {
  it('produces row and cell classes', () => {
    const styles = tableRowVariants({ state: 'default', size: 'md' });
    expect(styles.row()).toBeTruthy();
    expect(styles.cell()).toBeTruthy();
  });

  it('applies selected state', () => {
    const defaultRow = tableRowVariants({ state: 'default' }).row();
    const selectedRow = tableRowVariants({ state: 'selected' }).row();
    expect(selectedRow).not.toBe(defaultRow);
  });

  it('applies active state, distinct from default and from selected', () => {
    const defaultRow = tableRowVariants({ state: 'default' }).row();
    const activeRow = tableRowVariants({ state: 'active' }).row();
    const selectedRow = tableRowVariants({ state: 'selected' }).row();

    expect(activeRow).not.toBe(defaultRow);
    // Selection keeps the accent; "currently shown" must not borrow it, or the
    // two states would be indistinguishable in a table that has both.
    expect(activeRow).not.toBe(selectedRow);
    expect(activeRow).not.toMatch(/\bbg-primary-subtle\b/);
  });

  it('marks the active row with more than the hover ground', () => {
    // Found in the browser: `active` was `bg-surface-hover` alone, which is
    // exactly what the row under the cursor gets — so moving the mouse down the
    // list showed two identical rows and neither said which one was on screen.
    const activeRow = tableRowVariants({ state: 'active' }).row();
    const defaultRow = tableRowVariants({ state: 'default' }).row();
    const hoverGround = defaultRow.match(/hover:(bg-\S+)/)?.[1];

    expect(hoverGround, 'default rows should still tint on hover').toBeTruthy();
    // Whatever else it does, it must carry a mark hover cannot produce.
    const withoutGround = activeRow
      .split(/\s+/)
      .filter((c) => c !== hoverGround)
      .join(' ');
    expect(withoutGround.trim()).not.toBe('');
  });

  it('never outputs dark: overrides', () => {
    const states = ['default', 'selected', 'active', 'expanded', 'disabled'] as const;
    for (const state of states) {
      const styles = tableRowVariants({ state });
      expect(styles.row()).not.toMatch(/\bdark:/);
    }
  });
});

describe('mobileCardVariants — active card', () => {
  it('marks the active card without borrowing the selected look', () => {
    const plain = mobileCardVariants({}).card();
    const active = mobileCardVariants({ active: true }).card();
    const selected = mobileCardVariants({ selected: true }).card();

    expect(active).not.toBe(plain);
    expect(active).not.toBe(selected);
    expect(active).not.toMatch(/\bbg-primary-subtle\b/);
  });

  it('lets selection win when a card is both selected and active', () => {
    // Two grounds on one card would otherwise resolve by declaration order
    // rather than by meaning — the compound decides it explicitly.
    const both = mobileCardVariants({ selected: true, active: true }).card();
    const selected = mobileCardVariants({ selected: true }).card();

    expect(both).toMatch(/\bbg-primary-subtle\b/);
    expect(both).not.toMatch(/\bbg-surface-hover\b/);
    expect(both.split(/\s+/).sort()).toEqual(selected.split(/\s+/).sort());
  });
});

describe('mobileCardVariants — closed card', () => {
  // A closed card is a header and nothing else, so its bottom padding has to
  // match its top one — the open card's tight `pb-1` only exists to close the
  // gap to the detail grid underneath it.
  it('balances the header padding per size', () => {
    const pairs = [
      { size: 'sm', top: 'pt-3', bottom: 'pb-3' },
      { size: 'md', top: 'pt-4', bottom: 'pb-4' },
      { size: 'lg', top: 'pt-5', bottom: 'pb-5' }
    ] as const;
    for (const { size, top, bottom } of pairs) {
      const header = mobileCardVariants({ size, collapsed: true }).header();
      expect(header).toMatch(new RegExp(`\\b${top}\\b`));
      expect(header).toMatch(new RegExp(`\\b${bottom}\\b`));
      // The size stage runs first, so its `pb-1` must not survive the compound.
      expect(header).not.toMatch(/\bpb-1\b/);
    }
  });

  it('keeps the tight bottom padding while the card is open', () => {
    expect(mobileCardVariants({ collapsed: false }).header()).toMatch(/\bpb-1\b/);
  });

  it('offers the subtitle and toggle slots the collapsed header needs', () => {
    const styles = mobileCardVariants({});
    expect(typeof styles.headline).toBe('function');
    expect(typeof styles.subtitle).toBe('function');
    // Touch target: the chevron is the only way into a selectable card's details.
    expect(styles.toggle()).toMatch(/\bh-11\b/);
    expect(styles.toggle()).toMatch(/\bw-11\b/);
  });

  // The headline is the card's control — the card itself is not one, because its
  // detail grid renders consumer markup (see mobile-card-shape.ts).
  it('makes the headline button a touch target with a visible focus ring', () => {
    const button = mobileCardVariants({}).headlineButton();
    expect(button).toMatch(/\bmin-h-11\b/);
    // Keyboard-only focus, per the repo-wide rule.
    expect(button).toMatch(/focus-visible:ring-2/);
    expect(button).not.toMatch(/(?<![a-z-])focus:/);
  });

  it('puts the press cue on the headline, not on the card', () => {
    // A card-wide `cursor-pointer` would promise a click the detail grid never
    // delivers — only the headline responds.
    const styles = mobileCardVariants({ interactive: true });
    expect(styles.headlineButton()).toMatch(/\bcursor-pointer\b/);
    expect(styles.card()).not.toMatch(/\bcursor-pointer\b/);
  });
});

describe('smartFilterBarVariants — compact bar', () => {
  // Compact means the five triggers moved into a popover on one button, so the
  // search field and that button share a row instead of stacking.
  it('puts the search field and the tool button on one row', () => {
    const controls = smartFilterBarVariants({ compact: true }).controls();
    expect(controls).toMatch(/\bflex-row\b/);
    expect(controls).toMatch(/\bitems-center\b/);
  });

  it('turns the rule with the tools', () => {
    // Upright between two icons in the capsule; lying across the stacked panel.
    expect(smartFilterBarVariants({ compact: false }).rule()).toMatch(/!h-5/);
    expect(smartFilterBarVariants({ compact: true }).rule()).not.toMatch(/!h-5/);
  });

  it('gives the tool button a touch-sized target', () => {
    const trigger = smartFilterBarVariants({ compact: true }).toolsTrigger();
    expect(trigger).toMatch(/\bmin-h-11\b/);
    expect(trigger).toMatch(/\bmin-w-11\b/);
    // It sits next to a field that may shrink to nothing; the button may not.
    expect(trigger).toMatch(/\bshrink-0\b/);
  });

  // The rows INSIDE the panel need their own touch height: `actionsSection`
  // carries the capsule's, and the compact branch does not render that slot at
  // all — its selector even excludes `[popover]` descendants, which is exactly
  // what these rows are. Asserting it on the trigger alone suggested a coverage
  // that did not exist.
  it('gives every row in the tool panel a touch-sized target', () => {
    const panel = smartFilterBarVariants({ compact: true }).toolsPanel();
    expect(panel).toMatch(/\[&_button\]:min-h-11/);
    expect(panel).toMatch(/\[&>\*\]:min-h-11/);
  });

  it('stays uncompacted by default', () => {
    expect(smartFilterBarVariants({}).controls()).toBe(
      smartFilterBarVariants({ compact: false }).controls()
    );
  });
});

describe('tableHeaderVariants', () => {
  it('produces header slot classes', () => {
    const styles = tableHeaderVariants({ size: 'md' });
    expect(styles.header()).toBeDefined();
    expect(styles.cell()).toBeTruthy();
  });

  it('supports sortable variant', () => {
    const sortable = tableHeaderVariants({ sortable: true }).cell();
    const notSortable = tableHeaderVariants({ sortable: false }).cell();
    expect(sortable).toContain('cursor-pointer');
    expect(notSortable).not.toContain('cursor-pointer');
  });

  it('header is flush (no bg) in default mode — sticky adds its own', () => {
    const flush = tableHeaderVariants({ sticky: false }).header();
    const sticky = tableHeaderVariants({ sticky: true }).header();
    expect(flush).not.toMatch(/\bbg-/);
    expect(sticky).toMatch(/\bbg-surface-elevated\b/);
  });
});

describe('tableContainerVariants — variant', () => {
  it('flush (default) has no chrome on scrollArea', () => {
    const flush = tableContainerVariants({}).scrollArea();
    expect(flush).not.toMatch(/\bborder\b/);
    expect(flush).not.toMatch(/\bbg-/);
    expect(flush).not.toMatch(/\brounded-/);
    expect(flush).not.toMatch(/\bshadow-/);
  });

  it('surface applies bg-surface-quiet only', () => {
    const surface = tableContainerVariants({ variant: 'surface' }).scrollArea();
    expect(surface).toContain('bg-surface-quiet');
    expect(surface).not.toMatch(/\bborder\b/);
  });

  it('framed applies border + rounded-contain + shadow + bg-surface-elevated', () => {
    const framed = tableContainerVariants({ variant: 'framed' }).scrollArea();
    expect(framed).toContain('border-border-default');
    expect(framed).toContain('rounded-contain');
    expect(framed).toContain('bg-surface-elevated');
  });
});

describe('tableRowVariants — hairline', () => {
  it('row uses border-border-hairline (not border-border-subtle)', () => {
    const row = tableRowVariants({}).row();
    expect(row).toContain('border-border-hairline');
    expect(row).not.toContain('border-border-subtle');
  });
});

describe('tableRowVariants — state beats zebra (within-stage fold)', () => {
  it('a selected even row reads as selected, not striped', () => {
    // Pre-fold both bg classes were emitted and @theme order let the zebra
    // tint win — selection highlight was lost on even rows. `striped` is
    // declared before `state` so the state tint wins deterministically.
    const tokens = tableRowVariants({ state: 'selected', striped: 'even' }).row().split(/\s+/);
    expect(tokens).toContain('bg-primary-subtle');
    expect(tokens).not.toContain('bg-surface-quiet');
  });

  it('an expanded even row reads as expanded', () => {
    const tokens = tableRowVariants({ state: 'expanded', striped: 'even' }).row().split(/\s+/);
    expect(tokens).toContain('bg-surface-hover');
    expect(tokens).not.toContain('bg-surface-quiet');
  });

  it('a default even row keeps the zebra tint', () => {
    const tokens = tableRowVariants({ state: 'default', striped: 'even' }).row().split(/\s+/);
    expect(tokens).toContain('bg-surface-quiet');
  });
});

describe('tableHeaderVariants — sortable affordance beats sorted-none (within-stage fold)', () => {
  it('an unsorted sortable column keeps the 60% icon hint', () => {
    // `sortable` is declared after `sorted` so the always-visible affordance
    // wins the opacity bucket over sorted-none's opacity-0.
    const tokens = tableHeaderVariants({ sortable: true, sorted: 'none' }).sortIcon().split(/\s+/);
    expect(tokens).toContain('opacity-60');
    expect(tokens).not.toContain('opacity-0');
  });

  it('a non-sortable column hides the icon entirely', () => {
    const tokens = tableHeaderVariants({ sortable: false, sorted: 'none' }).sortIcon().split(/\s+/);
    expect(tokens).toContain('hidden');
  });
});

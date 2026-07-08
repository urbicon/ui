import { describe, expect, it } from 'vitest';
import { tableContainerVariants, tableHeaderVariants, tableRowVariants } from './table.variants';

describe('tableContainerVariants', () => {
  it('produces base container, toolbar, scrollArea, table and body classes', () => {
    const styles = tableContainerVariants({ size: 'md' });
    expect(styles.container()).toBeTruthy();
    expect(styles.toolbar()).toBeTruthy();
    // scrollArea is empty in default `flush` appearance (Lighter)
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

  it('never outputs dark: overrides', () => {
    const states = ['default', 'selected', 'expanded', 'disabled'] as const;
    for (const state of states) {
      const styles = tableRowVariants({ state });
      expect(styles.row()).not.toMatch(/\bdark:/);
    }
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

  it('Lighter: header is flush (no bg) in default mode — sticky adds its own', () => {
    const flush = tableHeaderVariants({ sticky: false }).header();
    const sticky = tableHeaderVariants({ sticky: true }).header();
    expect(flush).not.toMatch(/\bbg-/);
    expect(sticky).toMatch(/\bbg-surface-elevated\b/);
  });
});

describe('tableContainerVariants — appearance', () => {
  it('flush (default) has no chrome on scrollArea', () => {
    const flush = tableContainerVariants({}).scrollArea();
    expect(flush).not.toMatch(/\bborder\b/);
    expect(flush).not.toMatch(/\bbg-/);
    expect(flush).not.toMatch(/\brounded-/);
    expect(flush).not.toMatch(/\bshadow-/);
  });

  it('surface applies bg-surface-quiet only', () => {
    const surface = tableContainerVariants({ appearance: 'surface' }).scrollArea();
    expect(surface).toContain('bg-surface-quiet');
    expect(surface).not.toMatch(/\bborder\b/);
  });

  it('framed applies border + rounded-contain + shadow + bg-surface-elevated', () => {
    const framed = tableContainerVariants({ appearance: 'framed' }).scrollArea();
    expect(framed).toContain('border-border-default');
    expect(framed).toContain('rounded-contain');
    expect(framed).toContain('bg-surface-elevated');
  });
});

describe('tableRowVariants — Lighter hairline', () => {
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

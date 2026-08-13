import { describe, expect, it } from 'vitest';
import type { TableContainerVariantProps } from './table.variants';
import { tableContainerVariants, tableHeaderVariants, tableRowVariants } from './table.variants';
import {
  filterPanelVariants,
  smartFilterBarTriggerVariants,
  smartFilterBarVariants,
  toolsSheetVariants
} from './table-features.variants';
import { mobileCardVariants, mobileListVariants } from './table-states.variants';

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

  // The layout switch is two class strings that have to be exact complements.
  // Nothing about either file looks wrong when they drift — the symptom is that
  // BOTH layouts render, or NEITHER does, at some width nobody tested. They now
  // live side by side in one config; this is the part a comment cannot enforce.
  //
  // Since `cardsBelow` made the step a prop, "the switch" is seven pairs rather
  // than one, so every assertion below runs per step. A pair that only holds at
  // the default is not the property this guards.
  describe('the layout switch', () => {
    // Read from the config rather than retyped here: a hand-kept list would be
    // a third copy of the steps (config, prop union, test) and the one most
    // likely to fall behind — it would go green by testing fewer steps than
    // exist. The prop union is checked by the compiler instead: `Table.svelte`
    // passes `cardsBelow` straight into this resolver, so a value the union
    // offers and the config lacks fails `svelte-check`.
    const STEPS = Object.keys(
      tableContainerVariants.config.variants?.cardsBelow ?? {}
    ) as NonNullable<TableContainerVariantProps['cardsBelow']>[];

    // The positive control for the loops below: `it.each([])` passes silently,
    // so an empty or renamed axis — including the `?? {}` above catching a
    // renamed one — would take every assertion in this block with it and still
    // report green.
    it('reads every declared step', () => {
      expect(STEPS.length).toBeGreaterThan(1);
      expect(STEPS).toContain('48rem');
    });

    // Every step the config declares renders a switch — the failure this
    // catches is a step that falls through to nothing, which shows both layouts
    // at once and type-checks fine.
    it.each(STEPS)('declares both halves at %s', (cardsBelow) => {
      const styles = tableContainerVariants({ cardsBelow });
      expect(styles.desktopOnly().trim()).not.toBe('');
      expect(styles.mobileOnly().trim()).not.toBe('');
    });

    it.each(STEPS)('hides each layout on exactly the other side of %s', (cardsBelow) => {
      const styles = tableContainerVariants({ cardsBelow });
      const desktop = styles.desktopOnly();
      const mobile = styles.mobileOnly();
      const step = /^@(max|min)-\[([^\]]+)\]:hidden$/;
      const d = desktop.trim().match(step);
      const m = mobile.trim().match(step);

      expect(
        d,
        `desktopOnly should be a single container-hidden rule, got "${desktop}"`
      ).toBeTruthy();
      expect(
        m,
        `mobileOnly should be a single container-hidden rule, got "${mobile}"`
      ).toBeTruthy();
      // The step the prop names is the step both halves query…
      expect(d?.[2]).toBe(cardsBelow);
      expect(m?.[2]).toBe(cardsBelow);
      // …from opposite directions. `@max-[X]` is `(width < X)` and `@min-[X]`
      // is `(width >= X)`, so no width belongs to both halves or to neither.
      expect(d?.[1]).toBe('max');
      expect(m?.[1]).toBe('min');
    });

    // Why `Table.svelte` validates the step before handing it over. `tv()` skips
    // a variant value it does not recognise, so an unknown step leaves both
    // halves of the switch at their (empty) base — and two empty complements
    // hide nothing, which renders the grid and the card list at the same time.
    // This is a property of the resolver, not a bug in it; pinning it here is
    // what keeps the guard in `Table.svelte` from looking like superstition.
    it('resolves an unknown step to no switch at all', () => {
      const styles = tableContainerVariants({
        cardsBelow: '40rem' as NonNullable<TableContainerVariantProps['cardsBelow']>
      });

      expect(styles.desktopOnly().trim()).toBe('');
      expect(styles.mobileOnly().trim()).toBe('');
    });

    it('asks the container, never the viewport', () => {
      // `md:hidden` / `max-md:hidden` is what this used to be, and a table in
      // any column narrower than the window then rendered the wrong layout.
      for (const cardsBelow of STEPS) {
        const styles = tableContainerVariants({ cardsBelow });
        expect(styles.desktopOnly()).toMatch(/^@/);
        expect(styles.mobileOnly()).toMatch(/^@/);
      }
    });

    it('carries no class that names no CSS', () => {
      // `desktop-only` / `mobile-only` were markers with no rule anywhere; the
      // hook is `data-table-layout` now. variants:lint would catch a relapse,
      // but only for as long as these strings stay inside a tv() config.
      const desktop = tableContainerVariants({}).desktopOnly();
      const mobile = tableContainerVariants({}).mobileOnly();
      expect(desktop).not.toMatch(/\bdesktop-only\b/);
      expect(mobile).not.toMatch(/\bmobile-only\b/);
    });
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

describe('mobileCardVariants — the record is not a box', () => {
  // The whole point of the 2026-08-07 rework: the frame, the surface and the
  // radius belong to the list (`tableStyles.scrollArea`), so a record may draw
  // nothing but its separator. A regression here is invisible in a unit test of
  // any single state — it shows up as the stack of outlined panels that used to
  // be there — so this asserts the absence directly.
  it('draws no frame of its own in any state', () => {
    const states = [
      {},
      { selected: true },
      { active: true },
      { expanded: true },
      { interactive: true },
      { collapsed: true }
    ] as const;
    for (const state of states) {
      const card = mobileCardVariants(state).card();
      const utilities = card.split(/\s+/);
      // A radius, an outer margin or a resting elevation would each re-box it.
      expect(card).not.toMatch(/\brounded-/);
      expect(card).not.toMatch(/\bm[btlrxy]?-\d/);
      expect(card).not.toMatch(/\bshadow-\[var\(/);
      // The separator is the ONLY edge — a border on any other side (or on all
      // four) is a ring around the record.
      expect(utilities).not.toContain('border');
      expect(card).not.toMatch(/\bborder-(t|l|r|x|y)\b/);
      // And it is drawn from the container family: VARIANT-CONTRACT §7 reserves
      // `border-subtle` for input affordances.
      expect(card).not.toMatch(/\bborder-border-subtle\b/);
    }
  });

  it('separates two records exactly the way two desktop rows are separated', () => {
    const card = mobileCardVariants({}).card();
    expect(card).toMatch(/\bborder-b\b/);
    expect(card).toMatch(/\bborder-border-hairline\b/);
    // The list's last record closes the list; the rule below it would be a
    // line into empty space.
    expect(card).toMatch(/\blast:border-b-0\b/);
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

  // Without a border to recolour, a ground alone is not enough: `surface-hover`
  // is exactly what the record under the cursor gets, so the reader could not
  // tell the active record from a hovered one — the same reason the desktop row
  // carries a rail (TABLE_STATES.row.active).
  it('gives both marked states an inset rail, in their own colour', () => {
    const selected = mobileCardVariants({ selected: true }).card();
    const active = mobileCardVariants({ active: true }).card();

    expect(selected).toMatch(/shadow-\[inset_2px_0_0_0_var\(--color-primary\)\]/);
    expect(active).toMatch(/shadow-\[inset_2px_0_0_0_var\(--color-border-strong\)\]/);
  });

  it('keeps the hover tint off a record that already carries one', () => {
    // A hover ground would repaint the very ground that says "selected".
    expect(mobileCardVariants({ interactive: true }).header()).toMatch(/hover:bg-surface-hover/);
    expect(mobileCardVariants({ interactive: true, selected: true }).header()).not.toMatch(
      /hover:bg-surface-hover/
    );
    expect(mobileCardVariants({ interactive: true, active: true }).header()).not.toMatch(
      /hover:bg-surface-hover/
    );
  });

  it('stops the hover ground at the header, never over the detail grid', () => {
    // An open record is several hundred pixels of consumer markup; a tint across
    // all of it promises a click only the headline delivers.
    const styles = mobileCardVariants({ interactive: true, expanded: true });
    expect(styles.card()).not.toMatch(/hover:bg-/);
    expect(styles.content()).not.toMatch(/hover:bg-/);
    expect(styles.expandedContent()).not.toMatch(/hover:bg-/);
  });
});

describe('mobileCardVariants — closed card', () => {
  // A closed card is a header and nothing else, so its bottom padding has to
  // match its top one — the open card's tight `pb-1` only exists to close the
  // gap to the detail grid underneath it.
  it('balances the header padding per size', () => {
    const pairs = [
      { size: 'sm', top: 'pt-2\\.5', bottom: 'pb-2\\.5' },
      { size: 'md', top: 'pt-3', bottom: 'pb-3' },
      { size: 'lg', top: 'pt-4', bottom: 'pb-4' }
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

describe('mobileListVariants — the chrome around the records', () => {
  // Both used to be `bg-surface-elevated border border-border-subtle
  // rounded-contain p-4` boxes floated on a margin — the one thing that would
  // still read as a panel once the records stopped being panels.
  it('bands the group header and the totals instead of boxing them', () => {
    const styles = mobileListVariants({});
    for (const band of [styles.groupHeader(), styles.summary()]) {
      expect(band).not.toMatch(/\brounded-/);
      expect(band).not.toMatch(/\bm[btlrxy]?-\d/);
      expect(band).not.toMatch(/\bshadow-/);
      // A single rule on the side that separates it — never a ring.
      expect(band.split(/\s+/)).not.toContain('border');
    }
    expect(styles.summary()).toMatch(/\bborder-t-2\b/);
  });

  it('draws the rule between two groups once, on the group', () => {
    // Not on the header and not on the record above it: a record that ends its
    // group has already dropped its own separator via `last:border-b-0`, so a
    // header with a top rule of its own would leave the first group underlined
    // for no reason and every later one ruled twice.
    expect(mobileListVariants({}).group()).toMatch(/not-first:border-t\b/);
    expect(mobileListVariants({}).groupHeader()).not.toMatch(/\bborder-[tb]\b/);
  });

  it('keeps the group header in the label register of the list, at every size', () => {
    // It is a section label, not a heading that grows with the table — a
    // `font-medium` title at `text-lg` read as one more record with a bold name.
    for (const size of ['sm', 'md', 'lg'] as const) {
      const title = mobileListVariants({ size }).groupTitle();
      expect(title).toMatch(/\buppercase\b/);
      expect(title).toMatch(/\btext-(2xs|xs|sm)\b/);
    }
  });

  // Same table, one vocabulary: the mobile totals speak the desktop `<tfoot>`'s
  // language (summary accent, tabular figures), not a second one of their own.
  it('phrases the totals the way the desktop summary row does', () => {
    const styles = mobileListVariants({});
    expect(styles.summary()).toMatch(/\bborder-summary\b/);
    expect(styles.summary()).toMatch(/\bbg-summary-subtle\b/);
    expect(styles.summaryValue()).toMatch(/\btabular-nums\b/);
    expect(styles.summaryLabel()).toMatch(/\btext-text-secondary\b/);
  });

  it('marks only the error state as danger', () => {
    expect(mobileListVariants({ intent: 'danger' }).state()).toMatch(/\btext-danger\b/);
    expect(mobileListVariants({}).state()).not.toMatch(/\btext-danger\b/);
  });
});

describe('smartFilterBarVariants — compact bar', () => {
  // Compact means the five tools moved out of the bar and into a sheet reached
  // from one button, so the search field and that button share a row instead of
  // stacking.
  it('puts the search field and the tool button on one row', () => {
    const controls = smartFilterBarVariants({ compact: true }).controls();
    expect(controls).toMatch(/\bflex-row\b/);
    expect(controls).toMatch(/\bitems-center\b/);
  });

  it('keeps the tool button from shrinking beside the search field', () => {
    // It sits next to a field that may shrink to nothing; the button may not.
    expect(smartFilterBarVariants({ compact: true }).toolsTrigger()).toMatch(/\bshrink-0\b/);
  });

  // Exactly one element paints a ground in the compact bar. Two of them is not a
  // subtler version of one: the toolbar's `surface-quiet` behind a lit button
  // read as a pale frame around it, which is what a toolbar holding a single
  // control has no business drawing (it is a grouping surface, and there is
  // nothing to group). The toolbar goes `variant="ghost"` there and the ground
  // rides the button — these two arms are how it stays exactly one.
  it('hands the ground to the resting button and to the lit treatment, never to both', () => {
    const resting = smartFilterBarVariants({ compact: true, toolsActive: false }).toolsTrigger();
    const lit = smartFilterBarVariants({ compact: true, toolsActive: true }).toolsTrigger();

    expect(resting).toMatch(/\bbg-surface-quiet\b/);
    // Nothing at all when lit: `smartFilterBarTriggerVariants` supplies
    // `bg-primary-subtle`, and a second `bg-*` on the same element would resolve
    // by stylesheet order rather than by anyone's decision.
    expect(lit).not.toMatch(/\bbg-/);
    expect(smartFilterBarTriggerVariants({ intent: 'primary' })).toMatch(/\bbg-primary-subtle\b/);
  });

  it('asks for the touch target on a coarse pointer, not on a narrow box', () => {
    // Width was the wrong question: a table in a 400px desktop pane got 44px
    // buttons nobody was going to tap, a wide tablet got 32px ones somebody was.
    // The same slot now serves the compact bar too, whose single tool button
    // lives in this capsule.
    const actions = smartFilterBarVariants({ compact: true }).actionsSection();
    expect(actions).toMatch(/pointer-coarse:\[&_button\[aria-haspopup\]/);
    expect(actions).toMatch(/min-h-11/);
    expect(actions).toMatch(/min-w-11/);
    // No width-keyed survivor: the old rule fired unconditionally and cancelled
    // itself at `@md`, so either half left behind would resurrect it.
    expect(actions).not.toMatch(/@md:\[&_button/);
    expect(actions).not.toMatch(/(?<!pointer-coarse:)\[&_button\[aria-haspopup\][^\s]*min-h-11/);
  });

  // #133: the bar knew its capsule/sheet threshold twice — as `@md` in CSS and
  // as `28 * 16` in JS — and the two parted company at any root font size but
  // 16px. CSS decides now and the component reads the answer; this pins that the
  // declaration is there to be read.
  it('publishes the capsule/sheet decision as a custom property on one container step', () => {
    const controls = smartFilterBarVariants({}).controls();
    expect(controls).toMatch(/\[--blocks-table-tools:sheet\]/);
    expect(controls).toMatch(/@md:\[--blocks-table-tools:capsule\]/);
    // Same step as the stacked/row switch beside it — one threshold, not two.
    expect(smartFilterBarVariants({ layout: 'responsive' }).controls()).toMatch(/@md:flex-row/);
  });

  it('only stacks the search row once the bar is compact', () => {
    // The default and the explicit `false` have to differ from `true`, which is
    // what makes the axis worth having. Comparing the default AGAINST `false`
    // would pass even if the axis stopped doing anything at all.
    const relaxed = smartFilterBarVariants({}).controls();
    expect(relaxed).toBe(smartFilterBarVariants({ compact: false }).controls());
    expect(relaxed).not.toBe(smartFilterBarVariants({ compact: true }).controls());
  });
});

describe('toolsSheetVariants', () => {
  // The popover stack this replaced guaranteed 44px rows through the deleted
  // `toolsPanel` slot. RadioItem renders an `inline-flex` label with no minimum
  // height, so without a rule here a sort row is ~20px tall and only as wide as
  // the column name — while the Checkbox rows one section below are 44px.
  it('gives every labelled row a full-width touch target', () => {
    const section = toolsSheetVariants().section();
    expect(section).toMatch(/\[&_label\]:min-h-11/);
    expect(section).toMatch(/\[&_label\]:w-full/);
  });

  it('sizes the segment track too — it renders buttons, not labels', () => {
    expect(toolsSheetVariants().segments()).toMatch(/\[&_button\]:min-h-11/);
  });

  it('keeps the button rule off the sections, so the filter form is untouched', () => {
    // Scoping matters: a blanket `[&_button]:min-h-11` on the section would
    // also inflate the quick-value grid (capped at `max-h-32`) and the
    // remove-filter icons inside FilterPanel.
    expect(toolsSheetVariants().section()).not.toMatch(/\[&_button\]/);
  });
});

describe('filterPanelVariants', () => {
  // The form renders at ~352px inside the filter popover and at ~300px inside
  // the tools sheet, and the operator/value row has to stack in the second case
  // only. That is a container query, not a prop — see the variant's own note.
  it('stacks the operator/value row until the container clears @xs', () => {
    const row = filterPanelVariants({}).filterRow();
    expect(row).toMatch(/\bflex-col\b/);
    expect(row).toMatch(/@xs:flex-row/);
  });

  it('declares the container the row queries against', () => {
    expect(filterPanelVariants({}).root()).toMatch(/@container/);
  });

  it('lets the operator select fill the width while stacked', () => {
    const operator = filterPanelVariants({}).operatorSelect();
    expect(operator).toMatch(/\bw-full\b/);
    expect(operator).toMatch(/@xs:w-32/);
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

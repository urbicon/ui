import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const commandPaletteVariants = tv({
  slots: {
    // tier: contain — floating modal-like surface.
    wrapper: [
      'overflow-hidden rounded-contain border border-border-hairline',
      'bg-surface-overlay shadow-[var(--blocks-shadow-lg)]'
    ],
    inputWrapper: ['flex items-center gap-3 border-b border-border-hairline px-4'],
    input: [
      // `pointer-coarse:text-base` floors the search field to 16px on touch
      // devices — below 16px iOS Safari auto-zooms on focus and never restores.
      'w-full border-0 bg-transparent py-3 text-sm pointer-coarse:text-base',
      'text-text-primary placeholder:text-text-quaternary focus:outline-none'
    ],
    inputIcon: 'h-4 w-4 shrink-0 text-text-tertiary',
    clearButton: 'text-text-quaternary hover:text-text-secondary',
    // `p-1` + `space-y-0.5` = the shared listbox rhythm (XC-9): 4px edge
    // inset, 2px item-to-item gap — same as Select/Combobox/Menu panels.
    list: 'max-h-72 overflow-y-auto p-1 space-y-0.5',
    // `px-3` shares the item's horizontal inset; the micro-typo (2xs,
    // quaternary) is the palette's own command-surface voice.
    groupLabel: ['px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-text-quaternary'],
    // tier: modify — palette items are selectable actions. Rhythm = the md
    // listbox baseline (px-3 py-2 text-sm min-h-2.5rem, gap-2 — XC-9).
    item: [
      'flex w-full items-center gap-2 rounded-modify px-3 py-2 text-sm min-h-[2.5rem]',
      'transition-colors cursor-pointer'
    ],
    itemHighlighted: 'bg-primary-subtle text-primary-text',
    itemDefault: 'text-text-secondary hover:bg-surface-hover',
    itemDisabled: 'text-text-quaternary cursor-not-allowed opacity-50',
    itemIcon: 'h-4 w-4 shrink-0',
    itemText: 'flex min-w-0 flex-1 flex-col items-start gap-0.5',
    itemLabel: 'text-left',
    // One line only: excerpts are prose around a search match and would
    // otherwise reflow every row to a different height.
    itemExcerpt: 'w-full truncate text-left text-2xs text-text-tertiary',
    itemShortcut: [
      'rounded border border-border-subtle bg-surface-subtle',
      'px-1.5 py-0.5 font-mono text-3xs text-text-quaternary'
    ],
    empty: 'py-8 text-center text-sm text-text-tertiary',
    footer: [
      'flex items-center gap-4 border-t border-border-hairline',
      'px-4 py-2 text-2xs text-text-quaternary'
    ],
    footerHint: 'flex items-center gap-1',
    kbd: [
      'rounded border border-border-subtle bg-surface-subtle',
      'px-1 py-0.5 font-mono text-3xs'
    ],
    separator: 'my-1'
  },
  variants: {
    size: {
      sm: { wrapper: 'max-w-sm' },
      md: { wrapper: 'max-w-lg' },
      lg: { wrapper: 'max-w-2xl' }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type CommandPaletteVariants = VariantProps<typeof commandPaletteVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type CommandPaletteSlots = SlotNames<typeof commandPaletteVariants>;

import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// Keyboard-key hint. Centralizes the ad-hoc `<kbd>` styling scattered across the
// docs and the CommandPalette `kbd` slot (commandPalette.variants.ts) into one
// primitive with a physical-keycap look. Pure display — the root is a semantic
// `<kbd>` element; multiple `keys` are joined by a muted separator inside the
// single cap, mirroring how the command palette renders `⌘K`.
export const kbdVariants = tv({
  slots: {
    base: [
      'inline-flex select-none items-center justify-center gap-1 align-middle whitespace-nowrap',
      'font-mono font-medium text-text-secondary',
      'border border-border-subtle bg-surface-elevated',
      'shadow-[var(--blocks-shadow-xs)]'
    ],
    separator: ['font-normal text-text-tertiary']
  },
  variants: {
    size: {
      sm: { base: 'h-4 min-w-4 rounded px-1 text-3xs' },
      md: { base: 'h-5 min-w-5 rounded-md px-1.5 text-2xs' },
      lg: { base: 'h-6 min-w-6 rounded-md px-2 text-xs' }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type KbdVariants = VariantProps<typeof kbdVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type KbdSlots = SlotNames<typeof kbdVariants>;

import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const comboboxVariants = tv({
  slots: {
    base: 'flex w-full flex-col gap-1.5',
    label: 'text-text-secondary block text-sm font-medium',
    requiredMark: 'text-danger ml-0.5',
    inputWrapper: 'relative w-full',
    input: [
      // Radius driven by `tier` axis below.
      'w-full border bg-surface-base text-text-primary',
      // Surface-family border, consistent with Input / Textarea / Select.
      // Form-control frames stay quiet (`border-subtle`); the
      // `border-neutral` intent token is reserved for Action surfaces
      // (Outline-Button, Menu) where the border needs to read as clickable.
      'border-border-subtle hover:border-border-default placeholder:text-text-tertiary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    message: 'text-xs text-danger',
    hint: 'text-xs text-text-tertiary',
    // `position`, `width`, `overflow-y` are set inline in Combobox.svelte
    // so the native `popover="manual"` top-layer rendering works
    // correctly and the UA's `overflow: auto` doesn't render a duplicate
    // scrollbar. Width is sized by Floating UI's `size` middleware.
    // tier: contain — floating dropdown panel.
    listbox: [
      'rounded-contain border',
      'bg-surface-elevated border-border-subtle shadow-[var(--blocks-shadow-md)]',
      'max-h-60 p-1 space-y-0.5'
    ],
    option: [
      'flex w-full items-center gap-2 rounded-modify px-3 py-2 text-left',
      'text-text-primary cursor-pointer select-none',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none'
    ],
    optionActive: 'bg-surface-hover',
    optionSelected: 'bg-surface-selected font-medium',
    noResults: 'px-3 py-4 text-center text-sm text-text-tertiary',
    clear: [
      'absolute right-2 top-1/2 -translate-y-1/2 rounded-modify p-1.5',
      'text-text-tertiary hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    chevron: [
      'absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none',
      'text-text-tertiary w-4 h-4',
      'transition-transform duration-[var(--blocks-duration-fast)]'
    ]
  },
  variants: {
    // 3-tier semantic radius for the Combobox input. Default `modify`.
    // Options keep their own r-interactive; only the input rounding flips.
    tier: {
      modify: { input: 'rounded-modify' },
      commit: { input: 'rounded-commit' }
    },
    size: {
      sm: {
        input: 'h-8 px-3 pr-8 text-sm',
        option: 'px-2 py-1.5 text-sm min-h-[2rem]'
      },
      md: {
        input: 'h-10 px-3 pr-8 text-base',
        option: 'px-3 py-2 text-sm min-h-[2.5rem]'
      },
      lg: {
        input: 'h-12 px-4 pr-10 text-lg',
        option: 'px-3 py-2.5 text-base min-h-[3rem]'
      }
    },
    open: {
      true: { chevron: 'rotate-180' }
    },
    disabled: {
      true: { base: 'opacity-50 pointer-events-none' }
    }
  },
  defaultVariants: {
    tier: 'modify',
    size: 'md',
    open: false,
    disabled: false
  }
});

export type ComboboxVariants = VariantProps<typeof comboboxVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ComboboxSlots = SlotNames<typeof comboboxVariants>;

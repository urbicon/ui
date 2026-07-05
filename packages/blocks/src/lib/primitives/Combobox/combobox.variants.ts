import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const comboboxVariants = tv({
  slots: {
    base: 'flex w-full flex-col gap-1.5',
    label: 'text-text-secondary block text-sm font-medium',
    requiredMark: 'text-danger ml-0.5',
    inputWrapper: 'relative w-full',
    input: [
      // Radius driven by `tier` axis below; the `underline` variant overrides
      // it to `rounded-none`. Border color and background come from the
      // `variant` axis (default `outlined` keeps the historical look).
      'w-full border bg-surface-base text-text-primary placeholder:text-text-tertiary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    message: 'text-xs text-danger',
    hint: 'text-xs text-text-tertiary',
    // `position`, `width`, `overflow-y` are set inline in Combobox.svelte
    // so the native `popover="manual"` top-layer rendering works
    // correctly and the UA's `overflow: auto` doesn't render a duplicate
    // scrollbar. Width AND a keyboard-aware max-height come from Floating
    // UI's `size` middleware: it sets `--blocks-overlay-available-height`
    // to the room left in the visual viewport (e.g. above the iOS keyboard);
    // the `max-h-[min(15rem,…)]` below keeps 15rem as the upper design cap
    // via `min()` and falls back to it whenever the var is unset.
    // tier: contain — floating dropdown panel.
    listbox: [
      'rounded-contain border',
      'bg-surface-elevated border-border-subtle shadow-[var(--blocks-shadow-md)]',
      'max-h-[min(15rem,var(--blocks-overlay-available-height,100dvh))] p-1 space-y-0.5'
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
    // Chevron toggle button. The input opens on focus and can't "toggle
    // closed" (re-clicking a focused field is a no-op), so the chevron is the
    // discoverable open/close affordance. `tabindex={-1}` keeps it out of the
    // tab order — the input is the single combobox tab stop — and an
    // `onmousedown` preventDefault keeps focus on the input when it's clicked.
    chevronButton: [
      'absolute right-1.5 top-1/2 -translate-y-1/2',
      'inline-flex items-center justify-center rounded-modify p-1',
      'text-text-tertiary hover:text-text-primary cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'disabled:cursor-not-allowed disabled:hover:text-text-tertiary'
    ],
    chevron: ['w-4 h-4', 'transition-transform duration-[var(--blocks-duration-fast)]']
  },
  variants: {
    // 3-tier semantic radius for the Combobox input. Default `modify`.
    // Options keep their own r-interactive; only the input rounding flips.
    tier: {
      modify: { input: 'rounded-modify' },
      commit: { input: 'rounded-commit' }
    },
    // Visual style, at parity with Input / Textarea / Select. Default
    // `outlined` reproduces the historical Combobox frame exactly.
    variant: {
      // Surface-family border: form-control frames stay quiet (`border-subtle`);
      // the `border-neutral` intent token is reserved for Action surfaces
      // (Outline-Button, Menu) where the border must read as clickable.
      outlined: { input: 'border-border-subtle hover:border-border-default' },
      filled: {
        input:
          'bg-surface-interactive border-transparent hover:bg-surface-hover focus-visible:bg-surface-base'
      },
      ghost: {
        input:
          'bg-transparent border-transparent hover:bg-surface-subtle focus-visible:bg-surface-base focus-visible:border-border-subtle'
      },
      underline: {
        input:
          'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0'
      }
    },
    size: {
      sm: {
        // `pointer-coarse:text-base` floors the input to 16px on touch-primary
        // devices so iOS Safari doesn't auto-zoom (and never un-zoom) on focus.
        input: 'h-8 px-3 pr-8 text-sm pointer-coarse:text-base',
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
    variant: 'outlined',
    size: 'md',
    open: false,
    disabled: false
  }
});

export type ComboboxVariants = VariantProps<typeof comboboxVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ComboboxSlots = SlotNames<typeof comboboxVariants>;

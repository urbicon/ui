import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const selectVariants = tv({
  slots: {
    wrapper: ['flex flex-col w-full gap-1.5'],
    base: ['relative w-full'],
    trigger: [
      // Radius driven by `tier` axis below.
      'flex w-full items-center justify-between border',
      'bg-surface-base text-text-primary cursor-pointer select-none',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:border-border-default',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary'
    ],
    triggerText: ['truncate text-left flex-1'],
    placeholder: ['text-text-tertiary truncate flex-1'],
    chevron: [
      'shrink-0 text-text-tertiary',
      'transition-transform duration-[var(--blocks-duration-fast)]'
    ],
    clear: [
      'absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-modify',
      'text-text-tertiary hover:text-text-primary cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    // `position`, `width`, `overflow-y` are set inline in Select.svelte
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
      'flex w-full items-center gap-2 rounded-modify px-3 cursor-pointer select-none',
      'text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-surface-hover'
    ],
    optionLabel: ['truncate text-left flex-1'],
    optionCheck: [
      'shrink-0 text-primary opacity-0 transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    // Multi-select indicator. Leading position (before the label) mirrors the
    // native `<input type=checkbox>` placement so multi-select rows read like a
    // checkbox list. The `[&_svg]` cascade lets the inner check icon fade in.
    optionCheckbox: [
      'shrink-0 inline-flex items-center justify-center rounded-modify border border-border-default',
      'bg-surface-base transition-colors duration-[var(--blocks-duration-fast)]',
      '[&_svg]:opacity-0 [&_svg]:transition-opacity [&_svg]:duration-[var(--blocks-duration-fast)]'
    ],
    group: [],
    groupLabel: ['px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wider'],
    label: ['block font-medium text-text-secondary text-sm'],
    message: ['text-xs']
  },
  variants: {
    // 3-tier semantic radius for the Select trigger. Default `modify`.
    // Options inside the listbox keep their own r-interactive — switching
    // them to pill would not improve readability and is intentionally not
    // part of the tier axis.
    tier: {
      modify: { trigger: 'rounded-modify' },
      commit: { trigger: 'rounded-commit' }
    },
    variant: {
      outlined: { trigger: 'border-border-subtle' },
      filled: {
        trigger:
          'bg-surface-interactive border-transparent hover:bg-surface-hover focus-visible:bg-surface-base'
      },
      ghost: {
        trigger:
          'bg-transparent border-transparent hover:bg-surface-subtle focus-visible:bg-surface-base focus-visible:border-border-subtle'
      },
      underline: {
        trigger:
          'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0'
      }
    },
    size: {
      sm: {
        trigger: 'h-8 pl-3 pr-8 text-sm gap-2',
        chevron: 'w-3.5 h-3.5',
        clear: 'right-2 p-0.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        option: 'py-1.5 text-sm min-h-[2rem]',
        optionCheck: 'w-3.5 h-3.5',
        optionCheckbox: 'w-3.5 h-3.5 [&_svg]:w-2.5 [&_svg]:h-2.5'
      },
      md: {
        trigger: 'h-10 pl-4 pr-10 text-base gap-2',
        chevron: 'w-4 h-4',
        clear: 'right-3 p-0.5 [&_svg]:w-4 [&_svg]:h-4',
        option: 'py-2 text-sm min-h-[2.5rem]',
        optionCheck: 'w-4 h-4',
        optionCheckbox: 'w-4 h-4 [&_svg]:w-3 [&_svg]:h-3'
      },
      lg: {
        trigger: 'h-12 pl-5 pr-12 text-lg gap-3',
        chevron: 'w-5 h-5',
        clear: 'right-4 p-0.5 [&_svg]:w-5 [&_svg]:h-5',
        option: 'py-2.5 text-base min-h-[3rem]',
        optionCheck: 'w-5 h-5',
        optionCheckbox: 'w-[18px] h-[18px] [&_svg]:w-3.5 [&_svg]:h-3.5'
      }
    },
    open: {
      true: { chevron: 'rotate-180' }
    },
    disabled: {
      true: {
        trigger: 'opacity-50 cursor-not-allowed pointer-events-none bg-surface-subtle',
        label: 'text-text-disabled'
      }
    },
    error: {
      true: {
        trigger: 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
        message: 'text-danger'
      }
    },
    required: {
      true: {
        label: "after:content-['*'] after:ml-1 after:text-danger"
      }
    },
    selected: {
      true: {
        optionCheck: 'opacity-100',
        optionCheckbox: 'border-primary bg-primary text-text-on-primary [&_svg]:opacity-100'
      }
    },
    messageType: {
      error: { message: 'text-danger' },
      helper: { message: 'text-text-tertiary' }
    }
  },
  compoundVariants: [
    {
      variant: 'ghost',
      error: false,
      class: { trigger: 'border-transparent' }
    }
  ],
  defaultVariants: {
    tier: 'modify',
    variant: 'outlined',
    size: 'md',
    open: false,
    disabled: false,
    error: false,
    required: false,
    selected: false,
    messageType: 'helper'
  }
});

export type SelectVariants = VariantProps<typeof selectVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SelectSlots = SlotNames<typeof selectVariants>;

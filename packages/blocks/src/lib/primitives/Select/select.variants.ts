import { FIELD_MESSAGE_TONES, fieldErrorFrame } from '$lib/internal/field-chrome';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// The trigger is the focusable element, so the error ring lives on it directly.
const focus = 'focus-visible';

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
    // `space-y-0.5` keeps grouped options on the same item-to-item rhythm as
    // the flat listbox (whose spacing lives on the `listbox` slot) — without
    // it, adjacent selected-highlights inside a group touch (XC-9).
    group: ['space-y-0.5'],
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
          'bg-surface-interactive border-transparent hover:bg-surface-interactive-hover focus-visible:bg-surface-base'
      },
      ghost: {
        trigger:
          'bg-transparent border-transparent hover:bg-surface-hover focus-visible:bg-surface-base focus-visible:border-border-subtle'
      },
      underline: {
        trigger:
          'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0'
      }
    },
    size: {
      // Full xs–xl scale, mirroring Input's h-7…h-14 ladder (form-family
      // symmetry: a dense form should not pair an xs Input with an sm Select).
      // Option inset (`px`) and the group label track the shared listbox item
      // rhythm (XC-9): px-2 below md, px-3 at md/lg (slot base), px-4 at xl —
      // the group header always shares the item's horizontal inset.
      xs: {
        trigger: 'h-7 pl-2 pr-7 text-xs gap-1.5',
        chevron: 'w-3 h-3',
        clear: 'right-1.5 p-0.5 [&_svg]:w-3 [&_svg]:h-3',
        option: 'px-2 py-1 text-xs min-h-[1.75rem]',
        optionCheck: 'w-3 h-3',
        optionCheckbox: 'w-3 h-3 [&_svg]:w-2 [&_svg]:h-2',
        groupLabel: 'px-2'
      },
      sm: {
        trigger: 'h-8 pl-3 pr-8 text-sm gap-2',
        chevron: 'w-3.5 h-3.5',
        clear: 'right-2 p-0.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        option: 'px-2 py-1.5 text-sm min-h-[2rem]',
        optionCheck: 'w-3.5 h-3.5',
        optionCheckbox: 'w-3.5 h-3.5 [&_svg]:w-2.5 [&_svg]:h-2.5',
        groupLabel: 'px-2'
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
      },
      xl: {
        trigger: 'h-14 pl-6 pr-14 text-xl gap-3',
        chevron: 'w-6 h-6',
        clear: 'right-5 p-1 [&_svg]:w-6 [&_svg]:h-6',
        option: 'px-4 py-3 text-lg min-h-[3.5rem]',
        optionCheck: 'w-6 h-6',
        optionCheckbox: 'w-5 h-5 [&_svg]:w-4 [&_svg]:h-4',
        groupLabel: 'px-4'
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
    // Declared BEFORE `error` so the error tone wins the message-color
    // bucket in every call shape — `{ error: true }` alone must read red.
    messageType: {
      error: { message: FIELD_MESSAGE_TONES.error },
      helper: { message: FIELD_MESSAGE_TONES.helper }
    },
    // Same error frame as every other field (shared fragment, so a token fix
    // can't miss Select again). Unlike Input/Textarea/PinInput/TimeInput,
    // Select has no `intent` axis, so nothing competes for the border/ring
    // buckets and the frame can stay on the axis. If an `intent` axis is ever
    // added here, move this to the compound stage — see the precedence note in
    // input.variants.ts.
    error: {
      true: {
        trigger: fieldErrorFrame(focus),
        message: FIELD_MESSAGE_TONES.error
      }
    },
    required: {
      true: {
        label: "after:content-['*'] after:ml-1 after:text-danger"
      }
    },
    selected: {
      true: {
        // Form-family selected signature (parity with Combobox `optionSelected`):
        // persistent value marking = `bg-surface-selected font-medium` + primary
        // check. The keyboard/hover cursor (`bg-surface-hover`, call-site class)
        // still wins the bg bucket, so the cursor stays visible on selected rows.
        option: 'bg-surface-selected font-medium',
        optionCheck: 'opacity-100',
        optionCheckbox: 'border-primary bg-primary text-text-on-primary [&_svg]:opacity-100'
      }
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

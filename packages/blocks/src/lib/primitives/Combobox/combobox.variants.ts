import { FIELD_MESSAGE_TONES, fieldErrorFrame } from '$lib/internal/field-chrome';
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
      // `/20` matches `fieldFocusRing` in internal/field-chrome.ts, which Input,
      // Textarea, Select, PinInput and TimeInput all use. At `/50` this field was
      // the odd one out in both directions: a stronger valid ring than every
      // sibling, and — once it gained the shared error frame (ring-danger/20) —
      // an invalid state weaker than its own valid one. The icon-button slots
      // below keep `/50`: they are small targets, not field frames.
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    // Message tone follows the ROLE of the text, not the field state: the
    // `message` slot only ever renders the `error` string (the markup picks it
    // over `helper`, they are mutually exclusive), so the two slots carry the
    // two shared field-message tones — a helper never reads red. Sibling
    // fields express the same thing through a `messageType` axis because they
    // render both roles through ONE `message` slot; here the slot split
    // already encodes it.
    message: ['text-xs', FIELD_MESSAGE_TONES.error],
    helper: ['text-xs', FIELD_MESSAGE_TONES.helper],
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
      'focus-visible:outline-none',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    optionActive: 'bg-surface-hover',
    optionSelected: 'bg-surface-selected font-medium',
    // Trailing selected-check (parity with Select `optionCheck`): always
    // rendered with reserved space, fades in via opacity — no layout shift
    // when a row becomes selected. Sized one step with the option per size.
    optionCheck: [
      'shrink-0 text-primary opacity-0 transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    // Grouped options (parity with Select). `group` carries the same
    // item-to-item rhythm as the flat listbox (`space-y-0.5` there lives on
    // the `listbox` slot); the label is a quiet, uppercase section header.
    group: 'space-y-0.5',
    groupLabel: 'px-3 py-1.5 text-xs font-medium text-text-tertiary uppercase tracking-wider',
    noResults: 'px-3 py-4 text-center text-sm text-text-tertiary',
    // Async-search in-flight message (queryFn). Mirrors noResults so both listbox
    // status rows read alike; separate slot so consumers can style them apart.
    loading: 'px-3 py-4 text-center text-sm text-text-tertiary',
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
    chevron: ['w-4 h-4', 'transition-transform duration-[var(--blocks-duration-fast)]'],
    // ── Multi-select tokenizer (only rendered when `multiple`) ──────────────
    // In multi mode the visible frame moves from the `input` onto `control`: a
    // flex-wrap box that holds the selected tags and a borderless search input.
    // The `input` slot (and its full tier/variant/size styling) stays the frame
    // for single mode — untouched — so the two modes never fight over the same
    // classes. Frame colour/radius/size come from the axes below, mirroring how
    // `input` is styled for single mode.
    control: [
      'flex w-full flex-wrap items-center border bg-surface-base cursor-text',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      // `/20` — same reason as the `input` slot above.
      'focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary'
    ],
    // Borderless search input inside `control`; the frame owns the border/ring.
    search: [
      'flex-1 min-w-[6rem] border-0 bg-transparent p-0 text-text-primary placeholder:text-text-tertiary',
      'focus-visible:outline-none focus-visible:ring-0',
      'disabled:cursor-not-allowed'
    ],
    // Removable selection chip. `customTag` replaces this entirely.
    tag: [
      'inline-flex max-w-full items-center gap-1 rounded-modify bg-surface-interactive text-text-primary font-medium'
    ],
    tagLabel: 'truncate',
    tagRemove: [
      'inline-flex shrink-0 items-center justify-center rounded-full',
      'text-text-tertiary hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'disabled:cursor-not-allowed'
    ]
  },
  variants: {
    // 3-tier semantic radius for the Combobox input. Default `modify`.
    // Options keep their own r-interactive; only the input (and, in multi mode,
    // the tokenizer `control`) rounding flips.
    tier: {
      modify: { input: 'rounded-modify', control: 'rounded-modify' },
      commit: { input: 'rounded-commit', control: 'rounded-commit' }
    },
    // Visual style, at parity with Input / Textarea / Select. Default
    // `outlined` reproduces the historical Combobox frame exactly.
    // Each variant styles both the single-mode `input` frame and the multi-mode
    // `control` frame identically; `control` drops the per-tag `hover:` shifts
    // that would misfire when hovering a chip inside the box.
    variant: {
      // Surface-family border: form-control frames stay quiet (`border-subtle`);
      // the `border-neutral` intent token is reserved for Action surfaces
      // (Outline-Button, Menu) where the border must read as clickable.
      outlined: {
        input: 'border-border-subtle hover:border-border-default',
        control: 'border-border-subtle hover:border-border-default'
      },
      filled: {
        input:
          'bg-surface-interactive border-transparent hover:bg-surface-interactive-hover focus-visible:bg-surface-base',
        control: 'bg-surface-interactive border-transparent focus-within:bg-surface-base'
      },
      ghost: {
        input:
          'bg-transparent border-transparent hover:bg-surface-subtle focus-visible:bg-surface-base focus-visible:border-border-subtle',
        control:
          'bg-transparent border-transparent focus-within:bg-surface-base focus-within:border-border-subtle'
      },
      underline: {
        input:
          'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0',
        control:
          'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-within:ring-0'
      }
    },
    size: {
      // Full xs–xl scale, mirroring Input's h-7…h-14 ladder (form-family
      // symmetry: a dense form should not pair an xs Input with an sm Combobox).
      // The multi-mode tokenizer (`control`/`search`/`tag`) tracks the same
      // ladder: `control` uses `min-h-*` (not `h-*`) so it grows as tags wrap,
      // and reserves right padding (`pr-*`) for the absolute chevron/clear.
      // Option rows follow the shared listbox item rhythm (XC-9); the group
      // label always shares the option's horizontal inset.
      xs: {
        // `pointer-coarse:text-base` floors the input to 16px on touch-primary
        // devices so iOS Safari doesn't auto-zoom (and never un-zoom) on focus.
        input: 'h-7 px-2 pr-7 text-xs pointer-coarse:text-base',
        option: 'px-2 py-1 text-xs min-h-[1.75rem]',
        optionCheck: 'w-3 h-3',
        groupLabel: 'px-2',
        control: 'min-h-7 gap-1 px-1.5 py-1 pr-7',
        search: 'text-xs pointer-coarse:text-base',
        tag: 'text-xs px-1.5 py-0.5',
        tagRemove: '[&_svg]:h-2.5 [&_svg]:w-2.5'
      },
      sm: {
        // See `xs` — floor to 16px on touch to avoid iOS Safari focus-zoom.
        input: 'h-8 px-3 pr-8 text-sm pointer-coarse:text-base',
        option: 'px-2 py-1.5 text-sm min-h-[2rem]',
        optionCheck: 'w-3.5 h-3.5',
        groupLabel: 'px-2',
        control: 'min-h-8 gap-1 px-2 py-1 pr-8',
        search: 'text-sm pointer-coarse:text-base',
        tag: 'text-xs px-2 py-0.5',
        tagRemove: '[&_svg]:h-3 [&_svg]:w-3'
      },
      md: {
        input: 'h-10 px-3 pr-8 text-base',
        option: 'px-3 py-2 text-sm min-h-[2.5rem]',
        optionCheck: 'w-4 h-4',
        control: 'min-h-10 gap-1.5 px-2 py-1.5 pr-8',
        search: 'text-base',
        tag: 'text-sm px-2 py-0.5',
        tagRemove: '[&_svg]:h-3 [&_svg]:w-3'
      },
      lg: {
        input: 'h-12 px-4 pr-10 text-lg',
        option: 'px-3 py-2.5 text-base min-h-[3rem]',
        optionCheck: 'w-5 h-5',
        control: 'min-h-12 gap-2 px-3 py-2 pr-10',
        search: 'text-lg',
        tag: 'text-base px-2.5 py-1',
        tagRemove: '[&_svg]:h-3.5 [&_svg]:w-3.5'
      },
      xl: {
        input: 'h-14 px-6 pr-12 text-xl',
        option: 'px-4 py-3 text-lg min-h-[3.5rem]',
        optionCheck: 'w-6 h-6',
        groupLabel: 'px-4',
        control: 'min-h-14 gap-2 px-4 py-2.5 pr-12',
        search: 'text-xl',
        tag: 'text-lg px-3 py-1',
        tagRemove: '[&_svg]:h-4 [&_svg]:w-4'
      }
    },
    open: {
      true: { chevron: 'rotate-180' }
    },
    disabled: {
      true: { base: 'opacity-50 pointer-events-none' }
    },
    // Validation frame, at parity with every other field — the SHARED fragment
    // (`fieldErrorFrame`), not a hand-copied one, so the next token fix cannot
    // miss Combobox the way it missed it before this axis existed (until then
    // an invalid Combobox only announced itself via `aria-invalid`, with no
    // visible frame at all).
    //
    // Both frames are painted because the visible frame moves between modes:
    // single mode wears it on the `input`, multi mode on the tokenizer
    // `control` — which lights via `focus-within`, since focus lives on the
    // borderless search input inside it. Declared LAST so it wins the
    // border/ring buckets against `variant`; Combobox has no `intent` axis (a
    // deliberate non-goal for now), so nothing else competes. If one is ever
    // added, move this frame to the compound stage — see the precedence note
    // in input.variants.ts.
    error: {
      true: {
        input: fieldErrorFrame('focus-visible'),
        control: fieldErrorFrame('focus-within')
      }
    }
  },
  defaultVariants: {
    tier: 'modify',
    variant: 'outlined',
    size: 'md',
    open: false,
    disabled: false,
    error: false
  }
});

export type ComboboxVariants = VariantProps<typeof comboboxVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ComboboxSlots = SlotNames<typeof comboboxVariants>;

import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Slot styles for the A2UI renderer. Pure semantic tokens — no `dark:`, no
 * hardcoded colours. Enum-driven layout (justify/align/direction/fit/size) is
 * NOT modelled as tv() variant axes: those tokens live as complete class-string
 * lookup maps inside `A2UINode.svelte` (so Tailwind's scanner still sees them),
 * which keeps this config a flat, dead-token-free set of slots (the tv() text-*
 * colour-bucketing trap only bites when a size utility and a colour utility
 * share one slot across a variant fold — here every slot is single-combination).
 */
export const a2uiViewVariants = tv({
  slots: {
    /** Outer view container. Establishes the base text colour every node inherits. */
    root: 'flex min-w-0 flex-col gap-3 text-text-primary',
    /** Per-surface wrapper (one surface per createSurface). */
    surface: 'flex min-w-0 flex-col',
    /** Message list inside the top-level error summary Alert. */
    errorList: 'flex flex-col gap-0.5 text-sm',
    /** Inline fault chip standing in for an un-renderable node (unknown/unsupported/dangling). */
    errorChip: [
      'inline-flex max-w-full items-center gap-1.5 rounded-modify',
      'bg-danger-subtle px-2 py-1 text-xs text-danger'
    ],
    /** Icon inside a fault or blocked chip; size comes from the icon prop. */
    errorIcon: 'shrink-0',
    /** Streaming placeholder wrapper for a not-yet-defined reference. */
    pending: 'inline-flex items-center gap-1.5',
    /** Column layout container (flex-col); justify/align appended per instance. */
    column: 'flex min-w-0 flex-col gap-2',
    /** Row layout container (flex-row); justify/align appended per instance. */
    row: 'flex min-w-0 flex-row gap-2',
    /** List container (`<ul>`); flow direction appended per instance. */
    list: 'm-0 flex min-w-0 list-none gap-1 p-0',
    /** List item (`<li>`). */
    listItem: 'min-w-0',
    /** Heading element for Text variants h1–h5; the font-size step is appended per level. */
    heading: 'min-w-0 break-words font-semibold leading-tight text-text-primary',
    /** Caption Text variant. */
    caption: 'min-w-0 break-words text-xs text-text-tertiary',
    /** Plain inline text (Text inside a Button label / inline context). */
    inlineText: 'text-sm',
    /** Rendered image element (only when the URL passes the policy). */
    image: 'block max-w-full rounded-contain border border-border-subtle',
    /** Alt-text chip shown when an image URL is blocked by the policy. */
    blockedChip: [
      'inline-flex max-w-full items-center gap-1.5 rounded-modify',
      'bg-neutral-subtle px-2 py-1 text-xs text-text-secondary'
    ],
    /** Icon wrapper (mapped Icon component). */
    icon: 'inline-flex shrink-0 text-current',
    /** Inline `<svg>` for a guarded custom `svgPath`. */
    svgIcon: 'inline-block shrink-0 fill-none stroke-current',
    /** Wrapper for the multiple-selection ChoicePicker (label + checkboxes). */
    choiceGroup: 'flex min-w-0 flex-col gap-2',
    /** Group label for the multiple-selection ChoicePicker. */
    choiceLabel: 'text-sm font-medium text-text-secondary'
  }
});

export type A2UIViewVariants = VariantProps<typeof a2uiViewVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type A2UIViewSlots = SlotNames<typeof a2uiViewVariants>;

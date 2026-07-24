import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Extra slot styles the Urbicon A2UI dispatcher needs BEYOND the base
 * `a2uiViewVariants` slots it inherits through the render context (column, row,
 * list, icon, image, errorChip, pending, …). These are for the raw-HTML bits the
 * Urbicon catalog renders itself — the `Section` archetype, plain body text, the
 * field-error line — everything else renders through a real Urbicon component
 * that carries its own tokens.
 *
 * Loaded LOCALLY by `UrbiconA2UINode.svelte` (never by the base `A2UIView` /
 * `A2UINode`), so `urbicon/` value code stays out of the Basic bundle. Pure
 * semantic tokens — no `dark:`, no hardcoded colours.
 */
export const a2uiUrbiconVariants = tv({
  slots: {
    /** Section wrapper (title/description block + body). */
    section: 'flex min-w-0 flex-col gap-3',
    /** Section header (title + optional description). */
    sectionHeader: 'flex min-w-0 flex-col gap-1',
    /** Section title heading. */
    sectionTitle: 'min-w-0 text-lg font-semibold leading-tight text-text-primary',
    /** Section description (secondary text under the title). */
    sectionDescription: 'min-w-0 text-sm text-text-secondary',
    /** Plain body text (Text variant=body — PLAIN, no Markdown). */
    body: 'min-w-0 break-words text-sm text-text-primary',
    /** A form field's error message line (shown under a field when `error` is non-empty). */
    fieldError: 'mt-1 text-xs text-danger',
    /** Wrapper around a form field + its error line. */
    field: 'flex min-w-0 flex-col',
    /** Wrapper for the EmptyState call-to-action. */
    emptyStateCta: 'mt-2 flex justify-center'
  }
});

export type A2UIViewUrbiconVariants = VariantProps<typeof a2uiUrbiconVariants>;
export type A2UIViewUrbiconSlots = SlotNames<typeof a2uiUrbiconVariants>;

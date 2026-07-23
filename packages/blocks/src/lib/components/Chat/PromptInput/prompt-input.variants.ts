import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const promptInputVariants = tv({
  slots: {
    // Single bordered composer surface. The focus ring lives on the container
    // (focus-within) so the whole composer reads as one field even though the
    // textarea inside is chromeless — the family's "one input" look.
    root: [
      'relative flex flex-col w-full box-border',
      'bg-surface-base border border-border-default rounded-contain',
      'transition-[border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0',
      // A file is being dragged over the composer.
      'data-[dragging=true]:border-primary data-[dragging=true]:ring-2 data-[dragging=true]:ring-primary'
    ],
    // Chip strip above the textarea. Wraps; scrolls vertically if it grows past
    // a couple of rows so the composer never explodes in height.
    attachmentsStrip: ['flex flex-wrap gap-1.5', 'px-2.5 pt-2.5', 'max-h-32 overflow-y-auto'],
    attachmentChip: [
      'inline-flex items-center gap-1.5 max-w-full min-w-0',
      'py-1 pl-1 pr-1.5',
      'bg-surface-elevated border border-border-subtle rounded-modify'
    ],
    // Fixed box that holds either the image preview or the file icon.
    attachmentThumb: [
      'inline-flex items-center justify-center shrink-0',
      'size-7 rounded-modify overflow-hidden',
      'bg-surface-interactive text-text-tertiary',
      '[&>img]:size-full [&>img]:object-cover'
    ],
    attachmentName: ['truncate text-xs text-text-primary min-w-0'],
    attachmentSize: ['shrink-0 text-2xs text-text-tertiary tabular-nums'],
    attachmentRemove: [
      'inline-flex items-center justify-center shrink-0',
      'size-5 rounded-modify',
      'text-text-tertiary cursor-pointer',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
    ],
    // Chromeless auto-growing textarea — the composer surface owns the border.
    textarea: [
      'w-full resize-none bg-transparent',
      'text-text-primary placeholder:text-text-tertiary',
      'border-0 outline-none focus:outline-none focus-visible:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-60'
    ],
    // Bottom bar: leading zone (attach) | spacer | trailing zone (send/stop).
    actions: ['flex items-center justify-between gap-2 px-2 pb-2'],
    leading: ['flex items-center gap-1 min-w-0'],
    trailing: ['flex items-center gap-1 shrink-0'],
    // Icon-only affordance buttons.
    attachButton: [
      'inline-flex items-center justify-center shrink-0',
      'rounded-modify text-text-secondary cursor-pointer',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'
    ],
    sendButton: [
      'inline-flex items-center justify-center shrink-0',
      'rounded-modify cursor-pointer',
      'bg-primary text-text-on-primary',
      'transition-[color,background-color,opacity] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-primary-hover active:bg-primary-active',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary'
    ],
    stopButton: [
      'inline-flex items-center justify-center shrink-0',
      'rounded-modify cursor-pointer',
      'bg-neutral text-text-on-primary',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-neutral-hover active:bg-neutral-active',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
    ],
    // Compact inline validation line (first rejection). role=status is set in
    // the component; the empty state renders no box.
    error: ['px-3 pb-2 text-xs text-danger'],
    // Helper line under the composer (e.g. "Enter to send").
    hint: ['px-3 pb-2 text-xs text-text-tertiary']
  },
  variants: {
    size: {
      sm: {
        textarea: 'px-2.5 pt-2.5 text-sm leading-5',
        attachButton: 'size-7',
        sendButton: 'size-7',
        stopButton: 'size-7'
      },
      md: {
        textarea: 'px-3 pt-3 text-sm leading-6',
        attachButton: 'size-8',
        sendButton: 'size-8',
        stopButton: 'size-8'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type PromptInputVariants = VariantProps<typeof promptInputVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type PromptInputSlots = SlotNames<typeof promptInputVariants>;

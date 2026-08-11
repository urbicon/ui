import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toastVariants = tv({
  slots: {
    container: 'fixed z-[var(--z-tooltip)] flex flex-col pointer-events-none',
    // tier: contain — toast is a floating notification surface.
    // No border on the base, only shadow + surface. The intent signal comes
    // through the icon color and the progress bar.
    toast: [
      'relative overflow-hidden',
      'pointer-events-auto flex items-start gap-3 w-full max-w-sm',
      'rounded-contain p-4',
      'shadow-[var(--blocks-shadow-lg)]',
      // No transform entry: the enter/exit motion is Svelte's `transition:fly`,
      // which runs as a CSS *animation* (keyframes) and ignores
      // `transition-property` entirely. Nothing on this slot sets a
      // scale/translate/rotate utility, so a `transform` entry was dead weight.
      'transition-[color,background-color,box-shadow,opacity] duration-[var(--blocks-duration-normal)] ease-[var(--blocks-ease-smooth)]'
    ],
    icon: 'shrink-0 mt-0.5 w-5 h-5',
    content: 'flex-1 min-w-0',
    title: 'font-semibold text-sm leading-tight',
    description: 'text-sm mt-0.5 opacity-80',
    // Action row (Sonner-style). Intent-neutral, prominent primary + quiet
    // cancel — the toast's intent already reads through the icon/progress, so
    // the buttons stay contrast-based rather than intent-coloured.
    actions: 'flex items-center gap-2 mt-2.5',
    // tier: modify — small interactive sub-elements on a contain surface.
    actionButton: [
      'rounded-modify px-2.5 py-1 text-xs font-medium',
      'bg-text-primary/10 hover:bg-text-primary/20 text-text-primary',
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40'
    ],
    cancelButton: [
      'rounded-modify px-2.5 py-1 text-xs font-medium',
      'text-text-secondary hover:text-text-primary',
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40'
    ],
    // tier: modify — small interactive sub-element on a contain surface.
    dismissButton: [
      'shrink-0 rounded-modify p-1',
      'opacity-60 hover:opacity-100 transition-opacity',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50'
    ],
    progress: 'absolute bottom-0 left-0 h-0.5 rounded-b-contain transition-all ease-linear'
  },
  variants: {
    intent: {
      primary: {
        toast: 'bg-surface-overlay text-text-primary',
        icon: 'text-primary-text',
        progress: 'bg-primary'
      },
      info: {
        toast: 'bg-surface-overlay text-text-primary',
        icon: 'text-info-text',
        progress: 'bg-info'
      },
      success: {
        toast: 'bg-surface-overlay text-text-primary',
        icon: 'text-success-text',
        progress: 'bg-success'
      },
      warning: {
        toast: 'bg-surface-overlay text-text-primary',
        // Was `-emphasis` while the base warning token missed AA on the overlay
        // surface; the `-text` role clears every reading surface, so warning
        // needs no special casing here anymore (same change in Dialog).
        icon: 'text-warning-text',
        progress: 'bg-warning'
      },
      danger: {
        toast: 'bg-surface-overlay text-text-primary',
        icon: 'text-danger-text',
        progress: 'bg-danger'
      },
      neutral: {
        toast: 'bg-surface-overlay text-text-primary',
        icon: 'text-text-secondary',
        progress: 'bg-text-tertiary'
      }
    },
    placement: {
      'top-right': { container: 'top-4 right-4 items-end gap-2' },
      'top-left': { container: 'top-4 left-4 items-start gap-2' },
      'top-center': { container: 'top-4 left-1/2 -translate-x-1/2 items-center gap-2' },
      'bottom-right': { container: 'bottom-4 right-4 items-end gap-2' },
      'bottom-left': { container: 'bottom-4 left-4 items-start gap-2' },
      'bottom-center': { container: 'bottom-4 left-1/2 -translate-x-1/2 items-center gap-2' }
    }
  },
  defaultVariants: {
    intent: 'neutral',
    placement: 'bottom-right'
  }
});

export type ToastVariants = VariantProps<typeof toastVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ToasterSlots = SlotNames<typeof toastVariants>;

export type ToastPlacement =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center';

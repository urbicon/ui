import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const codeExampleVariants = tv({
  slots: {
    container: ['border-y border-border-hairline bg-surface-quiet'],
    title: ['text-text-primary px-4 pt-3 text-base font-medium'],
    description: ['text-text-secondary px-4 pb-2 text-sm leading-relaxed'],
    preview: ['border-border-hairline bg-surface-base border-b'],
    /**
     * A centring flex row, which makes every direct child **shrink-to-fit**.
     * That is what centres a lone `<Button>` — and it is a trap for any demo
     * that wraps several elements in a plain `<div>`: a `width: 100%` component
     * inside (every `<Table>`, `<Input>`, …) contributes *nothing* to the
     * wrapper's max-content, so the wrapper collapses to whatever else it holds.
     * Measured on 2026-08-07: three table demos at 68px, 221px and 262px of the
     * 624px they had, on desktop as well as on a phone.
     *
     * **A wrapper around a full-width component must carry `w-full` itself.**
     * A component handed to the preview directly needs nothing — `<Table>`'s own
     * root already says `w-full`.
     */
    previewContent: ['flex min-h-20 items-center justify-center']
  },
  variants: {
    size: {
      sm: {
        title: 'text-sm',
        preview: 'p-3'
      },
      md: {
        title: 'text-base',
        preview: 'p-6'
      },
      lg: {
        title: 'text-lg',
        preview: 'p-8'
      }
    },
    hasPreview: {
      true: {},
      false: {
        preview: 'hidden'
      }
    }
  },
  defaultVariants: {
    size: 'md',
    hasPreview: true
  }
});

export type CodeExampleVariantProps = VariantProps<typeof codeExampleVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type CodeExampleSlots = SlotNames<typeof codeExampleVariants>;

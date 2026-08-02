import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const codeExampleVariants = tv({
  slots: {
    container: ['border-y border-border-hairline bg-surface-quiet'],
    title: ['text-text-primary px-4 pt-3 text-base font-medium'],
    description: ['text-text-secondary px-4 pb-2 text-sm leading-relaxed'],
    preview: ['border-border-hairline bg-surface-base border-b'],
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

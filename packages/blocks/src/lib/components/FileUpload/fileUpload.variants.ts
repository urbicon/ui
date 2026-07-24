import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const fileUploadVariants = tv({
  slots: {
    root: ['flex flex-col gap-3 w-full'],

    // tier: contain — drop zone is an in-page container surface.
    dropzone: [
      'group relative flex flex-col items-center justify-center gap-2',
      'rounded-contain border-2 border-dashed',
      'border-border-default bg-surface-base',
      'cursor-pointer select-none',
      // `scale`, NOT `transform`: Tailwind 4 emits `scale-*` as the discrete
      // `scale:` property — the `dragging` compounds below lift the zone with
      // `scale-[1.01]`, which a `transform` entry never animated.
      'transition-[color,background-color,border-color,box-shadow,scale]',
      'duration-[var(--blocks-duration-fast)]',
      'ease-[var(--blocks-ease-gentle)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2'
    ],

    dropzoneIcon: [
      'text-text-quaternary',
      // `scale`, NOT `transform` — the `dragging` compounds pop the icon with
      // `scale-110` (discrete `scale:` property in Tailwind 4).
      'transition-[color,scale] duration-[var(--blocks-duration-fast)]'
    ],

    dropzoneTitle: ['font-medium text-text-primary'],

    dropzoneDescription: ['text-text-tertiary text-center max-w-xs'],

    fileList: ['flex flex-col gap-2'],

    // tier: contain — file rows are small card surfaces.
    fileItem: [
      'group relative flex items-center gap-3',
      'rounded-contain border border-border-hairline bg-surface-quiet',
      // No transform entry: nothing on this slot sets a scale/translate/rotate
      // utility, and Tailwind 4 would emit those as discrete properties anyway —
      // `transform` was dead weight.
      'transition-[background-color,border-color,box-shadow,opacity]',
      'duration-[var(--blocks-duration-fast)]',
      'hover:border-border-default hover:shadow-[var(--blocks-shadow-sm)]'
    ],

    // tier: modify — preview thumbnail is an embedded modify surface.
    fileItemPreview: [
      'flex-shrink-0 overflow-hidden rounded-modify',
      'bg-surface-base',
      'flex items-center justify-center',
      'text-text-quaternary'
    ],

    fileItemInfo: ['flex min-w-0 flex-1 flex-col gap-0.5'],

    fileItemName: ['truncate text-text-primary font-medium'],

    fileItemSize: ['text-text-tertiary'],

    fileItemProgress: ['w-full'],

    // tier: modify — small destructive sub-button.
    fileItemRemoveButton: [
      'flex items-center justify-center rounded-modify',
      'text-text-quaternary hover:text-danger hover:bg-danger/10',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1'
    ],

    fileItemError: ['text-danger'],

    fileItemStatusIcon: [
      'flex-shrink-0',
      // Colour only: the icon is swapped per status, never scaled/rotated, so a
      // `transform` entry animated nothing (Tailwind 4 emits transforms as the
      // discrete scale/translate/rotate properties).
      'transition-[color] duration-[var(--blocks-duration-fast)]'
    ]
  },

  variants: {
    size: {
      sm: {
        dropzone: 'px-4 py-6',
        dropzoneTitle: 'text-sm',
        dropzoneDescription: 'text-xs',
        fileItem: 'p-2',
        fileItemPreview: 'size-8',
        fileItemName: 'text-sm',
        fileItemSize: 'text-xs',
        fileItemError: 'text-xs',
        fileItemRemoveButton: 'size-6'
      },
      md: {
        dropzone: 'px-6 py-10',
        dropzoneTitle: 'text-base',
        dropzoneDescription: 'text-sm',
        fileItem: 'p-3',
        fileItemPreview: 'size-10',
        fileItemName: 'text-sm',
        fileItemSize: 'text-xs',
        fileItemError: 'text-xs',
        fileItemRemoveButton: 'size-7'
      },
      lg: {
        dropzone: 'px-8 py-14',
        dropzoneTitle: 'text-lg',
        dropzoneDescription: 'text-sm',
        fileItem: 'p-4',
        fileItemPreview: 'size-12',
        fileItemName: 'text-base',
        fileItemSize: 'text-sm',
        fileItemError: 'text-sm',
        fileItemRemoveButton: 'size-8'
      }
    },

    intent: {
      primary: {
        dropzone: 'hover:border-primary hover:bg-primary/5'
      },
      neutral: {
        dropzone: 'hover:border-border-emphasis hover:bg-surface-hover'
      }
    },

    dragging: {
      true: {},
      false: {}
    },

    invalid: {
      true: {
        dropzone: 'border-danger bg-danger/5',
        dropzoneIcon: 'text-danger'
      },
      false: {}
    },

    disabled: {
      true: {
        root: 'opacity-50 pointer-events-none',
        dropzone: 'cursor-not-allowed hover:border-border-default hover:bg-surface-base'
      },
      false: {}
    }
  },

  compoundVariants: [
    {
      intent: 'primary' as const,
      dragging: false,
      invalid: false,
      class: {
        dropzoneIcon: 'group-hover:text-primary'
      }
    },
    {
      intent: 'neutral' as const,
      dragging: false,
      invalid: false,
      class: {
        dropzoneIcon: 'group-hover:text-text-secondary'
      }
    },
    {
      intent: 'primary' as const,
      dragging: true,
      invalid: false,
      class: {
        dropzone: ['border-primary bg-primary/8 scale-[1.01]', 'shadow-[var(--blocks-shadow-md)]'],
        dropzoneIcon: 'text-primary scale-110'
      }
    },
    {
      intent: 'neutral' as const,
      dragging: true,
      invalid: false,
      class: {
        dropzone: [
          'border-border-emphasis bg-surface-hover scale-[1.01]',
          'shadow-[var(--blocks-shadow-md)]'
        ],
        dropzoneIcon: 'text-text-primary scale-110'
      }
    }
  ],

  defaultVariants: {
    size: 'md',
    intent: 'neutral',
    dragging: false,
    invalid: false,
    disabled: false
  }
});

export type FileUploadVariants = VariantProps<typeof fileUploadVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type FileUploadSlots = SlotNames<typeof fileUploadVariants>;

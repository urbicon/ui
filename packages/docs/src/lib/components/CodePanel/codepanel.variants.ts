import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const codePanelVariants = tv({
  slots: {
    root: [],
    toolbar: ['flex items-center gap-2 px-4 py-2'],
    codeToggle: [
      'font-meta text-text-tertiary flex items-center gap-2 text-xs uppercase tracking-wider',
      'transition-[color] duration-(--blocks-duration-fast)',
      'hover:text-text-primary'
    ],
    codeChevron: ['size-3.5 transition-transform duration-(--blocks-duration-fast)'],
    // Base utilities are the fallback for hosts without the rooms scope;
    // `meta-marker` (defined only under `.docs-rooms` in rooms-docs.css,
    // unlayered, so it wins over the utility layer) restyles the tag as a
    // mono kicker there — same pairing as TableOfContents' title slot.
    languageTag: ['meta-marker text-xs font-medium uppercase tracking-wider text-text-tertiary'],
    copyButton: [
      'font-meta text-text-quaternary inline-flex shrink-0 items-center gap-1 text-xs uppercase tracking-wider',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2'
    ],
    copySeparator: ['text-text-quaternary text-xs'],
    codeCollapse: [
      'grid transition-[grid-template-rows] duration-(--blocks-duration-normal)',
      'ease-(--blocks-ease-confident)'
    ],
    codeDisplay: ['overflow-x-auto'],
    codeContent: [
      'focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-primary/40 focus-visible:ring-inset'
    ]
    // `loadingContainer` / `loadingText` lived here for the spinner shown while
    // the async highlighter resolved. Highlighting is synchronous now (#10), so
    // there is no loading state left to style — and no `disabled` on the copy
    // button either, which is why its `disabled:` pair went with them.
  },
  variants: {
    size: {
      sm: {
        toolbar: 'px-3 py-1.5',
        codeToggle: 'text-2xs',
        copyButton: 'text-2xs',
        codeChevron: 'size-3'
      },
      md: {},
      lg: {
        toolbar: 'px-5 py-2.5'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type CodePanelVariantProps = VariantProps<typeof codePanelVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type CodePanelSlots = SlotNames<typeof codePanelVariants>;

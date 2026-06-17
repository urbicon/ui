import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const docsLayoutVariants = tv({
  slots: {
    container: ['min-h-screen bg-surface-base'],
    wrapper: ['flex w-full max-w-screen-2xl mx-auto'],
    main: ['flex-1 px-6 pt-0 pb-12'],
    content: ['flex flex-col'],

    header: ['mb-8 flex flex-col gap-3'],
    title: ['text-3xl font-extrabold tracking-tight text-text-primary'],
    subtitle: ['max-w-2xl text-lg leading-relaxed text-text-secondary'],

    stickyBar: ['sticky top-14 lg:top-0 z-(--z-sticky)', '-mx-6 bg-surface-base'],
    stickyBarInner: ['relative mx-6'],

    pageToolbar: [
      'flex items-center gap-2',
      'sticky top-14 lg:top-0 z-(--z-sticky)',
      'bg-surface-base py-3 mb-3',
      'lg:justify-end'
    ],
    mobileToc: ['flex-1 lg:hidden'],
    mobileTocButton: [
      'flex w-full items-center justify-between rounded-contain',
      'border border-border-subtle px-4 py-2.5',
      'text-sm text-text-secondary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:border-border-default'
    ],
    mobileTocNav: ['mt-2 flex flex-col rounded-contain border border-border-subtle py-2'],
    mobileTocLink: [
      'px-4 py-1.5 text-sm text-text-tertiary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-primary'
    ]
  },
  variants: {
    maxWidth: {
      sm: { main: 'max-w-2xl mx-auto' },
      md: { main: 'max-w-3xl mx-auto' },
      lg: { main: 'max-w-4xl mx-auto' },
      xl: { main: 'max-w-5xl mx-auto' },
      '2xl': { main: 'max-w-6xl mx-auto' },
      '7xl': { main: 'max-w-7xl mx-auto' }
    },
    sidebar: {
      true: {
        wrapper: 'gap-8',
        main: 'min-w-0'
      }
    },
    centered: {
      true: {
        header: 'text-center',
        content: 'items-center'
      }
    }
  },
  defaultVariants: {
    maxWidth: 'lg',
    sidebar: false,
    centered: false
  }
});

export type DocsLayoutVariantProps = VariantProps<typeof docsLayoutVariants>;

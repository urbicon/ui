import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const docsLayoutVariants = tv({
  slots: {
    container: ['min-h-screen bg-surface-base'],
    // `pt-8` lives on the wrapper (not `main`) so BOTH columns — the body and
    // the TOC aside — start at the same top edge below the header band; the
    // TOC kicker lines up with the playground stage instead of hanging higher.
    wrapper: ['flex w-full max-w-screen-2xl mx-auto pt-8'],
    main: ['flex-1 px-6 pb-12'],
    content: ['flex flex-col'],

    // The header is a full-width band (direct child of `container`, spanning
    // everything right of the app sidebar). Its background paints edge-to-edge;
    // the `headerInner` re-imposes the content column so the title lines up
    // with the body below. The `maxWidth`/`sidebar` variants keep `headerInner`
    // + `stickyBarInner` in lockstep with `main`'s column width.
    header: ['bg-surface-base'],
    headerInner: ['mx-auto flex flex-col gap-3 px-6 pt-5 pb-9'],
    title: ['text-3xl font-extrabold tracking-tight text-text-primary'],
    subtitle: ['max-w-2xl text-lg leading-relaxed text-text-secondary'],

    // Sticky breadcrumb strip — full-width band pinned to the top. Because it
    // is a direct child of the tall `container`, it stays pinned for the whole
    // page scroll (its containing block is the full page, not a short header
    // box). `stickyBarInner` aligns the crumb + source with the content column.
    stickyBar: ['sticky top-14 lg:top-0 z-(--z-sticky) bg-surface-base'],
    stickyBarInner: ['mx-auto px-6'],

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
    // `main` caps + centres the body column; `headerInner`/`stickyBarInner`
    // mirror the same cap so the full-width band's inner content lines up with
    // it. For sidebar pages the `sidebar` compound below widens both to
    // `max-w-screen-2xl` and lets `main` fill its column (left-aligned), so the
    // title sits directly above the content.
    maxWidth: {
      sm: { main: 'max-w-2xl mx-auto', headerInner: 'max-w-2xl', stickyBarInner: 'max-w-2xl' },
      md: { main: 'max-w-3xl mx-auto', headerInner: 'max-w-3xl', stickyBarInner: 'max-w-3xl' },
      lg: { main: 'max-w-4xl mx-auto', headerInner: 'max-w-4xl', stickyBarInner: 'max-w-4xl' },
      xl: { main: 'max-w-5xl mx-auto', headerInner: 'max-w-5xl', stickyBarInner: 'max-w-5xl' },
      '2xl': { main: 'max-w-6xl mx-auto', headerInner: 'max-w-6xl', stickyBarInner: 'max-w-6xl' },
      '7xl': { main: 'max-w-7xl mx-auto', headerInner: 'max-w-7xl', stickyBarInner: 'max-w-7xl' }
    },
    // Applied AFTER `maxWidth` (object-key order), so `max-w-screen-2xl` /
    // `max-w-none` win the `max-w` conflict bucket in tv() and override the cap
    // for two-column pages: the body fills its column and the band spans the
    // full inner width above main + toc.
    sidebar: {
      true: {
        wrapper: 'gap-8',
        main: 'min-w-0 max-w-none',
        headerInner: 'max-w-screen-2xl',
        stickyBarInner: 'max-w-screen-2xl'
      }
    },
    centered: {
      true: {
        headerInner: 'text-center',
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

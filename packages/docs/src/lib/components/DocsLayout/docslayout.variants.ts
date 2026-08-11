import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const docsLayoutVariants = tv({
  slots: {
    // The two-column shell's measurements, declared once here so `wrapper`,
    // `main`, `headerInner` and `stickyBarInner` cannot drift apart — they are
    // four elements that have to share one left edge and one outer cap, and
    // four hand-kept numbers is how they stopped sharing it.
    //
    //   --docs-gutter    the bundsteg: sidebar → text on the left, TOC → viewport
    //                    on the right. 1.5rem below lg (no TOC there), 2.5rem on
    //                    lg+; the old 0.5rem/px-6 left the body hugging the nav.
    //   --docs-column    the exhibit edge — `main`'s content box. Tables, code
    //                    panels and stages fill it; prose is capped narrower by
    //                    the app's reading measure (see rooms-docs.css).
    //   --docs-rail-gap  main → TOC. This is the WHOLE corridor: the gutters
    //                    live on `wrapper`, so `main` has no inner padding of
    //                    its own to add to it. At 1.5rem a full-width table sat
    //                    24px off the TOC.
    //   --docs-toc-w     mirrors TableOfContents' `width="md"` (w-52). A page
    //                    that sets `sm`/`lg` only shifts where `main` gives up
    //                    width; nothing misaligns.
    //   --docs-anchor-offset  how far below the viewport top an anchor jump has
    //                    to land: exactly the pinned chrome above it —
    //                    SidebarLayout's mobile header plus this layout's own
    //                    breadcrumb strip — and nothing else. Every jump target
    //                    reads it (`Section`'s `scroll-mt`), so a page never
    //                    carries an offset of its own; the five hand-guessed
    //                    copies of the strip height it replaces all disagreed
    //                    with each other and with the strip.
    //
    //                    No breathing room is added here. `Section` already puts
    //                    `mt-8` above its heading, so a landing that stops flush
    //                    under the strip reads as a full line of air; adding a
    //                    second helping only opens a gap for the PREVIOUS
    //                    section's last line to show through, which is how it
    //                    looked when this carried +1.5rem.
    container: [
      'min-h-screen bg-surface-base',
      '[--docs-gutter:1.5rem] lg:[--docs-gutter:2.5rem]',
      '[--docs-column:60rem] [--docs-rail-gap:4rem] [--docs-toc-w:13rem]',
      '[--docs-shell:calc(var(--docs-column)+var(--docs-rail-gap)+var(--docs-toc-w)+2*var(--docs-gutter))]',
      '[--docs-anchor-offset:calc(var(--sidebar-layout-header-h,0rem)+var(--docs-sticky-bar-h,0rem))]'
    ],
    // The strip's height, declared rather than emergent — `stickyBar` sets it as
    // a real `h-`, so the number here IS the rendered height and cannot drift
    // from what the anchor offset and the TOC rail assume. DocsLayout applies it
    // to `container` under the same `showStickyBar` that renders the strip;
    // without it the `var()` fallback above leaves the offset at the mobile
    // header alone. It declares a DIFFERENT property than the offset above, so
    // both sit on the same element without a conflict bucket between them and
    // stylesheet order cannot pick a winner.
    stickyBarHeight: ['[--docs-sticky-bar-h:2.5rem]'],
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
    // The offset reads SidebarLayout's published pinned-chrome height (mobile
    // header below lg, 0 on lg+) instead of hardcoding a copy of it; the
    // fallback covers DocsLayout used outside a SidebarLayout.
    stickyBar: ['sticky top-[var(--sidebar-layout-header-h,0rem)] z-(--z-sticky) bg-surface-base'],
    stickyBarInner: ['mx-auto px-6'],

    // The sticky bar's table of contents. `lg:hidden` is the exact complement
    // of TableOfContents' `max-lg:hidden` rail — one named breakpoint, two
    // halves, so there is no width with both controls or neither.
    stickyToc: ['ml-2 flex min-w-0 items-center lg:hidden'],
    stickyTocButton: [
      'flex items-center gap-1.5 rounded-modify px-2 py-0.5',
      'text-primary-text bg-primary-subtle hover:bg-primary-subtle/80',
      'text-xs font-medium whitespace-nowrap',
      'transition-colors duration-(--blocks-duration-fast)',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
    ],
    stickyTocNav: ['flex max-h-[60vh] min-w-56 flex-col overflow-y-auto py-1'],
    stickyTocLink: [
      'px-3 py-1.5 text-sm text-text-tertiary',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-text-primary hover:bg-surface-hover',
      'aria-[current]:text-primary-text aria-[current]:font-medium',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-modify'
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
    // Applied AFTER `maxWidth` (object-key order), so these win the `max-w` and
    // `px` conflict buckets in tv() and override the single-column caps.
    //
    // `main` is capped at the exhibit column and the gutters move to `wrapper`,
    // so ONE element owns the horizontal padding for both columns. Before this,
    // `main` was `flex-1 max-w-none` and swallowed every pixel the TOC did not
    // take, while the app capped each `section` at the reading measure — the
    // difference showed up as a corridor of nothing between text and TOC
    // (measured: 208px at 1440, 568px at 1920) with the tables scrolling inside
    // 736px right next to it.
    //
    // What actually binds `main` is the SHELL cap, not the one written here:
    // `--docs-shell` is defined as the column plus the rail, the gap and both
    // gutters, so a flex child beside the rail lands on the column width whether
    // or not it caps itself. Measured — swapping this back to `max-w-none` moves
    // nothing at any width. It stays because a cap named after the thing it
    // produces survives someone retuning `--docs-shell` for a reason that has
    // nothing to do with the body column; without it that retune would silently
    // widen the prose column instead of the margins.
    //
    // `headerInner`/`stickyBarInner` take the SAME cap and the SAME gutter as
    // `wrapper`: all three centre their border box in the same parent, so the
    // h1, the breadcrumb and the first paragraph land on one left edge. Change
    // one of the three and you have to change all three.
    sidebar: {
      true: {
        wrapper: 'max-w-(--docs-shell) gap-(--docs-rail-gap) px-(--docs-gutter)',
        main: 'min-w-0 max-w-(--docs-column) px-0',
        headerInner: 'max-w-(--docs-shell) px-(--docs-gutter)',
        stickyBarInner: 'max-w-(--docs-shell) px-(--docs-gutter)'
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
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type DocsLayoutSlots = SlotNames<typeof docsLayoutVariants>;

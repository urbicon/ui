import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const sidebarLayoutVariants = tv({
  slots: {
    // `--sidebar-layout-header-h` is the published "pinned chrome above the
    // content" height: the mobile-header height below lg, 0 on lg+ (where the
    // header hides). Descendants with their own sticky elements (e.g.
    // DocsLayout's breadcrumb strip) offset against it instead of hardcoding
    // a copy of the h-14 — the responsive truth lives here, next to the
    // element that causes it.
    root: [
      'min-h-screen',
      'bg-surface-base',
      '[--sidebar-layout-header-h:3.5rem] lg:[--sidebar-layout-header-h:0rem]'
    ],
    mobileHeader: [
      'sticky top-0 z-[var(--z-sticky)]',
      'flex h-(--sidebar-layout-header-h) items-center gap-3',
      'border-border-hairline bg-surface-base/80 border-b backdrop-blur-md',
      'px-4',
      'lg:hidden'
    ],
    // The desktop seam of the `toggle` snippet: a box parked on the sidebar's
    // outer edge, riding the same `--sidebar-effective-width` the panel
    // animates, so grip and rail move as one. `hidden lg:block` is the mirror
    // of `mobileHeader`'s `lg:hidden` — the two render sites of the one snippet
    // are never visible at the same time, which is what keeps their two trigger
    // ids from colliding on one screen.
    //
    // It is `fixed`, so it paints over whatever the content column puts in that
    // strip. `--sidebar-toggle-gutter` below is what stops it from doing so.
    toggleRail: [
      'fixed top-4 z-[var(--z-sidebar)]',
      'hidden lg:block',
      'transition-[left,right] duration-(--blocks-duration-normal) ease-(--blocks-ease-confident)'
    ],
    main: [
      'min-h-screen',
      'pb-[env(safe-area-inset-bottom)]',
      'transition-[padding] duration-(--blocks-duration-normal) ease-(--blocks-ease-confident)'
    ],
    inner: ['mx-auto w-full']
  },
  variants: {
    // `--sidebar-toggle-gutter` is the strip the `toggle` snippet's desktop
    // grip is parked in; the component sets it only while that grip renders and
    // it falls back to 0px, so a layout without the snippet keeps the padding
    // it always had. Measured at 1200px with the shipped example: without the
    // reservation a collapsed rail put a 40px grip at x 8–48 while the content
    // column began at x 32, and the first heading rendered under the button.
    side: {
      left: {
        main: 'lg:pl-[calc(var(--sidebar-effective-width)+var(--sidebar-toggle-gutter,0px))]',
        toggleRail: 'left-[var(--sidebar-effective-width)] pl-2'
      },
      right: {
        main: 'lg:pr-[calc(var(--sidebar-effective-width)+var(--sidebar-toggle-gutter,0px))]',
        toggleRail: 'right-[var(--sidebar-effective-width)] pr-2'
      }
    },
    contentMaxWidth: {
      none: { inner: 'max-w-none' },
      sm: { inner: 'max-w-3xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10' },
      md: { inner: 'max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10' },
      lg: { inner: 'max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10' },
      xl: { inner: 'max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10' },
      '2xl': { inner: 'max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10' }
    }
  },
  defaultVariants: {
    side: 'left',
    contentMaxWidth: 'xl'
  }
});

export type SidebarLayoutVariants = VariantProps<typeof sidebarLayoutVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SidebarLayoutSlots = SlotNames<typeof sidebarLayoutVariants>;

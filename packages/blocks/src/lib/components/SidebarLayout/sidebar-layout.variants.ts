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
    main: [
      'min-h-screen',
      'pb-[env(safe-area-inset-bottom)]',
      'transition-[padding] duration-(--blocks-duration-normal) ease-(--blocks-ease-confident)'
    ],
    inner: ['mx-auto w-full']
  },
  variants: {
    side: {
      left: { main: 'lg:pl-[var(--sidebar-effective-width)]' },
      right: { main: 'lg:pr-[var(--sidebar-effective-width)]' }
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

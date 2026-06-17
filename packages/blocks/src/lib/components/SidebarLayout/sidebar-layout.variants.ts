import { tv, type VariantProps } from '$lib/utils/variants';

export const sidebarLayoutVariants = tv({
  slots: {
    root: ['min-h-screen', 'bg-surface-base'],
    mobileHeader: [
      'sticky top-0 z-[var(--z-sticky)]',
      'flex h-14 items-center gap-3',
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

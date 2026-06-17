import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const sectionVariants = tv({
  slots: {
    root: ['relative'],
    header: ['flex flex-col'],
    headerRow: ['flex items-center gap-4 flex-wrap mb-4'],
    marker: ['inline-block font-mono text-text-tertiary mr-2 select-none'],
    title: ['font-bold text-text-primary'],
    // Mono meta counter in the header row (e.g. "20 props"); casing stays
    // as passed — `font-meta` sets mono + size, not caps. `ml-auto` pushes
    // the counter to the right of the title; if badges are also set, they
    // sit directly after it (gap-4 from headerRow).
    meta: ['font-meta text-text-tertiary ml-auto'],
    badges: ['flex gap-2 flex-wrap'],
    subtitle: ['leading-relaxed text-text-secondary mb-8'],
    body: ['relative'],
    footer: ['mt-8']
  },
  variants: {
    size: {
      sm: { header: 'mt-4', title: 'text-base font-semibold', subtitle: 'text-sm' },
      md: { header: 'mt-6', title: 'text-lg font-semibold', subtitle: 'text-sm' },
      lg: { header: 'mt-8', title: 'text-xl font-semibold', subtitle: 'text-base' },
      xl: {
        header: 'mt-10',
        title: 'text-2xl font-bold tracking-tight',
        subtitle: 'text-lg max-w-3xl mx-auto'
      }
    },
    intent: {
      hero: {
        header: 'mt-20 text-center',
        headerRow: 'justify-center mb-6',
        title: 'text-3xl font-extrabold tracking-tight text-primary',
        subtitle: 'text-lg text-text-secondary max-w-3xl mx-auto'
      },
      primary: {
        header: 'mt-10',
        title: 'text-2xl font-bold text-text-primary',
        subtitle: 'text-base text-text-secondary'
      },
      secondary: {
        header: 'mt-8',
        title: 'text-xl font-semibold text-text-primary',
        subtitle: 'text-sm text-text-secondary'
      },
      default: {
        header: 'mt-4',
        title: 'text-lg font-medium text-text-primary',
        subtitle: 'text-sm text-text-secondary'
      }
    },
    centered: {
      true: {
        header: 'text-center',
        headerRow: 'justify-center',
        subtitle: 'mx-auto'
      },
      false: {
        header: 'text-left',
        headerRow: 'justify-start'
      }
    }
  },
  defaultVariants: {
    size: 'lg',
    intent: 'default',
    centered: false
  }
});

export type SectionVariantProps = VariantProps<typeof sectionVariants>;

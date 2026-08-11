import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const sectionVariants = tv({
  slots: {
    // Every in-page anchor on a docs page targets a `<Section id>`, so the
    // offset that clears the pinned chrome belongs here — once — rather than on
    // each page next to each id. `--docs-anchor-offset` is published by
    // DocsLayout (mobile header + breadcrumb strip + breathing room); the 0rem
    // fallback covers a `<Section>` used outside one, where nothing is pinned.
    root: ['relative scroll-mt-[var(--docs-anchor-offset,0rem)]'],
    header: ['flex flex-col'],
    headerRow: ['flex items-center gap-4 flex-wrap mb-4'],
    marker: ['inline-block font-mono text-text-tertiary mr-2 select-none'],
    title: ['font-bold text-text-primary'],
    // Mono meta counter in the header row (e.g. "20 props"); casing stays
    // as passed — no caps. `ml-auto` pushes the counter to the right of the
    // title; if badges are also set, they sit directly after it (gap-4 from
    // headerRow).
    //
    // `font-meta` is NOT a theme font key: it is `.docs-rooms .font-meta` in
    // the docs app's rooms stylesheet, so it applies only under that opt-in
    // theme. It refines mono + size there; the base utilities have to be here
    // or the counter renders in the body font everywhere else — which it did
    // until 2026-08-02. CodePanel and PrevNextNav already paired it this way.
    meta: ['font-meta font-mono text-xs text-text-tertiary ml-auto'],
    badges: ['flex gap-2 flex-wrap'],
    subtitle: ['leading-relaxed text-text-secondary mb-8'],
    body: ['relative'],
    footer: ['mt-8']
  },
  variants: {
    // Ownership: `size` owns the default header rhythm (mt-4/6/8/10); the
    // named intents may set a LARGER offset of their own (hero/primary),
    // but `default` must not — it would flatten every size to mt-4 under
    // the fold (intent is declared later and would win the bucket).
    size: {
      sm: { header: 'mt-4', title: 'font-semibold', subtitle: 'text-sm' },
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
        title: 'text-3xl font-extrabold tracking-tight text-primary-text',
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
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type SectionSlots = SlotNames<typeof sectionVariants>;

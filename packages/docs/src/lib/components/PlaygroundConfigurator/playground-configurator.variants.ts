import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const playgroundConfiguratorVariants = tv({
  slots: {
    root: ['flex flex-col gap-4'],
    header: ['text-center'],
    title: ['text-text-primary mb-1 font-bold'],
    subtitle: ['text-text-secondary'],
    // Container as top/bottom hairlines only, no enclosing rectangle. The
    // stage sits IN the reading-flow rather than AS a card; surface-quiet
    // gives the subtle tonal lift that previously came from the border.
    container: ['border-y border-border-hairline'],
    preview: ['border-b border-border-hairline'],
    previewContent: ['flex items-center justify-center'],
    controlsPanel: ['pb-8 bg-surface-elevated'],
    // Header row above the controls grid. Width-matched to the grid so a
    // right-aligned affordance (`? Hints`) lines up with the controls'
    // visual right-edge. Height kept compact so it does not crowd the
    // first control row.
    controlsHeader: [
      'flex items-center justify-end gap-2 px-4 pt-4 max-w-[36rem] mx-auto w-full min-h-7'
    ],
    // Vertical stack with the label on the LEFT, centered at 36rem (label
    // 9rem + gap 1rem + control max 26rem). Prevents horizontal reflow on
    // toggle AND caps the stretch width of Input/Select so that not every
    // text field takes up the full panel width. The container can breathe
    // symmetrically on wide viewports.
    controlsGrid: ['flex flex-col gap-y-1 px-4 py-2 max-w-[36rem] mx-auto w-full'],
    // Stacks label-above-control on mobile so the control gets the full column
    // width (the fixed 11rem label column would crush it on a phone, and any
    // wide control would force the page to scroll horizontally); switches to the
    // labelled row at `sm`.
    controlItem: [
      'flex flex-col items-start gap-1',
      'sm:min-h-9 sm:flex-row sm:items-center sm:gap-4'
    ],
    // Label on the LEFT, fixed width, mono caps (font-meta picks up JetBrains
    // Mono in editorial scope). `shrink-0` so the control on the right
    // always starts at the same x-position. `w-44` (11rem) holds the
    // longest current label ("CHEVRON ANIMATION") on a single line with
    // a few pixels of headroom — drop to `items-center` works only if
    // the label never wraps, so we widen rather than re-align.
    controlLabel: [
      'font-meta text-text-tertiary flex items-center gap-1.5 shrink-0',
      // Full-width above the control on mobile; fixed 11rem label column at sm+.
      'tracking-wider uppercase w-full sm:w-44 text-xs'
    ],
    // Wraps stretchy form controls (Input/Select/Textarea/Slider). The
    // wrapper provides the column boundary so the Input's own `w-full`
    // resolves to a sane 26rem max — without the wrapper the field would
    // stretch to the full controlItem width and crowd the surrounding
    // editorial whitespace.
    controlControl: ['w-full min-w-0 max-w-md sm:w-auto sm:flex-1'],
    // Wraps naturally-compact controls (Toggle dot, color picker) so they
    // align to the same virtual x-origin as Select/Input text. Without the
    // pl-3 the Toggle dot sits flush at the controlItem flex-start while
    // sibling Select/Input text sits at +12px — creates the "dot looks
    // too far left" disagreement called out in the v5.2.0 review.
    controlControlCompact: ['pl-3'],
    modifiedDot: [
      'bg-primary h-1.5 w-1.5 shrink-0 rounded-commit',
      'opacity-60 transition-opacity hover:opacity-100'
    ],
    variantBadge: [
      'border-current ml-auto inline-flex items-center justify-center rounded-modify border',
      'font-bold leading-none opacity-25 transition-opacity hover:opacity-60'
    ],
    colorInput: ['border-border-default cursor-pointer rounded-modify border'],
    // Hint line shown under a controlItem when the help-toggle is on.
    // Indented to start at the control column (label is w-44 = 11rem,
    // gap-4 between label and control adds 1rem → 12rem total). Slightly
    // negative top-margin pulls it visually under the control.
    controlHint: ['pl-3 sm:pl-48 pr-4 -mt-0.5 pb-1 text-xs leading-snug text-text-tertiary'],
    // Actions row at the bottom of the controls panel. Holds the
    // reset-all button when any control is modified (the help-toggle
    // lives in the `controlsHeader` slot above the grid). Width-matched
    // to the controlsGrid so the right-edge aligns visually.
    actionsBar: ['flex items-center justify-end gap-3 px-4 pb-2 max-w-[36rem] mx-auto w-full'],
    helpToggle: [
      'inline-flex items-center gap-1.5',
      'h-7 px-2 rounded-modify',
      'font-meta text-[10px] uppercase tracking-wider',
      'text-text-tertiary border border-transparent',
      'transition-colors',
      'hover:text-text-primary hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      '[&>span]:font-bold [&>span]:text-base [&>span]:leading-none'
    ],
    // Applied additionally when helpVisible is true. Surfaces the
    // "hints on" state visually so the eye can find the toggle quickly.
    helpToggleActive: ['text-primary border-primary/30 bg-primary/10 hover:bg-primary/15'],
    codePanel: ['border-t border-border-hairline']
  },
  variants: {
    size: {
      sm: {
        title: 'text-lg',
        subtitle: 'text-xs',
        preview: 'p-4',
        previewContent: 'min-h-16',
        controlLabel: 'text-[10px]',
        variantBadge: 'h-3 w-3 text-[7px]',
        colorInput: 'h-7 w-12'
      },
      md: {
        title: 'text-xl',
        subtitle: 'text-sm',
        preview: 'p-8',
        previewContent: 'min-h-20',
        controlLabel: 'text-[11px]',
        variantBadge: 'h-3.5 w-3.5 text-[8px]',
        colorInput: 'h-8 w-14'
      },
      lg: {
        title: 'text-2xl',
        subtitle: 'text-base',
        preview: 'p-12',
        previewContent: 'min-h-28',
        controlLabel: 'text-xs',
        variantBadge: 'h-4 w-4 text-[9px]',
        colorInput: 'h-9 w-16'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type PlaygroundConfiguratorVariantProps = VariantProps<
  typeof playgroundConfiguratorVariants
>;

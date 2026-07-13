/**
 * Fixture: a tv() config with a `slots:` block (Card-style). The slot keys are
 * the authoritative `slotClasses` names — the public `CardSlots` type is a
 * `SlotNames<typeof cardVariants>` alias that no prop-type regex can resolve,
 * so VariantsExtractor.extractSlotNames must lift them from here, in source
 * order (base, header, content, footer).
 */
declare const tv: (config: unknown) => Record<string, unknown>;

export const cardVariants = tv({
  slots: {
    base: ['relative block w-full'],
    header: ['flex items-center justify-between'],
    content: ['flex-1'],
    footer: ['flex items-center justify-between']
  },
  variants: {
    variant: {
      quiet: { base: ['bg-surface-quiet'] },
      outlined: { base: ['border border-border-default'] }
    }
  },
  defaultVariants: { variant: 'quiet' }
});

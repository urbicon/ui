/**
 * Fixture: an acronym-led component (the QRCode shape). The export and the file
 * lowercase the whole acronym — `qrTagVariants` in `qr-tag.variants.ts` — where
 * lowering the first letter alone would look for `qRTagVariants`.
 */
declare const tv: (config: unknown) => Record<string, unknown>;

export const qrTagVariants = tv({
  slots: {
    root: ['inline-flex'],
    code: ['block']
  },
  variants: {
    frame: {
      none: {},
      card: { root: ['rounded border'] }
    }
  },
  defaultVariants: { frame: 'none' }
});

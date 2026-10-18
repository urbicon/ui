/**
 * Fixture: an acronym with a digit inside it (the A2UIView shape) —
 * `x2yPanelVariants` in `x2y-panel.variants.ts`.
 */
declare const tv: (config: unknown) => Record<string, unknown>;

export const x2yPanelVariants = tv({
  slots: {
    root: ['flex flex-col'],
    surface: ['flex']
  }
});

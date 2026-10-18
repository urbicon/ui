declare const tv: (config: unknown) => Record<string, unknown>;

export const suiteVariants = tv({ slots: { root: ['flex'] } });

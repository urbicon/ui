declare const tv: (config: unknown) => Record<string, unknown>;

export const betaVariants = tv({ slots: { root: ['block'] } });

// `$app/env` alias target for the **ssr** vitest project — the
// server half of the trio, `browser: false`, exactly what the real module
// resolves to during SSR and prerendering. See vitest.config.ts.
//
// One module instance: the production modules resolve `$app/env`
// through the same alias, so `__setBuilding(true)` reaches them (measured —
// same finding that falsified the old "untestable" NOTE in
// app-env.ts).
export let building = false;

/** @internal test-only — flips the prerender flag for the building tests. */
export function __setBuilding(value: boolean): void {
  building = value;
}

export const browser = false;
export const dev = true;
export const version = 'test';

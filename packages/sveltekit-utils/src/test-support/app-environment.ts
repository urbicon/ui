// `$app/environment` alias target for the **client** vitest project — see
// vitest.config.ts; the server half lives in app-environment.server.ts.
//
// One module instance: the production modules resolve `$app/environment`
// through this same alias, so `__setBuilding(true)` reaches them. (An older
// NOTE here claimed the opposite — a second module instance per alias — and
// declared the `building` guard untestable; a re-measurement falsified that.
// The guard is tested in view-binding.ssr.test.ts, against the server build,
// where prerendering actually runs.)
export let building = false;

/** @internal test-only — flips the prerender flag; the harness resets it. */
export function __setBuilding(value: boolean): void {
  building = value;
}

export const browser = true;
export const dev = true;
export const version = 'test';

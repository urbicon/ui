// `$app/environment` alias target — see vitest.config.ts.
//
// NOTE: flipping `building` from a test does NOT reach the production
// modules — vitest resolves this alias into a second module instance for
// them (measured; the diagnostic read in the test file saw `true` while
// `view-binding.svelte` read `false`). The `building` guard therefore stays
// untested; do not write a test that relies on this flag.
export let building = false;

/** @internal kept for the harness's reset only. */
export function __setBuilding(value: boolean): void {
  building = value;
}

export const browser = true;
export const dev = true;
export const version = 'test';

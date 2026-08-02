/**
 * `sv add @urbicon-ui` — the Svelte CLI community add-on for Urbicon UI.
 *
 * Greenfield and brownfield share one path: `sv create my-app --add @urbicon-ui`
 * or `sv add @urbicon-ui` inside an existing project. sv's machinery does the
 * heavy lifting — directory checks, package-manager choice, running the
 * `tailwindcss` add-on first via `dependsOn` — and this add-on adds only what is
 * Urbicon-specific: the two packages and the stylesheet import.
 *
 * The design-loop onboarding (AGENTS.md block, manifest, edit-time gate)
 * deliberately stays in `urbicon init --hook`: it is idempotent, version-stamped
 * and re-runnable on upgrades, which a one-shot scaffolder cannot be — so the
 * add-on hands over via next steps instead of duplicating it.
 *
 * Status: beta — sv community add-ons are experimental per the Svelte docs; this
 * package tracks the add-on API of its `sv` peer range.
 */

import { readFileSync } from 'node:fs';
import { defineAddon } from 'sv';
import { addBlocksImport } from './stylesheet.js';

/**
 * The library version this add-on installs: its own. Every @urbicon-ui/* package
 * releases in lockstep under one unified version, so `^<own version>` floors the
 * consumer's range at the release this add-on shipped with (the caret then
 * floats within the major, as a scaffolded range should). Read at runtime —
 * package.json sits next to dist/ in the published package — so the bump
 * script's version rewrite needs no build-time inlining.
 */
const VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
    version: string;
  }
).version;

export default defineAddon({
  id: 'urbicon-ui',
  shortDescription: 'Svelte 5 + Tailwind 4 components on a token-based design system',
  homepage: 'https://ui.urbicon.de',
  options: {},

  setup: ({ isKit, unsupported, dependsOn }) => {
    // The library itself is Kit-agnostic: blocks imports neither `$app/*` nor
    // `@sveltejs/kit`, so a plain Vite + Svelte 5 + Tailwind 4 project runs it
    // (verified 2026-08-02: build, SSR render and browser interaction).
    //
    // This ADD-ON stays Kit-only anyway, and not for a technical reason —
    // `file.stylesheet` resolves outside Kit too (sv falls back to
    // `src/app.css`). The gap is who imports that file: in Kit it is the root
    // layout, which sv's own tailwindcss add-on wires up, while a non-Kit
    // project owns its entry (`main.js`) and no add-on touches it. Writing an
    // `@import` into a stylesheet nobody loads fails silently — worse than
    // declining. Beta scope; lifting this needs a non-Kit template test, not
    // just deleting the guard. The manual path is documented instead.
    if (!isKit) unsupported('Requires SvelteKit');
    dependsOn('tailwindcss');
  },

  run: ({ sv, file }) => {
    sv.dependency('@urbicon-ui/blocks', `^${VERSION}`);
    // The urbicon CLI: version-pinned design knowledge + the validate/init loop.
    sv.devDependency('@urbicon-ui/design', `^${VERSION}`);
    // `file.stylesheet` is sv's canonical app stylesheet — `src/app.css`, or
    // `src/routes/layout.css` in newer templates.
    sv.file(file.stylesheet, addBlocksImport);
  },

  nextSteps: ({ packageManager }) => {
    const runx = packageManager === 'bun' ? 'bunx' : 'npx';
    return [
      `Onboard your agent and arm the design gate: ${runx} urbicon init --hook`,
      "Import from the package root: import { Button } from '@urbicon-ui/blocks'",
      'Getting started: https://ui.urbicon.de/getting-started'
    ];
  }
});

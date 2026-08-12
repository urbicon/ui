/**
 * The shipped stylesheets as the docs pages see them: the package exports, i.e.
 * the same three files a consumer's `@import '@urbicon-ui/blocks/style/index.css'`
 * pulls in, in that file's own order.
 *
 * Kept apart from `theme-preview.ts` so the logic there stays a pure module.
 * Vite serves `.css` imports as an EMPTY module outside a browser build — with
 * `?raw` too — so under Vitest this graph is empty, and a test that leaned on
 * it would be asserting against nothing. theme-preview.test.ts therefore reads
 * `packages/blocks/src/lib/style/*` off disk and passes its own graph in;
 * `previewVars` throws rather than silently emit a ramp-only scope if the graph
 * it is handed is empty.
 */

import mintCss from '@urbicon-ui/blocks/mint/styles.css?raw';
import foundationCss from '@urbicon-ui/blocks/style/foundation.css?raw';
import interactionCss from '@urbicon-ui/blocks/style/interaction.css?raw';
import semanticCss from '@urbicon-ui/blocks/style/semantic.css?raw';
import { buildTokenGraph, type TokenGraph } from './css-declarations';

/**
 * All four, in `index.css`'s own order. mint/styles.css is easy to forget and
 * belongs here by the closure's own rule: `--blocks-mint-glow-color` reads
 * `--color-primary`, so an element inside a preview scope that carries the glow
 * without an intent hook would otherwise glow in the surrounding page's accent.
 */
export const LIBRARY_TOKENS: TokenGraph = buildTokenGraph([
  foundationCss,
  semanticCss,
  interactionCss,
  mintCss
]);

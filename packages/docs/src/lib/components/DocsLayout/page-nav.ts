import { createOptionalContext } from '@urbicon-ui/blocks';
import type { Snippet } from 'svelte';

/**
 * Optional "end-of-page" slot for {@link DocsLayout}. A docs site provides a
 * single snippet once (typically in its root layout, via a small provider that
 * owns the site navigation) and every DocsLayout page renders it at the bottom
 * of the article column — used for the prev/next reading-chain nav.
 *
 * DocsLayout stays decoupled from the app's router: it renders whatever snippet
 * is provided, or nothing when a consumer never sets one. This is why the
 * prev/next nav can live in the app (where `$app/state` and the nav data live)
 * while being placed by the published layout, without repeating it per page.
 */
const [getPageNav, setPageNav] = createOptionalContext<Snippet>();

export { getPageNav, setPageNav };

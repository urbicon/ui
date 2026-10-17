/**
 * Tailwind plugin (`@plugin` in app.css): the `link-inline` utility is the
 * class list blocks' Link renders for `variant="inline"`, read from
 * `linkVariants` itself, so the prose-link rule in app.css cannot drift from
 * the library's link. Imported from blocks' `dist` by path, as app.css's
 * `@source` reaches it: the package exports only its components, and the
 * components import `.svelte`, which Tailwind's module loader cannot run.
 */
import plugin from 'tailwindcss/plugin';
import { linkVariants } from '../../../../../packages/blocks/dist/primitives/Link/link.variants.js';

export default plugin(({ addUtilities }) => {
  addUtilities({
    '.link-inline': {
      [`@apply ${linkVariants({ variant: 'inline', active: false }).base()}`]: {}
    }
  });
});

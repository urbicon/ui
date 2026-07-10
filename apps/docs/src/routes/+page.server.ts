// Build-time facts for the landing page. The route is prerendered (global
// `prerender = true`), so this load runs once at build and only the counts are
// serialized — neither the component catalogs nor the icon metadata reach the
// client bundle.
//
// Sources are the same artifacts the MCP catalog and the /icons page are built
// from, so the poster's numbers can never drift from the shipped set. Like
// `api.ts` on every doc page, `_catalog.json` is a docs-gen build artifact —
// run `bun run docs:gen:all` in a fresh worktree before building.
import { ICON_METADATA } from '@urbicon-ui/blocks';
import authCatalog from '../../static/auth/_catalog.json';
import blocksCatalog from '../../static/blocks/_catalog.json';
import tableCatalog from '../../static/table/_catalog.json';

export function load() {
  const blocks = blocksCatalog as Array<{ group: string }>;
  const primitives = blocks.filter((e) => e.group === 'primitives').length;
  const composed = blocks.filter((e) => e.group === 'components').length;
  return {
    counts: {
      /** Blocks package only — the "Blocks" room. */
      primitives,
      composed,
      blocks: primitives + composed,
      /** The whole set (blocks + table + auth) — what llms.txt indexes. */
      set: primitives + composed + tableCatalog.length + authCatalog.length,
      icons: Object.keys(ICON_METADATA).length
    }
  };
}

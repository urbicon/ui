/**
 * The publish order, in one place.
 *
 * Topological: a package is published only after everything it depends on, so a
 * consumer installing mid-publish never sees a range pointing at a
 * not-yet-published dependency.
 *
 * This list used to exist twice — in `scripts/publish.sh` and inline in
 * `.github/workflows/release.yml`, with a "KEEP IN SYNC" comment on both. The
 * split into a gate job and a publish job would have made it three copies.
 * Both consumers now read this file; `publish.sh` via `node -e`.
 */
export const RELEASE_PACKAGES = [
  'packages/shared-types',
  'packages/sveltekit-utils',
  // design-engine / -content / design MUST precede mcp-server, which depends on
  // all three — otherwise mcp-server ships with unresolvable npm deps.
  'packages/design-engine',
  'packages/design-content',
  'packages/design',
  'packages/mcp-server',
  'packages/i18n',
  'packages/docs-gen',
  'packages/blocks',
  'packages/table',
  'packages/auth',
  'packages/docs',
  // sv LAST: its add-on code writes `@urbicon-ui/blocks@^<version>` and
  // `@urbicon-ui/design@^<version>` into consumer package.jsons — a dependency
  // edge npm cannot see (community add-ons must not declare `dependencies`), so
  // this ordering is the only thing keeping the topological invariant.
  'packages/sv'
];

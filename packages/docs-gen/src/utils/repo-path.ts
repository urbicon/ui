/**
 * The one spelling of "repo-relative path" in the pipeline.
 *
 * Three consumers need a source file expressed the same way — the `sourcePath`
 * on every extracted type (LocalTypesExtractor), the `sourceHref` GitHub link
 * and the type-ownership directory index (APIDataGenerator) — and ownership
 * only resolves when the last two agree with the first *character for
 * character*. They did not: two of them matched `/(packages\/.+)$/`, which has
 * no leading separator and takes the leftmost match, so a checkout in a
 * directory whose name merely *ends* in `packages` matched inside that name:
 *
 * ```
 * /home/me/ui/packages/blocks/…      → packages/blocks/…            (agreed)
 * /home/me/dev-packages/ui/packages/blocks/…
 *                                    → packages/ui/packages/blocks/… (did not)
 * ```
 *
 * The consequence was silent: `componentsByDir` keyed on paths no `sourcePath`
 * could ever match, so `owner` was simply absent everywhere and the feature
 * degraded to its pre-existing behaviour without a word. Hence one function
 * rather than three hand-aligned copies.
 */
/**
 * `packages/<pkg>/…` for a path inside the monorepo's package tree, else
 * `null`.
 *
 * Two properties, both learned by breaking them:
 *
 * - `packages` must be a whole path segment. Matching the bare substring is
 *   what made a `…-packages/` checkout directory look like the package root.
 * - The input may already *be* repo-relative. `TypeDefinition.sourcePath` is
 *   stored in this very form, and ownership resolution feeds it back in to
 *   get its directory. An intermediate `path.resolve()` here turned
 *   `packages/blocks/…` into `<cwd>/packages/blocks/…` and then re-anchored on
 *   the cwd's own `packages/` segment — measured: 573 of 967 entries lost
 *   their owner, silently.
 */
export function repoRelativePackagePath(filePath: string): string | null {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.indexOf('/packages/');
  if (index >= 0) return normalized.slice(index + 1);
  return normalized.startsWith('packages/') ? normalized : null;
}

/** Directory part of {@link repoRelativePackagePath}, or `null`. */
export function repoRelativePackageDir(filePath: string): string | null {
  const repoRelative = repoRelativePackagePath(filePath);
  if (!repoRelative) return null;
  const cut = repoRelative.lastIndexOf('/');
  return cut > 0 ? repoRelative.slice(0, cut) : null;
}

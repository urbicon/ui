#!/usr/bin/env bash
#
# Local publish of all public @urbicon-ui/* packages to a registry.
#
# Mirrors the CI publish step in .github/workflows/release.yml, for the cases
# where you publish from your machine (e.g. the very first release of a new
# scope) instead of via a tag-triggered CI run.
#
# Usage:
#   bun run release:publish              # publish to public npm
#   DRY_RUN=1 bun run release:publish    # print what would happen, publish nothing
#   NPM_REGISTRY_URL=https://my.registry bun run release:publish
#
# The registry defaults to PUBLIC npm and is always passed explicitly, so a
# Verdaccio/other default in ~/.npmrc cannot silently capture the publish.
#
# Prerequisites:
#   - npm auth for the target registry (`npm login --registry <url>`), with
#     publish rights for the @urbicon-ui scope (npm org `urbicon-ui`).
#   - clean working tree on `main`.

set -euo pipefail

REGISTRY="${NPM_REGISTRY_URL:-https://registry.npmjs.org}"
DRY_RUN="${DRY_RUN:-}"

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# The publish order lives in scripts/release-packages.mjs — one list, read by
# this script and by the release workflow's pack step. It used to be duplicated
# here and in the workflow, under a "KEEP IN SYNC" comment on both.
#
# `while read` rather than `mapfile`: this script runs on macOS, whose /bin/bash
# is 3.2 and has no `mapfile`.
PACKAGES=()
while IFS= read -r pkg; do
  [ -n "$pkg" ] && PACKAGES+=("$pkg")
done < <(
  node -e "import('./scripts/release-packages.mjs').then(m => console.log(m.RELEASE_PACKAGES.join('\n')))"
)
[ ${#PACKAGES[@]} -gt 0 ] || { echo "could not read the publish order" >&2; exit 1; }

echo "==> Registry: $REGISTRY"
[ -n "$DRY_RUN" ] && echo "==> DRY RUN — nothing will be published"

# --- Preflight ---------------------------------------------------------------
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || echo "!!  Warning: not on 'main' (on '$BRANCH')"
[ -z "$(git status --porcelain)" ] || echo "!!  Warning: working tree is not clean"

# npm only bundles a LICENSE that sits in the package directory, so every
# published package tracks its own copy of the root file. This used to be a
# `cp` here plus an EXIT-trap `rm`, from when those copies were transient —
# once they were tracked, the trap deleted 13 tracked files out of the working
# tree on every local run. Assert what the copy used to guarantee instead.
for dir in "${PACKAGES[@]}"; do
  [ -f "$ROOT/$dir/package.json" ] || continue
  [ -f "$ROOT/$dir/LICENSE" ] \
    || { echo "✗  $dir/LICENSE is missing — it is tracked, restore it (git checkout $dir/LICENSE)"; exit 1; }
  cmp -s "$ROOT/LICENSE" "$ROOT/$dir/LICENSE" \
    || { echo "✗  $dir/LICENSE differs from the root LICENSE"; exit 1; }
done

if WHO="$(npm whoami --registry "$REGISTRY" 2>/dev/null)"; then
  echo "==> Authenticated as: $WHO"
elif [ -n "$DRY_RUN" ]; then
  echo "!!  Not authenticated to $REGISTRY (ok for dry run)"
else
  echo "✗  Not logged in to $REGISTRY"
  echo "   Run: npm login --registry $REGISTRY"
  exit 1
fi

# --- Build -------------------------------------------------------------------
if [ -n "$DRY_RUN" ]; then
  echo "==> Skipping build (dry run)"
else
  echo "==> Building all packages (bun run build)"
  bun run build

  # This path bypasses CI entirely, so it carries its own declaration guard: a
  # failed declaration emit makes svelte-package omit that file's .d.ts and
  # still exit 0, which would publish a silently untyped package. `npm publish`
  # can't be taken back for a given version, so gate before it, not after.
  echo "==> Declaration guard (bun run types:guard)"
  bun run types:guard
fi

# --- Publish -----------------------------------------------------------------
published=0
skipped=0
for dir in "${PACKAGES[@]}"; do
  if [ ! -f "$ROOT/$dir/package.json" ]; then
    echo "!!  $dir/package.json not found, skipping"
    continue
  fi
  NAME="$(node -p "require('$ROOT/$dir/package.json').name")"
  VERSION="$(node -p "require('$ROOT/$dir/package.json').version")"

  # Idempotent: skip a name@version that is already on the registry, so a
  # re-run after a partial failure resumes instead of erroring.
  if npm view "$NAME@$VERSION" version --registry "$REGISTRY" >/dev/null 2>&1; then
    echo "··  $NAME@$VERSION already published — skipping"
    skipped=$((skipped + 1))
    continue
  fi

  if [ -n "$DRY_RUN" ]; then
    echo "→   would publish $NAME@$VERSION"
    continue
  fi

  echo "==> Publishing $NAME@$VERSION"
  # bun pm pack (not npm pack): it resolves `workspace:`/`catalog:` specifiers
  # to concrete versions at pack time, which npm leaves verbatim →
  # unresolvable for consumers. The tarball is gated BEFORE the irreversible
  # publish (v6.26.1 shipped without LICENSE because an unasserted publish
  # silently dropped it), then pushed with npm — publishing a pre-built
  # tarball changes nothing in the manifest. KEEP IN SYNC with release.yml.
  TARBALL_DIR="$(mktemp -d)"
  (cd "$ROOT/$dir" && bun pm pack --destination "$TARBALL_DIR")
  TGZ="$TARBALL_DIR/$(echo "$NAME" | tr -d '@' | tr '/' '-')-$VERSION.tgz"
  [ -f "$TGZ" ] || { echo "✗  expected tarball $TGZ not found"; exit 1; }
  tar -tzf "$TGZ" | grep -q '^package/LICENSE$' \
    || { echo "✗  $NAME tarball is missing LICENSE"; exit 1; }
  if tar -xzOf "$TGZ" package/package.json | grep -Eq '"(workspace|catalog):'; then
    echo "✗  $NAME manifest still contains workspace:/catalog: specifiers"; exit 1
  fi
  npm publish "$TGZ" --access public --registry "$REGISTRY"
  rm -rf "$TARBALL_DIR"
  published=$((published + 1))
done

echo "==> Done. Published: $published, skipped: $skipped"

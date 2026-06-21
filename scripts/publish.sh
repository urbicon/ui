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

# Topological order: a package is published only after everything it depends on,
# so a consumer installing mid-publish never sees a range pointing at a
# not-yet-published dependency.
PACKAGES=(
  packages/shared-types
  packages/sveltekit-utils
  packages/design-engine
  packages/design-content
  packages/design
  packages/mcp-server
  packages/i18n
  packages/docs-gen
  packages/blocks
  packages/table
  packages/auth
  packages/docs
)

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> Registry: $REGISTRY"
[ -n "$DRY_RUN" ] && echo "==> DRY RUN — nothing will be published"

# --- Preflight ---------------------------------------------------------------
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || echo "!!  Warning: not on 'main' (on '$BRANCH')"
[ -z "$(git status --porcelain)" ] || echo "!!  Warning: working tree is not clean"

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

  # --- LICENSE into each package (npm only bundles a LICENSE from the package dir)
  cleanup() {
    for dir in "${PACKAGES[@]}"; do
      [ -f "$ROOT/$dir/LICENSE" ] && rm -f "$ROOT/$dir/LICENSE"
    done
  }
  trap cleanup EXIT
  for dir in "${PACKAGES[@]}"; do
    [ -f "$ROOT/$dir/package.json" ] && cp "$ROOT/LICENSE" "$ROOT/$dir/LICENSE"
  done
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
  (cd "$ROOT/$dir" && npm publish --access public --registry "$REGISTRY")
  published=$((published + 1))
done

echo "==> Done. Published: $published, skipped: $skipped"

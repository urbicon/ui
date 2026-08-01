#!/usr/bin/env bash
#
# Registers this repository's release workflow as the trusted publisher for
# every package, so the thirteen do not have to be clicked through one at a
# time on npmjs.com.
#
# Run it yourself — it needs your npm login, which CI does not have and should
# not have:
#
#   bash scripts/trust-publishers.sh            # show what it would do
#   APPLY=1 bash scripts/trust-publishers.sh    # actually configure
#
# Prerequisites, all on your machine:
#   - npm >= 11.15.0 (`npm trust` does not exist below that). This script uses
#     `npx npm@latest` so the system npm can stay where it is.
#   - `npm login` with 2FA on the account. A granular access token with the
#     "bypass 2FA" option does NOT work for `npm trust` — that is a documented
#     limitation of the command, not of this script.
#
# A package that does not exist on the registry yet is SKIPPED, not failed:
# npm requires the package to exist before a trusted publisher can be attached
# to it. Publish it once the old way, then re-run this. As of 2026-08-01 that
# applies to @urbicon-ui/sv, which has never been published.
set -euo pipefail

cd "$(dirname "$0")/.."

REPO="${REPO:-urbicon/ui}"
WORKFLOW="${WORKFLOW:-release.yml}"
APPLY="${APPLY:-}"
NPM="${NPM:-npx -y npm@latest}"

PACKAGES=()
while IFS= read -r pkg; do
  [ -n "$pkg" ] && PACKAGES+=("$pkg")
done < <(
  node -e "import('./scripts/release-packages.mjs').then(m => console.log(m.RELEASE_PACKAGES.join('\n')))"
)

echo "==> repo:     $REPO"
echo "==> workflow: $WORKFLOW"
[ -z "$APPLY" ] && echo "==> DRY RUN — set APPLY=1 to configure"
echo

configured=0
skipped=0
missing=0

for dir in "${PACKAGES[@]}"; do
  name=$(node -p "require('./$dir/package.json').name")

  # `npm view` is the cheapest existence check, and the one npm itself will
  # apply a moment later.
  if ! npm view "$name" version >/dev/null 2>&1; then
    echo "··  $name — not on the registry yet, skipping (publish it once first)"
    missing=$((missing + 1))
    continue
  fi

  if $NPM trust list "$name" 2>/dev/null | grep -q "$REPO"; then
    echo "··  $name — already trusts $REPO"
    skipped=$((skipped + 1))
    continue
  fi

  if [ -z "$APPLY" ]; then
    echo "→   $name — would trust $REPO ($WORKFLOW)"
  else
    echo "==> $name"
    $NPM trust github "$name" --repo "$REPO" --file "$WORKFLOW"
  fi
  configured=$((configured + 1))
done

echo
echo "==> ${APPLY:+configured }${APPLY:-would configure }$configured, already set $skipped, unpublished $missing"
[ "$missing" -gt 0 ] && echo "    Unpublished packages need one release the old way before they can be trusted."
exit 0

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

# Prefer the installed npm when it is new enough. `npx npm@latest` was the
# fallback for older setups, but it pulls whatever is newest — which warned
# about not supporting the local Node — where the system npm is both compatible
# and already there.
MIN_NPM="11.15.0"
if [ -z "${NPM:-}" ]; then
  LOCAL_NPM="$(npm --version 2>/dev/null || echo 0.0.0)"
  if [ "$(printf '%s\n%s\n' "$MIN_NPM" "$LOCAL_NPM" | sort -V | head -1)" = "$MIN_NPM" ]; then
    NPM="npm"
  else
    echo "==> local npm $LOCAL_NPM is below $MIN_NPM, falling back to npx npm@latest"
    NPM="npx -y npm@latest"
  fi
fi

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

  # The "is it already configured?" check is off by default: `npm trust list`
  # needs the same one-time password as the write, so asking first would double
  # the auth rounds for a run that is idempotent anyway — re-registering the
  # same repo/workflow just restates it. `CHECK_EXISTING=1` turns it back on.
  if [ -n "${CHECK_EXISTING:-}" ] && $NPM trust list "$name" 2>/dev/null | grep -q "$REPO"; then
    echo "··  $name — already trusts $REPO"
    skipped=$((skipped + 1))
    continue
  fi

  # `--allow-publish` is not optional despite the docs listing it in brackets:
  # npm rejects the call with "At least one permission flag is required". It is
  # the one we want — `--allow-stage-publish` grants staged publishes only.
  if [ -z "$APPLY" ]; then
    echo "→   $name — would trust $REPO ($WORKFLOW)"
  else
    echo "==> $name"
    $NPM trust github "$name" --repo "$REPO" --file "$WORKFLOW" --allow-publish
  fi
  configured=$((configured + 1))
done

echo
if [ -n "$APPLY" ]; then verb="configured"; else verb="would configure"; fi
echo "==> $verb $configured, already set $skipped, unpublished $missing"
[ "$missing" -gt 0 ] && echo "    Unpublished packages need one release the old way before they can be trusted."
exit 0

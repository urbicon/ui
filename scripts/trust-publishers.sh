#!/usr/bin/env bash
#
# Registers this repository's release workflow as the trusted publisher for
# the packages in RELEASE_PACKAGES, so they do not have to be clicked through
# one at a time on npmjs.com.
#
# Run it yourself — it needs your npm login, which CI does not have and should
# not have:
#
#   bash scripts/trust-publishers.sh                          # show what it would do
#   ONLY=@urbicon-ui/<name> APPLY=1 bash scripts/trust-publishers.sh   # one new package
#   APPLY=1 bash scripts/trust-publishers.sh                  # every package
#
# Every write asks for a browser confirmation, so `ONLY` (comma-separated
# names) is the normal call once the older packages are set up; a name that is
# not in RELEASE_PACKAGES, or a named package not yet visible to `npm view`,
# fails the run. A package that already has a trusted publisher answers
# `409 Conflict` with "a trusted publisher configuration … already exists";
# that is counted as already set, not as a failure. There is no read-before-write: `npm trust list`
# asks for a one-time password too (npm 11.20.0, EOTP), so it saves nothing.
#
# Prerequisites, all on your machine:
#   - npm >= 11.15.0 (`npm trust` does not exist below that). The installed npm
#     is used when it is new enough, `npx -y npm@latest` otherwise.
#   - `npm login` with 2FA on the account. A granular access token with the
#     "bypass 2FA" option does NOT work for `npm trust` — that is a documented
#     limitation of the command, not of this script.
#
# A package that does not exist on the registry yet is SKIPPED, not failed:
# npm requires the package to exist before a trusted publisher can be attached
# to it. Publish it once the old way, then re-run this.
set -euo pipefail

cd "$(dirname "$0")/.."

REPO="${REPO:-urbicon/ui}"
WORKFLOW="${WORKFLOW:-release.yml}"
APPLY="${APPLY:-}"
if [ "${ONLY+set}" = set ] && [ -z "${ONLY//[[:space:]]/}" ]; then
  echo "✗   ONLY is set but empty — name the packages, or unset it to run all" >&2
  exit 1
fi
ONLY="${ONLY:-}"
ONLY="${ONLY//[[:space:]]/}"

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

if [ -n "$ONLY" ]; then
  IFS=',' read -r -a WANTED <<<"$ONLY"
  for want in "${WANTED[@]}"; do
    [ -z "$want" ] && continue
    found=
    for dir in "${PACKAGES[@]}"; do
      [ "$(node -p "require('./$dir/package.json').name")" = "$want" ] && found=1 && break
    done
    if [ -z "$found" ]; then
      echo "✗   ONLY names $want, which is not in RELEASE_PACKAGES" >&2
      exit 1
    fi
  done
fi

echo "==> repo:     $REPO"
echo "==> workflow: $WORKFLOW"
[ -z "$APPLY" ] && echo "==> DRY RUN — set APPLY=1 to configure"
echo

configured=0
skipped=0
missing=0
err="$(mktemp)"
trap 'rm -f "$err"' EXIT

for dir in "${PACKAGES[@]}"; do
  name=$(node -p "require('./$dir/package.json').name")
  if [ -n "$ONLY" ] && [[ ",$ONLY," != *",$name,"* ]]; then
    continue
  fi

  # `npm view` is the cheapest existence check, and the one npm itself will
  # apply a moment later.
  if ! npm view "$name" version >/dev/null 2>&1; then
    echo "··  $name — not on the registry yet, skipping (publish it once first)"
    missing=$((missing + 1))
    continue
  fi

  if [ -z "$APPLY" ]; then
    echo "→   $name — would trust $REPO ($WORKFLOW), unless it already does"
    configured=$((configured + 1))
    continue
  fi

  # `--allow-publish` is not optional despite the docs listing it in brackets:
  # npm rejects the call with "At least one permission flag is required". It is
  # the one we want — `--allow-stage-publish` grants staged publishes only.
  #
  # stderr goes through tee so the 409 can be read afterwards; stdout stays on
  # the terminal for npm's confirmation prompt. pipefail makes the pipeline
  # report npm's status, not tee's.
  echo "==> $name"
  : >"$err"
  if { $NPM trust github "$name" --repo "$REPO" --file "$WORKFLOW" --allow-publish 2>&1 1>&3 | tee "$err" >&2; } 3>&1; then
    configured=$((configured + 1))
  elif grep -q 'E409' "$err" && grep -q 'trusted publisher configuration.*already exists' "$err"; then
    echo "··  $name — 409 Conflict: a trusted publisher already exists, left as it is"
    skipped=$((skipped + 1))
  else
    echo "✗   $name — npm trust failed, see above" >&2
    exit 1
  fi
done

if [ -n "$ONLY" ] && [ "$missing" -gt 0 ]; then
  echo "✗   $missing named package(s) not on the registry yet — nothing was set for them" >&2
  exit 1
fi

echo
if [ -n "$APPLY" ]; then verb="configured"; else verb="would configure"; fi
echo "==> $verb $configured, already set $skipped, unpublished $missing"
[ "$missing" -gt 0 ] && echo "    Unpublished packages need one release the old way before they can be trusted."
exit 0

#!/usr/bin/env bash
set -euo pipefail

# Version bump + changelog + annotated tag (Conventional Commits -> git-cliff).
# Managed by @urbicon/udx — push changes back via `udx sync`.
# Bun-native (no node/npm required). Unified versioning: if a packages/ folder
# exists, all non-private sub-packages get the same version as the root package.
#
# Internal sibling deps (on workspace-owned packages) are handled as follows:
#   • `workspace:*` / `workspace:^` etc. stay untouched — Bun resolves the
#     protocol to the concrete version at publish time.
#   • an explicit semver range is normalized to a major-compatible range
#     (`^<major>.0.0`, 0.x-safe). This keeps e.g. a peerDependency satisfiable
#     across patch/minor/major, even when a sibling is not republished on every
#     release and the registry lags behind. Pure `workspace:*` setups notice
#     nothing of this (no-op).
#
# Usage: scripts/bump.sh <patch|minor|major>
# Env:   BUMP_SKIP_VERIFY=1  skips build/test before the tag.

LEVEL="${1:-patch}"

if [[ "$LEVEL" != "patch" && "$LEVEL" != "minor" && "$LEVEL" != "major" ]]; then
  echo "Usage: $0 <patch|minor|major>"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

if [[ "${BUMP_SKIP_VERIFY:-0}" == "1" ]]; then
  echo "⚠ Skipping build/test verification (BUMP_SKIP_VERIFY=1)"
else
  has_script() { bun -e "process.exit(require('./package.json').scripts?.['$1'] ? 0 : 1)" 2>/dev/null; }
  if has_script build; then echo "→ bun run build"; bun run build; fi
  if has_script test; then echo "→ bun run test"; bun run test; fi
fi

ROLLBACK_REF=$(git rev-parse HEAD)

rollback() {
  local code=$?
  echo "✗ Bump failed (exit $code) — rolling back to $ROLLBACK_REF"
  if [ -n "${VERSION:-}" ]; then
    git tag -d "v$VERSION" >/dev/null 2>&1 || true
  fi
  git reset --hard "$ROLLBACK_REF" >/dev/null 2>&1 || true
  exit "$code"
}
trap rollback ERR INT TERM

# 1. Compute the root version (patch/minor/major) and write it — bun-native.
VERSION=$(bun -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const [maj, min, pat] = (pkg.version ?? "0.0.0").split(".").map(Number);
  const lvl = process.argv[1];
  const next = lvl === "major" ? [maj + 1, 0, 0]
             : lvl === "minor" ? [maj, min + 1, 0]
             : [maj, min, pat + 1];
  pkg.version = next.join(".");
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  console.log(pkg.version);
' "$LEVEL")
echo "New version: v$VERSION"

# 2. Set sub-packages (if any) to the same version and normalize internal
#    sibling deps with an explicit semver range to be major-compatible
#    (see header). `workspace:` deps stay untouched.
PKG_FILES=$(bun -e '
  const fs = require("fs");
  const path = require("path");
  const SKIP = new Set(["node_modules", "dist", "build", ".git", ".svelte-kit"]);
  const VERSION = process.argv[1];
  const DEP_FIELDS = ["dependencies", "peerDependencies", "devDependencies"];

  // major-compatible range, 0.x-safe: at 0.x the minor (or patch) marks the
  // compatibility boundary, not the major — `^0.0.0` would otherwise be uselessly tight.
  const [maj, min, pat] = VERSION.split(".").map(Number);
  const range = maj > 0 ? "^" + maj + ".0.0"
              : min > 0 ? "^0." + min + ".0"
              :           "^0.0." + pat;

  if (!fs.existsSync("packages")) process.exit(0);
  function find(base) {
    const out = [];
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || SKIP.has(e.name)) continue;
      const p = path.join(base, e.name, "package.json");
      if (fs.existsSync(p)) out.push(p);
      const nested = path.join(base, e.name);
      for (const s of fs.readdirSync(nested, { withFileTypes: true })) {
        if (!s.isDirectory() || SKIP.has(s.name)) continue;
        const sp = path.join(nested, s.name, "package.json");
        if (fs.existsSync(sp)) out.push(sp);
      }
    }
    return out;
  }
  const files = find("packages");

  // Names of the packages whose version this bump raises to VERSION: the root
  // package (always) plus all non-private sub-packages — generically via the
  // name fields, never via a hardcoded scope. Only internal ranges pointing at
  // one of these are normalized: a range on a non-bumped (private) sibling would
  // otherwise stay locally unresolvable.
  const bumped = new Set();
  const rootName = JSON.parse(fs.readFileSync("package.json", "utf8")).name;
  if (rootName) bumped.add(rootName);
  const manifests = files.map((f) => [f, JSON.parse(fs.readFileSync(f, "utf8"))]);
  for (const [, pkg] of manifests) {
    if (!pkg.private && pkg.name) bumped.add(pkg.name);
  }

  // Version bump only for non-private packages; range normalization, however,
  // also in private ones, so their local links to bumped siblings stay valid.
  let ranges = 0;
  const written = [];
  for (const [file, pkg] of manifests) {
    let changed = false;
    if (!pkg.private && pkg.version !== VERSION) {
      pkg.version = VERSION;
      changed = true;
    }
    for (const field of DEP_FIELDS) {
      const deps = pkg[field];
      if (!deps) continue;
      for (const name of Object.keys(deps)) {
        if (!bumped.has(name)) continue;
        if (String(deps[name]).startsWith("workspace:")) continue;
        if (deps[name] !== range) { ranges++; changed = true; }
        deps[name] = range;
      }
    }
    if (changed) {
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
      written.push(file);
    }
  }
  console.error("Updated " + written.length + " package(s)" +
    (ranges ? " (" + ranges + " internal range(s) -> " + range + ")" : ""));
  console.log(written.join("\n"));
' "$VERSION")

# 3. Update the lockfile
bun install --silent

# 4. Generate changelog
bunx git-cliff --tag "v$VERSION" --output CHANGELOG.md

# 5. Stage exactly the touched files (never `git add -A`).
git add package.json CHANGELOG.md
while IFS= read -r f; do
  [ -n "$f" ] && git add "$f"
done <<<"$PKG_FILES"
# Only stage the lockfile when `bun install` changed it as a result of the bump
# (e.g. because internal ranges were adjusted in step 2). The clean-tree check
# above ensures that every change here stems from the bump. Untracked or
# ignored lockfiles are not reported by `git diff` — they stay out of scope.
for lock in bun.lock bun.lockb; do
  if [ -f "$lock" ] && ! git diff --quiet -- "$lock"; then
    git add "$lock"
    echo "Staged $lock (changed by bump)"
  fi
done
git commit -m "chore: release v$VERSION" --no-verify
git tag -a "v$VERSION" -m "v$VERSION"

trap - ERR INT TERM

echo "Done: v$VERSION"
echo "Push with: git push --follow-tags"

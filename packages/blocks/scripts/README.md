# blocks/scripts

Build/maintenance scripts for `@urbicon-ui/blocks`:

- `icons-lint.ts` — enforces the icon design contract + registry integrity
  (`bun run icons:lint`). See [docs/ICON-DESIGN.md](../../../docs/ICON-DESIGN.md).
- `imports-lint.ts` — guards cross-component imports (`bun run imports:lint`).
  A component under `primitives/*` or `components/*` may only import a Svelte
  component from another public component directory when the edge is on the
  script's allowlist (each entry with a one-line justification); stale entries
  error too, so the list can only shrink deliberately, never grow silently.
  `src/lib/internal/**` is always allowed (extraction target).
- `add-icons.ts`, `fix-icon-components.ts`, `fix-svgs.ts`, `refactor-icons.ts`,
  `wrap-svgs.ts` — one-off icon-pipeline helpers.

## Bundle sizing has moved

`bundle-size.ts` now measures `table` and `auth` alongside `blocks`, so it lives
at the repo root: [`scripts/bundle-size.ts`](../../../scripts/bundle-size.ts),
run as `bun run size`, baseline at `bundle-size.baseline.json` (root).

## i18n auditing has moved

The old regex prototype (`i18n-analyzer.js`) has been replaced by the AST-based
**`urbicon i18n`** command (`@urbicon-ui/design`), backed by the
**`@urbicon-ui/i18n/audit`** subpath. Run the repo-wide check with:

```bash
bun run i18n:check   # parity + unused-key scan + hardcoded-string lint, blocks + table
```

`urbicon i18n <parity|unused|hardcoded|audit> [dirs…] --translations <dir>` is the
general form; `--json` for machine output, `--strict` to gate advisory findings.
Consumers get the same tool plus `auditTranslations` / `createMissingKeyCollector`
from `@urbicon-ui/i18n`. See the [i18n package README](../../i18n/README.md).

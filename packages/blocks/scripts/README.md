# blocks/scripts

Build/maintenance scripts for `@urbicon-ui/blocks`:

- `icons-lint.ts` — enforces the icon design contract + registry integrity
  (`bun run icons:lint`). See [docs/ICON-DESIGN.md](../../../docs/ICON-DESIGN.md).
- `add-icons.ts`, `fix-icon-components.ts`, `fix-svgs.ts`, `refactor-icons.ts`,
  `wrap-svgs.ts` — one-off icon-pipeline helpers.

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

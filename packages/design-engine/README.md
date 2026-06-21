# @urbicon-ui/design-engine

The deterministic core of the Urbicon UI **design loop** — extracted from
`@urbicon-ui/mcp-server` so one engine can back the MCP server, a CLI, and editor
hooks alike.

**Zero runtime dependencies.** Pure TypeScript over Web/Node built-ins; no framework,
no parser, no third-party packages.

## Modules

Each module is independent and also available as a subpath export.

| Import | What it does | Question it answers |
| --- | --- | --- |
| `@urbicon-ui/design-engine/linter` | Deterministic design linter: rules + token whitelist + distribution heuristics | *Is it correct?* |
| `@urbicon-ui/design-engine/manifest` | Parse/edit `design.manifest.md`; scan `data-design-pattern` markers | *What has this project decided?* |
| `@urbicon-ui/design-engine/rubric` | The eight-criterion design-quality rubric | *Is it good?* (judged) |

The package root (`@urbicon-ui/design-engine`) re-exports all three.

```ts
import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { parseManifest, scanMarkers } from '@urbicon-ui/design-engine/manifest';
import { RUBRIC_CRITERIA, renderRubric } from '@urbicon-ui/design-engine/rubric';
```

## Notes

- Shipped as TypeScript source (no build step), like the rest of the Urbicon UI
  tooling — consume it with a TypeScript-aware runtime (Bun) or bundler.
- The linter's token whitelist is drift-guarded against the real CSS sources via a
  test; keep it in sync when foundation/semantic tokens change.

See [docs/internal/DESIGN-MCP.md](../../docs/internal/DESIGN-MCP.md) (as-built design loop)
and [DESIGN-MCP-V2.md](../../docs/internal/DESIGN-MCP-V2.md) (package-centric architecture).

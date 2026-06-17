# @urbicon-ui/mcp-server

Model Context Protocol server for the Urbicon UI design system. Gives LLMs first-class access to the component catalog, design tokens, recipes, and implementation guidance — the AI-native DX pillar of Urbicon.

**Transports:** stdio (default, for IDE integrations like Claude Code / Cursor) and streamable HTTP (for remote editors).

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

Runtime dependencies: `@modelcontextprotocol/sdk`, `zod`.

> **Bun is required.** `package.json#main` points at `./src/index.ts`
> directly — there is no transpilation step. The server is intended to
> be launched via `bun run` (see Quick Start). Tools like `npm i -g` or
> Node-only setups will not work; use Bun or wire the entry through a
> Bun wrapper script.

## Quick Start

### Stdio (IDE integration)

From the repo root:

```bash
bun run mcp:start
```

Or directly:

```bash
bun run packages/mcp-server/src/index.ts
```

### HTTP (remote)

```bash
bun run mcp:start:http
# listens on http://localhost:3001 with streamable transport
```

### Connect from Claude Code

Add to `~/.claude/mcp.json` (or project `.claude/mcp.json`):

```json
{
  "mcpServers": {
    "urbicon-ui": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/urbicon-ui/packages/mcp-server/src/index.ts"]
    }
  }
}
```

For Cursor: see [Cursor's MCP docs](https://docs.cursor.com/context/model-context-protocol).

## Tools

Most tools are read-only (`readOnlyHint: true`). The two manifest-writing tools (`record_design_decision`, `sync_design_manifest`) write `design.manifest.md` in the project root. Queries are Zod-validated.

| Tool                           | Purpose                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find_components`              | Fuzzy search across component names, tags, and descriptions. Filterable by package (`blocks`, `table`, `auth`).                                                                                                                                                        |
| `get_component`                | Full per-component documentation: props, variants, slots, examples, source link. Optional `section` argument for streamed chunks (overview / examples / variants / api / slots).                                                                                       |
| `get_recipe`                   | Full production-ready recipe (login-form, dashboard, settings-page, etc.) with component tree, code, and notes.                                                                                                                                                        |
| `suggest_implementation`       | Takes a natural-language goal and returns a component-tree suggestion, relevant recipes, Style-Patterns guide, and the implementation checklist.                                                                                                                       |
| `get_implementation_checklist` | Design-Quality checklist (visual weight, intent semantics, spacing, radius, data-driven styling, dominance, identity) — embedded directly so the LLM can self-verify.                                                                                                  |
| `get_css_reference`            | Full token reference — surface, text, border, intent, feedback tokens, radii, z-index. Includes an explicit "do not invent tokens" guardrail.                                                                                                                          |
| `find_icons`                   | Browse the 156-icon catalog by keyword, category, or name.                                                                                                                                                                                                             |
| `get_design_principles`        | Design heuristics (Layer 5): visual hierarchy, interaction, component selection, layout, accessibility, theming (paradigms, change decision tree). Call first when generating UI. `as="rubric"` returns the 8-criterion 1–5 scoring rubric for judging a generated UI. |
| `get_pattern`                  | Composition patterns (Layer 4) for page archetypes — settings-page, dashboard, form-page, tab-navigation, onboarding-guide.                                                                                                                                            |
| `validate_design`              | Lint generated markup against the design rules — raw colours, `dark:`/`focus:` misuse, hardcoded z-index, broken dynamic classes, hallucinated tokens, plus distribution heuristics. Returns a 0–100 score and per-finding fixes for a generate → validate → fix loop. |
| `get_design_context`           | Read the project's `design.manifest.md`: chosen paradigm/theme/density, which pages use which composition patterns, and recorded design decisions (ADRs). Call at the start of a UI task to stay consistent with prior decisions.                                      |
| `record_design_decision`       | Append a design decision (ADR) to the manifest — record a deliberate deviation from a pattern or principle so future sessions honour it. Writes `design.manifest.md`.                                                                                                  |
| `sync_design_manifest`         | Scan the project source for `data-design-pattern` markers and regenerate the manifest's Pattern Usages index — makes a pattern change tractable (grep the markers → migrate every listed file).                                                                        |

## Resources

| URI                              | Purpose                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `urbicon://catalog`              | Full component catalog in Markdown — used as the LLM's default context                             |
| `urbicon://guide/api-grammar`    | Canonical prop conventions (`intent`, `variant`, `size`, callbacks)                                |
| `urbicon://guide/design-quality` | AVOID/INSTEAD patterns from A/B-tested design-quality guidance (+33.8 % improvement in user study) |
| `urbicon://guide/style-patterns` | Reusable style presets and composition templates                                                   |
| `urbicon://guide/tokens`         | OKLCH token reference, same data as `get_css_reference`                                            |

## Prompts

Client-agnostic workflows (Option E of the design loop) — invoke them from any MCP client to run the full generate → validate → judge → synthesise process rather than a single-shot generation.

| Prompt        | Arguments                        | Purpose                                                                                                                                                          |
| ------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-page` | `brief`, `pattern?`, `variants?` | Design a new page: load context + pattern, explore N variants within the paradigm, gate each on `validate_design`, score with the rubric, synthesise the winner. |
| `redesign`    | `brief`, `code?`, `variants?`    | Redesign an existing page: diagnose with `validate_design` + the rubric, then fix exactly the flagged weaknesses while preserving behaviour.                     |

## CLI Options

```
urbicon-mcp [--transport <stdio|http>] [--port <n>] [--data-dir <path>]
```

| Flag          | Default       | Purpose                                                      |
| ------------- | ------------- | ------------------------------------------------------------ |
| `--transport` | `stdio`       | Transport mode                                               |
| `--port`      | `3001`        | HTTP port (ignored for stdio)                                |
| `--data-dir`  | auto-discover | Override the path to the generated catalog/templates/recipes |

## Architecture

```
src/
├── index.ts                 CLI entry + arg parsing, pre-loads catalog/templates/recipes
├── server.ts                MCP server construction (registers resources + tools)
├── transports/
│   ├── stdio.ts             Stdio transport
│   └── http.ts              Streamable HTTP transport (per-session)
├── tools/                   13 tools, each self-contained
├── design-linter/           validate_design engine: rules, token whitelist, heuristics (pure, unit-tested)
├── design-manifest/         design.manifest.md parse/scan/edit for the design-context tools
├── resources/               Catalog + guide resources
├── data/                    Loaders with in-process caching
│   ├── catalog-loader.ts    component-catalog.json
│   ├── template-loader.ts   llms.txt sections
│   ├── recipe-loader.ts     Recipes
│   ├── design-system-loader.ts  principles.md + patterns/*.md
│   ├── component-loader.ts
│   └── icon-loader.ts
└── utils/                   search, format-catalog, paths
```

The server reads its data from artifacts produced by [`@urbicon-ui/docs-gen`](../docs-gen/) (`component-catalog.json`, per-component `llms.txt`, recipes). That means JSDoc in a component's `index.ts` is the **single source of truth**: one edit propagates to the docs site, `llms-full.txt`, and every MCP tool.

## Development

```bash
bun --filter='@urbicon-ui/mcp-server' run dev        # watch mode (stdio)
bun --filter='@urbicon-ui/mcp-server' run start      # stdio, one-shot
bun --filter='@urbicon-ui/mcp-server' run start:http # HTTP on port 3001
bun --filter='@urbicon-ui/mcp-server' run check      # tsc --noEmit
```

Bun runs TypeScript directly — no build step.

## Roadmap

Next steps:

- **`compose_layout`** — takes natural-language intent and returns a full component tree with props (v1.x)
- **`llm.json` per component** — structured, token-efficient sibling of `llm.txt` (v1.x)

Smoke tests for catalog loading, tool wiring, and fuzzy search are already in place (`bunx --bun vitest run` in this package).

## Related

- [`@urbicon-ui/docs-gen`](../docs-gen/) — produces the catalog and llms.txt files this server reads

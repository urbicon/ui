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

All tools are read-only (`readOnlyHint: true`) — this server never touches the consumer's filesystem. Queries are Zod-validated. (Manifest read/write moved to the `urbicon` CLI in [`@urbicon-ui/design`](../design/); a stateless remote server cannot reach a consumer's repo.)

| Tool                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `find_components`              | Fuzzy search across component names, tags, and descriptions. Filterable by package (`blocks`, `table`, `auth`).                                                                                                                                                                                                                                                                                                                                    |
| `get_component`                | Full per-component documentation: props, variants, slots, examples, source link. Optional `section` argument for streamed chunks (overview / examples / variants / api / slots).                                                                                                                                                                                                                                                                   |
| `get_recipe`                   | Full production-ready recipe (login-form, dashboard, settings-page, etc.) with component tree, code, and notes.                                                                                                                                                                                                                                                                                                                                    |
| `suggest_implementation`       | Takes a natural-language goal and returns a component-tree suggestion, relevant recipes, Style-Patterns guide, and the implementation checklist.                                                                                                                                                                                                                                                                                                   |
| `get_implementation_checklist` | Design-Quality checklist (visual weight, intent semantics, spacing, radius, data-driven styling, dominance, identity) — embedded directly so the LLM can self-verify.                                                                                                                                                                                                                                                                              |
| `get_css_reference`            | Full token reference — surface, text, border, intent, feedback tokens, radii, z-index. Includes an explicit "do not invent tokens" guardrail.                                                                                                                                                                                                                                                                                                      |
| `find_icons`                   | Browse the 315-icon catalog by keyword, category, or name.                                                                                                                                                                                                                                                                                                                                                                                         |
| `get_design_principles`        | Design heuristics (Layer 5): visual hierarchy, interaction, component selection, layout, accessibility, theming (paradigms, change decision tree). Call first when generating UI. `as="rubric"` returns the 8-criterion 1–5 scoring rubric for judging a generated UI.                                                                                                                                                                             |
| `get_pattern`                  | Composition patterns (Layer 4) for page archetypes — settings-page, dashboard, form-page, tab-navigation, onboarding-guide.                                                                                                                                                                                                                                                                                                                        |
| `validate_design`              | Lint generated markup on two axes — **correctness** (raw colours, `dark:`/`focus:` misuse, hardcoded z-index, broken dynamic classes, hallucinated tokens, foreign-library component APIs, unlabelled icon buttons; the blocking gate) and the **slop-floor** (20 system-agnostic "looks generic" heuristics: generic fonts, animated dimensions, grey-on-colour, touch targets, …; advisory). Returns a correctness score + a slop-floor score and per-finding fixes for a generate → validate → fix loop. |

## Resources

| URI                              | Purpose                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `urbicon://catalog`              | Full component catalog in Markdown — used as the LLM's default context                             |
| `urbicon://guide/api-grammar`    | Canonical prop conventions (`intent`, `variant`, `size`, callbacks)                                |
| `urbicon://guide/design-quality` | AVOID/INSTEAD patterns from A/B-tested design-quality guidance (+33.8 % improvement in user study) |
| `urbicon://guide/style-patterns` | Reusable style presets and composition templates                                                   |
| `urbicon://guide/tokens`         | OKLCH token reference, same data as `get_css_reference`                                            |

## Prompts

The full design-verb table (DESIGN-MCP-V2 §8) — client-agnostic workflows you invoke from any MCP client to run a multi-step recipe over the four design planes rather than a single-shot generation. Each recipe is the same text the local `@urbicon-ui/design` skill ships (single source, bundled via `@urbicon-ui/design-content`): it opens by reading the project's `design.manifest.md`, does the work through the read-only tools above, and closes by writing the decision back.

| Prompt     | Arguments                      | Purpose                                                                                    |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| `onboard`  | `brief?`                       | Greenfield: interview product intent + intake, seed the manifest.                          |
| `adopt`    | `brief?`                       | Brownfield: infer the design language from code, measure drift, seed the manifest.         |
| `compose`  | `brief?`, `variants?`          | New page via generate → validate → judge → synthesise (variants + rubric + linter gate).   |
| `redesign` | `brief?`, `code?`, `variants?` | Diagnose with linter + rubric, fix exactly the flagged weaknesses, preserve behaviour.     |
| `polish`   | `brief?`, `code?`              | Small token-level fixes that raise the slop-floor score without restructuring.             |
| `critique` | `brief?`, `code?`              | Judge without changing: correctness + slop + rubric → a prioritised, verb-tagged fix-list. |
| `fix`      | `brief?`, `code?`              | Repair correctness defects (raw colours, `dark:`/`focus:`, z-index, hallucinated tokens).  |
| `retheme`  | `brief?`                       | Rebrand: change the token layer once, propagate across every affected file.                |
| `audit`    | `brief?`                       | App-wide sweep: validate the tree, check pattern cohorts, report drift over time.          |
| `migrate`  | `brief?`                       | Roll out a pattern/library change across every site, gated per file.                       |

## CLI Options

```
urbicon-mcp [--transport <stdio|http>] [--port <n>] [--content-dir <path>]
```

| Flag            | Default       | Purpose                                                        |
| --------------- | ------------- | -------------------------------------------------------------- |
| `--transport`   | `stdio`       | Transport mode                                                 |
| `--port`        | `3001`        | HTTP port (ignored for stdio)                                  |
| `--content-dir` | auto-discover | Override the design-content bundle dir (`URBICON_CONTENT_DIR`) |

## Architecture

```
src/
├── index.ts                 CLI entry + arg parsing, pre-loads catalog/templates/principles
├── server.ts                MCP server construction (registers resources + tools)
├── transports/
│   ├── stdio.ts             Stdio transport
│   └── http.ts              Streamable HTTP transport (per-session)
├── tools/                   10 tools, each self-contained
│                            (validate_design calls @urbicon-ui/design-engine)
├── resources/               Catalog + guide resources
├── data/                    Loaders with in-process caching (read the design-content bundle)
│   ├── catalog-loader.ts    component-catalog.json (components + recipes)
│   ├── template-loader.ts   guide template sections
│   ├── design-system-loader.ts  principles.md + patterns/*.md
│   ├── component-loader.ts  per-component llm.txt
│   └── icon-loader.ts       icons.json
└── utils/                   search, format-catalog
```

The server reads its data from the version-pinned [`@urbicon-ui/design-content`](../design-content/) bundle (built by [`@urbicon-ui/docs-gen`](../docs-gen/): `component-catalog.json` with recipes, per-component `llm.txt`, design-system, guide template, `icons.json`). That means JSDoc in a component's `index.ts` is the **single source of truth**: one edit propagates to the docs site, `llms-full.txt`, and every MCP tool.

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

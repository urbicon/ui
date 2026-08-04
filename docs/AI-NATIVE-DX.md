# AI-Native DX

How this library makes itself usable by an agent: what is served, from where, and which
surface is the one consumers actually install.

## The four surfaces

| Surface | What it is |
| --- | --- |
| `llms.txt` / `llms-full.txt` | LLM-readable API reference, generated from component JSDoc (llms.txt standard) |
| `.cursorrules` | Cursor IDE rules — imports, API grammar, tokens, do/don't |
| **`urbicon` CLI** (`packages/design`) | **The primary, consumer-facing surface**: one dev-dependency, version-pinned knowledge |
| MCP server (`packages/mcp-server`) | A thin remote adapter over the same engine and content |

## The `urbicon` CLI

One dev-dependency, so the knowledge a project gets is pinned to the version it installed.

- **Knowledge** — `primer` (the always-needed bundle: component selection plus the token
  core, one call, run first), `find`, `get-component`, `icons`, `recipe`, `guide` (bundled
  package guides: auth reference, blocks guide system, A2UI, variant contract, table scroll
  models), `pattern`, `principles` (`--topic`, `--rubric`), `css-reference`.
- **Judgment** — `validate`, plus `hook` and the CI entry point.
- **Memory** — `context`, `record-decision`, `sync-manifest`.
- **Process** — `verbs` / `verb <name>`, plus the `urbicon-design` skill.
- **Onboarding** — `init`: writes the AGENTS.md block, scaffolds the manifest, optionally
  `--hook` / `--ci`.

`init` details worth knowing before changing it:

- `--with-primer` (default on) adds the "load the primer" step. The shipped template
  deliberately omits it, so a harness that injects the primer itself can take the template
  verbatim.
- The block is stamped with the CLI version, and a plain re-run refreshes it in place
  wherever it lives — AGENTS.md or CLAUDE.md, any casing.
- `context` warns when the block no longer matches the installed template. The check is
  content-based, so a version bump without a template change stays quiet.
- Customised hook entries and CI workflows are kept and reported, never overwritten.

## MCP server

Streamable HTTP, 10 read-only tools, 10 verb prompts, 7 guide resources — all over the same
engine and content the CLI uses.

**Deliberately not advertised or hosted pre-launch** (Option B, 2026-07-10): the package
track is the story, and hosting the public endpoint is a launch decision. The package stays
in the repo and green. No local-install path is documented anywhere — the old `bunx`-stdio
setup on `/ai` was removed. Manifest read and write live in the CLI, never on the stateless
server.

## Design System Intelligence

`design-system/` holds layers 4 and 5 of the five-layer design model:

- `principles.md` — heuristics, paradigm profiles, the change decision tree
- `patterns/*.md` — composition patterns: settings page, dashboard, form page, tab
  navigation, onboarding guide

Served locally by `urbicon principles` / `urbicon pattern`, remotely by
`get_design_principles` / `get_pattern`, both out of the `design-content` bundle.

## The closed design loop

Serving knowledge is only half of it. The loop is generate → validate → judge → synthesise:

- **`urbicon validate`** (= remote `validate_design`, same engine) lints generated markup:
  deterministic rules, a token whitelist, heuristics.
- **`data-design-pattern` markers + `design.manifest.md`** persist design intent per
  consumer project, maintained consumer-side through `context` / `record-decision` /
  `sync-manifest`.
- **`urbicon principles --rubric`** serves the 1–5 judge rubric.
- **The design verbs** — onboard, adopt, compose, redesign, polish, critique, fix, retheme,
  audit, migrate — ship both as the local skill in `@urbicon-ui/design` and as MCP prompts,
  from the same text.
- **Enforcement is local**: a `PostToolUse` hook (`urbicon hook`) and CI (`urbicon validate`)
  turn the loop from advisory into required. Correctness always gates; the craft axis is
  opt-in via `--craft-floor`. Templates ship under `@urbicon-ui/design/templates`.

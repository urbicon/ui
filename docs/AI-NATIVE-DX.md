# AI-Native DX

How this library makes itself usable by an agent: what is served, from where, and which
surface is the one consumers actually install.

## The four surfaces

| Surface | What it is |
| --- | --- |
| `llms.txt` | Brief library overview (llms.txt standard) — generated from the component catalog + a small template, tracked, checked by `llms:check` |
| `llms-full.txt` | Complete API reference with examples, tokens and patterns — generated |
| **`urbicon` CLI** (`packages/design`) | **The primary, consumer-facing surface**: one dev-dependency, version-pinned knowledge |
| MCP server (`packages/mcp-server`) | A thin remote adapter over the same engine and content — deployed, not advertised, being retired |

## The `urbicon` CLI

One dev-dependency, so the knowledge a project gets is pinned to the version it installed.

- **Knowledge** — `primer` (the always-needed bundle: component selection plus the token
  core, the override ladder and the link-as-button recipe, one call, run first), `find`,
  `get-component`, `icons`, `recipe`, `guide` (the bundled package guides — reference,
  migration and integration docs shipped in the package tarballs; `--help` and a bare `guide`
  list them from the bundle's index), `pattern`, `principles` (`--topic`, `--rubric`),
  `css-reference`.
- **Judgment** — `validate`, plus `hook` and the CI entry point.
- **Memory** — `context`, `record-decision`, `sync-manifest`.
- **Process** — `verbs` / `verb <name>`, plus the `urbicon-design` skill.
- **Onboarding** — `init`: writes the AGENTS.md block, wires CLAUDE.md to it, scaffolds the
  manifest, optionally `--hook` / `--ci`.

`init` details worth knowing before changing it:

- `--claude-md` (default on) exists because Claude Code loads `CLAUDE.md` and does not read
  `AGENTS.md` on its own. `init` creates a `CLAUDE.md` carrying an `@AGENTS.md` import, or
  prepends the import to an existing one; a `CLAUDE.md` symlinked to `AGENTS.md` already
  delivers and is left alone. A prose mention of AGENTS.md does not count as delivery.
  `--claude-md=false` is for a harness that delivers the block itself.
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

**Deployed, not advertised, and being retired** (#500): `.github/workflows/deploy.yml` ships
it to the host, but no page names the endpoint, and next to the CLI it has no use case of its
own. Until it is removed it stays in the repo and green. No local-install **consumer** path is
documented anywhere — the stdio entry in the package README runs the server from a repo
checkout, for working on it. Manifest read and write live in the CLI, never on the stateless
server. Why: [DECISIONS.md](DECISIONS.md#the-mcp-server-is-deployed-not-advertised-and-being-retired).

## Design System Intelligence

The design model has five layers: **1 Foundation** tokens (raw OKLCH palettes, radius scale,
z-index), **2 Semantic** tokens (surface, text, border, intent), **3 Component** (variant
defaults, slot classes, presets), **4 Composition** (page layout and arrangement) and
**5 Principles** (heuristics, selection rules). The asymmetry between them shapes the design
loop: **tokens propagate through code, patterns only through knowledge.** Change something in
layers 1–3 and everything above it follows through CSS custom properties and `tv()`. Change a
pattern or a principle and nothing moves until an agent finds every page that followed it —
which is why pattern usage is marked in the code (`data-design-pattern`) and indexed in the
manifest (see the design loop below). The layer table and the change decision tree live in
`design-system/principles.md`.

`design-system/` holds layers 4 and 5:

- `principles.md` — heuristics, paradigm profiles, the change decision tree
- `patterns/*.md` — composition patterns, one file per page archetype; `urbicon pattern`
  with no name lists what the bundle ships

Served by `urbicon principles` / `urbicon pattern` out of the `design-content` bundle (and,
until its removal, by the MCP tools `get_design_principles` / `get_pattern`).

## The design loop

Serving knowledge is only half of it. The loop is generate → validate → judge → synthesise:

- **`urbicon validate`** lints generated markup: deterministic rules, a token whitelist,
  heuristics (the MCP tool `validate_design` runs the same engine).
- **`data-design-pattern` markers + `design.manifest.md`** persist design intent per
  consumer project, maintained consumer-side through `context` / `record-decision` /
  `sync-manifest`.
- **`urbicon principles --rubric`** serves the 1–5 judge rubric.
- **The design verbs** — onboard, adopt, compose, redesign, polish, critique, fix, retheme,
  audit, migrate — ship as the local skill in `@urbicon-ui/design` (and, from the same text,
  as MCP prompts until the server is removed).
- **Enforcement is local**: a `PostToolUse` hook (`urbicon hook`) and CI (`urbicon validate`)
  turn the loop from advisory into required. Correctness always gates; the craft axis is
  opt-in via `--craft-floor`. Templates ship under `@urbicon-ui/design/templates`.

**What it is measured to do — and not to do.** Blind-judged A/B runs (2026-08, waves 1–3 plus
the replication of 2026-08-18) support one claim: the loop holds generated markup on the token
system. On a budget model, the run reading the installed package on its own produced hundreds
of linter findings where the wired run produced a clean `validate`. Three things it does
**not** do, each measured rather than assumed: it does not raise design-craft scores on any
model tier — adding the visual-hierarchy principle to the primer did not lift the `hierarchy`
score either (a single A/B run, in which an unpatched arm matched it), so `CORE_PRINCIPLES` in
the primer stays small; it does not make runs cheaper (two independent pairs, no advantage
either time); and a clean gate is not the same as correct. The token check knows the
library's own roots — `text-on-surface-muted` or `bg-surface-made-up` fails — but a colour
class on a root it does not know, such as `bg-made-up-token`, passes, because it cannot be
told apart from a project's own colour. Public claims are held to this list.

# @urbicon-ui/design

The **`urbicon` CLI** — version-pinned design validation and design-manifest
tooling for projects built with [Urbicon UI](https://ui.urbicon.de).

It is the local, version-correct half of the Urbicon design loop: the knowledge
and rules are the ones shipped with the `@urbicon-ui/*` version you installed, and
the filesystem operations (reading/writing your project's `design.manifest.md`)
run on your machine — things a public, stateless remote MCP server structurally
cannot do. Under the hood it wraps the zero-dependency
[`@urbicon-ui/design-engine`](../design-engine/); the same engine backs the remote
`validate_design` MCP tool, so local and remote verdicts agree.

## Install

```bash
bun add -d @urbicon-ui/design   # dev tooling — not a runtime dependency
```

This exposes the `urbicon` command (a self-contained, Node-runnable bundle — no
Bun required at the consumer side).

> **Running it standalone (no local install).** The bin is `urbicon` but the package
> is `@urbicon-ui/design`, so a bare `bunx urbicon …` from a project that hasn't
> installed it fails with `GET …/urbicon 404` (it looks for a package literally named
> `urbicon`). To run the CLI without a local install, name both the package and the bin:
>
> ```bash
> bunx --package @urbicon-ui/design urbicon validate src/   # or: npx --package @urbicon-ui/design urbicon …
> ```
>
> Inside a project that already has `@urbicon-ui/design` installed, plain `bunx urbicon …` resolves fine.

## Onboarding a consumer project

```bash
bun add -d @urbicon-ui/design   # then:
bunx urbicon init               # wire the project into the design loop
```

`urbicon init` is idempotent and non-destructive. It:

1. **Gives the agent context** — inserts a managed `<!-- urbicon:start … -->` block into
   `AGENTS.md` (or `--agents-file CLAUDE.md`) describing the tools, the design loop, and the
   token rules. The single biggest lever on whether generated UI stays on-system.
2. **Seeds the design memory** — scaffolds `design.manifest.md` (never overwriting an existing one).
3. With `--hook`, merges the PostToolUse [gate](#enforcement--hook--ci) into `.claude/settings.json`;
   with `--ci`, writes the design-gate workflow.

Then run the guided intake — `bunx urbicon verb adopt` (brownfield) or `onboard` (greenfield) —
to fill the manifest with this project's design intent. From there an agent can `urbicon context`
to read the intent, `urbicon find` / `get-component` to discover the catalog, `urbicon pattern` /
`principles` / `css-reference` for the design knowledge, compose, and `urbicon validate` what it
produced.

> The component knowledge is **local and version-pinned**: `@urbicon-ui/design` pulls in the
> [`@urbicon-ui/design-content`](../design-content/) bundle, so `find` / `get-component` match the
> library version you installed — no extra install, no skew against the latest-only hosted MCP.

## Commands

| Command | What it does | Replaces (remote) |
| --- | --- | --- |
| `urbicon init` | Wire a project into the design loop (AGENTS.md block, manifest scaffold, `--hook`/`--ci`). | — (local only) |
| `urbicon validate [paths...]` | Lint `.svelte` markup against the design rules. The CI gate. | mirror of `validate_design` |
| `urbicon i18n [check]` | Audit `@urbicon-ui/i18n`: `parity` / `unused` keys / `hardcoded` strings / `audit` (all). | — (local only) |
| `urbicon hook` | PostToolUse adapter — validate the just-edited file, block on failure. | — (local only) |
| `urbicon find [query]` | Fuzzy component discovery over the version-pinned catalog. | `find_components` |
| `urbicon get-component <slug>` | A component's API (its `llm.txt`) from the bundle. | `get_component` |
| `urbicon icons [query]` | Icon discovery (no query: the full grouped reference). | `find_icons` |
| `urbicon recipe [id]` | Complete Svelte 5 code recipes from the catalog. | `get_recipe` |
| `urbicon pattern [name]` | Composition patterns per page archetype. | `get_pattern` |
| `urbicon principles` | Design heuristics (`--topic <t>`); `--rubric` for the judge rubric. | `get_design_principles` |
| `urbicon css-reference [sect]` | The token truth: naming, dark mode, override patterns. | `get_css_reference` |
| `urbicon context` | Print the project's `design.manifest.md` summary. | `get_design_context` |
| `urbicon record-decision …` | Append an ADR to the manifest. | `record_design_decision` |
| `urbicon sync-manifest` | Re-index `data-design-pattern` markers into the manifest. | `sync_design_manifest` |
| `urbicon verbs` | List the design verbs (recipes over the design loop). | the MCP prompts |
| `urbicon verb <name>` | Print one verb recipe to stdout. | the MCP prompts |

The CLI covers the full knowledge surface locally, so the design loop runs
offline and version-pinned end to end. When an `urbicon-ui` MCP connection is
*also* present, prefer the CLI: the remote serves latest, the CLI serves the
version this project installed.

The three manifest commands move off the remote server deliberately: a public
remote server has no access to your repo's filesystem, so manifest upkeep belongs
on the consumer side (this CLI, or the agent's own write tools). See
[docs/internal/DESIGN-MCP-V2.md](../../docs/internal/DESIGN-MCP-V2.md).

### validate

```bash
urbicon validate src/                    # lint a whole tree (CI)
urbicon validate App.svelte --strict     # fail on warnings too, not just errors
urbicon validate src/ --slop-floor 40    # also fail files scoring < 40/100 on slop
cat Page.svelte | urbicon validate -     # lint stdin
urbicon validate src/ --json             # machine-readable: { ok, slopFloor, results }
urbicon validate src/ --record           # also append a drift entry to the history (CI)
```

`validate` reads `## Token Overrides` from your `design.manifest.md` (if present)
and treats those token cores as valid, so a token your project defines on top of
Urbicon's is not flagged as hallucinated — the local, manifest-sourced counterpart
to the remote `validate_design(extraTokens)`. It only relaxes the
token-hallucination warning, never the error gates. `--record` appends one
`ValidationHistoryEntry` per run to the sidecar `design.manifest.history.ndjson`
so drift is measurable over time (CI opts in; the editor hook stays silent).

The linter scores two independent axes (DESIGN-MCP-V2 §6): **correctness** (raw
colours, `dark:`/`focus:`, hallucinated tokens — deterministic, always the
blocking gate) and **slop** (20 "looks generic" heuristics — advisory by default,
because they are FP-prone). `--slop-floor <n>` opts the slop axis into the gate:
any file scoring below `n` fails, checked per file so one generic page cannot hide
behind clean ones. Leave it off and slop stays informational.

Exit codes — designed for hooks and CI:

| Code | Meaning |
| --- | --- |
| `0` | Clean, or only warnings/notes |
| `1` | Failed — `validate` found errors (with `--strict`, warnings too), or a command could not complete (e.g. a manifest write error) |
| `2` | Usage error — bad flags / unreadable input |

`--skip-heuristics` runs only the deterministic rules (no distribution notes).

### i18n

Audit `@urbicon-ui/i18n` usage — one check, or `audit` for all. Run under Bun (it
dynamic-imports `.ts` locale bundles).

```bash
urbicon i18n audit src/ --translations src/lib/translations  # parity + unused + hardcoded
urbicon i18n parity --json                                   # data-level locale audit only
urbicon i18n unused --dynamic-keys 'errors.*'                # scan, allowlisting dynamic key families
urbicon i18n hardcoded src/ --strict                         # gate the advisory hardcoded-string lint too
```

| Check | Finds | Gates? |
| --- | --- | --- |
| `parity` | missing/extra keys, empty values, `{{param}}` drift, malformed/incomplete `_plural` | errors gate |
| `unused` | defined keys referenced nowhere (`confirmed`/`suspect`) + keys used-but-undefined | used-but-undefined gates; unused advisory |
| `hardcoded` | literal UI copy in `.svelte` markup that bypassed i18n | advisory (gate with `--strict`) |

Config via `i18n.audit.json` / `--config` + flags (`--translations`, `--dynamic-keys`,
`--ignore-keys`, `--ignore-strings`, `--base-locale`); `--json` for CI. Backed by the
`@urbicon-ui/i18n/audit` subpath; the pure data-level `auditTranslations` also runs as a
Vitest assertion without the CLI.

### context / record-decision / sync-manifest

```bash
urbicon context                       # summarise ./design.manifest.md
urbicon context --json                # the parsed manifest (+ history) as JSON

urbicon record-decision \
  --title "Tabs for settings" \
  --decision "Use Tab over Sidebar" \
  --rationale "Three groups, shallow nesting"

urbicon sync-manifest                 # scan ./src for data-design-pattern markers
urbicon sync-manifest --src app --manifest app/design.manifest.md
```

`context` summarises the whole manifest — the product intent (audience, voice,
references, anti-references), the token overrides, the pattern-usage index, the
recorded ADRs — and, when a `*.history.ndjson` sidecar exists, the recent
validation-drift trend. All commands default the manifest to
`./design.manifest.md` and the scan root to `./src`; override with `--manifest`
/ `--src`.

The manifest is a plain Markdown file with these sections (`urbicon` creates a
scaffold on first write):

```markdown
## Product Intent
**Audience:** who uses this — context, constraints, expertise
**Voice:** three adjectives, comma-separated
**References:** / **Anti-references:** bullet (or comma) lists

## Token Overrides
- `surface-brand`   # project tokens `urbicon validate` should accept

## Pattern Usages    # auto-generated by sync-manifest
## Design Decisions  # append-only ADRs from record-decision
```

## Design verbs

Ten recipes that string the knowledge, the linter, and the manifest into one loop —
the same single source served remotely as MCP prompts (DESIGN-MCP-V2 §8). They ship
in this package under `skill/`, so they run offline and version-locked.

```bash
urbicon verbs            # list them
urbicon verb compose     # print one recipe — pipe it to an agent, or read it inline
```

| Verb | Use-case |
| --- | --- |
| `onboard` / `adopt` | seed the manifest for a greenfield / brownfield project |
| `compose` / `redesign` / `polish` | build / rework / tighten a page (gated on linter + rubric) |
| `critique` / `fix` | judge without changing / repair correctness defects |
| `retheme` / `audit` / `migrate` | rebrand / check consistency / roll out a change app-wide |

`skill/SKILL.md` is the router (intent → verb). Every recipe opens by reading the
manifest and closes by writing the decision back.

## Enforcement — hook + CI

The gate runs in two places a stateless remote server structurally cannot reach:
at edit time (a Claude Code hook) and in CI. Ready-to-copy templates ship in
[`templates/`](./templates/).

**Edit-time hook.** Wire `urbicon hook` as a `PostToolUse` hook so every edited
`.svelte` file is validated the moment it is written — the loop becomes enforced,
not something the agent must remember. On a failure the hook exits 2 and the
findings are fed back to the agent to fix; a clean edit is silent. Merge
[`templates/claude-settings.json`](./templates/claude-settings.json) into your
`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|MultiEdit|Write", "hooks": [{ "type": "command", "command": "urbicon hook" }] }
    ]
  }
}
```

Add `--slop-floor 40` to the command to gate the slop axis too. (`urbicon hook`
reads the edited path from the hook event on stdin — it does not take path
arguments.)

**CI.** Run `urbicon validate` over your source tree; a non-zero exit fails the
build. Copy [`templates/ci-github.yml`](./templates/ci-github.yml), or add one step
to an existing workflow:

```bash
bunx urbicon validate src/ --json              # correctness gate (blocking)
# add --slop-floor 40 to also gate the slop axis — one run, correctness is always on
```

## Notes

- Bundled to `dist/cli.js` at publish time (`bun build --target node`, shebang
  preserved). In the monorepo, run the TypeScript source directly:
  `bun run packages/design/src/cli/index.ts <command>`.
- `validate` / `hook` / `context` / `record-decision` / `sync-manifest` / `init` are
  content-free (engine + your repo only); `verbs` / `verb` read the recipes shipped
  under `skill/` (package-relative, still no content-bundle dependency);
  `css-reference` and `principles --rubric` come straight from the engine.
- `find` / `get-component` / `icons` / `recipe` / `pattern` / `principles` read the
  version-pinned [`@urbicon-ui/design-content`](../design-content/) bundle (a runtime
  dependency). The guided onboarding *interview* lives in the `adopt` / `onboard` verbs.

## Related

- [`@urbicon-ui/design-engine`](../design-engine/) — the deterministic engine this CLI wraps
- [`@urbicon-ui/mcp-server`](../mcp-server/) — the remote MCP adapter over the same engine

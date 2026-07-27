/**
 * `urbicon --help`.
 *
 * Its own module, not `index.ts`: that file runs `main()` + `process.exit()` at
 * import time, so while the help string lived there no test could import it —
 * which is how the `css-reference` section list went stale (the CLI advertised six
 * sections after `typography` became the seventh, and the guard that should have
 * caught it only checked the engine's overview). The section list is derived from
 * CSS_REFERENCE_SECTION_NAMES, never authored, so it cannot drift again.
 */

import { CSS_REFERENCE_SECTION_NAMES } from '@urbicon-ui/design-engine/reference';

/** Column the command descriptions start at, and the width the help wraps to. */
const DESC_INDENT = 24;
const HELP_WIDTH = 96;

/**
 * Join `items` with ` | ` over as many lines as needed, indenting continuations to
 * `indent`. Derived content has no author-known width, so it must wrap itself.
 */
function wrapJoined(items: readonly string[], indent: number, width: number): string {
  const lines: string[] = [];
  let line = '';
  for (const item of items) {
    const candidate = line ? `${line} | ${item}` : item;
    if (line && indent + candidate.length > width) {
      lines.push(`${line} |`);
      line = item;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join(`\n${' '.repeat(indent)}`);
}

/** The advertised `css-reference` sections — exactly the ones the command accepts. */
export const CSS_REFERENCE_SECTION_LIST = wrapJoined(
  CSS_REFERENCE_SECTION_NAMES,
  DESC_INDENT + 'Sections: '.length,
  HELP_WIDTH
);

export const HELP = `urbicon — design validation & manifest tooling for Urbicon UI projects

Usage:
  urbicon <command> [options]

Commands:
  init                  Wire this project into the design loop: insert the AGENTS.md
                        context block + scaffold design.manifest.md, then print next
                        steps. Idempotent and non-destructive.
                        --hook             Also merge the PostToolUse gate into
                                           .claude/settings.json.
                        --ci               Also write .github/workflows/design-gate.yml.
                        --agents-file <p>  Target for the context block (default AGENTS.md).
                        --manifest <path>  Manifest path (default ./design.manifest.md).
                        --with-primer      Include the "load the primer" step (default on).
                                           Use --with-primer=false when the block feeds a
                                           harness that injects the primer itself.
  validate [paths...]   Lint .svelte markup against the Urbicon UI design rules.
                        Paths may be files, directories, or "-" (stdin).
                        Reads ## Token Overrides from the manifest (if any) so your
                        project's own tokens are not flagged as hallucinated.
                        Class rules scan class attributes / slotClasses / tv()
                        literals — prose that merely quotes an anti-pattern
                        (docs, before/after guides) is not flagged.
                        Deliberately off-system surfaces can be exempted per rule:
                        in-file <!-- urbicon-ignore rule-id … — reason --> or a
                        manifest ## Exempt bullet ("path" — "rule-id" — reason).
                        Suppressions are always reported ("n suppressed"), never
                        silent; unknown rule ids warn (invalid-suppression).
                        --json             Machine-readable report ({ ok, slopFloor, results }).
                        --strict           Fail on warnings too, not just errors.
                        --slop-floor <n>   Also fail any file scoring below n/100 on the
                                           slop axis (0–100; off by default — slop is advisory).
                        --skip-heuristics  Deterministic rules only (no distribution notes).
                        --record           Append a drift entry to the sidecar history (CI).
                        --manifest <path>  Manifest for token overrides + history
                                           (default ./design.manifest.md).
  hook                  Editor-hook adapter: read a Claude Code PostToolUse event on
                        stdin, validate the edited .svelte file, and exit 2 with the
                        findings on stderr so the agent self-corrects.
                        Wire it via .claude/settings.json (see templates/).
                        --strict           Fail on warnings too, not just errors.
                        --slop-floor <n>   Also fail below n/100 on the slop axis.
                        --skip-heuristics  Deterministic rules only.
                        --manifest <path>  Manifest for token overrides
                                           (default ./design.manifest.md).
  find [query]          Discover components by fuzzy search over the version-pinned
                        catalog (names, tags, descriptions). No query lists all.
                        --tag <t>          Filter by category tag (form, action, …).
                        --limit <n>        Max results for a query (default 10).
                        --json             Machine-readable catalog entries.
  get-component <slug>  Print a component's API (its llm.txt) from the bundle.
                        --section <s>      overview | examples | variants | api | slots |
                                           full (default: full).
  primer                The knowledge every task needs, in one call: how to pick a
                        component + the token reference (surfaces, text, borders,
                        intents, shadows). Run it first. Patterns, recipes and
                        component APIs stay on demand — they are task-dependent.
  pattern [name]        Composition patterns (settings-page, dashboard, …). No name
                        lists all; a name prints the full pattern.
                        --json             Machine-readable pattern list.
  principles            The design heuristics (visual hierarchy, interaction, layout,
                        theming, …) from the version-pinned bundle.
                        --topic <t>        visual-hierarchy | interaction |
                                           component-selection | layout | accessibility |
                                           theming.
                        --rubric           Print the 8-criterion 1–5 scoring rubric
                                           instead (the judge step; ignores --topic).
  css-reference [sect]  CSS token reference: naming, dark mode, override patterns.
                        No section prints the overview.
                        Sections: ${CSS_REFERENCE_SECTION_LIST}
  icons [query]         Icon discovery. A query ranks matches; no query prints the
                        full reference grouped by category.
                        --limit <n>        Max results for a query (default 20).
                        --json             Machine-readable icon entries.
  recipe [id]           Complete Svelte 5 code recipes from the catalog. No id lists
                        all; an id prints the full recipe (incl. code).
                        --json             Machine-readable recipe (or list).
  guide [slug]          Package guides from the version-pinned bundle (auth
                        reference, blocks guide system, migration notes, table
                        scroll models). No slug lists all; a slug prints the guide.
                        --json             Machine-readable guide list.
  context               Print the project's design.manifest.md summary.
                        --manifest <path>  Manifest file (default ./design.manifest.md).
                        --json             Emit the parsed manifest as JSON.
  record-decision       Append an ADR to the manifest.
                        --title <t>        (required) Short decision title.
                        --decision <d>     (required) What was decided.
                        --rationale <r>    Why — the trade-off.
                        --status <s>       accepted | proposed | superseded (default accepted).
                        --date <date>      Decision date, YYYY-MM-DD (default today).
                        --manifest <path>  Manifest file (default ./design.manifest.md).
  sync-manifest         Re-index data-design-pattern markers into the manifest.
                        --src <dir>        Source tree to scan (default ./src).
                        --manifest <path>  Manifest file (default ./design.manifest.md).
                        --json             Emit the scan result as JSON.
  i18n [check] [dirs…]  Audit @urbicon-ui/i18n usage. check = parity | unused |
                        hardcoded | audit (all, default). Run under Bun.
                        --translations <d> Locale-bundle dir(s), comma-separated
                                           (default src/lib/translations).
                        --config <path>    i18n.audit.json (default ./i18n.audit.json).
                        --dynamic-keys <g> Key globs built dynamically (errors.*).
                        --ignore-keys <g>  Key globs to skip entirely.
                        --ignore-strings <g> Hardcoded-string globs to skip.
                        --function-names <n> Translate-function names to scan for,
                                           comma-separated (default t, dt).
                        --runtime-usage <p> JSON array of keys observed at runtime;
                                           they count as used even if no call site
                                           mentions them literally.
                        --base-locale <l>  Parity base (default en).
                        --json             Machine-readable report.
                        --strict           Gate on advisory findings too.
                        Gates on parity errors + used-but-undefined; unused,
                        hardcoded and parity warnings are advisory.
  verbs                 List the design verbs (recipes over the design loop).
  verb <name>           Print one verb recipe, e.g. "urbicon verb compose".
  help                  Show this help.

Exit codes:
  0  ok (clean, or only warnings/notes)
  1  failed — validate found errors (--strict: warnings too), or a command could not complete
  2  usage error — bad flags / unreadable input

Examples:
  urbicon validate src/                          # CI: lint a whole tree
  urbicon validate src/ --slop-floor 40 --json   # CI: gate correctness + slop
  urbicon validate App.svelte --strict           # fail on warnings too
  cat Page.svelte | urbicon validate -           # lint stdin
  urbicon record-decision --title "Tabs for settings" --decision "Use Tab over Sidebar"
`;

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

/** A line that opens a command entry: two spaces, then the command name. */
function opensCommand(line: string): boolean {
  return /^ {2}\S/.test(line);
}

/** The command name a `Commands:` line opens, or undefined. */
function commandOn(line: string): string | undefined {
  if (!opensCommand(line)) return undefined;
  return line.slice(2).split(/[\s[<]/)[0] || undefined;
}

/**
 * The help for a single command — its entry plus the indented flag lines under it.
 *
 * `urbicon <command> --help` used to print the whole 9.5 kB page: measured, a model
 * that wanted `record-decision`'s flags got the full page, learned nothing from it,
 * and spent a second call grepping the command list to find them. One command's
 * block is ~300 B and answers the question that was asked.
 *
 * Sliced out of HELP rather than authored separately — a second copy of the flag
 * text is a second thing to keep in sync, which is exactly how the `css-reference`
 * section list went stale before.
 */
export function commandHelp(command: string): string | undefined {
  const lines = HELP.split('\n');
  const start = lines.findIndex((line) => commandOn(line) === command);
  if (start === -1) return undefined;
  // Runs to the next command entry or the blank line that ends the Commands
  // section — whichever comes first.
  let end = start + 1;
  for (; end < lines.length; end++) {
    const line = lines[end];
    if (line === undefined || line === '' || opensCommand(line)) break;
  }
  return lines.slice(start, end).join('\n');
}

export const HELP = `urbicon — design validation & manifest tooling for Urbicon UI projects

Usage:
  urbicon <command> [options]

Commands — knowledge (what to build with):
  primer                The knowledge every task needs, in one call: how to pick a
                        component + the token reference (surfaces, text, borders,
                        intents, shadows). Run it first. Patterns, recipes and
                        component APIs stay on demand — they are task-dependent.
  find [query]          Discover components by fuzzy search over the version-pinned
                        catalog (names, tags, descriptions). No query lists all.
                        --tag <t>          Filter by category tag (form, action, …).
                        --limit <n>        Max results (default 10; also caps a full list).
                        --json             Machine-readable catalog entries.
  get-component <slug…> Print a component's API (its llm.txt) from the bundle.
                        Takes several slugs — one call for a whole screen's worth.
                        --section <s>      overview | examples | variants | api | slots |
                                           full (default: full). Applies to every slug.
  pattern [name]        Composition patterns (settings-page, dashboard, …). No name
                        lists all; a name prints the full pattern.
                        --json             Machine-readable pattern list.
  recipe [id]           Complete Svelte 5 code recipes from the catalog. No id lists
                        all; an id prints the full recipe (incl. code).
                        --json             Machine-readable recipe (or list).
  icons [query]         Icon discovery. A query ranks matches; no query prints the
                        full reference grouped by category.
                        --limit <n>        Max results (default 20; also caps the full list).
                        --json             Machine-readable icon entries.
  css-reference [sect]  CSS token reference: naming, dark mode, override patterns.
                        No section prints the overview.
                        Sections: ${CSS_REFERENCE_SECTION_LIST}
  principles            The design heuristics (visual hierarchy, interaction, layout,
                        theming, …) from the version-pinned bundle.
                        --topic <t>        visual-hierarchy | interaction |
                                           component-selection | layout | accessibility |
                                           theming.
                        --rubric           Print the 8-criterion 1–5 scoring rubric
                                           instead (the judge step; ignores --topic).
  guide [slug]          Package guides from the version-pinned bundle (auth
                        reference, blocks guide system, migration notes, table
                        scroll models). No slug lists all; a slug prints the guide.
                        --json             Machine-readable guide list.

Commands — judgment (is what you built right):
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
                        --json             Machine-readable report ({ ok, craftFloor, results }).
                        --strict           Fail on warnings too, not just errors.
                        --craft-floor <n>  Also fail any file scoring below n/100 on the
                                           craft axis (0–100; off by default — craft is advisory).
                        --skip-heuristics  Deterministic rules only (no distribution notes).
                        --record           Append a drift entry to the sidecar history (CI).
                        --manifest <path>  Manifest for token overrides + history
                                           (default ./design.manifest.md).
  hook                  Editor-hook adapter: read a Claude Code PostToolUse event on
                        stdin, validate the edited .svelte file, and exit 2 with the
                        findings on stderr so the agent self-corrects.
                        Wire it via .claude/settings.json (see templates/).
                        --strict           Fail on warnings too, not just errors.
                        --craft-floor <n>  Also fail below n/100 on the craft axis.
                        --skip-heuristics  Deterministic rules only.
                        --manifest <path>  Manifest for token overrides
                                           (default ./design.manifest.md).
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

Commands — memory (what this project already decided):
  context               Print the project's design.manifest.md summary. Warns when
                        the init context block no longer matches the installed
                        CLI's template.
                        --manifest <path>  Manifest file (default ./design.manifest.md).
                        --json             Emit the parsed manifest as JSON (incl.
                                           contextBlock staleness).
  record-decision       Append an ADR to the manifest.
                        --title <t>        (required) Short decision title.
                        --decision <d>     (required) What was decided.
                        --rationale <r>    Why — the trade-off.
                        --status <s>       accepted | proposed | superseded (default accepted);
                                           superseded entries leave "context"'s active list.
                        --supersedes <t>   Title of the decision this one replaces — marks it
                                           superseded and links both ends.
                        --date <date>      Decision date, YYYY-MM-DD (default today; the log
                                           is ordered by date).
                        --manifest <path>  Manifest file (default ./design.manifest.md).
  sync-manifest         Re-index data-design-pattern markers into the manifest.
                        --src <dir>        Source tree to scan (default ./src).
                        --manifest <path>  Manifest file (default ./design.manifest.md).
                        --json             Emit the scan result as JSON.

Commands — process & setup:
  verbs                 List the design verbs (recipes over the design loop).
  verb <name>           Print one verb recipe, e.g. "urbicon verb compose".
  init                  Wire this project into the design loop: insert the AGENTS.md
                        context block + scaffold design.manifest.md, wire CLAUDE.md to
                        import it, then print next steps. Idempotent and
                        non-destructive: re-runs refresh the block in place (wherever
                        it lives — AGENTS.md or CLAUDE.md) and stamp it with the CLI
                        version; customised hook/CI files are kept and reported,
                        never overwritten.
                        --hook             Also merge the PostToolUse gate into
                                           .claude/settings.json.
                        --ci               Also write .github/workflows/design-gate.yml.
                        --agents-file <p>  Target for the context block (default AGENTS.md).
                        --manifest <path>  Manifest path (default ./design.manifest.md).
                        --claude-md        Wire CLAUDE.md to "@AGENTS.md" so Claude Code
                                           loads the block (default on). Claude Code does
                                           not read AGENTS.md on its own — without this the
                                           block only reaches the agent by accident. Use
                                           --claude-md=false when your harness delivers it.
                        --with-primer      Include the "load the primer" step (default on).
                                           Use --with-primer=false when the block feeds a
                                           harness that injects the primer itself.
  version               Print the installed @urbicon-ui/design version.
  help                  Show this help. "urbicon help <command>" (or "<command> --help")
                        shows just that command.

Exit codes:
  0  ok (clean, or only warnings/notes)
  1  failed — validate found errors (--strict: warnings too), or a command could not complete
  2  usage error — bad flags / unreadable input

Examples:
  urbicon validate src/                          # CI: lint a whole tree
  urbicon validate src/ --craft-floor 40 --json  # CI: gate correctness + craft
  urbicon validate App.svelte --strict           # fail on warnings too
  cat Page.svelte | urbicon validate -           # lint stdin
  urbicon record-decision --title "Tabs for settings" --decision "Use Tab over Sidebar"
`;

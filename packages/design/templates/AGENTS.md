<!-- urbicon:start — Urbicon UI agent context. Managed by `urbicon init`: it inserts and
updates everything between these two markers, so edit *outside* them (or run `init` again
to refresh). Pasting this by hand? Keep the markers if you want `init` to manage it later;
delete them if you don't. -->

## Urbicon UI

This project builds its UI with [Urbicon UI](https://ui.urbicon.de) — Svelte 5 + Tailwind 4
components on a token-based design system. **Compose from the system; don't hand-roll UI or
invent styles.** The `urbicon` CLI (a devDependency, run as `bunx urbicon <command>`) puts the
design system's knowledge, linter and memory at your fingertips — **version-matched to the
library this project installed**, so what it tells you is true of the code you actually have.

### Tools — the `urbicon` CLI

- **Discover & read components** (before you compose):
  - `urbicon find <query>` — fuzzy-search the catalog, e.g. `urbicon find "date range"`.
  - `urbicon get-component <slug>` — a component's real API: props, variants, examples
    (`--section api|examples|variants|slots|full`).
  - `urbicon icons <query>` — icon discovery (no query: the full reference).
  - `urbicon recipe [id]` — complete Svelte 5 code recipes (no id: list them).
- **Design knowledge** (before and while you compose):
  - `urbicon principles [--topic <t>] [--rubric]` — the design heuristics;
    `--topic theming` for paradigms + the change decision tree, `--rubric` for the
    8-criterion scoring rubric (the judge step).
  - `urbicon pattern [name]` — composition patterns per page archetype
    (settings-page, dashboard, form-page, …).
  - `urbicon css-reference [section]` — the token truth: naming, dark mode,
    override patterns (sections: surfaces, text, borders, intents, shadows, theming).
- **Validate** what you generate:
  - `urbicon validate <path>` — lint markup against the design rules; fix every error.
  - `urbicon i18n [check]` — audit `@urbicon-ui/i18n` usage (when the project uses it):
    `parity` (missing/empty/param/plural across locales), `unused` keys, `hardcoded`
    strings, or `audit` (all). Gates on parity errors + keys used-but-undefined.
- **Read & record design intent** (the project's memory):
  - `urbicon context` — the design manifest: paradigm, voice, decisions. Read it first.
  - `urbicon record-decision …` — log a deliberate design choice so the next session sees it.
  - `urbicon sync-manifest` — re-index pattern usages from the code.
- **Whole-task recipes** — `urbicon verbs` / `urbicon verb <name>` (also a `/`-skill,
  `urbicon-design`, if installed).

The CLI covers the full knowledge surface locally. The hosted knowledge at
<https://ui.urbicon.de> (and the `urbicon-ui` MCP server, if your client happens to have it
connected) serves **latest**, not this project's version — so even when both are available,
**use the CLI**: it matches the installed library, and on any disagreement the CLI is right.
The MCP tools are for contexts without a local install (e.g. evaluating the library).

### How to work — the design loop

1. **Read the intent** — `urbicon context`. This is what keeps output consistent with *this*
   product instead of generic.
2. **Discover** — `urbicon find` / `get-component` for the right component and its real API.
3. **Compose** from real components + semantic tokens (rules below).
4. **Validate** — `urbicon validate`; fix every correctness error before shipping. (Slop notes
   are advisory — raise them when it's cheap.)
5. **Write the decision back** — `urbicon record-decision` for a deliberate deviation. What the
   next session can't see, it will silently undo.

For a whole task, pick a **verb** (a recipe over that loop): `compose` (new page) ·
`redesign` (rework) · `polish` (tighten) · `fix` (repair tokens) · `critique` / `audit` (judge
without changing) · `retheme` / `migrate` (roll a change out). Prefer the narrowest that fits.

### Hard rules — the linter enforces these

**Import from the package root only** — never a deep/internal path:

```ts
import { Button, Card, Dialog } from '@urbicon-ui/blocks'; // ✓
// import Button from '@urbicon-ui/blocks/primitives/Button/Button.svelte'; // ✗
```

**USE semantic tokens** (the canonical set; `urbicon get-component` shows them in context):

- Surface — `bg-surface-base` / `-elevated` / `-overlay`
- Text — `text-text-primary` / `-secondary` / `-tertiary`
- Border — `border-border-subtle` / `-default`
- Intent — `bg-primary`, `text-primary`, `bg-primary-subtle` (`primary` `secondary` `success` `warning` `danger` `neutral`)
- Elevation / motion / layer — `shadow-[var(--blocks-shadow-sm)]`, `duration-[var(--blocks-duration-fast)]`, `z-[var(--z-modal)]`

**NEVER:**

- `dark:` — semantic tokens already switch via CSS `light-dark()`.
- Hardcoded colours (`bg-white`, `text-neutral-900`, `bg-blue-500`) or invented tokens (`bg-card`, `text-*-foreground`).
- `focus:` — always `focus-visible:` (keyboard-only rings).
- Hardcoded `z-index`, `cubic-bezier`, or duration values.

**Off-palette looks** (brand colour, glass, translucent overlay) → register a **preset** at the
app root and reference it by name; never force colours with inline `!` overrides:

```svelte
<BlocksProvider presets={{ Button: { brand: { slotClasses: { base: 'bg-[var(--brand)] text-white' } } } }}>
  <Button preset="brand">Go</Button>
</BlocksProvider>
```

The full override ladder (weakest → strongest): `class` (root slot only) → instance `slotClasses={{ <slot>: … }}` → `BlocksProvider` `defaults`/`presets` → prop-conditional `overrides` (one variant/intent/state) → `unstyled` + `slotClasses` (strip & rebuild).

**Svelte 5** — `$props()` not `export let`; `{#snippet}` / `{@render}` not `<slot>`; callback props
(`onValueChange`) not `createEventDispatcher`; lowercase DOM events (`onclick`).

<!-- urbicon:end -->

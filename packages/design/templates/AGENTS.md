<!-- urbicon:start — Urbicon UI agent context. Managed by `urbicon init`: it inserts and
updates everything between these two markers, so edit *outside* them (or run `init` again
to refresh). Pasting this by hand? Keep the markers if you want `init` to manage it later;
delete them if you don't. -->

## Urbicon UI

This project builds its UI with [Urbicon UI](https://ui.urbicon.de) — Svelte 5 + Tailwind 4
components on a token-based design system. **Compose from the system; don't hand-roll UI or
invent styles.**

The `urbicon` CLI (a devDependency) is the way in. Run **`bunx urbicon`** with no arguments
for the full command list with flags — it covers component discovery and APIs, icons,
recipes, design principles and patterns, the token reference, the design linter, and this
project's design memory. Its knowledge is **version-matched to the library this project
installed**, so it is true of the code you actually have. If the hosted docs or an
`urbicon-ui` MCP server disagree with the CLI, the CLI is right — they serve *latest*.

### How to work — the design loop

1. **Read the intent** — `bunx urbicon context`. The design manifest holds this product's
   paradigm, voice and past decisions. This is what keeps output consistent with *this*
   product instead of generic. Do this first.
2. **Discover** — `bunx urbicon find <query>`, then `get-component <slug>` for the real API
   (`--section api` when you only need the props). Don't guess props or invent components.
3. **Compose** from real components and semantic tokens. `bunx urbicon css-reference` is the
   token truth; `pattern <name>` gives you the shape of a page archetype.
4. **Validate** — `bunx urbicon validate <path>`. Fix every correctness error before you
   ship. (Slop notes are advisory — take them when they're cheap.)
5. **Write the decision back** — `bunx urbicon record-decision` for a deliberate deviation.
   What the next session can't see, it will silently undo.

For a whole task, run a **verb** — a recipe over that loop (`bunx urbicon verbs` lists them:
compose, redesign, polish, fix, critique, audit, retheme, migrate, onboard, adopt). Prefer
the narrowest one that fits.

### Hard rules

The linter enforces these, but they're cheaper to follow than to repair:

- **Import from the package root only.** `import { Button } from '@urbicon-ui/blocks'` — never
  a deep path like `@urbicon-ui/blocks/primitives/Button/Button.svelte`.
- **No `dark:`** — semantic tokens already switch via CSS `light-dark()`.
- **No hardcoded colours** (`bg-white`, `bg-blue-500`) and **no invented tokens** (`bg-card`,
  `text-*-foreground`). When in doubt: `bunx urbicon css-reference`.
- **`focus-visible:`, never `focus:`** — keyboard-only rings.
- **No hardcoded `z-index`, `cubic-bezier` or durations** — use the token vars.
- **Off-palette looks** (brand colour, glass, translucency) → register a **preset** on
  `BlocksProvider` and reference it by name; never force colours with inline `!` overrides.
- **Svelte 5** — `$props()` not `export let`; `{#snippet}` / `{@render}` not `<slot>`; callback
  props (`onValueChange`) not `createEventDispatcher`; lowercase DOM events (`onclick`).

<!-- urbicon:end -->

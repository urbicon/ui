---
name: docs-recipes
description: Structure of recipe pages and component doc pages in apps/docs. Use when adding or editing a recipe page under apps/docs/src/routes/recipes, or scaffolding a component documentation page.
---

# Recipe pages

Recipe pages in `apps/docs/src/routes/recipes/*/` use structured `meta.ts` files for metadata (title, description, components, features). The `recipeCode` template literal stays in `+page.svelte` for the live preview — and it is a template literal: an unescaped backtick in the snippet is a syntax error, an escaped one is fine. Backslashes double (`\s` in a shown regex is `\\s` in the literal), `<\/script>` escapes the closer, **`<\script` escapes the opener** (Vite lexes .svelte files as HTML when scanning dependencies; a raw `<script` inside the literal starts a phantom module), and there is no string concatenation — one literal. The catalog extractor cooks all of these escapes on emit, so `get_recipe` serves exactly what the code panel displays.

**A shown import must resolve.** Vite's dependency scanner regex-finds import statements even inside the literal and loads `.svelte`-suffixed local paths for real — an import of a file that does not exist (`$lib/HelpTooltip.svelte` as pure display code) fails the ENTIRE dev-server dependency scan with ENOENT, which surfaces as a wall of on-demand-optimize errors on every cold start (2026-08-16). So a second file the recipe shows is a real sibling of the page: the demo imports it (`./HelpTooltip.svelte`), the code panel renders its source via `?raw`, and the shown import in the literal is the same `./` path. That also makes the file single-source — panel and demo cannot drift.

**The main literal MUST be named `recipeCode`.** `MCPCatalogAssembler` extracts exactly one `const recipeCode` per page; any other name silently drops the recipe's code from `get_recipe` (found on the 2026-08-16 rollout: three pages had drifted out of the catalog this way). Secondary literals (a hook file, a server route, extra variants) take other names and stay catalog-invisible — name their facts in `meta.features` so an agent knows they exist.

## Canonical page structure (since 2026-08; `table-detail` is the model)

```svelte
<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample title="<Name>Page.svelte" description="…" code={recipeCode} headingLevel={2}>
      <!-- the live demo -->
    </CodeExample>
  </Section>
  <Section id="decisions" title="…">   <!-- 2–3 Notes: only what demo + code cannot say -->
</RecipeShell>
```

- `RecipeShell` supplies SeoMeta (title + description from `meta.ts`), the shared header, the
  page column, and the `data-recipe-page` stamp. No hand-written SeoMeta, wrapper div, or
  RecipeHeader on the page.
- **One** CodeExample: the live demo as children, the copyable source as `code`. The source
  sits directly under the demo — no separate "Code" section at the foot, and no feature card
  retelling what the demo shows (`RecipeFeatures.svelte` was deleted with its last consumer
  on the 2026-08-16 rollout — never reintroduce it; `features` in `meta.ts` stays: its
  consumer is `get_recipe`, so write it as facts for an agent, not page copy).
- The components list renders as the header's mono manifest line ("BUILT WITH …") — it comes
  from `meta.ts` via `RecipeShell`, nothing to do per page. Never reintroduce badge chips
  for it.
- **Demo = recipeCode.** The children and the literal show the same markup and the same
  logic. Allowed divergences, and only these: (1) sample-data arrays elided in the code
  (`[/* … your rows … */]`); (2) a docs-forced fake (a setTimeout where the app would
  fetch) — the code carries a seam comment naming the replacement; (3) the host: the stage
  belongs to the docs, the app's mounting is a comment (`<!-- Centre it in your page's own
  layout -->`), unless the layout IS the recipe (table-detail's grid). Where a legacy page's
  foot code disagrees with its demo, the demo wins.
- **Multi-example pages** (page-header, stat-tile, clickable-card): each demo sits directly
  above its own code — several CodeExamples with children inside the one preview section,
  each `headingLevel={2}` with a consumer-view title, wrapped in `<div class="space-y-10">`
  (CodeExamples carry no margin of their own). Second files (a hook, a server route,
  a glossary) are CodeExamples with `preview={false}` and the file path as title. Fewer,
  sharper examples beat completeness — cutting a variant needs only a reason.
- **e2e scoping**: the shared `preview()` helper in `e2e/recipes.spec.ts` targets
  `#preview [data-docs-preview]` — the live stage, never bare `#preview`. Every asserted
  string also exists in the code panel, where Shiki splits it into bare token spans that
  collide with `getByText` under strict mode. Overlays (Drawer, ConfirmDialog, listboxes)
  render in the top layer outside that scope: query them via `page` directly.

## The recipe stage (theme)

The rooms skin gives the demo the same treatment the playground gets on a component page:
inside `[data-recipe-page]`, the CodeExample's preview frame carries a 3% whisper of the room
colour (recipes = orange room) — see `rooms-docs.css` § stage-frame rules. What sits on that
stage follows the playground's surface language, built from **library theming, not `class`
overrides**:

- **Surfaces lift, borders fence.** A panel on the stage is `<Card variant="elevated">`
  (shadow, no border). A recessed area is `variant="quiet"`. No hand-built
  `border rounded-xl` wrappers, no border-only dividers between demo regions.
- **Table stays `flush`** (the default) — its rows sit directly on the stage tint.
- **The accent comes from the room channel.** Anything `intent="primary"` in the demo is
  orange on a recipe page with zero configuration; never hardcode the hue.
- Hairline dividers *inside* one surface (`divide-border-hairline`, a `border-t` above a sum)
  are fine — the rule is against boxes around boxes, not against quiet lines within one.

Because the demo markup uses only library defaults and variants, the copied `recipeCode`
renders for a consumer exactly as it does on the stage — the stage tint is docs chrome, the
surfaces are recipe content.

# Component doc pages

Scaffold with:

```sh
bun run docs:scaffold <ComponentName> --group primitives|components
```

Full guide for building component documentation pages: [docs/DocsPageGuide.md](../../../docs/DocsPageGuide.md).

## The Types section: both halves, same source

A component page owes its types **two** lines, and each is silent without the other — no `types=`
on `<ApiReference>` means every type name in the API table renders as unlinked text, and no
`<TypesReference>` means the `#type-<Name>` links it emits point at a section that does not exist:

```svelte
<ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
...
<TypesReference types={componentData?.types ?? []} />
```

Both must read the **same** `componentData`. `bun run typesref:lint` enforces it and rejects
anything that is not that expression — `types={[]}`, `componentData?.props ?? []` (the copy-paste
slip from the line above) and a second module's `types` are all reported, not counted.

## Playground stages: cap the width of form controls

The stage is as wide as the preview column (≈ 650 px in the hero). A single-line
field stretched across it reads as a bug, so a form playground wraps its control:

| Control | Cap | Who has it |
| --- | --- | --- |
| single-line field | `max-w-xs` | Input · Select · DatePicker · DateRangePicker · NumberInput · CurrencyInput |
| multi-line / wrapper | `max-w-md` | Textarea · FormField · FileUpload · Slider |
| composer / wide widget | `max-w-xl` | PromptInput · JourneyTimeline |
| naturally narrow | none | Checkbox · Radio · Toggle · PinInput · TimeInput · Spinner |

Two rules that are easy to get wrong:

- **`w-full max-w-*`, never `mx-auto`.** The cap is the playground's business,
  the alignment is the stage's — the docs page centres, the hero left-aligns.
  An `mx-auto` in the playground overrides the host.
- A control that is `w-fit` by nature needs no cap **until** a knob makes it
  grow: TimeInput is narrow until `fullWidth` is on, and that is the knob doing
  its job, not a missing cap.

## Playground knobs: only offer what the reader can see move

`pick` is an edited selection, not "every prop". Before adding a knob, check
that it *visibly* changes the stage — a knob that does nothing reads as a broken
library, and the 2026-07-28 hero review found nine of them.

Four kinds that look pickable but are not:

- **State axes** the component owns (`open`, `selected`, `pressed`, `active`).
  A knob would fight the component.
- **Derived axes** (`hasLeftIcon`, `buttonGroupConnected`) — not settable.
- **Text-bound axes** (`messageType`, `error`, `required`): they colour or mark
  something that only exists once the example supplies a label or message.
- **Context axes** (Badge's `placement`, Sidebar's `mode`): they need a host
  element or a viewport the stage does not have.

Knobs that are screen-reader-only (Spinner's `label`, Breadcrumb's
`expandLabel`) are worth keeping — say so in the label
(`'Expand Label (screen reader)'`), or they read as dead.

Measure before adding, not after: `intent` on TimeInput/Textarea emits its class
and still renders the same grey border (see `docs/technical-debt.md`).

## Prerequisite

`bun --filter='@urbicon-ui/docs-app' run check` needs the workspace packages **built** (`bun run build:packages`) **and** a `docs:gen` run — `apps/docs/src/**/api.ts` is git-ignored and imported by every page, so a fresh worktree otherwise shows hundreds of "Cannot find module '@urbicon-ui/…'" / missing-`./api` errors.

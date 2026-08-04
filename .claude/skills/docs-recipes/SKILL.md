---
name: docs-recipes
description: Structure of recipe pages and component doc pages in apps/docs. Use when adding or editing a recipe page under apps/docs/src/routes/recipes, or scaffolding a component documentation page.
---

# Recipe pages

Recipe pages in `apps/docs/src/routes/recipes/*/` use structured `meta.ts` files for metadata (title, description, components, features). The `recipeCode` template literal stays in `+page.svelte` for the live preview.

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

---
name: add-icon
description: Icon design contract and the 5-spot registration checklist for packages/blocks/src/lib/icons. Use when adding, editing or reviewing an icon, or when icons:lint fails.
---

# Icon design rules

Icons live in `packages/blocks/src/lib/icons/` — geometry in `svg/<name>.svg`, a thin `<Name>Icon.svelte` imports it via `?raw`.

**Contract:** 24×24 viewBox, `strokeWidth=2`, round caps/joins, pure stroke (no `fill`), 0.5px grid, `rx ∈ {0, 0.5, 1.5, 2.5}` or capsule (`short/2`), original geometry only (never copy Lucide/Heroicons paths).

**First ask whether it belongs at all.** This is not a general-purpose set: an icon earns a place by completing a series the set already promised, by a component in this repo needing it, by being standard application-UI vocabulary, or by carrying a domain meaning no generic glyph does. Breadth for its own sake, brand logos, and near-duplicates of an existing drawing are out — for the last one, add **keywords** to `ICON_METADATA` instead, since `find_icons` searches keywords, not names. Full criteria: [docs/ICON-DESIGN.md](../../../docs/ICON-DESIGN.md) → "What belongs in the set".

**Adding one touches 5 spots across 4 files:**

1. the `<Name>Icon.svelte` component
2. the `IconName` union in `icon-types.ts`
3. `DEFAULT_ICONS` in `icon-registry.ts`
4. `ICON_METADATA` in `icon-registry.ts`
5. the `index.ts` export

Run **`bun run icons:lint`** — it enforces the contract + registry integrity (errors) and flags judgement calls (warnings).

Full measurement spec, corner-radius scale, canonical motifs, reference icon per shape class + checklist: [docs/ICON-DESIGN.md](../../../docs/ICON-DESIGN.md).

## Resolving icons inside components (tree-shaking)

Call `resolveIcon('name', NameIconDefault)` with a **direct** icon import — `import NameIconDefault from '$lib/icons/NameIcon.svelte'` (within blocks) or `import { NameIcon as NameIconDefault } from '@urbicon-ui/blocks'` (from another package, e.g. table). The `IconProvider`/`setIcons` override still wins; the direct import is only the fallback.

**Never `getIcon('name')` in a component** — it indexes the full `DEFAULT_ICONS` registry (dynamic key → not tree-shakeable) and drags the entire icon set into the consumer bundle. `getIcon`/`DEFAULT_ICONS` (both in `icon-registry.ts` since the module split) are reserved for the dynamic `<Icon name="…" />` component (the lone exception).

Regression grep:

```sh
rg "getIcon\(" packages/*/src --glob '!**/icon-registry.ts' --glob '!**/icon.context.ts' --glob '!**/Icon.svelte'
```

Rationale + measurements: [docs/ICON-DESIGN.md](../../../docs/ICON-DESIGN.md) → "Icon resolution & tree-shaking".

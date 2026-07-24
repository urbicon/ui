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

## Prerequisite

`bun --filter='@urbicon-ui/docs-app' run check` needs the workspace packages **built** (`bun run build:packages`) **and** a `docs:gen` run — `apps/docs/src/**/api.ts` is git-ignored and imported by every page, so a fresh worktree otherwise shows hundreds of "Cannot find module '@urbicon-ui/…'" / missing-`./api` errors.

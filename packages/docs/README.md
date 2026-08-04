# @urbicon-ui/docs

Reusable documentation UI components — the pieces the [Urbicon UI docs site](https://ui.urbicon.de) is built from: page layout with scrollspy ToC, code examples with live preview, API/type reference tables, and an interactive prop playground. Part of the Urbicon UI monorepo.

## Installation

```bash
bun add @urbicon-ui/docs @urbicon-ui/blocks @urbicon-ui/table @urbicon-ui/i18n @urbicon-ui/shared-types shiki @shikijs/langs
```

All of these (plus `svelte` ^5) are **peer dependencies** — the package bundles none of them:

- **`shiki`** (^4.4.1) + **`@shikijs/langs`** — syntax highlighting. `CodePanel` / `CodeExample` highlight through a shared, **synchronous** highlighter (`highlighterService`) with the package's editorial light/dark themes: Shiki's `Sync` core, its JavaScript regex engine, and nine statically imported grammars. Synchronous is the point — an awaited highlighter can only be driven from an effect, effects do not run during SSR, and the prerendered page then carries a spinner where the code should be. It also costs less over the wire than the async path did (116 KB gz eager and nothing lazy, against 43 KB eager plus a 145 KB `onig.wasm` and 63 KB of grammars); the measurement is written up at the top of `utils/highlighter.ts`. Both are peers so your app controls the version and the grammars are not double-bundled next to an app-level install.
- **`@urbicon-ui/blocks`** — the components compose blocks primitives (Card, Badge, Button, …) and the semantic token layer.
- **`@urbicon-ui/table`** — `ApiReference` and `TypesReference` render their prop/type tables via `<Table>`.
- **`@urbicon-ui/i18n`** — built-in strings ship as a package-scoped `docs.*` namespace (EN/DE).
- **`@urbicon-ui/shared-types`** — `PlaygroundConfigurator` control definitions.

### Styles

Import the stylesheet after Tailwind — it pulls in the blocks token layer itself and deliberately does **not** import Tailwind (that stays the app's responsibility):

```css
/* app.css */
@import 'tailwindcss';
@import '@urbicon-ui/docs/style/index.css'; /* includes @urbicon-ui/blocks tokens */
@import '@urbicon-ui/table/style/index.css'; /* table styles used by ApiReference/TypesReference */
```

## Quick Start

```svelte
<script lang="ts">
  import { Button } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout, Section } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'usage', title: 'Usage' },
    { id: 'api', title: 'API' }
  ];
</script>

<DocsLayout title="Button" description="Triggers an action." showToc {navigation}>
  <Section id="usage" title="Usage">
    <CodeExample title="Basic" language="svelte" code={`<Button intent="primary">Save</Button>`}>
      <Button intent="primary">Save</Button>
    </CodeExample>
  </Section>
</DocsLayout>
```

`DocsLayout` renders the page header (optionally with `breadcrumbs`, a `stability` badge, and a `sourceHref` link), a sticky scrollspy table of contents on desktop, and a collapsible ToC fallback on mobile. `Section` ids are the navigation anchors.

### Vite plugin — no duplicated example code

The `./vite` export ships `codeExamplePlugin`: for every `<CodeExample isolate>` it extracts the children markup at build time and injects it as the `code` prop — the live preview **is** the displayed source, written once.

```ts
// vite.config.ts
import { codeExamplePlugin } from '@urbicon-ui/docs/vite';

export default defineConfig({
  plugins: [codeExamplePlugin(), tailwindcss(), sveltekit()]
});
```

## Components

| Component               | Purpose                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DocsLayout`            | Page layout: header, breadcrumbs + collapsing sticky bar, stability badge, responsive ToC column               |
| `Section`               | Content section with anchor `id`, title/subtitle, badges, optional semantic footer                             |
| `TableOfContents`       | Sticky "On this page" nav with scrollspy, optional related-links block and global code toggle                  |
| `CodeExample`           | Code example with optional live preview, syntax highlighting, and copy-to-clipboard                            |
| `CodePanel`             | Shared code-display primitive: Shiki highlighting, collapsible panel, auto line numbers, copy button           |
| `ApiReference`          | Structured props table (rendered via `@urbicon-ui/table`) with source/required badges and opt-in type links    |
| `TypesReference`        | Expandable type definitions with literal-value badges and cross-links to the API reference                     |
| `PlaygroundConfigurator`| Interactive prop playground: live preview, control panel, generated code                                       |
| `InfoCard`              | Memo-style callout card for notes and tips; renders as a link when `href` is set                               |

Also exported: `CodeVisibilityStore` (+ context helpers) for a page-global expand/collapse-all-code toggle, `ScrollSpy` for active-section tracking, `extractPlaygroundDocs` / `extractLiteralValues` for deriving playground control metadata from generated API props, and `highlighterService` — the shared Shiki singleton the code components highlight through (`highlightCode(code, language)` returns a string, not a promise).

## Styling

`ApiReference`, `CodeExample`, `CodePanel`, `DocsLayout`, `PlaygroundConfigurator`, `TableOfContents`, and `TypesReference` support `unstyled` + per-slot `slotClasses`, following the [blocks styling conventions](../blocks/). `Section` and `InfoCard` are styled via variant props and `class`. All components accept `class` on the root element.

## i18n

Built-in strings (copy buttons, ToC headings, playground labels) register as the `docs.*` namespace via `@urbicon-ui/i18n`, with EN/DE bundles. They resolve against the locale of a surrounding `<I18nProvider>` — or the base locale (`en`) when none is mounted, so the components work with zero i18n setup.

## Development

```bash
bun --filter='@urbicon-ui/docs' run dev     # svelte-package watch
bun --filter='@urbicon-ui/docs' run build   # svelte-package
bun --filter='@urbicon-ui/docs' run test    # vitest
bun --filter='@urbicon-ui/docs' run check   # svelte-check
```

## Related

- [Urbicon UI docs site](https://ui.urbicon.de) — its documentation chrome is built with these components
- [`@urbicon-ui/blocks`](../blocks/) — the component library these docs components compose
- [`@urbicon-ui/table`](../table/) — renders the API/type reference tables
- [`@urbicon-ui/i18n`](../i18n/) — locale provider the `docs.*` namespace plugs into

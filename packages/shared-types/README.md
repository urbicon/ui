# @urbicon-ui/shared-types

The TypeScript types behind the Urbicon UI documentation tooling. Pure types, zero runtime, zero dependencies.

## Purpose

`docs-gen` reads and emits these types (`ComponentInfo`, `PropInfo`, `SvelteDocsConfig`, …), and `@urbicon-ui/docs` takes the `PlaygroundConfigurator` control model (`ControlDefinition`, `ControlOption`) from `./playground`. No runtime package depends on this one: `blocks` and `table` reference `./globals` only while type-checking their own sources, and nothing they publish imports it.

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

## Exports

Each subpath is consumable on its own so consumers pull in only what they need:

| Subpath | Contents |
|---|---|
| `.` | Barrel — re-exports everything below except `documentation-core` and `globals`. Includes the component model: `ComponentInfo`, `ComponentStats`, `PropInfo`, `PropSource`, `PropExample`, `VariantInfo`, `VariantExample`, `InheritanceInfo`, `CrossReference`, `PackageInfo` |
| `./documentation` | `ComponentMetadata`, `DeprecationInfo`, `ComponentBadge`, `SectionOrder`, `LLMConfig` |
| `./docs-config` | `SvelteDocsConfig`, `DocsPlaygroundConfig`, `VariantsConfig`, `ExamplesConfig`, `ApiConfig`, `OverviewConfig`, `UsageConfig`, `DocsMetadata` |
| `./documentation-core` | `ComponentDocumentation`, `ComponentDocumentationFiles`, `DocumentationMetadata`, `LLMSettings` and the section-structure config types (`AutoSectionsConfig`, `CustomSection`, `SectionStructure`, `ParentSectionConfig`) |
| `./examples` | `ComponentExample`, `UsagePattern`, `ExampleCollection`, `ExampleGroup` |
| `./playground` | `PlaygroundConfig`, `ControlDefinition`, `ControlType`, `ControlOption`, `ControlCondition`, `CodeGenerator`, `CodeGeneratorConfig`, `ImportStatement`, `PlaygroundExample`, `PlaygroundMetadata`, `PlaygroundFeature` |
| `./navigation` | `NavigationItem`, `NavigationMetadata`, `NavigationState`, `NavigationBadge`, `TableOfContents`, `TOCItem`, `TOCSettings`, `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbSettings`, `SiteNavigation`, `NavigationContext`, `NavigationSearchResult`, `SearchMatch` |
| `./globals` | Monorepo-wide branded types and constants |

## Usage

<!-- typecheck -->
```typescript
import type { ComponentInfo, PropInfo } from '@urbicon-ui/shared-types';
import type { PlaygroundConfig } from '@urbicon-ui/shared-types/playground';

const intent: PropInfo = {
  name: 'intent',
  type: 'ComponentIntent',
  required: false,
  description: 'Semantic colour of the button',
  source: { type: 'direct' }
};

const button: ComponentInfo = {
  name: 'Button',
  packageName: '@urbicon-ui/blocks',
  filePath: 'src/lib/components/primitives/Button/Button.svelte',
  description: 'Triggers an action or navigation',
  props: [intent],
  variants: [],
  inheritance: [],
  stats: { totalProps: 1, directProps: 1, variantProps: 0, inheritedProps: 0 }
};
```

The root barrel export is convenient but pulls all namespaces in; prefer the subpath exports for smaller type-check surface.

## Versioning

Unified with the monorepo version (see root [CHANGELOG.md](../../CHANGELOG.md)). Breaking changes to exported types are treated as semver-major for the whole workspace.

## Development

```bash
bun --filter='@urbicon-ui/shared-types' run build     # tsc build
bun --filter='@urbicon-ui/shared-types' run check     # tsc --noEmit
bun --filter='@urbicon-ui/shared-types' run dev       # watch mode
```

## Related

- [Architecture Overview](../../docs/ARCHITECTURE.md) — how the types feed docs-gen and docs
- [Component API Conventions](../../docs/COMPONENT-API-CONVENTIONS.md) — canonical prop patterns reflected in these types

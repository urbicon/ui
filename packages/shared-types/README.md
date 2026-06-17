# @urbicon-ui/shared-types

Central TypeScript type definitions shared across the Urbicon UI monorepo. Pure types, zero runtime, zero dependencies.

## Purpose

Every Urbicon package (`blocks`, `table`, `docs`, `docs-gen`, `mcp-server`, `i18n`) consumes these types to stay consistent. The same `PropInfo` describes a component prop in `docs-gen` output, in `docs`' `ApiReference` component, and in the MCP server catalog.

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

## Exports

Each subpath is consumable on its own so consumers pull in only what they need:

| Subpath | Contents |
|---|---|
| `.` | Barrel — re-exports everything below except `documentation-core` |
| `./documentation` | `ComponentMetadata`, `DeprecationInfo`, `ComponentBadge`, `SectionOrder`, `LLMConfig` |
| `./docs-config` | `SvelteDocsConfig`, `DocsPlaygroundConfig`, `VariantsConfig`, `ExamplesConfig`, `ApiConfig`, `OverviewConfig`, `UsageConfig`, `DocsMetadata` |
| `./components` | `ComponentInfo`, `ComponentStats`, `PropInfo`, `PropSource`, `PropExample`, `VariantInfo`, `VariantExample`, `InheritanceInfo`, `CrossReference`, `PackageInfo` |
| `./examples` | `ComponentExample`, `UsagePattern`, `ExampleCollection`, `ExampleGroup` |
| `./playground` | `PlaygroundConfig`, `ControlDefinition`, `ControlType`, `ControlOption`, `ControlCondition`, `CodeGenerator`, `CodeGeneratorConfig`, `ImportStatement`, `PlaygroundExample`, `PlaygroundMetadata`, `PlaygroundFeature` |
| `./navigation` | `NavigationItem`, `NavigationMetadata`, `NavigationState`, `NavigationBadge`, `TableOfContents`, `TOCItem`, `TOCSettings`, `Breadcrumb`, `BreadcrumbItem`, `BreadcrumbSettings`, `SiteNavigation`, `NavigationContext`, `NavigationSearchResult`, `SearchMatch` |
| `./globals` | Monorepo-wide branded types and constants |
| `./utilities` | Helper types |

## Usage

```typescript
import type { PropInfo, ComponentInfo } from '@urbicon-ui/shared-types/components';
import type { PlaygroundConfig } from '@urbicon-ui/shared-types/playground';

const button: ComponentInfo = {
  name: 'Button',
  props: [{ name: 'intent', type: 'ComponentIntent', required: false }],
  // ...
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

- [Architecture Overview](../../docs/ARCHITECTURE.md) — how the type hub feeds docs-gen, docs, and mcp-server
- [Component API Conventions](../../docs/COMPONENT-API-CONVENTIONS.md) — canonical prop patterns reflected in these types

# @urbicon-ui/docs-gen

Documentation generator for UI component libraries. Extracts props, variants, and inheritance from TypeScript/Svelte components and generates API data files and LLM-friendly documentation.

## Usage

### From workspace root

```bash
# Generate docs for all packages (blocks, docs, table, auth)
bun run docs:gen:all

# Generate for a specific package
bun run docs:gen:blocks
bun run docs:gen:docs
bun run docs:gen:table
bun run docs:gen:auth
```

> Only `docs:gen:all` (and `build`) additionally runs the `MCPCatalogAssembler`,
> which globs every per-target `_catalog.json` into the aggregated MCP
> `component-catalog.json` and design-content bundle. A per-target run
> (`docs:gen:blocks`, …) does not — this is why regenerating after a JSDoc edit
> is a **two-step** operation, not a single per-target run.

### From this package

```bash
bun run docs:gen           # Generate all targets
```

### CLI

```
docs-gen [command] [options]

Commands:
  generate, build    Generate documentation (default)
  help              Show help

Options:
  --target <type>   Target: 'blocks', 'docs', 'table', 'auth', or 'all' (default: 'all')
```

## Architecture

The pipeline follows a strict sequence: **Discovery → Extraction → Enrichment → Generation**.

```
Phase 1: Discovery      → Find components via glob patterns (ComponentFinder)
Phase 2: Extraction     → Extract props, variants, inheritance from TypeScript
Phase 3: Enrichment     → Resolve cross-refs, calculate stats, produce APIData
Phase 4: Generation     → Write API file first, then LLM docs
```

Discovery yields one component per `index.ts` (named after its directory). A
multi-component `index.ts` can opt additional exports into their own catalog
entries via an `@standalone` JSDoc tag on the export's `<Name>Props` interface
(plus a matching `export { default as Name } from './Name.svelte'`) — used by
the Guide surfaces. Exports without the tag are treated as compound
subcomponents and stay folded into the directory component's entry.

### Key modules

| Path | Purpose |
|------|---------|
| `src/core/pipeline/PipelineOrchestrator.ts` | Main pipeline coordinator |
| `src/core/discovery/ComponentFinder.ts` | Component discovery |
| `src/core/extraction/ExtractionCoordinator.ts` | Orchestrates extractors |
| `src/core/enrichment/APIDataGenerator.ts` | API data generation |
| `src/core/generation/GenerationCoordinator.ts` | Output coordination |
| `src/generators/api/APIFileGenerator.ts` | Per-component `api.ts` files |
| `src/generators/llm/LLMDocumentationGenerator.ts` | LLM text output |

## Configuration

Configuration is built via `DocsConfigurationBuilder` and `ConfigurationFactory`. Presets:

- `ConfigurationFactory.blocks()` — `@urbicon-ui/blocks`
- `ConfigurationFactory.docs()` — `@urbicon-ui/docs`
- `ConfigurationFactory.table()` — `@urbicon-ui/table`
- `ConfigurationFactory.auth()` — `@urbicon-ui/auth`

### Output paths

| Target | API output | LLM output |
|--------|-----------|------------|
| blocks | `apps/docs/src/routes/blocks/` | `apps/docs/static/blocks/` |
| docs | `apps/docs/src/routes/docs/` | `apps/docs/static/docs/` |
| table | `apps/docs/src/routes/table/` | `apps/docs/static/table/` |
| auth | `apps/docs/src/routes/auth/` | `apps/docs/static/auth/` |

## Scripts

| Script | Description |
|--------|-------------|
| `bun run docs:gen` | Generate documentation |
| `bun run test` | Run Vitest |
| `bun run test:watch` | Watch mode tests |
| `bun run build` | Build TypeScript |
| `bun run typecheck` | Type check only |

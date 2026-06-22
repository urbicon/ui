/**
 * Public API of the search module — the component-catalog schema, the discovery
 * ranker, and the `llm.txt` section parser. Shared by the `urbicon` CLI
 * (`find` / `get-component`) and the remote MCP server (`find_components` /
 * `get_component`) so local and remote knowledge agree (DESIGN-MCP-V2 §5,
 * "engine/search + content"). Pure and dependency-free; consumers own the file I/O
 * (locating the bundle via `@urbicon-ui/design-content`, reading it themselves).
 */

export { matchComponents } from './match.js';
export { extractSection, type LlmTxtSection } from './section.js';
export type { ComponentCatalog, ComponentCatalogEntry, RecipeEntry } from './types.js';

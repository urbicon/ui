/**
 * Public API of the search module — the component-catalog schema, the discovery
 * rankers (components + icons), and the `llm.txt` section parser. Shared by the
 * `urbicon` CLI (`find` / `get-component` / `icons`) and the remote MCP server
 * (`find_components` / `get_component` / `find_icons`) so local and remote knowledge
 * agree. Pure and dependency-free; consumers own the file I/O (locating the bundle
 * via `@urbicon-ui/design-content`, reading it themselves).
 */

export { ICON_CATEGORY_ORDER, type IconEntry, matchIcons } from './icons.js';
export {
  CLOSEST_NOTE,
  type ComponentSearch,
  isBooleanAxis,
  matchComponents,
  searchComponents
} from './match.js';
export { extractSection, type LlmTxtSection } from './section.js';
export type {
  ComponentCatalog,
  ComponentCatalogEntry,
  ComponentCatalogPropDoc,
  ComponentCatalogVariant,
  RecipeEntry
} from './types.js';

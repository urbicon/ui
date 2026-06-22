/**
 * The component-catalog schema — the shape of the version-pinned
 * `component-catalog.json` that `@urbicon-ui/design-content` ships and `docs-gen`
 * assembles. It lives in the engine (not the content package) so the search logic
 * and every consumer — the `urbicon` CLI's `find`/`get-component`, the remote MCP
 * server's `find_components`/`get_component` — share one authoritative type, while
 * `design-content` stays a pure path locator (DESIGN-MCP-V2 §5, "engine/search + content").
 */

export interface ComponentCatalogEntry {
  name: string;
  slug: string;
  package: string;
  group: 'primitives' | 'components' | 'core' | 'auth';
  description: string;
  tags: string[];
  import: string;
  llmTxtPath: string;
  variants: { name: string; values: string[]; default?: string }[];
  keyProps: string[];
  keyPropTypes: Record<string, string>;
  slots: string[];
  hasExamples: boolean;
  relatedComponents: string[];
}

export interface RecipeEntry {
  id: string;
  title: string;
  description: string;
  components: string[];
  code: string;
  features: string[];
  /** Layer-4 composition pattern this recipe is an instance of (e.g. "dashboard"). Cross-links to `get_pattern`. */
  pattern?: string;
}

export interface ComponentCatalog {
  generated: string;
  version: string;
  components: ComponentCatalogEntry[];
  recipes: RecipeEntry[];
  tags: string[];
}

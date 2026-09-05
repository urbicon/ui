/**
 * The component-catalog schema — the shape of the version-pinned
 * `component-catalog.json` that `@urbicon-ui/design-content` ships and `docs-gen`
 * assembles. It lives in the engine (not the content package) so the search logic
 * and every consumer — the `urbicon` CLI's `find`/`get-component`, the remote MCP
 * server's `find_components`/`get_component` — share one authoritative type, while
 * `design-content` stays a pure path locator (DESIGN-MCP-V2 §5, "engine/search + content").
 */

export interface ComponentCatalogVariant {
  name: string;
  values: string[];
  default?: string;
  /**
   * What a value means, keyed by value — the JSDoc block above the value in the
   * component's tv() config. Only values that carry one; absent when none does.
   */
  valueDescriptions?: Record<string, string>;
}

/** The hand-written JSDoc of one prop, split the way the source splits it. */
export interface ComponentCatalogPropDoc {
  /** The contract — may run to a paragraph. */
  description?: string;
  /** The prop's `@summary`: the one line a playground shows beside the knob. Rare by design. */
  summary?: string;
}

export interface ComponentCatalogEntry {
  name: string;
  slug: string;
  package: string;
  group: 'primitives' | 'components' | 'core' | 'auth';
  /** The long form — the `@description` of the *Props interface; the contract an agent reads. */
  description: string;
  /** The one human sentence — `@summary`. Absent while a component still has none. */
  summary?: string;
  stability?: 'experimental' | 'beta' | 'stable' | 'deprecated';
  tags: string[];
  import: string;
  llmTxtPath: string;
  variants: ComponentCatalogVariant[];
  /** The first eight direct props, by name — a display list, not the prop surface. */
  keyProps: string[];
  /** Direct + variant props, inherited HTML attributes excluded; `keyProps.length` caps at eight. */
  propCount?: number;
  keyPropTypes: Record<string, string>;
  /**
   * The hand-written JSDoc of the component's own (direct) props, by name. What
   * lets discovery reach a component through what a prop says — "dense settings
   * rows" lives in Toggle's `variant` prop, not in its description. Absent when
   * no direct prop carries JSDoc.
   */
  propDocs?: Record<string, ComponentCatalogPropDoc>;
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

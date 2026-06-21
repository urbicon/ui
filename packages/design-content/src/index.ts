/**
 * Public API of `@urbicon-ui/design-content` — the version-pinned bundle of Urbicon
 * UI design knowledge (component catalog, per-component `llm.txt`, design-system
 * principles + patterns, guide template, icon metadata) plus a package-relative
 * locator for it. The deterministic engine (linter/manifest/rubric) lives in
 * `@urbicon-ui/design-engine`; this package is the Knowledge plane (DESIGN-MCP-V2 §4).
 *
 * Consumers (the remote MCP server, the `urbicon` CLI) read the bundle through these
 * path helpers, so the content travels with the package — version-coherent and free
 * of monorepo sibling-path assumptions.
 */

export type { ContentMeta } from './content-loader.js';
export {
  getCatalogPath,
  getComponentLlmPath,
  getContentDir,
  getDesignSystemDir,
  getIconsPath,
  getTemplatePath,
  getVerbsDir,
  loadContentMeta
} from './content-loader.js';

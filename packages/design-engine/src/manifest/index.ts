/**
 * Public API of the design-manifest module — the persistent design-intent layer
 * (docs/DESIGN-MCP.md, Option C). Consumed by the `get_design_context`,
 * `record_design_decision`, and `sync_design_manifest` MCP tools.
 */

export {
  appendDecision,
  createManifestTemplate,
  DECISIONS_HEADING,
  emptyManifest,
  formatContext,
  parseFrontmatter,
  parseManifest,
  renderDecision,
  USAGES_HEADING,
  upsertUsagesSection
} from './manifest.js';
export { scanMarkers } from './scan.js';
export type { DesignDecision, DesignManifest, PatternUsage } from './types.js';

/**
 * Public API of the design-manifest module — the persistent design-intent layer
 * (docs/DESIGN-MCP.md, Option C). Consumed by the `urbicon` CLI
 * (context / record-decision / sync-manifest) in `@urbicon-ui/design`.
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

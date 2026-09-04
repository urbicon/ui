/**
 * Public API of the reference module — the Knowledge-plane pieces that are pure
 * logic or authored prose rather than docs-gen artifacts: the CSS design-token
 * reference text and the design-system file parsers (principles topics, pattern
 * entries). Shared by the `urbicon` CLI (`css-reference` / `principles` / `pattern`)
 * and the remote MCP server (`get_css_reference` / `get_design_principles` /
 * `get_pattern`) so local and remote knowledge agree. Consumers own the file I/O.
 */

export {
  CSS_REFERENCE_OVERVIEW,
  CSS_REFERENCE_SECTION_ALIASES,
  CSS_REFERENCE_SECTION_NAMES,
  CSS_REFERENCE_SECTIONS,
  type CssReferenceSection,
  renderCssReference,
  resolveCssReferenceSection
} from './css-reference.js';
export {
  extractPrincipleSection,
  type PatternEntry,
  PRINCIPLE_TOPICS,
  type PrincipleTopic,
  parsePatternEntry
} from './design-system.js';
export {
  CLASS_OVER_SLOT_CLASSES,
  OVERRIDE_CASCADE,
  OVERRIDE_LADDER
} from './override-ladder.js';

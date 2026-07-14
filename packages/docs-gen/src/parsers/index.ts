// packages/docs-gen/src/parsers/index.ts
// ==========================================
// PARSERS - MAIN EXPORTS
// ==========================================

export { type SvelteDocsParseResult, SvelteDocsParser } from './SvelteDocsParser';
export {
  foldStaticExpression,
  parseDocsConfigFromSvelte,
  StaticDocsConfigError
} from './static-docs-config';

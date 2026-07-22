// Chat family barrel — AI-kit surfaces (streaming markdown, code display,
// citations) plus the public pieces of the markdown engine underneath them.

export type { CitationChipProps, CitationSource } from './CitationChip';
export * from './CitationChip';
export type { CodeBlockProps } from './CodeBlock';
export * from './CodeBlock';
export { createIncrementalParser, parseMarkdown } from './markdown/blocks';
export { repairMarkdownTail } from './markdown/repair';
export type {
  BlockNode,
  IncrementalMarkdownParser,
  InlineNode,
  MarkdownBlock,
  MarkdownDocument,
  MarkdownParseOptions,
  MarkdownUrlPolicy
} from './markdown/types';
export type { MarkdownRenderers, StreamingMarkdownProps } from './StreamingMarkdown';
export * from './StreamingMarkdown';

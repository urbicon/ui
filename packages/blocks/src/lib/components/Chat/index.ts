// Chat family barrel — AI-kit surfaces (conversation, composer, streaming
// markdown, code display, citations) plus the public pieces of the markdown
// engine underneath them.

export type { ChatProps } from './Chat';
export * from './Chat';
export type { ChatMessageProps, ChatPartRenderers } from './ChatMessage';
export * from './ChatMessage';
export type { ChatMessageListItemContext, ChatMessageListProps } from './ChatMessageList';
export * from './ChatMessageList';
export type { CitationChipProps, CitationSource } from './CitationChip';
export * from './CitationChip';
export type { CodeBlockProps } from './CodeBlock';
export * from './CodeBlock';
export type {
  ChatMessageData,
  ChatMessagePart,
  ChatMessageStatus,
  ChatRole
} from './chat.types';
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
export type { PromptInputProps } from './PromptInput';
export * from './PromptInput';
export type { MarkdownRenderers, StreamingMarkdownProps } from './StreamingMarkdown';
export * from './StreamingMarkdown';

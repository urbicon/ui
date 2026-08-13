import type { HTMLAttributes } from 'svelte/elements';
import type { CitationSource } from '../CitationChip';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { MarkdownRenderers } from './md-context';
import type {
  StreamingMarkdownSlots,
  StreamingMarkdownVariants
} from './streaming-markdown.variants';

/**
 * Props interface for StreamingMarkdown component
 *
 * @summary Renders markdown as it arrives, without redrawing what has already settled.
 * @description Streaming-safe markdown renderer for LLM output. Parses a growing
 * `content` string incrementally (settled blocks are never re-rendered) and renders
 * to a real component tree — never through `{@html}`, so raw HTML in the source
 * stays inert text. Links and images pass a strict-by-default URL policy
 * (external images blocked unless allowlisted). Citation markers like `[1]`
 * resolve to CitationChip when a matching entry exists in `sources`; code fences
 * render through CodeBlock. Per-node-type `renderers` snippets hook in syntax
 * highlighting, custom links, images, or citations without adding dependencies.
 *
 * @tag ai
 * @tag display
 * @related CodeBlock
 * @related CitationChip
 * @stability experimental
 *
 * @example
 * ```svelte
 * <StreamingMarkdown content={message.text} streaming={message.status === 'streaming'} />
 * ```
 *
 * @example
 * ```svelte
 * <StreamingMarkdown
 *   content={answer}
 *   sources={[{ id: '1', title: 'Design tokens', url: 'https://ui.urbicon.de/tokens' }]}
 *   urlPolicy={{ allowedImagePrefixes: ['https://cdn.example.com/'] }}
 * />
 * ```
 */
export interface StreamingMarkdownProps
  extends StreamingMarkdownVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Markdown source. Append-only growth streams incrementally; any other change re-parses. */
  content: string;
  /** Shows a pulsing cursor after the last block while the answer streams @default false */
  streaming?: boolean;
  /**
   * Citation sources. Ids activate `[id]` / `【id】` markers in the content,
   * rendering them as CitationChip (1-based index follows array order).
   * Markers without a matching id stay plain text.
   */
  sources?: CitationSource[];
  /**
   * URL policy for links and images. Strict by default: links limited to
   * http/https/mailto/tel + relative, every external image blocked. Keep the
   * object referentially stable — a new reference re-parses the content.
   */
  urlPolicy?: MarkdownUrlPolicy;
  /** Per-node-type snippet overrides (code highlighting, router links, lightboxes, …) */
  renderers?: MarkdownRenderers;
  /** Recognize bare `https://…` autolinks (GFM-style) @default false */
  autolink?: boolean;
  /**
   * DOM heading level that markdown `#` maps to (deeper levels shift along,
   * clamped at h6). Visual sizing keeps following the author's level. Set to
   * 3 in a chat so message headings stay out of the page outline.
   * @default 1
   * @summary Which DOM heading level a markdown hash maps to, keeping message headings out of the page outline.
   */
  headingLevelStart?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Target for rendered links; `rel="noopener noreferrer"` is added for `_blank` @default '_blank' */
  linkTarget?: '_blank' | '_self';
  /** aria-label for the focusable scrollable region around tables @default 'Table' */
  tableRegionLabel?: string;
  /** Type scale: `md` inherits the surrounding font size, `sm` is compact @default 'md' */
  size?: 'sm' | 'md';
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | paragraph | heading1–6 | inlineCode | link | linkBlocked | image | imageBlocked | listUnordered | listOrdered | listItem | taskItem | taskCheckbox | blockquote | codeBlock | tableWrapper | table | tableRow | tableHeadCell | tableCell | hr | cursor */
  slotClasses?: Partial<Record<StreamingMarkdownSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ StreamingMarkdown: {...} }}>`.
   * Prefer this over `class` overrides for reusable custom looks.
   */
  preset?: string;
}

export type { MarkdownRenderers } from './md-context';
export { default as StreamingMarkdown } from './StreamingMarkdown.svelte';
export {
  type StreamingMarkdownSlots,
  type StreamingMarkdownVariants,
  streamingMarkdownVariants
} from './streaming-markdown.variants';

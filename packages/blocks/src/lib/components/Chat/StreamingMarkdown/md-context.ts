import type { Snippet } from 'svelte';
import type { CitationSource } from '../CitationChip';
import type { InlineNode, MarkdownUrlPolicy } from '../markdown/types';

/**
 * Snippet overrides per markdown node type. Each snippet fully replaces the
 * built-in renderer for that node — the hook point for syntax highlighting,
 * lightboxes, router-aware links, or custom citation chips, without pulling
 * any of those dependencies into the core.
 */
export interface MarkdownRenderers {
  codeBlock?: Snippet<[{ code: string; lang?: string; open?: boolean }]>;
  /** `href` is already policy-checked: empty string when `blocked` is true. */
  link?: Snippet<[{ href: string; title?: string; children: InlineNode[]; blocked: boolean }]>;
  /** `src` is already policy-checked: empty string when `blocked` is true. */
  image?: Snippet<[{ src: string; alt: string; title?: string; blocked: boolean }]>;
  /** `source.url` is already policy-checked: stripped (undefined) when blocked. */
  citation?: Snippet<[{ id: string; source?: CitationSource; index?: number }]>;
}

/**
 * Internal render context threaded through MdBlock/MdInline. One object
 * instead of five props; deliberately not a Svelte context — the tree is
 * private to StreamingMarkdown and explicit prop flow keeps it inspectable.
 */
export interface MdRenderContext {
  /** Resolved class string per variant slot (tv() + slotClasses + unstyled already applied). */
  classes: Readonly<Record<string, string>>;
  renderers?: MarkdownRenderers;
  /** Citation id → source + 1-based display index; only set when `sources` were provided. */
  citations?: ReadonlyMap<string, { source: CitationSource; index: number }>;
  /** Forwarded to CitationChip so popover links obey the same policy as inline links. */
  urlPolicy?: MarkdownUrlPolicy;
  /** Markdown h1 renders as this DOM heading level (clamped at h6). */
  headingLevelStart: number;
  linkTarget: '_blank' | '_self';
  /** aria-label for the focusable scrollable table region. */
  tableRegionLabel: string;
}

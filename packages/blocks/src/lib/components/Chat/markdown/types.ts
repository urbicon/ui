/**
 * Shared contracts for the streaming markdown engine.
 *
 * The engine is a zero-dependency CommonMark/GFM *subset* parser that renders
 * to a component tree, never to an HTML string. Raw HTML in the source is
 * treated as plain text.
 *
 * Streaming model: `createIncrementalParser()` accepts append-only chunks.
 * Settled blocks keep object identity across appends (Svelte's keyed `{#each}`
 * then skips re-rendering them); only the unsettled tail is re-parsed per
 * append, after running `repairMarkdownTail` over it.
 */

// ── Inline nodes ─────────────────────────────────────────────────────────────

export type InlineNode =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: InlineNode[] }
  | { kind: 'em'; children: InlineNode[] }
  | { kind: 'strike'; children: InlineNode[] }
  | { kind: 'code'; text: string }
  | {
      kind: 'link';
      /** Empty string when `blocked` is true — the original URL never reaches the DOM. */
      href: string;
      title?: string;
      children: InlineNode[];
      /** Set when the URL failed the `MarkdownUrlPolicy`; render as inert text. */
      blocked?: boolean;
    }
  | {
      kind: 'image';
      /** Empty string when `blocked` is true. */
      src: string;
      alt: string;
      title?: string;
      blocked?: boolean;
    }
  | {
      /** `[id]` / `【id】` citation marker; emitted only for ids in `MarkdownParseOptions.citationIds`. */
      kind: 'citation';
      id: string;
    }
  | { kind: 'break' };

// ── Block nodes ──────────────────────────────────────────────────────────────

export interface ListItem {
  children: BlockNode[];
  /** Task-list state; undefined for ordinary items. */
  checked?: boolean;
}

export type BlockNode =
  | { kind: 'paragraph'; children: InlineNode[] }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | {
      kind: 'code-block';
      lang?: string;
      code: string;
      /** True while the closing fence has not streamed in yet. */
      open?: boolean;
    }
  | { kind: 'list'; ordered: boolean; start?: number; items: ListItem[] }
  | { kind: 'blockquote'; children: BlockNode[] }
  | {
      kind: 'table';
      align: ('left' | 'center' | 'right' | null)[];
      header: InlineNode[][];
      rows: InlineNode[][][];
    }
  | { kind: 'hr' };

/**
 * Top-level block with a stable identity for keyed `{#each}`. Settled blocks
 * additionally keep referential identity (`===`) across `append()` calls.
 */
export type MarkdownBlock = BlockNode & { key: number };

export interface MarkdownDocument {
  blocks: MarkdownBlock[];
  /** Link-reference definitions (`[label]: url "title"`), keys lowercased. */
  linkRefs: ReadonlyMap<string, { href: string; title?: string }>;
}

// ── URL policy (decision A4 — strict by default) ─────────────────────────────

export interface MarkdownUrlPolicy {
  /**
   * Allowed link protocols (with trailing colon). Relative URLs are always
   * allowed for links. @default ['http:', 'https:', 'mailto:', 'tel:']
   */
  allowedLinkProtocols?: string[];
  /**
   * Prefix allowlist for image sources, matched against the normalized
   * absolute URL. Empty (the default) blocks every external image; relative
   * sources are allowed. Prefer deep, specific prefixes — broad ones are
   * open-redirect bait. `data:` images are blocked unless a `data:` prefix
   * is listed explicitly.
   * @default []
   */
  allowedImagePrefixes?: string[];
  /** Observability hook — fires once per blocked URL occurrence. */
  onBlocked?: (kind: 'link' | 'image', url: string) => void;
}

// ── Parse options ────────────────────────────────────────────────────────────

export interface MarkdownParseOptions {
  urlPolicy?: MarkdownUrlPolicy;
  /**
   * Ids for which `[id]` / `【id】` markers become `citation` nodes. Markers
   * with unknown ids stay plain text (so `[1]` in prose is not mangled).
   */
  citationIds?: ReadonlySet<string>;
  /** Recognize bare `https://…` autolinks (GFM-style). @default false */
  autolink?: boolean;
}

// ── Engine API (implemented in blocks.ts / inline.ts / repair.ts) ────────────

export interface IncrementalMarkdownParser {
  /**
   * Append a chunk and get the current document. Settled blocks are the same
   * objects as in the previous call; the tail is freshly parsed from
   * `repairMarkdownTail(tail)`.
   */
  append(chunk: string): MarkdownDocument;
  /** Current document (same value the last `append` returned). */
  readonly document: MarkdownDocument;
  /** Full text received so far. */
  readonly source: string;
  reset(): void;
}

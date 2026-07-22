import type { HTMLButtonAttributes } from 'svelte/elements';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { CitationChipSlots } from './citation-chip.variants';

/**
 * A cited source surfaced behind a `[id]` citation marker. `id` keys the
 * source to its marker; `title` is always shown, `url` / `snippet` are optional
 * and only render when present (and, for `url`, when the URL policy allows it).
 */
export interface CitationSource {
  /** Stable id — matches the `[id]` marker in the streamed markdown. */
  id: string;
  /** Human-readable source title, always shown in the popover (and as the chip label under `citationStyle="label"`). */
  title: string;
  /** Source URL. Rendered as an outbound link only when it passes the `urlPolicy`; a blocked or absent URL shows title/snippet with no link. */
  url?: string;
  /** Short excerpt shown under the title, clamped to ~3 lines. */
  snippet?: string;
}

/**
 * @description Compact source marker rendered for a `[id]` citation. StreamingMarkdown wires it up automatically from its `sources` prop — each in-text marker becomes a CitationChip whose click opens a Popover with the source title, snippet, and a policy-checked outbound link. Also usable standalone for source footers / reference lists outside a streamed message.
 * @tag ai
 * @related StreamingMarkdown
 * @related Badge
 * @related Popover
 * @stability experimental
 */
export interface CitationChipProps extends Omit<HTMLButtonAttributes, 'class' | 'children'> {
  /** The cited source. Required. */
  source: CitationSource;
  /** 1-based ordinal shown as the chip label under `citationStyle="numeric"`. Falls back to `source.id` when omitted. */
  index?: number;
  /**
   * What the chip shows: `numeric` renders `index` (or `source.id` as a
   * fallback) as a compact numeric pill; `label` renders the (truncated)
   * `source.title`.
   * @default 'numeric'
   */
  citationStyle?: 'numeric' | 'label';
  /**
   * URL policy applied to `source.url` before it becomes a link (same strict
   * default as the streaming-markdown engine — untrusted LLM output). A blocked
   * URL yields no link in the popover, only title/snippet.
   */
  urlPolicy?: MarkdownUrlPolicy;
  /**
   * Text of the outbound link in the popover.
   * @default 'Open source'
   */
  openLabel?: string;
  /**
   * Override the trigger's `aria-label`. Defaults to
   * `Source {index}: {title}` (or `Source: {title}` without an index).
   */
  label?: string;

  /** Extra classes merged onto the trigger chip (the root slot). */
  class?: string;
  /** Strip all default tv() classes; combine with `class` / `slotClasses` for a custom look. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: `trigger` (root chip), `popover` (content wrapper), `title`, `snippet`, `link`, `linkIcon`. */
  slotClasses?: Partial<Record<CitationChipSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ CitationChip: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette.
   */
  preset?: string;
}

export { default as CitationChip } from './CitationChip.svelte';
export {
  type CitationChipSlots,
  type CitationChipVariants,
  citationChipVariants
} from './citation-chip.variants';

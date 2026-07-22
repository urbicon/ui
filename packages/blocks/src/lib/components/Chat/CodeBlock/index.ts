import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CodeBlockSlots, CodeBlockVariants } from './code-block.variants';

/**
 * @description Read-only code display card with a one-click copy interaction: the copy
 * button swaps its icon and label to a confirmation for two seconds and fires `onCopy`.
 * Renders raw text only — no built-in syntax highlighting; a consumer or the
 * StreamingMarkdown renderer can layer highlighting in via a snippet. Used by
 * StreamingMarkdown for fenced code blocks, and standalone for any code snippet.
 *
 * @tag ai
 * @tag display
 * @related StreamingMarkdown
 * @stability experimental
 *
 * @example
 * ```svelte
 * <CodeBlock lang="ts" code={`const x = 1;`} onCopy={(c) => track(c)} />
 * ```
 */
export interface CodeBlockProps
  extends CodeBlockVariants,
    Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> {
  /** The code to display and copy. Rendered as raw text (no highlighting). */
  code: string;
  /** Language label shown in the header. Display-only — does not drive highlighting. */
  lang?: string;
  /** Show the copy button in the header. */
  showCopy?: boolean;
  /**
   * Soft-wrap long lines. `false` (default) scrolls horizontally inside the
   * block; `true` wraps with `whitespace-pre-wrap` + word breaking.
   */
  wrap?: boolean;

  /** Accessible label / tooltip for the copy button in its idle state. */
  copyLabel?: string;
  /** Accessible label shown for two seconds after a successful copy. */
  copiedLabel?: string;

  /** Called with the copied code after a successful clipboard write. */
  onCopy?: (code: string) => void;

  /** Extra header actions rendered to the right, before the copy button. */
  actions?: Snippet;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: root | header | langLabel | copyButton | pre | code */
  slotClasses?: Partial<Record<CodeBlockSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ CodeBlock: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette.
   */
  preset?: string;
}

export { default as CodeBlock } from './CodeBlock.svelte';
export { type CodeBlockVariants, codeBlockVariants } from './code-block.variants';

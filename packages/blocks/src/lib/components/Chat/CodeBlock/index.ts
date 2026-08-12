import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CodeBlockSlots, CodeBlockVariants } from './code-block.variants';

/**
 * @summary Code to read and copy, with a copy button that confirms it worked.
 * @description Read-only code display with a one-click copy interaction: the copy
 * button swaps its icon and label to a confirmation for two seconds and fires `onCopy`.
 * Renders raw text only — no built-in syntax highlighting; a consumer or the
 * StreamingMarkdown renderer can layer highlighting in via a snippet. Used by
 * StreamingMarkdown for fenced code blocks, and standalone for any code snippet.
 * `variant="card"` (default) brings its own surface, outline and radius;
 * `variant="plain"` drops all three for embedding inside something that already
 * owns the framing decision — a container that frames the content, or one that
 * deliberately frames nothing (ToolCallCard is both, per its own variant).
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
  /**
   * Header caption, shown instead of `lang`. For an embedded block, what the
   * payload *is* ("Input", "Response body") says more than the language it is
   * serialised in — and rendering both states the same fact twice. `lang` still
   * names the scrollable region for screen readers when both are given.
   */
  label?: string;
  /** Show the copy button in the header. */
  showCopy?: boolean;
  /**
   * Soft-wrap long lines. `false` (default) scrolls horizontally inside the
   * block; `true` wraps with `whitespace-pre-wrap` + word breaking.
   * @summary Whether long lines wrap, or the block scrolls sideways.
   */
  wrap?: boolean;

  /**
   * Accessible label / tooltip for the copy button at rest. These three labels
   * are plain English defaults rather than translations on purpose: pulling the
   * i18n registry into this leaf costs +5 KB gz, which StreamingMarkdown and
   * ReasoningDisclosure would inherit by embedding it. Pass your own strings to
   * localise.
   * @default 'Copy'
   */
  copyLabel?: string;
  /**
   * Label shown for two seconds after a successful copy.
   * @default 'Copied'
   */
  copiedLabel?: string;
  /**
   * Label shown for two seconds after a FAILED copy — e.g. a denied clipboard
   * permission or a non-secure context.
   * @default 'Copy failed'
   */
  copyFailedLabel?: string;

  /** Called with the copied code after a successful clipboard write. */
  onCopy?: (code: string) => void;
  /**
   * Called with the thrown reason when the clipboard write fails. Without a
   * handler the failure is logged; either way the button reports it.
   */
  onCopyError?: (error: unknown) => void;

  /** Extra header actions rendered to the right, before the copy button. */
  actions?: Snippet;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: root | header | langLabel | copyButton | pre | code.
   * Note `variant="plain"` deliberately leaves root/header/pre without surface,
   * outline or padding — the embedding parent supplies those.
   */
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

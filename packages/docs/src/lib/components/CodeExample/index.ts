import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { CodePanelSlotName } from '../CodePanel/index.js';
import type { CodeExampleSlots, CodeExampleVariantProps } from './codeexample.variants';

/**
 * CodeExample's own slots, plus the {@link CodePanelSlotName} slots it forwards
 * to the embedded panel. `codeSection` is the alias for the panel's `root`.
 */
export type CodeExampleSlotName =
  | CodeExampleSlots
  | 'codeSection'
  | Extract<
      CodePanelSlotName,
      'toolbar' | 'codeToggle' | 'codeChevron' | 'languageTag' | 'copyButton' | 'codeCollapse'
    >;

/**
 * Code example with optional live preview, syntax highlighting, and copy-to-clipboard.
 * Delegates code display to the shared CodePanel primitive.
 *
 * @example
 * ```svelte
 * <CodeExample title="Basic Usage" code={`<Button>Click me</Button>`} language="svelte">
 *   <Button>Click me</Button>
 * </CodeExample>
 * ```
 * @summary A titled code snippet with an optional live preview rendered above it.
 * @tag display
 *
 */
export interface CodeExampleProps
  extends Omit<CodeExampleVariantProps, 'hasPreview'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  /** Title displayed in the card header. */
  title?: string;

  /**
   * Heading level for the example title, clamped to 1..6. Examples usually sit
   * inside a titled `<Section>` (`h2`), so `h3` is the default.
   *
   * Pass `2` on a page whose body is a single untitled `<Section>` — the table
   * feature pages are built that way, and there the fixed `h3` followed the
   * page `h1` directly. The title styling is class-driven, so the level never
   * changes how the card looks.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Source code string to display with syntax highlighting. */
  code?: string;
  /** Language for syntax highlighting (e.g. 'svelte', 'typescript', 'css'). */
  language?: string;
  /** Short description shown between title and preview. */
  description?: string;
  /** Render the live preview section above the code block. @default true */
  preview?: boolean;
  /** Opt-in for the Vite plugin: children are auto-extracted as `code` at build time. */
  isolate?: boolean;
  /** CSS classes for the preview wrapper div when `isolate` is set. */
  previewClass?: string;
  /** Override the default expanded state from the global code-visibility context. */
  defaultExpanded?: boolean;
  /** Live preview content rendered above the code block. */
  children?: Snippet;
  /** Extra classes merged onto the root container element. */
  class?: string;
  /** Remove all default tv styles from internal slots. */
  unstyled?: boolean;
  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<CodeExampleSlotName, string>>;
}

export { default } from './CodeExample.svelte';
export {
  type CodeExampleSlots,
  type CodeExampleVariantProps,
  codeExampleVariants
} from './codeexample.variants';

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

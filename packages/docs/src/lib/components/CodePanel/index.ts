import type { CodePanelVariantProps } from './codepanel.variants';

/**
 * Line count from which `lineNumbers="auto"` starts numbering. Below this a snippet
 * is short enough to scan at a glance, and a gutter is just noise.
 */
export const LINE_NUMBER_AUTO_THRESHOLD = 6;

export type CodePanelSlotName =
  | 'root'
  | 'toolbar'
  | 'codeToggle'
  | 'codeChevron'
  | 'languageTag'
  | 'copyButton'
  | 'copySeparator'
  | 'codeCollapse'
  | 'codeDisplay'
  | 'codeContent'
  | 'loadingContainer'
  | 'loadingText';

/**
 * @description Shared code display primitive with Shiki syntax highlighting, collapsible panel, and copy-to-clipboard.
 * @tag display
 * @related CodeExample
 * @related PlaygroundConfigurator
 */
export interface CodePanelProps extends CodePanelVariantProps {
  /** Source code string to display with syntax highlighting. */
  code: string;
  /** Language for syntax highlighting and the toolbar language tag. @default 'svelte' */
  language?: string;
  /**
   * Human-readable title that names the read-only code region for assistive tech
   * (`aria-label` on the `role="textbox"`). Composed as `Code example: {label}`;
   * falls back to `Code example` when omitted so the name is never empty.
   */
  label?: string;
  /**
   * Show line numbers in the gutter.
   *
   * `'auto'` (the default) shows them only from {@link LINE_NUMBER_AUTO_THRESHOLD} lines
   * up — a snippet short enough to take in at a glance (an import one-liner) gains
   * nothing from a `1` in front of it. Pass `true`/`false` to force it either way.
   *
   * Numbers are rendered as CSS generated content, so they are never part of the
   * copied text or a selection.
   *
   * @default 'auto'
   */
  lineNumbers?: boolean | 'auto';
  /** Controlled expanded state. When omitted, the panel manages its own state. */
  expanded?: boolean;
  /** Called when the toggle button is clicked. Required when `expanded` is controlled. */
  onToggle?: () => void;
  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv styles from internal slots. */
  unstyled?: boolean;
  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<CodePanelSlotName, string>>;
}

export { default } from './CodePanel.svelte';
export {
  type CodePanelSlots,
  type CodePanelVariantProps,
  codePanelVariants
} from './codepanel.variants';

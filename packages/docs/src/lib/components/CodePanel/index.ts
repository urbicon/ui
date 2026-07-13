import type { CodePanelVariantProps } from './codepanel.variants';

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
export { type CodePanelVariantProps, codePanelVariants } from './codepanel.variants';

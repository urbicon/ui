import type { Snippet } from 'svelte';

/**
 * @description Helper interface carrying the primary component's docs — the
 * Menu/Select authoring pattern: `@example` lives here, `WidgetProps` below
 * composes it and has no own examples.
 *
 * @example Items array
 * ```svelte
 * <Widget items={[1, 2, 3]} />
 * ```
 */
export interface WidgetSpecificProps {
  /** Items. */
  items?: number[];
}

/**
 * @description A sibling component exported from the same file — its example
 * must never be attributed to `Widget`.
 * @standalone
 *
 * @example
 * ```svelte
 * <WidgetPanel title="Help" />
 * ```
 */
export interface WidgetPanelProps {
  /** Title. */
  title?: string;
}

/**
 * @description The primary component. Carries no own example tag — the head-scan
 * should pick up WidgetSpecificProps' examples, but not WidgetPanelProps'.
 * @tag display
 */
export interface WidgetProps extends WidgetSpecificProps {
  /** Content. */
  children?: Snippet;
}

export { default as Widget } from './Widget.svelte';
export { default as WidgetPanel } from './WidgetPanel.svelte';

import type { Snippet } from 'svelte';
import type { InfoCardVariantProps } from './infocard.variants';

/**
 * Props interface for InfoCard component
 *
 * @description Simple memo-style card for inline callouts or notes within docs content.
 *
 * @tag display
 * @tag feedback
 * @related Section
 *
 * @example
 * ```svelte
 * <InfoCard title="Tip" icon="lightbulb">Use variants to change tone.</InfoCard>
 * ```
 */
export interface InfoCardProps extends InfoCardVariantProps {
  title?: string;
  icon?: string;
  /**
   * Render the card as a link to this URL. Falls back to a plain `<div>` when omitted.
   */
  href?: string;
  children?: Snippet;
  class?: string;
}

// Export the component
export { default } from './InfoCard.svelte';
// Export variants
export { type InfoCardVariantProps, infoCardVariants } from './infocard.variants';

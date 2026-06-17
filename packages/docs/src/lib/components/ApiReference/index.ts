import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ApiReferenceVariantProps } from './apireference.variants';

/** Single prop entry in the API reference table. */
export interface ApiProp {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
  seeAlso?: string;
  values?: string[];
  source?: {
    type: 'direct' | 'variant' | 'inherited';
    name?: string;
    package?: string;
    url?: string;
  };
  typeAnchor?: string;
  typePreview?: string;
}

/**
 * Structured API reference table for component documentation.
 * Renders props via `@urbicon-ui/table` with per-column cell snippets
 * and `Badge` indicators for source/required status.
 *
 * @example
 * ```svelte
 * <ApiReference props={componentData.props} />
 * ```
 */
export interface ApiReferenceProps
  extends ApiReferenceVariantProps,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Array of prop definitions to display. */
  props: ApiProp[];
  /** Optional usage notes rendered below the table. */
  usageNotes?: Snippet;
  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv styles from the wrapper and cell content. */
  unstyled?: boolean;
  /** Per-slot class overrides for the wrapper elements. */
  slotClasses?: Partial<Record<'base' | 'stats' | 'usageNotes', string>>;
}

export { default } from './ApiReference.svelte';
export { type ApiReferenceVariantProps, apiReferenceVariants } from './apireference.variants';

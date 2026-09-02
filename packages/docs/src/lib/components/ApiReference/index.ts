import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ApiReferenceSlots, ApiReferenceVariantProps } from './apireference.variants';

/** Single prop entry in the API reference table. */
export interface ApiProp {
  name: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
  /**
   * A navigable `@see` target — absolute URL, route-relative path
   * (`/blocks/primitives/button#variants`) or bare fragment (`#type-Foo`).
   * Rendered as a link wrapping the prop's type.
   */
  seeAlso?: string;
  /**
   * Prose `@see` references (bare type/member names such as
   * `HTMLButtonAttributes.value`). They have no doc URL, so they render as
   * literal text under the description instead of as a link.
   */
  seeAlsoRefs?: string[];
  values?: string[];
  /**
   * `@deprecated` on the prop's JSDoc. The message carries the replacement and
   * is the whole point of the tag — a badge alone would say "don't", not "use
   * what instead", so it renders in the expanded row as well.
   */
  deprecated?: { message: string; since?: string; alternative?: string };
  /** `@experimental` on the prop's JSDoc — the prop moves while its component holds still. */
  experimental?: boolean;
  source?: {
    type: 'direct' | 'variant' | 'inherited';
    name?: string;
    package?: string;
    url?: string;
  };
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
 * @summary Sortable, filterable table of a component API with type cross-links and source badges.
 * @tag display
 *
 */
export interface ApiReferenceProps
  extends ApiReferenceVariantProps,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Array of prop definitions to display. */
  props: ApiProp[];
  /**
   * Type entries rendered by a `TypesReference` **on the same page** — pass the same
   * array you pass to `<TypesReference types={…} />`.
   *
   * Type names in the Type column that exactly match an entry become in-page links to
   * it. Omit this (the default) and the column stays plain text: linking is opt-in
   * precisely because a link is only correct when the target is actually on the page.
   */
  types?: Array<{ name: string }>;
  /** Optional usage notes rendered below the table. */
  usageNotes?: Snippet;
  /** Extra classes merged onto the root element. */
  class?: string;
  /**
   * Remove all default tv styles from the wrapper and cell content.
   * @default false
   */
  unstyled?: boolean;
  /** Per-slot class overrides for the wrapper elements. */
  slotClasses?: Partial<Record<ApiReferenceSlots, string>>;
}

export { default } from './ApiReference.svelte';
export {
  type ApiReferenceSlots,
  type ApiReferenceVariantProps,
  apiReferenceVariants
} from './apireference.variants';

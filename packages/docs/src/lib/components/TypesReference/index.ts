import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { TypesReferenceSlots, TypesReferenceVariantProps } from './types-reference.variants';

/** Reference to a prop that uses this type. */
export interface TypeUsedByRef {
  /** Component name owning the prop. */
  component: string;
  /** Prop name within the component. */
  propName: string;
  /** How the type is consumed. */
  source: 'direct' | 'inherited' | 'variant';
}

/** A local type definition extracted from the component source. */
export interface LocalTypeDef {
  /** Type name (e.g. `ButtonProps`). */
  name: string;
  /** TypeScript construct kind. */
  type: 'interface' | 'type' | string;
  /** Raw type definition body. */
  definition: string;
  /** Human-readable documentation string. */
  documentation?: string;
  /** Classification for grouping. */
  category?: 'props' | 'variant' | 'helper' | string;
  /**
   * Where the definition lives relative to the component: `local` (its own
   * `index.ts` / variants file) or `imported` (elsewhere in the package,
   * pulled in through a type-only import).
   *
   * Was `'local' | 'external'`, which was wrong on both members: `external`
   * is a value docs-gen has never emitted, and `imported` — which it emits on
   * 575 of 967 entries — was missing. It went unnoticed because the generated
   * array was typed with a `[key: string]: unknown` index signature, under
   * which tsc never compared the two unions at all. Making the emitted type
   * precise is what brought the disagreement to the surface.
   */
  scope?: 'local' | 'imported';
  /** Props that reference this type. */
  usedByProps?: TypeUsedByRef[];
  /**
   * A `@see` value on the type declaration that the docs can navigate to —
   * an absolute URL, a route-relative path, or a bare `#fragment`.
   */
  seeAlso?: string;
  /**
   * `@see` values on the type declaration that name a sibling type or member
   * rather than a doc target (`CartesianDatum`). Rendered as literal text.
   */
  seeAlsoRefs?: string[];
}

/**
 * Displays expandable type definitions extracted from component source,
 * with inline code blocks, literal value badges, and cross-links to the API Reference.
 *
 * @example
 * ```svelte
 * <TypesReference
 *   types={componentData.types}
 *   title="Type Definitions"
 *   description="Local types used by this component."
 * />
 * ```
 * @summary Expandable table of the local type definitions a component API refers to.
 * @tag display
 *
 */
export interface TypesReferenceProps
  extends Omit<TypesReferenceVariantProps, 'size'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * Density of the expanded panel — code block, badges, footnotes. It does not
   * reach the heading (that is `<Section intent="secondary">`, pinned so the
   * types section reads as a sibling of the API Reference above it) nor the
   * table rows (pinned to `sm`, so both reference tables on a page share one
   * row rhythm).
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';

  /** Array of type definitions to display. */
  types: LocalTypeDef[];

  /**
   * Section heading text. There is no literal default to quote: it falls back
   * to the localized `typesTitle` — "Types" in English, "Typen" in German.
   */
  title?: string;

  /** Descriptive text below the title. */
  description?: string;

  /**
   * Anchor id of the rendered `<Section>`, and the stem its heading id is
   * derived from (`{id}-title`). Keep the default on a component page: it is
   * one half of the anchor pair `ApiReference` jumps to. A page rendering
   * several instances gives each its own.
   * @default 'types'
   */
  id?: string;

  /**
   * Editorial marker before the heading. `true` (the default) claims the
   * page's next section number — the same automatic numbering every other
   * `<Section marker>` on the page uses, so inserting or removing a section
   * renumbers this one too. A string numbers it by hand; `false` leaves it
   * unstamped.
   *
   * An instance rendered inside another section (a playground stage, a code
   * example) never claims a number, whatever this says.
   * @default true
   */
  marker?: string | boolean;

  /**
   * Right-aligned counter in the section header, e.g. `"27 types"` — the same
   * slot the API Reference section uses for its prop count. Unset by default;
   * the toolbar above the table already states the count of what is visible.
   */
  meta?: string;

  /** Extra CSS classes merged onto the root section element. */
  class?: string;

  /**
   * Strip all default tv() styles from internal slots.
   * @default false
   */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<TypesReferenceSlots, string>>;

  /** Optional snippet rendered below the table when no types match the filter. */
  emptyState?: Snippet;
}

/**
 * Extracts literal union values from a type definition string.
 * Recognises single-quoted, double-quoted, boolean, and numeric literals.
 */
export function extractLiteralValues(definition: string): string[] {
  if (!definition) return [];
  const parts = definition.split('|').map((s) => s.trim());
  const values: string[] = [];
  for (const p of parts) {
    const mSingle = p.match(/^'([^']+)'$/);
    const mDouble = p.match(/^"([^"]+)"$/);
    const mBool = p.match(/^(true|false)$/);
    const mNum = p.match(/^[0-9]+$/);
    if (mSingle) values.push(mSingle[1]);
    else if (mDouble) values.push(mDouble[1]);
    else if (mBool) values.push(mBool[1]);
    else if (mNum) values.push(p);
  }
  return values;
}

export { default } from './TypesReference.svelte';
export {
  type TypesReferenceSlots,
  type TypesReferenceVariantProps,
  typesReferenceVariants
} from './types-reference.variants';

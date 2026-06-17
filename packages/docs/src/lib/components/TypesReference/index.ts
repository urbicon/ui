import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { TypesReferenceVariantProps } from './types-reference.variants';

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
  /** Whether the type originates from this package or an external dependency. */
  scope?: 'local' | 'external';
  /** Props that reference this type. */
  usedByProps?: TypeUsedByRef[];
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
 */
export interface TypesReferenceProps
  extends Omit<TypesReferenceVariantProps, 'size'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Controls the density – text size, padding, badge size. */
  size?: 'sm' | 'md' | 'lg';

  /** Array of type definitions to display. */
  types: LocalTypeDef[];

  /** Section heading text. */
  title?: string;

  /** Descriptive text below the title. */
  description?: string;

  /** Extra CSS classes merged onto the root section element. */
  class?: string;

  /** Strip all default tv() styles from internal slots. */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<
    Record<
      | 'root'
      | 'header'
      | 'title'
      | 'description'
      | 'card'
      | 'toolbar'
      | 'codeBlock'
      | 'literalValues'
      | 'literalBadge'
      | 'usedBySection'
      | 'usedByLink',
      string
    >
  >;

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
  type TypesReferenceVariantProps,
  typesReferenceVariants
} from './types-reference.variants';

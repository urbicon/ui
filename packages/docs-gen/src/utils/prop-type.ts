import type { PropInfo } from '@urbicon-ui/shared-types';

/**
 * Whether a type expression spells out every one of `values` itself —
 * `'sm' | 'md'`, `number | 'auto'` — rather than naming them somewhere else
 * (`ComponentIntent`, `ButtonVariants['variant']`, `'auto' | ComponentSize`).
 *
 * The one rule behind `PropInfo.namedType`. `APIDataGenerator` applies it once
 * per prop; the llm.txt Api row and the docs site's API table both read the
 * flag, so they cannot disagree about which types are shown together with
 * their values. The catalog carries the same `values` as data instead
 * (`keyPropValues`), next to a `keyPropTypes` that stays a type expression.
 */
export function typeSpellsValues(type: string, values: readonly string[]): boolean {
  const spelled = new Set(
    type.split('|').map((member) => member.trim().replace(/^(['"])(.*)\1$/, '$2'))
  );
  return values.every((value) => spelled.has(value));
}

/**
 * A prop's type as prose for the llm.txt Api row: the type, followed by the
 * values it stands for when it only names them — `ComponentIntent (primary, …)`.
 * Not a type expression, which is why the catalog does not use it. `wrap`
 * decorates the type part alone (llm.txt sets it in backticks).
 */
export function formatPropType(
  prop: Pick<PropInfo, 'type' | 'values' | 'namedType'>,
  wrap: (type: string) => string = (type) => type
): string {
  const type = wrap(prop.type);
  return prop.namedType && prop.values?.length ? `${type} (${prop.values.join(', ')})` : type;
}

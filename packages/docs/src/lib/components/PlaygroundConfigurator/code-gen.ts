import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';

/**
 * Helpers backing `PlaygroundConfigurator.svelte`. Pure functions only —
 * no Svelte reactivity, no DOM, no `highlighterService` — so they can be
 * unit-tested without spinning up the component.
 */

/** Deep-equality helper used everywhere we compare playground values. */
export function valuesMatch(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Serialise one prop into the `key="value"` / `key={expr}` form used in
 * the live code snippet.
 */
function formatValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? key : `${key}={false}`;
  if (typeof value === 'string') return `${key}="${value}"`;
  if (Array.isArray(value)) {
    const items = value.map((item) => JSON.stringify(item)).join(',\n    ');
    return `${key}={[\n    ${items}\n  ]}`;
  }
  return `${key}={${JSON.stringify(value, null, 2)}}`;
}

/**
 * Build a Svelte-style JSX snippet from the current playground values.
 * Props are sorted alphabetically; values matching a documented default
 * are dropped so the output mirrors what a consumer would actually type.
 */
export function generateDefaultCode(
  name: string,
  vals: Record<string, unknown>,
  defaults: Record<string, unknown> = {}
): string {
  const props = Object.entries(vals)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      if (key === 'children') return false;
      if (key in defaults && valuesMatch(value, defaults[key])) return false;
      if (!(key in defaults)) {
        if (value === false) return false;
        if (value === 'none') return false;
      }
      return true;
    })
    .map(([key, value]) => formatValue(key, value))
    .filter(Boolean);

  const childText = vals.children;
  if (childText && typeof childText === 'string') {
    if (props.length === 0) return `<${name}>${childText}</${name}>`;
    return `<${name}\n  ${props.join('\n  ')}\n>\n  ${childText}\n</${name}>`;
  }

  if (props.length === 0) return `<${name} />`;
  return `<${name}\n  ${props.join('\n  ')}\n/>`;
}

/**
 * Resolve whether `control` should currently be rendered, based on the
 * values held by its dependency controls. Mirrors the three supported
 * condition shapes (`condition`, `dependsOn + equals`, `dependsOn + in`).
 */
export function isConditionMet(
  control: ControlDefinition,
  values: Record<string, unknown>
): boolean {
  if (!control.condition) return true;
  const { dependsOn, equals, condition: condFn } = control.condition;
  if (condFn) return condFn(values);
  if (dependsOn && equals !== undefined) return values[dependsOn] === equals;
  if (control.condition.in && dependsOn) {
    return control.condition.in.includes(values[dependsOn] as string);
  }
  return true;
}

/**
 * Coerce `dropdown`/`select` controls whose items are all booleanish into
 * a `boolean` control, then dedup by `control.key` preferring the
 * boolean variant (variant-props often show up twice: as a boolean and
 * as a select over `[true, false]`).
 */
export function normalizeControls(
  controls: readonly ControlDefinition[] | undefined
): ControlDefinition[] {
  if (!controls) return [];

  const coerced: ControlDefinition[] = controls.map((control) => {
    const isSelect = control.type === 'dropdown' || control.type === 'select';
    const items = control.items ?? [];
    const allBooleanish =
      isSelect &&
      Array.isArray(items) &&
      items.length > 0 &&
      items.every((it) => {
        const v = it?.value;
        return v === true || v === false || v === 'true' || v === 'false';
      });

    if (allBooleanish) {
      return { ...control, type: 'boolean', items: undefined } as ControlDefinition;
    }
    return control;
  });

  const result: ControlDefinition[] = [];
  const byKey = new Map<string, ControlDefinition>();

  for (const c of coerced) {
    const existing = byKey.get(c.key);
    const isBool = c.type === 'boolean' || c.type === 'checkbox';
    if (!existing) {
      byKey.set(c.key, c);
      result.push(c);
    } else {
      const existingIsBool = existing.type === 'boolean' || existing.type === 'checkbox';
      if (isBool && !existingIsBool) {
        const idx = result.findIndex((r) => r.key === c.key);
        if (idx !== -1) result[idx] = c;
        byKey.set(c.key, c);
      }
    }
  }

  return result;
}

/** Keep only the controls whose `condition` currently evaluates true. */
export function filterVisibleControls(
  controls: readonly ControlDefinition[],
  values: Record<string, unknown>
): ControlDefinition[] {
  return controls.filter((c) => isConditionMet(c, values));
}

/**
 * Visual priority used by `sortControlsByType` to cluster like-shaped
 * controls next to each other in the knob strip. Lower number = earlier
 * in the strip. The ordering is "scan-first, type-last" so the reader
 * sees the densest enums up top and the slow-to-edit free-form fields
 * at the bottom.
 */
function controlTypeRank(control: ControlDefinition): number {
  const items = control.items ?? [];
  const isEnum = control.type === 'dropdown' || control.type === 'select';
  // Compact enum → rendered as SegmentGroup text (inline, scannable).
  if (isEnum && items.length > 0 && items.length <= 4) return 0;
  // Boolean → dot toggle (single glance).
  if (control.type === 'boolean' || control.type === 'checkbox') return 1;
  // Long enum → dropdown click required.
  if (isEnum) return 2;
  // Numeric drag.
  if (control.type === 'slider' || control.type === 'range') return 3;
  // Free-form input.
  if (control.type === 'text' || control.type === 'number') return 4;
  // Pickers.
  if (control.type === 'color') return 5;
  return 6;
}

/**
 * Stable type-grouped sort so the knob strip groups SegmentGroups,
 * toggles, selects and inputs together. Ties keep their declared order.
 */
export function sortControlsByType(controls: readonly ControlDefinition[]): ControlDefinition[] {
  return [...controls]
    .map((control, index) => ({ control, index }))
    .sort((a, b) => {
      const r = controlTypeRank(a.control) - controlTypeRank(b.control);
      return r !== 0 ? r : a.index - b.index;
    })
    .map(({ control }) => control);
}

/** Map of `control.key` → `control.defaultValue` for every control that declares one. */
export function computeComponentDefaults(
  controls: readonly ControlDefinition[]
): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const control of controls) {
    if (control.defaultValue !== undefined) {
      map[control.key] = control.defaultValue;
    }
  }
  return map;
}

/** True when the current value for `key` is missing or equal to its documented default. */
export function isDefaultValue(
  key: string,
  values: Record<string, unknown> | undefined,
  defaults: Record<string, unknown>
): boolean {
  if (!values || !(key in defaults)) return true;
  return valuesMatch(values[key], defaults[key]);
}

/** How many controls currently carry a non-default value. */
export function countModified(
  controls: readonly ControlDefinition[],
  values: Record<string, unknown> | undefined,
  defaults: Record<string, unknown>
): number {
  return controls.filter((c) => !isDefaultValue(c.key, values, defaults)).length;
}

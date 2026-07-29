import type { ControlDefinition, ControlOption } from '@urbicon-ui/shared-types/playground';

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

/** Wrapper marking a `consts` entry as literal source text, not a value. */
export interface RawCode {
  raw: string;
}

function isRaw(value: unknown): value is RawCode {
  return typeof value === 'object' && value !== null && typeof (value as RawCode).raw === 'string';
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** Line budget before a nested array/object breaks onto several lines. */
const PRINT_WIDTH = 100;

/** True when every entry is a primitive — the value has no inner structure to unfold. */
function isLeafContainer(value: object): boolean {
  const entries = Array.isArray(value) ? value : Object.values(value);
  return entries.every((v) => v === null || (typeof v !== 'object' && typeof v !== 'function'));
}

/**
 * Print a value as the JavaScript source that would produce it.
 *
 * Deliberately not `JSON.stringify`: a snippet a reader copies has to look
 * like the repo's own code — single quotes, unquoted identifier keys, and a
 * line break only where the one-line form would not fit.
 *
 * @throws on functions and symbols. They have no faithful source form here (a
 * printed arrow function usually closes over identifiers the snippet does not
 * contain), and silently dropping them would hand the reader code that does
 * not do what the demo above it does. Pass `{ raw: '…' }` instead and decide
 * consciously what the snippet should say.
 */
export function serializeValue(value: unknown, indent = 2): string {
  if (isRaw(value)) return value.raw;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\');
    // A quoted literal cannot hold a line break — printing one produced a
    // snippet that does not parse, which is worse than an ugly one. Multi-line
    // strings are exactly what a `CodeBlock`'s `code` or a Markdown demo is, so
    // this is the common case, not the exotic one: template literal, with the
    // two sequences that would end or interpolate it escaped.
    if (escaped.includes('\n')) {
      return `\`${escaped.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
    }
    return `'${escaped.replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(
      `serializeValue: cannot print a ${typeof value}. Wrap it as \`{ raw: '…' }\` and write the ` +
        `source the snippet should show — including anything it refers to.`
    );
  }
  if (value instanceof Date) return `new Date('${value.toISOString()}')`;

  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);

  // Ein Container bricht um, wenn er selbst Container enthält — oder wenn seine
  // einzeilige Form nicht mehr in die Zeile passt. Ein *flacher* Wert bricht
  // nie: Ein Datensatz wie `{ id: 1, name: 'Emma Wilson', … }` ist eine Einheit;
  // über sechs Zeilen verteilt liest er sich schlechter als ein paar Zeichen
  // Überhang. Deshalb eine Regel statt einer auf einen Datensatz getunten Zahl.
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const parts = value.map((v) => serializeValue(v, indent + 2));
    const oneLine = `[${parts.join(', ')}]`;
    const fits = isLeafContainer(value) || indent + oneLine.length <= PRINT_WIDTH;
    if (fits && !oneLine.includes('\n')) return oneLine;
    return `[\n${parts.map((p) => inner + p).join(',\n')}\n${pad}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return '{}';
  const parts = entries.map(
    ([k, v]) => `${IDENTIFIER.test(k) ? k : `'${k}'`}: ${serializeValue(v, indent + 2)}`
  );
  const oneLine = `{ ${parts.join(', ')} }`;
  const fits = isLeafContainer(value) || indent + oneLine.length <= PRINT_WIDTH;
  if (fits && !oneLine.includes('\n')) return oneLine;
  return `{\n${parts.map((p) => inner + p).join(',\n')}\n${pad}}`;
}

/**
 * The half of a snippet the controls know nothing about.
 *
 * Some components are fully described by their props — `<Button variant="ghost">`
 * *is* the usage, and the generated tag alone is the right answer. Others need
 * data before the tag means anything: a `Table` without `columns` and `items`,
 * an `A2UIView` without a `payload`. For those the snippet has to carry a
 * `<script>` block, and this is how a playground supplies it.
 *
 * `consts` takes the **actual objects the demo renders**, not a copy of them as
 * text — so the snippet cannot drift from the preview above it. Live control
 * values still flow into the tag as before.
 */
export interface CodeSetup {
  /** Import lines, in the order they should appear. */
  imports?: string[];
  /**
   * `const <name> = <value>` per entry, printed from the value itself. Use
   * `{ raw: '…' }` for anything without a faithful printed form (functions,
   * snippet references).
   */
  consts?: Record<string, unknown>;
  /**
   * `let <name> = $state(<value>)` per entry — what a `bind:` needs on the
   * other side. A `<Dialog bind:open />` snippet without the `let` is not code
   * anyone can run.
   */
  state?: Record<string, unknown>;
  /** Names passed to the component as the `{name}` shorthand, ahead of the control props. */
  bind?: string[];
  /**
   * Names passed as `bind:name`. Only for props the demo really binds two-way —
   * a `Progress` that reads a `$state` value still passes it one way, and
   * printing `bind:value` would document an API it does not have.
   */
  twoWay?: string[];
  /**
   * Controls that steer the demo but are not props of the component (a
   * scenario switch, a "show marks" toggle). They drive the preview and must
   * not show up in the snippet as an attribute that does not exist.
   */
  demoOnly?: string[];
}

/** Renders the `<script>` block of a snippet, or `''` when there is nothing to declare. */
function generateSetupBlock({ imports = [], consts = {}, state = {} }: CodeSetup): string {
  const lines: string[] = [];
  if (imports.length) lines.push(...imports.map((i) => `  ${i}`));

  // Bindable state first: it is what the tag below binds to, and a reader
  // scanning the script wants the mutable pieces before the fixed data.
  const stateLines = Object.entries(state).map(
    ([name, value]) => `  let ${name} = $state(${serializeValue(value, 2)});`
  );
  const constLines = Object.entries(consts).map(
    ([name, value]) => `  const ${name} = ${serializeValue(value, 2)};`
  );
  const declarations = [...stateLines, ...constLines];
  if (declarations.length) {
    if (lines.length) lines.push('');
    lines.push(...declarations);
  }
  if (!lines.length) return '';
  return `<script lang="ts">\n${lines.join('\n')}\n</script>\n\n`;
}

/**
 * Build a Svelte-style JSX snippet from the current playground values.
 * Props are sorted alphabetically; values matching a documented default
 * are dropped so the output mirrors what a consumer would actually type.
 *
 * With a `setup`, the result is a complete, copyable file: imports and data
 * declarations above, the tag below, with the bound names as `{shorthand}`
 * props ahead of the live control values.
 */
export function generateDefaultCode(
  name: string,
  vals: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
  setup?: CodeSetup,
  /**
   * The demo's own children, lifted from the playground source by
   * `extractChildMarkup`. Printed verbatim between the tags — it is markup, so
   * there is no data form it could take, and re-typing it here by hand would be
   * the drifting second copy `codeSetup` exists to avoid.
   */
  childMarkup?: string | null
): string {
  const demoOnly = new Set(setup?.demoOnly ?? []);
  const props = Object.entries(vals)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      if (key === 'children') return false;
      if (demoOnly.has(key)) return false;
      if (key in defaults && valuesMatch(value, defaults[key])) return false;
      if (!(key in defaults)) {
        if (value === false) return false;
        if (value === 'none') return false;
      }
      return true;
    })
    .map(([key, value]) => formatValue(key, value))
    .filter(Boolean);

  // Bound data first: `{columns}` and `{items}` are what makes the tag
  // meaningful, the control values are the adjustments on top.
  const twoWay = setup?.twoWay ?? [];
  const shorthand = (setup?.bind ?? []).filter((n) => !twoWay.includes(n));
  const allProps = [...twoWay.map((n) => `bind:${n}`), ...shorthand.map((n) => `{${n}}`), ...props];
  const script = setup ? generateSetupBlock(setup) : '';

  // A `children` control (plain text) and extracted markup are the same slot;
  // the control wins, because a playground that offers one puts the reader's
  // own text there and the snippet must show what they typed.
  const childText = vals.children;
  const children =
    childText && typeof childText === 'string'
      ? childText
      : (childMarkup?.trim() ?? '') !== ''
        ? (childMarkup as string)
        : '';

  if (children) {
    const indented = children
      .split('\n')
      .map((line) => (line === '' ? line : `  ${line}`))
      .join('\n');
    if (allProps.length === 0) {
      // One short line stays one line — `<Badge>New</Badge>` reads worse broken
      // up. Same width rule as `serializeValue`, so both halves of a snippet
      // wrap at the same place.
      const oneLine = `<${name}>${children}</${name}>`;
      if (!children.includes('\n') && oneLine.length <= PRINT_WIDTH) return `${script}${oneLine}`;
      return `${script}<${name}>\n${indented}\n</${name}>`;
    }
    return `${script}<${name}\n  ${allProps.join('\n  ')}\n>\n${indented}\n</${name}>`;
  }

  if (allProps.length === 0) return `${script}<${name} />`;
  return `${script}<${name}\n  ${allProps.join('\n  ')}\n/>`;
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
 * `'true'`/`'false'` → the actual boolean; anything else passes through.
 * Only used where a control has just been declared boolean, so a stray
 * non-booleanish value would be a bug elsewhere, not something to coerce.
 */
function booleanish(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
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
      // Changing the control's *type* without changing its *values* is what let
      // a string `'false'` reach a switch: the Toggle renders
      // `Boolean(values[key])`, and `Boolean('false')` is `true`. The control
      // read "on" while the component, handed the same `'false'`, stayed off.
      // A boolean control must carry booleans, so the defaults come along.
      return {
        ...control,
        type: 'boolean',
        items: undefined,
        defaultValue: booleanish(control.defaultValue),
        componentDefault: booleanish(control.componentDefault)
      } as ControlDefinition;
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

/**
 * The range rule for a numeric control, in one place because three callers
 * must agree on it: both halves of the share codec and the strip's number
 * field. A control with neither bound admits any finite number.
 */
export function isWithinRange(control: ControlDefinition, value: number): boolean {
  if (control.min !== undefined && value < control.min) return false;
  if (control.max !== undefined && value > control.max) return false;
  return true;
}

/** `value` pulled to the nearest bound it violates. */
export function clampToRange(control: ControlDefinition, value: number): number {
  if (control.min !== undefined && value < control.min) return control.min;
  if (control.max !== undefined && value > control.max) return control.max;
  return value;
}

/**
 * The number a numeric control currently stands at: its value, else its
 * documented default, else its floor. Never `undefined`, so the field always
 * has something to render and blur always has something to fall back to.
 */
export function numberFieldValue(
  control: ControlDefinition,
  values: Record<string, unknown> | undefined
): number {
  const current = values?.[control.key];
  if (typeof current === 'number' && Number.isFinite(current)) return current;
  if (typeof control.defaultValue === 'number' && Number.isFinite(control.defaultValue)) {
    return control.defaultValue;
  }
  return control.min ?? 0;
}

/**
 * What the text in a number field may be committed as *while typing*, or
 * `undefined` for "not yet". `min`/`max` on `<input type="number">` are
 * validity constraints, not input filters — the field hands back whatever was
 * typed and `Number('')` is 0 — so anything blank, non-finite or out of range
 * is held back rather than written into `values`.
 *
 * Out-of-range is rejected rather than clamped here because a reader typing
 * "15" into a `min: 10` field passes through "1": clamping mid-keystroke would
 * rewrite the field under the caret. `reconcileNumberField` clamps on blur,
 * once the reader has stopped.
 */
export function readNumberField(control: ControlDefinition, raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return isWithinRange(control, parsed) ? parsed : undefined;
}

/**
 * What a number field settles on when the reader leaves it: the clamp of what
 * they typed, or `committed` if they left it blank or unparseable. This is the
 * only place a playground number is clamped, and the correction is visible in
 * the field the instant it happens — unlike rewriting a shared link, which the
 * codec refuses to do.
 */
export function reconcileNumberField(
  control: ControlDefinition,
  raw: string,
  committed: number
): number {
  if (raw.trim() === '') return committed;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return committed;
  return clampToRange(control, parsed);
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

/** Keys of controls that steer the demo and must stay out of the snippet. */
export function computeDemoOnlyKeys(controls: readonly ControlDefinition[]): string[] {
  return controls.filter((c) => c.demoOnly).map((c) => c.key);
}

/**
 * The values the *component* falls back to when a prop is omitted — the basis
 * for deciding what the code snippet may leave out.
 *
 * Distinct from {@link computeComponentDefaults}, which answers "where does
 * this playground start" and drives the reset affordance. The two differ
 * wherever a playground opens on something other than the component default,
 * and using the wrong one prints a snippet that renders differently from the
 * preview it sits under.
 */
export function computeOmittableDefaults(
  controls: readonly ControlDefinition[]
): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const control of controls) {
    // `deriveControls` records what the component does without the prop. When
    // it recorded *nothing*, the component has no default — omitting the prop
    // would render something else than the preview does (an Alert without its
    // `title` has no heading), so such a value is never omittable.
    if ('componentDefault' in control) {
      if (control.componentDefault !== undefined) map[control.key] = control.componentDefault;
      continue;
    }
    // Hand-written control lists carry only one notion of "default".
    if (control.defaultValue !== undefined) map[control.key] = control.defaultValue;
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

/**
 * The dropdown `<Select>` branch of a `dropdown`/`select` control renders
 * options built from `items.map(item => ({ ..., value: String(item.value) }))`
 * — string options, regardless of the control's real value type (e.g. a
 * numeric `headingLevel`). `values[control.key]` still holds that real type,
 * so the trigger's bound `value` must be stringified to match, or the Select
 * finds no option with `===` equality and falls back to the placeholder
 * (`'2' !== 2`). `null`/`undefined` pass through so the "nothing selected" /
 * null-option branch still applies.
 */
export function selectDisplayValue(current: unknown): string | null {
  return current === null || current === undefined ? null : String(current);
}

/**
 * Reverse of `selectDisplayValue`, applied to what `onValueChange` fires
 * back: the selected option's string, mapped to the ORIGINAL, typed
 * `item.value` it was stringified from (a numeric `headingLevel` stays a
 * number), so `values` never drifts from the control's declared type. Falls
 * back to the raw string if no item matches — every fired value came from
 * `options`, which mirrors `items` 1:1, so this is a defensive fallback, not
 * an expected path.
 */
export function resolveSelectValue(
  items: readonly ControlOption[],
  selected: string | null
): unknown {
  if (selected === null) return null;
  const match = items.find((item) => String(item.value) === selected);
  return match ? match.value : selected;
}

/**
 * The SegmentGroup arm of the same boundary (enum controls with ≤ 4 options
 * render as a SegmentGroup instead of a Select). SegmentGroup fires a plain
 * string — `''` when the selection is cleared — so this maps the empty string
 * to `null` and everything else through {@link resolveSelectValue}, keeping a
 * numeric or boolean enum's bound value typed instead of silently drifting it
 * to a string (the Select branch got this in the headingLevel fix; this is
 * its deliberately-scoped-out sibling).
 */
export function resolveSegmentValue(items: readonly ControlOption[], selected: string): unknown {
  return selected === '' ? null : resolveSelectValue(items, selected);
}

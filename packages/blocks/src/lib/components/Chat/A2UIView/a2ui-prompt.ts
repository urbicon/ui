/**
 * System-prompt generator for an A2UI catalog. Renders the agent-facing catalog
 * description straight from the catalog's registry, so the prompt and the
 * validator can never drift (a drift-guard test asserts every component and enum
 * value is covered). Pure TS, no Svelte — a server building the prompt has no
 * DOM, and this module never imports catalog VALUE code from `urbicon/` (the
 * caller passes the spec), so it stays out of the Basic bundle.
 *
 * With no options the output is the Basic-catalog prompt, byte-identical to
 * before the catalog refactor. Pass `catalog` to render a richer catalog: when
 * its specs carry categories / shared axes (the Urbicon catalog), the prompt
 * grows a "Shared axes" section, groups components by category, compresses
 * shared-axis props, and adds catalog-specific don'ts — all gated on features
 * the Basic catalog does not have, so the default stays untouched.
 *
 * Deliberately excludes any TRANSPORT section (how envelopes reach the client)
 * and any data-schema section: those are app-specific and each app appends them
 * (the chat-demo appends its fenced `a2ui` protocol + `a2uiDataSchemaSection`).
 */

import { type A2uiCatalogSpec, basicA2uiCatalogSpec } from './a2ui-catalog';
import type { A2uiComponentSpec, A2uiPropSpec } from './a2ui-registry';

/** Props documented once in the shared section rather than per component. */
const COMMON_PROP_KEYS = new Set(['accessibility', 'weight']);

/** Category order for grouped rendering; unknown categories follow, sorted. */
const CATEGORY_ORDER = ['Layout', 'Text', 'Form', 'Status', 'Media'];

/** The catalog-enrichment fields the prompt reads structurally (present on the Urbicon registry). */
type EnrichedPropSpec = A2uiPropSpec & { sharedAxis?: string };
type EnrichedComponentSpec = A2uiComponentSpec & { category?: string };

function sharedAxisOf(spec: A2uiPropSpec): string | undefined {
  return (spec as EnrichedPropSpec).sharedAxis;
}
function categoryOf(spec: A2uiComponentSpec): string | undefined {
  return (spec as EnrichedComponentSpec).category;
}

/** Collect the distinct shared axes (name → value list) referenced across the registry. */
function collectSharedAxes(
  registry: Readonly<Record<string, A2uiComponentSpec>>
): Map<string, readonly string[]> {
  const axes = new Map<string, readonly string[]>();
  for (const spec of Object.values(registry)) {
    for (const propSpec of Object.values(spec.props)) {
      const shared = sharedAxisOf(propSpec);
      if (shared && propSpec.values && !axes.has(shared)) axes.set(shared, propSpec.values);
    }
  }
  return axes;
}

function renderKind(spec: A2uiPropSpec): string {
  const shared = sharedAxisOf(spec);
  if (shared) return `shared ${shared} (see Shared axes)`;
  switch (spec.kind) {
    case 'enum':
    case 'icon':
      return `one of: ${(spec.values ?? []).join(' | ')}`;
    case 'string':
      return spec.dynamic ? 'string literal or { path } binding' : 'string';
    case 'number':
      return spec.dynamic ? 'number literal or { path } binding' : 'number';
    case 'boolean':
      return spec.dynamic ? 'boolean literal or { path } binding' : 'boolean';
    case 'stringList':
      return 'string array or { path } binding';
    case 'childId':
      return 'component id (string)';
    case 'childList':
      return 'array of ids OR template { componentId, path }';
    case 'labeledChildren':
      return `array of { ${spec.labelKey ?? 'label'}, child } (child is a component id)`;
    case 'action':
      return 'action { event: { name, context } }';
    case 'options':
      return spec.dynamic
        ? 'array of { label, value }, or { path } binding to such an array'
        : 'array of { label, value }';
    case 'accessibility':
      return 'object { label?, description? }';
  }
}

function renderProp(key: string, spec: A2uiPropSpec): string {
  const flags: string[] = [];
  flags.push(spec.required ? 'required' : 'optional');
  flags.push(renderKind(spec));
  if (spec.default !== undefined) flags.push(`default ${JSON.stringify(spec.default)}`);
  return `  - ${key} (${flags.join('; ')}): ${spec.description}`;
}

function renderComponent(name: string, spec: A2uiComponentSpec, heading: string): string {
  const lines: string[] = [`${heading} ${name}`, spec.description, 'Props:'];
  for (const [key, propSpec] of Object.entries(spec.props)) {
    if (COMMON_PROP_KEYS.has(key) || propSpec.promptHidden) continue;
    lines.push(renderProp(key, propSpec));
  }
  return lines.join('\n');
}

/** Flat component list — the Basic rendering (byte-identical). */
function renderFlatComponents(
  registry: Readonly<Record<string, A2uiComponentSpec>>,
  names: string[]
): string {
  return [
    '## Components',
    '',
    ...names.map((name) => renderComponent(name, registry[name], '###'))
  ].join('\n\n');
}

/** Category-grouped component list — the Urbicon rendering. */
function renderGroupedComponents(
  registry: Readonly<Record<string, A2uiComponentSpec>>,
  names: string[]
): string {
  const byCategory = new Map<string, string[]>();
  for (const name of names) {
    const category = categoryOf(registry[name]) ?? 'Other';
    let list = byCategory.get(category);
    if (!list) {
      list = [];
      byCategory.set(category, list);
    }
    list.push(name);
  }
  const known = CATEGORY_ORDER.filter((category) => byCategory.has(category));
  const extra = [...byCategory.keys()]
    .filter((category) => !CATEGORY_ORDER.includes(category))
    .sort();
  const parts: string[] = ['## Components'];
  for (const category of [...known, ...extra]) {
    parts.push(`### ${category}`);
    for (const name of byCategory.get(category) ?? []) {
      parts.push(renderComponent(name, registry[name], '####'));
    }
  }
  return parts.join('\n\n');
}

/**
 * Build the A2UI system prompt. Pass `catalogId` to override the advertised
 * `createSurface` catalog id, and `catalog` to render a specific catalog's
 * components (defaults to the Basic catalog — byte-identical output).
 */
export function a2uiSystemPrompt(options?: {
  catalogId?: string;
  catalog?: A2uiCatalogSpec;
}): string {
  const catalog: A2uiCatalogSpec = options?.catalog ?? basicA2uiCatalogSpec;
  const catalogId = options?.catalogId ?? catalog.catalogId;
  const registry = catalog.registry;
  const componentNames = Object.keys(registry);

  const sharedAxes = collectSharedAxes(registry);
  const grouped = componentNames.some((name) => categoryOf(registry[name]) !== undefined);
  const hasRichText = 'RichText' in registry;
  const hasSelectArray = 'Select' in registry && registry.Select.props.value?.kind === 'stringList';

  const sections: string[] = [];

  sections.push(
    [
      '# A2UI rendering',
      '',
      'You can render live, interactive UI by emitting A2UI (Agent-to-UI) envelopes',
      'against the catalog below. Emit UI when a structured surface (form, list, card,',
      'chooser) serves the user better than prose; otherwise answer in plain text.',
      '',
      `Protocol version: v0.9.1. Catalog id: ${catalogId}`
    ].join('\n')
  );

  sections.push(
    [
      '## Envelopes',
      '',
      'Emit one JSON envelope per line (JSONL), as COMPACT single-line JSON — never',
      'pretty-print or wrap one envelope across multiple lines, even a large',
      'updateComponents. Every envelope is an object with a',
      '"version" of "v0.9.1" and EXACTLY ONE of these operations:',
      '',
      `- createSurface: { surfaceId, catalogId: "${catalogId}" } — send this FIRST.`,
      '- updateComponents: { surfaceId, components: [ ... ] } — the component tree.',
      '- updateDataModel: { surfaceId, path?, value? } — the surface state.',
      '- deleteSurface: { surfaceId } — remove a surface.',
      '',
      'Rules:',
      '- components is a FLAT list; each entry is { id, component, ...props }.',
      '- EXACTLY ONE component MUST have id "root" — it is the tree root.',
      '- Children are referenced by ID only — NEVER define a component inline.',
      '- A single-child container (Card, Button) uses "child" (one id).',
      '- A multi-child container (Row, Column, List) uses "children": either an',
      '  array of ids, or a template { componentId, path } that repeats one',
      '  component over a data-model array.',
      '- Stream components incrementally: send SEVERAL updateComponents envelopes',
      '  ("root" and its top-level containers in the FIRST one, then a few',
      '  components per envelope) so the UI renders progressively while you write.',
      '  The client buffers until "root" exists and shows placeholders for',
      '  children that have not arrived yet.'
    ].join('\n')
  );

  sections.push(
    [
      '## Surfaces live on, and you only hear from them when the user acts',
      '',
      'A surfaceId is unique for as long as the client runs, and a surface stays',
      'alive and editable after the reply that created it. Send further envelopes',
      'for the SAME surfaceId later and it updates in place, keeping what the user',
      'typed. Prefer ONE surface that grows over a chain of near-identical ones.',
      '',
      '- updateDataModel to fill in a value you just learned; updateComponents to',
      '  add or change controls. Re-sending a component id REPLACES it — to append',
      '  a child, re-send its container with the full children list.',
      '- Never createSurface twice for one id, and never rebuild an equivalent',
      "  surface under a new id to change a field: both discard the user's input.",
      '- deleteSurface when a surface has served its purpose.',
      '',
      'But you are NOT watching the form. The client speaks to you in exactly one',
      'case: the user activates a control carrying an `action`. Typing, picking a',
      'date, choosing an option — all of it updates the data model LOCALLY and',
      'tells you nothing.',
      '',
      '- Anything you mean to fill in later needs a control the user can press to',
      '  ask you for it ("Show available times"), with the fields it depends on in',
      '  its action.context. An empty area with no trigger is a dead end — never',
      '  write "pick a date and I will show the times" without one.',
      '- But do NOT route a plain choice through you. A control that only records',
      '  what the user picked should BIND: a single-choice input with',
      '  value: { path } highlights the selection instantly, no round-trip. A row',
      '  of Buttons that each set a value is the wrong shape — buttons show no',
      '  selected state, so the choice looks lost, and every tap costs a turn.',
      '  Reach for an action only when YOU must fetch or commit something.',
      '- Options you fetched belong in the data model: write them with',
      '  updateDataModel and bind options: { path } (see the prop docs), rather',
      '  than rewriting the component for every result.',
      '- Set "sendDataModel": true on createSurface: every action then carries the',
      "  surface's ENTIRE data model, so you see what the user filled in even for",
      '  fields you left out of context. Prefer it on any form you will act on.',
      '- If an action arrives with required fields still empty, do NOT carry it',
      '  out — patch a short message next to the offending field instead. You are',
      '  the only validator; the client submits whatever it is given.'
    ].join('\n')
  );

  sections.push(
    [
      '## Data bindings',
      '',
      'Any value prop may be a literal OR a data binding { "path": "/json/pointer" }',
      '(RFC 6901). Inside a template, use a RELATIVE path (no leading slash) to address',
      'the current array item, e.g. { "path": "name" }.',
      '',
      'Inputs are two-way: typing/checking/selecting writes back into the data model',
      'immediately; bound text updates live. Update state with updateDataModel — omit',
      '"value" to DELETE the key at "path".',
      '',
      'Function-call bindings ({ "call": ..., "args": ... }) are NOT supported and',
      'resolve to nothing — do NOT use them. Use literals and { path } only.'
    ].join('\n')
  );

  sections.push(
    [
      '## Actions',
      '',
      'A Button action MUST be a server event: { "event": { "name": string,',
      '"context": { ... } } }. Context values may be literals or { path } bindings and',
      'are resolved before dispatch. Do NOT use local function-call actions.'
    ].join('\n')
  );

  if (sharedAxes.size > 0) {
    const lines = [
      '## Shared axes',
      '',
      'Several components share these value sets. A prop documented as "shared intent"',
      'or "shared size" accepts exactly the values listed here — pick one:'
    ];
    for (const axis of ['intent', 'size']) {
      const values = sharedAxes.get(axis);
      if (values) lines.push(`- ${axis}: ${values.join(' | ')}`);
    }
    for (const [axis, values] of sharedAxes) {
      if (axis !== 'intent' && axis !== 'size') lines.push(`- ${axis}: ${values.join(' | ')}`);
    }
    sections.push(lines.join('\n'));
  }

  sections.push(
    grouped
      ? renderGroupedComponents(registry, componentNames)
      : renderFlatComponents(registry, componentNames)
  );

  sections.push(
    [
      '## Common props (every component)',
      '',
      '- accessibility (optional; object { label?, description? }): ARIA label/description.',
      '- weight (optional; number): flex-grow, honored ONLY on a direct Row/Column child.'
    ].join('\n')
  );

  sections.push(
    [
      '## Icons',
      '',
      `Icon.name must be one of: ${catalog.iconNames.join(', ')}. Unknown names render a`,
      'fallback glyph.'
    ].join('\n')
  );

  const donts = [
    "## Don'ts",
    '',
    '- Do NOT define children inline; reference them by id.',
    '- Do NOT use more than one "root".',
    '- Do NOT use function-call bindings or local function-call actions.',
    `- Do NOT use unsupported components: ${[...catalog.unsupportedComponents].join(', ')}.`
  ];
  if (hasRichText) {
    donts.push(
      '- Text renders PLAIN — a literal "**x**" shows the asterisks. For bold/italic/',
      '  lists/links/code use RichText, never Text.'
    );
  } else {
    donts.push(
      '- Do NOT put HTML, images or links in Text markdown (inline bold/italic/code only).'
    );
  }
  if (hasSelectArray) {
    donts.push(
      '- A Select `value` is ALWAYS a string ARRAY — even single-select writes a',
      '  one-element array. RadioGroup `value` is a single string.'
    );
  }
  if (hasRichText) {
    donts.push('- Do NOT set an intent on a form field for errors — use its `error` string prop.');
  }
  donts.push('- Images are blocked by default — always give Image a meaningful description.');
  sections.push(donts.join('\n'));

  return sections.join('\n\n');
}

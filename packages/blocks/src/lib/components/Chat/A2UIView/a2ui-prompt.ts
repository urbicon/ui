/**
 * System-prompt generator for the A2UI subset. Renders the agent-facing catalog
 * description straight from `A2UI_REGISTRY`, so the prompt and the validator can
 * never drift (a drift-guard test asserts every component and enum value is
 * covered). Pure TS, no Svelte — a server building the prompt has no DOM.
 *
 * Deliberately excludes any TRANSPORT section (how envelopes reach the client):
 * that is app-specific and each app appends it (the chat-demo appends its fenced
 * `a2ui` JSONL protocol).
 */

import {
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_REGISTRY,
  type A2uiPropSpec,
  UNSUPPORTED_A2UI_COMPONENTS
} from './a2ui-registry';

/** Props documented once in the shared section rather than per component. */
const COMMON_PROP_KEYS = new Set(['accessibility', 'weight']);

function renderKind(spec: A2uiPropSpec): string {
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
    case 'action':
      return 'action { event: { name, context } }';
    case 'options':
      return 'array of { label, value }';
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

function renderComponent(name: string): string {
  const spec = A2UI_REGISTRY[name];
  const lines: string[] = [`### ${name}`, spec.description, 'Props:'];
  for (const [key, propSpec] of Object.entries(spec.props)) {
    if (COMMON_PROP_KEYS.has(key) || propSpec.promptHidden) continue;
    lines.push(renderProp(key, propSpec));
  }
  return lines.join('\n');
}

/**
 * Build the A2UI system prompt for this subset. Pass `catalogId` to override the
 * default `createSurface` catalog identifier (the value must round-trip
 * unchanged in every envelope).
 */
export function a2uiSystemPrompt(options?: { catalogId?: string }): string {
  const catalogId = options?.catalogId ?? A2UI_CATALOG_ID;
  const componentNames = Object.keys(A2UI_REGISTRY);

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
      'Emit one JSON envelope per line (JSONL). Every envelope is an object with a',
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
      '- You may stream components incrementally; buffer until "root" exists.'
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

  sections.push(['## Components', '', ...componentNames.map(renderComponent)].join('\n\n'));

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
      `Icon.name must be one of: ${A2UI_ICON_NAMES.join(', ')}. Unknown names render a`,
      'fallback glyph.'
    ].join('\n')
  );

  sections.push(
    [
      "## Don'ts",
      '',
      '- Do NOT define children inline; reference them by id.',
      '- Do NOT use more than one "root".',
      '- Do NOT use function-call bindings or local function-call actions.',
      `- Do NOT use unsupported components: ${[...UNSUPPORTED_A2UI_COMPONENTS].join(', ')}.`,
      '- Do NOT put HTML, images or links in Text markdown (inline bold/italic/code only).',
      '- Images are blocked by default — always give Image a meaningful description.'
    ].join('\n')
  );

  return sections.join('\n\n');
}

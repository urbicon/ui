/**
 * Optional per-surface DATA schema for the A2UI engine — the data-model side of
 * the registry's prop typing (findings §4.3). A schema declares the shape of the
 * fields a surface's data model may hold (JSON Pointer → type + optional
 * enum/format/description). It does two things:
 * - documents the declared fields in the system prompt (`a2uiDataSchemaSection`),
 *   so the agent knows which paths exist and what they hold;
 * - validates `updateDataModel` writes against those declarations
 *   (`validateSchemaWrite`), turning a type mismatch on a declared pointer into a
 *   `SCHEMA_TYPE_MISMATCH` error and a write to an undeclared top-level branch
 *   into a `SCHEMA_UNDECLARED_PATH` warning — both relayed through the same
 *   `onValidationError` feedback loop the agent already consumes.
 *
 * Pure TS, no Svelte. Deliberately MINIMAL (v1): exact-pointer type/enum checks
 * and a top-level "did you mean to write here?" warning. Deferred: required
 * fields, nested object schemas, cross-field constraints, and transporting the
 * schema inside the envelope.
 */

import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
import { getAtPointer } from './a2ui-data';

/** The JSON primitive/shape a declared field holds. */
export type A2uiSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

/** One declared field: its type plus optional enum/format/description for the prompt. */
export interface A2uiSchemaField {
  type: A2uiSchemaType;
  /** Agent-facing description; emitted into the prompt verbatim. */
  description?: string;
  /** Allowed literal values (documented + enforced for string/number fields). */
  enum?: readonly (string | number)[];
  /** A format hint (e.g. `date`, `time`, `email`) — documented, not enforced in v1. */
  format?: string;
}

/** Surface data schema: absolute JSON Pointer → field declaration. */
export type A2uiDataSchema = Readonly<Record<string, A2uiSchemaField>>;

function typeMatches(type: A2uiSchemaType, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

/** The first pointer segment (`/booking/date` → `booking`); `''` for the root. */
function topSegment(pointer: string): string {
  const trimmed = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  return trimmed.split('/')[0] ?? '';
}

function fieldIssues(
  field: A2uiSchemaField,
  pointer: string,
  value: unknown,
  surfaceId: string | undefined
): A2uiValidationIssue[] {
  if (!typeMatches(field.type, value)) {
    return [
      {
        severity: 'error',
        code: A2UI_ISSUE_CODES.SCHEMA_TYPE_MISMATCH,
        surfaceId,
        path: pointer,
        message: `Data at "${pointer}" must be a ${field.type} per the surface schema`
      }
    ];
  }
  if (
    field.enum &&
    (typeof value === 'string' || typeof value === 'number') &&
    !field.enum.includes(value)
  ) {
    return [
      {
        severity: 'error',
        code: A2UI_ISSUE_CODES.SCHEMA_TYPE_MISMATCH,
        surfaceId,
        path: pointer,
        message: `Data at "${pointer}" must be one of: ${field.enum.join(', ')}`
      }
    ];
  }
  return [];
}

/**
 * Validate one `updateDataModel` write against the schema. `pointer` is the
 * write target (`''`/`'/'`/`undefined` = whole model); `value` is the written
 * value (`undefined` for a delete — never flagged). Returns any schema issues.
 */
export function validateSchemaWrite(
  schema: A2uiDataSchema,
  pointer: string | undefined,
  value: unknown,
  surfaceId?: string
): A2uiValidationIssue[] {
  if (value === undefined) return []; // a delete never violates a type
  const whole = pointer === undefined || pointer === '' || pointer === '/';

  if (whole) {
    // Whole-model write: check every declared field against the new model.
    const issues: A2uiValidationIssue[] = [];
    for (const [declaredPointer, field] of Object.entries(schema)) {
      const at = getAtPointer(value, declaredPointer);
      if (at !== undefined) issues.push(...fieldIssues(field, declaredPointer, at, surfaceId));
    }
    return issues;
  }

  const field = schema[pointer];
  if (field) return fieldIssues(field, pointer, value, surfaceId);

  // Undeclared pointer: warn only when its whole top-level branch is unknown, so
  // a write into a declared object (a deeper path we don't model yet) stays quiet.
  const top = topSegment(pointer);
  const declared = Object.keys(schema).some(
    (declaredPointer) => topSegment(declaredPointer) === top
  );
  if (!declared) {
    return [
      {
        severity: 'warning',
        code: A2UI_ISSUE_CODES.SCHEMA_UNDECLARED_PATH,
        surfaceId,
        path: pointer,
        message: `Data path "${pointer}" is not declared in the surface schema`
      }
    ];
  }
  return [];
}

/**
 * Render the schema as a prompt section listing every declared field, its type
 * and any enum/format/description. Appended by the app after `a2uiSystemPrompt`
 * (like the transport section), NOT baked into the generator.
 */
export function a2uiDataSchemaSection(schema: A2uiDataSchema): string {
  const lines: string[] = [
    '## Data schema',
    '',
    'The surface data model holds these fields (bind inputs to them with { path }',
    'and initialize them via updateDataModel). Write only the declared types:'
  ];
  for (const [pointer, field] of Object.entries(schema)) {
    const bits: string[] = [field.type];
    if (field.enum) bits.push(`one of: ${field.enum.join(' | ')}`);
    if (field.format) bits.push(`format ${field.format}`);
    const suffix = field.description ? ` — ${field.description}` : '';
    lines.push(`- ${pointer} (${bits.join('; ')})${suffix}`);
  }
  return lines.join('\n');
}

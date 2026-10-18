/**
 * Surface requirements: the components a consumer insists a surface carries
 * (a consent box on the booking form), keyed by surfaceId. A catalog says what
 * a surface MAY contain; this says what one MUST, and it belongs to the
 * consumer because it is one form's business rule — a chat-answer surface on
 * the same catalog needs no checkbox.
 *
 * Three readers share the one object a consumer writes, so they cannot drift:
 * the processor (copies a surface's entry at `createSurface`),
 * `collectGraphIssues` (reports each one missing from the settled tree) and
 * `a2uiSurfaceRequirementsSection` (tells the model before it builds). Pure TS,
 * no Svelte — a server building the prompt or validating a payload has no DOM.
 */

import { bindingPointer } from './a2ui-render';

/**
 * One component a surface must contain. It counts once a component of that
 * name is reachable from `root` — defined but never referenced, it renders
 * nothing and does not count — and, when `path` is set, once its `prop` is a
 * `{ path }` binding that resolves to exactly that pointer.
 */
export interface A2uiRequiredComponent {
  /** The component name as the surface's catalog spells it — `Checkbox` (Urbicon), `CheckBox` (Basic). */
  component: string;
  /**
   * The absolute JSON Pointer the component must be bound to, e.g. `'/agreed'`.
   * A relative binding inside a template is resolved against its item first,
   * exactly as the renderer resolves it, so it matches only if it lands here.
   * Omit to require the component by name alone.
   */
  path?: string;
  /** The prop carrying that binding. Every input in both catalogs binds through `value`. @default 'value' */
  prop?: string;
  /**
   * What the component is for, in a few words ("consent to the cancellation
   * policy"). The model reads it in the prompt section and in the issue, so it
   * labels the control sensibly.
   */
  description?: string;
}

/** `surfaceId` → the components that surface must contain. */
export type A2uiSurfaceRequirements = Readonly<Record<string, readonly A2uiRequiredComponent[]>>;

/** Whether `instance`, rendered in `scopePrefix`, satisfies `requirement`. */
export function meetsRequirement(
  requirement: A2uiRequiredComponent,
  instance: { component: string; props: ReadonlyMap<string, unknown> },
  scopePrefix: string | undefined
): boolean {
  if (instance.component !== requirement.component) return false;
  if (requirement.path === undefined) return true;
  const bound = instance.props.get(requirement.prop ?? 'value');
  return bindingPointer(bound, scopePrefix) === requirement.path;
}

/** The requirement in the words the prompt and the issue both use. */
export function describeRequirement(requirement: A2uiRequiredComponent): string {
  let text = `a ${requirement.component}`;
  if (requirement.path !== undefined) {
    text += ` with ${requirement.prop ?? 'value'} bound to { "path": ${JSON.stringify(requirement.path)} }`;
  }
  if (requirement.description) text += ` (${requirement.description})`;
  return text;
}

/**
 * The prompt section that tells the model which components each listed
 * surface must contain. `a2uiSystemPrompt` is built per catalog and cannot see
 * a consumer's requirements, so append this next to it — from the same object
 * you pass as `surfaceRequirements`. Returns `''` when no surface has one.
 *
 * The requirement is keyed by a surfaceId the MODEL chooses, so the section
 * pins it: the model is told to build that surface under exactly that id.
 */
export function a2uiSurfaceRequirementsSection(requirements: A2uiSurfaceRequirements): string {
  const entries = Object.entries(requirements).filter(([, list]) => list.length > 0);
  if (entries.length === 0) return '';
  const lines: string[] = [
    '## Required components',
    '',
    'These surfaces have a fixed contract. Build each under exactly the surfaceId',
    'listed, and by the time your reply ends its tree must contain every component',
    'listed for it, reachable from "root". A missing one comes back to you as a',
    'MISSING_REQUIRED_COMPONENT error; answer it by patching that surface.',
    ''
  ];
  for (const [surfaceId, list] of entries) {
    lines.push(`- Surface "${surfaceId}" must contain:`);
    for (const requirement of list) lines.push(`  - ${describeRequirement(requirement)}`);
  }
  return lines.join('\n');
}

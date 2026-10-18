/**
 * Surface requirements: the components a consumer insists a surface carries
 * (a consent box on the booking form), keyed by surfaceId. A catalog says what
 * a surface MAY contain; this says what one MUST, and it belongs to the
 * consumer because it is one form's business rule — a chat-answer surface on
 * the same catalog needs no checkbox.
 *
 * Three readers share the one object a consumer writes, so they cannot drift:
 * the processor (checks a surface's entries against its catalog at
 * `createSurface`), `collectGraphIssues` (reports each one missing from the
 * settled tree) and `a2uiSurfaceRequirementsSection` (tells the model before it
 * builds). Pure TS, no Svelte — a server building the prompt or validating a
 * payload has no DOM.
 */

import type { A2uiCatalogSpec } from './a2ui-catalog';
import {
  A2UI_VALUE_PROP,
  type A2uiComponentSpec,
  ownEntry,
  rendersAsComponent
} from './a2ui-registry';
import { bindingPointer } from './a2ui-render';

/**
 * One component a surface must contain. It counts once a component of that
 * name is reachable from `root` and renders as itself — not as a fault chip,
 * which an unknown component or one missing a required prop becomes — and, when
 * `path` is set, once its `prop` is a `{ path }` binding that resolves to
 * exactly that pointer. One rendered component meets one entry, so two entries
 * for a `Checkbox` ask for two.
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

function boundProp(requirement: A2uiRequiredComponent): string {
  return requirement.prop ?? A2UI_VALUE_PROP;
}

/**
 * Why a requirement can never be met on `catalog`, or `undefined` when it can:
 * the catalog has no such component, the component declares no such prop or
 * the prop takes no `{ path }`, or `path` is relative (a resolved binding is
 * always absolute). The processor reports such an entry once and leaves it
 * unchecked; the prompt section leaves it out.
 */
export function requirementFault(
  requirement: A2uiRequiredComponent,
  catalog: A2uiCatalogSpec
): string | undefined {
  const spec: A2uiComponentSpec | undefined = ownEntry(catalog.registry, requirement.component);
  if (!spec) return `catalog "${catalog.catalogId}" has no component "${requirement.component}"`;
  if (requirement.prop === undefined && requirement.path === undefined) return undefined;
  const prop = boundProp(requirement);
  const propSpec = ownEntry(spec.props, prop);
  if (!propSpec) return `${requirement.component} declares no prop "${prop}"`;
  if (requirement.path === undefined) return undefined;
  if (!propSpec.dynamic) return `${requirement.component}.${prop} cannot be bound with { path }`;
  if (!requirement.path.startsWith('/')) {
    return `path "${requirement.path}" is relative, and a binding always resolves to an absolute pointer`;
  }
  return undefined;
}

/** Whether `instance`, rendered in `scopePrefix` through `registry`, satisfies `requirement`. */
export function meetsRequirement(
  requirement: A2uiRequiredComponent,
  instance: { component: string; props: ReadonlyMap<string, unknown> },
  scopePrefix: string | undefined,
  registry: Readonly<Record<string, A2uiComponentSpec>>
): boolean {
  if (instance.component !== requirement.component) return false;
  if (!rendersAsComponent(registry, instance)) return false;
  if (requirement.path === undefined) return true;
  return (
    bindingPointer(instance.props.get(boundProp(requirement)), scopePrefix) === requirement.path
  );
}

/** The requirement in the words the prompt and the issue both use. */
export function describeRequirement(requirement: A2uiRequiredComponent): string {
  let text = `a ${requirement.component}`;
  if (requirement.path !== undefined) {
    text += ` with ${boundProp(requirement)} bound to { "path": ${JSON.stringify(requirement.path)} }`;
  }
  if (requirement.description) text += ` (${requirement.description})`;
  return text;
}

/**
 * The prompt section that tells the model which components each listed
 * surface must contain. `a2uiSystemPrompt` cannot see a consumer's
 * requirements, so append this next to it — from the same object you pass as
 * `surfaceRequirements`, and the same catalog spec you prompt with. An entry
 * that can never be met on that catalog (see {@link requirementFault}) is left
 * out, so the model is never asked for it; the view reports it as
 * `INVALID_REQUIREMENT`. Returns `''` when no surface has a requirement left.
 *
 * The requirement is keyed by a surfaceId the MODEL chooses, so the section
 * pins it: the model is told to use exactly that id for that surface.
 */
export function a2uiSurfaceRequirementsSection(
  requirements: A2uiSurfaceRequirements,
  catalog: A2uiCatalogSpec
): string {
  const entries: Array<[string, A2uiRequiredComponent[]]> = [];
  for (const [surfaceId, list] of Object.entries(requirements)) {
    const valid = list.filter(
      (requirement) => requirementFault(requirement, catalog) === undefined
    );
    if (valid.length > 0) entries.push([surfaceId, valid]);
  }
  if (entries.length === 0) return '';
  const lines: string[] = [
    '## Required components',
    '',
    'These surfaces have a fixed contract. When you build one of them, use exactly',
    'the surfaceId listed, and by the time your reply ends its tree must contain',
    'every component listed for it, reachable from "root". A missing one comes back',
    'to you as a MISSING_REQUIRED_COMPONENT error; answer it by patching that surface.',
    ''
  ];
  for (const [surfaceId, list] of entries) {
    lines.push(`- Surface "${surfaceId}" must contain:`);
    for (const requirement of list) lines.push(`  - ${describeRequirement(requirement)}`);
  }
  return lines.join('\n');
}

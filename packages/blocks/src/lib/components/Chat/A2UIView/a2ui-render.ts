/**
 * Render-tree assembly for the A2UI renderer — the bridge between the pure-TS
 * processor (`a2ui-validate.ts`, plain Maps) and the recursive Svelte dispatcher
 * (`A2UINode.svelte`). Pure TS, no Svelte, so `A2UINode` and `A2UIView` share
 * one typed contract (the house pattern of `md-context.ts`, deliberately not a
 * Svelte context — the tree is private and explicit prop flow keeps it
 * inspectable).
 *
 * `buildRenderTree` walks the component graph from `root` into a fully-expanded,
 * BOUNDED node tree: child/children references resolved, list templates expanded
 * over the data model, dangling references marked, and the depth/node/cycle
 * limits enforced in ONE place so the Svelte layer can never recurse without
 * bound regardless of payload. Graph-level ISSUES (the reportable faults) are
 * still produced by `collectGraphIssues` in `a2ui-validate.ts`; this walk only
 * shapes what renders.
 */

import type { IconComponent } from '$lib/icons';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { A2uiActionEvent, A2uiValidationIssue } from './a2ui.types';
import { getAtPointer } from './a2ui-data';
import type { A2uiComponentInstance, A2uiSurfaceState } from './a2ui-validate';

/** Default traversal bounds — mirror `collectGraphIssues` so the tree and the issue list agree. */
export const A2UI_MAX_DEPTH = 32;
export const A2UI_MAX_NODES = 512;

/**
 * One node of the assembled render tree. `instance === null` marks a dangling
 * reference (a child id that was never defined) — rendered as a streaming
 * placeholder or, once settled, a fault chip. `children` are pre-expanded and
 * ordered; `key` is stable across incremental rebuilds so keyed `{#each}` keeps
 * component identity (and input focus) through a keystroke-triggered rebuild.
 */
export interface A2uiRenderNode {
  key: string;
  id: string;
  instance: A2uiComponentInstance | null;
  /** Template-item scope for relative-path resolution and two-way write-back. */
  scopePrefix: string | undefined;
  children: A2uiRenderNode[];
  /** flex-grow, present only when this node is a direct Row/Column child with a finite `weight`. */
  weight?: number;
}

/** Static text labels threaded to the node dispatcher (i18n comes from A2UIView props). */
export interface A2uiRenderLabels {
  unsupported: string;
  blockedImage: string;
  pending: string;
}

/**
 * The single context object each `A2UINode` receives. Carries resolved slot
 * classes, the icon map, the data-binding resolver, the two-way write-back
 * callbacks, the action sink and rendering flags. Rebuilt per version bump so a
 * live data-model edit propagates fresh resolved values without remounting.
 */
export interface A2uiRenderContext {
  /** Resolved class string per slot (tv() + slotClasses + unstyled already applied). */
  classes: Readonly<Record<string, string>>;
  urlPolicy: MarkdownUrlPolicy | undefined;
  /** Dangling refs render placeholders while true; fault chips once false. */
  streaming: boolean;
  /** True inside a Button label (Text renders as an inline plain span). */
  inline: boolean;
  surfaceId: string;
  onAction: ((event: A2uiActionEvent) => void) | undefined;
  /** Resolve a Dynamic value (literal | { path } | function-call) against the model in `scope`. */
  resolve: (
    value: unknown,
    scopePrefix: string | undefined
  ) => { value: unknown; issue?: A2uiValidationIssue };
  /** Write a value at an absolute JSON Pointer into the surface model, then bump. */
  write: (pointer: string, value: unknown) => void;
  /** Delete the key at an absolute JSON Pointer from the surface model, then bump. */
  remove: (pointer: string) => void;
  /** A2UI icon-name → resolved icon component (IconProvider override honoured, direct import fallback). */
  icons: Readonly<Record<string, IconComponent>>;
  /** Fallback glyph for an unmapped icon name. */
  fallbackIcon: IconComponent;
  labels: A2uiRenderLabels;
}

/** Clamp a finite number into `[min, max]`; NaN/∞ collapse to `min`. */
function clampWeight(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve a `{ path }` data binding to the ABSOLUTE JSON Pointer it addresses,
 * honouring the template scope for relative paths. Returns `undefined` for
 * literals and function-call bindings (nothing to write back into).
 */
export function bindingPointer(
  value: unknown,
  scopePrefix: string | undefined
): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const object = value as Record<string, unknown>;
  if (typeof object.call === 'string') return undefined;
  if (typeof object.path !== 'string') return undefined;
  const path = object.path;
  return path.startsWith('/') ? path : `${scopePrefix ?? ''}/${path}`;
}

/** Coerce an unknown model value to a string array of stable option values (for ChoicePicker). */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Coerce a scalar model value to the string an `<input>` displays. */
export function toInputString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

interface WalkState {
  components: Map<string, A2uiComponentInstance>;
  dataModel: unknown;
  maxDepth: number;
  maxNodes: number;
  count: number;
}

function childRefs(
  instance: A2uiComponentInstance,
  scopePrefix: string | undefined,
  state: WalkState
): Array<{ id: string; scope: string | undefined }> {
  const out: Array<{ id: string; scope: string | undefined }> = [];

  const single = instance.props.get('child');
  if (typeof single === 'string') out.push({ id: single, scope: scopePrefix });

  const children = instance.props.get('children');
  if (Array.isArray(children)) {
    for (const childId of children) {
      if (typeof childId === 'string') out.push({ id: childId, scope: scopePrefix });
    }
  } else if (children !== null && typeof children === 'object') {
    const template = children as { componentId?: unknown; path?: unknown };
    if (typeof template.componentId === 'string' && typeof template.path === 'string') {
      const absPath = template.path.startsWith('/')
        ? template.path
        : `${scopePrefix ?? ''}/${template.path}`;
      const list = getAtPointer(state.dataModel, absPath);
      if (Array.isArray(list)) {
        for (let i = 0; i < list.length; i++) {
          out.push({ id: template.componentId, scope: `${absPath}/${i}` });
          if (out.length > state.maxNodes) break; // bound the expansion itself
        }
      }
      // non-array / undefined → render nothing (issue reported by collectGraphIssues)
    }
  }
  return out;
}

function buildNode(
  id: string,
  scopePrefix: string | undefined,
  key: string,
  parentIsFlex: boolean,
  ancestors: ReadonlySet<string>,
  depth: number,
  state: WalkState
): A2uiRenderNode | null {
  if (state.count >= state.maxNodes || depth > state.maxDepth) return null;
  state.count++;

  const instance = state.components.get(id);
  if (!instance) {
    return { key, id, instance: null, scopePrefix, children: [] };
  }

  const node: A2uiRenderNode = { key, id, instance, scopePrefix, children: [] };

  if (parentIsFlex) {
    const weight = instance.props.get('weight');
    if (typeof weight === 'number' && Number.isFinite(weight)) {
      node.weight = clampWeight(weight, 0, 100);
    }
  }

  const isFlex = instance.component === 'Row' || instance.component === 'Column';
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(id);

  const refs = childRefs(instance, scopePrefix, state);
  for (let i = 0; i < refs.length; i++) {
    if (state.count >= state.maxNodes) break;
    const ref = refs[i];
    if (nextAncestors.has(ref.id)) continue; // cycle: truncate (issue reported elsewhere)
    const childKey = `${ref.id}@${ref.scope ?? ''}#${i}`;
    const child = buildNode(ref.id, ref.scope, childKey, isFlex, nextAncestors, depth + 1, state);
    if (child) node.children.push(child);
  }

  return node;
}

/**
 * Assemble the bounded render tree for a surface, starting at `root`. Returns
 * `null` when no `root` component exists yet (the caller renders a placeholder
 * while streaming, or a fault chip once settled).
 */
export function buildRenderTree(
  surface: A2uiSurfaceState,
  options?: { maxDepth?: number; maxNodes?: number }
): A2uiRenderNode | null {
  if (!surface.components.has('root')) return null;
  const state: WalkState = {
    components: surface.components,
    dataModel: surface.dataModel,
    maxDepth: options?.maxDepth ?? A2UI_MAX_DEPTH,
    maxNodes: options?.maxNodes ?? A2UI_MAX_NODES,
    count: 0
  };
  return buildNode('root', undefined, 'root', false, new Set(), 0, state);
}

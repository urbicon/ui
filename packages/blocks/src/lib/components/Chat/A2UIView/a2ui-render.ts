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

import type { Component, Snippet } from 'svelte';
import type { IconComponent } from '#lib/icons/index.js';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { A2uiActionEvent, A2uiValidationIssue } from './a2ui.types';
import {
  type A2uiBindingRefusal,
  bindingPath,
  bindingWriteRefusal,
  callName,
  scopedPointer,
  templateList
} from './a2ui-data';
import { A2UI_VALUE_PROP, ownEntry, writesValue } from './a2ui-registry';
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
  /**
   * The parent prop this child came from (e.g. Card `header`/`footer`/`child`).
   * Lets a dispatcher with several named childId slots pick the right child by
   * name instead of position; single-slot / list components ignore it.
   */
  slot?: string;
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
  /**
   * The view's `unstyled`, relayed to every catalog component the dispatcher
   * renders. `classes` above already answers it for the view's OWN slots; a
   * dispatched `<Button>`/`<Input>`/… carries a tv() config of its own, and
   * only its prop reaches that.
   */
  unstyled: boolean;
  surfaceId: string;
  onAction: ((event: A2uiActionEvent) => void) | undefined;
  /**
   * The data model to attach to a dispatched action, or `undefined` when the
   * surface did not ask for it (`createSurface.sendDataModel`). Read as a
   * function so the action carries the state at CLICK time, not at render time.
   */
  actionDataModel: (() => unknown) | undefined;
  /** Resolve a Dynamic value (literal | { "@path" } | function-call) against the model in `scope`. */
  resolve: (
    value: unknown,
    scopePrefix: string | undefined
  ) => { value: unknown; issue?: A2uiValidationIssue };
  /**
   * Whether the data model refuses a user's edit of `node`'s two-way field
   * ({@link fieldWriteRefusal}); `false` for a component that writes nothing.
   * The field renders disabled while it does, and `collectGraphIssues`
   * reports why.
   */
  refusesWrite: (node: A2uiRenderNode) => boolean;
  /** Write a value at an absolute JSON Pointer into the surface model, then bump. */
  write: (pointer: string, value: unknown) => void;
  /** Delete the key at an absolute JSON Pointer from the surface model, then bump. */
  remove: (pointer: string) => void;
  /** A2UI icon-name → resolved icon component (IconProvider override honoured, direct import fallback). */
  icons: Readonly<Record<string, IconComponent>>;
  /** Fallback glyph for an unmapped icon name. */
  fallbackIcon: IconComponent;
  labels: A2uiRenderLabels;
  /**
   * The catalog whose wiring this context carries — `icons`, `fallbackIcon`
   * and `nodeComponent`. A surface may mix catalogs per component, so
   * A2UIView's `renderNode` snippet re-wires the context wherever a node's
   * catalog differs from it.
   */
  catalogId: string;
  /**
   * The catalog's recursive node dispatcher (Basic → `A2UINode`; a custom
   * catalog → its own dispatcher). A2UIView's `renderNode` snippet renders
   * THIS rather than importing one dispatcher directly, so each node renders
   * through the component that matches its catalog.
   */
  nodeComponent: Component<A2uiNodeProps>;
}

/**
 * Props of a catalog node dispatcher. Every dispatcher (Basic/Urbicon/…) takes
 * the same triple: the node, its render context, and the self-referencing
 * `renderChild` snippet A2UIView threads down for bounded recursion.
 */
export interface A2uiNodeProps {
  node: A2uiRenderNode;
  context: A2uiRenderContext;
  renderChild: Snippet<[A2uiRenderNode, A2uiRenderContext]>;
}

/** Clamp a finite number into `[min, max]`; NaN/∞ collapse to `min`. */
function clampWeight(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve a `{ "@path" }` data binding to the ABSOLUTE JSON Pointer it
 * addresses, honouring the template scope for relative paths. Returns
 * `undefined` for literals and function-call bindings (nothing to write back
 * into).
 */
export function bindingPointer(
  value: unknown,
  scopePrefix: string | undefined
): string | undefined {
  if (callName(value) !== undefined) return undefined;
  const path = bindingPath(value);
  if (path === undefined) return undefined;
  return scopedPointer(path, scopePrefix);
}

/**
 * The absolute JSON Pointer a two-way field writes what the user enters to:
 * its `value` binding in `scopePrefix`, where its catalog declares that prop
 * two-way ({@link writesValue}). `undefined` for any other component, and for
 * a literal or a function call.
 */
export function writePointer(
  instance: A2uiComponentInstance | null,
  scopePrefix: string | undefined
): string | undefined {
  if (!instance || !writesValue(ownEntry(instance.catalog?.registry, instance.component))) {
    return undefined;
  }
  return bindingPointer(instance.props.get(A2UI_VALUE_PROP), scopePrefix);
}

/**
 * Why the data model refuses a user's edit of a two-way field — what
 * {@link writePointer} writes to, read by `writeDataModel`'s rule for a user
 * (`bindingWriteRefusal`) — or `undefined` when it takes one, and for a
 * component that writes nothing. What the field writes nests as its `value`
 * is declared: a `stringList` one level below the pointer, any other kind none.
 */
export function fieldWriteRefusal(
  model: unknown,
  instance: A2uiComponentInstance | null,
  scopePrefix: string | undefined,
  paddedSlots: number
): A2uiBindingRefusal | undefined {
  const spec = instance ? ownEntry(instance.catalog?.registry, instance.component) : undefined;
  if (!instance || !writesValue(spec)) return undefined;
  const levels = ownEntry(spec?.props, A2UI_VALUE_PROP)?.kind === 'stringList' ? 1 : 0;
  const binding = instance.props.get(A2UI_VALUE_PROP);
  return bindingWriteRefusal(model, binding, scopePrefix, paddedSlots, levels);
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

/**
 * Resolve a component's child references by walking its spec's child-bearing
 * props (`childId` = one id; `childList` = an id array or a `{ componentId,
 * path }` template; `labeledChildren` = a `[{ <labelKey>, child }]` list, whose
 * child key is always `child` regardless of the spec's `labelKey`). Kind-
 * driven, from the registry of the component's own catalog, rather than
 * reading fixed `child`/`children` keys, so a catalog may name its child slots
 * freely (Card header/footer, Section child, Accordion items, …). One ref is
 * pushed per `labeledChildren` item
 * (even a dangling one) so the dispatcher can zip labels with resolved children
 * by index.
 */
function childRefs(
  instance: A2uiComponentInstance,
  scopePrefix: string | undefined,
  state: WalkState
): Array<{ id: string; scope: string | undefined; slot: string }> {
  const out: Array<{ id: string; scope: string | undefined; slot: string }> = [];
  const spec = ownEntry(instance.catalog?.registry, instance.component);
  if (!spec) return out;

  for (const [key, propSpec] of Object.entries(spec.props)) {
    if (propSpec.kind === 'childId') {
      const single = instance.props.get(key);
      if (typeof single === 'string') out.push({ id: single, scope: scopePrefix, slot: key });
    } else if (propSpec.kind === 'labeledChildren') {
      const items = instance.props.get(key);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item !== null && typeof item === 'object') {
            const child = (item as { child?: unknown }).child;
            if (typeof child === 'string') out.push({ id: child, scope: scopePrefix, slot: key });
          }
          if (out.length > state.maxNodes) break;
        }
      }
    } else if (propSpec.kind === 'childList') {
      const children = instance.props.get(key);
      if (Array.isArray(children)) {
        for (const childId of children) {
          if (typeof childId === 'string') out.push({ id: childId, scope: scopePrefix, slot: key });
          if (out.length > state.maxNodes) break;
        }
      } else if (children !== null && typeof children === 'object') {
        const template = children as { componentId?: unknown; path?: unknown };
        if (typeof template.componentId === 'string' && typeof template.path === 'string') {
          const items = templateList(state.dataModel, template, template.path, scopePrefix);
          if (!items.issue && Array.isArray(items.list)) {
            for (let i = 0; i < items.list.length; i++) {
              out.push({ id: template.componentId, scope: `${items.at}/${i}`, slot: key });
              if (out.length > state.maxNodes) break; // bound the expansion itself
            }
          }
          // non-array / undefined → render nothing (issue reported by collectGraphIssues)
        }
      }
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

  const isFlex = instance.catalog?.flexContainers.has(instance.component) ?? false;
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(id);

  const refs = childRefs(instance, scopePrefix, state);
  for (let i = 0; i < refs.length; i++) {
    if (state.count >= state.maxNodes) break;
    const ref = refs[i];
    // A cycle is truncated (the issue is `collectGraphIssues`'), and spends the
    // node budget as that walk does: a fan-out of back-references is bounded too.
    if (nextAncestors.has(ref.id)) {
      state.count++;
      continue;
    }
    const childKey = `${ref.id}@${ref.scope ?? ''}#${i}`;
    const child = buildNode(ref.id, ref.scope, childKey, isFlex, nextAncestors, depth + 1, state);
    if (child) {
      child.slot = ref.slot;
      node.children.push(child);
    }
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

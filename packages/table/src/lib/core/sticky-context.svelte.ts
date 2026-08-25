/**
 * STICKY-PINNING CONTEXT
 *
 * Shared state for the Table sticky layers (toolbar, thead + group-header).
 * - Sets the resolved `StickyMode` derived from the `sticky` prop.
 * - Tracks `toolbarStuck` so the toolbar can mirror the "stuck" data-attribute
 *   for the box-shadow + border accent.
 *
 * Background: docs/STICKY-PINNING.md
 */
import { createOptionalContext } from '@urbicon-ui/blocks';

export type StickyProp = boolean | 'toolbar' | 'header' | 'both';

/**
 * The layers that can be pinned independently.
 *
 * Three sticky layers render — toolbar (L1), thead (L2), group header (L3) —
 * but only two of them are separate decisions: the group header is the
 * contextual continuation of the column header, so L2 and L3 pin together. A
 * field per layer would be three values of which two can never differ, and
 * nothing outside this module can build a mode anyway ({@link setStickyContext}
 * is not part of the package's export map).
 */
export interface StickyMode {
  /** Sticky toolbar (L1) enabled */
  toolbar: boolean;
  /** Sticky thead (L2) and group header (L3) enabled */
  header: boolean;
}

/**
 * Resolve the `sticky` prop to a per-layer mode.
 *
 * | Prop value        | toolbar | header (thead + group) |
 * |-------------------|---------|------------------------|
 * | `false` (def.)    | ❌      | ❌                     |
 * | `true` / `'both'` | ✅      | ✅                     |
 * | `'toolbar'`       | ✅      | ❌                     |
 * | `'header'`        | ❌      | ✅                     |
 *
 * `'header'` pins the group header along with the thead — see
 * {@link StickyMode} for why that is one switch and not two.
 *
 * When `contained` is set (`fit="viewport"`), the table is its own scroll box:
 * the header + group header always pin to the top of the box and the toolbar is
 * a static flex sibling (never page-pinned), so `contained` supersedes the
 * `sticky` prop entirely.
 */
export function resolveStickyMode(sticky: StickyProp | undefined, contained = false): StickyMode {
  if (contained) {
    return { toolbar: false, header: true };
  }
  if (sticky === true || sticky === 'both') {
    return { toolbar: true, header: true };
  }
  if (sticky === 'toolbar') {
    return { toolbar: true, header: false };
  }
  if (sticky === 'header') {
    return { toolbar: false, header: true };
  }
  return { toolbar: false, header: false };
}

export interface StickyContext {
  readonly mode: StickyMode;
  /** Whether the toolbar is currently in its pinned state (sentinel out of view) */
  readonly toolbarStuck: boolean;
  setToolbarStuck(value: boolean): void;
}

const [getStickyContextRaw, setStickyContext] = createOptionalContext<StickyContext>();

export { setStickyContext };

/**
 * Off-tree default (used by sub-components rendered outside a `<Table>` wrapper
 * — e.g. when consumers compose `<TableHead>` directly).
 */
const OFF: StickyContext = {
  mode: { toolbar: false, header: false },
  toolbarStuck: false,
  setToolbarStuck: () => {}
};

export function getStickyContext(): StickyContext {
  return getStickyContextRaw() ?? OFF;
}

/**
 * Reactive state holder for the sticky context. Backed by `$state` so child
 * components see live updates of `toolbarStuck`.
 *
 * `getMode` is a getter so that switching the `sticky` prop at runtime
 * propagates to all sub-components without re-creating the context.
 */
export function createStickyState(getMode: () => StickyMode): StickyContext {
  let toolbarStuck = $state(false);

  return {
    get mode() {
      return getMode();
    },
    get toolbarStuck() {
      return toolbarStuck;
    },
    setToolbarStuck(value) {
      toolbarStuck = value;
    }
  };
}

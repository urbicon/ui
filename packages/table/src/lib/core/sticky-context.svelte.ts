/**
 * STICKY-PINNING CONTEXT
 *
 * Shared state for the three Table sticky layers (toolbar, thead, group-header).
 * - Sets the resolved `StickyMode` derived from the `sticky` prop.
 * - Tracks `toolbarStuck` / `headerStuck` so child components can mirror the
 *   "stuck" data-attribute for the box-shadow + border accent.
 *
 * Background: docs/STICKY-PINNING.md
 */
import { createOptionalContext } from '@urbicon-ui/blocks';

export type StickyProp = boolean | 'toolbar' | 'header' | 'both';

export interface StickyMode {
  /** Sticky toolbar (L1) enabled */
  toolbar: boolean;
  /** Sticky thead (L2) enabled */
  header: boolean;
  /** Sticky group-header (L3) enabled */
  group: boolean;
}

/**
 * Resolve the `sticky` prop to a per-layer mode.
 *
 * | Prop value      | toolbar | header | group |
 * |-----------------|---------|--------|-------|
 * | `false` (def.)  | ❌      | ❌     | ❌    |
 * | `true` / `'both'` | ✅    | ✅     | ✅    |
 * | `'toolbar'`     | ✅      | ❌     | ❌    |
 * | `'header'`      | ❌      | ✅     | ✅    |
 *
 * Note: `'header'` enables group-header pinning too, because the group-header
 * is part of the "header" semantic (the contextual section marker).
 *
 * When `contained` is set (`fit="viewport"`), the table is its own scroll box:
 * the header + group header always pin to the top of the box and the toolbar is
 * a static flex sibling (never page-pinned), so `contained` supersedes the
 * `sticky` prop entirely.
 */
export function resolveStickyMode(sticky: StickyProp | undefined, contained = false): StickyMode {
  if (contained) {
    return { toolbar: false, header: true, group: true };
  }
  if (sticky === true || sticky === 'both') {
    return { toolbar: true, header: true, group: true };
  }
  if (sticky === 'toolbar') {
    return { toolbar: true, header: false, group: false };
  }
  if (sticky === 'header') {
    return { toolbar: false, header: true, group: true };
  }
  return { toolbar: false, header: false, group: false };
}

export interface StickyContext {
  readonly mode: StickyMode;
  /** Whether the toolbar is currently in its pinned state (sentinel out of view) */
  readonly toolbarStuck: boolean;
  /** Whether the thead is currently in its pinned state */
  readonly headerStuck: boolean;
  setToolbarStuck(value: boolean): void;
  setHeaderStuck(value: boolean): void;
}

const [getStickyContextRaw, setStickyContext] = createOptionalContext<StickyContext>();

export { setStickyContext };

/**
 * Off-tree default (used by sub-components rendered outside a `<Table>` wrapper
 * — e.g. when consumers compose `<TableHead>` directly).
 */
const OFF: StickyContext = {
  mode: { toolbar: false, header: false, group: false },
  toolbarStuck: false,
  headerStuck: false,
  setToolbarStuck: () => {},
  setHeaderStuck: () => {}
};

export function getStickyContext(): StickyContext {
  return getStickyContextRaw() ?? OFF;
}

/**
 * Reactive state holder for the sticky context. Backed by `$state` so child
 * components see live updates of `toolbarStuck` / `headerStuck`.
 *
 * `getMode` is a getter so that switching the `sticky` prop at runtime
 * propagates to all sub-components without re-creating the context.
 */
export function createStickyState(getMode: () => StickyMode): StickyContext {
  let toolbarStuck = $state(false);
  let headerStuck = $state(false);

  return {
    get mode() {
      return getMode();
    },
    get toolbarStuck() {
      return toolbarStuck;
    },
    get headerStuck() {
      return headerStuck;
    },
    setToolbarStuck(value) {
      toolbarStuck = value;
    },
    setHeaderStuck(value) {
      headerStuck = value;
    }
  };
}

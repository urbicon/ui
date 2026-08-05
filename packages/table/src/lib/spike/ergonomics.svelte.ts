/**
 * SPIKE §7.5 — the `viewDefaults` shorthand (M7). The single most common
 * configuration (a page size) must stay a one-liner; `viewDefaults` is that
 * one-liner, valid only WITHOUT a `view` prop. Passing both is a programming
 * error, not a precedence question — fail loud in DEV (§8.2: DEV *errors*
 * for real programming mistakes, zero warnings for representable misconfig).
 */
import { createTableView, type TableView, type TableViewDefaults } from './view.svelte';

export function resolveViewProp(
  view: TableView | undefined,
  viewDefaults: TableViewDefaults | undefined
): TableView {
  if (view && viewDefaults) {
    throw new Error(
      '[Table] `view` and `viewDefaults` are mutually exclusive — `viewDefaults` is the shorthand for a table that owns its view. Move the defaults into `createTableView({ defaults })` or drop the `view` prop.'
    );
  }
  return view ?? createTableView({ defaults: viewDefaults });
}

// Explicit exports, deliberately: the store module also carries the internal
// surface — `createTableState`, `attachTableContext`, `attachCellLocale`,
// `getInternalTableContext`, `InternalTableContext` and the wiring types
// (`TablePropSources`, `TableSeedState`). None of that is consumer API; a
// `export *` here is what made the whole store inside public in the first
// place (#16). What consumers get is the narrow `TableContext` via
// `getTableContext()` / `onReady`.
// The resolved page — the type behind `TableContext.pageInfo`. The resolver
// itself stays internal; the store owns the one derivation.
export type { PageDescriptor } from './concerns/page-descriptor.js';
export {
  getCellLocale,
  getTableContext,
  type SummaryConfig,
  type TablePrefsConfig
} from './TableStore.svelte.js';

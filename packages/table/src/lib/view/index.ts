// === VIEW OBJECT (v8 view state) ===
//
// Deliberately NOT exported (internal wiring, `TableProvider` is the only
// consumer): `createManagedFetch`/`FetchSink` (the fetch lifecycle),
// `resolveViewProp` (the view/viewDefaults resolution) and
// `resolveSource`/`ResolvedSource` (the union dispatch).
export { type ObserveViewOptions, observeView } from './observe.svelte.js';
export type {
  ClientItemsSource,
  ServerManagedSource,
  ServerManualSource,
  TableSource
} from './source.js';
export {
  bindViewToStorage,
  STORAGE_DEFAULT_AXES,
  type StorageBindingHandle,
  type StorageBindingOptions
} from './storage-binding.svelte.js';
export {
  type BindingKind,
  createTableView,
  TableView,
  type TableViewDefaults,
  type TableViewSnapshot,
  VIEW_AXES,
  type ViewAxis,
  type ViewOrigin,
  type ViewSort
} from './view.svelte.js';

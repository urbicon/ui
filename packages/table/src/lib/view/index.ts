// === VIEW OBJECT (v8 view state) ===
export {
  createManagedFetch,
  type FetchSink,
  type ObserveViewOptions,
  observeView,
  viewToQuery
} from './observe.svelte.js';
export {
  type ClientItemsSource,
  type ResolvedSource,
  resolveSource,
  type ServerManagedSource,
  type ServerManualSource,
  type TableSource
} from './source.js';
export {
  bindViewToStorage,
  STORAGE_DEFAULT_AXES,
  type StorageBindingOptions
} from './storage-binding.svelte.js';
export {
  type BindingKind,
  createTableView,
  resolveViewProp,
  TableView,
  type TableViewDefaults,
  type TableViewSnapshot,
  VIEW_AXES,
  type ViewAxis,
  type ViewOrigin,
  type ViewSort
} from './view.svelte.js';

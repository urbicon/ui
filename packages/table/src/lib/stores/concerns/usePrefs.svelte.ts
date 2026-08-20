import {
  createPersistentColumnOrder,
  createPersistentHiddenColumns,
  createPersistentSelection,
  createPersistentSummaryConfigs,
  normalizeSummaryConfigs
} from '$lib/utils';
import type { SummaryConfig, TablePrefsConfig } from '../TableStore.svelte';
import type { TableState } from './types';

/**
 * Element-level shape guards. A stored value is JSON the user's browser
 * handed back — it can be any shape (a hand-edited key, a value written by an
 * older version, another app on the same origin). Container checks alone let
 * garbage *elements* through, and those reach `$derived` pipelines that
 * assume their fields exist. Malformed elements are dropped; if that leaves
 * the axis unusable, the whole entry counts as absent so a default applies.
 */
function isSummaryConfigShape(value: unknown): value is SummaryConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<SummaryConfig>;
  return typeof config.column === 'string' && typeof config.type === 'string';
}

function isRowId(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Prefs concern (#152: the preference class of state — column visibility,
 * column order, summaries, opt-in selection). These belong to the *table*,
 * not the view: nobody wants to share a link that hides columns on the other
 * end, so they live in web storage, never in the URL. The six view axes are
 * the view object's business — persisted, if at all, through
 * `bindViewToStorage`.
 *
 * Storage is a client-only layer: read synchronously at construction,
 * **applied after hydration** (from an `$effect` in `TableProvider`) — one
 * rule, no per-axis exceptions, because storage does not exist on the server
 * and anything applied during construction makes the client's first render
 * disagree with the HTML it is hydrating.
 *
 * **Stored empty is a real state.** Hydration keys off `hasStoredValue`
 * (does storage hold an entry?), not off "is the value non-empty" — an axis
 * the user *cleared* (no summaries, nothing selected, no hidden columns)
 * restores as cleared and wins over the matching `defaults` entry. A missing
 * **or corrupt** entry counts as absent, so junk in storage can never block
 * a default permanently.
 */
export function usePrefs(state: TableState, prefs?: TablePrefsConfig) {
  const storageConfig =
    prefs?.storage === undefined
      ? undefined
      : typeof prefs.storage === 'string'
        ? { tableId: prefs.storage, storage: undefined, debounceMs: undefined }
        : {
            tableId: prefs.storage.key,
            storage: prefs.storage.kind,
            debounceMs: prefs.storage.debounceMs
          };

  const persistentSummaryConfigs = storageConfig
    ? createPersistentSummaryConfigs(storageConfig)
    : undefined;
  const persistentHiddenColumns = storageConfig
    ? createPersistentHiddenColumns(storageConfig)
    : undefined;
  const persistentColumnOrder = storageConfig
    ? createPersistentColumnOrder(storageConfig)
    : undefined;
  // Selection is opt-in (default off), unlike the axes above: restoring a
  // stale selection across reloads surprises more often than it helps.
  const persistentSelection =
    storageConfig && prefs?.persistSelection === true
      ? createPersistentSelection(storageConfig)
      : undefined;

  // Per-axis "storage supplied this axis" flags. Set only when storage held a
  // parseable entry of the expected shape — an absent or corrupt entry leaves
  // the axis to the `defaults`.
  let hydratedSummaryConfigs = false;
  let hydratedSelection = false;

  /**
   * The writes hydration would make, held back until `applyPersistedState()`.
   * Reading storage stays here at construction — it is synchronous, and the
   * `hydrated*` flags have to be right before the defaults below apply.
   */
  const pending: Array<() => void> = [];

  if (persistentSummaryConfigs?.hasStoredValue && Array.isArray(persistentSummaryConfigs.value)) {
    // Normalized like every other writer: a value persisted before the
    // one-aggregation-per-column invariant was enforced (#92) may hold
    // duplicates, and hydration must not re-corrupt the state.
    const configs = normalizeSummaryConfigs(
      persistentSummaryConfigs.value.filter(isSummaryConfigShape)
    );
    pending.push(() => {
      state.summaryConfigs = configs;
      // Only reveal the summary row when there is something to show — a
      // stored *empty* set means the user removed every summary.
      state.showSummary = configs.length > 0;
    });
    hydratedSummaryConfigs = true;
  }

  if (persistentSelection?.hasStoredValue && Array.isArray(persistentSelection.value)) {
    // Selection is NOT pushed onto `pending`: prefs no longer writes the
    // selection itself. The store applies `storedSelectionIds` through the
    // selection concern's commit gate (origin `external`), so hydration can
    // never diverge from the one write path. Only the flag is decided here.
    hydratedSelection = true;
  }

  /**
   * Apply everything storage supplied. Called once, from an `$effect` in
   * `TableProvider` — the hydration boundary: it does not run on the server,
   * and on the client it runs before the browser paints. Idempotent, and
   * drains itself so a second call cannot re-apply a snapshot over a value
   * the user has since changed.
   */
  function applyPersistedState(): void {
    while (pending.length > 0) pending.shift()?.();
  }

  // ── Sync functions, called by the store's action wrappers after mutations.
  // Every sync writes a *snapshot*, never the live array. The summary concern
  // assigns fresh arrays today (#92 routed its writers through one funnel), but
  // this stays a copy on purpose: it is the one line that keeps the persisted
  // value from aliasing live state, and a concern that goes back to mutating in
  // place would otherwise assign the same reference back — no signal change at
  // all, and the auto-save effect would not re-run.
  function syncSummaryConfigs() {
    if (persistentSummaryConfigs) persistentSummaryConfigs.value = [...state.summaryConfigs];
  }

  function syncHiddenColumns(hiddenIds: string[]) {
    if (persistentHiddenColumns) persistentHiddenColumns.value = hiddenIds;
  }

  function syncColumnOrder(order: string[]) {
    if (persistentColumnOrder) persistentColumnOrder.value = order;
  }

  // Skipped while selection is controlled — the prop is the source of truth,
  // so a controlled value must never reach storage (it would resurrect on a
  // later switch to uncontrolled).
  function syncSelection() {
    if (persistentSelection && !state.selectionControlled) {
      persistentSelection.value = [...state.selectedIds];
    }
  }

  function clearAllPersistentData() {
    persistentSummaryConfigs?.reset();
    persistentHiddenColumns?.reset();
    persistentColumnOrder?.reset();
    persistentSelection?.reset();
  }

  function forceSavePersistentData() {
    persistentSummaryConfigs?.forceSave();
    persistentHiddenColumns?.forceSave();
    persistentColumnOrder?.forceSave();
    persistentSelection?.forceSave();
  }

  return {
    applyPersistedState,
    syncSummaryConfigs,
    syncHiddenColumns,
    syncColumnOrder,
    syncSelection,
    // Hand-back snapshots for the two axes that live inside other concerns.
    // `null` means "storage holds nothing" — the store's construction-time
    // `defaults` then stand. A stored value wins, **including a stored empty
    // one** (the user un-hid every column); junk that is not an array of the
    // expected shape reads as "nothing persisted".
    get storedHiddenColumnIds(): string[] | null {
      const stored = persistentHiddenColumns?.value;
      if (persistentHiddenColumns?.hasStoredValue && Array.isArray(stored)) {
        return stored.filter((id): id is string => typeof id === 'string');
      }
      return null;
    },
    get storedColumnOrder(): string[] | null {
      const stored = persistentColumnOrder?.value;
      if (persistentColumnOrder?.hasStoredValue && Array.isArray(stored)) {
        return stored.filter((id): id is string => typeof id === 'string');
      }
      return null;
    },
    get storedSelectionIds(): Array<string | number> | null {
      const stored = persistentSelection?.value;
      if (persistentSelection?.hasStoredValue && Array.isArray(stored)) {
        return stored.filter(isRowId);
      }
      return null;
    },
    // "Storage owns this axis" — true when it held an entry, including a
    // stored empty one. The store's defaults check these so a cleared axis is
    // not re-seeded on the next load.
    get hydratedSummaryConfigs(): boolean {
      return hydratedSummaryConfigs;
    },
    get hydratedSelection(): boolean {
      return hydratedSelection;
    },
    clearPersistedSummaryConfigs: () => persistentSummaryConfigs?.reset(),
    clearPersistedHiddenColumns: () => persistentHiddenColumns?.reset(),
    clearPersistedColumnOrder: () => persistentColumnOrder?.reset(),
    clearPersistedSelection: () => persistentSelection?.reset(),
    clearAllPersistentData,
    forceSavePersistentData
  };
}

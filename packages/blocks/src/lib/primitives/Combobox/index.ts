import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { SelectValue } from '../Select/index';
import type { ComboboxSlots, ComboboxVariants } from './combobox.variants';

/** A single combobox option with label, value, and optional disabled state. */
export interface ComboboxOption<T extends SelectValue = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

/** A labelled group of combobox options (parity with Select's `groups`). */
export interface ComboboxGroup<T extends SelectValue = string> {
  label: string;
  options: ComboboxOption<T>[];
}

/**
 * Shared props for both single- and multi-select Combobox modes. The
 * mode-specific shapes (`value`, `onValueChange`, and the multi-only tag props)
 * live on {@link ComboboxSingleProps} / {@link ComboboxMultipleProps} and narrow
 * against `multiple`.
 */
interface ComboboxBaseProps<T extends SelectValue = string>
  extends ComboboxVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of selectable options. Each needs a unique `value`. */
  options?: ComboboxOption<T>[];
  /**
   * Grouped options with section labels, at parity with Select. Takes precedence
   * over `options` when set. Filtering runs per group; groups whose options all
   * filter out are hidden, and keyboard navigation flows across the flattened,
   * still-visible options exactly as it does for a flat list.
   */
  groups?: ComboboxGroup<T>[];
  /** Current search query text. Supports `bind:query` for external control (e.g. server-side filtering). */
  query?: string;
  /** Placeholder shown when the input is empty. @default 'Search…' */
  placeholder?: string;
  /** Field label rendered above the input. */
  label?: string;
  /** Helper text shown below the field. Hidden when an error is set. */
  helper?: string;
  /** Error message — replaces helper text and flags the field as invalid. */
  error?: string;
  /**
   * Marks the field as required. Adds the asterisk on the label. @default false
   *
   * In multi-select mode this is visual only — the transient search input
   * carries no native `required` (it is cleared after each pick), so enforce a
   * minimum selection in your submit handler.
   */
  required?: boolean;
  /** Custom filter replacing the built-in case-insensitive label match. Return `true` to include an option. Ignored when `queryFn` is set (the server filters). */
  filter?: (option: ComboboxOption<T>, query: string) => boolean;

  /**
   * Server-side search (analogous to the Table remote-mode API). When set, the
   * Combobox stops filtering client-side and instead calls `queryFn` — debounced
   * by {@link debounceMs} — on each query change, replacing the option list with
   * the resolved result. The `AbortSignal` is aborted when a newer query
   * supersedes an in-flight request, so a slow stale response never clobbers a
   * fresh one. Aborted rejections are swallowed; other rejections end the
   * loading state, leave the previous options in place, and are reported via
   * `onError`. `options`/`groups` are ignored in this mode. The selected
   * option's label is cached so it survives result sets that no longer
   * contain it.
   */
  queryFn?: (query: string, signal: AbortSignal) => Promise<ComboboxOption<T>[]>;
  /** Debounce applied to `queryFn` in milliseconds. @default 250 */
  debounceMs?: number;
  /** Text shown in the listbox while an async `queryFn` request is in flight. @default 'Loading…' */
  loadingText?: string;
  /**
   * Fired when `queryFn` rejects (aborted / superseded requests are ignored).
   * The loading state ends and the previous option list stays in place — use
   * this to surface the failure (toast, inline message). Without a handler
   * the rejection is logged DEV-only (`console.warn`) and swallowed in
   * production; it never escapes as an unhandled promise rejection.
   */
  onError?: (error: unknown) => void;
  /**
   * Label seed for pre-selected values whose options are not (yet) in the
   * option list — the async-mode pattern of binding `value` on mount before
   * any `queryFn` result has arrived. Consulted as the LAST lookup source when
   * resolving a selected value's label (current options first, then the
   * pick-cache, then this seed), so it can never shadow a live option, and it
   * works identically for single and multi selection. Without a matching seed
   * such a value renders as its raw `String(value)` (and warns DEV-only).
   * Declarative and idempotent — not a second selection source: `value` alone
   * decides what is selected; `seedOptions` only supplies labels.
   */
  seedOptions?: ComboboxOption<T>[];
  /** Show a clear button when a value is selected. Click or press Escape to reset. @default false */
  clearable?: boolean;
  /** Disable the entire combobox. @default false */
  disabled?: boolean;
  /** Shared `name` for a hidden input for native form submission. In multi-select mode one hidden input is emitted per selected value. */
  name?: string;
  /** Text displayed when the filter produces no matches. @default 'No results found' */
  noResultsText?: string;
  /** Controls the open state of the listbox. Supports `bind:open`. @default false */
  open?: boolean;
  /**
   * Fires when the listbox opens or closes from user interaction (focus,
   * typing, chevron toggle, selection, Escape, outside click). Receives the
   * new open state — use it e.g. to lazy-load options on first open. Not
   * called when the consumer writes `bind:open` directly.
   */
  onOpenChange?: (open: boolean) => void;
  /** Custom option renderer. Receives the option and whether it is selected. */
  customOption?: Snippet<[ComboboxOption<T>, boolean]>;

  // ── Dismiss behavior ─────────────────────────────────
  /**
   * Whether the listbox closes on Escape key. Default `true`.
   * Set to `false` for inline contexts where Escape should be intercepted
   * by an outer widget (e.g. a row editor that wants to revert on Escape).
   */
  closeOnEscape?: boolean;
  /**
   * Whether the listbox closes on outside click. Default `true`.
   * Set to `false` to pin the listbox open while the consumer manages
   * dismissal explicitly.
   */
  closeOnClickOutside?: boolean;
  /**
   * Fires after Escape closes the listbox. Use for analytics or to clear
   * ephemeral state on dismiss. Does NOT control whether the listbox
   * closes — that is governed by `closeOnEscape`.
   */
  onEscape?: () => void;
  /**
   * Fires after an outside click closes the listbox. Use for analytics
   * or side-effects on dismiss. Does NOT control whether the listbox
   * closes — that is governed by `closeOnClickOutside`.
   */
  onClickOutside?: () => void;

  /** Micro-interaction preset. Form controls default to 'none' for a clean feel. @default 'none' */
  mint?: MintProp;
  /** Extra classes merged onto the root wrapper element. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv() styles. Slots: base | label | requiredMark |
   *  inputWrapper | input | message | helper | listbox | option | optionActive | optionSelected |
   *  optionCheck | group | groupLabel | loading | noResults | clear | chevron | control | search |
   *  tag | tagLabel | tagRemove */
  slotClasses?: Partial<Record<ComboboxSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Combobox: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
  /** Deterministic HTML `id` for the component. Auto-generated when omitted. */
  id?: string;
}

/**
 * Single-select arm (the default). `value` is `T | null`, and `onValueChange`
 * receives the new value or `null` on clear. Selecting an option closes the
 * listbox and mirrors the picked label back into the input.
 */
export interface ComboboxSingleProps<T extends SelectValue = string> extends ComboboxBaseProps<T> {
  /** Single-select mode (the default). Omit or set to `false` explicitly. */
  multiple?: false;
  /** Currently selected value. Supports `bind:value` for two-way binding. */
  value?: T | null;
  /** Fires after the selected value changes. Receives the new value or `null` on clear. */
  onValueChange?: (value: T | null) => void;

  // Multi-only props are declared `never` here so the discriminated union keeps
  // a uniform key set (the arms differ only in type) — without this TypeScript
  // stops treating it as a clean discriminated union and the destructured
  // `value` collapses to an unwritable intersection type.
  /** Disallowed in single mode — only relevant for multi-select. */
  maxItems?: never;
  /** Disallowed in single mode — only relevant for multi-select. */
  onRemoveTag?: never;
  /** Disallowed in single mode — only relevant for multi-select. */
  customTag?: never;
}

/**
 * Multi-select arm. `value` is an array of the selected values, rendered as
 * removable tag chips below the search input. Selecting an option adds a tag and
 * keeps the listbox open so several picks flow without re-opening; the search
 * query is cleared after each pick. Backspace on an empty query removes the last
 * tag.
 */
export interface ComboboxMultipleProps<T extends SelectValue = string>
  extends ComboboxBaseProps<T> {
  /** Enable multi-select mode. */
  multiple: true;
  /** Currently selected values. Supports `bind:value`. @default [] */
  value?: T[];
  /** Fires after the selection changes. Receives the new array. */
  onValueChange?: (value: T[]) => void;
  /**
   * Cap the number of selected values. Once reached, options that aren't already
   * selected become non-selectable (and are skipped by keyboard navigation) until
   * a tag is removed; already-selected options can still be toggled off.
   */
  maxItems?: number;
  /**
   * Fires when a single value is removed from the selection — via the tag's
   * remove button, Backspace on an empty query, or toggling a selected option
   * off. Receives the removed value. `onValueChange` fires alongside it with the
   * resulting array; use `onRemoveTag` for per-tag side effects (analytics, exit
   * animations). Note: the bulk clear button does NOT fire this per tag — it
   * signals through `onValueChange([])` only.
   */
  onRemoveTag?: (value: T) => void;
  /**
   * Custom tag renderer replacing the default chip. Receives the selected option
   * and a `remove` callback — call it to drop the tag (fires `onRemoveTag` +
   * `onValueChange`). Use it to render a `<Badge>` or any bespoke chip.
   *
   * Positional args: `(option, remove)`.
   */
  customTag?: Snippet<[ComboboxOption<T>, () => void]>;
}

/**
 * @description Searchable menu (autocomplete) combining a text input with a
 * filterable option list. Implements the ARIA combobox pattern with keyboard
 * navigation, custom filtering, and two-way bindable state. Single-select by
 * default; pass `multiple` for an array-bound multi-select that renders picks as
 * removable tag chips.
 *
 * @tag form
 * @related Select
 * @related Input
 * @related Menu
 *
 * @example
 * ```svelte
 * <Combobox
 *   options={[
 *     { label: 'Apple', value: 'apple' },
 *     { label: 'Banana', value: 'banana' },
 *     { label: 'Cherry', value: 'cherry' }
 *   ]}
 *   bind:value={selected}
 *   placeholder="Search fruit…"
 * />
 * ```
 *
 * @example Numeric IDs — the generic value type keeps `value` typed as `number`
 * ```svelte
 * <Combobox
 *   options={tenants.map((t) => ({ label: t.name, value: t.id }))}
 *   bind:value={tenantId}
 * />
 * ```
 *
 * @example Multi-select with removable tags
 * ```svelte
 * <Combobox
 *   options={skills}
 *   multiple
 *   bind:value={selectedSkills}
 *   maxItems={5}
 *   placeholder="Add skills…"
 * />
 * ```
 *
 * @example Grouped options — filtering hides empty groups automatically
 * ```svelte
 * <Combobox
 *   groups={[
 *     { label: 'Fruit', options: [{ label: 'Apple', value: 'apple' }] },
 *     { label: 'Veg', options: [{ label: 'Carrot', value: 'carrot' }] }
 *   ]}
 *   bind:value={food}
 * />
 * ```
 */
export type ComboboxProps<T extends SelectValue = string> =
  | ComboboxSingleProps<T>
  | ComboboxMultipleProps<T>;

/** Backwards-compatible alias for {@link ComboboxOption} (legacy name). */
export type ComboboxOptionType<T extends SelectValue = string> = ComboboxOption<T>;

export { default as Combobox } from './Combobox.svelte';
export { type ComboboxVariants, comboboxVariants } from './combobox.variants';

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

/**
 * @description Searchable menu (autocomplete) combining a text input with a
 * filterable option list. Implements the ARIA combobox pattern with
 * keyboard navigation, custom filtering, and two-way bindable state.
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
 * @example
 * ```svelte
 * <Combobox
 *   options={countries}
 *   bind:value={country}
 *   filter={(option, query) => option.label.toLowerCase().startsWith(query.toLowerCase())}
 *   clearable
 *   size="lg"
 * />
 * ```
 */
export interface ComboboxProps<T extends SelectValue = string>
  extends ComboboxVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Array of selectable options. Each needs a unique `value`. */
  options: ComboboxOption<T>[];
  /** Currently selected value. Supports `bind:value` for two-way binding. */
  value?: T | null;
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
  /** Marks the field as required. Adds the asterisk on the label. @default false */
  required?: boolean;
  /** Custom filter replacing the built-in case-insensitive label match. Return `true` to include an option. */
  filter?: (option: ComboboxOption<T>, query: string) => boolean;
  /** Show a clear button when a value is selected. Click or press Escape to reset. @default false */
  clearable?: boolean;
  /** Disable the entire combobox. @default false */
  disabled?: boolean;
  /** Shared `name` for a hidden input for native form submission. */
  name?: string;
  /** Text displayed when the filter produces no matches. @default 'No results found' */
  noResultsText?: string;
  /** Fires after the selected value changes. Receives the new value or `null` on clear. */
  onValueChange?: (value: T | null) => void;
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
   *  noResults | clear | chevron */
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

/** Backwards-compatible alias for {@link ComboboxOption} (legacy name). */
export type ComboboxOptionType<T extends SelectValue = string> = ComboboxOption<T>;

export { default as Combobox } from './Combobox.svelte';
export { type ComboboxVariants, comboboxVariants } from './combobox.variants';

import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { SelectSlots, SelectVariants } from './select.variants';

/**
 * Primitive value types accepted by Select / Combobox options.
 * Strings are the default; numbers and booleans cover form fields
 * bound to numeric IDs or yes/no flags without forcing the consumer
 * to convert back and forth at every call site.
 */
export type SelectValue = string | number | boolean;

/** A single select option. */
export interface SelectOption<T extends SelectValue = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

/** A labelled group of options. */
export interface SelectGroup<T extends SelectValue = string> {
  label: string;
  options: SelectOption<T>[];
}

/**
 * Configuration for an explicit "no value" option rendered at the top of the listbox.
 * Selecting it sets `value` to `null` and fires `onValueChange(null)`.
 *
 * Pass a string to use it as the label, or an object for additional control:
 *   `nullOption="No selection"`
 *   `nullOption={{ label: 'Leave unassigned' }}`
 */
export interface NullOptionConfig {
  /** Label shown both in the listbox row and the trigger when `value` is `null`. */
  label: string;
  /** Disables selection of the null option (rare, but allowed for symmetry). */
  disabled?: boolean;
}

/**
 * @description Form-focused listbox with label, validation, keyboard navigation, and optional
 * multi-select. Single-select by default; pass `multiple` for an array-bound multi-select.
 * Custom render hooks (`customTrigger`, `customTriggerContent`, `customItem`) cover advanced
 * UI like icon-only triggers, badge-counter chrome, or complex per-option layouts.
 *
 * @tag form
 * @related Combobox
 * @related Menu
 * @related Input
 *
 * @example Single-select with form integration
 * ```svelte
 * <Select
 *   label="Country"
 *   options={[
 *     { label: 'Germany', value: 'de' },
 *     { label: 'France', value: 'fr' },
 *     { label: 'Spain', value: 'es' },
 *   ]}
 *   bind:value={country}
 *   placeholder="Choose a country"
 * />
 * ```
 *
 * @example Numeric IDs — the generic value type keeps `value` typed as `number`
 * ```svelte
 * <Select
 *   label="Tenant"
 *   options={tenants.map((t) => ({ label: t.name, value: t.id }))}
 *   bind:value={tenantId}
 * />
 * ```
 *
 * @example Multi-select with checkboxes
 * ```svelte
 * <Select
 *   label="Tags"
 *   options={tags}
 *   multiple
 *   selectionIndicator="checkbox"
 *   bind:value={selectedTags}
 * />
 * ```
 *
 * @example Custom trigger (icon-only, with counter)
 * ```svelte
 * <Select options={...} multiple bind:value bind:open>
 *   {#snippet customTrigger(selected, isOpen, clear)}
 *     <Button variant="ghost" size="sm">
 *       <FilterIcon />
 *       {#if selected.length > 0}
 *         <Badge size="xs">{selected.length}</Badge>
 *       {/if}
 *     </Button>
 *   {/snippet}
 * </Select>
 * ```
 *
 * @example Grouped options
 * ```svelte
 * <Select
 *   label="Role"
 *   groups={[
 *     { label: 'Engineering', options: [
 *       { label: 'Frontend', value: 'fe' },
 *       { label: 'Backend', value: 'be' }
 *     ]},
 *     { label: 'Design', options: [
 *       { label: 'UX', value: 'ux' },
 *       { label: 'Visual', value: 'vis' }
 *     ]}
 *   ]}
 *   bind:value={role}
 *   required
 *   error={roleError}
 * />
 * ```
 */
/**
 * Shared props for both single and multi Select modes. Mode-specific shapes
 * (value, onValueChange, multiPlaceholder, nullOption, selectionIndicator)
 * live on `SelectSingleProps` / `SelectMultipleProps` and narrow against
 * `multiple`.
 */
interface SelectBaseProps<T extends SelectValue = string>
  extends Omit<SelectVariants, 'error' | 'selected' | 'open' | 'variant'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /**
   * Visual style.
   * - `outlined` (default) — visible border, surface-base background
   * - `filled` — surface-interactive fill, no border (compact toolbars)
   * - `ghost` — transparent until hover/focus (dense menus, inline editors)
   * - `underline` — bottom-line only, no border-box (editorial knob-strips,
   *   docs playgrounds)
   *
   * @default 'outlined'
   */
  variant?: SelectVariants['variant'];

  /** Flat list of selectable options. */
  options?: SelectOption<T>[];

  /** Grouped options with section labels. Takes precedence over `options`. */
  groups?: SelectGroup<T>[];

  /**
   * Whether the listbox closes after a selection is made.
   * Defaults to `true` in single-select and `false` in multi-select — the
   * multi-select default lets users tick multiple options without re-opening,
   * matching the established multi-select pattern.
   */
  closeOnSelect?: boolean;

  /** Text shown when no value is selected. @default 'Select...' */
  placeholder?: string;

  /** Label text displayed above the select, auto-linked via `id`. */
  label?: string;

  /** Error message below the select. Overrides `helper` and forces danger styling. */
  error?: string;

  /** Helper text below the select. Hidden when `error` is set. */
  helper?: string;

  /** Show a clear button when a value is selected. @default false */
  clearable?: boolean;

  /** @default false */
  disabled?: boolean;

  /** Adds a required asterisk to the label. @default false */
  required?: boolean;

  /** Shared `name` for a hidden input for native form submission. */
  name?: string;

  /**
   * Controls whether the listbox is open. Supports `bind:open` for parents that
   * need to coordinate open/close (e.g. attaching a custom trigger button outside
   * the Select wrapper). @default false
   */
  open?: boolean;

  /**
   * When true, the listbox is rendered into the browser top layer via the native
   * `popover` API, so it cannot be clipped by `overflow: auto` ancestors. When
   * false, the listbox stays in the regular DOM flow — useful inside other
   * popovers/portals to avoid double-portaling. @default true
   */
  usePortal?: boolean;

  /**
   * Whether the listbox matches the trigger's width. Set `false` for icon-only
   * or compact triggers where the listbox should size to its content instead.
   * @default true
   */
  syncWidth?: boolean;

  // ── Render hooks ─────────────────────────────────────
  /**
   * Replace the entire trigger button (chevron, label, clear control) with a
   * custom element. Receives the selected options, current open state, and a
   * `clear` callback. Use this for icon-only triggers, badge-counter triggers,
   * or any non-standard chrome — the Select still owns open/close + selection
   * state via the returned callbacks.
   *
   * Positional args: `(selected, open, clear)`.
   */
  customTrigger?: Snippet<[SelectOption<T>[], boolean, () => void]>;

  /**
   * Replace only the trigger's text/label area (chevron and clear button stay
   * intact). Receives the selected options. Useful for showing icons next to
   * the label, badges with counts, or formatted multi-select summaries while
   * keeping the standard outlined-Select chrome.
   *
   * Positional args: `(selected)`.
   */
  customTriggerContent?: Snippet<[SelectOption<T>[]]>;

  /**
   * Replace the default per-option rendering. Receives the option, its
   * selection state, and a `toggle` callback (call to select/deselect).
   * The outer `<div role="option">` container is still owned by Select for
   * ARIA correctness — the snippet renders the option's visible contents.
   *
   * Positional args: `(option, isSelected, toggle)`.
   */
  customItem?: Snippet<[SelectOption<T>, boolean, () => void]>;

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

  /** Micro-interaction preset. @default 'none' */
  mint?: MintProp;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;

  /** Remove all default tv() classes. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (root —
   * what `class` also targets) | base | trigger | triggerText | placeholder |
   * chevron | clear | listbox | option | optionLabel | optionCheck |
   * optionCheckbox | group | groupLabel | label | message.
   */
  slotClasses?: Partial<Record<SelectSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Select: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Explicit `id` for the component. Auto-generated if omitted. */
  id?: string;
}

/**
 * Single-select arm. `value` is `T | null`, `selectionIndicator` excludes
 * `'checkbox'` (a checkmark or no indicator), `nullOption` is available,
 * `multiPlaceholder` is *not* — there's never more than one selected label
 * to summarize.
 */
export interface SelectSingleProps<T extends SelectValue = string> extends SelectBaseProps<T> {
  /**
   * Single-select mode (the default). Omit or set to `false` explicitly.
   */
  multiple?: false;

  /** Currently selected value. Supports `bind:value`. */
  value?: T | null;

  /** Fires after the selected value changes. Receives the new value or `null` on clear. */
  onValueChange?: (value: T | null) => void;

  /**
   * Render an explicit "no value" option as the first row of the listbox.
   * Selecting it sets the bound value to `null`. When `value` is `null`,
   * the trigger displays this label instead of the placeholder.
   *
   * Pass a string to use it as the label, or a `NullOptionConfig` for more control.
   * Ignored when `groups` is set — group structures own their option list.
   */
  nullOption?: string | NullOptionConfig;

  /**
   * Selection indicator rendered next to each option.
   * - `'checkmark'` — trailing check icon (default)
   * - `'none'` — no indicator (typical when using `customItem`)
   */
  selectionIndicator?: 'checkmark' | 'none';

  /** Disallowed in single mode — only relevant for multi-select. */
  multiPlaceholder?: never;
}

/**
 * Multi-select arm. `value` is `T[]`, `selectionIndicator` excludes
 * `'checkmark'` (a checkbox or no indicator), `multiPlaceholder` is
 * available, `nullOption` is *not* — clearing in multi mode empties the
 * array instead of binding a null sentinel.
 */
export interface SelectMultipleProps<T extends SelectValue = string> extends SelectBaseProps<T> {
  /** Enable multi-select mode. */
  multiple: true;

  /** Currently selected values. Supports `bind:value`. @default [] */
  value?: T[];

  /** Fires after the selection changes. Receives the new array. */
  onValueChange?: (value: T[]) => void;

  /** Disallowed in multi mode — clearing empties the array. */
  nullOption?: never;

  /**
   * Selection indicator rendered next to each option.
   * - `'checkbox'` — leading checkbox box (default for multi-select)
   * - `'checkmark'` — trailing check icon (quieter alternative)
   * - `'none'` — no indicator (typical when using `customItem`)
   */
  selectionIndicator?: 'checkbox' | 'checkmark' | 'none';

  /**
   * Placeholder shown when one or more values are picked. Pass a string for
   * a static label ("3 selected") or a function that receives the currently
   * selected options and returns a custom string. When unset, the trigger
   * lists the selected labels comma-separated.
   */
  multiPlaceholder?: string | ((selected: SelectOption<T>[]) => string);
}

/**
 * Discriminated union over `multiple`. Consumers pick a single shape at the
 * call site and the value type narrows accordingly — `<Select multiple bind:value>`
 * binds to `T[]`, `<Select bind:value>` binds to `T | null`. See
 * `SelectSingleProps` / `SelectMultipleProps` for the per-mode details.
 */
export type SelectProps<T extends SelectValue = string> =
  | SelectSingleProps<T>
  | SelectMultipleProps<T>;

export { default as Select } from './Select.svelte';
export { type SelectVariants, selectVariants } from './select.variants';

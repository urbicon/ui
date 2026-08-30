import type { Locale } from '@urbicon-ui/i18n';
import type { SelectSingleProps } from '$lib';

/**
 * Props interface for LocaleSwitcher component
 *
 * @summary Lets the user pick the interface language.
 * @description Convenience wrapper around Select to switch UI locales.
 * Single-select only — locale is always exactly one value. Options, value,
 * form integration, multi-select, and null-option are all owned internally
 * and intentionally not forwarded to the underlying Select.
 *
 * @tag form
 * @related Select
 *
 * @example
 * ```svelte
 * <LocaleSwitcher />
 * ```
 *
 * @example
 * ```svelte
 * <LocaleSwitcher showFlag variant="filled" size="sm" />
 * ```
 */
export interface LocaleSwitcherProps
  extends Omit<
    SelectSingleProps<string>,
    // Owned by LocaleSwitcher's internal options/value pipeline:
    | 'options'
    | 'groups'
    | 'value'
    | 'onValueChange'
    | 'multiple'
    | 'multiPlaceholder'
    | 'nullOption'
    | 'closeOnSelect'
    | 'name'
    | 'label'
    | 'helper'
    | 'error'
  > {
  /** Show flag emoji alongside locale name. @default false */
  showFlag?: boolean;

  /**
   * Micro-interaction preset forwarded to the inner Select trigger.
   * Redeclared from SelectSingleProps so the inheritance is a documented
   * contract rather than an accident of the Omit list.
   * @default 'none'
   */
  mint?: SelectSingleProps<string>['mint'];

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ LocaleSwitcher: {...} }}>`.
   * Resolved against the **`LocaleSwitcher`** key, not `Select`: a preset written
   * for the locale picker would otherwise style every select under the provider.
   * `defaults.Select` still applies — the resolved preset reaches Select as
   * instance `slotClasses`, so it wins over the provider's select-wide defaults
   * and loses to `slotClasses` / `class` written on this component.
   * A preset's `overrides` rules are matched against what you wrote here plus
   * Select's own variant defaults; an axis Select derives for itself (`tier`,
   * `messageType`, `error`, `open`) can match the wrong state — #360.
   */
  preset?: string;

  /** Restrict the displayed locales. Defaults to all locales registered in i18n. */
  locales?: Locale[];

  /** Called after the locale has been changed successfully. */
  onLocaleChange?: (locale: Locale) => void;
}

export { default as LocaleSwitcher } from './LocaleSwitcher.svelte';

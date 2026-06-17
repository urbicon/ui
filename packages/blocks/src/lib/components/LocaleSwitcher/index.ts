import type { Locale } from '@urbicon-ui/i18n';
import type { SelectSingleProps } from '$lib';

/**
 * Props interface for LocaleSwitcher component
 *
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
  /** Show flag emoji alongside locale name. @default true */
  showFlag?: boolean;

  /** Restrict the displayed locales. Defaults to all locales registered in i18n. */
  locales?: Locale[];

  /** Called after the locale has been changed successfully. */
  onLocaleChange?: (locale: Locale) => void;
}

export { default as LocaleSwitcher } from './LocaleSwitcher.svelte';

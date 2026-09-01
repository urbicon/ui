<script lang="ts">
  import Select from '$lib/primitives/Select/Select.svelte';
  import { selectVariants } from '$lib/primitives/Select/select.variants';
  import { getBlocksConfig, resolveSlotClasses, wrapperActiveProps } from '$lib/provider';
  import type { LocaleSwitcherProps } from './index';
  import { useBlocksI18n, getBlocksLocales } from '$lib';
  import { useI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';

  const bt = useBlocksI18n();
  const i18n = useI18n();

  const LOCALE_FLAGS: Record<string, string> = {
    en: '🇺🇸',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸',
    it: '🇮🇹',
    nl: '🇳🇱'
  };

  let {
    variant = 'outlined',
    size = 'sm',
    showFlag = false,
    locales,
    onLocaleChange,
    disabled = false,
    unstyled,
    preset,
    slotClasses,
    class: className = '',
    ...restProps
  }: LocaleSwitcherProps = $props();

  const blocksConfig = getBlocksConfig();

  const localeNames: Record<string, string> = $derived({
    en: bt('languages.en'),
    de: bt('languages.de'),
    fr: bt('languages.fr'),
    es: bt('languages.es'),
    it: bt('languages.it'),
    nl: bt('languages.nl')
  });

  const availableLocales = $derived.by(() => {
    if (locales?.length) return locales;
    const registered = getBlocksLocales();
    return registered.length > 0 ? registered : (['en', 'de'] as Locale[]);
  });

  const localeItems = $derived(
    availableLocales.map((locale) => ({
      label:
        showFlag && LOCALE_FLAGS[locale]
          ? `${LOCALE_FLAGS[locale]} ${localeNames[locale] ?? locale}`
          : (localeNames[locale] ?? locale),
      value: locale
    }))
  );

  const currentLocale = $derived(i18n.locale);
  const isLoading = $derived(i18n.isLoading);

  // Resolved here, under this component's own name, and handed to Select as
  // instance `slotClasses` rather than forwarded as `preset`: inside Select the
  // name would be `Select`, so a preset written for the locale picker would
  // style every select under the provider too. `wrapperActiveProps` supplies the
  // axes the caller left to Select's own defaults, without which a preset's
  // `overrides` rule on any of them would match nothing here. `variant`, `size`
  // and the loading-disabled state are this component's answer for Select, so
  // they are written into the object rather than defaulted out of the config.
  const presetSlotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'LocaleSwitcher',
      preset,
      wrapperActiveProps(selectVariants.config, {
        ...restProps,
        variant,
        size,
        disabled: disabled || isLoading
      }),
      slotClasses,
      selectVariants.config
    )
  );

  // Single-mode Select narrows `newLocale` to `string | null`. The
  // `Array.isArray` guard from the old union-typed wrapper is gone — the
  // discriminated `SelectSingleProps<string>` makes it unreachable.
  function handleLocaleChange(newLocale: string | null) {
    if (!newLocale) return;
    // setLocale throws (deliberately, write-strict) when no <I18nProvider> is
    // mounted — a programmer error that must stay loud, so it is NOT caught here.
    // It is synchronous and only throws for that case; under a provider it never
    // throws. onLocaleChange is intentionally outside any try so a consumer
    // callback's own error isn't swallowed either.
    i18n.setLocale(newLocale as Locale);
    onLocaleChange?.(newLocale as Locale);
  }
</script>

<Select
  options={localeItems}
  value={currentLocale}
  onValueChange={handleLocaleChange}
  {variant}
  {size}
  {unstyled}
  slotClasses={presetSlotClasses}
  class={className}
  placeholder={isLoading ? bt('common.loading') : bt('localeSwitcher.placeholder')}
  disabled={disabled || isLoading}
  aria-label={bt('localeSwitcher.ariaLabel')}
  {...restProps}
/>

<script lang="ts" generics="Item">
  import { useTableI18n } from '$lib/i18n';
  import { numberCellVariants, type NumberCellVariantProps } from '$lib/variants';

  const tt = useTableI18n();

  export type NumberCellProps<Item> = {
    item: Item;
    valueKey?: keyof Item;
    value?: number | ((item: Item) => number);
    format?: 'integer' | 'decimal' | 'currency' | 'percentage' | 'custom';
    currency?: string;
    locale?: string;
    decimals?: number;
    customFormatter?: (value: number) => string;
    prefix?: string;
    suffix?: string;
    fallback?: string;
    colorMode?: 'none' | 'positive-negative' | 'threshold';
    thresholds?: {
      danger?: number;
      warning?: number;
      success?: number;
    };
    onClick?: (item: Item, value: number | null) => void;
    className?: string;
    testId?: string;
  } & NumberCellVariantProps;

  // Props with sensible defaults
  let {
    item,
    valueKey = undefined,
    value = undefined,
    format = 'decimal',
    currency = 'EUR',
    locale = 'de-DE',
    decimals = 2,
    customFormatter = undefined,
    prefix = '',
    suffix = '',
    fallback = '—',
    colorMode = 'none',
    thresholds = {},
    onClick = undefined,
    className = '',
    testId = undefined,
    size = 'md',
    align = 'right',
    variant = 'default'
  }: NumberCellProps<Item> = $props();

  // Extract numeric value from item or prop
  const extractValue = (item: Item): number | null => {
    if (typeof value === 'function') {
      return value(item);
    }
    if (typeof value === 'number') {
      return value;
    }
    if (valueKey) {
      const extractedValue = item[valueKey];
      if (typeof extractedValue === 'number') return extractedValue;
      if (typeof extractedValue === 'string') {
        const parsed = parseFloat(extractedValue);
        return isNaN(parsed) ? null : parsed;
      }
    }
    return null;
  };

  // Get the numeric value
  const numericValue = $derived.by(() => extractValue(item));

  // Check if value is clickable
  const isClickable = $derived(Boolean(onClick && numericValue !== null));

  // Format the number based on options
  const formatNumber = (num: number | null): string => {
    if (num === null) return fallback;

    try {
      // Custom formatter takes precedence
      if (customFormatter) {
        return prefix + customFormatter(num) + suffix;
      }

      let formatted: string;

      switch (format) {
        case 'integer':
          formatted = new Intl.NumberFormat(locale, {
            maximumFractionDigits: 0
          }).format(num);
          break;

        case 'decimal':
          formatted = new Intl.NumberFormat(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }).format(num);
          break;

        case 'currency':
          formatted = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }).format(num);
          break;

        case 'percentage':
          formatted = new Intl.NumberFormat(locale, {
            style: 'percent',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }).format(num / 100);
          break;

        default:
          formatted = new Intl.NumberFormat(locale).format(num);
      }

      return prefix + formatted + suffix;
    } catch (error) {
      console.warn('NumberCell: Error formatting number', error);
      return fallback;
    }
  };

  // Get formatted number string
  const formattedNumber = $derived.by(() => formatNumber(numericValue));

  // Determine color variant based on value
  type NumberVariant = 'default' | 'neutral' | 'positive' | 'negative' | 'currency';
  const getColorVariant = (num: number | null): NumberVariant => {
    if (num === null || colorMode === 'none') return variant;

    if (colorMode === 'positive-negative') {
      if (num > 0) return 'positive';
      if (num < 0) return 'negative';
      return 'neutral';
    }

    if (colorMode === 'threshold' && thresholds) {
      if (thresholds.danger !== undefined && num <= thresholds.danger) {
        return 'negative';
      }
      if (thresholds.warning !== undefined && num <= thresholds.warning) {
        return 'neutral';
      }
      if (thresholds.success !== undefined && num >= thresholds.success) {
        return 'positive';
      }
    }

    return variant;
  };

  const colorVariant = $derived.by(() => getColorVariant(numericValue));

  // Generate tooltip with raw value
  const tooltipText = $derived.by(() => {
    const num = numericValue;
    if (num === null) return undefined;

    // Show raw value if different from formatted
    const raw = num.toString();
    const formatted = formattedNumber;

    if (raw !== formatted && !formatted.includes(raw)) {
      return tt('number.valueLabel', { value: raw });
    }

    return undefined;
  });

  const tooltipValue = $derived(tooltipText);

  // Generate test ID
  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    if (item && typeof item === 'object' && 'id' in item) {
      return `number-cell-${item.id}-${String(valueKey)}`;
    }
    return undefined;
  });

  const styles = $derived(numberCellVariants({ size, align, variant: colorVariant }));

  // Event handlers
  function handleClick(event: MouseEvent) {
    const num = numericValue;
    if (onClick && num !== null) {
      event.stopPropagation();
      onClick(item, num);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const num = numericValue;
      if (onClick && num !== null) {
        onClick(item, num);
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="{styles.container()} {className}"
  title={tooltipValue}
  data-testid={computedTestId}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  role={isClickable ? 'button' : undefined}
  tabindex={isClickable ? 0 : undefined}
>
  <span class={styles.number()}>
    {formattedNumber}
  </span>
</div>

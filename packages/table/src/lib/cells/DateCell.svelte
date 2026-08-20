<script lang="ts" generics="Item">
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  import { dateCellVariants, type DateCellVariantProps } from '$lib/variants';
  import { getNestedValue } from '$lib/utils';

  export type DateCellProps<Item> = {
    item: Item;
    dateKey?: keyof Item;
    format?: 'short' | 'medium' | 'long' | 'relative' | 'datetime';
    customFormat?: (date: Date) => string;
    /**
     * BCP 47 tag to format with, or `'auto'` (the default) to follow the active
     * `<I18nProvider>` locale.
     *
     * Was `undefined` until 2026-08-02, which handed `Intl` the *runtime*
     * locale: the Node/Bun process on the server, the user's browser after
     * hydration. The same cell rendered `3/12/2026` in the prerendered HTML and
     * `12.03.2026` in the client tree.
     */
    locale?: string;
    showTime?: boolean;
    timezone?: string;
    fallback?: string;
    onClick?: (item: Item, date: Date | null) => void;
    className?: string;
    testId?: string;
    size?: DateCellVariantProps['size'];
  };

  let {
    item,
    dateKey = undefined,
    format = 'medium',
    customFormat = undefined,
    locale = 'auto',
    showTime = false,
    timezone = undefined,
    fallback = '—',
    onClick = undefined,
    className = '',
    testId = undefined,
    size = 'md'
  }: DateCellProps<Item> = $props();

  // `explicit prop → provider → base locale`. Never `undefined`: that follows
  // the runtime, which differs across the SSR boundary. See
  // @urbicon-ui/i18n's resolve-date-locale.ts for why the prop is trusted and
  // the context value is not.
  const i18n = useI18n();
  const resolvedLocale = $derived(resolveDateLocale(locale, i18n.locale));

  // Extract date value from item
  const extractDate = (item: Item, key?: keyof Item): Date | null => {
    if (!key) return null;

    const value = getNestedValue(item, String(key));
    if (!value) return null;

    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

  // Get the date value
  const dateValue = $derived.by(() => extractDate(item, dateKey));

  // Check if date is clickable
  const isClickable = $derived(Boolean(onClick && dateValue));

  // Format the date based on options
  const formatDate = (date: Date | null): string => {
    if (!date) return fallback;

    try {
      // Custom formatter takes precedence
      if (customFormat) {
        return customFormat(date);
      }

      // Built-in format options
      const options: Intl.DateTimeFormatOptions = {};

      switch (format) {
        case 'short':
          options.dateStyle = 'short';
          break;
        case 'medium':
          options.dateStyle = 'medium';
          break;
        case 'long':
          options.dateStyle = 'long';
          break;
        case 'relative':
          return formatRelativeDate(date);
        default:
          options.dateStyle = 'medium';
      }

      if (showTime) {
        options.timeStyle = 'short';
      }

      if (timezone) {
        options.timeZone = timezone;
      }

      return new Intl.DateTimeFormat(resolvedLocale, options).format(date);
    } catch (error) {
      console.warn('DateCell: Error formatting date', error);
      return fallback;
    }
  };

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (Math.abs(diffDays) > 7) {
      return new Intl.DateTimeFormat(resolvedLocale, { dateStyle: 'short' }).format(date);
    }

    const rtf = new Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto' });

    if (diffMs < 0) {
      const futureDays = Math.abs(diffDays);
      const futureHours = Math.abs(diffHours);
      const futureMinutes = Math.abs(diffMinutes);

      if (futureDays > 0) return rtf.format(futureDays, 'day');
      if (futureHours > 0) return rtf.format(futureHours, 'hour');
      if (futureMinutes > 0) return rtf.format(futureMinutes, 'minute');
      return rtf.format(0, 'second');
    }

    if (diffDays >= 1) return rtf.format(-diffDays, 'day');
    if (diffHours >= 1) return rtf.format(-diffHours, 'hour');
    if (diffMinutes >= 1) return rtf.format(-diffMinutes, 'minute');
    return rtf.format(0, 'second');
  };

  // Get formatted date string
  const formattedDate = $derived.by(() => formatDate(dateValue));

  // Generate tooltip with full date info
  const tooltipText = $derived.by(() => {
    const date = dateValue;
    if (!date) return undefined;

    const fullFormat = new Intl.DateTimeFormat(resolvedLocale, {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: timezone
    }).format(date);

    return fullFormat;
  });

  const tooltipValue = $derived(tooltipText);

  // Generate test ID
  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    if (item && typeof item === 'object' && 'id' in item) {
      return `date-cell-${item.id}-${String(dateKey)}`;
    }
    return undefined;
  });

  // TV Styles
  const styles = $derived(dateCellVariants({ interactive: isClickable, size, format }));

  // Event handlers
  function handleClick(event: MouseEvent) {
    const date = dateValue;
    if (onClick && date) {
      event.stopPropagation();
      onClick(item, date);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const date = dateValue;
      if (onClick && date) {
        onClick(item, date);
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
  <time datetime={dateValue?.toISOString()} class={styles.date()}>
    {formattedDate}
  </time>
</div>

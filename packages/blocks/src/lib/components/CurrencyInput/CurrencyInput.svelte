<script lang="ts">
  import { Input } from '$lib/primitives/Input';
  import type { CurrencyInputProps } from './index';

  let {
    value = $bindable(null),
    locale = 'de-DE',
    currency = 'EUR',
    symbolPosition = 'suffix',
    precision = 2,
    name,
    onValueChange,
    leftIcon: userLeftIcon,
    rightIcon: userRightIcon,
    ...inputProps
  }: CurrencyInputProps = $props();

  const resolvedLocale = $derived(
    locale === 'auto' ? new Intl.NumberFormat().resolvedOptions().locale : locale
  );

  const decimalSeparator = $derived(
    new Intl.NumberFormat(resolvedLocale).formatToParts(1.1).find((p) => p.type === 'decimal')
      ?.value ?? '.'
  );

  const symbol = $derived.by(() => {
    if (symbolPosition === 'none') return '';
    const parts = new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  });

  function escapeForCharClass(s: string): string {
    return s.replace(/[\\\]^-]/g, '\\$&');
  }

  function formatDisplay(cents: number | null | undefined, raw: boolean): string {
    if (cents === null || cents === undefined || Number.isNaN(cents)) return '';
    const factor = Math.pow(10, Math.max(0, precision));
    const negative = cents < 0;
    const absCents = Math.abs(cents);
    const intMajor = Math.trunc(absCents / factor);
    const intStr = raw
      ? intMajor.toString()
      : intMajor.toLocaleString(resolvedLocale, { useGrouping: true, maximumFractionDigits: 0 });
    const result =
      precision > 0
        ? intStr + decimalSeparator + (absCents % factor).toString().padStart(precision, '0')
        : intStr;
    return negative ? '-' + result : result;
  }

  function parseInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const negative = trimmed.startsWith('-');
    const sepIdx = trimmed.indexOf(decimalSeparator);
    const intStr =
      sepIdx === -1 ? trimmed.replace(/\D/g, '') : trimmed.slice(0, sepIdx).replace(/\D/g, '');
    const rawFrac = sepIdx === -1 ? '' : trimmed.slice(sepIdx + 1).replace(/\D/g, '');
    if (intStr === '' && rawFrac === '') return null;
    const fracStr = precision > 0 ? rawFrac.padEnd(precision, '0').slice(0, precision) : '';
    const parsed = Number.parseInt((intStr || '0') + fracStr, 10);
    if (Number.isNaN(parsed)) return null;
    return negative ? -parsed : parsed;
  }

  let displayValue = $derived(formatDisplay(value, false));

  // Count digits + minus sign to the left of `cursor` in `text`. The minus is
  // counted so it does not shift the cursor when the user toggles negativity.
  function countSignificantChars(text: string, cursor: number): number {
    let count = 0;
    for (let i = 0; i < cursor && i < text.length; i++) {
      const ch = text[i];
      if ((ch >= '0' && ch <= '9') || ch === '-') count++;
    }
    return count;
  }

  // Find the offset in `formatted` after the Nth significant char (digit or `-`).
  function findCursorForSignificantCount(formatted: string, n: number): number {
    if (n <= 0) return 0;
    let count = 0;
    for (let i = 0; i < formatted.length; i++) {
      const ch = formatted[i];
      if ((ch >= '0' && ch <= '9') || ch === '-') {
        count++;
        if (count === n) return i + 1;
      }
    }
    return formatted.length;
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const rawCursor = target.selectionStart ?? target.value.length;
    const significantBeforeCursor = countSignificantChars(target.value, rawCursor);

    const sepClass = precision > 0 ? escapeForCharClass(decimalSeparator) : '';
    const allowed = `0-9\\-${sepClass}`;
    let sanitized = target.value
      .replace(new RegExp(`[^${allowed}]`, 'g'), '')
      .replace(/(?<!^)-/g, '');

    if (precision > 0) {
      const firstSep = sanitized.indexOf(decimalSeparator);
      if (firstSep !== -1) {
        const before = sanitized.slice(0, firstSep + 1);
        const after = sanitized
          .slice(firstSep + 1)
          .split(decimalSeparator)
          .join('');
        sanitized = before + after.slice(0, precision);
      }
    }

    const parsed = parseInput(sanitized);
    if (parsed !== value) {
      value = parsed;
      onValueChange?.(parsed);
    }

    // Re-format with grouping so thousands separators stay visible while
    // typing. Preserve a lone leading minus so the user can compose negatives
    // by typing `-` first — `parseInput` returns null for that intermediate
    // state, and `formatDisplay(null)` would otherwise wipe the buffer.
    const formatted = parsed === null && sanitized === '-' ? '-' : formatDisplay(parsed, false);
    displayValue = formatted;
    target.value = formatted;

    // Cursor restoration is relative to the digit count so the browser-driven
    // caret stays anchored after grouping separators shift positions.
    const newCursor = findCursorForSignificantCount(formatted, significantBeforeCursor);
    requestAnimationFrame(() => {
      try {
        target.setSelectionRange(newCursor, newCursor);
      } catch {
        // Some browsers throw when the input is no longer focused.
      }
    });
  }
</script>

{#snippet currencySymbolSlot()}
  <span class="text-text-tertiary px-1 text-sm select-none" aria-hidden="true">{symbol}</span>
{/snippet}

<Input
  {...inputProps}
  type="text"
  inputmode="decimal"
  value={displayValue}
  oninput={handleInput}
  leftIcon={symbolPosition === 'prefix' && symbol ? currencySymbolSlot : userLeftIcon}
  rightIcon={symbolPosition === 'suffix' && symbol ? currencySymbolSlot : userRightIcon}
/>

{#if name}
  <input type="hidden" {name} value={value ?? ''} />
{/if}

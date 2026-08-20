<script lang="ts">
  import { Input } from '$lib/primitives/Input';
  import { useI18n } from '@urbicon-ui/i18n';
  import {
    applyEdit,
    type CurrencyMask,
    type DeletionKind,
    fractionDigits
  } from './currency.engine';
  import type { CurrencyInputProps } from './index';

  let {
    value = $bindable(null),
    locale = 'auto',
    currency = 'EUR',
    symbolPosition = 'suffix',
    precision = 2,
    name,
    onValueChange,
    leftIcon: userLeftIcon,
    rightIcon: userRightIcon,
    ...inputProps
  }: CurrencyInputProps = $props();

  const i18n = useI18n();

  // `'auto'` (the default) follows the active `<I18nProvider>` locale — SSR-safe
  // (server and client resolve the same locale) and consistent with the rest of
  // the library's number formatting (CompositionBar/Sankey read `i18n.locale`
  // too). Falls back to the base locale (`en`) when no provider is mounted. An
  // explicit BCP 47 string overrides it.
  const resolvedLocale = $derived(locale === 'auto' ? i18n.locale : locale);

  const scale = $derived(fractionDigits(precision));

  const decimalSeparator = $derived(
    new Intl.NumberFormat(resolvedLocale).formatToParts(1.1).find((p) => p.type === 'decimal')
      ?.value ?? '.'
  );

  // The locale's ten digits, in ascending order. Most locales write `0`–`9`, but
  // `ar`, `fa`, `bn`, `my` and others do not, and a field that cannot read its
  // own digits back loses the amount on the first keystroke. Asking Intl for
  // 1234567890 and moving its last digit to the front is the whole derivation.
  const localeDigits = $derived.by(() => {
    const written = new Intl.NumberFormat(resolvedLocale, {
      useGrouping: false,
      maximumFractionDigits: 0
    }).format(1234567890);
    return written.length === 10 ? written[9] + written.slice(0, 9) : '0123456789';
  });

  const symbol = $derived.by(() => {
    if (symbolPosition === 'none') return '';
    const parts = new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  });

  function formatAmount(minor: number): string {
    // NaN/Infinity are out of contract for a minor-unit amount; an empty field
    // says so, `∞,NaN` on screen does not.
    if (!Number.isFinite(minor)) return '';
    const factor = 10 ** scale;
    // A minor unit is an integer by contract; rounding a consumer's stray float
    // here keeps it out of the display instead of printing `0,12.5`.
    const total = Math.round(Math.abs(minor));
    const intStr = Math.trunc(total / factor).toLocaleString(resolvedLocale, {
      useGrouping: true,
      maximumFractionDigits: 0
    });
    // The fraction is built from the digits themselves, so it has to be written
    // in the same numbering system Intl just used for the integer part — or the
    // field shows two scripts in one number.
    const fraction = (total % factor)
      .toString()
      .padStart(scale, '0')
      .replace(/[0-9]/g, (d) => localeDigits[Number(d)]);
    const body = scale > 0 ? intStr + decimalSeparator + fraction : intStr;
    return minor < 0 ? `-${body}` : body;
  }

  // Two states while composing carry no number that could express them: a lone
  // `-`, and a negative that has not reached a non-zero digit yet (`-0,00`).
  // The draft holds that text for the value it belongs to; it lives no longer
  // than the edit does — a `value` that moves elsewhere drops it (below), and
  // so does leaving the field.
  let draft = $state<{ for: number | null; text: string } | null>(null);

  function canonical(amount: number | null): string {
    if (draft && draft.for === amount) return draft.text;
    return amount == null ? '' : formatAmount(amount);
  }

  const mask = $derived<CurrencyMask>({
    precision: scale,
    decimal: decimalSeparator,
    digits: localeDigits,
    format: formatAmount
  });

  // The text the field shows. Derived from `value`, but assignable: the Input's
  // own `bind:value` writes here on every keystroke, and the edit handlers below
  // replace it with the masked text. Binding it (over passing `value=`) is what
  // keeps the Input's internal copy from going stale: an edit that leaves the
  // amount unchanged — deleting a cent digit that is already `0` — would
  // otherwise leave the raw text as the Input's idea of the field and undo the
  // mask on the next render.
  let displayText = $derived(canonical(value));

  // A `value` the consumer moves elsewhere ends a half-composed sign. Without
  // this the draft would sit dormant and repaint its minus if the consumer ever
  // set that value again.
  $effect(() => {
    const held = draft;
    if (held && held.for !== value) draft = null;
  });

  /** Which key produced a deletion, as far as the browser will say. */
  function deletionKind(inputType: string): DeletionKind {
    if (inputType.endsWith('Forward')) return 'forward';
    if (inputType.endsWith('Backward')) return 'backward';
    // A cut or a drag-out removes exactly the selection and reaches for nothing
    // beside it. Anything that is not a deletion at all never asks.
    return inputType.startsWith('delete') ? 'exact' : 'backward';
  }

  /** Commit one edit: the amount, the text, and the caret that goes with it. */
  function commit(
    target: HTMLInputElement | null,
    result: { value: number | null; display: string; caret: number }
  ) {
    if (result.value !== value) {
      value = result.value;
      onValueChange?.(result.value);
    }

    // A consumer that clamps or rejects the amount — writing `value` back from
    // `onValueChange`, or through the binding — has the last word. The field
    // then shows what it actually holds rather than the text of an amount that
    // was refused, and the caret goes to the end because the edit it belonged
    // to no longer happened.
    const settled = value;
    const accepted = settled === result.value;
    const text = accepted ? result.display : settled == null ? '' : formatAmount(settled);
    const caret = accepted ? result.caret : text.length;

    const formatted = settled == null ? '' : formatAmount(settled);
    draft = text === formatted ? null : { for: settled, text };
    displayText = text;

    if (!target) return;
    if (target.value !== text) target.value = text;
    try {
      // Synchronously, in the same task as the value write. A caret restored a
      // frame later is a caret the user watches jump.
      target.setSelectionRange(caret, caret);
    } catch {
      // Some browsers throw when the field is no longer selectable.
    }
  }

  /** Pending read-back of a write that was not (yet) explained by a keystroke. */
  let reconcile: ReturnType<typeof setTimeout> | undefined;

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const inputType = (event as InputEvent).inputType ?? '';
    // This edit is a keystroke after all; the reading below stands down.
    clearTimeout(reconcile);

    commit(
      target,
      applyEdit(mask, {
        // Not `displayText` — the binding may already have overwritten it with
        // the browser's raw text. The masked text the user was looking at is the
        // one the edit has to be read against.
        previous: canonical(value),
        next: target.value,
        caret: target.selectionStart ?? target.value.length,
        deletion: deletionKind(inputType)
      })
    );
  }

  // Every write to the field arrives here, and a keystroke is only one of them:
  // Input's own clear button, a `<form>` reset, a restored `persistKey` and text
  // typed into the field before hydration all write the bound text without ever
  // raising an `input` event this component can read. Left alone, each of them
  // changes what the field says without changing what it holds — a cleared field
  // that still submits the old amount. So the text is read back as the amount it
  // spells, once the keystroke path has had its chance: that one knows the caret
  // and which key produced the edit, and is the better reading wherever it runs.
  //
  // Deferred by a TASK, not a microtask. A browser drains microtasks *between*
  // event listeners, so a microtask here lands before this component's own
  // `input` handler and applies the edit without a caret — after which the real
  // handler diffs against text that has already moved. jsdom dispatches its
  // listeners in one uninterrupted turn and cannot see the difference; the
  // browser suite in `e2e/currency-input.spec.ts` is what catches it.
  function acceptText(raw: string) {
    displayText = raw;
    clearTimeout(reconcile);
    if (raw === canonical(value)) return;
    reconcile = setTimeout(() => {
      if (displayText !== raw) return;
      commit(null, applyEdit(mask, { previous: canonical(value), next: raw, caret: raw.length }));
    });
  }

  function handleBlur() {
    // A half-composed sign is an editing state, not a value; leaving the field
    // ends it.
    draft = null;
  }
</script>

{#snippet currencySymbolSlot()}
  <span class="text-text-tertiary px-1 text-sm select-none" aria-hidden="true">{symbol}</span>
{/snippet}

<Input
  {...inputProps}
  type="text"
  inputmode="decimal"
  bind:value={() => displayText, acceptText}
  oninput={handleInput}
  onblur={handleBlur}
  leftIcon={symbolPosition === 'prefix' && symbol ? currencySymbolSlot : userLeftIcon}
  rightIcon={symbolPosition === 'suffix' && symbol ? currencySymbolSlot : userRightIcon}
/>

{#if name}
  <!-- Only a real amount is submittable; `NaN` would post the string "NaN". -->
  <input type="hidden" {name} value={value != null && Number.isFinite(value) ? value : ''} />
{/if}

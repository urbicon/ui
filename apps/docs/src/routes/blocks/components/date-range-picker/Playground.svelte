<!--
  DateRangePicker-Playground — neu. Die Komponente steht im Katalog, hatte aber
  keine eigene Doku-Seite; ihr Beispiel lag im Beispielordner des DatePickers
  und war damit für den Hero nicht auffindbar. Zwei Konsumenten: die Doku-Seite
  und der Landing-Hero. Siehe `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { DateRangePicker } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { useI18n } from '@urbicon-ui/i18n';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // Die Datumsformatierung folgt der Sprache der Seite, nicht einem festen Tag:
  // Die Datums-Komponenten haben `locale = 'de-DE'` als Default und kennen den
  // i18n-Provider nicht (siehe docs/technical-debt.md). Ohne das hier stünde im
  // englischsprachigen Landing-Hero "März 2026".
  const i18n = useI18n();
  const dateLocale = $derived(i18n.locale === 'de' ? 'de-DE' : 'en-GB');

  let value = $state<{ start: Date; end: Date } | undefined>(undefined);

  const nights = $derived(
    value ? Math.ceil((value.end.getTime() - value.start.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0
  );

  const controls = deriveControls(componentData, {
    pick: [
      'label',
      'size',
      'inputVariant',
      'calendarVariant',
      'clearable',
      'showWeekNumbers',
      'showOutsideDays',
      'disabled'
    ],
    overrides: {
      label: { defaultValue: 'Travel dates' },
      inputVariant: { label: 'Input Variant' },
      calendarVariant: { label: 'Calendar Variant' },
      showWeekNumbers: { label: 'Week Numbers' },
      showOutsideDays: { label: 'Outside Days' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="DateRangePicker"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
>
  {#snippet children(values)}
    <div class="mx-auto w-full max-w-xs">
      <DateRangePicker
        bind:value
        label={String(values.label ?? '')}
        placeholder="Pick a range"
        size={values.size}
        inputVariant={values.inputVariant}
        calendarVariant={values.calendarVariant}
        clearable={values.clearable}
        showWeekNumbers={values.showWeekNumbers}
        showOutsideDays={values.showOutsideDays}
        disabled={values.disabled}
        locale={dateLocale}
        defaultMonth={2}
        defaultYear={2026}
      />

      {#if value}
        <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
          <p class="text-text-secondary text-sm">
            <span class="text-text-primary font-medium">From:</span>
            {value.start.toLocaleDateString(dateLocale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
          <p class="text-text-secondary text-sm">
            <span class="text-text-primary font-medium">To:</span>
            {value.end.toLocaleDateString(dateLocale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
          <p class="text-text-secondary mt-1 text-xs">{nights} days</p>
        </div>
      {/if}
    </div>
  {/snippet}
</PlaygroundConfigurator>

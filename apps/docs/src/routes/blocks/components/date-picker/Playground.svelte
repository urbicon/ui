<!--
  DatePicker-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { DatePicker } from '@urbicon-ui/blocks';
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
  // `Calendar`, `Planner` und `DatePicker` haben `locale = 'de-DE'` als Default
  // und kennen den i18n-Provider nicht (siehe docs/technical-debt.md). Ohne das
  // hier stünde im englischsprachigen Landing-Hero "März 2026".
  const i18n = useI18n();
  const dateLocale = $derived(i18n.locale === 'de' ? 'de-DE' : 'en-GB');

  // Die Beschriftung muss derselben Sprache folgen wie die Formatierung darüber.
  // Vorher standen hier feste deutsche Strings — im englischsprachigen Hero also
  // ein „Datum"-Feld mitten im englischen Satz, und der Platzhalter zusätzlich
  // ohne Umlaut („auswaehlen").
  const labels = $derived(
    i18n.locale === 'de'
      ? { label: 'Datum', placeholder: 'Datum auswählen' }
      : { label: 'Date', placeholder: 'Select a date' }
  );

  // Beide gehören in den Schnipsel: `locale` ist ein Detail dieser Doku-Site
  // (deshalb steht es in der SITE_ONLY-Liste des Lints), eine Beschriftung
  // dagegen hat jedes echte Datumsfeld. Vorher zeigte der Schnipsel ein
  // `<DatePicker />` ohne Label, während oben eines stand.
  const codeSetup = $derived({
    imports: ["import { DatePicker } from '@urbicon-ui/blocks';"],
    consts: { label: labels.label, placeholder: labels.placeholder },
    bind: ['label', 'placeholder']
  });

  const controls = deriveControls(componentData, {
    pick: [
      'size',
      'inputVariant',
      'calendarVariant',
      'clearable',
      'showWeekNumbers',
      'disabled',
      'required'
    ],
    overrides: {
      size: { defaultValue: 'md' },
      inputVariant: { label: 'Input Variant' },
      calendarVariant: { label: 'Calendar Variant' },
      clearable: { defaultValue: true },
      showWeekNumbers: { label: 'Week Numbers' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="DatePicker"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  {codeSetup}
>
  {#snippet children(values)}
    <!-- Deckel ohne `mx-auto`: Die Ausrichtung gehört der Bühne. Die Doku-Seite
         zentriert (`justify-center`), der Hero setzt linksbündig
         (`!justify-start`) — ein auto-Margin hätte dort gegen die eigene
         Vorgabe zentriert. -->
    <div class="max-w-xs">
      <DatePicker
        size={values.size}
        inputVariant={values.inputVariant}
        calendarVariant={values.calendarVariant}
        clearable={values.clearable}
        showWeekNumbers={values.showWeekNumbers}
        disabled={values.disabled}
        required={values.required}
        label={labels.label}
        placeholder={labels.placeholder}
        locale={dateLocale}
        defaultMonth={2}
        defaultYear={2026}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>

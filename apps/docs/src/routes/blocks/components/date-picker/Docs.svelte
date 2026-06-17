<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import {
    BasicDatePicker,
    DateRangeExample,
    WithConstraints,
    Sizes,
    Variants,
    WeekNumbers,
    Clearable
  } from './examples';

  import basicDatePickerCode from './examples/BasicDatePicker.svelte?raw';
  import dateRangeExampleCode from './examples/DateRangeExample.svelte?raw';
  import withConstraintsCode from './examples/WithConstraints.svelte?raw';
  import sizesCode from './examples/Sizes.svelte?raw';
  import variantsCode from './examples/Variants.svelte?raw';
  import weekNumbersCode from './examples/WeekNumbers.svelte?raw';
  import clearableCode from './examples/Clearable.svelte?raw';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'size',
          'inputVariant',
          'calendarVariant',
          'clearable',
          'showWeekNumbers',
          'disabled',
          'required'
        ],
        defaults: {
          size: 'md',
          inputVariant: 'outlined',
          calendarVariant: 'default',
          clearable: true
        },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'DatePicker Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Basic DatePicker"
      description="Einfache Datumsauswahl mit Label und Kalender-Popover. Klicke auf das Input, um den Kalender zu oeffnen. Das gewaehlte Datum wird formatiert angezeigt."
      code={basicDatePickerCode}
    >
      <BasicDatePicker />
    </CodeExample>

    <CodeExample
      title="DateRangePicker"
      description="Zeitraum-Auswahl mit zwei Klicks: Start- und Enddatum. Das Popover schliesst automatisch nach Auswahl beider Daten. Ideal fuer Buchungen und Filter."
      code={dateRangeExampleCode}
    >
      <DateRangeExample />
    </CodeExample>

    <CodeExample
      title="With Constraints"
      description="Einschraenkungen via minDate, maxDate, disabledDates und isDateDisabled. Hier sind nur Werktage im Maerz 2026 waehlbar – Wochenenden und Feiertage sind gesperrt."
      code={withConstraintsCode}
    >
      <WithConstraints />
    </CodeExample>

    <CodeExample
      title="Sizes"
      description="Alle fuenf Groessen im Ueberblick: xs, sm, md, lg, xl. Die Groesse beeinflusst Input und Kalender-Popup gleichermassen."
      code={sizesCode}
    >
      <Sizes />
    </CodeExample>

    <CodeExample
      title="Variants"
      description="Kalender-Varianten (default, bordered, ghost) und Input-Varianten (outlined, filled, ghost, underline) lassen sich unabhaengig kombinieren."
      code={variantsCode}
    >
      <Variants />
    </CodeExample>

    <CodeExample
      title="With Week Numbers"
      description="ISO-Kalenderwochen in der linken Spalte des Kalenders – nuetzlich fuer Projektplanung und Liefertermine."
      code={weekNumbersCode}
    >
      <WeekNumbers />
    </CodeExample>

    <CodeExample
      title="Clearable"
      description="Standardmaessig kann das Datum ueber das X-Icon geloescht werden. Mit clearable={'{false}'} wird die Loeschfunktion deaktiviert."
      code={clearableCode}
    >
      <Clearable />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="02" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA Roles</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Das Trigger-Input hat <code class="text-text-primary">aria-haspopup="dialog"</code> und
          <code class="text-text-primary">aria-expanded</code>, um den Popover-Status zu
          kommunizieren. Der eingebettete Kalender nutzt
          <code class="text-text-primary">role="grid"</code> mit vollstaendiger ARIA-Unterstuetzung.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard Navigation</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          oder
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >ArrowDown</kbd
          >
          oeffnen den Kalender.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          schliesst ihn. Im Kalender navigieren Pfeiltasten zwischen Tagen/Wochen,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >PageUp</kbd
          >/<kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >PageDown</kbd
          >
          zwischen Monaten. Fokus-Ringe nutzen
          <code class="text-text-primary">focus-visible:</code> fuer reine Keyboard-Sichtbarkeit.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Screen Reader Labels</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Das Label wird ueber das Input an den Screen Reader weitergegeben. Alle Tageszellen im
          Kalender haben ein <code class="text-text-primary">aria-label</code> mit dem
          vollstaendigen Datum (z.B. "Donnerstag, 12. Maerz 2026"). Fehler- und Hilfstexte werden
          via
          <code class="text-text-primary">aria-describedby</code> verknuepft.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Internationalisierung</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Datumsformatierung nutzt natives
          <code class="text-text-primary">Intl.DateTimeFormat</code> mit der konfigurierten
          <code class="text-text-primary">locale</code>. Wochentage, Monatsnamen und das
          Eingabeformat passen sich automatisch an die Sprache an.
        </p>
      </div>
    </div>
  </div>
</Section>

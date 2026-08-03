<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
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
  <NoteList>
    <Note title="ARIA Roles">
      <p>
        Das Trigger-Input hat <code class="text-text-primary">aria-haspopup="dialog"</code> und
        <code class="text-text-primary">aria-expanded</code>, um den Popover-Status zu
        kommunizieren. Der eingebettete Kalender nutzt
        <code class="text-text-primary">role="grid"</code> mit vollstaendiger ARIA-Unterstuetzung.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Enter" />,
        <Kbd keys="Space" />
        oder
        <Kbd keys="ArrowDown" />
        oeffnen den Kalender.
        <Kbd keys="Escape" />
        schliesst ihn. Im Kalender navigieren Pfeiltasten zwischen Tagen/Wochen,
        <Kbd keys="PageUp" />/<Kbd keys="PageDown" />
        zwischen Monaten. Fokus-Ringe nutzen
        <code class="text-text-primary">focus-visible:</code> fuer reine Keyboard-Sichtbarkeit.
      </p>
    </Note>
    <Note title="Screen Reader Labels">
      <p>
        Das Label wird ueber das Input an den Screen Reader weitergegeben. Alle Tageszellen im
        Kalender haben ein <code class="text-text-primary">aria-label</code> mit dem vollstaendigen
        Datum (z.B. "Donnerstag, 12. Maerz 2026"). Fehler- und Hilfstexte werden via
        <code class="text-text-primary">aria-describedby</code> verknuepft.
      </p>
    </Note>
    <Note title="Internationalisierung">
      <p>
        Datumsformatierung nutzt natives
        <code class="text-text-primary">Intl.DateTimeFormat</code> mit der konfigurierten
        <code class="text-text-primary">locale</code>. Wochentage, Monatsnamen und das Eingabeformat
        passen sich automatisch an die Sprache an.
      </p>
    </Note>
  </NoteList>
</Section>

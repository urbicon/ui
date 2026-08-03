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
      description="A labelled date field with a calendar popover. Clicking the input opens the calendar; the chosen date is written back formatted."
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
      description="The date clears through the × by default. Passing clearable as false takes that affordance away."
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
        The trigger input carries <code class="text-text-primary">aria-haspopup="dialog"</code> and
        <code class="text-text-primary">aria-expanded</code>, so the popover's state is announced.
        The embedded calendar is a <code class="text-text-primary">role="grid"</code> with the full ARIA
        that implies.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Enter" />,
        <Kbd keys="Space" />
        or
        <Kbd keys="ArrowDown" />
        open the calendar,
        <Kbd keys="Escape" />
        closes it. Inside, the arrow keys move between days and weeks and
        <Kbd keys="PageUp" />/<Kbd keys="PageDown" />
        between months. Focus rings use
        <code class="text-text-primary">focus-visible:</code>, so they appear for the keyboard only.
      </p>
    </Note>
    <Note title="Screen Reader Labels">
      <p>
        The label reaches the screen reader through the input. Every day cell carries an
        <code class="text-text-primary">aria-label</code> with the full date ("Thursday, 12 March
        2026"), and error and helper text are linked through
        <code class="text-text-primary">aria-describedby</code>.
      </p>
    </Note>
    <Note title="Internationalisation">
      <p>
        Formatting goes through the native
        <code class="text-text-primary">Intl.DateTimeFormat</code> with the configured
        <code class="text-text-primary">locale</code>, so weekday names, month names and the input
        format follow the language without further configuration.
      </p>
    </Note>
  </NoteList>
</Section>

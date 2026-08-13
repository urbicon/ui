<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { BasicDatePicker, DateRangeExample, WithConstraints } from './examples';

  import basicDatePickerCode from './examples/BasicDatePicker.svelte?raw';
  import dateRangeExampleCode from './examples/DateRangeExample.svelte?raw';
  import withConstraintsCode from './examples/WithConstraints.svelte?raw';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Basic DatePicker"
      description="A labelled date field with a calendar popover. The bound value is a Date; the field shows it formatted for the locale."
      code={basicDatePickerCode}
    >
      <BasicDatePicker />
    </CodeExample>

    <CodeExample
      title="DateRangePicker"
      description="The separate DateRangePicker picks a start and end date in two clicks, and closes once both are set. Use it for bookings or a report filter."
      code={dateRangeExampleCode}
    >
      <DateRangeExample />
    </CodeExample>

    <CodeExample
      title="With Constraints"
      description="minDate, maxDate, disabledDates and isDateDisabled together: only weekdays in March 2026 stay selectable, with weekends and holidays locked out."
      code={withConstraintsCode}
    >
      <WithConstraints />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA Roles">
      <p>
        The trigger input carries <code class="text-text-primary">aria-haspopup="dialog"</code> and
        <code class="text-text-primary">aria-expanded</code>, so the popover's state is announced.
        The embedded calendar is a <code class="text-text-primary">role="grid"</code> of day cells,
        with the same keyboard model as
        <a href={resolve('/blocks/components/calendar')} class="text-primary hover:underline"
          >Calendar</a
        >.
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

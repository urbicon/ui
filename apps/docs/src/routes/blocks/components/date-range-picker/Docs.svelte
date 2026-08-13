<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { DateRangePicker, Kbd, type DateRange } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let stay = $state<DateRange | undefined>(undefined);
  let reportRange = $state<DateRange | undefined>(undefined);
  let bookable = $state<DateRange | undefined>(undefined);

  // A fixed anchor keeps the min/max demo deterministic across renders —
  // no `new Date()` drifting the bounds between SSR and hydration.
  const TODAY = new Date(2026, 7, 3);
  const IN_90_DAYS = new Date(2026, 10, 1);
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Booking a stay"
      description="Two clicks on one dual calendar: the first sets the start, the second the end. `closeOnSelect` (the default) dismisses the popover once the range is complete, so the flow ends without a second gesture."
      code={`<script>
  import { DateRangePicker, type DateRange } from '@urbicon-ui/blocks';
  let stay = $state<DateRange | undefined>(undefined);
<\/script>

<DateRangePicker
  label="Check-in / check-out"
  bind:value={stay}
  placeholder="Pick your dates"
  clearable
/>`}
      isolate
      previewClass="flex max-w-sm flex-col gap-4"
    >
      <DateRangePicker
        label="Check-in / check-out"
        bind:value={stay}
        placeholder="Pick your dates"
        clearable
      />
    </CodeExample>

    <CodeExample
      title="Bounded to a bookable window"
      description="`minDate` and `maxDate` fence the calendar; `isDateDisabled` blocks the irregular gaps a fixed range cannot express, here every Sunday."
      code={`<script>
  import { DateRangePicker, type DateRange } from '@urbicon-ui/blocks';
  let bookable = $state<DateRange | undefined>(undefined);
  const TODAY = new Date(2026, 7, 3);
  const IN_90_DAYS = new Date(2026, 10, 1);
<\/script>

<DateRangePicker
  label="Bookable period"
  bind:value={bookable}
  minDate={TODAY}
  maxDate={IN_90_DAYS}
  isDateDisabled={(d) => d.getDay() === 0}
  helper="Next 90 days, Sundays excluded"
/>`}
      isolate
      previewClass="flex max-w-sm flex-col gap-4"
    >
      <DateRangePicker
        label="Bookable period"
        bind:value={bookable}
        minDate={TODAY}
        maxDate={IN_90_DAYS}
        isDateDisabled={(d) => d.getDay() === 0}
        helper="Next 90 days, Sundays excluded"
      />
    </CodeExample>

    <CodeExample
      title="Reporting period in a form"
      description="`name` writes two hidden inputs, `period_start` and `period_end`, each carrying the serialised date, so the submitted form has the ISO values, not the locale-formatted display text. An empty range submits both as an empty string."
      code={`<script>
  import { DateRangePicker, type DateRange } from '@urbicon-ui/blocks';
  let reportRange = $state<DateRange | undefined>(undefined);
<\/script>

<DateRangePicker
  label="Reporting period"
  name="period"
  bind:value={reportRange}
  required
  helper="Submitted as period_start and period_end"
/>`}
      isolate
      previewClass="flex max-w-sm flex-col gap-4"
    >
      <DateRangePicker
        label="Reporting period"
        name="period"
        bind:value={reportRange}
        required
        helper="Submitted as period_start and period_end"
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      The trigger and the calendar are styled separately:
      <code class="text-text-primary">inputVariant</code> takes the Input ladder (<code
        class="text-text-primary">outlined</code
      >,
      <code class="text-text-primary">filled</code>, <code class="text-text-primary">ghost</code>,
      <code class="text-text-primary">underline</code>) and
      <code class="text-text-primary">calendarVariant</code> the Calendar one (<code
        class="text-text-primary">default</code
      >,
      <code class="text-text-primary">bordered</code>,
      <code class="text-text-primary">ghost</code>).
      <code class="text-text-primary">size</code> applies to both.
    </p>
    <p>
      The calendar props pass straight through:
      <code class="text-text-primary">locale</code>,
      <code class="text-text-primary">weekStartsOn</code>,
      <code class="text-text-primary">showWeekNumbers</code>,
      <code class="text-text-primary">showOutsideDays</code>,
      <code class="text-text-primary">fixedWeeks</code>.
      <code class="text-text-primary">locale</code>
      defaults to <code class="text-text-primary">'auto'</code>, which follows the active
      <code class="text-text-primary">&lt;I18nProvider&gt;</code>, so an app that already declares
      its language does not repeat it here.
    </p>
    <p>
      For a single date use
      <a href={resolve('/blocks/components/date-picker')} class="text-primary hover:underline"
        >DatePicker</a
      >; for the calendar without an input, see
      <a href={resolve('/blocks/components/calendar')} class="text-primary hover:underline"
        >Calendar</a
      >. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a> for the
      general contract.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Popup state on the trigger">
      <p>
        The text input carries <code class="text-text-primary">aria-haspopup="dialog"</code>,
        <code class="text-text-primary">aria-expanded</code>, and (while open)
        <code class="text-text-primary">aria-controls</code> pointing at the calendar, so assistive tech
        reports both that a calendar exists and whether it is showing.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="↓" /> opens the calendar from the field.
        <Kbd keys="Enter" /> closes it while open, and commits what has been typed while it is not.
        <Kbd keys="Esc" /> closes the calendar; pressed again on a field with an uncommitted draft it
        discards that draft rather than the selection. Grid navigation inside the calendar follows the
        <a href={resolve('/blocks/components/calendar')} class="text-primary hover:underline"
          >Calendar</a
        > pattern.
      </p>
    </Note>
    <Note title="Both embedded buttons are named">
      <p>
        When <code class="text-text-primary">clearable</code> is set the field carries two controls,
        and each gets its own localized
        <code class="text-text-primary">aria-label</code>: "clear input" and "open calendar". Both
        keep a visible
        <code class="text-text-primary">focus-visible</code> ring.
      </p>
    </Note>
    <Note title="Typing is a first-class path">
      <p>
        The range can be typed as well as clicked; parsing happens on blur or
        <Kbd keys="Enter" />, and a parse failure shows as the field's
        <code class="text-text-primary">error</code>.
      </p>
    </Note>
    <Note title="Dismissal is separable from notification">
      <p>
        <code class="text-text-primary">closeOnEscape</code> and
        <code class="text-text-primary">closeOnClickOutside</code> govern whether the popover
        closes;
        <code class="text-text-primary">onEscape</code> and
        <code class="text-text-primary">onClickOutside</code> only tell you it happened.
      </p>
    </Note>
  </NoteList>
</Section>

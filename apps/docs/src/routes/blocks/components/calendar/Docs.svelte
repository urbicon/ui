<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    BasicMonth,
    YearView,
    WeekTimeGrid,
    AgendaView,
    MultiDayEvents,
    RecurringEvents,
    RangeSelection,
    DisabledDates,
    CustomDayCell
  } from './examples';

  import customDayCellCode from './examples/CustomDayCell.svelte?raw';

  // The month group renders three demos, so its snippet shows the data model
  // they share rather than one of the three sources. `RecurrenceRule` is the
  // least guessable part of the Calendar API and the page renders no
  // TypesReference, so dropping it here would leave it documented nowhere on
  // /blocks/components/calendar — which is what the first cut of this grouping
  // did while the description still promised it.
  const eventShapesCode = `import type { CalendarEvent } from '@urbicon-ui/blocks';

const events: CalendarEvent[] = [
  // One day: start only.
  { id: '1', title: 'Code freeze', start: new Date(2026, 2, 18), categoryId: 'deadline' },

  // A span: add end, and the event draws across every day between.
  { id: '2', title: 'Sprint 14', start: new Date(2026, 2, 9), end: new Date(2026, 2, 20) },

  // A series: one object plus a rule, expanded by the calendar.
  // byDay is 0-6 (Sunday-Saturday): on \`weekly\` it generates one occurrence
  // per listed day, on \`daily\` it filters the days the interval produces.
  // interval skips n periods; until ends the series (inclusive).
  {
    id: '3',
    title: 'Standup',
    start: new Date(2026, 2, 2),
    recurrence: {
      frequency: 'weekly',
      byDay: [1, 2, 3, 4, 5],
      until: new Date(2026, 2, 31)
    }
  },
  {
    id: '4',
    title: 'Sprint review',
    start: new Date(2026, 2, 6),
    recurrence: { frequency: 'weekly', interval: 2, byDay: [5] }
  }
];

<Calendar {events} {categories} showLegend showWeekNumbers />`;

  // Three of the four examples below group several demos under one heading (nine
  // headings was more than anyone reads). Where the demos differ only by a prop,
  // the snippet shows that prop rather than three full component sources — the
  // `code` prop is deliberately not the rendered markup in those two cases.
  const viewsCode = `<!-- One component, one prop. The default view is "month". -->
<Calendar
  view="week"
  {events}
  {categories}
  showTimeGrid
  timeGridStartHour={8}
  timeGridEndHour={18}
  timeGridInterval={30}
/>

<Calendar view="year" views={['month', 'year']} {events} {categories} defaultYear={2026} />

<Calendar view="agenda" {events} {categories} agendaDays={21} />`;

  const constraintsCode = `<!-- Two clicks pick a range; minDate/maxDate bound both ends. -->
<Calendar
  selectionMode="range"
  bind:value
  variant="bordered"
  minDate={new Date(2026, 2, 1)}
  maxDate={new Date(2026, 3, 30)}
/>

<!-- disabledDates locks named days, isDateDisabled locks a rule. -->
<Calendar
  bind:value={selectedDate}
  variant="bordered"
  {minDate}
  {maxDate}
  disabledDates={holidays}
  isDateDisabled={(d) => d.getDay() === 0 || d.getDay() === 6}
/>`;
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Events in a month view"
      description="The month grid is the default and carries the whole event model. A one-day event needs only start; adding end draws it across a span (conferences, sprints, holidays); adding a recurrence rule expands one object into a series (a weekday standup, a biweekly review). Categories colour the entries and drive the legend, and clicking a day opens its detail list."
      code={eventShapesCode}
    >
      <div class="space-y-10">
        <BasicMonth />
        <MultiDayEvents />
        <RecurringEvents />
      </div>
    </CodeExample>

    <CodeExample
      title="Week, year and agenda views"
      description="Same component, same events, one prop. Pick week with a time grid when the hour matters, year when the question is distribution across months, and agenda when the reader wants a list rather than a grid. The snippet shows only what differs between the three."
      code={viewsCode}
    >
      <div class="space-y-10">
        <WeekTimeGrid />
        <YearView />
        <AgendaView />
      </div>
    </CodeExample>

    <CodeExample
      title="Constrained selection"
      description="Two ways to narrow what a reader may pick, usually used together: selectionMode='range' takes a start and an end in two clicks, while minDate/maxDate bound the navigable window, disabledDates locks named days such as public holidays, and isDateDisabled locks a rule such as weekends."
      code={constraintsCode}
    >
      <div class="space-y-10">
        <RangeSelection />
        <DisabledDates />
      </div>
    </CodeExample>

    <CodeExample
      title="Custom day cells – heatmap"
      description="Full control over day-cell rendering with the dayCell snippet — the escape hatch for anything the event model does not express. Here as a GitHub-style activity heatmap: the more events on a day, the more intense the green."
      code={customDayCellCode}
    >
      <CustomDayCell />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA Roles">
      <p>
        The month grid uses <code class="text-text-primary">role="grid"</code> with
        <code class="text-text-primary">role="row"</code> for weeks and
        <code class="text-text-primary">role="gridcell"</code> for days. Each cell carries
        <code class="text-text-primary">aria-selected</code>,
        <code class="text-text-primary">aria-disabled</code>, and
        <code class="text-text-primary">aria-current="date"</code> for today.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="←" />
        <Kbd keys="→" />
        move focus between days,
        <Kbd keys="↑" />
        <Kbd keys="↓" />
        between weeks.
        <Kbd keys="Home" />/<Kbd keys="End" />
        jump to the start/end of the week.
        <Kbd keys="PageUp" />/<Kbd keys="PageDown" />
        navigate between months.
        <Kbd keys="Enter" />/<Kbd keys="Space" />
        select the focused day. Focus rings use
        <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
      </p>
    </Note>
    <Note title="Screen Reader Labels">
      <p>
        Every day cell has an <code class="text-text-primary">aria-label</code> with the full date
        (e.g. "Thursday, March 12, 2026"). Navigation buttons have descriptive labels. Event dots
        are
        <code class="text-text-primary">aria-hidden</code>; event details remain accessible through
        the event list.
      </p>
    </Note>
    <Note title="Touch & Gestures">
      <p>
        Horizontal swiping navigates between months/weeks/days. Touch input is handled through the
        Pointer Events API. Swipe gestures can be disabled via
        <code class="text-text-primary">swipeable={'{false}'}</code>. Animations respect
        <code class="text-text-primary">prefers-reduced-motion</code>.
      </p>
    </Note>
    <Note title="Internationalization">
      <p>
        All visible text and ARIA labels use i18n keys via
        <code class="text-text-primary">bt()</code>. Date formatting relies on the native
        <code class="text-text-primary">Intl.DateTimeFormat</code> with the configured
        <code class="text-text-primary">locale</code>. Weekday names, month names, and date formats
        adapt automatically.
      </p>
    </Note>
  </NoteList>
</Section>

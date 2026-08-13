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
  // least guessable part of the Calendar API, so the snippet spells its fields
  // out; the full shapes (CalendarEvent, CalendarEventCategory, …) are in the
  // page's Types section.
  const eventShapesCode = `import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

const events: CalendarEvent[] = [
  // One day: start only.
  { id: '1', title: 'Code freeze', start: new Date(2026, 2, 18), categoryId: 'deadline' },

  // A span: add end, and the event draws across every day between.
  { id: '2', title: 'Sprint 14', start: new Date(2026, 2, 9), end: new Date(2026, 2, 20) },

  // A series: one object plus a rule, expanded by the calendar.
  // byDay is 0-6 (Sunday-Saturday): on \`weekly\` it generates one occurrence
  // per listed day, on \`daily\` it filters the days the interval produces.
  // interval repeats every n periods; until ends the series (inclusive).
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

// A category colours its events' dots and labels the legend. \`color\` takes
// any CSS colour or a Tailwind class; \`categoryId\` on an event points here.
const categories: CalendarEventCategory[] = [
  { id: 'deadline', label: 'Deadline', color: '#ef4444' }
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

  const constraintsCode = `<!-- Two clicks pick a range; minDate/maxDate cap what you can reach and pick. -->
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
      description="The month grid is the default. An event can cover a single day, span consecutive days, or repeat on a schedule; the calendar expands a recurrence rule into its occurrences, so you define it once. Clicking a day opens its detail list."
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
      description="The view prop switches between them. Use week when the hour matters, year for distribution across months, and agenda for a list instead of a grid. `views` sets which buttons the switcher offers."
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
      description="Set selectionMode='range' to pick a start and end in two clicks. Three props constrain what's pickable: minDate/maxDate bound the range, disabledDates locks named days like public holidays, and isDateDisabled locks a rule like weekends."
      code={constraintsCode}
    >
      <div class="space-y-10">
        <RangeSelection />
        <DisabledDates />
      </div>
    </CodeExample>

    <CodeExample
      title="Custom day cells – heatmap"
      description="The dayCell snippet lets you render each day yourself, for anything the event model does not cover. Here it draws a GitHub-style heatmap: more events on a day, more intense green."
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
        Horizontal swiping navigates between months and days. In the week view, when the time grid
        overflows sideways on a narrow screen, a horizontal drag pans the grid instead of
        navigating; once it fits, swiping navigates weeks again. Swipe gestures can be disabled with
        <code class="text-text-primary">swipeable={'{false}'}</code>. Animations respect
        <code class="text-text-primary">prefers-reduced-motion</code>.
      </p>
    </Note>
    <Note title="Narrow Viewports">
      <p>
        Below phone widths the week keeps its seven columns behind a horizontal scroll with a sticky
        time column, so no information is dropped. Where a single day reads better, drive
        <code class="text-text-primary">view</code> from a
        <code class="text-text-primary">MediaQuery</code> (with a
        <code class="text-text-primary">false</code> server fallback, so a prerendered page does not
        flip on hydration) and pass <code class="text-text-primary">views</code> without
        <code class="text-text-primary">week</code>, so the switcher offers day instead.
      </p>
    </Note>
    <Note title="Internationalization">
      <p>
        All visible text and ARIA labels are localized through i18n keys. Date formatting relies on
        the native
        <code class="text-text-primary">Intl.DateTimeFormat</code> with the configured
        <code class="text-text-primary">locale</code>. Weekday names, month names, and date formats
        adapt automatically.
      </p>
    </Note>
  </NoteList>
</Section>

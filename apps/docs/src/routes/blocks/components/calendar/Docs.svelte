<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
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

  import basicMonthCode from './examples/BasicMonth.svelte?raw';
  import yearViewCode from './examples/YearView.svelte?raw';
  import weekTimeGridCode from './examples/WeekTimeGrid.svelte?raw';
  import agendaViewCode from './examples/AgendaView.svelte?raw';
  import multiDayEventsCode from './examples/MultiDayEvents.svelte?raw';
  import recurringEventsCode from './examples/RecurringEvents.svelte?raw';
  import rangeSelectionCode from './examples/RangeSelection.svelte?raw';
  import disabledDatesCode from './examples/DisabledDates.svelte?raw';
  import customDayCellCode from './examples/CustomDayCell.svelte?raw';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'variant',
          'size',
          'view',
          'selectionMode',
          'showWeekNumbers',
          'showOutsideDays',
          'fixedWeeks',
          'eventPopover',
          'showTimeGrid',
          'showMiniCalendar',
          'animated',
          'disabled'
        ],
        defaults: { variant: 'default', size: 'md', view: 'month', selectionMode: 'single' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Calendar Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Month View with Events"
      description="Calendar with color-coded events, a category legend, an event detail list, and week numbers. Click a day to see its events."
      code={basicMonthCode}
    >
      <BasicMonth />
    </CodeExample>

    <CodeExample
      title="Week View with Time Grid"
      description="Week view with an hour-based time grid, overlapping appointments, and all-day events. The time axis shows 30-minute intervals."
      code={weekTimeGridCode}
    >
      <WeekTimeGrid />
    </CodeExample>

    <CodeExample
      title="Multi-Day Events"
      description="Events spanning multiple days — conferences, sprints, or vacations. Hovering a day with events opens an event popover."
      code={multiDayEventsCode}
    >
      <MultiDayEvents />
    </CodeExample>

    <CodeExample
      title="Recurring Events"
      description="Recurring events with flexible rules: daily standups (weekdays only), biweekly reviews, sports on specific weekdays."
      code={recurringEventsCode}
    >
      <RecurringEvents />
    </CodeExample>

    <CodeExample
      title="Year Overview"
      description="Year overview as a 3×4 grid of mini months. Event indicators show the distribution across the year. Clicking a month switches to the month view."
      code={yearViewCode}
    >
      <YearView />
    </CodeExample>

    <CodeExample
      title="Agenda View"
      description="Chronological event list for the next 21 days, grouped by date — ideal for a quick schedule preview."
      code={agendaViewCode}
    >
      <AgendaView />
    </CodeExample>

    <CodeExample
      title="Date Range Selection"
      description="Date range selection with two clicks. Navigation is constrained by minDate/maxDate. The bordered variant visually sets the calendar apart."
      code={rangeSelectionCode}
    >
      <RangeSelection />
    </CodeExample>

    <CodeExample
      title="Disabled Dates"
      description="Blocking specific days: isDateDisabled blocks weekends, disabledDates locks individual holidays. Navigation is constrained by minDate/maxDate."
      code={disabledDatesCode}
    >
      <DisabledDates />
    </CodeExample>

    <CodeExample
      title="Custom Day Cell – Heatmap"
      description="Full control over day-cell rendering with the dayCell snippet. Here as a GitHub-style activity heatmap: the more events on a day, the more intense the green."
      code={customDayCellCode}
    >
      <CustomDayCell />
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
          The month grid uses <code class="text-text-primary">role="grid"</code> with
          <code class="text-text-primary">role="row"</code> for weeks and
          <code class="text-text-primary">role="gridcell"</code> for days. Each cell carries
          <code class="text-text-primary">aria-selected</code>,
          <code class="text-text-primary">aria-disabled</code>, and
          <code class="text-text-primary">aria-current="date"</code> for today.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard Navigation</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >←</kbd
          >
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >→</kbd
          >
          move focus between days,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >↑</kbd
          >
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >↓</kbd
          >
          between weeks.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Home</kbd
          >/<kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >End</kbd
          >
          jump to the start/end of the week.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >PageUp</kbd
          >/<kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >PageDown</kbd
          >
          navigate between months.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >/<kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          select the focused day. Focus rings use
          <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Screen Reader Labels</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Every day cell has an <code class="text-text-primary">aria-label</code> with the full date
          (e.g. "Thursday, March 12, 2026"). Navigation buttons have descriptive labels. Event dots
          are
          <code class="text-text-primary">aria-hidden</code>; event details remain accessible
          through the event list.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Touch & Gestures</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Horizontal swiping navigates between months/weeks/days. Touch input is handled through the
          Pointer Events API. Swipe gestures can be disabled via
          <code class="text-text-primary">swipeable={'{false}'}</code>. Animations respect
          <code class="text-text-primary">prefers-reduced-motion</code>.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Internationalization</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          All visible text and ARIA labels use i18n keys via
          <code class="text-text-primary">bt()</code>. Date formatting relies on the native
          <code class="text-text-primary">Intl.DateTimeFormat</code> with the configured
          <code class="text-text-primary">locale</code>. Weekday names, month names, and date
          formats adapt automatically.
        </p>
      </div>
    </div>
  </div>
</Section>

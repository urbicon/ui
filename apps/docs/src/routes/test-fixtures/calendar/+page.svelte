<script lang="ts">
  // E2E fixture for Calendar interactions (e2e/calendar.spec.ts). Anchored to a
  // FIXED month (June 2026), never the wall clock, so day selectors and header
  // labels are deterministic across runs and years. `locale="en-US"` pins the
  // header text explicitly rather than leaning on the component default — which
  // follows the page's i18n provider since 2026-07-31, and was a hardcoded
  // 'de-DE' before that. Either way the fixture must not depend on it. The probes mirror
  // bound state + callbacks so the spec asserts the model, not just rendered
  // text — plain <span>s, not <output>: output's implicit role="status"
  // collides with the calendar's own sr-only month live region in role
  // queries.
  import {
    Calendar,
    type CalendarEvent,
    type CalendarSelection,
    type CalendarViewMode,
    DatePicker,
    Planner
  } from '@urbicon-ui/blocks';

  const anchor = new Date(2026, 5, 15);

  const categories = [
    { id: 'work', label: 'Work', color: 'var(--color-primary)' },
    { id: 'private', label: 'Private', color: 'var(--color-success)' }
  ];

  const events: CalendarEvent[] = [
    { id: 'e1', title: 'Team standup', start: new Date(2026, 5, 10), categoryId: 'work' },
    { id: 'e2', title: 'Release v7', start: new Date(2026, 5, 24), categoryId: 'work' },
    { id: 'e3', title: 'Concert', start: new Date(2026, 5, 24), categoryId: 'private' }
  ];

  // bind:value from the empty (undefined) initial — the only type-correct
  // "no selection". This deliberately regression-probes the write-back fix
  // (Calendar now always assigns its $bindable instead of gating on
  // `value !== undefined`): the spec's selection probe reads the BOUND value,
  // so a bind:value-from-empty regression fails e2e, not just unit tests.
  let selected = $state<CalendarSelection | undefined>(undefined);
  let view = $state<CalendarViewMode>('month');
  let lastEventTitle = $state('');
  let lastMonth = $state('');
  let a11yClicked = $state('');

  // The accessibility section (#208): every view whose structure axe judges,
  // with multi-day bars both on a consumer colour and on the library's own fill,
  // and outside-month days plus week numbers in every variant.
  const spanCategories = [{ id: 'violet', label: 'Violet', color: '#8b5cf6' }];
  const spanEvents: CalendarEvent[] = [
    { id: 's1', title: 'Offsite', start: new Date(2026, 5, 9), end: new Date(2026, 5, 11) },
    {
      id: 's2',
      title: 'Trip',
      start: new Date(2026, 5, 13),
      end: new Date(2026, 5, 16),
      categoryId: 'violet'
    }
  ];
  const variants = ['default', 'bordered', 'ghost'] as const;

  // Disabled days the keys must still reach: every weekend, one of them with an
  // event, so its popover is in play too.
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const weekendEvents: CalendarEvent[] = [
    { id: 'w1', title: 'Closed for inventory', start: new Date(2026, 5, 7) }
  ];
  let weekendRange = $state<CalendarSelection | undefined>(undefined);
  let weekendMonth = $state('');

  // A Planner month view anchored on 31 March: its grid's last row spills into
  // April, so ArrowRight steps the month while both grids show 1 April.
  const plannerItems: { id: string; date: Date }[] = [];

  // Single-select mode always yields a Date; anything else renders 'none'.
  const iso = (v: CalendarSelection | undefined) =>
    v instanceof Date
      ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
      : 'none';
  const isoRange = (v: CalendarSelection | undefined) =>
    v && !(v instanceof Date) && !Array.isArray(v) ? `${iso(v.start)}..${iso(v.end)}` : 'none';
</script>

<svelte:head>
  <title>Calendar Test Fixtures</title>
</svelte:head>

<div class="bg-surface-base min-h-screen space-y-10 p-8" data-testid="calendar-fixtures">
  <h1 class="text-text-primary text-xl font-bold">Calendar fixtures</h1>

  <section data-testid="cal-main" class="max-w-3xl">
    <Calendar
      defaultDate={anchor}
      locale="en-US"
      bind:view
      bind:value={selected}
      views={['month', 'week', 'day']}
      {events}
      {categories}
      eventPopover
      onEventClick={(e) => (lastEventTitle = e.title)}
      onMonthChange={(month, year) => (lastMonth = `${month}-${year}`)}
    />
    <div class="text-text-secondary mt-4 space-x-4 text-sm">
      <span data-testid="cal-selected">{iso(selected)}</span>
      <span data-testid="cal-view">{view}</span>
      <span data-testid="cal-event-clicked">{lastEventTitle || 'none'}</span>
      <span data-testid="cal-month">{lastMonth || 'none'}</span>
    </div>
  </section>

  <section data-testid="cal-bounded" class="max-w-3xl">
    <!-- min/max span exactly one month: both nav directions sit at their bound. -->
    <Calendar
      defaultDate={anchor}
      locale="en-US"
      minDate={new Date(2026, 5, 1)}
      maxDate={new Date(2026, 5, 30)}
      views={['month']}
    />
  </section>

  <section data-testid="cal-weekends" class="max-w-3xl">
    <Calendar
      defaultDate={anchor}
      locale="en-US"
      views={['month']}
      selectionMode="range"
      bind:value={weekendRange}
      isDateDisabled={isWeekend}
      events={weekendEvents}
      eventPopover
      onMonthChange={(month, year) => (weekendMonth = `${month}-${year}`)}
    />
    <div class="text-text-secondary space-x-4 text-sm">
      <span data-testid="cal-weekends-range">{isoRange(weekendRange)}</span>
      <span data-testid="cal-weekends-month">{weekendMonth || 'none'}</span>
    </div>
  </section>

  <section data-testid="cal-picker-weekends" class="max-w-sm">
    <DatePicker
      label="Delivery day"
      locale="en-US"
      defaultMonth={5}
      defaultYear={2026}
      isDateDisabled={isWeekend}
    />
  </section>

  <section data-testid="planner-month" class="max-w-3xl">
    <Planner
      view="month"
      value={new Date(2026, 2, 31)}
      locale="en-US"
      items={plannerItems}
      getDate={(item) => item.date}
    />
  </section>

  <section data-testid="cal-a11y" class="max-w-3xl space-y-10">
    <span class="text-text-secondary text-sm" data-testid="cal-a11y-clicked"
      >{a11yClicked || 'none'}</span
    >
    {#each variants as variant (variant)}
      <div data-testid="cal-a11y-month-{variant}">
        <Calendar
          defaultDate={anchor}
          locale="en-US"
          {variant}
          views={['month']}
          showWeekNumbers
          events={spanEvents}
          categories={spanCategories}
          onEventClick={(e) => (a11yClicked = e.title)}
        />
      </div>
    {/each}
    <div data-testid="cal-a11y-year">
      <Calendar defaultDate={anchor} locale="en-US" view="year" views={['year']} />
    </div>
    <div data-testid="cal-a11y-week">
      <Calendar
        defaultDate={anchor}
        locale="en-US"
        view="week"
        views={['week']}
        showMiniCalendar
        events={spanEvents}
        categories={spanCategories}
        onEventClick={(e) => (a11yClicked = e.title)}
      />
    </div>
    <div data-testid="cal-a11y-daycell">
      <Calendar defaultDate={anchor} locale="en-US" views={['month']}>
        {#snippet dayCell(ctx)}
          <span class="text-text-primary text-sm">{ctx.date.getDate()}</span>
        {/snippet}
      </Calendar>
    </div>
  </section>
</div>

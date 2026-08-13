<script lang="ts">
  import { Calendar, ResourceTimeline } from '@urbicon-ui/blocks';
  import type { CalendarEvent, DateCategory, TimelineResource } from '@urbicon-ui/blocks';

  // One array, two surfaces. These are `CalendarEvent`s — the shape a Calendar
  // already holds — and the timeline reads them through its accessors instead of
  // a converted copy: `getResourceId` finds the lane, `getRange` the nights.
  const events: CalendarEvent[] = [
    {
      id: 'b1',
      title: 'Lindqvist',
      start: new Date(2026, 5, 15),
      end: new Date(2026, 5, 18),
      categoryId: 'garden',
      meta: { roomId: 'r-01' }
    },
    {
      id: 'b2',
      title: 'Amaral',
      start: new Date(2026, 5, 16),
      end: new Date(2026, 5, 21),
      categoryId: 'suite',
      meta: { roomId: 'r-02' }
    },
    {
      id: 'b3',
      title: 'Weber',
      start: new Date(2026, 5, 19),
      end: new Date(2026, 5, 20),
      categoryId: 'garden',
      meta: { roomId: 'r-01' }
    }
  ];

  // The same categories drive both legends: `DateCategory` is one type across
  // the date surfaces, so nothing is mapped here either.
  const categories: DateCategory[] = [
    { id: 'garden', label: 'Garden Room', color: 'oklch(0.62 0.13 250)' },
    { id: 'suite', label: 'Suite', color: 'oklch(0.72 0.15 60)' }
  ];

  const rooms: TimelineResource[] = [
    { id: 'r-01', label: 'Room 01', description: 'Garden Room' },
    { id: 'r-02', label: 'Room 02', description: 'Suite' }
  ];
</script>

<div class="space-y-6">
  <ResourceTimeline
    view="days"
    days={10}
    size="sm"
    value={new Date(2026, 5, 14)}
    locale="en-GB"
    resources={rooms}
    items={events}
    {categories}
    getResourceId={(event) => String(event.meta?.roomId ?? '')}
    getRange={(event) => ({ start: event.start, end: event.end ?? event.start })}
    getCategoryId={(event) => event.categoryId}
    getLabel={(event) => event.title}
  />

  <!-- The same three stays as month bars: one axis instead of two, which is the
       whole difference between the surfaces. -->
  <Calendar
    view="month"
    views={['month']}
    defaultDate={new Date(2026, 5, 14)}
    showViewSwitcher={false}
    showEventList={false}
    size="sm"
    locale="en-GB"
    {events}
    {categories}
  />
</div>

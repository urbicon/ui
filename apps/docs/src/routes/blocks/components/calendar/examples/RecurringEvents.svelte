<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

  const categories: CalendarEventCategory[] = [
    { id: 'standup', label: 'Standup', color: '#8b5cf6' },
    { id: 'review', label: 'Review', color: '#3b82f6' },
    { id: 'sport', label: 'Sports', color: '#22c55e' },
    { id: 'waste', label: 'Waste collection', color: '#6b7280' }
  ];

  const events: CalendarEvent[] = [
    {
      id: 'standup',
      title: 'Daily Standup',
      start: new Date(2026, 2, 2),
      categoryId: 'standup',
      description: 'Daily team standup',
      // Spelled `weekly` because that is what this series means: the same five
      // days, every week. `daily` + the same `byDay` filters instead of
      // generating — identical here, but not once `interval` is involved.
      recurrence: { frequency: 'weekly', byDay: [1, 2, 3, 4, 5], until: new Date(2026, 2, 31) }
    },
    {
      id: 'review',
      title: 'Sprint Review',
      start: new Date(2026, 2, 6),
      categoryId: 'review',
      description: 'Every two weeks on Friday',
      recurrence: { frequency: 'weekly', interval: 2, byDay: [5] }
    },
    {
      id: 'yoga',
      title: 'Yoga',
      start: new Date(2026, 2, 3),
      categoryId: 'sport',
      helperText: '6:00 PM',
      recurrence: { frequency: 'weekly', byDay: [2, 4] }
    },
    {
      id: 'restmuell',
      title: 'General waste',
      start: new Date(2026, 2, 4),
      categoryId: 'waste',
      recurrence: { frequency: 'weekly', interval: 2, byDay: [3] }
    }
  ];
</script>

<div class="max-w-sm">
  <Calendar
    {events}
    {categories}
    showEventList
    showLegend
    showWeekNumbers
    locale="en-US"
    defaultMonth={2}
    defaultYear={2026}
    showViewSwitcher={false}
  />
</div>
